import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const prefix = `${new URL(import.meta.env.VITE_SUPABASE_URL).origin}/storage/v1/object/public/announcements/`;
const cache = new Map<string, { url: string; expires: number }>();
let activeUser = '';
let epoch = 0;

function pathFor(url: string): string | null {
  try {
    const parsed = new URL(url);
    const absolute = `${parsed.origin}${parsed.pathname}`;
    if (!absolute.startsWith(prefix)) return null;
    const path = decodeURIComponent(absolute.slice(prefix.length));
    return path && !path.includes('..') ? path : null;
  } catch { return null; }
}

export function announcementImageUrl(url: string): string {
  if (!pathFor(url)) return url;
  const found = cache.get(url);
  return found && found.expires > Date.now() ? found.url : '';
}

export function useAnnouncementImages(urls: string[], userId: string): void {
  const [, setVersion] = useState(0);
  const key = urls.join('\n');
  useEffect(() => {
    if (activeUser !== userId) { activeUser = userId; epoch += 1; cache.clear(); }
    if (!userId) return;
    const currentEpoch = epoch;
    let mounted = true;
    const update = async () => {
      await Promise.allSettled(urls.map(async url => {
        const path = pathFor(url);
        if (!path || (cache.get(url)?.expires ?? 0) > Date.now()) return;
        const { data, error } = await supabase.storage.from('announcements').createSignedUrl(path, 120);
        if (currentEpoch === epoch && !error && data?.signedUrl) {
          cache.set(url, { url: data.signedUrl, expires: Date.now() + 90_000 });
        }
      }));
      if (mounted) setVersion(value => value + 1);
    };
    void update();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void update(); }, 90_000);
    window.addEventListener('focus', update);
    return () => { mounted = false; window.clearInterval(timer); window.removeEventListener('focus', update); };
  // URLs are represented by key to avoid re-signing on unrelated state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key,userId]);
}
