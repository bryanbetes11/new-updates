import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { addDays, format, parseISO, differenceInDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { animate, motion, useMotionValue, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { ArrowLeft, Clock, Users, Plus, Check, X, Music, Send, ThumbsUp, AlertCircle, Trash2, CheckCircle, AlertTriangle, CreditCard as Edit, ClipboardCheck, Timer, Sparkles, ChevronDown, ChevronRight, Search, GripVertical, ArrowUp, ArrowDown, MessageCircle, FileText, ListOrdered, Pause, Play, Settings2, MoreHorizontal, Upload, Calendar, Loader2, BellRing, Eye, EyeOff, Lock, Unlock, Wifi, WifiOff, Smile } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { PageLoader } from '../components/LoadingSpinner';
import { RoleBadge } from '../components/RoleBadge';
import { formatTime12Hour } from '../lib/timeFormat';
import { Avatar } from '../components/Avatar';
import { dispatchBadgeCountsRefresh } from '../lib/realtimeSignals';
import { SongChartViewer } from '../components/SongChartViewer';
import { SongArtwork } from '../components/SongArtwork';
import { EventArtwork } from '../components/EventArtwork';
import { FormattedText } from '../components/FormattedText';
import { MentionTextarea } from '../components/MentionTextarea';
import { EmojiReactionPicker, type ReactionEmoji } from '../components/EmojiReactionPicker';
import { ReactionFlightAnimation, type ReactionFlightPath } from '../components/ReactionFlightAnimation';
import { VoiceKeyDetector } from '../components/VoiceKeyDetector';
import { withSaveTimeout } from '../lib/saveTimeout';
import { clearActiveServiceMode, getActiveServiceMode, saveActiveServiceMode } from '../lib/serviceModeResume';
import { describeSetlistReviewAge, getSetlistPendingMessage } from '../lib/setlistReviewAge';
import { getSingleLyricsAutofill, normalizeLyricsInputForSave, normalizeLyricsSearchResults, type LyricsSearchResult } from '../lib/lyricsSearch';
import { getEventAssignmentKey, prepareEventAssignmentBatch, type EventAssignmentDraft } from '../lib/eventAssignmentBatch';
import { hasEventScheduleEnded, isEventCompleted, type EventLifecycleOverride } from '../lib/eventLifecycle';
import { isSetlistMeaningfullyCreated } from '../lib/setlistPersistence';
import { getPendingAssignmentUserCount } from '../lib/eventAssignmentReminder';
import { getPendingUserEventAssignments, getUserEventAssignments, shouldBlockEventDetails } from '../lib/eventAssignmentGate';
import { getPostEventObservationViewers } from '../lib/postEventObservationViews';
import { normalizeSongTitle } from '../lib/songTitle';
import { calculatePolicyProposalDueDate, DEFAULT_EVENT_TEMPLATE_POLICIES, eventTemplateFor, normalizeEventTemplatePolicies, type EventTemplatePolicies, type SetlistSubmissionMode } from '../lib/eventPolicy';
import { buildSongProposalConflicts, buildSongProposalReservations, type SongProposalConflict, type SongProposalReservation, type SongProposalSetlistRow } from '../lib/songProposalConflicts';
import { getEffectiveSongLyrics, getSongLyricsSource } from '../lib/songLyrics';
import { groupEmojiReactions } from '../lib/reactions';
import { playInteractionSound } from '../lib/interactionSounds';
import { projectSongReadiness, SONG_READINESS_RULE_DAYS } from '../lib/songReadiness';

import type { Event, EventAssignment, Setlist, SetlistSong, Song, ServiceFormat, SetlistCheckReport, PostEventObservation, PostEventObservationCategory, PostEventObservationStatus, PostEventObservationView } from '../types';
import { inferServiceFormat, SERVICE_FORMAT_LABELS } from '../lib/setlistCheckerEngine';
import { SetlistReport } from '../components/setlist-checker/SetlistReport';
import { CheckingAnimation } from '../components/setlist-checker/CheckingAnimation';
import { SwapRequestModal } from '../components/SwapRequestModal';
import { ArrowLeftRight } from 'lucide-react';

interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  status: 'present' | 'late' | 'absent';
  checked_in_at: string | null;
  is_assigned: boolean;
  profiles?: { first_name: string; last_name: string; avatar_url: string | null };
}

interface SetlistRevisionComment {
  id: string;
  setlist_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  profiles?: { first_name: string; last_name: string; avatar_url: string | null } | null;
  setlist_revision_comment_reactions?: SetlistRevisionCommentReaction[];
}

interface SetlistRevisionCommentReaction {
  id: string;
  org_id: string;
  setlist_id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

type RevisionCommentReactionFlight = ReactionFlightPath & {
  commentId: string;
  token: number;
};

interface PostEventObservationReply {
  id: string;
  observation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; avatar_url: string | null } | null;
}

interface EventTeamTemplateMember {
  id: string;
  role_id: string;
  user_id: string | null;
  position: number;
}

interface EventTeamTemplate {
  id: string;
  name: string;
  description: string;
  updated_at: string;
  event_team_template_members: EventTeamTemplateMember[];
}

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaTodayKey(date = new Date()) {
  return formatInTimeZone(date, MANILA_TIMEZONE, 'yyyy-MM-dd');
}

function getManilaEventDateTime(eventDate: string, timeValue: string) {
  return new Date(`${eventDate}T${timeValue}+08:00`);
}

const blurUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const serviceSongPanelTransition = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.88 };
const serviceSwipeOffsets = [-1, 0, 1] as const;
const EVENT_CHART_OPEN_STORAGE_PREFIX = 'servesync:event-chart:open-song-id';
const ALL_MEMBERS_USER_ID = '__all_active_members__';
const MULTIPLE_MEMBERS_USER_ID = '__multiple_members__';

const POST_EVENT_CATEGORIES: Array<{ value: PostEventObservationCategory; label: string }> = [
  { value: 'sound', label: 'Sound' },
  { value: 'instruments', label: 'Instruments' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'service_flow', label: 'Service flow' },
  { value: 'team', label: 'Team' },
  { value: 'other', label: 'Other' },
];

const POST_EVENT_STATUS_LABELS: Record<PostEventObservationStatus, string> = {
  open: 'Needs action',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

const getFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
  if (!error || typeof error !== 'object') return fallback;

  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
        return (payload as { error: string }).error;
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Fall through to the generic error message.
      }
    }
  }

  if ('message' in error && typeof error.message === 'string' && !error.message.toLowerCase().includes('non-2xx')) {
    return error.message;
  }

  return fallback;
};

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

type SongUsageAge = {
  lastDate: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
};

type ApprovedSetlistUsage = {
  event_id: string;
  events: {
    title: string | null;
    event_date: string;
    event_type: string | null;
  } | Array<{
    title: string | null;
    event_date: string;
    event_type: string | null;
  }> | null;
  setlist_songs: Array<{ song_id: string }>;
};

type ReadinessDetailsSelection = {
  songId: string;
  song: Song;
  youtubeUrl: string | null;
};

type AssignmentDraftRow = EventAssignmentDraft & { id: string };

type RehearsalReadiness = 'not_rehearsed' | 'needs_work' | 'ready';
type RehearsalIssueType = 'timing' | 'chords' | 'vocals' | 'transition' | 'lyrics' | 'other';

interface EventSongPreparation {
  id: string;
  event_id: string;
  rehearsal_event_id: string | null;
  setlist_song_id: string;
  song_id: string;
  readiness: RehearsalReadiness;
  issue_type: RehearsalIssueType | null;
  note: string | null;
  updated_at: string;
}

const REHEARSAL_READINESS_OPTIONS: Array<{ value: RehearsalReadiness; label: string }> = [
  { value: 'not_rehearsed', label: 'Not rehearsed' },
  { value: 'needs_work', label: 'Needs work' },
  { value: 'ready', label: 'Ready' },
];

const REHEARSAL_ISSUE_OPTIONS: Array<{ value: RehearsalIssueType; label: string }> = [
  { value: 'timing', label: 'Timing' },
  { value: 'chords', label: 'Chords' },
  { value: 'vocals', label: 'Vocals' },
  { value: 'transition', label: 'Transition' },
  { value: 'lyrics', label: 'Lyrics' },
  { value: 'other', label: 'Other' },
];

function getServingRoleLabel(roleName: string) {
  const labels: Record<string, string> = {
    Guitar: 'Guitarist',
    Bass: 'Bassist',
    Drums: 'Drummer',
    Keys: 'Keyboardist',
    Audio: 'Audio Engineer',
    Visuals: 'Visuals Operator',
    Lights: 'Lighting Operator',
    'Backup Vocals': 'Backup Vocalist',
  };
  return labels[roleName] || roleName;
}

type SetlistBuilderSong = {
  song_id: string;
  category: string;
  youtube_url: string;
  performed_key: string;
  artist: string;
};

function formatProposalSubmissionTime(value: string) {
  try {
    return formatInTimeZone(new Date(value), 'Asia/Manila', 'MMM d, h:mm a');
  } catch {
    return 'time unavailable';
  }
}

function getProposalReservationMessage(reservation: SongProposalReservation) {
  const first = reservation.firstSubmission;
  return `${first.submitterName} already proposed this song for ${first.eventTitle} on ${formatProposalSubmissionTime(first.submittedAt)}. Choose a different song to avoid duplicate active proposals.`;
}

function SongProposalConflictBadge({ conflict, onOpen }: { conflict: SongProposalConflict; onOpen: () => void }) {
  const currentIsFirst = conflict.currentSubmission.setlistId === conflict.firstSubmission.setlistId;
  const first = conflict.firstSubmission;
  const tooltip = currentIsFirst
    ? `${first.submitterName} submitted this song first on ${formatProposalSubmissionTime(first.submittedAt)}. Open all ${conflict.totalSubmissions} proposals.`
    : `${first.submitterName} submitted this song before ${conflict.currentSubmission.submitterName}. Open all ${conflict.totalSubmissions} proposals.`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${currentIsFirst
        ? 'bg-sky-50 text-sky-700 ring-sky-200/70 hover:bg-sky-100 dark:bg-sky-950/45 dark:text-sky-300 dark:ring-sky-700/40 dark:hover:bg-sky-900/55'
        : 'bg-amber-50 text-amber-700 ring-amber-200/70 hover:bg-amber-100 dark:bg-amber-950/55 dark:text-amber-300 dark:ring-amber-700/40 dark:hover:bg-amber-900/55'} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
      title={tooltip}
      aria-label={tooltip}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">{currentIsFirst ? 'First submitted' : 'Earlier proposal'} · {first.submitterName} · {conflict.totalSubmissions} proposals</span>
    </button>
  );
}

let assignmentDraftSequence = 0;
const createAssignmentDraftRow = (): AssignmentDraftRow => ({
  id: `assignment-draft-${++assignmentDraftSequence}`,
  user_id: '',
  role_id: '',
});

function getSongReadinessBadge(usage: SongUsageAge | undefined, eventDate: string) {
  const projection = projectSongReadiness(usage?.lastDate, eventDate);
  const eventDateLabel = format(parseISO(eventDate), 'MMM d');

  if (projection.meetsRule) {
    return {
      label: `Meets · ${eventDateLabel}`,
      title: projection.daysAtTarget === null
        ? `Never used; meets the 90-day rule by ${eventDateLabel}`
        : `${projection.daysAtTarget} days since the last approved use by ${eventDateLabel}`,
      className: 'bg-green-50 text-green-700 ring-green-200/70 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-700/40',
      Icon: CheckCircle,
    };
  }

  return {
    label: `${projection.shortfallDays}d short · ${eventDateLabel}`,
    title: `${projection.daysAtTarget} days since the last approved use by ${eventDateLabel}; ${projection.shortfallDays} days short of the 90-day rule`,
    className: 'bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-700/40',
    Icon: AlertTriangle,
  };
}

const OBSERVATION_SEEN_DWELL_MS = 650;
const OBSERVATION_SEEN_RATIO = 0.35;

interface ObservationSeenCardProps {
  observationId: string;
  authorId: string;
  onSeen: (observationId: string, authorId: string) => void;
  children: ReactNode;
}

function ObservationSeenCard({ observationId, authorId, onSeen, children }: ObservationSeenCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const requestedViewRef = useRef(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || requestedViewRef.current) return;

    if (typeof IntersectionObserver === 'undefined') {
      const fallbackTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          requestedViewRef.current = true;
          onSeen(observationId, authorId);
        }
      }, OBSERVATION_SEEN_DWELL_MS);
      return () => window.clearTimeout(fallbackTimer);
    }

    let dwellTimer: number | null = null;
    let sufficientlyVisible = false;

    const cancelDwell = () => {
      if (dwellTimer !== null) {
        window.clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      sufficientlyVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= OBSERVATION_SEEN_RATIO);
      cancelDwell();
      if (!sufficientlyVisible || document.visibilityState !== 'visible' || requestedViewRef.current) return;

      dwellTimer = window.setTimeout(() => {
        dwellTimer = null;
        if (!sufficientlyVisible || document.visibilityState !== 'visible' || requestedViewRef.current) return;

        requestedViewRef.current = true;
        observer.disconnect();
        onSeen(observationId, authorId);
      }, OBSERVATION_SEEN_DWELL_MS);
    }, { threshold: [OBSERVATION_SEEN_RATIO] });

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        cancelDwell();
        return;
      }

      if (sufficientlyVisible && !requestedViewRef.current) {
        dwellTimer = window.setTimeout(() => {
          dwellTimer = null;
          if (!sufficientlyVisible || document.visibilityState !== 'visible' || requestedViewRef.current) return;

          requestedViewRef.current = true;
          observer.disconnect();
          onSeen(observationId, authorId);
        }, OBSERVATION_SEEN_DWELL_MS);
      }
    };

    observer.observe(card);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelDwell();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authorId, observationId, onSeen]);

  return (
    <div
      ref={cardRef}
      data-observation-id={observationId}
      className="rounded-2xl border border-gray-200/75 bg-white/[0.035] px-3 py-3 dark:border-white/[0.10]"
    >
      {children}
    </div>
  );
}

type ArtworkColor = { r: number; g: number; b: number };

function toArtworkColorValue(color: ArtworkColor, opacity: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
}

function getArtworkColor(url: string): Promise<ArtworkColor | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 28;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { weight: number; r: number; g: number; b: number }>();

        for (let index = 0; index < pixels.length; index += 4) {
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const alpha = pixels[index + 3];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

          // Ignore nearly black, nearly white, and grey pixels so the ambient
          // color follows the artwork rather than text, borders, or shadows.
          if (alpha < 180 || luminance < 0.13 || luminance > 0.93 || saturation < 0.16) continue;

          const bucketR = Math.round(r / 32) * 32;
          const bucketG = Math.round(g / 32) * 32;
          const bucketB = Math.round(b / 32) * 32;
          const key = `${bucketR}-${bucketG}-${bucketB}`;
          const weight = 0.45 + saturation * 1.8 + Math.min(luminance, 0.75) * 0.35;
          const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
          bucket.weight += weight;
          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          buckets.set(key, bucket);
        }

        const dominant = [...buckets.values()].sort((left, right) => right.weight - left.weight)[0];
        resolve(dominant && dominant.weight > 0
          ? {
              r: Math.round(dominant.r / dominant.weight),
              g: Math.round(dominant.g / dominant.weight),
              b: Math.round(dominant.b / dominant.weight),
            }
          : null);
      } catch {
        // Some third-party image hosts do not permit canvas reads. The blurred
        // artwork still reflects those covers, so only the color-field accent
        // is skipped for that image.
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function useArtworkAmbientColors(urls: string[]) {
  const [colors, setColors] = useState<ArtworkColor[]>([]);
  const urlKey = urls.join('|');

  useEffect(() => {
    let cancelled = false;
    if (!urlKey) {
      setColors([]);
      return undefined;
    }

    void Promise.all(urls.slice(0, 4).map(getArtworkColor)).then((sampledColors) => {
      if (cancelled) return;
      setColors(sampledColors.filter((color): color is ArtworkColor => color !== null));
    });

    return () => {
      cancelled = true;
    };
  }, [urlKey]);

  return colors;
}

export function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, profile, roles, userRoles, organization, loading: authLoading, isLeader, isOrgAdmin, isAdmin, isAdminCoordinator, isProductionDirector, isMusicDirector, isSetlistCoordinator, isPlatformOwner, canPreviewMemberView, isViewingAsMember, isViewingAsSongLeader, setViewingAsSongLeader } = useAuth();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const canUseServiceModePilot = isOrgAdmin || isAdmin || isPlatformOwner;
  const canDeleteRevisionComments = isOrgAdmin || isAdmin || isPlatformOwner;

  const isMissingSetlistSubmissionTableError = useCallback((message?: string | null) => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return lower.includes('setlist_submissions') && (
      lower.includes('schema cache') ||
      lower.includes('could not find the table') ||
      lower.includes('relation')
    );
  }, []);

  const [event, setEvent] = useState<Event | null>(null);
  const [eventArtworkUrls, setEventArtworkUrls] = useState<string[]>([]);
  const eventArtworkAmbientColors = useArtworkAmbientColors(eventArtworkUrls);
  const syncEventArtworkUrls = useCallback((urls: string[]) => {
    setEventArtworkUrls((current) => current.join('|') === urls.join('|') ? current : urls);
  }, []);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [members, setMembers] = useState<{ id: string; first_name: string; last_name: string; ministry_status: string }[]>([]);
  const [memberRoles, setMemberRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([]);
  const [linkedSetlist, setLinkedSetlist] = useState<Setlist | null>(null);
  const [linkedSetlistSongs, setLinkedSetlistSongs] = useState<SetlistSong[]>([]);
  const [linkedServiceEvent, setLinkedServiceEvent] = useState<Event | null>(null);
  const [linkedSongLeaderAssignment, setLinkedSongLeaderAssignment] = useState<EventAssignment | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingEvent, setSharingEvent] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showSetlist, setShowSetlist] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [showAddSong, setShowAddSong] = useState(false);
  const [showSongConfig, setShowSongConfig] = useState(false);
  const [selectedSongForConfig, setSelectedSongForConfig] = useState<string | null>(null);
  const [songConfig, setSongConfig] = useState({ category: '', youtube_url: '', performed_key: '', artist: '' });
  const [setlistBuilderSongs, setSetlistBuilderSongs] = useState<SetlistBuilderSong[]>([]);
  const [setlistBuilderActive, setSetlistBuilderActive] = useState(false);
  const [setlistBuilderDragIndex, setSetlistBuilderDragIndex] = useState<number | null>(null);
  const [savingSetlistBuilder, setSavingSetlistBuilder] = useState(false);
  const [showSetlistExitConfirm, setShowSetlistExitConfirm] = useState(false);
  const [assignmentDrafts, setAssignmentDrafts] = useState<AssignmentDraftRow[]>(() => [createAssignmentDraftRow()]);
  const [multiMemberSelections, setMultiMemberSelections] = useState<Record<string, string[]>>({});
  const [assigningBatch, setAssigningBatch] = useState(false);
  const [teamTemplates, setTeamTemplates] = useState<EventTeamTemplate[]>([]);
  const [selectedTeamTemplateId, setSelectedTeamTemplateId] = useState('');
  const [teamTemplateName, setTeamTemplateName] = useState('');
  const [savingTeamTemplate, setSavingTeamTemplate] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [showAssignmentReminder, setShowAssignmentReminder] = useState(false);
  const [sendingAssignmentReminder, setSendingAssignmentReminder] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', artist: '', song_key: '', duration: '', youtube_url: '' });
  const [newSongError, setNewSongError] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState<string | null>(null);
  const [respondingAssignmentId, setRespondingAssignmentId] = useState<string | null>(null);
  const [expandedDeclineNotes, setExpandedDeclineNotes] = useState<Set<string>>(new Set());
  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [showEventActionsMenu, setShowEventActionsMenu] = useState(false);
  const [mobileSongActionsSong, setMobileSongActionsSong] = useState<SetlistSong | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRevisionRequest, setShowRevisionRequest] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionComments, setRevisionComments] = useState<SetlistRevisionComment[]>([]);
  const [revisionDiscussionOverride, setRevisionDiscussionOverride] = useState<{
    setlistId: string;
    status: string;
    expanded: boolean;
  } | null>(null);
  const [revisionCommentText, setRevisionCommentText] = useState('');
  const [replyingToRevisionComment, setReplyingToRevisionComment] = useState<SetlistRevisionComment | null>(null);
  const revisionCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const [postingRevisionComment, setPostingRevisionComment] = useState(false);
  const [deletingRevisionCommentId, setDeletingRevisionCommentId] = useState<string | null>(null);
  const [revisionReactionPickerCommentId, setRevisionReactionPickerCommentId] = useState<string | null>(null);
  const [pendingRevisionReactionReveal, setPendingRevisionReactionReveal] = useState<{ commentId: string; emoji: string } | null>(null);
  const [revisionReactionLanding, setRevisionReactionLanding] = useState<{ commentId: string; emoji: string; token: number } | null>(null);
  const [revisionReactionFlight, setRevisionReactionFlight] = useState<RevisionCommentReactionFlight | null>(null);
  const revisionReactionMutationsRef = useRef(new Set<string>());
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongForm, setEditSongForm] = useState({ artist: '', category: '', youtube_url: '', performed_key: '' });
  const [savingSongEdit, setSavingSongEdit] = useState(false);
  const [songUsage, setSongUsage] = useState<Record<string, SongUsageAge>>({});
  const [readinessDetailsSong, setReadinessDetailsSong] = useState<ReadinessDetailsSelection | null>(null);
  const [readinessDetailsReturnToPicker, setReadinessDetailsReturnToPicker] = useState(false);
  const [songProposalConflicts, setSongProposalConflicts] = useState<Record<string, SongProposalConflict>>({});
  const [songProposalReservations, setSongProposalReservations] = useState<Record<string, SongProposalReservation>>({});
  const [selectedSongProposals, setSelectedSongProposals] = useState<{ songTitle: string; conflict: SongProposalConflict } | null>(null);
  const [selectedSongReservationDetails, setSelectedSongReservationDetails] = useState<{ songTitle: string; reservation: SongProposalReservation } | null>(null);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', event_type: '', event_date: '', start_time: '', end_time: '', song_leader_id: '', linked_event_id: '' });
  const [savingEventEdit, setSavingEventEdit] = useState(false);
  const [eventTemplates, setEventTemplates] = useState<EventTemplatePolicies | null>(null);
  const [setlistSubmissionMode, setSetlistSubmissionMode] = useState<SetlistSubmissionMode>('block_rejected');
  const availableEventTypes = Object.keys(eventTemplates || DEFAULT_EVENT_TEMPLATE_POLICIES);

  useEffect(() => {
    if (!profile?.org_id) return;
    let active = true;
    void supabase
      .from('organization_policy_settings')
      .select('event_templates, setlist_submission_mode')
      .eq('org_id', profile.org_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setEventTemplates(normalizeEventTemplatePolicies(data?.event_templates));
        if (data?.setlist_submission_mode === 'advisory' || data?.setlist_submission_mode === 'block_rejected') {
          setSetlistSubmissionMode(data.setlist_submission_mode);
        }
      });
    return () => { active = false; };
  }, [profile?.org_id]);
  const [savingLifecycleOverride, setSavingLifecycleOverride] = useState(false);
  const [lifecycleConfirmOverride, setLifecycleConfirmOverride] = useState<EventLifecycleOverride | null>(null);
  const [lifecycleNow, setLifecycleNow] = useState(() => new Date());
  const [sundayServices, setSundayServices] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance | null>(null);
  const [allAttendance, setAllAttendance] = useState<EventAttendance[]>([]);
  const [cardView, setCardView] = useState<'setlist' | 'checking' | 'report'>('setlist');
  const [cardDir, setCardDir] = useState<'forward' | 'back'>('forward');
  const navigateCard = (view: 'setlist' | 'checking' | 'report', dir: 'forward' | 'back' = 'forward') => {
    setCardDir(dir);
    setCardView(view);
  };
  const [checkReport, setCheckReport] = useState<SetlistCheckReport | null>(null);
  const [serviceTheme, setServiceTheme] = useState('');
  const [lyricsModalSong, setLyricsModalSong] = useState<SetlistSong | null>(null);
  const [chartModalSong, setChartModalSong] = useState<SetlistSong | null>(null);
  const [serviceModeIndex, setServiceModeIndex] = useState<number | null>(null);
  const [serviceChartEditing, setServiceChartEditing] = useState(false);
  const [serviceModeEntering, setServiceModeEntering] = useState(false);
  const [serviceModeDisplayKey, setServiceModeDisplayKey] = useState('');
  const [serviceChartControlsVisible, setServiceChartControlsVisible] = useState(false);
  const [serviceArrangementOpen, setServiceArrangementOpen] = useState(false);
  const [serviceAutoScrollEnabled, setServiceAutoScrollEnabled] = useState(false);
  const [serviceSongPickerOpen, setServiceSongPickerOpen] = useState(false);
  const [serviceCloseConfirmOpen, setServiceCloseConfirmOpen] = useState(false);
  const [servicePreparationOpen, setServicePreparationOpen] = useState(false);
  const [showRehearsalSummary, setShowRehearsalSummary] = useState(false);
  const [serviceModeUnlocked, setServiceModeUnlocked] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [songPreparation, setSongPreparation] = useState<Record<string, EventSongPreparation>>({});
  const [preparationDraft, setPreparationDraft] = useState<{ readiness: RehearsalReadiness; issue_type: RehearsalIssueType | ''; note: string }>({ readiness: 'not_rehearsed', issue_type: '', note: '' });
  const [savingPreparation, setSavingPreparation] = useState(false);
  const [serviceSongStageWidth, setServiceSongStageWidth] = useState(0);
  const [chartSaving, setChartSaving] = useState(false);
  const chartModalStorageKey = user?.id && id ? `${EVENT_CHART_OPEN_STORAGE_PREFIX}:${user.id}:${id}` : '';
  const [lyricsInput, setLyricsInput] = useState('');
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [artistPromptVisible, setArtistPromptVisible] = useState(false);
  const [artistPromptValue, setArtistPromptValue] = useState('');
  const [lyricsSearchResults, setLyricsSearchResults] = useState<LyricsSearchResult[]>([]);
  const [lyricsSearchNotice, setLyricsSearchNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [countdownParts, setCountdownParts] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });
  const [serviceFormat, setServiceFormat] = useState<ServiceFormat | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [setlistEditMode, setSetlistEditMode] = useState(false);
  const [reorderSongs, setReorderSongs] = useState<SetlistSong[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [addingSetlistSong, setAddingSetlistSong] = useState(false);
  const [creatingSong, setCreatingSong] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [eventConversationId, setEventConversationId] = useState<string | null | undefined>(undefined);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [adminOnlyChatTest, setAdminOnlyChatTest] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showPastEventDetails, setShowPastEventDetails] = useState(false);
  const [postEventObservations, setPostEventObservations] = useState<PostEventObservation[]>([]);
  const [postEventObservationReplies, setPostEventObservationReplies] = useState<PostEventObservationReply[]>([]);
  const [postEventObservationViews, setPostEventObservationViews] = useState<PostEventObservationView[]>([]);
  const [viewingObservationId, setViewingObservationId] = useState<string | null>(null);
  const [loadingObservationViews, setLoadingObservationViews] = useState(false);
  const [replyingToObservationId, setReplyingToObservationId] = useState<string | null>(null);
  const [observationReplyText, setObservationReplyText] = useState('');
  const [postingObservationReply, setPostingObservationReply] = useState(false);
  const [observationCategory, setObservationCategory] = useState<PostEventObservationCategory>('sound');
  const [observationText, setObservationText] = useState('');
  const [observationOwnerId, setObservationOwnerId] = useState('');
  const [observationDueDate, setObservationDueDate] = useState('');
  const [editingObservationFollowUpId, setEditingObservationFollowUpId] = useState<string | null>(null);
  const [observationFollowUpForm, setObservationFollowUpForm] = useState({ assigned_to: '', due_date: '' });
  const [submittingObservation, setSubmittingObservation] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const observationPromptHandledRef = useRef(false);
  const [updatingObservationId, setUpdatingObservationId] = useState<string | null>(null);
  const postEventObservationViewsRef = useRef<PostEventObservationView[]>([]);
  const pendingObservationViewsRef = useRef(new Set<string>());
  const serviceSongStageRef = useRef<HTMLDivElement | null>(null);
	const serviceModeOverlayRef = useRef<HTMLDivElement | null>(null);
  const serviceModeCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const serviceModeOpenerRef = useRef<HTMLElement | null>(null);
  const serviceSwipeAnimating = useRef(false);
  const serviceTrackAnimation = useRef<{ stop: () => void } | null>(null);
  const serviceModeClosing = useRef(false);
  const serviceTrackX = useMotionValue(0);

  useEffect(() => {
    postEventObservationViewsRef.current = postEventObservationViews;
  }, [postEventObservationViews]);

  useEffect(() => {
    const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousThemeColor = metaThemeColor?.getAttribute('content');

    document.documentElement.classList.add('event-detail-active');
    document.body.classList.add('event-detail-active');
    metaThemeColor?.setAttribute('content', '#6f6259');

    return () => {
      document.documentElement.classList.remove('event-detail-active');
      document.body.classList.remove('event-detail-active');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', previousThemeColor || '#0e0d0b');
      }
    };
  }, []);

  const resetEventDetailScroll = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useLayoutEffect(() => {
    resetEventDetailScroll();
  }, [id, resetEventDetailScroll]);

  useEffect(() => {
    setShowPastEventDetails(false);
  }, [id]);

  useEffect(() => {
    if (loading) return;
    resetEventDetailScroll();
    const frame = requestAnimationFrame(resetEventDetailScroll);
    const timer = window.setTimeout(resetEventDetailScroll, 80);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [loading, id, resetEventDetailScroll]);

  useEffect(() => {
    if (serviceModeIndex === null) return;
    const root = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    let restingViewportHeight = window.visualViewport?.height || window.innerHeight;
    const updateServiceViewportHeight = () => {
      const viewport = window.visualViewport;
      const visibleViewportHeight = viewport?.height || window.innerHeight;
      const activeElement = document.activeElement;
      const editorFocused =
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLInputElement;
      const rawKeyboardInset = viewport
        ? Math.max(0, restingViewportHeight - viewport.height - viewport.offsetTop)
        : 0;
      const keyboardOpen = editorFocused && rawKeyboardInset > 120;

      if (!keyboardOpen) {
        // Follow the currently visible viewport so browser chrome or an
        // orientation change cannot leave the chart extending off-screen.
        restingViewportHeight = visibleViewportHeight;
      }

      root.style.setProperty('--service-mode-viewport-height', `${Math.round(restingViewportHeight)}px`);
      root.style.setProperty('--service-mode-keyboard-inset', `${Math.round(keyboardOpen ? rawKeyboardInset : 0)}px`);
      root.classList.toggle('service-mode-keyboard-open', keyboardOpen);
      if (keyboardOpen) window.scrollTo(0, 0);
    };

    updateServiceViewportHeight();
    root.classList.add('service-mode-active');
    document.body.classList.add('service-mode-active');
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    window.addEventListener('resize', updateServiceViewportHeight);
    window.visualViewport?.addEventListener('resize', updateServiceViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateServiceViewportHeight);
    window.addEventListener('focusin', updateServiceViewportHeight);
    window.addEventListener('focusout', updateServiceViewportHeight);
    return () => {
      root.classList.remove('service-mode-active');
      root.classList.remove('service-mode-keyboard-open');
      document.body.classList.remove('service-mode-active');
      root.style.removeProperty('--service-mode-viewport-height');
      root.style.removeProperty('--service-mode-keyboard-inset');
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener('resize', updateServiceViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateServiceViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateServiceViewportHeight);
      window.removeEventListener('focusin', updateServiceViewportHeight);
      window.removeEventListener('focusout', updateServiceViewportHeight);
    };
  }, [serviceModeIndex]);

  useLayoutEffect(() => {
    if (serviceModeIndex === null) return;

    const updateStageWidth = () => {
      const stage = serviceSongStageRef.current;
      setServiceSongStageWidth(stage?.getBoundingClientRect().width || window.innerWidth || 0);
    };

    updateStageWidth();
    window.addEventListener('resize', updateStageWidth);

    const observer = typeof ResizeObserver === 'undefined' || !serviceSongStageRef.current
      ? null
      : new ResizeObserver(updateStageWidth);

    if (serviceSongStageRef.current) observer?.observe(serviceSongStageRef.current);

    return () => {
      window.removeEventListener('resize', updateStageWidth);
      observer?.disconnect();
    };
  }, [serviceModeIndex]);

  useEffect(() => {
    if (serviceModeIndex === null) {
      setServiceChartEditing(false);
      setServiceModeEntering(false);
      setServiceChartControlsVisible(false);
      setServiceArrangementOpen(false);
      setServiceAutoScrollEnabled(false);
      setServiceSongPickerOpen(false);
	  setServicePreparationOpen(false);
	  setShowRehearsalSummary(false);
	  setServiceModeUnlocked(false);
      setServiceCloseConfirmOpen(false);
    }
  }, [serviceModeIndex]);

  useEffect(() => {
    if (!id || authLoading || loading || serviceModeIndex !== null) return;
    if (serviceModeClosing.current) return;

    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');
    const shouldRestoreFromUrl = modeParam === 'service' || modeParam === 'rehearsal' || modeParam === 'restore';
    const savedMode = getActiveServiceMode();

    if (!canUseServiceModePilot) {
      if (savedMode?.eventId === id) clearActiveServiceMode(id);
      if (shouldRestoreFromUrl) {
        params.delete('mode');
        params.delete('song');
        const nextSearch = params.toString();
        navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
      }
      return;
    }

    const availableSongs = (event?.event_type === 'Rehearsals' && linkedSetlistSongs.length > 0
      ? linkedSetlistSongs
      : setlistSongs.length > 0
        ? setlistSongs
        : linkedSetlistSongs)
      .filter((song): song is SetlistSong => !!song && typeof song === 'object');
    if (availableSongs.length === 0) return;
    if (event?.event_type !== 'Rehearsals' && setlist?.status !== 'approved') return;

    const shouldRestoreFromStorage = savedMode?.eventId === id;
    if (!shouldRestoreFromUrl && !shouldRestoreFromStorage) return;

    const requestedIndex = Number(params.get('song') ?? savedMode?.songIndex ?? 0);
    const restoredIndex = Math.min(Math.max(Number.isFinite(requestedIndex) ? requestedIndex : 0, 0), availableSongs.length - 1);
    setServiceChartEditing(false);
    setServiceArrangementOpen(false);
    setServiceAutoScrollEnabled(false);
    setServiceModeEntering(false);
	setServiceModeUnlocked(event?.event_type === 'Rehearsals');
    setServiceModeIndex(restoredIndex);
  }, [authLoading, canUseServiceModePilot, event?.event_type, id, linkedSetlistSongs, loading, location.pathname, location.search, navigate, serviceModeIndex, setlist?.status, setlistSongs]);

  useEffect(() => {
    if (serviceChartEditing) {
      setServiceAutoScrollEnabled(false);
      setServiceArrangementOpen(false);
    }
  }, [serviceChartEditing]);

  useEffect(() => {
    if (!id || !canUseServiceModePilot || serviceModeIndex === null) return;
    if (serviceModeClosing.current) return;

    saveActiveServiceMode(id, serviceModeIndex);
    const params = new URLSearchParams(location.search);
    params.set('mode', event?.event_type === 'Rehearsals' ? 'rehearsal' : 'service');
    params.set('song', String(serviceModeIndex));
    const nextSearch = params.toString();
    const nextLocation = `${location.pathname}?${nextSearch}`;
    const currentLocation = `${location.pathname}${location.search}`;
    if (nextLocation !== currentLocation) navigate(nextLocation, { replace: true });
  }, [canUseServiceModePilot, event?.event_type, id, location.pathname, location.search, navigate, serviceModeIndex]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('mode')) serviceModeClosing.current = false;
  }, [location.search]);

  useEffect(() => {
    if (setlist?.status !== 'approved') {
      setSetlistEditMode(false);
    }
  }, [setlist?.status]);

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

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [eventRes, assignRes, membersRes, memberRolesRes, memberSettingsRes, setlistRes, songsRes, allSetlistsRes, proposalSetlistsRes, sundayServicesRes, observationsRes, observationRepliesRes, observationViewsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase.from('event_assignments').select('*, events(*), profiles(first_name, last_name, gender, avatar_url), roles(name)').eq('event_id', id),
        supabase.from('profiles').select('id, first_name, last_name, ministry_status').eq('ministry_status', 'active'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('organization_member_settings').select('user_id, include_in_assignments'),
        supabase
          .from('setlists')
          .select('*, setlist_songs(*, songs(*))')
          .eq('event_id', id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from('songs').select('*').order('title'),
        supabase.from('setlists').select('id, status, event_id, events(title, event_date, event_type), setlist_songs(song_id)').eq('status', 'approved'),
        supabase
          .from('setlists')
          .select('id, status, event_id, submitted_at, events!inner(title, event_date), submitter:profiles!setlists_created_by_fkey(first_name, last_name), setlist_songs(song_id)')
          .in('status', ['pending_review', 'approved', 'revision_requested'])
          .not('submitted_at', 'is', null)
          .gte('events.event_date', getManilaTodayKey())
          .order('submitted_at', { ascending: true }),
        supabase.from('events').select('*').eq('event_type', 'Sunday Service').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date'),
        supabase
          .from('post_event_observations')
          .select('*, profiles!post_event_observations_author_id_fkey(first_name, last_name, avatar_url), assignee:profiles!post_event_observations_assigned_to_fkey(first_name, last_name, avatar_url)')
          .eq('event_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('post_event_observation_replies')
          .select('id, observation_id, user_id, content, created_at, profiles!post_event_observation_replies_user_id_fkey(first_name, last_name, avatar_url)')
          .eq('event_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('post_event_observation_views')
          .select('observation_id, user_id, viewed_at, profiles!post_event_observation_views_user_id_fkey(first_name, last_name, avatar_url)')
          .eq('event_id', id)
          .order('viewed_at', { ascending: false }),
      ]);
      setEvent(eventRes.data);
      setAssignments(assignRes.data || []);
      const assignmentExcludedIds = new Set((memberSettingsRes.data || [])
        .filter(setting => !setting.include_in_assignments)
        .map(setting => setting.user_id));
      setMembers((membersRes.data || []).filter(member => !assignmentExcludedIds.has(member.id)));
      setMemberRoles(memberRolesRes.data || []);
      if (observationsRes.error) {
        console.error('Failed to load post-event observations:', observationsRes.error);
        setPostEventObservations([]);
      } else {
        setPostEventObservations((observationsRes.data || []) as PostEventObservation[]);
      }
      if (observationRepliesRes.error) {
        console.error('Failed to load post-event observation replies:', observationRepliesRes.error);
        setPostEventObservationReplies([]);
      } else {
        setPostEventObservationReplies((observationRepliesRes.data || []) as unknown as PostEventObservationReply[]);
      }
      if (observationViewsRes.error) {
        console.warn('Failed to load post-event observation views:', observationViewsRes.error);
        setPostEventObservationViews([]);
      } else {
        setPostEventObservationViews((observationViewsRes.data || []) as unknown as PostEventObservationView[]);
      }
      if (setlistRes.data && isSetlistMeaningfullyCreated(setlistRes.data)) {
        setSetlist(setlistRes.data);
        setSetlistSongs(setlistRes.data.setlist_songs || []);

        const { data: latestSubmission, error: latestSubmissionError } = await supabase
          .from('setlist_submissions')
          .select('report, theme')
          .eq('setlist_id', setlistRes.data.id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSubmissionError) {
          if (!isMissingSetlistSubmissionTableError(latestSubmissionError.message)) {
            console.error('Failed to load last setlist check report:', latestSubmissionError);
          }
          setCheckReport(null);
        } else if (latestSubmission?.report) {
          setCheckReport(latestSubmission.report as unknown as SetlistCheckReport);
          if (typeof latestSubmission.theme === 'string' && latestSubmission.theme.trim()) {
            setServiceTheme(prev => prev || latestSubmission.theme);
          }
        } else {
          setCheckReport(null);
        }
      } else {
        setSetlist(null);
        setSetlistSongs([]);
        setCheckReport(null);
      }
      setLinkedSetlist(null);
      setLinkedSetlistSongs([]);
      setLinkedServiceEvent(null);
      setLinkedSongLeaderAssignment(null);

      if (eventRes.data?.event_type === 'Rehearsals' && eventRes.data.linked_event_id) {
        const [linkedEventRes, linkedSetlistRes, linkedSongLeaderRes] = await Promise.all([
          supabase.from('events').select('*').eq('id', eventRes.data.linked_event_id).maybeSingle(),
          supabase.from('setlists').select('*').eq('event_id', eventRes.data.linked_event_id).maybeSingle(),
          supabase
            .from('event_assignments')
            .select('*, profiles(first_name, last_name, gender, avatar_url), roles!inner(name)')
            .eq('event_id', eventRes.data.linked_event_id)
            .eq('roles.name', 'Song Leader')
            .maybeSingle(),
        ]);
        setLinkedServiceEvent(linkedEventRes.data || null);
        setLinkedSongLeaderAssignment((linkedSongLeaderRes.data as EventAssignment | null) || null);
        if (linkedSetlistRes.data) {
          setLinkedSetlist(linkedSetlistRes.data);
          const { data: linkedSongsData } = await supabase
            .from('setlist_songs')
            .select('*, songs(*)')
            .eq('setlist_id', linkedSetlistRes.data.id)
            .order('position');
          setLinkedSetlistSongs((linkedSongsData || []) as SetlistSong[]);
        }
      }
      setSongs(songsRes.data || []);
      setSundayServices(sundayServicesRes.data || []);

      if (proposalSetlistsRes.error) {
        console.error('Failed to load competing song proposals:', proposalSetlistsRes.error);
        setSongProposalConflicts({});
        setSongProposalReservations({});
      } else {
        const proposalRows = (proposalSetlistsRes.data || []) as unknown as SongProposalSetlistRow[];
        setSongProposalConflicts(buildSongProposalConflicts(proposalRows, setlistRes.data?.id));
        setSongProposalReservations(buildSongProposalReservations(proposalRows, setlistRes.data?.id));
      }

      const usage: Record<string, SongUsageAge> = {};
      const targetEventDate = eventRes.data?.event_date;
      ((allSetlistsRes.data || []) as ApprovedSetlistUsage[]).forEach(sl => {
        if (sl.event_id === id) return;
        const usageEvent = Array.isArray(sl.events) ? undefined : sl.events;
        const eventDate = usageEvent?.event_date;
        if (!eventDate) return;
        if (targetEventDate && eventDate >= targetEventDate) return;
        (sl.setlist_songs || []).forEach(ss => {
          if (!usage[ss.song_id] || eventDate > usage[ss.song_id].lastDate) {
            usage[ss.song_id] = {
              lastDate: eventDate,
              eventId: sl.event_id,
              eventTitle: usageEvent?.title?.trim() || 'Untitled event',
              eventType: usageEvent?.event_type?.trim() || 'Event',
            };
          }
        });
      });
      setSongUsage(usage);

      if (setlistRes.data?.service_format) {
        setServiceFormat(setlistRes.data.service_format as ServiceFormat);
      } else if (eventRes.data?.event_type) {
        setServiceFormat(inferServiceFormat(eventRes.data.event_type));
      }
    } catch (error) {
      console.error('Failed to load event detail', error);
    } finally {
      setLoading(false);
    }
  }, [id, isMissingSetlistSubmissionTableError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!id) {
      setEventConversationId(null);
      return;
    }

    let active = true;
    setEventConversationId(undefined);
    void supabase
      .from('conversations')
      .select('id')
      .eq('event_id', id)
      .eq('type', 'event')
      .not('name', 'like', '[Admin Test] %')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Failed to resolve event conversation:', error);
        setEventConversationId(data?.id ?? null);
      });

    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const preparationEventId = event?.event_type === 'Rehearsals' ? event.linked_event_id : event?.id;
    if (!canUseServiceModePilot || !preparationEventId) {
      setSongPreparation({});
      return;
    }

    let cancelled = false;
    void supabase
      .from('event_song_preparation')
      .select('id, event_id, rehearsal_event_id, setlist_song_id, song_id, readiness, issue_type, note, updated_at')
      .eq('event_id', preparationEventId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to load rehearsal handoff:', error);
          setSongPreparation({});
          return;
        }
        setSongPreparation(Object.fromEntries(((data || []) as EventSongPreparation[]).map(item => [item.setlist_song_id, item])));
      });

    return () => { cancelled = true; };
  }, [canUseServiceModePilot, event?.event_type, event?.id, event?.linked_event_id]);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
    };
  }, []);

  useEffect(() => {
    if (serviceModeIndex === null) return;

    let wakeLock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const requestWakeLock = async () => {
      const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (!wakeLockApi || document.visibilityState !== 'visible') return;
      try {
        const lock = await wakeLockApi.request('screen');
        if (cancelled) await lock.release();
        else wakeLock = lock;
      } catch (error) {
        console.info('Screen wake lock is unavailable:', error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLock) void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      void wakeLock?.release();
      wakeLock = null;
    };
  }, [serviceModeIndex]);

  useEffect(() => {
    if (serviceModeIndex === null) return;
    serviceModeCloseButtonRef.current?.focus();
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
	  if (keyboardEvent.key === 'Tab') {
		const overlay = serviceModeOverlayRef.current;
		const focusable = overlay ? Array.from(overlay.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter(element => !element.closest('[aria-hidden="true"]')) : [];
		if (focusable.length > 0) {
		  const first = focusable[0];
		  const last = focusable[focusable.length - 1];
		  if (keyboardEvent.shiftKey && document.activeElement === first) {
			keyboardEvent.preventDefault();
			last.focus();
		  } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
			keyboardEvent.preventDefault();
			first.focus();
		  }
		}
		return;
	  }
      if (keyboardEvent.key !== 'Escape') return;
      keyboardEvent.preventDefault();
      if (serviceCloseConfirmOpen) setServiceCloseConfirmOpen(false);
      else if (showRehearsalSummary) setShowRehearsalSummary(false);
	  else {
		setServiceSongPickerOpen(false);
		setServiceCloseConfirmOpen(true);
	  }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [serviceCloseConfirmOpen, serviceModeIndex, showRehearsalSummary]);

  const fetchRevisionComments = useCallback(async (setlistId: string) => {
    const { data, error } = await supabase
      .from('setlist_revision_comments')
      .select('id, setlist_id, user_id, content, reply_to, created_at, profiles!setlist_revision_comments_user_id_fkey(first_name, last_name, avatar_url), setlist_revision_comment_reactions(id, org_id, setlist_id, comment_id, user_id, emoji, created_at)')
      .eq('setlist_id', setlistId)
      .order('created_at', { ascending: true });

    if (error) {
      // Access is intentionally limited by RLS. An unauthorized viewer simply sees no thread.
      setRevisionComments([]);
      return;
    }
    setRevisionComments((data || []) as unknown as SetlistRevisionComment[]);
  }, []);

  useEffect(() => {
    if (!setlist?.id) {
      setRevisionComments([]);
      return;
    }
    void fetchRevisionComments(setlist.id);
  }, [fetchRevisionComments, setlist?.id]);

  useEffect(() => {
    if (!setlist?.id) return;
    const setlistId = setlist.id;
    const channel = supabase
      .channel(`setlist-revision-discussion-${setlistId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'setlist_revision_comments', filter: `setlist_id=eq.${setlistId}` },
        () => { void fetchRevisionComments(setlistId); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'setlist_revision_comment_reactions', filter: `setlist_id=eq.${setlistId}` },
        () => { void fetchRevisionComments(setlistId); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchRevisionComments, setlist?.id]);

  useEffect(() => {
    const activeSetlistIds = [setlist?.id, linkedSetlist?.id].filter((value): value is string => Boolean(value));
    if (!id || activeSetlistIds.length === 0) return;

    const mergeSetlistSongUpdate = (updated: Partial<SetlistSong> & { id?: string }) => (song: SetlistSong): SetlistSong => {
      if (!updated.id || song.id !== updated.id) return song;
      return {
        ...song,
        ...updated,
        songs: song.songs,
      };
    };

    const mergeSongUpdate = (updated: Partial<Song> & { id?: string }) => (song: SetlistSong): SetlistSong => {
      if (!updated.id || song.song_id !== updated.id || !song.songs) return song;
      return {
        ...song,
        songs: {
          ...song.songs,
          ...updated,
        },
      };
    };

    const channel = supabase.channel(`event-detail-setlist-live-${id}-${activeSetlistIds.join('-')}`);

    activeSetlistIds.forEach(setlistId => {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'setlist_songs',
          filter: `setlist_id=eq.${setlistId}`,
        },
        payload => {
          const updated = payload.new as Partial<SetlistSong> & { id?: string };
          setSetlistSongs(prev => prev.map(mergeSetlistSongUpdate(updated)));
          setLinkedSetlistSongs(prev => prev.map(mergeSetlistSongUpdate(updated)));
          setChartModalSong(prev => {
            if (!prev || prev.id !== updated.id) return prev;
            return { ...prev, ...updated, songs: prev.songs };
          });
        }
      );
    });

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'songs',
      },
      payload => {
        const updated = payload.new as Partial<Song> & { id?: string };
        if (!updated.id) return;
        setSongs(prev => prev.map(song => song.id === updated.id ? { ...song, ...updated } : song));
        setSetlistSongs(prev => prev.map(mergeSongUpdate(updated)));
          setLinkedSetlistSongs(prev => prev.map(mergeSongUpdate(updated)));
          setChartModalSong(prev => {
            if (!prev || prev.song_id !== updated.id || !prev.songs) return prev;
            return { ...prev, songs: { ...prev.songs, ...updated } };
          });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, linkedSetlist?.id, setlist?.id]);

  useEffect(() => {
    if (!chartModalStorageKey || loading || chartModalSong) return;
    const availableSongs = [...setlistSongs, ...linkedSetlistSongs];
    if (availableSongs.length === 0) return;

    try {
      const storedSetlistSongId = localStorage.getItem(chartModalStorageKey);
      if (!storedSetlistSongId) return;
      const restoredSong = availableSongs.find(song => song.id === storedSetlistSongId);
      if (restoredSong) setChartModalSong(restoredSong);
      else localStorage.removeItem(chartModalStorageKey);
    } catch {
      // Restoring an open chart is best-effort.
    }
  }, [chartModalSong, chartModalStorageKey, linkedSetlistSongs, loading, setlistSongs]);

  const openChartModal = (song: SetlistSong) => {
    setChartModalSong(song);
    if (!chartModalStorageKey) return;
    try {
      localStorage.setItem(chartModalStorageKey, song.id);
    } catch {
      // Ignore storage failures; the modal still opens normally.
    }
  };

  const closeChartModal = () => {
    setChartModalSong(null);
    if (!chartModalStorageKey) return;
    try {
      localStorage.removeItem(chartModalStorageKey);
    } catch {
      // Ignore storage failures.
    }
  };

  const fetchAttendance = useCallback(async () => {
    if (!id || !user) return;
    const [myAttRes, allAttRes] = await Promise.all([
      supabase.from('event_attendance').select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
      isLeader
        ? supabase.from('event_attendance').select('*, profiles(first_name, last_name, avatar_url)').eq('event_id', id)
        : Promise.resolve({ data: [] }),
    ]);
    setAttendance(myAttRes.data);
    setAllAttendance(allAttRes.data || []);
  }, [id, user, isLeader]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const getAttendanceStatus = useCallback(() => {
    if (!event) return { canMark: false, reason: 'No event', windowOpen: false, isClosed: false };

    const now = new Date();
    const eventDate = parseISO(event.event_date);
    const today = parseISO(getManilaTodayKey(now));
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const daysDiff = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
      return { canMark: false, reason: 'Event is in the future', windowOpen: false, isClosed: false };
    }

    if (daysDiff < -1) {
      return { canMark: false, reason: 'Attendance closed', windowOpen: false, isClosed: true };
    }

    if (event.start_time && daysDiff === 0) {
      const eventStartTime = getManilaEventDateTime(event.event_date, event.start_time);
      const windowOpenTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);

      if (now < windowOpenTime) {
        const diffMs = windowOpenTime.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const countdown = diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`;
        return { canMark: false, reason: `Opens in ${countdown}`, windowOpen: false, isClosed: false, countdown };
      }
    }

    return { canMark: true, reason: '', windowOpen: true, isClosed: false };
  }, [event]);

  useEffect(() => {
    if (!event || !event.start_time) return;

    const calculateCountdown = () => {
      const now = new Date();
      const eventDate = parseISO(event.event_date);
      const today = parseISO(getManilaTodayKey(now));
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const daysDiff = Math.floor((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff !== 0) {
        setCountdownParts({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const eventStartTime = getManilaEventDateTime(event.event_date, event.start_time!);
      const windowOpenTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);

      const diffMs = windowOpenTime.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdownParts({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setCountdownParts({ hours: diffHours, minutes: diffMins, seconds: diffSecs });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const assignmentBatch = prepareEventAssignmentBatch(
    assignmentDrafts,
    assignments.map(assignment => ({ user_id: assignment.user_id, role_id: assignment.role_id })),
  );
  const allMembersRoleIds = new Set(roles.filter(role => role.name === 'All Members').map(role => role.id));
  const backupVocalsRoleIds = new Set(roles.filter(role => role.name === 'Backup Vocals').map(role => role.id));
  const specificallyAssignedUserIds = new Set([
    ...assignments.map(assignment => assignment.user_id),
    ...assignmentBatch.assignments
      .filter(assignment => assignment.user_id !== ALL_MEMBERS_USER_ID)
      .map(assignment => assignment.user_id),
  ]);
  const expandedEventAssignments = assignmentBatch.assignments.flatMap(assignment => {
    if (!allMembersRoleIds.has(assignment.role_id) || assignment.user_id !== ALL_MEMBERS_USER_ID) return [assignment];
    return members
      .filter(member => !specificallyAssignedUserIds.has(member.id))
      .map(member => ({ role_id: assignment.role_id, user_id: member.id }));
  }).flatMap(assignment => {
    if (!backupVocalsRoleIds.has(assignment.role_id) || assignment.user_id !== MULTIPLE_MEMBERS_USER_ID) return [assignment];
    const draft = assignmentDrafts.find(row => row.role_id === assignment.role_id && row.user_id === MULTIPLE_MEMBERS_USER_ID);
    return (draft ? multiMemberSelections[draft.id] || [] : [])
      .filter(userId => !assignments.some(existing => existing.user_id === userId && existing.role_id === assignment.role_id))
      .map(userId => ({ role_id: assignment.role_id, user_id: userId }));
  });
  const hasEmptyMultiSelection = assignmentDrafts.some(row => (
    backupVocalsRoleIds.has(row.role_id) && (multiMemberSelections[row.id]?.length || 0) === 0
  ));

  const canManageTeamTemplates = isOrgAdmin || isPlatformOwner || isAdmin || isAdminCoordinator;

  const fetchTeamTemplates = useCallback(async () => {
    if (!canManageTeamTemplates) return;
    const { data, error } = await supabase
      .from('event_team_templates')
      .select('id, name, description, updated_at, event_team_template_members(id, role_id, user_id, position)')
      .order('name');
    if (error) {
      console.error('Failed to load event team templates:', error);
      return;
    }
    setTeamTemplates((data || []).map(template => ({
      ...template,
      event_team_template_members: [...(template.event_team_template_members || [])].sort((a, b) => a.position - b.position),
    })) as EventTeamTemplate[]);
  }, [canManageTeamTemplates]);

  useEffect(() => {
    if (showAssign) void fetchTeamTemplates();
  }, [fetchTeamTemplates, showAssign]);

  const openAssignModal = () => {
    setAssignmentDrafts([createAssignmentDraftRow()]);
    setMultiMemberSelections({});
    setSelectedTeamTemplateId('');
    setTeamTemplateName('');
    setShowAssign(true);
  };

  const closeAssignModal = () => {
    if (assigningBatch) return;
    setShowAssign(false);
    setAssignmentDrafts([createAssignmentDraftRow()]);
    setMultiMemberSelections({});
  };

  const addAssignmentDraft = () => {
    setAssignmentDrafts(current => [...current, createAssignmentDraftRow()]);
  };

  const updateAssignmentDraft = (rowId: string, field: 'role_id' | 'user_id', value: string) => {
    setAssignmentDrafts(current => current.map(row => {
      if (row.id !== rowId) return row;
      if (field === 'role_id') {
        const selectedRole = roles.find(role => role.id === value);
        setMultiMemberSelections(selections => {
          const next = { ...selections };
          delete next[rowId];
          return next;
        });
        return {
          ...row,
          role_id: value,
          user_id: selectedRole?.name === 'All Members'
            ? ALL_MEMBERS_USER_ID
            : selectedRole?.name === 'Backup Vocals'
              ? MULTIPLE_MEMBERS_USER_ID
              : '',
        };
      }
      return { ...row, user_id: value };
    }));
  };

  const removeAssignmentDraft = (rowId: string) => {
    setMultiMemberSelections(selections => {
      const next = { ...selections };
      delete next[rowId];
      return next;
    });
    setAssignmentDrafts(current => current.length === 1
      ? [createAssignmentDraftRow()]
      : current.filter(row => row.id !== rowId));
  };

  const toggleMultiMember = (rowId: string, userId: string) => {
    setMultiMemberSelections(current => {
      const selected = current[rowId] || [];
      return {
        ...current,
        [rowId]: selected.includes(userId)
          ? selected.filter(id => id !== userId)
          : [...selected, userId],
      };
    });
  };

  const applyTeamTemplate = (templateId: string) => {
    setSelectedTeamTemplateId(templateId);
    const template = teamTemplates.find(item => item.id === templateId);
    if (!template) {
      setTeamTemplateName('');
      setAssignmentDrafts([createAssignmentDraftRow()]);
      return;
    }
    setTeamTemplateName(template.name);
    if (template.event_team_template_members.length === 0) {
      setAssignmentDrafts([createAssignmentDraftRow()]);
      setMultiMemberSelections({});
      return;
    }

    const nextDrafts: AssignmentDraftRow[] = [];
    const nextMultiSelections: Record<string, string[]> = {};
    const backupGroups = new Map<string, EventTeamTemplateMember[]>();
    template.event_team_template_members.forEach(member => {
      if (backupVocalsRoleIds.has(member.role_id)) {
        backupGroups.set(member.role_id, [...(backupGroups.get(member.role_id) || []), member]);
        return;
      }
      nextDrafts.push({
        id: `assignment-draft-${++assignmentDraftSequence}`,
        role_id: member.role_id,
        user_id: member.user_id || ALL_MEMBERS_USER_ID,
      });
    });
    backupGroups.forEach((templateMembers, roleId) => {
      const row = { id: `assignment-draft-${++assignmentDraftSequence}`, role_id: roleId, user_id: MULTIPLE_MEMBERS_USER_ID };
      nextDrafts.push(row);
      nextMultiSelections[row.id] = templateMembers.flatMap(member => member.user_id ? [member.user_id] : []);
    });
    setAssignmentDrafts(nextDrafts);
    setMultiMemberSelections(nextMultiSelections);
  };

  const getCompleteTemplateMembers = () => assignmentDrafts
    .filter(row => row.role_id && row.user_id)
    .flatMap((row, position) => {
      if (row.user_id === MULTIPLE_MEMBERS_USER_ID) {
        return (multiMemberSelections[row.id] || []).map(userId => ({ role_id: row.role_id, user_id: userId, position }));
      }
      return [{
        role_id: row.role_id,
        user_id: row.user_id === ALL_MEMBERS_USER_ID ? '' : row.user_id,
        position,
      }];
    });

  const saveTeamTemplate = async (mode: 'create' | 'update') => {
    if (!user || !organization || savingTeamTemplate) return;
    const name = teamTemplateName.trim();
    const templateMembers = getCompleteTemplateMembers();
    if (!name) { toast('info', 'Enter a template name first'); return; }
    if (templateMembers.length === 0) { toast('info', 'Add at least one complete role and member'); return; }
    if (assignmentDrafts.some(row => !row.role_id || !row.user_id)) { toast('info', 'Complete or remove every row before saving'); return; }
    if (hasEmptyMultiSelection) { toast('info', 'Select at least one Backup Vocalist before saving'); return; }

    setSavingTeamTemplate(true);
    try {
      if (mode === 'update' && !selectedTeamTemplateId) { toast('info', 'Select a template to update'); return; }
      const { data: templateId, error } = await supabase.rpc('save_event_team_template', {
        p_template_id: mode === 'update' ? selectedTeamTemplateId : null,
        p_name: name,
        p_members: templateMembers,
      });
      if (error || !templateId) throw error || new Error('The template was not saved.');
      setSelectedTeamTemplateId(templateId);
      toast('success', mode === 'create' ? 'Team template created' : 'Team template updated');
      await fetchTeamTemplates();
    } catch (error) {
      console.error('Failed to save team template:', error);
      toast('error', getErrorMessage(error, 'Could not save the team template'));
    } finally {
      setSavingTeamTemplate(false);
    }
  };

  const getEligibleAssignmentMembers = (roleId: string, rowId: string) => {
    if (!roleId) return [];

    const unavailableKeys = new Set([
      ...assignments.map(assignment => getEventAssignmentKey(assignment)),
      ...assignmentDrafts
        .filter(row => row.id !== rowId && row.user_id && row.role_id)
        .map(getEventAssignmentKey),
    ]);

    return members.filter(member => (
      memberRoles.some(memberRole => memberRole.user_id === member.id && memberRole.role_id === roleId) &&
      !unavailableKeys.has(getEventAssignmentKey({ user_id: member.id, role_id: roleId }))
    ));
  };

  const getAvailableAssignmentRoles = (rowId: string, currentRoleId: string) => {
    const unavailableRoleIds = new Set([
      ...assignments.map(assignment => assignment.role_id),
      ...assignmentDrafts
        .filter(row => row.id !== rowId && row.role_id)
        .map(row => row.role_id),
    ]);

    return roles.filter(role => (
      !role.is_leadership && (role.id === currentRoleId || !unavailableRoleIds.has(role.id))
    ));
  };

  const handleAssign = async () => {
    if (!id || assigningBatch) return;

    if (assignmentBatch.incompleteCount > 0) {
      toast('info', 'Complete or remove every assignment row');
      return;
    }
    if (assignmentBatch.duplicateCount > 0) {
      toast('info', 'Remove duplicate team assignments before continuing');
      return;
    }
    if (hasEmptyMultiSelection) {
      toast('info', 'Select at least one Backup Vocalist');
      return;
    }
    if (assignmentBatch.assignments.length === 0) return;
    if (expandedEventAssignments.length === 0) {
      toast('info', 'Every active member is already assigned to this event');
      return;
    }

    setAssigningBatch(true);
    try {
      const { data, error } = await withSaveTimeout(
        supabase
          .from('event_assignments')
          .insert(expandedEventAssignments.map(assignment => ({ event_id: id, ...assignment })))
          .select('id')
      );

      if (error) {
        toast('error', error.message);
        return;
      }
      if ((data?.length || 0) !== expandedEventAssignments.length) {
        toast('error', 'Some assignments could not be added. Please try again.');
        return;
      }

      const count = expandedEventAssignments.length;
      toast('success', count === 1 ? 'Member assigned' : `${count} team assignments added`);
      setShowAssign(false);
      setAssignmentDrafts([createAssignmentDraftRow()]);
      dispatchBadgeCountsRefresh();
      fetchAll();
    } catch (error) {
      console.error('Failed to assign event team:', error);
      toast('error', getErrorMessage(error, 'Could not add these team assignments'));
    } finally {
      setAssigningBatch(false);
    }
  };

  const handleConfirm = async (assignmentId: string) => {
    if (respondingAssignmentId || !user?.id) return;
    setRespondingAssignmentId(assignmentId);
    try {
      const { data, error } = await withSaveTimeout(
        supabase
          .from('event_assignments')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), decline_reason: null })
          .eq('id', assignmentId)
		  .eq('user_id', user.id)
		  .select('id, status')
		  .maybeSingle()
      );

      if (error || !data || data.status !== 'confirmed') {
		console.error('Failed to confirm assignment:', error);
        toast('error', error?.message || 'Could not confirm this assignment');
        return;
      }

      dispatchBadgeCountsRefresh();
      toast('success', 'Assignment confirmed');
      await fetchAll();
	} catch (error) {
	  console.error('Failed to confirm assignment:', error);
	  toast('error', getErrorMessage(error, 'Could not confirm this assignment'));
    } finally {
      setRespondingAssignmentId(null);
    }
  };

  const handleDecline = async (assignmentId: string) => {
    if (respondingAssignmentId) return;
    const reason = declineReason.trim();
    if (!reason) {
      toast('error', 'Please provide a reason for declining');
      return;
    }

    setRespondingAssignmentId(assignmentId);
    try {
      const { error } = await withSaveTimeout(
        supabase
          .from('event_assignments')
          .update({ status: 'declined', decline_reason: reason, confirmed_at: null })
          .eq('id', assignmentId)
      );

      if (error) {
        console.error('Failed to decline assignment:', error);
        toast('error', 'Could not decline this assignment');
        return;
      }

      dispatchBadgeCountsRefresh();
      toast('info', 'Assignment declined');
      setShowDecline(null);
      setDeclineReason('');
      await fetchAll();
    } finally {
      setRespondingAssignmentId(null);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (removingAssignmentId) return;

    setRemovingAssignmentId(assignmentId);
    try {
      const { data, error } = await withSaveTimeout(
        supabase
          .from('event_assignments')
          .delete()
          .eq('id', assignmentId)
          .select('id')
          .maybeSingle()
      );

      if (error || !data) {
        toast('error', error?.message || 'Could not remove this team member. Please check your permission and try again.');
        return;
      }

      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      dispatchBadgeCountsRefresh();
      toast('info', 'Assignment removed');
      fetchAll();
    } catch (error) {
      console.error('Failed to remove assignment:', error);
      toast('error', getErrorMessage(error, 'Could not remove this team member'));
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  const openSetlistBuilder = () => {
    setSetlistBuilderSongs([]);
    setSetlistBuilderDragIndex(null);
    setSongSearch('');
    setSetlistBuilderActive(true);
    setShowSetlist(true);
  };

  const closeSetlistBuilder = (force = false) => {
    if (savingSetlistBuilder && !force) return;
    setShowSetlist(false);
    setSetlistBuilderActive(false);
    setSetlistBuilderSongs([]);
    setSetlistBuilderDragIndex(null);
    setSongSearch('');
  };

  const requestSetlistBuilderClose = () => {
    if (savingSetlistBuilder) return;
    setShowSetlistExitConfirm(true);
  };

  const confirmSetlistBuilderClose = () => {
    setShowSetlistExitConfirm(false);
    resetSongConfigModal(false);
    closeSetlistBuilder(true);
  };

  const handleCreateSetlist = () => {
    openSetlistBuilder();
  };

  const handleSendAssignmentReminders = async () => {
    if (!id || sendingAssignmentReminder) return;

    setSendingAssignmentReminder(true);
    try {
      const { data, error } = await withSaveTimeout(
        supabase.rpc('remind_pending_event_assignments', {
          p_event_id: id,
          p_dry_run: false,
        })
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] as { pending_user_count?: number; notifications_sent?: number } | undefined : undefined;
      const pendingCount = result?.pending_user_count ?? 0;
      const sentCount = result?.notifications_sent ?? 0;

      setShowAssignmentReminder(false);
      if (pendingCount === 0) {
        toast('info', 'Everyone has already responded');
      } else if (sentCount === 0) {
        toast('info', 'Reminders were already sent within the last hour');
      } else {
        toast('success', sentCount === 1 ? 'Reminder queued for 1 pending member' : `Reminders queued for ${sentCount} pending members`);
      }
    } catch (error) {
      console.error('Failed to send assignment reminders:', error);
      toast('error', getErrorMessage(error, 'Could not send assignment reminders'));
    } finally {
      setSendingAssignmentReminder(false);
    }
  };

  const handleServiceFormatChange = async (fmt: ServiceFormat) => {
    setServiceFormat(fmt);
    if (setlist) {
      await supabase.from('setlists').update({ service_format: fmt }).eq('id', setlist.id);
    }
  };

  const enterReorderMode = () => {
    const sorted = [...setlistSongs].sort((a, b) => a.position - b.position);
    setReorderSongs(sorted);
    setIsReordering(true);
  };

  const cancelReorder = () => {
    setIsReordering(false);
    setReorderSongs([]);
    setDragIndex(null);
  };

  const saveReorder = async () => {
    setSavingOrder(true);
    const updates = reorderSongs.map((s, i) => supabase.from('setlist_songs').update({ position: i + 1 }).eq('id', s.id));
    await Promise.all(updates);
    setSetlistSongs(reorderSongs.map((s, i) => ({ ...s, position: i + 1 })));
    setIsReordering(false);
    setReorderSongs([]);
    setDragIndex(null);
    setSavingOrder(false);
    if (setlist?.status === 'approved') {
      await markSetlistNeedsReapproval();
    } else {
      toast('success', 'Song order saved');
    }
  };

  const moveReorderSong = (from: number, to: number) => {
    if (to < 0 || to >= reorderSongs.length) return;
    const arr = [...reorderSongs];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setReorderSongs(arr);
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveReorderSong(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  const markSetlistNeedsReapproval = async () => {
    if (!setlist || setlist.status !== 'approved' || !event) return true;

    const { data, error } = await withSaveTimeout(
      supabase
        .from('setlists')
        .update({ status: 'pending_review' })
        .eq('id', setlist.id)
        .select('id, status')
        .maybeSingle()
    );

    if (error || !data) {
      toast('error', error?.message || 'Setlist was updated, but could not be marked for re-approval');
      return false;
    }

    setSetlist(prev => prev ? { ...prev, status: 'pending_review' } : prev);
    toast('info', 'Setlist updated — re-approval required');
    return true;
  };

  const handleAddSongToSetlist = async (songId: string, category: string, youtubeUrl: string, performedKey: string) => {
    if (!id || !user) return null;
    let targetSetlist = setlist;

    if (!targetSetlist) {
      const fmt = serviceFormat || (event ? inferServiceFormat(event.event_type) : 'custom');
      const { data: existing, error: existingError } = await supabase
        .from('setlists')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        toast('error', existingError.message);
        return null;
      }

      if (existing) {
        targetSetlist = existing as Setlist;
      } else {
        const { data: created, error: createError } = await supabase
          .from('setlists')
          .insert({ event_id: id, created_by: user.id, service_format: fmt })
          .select('*')
          .single();

        if (createError || !created) {
          toast('error', createError?.message || 'Failed to start the setlist');
          return null;
        }
        targetSetlist = created as Setlist;
      }
    }

    const nextPosition = setlistSongs.length + 1;
    const { data, error } = await withSaveTimeout(
      supabase
        .from('setlist_songs')
        .insert({
          setlist_id: targetSetlist.id,
          song_id: songId,
          position: nextPosition,
          song_category: category,
          youtube_url: youtubeUrl.trim(),
          performed_key: performedKey,
        })
        .select('*, songs(*)')
        .single()
    );

    if (error || !data) {
      toast('error', error?.message || 'Failed to add song to setlist');
      return null;
    }

    const insertedSong = data as SetlistSong;
    setSetlist(targetSetlist);
    if (targetSetlist.service_format) setServiceFormat(targetSetlist.service_format as ServiceFormat);
    setSetlistSongs(prev => [...prev, insertedSong].sort((a, b) => a.position - b.position));

    if (targetSetlist.status === 'approved') {
      await markSetlistNeedsReapproval();
    } else {
      toast('success', 'Song added');
    }

    fetchAll();
    return insertedSong;
  };

  const openSongConfig = (songId: string) => {
    const proposalReservation = songProposalReservations[songId];
    if (proposalReservation) {
      toast('error', getProposalReservationMessage(proposalReservation));
      return;
    }
    const song = songs.find(s => s.id === songId);
    const stagedSong = setlistBuilderSongs.find(draft => draft.song_id === songId);
    setSelectedSongForConfig(songId);
    setSongConfig(stagedSong ? {
      category: stagedSong.category,
      youtube_url: stagedSong.youtube_url,
      performed_key: stagedSong.performed_key,
      artist: stagedSong.artist,
    } : { category: '', youtube_url: '', performed_key: '', artist: song?.artist || '' });
    setShowSongConfig(true);
    setShowSetlist(false);
  };

  const resetSongConfigModal = (returnToBuilder = false) => {
    setShowSongConfig(false);
    setSelectedSongForConfig(null);
    setSongConfig({ category: '', youtube_url: '', performed_key: '', artist: '' });
    if (returnToBuilder && setlistBuilderActive) setShowSetlist(true);
  };

  const closeSongConfigFlow = () => {
    if (setlistBuilderActive) {
      requestSetlistBuilderClose();
      return;
    }
    resetSongConfigModal(false);
  };

  const moveSetlistBuilderSong = (from: number, to: number) => {
    if (to < 0 || to >= setlistBuilderSongs.length) return;
    setSetlistBuilderSongs(current => {
      const next = [...current];
      const [movedSong] = next.splice(from, 1);
      next.splice(to, 0, movedSong);
      return next;
    });
  };

  const saveSetlistBuilder = async () => {
    if (!id || !user || savingSetlistBuilder || setlistBuilderSongs.length === 0) return;
    const reservedDraft = setlistBuilderSongs.find(draft => songProposalReservations[draft.song_id]);
    if (reservedDraft) {
      toast('error', getProposalReservationMessage(songProposalReservations[reservedDraft.song_id]));
      return;
    }
    const notReadyDraft = event ? setlistBuilderSongs.find(draft => {
      const usage = songUsage[draft.song_id];
      return !projectSongReadiness(usage?.lastDate, event.event_date).meetsRule;
    }) : undefined;
    if (notReadyDraft) {
      const song = songs.find(candidate => candidate.id === notReadyDraft.song_id);
      const projection = projectSongReadiness(songUsage[notReadyDraft.song_id]?.lastDate, event!.event_date);
      toast('error', `${song?.title || 'This song'} is not ready for this event. It needs ${projection.shortfallDays} more days.`);
      return;
    }
    setSavingSetlistBuilder(true);
    try {
      let targetSetlist = setlist;
      if (!targetSetlist) {
        const fmt = serviceFormat || (event ? inferServiceFormat(event.event_type) : 'custom');
        const { data: existing, error: existingError } = await supabase
          .from('setlists')
          .select('*')
          .eq('event_id', id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existingError) {
          toast('error', existingError.message);
          return;
        }

        if (existing) {
          targetSetlist = existing as Setlist;
        } else {
          const { data: created, error: createError } = await supabase
            .from('setlists')
            .insert({ event_id: id, created_by: user.id, service_format: fmt })
            .select('*')
            .single();

          if (createError || !created) {
            toast('error', createError?.message || 'Failed to start the setlist');
            return;
          }
          targetSetlist = created as Setlist;
        }
      }

      const startPosition = setlistSongs.length;
      const { data, error } = await withSaveTimeout(
        supabase
          .from('setlist_songs')
          .insert(setlistBuilderSongs.map((draft, index) => ({
            setlist_id: targetSetlist.id,
            song_id: draft.song_id,
            position: startPosition + index + 1,
            song_category: draft.category,
            youtube_url: draft.youtube_url.trim(),
            performed_key: draft.performed_key,
          })))
          .select('*, songs(*)')
      );

      if (error || !data) {
        toast('error', error?.message || 'Failed to add the selected songs');
        return;
      }

      const insertedSongs = data as SetlistSong[];
      setSetlist(targetSetlist);
      if (targetSetlist.service_format) setServiceFormat(targetSetlist.service_format as ServiceFormat);
      setSetlistSongs(current => [...current, ...insertedSongs].sort((a, b) => a.position - b.position));

      if (targetSetlist.status === 'approved') {
        await markSetlistNeedsReapproval();
      } else {
        toast('success', insertedSongs.length === 1 ? 'Song added' : `${insertedSongs.length} songs added`);
      }

      closeSetlistBuilder(true);
      await fetchAll();
    } finally {
      setSavingSetlistBuilder(false);
    }
  };

  const confirmAddSong = async () => {
    if (!selectedSongForConfig || addingSetlistSong) return;
    const proposalReservation = songProposalReservations[selectedSongForConfig];
    if (proposalReservation) {
      toast('error', getProposalReservationMessage(proposalReservation));
      return;
    }
    const selectedSong = songs.find(song => song.id === selectedSongForConfig);
    if (event) {
      const projection = projectSongReadiness(songUsage[selectedSongForConfig]?.lastDate, event.event_date);
      if (!projection.meetsRule) {
        toast('error', `${selectedSong?.title || 'This song'} cannot be added yet. It needs ${projection.shortfallDays} more days to meet the ${SONG_READINESS_RULE_DAYS}-day rule.`);
        return;
      }
    }
    const artist = songConfig.artist.trim();
    if (!artist) {
      toast('error', 'Add the artist first so everyone knows this is the correct song.');
      return;
    }
    setAddingSetlistSong(true);
    try {
      if (selectedSong && !selectedSong.artist?.trim()) {
        const { error: artistError } = await supabase
          .from('songs')
          .update({ artist })
          .eq('id', selectedSongForConfig);
        if (artistError) {
          toast('error', artistError.message || 'Could not save the artist');
          return;
        }
        setSongs(current => current.map(song => song.id === selectedSongForConfig ? { ...song, artist } : song));
      }
      if (setlistBuilderActive) {
        const stagedSong: SetlistBuilderSong = {
          song_id: selectedSongForConfig,
          category: songConfig.category,
          youtube_url: songConfig.youtube_url,
          performed_key: songConfig.performed_key,
          artist,
        };
        setSetlistBuilderSongs(current => {
          const existingIndex = current.findIndex(draft => draft.song_id === selectedSongForConfig);
          if (existingIndex === -1) return [...current, stagedSong];
          return current.map((draft, index) => index === existingIndex ? stagedSong : draft);
        });
        toast('info', 'Song added to your setlist draft');
        resetSongConfigModal(true);
      } else {
        const insertedSong = await handleAddSongToSetlist(selectedSongForConfig, songConfig.category, songConfig.youtube_url, songConfig.performed_key);
        if (insertedSong) resetSongConfigModal();
      }
    } finally {
      setAddingSetlistSong(false);
    }
  };

  const handleRemoveSongFromSetlist = async (slSongId: string) => {
    const { error } = await supabase.from('setlist_songs').delete().eq('id', slSongId);
    if (error) { toast('error', error.message); return; }
    if (setlist?.status === 'approved') {
      await markSetlistNeedsReapproval();
    }
    fetchAll();
  };

  const openEditSong = (ss: SetlistSong) => {
    setMobileSongActionsSong(null);
    setEditingSongId(ss.id);
    setEditSongForm({
      artist: ss.songs?.artist || '',
      category: ss.song_category || '',
      youtube_url: ss.youtube_url || '',
      performed_key: ss.performed_key || ss.songs?.song_key || '',
    });
  };

  const openMobileSongActions = (ss: SetlistSong) => {
    setEditingSongId(null);
    setLyricsModalSong(null);
    setChartModalSong(null);
    setMobileSongActionsSong(ss);
  };

  const openLyricsFromEditingSong = () => {
    if (!editingSongId) return;
    const targetSong = setlistSongs.find(song => song.id === editingSongId)
      || linkedSetlistSongs.find(song => song.id === editingSongId);
    if (!targetSong) return;

    setEditingSongId(null);
    openLyricsModal(targetSong);
  };

  const handleUpdateSetlistSong = async () => {
    if (!editingSongId || savingSongEdit) return;
    const originalSong = setlistSongs.find(song => song.id === editingSongId)
      || linkedSetlistSongs.find(song => song.id === editingSongId);
    if (!originalSong) return;

    const artist = editSongForm.artist.trim();
    if (!artist) {
      toast('error', 'Artist is required for every song used in a set.');
      return;
    }
    const artistChanged = (originalSong.songs?.artist || '').trim() !== artist;
    const categoryChanged = (originalSong?.song_category || '') !== editSongForm.category;
    const videoChanged = (originalSong.youtube_url || '').trim() !== editSongForm.youtube_url.trim();
    const isMetadataOnlyChange = !categoryChanged && !videoChanged;

    setSavingSongEdit(true);
    try {
      if (artistChanged) {
        const { error: artistError } = await supabase
          .from('songs')
          .update({ artist })
          .eq('id', originalSong.song_id);
        if (artistError) {
          toast('error', artistError.message || 'Failed to update artist');
          return;
        }

        const mergeArtist = (song: SetlistSong): SetlistSong => song.song_id === originalSong.song_id && song.songs
          ? { ...song, songs: { ...song.songs, artist } }
          : song;
        setSongs(current => current.map(song => song.id === originalSong.song_id ? { ...song, artist } : song));
        setSetlistSongs(current => current.map(mergeArtist));
        setLinkedSetlistSongs(current => current.map(mergeArtist));
        setChartModalSong(current => current?.song_id === originalSong.song_id && current.songs
          ? { ...current, songs: { ...current.songs, artist } }
          : current);
        setLyricsModalSong(current => current?.song_id === originalSong.song_id && current.songs
          ? { ...current, songs: { ...current.songs, artist } }
          : current);
      }

      const { error } = await supabase.from('setlist_songs').update({
        song_category: editSongForm.category,
        youtube_url: editSongForm.youtube_url.trim(),
        performed_key: editSongForm.performed_key,
      }).eq('id', editingSongId);
      if (error) {
        toast('error', artistChanged ? `Artist saved, but setlist details failed: ${error.message}` : error.message);
        return;
      }
      if (setlist?.status === 'approved' && !isMetadataOnlyChange) {
        await markSetlistNeedsReapproval();
      } else {
        toast('success', artistChanged ? 'Artist and song details updated' : isMetadataOnlyChange ? 'Song details updated' : 'Song updated');
      }
      setEditingSongId(null);
      await fetchAll();
    } finally {
      setSavingSongEdit(false);
    }
  };

  const handleCreateSong = async () => {
    if (!user || creatingSong) return;
    const title = newSong.title.trim();
    const artist = newSong.artist.trim();
    if (!title) {
      setNewSongError('Song title is required.');
      toast('error', 'Song title is required');
      return;
    }
    if (!artist) {
      setNewSongError('Artist is required so the team can identify the correct song.');
      toast('error', 'Artist is required');
      return;
    }

    const normalizedTitle = normalizeSongTitle(title);
    const localTitleMatch = songs.find(song => normalizeSongTitle(song.title) === normalizedTitle);
    if (localTitleMatch) {
      const message = `“${localTitleMatch.title}” is already in the song library${localTitleMatch.artist ? ` by ${localTitleMatch.artist}` : ''}. Select the existing song instead.`;
      setNewSongError(message);
      toast('error', 'That song already exists');
      return;
    }

    setCreatingSong(true);
    setNewSongError('');
    try {
      const { data: currentSongs, error: duplicateCheckError } = await supabase
        .from('songs')
        .select('id, title, artist');
      if (duplicateCheckError) {
        throw new Error('Could not check the song library. Please try again.');
      }
      const currentTitleMatch = currentSongs?.find(song => normalizeSongTitle(song.title) === normalizedTitle);
      if (currentTitleMatch) {
        const message = `“${currentTitleMatch.title}” is already in the song library${currentTitleMatch.artist ? ` by ${currentTitleMatch.artist}` : ''}. Select the existing song instead.`;
        setNewSongError(message);
        toast('error', 'That song already exists');
        return;
      }

      const { data, error } = await withSaveTimeout(
        supabase
          .from('songs')
          .insert({
            title,
            artist,
            song_key: newSong.song_key.trim(),
            duration: newSong.duration.trim(),
            youtube_url: newSong.youtube_url.trim(),
            created_by: user.id,
          })
          .select('id, title, artist, song_key, duration, key_notes, youtube_url, lyrics, chordpro_text, created_by, created_at')
          .single()
      );

      if (error || !data) {
        const message = error?.message || 'Failed to create song';
        setNewSongError(message);
        toast('error', message);
        return;
      }

      const createdSong = data as Song;
      setSongs(prev => [createdSong, ...prev.filter(song => song.id !== createdSong.id)]);
      setNewSong({ title: '', artist: '', song_key: '', duration: '', youtube_url: '' });
      setShowAddSong(false);
      toast('success', 'Song created');

      setSelectedSongForConfig(createdSong.id);
      setSongConfig({
        category: '',
        youtube_url: createdSong.youtube_url || '',
        performed_key: '',
        artist: createdSong.artist || '',
      });
      setShowSongConfig(true);

      fetchAll();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create song');
      setNewSongError(message);
      toast('error', message);
    } finally {
      setCreatingSong(false);
    }
  };

  const handleSetlistAction = async (action: 'pending_review' | 'approved' | 'revision_requested' | 'rejected' | 'draft', notes?: string) => {
    if (!setlist) return;
    if ((action === 'pending_review' || action === 'approved') && !ensureArtistsReady(action === 'approved' ? 'approve' : 'submit')) return;
    if (action === 'pending_review' && !ensureLyricsReady('submit')) return;
    const now = new Date().toISOString();
    const update: Record<string, string | null> = { status: action };
    const isReviewDecision = action === 'approved' || action === 'revision_requested' || action === 'rejected';
    if (action === 'approved' && user) update.approved_by = user.id;
    if (action === 'pending_review') update.submitted_at = now;
    if (isReviewDecision && user) { update.reviewed_at = now; update.reviewed_by = user.id; }
    if (notes && isReviewDecision) update.review_note = notes;
    if (action === 'revision_requested' && notes) update.approval_notes = notes;
    const { error } = await supabase.from('setlists').update(update).eq('id', setlist.id);
    if (error) { toast('error', 'Failed to update setlist'); return; }

    setSetlist({ ...setlist, status: action, review_note: (isReviewDecision && notes) ? notes : setlist.review_note, approval_notes: action === 'revision_requested' && notes ? notes : setlist.approval_notes, approved_by: action === 'approved' && user ? user.id : setlist.approved_by } as Setlist);

    const label: Record<string, string> = {
      approved: 'Setlist approved',
      pending_review: 'Submitted for review',
      revision_requested: 'Revision requested',
      rejected: 'Setlist rejected',
      draft: 'Reverted to draft',
    };
    toast(action === 'approved' ? 'success' : action === 'rejected' ? 'error' : 'info', label[action] || 'Setlist updated');
    fetchAll();
  };

  const handleRevisionRequest = async () => {
    await handleSetlistAction('revision_requested', revisionReason);
    setShowRevisionRequest(false);
    setRevisionReason('');
  };

  const handlePostRevisionComment = async () => {
    const content = revisionCommentText.trim();
    if (!setlist || !user || !content || postingRevisionComment) return;

    setPostingRevisionComment(true);
    const { error } = await supabase.from('setlist_revision_comments').insert({
      setlist_id: setlist.id,
      user_id: user.id,
      content,
      reply_to: replyingToRevisionComment?.id || null,
    });

    if (error) {
      toast('error', error.message || 'Could not add the revision comment');
    } else {
      setRevisionCommentText('');
      setReplyingToRevisionComment(null);
      await fetchRevisionComments(setlist.id);
      toast('success', replyingToRevisionComment ? 'Reply added' : 'Comment added');
    }
    setPostingRevisionComment(false);
  };

  const handleDeleteRevisionComment = async (comment: SetlistRevisionComment) => {
    if (!setlist || !canDeleteRevisionComments || deletingRevisionCommentId) return;

    const hasReplies = revisionComments.some(reply => reply.reply_to === comment.id);
    const prompt = hasReplies
      ? 'Delete this comment and all replies to it? This cannot be undone.'
      : 'Delete this comment? This cannot be undone.';
    if (!window.confirm(prompt)) return;

    setDeletingRevisionCommentId(comment.id);
    const { data, error } = await supabase
      .from('setlist_revision_comments')
      .delete()
      .eq('id', comment.id)
      .select('id');

    if (error) {
      toast('error', error.message || 'Could not delete the revision comment');
    } else if (!data?.length) {
      toast('error', 'The comment could not be deleted or is no longer available');
    } else {
      if (replyingToRevisionComment?.id === comment.id) {
        setReplyingToRevisionComment(null);
        setRevisionCommentText('');
      }
      await fetchRevisionComments(setlist.id);
      toast('success', hasReplies ? 'Comment and replies deleted' : 'Comment deleted');
    }
    setDeletingRevisionCommentId(null);
  };

  const handleRevisionCommentReaction = async (
    comment: SetlistRevisionComment,
    emoji: ReactionEmoji,
    sourceElement?: HTMLElement,
  ) => {
    if (!user || !setlist) return;
    if (revisionReactionMutationsRef.current.has(comment.id)) return;

    revisionReactionMutationsRef.current.add(comment.id);
    const previousReactions = comment.setlist_revision_comment_reactions || [];
    const existing = previousReactions.find(reaction => reaction.user_id === user.id && reaction.emoji === emoji);
    const optimisticId = `optimistic-${comment.id}-${user.id}-${emoji}`;
    const reactionRoot = sourceElement?.closest<HTMLElement>('[data-revision-comment-reaction-root]') || null;
    const rootRect = reactionRoot?.getBoundingClientRect();
    const sourceRect = sourceElement?.getBoundingClientRect();
    const flightOrigin = rootRect && sourceRect
      ? {
          x: sourceRect.left - rootRect.left + sourceRect.width / 2,
          y: sourceRect.top - rootRect.top + sourceRect.height / 2,
        }
      : null;
    const shouldAnimateFlight = !existing && !prefersReducedMotion && Boolean(reactionRoot && flightOrigin);

    if (shouldAnimateFlight) {
      setPendingRevisionReactionReveal({ commentId: comment.id, emoji });
    }

    setRevisionComments(current => current.map(item => item.id === comment.id
      ? {
          ...item,
          setlist_revision_comment_reactions: existing
            ? (item.setlist_revision_comment_reactions || []).filter(reaction => reaction.id !== existing.id)
            : [
                ...(item.setlist_revision_comment_reactions || []),
                {
                  id: optimisticId,
                  org_id: profile?.org_id || '',
                  setlist_id: setlist.id,
                  comment_id: comment.id,
                  user_id: user.id,
                  emoji,
                  created_at: new Date().toISOString(),
                },
              ],
        }
      : item));

    if (shouldAnimateFlight && reactionRoot && flightOrigin) {
      const locateFlightTarget = (attempt = 0) => {
        window.requestAnimationFrame(() => {
          const target = Array.from(reactionRoot.querySelectorAll<HTMLElement>('[data-revision-reaction-emoji]'))
            .find(element => element.dataset.revisionReactionEmoji === emoji);
          if (!target && attempt < 3) {
            locateFlightTarget(attempt + 1);
            return;
          }
          if (!target) {
            setPendingRevisionReactionReveal(null);
            setRevisionReactionPickerCommentId(null);
            return;
          }
          const currentRootRect = reactionRoot.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          setRevisionReactionFlight({
            commentId: comment.id,
            emoji,
            token: Date.now(),
            from: flightOrigin,
            to: {
              x: targetRect.left - currentRootRect.left + targetRect.width / 2,
              y: targetRect.top - currentRootRect.top + targetRect.height / 2,
            },
          });
        });
      };
      locateFlightTarget();
    } else {
      setRevisionReactionPickerCommentId(null);
    }

    try {
      const { data, error } = existing
        ? await supabase
            .from('setlist_revision_comment_reactions')
            .delete()
            .eq('id', existing.id)
            .select('id')
            .maybeSingle()
        : await supabase
            .from('setlist_revision_comment_reactions')
            .insert({ setlist_id: setlist.id, comment_id: comment.id, user_id: user.id, emoji })
            .select('id, org_id, setlist_id, comment_id, user_id, emoji, created_at')
            .single();

      if (error || (existing && !data)) {
        throw error || new Error('The reaction was not removed.');
      }

      if (!existing && data) {
        setRevisionComments(current => current.map(item => item.id === comment.id
          ? {
              ...item,
              setlist_revision_comment_reactions: (item.setlist_revision_comment_reactions || []).map(reaction =>
                reaction.id === optimisticId ? data as SetlistRevisionCommentReaction : reaction
              ),
            }
          : item));
      }
      if (existing) playInteractionSound('reactionRemove');
      else if (!shouldAnimateFlight) playInteractionSound('reactionLand');
    } catch (error) {
      console.error('Update setlist revision comment reaction error:', error);
      setRevisionComments(current => current.map(item => item.id === comment.id
        ? { ...item, setlist_revision_comment_reactions: previousReactions }
        : item));
      setRevisionReactionFlight(current => current?.commentId === comment.id ? null : current);
      setPendingRevisionReactionReveal(current => current?.commentId === comment.id ? null : current);
      setRevisionReactionLanding(current => current?.commentId === comment.id ? null : current);
      setRevisionReactionPickerCommentId(null);
      toast('error', 'Could not update reaction');
    } finally {
      revisionReactionMutationsRef.current.delete(comment.id);
      await fetchRevisionComments(setlist.id);
    }
  };

  const handleRevisionReactionFlightComplete = (completedFlight: RevisionCommentReactionFlight) => {
    const landing = {
      commentId: completedFlight.commentId,
      emoji: completedFlight.emoji,
      token: completedFlight.token,
    };
    setPendingRevisionReactionReveal(current => current?.commentId === completedFlight.commentId ? null : current);
    setRevisionReactionLanding(landing);
    setRevisionReactionFlight(current => current?.token === completedFlight.token ? null : current);
    setRevisionReactionPickerCommentId(current => current === completedFlight.commentId ? null : current);
    playInteractionSound('reactionLand');
    window.setTimeout(() => {
      setRevisionReactionLanding(current => current?.token === landing.token ? null : current);
    }, 420);
  };

  const handleReject = async () => {
    await handleSetlistAction('rejected', rejectReason);
    setShowRejectModal(false);
    setRejectReason('');
  };

  const handleCreateChat = async () => {
    if (!id) return;
    if (eventConversationId && !adminOnlyChatTest) {
      setShowCreateChatModal(false);
      navigate(`/messages/${eventConversationId}`);
      return;
    }
    setCreatingChat(true);
    const rpcName = adminOnlyChatTest
      ? 'create_admin_test_event_conversation'
      : 'create_event_conversation';
    const { data, error } = await supabase.rpc(rpcName, { p_event_id: id });
    setCreatingChat(false);
    if (error || !data) {
      toast('error', error?.message || 'Failed to create group chat');
      return;
    }
    setShowCreateChatModal(false);
    setAdminOnlyChatTest(false);
    if (!adminOnlyChatTest) setEventConversationId(data as string);
    navigate(`/messages/${data}`);
  };

  const startRevisionCommentReply = (comment: SetlistRevisionComment) => {
    setReplyingToRevisionComment(comment);
    const mentionHandle = [comment.profiles?.first_name, comment.profiles?.last_name]
      .filter(Boolean)
      .join('_');
    if (mentionHandle) {
      setRevisionCommentText(current => {
        const mention = `@${mentionHandle}`;
        if (current.trimStart().startsWith(mention)) return current;
        return `${mention} ${current}`;
      });
    }
    window.setTimeout(() => {
      const input = revisionCommentInputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  };

  const handleDeleteEvent = async () => {
    if (!id) return;
    setDeleting(true);

    // Related event records use ON DELETE CASCADE/SET NULL constraints, so one
    // database operation keeps the deletion atomic. Returning the row also lets
    // us detect an RLS denial, which otherwise looks like a successful no-op.
    const { data: deletedEvent, error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    setDeleting(false);
    if (error || !deletedEvent) {
      console.error('Failed to delete event:', error || 'The event was not deleted');
      toast('error', 'Failed to delete event');
      return;
    }
    setShowDeleteEvent(false);
    toast('success', 'Event deleted');
    navigate('/events', {
      replace: true,
      state: { deletedEventId: id, refreshEventsAt: Date.now() },
    });
  };

  const handleLifecycleOverride = async (override: EventLifecycleOverride) => {
    if (!id || !user || !isPlatformOwner || (!heroIsPast && !heroScheduleEnded) || savingLifecycleOverride) return;

    setSavingLifecycleOverride(true);
    const overrideMetadata = {
      lifecycle_override: override,
      lifecycle_override_by: user.id,
      lifecycle_override_at: new Date().toISOString(),
    };
    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update(overrideMetadata)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    setSavingLifecycleOverride(false);

    if (error || !updatedEvent) {
      console.error('Failed to update event lifecycle:', error || 'The event was not updated');
      toast('error', 'Failed to update event status');
      return;
    }

    setEvent(updatedEvent as Event);
    setLifecycleConfirmOverride(null);
    setShowEventActionsMenu(false);
    toast('success', override === 'completed'
      ? 'Event moved to Past events'
      : 'Event moved to Upcoming');
  };


const openLyricsModal = (ss: SetlistSong) => {
    setMobileSongActionsSong(null);
    setLyricsModalSong(ss);
    setLyricsInput(ss.songs?.lyrics || '');
    setLyricsSearchResults([]);
    setLyricsSearchNotice(null);
  };

  const persistCheckReport = useCallback(async (report: SetlistCheckReport) => {
    if (!setlist || !user) return;

    const { error } = await supabase.from('setlist_submissions').insert({
      user_id: user.id,
      setlist_id: setlist.id,
      theme: serviceTheme.trim(),
      songs: setlistSongs.map(ss => ({
        id: ss.id,
        song_id: ss.song_id,
        title: ss.songs?.title || '',
        artist: ss.songs?.artist || '',
        slot: ss.song_category || '',
        lyrics: ss.songs?.lyrics || '',
      })),
      report,
      verdict: report.verdict,
      rating: report.rating,
    });

    if (error) {
      console.error('Failed to persist setlist check report:', error);
      if (!isMissingSetlistSubmissionTableError(error.message)) {
        toast('warning', error.message || 'Checked setlist, but failed to save the last result');
      }
    }
  }, [isMissingSetlistSubmissionTableError, serviceTheme, setlist, setlistSongs, toast, user]);

  const handleFindLyrics = async (artistOverride?: string) => {
    if (!lyricsModalSong) return;
    const title = lyricsModalSong.songs?.title?.trim() || '';
    const artist = artistOverride !== undefined ? artistOverride : (lyricsModalSong.songs?.artist?.trim() || '');
    if (!title) {
      toast('error', 'Song title is required to find lyrics');
      return;
    }

    setArtistPromptVisible(false);
    setLyricsSearchResults([]);
    setLyricsSearchNotice(null);
    setFetchingLyrics(true);
    const { data, error } = await supabase.functions.invoke('fetch-lyrics-from-link', {
      body: {
        title,
        artist,
      },
    });
    setFetchingLyrics(false);

    if (error) {
      console.error('Failed to find lyrics:', error);
      const message = await getFunctionErrorMessage(error, 'No lyrics found for this song');
      setLyricsSearchNotice({
        type: message.toLowerCase().includes('no lyrics found') ? 'info' : 'error',
        text: message,
      });
      return;
    }

    const results = normalizeLyricsSearchResults(data);
    if (results.length === 0) {
      setLyricsSearchNotice({ type: 'info', text: 'No lyrics found for this song. You can paste lyrics manually below.' });
      return;
    }

    setLyricsSearchResults(results);
    setLyricsSearchNotice({
      type: 'success',
      text: `Found ${results.length} lyrics result${results.length > 1 ? 's' : ''}. Choose one below to fill the lyrics box.`,
    });
    const autofillLyrics = getSingleLyricsAutofill(results);
    if (autofillLyrics) {
      setLyricsInput(autofillLyrics);
    }
  };

  const handleSaveLyrics = async () => {
    if (!lyricsModalSong) return;
    setSavingLyrics(true);
    const trimmed = normalizeLyricsInputForSave(lyricsInput);
    const { error } = await supabase.from('songs').update({ lyrics: trimmed }).eq('id', lyricsModalSong.song_id);
    setSavingLyrics(false);
    if (error) {
      console.error('Failed to save lyrics:', error);
      toast('error', error.message || 'Failed to save lyrics');
      return;
    }
    setSetlistSongs(prev => prev.map(s =>
      s.song_id === lyricsModalSong.song_id
        ? { ...s, songs: s.songs ? { ...s.songs, lyrics: trimmed } : s.songs }
        : s
    ));
    toast('success', 'Lyrics saved');
    setLyricsModalSong(null);
    setLyricsSearchNotice(null);
  };

  const getSetlistSongChartText = (song: SetlistSong | null | undefined) =>
    song?.songs?.chordpro_text ?? null;

  const handleSaveChart = async (songId: string, text: string, assignedSongKey?: string) => {
    setChartSaving(true);
    try {
      const { data, error } = await withSaveTimeout(
        supabase
          .from('songs')
          .update({
            chordpro_text: text,
            ...(assignedSongKey ? { song_key: assignedSongKey.trim() } : {}),
          })
          .eq('id', songId)
          .select('id, chordpro_text, song_key')
          .maybeSingle()
      );

      if (error || !data) {
        const message = error?.message || 'No song chart was updated';
        console.error('Failed to save chart:', error);
        throw new Error(message);
      }

      setSetlistSongs(prev => prev.map(s =>
        s.song_id === songId
          ? { ...s, songs: s.songs ? { ...s.songs, chordpro_text: data.chordpro_text, song_key: data.song_key || s.songs.song_key } : s.songs }
          : s
      ));
      setLinkedSetlistSongs(prev => prev.map(s =>
        s.song_id === songId
          ? { ...s, songs: s.songs ? { ...s.songs, chordpro_text: data.chordpro_text, song_key: data.song_key || s.songs.song_key } : s.songs }
          : s
      ));
      setChartModalSong(prev => prev?.song_id === songId ? { ...prev, songs: prev.songs ? { ...prev.songs, chordpro_text: data.chordpro_text, song_key: data.song_key || prev.songs.song_key } : prev.songs } : prev);
      toast('success', assignedSongKey ? `Song chart saved in key ${assignedSongKey.trim()}` : 'Song chart saved');
    } catch (error: unknown) {
      console.error('Failed to save chart:', error);
      toast('error', getErrorMessage(error, 'Failed to save chart'));
      throw error;
    } finally {
      setChartSaving(false);
    }
  };

  const handleSaveSetlistSongSectionOrder = async (setlistSongId: string, order: string[] | null) => {
    const { data, error } = await withSaveTimeout(
      supabase
        .from('setlist_songs')
        .update({ arrangement_section_order: order })
        .eq('id', setlistSongId)
        .select('id, arrangement_section_order')
        .maybeSingle()
    );

    if (error || !data) {
      const message = error?.message || 'No arrangement was updated';
      console.error('Failed to save section order:', error);
      toast('error', message);
      throw new Error(message);
    }

    setSetlistSongs(prev => prev.map(s =>
      s.id === setlistSongId
        ? { ...s, arrangement_section_order: data.arrangement_section_order }
        : s
    ));
    setLinkedSetlistSongs(prev => prev.map(s =>
      s.id === setlistSongId
        ? { ...s, arrangement_section_order: data.arrangement_section_order }
        : s
    ));
    setChartModalSong(prev => prev?.id === setlistSongId ? { ...prev, arrangement_section_order: data.arrangement_section_order } : prev);
    toast('success', order?.length ? 'Arrangement saved' : 'Default arrangement restored');
  };

  const calculateProposalDueDate = (eventDate: string, eventType: string): string | null => calculatePolicyProposalDueDate(eventDate, eventType, eventTemplates);

  const getDefaultTimes = (eventType: string): { start: string; end: string } => {
    const template = eventTemplateFor(eventType, eventTemplates);
    return { start: template.start_time, end: template.end_time };
  };

  const openEditEvent = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      event_date: event.event_date,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      song_leader_id: event.song_leader_id || '',
      linked_event_id: event.linked_event_id || '',
    });
    setShowEditEvent(true);
  };

  const handleEditEventTypeChange = (newType: string) => {
    const times = getDefaultTimes(newType);
    setEditForm(prev => ({
      ...prev,
      event_type: newType,
      start_time: times.start,
      end_time: times.end,
      song_leader_id: '',
      linked_event_id: '',
    }));
  };

  const missingLyricsSongs = setlistSongs.filter(ss => !getEffectiveSongLyrics(ss.songs));
  const hasMissingLyrics = missingLyricsSongs.length > 0;
  const missingLyricsLabel = missingLyricsSongs
    .map(ss => ss.songs?.title || 'Untitled song')
    .slice(0, 3)
    .join(', ');

  const ensureLyricsReady = useCallback((action: 'check' | 'submit') => {
    if (!hasMissingLyrics) return true;

    const actionLabel = action === 'check' ? 'check' : 'submit';
    const moreCount = missingLyricsSongs.length - Math.min(missingLyricsSongs.length, 3);
    const suffix = moreCount > 0 ? ` and ${moreCount} more` : '';

    toast('error', `Add lyrics first before you can ${actionLabel} this setlist. Missing lyrics: ${missingLyricsLabel}${suffix}.`);
    return false;
  }, [hasMissingLyrics, missingLyricsLabel, missingLyricsSongs.length, toast]);

  const missingArtistSongs = setlistSongs.filter(ss => !ss.songs?.artist?.trim());
  const ensureArtistsReady = (action: 'check' | 'submit' | 'approve') => {
    if (missingArtistSongs.length === 0) return true;

    const firstSong = missingArtistSongs[0];
    const names = missingArtistSongs
      .map(ss => ss.songs?.title || 'Untitled song')
      .slice(0, 3)
      .join(', ');
    const moreCount = Math.max(0, missingArtistSongs.length - 3);
    toast('error', `Add an artist before you ${action} this set. Missing artist: ${names}${moreCount ? ` and ${moreCount} more` : ''}.`);
    if (firstSong) openEditSong(firstSong);
    return false;
  };

  const getSongLeaders = () => {
    const songLeaderRole = roles.find(r => r.name === 'Song Leader');
    if (!songLeaderRole) return [];
    const songLeaderUserIds = memberRoles.filter(ur => ur.role_id === songLeaderRole.id).map(ur => ur.user_id);
    return members.filter(m => songLeaderUserIds.includes(m.id));
  };

  const generateEventTitle = async (songLeaderId: string | null | undefined, eventType: string): Promise<string> => {
    if (songLeaderId && songLeaderId.trim() !== '') {
      const songLeader = members.find(m => m.id === songLeaderId);
      if (songLeader) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', songLeaderId)
          .maybeSingle();

        const prefix = profileData?.gender === 'male' ? 'Bro.' : profileData?.gender === 'female' ? 'Sis.' : '';
        return prefix ? `${prefix} ${songLeader.first_name}` : songLeader.first_name;
      }
    }
    return eventType;
  };

  const handleEditEvent = async () => {
    if (!id || savingEventEdit) return;
    setSavingEventEdit(true);
    try {
      const title = await generateEventTitle(editForm.song_leader_id, editForm.event_type);
      const proposalDueDate = calculateProposalDueDate(editForm.event_date, editForm.event_type);

      const { error } = await supabase.from('events').update({
        title,
        description: editForm.description || null,
        event_type: editForm.event_type,
        event_date: editForm.event_date,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        song_leader_id: editForm.song_leader_id || null,
        linked_event_id: editForm.linked_event_id || null,
        proposal_due_date: proposalDueDate,
      }).eq('id', id);
      if (error) {
        toast('error', getErrorMessage(error, 'Failed to update event'));
        return;
      }
      toast('success', 'Event updated');
      setShowEditEvent(false);
      fetchAll();
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to update event'));
    } finally {
      setSavingEventEdit(false);
    }
  };

  const refreshPostEventObservations = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('post_event_observations')
      .select('*, profiles!post_event_observations_author_id_fkey(first_name, last_name, avatar_url), assignee:profiles!post_event_observations_assigned_to_fkey(first_name, last_name, avatar_url)')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPostEventObservations((data || []) as PostEventObservation[]);
  };

  const refreshPostEventObservationReplies = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('post_event_observation_replies')
      .select('id, observation_id, user_id, content, created_at, profiles!post_event_observation_replies_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setPostEventObservationReplies((data || []) as unknown as PostEventObservationReply[]);
  };

  const refreshPostEventObservationViews = useCallback(async () => {
    if (!id) return [];

    const { data, error } = await supabase
      .from('post_event_observation_views')
      .select('observation_id, user_id, viewed_at, profiles!post_event_observation_views_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('event_id', id)
      .order('viewed_at', { ascending: false });

    if (error) throw error;
    const views = (data || []) as unknown as PostEventObservationView[];
    postEventObservationViewsRef.current = views;
    setPostEventObservationViews(views);
    return views;
  }, [id]);

  const handleObservationSeen = useCallback(async (observationId: string, authorId: string) => {
    const viewerId = user?.id;
    if (
      !viewerId ||
      viewerId === authorId ||
      pendingObservationViewsRef.current.has(observationId) ||
      postEventObservationViewsRef.current.some(view => view.observation_id === observationId && view.user_id === viewerId)
    ) return;

    pendingObservationViewsRef.current.add(observationId);
    try {
      const { data: inserted, error } = await supabase.rpc('record_post_event_observation_view', {
        p_observation_id: observationId,
      });
      if (error) throw error;

      if (inserted) {
        const newView: PostEventObservationView = {
          observation_id: observationId,
          user_id: viewerId,
          viewed_at: new Date().toISOString(),
          profiles: profile ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
          } : null,
        };
        setPostEventObservationViews(current => {
          if (current.some(view => view.observation_id === observationId && view.user_id === viewerId)) return current;
          const next = [newView, ...current];
          postEventObservationViewsRef.current = next;
          return next;
        });
      } else if (!postEventObservationViewsRef.current.some(view => view.observation_id === observationId && view.user_id === viewerId)) {
        await refreshPostEventObservationViews();
      }
    } catch (error) {
      console.warn('Failed to record post-event observation view:', error);
    } finally {
      pendingObservationViewsRef.current.delete(observationId);
    }
  }, [profile, refreshPostEventObservationViews, user?.id]);

  const handleOpenObservationViewers = useCallback((observationId: string) => {
    setViewingObservationId(observationId);
    setLoadingObservationViews(true);
    void refreshPostEventObservationViews()
      .catch(error => {
        console.error('Failed to refresh post-event observation viewers:', error);
        toast('error', 'Failed to load who has seen this observation');
      })
      .finally(() => setLoadingObservationViews(false));
  }, [refreshPostEventObservationViews, toast]);

  const handlePostObservationReply = async (observationId: string) => {
    const content = observationReplyText.trim();
    if (!id || !user || !content || postingObservationReply) return;

    setPostingObservationReply(true);
    try {
      const { error } = await supabase.from('post_event_observation_replies').insert({
        observation_id: observationId,
        event_id: id,
        user_id: user.id,
        content,
      });
      if (error) throw error;
      setObservationReplyText('');
      setReplyingToObservationId(null);
      await refreshPostEventObservationReplies();
      toast('success', 'Reply added');
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to add reply'));
    } finally {
      setPostingObservationReply(false);
    }
  };

  const handleAddPostEventObservation = async () => {
    const trimmedObservation = observationText.trim();
    if (!id || !user || !trimmedObservation || submittingObservation) return;
    if (canManagePostEventObservations && Boolean(observationOwnerId) !== Boolean(observationDueDate)) {
      toast('error', 'Choose both an owner and a due date, or leave both blank.');
      return;
    }

    setSubmittingObservation(true);
    try {
      const { error } = await supabase.from('post_event_observations').insert({
        event_id: id,
        author_id: user.id,
        category: observationCategory,
        observation: trimmedObservation,
        assigned_to: canManagePostEventObservations ? observationOwnerId || null : null,
        due_date: canManagePostEventObservations ? observationDueDate || null : null,
      });

      if (error) throw error;
      setObservationText('');
      setObservationOwnerId('');
      setObservationDueDate('');
      setShowObservationModal(false);
      await refreshPostEventObservations();
      toast('success', 'Observation added');
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to add observation'));
    } finally {
      setSubmittingObservation(false);
    }
  };

  const openObservationFollowUp = (observation: PostEventObservation) => {
    setEditingObservationFollowUpId(observation.id);
    setObservationFollowUpForm({
      assigned_to: observation.assigned_to || '',
      due_date: observation.due_date || '',
    });
  };

  const handleSaveObservationFollowUp = async () => {
    if (!editingObservationFollowUpId || updatingObservationId || !canManagePostEventObservations) return;
    if (Boolean(observationFollowUpForm.assigned_to) !== Boolean(observationFollowUpForm.due_date)) {
      toast('error', 'Choose both an owner and a due date, or clear both.');
      return;
    }

    setUpdatingObservationId(editingObservationFollowUpId);
    try {
      const { error } = await supabase
        .from('post_event_observations')
        .update({
          assigned_to: observationFollowUpForm.assigned_to || null,
          due_date: observationFollowUpForm.due_date || null,
        })
        .eq('id', editingObservationFollowUpId);
      if (error) throw error;

      await refreshPostEventObservations();
      setEditingObservationFollowUpId(null);
      toast('success', observationFollowUpForm.assigned_to ? 'Follow-up assigned' : 'Follow-up assignment cleared');
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to update follow-up assignment'));
    } finally {
      setUpdatingObservationId(null);
    }
  };

  const handleUpdateObservationStatus = async (observationId: string, status: PostEventObservationStatus) => {
    if (!user || updatingObservationId) return;

    setUpdatingObservationId(observationId);
    try {
      const resolution = status === 'resolved'
        ? { resolved_at: new Date().toISOString(), resolved_by: user.id }
        : { resolved_at: null, resolved_by: null };
      const { error } = await supabase
        .from('post_event_observations')
        .update({ status, ...resolution })
        .eq('id', observationId);

      if (error) throw error;
      setPostEventObservations(current => current.map(observation => (
        observation.id === observationId
          ? { ...observation, status, ...resolution, updated_at: new Date().toISOString() }
          : observation
      )));
      toast('success', `Marked as ${POST_EVENT_STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to update observation'));
    } finally {
      setUpdatingObservationId(null);
    }
  };

  const handleDeletePostEventObservation = async (observationId: string) => {
    if (updatingObservationId || !window.confirm('Delete this observation?')) return;

    setUpdatingObservationId(observationId);
    try {
      const { error } = await supabase.from('post_event_observations').delete().eq('id', observationId);
      if (error) throw error;
      setPostEventObservations(current => current.filter(observation => observation.id !== observationId));
      setPostEventObservationViews(current => current.filter(view => view.observation_id !== observationId));
      setViewingObservationId(current => current === observationId ? null : current);
      toast('success', 'Observation deleted');
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to delete observation'));
    } finally {
      setUpdatingObservationId(null);
    }
  };

  useEffect(() => {
    if (!event || observationPromptHandledRef.current) return;
    if (!isEventCompleted(event) && !hasEventScheduleEnded(event, lifecycleNow)) return;

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('addObservation') !== '1') return;

    observationPromptHandledRef.current = true;
    setShowObservationModal(true);
    searchParams.delete('addObservation');
    navigate({
      pathname: location.pathname,
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    }, { replace: true });
  }, [event, lifecycleNow, location.pathname, location.search, navigate]);

  if (loading) return <PageLoader />;
  if (!event) return (
    <div className="page-container page-bottom-pad flex min-h-[60vh] items-center justify-center bg-[#050505] px-5 text-center text-white">
      <div className="max-w-sm">
        <Calendar className="mx-auto h-9 w-9 text-white/35" />
        <h1 className="mt-4 text-xl font-black">Event not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">This event may have been removed, or you may no longer have access to it.</p>
        <button type="button" onClick={() => navigate('/events')} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/[0.1] px-5 text-sm font-bold text-white transition-colors hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </button>
      </div>
    </div>
  );

  const myAssignments = getUserEventAssignments(assignments, user?.id);
  const myPendingAssignments = getPendingUserEventAssignments(assignments, user?.id);
  const myAssignment = myAssignments.find(assignment => assignment.roles?.name === 'Song Leader')
    || myAssignments.find(assignment => assignment.status !== 'declined')
    || myAssignments[0];
  const decliningAssignment = showDecline ? assignments.find(assignment => assignment.id === showDecline) : null;
  const confirmedCount = assignments.filter(a => a.status === 'confirmed').length;
  const pendingAssignmentUserCount = getPendingAssignmentUserCount(assignments);
  const songLeaderAssignment = assignments.find(a => a.roles?.name === 'Song Leader');
  const getShortLeaderName = (profile?: { first_name?: string; last_name?: string; gender?: string } | null) => {
    if (!profile?.first_name) return '';
    const prefix = profile.gender === 'male' ? 'Bro.' : profile.gender === 'female' ? 'Sis.' : '';
    return prefix ? `${prefix} ${profile.first_name}` : profile.first_name;
  };
  const shortenPrefixedTitle = (title: string) => title.replace(/^(Bro\.|Sis\.)\s+([^\s]+).*$/i, (_match, prefix, firstName) => `${prefix} ${firstName}`);
  const linkedSongLeaderName = linkedSongLeaderAssignment?.profiles
    ? getShortLeaderName(linkedSongLeaderAssignment.profiles)
    : linkedServiceEvent?.title
      ? shortenPrefixedTitle(linkedServiceEvent.title)
      : '';
  const directSongLeaderName = songLeaderAssignment?.profiles
    ? getShortLeaderName(songLeaderAssignment.profiles)
    : members.find(m => m.id === event.song_leader_id)
      ? members.find(m => m.id === event.song_leader_id)!.first_name
      : '';
  const songLeaderName = directSongLeaderName || linkedSongLeaderName;
  const eventDisplayTitle = directSongLeaderName || shortenPrefixedTitle(event.title);
  const isSongLeader = myAssignments.some(a => a.roles?.name === 'Song Leader');
  const userIsSongLeaderRole = userRoles.some(ur => ur.roles?.name === 'Song Leader');
  const hasEventManagementAccess = isLeader || isOrgAdmin || isPlatformOwner;
  const visiblePendingAssignments = myPendingAssignments;
  const assignmentDetailsBlocked = shouldBlockEventDetails(assignments, user?.id, hasEventManagementAccess);
  const pendingAssignmentPanel = visiblePendingAssignments.length > 0 && !assignmentDetailsBlocked ? (
    <motion.section
      {...blurUp(0.2)}
      className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-[#120b05]"
      style={{
        backgroundImage: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05) 52%, transparent 82%)',
        boxShadow: '0 6px 20px -12px rgba(245,158,11,0.20)',
      }}
      aria-labelledby="pending-assignment-title"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(145deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.4)' }}
          >
            <AlertCircle className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-amber-400">
              Action required
            </p>
            <h2 id="pending-assignment-title" className="text-[15px] font-bold leading-tight text-white" style={{ letterSpacing: '-0.02em' }}>
              {visiblePendingAssignments.length} pending {visiblePendingAssignments.length === 1 ? 'assignment' : 'assignments'}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">
              {isSongLeader
                ? 'You can keep preparing as Song Leader, but please respond to each additional role.'
                : 'Please respond to each role so the event leaders have an accurate team count.'}
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/15">
          {visiblePendingAssignments.map(assignment => {
            const isResponding = respondingAssignmentId === assignment.id;
            const roleName = assignment.roles?.name || 'Team role';
			const servingRole = getServingRoleLabel(roleName);
            return (
              <div key={assignment.id} className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
				  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/70">Your role for this event</p>
				  <p className="mt-1 text-sm font-bold leading-snug text-white">You’re assigned to serve as <span className="text-amber-300">{servingRole}</span>.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => handleConfirm(assignment.id)}
                    disabled={respondingAssignmentId !== null}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-wait disabled:opacity-55"
                    aria-label={`Confirm ${roleName} assignment`}
                  >
                    {isResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDecline(assignment.id)}
                    disabled={respondingAssignmentId !== null}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.1] px-4 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/[0.17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:opacity-55"
                    aria-label={`Decline ${roleName} assignment`}
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  ) : null;
  const isRolePreviewActive = isViewingAsMember || isViewingAsSongLeader;
  const canManageSetlist = isViewingAsSongLeader || (!isRolePreviewActive && (isLeader || isSongLeader || userIsSongLeaderRole));
  const canEditSetlist = isLeader || isProductionDirector;
  const canEditEvent = isLeader || isProductionDirector;

  const isSetlistCreator = isViewingAsSongLeader || (!isRolePreviewActive && (setlist ? setlist.created_by === user?.id : false));
  const canSeeEventSongReadiness = isViewingAsSongLeader || isSetlistCreator || isSetlistCoordinator || isOrgAdmin || isAdmin || isPlatformOwner;
  const canReviewSetlist = isLeader || isOrgAdmin || isPlatformOwner || isAdmin || isProductionDirector || isMusicDirector || isSetlistCoordinator;
  const canSubmitSetlist = isSetlistCreator || canManageSetlist;
  const pendingReviewAge = setlist?.status === 'pending_review'
    ? describeSetlistReviewAge(setlist.submitted_at || setlist.created_at)
    : null;
  const pendingReviewMessage = pendingReviewAge ? getSetlistPendingMessage(pendingReviewAge, isSetlistCreator) : null;

  const statusColors: Record<string, string> = {
    draft: 'badge-blue',
    pending_review: 'badge-yellow',
    approved: 'badge-green',
    revision_requested: 'badge-red',
    rejected: 'badge-red',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Submitted',
    approved: 'Approved',
    revision_requested: 'Revision Requested',
    rejected: 'Rejected',
  };

  const statusDescriptions: Record<string, string> = {
    draft: 'Draft — not yet submitted for review',
    pending_review: 'Submitted — awaiting leader review',
    approved: 'Approved — accepted for use',
    revision_requested: 'Revision Requested — update and resubmit',
    rejected: 'Rejected — not approved',
  };

  // Visual urgency state for hero card (mirrors Events list logic)
  const heroIsPast = isEventCompleted(event);
  const heroScheduleEnded = hasEventScheduleEnded(event, lifecycleNow);
  const postEventFeedbackOpen = heroIsPast || heroScheduleEnded;
  const canManagePostEventObservations = isLeader || isProductionDirector;
  const canSendAssignmentReminders = isOrgAdmin || isAdmin || isPlatformOwner;
  const activePostEventObservationCount = postEventObservations.filter(observation => observation.status !== 'resolved').length;
  const viewingObservation = postEventObservations.find(observation => observation.id === viewingObservationId) || null;
  const viewingObservationViewers = viewingObservation
    ? getPostEventObservationViewers(
      postEventObservationViews.filter(view => view.observation_id === viewingObservation.id),
      viewingObservation.author_id
    )
    : [];
  const heroProposalDue = event.proposal_due_date ? parseISO(event.proposal_due_date) : null;
  const heroDaysUntilDue = heroProposalDue ? differenceInDays(heroProposalDue, new Date()) : null;
  const heroHasApprovedSetlist = setlist?.status === 'approved';
  const heroIsOverdue = heroDaysUntilDue !== null && heroDaysUntilDue < 0 && !heroHasApprovedSetlist && !postEventFeedbackOpen;
  const heroIsDueSoon = heroDaysUntilDue !== null && heroDaysUntilDue >= 0 && heroDaysUntilDue <= 3 && !heroHasApprovedSetlist && !postEventFeedbackOpen;
  const isApprovedSetlist = setlist?.status === 'approved';
  const showSetlistEditControls = !isApprovedSetlist || setlistEditMode;
  const canEditSetlistSongDetails = showSetlistEditControls && (canManageSetlist || canEditSetlist);
  const showLinkedSetlistReference = !setlist && event.event_type === 'Rehearsals' && !!event.linked_event_id && !!linkedSetlist;
  const linkedSetlistStatus = linkedSetlist?.status || 'draft';
  const canShowPrimaryModeButton = event.event_type === 'Rehearsals' || isApprovedSetlist;
  const canShowLinkedRehearsalModeButton = event.event_type === 'Rehearsals';
  let linkedServiceDateLabel = '';
  if (linkedServiceEvent?.event_date) {
    try {
      linkedServiceDateLabel = format(parseISO(linkedServiceEvent.event_date), 'MMM d, yyyy');
    } catch {
      linkedServiceDateLabel = '';
    }
  }
  const linkedReferenceSongs = linkedSetlistSongs
    .filter((song): song is SetlistSong => !!song && typeof song === 'object')
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const orderedSetlistSongs = setlistSongs
    .filter((song): song is SetlistSong => !!song && typeof song === 'object')
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const serviceModeSongs = event.event_type === 'Rehearsals' && linkedReferenceSongs.length > 0
    ? linkedReferenceSongs
    : orderedSetlistSongs.length > 0
      ? orderedSetlistSongs
      : linkedReferenceSongs;
  const eventDetailSongs = serviceModeSongs;
  const selectedProposalSubmissions = selectedSongProposals
    ? [selectedSongProposals.conflict.currentSubmission, ...selectedSongProposals.conflict.otherSubmissions]
      .sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt))
    : [];
  const selectedSongConfigSong = selectedSongForConfig
    ? songs.find(song => song.id === selectedSongForConfig) || null
    : null;
  const selectedSongConfigUsage = selectedSongForConfig ? songUsage[selectedSongForConfig] : undefined;
  const selectedSongConfigProjection = selectedSongForConfig
    ? projectSongReadiness(selectedSongConfigUsage?.lastDate, event.event_date)
    : null;
  const eventDetailArtworkSongs = eventDetailSongs.slice(0, 4).map(ss => ({
    title: ss.songs?.title,
    artist: ss.songs?.artist,
    youtube_url: ss.youtube_url || ss.songs?.youtube_url,
    songs: ss.songs,
  }));
  const primaryArtworkAmbientColor = eventArtworkAmbientColors[0] || null;
  const secondaryArtworkAmbientColor = eventArtworkAmbientColors[1] || primaryArtworkAmbientColor;
  const tertiaryArtworkAmbientColor = eventArtworkAmbientColors[2] || secondaryArtworkAmbientColor;
  const quaternaryArtworkAmbientColor = eventArtworkAmbientColors[3] || primaryArtworkAmbientColor;
  const compactEventFacts = [
    format(parseISO(event.event_date), 'EEE, MMM dd'),
    formatTime12Hour(event.start_time || ''),
    `${confirmedCount}/${assignments.length} confirmed`,
    event.proposal_due_date
      ? `Due ${formatInTimeZone(parseISO(event.proposal_due_date), 'Asia/Manila', 'MMM dd, h:mm a')}`
      : '',
  ].filter(Boolean);
  const eventShareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/events/${event.id}` : '';

  const withSharePreviewVersion = (url: string) => {
    if (typeof window === 'undefined' || !url) return url;

    const shareUrl = new URL(url);
    shareUrl.searchParams.set('preview', `six-song-grid-v4-${Date.now().toString(36)}`);
    return shareUrl.toString();
  };

  const createSnapshotEventShareUrl = () => {
    const snapshot = {
      eventDate: event.event_date,
      eventId: event.id,
      eventType: event.event_type,
      songs: eventDetailSongs
        .filter((song): song is SetlistSong & { songs: Song } => !!song?.songs)
        .map(song => ({
          artist: song.songs.artist || '',
          category: song.song_category || '',
          songKey: song.performed_key || song.songs.song_key || '',
          title: song.songs.title || 'Untitled Song',
          youtubeUrl: song.youtube_url || song.songs.youtube_url || '',
        })),
      songLeaderName,
      startTime: event.start_time,
      title: eventDisplayTitle,
    };
    return typeof window !== 'undefined'
      ? withSharePreviewVersion(`${window.location.origin}/share/events/snapshot-${toBase64Url(JSON.stringify(snapshot))}`)
      : eventShareUrl;
  };

  const createPublicEventShareUrl = async () => {
    const { data, error } = await supabase.rpc('create_public_event_share', { p_event_id: event.id });
    if (error) throw error;

    const token = typeof data === 'string' ? data : '';
    if (!token) throw new Error('Unable to create public event share link');

    return typeof window !== 'undefined'
      ? withSharePreviewVersion(`${window.location.origin}/share/events/${token}`)
      : eventShareUrl;
  };

  const handleShareEvent = async () => {
    const title = `ServeSync - ${eventDisplayTitle}`;
    setSharingEvent(true);

    try {
      let publicShareUrl = '';

      try {
        publicShareUrl = await createPublicEventShareUrl();
      } catch (error) {
        const message = getErrorMessage(error, '');
        if (!message.toLowerCase().includes('create_public_event_share')) throw error;
        publicShareUrl = createSnapshotEventShareUrl();
      }

      if (typeof navigator.share === 'function') {
        await navigator.share({
          title,
          url: publicShareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(publicShareUrl);
      toast('success', 'Event link copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      toast('error', getErrorMessage(error, 'Unable to create public event share link'));
    } finally {
      setSharingEvent(false);
    }
  };
  const serviceModeSong = serviceModeIndex === null ? null : serviceModeSongs[serviceModeIndex] || null;
  const serviceModeSongKey = serviceModeDisplayKey || serviceModeSong?.performed_key || serviceModeSong?.songs?.song_key || '';
	const activeSongPreparation = serviceModeSong ? songPreparation[serviceModeSong.id] : undefined;
	const rehearsalReadyCount = serviceModeSongs.filter(song => songPreparation[song.id]?.readiness === 'ready').length;
	const rehearsalNeedsWorkCount = serviceModeSongs.filter(song => songPreparation[song.id]?.readiness === 'needs_work').length;
	const openPreparationPanel = () => {
	  if (!serviceModeSong) return;
	  setPreparationDraft({
	    readiness: activeSongPreparation?.readiness || 'not_rehearsed',
	    issue_type: activeSongPreparation?.issue_type || '',
	    note: activeSongPreparation?.note || '',
	  });
	  setServicePreparationOpen(value => !value);
	};
	const saveSongPreparation = async () => {
	  if (!serviceModeSong || !user?.id || !organization?.id || event.event_type !== 'Rehearsals' || !event.linked_event_id || savingPreparation) return;
	  setSavingPreparation(true);
	  try {
	    const payload = {
	      org_id: organization.id,
	      event_id: event.linked_event_id,
	      rehearsal_event_id: event.id,
	      setlist_song_id: serviceModeSong.id,
	      song_id: serviceModeSong.song_id,
	      readiness: preparationDraft.readiness,
	      issue_type: preparationDraft.issue_type || null,
	      note: preparationDraft.note.trim() || null,
	      updated_by: user.id,
	    };
	    const { data, error } = await withSaveTimeout(
	      supabase
	        .from('event_song_preparation')
	        .upsert(payload, { onConflict: 'event_id,setlist_song_id' })
	        .select('id, event_id, rehearsal_event_id, setlist_song_id, song_id, readiness, issue_type, note, updated_at')
	        .single()
	    );
	    if (error || !data) {
	      toast('error', error?.message || 'Could not save rehearsal readiness');
	      return;
	    }
	    setSongPreparation(current => ({ ...current, [serviceModeSong.id]: data as EventSongPreparation }));
	    toast('success', 'Rehearsal handoff saved');
	    setServicePreparationOpen(false);
	  } finally {
	    setSavingPreparation(false);
	  }
	};
	  const serviceModeSourceLabel = event.event_type === 'Rehearsals' && linkedReferenceSongs.length > 0
	    ? linkedServiceEvent?.title || 'linked Sunday Service'
	    : orderedSetlistSongs.length > 0
	    ? event.title
	    : linkedServiceEvent?.title || 'linked Sunday Service';
	  const showServiceModeEntryPoints = canUseServiceModePilot;
	  const serviceModeLabel = event.event_type === 'Rehearsals' ? 'Rehearsal Mode' : 'Service Mode';
  const serviceModeLoadingTitle = event.event_type === 'Rehearsals' ? 'Preparing rehearsal flow.' : 'Preparing your setlist.';
  const serviceModeLoadingSteps = [
    { label: 'Opening charts', detail: `${serviceModeSongs.length} ${serviceModeSongs.length === 1 ? 'song' : 'songs'}`, icon: FileText },
    { label: 'Syncing notes', detail: 'Team and private notes', icon: MessageCircle },
    { label: 'Setting flow', detail: serviceModeSourceLabel, icon: ClipboardCheck },
  ];
  const isFirstServiceSong = (serviceModeIndex ?? 0) === 0;
  const isLastServiceSong = (serviceModeIndex ?? 0) === serviceModeSongs.length - 1;
  const serviceSwipeWidth = serviceSongStageWidth || (typeof window !== 'undefined' ? window.innerWidth : 390);
  const serviceSongPanels = serviceModeIndex === null
    ? []
    : serviceSwipeOffsets
      .map(offset => ({
        offset,
        index: serviceModeIndex + offset,
        song: serviceModeSongs[serviceModeIndex + offset],
      }))
      .filter((panel): panel is { offset: -1 | 0 | 1; index: number; song: SetlistSong & { songs: Song } } => !!panel.song?.songs);
  const openServiceMode = (index = 0) => {
    if (!canUseServiceModePilot) return;
    if (serviceModeSongs.length === 0) return;
    if (event.event_type !== 'Rehearsals' && setlist?.status !== 'approved') return;
    const nextIndex = Math.min(Math.max(index, 0), serviceModeSongs.length - 1);
	serviceModeOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setServiceChartEditing(false);
    setServiceChartControlsVisible(false);
    setServiceArrangementOpen(false);
    setServiceAutoScrollEnabled(false);
    setServiceSongPickerOpen(false);
	setServicePreparationOpen(false);
	setShowRehearsalSummary(false);
	setServiceModeUnlocked(event.event_type === 'Rehearsals');
    setServiceModeDisplayKey('');
    serviceTrackAnimation.current?.stop();
    serviceTrackX.set(0);
    // The event and its charts are already loaded here, so reveal the selected
    // chart immediately instead of blocking it behind an artificial intro.
    setServiceModeEntering(false);
    setServiceModeIndex(nextIndex);
  };
  const closeServiceMode = () => {
    serviceModeClosing.current = true;
    if (id) clearActiveServiceMode(id);
    const root = document.documentElement;
    root.classList.remove('service-mode-active');
    document.body.classList.remove('service-mode-active');
    root.style.overflow = '';
    root.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    serviceTrackAnimation.current?.stop();
    serviceTrackX.set(0);
    serviceSwipeAnimating.current = false;
    setServiceChartEditing(false);
    setServiceChartControlsVisible(false);
    setServiceArrangementOpen(false);
    setServiceAutoScrollEnabled(false);
    setServiceSongPickerOpen(false);
	setServicePreparationOpen(false);
	setShowRehearsalSummary(false);
	setServiceModeUnlocked(false);
    setServiceCloseConfirmOpen(false);
    setServiceModeEntering(false);
    setServiceModeDisplayKey('');
    setServiceModeIndex(null);

    const params = new URLSearchParams(location.search);
    params.delete('mode');
    params.delete('song');
    const nextSearch = params.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
	window.setTimeout(() => serviceModeOpenerRef.current?.focus(), 0);
  };

  const requestCloseServiceMode = () => {
    setServiceSongPickerOpen(false);
    setServiceCloseConfirmOpen(true);
  };
  const goToServiceSong = (direction: -1 | 1) => {
    if (serviceSwipeAnimating.current || serviceModeIndex === null) return;
    const currentIndex = serviceModeIndex;
    const targetIndex = Math.min(serviceModeSongs.length - 1, Math.max(0, currentIndex + direction));

    if (targetIndex === currentIndex) {
      serviceTrackAnimation.current?.stop();
      serviceTrackAnimation.current = animate(serviceTrackX, 0, serviceSongPanelTransition);
      return;
    }

    setServiceChartEditing(false);
    setServiceArrangementOpen(false);
    setServiceAutoScrollEnabled(false);
    setServiceSongPickerOpen(false);
	setServicePreparationOpen(false);
    serviceSwipeAnimating.current = true;
    serviceTrackAnimation.current?.stop();
    serviceTrackAnimation.current = animate(serviceTrackX, direction === 1 ? -serviceSwipeWidth : serviceSwipeWidth, {
      ...serviceSongPanelTransition,
      onComplete: () => {
        serviceTrackX.set(0);
        setServiceModeIndex(targetIndex);
        setServiceModeDisplayKey('');
        serviceSwipeAnimating.current = false;
      },
    });
  };
  const selectServiceSong = (index: number) => {
    if (serviceSwipeAnimating.current || serviceModeEntering || serviceModeIndex === null) return;
    const targetIndex = Math.min(serviceModeSongs.length - 1, Math.max(0, index));

    setServiceSongPickerOpen(false);
    if (targetIndex === serviceModeIndex) return;

    setServiceChartEditing(false);
    setServiceArrangementOpen(false);
    setServiceAutoScrollEnabled(false);
	setServicePreparationOpen(false);
    serviceTrackAnimation.current?.stop();
    serviceTrackX.set(0);
    setServiceModeIndex(targetIndex);
    setServiceModeDisplayKey('');
  };
  const goToPreviousServiceSong = () => {
    goToServiceSong(-1);
  };
  const goToNextServiceSong = () => {
    goToServiceSong(1);
  };
  const handleServiceDragStart = () => {
    if (serviceSwipeAnimating.current || serviceChartEditing || serviceModeEntering) return;
    serviceTrackAnimation.current?.stop();
  };
  const handleServiceDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (serviceSwipeAnimating.current || serviceChartEditing || serviceModeEntering) return;

    const threshold = Math.min(Math.max(serviceSwipeWidth * 0.22, 72), 120);
    const hasEnoughDistance = Math.abs(info.offset.x) >= threshold;
    const hasEnoughVelocity = Math.abs(info.velocity.x) >= 520;

    if ((hasEnoughDistance || hasEnoughVelocity) && info.offset.x < 0 && !isLastServiceSong) {
      goToServiceSong(1);
      return;
    }

    if ((hasEnoughDistance || hasEnoughVelocity) && info.offset.x > 0 && !isFirstServiceSong) {
      goToServiceSong(-1);
      return;
    }

    serviceTrackAnimation.current?.stop();
    serviceTrackAnimation.current = animate(serviceTrackX, 0, serviceSongPanelTransition);
  };

  const heroEyebrow = heroIsPast
    ? 'text-gray-400 dark:text-white/30'
    : heroIsOverdue
    ? 'text-red-600 dark:text-red-400'
    : heroIsDueSoon
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400/80';

  const goBack = () => {
    setIsLeaving(true);
    setTimeout(() => navigate('/events'), 300);
  };

  const fullScreenAssignmentGate = assignmentDetailsBlocked ? (
    <motion.main
      {...blurUp(0.08)}
      className="relative flex min-h-[calc(100dvh-5rem)] w-full items-center justify-center overflow-hidden px-4 pb-10 pt-[calc(env(safe-area-inset-top)+5rem)] sm:px-6 sm:pb-14 sm:pt-[calc(env(safe-area-inset-top)+6rem)] lg:px-10 lg:py-16"
      aria-labelledby="assignment-gate-title"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-[-12rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-amber-500/[0.10] blur-[120px] sm:h-[42rem] sm:w-[42rem]" />
        <div className="absolute left-[8%] top-[38%] h-56 w-56 rounded-full bg-emerald-500/[0.06] blur-[100px]" />
        <div className="absolute right-[6%] top-[24%] h-64 w-64 rounded-full bg-sky-500/[0.05] blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.055),transparent_30%),linear-gradient(180deg,rgba(5,5,5,0.2),#050505_82%)]" />
      </div>

      <button
        type="button"
        onClick={goBack}
        className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.05] text-white/70 backdrop-blur-xl transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:left-6 lg:left-10 lg:top-10"
        aria-label="Back to events"
        title="Back to events"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="relative z-10 mx-auto w-full max-w-2xl text-center">
        <EventArtwork
          eventType={event.event_type}
          title={event.title}
          songs={eventDetailArtworkSongs}
          className="mx-auto h-32 w-32 rounded-2xl shadow-[0_24px_70px_-28px_rgba(245,158,11,0.55)] ring-1 ring-white/[0.10] sm:h-36 sm:w-36"
        />

        <p className="mt-6 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-emerald-400/80">
          {event.event_type}
        </p>
        <h1 className="mx-auto mt-2 max-w-xl text-3xl font-black leading-[1.02] text-white sm:text-5xl" style={{ letterSpacing: '-0.045em' }}>
          {eventDisplayTitle}
        </h1>
        <div className="mt-3 text-xs font-semibold text-white/45">
          <div className="space-y-1 sm:hidden">
            {[compactEventFacts.slice(0, 2), compactEventFacts.slice(2)].map((facts, rowIndex) => facts.length > 0 && (
              <div key={rowIndex} className="flex items-center justify-center gap-2">
                {facts.map((fact, index) => (
                  <span key={fact} className="inline-flex items-center gap-2 whitespace-nowrap">
                    {index > 0 && <span className="h-1 w-1 rounded-full bg-white/25" />}
                    {fact}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="hidden flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:flex">
            {compactEventFacts.map((fact, index) => (
              <span key={fact} className="inline-flex items-center gap-2">
                {index > 0 && <span className="h-1 w-1 rounded-full bg-white/25" />}
                {fact}
              </span>
            ))}
          </div>
        </div>

        <section
          className="relative mx-auto mt-7 w-full max-w-2xl overflow-hidden rounded-[28px] border border-amber-400/20 bg-[#0b0b0b]/90 px-4 pb-4 pt-6 shadow-[0_26px_80px_-42px_rgba(245,158,11,0.55)] backdrop-blur-2xl sm:mt-9 sm:px-7 sm:pb-6 sm:pt-8"
          aria-labelledby="assignment-gate-title"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.025),transparent_55%)]" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" aria-hidden="true" />

          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-black shadow-[0_12px_35px_-12px_rgba(245,158,11,0.8)]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-amber-400">
              Response required
            </p>
            <h2 id="assignment-gate-title" className="mt-2 text-[1.65rem] font-black leading-[1.08] text-white sm:text-3xl" style={{ letterSpacing: '-0.035em' }}>
              Respond before viewing<span className="hidden sm:inline"> </span><br className="sm:hidden" />event details
            </h2>

        <div className="mx-auto mt-6 w-full max-w-xl divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.09] bg-black/25 text-left sm:mt-7">
          {visiblePendingAssignments.map(assignment => {
            const isResponding = respondingAssignmentId === assignment.id;
            const roleName = assignment.roles?.name || 'Team role';
			const servingRole = getServingRoleLabel(roleName);
            return (
              <div key={assignment.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
				  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/70">Your role for this event</p>
				  <p className="mt-1 text-base font-black leading-snug text-white">You’re assigned to serve as <span className="text-amber-300">{servingRole}</span>.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => handleConfirm(assignment.id)}
                    disabled={respondingAssignmentId !== null}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-5 text-xs font-black text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed ${respondingAssignmentId ? 'opacity-45' : ''}`}
                    aria-label={`Confirm ${roleName} assignment`}
                  >
                    {isResponding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDecline(assignment.id)}
                    disabled={respondingAssignmentId !== null}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.1] px-5 text-xs font-black text-red-200 transition-colors hover:bg-red-500/[0.17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed ${respondingAssignmentId ? 'opacity-45' : ''}`}
                    aria-label={`Decline ${roleName} assignment`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>

            <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 border-t border-white/[0.06] px-2 pt-4 text-[11px] font-semibold leading-relaxed text-white/35 sm:mt-5 sm:pt-5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Event details stay private until all assignments have a response.
            </p>
          </div>
        </section>
      </div>
    </motion.main>
  ) : null;

  const newSongTitleMatch = newSong.title.trim()
    ? songs.find(song => normalizeSongTitle(song.title) === normalizeSongTitle(newSong.title)) || null
    : null;
  const showRevisionDiscussion = setlist
    ? revisionDiscussionOverride?.setlistId === setlist.id && revisionDiscussionOverride.status === setlist.status
      ? revisionDiscussionOverride.expanded
      : setlist.status !== 'approved'
    : false;

  return (
    <div className="page-container page-bottom-pad relative isolate overflow-x-clip bg-[#050505]">
      <motion.div
        animate={isLeaving ? { opacity: 0, y: -12, filter: 'blur(8px)' } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.28, ease: [0.4, 0, 1, 1] }}
        className={assignmentDetailsBlocked
          ? 'relative z-10 w-full'
          : 'relative z-10 mx-auto w-full max-w-2xl space-y-4 px-4 pt-0 sm:px-6 sm:pt-5 md:max-w-none md:px-8 lg:max-w-6xl lg:pt-12 xl:max-w-[1560px]'}
      >
        {fullScreenAssignmentGate}

        {/* ── Event Summary ────────────────────────────── */}
        {!assignmentDetailsBlocked && (
        <motion.div
          {...blurUp(0.08)}
          className="relative isolate z-10 -mx-4 overflow-visible px-4 pb-[15px] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:-mx-6 sm:px-6 sm:pb-5 sm:pt-3 md:-mx-8 md:px-8 lg:mt-0"
          style={{
            opacity: heroIsPast ? 0.85 : 1,
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2 inset-y-0 w-screen -translate-x-1/2 overflow-hidden lg:hidden"
          >
            <div className="absolute inset-x-[-35%] top-[-9rem] flex justify-center">
              <EventArtwork
                eventType={event.event_type}
                title={event.title}
                songs={eventDetailArtworkSongs}
                onArtworkUrlsChange={syncEventArtworkUrls}
                className="h-80 w-80 scale-[2.45] rounded-[2rem] opacity-55 blur-3xl brightness-[1.22] saturate-[1.25]"
              />
            </div>
            {primaryArtworkAmbientColor && (
              <div
                className="absolute -left-[42%] top-[4%] h-[21rem] w-[38rem] -rotate-[13deg] rounded-[48%] blur-[42px] brightness-[1.18] saturate-[0.88]"
                style={{ backgroundColor: toArtworkColorValue(primaryArtworkAmbientColor, 0.2) }}
              />
            )}
            {secondaryArtworkAmbientColor && (
              <div
                className="absolute -right-[42%] top-[7%] h-[22rem] w-[39rem] rotate-[15deg] rounded-[46%] blur-[46px] brightness-[1.2] saturate-[0.88]"
                style={{ backgroundColor: toArtworkColorValue(secondaryArtworkAmbientColor, 0.22) }}
              />
            )}
            {tertiaryArtworkAmbientColor && (
              <div
                className="absolute -left-[20%] top-[26%] h-[16rem] w-[34rem] rotate-[7deg] rounded-[48%] blur-[40px] brightness-[1.16] saturate-[0.84]"
                style={{ backgroundColor: toArtworkColorValue(tertiaryArtworkAmbientColor, 0.12) }}
              />
            )}
            {quaternaryArtworkAmbientColor && (
              <div
                className="absolute right-[-30%] top-[31%] h-[15rem] w-[33rem] -rotate-[9deg] rounded-[48%] blur-[42px] brightness-[1.16] saturate-[0.84]"
                style={{ backgroundColor: toArtworkColorValue(quaternaryArtworkAmbientColor, 0.12) }}
              />
            )}
            {primaryArtworkAmbientColor && secondaryArtworkAmbientColor && tertiaryArtworkAmbientColor && quaternaryArtworkAmbientColor && (
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 92% 58% at 12% 24%, ${toArtworkColorValue(primaryArtworkAmbientColor, 0.14)}, transparent 70%), radial-gradient(ellipse 96% 60% at 88% 23%, ${toArtworkColorValue(secondaryArtworkAmbientColor, 0.16)}, transparent 71%), radial-gradient(ellipse 82% 48% at 24% 54%, ${toArtworkColorValue(tertiaryArtworkAmbientColor, 0.1)}, transparent 68%), radial-gradient(ellipse 88% 50% at 80% 56%, ${toArtworkColorValue(quaternaryArtworkAmbientColor, 0.1)}, transparent 69%), radial-gradient(ellipse 116% 58% at 50% 40%, rgba(255,255,255,0.065), transparent 72%)`,
                }}
              />
            )}
            <div className="absolute -top-32 -left-24 h-52 w-[18rem] -rotate-[12deg] rounded-[46%] bg-[#050505] blur-[18px]" />
            <div className="absolute -top-40 left-[24%] h-64 w-[15rem] rotate-[7deg] rounded-[48%] bg-[#050505] blur-[20px]" />
            <div className="absolute -top-28 right-[-7rem] h-56 w-[18rem] rotate-[15deg] rounded-[48%] bg-[#050505] blur-[20px]" />
            <div className="absolute -bottom-28 -left-24 h-52 w-[20rem] rotate-[9deg] rounded-[48%] bg-[#050505] blur-[20px]" />
            <div className="absolute -bottom-36 left-[24%] h-64 w-[17rem] -rotate-[9deg] rounded-[46%] bg-[#050505] blur-[22px]" />
            <div className="absolute -bottom-24 right-[-8rem] h-52 w-[19rem] -rotate-[14deg] rounded-[48%] bg-[#050505] blur-[20px]" />
          </div>
          <div className="relative">
            <button
              onClick={goBack}
              className="absolute left-0 top-1 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/85 shadow-lg shadow-black/25 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 lg:top-8"
              title="Back to events"
              aria-label="Back to events"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative z-10 pt-3 lg:flex lg:items-end lg:gap-10 lg:pl-14 lg:pt-8 xl:gap-12">
              <EventArtwork
                eventType={event.event_type}
                title={event.title}
                songs={eventDetailArtworkSongs}
                onArtworkUrlsChange={syncEventArtworkUrls}
                className="mx-auto h-56 w-56 shrink-0 rounded-md shadow-[0_22px_60px_-30px_rgba(0,0,0,0.9)] sm:h-60 sm:w-60 lg:mx-0 lg:h-64 lg:w-64 xl:h-72 xl:w-72"
              />

              <div className="mt-6 min-w-0 lg:mt-0 lg:flex-1 lg:pb-5">
                <p className={`mb-1 text-[10px] font-mono font-medium uppercase tracking-[0.22em] ${heroEyebrow}`}>
                  {heroIsPast ? 'Past event' : heroIsOverdue ? 'Setlist overdue' : heroIsDueSoon ? `Due in ${heroDaysUntilDue}d` : heroHasApprovedSetlist ? 'Setlist approved' : 'Schedule'}
                </p>
                <div className="flex items-start gap-3 max-[380px]:flex-col">
                  <h1 className="min-w-0 flex-1 text-[1.75rem] font-black leading-[1.04] text-white sm:text-[2.5rem] lg:text-[4.5rem] xl:text-[5.5rem]" style={{ letterSpacing: '-0.04em' }}>
                    {eventDisplayTitle}
                  </h1>
                  {!assignmentDetailsBlocked && (
                    <div className="flex shrink-0 items-center gap-2 max-[380px]:self-end">
                      {canPreviewMemberView && !isViewingAsMember && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextValue = !isViewingAsSongLeader;
                            setViewingAsSongLeader(nextValue);
                            toast(
                              nextValue ? 'info' : 'success',
                              nextValue
                                ? 'Song Leader view enabled. Your admin access is unchanged.'
                                : 'Admin view restored',
                            );
                          }}
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-3 text-[11px] font-black backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 active:scale-95 ${
                            isViewingAsSongLeader
                              ? 'border-amber-300/35 bg-amber-400/[0.16] text-amber-100 hover:bg-amber-400/[0.22] focus-visible:ring-amber-300/80'
                              : 'border-white/[0.1] bg-white/[0.08] text-white/75 hover:bg-white/[0.14] hover:text-white focus-visible:ring-white/80'
                          }`}
                          title={isViewingAsSongLeader ? 'Exit Song Leader view' : 'View this event as Song Leader'}
                          aria-label={isViewingAsSongLeader ? 'Exit Song Leader view' : 'View this event as Song Leader'}
                          aria-pressed={isViewingAsSongLeader}
                        >
                          {isViewingAsSongLeader ? <EyeOff className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                          <span className="hidden xl:inline">
                            {isViewingAsSongLeader ? 'Exit Song Leader' : 'Song Leader View'}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={handleShareEvent}
                        disabled={sharingEvent}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                        title="Share event"
                        aria-label="Share event"
                      >
                        <Upload className={`h-4 w-4 ${sharingEvent ? 'animate-pulse' : ''}`} strokeWidth={2.6} />
                      </button>
                      {myAssignment && myAssignment.status !== 'declined' && (
                        <button
                          onClick={() => setShowSwapModal(true)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
                          title={myAssignment.roles?.name === 'Song Leader' ? 'Request schedule swap' : 'Find a sub for your spot'}
                          aria-label={myAssignment.roles?.name === 'Song Leader' ? 'Request schedule swap' : 'Find a sub for your spot'}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                      )}
                      {eventConversationId === undefined ? (
                        <button
                          disabled
                          className="inline-flex h-11 w-11 cursor-wait items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md"
                          title="Loading event chat"
                          aria-label="Loading event chat"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </button>
                      ) : (
                        eventConversationId ? (
                          <button
                            onClick={() => {
                              if (isOrgAdmin || isAdmin || isPlatformOwner) setShowCreateChatModal(true);
                              else navigate(`/messages/${eventConversationId}`);
                            }}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
                            title={(isOrgAdmin || isAdmin || isPlatformOwner) ? 'Choose event chat' : 'Open group chat'}
                            aria-label={(isOrgAdmin || isAdmin || isPlatformOwner) ? 'Choose event chat' : 'Open group chat'}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowCreateChatModal(true)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
                            title="Create group chat for this event"
                            aria-label="Create group chat for this event"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )
                      )}
                      {(isLeader || canEditEvent || isPlatformOwner) && (
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setShowEventActionsMenu((open) => !open)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.08] text-white/70 backdrop-blur-md transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
                            title="Event actions"
                            aria-label="Event actions"
                            aria-haspopup="menu"
                            aria-expanded={showEventActionsMenu}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <AnimatePresence>
                            {showEventActionsMenu && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute right-0 top-12 z-[70] w-44 overflow-hidden rounded-lg border border-white/[0.1] bg-[#181818]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                                role="menu"
                              >
                                {canEditEvent && (
                                  <button
                                    onClick={() => {
                                      setShowEventActionsMenu(false);
                                      openEditEvent();
                                    }}
                                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
                                    role="menuitem"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                    Edit event
                                  </button>
                                )}
                                {isPlatformOwner && (heroIsPast || heroScheduleEnded) && (
                                  <button
                                    onClick={() => {
                                      setShowEventActionsMenu(false);
                                      setLifecycleConfirmOverride(heroIsPast ? 'upcoming' : 'completed');
                                    }}
                                    disabled={savingLifecycleOverride}
                                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] disabled:opacity-50"
                                    role="menuitem"
                                  >
                                    {heroIsPast ? <Calendar className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                    {heroIsPast ? 'Move to Upcoming' : 'Move to Past'}
                                  </button>
                                )}
                                {isLeader && (
                                  <button
                                    onClick={() => {
                                      setShowEventActionsMenu(false);
                                      setShowDeleteEvent(true);
                                    }}
                                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red-300 transition-colors hover:bg-red-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                    role="menuitem"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete event
                                  </button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-white/60">
                  <span className="badge-blue text-[10px]">{event.event_type}</span>
                  {heroIsPast && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.09] px-2 py-1 text-[10px] font-black text-white/68">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </span>
                  )}
                  {!heroIsPast && heroScheduleEnded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/[0.12] px-2 py-1 text-[10px] font-black text-amber-300">
                      <Clock className="h-3 w-3" /> Finished
                    </span>
                  )}
                  {songLeaderName && <span>{songLeaderName}</span>}
                  {compactEventFacts.map(fact => (
                    <span key={fact} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      {fact}
                    </span>
                  ))}
                </div>

                {event.description && !assignmentDetailsBlocked && (
                  <p className="mt-4 max-w-3xl break-words border-t border-white/[0.08] pt-3 text-[12px] leading-relaxed text-white/55">{event.description}</p>
                )}
              </div>
            </div>

          </div>
        </motion.div>
        )}

        {/* ── Pending Assignment Banner ────────────────── */}
        {!assignmentDetailsBlocked && postEventFeedbackOpen && (
          <button
            type="button"
            onClick={() => setShowPastEventDetails(current => !current)}
            aria-expanded={showPastEventDetails}
            aria-controls="past-event-details"
            className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white/85">
                {showPastEventDetails ? 'Hide event details' : 'Show event details'}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-white/35">
                Schedule, attendance, setlist, and team assignments
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${showPastEventDetails ? 'rotate-180' : ''}`} />
          </button>
        )}

        {!assignmentDetailsBlocked && (!postEventFeedbackOpen || showPastEventDetails) && (
          <div id="past-event-details" className="contents">
        {pendingAssignmentPanel}

        {(() => {
          const attendanceStatus = getAttendanceStatus();
          const isAssigned = assignments.some(a => a.user_id === user?.id && a.status !== 'declined');
          const showAttendance = attendanceStatus.windowOpen || attendanceStatus.isClosed || attendanceStatus.countdown;

          if (!showAttendance) return null;

          return (
            <div className="animate-slide-up border-t border-gray-200/70 pt-4 dark:border-white/[0.08]" style={{ animationDelay: '100ms' }}>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                    <ClipboardCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Attendance
                  </h2>
                </div>

                {attendanceStatus.isClosed ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Attendance is closed</p>
                    {attendance ? (
                      <p className="text-xs text-gray-400 mt-1">
                        You were marked as <span className={attendance.status === 'present' ? 'text-green-600' : attendance.status === 'late' ? 'text-amber-600' : 'text-red-600'}>{attendance.status}</span>
                        {attendance.checked_in_at && ` at ${format(parseISO(attendance.checked_in_at), 'h:mm a')}`}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 mt-1">You were marked absent (no attendance submitted)</p>
                    )}
                  </div>
                ) : attendanceStatus.countdown ? (
                  <div className="py-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {countdownParts.hours > 0 && (
                        <div className="flex flex-col items-center">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                              <span className="text-2xl font-bold text-white tabular-nums">{String(countdownParts.hours).padStart(2, '0')}</span>
                            </div>
                            <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                          </div>
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Hours</span>
                        </div>
                      )}
                      {countdownParts.hours > 0 && (
                        <div className="flex flex-col gap-1.5 pb-5">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                            <span className="text-2xl font-bold text-white tabular-nums">{String(countdownParts.minutes).padStart(2, '0')}</span>
                          </div>
                          <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Minutes</span>
                      </div>
                      <div className="flex flex-col gap-1.5 pb-5">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20 overflow-hidden">
                            <span className="text-2xl font-bold text-white tabular-nums transition-all duration-300">{String(countdownParts.seconds).padStart(2, '0')}</span>
                          </div>
                          <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 dark:bg-brand-400/10 blur-sm -z-10 animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 uppercase tracking-wider">Seconds</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-brand-600 dark:text-brand-400">
                      <Timer className="h-4 w-4 animate-pulse" />
                      <p className="text-sm font-medium">Attendance opens soon</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">30 minutes before the event</p>
                  </div>
                ) : attendance ? (
                  <div className="group flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.04]">
                    <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${
                      attendance.status === 'present' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20' :
                      attendance.status === 'late' ? 'bg-amber-500/10 text-amber-300 ring-amber-400/20' :
                      'bg-red-500/10 text-red-300 ring-red-400/20'
                    }`}>
                      {attendance.status === 'present' ? <CheckCircle className="h-5 w-5" /> : attendance.status === 'late' ? <Clock className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {attendance.status === 'present' ? 'Present' : attendance.status === 'late' ? 'Late' : 'Absent'}
                      </p>
                      {attendance.checked_in_at && (
                        <p className="truncate text-xs text-gray-400">Checked in at {format(parseISO(attendance.checked_in_at), 'h:mm a')}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      attendance.status === 'present' ? 'bg-emerald-500/10 text-emerald-300' :
                      attendance.status === 'late' ? 'bg-amber-500/10 text-amber-300' :
                      'bg-red-500/10 text-red-300'
                    }`}>
                      {attendance.status === 'present' ? 'Checked in' : attendance.status}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-300">
                        <ClipboardCheck className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {isAssigned ? 'Scan the church QR to check in' : 'Attendance is QR-only'}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
                          {event?.start_time ? `${formatTime12Hour(event.start_time)} start · opens 30 minutes before · 5-minute grace` : 'Use the scanner in the top-right corner when you are at church.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-300/75">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="leading-relaxed">Scanning alone does not record attendance. Tap Check In after your scheduled event appears.</span>
                    </div>
                  </div>
                )}

                {isLeader && allAttendance.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Team Attendance</p>
                    <div className="space-y-2">
                      {allAttendance.map(att => (
                        <div key={att.id} className="flex items-center gap-3">
                          <Avatar
                            src={att.profiles?.avatar_url}
                            firstName={att.profiles?.first_name || '?'}
                            lastName={att.profiles?.last_name}
                            size="sm"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {att.profiles?.first_name} {att.profiles?.last_name}
                          </span>
                          <span className={`badge ${att.status === 'present' ? 'badge-green' : att.status === 'late' ? 'badge-yellow' : 'badge-red'}`}>
                            {att.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {setlist && (canReviewSetlist || isSongLeader) && setlist.status !== 'rejected' && (setlist.status === 'revision_requested' || revisionComments.length > 0 || !!setlist.review_note || !!setlist.approval_notes) && (
          <div className="card overflow-hidden animate-slide-up">
            <button
              type="button"
              onClick={() => {
                setRevisionDiscussionOverride({
                  setlistId: setlist.id,
                  status: setlist.status,
                  expanded: !showRevisionDiscussion,
                });
              }}
              aria-expanded={showRevisionDiscussion}
              aria-controls="revision-discussion-content"
              className={`flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/70 dark:hover:bg-white/[0.035] sm:px-4 ${showRevisionDiscussion ? 'border-b border-gray-200/70 dark:border-white/[0.08]' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {setlist.status === 'revision_requested' ? 'Revision Requested' : 'Revision Discussion'}
                  </p>
                  {setlist.status === 'approved' && (
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/35">
                      {showRevisionDiscussion ? 'Setlist approved · reviewing previous comments' : 'Setlist approved · open to review the discussion'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="badge badge-yellow">{revisionComments.length}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-300 ease-out dark:text-white/35 ${showRevisionDiscussion ? 'rotate-180' : ''}`} />
              </div>
            </button>

            <AnimatePresence initial={false}>
            {showRevisionDiscussion && (
              <motion.div
                id="revision-discussion-content"
                key={`${setlist.id}-${setlist.status}-revision-discussion`}
                initial={{ height: 0, opacity: 0, y: -8 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -6 }}
                transition={prefersReducedMotion ? { duration: 0 } : {
                  height: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                }}
                className="origin-top overflow-hidden will-change-[height,opacity,transform]"
              >
              {(setlist.review_note || setlist.approval_notes) && (
                <div className="mx-3.5 mt-3 flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50/80 px-3 py-2.5 dark:border-amber-700/35 dark:bg-amber-900/15 sm:mx-4">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 text-amber-800 dark:text-amber-200">{setlist.review_note || setlist.approval_notes || 'Please review and make necessary changes to the setlist.'}</p>
                  </div>
                </div>
              )}

            <div className="space-y-2 px-3.5 py-3 sm:px-4">
              {revisionComments.length === 0 ? (
                <p className="py-1 text-center text-xs text-gray-500 dark:text-gray-400">No comments yet.</p>
              ) : revisionComments.map(comment => {
                const authorName = `${comment.profiles?.first_name || 'Team'} ${comment.profiles?.last_name || 'member'}`.trim();
                const isAwaitingReactionLanding = pendingRevisionReactionReveal?.commentId === comment.id;
                const visibleReactions = isAwaitingReactionLanding
                  ? (comment.setlist_revision_comment_reactions || []).filter(reaction => !(
                      reaction.user_id === user?.id && reaction.emoji === pendingRevisionReactionReveal.emoji
                    ))
                  : (comment.setlist_revision_comment_reactions || []);
                const reactionGroups = groupEmojiReactions(visibleReactions);
                const needsLandingPlaceholder = Boolean(
                  isAwaitingReactionLanding
                  && !reactionGroups.some(reaction => reaction.emoji === pendingRevisionReactionReveal?.emoji)
                );
                const isReactionPickerOpen = revisionReactionPickerCommentId === comment.id;
                return (
                  <div
                    key={comment.id}
                    data-app-nonselect="true"
                    data-revision-comment-reaction-root={comment.id}
                    className={`relative overflow-hidden rounded-lg border border-gray-200/70 bg-gray-50/70 dark:border-white/[0.08] dark:bg-white/[0.03] sm:overflow-visible ${isReactionPickerOpen ? 'sm:z-30' : 'sm:z-0'} ${comment.reply_to ? 'ml-4 border-l-2 border-l-amber-400/70 sm:ml-6' : ''}`}
                  >
                    <div className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <Avatar src={comment.profiles?.avatar_url} firstName={comment.profiles?.first_name || '?'} lastName={comment.profiles?.last_name} size="xs" />
                        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
                          <p className="shrink-0 truncate text-xs font-semibold text-gray-900 dark:text-white">{authorName}</p>
                          <p className="min-w-0 truncate text-[11px] text-gray-500 before:mr-1.5 before:text-gray-400 before:content-['|'] dark:text-gray-400 dark:before:text-gray-600">{format(parseISO(comment.created_at), 'MMM d, yyyy · h:mm a')}</p>
                        </div>
                        <div className="relative flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (revisionReactionPickerCommentId !== comment.id) playInteractionSound('reactionOpen');
                              setRevisionReactionPickerCommentId(current => current === comment.id ? null : comment.id);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/[0.035] hover:text-amber-600 dark:hover:bg-white/[0.05] dark:hover:text-amber-400 sm:h-7 sm:w-7"
                            aria-label={`React to ${authorName}'s comment`}
                            aria-expanded={isReactionPickerOpen}
                            aria-haspopup="menu"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => startRevisionCommentReply(comment)} className="min-h-9 rounded-lg px-1.5 py-1 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/[0.07] hover:text-amber-700 dark:text-amber-400 sm:min-h-7">Reply</button>
                          {canDeleteRevisionComments && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteRevisionComment(comment)}
                              disabled={deletingRevisionCommentId !== null}
                              aria-label={`Delete comment by ${authorName}`}
                              title="Delete comment"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 sm:h-7 sm:w-7"
                            >
                              {deletingRevisionCommentId === comment.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <AnimatePresence initial={false}>
                            {isReactionPickerOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0, scale: 0.96, y: -4 }}
                                animate={{ height: 'auto', opacity: 1, scale: 1, y: 0 }}
                                exit={{ height: 0, opacity: 0, scale: 0.97, y: -3 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute right-[4.25rem] top-full z-40 mt-1 hidden origin-top-right overflow-hidden rounded-2xl sm:block"
                              >
                                <EmojiReactionPicker
                                  className="!w-[22rem]"
                                  animateEntrance={!prefersReducedMotion}
                                  onPick={(emoji, event) => void handleRevisionCommentReaction(comment, emoji, event.currentTarget)}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words pl-7 text-sm leading-5 text-gray-700 dark:text-gray-200"><FormattedText text={comment.content} /></p>

                      {(reactionGroups.length > 0 || needsLandingPlaceholder) && (
                        <div className="relative mt-2 flex min-w-0 flex-wrap items-center gap-1.5 pl-7">
                          {reactionGroups.map(reaction => {
                            const isActive = reaction.users.includes(user?.id || '');
                            const isLanding = revisionReactionLanding?.commentId === comment.id && revisionReactionLanding.emoji === reaction.emoji;
                            return (
                              <motion.button
                                key={reaction.emoji}
                                type="button"
                                onClick={() => void handleRevisionCommentReaction(comment, reaction.emoji as ReactionEmoji)}
                                data-revision-reaction-emoji={reaction.emoji}
                                initial={isLanding ? { scale: 0.72, opacity: 0.35 } : false}
                                animate={isLanding
                                  ? { scale: [0.72, 1.16, 0.96, 1], opacity: [0.35, 1, 1, 1] }
                                  : { scale: 1, opacity: 1 }}
                                transition={isLanding
                                  ? { duration: 0.36, times: [0, 0.48, 0.72, 1], ease: [0.16, 1, 0.3, 1] }
                                  : { duration: 0.16 }}
                                className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-all active:scale-95 ${
                                  isActive
                                    ? 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300'
                                    : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-200 dark:bg-white/[0.055] dark:text-white/60 dark:ring-white/[0.07] dark:hover:bg-white/[0.1]'
                                }`}
                                aria-pressed={isActive}
                                aria-label={`${isActive ? 'Remove' : 'Add'} ${reaction.emoji} reaction. ${reaction.count} total`}
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </motion.button>
                            );
                          })}
                          {needsLandingPlaceholder && pendingRevisionReactionReveal && (
                            <span
                              aria-hidden="true"
                              data-revision-reaction-emoji={pendingRevisionReactionReveal.emoji}
                              className="invisible inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold"
                            >
                              <span>{pendingRevisionReactionReveal.emoji}</span>
                              <span>1</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {isReactionPickerOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, scale: 0.96, y: -4 }}
                          animate={{ height: 'auto', opacity: 1, scale: 1, y: 0 }}
                          exit={{ height: 0, opacity: 0, scale: 0.97, y: -3 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="origin-top-right overflow-hidden border-t border-amber-500/15 bg-amber-500/[0.035] sm:hidden"
                        >
                          <div className="flex justify-center px-2.5 py-2 sm:justify-end sm:p-0">
                            <EmojiReactionPicker
                              className="!w-full sm:!w-[22rem]"
                              animateEntrance={!prefersReducedMotion}
                              onPick={(emoji, event) => void handleRevisionCommentReaction(comment, emoji, event.currentTarget)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {revisionReactionFlight?.commentId === comment.id && (
                        <ReactionFlightAnimation
                          key={revisionReactionFlight.token}
                          flight={revisionReactionFlight}
                          onComplete={() => handleRevisionReactionFlightComplete(revisionReactionFlight)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {replyingToRevisionComment && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <span className="truncate">Replying to {replyingToRevisionComment.profiles?.first_name || 'comment'}</span>
                  <button type="button" onClick={() => setReplyingToRevisionComment(null)} className="font-semibold">Cancel</button>
                </div>
              )}
              <MentionTextarea
                textareaRef={revisionCommentInputRef}
                value={revisionCommentText}
                onChange={setRevisionCommentText}
                placeholder={replyingToRevisionComment ? 'Write a reply… (type @ to mention)' : 'Add a comment… (type @ to mention)'}
                className={`input-field whitespace-pre-wrap ${replyingToRevisionComment ? 'min-h-11 resize-none overflow-y-hidden' : 'min-h-16 resize-y'}`}
                rows={replyingToRevisionComment ? 1 : 2}
                maxLength={4000}
              />
              <div className="flex justify-end">
                <button type="button" onClick={handlePostRevisionComment} disabled={!revisionCommentText.trim() || postingRevisionComment} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
                  {postingRevisionComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {replyingToRevisionComment ? 'Post Reply' : 'Post Comment'}
                </button>
              </div>
            </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}

        {setlist && setlist.status === 'rejected' && (
          <div className="card p-4 bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 shrink-0">
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">Setlist Rejected</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-red-700 dark:text-red-300">{setlist.review_note || 'This setlist was not approved.'}</p>
                {canSubmitSetlist && <p className="text-xs text-red-600 dark:text-red-400 mt-2">You can reset it to Draft and rework it if needed.</p>}
              </div>
            </div>
          </div>
        )}

        {!setlist ? (
          showLinkedSetlistReference ? (
            <div className="overflow-hidden animate-slide-up border-t border-gray-200/70 pt-4 dark:border-white/[0.08]" style={{ animationDelay: '125ms' }}>
              <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <Music className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sunday Service Setlist</h2>
                    <span className={statusColors[linkedSetlistStatus] || 'badge-blue'}>{statusLabels[linkedSetlistStatus] || linkedSetlistStatus}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:truncate">
                    Reference only from {linkedServiceEvent?.title || 'linked Sunday Service'}
                    {linkedServiceDateLabel ? ` · ${linkedServiceDateLabel}` : ''}
                  </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                  {showServiceModeEntryPoints && canShowLinkedRehearsalModeButton && linkedReferenceSongs.length > 0 && (
                    <button
                      onClick={() => openServiceMode(0)}
                      className="group relative inline-flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-emerald-500/15 px-4 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/20 transition hover:bg-emerald-500/20 active:scale-[0.98] sm:h-9 sm:flex-none sm:px-3 sm:text-xs"
                      title={`Open ${serviceModeLabel}`}
                    >
                      <FileText className="relative h-4 w-4 transition group-hover:scale-110" />
                      <span className="relative whitespace-nowrap">{serviceModeLabel}</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/events/${event.linked_event_id}`)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70 ring-1 ring-white/[0.08] transition hover:bg-white/[0.13] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] active:scale-[0.97]"
                    title="Open linked event"
                    aria-label="Open linked event"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {linkedReferenceSongs.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">The linked setlist has no songs yet</p>
              ) : (
                <div className="space-y-1">
                  {linkedReferenceSongs.map((ss) => {
                    const song = Array.isArray(ss.songs) ? ss.songs[0] : ss.songs;
                    const displayKey = ss.performed_key || song?.song_key || '';
                    const videoUrl = ss.youtube_url || song?.youtube_url || '';
                    const keyChanged = ss.performed_key && song?.song_key && ss.performed_key !== song.song_key;
                    return (
                      <div key={ss.id} className="rounded-xl px-1 py-2 transition-colors hover:bg-white/[0.04]">
                        <div className="flex items-center gap-3">
                          <SongArtwork song={song} youtubeUrl={ss.youtube_url || song?.youtube_url} className="h-11 w-11 rounded-md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{song?.title || 'Untitled song'}</p>
                              {displayKey && (
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                  {displayKey}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {[song?.artist, ss.song_category].filter(Boolean).join(' · ') || 'No artist listed'}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {videoUrl && (
                              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white" title="Open video" aria-label={`Open video for ${song?.title || 'song'}`}>
                                <Play className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white" title="More">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-0 py-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  This rehearsal is linked to the Sunday service setlist for reference. No separate rehearsal setlist is created in the library.
                </p>
              </div>
            </div>
          ) : (
          <div className="animate-slide-up border-t border-gray-200/70 pt-4 dark:border-white/[0.08]" style={{ animationDelay: '125ms' }}>
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Music className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Setlist
              </h2>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.035] sm:p-5">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] md:items-center">
                <div className="flex min-w-0 items-start gap-3.5 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/[0.12] dark:text-emerald-300 dark:ring-emerald-400/15">
                    <Music className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Build this service’s setlist</p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500 dark:text-white/45">
                      Choose the service flow first, then add songs and set the best key for the song leader and congregation.
                    </p>
                  </div>
                </div>
                {canManageSetlist && (
                  <div className="space-y-2 text-left">
                    <label htmlFor="event-service-format" className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-white/40">
                      Service format
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                      <select
                        id="event-service-format"
                        value={serviceFormat || inferServiceFormat(event.event_type)}
                        onChange={e => setServiceFormat(e.target.value as ServiceFormat)}
                        className="input-field min-h-11 min-w-0 flex-1 text-sm"
                      >
                        {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                          <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateSetlist}
                        className="btn-primary min-h-11 shrink-0 justify-center"
                      >
                        <Plus className="h-4 w-4" />
                        Create Setlist
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )
        ) : (
          <div className="animate-slide-up" style={{ animationDelay: '125ms' }}>
            <div className="overflow-hidden border-t border-gray-200/70 pt-0 dark:border-white/[0.08]">
              <AnimatePresence mode="wait" initial={false}>
              {cardView === 'checking' ? (
                <motion.div
                  key="checking"
                  initial={{ opacity: 0, x: cardDir === 'forward' ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: cardDir === 'forward' ? -40 : 40 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                <CheckingAnimation
                  songs={setlistSongs.sort((a, b) => a.position - b.position).map(ss => ({
                    title: ss.songs?.title || '',
                    artist: ss.songs?.artist || '',
                    slot: (ss.song_category || 'Worship') as 'Opening' | 'Praise' | 'Worship' | 'Closing' | 'Offering' | 'Special' | 'Others',
                    lyrics: getEffectiveSongLyrics(ss.songs) || undefined,
                  }))}
                  theme={serviceTheme}
                  language="english"
                  onComplete={async (report) => {
                    setCheckReport(report);
                    navigateCard('report', 'forward');
                    await persistCheckReport(report);
                  }}
                />
                </motion.div>
              ) : cardView === 'report' && checkReport ? (
                <motion.div
                  key="report"
                  initial={{ opacity: 0, x: cardDir === 'forward' ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: cardDir === 'forward' ? -40 : 40 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                <SetlistReport
                  report={checkReport}
                  onBack={() => navigateCard('setlist', 'back')}
                  onRecheck={() => { setCheckReport(null); navigateCard('checking', 'back'); }}
                  onSubmitProposal={canSubmitSetlist ? () => handleSetlistAction('pending_review') : undefined}
                  canSubmit={!hasMissingLyrics && canSubmitSetlist && ['draft', 'revision_requested'].includes(setlist.status)}
                  setlistStatus={setlist.status}
                  submissionMode={setlistSubmissionMode}
                />
                </motion.div>
              ) : (
              <motion.div
                key="setlist"
                initial={{ opacity: 0, x: cardDir === 'forward' ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: cardDir === 'forward' ? -40 : 40 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
              <>
              {/* Header */}
              <div>
                {/* Mobile: stacked two-row layout */}
                <div className="flex flex-col gap-2 px-4 py-3 lg:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <Music className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Setlist</h2>
                    <span className={statusColors[setlist.status] || 'badge-blue'}>{statusLabels[setlist.status] || setlist.status}</span>
                    {pendingReviewMessage && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        (pendingReviewAge?.pendingDays ?? 0) > 1
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}>
                        <Clock className="h-3 w-3" /> {pendingReviewMessage}
                      </span>
                    )}
                    {isApprovedSetlist && (canManageSetlist || canEditSetlist) && (
                      <button
                        onClick={() => setSetlistEditMode(value => !value)}
                        className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                          setlistEditMode
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                            : 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-white/65'
                        }`}
                      >
                        <Edit className="h-3.5 w-3.5" /> {setlistEditMode ? 'Done' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showServiceModeEntryPoints && canShowPrimaryModeButton && setlistSongs.length > 0 && (
                      <button
                        onClick={() => openServiceMode(0)}
                        className="relative inline-flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-700 px-4 py-3 text-sm font-black text-white shadow-xl shadow-emerald-600/25 transition active:scale-[0.98]"
                        title={`Open ${serviceModeLabel}`}
                      >
                        <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.28),transparent)] animate-[shimmer_2.4s_infinite]" />
                        <FileText className="relative h-4 w-4" />
                        <span className="relative">{serviceModeLabel}</span>
                      </button>
                    )}
                    {canManageSetlist && showSetlistEditControls && (
                      <select
                        value={serviceFormat || 'sunday_full'}
                        onChange={e => handleServiceFormatChange(e.target.value as ServiceFormat)}
                        className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-2 py-1 border-none outline-none focus:ring-1 focus:ring-brand-500 flex-1 min-w-0"
                        title="Service Format"
                      >
                        {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                          <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                        ))}
                      </select>
                    )}
                    {showSetlistEditControls && (canManageSetlist || canEditSetlist) && setlistSongs.length > 1 && !isReordering && (
                      <button
                        onClick={enterReorderMode}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0"
                        title="Reorder Songs"
                      >
                        <GripVertical className="h-3.5 w-3.5" /> Reorder
                      </button>
                    )}
                  </div>
                </div>
                {/* Desktop: single-row layout */}
                <div className="hidden lg:flex lg:items-center lg:justify-between lg:px-5 lg:py-3.5">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <Music className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Setlist</h2>
                    <span className={statusColors[setlist.status] || 'badge-blue'}>{statusLabels[setlist.status] || setlist.status}</span>
                    {pendingReviewMessage && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        (pendingReviewAge?.pendingDays ?? 0) > 1
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}>
                        <Clock className="h-3 w-3" /> {pendingReviewMessage}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {showServiceModeEntryPoints && canShowPrimaryModeButton && setlistSongs.length > 0 && (
                      <button
                        onClick={() => openServiceMode(0)}
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-700 px-5 py-3 text-sm font-black text-white shadow-xl shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-emerald-600/30"
                        title={`Open ${serviceModeLabel}`}
                      >
                        <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2.4s_infinite]" />
                        <FileText className="relative h-4 w-4 transition group-hover:scale-110" />
                        <span className="relative">{serviceModeLabel}</span>
                      </button>
                    )}
                    {isApprovedSetlist && (canManageSetlist || canEditSetlist) && (
                      <button
                        onClick={() => setSetlistEditMode(value => !value)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition ${
                          setlistEditMode
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.08] dark:text-white/65 dark:hover:bg-white/[0.12]'
                        }`}
                      >
                        <Edit className="h-3.5 w-3.5" /> {setlistEditMode ? 'Done' : 'Edit'}
                      </button>
                    )}
                    {showSetlistEditControls && (canManageSetlist || canEditSetlist) && setlistSongs.length > 1 && !isReordering && (
                      <button
                        onClick={enterReorderMode}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Reorder Songs"
                      >
                        <GripVertical className="h-3.5 w-3.5" /> Reorder
                      </button>
                    )}
                    {canManageSetlist && showSetlistEditControls && (
                      <select
                        value={serviceFormat || 'sunday_full'}
                        onChange={e => handleServiceFormatChange(e.target.value as ServiceFormat)}
                        className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg px-2 py-1 border-none outline-none focus:ring-1 focus:ring-brand-500 max-w-[140px]"
                        title="Service Format"
                      >
                        {(Object.keys(SERVICE_FORMAT_LABELS) as ServiceFormat[]).map(k => (
                          <option key={k} value={k}>{SERVICE_FORMAT_LABELS[k]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div>
                  {isReordering ? (
                    <div>
                      <div className="px-4 py-2.5 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-100 dark:border-brand-800 flex items-center justify-between">
                        <p className="text-xs text-brand-700 dark:text-brand-300 font-medium">Drag to reorder, or use arrows on mobile</p>
                        <div className="flex items-center gap-2">
                          <button onClick={cancelReorder} disabled={savingOrder} className="btn-ghost text-xs py-1 px-2">Cancel</button>
                          <button onClick={saveReorder} disabled={savingOrder} className="btn-primary text-xs py-1 px-2">
                            {savingOrder ? 'Saving...' : 'Save Order'}
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {reorderSongs.map((ss, i) => (
                          <div
                            key={ss.id}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={e => handleDragOver(e, i)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing select-none transition-colors ${dragIndex === i ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-white dark:bg-gray-900'}`}
                          >
                            <GripVertical className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                            <SongArtwork song={ss.songs} youtubeUrl={ss.youtube_url || ss.songs?.youtube_url} className="h-10 w-10 rounded-lg" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ss.songs?.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{ss.songs?.artist || 'No artist listed'}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => moveReorderSong(i, i - 1)}
                                disabled={i === 0}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveReorderSong(i, i + 1)}
                                disabled={i === reorderSongs.length - 1}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : setlistSongs.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-gray-400">No songs added yet</p>
                  ) : (
                    <div className="space-y-1">
                      {setlistSongs.sort((a, b) => a.position - b.position).map((ss, i) => {
                        const usage = songUsage[ss.song_id];
                        const proposalConflict = canReviewSetlist ? songProposalConflicts[ss.song_id] : undefined;
                        const readiness = getSongReadinessBadge(usage, event.event_date);
                        const ReadinessIcon = readiness.Icon;
                        const displayKey = ss.performed_key || ss.songs?.song_key || '';
                        const keyChanged = ss.performed_key && ss.songs?.song_key && ss.performed_key !== ss.songs.song_key;
                        const lyricsSource = getSongLyricsSource(ss.songs);
                        const lyricsMissing = lyricsSource === 'missing';
                        const videoUrl = ss.youtube_url || ss.songs?.youtube_url || '';
                        const keyBadgeClass = `text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`;
                        const editableKeyBadgeClass = `inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 transition-colors ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/45' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200/70 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-700/40 dark:hover:bg-brand-950/60'}`;
                        return (
                          <div key={ss.id} className="px-4 py-2.5">
                            {/* Desktop: original single-row layout */}
                            <div className="hidden lg:flex lg:items-center lg:gap-3">
                              <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                              <SongArtwork song={ss.songs} youtubeUrl={ss.youtube_url || ss.songs?.youtube_url} className="h-10 w-10 rounded-lg" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ss.songs?.title}</p>
                                  {ss.song_category && <span className="badge-blue text-[10px] shrink-0">{ss.song_category}</span>}
                                  {lyricsMissing && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-700/40 shrink-0">
                                      <AlertCircle className="h-3 w-3" />
                                      Lyrics needed
                                    </span>
                                  )}
                                  {displayKey && (canEditSetlistSongDetails ? (
                                    <button
                                      type="button"
                                      onClick={() => openEditSong(ss)}
                                      className={editableKeyBadgeClass}
                                      aria-label={`Edit key for ${ss.songs?.title || 'song'}`}
                                      title="Edit key"
                                    >
                                      <span>{displayKey}</span>
                                      <span className="font-semibold">Edit</span>
                                    </button>
                                  ) : (
                                    <span className={keyBadgeClass}>{displayKey}</span>
                                  ))}
                                </div>
                                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                  <p className="shrink-0 truncate text-xs text-gray-500 dark:text-gray-400">{ss.songs?.artist || 'No artist listed'}</p>
                                  {proposalConflict && <SongProposalConflictBadge conflict={proposalConflict} onOpen={() => setSelectedSongProposals({ songTitle: ss.songs?.title || 'Song', conflict: proposalConflict })} />}
                                </div>
                              </div>
                              {videoUrl && (
                                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors shrink-0" title="Open video" aria-label={`Open video for ${ss.songs?.title || 'song'}`}>
                                  <Play className="h-3 w-3" /> Video
                                </a>
                              )}
                              {canSeeEventSongReadiness && <button
                                type="button"
                                onClick={() => {
                                  if (!ss.songs) return;
                                  setReadinessDetailsReturnToPicker(false);
                                  setReadinessDetailsSong({
                                    songId: ss.song_id,
                                    song: ss.songs,
                                    youtubeUrl: ss.youtube_url || ss.songs.youtube_url || null,
                                  });
                                }}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 shrink-0 transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${readiness.className}`}
                                title={`${readiness.title}${usage ? `; last approved use ${format(parseISO(usage.lastDate), 'MMM d, yyyy')}` : ''}`}
                                aria-label={`Open readiness details for ${ss.songs?.title || 'song'}: ${readiness.label}`}
                              >
                                <ReadinessIcon className="h-3.5 w-3.5" />
                                <span>{readiness.label}</span>
                              </button>}
                              {canEditSetlistSongDetails && <button
                                onClick={() => openLyricsModal(ss)}
                                 title={lyricsSource === 'saved' ? 'Edit lyrics' : lyricsSource === 'chart' ? 'Lyrics are available from the chord chart' : 'Add lyrics'}
                                 className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors shrink-0 ${
                                   lyricsSource !== 'missing'
                                     ? 'bg-green-50 text-green-600 hover:text-green-700 ring-1 ring-green-200/70 dark:bg-green-950/60 dark:text-green-400 dark:hover:text-green-300 dark:ring-green-700/40'
                                     : 'bg-amber-50 text-amber-600 hover:text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-400 dark:hover:text-amber-300 dark:ring-amber-700/40'
                                 }`}
                               >
                                 <FileText className="h-4 w-4" />
                                 <span>{lyricsSource === 'saved' ? 'Edit Lyrics' : lyricsSource === 'chart' ? 'Chart Lyrics' : 'Add Lyrics'}</span>
                               </button>}
                              {(canEditSetlistSongDetails || !!getSetlistSongChartText(ss)) && <button
                                onClick={() => openChartModal(ss)}
                                title={getSetlistSongChartText(ss) ? 'Open chart' : 'Add chart'}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors shrink-0 ${
                                  getSetlistSongChartText(ss)
                                    ? 'bg-emerald-50 text-emerald-600 hover:text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-400 dark:hover:text-emerald-300 dark:ring-emerald-700/40'
                                    : 'bg-gray-50 text-gray-500 hover:text-gray-700 ring-1 ring-gray-200/70 dark:bg-white/[0.04] dark:text-white/45 dark:hover:text-white/70 dark:ring-white/[0.07]'
                                }`}
                              >
                                <Music className="h-4 w-4" />
                                <span>{ss.arrangement_section_order?.length ? 'Arranged' : getSetlistSongChartText(ss) ? 'Chart' : 'Add Chart'}</span>
                              </button>}
                              {canEditSetlistSongDetails && (
                                <button
                                  type="button"
                                  onClick={() => openEditSong(ss)}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 transition-colors hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-200/80 dark:bg-white/[0.04] dark:text-white/45 dark:ring-white/[0.07] dark:hover:bg-brand-950/50 dark:hover:text-brand-300 dark:hover:ring-brand-700/40"
                                  title={`Edit ${ss.songs?.title || 'song'}`}
                                  aria-label={`Edit ${ss.songs?.title || 'song'}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {showSetlistEditControls && ((canManageSetlist && !['approved', 'pending_review'].includes(setlist.status)) || (canEditSetlist)) ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSongFromSetlist(ss.id)}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-200/70 transition-colors hover:bg-red-100 hover:text-red-600 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900/50 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                                  title={`Remove ${ss.songs?.title || 'song'} from setlist`}
                                  aria-label={`Remove ${ss.songs?.title || 'song'} from setlist`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>

                            {/* Mobile: playlist-style track row */}
                            <div className="lg:hidden">
                              <div className="flex items-center gap-3">
                                <SongArtwork song={ss.songs} youtubeUrl={ss.youtube_url || ss.songs?.youtube_url} className="h-11 w-11 rounded-md" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{ss.songs?.title}</p>
                                    {displayKey && (
                                      <span className={keyBadgeClass}>{displayKey}</span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                    {[ss.songs?.artist, ss.song_category].filter(Boolean).join(' · ') || 'No artist listed'}
                                  </p>
                                  {lyricsMissing && (
                                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-700/40">
                                      <AlertCircle className="h-3 w-3" />
                                      Lyrics needed
                                    </span>
                                  )}
                                  <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                                    {canSeeEventSongReadiness && <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (ss.songs) {
                                          setReadinessDetailsReturnToPicker(false);
                                          setReadinessDetailsSong({
                                            songId: ss.song_id,
                                            song: ss.songs,
                                            youtubeUrl: ss.youtube_url || ss.songs.youtube_url || null,
                                          });
                                        }
                                      }}
                                      className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${readiness.className}`}
                                      title={`${readiness.title}${usage ? `; last approved use ${format(parseISO(usage.lastDate), 'MMM d, yyyy')}` : ''}`}
                                      aria-label={`Open readiness details for ${ss.songs?.title || 'song'}: ${readiness.label}`}
                                    >
                                      <ReadinessIcon className="h-3 w-3" />
                                      <span>{readiness.label}</span>
                                    </button>}
                                    {proposalConflict && <SongProposalConflictBadge conflict={proposalConflict} onOpen={() => setSelectedSongProposals({ songTitle: ss.songs?.title || 'Song', conflict: proposalConflict })} />}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {videoUrl && (
                                    <a
                                      href={videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                      className="relative z-10 inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-red-300 transition-colors hover:bg-red-500/[0.12] hover:text-red-200"
                                      title="Open video"
                                      aria-label={`Open video for ${ss.songs?.title || 'song'}`}
                                    >
                                      <Play className="h-4 w-4" />
                                    </a>
                                  )}
                                  {canEditSetlistSongDetails ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openMobileSongActions(ss);
                                      }}
                                      className="relative z-10 inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
                                      title="Song actions"
                                      aria-label={`Open actions for ${ss.songs?.title || 'song'}`}
                                    >
                                      <MoreHorizontal className="h-5 w-5" />
                                    </button>
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4 text-white/30" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 pb-3.5 pt-2">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2.5">
                      {pendingReviewMessage || statusDescriptions[setlist.status]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {/* Song editing — creator/editor when not finalized */}
                      {showSetlistEditControls && ((canManageSetlist && !['approved', 'rejected'].includes(setlist.status)) || (canEditSetlist && setlist.status === 'approved')) ? (
                        <>
                          <button onClick={openSetlistBuilder} className="btn-secondary text-xs">
                            <Plus className="h-3.5 w-3.5" /> Add Song
                          </button>
                          <button onClick={() => setShowAddSong(true)} className="btn-ghost text-xs">
                            <Plus className="h-3.5 w-3.5" /> New Song
                          </button>
                        </>
                      ) : null}

                      {/* CREATOR ACTIONS */}
                      {canSubmitSetlist && setlist.status === 'draft' && (
                        <button
                          onClick={() => handleSetlistAction('pending_review')}
                          disabled={hasMissingLyrics}
                          className="btn-primary text-xs ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="h-3.5 w-3.5" /> Submit Proposal
                        </button>
                      )}
                      {canSubmitSetlist && setlist.status === 'revision_requested' && (
                        <button
                          onClick={() => handleSetlistAction('pending_review')}
                          disabled={hasMissingLyrics}
                          className="btn-primary text-xs ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="h-3.5 w-3.5" /> Resubmit
                        </button>
                      )}
                      {canSubmitSetlist && setlist.status === 'rejected' && (
                        <button onClick={() => handleSetlistAction('draft')} className="btn-secondary text-xs ml-auto">
                          <CheckCircle className="h-3.5 w-3.5" /> Reset to Draft
                        </button>
                      )}

                      {/* REVIEWER ACTIONS — only shown when status is pending_review */}
                      {canReviewSetlist && setlist.status === 'pending_review' && (
                        <>
                          <div className="w-full border-t border-gray-100 dark:border-gray-800 my-1" />
                          <p className="w-full text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leader Review</p>
                          <div className="flex w-full flex-nowrap gap-2 sm:w-auto">
                            <button aria-label="Approve Setlist" onClick={() => handleSetlistAction('approved')} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-2 text-xs font-medium text-white transition-colors hover:bg-green-700 sm:min-h-0 sm:flex-none sm:gap-1.5 sm:px-3 sm:py-1.5">
                              <ThumbsUp className="h-3.5 w-3.5 shrink-0" /> <span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve Setlist</span>
                            </button>
                            <button aria-label="Request Revision" onClick={() => setShowRevisionRequest(true)} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-amber-600 px-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 sm:min-h-0 sm:flex-none sm:gap-1.5 sm:px-3 sm:py-1.5">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span className="sm:hidden">Revise</span><span className="hidden sm:inline">Request Revision</span>
                            </button>
                            <button aria-label="Reject Setlist" onClick={() => setShowRejectModal(true)} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 px-2 text-xs font-medium text-white transition-colors hover:bg-red-700 sm:min-h-0 sm:flex-none sm:gap-1.5 sm:px-3 sm:py-1.5">
                              <X className="h-3.5 w-3.5 shrink-0" /> <span className="sm:hidden">Reject</span><span className="hidden sm:inline">Reject Setlist</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {showSetlistEditControls && (canSubmitSetlist || canManageSetlist) && setlistSongs.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    {missingArtistSongs.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        Add an artist to every song before checking, submitting, or approving this set.
                        <span className="block mt-1 font-medium">
                          Missing: {missingArtistSongs.map(song => song.songs?.title || 'Untitled song').slice(0, 3).join(', ')}{missingArtistSongs.length > 3 ? ` and ${missingArtistSongs.length - 3} more` : ''}
                        </span>
                      </div>
                    )}
                    {hasMissingLyrics && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        Add lyrics to every song before checking or submitting this setlist.
                        <span className="block mt-1 font-medium">
                          Missing: {missingLyricsLabel}{missingLyricsSongs.length > 3 ? ` and ${missingLyricsSongs.length - 3} more` : ''}
                        </span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Service theme (optional, e.g. God is Faithful)"
                      value={serviceTheme}
                      onChange={e => setServiceTheme(e.target.value)}
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                    />
                    <button
                      onClick={() => {
                        if (!ensureArtistsReady('check')) return;
                        if (!ensureLyricsReady('check')) return;
                        navigateCard('checking', 'forward');
                      }}
                      disabled={hasMissingLyrics || missingArtistSongs.length > 0}
                      className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="h-4 w-4" /> Check Setlist
                    </button>
                    {checkReport && (
                      <button
                        onClick={() => navigateCard('report', 'forward')}
                        className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
                      >
                        <FileText className="h-4 w-4" /> View Last Result
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
            </motion.div>
            )}
              </AnimatePresence>
          </div>
        </div>
        )}

          </div>
        )}

        {!assignmentDetailsBlocked && (postEventFeedbackOpen || postEventObservations.length > 0) && (
          <div className="animate-slide-up border-t border-gray-200/70 pt-4 dark:border-white/[0.08]" style={{ animationDelay: '145ms' }}>
            <div>
              <div className="mb-3 space-y-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-gray-900 dark:text-white sm:text-lg">
                    <ClipboardCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <span className="truncate">Past-event Observations</span>
                  </h2>
                  {postEventFeedbackOpen && (
                    <button type="button" onClick={() => setShowObservationModal(true)} className="btn-primary min-h-9 shrink-0 px-2.5 text-[11px] sm:min-h-10 sm:px-3 sm:text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Add Observation
                    </button>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="max-w-2xl text-xs leading-relaxed text-gray-500 dark:text-white/45">
                    Record what worked, what needs attention, and what the team should keep monitoring.
                  </p>
                  {postEventObservations.length > 0 && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${activePostEventObservationCount > 0 ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                      {activePostEventObservationCount > 0 ? `${activePostEventObservationCount} active` : 'All resolved'}
                    </span>
                  )}
                </div>
              </div>

              {postEventFeedbackOpen && (
                <div className="hidden rounded-2xl border border-gray-200/80 bg-white/[0.025] p-3.5 dark:border-white/[0.08]">
                  <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                    <div>
                      <label htmlFor="post-event-category" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Area</label>
                      <select
                        id="post-event-category"
                        value={observationCategory}
                        onChange={event => setObservationCategory(event.target.value as PostEventObservationCategory)}
                        className="input-field min-h-11 text-sm"
                      >
                        {POST_EVENT_CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="post-event-observation" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Comment or observation</label>
                      <textarea
                        id="post-event-observation"
                        value={observationText}
                        onChange={event => setObservationText(event.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="Example: The main microphone cut out twice. Check the cable and monitor it during the next service."
                        className="input-field resize-y text-sm leading-relaxed"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-gray-400 dark:text-white/30">{observationText.length}/2000</span>
                        <button
                          type="button"
                          onClick={handleAddPostEventObservation}
                          disabled={!observationText.trim() || submittingObservation}
                          className="btn-primary min-h-11 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submittingObservation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          {submittingObservation ? 'Adding...' : 'Add observation'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {canManagePostEventObservations && (
                    <div className="mt-3 grid gap-3 border-t border-gray-200/60 pt-3 dark:border-white/[0.06] sm:grid-cols-2">
                      <div>
                        <label htmlFor="post-event-owner" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Follow-up owner (optional)</label>
                        <select
                          id="post-event-owner"
                          value={observationOwnerId}
                          onChange={event => {
                            const ownerId = event.target.value;
                            setObservationOwnerId(ownerId);
                            setObservationDueDate(current => ownerId ? current || format(addDays(new Date(), 1), 'yyyy-MM-dd') : '');
                          }}
                          className="input-field min-h-11 text-sm"
                        >
                          <option value="">No owner yet</option>
                          {members.map(member => (
                            <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="post-event-due-date" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Due date</label>
                        <input
                          id="post-event-due-date"
                          type="date"
                          min={getManilaTodayKey()}
                          value={observationDueDate}
                          onChange={event => setObservationDueDate(event.target.value)}
                          disabled={!observationOwnerId}
                          className="input-field min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {postEventObservations.length === 0 ? (
                <div className="py-5 text-center">
                  <CheckCircle className="mx-auto h-6 w-6 text-emerald-400/70" />
                  <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">No observations yet</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-white/35">Add anything the team should improve, fix, or watch next time.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {postEventObservations.map(observation => {
                    const categoryLabel = POST_EVENT_CATEGORIES.find(category => category.value === observation.category)?.label || 'Other';
                    const authorName = `${observation.profiles?.first_name || ''} ${observation.profiles?.last_name || ''}`.trim() || 'Team member';
                    const assigneeName = `${observation.assignee?.first_name || ''} ${observation.assignee?.last_name || ''}`.trim();
                    const isObservationOwner = observation.assigned_to === user?.id;
                    const isObservationOverdue = !!observation.due_date && observation.status !== 'resolved' && observation.due_date < getManilaTodayKey();
                    const statusClass = observation.status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/15'
                      : observation.status === 'monitoring'
                        ? 'bg-blue-500/10 text-blue-300 ring-blue-500/15'
                        : 'bg-amber-500/10 text-amber-300 ring-amber-500/15';
                    const observationReplies = postEventObservationReplies.filter(reply => reply.observation_id === observation.id);
                    const observationViewers = getPostEventObservationViewers(
                      postEventObservationViews.filter(view => view.observation_id === observation.id),
                      observation.author_id
                    );

                    return (
                      <ObservationSeenCard
                        key={observation.id}
                        observationId={observation.id}
                        authorId={observation.author_id}
                        onSeen={handleObservationSeen}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar
                            src={observation.profiles?.avatar_url}
                            firstName={observation.profiles?.first_name || '?'}
                            lastName={observation.profiles?.last_name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4">
                              <span className="font-bold text-gray-800 dark:text-white/90">{authorName}</span>
                              <span className="text-gray-400 dark:text-white/25">|</span>
                              <span className="text-gray-500 dark:text-white/55">{format(parseISO(observation.created_at), 'MMM d, h:mm a')}</span>
                              <span className="text-gray-400 dark:text-white/25">|</span>
                              <span className="font-bold uppercase tracking-[0.06em] text-gray-500 dark:text-white/65">{categoryLabel}</span>
                              <span className="text-gray-400 dark:text-white/25">|</span>
                              <span className={`font-bold ${statusClass.includes('blue') ? 'text-blue-500 dark:text-blue-300' : statusClass.includes('emerald') ? 'text-emerald-500 dark:text-emerald-300' : 'text-amber-500 dark:text-amber-300'}`}>{POST_EVENT_STATUS_LABELS[observation.status]}</span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-gray-700 dark:text-white/[0.92]">{observation.observation}</p>
                            {observation.assigned_to && observation.due_date && (
                              <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2.5 py-2 text-[11px] font-semibold ${isObservationOverdue ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'}`}>
                                <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Owner: {assigneeName || 'Assigned member'}</span>
                                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {isObservationOverdue ? 'Overdue: ' : 'Due: '}{format(parseISO(observation.due_date), 'MMM d, yyyy')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {observationReplies.length > 0 && (
                          <div className="ml-9 mt-2 space-y-1.5 border-l border-gray-200/70 pl-2.5 dark:border-white/[0.10]">
                            {observationReplies.map(reply => {
                              const replyAuthor = `${reply.profiles?.first_name || ''} ${reply.profiles?.last_name || ''}`.trim() || 'Team member';
                              return (
                                <div key={reply.id} className="rounded-lg bg-gray-50/80 px-2.5 py-2 dark:bg-white/[0.035]">
                                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4">
                                    <Avatar src={reply.profiles?.avatar_url} firstName={reply.profiles?.first_name || '?'} lastName={reply.profiles?.last_name} size="xs" />
                                    <span className="truncate font-bold text-gray-800 dark:text-white/85">{replyAuthor}</span>
                                    <span className="text-gray-400 dark:text-white/25">|</span>
                                    <span className="shrink-0 text-gray-500 dark:text-white/45">{format(parseISO(reply.created_at), 'MMM d, h:mm a')}</span>
                                  </div>
                                  <p className="mt-0.5 whitespace-pre-wrap break-words pl-7 text-xs leading-4 text-gray-700 dark:text-white/75">{reply.content}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {replyingToObservationId === observation.id && (
                          <div className="ml-9 mt-2 flex items-end gap-2">
                            <textarea
                              value={observationReplyText}
                              onChange={event => setObservationReplyText(event.target.value)}
                              placeholder="Write a reply…"
                              maxLength={2000}
                              rows={2}
                              autoFocus
                              className="post-event-observation-reply-input input-field min-h-12 flex-1 resize-none text-sm"
                            />
                            <button type="button" onClick={() => void handlePostObservationReply(observation.id)} disabled={!observationReplyText.trim() || postingObservationReply} className="btn-primary min-h-11 px-3 text-xs disabled:opacity-50">
                              {postingObservationReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Send
                            </button>
                          </div>
                        )}

                        <div className="mt-2 flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden border-t border-gray-200/60 pt-2 dark:border-white/[0.06] sm:flex-wrap sm:justify-end sm:gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenObservationViewers(observation.id)}
                            aria-label={`View who has seen this observation (${observationViewers.length})`}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-500 transition-colors hover:border-brand-300 hover:bg-brand-500/10 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white/75 sm:w-auto sm:gap-1.5 sm:px-2.5"
                          >
                            <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Seen {observationViewers.length}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToObservationId(current => current === observation.id ? null : observation.id);
                              setObservationReplyText('');
                            }}
                            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 text-[11px] font-semibold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-brand-300 dark:hover:bg-white/[0.08] sm:gap-1.5 sm:px-2.5 sm:text-xs"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Reply{observationReplies.length > 0 ? ` (${observationReplies.length})` : ''}
                          </button>
                          {(canManagePostEventObservations || isObservationOwner || observation.author_id === user?.id) && (<>
                            {(canManagePostEventObservations || isObservationOwner) && (
                              <div className="relative min-w-0 flex-1 sm:min-w-[7.75rem] sm:flex-none">
                                <select
                                  value={observation.status}
                                  onChange={event => handleUpdateObservationStatus(observation.id, event.target.value as PostEventObservationStatus)}
                                  disabled={updatingObservationId === observation.id}
                                  aria-label={`Update status for ${categoryLabel} observation`}
                                  className="h-9 w-full appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-2.5 pr-6 text-[10px] font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 sm:h-10 sm:py-2 sm:pl-3 sm:pr-9 sm:text-xs"
                                >
                                  <option value="open">Needs action</option>
                                  <option value="monitoring">Monitoring</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-white/45 sm:right-3 sm:h-3.5 sm:w-3.5" />
                              </div>
                            )}
                            {canManagePostEventObservations && (
                              <button
                                type="button"
                                onClick={() => openObservationFollowUp(observation)}
                                disabled={updatingObservationId === observation.id}
                                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 sm:h-10 sm:gap-1.5 sm:px-3 sm:text-xs"
                              >
                                <Calendar className="h-3.5 w-3.5" />
                                {observation.assigned_to ? 'Edit' : 'Assign'}
                              </button>
                            )}
                            {(canManagePostEventObservations || observation.author_id === user?.id) && (
                              <button
                                type="button"
                                onClick={() => handleDeletePostEventObservation(observation.id)}
                                disabled={updatingObservationId === observation.id}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/35 sm:h-10 sm:w-10"
                                title="Delete observation"
                                aria-label="Delete observation"
                              >
                                {updatingObservationId === observation.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </>)}
                        </div>
                      </ObservationSeenCard>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!assignmentDetailsBlocked && (!postEventFeedbackOpen || showPastEventDetails) && (
        <div className="animate-slide-up border-t border-gray-200/70 pt-4 dark:border-white/[0.08]" style={{ animationDelay: '150ms' }}>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                <Users className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="truncate">Team Members</span>
              </h2>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-white/45">{confirmedCount}/{assignments.length} confirmed</span>
                {isLeader && (
                  <button
                    onClick={openAssignModal}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[11px] font-bold text-white/85 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] active:scale-[0.97]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign
                  </button>
                )}
              </div>
            </div>
            {canSendAssignmentReminders && pendingAssignmentUserCount > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-300">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-900 dark:text-white">
                      {pendingAssignmentUserCount} {pendingAssignmentUserCount === 1 ? 'member' : 'members'} awaiting confirmation
                    </p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-white/40">Send one reminder to each pending member</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssignmentReminder(true)}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-amber-400 px-3.5 text-[11px] font-black text-black transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.97]"
                >
                  Remind
                </button>
              </div>
            )}
            {assignments.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No team members assigned yet</p>
            ) : (
              <div className="space-y-1">
                {[...assignments]
                  .sort((a, b) => {
                    const aIsSongLeader = a.roles?.name === 'Song Leader';
                    const bIsSongLeader = b.roles?.name === 'Song Leader';
                    if (aIsSongLeader && !bIsSongLeader) return -1;
                    if (!aIsSongLeader && bIsSongLeader) return 1;
                    return 0;
                  })
                  .map(a => {
                    const isSongLeaderRole = a.roles?.name === 'Song Leader';
                    const declineNoteOpen = expandedDeclineNotes.has(a.id);
                    return (
                      <div key={a.id}>
                        <div className="group flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.04]">
                          <Avatar
                            src={a.profiles?.avatar_url}
                            firstName={a.profiles?.first_name || '?'}
                            lastName={a.profiles?.last_name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{a.profiles?.first_name} {a.profiles?.last_name}</p>
                              {isSongLeaderRole && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 shadow-[0_0_10px_rgba(34,197,94,0.7)]" />
                              )}
                            </div>
                            {a.roles && <RoleBadge role={a.roles} size="sm" />}
                            {a.status === 'declined' && a.decline_reason && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedDeclineNotes(prev => {
                                    const next = new Set(prev);
                                    if (next.has(a.id)) {
                                      next.delete(a.id);
                                    } else {
                                      next.add(a.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-red-200/80 transition-colors hover:bg-red-500/[0.13] hover:text-red-100"
                                aria-expanded={declineNoteOpen}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-red-300/80 shadow-[0_0_10px_rgba(252,165,165,0.4)]" />
                                {declineNoteOpen ? 'Hide note' : 'View note'}
                              </button>
                            )}
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${a.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-300' : a.status === 'declined' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{a.status}</span>
                          {isLeader && (
                            <button
                              onClick={() => handleRemoveAssignment(a.id)}
                              disabled={removingAssignmentId !== null}
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                              title={`Remove ${a.profiles?.first_name || 'team member'} from this event`}
                              aria-label={`Remove ${a.profiles?.first_name || 'team member'} from this event`}
                            >
                              <Trash2 className={`h-3.5 w-3.5 ${removingAssignmentId === a.id ? 'animate-pulse text-red-500' : ''}`} />
                            </button>
                          )}
                        </div>
                        <AnimatePresence initial={false}>
                          {a.status === 'declined' && a.decline_reason && declineNoteOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0, y: -4 }}
                              animate={{ height: 'auto', opacity: 1, y: 0 }}
                              exit={{ height: 0, opacity: 0, y: -4 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="ml-12 mr-2 mb-1 flex items-start gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-[12px] leading-snug text-white/50 ring-1 ring-white/[0.06]">
                                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-red-300/80 shadow-[0_0_10px_rgba(252,165,165,0.4)]" />
                                <p className="min-w-0">{a.decline_reason}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        )}

        <Modal
          open={Boolean(readinessDetailsSong)}
          onClose={() => {
            setReadinessDetailsSong(null);
            if (readinessDetailsReturnToPicker) setShowSetlist(true);
            setReadinessDetailsReturnToPicker(false);
          }}
          title="Song readiness"
          size="md"
          mobileView="dialog"
          instantOpen
        >
          {readinessDetailsSong && (() => {
            const usage = songUsage[readinessDetailsSong.songId];
            const projection = projectSongReadiness(usage?.lastDate, event.event_date);
            const readiness = getSongReadinessBadge(usage, event.event_date);
            const ReadinessIcon = readiness.Icon;
            const targetDateLabel = format(parseISO(event.event_date), 'MMM d, yyyy');
            const readyDateLabel = projection.readyDate
              ? format(parseISO(projection.readyDate), 'MMM d, yyyy')
              : null;
            const explanation = projection.daysAtTarget === null
              ? `No earlier approved use was found before ${targetDateLabel}. New or never-used songs meet the ${SONG_READINESS_RULE_DAYS}-day rule.`
              : projection.meetsRule
                ? `${projection.daysAtTarget} days will have passed since the last approved use. That clears the ${SONG_READINESS_RULE_DAYS}-day rule by ${projection.daysAtTarget - SONG_READINESS_RULE_DAYS} days.`
                : `Only ${projection.daysAtTarget} days will have passed since the last approved use. The song needs ${projection.shortfallDays} more days and becomes ready on ${readyDateLabel}.`;

            return (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-gray-200/80 bg-gray-50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <SongArtwork
                    song={readinessDetailsSong.song}
                    youtubeUrl={readinessDetailsSong.youtubeUrl}
                    className="h-12 w-12 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-gray-950 dark:text-white">
                      {readinessDetailsSong.song.title || 'Untitled song'}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-500 dark:text-white/45">
                      {readinessDetailsSong.song.artist || 'No artist listed'}
                    </p>
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${readiness.className}`}>
                      <ReadinessIcon className="h-3.5 w-3.5" />
                      {readiness.label}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-600 dark:bg-white/[0.06] dark:text-white/55">
                        Key {readinessDetailsSong.song.song_key || 'not set'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                        getSongLyricsSource(readinessDetailsSong.song) === 'missing'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300'
                      }`}>
                        {getSongLyricsSource(readinessDetailsSong.song) === 'saved'
                          ? 'Lyrics saved'
                          : getSongLyricsSource(readinessDetailsSong.song) === 'chart'
                            ? 'Lyrics from chart'
                            : 'Lyrics missing'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                        readinessDetailsSong.song.chordpro_text
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-white/45'
                      }`}>
                        {readinessDetailsSong.song.chordpro_text ? 'Chart available' : 'No chart'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl p-4 ring-1 ${
                  projection.meetsRule
                    ? 'bg-emerald-50 text-emerald-950 ring-emerald-200/80 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-800/50'
                    : 'bg-red-50 text-red-950 ring-red-200/80 dark:bg-red-950/35 dark:text-red-100 dark:ring-red-800/50'
                }`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
                    Why this status
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed">{explanation}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-gray-100 p-3 dark:bg-white/[0.045]">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">Last used</p>
                    <p className="mt-1 text-xs font-bold text-gray-800 dark:text-white/80">
                      {usage ? format(parseISO(usage.lastDate), 'MMM d, yyyy') : 'Never'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-100 p-3 dark:bg-white/[0.045]">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">Ready date</p>
                    <p className="mt-1 text-xs font-bold text-gray-800 dark:text-white/80">
                      {readyDateLabel || 'Already ready'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-100 p-3 dark:bg-white/[0.045]">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">This event</p>
                    <p className="mt-1 text-xs font-bold text-gray-800 dark:text-white/80">{targetDateLabel}</p>
                  </div>
                </div>

                {usage ? (
                  <div className="rounded-2xl border border-gray-200/80 p-4 dark:border-white/[0.08]">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">
                      Last approved use
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                        <Calendar className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-gray-900 dark:text-white">{usage.eventTitle}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-white/45">
                          {usage.eventType} · {format(parseISO(usage.lastDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReadinessDetailsReturnToPicker(false);
                          setReadinessDetailsSong(null);
                          navigate(`/events/${usage.eventId}`);
                        }}
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-gray-100 px-3 text-[11px] font-black text-gray-700 transition-colors hover:bg-gray-200 dark:bg-white/[0.07] dark:text-white/75 dark:hover:bg-white/[0.11]"
                      >
                        Open event
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:border-white/[0.08] dark:text-white/40">
                    No approved previous event was found for this song.
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>

        <Modal
          open={Boolean(viewingObservationId)}
          onClose={() => setViewingObservationId(null)}
          title="Seen by"
          size="sm"
          mobileView="dialog"
        >
          <div className="space-y-3">
            {loadingObservationViews ? (
              <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-sm text-gray-500 dark:text-white/45">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading viewers…
              </div>
            ) : viewingObservationViewers.length === 0 ? (
              <div className="py-7 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.05] dark:text-white/30">
                  <Eye aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-gray-800 dark:text-white/80">No viewers yet</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-white/40">No one else has seen this observation yet.</p>
              </div>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-gray-500 dark:text-white/45">
                  {viewingObservationViewers.length === 1
                    ? '1 person has seen this observation.'
                    : `${viewingObservationViewers.length} people have seen this observation.`}
                </p>
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {viewingObservationViewers.map(viewer => {
                    const viewerName = `${viewer.profiles?.first_name || ''} ${viewer.profiles?.last_name || ''}`.trim() || 'Team member';
                    return (
                      <div key={viewer.user_id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04]">
                        <Avatar
                          src={viewer.profiles?.avatar_url}
                          firstName={viewer.profiles?.first_name || '?'}
                          lastName={viewer.profiles?.last_name}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-gray-800 dark:text-white/85">
                            {viewerName}{viewer.user_id === user?.id ? ' (You)' : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/40">
                            Seen {format(parseISO(viewer.viewed_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Modal>

        <Modal
          open={showAssignmentReminder}
          onClose={() => !sendingAssignmentReminder && setShowAssignmentReminder(false)}
          title="Remind Pending Members"
          size="sm"
          mobileView="dialog"
          closeOnBackdrop={!sendingAssignmentReminder}
          closeOnEscape={!sendingAssignmentReminder}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-300">
                <BellRing className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug text-gray-900 dark:text-white">
                  Send {pendingAssignmentUserCount === 1 ? 'a reminder to 1 member' : `reminders to ${pendingAssignmentUserCount} members`}?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-white/45">
                  Each member will receive one notification, even if they have multiple roles for this event.
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-white/45">
              Confirmed and declined members will not be notified. Push delivery follows each member's notification settings.
            </p>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/60 pt-4 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowAssignmentReminder(false)}
                disabled={sendingAssignmentReminder}
                className="btn-secondary min-h-11 w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendAssignmentReminders}
                disabled={sendingAssignmentReminder || pendingAssignmentUserCount === 0}
                className="btn-primary min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingAssignmentReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {sendingAssignmentReminder ? 'Sending...' : 'Send Reminder'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showObservationModal}
          onClose={() => !submittingObservation && setShowObservationModal(false)}
          title="Add Observation"
          size="md"
          mobileView="dialog"
          closeOnBackdrop={!submittingObservation}
          closeOnEscape={!submittingObservation}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="post-event-modal-category" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Area</label>
              <select id="post-event-modal-category" value={observationCategory} onChange={event => setObservationCategory(event.target.value as PostEventObservationCategory)} className="input-field min-h-11 text-sm">
                {POST_EVENT_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="post-event-modal-observation" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Comment or Observation</label>
              <textarea id="post-event-modal-observation" value={observationText} onChange={event => setObservationText(event.target.value)} maxLength={2000} rows={4} autoFocus placeholder="Example: The main microphone cut out twice. Check the cable and monitor it during the next service." className="input-field resize-y text-sm leading-relaxed" />
              <p className="mt-1.5 text-right text-[11px] text-gray-400 dark:text-white/30">{observationText.length}/2000</p>
            </div>
            {canManagePostEventObservations && (
              <div className="grid gap-3 border-t border-gray-200/60 pt-4 dark:border-white/[0.06] sm:grid-cols-2">
                <div>
                  <label htmlFor="post-event-modal-owner" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Follow-up Owner (Optional)</label>
                  <select id="post-event-modal-owner" value={observationOwnerId} onChange={event => { const ownerId = event.target.value; setObservationOwnerId(ownerId); setObservationDueDate(current => ownerId ? current || format(addDays(new Date(), 1), 'yyyy-MM-dd') : ''); }} className="input-field min-h-11 text-sm">
                    <option value="">No owner yet</option>
                    {members.map(member => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="post-event-modal-due-date" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Due Date</label>
                  <input id="post-event-modal-due-date" type="date" min={getManilaTodayKey()} value={observationDueDate} onChange={event => setObservationDueDate(event.target.value)} disabled={!observationOwnerId} className="input-field min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/60 pt-4 dark:border-white/[0.06]">
              <button type="button" onClick={() => setShowObservationModal(false)} disabled={submittingObservation} className="btn-secondary min-h-11 w-full whitespace-nowrap">Cancel</button>
              <button type="button" onClick={handleAddPostEventObservation} disabled={!observationText.trim() || submittingObservation} className="btn-primary min-h-11 w-full whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-50">
                {submittingObservation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submittingObservation ? 'Adding...' : 'Add Observation'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showAssign}
          onClose={closeAssignModal}
          title="Assign Team Members"
          size="lg"
          closeOnBackdrop={!assigningBatch}
          closeOnEscape={!assigningBatch}
        >
          <div className="space-y-4">
            {canManageTeamTemplates && (
              <section className="space-y-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.055] p-3.5">
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">Team template</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-white/45">Admins and Admin Coordinators can reuse a team, then change any member for this event.</p>
                </div>
                <Select
                  value={selectedTeamTemplateId}
                  onChange={applyTeamTemplate}
                  options={teamTemplates.map(template => ({ value: template.id, label: template.name }))}
                  placeholder={teamTemplates.length ? 'Select a saved team' : 'No saved teams yet'}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={teamTemplateName}
                    onChange={event => setTeamTemplateName(event.target.value)}
                    className="input-field min-h-11 flex-1"
                    maxLength={80}
                    placeholder="Template name, e.g. Sunday Team A"
                  />
                  <button type="button" onClick={() => void saveTeamTemplate('create')} disabled={savingTeamTemplate} className="btn-secondary min-h-11 whitespace-nowrap">
                    {savingTeamTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save New
                  </button>
                  {selectedTeamTemplateId && (
                    <button type="button" onClick={() => void saveTeamTemplate('update')} disabled={savingTeamTemplate} className="btn-secondary min-h-11 whitespace-nowrap">
                      Update Template
                    </button>
                  )}
                </div>
              </section>
            )}

            <div className="flex items-start justify-between gap-3 rounded-2xl bg-gray-50 px-3.5 py-3 ring-1 ring-black/[0.04] dark:bg-white/[0.035] dark:ring-white/[0.06]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Build the team in one batch</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-white/45">Add as many role and member pairs as you need, then assign everyone together.</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
                {expandedEventAssignments.length} ready
              </span>
            </div>

            <div className="max-h-[48dvh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
              {assignmentDrafts.map((row, index) => {
                const eligibleMembers = getEligibleAssignmentMembers(row.role_id, row.id);
                const isAllMembersRole = roles.find(role => role.id === row.role_id)?.name === 'All Members';
                const isBackupVocalsRole = roles.find(role => role.id === row.role_id)?.name === 'Backup Vocals';
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.025] dark:shadow-none"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-white/35">
                        Assignment {String(index + 1).padStart(2, '0')}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeAssignmentDraft(row.id)}
                        disabled={assigningBatch}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        aria-label={`Remove assignment ${index + 1}`}
                        title="Remove this assignment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Role</label>
                        <Select
                          value={row.role_id}
                          onChange={value => updateAssignmentDraft(row.id, 'role_id', value)}
                          options={getAvailableAssignmentRoles(row.id, row.role_id).map(role => ({ value: role.id, label: role.name }))}
                          placeholder="Select role"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-white/55">Member</label>
                        {isBackupVocalsRole ? (
                          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-white/10 dark:bg-white/[0.035]">
                            {eligibleMembers.length === 0 ? (
                              <p className="px-2 py-3 text-center text-xs text-gray-500 dark:text-white/40">No eligible Backup Vocalists available</p>
                            ) : eligibleMembers.map(member => {
                              const checked = (multiMemberSelections[row.id] || []).includes(member.id);
                              return (
                                <label key={member.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-white dark:text-white/75 dark:hover:bg-white/[0.06]">
                                  <input type="checkbox" checked={checked} onChange={() => toggleMultiMember(row.id, member.id)} className="h-4 w-4 accent-emerald-500" />
                                  <span className="min-w-0 flex-1 truncate">{member.first_name} {member.last_name}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <Select
                            value={row.user_id}
                            onChange={value => updateAssignmentDraft(row.id, 'user_id', value)}
                            options={isAllMembersRole
                              ? [{ value: ALL_MEMBERS_USER_ID, label: `All active members (${expandedEventAssignments.length})` }]
                              : eligibleMembers.map(member => ({ value: member.id, label: `${member.first_name} ${member.last_name}` }))}
                            placeholder={row.role_id ? 'Select member' : 'Pick role first'}
                          />
                        )}
                      </div>
                    </div>

                    {row.role_id && !isAllMembersRole && !isBackupVocalsRole && eligibleMembers.length === 0 && !row.user_id && (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">Everyone with this role is already assigned, or no member has it yet.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addAssignmentDraft}
              disabled={assigningBatch}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 text-sm font-bold text-gray-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.12] dark:bg-white/[0.025] dark:text-white/60 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-500/[0.08] dark:hover:text-emerald-300"
            >
              <Plus className="h-4 w-4" /> Add another assignment
            </button>

            {(assignmentBatch.duplicateCount > 0 || assignmentBatch.incompleteCount > 0) && assignmentBatch.assignments.length > 0 && (
              <p className="text-center text-xs text-gray-500 dark:text-white/40">
                Complete every row and remove duplicates to assign the batch.
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
              <button type="button" onClick={closeAssignModal} disabled={assigningBatch} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigningBatch || assignmentBatch.assignments.length === 0 || assignmentBatch.incompleteCount > 0 || assignmentBatch.duplicateCount > 0 || hasEmptyMultiSelection}
                className="btn-primary min-w-28"
              >
                {assigningBatch
                  ? 'Assigning...'
                  : expandedEventAssignments.length > 1
                  ? `Assign all (${expandedEventAssignments.length})`
                  : 'Assign member'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={!!editingObservationFollowUpId}
          onClose={() => { if (!updatingObservationId) setEditingObservationFollowUpId(null); }}
          title="Assign observation follow-up"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Choose who will handle this observation and when it should be finished. They will receive reminders until it is resolved.
            </p>
            <div>
              <label htmlFor="observation-follow-up-owner" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Owner</label>
              <select
                id="observation-follow-up-owner"
                value={observationFollowUpForm.assigned_to}
                onChange={event => {
                  const assignedTo = event.target.value;
                  setObservationFollowUpForm(current => ({
                    assigned_to: assignedTo,
                    due_date: assignedTo ? current.due_date || format(addDays(new Date(), 1), 'yyyy-MM-dd') : '',
                  }));
                }}
                className="input-field min-h-11"
              >
                <option value="">No owner</option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="observation-follow-up-date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Due date</label>
              <input
                id="observation-follow-up-date"
                type="date"
                min={getManilaTodayKey()}
                value={observationFollowUpForm.due_date}
                onChange={event => setObservationFollowUpForm(current => ({ ...current, due_date: event.target.value }))}
                disabled={!observationFollowUpForm.assigned_to}
                className="input-field min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingObservationFollowUpId(null)} disabled={!!updatingObservationId} className="btn-secondary disabled:opacity-60">Cancel</button>
              <button
                type="button"
                onClick={handleSaveObservationFollowUp}
                disabled={!!updatingObservationId || Boolean(observationFollowUpForm.assigned_to) !== Boolean(observationFollowUpForm.due_date)}
                className="btn-primary disabled:opacity-60"
              >
                {updatingObservationId ? 'Saving...' : observationFollowUpForm.assigned_to ? 'Save follow-up' : 'Clear assignment'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showSetlist}
          onClose={requestSetlistBuilderClose}
          title={setlist ? 'Add Songs to Setlist' : 'Build Setlist'}
          size="lg"
        >
          <div className="space-y-3">
            {setlistBuilderSongs.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/15 dark:bg-emerald-500/[0.06]">
                <div className="flex items-center justify-between gap-3 border-b border-emerald-200/70 px-3 py-2.5 dark:border-emerald-400/10">
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                      Selected songs ({setlistBuilderSongs.length})
                    </p>
                    <p className="mt-0.5 text-[10px] text-emerald-700/70 dark:text-emerald-200/55">Drag or use the arrows to set the service order.</p>
                  </div>
                  <ListOrdered className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5 scrollbar-thin">
                  {setlistBuilderSongs.map((draft, index) => {
                    const song = songs.find(candidate => candidate.id === draft.song_id);
                    if (!song) return null;
                    return (
                      <div
                        key={draft.song_id}
                        draggable
                        onDragStart={() => setSetlistBuilderDragIndex(index)}
                        onDragOver={event => {
                          event.preventDefault();
                          if (setlistBuilderDragIndex === null || setlistBuilderDragIndex === index) return;
                          moveSetlistBuilderSong(setlistBuilderDragIndex, index);
                          setSetlistBuilderDragIndex(index);
                        }}
                        onDragEnd={() => setSetlistBuilderDragIndex(null)}
                        className={`flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${setlistBuilderDragIndex === index ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'hover:bg-white/70 dark:hover:bg-white/[0.04]'}`}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-emerald-500/60 active:cursor-grabbing" aria-hidden="true" />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-black/20 dark:text-emerald-200 dark:ring-emerald-400/15">{index + 1}</span>
                        <SongArtwork song={song} youtubeUrl={draft.youtube_url || song.youtube_url} className="h-9 w-9 rounded-lg" />
                        <button type="button" onClick={() => openSongConfig(draft.song_id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{song.title}</p>
                          <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                            {[draft.category, draft.performed_key].filter(Boolean).join(' · ')}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSetlistBuilderSong(index, index - 1)}
                            disabled={index === 0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-emerald-700 disabled:opacity-25 dark:hover:bg-white/[0.06] dark:hover:text-emerald-200"
                            aria-label={`Move ${song.title} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSetlistBuilderSong(index, index + 1)}
                            disabled={index === setlistBuilderSongs.length - 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-emerald-700 disabled:opacity-25 dark:hover:bg-white/[0.06] dark:hover:text-emerald-200"
                            aria-label={`Move ${song.title} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSetlistBuilderSongs(current => current.filter(item => item.song_id !== draft.song_id))}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                            aria-label={`Remove ${song.title}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Search songs..."
                className="input-field pl-9 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            <div className={`${setlistBuilderSongs.length > 0 ? 'h-[34dvh] sm:h-[34vh]' : 'h-[56dvh] sm:h-[50vh]'} max-h-[34rem] space-y-1 overflow-y-auto scrollbar-thin`}>
              {songs
                .filter(s => !setlistSongs.some(ss => ss.song_id === s.id) && !setlistBuilderSongs.some(draft => draft.song_id === s.id))
                .filter(s => {
                  const q = songSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.title.toLowerCase().includes(q) ||
                    (s.artist && s.artist.toLowerCase().includes(q))
                  );
                })
                .map(song => {
                  const usage = songUsage[song.id];
                  const projection = projectSongReadiness(usage?.lastDate, event.event_date);
                  const eventDateLabel = format(parseISO(event.event_date), 'MMM d');
                  const proposalReservation = songProposalReservations[song.id];
                  return (
                    <div
                      key={song.id}
                      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${proposalReservation
                        ? 'cursor-not-allowed bg-amber-50/80 opacity-80 ring-1 ring-inset ring-amber-300/80 dark:bg-amber-500/[0.08] dark:ring-amber-500/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      <button
                        type="button"
                        onClick={() => proposalReservation
                          ? setSelectedSongReservationDetails({ songTitle: song.title, reservation: proposalReservation })
                          : openSongConfig(song.id)}
                        aria-label={proposalReservation ? `View duplicate proposal details for ${song.title}` : `Configure ${song.title}`}
                        title={proposalReservation ? getProposalReservationMessage(proposalReservation) : undefined}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      >
                        <SongArtwork song={song} youtubeUrl={song.youtube_url} className="h-11 w-11 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{song.title}</p>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            <span className={`truncate text-xs ${song.artist?.trim() ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>
                              {song.artist?.trim() || 'Artist required before use'}
                            </span>
                            {song.song_key && (
                              <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 dark:bg-white/[0.06] dark:text-white/45">
                                {song.song_key}
                              </span>
                            )}
                            {proposalReservation && (
                              <span className="inline-flex min-w-0 shrink items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
                                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">Duplicate - Open to see details</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReadinessDetailsReturnToPicker(true);
                          setShowSetlist(false);
                          setReadinessDetailsSong({
                            songId: song.id,
                            song,
                            youtubeUrl: song.youtube_url || null,
                          });
                        }}
                        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${projection.meetsRule
                          ? 'bg-green-50 text-green-700 ring-green-200/70 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-700/40'
                          : 'bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-700/40'}`}
                        title={projection.daysAtTarget === null ? `New song; meets the rule by ${eventDateLabel}` : `${projection.daysAtTarget} days since last approved use by ${eventDateLabel}`}
                        aria-label={`Open readiness details for ${song.title}: ${projection.meetsRule ? 'Meets' : `${projection.shortfallDays}d short`} · ${eventDateLabel}`}
                      >
                        {projection.meetsRule ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                        <span>{projection.meetsRule ? 'Meets' : `${projection.shortfallDays}d short`} · {eventDateLabel}</span>
                      </button>
                    </div>
                  );
                })}
              {songs
                .filter(s => !setlistSongs.some(ss => ss.song_id === s.id) && !setlistBuilderSongs.some(draft => draft.song_id === s.id))
                .filter(s => {
                  const q = songSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    s.title.toLowerCase().includes(q) ||
                    (s.artist && s.artist.toLowerCase().includes(q))
                  );
                }).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">
                  {songSearch.trim() ? 'No songs found' : 'No more songs available'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setShowSetlist(false); setShowAddSong(true); }}
              className="btn-secondary w-full"
            >
              <Plus className="h-4 w-4" /> Create New Song
            </button>
            <button
              type="button"
              onClick={saveSetlistBuilder}
              disabled={setlistBuilderSongs.length === 0 || savingSetlistBuilder}
              className="btn-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingSetlistBuilder
                ? 'Saving setlist…'
                : setlistBuilderSongs.length === 0
                  ? 'Select songs to continue'
                  : setlist
                    ? `Add ${setlistBuilderSongs.length} ${setlistBuilderSongs.length === 1 ? 'song' : 'songs'}`
                    : `Create setlist with ${setlistBuilderSongs.length} ${setlistBuilderSongs.length === 1 ? 'song' : 'songs'}`}
            </button>
          </div>
        </Modal>

        <Modal open={showAddSong} onClose={() => { if (!creatingSong) { setShowAddSong(false); setNewSongError(''); if (setlistBuilderActive) setShowSetlist(true); } }} title="Create New Song" size="lg">
          <form onSubmit={e => { e.preventDefault(); handleCreateSong(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
              <input
                type="text"
                value={newSong.title}
                onChange={e => {
                  setNewSong({ ...newSong, title: e.target.value });
                  if (newSongError) setNewSongError('');
                }}
                className={`input-field ${newSongTitleMatch ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25' : ''}`}
                aria-invalid={Boolean(newSongTitleMatch)}
                aria-describedby={newSongTitleMatch ? 'new-song-title-match' : undefined}
                required
              />
              {newSongTitleMatch && (
                <p id="new-song-title-match" className="mt-2 rounded-xl border border-amber-300/30 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  “{newSongTitleMatch.title}” already exists{newSongTitleMatch.artist ? ` by ${newSongTitleMatch.artist}` : ''}. Close this form and select that song from the library.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Artist <span className="text-red-500">*</span></label>
              <input type="text" value={newSong.artist} onChange={e => setNewSong({ ...newSong, artist: e.target.value })} className="input-field" placeholder="Who sings this version?" required />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This helps the team choose the correct song and thumbnail.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Duration</label>
              <input type="text" value={newSong.duration} onChange={e => setNewSong({ ...newSong, duration: e.target.value })} className="input-field" placeholder="e.g., 4:30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={newSong.youtube_url}
                onChange={e => setNewSong({ ...newSong, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            {newSongError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {newSongError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowAddSong(false); setNewSongError(''); if (setlistBuilderActive) setShowSetlist(true); }} disabled={creatingSong} className="btn-secondary disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleCreateSong} disabled={creatingSong || !newSong.title.trim() || !newSong.artist.trim() || Boolean(newSongTitleMatch)} className="btn-primary disabled:opacity-60">
                {creatingSong ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          open={showSongConfig}
          onClose={closeSongConfigFlow}
          onBack={setlistBuilderActive ? () => resetSongConfigModal(true) : undefined}
          backLabel="Back to song list"
          title="Configure Song"
          size="lg"
          footer={(
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => resetSongConfigModal(setlistBuilderActive)}
                disabled={addingSetlistSong}
                className="btn-secondary min-h-12 min-w-0 w-full justify-center whitespace-nowrap px-3 disabled:opacity-60 sm:min-h-11 sm:w-auto sm:min-w-32"
              >
                {setlistBuilderActive ? 'Back to Songs' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmAddSong}
                disabled={!songConfig.category || !songConfig.artist.trim() || addingSetlistSong || selectedSongConfigProjection?.meetsRule === false}
                className={selectedSongConfigProjection?.meetsRule === false
                  ? 'inline-flex min-h-12 min-w-0 w-full cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-red-300 bg-red-50 px-3 text-[11px] font-black text-red-700 opacity-100 shadow-none dark:border-red-500/35 dark:bg-red-500/[0.12] dark:text-red-200 sm:min-h-11 sm:w-auto sm:min-w-40 sm:text-xs'
                  : 'btn-primary min-h-12 min-w-0 w-full justify-center whitespace-nowrap px-3 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:w-auto sm:min-w-40'}
                title={selectedSongConfigProjection?.meetsRule === false
                  ? `Not ready for this event — ${selectedSongConfigProjection.shortfallDays} days short`
                  : undefined}
              >
                {addingSetlistSong
                  ? 'Adding...'
                  : selectedSongConfigProjection?.meetsRule === false
                    ? <><Lock className="h-3.5 w-3.5 shrink-0" /> Locked · {selectedSongConfigProjection.shortfallDays}d short</>
                    : setlistBuilderActive
                      ? (setlistBuilderSongs.some(draft => draft.song_id === selectedSongForConfig) ? 'Update Selection' : 'Add to Selection')
                      : 'Add to Setlist'}
              </button>
            </div>
          )}
        >
          <div className="space-y-4">
            {selectedSongConfigSong && selectedSongConfigProjection && (() => {
              const eventDateLabel = format(parseISO(event.event_date), 'MMM d, yyyy');
              const readyDateLabel = selectedSongConfigProjection.readyDate
                ? format(parseISO(selectedSongConfigProjection.readyDate), 'MMM d, yyyy')
                : null;
              const readiness = getSongReadinessBadge(selectedSongConfigUsage, event.event_date);
              const ReadinessIcon = readiness.Icon;
              const lyricsSource = getSongLyricsSource(selectedSongConfigSong);
              const explanation = selectedSongConfigProjection.daysAtTarget === null
                ? `No earlier approved use was found before ${eventDateLabel}. New or never-used songs meet the ${SONG_READINESS_RULE_DAYS}-day rule.`
                : selectedSongConfigProjection.meetsRule
                  ? `${selectedSongConfigProjection.daysAtTarget} days will have passed since the last approved use. That clears the ${SONG_READINESS_RULE_DAYS}-day rule by ${selectedSongConfigProjection.daysAtTarget - SONG_READINESS_RULE_DAYS} days.`
                  : `Only ${selectedSongConfigProjection.daysAtTarget} days will have passed since the last approved use. The song needs ${selectedSongConfigProjection.shortfallDays} more days and becomes ready on ${readyDateLabel}.`;

              return (
                <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-3 dark:border-white/[0.08] dark:bg-white/[0.035]">
                  <div className="flex items-start gap-3">
                    <SongArtwork
                      song={selectedSongConfigSong}
                      youtubeUrl={songConfig.youtube_url || selectedSongConfigSong.youtube_url}
                      className="h-16 w-16 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-950 dark:text-white">
                        {selectedSongConfigSong.title || 'Untitled song'}
                      </p>
                      <p className={`mt-0.5 truncate text-xs font-semibold ${selectedSongConfigSong.artist?.trim() ? 'text-gray-500 dark:text-white/45' : 'text-amber-600 dark:text-amber-400'}`}>
                        {selectedSongConfigSong.artist?.trim() || 'Artist required'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ring-1 ${readiness.className}`}>
                          <ReadinessIcon className="h-3 w-3" />
                          {readiness.label}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                          lyricsSource === 'missing'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300'
                        }`}>
                          {lyricsSource === 'saved' ? 'Lyrics saved' : lyricsSource === 'chart' ? 'Lyrics from chart' : 'Lyrics missing'}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                          selectedSongConfigSong.chordpro_text
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-white/45'
                        }`}>
                          {selectedSongConfigSong.chordpro_text ? 'Chart available' : 'No chart'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-3 rounded-xl p-3 ring-1 ${
                    selectedSongConfigProjection.meetsRule
                      ? 'bg-emerald-50 text-emerald-950 ring-emerald-200/80 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-800/50'
                      : 'bg-red-50 text-red-950 ring-red-200/80 dark:bg-red-950/35 dark:text-red-100 dark:ring-red-800/50'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] opacity-60">Why this status</p>
                      {!selectedSongConfigProjection.meetsRule && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-red-700 dark:bg-red-500/15 dark:text-red-200">
                          <Lock className="h-2.5 w-2.5" /> Cannot add
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold leading-relaxed">{explanation}</p>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <div className="rounded-lg bg-gray-100 px-2 py-2 dark:bg-white/[0.045]">
                      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-white/35">Last used</p>
                      <p className="mt-0.5 text-[10px] font-bold leading-tight text-gray-800 dark:text-white/80">
                        {selectedSongConfigUsage ? format(parseISO(selectedSongConfigUsage.lastDate), 'MMM d, yyyy') : 'Never'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-100 px-2 py-2 dark:bg-white/[0.045]">
                      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-white/35">Ready date</p>
                      <p className="mt-0.5 text-[10px] font-bold leading-tight text-gray-800 dark:text-white/80">{readyDateLabel || 'Already ready'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 px-2 py-2 dark:bg-white/[0.045]">
                      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-white/35">This event</p>
                      <p className="mt-0.5 text-[10px] font-bold leading-tight text-gray-800 dark:text-white/80">{eventDateLabel}</p>
                    </div>
                  </div>

                  {selectedSongConfigUsage && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200/70 bg-white/70 px-2.5 py-2 dark:border-white/[0.07] dark:bg-black/15">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                        <Calendar className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">Last approved use</p>
                        <p className="truncate text-[11px] font-black text-gray-800 dark:text-white/80">
                          {selectedSongConfigUsage.eventTitle}
                        </p>
                        <p className="text-[9px] font-semibold text-gray-500 dark:text-white/40">
                          {selectedSongConfigUsage.eventType} · {format(parseISO(selectedSongConfigUsage.lastDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {selectedSongForConfig && !songs.find(s => s.id === selectedSongForConfig)?.artist?.trim() && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <label htmlFor="setlist-song-artist" className="block text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1.5">
                  Add the artist before using this song
                </label>
                <input
                  id="setlist-song-artist"
                  type="text"
                  value={songConfig.artist}
                  onChange={e => setSongConfig({ ...songConfig, artist: e.target.value })}
                  className="input-field"
                  placeholder="Who sings this version?"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">The artist helps us match the right version and thumbnail.</p>
              </div>
            )}
            {selectedSongForConfig && (() => {
              const song = songs.find(item => item.id === selectedSongForConfig);
              const lyrics = getEffectiveSongLyrics(song);
              const lyricsSource = getSongLyricsSource(song);

              return (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lyrics</p>
                    {lyricsSource !== 'missing' && (
                      <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                        {lyricsSource === 'chart' ? 'From chord chart' : 'Saved lyrics'}
                      </span>
                    )}
                  </div>
                  {lyrics ? (
                    <div
                      className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 sm:max-h-44"
                      tabIndex={0}
                      aria-label={`Lyrics preview for ${song?.title || 'selected song'}`}
                    >
                      {lyrics}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      No lyrics or chord chart lyrics are available yet. Add the song, then add its lyrics manually before submitting the setlist.
                    </p>
                  )}
                </div>
              );
            })()}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Key for this set</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Select
                  value={songConfig.performed_key}
                  onChange={v => setSongConfig({ ...songConfig, performed_key: v })}
                  options={['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].map(k => ({ value: k, label: k }))}
                  placeholder="Select key"
                />
                <VoiceKeyDetector
                  onApply={performedKey => setSongConfig(current => ({ ...current, performed_key: performedKey }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <Select
                value={songConfig.category}
                onChange={v => setSongConfig({ ...songConfig, category: v })}
                options={[
                  { value: 'Opening', label: 'Opening' },
                  { value: 'Praise', label: 'Praise' },
                  { value: 'Worship', label: 'Worship' },
                  { value: 'Offering', label: 'Offering' },
                  { value: 'Closing', label: 'Closing' },
                  { value: 'Others', label: 'Others' },
                ]}
                placeholder="Select category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={songConfig.youtube_url}
                onChange={e => setSongConfig({ ...songConfig, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>
        </Modal>

        <Modal
          open={showSetlistExitConfirm}
          onClose={() => setShowSetlistExitConfirm(false)}
          title="Exit setlist builder?"
          size="sm"
          mobileView="dialog"
        >
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Your selected songs and any unsaved key or category changes will be lost.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSetlistExitConfirm(false)}
                className="btn-secondary min-h-11 justify-center"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={confirmSetlistBuilderClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Exit Without Saving
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={!!editingSongId} onClose={() => { if (!savingSongEdit) setEditingSongId(null); }} title="Edit Song" size="lg">
          <div className="space-y-4">
            {editingSongId && (() => {
              const ss = setlistSongs.find(s => s.id === editingSongId)
                || linkedSetlistSongs.find(s => s.id === editingSongId);
              return ss?.songs ? (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{ss.songs.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ss.songs.artist || 'No artist listed'}</p>
                  <button
                    type="button"
                    onClick={openLyricsFromEditingSong}
                    disabled={savingSongEdit}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-amber-50 px-3 text-xs font-bold text-amber-700 ring-1 ring-amber-200/80 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-500/[0.12] dark:text-amber-200 dark:ring-amber-500/20 dark:hover:bg-amber-500/[0.18]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {ss.songs.lyrics ? 'Edit lyrics' : 'Add lyrics'}
                  </button>
                </div>
              ) : null;
            })()}
            <div>
              <label htmlFor="event-song-artist" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Artist</label>
              <input
                id="event-song-artist"
                type="text"
                value={editSongForm.artist}
                onChange={e => setEditSongForm({ ...editSongForm, artist: e.target.value })}
                className="input-field"
                placeholder="e.g., Hillsong Worship"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Key</label>
              <Select
                value={editSongForm.performed_key}
                onChange={v => setEditSongForm({ ...editSongForm, performed_key: v })}
                options={['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
                  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'].map(k => ({ value: k, label: k }))}
                placeholder="Select key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <Select
                value={editSongForm.category}
                onChange={v => setEditSongForm({ ...editSongForm, category: v })}
                options={[
                  { value: 'Opening', label: 'Opening' },
                  { value: 'Praise', label: 'Praise' },
                  { value: 'Worship', label: 'Worship' },
                  { value: 'Offering', label: 'Offering' },
                  { value: 'Closing', label: 'Closing' },
                  { value: 'Others', label: 'Others' },
                ]}
                placeholder="Select category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">YouTube Link (optional)</label>
              <input
                type="url"
                value={editSongForm.youtube_url}
                onChange={e => setEditSongForm({ ...editSongForm, youtube_url: e.target.value })}
                className="input-field"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditingSongId(null)} disabled={savingSongEdit} className="btn-secondary disabled:opacity-60">Cancel</button>
              <button onClick={handleUpdateSetlistSong} disabled={savingSongEdit || !editSongForm.artist.trim()} className="btn-primary disabled:opacity-60">
                {savingSongEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={!!chartModalSong}
          onClose={closeChartModal}
          title="Song Chart"
          size="lg"
          hideHeader
        >
          {chartModalSong?.songs && (
            <SongChartViewer
              songId={chartModalSong.song_id}
              draftStorageId={`setlist-song:${chartModalSong.id}`}
              sectionOrder={chartModalSong.arrangement_section_order}
              title={chartModalSong.songs.title}
              artist={chartModalSong.songs.artist}
              songKey={chartModalSong.songs.song_key}
              performedKey={chartModalSong.performed_key}
              chordproText={getSetlistSongChartText(chartModalSong)}
              editable={canManageSetlist || canEditSetlist}
              saving={chartSaving}
              onClose={closeChartModal}
              onSave={(text, assignedSongKey) => handleSaveChart(chartModalSong.song_id, text, assignedSongKey)}
              onSaveSectionOrder={(order) => handleSaveSetlistSongSectionOrder(chartModalSong.id, order)}
            />
          )}
        </Modal>

        {typeof document !== 'undefined' && canUseServiceModePilot && serviceModeSong?.songs && createPortal(
              <motion.div
				ref={serviceModeOverlayRef}
                key="service-mode-overlay"
				role="dialog"
				aria-modal="true"
				aria-label={serviceModeLabel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="service-mode-overlay fixed inset-0 isolate z-[2147483000] flex w-screen flex-col overflow-visible bg-white text-gray-950 dark:bg-[#0c0f0d] dark:text-white"
                style={{
                  bottom: 0,
                  height: 'var(--service-mode-viewport-height)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 opacity-70"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0.25, 0.75, 0.35],
                    backgroundPosition: ['0% 0%', '100% 35%', '0% 0%'],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 5, ease: 'easeInOut' }}
                  style={{
                    backgroundImage: 'radial-gradient(circle at 18% 8%, rgba(16,185,129,0.18), transparent 28%), radial-gradient(circle at 78% 18%, rgba(52,211,153,0.12), transparent 30%), linear-gradient(135deg, rgba(16,185,129,0.06), transparent 42%, rgba(16,185,129,0.08))',
                    backgroundSize: '140% 140%',
                  }}
                />
                <AnimatePresence mode="wait">
                  {serviceModeEntering ? (
                    <motion.div
                      key="service-mode-entering"
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -14, scale: 1.015 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-white px-6 text-center dark:bg-[#0c0f0d]"
                    >
                      <div className="relative w-full max-w-sm">
                        <motion.div
                          aria-hidden="true"
                          className="absolute left-1/2 top-4 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
                          animate={{ scale: [0.85, 1.18, 0.98], opacity: [0.22, 0.52, 0.28] }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full border border-emerald-500/15"
                            animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.38, 0.7, 0.38] }}
                            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          <motion.div
                            aria-hidden="true"
                            className="absolute inset-4 rounded-full border border-dashed border-emerald-500/20 dark:border-emerald-300/20"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                          />
                          <motion.div
                            aria-hidden="true"
                            className="absolute -left-1 top-14 flex h-8 w-8 items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/15 dark:bg-white/[0.08] dark:text-emerald-200"
                            animate={{ y: [0, -8, 0], opacity: [0.72, 1, 0.72] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </motion.div>
                          <motion.div
                            aria-hidden="true"
                            className="absolute -right-1 top-14 flex h-8 w-8 items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/15 dark:bg-white/[0.08] dark:text-emerald-200"
                            animate={{ y: [0, 8, 0], opacity: [0.72, 1, 0.72] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.55 }}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </motion.div>
                          <motion.div
                            className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-600/30"
                            animate={{ y: [0, -7, 0], rotate: [0, -1.5, 1.5, 0], borderRadius: ['2rem', '2.35rem', '2rem'] }}
                            transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <motion.span
                              aria-hidden="true"
                              className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_42%,rgba(255,255,255,0.1))]"
                              animate={{ opacity: [0.28, 0.72, 0.36] }}
                              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <Music className="relative h-10 w-10" />
                          </motion.div>
                        </div>
                        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
                          Entering {serviceModeLabel}
                        </p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-gray-950 dark:text-white">
                          {serviceModeLoadingTitle}
                        </h2>
                        <p className="mx-auto mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-gray-500 dark:text-white/50">
                          <span className="block">Loading charts, notes, and worship flow</span>
                          <span className="block">from {serviceModeSourceLabel}.</span>
                        </p>

                        <div className="mt-6 grid gap-2">
                          {serviceModeLoadingSteps.map((step, index) => {
                            const StepIcon = step.icon;
                            return (
                              <motion.div
                                key={step.label}
                                className="flex items-center gap-3 rounded-2xl border border-emerald-500/10 bg-white/70 px-3 py-2 text-left shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: [0.68, 1, 0.78], y: 0 }}
                                transition={{
                                  opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.45 },
                                  y: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 },
                                }}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-emerald-400/10 dark:text-emerald-200">
                                  <StepIcon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-black text-gray-900 dark:text-white">{step.label}</span>
                                  <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-white/45">{step.detail}</span>
                                </span>
                                <motion.span
                                  className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.75)]"
                                  animate={{ scale: [0.7, 1.25, 0.7], opacity: [0.45, 1, 0.45] }}
                                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.35 }}
                                />
                              </motion.div>
                            );
                          })}
                        </div>

                        <div className="relative mt-6 h-4 overflow-hidden rounded-full bg-gray-200/80 p-1 dark:bg-white/10">
                          <motion.div
                            className="relative h-full w-full origin-left overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 8.25, ease: 'linear' }}
                          >
                            <motion.span
                              aria-hidden="true"
                              className="absolute inset-y-0 w-20 rounded-full bg-white/45 blur-sm"
                              initial={{ x: '-120%' }}
                              animate={{ x: ['-120%', '620%'] }}
                              transition={{ duration: 2.35, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </motion.div>
                        </div>
                        <p className="mt-3 text-[11px] font-bold text-emerald-700/70 dark:text-emerald-200/55">
                          Preparing everything before the first chart opens...
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="service-mode-chart"
                      className="service-mode-chart-shell relative z-10 flex min-h-0 flex-1 flex-col bg-white dark:bg-[#0c0f0d]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12, ease: 'easeOut' }}
                    >
                      <div
                        className="service-mode-topbar relative z-[80] flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white px-4 pb-3 pt-3 shadow-sm dark:border-white/[0.08] dark:bg-[#0c0f0d]"
                        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
                      >
						<button ref={serviceModeCloseButtonRef} type="button" onClick={requestCloseServiceMode} aria-label={`Close ${serviceModeLabel}`} className="rounded-full p-2 text-gray-500 hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-white/55 dark:hover:bg-white/[0.08]">
                          <X className="h-5 w-5" />
                        </button>
                        <div className="relative min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setServiceSongPickerOpen(value => !value)}
                            aria-expanded={serviceSongPickerOpen}
                            className="group flex w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1 text-left transition hover:bg-emerald-50/70 active:scale-[0.99] dark:hover:bg-emerald-500/10"
                          >
                            <span className="min-w-0 flex-1">
							  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
								{serviceModeLabel}
								<span className={`inline-flex items-center gap-1 tracking-normal ${isOnline ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`} title={isOnline ? 'Connected' : 'Offline'}>
								  {isOnline ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <WifiOff className="h-3 w-3" aria-hidden="true" />}
								  <span className="sr-only">{isOnline ? 'Connected' : 'Offline'}</span>
								</span>
							  </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                {serviceModeSongKey && (
                                  <span className="inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-amber-800 shadow-sm shadow-amber-500/10 dark:border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-200">
                                    {serviceModeSongKey}
                                  </span>
                                )}
                                <span className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-white">
                                  {serviceModeSong.songs.title}
                                </span>
                              </span>
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <motion.span
                                animate={{ rotate: serviceSongPickerOpen ? 180 : 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </motion.span>
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {serviceSongPickerOpen && (
                              <motion.div
                                className="absolute -left-3 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-2xl shadow-black/10 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#141815]/95"
                                style={{ width: 'min(18rem, calc(100vw - 5rem))' }}
                                initial={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(8px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(8px)' }}
                                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <div className="max-h-[min(70vh,24rem)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                                  {serviceModeSongs.map((song, index) => {
                                    const selected = index === serviceModeIndex;
                                    const songTitle = song.songs?.title || 'Untitled song';
                                    const chartKey = song.performed_key || song.songs?.song_key || '';
                                    return (
                                      <button
                                        key={song.song_id}
                                        type="button"
                                        onClick={() => selectServiceSong(index)}
                                        className={`flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2 text-left transition active:scale-[0.99] ${
                                          selected
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                            : 'text-gray-800 hover:bg-emerald-50 dark:text-white/80 dark:hover:bg-white/[0.06]'
                                        }`}
                                      >
                                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                                          selected
                                            ? 'bg-white/20 text-white'
                                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        }`}>
                                          {selected ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block whitespace-normal break-words text-[13px] font-black leading-snug">
                                            {index + 1}. {songTitle}
                                          </span>
                                          <span className={`block truncate text-[10px] font-semibold leading-tight ${selected ? 'text-white/70' : 'text-gray-500 dark:text-white/40'}`}>
                                            {chartKey ? `Key ${chartKey}` : 'Chord chart'}
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <button
                          onClick={() => {
                            setServiceArrangementOpen(value => !value);
                            setServiceChartControlsVisible(false);
                          }}
                          disabled={serviceChartEditing || serviceModeEntering}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${
                            serviceArrangementOpen
                              ? 'border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                              : 'border-black/[0.06] bg-white/90 text-gray-600 shadow-sm hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/70 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-300'
                          }`}
                          aria-label={serviceArrangementOpen ? 'Hide arrangement' : 'Show arrangement'}
                          aria-pressed={serviceArrangementOpen}
                          title={serviceArrangementOpen ? 'Hide arrangement' : 'Show arrangement'}
                        >
                          <ListOrdered className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => setServiceAutoScrollEnabled(value => !value)}
                          disabled={serviceChartEditing || serviceModeEntering}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${
                            serviceAutoScrollEnabled
                              ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                              : 'border-black/[0.06] bg-white/90 text-gray-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/70 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                          }`}
                          aria-label={serviceAutoScrollEnabled ? 'Pause auto scroll' : 'Start auto scroll'}
                          aria-pressed={serviceAutoScrollEnabled}
                          title={serviceAutoScrollEnabled ? 'Pause auto scroll' : 'Start auto scroll'}
                        >
                          {serviceAutoScrollEnabled ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
                        </button>
                        <button
                          onClick={() => setServiceChartControlsVisible(value => !value)}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 ${
                            serviceChartControlsVisible
                              ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                              : 'border-black/[0.06] bg-white/90 text-gray-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/70 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                          }`}
                          aria-label={serviceChartControlsVisible ? 'Hide chart controls' : 'Show chart controls'}
                          aria-pressed={serviceChartControlsVisible}
                          title={serviceChartControlsVisible ? 'Hide chart controls' : 'Show chart controls'}
                          >
                            <motion.span
                              animate={{
                                rotate: serviceChartControlsVisible ? 90 : 0,
                                scale: serviceChartControlsVisible ? 1.08 : 1,
                              }}
                              transition={{ type: 'spring', stiffness: 430, damping: 24 }}
                            >
                              <Settings2 className="h-4.5 w-4.5" />
                            </motion.span>
                          </button>
                      </div>
					  <div className="relative z-[70] shrink-0 border-b border-black/[0.06] bg-gray-50/95 px-3 py-2 dark:border-white/[0.08] dark:bg-[#101411]/95">
						<div className="flex items-center gap-2">
						  <button
							type="button"
							onClick={openPreparationPanel}
							aria-expanded={servicePreparationOpen}
							className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition ${
							  activeSongPreparation?.readiness === 'ready'
								? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
								: activeSongPreparation?.readiness === 'needs_work'
								  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
								  : 'bg-gray-200 text-gray-700 dark:bg-white/[0.08] dark:text-white/65'
							}`}
						  >
							{activeSongPreparation?.readiness === 'ready' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
							{REHEARSAL_READINESS_OPTIONS.find(option => option.value === (activeSongPreparation?.readiness || 'not_rehearsed'))?.label}
						  </button>
						  {event.event_type === 'Rehearsals' ? (
							<button type="button" onClick={() => setShowRehearsalSummary(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white">
							  <ClipboardCheck className="h-4 w-4" /> Finish
							</button>
						  ) : (
							<button
							  type="button"
							  onClick={() => setServiceModeUnlocked(value => !value)}
							  className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black ${serviceModeUnlocked ? 'bg-amber-500 text-black' : 'bg-gray-900 text-white dark:bg-white dark:text-black'}`}
							  aria-pressed={serviceModeUnlocked}
							>
							  {serviceModeUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
							  {serviceModeUnlocked ? 'Editing' : 'Locked'}
							</button>
						  )}
						</div>
						<AnimatePresence initial={false}>
						  {servicePreparationOpen && (
							<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
							  {event.event_type === 'Rehearsals' ? (
								<div className="space-y-2 pt-2">
								  <div className="grid grid-cols-3 gap-1.5">
									{REHEARSAL_READINESS_OPTIONS.map(option => (
									  <button key={option.value} type="button" onClick={() => setPreparationDraft(current => ({ ...current, readiness: option.value }))} className={`min-h-9 rounded-xl px-2 text-[11px] font-black ${preparationDraft.readiness === option.value ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 dark:bg-white/[0.06] dark:text-white/60'}`}>{option.label}</button>
									))}
								  </div>
								  <div className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)_auto] gap-2">
									<select value={preparationDraft.issue_type} onChange={e => setPreparationDraft(current => ({ ...current, issue_type: e.target.value as RehearsalIssueType | '' }))} className="min-w-0 rounded-xl border-0 bg-white px-2 text-xs font-bold text-gray-800 dark:bg-white/[0.08] dark:text-white">
									  <option value="">No issue</option>
									  {REHEARSAL_ISSUE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
									</select>
									<input value={preparationDraft.note} onChange={e => setPreparationDraft(current => ({ ...current, note: e.target.value }))} placeholder="Cue or follow-up note" className="min-w-0 rounded-xl border-0 bg-white px-3 text-xs text-gray-800 placeholder:text-gray-400 dark:bg-white/[0.08] dark:text-white" />
									<button type="button" onClick={saveSongPreparation} disabled={savingPreparation} className="min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60">{savingPreparation ? 'Saving…' : 'Save'}</button>
								  </div>
								</div>
							  ) : (
								<p className="pt-2 text-xs font-semibold leading-relaxed text-gray-600 dark:text-white/60">
								  {activeSongPreparation?.issue_type ? `${REHEARSAL_ISSUE_OPTIONS.find(option => option.value === activeSongPreparation.issue_type)?.label}: ` : ''}
								  {activeSongPreparation?.note || 'No rehearsal handoff note for this song.'}
								</p>
							  )}
							</motion.div>
						  )}
						</AnimatePresence>
					  </div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12, ease: 'easeOut' }}
                        className="service-mode-chart-frame relative z-10 min-h-0 flex-1 overflow-visible bg-white dark:bg-[#0c0f0d]"
                      >
                        <div ref={serviceSongStageRef} className="service-mode-song-stage">
                          <motion.div
                            className="service-mode-song-track"
                            style={{ x: serviceTrackX }}
                            drag={!serviceChartEditing && !serviceModeEntering && serviceModeSongs.length > 1 ? 'x' : false}
                            dragConstraints={{
                              left: isLastServiceSong ? 0 : -serviceSwipeWidth,
                              right: isFirstServiceSong ? 0 : serviceSwipeWidth,
                            }}
                            dragDirectionLock
                            dragElastic={0.08}
                            dragMomentum={false}
                            onDragStart={handleServiceDragStart}
                            onDragEnd={handleServiceDragEnd}
                          >
                            {serviceSongPanels.map(({ offset, index, song }) => (
                              <div
                                key={`${song.song_id}-${index}`}
								aria-hidden={offset !== 0}
                                className={`service-mode-song-panel ${offset === 0 ? '' : 'pointer-events-none'}`}
                                style={{ transform: `translate3d(${offset * 100}%, 0, 0)` }}
                              >
                                <SongChartViewer
                                  songId={song.song_id}
                                  draftStorageId={`setlist-song:${song.id}`}
                                  sectionOrder={song.arrangement_section_order}
                                  title={song.songs.title}
                                  artist={song.songs.artist}
                                  songKey={song.songs.song_key}
                                  performedKey={song.performed_key}
                                  chordproText={getSetlistSongChartText(song)}
								  editable={offset === 0 && canUseServiceModePilot && (event.event_type === 'Rehearsals' || serviceModeUnlocked)}
                                  fullBleed
                                  saving={offset === 0 ? chartSaving : false}
                                  hideTitleHeader
                                  controlsVisible={offset === 0 ? serviceChartControlsVisible : false}
                                  arrangementOpen={offset === 0 ? serviceArrangementOpen : false}
                                  onArrangementOpenChange={offset === 0 ? setServiceArrangementOpen : undefined}
                                  autoScrollEnabled={offset === 0 ? serviceAutoScrollEnabled : false}
                                  onAutoScrollEnabledChange={offset === 0 ? setServiceAutoScrollEnabled : undefined}
                                  onEditingChange={offset === 0 ? setServiceChartEditing : undefined}
                                  onDisplayKeyChange={offset === 0 ? setServiceModeDisplayKey : undefined}
                                  onSave={offset === 0 ? (text, assignedSongKey) => handleSaveChart(song.song_id, text, assignedSongKey) : undefined}
                                  onSaveSectionOrder={offset === 0 ? (order) => handleSaveSetlistSongSectionOrder(song.id, order) : undefined}
                                  footerNavigation={offset === 0 ? {
                                    currentLabel: `${index + 1} of ${serviceModeSongs.length}`,
                                    canGoPrevious: index > 0,
                                    canGoNext: index < serviceModeSongs.length - 1,
                                    onPrevious: goToPreviousServiceSong,
                                    onNext: goToNextServiceSong,
                                  } : undefined}
                                />
                              </div>
                            ))}
                          </motion.div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
				  {showRehearsalSummary && event.event_type === 'Rehearsals' && (
					<motion.div className="absolute inset-0 z-[170] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRehearsalSummary(false)}>
					  <motion.div role="dialog" aria-modal="true" aria-labelledby="rehearsal-summary-title" className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[28px] bg-white p-4 text-gray-950 shadow-2xl dark:bg-[#141815] dark:text-white" initial={{ y: 16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }} onClick={clickEvent => clickEvent.stopPropagation()}>
						<div className="flex items-start justify-between gap-3">
						  <div>
							<p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Rehearsal handoff</p>
							<h2 id="rehearsal-summary-title" className="mt-1 text-xl font-black">Ready for Service Mode?</h2>
							<p className="mt-1 text-xs font-semibold text-gray-500 dark:text-white/50">{rehearsalReadyCount} ready · {rehearsalNeedsWorkCount} need work · {serviceModeSongs.length - rehearsalReadyCount - rehearsalNeedsWorkCount} not rehearsed</p>
						  </div>
						  <button type="button" onClick={() => setShowRehearsalSummary(false)} aria-label="Close rehearsal summary" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.08]"><X className="h-5 w-5" /></button>
						</div>
						<div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto overscroll-contain">
						  {serviceModeSongs.map((song, index) => {
							const preparation = songPreparation[song.id];
							const readiness = preparation?.readiness || 'not_rehearsed';
							return (
							  <button key={song.id} type="button" onClick={() => { setShowRehearsalSummary(false); selectServiceSong(index); }} className="flex w-full items-start gap-3 rounded-2xl bg-gray-100 px-3 py-3 text-left dark:bg-white/[0.06]">
								<span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${readiness === 'ready' ? 'bg-emerald-500' : readiness === 'needs_work' ? 'bg-amber-500' : 'bg-gray-400'}`} />
								<span className="min-w-0 flex-1">
								  <span className="block text-sm font-black">{song.songs?.title || `Song ${index + 1}`}</span>
								  <span className="mt-0.5 block text-xs font-semibold text-gray-500 dark:text-white/45">{REHEARSAL_READINESS_OPTIONS.find(option => option.value === readiness)?.label}{preparation?.note ? ` · ${preparation.note}` : ''}</span>
								</span>
							  </button>
							);
						  })}
						</div>
						<button type="button" onClick={closeServiceMode} className="mt-4 h-11 w-full rounded-2xl bg-emerald-600 text-sm font-black text-white">Finish Rehearsal</button>
					  </motion.div>
					</motion.div>
				  )}
				</AnimatePresence>
				<AnimatePresence>
                  {serviceCloseConfirmOpen && (
                    <motion.div
                      className="absolute inset-0 z-[160] flex items-center justify-center bg-black/45 px-5 backdrop-blur-md"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => setServiceCloseConfirmOpen(false)}
                    >
                      <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="service-close-title"
                        className="w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-4 text-gray-950 shadow-2xl shadow-black/25 dark:border-white/[0.08] dark:bg-[#141815] dark:text-white"
                        initial={{ opacity: 0, y: 18, scale: 0.96, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(8px)' }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        onClick={event => event.stopPropagation()}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-500/10 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/15">
                            <X className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p id="service-close-title" className="text-lg font-black tracking-[-0.02em]">
                              Close {serviceModeLabel}?
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-500 dark:text-white/50">
                              This will close the full-screen chart flow and return you to the event page.
                            </p>
                          </div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setServiceCloseConfirmOpen(false)}
                            className="h-11 rounded-2xl border border-black/[0.06] bg-gray-100 text-sm font-black text-gray-700 transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/70"
                          >
                            Stay
                          </button>
                          <button
                            type="button"
                            onClick={closeServiceMode}
                            className="h-11 rounded-2xl bg-red-600 text-sm font-black text-white shadow-lg shadow-red-600/20 transition active:scale-[0.97]"
                          >
                            Close
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>,
          document.body
        )}

        <Modal
          open={!!showDecline}
          onClose={() => {
            if (respondingAssignmentId) return;
            setShowDecline(null);
            setDeclineReason('');
          }}
          title="Decline Assignment"
          size="sm"
          closeOnBackdrop={!respondingAssignmentId}
          closeOnEscape={!respondingAssignmentId}
        >
          <div className="space-y-4">
            {decliningAssignment?.roles?.name && (
              <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.07] px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/70">Assigned role</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white">{decliningAssignment.roles.name}</p>
              </div>
            )}
            <div>
              <label htmlFor="assignment-decline-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Reason <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <textarea
                id="assignment-decline-reason"
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                className="input-field h-20 resize-none"
                placeholder="Why are you declining?"
                required
                aria-required="true"
                disabled={!!respondingAssignmentId}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDecline(null);
                  setDeclineReason('');
                }}
                disabled={!!respondingAssignmentId}
                className="btn-secondary disabled:opacity-55"
              >
                Cancel
              </button>
              <button
                onClick={() => showDecline && handleDecline(showDecline)}
                disabled={!declineReason.trim() || !!respondingAssignmentId}
                className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                {respondingAssignmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {respondingAssignmentId ? 'Declining…' : 'Decline'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showCreateChatModal}
          onClose={() => {
            setShowCreateChatModal(false);
            setAdminOnlyChatTest(false);
          }}
          title="Event Chat"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                  {eventConversationId ? 'Choose which event chat to open' : 'Create a group chat for this event?'}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/50">
                  {adminOnlyChatTest ? (
                    <>An event-linked test chat will be created for <strong className="text-gray-700 dark:text-white/70">{event.title}</strong>. Scheduled members will not be added.</>
                  ) : (
                    eventConversationId ? (
                      <>The existing team chat for <strong className="text-gray-700 dark:text-white/70">{event.title}</strong> includes its assigned members.</>
                    ) : (
                      <>A group chat will be created for <strong className="text-gray-700 dark:text-white/70">{event.title}</strong> and all assigned team members will be added automatically.</>
                    )
                  )}
                </p>
              </div>
            </div>
            {(isOrgAdmin || isAdmin || isPlatformOwner) && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
                <input
                  type="checkbox"
                  checked={adminOnlyChatTest}
                  onChange={event => setAdminOnlyChatTest(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">Admin-only test chat</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500 dark:text-white/45">
                    Test @event and slash commands without adding scheduled members. You can add another admin manually from Chat Info.
                  </span>
                </span>
              </label>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowCreateChatModal(false);
                  setAdminOnlyChatTest(false);
                }}
                className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button onClick={handleCreateChat} disabled={creatingChat} className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-45 transition-colors">
                {creatingChat ? 'Creating…' : adminOnlyChatTest ? 'Create Test Chat' : eventConversationId ? 'Open Team Chat' : 'Create Team Chat'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Song Actions Modal */}
        <Modal
          open={!!mobileSongActionsSong}
          onClose={() => setMobileSongActionsSong(null)}
          title="Song Actions"
          size="sm"
          closeOnBackdrop={false}
        >
          {mobileSongActionsSong && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                <SongArtwork
                  song={mobileSongActionsSong.songs}
                  youtubeUrl={mobileSongActionsSong.youtube_url || mobileSongActionsSong.songs?.youtube_url}
                  className="h-12 w-12 rounded-lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{mobileSongActionsSong.songs?.title || 'Untitled song'}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-white/45">
                    {mobileSongActionsSong.songs?.artist || 'No artist listed'}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                {canEditSetlistSongDetails && (
                  <button
                    type="button"
                    onClick={() => openLyricsModal(mobileSongActionsSong)}
                    className={`flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition-colors ${
                      mobileSongActionsSong.songs?.lyrics
                        ? 'bg-white/[0.055] text-white/80 hover:bg-white/[0.09] hover:text-white'
                        : 'bg-amber-500/[0.13] text-amber-100 ring-1 ring-amber-400/20 hover:bg-amber-500/[0.18]'
                    }`}
                  >
                    <FileText className={mobileSongActionsSong.songs?.lyrics ? 'h-4 w-4 text-emerald-300' : 'h-4 w-4 text-amber-300'} />
                    {mobileSongActionsSong.songs?.lyrics ? 'Edit lyrics' : 'Add lyrics'}
                  </button>
                )}

                {canEditSetlistSongDetails && (
                  <button
                    type="button"
                    onClick={() => openEditSong(mobileSongActionsSong)}
                    className="flex h-11 w-full items-center gap-3 rounded-2xl bg-white/[0.055] px-3 text-left text-sm font-bold text-white/80 transition-colors hover:bg-white/[0.09] hover:text-white"
                  >
                    <Edit className="h-4 w-4 text-emerald-300" />
                    Edit song details
                  </button>
                )}

                {(mobileSongActionsSong.youtube_url || mobileSongActionsSong.songs?.youtube_url) && (
                  <a
                    href={mobileSongActionsSong.youtube_url || mobileSongActionsSong.songs?.youtube_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileSongActionsSong(null)}
                    className="flex h-11 w-full items-center gap-3 rounded-2xl bg-white/[0.055] px-3 text-left text-sm font-bold text-white/80 transition-colors hover:bg-white/[0.09] hover:text-white"
                  >
                    <Music className="h-4 w-4 text-red-300" />
                    Open video
                  </a>
                )}

                {showSetlistEditControls && ((canManageSetlist && !['approved', 'pending_review'].includes(setlist?.status || '')) || (canEditSetlist)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = mobileSongActionsSong.id;
                      setMobileSongActionsSong(null);
                      handleRemoveSongFromSetlist(targetId);
                    }}
                    className="flex h-11 w-full items-center gap-3 rounded-2xl bg-red-500/[0.10] px-3 text-left text-sm font-bold text-red-200 transition-colors hover:bg-red-500/[0.16]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove from setlist
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>

        <Modal open={!!lyricsModalSong} onClose={() => { setLyricsModalSong(null); setArtistPromptVisible(false); setArtistPromptValue(''); setLyricsSearchNotice(null); }} title="Song Lyrics" size="lg">
          {lyricsModalSong && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{lyricsModalSong.songs?.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{lyricsModalSong.songs?.artist || <span className="italic">No artist</span>}</p>
              </div>
              <div>
                <AnimatePresence mode="wait">
                  {fetchingLyrics ? (
                    <motion.div
                      key="searching"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                      className="relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-brand-200 bg-[linear-gradient(135deg,#f0fdf5_0%,#dcfce8_60%,#f0fdf5_100%)] px-4 py-5 dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.35)_0%,rgba(5,46,22,0.36)_58%,rgba(2,6,23,0.18)_100%)]"
                    >
                      {/* Shimmer sweep */}
                      <motion.div
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.55)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(52,211,153,0.16)_50%,transparent_100%)]"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                      />
                      {/* Waveform bars */}
                      <div className="flex items-end gap-1.5 h-10">
                        {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.55].map((base, i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 rounded-full bg-[linear-gradient(180deg,#4ade80,#16a34a)] shadow-[0_0_12px_rgba(34,197,94,0.25)] dark:bg-[linear-gradient(180deg,#6ee7b7,#10b981)] dark:shadow-[0_0_14px_rgba(16,185,129,0.38)]"
                            style={{ minHeight: 4 }}
                            animate={{ scaleY: [base, base * 0.3, base * 1.2, base * 0.5, base] }}
                            transition={{ duration: 0.8 + i * 0.07, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
                          />
                        ))}
                      </div>
                      {/* Label */}
                      <motion.span
                        className="text-sm font-semibold tracking-wide text-green-600 dark:text-emerald-200"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        Finding lyrics…
                      </motion.span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-gray-50/70 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                          Auto Find Lyrics
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          Search by this song&apos;s title{lyricsModalSong.songs?.artist?.trim() ? ' and artist' : ''}, then review the result before saving.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!lyricsModalSong.songs?.artist?.trim()) {
                            setArtistPromptVisible(v => !v);
                          } else {
                            handleFindLyrics();
                          }
                        }}
                        className="btn-secondary shrink-0 text-sm"
                      >
                        Find Lyrics
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Artist prompt — shown when song has no artist */}
                <AnimatePresence>
                  {lyricsSearchNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className={`mt-2 rounded-xl border px-3 py-2.5 text-xs font-medium leading-relaxed ${
                        lyricsSearchNotice.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : lyricsSearchNotice.type === 'error'
                            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200'
                            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200'
                      }`}>
                        {lyricsSearchNotice.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {artistPromptVisible && !lyricsModalSong.songs?.artist?.trim() && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-3 space-y-2.5">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                          This song has no artist. Add one for more accurate results:
                        </p>
                        <input
                          type="text"
                          value={artistPromptValue}
                          onChange={e => setArtistPromptValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { handleFindLyrics(artistPromptValue.trim()); } }}
                          placeholder="e.g. Hillsong Worship"
                          autoFocus
                          className="w-full text-sm rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-900 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFindLyrics(artistPromptValue.trim())}
                            disabled={fetchingLyrics}
                            className="btn-primary flex-1 text-sm disabled:opacity-50"
                          >
                            {fetchingLyrics ? 'Finding...' : 'Search with Artist'}
                          </button>
                          <button
                            onClick={() => handleFindLyrics('')}
                            disabled={fetchingLyrics}
                            className="btn-secondary text-sm disabled:opacity-50"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {lyricsSearchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 10, height: 0 }}
                      transition={{ duration: 0.28, ease: 'easeOut' }}
                      className="mt-3 space-y-2 overflow-hidden"
                    >
                      <motion.p
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400"
                      >
                        {lyricsSearchResults.length} result{lyricsSearchResults.length > 1 ? 's' : ''} found
                      </motion.p>
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-gray-200/80 bg-gray-50/70 p-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
                        {lyricsSearchResults.map((result, i) => (
                          <motion.button
                            key={result.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.07, duration: 0.22, ease: 'easeOut' }}
                            onClick={() => setLyricsInput(result.lyrics)}
                            type="button"
                            className="w-full rounded-2xl border border-gray-200/80 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#10151f] dark:hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{result.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{result.artist}</p>
                                {(result.album || result.duration) && (
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                    {result.album ? result.album : 'Unknown album'}
                                    {result.duration ? ` · ${Math.round(result.duration)}s` : ''}
                                  </p>
                                )}
                                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                  {result.lyrics}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                                Use
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <textarea
                  value={lyricsInput}
                  onChange={e => setLyricsInput(e.target.value)}
                  placeholder="Paste the full song lyrics here..."
                  rows={12}
                  className="input-field resize-none text-sm leading-relaxed"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Lyrics are shared across all setlists — other members won&apos;t need to add them again.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Can&apos;t find lyrics using the button above? You can manually type or paste them into the box.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setLyricsModalSong(null); setLyricsSearchNotice(null); }} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleSaveLyrics} disabled={savingLyrics} className="btn-primary text-sm">
                  {savingLyrics ? 'Saving...' : 'Save Lyrics'}
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal open={showDeleteEvent} onClose={() => setShowDeleteEvent(false)} title="Delete Event" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>{event.title}</strong>? This will also remove all assignments, setlists, and the event discussion. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteEvent(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDeleteEvent} disabled={deleting} className="btn-danger">
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={lifecycleConfirmOverride !== null}
          onClose={() => !savingLifecycleOverride && setLifecycleConfirmOverride(null)}
          title={lifecycleConfirmOverride === 'upcoming' ? 'Move Event to Upcoming?' : 'Move Event to Past?'}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {lifecycleConfirmOverride === 'upcoming'
                ? `Move “${event.title}” back to Upcoming events?`
                : `Confirm that “${event.title}” is finished and move it to Past events. This will open its post-event observations.`}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setLifecycleConfirmOverride(null)} disabled={savingLifecycleOverride} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={() => lifecycleConfirmOverride && handleLifecycleOverride(lifecycleConfirmOverride)}
                disabled={savingLifecycleOverride}
                className="btn-primary"
              >
                {savingLifecycleOverride ? 'Moving…' : (lifecycleConfirmOverride === 'upcoming' ? 'Move to Upcoming' : 'Move to Past')}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={selectedSongReservationDetails !== null}
          onClose={() => setSelectedSongReservationDetails(null)}
          title={`${selectedSongReservationDetails?.songTitle || 'Song'} is unavailable`}
          size="sm"
          mobileView="dialog"
        >
          {selectedSongReservationDetails && (() => {
            const submission = selectedSongReservationDetails.reservation.firstSubmission;
            const additionalProposalCount = selectedSongReservationDetails.reservation.totalSubmissions - 1;
            return (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Already in an active proposal</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                      This song cannot be selected because adding it would create a duplicate active proposal.
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Proposed by</dt>
                  <dd className="truncate font-semibold text-gray-900 dark:text-white">{submission.submitterName}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Event</dt>
                  <dd className="truncate font-semibold text-gray-900 dark:text-white">{submission.eventTitle}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Event date</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">
                    {submission.eventDate ? format(parseISO(submission.eventDate), 'MMM d, yyyy') : 'Date unavailable'}
                  </dd>
                  <dt className="text-gray-500 dark:text-gray-400">Submitted</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{formatProposalSubmissionTime(submission.submittedAt)}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{statusLabels[submission.status] || submission.status.replace(/_/g, ' ')}</dd>
                </dl>
                {additionalProposalCount > 0 && (
                  <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                    This song also appears in {additionalProposalCount} other active {additionalProposalCount === 1 ? 'proposal' : 'proposals'}.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 border-t border-gray-200/70 pt-4 dark:border-white/[0.08]">
                  <button type="button" onClick={() => setSelectedSongReservationDetails(null)} className="btn-secondary min-h-11 w-full justify-center">Close</button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSongReservationDetails(null);
                      setShowSetlist(false);
                      navigate(`/events/${submission.eventId}`);
                    }}
                    className="btn-primary min-h-11 w-full justify-center"
                  >
                    View Proposal
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>

        <Modal
          open={selectedSongProposals !== null}
          onClose={() => setSelectedSongProposals(null)}
          title={`Song Proposals · ${selectedSongProposals?.songTitle || ''}`}
          size="md"
          mobileView="dialog"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              This song appears in {selectedSongProposals?.conflict.totalSubmissions || 0} active upcoming setlists. First submission uses the original proposal time, not approval time.
            </p>
            <div className="space-y-2.5">
              {selectedProposalSubmissions.map((submission, index) => {
                const isCurrent = submission.setlistId === selectedSongProposals?.conflict.currentSubmission.setlistId;
                return (
                  <div key={submission.setlistId} className="rounded-2xl border border-gray-200/75 bg-gray-50/80 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{submission.submitterName}</p>
                          {index === 0 && <span className="badge badge-blue text-[10px]">First</span>}
                          {isCurrent && <span className="badge badge-yellow text-[10px]">Current</span>}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{submission.eventTitle} · {submission.eventDate ? format(parseISO(submission.eventDate), 'MMM d, yyyy') : 'Date unavailable'}</p>
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Submitted {formatProposalSubmissionTime(submission.submittedAt)} · {statusLabels[submission.status] || submission.status.replace(/_/g, ' ')}</p>
                      </div>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-2 text-xs font-semibold text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">You are here</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSongProposals(null);
                            navigate(`/events/${submission.eventId}`);
                          }}
                          className="btn-secondary min-h-10 shrink-0 px-3 text-xs"
                        >
                          View Setlist
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>

        <Modal
          open={showRevisionRequest}
          onClose={() => setShowRevisionRequest(false)}
          title="Request Setlist Revision"
          size="lg"
          mobileView="dialog"
          dialogClassName="sm:!max-w-2xl"
          bodyClassName="sm:px-6 sm:py-6"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="setlist-revision-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason for revision</label>
              <textarea
                id="setlist-revision-reason"
                value={revisionReason}
                onChange={e => setRevisionReason(e.target.value)}
                className="input-field min-h-36 resize-y sm:min-h-44"
                placeholder="Explain what needs to be revised..."
                data-modal-initial-focus
                required
              />
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">The song leader will be notified and can see this reason.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/60 pt-4 dark:border-white/[0.06] sm:flex sm:justify-end sm:gap-3">
              <button onClick={() => setShowRevisionRequest(false)} className="btn-secondary min-h-11 w-full justify-center sm:w-auto">Cancel</button>
              <button onClick={handleRevisionRequest} disabled={!revisionReason.trim()} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 sm:w-auto">
                <AlertCircle className="h-4 w-4" /> Request Revision
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          open={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Setlist"
          size="lg"
          mobileView="dialog"
          dialogClassName="sm:!max-w-2xl"
          bodyClassName="sm:px-6 sm:py-6"
        >
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">This setlist will be marked as Rejected. The song leader will be notified.</p>
            <div>
              <label htmlFor="setlist-reject-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason (optional)</label>
              <textarea
                id="setlist-reject-reason"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="input-field min-h-32 resize-y sm:min-h-40"
                placeholder="Explain why this setlist is rejected..."
                data-modal-initial-focus
              />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/60 pt-4 dark:border-white/[0.06] sm:flex sm:justify-end sm:gap-3">
              <button onClick={() => setShowRejectModal(false)} className="btn-secondary min-h-11 w-full justify-center sm:w-auto">Cancel</button>
              <button onClick={handleReject} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 sm:w-auto">
                <X className="h-4 w-4" /> Reject Setlist
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showEditEvent} onClose={() => setShowEditEvent(false)} title="Edit Event" size="lg">
          <form onSubmit={e => { e.preventDefault(); handleEditEvent(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event Type</label>
                <Select
                  value={editForm.event_type}
                  onChange={handleEditEventTypeChange}
                  options={availableEventTypes.map((type) => ({ value: type, label: type }))}
                  placeholder="Select event type"
                />
              </div>

              {['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(editForm.event_type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Song Leader</label>
                  <Select
                    value={editForm.song_leader_id}
                    onChange={v => setEditForm({ ...editForm, song_leader_id: v })}
                    options={getSongLeaders().map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
                    placeholder="Select song leader"
                  />
                </div>
              )}

              {editForm.event_type === 'Rehearsals' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">For Sunday Service</label>
                  <Select
                    value={editForm.linked_event_id}
                    onChange={v => setEditForm({ ...editForm, linked_event_id: v })}
                    options={sundayServices.map(e => ({
                      value: e.id,
                      label: `${format(parseISO(e.event_date), 'MMM d, yyyy')} - ${e.title}`
                    }))}
                    placeholder="Select Sunday Service"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                <input type="date" value={editForm.event_date} onChange={e => setEditForm({ ...editForm, event_date: e.target.value })} className="input-field" required />
              </div>
              {['Rehearsals', 'Revamp Session'].includes(editForm.event_type) ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                    <input type="time" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                    <input type="time" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })} className="input-field" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                    <input type="text" value={editForm.start_time ? formatTime12Hour(editForm.start_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                    <input type="text" value={editForm.end_time ? formatTime12Hour(editForm.end_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
                  </div>
                </div>
              )}

              {editForm.event_date && ['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(editForm.event_type) && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Proposal Due Date:</strong> {formatInTimeZone(parseISO(calculateProposalDueDate(editForm.event_date, editForm.event_type) || ''), 'Asia/Manila', "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="input-field h-20 resize-none" />
              </div>

            <div className="flex justify-end gap-3 pt-4 mt-6">
              <button type="button" onClick={() => setShowEditEvent(false)} disabled={savingEventEdit} className="btn-secondary disabled:opacity-60">Cancel</button>
              <button type="submit" disabled={savingEventEdit} className="btn-primary disabled:opacity-60">{savingEventEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>

      </motion.div>

      <SwapRequestModal
        open={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        myAssignment={myAssignment ?? null}
      />
    </div>
  );
}
