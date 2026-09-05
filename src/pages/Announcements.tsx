import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Megaphone, Plus, Eye, AlertTriangle, AlertCircle,
  Pin, Lock, MessageCircle, Smile, ChevronRight, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { AnnouncementsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Avatar } from '../components/Avatar';
import { AnnouncementComposerForm } from '../components/AnnouncementComposerForm';
import { EmojiReactionPicker, type ReactionEmoji } from '../components/EmojiReactionPicker';
import { ReactionFlightAnimation } from '../components/ReactionFlightAnimation';
import type { Announcement, AnnouncementReaction, AnnouncementPin, AnnouncementView } from '../types';
import { withRequestTimeout } from '../lib/requestTimeout';
import { groupEmojiReactions } from '../lib/reactions';
import { playInteractionSound } from '../lib/interactionSounds';

type AnnouncementWithBlocks = Announcement & {
  content_blocks?: { type: 'text' | 'image'; content: string }[];
  is_leaders_only?: boolean;
  announcement_reactions?: AnnouncementReaction[];
  announcement_pins?: AnnouncementPin[];
};

function emptyListResponse() {
  return { data: [], error: null, count: null, status: 200, statusText: 'OK' };
}

type NewsFilter = 'all' | 'unread' | 'pinned' | 'urgent';

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

type ReactionFlight = {
  announcementId: string;
  emoji: string;
  token: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export function Announcements() {
  const { user, isLeader } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [announcements, setAnnouncements] = useState<AnnouncementWithBlocks[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const [reactionCelebration, setReactionCelebration] = useState<ReactionFlight | null>(null);
  const [pendingReactionReveal, setPendingReactionReveal] = useState<{ announcementId: string; emoji: string } | null>(null);
  const [reactionLanding, setReactionLanding] = useState<{ announcementId: string; emoji: string; token: number } | null>(null);
  const reactionMutationsRef = useRef(new Set<string>());
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('all');
  const [viewerAnnouncement, setViewerAnnouncement] = useState<Pick<Announcement, 'id' | 'title'> | null>(null);
  const [announcementViewers, setAnnouncementViewers] = useState<AnnouncementView[]>([]);
  const [loadingAnnouncementViewers, setLoadingAnnouncementViewers] = useState(false);

  const openCreateAnnouncement = () => {
    const shouldUseDesktopModal = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

    if (shouldUseDesktopModal) {
      setShowCreate(true);
      return;
    }

    setShowCreate(false);
    navigate('/announcements/new');
  };

  useEffect(() => {
    const state = location.state as { openModal?: string } | null;
    if (state?.openModal !== 'announce') return;
    setShowCreate(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_views' }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAnnouncements]);

  const handleToggleReactionPicker = (event: React.MouseEvent<HTMLButtonElement>, announcementId: string) => {
    event.stopPropagation();
    const shouldOpen = emojiPickerId !== announcementId;
    const card = event.currentTarget.closest('[data-announcement-card]');
    setEmojiPickerId(shouldOpen ? announcementId : null);
    if (shouldOpen) playInteractionSound('reactionOpen');

    if (shouldOpen && card) {
      window.requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const handleReact = async (announcementId: string, emoji: string, sourceElement?: HTMLElement) => {
    if (!user) return;
    if (reactionMutationsRef.current.has(announcementId)) return;

    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) return;

    reactionMutationsRef.current.add(announcementId);
    const previousReactions = announcement.announcement_reactions || [];
    const existing = announcement?.announcement_reactions?.find(r => r.user_id === user.id && r.emoji === emoji);
    const optimisticId = `optimistic-${announcementId}-${user.id}-${emoji}`;
    const card = sourceElement?.closest<HTMLElement>('[data-announcement-card]') || null;
    const cardRect = card?.getBoundingClientRect();
    const sourceRect = sourceElement?.getBoundingClientRect();
    const flightOrigin = cardRect && sourceRect
      ? { x: sourceRect.left - cardRect.left + sourceRect.width / 2, y: sourceRect.top - cardRect.top + sourceRect.height / 2 }
      : null;
    const shouldAnimateFlight = !existing && !prefersReducedMotion && Boolean(card && flightOrigin);

    if (shouldAnimateFlight) {
      setPendingReactionReveal({ announcementId, emoji });
    }

    setAnnouncements(current => current.map(item => {
      if (item.id !== announcementId) return item;
      return {
        ...item,
        announcement_reactions: existing
          ? (item.announcement_reactions || []).filter(reaction => reaction.id !== existing.id)
          : [
              ...(item.announcement_reactions || []),
              {
                id: optimisticId,
                announcement_id: announcementId,
                user_id: user.id,
                emoji,
                created_at: new Date().toISOString(),
              },
            ],
      };
    }));

    if (shouldAnimateFlight && card && flightOrigin) {
      window.requestAnimationFrame(() => {
        const target = Array.from(card.querySelectorAll<HTMLElement>('[data-reaction-emoji]'))
          .find(element => element.dataset.reactionEmoji === emoji);
        if (!target) {
          setPendingReactionReveal(null);
          setEmojiPickerId(null);
          return;
        }
        const currentCardRect = card.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        setReactionCelebration({
          announcementId,
          emoji,
          token: Date.now(),
          from: flightOrigin,
          to: {
            x: targetRect.left - currentCardRect.left + targetRect.width / 2,
            y: targetRect.top - currentCardRect.top + targetRect.height / 2,
          },
        });
      });
    }

    if (!shouldAnimateFlight) setEmojiPickerId(null);
    try {
      const { data, error } = existing
        ? await supabase
            .from('announcement_reactions')
            .delete()
            .eq('id', existing.id)
            .select('id')
            .maybeSingle()
        : await supabase
            .from('announcement_reactions')
            .insert({ announcement_id: announcementId, user_id: user.id, emoji })
            .select('id, announcement_id, user_id, emoji, created_at')
            .single();

      if (error || (existing && !data)) {
        throw error || new Error('The reaction was not removed.');
      }

      if (!existing && data) {
        setAnnouncements(current => current.map(item => item.id === announcementId
          ? {
              ...item,
              announcement_reactions: (item.announcement_reactions || []).map(reaction =>
                reaction.id === optimisticId ? data as AnnouncementReaction : reaction
              ),
            }
          : item));
      }
      if (existing) playInteractionSound('reactionRemove');
      else if (!shouldAnimateFlight) playInteractionSound('reactionLand');

    } catch (error) {
      console.error('Update announcement reaction error:', error);
      setReactionCelebration(current => current?.announcementId === announcementId ? null : current);
      setPendingReactionReveal(current => current?.announcementId === announcementId ? null : current);
      setReactionLanding(current => current?.announcementId === announcementId ? null : current);
      setEmojiPickerId(null);
      setAnnouncements(current => current.map(item => item.id === announcementId
        ? { ...item, announcement_reactions: previousReactions }
        : item));
      toast('error', 'Could not update reaction');
    } finally {
      reactionMutationsRef.current.delete(announcementId);
      await fetchAnnouncements();
    }
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

  const handleOpenViewers = async (event: React.MouseEvent, announcement: AnnouncementWithBlocks) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerAnnouncement({ id: announcement.id, title: announcement.title });
    setAnnouncementViewers([]);
    setLoadingAnnouncementViewers(true);

    try {
      const { data, error } = await supabase
        .from('announcement_views')
        .select('announcement_id, user_id, viewed_at, profiles!announcement_views_user_id_fkey(first_name, last_name, avatar_url)')
        .eq('announcement_id', announcement.id)
        .order('viewed_at', { ascending: false });

      if (error) throw error;
      const viewers = (data || []) as unknown as AnnouncementView[];
      setAnnouncementViewers(viewers);
      setAnnouncements(current => current.map(item => (
        item.id === announcement.id ? { ...item, announcement_views: viewers } : item
      )));
    } catch (error) {
      console.error('Fetch announcement viewers error:', error);
      toast('error', 'Could not load who has seen this announcement');
    } finally {
      setLoadingAnnouncementViewers(false);
    }
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
    return text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^\s{0,3}(?:#{1,6}|>|[-+])\s+/gm, '')
      .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  if (loading) return <div className="page-container"><AnnouncementsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#050505]" />
      <div className="app-content-shell relative space-y-4 pb-6 pt-4 sm:pt-5">

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
              <Plus className="h-4 w-4" /> New announcement
            </button>
          )}
        </motion.div>

        {/* ── List ─────────────────────────────────────── */}
        {loadError && announcements.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title="Announcements are unavailable"
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
            className="space-y-1.5"
          >
            {sortedFiltered.map((a) => {
              const viewCount = a.announcement_views?.length || 0;
              const commentCount = a.announcement_comments?.length || 0;
              const isUnread = user && !a.announcement_views?.some(v => v.user_id === user.id);
              const isPinned = (a.announcement_pins?.length || 0) > 0;
              const isLeadersOnly = (a as AnnouncementWithBlocks).is_leaders_only;
              const isAwaitingReactionLanding = pendingReactionReveal?.announcementId === a.id;
              const visibleReactions = isAwaitingReactionLanding
                ? (a.announcement_reactions || []).filter(reaction => !(
                    reaction.user_id === user?.id && reaction.emoji === pendingReactionReveal.emoji
                  ))
                : (a.announcement_reactions || []);
              const reactionGroups = groupEmojiReactions(visibleReactions);
              const needsLandingPlaceholder = Boolean(
                isAwaitingReactionLanding
                && !reactionGroups.some(reaction => reaction.emoji === pendingReactionReveal?.emoji)
              );
              const pConfig = PRIORITY_CONFIG[a.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
              const PriorityIcon = pConfig.icon;
              const hasStatus = isPinned || a.priority !== 'normal' || isLeadersOnly || isUnread;

              return (
                <motion.div
                  key={a.id}
                  data-announcement-card
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`group relative overflow-hidden rounded-xl border bg-[linear-gradient(135deg,#121212_0%,#0e0e0e_72%)] shadow-[0_16px_38px_-32px_rgba(0,0,0,0.95)] transition-[border-color,background-color,box-shadow] duration-300 hover:shadow-[0_22px_46px_-30px_rgba(0,0,0,0.98)] ${
                    emojiPickerId === a.id
                      ? 'border-[#1ed760]/55 ring-1 ring-[#1ed760]/25 shadow-[0_22px_48px_-28px_rgba(30,215,96,0.28)]'
                      : 'border-white/[0.075] hover:border-white/[0.15] focus-within:border-white/[0.18]'
                  }`}
                >
                  {(isPinned || a.priority !== 'normal') && (
                    <div
                      className="absolute bottom-3 left-0 top-3 z-10 w-1 rounded-r-full"
                      style={{ backgroundColor: a.priority === 'urgent' ? '#ef4444' : isPinned ? '#1ed760' : '#f59e0b' }}
                    />
                  )}

                  <div className="relative">
                    {/* Main clickable body */}
                    <button
                      type="button"
                      className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1ed760]/75"
                      onClick={() => navigate(`/announcements/${a.id}`)}
                    >
                      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5 sm:py-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {isPinned && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#68e895] sm:text-[10px]">
                                  <Pin className="h-2.5 w-2.5 fill-[#1ed760] sm:h-3 sm:w-3" /> Pinned
                                </span>
                              )}
                              {a.priority !== 'normal' && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px] ${pConfig.badge}`}>
                                  {PriorityIcon && <PriorityIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                                  {pConfig.label}
                                </span>
                              )}
                              {isLeadersOnly && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/46 sm:text-[10px]">
                                  <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Leaders
                                </span>
                              )}
                              {isUnread && (
                                <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#68e895] sm:text-[10px]">
                                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#1ed760] shadow-[0_0_10px_rgba(30,215,96,0.65)]" />
                                  New
                                </span>
                              )}
                            </div>
                            <p className={`${hasStatus ? 'mt-1' : 'mt-0'} text-[0.98rem] font-black leading-[1.18] tracking-[-0.015em] text-white sm:text-[1.04rem]`}>
                              {a.title}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[12px] leading-5 text-white/56 sm:text-[13px]">
                              {getPreviewText(a)}
                            </p>
                            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold text-white/42 sm:mt-2 sm:text-[11px]">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Avatar src={a.profiles?.avatar_url} firstName={a.profiles?.first_name || '?'} lastName={a.profiles?.last_name} size="xs" />
                                <span className="truncate font-bold text-white/62">{a.profiles?.first_name}</span>
                              </div>
                              <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-white/25" />
                              <span className="whitespace-nowrap">{format(parseISO(a.created_at), 'MMM d')}</span>
                              {commentCount > 0 && (
                                <span className="flex items-center gap-1 whitespace-nowrap text-white/48">
                                  <MessageCircle className="h-3 w-3" /> {commentCount}
                                </span>
                              )}
                            </div>
                        </div>

                        <div className="hidden items-center gap-2 justify-self-end text-white/28 transition-colors duration-300 group-hover:translate-x-0.5 group-hover:text-white/65 sm:flex">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-0 transition-opacity group-hover:opacity-100">
                            Open
                          </span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.045] transition-colors group-hover:bg-white/[0.09]">
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {emojiPickerId === a.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden border-t border-[#1ed760]/15 bg-[#1ed760]/[0.035] sm:hidden"
                        >
                          <div className="flex px-3 py-2">
                            <EmojiReactionPicker
                              animateEntrance={!prefersReducedMotion}
                              onPick={(emoji: ReactionEmoji, event) => void handleReact(a.id, emoji, event.currentTarget)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {emojiPickerId === a.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.94, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96, y: 4 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute bottom-[3.25rem] left-3 z-40 hidden origin-bottom-left sm:block"
                        >
                          <EmojiReactionPicker
                            animateEntrance={!prefersReducedMotion}
                            onPick={(emoji: ReactionEmoji, event) => void handleReact(a.id, emoji, event.currentTarget)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reaction row */}
                    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto border-t border-white/[0.055] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
                      {reactionGroups.map(r => {
                        const isLanding = reactionLanding?.announcementId === a.id && reactionLanding.emoji === r.emoji;
                        return (
                        <motion.button
                          key={r.emoji}
                          type="button"
                          layout
                          initial={isLanding ? { scale: 0.72, opacity: 0.35 } : false}
                          animate={isLanding
                            ? { scale: [0.72, 1.16, 0.96, 1], opacity: [0.35, 1, 1, 1] }
                            : { scale: 1, opacity: 1 }}
                          transition={isLanding
                            ? { duration: 0.36, times: [0, 0.48, 0.72, 1], ease: [0.16, 1, 0.3, 1] }
                            : { duration: 0.16 }}
                          onClick={() => void handleReact(a.id, r.emoji)}
                          data-reaction-emoji={r.emoji}
                          className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold transition-all active:scale-[0.95] sm:h-9 ${
                            r.users.includes(user?.id || '')
                              ? 'bg-[#1ed760]/20 text-[#7cffaa] ring-1 ring-[#1ed760]/30'
                              : 'bg-white/[0.055] text-white/60 ring-1 ring-white/[0.06] hover:bg-white/[0.1] hover:text-white/80'
                          }`}
                          aria-label={`${r.users.includes(user?.id || '') ? 'Remove' : 'Add'} ${r.emoji} reaction. ${r.count} total`}
                          aria-pressed={r.users.includes(user?.id || '')}
                        >
                          {r.emoji} <span>{r.count}</span>
                        </motion.button>
                      );
                      })}

                      {needsLandingPlaceholder && pendingReactionReveal && (
                        <span
                          aria-hidden="true"
                          data-reaction-emoji={pendingReactionReveal.emoji}
                          className="invisible inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold sm:h-9"
                        >
                          {pendingReactionReveal.emoji} <span>1</span>
                        </span>
                      )}

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={event => handleToggleReactionPicker(event, a.id)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.055] text-xs text-white/42 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.1] hover:text-white/70 sm:h-9 sm:w-9"
                          aria-label="Add a reaction"
                          aria-expanded={emojiPickerId === a.id}
                          aria-haspopup="menu"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
                        <button
                          type="button"
                          onClick={event => void handleOpenViewers(event, a)}
                          className="inline-flex h-11 min-w-12 items-center justify-center gap-1.5 rounded-full bg-white/[0.065] px-3 text-xs font-bold text-white/65 ring-1 ring-white/[0.07] transition-all hover:bg-white/[0.11] hover:text-white active:scale-[0.95] sm:h-9"
                          aria-label={`View who has seen ${a.title} (${viewCount} total)`}
                        >
                          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>{viewCount}</span>
                        </button>

                        {isLeader && (
                          <button
                            type="button"
                            onClick={e => handlePin(e, a)}
                            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-black transition-all sm:h-9 ${
                              isPinned
                                ? 'bg-[#1ed760]/20 text-[#7cffaa]'
                                : 'bg-white/[0.065] text-white/58 ring-1 ring-white/[0.07] hover:bg-white/[0.11] hover:text-white/82'
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

                    <AnimatePresence>
                      {reactionCelebration?.announcementId === a.id && (
                        <ReactionFlightAnimation
                          key={reactionCelebration.token}
                          flight={reactionCelebration}
                          onComplete={() => {
                            const landing = {
                              announcementId: reactionCelebration.announcementId,
                              emoji: reactionCelebration.emoji,
                              token: reactionCelebration.token,
                            };
                            setPendingReactionReveal(current => current?.announcementId === landing.announcementId ? null : current);
                            setReactionLanding(landing);
                            setReactionCelebration(current => current?.token === reactionCelebration.token ? null : current);
                            setEmojiPickerId(current => current === a.id ? null : current);
                            playInteractionSound('reactionLand');
                            window.setTimeout(() => {
                              setReactionLanding(current => current?.token === landing.token ? null : current);
                            }, 420);
                          }}
                        />
                      )}
                    </AnimatePresence>

                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <Modal
        open={Boolean(viewerAnnouncement)}
        onClose={() => {
          setViewerAnnouncement(null);
          setAnnouncementViewers([]);
        }}
        title="Who Read This"
        size="sm"
        mobileView="dialog"
      >
        <div className="space-y-3">
          {viewerAnnouncement && (
            <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-gray-500 dark:text-white/45">
              {viewerAnnouncement.title}
            </p>
          )}

          {loadingAnnouncementViewers ? (
            <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-sm text-gray-500 dark:text-white/45">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Loading readers…
            </div>
          ) : announcementViewers.length === 0 ? (
            <div className="py-7 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.05] dark:text-white/30">
                <Eye aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-gray-800 dark:text-white/80">No readers yet</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-white/40">No one has seen this announcement yet.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-white/45">
                {announcementViewers.length === 1
                  ? '1 person has seen this announcement.'
                  : `${announcementViewers.length} people have seen this announcement.`}
              </p>
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {announcementViewers.map(viewer => {
                  const viewerName = `${viewer.profiles?.first_name || ''} ${viewer.profiles?.last_name || ''}`.trim() || 'Team member';
                  return (
                    <div key={viewer.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                      <Avatar
                        src={viewer.profiles?.avatar_url}
                        firstName={viewer.profiles?.first_name || '?'}
                        lastName={viewer.profiles?.last_name}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {viewerName}{viewer.user_id === user?.id ? ' (You)' : ''}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-white/35">
                          {format(parseISO(viewer.viewed_at), 'MMM d, yyyy · h:mm a')}
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

      {/* ── Create Modal ──────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New announcement" size="lg">
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
