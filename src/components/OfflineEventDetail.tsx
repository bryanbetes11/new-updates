import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Music, WifiOff } from 'lucide-react';
import { OfflineLiveMode } from './OfflineLiveMode';
import { getSavedEventSongs, getSavedSongChartText, type SavedEventDetail } from '../lib/offlineEvent';

export interface OfflineEventDetailProps {
  snapshot: SavedEventDetail;
  savedAt: number;
  onBack?: () => void;
  backLabel?: string;
  refreshing?: boolean;
  onLiveModeChange?: (open: boolean) => void;
}

export function OfflineEventDetail({ snapshot, savedAt, onBack, backLabel = 'Back to events', refreshing = false, onLiveModeChange }: OfflineEventDetailProps) {
  const [liveIndex, setLiveIndex] = useState<number | null>(null);
  const event = snapshot.event;
  const songs = getSavedEventSongs(snapshot);
  if (!event) return <p className="p-6 text-sm text-white/60">Saved event details are unavailable.</p>;
  const sourceLabel = event.event_type === 'Rehearsals' && snapshot.linkedApprovedSetlist?.status === 'approved' && snapshot.linkedApprovedSongs?.length
    ? snapshot.linkedServiceTitle || 'Linked approved service set'
    : 'Approved set';
  const date = event.event_date ? format(parseISO(event.event_date), 'MMM d, yyyy') : '';
  const savedDate = Number.isFinite(savedAt) ? format(new Date(savedAt), 'MMM d, yyyy h:mm a') : 'an earlier visit';
  const openLiveMode = (index: number) => {
    setLiveIndex(index);
    onLiveModeChange?.(true);
  };
  const closeLiveMode = () => {
    setLiveIndex(null);
    onLiveModeChange?.(false);
  };

  return <div className="page-container page-bottom-pad min-h-screen bg-[#050505] px-5 py-6 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
    <div className="mx-auto max-w-3xl space-y-6">
      {onBack && <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/75"><ArrowLeft className="h-4 w-4" />{backLabel}</button>}
      <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        <div className="flex items-start gap-2"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" /><span>{refreshing ? 'Showing saved event details while refreshing.' : 'Showing saved event details.'} Saved {savedDate}. Charts can be read here; live cues, edits, and responses need a connection.</span></div>
      </div>
      <div>
        <p className="text-sm font-semibold text-emerald-300">{event.event_type} · {date}{event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ''}</p>
        <h1 className="mt-2 text-3xl font-black">{event.title}</h1>
        {event.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/70">{event.description}</p>}
      </div>
      <section aria-label="Saved approved set" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{sourceLabel}</h2><p className="text-xs text-white/50">{songs.length ? `${songs.length} saved ${songs.length === 1 ? 'song' : 'songs'}` : 'No approved songs saved'}</p></div>
          {songs.length > 0 && <button type="button" onClick={() => openLiveMode(0)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-emerald-950"><Music className="h-4 w-4" />Open saved Live Mode</button>}
        </div>
        {songs.length ? <ol className="space-y-2">{songs.map((song, index) => <li key={song.id}><button type="button" onClick={() => openLiveMode(index)} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2 text-left hover:bg-white/[0.11]"><span className="text-white/45">{index + 1}.</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{song.songs?.title || 'Untitled song'}</span>{song.songs?.artist && <span className="block truncate text-xs text-white/50">{song.songs.artist}</span>}</span><span className="text-xs text-white/45">{getSavedSongChartText(song) ? 'Chart' : 'No chart'}</span></button></li>)}</ol>
          : <p className="text-sm leading-6 text-white/55">An approved chart set was not saved for this event. Open the event online while the set is approved to make it available here.</p>}
      </section>
    </div>
    {liveIndex !== null && <OfflineLiveMode songs={songs} title={event.title} sourceLabel={sourceLabel} initialIndex={liveIndex} onClose={closeLiveMode} />}
  </div>;
}
