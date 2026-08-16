export type ChatEventReferenceKind = 'event' | 'setlist' | 'song' | 'observation';

export type ChatEventReference = {
  type: 'event_reference';
  reference: ChatEventReferenceKind;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string | null;
  songCount?: number;
  songTitles?: string[];
  song?: {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    youtubeUrl?: string | null;
  };
  songMentions?: Array<{
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    youtubeUrl?: string | null;
  }>;
  messageText?: string;
};

export type ChatSongMention = NonNullable<ChatEventReference['song']>;
export type InlineSongSegment = { type: 'text'; text: string } | { type: 'song'; song: ChatSongMention };

export function getInlineSongSegments(messageText: string, songs: ChatSongMention[]): InlineSongSegment[] {
  const uniqueSongs = Array.from(new Map(songs.map(song => [song.id, song])).values());
  const searchableText = messageText.toLocaleLowerCase();
  const matches = uniqueSongs.flatMap(song => {
    const result: Array<{ start: number; end: number; song: ChatSongMention }> = [];
    const titleVariants = Array.from(new Set([
      song.title,
      song.title.replace(/[\s)\]}.,!?]+$/g, ''),
    ].filter(Boolean)));
    const tokens = titleVariants.flatMap(title => [`♪ ${title}`, `♪${title}`]);
    for (const token of tokens) {
      const searchableToken = token.toLocaleLowerCase();
      let start = searchableText.indexOf(searchableToken);
      while (start >= 0) {
        result.push({ start, end: start + token.length, song });
        start = searchableText.indexOf(searchableToken, start + token.length);
      }
    }
    return result;
  }).sort((left, right) => left.start - right.start || right.end - left.end);

  const segments: InlineSongSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) segments.push({ type: 'text', text: messageText.slice(cursor, match.start) });
    segments.push({ type: 'song', song: match.song });
    cursor = match.end;
  }
  if (cursor < messageText.length) segments.push({ type: 'text', text: messageText.slice(cursor) });
  return segments.length > 0 ? segments : [{ type: 'text', text: messageText }];
}

type ReferenceEvent = {
  id: string;
  title: string;
  event_date: string;
  event_type: string | null;
  songs: Array<{
    id: string;
    title: string;
    artist: string | null;
    performed_key: string | null;
    song_key: string | null;
    youtube_url?: string | null;
  }>;
};

export function createChatEventReference(
  reference: ChatEventReferenceKind,
  event: ReferenceEvent,
  song?: ReferenceEvent['songs'][number],
  messageText?: string,
  songMentions?: ReferenceEvent['songs'],
): string {
  const payload: ChatEventReference = {
    type: 'event_reference',
    reference,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.event_date,
    eventType: event.event_type,
  };

  if (reference === 'setlist') {
    payload.songCount = event.songs.length;
    payload.songTitles = event.songs.slice(0, 4).map(item => item.title);
  }

  if (reference === 'song' && song) {
    payload.song = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      key: song.performed_key || song.song_key,
      youtubeUrl: song.youtube_url || null,
    };
    if (songMentions?.length) {
      payload.songMentions = songMentions.map(item => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        key: item.performed_key || item.song_key,
        youtubeUrl: item.youtube_url || null,
      }));
    }
    if (messageText?.trim()) payload.messageText = messageText.trim();
  }

  return JSON.stringify(payload);
}

export function parseChatEventReference(value: unknown): ChatEventReference | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const reference = candidate.reference;
  if (
    candidate.type !== 'event_reference'
    || !['event', 'setlist', 'song', 'observation'].includes(String(reference))
    || typeof candidate.eventId !== 'string'
    || typeof candidate.eventTitle !== 'string'
    || typeof candidate.eventDate !== 'string'
  ) {
    return null;
  }

  const parsed: ChatEventReference = {
    type: 'event_reference',
    reference: reference as ChatEventReferenceKind,
    eventId: candidate.eventId,
    eventTitle: candidate.eventTitle,
    eventDate: candidate.eventDate,
    eventType: typeof candidate.eventType === 'string' ? candidate.eventType : null,
  };

  if (typeof candidate.songCount === 'number') parsed.songCount = candidate.songCount;
  if (Array.isArray(candidate.songTitles)) {
    parsed.songTitles = candidate.songTitles.filter((title): title is string => typeof title === 'string').slice(0, 4);
  }

  if (candidate.song && typeof candidate.song === 'object') {
    const song = candidate.song as Record<string, unknown>;
    if (typeof song.id === 'string' && typeof song.title === 'string') {
      parsed.song = {
        id: song.id,
        title: song.title,
        artist: typeof song.artist === 'string' ? song.artist : null,
        key: typeof song.key === 'string' ? song.key : null,
        youtubeUrl: typeof song.youtubeUrl === 'string' ? song.youtubeUrl : null,
      };
    }
  }

  if (Array.isArray(candidate.songMentions)) {
    parsed.songMentions = candidate.songMentions.flatMap(value => {
      if (!value || typeof value !== 'object') return [];
      const song = value as Record<string, unknown>;
      if (typeof song.id !== 'string' || typeof song.title !== 'string') return [];
      return [{
        id: song.id,
        title: song.title,
        artist: typeof song.artist === 'string' ? song.artist : null,
        key: typeof song.key === 'string' ? song.key : null,
        youtubeUrl: typeof song.youtubeUrl === 'string' ? song.youtubeUrl : null,
      }];
    });
  }

  if (typeof candidate.messageText === 'string' && candidate.messageText.trim()) {
    parsed.messageText = candidate.messageText.trim();
  }

  if (parsed.reference === 'song' && !parsed.song) return null;
  return parsed;
}

export function getChatCommandQuery(text: string): string | null {
  const match = text.match(/^\/([a-z]*)$/i);
  return match ? match[1].toLowerCase() : null;
}

export function getInlineSongShortcut(text: string): { start: number; query: string } | null {
  const match = text.match(/(^|\s)\/([^/\n]*)$/i);
  if (!match || match.index === undefined) return null;
  const rawQuery = match[2].trim();
  if (!rawQuery) return null;
  const lowerQuery = rawQuery.toLowerCase();
  const reservedCommands = ['setlist', 'song', 'observe'];
  if (!rawQuery.includes(' ') && reservedCommands.some(command => command.startsWith(lowerQuery))) return null;
  return {
    start: match.index + match[1].length,
    query: lowerQuery.startsWith('song ') ? lowerQuery.slice(5).trim() : lowerQuery,
  };
}

export function getSongYoutubeTarget(song: ChatSongMention): string {
  if (song.youtubeUrl?.trim()) return song.youtubeUrl.trim();
  const query = [song.title.trim(), song.artist?.trim()].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
