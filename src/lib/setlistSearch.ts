export interface SearchableSetlistSong {
  performed_key?: string | null;
  songs?: {
    title?: string | null;
    artist?: string | null;
    song_key?: string | null;
  } | null;
}

export interface SearchableSetlist {
  id: string;
  event_id: string;
  events?: {
    title?: string | null;
    event_date?: string | null;
    event_type?: string | null;
  } | null;
  setlist_songs?: SearchableSetlistSong[] | null;
}

function normalizeSearchText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function setlistMatchesSearch(
  setlist: SearchableSetlist,
  search: string,
  songLeaderMap: Record<string, string> = {},
) {
  const query = normalizeSearchText(search);
  if (!query) return true;

  const fields = [
    setlist.events?.title,
    setlist.events?.event_date,
    setlist.events?.event_type,
    songLeaderMap[setlist.event_id],
    ...(setlist.setlist_songs || []).flatMap(song => [
      song.performed_key,
      song.songs?.title,
      song.songs?.artist,
      song.songs?.song_key,
    ]),
  ];

  return fields.some(field => normalizeSearchText(field).includes(query));
}

export function filterSetlistsBySearch<T extends SearchableSetlist>(
  setlists: T[],
  search: string,
  songLeaderMap: Record<string, string> = {},
) {
  return setlists.filter(setlist => setlistMatchesSearch(setlist, search, songLeaderMap));
}
