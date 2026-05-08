import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { PlayCircle, Plus, Search, ExternalLink, Film, CreditCard as Edit2, Trash2, MoreVertical, X, Tag } from 'lucide-react';
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

      {/* ── Section Label + Add Button ───────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">01</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 flex items-center gap-1.5">
            <Film className="h-3 w-3" /> Video Library
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white shrink-0 transition-all active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
        >
          <Plus className="h-3.5 w-3.5" /> Add Video
        </button>
      </div>

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
            className="w-full h-10 pl-10 pr-9 rounded-2xl text-[13px] bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="hidden sm:block">
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c, label: c }))]}
            placeholder="All Categories"
            className="sm:w-44"
          />
        </div>
      </motion.div>

      {/* ── Category Pills ──────────────────────────── */}
      {videos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 flex-wrap"
        >
          <span className="text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-[0.14em] flex items-center gap-1 shrink-0">
            <Tag className="h-3 w-3" /> Filter
          </span>
          {categories
            .filter(cat => videos.some(v => v.category === cat))
            .map(cat => {
              const count = videos.filter(v => v.category === cat).length;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? '' : cat)}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-bold transition-all duration-150 active:scale-[0.97] ${
                    active
                      ? `${categoryColors[cat] ?? 'bg-gray-100 text-gray-600'} ring-1 ring-current/30`
                      : 'bg-white/70 dark:bg-white/[0.04] text-gray-500 dark:text-white/45 border border-black/[0.06] dark:border-white/[0.07] hover:bg-white dark:hover:bg-white/[0.07]'
                  }`}
                >
                  {cat}
                  <span className={`tabular-nums font-semibold ${active ? 'opacity-70' : 'opacity-60'}`}>{count}</span>
                </button>
              );
            })}
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="text-[11px] font-semibold text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 flex items-center gap-1 ml-0.5 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </motion.div>
      )}

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
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map(video => {
              const thumb = video.thumbnail_url || getYouTubeThumb(video.video_url);
              const canManage = canManageVideo(video);
              const catColor = categoryColors[video.category] ?? categoryColors.General;
              return (
                <motion.div
                  key={video.id}
                  variants={itemVariants}
                  className="group relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-300"
                  style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
                >
                  {/* Inner top-edge highlight */}
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent z-10" />

                  <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Film className="h-10 w-10 text-gray-300 dark:text-white/15" />
                        </div>
                      )}

                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/15 backdrop-blur-md ring-2 ring-white/40 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                          <PlayCircle className="h-8 w-8 text-white" />
                        </div>
                      </div>

                      {/* Category chip */}
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide ${catColor}`} style={{ backdropFilter: 'blur(8px)' }}>
                          {video.category}
                        </span>
                      </div>

                      {/* Open indicator */}
                      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm">
                          <ExternalLink className="h-3 w-3 text-white/85" />
                          <span className="text-[10px] font-semibold text-white/85">Open</span>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      <p className="text-[14px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug" style={{ letterSpacing: '-0.02em' }}>
                        {video.title}
                      </p>
                      {video.description && (
                        <p className="text-[12px] text-gray-500 dark:text-white/40 mt-1 line-clamp-2 leading-relaxed">{video.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-white/45 truncate">
                          {video.profiles?.first_name} {video.profiles?.last_name}
                        </span>
                        <span className="text-gray-300 dark:text-white/15 shrink-0">·</span>
                        <span className="text-[11px] font-mono text-gray-400 dark:text-white/30 shrink-0">{format(parseISO(video.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </a>

                  {/* Manage menu */}
                  {canManage && (
                    <div className="absolute top-2.5 left-2.5 z-20">
                      <div className="relative">
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === video.id ? null : video.id); }}
                          className="p-1.5 rounded-xl bg-white/90 dark:bg-[#1c1b1e]/90 backdrop-blur-sm hover:bg-white dark:hover:bg-[#252527] transition-colors shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.1]"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
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
