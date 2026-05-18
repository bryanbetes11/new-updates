import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Megaphone, Plus, Eye, AlertTriangle, AlertCircle,
  Pin, Lock, MessageCircle, Smile, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { AnnouncementsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Avatar } from '../components/Avatar';
import { AnnouncementComposerForm } from '../components/AnnouncementComposerForm';
import type { Announcement, AnnouncementReaction, AnnouncementPin } from '../types';
import { withRequestTimeout } from '../lib/requestTimeout';

type AnnouncementWithBlocks = Announcement & {
  content_blocks?: { type: 'text' | 'image'; content: string }[];
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
  const [showCreate, setShowCreate] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches);
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('allow-native-pull-refresh');
    return () => {
      document.body.classList.remove('allow-native-pull-refresh');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const openCreateAnnouncement = () => {
    const shouldUseDesktopModal = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

    if (shouldUseDesktopModal) {
      setShowCreate(true);
      return;
    }

    setShowCreate(false);
    navigate('/announcements/new');
  };

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
    return true;
  });

  const pinned = filtered.filter(a => (a.announcement_pins?.length || 0) > 0);
  const unpinned = filtered.filter(a => (a.announcement_pins?.length || 0) === 0);
  const sortedFiltered = [...pinned, ...unpinned];
  const visibleUnreadCount = filtered.filter(a => user && !a.announcement_views?.some(v => v.user_id === user.id)).length;
  const urgentCount = filtered.filter(a => a.priority === 'urgent').length;
  const latestAnnouncement = sortedFiltered[0];

  const getPreviewText = (a: AnnouncementWithBlocks) => {
    const blocks = a.content_blocks;
    const text = blocks && blocks.length > 0 ? blocks.find(b => b.type === 'text')?.content || '' : a.content;
    return text.replace(/\s+/g, ' ').trim();
  };

  const firstImageUrl = (a: AnnouncementWithBlocks) => a.content_blocks?.find(b => b.type === 'image')?.content || null;

  if (loading) return <div className="page-container"><AnnouncementsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad relative overflow-hidden bg-[#f6f4ef] text-gray-900 dark:bg-[#121212] dark:text-white">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#f6f4ef] dark:bg-[#121212]"
      />
      <div className="relative max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-6 space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.28),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(251,191,36,0.18),transparent_36%),linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(146,64,14,0.65)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(135deg,#1c1307_0%,#10100d_46%,#070807_100%)] sm:p-6"
        >
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
                <div key={stat.label} className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
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
                onClick={openCreateAnnouncement}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black text-white shadow-[0_12px_28px_-16px_rgba(180,83,9,0.9)] transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <Plus className="h-3.5 w-3.5" /> Post update
              </button>
            )}
          </div>
        </motion.div>

        {/* ── List ─────────────────────────────────────── */}
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No announcements"
            description="Be the first to share something with the team."
            action={isLeader ? <button onClick={openCreateAnnouncement} className="btn-primary"><Plus className="h-4 w-4" /> Post Announcement</button> : undefined}
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
                          <p className="mt-1.5 truncate text-[13px] leading-5 text-gray-500/90 dark:text-white/44">
                            {getPreviewText(a)}
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
      <Modal open={showCreate && isDesktop} onClose={() => setShowCreate(false)} title="New Announcement" size="lg">
        <AnnouncementComposerForm
          onCancel={() => setShowCreate(false)}
          onSuccess={async () => {
            setShowCreate(false);
            await fetchAnnouncements();
          }}
        />
      </Modal>
    </div>
  );
}
