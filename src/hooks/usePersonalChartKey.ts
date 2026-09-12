import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { personalChartKeyStorageId, readPersonalChartKey, writePersonalChartKey } from '../lib/personalChartKey';
import { enqueueLatestSave } from '../lib/latestSaveQueue';

type KeyState = { identity: string | null; key: string | null; saving: boolean; message: string; dirty: boolean };

export function usePersonalChartKey(orgId?: string | null, userId?: string, songId?: string) {
  const identity = personalChartKeyStorageId(orgId, userId, songId);
  const preferenceKey = `personal-chart-key:${orgId}:${songId}`;
  const [state, setState] = useState<KeyState>(() => ({ identity, key: readPersonalChartKey(identity), saving: false, message: '', dirty: false }));
  const current = useRef(state);
  current.current = state;
  const active = useRef(identity);
  active.current = identity;
  const revision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    const localKey = readPersonalChartKey(identity);
    setState({ identity, key: localKey, saving: false, message: '', dirty: false });
    async function load() {
      if (!identity || !userId || loading || (current.current.identity === identity && (current.current.saving || current.current.dirty))) return;
      loading = true;
      const version = revision.current;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const { data, error } = await supabase.from('user_ui_preferences').select('preference_value')
          .eq('user_id', userId).eq('preference_key', preferenceKey).abortSignal(controller.signal).maybeSingle();
        if (cancelled || version !== revision.current) return;
        if (error) throw error;
        if (!data) {
          setState({ identity, key: localKey, saving: false, dirty: false, message: localKey ? 'This key is saved only on this device. Select it to save it to your account.' : '' });
          return;
        }
        const value: unknown = data.preference_value;
        if (value !== null && (typeof value !== 'string' || !/^[A-G][#b]?$/.test(value))) throw new Error('Invalid saved key');
        writePersonalChartKey(identity, value);
        setState({ identity, key: value, saving: false, dirty: false, message: 'Account key synced.' });
      } catch {
        if (!cancelled && version === revision.current) setState(previous => ({ ...previous, message: 'Could not sync your account key. Showing the last available key; reconnect and reopen to refresh.' }));
      } finally { clearTimeout(timeout); loading = false; }
    }
    void load();
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [identity, preferenceKey, userId]);

  async function save(key: string | null) {
    if (!identity || !userId) return;
    const version = ++revision.current;
    const next = { identity, key, saving: true, dirty: true, message: 'Saving your account key…' };
    current.current = next;
    setState(next);
    try {
      const saved = await enqueueLatestSave(identity, async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const { data, error } = await supabase.from('user_ui_preferences')
            .upsert({ user_id: userId, preference_key: preferenceKey, preference_value: key }, { onConflict: 'user_id,preference_key' })
            .select('preference_value').abortSignal(controller.signal).single();
          if (error || !data || data.preference_value !== key) throw error || new Error('Save not confirmed');
          writePersonalChartKey(identity, key);
        } finally { clearTimeout(timeout); }
      });
      if (!saved) return;
      if (active.current === identity && revision.current === version) setState({ identity, key, saving: false, dirty: false, message: key ? `Key ${key} saved to your account for rehearsal and Live Mode.` : 'Your account now uses the assigned setlist key.' });
    } catch {
      if (active.current === identity && revision.current === version) setState({ identity, key, saving: false, dirty: true, message: 'Your view changed, but the account save failed. Retry before switching devices.' });
    }
  }

  const visible = state.identity === identity ? state : { identity, key: readPersonalChartKey(identity), saving: false, message: '', dirty: false };
  return { ...visible, save, canSave: Boolean(identity) };
}
