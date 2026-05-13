import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Megaphone, Plus, Search, Eye, AlertTriangle, AlertCircle, Image, X, Type, Camera, Trash2,
  Pin, Lock, MessageCircle, Smile, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { AnnouncementsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Avatar } from '../components/Avatar';
import { FormattedText } from '../components/FormattedText';
import { MentionTextarea } from '../components/MentionTextarea';
import type { Announcement, AnnouncementReaction, AnnouncementPin } from '../types';
import { withRequestTimeout } from '../lib/requestTimeout';

interface ContentBlock { type: 'text' | 'image'; content: string; }
type AnnouncementWithBlocks = Announcement & {
  content_blocks?: ContentBlock[];
  is_leaders_only?: boolean;
  announcement_reactions?: AnnouncementReaction[];
  announcement_pins?: AnnouncementPin[];
};

const QUICK_EMOJIS = ['👍', '❤️', '🙏', '🔥', '😂', '✅'];

function groupReactions(reactions: AnnouncementReaction[]) {
  const map: Record<string, { emoji: string; count: number; users: string[] }> = {};
  reactions.forEach(r => {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_id);
  });
  return Object.values(map);
}

const PRIORITY_CONFIG = {
  urgent: {
    badge: 'bg-red-50 dark:bg-red-500/[0.12] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25',
    accent: 'rgba(239,68,68,0.12)',
    accentBorder: 'rgba(239,68,68,0.2)',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    label: 'Urgent',
  },
  high: {
    badge: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25',
    accent: 'rgba(245,158,11,0.08)',
    accentBorder: 'rgba(245,158,11,0.18)',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'High',
  },
  normal: {
    badge: '',
    accent: null,
    accentBorder: null,
    icon: null,
    iconColor: '',
    label: 'Normal',
  },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export function Announcements() {
  const { user, isLeader } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<AnnouncementWithBlocks[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showLeadersOnly, setShowLeadersOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formPriority, setFormPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [formLeadersOnly, setFormLeadersOnly] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([{ type: 'text', content: '' }]);
  const [uploading, setUploading] = useState(false);
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    const emptyList = { data: [], error: null };

    try {
      const [announcementsRes, pinsRes] = await Promise.all([
        withRequestTimeout(
          supabase
            .from('announcements')
            .select(`*, profiles!announcements_created_by_fkey(first_name, last_name, avatar_url), announcement_views(user_id), announcement_comments(id), announcement_reactions(id, user_id, emoji)`)
            .order('created_at', { ascending: false }),
          emptyList,
          'Announcements list',
        ),
        withRequestTimeout(
          supabase
            .from('announcement_pins')
            .select('id, announcement_id, pinned_by, pinned_at'),
          emptyList,
          'Announcement pins',
        ),
      ]);

      if (announcementsRes.error) console.error('Fetch announcements error:', announcementsRes.error);
      if (pinsRes.error) console.error('Fetch announcement pins error:', pinsRes.error);

      const pinsByAnnouncement = new Map<string, AnnouncementPin[]>();
      ((pinsRes.data || []) as AnnouncementPin[]).forEach(pin => {
        const pins = pinsByAnnouncement.get(pin.announcement_id) || [];
        pins.push(pin);
        pinsByAnnouncement.set(pin.announcement_id, pins);
      });

      const merged = ((announcementsRes.data || []) as AnnouncementWithBlocks[]).map(announcement => ({
        ...announcement,
        announcement_pins: pinsByAnnouncement.get(announcement.id) || [],
      }));

      setAnnouncements(merged);
    } catch (error) {
      console.error('Fetch announcements error:', error);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  useEffect(() => {
    const channel = supabase.channel('announcements_list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_reactions' }, () => fetchAnnouncements())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcement_reactions' }, () => fetchAnnouncements())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_pins' }, () => fetchAnnouncements())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcement_pins' }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAnnouncements]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('announcements').upload(path, file);
    if (error) { toast('error', 'Failed to upload image'); return null; }
    const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const url = await uploadImage(file);
      if (url) setContentBlocks(prev => [...prev, { type: 'image', content: url }]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const blocks = contentBlocks.filter(b => b.content.trim());
    if (blocks.length === 0) { toast('error', 'Please add some content'); return; }
    setCreating(true);
    const plainContent = blocks.filter(b => b.type === 'text').map(b => b.content).join('\n');
    const firstImage = blocks.find(b => b.type === 'image');
    const { error } = await supabase.from('announcements').insert({
      title: formTitle, content: plainContent || ' ', priority: formPriority, created_by: user.id,
      media_url: firstImage?.content || '', content_blocks: blocks, is_leaders_only: formLeadersOnly,
    });
    setCreating(false);
    if (error) { toast('error', 'Failed to create announcement'); return; }
    toast('success', 'Announcement posted');
    setShowCreate(false);
    setFormTitle(''); setFormPriority('normal'); setFormLeadersOnly(false);
    setContentBlocks([{ type: 'text', content: '' }]);
    fetchAnnouncements();
  };

  const handleReact = async (e: React.MouseEvent, announcementId: string, emoji: string) => {
    e.stopPropagation();
    if (!user) return;
    const announcement = announcements.find(a => a.id === announcementId);
    const existing = announcement?.announcement_reactions?.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) await supabase.from('announcement_reactions').delete().eq('id', existing.id);
    else await supabase.from('announcement_reactions').insert({ announcement_id: announcementId, user_id: user.id, emoji });
    setEmojiPickerId(null);
  };

  const handlePin = async (e: React.MouseEvent, announcement: AnnouncementWithBlocks) => {
    e.stopPropagation();
    if (!user || !isLeader) return;
    const isPinned = (announcement.announcement_pins?.length || 0) > 0;
    const previousAnnouncements = announcements;

    setAnnouncements(prev => prev.map(a => {
      if (a.id !== announcement.id) return a;
      const updated = a as AnnouncementWithBlocks;
      return {
        ...updated,
        announcement_pins: isPinned
          ? []
          : [{ id: 'optimistic', announcement_id: announcement.id, pinned_by: user.id, pinned_at: new Date().toISOString() }],
      } as AnnouncementWithBlocks;
    }));

    const { error } = isPinned
      ? await supabase
          .from('announcement_pins')
          .delete()
          .eq('announcement_id', announcement.id)
      : await supabase
          .from('announcement_pins')
          .insert({
            announcement_id: announcement.id,
            pinned_by: user.id,
          });

    if (error) {
      console.error('Announcement pin error:', error);
      if (!isPinned && error.code === '23505') {
        toast('success', 'Announcement pinned');
        return;
      }
      setAnnouncements(previousAnnouncements);
      toast('error', isPinned ? 'Failed to unpin announcement' : 'Failed to pin announcement');
      return;
    }

    toast('success', isPinned ? 'Announcement unpinned' : 'Announcement pinned');
    fetchAnnouncements();
  };

  const filtered = announcements.filter(a => {
    if (!isLeader && (a as AnnouncementWithBlocks).is_leaders_only) return false;
    if (showLeadersOnly && !(a as AnnouncementWithBlocks).is_leaders_only) return false;
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !priorityFilter || a.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const pinned = filtered.filter(a => (a.announcement_pins?.length || 0) > 0);
  const unpinned = filtered.filter(a => (a.announcement_pins?.length || 0) === 0);
  const sortedFiltered = [...pinned, ...unpinned];
  const visibleUnreadCount = filtered.filter(a => user && !a.announcement_views?.some(v => v.user_id === user.id)).length;
  const urgentCount = filtered.filter(a => a.priority === 'urgent').length;
  const latestAnnouncement = sortedFiltered[0];
  const activeFilterCount = [search, priorityFilter, showLeadersOnly ? 'leaders' : ''].filter(Boolean).length;

  const getPreviewText = (a: AnnouncementWithBlocks) => {
    const blocks = a.content_blocks;
    if (blocks && blocks.length > 0) return blocks.find(b => b.type === 'text')?.content || '';
    return a.content;
  };

  const firstImageUrl = (a: AnnouncementWithBlocks) => a.content_blocks?.find(b => b.type === 'image')?.content || null;

  if (loading) return <div className="page-container"><AnnouncementsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.28),transparent_34%),linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(146,64,14,0.65)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_34%),linear-gradient(135deg,#1c1307_0%,#10100d_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/10" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-500/10" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start">
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-amber-700/75 dark:text-amber-300/70">
                  Team updates
                </p>
                <h1 className="mt-1 text-[2rem] font-black leading-none text-gray-950 dark:text-white sm:text-[2.55rem]" style={{ letterSpacing: '-0.065em' }}>
                  Newsroom.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                  The latest ministry updates, pinned reminders, and team-wide notes in one calm place.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[23rem]">
              {[
                { label: 'Unread', value: visibleUnreadCount },
                { label: 'Pinned', value: pinned.length },
                { label: 'Urgent', value: urgentCount },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/65 px-3 py-3 text-center shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 flex flex-col gap-3 border-t border-amber-900/[0.07] pt-4 dark:border-white/[0.07] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-xs text-gray-500 dark:text-white/38">
              {latestAnnouncement ? (
                <span className="line-clamp-1">
                  Latest: <span className="font-bold text-gray-700 dark:text-white/60">{latestAnnouncement.title}</span>
                </span>
              ) : (
                <span>No news has been posted yet.</span>
              )}
            </div>
            {isLeader && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black text-white shadow-[0_12px_28px_-16px_rgba(180,83,9,0.9)] transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <Plus className="h-3.5 w-3.5" /> Post update
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Toolbar ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[1.6rem] border border-black/[0.05] bg-white/75 p-2 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.035]"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500/80 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search announcements..."
                className="h-11 w-full rounded-[1.15rem] border border-transparent bg-gray-50/90 pl-10 pr-10 text-[13px] font-semibold text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-500/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/26 dark:focus:border-amber-500/40 dark:focus:bg-white/[0.055]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[{ value: '', label: 'All Priorities' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]}
              placeholder="All Priorities"
              className="sm:w-48"
            />
            {isLeader && (
              <button
                onClick={() => setShowLeadersOnly(s => !s)}
                className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-[1.15rem] px-4 text-[12px] font-black transition-all ${
                  showLeadersOnly
                    ? 'bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950'
                    : 'bg-gray-50/90 text-gray-600 hover:bg-gray-100 dark:bg-black/20 dark:text-white/56 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Lock className="h-3.5 w-3.5" /> Leaders
              </button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-[1rem] bg-amber-50/80 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-500/[0.09] dark:text-amber-200/80">
              <span>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
              <button onClick={() => { setSearch(''); setPriorityFilter(''); setShowLeadersOnly(false); }} className="text-amber-700/70 transition-colors hover:text-amber-900 dark:text-amber-200/60 dark:hover:text-amber-100">
                Clear
              </button>
            </div>
          )}
        </motion.div>

        {/* ── List ─────────────────────────────────────── */}
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No announcements"
            description="Be the first to share something with the team."
            action={isLeader ? <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Post Announcement</button> : undefined}
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {sortedFiltered.map((a) => {
              const viewCount = a.announcement_views?.length || 0;
              const commentCount = (a as any).announcement_comments?.length || 0;
              const thumbnail = firstImageUrl(a);
              const isUnread = user && !a.announcement_views?.some(v => v.user_id === user.id);
              const isPinned = (a.announcement_pins?.length || 0) > 0;
              const isLeadersOnly = (a as AnnouncementWithBlocks).is_leaders_only;
              const reactionGroups = groupReactions(a.announcement_reactions || []);
              const pConfig = PRIORITY_CONFIG[a.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
              const PriorityIcon = pConfig.icon;

              return (
                <motion.div
                  key={a.id}
                  variants={itemVariants}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-gray-200/80 bg-white shadow-[0_18px_55px_-42px_rgba(15,23,42,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-48px_rgba(15,23,42,0.75)] dark:border-white/[0.07] dark:bg-white/[0.028]"
                  style={{
                    borderColor: pConfig.accentBorder ?? (isPinned ? 'rgba(245,158,11,0.25)' : undefined),
                    backgroundImage: pConfig.accent
                      ? `radial-gradient(circle at 0% 0%, ${pConfig.accent}, transparent 42%)`
                      : undefined,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />
                  <div className="pointer-events-none absolute -right-20 -top-24 h-44 w-44 rounded-full bg-amber-200/0 blur-3xl transition-colors duration-300 group-hover:bg-amber-200/35 dark:group-hover:bg-amber-500/10" />
                  <div className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-amber-300 via-orange-400 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="relative">
                    {/* Pinned bar */}
                    {isPinned && (
                      <div className="flex items-center gap-1.5 px-5 pt-4 pb-0">
                        <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Pinned notice</span>
                      </div>
                    )}

                    {/* Main clickable body */}
                    <button className="w-full text-left" onClick={() => navigate(`/announcements/${a.id}`)}>
                      <div className={`grid gap-4 px-5 py-4 sm:items-start sm:px-6 sm:py-5 ${thumbnail ? 'sm:grid-cols-[auto_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'}`}>
                        {thumbnail && (
                          <div className="relative h-32 overflow-hidden rounded-[1.35rem] bg-gray-100 shadow-inner ring-1 ring-black/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06] sm:h-24 sm:w-32 lg:h-28 lg:w-40">
                            <img src={thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-white/10" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {a.priority !== 'normal' && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${pConfig.badge}`}>
                                {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
                                {pConfig.label}
                              </span>
                            )}
                            {isLeadersOnly && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/[0.12] dark:text-emerald-300 dark:ring-emerald-500/20">
                                <Lock className="h-3 w-3" /> Leaders
                              </span>
                            )}
                            {isUnread && (
                              <span className="inline-flex items-center rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_20px_-12px_rgba(14,165,233,0.85)]">New</span>
                            )}
                          </div>
                          <div className="flex items-start gap-2">
                            <p className="text-[1.05rem] font-black leading-tight text-gray-950 dark:text-white sm:text-[1.15rem]" style={{ letterSpacing: '-0.035em' }}>
                              {a.title}
                            </p>
                          </div>
                          <p className="mt-2 text-[13px] leading-relaxed text-gray-500/90 line-clamp-3 dark:text-white/44 sm:line-clamp-2">
                            <FormattedText text={getPreviewText(a)} />
                          </p>
                        </div>

                        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-300 transition-all group-hover:bg-amber-50 group-hover:text-amber-600 dark:bg-white/[0.035] dark:text-white/22 dark:group-hover:bg-amber-500/[0.12] dark:group-hover:text-amber-300 sm:flex">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    {/* Reaction row */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-black/[0.045] bg-gray-50/55 px-5 pb-4 pt-3 dark:border-white/[0.055] dark:bg-black/10 sm:px-6">
                      <div className="mr-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-400 dark:text-white/30">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Avatar src={a.profiles?.avatar_url} firstName={a.profiles?.first_name || '?'} lastName={a.profiles?.last_name} size="xs" />
                          <span className="truncate font-semibold text-gray-500 dark:text-white/45">{a.profiles?.first_name}</span>
                        </div>
                        <span className="font-mono whitespace-nowrap">{format(parseISO(a.created_at), 'MMM d')}</span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Eye className="h-3 w-3" />{viewCount}
                        </span>
                        {commentCount > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <MessageCircle className="h-3 w-3" />{commentCount}
                          </span>
                        )}
                      </div>
                      {reactionGroups.map(r => (
                        <button
                          key={r.emoji}
                          onClick={e => handleReact(e, a.id, r.emoji)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.95] ${
                            r.users.includes(user?.id || '')
                              ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/[0.15] dark:text-amber-300 dark:ring-amber-500/30'
                              : 'bg-white text-gray-600 shadow-sm ring-1 ring-black/[0.04] hover:bg-gray-100 dark:bg-white/[0.055] dark:text-white/50 dark:ring-white/[0.05] dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          {r.emoji} <span>{r.count}</span>
                        </button>
                      ))}

                      <div className="relative">
                        <button
                          onClick={e => { e.stopPropagation(); setEmojiPickerId(emojiPickerId === a.id ? null : a.id); }}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-gray-400 shadow-sm ring-1 ring-black/[0.04] transition-colors hover:bg-gray-100 dark:bg-white/[0.055] dark:text-white/35 dark:ring-white/[0.05] dark:hover:bg-white/[0.08]"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                        <AnimatePresence>
                          {emojiPickerId === a.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 4 }}
                              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute bottom-full left-0 mb-1.5 flex items-center gap-1 p-2 rounded-2xl bg-white dark:bg-[#232325] shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] z-20"
                            >
                              {QUICK_EMOJIS.map(e => (
                                <button key={e} onClick={ev => handleReact(ev, a.id, e)} className="text-lg hover:scale-125 transition-transform px-0.5">{e}</button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {isLeader && (
                        <button
                          onClick={e => handlePin(e, a)}
                          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-all ${
                            isPinned
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/[0.15] dark:text-amber-300'
                              : 'bg-white text-gray-400 shadow-sm ring-1 ring-black/[0.04] hover:bg-amber-50 hover:text-amber-700 dark:bg-white/[0.055] dark:ring-white/[0.05] dark:hover:bg-amber-500/[0.12]'
                          }`}
                        >
                          <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-amber-500' : ''}`} />
                          {isPinned ? 'Pinned' : 'Pin'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Announcement" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="input-field" required />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
              <Select value={formPriority} onChange={v => setFormPriority(v as 'normal' | 'high' | 'urgent')} options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visibility</label>
              <button type="button" onClick={() => setFormLeadersOnly(s => !s)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${formLeadersOnly ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
              >
                <Lock className="h-4 w-4" />{formLeadersOnly ? 'Leaders Only' : 'All Members'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Content</label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Format: **bold**, *italic*, ~~strikethrough~~, `code`, @mention</p>
            <div className="space-y-3">
              {contentBlocks.map((block, index) => (
                <div key={index} className="relative group">
                  {block.type === 'text' ? (
                    <div className="relative">
                      <MentionTextarea
                        value={block.content}
                        onChange={v => setContentBlocks(prev => prev.map((b, i) => i === index ? { ...b, content: v } : b))}
                        className="input-field min-h-[180px] pr-8"
                        placeholder="Write something… (type @ to mention someone)"
                        rows={7}
                      />
                      {contentBlocks.length > 1 && (
                        <button type="button" onClick={() => setContentBlocks(prev => prev.filter((_, i) => i !== index))} className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"><X className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                      <img src={block.content} alt="" className="w-full max-h-60 object-contain bg-gray-100 dark:bg-gray-800" />
                      <button type="button" onClick={() => setContentBlocks(prev => prev.filter((_, i) => i !== index))} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => setContentBlocks(prev => [...prev, { type: 'text', content: '' }])} className="btn-ghost text-xs"><Type className="h-3.5 w-3.5" /> Add Text</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost text-xs"><Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Add Photo'}</button>
            <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading} className="btn-ghost text-xs"><Camera className="h-3.5 w-3.5" /> Take Photo</button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileSelect(e.target.files)} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Posting…' : 'Post Announcement'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
