import { supabase } from './supabase';

export async function loadSyncedPreference<T>(userId: string | undefined, key: string): Promise<T | null> {
  if (!userId) return null;
  const { data, error } = await supabase.from('user_ui_preferences').select('preference_value').eq('user_id', userId).eq('preference_key', key).maybeSingle();
  if (error || !data) return null;
  return data.preference_value as T;
}

export async function saveSyncedPreference(userId: string | undefined, key: string, value: unknown) {
  if (!userId) return;
  await supabase.from('user_ui_preferences').upsert({ user_id: userId, preference_key: key, preference_value: value }, { onConflict: 'user_id,preference_key' });
}

export function cacheSnapshot<T>(key: string, value: T) {
  try { localStorage.setItem(`servesync:snapshot:${key}`, JSON.stringify({ savedAt: new Date().toISOString(), value })); } catch { /* optional cache */ }
}

export function loadSnapshot<T>(key: string): { savedAt: string; value: T } | null {
  try {
    const raw = localStorage.getItem(`servesync:snapshot:${key}`);
    return raw ? JSON.parse(raw) as { savedAt: string; value: T } : null;
  } catch { return null; }
}
