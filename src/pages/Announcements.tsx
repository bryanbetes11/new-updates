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

function emptyListResponse() {
  return { data: [], error: null, count: null, status: 200, statusText: 'OK' };
}

const QUICK_EMOJIS = ['👍', '❤️', '🙏', '🔥', '😂', '✅'];
type NewsFilter = 'all' | 'unread' | 'pinned' | 'urgent';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches);
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('all');

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
    setLoadError(null);
    try {
      const [announcementsRes, pinsRes] = await Promise.all([
        withRequestTimeout(
          supabase
            .from('announcements')
            .select(`*, profiles!announcements_created_by_fkey(first_name, last_name, avatar_url), announcement_views(user_id), announcement_comments(id), announcement_reactions(id, user_id, emoji)`)
            .order('created_at', { ascending: false }),
          emptyListResponse(),
          'Announcements list',
        ),
        withRequestTimeout(
          supabase
            .from('announcement_pins')
            .select('id, announcement_id, pinned_by, pinned_at'),
          emptyListResponse(),
          'Announcement pins',
        ),
      ]);

      if (announcementsRes.error) {
        console.error('Fetch announcements error:', announcementsRes.error);
        setLoadError('Announcements could not be loaded. Check your connection and try again.');
      }
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
      setLoadError('Announcements could not be loaded. Check your connection and try again.');
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

  const visibleAnnouncements = announcements.filter(a => {
    if (!isLeader && (a as AnnouncementWithBlocks).is_leaders_only) return false;
    return true;
  });

  const visibleUnreadCount = visibleAnnouncements.filter(a => user && !a.announcement_views?.some(v => v.user_id === user.id)).length;
  const pinnedCount = visibleAnnouncements.filter(a => (a.announcement_pins?.length || 0) > 0).length;
  const urgentCount = visibleAnnouncements.filter(a => a.priority === 'urgent').length;
  const filtered = visibleAnnouncements.filter(a => {
    if (newsFilter === 'unread') return Boolean(user && !a.announcement_views?.some(v => v.user_id === user.id));
    if (newsFilter === 'pinned') return (a.announcement_pins?.length || 0) > 0;
    if (newsFilter === 'urgent') return a.priority === 'urgent';
    return true;
  });
  const pinned = filtered.filter(a => (a.announcement_pins?.length || 0) > 0);
  const unpinned = filtered.filter(a => (a.announcement_pins?.length || 0) === 0);
  const sortedFiltered = [...pinned, ...unpinned];
  const filterOptions: { id: NewsFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: visibleAnnouncements.length },
    { id: 'unread', label: 'Unread', count: visibleUnreadCount },
    { id: 'pinned', label: 'Pinned', count: pinnedCount },
    { id: 'urgent', label: 'Urgent', count: urgentCount },
  ];

  const getPreviewText = (a: AnnouncementWithBlocks) => {
    const blocks = a.content_blocks;
    const text = blocks && blocks.length > 0 ? blocks.find(b => b.type === 'text')?.content || '' : a.content;
    return text.replace(/\s+/g, ' ').trim();
  };

  const firstImageUrl = (a: AnnouncementWithBlocks) => a.content_blocks?.find(b => b.type === 'image')?.content || null;

  if (loading) return <div className="page-container"><AnnouncementsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#050505]" />
      <div className="relative max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-6 space-y-5 sm:space-y-6">

        <motion.div
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterOptions.map(option => {
              const active = newsFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setNewsFilter(option.id)}
                  className={`inline-flex h-11 shrink-0 items-center gap-3 rounded-full px-5 text-sm font-black transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-[#1ed760] text-black shadow-[0_14px_34px_-20px_rgba(30,215,96,0.9)]'
                      : 'bg-white/[0.095] text-white/82 hover:bg-white/[0.14]'
                  }`}
                >
                  <span>{option.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? 'bg-black/10 text-black' : 'bg-white/[0.09] text-white/62'}`}>
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>

          {isLeader && (
            <button
              type="button"
              onClick={openCreateAnnouncement}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.095] px-5 text-[13px] font-black text-white transition-all hover:bg-[#1ed760] hover:text-black active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" /> Post update
            </button>
          )}
        </motion.div>

        {/* ── List ─────────────────────────────────────── */}
        {loadError && announcements.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title="News is unavailable"
            description={loadError}
            action={
              <button type="button" onClick={fetchAnnouncements} className="btn-primary min-h-11">
                Try again
              </button>
            }
          />
        ) : sortedFiltered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No announcements"
            description="Be the first to share something with the team."
            action={isLeader ? <button type="button" onClick={openCreateAnnouncement} className="btn-primary min-h-11"><Plus className="h-4 w-4" /> Post Announcement</button> : undefined}
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="overflow-hidden border-y border-white/[0.08]"
          >
            {sortedFiltered.map((a) => {
              const viewCount = a.announcement_views?.length || 0;
              const commentCount = a.announcement_comments?.length || 0;
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
                  className="group relative border-b border-white/[0.075] transition-colors duration-200 last:border-b-0 hover:bg-white/[0.045]"
                >
                  {(isPinned || a.priority !== 'normal') && (
                    <div
                      className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full"
                      style={{ backgroundColor: a.priority === 'urgent' ? '#ef4444' : isPinned ? '#1ed760' : '#f59e0b' }}
                    />
                  )}

                  <div className="relative">
                    {/* Main clickable body */}
                    <button type="button" className="w-full text-left" onClick={() => navigate(`/announcements/${a.id}`)}>
                      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:px-5 lg:px-6">
                        <div className="flex items-start gap-3 sm:contents">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[linear-gradient(135deg,rgba(30,215,96,0.36),rgba(245,158,11,0.24)),#181818] ring-1 ring-white/[0.08] sm:h-20 sm:w-20">
                            {thumbnail ? (
                              <>
                                <img src={thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
                              </>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#1ed760]">
                                <Megaphone className="h-6 w-6" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isPinned && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#1ed760]">
                                  <Pin className="h-3 w-3 fill-[#1ed760]" /> Pinned
                                </span>
                              )}
                              {a.priority !== 'normal' && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${pConfig.badge}`}>
                                  {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
                                  {pConfig.label}
                                </span>
                              )}
                              {isLeadersOnly && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.12] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300 ring-1 ring-emerald-500/20">
                                  <Lock className="h-3 w-3" /> Leaders
                                </span>
                              )}
                              {isUnread && (
                                <span className="inline-flex items-center rounded-full bg-[#1ed760] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-black">New</span>
                              )}
                            </div>
                            <p className="mt-1.5 text-[1rem] font-black leading-tight text-white sm:text-[1.12rem]">
                              {a.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/48 sm:line-clamp-1">
                              {getPreviewText(a)}
                            </p>
                            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-white/32">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Avatar src={a.profiles?.avatar_url} firstName={a.profiles?.first_name || '?'} lastName={a.profiles?.last_name} size="xs" />
                                <span className="truncate text-white/48">{a.profiles?.first_name}</span>
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
                          </div>
                        </div>

                        <div className="hidden items-center gap-2 justify-self-end text-white/26 sm:flex">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-0 transition-opacity group-hover:opacity-100">
                            Open
                          </span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    {/* Reaction row */}
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-4 sm:px-5 lg:px-6">
                      {reactionGroups.map(r => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={e => handleReact(e, a.id, r.emoji)}
                          className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-bold transition-all active:scale-[0.95] ${
                            r.users.includes(user?.id || '')
                              ? 'bg-[#1ed760]/20 text-[#7cffaa] ring-1 ring-[#1ed760]/30'
                              : 'bg-white/[0.055] text-white/52 ring-1 ring-white/[0.05] hover:bg-white/[0.09]'
                          }`}
                          aria-label={`${r.users.includes(user?.id || '') ? 'Remove' : 'Add'} ${r.emoji} reaction. ${r.count} total`}
                          aria-pressed={r.users.includes(user?.id || '')}
                        >
                          {r.emoji} <span>{r.count}</span>
                        </button>
                      ))}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setEmojiPickerId(emojiPickerId === a.id ? null : a.id); }}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.055] text-xs text-white/35 ring-1 ring-white/[0.05] transition-colors hover:bg-white/[0.09]"
                          aria-label="Add a reaction"
                          aria-expanded={emojiPickerId === a.id}
                          aria-haspopup="menu"
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
                              className="absolute bottom-full left-0 z-20 mb-1.5 flex items-center gap-1 rounded-2xl bg-[#232325] p-2 shadow-xl ring-1 ring-white/[0.08]"
                              role="menu"
                            >
                              {QUICK_EMOJIS.map(e => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={ev => handleReact(ev, a.id, e)}
                                  className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-transform hover:scale-110 hover:bg-white/[0.08]"
                                  aria-label={`React with ${e}`}
                                  role="menuitem"
                                >
                                  {e}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {isLeader && (
                        <button
                          type="button"
                          onClick={e => handlePin(e, a)}
                          className={`ml-auto inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-black transition-all ${
                            isPinned
                              ? 'bg-[#1ed760]/20 text-[#7cffaa]'
                              : 'bg-white/[0.055] text-white/42 ring-1 ring-white/[0.05] hover:bg-white/[0.09] hover:text-white/70'
                          }`}
                          aria-pressed={isPinned}
                          aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${a.title}`}
                        >
                          <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-[#1ed760]' : ''}`} />
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
      <Modal open={showCreate && isDesktop} onClose={() => setShowCreate(false)} title="Creating Announcement" size="lg">
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
