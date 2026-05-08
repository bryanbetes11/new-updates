import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Megaphone, Plus, Search, Eye, AlertTriangle, AlertCircle, Image, X, Type, Camera, Trash2,
  ChevronRight, Pin, Lock, MessageCircle, Smile
} from 'lucide-react';
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
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    border: 'ring-red-300 dark:ring-red-800/60',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    label: 'Urgent',
  },
  high: {
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    border: 'ring-amber-300 dark:ring-amber-800/60',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'High',
  },
  normal: {
    badge: '',
    border: '',
    icon: null,
    iconColor: '',
    label: 'Normal',
  },
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
    const { data, error } = await supabase
      .from('announcements')
      .select(`*, profiles!announcements_created_by_fkey(first_name, last_name, avatar_url), announcement_views(user_id), announcement_comments(id), announcement_reactions(id, user_id, emoji), announcement_pins(id, pinned_by, pinned_at)`)
      .order('created_at', { ascending: false });
    if (error) console.error('Fetch announcements error:', error);
    setAnnouncements((data || []) as AnnouncementWithBlocks[]);
    setLoading(false);
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

    if (isPinned) {
      const { error } = await supabase.from('announcement_pins').delete().eq('announcement_id', announcement.id);
      if (error) {
        toast('error', 'Failed to unpin');
        await fetchAnnouncements();
        return;
      }
      toast('success', 'Announcement unpinned');
    } else {
      await supabase.from('announcement_pins').delete().eq('announcement_id', announcement.id);
      const { error } = await supabase.from('announcement_pins').insert(
        { announcement_id: announcement.id, pinned_by: user.id }
      );
      if (error) {
        toast('error', 'Failed to pin');
        await fetchAnnouncements();
        return;
      }
      toast('success', 'Announcement pinned');
    }
    await fetchAnnouncements();
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

  const getPreviewText = (a: AnnouncementWithBlocks) => {
    const blocks = a.content_blocks;
    if (blocks && blocks.length > 0) return blocks.find(b => b.type === 'text')?.content || '';
    return a.content;
  };

  const firstImageUrl = (a: AnnouncementWithBlocks) => a.content_blocks?.find(b => b.type === 'image')?.content || null;

  if (loading) return <div className="page-container"><AnnouncementsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-7 pb-0 space-y-4">

        {/* ── Page Header ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl shrink-0"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 3px 12px rgba(245,158,11,0.3)' }}>
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[1.375rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>Announcements</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Stay updated with team news</p>
            </div>
          </div>
          {isLeader && (
            <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0 text-sm">
              <Plus className="h-4 w-4" /> Post
            </button>
          )}
        </div>

        {/* ── Toolbar ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 animate-slide-up" style={{ animationDelay: '40ms', animationFillMode: 'both' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search announcements..." className="input-field pl-10 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X className="h-4 w-4" /></button>}
          </div>
          <div className="hidden sm:block"><Select value={priorityFilter} onChange={setPriorityFilter} options={[{ value: '', label: 'All Priorities' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} placeholder="All Priorities" className="sm:w-44" /></div>
          {isLeader && (
            <button
              onClick={() => setShowLeadersOnly(s => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${showLeadersOnly ? 'bg-brand-600 text-white shadow-sm' : 'bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.07] dark:ring-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252527]'}`}
            >
              <Lock className="h-3.5 w-3.5" /> Leaders
            </button>
          )}
        </div>
      </div>

      {/* ── List ──────────────────────────────────────── */}
      <div className="px-4 sm:px-5 lg:px-6 pt-4">
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="No announcements"
            description="Be the first to share something with the team."
            action={isLeader ? <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Post Announcement</button> : undefined}
          />
        ) : (
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
            {sortedFiltered.map(a => {
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
                <div
                  key={a.id}
                  className={`rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 transition-all duration-200 hover:ring-black/[0.08] dark:hover:ring-white/[0.09] hover:-translate-y-px relative ${
                    a.priority === 'urgent' ? 'ring-black/[0.05] dark:ring-white/[0.06]' :
                    a.priority === 'high' ? 'ring-black/[0.05] dark:ring-white/[0.06]' :
                    isPinned ? 'ring-amber-200 dark:ring-amber-900/40' :
                    'ring-black/[0.05] dark:ring-white/[0.06]'
                  }`}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  {/* Pinned indicator */}
                  {isPinned && (
                    <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
                      <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.08em]">Pinned</span>
                    </div>
                  )}

                  <button className="w-full text-left" onClick={() => navigate(`/announcements/${a.id}`)}>
                    <div className="flex items-start gap-3.5 px-4 py-3.5">
                      {/* Thumbnail */}
                      {thumbnail && (
                        <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          {PriorityIcon && <PriorityIcon className={`h-4 w-4 shrink-0 mt-0.5 ${pConfig.iconColor}`} />}
                          {isLeadersOnly && <Lock className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-0.5" />}
                          <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug" style={{ letterSpacing: '-0.01em' }}>{a.title}</p>
                          {isUnread && (
                            <span className="inline-flex items-center rounded-lg bg-sky-500 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wide shrink-0">NEW</span>
                          )}
                          {a.priority !== 'normal' && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${pConfig.badge}`}>{pConfig.label}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed"><FormattedText text={getPreviewText(a)} /></p>
                        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Avatar src={a.profiles?.avatar_url} firstName={a.profiles?.first_name || '?'} lastName={a.profiles?.last_name} size="xs" />
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{a.profiles?.first_name}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">{format(parseISO(a.created_at), 'MMM d, yyyy')}</span>
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500"><Eye className="h-3 w-3" />{viewCount}</span>
                          {commentCount > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500"><MessageCircle className="h-3 w-3" />{commentCount}</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0 mt-1" />
                    </div>
                  </button>

                  {/* Reaction row */}
                  <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap border-t border-black/[0.03] dark:border-white/[0.04] pt-2">
                    {reactionGroups.map(r => (
                      <button
                        key={r.emoji}
                        onClick={e => handleReact(e, a.id, r.emoji)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold transition-all active:scale-[0.95] ${
                          r.users.includes(user?.id || '')
                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-brand-300 dark:ring-brand-700'
                            : 'bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        {r.emoji} <span>{r.count}</span>
                      </button>
                    ))}

                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setEmojiPickerId(emojiPickerId === a.id ? null : a.id); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      {emojiPickerId === a.id && (
                        <div className="absolute bottom-full left-0 mb-1 flex items-center gap-1 p-2 rounded-2xl bg-white dark:bg-[#232325] shadow-xl ring-1 ring-black/[0.07] dark:ring-white/[0.08] z-20">
                          {QUICK_EMOJIS.map(e => (
                            <button key={e} onClick={ev => handleReact(ev, a.id, e)} className="text-lg hover:scale-125 transition-transform px-0.5">{e}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isLeader && (
                      <button
                        onClick={e => handlePin(e, a)}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold transition-all ml-auto ${
                          isPinned ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        }`}
                      >
                        <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-amber-500' : ''}`} />
                        {isPinned ? 'Pinned' : 'Pin'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                        placeholder="Write something... (type @ to mention someone)"
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
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost text-xs"><Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Add Photo'}</button>
            <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading} className="btn-ghost text-xs"><Camera className="h-3.5 w-3.5" /> Take Photo</button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileSelect(e.target.files)} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Posting...' : 'Post Announcement'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
