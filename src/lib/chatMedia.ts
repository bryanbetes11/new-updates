import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const storageOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
const publicPrefix = `${storageOrigin}/storage/v1/object/public/chat-attachments/`;
const signedUrls = new Map<string, { url: string; usableUntil: number }>();
const signing = new Map<string, Promise<void>>();
let cacheUserId = '';
let cacheEpoch = 0;

export function chatMediaPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const absolute = `${parsed.origin}${parsed.pathname}`;
    if (!absolute.startsWith(publicPrefix)) return null;
    const path = decodeURIComponent(absolute.slice(publicPrefix.length));
    return path && !path.includes('..') ? path : null;
  } catch { return null; }
}

// The stored public URL is a stable object reference, not a fetchable link.
// A private bucket only serves the short-lived URL after its SELECT policy
// confirms current conversation membership.
export function chatMediaUrl(url: string): string {
  if (!chatMediaPath(url)) return url;
  const cached = signedUrls.get(url);
  return cached && cached.usableUntil > Date.now() ? cached.url : '';
}

export function chatMediaReferences(content: string): string[] {
  try {
    const parsed = JSON.parse(content);
    const value = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    return (value?.type === 'image' || value?.type === 'file') && typeof value.url === 'string'
      ? [value.url] : [];
  } catch { return []; }
}

async function signMediaUrl(url: string): Promise<void> {
  const path = chatMediaPath(url);
  if (!path || (signedUrls.get(url)?.usableUntil ?? 0) > Date.now()) return;
  if (signing.has(url)) return signing.get(url);
  const epoch = cacheEpoch;
  const task = (async () => {
    const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 120);
    if (epoch !== cacheEpoch) return;
    if (error || !data?.signedUrl) { signedUrls.delete(url); return; }
    signedUrls.set(url, { url: data.signedUrl, usableUntil: Date.now() + 90_000 });
  })();
  signing.set(url, task);
  try { await task; } finally { signing.delete(url); }
}

export function useChatMediaUrls(urls: string[], userId: string): void {
  const [, refresh] = useState(0);
  const key = urls.join('\n');
  useEffect(() => {
    if (cacheUserId !== userId) { signedUrls.clear(); signing.clear(); cacheUserId = userId; cacheEpoch += 1; }
    if (!userId) return;
    let active = true;
    const update = () => {
      void Promise.allSettled(urls.map(signMediaUrl)).then(() => { if (active) refresh(n => n + 1); });
    };
    update();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') update();
    }, 90_000);
    window.addEventListener('focus', update);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', update); };
  // The URL list is represented by key so unrelated message state does not restart signing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, userId]);
}
