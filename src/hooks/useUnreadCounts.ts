import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UnreadCounts {
  announcements: number;
  events: number;
  pendingLeave: number;
}

export function useUnreadCounts() {
  const { user, isLeader, canApproveLeave } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ announcements: 0, events: 0, pendingLeave: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelId = useRef(`nav-badge-updates-${Math.random().toString(36).slice(2)}`);

  const canSeePendingLeave = isLeader || canApproveLeave;

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const queries: Promise<unknown>[] = [
      supabase.from('announcements').select('id', { count: 'exact', head: true }),
      supabase.from('announcement_views').select('announcement_id').eq('user_id', user.id),
      supabase.from('event_assignments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
    ];

    if (canSeePendingLeave) {
      queries.push(
        supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      );
    }

    const results = await Promise.all(queries);
    const [announcementRes, viewsRes, pendingAssignRes] = results as [
      { count: number | null },
      { data: { announcement_id: string }[] | null },
      { count: number | null },
    ];

    const totalAnnouncements = announcementRes.count || 0;
    const viewedIds = new Set((viewsRes.data || []).map(v => v.announcement_id));
    const unreadAnnouncements = totalAnnouncements - viewedIds.size;

    const pendingLeaveRes = canSeePendingLeave ? (results[3] as { count: number | null }) : null;

    setCounts({
      announcements: Math.max(0, unreadAnnouncements),
      events: pendingAssignRes.count || 0,
      pendingLeave: pendingLeaveRes?.count || 0,
    });
  }, [user, canSeePendingLeave]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchCounts, 300);
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
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
      .subscribe();

    const handleExternal = () => debouncedFetch();
    window.addEventListener('notifications-updated', handleExternal);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notifications-updated', handleExternal);
    };
  }, [user, debouncedFetch]);

  return counts;
}
