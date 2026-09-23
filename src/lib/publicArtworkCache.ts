import { readDeviceSnapshot, writeDeviceSnapshot } from './deviceCache';

const METADATA_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function readPublicArtworkUrl(scope: string | null, searchTerm: string): Promise<string | null> {
  if (!scope) return null;
  try {
    const entry = await readDeviceSnapshot<string>(scope, `public-artwork-v1:${searchTerm.toLowerCase()}`);
    return entry && Date.now() - entry.savedAt < METADATA_AGE_MS && entry.value.startsWith('https://')
      ? entry.value : null;
  } catch {
    return null;
  }
}

export async function writePublicArtworkUrl(scope: string | null, searchTerm: string, url: string): Promise<void> {
  if (!scope || !url.startsWith('https://')) return;
  try {
    await writeDeviceSnapshot(scope, `public-artwork-v1:${searchTerm.toLowerCase()}`, url);
  } catch {
    // Artwork still renders when optional metadata persistence is unavailable.
  }
}
