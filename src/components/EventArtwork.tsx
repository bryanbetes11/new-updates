import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Heart, Lightbulb, Music2, Sparkles, Users, Video, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
}

const publicArtworkCache = new Map<string, string | null>();

const eventArtworkMeta: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  'Sunday Service': {
    icon: Music2,
    tone: 'from-blue-500 via-indigo-900 to-black',
    label: 'Worship',
  },
  'Prayer Meeting': {
    icon: Heart,
    tone: 'from-violet-400 via-purple-900 to-black',
    label: 'Prayer',
  },
  'LGTF (Midweek)': {
    icon: Users,
    tone: 'from-teal-300 via-emerald-800 to-black',
    label: 'Group',
  },
  Rehearsals: {
    icon: Music2,
    tone: 'from-emerald-300 via-emerald-800 to-black',
    label: 'Rehearsal',
  },
  'Online Devotion': {
    icon: BookOpen,
    tone: 'from-pink-400 via-rose-900 to-black',
    label: 'Devotion',
  },
  Equipping: {
    icon: Lightbulb,
    tone: 'from-lime-300 via-green-800 to-black',
    label: 'Training',
  },
  'Revamp Session': {
    icon: Zap,
    tone: 'from-orange-300 via-orange-900 to-black',
    label: 'Revamp',
  },
  'Youth Recharge': {
    icon: Sparkles,
    tone: 'from-cyan-300 via-blue-900 to-black',
    label: 'Youth',
  },
  Video: {
    icon: Video,
    tone: 'from-sky-300 via-slate-800 to-black',
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
    tone: 'from-zinc-200 via-zinc-700 to-black',
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

async function fetchPublicArtwork(song: EventArtworkSong) {
  const nestedSong = getNestedSong(song);
  const searchTerm = [nestedSong.title?.trim(), nestedSong.artist?.trim()].filter(Boolean).join(' ');
  if (!searchTerm) return null;

  const cacheKey = searchTerm.toLowerCase();
  if (publicArtworkCache.has(cacheKey)) return publicArtworkCache.get(cacheKey) || null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);

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

export function EventArtwork({ eventType, title, artworkUrls = [], songs = null, className = '' }: EventArtworkProps) {
  const meta = getEventArtworkMeta(eventType, title);
  const Icon = meta.icon;
  const [publicArtworkUrls, setPublicArtworkUrls] = useState<string[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const firstSongs = useMemo(() => (songs || []).slice(0, 4), [songs]);
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
  const visibleArtworkUrls = [...publicArtworkUrls, ...artworkUrls, ...videoArtworkUrls, ...searchArtworkUrls]
    .filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index && !failedUrls.has(url))
    .slice(0, 4);

  useEffect(() => {
    let cancelled = false;
    setPublicArtworkUrls([]);
    setFailedUrls(new Set());

    if (firstSongs.length === 0) return undefined;

    Promise.all(firstSongs.map(fetchPublicArtwork)).then((urls) => {
      if (cancelled) return;
      setPublicArtworkUrls(urls.filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index));
    });

    return () => {
      cancelled = true;
    };
  }, [firstSongs]);

  if (visibleArtworkUrls.length > 0) {
    return (
      <div className={`relative isolate shrink-0 overflow-hidden bg-[#111111] ${className}`}>
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/70">
          {Array.from({ length: 4 }).map((_, index) => {
            const url = visibleArtworkUrls[index] || visibleArtworkUrls[index % visibleArtworkUrls.length];
            return (
              <div key={`${url}-${index}`} className="relative min-h-0 min-w-0 overflow-hidden bg-[#101010]">
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedUrls((current) => new Set(current).add(url))}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(0,0,0,0.30))]" />
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      </div>
    );
  }

  return (
    <div className={`relative isolate shrink-0 overflow-hidden bg-gradient-to-br ${meta.tone} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.30),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.42))]" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
      <div className="relative flex h-full w-full items-center justify-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-black/48 text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}
