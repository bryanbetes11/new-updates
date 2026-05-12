import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BADGE_COUNTS_REFRESH_EVENT } from '../lib/realtimeSignals';

export interface UnreadCounts {
  announcements: number;
  events: number;
  messages: number;
  pendingLeave: number;
  pendingSwaps: number;
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ announcements: 0, events: 0, messages: 0, pendingLeave: 0, pendingSwaps: 0 });
  const debounceRef = useRef<NodeJS.Timeout>();
  const channelId = useRef(`unread-counts-${Math.random().toString(36).substr(2, 9)}`);

  // Check permissions for counts
  const [canSeePendingLeave, setCanSeePendingLeave] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkPerms = async () => {
      const { data: roles } = await supabase.from('user_roles').select('roles(name, is_leadership)').eq('user_id', user.id);
      const isLdr = roles?.some(r => (r.roles as any)?.is_leadership) || false;
      const isOrgAdmin = (await supabase.from('profiles').select('is_org_admin').eq('id', user.id).single()).data?.is_org_admin || false;
      
      setIsLeader(isLdr || isOrgAdmin);
      setCanSeePendingLeave(isLdr || isOrgAdmin);
    };
    checkPerms();
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const queries = [
      supabase.from('announcements').select('id, created_at').order('created_at', { ascending: false }).limit(20).then(res => res),
      supabase.from('announcement_views').select('announcement_id').eq('user_id', user.id).then(res => res),
      supabase.from('event_assignments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending').then(res => res),
      supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', user.id).then(res => res),
    ];

    if (canSeePendingLeave) {
      queries.push(
        supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('request_type', 'leave').then(res => res)
      );
    }

    if (isLeader) {
      queries.push(
        supabase.from('user_availability')
          .select('id', { count: 'exact', head: true })
          .in('request_type', ['sub', 'swap'])
          .eq('status', 'pending')
          .not('target_response_at', 'is', null)
          .then(res => res)
      );
    }

    const results = await Promise.all(queries) as unknown[];
    const [announcementRes, viewsRes, pendingAssignRes, membershipsRes] = results as [any, any, any, any];
    const pendingLeaveRes = canSeePendingLeave ? results[4] as any : null;
    const pendingSwapsRes = isLeader ? results[canSeePendingLeave ? 5 : 4] as any : null;

    // Calc announcement unread
    const viewedIds = new Set((viewsRes.data || []).map((v: any) => v.announcement_id));
    const unreadAnnouncements = (announcementRes.data || []).filter((a: any) => !viewedIds.has(a.id)).length;

    // Calc message unread (simplified)
    let unreadMessages = 0;
    if (membershipsRes.data?.length) {
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', membershipsRes.data.map((m: any) => m.conversation_id))
        .order('created_at', { ascending: false });

      membershipsRes.data.forEach((m: any) => {
        const lastRead = m.last_read_at ? new Date(m.last_read_at) : new Date(0);
        const hasNew = (recentMessages || []).some(msg => msg.conversation_id === m.conversation_id && new Date(msg.created_at) > lastRead);
        if (hasNew) unreadMessages++;
      });
    }

    setCounts({
      announcements: Math.max(0, unreadAnnouncements),
      events: pendingAssignRes.count || 0,
      pendingLeave: pendingLeaveRes?.count || 0,
      pendingSwaps: pendingSwapsRes?.count || 0,
      messages: unreadMessages,
    });
  }, [user, canSeePendingLeave, isLeader]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchCounts, 80);
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => {
      clearInterval(interval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchCounts]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_assignments', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_assignments', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .subscribe();

    const handleExternal = () => debouncedFetch();
    window.addEventListener('notifications-updated', handleExternal);
    window.addEventListener(BADGE_COUNTS_REFRESH_EVENT, handleExternal);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notifications-updated', handleExternal);
      window.removeEventListener(BADGE_COUNTS_REFRESH_EVENT, handleExternal);
    };
  }, [user, debouncedFetch]);

  return counts;
}
