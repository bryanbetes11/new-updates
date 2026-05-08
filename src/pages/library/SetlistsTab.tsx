import { useEffect, useState, useRef } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Music, Upload, CheckCircle, AlertTriangle, Calendar, Search,
  ChevronDown, Trash2, Square, CheckSquare, X,
  ListMusic, Clock, Music2, ArrowUpDown, BarChart2, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';

interface SetlistWithEvent {
  id: string;
  status: string;
  event_id: string;
  events?: { title: string; event_date: string; event_type: string };
  setlist_songs?: { id: string; position: number; song_id: string; performed_key: string; songs?: { id: string; title: string; artist: string; song_key: string } }[];
}

interface SongUsage {
  id: string;
  title: string;
  artist: string;
  song_key: string;
  last_used_date: string | null;
  days_since: number | null;
  is_safe: boolean;
}

interface ImportRow {
  event_date: string;
  event_name: string;
  song_title: string;
  artist: string;
  song_key: string;
  song_category: string;
  song_leader: string;
}

const RULE_DAYS = 90;

const normalizeSongTitle = (title: string): string => {
  return title.replace(/,/g, '').trim().toLowerCase();
};

type SortKey = 'date_desc' | 'date_asc' | 'songs_desc';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

/* ── Stat Card (matches Dashboard's vertical premium pill) ──────── */
function StatCard({ label, value, color = 'default', onClick, active }: { label: string; value: number | string; color?: 'default' | 'green' | 'red' | 'amber'; onClick?: () => void; active?: boolean }) {
  const tone = {
    default: { val: 'text-gray-900 dark:text-white', dot: 'rgba(107,114,128,0.7)', dotDark: 'rgba(255,255,255,0.45)', ring: 'ring-black/[0.06] dark:ring-white/[0.08]', activeRing: 'ring-gray-400 dark:ring-gray-300' },
    green:   { val: 'text-emerald-700 dark:text-emerald-300', dot: '#22c55e', dotDark: '#22c55e', ring: 'ring-emerald-200/80 dark:ring-emerald-500/20', activeRing: 'ring-emerald-500 dark:ring-emerald-400' },
    red:     { val: 'text-red-700 dark:text-red-300', dot: '#ef4444', dotDark: '#f87171', ring: 'ring-red-200/80 dark:ring-red-500/20', activeRing: 'ring-red-500 dark:ring-red-400' },
    amber:   { val: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b', dotDark: '#fbbf24', ring: 'ring-amber-200/80 dark:ring-amber-500/20', activeRing: 'ring-amber-500 dark:ring-amber-400' },
  }[color];

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': Boolean(active) } : {})}
      className={`group relative flex flex-col items-start gap-1 px-3.5 py-3 rounded-2xl bg-white dark:bg-white/[0.025] ring-1 transition-all ${
        active ? `ring-2 ${tone.activeRing}` : `${tone.ring} hover:bg-white dark:hover:bg-white/[0.04]`
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-emerald-300/70 dark:hover:ring-emerald-400/30 active:scale-[0.97]' : ''}`}
      style={{ boxShadow: active ? '0 10px 24px -18px rgba(16,185,129,0.45)' : '0 1px 2px rgba(15,23,42,0.04), 0 4px 14px -10px rgba(15,23,42,0.10)' }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />
      {onClick && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 opacity-80 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full dark:hidden" style={{ background: tone.dot, boxShadow: `0 0 6px ${tone.dot}` }} />
        <span className="h-1.5 w-1.5 rounded-full hidden dark:block" style={{ background: tone.dotDark, boxShadow: `0 0 6px ${tone.dotDark}` }} />
        <span className="text-[9px] font-bold text-gray-500 dark:text-white/45 uppercase tracking-[0.14em] leading-none">{label}</span>
      </div>
      <span className={`text-[26px] font-black leading-none tabular-nums ${tone.val}`} style={{ letterSpacing: '-0.04em' }}>{value}</span>
    </Tag>
  );
}

function getDaysBg(days: number | null) {
  if (days === null) return 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45';
  if (days >= RULE_DAYS) return 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25';
  if (days >= 60) return 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25';
  return 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25';
}

function SectionLabel({ index, children, action }: { index: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 px-0.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">{index}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">{children}</span>
      </div>
      {action}
    </div>
  );
}

export function SetlistsTab({ initialView = 'setlists' }: { initialView?: 'setlists' | 'songs' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [setlists, setSetlists] = useState<SetlistWithEvent[]>([]);
  const [songUsages, setSongUsages] = useState<SongUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedSetlist, setExpandedSetlist] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ songsDone: 0, eventsDone: 0, totalSongs: 0, totalEvents: 0 });
  const [songLeaderMap, setSongLeaderMap] = useState<Record<string, string>>({});
  const [songLeaderAvatarMap, setSongLeaderAvatarMap] = useState<Record<string, { avatarUrl: string | null; firstName: string; lastName: string }>>({});
  const [showSongResults, setShowSongResults] = useState(initialView === 'songs');
  const [selectedSetlists, setSelectedSetlists] = useState<Set<string>>(new Set());
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'setlists' | 'songs' | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectModeSongs, setSelectModeSongs] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'not_ready' | 'never_used'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [setlistRes, songsRes, songLeadersRes] = await Promise.all([
      supabase
        .from('setlists')
        .select('id, status, event_id, events(title, event_date, event_type), setlist_songs(id, position, song_id, performed_key, songs(id, title, artist, song_key))')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase.from('songs').select('id, title, artist, song_key').order('title'),
      supabase.from('event_assignments').select('event_id, profiles(first_name, last_name, nickname, gender, avatar_url), roles!inner(name)').eq('roles.name', 'Song Leader'),
    ]);

    const approvedSetlists = (setlistRes.data || []) as SetlistWithEvent[];
    setSetlists(approvedSetlists);

    const slMap: Record<string, string> = {};
    const slAvatarMap: Record<string, { avatarUrl: string | null; firstName: string; lastName: string }> = {};
    (songLeadersRes.data || []).forEach((a: any) => {
      if (a.profiles) {
        const prefix = a.profiles.gender === 'male' ? 'Bro.' : a.profiles.gender === 'female' ? 'Sis.' : '';
        slMap[a.event_id] = prefix ? `${prefix} ${a.profiles.first_name}` : `${a.profiles.first_name} ${a.profiles.last_name}`;
        slAvatarMap[a.event_id] = {
          avatarUrl: a.profiles.avatar_url,
          firstName: a.profiles.first_name,
          lastName: a.profiles.last_name,
        };
      }
    });
    setSongLeaderMap(slMap);
    setSongLeaderAvatarMap(slAvatarMap);

    const songs = songsRes.data || [];
    const usageMap: Record<string, string> = {};

    approvedSetlists.forEach(sl => {
      const eventDate = sl.events?.event_date;
      if (!eventDate) return;
      sl.setlist_songs?.forEach(ss => {
        if (!usageMap[ss.song_id] || eventDate > usageMap[ss.song_id]) {
          usageMap[ss.song_id] = eventDate;
        }
      });
    });

    const usages: SongUsage[] = songs.map(song => {
      const lastUsed = usageMap[song.id] || null;
      const daysSince = lastUsed ? differenceInDays(new Date(), parseISO(lastUsed)) : null;
      return { ...song, last_used_date: lastUsed, days_since: daysSince, is_safe: daysSince === null || daysSince >= RULE_DAYS };
    });

    usages.sort((a, b) => {
      if (a.days_since === null && b.days_since === null) return 0;
      if (a.days_since === null) return 1;
      if (b.days_since === null) return -1;
      return a.days_since - b.days_since;
    });

    setSongUsages(usages);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const loadXLSX = (): Promise<any> => {
    const w = window as any;
    if (w.XLSX) return Promise.resolve(w.XLSX);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.onload = () => resolve(w.XLSX);
      script.onerror = () => reject(new Error('Failed to load spreadsheet library'));
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    let XLSX: any;
    try { XLSX = await loadXLSX(); } catch { toast('error', 'Failed to load spreadsheet library'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const parseDateValue = (val: any): string => {
          if (typeof val === 'number') {
            const d = XLSX.SSF.parse_date_code(val);
            return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          }
          const s = String(val || '').trim();
          if (!s) return '';
          const parsed = new Date(s);
          if (!isNaN(parsed.getTime()) && s.length > 4) {
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
          }
          return s;
        };

        const extractKeyFromTitle = (line: string): { title: string; key: string } => {
          const keyMatch = line.match(/\[([A-G][#b]?m?)\]/i);
          const key = keyMatch ? keyMatch[1] : '';
          const title = line.replace(/\s*\[[^\]]*\]\s*/, '').trim();
          return { title, key };
        };

        const colRows = XLSX.utils.sheet_to_json(sheet, { header: 'A', defval: '' }) as Record<string, any>[];
        let headerRowIdx = -1;
        let isWorshipFormat = false;

        for (let i = 0; i < Math.min(colRows.length, 5); i++) {
          const vals = Object.values(colRows[i]).map((c: any) => String(c).toLowerCase().trim());
          if (vals.includes('opening') || vals.includes('praise') || vals.includes('worship')) {
            headerRowIdx = i; isWorshipFormat = true; break;
          }
          if (vals.includes('date') && (vals.includes('song title') || vals.includes('song') || vals.includes('title'))) {
            headerRowIdx = i; break;
          }
        }
        if (headerRowIdx === -1) headerRowIdx = 0;

        let rows: ImportRow[] = [];

        if (isWorshipFormat) {
          const headerRow = colRows[headerRowIdx];
          const colMap: Record<string, string> = {};
          for (const [colLetter, val] of Object.entries(headerRow)) { colMap[String(val).toLowerCase().trim()] = colLetter; }
          const dateCol = colMap['date'] || Object.entries(headerRow).find(([, v]) => String(v).toLowerCase().includes('date'))?.[0] || '';
          const typeCol = colMap['service type'] || Object.entries(headerRow).find(([, v]) => String(v).toLowerCase().includes('service'))?.[0] || '';
          const songLeaderCol = colMap['song leader'] || Object.entries(headerRow).find(([, v]) => String(v).toLowerCase().includes('song leader'))?.[0] || '';
          const categories = ['opening', 'praise', 'worship', 'offering', 'closing'];
          const catColLetters: Record<string, string> = {};
          categories.forEach(cat => { if (colMap[cat]) catColLetters[cat] = colMap[cat]; });

          for (let i = headerRowIdx + 1; i < colRows.length; i++) {
            const row = colRows[i];
            const allEmpty = Object.values(row).every((c: any) => !String(c).trim());
            if (allEmpty) continue;
            const dateVal = dateCol ? parseDateValue(row[dateCol]) : '';
            const eventType = typeCol ? String(row[typeCol] || 'Sunday Service').trim() : 'Sunday Service';
            const eventName = eventType || 'Sunday Service';
            const songLeaderVal = songLeaderCol ? String(row[songLeaderCol] || '').trim() : '';
            for (const [category, colLetter] of Object.entries(catColLetters)) {
              const cellVal = String(row[colLetter] || '').trim();
              if (!cellVal) continue;
              const songLines = cellVal.split(/\n|\r\n?/).map((s: string) => s.trim()).filter(Boolean);
              for (const line of songLines) {
                const { title, key } = extractKeyFromTitle(line);
                if (title) rows.push({ event_date: dateVal, event_name: eventName, song_title: title, artist: '', song_key: key, song_category: category, song_leader: songLeaderVal });
              }
            }
          }
        } else {
          const json = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
          rows = json.map((row: Record<string, any>) => {
            const dateVal = row['Date'] || row['Event Date'] || row['date'] || row['event_date'] || '';
            const nameVal = row['Event'] || row['Event Name'] || row['event'] || row['event_name'] || 'Imported Event';
            const titleVal = row['Song Title'] || row['Song'] || row['Title'] || row['song_title'] || row['title'] || '';
            const artistVal = row['Artist'] || row['artist'] || '';
            const keyVal = row['Key'] || row['Song Key'] || row['key'] || row['song_key'] || '';
            const leaderVal = row['Song Leader'] || row['song_leader'] || row['Leader'] || '';
            return { event_date: parseDateValue(dateVal), event_name: nameVal, song_title: titleVal, artist: artistVal, song_key: keyVal, song_category: '', song_leader: String(leaderVal).trim() };
          }).filter(r => r.song_title.trim());
        }

        setImportData(rows);
        setShowImport(true);
      } catch { toast('error', 'Failed to parse Excel file'); }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!user || importData.length === 0) return;
    setImporting(true);

    const eventGroups: Record<string, { date: string; name: string; songLeader: string; songs: ImportRow[] }> = {};
    importData.forEach(row => {
      const key = `${row.event_date}|${row.event_name}`;
      if (!eventGroups[key]) eventGroups[key] = { date: row.event_date, name: row.event_name, songLeader: row.song_leader || '', songs: [] };
      if (!eventGroups[key].songLeader && row.song_leader) eventGroups[key].songLeader = row.song_leader;
      eventGroups[key].songs.push(row);
    });

    const totalEvents = Object.keys(eventGroups).length;
    const totalSongs = importData.length;
    setImportProgress({ songsDone: 0, eventsDone: 0, totalSongs, totalEvents });
    let songsDone = 0;
    let eventsDone = 0;

    try {
      for (const group of Object.values(eventGroups)) {
        let eventDate = group.date;
        if (!eventDate || eventDate.length < 8) eventDate = new Date().toISOString().split('T')[0];

        const { data: existingEvent } = await supabase.from('events').select('id').eq('title', group.name).eq('event_date', eventDate).maybeSingle();
        let eventId: string;
        if (existingEvent) {
          eventId = existingEvent.id;
        } else {
          const { data: newEvent, error: eventError } = await supabase.from('events').insert({ title: group.name, event_date: eventDate, start_time: '09:00', event_type: 'imported', description: 'Imported from spreadsheet', created_by: user.id }).select('id').maybeSingle();
          if (eventError || !newEvent) { songsDone += group.songs.length; eventsDone++; setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents }); continue; }
          eventId = newEvent.id;
        }

        const { data: existingSetlist } = await supabase.from('setlists').select('id').eq('event_id', eventId).maybeSingle();
        let setlistId: string;
        if (existingSetlist) {
          setlistId = existingSetlist.id;
        } else {
          const { data: newSetlist, error: slError } = await supabase.from('setlists').insert({ event_id: eventId, created_by: user.id, status: 'approved' }).select('id').maybeSingle();
          if (slError || !newSetlist) { songsDone += group.songs.length; eventsDone++; setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents }); continue; }
          setlistId = newSetlist.id;
        }

        if (group.songLeader) {
          const leaderName = group.songLeader.trim().replace(/^(Bro\.?|Sis\.?|Brother|Sister)\s+/i, '');
          const nameParts = leaderName.split(/\s+/);
          const leaderFirst = nameParts[0] || '';
          const leaderLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          let profileQuery = supabase.from('profiles').select('id').ilike('first_name', leaderFirst);
          if (leaderLast) profileQuery = profileQuery.ilike('last_name', leaderLast);
          const { data: leaderProfile } = await profileQuery.maybeSingle();
          if (leaderProfile) {
            const { data: songLeaderRole } = await supabase.from('roles').select('id').eq('name', 'Song Leader').maybeSingle();
            if (songLeaderRole) await supabase.from('event_assignments').upsert({ event_id: eventId, user_id: leaderProfile.id, role_id: songLeaderRole.id, status: 'confirmed' }, { onConflict: 'event_id,user_id,role_id' });
          }
        }

        for (let i = 0; i < group.songs.length; i++) {
          const song = group.songs[i];
          const normalizedTitle = normalizeSongTitle(song.song_title);
          const { data: allSongs } = await supabase.from('songs').select('id, title');
          const existingSong = allSongs?.find(s => normalizeSongTitle(s.title) === normalizedTitle);
          let songId: string;
          if (existingSong) {
            songId = existingSong.id;
          } else {
            const { data: newSong, error: songError } = await supabase.from('songs').insert({ title: song.song_title.trim(), artist: song.artist.trim(), song_key: song.song_key.trim(), created_by: user.id }).select('id').maybeSingle();
            if (songError || !newSong) { songsDone++; setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents }); continue; }
            songId = newSong.id;
          }
          await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: songId, position: i + 1, song_category: song.song_category || '' });
          songsDone++;
          setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents });
        }

        eventsDone++;
        setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents });
      }

      toast('success', `Imported ${totalEvents} setlists with ${totalSongs} songs`);
      setShowImport(false);
      setImportData([]);
      fetchData();
    } catch { toast('error', 'Import failed'); }
    setImporting(false);
  };

  const toggleSetlist = (id: string) => {
    setSelectedSetlists(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleAllSetlists = () => {
    if (selectedSetlists.size === sortedSetlists.length) setSelectedSetlists(new Set());
    else setSelectedSetlists(new Set(sortedSetlists.map(s => s.id)));
  };

  const toggleSong = (id: string) => {
    setSelectedSongs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleAllSongs = () => {
    if (selectedSongs.size === filteredSongs.length) setSelectedSongs(new Set());
    else setSelectedSongs(new Set(filteredSongs.map(s => s.id)));
  };

  const handleDeleteSetlists = async () => {
    if (selectedSetlists.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedSetlists);
      const eventIds = setlists.filter(s => ids.includes(s.id)).map(s => s.event_id);
      const { error: ssErr } = await supabase.from('setlist_songs').delete().in('setlist_id', ids);
      if (ssErr) throw ssErr;
      const { error: slErr } = await supabase.from('setlists').delete().in('id', ids);
      if (slErr) throw slErr;
      if (eventIds.length > 0) {
        await supabase.from('event_assignments').delete().in('event_id', eventIds);
        await supabase.from('events').delete().in('id', eventIds).eq('event_type', 'imported');
      }
      setSelectedSetlists(new Set());
      setShowDeleteConfirm(null);
      toast('success', `Deleted ${ids.length} setlist${ids.length > 1 ? 's' : ''}`);
      fetchData();
    } catch { toast('error', 'Failed to delete setlists'); }
    setDeleting(false);
  };

  const handleDeleteSongs = async () => {
    if (selectedSongs.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedSongs);
      const { error: ssErr } = await supabase.from('setlist_songs').delete().in('song_id', ids);
      if (ssErr) throw ssErr;
      const { error: sErr } = await supabase.from('songs').delete().in('id', ids);
      if (sErr) throw sErr;
      setSelectedSongs(new Set());
      setShowDeleteConfirm(null);
      toast('success', `Deleted ${ids.length} song${ids.length > 1 ? 's' : ''}`);
      fetchData();
    } catch { toast('error', 'Failed to delete songs'); }
    setDeleting(false);
  };

  const filteredSongs = songUsages.filter(s => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.artist.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === 'safe') return s.is_safe;
    if (activeFilter === 'not_ready') return !s.is_safe && s.days_since !== null;
    if (activeFilter === 'never_used') return s.days_since === null;
    return true;
  });

  const sortedSetlists = [...setlists].sort((a, b) => {
    if (sortKey === 'date_asc') return (a.events?.event_date ?? '').localeCompare(b.events?.event_date ?? '');
    if (sortKey === 'songs_desc') return (b.setlist_songs?.length ?? 0) - (a.setlist_songs?.length ?? 0);
    return (b.events?.event_date ?? '').localeCompare(a.events?.event_date ?? '');
  });

  const safeCount = songUsages.filter(s => s.is_safe).length;
  const notReadyCount = songUsages.filter(s => !s.is_safe && s.days_since !== null).length;
  const neverUsed = songUsages.filter(s => s.days_since === null).length;

  const showSongFilter = (filter: typeof activeFilter) => {
    const shouldClear = showSongResults && activeFilter === filter && filter !== 'all';
    setActiveFilter(shouldClear ? 'all' : filter);
    setSelectedSongs(new Set());
    setSelectModeSongs(false);
    setShowSongResults(!shouldClear);
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[78px] rounded-2xl" />)}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-3xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] p-4 animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gray-200 dark:bg-white/[0.05] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-white/[0.05] rounded-lg w-2/5" />
                <div className="h-3 bg-gray-200 dark:bg-white/[0.05] rounded-lg w-1/3" />
              </div>
              <div className="h-6 w-16 bg-gray-200 dark:bg-white/[0.05] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ────────────────────────── Setlists View ────────────────────────── */
  if (!showSongResults) {
    return (
      <div className="space-y-5 pb-2">

        {/* ── Header row: section label + import ── */}
        <SectionLabel
          index="01"
          action={
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
            >
              <Upload className="h-3.5 w-3.5" />
              Import Excel
            </button>
          }
        >
          <span className="flex items-center gap-1.5"><ListMusic className="h-3 w-3" /> Approved Setlists</span>
        </SectionLabel>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileUpload(e.target.files)} />

        {/* ── Stats strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          <StatCard
            label="Songs"
            value={setlists.reduce((acc, s) => acc + (s.setlist_songs?.length ?? 0), 0)}
            active={showSongResults && activeFilter === 'all'}
            onClick={() => showSongFilter('all')}
          />
          <StatCard
            label="Never Used"
            value={neverUsed}
            active={activeFilter === 'never_used'}
            onClick={() => showSongFilter('never_used')}
          />
          <StatCard
            label="Safe"
            value={safeCount}
            color="green"
            active={activeFilter === 'safe'}
            onClick={() => showSongFilter('safe')}
          />
          <StatCard
            label="Not Ready"
            value={notReadyCount}
            color={notReadyCount > 0 ? 'red' : 'default'}
            active={activeFilter === 'not_ready'}
            onClick={() => showSongFilter('not_ready')}
          />
        </motion.div>

        {setlists.length === 0 ? (
          <EmptyState
            icon={<Music className="h-8 w-8" />}
            title="No approved setlists"
            description="Approved setlists from events will appear here. You can also import past setlists from Excel."
            action={<button onClick={() => fileRef.current?.click()} className="btn-primary"><Upload className="h-4 w-4" /> Import Excel</button>}
          />
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectMode ? (
                <>
                  <button
                    onClick={toggleAllSetlists}
                    className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 dark:text-white/45 hover:text-gray-800 dark:hover:text-white/80 transition-colors py-1"
                  >
                    {selectedSetlists.size === sortedSetlists.length && sortedSetlists.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300 dark:text-white/20" />
                    )}
                    <span>{selectedSetlists.size > 0 ? `${selectedSetlists.size} selected` : 'Select all'}</span>
                  </button>
                  <div className="flex-1" />
                  {selectedSetlists.size > 0 ? (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <button onClick={() => setSelectedSetlists(new Set())} className="text-[11px] font-semibold text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/55 transition-colors">Clear</button>
                      <button
                        onClick={() => setShowDeleteConfirm('setlists')}
                        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors active:scale-[0.97]"
                        style={{ boxShadow: '0 3px 10px rgba(220,38,38,0.3)' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete ({selectedSetlists.size})
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSelectMode(false); setSelectedSetlists(new Set()); }}
                      className="text-[11px] font-semibold text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/55 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex-1" />
                  <button
                    onClick={() => setSelectMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-semibold text-gray-600 dark:text-white/55 rounded-full bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md hover:bg-white dark:hover:bg-white/[0.07] transition-colors active:scale-[0.97]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select
                  </button>
                  <div className="inline-flex items-center gap-1.5 pl-3 pr-2 h-8 rounded-full bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md">
                    <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-white/35" />
                    <select
                      value={sortKey}
                      onChange={e => setSortKey(e.target.value as SortKey)}
                      className="text-[11px] font-semibold text-gray-600 dark:text-white/60 bg-transparent border-none outline-none cursor-pointer pr-1"
                    >
                      <option value="date_desc">Newest first</option>
                      <option value="date_asc">Oldest first</option>
                      <option value="songs_desc">Most songs</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* ── Setlist rows ── */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2.5"
            >
              {sortedSetlists.map(sl => {
                const isExpanded = expandedSetlist === sl.id;
                const eventDate = sl.events?.event_date;
                const daysSinceEvent = eventDate ? differenceInDays(new Date(), parseISO(eventDate)) : null;
                const songCount = sl.setlist_songs?.length ?? 0;
                const isSelected = selectedSetlists.has(sl.id);
                const displayName = songLeaderMap[sl.event_id] || sl.events?.title || 'Untitled';
                const eventType = sl.events?.event_type;
                const leaderAvatar = songLeaderAvatarMap[sl.event_id];

                return (
                  <motion.div
                    key={sl.id}
                    variants={itemVariants}
                    className={`group relative rounded-3xl overflow-hidden transition-all duration-300 border ${
                      isSelected
                        ? 'border-emerald-400/60 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/[0.05]'
                        : 'border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] hover:border-gray-300 dark:hover:border-white/[0.1] hover:-translate-y-0.5'
                    }`}
                    style={{ boxShadow: isSelected ? '0 0 0 1px rgba(16,185,129,0.2)' : '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
                  >
                    <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

                    <div className="flex items-center">
                      {selectMode && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleSetlist(sl.id); }}
                          className="pl-4 pr-1 py-4 shrink-0 flex items-center"
                          aria-label="Select setlist"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-300 dark:text-white/20 hover:text-gray-400 dark:hover:text-white/35 transition-colors" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedSetlist(isExpanded ? null : sl.id)}
                        className="flex-1 flex items-center gap-3.5 pl-4 pr-4 py-3.5 text-left"
                      >
                        {/* Date chip — gradient like Events */}
                        {eventDate ? (
                          <div
                            className="relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0"
                            style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
                          >
                            <span className="text-[9px] font-black uppercase tracking-widest leading-none text-white/65">
                              {format(parseISO(eventDate), 'MMM')}
                            </span>
                            <span className="text-[22px] font-black leading-none mt-0.5 text-white" style={{ letterSpacing: '-0.04em' }}>
                              {format(parseISO(eventDate), 'd')}
                            </span>
                            <span className="text-[8px] font-bold leading-none mt-0.5 text-white/50">
                              {format(parseISO(eventDate), 'EEE')}
                            </span>
                          </div>
                        ) : (
                          <div className="h-[52px] w-11 rounded-xl shrink-0 bg-gray-100 dark:bg-white/[0.05]" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.015em' }}>
                              {displayName}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25">
                              <CheckCircle className="h-2.5 w-2.5" /> Approved
                            </span>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
                            {eventDate && (
                              <span className="text-[11px] text-gray-500 dark:text-white/40 flex items-center gap-1 font-mono">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(eventDate), 'MMM d, yyyy')}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400 dark:text-white/30 font-mono">{songCount} song{songCount !== 1 ? 's' : ''}</span>
                            {daysSinceEvent !== null && (
                              <span className="text-[11px] text-gray-400 dark:text-white/25 font-mono hidden sm:inline">{daysSinceEvent}d ago</span>
                            )}
                            {eventType && eventType !== 'imported' && (
                              <span className="hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45 capitalize">{eventType.replace(/_/g, ' ')}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {leaderAvatar && (
                            <Avatar
                              src={leaderAvatar.avatarUrl}
                              firstName={leaderAvatar.firstName}
                              lastName={leaderAvatar.lastName}
                              size="xs"
                              className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                            />
                          )}
                          <div className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${isExpanded ? 'bg-gray-100 dark:bg-white/[0.06] rotate-180' : ''}`}>
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-white/35" />
                          </div>
                        </div>
                      </button>
                    </div>

                    {isExpanded && sl.setlist_songs && (
                      <div className="border-t border-black/[0.04] dark:border-white/[0.05]">
                        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                          <Music2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-[10px] font-black text-gray-500 dark:text-white/45 uppercase tracking-[0.14em]">Songs in order</span>
                          <span className="ml-auto text-[10px] font-mono font-semibold text-gray-400 dark:text-white/30">{songCount} total</span>
                        </div>
                        <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04] pb-2">
                          {sl.setlist_songs
                            .sort((a, b) => a.position - b.position)
                            .map((ss, i) => {
                              const songUsage = songUsages.find(u => u.id === ss.song_id);
                              const displayKey = ss.performed_key || ss.songs?.song_key || '';
                              const keyChanged = ss.performed_key && ss.songs?.song_key && ss.performed_key !== ss.songs.song_key;
                              return (
                                <div key={ss.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                                  <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-gray-100 dark:bg-white/[0.05] text-[10px] font-black text-gray-400 dark:text-white/35 shrink-0 tabular-nums">{i + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">{ss.songs?.title}</p>
                                      {displayKey && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${keyChanged ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45'}`}>
                                          {displayKey}
                                        </span>
                                      )}
                                    </div>
                                    {ss.songs?.artist && (
                                      <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
                                        {ss.songs.artist}
                                        {keyChanged && <span className="ml-1 text-gray-300 dark:text-white/20">(orig: {ss.songs.song_key})</span>}
                                      </p>
                                    )}
                                  </div>
                                  {songUsage && (
                                    <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${getDaysBg(songUsage.days_since)}`}>
                                      {songUsage.is_safe
                                        ? <CheckCircle className="h-3 w-3 shrink-0" />
                                        : <AlertTriangle className="h-3 w-3 shrink-0" />}
                                      <span>{songUsage.days_since !== null ? `${songUsage.days_since}d` : 'New'}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}

        {/* Delete modal */}
        <Modal
          open={showDeleteConfirm !== null}
          onClose={() => { if (!deleting) setShowDeleteConfirm(null); }}
          title="Delete Setlists"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete {selectedSetlists.size} setlist{selectedSetlists.size > 1 ? 's' : ''} and their associated imported events? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} disabled={deleting} className="btn-secondary">Cancel</button>
              <button onClick={handleDeleteSetlists} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors">
                {deleting ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
              </button>
            </div>
          </div>
        </Modal>

        {/* Import modal */}
        <Modal open={showImport} onClose={() => { if (!importing) { setShowImport(false); setImportData([]); } }} title="Import Setlists from Excel" size="lg">
          <div className="space-y-4">
            {importing ? (
              <div className="py-4 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">Importing songs...</span>
                    <span className="text-gray-500 tabular-nums">{importProgress.songsDone}/{importProgress.totalSongs}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress.totalSongs ? (importProgress.songsDone / importProgress.totalSongs) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">Events processed</span>
                    <span className="text-gray-500 tabular-nums">{importProgress.eventsDone}/{importProgress.totalEvents}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress.totalEvents ? (importProgress.eventsDone / importProgress.totalEvents) * 100 : 0}%` }} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">{Math.round(importProgress.totalSongs ? (importProgress.songsDone / importProgress.totalSongs) * 100 : 0)}% complete — please don't close this window</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found <span className="font-bold text-gray-900 dark:text-white">{importData.length}</span> songs across <span className="font-bold text-gray-900 dark:text-white">{new Set(importData.map(r => `${r.event_date}|${r.event_name}`)).size}</span> events. Review before importing.
                </p>
                <div className="max-h-80 overflow-y-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Date</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Event</th>
                        {importData.some(r => r.song_leader) && <th className="text-left px-3 py-2 font-semibold text-gray-500">Song Leader</th>}
                        {importData.some(r => r.song_category) && <th className="text-left px-3 py-2 font-semibold text-gray-500">Category</th>}
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Song</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {importData.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.event_date}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{row.event_name}</td>
                          {importData.some(r => r.song_leader) && <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium">{row.song_leader}</td>}
                          {importData.some(r => r.song_category) && <td className="px-3 py-2 text-gray-500 dark:text-gray-400 capitalize">{row.song_category}</td>}
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.song_title}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.song_key}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Supports worship setlist format (Date, Service Type, Opening, Praise, Worship, Offering, Closing) or standard format (Date, Event, Song Title, Artist, Key). Song keys in brackets like [D] are auto-detected.</p>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowImport(false); setImportData([]); }} className="btn-secondary">Cancel</button>
                  <button onClick={handleImport} className="btn-primary">Import {importData.length} Songs</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  /* ────────────────────────── Song Results View ────────────────────────── */
  return (
    <div className="space-y-5 pb-2">

      {/* ── Header row ── */}
      <SectionLabel
        index="01"
        action={
          <button
            type="button"
            onClick={() => {
              setShowSongResults(false);
              setActiveFilter('all');
              setSearch('');
              setSelectedSongs(new Set());
              setSelectModeSongs(false);
            }}
            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Back to setlists
          </button>
        }
      >
        <span className="flex items-center gap-1.5"><BarChart2 className="h-3 w-3" /> Song Results</span>
      </SectionLabel>

      {/* ── Stats strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        <StatCard
          label="Total"
          value={songUsages.length}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <StatCard
          label="Never Used"
          value={neverUsed}
          active={activeFilter === 'never_used'}
          onClick={() => setActiveFilter(prev => prev === 'never_used' ? 'all' : 'never_used')}
        />
        <StatCard
          label="Safe"
          value={safeCount}
          color="green"
          active={activeFilter === 'safe'}
          onClick={() => setActiveFilter(prev => prev === 'safe' ? 'all' : 'safe')}
        />
        <StatCard
          label="Not Ready"
          value={notReadyCount}
          color={notReadyCount > 0 ? 'red' : 'default'}
          active={activeFilter === 'not_ready'}
          onClick={() => setActiveFilter(prev => prev === 'not_ready' ? 'all' : 'not_ready')}
        />
      </motion.div>

      {/* ── Active filter chip ── */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-[11px] font-mono text-gray-500 dark:text-white/40 tracking-wide">Showing:</span>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setShowSongResults(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
              activeFilter === 'safe' ? 'bg-emerald-100 dark:bg-emerald-500/[0.18] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25'
              : activeFilter === 'not_ready' ? 'bg-red-100 dark:bg-red-500/[0.18] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25'
              : 'bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-white/55 border border-black/[0.06] dark:border-white/[0.07]'
            }`}
          >
            {activeFilter === 'safe' ? 'Safe songs' : activeFilter === 'not_ready' ? 'Not ready' : 'Never used'}
            <X className="h-3 w-3" />
          </button>
          <span className="text-[11px] font-mono text-gray-400 dark:text-white/30">{filteredSongs.length} result{filteredSongs.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Search bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search songs by title or artist…"
          className="w-full h-10 pl-10 pr-9 rounded-2xl text-[13px] bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>

      {/* ── Bulk action bar ── */}
      {filteredSongs.length > 0 && (
        <div className="flex items-center gap-2">
          {selectModeSongs ? (
            <>
              <button
                onClick={toggleAllSongs}
                className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 dark:text-white/45 hover:text-gray-800 dark:hover:text-white/80 transition-colors"
              >
                {selectedSongs.size === filteredSongs.length && filteredSongs.length > 0
                  ? <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  : <Square className="h-4 w-4 text-gray-300 dark:text-white/20" />}
                <span>{selectedSongs.size > 0 ? `${selectedSongs.size} selected` : 'Select all'}</span>
              </button>
              <div className="flex-1" />
              {selectedSongs.size > 0 ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <button onClick={() => setSelectedSongs(new Set())} className="text-[11px] font-semibold text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/55 transition-colors">Clear</button>
                  <button
                    onClick={() => setShowDeleteConfirm('songs')}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors active:scale-[0.97]"
                    style={{ boxShadow: '0 3px 10px rgba(220,38,38,0.3)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete ({selectedSongs.size})
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setSelectModeSongs(false); setSelectedSongs(new Set()); }}
                  className="text-[11px] font-semibold text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/55 transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex-1" />
              <button
                onClick={() => setSelectModeSongs(true)}
                className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-semibold text-gray-600 dark:text-white/55 rounded-full bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md hover:bg-white dark:hover:bg-white/[0.07] transition-colors active:scale-[0.97]"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Song table — premium card ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
        style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

        <div className={`relative grid gap-3 sm:gap-4 px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.015] ${selectModeSongs ? 'grid-cols-[auto,1fr,auto,auto]' : 'grid-cols-[1fr,auto,auto]'}`}>
          {selectModeSongs && <span className="w-4" />}
          <span className="text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-[0.14em]">Song</span>
          <span className="text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-[0.14em] text-center hidden sm:block">Last Used</span>
          <span className="text-[10px] font-black text-gray-400 dark:text-white/35 uppercase tracking-[0.14em] text-right">Status</span>
        </div>

        {filteredSongs.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400 dark:text-white/30">No songs found</p>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {filteredSongs.map(song => (
              <div
                key={song.id}
                className={`grid gap-3 sm:gap-4 px-4 py-3 items-center transition-colors ${selectModeSongs ? 'grid-cols-[auto,1fr,auto,auto]' : 'grid-cols-[1fr,auto,auto]'} ${
                  selectedSongs.has(song.id)
                    ? 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]'
                    : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.018]'
                }`}
              >
                {selectModeSongs && (
                  <button onClick={() => toggleSong(song.id)} className="shrink-0 flex items-center">
                    {selectedSongs.has(song.id)
                      ? <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <Square className="h-4 w-4 text-gray-300 dark:text-white/20 hover:text-gray-400 dark:hover:text-white/35 transition-colors" />}
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{song.title}</p>
                    {song.song_key && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45">{song.song_key}</span>
                    )}
                  </div>
                  {song.artist && <p className="text-[11px] text-gray-400 dark:text-white/30 truncate mt-0.5">{song.artist}</p>}
                  <p className="text-[10px] font-mono text-gray-400 dark:text-white/25 mt-0.5 sm:hidden tracking-wide">
                    {song.last_used_date ? format(parseISO(song.last_used_date), 'MMM d, yyyy') : 'Never used'}
                  </p>
                </div>
                <div className="text-[11px] font-mono text-gray-400 dark:text-white/30 text-center whitespace-nowrap hidden sm:flex items-center gap-1 tracking-wide">
                  {song.last_used_date ? (
                    <><Clock className="h-3 w-3" />{format(parseISO(song.last_used_date), 'MMM d, yyyy')}</>
                  ) : (
                    <span className="text-gray-300 dark:text-white/20">Never</span>
                  )}
                </div>
                <div className="flex items-center justify-end">
                  {song.days_since === null ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45 border border-gray-200 dark:border-white/[0.06]">
                      <CheckCircle className="h-3 w-3" /> New
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${getDaysBg(song.days_since)}`}>
                      {song.is_safe ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {song.days_since}d
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-1 text-[11px] font-mono text-gray-400 dark:text-white/30 flex-wrap tracking-wide">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />Safe (90+ days)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.5)' }} />Caution (60–90d)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />Not ready (&lt;60d)</span>
      </div>

      {/* Delete modal */}
      <Modal
        open={showDeleteConfirm !== null}
        onClose={() => { if (!deleting) setShowDeleteConfirm(null); }}
        title="Delete Songs"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''}? They will also be removed from all setlists. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteConfirm(null)} disabled={deleting} className="btn-secondary">Cancel</button>
            <button onClick={handleDeleteSongs} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors">
              {deleting ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
