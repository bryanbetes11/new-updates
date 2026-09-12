import { useCallback, useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { groupEmojiReactions } from '../lib/reactions';
import type { AnnouncementReaction } from '../types';
import { EmojiReactionPicker, REACTION_OPTIONS, type ReactionEmoji } from './EmojiReactionPicker';

/** The detail-page reactions use the same records as the announcements list. */
export function AnnouncementReactions({ announcementId, userId }: {
  announcementId: string;
  userId: string;
}) {
  const [reactions, setReactions] = useState<AnnouncementReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef(false);
  const mutationRef = useRef(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (mutationRef.current) return;
    const request = ++requestRef.current;
    try {
      const { data, error } = await supabase.from('announcement_reactions')
        .select('id, announcement_id, user_id, emoji, created_at')
        .eq('announcement_id', announcementId);
      if (!activeRef.current || request !== requestRef.current || mutationRef.current) return;
      if (error) throw error;
      setReactions(data || []);
      setLoadError(false);
    } catch {
      if (activeRef.current && request === requestRef.current) setLoadError(true);
    } finally {
      if (activeRef.current && request === requestRef.current) setLoading(false);
    }
  }, [announcementId]);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    const channel = supabase.channel(`announcement-detail-reactions-${announcementId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'announcement_reactions',
        filter: `announcement_id=eq.${announcementId}`,
      }, () => { void refresh(); })
      .subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      activeRef.current = false;
      requestRef.current += 1;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [announcementId, refresh]);

  useEffect(() => {
    if (!pickerOpen) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [pickerOpen]);

  const toggleReaction = async (emoji: string) => {
    if (mutationRef.current || loading || loadError) return;
    mutationRef.current = true;
    requestRef.current += 1; // A read started before this click must not undo the optimistic update.
    const previous = reactions;
    const existing = previous.find(reaction => reaction.user_id === userId && reaction.emoji === emoji);
    const optimisticId = `pending-${userId}-${emoji}`;
    setReactions(existing ? previous.filter(reaction => reaction.id !== existing.id) : [
      ...previous,
      { id: optimisticId, announcement_id: announcementId, user_id: userId, emoji, created_at: new Date().toISOString() },
    ]);
    setSaving(true);
    setSaveError(false);
    setPickerOpen(false);
    triggerRef.current?.focus();
    try {
      const { data, error } = existing
        ? await supabase.from('announcement_reactions').delete()
          .eq('id', existing.id).eq('announcement_id', announcementId).eq('user_id', userId)
          .select('id').maybeSingle()
        : await supabase.from('announcement_reactions')
          .insert({ announcement_id: announcementId, user_id: userId, emoji })
          .select('id, announcement_id, user_id, emoji, created_at').single();
      if (error || !data) throw error || new Error('Reaction was not saved');
      if (!activeRef.current) return;
      if (!existing) setReactions(current => current.map(reaction => reaction.id === optimisticId ? data as AnnouncementReaction : reaction));
    } catch {
      if (!activeRef.current) return;
      setReactions(previous);
      setSaveError(true);
    } finally {
      mutationRef.current = false;
      if (activeRef.current) {
        setSaving(false);
        void refresh();
      }
    }
  };

  return (
    <div ref={rootRef} className="relative border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.07] sm:px-7" role="region" aria-label="Announcement reactions">
      <div className="flex flex-wrap items-center gap-2">
        <button ref={triggerRef} type="button" onClick={() => setPickerOpen(open => !open)}
          disabled={loading || loadError || saving}
          aria-label="React to announcement" aria-expanded={pickerOpen} aria-haspopup="menu"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm font-bold text-gray-600 transition-colors hover:border-amber-400/40 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-amber-300">
          <Smile className="h-4 w-4" /> React
        </button>
        {groupEmojiReactions(reactions).map(group => {
          const selected = group.users.includes(userId);
          const label = REACTION_OPTIONS.find(option => option.emoji === group.emoji)?.label || group.emoji;
          return <button key={group.emoji} type="button" disabled={loading || loadError || saving}
            onClick={() => { void toggleReaction(group.emoji); }} aria-pressed={selected}
            aria-label={`${label}: ${group.count} ${group.count === 1 ? 'reaction' : 'reactions'}. ${selected ? 'Remove' : 'Add'} your reaction`}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 ${selected ? 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/[0.07]'}`}>
            <span aria-hidden="true" className="text-lg">{group.emoji}</span><span>{group.count}</span>
          </button>;
        })}
        <span role="status" className="text-xs text-gray-500 dark:text-white/45">{loading ? 'Loading reactions…' : saving ? 'Saving…' : ''}</span>
      </div>
      {pickerOpen && <div className="mt-3 max-w-full"><EmojiReactionPicker className="max-w-full" onPick={(emoji: ReactionEmoji) => { void toggleReaction(emoji); }} /></div>}
      {loadError && <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-amber-700 dark:text-amber-300" role="alert">
        Reactions could not load.<button type="button" onClick={() => { void refresh(); }} className="min-h-11 px-2 font-bold underline">Retry</button>
      </div>}
      {saveError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">Your reaction could not be saved. Please try again.</p>}
    </div>
  );
}
