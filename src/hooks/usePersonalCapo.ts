import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enqueueLatestSave } from '../lib/latestSaveQueue';
import { isCapoFret, parsePersonalCapoSetting, personalCapoPreferenceKey, personalCapoStorageId, readPersonalCapo, writePersonalCapo } from '../lib/personalCapo';

type CapoState = { identity: string | null; fret: number; isOn: boolean; saving: boolean; dirty: boolean; message: string };

function initialState(identity: string | null): CapoState {
  const cached = readPersonalCapo(identity);
  return { identity, fret: cached?.fret || 0, isOn: cached?.enabled || false, saving: false, dirty: cached?.pending || false,
    message: cached?.pending ? 'Saved on this device. Waiting to sync your account.' : '' };
}

export function usePersonalCapo(orgId?: string | null, userId?: string, songId?: string, enabled = false) {
  const identity = enabled ? personalCapoStorageId(orgId, userId, songId) : null;
  const preferenceKey = orgId && songId ? personalCapoPreferenceKey(orgId, songId) : '';
  const [state, setState] = useState<CapoState>(() => initialState(identity));
  const current = useRef(state);
  current.current = state;
  const active = useRef(identity);
  active.current = identity;
  const revision = useRef(0);

  const save = useCallback(async (fret: number, isOn = fret > 0) => {
    if (!identity || !userId || !isCapoFret(fret)) return;
    isOn = isOn && fret > 0;
    const setting = { fret, enabled: isOn };
    const version = ++revision.current;
    const cached = writePersonalCapo(identity, { ...setting, pending: true });
    const next = { identity, fret, isOn, saving: true, dirty: true, message: 'Saving your capo…' };
    current.current = next;
    setState(next);
    try {
      const saved = await enqueueLatestSave(identity, async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const { data, error } = await supabase.from('user_ui_preferences')
            .upsert({ user_id: userId, preference_key: preferenceKey, preference_value: setting }, { onConflict: 'user_id,preference_key' })
            .select('preference_value').abortSignal(controller.signal).single();
          const confirmed = parsePersonalCapoSetting(data?.preference_value);
          if (error || !confirmed || confirmed.fret !== fret || confirmed.enabled !== isOn) throw error || new Error('Capo save not confirmed');
          // A completed older save must not replace a newer local selection.
          const latest = readPersonalCapo(identity);
          if (!latest || (latest.fret === fret && latest.enabled === isOn)) writePersonalCapo(identity, { ...setting, pending: false });
        } finally { clearTimeout(timeout); }
      });
      if (saved && active.current === identity && revision.current === version) {
        const confirmed = { identity, fret, isOn, saving: false, dirty: false, message: 'Capo saved to your account for this song.' };
        current.current = confirmed;
        setState(confirmed);
      }
    } catch {
      if (active.current === identity && revision.current === version) {
        const failed = { identity, fret, isOn, saving: false, dirty: true,
          message: cached ? 'Saved on this device. Account sync failed; retry when online.' : 'Your view changed, but the capo could not be saved. Retry before closing.' };
        current.current = failed;
        setState(failed);
      }
    }
  }, [identity, preferenceKey, userId]);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let controller: AbortController | undefined;
    const local = initialState(identity);
    current.current = local;
    setState(local);
    if (!identity || !userId) return;
    async function load() {
      if (!identity || !userId || loading || cancelled) return;
      if (current.current.identity === identity && current.current.dirty) {
        if (!current.current.saving) void save(current.current.fret, current.current.isOn);
        return;
      }
      loading = true;
      const version = revision.current;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      try {
        const { data, error } = await supabase.from('user_ui_preferences').select('preference_value')
          .eq('user_id', userId).eq('preference_key', preferenceKey).abortSignal(controller.signal).maybeSingle();
        if (cancelled || active.current !== identity || revision.current !== version) return;
        // Another mounted chart may have changed this song during our read.
        if (readPersonalCapo(identity)?.pending) return;
        const setting = data ? parsePersonalCapoSetting(data.preference_value) : { fret: local.fret, enabled: local.isOn };
        if (error || !setting) throw error || new Error('Invalid saved capo');
        const { fret, enabled: isOn } = setting;
        if (data) writePersonalCapo(identity, { ...setting, pending: false });
        const synced = { identity, fret, isOn, saving: false, dirty: false,
          message: data ? 'Capo synced from your account.' : local.fret ? 'Showing the capo saved on this device.' : '' };
        current.current = synced;
        setState(synced);
      } catch {
        if (!cancelled && active.current === identity && revision.current === version) {
          setState(previous => ({ ...previous, message: 'Account sync unavailable. Showing the capo saved on this device.' }));
        }
      } finally { clearTimeout(timeout); loading = false; }
    }
    void load();
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      controller?.abort();
      window.removeEventListener('online', onFocus);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [identity, preferenceKey, save, userId]);

  const visible = state.identity === identity ? state : initialState(identity);
  return { ...visible, save, canSave: Boolean(identity) };
}
