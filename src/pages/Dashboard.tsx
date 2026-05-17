import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronRight, Megaphone, Image as ImageIcon, UserX, Trash2, ArrowUpRight, LayoutDashboard, Users, ClipboardCheck, ListChecks, Shield, ArrowLeftRight, Check, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSkeleton } from '../components/LoadingSpinner';
import { formatTime12Hour } from '../lib/timeFormat';
import { Modal } from '../components/Modal';
import type { Event, EventAssignment, Setlist, Announcement, UserAvailability, SwapRequest } from '../types';

const verses = [
  { text: 'Shout with joy to the Lord, all the earth!', ref: 'Psalm 100:1 NLT' },
  { text: 'Sing a new song of praise to him; play skillfully on the harp, and sing with joy.', ref: 'Psalm 33:3 NLT' },
  { text: 'Let everything that breathes sing praises to the Lord! Praise the Lord!', ref: 'Psalm 150:6 NLT' },
  { text: 'Singing psalms and hymns and spiritual songs among yourselves, and making music to the Lord in your hearts.', ref: 'Ephesians 5:19 NLT' },
  { text: 'I will sing to the Lord as long as I live. I will praise my God to my last breath!', ref: 'Psalm 104:33 NLT' },
  { text: 'Come, let us sing to the Lord! Let us shout joyfully to the Rock of our salvation.', ref: 'Psalm 95:1 NLT' },
  { text: 'Worship the Lord with gladness. Come before him, singing with joy.', ref: 'Psalm 100:2 NLT' },
];

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const MANILA_TIMEZONE = 'Asia/Manila';
const DASHBOARD_REQUEST_TIMEOUT_MS = 8000;

async function withDashboardTimeout<T>(request: PromiseLike<T>, fallback: T, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Dashboard] ${label} timed out; rendering with fallback data.`);
      resolve(fallback);
    }, DASHBOARD_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } catch (error) {
    console.error(`[Dashboard] ${label} failed:`, error);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getManilaTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getManilaEventDateTime(eventDate: string, timeValue: string | null | undefined) {
  if (!timeValue) return new Date(`${eventDate}T23:59:59+08:00`);
  return new Date(`${eventDate}T${timeValue}+08:00`);
}

function compareEventsByDateTime(a: Event, b: Event) {
  return getManilaEventDateTime(a.event_date, a.start_time).getTime() - getManilaEventDateTime(b.event_date, b.start_time).getTime();
}

function compareAssignmentsByEventDateTime(a: EventAssignment, b: EventAssignment) {
  if (!a.events || !b.events) return 0;
  return compareEventsByDateTime(a.events, b.events);
}

function OpenSection({ children, className = '', accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/80 px-4 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.10)] dark:border-white/[0.06] dark:bg-[#181818] dark:shadow-[0_18px_40px_rgba(0,0,0,0.34)] sm:px-5 sm:py-7 ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.14))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))]"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
      />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] to-transparent dark:via-white/[0.08]" />
      {accent && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_12%_0%,rgba(29,185,84,0.14),transparent_42%),radial-gradient(circle_at_88%_0%,rgba(29,185,84,0.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_12%_0%,rgba(29,185,84,0.24),transparent_42%),radial-gradient(circle_at_88%_0%,rgba(29,185,84,0.14),transparent_34%)]" />
      )}
      <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-[#1DB954]/28 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ index, children, action }: { index: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 px-0.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400 tracking-widest dark:text-white/25">{index}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/52">{children}</span>
      </div>
      {action}
    </div>
  );
}

function DateChip({ date, dim = false }: { date: string | null; dim?: boolean }) {
  if (!date) return <div className="h-14 w-14 rounded-[0.7rem] shrink-0 bg-gray-100 dark:bg-[#222]" />;
  const parsed = parseISO(date);
  return (
    <div
      className={`relative flex flex-col items-center justify-center h-14 w-14 rounded-[0.7rem] shrink-0 border ${dim ? 'border-black/[0.06] bg-gray-100 dark:border-white/[0.06] dark:bg-[#202020]' : 'border-black/[0.08] bg-[linear-gradient(145deg,#ffffff,#eef2ef)] dark:border-white/[0.08] dark:bg-[linear-gradient(145deg,#262626,#1c1c1c)]'}`}
      style={dim ? {} : { boxShadow: '0 10px 24px rgba(15,23,42,0.12)' }}
    >
      <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${dim ? 'text-gray-400 dark:text-white/28' : 'text-[#1DB954]'}`}>
        {format(parsed, 'MMM')}
      </span>
      <span className={`text-[24px] font-black leading-none mt-0.5 ${dim ? 'text-gray-500 dark:text-white/58' : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.05em' }}>
        {format(parsed, 'd')}
      </span>
      <span className={`text-[8px] font-bold leading-none mt-0.5 ${dim ? 'text-gray-400 dark:text-white/24' : 'text-gray-500 dark:text-white/42'}`}>
        {format(parsed, 'EEE')}
      </span>
    </div>
  );
}

export function Dashboard() {
  const { user, profile, isLeader, isProductionDirector } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [myAssignments, setMyAssignments] = useState<EventAssignment[]>([]);
  const [pendingSetlists, setPendingSetlists] = useState<Setlist[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<UserAvailability[]>([]);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0 });
  const [incomingSwapRequests, setIncomingSwapRequests] = useState<SwapRequest[]>([]);
  const [respondingSwap, setRespondingSwap] = useState<string | null>(null);
  const [selectedUnavailability, setSelectedUnavailability] = useState<UserAvailability | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [now, setNow] = useState(new Date());
  const [pullRefreshDistance, setPullRefreshDistance] = useState(0);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);
  const pullRefreshDistanceRef = useRef(0);
  const refreshInFlightRef = useRef(false);

  const todayVerse = verses[new Date().getDay() % verses.length];

  useEffect(() => {
    document.body.classList.add('allow-native-pull-refresh');
    return () => {
      document.body.classList.remove('allow-native-pull-refresh');
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchIncomingSwaps = useCallback(async () => {
    if (!user) return;
    const { data: swapData } = await supabase
      .from('user_availability')
      .select(`
        *,
        requester:user_id(id, first_name, last_name, nickname, avatar_url),
        requester_assignment:requester_assignment_id(*, events(*), roles(*)),
        target_assignment:target_assignment_id(*, events(*), roles(*))
      `)
      .eq('target_id', user.id)
      .eq('status', 'pending')
      .is('target_response_at', null)
      .order('created_at', { ascending: false });
    setIncomingSwapRequests((swapData || []) as any[]);
  }, [user]);

  const loadDashboardData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const today = getManilaTodayKey();
    const silent = options?.silent ?? false;

    if (!silent) setLoading(true);

    try {
      const emptyList = { data: [] };
      const [eventsRes, assignRes, setlistsRes, announcementsRes, unavailableRes, pendingLeaveRes] = await Promise.all([
        withDashboardTimeout(
          supabase.from('events').select('*').gte('event_date', today).order('event_date').limit(5),
          emptyList,
          'Upcoming events',
        ),
        withDashboardTimeout(
          supabase.from('event_assignments').select('*, events(*), roles(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
          emptyList,
          'My assignments',
        ),
        isLeader
          ? withDashboardTimeout(
              supabase.from('setlists').select('*, events(title, event_date)').eq('status', 'pending_review').order('created_at', { ascending: false }),
              emptyList,
              'Pending setlists',
            )
          : Promise.resolve(emptyList),
        withDashboardTimeout(
          supabase.from('announcements').select('*, profiles!announcements_created_by_fkey(first_name, last_name)').order('created_at', { ascending: false }).limit(3),
          emptyList,
          'Recent announcements',
        ),
        withDashboardTimeout(
          supabase.from('user_availability').select('*, profiles!user_availability_user_id_fkey(first_name, last_name, nickname, avatar_url)').eq('status', 'approved').or(`unavailable_date.gte.${today},end_date.gte.${today}`).order('created_at', { ascending: true }),
          emptyList,
          'Unavailable members',
        ),
        isLeader
          ? withDashboardTimeout(
              supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('request_type', 'leave'),
              { count: 0 },
              'Pending leave count',
            )
          : Promise.resolve({ count: 0 }),
      ]);

      const events = ((eventsRes.data || []) as Event[]).slice().sort(compareEventsByDateTime);
      setUpcomingEvents(events);

      const assignments = (assignRes.data || []) as EventAssignment[];
      const nowForAssignments = new Date();
      const upcomingAssignments = assignments.filter(a => a.events && getManilaEventDateTime(a.events.event_date, a.events.start_time) >= nowForAssignments);
      upcomingAssignments.sort(compareAssignmentsByEventDateTime);
      setMyAssignments(upcomingAssignments);
      setPendingSetlists((setlistsRes.data || []) as Setlist[]);
      setRecentAnnouncements((announcementsRes.data || []) as Announcement[]);
      setUnavailableMembers((unavailableRes.data || []) as UserAvailability[]);
      setPendingLeaveCount(pendingLeaveRes.count || 0);
      const upcoming = assignments.filter(a => a.events && getManilaEventDateTime(a.events.event_date, a.events.start_time) >= nowForAssignments);
      setStats({ total: upcoming.length, confirmed: upcoming.filter(a => a.status === 'confirmed').length, pending: upcoming.filter(a => a.status === 'pending').length });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isLeader, user]);

  useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    fetchIncomingSwaps();

    // Subscribe to real-time changes for swap/sub requests targeting me
    const channel = supabase
      .channel('dashboard-swap-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_availability',
        filter: `target_id=eq.${user.id}`,
      }, () => {
        fetchIncomingSwaps();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchIncomingSwaps]);

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [loadDashboardData, user]);

  useEffect(() => {
    let startY = 0;
    let tracking = false;
    const triggerDistance = 108;

    const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

    const handleTouchStart = (event: TouchEvent) => {
      if (!isMobile() || window.scrollY > 0 || event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const distance = event.touches[0].clientY - startY;
      if (distance <= 0 || window.scrollY > 0) {
        pullRefreshDistanceRef.current = 0;
        setPullRefreshDistance(0);
        return;
      }
      const nextDistance = Math.min(distance, 132);
      pullRefreshDistanceRef.current = nextDistance;
      setPullRefreshDistance(nextDistance);
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pullRefreshDistanceRef.current < triggerDistance || refreshInFlightRef.current) {
        pullRefreshDistanceRef.current = 0;
        setPullRefreshDistance(0);
        return;
      }

      pullRefreshDistanceRef.current = triggerDistance;
      refreshInFlightRef.current = true;
      setPullRefreshDistance(triggerDistance);
      setIsRefreshingApp(true);

      window.setTimeout(async () => {
        try {
          await Promise.all([
            loadDashboardData({ silent: true }),
            fetchIncomingSwaps(),
          ]);
        } finally {
          pullRefreshDistanceRef.current = 0;
          refreshInFlightRef.current = false;
          setIsRefreshingApp(false);
          setPullRefreshDistance(0);
        }
      }, 80);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [fetchIncomingSwaps, loadDashboardData]);

  const handleSwapResponse = async (req: any, accepted: boolean) => {
    if (!user || !profile?.org_id) return;
    setRespondingSwap(req.id);
    try {
      await supabase.from('user_availability').update({
        status: accepted ? 'pending' : 'rejected',
        target_response_at: new Date().toISOString(),
      }).eq('id', req.id);

      const targetName = profile?.nickname || `${profile?.first_name} ${profile?.last_name}`.trim();

      if (accepted) {
        // 1. Notify requester that target accepted
        const requesterNotif = supabase.from('notifications').insert({
          user_id: req.user_id,
          type: req.request_type === 'sub' ? 'sub_approved' : 'swap_approved',
          title: `${targetName} accepted your ${req.request_type === 'sub' ? 'sub' : 'swap'} request`,
          body: `Your ${req.request_type === 'sub' ? 'sub' : 'swap'} request is now pending leadership approval.`,
          data: { swap_request_id: req.id, url: '/my-assignments' },
        });

        // 2. Notify leaders that a swap needs approval
        // Get user IDs of everyone with a leadership role or who is an org admin
        const [leadershipRes, adminsRes] = await Promise.all([
          supabase
            .from('user_roles')
            .select('user_id, roles!inner(is_leadership)')
            .eq('org_id', profile.org_id)
            .eq('roles.is_leadership', true),
          supabase
            .from('profiles')
            .select('id')
            .eq('org_id', profile.org_id)
            .eq('is_org_admin', true)
        ]);
        
        const leaderIds = new Set([
          ...(leadershipRes.data || []).map(r => r.user_id),
          ...(adminsRes.data || []).map(p => p.id)
        ]);

        const leaderNotifs = Array.from(leaderIds)
          .filter(id => id !== user.id) // Don't notify self
          .map(id => ({
            user_id: id,
            type: req.request_type === 'sub' ? 'sub_request' : 'swap_request',
            title: req.request_type === 'sub' ? 'New sub request for review' : 'New swap request for review',
            body: `${targetName} agreed to ${req.request_type === 'sub' ? 'sub' : 'swap'} with ${req.requester?.nickname || req.requester?.first_name}. Needs your approval.`,
            data: { url: '/leadership/overview', swap_request_id: req.id }
          }));

        const ops = [requesterNotif];
        if (leaderNotifs.length > 0) {
          ops.push(supabase.from('notifications').insert(leaderNotifs));
        }

        await Promise.all(ops);
      } else {
        // Notify requester that target declined
        await supabase.from('notifications').insert({
          user_id: req.user_id,
          type: 'swap_declined',
          title: `${targetName} declined your swap request`,
          body: 'Your schedule swap request was declined.',
          data: { swap_request_id: req.id, url: '/my-assignments' },
        });
      }

      setIncomingSwapRequests(prev => prev.filter(r => r.id !== req.id));
    } catch {
      // silently fail — user can try again
    } finally {
      setRespondingSwap(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUnavailability) return;
    const { error } = await supabase.from('user_availability').delete().eq('id', selectedUnavailability.id);
    if (!error) { setUnavailableMembers(prev => prev.filter(u => u.id !== selectedUnavailability.id)); setSelectedUnavailability(null); setShowDeleteConfirm(false); }
  };

  if (loading) return <div className="page-container"><DashboardSkeleton /></div>;

  const displayName = profile?.nickname || profile?.first_name || 'there';
  const greeting = (() => {
    const h = now.getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const nextEvent = upcomingEvents.find(event => getManilaEventDateTime(event.event_date, event.start_time) >= now) ?? upcomingEvents[0];
  const nextAssignment = myAssignments[0];
  const serviceTime = nextEvent?.start_time ? formatTime12Hour(nextEvent.start_time) : null;
  const [serviceHour = 'Ready', servicePeriod = ''] = serviceTime?.split(' ') ?? [];
  const serviceDateCaption = nextEvent?.event_date === getManilaTodayKey(now)
    ? 'today'
    : nextEvent
      ? format(parseISO(nextEvent.event_date), 'MMM d')
      : 'scheduled';
  const heroPulse = incomingSwapRequests.length > 0
    ? { label: 'Requests', value: incomingSwapRequests.length.toString(), caption: 'waiting' }
    : stats.pending > 0
      ? { label: 'Needs reply', value: stats.pending.toString(), caption: 'pending' }
      : serviceTime
        ? { label: 'Service', value: serviceHour, caption: `${servicePeriod} ${serviceDateCaption}`.trim() }
        : { label: 'No service', value: 'Clear', caption: 'scheduled' };

  return (
    <div className="page-container page-bottom-pad relative overflow-hidden bg-[#f6f4ef] text-gray-900 dark:bg-[#121212] dark:text-white">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#f6f4ef] dark:bg-[#121212] [background-image:radial-gradient(circle_at_top_left,rgba(29,185,84,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_20%),linear-gradient(180deg,#fbfaf6_0%,#f6f4ef_18%,#f1eee7_100%)] dark:[background-image:radial-gradient(circle_at_top_left,rgba(29,185,84,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_18%),linear-gradient(180deg,#1a1a1a_0%,#121212_18%,#121212_100%)]"
      />
      {createPortal(
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top)+0.85rem)] z-[9999] flex justify-center px-4 lg:hidden"
          initial={false}
          animate={{
            opacity: pullRefreshDistance > 18 || isRefreshingApp ? 1 : 0,
            y: pullRefreshDistance > 18 || isRefreshingApp ? 0 : -10,
            scale: pullRefreshDistance >= 108 || isRefreshingApp ? 1 : 0.96,
          }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/92 px-3 py-2 text-[12px] font-bold text-gray-900 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#222222]/92 dark:text-white dark:shadow-[0_18px_45px_-24px_rgba(0,0,0,0.65)]">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingApp ? 'animate-spin' : ''}`} />
            <span>{isRefreshingApp ? 'Refreshing...' : pullRefreshDistance >= 108 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        </motion.div>,
        document.body
      )}
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-6"
      >

        {/* ── 01 · Home Command Center ── */}
        <motion.section
          variants={item}
          className="relative overflow-hidden rounded-[1.9rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.24),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.16),transparent_36%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(6,95,70,0.72)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)] dark:shadow-[0_28px_80px_-44px_rgba(0,0,0,0.88)] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />
          <button
            onClick={() => navigate(heroPulse.label === 'Requests' ? '/my-assignments' : heroPulse.label === 'Needs reply' ? '/my-assignments?status=pending' : '/events')}
            className="absolute right-5 top-[2.65rem] z-10 hidden w-[calc((100%-4rem)/3)] rounded-2xl border border-white bg-white px-3 py-2.5 text-center shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] dark:border-white/[0.06] dark:bg-[#1f1f1f] dark:shadow-[0_14px_38px_-28px_rgba(0,0,0,0.8)] min-[390px]:block lg:hidden"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/42">{heroPulse.label}</p>
            <p className="mt-1 truncate text-[1.35rem] font-black leading-none text-gray-900 dark:text-white" style={{ letterSpacing: '-0.055em' }}>{heroPulse.value}</p>
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-white/28">{heroPulse.caption}</p>
          </button>

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start">
              <div className="min-w-0 min-[390px]:pr-24 lg:pr-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping dark:bg-emerald-400" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  </span>
                  <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-emerald-700/75 dark:text-emerald-300/70">
                    {format(now, 'EEE, MMM d')} <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> {format(now, 'h:mm a')}
                  </p>
                </div>

                <p className="mt-3 text-sm font-semibold text-gray-500 dark:text-white/44">{greeting},</p>
                <h1
                  className="mt-1 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                  style={{ letterSpacing: '-0.065em' }}
                >
                  {displayName}.
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[23rem]">
              {[
                { label: 'Upcoming', value: stats.total, status: 'all' },
                { label: 'Confirmed', value: stats.confirmed, status: 'confirmed' },
                { label: 'Pending', value: stats.pending, status: 'pending' },
              ].map(stat => (
                <button
                  key={stat.label}
                  onClick={() => navigate(`/my-assignments?status=${stat.status}`)}
                  className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.05]"
                >
                  <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-white/34">{stat.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.11] md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              {nextEvent ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/46">Coming Up</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-gray-950 dark:text-white">
                    {nextEvent.title} <span className="font-mono text-xs font-semibold text-gray-500 dark:text-white/34">· {format(parseISO(nextEvent.event_date), 'MMM d')}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-gray-500 dark:text-white/58">No upcoming service is scheduled yet.</p>
              )}
            </div>
            <button
              onClick={() => navigate('/events')}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black text-white shadow-[0_16px_34px_-18px_rgba(29,185,84,0.8)] transition-all hover:scale-[1.02] active:scale-[0.97]"
              style={{ background: '#1DB954' }}
            >
              Open calendar <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.section>

        {/* ── 02 · Verse ── */}
        <motion.section variants={item}>
          <OpenSection accent className="px-1 pt-8 sm:pt-10">
            <SectionLabel index="02">Daily Verse</SectionLabel>
            <div className="relative max-w-4xl pl-5 sm:pl-7">
              <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(34,197,94,0.7), rgba(34,197,94,0.05))' }} />
              <p
                className="text-[22px] sm:text-[28px] lg:text-[34px] font-light leading-[1.28] text-gray-900 dark:text-white"
                style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"ss01", "kern"' }}
              >
                "{todayVerse.text}"
              </p>
              <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.2em] text-[#1DB954]/82">
                — {todayVerse.ref}
              </p>
            </div>
          </OpenSection>
        </motion.section>

        {/* ── Incoming Swap Requests ── */}
        {incomingSwapRequests.length > 0 && (
          <motion.section variants={item}>
            <div className="space-y-2">
              {incomingSwapRequests.map(req => {
                const requesterName = req.requester?.nickname || `${req.requester?.first_name} ${req.requester?.last_name}`.trim();
                const isResponding = respondingSwap === req.id;
                const isSub = !req.target_assignment_id;
                return (
                  <div
                    key={req.id}
                    className="relative overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/82 dark:border-white/[0.06] dark:bg-[#181818]"
                    style={{ boxShadow: '0 18px 40px rgba(15,23,42,0.10)' }}
                  >
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(29,185,84,0.1) 0%, transparent 60%)' }} />
                    <div className="relative px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-6 w-6 rounded-lg flex items-center justify-center bg-black/[0.05] dark:bg-[#1f1f1f] shrink-0">
                          <ArrowLeftRight className="h-3 w-3 text-[#1DB954]" />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/54">
                          {isSub ? 'Sub Request' : 'Swap Request'}
                        </p>
                      </div>

                      <p className="text-[14px] font-bold text-gray-950 dark:text-white mb-0.5" style={{ letterSpacing: '-0.02em' }}>
                        {requesterName} {isSub ? 'needs a sub' : 'wants to swap schedules'}
                      </p>

                      <div className={`grid ${isSub ? 'grid-cols-1' : 'grid-cols-2'} gap-2 my-3`}>
                        <div className="rounded-xl bg-black/[0.03] border border-black/[0.05] px-3 py-2.5 dark:bg-[#202020] dark:border-white/[0.05]">
                          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-white/28 mb-1">Their assignment</p>
                          <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight">{req.requester_assignment?.events?.title}</p>
                          <p className="text-[10px] text-gray-500 dark:text-white/34 font-mono mt-0.5">
                            {req.requester_assignment?.events?.event_date && format(parseISO(req.requester_assignment.events.event_date), 'MMM d')}
                            {req.requester_assignment?.roles?.name && ` · ${req.requester_assignment.roles.name}`}
                          </p>
                        </div>
                        {!isSub && (
                          <div className="rounded-xl bg-black/[0.03] border border-black/[0.05] px-3 py-2.5 dark:bg-[#202020] dark:border-white/[0.05]">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-[#1DB954] mb-1">Your assignment</p>
                            <p className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight">{req.target_assignment?.events?.title}</p>
                            <p className="text-[10px] text-gray-500 dark:text-white/34 font-mono mt-0.5">
                              {req.target_assignment?.events?.event_date && format(parseISO(req.target_assignment.events.event_date), 'MMM d')}
                              {req.target_assignment?.roles?.name && ` · ${req.target_assignment.roles.name}`}
                            </p>
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-white/40 italic mb-3 leading-relaxed">
                        "{req.reason}"
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSwapResponse(req, false)}
                          disabled={isResponding}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold text-gray-900 bg-black/[0.05] border border-black/[0.06] hover:bg-black/[0.08] transition-colors disabled:opacity-50 dark:text-white dark:bg-[#232323] dark:border-white/[0.06] dark:hover:bg-[#2a2a2a]"
                        >
                          <X className="h-3.5 w-3.5" /> Decline
                        </button>
                        <button
                          onClick={() => handleSwapResponse(req, true)}
                          disabled={isResponding}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold text-[#191414] bg-[#1DB954] border border-[#1DB954] hover:brightness-105 transition-colors disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Accept
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ── 03 · Your Next Service (compact gradient) ── */}
        {nextAssignment?.events && (
          <motion.section variants={item}>
            <SectionLabel index="03">Your Next Service</SectionLabel>
            <button
              onClick={() => navigate(`/events/${nextAssignment.event_id}`)}
              className="group w-full text-left"
            >
              <div
                className="relative overflow-hidden rounded-[1.6rem] px-5 py-4 sm:px-6 transition-all duration-500 group-hover:-translate-y-0.5 border border-black/[0.06] dark:border-white/[0.06]"
                style={{
                  background: nextAssignment.status === 'confirmed'
                    ? 'linear-gradient(135deg, #eff8f2 0%, #f8fcf9 45%, #edf5ef 100%)'
                    : 'linear-gradient(135deg, #fff7e8 0%, #fdf8ef 45%, #f5efe2 100%)',
                  boxShadow: '0 20px 46px -26px rgba(15,23,42,0.14), 0 1px 2px rgba(15,23,42,0.08)',
                }}
              >
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                  style={{
                    background: nextAssignment.status === 'confirmed'
                      ? 'radial-gradient(circle, rgba(29,185,84,0.26), transparent 70%)'
                      : 'radial-gradient(circle, rgba(255,164,43,0.18), transparent 70%)',
                    filter: 'blur(16px)', opacity: 0.7,
                  }}
                />

                <div className="relative flex items-center gap-4">
                  <DateChip date={nextAssignment.events.event_date} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${nextAssignment.status === 'confirmed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 dark:text-white/48">
                        {nextAssignment.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation'}
                      </p>
                    </div>
                    <p className="text-[15px] font-bold text-gray-950 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.02em' }}>
                      {(() => { const parts = (nextAssignment.events.title || '').split(' '); if (parts.length > 1) { parts[parts.length - 1] = parts[parts.length - 1][0].toUpperCase() + '.'; } return parts.join(' '); })()}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {nextAssignment.roles?.name && (
                        <span className="text-[11px] text-gray-500 dark:text-white/42 font-mono">{nextAssignment.roles.name}</span>
                      )}
                      {nextAssignment.events.start_time && (
                        <>
                          <span className="text-gray-300 dark:text-white/18">·</span>
                          <span className="text-[11px] text-gray-500 dark:text-white/42 font-mono">{formatTime12Hour(nextAssignment.events.start_time)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/26 group-hover:translate-x-0.5 group-hover:text-white/58 transition-all shrink-0" />
                </div>
              </div>
            </button>
          </motion.section>
        )}

        {/* ── 05 · Events + Assignments + Announcements ── */}
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">

          <motion.section variants={item}>
            <OpenSection className="h-full pt-7">
            <SectionLabel
              index="05"
              action={
                <button onClick={() => navigate('/events')} className="text-[11px] font-semibold text-[#1DB954] hover:text-[#48d67c] flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Upcoming Events</span>
            </SectionLabel>

            {upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-gray-500 dark:text-white/34 py-6">No upcoming events.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {upcomingEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="group flex items-center gap-3.5 rounded-[1.1rem] px-2.5 py-3.5 -mx-2.5 w-[calc(100%+1.25rem)] text-left transition-all duration-200 hover:bg-black/[0.04] dark:hover:bg-[#212121]"
                  >
                    <DateChip date={event.event_date} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate leading-tight tracking-tight">{event.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/36 mt-0.5 font-mono">
                        {event.event_type}{event.start_time && ` · ${formatTime12Hour(event.start_time)}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-white/18 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:text-gray-700 dark:group-hover:text-white/42" />
                  </button>
                ))}
              </div>
            )}
            </OpenSection>
          </motion.section>

          <motion.section variants={item}>
            <OpenSection className="h-full pt-7">
            <SectionLabel
              index="06"
              action={
                <button onClick={() => navigate('/my-assignments')} className="text-[11px] font-semibold text-[#1DB954] hover:text-[#48d67c] flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Music className="h-3 w-3" /> My Assignments</span>
            </SectionLabel>

            {myAssignments.length === 0 ? (
              <p className="text-[13px] text-gray-500 dark:text-white/34 py-6">No current assignments.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {myAssignments.slice(0, 3).map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/events/${a.event_id}`)}
                    className="group flex items-center gap-3.5 rounded-[1.1rem] px-2.5 py-3.5 -mx-2.5 w-[calc(100%+1.25rem)] text-left transition-all duration-200 hover:bg-black/[0.04] dark:hover:bg-[#212121]"
                  >
                    <DateChip date={a.events?.event_date ?? null} dim={a.status === 'declined'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate leading-tight tracking-tight">{a.events?.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/36 mt-0.5 font-mono">
                        {a.roles?.name}{a.events?.start_time && ` · ${formatTime12Hour(a.events.start_time)}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 border ${
                      a.status === 'confirmed' ? 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25' :
                      a.status === 'declined' ? 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25' :
                      'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                    }`}>
                      {a.status === 'confirmed' ? 'Confirmed' : a.status === 'declined' ? 'Declined' : 'Pending'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            </OpenSection>
          </motion.section>

        {/* ── 07 · Announcements ── */}
        {recentAnnouncements.length > 0 && (
          <motion.section variants={item} className="lg:col-span-2 xl:col-span-1">
            <OpenSection className="h-full pt-7">
            <SectionLabel
              index="07"
              action={
                <button onClick={() => navigate('/announcements')} className="text-[11px] font-semibold text-[#1DB954] hover:text-[#48d67c] flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Megaphone className="h-3 w-3" /> Announcements</span>
            </SectionLabel>

            <div className="divide-y divide-white/[0.06]">
              {recentAnnouncements.map(a => {
                const blocks = (a as Announcement & { content_blocks?: { type: string; content: string }[] }).content_blocks;
                const hasPhotos = blocks?.some(b => b.type === 'image');
                const previewText = blocks?.length ? blocks.find(b => b.type === 'text')?.content || '' : a.content;
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/announcements/${a.id}`)}
                    className="group flex items-start gap-4 rounded-[1.1rem] px-2.5 py-4 -mx-2.5 w-[calc(100%+1.25rem)] text-left transition-all duration-200 hover:bg-black/[0.04] dark:hover:bg-[#212121]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate leading-tight tracking-tight">{a.title}</p>
                        {a.priority === 'urgent' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 bg-red-50 dark:bg-red-500/[0.14] text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/25">Urgent</span>
                        )}
                        {hasPhotos && <ImageIcon className="h-3 w-3 text-gray-400 dark:text-white/28 shrink-0" />}
                      </div>
                      {previewText && <p className="text-[12px] text-gray-500 dark:text-white/42 line-clamp-1 leading-relaxed">{previewText}</p>}
                      <p className="text-[10px] font-mono text-gray-400 dark:text-white/24 mt-1.5 tracking-wide">
                        {a.profiles?.first_name} {a.profiles?.last_name} · {format(parseISO(a.created_at), 'MMM d')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-white/18 shrink-0 mt-1 transition-all group-hover:translate-x-0.5 group-hover:text-gray-700 dark:group-hover:text-white/42" />
                  </button>
                );
              })}
            </div>
            </OpenSection>
          </motion.section>
        )}
        </div>

      </motion.div>

      {/* Modals — unchanged */}
      <Modal open={!!selectedUnavailability} onClose={() => setSelectedUnavailability(null)} title="Unavailability Details">
        {selectedUnavailability && (
          <>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Team Member</label><p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedUnavailability.profiles?.first_name} {selectedUnavailability.profiles?.last_name}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</label><p className="text-sm text-gray-900 dark:text-white">{selectedUnavailability.leave_type === 'range' && selectedUnavailability.start_date && selectedUnavailability.end_date ? `${format(parseISO(selectedUnavailability.start_date), 'MMM d')} – ${format(parseISO(selectedUnavailability.end_date), 'MMMM d, yyyy')}` : selectedUnavailability.unavailable_date ? format(parseISO(selectedUnavailability.unavailable_date), 'EEEE, MMMM d, yyyy') : '—'}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reason</label><p className="text-sm text-gray-700 dark:text-gray-300">{selectedUnavailability.reason || 'No reason provided'}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</label><span className="badge-green">{selectedUnavailability.status}</span></div>
              {selectedUnavailability.reviewed_at && <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reviewed At</label><p className="text-sm text-gray-700 dark:text-gray-300">{format(parseISO(selectedUnavailability.reviewed_at), 'MMMM d, yyyy h:mm a')}</p></div>}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              {isProductionDirector ? (<><button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button><button onClick={() => setShowDeleteConfirm(true)} className="btn-danger flex items-center gap-2"><Trash2 className="h-4 w-4" />Delete</button></>) : (<button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button>)}
            </div>
          </>
        )}
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Request" size="sm">
        <p className="text-sm text-gray-700 dark:text-gray-300">Are you sure you want to delete this unavailability request? This action cannot be undone.</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleConfirmDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
