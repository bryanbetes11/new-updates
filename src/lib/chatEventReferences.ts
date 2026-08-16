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
  };
};

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
  }>;
};

export function createChatEventReference(
  reference: ChatEventReferenceKind,
  event: ReferenceEvent,
  song?: ReferenceEvent['songs'][number],
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
    };
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
      };
    }
  }

  if (parsed.reference === 'song' && !parsed.song) return null;
  return parsed;
}

export function getChatCommandQuery(text: string): string | null {
  const match = text.match(/^\/([a-z]*)$/i);
  return match ? match[1].toLowerCase() : null;
}
