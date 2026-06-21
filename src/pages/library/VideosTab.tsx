import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { PlayCircle, Plus, Search, ExternalLink, Film, CreditCard as Edit2, Trash2, MoreVertical, X } from 'lucide-react';
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

export function VideosTab() {
  const { user, isProductionDirector } = useAuth();
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
    setCreating(true);
    const { error } = await supabase.from('videos').insert({ ...form, uploaded_by: user.id });
    setCreating(false);
    if (error) { toast('error', 'Failed to add video'); return; }
    toast('success', 'Video added to library');
    setShowCreate(false);
    setForm({ title: '', description: '', video_url: '', thumbnail_url: '', category: 'General' });
    fetchVideos();
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

  const filtered = videos.filter(v => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || v.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getYouTubeThumb = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s?]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : '';
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
            className="overflow-hidden border-y border-white/[0.08]"
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
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:px-5 lg:px-6">
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
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  </a>

                  {/* Manage menu */}
                  {canManage && (
                    <div className="absolute right-4 top-4 z-20 sm:right-5 lg:right-6">
                      <div className="relative">
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === video.id ? null : video.id); }}
                          className="p-1.5 rounded-full bg-white/[0.075] text-white/60 backdrop-blur-sm ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:text-white"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {openMenuId === video.id && (
                          <div className="absolute left-0 mt-1 w-36 bg-white dark:bg-[#232325] rounded-2xl shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] py-1 z-30">
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
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Video">
        <form onSubmit={handleCreate} className="space-y-4">
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
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Adding...' : 'Add Video'}</button>
          </div>
        </form>
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
