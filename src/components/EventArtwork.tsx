import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Heart, Lightbulb, Music2, Sparkles, Users, Video, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { hasArtworkArtist } from '../lib/songArtworkEligibility';
import { useNativeCachedImage } from '../lib/nativeImageCache';
import { useNativeImageCacheScope } from '../lib/nativeImageCache';
import { readPublicArtworkUrl, writePublicArtworkUrl } from '../lib/publicArtworkCache';

type EventArtworkSong = {
  title?: string | null;
  artist?: string | null;
  youtube_url?: string | null;
  songs?: EventArtworkSong | EventArtworkSong[] | null;
};

interface EventArtworkProps {
  eventType?: string | null;
  title?: string | null;
  artworkUrls?: string[];
  songs?: EventArtworkSong[] | null;
  className?: string;
  onArtworkUrlsChange?: (urls: string[]) => void;
}

const publicArtworkCache = new Map<string, string | null>();

const eventArtworkMeta: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  'Sunday Service': {
    icon: Music2,
    tone: 'bg-[#254b78]',
    label: 'Worship',
  },
  'Prayer Meeting': {
    icon: Heart,
    tone: 'bg-[#66528d]',
    label: 'Prayer',
  },
  'LGTF (Midweek)': {
    icon: Users,
    tone: 'bg-[#1d5d55]',
    label: 'Group',
  },
  Rehearsals: {
    icon: Music2,
    tone: 'bg-[#1d5d45]',
    label: 'Rehearsal',
  },
  'Online Devotion': {
    icon: BookOpen,
    tone: 'bg-[#824d69]',
    label: 'Devotion',
  },
  Equipping: {
    icon: Lightbulb,
    tone: 'bg-[#496b3e]',
    label: 'Training',
  },
  'Revamp Session': {
    icon: Zap,
    tone: 'bg-[#75572d]',
    label: 'Revamp',
  },
  'Youth Recharge': {
    icon: Sparkles,
    tone: 'bg-[#265b68]',
    label: 'Youth',
  },
  Video: {
    icon: Video,
    tone: 'bg-[#365776]',
    label: 'Video',
  },
};

function getEventArtworkMeta(eventType?: string | null, title?: string | null) {
  if (eventType && eventArtworkMeta[eventType]) return eventArtworkMeta[eventType];
  const lowerTitle = title?.toLowerCase() || '';
  if (lowerTitle.includes('rehears')) return eventArtworkMeta.Rehearsals;
  if (lowerTitle.includes('prayer')) return eventArtworkMeta['Prayer Meeting'];
  if (lowerTitle.includes('youth')) return eventArtworkMeta['Youth Recharge'];
  if (lowerTitle.includes('devotion')) return eventArtworkMeta['Online Devotion'];
  return {
    icon: CalendarDays,
    tone: 'bg-[#484a65]',
    label: eventType || 'Event',
  };
}

function getNestedSong(song: EventArtworkSong) {
  if (!song.songs) return song;
  return Array.isArray(song.songs) ? song.songs[0] || song : song.songs;
}

function getYouTubeThumbnailUrl(url?: string | null) {
  if (!url) return null;

  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `https://i.ytimg.com/vi/${match[1]}/hq720.jpg`;
  }

  return null;
}

function normalizeArtworkUrl(url?: string | null) {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, '/300x300bb.');
}

function getPublicSearchArtworkUrl(song: EventArtworkSong) {
  const nestedSong = getNestedSong(song);
  if (!hasArtworkArtist(nestedSong.artist)) return null;
  const searchTerm = [nestedSong.title?.trim(), nestedSong.artist?.trim(), 'album cover'].filter(Boolean).join(' ');
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

async function fetchPublicArtwork(song: EventArtworkSong, scope: string | null) {
  const nestedSong = getNestedSong(song);
  if (!hasArtworkArtist(nestedSong.artist)) return null;
  const searchTerm = [nestedSong.title?.trim(), nestedSong.artist?.trim()].filter(Boolean).join(' ');
  if (!searchTerm) return null;

  const cacheKey = `${scope || 'web'}:${searchTerm.toLowerCase()}`;
  if (publicArtworkCache.has(cacheKey)) return publicArtworkCache.get(cacheKey) || null;

  const savedUrl = await readPublicArtworkUrl(scope, searchTerm);
  if (savedUrl) {
    publicArtworkCache.set(cacheKey, savedUrl);
    return savedUrl;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);

  try {
    const artworkUrl = await fetchDeezerArtwork(searchTerm, controller.signal)
      || await fetchITunesArtwork(searchTerm, controller.signal);
    publicArtworkCache.set(cacheKey, artworkUrl);
    if (artworkUrl) void writePublicArtworkUrl(scope, searchTerm, artworkUrl);
    return artworkUrl;
  } catch {
    publicArtworkCache.set(cacheKey, null);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function ArtworkTile({ url, onFailure }: { url: string; onFailure: (url: string) => void }) {
  const image = useNativeCachedImage(url, { lazy: true });
  return (
    <div ref={image.observeRef} className="relative min-h-0 min-w-0 overflow-hidden bg-[#101010]">
      {image.src && <img
        src={image.src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => { if (!image.retryRemoteOnError()) onFailure(url); }}
      />}
    </div>
  );
}

export function EventArtwork({ eventType, title, artworkUrls = [], songs = null, className = '', onArtworkUrlsChange }: EventArtworkProps) {
  const cacheScope = useNativeImageCacheScope();
  const meta = getEventArtworkMeta(eventType, title);
  const Icon = meta.icon;
  const [publicArtworkUrls, setPublicArtworkUrls] = useState<string[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const firstSongs = useMemo(
    () => (songs || []).filter((song) => hasArtworkArtist(getNestedSong(song).artist)).slice(0, 4),
    [songs]
  );
  const videoArtworkUrls = useMemo(
    () => firstSongs
      .map((song) => getYouTubeThumbnailUrl(song.youtube_url || getNestedSong(song).youtube_url))
      .filter((url): url is string => Boolean(url)),
    [firstSongs]
  );
  const searchArtworkUrls = useMemo(
    () => firstSongs
      .map(getPublicSearchArtworkUrl)
      .filter((url): url is string => Boolean(url)),
    [firstSongs]
  );
  const availableArtworkKey = [...artworkUrls, ...videoArtworkUrls, ...searchArtworkUrls]
    .filter(Boolean)
    .join('|');
  const availableArtworkCount = useMemo(
    () => new Set(availableArtworkKey.split('|').filter(Boolean)).size,
    [availableArtworkKey]
  );
  const visibleArtworkUrls = [...publicArtworkUrls, ...artworkUrls, ...videoArtworkUrls, ...searchArtworkUrls]
    .filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index && !failedUrls.has(url))
    .slice(0, 4);
  const visibleArtworkUrlsKey = visibleArtworkUrls.join('|');

  useEffect(() => {
    let cancelled = false;
    setPublicArtworkUrls([]);
    setFailedUrls(new Set());

    if (firstSongs.length === 0) return undefined;

    // Prefer artwork already supplied by ServeSync or YouTube/search sources.
    // Avoid repeating external catalogue lookups for cards that can already
    // render a complete four-tile collage.
    if (availableArtworkCount >= 4) return undefined;

    Promise.all(firstSongs.map((song) => fetchPublicArtwork(song, cacheScope))).then((urls) => {
      if (cancelled) return;
      setPublicArtworkUrls(urls.filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index));
    });

    return () => {
      cancelled = true;
    };
  }, [availableArtworkCount, cacheScope, firstSongs]);

  useEffect(() => {
    onArtworkUrlsChange?.(visibleArtworkUrls);
  }, [onArtworkUrlsChange, visibleArtworkUrlsKey]);

  if (visibleArtworkUrls.length > 0) {
    return (
      <div className={`relative isolate shrink-0 overflow-hidden bg-[#111111] ${className}`}>
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/70">
          {Array.from({ length: 4 }).map((_, index) => {
            const url = visibleArtworkUrls[index] || visibleArtworkUrls[index % visibleArtworkUrls.length];
            return (
              <ArtworkTile
                key={`${url}-${index}`}
                url={url}
                onFailure={(failedUrl) => setFailedUrls((current) => new Set(current).add(failedUrl))}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative isolate shrink-0 overflow-hidden ${meta.tone} ${className}`}>
      <div className="flex h-full w-full items-center justify-center">
        <span className="keep-white flex h-9 w-9 items-center justify-center text-white">
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}
