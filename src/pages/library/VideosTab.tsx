import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { PlayCircle, Plus, Search, ExternalLink, Film, CreditCard as Edit2, Trash2, MoreVertical, X, MessageCircle, Send, Loader2, Bell, BellOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import type { Video } from '../../types';

const categories = ['General', 'Worship', 'Tutorial', 'Sermon', 'Conference', 'Other'];

const categoryColors: Record<string, string> = {
  Worship: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
  Tutorial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Sermon: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  Conference: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  Other: 'bg-gray-100 dark:bg-white/[0.07] text-gray-600 dark:text-gray-400',
  General: 'bg-gray-100 dark:bg-white/[0.07] text-gray-600 dark:text-gray-400',
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

interface VideoComment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; avatar_url: string | null } | null;
}

interface YouTubeMetadata {
  title: string;
  thumbnail_url: string;
}

function timestampToSeconds(value: string) {
  const parts = value.split(':').map(Number);
  if (parts.some(part => !Number.isFinite(part))) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return seconds < 60 ? minutes * 60 + seconds : null;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : null;
  }
  return null;
}

function TimestampedComment({ content, onSeek }: { content: string; onSeek: (seconds: number) => void }) {
  const parts = content.split(/(\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b)/g);
  return (
    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-gray-600 dark:text-white/65">
      {parts.map((part, index) => {
        const seconds = timestampToSeconds(part);
        return seconds === null ? part : (
          <button
            key={`${part}-${index}`}
            type="button"
            onClick={() => onSeek(seconds)}
            className="mx-0.5 inline-flex rounded-md bg-emerald-500/12 px-1.5 font-mono text-xs font-black text-emerald-600 transition-colors hover:bg-emerald-500/22 dark:text-emerald-400"
            aria-label={`Play video from ${part}`}
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
    if (!url.hostname.endsWith('youtube.com')) return null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const [, type, id] = url.pathname.split('/');
    return ['embed', 'shorts', 'live'].includes(type) ? id || null : null;
  } catch {
    return null;
  }
}

function getYouTubeEmbedUrl(value: string) {
  const id = getYouTubeId(value);
  return id ? `https://www.youtube.com/embed/${id}` : '';
}

async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata> {
  if (!getYouTubeId(url)) throw new Error('Only valid YouTube links can be added.');
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!response.ok) throw new Error('YouTube could not read this video. Check that it is public or unlisted.');
  const metadata = await response.json() as YouTubeMetadata;
  if (!metadata.title) throw new Error('YouTube did not return a title for this video.');
  return metadata;
}

export function VideosTab() {
  const { user, organization, isProductionDirector } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createLinks, setCreateLinks] = useState('');
  const [createCategory, setCreateCategory] = useState('General');
  const [createDescription, setCreateDescription] = useState('');
  const [createNotifyMembers, setCreateNotifyMembers] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [form, setForm] = useState({
    title: '', description: '', video_url: '', thumbnail_url: '', category: 'General',
  });

  const fetchVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select('*, profiles(first_name, last_name)')
      .order('created_at', { ascending: false });
    setVideos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const links = [...new Set(createLinks.split(/\s+/).map(link => link.trim()).filter(Boolean))];
    if (links.length === 0) {
      toast('info', 'Paste at least one YouTube link.');
      return;
    }
    setCreating(true);
    let rows: Array<Record<string, string | boolean>>;
    try {
      rows = await Promise.all(links.map(async videoUrl => {
        const metadata = await fetchYouTubeMetadata(videoUrl);
        return {
          title: metadata.title,
          description: createDescription.trim(),
          video_url: videoUrl,
          thumbnail_url: metadata.thumbnail_url,
          category: createCategory,
          uploaded_by: user.id,
          notify_members: isProductionDirector ? createNotifyMembers : true,
        };
      }));
    } catch (error) {
      setCreating(false);
      toast('error', error instanceof Error ? error.message : 'Could not read one of the YouTube links.');
      return;
    }
    const { error } = await supabase.from('videos').insert(rows);
    setCreating(false);
    if (error) { toast('error', error.message || 'Failed to add videos'); return; }
    toast('success', `${rows.length} video${rows.length === 1 ? '' : 's'} added to the library`);
    setShowCreate(false);
    setCreateLinks('');
    setCreateCategory('General');
    setCreateDescription('');
    setCreateNotifyMembers(false);
    fetchVideos();
  };

  const fetchComments = async (videoId: string) => {
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('video_comments')
      .select('id, video_id, user_id, content, created_at, profiles!video_comments_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });
    setCommentsLoading(false);
    if (error) {
      toast('error', 'Comments could not be loaded.');
      return;
    }
    setComments((data || []) as unknown as VideoComment[]);
  };

  const openVideo = (video: Video) => {
    setSelectedVideo(video);
    setShowPlayer(true);
    setCommentContent('');
    void fetchComments(video.id);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = commentContent.trim();
    if (!user || !organization || !selectedVideo || !content) return;
    setCommentSubmitting(true);
    const { error } = await supabase.from('video_comments').insert({
      org_id: organization.id,
      video_id: selectedVideo.id,
      user_id: user.id,
      content,
    });
    setCommentSubmitting(false);
    if (error) {
      toast('error', error.message || 'Comment could not be posted.');
      return;
    }
    setCommentContent('');
    await fetchComments(selectedVideo.id);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedVideo) return;
    const { error } = await supabase.from('video_comments').delete().eq('id', commentId);
    if (error) {
      toast('error', 'Comment could not be deleted.');
      return;
    }
    await fetchComments(selectedVideo.id);
  };

  const seekVideo = (seconds: number) => {
    const playerWindow = playerRef.current?.contentWindow;
    if (!playerWindow) return;
    playerWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), 'https://www.youtube.com');
    window.setTimeout(() => {
      playerWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
    }, 80);
  };

  const handleEdit = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(video);
    setForm({ title: video.title, description: video.description || '', video_url: video.video_url, thumbnail_url: video.thumbnail_url || '', category: video.category });
    setShowEdit(true);
    setOpenMenuId(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo) return;
    setUpdating(true);
    const { error } = await supabase.from('videos').update(form).eq('id', selectedVideo.id);
    setUpdating(false);
    if (error) { toast('error', 'Failed to update video'); return; }
    toast('success', 'Video updated');
    setShowEdit(false);
    setSelectedVideo(null);
    setForm({ title: '', description: '', video_url: '', thumbnail_url: '', category: 'General' });
    fetchVideos();
  };

  const handleDeleteClick = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(video);
    setShowDelete(true);
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    if (!selectedVideo) return;
    setDeleting(true);
    const { error } = await supabase.from('videos').delete().eq('id', selectedVideo.id);
    setDeleting(false);
    if (error) { toast('error', 'Failed to delete video'); return; }
    toast('success', 'Video deleted');
    setShowDelete(false);
    setSelectedVideo(null);
    fetchVideos();
  };

  const canManageVideo = (video: Video) => video.uploaded_by === user?.id || isProductionDirector;

  const filtered = [...videos].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).filter(v => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || v.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getYouTubeThumb = (url: string) => {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-1">
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-2xl" />
          <div className="skeleton h-10 w-28 rounded-2xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]">
              <div className="aspect-video skeleton rounded-none" />
              <div className="p-3.5 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded-lg" />
                <div className="skeleton h-3 w-1/2 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ label: 'All', value: '', count: videos.length }, ...categories
            .filter(cat => videos.some(v => v.category === cat))
            .map(cat => ({ label: cat, value: cat, count: videos.filter(v => v.category === cat).length }))]
            .map(filter => {
              const active = categoryFilter === filter.value;
              return (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => setCategoryFilter(active && filter.value ? '' : filter.value)}
                  className={`inline-flex h-11 shrink-0 items-center gap-3 rounded-full px-5 text-sm font-black transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-[#1ed760] text-black shadow-[0_14px_34px_-20px_rgba(30,215,96,0.9)]'
                      : 'bg-white/[0.095] text-white/82 hover:bg-white/[0.14]'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? 'bg-black/10 text-black' : 'bg-white/[0.09] text-white/62'}`}>
                    {filter.count}
                  </span>
                </button>
              );
            })}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.095] px-5 text-[13px] font-black text-white transition-all hover:bg-[#1ed760] hover:text-black active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Add Video
        </button>
      </motion.div>

      {/* ── Toolbar ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="w-full h-12 pl-10 pr-9 rounded-full text-[13px] bg-white/[0.055] border border-white/[0.08] text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Film className="h-8 w-8" />}
          title="No videos found"
          description={search || categoryFilter ? 'Try adjusting your search or filter.' : 'Add a video to share with your team.'}
          action={!search && !categoryFilter ? <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add Video</button> : undefined}
        />
      ) : (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="overflow-visible border-y border-white/[0.08]"
          >
            {filtered.map(video => {
              const thumb = video.thumbnail_url || getYouTubeThumb(video.video_url);
              const canManage = canManageVideo(video);
              const catColor = categoryColors[video.category] ?? categoryColors.General;
              return (
                <motion.div
                  key={video.id}
                  variants={itemVariants}
                  className="group relative border-b border-white/[0.075] transition-colors duration-200 last:border-b-0 hover:bg-white/[0.045]"
                >
                  <button type="button" onClick={() => openVideo(video)} className="grid w-full gap-3 px-4 py-4 text-left sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:px-5 lg:px-6">
                    <div className="flex items-start gap-3 sm:contents">
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-white/[0.055] ring-1 ring-white/[0.08] sm:h-20 sm:w-36">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Film className="h-8 w-8 text-white/18" />
                        </div>
                      )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/40">
                            <PlayCircle className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${catColor}`}>
                            {video.category}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[1rem] font-black leading-tight text-white sm:text-[1.12rem]">
                          {video.title}
                        </p>
                        {video.description && (
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/48 sm:line-clamp-1">{video.description}</p>
                        )}
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-white/32">
                          <span className="truncate text-white/48">
                            {video.profiles?.first_name} {video.profiles?.last_name}
                          </span>
                          <span className="font-mono whitespace-nowrap">{format(parseISO(video.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden items-center gap-2 justify-self-end text-white/26 sm:flex">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-0 transition-opacity group-hover:opacity-100">
                        Open
                      </span>
                      <PlayCircle className="h-4 w-4" />
                    </div>
                  </button>

                  {/* Manage menu */}
                  {canManage && (
                    <div className="absolute right-4 top-4 z-20 sm:right-5 lg:right-6">
                      <div className="relative">
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === video.id ? null : video.id); }}
                          aria-label={`Manage ${video.title}`}
                          aria-expanded={openMenuId === video.id}
                          aria-haspopup="menu"
                          className="p-1.5 rounded-full bg-white/[0.075] text-white/60 backdrop-blur-sm ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:text-white"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {openMenuId === video.id && (
                          <div role="menu" className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#232325] rounded-2xl shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] py-1 z-30">
                            <button
                              onClick={e => handleEdit(video, e)}
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-gray-400" /> Edit
                            </button>
                            <button
                              onClick={e => handleDeleteClick(video, e)}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          {!categoryFilter && !search && (
            <p className="text-center text-[11px] font-mono text-gray-400 dark:text-white/30 pt-1 tracking-wide">
              {videos.length} video{videos.length !== 1 ? 's' : ''} in library
            </p>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add YouTube Videos">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">YouTube links</label>
            <textarea
              value={createLinks}
              onChange={e => setCreateLinks(e.target.value)}
              className="input-field min-h-36 resize-y"
              placeholder={'Paste one or several links\nOne link per line'}
              required
            />
            <p className="mt-2 text-xs leading-5 text-gray-400 dark:text-white/35">Titles and thumbnails are taken directly from YouTube. Public and unlisted videos are supported.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
            <Select value={createCategory} onChange={setCreateCategory} options={categories.map(c => ({ value: c, label: c }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shared description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={createDescription} onChange={e => setCreateDescription(e.target.value)} className="input-field h-20 resize-none" />
          </div>
          {isProductionDirector && (
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <span className="flex min-w-0 gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${createNotifyMembers ? 'bg-emerald-500/15 text-emerald-500' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/45'}`}>
                  {createNotifyMembers ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </span>
                <span>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Notify team members</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-white/45">
                    {createNotifyMembers
                      ? 'Each added video will send its own notification.'
                      : 'No notifications will be sent for this import. Recommended for backlog batches.'}
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={createNotifyMembers}
                onChange={e => setCreateNotifyMembers(e.target.checked)}
                className="mt-2 h-5 w-5 shrink-0 accent-emerald-500"
                aria-label="Notify team members about these videos"
              />
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading YouTube…</> : 'Add videos'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Video player and discussion */}
      <Modal
        open={showPlayer}
        onClose={() => { setShowPlayer(false); setComments([]); setSelectedVideo(null); }}
        title={selectedVideo?.title || 'Video'}
        size="xl"
      >
        {selectedVideo && (
          <div className="space-y-5">
            <div className="aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
              {getYouTubeEmbedUrl(selectedVideo.video_url) ? (
                <iframe
                  ref={playerRef}
                  className="h-full w-full"
                  src={`${getYouTubeEmbedUrl(selectedVideo.video_url)}?rel=0&enablejsapi=1`}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <a href={selectedVideo.video_url} target="_blank" rel="noreferrer" className="btn-primary">
                    <ExternalLink className="h-4 w-4" /> Open video
                  </a>
                </div>
              )}
            </div>

            <div className="border-b border-gray-200 pb-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-gray-900 dark:text-white">Discussion</p>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 dark:bg-white/[0.06] dark:text-white/45">
                  <MessageCircle className="h-3.5 w-3.5" /> {comments.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-white/35">Share observations, questions, or helpful notes with the team.</p>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : comments.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-white/35">No comments yet. Start the conversation.</p>
              ) : comments.map(comment => {
                const name = `${comment.profiles?.first_name || ''} ${comment.profiles?.last_name || ''}`.trim() || 'Team member';
                return (
                  <div key={comment.id} className="flex gap-2.5 rounded-xl bg-gray-50 p-2.5 dark:bg-white/[0.035]">
                    {comment.profiles?.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-black text-emerald-500">{name.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="truncate text-[13px] font-black text-gray-800 dark:text-white/85">{name}</p>
                          <p className="whitespace-nowrap text-[10px] text-gray-400 dark:text-white/30">{format(parseISO(comment.created_at), 'MMM d, yyyy · h:mm a')}</p>
                        </div>
                        {comment.user_id === user?.id && (
                          <button type="button" onClick={() => void handleDeleteComment(comment.id)} className="shrink-0 text-[10px] font-bold text-red-500/70 hover:text-red-500">Delete</button>
                        )}
                      </div>
                      <TimestampedComment content={comment.content} onSeek={seekVideo} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky -bottom-5 z-10 -mx-5 border-t border-gray-200 bg-white/95 px-5 pb-1 pt-3 shadow-[0_-16px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1b1e]/95">
              <form onSubmit={handleAddComment} className="flex items-end gap-2">
                <textarea
                  value={commentContent}
                  onChange={e => setCommentContent(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="input-field min-h-[3.25rem] flex-1 resize-none"
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                />
                <button type="submit" disabled={commentSubmitting || !commentContent.trim()} className="btn-primary h-[3.25rem] px-4">
                  {commentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">Post</span>
                </button>
              </form>
              <p className="mt-2 text-[11px] text-gray-400 dark:text-white/30">Tip: add a timestamp such as <span className="font-mono font-bold text-emerald-500">1:23</span> or <span className="font-mono font-bold text-emerald-500">1:02:15</span>. It becomes a link to that moment.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Video">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Video URL</label>
            <input type="url" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} className="input-field" placeholder="YouTube or other video URL" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Thumbnail URL <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="url" value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} className="input-field" placeholder="Auto-detected for YouTube" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
            <Select value={form.category} onChange={v => setForm({ ...form, category: v })} options={categories.map(c => ({ value: c, label: c }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field h-20 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={updating} className="btn-primary">{updating ? 'Updating...' : 'Update Video'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Video" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{selectedVideo?.title}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">{deleting ? 'Deleting...' : 'Delete Video'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
