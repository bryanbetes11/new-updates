import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deviceCacheScope, listDeviceSnapshots, readDeviceSnapshot } from '../lib/deviceCache';
import { isSavedEventDetail, type SavedEventDetail } from '../lib/offlineEvent';
import { OfflineEventDetail } from '../components/OfflineEventDetail';
import { OfflineLiveMode } from '../components/OfflineLiveMode';
import type { Event, SetlistSong, Song } from '../types';
import type { SongUsageSummary } from '../lib/songUsage';

type Saved<T> = { value: T; savedAt: number };
interface SavedLibrary { songUsages: SongUsageSummary[]; setlists: { id: string; events?: { title?: string; event_date?: string }; setlist_songs?: SetlistSong[] }[] }
interface SavedVideo { id: string; title: string; description?: string }

function librarySong(song: SongUsageSummary): SetlistSong {
  return { id: song.id, setlist_id: '', song_id: song.id, position: 1, notes: '', song_category: '', youtube_url: song.youtube_url || '', performed_key: song.song_key || '', section_role: null, is_manual_entry: false,
    songs: { ...song, artist: song.artist || '', song_key: song.song_key || '', duration: '', key_notes: '', youtube_url: song.youtube_url || '', created_by: song.created_by || '', created_at: '' } as Song };
}

/** Offline identities never mount online routes, editors, or administrative controls. */
export function OfflineWorkspace() {
  const { user, profile, organization, retryOnline, signOut } = useAuth();
  const location = useLocation();
  const scope = deviceCacheScope(user?.id, profile?.org_id);
  const [data, setData] = useState<{ scope: string | null; events: Event[]; details: Saved<SavedEventDetail>[]; library: SavedLibrary | null; videos: SavedVideo[] } | null>(null);
  const [view, setView] = useState<'events' | 'songs' | 'sets' | 'videos'>(() => location.pathname === '/library' ? 'songs' : 'events');
  const [eventId, setEventId] = useState<string | null>(() => /^\/events\/([^/]+)$/.exec(location.pathname)?.[1] || null);
  const [reader, setReader] = useState<{ title: string; songs: SetlistSong[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    void Promise.all([
      readDeviceSnapshot<Event[]>(scope, 'events:list'),
      listDeviceSnapshots<SavedEventDetail>(scope, 'events:detail:'),
      readDeviceSnapshot<SavedLibrary>(scope, 'library:songs-sets'),
      readDeviceSnapshot<SavedVideo[]>(scope, 'library:videos'),
    ]).then(([events, details, library, videos]) => {
      if (!active) return;
      const valid = details.filter(row => isSavedEventDetail(row.value));
      const merged = new Map((Array.isArray(events?.value) ? events.value : []).filter(event => event && typeof event.id === 'string').map(event => [event.id, event]));
      valid.forEach(row => merged.set(row.value.event!.id, row.value.event!));
      setData({ scope, events: [...merged.values()].sort((a,b) => b.event_date.localeCompare(a.event_date)), details: valid, library: library?.value || null, videos: Array.isArray(videos?.value) ? videos.value : [] });
    });
    return () => { active = false; };
  }, [scope]);
  const current = data?.scope === scope ? data : null;
  const detail = current?.details.find(row => row.value.event!.id === eventId);
  const connect = async () => {
    setBusy(true); setMessage('');
    try { const result = await retryOnline(); if (result.error) setMessage(result.error.message); }
    catch { setMessage('Could not reconnect. Your saved content is still available.'); }
    finally { setBusy(false); }
  };
  if (!current) return <div role="status" className="min-h-screen bg-[#050505] p-6 pt-16 text-white">Opening saved content…</div>;
  if (reader) return <OfflineLiveMode songs={reader.songs} title={reader.title} sourceLabel="Saved Library" onClose={() => setReader(null)} />;
  if (detail) return <OfflineEventDetail snapshot={detail.value} savedAt={detail.savedAt} onBack={() => setEventId(null)} backLabel="Saved events" />;
  const query = search.trim().toLowerCase();
  const matching = (title: string) => title.toLowerCase().includes(query);
  const songs = (current.library?.songUsages || []).filter(song => song && matching(song.title || ''));
  const sets = (current.library?.setlists || []).filter(set => set && matching(set.events?.title || 'Saved set'));
  const events = current.events.filter(event => matching(event.title || ''));
  const videos = current.videos.filter(video => matching(video.title || ''));
  return <main className="min-h-screen bg-[#050505] px-4 pb-10 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-amber-300"><WifiOff className="h-5 w-5"/><span className="text-sm font-bold">Using saved content</span></div>
        <h1 className="text-2xl font-black">Your offline workspace</h1>
        <p className="text-sm text-white/60">{profile?.first_name} · {organization?.name}. Open saved services and charts. Messages, live team cues, and changes need a connection.</p>
        <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void connect()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}/>{busy ? 'Connecting…' : 'Return online'}</button><button disabled={busy} onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm"><LogOut className="h-4 w-4"/>Sign out</button></div>
        {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
      </header>
      <nav aria-label="Saved content" className="grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1">{(['events','songs','sets','videos'] as const).map(tab => <button key={tab} aria-current={view === tab ? 'page' : undefined} onClick={() => { setView(tab); setSearch(''); setEventId(null); }} className={`min-h-11 rounded-xl text-sm font-bold capitalize ${view === tab ? 'bg-white/10 text-emerald-300' : 'text-white/55'}`}>{tab}</button>)}</nav>
      <input aria-label="Search saved content" placeholder="Search saved content…" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm"/>
      {eventId && !detail && <p role="status" className="rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200">This event’s full details were not saved on this device. Connect and open it once to prepare it for offline use.</p>}
      <div className="space-y-3">
        {view === 'events' && events.map(event => { const saved = current.details.find(row => row.value.event!.id === event.id); return <button key={event.id} onClick={() => setEventId(event.id)} className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"><CalendarDays className="mb-2 h-5 w-5 text-emerald-300"/><span className="block font-bold">{event.title}</span><span className="mt-1 block text-sm text-white/50">{event.event_date} · {saved ? 'Details saved' : 'Summary only · connect to save details'}</span></button>; })}
        {view === 'songs' && songs.map(song => <button key={song.id} onClick={() => setReader({title:song.title,songs:[librarySong(song)]})} className="block w-full rounded-2xl border border-white/10 p-4 text-left"><BookOpen className="mb-2 h-5 w-5 text-emerald-300"/><span className="block font-bold">{song.title}</span><span className="text-sm text-white/50">{song.artist} · {song.song_key}</span></button>)}
        {view === 'sets' && sets.map(set => <button key={set.id} onClick={() => setReader({title:set.events?.title || 'Saved set',songs:set.setlist_songs || []})} className="block w-full rounded-2xl border border-white/10 p-4 text-left"><span className="block font-bold">{set.events?.title || 'Saved set'}</span><span className="text-sm text-white/50">{set.events?.event_date} · {set.setlist_songs?.length || 0} songs</span></button>)}
        {view === 'videos' && <p className="text-sm text-white/50">Video information is saved. Playback needs internet.</p>}
        {view === 'videos' && videos.map(video => <article key={video.id} className="rounded-2xl border border-white/10 p-4"><h2 className="font-bold">{video.title}</h2><p className="mt-1 text-sm text-white/50">{video.description}</p></article>)}
        {(view === 'events' ? !events.length : view === 'songs' ? !songs.length : view === 'sets' ? !sets.length : !videos.length) && <p role="status" className="rounded-2xl bg-white/5 p-5 text-sm text-white/60">No matching saved {view}. While online, open the Library and the events you need before leaving Wi-Fi.</p>}
      </div>
    </div>
  </main>;
}
