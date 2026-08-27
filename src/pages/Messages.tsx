import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import {
  ArrowLeft, Send, ImageIcon, X, Pin, CornerUpLeft, Camera,
  MessageCircle, Plus, Search, Trash2, MoreHorizontal, ChevronRight, Check,
  CalendarDays, Music2, Copy, Paperclip, FileText, Download, ExternalLink, UserPlus,
  Calendar, Clock, LogOut, PlayCircle, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTime12Hour } from '../lib/timeFormat';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConversations, type Conversation } from '../hooks/useConversations';
import { useMessages, type Message } from '../hooks/useMessages';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { EventArtwork } from '../components/EventArtwork';
import { Modal } from '../components/Modal';
import { MentionTextarea } from '../components/MentionTextarea';
import { ReactionFlightAnimation, type ReactionFlightPath } from '../components/ReactionFlightAnimation';
import { playInteractionSound, primeInteractionSounds } from '../lib/interactionSounds';
import {
  createChatEventReference,
  getChatCommandQuery,
  getInlineSongShortcut,
  getInlineSongSegments,
  getSongYoutubeTarget,
  parseChatEventReference,
  type ChatEventReference,
} from '../lib/chatEventReferences';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatConvTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

type MsgContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'file'; url: string; name: string; size: number }
  | ChatEventReference
  | { type: 'delete_request'; requestedBy: string; requesterName: string; requestedAt: string };
function parseContent(content: string): MsgContent {
  const normalizeParsedContent = (value: unknown): MsgContent | null => {
    if (!value || typeof value !== 'object') return null;
    const p = value as Record<string, unknown>;
    if (p.type === 'image' && typeof p.url === 'string') return { type: 'image', url: p.url };
    if (p.type === 'file' && typeof p.url === 'string') return { type: 'file', url: p.url, name: typeof p.name === 'string' ? p.name : 'File', size: typeof p.size === 'number' ? p.size : 0 };
    const eventReference = parseChatEventReference(value);
    if (eventReference) return eventReference;
    if (p.type === 'delete_request') {
      const requestedBy = typeof p.requestedBy === 'string'
        ? p.requestedBy
        : typeof p.requested_by === 'string'
          ? p.requested_by
          : '';
      if (!requestedBy) return null;
      return {
        type: 'delete_request',
        requestedBy,
        requesterName: typeof p.requesterName === 'string'
          ? p.requesterName
          : typeof p.requester_name === 'string'
            ? p.requester_name
            : 'Someone',
        requestedAt: typeof p.requestedAt === 'string'
          ? p.requestedAt
          : typeof p.requested_at === 'string'
            ? p.requested_at
            : '',
      };
    }
    return null;
  };

  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeParsedContent(parsed);
    if (normalized) return normalized;
    if (typeof parsed === 'string') {
      const nested = normalizeParsedContent(JSON.parse(parsed));
      if (nested) return nested;
    }
  } catch {
    // Treat non-JSON content as a plain text message.
  }
  if (content.includes('"type"') && content.includes('delete_request')) {
    return { type: 'delete_request', requestedBy: '', requesterName: 'Someone', requestedAt: '' };
  }
  return { type: 'text', text: content };
}

interface MessageActionAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  menuOverlap?: number;
  horizontalNudge?: number;
}

type MessageReactionFlight = ReactionFlightPath & {
  messageId: string;
  token: number;
};

interface MessageActionOverlayProps {
  open: boolean;
  anchorRect: MessageActionAnchorRect | null;
  canCopy: boolean;
  isMine: boolean;
  isPinned: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onReact: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

interface MessageActionPlacement {
  left: number;
  top: number;
  width: number;
  opensAbove: boolean;
  pointerLeft: number;
}

const MESSAGE_ACTION_MARGIN = 12;
const MESSAGE_ACTION_GAP = 12;

function clampToViewport(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

const MESSAGE_FOCUS_BACKDROP_CLASS = 'pointer-events-auto fixed bg-black/20 animate-fade-in dark:bg-black/45';

function MessageActionOverlay({
  open,
  anchorRect,
  canCopy,
  isMine,
  isPinned,
  onClose,
  onReply,
  onCopy,
  onReact,
  onTogglePin,
  onDelete,
}: MessageActionOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [placement, setPlacement] = useState<MessageActionPlacement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) {
      setPlacement(null);
      return;
    }
    const dialogHeight = dialogRef.current?.getBoundingClientRect().height || 330;
    const width = Math.min(212, Math.max(196, Math.min(anchorRect.width, viewport.width - (MESSAGE_ACTION_MARGIN * 2))));
    const menuAnchorBottom = anchorRect.bottom - (anchorRect.menuOverlap || 0);
    const roomBelow = viewport.height - menuAnchorBottom - MESSAGE_ACTION_MARGIN;
    const roomAbove = anchorRect.top - MESSAGE_ACTION_MARGIN;
    const opensAbove = roomBelow < dialogHeight + MESSAGE_ACTION_GAP && roomAbove > roomBelow;
    const centeredLeft = anchorRect.left + ((anchorRect.width - width) / 2) - (opensAbove ? 0 : (anchorRect.horizontalNudge || 0));
    const left = clampToViewport(centeredLeft, MESSAGE_ACTION_MARGIN, viewport.width - width - MESSAGE_ACTION_MARGIN);
    const preferredTop = opensAbove
      ? anchorRect.top - dialogHeight - MESSAGE_ACTION_GAP
      : menuAnchorBottom + MESSAGE_ACTION_GAP;
    const top = clampToViewport(preferredTop, MESSAGE_ACTION_MARGIN, viewport.height - dialogHeight - MESSAGE_ACTION_MARGIN);
    const pointerLeft = clampToViewport((anchorRect.left + (anchorRect.width / 2)) - left, 28, width - 28);
    setPlacement({ left, top, width, opensAbove, pointerLeft });
  }, [anchorRect, canCopy, isMine, open, viewport]);

  if (!open || !anchorRect) return null;

  const halo = {
    left: clampToViewport(anchorRect.left - 5, 0, viewport.width),
    top: clampToViewport(anchorRect.top - 5, 0, viewport.height),
    right: clampToViewport(anchorRect.right + 5, 0, viewport.width),
    bottom: clampToViewport(anchorRect.bottom + 5, 0, viewport.height),
  };
  const actionClass = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-bold text-white/72 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2147483647]" role="presentation" data-app-nonselect="true">
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ inset: '0 0 auto 0', height: halo.top }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ inset: `${halo.bottom}px 0 0 0` }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ left: 0, top: halo.top, width: halo.left, height: halo.bottom - halo.top }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ left: halo.right, right: 0, top: halo.top, height: halo.bottom - halo.top }} />

      <div
        aria-hidden="true"
        onClick={onClose}
        className="pointer-events-auto fixed bg-transparent"
        style={{ left: halo.left, top: halo.top, width: halo.right - halo.left, height: halo.bottom - halo.top }}
      />

      <div
        ref={dialogRef}
        className="pointer-events-auto fixed"
        style={placement ? {
          left: placement.left,
          top: placement.top,
          width: placement.width,
        } : { left: MESSAGE_ACTION_MARGIN, top: anchorRect.bottom + MESSAGE_ACTION_GAP, width: Math.min(212, viewport.width - 24), visibility: 'hidden' }}
        onClick={event => event.stopPropagation()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Message options"
          initial={{ opacity: 0, scale: 0.82, y: placement?.opensAbove ? 12 : -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 470, damping: 30, mass: 0.72 }}
          className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-[#222326]/95 text-white shadow-[0_28px_80px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.015] backdrop-blur-xl"
          style={{ transformOrigin: placement?.opensAbove ? 'bottom center' : 'top center' }}
        >
          {placement && (
            <span
              aria-hidden="true"
              className={`absolute h-3 w-3 rotate-45 border-white/[0.07] bg-[#222326]/95 ${placement.opensAbove ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-l border-t'}`}
              style={{ left: placement.pointerLeft - 6 }}
            />
          )}

          <motion.div
            initial="closed"
            animate="open"
            variants={{ open: { transition: { delayChildren: 0.04, staggerChildren: 0.025 } }, closed: {} }}
            className="flex flex-col gap-0.5 px-5 py-2.5"
          >
            <motion.button variants={{ closed: { opacity: 0, y: 9, scale: 0.96 }, open: { opacity: 1, y: 0, scale: 1 } }} type="button" onClick={onReply} className={actionClass}><CornerUpLeft className="h-4 w-4 text-emerald-300" /> Reply</motion.button>
            <motion.button variants={{ closed: { opacity: 0, y: 9, scale: 0.96 }, open: { opacity: 1, y: 0, scale: 1 } }} type="button" onClick={onReact} className={actionClass}><span className="text-[15px] leading-none">😊</span> React</motion.button>
            {canCopy && <motion.button variants={{ closed: { opacity: 0, y: 9, scale: 0.96 }, open: { opacity: 1, y: 0, scale: 1 } }} type="button" onClick={onCopy} className={actionClass}><Copy className="h-4 w-4 text-sky-300" /> Copy</motion.button>}
            <motion.button variants={{ closed: { opacity: 0, y: 9, scale: 0.96 }, open: { opacity: 1, y: 0, scale: 1 } }} type="button" onClick={onTogglePin} className={actionClass}><Pin className="h-4 w-4 text-amber-300" /> {isPinned ? 'Unpin' : 'Pin'}</motion.button>
            {isMine && <motion.button variants={{ closed: { opacity: 0, y: 9, scale: 0.96 }, open: { opacity: 1, y: 0, scale: 1 } }} type="button" onClick={onDelete} className={`${actionClass} text-red-300 hover:bg-red-500/10`}><Trash2 className="h-4 w-4" /> Delete message</motion.button>}
          </motion.div>
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

function getOtherMember(conv: Conversation, myId: string) {
  return conv.members.find(m => m.user_id !== myId);
}

function getFullName(profile: { first_name: string | null; last_name: string | null } | null | undefined, fallback = 'Unknown'): string {
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  return fullName || profile?.first_name || fallback;
}

function getConvName(conv: Conversation, myId: string): string {
  if (conv.name) return conv.name;
  if (conv.type === 'personal') {
    const other = getOtherMember(conv, myId);
    return getFullName(other?.profile);
  }
  return 'Group Chat';
}

function getSenderName(sender: { first_name: string | null; last_name: string | null; nickname: string | null }): string {
  return getFullName(sender);
}

function formatMentionToken(token: string): string {
  return token.replace(/_/g, ' ');
}

function humanizeMentions(text: string): string {
  return text
    .replace(/@everyone\b/gi, '@everyone')
    .replace(/@([^\s@]+_[^\s@]+)/g, (_match, handle: string) => `@${formatMentionToken(handle)}`);
}

function renderMessageText(text: string, isMe: boolean) {
  const parts = text.split(/(@everyone\b|@[^\s@]+_[^\s@]+)/gi);
  return parts.map((part, index) => {
    if (!part.match(/^(@everyone\b|@[^\s@]+_[^\s@]+)$/i)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span
        key={`${part}-${index}`}
        className={`rounded-md px-1 py-0.5 font-semibold ${
          isMe
            ? 'bg-white/15 text-white'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
        }`}
      >
        {part.toLowerCase() === '@everyone' ? '@everyone' : formatMentionToken(part)}
      </span>
    );
  });
}

function getConversationListName(conv: Conversation, myId: string): string {
  const name = getConvName(conv, myId);
  if (conv.type !== 'event') return name;

  const adminTestPrefix = name.startsWith('[Admin Test] ') ? '[Admin Test] ' : '';
  const baseName = adminTestPrefix ? name.slice(adminTestPrefix.length) : name;
  const parts = baseName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;

  const hasHonorific = /^(sis|bro|ptr|pastor)\.?$/i.test(parts[0]);
  const shortenedName = hasHonorific ? `${parts[0]} ${parts[1]}` : parts[0];
  return `${adminTestPrefix}${shortenedName}`;
}

function InlineSongReference({ reference, eventSongs, isMe }: {
  reference: ChatEventReference;
  eventSongs: EventDiscussionDetails['songs'];
  isMe: boolean;
}) {
  const song = reference.song;
  if (!song || !reference.messageText) return null;
  const candidates = [
    ...eventSongs.map(item => ({ id: item.id, title: item.title, artist: item.artist, key: item.performed_key || item.song_key, youtubeUrl: item.youtube_url })),
    ...(reference.songMentions || []),
    song,
  ];
  const segments = getInlineSongSegments(reference.messageText, candidates);

  return (
    <p
      className="text-[14px] whitespace-pre-wrap break-words"
      style={{ overflowWrap: 'anywhere', wordSpacing: '0.12em' }}
    >
      {segments.map((segment, index) => segment.type === 'text' ? (
        <span key={`text-${index}`}>{segment.text}</span>
      ) : (
        <a
          key={`${segment.song.id}-${index}`}
          href={getSongYoutubeTarget(segment.song)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={event => event.stopPropagation()}
          style={{ wordSpacing: 'normal' }}
          className={`mx-0.5 inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 align-middle font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            isMe
              ? 'border-white/20 bg-black/[0.14] text-white/95 hover:bg-black/[0.2] focus-visible:ring-white/70'
              : 'border-violet-300/70 bg-violet-100 text-violet-800 hover:bg-violet-200 focus-visible:ring-violet-400 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25'
          }`}
          aria-label={`Open ${segment.song.title} on YouTube`}
        >
          <Music2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{segment.song.title}</span>
          {segment.song.key && <span className="rounded bg-black/5 px-1 text-[10px] opacity-70 dark:bg-white/10">{segment.song.key}</span>}
        </a>
      ))}
    </p>
  );
}

function ChatEventReferenceCard({ reference, eventSongs, isMe, onOpenSetlist }: {
  reference: ChatEventReference;
  eventSongs: EventDiscussionDetails['songs'];
  isMe: boolean;
  onOpenSetlist: (songId?: string) => void;
}) {
  const navigate = useNavigate();
  const isSetlist = reference.reference === 'setlist';
  const isSong = reference.reference === 'song';
  const isObservation = reference.reference === 'observation';
  const setlistSongs = isSetlist
    ? (reference.setlistSongs?.length
      ? reference.setlistSongs
      : eventSongs.map(item => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        key: item.performed_key || item.song_key,
        youtubeUrl: item.youtube_url,
      })))
    : [];
  const destination = isObservation
    ? `/events/${reference.eventId}?addObservation=1`
    : `/events/${reference.eventId}`;
  const label = isSong
    ? 'Setlist song'
    : isObservation
      ? 'Post-event observation'
      : 'Event reference';
  const action = isObservation ? 'Add observation' : isSong ? 'Open setlist' : 'View event';

  if (isSong && reference.messageText) {
    return <InlineSongReference reference={reference} eventSongs={eventSongs} isMe={isMe} />;
  }

  if (isSetlist) {
    return (
      <div className="w-[min(18rem,72vw)] overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left text-gray-900 shadow-sm dark:border-white/[0.08] dark:bg-[#1b1b1e] dark:text-white">
        <div className="flex items-start gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Music2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Event setlist</span>
            <span className="mt-1 block truncate text-[14px] font-bold leading-tight">{reference.eventTitle}</span>
            <span className="mt-1 block text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
              {setlistSongs.length || reference.songCount || 0} {(setlistSongs.length || reference.songCount || 0) === 1 ? 'song' : 'songs'}
            </span>
          </span>
        </div>
        {setlistSongs.length > 0 && (
          <div className="border-t border-gray-100 px-2.5 py-1.5 dark:border-white/[0.06]">
            {setlistSongs.map((song, index) => (
              <div key={`${song.id}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.035]">
                <span className="w-4 shrink-0 text-right text-[10px] font-bold tabular-nums text-gray-300 dark:text-white/25">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold leading-tight text-gray-800 dark:text-white/90">{song.title}</span>
                  {song.artist && (
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-gray-400 dark:text-white/35">{song.artist}</span>
                  )}
                </span>
                {song.key && (
                  <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 dark:bg-white/[0.06] dark:text-white/45">
                    {song.key}
                  </span>
                )}
                <a
                  href={getSongYoutubeTarget(song)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={`Open ${song.title} on YouTube`}
                  title={`Open ${song.title} on YouTube`}
                >
                  <PlayCircle className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        if (isSong) onOpenSetlist(reference.song?.id);
        else navigate(destination);
      }}
      className="block w-[min(18rem,72vw)] overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left text-gray-900 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:border-white/[0.08] dark:bg-[#1b1b1e] dark:text-white"
    >
      <span className="flex items-start gap-3 p-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isSong
            ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'
            : isObservation
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
        }`}>
          {isSong ? <Music2 className="h-5 w-5" /> : isObservation ? <MessageCircle className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">{label}</span>
          <span className="mt-1 block truncate text-[14px] font-bold leading-tight">
            {isSong ? reference.song?.title : reference.eventTitle}
          </span>
          {isSong && reference.song && (
            <span className="mt-1 block truncate text-[11px] text-gray-500 dark:text-white/45">
              {[reference.song.artist, reference.song.key ? `Key ${reference.song.key}` : null].filter(Boolean).join(' · ')}
            </span>
          )}
          {!isSong && (
            <span className="mt-1 block text-[11px] text-gray-500 dark:text-white/45">
              {format(parseISO(reference.eventDate), 'EEE, MMM d, yyyy')}{reference.eventType ? ` · ${reference.eventType}` : ''}
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center justify-between border-t border-gray-100 px-3.5 py-2 text-[11px] font-bold text-emerald-600 dark:border-white/[0.06] dark:text-emerald-300">
        {action}
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function getConversationAvatarSrc(conv: Conversation, myId: string): string | undefined {
  if (conv.type === 'personal') {
    return getOtherMember(conv, myId)?.profile?.avatar_url ?? undefined;
  }
  return conv.photo_url ?? undefined;
}

function getConversationAvatarName(conv: Conversation, myId: string): { firstName: string; lastName?: string } {
  if (conv.type === 'personal') {
    const other = getOtherMember(conv, myId);
    return {
      firstName: other?.profile?.first_name || getConvName(conv, myId).charAt(0) || '?',
      lastName: other?.profile?.last_name ?? undefined,
    };
  }

  const name = getConvName(conv, myId).trim() || 'Group Chat';
  const [firstWord = 'G', ...rest] = name.split(/\s+/);
  return {
    firstName: firstWord,
    lastName: rest.length > 0 ? rest[rest.length - 1] : undefined,
  };
}

function previewContent(content: string): string {
  const parsed = parseContent(content);
  if (parsed.type === 'image') return '📷 Photo';
  if (parsed.type === 'file') return `📎 ${parsed.name}`;
  if (parsed.type === 'event_reference') {
    if (parsed.reference === 'song' && parsed.messageText) return parsed.messageText.length > 60 ? `${parsed.messageText.slice(0, 60)}…` : parsed.messageText;
    if (parsed.reference === 'song') return `🎵 ${parsed.song?.title || 'Song'}`;
    if (parsed.reference === 'setlist') return `🎶 Setlist · ${parsed.eventTitle}`;
    if (parsed.reference === 'observation') return `📝 Post-event observation · ${parsed.eventTitle}`;
    return `📅 ${parsed.eventTitle}`;
  }
  if (parsed.type === 'delete_request') return 'Delete chat request';
  const text = humanizeMentions(parsed.text);
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

function replyPreviewContent(content: string): string {
  const parsed = parseContent(content);
  if (parsed.type === 'image') return 'Photo';
  if (parsed.type === 'file') return parsed.name;
  if (parsed.type === 'event_reference') {
    if (parsed.reference === 'song' && parsed.messageText) return parsed.messageText;
    if (parsed.reference === 'song') return parsed.song?.title || 'Song reference';
    if (parsed.reference === 'setlist') return `Setlist · ${parsed.eventTitle}`;
    if (parsed.reference === 'observation') return `Post-event observation · ${parsed.eventTitle}`;
    return parsed.eventTitle;
  }
  if (parsed.type === 'delete_request') return 'Delete chat request';
  return humanizeMentions(parsed.text);
}

function formatTypingUsers(users: Array<{ name: string }>): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing`;
  if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing`;
  return `${users[0].name} and ${users.length - 1} others are typing`;
}

const QUICK_REACTIONS = [
  { emoji: '👍', label: 'Like', surface: 'from-sky-400/30 to-sky-500/10 ring-sky-300/25' },
  { emoji: '❤️', label: 'Love', surface: 'from-rose-400/30 to-rose-500/10 ring-rose-300/25' },
  { emoji: '😂', label: 'Haha', surface: 'from-amber-300/25 to-yellow-400/10 ring-amber-200/25' },
  { emoji: '😊', label: 'Yay', surface: 'from-amber-300/25 to-orange-400/10 ring-amber-200/25' },
  { emoji: '😮', label: 'Wow', surface: 'from-amber-300/25 to-yellow-400/10 ring-amber-200/25' },
  { emoji: '😢', label: 'Sad', surface: 'from-sky-300/25 to-blue-400/10 ring-sky-200/25' },
  { emoji: '😠', label: 'Angry', surface: 'from-red-400/30 to-orange-500/10 ring-red-300/25' },
] as const;
const mobilePanelTransition = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.88 };
const mobilePanelShadow = '0 24px 70px -34px rgba(15, 23, 42, 0.65)';
const REPLY_DRAG_THRESHOLD = 56;

// ─── Emoji Picker ────────────────────────────────────────────────────────────

function EmojiPicker({ onPick }: { onPick: (emoji: string, sourceElement: HTMLElement) => void }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      data-app-nonselect="true"
      initial={prefersReducedMotion ? false : 'closed'}
      animate="open"
      variants={{
        closed: {},
        open: { transition: { delayChildren: 0.04, staggerChildren: 0.025 } },
      }}
      className="grid w-full grid-cols-7 gap-1 rounded-[1.3rem] border border-gray-200/80 bg-white p-2 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.72),0_0_32px_-18px_rgba(52,211,153,0.7)] ring-1 ring-emerald-400/10 dark:border-white/[0.10] dark:bg-[#18181b] dark:ring-emerald-300/10"
    >
      {QUICK_REACTIONS.map(reaction => (
        <motion.button
          key={reaction.emoji}
          type="button"
          onClick={event => onPick(reaction.emoji, event.currentTarget)}
          aria-label={`React with ${reaction.label}`}
          variants={prefersReducedMotion ? undefined : {
            closed: { opacity: 0, y: -10, scale: 0.76 },
            open: { opacity: 1, y: 0, scale: 1 },
          }}
          transition={prefersReducedMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 590, damping: 30, mass: 0.48 }}
          whileHover={{ y: -4, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="group/reaction flex min-w-0 flex-col items-center gap-1 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[23px] shadow-sm ring-1 ${reaction.surface} transition-[filter,box-shadow] group-hover/reaction:brightness-110 group-hover/reaction:shadow-md`}
            style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
          >
            {reaction.emoji}
          </span>
          <span className="truncate text-[8px] font-bold tracking-[-0.01em] text-gray-400 dark:text-white/38 sm:text-[9px]">{reaction.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

function EmojiReactionPopover({
  open,
  anchorRect,
  boundaryTop,
  onClose,
  onPick,
}: {
  open: boolean;
  anchorRect: MessageActionAnchorRect | null;
  boundaryTop: number;
  onClose: () => void;
  onPick: (emoji: string, sourceElement: HTMLElement) => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [style, setStyle] = useState<{ key: string; left: number; top: number; width: number; opacity: number; transformOrigin: string } | null>(null);
  const anchorKey = anchorRect
    ? [anchorRect.left, anchorRect.top, anchorRect.right, anchorRect.bottom, boundaryTop, viewport.width, viewport.height].join(':')
    : '';
  const positionedStyle = style?.key === anchorKey ? style : null;

  useEffect(() => {
    if (!open) return;
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) {
      setStyle(null);
      return;
    }
    if (style?.key === anchorKey) return;
    const popover = popoverRef.current?.getBoundingClientRect();
    const width = Math.min(390, viewport.width - 24);
    const height = popover?.height || 70;
    const lowerTopBound = Math.max(12, boundaryTop + 8);
    const roomAbove = anchorRect.top - lowerTopBound;
    const roomBelow = viewport.height - anchorRect.bottom - 12;
    const opensAbove = roomAbove >= height + 10 || roomBelow < height + 10;
    const preferredTop = opensAbove ? anchorRect.top - height - 10 : anchorRect.bottom + 10;
    const top = clampToViewport(preferredTop, lowerTopBound, viewport.height - height - 12);
    const centeredLeft = anchorRect.left + ((anchorRect.width - width) / 2);
    const left = clampToViewport(centeredLeft, 12, viewport.width - width - 12);
    setStyle({ key: anchorKey, left, top, width, opacity: 1, transformOrigin: opensAbove ? 'bottom center' : 'top center' });
  }, [anchorKey, anchorRect, boundaryTop, open, style?.key, viewport.height, viewport.width]);

  if (!open || !anchorRect) return null;

  const focusArea = {
    left: clampToViewport(anchorRect.left - 7, 0, viewport.width),
    top: clampToViewport(anchorRect.top - 7, 0, viewport.height),
    right: clampToViewport(anchorRect.right + 7, 0, viewport.width),
    bottom: clampToViewport(anchorRect.bottom + 7, 0, viewport.height),
  };

  if (!positionedStyle) {
    return createPortal(
      <div
        ref={popoverRef}
        aria-hidden="true"
        className="pointer-events-none fixed invisible"
        style={{ left: 12, top: anchorRect.bottom + 10, width: Math.min(390, viewport.width - 24) }}
      >
        <EmojiPicker onPick={onPick} />
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2147483647]" role="presentation" data-app-nonselect="true">
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ inset: '0 0 auto 0', height: focusArea.top }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ inset: `${focusArea.bottom}px 0 0 0` }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ left: 0, top: focusArea.top, width: focusArea.left, height: focusArea.bottom - focusArea.top }} />
      <div aria-hidden="true" onClick={onClose} className={MESSAGE_FOCUS_BACKDROP_CLASS} style={{ left: focusArea.right, right: 0, top: focusArea.top, height: focusArea.bottom - focusArea.top }} />
      <div
        aria-hidden="true"
        onClick={onClose}
        className="pointer-events-auto fixed bg-transparent"
        style={{ left: focusArea.left, top: focusArea.top, width: focusArea.right - focusArea.left, height: focusArea.bottom - focusArea.top }}
      />
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
        animate={prefersReducedMotion
          ? { opacity: positionedStyle.opacity }
          : { opacity: positionedStyle.opacity, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
        transition={prefersReducedMotion
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 510, damping: 35, mass: 0.68 }}
        className="pointer-events-auto fixed"
        style={positionedStyle}
        onClick={event => event.stopPropagation()}
      >
        <EmojiPicker onPick={onPick} />
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Conversation list item ──────────────────────────────────────────────────

const MESSAGE_DRAFT_CHANGED_EVENT = 'servesync-message-draft-changed';

function messageDraftKey(userId: string, conversationId: string) {
  return `servesync:message-draft:${userId}:${conversationId}`;
}

function readMessageDraft(userId: string, conversationId: string) {
  if (!userId || !conversationId || typeof window === 'undefined') return '';
  return window.localStorage.getItem(messageDraftKey(userId, conversationId)) ?? '';
}

function writeMessageDraft(userId: string, conversationId: string, value: string) {
  if (!userId || !conversationId || typeof window === 'undefined') return;
  const key = messageDraftKey(userId, conversationId);
  if (value.trim()) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(MESSAGE_DRAFT_CHANGED_EVENT, {
    detail: { conversationId },
  }));
}

type EventConversationArtworkData = {
  title: string | null;
  eventType: string | null;
  songs: Array<{
    title: string | null;
    artist: string | null;
    youtube_url: string | null;
  }>;
};

type EventConversationArtworkSongRow = {
  position: number | null;
  songs: EventConversationArtworkData['songs'][number] | null;
};

const eventConversationArtworkCache = new Map<string, EventConversationArtworkData>();

function EventConversationAvatar({ eventId, name, className = 'h-10 w-10 rounded-full' }: { eventId: string; name: string; className?: string }) {
  const [artwork, setArtwork] = useState<EventConversationArtworkData | null>(
    () => eventConversationArtworkCache.get(eventId) ?? null,
  );

  useEffect(() => {
    const cached = eventConversationArtworkCache.get(eventId);
    if (cached) {
      setArtwork(cached);
      return;
    }

    let cancelled = false;
    Promise.all([
      supabase
        .from('events')
        .select('title, event_type')
        .eq('id', eventId)
        .maybeSingle(),
      supabase
        .from('setlists')
        .select('setlist_songs(position, songs(title, artist, youtube_url))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([eventResult, setlistResult]) => {
      if (cancelled) return;
      const event = eventResult.data as { title?: string | null; event_type?: string | null } | null;
      const setlist = setlistResult.data as { setlist_songs?: EventConversationArtworkSongRow[] | null } | null;
      const nextArtwork: EventConversationArtworkData = {
        title: event?.title ?? name,
        eventType: event?.event_type ?? null,
        songs: [...(setlist?.setlist_songs ?? [])]
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          .map(item => item.songs)
          .filter((song): song is EventConversationArtworkData['songs'][number] => Boolean(song))
          .slice(0, 4),
      };
      eventConversationArtworkCache.set(eventId, nextArtwork);
      setArtwork(nextArtwork);
    });

    return () => { cancelled = true; };
  }, [eventId, name]);

  return (
    <EventArtwork
      eventType={artwork?.eventType}
      title={artwork?.title ?? name}
      songs={artwork?.songs ?? []}
      className={className}
    />
  );
}

function ConvItem({ conv, selected, myUserId, draft, onSelect, onLongPress }: {
  conv: Conversation; selected: boolean; myUserId: string; draft: string; onSelect: () => void; onLongPress: () => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const startPress = () => {
    clearPress();
    longPressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
    }, 520);
  };
  const name = getConvName(conv, myUserId);
  const listName = getConversationListName(conv, myUserId);
  const eventDateLabel = conv.type === 'event' && conv.event_date
    ? format(parseISO(conv.event_date), 'MMM d')
    : null;
  const lastContent = conv.last_message ? previewContent(conv.last_message.content) : 'No messages yet';
  const isMyLast = conv.last_message?.sender_id === myUserId;
  const avatarName = getConversationAvatarName(conv, myUserId);

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        onSelect();
      }}
      onPointerDown={startPress}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerLeave={clearPress}
      onContextMenu={(event) => {
        event.preventDefault();
        clearPress();
        onLongPress();
      }}
      aria-pressed={selected}
      style={{ WebkitTouchCallout: 'none' }}
      className={`select-none touch-pan-y flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 ${
        selected
          ? 'bg-emerald-50 dark:bg-emerald-500/[0.1]'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative shrink-0">
        {conv.type === 'event' && conv.event_id ? (
          <EventConversationAvatar eventId={conv.event_id} name={name} />
        ) : (
          <Avatar
            src={getConversationAvatarSrc(conv, myUserId)}
            firstName={avatarName.firstName}
            lastName={avatarName.lastName}
            size="md"
          />
        )}
        {conv.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
            {conv.unread_count > 9 ? '9+' : conv.unread_count}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className={`flex min-w-0 items-center gap-1.5 text-[13px] ${conv.unread_count > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-white/80'}`}>
            <span className="truncate">{listName}</span>
            {eventDateLabel && (
              <span className="min-w-0 truncate font-medium text-inherit" aria-label={`Event date ${eventDateLabel}${conv.event_type ? `, ${conv.event_type}` : ''}`}>
                <span aria-hidden="true">|</span> {eventDateLabel}{conv.event_type ? ` · ${conv.event_type}` : ''}
              </span>
            )}
          </span>
          {conv.last_message && !eventDateLabel && (
            <span className="text-[11px] text-gray-400 dark:text-white/30 shrink-0">
              {formatConvTime(conv.last_message.created_at)}
            </span>
          )}
        </div>
        <p className={`truncate text-[12px] ${draft.trim() ? 'font-semibold text-rose-500 dark:text-rose-400' : conv.unread_count > 0 ? 'text-gray-700 dark:text-white/70 font-medium' : 'text-gray-400 dark:text-white/35'}`}>
          {draft.trim() ? `Draft: ${draft.trim()}` : isMyLast ? `You: ${lastContent}` : lastContent}
        </p>
      </div>
    </button>
  );
}

// ─── New Message Modal ───────────────────────────────────────────────────────

type EventChoice = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  event_type: string | null;
};

function NewMessageModal({ open, onClose, onSelect, onCreateGroup, onCreateEventChat, currentUserId, canCreateAdminTestChat }: {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  onCreateGroup: (userIds: string[], groupName: string) => void;
  onCreateEventChat: (eventId: string, adminOnlyTest: boolean) => Promise<boolean>;
  currentUserId: string;
  canCreateAdminTestChat: boolean;
}) {
  const [mode, setMode] = useState<'direct' | 'group' | 'event'>('direct');
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; nickname: string | null; avatar_url: string | null }>>([]);
  const [events, setEvents] = useState<EventChoice[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventChoice | null>(null);
  const [adminOnlyEventChat, setAdminOnlyEventChat] = useState(false);
  const [creatingEventChat, setCreatingEventChat] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode('direct');
    setQuery('');
    setGroupName('');
    setSelectedIds(new Set());
    setSelectedEvent(null);
    setAdminOnlyEventChat(false);
    setCreatingEventChat(false);
    Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, nickname, avatar_url').order('first_name'),
      supabase.from('events').select('id, title, event_date, start_time, event_type').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(60),
    ]).then(([peopleRes, eventsRes]) => {
      setPeople((peopleRes.data || []).filter(p => p.id !== currentUserId));
      setEvents(eventsRes.data || []);
    });
  }, [currentUserId, open]);

  useEffect(() => {
    if (!open) return;

    document.documentElement.classList.add('new-message-modal-active');
    document.body.classList.add('new-message-modal-active');
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = '[data-autofocus="true"], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.classList.remove('new-message-modal-active');
      document.body.classList.remove('new-message-modal-active');
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  const filtered = people.filter(p => {
    const name = `${p.nickname || ''} ${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    return name.includes(query.toLowerCase());
  });
  const filteredEvents = events.filter(event => {
    const label = `${event.title} ${event.event_type || ''} ${event.event_date}`.toLowerCase();
    return label.includes(query.toLowerCase());
  });
  const selectedCount = selectedIds.size;

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach(p => next.delete(p.id));
      } else {
        filtered.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  const submitGroup = () => {
    if (selectedIds.size === 0 || !groupName.trim()) return;
    onCreateGroup([...selectedIds], groupName.trim());
    onClose();
  };

  const submitEventChat = async () => {
    if (!selectedEvent || creatingEventChat) return;
    setCreatingEventChat(true);
    const created = await onCreateEventChat(selectedEvent.id, adminOnlyEventChat);
    setCreatingEventChat(false);
    if (created) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transformTemplate={(_, generatedTransform) => `translateY(-50%) ${generatedTransform}`}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-message-title"
            className="fixed inset-x-4 top-1/2 z-[60] mx-auto flex max-h-[min(72dvh,36rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1c1c1e]"
          >
            <h2 id="new-message-title" className="sr-only">New message</h2>
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <div className="grid flex-1 grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="group" aria-label="Message type">
                  {(['direct', 'group', 'event'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setMode(option);
                        setSelectedEvent(null);
                        setAdminOnlyEventChat(false);
                      }}
                      aria-pressed={mode === option}
                      className={`h-10 rounded-xl text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                        mode === option
                          ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-white/45'
                      }`}
                    >
                      {option === 'direct' ? 'Direct' : option === 'group' ? 'Group' : 'Event'}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={onClose} aria-label="Close new message" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.06] dark:hover:text-white/60">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {mode === 'group' && (
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-1 px-1">Group Name</p>
                  <input
                    autoFocus
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    aria-label="Group name"
                    placeholder="e.g. Worship Team May 13"
                    className="w-full h-10 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[13px] font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-gray-400 dark:text-white/30 shrink-0" />
              <input
                autoFocus={mode !== 'group'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                data-autofocus="true"
                aria-label={mode === 'event' ? 'Search events' : mode === 'direct' ? 'Search people' : 'Search members'}
                placeholder={mode === 'event' ? 'Search events...' : mode === 'direct' ? 'Search people...' : 'Search members...'}
                className="flex-1 text-[14px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
              />
              </div>
            </div>
            {mode === 'group' && filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-white/[0.06]">
                <span className="text-[12px] text-gray-400 dark:text-white/30">
                  {selectedCount > 0 ? `${selectedCount} selected` : `${filtered.length} members`}
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {mode === 'event' ? (
                <>
                  {selectedEvent ? (
                    <div className="space-y-3 p-2">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/[0.07] dark:bg-white/[0.035]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-white">{selectedEvent.title}</span>
                            <span className="block truncate text-[11px] text-gray-400 dark:text-white/30">
                              {new Date(selectedEvent.event_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              {selectedEvent.event_type ? ` · ${selectedEvent.event_type}` : ''}
                            </span>
                          </span>
                        </div>
                      </div>
                      {canCreateAdminTestChat && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 p-3.5 dark:border-white/[0.07]">
                          <input
                            type="checkbox"
                            checked={adminOnlyEventChat}
                            onChange={event => setAdminOnlyEventChat(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">Admin-only test chat</span>
                            <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500 dark:text-white/45">
                              Use this event and its current setlist without adding scheduled members.
                            </span>
                          </span>
                        </label>
                      )}
                      <p className="px-1 text-[12px] leading-relaxed text-gray-500 dark:text-white/40">
                        {adminOnlyEventChat
                          ? 'Only your administrator account will be added. You can add another admin later from Chat Info.'
                          : 'All assigned team members will be added to the event chat.'}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={creatingEventChat}
                          onClick={() => {
                            setSelectedEvent(null);
                            setAdminOnlyEventChat(false);
                          }}
                          className="h-11 flex-1 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-white/55 dark:hover:bg-white/[0.04]"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={creatingEventChat}
                          onClick={submitEventChat}
                          className="h-11 flex-1 rounded-xl bg-emerald-500 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {creatingEventChat ? 'Creating…' : adminOnlyEventChat ? 'Create Test Chat' : 'Create Chat'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {filteredEvents.length === 0 && (
                        <p className="text-center text-[13px] text-gray-400 dark:text-white/30 py-6">No events found</p>
                      )}
                      {filteredEvents.map(event => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.05]"
                        >
                          <span className="shrink-0 h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <span className="flex-1 min-w-0 text-left">
                            <span className="block text-[13px] font-semibold text-gray-900 dark:text-white truncate">{event.title}</span>
                            <span className="block text-[11px] text-gray-400 dark:text-white/30 truncate">
                              {new Date(event.event_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              {event.event_type ? ` · ${event.event_type}` : ''}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20" />
                        </button>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <>
                  {filtered.length === 0 && (
                    <p className="text-center text-[13px] text-gray-400 dark:text-white/30 py-6">No people found</p>
                  )}
                  {filtered.map(p => {
                const name = getFullName(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (mode === 'group') {
                        toggleSelected(p.id);
                        return;
                      }
                      onSelect(p.id);
                      onClose();
                    }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.05]"
                  >
                    <Avatar src={p.avatar_url ?? undefined} firstName={p.first_name || name.charAt(0)} lastName={p.last_name ?? undefined} size="sm" />
                    <span className="flex-1 text-left text-[13px] font-medium text-gray-900 dark:text-white">{name}</span>
                    {mode === 'group' && (
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        selectedIds.has(p.id)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-gray-300 dark:border-white/20 text-transparent'
                      }`}>
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
                </>
              )}
            </div>
            {mode === 'group' && (
              <div className="p-3 border-t border-gray-100 dark:border-white/[0.06]">
                {!groupName.trim() && selectedCount > 0 && (
                  <p className="text-center text-[11px] text-amber-500 dark:text-amber-400 mb-2">Please enter a group name above</p>
                )}
                <button
                  onClick={submitGroup}
                  disabled={selectedCount === 0 || !groupName.trim()}
                  className="h-11 w-full rounded-xl bg-emerald-500 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Create Group{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Input Bar ───────────────────────────────────────────────────────────────

const QUICK_ACTION_OPTIONS = ['👍', '❤️', '🙏', '😂', '🔥', '👏'];
type EventChatCommand = 'setlist' | 'song' | 'observe';

type ComposerMentionProfile = {
  first_name: string;
  last_name: string;
  mentionHandle?: string;
};

function getMentionHandle(profile: ComposerMentionProfile) {
  return profile.mentionHandle ?? `${profile.first_name} ${profile.last_name}`.trim().replace(/\s+/g, '_');
}

function serializeComposerMentions(text: string, profiles: ComposerMentionProfile[]) {
  return [...profiles]
    .sort((a, b) => getMentionHandle(b).length - getMentionHandle(a).length)
    .reduce((serialized, profile) => {
      const handle = getMentionHandle(profile);
      const display = `@${handle.replace(/_/g, ' ')}`;
      const escapedDisplay = display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return serialized.replace(new RegExp(`(^|\\s)${escapedDisplay}(?=\\s|$|[,.!?;:])`, 'gi'), `$1@${handle}`);
    }, text);
}

function removeTrailingMentionWord(value: string, cursor: number) {
  const before = value.slice(0, cursor);
  const mention = before.match(/@[^\s@]+(?: [^\s@]+)*$/)?.[0];
  if (!mention) return null;
  const parts = mention.slice(1).split(' ');
  const replacement = parts.length > 1 ? `@${parts.slice(0, -1).join(' ')}` : '';
  const start = cursor - mention.length;
  return { value: `${value.slice(0, start)}${replacement}${value.slice(cursor)}`, cursor: start + replacement.length };
}

function ComposerMentionHighlight({ text, profiles }: { text: string; profiles: ComposerMentionProfile[] }) {
  const mentionDisplays = profiles
    .map(profile => `@${getMentionHandle(profile).replace(/_/g, ' ')}`)
    .sort((a, b) => b.length - a.length);
  const escaped = mentionDisplays.map(display => display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = escaped.length > 0 ? text.split(new RegExp(`(${escaped.join('|')})`, 'gi')) : [text];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-white">
      {parts.map((part, index) => mentionDisplays.some(display => display.toLowerCase() === part.toLowerCase())
        ? <span key={`${part}-${index}`} className="rounded bg-emerald-500/10 font-semibold text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">{part}</span>
        : <span key={`${part}-${index}`}>{part}</span>)}
    </div>
  );
}

function InputBar({ conversationId, onSend, replyTo, replyPreview, onCancelReply, onTyping, mentionProfiles, eventDetails }: {
  conversationId: string;
  onSend: (text: string, imageUrl?: string) => void;
  replyTo: string | null;
  replyPreview: string | null;
  onCancelReply: () => void;
  onTyping: (isTyping: boolean) => void;
  mentionProfiles: Array<ComposerMentionProfile & {
    id: string;
    avatar_url: string | null;
    gender: string | null;
    mentionLabel?: string;
    mentionDescription?: string;
    mentionType?: 'person' | 'everyone' | 'event';
  }>;
  eventDetails: EventDiscussionDetails | null;
}) {
  const { user } = useAuth();
  const [text, setText] = useState(() => readMessageDraft(user?.id ?? '', conversationId));
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [quickEmoji, setQuickEmoji] = useState(() => localStorage.getItem('msg-quick-action') || '👍');
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [editableMentionQuery, setEditableMentionQuery] = useState('');
  const [showEditableMentionDropdown, setShowEditableMentionDropdown] = useState(false);
  const [editableMentionStart, setEditableMentionStart] = useState<number | null>(null);
  const [editableMentionActiveIndex, setEditableMentionActiveIndex] = useState(0);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<EventDiscussionDetails['songs']>([]);
  const [songPickerMaxHeight, setSongPickerMaxHeight] = useState(352);
  const [editableDropdownRect, setEditableDropdownRect] = useState<{ bottom: number; left: number; width: number; maxHeight: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const loadedDraftIdentityRef = useRef('');
  const editableMentionTouchHandledRef = useRef(false);
  const editableMentionReleaseCleanupRef = useRef<(() => void) | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [useEditableComposer, setUseEditableComposer] = useState(false);

  const resizeComposer = useCallback(() => {
    const el = textRef.current || editableRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, []);

  const editableMentionProfiles = useMemo(() => {
    return mentionProfiles.filter(profile => {
      if (!editableMentionQuery) return true;
      const terms = [
        profile.first_name,
        profile.last_name,
        profile.mentionHandle,
        profile.mentionLabel,
      ].filter(Boolean)
        .flatMap(value => value!.toLowerCase().split(/[\s_]+/));
      return terms.some(term => term.startsWith(editableMentionQuery.toLowerCase()));
    }).slice(0, 6);
  }, [editableMentionQuery, mentionProfiles]);

  const commandQuery = getChatCommandQuery(text);
  const inlineSongCommand = getInlineSongShortcut(text);
  const filteredEventSongs = useMemo(() => {
    if (!eventDetails) return [];
    if (!inlineSongCommand?.query) return eventDetails.songs;
    return eventDetails.songs.filter(song => `${song.title} ${song.artist || ''}`.toLowerCase().includes(inlineSongCommand.query));
  }, [eventDetails, inlineSongCommand?.query]);
  const isPastEvent = eventDetails
    ? new Date(`${eventDetails.event_date}T${eventDetails.end_time || '23:59:59'}`).getTime() <= Date.now()
    : false;
  const commandOptions = useMemo(() => {
    if (commandQuery === null || !eventDetails) return [];
    const options: Array<{
      command: EventChatCommand;
      title: string;
      description: string;
      disabled: boolean;
    }> = [
      {
        command: 'setlist',
        title: 'Share setlist',
        description: eventDetails.songs.length > 0 ? `${eventDetails.songs.length} songs from this event` : 'No songs have been added yet',
        disabled: eventDetails.songs.length === 0,
      },
      {
        command: 'song',
        title: 'Reference a song',
        description: eventDetails.songs.length > 0 ? 'Choose a song, or type / followed by its title' : 'No songs have been added yet',
        disabled: eventDetails.songs.length === 0,
      },
      {
        command: 'observe',
        title: 'Add an observation',
        description: isPastEvent ? 'Open the post-event observation form' : 'Available after the event',
        disabled: !isPastEvent,
      },
    ];
    return options.filter(option => option.command.startsWith(commandQuery));
  }, [commandQuery, eventDetails, isPastEvent]);

  const computeEditableDropdownPosition = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportOffsetLeft = viewport?.offsetLeft ?? 0;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const composerTop = rect.top - viewportOffsetTop;
    const isPhone = viewportWidth < 640;
    const width = Math.min(Math.max(rect.width + (isPhone ? 104 : 56), isPhone ? 320 : 260), viewportWidth - 16);
    const left = Math.min(Math.max(rect.left - viewportOffsetLeft - (isPhone ? 52 : 28), 8), viewportWidth - width - 8);
    // The picker is portaled to the layout viewport, while the mobile chat
    // pane itself follows visualViewport. Anchor from the composer's physical
    // rect so the menu stays above it when the iOS keyboard shrinks the visual
    // viewport instead of being pushed below the keyboard.
    const bottom = Math.max(8, window.innerHeight - rect.top + 8);
    const maxHeight = Math.min(isPhone ? 360 : 300, Math.max(isPhone ? 180 : 144, composerTop - 16));
    setEditableDropdownRect({ bottom, left, width, maxHeight });
  }, []);

  useEffect(() => {
    loadedDraftIdentityRef.current = user?.id ? `${user.id}:${conversationId}` : '';
    setText(readMessageDraft(user?.id ?? '', conversationId));
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!user?.id || loadedDraftIdentityRef.current !== `${user.id}:${conversationId}`) return;
    writeMessageDraft(user.id, conversationId, text);
  }, [conversationId, text, user?.id]);

  const getEditableCaretOffset = useCallback(() => {
    const el = editableRef.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return text.length;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return text.length;
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
  }, [text.length]);

  const setEditableCaretOffset = useCallback((offset: number) => {
    const el = editableRef.current;
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();

    while (node) {
      const textNode = node as Text;
      if (remaining <= textNode.length) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(textNode, remaining);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      remaining -= textNode.length;
      node = walker.nextNode();
    }

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const updateEditableMentionState = useCallback((value: string, cursor: number) => {
    const textBefore = value.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setEditableMentionStart(cursor - atMatch[0].length);
      setEditableMentionQuery(atMatch[1]);
      setShowEditableMentionDropdown(true);
      setEditableMentionActiveIndex(0);
      requestAnimationFrame(computeEditableDropdownPosition);
      return;
    }

    setShowEditableMentionDropdown(false);
    setEditableMentionStart(null);
    setEditableMentionQuery('');
  }, [computeEditableDropdownPosition]);

  const syncEditableComposer = useCallback((value: string) => {
    setText(value);
    const el = editableRef.current;
    if (el) {
      el.textContent = value;
      el.focus({ preventScroll: true });
      setEditableCaretOffset(value.length);
    } else {
      const textarea = textRef.current;
      textarea?.focus({ preventScroll: true });
      if (textarea) textarea.setSelectionRange(value.length, value.length);
    }
    requestAnimationFrame(resizeComposer);
  }, [resizeComposer, setEditableCaretOffset]);

  const selectCommand = useCallback((command: EventChatCommand) => {
    setShowEditableMentionDropdown(false);
    if (command === 'song') {
      syncEditableComposer('/song ');
      setShowSongPicker(true);
      return;
    }
    setSelectedSongs([]);
    setShowSongPicker(false);
    syncEditableComposer(`/${command} `);
  }, [syncEditableComposer]);

  const selectSong = useCallback((song: EventDiscussionDetails['songs'][number]) => {
    const command = getInlineSongShortcut(text);
    const token = `♪ ${song.title}`;
    const nextText = command
      ? `${text.slice(0, command.start)}${token} `
      : `${text}${text && !text.endsWith(' ') ? ' ' : ''}${token} `;
    setSelectedSongs(current => current.some(item => item.id === song.id) ? current : [...current, song]);
    setShowSongPicker(false);
    syncEditableComposer(nextText);
  }, [syncEditableComposer, text]);

  const handleSend = () => {
    if (!text.trim()) return;
    const serializedText = serializeComposerMentions(text, mentionProfiles);
    let outgoing = serializedText;
    const normalized = text.trim();
    if (eventDetails) {
      if (normalized.toLowerCase() === '@event') {
        outgoing = createChatEventReference('event', eventDetails);
      } else if (normalized.toLowerCase() === '/setlist' && eventDetails.songs.length > 0) {
        outgoing = createChatEventReference('setlist', eventDetails);
      } else if (normalized.toLowerCase() === '/observe' && isPastEvent) {
        outgoing = createChatEventReference('observation', eventDetails);
      } else {
        const referencedSongs = selectedSongs.filter(song => text.includes(`♪ ${song.title}`));
        if (referencedSongs.length > 0) {
          outgoing = createChatEventReference('song', eventDetails, referencedSongs[0], serializedText, referencedSongs);
        }
      }
    }
    onTyping(false);
    onSend(outgoing);
    setText('');
    if (editableRef.current) {
      editableRef.current.textContent = '';
    }
    setShowEditableMentionDropdown(false);
    setEditableMentionStart(null);
    setEditableMentionQuery('');
    setShowSongPicker(false);
    setSelectedSongs([]);
    requestAnimationFrame(resizeComposer);
  };

  const placeCaretAtEnd = useCallback((el: HTMLElement) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const focusComposerWithoutPageScroll = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const el = textRef.current;
    if (!el) return;
    window.dispatchEvent(new Event('messages-composer-focus'));
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };

  const focusEditableComposerWithoutPageScroll = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const el = editableRef.current;
    if (!el) return;
    window.dispatchEvent(new Event('messages-composer-focus'));
    el.focus({ preventScroll: true });
    placeCaretAtEnd(el);
  };

  const handleEditableInput = (e: React.FormEvent<HTMLDivElement>) => {
    const value = e.currentTarget.innerText.replace(/\n$/, '');
    setSelectedSongs(current => current.filter(song => value.includes(`♪ ${song.title}`)));
    setShowSongPicker(Boolean(getInlineSongShortcut(value)));
    setText(value);
    resizeComposer();
    updateEditableMentionState(value, getEditableCaretOffset());
    // iOS may update its selection after the input event. Re-read it on the
    // next frame so @ + typed characters filter the mention list immediately.
    requestAnimationFrame(() => {
      const liveValue = editableRef.current?.innerText.replace(/\n$/, '') ?? value;
      updateEditableMentionState(liveValue, getEditableCaretOffset());
    });
    onTyping(value.trim().length > 0);
  };

  const suppressEditableMentionRelease = useCallback(() => {
    editableMentionReleaseCleanupRef.current?.();

    let timeoutId: number | null = null;
    const releaseEvents = ['pointerup', 'mouseup', 'click'];
    const stopRelease = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      if (event.type === 'click') {
        cleanup();
      }
    };
    const cleanup = () => {
      releaseEvents.forEach(type => {
        document.removeEventListener(type, stopRelease, { capture: true });
      });
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (editableMentionReleaseCleanupRef.current === cleanup) {
        editableMentionReleaseCleanupRef.current = null;
      }
    };

    releaseEvents.forEach(type => {
      document.addEventListener(type, stopRelease, { capture: true, passive: false });
    });
    timeoutId = window.setTimeout(cleanup, 650);
    editableMentionReleaseCleanupRef.current = cleanup;
  }, []);

  const insertEditableMention = useCallback((profile: (typeof mentionProfiles)[number], options: { deferClose?: boolean } = {}) => {
    if (editableMentionStart === null) return;
    const cursor = getEditableCaretOffset();
    const before = text.slice(0, editableMentionStart);
    const after = text.slice(cursor);
    const mention = `@${getMentionHandle(profile).replace(/_/g, ' ')}`;
    const nextText = `${before}${mention} ${after}`;
    const nextCursor = before.length + mention.length + 1;

    const el = editableRef.current;
    if (el) {
      el.textContent = nextText;
      el.focus({ preventScroll: true });
      setEditableCaretOffset(nextCursor);
      resizeComposer();
      window.dispatchEvent(new Event('messages-composer-focus'));
    }

    setText(nextText);
    setEditableMentionStart(null);
    setEditableMentionQuery('');

    const closeDropdown = () => {
      setShowEditableMentionDropdown(false);
      const currentEl = editableRef.current;
      if (!currentEl) return;
      currentEl.focus({ preventScroll: true });
      setEditableCaretOffset(nextCursor);
    };

    if (options.deferClose) {
      window.setTimeout(closeDropdown, 180);
    } else {
      closeDropdown();
    }

    requestAnimationFrame(() => {
      const el = editableRef.current;
      if (!el) return;
      el.textContent = nextText;
      el.focus({ preventScroll: true });
      setEditableCaretOffset(nextCursor);
      resizeComposer();
    });
  }, [editableMentionStart, getEditableCaretOffset, resizeComposer, setEditableCaretOffset, text]);

  const stopEditableMentionEvent = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.nativeEvent as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
    editableRef.current?.focus({ preventScroll: true });
  }, []);

  const handleEditableMentionTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    stopEditableMentionEvent(event);
  }, [stopEditableMentionEvent]);

  const handleEditableMentionTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>, profile: (typeof mentionProfiles)[number]) => {
    stopEditableMentionEvent(event);
    if (editableMentionTouchHandledRef.current) return;
    editableMentionTouchHandledRef.current = true;
    suppressEditableMentionRelease();
    insertEditableMention(profile, { deferClose: true });
    window.setTimeout(() => {
      editableMentionTouchHandledRef.current = false;
    }, 350);
  }, [insertEditableMention, stopEditableMentionEvent, suppressEditableMentionRelease]);

  const handleEditableMentionMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, profile: (typeof mentionProfiles)[number]) => {
    stopEditableMentionEvent(event);
    if (editableMentionTouchHandledRef.current) return;
    suppressEditableMentionRelease();
    insertEditableMention(profile);
  }, [insertEditableMention, stopEditableMentionEvent, suppressEditableMentionRelease]);

  const handleEditableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showEditableMentionDropdown && editableMentionProfiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setEditableMentionActiveIndex(i => Math.min(i + 1, editableMentionProfiles.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setEditableMentionActiveIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertEditableMention(editableMentionProfiles[editableMentionActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowEditableMentionDropdown(false);
      }
    }

    if (e.key === 'Backspace') {
      const next = removeTrailingMentionWord(text, getEditableCaretOffset());
      if (!next) return;
      e.preventDefault();
      const el = editableRef.current;
      if (el) el.textContent = next.value;
      setText(next.value);
      onTyping(next.value.trim().length > 0);
      requestAnimationFrame(() => setEditableCaretOffset(next.cursor));
    }
  };

  useEffect(() => {
    return () => onTyping(false);
  }, [onTyping]);

  useEffect(() => {
    return () => editableMentionReleaseCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const isAppleTouch =
      /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setUseEditableComposer(isAppleTouch && mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerText !== text) {
      el.innerText = text;
    }
    requestAnimationFrame(resizeComposer);
  }, [resizeComposer, text, useEditableComposer]);

  useEffect(() => {
    if (!showEditableMentionDropdown || !useEditableComposer) return;
    computeEditableDropdownPosition();
    window.addEventListener('resize', computeEditableDropdownPosition);
    window.addEventListener('scroll', computeEditableDropdownPosition, true);
    window.visualViewport?.addEventListener('resize', computeEditableDropdownPosition);
    window.visualViewport?.addEventListener('scroll', computeEditableDropdownPosition);
    return () => {
      window.removeEventListener('resize', computeEditableDropdownPosition);
      window.removeEventListener('scroll', computeEditableDropdownPosition, true);
      window.visualViewport?.removeEventListener('resize', computeEditableDropdownPosition);
      window.visualViewport?.removeEventListener('scroll', computeEditableDropdownPosition);
    };
  }, [computeEditableDropdownPosition, showEditableMentionDropdown, useEditableComposer]);

  useEffect(() => {
    if (!showSongPicker) return;
    const update = () => {
      const composer = textRef.current || editableRef.current;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const composerTop = composer?.getBoundingClientRect().top ?? (window.visualViewport?.height ?? window.innerHeight);
      setSongPickerMaxHeight(Math.min(352, Math.max(144, composerTop - viewportTop - 12)));
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [showSongPicker]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setShowAttachMenu(false);
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) {
      console.error('[Upload] Image upload failed:', error.message);
      alert('Failed to send photo. Please try again.');
    } else {
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      onSend(JSON.stringify({ type: 'image', url: publicUrl }));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setShowAttachMenu(false);
    setUploading(true);
    const path = `${user.id}/files/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) {
      console.error('[Upload] File upload failed:', error.message);
      alert('Failed to send file. Please try again.');
    } else {
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      onSend(JSON.stringify({ type: 'file', url: publicUrl, name: file.name, size: file.size }));
    }
    setUploading(false);
    if (attachRef.current) attachRef.current.value = '';
  };

  const handleQuickPointerDown = () => {
    longPressTimer.current = setTimeout(() => setShowQuickPicker(true), 500);
  };
  const handleQuickPointerUp = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const isDesktop = useIsDesktop();
  const composerBar = (
    <div
      className={`${isDesktop ? 'relative' : 'mobile-chat-composer fixed inset-x-0 bottom-0'} w-full shrink-0 border-t border-gray-100 bg-white dark:border-white/[0.06] dark:bg-[#111013]`}
      style={isDesktop
        ? { paddingBottom: '8px' }
        : {
          bottom: 'calc(var(--messages-keyboard-inset, 0px) + 42px - env(safe-area-inset-bottom, 0px))',
          paddingBottom: '8px',
          zIndex: 2147483647,
          isolation: 'isolate',
          transform: 'translateZ(0)',
        }}
    >
      <AnimatePresence>
        {eventDetails && commandQuery !== null && !showSongPicker && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-3 bottom-full z-50 mb-2 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1c1b1e]"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-3.5 py-2 dark:border-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Event commands</span>
              <span className="text-[10px] text-gray-400 dark:text-white/30">Type to filter</span>
            </div>
            {commandOptions.length > 0 ? commandOptions.map(option => (
              <button
                key={option.command}
                type="button"
                disabled={option.disabled}
                onPointerDown={event => event.preventDefault()}
                onClick={() => selectCommand(option.command)}
                className="flex min-h-14 w-full items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  option.command === 'observe'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                    : option.command === 'song'
                      ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}>
                  {option.command === 'observe' ? <MessageCircle className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-emerald-600 dark:text-emerald-300">/{option.command}</span>
                    <span className="truncate text-[13px] font-bold text-gray-900 dark:text-white">{option.title}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-gray-400 dark:text-white/35">{option.description}</span>
                </span>
              </button>
            )) : (
              <p className="px-4 py-4 text-center text-[12px] text-gray-400 dark:text-white/35">No matching event command</p>
            )}
          </motion.div>
        )}
        {eventDetails && showSongPicker && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-3 bottom-full z-50 mb-2 touch-pan-y overflow-y-auto overscroll-contain rounded-2xl border border-gray-200/80 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1c1b1e]"
            style={{ maxHeight: songPickerMaxHeight, WebkitOverflowScrolling: 'touch' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-3.5 py-2.5 dark:border-white/[0.06] dark:bg-[#1c1b1e]">
              <span className="text-[12px] font-bold text-gray-900 dark:text-white">Choose a setlist song</span>
              <button
                type="button"
                onClick={() => setShowSongPicker(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                aria-label="Close song picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {filteredEventSongs.length > 0 ? filteredEventSongs.map((song) => {
              const index = eventDetails.songs.findIndex(item => item.id === song.id);
              return (
              <button
                key={song.id}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectSong(song)}
                className="flex min-h-14 w-full items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-gray-50 dark:border-white/[0.05] dark:hover:bg-white/[0.04]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[11px] font-black text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-gray-900 dark:text-white">{song.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-gray-400 dark:text-white/35">
                    {[song.artist, song.performed_key || song.song_key ? `Key ${song.performed_key || song.song_key}` : null].filter(Boolean).join(' · ') || 'Setlist song'}
                  </span>
                </span>
              </button>
              );
            }) : (
              <p className="px-4 py-6 text-center text-[12px] text-gray-400 dark:text-white/35">No matching song in this setlist</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {replyTo && replyPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 pt-2.5 pb-0">
              <CornerUpLeft className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <div className="flex-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[12px] text-gray-500 dark:text-white/40">
                {replyPreview}
              </div>
              <button onClick={onCancelReply} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-[1] flex items-end gap-2 px-3 py-2.5">
        {/* + attach button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowAttachMenu(v => !v)}
            disabled={uploading}
            aria-label={showAttachMenu ? 'Close attachment menu' : 'Add an attachment'}
            aria-expanded={showAttachMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-gray-100 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-40 dark:text-white/30 dark:hover:bg-white/[0.06] dark:hover:text-emerald-400"
          >
            <Plus className="h-5 w-5" />
          </button>

          <AnimatePresence>
            {showAttachMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAttachMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 6 }}
                  transition={{ duration: 0.13 }}
                  className="absolute bottom-full mb-2 left-0 z-50 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-xl overflow-hidden min-w-[170px]"
                >
                  <label className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    Photo / Video
                    <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleImage} className="hidden" disabled={uploading} />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-3 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer border-t border-gray-100 dark:border-white/[0.06]">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    File
                    <input ref={attachRef} type="file" accept="*/*" onChange={handleFile} className="hidden" disabled={uploading} />
                  </label>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 min-h-[36px] max-h-[140px] flex items-end rounded-2xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden">
          {useEditableComposer ? (
            <div className="relative flex-1 self-stretch">
              {text && <ComposerMentionHighlight text={text} profiles={mentionProfiles} />}
              <div
                ref={editableRef}
                contentEditable
                role="textbox"
                aria-label="Message"
                data-placeholder="Message..."
                data-chat-composer="true"
                suppressContentEditableWarning
                onInput={handleEditableInput}
                onFocus={() => window.dispatchEvent(new Event('messages-composer-focus'))}
                onClick={() => {
                  if (showEditableMentionDropdown) computeEditableDropdownPosition();
                }}
                onKeyDown={handleEditableKeyDown}
                onPointerDown={focusEditableComposerWithoutPageScroll}
                className={`chat-editable-input relative z-[1] flex-1 px-3.5 py-2 text-[15px] bg-transparent outline-none leading-relaxed overflow-y-auto whitespace-pre-wrap break-words ${text ? '!text-transparent caret-emerald-500' : 'text-gray-900 dark:text-white is-empty'}`}
                style={{ maxHeight: '132px', minHeight: '40px' }}
              />
            </div>
          ) : (
            <MentionTextarea
              textareaRef={textRef}
              value={text}
              profiles={mentionProfiles}
              onChange={(value) => {
                setSelectedSongs(current => current.filter(song => value.includes(`♪ ${song.title}`)));
                setShowSongPicker(Boolean(getInlineSongShortcut(value)));
                setText(value);
                resizeComposer();
                onTyping(value.trim().length > 0);
              }}
              onFocus={() => window.dispatchEvent(new Event('messages-composer-focus'))}
              onPointerDown={focusComposerWithoutPageScroll}
              placeholder="Message…"
              rows={1}
              style={{ resize: 'none', maxHeight: '132px' }}
              className="flex-1 px-3.5 py-2 text-[15px] sm:text-[14px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none leading-relaxed overflow-y-auto"
              overlayClassName="px-3.5 py-2 text-[15px] leading-relaxed sm:text-[14px]"
            />
          )}
        </div>

        {/* Send / Quick action toggle */}
        <div className="relative shrink-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {text.trim() ? (
              <motion.button
                key="send"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                onMouseDown={e => e.preventDefault()}
                onClick={handleSend}
                disabled={uploading}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4" style={{ marginLeft: '1px' }} />
              </motion.button>
            ) : (
              <motion.button
                key="quick"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => { if (!showQuickPicker) onSend(quickEmoji); }}
                onPointerDown={handleQuickPointerDown}
                onPointerUp={handleQuickPointerUp}
                onPointerLeave={handleQuickPointerUp}
                onContextMenu={e => e.preventDefault()}
                disabled={uploading}
                aria-label={`Send ${quickEmoji}; press and hold for more reactions`}
                className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-gray-100 text-[22px] leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-90 disabled:opacity-40 dark:bg-white/[0.06]"
              >
                {quickEmoji}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Long-press picker */}
          <AnimatePresence>
            {showQuickPicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowQuickPicker(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: 6 }}
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-full right-0 mb-2 z-50 p-1.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/[0.08] shadow-xl"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-white/25 px-1.5 pb-1.5">Quick action</p>
                  <div className="flex gap-0.5">
                    {QUICK_ACTION_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => { setQuickEmoji(e); localStorage.setItem('msg-quick-action', e); setShowQuickPicker(false); }}
                        className={`w-10 h-10 flex items-center justify-center text-[20px] rounded-xl transition-colors ${
                          e === quickEmoji
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200 dark:ring-emerald-500/30'
                            : 'hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      {useEditableComposer && showEditableMentionDropdown && editableMentionProfiles.length > 0 && editableDropdownRect &&
        createPortal(
          <div
            className="fixed z-[2147483647] touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.08] dark:bg-[#1c1b1e] dark:ring-white/[0.1]"
            style={{
              bottom: editableDropdownRect.bottom,
              left: editableDropdownRect.left,
              width: editableDropdownRect.width,
              maxHeight: editableDropdownRect.maxHeight,
              touchAction: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
          >
            {editableMentionProfiles.map((profile, index) => (
              <div
                key={profile.id}
                role="option"
                aria-selected={index === editableMentionActiveIndex}
                onTouchStartCapture={handleEditableMentionTouchStart}
                onTouchEndCapture={event => handleEditableMentionTouchEnd(event, profile)}
                onMouseDownCapture={event => handleEditableMentionMouseDown(event, profile)}
                onClickCapture={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${
                  index === editableMentionActiveIndex
                    ? 'bg-brand-50 dark:bg-brand-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {profile.mentionType === 'everyone' ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[15px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/10">
                    @
                  </span>
                ) : profile.mentionType === 'event' ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/10">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                ) : (
                  <Avatar src={profile.avatar_url} firstName={profile.first_name} lastName={profile.last_name} size="sm" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {profile.mentionLabel ?? `${profile.first_name} ${profile.last_name}`}
                  </p>
                  <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    @{profile.mentionHandle ?? `${profile.first_name}_${profile.last_name}`}
                  </p>
                  {profile.mentionDescription && (
                    <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{profile.mentionDescription}</p>
                  )}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );

  if (!isDesktop && typeof document !== 'undefined') {
    return createPortal(composerBar, document.body);
  }

  return composerBar;
}

// ─── Conversation Info Panel ─────────────────────────────────────────────────

function ConvInfoPanel({
  conv, messages, myUserId, onClose, onBack, onScrollToMessage, onConvUpdate,
  onRequestDelete, onDeleteAsCreator, onRenameGroup, onAddMembers, onUpdateGroupPhoto,
}: {
  conv: Conversation;
  messages: ReturnType<typeof import('../hooks/useMessages').useMessages>['messages'];
  myUserId: string;
  onClose: () => void;
  onBack: () => void;
  onScrollToMessage: (id: string) => void;
  onConvUpdate: () => void;
  onRequestDelete: (conversationId: string) => Promise<boolean>;
  onDeleteAsCreator: (conversationId: string) => Promise<boolean>;
  onRenameGroup: (conversationId: string, name: string) => Promise<boolean>;
  onAddMembers: (conversationId: string, memberIds: string[]) => Promise<boolean>;
  onUpdateGroupPhoto: (conversationId: string, photoUrl: string | null) => Promise<boolean>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conv.name || '');
  const [savingName, setSavingName] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [availablePeople, setAvailablePeople] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; nickname: string | null; avatar_url: string | null }>>([]);
  const [loadingAvailablePeople, setLoadingAvailablePeople] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [infoView, setInfoView] = useState<'main' | 'media' | 'files' | 'links'>('main');
  const [leaveGroupConfirm, setLeaveGroupConfirm] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const groupPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const otherMember = conv.type === 'personal' ? conv.members.find(m => m.user_id !== myUserId) : null;
  const p = otherMember?.profile;
  const displayName = p ? getFullName(p) : (conv.name || 'Group Chat');
  const convAvatarName = getConversationAvatarName(conv, myUserId);
  const sortedMembers = [...conv.members].sort((a, b) => getFullName(a.profile).localeCompare(getFullName(b.profile)));

  const mediaItems = messages.filter(m => parseContent(m.content).type === 'image');
  const fileItems = messages.filter(m => parseContent(m.content).type === 'file');
  const latestMediaItem = mediaItems[mediaItems.length - 1] ?? null;
  const latestFileItem = fileItems[fileItems.length - 1] ?? null;

  const linkRegex = /https?:\/\/[^\s<>"]+/g;
  const linkItems: { url: string; msgId: string }[] = [];
  messages.forEach(m => {
    const c = parseContent(m.content);
    if (c.type === 'text') {
      const found = c.text.match(linkRegex);
      if (found) found.forEach(url => linkItems.push({ url, msgId: m.id }));
    }
  });
  const latestLinkItem = linkItems[linkItems.length - 1] ?? null;

  const searchResults = search.trim()
    ? messages.filter(m => {
        const c = parseContent(m.content);
        return c.type === 'text' && c.text.toLowerCase().includes(search.toLowerCase());
      })
    : [];

  const handleDeleteChat = async () => {
    if (!user) return;
    setLeaving(true);
    const ok = conv.type === 'personal'
      ? await onRequestDelete(conv.id)
      : await onDeleteAsCreator(conv.id);
    setLeaving(false);
    if (!ok) return;
    if (conv.type === 'personal') {
      setLeaveConfirm(false);
      onClose();
    } else {
      onBack();
      onConvUpdate();
    }
  };

  const isCreator = conv.created_by === myUserId;
  const canDelete = conv.type === 'personal' || isCreator;
  const existingMemberIds = useMemo(() => new Set(conv.members.map(member => member.user_id)), [conv.members]);
  const filteredAvailablePeople = availablePeople.filter(person => {
    const haystack = `${person.nickname || ''} ${person.first_name || ''} ${person.last_name || ''}`.toLowerCase();
    return haystack.includes(memberSearch.toLowerCase());
  });

  const saveGroupName = async () => {
    const nextName = renameValue.trim();
    if (!nextName) return;
    setSavingName(true);
    const ok = await onRenameGroup(conv.id, nextName);
    setSavingName(false);
    if (ok) {
      setRenaming(false);
      onConvUpdate();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conv.id)
      .eq('user_id', userId);
    if (error) {
      toast('error', 'Failed to remove member');
      return;
    }
    onConvUpdate();
    toast('success', 'Member removed');
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    setLeavingGroup(true);
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conv.id)
      .eq('user_id', user.id);
    setLeavingGroup(false);
    if (error) {
      toast('error', 'Failed to leave group');
      return;
    }
    onBack();
    onConvUpdate();
  };

  useEffect(() => {
    if ((conv.type !== 'group' && conv.type !== 'event') || !addMembersOpen) return;
    let cancelled = false;
    setLoadingAvailablePeople(true);

    const fetchPeople = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, nickname, avatar_url')
          .order('first_name');
        if (cancelled) return;
        if (error) {
          setAvailablePeople([]);
          setLoadingAvailablePeople(false);
          toast('error', 'Failed to load people');
          return;
        }
        setAvailablePeople((data || []).filter(person => !existingMemberIds.has(person.id)));
        setLoadingAvailablePeople(false);
      } catch {
        if (!cancelled) { setAvailablePeople([]); setLoadingAvailablePeople(false); }
      }
    };

    fetchPeople();
    return () => { cancelled = true; };
  }, [addMembersOpen, conv.type, conv.event_id, existingMemberIds, toast]);

  const toggleSelectedMember = (memberId: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleAddMembers = async () => {
    if (selectedMemberIds.size === 0) return;
    setAddingMembers(true);
    const nextIds = [...selectedMemberIds];
    const ok = await onAddMembers(conv.id, nextIds);
    setAddingMembers(false);
    if (!ok) {
      toast('error', 'Failed to add members');
      return;
    }
    setSelectedMemberIds(new Set());
    setMemberSearch('');
    setAddMembersOpen(false);
    onConvUpdate();
    toast('success', `${nextIds.length} member${nextIds.length > 1 ? 's' : ''} added`);
  };

  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || conv.type !== 'group') return;
    if (!file.type.startsWith('image/')) {
      toast('error', 'Please select an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('error', 'Image must be under 5MB');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${user.id}/group-photos/${conv.id}-${Date.now()}.${safeExt}`;
    setUploadingPhoto(true);
    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (uploadError) {
      setUploadingPhoto(false);
      toast('error', uploadError.message || 'Failed to upload group photo');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    const ok = await onUpdateGroupPhoto(conv.id, `${publicUrl}?t=${Date.now()}`);
    setUploadingPhoto(false);
    if (!ok) {
      toast('error', 'Failed to save group photo');
      return;
    }
    onConvUpdate();
    toast('success', 'Group photo updated');
  };

  const handleRemoveGroupPhoto = async () => {
    if (conv.type !== 'group' || !conv.photo_url) return;
    setRemovingPhoto(true);
    const ok = await onUpdateGroupPhoto(conv.id, null);
    setRemovingPhoto(false);
    if (!ok) {
      toast('error', 'Failed to remove group photo');
      return;
    }
    onConvUpdate();
    toast('success', 'Group photo removed');
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] dark:bg-[#0d0d0f]">
      {/* Header */}
      <div className="relative z-20 shrink-0 flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:pt-[calc(env(safe-area-inset-top)+12px)] bg-white dark:bg-[#111013] border-b border-gray-100 dark:border-white/[0.06] lg:bg-white/96 lg:backdrop-blur-xl dark:lg:bg-[#111013]/96 lg:pt-4">
        <button
          onClick={() => {
            if (infoView !== 'main') {
              setInfoView('main');
              return;
            }
            onClose();
          }}
          className="h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
        </button>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">
          {infoView === 'main' ? 'Info' : infoView === 'media' ? 'Media' : infoView === 'files' ? 'Files' : 'Links'}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {infoView === 'media' && (
          <div className="mx-4 mt-4 mb-6 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">All Media</span>
              <span className="text-[12px] text-gray-400 dark:text-white/30">{mediaItems.length}</span>
            </div>
            {mediaItems.length === 0 ? (
              <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No photos yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {mediaItems.map(m => {
                  const c = parseContent(m.content) as { type: 'image'; url: string };
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onScrollToMessage(m.id); onClose(); }}
                      className="aspect-square overflow-hidden"
                    >
                      <img src={c.url} alt="media" className="h-full w-full object-cover hover:opacity-90 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {infoView === 'files' && (
          <div className="mx-4 mt-4 mb-6 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">All Files</span>
              <span className="text-[12px] text-gray-400 dark:text-white/30">{fileItems.length}</span>
            </div>
            {fileItems.length === 0 ? (
              <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No files yet</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {fileItems.map(m => {
                  const c = parseContent(m.content) as { type: 'file'; url: string; name: string; size: number };
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="h-8 w-8 shrink-0 text-gray-400 dark:text-white/30" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 dark:text-white/80 truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-white/30">{c.size > 0 ? `${(c.size / 1024).toFixed(0)} KB` : 'File'}</p>
                      </div>
                      <a
                        href={c.url}
                        download={c.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-emerald-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {infoView === 'links' && (
          <div className="mx-4 mt-4 mb-6 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">All Links</span>
              <span className="text-[12px] text-gray-400 dark:text-white/30">{linkItems.length}</span>
            </div>
            {linkItems.length === 0 ? (
              <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No links yet</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {linkItems.map(({ url, msgId }, i) => (
                  <div key={`${msgId}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-[12px] text-emerald-600 dark:text-emerald-400 truncate hover:underline"
                    >
                      {url}
                    </a>
                    <button
                      onClick={() => { onScrollToMessage(msgId); onClose(); }}
                      className="shrink-0 text-[11px] font-semibold text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 transition-colors whitespace-nowrap"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {infoView === 'main' && (
          <>
        {/* Profile card */}
        <div className="mx-4 mt-4 flex flex-col items-center border-b border-gray-100 px-4 py-6 dark:border-white/[0.06]">
          {getConversationAvatarSrc(conv, myUserId) ? (
            <img src={getConversationAvatarSrc(conv, myUserId)} alt={displayName} className="h-20 w-20 rounded-full object-cover mb-3" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-3xl mb-3">
              {(convAvatarName.firstName[0] || displayName[0] || '?').toUpperCase()}
            </div>
          )}
          <p className="text-[16px] font-bold text-gray-900 dark:text-white">{displayName}</p>
          <p className="text-[12px] text-gray-400 dark:text-white/30 mt-0.5">
            {conv.members.length} {conv.members.length === 1 ? 'member' : 'members'}
          </p>
          {conv.type === 'group' && (
            <>
              <input
                ref={groupPhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGroupPhotoUpload}
              />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => groupPhotoInputRef.current?.click()}
                  disabled={uploadingPhoto || removingPhoto}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-45 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {uploadingPhoto ? 'Uploading…' : conv.photo_url ? 'Change Photo' : 'Add Photo'}
                </button>
                {conv.photo_url && (
                  <button
                    onClick={handleRemoveGroupPhoto}
                    disabled={uploadingPhoto || removingPhoto}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-50 px-3.5 text-[12px] font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-45 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {removingPhoto ? 'Removing…' : 'Remove Photo'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {conv.type === 'group' && (
          <div className="mx-4 border-b border-gray-100 px-0 py-4 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-white/35">Group name</p>
                {!renaming && (
                  <p className="mt-0.5 text-[14px] font-bold text-gray-900 dark:text-white truncate">{conv.name || 'Group Chat'}</p>
                )}
              </div>
              {!renaming && (
                <button
                  onClick={() => { setRenameValue(conv.name || ''); setRenaming(true); }}
                  className="shrink-0 h-8 px-3 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[12px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors"
                >
                  Rename
                </button>
              )}
            </div>
            {renaming && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  maxLength={80}
                  autoFocus
                  className="min-w-0 flex-1 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] px-3 text-[13px] font-semibold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
                  placeholder="Group name"
                />
                <button
                  onClick={() => setRenaming(false)}
                  className="h-10 w-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-white/35 flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={saveGroupName}
                  disabled={savingName || !renameValue.trim()}
                  className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center disabled:opacity-45"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {(conv.type === 'group' || conv.type === 'event') && (
          <div className="mx-4 border-b border-gray-100 dark:border-white/[0.06]">
            <button
              onClick={() => setShowMembersModal(true)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Members</p>
                <p className="text-[11px] text-gray-400 dark:text-white/30">{conv.members.length} in this group</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-white/20" />
            </button>
          </div>
        )}

        {/* Search card */}
        <div className="mx-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 py-3">
            <Search className="h-3.5 w-3.5 text-gray-400 dark:text-white/30 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in chat…"
              className="flex-1 text-[13px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-white/50 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!search ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-4">Type to search messages</p>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-4">No results found</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {searchResults.map(m => {
                const c = parseContent(m.content) as { type: 'text'; text: string };
                const idx = c.text.toLowerCase().indexOf(search.toLowerCase());
                const preview = c.text.length > 80 ? c.text.slice(Math.max(0, idx - 15), idx + 60) + '…' : c.text;
                return (
                  <button
                    key={m.id}
                    onClick={() => { onScrollToMessage(m.id); onClose(); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[12px] font-semibold text-gray-700 dark:text-white/70">{getSenderName(m.sender)}</p>
                      <p className="text-[10px] text-gray-300 dark:text-white/20">{formatMsgTime(m.created_at)}</p>
                    </div>
                    <p className="text-[12px] text-gray-500 dark:text-white/40 leading-snug">{preview}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Media card */}
        <div className="mx-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Media</span>
            <span className="text-[12px] text-gray-400 dark:text-white/30">{mediaItems.length}</span>
          </div>
          {mediaItems.length === 0 ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No photos yet</p>
          ) : (
            <div className="p-3">
              <div className="flex items-center gap-3">
                {latestMediaItem && (
                  <button
                    onClick={() => { onScrollToMessage(latestMediaItem.id); onClose(); }}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl"
                  >
                    <img src={(parseContent(latestMediaItem.content) as { type: 'image'; url: string }).url} alt="latest media" className="h-full w-full object-cover" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900 dark:text-white">Latest photo</p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/30">{latestMediaItem ? formatMsgTime(latestMediaItem.created_at) : ''}</p>
                </div>
                <button
                  onClick={() => setInfoView('media')}
                  className="shrink-0 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  View All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Files card */}
        <div className="mx-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Files</span>
            <span className="text-[12px] text-gray-400 dark:text-white/30">{fileItems.length}</span>
          </div>
          {fileItems.length === 0 ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No files yet</p>
          ) : (
            <div className="p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-10 w-10 shrink-0 text-gray-400 dark:text-white/30" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-gray-900 dark:text-white">
                    {latestFileItem ? (parseContent(latestFileItem.content) as { type: 'file'; name: string }).name : 'Latest file'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/30">
                    {latestFileItem ? formatMsgTime(latestFileItem.created_at) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setInfoView('files')}
                  className="shrink-0 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  View All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Links card */}
        <div className="mx-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Links</span>
            <span className="text-[12px] text-gray-400 dark:text-white/30">{linkItems.length}</span>
          </div>
          {linkItems.length === 0 ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No links yet</p>
          ) : (
            <div className="p-3">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-10 w-10 shrink-0 text-gray-400 dark:text-white/30" />
                <div className="min-w-0 flex-1">
                  <a
                    href={latestLinkItem?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[12px] text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {latestLinkItem?.url}
                  </a>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/30">Latest link</p>
                </div>
                <button
                  onClick={() => setInfoView('links')}
                  className="shrink-0 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  View All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leave / Delete card */}
        <div className="mx-4 mb-6 space-y-2 pt-4">

          {/* Leave Group — group/event chats, all members */}
          {(conv.type === 'group' || conv.type === 'event') && !leaveGroupConfirm && !leaveConfirm && (
            <button
              onClick={() => setLeaveGroupConfirm(true)}
              disabled={leavingGroup}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold text-amber-600 dark:text-amber-400 bg-white dark:bg-[#111013] border border-amber-200 dark:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors disabled:opacity-45"
            >
              <LogOut className="h-4 w-4" />
              Leave Group
            </button>
          )}

          {/* Leave Group confirmation */}
          {leaveGroupConfirm && (
            <div className="rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] p-4 space-y-3">
              <p className="text-center text-[13px] text-gray-500 dark:text-white/40">
                Leave this group chat? You can be added back by a member.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLeaveGroupConfirm(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={leavingGroup}
                  className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                >
                  {leavingGroup ? 'Leaving…' : 'Yes, Leave'}
                </button>
              </div>
            </div>
          )}

          {/* Delete Chat — personal chats or group creators */}
          {canDelete && !leaveConfirm && !leaveGroupConfirm && (
            <button
              onClick={() => setLeaveConfirm(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold text-red-500 bg-white dark:bg-[#111013] border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Chat
            </button>
          )}

          {/* Delete confirmation */}
          {leaveConfirm && (
            <div className="rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] p-4 space-y-3">
              <p className="text-center text-[13px] text-gray-500 dark:text-white/40">
                {conv.type === 'personal'
                  ? 'Send a delete request? The chat will be removed for both sides after the other person confirms.'
                  : 'Delete this chat for everyone? This cannot be undone.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLeaveConfirm(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteChat}
                  disabled={leaving}
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                >
                  {leaving ? 'Working…' : conv.type === 'personal' ? 'Send Request' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {(conv.type === 'group' || conv.type === 'event') && (
        <Modal
          open={showMembersModal}
          onClose={() => { setShowMembersModal(false); setAddMembersOpen(false); setSelectedMemberIds(new Set()); setMemberSearch(''); }}
          title="Members"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{conv.name || 'Group Chat'}</p>
                <p className="text-[12px] text-gray-400 dark:text-white/30">{conv.members.length} members</p>
              </div>
              <button
                onClick={() => setAddMembersOpen(prev => !prev)}
                className="shrink-0 h-9 px-3 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[12px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </span>
              </button>
            </div>

            {addMembersOpen && (
              <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] p-3">
                <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-white/[0.06] px-3">
                  <Search className="h-3.5 w-3.5 text-gray-400 dark:text-white/30 shrink-0" />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search people to add..."
                    className="flex-1 h-10 bg-transparent text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
                  />
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-white/[0.06]">
                  {loadingAvailablePeople ? (
                    <p className="py-4 text-center text-[12px] text-gray-400 dark:text-white/25">Loading people…</p>
                  ) : filteredAvailablePeople.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-gray-400 dark:text-white/25">No more people available</p>
                  ) : (
                    filteredAvailablePeople.map(person => (
                      <button
                        key={person.id}
                        onClick={() => toggleSelectedMember(person.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <Avatar src={person.avatar_url ?? undefined} firstName={person.first_name || '?'} lastName={person.last_name ?? undefined} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{getFullName(person)}</p>
                          {person.nickname && (
                            <p className="truncate text-[11px] text-gray-400 dark:text-white/30">{person.nickname}</p>
                          )}
                        </div>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selectedMemberIds.has(person.id)
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-gray-300 dark:border-white/20 text-transparent'
                        }`}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => { setAddMembersOpen(false); setSelectedMemberIds(new Set()); setMemberSearch(''); }}
                    className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMembers}
                    disabled={addingMembers || selectedMemberIds.size === 0}
                    className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                  >
                    {addingMembers ? 'Adding…' : `Add ${selectedMemberIds.size > 0 ? `(${selectedMemberIds.size})` : ''}`}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-white/[0.06]">
              <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {sortedMembers.map(member => {
                  const name = getFullName(member.profile);
                  const isYou = member.user_id === myUserId;
                  const isOwner = member.user_id === conv.created_by;
                  return (
                    <div key={member.user_id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar src={member.profile?.avatar_url ?? undefined} firstName={member.profile?.first_name || '?'} lastName={member.profile?.last_name ?? undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-gray-900 dark:text-white">{name}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400 dark:text-white/30">
                          {isYou && <span>You</span>}
                          {isOwner && <span>Creator</span>}
                          {!isYou && !isOwner && member.profile?.nickname && <span>{member.profile.nickname}</span>}
                        </div>
                      </div>
                      {!isYou && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="shrink-0 p-1.5 rounded-lg text-gray-300 dark:text-white/20 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReactionDetailsSheet({
  message,
  members,
  myUserId,
  onClose,
  onToggleReaction,
}: {
  message: Message;
  members: Conversation['members'];
  myUserId: string;
  onClose: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void | Promise<unknown>;
}) {
  const reactions = message.reactions;

  const reactionCounts = reactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const reactionsByUser = Object.values(reactions.reduce((acc, reaction) => {
    const current = acc[reaction.user_id] || { userId: reaction.user_id, emojis: [] as string[] };
    if (!current.emojis.includes(reaction.emoji)) current.emojis.push(reaction.emoji);
    acc[reaction.user_id] = current;
    return acc;
  }, {} as Record<string, { userId: string; emojis: string[] }>));

  const getMember = (userId: string) => members.find(member => member.user_id === userId);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/30 px-4 py-[max(1rem,env(safe-area-inset-top))] dark:bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-reactions-title"
        initial={{ y: 12, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.97 }}
        transition={mobilePanelTransition}
        onClick={event => event.stopPropagation()}
        className="flex max-h-[min(72dvh,34rem)] w-full max-w-sm flex-col overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1c1b1f]"
      >
          <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-3.5 dark:border-white/[0.07]">
            <div>
              <h3 id="message-reactions-title" className="text-[15px] font-extrabold text-gray-950 dark:text-white">Reactions</h3>
              <p className="mt-0.5 text-[12px] text-gray-400 dark:text-white/35">
                {reactions.length} {reactions.length === 1 ? 'reaction' : 'reactions'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-700 dark:bg-white/[0.07] dark:text-white/80">
                  <span>{emoji}</span>
                  <span>{count}</span>
                </span>
              ))}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close reactions"
                className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {reactionsByUser.map((reactionGroup) => {
              const member = getMember(reactionGroup.userId);
              const isMine = reactionGroup.userId === myUserId;
              const displayName = isMine ? 'You' : getFullName(member?.profile, 'Unknown member');
              const avatarProfile = member?.profile;

              return (
                <div
                  key={reactionGroup.userId}
                  data-app-nonselect="true"
                  className="flex w-full items-center gap-2.5 px-5 py-2 text-left"
                >
                  <Avatar
                    src={avatarProfile?.avatar_url ?? undefined}
                    firstName={avatarProfile?.first_name || (isMine ? 'Y' : '?')}
                    lastName={avatarProfile?.last_name ?? undefined}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">{displayName}</p>
                    {isMine && (
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">Tap a reaction to remove it</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {reactionGroup.emojis.map(emoji => isMine ? (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void onToggleReaction(message.id, emoji)}
                        aria-label={`Remove ${emoji} reaction`}
                        className="flex h-9 min-w-9 items-center justify-center rounded-full bg-emerald-50 px-2.5 text-[19px] ring-1 ring-emerald-200 transition-transform hover:scale-105 active:scale-90 dark:bg-emerald-500/[0.12] dark:ring-emerald-400/25"
                      >
                        {emoji}
                      </button>
                    ) : (
                      <span key={emoji} className="flex h-9 min-w-9 items-center justify-center rounded-full bg-gray-100 px-2.5 text-[19px] dark:bg-white/[0.07]" aria-label={`${emoji} reaction`}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
      </motion.div>
    </motion.div>
    ,
    document.body,
  );
}

function SeenDetailsSheet({
  message,
  seers,
  members,
  myUserId,
  onClose,
}: {
  message: Message;
  seers: Array<{ userId: string; readAt: string }>;
  members: Conversation['members'];
  myUserId: string;
  onClose: () => void;
}) {
  const getMember = (userId: string) => members.find(member => member.user_id === userId);
  const sortedSeers = [...seers].sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());

  const formatSeenDateTime = (iso: string) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${formatMsgTime(iso)}`;
  };

  return (
    <motion.div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/20 px-0 sm:items-center sm:px-4 dark:bg-black/45"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 38, opacity: 0.96, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={mobilePanelTransition}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-[28px] border border-black/[0.06] bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1c1b1f] sm:rounded-[28px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5 dark:border-white/[0.07]">
          <div>
            <h3 className="text-[15px] font-extrabold text-gray-950 dark:text-white">Seen by</h3>
            <p className="mt-0.5 text-[12px] text-gray-400 dark:text-white/35">
              {sortedSeers.length} {sortedSeers.length === 1 ? 'person' : 'people'}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:bg-white/[0.07] dark:text-white/50">
            {formatMsgTime(message.created_at)}
          </span>
        </div>

        <div className="min-h-[13.5rem] max-h-[52dvh] overflow-y-auto py-1.5">
          {sortedSeers.map(seer => {
            const member = getMember(seer.userId);
            const isMe = seer.userId === myUserId;
            const displayName = isMe ? 'You' : getFullName(member?.profile, 'Unknown member');

            return (
              <div key={seer.userId} className="flex w-full items-center gap-2.5 px-5 py-2.5">
                <Avatar
                  src={member?.profile?.avatar_url ?? undefined}
                  firstName={member?.profile?.first_name || (isMe ? 'Y' : '?')}
                  lastName={member?.profile?.last_name ?? undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">{displayName}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-white/35">
                    Seen {formatSeenDateTime(seer.readAt)}
                  </p>
                </div>
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Chat Window ─────────────────────────────────────────────────────────────

type EventDiscussionDetails = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  songs: Array<{ id: string; title: string; artist: string | null; performed_key: string | null; song_key: string | null; youtube_url: string | null }>;
};

type EventSetlistSongRow = {
  id: string;
  position: number | null;
  performed_key: string | null;
  youtube_url: string | null;
  songs: {
    id: string;
    title: string;
    artist: string | null;
    song_key: string | null;
    youtube_url: string | null;
  } | null;
};

type EventSetlistRow = {
  id: string;
  setlist_songs: EventSetlistSongRow[] | null;
};

function mapEventSongs(setlist: unknown, fallbackTitle: string): EventDiscussionDetails['songs'] {
  const setlistRow = setlist as EventSetlistRow | null;
  return [...(setlistRow?.setlist_songs ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(item => ({
      id: item.songs?.id ?? item.id,
      title: item.songs?.title ?? fallbackTitle,
      artist: item.songs?.artist ?? null,
      performed_key: item.performed_key ?? null,
      song_key: item.songs?.song_key ?? null,
      youtube_url: item.youtube_url || item.songs?.youtube_url || null,
    }));
}

function EventDiscussionCard({ eventId, onOpen, onDetailsLoaded }: {
  eventId: string;
  onOpen: () => void;
  onDetailsLoaded: (details: EventDiscussionDetails) => void;
}) {
  const [details, setDetails] = useState<EventDiscussionDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: event } = await supabase
        .from('events')
        .select('id, title, event_date, start_time, end_time, event_type')
        .eq('id', eventId)
        .maybeSingle();
      const { data: setlist } = await supabase
        .from('setlists')
        .select('id, setlist_songs(id, position, performed_key, youtube_url, songs(id, title, artist, song_key, youtube_url))')
        .eq('event_id', eventId)
        .maybeSingle();
      if (cancelled || !event) return;
      const songs = mapEventSongs(setlist, 'Untitled song');
      const nextDetails = { ...(event as EventDiscussionDetails), songs };
      setDetails(nextDetails);
      onDetailsLoaded(nextDetails);
    };
    load();
    return () => { cancelled = true; };
  }, [eventId, onDetailsLoaded]);

  if (!details) return null;

  return (
    <div className="hidden shrink-0 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/10 dark:bg-emerald-500/[0.06] lg:block">
      <button
        onClick={onOpen}
        className="w-full text-left rounded-2xl bg-white dark:bg-[#161619] border border-emerald-100 dark:border-emerald-500/15 px-3.5 py-3 shadow-sm shadow-emerald-900/5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white truncate">{details.title}</span>
            <span className="block text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
              {new Date(details.event_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {details.event_type ? ` · ${details.event_type}` : ''}
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Music2 className="h-3.5 w-3.5" />
              {details.songs.length > 0 ? `${details.songs.length} songs` : 'No songs added yet'}
            </span>
            {details.songs.length > 0 && (
              <span className="mt-1.5 block text-[11px] text-gray-500 dark:text-white/45 truncate">
                {details.songs.slice(0, 4).map(song => song.title).join(' · ')}
                {details.songs.length > 4 ? ` · +${details.songs.length - 4} more` : ''}
              </span>
            )}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 mt-2 shrink-0" />
        </div>
      </button>
    </div>
  );
}

type EventPanelData = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  description: string | null;
  songs: Array<{ id: string; title: string; artist: string | null; performed_key: string | null; song_key: string | null; youtube_url: string | null }>;
};

function EventDetailPanel({ eventId, onClose, onViewFullEvent, mode = 'event', focusedSongId }: {
  eventId: string;
  onClose: () => void;
  onViewFullEvent: () => void;
  mode?: 'event' | 'setlist';
  focusedSongId?: string | null;
}) {
  const [data, setData] = useState<EventPanelData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: event }, { data: setlist }] = await Promise.all([
        supabase.from('events').select('id, title, event_date, start_time, end_time, event_type, description').eq('id', eventId).maybeSingle(),
        supabase.from('setlists').select('id, setlist_songs(id, position, performed_key, youtube_url, songs(id, title, artist, song_key, youtube_url))').eq('event_id', eventId).maybeSingle(),
      ]);
      if (cancelled || !event) return;
      const songs = mapEventSongs(setlist, 'Untitled');
      setData({ ...(event as Omit<EventPanelData, 'songs'>), songs });
    };
    load();
    return () => { cancelled = true; };
  }, [eventId]);

  const isPast = data ? new Date(data.event_date) < new Date(new Date().toDateString()) : false;
  const chipBg = isPast
    ? 'bg-gray-100 dark:bg-white/[0.05]'
    : 'bg-emerald-500';
  const chipTextPrimary = isPast ? 'text-gray-500 dark:text-white/35' : 'text-white';
  const chipTextSub = isPast ? 'text-gray-400 dark:text-white/20' : 'text-white/70';

  useEffect(() => {
    if (!data || !focusedSongId) return;
    requestAnimationFrame(() => document.getElementById(`chat-setlist-song-${focusedSongId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [data, focusedSongId]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-[#0d0d0f]">
      {/* Header — padded below the status bar on iOS/Android */}
      <div
        className="relative z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:pt-[calc(env(safe-area-inset-top)+12px)] bg-white dark:bg-[#111013] border-b border-gray-200/60 dark:border-white/[0.06] shrink-0 lg:bg-white/96 lg:backdrop-blur-xl dark:lg:bg-[#111013]/96 lg:pt-4"
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[14px] font-semibold active:opacity-70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-[14px] font-bold text-gray-900 dark:text-white">{mode === 'setlist' ? 'Event Setlist' : 'Event Info'}</span>
        {mode === 'event' ? <button
          onClick={onViewFullEvent}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[13px] font-semibold active:opacity-70"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full Event
        </button> : <span className="w-[70px]" aria-hidden="true" />}
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 touch-pan-y overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-6 space-y-4">

            {/* Hero card */}
            {mode === 'event' && (
            <div className="rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
            >
              <div className="px-5 pt-6 pb-5">
                <div className="flex items-start gap-4">
                  {/* Date chip */}
                  <div className={`flex flex-col items-center justify-center h-[68px] w-14 rounded-2xl shrink-0 ${chipBg}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${chipTextSub}`}>
                      {format(parseISO(data.event_date), 'MMM')}
                    </span>
                    <span className={`text-[28px] font-black leading-none mt-1 ${chipTextPrimary}`} style={{ letterSpacing: '-0.05em' }}>
                      {format(parseISO(data.event_date), 'd')}
                    </span>
                    <span className={`text-[9px] font-bold leading-none mt-0.5 ${chipTextSub}`}>
                      {format(parseISO(data.event_date), 'EEE')}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] mb-1 text-gray-400 dark:text-white/30">
                      {isPast ? 'Past event' : 'Upcoming'}
                    </p>
                    <h2 className="text-[1.4rem] font-black text-gray-900 dark:text-white leading-[1.1]" style={{ letterSpacing: '-0.03em' }}>
                      {data.title}
                    </h2>
                    {data.event_type && (
                      <div className="mt-2">
                        <span className="badge-blue text-[10px]">{data.event_type}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-5 pt-5 border-t border-black/[0.05] dark:border-white/[0.05] grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: Calendar,
                      label: 'Date',
                      value: format(parseISO(data.event_date), 'EEEE'),
                      detail: format(parseISO(data.event_date), 'MMM d, yyyy'),
                    },
                    {
                      icon: Clock,
                      label: 'Time',
                      value: formatTime12Hour(data.start_time || '') || 'TBA',
                      detail: data.end_time ? `Ends ${formatTime12Hour(data.end_time)}` : '',
                    },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white/65 dark:bg-white/[0.035] border border-black/[0.06] dark:border-white/[0.07] px-3.5 py-3.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/30">{item.label}</span>
                          <span className="block text-[14px] font-black text-gray-900 dark:text-white truncate leading-tight mt-0.5">{item.value}</span>
                          {item.detail && <span className="block text-[11px] text-gray-500 dark:text-white/45 truncate mt-0.5">{item.detail}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {data.description && (
                  <p className="mt-4 text-[13px] text-gray-500 dark:text-white/40 leading-relaxed">{data.description}</p>
                )}
              </div>
            </div>
            )}

            {/* Setlist */}
            <div className="rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-[14px] font-bold text-gray-900 dark:text-white">Setlist</span>
                </div>
                <span className="text-[12px] text-gray-400 dark:text-white/30">{data.songs.length} songs</span>
              </div>

              {data.songs.length === 0 ? (
                <div className="py-8 text-center">
                  <Music2 className="h-8 w-8 text-gray-200 dark:text-white/10 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-400 dark:text-white/25">No setlist yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                  {data.songs.map((song, i) => {
                    const key = song.performed_key || song.song_key;
                    return (
                      <div
                        id={`chat-setlist-song-${song.id}`}
                        key={song.id}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors ${focusedSongId === song.id ? 'bg-violet-50 ring-1 ring-inset ring-violet-300 dark:bg-violet-500/10 dark:ring-violet-400/25' : ''}`}
                      >
                        <span className="text-[12px] font-bold text-gray-300 dark:text-white/20 w-5 text-right shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">{song.title}</p>
                          {song.artist && <p className="text-[12px] text-gray-400 dark:text-white/30 truncate">{song.artist}</p>}
                        </div>
                        {key && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-[11px] font-bold text-gray-500 dark:text-white/40">{key}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function DeleteRequestCard({
  content, requesterName, isMine, onConfirm, confirming,
}: {
  content: Extract<MsgContent, { type: 'delete_request' }>;
  requesterName: string;
  isMine: boolean;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div className="my-3 flex justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.08] px-4 py-3 text-center">
        <p className="text-[13px] font-bold text-red-700 dark:text-red-300">Delete chat request</p>
        <p className="mt-1 text-[12px] leading-relaxed text-red-700/75 dark:text-red-200/70">
          {isMine
            ? 'You asked to delete this chat. It will be removed for both sides after the other person confirms.'
            : `${requesterName || content.requesterName} wants to delete this chat for both sides.`}
        </p>
        {!isMine && (
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="mt-3 h-9 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold disabled:opacity-45 transition-colors"
          >
            {confirming ? 'Deleting…' : 'Confirm Delete'}
          </button>
        )}
      </div>
    </div>
  );
}

function ChatWindow({
  conv, myUserId, onBack, onConvUpdate, onRequestDelete, onConfirmDelete, onDeleteAsCreator, onRenameGroup, onAddMembers, onUpdateGroupPhoto,
}: {
  conv: Conversation;
  myUserId: string;
  onBack: () => void;
  onConvUpdate: () => void;
  onRequestDelete: (conversationId: string) => Promise<boolean>;
  onConfirmDelete: (conversationId: string) => Promise<boolean>;
  onDeleteAsCreator: (conversationId: string) => Promise<boolean>;
  onRenameGroup: (conversationId: string, name: string) => Promise<boolean>;
  onAddMembers: (conversationId: string, memberIds: string[]) => Promise<boolean>;
  onUpdateGroupPhoto: (conversationId: string, photoUrl: string | null) => Promise<boolean>;
}) {
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [messageActionAnchorRect, setMessageActionAnchorRect] = useState<MessageActionAnchorRect | null>(null);
  const [emojiMsgId, setEmojiMsgId] = useState<string | null>(null);
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<MessageActionAnchorRect | null>(null);
  const [emojiBoundaryTop, setEmojiBoundaryTop] = useState(0);
  const [tappedMsgId, setTappedMsgId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventPanelMode, setEventPanelMode] = useState<'event' | 'setlist'>('event');
  const [focusedSetlistSongId, setFocusedSetlistSongId] = useState<string | null>(null);
  const [eventCommandDetails, setEventCommandDetails] = useState<EventDiscussionDetails | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [reactionDetailsMessageId, setReactionDetailsMessageId] = useState<string | null>(null);
  const [seenDetailsMessageId, setSeenDetailsMessageId] = useState<string | null>(null);
  const [pendingReactionReveal, setPendingReactionReveal] = useState<{ messageId: string; emoji: string } | null>(null);
  const [reactionLanding, setReactionLanding] = useState<{ messageId: string; emoji: string; token: number } | null>(null);
  const [reactionFlight, setReactionFlight] = useState<MessageReactionFlight | null>(null);
  const reactionMutationsRef = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatHeaderRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const msgLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgLongPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const draggedMessageId = useRef<string | null>(null);
  const atBottomRef = useRef(true);
  const forceStickToLatestRef = useRef(false);
  const suppressLatestScrollRef = useRef(false);
  const releaseLatestScrollTimerRef = useRef<number | null>(null);
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { profile } = useAuth();
  const {
    messages, loading, loadError, typingUsers, memberReadTimes,
    sendMessage, sendTyping, pinMessage, deleteMessage, toggleReaction,
    retry,
  } = useMessages(conv.id);
  const typingLabel = formatTypingUsers(typingUsers);

  const headerName = getConversationListName(conv, myUserId);
  const headerEventMeta = conv.type === 'event' && conv.event_date
    ? `${format(parseISO(conv.event_date), 'MMM d')}${conv.event_type ? ` · ${conv.event_type}` : ''}`
    : null;
  const mentionProfiles = useMemo(
    () => [
      {
        id: '__everyone',
        first_name: 'everyone',
        last_name: '',
        avatar_url: null,
        gender: null,
        mentionHandle: 'everyone',
        mentionLabel: 'Everyone in this chat',
        mentionDescription: `Mention all ${Math.max(conv.members.length - 1, 0)} other ${conv.members.length - 1 === 1 ? 'member' : 'members'} in this chat`,
        mentionType: 'everyone' as const,
      },
      ...(conv.type === 'event' && conv.event_id && eventCommandDetails ? [{
        id: '__event',
        first_name: 'event',
        last_name: '',
        avatar_url: null,
        gender: null,
        mentionHandle: 'event',
        mentionLabel: 'Current event',
        mentionDescription: eventCommandDetails.title,
        mentionType: 'event' as const,
      }] : []),
      ...conv.members
      .filter(member => member.user_id !== myUserId && member.profile?.first_name && member.profile?.last_name)
      .map(member => ({
        id: member.user_id,
        first_name: member.profile?.first_name || '',
        last_name: member.profile?.last_name || '',
        avatar_url: member.profile?.avatar_url || null,
        gender: null,
      })),
    ],
    [conv.event_id, conv.members, conv.type, eventCommandDetails, myUserId]
  );

  const avatarName = getConversationAvatarName(conv, myUserId);

  const clearMessageLongPress = useCallback(() => {
    if (msgLongPressTimer.current) {
      clearTimeout(msgLongPressTimer.current);
      msgLongPressTimer.current = null;
    }
    msgLongPressOrigin.current = null;
  }, []);

  useEffect(() => clearMessageLongPress, [clearMessageLongPress]);

  const openMessageActions = useCallback((messageId: string, anchor?: HTMLElement | null, withFeedback = false) => {
    const messageBubble = messageBubbleRefs.current[messageId] || anchor;
    const bubbleRect = messageBubble?.getBoundingClientRect();
    if (!bubbleRect) return;
    const reactionBar = messageBubble?.querySelector<HTMLElement>('[data-message-reaction-bar="true"]');
    const reactionBarRect = reactionBar?.getBoundingClientRect();
    const anchorRect = reactionBarRect
      ? {
          left: Math.min(bubbleRect.left, reactionBarRect.left),
          top: Math.min(bubbleRect.top, reactionBarRect.top),
          right: Math.max(bubbleRect.right, reactionBarRect.right),
          bottom: Math.max(bubbleRect.bottom, reactionBarRect.bottom),
          width: Math.max(bubbleRect.right, reactionBarRect.right) - Math.min(bubbleRect.left, reactionBarRect.left),
          height: Math.max(bubbleRect.bottom, reactionBarRect.bottom) - Math.min(bubbleRect.top, reactionBarRect.top),
        }
      : bubbleRect;
    const preservedScrollTop = scrollRef.current?.scrollTop;
    if (releaseLatestScrollTimerRef.current) {
      window.clearTimeout(releaseLatestScrollTimerRef.current);
      releaseLatestScrollTimerRef.current = null;
    }
    suppressLatestScrollRef.current = true;
    forceStickToLatestRef.current = false;
    window.getSelection()?.removeAllRanges();
    setMessageActionAnchorRect({
      left: anchorRect.left,
      top: anchorRect.top,
      right: anchorRect.right,
      bottom: anchorRect.bottom,
      width: anchorRect.width,
      height: anchorRect.height,
      menuOverlap: reactionBarRect ? Math.max(0, reactionBarRect.bottom - bubbleRect.bottom) : 0,
      horizontalNudge: reactionBarRect ? 24 : 0,
    });
    setActiveMsg(messageId);
    setEmojiMsgId(null);
    setEmojiAnchorRect(null);
    setTappedMsgId(null);
    if (withFeedback) playInteractionSound('longPress');
    if (preservedScrollTop !== undefined) {
      window.requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = preservedScrollTop;
        window.requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = preservedScrollTop;
        });
      });
    }
  }, []);

  const closeMessageActions = useCallback(() => {
    setActiveMsg(null);
    setMessageActionAnchorRect(null);
    if (releaseLatestScrollTimerRef.current) window.clearTimeout(releaseLatestScrollTimerRef.current);
    releaseLatestScrollTimerRef.current = window.setTimeout(() => {
      suppressLatestScrollRef.current = false;
      releaseLatestScrollTimerRef.current = null;
    }, 300);
  }, []);

  useEffect(() => () => {
    if (releaseLatestScrollTimerRef.current) window.clearTimeout(releaseLatestScrollTimerRef.current);
  }, []);

  const closeEmojiPicker = useCallback(() => {
    setEmojiMsgId(null);
    setEmojiAnchorRect(null);
  }, []);

  const openEmojiPicker = useCallback((messageId: string) => {
    const messageBubble = messageBubbleRefs.current[messageId];
    const bubbleRect = messageBubble?.getBoundingClientRect();
    if (!bubbleRect) return;
    const reactionBarRect = messageBubble
      ?.querySelector<HTMLElement>('[data-message-reaction-bar]')
      ?.getBoundingClientRect();
    const anchorRect = reactionBarRect
      ? {
          left: Math.min(bubbleRect.left, reactionBarRect.left),
          top: Math.min(bubbleRect.top, reactionBarRect.top),
          right: Math.max(bubbleRect.right, reactionBarRect.right),
          bottom: Math.max(bubbleRect.bottom, reactionBarRect.bottom),
          width: Math.max(bubbleRect.right, reactionBarRect.right) - Math.min(bubbleRect.left, reactionBarRect.left),
          height: Math.max(bubbleRect.bottom, reactionBarRect.bottom) - Math.min(bubbleRect.top, reactionBarRect.top),
        }
      : bubbleRect;
    setEmojiAnchorRect({
      left: anchorRect.left,
      top: anchorRect.top,
      right: anchorRect.right,
      bottom: anchorRect.bottom,
      width: anchorRect.width,
      height: anchorRect.height,
    });
    setEmojiBoundaryTop(chatHeaderRef.current?.getBoundingClientRect().bottom ?? 0);
    setEmojiMsgId(messageId);
    setTappedMsgId(null);
    playInteractionSound('reactionOpen');
  }, []);

  const handleMessageReaction = useCallback(async (messageId: string, emoji: string, sourceElement?: HTMLElement) => {
    if (reactionMutationsRef.current.has(messageId)) return;
    const message = messages.find(item => item.id === messageId);
    if (!message) return;

    reactionMutationsRef.current.add(messageId);
    const existing = message.reactions.some(reaction => reaction.user_id === myUserId && reaction.emoji === emoji);
    const sourceRect = sourceElement?.getBoundingClientRect();
    const flightOrigin = sourceRect
      ? { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 }
      : null;
    const shouldAnimateFlight = !existing && !prefersReducedMotion && Boolean(flightOrigin);

    if (shouldAnimateFlight) {
      setPendingReactionReveal({ messageId, emoji });
    }
    closeEmojiPicker();

    if (shouldAnimateFlight && flightOrigin) {
      const startReactionFlight = (attempt = 0) => {
        const bubble = messageBubbleRefs.current[messageId];
        const target = bubble
          ? Array.from(bubble.querySelectorAll<HTMLElement>('[data-reaction-emoji]'))
              .find(element => element.dataset.reactionEmoji === emoji)
          : null;
        if (!target) {
          if (attempt < 3) {
            window.requestAnimationFrame(() => startReactionFlight(attempt + 1));
            return;
          }
          setPendingReactionReveal(current => current?.messageId === messageId ? null : current);
          return;
        }
        const targetRect = target.getBoundingClientRect();
        setReactionFlight({
          messageId,
          emoji,
          token: Date.now(),
          from: flightOrigin,
          to: {
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2,
          },
        });
      };
      window.requestAnimationFrame(() => startReactionFlight());
    }

    try {
      const updated = await toggleReaction(messageId, emoji);
      if (!updated) {
        setReactionFlight(current => current?.messageId === messageId ? null : current);
        setPendingReactionReveal(current => current?.messageId === messageId ? null : current);
        setReactionLanding(current => current?.messageId === messageId ? null : current);
      } else if (existing) {
        playInteractionSound('reactionRemove');
      } else if (!shouldAnimateFlight) {
        playInteractionSound('reactionLand');
      }
    } finally {
      reactionMutationsRef.current.delete(messageId);
    }
  }, [closeEmojiPicker, messages, myUserId, prefersReducedMotion, toggleReaction]);

  const handleReactionFlightComplete = useCallback((completedFlight: MessageReactionFlight) => {
    const landing = {
      messageId: completedFlight.messageId,
      emoji: completedFlight.emoji,
      token: completedFlight.token,
    };
    setPendingReactionReveal(current => current?.messageId === completedFlight.messageId ? null : current);
    setReactionLanding(landing);
    setReactionFlight(current => current?.token === completedFlight.token ? null : current);
    playInteractionSound('reactionLand');
    window.setTimeout(() => {
      setReactionLanding(current => current?.token === landing.token ? null : current);
    }, 420);
  }, []);

  const startReplyToMessage = useCallback((msg: Message) => {
    setReplyTo({ id: msg.id, preview: `${getSenderName(msg.sender)}: ${replyPreviewContent(msg.content)}` });
    closeMessageActions();
    closeEmojiPicker();
    setTappedMsgId(null);
  }, [closeEmojiPicker, closeMessageActions]);

  const handleReplyDragStart = useCallback((messageId: string) => {
    draggedMessageId.current = messageId;
    clearMessageLongPress();
    closeMessageActions();
    closeEmojiPicker();
  }, [clearMessageLongPress, closeEmojiPicker, closeMessageActions]);

  const handleReplyDragEnd = useCallback((msg: Message, isMe: boolean, info: PanInfo) => {
    const shouldReply = isMe
      ? info.offset.x <= -REPLY_DRAG_THRESHOLD
      : info.offset.x >= REPLY_DRAG_THRESHOLD;

    if (shouldReply) {
      startReplyToMessage(msg);
    }

    window.setTimeout(() => {
      if (draggedMessageId.current === msg.id) {
        draggedMessageId.current = null;
      }
    }, 0);
  }, [startReplyToMessage]);

  useEffect(() => {
    let stopped = false;

    const setActive = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      await supabase.rpc('set_active_conversation', { p_conversation_id: conv.id });
    };

    const clearActive = () => {
      supabase.rpc('clear_active_conversation', { p_conversation_id: conv.id });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setActive();
      else clearActive();
    };

    setActive();
    const interval = window.setInterval(setActive, 25000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', clearActive);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', clearActive);
      clearActive();
    };
  }, [conv.id]);

  // Track scroll position to decide whether to auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
    if (!atBottomRef.current) forceStickToLatestRef.current = false;
  }, []);

  useEffect(() => {
    if (atBottomRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const keepLatestVisible = (force = false) => {
      const composerFocused =
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement instanceof HTMLElement && document.activeElement.dataset.chatComposer === 'true');
      if (!force && !composerFocused && !atBottomRef.current && !forceStickToLatestRef.current) return;
      const scrollToLatest = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      };
      scrollToLatest();
      requestAnimationFrame(() => requestAnimationFrame(scrollToLatest));
    };
    const handleComposerFocus = () => {
      if (suppressLatestScrollRef.current) return;
      forceStickToLatestRef.current = true;
      keepLatestVisible(true);
    };
    const handleKeyboardInsetChange = () => {
      if (suppressLatestScrollRef.current) return;
      const composerFocused =
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement instanceof HTMLElement && document.activeElement.dataset.chatComposer === 'true');
      const keyboardOpen = document.documentElement.classList.contains('messages-keyboard-open');
      if (!composerFocused || !keyboardOpen) return;
      keepLatestVisible(true);
    };

    window.addEventListener('messages-composer-focus', handleComposerFocus);
    window.addEventListener('messages-keyboard-inset-change', handleKeyboardInsetChange);
    return () => {
      window.removeEventListener('messages-composer-focus', handleComposerFocus);
      window.removeEventListener('messages-keyboard-inset-change', handleKeyboardInsetChange);
    };
  }, []);

  // Close action menu on outside click
  useEffect(() => {
    if (!activeMsg && !emojiMsgId && !tappedMsgId) return;
    const handler = () => { closeMessageActions(); closeEmojiPicker(); setTappedMsgId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeMsg, closeEmojiPicker, closeMessageActions, emojiMsgId, tappedMsgId]);

  const stopTyping = useCallback(() => {
    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
      typingStopRef.current = null;
    }
    if (typingThrottleRef.current) {
      clearTimeout(typingThrottleRef.current);
      typingThrottleRef.current = null;
    }
    if (!isTypingRef.current) return;
    const name = getFullName(profile, 'Someone');
    sendTyping(name, false);
    isTypingRef.current = false;
  }, [sendTyping, profile]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!isTyping) {
      stopTyping();
      return;
    }

    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(stopTyping, 2500);

    if (typingThrottleRef.current) return;
    const name = getFullName(profile, 'Someone');
    sendTyping(name, true);
    isTypingRef.current = true;
    typingThrottleRef.current = setTimeout(() => { typingThrottleRef.current = null; }, 1400);
  }, [sendTyping, profile, stopTyping]);

  useEffect(() => {
    return () => stopTyping();
  }, [stopTyping]);

  useEffect(() => {
    if (!reactionDetailsMessageId) return;
    const message = messages.find(item => item.id === reactionDetailsMessageId);
    if (!message || message.reactions.length === 0) {
      setReactionDetailsMessageId(null);
    }
  }, [messages, reactionDetailsMessageId]);

  const handleSend = useCallback(async (text: string) => {
    stopTyping();
    await sendMessage(text, replyTo?.id);
    setReplyTo(null);
  }, [sendMessage, replyTo, stopTyping]);

  const handleConfirmDelete = useCallback(async () => {
    setConfirmingDelete(true);
    const ok = await onConfirmDelete(conv.id);
    setConfirmingDelete(false);
    if (ok) onBack();
  }, [conv.id, onBack, onConfirmDelete]);

  const scrollToMessage = useCallback((id: string) => {
    if (releaseLatestScrollTimerRef.current) {
      window.clearTimeout(releaseLatestScrollTimerRef.current);
      releaseLatestScrollTimerRef.current = null;
    }
    suppressLatestScrollRef.current = true;
    forceStickToLatestRef.current = false;
    setShowInfo(false);
    setTimeout(() => {
      const el = messageRefs.current[id];
      const scroller = scrollRef.current;
      if (el && scroller) {
        scroller.scrollTo({
          top: Math.max(0, el.offsetTop - scroller.clientHeight / 2 + el.clientHeight / 2),
          behavior: 'smooth',
        });
        const bubble = messageBubbleRefs.current[id];
        bubble?.animate([
          { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
          { boxShadow: '0 0 0 3px rgba(16,185,129,0.7)' },
          { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
        ], { duration: 1500, easing: 'ease-out' });
      }
      releaseLatestScrollTimerRef.current = window.setTimeout(() => {
        suppressLatestScrollRef.current = false;
        releaseLatestScrollTimerRef.current = null;
      }, 900);
    }, 250);
  }, []);

  // Compute seen-by map: for each member (including self), what's the last message id they've seen
  const seenMap = useMemo(() => {
    const result: Record<string, string> = {};
    for (const member of memberReadTimes) {
      if (!member.last_read_at) continue;
      const readTime = new Date(member.last_read_at).getTime();
      for (let i = messages.length - 1; i >= 0; i--) {
        if (new Date(messages[i].created_at).getTime() <= readTime) {
          result[member.user_id] = messages[i].id;
          break;
        }
      }
    }
    return result;
  }, [memberReadTimes, messages]);

  // Which message has seen avatars to display below it
  const seenByMessage = useMemo(() => {
    const msgToSeers: Record<string, { userId: string; readAt: string }[]> = {};
    const readTimesByMember = new Map(memberReadTimes.map(member => [member.user_id, member.last_read_at]));
    for (const [memberId, msgId] of Object.entries(seenMap)) {
      const readAt = readTimesByMember.get(memberId);
      if (!readAt) continue;
      if (!msgToSeers[msgId]) msgToSeers[msgId] = [];
      msgToSeers[msgId].push({ userId: memberId, readAt });
    }
    for (const message of messages) {
      for (const reaction of message.reactions) {
        if (reaction.user_id === message.sender_id) continue;
        if (seenMap[reaction.user_id]) continue;
        if (!msgToSeers[message.id]) msgToSeers[message.id] = [];
        if (msgToSeers[message.id].some(seer => seer.userId === reaction.user_id)) continue;
        msgToSeers[message.id].push({
          userId: reaction.user_id,
          readAt: message.created_at,
        });
      }
    }
    return msgToSeers;
  }, [memberReadTimes, messages, seenMap]);

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const [showPinned, setShowPinned] = useState(false);
  const latestPinnedMessage = pinnedMessages[pinnedMessages.length - 1] ?? null;
  const reactionDetailsMessage = reactionDetailsMessageId
    ? messages.find(message => message.id === reactionDetailsMessageId) ?? null
    : null;
  const seenDetailsMessage = seenDetailsMessageId
    ? messages.find(message => message.id === seenDetailsMessageId) ?? null
    : null;
  const seenDetailsSeers = seenDetailsMessage
    ? (seenByMessage[seenDetailsMessage.id] || []).filter(seer => seer.userId !== seenDetailsMessage.sender_id)
    : [];
  const detailsSheetOpen = Boolean(reactionDetailsMessage || (seenDetailsMessage && seenDetailsSeers.length > 0));

  useEffect(() => {
    if (detailsSheetOpen) stopTyping();
  }, [detailsSheetOpen, stopTyping]);

  useEffect(() => {
    if (!seenDetailsMessageId) return;
    if (!seenDetailsMessage || seenDetailsSeers.length === 0) {
      setSeenDetailsMessageId(null);
    }
  }, [seenDetailsMessage, seenDetailsMessageId, seenDetailsSeers.length]);

  // Keep consecutive messages from one sender visually stacked. A date divider
  // always starts a fresh group, but elapsed time alone should not create a
  // large visual break between adjacent bubbles.
  const grouped = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const showDateDivider = !prev ||
        new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
      const isGrouped = Boolean(prev && !showDateDivider && prev.sender_id === msg.sender_id);
      return { msg, isGrouped, showDateDivider };
    });
  }, [messages]);

  const isGroupChat = conv.type === 'group' || conv.type === 'event';
  const activeMessage = activeMsg ? messages.find(message => message.id === activeMsg) ?? null : null;
  const activeMessageContent = activeMessage ? parseContent(activeMessage.content) : null;

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-[#111013]">
      <div ref={chatHeaderRef} className="relative z-20 shrink-0 bg-white dark:bg-[#111013] lg:bg-white/96 lg:backdrop-blur-xl dark:lg:bg-[#111013]/96">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:pt-[calc(env(safe-area-inset-top)+12px)] border-b border-gray-100 dark:border-white/[0.06] lg:pt-4">
          <button
            onClick={onBack}
            className="lg:hidden shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
          >
            <ArrowLeft className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
          </button>
          {conv.type === 'event' && conv.event_id ? (
            <EventConversationAvatar eventId={conv.event_id} name={headerName} className="h-8 w-8 rounded-full" />
          ) : (
            <Avatar
              src={getConversationAvatarSrc(conv, myUserId)}
              firstName={avatarName.firstName}
              lastName={avatarName.lastName}
              size="sm"
            />
          )}
          <button
            onClick={() => setShowInfo(true)}
            className="flex-1 min-w-0 text-left group"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[14px] font-bold leading-tight text-gray-900 transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">{headerName}</p>
              {headerEventMeta && (
                <span className="min-w-0 truncate text-[14px] font-medium leading-tight text-inherit">
                  <span aria-hidden="true">|</span> {headerEventMeta}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20 group-hover:text-emerald-500 transition-colors shrink-0" />
            </div>
            {typingUsers.length > 0 ? (
              <p className="text-[11px] text-emerald-500 dark:text-emerald-400 leading-tight">
                {typingLabel}...
              </p>
            ) : conv.type !== 'event' ? (
              <p className="text-[11px] text-gray-400 dark:text-white/30 leading-tight">
                {conv.members.length} {conv.members.length === 1 ? 'member' : 'members'}
              </p>
            ) : null}
          </button>
          {conv.type === 'event' && conv.event_id && (
            <button
              type="button"
              onClick={() => {
                setEventPanelMode('event');
                setFocusedSetlistSongId(null);
                setShowEventDetail(true);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/15 active:scale-95 dark:bg-emerald-500/[0.12] dark:text-emerald-300 lg:hidden"
              aria-label="Open event information"
              title="Event information"
            >
              <CalendarDays className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
            </button>
          )}
        </div>

        {latestPinnedMessage && (
          <button
            onClick={() => setShowPinned(v => !v)}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-100 dark:border-amber-500/[0.1] bg-amber-50/80 dark:bg-amber-500/[0.08] text-left hover:bg-amber-100/80 dark:hover:bg-amber-500/[0.12] transition-colors"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/[0.18] dark:text-amber-300">
              <Pin className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Pinned Message</span>
              <span className="mt-0.5 block truncate text-[12px] text-amber-900/80 dark:text-amber-100/80">
                {(() => {
                  return `${getSenderName(latestPinnedMessage.sender)}: ${previewContent(latestPinnedMessage.content)}`;
                })()}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/[0.18] dark:text-amber-300">
              {pinnedMessages.length}
            </span>
          </button>
        )}

        {conv.type === 'event' && conv.event_id && (
          <EventDiscussionCard
            eventId={conv.event_id}
            onOpen={() => {
              setEventPanelMode('event');
              setFocusedSetlistSongId(null);
              setShowEventDetail(true);
            }}
            onDetailsLoaded={setEventCommandDetails}
          />
        )}

        {/* Pinned messages panel */}
        <AnimatePresence>
          {showPinned && pinnedMessages.length > 0 && (
            <motion.div
              initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden border-b border-amber-100 dark:border-amber-500/[0.1] bg-amber-50 dark:bg-amber-500/[0.05]"
            >
              <div className="px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400 mb-1">Pinned Messages</p>
                {pinnedMessages.map(m => {
                  return (
                    <p key={m.id} className="text-[12px] text-amber-800 dark:text-amber-300/80 leading-snug">
                      <span className="font-semibold">{getSenderName(m.sender)}: </span>
                      {previewContent(m.content)}
                    </p>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="messages-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-4 space-y-0.5 sm:px-4"
      >
        {loading && (
          <div className="flex justify-center pt-8">
            <span className="h-5 w-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && loadError && (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400">
              <MessageCircle className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">Couldn&apos;t load this conversation</p>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-gray-500 dark:text-white/40">{loadError}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.1]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {!loadError && grouped.map(({ msg, isGrouped, showDateDivider }, i) => {
          const isMe = msg.sender_id === myUserId;
          const content = parseContent(msg.content);
          const seers = seenByMessage[msg.id] || [];
          // Exclude the message sender from the seers list (they trivially "see" their own message)
          const displaySeers = seers.filter(s => s.userId !== msg.sender_id);
          const latestSeenAt = displaySeers.length > 0 ? displaySeers.map(s => s.readAt).sort()[displaySeers.length - 1] : '';
          const showAvatar = !isMe && (!isGrouped || i === 0);
          const needsReactionClearance = !showDateDivider && (messages[i - 1]?.reactions.length ?? 0) > 0;
          const isActionsOpen = activeMsg === msg.id;
          const isEmojiOpen = emojiMsgId === msg.id;
          const isAwaitingReactionLanding = pendingReactionReveal?.messageId === msg.id;
          const visibleReactions = isAwaitingReactionLanding
            ? msg.reactions.filter(reaction => !(
                reaction.user_id === myUserId && reaction.emoji === pendingReactionReveal.emoji
              ))
            : msg.reactions;
          const visibleReactionCounts = visibleReactions.reduce((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const needsLandingPlaceholder = Boolean(
            isAwaitingReactionLanding
            && !Object.prototype.hasOwnProperty.call(visibleReactionCounts, pendingReactionReveal?.emoji || '')
          );
          const hasVisibleReactionBadge = visibleReactions.length > 0 || needsLandingPlaceholder;
          const isSingleReactionBadge = visibleReactions.length + Number(needsLandingPlaceholder) === 1
            && Object.keys(visibleReactionCounts).length + Number(needsLandingPlaceholder) === 1;
          const hasReplyPreview = Boolean(msg.reply_preview);
          const isBareMessage = content.type === 'image' || (content.type === 'event_reference' && !content.messageText);
          const bubbleSurfaceClass = isBareMessage
            ? 'px-0 py-0 bg-transparent border-0 shadow-none rounded-none'
            : isMe
              ? 'px-3.5 py-2 rounded-2xl bg-emerald-500 text-white rounded-br-md'
              : 'px-3.5 py-2 rounded-2xl bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white rounded-bl-md border border-gray-200/80 dark:border-white/[0.06]';
          const deleteRequesterName = content.type === 'delete_request'
            ? getFullName(
                conv.members.find(member => member.user_id === content.requestedBy)?.profile,
                content.requesterName || 'Someone',
              )
            : 'Someone';

          return (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el; }} className="flow-root rounded-xl">
              {showDateDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
                  <span className="text-[11px] text-gray-400 dark:text-white/30 font-medium">{formatDateDivider(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
                </div>
              )}

              {content.type === 'delete_request' ? (
                <DeleteRequestCard
                  content={content}
                  requesterName={deleteRequesterName}
                  isMine={isMe}
                  confirming={confirmingDelete}
                  onConfirm={handleConfirmDelete}
                />
              ) : (
              <>
              <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${needsReactionClearance ? 'mt-2' : isGrouped && !showDateDivider ? '-mt-4' : 'mt-3'}`}>
                {/* Avatar spacer */}
                {!isMe && (
                  <div className="shrink-0 w-7">
                    {showAvatar && (
                    <Avatar
                      src={msg.sender.avatar_url ?? undefined}
                      firstName={msg.sender.first_name || '?'}
                      lastName={msg.sender.last_name ?? undefined}
                      size="xs"
                    />
                    )}
                  </div>
                )}

                {/* Bubble + actions */}
                <div className={`relative group flex min-w-0 flex-col ${isMe ? 'items-end max-w-[82%]' : 'items-start max-w-[72%]'}`}>
                  {/* Sender name (group chats) */}
                  {!isMe && !isGrouped && isGroupChat && (
                    <span className="mb-1 ml-1 text-[11px] font-semibold text-gray-600 dark:text-white/[0.62]">{getSenderName(msg.sender)}</span>
                  )}


                  <div className={`flex max-w-full flex-col ${isMe ? 'items-end self-end' : 'items-start self-start'}`}>
                  <div className={`flex max-w-full items-end gap-1.5 ${isMe ? 'self-end' : 'self-start'}`}>
                    {/* Hover actions (my side) */}
                    {isMe && (
                      <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-0.5 mb-1">
                        <button
                          aria-label={`React to: ${previewContent(msg.content)}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (isEmojiOpen) closeEmojiPicker();
                            else openEmojiPicker(msg.id);
                            closeMessageActions();
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <span className="text-[13px]">😊</span>
                        </button>
                        <button
                          aria-label={`More options for: ${previewContent(msg.content)}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (isActionsOpen) closeMessageActions();
                            else openMessageActions(msg.id, e.currentTarget);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Message bubble */}
                    <motion.div
                      ref={el => { messageBubbleRefs.current[msg.id] = el; }}
                      drag="x"
                      dragDirectionLock
                      dragSnapToOrigin
                      dragMomentum={false}
                      dragElastic={0.16}
                      dragConstraints={isMe ? { left: -76, right: 0 } : { left: 0, right: 76 }}
                      whileDrag={{ scale: 0.985 }}
                      onDragStart={() => handleReplyDragStart(msg.id)}
                      onDragEnd={(_, info) => handleReplyDragEnd(msg, isMe, info)}
                      onClick={e => {
                        e.stopPropagation();
                        if (draggedMessageId.current === msg.id) {
                          draggedMessageId.current = null;
                          return;
                        }
                        setTappedMsgId(prev => prev === msg.id ? null : msg.id);
                      }}
                      onPointerDown={e => {
                        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
                        void primeInteractionSounds();
                        clearMessageLongPress();
                        window.getSelection()?.removeAllRanges();
                        msgLongPressOrigin.current = { x: e.clientX, y: e.clientY };
                        const anchor = e.currentTarget;
                        msgLongPressTimer.current = setTimeout(() => {
                          msgLongPressTimer.current = null;
                          msgLongPressOrigin.current = null;
                          openMessageActions(msg.id, anchor, true);
                        }, 500);
                      }}
                      onPointerMove={e => {
                        const origin = msgLongPressOrigin.current;
                        if (!origin || Math.hypot(e.clientX - origin.x, e.clientY - origin.y) <= 10) return;
                        clearMessageLongPress();
                      }}
                      onPointerUp={clearMessageLongPress}
                      onPointerLeave={clearMessageLongPress}
                      onPointerCancel={clearMessageLongPress}
                      onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        openMessageActions(msg.id, e.currentTarget);
                      }}
                      data-app-nonselect="true"
                      className={`relative mb-0.5 leading-relaxed cursor-default select-none ${
                        hasReplyPreview ? 'bg-transparent' : bubbleSurfaceClass
                      } ${!hasReplyPreview && msg.is_pinned ? 'ring-1 ring-amber-400/50' : ''}`}
                    >
                      {msg.reply_preview && (
                        <div className={`relative z-0 min-w-0 pb-3 ${isMe ? 'mr-3' : 'ml-3'}`}>
                          <div className={`mb-1 flex min-w-0 items-center gap-1 px-1 text-[10px] font-semibold leading-none ${
                            isMe ? 'text-emerald-600 dark:text-emerald-300/75' : 'text-gray-600 dark:text-white/[0.72]'
                          }`}>
                            <CornerUpLeft className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {isMe ? 'You' : getSenderName(msg.sender)} replied to {msg.reply_preview.sender_name}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`Go to original message from ${msg.reply_preview.sender_name}`}
                            className={`relative z-[1] block w-full min-w-0 rounded-[14px] px-3 py-2 text-left text-[12px] leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                              isMe
                                ? 'bg-emerald-500/12 text-emerald-950/55 hover:bg-emerald-500/18 dark:bg-emerald-400/10 dark:text-white/50 dark:hover:bg-emerald-400/15'
                                : 'bg-gray-200/85 text-gray-500 hover:bg-gray-200 dark:bg-white/[0.10] dark:text-white/[0.64] dark:hover:bg-white/[0.13]'
                            }`}
                            onClick={event => {
                              event.stopPropagation();
                              if (msg.reply_to) scrollToMessage(msg.reply_to);
                            }}
                          >
                            <span
                              className="overflow-hidden whitespace-pre-wrap break-words"
                              style={{
                                overflowWrap: 'anywhere',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {replyPreviewContent(msg.reply_preview.content)}
                            </span>
                          </button>
                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute bottom-0 z-0 h-4 rounded-b-[12px] ${
                              isMe
                                ? 'left-3 right-1 bg-emerald-500/12 dark:bg-emerald-400/10'
                                : 'left-1 right-3 bg-gray-200/85 dark:bg-white/[0.10]'
                            }`}
                          />
                        </div>
                      )}
                      <div className={hasReplyPreview ? `relative z-[1] -mt-4 ${bubbleSurfaceClass} ${!isMe && !isBareMessage ? 'dark:!bg-[#222224]' : ''} ${msg.is_pinned ? 'ring-1 ring-amber-400/50' : ''}` : ''}>
                      {content.type === 'image' ? (
                        <img
                          src={content.url}
                          alt="Sent image"
                          className="max-w-[220px] max-h-[280px] rounded-xl object-cover cursor-pointer"
                          onClick={e => { e.stopPropagation(); setPreviewImageUrl(content.url); }}
                        />
                      ) : content.type === 'file' ? (
                        <div
                          className="flex items-center gap-2.5 min-w-[160px] max-w-[220px]"
                          onClick={e => e.stopPropagation()}
                        >
                          <FileText className="h-8 w-8 shrink-0 opacity-80" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate leading-tight">{content.name}</p>
                            <p className="text-[11px] opacity-60 mt-0.5">{content.size > 0 ? `${(content.size / 1024).toFixed(0)} KB` : 'File'}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setPreviewFile({ url: content.url, name: content.name })}
                              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
                              title="Open"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <a
                              href={content.url}
                              download={content.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ) : content.type === 'event_reference' ? (
                        <ChatEventReferenceCard
                          reference={content}
                          eventSongs={eventCommandDetails?.songs || []}
                          isMe={isMe}
                          onOpenSetlist={(songId) => {
                            setEventPanelMode('setlist');
                            setFocusedSetlistSongId(songId || null);
                            setShowEventDetail(true);
                          }}
                        />
                      ) : (
                        <p className="text-[14px] whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                          {renderMessageText(content.text, isMe)}
                        </p>
                      )}
                      {msg.is_pinned && (
                        <Pin className="absolute -top-2 -right-2 h-3.5 w-3.5 text-amber-500 bg-white dark:bg-[#111013] rounded-full p-0.5" style={{ padding: '2px' }} />
                      )}
                      </div>

                      {/* Reactions — sitting just below the bubble's bottom-right corner */}
                      {hasVisibleReactionBadge && (
                        <div
                          data-message-reaction-bar="true"
                          className={`absolute -bottom-3 -right-1 -mb-2 z-10 flex h-[26px] items-center justify-center gap-px rounded-full border border-gray-100 bg-white py-0 shadow-md dark:border-white/[0.1] dark:bg-[#1c1c1e] ${
                            isSingleReactionBadge ? 'w-[26px] px-0' : 'min-w-[51px] px-1.5'
                          }`}
                          onClick={e => e.stopPropagation()}
                        >
                          {Object.entries(visibleReactionCounts).map(([emoji, count]) => {
                            const iMineReacted = visibleReactions.some(r => r.emoji === emoji && r.user_id === myUserId);
                            const isLanding = reactionLanding?.messageId === msg.id && reactionLanding.emoji === emoji;
                            return (
                              <motion.button
                                key={emoji}
                                onPointerDown={event => event.stopPropagation()}
                                onClick={event => {
                                  event.stopPropagation();
                                  setTappedMsgId(null);
                                  setReactionDetailsMessageId(msg.id);
                                }}
                                data-reaction-emoji={emoji}
                                initial={isLanding ? { scale: 0.72, opacity: 0.35 } : false}
                                animate={isLanding
                                  ? { scale: [0.72, 1.16, 0.96, 1], opacity: [0.35, 1, 1, 1] }
                                  : { scale: 1, opacity: iMineReacted ? 1 : 0.7 }}
                                transition={isLanding
                                  ? { duration: 0.36, times: [0, 0.48, 0.72, 1], ease: [0.16, 1, 0.3, 1] }
                                  : { duration: 0.16 }}
                                className={`flex min-h-6 items-center gap-0.5 rounded-full px-1 text-[13px] transition-transform active:scale-90 ${!iMineReacted ? 'opacity-70' : ''}`}
                                aria-label={`Show ${count} ${emoji} ${count === 1 ? 'reaction' : 'reactions'}`}
                              >
                                {emoji}
                                {count > 1 && (
                                  <span className="ml-0.5 text-[10px] font-semibold text-gray-500 dark:text-white/50">{count}</span>
                                )}
                              </motion.button>
                            );
                          })}
                          {needsLandingPlaceholder && pendingReactionReveal && (
                            <span
                              aria-hidden="true"
                              data-reaction-emoji={pendingReactionReveal.emoji}
                              className="invisible flex min-h-6 items-center gap-0.5 rounded-full px-1 text-[13px]"
                            >
                              {pendingReactionReveal.emoji}
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>

                    {/* Hover actions (other side) */}
                    {!isMe && (
                      <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-0.5 mb-1">
                        <button
                          aria-label={`React to: ${previewContent(msg.content)}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (isEmojiOpen) closeEmojiPicker();
                            else openEmojiPicker(msg.id);
                            closeMessageActions();
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <span className="text-[13px]">😊</span>
                        </button>
                        <button
                          aria-label={`More options for: ${previewContent(msg.content)}`}
                          onClick={e => {
                            e.stopPropagation();
                            if (isActionsOpen) closeMessageActions();
                            else openMessageActions(msg.id, e.currentTarget);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  </div>

                  {/* Time — only visible when message is tapped */}
                  <AnimatePresence>
                    {tappedMsgId === msg.id && (
                      <motion.span
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5 mx-1 block overflow-hidden"
                      >
                        {formatMsgTime(msg.created_at)}
                      </motion.span>
                    )}
                  </AnimatePresence>

                </div>
              </div>

              {/* Seen receipts — shown under my messages for all, and under others' messages in group chats */}
              {displaySeers.length > 0 && (isMe || isGroupChat) && (
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    setSeenDetailsMessageId(msg.id);
                  }}
                  className={`flex items-center gap-1.5 mt-2 rounded-full transition-[margin,opacity] active:opacity-70 ${isMe ? `ml-auto justify-end ${hasVisibleReactionBadge ? 'mr-16' : 'mr-1.5'}` : 'ml-8 justify-start'}`}
                  aria-label={`Show seen details for ${displaySeers.length} ${displaySeers.length === 1 ? 'person' : 'people'}`}
                >
                  {displaySeers.map(seer => {
                    const member = conv.members.find(m => m.user_id === seer.userId);
                    const label = seer.userId === myUserId
                      ? `You at ${formatMsgTime(seer.readAt)}`
                      : `Seen by ${getFullName(member?.profile, 'someone')} at ${formatMsgTime(seer.readAt)}`;
                    return (
                      <div key={seer.userId} className="-ml-0.5 first:ml-0" title={label}>
                        <Avatar
                          src={member?.profile?.avatar_url ?? undefined}
                          firstName={member?.profile?.first_name || '?'}
                          lastName={member?.profile?.last_name ?? undefined}
                          size="xxs"
                          className="ring-1 ring-white dark:ring-[#111013]"
                        />
                      </div>
                    );
                  })}
                  {isMe && !isGroupChat && latestSeenAt && (
                    <span className="text-[10px] font-medium text-gray-400 dark:text-white/25 self-center">{`Seen ${formatMsgTime(latestSeenAt)}`}</span>
                  )}
                </button>
              )}
              </>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="flex items-end gap-2 mt-3"
              aria-live="polite"
            >
              <div className="w-7 shrink-0" />
              <div>
                <p className="mb-1 ml-1 text-[11px] font-medium text-emerald-500 dark:text-emerald-400">
                  {typingLabel}...
                </p>
                <div className="flex w-fit items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-white/[0.07] border border-gray-200/80 dark:border-white/[0.06]">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                      className="h-2 w-2 rounded-full bg-emerald-500/70 dark:bg-emerald-300/70"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      <MessageActionOverlay
        open={Boolean(activeMessage && messageActionAnchorRect)}
        anchorRect={messageActionAnchorRect}
        canCopy={activeMessageContent?.type === 'text'}
        isMine={activeMessage?.sender_id === myUserId}
        isPinned={Boolean(activeMessage?.is_pinned)}
        onClose={closeMessageActions}
        onReply={() => {
          if (activeMessage) startReplyToMessage(activeMessage);
        }}
        onCopy={() => {
          if (activeMessageContent?.type === 'text') void navigator.clipboard.writeText(activeMessageContent.text);
          closeMessageActions();
        }}
        onReact={() => {
          if (activeMessage) openEmojiPicker(activeMessage.id);
          closeMessageActions();
        }}
        onTogglePin={() => {
          if (activeMessage) void pinMessage(activeMessage.id, !activeMessage.is_pinned);
          closeMessageActions();
        }}
        onDelete={() => {
          if (activeMessage) void deleteMessage(activeMessage.id);
          closeMessageActions();
        }}
      />

      <EmojiReactionPopover
        open={Boolean(emojiMsgId && emojiAnchorRect)}
        anchorRect={emojiAnchorRect}
        boundaryTop={emojiBoundaryTop}
        onClose={closeEmojiPicker}
        onPick={(emoji, sourceElement) => {
          if (emojiMsgId) void handleMessageReaction(emojiMsgId, emoji, sourceElement);
        }}
      />

      {createPortal(
        <AnimatePresence>
          {reactionFlight && (
            <ReactionFlightAnimation
              key={reactionFlight.token}
              flight={reactionFlight}
              fixed
              onComplete={() => handleReactionFlightComplete(reactionFlight)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      {!showInfo && !showEventDetail && (
        <>
          <InputBar
            conversationId={conv.id}
            onSend={handleSend}
            replyTo={replyTo?.id ?? null}
            replyPreview={replyTo?.preview ?? null}
            onCancelReply={() => setReplyTo(null)}
            onTyping={handleTyping}
            mentionProfiles={mentionProfiles}
            eventDetails={eventCommandDetails}
          />
        </>
      )}

      {/* Image lightbox */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
            onClick={() => setPreviewImageUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain select-none"
            />
            <button
              className="absolute top-safe right-4 text-white bg-black/60 rounded-full p-3 transition-colors active:bg-black/80"
              style={{ top: 'max(env(safe-area-inset-top, 0px), 16px)' }}
              onClick={() => setPreviewImageUrl(null)}
            >
              <X className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File preview modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col bg-black/90"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0">
              <span className="text-white text-[14px] font-medium truncate max-w-[70%]">{previewFile.name}</span>
              <div className="flex items-center gap-3">
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </a>
                <button
                  className="text-white/70 hover:text-white transition-colors"
                  onClick={() => setPreviewFile(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={(() => {
                  const ext = previewFile.name.split('.').pop()?.toLowerCase() || '';
                  if (['doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext))
                    return `https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url)}&embedded=true`;
                  return previewFile.url;
                })()}
                className="w-full h-full border-0"
                title={previewFile.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reactionDetailsMessage && (
          <ReactionDetailsSheet
            message={reactionDetailsMessage}
            members={conv.members}
            myUserId={myUserId}
            onClose={() => setReactionDetailsMessageId(null)}
            onToggleReaction={toggleReaction}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {seenDetailsMessage && seenDetailsSeers.length > 0 && (
          <SeenDetailsSheet
            message={seenDetailsMessage}
            seers={seenDetailsSeers}
            members={conv.members}
            myUserId={myUserId}
            onClose={() => setSeenDetailsMessageId(null)}
          />
        )}
      </AnimatePresence>

      {/* Event detail slide-over — sits above info panel */}
      <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {showEventDetail && conv.event_id && (
            <motion.div
              initial={{ x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
              animate={{ x: 0, opacity: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: mobilePanelShadow }}
              exit={{ x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
              transition={mobilePanelTransition}
              className="absolute inset-0 flex h-full min-h-0 flex-col pointer-events-auto overflow-hidden bg-white will-change-transform dark:bg-[#111013] lg:rounded-none lg:shadow-none"
            >
              <EventDetailPanel
                eventId={conv.event_id}
                mode={eventPanelMode}
                focusedSongId={focusedSetlistSongId}
                onClose={() => setShowEventDetail(false)}
                onViewFullEvent={() => { setShowEventDetail(false); navigate(`/events/${conv.event_id}`); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info panel slide-over — absolute inset, clips its own overflow */}
      <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
              animate={{ x: 0, opacity: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: mobilePanelShadow }}
              exit={{ x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
              transition={mobilePanelTransition}
              className="absolute inset-0 pointer-events-auto overflow-hidden bg-white will-change-transform dark:bg-[#111013] lg:rounded-none lg:shadow-none"
            >
              <ConvInfoPanel
                conv={conv}
                messages={messages}
                myUserId={myUserId}
                onClose={() => setShowInfo(false)}
                onBack={() => { setShowInfo(false); onBack(); }}
                onScrollToMessage={scrollToMessage}
                onConvUpdate={onConvUpdate}
                onRequestDelete={onRequestDelete}
                onDeleteAsCreator={onDeleteAsCreator}
                onRenameGroup={onRenameGroup}
                onAddMembers={onAddMembers}
                onUpdateGroupPhoto={onUpdateGroupPhoto}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onNew, className = '' }: { onNew: () => void; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center h-full text-center px-8 ${className}`}>
      <div className="h-16 w-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/[0.1] flex items-center justify-center mb-4">
        <MessageCircle className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
      </div>
      <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Your Messages</h2>
      <p className="text-[13px] text-gray-400 dark:text-white/35 leading-relaxed mb-5">
        Send private messages to your team members. Conversations are only visible to members.
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold shadow-md shadow-emerald-500/25 transition-all active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> New Message
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function useIsDesktop() {
  const getIsDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

function useMessagesKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.classList.add('messages-chat-active');
    document.body.classList.add('messages-chat-active');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    let restingViewportHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);

    const setInset = () => {
      const composerFocused =
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement instanceof HTMLElement && document.activeElement.dataset.chatComposer === 'true');
      const viewport = window.visualViewport;
      const rawKeyboardInset = viewport
        ? Math.max(0, restingViewportHeight - viewport.height - viewport.offsetTop)
        : 0;
      const isPhoneViewport = window.matchMedia('(max-width: 600px)').matches;
      if (!composerFocused || rawKeyboardInset < 80) {
        restingViewportHeight = Math.max(restingViewportHeight, window.innerHeight, viewport?.height || 0);
      }
      // iPhone Safari reports the keyboard animation in small visual viewport
      // increments. React on the first real shrink so the fixed chat pane does
      // not briefly remain panned above the visible viewport. Keep the proven
      // higher threshold on tablets and desktop touch devices.
      const keyboardOpen = composerFocused && rawKeyboardInset > (isPhoneViewport ? 24 : 120);
      const keyboardInset = keyboardOpen ? rawKeyboardInset : 0;
      document.documentElement.classList.toggle('messages-keyboard-open', keyboardOpen);
      if (keyboardOpen && viewport) {
        document.documentElement.style.setProperty('--messages-viewport-height', `${Math.round(viewport.height)}px`);
        document.documentElement.style.setProperty(
          '--messages-viewport-offset-top',
          `${isPhoneViewport ? Math.round(viewport.offsetTop) : 0}px`,
        );
      } else {
        document.documentElement.style.removeProperty('--messages-viewport-height');
        document.documentElement.style.removeProperty('--messages-viewport-offset-top');
      }
      document.documentElement.style.setProperty('--messages-keyboard-inset', `${Math.round(keyboardInset)}px`);
      if (!isPhoneViewport) window.scrollTo(0, 0);
      window.dispatchEvent(new Event('messages-keyboard-inset-change'));
    };

    setInset();
    window.visualViewport?.addEventListener('resize', setInset);
    window.visualViewport?.addEventListener('scroll', setInset);
    window.addEventListener('resize', setInset);
    window.addEventListener('focusin', setInset);
    window.addEventListener('focusout', setInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', setInset);
      window.visualViewport?.removeEventListener('scroll', setInset);
      window.removeEventListener('resize', setInset);
      window.removeEventListener('focusin', setInset);
      window.removeEventListener('focusout', setInset);
      document.documentElement.style.removeProperty('--messages-keyboard-inset');
      document.documentElement.style.removeProperty('--messages-viewport-height');
      document.documentElement.style.removeProperty('--messages-viewport-offset-top');
      document.documentElement.classList.remove('messages-keyboard-open');
      document.documentElement.classList.remove('messages-chat-active');
      document.body.classList.remove('messages-chat-active');
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [active]);
}

function useDisableChatEdgeBackSwipe(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const edgeThreshold = 36;
    let gestureStart: { x: number; y: number } | null = null;
    let blockingEdgeSwipe = false;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gestureStart = null;
        blockingEdgeSwipe = false;
        return;
      }

      const touch = event.touches[0];
      gestureStart = touch.clientX <= edgeThreshold
        ? { x: touch.clientX, y: touch.clientY }
        : null;
      blockingEdgeSwipe = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!gestureStart || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - gestureStart.x;
      const deltaY = touch.clientY - gestureStart.y;
      const isBackSwipe = deltaX > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

      if (!isBackSwipe && !blockingEdgeSwipe) return;
      blockingEdgeSwipe = true;
      event.preventDefault();
    };

    const clearGesture = () => {
      gestureStart = null;
      blockingEdgeSwipe = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', clearGesture, { capture: true });
    window.addEventListener('touchcancel', clearGesture, { capture: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      window.removeEventListener('touchend', clearGesture, { capture: true });
      window.removeEventListener('touchcancel', clearGesture, { capture: true });
    };
  }, [active]);
}

export function Messages() {
  const { conversationId: paramConvId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { user, isLeader, isOrgAdmin, isAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();

  const isDesktop = useIsDesktop();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(paramConvId ?? null);
  const [search, setSearch] = useState('');
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [conversationActions, setConversationActions] = useState<Conversation | null>(null);
  const [conversationActionBusy, setConversationActionBusy] = useState(false);

  const {
    conversations,
    loading: convsLoading,
    refresh,
    createDirectConversation,
    createGroupConversation,
    createEventConversation,
    requestDeleteConversation,
    confirmDeleteConversation,
    deleteConversationAsCreator,
    renameGroupConversation,
    addGroupConversationMembers,
    updateGroupConversationPhoto,
    discardEmptyConversation,
    archiveConversationForMe,
    archiveConversationForEveryone,
    leaveConversation,
  } = useConversations();
  useMessagesKeyboardInset(Boolean(selectedConvId));
  useDisableChatEdgeBackSwipe(!isDesktop && Boolean(selectedConvId));

  const myUserId = user?.id ?? '';

  const visibleConversations = conversations.filter(c => c.last_message);

  const filteredConvs = visibleConversations.filter(c => {
    if (!search.trim()) return true;
    const name = getConvName(c, myUserId).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  useLayoutEffect(() => {
    if (paramConvId) {
      setSelectedConvId(paramConvId);
      return;
    }
    setSelectedConvId(null);
  }, [paramConvId]);

  useEffect(() => {
    if (!selectedConvId || convsLoading) return;
    if (conversations.some(c => c.id === selectedConvId)) return;
    setSelectedConvId(null);
    navigate('/messages', { replace: true });
  }, [conversations, convsLoading, navigate, selectedConvId]);

  const selectConversation = (id: string) => {
    setSelectedConvId(id);
    navigate(`/messages/${id}`);
  };

  const handleBack = async () => {
    const selected = conversations.find(c => c.id === selectedConvId);
    if (selected && !selected.last_message) {
      await discardEmptyConversation(selected.id);
    }
    setSelectedConvId(null);
    navigate('/messages', { replace: true });
  };

  const handleNewMessage = async (otherUserId: string) => {
    const id = await createDirectConversation(otherUserId);
    if (id) selectConversation(id);
  };

  const handleNewGroup = async (userIds: string[], groupName: string) => {
    const id = await createGroupConversation(userIds, groupName);
    if (id) selectConversation(id);
  };

  const handleNewEventChat = async (eventId: string, adminOnlyTest: boolean) => {
    const id = await createEventConversation(eventId, adminOnlyTest);
    if (!id) {
      toast('error', adminOnlyTest ? 'Could not create the admin-only test chat.' : 'Could not create the event chat.');
      return false;
    }
    selectConversation(id);
    return true;
  };

  const finishConversationAction = async (action: () => Promise<boolean>, successMessage: string) => {
    if (!conversationActions || conversationActionBusy) return;
    setConversationActionBusy(true);
    const affectedId = conversationActions.id;
    const ok = await action();
    setConversationActionBusy(false);
    if (!ok) return toast('error', 'That chat action could not be completed.');
    setConversationActions(null);
    if (selectedConvId === affectedId) {
      setSelectedConvId(null);
      navigate('/messages', { replace: true });
    }
    toast('success', successMessage);
  };

  const mobileChatIsOpen = Boolean(selectedConvId);
  const showConversationList = isDesktop || !mobileChatIsOpen;
  const showChatPane = isDesktop || mobileChatIsOpen;

  useEffect(() => {
    document.documentElement.classList.add('messages-page-active');
    document.body.classList.add('messages-page-active');
    return () => {
      document.documentElement.classList.remove('messages-page-active');
      document.body.classList.remove('messages-page-active');
    };
  }, []);

  useEffect(() => {
    const refreshDraftPreviews = () => setDraftRevision(revision => revision + 1);
    window.addEventListener(MESSAGE_DRAFT_CHANGED_EVENT, refreshDraftPreviews);
    window.addEventListener('storage', refreshDraftPreviews);
    return () => {
      window.removeEventListener(MESSAGE_DRAFT_CHANGED_EVENT, refreshDraftPreviews);
      window.removeEventListener('storage', refreshDraftPreviews);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isDesktop) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [isDesktop, selectedConvId]);

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#111013] lg:bg-[#f5f5f7] lg:dark:bg-[#0d0d0f] lg:p-4"
      style={isDesktop ? { paddingTop: 'calc(72px + var(--desktop-safe-area-top, 0px) + 1rem)' } : undefined}
    >
      <div className="contents lg:relative lg:flex lg:h-full lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-black/[0.06] lg:bg-white lg:shadow-[0_24px_80px_-52px_rgba(15,23,42,0.85)] lg:ring-1 lg:ring-white/70 dark:lg:border-white/[0.07] dark:lg:bg-[#111013] dark:lg:ring-white/[0.04]">
        <div className="pointer-events-none absolute inset-x-10 top-0 z-10 hidden h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.12] lg:block" />

      {/* ── Left: Conversation list ── */}
      <AnimatePresence initial={false}>
        {showConversationList && (
        <motion.div
          key="conversation-list"
          className={`relative z-[1] flex min-h-0 flex-col bg-white dark:bg-[#111013] lg:border-r lg:border-gray-100 dark:lg:border-white/[0.06] lg:bg-white/96 dark:lg:bg-[#111013]/96 ${
            isDesktop ? 'h-full w-[320px] min-w-[320px] shrink-0 relative' : 'fixed inset-0 z-10 h-[100svh] h-[100dvh] w-[100dvw] max-w-none will-change-transform'
          }`}
          initial={isDesktop ? false : { x: 0, opacity: 1 }}
          animate={isDesktop ? undefined : { x: 0, opacity: 1 }}
          exit={isDesktop ? undefined : { x: 0, opacity: 1 }}
          transition={isDesktop ? undefined : mobilePanelTransition}
        >
        {/* List header */}
        <div
          className="relative z-20 shrink-0 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:pt-[max(env(safe-area-inset-top),1rem)] lg:bg-white/96 lg:backdrop-blur-xl dark:lg:bg-[#111013]/96 lg:pt-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[20px] font-bold text-gray-900 dark:text-white tracking-[-0.02em]">Messages</h1>
            <button
              type="button"
              onClick={() => setNewMsgOpen(true)}
              aria-label="Start a new message"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25 transition-all hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/[0.05]">
            <Search className="h-3.5 w-3.5 text-gray-400 dark:text-white/25 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search conversations"
              placeholder="Search conversations…"
              className="flex-1 text-[13px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-white px-2 space-y-0.5 dark:bg-[#111013]" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 1rem)' }}>
          {convsLoading && (
            <div className="flex justify-center py-8" role="status" aria-label="Loading conversations">
              <span className="h-5 w-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
          {!convsLoading && !search && filteredConvs.length === 0 && (
            <EmptyState onNew={() => setNewMsgOpen(true)} className="min-h-[420px] pb-12" />
          )}
          {!convsLoading && search && filteredConvs.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-8 w-8 text-gray-300 dark:text-white/10 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400 dark:text-white/30">No conversations match</p>
            </div>
          )}
          {filteredConvs.map(c => (
            <ConvItem
              key={c.id}
              conv={c}
              selected={c.id === selectedConvId}
              myUserId={myUserId}
              draft={draftRevision >= 0 ? readMessageDraft(myUserId, c.id) : ''}
              onSelect={() => selectConversation(c.id)}
              onLongPress={() => setConversationActions(c)}
            />
          ))}
        </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right: Chat window ── */}
      <AnimatePresence initial={false}>
        {showChatPane && (
        <motion.div
          key="chat-pane"
          className={`relative z-[1] flex min-h-0 flex-col ${isDesktop ? 'h-full flex-1 min-w-0' : 'mobile-chat-pane left-0 top-0 z-20 w-[100dvw] max-w-none will-change-transform'}`}
          initial={isDesktop ? false : { x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
          animate={isDesktop ? undefined : { x: 0, opacity: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, boxShadow: mobilePanelShadow }}
          exit={isDesktop ? undefined : { x: '100%', opacity: 0.96, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, boxShadow: mobilePanelShadow }}
          transition={isDesktop ? undefined : mobilePanelTransition}
          style={isDesktop ? undefined : { overflow: 'visible', zIndex: 2147483000 }}
        >
        <AnimatePresence mode={isDesktop ? 'wait' : 'sync'} initial={false}>
          {selectedConv ? (
            isDesktop ? (
              <motion.div
                key={selectedConv.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex flex-col h-full min-h-0"
              >
                <ChatWindow
                  conv={selectedConv}
                  myUserId={myUserId}
                  onBack={handleBack}
                  onConvUpdate={refresh}
                  onRequestDelete={requestDeleteConversation}
                  onConfirmDelete={confirmDeleteConversation}
                  onDeleteAsCreator={deleteConversationAsCreator}
                  onRenameGroup={renameGroupConversation}
                  onAddMembers={addGroupConversationMembers}
                  onUpdateGroupPhoto={updateGroupConversationPhoto}
                />
              </motion.div>
            ) : (
              <div key={selectedConv.id} className="flex flex-col h-full min-h-0">
              <ChatWindow
                conv={selectedConv}
                myUserId={myUserId}
                onBack={handleBack}
                onConvUpdate={refresh}
                onRequestDelete={requestDeleteConversation}
                onConfirmDelete={confirmDeleteConversation}
                onDeleteAsCreator={deleteConversationAsCreator}
                onRenameGroup={renameGroupConversation}
                onAddMembers={addGroupConversationMembers}
                onUpdateGroupPhoto={updateGroupConversationPhoto}
              />
              </div>
            )
          ) : selectedConvId && convsLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
              role="status"
              aria-label="Loading conversation"
            >
              <span className="h-6 w-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </motion.div>
          ) : isDesktop ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <EmptyState onNew={() => setNewMsgOpen(true)} />
            </motion.div>
          ) : (
            <div className="hidden" />
          )}
        </AnimatePresence>
        </motion.div>
        )}
      </AnimatePresence>
      </div>

      <NewMessageModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        onSelect={handleNewMessage}
        onCreateGroup={handleNewGroup}
        onCreateEventChat={handleNewEventChat}
        currentUserId={myUserId}
        canCreateAdminTestChat={isOrgAdmin || isAdmin || isPlatformOwner}
      />
      <Modal open={Boolean(conversationActions)} onClose={() => !conversationActionBusy && setConversationActions(null)} title="Chat Options" size="sm" mobileView="dialog">
        {conversationActions && (
          <div className="space-y-2 p-1">
            <p className="mb-4 truncate text-sm font-semibold text-gray-900 dark:text-white">{getConvName(conversationActions, myUserId)}</p>
            <button type="button" disabled={conversationActionBusy} onClick={() => finishConversationAction(() => archiveConversationForMe(conversationActions.id), 'Chat archived for you.')} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/[0.06]"><Pin className="h-4 w-4 text-emerald-500" /> Archive for Me</button>
            {conversationActions.type === 'group' && conversationActions.created_by !== myUserId && (
              <button type="button" disabled={conversationActionBusy} onClick={() => finishConversationAction(() => leaveConversation(conversationActions.id), 'You left the chat.')} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/[0.06]"><LogOut className="h-4 w-4 text-amber-500" /> Leave Chat</button>
            )}
            {isLeader && (
              <button type="button" disabled={conversationActionBusy} onClick={() => finishConversationAction(() => archiveConversationForEveryone(conversationActions.id), 'Chat archived for everyone.')} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/[0.06]"><Pin className="h-4 w-4 text-amber-500" /> Archive for Everyone</button>
            )}
            {conversationActions.type !== 'event' && conversationActions.created_by === myUserId && (
              <button type="button" disabled={conversationActionBusy} onClick={async () => {
                setConversationActionBusy(true);
                const ok = conversationActions.type === 'group' ? await deleteConversationAsCreator(conversationActions.id) : await requestDeleteConversation(conversationActions.id);
                setConversationActionBusy(false);
                if (!ok) return toast('error', 'Could not delete this chat.');
                setConversationActions(null);
                toast('success', conversationActions.type === 'group' ? 'Chat deleted.' : 'Delete request sent.');
              }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete Chat</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
