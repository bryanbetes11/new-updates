import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CONVERSATIONS_REFRESH_EVENT } from '../lib/realtimeSignals';
import { withRequestTimeout } from '../lib/requestTimeout';

export interface ConversationMember {
  user_id: string;
  last_read_at: string | null;
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

export interface LastMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: 'personal' | 'group' | 'event';
  name: string | null;
  photo_url: string | null;
  event_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message: LastMessage | null;
  unread_count: number;
}

interface ConversationRpcRow extends Omit<Conversation, 'members' | 'last_message' | 'unread_count'> {
  members: ConversationMember[] | null;
  last_message: LastMessage | null;
  unread_count: number | string | null;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withRequestTimeout(
        supabase.rpc('get_conversations'),
        { data: [], error: null, count: null, status: 200, statusText: 'OK' },
        'Conversations list',
      );

      if (error) {
        console.error('Fetch conversations error:', error);
        setConversations([]);
        return;
      }

      const result: Conversation[] = ((data || []) as ConversationRpcRow[]).map((conversation) => ({
        ...conversation,
        members: Array.isArray(conversation.members) ? conversation.members : [],
        last_message: conversation.last_message ?? null,
        unread_count: Number(conversation.unread_count) || 0,
      }));
      result.sort((a, b) => {
        const aActivity = Math.max(Date.parse(a.updated_at), Date.parse(a.last_message?.created_at ?? a.created_at));
        const bActivity = Math.max(Date.parse(b.updated_at), Date.parse(b.last_message?.created_at ?? b.created_at));
        return bActivity - aActivity;
      });

      setConversations(result);
    } catch (error) {
      console.error('Fetch conversations error:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conv-list-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, fetchConversations)
      .subscribe();

    const handleExternalRefresh = () => { fetchConversations(); };
    window.addEventListener(CONVERSATIONS_REFRESH_EVENT, handleExternalRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CONVERSATIONS_REFRESH_EVENT, handleExternalRefresh);
    };
  }, [user, fetchConversations]);

  const createDirectConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!user) return null;
    const existing = conversations.find(c =>
      c.type === 'personal' &&
      c.members.length === 2 &&
      c.members.some(m => m.user_id === otherUserId)
    );
    if (existing) return existing.id;

    const { data, error } = await supabase.rpc('create_personal_conversation', {
      target_user_id: otherUserId,
    });
    if (error || !data) return null;

    await fetchConversations();
    return data as string;
  }, [user, conversations, fetchConversations]);

  const createGroupConversation = useCallback(async (memberIds: string[], groupName: string): Promise<string | null> => {
    if (!user) return null;
    const uniqueMemberIds = [...new Set(memberIds)].filter(id => id !== user.id);
    if (uniqueMemberIds.length === 0) return null;

    const { data, error } = await supabase.rpc('create_group_conversation', {
      member_ids: uniqueMemberIds,
      group_name: groupName.trim() || 'Group Chat',
    });
    if (error || !data) return null;

    await fetchConversations();
    return data as string;
  }, [user, fetchConversations]);

  const createEventConversation = useCallback(async (eventId: string): Promise<string | null> => {
    if (!user) return null;
    const existing = conversations.find(c => c.type === 'event' && c.event_id === eventId);
    if (existing) return existing.id;

    const { data, error } = await supabase.rpc('create_event_conversation', {
      p_event_id: eventId,
    });
    if (error || !data) return null;

    await fetchConversations();
    return data as string;
  }, [user, conversations, fetchConversations]);

  const requestDeleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('request_conversation_delete', {
      p_conversation_id: conversationId,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  const confirmDeleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('confirm_conversation_delete', {
      p_conversation_id: conversationId,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  const deleteConversationAsCreator = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('delete_conversation_as_creator', {
      p_conversation_id: conversationId,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  const renameGroupConversation = useCallback(async (conversationId: string, name: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('rename_group_conversation', {
      p_conversation_id: conversationId,
      p_name: name,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  const addGroupConversationMembers = useCallback(async (conversationId: string, memberIds: string[]): Promise<boolean> => {
    if (!user) return false;
    const uniqueMemberIds = [...new Set(memberIds)].filter(Boolean);
    if (uniqueMemberIds.length === 0) return true;

    const { error } = await supabase.rpc('add_group_conversation_members', {
      p_conversation_id: conversationId,
      p_member_ids: uniqueMemberIds,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  const updateGroupConversationPhoto = useCallback(async (conversationId: string, photoUrl: string | null): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('set_group_conversation_photo', {
      p_conversation_id: conversationId,
      p_photo_url: photoUrl,
    });

    if (!error) {
      await fetchConversations();
      return true;
    }

    const rpcMissing =
      error.code === 'PGRST202' ||
      error.code === '404' ||
      /set_group_conversation_photo/i.test(error.message);

    if (!rpcMissing) return false;

    const { error: fallbackError } = await supabase
      .from('conversations')
      .update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('type', 'group')
      .eq('created_by', user.id);

    if (fallbackError) return false;

    await fetchConversations();
    return true;
  }, [user, fetchConversations]);

  const discardEmptyConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.rpc('discard_empty_conversation', {
      p_conversation_id: conversationId,
    });
    if (!error) await fetchConversations();
    return !error;
  }, [user, fetchConversations]);

  return {
    conversations,
    loading,
    refresh: fetchConversations,
    createDirectConversation,
    createGroupConversation,
    createEventConversation,
    requestDeleteConversation,
    confirmDeleteConversation,
    deleteConversationAsCreator,
    renameGroupConversation,
    addGroupConversationMembers,
    updateGroupConversationPhoto,
    discardEmptyConversation,
  };
}
