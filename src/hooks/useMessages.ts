import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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

export interface MemberReadTime {
  user_id: string;
  last_read_at: string | null;
}

function getFullName(profile: { first_name: string | null; last_name: string | null } | null | undefined): string {
  return `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown';
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
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

    const replyIds = [...new Set(data.filter(m => m.reply_to).map(m => m.reply_to as string))];
    let replyMap: Record<string, { content: string; sender_name: string }> = {};
    if (replyIds.length > 0) {
      const { data: replyData } = await supabase
        .from('messages')
        .select('id, content, profiles!sender_id(first_name, last_name, nickname)')
        .in('id', replyIds);
      if (replyData) {
        replyMap = Object.fromEntries(replyData.map((r: any) => {
          const p = r.profiles;
          const senderName = getFullName(p);
          return [r.id, { content: r.content, sender_name: senderName }];
        }));
      }
    }

    setMessages(data.map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      content: m.content,
      created_at: m.created_at,
      is_pinned: m.is_pinned ?? false,
      reply_to: m.reply_to,
      sender: m.profiles ?? { first_name: null, last_name: null, nickname: null, avatar_url: null },
      reactions: m.message_reactions ?? [],
      reply_preview: m.reply_to ? (replyMap[m.reply_to] ?? null) : null,
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
      .channel(`msgs-${conversationId}-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => { fetchMessages(); markRead(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, fetchMessages)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversation_members',
        filter: `conversation_id=eq.${conversationId}`,
      }, fetchMemberReadTimes)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return;
        setTypingUsers(prev => {
          const exists = prev.find(u => u.user_id === payload.user_id);
          if (!exists) return [...prev, { user_id: payload.user_id, name: payload.name }];
          return prev;
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
    };
  }, [conversationId, user, fetchMessages, fetchMemberReadTimes, markRead]);

  const sendTyping = useCallback((name: string) => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, name } });
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
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      markRead();
      dispatchMessagingRefresh();
    }
    return error;
  }, [conversationId, user, markRead]);

  const pinMessage = useCallback(async (messageId: string, pinned: boolean) => {
    if (!user) return;
    await supabase.from('messages').update({
      is_pinned: pinned,
      pinned_by: pinned ? user.id : null,
      pinned_at: pinned ? new Date().toISOString() : null,
    }).eq('id', messageId);
  }, [user]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    await supabase.from('messages').update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    }).eq('id', messageId);
  }, [user]);

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
