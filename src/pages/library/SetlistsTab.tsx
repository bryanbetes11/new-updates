import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { motion, type Variants } from 'framer-motion';
import {
  Music, Upload, CheckCircle, AlertTriangle, Calendar, Search,
  ChevronDown, Trash2, Square, CheckSquare, X,
  Clock, Music2, ArrowUpDown,
  ExternalLink, Globe2, ClipboardPaste, Pencil, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { SongChartViewer } from '../../components/SongChartViewer';
import { SongArtwork } from '../../components/SongArtwork';
import { parseChordProMetadata } from '../../lib/chordPro';
import { withSaveTimeout } from '../../lib/saveTimeout';
import { filterSetlistsBySearch } from '../../lib/setlistSearch';
import { buildSongUsages, type SongUsageSummary } from '../../lib/songUsage';
import { normalizeSongTitle, sanitizeSongTitle } from '../../lib/songTitle';
import { getEffectiveSongLyrics, getSongLyricsSource } from '../../lib/songLyrics';

interface SetlistWithEvent {
  id: string;
  status: string;
  event_id: string;
  created_by?: string | null;
  events?: { title: string; event_date: string; event_type: string };
  setlist_songs?: { id: string; position: number; song_id: string; performed_key: string; youtube_url?: string | null; songs?: { id: string; title: string; artist: string; song_key: string; youtube_url?: string | null; lyrics?: string | null; chordpro_text?: string | null } }[];
}

type SongUsage = SongUsageSummary;

interface ImportRow {
  event_date: string;
  event_name: string;
  song_title: string;
  artist: string;
  song_key: string;
  song_category: string;
  song_leader: string;
}

type ChartImportAction = 'create' | 'update' | 'skip';
type ChartImportView = 'new' | 'existing' | 'review' | 'all';

interface ChartImportCandidate {
  id: string;
  fileName: string;
  title: string;
  artist: string;
  songKey: string;
  chordproText: string;
  action: ChartImportAction;
  reason: string;
  existingSongId: string | null;
  hasTitleConflict: boolean;
  isExactDuplicate: boolean;
  requiresReview: boolean;
  fillsMissingArtist: boolean;
}

interface SongLeaderProfile {
  first_name: string;
  last_name: string;
  nickname?: string | null;
  gender?: string | null;
  avatar_url: string | null;
}

interface SongLeaderAssignmentRow {
  event_id: string;
  profiles?: SongLeaderProfile | SongLeaderProfile[] | null;
}

type XLSXModule = typeof import('xlsx');
type WindowWithXLSX = Window & { XLSX?: XLSXModule };

const RULE_DAYS = 90;
const SONG_PAGE_SIZE = 40;
const SETLIST_PAGE_SIZE = 30;
const SONG_CHART_OPEN_STORAGE_PREFIX = 'servesync:songs:open-chart-id';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

const normalizeSongArtist = (artist: string): string => artist.trim().toLowerCase();

const getDuplicateSongScore = (song: SongUsage): number => (
  (song.chordpro_text?.trim() ? 8 : 0)
  + (song.artist.trim() ? 4 : 0)
  + (song.youtube_url?.trim() ? 2 : 0)
  + (song.song_key.trim() ? 1 : 0)
  + Math.min(song.usages.length, 5)
);

const chartFingerprint = (chart: string): string => chart
  .replace(/\r\n/g, '\n')
  .replace(/^\s*\{\s*(?:title|t)\s*:[^}]*\}\s*$/gim, '')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

type SortKey = 'date_desc' | 'date_asc' | 'songs_desc';
type SongViewerTab = 'lyrics' | 'chart';

const ULTIMATE_GUITAR_SEARCH_URL = (query: string) =>
  `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;

function getLibrarySongSortGroup(song: SongUsage) {
  if (song.is_safe && song.days_since !== null) return 0;
  if (song.days_since === null) return 1;
  return 2;
}

function compareLibrarySongs(a: SongUsage, b: SongUsage) {
  const groupDelta = getLibrarySongSortGroup(a) - getLibrarySongSortGroup(b);
  if (groupDelta !== 0) return groupDelta;

  if (a.days_since !== null && b.days_since !== null && a.days_since !== b.days_since) {
    return b.days_since - a.days_since;
  }

  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

type NormalizeChartInputOptions = Parameters<typeof import('../../lib/chordSheetAdapter').normalizeImportedChordSheet>[1];

async function normalizeChartInput(text: string, options?: NormalizeChartInputOptions) {
  const { normalizeImportedChordSheet } = await import('../../lib/chordSheetAdapter');
  return normalizeImportedChordSheet(text, options);
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function getDaysBg(days: number | null) {
  if (days === null) return 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45';
  if (days >= RULE_DAYS) return 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25';
  if (days >= 60) return 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25';
  return 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25';
}

type SetlistsTabView = 'setlists' | 'songs';

interface SetlistsTabProps {
  initialView?: SetlistsTabView;
  fixedView?: SetlistsTabView;
}

export function SetlistsTab({ initialView = 'setlists', fixedView }: SetlistsTabProps) {
  const { user, isOrgAdmin, isAdmin, isPlatformOwner } = useAuth();
  const location = useLocation();
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
  const isSongsOnly = fixedView === 'songs';
  const [showSongResults, setShowSongResults] = useState((fixedView || initialView) === 'songs');
  const [selectedSetlists, setSelectedSetlists] = useState<Set<string>>(new Set());
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'setlists' | 'songs' | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectModeSongs, setSelectModeSongs] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'not_ready' | 'never_used'>('all');
  const [songPage, setSongPage] = useState({ resultKey: '', limit: SONG_PAGE_SIZE });
  const [setlistPage, setSetlistPage] = useState({ resultKey: '', limit: SETLIST_PAGE_SIZE });
  const [selectedChartSong, setSelectedChartSong] = useState<SongUsage | null>(null);
  const [songViewerTab, setSongViewerTab] = useState<SongViewerTab>('lyrics');
  const [editingLibrarySong, setEditingLibrarySong] = useState<SongUsage | null>(null);
  const [editLibrarySongForm, setEditLibrarySongForm] = useState({
    title: '',
    artist: '',
    song_key: '',
    youtube_url: '',
  });
  const [chartSaving, setChartSaving] = useState(false);
  const [songDetailsSaving, setSongDetailsSaving] = useState(false);
  const [showWebImport, setShowWebImport] = useState(false);
  const [webImportSaving, setWebImportSaving] = useState(false);
  const [webImportQuery, setWebImportQuery] = useState('');
  const [webImportForm, setWebImportForm] = useState({
    title: '',
    artist: '',
    song_key: '',
    chordpro_text: '',
  });
  const [chartImportCandidates, setChartImportCandidates] = useState<ChartImportCandidate[]>([]);
  const [chartImportReviewOpen, setChartImportReviewOpen] = useState(false);
  const [chartImportView, setChartImportView] = useState<ChartImportView>('new');
  const [chartImportPreparing, setChartImportPreparing] = useState(false);
  const [chartImportSaving, setChartImportSaving] = useState(false);
  const [chartImportProgress, setChartImportProgress] = useState({ done: 0, total: 0 });
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [selectedDuplicateTitle, setSelectedDuplicateTitle] = useState('');
  const [duplicateKeeperId, setDuplicateKeeperId] = useState('');
  const [duplicateMergeSaving, setDuplicateMergeSaving] = useState(false);
  const [duplicateEditReturn, setDuplicateEditReturn] = useState<{ groupKey: string; keeperId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartFileRef = useRef<HTMLInputElement>(null);
  const canManageSongLibrary = isOrgAdmin || isAdmin || isPlatformOwner;
  const openChartStorageKey = user?.id ? `${SONG_CHART_OPEN_STORAGE_PREFIX}:${user.id}` : '';
  const ownerFilter = new URLSearchParams(location.search).get('owner');
  const showMyCreatedSets = !isSongsOnly && ownerFilter === 'me';

  useEffect(() => {
    const state = location.state as { openModal?: string } | null;
    if (state?.openModal === 'add-song' && isSongsOnly) setShowWebImport(true);
    if (state?.openModal === 'create-set' && !isSongsOnly) setShowImport(true);
    if (state?.openModal) window.history.replaceState({}, document.title, location.pathname + location.search);
  }, [isSongsOnly, location.pathname, location.search, location.state]);

  const fetchData = async () => {
    const [setlistRes, songsRes, songLeadersRes] = await Promise.all([
      supabase
        .from('setlists')
        .select('id, status, event_id, created_by, events(title, event_date, event_type), setlist_songs(id, position, song_id, performed_key, youtube_url, songs(id, title, artist, song_key, youtube_url, lyrics, chordpro_text))')
        .eq('status', 'approved')
        .order('created_at', { ascending: false }),
      supabase.from('songs').select('id, title, artist, song_key, created_by, youtube_url, lyrics, chordpro_text').order('title'),
      supabase.from('event_assignments').select('event_id, profiles(first_name, last_name, nickname, gender, avatar_url), roles!inner(name)').eq('roles.name', 'Song Leader'),
    ]);

    const approvedSetlists = (setlistRes.data || []) as unknown as SetlistWithEvent[];
    setSetlists(approvedSetlists);

    const slMap: Record<string, string> = {};
    const slAvatarMap: Record<string, { avatarUrl: string | null; firstName: string; lastName: string }> = {};
    ((songLeadersRes.data || []) as SongLeaderAssignmentRow[]).forEach((a) => {
      const leaderProfile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      if (leaderProfile) {
        const prefix = leaderProfile.gender === 'male' ? 'Bro.' : leaderProfile.gender === 'female' ? 'Sis.' : '';
        slMap[a.event_id] = prefix ? `${prefix} ${leaderProfile.first_name}` : `${leaderProfile.first_name} ${leaderProfile.last_name}`;
        slAvatarMap[a.event_id] = {
          avatarUrl: leaderProfile.avatar_url,
          firstName: leaderProfile.first_name,
          lastName: leaderProfile.last_name,
        };
      }
    });
    setSongLeaderMap(slMap);
    setSongLeaderAvatarMap(slAvatarMap);

    const songs = songsRes.data || [];
    const usages = buildSongUsages({
      songs,
      setlists: approvedSetlists,
      ruleDays: RULE_DAYS,
      sanitizeTitle: sanitizeSongTitle,
    });

    usages.sort(compareLibrarySongs);

    setSongUsages(usages);
    setLoading(false);
    return usages;
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!fixedView) return;
    setShowSongResults(fixedView === 'songs');
  }, [fixedView]);

  useEffect(() => {
    if (!openChartStorageKey || selectedChartSong) return;

    try {
      const rawStoredSong = localStorage.getItem(openChartStorageKey);
      if (!rawStoredSong) return;

      const parsed = JSON.parse(rawStoredSong) as Partial<SongUsage>;
      if (typeof parsed.id !== 'string' || typeof parsed.title !== 'string') {
        localStorage.removeItem(openChartStorageKey);
        return;
      }

      setSelectedChartSong({
        id: parsed.id,
        title: parsed.title,
        artist: parsed.artist || '',
        song_key: parsed.song_key || '',
        created_by: parsed.created_by ?? null,
        youtube_url: parsed.youtube_url ?? null,
        lyrics: parsed.lyrics ?? null,
        chordpro_text: parsed.chordpro_text ?? null,
        last_used_date: parsed.last_used_date ?? null,
        days_since: parsed.days_since ?? null,
        is_safe: Boolean(parsed.is_safe),
        latest_usage: parsed.latest_usage ?? null,
        usages: parsed.usages ?? [],
      });
    } catch {
      localStorage.removeItem(openChartStorageKey);
    }
  }, [openChartStorageKey, selectedChartSong]);

  useEffect(() => {
    if (!selectedChartSong) return;
    const latestSong = songUsages.find(song => song.id === selectedChartSong.id);
    if (latestSong && latestSong !== selectedChartSong) setSelectedChartSong(latestSong);
  }, [selectedChartSong?.id, songUsages]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSongViewer = (song: SongUsage, initialTab: SongViewerTab = 'lyrics') => {
    setSongViewerTab(initialTab);
    setSelectedChartSong(song);
    if (!openChartStorageKey) return;
    try {
      localStorage.setItem(openChartStorageKey, JSON.stringify(song));
    } catch {
      // Open chart persistence is a convenience only.
    }
  };

  const closeChartSong = () => {
    setSelectedChartSong(null);
    setSongViewerTab('lyrics');
    if (!openChartStorageKey) return;
    try {
      localStorage.removeItem(openChartStorageKey);
    } catch {
      // Ignore storage failures.
    }
  };

  const openEditLibrarySong = (song: SongUsage, returnToDuplicateReview: { groupKey: string; keeperId: string } | null = null) => {
    setDuplicateEditReturn(returnToDuplicateReview);
    setEditingLibrarySong(song);
    setEditLibrarySongForm({
      title: song.title || '',
      artist: song.artist || '',
      song_key: song.song_key || '',
      youtube_url: song.youtube_url || '',
    });
  };

  const closeEditLibrarySong = () => {
    if (songDetailsSaving) return;
    setEditingLibrarySong(null);
    if (duplicateEditReturn) {
      setDuplicateReviewOpen(true);
      setDuplicateEditReturn(null);
    }
  };

  const handleSaveLibrarySongDetails = async () => {
    if (!editingLibrarySong || songDetailsSaving) return;

    const title = sanitizeSongTitle(editLibrarySongForm.title.trim());
    const artist = editLibrarySongForm.artist.trim();
    const songKey = editLibrarySongForm.song_key.trim();
    const youtubeUrl = editLibrarySongForm.youtube_url.trim();
    const canRenameSong = editingLibrarySong.created_by === user?.id || canManageSongLibrary;
    const titleChanged = normalizeSongTitle(title) !== normalizeSongTitle(editingLibrarySong.title);

    if (canRenameSong && !title) {
      toast('error', 'Song title is required');
      return;
    }

    const titleMatch = canRenameSong && titleChanged
      ? songUsages.find(song => song.id !== editingLibrarySong.id && normalizeSongTitle(song.title) === normalizeSongTitle(title))
      : null;
    if (titleMatch) {
      toast('error', `“${titleMatch.title}” already exists. Choose a different title or clean up the duplicate first.`);
      return;
    }

    setSongDetailsSaving(true);
    try {
      const updatePayload: {
        artist: string;
        song_key: string;
        youtube_url: string;
        title?: string;
      } = {
        artist,
        song_key: songKey,
        youtube_url: youtubeUrl,
      };

      if (canRenameSong) {
        updatePayload.title = title;
      }

      const { data, error } = await withSaveTimeout(
        supabase
          .from('songs')
          .update(updatePayload)
          .eq('id', editingLibrarySong.id)
          .select('id, title, artist, song_key, created_by, youtube_url, chordpro_text')
          .maybeSingle()
      );

      if (error || !data) {
        throw new Error(error?.message || 'No song was updated');
      }

      const updatedSong: SongUsage = {
        ...editingLibrarySong,
        title: sanitizeSongTitle(data.title),
        artist: data.artist || '',
        song_key: data.song_key || '',
        created_by: data.created_by ?? editingLibrarySong.created_by ?? null,
        youtube_url: data.youtube_url || '',
        chordpro_text: data.chordpro_text ?? editingLibrarySong.chordpro_text,
      };

      setSongUsages(current => current.map(song => song.id === updatedSong.id ? updatedSong : song));
      if (selectedChartSong?.id === updatedSong.id) setSelectedChartSong(updatedSong);
      const returnContext = duplicateEditReturn;
      const refreshedUsages = await fetchData();
      setEditingLibrarySong(null);
      setDuplicateEditReturn(null);

      if (returnContext) {
        const refreshedGroups = new Map<string, SongUsage[]>();
        refreshedUsages.forEach(song => {
          const groupKey = normalizeSongTitle(song.title);
          if (!groupKey) return;
          refreshedGroups.set(groupKey, [...(refreshedGroups.get(groupKey) || []), song]);
        });
        const duplicateGroups = Array.from(refreshedGroups.entries())
          .filter(([, songs]) => songs.length > 1)
          .map(([key, songs]) => ({
            key,
            songs: [...songs].sort((a, b) => getDuplicateSongScore(b) - getDuplicateSongScore(a)),
          }))
          .sort((a, b) => a.songs[0].title.localeCompare(b.songs[0].title));
        const returnGroup = duplicateGroups.find(group => group.key === returnContext.groupKey)
          || duplicateGroups[0]
          || null;

        setSelectedDuplicateTitle(returnGroup?.key || '');
        setDuplicateKeeperId(
          returnGroup?.songs.find(song => song.id === returnContext.keeperId)?.id
          || returnGroup?.songs[0]?.id
          || ''
        );
        setDuplicateReviewOpen(Boolean(returnGroup));
        toast('success', returnGroup ? 'Song details updated. Returning to duplicate review.' : 'Song details updated. No duplicate titles remain.');
      } else {
        toast('success', 'Song details updated');
      }
    } catch (error: unknown) {
      console.error('Failed to update song details:', error);
      toast('error', getErrorMessage(error, 'Failed to update song details'));
    } finally {
      setSongDetailsSaving(false);
    }
  };

  const closeWebImport = () => {
    if (webImportSaving) return;
    setShowWebImport(false);
  };

  const openWebChartSource = () => {
    const query = webImportQuery.trim() || webImportForm.title.trim();
    if (!query) {
      toast('error', 'Enter a song title first');
      return;
    }

    window.open(ULTIMATE_GUITAR_SEARCH_URL(query), '_blank', 'noopener,noreferrer');
  };

  const handleSaveWebImport = async () => {
    if (!user || webImportSaving) return;

    const normalizedChart = await normalizeChartInput(webImportForm.chordpro_text, { preferredFormat: 'ultimate-guitar' });
    const chartText = normalizedChart.chordproText.trim();
    const metadata = parseChordProMetadata(chartText);
    const title = sanitizeSongTitle((webImportForm.title || metadata.title || webImportQuery).trim());
    const artist = (webImportForm.artist || metadata.artist || '').trim();
    const songKey = (webImportForm.song_key || metadata.key || '').trim();

    if (!title) {
      toast('error', 'Song title is required');
      return;
    }

    if (!chartText) {
      toast('error', 'Paste the chart before saving');
      return;
    }

    setWebImportSaving(true);
    try {
      const { data: existingSongs, error: existingError } = await supabase
        .from('songs')
        .select('id, title, artist, song_key, chordpro_text');
      if (existingError) throw existingError;

      const existing = existingSongs?.find(song => normalizeSongTitle(song.title) === normalizeSongTitle(title));
      let savedSong: SongUsage | null = null;

      if (existing) {
        const { data, error } = await withSaveTimeout(
          supabase
            .from('songs')
            .update({
              artist: existing.artist || artist,
              song_key: existing.song_key || songKey,
              chordpro_text: chartText,
            })
            .eq('id', existing.id)
            .select('id, title, artist, song_key, chordpro_text')
            .maybeSingle()
        );
        if (error || !data) throw new Error(error?.message || 'Could not update the song chart');
        savedSong = {
          id: data.id,
          title: sanitizeSongTitle(data.title),
          artist: data.artist || '',
          song_key: data.song_key || '',
          chordpro_text: data.chordpro_text,
          last_used_date: null,
          days_since: null,
          is_safe: true,
          latest_usage: null,
          usages: [],
        };
        toast('success', 'Song chart updated');
      } else {
        const { data, error } = await withSaveTimeout(
          supabase
            .from('songs')
            .insert({
              title,
              artist,
              song_key: songKey,
              chordpro_text: chartText,
              created_by: user.id,
            })
            .select('id, title, artist, song_key, chordpro_text')
            .maybeSingle()
        );
        if (error || !data) throw new Error(error?.message || 'Could not add song to library');
        savedSong = {
          id: data.id,
          title: sanitizeSongTitle(data.title),
          artist: data.artist || '',
          song_key: data.song_key || '',
          chordpro_text: data.chordpro_text,
          last_used_date: null,
          days_since: null,
          is_safe: true,
          latest_usage: null,
          usages: [],
        };
        toast('success', 'Song added to library');
      }

      setShowWebImport(false);
      setWebImportForm({ title: '', artist: '', song_key: '', chordpro_text: '' });
      await fetchData();
      if (savedSong) openSongViewer(savedSong, 'chart');
    } catch (error: unknown) {
      console.error('Failed to save web chart import:', error);
      toast('error', getErrorMessage(error, 'Failed to save song chart'));
    } finally {
      setWebImportSaving(false);
    }
  };

  const loadXLSX = (): Promise<XLSXModule> => {
    const xlsxWindow = window as WindowWithXLSX;
    if (xlsxWindow.XLSX) return Promise.resolve(xlsxWindow.XLSX);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.onload = () => {
        if (xlsxWindow.XLSX) resolve(xlsxWindow.XLSX);
        else reject(new Error('Spreadsheet library did not initialize'));
      };
      script.onerror = () => reject(new Error('Failed to load spreadsheet library'));
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    let XLSX: XLSXModule;
    try { XLSX = await loadXLSX(); } catch { toast('error', 'Failed to load spreadsheet library'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const parseDateValue = (val: unknown): string => {
          if (typeof val === 'number') {
            const d = XLSX.SSF.parse_date_code(val);
            if (!d) return '';
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

        const colRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A', defval: '' });
        let headerRowIdx = -1;
        let isWorshipFormat = false;

        for (let i = 0; i < Math.min(colRows.length, 5); i++) {
          const vals = Object.values(colRows[i]).map((c) => String(c).toLowerCase().trim());
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
            const allEmpty = Object.values(row).every((c) => !String(c).trim());
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
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
          rows = json.map((row) => {
            const dateVal = row['Date'] || row['Event Date'] || row['date'] || row['event_date'] || '';
            const nameVal = row['Event'] || row['Event Name'] || row['event'] || row['event_name'] || 'Imported Event';
            const titleVal = row['Song Title'] || row['Song'] || row['Title'] || row['song_title'] || row['title'] || '';
            const artistVal = row['Artist'] || row['artist'] || '';
            const keyVal = row['Key'] || row['Song Key'] || row['key'] || row['song_key'] || '';
            const leaderVal = row['Song Leader'] || row['song_leader'] || row['Leader'] || '';
            return {
              event_date: parseDateValue(dateVal),
              event_name: String(nameVal),
              song_title: String(titleVal),
              artist: String(artistVal),
              song_key: String(keyVal),
              song_category: '',
              song_leader: String(leaderVal).trim(),
            };
          }).filter(r => r.song_title.trim());
        }

        setImportData(rows);
        setShowImport(true);
      } catch { toast('error', 'Failed to parse Excel file'); }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });

  const handleChartUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !canManageSongLibrary) return;
    setChartImportPreparing(true);
    try {
      const chartFiles: Array<{ name: string; text: string }> = [];

      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          toast('info', 'For Bolt publishing, upload exported .cho files directly instead of a .zip backup.');
        } else if (file.name.toLowerCase().endsWith('.cho')) {
          chartFiles.push({ name: file.name, text: await readFileAsText(file) });
        }
      }

      if (chartFiles.length === 0) {
        toast('error', 'No .cho song charts found in that file');
        return;
      }

      const { data: existingSongs, error: existingError } = await supabase
        .from('songs')
        .select('id, title, artist, song_key, chordpro_text');
      if (existingError) throw existingError;

      const parsedCharts = await Promise.all(chartFiles.map(async (chartFile, index) => {
        const normalizedChart = await normalizeChartInput(chartFile.text);
        const metadata = parseChordProMetadata(normalizedChart.chordproText);
        const fallbackName = chartFile.name.replace(/\.cho$/i, '').split('/').pop() || 'Untitled Song';
        return {
          id: `${index}:${chartFile.name}`,
          fileName: chartFile.name,
          title: sanitizeSongTitle(metadata.title || fallbackName),
          artist: metadata.artist || '',
          songKey: metadata.key || '',
          chordproText: normalizedChart.chordproText,
        };
      }));

      const titleCounts = new Map<string, number>();
      parsedCharts.forEach(chart => {
        const titleKey = normalizeSongTitle(chart.title);
        titleCounts.set(titleKey, (titleCounts.get(titleKey) || 0) + 1);
      });

      const existingByTitle = new Map<string, typeof existingSongs>();
      (existingSongs || []).forEach(song => {
        const titleKey = normalizeSongTitle(song.title);
        existingByTitle.set(titleKey, [...(existingByTitle.get(titleKey) || []), song]);
      });

      const firstFileByFingerprint = new Map<string, string>();
      const selectedReplacementFileBySongId = new Map<string, string>();
      const nextCandidates: ChartImportCandidate[] = parsedCharts.map(chart => {
        const titleKey = normalizeSongTitle(chart.title);
        const artistKey = normalizeSongArtist(chart.artist);
        const fingerprint = chartFingerprint(chart.chordproText);
        const exactDuplicateOf = firstFileByFingerprint.get(fingerprint) || null;
        if (!exactDuplicateOf) firstFileByFingerprint.set(fingerprint, chart.fileName);

        const titleMatches = existingByTitle.get(titleKey) || [];
        const artistMatches = artistKey
          ? titleMatches.filter(song => normalizeSongArtist(song.artist || '') === artistKey)
          : [];
        const existing = artistMatches.length === 1
          ? artistMatches[0]
          : titleMatches.length === 1
          ? titleMatches[0]
          : null;
        const hasTitleConflict = (titleCounts.get(titleKey) || 0) > 1;
        const fillsMissingArtist = Boolean(existing && !existing.artist?.trim() && chart.artist.trim());

        let action: ChartImportAction = 'create';
        let reason = 'Ready to add';
        let requiresReview = false;
        if (exactDuplicateOf) {
          action = 'skip';
          reason = `Exact duplicate of ${exactDuplicateOf}`;
          requiresReview = true;
        } else if (existing) {
          const selectedReplacementFile = selectedReplacementFileBySongId.get(existing.id);
          if (selectedReplacementFile) {
            action = 'skip';
            reason = `Alternative chart — ${selectedReplacementFile} will update ${existing.title}`;
            requiresReview = true;
          } else {
            selectedReplacementFileBySongId.set(existing.id, chart.fileName);
            action = 'update';
            reason = fillsMissingArtist
              ? `Will update ${existing.title} and add artist: ${chart.artist}`
              : `Will update existing song: ${existing.title}`;
          }
        } else if (titleMatches.length > 1) {
          action = 'skip';
          reason = 'Multiple existing songs share this title';
          requiresReview = true;
        } else if (hasTitleConflict) {
          action = 'skip';
          reason = 'Multiple selected charts share this title';
          requiresReview = true;
        }

        return {
          ...chart,
          action,
          reason,
          existingSongId: existing?.id || null,
          hasTitleConflict,
          isExactDuplicate: Boolean(exactDuplicateOf),
          requiresReview,
          fillsMissingArtist,
        };
      });

      setChartImportCandidates(nextCandidates);
      setChartImportProgress({ done: 0, total: 0 });
      setChartImportView('new');
      setChartImportReviewOpen(true);
    } catch (error: unknown) {
      console.error('Failed to prepare song charts:', error);
      toast('error', getErrorMessage(error, 'Failed to prepare song charts'));
    } finally {
      setChartImportPreparing(false);
      if (chartFileRef.current) chartFileRef.current.value = '';
    }
  };

  const closeChartImportReview = () => {
    if (chartImportSaving) return;
    setChartImportReviewOpen(false);
    setChartImportCandidates([]);
    setChartImportView('new');
    setChartImportProgress({ done: 0, total: 0 });
  };

  const updateChartImportCandidate = (id: string, action: ChartImportAction) => {
    setChartImportCandidates(current => current.map(candidate => (
      candidate.id === id ? { ...candidate, action } : candidate
    )));
  };

  const commitChartImport = async () => {
    if (!user || !canManageSongLibrary || chartImportSaving) return;
    const selectedCandidates = chartImportCandidates.filter(candidate => candidate.action !== 'skip');
    if (selectedCandidates.length === 0) {
      toast('info', 'Choose at least one chart to import');
      return;
    }

    setChartImportSaving(true);
    setChartImportProgress({ done: 0, total: selectedCandidates.length });
    let createdCount = 0;
    let updatedCount = 0;

    try {
      for (let index = 0; index < selectedCandidates.length; index += 1) {
        const candidate = selectedCandidates[index];
        if (candidate.action === 'update' && candidate.existingSongId) {
          const { error } = await supabase
            .from('songs')
            .update({
              ...(candidate.fillsMissingArtist ? { artist: candidate.artist } : {}),
              ...(candidate.songKey ? { song_key: candidate.songKey } : {}),
              chordpro_text: candidate.chordproText,
            })
            .eq('id', candidate.existingSongId);
          if (error) throw error;
          updatedCount += 1;
        } else {
          const { error } = await supabase
            .from('songs')
            .insert({
              title: candidate.title,
              artist: candidate.artist,
              song_key: candidate.songKey,
              chordpro_text: candidate.chordproText,
              created_by: user.id,
            });
          if (error) throw error;
          createdCount += 1;
        }
        setChartImportProgress({ done: index + 1, total: selectedCandidates.length });
      }

      toast('success', `Imported ${selectedCandidates.length} charts (${createdCount} new, ${updatedCount} updated)`);
      setChartImportReviewOpen(false);
      setChartImportCandidates([]);
      await fetchData();
    } catch (error: unknown) {
      console.error('Failed to import song charts:', error);
      toast('error', getErrorMessage(error, `Import stopped after ${createdCount + updatedCount} charts`));
    } finally {
      setChartImportSaving(false);
    }
  };

  const handleSaveChart = async (text: string, assignedSongKey?: string) => {
    if (!selectedChartSong) return;
    setChartSaving(true);
    try {
      const { data, error } = await withSaveTimeout(
        supabase
          .from('songs')
          .update({
            chordpro_text: text,
            ...(assignedSongKey ? { song_key: assignedSongKey.trim() } : {}),
          })
          .eq('id', selectedChartSong.id)
          .select('id, chordpro_text, song_key')
          .maybeSingle()
      );

      if (error || !data) {
        const message = error?.message || 'No song chart was updated';
        console.error('Failed to save chart:', error);
        throw new Error(message);
      }

      toast('success', assignedSongKey ? `Song chart saved in key ${assignedSongKey.trim()}` : 'Song chart saved');
      const updatedSong = { ...selectedChartSong, chordpro_text: data.chordpro_text, song_key: data.song_key || selectedChartSong.song_key };
      setSelectedChartSong(updatedSong);
      if (openChartStorageKey) {
        try {
          localStorage.setItem(openChartStorageKey, JSON.stringify(updatedSong));
        } catch {
          // Cached open-chart state is best-effort.
        }
      }
      setSongUsages(prev => prev.map(song => song.id === selectedChartSong.id ? { ...song, chordpro_text: data.chordpro_text, song_key: data.song_key || song.song_key } : song));
    } catch (error: unknown) {
      console.error('Failed to save chart:', error);
      toast('error', getErrorMessage(error, 'Failed to save chart'));
      throw error;
    } finally {
      setChartSaving(false);
    }
  };

  const handleImport = async () => {
    if (!user || importData.length === 0) return;
    const { data: librarySongs, error: libraryError } = await supabase
      .from('songs')
      .select('id, title, artist');
    if (libraryError) {
      toast('error', 'Could not check the song library. Please try again.');
      return;
    }

    const songsByTitle = new Map(
      (librarySongs || []).map(song => [normalizeSongTitle(song.title), song])
    );
    const missingArtists = importData.filter(row => {
      const librarySong = songsByTitle.get(normalizeSongTitle(sanitizeSongTitle(row.song_title)));
      return !row.artist.trim() && !librarySong?.artist?.trim();
    });
    if (missingArtists.length > 0) {
      const names = missingArtists.slice(0, 3).map(row => sanitizeSongTitle(row.song_title)).join(', ');
      const more = missingArtists.length > 3 ? ` and ${missingArtists.length - 3} more` : '';
      toast('error', `Add an artist before importing: ${names}${more}.`);
      return;
    }
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
          const cleanSongTitle = sanitizeSongTitle(song.song_title);
          const normalizedTitle = normalizeSongTitle(cleanSongTitle);
          const existingSong = songsByTitle.get(normalizedTitle);
          let songId: string;
          if (existingSong) {
            songId = existingSong.id;
            if (!existingSong.artist?.trim() && song.artist.trim()) {
              const artist = song.artist.trim();
              const { error: artistError } = await supabase.from('songs').update({ artist }).eq('id', songId);
              if (artistError) throw artistError;
              existingSong.artist = artist;
            }
          } else {
            const artist = song.artist.trim();
            const { data: newSong, error: songError } = await supabase.from('songs').insert({ title: cleanSongTitle, artist, song_key: song.song_key.trim(), created_by: user.id }).select('id, title, artist').maybeSingle();
            if (songError || !newSong) { songsDone++; setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents }); continue; }
            songId = newSong.id;
            songsByTitle.set(normalizedTitle, newSong);
          }
          const { error: setlistSongError } = await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: songId, position: i + 1, song_category: song.song_category || '' });
          if (setlistSongError) throw setlistSongError;
          songsDone++;
          setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents });
        }

        eventsDone++;
        setImportProgress({ songsDone, eventsDone, totalSongs, totalEvents });
      }

      toast('success', `Imported ${totalEvents} sets with ${totalSongs} songs`);
      setShowImport(false);
      setImportData([]);
      fetchData();
    } catch { toast('error', 'Import failed'); }
    setImporting(false);
  };

  const toggleSetlist = (id: string) => {
    setSelectedSetlists(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSetlists = () => {
    if (selectedSetlists.size === sortedSetlists.length) setSelectedSetlists(new Set());
    else setSelectedSetlists(new Set(sortedSetlists.map(s => s.id)));
  };

  const toggleSong = (id: string) => {
    setSelectedSongs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSongs = () => {
    if (selectedSongs.size === filteredSongs.length) setSelectedSongs(new Set());
    else setSelectedSongs(new Set(filteredSongs.map(s => s.id)));
  };

  const requestDeleteSong = (songId: string) => {
    setSelectedSongs(new Set([songId]));
    setShowDeleteConfirm('songs');
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
      toast('success', `Deleted ${ids.length} set${ids.length > 1 ? 's' : ''}`);
      fetchData();
    } catch { toast('error', 'Failed to delete sets'); }
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

  const chooseDuplicateGroup = (groupKey: string) => {
    const group = duplicateSongGroups.find(candidate => candidate.key === groupKey);
    setSelectedDuplicateTitle(groupKey);
    setDuplicateKeeperId(group?.songs[0]?.id || '');
  };

  const openDuplicateReview = () => {
    const firstGroup = duplicateSongGroups[0];
    setSelectedDuplicateTitle(firstGroup?.key || '');
    setDuplicateKeeperId(firstGroup?.songs[0]?.id || '');
    setDuplicateReviewOpen(true);
  };

  const handleMergeDuplicateSongs = async () => {
    if (!canManageSongLibrary || duplicateMergeSaving || !selectedDuplicateGroup || !duplicateKeeperId) return;
    const keeper = selectedDuplicateGroup.songs.find(song => song.id === duplicateKeeperId);
    if (!keeper) return;
    if (!keeper.artist.trim()) {
      toast('error', 'Add an artist to the song you want to keep before merging.');
      return;
    }

    const duplicateIds = selectedDuplicateGroup.songs.filter(song => song.id !== keeper.id).map(song => song.id);
    if (duplicateIds.length === 0) return;
    const currentGroupIndex = duplicateSongGroups.findIndex(group => group.key === selectedDuplicateGroup.key);
    const nextDuplicateGroup = duplicateSongGroups[currentGroupIndex + 1]
      || duplicateSongGroups.find(group => group.key !== selectedDuplicateGroup.key)
      || null;

    setDuplicateMergeSaving(true);
    try {
      const groupIds = [keeper.id, ...duplicateIds];
      const { data: sectionNotes, error: notesError } = await supabase
        .from('song_section_notes')
        .select('id, song_id, section_key, scope')
        .in('song_id', groupIds);
      if (notesError) throw notesError;

      const retainedNoteKeys = new Set(
        (sectionNotes || [])
          .filter(note => note.song_id === keeper.id)
          .map(note => `${note.section_key}:${note.scope}`)
      );
      const duplicateNotes = (sectionNotes || []).filter(note => duplicateIds.includes(note.song_id));
      const conflictingNoteIds: string[] = [];
      const movableNoteIds: string[] = [];
      duplicateNotes.forEach(note => {
        const noteKey = `${note.section_key}:${note.scope}`;
        if (retainedNoteKeys.has(noteKey)) {
          conflictingNoteIds.push(note.id);
          return;
        }
        retainedNoteKeys.add(noteKey);
        movableNoteIds.push(note.id);
      });

      if (conflictingNoteIds.length > 0) {
        const { error } = await supabase.from('song_section_notes').delete().in('id', conflictingNoteIds);
        if (error) throw error;
      }
      if (movableNoteIds.length > 0) {
        const { error } = await supabase.from('song_section_notes').update({ song_id: keeper.id }).in('id', movableNoteIds);
        if (error) throw error;
      }

      const { data: setlistUsages, error: usageLookupError } = await supabase
        .from('setlist_songs')
        .select('id, setlist_id, song_id')
        .in('song_id', groupIds);
      if (usageLookupError) throw usageLookupError;

      const keeperSetlistIds = new Set(
        (setlistUsages || []).filter(row => row.song_id === keeper.id).map(row => row.setlist_id)
      );
      const duplicateUsageRows = (setlistUsages || []).filter(row => duplicateIds.includes(row.song_id));
      const duplicateUsageIdsToDelete: string[] = [];
      const duplicateUsageIdsToMove: string[] = [];
      duplicateUsageRows.forEach(row => {
        if (keeperSetlistIds.has(row.setlist_id)) {
          duplicateUsageIdsToDelete.push(row.id);
          return;
        }
        keeperSetlistIds.add(row.setlist_id);
        duplicateUsageIdsToMove.push(row.id);
      });

      if (duplicateUsageIdsToDelete.length > 0) {
        const { error } = await supabase.from('setlist_songs').delete().in('id', duplicateUsageIdsToDelete);
        if (error) throw error;
      }
      if (duplicateUsageIdsToMove.length > 0) {
        const { error } = await supabase.from('setlist_songs').update({ song_id: keeper.id }).in('id', duplicateUsageIdsToMove);
        if (error) throw error;
      }

      const { error: deleteError } = await supabase.from('songs').delete().in('id', duplicateIds);
      if (deleteError) throw deleteError;

      await fetchData();
      if (nextDuplicateGroup) {
        setSelectedDuplicateTitle(nextDuplicateGroup.key);
        setDuplicateKeeperId(nextDuplicateGroup.songs[0]?.id || '');
        toast('success', `Merged into “${keeper.title}”. Next: “${nextDuplicateGroup.title}”`);
      } else {
        setDuplicateReviewOpen(false);
        setSelectedDuplicateTitle('');
        setDuplicateKeeperId('');
        toast('success', `Merged into “${keeper.title}”. No duplicate titles remain.`);
      }
    } catch (error: unknown) {
      console.error('Failed to merge duplicate songs:', error);
      toast('error', getErrorMessage(error, 'Could not merge the duplicate songs'));
    } finally {
      setDuplicateMergeSaving(false);
    }
  };

  const filteredSongs = songUsages.filter(s => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.artist.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === 'safe') return s.is_safe;
    if (activeFilter === 'not_ready') return !s.is_safe && s.days_since !== null;
    if (activeFilter === 'never_used') return s.days_since === null;
    return true;
  });

  const duplicateSongGroups = (() => {
    const groups = new Map<string, SongUsage[]>();
    songUsages.forEach(song => {
      const titleKey = normalizeSongTitle(song.title);
      if (!titleKey) return;
      groups.set(titleKey, [...(groups.get(titleKey) || []), song]);
    });
    return Array.from(groups.entries())
      .filter(([, songs]) => songs.length > 1)
      .map(([key, songs]) => ({
        key,
        title: songs[0].title,
        songs: [...songs].sort((a, b) => getDuplicateSongScore(b) - getDuplicateSongScore(a)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();
  const selectedDuplicateGroup = duplicateSongGroups.find(group => group.key === selectedDuplicateTitle) || duplicateSongGroups[0] || null;

  const newChartCandidates = chartImportCandidates.filter(candidate => !candidate.existingSongId && !candidate.requiresReview);
  const existingChartCandidates = chartImportCandidates.filter(candidate => Boolean(candidate.existingSongId) && !candidate.requiresReview);
  const reviewChartCandidates = chartImportCandidates.filter(candidate => candidate.requiresReview);
  const visibleChartCandidates = chartImportView === 'new'
    ? newChartCandidates
    : chartImportView === 'existing'
    ? existingChartCandidates
    : chartImportView === 'review'
    ? reviewChartCandidates
    : chartImportCandidates;

  const songResultKey = JSON.stringify([activeFilter, search]);
  const visibleSongLimit = songPage.resultKey === songResultKey ? songPage.limit : SONG_PAGE_SIZE;
  const visibleSongs = filteredSongs.slice(0, visibleSongLimit);
  const remainingSongCount = filteredSongs.length - visibleSongs.length;

  const showMoreSongs = () => {
    setSongPage(current => {
      const currentLimit = current.resultKey === songResultKey ? current.limit : SONG_PAGE_SIZE;
      return {
        resultKey: songResultKey,
        limit: Math.min(filteredSongs.length, currentLimit + SONG_PAGE_SIZE),
      };
    });
  };

  const visibleSetlists = showMyCreatedSets && user?.id
    ? setlists.filter(setlist => setlist.created_by === user.id)
    : setlists;

  const filteredSetlists = filterSetlistsBySearch(visibleSetlists, search, songLeaderMap);

  const sortedSetlists = [...filteredSetlists].sort((a, b) => {
    if (sortKey === 'date_asc') return (a.events?.event_date ?? '').localeCompare(b.events?.event_date ?? '');
    if (sortKey === 'songs_desc') return (b.setlist_songs?.length ?? 0) - (a.setlist_songs?.length ?? 0);
    return (b.events?.event_date ?? '').localeCompare(a.events?.event_date ?? '');
  });

  const setlistResultKey = JSON.stringify([search, sortKey, showMyCreatedSets, sortedSetlists.length]);
  const visibleSetlistLimit = setlistPage.resultKey === setlistResultKey
    ? setlistPage.limit
    : SETLIST_PAGE_SIZE;
  const paginatedSetlists = sortedSetlists.slice(0, visibleSetlistLimit);
  const remainingSetlistCount = sortedSetlists.length - paginatedSetlists.length;

  const showMoreSetlists = () => {
    setSetlistPage(current => {
      const currentLimit = current.resultKey === setlistResultKey ? current.limit : SETLIST_PAGE_SIZE;
      return {
        resultKey: setlistResultKey,
        limit: Math.min(sortedSetlists.length, currentLimit + SETLIST_PAGE_SIZE),
      };
    });
  };

  const safeCount = songUsages.filter(s => s.is_safe).length;
  const notReadyCount = songUsages.filter(s => !s.is_safe && s.days_since !== null).length;
  const neverUsed = songUsages.filter(s => s.days_since === null).length;
  const selectedSongLyrics = getEffectiveSongLyrics(selectedChartSong);
  const selectedSongLyricsSource = getSongLyricsSource(selectedChartSong);

  const songDetailsModal = (
    <Modal
      open={selectedChartSong !== null}
      onClose={closeChartSong}
      title="Song details"
      size="lg"
      hideHeader
      bodyClassName="!overflow-hidden !p-0"
    >
      {selectedChartSong && (
        <div className="flex h-[70vh] min-h-0 flex-col overflow-hidden text-gray-950 dark:text-white">
          <div className="flex items-start gap-3 border-b border-black/[0.06] bg-gradient-to-r from-emerald-50 via-white to-white px-5 py-4 dark:border-white/[0.08] dark:from-emerald-500/10 dark:via-white/[0.03] dark:to-transparent">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
              <Music2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Song library</p>
              <h2 className="truncate text-2xl font-black tracking-[-0.04em]">{selectedChartSong.title}</h2>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-white/55">
                {selectedChartSong.artist || 'No artist'}{selectedChartSong.song_key ? ` · Key ${selectedChartSong.song_key}` : ''}
              </p>
            </div>
            <button onClick={closeChartSong} aria-label="Close song details" className="rounded-full p-2 text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div role="tablist" aria-label="Song content" className="grid grid-cols-2 gap-1 border-b border-black/[0.06] bg-gray-50 p-1.5 dark:border-white/[0.08] dark:bg-white/[0.035]">
            {([
              { id: 'lyrics' as const, label: 'Lyrics', icon: FileText },
              { id: 'chart' as const, label: 'Chord chart', icon: Music2 },
            ]).map(item => {
              const Icon = item.icon;
              const selected = songViewerTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`song-viewer-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`song-viewer-panel-${item.id}`}
                  onClick={() => setSongViewerTab(item.id)}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition-colors ${selected ? 'bg-white text-gray-950 shadow-sm dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-white/70 dark:text-white/55 dark:hover:bg-white/[0.06]'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.id === 'chart' && selectedChartSong.chordpro_text?.trim() && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="Chord chart available" />
                  )}
                </button>
              );
            })}
          </div>

          {songViewerTab === 'lyrics' ? (
            <div id="song-viewer-panel-lyrics" role="tabpanel" aria-labelledby="song-viewer-tab-lyrics" className="flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="mx-auto max-w-3xl">
                {selectedSongLyrics && <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Lyrics</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-white/50">
                      {selectedSongLyricsSource === 'saved'
                        ? 'Saved lyrics'
                        : selectedSongLyricsSource === 'chart'
                        ? 'Lyrics extracted from the chord chart'
                        : 'No lyrics saved yet'}
                    </p>
                  </div>
                  {selectedChartSong.chordpro_text?.trim() && (
                    <button type="button" onClick={() => setSongViewerTab('chart')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
                      <Music2 className="h-3.5 w-3.5" /> View chord chart
                    </button>
                  )}
                </div>}
                {selectedSongLyrics ? (
                  <article className="whitespace-pre-wrap rounded-2xl border border-gray-200 bg-gray-50 p-5 text-[15px] font-medium leading-8 text-gray-800 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white/80 sm:p-6" aria-label={`Lyrics for ${selectedChartSong.title}`}>
                    {selectedSongLyrics}
                  </article>
                ) : (
                  <div className="flex min-h-[28rem] items-center justify-center px-5 py-8 text-center">
                    <div className="max-w-sm">
                      <FileText className="mx-auto h-8 w-8 text-gray-400 dark:text-white/35" />
                      <p className="mt-3 text-lg font-black text-gray-800 dark:text-white/80">No lyrics saved yet</p>
                      <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-white/50">Open the chord chart to review or add the song’s chart content.</p>
                      <button type="button" onClick={() => setSongViewerTab('chart')} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-black">
                        <Music2 className="h-4 w-4" /> Open chord chart
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div id="song-viewer-panel-chart" role="tabpanel" aria-labelledby="song-viewer-tab-chart" className="min-h-0 flex-1 overflow-hidden bg-white dark:bg-[#111412]">
              <SongChartViewer
                songId={selectedChartSong.id}
                title={selectedChartSong.title}
                artist={selectedChartSong.artist}
                songKey={selectedChartSong.song_key}
                chordproText={selectedChartSong.chordpro_text}
                editable
                fullBleed
                hideTitleHeader
                saving={chartSaving}
                onSave={handleSaveChart}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );

  if (loading) {
    return (
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
  const showSongsView = isSongsOnly || showSongResults;

  if (!showSongsView) {
    return (
      <div className="space-y-5 pb-2">

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileUpload(e.target.files)} />

        {setlists.length === 0 ? (
          <EmptyState
            icon={<Music className="h-8 w-8" />}
            title="No approved sets"
            description="Approved sets from events will appear here. You can also import past sets from Excel."
            action={<button onClick={() => fileRef.current?.click()} className="btn-primary min-h-11"><Upload className="h-4 w-4" /> Import Excel</button>}
          />
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setSelectedSetlists(new Set());
                  }}
                  aria-label="Search approved sets"
                  placeholder={showMyCreatedSets ? 'Search my sets by song, event, artist…' : 'Search sets by song, leader, event, artist…'}
                  className="w-full h-12 pl-10 pr-9 rounded-full text-[13px] bg-white/[0.055] border border-white/[0.08] text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSelectedSetlists(new Set());
                    }}
                  className="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                    aria-label="Clear set search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {search.trim() && (
                <span className="text-[11px] font-mono text-gray-400 dark:text-white/30 sm:shrink-0">
                  {sortedSetlists.length} set{sortedSetlists.length !== 1 ? 's' : ''} found
                </span>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white/[0.095] px-5 text-[13px] font-black text-white transition-all hover:bg-[#1ed760] hover:text-black active:scale-[0.97]"
              >
                <Upload className="h-4 w-4" />
                Import Excel
              </button>
            </motion.div>

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
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.055] px-3 text-[11px] font-semibold text-white/55 backdrop-blur-md transition-colors hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-[0.97]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select
                  </button>
                  <div className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.055] pl-3 pr-2 backdrop-blur-md focus-within:ring-2 focus-within:ring-emerald-400/70">
                    <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-white/35" />
                    <select
                      value={sortKey}
                      onChange={e => setSortKey(e.target.value as SortKey)}
                      aria-label="Sort approved sets"
                      className="text-[11px] font-semibold text-white/60 bg-transparent border-none outline-none cursor-pointer pr-1"
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
              className="overflow-hidden border-y border-white/[0.08]"
            >
              {sortedSetlists.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Search className="mx-auto h-6 w-6 text-gray-300 dark:text-white/20" />
                  <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                    {showMyCreatedSets ? 'No sets created by you yet' : 'No sets found'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-white/35">
                    {showMyCreatedSets
                      ? 'Sets you create from event pages will show here.'
                      : 'Try another song title, artist, event, or song leader.'}
                  </p>
                </div>
              ) : paginatedSetlists.map(sl => {
                const isExpanded = expandedSetlist === sl.id;
                const eventDate = sl.events?.event_date;
                const daysSinceEvent = eventDate ? differenceInDays(new Date(), parseISO(eventDate)) : null;
                const songCount = sl.setlist_songs?.length ?? 0;
                const isSelected = selectedSetlists.has(sl.id);
                const displayName = songLeaderMap[sl.event_id] || sl.events?.title || 'Untitled';
                const eventType = sl.events?.event_type;
                const leaderAvatar = songLeaderAvatarMap[sl.event_id];
                const orderedSongs = [...(sl.setlist_songs || [])].sort((a, b) => a.position - b.position);
                const artworkSongs = orderedSongs.slice(0, 4);

                return (
                  <motion.div
                    key={sl.id}
                    variants={itemVariants}
                    className={`group relative border-b border-white/[0.075] transition-colors duration-200 last:border-b-0 ${
                      isSelected
                        ? 'bg-[#22c55e]/10'
                        : 'hover:bg-white/[0.045]'
                    }`}
                  >
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
                        className="flex min-h-20 flex-1 items-center gap-3.5 py-3.5 pl-3 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 sm:py-4 sm:pl-4 sm:pr-4"
                        aria-expanded={isExpanded}
                        aria-controls={`setlist-songs-${sl.id}`}
                      >
                        <div className="grid h-16 w-16 shrink-0 grid-cols-2 overflow-hidden rounded-md bg-white/[0.055] ring-1 ring-white/[0.08] sm:h-20 sm:w-20">
                          {Array.from({ length: 4 }).map((_, index) => {
                            const setlistSong = artworkSongs[index];
                            return setlistSong ? (
                              <SongArtwork
                                key={setlistSong.id}
                                song={setlistSong.songs}
                                youtubeUrl={setlistSong.youtube_url || setlistSong.songs?.youtube_url}
                                className="h-full w-full rounded-none"
                              />
                            ) : (
                              <div
                                key={`empty-${index}`}
                                className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_25%,rgba(34,197,94,0.30),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,0,0,0.92))]"
                              >
                                <Music className="h-3.5 w-3.5 text-white/45" />
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[1rem] font-black leading-tight text-white sm:text-[1.12rem]">
                              {displayName}
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.12] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-300 ring-1 ring-emerald-500/20">
                              <CheckCircle className="h-2.5 w-2.5" /> Approved
                            </span>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
                            {eventDate && (
                              <span className="text-[11px] text-white/40 flex items-center gap-1 font-mono">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(eventDate), 'MMM d, yyyy')}
                              </span>
                            )}
                            <span className="text-[11px] text-white/30 font-mono">{songCount} song{songCount !== 1 ? 's' : ''}</span>
                            {daysSinceEvent !== null && (
                              <span className="text-[11px] text-white/25 font-mono hidden sm:inline">{daysSinceEvent}d ago</span>
                            )}
                            {eventType && eventType !== 'imported' && (
                              <span className="hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/45 capitalize">{eventType.replace(/_/g, ' ')}</span>
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
                          <div className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${isExpanded ? 'bg-white/[0.06] rotate-180' : ''}`}>
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-white/35" />
                          </div>
                        </div>
                      </button>
                    </div>

                    {isExpanded && sl.setlist_songs && (
                      <div id={`setlist-songs-${sl.id}`} className="border-t border-white/[0.055] bg-black/10">
                        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                          <Music2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                          <span className="text-[10px] font-black text-gray-500 dark:text-white/45 uppercase tracking-[0.14em]">Songs in order</span>
                          <span className="ml-auto text-[10px] font-mono font-semibold text-gray-400 dark:text-white/30">{songCount} total</span>
                        </div>
                        <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04] pb-2">
                          {sl.setlist_songs
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((ss, i) => {
                              const songUsage = songUsages.find(u => u.id === ss.song_id);
                              const displayKey = ss.performed_key || ss.songs?.song_key || '';
                              const keyChanged = ss.performed_key && ss.songs?.song_key && ss.performed_key !== ss.songs.song_key;
                              return (
		                                <button
		                                  key={ss.id}
		                                  type="button"
		                                  onClick={() => songUsage && openSongViewer(songUsage, 'lyrics')}
		                                  disabled={!songUsage}
		                                  aria-label={`Open lyrics and chord chart for ${ss.songs?.title || 'song'}`}
		                                  className="group/song flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 disabled:cursor-default dark:hover:bg-white/[0.045]"
		                                >
	                                  <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-gray-100 dark:bg-white/[0.05] text-[10px] font-black text-gray-400 dark:text-white/35 shrink-0 tabular-nums">{i + 1}</span>
	                                  <SongArtwork
	                                    song={ss.songs}
	                                    youtubeUrl={ss.youtube_url || ss.songs?.youtube_url}
	                                    className="h-10 w-10 rounded-[0.35rem]"
	                                  />
	                                  <div className="min-w-0 flex-1">
	                                    <div className="flex items-center gap-1.5 flex-wrap">
	                                      <p className="text-[13px] font-semibold text-gray-900 transition-colors group-hover/song:text-emerald-600 dark:text-white dark:group-hover/song:text-emerald-300 leading-snug">{ss.songs?.title}</p>
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
	                                  <FileText className="h-4 w-4 shrink-0 text-emerald-500/70 transition-colors group-hover/song:text-emerald-400" aria-hidden="true" />
	                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {remainingSetlistCount > 0 && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <span className="text-[11px] font-mono text-white/30" aria-live="polite">
                  Showing {paginatedSetlists.length} of {sortedSetlists.length} sets
                </span>
                <button
                  type="button"
                  onClick={showMoreSetlists}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-5 text-[12px] font-black text-white transition-colors hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-[0.98] sm:w-auto sm:min-w-52"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show {Math.min(SETLIST_PAGE_SIZE, remainingSetlistCount)} more
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete modal */}
        <Modal
          open={showDeleteConfirm !== null}
          onClose={() => { if (!deleting) setShowDeleteConfirm(null); }}
          title="Delete Sets"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete {selectedSetlists.size} set{selectedSetlists.size > 1 ? 's' : ''} and their associated imported events? This cannot be undone.
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
        <Modal open={showImport} onClose={() => { if (!importing) { setShowImport(false); setImportData([]); } }} title="Import Sets from Excel" size="lg">
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
            ) : importData.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Choose a set spreadsheet</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-white/45">Upload an Excel or CSV file to create and review imported sets.</p>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary min-h-11">
                  <Upload className="h-4 w-4" /> Choose File
                </button>
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
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Artist</th>
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
                          <td className="px-3 py-2 min-w-40">
                            <input
                              type="text"
                              value={row.artist}
                              onChange={event => setImportData(current => current.map((item, index) => index === i ? { ...item, artist: event.target.value } : item))}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900 ${row.artist.trim() ? 'border-gray-200 dark:border-gray-700' : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'}`}
                              placeholder="Add artist"
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.song_key}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Every song needs an artist. If the artist is already saved in the library, a blank box can use that saved artist. Song keys in brackets like [D] are auto-detected.</p>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowImport(false); setImportData([]); }} className="btn-secondary">Cancel</button>
                  <button onClick={handleImport} className="btn-primary">Import {importData.length} Songs</button>
                </div>
              </>
            )}
          </div>
        </Modal>
        {songDetailsModal}
      </div>
    );
  }

  /* ────────────────────────── Song Results View ────────────────────────── */
  return (
    <div className="space-y-5 pb-2">

      {canManageSongLibrary && (
        <input ref={chartFileRef} type="file" accept=".cho" multiple className="hidden" onChange={e => handleChartUpload(e.target.files)} />
      )}

      {canManageSongLibrary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-4 sm:flex-row sm:items-center"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">Import SongBookPro charts</p>
            <p className="mt-1 text-xs leading-5 text-white/45">Choose multiple .cho files, review duplicates and existing matches, then import only the versions you approve.</p>
          </div>
          <button
            type="button"
            onClick={() => chartFileRef.current?.click()}
            disabled={chartImportPreparing || chartImportSaving}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-black transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {chartImportPreparing ? 'Reading charts…' : 'Choose .cho files'}
          </button>
        </motion.div>
      )}

      {/* ── Filter pills ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 gap-2 sm:flex"
        role="group"
        aria-label="Song availability filters"
      >
        {[
          { id: 'all' as const, label: 'All', count: songUsages.length },
          { id: 'safe' as const, label: 'Safe', count: safeCount },
          { id: 'not_ready' as const, label: 'Not Ready', count: notReadyCount },
          { id: 'never_used' as const, label: 'Never Used', count: neverUsed },
        ].map(filter => {
          const active = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(prev => (prev === filter.id && filter.id !== 'all' ? 'all' : filter.id))}
              aria-pressed={active}
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[12px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 sm:w-auto sm:shrink-0 ${
                active
                  ? 'bg-[#22c55e] text-black'
                  : 'bg-white/[0.10] text-white hover:bg-white/[0.16]'
              }`}
            >
              {filter.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-black/12 text-black' : 'bg-white/[0.10] text-white/68'}`}>
                {filter.count}
              </span>
            </button>
          );
        })}
        {canManageSongLibrary && duplicateSongGroups.length > 0 && (
          <button
            type="button"
            onClick={openDuplicateReview}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/[0.10] px-4 text-[12px] font-black text-amber-200 transition-colors hover:bg-amber-400/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 sm:w-auto sm:shrink-0"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Duplicates
            <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10px]">{duplicateSongGroups.length}</span>
          </button>
        )}
      </motion.div>

      {/* ── Active filter chip ── */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-[11px] font-mono text-gray-500 dark:text-white/40 tracking-wide">Showing:</span>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              if (!isSongsOnly) setShowSongResults(false);
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
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search songs by title or artist…"
            aria-label="Search songs"
            className="h-11 w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-11 text-[13px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/30 dark:focus:border-emerald-500/50"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear song search" className="absolute right-0.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 dark:hover:bg-white/[0.06] dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (selectModeSongs) {
              setSelectModeSongs(false);
              setSelectedSongs(new Set());
            } else {
              setSelectModeSongs(true);
            }
          }}
          aria-label={selectModeSongs ? 'Exit selection mode' : 'Select songs'}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-[0.97] ${
            selectModeSongs
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/[0.12] dark:text-emerald-300'
              : 'border-black/[0.06] bg-white/70 text-gray-600 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.07]'
          }`}
        >
          {selectModeSongs ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
        </button>
      </motion.div>

      {/* ── Bulk action bar ── */}
      {filteredSongs.length > 0 && selectModeSongs && (
        <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ── Song list ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="divide-y divide-white/[0.07]"
      >
        {filteredSongs.length === 0 ? (
          <p className="rounded-[0.75rem] bg-[#181818] px-5 py-12 text-center text-sm text-gray-400 dark:text-white/30">No songs found</p>
        ) : (
          <>
            {visibleSongs.map(song => {
              const latestUsage = !song.is_safe ? song.latest_usage : null;
              return (
                <div
                  key={song.id}
                  className={`flex flex-wrap items-start gap-3 py-3 transition-colors ${
                    selectedSongs.has(song.id)
                      ? 'bg-[#22c55e]/10'
                      : 'hover:bg-white/[0.035]'
                  }`}
                >
                  {selectModeSongs && (
                    <button onClick={() => toggleSong(song.id)} aria-label={`${selectedSongs.has(song.id) ? 'Deselect' : 'Select'} ${song.title}`} className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 sm:mt-1.5">
                      {selectedSongs.has(song.id)
                        ? <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        : <Square className="h-4 w-4 text-gray-300 dark:text-white/20 hover:text-gray-400 dark:hover:text-white/35 transition-colors" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => selectModeSongs ? toggleSong(song.id) : openSongViewer(song, 'lyrics')}
                    aria-label={selectModeSongs ? `${selectedSongs.has(song.id) ? 'Deselect' : 'Select'} ${song.title}` : `Open lyrics and chord chart for ${song.title}`}
                    className="group/song flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                  >
                    <SongArtwork
                      song={song}
                      youtubeUrl={song.youtube_url}
                      className="h-14 w-14 rounded-[0.35rem] transition-transform group-hover/song:scale-[1.03]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-gray-900 transition-colors group-hover/song:text-emerald-600 dark:text-white dark:group-hover/song:text-emerald-300" style={{ letterSpacing: '-0.01em' }}>{song.title}</span>
                        {song.song_key && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-white/45">{song.song_key}</span>
                        )}
                        {!selectModeSongs && <FileText className="h-3.5 w-3.5 text-emerald-500 opacity-70 transition-opacity group-hover/song:opacity-100" aria-hidden="true" />}
                      </span>
                      {song.artist && <span className="mt-0.5 block truncate text-[11px] text-gray-400 dark:text-white/40">{song.artist}</span>}
                      <span className="mt-0.5 block text-[10px] font-mono tracking-wide text-gray-400 dark:text-white/35 sm:hidden">
                        {song.last_used_date ? format(parseISO(song.last_used_date), 'MMM d, yyyy') : 'Never used'}
                      </span>
                      {latestUsage && (
                        <span
                          className="mt-0.5 block truncate text-[10px] font-medium text-red-500/80 dark:text-red-300/70"
                          title={`Used in ${latestUsage.event_title} · ${format(parseISO(latestUsage.event_date), 'MMM d, yyyy')}${latestUsage.event_type ? ` · ${latestUsage.event_type}` : ''}`}
                        >
                          <span className="font-bold">Used in {latestUsage.event_title}</span>
                          <span> · {format(parseISO(latestUsage.event_date), 'MMM d')}{latestUsage.event_type ? ` · ${latestUsage.event_type}` : ''}</span>
                        </span>
                      )}
                    </span>
                    <span className="hidden items-center gap-1 whitespace-nowrap pt-1.5 text-center font-mono text-[11px] tracking-wide text-gray-400 dark:text-white/40 sm:flex">
                      {song.last_used_date ? (
                        <><Clock className="h-3 w-3" />{format(parseISO(song.last_used_date), 'MMM d, yyyy')}</>
                      ) : (
                        <span className="text-gray-300 dark:text-white/30">Never</span>
                      )}
                    </span>
                  </button>
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openEditLibrarySong(song)}
                      aria-label={`Edit ${song.title}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/45 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/[0.12] hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 active:scale-[0.96] sm:h-9 sm:w-9"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteSong(song.id)}
                      aria-label={`Delete ${song.title}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/15 bg-red-500/[0.08] text-red-300 transition-colors hover:border-red-400/45 hover:bg-red-500/[0.16] hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 active:scale-[0.96] sm:h-9 sm:w-9"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
              );
            })}
          </>
        )}
      </motion.div>

      {remainingSongCount > 0 && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <span className="text-[11px] font-mono text-gray-400 dark:text-white/30" aria-live="polite">
            Showing {visibleSongs.length} of {filteredSongs.length} songs
          </span>
          <button
            type="button"
            onClick={showMoreSongs}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-5 text-[12px] font-black text-white transition-colors hover:bg-white/[0.10] active:scale-[0.98] sm:w-auto sm:min-w-52"
          >
            <ChevronDown className="h-4 w-4" />
            Show {Math.min(SONG_PAGE_SIZE, remainingSongCount)} more
          </button>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-1 text-[11px] font-mono text-gray-400 dark:text-white/30 flex-wrap tracking-wide">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />Safe (90+ days)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-500" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.5)' }} />Caution (60–90d)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />Not ready (&lt;60d)</span>
      </div>

      <Modal
        open={duplicateReviewOpen}
        onClose={() => {
          if (!duplicateMergeSaving) setDuplicateReviewOpen(false);
        }}
        title="Compare duplicate songs"
        size="xl"
        mobileView="page"
        closeOnBackdrop={!duplicateMergeSaving}
        closeOnEscape={!duplicateMergeSaving}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.07] p-3">
            <p className="text-sm font-bold text-amber-100">Choose the best library record to keep.</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/55">Merging moves setlist history and unique section notes to the selected song, then removes the extra records. Existing details on the selected song are kept. After a successful merge, the next duplicate opens automatically.</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Duplicate song title groups">
            {duplicateSongGroups.map(group => (
              <button
                key={group.key}
                type="button"
                onClick={() => chooseDuplicateGroup(group.key)}
                disabled={duplicateMergeSaving}
                aria-pressed={selectedDuplicateGroup?.key === group.key}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${selectedDuplicateGroup?.key === group.key ? 'bg-amber-400 text-black' : 'bg-white/[0.07] text-white/60 hover:bg-white/[0.11]'}`}
              >
                {group.title} <span className="ml-1 font-mono text-[10px] opacity-65">{group.songs.length}</span>
              </button>
            ))}
          </div>

          {selectedDuplicateGroup ? (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedDuplicateGroup.songs.map((song, index) => {
                const selected = duplicateKeeperId === song.id;
                const memberNames = Array.from(new Set(song.usages
                  .map(usage => songLeaderMap[usage.event_id])
                  .filter((name): name is string => Boolean(name))));
                const eventTypes = Array.from(new Set(song.usages
                  .map(usage => usage.event_type.trim())
                  .filter(Boolean)));
                return (
                  <label
                    key={song.id}
                    className={`relative rounded-2xl border p-4 transition ${duplicateMergeSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'border-emerald-400/50 bg-emerald-500/[0.09] ring-1 ring-emerald-400/20' : 'border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.045]'}`}
                  >
                    <input
                      type="radio"
                      name="duplicate-song-keeper"
                      value={song.id}
                      checked={selected}
                      onChange={() => setDuplicateKeeperId(song.id)}
                      disabled={duplicateMergeSaving}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">{song.title}</p>
                        <p className={song.artist ? 'mt-1 truncate text-xs text-white/55' : 'mt-1 text-xs font-bold text-amber-300'}>{song.artist || 'Missing artist'}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${selected ? 'bg-emerald-400 text-black' : 'bg-white/[0.07] text-white/40'}`}>
                        {selected && <CheckCircle className="h-3 w-3" aria-hidden="true" />}
                        {selected ? 'Keep' : index === 0 ? 'Recommended' : 'Compare'}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Chord chart</dt>
                        <dd className={`mt-1 font-bold ${song.chordpro_text?.trim() ? 'text-emerald-300' : 'text-white/35'}`}>{song.chordpro_text?.trim() ? 'Available' : 'Missing'}</dd>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Song key</dt>
                        <dd className="mt-1 font-bold text-white/70">{song.song_key || 'Not set'}</dd>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Approved-set uses</dt>
                        <dd className="mt-1 font-bold text-white/70">{song.usages.length}</dd>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Last used</dt>
                        <dd className="mt-1 font-bold text-white/70">{song.last_used_date ? format(parseISO(song.last_used_date), 'MMM d, yyyy') : 'Never'}</dd>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Used by · song leader</dt>
                        <dd className="mt-1 line-clamp-2 font-bold text-white/70">{memberNames.length > 0 ? memberNames.join(', ') : song.usages.length > 0 ? 'No leader assigned' : 'Never used'}</dd>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2.5">
                        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-white/30">Event types</dt>
                        <dd className="mt-1 line-clamp-2 font-bold text-white/70">{eventTypes.length > 0 ? eventTypes.join(', ') : 'None'}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault();
                        setDuplicateReviewOpen(false);
                        openEditLibrarySong(song, {
                          groupKey: selectedDuplicateGroup.key,
                          keeperId: duplicateKeeperId,
                        });
                      }}
                      disabled={duplicateMergeSaving}
                      className="mt-3 min-h-10 w-full rounded-xl bg-white/[0.07] px-3 text-xs font-bold text-white/65 transition hover:bg-white/[0.11] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit this record
                    </button>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] px-4 py-10 text-center text-sm text-white/40">No duplicate titles found.</div>
          )}

          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-xs leading-5 text-white/40">The selected record remains unchanged. All other records in this title group will be removed after their references are moved.</p>
            <button
              type="button"
              onClick={handleMergeDuplicateSongs}
              disabled={duplicateMergeSaving || !selectedDuplicateGroup || !duplicateKeeperId}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {duplicateMergeSaving
                ? 'Merging…'
                : duplicateSongGroups.length > 1
                ? 'Merge and review next'
                : 'Merge final duplicate'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={chartImportReviewOpen}
        onClose={closeChartImportReview}
        title="Review chord chart import"
        size="xl"
        mobileView="page"
        closeOnBackdrop={!chartImportSaving}
        closeOnEscape={!chartImportSaving}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Files', value: chartImportCandidates.length, tone: 'text-white' },
              { label: 'New songs', value: newChartCandidates.length, tone: 'text-emerald-300' },
              { label: 'Updates', value: existingChartCandidates.length, tone: 'text-sky-300' },
              { label: 'Review', value: reviewChartCandidates.length, tone: 'text-amber-300' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-center">
                <p className={`text-xl font-black tabular-nums ${item.tone}`}>{item.value}</p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/35">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-3 sm:flex-row sm:items-center">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="flex-1 text-xs leading-5 text-amber-100/65">Existing songs are selected for replacement automatically. Duplicate exports and alternative charts stay skipped until you choose which version should win.</p>
            <button
              type="button"
              onClick={() => setChartImportCandidates(current => current.map(candidate => (
                candidate.isExactDuplicate || candidate.existingSongId || candidate.hasTitleConflict
                  ? candidate
                  : { ...candidate, action: 'create' }
              )))}
              disabled={chartImportSaving}
              className="min-h-10 shrink-0 rounded-xl bg-white/[0.07] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.11] disabled:opacity-50"
            >
              Select all ready
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20 p-1" aria-label="Chord chart import groups">
            {([
              { id: 'new', label: 'New songs', count: newChartCandidates.length },
              { id: 'existing', label: 'Existing songs', count: existingChartCandidates.length },
              { id: 'review', label: 'Needs review', count: reviewChartCandidates.length },
              { id: 'all', label: 'All files', count: chartImportCandidates.length },
            ] as const).map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => setChartImportView(group.id)}
                aria-pressed={chartImportView === group.id}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-bold transition ${chartImportView === group.id ? 'bg-white/[0.12] text-white shadow-sm' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/70'}`}
              >
                {group.label} <span className="ml-1 font-mono text-[10px] opacity-70">{group.count}</span>
              </button>
            ))}
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-2xl border border-white/[0.07]">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#111] text-[9px] font-black uppercase tracking-[0.12em] text-white/35">
                <tr>
                  <th className="px-3 py-3">Chart</th>
                  <th className="px-3 py-3">Artist / key</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visibleChartCandidates.map(candidate => (
                  <tr key={candidate.id} className={candidate.action === 'skip' ? 'bg-white/[0.015]' : 'bg-emerald-500/[0.035]'}>
                    <td className="px-3 py-3 align-top">
                      <p className="font-bold text-white">{candidate.title}</p>
                      <p className="mt-1 max-w-[18rem] truncate font-mono text-[10px] text-white/30" title={candidate.fileName}>{candidate.fileName}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className={candidate.artist ? 'text-white/65' : 'text-amber-300'}>{candidate.artist || 'Missing artist'}</p>
                      <p className={`mt-1 font-mono ${candidate.songKey ? 'text-emerald-300' : 'text-amber-300'}`}>{candidate.songKey ? `Key ${candidate.songKey}` : 'Key not set'}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p className={candidate.isExactDuplicate ? 'text-white/35' : candidate.requiresReview ? 'text-amber-300' : 'text-emerald-300'}>{candidate.reason}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select
                        value={candidate.action}
                        onChange={event => updateChartImportCandidate(candidate.id, event.target.value as ChartImportAction)}
                        disabled={chartImportSaving || candidate.isExactDuplicate}
                        aria-label={`Import action for ${candidate.title}`}
                        className="h-10 min-w-36 rounded-xl border border-white/[0.09] bg-[#181818] px-3 text-xs font-bold text-white outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {candidate.existingSongId && <option value="update">Replace existing</option>}
                        <option value="create">Add new</option>
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {visibleChartCandidates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-white/35">No charts in this group.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {chartImportSaving && (
            <div className="space-y-2 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-3">
              <div className="flex items-center justify-between text-xs font-bold text-white/65">
                <span>Saving charts…</span>
                <span className="tabular-nums">{chartImportProgress.done}/{chartImportProgress.total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                  style={{ width: `${chartImportProgress.total ? (chartImportProgress.done / chartImportProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeChartImportReview} disabled={chartImportSaving} className="btn-secondary min-h-11 disabled:opacity-50">Cancel</button>
            <button
              type="button"
              onClick={commitChartImport}
              disabled={chartImportSaving || chartImportCandidates.every(candidate => candidate.action === 'skip')}
              className="btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chartImportSaving
                ? `Importing ${chartImportProgress.done}/${chartImportProgress.total}`
                : `Import ${chartImportCandidates.filter(candidate => candidate.action !== 'skip').length} selected charts`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showWebImport} onClose={closeWebImport} title="Search Ultimate Guitar" size="lg">
        <div className="space-y-5">
          <div className="relative rounded-3xl border border-sky-200/80 bg-sky-50/80 p-3 dark:border-sky-500/20 dark:bg-sky-500/[0.08]">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-gray-950 shadow-sm ring-1 ring-sky-200/70 dark:bg-white/[0.06] dark:text-white dark:ring-white/[0.07]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-500/[0.16] dark:text-sky-200 dark:ring-sky-500/20">
                  <Globe2 className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Search source</span>
                  <span className="block truncate text-lg font-semibold">ultimate-guitar.com</span>
                </span>
              </div>
              <button
                type="button"
                onClick={openWebChartSource}
                className="inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-gray-950 px-4 text-xs font-bold text-white shadow-lg shadow-gray-950/10 transition active:scale-[0.97] dark:bg-white dark:text-gray-950"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Search</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={webImportQuery}
                onChange={e => {
                  setWebImportQuery(e.target.value);
                  if (!webImportForm.title) setWebImportForm(prev => ({ ...prev, title: e.target.value }));
                }}
                placeholder="Song title or artist"
                className="w-full h-11 rounded-2xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/30"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-500/[0.12] dark:text-sky-300 dark:ring-sky-500/20">
                <Globe2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-white">Search Ultimate Guitar, then paste the chart here.</p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-white/45">
                  Ultimate Guitar handles the result list and chart screen. ServeSync stores the chart after you paste it.
                </p>
              </div>
              <button
                type="button"
                onClick={openWebChartSource}
                className="hidden shrink-0 items-center gap-1.5 rounded-2xl bg-gray-950 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-gray-950/10 transition active:scale-[0.97] dark:bg-white dark:text-gray-950 sm:inline-flex"
              >
                <ExternalLink className="h-4 w-4" />
                Open search
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,0.75fr,5rem]">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Title</label>
              <input
                value={webImportForm.title}
                onChange={e => setWebImportForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Artist</label>
              <input
                value={webImportForm.artist}
                onChange={e => setWebImportForm(prev => ({ ...prev, artist: e.target.value }))}
                className="w-full h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Key</label>
              <input
                value={webImportForm.song_key}
                onChange={e => setWebImportForm(prev => ({ ...prev, song_key: e.target.value }))}
                placeholder="G"
                className="w-full h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/30"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Chart</label>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-500/[0.12] dark:text-amber-200 dark:ring-amber-500/20">
                <ClipboardPaste className="h-3 w-3" />
                Paste only charts you can store
              </span>
            </div>
            <textarea
              value={webImportForm.chordpro_text}
              onChange={e => {
                const text = e.target.value;
                const metadata = parseChordProMetadata(text);
                setWebImportForm(prev => ({
                  ...prev,
                  chordpro_text: text,
                  title: prev.title || metadata.title || '',
                  artist: prev.artist || metadata.artist || '',
                  song_key: prev.song_key || metadata.key || '',
                }));
              }}
              spellCheck={false}
              placeholder={"Paste the chord chart here...\n\nExample:\nVerse 1:\nG        Em7\nAmazing grace how sweet the sound"}
              className="min-h-[14rem] w-full resize-y rounded-2xl border border-gray-200 bg-white p-3 font-mono text-[12px] leading-6 text-gray-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/25"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-black/[0.05] pt-4 dark:border-white/[0.06]">
            <button type="button" onClick={closeWebImport} disabled={webImportSaving} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={handleSaveWebImport}
              disabled={webImportSaving || !webImportForm.chordpro_text.trim()}
              className="btn-primary"
            >
              {webImportSaving ? 'Saving...' : 'Add to Library'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editingLibrarySong !== null} onClose={closeEditLibrarySong} title="Edit song details" size="md">
        {editingLibrarySong && (() => {
          const canRenameSong = editingLibrarySong.created_by === user?.id || canManageSongLibrary;
          return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-[0.75rem] border border-white/[0.08] bg-[#181818] p-3">
              <SongArtwork
                song={{
                  title: editLibrarySongForm.title,
                  artist: editLibrarySongForm.artist,
                  youtube_url: editLibrarySongForm.youtube_url,
                }}
                youtubeUrl={editLibrarySongForm.youtube_url}
                className="h-16 w-16 rounded-[0.45rem]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{editLibrarySongForm.title || 'Untitled song'}</p>
                <p className="mt-1 truncate text-xs font-semibold text-white/45">
                  {editLibrarySongForm.artist || 'Add an artist to improve artwork matching'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Title</span>
                <input
                  value={editLibrarySongForm.title}
                  onChange={event => setEditLibrarySongForm(form => ({ ...form, title: event.target.value }))}
                  disabled={!canRenameSong}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:text-white/50"
                  placeholder="Song title"
                />
                {!canRenameSong && (
                  <span className="mt-1.5 block text-[11px] font-semibold text-white/35">
                    Only the original creator can rename a shared song.
                  </span>
                )}
                {canManageSongLibrary && editingLibrarySong.created_by !== user?.id && (
                  <span className="mt-1.5 block text-[11px] font-semibold text-emerald-300/55">
                    Admin title editing is enabled for library cleanup.
                  </span>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Artist</span>
                <input
                  value={editLibrarySongForm.artist}
                  onChange={event => setEditLibrarySongForm(form => ({ ...form, artist: event.target.value }))}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Artist or worship team"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Key</span>
                <input
                  value={editLibrarySongForm.song_key}
                  onChange={event => setEditLibrarySongForm(form => ({ ...form, song_key: event.target.value }))}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="A, Bb, G..."
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.18em] text-white/35">YouTube URL</span>
                <input
                  value={editLibrarySongForm.youtube_url}
                  onChange={event => setEditLibrarySongForm(form => ({ ...form, youtube_url: event.target.value }))}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </label>
            </div>

            <p className="text-xs font-medium leading-relaxed text-white/45">
              Saved edits update the shared song record, so setlists, event details, event thumbnails, and the Songs page refresh from the same artist, key, and video link.
            </p>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeEditLibrarySong} disabled={songDetailsSaving} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLibrarySongDetails}
                disabled={songDetailsSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {songDetailsSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <Pencil className="h-4 w-4" />}
                Save details
              </button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Delete modal */}
      <Modal
        open={showDeleteConfirm !== null}
        onClose={() => { if (!deleting) setShowDeleteConfirm(null); }}
        title="Delete Songs"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''}? They will also be removed from all sets. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteConfirm(null)} disabled={deleting} className="btn-secondary">Cancel</button>
            <button onClick={handleDeleteSongs} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors">
              {deleting ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>

      {songDetailsModal}
    </div>
  );
}
