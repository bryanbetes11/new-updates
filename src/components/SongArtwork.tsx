import { useEffect, useMemo, useState } from 'react';
import { Music } from 'lucide-react';

type SongArtworkSong = {
  title?: string | null;
  artist?: string | null;
  youtube_url?: string | null;
};

interface SongArtworkProps {
  song?: SongArtworkSong | SongArtworkSong[] | null;
  youtubeUrl?: string | null;
  className?: string;
}

const publicArtworkCache = new Map<string, string | null>();

function getYouTubeThumbnailUrl(url?: string | null) {
  if (!url) return null;

  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }

  return null;
}

function normalizeArtworkUrl(url?: string | null) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, '/300x300bb.');
}

function getPublicSearchArtworkUrl(title?: string | null, artist?: string | null) {
  const searchTerm = [title?.trim(), artist?.trim(), 'album cover'].filter(Boolean).join(' ');
  if (!searchTerm) return null;
  const params = new URLSearchParams({
    q: searchTerm,
    w: '300',
    h: '300',
    c: '7',
    rs: '1',
    p: '0',
    o: '5',
    pid: '1.7',
  });
  return `https://tse.mm.bing.net/th?${params.toString()}`;
}

async function fetchDeezerArtwork(searchTerm: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    q: searchTerm,
    limit: '1',
  });
  const response = await fetch(`https://api.deezer.com/search?${params.toString()}`, { signal });
  if (!response.ok) return null;

  const data = await response.json() as {
    data?: Array<{
      album?: {
        cover_medium?: string;
        cover_big?: string;
        cover_xl?: string;
      };
    }>;
  };
  return data.data?.[0]?.album?.cover_big || data.data?.[0]?.album?.cover_medium || data.data?.[0]?.album?.cover_xl || null;
}

async function fetchITunesArtwork(searchTerm: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    term: searchTerm,
    entity: 'song',
    media: 'music',
    limit: '1',
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, { signal });
  if (!response.ok) return null;

  const data = await response.json() as { results?: Array<{ artworkUrl100?: string; artworkUrl60?: string }> };
  return normalizeArtworkUrl(data.results?.[0]?.artworkUrl100 || data.results?.[0]?.artworkUrl60);
}

async function fetchPublicArtwork(title?: string | null, artist?: string | null) {
  const searchTerm = [title?.trim(), artist?.trim()].filter(Boolean).join(' ');
  if (!searchTerm) return null;

  const cacheKey = searchTerm.toLowerCase();
  if (publicArtworkCache.has(cacheKey)) return publicArtworkCache.get(cacheKey) || null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1800);

  try {
    const artworkUrl = await fetchDeezerArtwork(searchTerm, controller.signal)
      || await fetchITunesArtwork(searchTerm, controller.signal);
    publicArtworkCache.set(cacheKey, artworkUrl);
    return artworkUrl;
  } catch {
    publicArtworkCache.set(cacheKey, null);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function SongArtwork({ song, youtubeUrl, className = 'h-10 w-10 rounded-lg' }: SongArtworkProps) {
  const normalizedSong = Array.isArray(song) ? song[0] || null : song;
  const [publicArtworkUrl, setPublicArtworkUrl] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const videoArtworkUrl = useMemo(
    () => getYouTubeThumbnailUrl(youtubeUrl || normalizedSong?.youtube_url),
    [normalizedSong?.youtube_url, youtubeUrl]
  );
  const title = normalizedSong?.title?.trim() || '';
  const artist = normalizedSong?.artist?.trim() || '';
  const searchArtworkUrl = useMemo(() => getPublicSearchArtworkUrl(title, artist), [artist, title]);
  const artworkUrl = [publicArtworkUrl, videoArtworkUrl, searchArtworkUrl].find((url): url is string => Boolean(url) && !failedUrls.has(url)) || null;

  useEffect(() => {
    let cancelled = false;
    setPublicArtworkUrl(null);
    setFailedUrls(new Set());

    if (!title && !artist) return undefined;

    fetchPublicArtwork(title, artist).then((url) => {
      if (!cancelled) setPublicArtworkUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [artist, title, videoArtworkUrl]);

  return (
    <div className={`relative isolate shrink-0 overflow-hidden bg-[#101010] ${className}`}>
      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrls((current) => new Set(current).add(artworkUrl))}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_25%,rgba(34,197,94,0.42),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.14),rgba(0,0,0,0.92))]">
          <Music className="h-4 w-4 text-white/70" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(0,0,0,0.30))]" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}
