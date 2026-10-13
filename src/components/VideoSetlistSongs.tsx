import { Music } from 'lucide-react';
import { sanitizeSongTitle } from '../lib/songTitle';
import { getVideoSetlistSongs, type VideoSetlist } from '../lib/videoSetlist';

export function VideoSetlistSongs({ setlist, compact = false, saved = false }: { setlist: VideoSetlist; compact?: boolean; saved?: boolean }) {
  const songs = getVideoSetlistSongs(setlist);
  return <div className={compact ? 'mt-3 rounded-xl bg-gray-50 p-2.5 dark:bg-white/[0.035] sm:p-3' : 'rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/[0.04]'}>
    <div className="flex flex-wrap items-center justify-between gap-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"><Music className="h-3.5 w-3.5 shrink-0" />{saved ? 'Saved set' : 'Matched set'}</p>
      <span className="text-[10px] font-semibold text-gray-500 dark:text-white/45">{songs.length} song{songs.length === 1 ? '' : 's'}</span>
    </div>
    {!compact && <p className="mt-1 text-xs text-gray-600 dark:text-white/55">{setlist.events?.event_type || 'Approved set'}{setlist.events?.title ? ` · ${setlist.events.title}` : ''}</p>}
    {songs.length ? <ol aria-label={compact ? 'Songs in the matched set' : 'Full matched set'} className={compact ? 'mt-2 space-y-1' : 'mt-3 space-y-2.5'}>
      {songs.map((song, index) => <li key={song.id} className="flex min-w-0 items-start gap-2">
        <span aria-hidden="true" className="w-4 shrink-0 pt-px text-[11px] font-semibold text-gray-400 dark:text-white/35">{index + 1}.</span>
        <span className={`min-w-0 flex-1 break-words text-gray-700 dark:text-white/75 ${compact ? 'text-[11px] leading-4 sm:text-xs sm:leading-5' : 'text-sm font-semibold'}`} title={sanitizeSongTitle(song.songs?.title || 'Unavailable song')}>
          {sanitizeSongTitle(song.songs?.title || 'Unavailable song')}
          {!compact && song.songs?.artist && <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-white/45">{song.songs.artist}</span>}
        </span>
        {!compact && (song.performed_key || song.songs?.song_key) && <span className="shrink-0 rounded-md bg-white/80 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-white/[0.06] dark:text-white/55">{song.performed_key || song.songs?.song_key}</span>}
      </li>)}
    </ol> : <p className="mt-2 text-xs text-gray-500 dark:text-white/45">No songs in this set yet.</p>}
    {!compact && <p className="mt-3 text-[11px] text-gray-500 dark:text-white/40">Song order from the approved set in Sets.{saved ? ' Showing a saved copy.' : ''}</p>}
  </div>;
}
