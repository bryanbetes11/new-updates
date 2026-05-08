import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  event_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message: LastMessage | null;
  unread_count: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: myMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (!myMemberships?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = myMemberships.map(m => m.conversation_id);
    const [convRes, membersRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, type, name, event_id, created_by, created_at, updated_at')
        .in('id', convIds)
        .order('updated_at', { ascending: false }),
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, last_read_at')
        .in('conversation_id', convIds),
    ]);

    const memberUserIds = [...new Set((membersRes.data || []).map(m => m.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, nickname, avatar_url')
      .in('id', memberUserIds);
    const profileMap: Record<string, ConversationMember['profile']> = Object.fromEntries(
      (profilesData || []).map(p => [p.id, p])
    );

    const membersByConv = (membersRes.data || []).reduce((acc, m) => {
      if (!acc[m.conversation_id]) acc[m.conversation_id] = [];
      acc[m.conversation_id].push({
        user_id: m.user_id,
        last_read_at: m.last_read_at,
        profile: profileMap[m.user_id] ?? null,
      });
      return acc;
    }, {} as Record<string, ConversationMember[]>);

    const [lastMsgResults, unreadResults] = await Promise.all([
      Promise.all(convIds.map(async (cid) => {
        const { data } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at')
          .eq('conversation_id', cid)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { cid, msg: data as LastMessage | null };
      })),
      Promise.all(myMemberships.map(async (m) => {
        let q = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', m.conversation_id)
          .neq('sender_id', user.id)
          .is('deleted_at', null);
        if (m.last_read_at) q = q.gt('created_at', m.last_read_at);
        const { count } = await q;
        return { cid: m.conversation_id, count: count || 0 };
      })),
    ]);

    const lastMsgMap = Object.fromEntries(lastMsgResults.map(({ cid, msg }) => [cid, msg]));
    const unreadMap = Object.fromEntries(unreadResults.map(({ cid, count }) => [cid, count]));

    const result: Conversation[] = (convRes.data || []).map((c) => ({
      id: c.id,
      type: c.type as 'personal' | 'group' | 'event',
      name: c.name,
      event_id: c.event_id,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      members: membersByConv[c.id] || [],
      last_message: lastMsgMap[c.id] || null,
      unread_count: unreadMap[c.id] || 0,
    }));

    setConversations(result);
    setLoading(false);
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
    return () => { supabase.removeChannel(channel); };
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
    discardEmptyConversation,
  };
}
