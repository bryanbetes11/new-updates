import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { dispatchMessagingRefresh } from '../lib/realtimeSignals';

export interface MessageSender {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface MessageReaction {
  emoji: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  reply_to: string | null;
  sender: MessageSender;
  reactions: MessageReaction[];
  reply_preview: { content: string; sender_name: string } | null;
}

export interface TypingUser {
  user_id: string;
  name: string;
}

interface TypingPayload {
  user_id: string;
  name: string;
  is_typing?: boolean;
}

export interface MemberReadTime {
  user_id: string;
  last_read_at: string | null;
}

type MessageQueryRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_pinned: boolean | null;
  reply_to: string | null;
  profiles: MessageSender | null;
  message_reactions: MessageReaction[] | null;
};

type ReplyMessageQueryRow = {
  id: string;
  content: string;
  profiles: Pick<MessageSender, 'first_name' | 'last_name' | 'nickname'> | null;
};

function getFullName(profile: { first_name: string | null; last_name: string | null } | null | undefined): string {
  return `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown';
}

function isTypingPayload(payload: unknown): payload is TypingPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Record<string, unknown>;
  return typeof value.user_id === 'string' && typeof value.name === 'string';
}

function getPayloadSenderId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as { new?: unknown };
  if (!value.new || typeof value.new !== 'object') return null;
  const row = value.new as Record<string, unknown>;
  return typeof row.sender_id === 'string' ? row.sender_id : null;
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [memberReadTimes, setMemberReadTimes] = useState<MemberReadTime[]>([]);
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMemberReadTimes = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from('conversation_members')
      .select('user_id, last_read_at')
      .eq('conversation_id', conversationId);
    if (data) setMemberReadTimes(data);
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);

    const { data } = await supabase
      .from('messages')
      .select(`
        id, conversation_id, sender_id, content, created_at, is_pinned, reply_to,
        profiles!sender_id(first_name, last_name, nickname, avatar_url),
        message_reactions(emoji, user_id)
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!data) { setLoading(false); return; }

    const messageRows = data as unknown as MessageQueryRow[];
    const replyIds = [...new Set(messageRows.filter(message => message.reply_to).map(message => message.reply_to as string))];
    let replyMap: Record<string, { content: string; sender_name: string }> = {};
    if (replyIds.length > 0) {
      const { data: replyData } = await supabase
        .from('messages')
        .select('id, content, profiles!sender_id(first_name, last_name, nickname)')
        .in('id', replyIds);
      if (replyData) {
        const replyRows = replyData as unknown as ReplyMessageQueryRow[];
        replyMap = Object.fromEntries(replyRows.map(reply => {
          const p = reply.profiles;
          const senderName = getFullName(p);
          return [reply.id, { content: reply.content, sender_name: senderName }];
        }));
      }
    }

    setMessages(messageRows.map(message => ({
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
      is_pinned: message.is_pinned ?? false,
      reply_to: message.reply_to,
      sender: message.profiles ?? { first_name: null, last_name: null, nickname: null, avatar_url: null },
      reactions: message.message_reactions ?? [],
      reply_preview: message.reply_to ? (replyMap[message.reply_to] ?? null) : null,
    })));
    setLoading(false);
  }, [conversationId]);

  const markRead = useCallback(async () => {
    if (!conversationId || !user) return;
    const { error } = await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    if (!error) dispatchMessagingRefresh();
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId) { setMessages([]); setTypingUsers([]); return; }
    fetchMessages();
    fetchMemberReadTimes();
    markRead();
  }, [fetchMessages, fetchMemberReadTimes, markRead, conversationId]);

  useEffect(() => {
    if (!conversationId || !user) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`msgs-${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const senderId = getPayloadSenderId(payload);
        if (senderId) {
          setTypingUsers(prev => prev.filter(u => u.user_id !== senderId));
          if (typingTimeouts.current[senderId]) {
            clearTimeout(typingTimeouts.current[senderId]);
            delete typingTimeouts.current[senderId];
          }
        }
        fetchMessages();
        markRead();
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, fetchMessages)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, fetchMemberReadTimes)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!isTypingPayload(payload)) return;
        if (payload.user_id === user.id) return;
        if (payload.is_typing === false) {
          setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
          if (typingTimeouts.current[payload.user_id]) {
            clearTimeout(typingTimeouts.current[payload.user_id]);
            delete typingTimeouts.current[payload.user_id];
          }
          return;
        }
        setTypingUsers(prev => {
          const exists = prev.find(u => u.user_id === payload.user_id);
          if (!exists) return [...prev, { user_id: payload.user_id, name: payload.name }];
          return prev.map(u => u.user_id === payload.user_id ? { ...u, name: payload.name } : u);
        });
        if (typingTimeouts.current[payload.user_id]) clearTimeout(typingTimeouts.current[payload.user_id]);
        typingTimeouts.current[payload.user_id] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
          delete typingTimeouts.current[payload.user_id];
        }, 3500);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
      setTypingUsers([]);
    };
  }, [conversationId, user, fetchMessages, fetchMemberReadTimes, markRead]);

  const sendTyping = useCallback((name: string, isTyping = true) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, name, is_typing: isTyping },
    });
  }, [user]);

  const sendMessage = useCallback(async (content: string, replyTo?: string) => {
    if (!conversationId || !user || !content.trim()) return null;
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      reply_to: replyTo || null,
    });
    if (!error) {
      markRead();
      dispatchMessagingRefresh();
    }
    return error;
  }, [conversationId, user, markRead]);

  const pinMessage = useCallback(async (messageId: string, pinned: boolean) => {
    if (!user) return false;
    const { error } = await supabase.from('messages').update({
      is_pinned: pinned,
      pinned_by: pinned ? user.id : null,
      pinned_at: pinned ? new Date().toISOString() : null,
    }).eq('id', messageId);

    if (error) {
      console.error('Failed to update pinned message state:', error);
      toast('error', error.message || `Failed to ${pinned ? 'pin' : 'unpin'} message`);
      return false;
    }

    setMessages(prev => prev.map(message => (
      message.id === messageId ? { ...message, is_pinned: pinned } : message
    )));
    return true;
  }, [toast, user]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return false;
    const { error } = await supabase.from('messages').update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    }).eq('id', messageId);

    if (error) {
      console.error('Failed to delete message:', error);
      toast('error', error.message || 'Failed to delete message');
      return false;
    }

    return true;
  }, [toast, user]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    const existing = msg?.reactions.find(r => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }
  }, [user, messages]);

  return {
    messages,
    loading,
    typingUsers,
    memberReadTimes,
    sendMessage,
    sendTyping,
    pinMessage,
    deleteMessage,
    toggleReaction,
  };
}
