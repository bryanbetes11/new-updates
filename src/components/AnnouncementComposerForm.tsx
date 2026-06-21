import { useRef, useState } from 'react';
import { Camera, Image, Lock, Trash2, Type, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Select } from './Select';
import { MentionTextarea } from './MentionTextarea';

interface ContentBlock {
  type: 'text' | 'image';
  content: string;
}

interface AnnouncementComposerFormProps {
  onSuccess?: () => void | Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  variant?: 'default' | 'spotify';
}

export function AnnouncementComposerForm({
  onSuccess,
  onCancel,
  cancelLabel = 'Cancel',
  submitLabel = 'Post Announcement',
  variant = 'default',
}: AnnouncementComposerFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formPriority, setFormPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [formLeadersOnly, setFormLeadersOnly] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([{ type: 'text', content: '' }]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormTitle('');
    setFormPriority('normal');
    setFormLeadersOnly(false);
    setContentBlocks([{ type: 'text', content: '' }]);
    setUploading(false);
    setCreating(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('announcements').upload(path, file);
    if (error) {
      toast('error', 'Failed to upload image');
      return null;
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const blocks = contentBlocks.filter(block => block.content.trim());
    if (blocks.length === 0) {
      toast('error', 'Please add some content');
      return;
    }

    setCreating(true);

    const plainContent = blocks
      .filter(block => block.type === 'text')
      .map(block => block.content)
      .join('\n');
    const firstImage = blocks.find(block => block.type === 'image');

    const { error } = await supabase.from('announcements').insert({
      title: formTitle,
      content: plainContent || ' ',
      priority: formPriority,
      created_by: user.id,
      media_url: firstImage?.content || '',
      content_blocks: blocks,
      is_leaders_only: formLeadersOnly,
    });

    setCreating(false);

    if (error) {
      toast('error', 'Failed to create announcement');
      return;
    }

    toast('success', 'Announcement posted');
    resetForm();
    await onSuccess?.();
  };

  const isSpotify = variant === 'spotify';
  const labelClass = isSpotify
    ? 'mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/52'
    : 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';
  const inputClass = isSpotify
    ? 'h-12 w-full rounded-[0.65rem] border border-white/[0.08] bg-white/[0.055] px-3.5 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#22c55e]/60 focus:bg-white/[0.075] focus:ring-2 focus:ring-[#22c55e]/15'
    : 'input-field';
  const textareaClass = isSpotify
    ? 'min-h-[180px] w-full rounded-[0.65rem] border border-white/[0.08] bg-white/[0.055] px-3.5 py-3 text-[14px] font-semibold leading-relaxed text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#22c55e]/60 focus:bg-white/[0.075] focus:ring-2 focus:ring-[#22c55e]/15'
    : 'input-field min-h-[180px] pr-8';
  const helperClass = isSpotify
    ? 'mb-2 text-[12px] font-semibold text-white/32'
    : 'mb-2 text-xs text-gray-400 dark:text-gray-500';
  const selectClass = isSpotify
    ? '[&>button]:h-12 [&>button]:rounded-[0.65rem] [&>button]:border-white/[0.08] [&>button]:bg-white/[0.055] [&>button]:px-3.5 [&>button]:text-[14px] [&>button]:font-semibold [&>button]:text-white [&>button]:focus:border-[#22c55e]/60 [&>button]:focus:bg-white/[0.075] [&>button]:focus:ring-2 [&>button]:focus:ring-[#22c55e]/15'
    : '';

  return (
    <form onSubmit={handleSubmit} className={isSpotify ? 'space-y-5' : 'space-y-4'}>
      <div>
        <label className={labelClass}>Title</label>
        <input
          type="text"
          value={formTitle}
          onChange={e => setFormTitle(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={labelClass}>Priority</label>
          <Select
            value={formPriority}
            onChange={value => setFormPriority(value as 'normal' | 'high' | 'urgent')}
            className={selectClass}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
        </div>

        <div className="sm:min-w-[11.25rem]">
          <label className={labelClass}>Visibility</label>
          <button
            type="button"
            onClick={() => setFormLeadersOnly(state => !state)}
            className={isSpotify
              ? `inline-flex h-12 w-full items-center justify-center gap-2 rounded-[0.65rem] border px-3.5 text-[13px] font-black transition-colors ${
                  formLeadersOnly
                    ? 'border-[#22c55e]/35 bg-[#22c55e]/12 text-[#22c55e]'
                    : 'border-white/[0.08] bg-white/[0.055] text-white/64 hover:bg-white/[0.075]'
                }`
              : `inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  formLeadersOnly
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                }`}
          >
            <Lock className="h-4 w-4" />
            {formLeadersOnly ? 'Leaders Only' : 'All Members'}
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Content</label>
        <p className={helperClass}>
          Format: **bold**, *italic*, ~~strikethrough~~, `code`, @mention
        </p>

        <div className="space-y-3">
          {contentBlocks.map((block, index) => (
            <div key={index} className="group relative">
              {block.type === 'text' ? (
                <div className="relative">
                  <MentionTextarea
                    value={block.content}
                    onChange={value => setContentBlocks(prev => prev.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, content: value } : item
                    )))}
                    className={`${textareaClass} pr-8`}
                    placeholder="Write something... (type @ to mention someone)"
                    rows={7}
                  />
                  {contentBlocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setContentBlocks(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                      className="absolute right-2 top-2 rounded-md p-1 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-gray-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className={`relative overflow-hidden rounded-xl ${isSpotify ? 'ring-1 ring-white/[0.08]' : 'ring-1 ring-gray-200 dark:ring-gray-700'}`}>
                  <img src={block.content} alt="" className={`max-h-60 w-full object-contain ${isSpotify ? 'bg-white/[0.04]' : 'bg-gray-100 dark:bg-gray-800'}`} />
                  <button
                    type="button"
                    onClick={() => setContentBlocks(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                    className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setContentBlocks(prev => [...prev, { type: 'text', content: '' }])}
          className={isSpotify ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.075] px-3 text-[12px] font-black text-white/72 transition-colors hover:bg-white/[0.11]' : 'btn-ghost text-xs'}
        >
          <Type className="h-3.5 w-3.5" /> Add Text
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={isSpotify ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.075] px-3 text-[12px] font-black text-white/72 transition-colors hover:bg-white/[0.11] disabled:opacity-50' : 'btn-ghost text-xs'}
        >
          <Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Add Photo'}
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className={isSpotify ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.075] px-3 text-[12px] font-black text-white/72 transition-colors hover:bg-white/[0.11] disabled:opacity-50' : 'btn-ghost text-xs'}
        >
          <Camera className="h-3.5 w-3.5" /> Take Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFileSelect(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFileSelect(e.target.files)}
        />
      </div>

      <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={isSpotify ? 'inline-flex h-11 items-center justify-center rounded-full bg-white/[0.08] px-5 text-[13px] font-black text-white/72 transition-colors hover:bg-white/[0.12]' : 'btn-secondary'}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={creating}
          className={isSpotify ? 'inline-flex h-11 items-center justify-center rounded-full bg-[#22c55e] px-5 text-[13px] font-black text-black transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60' : 'btn-primary'}
        >
          {creating ? 'Posting...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
