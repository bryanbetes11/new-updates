import { differenceInDays, parseISO } from 'date-fns';

export interface SongUsageSong {
  id: string;
  title: string;
  artist?: string | null;
  song_key?: string | null;
  created_by?: string | null;
  youtube_url?: string | null;
  chordpro_text?: string | null;
}

export interface SongUsageSetlist {
  id: string;
  event_id: string;
  events?: {
    title?: string | null;
    event_date?: string | null;
    event_type?: string | null;
  } | null;
  setlist_songs?: Array<{
    id: string;
    song_id: string;
    position?: number | null;
  }> | null;
}

export interface SongUsageEvent {
  setlist_id: string;
  setlist_song_id: string;
  event_id: string;
  event_title: string;
  event_type: string;
  event_date: string;
  days_since: number;
  position: number | null;
}

export interface SongUsageSummary extends SongUsageSong {
  title: string;
  artist: string;
  song_key: string;
  last_used_date: string | null;
  days_since: number | null;
  is_safe: boolean;
  latest_usage: SongUsageEvent | null;
  usages: SongUsageEvent[];
}

interface BuildSongUsagesOptions {
  songs: SongUsageSong[];
  setlists: SongUsageSetlist[];
  now?: Date;
  ruleDays: number;
  sanitizeTitle?: (title: string) => string;
}

export function buildSongUsages({
  songs,
  setlists,
  now = new Date(),
  ruleDays,
  sanitizeTitle = title => title,
}: BuildSongUsagesOptions): SongUsageSummary[] {
  const usageMap: Record<string, SongUsageEvent[]> = {};

  setlists.forEach(setlist => {
    const eventDate = setlist.events?.event_date;
    if (!eventDate) return;

    const daysSince = differenceInDays(now, parseISO(eventDate));
    const eventTitle = setlist.events?.title?.trim() || 'Untitled event';
    const eventType = setlist.events?.event_type?.trim() || 'Event';

    setlist.setlist_songs?.forEach(setlistSong => {
      const usage: SongUsageEvent = {
        setlist_id: setlist.id,
        setlist_song_id: setlistSong.id,
        event_id: setlist.event_id,
        event_title: eventTitle,
        event_type: eventType,
        event_date: eventDate,
        days_since: daysSince,
        position: typeof setlistSong.position === 'number' ? setlistSong.position : null,
      };

      usageMap[setlistSong.song_id] = [...(usageMap[setlistSong.song_id] || []), usage];
    });
  });

  return songs.map(song => {
    const usages = [...(usageMap[song.id] || [])].sort((a, b) => {
      const dateCompare = b.event_date.localeCompare(a.event_date);
      if (dateCompare !== 0) return dateCompare;
      return (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);
    });
    const latestUsage = usages[0] || null;
    const daysSince = latestUsage?.days_since ?? null;

    return {
      ...song,
      title: sanitizeTitle(song.title),
      artist: song.artist || '',
      song_key: song.song_key || '',
      created_by: song.created_by ?? null,
      youtube_url: song.youtube_url ?? null,
      chordpro_text: song.chordpro_text ?? null,
      last_used_date: latestUsage?.event_date ?? null,
      days_since: daysSince,
      is_safe: daysSince === null || daysSince >= ruleDays,
      latest_usage: latestUsage,
      usages,
    };
  });
}
