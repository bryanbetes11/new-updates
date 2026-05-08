import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
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
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06]">
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search videos..."
            className="input-field pl-10 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c, label: c }))]}
          placeholder="All Categories"
          className="sm:w-40"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Video
        </button>
      </div>

      {/* Category chip pills */}
      {videos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] flex items-center gap-1 shrink-0">
            <Tag className="h-3 w-3" /> Filter
          </span>
          {categories
            .filter(cat => videos.some(v => v.category === cat))
            .map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all duration-150 hover:scale-[1.04] active:scale-[0.97] ${
                  categoryFilter === cat
                    ? `${categoryColors[cat] ?? 'bg-gray-100 text-gray-600'} ring-2 ring-current ring-offset-1`
                    : `${categoryColors[cat] ?? 'bg-gray-100 text-gray-600'} opacity-70 hover:opacity-100`
                }`}
              >
                {cat}
                <span className="ml-1 opacity-60 font-semibold">{videos.filter(v => v.category === cat).length}</span>
              </button>
            ))}
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 ml-1 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Active filter label */}
      {categoryFilter && (
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${categoryColors[categoryFilter] ?? 'bg-gray-100 text-gray-600'}`}>
            {categoryFilter}
          </span>
          <span className="text-xs text-gray-400">{filtered.length} video{filtered.length !== 1 ? 's' : ''}</span>
        </div>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(video => {
              const thumb = video.thumbnail_url || getYouTubeThumb(video.video_url);
              const canManage = canManageVideo(video);
              const catColor = categoryColors[video.category] ?? categoryColors.General;
              return (
                <div
                  key={video.id}
                  className="group rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] hover:ring-black/[0.09] dark:hover:ring-white/[0.1] hover:-translate-y-px transition-all duration-200 relative"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                >
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-900/60 overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Film className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}

                      {/* Play button overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm ring-2 ring-white/40 translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                          <PlayCircle className="h-7 w-7 text-white" />
                        </div>
                      </div>

                      {/* Category chip */}
                      <div className="absolute bottom-2 left-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black backdrop-blur-sm uppercase tracking-wide ${catColor}`}>
                          {video.category}
                        </span>
                      </div>

                      {/* Open indicator */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
                          <ExternalLink className="h-3 w-3 text-white/80" />
                          <span className="text-[10px] font-semibold text-white/80">Open</span>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-3.5">
                      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug" style={{ letterSpacing: '-0.01em' }}>
                        {video.title}
                      </p>
                      {video.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">{video.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                          {video.profiles?.first_name} {video.profiles?.last_name}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600 shrink-0">&middot;</span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{format(parseISO(video.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </a>

                  {/* Manage menu */}
                  {canManage && (
                    <div className="absolute top-2 left-2">
                      <div className="relative">
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === video.id ? null : video.id); }}
                          className="p-1.5 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.1]"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                        </button>
                        {openMenuId === video.id && (
                          <div className="absolute left-0 mt-1 w-36 bg-white dark:bg-[#232325] rounded-2xl shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] py-1 z-10">
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
                </div>
              );
            })}
          </div>

          {!categoryFilter && !search && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
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
