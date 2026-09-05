import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function readPrivateNoteMap(raw: string | null): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, note]) => key.length > 0 && key.length <= 500 && typeof note === 'string' && note.length <= 20000));
  } catch { return {}; }
}

export function usePrivateSongNotes(songId?: string, userId?: string, orgId?: string | null) {
  const identity = songId && userId && orgId ? `${orgId}:${userId}:${songId}` : '';
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const mutation = useRef(0);
  const [state, setState] = useState<{ identity: string; notes: Record<string, string> }>({ identity: '', notes: {} });
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const cacheKey = `servesync:private-song-notes:${identity}`;
  const legacyKey = `servesync:song-section-notes:${songId}`;
  const importKey = `${cacheKey}:legacy-imported`;
  const refresh = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let request = 0;
    setError(null);
    setLegacy({});
    if (!identity) { setState({ identity, notes: {} }); return; }
    try {
      setState({ identity, notes: readPrivateNoteMap(localStorage.getItem(cacheKey)) });
      // Old notes were not account-scoped. Keep them local until explicitly claimed.
      if (!localStorage.getItem(importKey)) setLegacy(readPrivateNoteMap(localStorage.getItem(legacyKey)));
    } catch { setState({ identity, notes: {} }); }

    const load = async () => {
      if (running || cancelled) return;
      running = true;
      const version = mutation.current;
      const id = ++request;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 12000);
      try {
        const { data, error: failure } = await supabase.from('private_song_notes')
          .select('section_key,note').eq('user_id', userId!).eq('song_id', songId!).abortSignal(abort.signal);
        if (cancelled || version !== mutation.current || id !== request) return;
        if (failure) throw failure;
        const notes = Object.fromEntries((data || []).map(row => [row.section_key, row.note]));
        setState({ identity, notes });
        setError(null);
        try { localStorage.setItem(cacheKey, JSON.stringify(notes)); } catch { /* Online saves still work. */ }
      } catch {
        if (!cancelled && version === mutation.current) setError('Private notes could not sync. Saved copies and drafts remain available; reconnect to retry.');
      } finally { clearTimeout(timeout); running = false; }
    };
    refresh.current = load;
    void load();
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(onFocus, 4000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [identity, songId, userId, cacheKey, importKey, legacyKey]);

  const save = async (sectionKey: string, note: string) => {
    if (!identity) throw new Error('Sign in to save private notes.');
    mutation.current++;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const { data, error: failure } = await supabase.from('private_song_notes')
        .upsert({ user_id: userId!, song_id: songId!, section_key: sectionKey, note }, { onConflict: 'user_id,song_id,section_key' })
        .select('section_key,note').abortSignal(abort.signal).single();
      if (failure || !data) throw failure || new Error('Save was not confirmed.');
      if (activeIdentity.current !== identity) return;
      setState(current => ({ identity, notes: { ...(current.identity === identity ? current.notes : {}), [sectionKey]: data.note } }));
      setError(null);
    } finally {
      clearTimeout(timeout);
      mutation.current++;
      if (activeIdentity.current === identity) void refresh.current();
    }
  };

  const importLegacy = async () => {
    if (!identity || importing) return;
    setImporting(true);
    mutation.current++;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const rows = Object.entries(legacy).filter(([, note]) => note.trim()).map(([section_key, note]) => ({ user_id: userId!, song_id: songId!, section_key, note }));
      if (rows.length) {
        const { error: failure } = await supabase.from('private_song_notes').upsert(rows, { onConflict: 'user_id,song_id,section_key', ignoreDuplicates: true }).abortSignal(abort.signal);
        if (failure) throw failure;
      }
      if (activeIdentity.current !== identity) return;
      // Keep the original backup; never overwrite newer account notes or tombstones.
      try { localStorage.setItem(importKey, '1'); } catch { /* Duplicate import is harmless. */ }
      setLegacy({});
    } catch { if (activeIdentity.current === identity) setError('Could not import device notes. Your originals are still on this device.'); }
    finally { clearTimeout(timeout); mutation.current++; setImporting(false); if (activeIdentity.current === identity) void refresh.current(); }
  };

  return { notes: state.identity === identity ? state.notes : {}, error, save, legacyCount: Object.values(legacy).filter(note => note.trim()).length, importLegacy, importing };
}
