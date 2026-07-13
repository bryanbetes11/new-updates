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
  pendingSetlists: number;
}

function isLeadershipRole(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isLeadershipRole);
  return typeof value === 'object'
    && value !== null
    && 'is_leadership' in value
    && value.is_leadership === true;
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ announcements: 0, events: 0, messages: 0, pendingLeave: 0, pendingSwaps: 0, pendingSetlists: 0 });
  const debounceRef = useRef<NodeJS.Timeout>();
  const channelId = useRef(`unread-counts-${Math.random().toString(36).substr(2, 9)}`);

  // Check permissions for counts
  const [canSeePendingLeave, setCanSeePendingLeave] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkPerms = async () => {
      const { data: roles } = await supabase.from('user_roles').select('roles(name, is_leadership)').eq('user_id', user.id);
      const isLdr = roles?.some(role => isLeadershipRole(role.roles)) || false;
      const isOrgAdmin = (await supabase.from('profiles').select('is_org_admin').eq('id', user.id).single()).data?.is_org_admin || false;
      
      setIsLeader(isLdr || isOrgAdmin);
      setCanSeePendingLeave(isLdr || isOrgAdmin);
    };
    checkPerms();
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const [
      announcementRes,
      viewsRes,
      pendingAssignRes,
      membershipsRes,
      pendingLeaveRes,
      pendingSetlistsRes,
      pendingSwapsRes,
    ] = await Promise.all([
      supabase.from('announcements').select('id, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('announcement_views').select('announcement_id').eq('user_id', user.id),
      supabase.from('event_assignments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
      supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', user.id),
      canSeePendingLeave
        ? supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('request_type', 'leave')
        : Promise.resolve(null),
      isLeader
        ? supabase.from('setlists').select('id', { count: 'exact', head: true }).eq('status', 'pending_review')
        : Promise.resolve(null),
      isLeader
        ? supabase.from('user_availability')
            .select('id', { count: 'exact', head: true })
            .in('request_type', ['sub', 'swap'])
            .eq('status', 'pending')
            .not('target_response_at', 'is', null)
        : Promise.resolve(null),
    ]);

    // Calc announcement unread
    const viewedIds = new Set((viewsRes.data || []).map(view => view.announcement_id));
    const unreadAnnouncements = (announcementRes.data || []).filter(announcement => !viewedIds.has(announcement.id)).length;

    // Calc message unread (simplified)
    let unreadMessages = 0;
    if (membershipsRes.data?.length) {
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', membershipsRes.data.map(membership => membership.conversation_id))
        .order('created_at', { ascending: false });

      membershipsRes.data.forEach(membership => {
        const lastRead = membership.last_read_at ? new Date(membership.last_read_at) : new Date(0);
        const hasNew = (recentMessages || []).some(msg => msg.conversation_id === membership.conversation_id && new Date(msg.created_at) > lastRead);
        if (hasNew) unreadMessages++;
      });
    }

    setCounts({
      announcements: Math.max(0, unreadAnnouncements),
      events: pendingAssignRes.count || 0,
      pendingLeave: pendingLeaveRes?.count || 0,
      pendingSetlists: pendingSetlistsRes?.count || 0,
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
