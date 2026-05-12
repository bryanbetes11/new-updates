import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BADGE_COUNTS_REFRESH_EVENT } from '../lib/realtimeSignals';

interface UnreadCounts {
  announcements: number;
  events: number;
  pendingLeave: number;
  pendingSwaps: number;
  messages: number;
}

export function useUnreadCounts() {
  const { user, isLeader, canApproveLeave } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ announcements: 0, events: 0, pendingLeave: 0, pendingSwaps: 0, messages: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelId = useRef(`nav-badge-updates-${Math.random().toString(36).slice(2)}`);

  const canSeePendingLeave = isLeader || canApproveLeave;

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const queries: PromiseLike<unknown>[] = [
      supabase.from('announcements').select('id', { count: 'exact', head: true }).then(res => res),
      supabase.from('announcement_views').select('announcement_id').eq('user_id', user.id).then(res => res),
      supabase.from('event_assignments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending').then(res => res),
      supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', user.id).then(res => res),
    ];

    if (canSeePendingLeave) {
      queries.push(
        supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(res => res)
      );
    }

    if (isLeader) {
      queries.push(
        supabase.from('swap_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_leadership').then(res => res)
      );
    }

    const results = await Promise.all(queries) as unknown[];
    const [announcementRes, viewsRes, pendingAssignRes, membershipsRes] = results as [
      { count: number | null },
      { data: { announcement_id: string }[] | null },
      { count: number | null },
      { data: { conversation_id: string; last_read_at: string | null }[] | null },
    ];

    const totalAnnouncements = announcementRes.count || 0;
    const viewedIds = new Set((viewsRes.data || []).map(v => v.announcement_id));
    const unreadAnnouncements = totalAnnouncements - viewedIds.size;

    const pendingLeaveRes = canSeePendingLeave ? (results[4] as { count: number | null }) : null;
    const pendingSwapsRes = isLeader ? (results[canSeePendingLeave ? 5 : 4] as { count: number | null }) : null;

    // Count unread conversations (conversations with messages newer than last_read_at)
    const memberships = membershipsRes.data || [];
    let unreadMessages = 0;
    if (memberships.length > 0) {
      const msgCounts = await Promise.all(memberships.map(async (m) => {
        let q = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', m.conversation_id)
          .neq('sender_id', user.id)
          .is('deleted_at', null);
        if (m.last_read_at) q = q.gt('created_at', m.last_read_at);
        const { count } = await q;
        return count || 0;
      }));
      unreadMessages = msgCounts.reduce((a, b) => a + b, 0);
    }

    setCounts({
      announcements: Math.max(0, unreadAnnouncements),
      events: pendingAssignRes.count || 0,
      pendingLeave: pendingLeaveRes?.count || 0,
      pendingSwaps: pendingSwapsRes?.count || 0,
      messages: unreadMessages,
    });
  }, [user, canSeePendingLeave]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_views', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_assignments', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, debouncedFetch)
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
