import { useLayoutEffect, useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALargeSmall, ArrowDown, ArrowUp, Bold, Captions, ChevronLeft, ChevronRight, Copy, Edit3, GripVertical, Italic, Lock, Minus, Music2, Plus, Save, StickyNote, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ChordProLine, detectChordProKey, formatChordProForPlainEditor, getKeyTransposeOffset, parseChordPro, parseChordProMetadata, plainEditorToChordPro, transposeChordPro, transposeKey } from '../lib/chordPro';

const SECTION_TONES = [
  {
    match: /intro|instrumental|interlude/i,
    label: 'text-violet-700 dark:text-violet-300',
    chord: 'text-violet-700 dark:text-violet-300',
    lyric: 'text-slate-950 dark:!text-violet-50',
    badge: 'border-violet-200 bg-violet-100 text-violet-800 shadow-violet-500/10 dark:border-violet-400/25 dark:bg-violet-400/15 dark:text-violet-100 dark:shadow-violet-500/10',
    dot: 'bg-violet-500 dark:bg-violet-300',
  },
  {
    match: /verse\s*1|\bv1\b/i,
    label: 'text-sky-700 dark:text-sky-300',
    chord: 'text-sky-700 dark:text-sky-300',
    lyric: 'text-slate-950 dark:!text-sky-50',
    badge: 'border-sky-200 bg-sky-100 text-sky-800 shadow-sky-500/10 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-100 dark:shadow-sky-500/10',
    dot: 'bg-sky-500 dark:bg-sky-300',
  },
  {
    match: /verse\s*2|\bv2\b/i,
    label: 'text-amber-700 dark:text-amber-300',
    chord: 'text-amber-700 dark:text-amber-300',
    lyric: 'text-slate-950 dark:!text-amber-50',
    badge: 'border-amber-200 bg-amber-100 text-amber-900 shadow-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/15 dark:text-amber-100 dark:shadow-amber-500/10',
    dot: 'bg-amber-500 dark:bg-amber-300',
  },
  {
    match: /verse\s*3|\bv3\b/i,
    label: 'text-cyan-700 dark:text-cyan-300',
    chord: 'text-cyan-700 dark:text-cyan-300',
    lyric: 'text-slate-950 dark:!text-cyan-50',
    badge: 'border-cyan-200 bg-cyan-100 text-cyan-800 shadow-cyan-500/10 dark:border-cyan-400/25 dark:bg-cyan-400/15 dark:text-cyan-100 dark:shadow-cyan-500/10',
    dot: 'bg-cyan-500 dark:bg-cyan-300',
  },
  {
    match: /pre[-\s]?chorus|prechorus|\bpc\b/i,
    label: 'text-teal-700 dark:text-teal-300',
    chord: 'text-teal-700 dark:text-teal-300',
    lyric: 'text-slate-950 dark:!text-teal-50',
    badge: 'border-teal-200 bg-teal-100 text-teal-800 shadow-teal-500/10 dark:border-teal-400/25 dark:bg-teal-400/15 dark:text-teal-100 dark:shadow-teal-500/10',
    dot: 'bg-teal-500 dark:bg-teal-300',
  },
  {
    match: /chorus|refrain/i,
    label: 'text-emerald-700 dark:text-emerald-300',
    chord: 'text-emerald-700 dark:text-emerald-300',
    lyric: 'text-slate-950 dark:!text-emerald-50',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800 shadow-emerald-500/10 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-100 dark:shadow-emerald-500/10',
    dot: 'bg-emerald-500 dark:bg-emerald-300',
  },
  {
    match: /bridge|\bb\b/i,
    label: 'text-rose-700 dark:text-rose-300',
    chord: 'text-rose-700 dark:text-rose-300',
    lyric: 'text-slate-950 dark:!text-rose-50',
    badge: 'border-rose-200 bg-rose-100 text-rose-800 shadow-rose-500/10 dark:border-rose-400/25 dark:bg-rose-400/15 dark:text-rose-100 dark:shadow-rose-500/10',
    dot: 'bg-rose-500 dark:bg-rose-300',
  },
  {
    match: /ending|outro|tag/i,
    label: 'text-orange-700 dark:text-orange-300',
    chord: 'text-orange-700 dark:text-orange-300',
    lyric: 'text-slate-950 dark:!text-orange-50',
    badge: 'border-orange-200 bg-orange-100 text-orange-800 shadow-orange-500/10 dark:border-orange-400/25 dark:bg-orange-400/15 dark:text-orange-100 dark:shadow-orange-500/10',
    dot: 'bg-orange-500 dark:bg-orange-300',
  },
];

const DEFAULT_SECTION_TONE = {
  label: 'text-emerald-700 dark:text-emerald-300',
  chord: 'text-emerald-700 dark:text-emerald-300',
  lyric: 'text-slate-950 dark:!text-slate-100',
  badge: 'border-slate-200 bg-slate-100 text-slate-800 shadow-slate-500/10 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:shadow-black/10',
  dot: 'bg-slate-500 dark:bg-slate-300',
};

const CHART_SETTINGS_STORAGE_KEY = 'servesync:song-chart-display-settings';
const CHART_SETTINGS_VERSION = 2;
const CHART_FONT_SIZE_MIN = 8;
const CHART_FONT_SIZE_MAX = 36;
const SHARP_KEY_OPTIONS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

interface ChartDisplaySettings {
  settingsVersion: number;
  lyricFontSize: number;
  chordFontSize: number;
  sectionBadgeFontSize: number;
  lyricBold: boolean;
  lyricItalic: boolean;
  chordBold: boolean;
  chordItalic: boolean;
  lyricsOnly: boolean;
}

const DEFAULT_CHART_SETTINGS: ChartDisplaySettings = {
  settingsVersion: CHART_SETTINGS_VERSION,
  lyricFontSize: 12,
  chordFontSize: 12,
  sectionBadgeFontSize: 12,
  lyricBold: false,
  lyricItalic: false,
  chordBold: true,
  chordItalic: false,
  lyricsOnly: false,
};

function loadChartDisplaySettings(): ChartDisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_CHART_SETTINGS;

  try {
    const raw = window.localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ChartDisplaySettings>;
    const shouldUseNewDefaults = parsed.settingsVersion !== CHART_SETTINGS_VERSION;
    return {
      settingsVersion: CHART_SETTINGS_VERSION,
      lyricFontSize: shouldUseNewDefaults ? DEFAULT_CHART_SETTINGS.lyricFontSize : normalizeFontSize(parsed.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize),
      chordFontSize: shouldUseNewDefaults ? DEFAULT_CHART_SETTINGS.chordFontSize : normalizeFontSize(parsed.chordFontSize, DEFAULT_CHART_SETTINGS.chordFontSize),
      sectionBadgeFontSize: normalizeFontSize(parsed.sectionBadgeFontSize, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize),
      lyricBold: typeof parsed.lyricBold === 'boolean' ? parsed.lyricBold : DEFAULT_CHART_SETTINGS.lyricBold,
      lyricItalic: typeof parsed.lyricItalic === 'boolean' ? parsed.lyricItalic : DEFAULT_CHART_SETTINGS.lyricItalic,
      chordBold: typeof parsed.chordBold === 'boolean' ? parsed.chordBold : DEFAULT_CHART_SETTINGS.chordBold,
      chordItalic: typeof parsed.chordItalic === 'boolean' ? parsed.chordItalic : DEFAULT_CHART_SETTINGS.chordItalic,
      lyricsOnly: typeof parsed.lyricsOnly === 'boolean' ? parsed.lyricsOnly : DEFAULT_CHART_SETTINGS.lyricsOnly,
    };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}

function clampFontSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFontSize(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampFontSize(value, CHART_FONT_SIZE_MIN, CHART_FONT_SIZE_MAX)
    : fallback;
}

function stepFontSize(value: unknown, delta: number, fallback: number) {
  return normalizeFontSize(normalizeFontSize(value, fallback) + delta, fallback);
}

function getSectionTone(section?: string) {
  if (!section) return DEFAULT_SECTION_TONE;
  return SECTION_TONES.find(tone => tone.match.test(section)) || DEFAULT_SECTION_TONE;
}

interface SongChartViewerProps {
  songId?: string;
  title: string;
  artist?: string | null;
  songKey?: string | null;
  chordproText?: string | null;
  editable?: boolean;
  fullBleed?: boolean;
  saving?: boolean;
  hideTitleHeader?: boolean;
  controlsVisible?: boolean;
  onClose?: () => void;
  onSave?: (text: string) => Promise<void> | void;
  onEditingChange?: (isEditing: boolean) => void;
  footerNavigation?: {
    currentLabel: string;
    canGoPrevious: boolean;
    canGoNext: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
  };
}

type NoteScope = 'self' | 'team';

interface TeamSectionNote {
  id: string;
  section_key: string;
  section_label: string;
  note: string;
}

interface EditingSectionNote {
  sectionKey: string;
  sectionLabel: string;
  scope: NoteScope;
}

interface ChartSection {
  key: string;
  label: string;
  tone: ReturnType<typeof getSectionTone>;
  lines: ChordProLine[];
}

interface EditableChartSection {
  id: string;
  label: string;
  body: string;
}

function normalizeSectionKey(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'song';
}

function buildChartSections(lines: ChordProLine[]): ChartSection[] {
  const sections: ChartSection[] = [];
  const counts: Record<string, number> = {};
  let current: ChartSection | null = null;
  let pendingBlankCount = 0;

  const startSection = (label: string) => {
    const baseKey = normalizeSectionKey(label);
    counts[baseKey] = (counts[baseKey] || 0) + 1;
    current = {
      key: `${baseKey}-${counts[baseKey]}`,
      label,
      tone: getSectionTone(label),
      lines: [],
    };
    sections.push(current);
  };

  lines.forEach(line => {
    if (line.type === 'blank') {
      pendingBlankCount += 1;
      return;
    }

    if (line.type === 'section') {
      if (current && pendingBlankCount > 1) {
        Array.from({ length: pendingBlankCount - 1 }).forEach(() => current?.lines.push({ type: 'blank' }));
      }
      pendingBlankCount = 0;
      startSection(line.section || 'Section');
      return;
    }

    if (!current) startSection('Song');
    const activeSection = current;
    if (!activeSection) return;
    Array.from({ length: pendingBlankCount }).forEach(() => activeSection.lines.push({ type: 'blank' }));
    pendingBlankCount = 0;
    activeSection.lines.push(line);
  });

  return sections;
}

function chordLinesToPlain(lines: ChordProLine[]) {
  return lines.map(line => {
    if (line.type === 'blank') return '';
    if (line.type === 'section') return line.section || '';
    return [line.chords || '', line.lyrics || ''].filter(value => value.length > 0).join('\n');
  }).join('\n').trimEnd();
}

function createEditableSectionsFromChordPro(chordpro: string): EditableChartSection[] {
  return buildChartSections(parseChordPro(chordpro)).map((section, index) => ({
    id: `${section.key}-${index}`,
    label: section.label,
    body: chordLinesToPlain(section.lines),
  }));
}

function editableSectionsToPlainEditor(sections: EditableChartSection[]) {
  return sections
    .map(section => [section.label.trim() || 'Section', section.body.trimEnd()].filter(Boolean).join('\n'))
    .join('\n\n')
    .trimEnd();
}

function createEditableSection(label = 'Verse') {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label,
    body: '',
  };
}

function getSectionEditorHeight(text: string) {
  const lineCount = Math.max(5, text.split(/\r?\n/).length + 1);
  return `${lineCount * 28 + 28}px`;
}

interface AutoSizeSectionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function AutoSizeSectionTextarea({ value, onChange, placeholder }: AutoSizeSectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="service-mode-section-textarea w-full resize-none overflow-hidden rounded-[18px] border border-black/[0.06] bg-gray-50 p-3 font-mono text-sm leading-7 text-gray-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-black/20 dark:text-white/85"
      style={{ minHeight: getSectionEditorHeight('') }}
      placeholder={placeholder}
      spellCheck={false}
    />
  );
}

export function SongChartViewer({
  songId,
  title,
  artist,
  songKey,
  chordproText,
  editable = false,
  fullBleed = false,
  saving = false,
  hideTitleHeader = false,
  controlsVisible = true,
  onClose,
  onSave,
  onEditingChange,
  footerNavigation,
}: SongChartViewerProps) {
  const [transpose, setTranspose] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(formatChordProForPlainEditor(chordproText || ''));
  const [draftSections, setDraftSections] = useState<EditableChartSection[]>(() => createEditableSectionsFromChordPro(chordproText || ''));
  const [sectionEditorEnabled, setSectionEditorEnabled] = useState(() => createEditableSectionsFromChordPro(chordproText || '').length > 0);
  const [selfNotes, setSelfNotes] = useState<Record<string, string>>({});
  const [teamNotes, setTeamNotes] = useState<Record<string, TeamSectionNote>>({});
  const [editingNote, setEditingNote] = useState<EditingSectionNote | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [localChartSaving, setLocalChartSaving] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(() => loadChartDisplaySettings());
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const chartAnimationIdentity = `${songId ?? ''}:${chordproText}`;
  const previousChartAnimationIdentityRef = useRef(chartAnimationIdentity);
  const isSwitchingChartContent = previousChartAnimationIdentityRef.current !== chartAnimationIdentity;
  const savedPlainDraft = useMemo(() => formatChordProForPlainEditor(chordproText || ''), [chordproText]);
  const sectionDraft = useMemo(() => editableSectionsToPlainEditor(draftSections), [draftSections]);
  const activeDraft = sectionEditorEnabled ? sectionDraft : draft;
  const hasDraftChanges = activeDraft !== savedPlainDraft;
  const metadata = useMemo(() => parseChordProMetadata(chordproText || ''), [chordproText]);
  const detectedKey = useMemo(() => detectChordProKey(chordproText || '', metadata.key || ''), [chordproText, metadata.key]);
  const assignedTranspose = useMemo(() => getKeyTransposeOffset(detectedKey, songKey || ''), [detectedKey, songKey]);
  const lyricFontSize = normalizeFontSize(displaySettings.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize);
  const chordFontSize = normalizeFontSize(displaySettings.chordFontSize, DEFAULT_CHART_SETTINGS.chordFontSize);
  const sectionBadgeFontSize = normalizeFontSize(displaySettings.sectionBadgeFontSize, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize);

  useEffect(() => {
    const nextSections = createEditableSectionsFromChordPro(chordproText || '');
    setDraft(savedPlainDraft);
    setDraftSections(nextSections);
    setSectionEditorEnabled(nextSections.length > 0);
    setIsEditing(false);
    setTranspose(assignedTranspose);
  }, [assignedTranspose, chordproText, savedPlainDraft, title]);

  useEffect(() => {
    onEditingChange?.(isEditing);
    if (isEditing) setSettingsOpen(false);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify({
        ...displaySettings,
        settingsVersion: CHART_SETTINGS_VERSION,
        lyricFontSize,
        chordFontSize,
        sectionBadgeFontSize,
      }));
    } catch {
      // Display settings are a convenience; the chart should still work if storage is unavailable.
    }
  }, [chordFontSize, displaySettings, lyricFontSize, sectionBadgeFontSize]);

  const renderedText = useMemo(() => transposeChordPro(chordproText || '', transpose), [chordproText, transpose]);
  const chartLines = useMemo(() => parseChordPro(renderedText), [renderedText]);
  const chartSections = useMemo(() => buildChartSections(chartLines), [chartLines]);
  const displayKey = detectedKey ? transposeKey(detectedKey, transpose) : '';
  const keyOptions = useMemo(
    () => detectedKey.includes('b') ? FLAT_KEY_OPTIONS : SHARP_KEY_OPTIONS,
    [detectedKey]
  );
  const showControls = controlsVisible || isEditing;
  const showTopBar = !hideTitleHeader || showControls;
  const selfNotesStorageKey = songId ? `servesync:song-section-notes:${songId}` : '';

  useEffect(() => {
    if (!controlsVisible) {
      setSettingsOpen(false);
      setKeyPickerOpen(false);
    }
  }, [controlsVisible]);

  useEffect(() => {
    if (isEditing) setKeyPickerOpen(false);
  }, [isEditing]);

  useEffect(() => {
    previousChartAnimationIdentityRef.current = chartAnimationIdentity;
  }, [chartAnimationIdentity]);

  useEffect(() => {
    setEditingNote(null);
    setNoteDraft('');
    setNoteError(null);

    if (!selfNotesStorageKey) {
      setSelfNotes({});
      return;
    }

    try {
      const raw = localStorage.getItem(selfNotesStorageKey);
      setSelfNotes(raw ? JSON.parse(raw) : {});
    } catch {
      setSelfNotes({});
    }
  }, [selfNotesStorageKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamNotes() {
      if (!songId) {
        setTeamNotes({});
        return;
      }

      setNotesLoading(true);
      const { data, error } = await supabase
        .from('song_section_notes')
        .select('id, section_key, section_label, note')
        .eq('song_id', songId)
        .eq('scope', 'team');

      if (cancelled) return;

      if (error) {
        console.error('Failed to load song section notes', error);
        setNoteError('Could not load team notes yet.');
        setTeamNotes({});
      } else {
        const nextNotes = (data || []).reduce<Record<string, TeamSectionNote>>((acc, note) => {
          acc[note.section_key] = note as TeamSectionNote;
          return acc;
        }, {});
        setTeamNotes(nextNotes);
      }

      setNotesLoading(false);
    }

    loadTeamNotes();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const persistSelfNotes = (nextNotes: Record<string, string>) => {
    setSelfNotes(nextNotes);
    if (!selfNotesStorageKey) return;
    localStorage.setItem(selfNotesStorageKey, JSON.stringify(nextNotes));
  };

  const openSectionNote = (sectionKey: string, sectionLabel: string, scope: NoteScope) => {
    setNoteError(null);
    setEditingNote({ sectionKey, sectionLabel, scope });
    setNoteDraft(scope === 'self' ? (selfNotes[sectionKey] || '') : (teamNotes[sectionKey]?.note || ''));
  };

  const saveSectionNote = async () => {
    if (!editingNote || !songId) return;

    const note = noteDraft.trim();
    setNotesSaving(true);
    setNoteError(null);

    if (editingNote.scope === 'self') {
      const nextNotes = { ...selfNotes };
      if (note) nextNotes[editingNote.sectionKey] = note;
      else delete nextNotes[editingNote.sectionKey];
      persistSelfNotes(nextNotes);
      setEditingNote(null);
      setNoteDraft('');
      setNotesSaving(false);
      return;
    }

    if (!note) {
      const { error } = await supabase
        .from('song_section_notes')
        .delete()
        .eq('song_id', songId)
        .eq('section_key', editingNote.sectionKey)
        .eq('scope', 'team');

      if (error) {
        console.error('Failed to delete song section note', error);
        setNoteError('Could not delete the team note.');
      } else {
        setTeamNotes(prev => {
          const nextNotes = { ...prev };
          delete nextNotes[editingNote.sectionKey];
          return nextNotes;
        });
        setEditingNote(null);
        setNoteDraft('');
      }
      setNotesSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('song_section_notes')
      .upsert(
        {
          song_id: songId,
          section_key: editingNote.sectionKey,
          section_label: editingNote.sectionLabel,
          scope: 'team',
          note,
        },
        { onConflict: 'song_id,section_key,scope' }
      )
      .select('id, section_key, section_label, note')
      .single();

    if (error) {
      console.error('Failed to save song section note', error);
      setNoteError('Could not save the team note.');
    } else if (data) {
      setTeamNotes(prev => ({ ...prev, [editingNote.sectionKey]: data as TeamSectionNote }));
      setEditingNote(null);
      setNoteDraft('');
    }

    setNotesSaving(false);
  };

  const handleSaveChartDraft = async () => {
    if (!onSave || localChartSaving || !hasDraftChanges) return;
    setLocalChartSaving(true);
    try {
      await onSave(plainEditorToChordPro(activeDraft, chordproText || ''));
    } finally {
      setLocalChartSaving(false);
    }
  };

  const updateDraftSection = (id: string, updates: Partial<EditableChartSection>) => {
    setDraftSections(sections => sections.map(section => section.id === id ? { ...section, ...updates } : section));
  };

  const moveDraftSection = (fromIndex: number, toIndex: number) => {
    setDraftSections(sections => {
      if (toIndex < 0 || toIndex >= sections.length || fromIndex === toIndex) return sections;
      const nextSections = [...sections];
      const [movedSection] = nextSections.splice(fromIndex, 1);
      nextSections.splice(toIndex, 0, movedSection);
      return nextSections;
    });
  };

  const duplicateDraftSection = (index: number) => {
    setDraftSections(sections => {
      const section = sections[index];
      if (!section) return sections;
      const duplicate = { ...section, id: createEditableSection().id, label: `${section.label} Copy` };
      const nextSections = [...sections];
      nextSections.splice(index + 1, 0, duplicate);
      return nextSections;
    });
  };

  const deleteDraftSection = (id: string) => {
    setDraftSections(sections => sections.filter(section => section.id !== id));
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-white text-gray-950 dark:bg-[#111412] dark:text-white ${
        fullBleed
          ? 'service-mode-chart-viewer min-h-0 rounded-none shadow-none ring-0'
          : 'min-h-[70vh] rounded-[28px] shadow-2xl ring-1 ring-black/10 dark:ring-white/10'
      }`}
    >
      {showTopBar && (
        <div className={`shrink-0 border-b border-black/[0.06] bg-gradient-to-r from-emerald-50 via-white to-white px-5 dark:border-white/[0.08] dark:from-emerald-500/10 dark:via-white/[0.03] dark:to-transparent ${hideTitleHeader ? 'py-3' : 'py-4'}`}>
          {!hideTitleHeader && (
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <Music2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">Song Chart</p>
                <h2 className="truncate text-2xl font-black tracking-[-0.04em]">{metadata.title || title}</h2>
                <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-white/45">{metadata.artist || artist || 'No artist'}{displayKey ? ` · Key ${displayKey}` : ''}</p>
              </div>
              {onClose && (
                <button onClick={onClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

        <AnimatePresence initial={false}>
          {showControls && (
            <motion.div
              className={`flex flex-wrap items-center gap-2 overflow-visible py-1 ${hideTitleHeader ? '-my-1' : 'mt-3 -mb-1'}`}
              initial={{ height: 0, opacity: 0, y: -10, filter: 'blur(8px)' }}
              animate={{ height: 'auto', opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, y: -8, filter: 'blur(8px)' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
            {!isEditing && (
              <>
              <button
                type="button"
                onClick={() => {
                  if (!detectedKey) return;
                  setKeyPickerOpen(value => !value);
                  setSettingsOpen(false);
                }}
                disabled={!detectedKey}
                aria-expanded={keyPickerOpen}
                className={`inline-flex h-10 min-w-[102px] items-center justify-center rounded-full border-2 px-4 text-sm font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                  keyPickerOpen
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                {displayKey ? `Key ${displayKey}` : 'Key --'}
              </button>
              <button
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setSettingsOpen(value => !value);
                  setKeyPickerOpen(false);
                }}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-black transition active:scale-[0.97] ${
                  settingsOpen
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'border-black/[0.08] bg-white/90 text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70'
                }`}
              >
                <ALargeSmall className="h-3.5 w-3.5" />
                <span>Font</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplaySettings(settings => ({ ...settings, lyricsOnly: !settings.lyricsOnly }))}
                aria-pressed={displaySettings.lyricsOnly}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-black transition active:scale-[0.97] ${
                  displaySettings.lyricsOnly
                    ? 'border-sky-500 bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'border-black/[0.08] bg-white/90 text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70'
                }`}
              >
                <Captions className="h-3.5 w-3.5" />
                <span>Lyrics</span>
              </button>
            </>
          )}
          {editable && (
            <button
              onClick={() => {
                if (!isEditing) {
                  const nextSections = createEditableSectionsFromChordPro(chordproText || '');
                  setDraft(formatChordProForPlainEditor(chordproText || ''));
                  setDraftSections(nextSections);
                  setSectionEditorEnabled(nextSections.length > 0);
                }
                setIsEditing(v => !v);
              }}
              className={`ml-auto inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-black transition active:scale-[0.97] ${
                isEditing
                  ? 'border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-900/15 dark:border-white/[0.10] dark:bg-white/[0.12] dark:text-white'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span className="sm:hidden">{isEditing ? 'Preview' : 'Edit'}</span>
              <span className="hidden sm:inline">{isEditing ? 'Preview' : 'Edit chart'}</span>
            </button>
          )}
          {editable && isEditing && onSave && (
            <button
              onClick={handleSaveChartDraft}
              disabled={saving || localChartSaving || !hasDraftChanges}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${
                hasDraftChanges
                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60'
                  : 'border-gray-200 bg-gray-100 text-gray-400 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/35'
              }`}
            >
              <Save className="h-3.5 w-3.5" /> {saving || localChartSaving ? 'Saving...' : 'Save'}
            </button>
          )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showControls && keyPickerOpen && !isEditing && (
            <motion.div
              className="mt-3 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/90 shadow-sm shadow-emerald-500/10 backdrop-blur-xl dark:border-emerald-500/20 dark:bg-emerald-500/10"
              initial={{ height: 0, opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ height: 'auto', opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-6">
                {keyOptions.map(keyOption => {
                  const selected = keyOption === displayKey;
                  return (
                    <button
                      key={keyOption}
                      type="button"
                      onClick={() => {
                        setTranspose(getKeyTransposeOffset(detectedKey, keyOption));
                        setKeyPickerOpen(false);
                      }}
                      className={`h-10 rounded-2xl text-sm font-black transition active:scale-[0.96] ${
                        selected
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-white/80 text-emerald-800 ring-1 ring-emerald-200/80 hover:bg-white dark:bg-white/[0.06] dark:text-emerald-100 dark:ring-emerald-400/15 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {keyOption}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showControls && settingsOpen && (
            <motion.div
              className="mt-3 overflow-hidden rounded-3xl border border-black/[0.06] bg-white/85 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-black/20"
              initial={{ height: 0, opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ height: 'auto', opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid gap-2 p-2 sm:grid-cols-3">
                <div className="grid gap-1.5 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-2 shadow-sm shadow-sky-500/5 dark:border-sky-400/20 dark:bg-sky-500/10 dark:shadow-sky-950/10">
                  <span className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-sky-900 dark:text-sky-100">
                    Lyrics <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-300/10 dark:text-sky-100 dark:ring-sky-300/20">{lyricFontSize}px</span>
                  </span>
                  <div className="grid grid-cols-[1.3fr_0.85fr_0.85fr] gap-1.5">
                    <div className="grid grid-cols-[28px_1fr_28px] items-center gap-1 rounded-full border border-black/[0.06] bg-white/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                      <button
                        type="button"
                        aria-label="Decrease lyrics font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: stepFontSize(settings.lyricFontSize, -1, DEFAULT_CHART_SETTINGS.lyricFontSize) }))}
                        className="flex h-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                        disabled={lyricFontSize <= CHART_FONT_SIZE_MIN}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                        {lyricFontSize}
                      </div>
                      <button
                        type="button"
                        aria-label="Increase lyrics font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: stepFontSize(settings.lyricFontSize, 1, DEFAULT_CHART_SETTINGS.lyricFontSize) }))}
                        className="flex h-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                        disabled={lyricFontSize >= CHART_FONT_SIZE_MAX}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, lyricBold: !settings.lyricBold }))}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full text-[11px] font-black transition active:scale-[0.97] ${
                        displaySettings.lyricBold
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-white/60'
                      }`}
                    >
                      <Bold className="h-3 w-3" />
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, lyricItalic: !settings.lyricItalic }))}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full text-[11px] font-black transition active:scale-[0.97] ${
                        displaySettings.lyricItalic
                          ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-white/60'
                      }`}
                    >
                      <Italic className="h-3 w-3" />
                      Italic
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5 rounded-2xl border border-violet-200/80 bg-violet-50/70 p-2 shadow-sm shadow-violet-500/5 dark:border-violet-400/20 dark:bg-violet-500/10 dark:shadow-violet-950/10">
                  <span className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-violet-900 dark:text-violet-100">
                    Badge <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-300/10 dark:text-violet-100 dark:ring-violet-300/20">{sectionBadgeFontSize}px</span>
                  </span>
                  <div className="grid grid-cols-[38px_1fr_38px] items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <button
                      type="button"
                      aria-label="Decrease section badge font size"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, sectionBadgeFontSize: stepFontSize(settings.sectionBadgeFontSize, -1, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize) }))}
                      className="flex h-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                      disabled={sectionBadgeFontSize <= CHART_FONT_SIZE_MIN}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                      {sectionBadgeFontSize}
                    </div>
                    <button
                      type="button"
                      aria-label="Increase section badge font size"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, sectionBadgeFontSize: stepFontSize(settings.sectionBadgeFontSize, 1, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize) }))}
                      className="flex h-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                      disabled={sectionBadgeFontSize >= CHART_FONT_SIZE_MAX}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 font-black uppercase tracking-[0.14em] shadow-sm ${DEFAULT_SECTION_TONE.badge}`} style={{ fontSize: `${sectionBadgeFontSize}px`, lineHeight: 1.15 }}>
                    <span className={`h-2 w-2 rounded-full ${DEFAULT_SECTION_TONE.dot}`} />
                    Section
                  </div>
                </div>
                <div className="grid gap-1.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-2 shadow-sm shadow-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:shadow-emerald-950/10">
                  <span className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-emerald-900 dark:text-emerald-100">
                    Chords <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20">{displaySettings.lyricsOnly ? 'Hidden' : `${chordFontSize}px`}</span>
                  </span>
                  <div className="grid grid-cols-[1.3fr_0.85fr_0.85fr] gap-1.5">
                    <div className={`grid grid-cols-[28px_1fr_28px] items-center gap-1 rounded-full border border-black/[0.06] bg-white/80 p-0.5 transition dark:border-white/[0.08] dark:bg-white/[0.04] ${displaySettings.lyricsOnly ? 'opacity-45 saturate-0' : ''}`}>
                      <button
                        type="button"
                        aria-label="Decrease chords font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, chordFontSize: stepFontSize(settings.chordFontSize, -1, DEFAULT_CHART_SETTINGS.chordFontSize) }))}
                        className="flex h-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                        disabled={displaySettings.lyricsOnly || chordFontSize <= CHART_FONT_SIZE_MIN}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                        {chordFontSize}
                      </div>
                      <button
                        type="button"
                        aria-label="Increase chords font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, chordFontSize: stepFontSize(settings.chordFontSize, 1, DEFAULT_CHART_SETTINGS.chordFontSize) }))}
                        className="flex h-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                        disabled={displaySettings.lyricsOnly || chordFontSize >= CHART_FONT_SIZE_MAX}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, chordBold: !settings.chordBold }))}
                      disabled={displaySettings.lyricsOnly}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full text-[11px] font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${
                        displaySettings.chordBold
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-white/60'
                      }`}
                    >
                      <Bold className="h-3 w-3" />
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, chordItalic: !settings.chordItalic }))}
                      disabled={displaySettings.lyricsOnly}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-full text-[11px] font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${
                        displaySettings.chordItalic
                          ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-white/60'
                      }`}
                    >
                      <Italic className="h-3 w-3" />
                      Italic
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}

      {isEditing && sectionEditorEnabled ? (
        <div className={`min-h-0 flex-1 overflow-y-auto bg-gray-50/70 dark:bg-black/20 ${fullBleed ? 'service-mode-edit-scroll px-4 pt-5 sm:px-8 sm:pt-7' : 'px-5 py-5'}`}>
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-black/[0.06] bg-white/85 p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Arrange sections</p>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-white/45">Edit, duplicate, delete, or drag cards into the order you want.</p>
              </div>
              <button
                type="button"
                onClick={() => setDraftSections(sections => [...sections, createEditableSection('New Section')])}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-black text-white shadow-lg shadow-emerald-600/20 transition active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" /> Section
              </button>
            </div>

            {draftSections.map((section, index) => (
              <div
                key={section.id}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (draggedSectionIndex !== null) moveDraftSection(draggedSectionIndex, index);
                  setDraggedSectionIndex(null);
                }}
                onDragEnd={() => setDraggedSectionIndex(null)}
                className={`rounded-[24px] border bg-white p-3 shadow-sm transition dark:bg-[#141815] ${
                  draggedSectionIndex === index
                    ? 'border-emerald-300 opacity-70 shadow-emerald-500/15 dark:border-emerald-400/40'
                    : 'border-black/[0.06] dark:border-white/[0.08]'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDraggedSectionIndex(index)}
                    onDragEnd={() => setDraggedSectionIndex(null)}
                    className="flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-gray-100 text-gray-400 active:cursor-grabbing dark:bg-white/[0.06] dark:text-white/40"
                    aria-label={`Drag ${section.label}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <input
                    value={section.label}
                    onChange={event => updateDraftSection(section.id, { label: event.target.value })}
                    className="h-9 min-w-0 flex-1 rounded-full border border-black/[0.06] bg-gray-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-gray-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                    placeholder="Section name"
                  />
                  <button
                    type="button"
                    onClick={() => moveDraftSection(index, index - 1)}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition active:scale-[0.96] disabled:opacity-35 dark:bg-white/[0.06] dark:text-white/50"
                    aria-label="Move section up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraftSection(index, index + 1)}
                    disabled={index === draftSections.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition active:scale-[0.96] disabled:opacity-35 dark:bg-white/[0.06] dark:text-white/50"
                    aria-label="Move section down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateDraftSection(index)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] dark:bg-emerald-500/10 dark:text-emerald-300"
                    aria-label="Duplicate section"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDraftSection(section.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 transition active:scale-[0.96] dark:bg-red-500/10 dark:text-red-300"
                    aria-label="Delete section"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <AutoSizeSectionTextarea
                  value={section.body}
                  onChange={value => updateDraftSection(section.id, { body: value })}
                  placeholder={`G                 Em7\nThe splendor of a King, clothed in majesty,`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : isEditing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="min-h-0 flex-1 resize-none bg-gray-50 p-5 font-mono text-sm leading-7 outline-none dark:bg-black/20 dark:text-white/85"
          placeholder={`Verse 1\nG                 Em7\nThe splendor of a King, clothed in majesty,\n\nChorus\nG\nHow great is our God, sing with me,`}
          spellCheck={false}
        />
      ) : chartLines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div>
            <p className="text-lg font-bold">No chart saved yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/40">Import a SongBook Pro .cho file or paste a ChordPro chart to start.</p>
            {editable && (
              <button
                onClick={() => {
                  setDraft('');
                  setIsEditing(true);
                }}
                className="mt-4 inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-sm font-bold text-white transition active:scale-[0.97]"
              >
                Paste chart
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? 'service-mode-chart-scroll px-5 pt-6 sm:px-10 sm:pt-8' : 'px-5 py-5'}`}>
          <div className="mx-auto max-w-3xl space-y-4">
            {noteError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                {noteError}
              </div>
            )}
            {notesLoading && songId && (
              <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-500 dark:bg-white/[0.06] dark:text-white/45">
                Loading notes...
              </div>
            )}
            {chartSections.map(section => {
              const selfNote = selfNotes[section.key];
              const teamNote = teamNotes[section.key]?.note;
              const isEditingSelf = editingNote?.sectionKey === section.key && editingNote.scope === 'self';
              const isEditingTeam = editingNote?.sectionKey === section.key && editingNote.scope === 'team';

              return (
                <section key={section.key} className="rounded-[24px] border border-black/[0.05] bg-white/75 p-4 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.035]">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div
                      className={`mr-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-black uppercase tracking-[0.18em] shadow-sm ${section.tone.badge}`}
                      style={{ fontSize: `${sectionBadgeFontSize}px`, lineHeight: 1.15 }}
                    >
                      <span className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.55)] dark:shadow-[0_0_0_4px_rgba(255,255,255,0.08)] ${section.tone.dot}`} />
                      <span>{section.label}</span>
                    </div>
                    {songId && (
                      <>
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'self')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/75 px-2.5 text-[11px] font-bold text-gray-600 transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/60"
                        >
                          <Lock className="h-3.5 w-3.5" /> {selfNote ? 'Self note' : 'Self'}
                        </button>
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'team')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200 transition active:scale-[0.97] dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
                        >
                          {teamNote ? <StickyNote className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {teamNote ? 'Team note' : 'Team'}
                        </button>
                      </>
                    )}
                  </div>

                  {(selfNote || teamNote || isEditingSelf || isEditingTeam) && (
                    <div className="mb-4 grid gap-2">
                      {selfNote && !isEditingSelf && (
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'self')}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-semibold leading-relaxed text-sky-900 transition hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"
                        >
                          <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300"><Lock className="h-3 w-3" /> Private note</span>
                          <span className="block whitespace-pre-wrap">{selfNote}</span>
                        </button>
                      )}
                      {teamNote && !isEditingTeam && (
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'team')}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold leading-relaxed text-emerald-950 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-50"
                        >
                          <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300"><Users className="h-3 w-3" /> Team note</span>
                          <span className="block whitespace-pre-wrap">{teamNote}</span>
                        </button>
                      )}
                      {(isEditingSelf || isEditingTeam) && (
                        <div className="rounded-2xl border border-black/[0.06] bg-gray-50 p-3 dark:border-white/[0.08] dark:bg-black/20">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">
                              {editingNote.scope === 'self' ? 'Private section note' : 'Team section note'}
                            </p>
                            <button
                              onClick={() => setNoteDraft('')}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Clear
                            </button>
                          </div>
                          <textarea
                            value={noteDraft}
                            onChange={event => setNoteDraft(event.target.value)}
                            className="min-h-24 w-full resize-none rounded-2xl border border-black/[0.08] bg-white px-3 py-2 text-sm font-semibold leading-relaxed text-gray-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                            placeholder={`Add a note for ${section.label.toLowerCase()}...`}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => setEditingNote(null)} className="h-9 rounded-full px-3 text-xs font-bold text-gray-500 hover:bg-black/[0.04] dark:text-white/50 dark:hover:bg-white/[0.06]">
                              Cancel
                            </button>
                            <button onClick={saveSectionNote} disabled={notesSaving} className="h-9 rounded-full bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-60">
                              {notesSaving ? 'Saving...' : noteDraft.trim() ? 'Save note' : 'Delete note'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 font-mono">
                    {section.lines.map((line, index) => {
                      if (line.type === 'blank') return <div key={index} className="h-4" />;
                      const hasChords = Boolean(line.chords?.trim());
                      const hasLyrics = Boolean(line.lyrics?.trim());
                      return (
                        <div key={index} className="min-w-0 whitespace-pre-wrap break-words">
                          <AnimatePresence initial={false}>
                            {hasChords && !displaySettings.lyricsOnly && (
                              <motion.div
                                key="chords"
                                className={section.tone.chord}
                                initial={false}
                                animate={{ opacity: 1, y: 0, scaleY: 1, filter: 'blur(0px)', height: 'auto' }}
                                exit={
                                  isSwitchingChartContent
                                    ? { opacity: 1, y: 0, scaleY: 1, height: 'auto', filter: 'blur(0px)', transition: { duration: 0 } }
                                    : {
                                        opacity: 0,
                                        y: -14,
                                        scaleY: 0.18,
                                        height: 0,
                                        filter: 'blur(14px)',
                                        textShadow: '0 18px 32px rgba(16,185,129,0.55)',
                                      }
                                }
                                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                style={{
                                  overflow: 'hidden',
                                  fontSize: `${chordFontSize}px`,
                                  fontWeight: displaySettings.chordBold ? 900 : 400,
                                  fontStyle: displaySettings.chordItalic ? 'italic' : 'normal',
                                  lineHeight: 1.55,
                                  transformOrigin: 'left top',
                                  WebkitTextStroke: displaySettings.chordBold ? '0.35px currentColor' : '0px transparent',
                                  textShadow: displaySettings.chordBold ? '0 0 0.01px currentColor' : 'none',
                                }}
                              >
                                {line.chords || ' '}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {hasLyrics && (
                            <div
                              className={section.tone.lyric}
                              style={{
                                fontSize: `${lyricFontSize}px`,
                                fontWeight: displaySettings.lyricBold ? 800 : 400,
                                fontStyle: displaySettings.lyricItalic ? 'italic' : 'normal',
                                lineHeight: 1.6,
                              }}
                            >
                              {line.lyrics}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {footerNavigation && (
              <div
                className="service-mode-chart-footer rounded-[24px] border border-black/[0.06] bg-white/85 p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.045]"
                onPointerDown={event => event.stopPropagation()}
              >
                <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">
                  {footerNavigation.currentLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={footerNavigation.onPrevious}
                    disabled={!footerNavigation.canGoPrevious}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-gray-100 px-4 text-sm font-black text-gray-700 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100 dark:border-white/[0.08] dark:bg-white/[0.08] dark:text-white/70 dark:disabled:bg-white/[0.07] dark:disabled:text-white/35"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={footerNavigation.onNext}
                    disabled={!footerNavigation.canGoNext}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:active:scale-100 dark:disabled:bg-white/[0.07] dark:disabled:text-white/30"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
