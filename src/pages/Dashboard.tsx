import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, Music, ChevronRight, Megaphone, Trash2, ListChecks, ArrowLeftRight, Check, X, RefreshCw, Heart, MoreHorizontal, Edit3, Upload, UserPlus, MessageCircle, UserX, ClipboardCheck, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DashboardSkeleton } from '../components/LoadingSpinner';
import { formatTime12Hour } from '../lib/timeFormat';
import { Modal } from '../components/Modal';
import { EventArtwork } from '../components/EventArtwork';
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
type DashboardEventCard = Pick<Event, 'title' | 'event_date' | 'start_time' | 'event_type' | 'id'> & { location?: string };
type DashboardHubFilter = 'all' | 'week' | 'serving' | 'team';
type DashboardMemberSummary = { id: string; first_name?: string | null; last_name?: string | null; gender?: string | null };
type DashboardSongArtwork = {
  id: string;
  song_id?: string | null;
  position?: number | null;
  youtube_url?: string | null;
  songs?: {
    id?: string | null;
    title?: string | null;
    artist?: string | null;
    youtube_url?: string | null;
  } | Array<{
    id?: string | null;
    title?: string | null;
    artist?: string | null;
    youtube_url?: string | null;
  }> | null;
};
type DashboardArtworkSongRecord = {
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  youtube_url?: string | null;
};
type DashboardSetlistArtwork = {
  event_id?: string | null;
  setlist_songs?: DashboardSongArtwork[] | null;
};
type PendingReviewSetlist = Setlist & {
  events?: Pick<Event, 'id' | 'title' | 'event_date' | 'event_type'>;
  setlist_songs?: Array<DashboardSongArtwork>;
};

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

function formatDashboardLeaderName(profile: { first_name?: string | null; last_name?: string | null; gender?: string | null }) {
  const firstName = profile.first_name?.trim();
  const lastName = profile.last_name?.trim();
  if (!firstName && !lastName) return '';

  const prefix = profile.gender === 'male' ? 'Bro.' : profile.gender === 'female' ? 'Sis.' : '';
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return prefix ? `${prefix} ${name}` : name;
}

function getYouTubeThumbnailUrl(url?: string | null) {
  if (!url) return null;

  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }

  return null;
}

function normalizeArtworkUrl(url?: string | null) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, '/300x300bb.');
}

function getDashboardArtworkSong(song: DashboardSongArtwork) {
  if (!song.songs) return null;
  return Array.isArray(song.songs) ? song.songs[0] || null : song.songs;
}

function hydrateDashboardArtworkSongs(setlistSongs: DashboardSongArtwork[] | null | undefined, songsById: Map<string, DashboardArtworkSongRecord>) {
  return (setlistSongs || []).map((song) => {
    if (getDashboardArtworkSong(song) || !song.song_id) return song;
    const fallbackSong = songsById.get(song.song_id);
    return fallbackSong ? { ...song, songs: fallbackSong } : song;
  });
}

async function fetchPublicSongArtwork(song: DashboardSongArtwork) {
  const nestedSong = getDashboardArtworkSong(song);
  const title = nestedSong?.title?.trim();
  const artist = nestedSong?.artist?.trim();
  if (!title && !artist) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);

  try {
    const searchTerm = [title, artist].filter(Boolean).join(' ');
    const deezerParams = new URLSearchParams({ q: searchTerm, limit: '1' });
    const deezerResponse = await fetch(`https://api.deezer.com/search?${deezerParams.toString()}`, {
      signal: controller.signal,
    });
    if (deezerResponse.ok) {
      const deezerData = await deezerResponse.json() as {
        data?: Array<{ album?: { cover_big?: string; cover_medium?: string; cover_xl?: string } }>;
      };
      const deezerArtwork = deezerData.data?.[0]?.album?.cover_big || deezerData.data?.[0]?.album?.cover_medium || deezerData.data?.[0]?.album?.cover_xl;
      if (deezerArtwork) return deezerArtwork;
    }

    const iTunesParams = new URLSearchParams({
      term: searchTerm,
      entity: 'song',
      media: 'music',
      limit: '1',
    });
    const iTunesResponse = await fetch(`https://itunes.apple.com/search?${iTunesParams.toString()}`, {
      signal: controller.signal,
    });
    if (!iTunesResponse.ok) return null;
    const iTunesData = await iTunesResponse.json() as { results?: Array<{ artworkUrl100?: string; artworkUrl60?: string }> };
    return normalizeArtworkUrl(iTunesData.results?.[0]?.artworkUrl100 || iTunesData.results?.[0]?.artworkUrl60);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getSongArtworkUrls(setlistSongs?: DashboardSongArtwork[] | null) {
  if (!setlistSongs) return [];

  const seen = new Set<string>();
  const orderedSongs = setlistSongs
    .slice()
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, 4);

  const youtubeUrls = orderedSongs
    .map(song => getYouTubeThumbnailUrl(song.youtube_url || getDashboardArtworkSong(song)?.youtube_url))
    .filter((url): url is string => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  if (youtubeUrls.length >= 4) return youtubeUrls;

  const publicUrls = await Promise.all(orderedSongs.map(fetchPublicSongArtwork));
  publicUrls.forEach((url) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      youtubeUrls.push(url);
    }
  });

  return youtubeUrls.slice(0, 4);
}

export function Dashboard() {
  const { user, profile, isLeader, isProductionDirector } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [eventLeaderMap, setEventLeaderMap] = useState<Record<string, string>>({});
  const [eventArtworkMap, setEventArtworkMap] = useState<Record<string, string[]>>({});
  const [eventArtworkSongsMap, setEventArtworkSongsMap] = useState<Record<string, DashboardSongArtwork[]>>({});
  const [myAssignments, setMyAssignments] = useState<EventAssignment[]>([]);
  const [pendingSetlists, setPendingSetlists] = useState<PendingReviewSetlist[]>([]);
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
  const [activeHubFilter, setActiveHubFilter] = useState<DashboardHubFilter>('all');
  const pullRefreshDistanceRef = useRef(0);
  const refreshInFlightRef = useRef(false);

  const todayVerse = verses[new Date().getDay() % verses.length];

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
      .in('request_type', ['sub', 'swap'])
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
      const emptyList = { data: [] } as any;
      const [eventsRes, assignRes, setlistsRes, announcementsRes, unavailableRes, pendingLeaveRes, songLeadersRes, membersRes] = await Promise.all([
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
        withDashboardTimeout(
          supabase
            .from('setlists')
            .select('*, events(id, title, event_date, event_type), setlist_songs(id, song_id, position, youtube_url, songs(id, title, artist, youtube_url))')
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false }),
          emptyList,
          'Pending setlists',
        ),
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
              { count: 0 } as any,
              'Pending leave count',
            )
          : Promise.resolve({ count: 0 }),
        withDashboardTimeout(
          supabase.from('event_assignments').select('event_id, profiles(first_name, last_name, gender), roles!inner(name)').eq('roles.name', 'Song Leader'),
          emptyList,
          'Dashboard song leaders',
        ),
        withDashboardTimeout(
          supabase.from('profiles').select('id, first_name, last_name, gender'),
          emptyList,
          'Dashboard member names',
        ),
      ]);

      const events = ((eventsRes.data || []) as Event[]).slice().sort(compareEventsByDateTime);
      setUpcomingEvents(events);

      const artworkEventIds = Array.from(new Set(
        events
          .flatMap(event => [event.id, event.linked_event_id])
          .filter((id): id is string => Boolean(id))
      ));
      const eventSetlistsRes = artworkEventIds.length > 0
        ? await withDashboardTimeout(
            supabase
              .from('setlists')
              .select('event_id, setlist_songs(id, song_id, position, youtube_url, songs(id, title, artist, youtube_url))')
              .in('event_id', artworkEventIds),
            emptyList,
            'Dashboard event song artwork',
          )
        : emptyList;

      const eventSetlistRows = (eventSetlistsRes.data || []) as DashboardSetlistArtwork[];
      const artworkSongIds = Array.from(new Set(
        eventSetlistRows.flatMap((setlist) =>
          (setlist.setlist_songs || [])
            .map((song) => song.song_id)
            .filter((id): id is string => Boolean(id))
        )
      ));
      const artworkSongsById = new Map<string, DashboardArtworkSongRecord>();
      if (artworkSongIds.length > 0) {
        const artworkSongsRes = await withDashboardTimeout(
          supabase.from('songs').select('id, title, artist, youtube_url').in('id', artworkSongIds),
          emptyList,
          'Dashboard artwork song fallback',
        );
        ((artworkSongsRes.data || []) as DashboardArtworkSongRecord[]).forEach((song) => {
          if (song.id) artworkSongsById.set(song.id, song);
        });
      }

      const artworkByEventId: Record<string, string[]> = {};
      const artworkSongsByEventId: Record<string, DashboardSongArtwork[]> = {};
      await Promise.all(eventSetlistRows.map(async (setlist) => {
        if (!setlist.event_id) return;
        const hydratedSongs = hydrateDashboardArtworkSongs(setlist.setlist_songs, artworkSongsById);
        const orderedSongs = hydratedSongs
          .slice()
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          .slice(0, 4);
        const urls = await getSongArtworkUrls(hydratedSongs);
        if (urls.length > 0 && (!artworkByEventId[setlist.event_id] || artworkByEventId[setlist.event_id].length < urls.length)) {
          artworkByEventId[setlist.event_id] = urls;
        }
        if (orderedSongs.length > 0 && (!artworkSongsByEventId[setlist.event_id] || artworkSongsByEventId[setlist.event_id].length < orderedSongs.length)) {
          artworkSongsByEventId[setlist.event_id] = orderedSongs;
        }
      }));
      events.forEach(event => {
        if (
          event.linked_event_id &&
          artworkByEventId[event.linked_event_id] &&
          (!artworkByEventId[event.id] || artworkByEventId[event.id].length < artworkByEventId[event.linked_event_id].length)
        ) {
          artworkByEventId[event.id] = artworkByEventId[event.linked_event_id];
        }
        if (
          event.linked_event_id &&
          artworkSongsByEventId[event.linked_event_id] &&
          (!artworkSongsByEventId[event.id] || artworkSongsByEventId[event.id].length < artworkSongsByEventId[event.linked_event_id].length)
        ) {
          artworkSongsByEventId[event.id] = artworkSongsByEventId[event.linked_event_id];
        }
      });
      setEventArtworkMap(artworkByEventId);
      setEventArtworkSongsMap(artworkSongsByEventId);

      const leaderMap: Record<string, string> = {};
      (songLeadersRes.data || []).forEach((assignment: any) => {
        const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles;
        const name = profile ? formatDashboardLeaderName(profile) : '';
        if (name) leaderMap[assignment.event_id] = name;
      });

      const memberNameById = new Map(
        ((membersRes.data || []) as DashboardMemberSummary[])
          .map(member => [member.id, formatDashboardLeaderName(member)])
          .filter((entry): entry is [string, string] => Boolean(entry[1]))
      );
      events.forEach(event => {
        if (!leaderMap[event.id] && event.song_leader_id) {
          const directLeaderName = memberNameById.get(event.song_leader_id);
          if (directLeaderName) leaderMap[event.id] = directLeaderName;
        }
      });
      events.forEach(event => {
        if (!leaderMap[event.id] && event.linked_event_id && leaderMap[event.linked_event_id]) {
          leaderMap[event.id] = leaderMap[event.linked_event_id];
        }
      });
      setEventLeaderMap(leaderMap);

      const assignments = (assignRes.data || []) as EventAssignment[];
      const nowForAssignments = new Date();
      const upcomingAssignments = assignments.filter(a => a.events && getManilaEventDateTime(a.events.event_date, a.events.start_time) >= nowForAssignments);
      upcomingAssignments.sort(compareAssignmentsByEventDateTime);
      setMyAssignments(upcomingAssignments);
      setPendingSetlists((setlistsRes.data || []) as PendingReviewSetlist[]);
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
      const { error: updateError } = await supabase.from('user_availability').update({
        status: accepted ? 'pending' : 'rejected',
        target_response_at: new Date().toISOString(),
      }).eq('id', req.id);
      if (updateError) throw updateError;

      const targetName = profile?.nickname || `${profile?.first_name} ${profile?.last_name}`.trim();
      const isSub = req.request_type === 'sub';
      const typeLabel = isSub ? 'sub' : 'swap';

      if (accepted) {
        // 1. Notify requester that target accepted
        const requesterNotif = supabase.from('notifications').insert({
          user_id: req.user_id,
          type: isSub ? 'sub_approved' : 'swap_approved',
          title: `${targetName} accepted your ${typeLabel} request`,
          body: `Your ${typeLabel} request is now pending leadership approval.`,
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
            type: isSub ? 'sub_request' : 'swap_request',
            title: isSub ? 'New sub request for review' : 'New swap request for review',
            body: `${targetName} agreed to ${typeLabel} with ${req.requester?.nickname || req.requester?.first_name}. Needs your approval.`,
            data: { url: '/leadership/swaps', swap_request_id: req.id }
          }));

        const ops = [requesterNotif];
        if (leaderNotifs.length > 0) {
          ops.push(supabase.from('notifications').insert(leaderNotifs));
        }

        const notificationResults = await Promise.all(ops);
        notificationResults.forEach(result => {
          if (result.error) {
            console.warn('[Dashboard] Swap/sub notification failed:', result.error);
          }
        });
      } else {
        // Notify requester that target declined
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: req.user_id,
          type: isSub ? 'sub_declined' : 'swap_declined',
          title: `${targetName} declined your ${typeLabel} request`,
          body: `Your schedule ${typeLabel} request was declined.`,
          data: { swap_request_id: req.id, url: '/my-assignments' },
        });
        if (notificationError) {
          console.warn('[Dashboard] Swap/sub decline notification failed:', notificationError);
        }
      }

      setIncomingSwapRequests(prev => prev.filter(r => r.id !== req.id));
      toast('success', accepted ? `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} request accepted` : `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} request declined`);
    } catch (error) {
      console.error('[Dashboard] Failed to respond to swap/sub request:', error);
      toast('error', 'Could not update this request. Please try again.');
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

  const fallbackEvents: DashboardEventCard[] = [
    { title: 'Sunday Morning Service', event_date: '2025-06-22', start_time: '09:00:00', event_type: 'Sunday Service', location: 'Main Auditorium', id: 'sample-1' },
    { title: 'Youth Night', event_date: '2025-06-20', start_time: '19:00:00', event_type: 'Friday Service', location: 'Main Auditorium', id: 'sample-2' },
    { title: 'Sunday Evening Service', event_date: '2025-06-22', start_time: '18:00:00', event_type: 'Sunday Service', location: 'Main Auditorium', id: 'sample-3' },
  ];
  const displayEvents: DashboardEventCard[] = (upcomingEvents.length > 0 ? upcomingEvents : fallbackEvents)
    .slice(0, 3)
    .map(event => ({ ...event, location: (event as { location?: string }).location }));
  const assignedEventIds = new Set(myAssignments.map(assignment => assignment.event_id));
  const reviewSets = pendingSetlists.slice(0, 4);
  const announcementRows = (recentAnnouncements.length > 0 ? recentAnnouncements : [
    { id: 'sample-ann-1', title: 'Leadership Meeting this Saturday', content: 'We will be discussing service flow, volunteer updates, and upcoming events.', created_at: new Date().toISOString() },
    { id: 'sample-ann-2', title: 'New Training: In-Ear Monitor Basics', content: 'Join us this Sunday after the morning service at the Media Room.', created_at: new Date().toISOString() },
    { id: 'sample-ann-3', title: 'Song Requests Open', content: "Submit your song requests for next month's setlists.", created_at: new Date().toISOString() },
  ] as any[]).slice(0, 3);
  const newThisWeek = [
    { title: 'Graves Into Gardens', artist: 'Spontaneous', tone: 'from-zinc-300 via-zinc-700 to-black', badge: 'New Song' },
    { title: 'Holy Forever', artist: 'Elevation Worship', tone: 'from-yellow-200 via-amber-700 to-black', badge: 'New EP' },
    { title: 'Great Are You Lord', artist: 'All Sons & Daughters', tone: 'from-orange-200 via-stone-700 to-black', badge: 'New Song' },
  ];
  const quickActions = [
    { label: 'Create Set', icon: ListChecks, path: '/sets' },
    { label: 'Schedule Event', icon: Calendar, path: '/events' },
    { label: 'Add Song', icon: Music, path: '/songs' },
    { label: 'Upload Video', icon: Upload, path: '/videos' },
    { label: 'New Announcement', icon: Megaphone, path: '/announcements/new' },
    { label: 'Invite People', icon: UserPlus, path: '/leadership/team' },
  ];
  const assignmentRows = myAssignments.slice(0, 3);
  const teamAvailabilityRows = unavailableMembers.slice(0, 3);
  const hubFilters: { id: DashboardHubFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'week', label: 'This Week' },
    { id: 'serving', label: 'Serving' },
    { id: 'team', label: 'Team' },
  ];
  const quickTileGroups: Record<DashboardHubFilter, {
    title: string;
    subtitle: string;
    tone: string;
    path: string;
    icon?: typeof Heart;
  }[]> = {
    all: [
      { title: 'My Assignments', subtitle: `${stats.total} upcoming`, tone: 'from-emerald-400 via-green-700 to-black', path: '/my-assignments', icon: Check },
      { title: 'Upcoming Services', subtitle: `${displayEvents.length} services`, tone: 'from-blue-500 via-blue-900 to-slate-950', path: '/events', icon: Calendar },
      { title: 'Team Chat', subtitle: 'Messages', tone: 'from-zinc-200 via-zinc-700 to-black', path: '/messages', icon: MessageCircle },
      { title: 'My Sets', subtitle: 'Setlists', tone: 'from-indigo-400 via-violet-500 to-emerald-300', path: '/sets', icon: ListChecks },
      { title: 'Request Leave', subtitle: 'Availability', tone: 'from-yellow-400 via-amber-800 to-black', path: '/request-leave', icon: UserX },
      { title: 'Announcements', subtitle: `${announcementRows.length} latest`, tone: 'from-sky-400 via-violet-700 to-black', path: '/announcements', icon: Megaphone },
    ],
    week: [
      { title: 'This Week', subtitle: 'Calendar', tone: 'from-blue-500 via-blue-900 to-slate-950', path: '/events', icon: Calendar },
      { title: 'My Assignments', subtitle: `${stats.total} scheduled`, tone: 'from-emerald-400 via-green-700 to-black', path: '/my-assignments', icon: Check },
      { title: 'Service Updates', subtitle: 'Announcements', tone: 'from-sky-400 via-violet-700 to-black', path: '/announcements', icon: Megaphone },
      { title: 'Team Availability', subtitle: `${teamAvailabilityRows.length} upcoming`, tone: 'from-yellow-400 via-amber-800 to-black', path: '/request-leave', icon: UserX },
      { title: 'Songs to Learn', subtitle: 'Library', tone: 'from-orange-200 via-stone-700 to-black', path: '/songs', icon: Music },
      { title: 'Service Recordings', subtitle: 'Videos', tone: 'from-zinc-300 via-zinc-700 to-black', path: '/videos', icon: Upload },
    ],
    serving: [
      { title: 'Confirm Status', subtitle: `${stats.confirmed}/${stats.total} confirmed`, tone: 'from-emerald-400 via-green-700 to-black', path: '/my-assignments', icon: Check },
      { title: 'My Service Sets', subtitle: 'Ready songs', tone: 'from-indigo-400 via-violet-500 to-emerald-300', path: '/sets', icon: ListChecks },
      { title: 'Find a Sub', subtitle: 'Swap or cover', tone: 'from-cyan-400 via-blue-800 to-black', path: '/my-assignments', icon: ArrowLeftRight },
      { title: 'Team Chat', subtitle: 'Coordinate', tone: 'from-zinc-200 via-zinc-700 to-black', path: '/messages', icon: MessageCircle },
      { title: 'Request Leave', subtitle: 'Update availability', tone: 'from-yellow-400 via-amber-800 to-black', path: '/request-leave', icon: UserX },
      { title: 'Service Videos', subtitle: 'Review media', tone: 'from-sky-400 via-violet-700 to-black', path: '/videos', icon: Upload },
    ],
    team: [
      { title: 'Team Chat', subtitle: 'Messages', tone: 'from-zinc-200 via-zinc-700 to-black', path: '/messages', icon: MessageCircle },
      { title: 'Announcements', subtitle: 'Updates', tone: 'from-sky-400 via-violet-700 to-black', path: '/announcements', icon: Megaphone },
      { title: 'Team Availability', subtitle: `${teamAvailabilityRows.length} away soon`, tone: 'from-yellow-400 via-amber-800 to-black', path: '/request-leave', icon: UserX },
      { title: 'People', subtitle: isLeader || isProductionDirector ? 'Team roster' : 'Profile', tone: 'from-emerald-400 via-green-700 to-black', path: isLeader || isProductionDirector ? '/leadership/team' : '/profile', icon: UserPlus },
      { title: 'Songs', subtitle: 'Shared library', tone: 'from-orange-200 via-stone-700 to-black', path: '/songs', icon: Music },
      { title: 'Setlists', subtitle: 'Shared plans', tone: 'from-indigo-400 via-violet-500 to-emerald-300', path: '/sets', icon: ListChecks },
    ],
  };
  const quickTiles = quickTileGroups[activeHubFilter];

  return (
    <div className="dark page-container page-bottom-pad relative overflow-hidden bg-[#050505] text-white">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#050505] [background-image:radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_18%),linear-gradient(180deg,#121212_0%,#050505_24%,#050505_100%)]"
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
        className="relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-24 px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-6"
      >

        <motion.section variants={item} className="space-y-4">
            <div className="hidden items-center justify-between lg:flex">
              <h1 className="text-[2.4rem] font-black leading-none text-white" style={{ letterSpacing: '-0.055em' }}>
                {greeting}, {displayName}
              </h1>
              <button className="flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
                Customize <Edit3 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar lg:mt-5">
            {hubFilters.map((chip) => {
              const active = activeHubFilter === chip.id;
              return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveHubFilter(chip.id)}
                aria-pressed={active}
                className={`h-9 shrink-0 rounded-full px-4 text-[12px] font-black transition-colors ${
                  active
                    ? 'bg-[#22c55e] text-black'
                    : 'bg-[#2a2a2a] text-white hover:bg-[#353535]'
                }`}
              >
                {chip.label}
              </button>
            );
            })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
            {quickTiles.map(tile => (
              <button
                key={tile.title}
                onClick={() => navigate(tile.path)}
                className="group flex h-[68px] min-w-0 items-center overflow-hidden rounded-[0.5rem] border border-white/[0.08] bg-[#2a2a2a] text-left shadow-[0_18px_46px_-34px_rgba(0,0,0,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#343434] lg:h-[88px]"
              >
                <div className={`relative flex h-full w-[68px] shrink-0 items-center justify-center bg-gradient-to-br ${tile.tone} lg:w-[86px]`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.24),transparent_28%)]" />
                  {'icon' in tile && tile.icon ? (
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-black/50 text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.95),0_0_0_3px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.26)] ring-1 ring-black/40 backdrop-blur-sm">
                      <tile.icon className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 px-3">
                  <p className="line-clamp-2 text-[13px] font-black leading-tight text-white">{tile.title}</p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-white/45">{tile.subtitle}</p>
                </div>
              </button>
            ))}
            </div>
        </motion.section>

        <motion.section variants={item} className="grid gap-5 xl:grid-cols-[1.95fr_1fr]">
              <section className="self-start lg:flex lg:flex-col lg:rounded-[0.75rem] lg:border lg:border-white/[0.08] lg:bg-[#181818] lg:p-4 lg:shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[18px] font-black text-white">Upcoming services</h2>
                  <button onClick={() => navigate('/events')} className="text-[12px] font-bold text-[#22c55e]">See all</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar lg:hidden">
                  {displayEvents.map((event) => {
                    const eventTitle = eventLeaderMap[event.id] || event.title;
                    const artworkUrls = eventArtworkMap[event.id] || [];
                    const artworkSongs = eventArtworkSongsMap[event.id] || [];
                    return (
                      <button
                        key={event.id}
                        onClick={() => navigate(event.id.startsWith('sample') ? '/events' : `/events/${event.id}`)}
                        className="min-w-[132px] max-w-[132px] text-left"
                      >
                        <div className="relative">
                          <EventArtwork
                            eventType={event.event_type}
                            title={event.title}
                            artworkUrls={artworkUrls}
                            songs={artworkSongs}
                            className="aspect-square w-full rounded-[0.45rem]"
                          />
                          <span className="absolute left-2 top-2 rounded bg-white px-1.5 py-0.5 text-[7px] font-black uppercase text-black">
                            {format(parseISO(event.event_date), 'MMM dd')}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[12px] font-bold leading-tight text-white">{eventTitle}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-white/50">
                          {event.event_type} · {event.start_time ? formatTime12Hour(event.start_time) : 'TBA'}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="hidden space-y-2 lg:block">
                  {displayEvents.map((event) => {
                    const isAssignedToEvent = assignedEventIds.has(event.id);
                    const eventTitle = eventLeaderMap[event.id] || event.title;
                    const artworkUrls = eventArtworkMap[event.id] || [];
                    const artworkSongs = eventArtworkSongsMap[event.id] || [];
                    return (
                    <button
                      key={event.id}
                      onClick={() => navigate(event.id.startsWith('sample') ? '/events' : `/events/${event.id}`)}
                      className="group flex w-full items-center gap-3 rounded-[0.55rem] bg-[#242424] p-2.5 text-left transition-colors hover:bg-[#2d2d2d]"
                    >
                      <EventArtwork
                        eventType={event.event_type}
                        title={event.title}
                        artworkUrls={artworkUrls}
                        songs={artworkSongs}
                        className="h-16 w-16 rounded-[0.35rem]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-white">{eventTitle}</p>
                        <p className="mt-1 truncate text-[12px] font-semibold text-white/58">{event.event_type} · {event.start_time ? formatTime12Hour(event.start_time) : 'TBA'}</p>
                      </div>
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-[11px] font-black uppercase leading-none text-[#22c55e]">{format(parseISO(event.event_date), 'EEE')}</p>
                        <p className="mt-1 text-[18px] font-black leading-none text-white">{format(parseISO(event.event_date), 'MMM')}</p>
                        <p className="text-[22px] font-black leading-none text-white">{format(parseISO(event.event_date), 'dd')}</p>
                      </div>
                      <span className={`hidden shrink-0 rounded-full border px-4 py-2 text-[12px] font-bold sm:inline-flex ${isAssignedToEvent ? 'border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]' : 'border-white/[0.08] text-white/62'}`}>
                        {isAssignedToEvent ? 'Serving' : 'Not assigned'}
                      </span>
                      <MoreHorizontal className="hidden h-5 w-5 text-white/70 lg:block" />
                    </button>
                  );
                })}
                </div>
              </section>

              <section className={`${reviewSets.length === 0 ? 'hidden lg:block' : ''} rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-3 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)] sm:p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[17px] font-black text-white">Setlists awaiting approval</h2>
                  <button onClick={() => navigate(isLeader ? '/leadership/setlists' : '/events')} className="text-[12px] font-bold text-[#22c55e]">
                    {isLeader ? 'Review queue' : 'See events'}
                  </button>
                </div>
                <div className={reviewSets.length > 0 ? 'space-y-1' : 'flex min-h-[270px] flex-1 items-center justify-center rounded-[0.6rem] border border-dashed border-white/[0.14] bg-white/[0.035] px-5 py-8'}>
                  {reviewSets.length > 0 ? (
                    reviewSets.map((set, index) => {
                      const eventId = set.events?.id || set.event_id;
                      const songCount = set.setlist_songs?.length ?? 0;
                      const artworkUrls = eventId ? eventArtworkMap[eventId] || [] : [];
                      const artworkSongs = eventId ? eventArtworkSongsMap[eventId] || [] : [];
                      return (
                        <button
                          key={set.id}
                          onClick={() => navigate(eventId ? `/events/${eventId}` : isLeader ? '/leadership/setlists' : '/events')}
                          className="group flex w-full items-center gap-3 rounded-[0.55rem] px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
                        >
                          <EventArtwork
                            eventType={set.events?.event_type}
                            title={set.events?.title}
                            artworkUrls={artworkUrls}
                            songs={artworkSongs.length > 0 ? artworkSongs : set.setlist_songs}
                            className="h-12 w-12 rounded-[0.35rem]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-black text-white">{set.events?.title || 'Submitted setlist'}</p>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-white/45">
                              {set.events?.event_date ? format(parseISO(set.events.event_date), 'MMM d, yyyy') : 'Ready for review'}
                              {!isLeader ? ' · Awaiting leadership' : ''}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-black text-white/80">
                            {songCount} {songCount === 1 ? 'song' : 'songs'}
                          </span>
                          <ChevronRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      );
                    })
                  ) : (
                    <div className="flex max-w-[280px] flex-col items-center justify-center text-center">
                      <ListChecks className="mx-auto h-8 w-8 text-[#22c55e]" />
                      <p className="mt-4 text-[14px] font-black text-white">No setlists awaiting approval</p>
                      <p className="mx-auto mt-2 max-w-[250px] text-[11px] font-semibold leading-relaxed text-white/45">
                        Submitted setlists will appear here for the whole team. Leaders can approve them from the event review controls.
                      </p>
                    </div>
                  )}
                </div>
              </section>
        </motion.section>

        <motion.section variants={item} className="hidden grid-cols-4 gap-5 lg:grid">
          <section className="rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-[15px] font-black text-white">My assignments</h2>
              </div>
              <button onClick={() => navigate('/my-assignments')} className="text-[11px] font-bold text-[#22c55e]">All</button>
            </div>
            {assignmentRows.length > 0 ? (
              <div className="space-y-2">
                {assignmentRows.map((assignment) => (
                  <button
                    key={assignment.id}
                    onClick={() => navigate(`/events/${assignment.event_id}`)}
                    className="flex w-full items-center gap-3 rounded-[0.55rem] bg-white/[0.045] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.075]"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${assignment.status === 'confirmed' ? 'bg-[#22c55e]' : assignment.status === 'declined' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-black text-white">{assignment.events?.title || 'Upcoming service'}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/45">
                        {assignment.roles?.name || 'Team'}{assignment.events?.start_time ? ` · ${formatTime12Hour(assignment.events.start_time)}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-[0.55rem] bg-white/[0.045] px-3 py-5 text-[12px] font-semibold text-white/45">No current assignments.</p>
            )}
          </section>

          <section className="rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-[15px] font-black text-white">Team availability</h2>
              </div>
              <button onClick={() => navigate('/request-leave')} className="text-[11px] font-bold text-[#22c55e]">Open</button>
            </div>
            {teamAvailabilityRows.length > 0 ? (
              <div className="space-y-2">
                {teamAvailabilityRows.map((member) => {
                  const memberName = member.profiles?.nickname || `${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim() || 'Team member';
                  const dateLabel = member.unavailable_date || member.start_date;
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedUnavailability(member)}
                      className="flex w-full items-center gap-3 rounded-[0.55rem] bg-white/[0.045] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.075]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-black text-amber-200">
                        {memberName.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-black text-white">{memberName}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/45">{dateLabel ? format(parseISO(dateLabel), 'MMM d') : 'Upcoming'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-[0.55rem] bg-white/[0.045] px-3 py-5 text-[12px] font-semibold text-white/45">Everyone is currently available.</p>
            )}
          </section>

          <section className="rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#22c55e]" />
              <h2 className="text-[15px] font-black text-white">Leadership queue</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Setlists', value: pendingSetlists.length, path: '/leadership/setlists' },
                { label: 'Leave', value: pendingLeaveCount, path: '/leadership/leave' },
                { label: 'Swaps', value: incomingSwapRequests.length, path: '/leadership/swaps' },
                { label: 'Pending', value: stats.pending, path: '/my-assignments?status=pending' },
              ].map(queue => (
                <button key={queue.label} onClick={() => navigate(queue.path)} className="rounded-[0.55rem] bg-white/[0.045] px-3 py-3 text-left transition-colors hover:bg-white/[0.075]">
                  <span className="block text-[22px] font-black leading-none text-white">{queue.value}</span>
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em] text-white/40">{queue.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#22c55e]" />
              <h2 className="text-[15px] font-black text-white">Daily verse</h2>
            </div>
            <div className="flex min-h-[104px] flex-col justify-center rounded-[0.55rem] bg-white/[0.045] px-3 py-3">
              <p className="line-clamp-4 text-[13px] font-bold leading-relaxed text-white/88">"{todayVerse.text}"</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#22c55e]">{todayVerse.ref}</p>
            </div>
          </section>
        </motion.section>

        <motion.section variants={item} className="lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[22px] font-black text-white">New this week</h2>
            <button onClick={() => navigate('/songs')} className="text-[12px] font-bold text-[#22c55e]">See all</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {newThisWeek.map((song) => (
              <button key={song.title} onClick={() => navigate('/songs')} className="min-w-[132px] text-left">
                <div className={`relative aspect-square overflow-hidden rounded-[0.45rem] bg-gradient-to-br ${song.tone}`}>
                  <span className="absolute left-2 top-2 rounded bg-white px-1.5 py-0.5 text-[7px] font-black uppercase text-black">{song.badge}</span>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.32),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.42))]" />
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] font-bold leading-tight text-white">{song.title}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-white/50">{song.artist}</p>
              </button>
            ))}
          </div>
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

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.8fr)]">
          <motion.section variants={item} className="min-w-0 overflow-hidden lg:rounded-[1rem] lg:border lg:border-white/[0.08] lg:bg-[#181818] lg:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[22px] font-black text-white lg:text-[18px]">Recent announcements</h2>
              <button onClick={() => navigate('/announcements')} className="text-[12px] font-bold text-[#22c55e]">See all</button>
            </div>
            <div className="divide-y divide-white/[0.07]">
              {announcementRows.map((a, index) => (
                <button
                  key={a.id}
                  onClick={() => navigate(a.id?.startsWith?.('sample') ? '/announcements' : `/announcements/${a.id}`)}
                  className="group flex w-full min-w-0 items-center gap-3 py-3 text-left"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.55rem] ${index === 0 ? 'bg-emerald-500/18 text-[#22c55e]' : index === 1 ? 'bg-violet-500/18 text-violet-300' : 'bg-sky-500/18 text-sky-300'}`}>
                    {index === 0 ? <Megaphone className="h-6 w-6" /> : index === 1 ? <Calendar className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-[13px] font-black text-white">{a.title}</span>
                    <span className="mt-1 block max-w-full truncate text-[12px] font-semibold text-white/55">{a.content}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-white/46">{index === 0 ? '2h ago' : index === 1 ? '6h ago' : '1d ago'}</span>
                  <MoreHorizontal className="h-5 w-5 shrink-0 text-white/58" />
                </button>
              ))}
            </div>
          </motion.section>

          <motion.section variants={item} className="hidden min-w-0 rounded-[1rem] border border-white/[0.08] bg-[#181818] p-4 lg:block">
            <h2 className="mb-4 text-[18px] font-black text-white">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="flex h-20 flex-col items-center justify-center gap-2 rounded-[0.55rem] border border-white/[0.06] bg-[#242424] text-center transition-colors hover:bg-[#303030]"
                  >
                    <Icon className="h-6 w-6 text-[#22c55e]" />
                    <span className="text-[12px] font-black text-white">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>
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
