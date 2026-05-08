import { useState, useCallback, useEffect } from 'react';
import {
  Sparkles, Plus, Trash2, Search, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, RotateCcw, Languages,
  Save, Clock, ArrowUpDown, Info, Loader, BookOpen, ThumbsUp,
  ThumbsDown, MessageSquare, Flag, TrendingUp, Heart, Lightbulb,
  Target, AlertCircle, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  runLiveGuidance, FORMAT_SPECS, CATEGORY_ORDER,
  type CheckerSong, type CheckerLanguage, type SongAnalysisResult,
} from '../lib/setlistCheckerEngine';
import type { Song, SetlistCheckerSong, SetlistCheckerResult, SetlistCheckerScorePerSong, SetlistCheckerSession, ServiceFormat } from '../types';

interface SetlistCheckerProps {
  setlistId?: string;
  setlistStatus?: string;
  initialSongs?: SetlistCheckerSong[];
  serviceFormat?: ServiceFormat;
  onDecision?: (decision: 'approve' | 'revision' | 'reject', notes: string) => void;
}

const SONG_CATEGORIES = ['Opening', 'Praise', 'Worship', 'Offering', 'Closing', 'Special'];

function toCheckerSong(s: SetlistCheckerSong): CheckerSong {
  return {
    id: s.id,
    song_id: s.song_id,
    title: s.title,
    artist: s.artist,
    song_key: s.song_key,
    category: s.category,
    duration: s.duration,
    youtube_url: s.youtube_url,
    position: s.position,
  };
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 80 ? 'text-green-700 dark:text-green-300' : score >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const bgColor = score >= 80 ? 'bg-green-50 dark:bg-green-900/20' : score >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20';
  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${bgColor}`}>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${textColor}`}>{score}</span>
    </div>
  );
}

function CategoryFitBadge({ fit }: { fit: 'good' | 'ok' | 'poor' }) {
  const map = {
    good: { icon: CheckCircle, label: 'Well placed', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
    ok: { icon: AlertTriangle, label: 'Placement ok', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    poor: { icon: XCircle, label: 'Misplaced', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  };
  const { icon: Icon, label, color } = map[fit];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

export function SetlistChecker({ setlistId, setlistStatus, initialSongs = [], serviceFormat = 'sunday_full', onDecision }: SetlistCheckerProps) {
  const { user, isLeader, isSetlistCoordinator, isMusicDirector, isAdmin, isProductionDirector, userRoles } = useAuth();
  const { toast } = useToast();

  const canDecide = isLeader || isSetlistCoordinator || isMusicDirector || isAdmin || isProductionDirector
    || userRoles.some(ur => ['Admin', 'Production Director', 'Music Director', 'Setlist Coordinator'].includes(ur.roles?.name || ''));
  const isSubmittedForReview = setlistStatus === 'pending_review';

  const [songs, setSongs] = useState<SetlistCheckerSong[]>(initialSongs);
  const [songSearch, setSongSearch] = useState('');
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [language, setLanguage] = useState<CheckerLanguage>('english');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<(SetlistCheckerResult & { songAnalyses?: SongAnalysisResult[] }) | null>(null);
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [expandedResultSong, setExpandedResultSong] = useState<string | null>(null);
  const [showSuggestedOrder, setShowSuggestedOrder] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [decisionModal, setDecisionModal] = useState<'approve' | 'revision' | 'reject' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SetlistCheckerSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const searchSongs = useCallback(async (q: string) => {
    if (q.length < 2) { setSongResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase.from('songs')
      .select('*')
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .limit(20);
    setSongResults((data || []) as Song[]);
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchSongs(songSearch), 300);
    return () => clearTimeout(timer);
  }, [songSearch, searchSongs]);

  const addSongFromDB = (song: Song) => {
    const newEntry: SetlistCheckerSong = {
      id: crypto.randomUUID(),
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      song_key: song.song_key,
      category: 'Worship',
      duration: song.duration || '',
      youtube_url: song.youtube_url || '',
      position: songs.length + 1,
    };
    setSongs(prev => [...prev, newEntry]);
    setSongSearch('');
    setSongResults([]);
    setShowSearch(false);
  };

  const addManualSong = () => {
    const newEntry: SetlistCheckerSong = {
      id: crypto.randomUUID(),
      song_id: null,
      title: 'New Song',
      artist: '',
      song_key: '',
      category: 'Worship',
      duration: '',
      youtube_url: '',
      position: songs.length + 1,
    };
    setSongs(prev => [...prev, newEntry]);
  };

  const updateSong = (id: string, field: keyof SetlistCheckerSong, value: string) => {
    setSongs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSong = (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, position: i + 1 })));
  };

  const moveSong = (id: string, direction: 'up' | 'down') => {
    setSongs(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((s, i) => ({ ...s, position: i + 1 }));
    });
  };

  const runAnalysis = async () => {
    if (songs.length === 0) { toast('error', 'Add songs before running analysis'); return; }
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 900));

    const checkerSongs = songs.map(toCheckerSong);
    const guidance = runLiveGuidance(checkerSongs, serviceFormat, language);

    const scorePerSong: SetlistCheckerScorePerSong[] = songs.map((s, i) => ({
      song_id: s.id,
      title: s.title,
      score: guidance.songAnalyses[i].score,
      category_fit: guidance.songAnalyses[i].category_fit,
      theological_flags: guidance.songAnalyses[i].theological_flags,
      notes: guidance.songAnalyses[i].notes,
    }));

    const suggestedOrder = [...songs].sort((a, b) =>
      (CATEGORY_ORDER[a.category] ?? 6) - (CATEGORY_ORDER[b.category] ?? 6)
    ).map((s, i) => ({ ...s, position: i + 1 }));

    const allFlags = guidance.songAnalyses.flatMap(a => a.theological_flags);
    const seqSuggestions = [...guidance.sequenceSuggestions, ...guidance.structuralSuggestions];

    const now = new Date().toISOString();
    const r: SetlistCheckerResult & { songAnalyses: SongAnalysisResult[] } = {
      id: crypto.randomUUID(),
      setlist_id: setlistId || null,
      session_id: null,
      created_by: user?.id || '',
      language_mode: language,
      score_overall: guidance.overallScore,
      score_per_song: scorePerSong,
      theological_flags: allFlags,
      sequence_suggestions: seqSuggestions.join('\n\n'),
      category_fit_notes: Object.entries(
        songs.reduce((acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).map(([cat, count]) => `${cat}: ${count}`).join(' · '),
      full_analysis: guidance.fullAnalysisText,
      suggested_order: suggestedOrder,
      status: 'analyzed',
      leader_decision: null,
      leader_notes: null,
      analyzed_at: now,
      decided_at: null,
      decided_by: null,
      created_at: now,
      updated_at: now,
      songAnalyses: guidance.songAnalyses,
    };

    setResult(r);
    setAnalyzing(false);
    setShowSuggestedOrder(false);
    setExpandedResultSong(null);
  };

  const saveToHistory = async () => {
    if (!user || !result) return;
    setSaving(true);
    try {
      if (setlistId) {
        await supabase.from('setlist_checker_results').insert({
          setlist_id: setlistId,
          created_by: user.id,
          language_mode: language,
          score_overall: result.score_overall,
          score_per_song: result.score_per_song,
          theological_flags: result.theological_flags,
          sequence_suggestions: result.sequence_suggestions,
          category_fit_notes: result.category_fit_notes,
          full_analysis: result.full_analysis,
          suggested_order: result.suggested_order,
          status: 'analyzed',
        });
      } else {
        await supabase.from('setlist_checker_sessions').insert({
          created_by: user.id,
          name: songs.map(s => s.title).join(', ').slice(0, 80),
          songs_json: songs,
          result_json: result,
          language_mode: language,
        });
      }
      toast('success', 'Analysis saved');
    } catch {
      toast('error', 'Failed to save');
    }
    setSaving(false);
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('setlist_checker_sessions')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setSavedSessions((data || []) as SetlistCheckerSession[]);
    setShowHistory(true);
  };

  const loadSession = (session: SetlistCheckerSession) => {
    setSongs(session.songs_json);
    if (session.result_json) setResult(session.result_json);
    setLanguage(session.language_mode);
    setShowHistory(false);
  };

  const submitDecision = async () => {
    if (!decisionModal || !result || !user) return;
    setSaving(true);
    try {
      if (setlistId) {
        await supabase.from('setlist_checker_results')
          .update({
            leader_decision: decisionModal,
            leader_notes: decisionNotes || null,
            decided_at: new Date().toISOString(),
            decided_by: user.id,
            status: decisionModal === 'approve' ? 'approved' : decisionModal === 'reject' ? 'rejected' : 'revision',
          })
          .eq('setlist_id', setlistId)
          .order('created_at', { ascending: false })
          .limit(1);
      }
      if (onDecision) onDecision(decisionModal, decisionNotes);
      toast('success', `Decision recorded: ${decisionModal}`);
      setDecisionModal(null);
      setDecisionNotes('');
      setResult(prev => prev ? { ...prev, leader_decision: decisionModal, status: decisionModal === 'approve' ? 'approved' : decisionModal === 'reject' ? 'rejected' : 'revision' } : prev);
    } catch {
      toast('error', 'Failed to save decision');
    }
    setSaving(false);
  };

  const applySuggestedOrder = () => {
    if (!result?.suggested_order) return;
    setSongs(result.suggested_order);
    setShowSuggestedOrder(false);
    toast('success', 'Suggested order applied');
  };

  const overallScore = result?.score_overall ?? 0;
  const scoreColor = overallScore >= 80 ? 'text-green-600 dark:text-green-400'
    : overallScore >= 60 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';
  const scoreRing = overallScore >= 80 ? 'border-green-400 dark:border-green-600'
    : overallScore >= 60 ? 'border-amber-400 dark:border-amber-600'
    : 'border-red-400 dark:border-red-600';

  const decisionConfig = {
    approve: { label: 'Approve Setlist', icon: ThumbsUp, color: 'bg-green-600 hover:bg-green-700' },
    revision: { label: 'Request Revision', icon: MessageSquare, color: 'bg-amber-600 hover:bg-amber-700' },
    reject: { label: 'Reject Setlist', icon: ThumbsDown, color: 'bg-red-600 hover:bg-red-700' },
  };

  const totalFlags = result?.theological_flags.length ?? 0;
  const structuralIssues = result ? (result.sequence_suggestions || '').split('\n\n').filter(Boolean).length : 0;

  const spec = FORMAT_SPECS[serviceFormat];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Setlist Checker</h3>
        {spec && (
          <span className="text-[11px] bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-md font-medium">{spec.label}</span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setLanguage(l => l === 'english' ? 'tagalog_english' : 'english')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            {language === 'english' ? 'EN' : 'TGL-EN'}
          </button>
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Clock className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Songs ({songs.length})</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowSearch(s => !s)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
              >
                <Search className="h-3.5 w-3.5" /> Add from Library
              </button>
              <button
                onClick={addManualSong}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Manual
              </button>
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Search song title or artist..."
                className="input-field pl-9 text-sm"
                autoFocus
              />
              {searchLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />}
            </div>
            {songResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {songResults.map(song => (
                  <button
                    key={song.id}
                    onClick={() => addSongFromDB(song)}
                    className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{song.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{song.artist} {song.song_key && `· ${song.song_key}`}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {songs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No songs yet. Add from the library or manually.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {songs.map((song, i) => {
              const isExpanded = expandedSong === song.id;
              return (
                <div key={song.id} className="px-4 py-2">
                  {/* Row 1: reorder + number + title + expand + delete */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => moveSong(song.id, 'up')} disabled={i === 0} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveSong(song.id, 'down')} disabled={i === songs.length - 1} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="flex items-center justify-center h-5 w-5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{i + 1}</span>
                    <input
                      value={song.title}
                      onChange={e => updateSong(song.id, 'title', e.target.value)}
                      className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0"
                      placeholder="Song title"
                    />
                    <button
                      onClick={() => setExpandedSong(isExpanded ? null : song.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => removeSong(song.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Row 2: artist + category in same line, indented */}
                  <div className="flex items-center gap-2 mt-0.5 ml-[38px]">
                    <input
                      value={song.artist}
                      onChange={e => updateSong(song.id, 'artist', e.target.value)}
                      className="flex-1 min-w-0 text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none focus:ring-0 p-0"
                      placeholder="Artist"
                    />
                    <select
                      value={song.category}
                      onChange={e => updateSong(song.id, 'category', e.target.value)}
                      className="shrink-0 text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-1.5 py-0.5 border-none outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {SONG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {isExpanded && (
                    <div className="flex items-center gap-2 mt-1.5 ml-[38px]">
                      <input
                        value={song.song_key}
                        onChange={e => updateSong(song.id, 'song_key', e.target.value)}
                        placeholder="Key (e.g. G, Bb)"
                        className="input-field text-xs py-1 w-24"
                      />
                      <input
                        value={song.duration}
                        onChange={e => updateSong(song.id, 'duration', e.target.value)}
                        placeholder="Duration (e.g. 4:30)"
                        className="input-field text-xs py-1 w-28"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={runAnalysis}
        disabled={analyzing || songs.length === 0}
        className="w-full btn-primary flex items-center justify-center gap-2"
      >
        {analyzing ? <><Loader className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4" /> Analyze Setlist</>}
      </button>

      {result && (
        <div className="space-y-3 animate-fade-in">
          <div className="card overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-500" /> Analysis Results
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {totalFlags} theological note{totalFlags !== 1 ? 's' : ''} · {structuralIssues} structural issue{structuralIssues !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className={`flex flex-col items-center justify-center h-14 w-14 rounded-xl border-2 ${scoreRing} shrink-0`}>
                  <span className={`text-xl font-bold tabular-nums leading-none ${scoreColor}`}>{result.score_overall}</span>
                  <span className="text-[9px] text-gray-400 leading-none mt-0.5">/ 100</span>
                </div>
              </div>
            </div>

            {result.sequence_suggestions && result.sequence_suggestions.trim() && (
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">Structure & Flow Guidance</p>
                    <div className="space-y-2">
                      {result.sequence_suggestions.split('\n\n').filter(Boolean).map((s, i) => (
                        <p key={i} className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{s}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Per Song Analysis</p>
              {result.score_per_song.map((songScore, i) => {
                const song = songs[i];
                const analysis = result.songAnalyses?.[i];
                const isExpanded = expandedResultSong === songScore.song_id;
                const hasIssues = songScore.theological_flags.length > 0 || songScore.category_fit !== 'good';

                return (
                  <div key={songScore.song_id} className="px-4 py-3">
                    <button
                      onClick={() => setExpandedResultSong(isExpanded ? null : songScore.song_id)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <span className="flex items-center justify-center h-6 w-6 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{songScore.title}</p>
                          {song && <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-medium">{song.category}</span>}
                          {hasIssues && <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        </div>
                        <div className="mt-1.5">
                          <ScoreBar score={songScore.score} />
                        </div>
                      </div>
                      <CategoryFitBadge fit={songScore.category_fit} />
                      <ChevronRight className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {isExpanded && analysis && (
                      <div className="mt-3 ml-9 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Heart className="h-3 w-3" /> Theological Theme
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{analysis.theological_theme}</p>
                          </div>
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" /> Emotional Tone
                            </p>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{analysis.emotional_tone}</p>
                          </div>
                        </div>

                        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> What Works
                          </p>
                          <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">{analysis.what_works}</p>
                        </div>

                        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Info className="h-3 w-3" /> Why This Position
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{analysis.placement_reason}</p>
                        </div>

                        {analysis.theological_flags.length > 0 && (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 px-3 py-2.5 space-y-2">
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Flag className="h-3 w-3" /> Theological Notes
                            </p>
                            {analysis.theological_flags.map((f, fi) => (
                              <p key={fi} className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{f}</p>
                            ))}
                          </div>
                        )}

                        {analysis.what_to_adjust && analysis.what_to_adjust !== analysis.theological_flags[0] && (
                          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Target className="h-3 w-3" /> What to Adjust
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{analysis.what_to_adjust}</p>
                          </div>
                        )}

                        {analysis.suggested_position && (
                          <div className="flex items-center gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 px-3 py-2">
                            <ArrowUpDown className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                            <p className="text-xs text-brand-700 dark:text-brand-300 font-medium">{analysis.suggested_position}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {result.suggested_order.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowSuggestedOrder(s => !s)}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1.5"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {showSuggestedOrder ? 'Hide' : 'View'} Suggested Order
                </button>
                {showSuggestedOrder && (
                  <div className="mt-2 space-y-1">
                    {result.suggested_order.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 py-1">
                        <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white flex-1">{s.title}</span>
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{s.category}</span>
                      </div>
                    ))}
                    <button
                      onClick={applySuggestedOrder}
                      className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Apply this order
                    </button>
                  </div>
                )}
              </div>
            )}

            {result.full_analysis && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowFullAnalysis(s => !s)}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {showFullAnalysis ? 'Hide' : 'View'} Full Written Analysis
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showFullAnalysis ? 'rotate-90' : ''}`} />
                </button>
                {showFullAnalysis && (
                  <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 p-4 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                    {result.full_analysis.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </div>
                )}
              </div>
            )}

            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <button
                onClick={saveToHistory}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Analysis'}
              </button>
              {result.leader_decision && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  result.leader_decision === 'approve' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : result.leader_decision === 'reject' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                }`}>
                  Decision: {result.leader_decision}
                </span>
              )}
            </div>
          </div>

          {canDecide && !result.leader_decision && isSubmittedForReview && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Leader Decision</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Review the analysis and record your decision for this setlist.</p>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {(Object.keys(decisionConfig) as ('approve' | 'revision' | 'reject')[]).map(key => {
                  const cfg = decisionConfig[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setDecisionModal(key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors ${cfg.color}`}
                    >
                      <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {canDecide && !isSubmittedForReview && setlistId && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {!setlistStatus || setlistStatus === 'draft'
                  ? 'Review actions are available once the setlist is submitted for review.'
                  : setlistStatus === 'approved'
                  ? 'This setlist has already been approved.'
                  : setlistStatus === 'rejected'
                  ? 'This setlist has been rejected.'
                  : setlistStatus === 'revision_requested'
                  ? 'Awaiting resubmission from the creator.'
                  : null}
              </p>
            </div>
          )}
        </div>
      )}

      {decisionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-base font-semibold text-gray-900 dark:text-white">{decisionConfig[decisionModal].label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This decision will be recorded in the audit history.</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <textarea
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                placeholder="Add notes (optional)..."
                rows={3}
                className="input-field text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <button onClick={submitDecision} disabled={saving} className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${decisionConfig[decisionModal].color}`}>
                  {saving ? <Loader className="h-4 w-4 animate-spin" /> : (() => { const DecIcon = decisionConfig[decisionModal].icon; return <DecIcon className="h-4 w-4" />; })()}
                  Confirm
                </button>
                <button onClick={() => setDecisionModal(null)} className="flex-1 btn-secondary py-2.5">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900 dark:text-white">Saved Sessions</p>
              <button onClick={() => setShowHistory(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {savedSessions.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center text-gray-400">No saved sessions yet</p>
              ) : savedSessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s)} className="w-full px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name || 'Unnamed session'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.songs_json.length} songs · {new Date(s.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
