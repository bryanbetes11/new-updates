import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Eye, MessageCircle, Send,
  AlertTriangle, AlertCircle, Image, Pencil, Trash2, MoreVertical, Lock,
  CornerDownRight, X, ChevronLeft, Megaphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { Avatar } from '../components/Avatar';
import { FormattedText } from '../components/FormattedText';
import { MentionTextarea } from '../components/MentionTextarea';
import type { Announcement, AnnouncementComment, AnnouncementView } from '../types';

interface ContentBlock {
  type: 'text' | 'image';
  content: string;
}

type AnnouncementWithBlocks = Announcement & {
  content_blocks?: ContentBlock[];
  is_leaders_only?: boolean;
};

const PRIORITY_CONFIG = {
  urgent: {
    badge: 'bg-red-50 dark:bg-red-500/[0.12] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25',
    accent: 'rgba(239,68,68,0.13)',
    accentBorder: 'rgba(239,68,68,0.22)',
    eyebrow: 'text-red-600 dark:text-red-400',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    label: 'Urgent',
  },
  high: {
    badge: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25',
    accent: 'rgba(245,158,11,0.10)',
    accentBorder: 'rgba(245,158,11,0.22)',
    eyebrow: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'High',
  },
  normal: {
    badge: '',
    accent: null as string | null,
    accentBorder: null as string | null,
    eyebrow: 'text-amber-600 dark:text-amber-400/80',
    icon: null,
    iconColor: '',
    label: 'Normal',
  },
};

interface SwipeState {
  startX: number;
  currentX: number;
  swiping: boolean;
}

function CommentItem({
  comment,
  replies,
  user,
  editingCommentId,
  editCommentContent,
  setEditCommentContent,
  savingComment,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isReply,
}: {
  comment: AnnouncementComment;
  replies: AnnouncementComment[];
  user: { id: string } | null;
  editingCommentId: string | null;
  editCommentContent: string;
  setEditCommentContent: (v: string) => void;
  savingComment: boolean;
  onReply: (c: AnnouncementComment) => void;
  onEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const swipeRef = useRef<SwipeState>({ startX: 0, currentX: 0, swiping: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const isOwn = user?.id === comment.user_id;
  const REVEAL_THRESHOLD = 72;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isOwn) return;
    swipeRef.current = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX, swiping: true };
  }, [isOwn]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current.swiping || !isOwn) return;
    const dx = swipeRef.current.startX - e.touches[0].clientX;
    swipeRef.current.currentX = e.touches[0].clientX;
    if (dx > 0) {
      setSwipeOffset(Math.min(dx, REVEAL_THRESHOLD));
    } else if (revealed) {
      setSwipeOffset(Math.max(REVEAL_THRESHOLD + dx, 0));
    }
  }, [isOwn, revealed]);

  const handleTouchEnd = useCallback(() => {
    if (!isOwn) return;
    swipeRef.current.swiping = false;
    if (swipeOffset >= REVEAL_THRESHOLD * 0.6) {
      setSwipeOffset(REVEAL_THRESHOLD);
      setRevealed(true);
    } else {
      setSwipeOffset(0);
      setRevealed(false);
    }
  }, [isOwn, swipeOffset]);

  const closeSwipe = () => {
    setSwipeOffset(0);
    setRevealed(false);
  };

  return (
    <div className={`relative ${isReply ? '' : 'border-b border-black/[0.03] dark:border-white/[0.04] last:border-0'}`}>
      <div className="overflow-hidden">
        <div
          ref={containerRef}
          className="relative transition-transform duration-150 ease-out"
          style={{ transform: `translateX(-${swipeOffset}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={`flex items-start gap-3 ${isReply ? 'px-5 pl-14 py-3' : 'px-5 py-4'} hover:bg-gray-50/40 dark:hover:bg-white/[0.01] transition-colors relative`}>
            {isOwn && editingCommentId !== comment.id && !revealed && (
              <div className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 dark:text-gray-600">
                <ChevronLeft className="h-3 w-3" />
              </div>
            )}
            <Avatar
              src={comment.profiles?.avatar_url}
              firstName={comment.profiles?.first_name || '?'}
              lastName={comment.profiles?.last_name}
              size={isReply ? 'xs' : 'sm'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                  {comment.profiles?.first_name} {comment.profiles?.last_name}
                </p>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{format(parseISO(comment.created_at), 'MMM d, h:mm a')}</span>
                <div className="ml-auto flex items-center gap-2">
                  {editingCommentId !== comment.id && (
                    <button
                      type="button"
                      onClick={() => onReply(comment)}
                      className="text-[11px] text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 transition-colors"
                    >
                      <CornerDownRight className="h-3 w-3" /> Reply
                    </button>
                  )}
                  {isOwn && editingCommentId !== comment.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(comment.id, comment.content)}
                        className="hidden sm:flex text-[11px] text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 items-center gap-1 transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(comment.id)}
                        className="hidden sm:flex text-[11px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 items-center gap-1 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>


              {editingCommentId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <MentionTextarea
                    value={editCommentContent}
                    onChange={setEditCommentContent}
                    className="input-field text-sm min-h-[80px] resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(comment.id)}
                      disabled={savingComment}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {savingComment ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <FormattedText text={comment.content} />
                </p>
              )}
            </div>
          </div>
        </div>

        {isOwn && swipeOffset > 0 && (
          <div
            className="absolute right-0 top-0 bottom-0 flex items-stretch"
            style={{ width: REVEAL_THRESHOLD }}
          >
            <button
              type="button"
              onPointerDown={() => { closeSwipe(); onEdit(comment.id, comment.content); }}
              className="flex-1 flex flex-col items-center justify-center bg-brand-500 text-white text-[10px] font-semibold gap-1 active:bg-brand-600 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onPointerDown={() => { closeSwipe(); onDelete(comment.id); }}
              className="flex-1 flex flex-col items-center justify-center bg-red-500 text-white text-[10px] font-semibold gap-1 active:bg-red-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {replies.length > 0 && (
        <div className="bg-gray-50/60 dark:bg-white/[0.015]">
          {replies.map((reply, replyIdx) => {
            const isLast = replyIdx === replies.length - 1;
            return (
            <div key={reply.id} className="relative">
              {/* Vertical part of L: from top down to avatar center (24px = py-3 + half of h-6) */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: '36px',
                  top: 0,
                  height: '24px',
                  width: '1.5px',
                  background: 'rgba(156,163,175,0.3)',
                }}
              />
              {/* Horizontal nub of L */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: '36px',
                  top: '23px',
                  width: '20px',
                  height: '1.5px',
                  background: 'rgba(156,163,175,0.3)',
                }}
              />
              {/* Continuation line for non-last replies */}
              {!isLast && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: '36px',
                    top: '24px',
                    bottom: 0,
                    width: '1.5px',
                    background: 'rgba(156,163,175,0.3)',
                  }}
                />
              )}
              <CommentItem
                comment={reply}
                replies={[]}
                user={user}
                editingCommentId={editingCommentId}
                editCommentContent={editCommentContent}
                setEditCommentContent={setEditCommentContent}
                savingComment={savingComment}
                onReply={onReply}
                onEdit={onEdit}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onDelete={onDelete}
                isReply
              />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState<AnnouncementWithBlocks | null>(null);
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [views, setViews] = useState<AnnouncementView[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<AnnouncementComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [editContentBlocks, setEditContentBlocks] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; avatar_url: string | null } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const loadAnnouncement = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles!announcements_created_by_fkey(first_name, last_name, avatar_url), announcement_views(user_id, viewed_at, profiles!announcement_views_user_id_fkey(first_name, last_name, avatar_url))')
      .eq('id', id!)
      .maybeSingle();
    setAnnouncement(data);
    setViews((data?.announcement_views || []) as AnnouncementView[]);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from('announcement_comments')
      .select('*, profiles!announcement_comments_user_id_fkey(first_name, last_name, avatar_url), reply_comment:reply_to(id, content, user_id, profiles!announcement_comments_user_id_fkey(first_name, last_name, avatar_url))')
      .eq('announcement_id', id!)
      .order('created_at');
    setComments((data || []) as AnnouncementComment[]);
  };

  useEffect(() => {
    if (!id) return;
    const init = async () => {
      await loadAnnouncement();
      setLoading(false);
      if (user) {
        await supabase.from('announcement_views').upsert(
          { announcement_id: id, user_id: user.id },
          { onConflict: 'announcement_id,user_id' }
        );
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) setUserProfile(profile);
      }
    };
    init();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    loadComments();

    const channel = supabase
      .channel(`announcement-comments-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_comments',
          filter: `announcement_id=eq.${id}`,
        },
        () => { loadComments(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleComment = async () => {
    if (!user || !newComment.trim() || !id) return;
    setSubmitting(true);
    const { error } = await supabase.from('announcement_comments').insert({
      announcement_id: id,
      user_id: user.id,
      content: newComment.trim(),
      reply_to: replyingTo?.id ?? null,
    });
    setSubmitting(false);
    if (error) { toast('error', 'Failed to post comment'); return; }
    setNewComment('');
    setReplyingTo(null);
    await loadComments();
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete announcement');
      setDeleting(false);
      return;
    }
    toast('success', 'Announcement deleted');
    navigate('/announcements');
  };

  const handleDeleteComment = async () => {
    if (!deletingCommentId) return;
    const { error } = await supabase.from('announcement_comments').delete().eq('id', deletingCommentId);
    if (error) { toast('error', 'Failed to delete comment'); return; }
    toast('success', 'Comment deleted');
    setShowDeleteCommentConfirm(false);
    setDeletingCommentId(null);
    await loadComments();
  };

  const handleEdit = () => {
    if (!announcement) return;
    setEditTitle(announcement.title);
    setEditPriority(announcement.priority as 'normal' | 'high' | 'urgent');
    setEditContentBlocks(announcement.content_blocks || [{ type: 'text', content: announcement.content }]);
    setShowEdit(true);
    setShowMenu(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('announcements')
      .update({
        title: editTitle.trim(),
        priority: editPriority,
        content_blocks: editContentBlocks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) {
      toast('error', 'Failed to update announcement');
      setSaving(false);
      return;
    }
    toast('success', 'Announcement updated');
    setSaving(false);
    setShowEdit(false);
    await loadAnnouncement();
  };

  const updateEditBlock = (index: number, content: string) => {
    setEditContentBlocks(prev => prev.map((b, i) => i === index ? { ...b, content } : b));
  };

  const removeEditBlock = (index: number) => {
    setEditContentBlocks(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(content);
  };

  const handleSaveComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    setSavingComment(true);
    const { error } = await supabase
      .from('announcement_comments')
      .update({ content: editCommentContent.trim() })
      .eq('id', commentId);
    setSavingComment(false);
    if (error) { toast('error', 'Failed to update comment'); return; }
    toast('success', 'Comment updated');
    setEditingCommentId(null);
    setEditCommentContent('');
    await loadComments();
  };

  const startReply = (comment: AnnouncementComment) => {
    setReplyingTo(comment);
    const mentionHandle = `@${comment.profiles?.first_name}_${comment.profiles?.last_name}`;
    setNewComment(prev => {
      const base = prev.trim();
      if (base.startsWith(mentionHandle)) return prev;
      return `${mentionHandle} `;
    });
    setTimeout(() => {
      const el = commentInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 50);
  };

  const rootComments = comments.filter(c => !c.reply_to);
  const repliesMap = comments.reduce<Record<string, AnnouncementComment[]>>((acc, c) => {
    if (c.reply_to) {
      if (!acc[c.reply_to]) acc[c.reply_to] = [];
      acc[c.reply_to].push(c);
    }
    return acc;
  }, {});

  const isCreator = user?.id === announcement?.created_by;

  if (loading) return <PageLoader />;
  if (!announcement) return <div className="page-container p-8 text-center text-gray-500">Announcement not found</div>;

  const blocks = announcement.content_blocks;
  const viewCount = views.length;
  const hasPhotos = blocks?.some(b => b.type === 'image');
  const pConfig = PRIORITY_CONFIG[announcement.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
  const PriorityIcon = pConfig.icon;

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 lg:px-6 pt-6 sm:pt-8 space-y-5">

        {/* ── Back ─────────────────────────────────────── */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate('/announcements')}
          className="inline-flex items-center gap-1.5 pl-2 pr-3.5 h-8 rounded-full text-[12px] font-semibold text-gray-600 dark:text-white/55 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md hover:bg-white dark:hover:bg-white/[0.07] active:scale-[0.97] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Announcements
        </motion.button>

        {/* ── Hero Card ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
          style={{
            borderColor: pConfig.accentBorder ?? undefined,
            backgroundImage: pConfig.accent
              ? `linear-gradient(135deg, ${pConfig.accent}, transparent 60%)`
              : undefined,
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)',
          }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="relative px-5 sm:px-7 pt-6 pb-5 border-b border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {/* Eyebrow */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="relative shrink-0">
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.35), transparent 70%)', filter: 'blur(8px)', transform: 'scale(1.4)' }}
                    />
                    <div
                      className="relative h-7 w-7 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(145deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.35)' }}
                    >
                      <Megaphone className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <p className={`text-[10px] font-mono font-medium uppercase tracking-[0.22em] ${pConfig.eyebrow}`}>
                    {announcement.priority === 'urgent' ? 'Urgent · Team Update' : announcement.priority === 'high' ? 'High Priority · Team Update' : 'Team Update'}
                  </p>
                </div>

                {/* Title */}
                <div className="flex items-start gap-2 flex-wrap">
                  {PriorityIcon && <PriorityIcon className={`h-5 w-5 shrink-0 mt-1 ${pConfig.iconColor}`} />}
                  {announcement.is_leaders_only && <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-1.5" />}
                  <h1 className="text-[1.6rem] sm:text-[1.9rem] font-black text-gray-900 dark:text-white leading-[1.1]" style={{ letterSpacing: '-0.03em' }}>
                    {announcement.title}
                  </h1>
                  {announcement.priority !== 'normal' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 mt-1.5 ${pConfig.badge}`}>{pConfig.label}</span>
                  )}
                </div>

                {/* Author + meta row */}
                <div className="flex items-center gap-2.5 flex-wrap mt-4 pt-4 border-t border-black/[0.04] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={announcement.profiles?.avatar_url}
                      firstName={announcement.profiles?.first_name || '?'}
                      lastName={announcement.profiles?.last_name}
                      size="sm"
                      className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-none tracking-tight">{announcement.profiles?.first_name} {announcement.profiles?.last_name}</p>
                      <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-1 tracking-wide">{format(parseISO(announcement.created_at), 'EEE · MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => setShowViewers(true)}
                      className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold text-gray-500 dark:text-white/45 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      <Eye className="h-3 w-3" />{viewCount}
                    </button>
                    <span className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold text-gray-500 dark:text-white/45 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07]">
                      <MessageCircle className="h-3 w-3" />{comments.length}
                    </span>
                    {hasPhotos && (
                      <span className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold text-gray-500 dark:text-white/45 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07]">
                        <Image className="h-3 w-3" /> Photos
                      </span>
                    )}
                    {isCreator && (
                      <div className="relative shrink-0" ref={menuRef}>
                        <button
                          type="button"
                          onClick={() => setShowMenu(!showMenu)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 dark:text-white/40 bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] hover:bg-white dark:hover:bg-white/[0.07] transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {showMenu && (
                          <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#232325] rounded-2xl shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] py-1 z-10">
                            <button
                              type="button"
                              onClick={handleEdit}
                              className="w-full px-3.5 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.05] flex items-center gap-2.5 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-400" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                              className="w-full px-3.5 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative px-5 sm:px-7 py-7">
            {blocks && blocks.length > 0 ? (
              <div className="space-y-5">
                {blocks.map((block, i) =>
                  block.type === 'text' ? (
                    <div key={i} className="text-[15px] sm:text-[16px] leading-[1.8] text-gray-700 dark:text-white/70 whitespace-pre-wrap" style={{ letterSpacing: '-0.005em' }}>
                      <FormattedText text={block.content} />
                    </div>
                  ) : (
                    <div key={i} className="rounded-2xl overflow-hidden border border-black/[0.06] dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03]">
                      <img src={block.content} alt="" className="w-full object-contain" />
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="text-[15px] sm:text-[16px] leading-[1.8] text-gray-700 dark:text-white/70 whitespace-pre-wrap" style={{ letterSpacing: '-0.005em' }}>
                <FormattedText text={announcement.content} />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Comments Card ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

          <div className="relative flex items-center gap-2.5 px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.05]">
            <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">02</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 flex items-center gap-1.5">
              <MessageCircle className="h-3 w-3" /> Comments
            </span>
            {comments.length > 0 && (
              <span className="ml-auto text-[11px] font-mono font-semibold tabular-nums text-gray-400 dark:text-white/30 tracking-wide">
                {comments.length} total
              </span>
            )}
          </div>

          {rootComments.length === 0 ? (
            <p className="relative px-5 py-12 text-center text-[13px] text-gray-400 dark:text-white/30">No comments yet. Be the first to comment.</p>
          ) : (
            <div className="relative">
              {rootComments.map(c => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  replies={repliesMap[c.id] || []}
                  user={user}
                  editingCommentId={editingCommentId}
                  editCommentContent={editCommentContent}
                  setEditCommentContent={setEditCommentContent}
                  savingComment={savingComment}
                  onReply={startReply}
                  onEdit={handleEditComment}
                  onSaveEdit={handleSaveComment}
                  onCancelEdit={() => { setEditingCommentId(null); setEditCommentContent(''); }}
                  onDelete={(commentId) => { setDeletingCommentId(commentId); setShowDeleteCommentConfirm(true); }}
                />
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="relative px-5 py-4 border-t border-black/[0.04] dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.015]">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-200/70 dark:border-amber-500/25">
                <CornerDownRight className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <p className="text-[12px] text-amber-700 dark:text-amber-300 flex-1 truncate">
                  Replying to <span className="font-bold">{replyingTo.profiles?.first_name}</span>: {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}
                </p>
                <button type="button" onClick={() => { setReplyingTo(null); setNewComment(''); }} className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-start gap-3">
              {user && (
                <div className="shrink-0 mt-0.5">
                  <Avatar src={userProfile?.avatar_url} firstName={userProfile?.first_name || user.email?.[0]?.toUpperCase() || '?'} lastName={userProfile?.last_name} size="sm" className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                </div>
              )}
              <div className="flex-1">
                <MentionTextarea
                  textareaRef={commentInputRef}
                  value={newComment}
                  onChange={setNewComment}
                  placeholder={replyingTo ? `Reply to ${replyingTo.profiles?.first_name}... (type @ to mention)` : 'Write a comment... (type @ to mention)'}
                  className="input-field text-sm resize-none w-full overflow-y-auto"
                  style={{ maxHeight: 'calc(6 * 1.5rem + 1.5rem)' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                  rows={2}
                />
              </div>
              <button
                onClick={handleComment}
                disabled={!newComment.trim() || submitting}
                className="inline-flex items-center justify-center h-10 w-10 rounded-2xl shrink-0 text-white disabled:opacity-40 transition-all active:scale-[0.95] mt-0.5"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.35)' }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Viewers Modal */}
      <Modal open={showViewers} onClose={() => setShowViewers(false)} title="Who Read This">
        <div className="space-y-1">
          {views.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No one has read this yet.</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{views.length} {views.length === 1 ? 'person has' : 'people have'} read this announcement.</p>
              <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin -mx-1 px-1">
                {views
                  .slice()
                  .sort((a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime())
                  .map((v, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                      <Avatar
                        src={v.profiles?.avatar_url}
                        firstName={v.profiles?.first_name || '?'}
                        lastName={v.profiles?.last_name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {v.profiles?.first_name} {v.profiles?.last_name}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {format(parseISO(v.viewed_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={() => setShowViewers(false)} className="btn-secondary">Close</button>
        </div>
      </Modal>

      {/* Delete announcement confirmation */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Announcement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{announcement?.title}"? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Deleting...</> : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete comment confirmation */}
      <Modal open={showDeleteCommentConfirm} onClose={() => { setShowDeleteCommentConfirm(false); setDeletingCommentId(null); }} title="Delete Comment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this comment? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowDeleteCommentConfirm(false); setDeletingCommentId(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleDeleteComment} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>

      {/* Edit announcement modal */}
      {showEdit && (
        <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Announcement" size="lg">
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
              <Select
                value={editPriority}
                onChange={v => setEditPriority(v as 'normal' | 'high' | 'urgent')}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Content</label>
              <div className="space-y-3">
                {editContentBlocks.map((block, index) => (
                  <div key={index}>
                    {block.type === 'text' ? (
                      <div className="relative group">
                        <textarea
                          value={block.content}
                          onChange={e => updateEditBlock(index, e.target.value)}
                          className="input-field min-h-[180px]"
                          placeholder="Write your announcement..."
                          rows={7}
                        />
                        {editContentBlocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEditBlock(index)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.07]">
                        <img src={block.content} alt="" className="w-full rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeEditBlock(index)}
                          className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
