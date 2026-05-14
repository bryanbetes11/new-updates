import { useLayoutEffect, useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Copy, Edit3, GripVertical, Lock, Minus, Music2, Plus, Save, SlidersHorizontal, StickyNote, Trash2, Users, X } from 'lucide-react';
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

interface ChartDisplaySettings {
  lyricFontSize: number;
  chordFontSize: number;
  chordBold: boolean;
}

const DEFAULT_CHART_SETTINGS: ChartDisplaySettings = {
  lyricFontSize: 15,
  chordFontSize: 15,
  chordBold: true,
};

function loadChartDisplaySettings(): ChartDisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_CHART_SETTINGS;

  try {
    const raw = window.localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ChartDisplaySettings>;
    return {
      lyricFontSize: typeof parsed.lyricFontSize === 'number' ? parsed.lyricFontSize : DEFAULT_CHART_SETTINGS.lyricFontSize,
      chordFontSize: typeof parsed.chordFontSize === 'number' ? parsed.chordFontSize : DEFAULT_CHART_SETTINGS.chordFontSize,
      chordBold: typeof parsed.chordBold === 'boolean' ? parsed.chordBold : DEFAULT_CHART_SETTINGS.chordBold,
    };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}

function clampFontSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  onClose?: () => void;
  onSave?: (text: string) => Promise<void> | void;
  onEditingChange?: (isEditing: boolean) => void;
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
    Array.from({ length: pendingBlankCount }).forEach(() => current?.lines.push({ type: 'blank' }));
    pendingBlankCount = 0;
    current.lines.push(line);
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
      className="w-full resize-none overflow-hidden rounded-[18px] border border-black/[0.06] bg-gray-50 p-3 font-mono text-sm leading-7 text-gray-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-black/20 dark:text-white/85"
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
  onClose,
  onSave,
  onEditingChange,
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
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(() => loadChartDisplaySettings());
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const savedPlainDraft = useMemo(() => formatChordProForPlainEditor(chordproText || ''), [chordproText]);
  const sectionDraft = useMemo(() => editableSectionsToPlainEditor(draftSections), [draftSections]);
  const activeDraft = sectionEditorEnabled ? sectionDraft : draft;
  const hasDraftChanges = activeDraft !== savedPlainDraft;
  const metadata = useMemo(() => parseChordProMetadata(chordproText || ''), [chordproText]);
  const detectedKey = useMemo(() => detectChordProKey(chordproText || '', metadata.key || ''), [chordproText, metadata.key]);
  const assignedTranspose = useMemo(() => getKeyTransposeOffset(detectedKey, songKey || ''), [detectedKey, songKey]);

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
      window.localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(displaySettings));
    } catch {
      // Display settings are a convenience; the chart should still work if storage is unavailable.
    }
  }, [displaySettings]);

  const renderedText = useMemo(() => transposeChordPro(chordproText || '', transpose), [chordproText, transpose]);
  const chartLines = useMemo(() => parseChordPro(renderedText), [renderedText]);
  const chartSections = useMemo(() => buildChartSections(chartLines), [chartLines]);
  const displayKey = detectedKey ? transposeKey(detectedKey, transpose) : '';
  const selfNotesStorageKey = songId ? `servesync:song-section-notes:${songId}` : '';

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
          ? 'min-h-0 rounded-none shadow-none ring-0'
          : 'min-h-[70vh] rounded-[28px] shadow-2xl ring-1 ring-black/10 dark:ring-white/10'
      }`}
    >
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

        <div className={`flex flex-wrap items-center gap-2 ${hideTitleHeader ? '' : 'mt-4'}`}>
          {!isEditing && (
            <>
              <button aria-label="Key down" onClick={() => setTranspose(v => v - 1)} className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3 text-xs font-bold text-gray-700 transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70">
                <ArrowDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Key down</span>
              </button>
              <span className="inline-flex h-9 min-w-[78px] items-center justify-center rounded-full bg-emerald-50 px-3 text-xs font-black text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
                {displayKey ? `Key ${displayKey}` : 'Key --'}
              </span>
              <button aria-label="Key up" onClick={() => setTranspose(v => v + 1)} className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3 text-xs font-bold text-gray-700 transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70">
                <ArrowUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Key up</span>
              </button>
              <button
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(value => !value)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3 text-xs font-bold text-gray-700 transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Display</span>
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
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-100 px-3 text-xs font-bold text-gray-700 transition active:scale-[0.97] dark:bg-white/[0.08] dark:text-white/75"
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
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition active:scale-[0.97] disabled:cursor-not-allowed ${
                hasDraftChanges
                  ? 'bg-emerald-600 text-white disabled:opacity-60'
                  : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-white/35'
              }`}
            >
              <Save className="h-3.5 w-3.5" /> {saving || localChartSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>

        {settingsOpen && (
          <div className="mt-3 grid gap-3 rounded-3xl border border-black/[0.06] bg-white/85 p-3 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-black/20 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-white/45">
                Lyrics <span className="font-mono text-emerald-700 dark:text-emerald-300">{displaySettings.lyricFontSize}px</span>
              </span>
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <button
                  type="button"
                  aria-label="Decrease lyrics font size"
                  onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: clampFontSize(settings.lyricFontSize - 1, 12, 24) }))}
                  className="flex h-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                  disabled={displaySettings.lyricFontSize <= 12}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                  {displaySettings.lyricFontSize}
                </div>
                <button
                  type="button"
                  aria-label="Increase lyrics font size"
                  onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: clampFontSize(settings.lyricFontSize + 1, 12, 24) }))}
                  className="flex h-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                  disabled={displaySettings.lyricFontSize >= 24}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-white/45">
                Chords <span className="font-mono text-emerald-700 dark:text-emerald-300">{displaySettings.chordFontSize}px</span>
              </span>
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <button
                  type="button"
                  aria-label="Decrease chords font size"
                  onClick={() => setDisplaySettings(settings => ({ ...settings, chordFontSize: clampFontSize(settings.chordFontSize - 1, 12, 26) }))}
                  className="flex h-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                  disabled={displaySettings.chordFontSize <= 12}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                  {displaySettings.chordFontSize}
                </div>
                <button
                  type="button"
                  aria-label="Increase chords font size"
                  onClick={() => setDisplaySettings(settings => ({ ...settings, chordFontSize: clampFontSize(settings.chordFontSize + 1, 12, 26) }))}
                  className="flex h-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                  disabled={displaySettings.chordFontSize >= 26}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDisplaySettings(settings => ({ ...settings, chordBold: !settings.chordBold }))}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-black transition active:scale-[0.97] ${
                displaySettings.chordBold
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-white/60'
              }`}
            >
              <Bold className="h-3.5 w-3.5" />
              Bold {displaySettings.chordBold ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </div>

      {isEditing && sectionEditorEnabled ? (
        <div className={`min-h-0 flex-1 overflow-y-auto bg-gray-50/70 dark:bg-black/20 ${fullBleed ? 'px-4 py-5 sm:px-8 sm:py-7' : 'px-5 py-5'}`}>
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
        <div className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? 'px-5 pt-6 sm:px-10 sm:pt-8' : 'px-5 py-5'}`}>
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
                    <div className={`mr-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-sm ${section.tone.badge}`}>
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
                      const hasLyrics = Boolean(line.lyrics?.trim());
                      return (
                        <div key={index} className="min-w-0 whitespace-pre-wrap break-words">
                          {line.chords && (
                            <div
                              className={section.tone.chord}
                              style={{
                                fontSize: `${displaySettings.chordFontSize}px`,
                                fontWeight: displaySettings.chordBold ? 900 : 400,
                                lineHeight: 1.55,
                                WebkitTextStroke: displaySettings.chordBold ? '0.35px currentColor' : '0px transparent',
                                textShadow: displaySettings.chordBold ? '0 0 0.01px currentColor' : 'none',
                              }}
                            >
                              {line.chords || ' '}
                            </div>
                          )}
                          {hasLyrics && (
                            <div
                              className={section.tone.lyric}
                              style={{
                                fontSize: `${displaySettings.lyricFontSize}px`,
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
          </div>
        </div>
      )}
    </div>
  );
}
