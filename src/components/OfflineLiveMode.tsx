import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Pause, Play, Plus } from 'lucide-react';
import type { SetlistSong } from '../types';
import { detectChordProKey, getKeyTransposeOffset, parseChordPro, parseChordProMetadata, transposeChord, transposeKey } from '../lib/chordPro';
import { arrangeSavedChartLines, getSavedSongChartText } from '../lib/offlineEvent';
import { useScreenAwake } from '../hooks/useScreenAwake';
import { nativeBackHandlers } from '../lib/nativeBack';

export interface OfflineLiveModeProps {
  songs: SetlistSong[];
  title?: string;
  sourceLabel?: string;
  onClose: () => void;
  initialIndex?: number;
}

export function OfflineLiveMode({ songs, title, sourceLabel, onClose, initialIndex = 0 }: OfflineLiveModeProps) {
  useScreenAwake(true);
  const orderedSongs = useMemo(() => songs.slice().sort((a, b) => (a.position || 0) - (b.position || 0)), [songs]);
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(0, songs.length - 1)));
  const [transposeSteps, setTransposeSteps] = useState(0);
  const [textSize, setTextSize] = useState(18);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(28);
  const scrollRef = useRef<HTMLDivElement>(null);
  const song = orderedSongs[Math.min(index, orderedSongs.length - 1)];
  const chartText = song ? getSavedSongChartText(song) : '';
  const chartKey = parseChordProMetadata(chartText).key || song?.songs?.song_key || detectChordProKey(chartText, '') || '';
  const performedOffset = getKeyTransposeOffset(chartKey, song?.performed_key || chartKey);
  const offset = performedOffset + transposeSteps;
  const displayedKey = chartKey ? transposeKey(chartKey, offset) : '';
  const lines = useMemo(() => arrangeSavedChartLines(parseChordPro(chartText).map(line => line.type === 'lyrics' && line.chords
    ? { ...line, chords: transposeChord(line.chords, offset) } : line), song?.arrangement_section_order), [chartText, offset, song?.arrangement_section_order]);

  useEffect(() => nativeBackHandlers.register(() => { onClose(); return true; }, 20), [onClose]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setTransposeSteps(0);
    setAutoScroll(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [index]);

  useEffect(() => {
    if (!autoScroll) return;
    const element = scrollRef.current;
    if (!element) return;
    let frame = 0;
    let last = 0;
    let fractional = 0;
    const tick = (time: number) => {
      if (last) {
        fractional += Math.min((time - last) / 1000, 0.1) * scrollSpeed;
        const pixels = Math.floor(fractional);
        if (pixels) {
          element.scrollTop += pixels;
          fractional -= pixels;
        }
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 1) {
          setAutoScroll(false);
          return;
        }
      }
      last = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoScroll, index, scrollSpeed]);

  const navigate = (next: number) => {
    if (next < 0 || next >= orderedSongs.length) return;
    setIndex(next);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#101411] text-white" role="dialog" aria-modal="true" aria-label="Saved Live Mode">
      <header className="shrink-0 border-b border-white/10 bg-[#172019] px-3 py-3 sm:px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Close saved Live Mode" className="flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-white/80 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">Back</span></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-emerald-300">Saved Live Mode · Charts only</p>
            <h1 className="truncate text-base font-black sm:text-lg">{title || sourceLabel || 'Approved set'}</h1>
          </div>
          <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-200">Read only</span>
        </div>
      </header>
      {orderedSongs.length ? (
        <>
          <div className="shrink-0 border-b border-white/10 px-3 py-3 sm:px-5">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
              <label htmlFor="saved-live-song" className="sr-only">Choose song</label>
              <select id="saved-live-song" value={index} onChange={event => navigate(Number(event.target.value))} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-[#273329] px-3 text-sm font-semibold text-white sm:max-w-sm">
                {orderedSongs.map((item, itemIndex) => <option key={item.id} value={itemIndex}>{itemIndex + 1}. {item.songs?.title || 'Untitled song'}</option>)}
              </select>
              <span className="text-sm text-white/60">{index + 1} of {orderedSongs.length}</span>
              <span className="ml-auto rounded-lg bg-white/10 px-2 py-1 text-sm font-bold">{displayedKey ? `Key ${displayedKey}` : 'Key unavailable'}</span>
            </div>
            <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-2 text-sm">
              <span className="mr-1 text-white/60">Transpose</span>
              <button type="button" onClick={() => setTransposeSteps(value => Math.max(-11, value - 1))} disabled={transposeSteps <= -11} aria-label="Transpose down" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="min-w-6 text-center font-bold">{transposeSteps > 0 ? `+${transposeSteps}` : transposeSteps}</span>
              <button type="button" onClick={() => setTransposeSteps(value => Math.min(11, value + 1))} disabled={transposeSteps >= 11} aria-label="Transpose up" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              <span className="ml-2 mr-1 text-white/60">Text</span>
              <button type="button" onClick={() => setTextSize(value => Math.max(14, value - 2))} disabled={textSize <= 14} aria-label="Smaller text" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="min-w-5 text-center font-bold">{textSize}</span>
              <button type="button" onClick={() => setTextSize(value => Math.min(32, value + 2))} disabled={textSize >= 32} aria-label="Larger text" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              <button type="button" onClick={() => setAutoScroll(value => !value)} aria-pressed={autoScroll} className="ml-auto flex min-h-10 items-center gap-1 rounded-lg bg-emerald-500/20 px-3 font-semibold text-emerald-100">{autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{autoScroll ? 'Pause scroll' : 'Auto scroll'}</button>
              <label className="flex items-center gap-2 text-white/70">Speed <input type="range" min="10" max="90" step="5" value={scrollSpeed} onChange={event => setScrollSpeed(Number(event.target.value))} aria-label="Scroll speed" className="w-20 accent-emerald-400" /></label>
            </div>
          </div>
          <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8" aria-label="Saved song chart">
            <div className="mx-auto max-w-5xl pb-24">
              <h2 className="text-xl font-black">{song?.songs?.title || 'Untitled song'}</h2>
              {song?.songs?.artist && <p className="mt-1 text-sm text-white/55">{song.songs.artist}</p>}
              {song?.notes && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">{song.notes}</p>}
              {chartText ? <div className="mt-6 font-mono leading-relaxed" style={{ fontSize: `${textSize}px` }}>
                {lines.map((line, lineIndex) => line.type === 'section'
                  ? <h3 key={lineIndex} className="mb-2 mt-6 border-b border-emerald-400/20 pb-1 font-sans font-bold text-emerald-300">{line.section}</h3>
                  : line.type === 'blank' ? <div key={lineIndex} className="h-5" />
                    : <div key={lineIndex} className="mb-1 overflow-x-auto whitespace-pre">{line.chords && <div className="font-bold text-emerald-300">{line.chords}</div>}<div>{line.lyrics || '\u00a0'}</div></div>)}
              </div> : <p className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">No chart or lyrics were saved for this song.</p>}
            </div>
          </main>
          <footer className="shrink-0 border-t border-white/10 bg-[#172019] px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <button type="button" onClick={() => navigate(index - 1)} disabled={index === 0} className="flex min-h-11 items-center gap-1 rounded-lg px-3 font-bold disabled:opacity-35"><ChevronLeft className="h-5 w-5" />Previous</button>
              <span className="truncate text-xs text-white/50">{sourceLabel || 'Saved approved set'}</span>
              <button type="button" onClick={() => navigate(index + 1)} disabled={index >= orderedSongs.length - 1} className="flex min-h-11 items-center gap-1 rounded-lg px-3 font-bold disabled:opacity-35">Next<ChevronRight className="h-5 w-5" /></button>
            </div>
          </footer>
        </>
      ) : <div className="flex flex-1 items-center justify-center px-5 text-center text-white/60">No approved songs were saved for this set.</div>}
    </div>
  );
}
