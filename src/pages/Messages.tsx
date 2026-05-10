import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, ImageIcon, X, Pin, CornerUpLeft, Camera,
  MessageCircle, Plus, Search, Trash2, MoreHorizontal, ChevronRight, Check,
  CalendarDays, Music2, Copy, Paperclip, FileText, Download, ExternalLink, UserPlus,
  Calendar, Clock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTime12Hour } from '../lib/timeFormat';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConversations, type Conversation } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';

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
  | { type: 'delete_request'; requestedBy: string; requesterName: string; requestedAt: string };
function parseContent(content: string): MsgContent {
  const normalizeParsedContent = (value: unknown): MsgContent | null => {
    if (!value || typeof value !== 'object') return null;
    const p = value as Record<string, unknown>;
    if (p.type === 'image' && typeof p.url === 'string') return { type: 'image', url: p.url };
    if (p.type === 'file' && typeof p.url === 'string') return { type: 'file', url: p.url, name: typeof p.name === 'string' ? p.name : 'File', size: typeof p.size === 'number' ? p.size : 0 };
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
  if (parsed.type === 'delete_request') return 'Delete chat request';
  return parsed.text.length > 60 ? parsed.text.slice(0, 60) + '…' : parsed.text;
}

function replyPreviewContent(content: string): string {
  const parsed = parseContent(content);
  if (parsed.type === 'image') return 'Photo';
  if (parsed.type === 'file') return parsed.name;
  if (parsed.type === 'delete_request') return 'Delete chat request';
  return parsed.text;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// ─── Emoji Picker ────────────────────────────────────────────────────────────

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="flex gap-1 p-1.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/[0.08] shadow-xl">
      {QUICK_EMOJIS.map(e => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="w-9 h-9 flex items-center justify-center text-[18px] rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors active:scale-95"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Conversation list item ──────────────────────────────────────────────────

function ConvItem({ conv, selected, myUserId, onSelect }: {
  conv: Conversation; selected: boolean; myUserId: string; onSelect: () => void;
}) {
  const name = getConvName(conv, myUserId);
  const lastContent = conv.last_message ? previewContent(conv.last_message.content) : 'No messages yet';
  const isMyLast = conv.last_message?.sender_id === myUserId;
  const avatarName = getConversationAvatarName(conv, myUserId);

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all duration-150 ${
        selected
          ? 'bg-emerald-50 dark:bg-emerald-500/[0.1]'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar
          src={getConversationAvatarSrc(conv, myUserId)}
          firstName={avatarName.firstName}
          lastName={avatarName.lastName}
          size="md"
        />
        {conv.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
            {conv.unread_count > 9 ? '9+' : conv.unread_count}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-[13px] truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-white/80'}`}>
            {name}
          </span>
          {conv.last_message && (
            <span className="text-[11px] text-gray-400 dark:text-white/30 shrink-0">
              {formatConvTime(conv.last_message.created_at)}
            </span>
          )}
        </div>
        <p className={`text-[12px] truncate ${conv.unread_count > 0 ? 'text-gray-700 dark:text-white/70 font-medium' : 'text-gray-400 dark:text-white/35'}`}>
          {isMyLast ? `You: ${lastContent}` : lastContent}
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

function NewMessageModal({ open, onClose, onSelect, onCreateGroup, onCreateEventChat, currentUserId }: {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  onCreateGroup: (userIds: string[], groupName: string) => void;
  onCreateEventChat: (eventId: string) => void;
  currentUserId: string;
}) {
  const [mode, setMode] = useState<'direct' | 'group' | 'event'>('direct');
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; nickname: string | null; avatar_url: string | null }>>([]);
  const [events, setEvents] = useState<EventChoice[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode('direct');
    setQuery('');
    setGroupName('');
    setSelectedIds(new Set());
    Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, nickname, avatar_url').order('first_name'),
      supabase.from('events').select('id, title, event_date, start_time, event_type').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(60),
    ]).then(([peopleRes, eventsRes]) => {
      setPeople((peopleRes.data || []).filter(p => p.id !== currentUserId));
      setEvents(eventsRes.data || []);
    });
  }, [currentUserId, open]);

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

  const submitGroup = () => {
    if (selectedIds.size === 0) return;
    onCreateGroup([...selectedIds], groupName);
    onClose();
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
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 top-[15%] z-50 max-w-sm mx-auto bg-white dark:bg-[#1c1c1e] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          >
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <div className="grid grid-cols-3 gap-1 flex-1 rounded-2xl bg-gray-100 dark:bg-white/[0.06] p-1">
                  {(['direct', 'group', 'event'] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => setMode(option)}
                      className={`h-8 rounded-xl text-[12px] font-bold transition-colors ${
                        mode === option
                          ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-white/45'
                      }`}
                    >
                      {option === 'direct' ? 'Direct' : option === 'group' ? 'Group' : 'Event'}
                    </button>
                  ))}
                </div>
                <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {mode === 'group' && (
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Group name"
                  className="w-full h-10 px-3 mb-2 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
                />
              )}
              <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-gray-400 dark:text-white/30 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={mode === 'event' ? 'Search events...' : mode === 'direct' ? 'Search people...' : 'Add people...'}
                className="flex-1 text-[14px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
              />
              </div>
            </div>
            <div className="overflow-y-auto max-h-72 p-2">
              {mode === 'event' ? (
                <>
                  {filteredEvents.length === 0 && (
                    <p className="text-center text-[13px] text-gray-400 dark:text-white/30 py-6">No events found</p>
                  )}
                  {filteredEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={() => {
                        onCreateEventChat(event.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
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
                <button
                  onClick={submitGroup}
                  disabled={selectedCount === 0}
                  className="w-full h-10 rounded-xl bg-emerald-500 text-white text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
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

function InputBar({ onSend, replyTo, replyPreview, onCancelReply, onTyping }: {
  onSend: (text: string, imageUrl?: string) => void;
  replyTo: string | null;
  replyPreview: string | null;
  onCancelReply: () => void;
  onTyping: () => void;
}) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [quickEmoji, setQuickEmoji] = useState(() => localStorage.getItem('msg-quick-action') || '👍');
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  const resizeComposer = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
    requestAnimationFrame(resizeComposer);
  };

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

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const setHeight = () => {
      document.documentElement.style.setProperty('--messages-composer-height', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };

    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--messages-composer-height');
    };
  }, []);

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

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 bottom-0 z-30 shrink-0 border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#111013] lg:relative lg:inset-auto lg:z-auto"
      style={{
        bottom: 'var(--messages-keyboard-inset, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
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
      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* + attach button */}
        <div className="relative shrink-0">
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowAttachMenu(v => !v)}
            disabled={uploading}
            className="h-9 w-9 flex items-center justify-center rounded-full text-gray-400 dark:text-white/30 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all disabled:opacity-40"
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
          <textarea
            ref={textRef}
            value={text}
            onChange={e => { setText(e.target.value); resizeComposer(); onTyping(); }}
            onFocus={() => window.dispatchEvent(new Event('messages-composer-focus'))}
            onPointerDown={focusComposerWithoutPageScroll}
            placeholder="Message…"
            rows={1}
            enterKeyHint="enter"
            style={{ resize: 'none', maxHeight: '132px' }}
            className="flex-1 px-3.5 py-2 text-[16px] sm:text-[14px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none leading-relaxed overflow-y-auto"
          />
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
                className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 transition-colors active:scale-95 disabled:opacity-40"
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
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-[22px] leading-none transition-all active:scale-90 disabled:opacity-40 select-none"
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
    </div>
  );
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

  useEffect(() => {
    if ((conv.type !== 'group' && conv.type !== 'event') || !addMembersOpen) return;
    let cancelled = false;
    setLoadingAvailablePeople(true);
    supabase
      .from('profiles')
      .select('id, first_name, last_name, nickname, avatar_url')
      .order('first_name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setAvailablePeople([]);
          setLoadingAvailablePeople(false);
          toast('error', 'Failed to load people');
          return;
        }
        setAvailablePeople((data || []).filter(person => !existingMemberIds.has(person.id)));
        setLoadingAvailablePeople(false);
      });
    return () => { cancelled = true; };
  }, [addMembersOpen, conv.type, existingMemberIds, toast]);

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
      <div className="shrink-0 flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] bg-white dark:bg-[#111013] border-b border-gray-100 dark:border-white/[0.06]">
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

      <div className="flex-1 overflow-y-auto">
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
        <div className="mx-4 mt-4 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] flex flex-col items-center py-6 px-4">
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
          <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] p-4">
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
          <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
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
        <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
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
        <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
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
        <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
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
        <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
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

        {/* Delete / Leave card */}
        <div className="mx-4 mt-3 mb-6">
          {!leaveConfirm ? (
            <button
              onClick={() => setLeaveConfirm(true)}
              disabled={!canDelete}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold text-red-500 bg-white dark:bg-[#111013] border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              {canDelete ? 'Delete Chat' : 'Only Creator Can Delete'}
            </button>
          ) : (
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

// ─── Chat Window ─────────────────────────────────────────────────────────────

type EventDiscussionDetails = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  event_type: string | null;
  songs: Array<{ id: string; title: string; artist: string | null; performed_key: string | null; song_key: string | null }>;
};

function EventDiscussionCard({ eventId, onOpen }: { eventId: string; onOpen: () => void }) {
  const [details, setDetails] = useState<EventDiscussionDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: event } = await supabase
        .from('events')
        .select('id, title, event_date, start_time, event_type')
        .eq('id', eventId)
        .maybeSingle();
      const { data: setlist } = await supabase
        .from('setlists')
        .select('id, setlist_songs(id, position, performed_key, songs(id, title, artist, song_key))')
        .eq('event_id', eventId)
        .maybeSingle();
      if (cancelled || !event) return;
      const songs = ((setlist as any)?.setlist_songs || [])
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((item: any) => ({
          id: item.songs?.id || item.id,
          title: item.songs?.title || 'Untitled song',
          artist: item.songs?.artist || null,
          performed_key: item.performed_key || null,
          song_key: item.songs?.song_key || null,
        }));
      setDetails({ ...(event as EventDiscussionDetails), songs });
    };
    load();
    return () => { cancelled = true; };
  }, [eventId]);

  if (!details) return null;

  return (
    <div className="shrink-0 border-b border-emerald-100 dark:border-emerald-500/10 bg-emerald-50/70 dark:bg-emerald-500/[0.06] px-4 py-3">
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
  songs: Array<{ id: string; title: string; artist: string | null; performed_key: string | null; song_key: string | null }>;
};

function EventDetailPanel({ eventId, onClose, onViewFullEvent }: {
  eventId: string;
  onClose: () => void;
  onViewFullEvent: () => void;
}) {
  const [data, setData] = useState<EventPanelData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: event }, { data: setlist }] = await Promise.all([
        supabase.from('events').select('id, title, event_date, start_time, end_time, event_type, description').eq('id', eventId).maybeSingle(),
        supabase.from('setlists').select('id, setlist_songs(id, position, performed_key, songs(id, title, artist, song_key))').eq('event_id', eventId).maybeSingle(),
      ]);
      if (cancelled || !event) return;
      const songs = ((setlist as any)?.setlist_songs || [])
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((item: any) => ({
          id: item.songs?.id || item.id,
          title: item.songs?.title || 'Untitled',
          artist: item.songs?.artist || null,
          performed_key: item.performed_key || null,
          song_key: item.songs?.song_key || null,
        }));
      setData({ ...(event as any), songs });
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

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d0d0f]">
      {/* Header — padded below the status bar on iOS/Android */}
      <div
        className="flex items-center justify-between gap-3 px-4 pb-3 bg-white dark:bg-[#111013] border-b border-gray-200/60 dark:border-white/[0.06] shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[14px] font-semibold active:opacity-70"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-[14px] font-bold text-gray-900 dark:text-white">Event Info</span>
        <button
          onClick={onViewFullEvent}
          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[13px] font-semibold active:opacity-70"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full Event
        </button>
      </div>

      {!data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-5 pb-6 space-y-4 max-w-lg mx-auto">

            {/* Hero card */}
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
                      <div key={song.id} className="flex items-center gap-3 px-5 py-3">
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
  const [emojiMsgId, setEmojiMsgId] = useState<string | null>(null);
  const [tappedMsgId, setTappedMsgId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const msgLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atBottomRef = useRef(true);
  const forceStickToLatestRef = useRef(false);
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const { profile } = useAuth();
  const {
    messages, loading, typingUsers, memberReadTimes,
    sendMessage, sendTyping, pinMessage, deleteMessage, toggleReaction,
  } = useMessages(conv.id);

  const convName = getConvName(conv, myUserId);

  const avatarName = getConversationAvatarName(conv, myUserId);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const keepLatestVisible = (force = false) => {
      const composerFocused = document.activeElement instanceof HTMLTextAreaElement;
      if (!force && !composerFocused && !atBottomRef.current && !forceStickToLatestRef.current) return;
      const scrollToLatest = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ block: 'end' });
      };
      requestAnimationFrame(() => {
        scrollToLatest();
        setTimeout(scrollToLatest, 60);
        setTimeout(scrollToLatest, 240);
      });
    };
    const handleComposerFocus = () => {
      forceStickToLatestRef.current = true;
      keepLatestVisible(true);
    };
    const handleKeyboardInsetChange = () => keepLatestVisible(true);

    window.addEventListener('messages-composer-focus', handleComposerFocus);
    window.addEventListener('messages-keyboard-inset-change', handleKeyboardInsetChange);
    window.visualViewport?.addEventListener('resize', handleKeyboardInsetChange);
    return () => {
      window.removeEventListener('messages-composer-focus', handleComposerFocus);
      window.removeEventListener('messages-keyboard-inset-change', handleKeyboardInsetChange);
      window.visualViewport?.removeEventListener('resize', handleKeyboardInsetChange);
    };
  }, []);

  // Close action menu on outside click
  useEffect(() => {
    if (!activeMsg && !emojiMsgId && !tappedMsgId) return;
    const handler = () => { setActiveMsg(null); setEmojiMsgId(null); setTappedMsgId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeMsg, emojiMsgId, tappedMsgId]);

  const handleTyping = useCallback(() => {
    if (typingThrottleRef.current) return;
    const name = getFullName(profile, 'Someone');
    sendTyping(name);
    typingThrottleRef.current = setTimeout(() => { typingThrottleRef.current = null; }, 2000);
  }, [sendTyping, profile]);

  const handleSend = useCallback(async (text: string) => {
    await sendMessage(text, replyTo?.id);
    setReplyTo(null);
  }, [sendMessage, replyTo]);

  const handleConfirmDelete = useCallback(async () => {
    setConfirmingDelete(true);
    const ok = await onConfirmDelete(conv.id);
    setConfirmingDelete(false);
    if (ok) onBack();
  }, [conv.id, onBack, onConfirmDelete]);

  const scrollToMessage = useCallback((id: string) => {
    setShowInfo(false);
    setTimeout(() => {
      const el = messageRefs.current[id];
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background-color 0.4s ease';
      el.style.backgroundColor = 'rgba(16,185,129,0.12)';
      setTimeout(() => { el.style.backgroundColor = ''; }, 1600);
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
    for (const [memberId, msgId] of Object.entries(seenMap)) {
      const readAt = memberReadTimes.find(m => m.user_id === memberId)?.last_read_at;
      if (!readAt) continue;
      if (!msgToSeers[msgId]) msgToSeers[msgId] = [];
      msgToSeers[msgId].push({ userId: memberId, readAt });
    }
    return msgToSeers;
  }, [memberReadTimes, seenMap]);

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const [showPinned, setShowPinned] = useState(false);
  const latestPinnedMessage = pinnedMessages[pinnedMessages.length - 1] ?? null;

  // Group messages: same sender within 5 min = grouped
  const grouped = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const isGrouped = prev &&
        prev.sender_id === msg.sender_id &&
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
      const showDateDivider = !prev ||
        new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
      return { msg, isGrouped, showDateDivider };
    });
  }, [messages]);

  const isGroupChat = conv.type === 'group' || conv.type === 'event';

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-white dark:bg-[#111013]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#111013]">
        <button
          onClick={onBack}
          className="lg:hidden shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
        </button>
        <Avatar
          src={getConversationAvatarSrc(conv, myUserId)}
          firstName={avatarName.firstName}
          lastName={avatarName.lastName}
          size="sm"
        />
        <button
          onClick={() => setShowInfo(true)}
          className="flex-1 min-w-0 text-left group"
        >
          <div className="flex items-center gap-1">
            <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{convName}</p>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20 group-hover:text-emerald-500 transition-colors shrink-0" />
          </div>
          {typingUsers.length > 0 ? (
            <p className="text-[11px] text-emerald-500 dark:text-emerald-400 leading-tight">
              {typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 dark:text-white/30 leading-tight">
              {conv.members.length} {conv.members.length === 1 ? 'member' : 'members'}
            </p>
          )}
        </button>
      </div>

      {latestPinnedMessage && (
        <button
          onClick={() => setShowPinned(v => !v)}
          className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-amber-100 dark:border-amber-500/[0.1] bg-amber-50/80 dark:bg-amber-500/[0.08] text-left hover:bg-amber-100/80 dark:hover:bg-amber-500/[0.12] transition-colors"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/[0.18] dark:text-amber-300">
            <Pin className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Pinned Message</span>
            <span className="mt-0.5 block truncate text-[12px] text-amber-900/80 dark:text-amber-100/80">
              {(() => {
                const c = parseContent(latestPinnedMessage.content);
                return c.type === 'image'
                  ? `${getSenderName(latestPinnedMessage.sender)}: Photo`
                  : c.type === 'file'
                    ? `${getSenderName(latestPinnedMessage.sender)}: ${c.name}`
                    : c.type === 'delete_request'
                      ? `${getSenderName(latestPinnedMessage.sender)}: Delete chat request`
                      : `${getSenderName(latestPinnedMessage.sender)}: ${c.text}`;
              })()}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/[0.18] dark:text-amber-300">
            {pinnedMessages.length}
          </span>
        </button>
      )}

      {conv.type === 'event' && conv.event_id && (
        <EventDiscussionCard eventId={conv.event_id} onOpen={() => setShowEventDetail(true)} />
      )}

      {/* Pinned messages panel */}
      <AnimatePresence>
        {showPinned && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden shrink-0 border-b border-amber-100 dark:border-amber-500/[0.1] bg-amber-50 dark:bg-amber-500/[0.05]"
          >
            <div className="px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400 mb-1">Pinned Messages</p>
              {pinnedMessages.map(m => {
                const c = parseContent(m.content);
                return (
                  <p key={m.id} className="text-[12px] text-amber-800 dark:text-amber-300/80 leading-snug">
                    <span className="font-semibold">{getSenderName(m.sender)}: </span>
                    {c.type === 'image' ? '📷 Photo' : c.type === 'file' ? `📎 ${c.name}` : c.type === 'delete_request' ? 'Delete chat request' : c.text}
                  </p>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5"
        style={{ paddingBottom: 'calc(var(--messages-composer-height, 64px) + var(--messages-keyboard-inset, 0px) + 0.75rem)' }}
      >
        {loading && (
          <div className="flex justify-center pt-8">
            <span className="h-5 w-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}

        {grouped.map(({ msg, isGrouped, showDateDivider }, i) => {
          const isMe = msg.sender_id === myUserId;
          const content = parseContent(msg.content);
          const seers = seenByMessage[msg.id] || [];
          // Exclude the message sender from the seers list (they trivially "see" their own message)
          const displaySeers = seers.filter(s => s.userId !== msg.sender_id);
          const latestSeenAt = displaySeers.length > 0 ? displaySeers.map(s => s.readAt).sort()[displaySeers.length - 1] : '';
          const showAvatar = !isMe && (!isGrouped || i === 0);
          const isActionsOpen = activeMsg === msg.id;
          const isEmojiOpen = emojiMsgId === msg.id;
          const deleteRequesterName = content.type === 'delete_request'
            ? getFullName(
                conv.members.find(member => member.user_id === content.requestedBy)?.profile,
                content.requesterName || 'Someone',
              )
            : 'Someone';

          return (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el; }} className="rounded-xl">
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
              <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isGrouped && !showDateDivider ? 'mt-0.5' : 'mt-3'}`}>
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
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-white/40 mb-1 ml-1">{getSenderName(msg.sender)}</span>
                  )}


                  <div className={`flex max-w-full flex-col ${isMe ? 'items-end self-end' : 'items-start self-start'}`}>
                    {msg.reply_preview && (
                      <div
                        className={`max-w-full ${isMe ? 'self-end' : 'self-start'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className={`mb-0.5 flex items-center gap-1.5 px-1 text-[10px] font-medium ${isMe ? 'text-emerald-200 dark:text-emerald-300/80' : 'text-gray-400 dark:text-white/35'}`}>
                          <CornerUpLeft className={`h-3 w-3 shrink-0 ${isMe ? 'text-emerald-200 dark:text-emerald-300/80' : 'text-emerald-500'}`} />
                          <span>{`Replied to ${msg.reply_preview.sender_name}`}</span>
                        </div>
                        <div
                          className="relative z-[1] max-w-full min-w-[180px] rounded-[18px] bg-[#f1f2f4] px-3 py-2.5 pb-5 text-[11px] leading-snug text-gray-500 dark:bg-white/[0.045] dark:text-white/55 sm:min-w-[220px]"
                        >
                          <p
                            className="overflow-hidden whitespace-pre-wrap break-words"
                            style={{
                              overflowWrap: 'anywhere',
                              display: '-webkit-box',
                              WebkitLineClamp: 5,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {replyPreviewContent(msg.reply_preview.content)}
                          </p>
                        </div>
                      </div>
                    )}

                  <div className={`flex max-w-full items-end gap-1.5 ${isMe ? 'self-end' : 'self-start'} ${msg.reply_preview ? '-mt-3 relative z-[2]' : ''}`}>
                    {/* Hover actions (my side) */}
                    {isMe && (
                      <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-0.5 mb-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEmojiMsgId(isEmojiOpen ? null : msg.id); setActiveMsg(null); }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <span className="text-[13px]">😊</span>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setActiveMsg(isActionsOpen ? null : msg.id); setEmojiMsgId(null); }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      onClick={e => { e.stopPropagation(); setTappedMsgId(prev => prev === msg.id ? null : msg.id); }}
                      onPointerDown={e => {
                        if (e.pointerType !== 'touch') return;
                        msgLongPressTimer.current = setTimeout(() => {
                          setActiveMsg(msg.id);
                          setEmojiMsgId(null);
                          setTappedMsgId(null);
                        }, 500);
                      }}
                      onPointerUp={() => { if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; } }}
                      onPointerLeave={() => { if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; } }}
                      onPointerCancel={() => { if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; } }}
                      onContextMenu={e => e.preventDefault()}
                      className={`relative leading-relaxed cursor-default select-none ${
                        msg.reactions.length > 0 ? 'mb-5' : ''
                      } ${
                        content.type === 'image'
                          ? 'px-0 py-0 bg-transparent border-0 shadow-none rounded-none'
                          : isMe
                            ? 'px-3.5 py-2 rounded-2xl bg-emerald-500 text-white rounded-br-md'
                            : 'px-3.5 py-2 rounded-2xl bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white rounded-bl-md border border-gray-200/80 dark:border-white/[0.06]'
                      } ${msg.is_pinned ? 'ring-1 ring-amber-400/50' : ''}`}
                    >
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
                      ) : (
                        <p className="text-[14px] whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{content.text}</p>
                      )}
                      {msg.is_pinned && (
                        <Pin className="absolute -top-2 -right-2 h-3.5 w-3.5 text-amber-500 bg-white dark:bg-[#111013] rounded-full p-0.5" style={{ padding: '2px' }} />
                      )}

                      {/* Reactions — sitting just below the bubble's bottom-right corner */}
                      {msg.reactions.length > 0 && (
                        <div
                          className="absolute bottom-0 right-0 translate-y-3/4 flex items-center gap-px px-1.5 py-[3px] rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/[0.1] shadow-md z-10"
                          onClick={e => e.stopPropagation()}
                        >
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([emoji, count]) => {
                            const iMineReacted = msg.reactions.some(r => r.emoji === emoji && r.user_id === myUserId);
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`flex items-center gap-0.5 text-[13px] transition-transform active:scale-90 ${!iMineReacted ? 'opacity-70' : ''}`}
                              >
                                {emoji}
                                {count > 1 && (
                                  <span className="text-[10px] font-semibold text-gray-500 dark:text-white/50 ml-0.5">{count}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Hover actions (other side) */}
                    {!isMe && (
                      <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-0.5 mb-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEmojiMsgId(isEmojiOpen ? null : msg.id); setActiveMsg(null); }}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                        >
                          <span className="text-[13px]">😊</span>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setActiveMsg(isActionsOpen ? null : msg.id); setEmojiMsgId(null); }}
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

                  {/* Emoji picker */}
                  <AnimatePresence>
                    {isEmojiOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-20 bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <EmojiPicker onPick={emoji => { toggleReaction(msg.id, emoji); setEmojiMsgId(null); }} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions menu */}
                  <AnimatePresence>
                    {isActionsOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-20 bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} min-w-[140px] bg-white dark:bg-[#1c1c1e] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-xl overflow-hidden`}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setReplyTo({ id: msg.id, preview: `${getSenderName(msg.sender)}: ${replyPreviewContent(msg.content)}` }); setActiveMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <CornerUpLeft className="h-3.5 w-3.5" /> Reply
                        </button>
                        {content.type === 'text' && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(content.text); setActiveMsg(null); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </button>
                        )}
                        <button
                          onClick={() => { setEmojiMsgId(msg.id); setActiveMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <span className="text-[13px] leading-none">😊</span> React
                        </button>
                        <button
                          onClick={() => { pinMessage(msg.id, !msg.is_pinned); setActiveMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <Pin className="h-3.5 w-3.5" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                        {isMe && (
                          <button
                            onClick={() => { deleteMessage(msg.id); setActiveMsg(null); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Seen receipts — shown under my messages for all, and under others' messages in group chats */}
              {displaySeers.length > 0 && (isMe || isGroupChat) && (
                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end mr-1' : 'ml-9'}`}>
                  {displaySeers.slice(0, 3).map(seer => {
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
                          size="xs"
                          className="scale-75 origin-center ring-1 ring-white dark:ring-[#111013]"
                        />
                      </div>
                    );
                  })}
                  {isMe && !isGroupChat && latestSeenAt && (
                    <span className="text-[10px] font-medium text-gray-400 dark:text-white/25 self-center">{`Seen ${formatMsgTime(latestSeenAt)}`}</span>
                  )}
                </div>
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
            >
              <div className="w-7 shrink-0" />
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.07] border border-gray-100 dark:border-white/[0.06]">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                    className="h-2 w-2 rounded-full bg-gray-400 dark:bg-white/30"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {!showInfo && (
        <>
          <InputBar
            onSend={handleSend}
            replyTo={replyTo?.id ?? null}
            replyPreview={replyTo?.preview ?? null}
            onCancelReply={() => setReplyTo(null)}
            onTyping={handleTyping}
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

      {/* Event detail slide-over — sits above info panel */}
      <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none">
        <AnimatePresence>
          {showEventDetail && conv.event_id && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
              className="absolute inset-0 pointer-events-auto"
            >
              <EventDetailPanel
                eventId={conv.event_id}
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
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
              className="absolute inset-0 pointer-events-auto"
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
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function useMessagesKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    const setInset = () => {
      const composerFocused = document.activeElement instanceof HTMLTextAreaElement;
      const viewport = window.visualViewport;
      const rawInset = composerFocused && viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const inset = rawInset > 80 ? rawInset : 0;
      document.documentElement.style.setProperty('--messages-keyboard-inset', `${Math.round(inset)}px`);
      window.scrollTo(0, 0);
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
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

export function Messages() {
  const { conversationId: paramConvId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { user } = useAuth();

  const isDesktop = useIsDesktop();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(paramConvId ?? null);
  const [search, setSearch] = useState('');
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(paramConvId));

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
  } = useConversations();
  useMessagesKeyboardInset(!isDesktop && mobileShowChat);

  const myUserId = user?.id ?? '';

  const visibleConversations = conversations.filter(c => c.last_message);

  const filteredConvs = visibleConversations.filter(c => {
    if (!search.trim()) return true;
    const name = getConvName(c, myUserId).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  useEffect(() => {
    if (paramConvId) {
      setSelectedConvId(paramConvId);
      setMobileShowChat(true);
      return;
    }
    setSelectedConvId(null);
    setMobileShowChat(false);
  }, [paramConvId]);

  useEffect(() => {
    if (!selectedConvId || convsLoading) return;
    if (conversations.some(c => c.id === selectedConvId)) return;
    setMobileShowChat(false);
    setSelectedConvId(null);
    navigate('/messages', { replace: true });
  }, [conversations, convsLoading, navigate, selectedConvId]);

  const selectConversation = (id: string) => {
    setSelectedConvId(id);
    setMobileShowChat(true);
    navigate(`/messages/${id}`);
  };

  const handleBack = async () => {
    const selected = conversations.find(c => c.id === selectedConvId);
    if (selected && !selected.last_message) {
      await discardEmptyConversation(selected.id);
    }
    setMobileShowChat(false);
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

  const handleNewEventChat = async (eventId: string) => {
    const id = await createEventConversation(eventId);
    if (id) selectConversation(id);
  };

  const slideTransition = { type: 'spring' as const, stiffness: 380, damping: 36 };
  const routeTransition = !isDesktop && navigationType === 'POP' ? { duration: 0 } : slideTransition;

  return (
    <div className="relative flex h-full min-h-0 bg-[#f5f5f7] dark:bg-[#0d0d0f] overflow-hidden">

      {/* ── Left: Conversation list ── */}
      <motion.div
        className={`flex flex-col bg-white dark:bg-[#111013] border-r border-gray-100 dark:border-white/[0.06] ${
          isDesktop ? 'w-[320px] min-w-[320px] shrink-0 relative' : 'absolute inset-0 z-10'
        }`}
        animate={!isDesktop ? { x: mobileShowChat ? '-100%' : '0%' } : undefined}
        transition={routeTransition}
      >
        {/* Mobile top bar spacer */}
        <div className="lg:hidden shrink-0" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }} />

        {/* List header */}
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[20px] font-bold text-gray-900 dark:text-white tracking-[-0.02em]">Messages</h1>
            <button
              onClick={() => setNewMsgOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-gray-200/60 dark:border-white/[0.05]">
            <Search className="h-3.5 w-3.5 text-gray-400 dark:text-white/25 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 text-[13px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 1rem)' }}>
          {convsLoading && (
            <div className="flex justify-center py-8">
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
              onSelect={() => selectConversation(c.id)}
            />
          ))}
        </div>
      </motion.div>

      {/* ── Right: Chat window ── */}
      <motion.div
        className={`flex flex-col ${isDesktop ? 'flex-1 min-w-0' : 'fixed inset-0 z-20 h-[100dvh] min-h-[100dvh]'}`}
        animate={!isDesktop ? { x: mobileShowChat ? '0%' : '100%' } : undefined}
        transition={routeTransition}
      >
        {selectedConv ? (
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
        ) : selectedConvId && convsLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="h-6 w-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : isDesktop ? (
          <EmptyState onNew={() => setNewMsgOpen(true)} />
        ) : (
          <div className="hidden" />
        )}
      </motion.div>

      <NewMessageModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        onSelect={handleNewMessage}
        onCreateGroup={handleNewGroup}
        onCreateEventChat={handleNewEventChat}
        currentUserId={myUserId}
      />
    </div>
  );
}
