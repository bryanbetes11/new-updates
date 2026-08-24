import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, differenceInDays, eachDayOfInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion } from 'framer-motion';
import { Calendar, Plus, Search, Users, Trash2, CalendarOff, AlertCircle, Clock, X, PartyPopper, Heart, Sparkles, List, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { EventsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatTime12Hour } from '../lib/timeFormat';
import { withRequestTimeout } from '../lib/requestTimeout';
import { describeSetlistReviewAge, getSetlistPendingMessage } from '../lib/setlistReviewAge';
import { EventArtwork } from '../components/EventArtwork';
import { EventLifecycleActionModal, type EventActionAnchorRect, type EventLifecycleDialogMode } from '../components/EventLifecycleActionModal';
import { CalendarGrid } from '../components/CalendarGrid';
import type { Event } from '../types';
import { hasArtworkArtist } from '../lib/songArtworkEligibility';
import { hasEventScheduleEnded, isEventCompleted } from '../lib/eventLifecycle';
import { loadSyncedPreference, saveSyncedPreference } from '../lib/syncedPreferences';
import { calculatePolicyProposalDueDate, DEFAULT_EVENT_TEMPLATE_POLICIES, eventTemplateFor, normalizeEventTemplatePolicies, type EventTemplatePolicies } from '../lib/eventPolicy';

interface AssignmentRow { user_id: string; role_id: string; }
interface CalendarEntry { type: 'birthday' | 'leave'; date: string; name: string; status?: string; }
interface EventSongArtwork {
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
}
interface ArtworkSongRecord {
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  youtube_url?: string | null;
}
interface SetlistInfo {
  status: string;
  created_at: string;
  submitted_at: string | null;
  artworkUrls?: string[];
  artworkSongs?: EventSongArtwork[];
  songCount?: number;
}
interface RelatedProfile {
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
}
interface EventMemberSummary { id: string; first_name: string; last_name: string; gender?: string | null; }
interface LinkedAssignmentRow {
  user_id: string;
  role_id: string;
  roles?: {
    name?: string;
    is_leadership?: boolean;
  } | null;
}
interface EventFormState {
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  event_type: string;
  description: string;
  song_leader_id: string;
  linked_event_id: string;
}

function emptyListResponse() {
  return { data: [], error: null, count: null, status: 200, statusText: 'OK' };
}

function getRelatedProfile(profile: RelatedProfile | RelatedProfile[] | null | undefined) {
  return Array.isArray(profile) ? profile[0] : profile;
}

const EVENT_TYPE_COLORS: Record<string, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  'Sunday Service':   { lightBg: 'rgba(37,99,235,0.10)',  lightText: '#1d4ed8', darkBg: 'rgba(37,99,235,0.18)',  darkText: '#93c5fd' },
  'Prayer Meeting':   { lightBg: 'rgba(124,58,237,0.10)', lightText: '#7c3aed', darkBg: 'rgba(124,58,237,0.18)', darkText: '#c4b5fd' },
  'LGTF (Midweek)':  { lightBg: 'rgba(20,184,166,0.10)', lightText: '#0f766e', darkBg: 'rgba(20,184,166,0.18)', darkText: '#5eead4' },
  'Rehearsals':       { lightBg: 'rgba(217,119,6,0.10)',  lightText: '#b45309', darkBg: 'rgba(217,119,6,0.18)',  darkText: '#fcd34d' },
  'Online Devotion':  { lightBg: 'rgba(219,39,119,0.10)', lightText: '#be185d', darkBg: 'rgba(219,39,119,0.18)', darkText: '#f9a8d4' },
  'Equipping':        { lightBg: 'rgba(22,163,74,0.10)',  lightText: '#15803d', darkBg: 'rgba(22,163,74,0.18)',  darkText: '#86efac' },
  'Revamp Session':   { lightBg: 'rgba(234,88,12,0.10)',  lightText: '#c2410c', darkBg: 'rgba(234,88,12,0.18)',  darkText: '#fdba74' },
  'Youth Recharge':   { lightBg: 'rgba(225,29,72,0.10)',  lightText: '#be123c', darkBg: 'rgba(225,29,72,0.18)',  darkText: '#fda4af' },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const publicArtworkCache = new Map<string, string | null>();

function getYouTubeThumbnailUrl(url?: string | null) {
  if (!url) return null;

  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `https://i.ytimg.com/vi/${match[1]}/hq720.jpg`;
  }

  return null;
}

function normalizeArtworkUrl(url?: string | null) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, '/300x300bb.');
}

function getEventArtworkSong(song: EventSongArtwork) {
  if (!song.songs) return null;
  return Array.isArray(song.songs) ? song.songs[0] || null : song.songs;
}

function hydrateEventArtworkSongs(setlistSongs: EventSongArtwork[] | null | undefined, songsById: Map<string, ArtworkSongRecord>) {
  return (setlistSongs || []).map((song) => {
    if (getEventArtworkSong(song) || !song.song_id) return song;
    const fallbackSong = songsById.get(song.song_id);
    return fallbackSong ? { ...song, songs: fallbackSong } : song;
  });
}

async function fetchPublicSongArtwork(song: EventSongArtwork) {
  const nestedSong = getEventArtworkSong(song);
  if (!hasArtworkArtist(nestedSong?.artist)) return null;
  const searchTerm = [nestedSong?.title?.trim(), nestedSong?.artist?.trim()].filter(Boolean).join(' ');
  if (!searchTerm) return null;

  const cacheKey = searchTerm.toLowerCase();
  if (publicArtworkCache.has(cacheKey)) return publicArtworkCache.get(cacheKey) || null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);

  try {
    const deezerParams = new URLSearchParams({ q: searchTerm, limit: '1' });
    const deezerResponse = await fetch(`https://api.deezer.com/search?${deezerParams.toString()}`, {
      signal: controller.signal,
    });
    if (deezerResponse.ok) {
      const deezerData = await deezerResponse.json() as {
        data?: Array<{ album?: { cover_big?: string; cover_medium?: string; cover_xl?: string } }>;
      };
      const deezerArtwork = deezerData.data?.[0]?.album?.cover_big || deezerData.data?.[0]?.album?.cover_medium || deezerData.data?.[0]?.album?.cover_xl;
      if (deezerArtwork) {
        publicArtworkCache.set(cacheKey, deezerArtwork);
        return deezerArtwork;
      }
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
    if (!iTunesResponse.ok) {
      publicArtworkCache.set(cacheKey, null);
      return null;
    }
    const iTunesData = await iTunesResponse.json() as { results?: Array<{ artworkUrl100?: string; artworkUrl60?: string }> };
    const artworkUrl = normalizeArtworkUrl(iTunesData.results?.[0]?.artworkUrl100 || iTunesData.results?.[0]?.artworkUrl60);
    publicArtworkCache.set(cacheKey, artworkUrl);
    return artworkUrl;
  } catch {
    publicArtworkCache.set(cacheKey, null);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getEventSongArtworkUrls(setlistSongs?: EventSongArtwork[] | null) {
  if (!setlistSongs?.length) return [];

  const seen = new Set<string>();
  const orderedSongs = setlistSongs
    .slice()
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .filter(song => hasArtworkArtist(getEventArtworkSong(song)?.artist))
    .slice(0, 4);

  const artworkUrls = orderedSongs
    .map(song => getYouTubeThumbnailUrl(song.youtube_url || getEventArtworkSong(song)?.youtube_url))
    .filter((url): url is string => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  if (artworkUrls.length >= 4) return artworkUrls;

  const publicUrls = await Promise.all(orderedSongs.map(fetchPublicSongArtwork));
  publicUrls.forEach((url) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      artworkUrls.push(url);
    }
  });

  return artworkUrls.slice(0, 4);
}

function EventTypeLabel({ type }: { type: string }) {
  const colors = EVENT_TYPE_COLORS[type];
  if (!colors) return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-white/45">
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
    </span>
  );
  return (
    <>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold dark:hidden" style={{ color: colors.lightText }}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 text-[10px] font-bold dark:inline-flex" style={{ color: colors.darkText }}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
      </span>
    </>
  );
}

function EventDateChip({
  date,
  dim = false,
  tone = 'default',
  compact = false,
}: {
  date: string;
  dim?: boolean;
  tone?: 'default' | 'warning' | 'danger';
  compact?: boolean;
}) {
  const parsed = parseISO(date);

  const surfaceClasses = dim
    ? 'border-black/[0.06] bg-gray-100 dark:border-white/[0.06] dark:bg-[#202020]'
    : 'border-black/[0.08] bg-white dark:border-white/[0.08] dark:bg-[#222222]';

  const monthClasses = dim
    ? 'text-gray-400 dark:text-white/28'
    : tone === 'danger'
    ? 'text-red-500 dark:text-red-300'
    : tone === 'warning'
    ? 'text-amber-600 dark:text-amber-300'
    : 'text-[#1DB954]';

  if (compact) {
    return (
      <div className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center">
        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${monthClasses}`}>
          {format(parsed, 'EEE')}
        </span>
        <span className={`mt-0.5 text-[18px] font-black leading-none ${dim ? 'text-white/58' : 'text-white'}`}>
          {format(parsed, 'MMM')}
        </span>
        <span className={`text-[24px] font-black leading-none ${dim ? 'text-white/58' : 'text-white'}`}>
          {format(parsed, 'dd')}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[0.35rem] border ${surfaceClasses}`}
    >
      <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${monthClasses}`}>
        {format(parsed, 'MMM')}
      </span>
      <span className={`mt-0.5 text-[24px] font-black leading-none ${dim ? 'text-gray-500 dark:text-white/58' : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.05em' }}>
        {format(parsed, 'dd')}
      </span>
      <span className={`mt-0.5 text-[8px] font-bold leading-none ${dim ? 'text-gray-400 dark:text-white/24' : 'text-gray-500 dark:text-white/42'}`}>
        {format(parsed, 'EEE')}
      </span>
    </div>
  );
}

function EmptyEventArtwork({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <div className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-[0.35rem] border border-white/[0.08] bg-[#222222] ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_34%)]" />
      <Calendar className="relative h-5 w-5 text-white/38" />
    </div>
  );
}

function formatSongLeaderName(profile: RelatedProfile) {
  const firstName = profile.first_name?.trim();
  const lastName = profile.last_name?.trim();
  if (!firstName && !lastName) return '';

  const prefix = profile.gender === 'male' ? 'Bro.' : profile.gender === 'female' ? 'Sis.' : '';
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return prefix ? `${prefix} ${name}` : name;
}

function EventCard({ event, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, onLifecycleChange, isPast, artworkClassName = 'h-16 w-16', variant = 'list' }: {
  event: Event; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; onLifecycleChange?: (event: Event) => void; isPast?: boolean; artworkClassName?: string; variant?: 'list' | 'featured';
}) {
  const { user, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const [lifecycleDialogMode, setLifecycleDialogMode] = useState<EventLifecycleDialogMode | null>(null);
  const [lifecycleAnchorRect, setLifecycleAnchorRect] = useState<EventActionAnchorRect | null>(null);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const eventButtonRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const dayEntries = calendarEntries.filter(e => e.date === event.event_date && e.type === 'leave');
  const songLeader = songLeaderMap?.[event.id];
  const setlistInfo = setlistInfoMap?.[event.id];
  const hasApprovedSetlist = setlistInfo?.status === 'approved';
  const now = new Date();
  const proposalDueDate = event.proposal_due_date ? parseISO(event.proposal_due_date) : null;
  const daysUntilDue = proposalDueDate ? differenceInDays(proposalDueDate, now) : null;
  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const pendingReviewAge = setlistInfo?.status === 'pending_review'
    ? describeSetlistReviewAge(setlistInfo.submitted_at || setlistInfo.created_at)
    : null;
  const pendingReviewMessage = pendingReviewAge ? getSetlistPendingMessage(pendingReviewAge, false) : null;
  const scheduleHasEnded = hasEventScheduleEnded(event, now);
  const canManageLifecycle = isPlatformOwner && (isPast || scheduleHasEnded);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => () => cancelLongPress(), []);

  const openLifecycleDialog = (mode: EventLifecycleDialogMode) => {
    const rect = eventButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLifecycleAnchorRect({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    setLifecycleDialogMode(mode);
  };

  const startLongPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canManageLifecycle) return;
    cancelLongPress();
    longPressTriggeredRef.current = false;
    longPressOriginRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openLifecycleDialog('options');
      longPressTimerRef.current = null;
      if ('vibrate' in navigator) navigator.vibrate(35);
    }, 600);
  };

  const handleLongPressMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = longPressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancelLongPress();
  };

  // Visual urgency states (only when proposal is missing)
  const showOverdueStyle = isOverdue && !hasApprovedSetlist && !isPast && !scheduleHasEnded;
  const showDueSoonStyle = isDueSoon && !hasApprovedSetlist && !isPast && !scheduleHasEnded;

  const handleLifecycleChange = async () => {
    if (!user || !isPlatformOwner || (!isPast && !scheduleHasEnded) || savingLifecycle) return;

    setSavingLifecycle(true);
    const nextOverride = isPast ? 'upcoming' : 'completed';
    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update({
        lifecycle_override: nextOverride,
        lifecycle_override_by: user.id,
        lifecycle_override_at: new Date().toISOString(),
      })
      .eq('id', event.id)
      .select('*')
      .maybeSingle();
    setSavingLifecycle(false);

    if (error || !updatedEvent) {
      console.error('Failed to update event lifecycle:', error || 'The event was not updated');
      toast('error', 'Failed to move event');
      return;
    }

    setLifecycleDialogMode(null);
    onLifecycleChange?.(updatedEvent as Event);
    toast('success', isPast ? 'Event moved to Upcoming' : 'Event moved to Past events');
  };

  return (
    <div className="relative">
      <button
        ref={eventButtonRef}
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          onEventClick(event.id);
        }}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerMove={handleLongPressMove}
        onContextMenu={pointerEvent => {
          if (!canManageLifecycle) return;
          pointerEvent.preventDefault();
          openLifecycleDialog('options');
        }}
        className={`touch-action-pan-y group relative w-full text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] motion-reduce:transform-none ${variant === 'featured' ? 'flex flex-col rounded-[1rem] p-1.5 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_20px_46px_-24px_rgba(34,197,94,0.55)]' : 'flex min-h-[5.5rem] items-center gap-3 px-0 py-3 focus-visible:ring-inset'} ${lifecycleDialogMode ? 'z-10 scale-[1.005] bg-[#080d0a] shadow-[0_16px_48px_-24px_rgba(34,197,94,0.75)]' : variant === 'featured' ? 'bg-white/[0.025] hover:bg-white/[0.06]' : 'bg-transparent hover:bg-white/[0.03]'} ${canManageLifecycle ? 'select-none' : ''}`}
        style={{ opacity: isPast ? 0.62 : 1 }}
        aria-expanded={lifecycleDialogMode ? true : undefined}
      >
      {variant === 'featured' ? (
        <>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[0.72rem] border border-white/[0.08] bg-[#161a18]">
            {setlistInfo?.songCount ? (
              <EventArtwork
                eventType={event.event_type}
                title={event.title}
                artworkUrls={setlistInfo.artworkUrls || []}
                songs={setlistInfo.artworkSongs}
                className="h-full w-full rounded-none border-0"
              />
            ) : (
              <EmptyEventArtwork className="h-full w-full rounded-none border-0" />
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" />
            <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/75 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-lg backdrop-blur-sm">
              {format(parseISO(event.event_date), 'MMM dd')}
            </span>
            {(showOverdueStyle || showDueSoonStyle || scheduleHasEnded || isPast) && (
              <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-black shadow-lg backdrop-blur-sm ${showOverdueStyle ? 'bg-red-500/85 text-white' : showDueSoonStyle ? 'bg-amber-400/90 text-black' : isPast ? 'bg-black/75 text-white/75' : 'bg-amber-400/90 text-black'}`}>
                {showOverdueStyle ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                {showOverdueStyle ? 'Overdue' : showDueSoonStyle ? `Due in ${daysUntilDue}d` : isPast ? 'Completed' : 'Finished'}
              </span>
            )}
            {setlistInfo?.songCount ? (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-[9px] font-bold text-emerald-300 backdrop-blur-sm">
                {setlistInfo.songCount} song{setlistInfo.songCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <div className="w-full min-w-0 px-1 pb-1 pt-2.5">
            <p className="truncate text-[13px] font-black leading-snug text-white" style={{ letterSpacing: '-0.015em' }}>{songLeader || event.title}</p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <EventTypeLabel type={event.event_type} />
              <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/25" />
              <span className="truncate text-[10px] font-semibold text-white/42">{formatTime12Hour(event.start_time || '')}{event.end_time && ` – ${formatTime12Hour(event.end_time)}`}</span>
            </div>
            {dayEntries.length > 0 ? (
              <p className="mt-1 truncate text-[9px] font-semibold text-amber-300/70">Out: {dayEntries.map(entry => entry.name).join(', ')}</p>
            ) : null}
          </div>
        </>
      ) : <>
      {setlistInfo?.songCount ? (
        <EventArtwork
          eventType={event.event_type}
          title={event.title}
          artworkUrls={setlistInfo.artworkUrls || []}
          songs={setlistInfo.artworkSongs}
          className={`${artworkClassName} rounded-[0.35rem]`}
        />
      ) : (
        <EmptyEventArtwork className={artworkClassName} />
      )}

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="line-clamp-2 break-words text-[14px] font-black leading-snug text-white" style={{ letterSpacing: '-0.015em' }}>
            {songLeader || event.title}
          </p>
          {showOverdueStyle && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" /> Overdue
            </span>
          )}
          {showDueSoonStyle && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" /> Due in {daysUntilDue}d
            </span>
          )}
          {pendingReviewMessage && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg ${
              (pendingReviewAge?.pendingDays ?? 0) > 1
                ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
            }`}>
              <Clock className="h-3 w-3" /> {pendingReviewMessage}
            </span>
          )}
          {isPast && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2 py-0.5 text-[10px] font-black text-white/58">
              <CheckCircle className="h-3 w-3" /> Completed
            </span>
          )}
          {!isPast && scheduleHasEnded && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/[0.12] px-2 py-0.5 text-[10px] font-black text-amber-300">
              <Clock className="h-3 w-3" /> Finished
            </span>
          )}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <EventTypeLabel type={event.event_type} />
          <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/25" />
          <Clock className="h-3 w-3 shrink-0 text-white/28" />
          <span className="truncate text-[12px] font-semibold leading-snug text-white/45">
            {formatTime12Hour(event.start_time || '')}{event.end_time && ` – ${formatTime12Hour(event.end_time)}`}
          </span>
        </div>

        {dayEntries.length > 0 && (
          <div
            className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-amber-300/75"
            title={`Out: ${dayEntries.map(entry => entry.name).join(', ')}`}
          >
            <CalendarOff className="h-3 w-3 shrink-0 text-amber-400/70" />
            <span className="truncate">Out: {dayEntries.map(entry => entry.name).join(', ')}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        {!canManageLifecycle && (
          <span className={`hidden rounded-full border px-4 py-2 text-[12px] font-bold lg:inline-flex ${hasApprovedSetlist ? 'border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]' : setlistInfo?.status === 'pending_review' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-white/[0.08] text-white/62'}`}>
            {hasApprovedSetlist ? 'Ready' : setlistInfo?.status === 'pending_review' ? 'Pending review' : 'No songs yet'}
          </span>
        )}
        <EventDateChip
          date={event.event_date}
          dim={!!isPast}
          tone={showOverdueStyle ? 'danger' : showDueSoonStyle ? 'warning' : 'default'}
          compact
        />
      </div>
      </>}
      </button>

      {canManageLifecycle && variant === 'list' && (
        <button
          type="button"
          onClick={() => openLifecycleDialog('confirm')}
          className="absolute right-[5.5rem] top-1/2 z-20 hidden min-h-9 -translate-y-1/2 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-[#10251a] px-3 text-[11px] font-black text-emerald-300 shadow-lg shadow-black/40 transition-colors hover:bg-[#173523] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] md:inline-flex lg:right-[6rem]"
          aria-label={isPast ? 'Move event to Upcoming' : 'Move event to Past events'}
        >
          {isPast ? <Calendar className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
          <span>{isPast ? 'Move to Upcoming' : 'Move to Past'}</span>
        </button>
      )}

      <EventLifecycleActionModal
        open={lifecycleDialogMode !== null}
        mode={lifecycleDialogMode || 'options'}
        anchorRect={lifecycleAnchorRect}
        eventName={songLeader || event.title}
        eventMeta={`${event.event_type} · ${formatTime12Hour(event.start_time || '')}${event.end_time ? ` – ${formatTime12Hour(event.end_time)}` : ''}`}
        isPast={Boolean(isPast)}
        saving={savingLifecycle}
        onClose={() => { if (!savingLifecycle) setLifecycleDialogMode(null); }}
        onModeChange={setLifecycleDialogMode}
        onOpenEvent={() => {
          setLifecycleDialogMode(null);
          onEventClick(event.id);
        }}
        onConfirm={() => void handleLifecycleChange()}
      />
    </div>
  );
}

function BirthdayCard({ name, date, artworkClassName = 'h-16 w-16' }: { name: string; date: string; artworkClassName?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishing, setWishing] = useState(false);
  const [wished, setWished] = useState(false);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);

  const firstName = name.split(' ')[0];
  const today = startOfDay(new Date());
  const isToday = date === format(today, 'yyyy-MM-dd');
  const daysUntilBirthday = differenceInDays(parseISO(date), today);

  // On mount, check if a birthday announcement already exists today
  // and whether this user has already wished
  useEffect(() => {
    if (!isToday || !user) return;
    (async () => {
      const todayStart = `${date}T00:00:00`;
      const todayEnd = `${date}T23:59:59`;
      const { data } = await supabase
        .from('announcements')
        .select('id, announcement_reactions(user_id, emoji)')
        .like('title', `🎂 Happy Birthday, ${name}%`)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .maybeSingle();
      if (data) {
        setAnnouncementId(data.id);
        const alreadyWished = data.announcement_reactions?.some(
          r => r.user_id === user.id
        );
        if (alreadyWished) setWished(true);
      }
    })();
  }, [isToday, user, name, date]);

  const handleWish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || wishing || wished) return;
    setWishing(true);

    if (!announcementId) {
      // First person to wish — create the shared birthday announcement
      const { data: newAnn, error } = await supabase
        .from('announcements')
        .insert({
          title: `🎂 Happy Birthday, ${name}!`,
          content: `🎉 Today is ${firstName}'s birthday! Wishing them all of God's blessings on their special day! 🙏`,
          priority: 'normal',
          created_by: user.id,
        })
        .select('id')
        .maybeSingle();
      if (error || !newAnn) { toast('error', 'Could not send birthday wish'); setWishing(false); return; }
      setAnnouncementId(newAnn.id);
      await supabase.from('announcement_reactions').insert({
        announcement_id: newAnn.id,
        user_id: user.id,
        emoji: '🎉',
      });
    } else {
      // Announcement already exists — just add a 🎉 reaction
      await supabase.from('announcement_reactions').insert({
        announcement_id: announcementId,
        user_id: user.id,
        emoji: '🎉',
      });
    }

    setWishing(false);
    toast('success', `Birthday wish sent to ${firstName}! 🎉`);
    setWished(true);
  };

  return (
    <div
      className="touch-action-pan-y relative flex w-full items-center gap-3 bg-transparent px-0 py-3 text-left"
    >
      <div className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-[0.35rem] border border-white/[0.08] bg-[#222222] ${artworkClassName}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(236,72,153,0.22),transparent_34%)]" />
        <PartyPopper className="relative h-5 w-5 text-pink-200/82" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-black leading-snug text-white" style={{ letterSpacing: '-0.015em' }}>
            {name}
          </p>
          {isToday ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300">
              <PartyPopper className="h-3 w-3" /> Today!
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-pink-50 dark:bg-pink-500/[0.12] text-pink-500 dark:text-pink-300">
              Birthday
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[12px] font-semibold text-white/45">
          {format(parseISO(date), 'EEEE, MMMM d')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        {isToday ? (
          <button
            onClick={handleWish}
            disabled={wishing || wished}
            className={`touch-action-pan-y hidden h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-bold transition-all active:scale-95 disabled:opacity-60 sm:inline-flex ${
              wished
                ? 'border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]'
                : 'border-pink-300/20 bg-pink-400/10 text-pink-200'
            }`}
          >
            {wished ? (
              <><Heart className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" /> Wished</>
            ) : wishing ? (
              '...'
            ) : (
              <><PartyPopper className="h-3.5 w-3.5" /> Greet</>
            )}
          </button>
        ) : (
          <span
            className="hidden h-9 shrink-0 items-center rounded-full border border-pink-300/15 bg-pink-400/10 px-3.5 text-[12px] font-bold text-pink-200/72 sm:inline-flex"
            title={`Greetings open on ${format(parseISO(date), 'MMMM d')}`}
          >
            {daysUntilBirthday === 1 ? '1 day' : `${daysUntilBirthday} days`}
          </span>
        )}
        <EventDateChip date={date} compact tone="danger" />
      </div>
    </div>
  );
}

const itemAnim = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } } };

const createEmptyEventForm = (eventDate = ''): EventFormState => ({
  title: '',
  event_date: eventDate,
  start_time: '',
  end_time: '',
  event_type: '',
  description: '',
  song_leader_id: '',
  linked_event_id: '',
});

function EventList({ events, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, onLifecycleChange, showPast, animateItems = true, layout = 'list' }: {
  events: Event[]; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; onLifecycleChange?: (event: Event) => void; showPast?: boolean; animateItems?: boolean; layout?: 'list' | 'grid';
}) {
  const now = new Date();
  const today = startOfDay(now);

  const displayEvents = showPast
    ? events.filter(e => isEventCompleted(e)).sort((a, b) => b.event_date.localeCompare(a.event_date))
    : events.filter(e => !isEventCompleted(e)).sort((a, b) => a.event_date.localeCompare(b.event_date));

  // Upcoming birthday entries (deduplicated, not shown in past view)
  const birthdayEntries = showPast ? [] : Array.from(
    new Map(
      calendarEntries
        .filter(e => e.type === 'birthday' && parseISO(e.date) >= today)
        .map(e => [`${e.name}-${e.date}`, e])
    ).values()
  );

  type ListItem =
    | { kind: 'event'; sortDate: string; event: Event }
    | { kind: 'birthday'; sortDate: string; entry: CalendarEntry };

  const merged: ListItem[] = [
    ...displayEvents.map(e => ({ kind: 'event' as const, sortDate: e.event_date, event: e })),
    ...birthdayEntries.map(e => ({ kind: 'birthday' as const, sortDate: e.date, entry: e })),
  ].sort((a, b) => showPast
    ? b.sortDate.localeCompare(a.sortDate)
    : a.sortDate.localeCompare(b.sortDate)
  );

  if (merged.length === 0) return null;

  const featuredEvents = merged.filter((item): item is Extract<ListItem, { kind: 'event' }> => item.kind === 'event').slice(0, 4);
  const featuredEventIds = new Set(featuredEvents.map(item => item.event.id));
  const remainingItems = merged.filter(item => item.kind !== 'event' || !featuredEventIds.has(item.event.id));

  const renderItem = (item: ListItem, featured = false) => (
    item.kind === 'event' ? (
      <EventCard event={item.event} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={onEventClick} onLifecycleChange={onLifecycleChange} isPast={showPast} variant={featured ? 'featured' : 'list'} />
    ) : (
      <BirthdayCard name={item.entry.name} date={item.entry.date} />
    )
  );

  if (!animateItems) {
    if (layout === 'grid') {
      return (
        <div className="touch-action-pan-y grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {merged.map(item => <div key={item.kind === 'event' ? item.event.id : `bday-${item.entry.name}-${item.entry.date}`}>{renderItem(item)}</div>)}
        </div>
      );
    }
    return (
      <div className="touch-action-pan-y space-y-3">
        {featuredEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 border-b border-white/[0.08] pb-4 lg:grid-cols-4">
            {featuredEvents.map(item => <div key={item.event.id} className="min-w-0">{renderItem(item, true)}</div>)}
          </div>
        ) : null}
        {remainingItems.length > 0 ? (
          <div className="divide-y divide-white/[0.08]">
            {remainingItems.map(item => <div key={item.kind === 'event' ? item.event.id : `bday-${item.entry.name}-${item.entry.date}`} className="touch-action-pan-y">{renderItem(item)}</div>)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      className="touch-action-pan-y space-y-3"
    >
      {layout === 'grid' ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {merged.map(item => <motion.div key={item.kind === 'event' ? item.event.id : `bday-${item.entry.name}-${item.entry.date}`} variants={itemAnim}>{renderItem(item)}</motion.div>)}
        </div>
      ) : <>
        {featuredEvents.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 border-b border-white/[0.08] pb-4 lg:grid-cols-4">
            {featuredEvents.map(item => <motion.div key={item.event.id} variants={itemAnim} className="min-w-0">{renderItem(item, true)}</motion.div>)}
          </div>
        ) : null}
        {remainingItems.length > 0 ? (
          <div className="divide-y divide-white/[0.08]">
            {remainingItems.map(item => <motion.div key={item.kind === 'event' ? item.event.id : `bday-${item.entry.name}-${item.entry.date}`} variants={itemAnim}>{renderItem(item)}</motion.div>)}
          </div>
        ) : null}
      </>}
    </motion.div>
  );
}

function getEventListItems(events: Event[], calendarEntries: CalendarEntry[], showPast?: boolean) {
  const now = new Date();
  const today = startOfDay(now);
  const displayEvents = showPast
    ? events.filter(e => isEventCompleted(e)).sort((a, b) => b.event_date.localeCompare(a.event_date))
    : events.filter(e => !isEventCompleted(e)).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const birthdayEntries = showPast ? [] : Array.from(
    new Map(
      calendarEntries
        .filter(e => e.type === 'birthday' && parseISO(e.date) >= today)
        .map(e => [`${e.name}-${e.date}`, e])
    ).values()
  );

  return [
    ...displayEvents.map(e => ({ kind: 'event' as const, sortDate: e.event_date, event: e })),
    ...birthdayEntries.map(e => ({ kind: 'birthday' as const, sortDate: e.date, entry: e })),
  ].sort((a, b) => showPast
    ? b.sortDate.localeCompare(a.sortDate)
    : a.sortDate.localeCompare(b.sortDate)
  );
}

type EventListItem =
  | { kind: 'event'; sortDate: string; event: Event }
  | { kind: 'birthday'; sortDate: string; entry: CalendarEntry };

function scoreSetlistInfo(info: SetlistInfo) {
  const statusScore = info.status === 'approved' ? 100 : info.status === 'pending_review' ? 50 : 0;
  return statusScore + (info.artworkUrls?.length || 0) * 10 + (info.songCount || 0);
}

function shouldReplaceSetlistInfo(current: SetlistInfo | undefined, next: SetlistInfo) {
  if (!current) return true;
  return scoreSetlistInfo(next) > scoreSetlistInfo(current);
}

function groupEventItemsByMonth(items: EventListItem[]) {
  const groups = new Map<string, EventListItem[]>();
  items.forEach((item) => {
    const key = format(parseISO(item.sortDate), 'MMMM yyyy');
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
  });
  return Array.from(groups.entries()).map(([month, monthItems]) => ({ month, items: monthItems }));
}

function EventDesktopCardGroups({ events, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, onLifecycleChange, showPast }: {
  events: Event[];
  calendarEntries: CalendarEntry[];
  songLeaderMap?: Record<string, string>;
  setlistInfoMap?: Record<string, SetlistInfo>;
  onEventClick: (id: string) => void;
  onLifecycleChange?: (event: Event) => void;
  showPast?: boolean;
}) {
  const allItems = getEventListItems(events, calendarEntries, showPast) as EventListItem[];
  const featuredEvents = allItems.filter((item): item is Extract<EventListItem, { kind: 'event' }> => item.kind === 'event').slice(0, 4);
  const featuredEventIds = new Set(featuredEvents.map(item => item.event.id));
  const monthGroups = groupEventItemsByMonth(allItems.filter(item => item.kind !== 'event' || !featuredEventIds.has(item.event.id)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {featuredEvents.length > 0 ? (
        <section className="grid grid-cols-4 gap-3 border-b border-white/[0.08] pb-6">
          {featuredEvents.map(item => (
            <EventCard
              key={item.event.id}
              event={item.event}
              calendarEntries={calendarEntries}
              songLeaderMap={songLeaderMap}
              setlistInfoMap={setlistInfoMap}
              onEventClick={onEventClick}
              onLifecycleChange={onLifecycleChange}
              isPast={showPast}
              variant="featured"
            />
          ))}
        </section>
      ) : null}
      {monthGroups.map((group) => (
        <section key={group.month} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-black text-white" style={{ letterSpacing: '-0.025em' }}>{group.month}</h2>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-black text-white/58">{group.items.length}</span>
          </div>

          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {group.items.map((item) => {
              if (item.kind === 'birthday') {
                return (
                  <div
                    key={`desktop-bday-${item.entry.name}-${item.entry.date}`}
                    className="transition-colors hover:bg-white/[0.035]"
                  >
                    <BirthdayCard name={item.entry.name} date={item.entry.date} artworkClassName="h-24 w-24" />
                  </div>
                );
              }

              return (
                <div
                  key={item.event.id}
                  className="transition-colors hover:bg-white/[0.035]"
                >
                  <EventCard
                    event={item.event}
                    calendarEntries={calendarEntries}
                    songLeaderMap={songLeaderMap}
                    setlistInfoMap={setlistInfoMap}
                    onEventClick={onEventClick}
                    onLifecycleChange={onLifecycleChange}
                    isPast={showPast}
                    artworkClassName="h-24 w-24"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </motion.div>
  );
}

export function Events() {
  const { user, isLeader, roles, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<EventMemberSummary[]>([]);
  const [memberRoles, setMemberRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [songLeaderMap, setSongLeaderMap] = useState<Record<string, string>>({});
  const [setlistInfoMap, setSetlistInfoMap] = useState<Record<string, SetlistInfo>>({});
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>(() => {
    const s = localStorage.getItem('eventsActiveTab'); return (s === 'upcoming' || s === 'past') ? s : 'upcoming';
  });
  const [desktopView, setDesktopView] = useState<'list' | 'calendar'>(() => {
    const storedView = localStorage.getItem('eventsView') ?? sessionStorage.getItem('eventsDesktopView');
    return storedView === 'calendar' ? 'calendar' : 'list';
  });
  const [form, setForm] = useState<EventFormState>(() => createEmptyEventForm());
  const [customName, setCustomName] = useState('');
  const [sundayServices, setSundayServices] = useState<Event[]>([]);
  const [lifecycleNow, setLifecycleNow] = useState(() => new Date());
  const [eventTemplates, setEventTemplates] = useState<EventTemplatePolicies | null>(null);
  const availableEventTypes = Object.keys(eventTemplates || DEFAULT_EVENT_TEMPLATE_POLICIES);

  useEffect(() => {
    if (!profile?.org_id) return;
    let active = true;
    void supabase.from('organization_policy_settings').select('event_templates').eq('org_id', profile.org_id).maybeSingle()
      .then(({ data }) => { if (active) setEventTemplates(normalizeEventTemplatePolicies(data?.event_templates)); });
    return () => { active = false; };
  }, [profile?.org_id]);

  const fetchEvents = useCallback(async () => {
    try {
      const [eventsRes, membersRes, userRolesRes, birthdaysRes, leaveRes, songLeadersRes, setlistsRes, sundayServicesRes] = await Promise.all([
        withRequestTimeout(supabase.from('events').select('*').order('event_date', { ascending: false }), emptyListResponse(), 'Events list'),
        withRequestTimeout(supabase.from('profiles').select('id, first_name, last_name, gender, birthday'), emptyListResponse(), 'Event members list'),
        withRequestTimeout(supabase.from('user_roles').select('user_id, role_id'), emptyListResponse(), 'Event member roles'),
        withRequestTimeout(supabase.from('profiles').select('first_name, last_name, birthday').not('birthday', 'is', null), emptyListResponse(), 'Birthdays list'),
        withRequestTimeout(supabase.from('user_availability').select('leave_type, unavailable_date, start_date, end_date, status, profiles!user_availability_user_id_fkey(first_name, last_name)').eq('status', 'approved'), emptyListResponse(), 'Approved leave list'),
        withRequestTimeout(supabase.from('event_assignments').select('event_id, profiles(first_name, last_name, gender), roles!inner(name)').eq('roles.name', 'Song Leader'), emptyListResponse(), 'Song leader list'),
        withRequestTimeout(
          supabase
            .from('setlists')
            .select('event_id, status, created_at, submitted_at, setlist_songs(id, song_id, position, youtube_url, songs(id, title, artist, youtube_url))'),
          emptyListResponse(),
          'Event setlist statuses',
        ),
        withRequestTimeout(supabase.from('events').select('*').eq('event_type', 'Sunday Service').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date'), emptyListResponse(), 'Upcoming Sunday services'),
      ]);
      setEvents(eventsRes.data || []);
      setMembers(membersRes.data || []);
      setMemberRoles(userRolesRes.data || []);
      setSundayServices(sundayServicesRes.data || []);

      const slMap: Record<string, string> = {};
      (songLeadersRes.data || []).forEach(assignment => {
        const profile = getRelatedProfile(assignment.profiles);
        if (profile) {
          const name = formatSongLeaderName(profile);
          if (name) slMap[assignment.event_id] = name;
        }
      });

      const memberNameById = new Map(
        ((membersRes.data || []) as EventMemberSummary[])
          .map(member => [member.id, formatSongLeaderName(member)])
          .filter((entry): entry is [string, string] => Boolean(entry[1]))
      );
      (eventsRes.data || []).forEach((event: Event) => {
        if (!slMap[event.id] && event.song_leader_id) {
          const directLeaderName = memberNameById.get(event.song_leader_id);
          if (directLeaderName) slMap[event.id] = directLeaderName;
        }
      });
      (eventsRes.data || []).forEach((event: Event) => {
        if (!slMap[event.id] && event.linked_event_id && slMap[event.linked_event_id]) {
          slMap[event.id] = slMap[event.linked_event_id];
        }
      });
      setSongLeaderMap(slMap);

      const setlistRows = setlistsRes.data || [];
      const songIds = Array.from(new Set(
        setlistRows.flatMap(setlist =>
          (setlist.setlist_songs || [])
            .map((song: EventSongArtwork) => song.song_id)
            .filter((id: string | null | undefined): id is string => Boolean(id))
        )
      ));
      const songsById = new Map<string, ArtworkSongRecord>();
      if (songIds.length > 0) {
        const songsRes = await withRequestTimeout(
          supabase.from('songs').select('id, title, artist, youtube_url').in('id', songIds),
          emptyListResponse(),
          'Event artwork song fallback',
        );
        (songsRes.data || []).forEach((song: ArtworkSongRecord) => {
          if (song.id) songsById.set(song.id, song);
        });
      }

      const setlistMap: Record<string, SetlistInfo> = {};
      await Promise.all(setlistRows.map(async setlist => {
        const setlistSongs = hydrateEventArtworkSongs(setlist.setlist_songs, songsById);
        const artworkUrls = await getEventSongArtworkUrls(setlistSongs);
        const artworkSongs = setlistSongs
          .slice()
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          .slice(0, 4);
        const nextInfo: SetlistInfo = {
          status: setlist.status,
          created_at: setlist.created_at,
          submitted_at: setlist.submitted_at,
          artworkUrls,
          artworkSongs,
          songCount: setlist.setlist_songs?.length || 0,
        };
        if (shouldReplaceSetlistInfo(setlistMap[setlist.event_id], nextInfo)) {
          setlistMap[setlist.event_id] = nextInfo;
        }
      }));
      (eventsRes.data || []).forEach((event: Event) => {
        if (event.linked_event_id && setlistMap[event.linked_event_id] && shouldReplaceSetlistInfo(setlistMap[event.id], setlistMap[event.linked_event_id])) {
          setlistMap[event.id] = setlistMap[event.linked_event_id];
        }
      });
      setSetlistInfoMap(setlistMap);

      const entries: CalendarEntry[] = [];
      (birthdaysRes.data || []).forEach(profile => {
        if (profile.birthday) {
          const thisYear = new Date().getFullYear();
          entries.push({ type: 'birthday', date: `${thisYear}-${profile.birthday.slice(5)}`, name: `${profile.first_name} ${profile.last_name}` });
        }
      });
      (leaveRes.data || []).forEach(availability => {
        const profile = getRelatedProfile(availability.profiles);
        const name = `${profile?.first_name} ${profile?.last_name}`;
        if (availability.leave_type === 'range' && availability.start_date && availability.end_date) {
          eachDayOfInterval({ start: parseISO(availability.start_date), end: parseISO(availability.end_date) }).forEach(day => {
            entries.push({ type: 'leave', date: format(day, 'yyyy-MM-dd'), name, status: availability.status });
          });
        } else if (availability.unavailable_date) {
          entries.push({ type: 'leave', date: availability.unavailable_date, name, status: availability.status });
        }
      });
      setCalendarEntries(entries);
    } catch (error) {
      console.error('Fetch events error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => {
    const state = location.state as { deletedEventId?: string; refreshEventsAt?: number; openModal?: string } | null;
    if (state?.openModal === 'schedule-event') openCreateEvent();
    if (!state?.deletedEventId && !state?.refreshEventsAt && !state?.openModal) return;

    const deletedEventId = state.deletedEventId;
    if (deletedEventId) {
      setEvents(prev => prev.filter(event => event.id !== deletedEventId));
      setSundayServices(prev => prev.filter(event => event.id !== deletedEventId));
      setSongLeaderMap(prev => {
        const next = { ...prev };
        delete next[deletedEventId];
        return next;
      });
      setSetlistInfoMap(prev => {
        const next = { ...prev };
        delete next[deletedEventId];
        return next;
      });
    }

    fetchEvents();
    navigate(location.pathname, { replace: true, state: null });
  }, [fetchEvents, location.key, location.pathname, location.state, navigate]);
  useEffect(() => { localStorage.setItem('eventsActiveTab', activeTab); }, [activeTab]);
  useEffect(() => {
    void loadSyncedPreference<'list' | 'calendar'>(user?.id, 'events.view').then(value => {
      if (value === 'list' || value === 'calendar') setDesktopView(value);
    });
  }, [user?.id]);
  useEffect(() => {
    localStorage.setItem('eventsView', desktopView);
    void saveSyncedPreference(user?.id, 'events.view', desktopView);
  }, [desktopView, user?.id]);
  useEffect(() => {
    const refreshLifecycle = () => setLifecycleNow(new Date());
    const interval = window.setInterval(refreshLifecycle, 30_000);
    window.addEventListener('focus', refreshLifecycle);
    document.addEventListener('visibilitychange', refreshLifecycle);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshLifecycle);
      document.removeEventListener('visibilitychange', refreshLifecycle);
    };
  }, []);

  const openCreateEvent = (eventDate = '') => {
    setForm(createEmptyEventForm(eventDate));
    setAssignmentRows([]);
    setCustomName('');
    setShowCreate(true);
  };

  const closeCreateEvent = () => {
    setShowCreate(false);
    setForm(createEmptyEventForm());
    setAssignmentRows([]);
    setCustomName('');
  };

  const addAssignmentRow = () => setAssignmentRows(prev => [...prev, { user_id: '', role_id: '' }]);

  const updateAssignmentRow = (index: number, field: keyof AssignmentRow, value: string) => {
    setAssignmentRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      if (field === 'role_id') return { ...row, role_id: value, user_id: '' };
      return { ...row, [field]: value };
    }));
  };

  const getMembersForRole = (roleId: string) => {
    if (!roleId) return members;
    const userIds = memberRoles.filter(ur => ur.role_id === roleId).map(ur => ur.user_id);
    return members.filter(m => userIds.includes(m.id));
  };

  const removeAssignmentRow = (index: number) => setAssignmentRows(prev => prev.filter((_, i) => i !== index));

  const calculateProposalDueDate = (eventDate: string, eventType: string): string | null => calculatePolicyProposalDueDate(eventDate, eventType, eventTemplates);

  const getDefaultTimes = (eventType: string) => {
    const template = eventTemplateFor(eventType, eventTemplates);
    return { start: template.start_time, end: template.end_time };
  };

  const handleEventTypeChange = (newType: string) => {
    const times = getDefaultTimes(newType);
    setForm(prev => ({ ...prev, event_type: newType, start_time: times.start, end_time: times.end, song_leader_id: '', linked_event_id: '' }));
  };

  const handleDateChange = (newDate: string) => setForm(prev => ({ ...prev, event_date: newDate }));

  const getSongLeaders = () => {
    const r = roles.find(r => r.name === 'Song Leader');
    if (!r) return [];
    const ids = memberRoles.filter(ur => ur.role_id === r.id).map(ur => ur.user_id);
    return members.filter(m => ids.includes(m.id));
  };

  const generateEventTitle = async (): Promise<string> => {
    if (form.event_type === 'Custom') return customName.trim() || 'Custom Event';
    if (form.song_leader_id.trim()) {
      const sl = members.find(m => m.id === form.song_leader_id);
      if (sl) {
        return formatSongLeaderName(sl);
      }
    }
    return form.event_type;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.event_type) { toast('error', 'Please select an event type'); return; }
    setCreating(true);
    let eventWasCreated = false;
    try {
      const draft = { ...form };
      const draftAssignments = [...assignmentRows];
      const title = await generateEventTitle();
      const { data: newEvent, error } = await supabase.from('events').insert({
        title, event_date: draft.event_date, start_time: draft.start_time || null, end_time: draft.end_time || null,
        event_type: draft.event_type, description: draft.description || null, created_by: user.id,
        proposal_due_date: calculateProposalDueDate(draft.event_date, draft.event_type),
        song_leader_id: draft.song_leader_id || null, linked_event_id: draft.linked_event_id || null,
      }).select('*').maybeSingle();
      if (error || !newEvent) { toast('error', 'Failed to create event'); setCreating(false); return; }

      const newEventRecord = newEvent as Event;
      closeCreateEvent();
      setEvents(prev => [newEventRecord, ...prev.filter(event => event.id !== newEventRecord.id)]);
      if (newEventRecord.event_type === 'Sunday Service' && parseISO(newEventRecord.event_date) >= today) {
        setSundayServices(prev => [newEventRecord, ...prev.filter(event => event.id !== newEventRecord.id)]);
      }
      if (draft.song_leader_id) {
        setSongLeaderMap(prev => ({ ...prev, [newEventRecord.id]: title }));
      }
      setCreating(false);
      toast('success', 'Event created');
      eventWasCreated = true;

      const validAssignments = draftAssignments.filter(a => a.user_id && a.role_id);
      if (draft.song_leader_id) {
        const slRole = roles.find(r => r.name === 'Song Leader');
        if (slRole) validAssignments.push({ user_id: draft.song_leader_id, role_id: slRole.id });
      }
      if (validAssignments.length > 0) await supabase.from('event_assignments').insert(validAssignments.map(a => ({ event_id: newEventRecord.id, user_id: a.user_id, role_id: a.role_id })));

      if (draft.event_type === 'Rehearsals' && draft.linked_event_id && validAssignments.length > 0) {
        const { data: existing } = await supabase.from('event_assignments').select('user_id, role_id').eq('event_id', draft.linked_event_id);
        const existingSet = new Set((existing || []).map(a => `${a.user_id}-${a.role_id}`));
        const newOnes = validAssignments.filter(a => !existingSet.has(`${a.user_id}-${a.role_id}`));
        if (newOnes.length > 0) await supabase.from('event_assignments').insert(newOnes.map(a => ({ event_id: draft.linked_event_id, user_id: a.user_id, role_id: a.role_id })));
      }

      fetchEvents();
    } catch (error) {
      console.error('Create event error:', error);
      setCreating(false);
      if (eventWasCreated) {
        fetchEvents();
        return;
      }
      toast('error', 'Failed to create event');
    }
  };

  const handleEventDateChange = async (eventId: string, newDate: string) => {
    const { error } = await supabase.from('events').update({ event_date: newDate }).eq('id', eventId);
    if (error) { toast('error', 'Failed to move event'); return; }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, event_date: newDate } : e));
    toast('success', 'Event moved');
  };

  const handleEventLifecycleChange = (updatedEvent: Event) => {
    setEvents(prev => prev.map(event => event.id === updatedEvent.id ? updatedEvent : event));
    setSundayServices(prev => prev.map(event => event.id === updatedEvent.id ? updatedEvent : event));
  };

  const today = startOfDay(lifecycleNow);
  const upcomingEvents = events.filter(e => !isEventCompleted(e));
  const pastEvents = events.filter(e => isEventCompleted(e));
  const approvedLeaveToday = calendarEntries.filter(e => e.type === 'leave' && e.date === format(today, 'yyyy-MM-dd')).length;

  const filtered = events.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'upcoming' ? !isEventCompleted(e) : isEventCompleted(e);
    return matchSearch && matchTab;
  });
  const calendarEvents = events.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });
  const displayEvents = desktopView === 'calendar' ? calendarEvents : filtered;

  if (loading) return <div className="page-container"><EventsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad relative overflow-hidden bg-[#050505] text-white">
      <div className="relative mx-auto max-w-2xl space-y-5 px-4 pb-6 pt-4 sm:space-y-6 sm:px-6 sm:pt-5 md:max-w-[860px] md:px-8 lg:max-w-6xl xl:max-w-[1560px]">

        {/* ── Toolbar ── */}
        <motion.div
          {...fadeUp(0)}
          className="relative z-20 flex flex-col gap-3"
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Event timeframe">
            {(['upcoming', 'past'] as const).map(tab => {
              const active = activeTab === tab;
              const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
              return (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={active}
                  className={`relative z-10 inline-flex h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-[12px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
                    desktopView === 'calendar' ? 'md:hidden' : ''
                  } ${
                    active
                      ? 'bg-[#22c55e] text-black'
                      : 'bg-white/[0.10] text-white hover:bg-white/[0.16]'
                  }`}
                >
                  {tab === 'upcoming' ? 'Upcoming' : 'Past events'}
                  {count > 0 && (
                    <span className={`pointer-events-none text-[11px] px-1.5 py-0.5 rounded-md font-black ${
                      active
                        ? 'bg-black/15 text-black'
                        : 'bg-white/[0.10] text-white/58'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
            <span
              className={`hidden h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#22c55e] px-4 text-[12px] font-black text-black ${
                desktopView === 'calendar' ? 'md:inline-flex' : ''
              }`}
            >
              All events
              <span className="rounded-md bg-black/15 px-1.5 py-0.5 text-[11px] font-black text-black">{calendarEvents.length}</span>
            </span>
            {isLeader && (
              <button
                onClick={() => openCreateEvent()}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/[0.10] px-4 text-[12px] font-black text-white transition-colors hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" /> New event
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500/80 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events..."
                aria-label="Search events"
                className="h-11 w-full rounded-[0.7rem] border border-white/[0.08] bg-[#101010] pl-10 pr-10 text-[13px] font-semibold text-white outline-none transition-all placeholder:text-white/32 focus:border-[#22c55e]/50 focus:bg-[#151515] focus:ring-4 focus:ring-emerald-500/10"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear event search" className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] dark:hover:bg-white/[0.06] dark:hover:text-gray-300">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="hidden shrink-0 items-center gap-1 rounded-[0.7rem] bg-white/[0.07] p-1 md:flex">
              {([
                { value: 'list' as const, label: 'List', icon: List },
                { value: 'calendar' as const, label: 'Calendar', icon: Calendar },
              ]).map(option => {
                const Icon = option.icon;
                const active = desktopView === option.value;
                return (
                  <button
                    key={option.value}
                  type="button"
                  onClick={() => setDesktopView(option.value)}
                  aria-pressed={active}
                    className={`inline-flex h-9 items-center gap-2 rounded-[0.55rem] px-3 text-[12px] font-black transition-colors ${
                      active
                        ? 'bg-[#22c55e] text-black'
                        : 'text-white/58 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          {(upcomingEvents.length === 0 || approvedLeaveToday > 0) && (
            <div className="hidden rounded-[0.75rem] bg-white/[0.045] px-3 py-2 text-[12px] font-semibold text-white/62 sm:block">
              {upcomingEvents.length === 0 && <span>No upcoming events are scheduled yet.</span>}
              {approvedLeaveToday > 0 && (
                <span className="text-orange-300">
                  {approvedLeaveToday} team member{approvedLeaveToday === 1 ? '' : 's'} unavailable today.
                </span>
              )}
            </div>
          )}
        </motion.div>
        {/* ── Content ── */}
        <div>
        {displayEvents.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No events found"
            description={search ? 'Try adjusting your search.' : 'Create your first event to get started.'}
            action={isLeader ? <button onClick={() => openCreateEvent()} className="btn-primary"><Plus className="h-4 w-4" /> Create Event</button> : undefined}
          />
        ) : (
          <>
            {desktopView === 'calendar' ? (
              <motion.div {...fadeUp(0.1)} className="hidden md:block">
                <CalendarGrid
                  events={calendarEvents}
                  calendarEntries={calendarEntries}
                  songLeaderMap={songLeaderMap}
                  setlistInfoMap={setlistInfoMap}
                  onEventClick={id => navigate(`/events/${id}`)}
                  onCreateEvent={isLeader ? openCreateEvent : undefined}
                  onEventDateChange={isLeader ? handleEventDateChange : undefined}
                />
              </motion.div>
            ) : (
              <motion.div {...fadeUp(0.1)} className="hidden lg:block">
                <EventDesktopCardGroups
                  events={filtered}
                  calendarEntries={calendarEntries}
                  songLeaderMap={songLeaderMap}
                  setlistInfoMap={setlistInfoMap}
                  onEventClick={id => navigate(`/events/${id}`)}
                  onLifecycleChange={handleEventLifecycleChange}
                  showPast={activeTab === 'past'}
                />
              </motion.div>
            )}
            <div className={`touch-action-pan-y ${desktopView === 'calendar' ? 'md:hidden' : 'lg:hidden'}`}>
              <EventList events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} onLifecycleChange={handleEventLifecycleChange} showPast={activeTab === 'past'} animateItems={false} />
            </div>
          </>
        )}
        </div>
      </div>

      {/* ── Create Modal ── */}
      <Modal open={showCreate} onClose={closeCreateEvent} title="Create Event" size="lg" hideHeader bodyClassName="!overflow-hidden !p-0 flex min-h-0 flex-col">
        <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
          <div className="relative shrink-0 overflow-hidden px-5 pt-6 pb-5 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background: 'linear-gradient(135deg, rgba(22,163,74,0.13), rgba(20,184,166,0.06) 42%, transparent 78%)',
              }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.34), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.45)' }}
                  />
                  <div
                    className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
                  >
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400/80 mb-0.5">
                    Schedule
                  </p>
                  <h2 className="text-[1.35rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
                    Create Event.
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreateEvent}
                className="shrink-0 p-2 -mr-1 rounded-xl text-gray-400 hover:bg-white/70 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 space-y-5 scrollbar-thin overscroll-contain">
            <section className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-200/70 dark:ring-emerald-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <p className="section-label">Event Basics</p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Type</label>
                <Select value={form.event_type} onChange={handleEventTypeChange} options={availableEventTypes.map(t => ({ value: t, label: t }))} placeholder="Select type" />
              </div>

              {form.event_type === 'Custom' && (
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Event Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Enter event name"
                    className="input-field"
                    required
                  />
                </div>
              )}

              {['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(form.event_type) && (
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Song Leader</label>
                  <Select value={form.song_leader_id} onChange={v => setForm({ ...form, song_leader_id: v })} options={getSongLeaders().map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} placeholder="Select song leader" />
                </div>
              )}

              {form.event_type === 'Rehearsals' && (
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">For Sunday Service</label>
                  <Select value={form.linked_event_id} onChange={async (v) => {
                    setForm({ ...form, linked_event_id: v });
                    if (v) {
                      const { data: la } = await supabase.from('event_assignments').select('user_id, role_id, roles(name, is_leadership)').eq('event_id', v);
                      const linkedAssignments = (la || []) as LinkedAssignmentRow[];
                      if (linkedAssignments.length > 0) {
                        setAssignmentRows(linkedAssignments
                          .filter(a => !a.roles?.is_leadership && a.roles?.name !== 'Song Leader')
                          .map(a => ({ user_id: a.user_id, role_id: a.role_id })));
                      }
                    } else { setAssignmentRows([]); }
                  }} options={sundayServices.map(e => ({ value: e.id, label: `${format(parseISO(e.event_date), 'MMM d, yyyy')} - ${e.title}` }))} placeholder="Select Sunday Service" />
                  {form.linked_event_id && assignmentRows.length > 0 && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">Team assignments auto-filled from the linked Sunday Service.</p>}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Date</label>
                <DatePicker value={form.event_date} onChange={handleDateChange} required />
              </div>

              <div>
                {['Rehearsals', 'Revamp Session', 'Custom'].includes(form.event_type) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Start Time</label>
                      <TimePicker value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} required />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">End Time</label>
                      <TimePicker value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">Start Time</label>
                      <input type="text" value={form.start_time ? formatTime12Hour(form.start_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-white/40" disabled />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-600 dark:text-white/55 mb-1.5">End Time</label>
                      <input type="text" value={form.end_time ? formatTime12Hour(form.end_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-white/40" disabled />
                    </div>
                  </div>
                )}
              </div>

              {form.event_date && ['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(form.event_type) && (
                <div className="rounded-2xl px-3.5 py-3 bg-sky-50 dark:bg-sky-500/[0.12] ring-1 ring-sky-200/80 dark:ring-sky-400/20">
                  <p className="text-[12px] font-medium text-sky-700 dark:text-sky-200">
                    <span className="font-black">Proposal Due:</span> {formatInTimeZone(parseISO(calculateProposalDueDate(form.event_date, form.event_type) || ''), 'Asia/Manila', "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}

            </section>

            <section className="pt-5 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <p className="section-label">Team Assignments</p>
                </div>
                <button type="button" onClick={addAssignmentRow} className="btn-ghost text-xs px-2.5 py-1.5"><Plus className="h-3.5 w-3.5" /> Add Member</button>
              </div>
              {assignmentRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.09] bg-gray-50/70 dark:bg-white/[0.03] py-6 text-center">
                  <p className="text-xs font-medium text-gray-400 dark:text-white/30">No team members assigned yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {assignmentRows.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2 rounded-2xl border border-gray-200/80 bg-white/70 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Select value={row.role_id} onChange={v => updateAssignmentRow(i, 'role_id', v)} options={roles.filter(r => !r.is_leadership).map(r => ({ value: r.id, label: r.name }))} placeholder="Select role" />
                        <Select value={row.user_id} onChange={v => updateAssignmentRow(i, 'user_id', v)} options={getMembersForRole(row.role_id).map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} placeholder={row.role_id ? 'Select member' : 'Pick role first'} />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAssignmentRow(i)}
                        className="inline-flex min-h-[5.875rem] w-12 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100 transition-colors hover:bg-red-100 hover:text-red-600 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/15 dark:hover:bg-red-500/15 sm:min-h-11"
                        aria-label={`Remove assignment ${i + 1}`}
                        title="Remove this assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove this role and member assignment</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div
            className="z-20 flex shrink-0 items-center justify-center border-t border-black/[0.05] bg-gray-50/95 px-4 py-3 shadow-[0_-14px_28px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#1c1b1e]/95 sm:justify-end sm:px-5 sm:py-4"
            style={{ gap: '0.625rem', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <button type="button" onClick={closeCreateEvent} className="btn-secondary h-12 flex-1 max-w-[10.75rem] sm:h-auto sm:flex-none sm:min-w-24">Cancel</button>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary h-12 flex-1 max-w-[10.75rem] sm:h-auto sm:flex-none sm:min-w-32"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.28)' }}
            >
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
