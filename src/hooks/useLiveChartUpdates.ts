import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Check lightweight metadata without downloading/replacing the charts being read.
export function useLiveChartUpdates(setlistId: string | undefined, songIds: string[], enabled: boolean, scope: string) {
  const songsKey = [...new Set(songIds)].sort().join(',');
  const baseline = useRef<string | null>(null);
  const [available, setAvailable] = useState(false);
  const capture = useCallback(async () => {
    if (!setlistId || !songsKey) return '';
    const ids = songsKey.split(',');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const rows: unknown[][] = [];
      const queries = [
        () => supabase.from('song_section_notes').select('id,song_id,updated_at').eq('scope', 'team').in('song_id', ids).order('id'),
        () => supabase.from('songs').select('id,updated_at').in('id', ids).order('id'),
        () => supabase.from('setlist_songs').select('id,song_id,position,performed_key,arrangement_section_order').eq('setlist_id', setlistId).order('id'),
      ];
      for (const query of queries) {
        const group: unknown[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await query().range(offset, offset + 499).abortSignal(controller.signal);
          if (error) throw error;
          group.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        rows.push(group);
      }
      return JSON.stringify(rows);
    } finally { clearTimeout(timer); }
  }, [setlistId, songsKey]);

  useEffect(() => {
    baseline.current = null;
    setAvailable(false);
    if (!enabled) return;
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const next = await capture();
        if (cancelled) return;
        if (baseline.current === null) baseline.current = next;
        else if (next !== baseline.current) setAvailable(true);
      } catch { /* Offline readers retain their charts and manual refresh control. */ }
      finally { checking = false; }
    };
    void check();
    const timer = setInterval(() => void check(), 30000);
    const onFocus = () => void check();
    window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [capture, enabled, scope]);

  const acknowledge = useCallback((snapshot: string) => {
    baseline.current = snapshot;
    setAvailable(false);
  }, []);
  const notify = useCallback(() => setAvailable(true), []);
  return { available, capture, acknowledge, notify };
}
