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
    const myReadMap: Record<string, string | null> = Object.fromEntries(
      myMemberships.map(m => [m.conversation_id, m.last_read_at])
    );

    const [convRes, membersRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, type, name, created_at, updated_at')
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversation_members',
        filter: `user_id=eq.${user.id}`,
      }, fetchConversations)
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

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ type: 'personal', created_by: user.id })
      .select('id')
      .single();
    if (error || !newConv) return null;

    await supabase.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: otherUserId },
    ]);
    await fetchConversations();
    return newConv.id;
  }, [user, conversations, fetchConversations]);

  return { conversations, loading, refresh: fetchConversations, createDirectConversation };
}
