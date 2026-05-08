import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, ImageIcon, X, Pin, CornerUpLeft,
  MessageCircle, Plus, Search, Trash2, MoreHorizontal, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConversations, type Conversation } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';

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

type MsgContent = { type: 'text'; text: string } | { type: 'image'; url: string };
function parseContent(content: string): MsgContent {
  try {
    const p = JSON.parse(content);
    if (p.type === 'image' && typeof p.url === 'string') return p;
  } catch {
    // Treat non-JSON content as a plain text message.
  }
  return { type: 'text', text: content };
}

function getOtherMember(conv: Conversation, myId: string) {
  return conv.members.find(m => m.user_id !== myId);
}

function getConvName(conv: Conversation, myId: string): string {
  if (conv.name) return conv.name;
  if (conv.type === 'personal') {
    const other = getOtherMember(conv, myId);
    const p = other?.profile;
    return p?.nickname || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';
  }
  return 'Group Chat';
}

function getSenderName(sender: { first_name: string | null; last_name: string | null; nickname: string | null }): string {
  return sender.nickname || sender.first_name || 'Unknown';
}

function previewContent(content: string): string {
  const parsed = parseContent(content);
  if (parsed.type === 'image') return '📷 Photo';
  return parsed.text.length > 60 ? parsed.text.slice(0, 60) + '…' : parsed.text;
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
  const other = conv.type === 'personal' ? getOtherMember(conv, myUserId) : null;
  const lastContent = conv.last_message ? previewContent(conv.last_message.content) : 'No messages yet';
  const isMyLast = conv.last_message?.sender_id === myUserId;

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
          src={other?.profile?.avatar_url ?? undefined}
          firstName={other?.profile?.first_name || name.charAt(0)}
          lastName={other?.profile?.last_name ?? undefined}
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

function NewMessageModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; nickname: string | null; avatar_url: string | null }>>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from('profiles').select('id, first_name, last_name, nickname, avatar_url').order('first_name')
      .then(({ data }) => setPeople(data || []));
  }, [open]);

  const filtered = people.filter(p => {
    const name = `${p.nickname || ''} ${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    return name.includes(query.toLowerCase());
  });

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
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-white/[0.06]">
              <Search className="h-4 w-4 text-gray-400 dark:text-white/30 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search people…"
                className="flex-1 text-[14px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none"
              />
              <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-72 p-2">
              {filtered.length === 0 && (
                <p className="text-center text-[13px] text-gray-400 dark:text-white/30 py-6">No people found</p>
              )}
              {filtered.map(p => {
                const name = p.nickname || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
                return (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <Avatar src={p.avatar_url ?? undefined} firstName={p.first_name || name.charAt(0)} lastName={p.last_name ?? undefined} size="sm" />
                    <span className="text-[13px] font-medium text-gray-900 dark:text-white">{name}</span>
                  </button>
                );
              })}
            </div>
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
  const [quickEmoji, setQuickEmoji] = useState(() => localStorage.getItem('msg-quick-action') || '👍');
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('message-images').upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('message-images').getPublicUrl(path);
      onSend(JSON.stringify({ type: 'image', url: publicUrl }));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
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
      className="fixed inset-x-0 bottom-0 z-30 shrink-0 border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#111013] pb-[max(0px,calc(env(safe-area-inset-bottom)-10px))] lg:relative lg:inset-auto lg:z-auto"
      style={{ bottom: 'var(--messages-keyboard-inset, 0px)' }}
    >
      <AnimatePresence>
        {replyTo && replyPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 pt-2.5 pb-0">
              <CornerUpLeft className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <p className="flex-1 text-[12px] text-gray-500 dark:text-white/40 truncate">{replyPreview}</p>
              <button onClick={onCancelReply} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2 px-3 py-2.5">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-gray-400 dark:text-white/30 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all disabled:opacity-40"
        >
          <ImageIcon className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
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
                disabled={uploading}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.06] text-[22px] leading-none transition-all active:scale-90 disabled:opacity-40"
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
}: {
  conv: Conversation;
  messages: ReturnType<typeof import('../hooks/useMessages').useMessages>['messages'];
  myUserId: string;
  onClose: () => void;
  onBack: () => void;
  onScrollToMessage: (id: string) => void;
  onConvUpdate: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const otherMember = conv.type === 'personal' ? conv.members.find(m => m.user_id !== myUserId) : null;
  const p = otherMember?.profile;
  const displayName = p
    ? (p.nickname || `${p.first_name || ''} ${p.last_name || ''}`.trim())
    : (conv.name || 'Group Chat');

  const mediaItems = messages.filter(m => parseContent(m.content).type === 'image');

  const linkRegex = /https?:\/\/[^\s<>"]+/g;
  const linkItems: { url: string; msgId: string }[] = [];
  messages.forEach(m => {
    const c = parseContent(m.content);
    if (c.type === 'text') {
      const found = c.text.match(linkRegex);
      if (found) found.forEach(url => linkItems.push({ url, msgId: m.id }));
    }
  });

  const searchResults = search.trim()
    ? messages.filter(m => {
        const c = parseContent(m.content);
        return c.type === 'text' && c.text.toLowerCase().includes(search.toLowerCase());
      })
    : [];

  const leaveChat = async () => {
    if (!user) return;
    setLeaving(true);
    await supabase.from('conversation_members').delete()
      .eq('conversation_id', conv.id).eq('user_id', user.id);
    setLeaving(false);
    onBack();
    onConvUpdate();
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] dark:bg-[#0d0d0f]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] bg-white dark:bg-[#111013] border-b border-gray-100 dark:border-white/[0.06]">
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
        </button>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile card */}
        <div className="mx-4 mt-4 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] flex flex-col items-center py-6 px-4">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover mb-3" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-3xl mb-3">
              {(p?.first_name?.[0] || displayName[0] || '?').toUpperCase()}
            </div>
          )}
          <p className="text-[16px] font-bold text-gray-900 dark:text-white">{displayName}</p>
          <p className="text-[12px] text-gray-400 dark:text-white/30 mt-0.5">
            {conv.members.length} {conv.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

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

        {/* Links card */}
        <div className="mx-4 mt-3 rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Links</span>
            <span className="text-[12px] text-gray-400 dark:text-white/30">{linkItems.length}</span>
          </div>
          {linkItems.length === 0 ? (
            <p className="text-center text-[12px] text-gray-400 dark:text-white/25 py-5">No links yet</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
              {linkItems.map(({ url, msgId }, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
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

        {/* Delete / Leave card */}
        <div className="mx-4 mt-3 mb-6">
          {!leaveConfirm ? (
            <button
              onClick={() => setLeaveConfirm(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold text-red-500 bg-white dark:bg-[#111013] border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Chat
            </button>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#111013] border border-gray-100 dark:border-white/[0.06] p-4 space-y-3">
              <p className="text-center text-[13px] text-gray-500 dark:text-white/40">Remove this chat from your list?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setLeaveConfirm(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={leaveChat}
                  disabled={leaving}
                  className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                >
                  {leaving ? 'Removing…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Window ─────────────────────────────────────────────────────────────

function ChatWindow({ conv, myUserId, onBack, onConvUpdate }: {
  conv: Conversation; myUserId: string; onBack: () => void; onConvUpdate: () => void;
}) {
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [emojiMsgId, setEmojiMsgId] = useState<string | null>(null);
  const [tappedMsgId, setTappedMsgId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const atBottomRef = useRef(true);
  const forceStickToLatestRef = useRef(false);
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { profile } = useAuth();
  const {
    messages, loading, typingUsers, memberReadTimes,
    sendMessage, sendTyping, pinMessage, deleteMessage, toggleReaction,
  } = useMessages(conv.id);

  const convName = getConvName(conv, myUserId);

  const otherMember = conv.type === 'personal' ? getOtherMember(conv, myUserId) : null;

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
    const name = profile?.nickname || profile?.first_name || 'Someone';
    sendTyping(name);
    typingThrottleRef.current = setTimeout(() => { typingThrottleRef.current = null; }, 2000);
  }, [sendTyping, profile]);

  const handleSend = useCallback(async (text: string) => {
    await sendMessage(text, replyTo?.id);
    setReplyTo(null);
  }, [sendMessage, replyTo]);

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

  // Compute seen-by map: for each member, what's the last message id they've seen
  const seenMap = useMemo(() => {
    const result: Record<string, string> = {};
    const otherMembers = memberReadTimes.filter(m => m.user_id !== myUserId);
    for (const member of otherMembers) {
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
  }, [memberReadTimes, messages, myUserId]);

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
          src={otherMember?.profile?.avatar_url ?? undefined}
          firstName={otherMember?.profile?.first_name || convName.charAt(0)}
          lastName={otherMember?.profile?.last_name ?? undefined}
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
        {pinnedMessages.length > 0 && (
          <button
            onClick={() => setShowPinned(v => !v)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/[0.1] hover:bg-amber-100 dark:hover:bg-amber-500/[0.15] transition-colors"
          >
            <Pin className="h-3 w-3" />
            {pinnedMessages.length}
          </button>
        )}
      </div>

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
                    {c.type === 'image' ? '📷 Photo' : c.text}
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
          const latestSeenAt = seers.length > 0 ? seers.map(s => s.readAt).sort()[seers.length - 1] : '';
          const seenLabel = seers.length > 0
            ? `Seen ${formatMsgTime(latestSeenAt)}`
            : '';
          const showAvatar = !isMe && (!isGrouped || i === 0);
          const isActionsOpen = activeMsg === msg.id;
          const isEmojiOpen = emojiMsgId === msg.id;

          return (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el; }} className="rounded-xl">
              {showDateDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
                  <span className="text-[11px] text-gray-400 dark:text-white/30 font-medium">{formatDateDivider(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
                </div>
              )}

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

                  {/* Reply preview */}
                  {msg.reply_preview && (
                    <div className={`flex items-start gap-1.5 px-2.5 py-1.5 mb-1 rounded-xl text-[11px] border-l-2 ${isMe ? 'bg-emerald-400/20 border-emerald-400/50' : 'bg-gray-100 dark:bg-white/[0.06] border-gray-300 dark:border-white/[0.15]'}`}>
                      <CornerUpLeft className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-600 dark:text-white/60">{msg.reply_preview.sender_name}: </span>
                        <span className="text-gray-500 dark:text-white/40 truncate">{previewContent(msg.reply_preview.content)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-end gap-1.5">
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
                      className={`relative px-3.5 py-2 rounded-2xl leading-relaxed cursor-default ${
                        msg.reactions.length > 0 ? 'mb-5' : ''
                      } ${
                        isMe
                          ? 'bg-emerald-500 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white rounded-bl-md border border-gray-200/80 dark:border-white/[0.06]'
                      } ${msg.is_pinned ? 'ring-1 ring-amber-400/50' : ''}`}
                    >
                      {content.type === 'image' ? (
                        <img
                          src={content.url}
                          alt="Sent image"
                          className="max-w-[220px] max-h-[280px] rounded-xl object-cover"
                        />
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
                          onClick={() => { setReplyTo({ id: msg.id, preview: `${getSenderName(msg.sender)}: ${previewContent(msg.content)}` }); setActiveMsg(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <CornerUpLeft className="h-3.5 w-3.5" /> Reply
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

              {/* Seen receipts */}
              {isMe && seers.length > 0 && (
                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end mr-1' : 'ml-9'}`}>
                  {isGroupChat && seers.slice(0, 3).map(seer => {
                    const member = conv.members.find(m => m.user_id === seer.userId);
                    return (
                      <div key={seer.userId} className="-ml-0.5 first:ml-0" title={`Seen by ${member?.profile?.nickname || member?.profile?.first_name || 'someone'} at ${formatMsgTime(seer.readAt)}`}>
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
                  <span className="text-[10px] font-medium text-gray-400 dark:text-white/25 self-center">{seenLabel}</span>
                </div>
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

      <InputBar
        onSend={handleSend}
        replyTo={replyTo?.id ?? null}
        replyPreview={replyTo?.preview ?? null}
        onCancelReply={() => setReplyTo(null)}
        onTyping={handleTyping}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[25] bg-white dark:bg-[#111013] pointer-events-none lg:hidden"
        style={{ height: 'var(--messages-keyboard-inset, 0px)' }}
      />

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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
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
      const viewport = window.visualViewport;
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      document.documentElement.style.setProperty('--messages-keyboard-inset', `${Math.round(inset)}px`);
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event('messages-keyboard-inset-change'));
    };

    setInset();
    window.visualViewport?.addEventListener('resize', setInset);
    window.visualViewport?.addEventListener('scroll', setInset);
    window.addEventListener('resize', setInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', setInset);
      window.visualViewport?.removeEventListener('scroll', setInset);
      window.removeEventListener('resize', setInset);
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
  const { user } = useAuth();

  const isDesktop = useIsDesktop();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(paramConvId ?? null);
  const [search, setSearch] = useState('');
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(paramConvId));

  const { conversations, loading: convsLoading, refresh, createDirectConversation } = useConversations();
  useMessagesKeyboardInset(!isDesktop && mobileShowChat);

  const myUserId = user?.id ?? '';

  const filteredConvs = conversations.filter(c => {
    if (!search.trim()) return true;
    const name = getConvName(c, myUserId).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null;

  const selectConversation = (id: string) => {
    setSelectedConvId(id);
    setMobileShowChat(true);
    navigate(`/messages/${id}`, { replace: true });
  };

  const handleBack = () => {
    setMobileShowChat(false);
    setSelectedConvId(null);
    navigate('/messages', { replace: true });
  };

  const handleNewMessage = async (otherUserId: string) => {
    const id = await createDirectConversation(otherUserId);
    if (id) selectConversation(id);
  };

  const slideTransition = { type: 'spring' as const, stiffness: 380, damping: 36 };

  return (
    <div className="relative flex h-full min-h-0 bg-[#f5f5f7] dark:bg-[#0d0d0f] overflow-hidden">

      {/* ── Left: Conversation list ── */}
      <motion.div
        className={`flex flex-col bg-white dark:bg-[#111013] border-r border-gray-100 dark:border-white/[0.06] ${
          isDesktop ? 'w-[320px] min-w-[320px] shrink-0 relative' : 'absolute inset-0 z-10'
        }`}
        animate={!isDesktop ? { x: mobileShowChat ? '-100%' : '0%' } : undefined}
        transition={slideTransition}
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
          {!convsLoading && filteredConvs.length === 0 && (
            <div className="text-center py-10">
              <MessageCircle className="h-8 w-8 text-gray-300 dark:text-white/10 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400 dark:text-white/30">
                {search ? 'No conversations match' : 'No conversations yet'}
              </p>
              {!search && (
                <button onClick={() => setNewMsgOpen(true)} className="mt-3 text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                  Start one
                </button>
              )}
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
        className={`flex flex-col ${isDesktop ? 'flex-1 min-w-0' : 'fixed inset-0 z-20 h-[100dvh]'}`}
        animate={!isDesktop ? { x: mobileShowChat ? '0%' : '100%' } : undefined}
        transition={slideTransition}
      >
        {selectedConv ? (
          <ChatWindow conv={selectedConv} myUserId={myUserId} onBack={handleBack} onConvUpdate={refresh} />
        ) : selectedConvId && convsLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="h-6 w-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <EmptyState onNew={() => setNewMsgOpen(true)} />
        )}
      </motion.div>

      <NewMessageModal
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        onSelect={handleNewMessage}
      />
    </div>
  );
}
