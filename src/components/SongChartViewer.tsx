import { ChartNavigation } from './ChartNavigation';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Bold, Captions, Check, ChevronLeft, Copy, Edit3, FileText, Gauge, Italic, ListOrdered, Lock, Minus, Music2, Pause, Play, Plus, RotateCcw, Save, Settings2, StickyNote, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRecoverableDraft } from '../hooks/useRecoverableDraft';
import { draftRecoveryKey } from '../lib/draftRecovery';
import { useChartTextGestures } from '../hooks/useChartTextGestures';
import { ChartLineNote } from './ChartLineNote';
import { ChartNoteTrigger } from './ChartNoteTrigger';
import { usePrivateSongNotes } from '../hooks/usePrivateSongNotes';
import { AlignedChartLine } from './AlignedChartLine';
import { useAuth } from '../contexts/AuthContext';
import { loadSyncedPreference, saveSyncedPreference } from '../lib/syncedPreferences';
import { ChordProLine, detectChordProKey, formatChordProForPlainEditor, getKeyTransposeOffset, parseChordPro, parseChordProMetadata, plainEditorSectionsToChordPro, plainEditorToChordPro, transposeChordPro, transposeKey } from '../lib/chordPro';

const SECTION_TONES = [
  {
    match: /intro|instrumental|interlude/i,
    label: 'text-violet-700 dark:text-violet-300',
    chord: 'text-violet-700 dark:text-violet-300',
    lyric: 'text-slate-950 dark:!text-violet-50',
    badge: 'border-violet-200 bg-violet-100 text-violet-800 shadow-violet-500/10 dark:border-violet-400/25 dark:bg-violet-400/15 dark:text-violet-100 dark:shadow-violet-500/10',
    highlight: 'bg-violet-200 text-violet-950 dark:bg-violet-200 dark:text-violet-950',
    dot: 'bg-violet-500 dark:bg-violet-300',
  },
  {
    match: /verse\s*1|\bv1\b/i,
    label: 'text-sky-700 dark:text-sky-300',
    chord: 'text-sky-700 dark:text-sky-300',
    lyric: 'text-slate-950 dark:!text-sky-50',
    badge: 'border-sky-200 bg-sky-100 text-sky-800 shadow-sky-500/10 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-100 dark:shadow-sky-500/10',
    highlight: 'bg-blue-200 text-blue-950 dark:bg-blue-200 dark:text-blue-950',
    dot: 'bg-sky-500 dark:bg-sky-300',
  },
  {
    match: /verse\s*2|\bv2\b/i,
    label: 'text-amber-700 dark:text-amber-300',
    chord: 'text-amber-700 dark:text-amber-300',
    lyric: 'text-slate-950 dark:!text-amber-50',
    badge: 'border-amber-200 bg-amber-100 text-amber-900 shadow-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/15 dark:text-amber-100 dark:shadow-amber-500/10',
    highlight: 'bg-indigo-200 text-indigo-950 dark:bg-indigo-200 dark:text-indigo-950',
    dot: 'bg-amber-500 dark:bg-amber-300',
  },
  {
    match: /verse\s*3|\bv3\b/i,
    label: 'text-cyan-700 dark:text-cyan-300',
    chord: 'text-cyan-700 dark:text-cyan-300',
    lyric: 'text-slate-950 dark:!text-cyan-50',
    badge: 'border-cyan-200 bg-cyan-100 text-cyan-800 shadow-cyan-500/10 dark:border-cyan-400/25 dark:bg-cyan-400/15 dark:text-cyan-100 dark:shadow-cyan-500/10',
    highlight: 'bg-blue-200 text-blue-950 dark:bg-blue-200 dark:text-blue-950',
    dot: 'bg-cyan-500 dark:bg-cyan-300',
  },
  {
    match: /pre[-\s]?chorus|prechorus|\bpc\b/i,
    label: 'text-teal-700 dark:text-teal-300',
    chord: 'text-teal-700 dark:text-teal-300',
    lyric: 'text-slate-950 dark:!text-teal-50',
    badge: 'border-teal-200 bg-teal-100 text-teal-800 shadow-teal-500/10 dark:border-teal-400/25 dark:bg-teal-400/15 dark:text-teal-100 dark:shadow-teal-500/10',
    highlight: 'bg-teal-200 text-teal-950 dark:bg-teal-200 dark:text-teal-950',
    dot: 'bg-teal-500 dark:bg-teal-300',
  },
  {
    match: /chorus|refrain/i,
    label: 'text-emerald-700 dark:text-emerald-300',
    chord: 'text-emerald-700 dark:text-emerald-300',
    lyric: 'text-slate-950 dark:!text-emerald-50',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800 shadow-emerald-500/10 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-100 dark:shadow-emerald-500/10',
    highlight: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-200 dark:text-emerald-950',
    dot: 'bg-emerald-500 dark:bg-emerald-300',
  },
  {
    match: /bridge|\bb\b/i,
    label: 'text-rose-700 dark:text-rose-300',
    chord: 'text-rose-700 dark:text-rose-300',
    lyric: 'text-slate-950 dark:!text-rose-50',
    badge: 'border-rose-200 bg-rose-100 text-rose-800 shadow-rose-500/10 dark:border-rose-400/25 dark:bg-rose-400/15 dark:text-rose-100 dark:shadow-rose-500/10',
    highlight: 'bg-rose-200 text-rose-950 dark:bg-rose-200 dark:text-rose-950',
    dot: 'bg-rose-500 dark:bg-rose-300',
  },
  {
    match: /ending|outro|tag/i,
    label: 'text-orange-700 dark:text-orange-300',
    chord: 'text-orange-700 dark:text-orange-300',
    lyric: 'text-slate-950 dark:!text-orange-50',
    badge: 'border-orange-200 bg-orange-100 text-orange-800 shadow-orange-500/10 dark:border-orange-400/25 dark:bg-orange-400/15 dark:text-orange-100 dark:shadow-orange-500/10',
    highlight: 'bg-orange-200 text-orange-950 dark:bg-orange-200 dark:text-orange-950',
    dot: 'bg-orange-500 dark:bg-orange-300',
  },
];

const DEFAULT_SECTION_TONE = {
  label: 'text-emerald-700 dark:text-emerald-300',
  chord: 'text-emerald-700 dark:text-emerald-300',
  lyric: 'text-slate-950 dark:!text-slate-100',
  badge: 'border-slate-200 bg-slate-100 text-slate-800 shadow-slate-500/10 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:shadow-black/10',
    highlight: 'bg-slate-200 text-slate-950 dark:bg-slate-200 dark:text-slate-950',
  dot: 'bg-slate-500 dark:bg-slate-300',
};

const CHART_SETTINGS_STORAGE_KEY = 'servesync:song-chart-display-settings';
const CHART_SETTINGS_VERSION = 3;
const CHART_EDITOR_DRAFT_STORAGE_VERSION = 1;
const CHART_EDITOR_DRAFT_STORAGE_PREFIX = 'servesync:song-chart-editor-draft';
const CHART_FONT_SIZE_MIN = 8;
const CHART_FONT_SIZE_MAX = 36;
const AUTO_SCROLL_SPEED_MIN = 8;
const AUTO_SCROLL_SPEED_MAX = 80;
const AUTO_SCROLL_SPEED_DEFAULT = 24;
const LIVE_MODE_CHART_SETTINGS_PREFERENCE_KEY = 'live-mode-chart-display-settings-v1';
const SHARP_KEY_OPTIONS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

interface ChartDisplaySettings {
  notesEnabled: boolean;
  columns: 'auto' | 'single';
  settingsVersion: number;
  lyricFontSize: number;
  chordFontSize: number;
  sectionBadgeFontSize: number;
  noteFontSize: number;
  lyricBold: boolean;
  lyricItalic: boolean;
  chordBold: boolean;
  chordItalic: boolean;
  lyricsOnly: boolean;
  autoScrollSpeed: number;
}

interface StoredChartEditorDraft {
  version: number;
  songId: string;
  savedPlainDraft: string;
  plainDraft: string;
  sectionEditorEnabled: boolean;
  draftSections: EditableChartSection[];
  isEditing: boolean;
  selectionStart?: number;
  selectionEnd?: number;
  updatedAt: string;
}

interface InitialEditorState {
  draft: string;
  draftSections: EditableChartSection[];
  sectionEditorEnabled: boolean;
  isEditing: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}

const DEFAULT_CHART_SETTINGS: ChartDisplaySettings = {
  notesEnabled: true,
  columns: 'auto',
  settingsVersion: CHART_SETTINGS_VERSION,
  lyricFontSize: 16,
  chordFontSize: 16,
  sectionBadgeFontSize: 10,
  noteFontSize: 16,
  lyricBold: false,
  lyricItalic: false,
  chordBold: true,
  chordItalic: false,
  lyricsOnly: false,
  autoScrollSpeed: AUTO_SCROLL_SPEED_DEFAULT,
};

function normalizeChartDisplaySettings(parsed: Partial<ChartDisplaySettings> | null | undefined): ChartDisplaySettings {
  if (!parsed) return DEFAULT_CHART_SETTINGS;
  const shouldUseNewDefaults = parsed.settingsVersion !== CHART_SETTINGS_VERSION;
  return {
    notesEnabled: parsed.notesEnabled !== false,
    columns: parsed.columns === 'single' ? 'single' : 'auto',
    settingsVersion: CHART_SETTINGS_VERSION,
    lyricFontSize: shouldUseNewDefaults ? DEFAULT_CHART_SETTINGS.lyricFontSize : normalizeFontSize(parsed.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize),
    chordFontSize: shouldUseNewDefaults ? DEFAULT_CHART_SETTINGS.lyricFontSize : normalizeFontSize(parsed.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize),
    sectionBadgeFontSize: normalizeFontSize(parsed.sectionBadgeFontSize, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize),
    noteFontSize: shouldUseNewDefaults ? DEFAULT_CHART_SETTINGS.lyricFontSize : normalizeFontSize(parsed.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize),
    lyricBold: typeof parsed.lyricBold === 'boolean' ? parsed.lyricBold : DEFAULT_CHART_SETTINGS.lyricBold,
    lyricItalic: typeof parsed.lyricItalic === 'boolean' ? parsed.lyricItalic : DEFAULT_CHART_SETTINGS.lyricItalic,
    chordBold: typeof parsed.chordBold === 'boolean' ? parsed.chordBold : DEFAULT_CHART_SETTINGS.chordBold,
    chordItalic: typeof parsed.chordItalic === 'boolean' ? parsed.chordItalic : DEFAULT_CHART_SETTINGS.chordItalic,
    lyricsOnly: typeof parsed.lyricsOnly === 'boolean' ? parsed.lyricsOnly : DEFAULT_CHART_SETTINGS.lyricsOnly,
    autoScrollSpeed: normalizeAutoScrollSpeed(parsed.autoScrollSpeed),
  };
}

function loadChartDisplaySettings(storageKey = CHART_SETTINGS_STORAGE_KEY): ChartDisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_CHART_SETTINGS;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return normalizeChartDisplaySettings(raw ? JSON.parse(raw) as Partial<ChartDisplaySettings> : null);
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}

function chartEditorDraftStorageKey(storageId?: string) {
  return storageId ? `${CHART_EDITOR_DRAFT_STORAGE_PREFIX}:v${CHART_EDITOR_DRAFT_STORAGE_VERSION}:${storageId}` : '';
}

function isEditableSectionArray(value: unknown): value is EditableChartSection[] {
  return Array.isArray(value)
    && value.every(section =>
      section
      && typeof section === 'object'
      && typeof (section as EditableChartSection).id === 'string'
      && typeof (section as EditableChartSection).label === 'string'
      && typeof (section as EditableChartSection).body === 'string'
    );
}

function loadStoredChartEditorDraft(storageId: string | undefined, songId: string | undefined, savedPlainDraft: string): StoredChartEditorDraft | null {
  if (typeof window === 'undefined') return null;
  const storageKey = chartEditorDraftStorageKey(storageId);
  if (!storageKey || !songId) return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredChartEditorDraft>;
    if (
      parsed.version !== CHART_EDITOR_DRAFT_STORAGE_VERSION
      || parsed.songId !== songId
      || parsed.savedPlainDraft !== savedPlainDraft
      || typeof parsed.plainDraft !== 'string'
      || typeof parsed.sectionEditorEnabled !== 'boolean'
      || typeof parsed.isEditing !== 'boolean'
      || !isEditableSectionArray(parsed.draftSections)
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed as StoredChartEditorDraft;
  } catch {
    return null;
  }
}

function getInitialEditorState(storageId: string | undefined, songId: string | undefined, chordproText: string | null | undefined): InitialEditorState {
  const savedPlainDraft = formatChordProForPlainEditor(chordproText || '');
  const storedDraft = loadStoredChartEditorDraft(storageId, songId, savedPlainDraft);
  if (storedDraft) {
    return {
      draft: storedDraft.plainDraft,
      draftSections: storedDraft.draftSections,
      sectionEditorEnabled: storedDraft.sectionEditorEnabled,
      isEditing: storedDraft.isEditing,
      selectionStart: storedDraft.selectionStart,
      selectionEnd: storedDraft.selectionEnd,
    };
  }

  const draftSections = createEditableSectionsFromChordPro(chordproText || '');
  return {
    draft: savedPlainDraft,
    draftSections,
    sectionEditorEnabled: draftSections.length > 0,
    isEditing: false,
  };
}

function clampFontSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFontSize(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampFontSize(value, CHART_FONT_SIZE_MIN, CHART_FONT_SIZE_MAX)
    : fallback;
}

function normalizeAutoScrollSpeed(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampFontSize(value, AUTO_SCROLL_SPEED_MIN, AUTO_SCROLL_SPEED_MAX)
    : AUTO_SCROLL_SPEED_DEFAULT;
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
  preferenceScopeId?: string;
  draftStorageId?: string;
  sectionOrder?: string[] | null;
  title: string;
  artist?: string | null;
  songKey?: string | null;
  performedKey?: string | null;
  chordproText?: string | null;
  editable?: boolean;
  fullBleed?: boolean;
  saving?: boolean;
  hideTitleHeader?: boolean;
  controlsVisible?: boolean;
  arrangementOpen?: boolean;
  onArrangementOpenChange?: (open: boolean) => void;
  autoScrollEnabled?: boolean;
  onAutoScrollEnabledChange?: (enabled: boolean) => void;
  onClose?: () => void;
  onSave?: (text: string, assignedSongKey?: string) => Promise<void> | void;
  onSaveSectionOrder?: (order: string[] | null) => Promise<void> | void;
  onEditingChange?: (isEditing: boolean) => void;
  onColumnControlsReady?: (control: { mode: 'auto' | 'single'; toggle: () => void }) => void;
  onDisplayKeyChange?: (displayKey: string) => void;
  externalDesktopNavigation?: boolean;
  footerNavigation?: {
    currentLabel: string;
    nextSongTitle?: string;
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

interface NoteRecovery { active: EditingSectionNote | null; drafts: Record<string,string> }
const EMPTY_NOTE_RECOVERY:NoteRecovery={active:null,drafts:{}};
function isNoteRecovery(value:unknown):value is NoteRecovery {
  if(!value || typeof value!=='object')return false;
  const v=value as NoteRecovery;
  return !!v.drafts && typeof v.drafts==='object' && Object.values(v.drafts).every(x=>typeof x==='string')
    && (v.active===null || (!!v.active && ['self','team'].includes(v.active.scope) && typeof v.active.sectionKey==='string' && typeof v.active.sectionLabel==='string'));
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

function upsertChordProKeyDirective(chordpro: string, key: string) {
  const trimmedKey = key.trim();
  if (!trimmedKey) return chordpro;

  const lines = chordpro.replace(/\r\n/g, '\n').split('\n');
  let replaced = false;
  const nextLines = lines.map(line => {
    if (/^\{\s*key\s*:?\s*[^}]*\}$/i.test(line)) {
      replaced = true;
      return `{key: ${trimmedKey}}`;
    }
    return line;
  });

  if (replaced) return nextLines.join('\n');
  return [`{key: ${trimmedKey}}`, ...nextLines].join('\n');
}

function resolveChartSourceKey(chordpro: string | null | undefined, fallbackSongKey?: string | null) {
  const metadata = parseChordProMetadata(chordpro || '');
  const detectedKey = detectChordProKey(chordpro || '', metadata.key || fallbackSongKey || '');
  return metadata.key || fallbackSongKey || detectedKey || '';
}

function getSectionOrderPrefix(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('pre') && normalized.includes('chorus')) return 'PC';
  if (normalized.includes('intro')) return 'I';
  if (normalized.includes('interlude')) return 'I';
  if (normalized.includes('verse')) return 'V';
  if (normalized.includes('chorus')) return 'C';
  if (normalized.includes('bridge')) return 'B';
  if (normalized.includes('tag')) return 'T';
  if (normalized.includes('outro')) return 'O';
  if (normalized.includes('ending')) return 'E';
  return (label.match(/[a-z0-9]/i)?.[0] || 'S').toUpperCase();
}

function buildSectionOrderLookups(sections: ChartSection[]) {
  const counts: Record<string, number> = {};
  const byCode = new Map<string, ChartSection>();
  const codesByKey = new Map<string, string>();

  sections.forEach(section => {
    const prefix = getSectionOrderPrefix(section.label);
    counts[prefix] = (counts[prefix] || 0) + 1;
    const code = `${prefix}${counts[prefix]}`;
    byCode.set(code, section);
    codesByKey.set(section.key, code);
  });

  return { byCode, codesByKey };
}

function parseSectionOrderInput(input: string) {
  return input
    .split(/[\s,>|-]+/)
    .map(token => token.trim().toUpperCase())
    .filter(Boolean);
}

function editableSectionsToPlainEditor(sections: EditableChartSection[]) {
  return sections
    .map(section => {
      const label = section.label.trim() || 'Section';
      return section.body.length > 0 ? `${label}\n${section.body}` : label;
    })
    .join('\n\n');
}

function createEditableSection(label = 'Verse') {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label,
    body: '',
  };
}

function getSectionEditorHeight(text: string, minLines = 5) {
  const lineCount = Math.max(minLines, text.split(/\r?\n/).length + 1);
  return `${lineCount * 28 + 28}px`;
}

interface AutoSizeSectionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  flat?: boolean;
}

function AutoSizeSectionTextarea({ value, onChange, placeholder, flat = false }: AutoSizeSectionTextareaProps) {
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
      className={
        flat
          ? 'service-mode-section-textarea w-full resize-none overflow-hidden border-l-2 border-transparent bg-transparent px-2 py-1 font-mono text-[12px] leading-7 text-gray-950 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 dark:text-white/85 dark:focus:border-emerald-400/60 dark:focus:bg-emerald-500/10'
          : 'service-mode-section-textarea w-full resize-none overflow-hidden rounded-[18px] border border-black/[0.06] bg-gray-50 p-3 font-mono text-[12px] leading-7 text-gray-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-black/20 dark:text-white/85'
      }
      style={{ minHeight: flat ? '36px' : getSectionEditorHeight('', 5) }}
      placeholder={placeholder}
      spellCheck={false}
    />
  );
}

export function SongChartViewer({
  songId,
  preferenceScopeId,
  draftStorageId,
  sectionOrder,
  title,
  artist,
  songKey,
  performedKey,
  chordproText,
  editable = false,
  fullBleed = false,
  saving = false,
  hideTitleHeader = false,
  controlsVisible = true,
  arrangementOpen: controlledArrangementOpen,
  onArrangementOpenChange,
  autoScrollEnabled: controlledAutoScrollEnabled,
  onAutoScrollEnabledChange,
  onClose,
  onSave,
  onSaveSectionOrder,
  onEditingChange,
  onDisplayKeyChange,
  onColumnControlsReady,
  footerNavigation,
  externalDesktopNavigation = false,
}: SongChartViewerProps) {
  const { user, profile } = useAuth();
  const displaySettingsStorageKey = `${CHART_SETTINGS_STORAGE_KEY}:${user?.id || 'anonymous'}:${preferenceScopeId || 'all-songs'}`;
  const initialEditorState = useMemo(() => getInitialEditorState(draftStorageId || songId, songId, chordproText), []); // eslint-disable-line react-hooks/exhaustive-deps
  const initialMetadata = parseChordProMetadata(chordproText ?? '');
  const initialDetectedKey = detectChordProKey(chordproText ?? '', initialMetadata.key || songKey || '');
  const initialSourceChartKey = initialMetadata.key || songKey || initialDetectedKey || '';
  const initialDisplayTargetKey = performedKey || songKey || initialSourceChartKey;
  const [transpose, setTranspose] = useState(() => getKeyTransposeOffset(initialSourceChartKey, initialDisplayTargetKey));
  const [isEditing, setIsEditing] = useState(initialEditorState.isEditing);
  const [draft, setDraft] = useState(initialEditorState.draft);
  const [draftSections, setDraftSections] = useState<EditableChartSection[]>(initialEditorState.draftSections);
  const [sectionEditorEnabled, setSectionEditorEnabled] = useState(initialEditorState.sectionEditorEnabled);
  const [savedPlainDraft, setSavedPlainDraft] = useState(() => formatChordProForPlainEditor(chordproText || ''));
  const privateNotes = usePrivateSongNotes(songId, user?.id, profile?.org_id);
  const selfNotes = privateNotes.notes;
  const [teamNotes, setTeamNotes] = useState<Record<string, TeamSectionNote>>({});
  const [noteRecovery, setNoteRecovery, noteRecoveryStatus] = useRecoverableDraft<NoteRecovery>(
    draftRecoveryKey(`chart-notes:${draftStorageId || songId}`,profile?.org_id,user?.id), EMPTY_NOTE_RECOVERY, isNoteRecovery);
  const editingNote = noteRecovery.active;
  const noteIdentity = (note:EditingSectionNote) => `${note.scope}:${note.sectionKey}`;
  const noteDraft = editingNote ? noteRecovery.drafts[noteIdentity(editingNote)] || '' : '';
  const setNoteDraft = (text:string) => setNoteRecovery(current => current.active ? {...current,drafts:{...current.drafts,[noteIdentity(current.active)]:text}} : current);
  const setEditingNote = (note:EditingSectionNote|null) => setNoteRecovery(current => {
    if(note)return {...current,active:note};
    const drafts={...current.drafts};
    if(current.active)delete drafts[noteIdentity(current.active)];
    return {active:null,drafts};
  });
  const [localChartSaving, setLocalChartSaving] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [editKeyPickerOpen, setEditKeyPickerOpen] = useState(false);
  const [assignedSongKey, setAssignedSongKey] = useState(() => songKey || '');
  const [internalArrangementOpen, setInternalArrangementOpen] = useState(false);
  const [arrangementInput, setArrangementInput] = useState('');
  const [arrangementSaving, setArrangementSaving] = useState(false);
  const [arrangementSaveMessage, setArrangementSaveMessage] = useState<string | null>(null);
  const [clearArrangementConfirmOpen, setClearArrangementConfirmOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(() => loadChartDisplaySettings(displaySettingsStorageKey));
  const [displaySettingsSyncReady, setDisplaySettingsSyncReady] = useState(!preferenceScopeId);
  const [internalAutoScrollEnabled, setInternalAutoScrollEnabled] = useState(false);
  const [savedPreviewChordPro, setSavedPreviewChordPro] = useState<string | null>(null);
  const [previewBaseKey, setPreviewBaseKey] = useState(() => initialSourceChartKey);
  const [chartSaveMessage, setChartSaveMessage] = useState<string | null>(null);
  const [chartSaveError, setChartSaveError] = useState<string | null>(null);
  const plainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const chartColumnsRef = useRef<HTMLDivElement | null>(null);

  const mountedSongIdRef = useRef(songId);
  const selectionRef = useRef<{ start?: number; end?: number }>({
    start: initialEditorState.selectionStart,
    end: initialEditorState.selectionEnd,
  });
  const chartAnimationIdentity = `${songId ?? ''}:${chordproText}`;
  const previousChartAnimationIdentityRef = useRef(chartAnimationIdentity);
  const savedPlainDraftFromProps = useMemo(() => formatChordProForPlainEditor(chordproText || ''), [chordproText]);
  const draftStorageKey = useMemo(() => chartEditorDraftStorageKey(draftStorageId || songId), [draftStorageId, songId]);
  const sectionDraft = useMemo(() => editableSectionsToPlainEditor(draftSections), [draftSections]);
  const activeDraft = sectionEditorEnabled ? sectionDraft : draft;
  const hasDraftChanges = activeDraft !== savedPlainDraft;
  const hasAssignedKeyChange = assignedSongKey.trim() !== (songKey || '').trim();
  const previewChordProText = savedPreviewChordPro ?? chordproText ?? '';
  const metadata = useMemo(() => parseChordProMetadata(previewChordProText), [previewChordProText]);
  const detectedKey = useMemo(() => detectChordProKey(previewChordProText, metadata.key || ''), [metadata.key, previewChordProText]);
  const sourceChartKey = previewBaseKey || metadata.key || songKey || detectedKey || '';
  const assignedTranspose = useMemo(
    () => getKeyTransposeOffset(sourceChartKey, performedKey || songKey || ''),
    [performedKey, songKey, sourceChartKey]
  );
  const draftChordProText = useMemo(
    () => sectionEditorEnabled
      ? plainEditorSectionsToChordPro(draftSections, chordproText || '')
      : plainEditorToChordPro(draft, chordproText || ''),
    [chordproText, draft, draftSections, sectionEditorEnabled]
  );
  const draftMetadata = useMemo(() => parseChordProMetadata(draftChordProText || ''), [draftChordProText]);
  const draftDetectedKey = useMemo(() => detectChordProKey(draftChordProText || '', draftMetadata.key || ''), [draftChordProText, draftMetadata.key]);
  useEffect(() => {
    onColumnControlsReady?.({ mode: displaySettings.columns, toggle: () => setDisplaySettings(settings => ({ ...settings, columns: settings.columns === 'single' ? 'auto' : 'single' })) });
  }, [displaySettings.columns, onColumnControlsReady]);

  const lyricFontSize = normalizeFontSize(displaySettings.lyricFontSize, DEFAULT_CHART_SETTINGS.lyricFontSize);
  const chordFontSize = lyricFontSize;
  const sectionBadgeFontSize = normalizeFontSize(displaySettings.sectionBadgeFontSize, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize);
  const noteFontSize = lyricFontSize;
  const autoScrollSpeed = normalizeAutoScrollSpeed(displaySettings.autoScrollSpeed);
  const arrangementOpen = controlledArrangementOpen ?? internalArrangementOpen;
  const setArrangementOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const nextValue = typeof next === 'function' ? next(arrangementOpen) : next;
    if (controlledArrangementOpen === undefined) {
      setInternalArrangementOpen(nextValue);
    }
    onArrangementOpenChange?.(nextValue);
  }, [arrangementOpen, controlledArrangementOpen, onArrangementOpenChange]);
  const autoScrollEnabled = controlledAutoScrollEnabled ?? internalAutoScrollEnabled;
  const setAutoScrollEnabled = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const nextValue = typeof next === 'function' ? next(autoScrollEnabled) : next;
    if (controlledAutoScrollEnabled === undefined) {
      setInternalAutoScrollEnabled(nextValue);
    }
    onAutoScrollEnabledChange?.(nextValue);
  }, [autoScrollEnabled, controlledAutoScrollEnabled, onAutoScrollEnabledChange]);

  useEffect(() => {
    if (mountedSongIdRef.current !== songId) {
      const nextEditorState = getInitialEditorState(draftStorageId || songId, songId, chordproText);
      mountedSongIdRef.current = songId;
      setAutoScrollEnabled(false);
      setSavedPlainDraft(savedPlainDraftFromProps);
      setDraft(nextEditorState.draft);
      setDraftSections(nextEditorState.draftSections);
      setSectionEditorEnabled(nextEditorState.sectionEditorEnabled);
      setIsEditing(nextEditorState.isEditing);
      setSavedPreviewChordPro(null);
      setPreviewBaseKey(resolveChartSourceKey(chordproText, songKey));
      setAssignedSongKey(songKey || detectedKey || '');
      setChartSaveMessage(null);
      setChartSaveError(null);
      selectionRef.current = {
        start: nextEditorState.selectionStart,
        end: nextEditorState.selectionEnd,
      };
      setTranspose(assignedTranspose);
      return;
    }

    if (!isEditing && !hasDraftChanges && savedPlainDraft !== savedPlainDraftFromProps) {
      const nextSections = createEditableSectionsFromChordPro(chordproText || '');
      setSavedPlainDraft(savedPlainDraftFromProps);
      setDraft(savedPlainDraftFromProps);
      setDraftSections(nextSections);
      setSectionEditorEnabled(nextSections.length > 0);
      setSavedPreviewChordPro(null);
      setPreviewBaseKey(resolveChartSourceKey(chordproText, songKey));
      setAssignedSongKey(songKey || detectedKey || '');
      setChartSaveError(null);
    }
  }, [assignedTranspose, chordproText, detectedKey, draftStorageId, hasDraftChanges, isEditing, savedPlainDraft, savedPlainDraftFromProps, setAutoScrollEnabled, songId, songKey]);

  useLayoutEffect(() => {
    if (!isEditing || sectionEditorEnabled) return;
    const textarea = plainTextareaRef.current;
    const { start, end } = selectionRef.current;
    if (!textarea || typeof start !== 'number' || typeof end !== 'number') return;
    const safeStart = Math.min(start, textarea.value.length);
    const safeEnd = Math.min(end, textarea.value.length);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(safeStart, safeEnd);
    });
  }, [isEditing, sectionEditorEnabled, songId]);

  useEffect(() => {
    if (!draftStorageKey || !editable) return;

    if (!isEditing && !hasDraftChanges && !hasAssignedKeyChange) {
      localStorage.removeItem(draftStorageKey);
      return;
    }

    const payload: StoredChartEditorDraft = {
      version: CHART_EDITOR_DRAFT_STORAGE_VERSION,
      songId: songId || '',
      savedPlainDraft,
      plainDraft: draft,
      sectionEditorEnabled,
      draftSections,
      isEditing,
      selectionStart: selectionRef.current.start,
      selectionEnd: selectionRef.current.end,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch {
      // Local drafts are a safety net; saving to the database still works without them.
    }
  }, [assignedSongKey, draft, draftSections, draftStorageKey, editable, hasAssignedKeyChange, hasDraftChanges, isEditing, savedPlainDraft, sectionEditorEnabled, songId]);

  useEffect(() => {
    if (!hasDraftChanges && !hasAssignedKeyChange) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasAssignedKeyChange, hasDraftChanges]);

  const pinchingText = useChartTextGestures(chartScrollRef, fullBleed && !isEditing, lyricFontSize, size => {
    setDisplaySettings(settings => ({ ...settings, lyricFontSize: size, chordFontSize: size, noteFontSize: size }));
    setAutoScrollEnabled(false);
  });
  const editingChartOrNote = isEditing || editingNote !== null || pinchingText;
  useEffect(() => {
    onEditingChange?.(editingChartOrNote);
    if (isEditing) setSettingsOpen(false);
    if (isEditing) setAutoScrollEnabled(false);
  }, [editingChartOrNote, isEditing, onEditingChange, setAutoScrollEnabled]);

  useEffect(() => {
    if (!isEditing) {
      setEditKeyPickerOpen(false);
      return;
    }

    if (!assignedSongKey) {
      setAssignedSongKey(songKey || draftDetectedKey || detectedKey || '');
    }
  }, [assignedSongKey, detectedKey, draftDetectedKey, isEditing, songKey]);

  useEffect(() => {
    if (!chartSaveMessage) return;
    const timeoutId = window.setTimeout(() => setChartSaveMessage(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [chartSaveMessage]);

  useEffect(() => {
    if (!chartSaveError) return;
    const timeoutId = window.setTimeout(() => setChartSaveError(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [chartSaveError]);

  useEffect(() => {
    try {
      const nextSettings = {
        ...displaySettings,
        settingsVersion: CHART_SETTINGS_VERSION,
        lyricFontSize,
        chordFontSize,
        sectionBadgeFontSize,
        noteFontSize,
        autoScrollSpeed,
      };
      window.localStorage.setItem(displaySettingsStorageKey, JSON.stringify(nextSettings));
      window.dispatchEvent(new CustomEvent('servesync:chart-display-settings-updated', { detail: { storageKey: displaySettingsStorageKey, settings: nextSettings } }));
    } catch {
      // Display settings are a convenience; the chart should still work if storage is unavailable.
    }
  }, [autoScrollSpeed, chordFontSize, displaySettings, displaySettingsStorageKey, lyricFontSize, noteFontSize, sectionBadgeFontSize]);

  useEffect(() => {
    setDisplaySettings(loadChartDisplaySettings(displaySettingsStorageKey));
    const handleSettingsUpdate = (event: globalThis.Event) => {
      const detail = (event as CustomEvent<{ storageKey: string; settings: ChartDisplaySettings }>).detail;
      if (detail?.storageKey !== displaySettingsStorageKey) return;
      setDisplaySettings(current => JSON.stringify(current) === JSON.stringify(detail.settings) ? current : detail.settings);
    };
    window.addEventListener('servesync:chart-display-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('servesync:chart-display-settings-updated', handleSettingsUpdate);
  }, [displaySettingsStorageKey]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !preferenceScopeId) {
      setDisplaySettingsSyncReady(true);
      return;
    }

    setDisplaySettingsSyncReady(false);
    loadSyncedPreference<Partial<ChartDisplaySettings>>(user.id, LIVE_MODE_CHART_SETTINGS_PREFERENCE_KEY)
      .then(settings => {
        if (cancelled) return;
        if (settings) setDisplaySettings(normalizeChartDisplaySettings(settings));
        setDisplaySettingsSyncReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [preferenceScopeId, user?.id]);

  useEffect(() => {
    if (!displaySettingsSyncReady || !user?.id || !preferenceScopeId) return;
    const timeoutId = window.setTimeout(() => {
      void saveSyncedPreference(user.id, LIVE_MODE_CHART_SETTINGS_PREFERENCE_KEY, {
        ...displaySettings,
        settingsVersion: CHART_SETTINGS_VERSION,
      });
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [displaySettings, displaySettingsSyncReady, preferenceScopeId, user?.id]);

  const renderedText = useMemo(() => transposeChordPro(previewChordProText, transpose), [previewChordProText, transpose]);
  const chartLines = useMemo(() => parseChordPro(renderedText), [renderedText]);
  const chartSections = useMemo(() => buildChartSections(chartLines), [chartLines]);
  const hasDisplayableChartContent = useMemo(
    () => chartLines.some(line => line.type === 'lyrics' && Boolean(line.chords?.trim() || line.lyrics?.trim())),
    [chartLines],
  );
  const sectionOrderLookups = useMemo(() => buildSectionOrderLookups(chartSections), [chartSections]);
  const defaultSectionOrder = useMemo(
    () => chartSections.map(section => sectionOrderLookups.codesByKey.get(section.key)).filter((code): code is string => Boolean(code)),
    [chartSections, sectionOrderLookups]
  );
  const effectiveSectionOrder = useMemo(
    () => sectionOrder?.length ? sectionOrder.map(token => token.toUpperCase()) : defaultSectionOrder,
    [defaultSectionOrder, sectionOrder]
  );
  const arrangedChartSections = useMemo(() => {
    if (!sectionOrder?.length) return chartSections;
    const arranged = sectionOrder
      .map(token => sectionOrderLookups.byCode.get(token.toUpperCase()))
      .filter((section): section is ChartSection => Boolean(section));
    return arranged.length > 0 ? arranged : chartSections;
  }, [chartSections, sectionOrder, sectionOrderLookups]);
  const displayKey = sourceChartKey ? transposeKey(sourceChartKey, transpose) : '';
  const keyOptions = useMemo(
    () => sourceChartKey.includes('b') ? FLAT_KEY_OPTIONS : SHARP_KEY_OPTIONS,
    [sourceChartKey]
  );
  const editKeyOptions = useMemo(
    () => (draftDetectedKey || detectedKey).includes('b') ? FLAT_KEY_OPTIONS : SHARP_KEY_OPTIONS,
    [detectedKey, draftDetectedKey]
  );
  const showControls = controlsVisible || isEditing;
  const showTopBar = !hideTitleHeader || showControls || arrangementOpen;

  useEffect(() => {
    onDisplayKeyChange?.(displayKey);
  }, [displayKey, onDisplayKeyChange]);

  useEffect(() => {
    setArrangementInput(effectiveSectionOrder.join(' '));
  }, [effectiveSectionOrder]);

  useEffect(() => {
    if (!arrangementSaveMessage) return;
    const timeoutId = window.setTimeout(() => setArrangementSaveMessage(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [arrangementSaveMessage]);

  useEffect(() => {
    if (!autoScrollEnabled || isEditing) return;
    const scrollElement = chartScrollRef.current;
    if (!scrollElement) return;

    let lastFrameTime = performance.now();
    let pendingPixels = 0;
    let animationFrame = 0;

    const tick = (frameTime: number) => {
      const secondsElapsed = Math.min((frameTime - lastFrameTime) / 1000, 0.08);
      lastFrameTime = frameTime;

      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
      if (maxScrollTop <= 0 || scrollElement.scrollTop >= maxScrollTop - 1) {
        setAutoScrollEnabled(false);
        return;
      }

      pendingPixels += autoScrollSpeed * secondsElapsed;
      const wholePixels = Math.floor(pendingPixels);

      if (wholePixels > 0) {
        pendingPixels -= wholePixels;
        scrollElement.scrollTop = Math.min(maxScrollTop, scrollElement.scrollTop + wholePixels);
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [autoScrollEnabled, autoScrollSpeed, isEditing, renderedText, setAutoScrollEnabled]);

  useEffect(() => {
    if (!controlsVisible) {
      setSettingsOpen(false);
      setKeyPickerOpen(false);
      setEditKeyPickerOpen(false);
    }
  }, [controlsVisible]);

  useEffect(() => {
    if (!isEditing) return;
    setKeyPickerOpen(false);
    setArrangementOpen(false);
    setSettingsOpen(false);
  }, [isEditing, setArrangementOpen]);

  useEffect(() => {
    previousChartAnimationIdentityRef.current = chartAnimationIdentity;
  }, [chartAnimationIdentity]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamNotes(showLoading = false) {
      if (!songId) {
        setTeamNotes({});
        return;
      }

      if (showLoading) setNotesLoading(true);
      const { data, error } = await supabase
        .from('song_section_notes')
        .select('id, section_key, section_label, note')
        .eq('song_id', songId)
        .eq('scope', 'team');

      if (cancelled) return;

      if (error) {
        console.error('Failed to load song section notes', error);
        if (showLoading) {
          setNoteError('Could not load team notes yet.');
          setTeamNotes({});
        }
      } else {
        const nextNotes = (data || []).reduce<Record<string, TeamSectionNote>>((acc, note) => {
          acc[note.section_key] = note as TeamSectionNote;
          return acc;
        }, {});
        setTeamNotes(nextNotes);
      }

      if (showLoading) setNotesLoading(false);
    }

    void loadTeamNotes(true);
    const refreshId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadTeamNotes();
    }, 4000);
    const refreshVisibleNotes = () => {
      if (document.visibilityState === 'visible') void loadTeamNotes();
    };
    window.addEventListener('focus', refreshVisibleNotes);
    document.addEventListener('visibilitychange', refreshVisibleNotes);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
      window.removeEventListener('focus', refreshVisibleNotes);
      document.removeEventListener('visibilitychange', refreshVisibleNotes);
    };
  }, [songId]);

  const openSectionNote = (sectionKey: string, sectionLabel: string, scope: NoteScope) => {
    if (!displaySettings.notesEnabled && !(scope === 'self' ? selfNotes[sectionKey] : teamNotes[sectionKey]?.note)) return;
    setAutoScrollEnabled(false);
    setNoteError(null);
    const active={sectionKey,sectionLabel,scope};
    const key=noteIdentity(active);
    setNoteRecovery(current=>({...current,active,drafts:{...current.drafts,[key]:current.drafts[key] ?? (scope==='self' ? selfNotes[sectionKey] || '' : teamNotes[sectionKey]?.note || '')}}));
  };

  const saveSectionNote = async (deleteNote = false) => {
    if (!editingNote || !songId) return;

    if (notesSaving) return;
    const savedIdentity = noteIdentity(editingNote);
    const clearSavedNote = () => setNoteRecovery(current => {
      const drafts={...current.drafts}; delete drafts[savedIdentity];
      return {active:current.active && noteIdentity(current.active)===savedIdentity ? null : current.active,drafts};
    });
    const note = deleteNote ? '' : noteDraft.trim();
    if (!deleteNote && !note) return;
    setNotesSaving(true);
    setNoteError(null);

    if (editingNote.scope === 'self') {
      try {
        await privateNotes.save(editingNote.sectionKey, note);
        clearSavedNote();
      } catch { setNoteError('Could not save your private note to your account. Your draft is still here; reconnect and retry.'); }
      finally { setNotesSaving(false); }
      return;
    }

    try {
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
        clearSavedNote();
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
      clearSavedNote();
    }

    } catch { setNoteError('Could not save the team note. Your draft is still here.'); }
    finally { setNotesSaving(false); }
  };

  const handleSaveChartDraft = async () => {
    if (!onSave || localChartSaving) return;
    if (!hasDraftChanges && !hasAssignedKeyChange) {
      setChartSaveError(null);
      setChartSaveMessage('No changes to save');
      setIsEditing(false);
      return;
    }
    setChartSaveError(null);
    setLocalChartSaving(true);
    try {
      const rawNextChordPro = sectionEditorEnabled
        ? plainEditorSectionsToChordPro(draftSections, chordproText || '')
        : plainEditorToChordPro(activeDraft, chordproText || '');
      const nextAssignedSongKey = assignedSongKey.trim() || draftDetectedKey || detectedKey || '';
      const nextChordPro = upsertChordProKeyDirective(rawNextChordPro, nextAssignedSongKey);
      await onSave(nextChordPro, nextAssignedSongKey);
      const nextSourceKey = resolveChartSourceKey(nextChordPro, nextAssignedSongKey);
      setSavedPlainDraft(activeDraft);
      setSavedPreviewChordPro(nextChordPro);
      setPreviewBaseKey(nextSourceKey);
      setTranspose(getKeyTransposeOffset(nextSourceKey, performedKey || nextAssignedSongKey || nextSourceKey));
      setChartSaveMessage(nextAssignedSongKey ? `Saved in key ${nextAssignedSongKey}` : 'Chord chart saved');
      setIsEditing(false);
      if (draftStorageKey) localStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.error('Failed to save chart draft:', error);
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Failed to save chord chart';
      setChartSaveMessage(null);
      setChartSaveError(message);
    } finally {
      setLocalChartSaving(false);
    }
  };

  const handleSaveSectionOrder = async () => {
    if (!onSaveSectionOrder || arrangementSaving) return;

    const tokens = parseSectionOrderInput(arrangementInput);
    if (tokens.length === 0) {
      setArrangementSaveMessage(null);
      setNoteError('Add at least one section before saving, or use reset to restore the default order.');
      return;
    }

    const invalidTokens = tokens.filter(token => !sectionOrderLookups.byCode.has(token));
    if (invalidTokens.length > 0) {
      setArrangementSaveMessage(null);
      setNoteError(`Unknown section: ${invalidTokens[0]}. Use one of ${defaultSectionOrder.join(', ')}.`);
      return;
    }

    const isDefaultOrder = tokens.length === defaultSectionOrder.length
      && tokens.every((token, index) => token === defaultSectionOrder[index]);

    setArrangementSaving(true);
    setNoteError('');
    try {
      await onSaveSectionOrder(isDefaultOrder ? null : tokens);
      setArrangementInput((isDefaultOrder ? defaultSectionOrder : tokens).join(' '));
      setArrangementSaveMessage(isDefaultOrder ? 'Default restored' : 'Saved');
    } catch (error) {
      console.error('Failed to save section order:', error);
      setArrangementSaveMessage(null);
      setNoteError('Could not save the section order.');
    } finally {
      setArrangementSaving(false);
    }
  };

  const confirmClearSectionOrder = () => {
    if (arrangementSaving) return;
    setNoteError('');
    setArrangementSaveMessage(null);
    setArrangementInput('');
    setClearArrangementConfirmOpen(false);
  };

  const requestClose = () => {
    if (hasDraftChanges) {
      const shouldClose = window.confirm('Close this chart editor? Your unsaved draft will stay on this device, but it has not been saved to the database yet.');
      if (!shouldClose) return;
    }
    onClose?.();
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

  const insertDraftSectionAfter = (index: number) => {
    setDraftSections(sections => {
      const nextSections = [...sections];
      nextSections.splice(index + 1, 0, createEditableSection('New Section'));
      return nextSections;
    });
  };

  const deleteDraftSection = (id: string) => {
    setDraftSections(sections => sections.filter(section => section.id !== id));
  };

  // Try a complete at-a-glance layout without changing the chosen font size.
  // If no readable one-to-three-column layout fits, use a centered scroll view.
  useLayoutEffect(() => {
    const scroll = chartScrollRef.current;
    const columns = chartColumnsRef.current;
    if (!fullBleed || !scroll || !columns || isEditing) return;
    const layout = () => {
      columns.style.height = '';
      columns.style.transform = '';
      columns.style.maxWidth = '';
      columns.style.marginInline = '';
      columns.style.columnFill = 'balance';
      columns.style.columnCount = '1';
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      if (displaySettings.columns === 'single') {
        columns.style.maxWidth = '56rem';
        columns.style.marginInline = 'auto';
        return;
      }
      const availableHeight = Math.max(1, Math.floor(scroll.clientHeight - (columns.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop)));
      const gap = parseFloat(getComputedStyle(columns).columnGap) || 32;
      const minColumnWidth = Math.max(220, lyricFontSize * 18);
      const maxColumns = Math.min(3, Math.max(1, Math.floor((columns.clientWidth + gap) / (minColumnWidth + gap))));
      for (let count = 1; count <= maxColumns; count++) {
        columns.style.columnCount = String(count);
        if (Math.ceil(columns.getBoundingClientRect().height) <= availableHeight) {
          columns.style.height = `${availableHeight}px`;
          columns.style.columnFill = 'auto';
          scroll.scrollTop = 0;
          return;
        }
      }
      columns.style.columnCount = '1';
      columns.style.maxWidth = '56rem';
      columns.style.marginInline = 'auto';
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [fullBleed, isEditing, lyricFontSize, displaySettings, arrangedChartSections, selfNotes, teamNotes, noteRecovery, notesLoading, noteError, privateNotes.error, privateNotes.legacyCount]);

  const chartFooter = footerNavigation && <ChartNavigation {...footerNavigation} />;

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
                <button onClick={requestClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

        <AnimatePresence initial={false}>
          {showControls && (
            <motion.div
              className={`flex flex-nowrap items-center gap-1.5 overflow-visible py-1 ${hideTitleHeader ? '-my-1' : 'mt-3 -mb-1'}`}
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
                  setArrangementOpen(false);
                }}
                disabled={!detectedKey}
                aria-label={`Change key: ${displayKey || "unknown"}`}
                aria-expanded={keyPickerOpen}
                className={`inline-flex h-10 min-w-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border-2 px-3 text-[13px] font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[44px] sm:px-3 sm:text-sm ${
                  keyPickerOpen
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                {displayKey || '--'}
              </button>
              <button
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setSettingsOpen(value => !value);
                  setKeyPickerOpen(false);
                  setArrangementOpen(false);
                }}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 text-[13px] font-black transition active:scale-[0.97] sm:px-3.5 sm:text-sm ${
                  settingsOpen
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'border-black/[0.08] bg-white/90 text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70'
                }`}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>Display</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplaySettings(settings => ({ ...settings, lyricsOnly: !settings.lyricsOnly }))}
                aria-pressed={displaySettings.lyricsOnly}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 text-[13px] font-black transition active:scale-[0.97] sm:px-3.5 sm:text-sm ${
                  displaySettings.lyricsOnly
                    ? 'border-sky-500 bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'border-black/[0.08] bg-white/90 text-gray-700 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70'
                }`}
              >
                <Captions className="h-3.5 w-3.5" />
                <span>Lyrics</span>
              </button>
              <button type="button" aria-label="Enable adding notes" aria-pressed={displaySettings.notesEnabled} onClick={() => setDisplaySettings(settings => ({ ...settings, notesEnabled: !settings.notesEnabled }))} className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-[13px] font-bold ${displaySettings.notesEnabled ? 'border-amber-400/40 bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200' : 'border-black/10 text-gray-500 dark:border-white/10 dark:text-white/60'}`}><StickyNote className="h-3.5 w-3.5" />Notes {displaySettings.notesEnabled ? 'on' : 'off'}</button>


            </>
          )}
          {editable && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-slate-200 bg-slate-900 px-3 text-[13px] font-black text-white shadow-lg shadow-slate-900/15 transition active:scale-[0.97] dark:border-white/[0.10] dark:bg-white/[0.12] dark:text-white sm:px-3.5 sm:text-sm"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit chart</span>
            </button>
          )}
          {editable && isEditing && onSave && (
            <button
              type="button"
              onClick={() => {
                setEditKeyPickerOpen(value => !value);
                setKeyPickerOpen(false);
                setArrangementOpen(false);
              }}
              aria-expanded={editKeyPickerOpen}
              className={`inline-flex h-10 min-w-[86px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border-2 px-3 text-[13px] font-black transition active:scale-[0.97] sm:min-w-[104px] sm:px-4 sm:text-sm ${
                editKeyPickerOpen
                  ? 'border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'border-amber-200 bg-amber-50 text-amber-800 shadow-sm shadow-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200'
              }`}
            >
              {assignedSongKey ? `Key ${assignedSongKey}` : 'Assign key'}
            </button>
          )}
          {editable && isEditing && onSave && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-gray-200 bg-white px-3.5 text-sm font-black text-gray-600 shadow-sm transition active:scale-[0.97] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/65"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          )}
          {editable && isEditing && onSave && (
            <button
              onClick={handleSaveChartDraft}
              disabled={saving || localChartSaving}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${
                (hasDraftChanges || hasAssignedKeyChange)
                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60'
                  : 'border-gray-200 bg-gray-100 text-gray-500 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/50'
              }`}
            >
              <Save className="h-3.5 w-3.5" /> {saving || localChartSaving ? 'Saving...' : 'Save'}
            </button>
          )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showControls && editKeyPickerOpen && isEditing && (
            <motion.div
              className="mt-3 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/90 shadow-sm shadow-amber-500/10 backdrop-blur-xl dark:border-amber-400/20 dark:bg-amber-500/10"
              initial={{ height: 0, opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ height: 'auto', opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="border-b border-amber-200/70 px-4 py-3 text-left dark:border-amber-400/15">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">Assigned Key</p>
                <p className="mt-1 text-xs font-semibold text-amber-700/85 dark:text-amber-100/75">
                  Save the chart with the correct base key for this song record.
                </p>
                {draftDetectedKey && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700/80 dark:text-amber-100/65">
                    Detected from chart: {draftDetectedKey}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-6">
                {editKeyOptions.map(keyOption => {
                  const selected = keyOption === assignedSongKey;
                  return (
                    <button
                      key={keyOption}
                      type="button"
                      onClick={() => {
                        setAssignedSongKey(keyOption);
                        setEditKeyPickerOpen(false);
                      }}
                      className={`h-10 rounded-2xl text-sm font-black transition active:scale-[0.96] ${
                        selected
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                          : 'bg-white/80 text-amber-800 ring-1 ring-amber-200/80 hover:bg-white dark:bg-white/[0.06] dark:text-amber-100 dark:ring-amber-400/15 dark:hover:bg-white/[0.1]'
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
          {chartSaveError && (
            <motion.div
              className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm shadow-rose-500/10 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"
              initial={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <X className="h-4 w-4" />
              <span>{chartSaveError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {chartSaveMessage && !isEditing && (
            <motion.div
              className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm shadow-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
              initial={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <Check className="h-4 w-4" />
              <span>{chartSaveMessage}</span>
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
                        setTranspose(getKeyTransposeOffset(sourceChartKey, keyOption));
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
              <div className="grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="grid gap-1.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-2 shadow-sm shadow-emerald-500/5 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:shadow-emerald-950/10">
                  <span className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-emerald-900 dark:text-emerald-100">
                    Auto Scroll
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-300/10 dark:text-emerald-100 dark:ring-emerald-300/20">{autoScrollSpeed}px/s</span>
                  </span>
                  <div className="grid grid-cols-[42px_1fr] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoScrollEnabled(value => !value)}
                      className={`flex h-10 items-center justify-center rounded-full transition active:scale-[0.96] ${
                        autoScrollEnabled
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-white text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-white/[0.08] dark:text-emerald-200 dark:ring-emerald-300/15'
                      }`}
                      aria-label={autoScrollEnabled ? 'Pause auto scroll' : 'Start auto scroll'}
                      aria-pressed={autoScrollEnabled}
                    >
                      {autoScrollEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <label className="grid gap-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                        <Gauge className="h-3 w-3" /> Speed
                      </span>
                      <input
                        type="range"
                        min={AUTO_SCROLL_SPEED_MIN}
                        max={AUTO_SCROLL_SPEED_MAX}
                        step={2}
                        value={autoScrollSpeed}
                        onChange={event => setDisplaySettings(settings => ({ ...settings, autoScrollSpeed: normalizeAutoScrollSpeed(Number(event.target.value)) }))}
                        className="h-2 w-full accent-emerald-600"
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-2 shadow-sm dark:border-sky-400/20 dark:bg-sky-500/10">
                  <span className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-sky-900 dark:text-sky-100">
                    Text size <span>{lyricFontSize}px</span>
                  </span>
                  <span className="text-xs text-sky-900/70 dark:text-sky-100/70">Notes, chords &amp; lyrics</span>
                  <span className="text-xs text-sky-900/70 dark:text-sky-100/70">Pinch the chart or use Alt + mouse wheel</span>
                    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-1 rounded-full border border-black/[0.06] bg-white/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                      <button
                        type="button"
                        aria-label="Decrease notes, chords and lyrics font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: stepFontSize(settings.lyricFontSize, -1, DEFAULT_CHART_SETTINGS.lyricFontSize), chordFontSize: stepFontSize(settings.lyricFontSize, -1, DEFAULT_CHART_SETTINGS.lyricFontSize), noteFontSize: stepFontSize(settings.lyricFontSize, -1, DEFAULT_CHART_SETTINGS.lyricFontSize) }))}
                        className="flex h-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-[0.96] disabled:opacity-40 dark:bg-white/[0.08] dark:text-white/65"
                        disabled={lyricFontSize <= CHART_FONT_SIZE_MIN}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <div className="text-center text-sm font-black text-gray-900 dark:text-white">
                        {lyricFontSize}
                      </div>
                      <button
                        type="button"
                        aria-label="Increase notes, chords and lyrics font size"
                        onClick={() => setDisplaySettings(settings => ({ ...settings, lyricFontSize: stepFontSize(settings.lyricFontSize, 1, DEFAULT_CHART_SETTINGS.lyricFontSize), chordFontSize: stepFontSize(settings.lyricFontSize, 1, DEFAULT_CHART_SETTINGS.lyricFontSize), noteFontSize: stepFontSize(settings.lyricFontSize, 1, DEFAULT_CHART_SETTINGS.lyricFontSize) }))}
                        className="flex h-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                        disabled={lyricFontSize >= CHART_FONT_SIZE_MAX}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-1.5">
                    <span className="text-xs font-bold text-sky-900 dark:text-sky-100">Lyrics</span>
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
                  <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">Chords</span>
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
                <div className="grid gap-1.5 rounded-2xl border border-violet-200/80 bg-violet-50/70 p-2 shadow-sm shadow-violet-500/5 dark:border-violet-400/20 dark:bg-violet-500/10 dark:shadow-violet-950/10">
                  <span className="flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-violet-900 dark:text-violet-100">
                    Section label <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-300/10 dark:text-violet-100 dark:ring-violet-300/20">{sectionBadgeFontSize}px</span>
                  </span>
                  <div className="grid grid-cols-[38px_1fr_38px] items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <button
                      type="button"
                      aria-label="Decrease section label font size"
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
                      aria-label="Increase section label font size"
                      onClick={() => setDisplaySettings(settings => ({ ...settings, sectionBadgeFontSize: stepFontSize(settings.sectionBadgeFontSize, 1, DEFAULT_CHART_SETTINGS.sectionBadgeFontSize) }))}
                      className="flex h-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300"
                      disabled={sectionBadgeFontSize >= CHART_FONT_SIZE_MAX}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={`inline-flex items-center justify-center gap-1.5 py-1 font-bold uppercase tracking-[0.12em] ${DEFAULT_SECTION_TONE.label}`} style={{ fontSize: `${sectionBadgeFontSize}px`, lineHeight: 1.15 }}>
                    <span className={`h-3 w-0.5 rounded-sm ${DEFAULT_SECTION_TONE.dot}`} />
                    Section
                  </div>
                </div>


              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {arrangementOpen && onSaveSectionOrder && !isEditing && (
            <motion.div
              className="mt-3 overflow-hidden rounded-3xl border border-amber-200/80 bg-amber-50/90 shadow-sm shadow-amber-500/10 backdrop-blur-xl dark:border-amber-400/20 dark:bg-amber-500/10"
              initial={{ height: 0, opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ height: 'auto', opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid gap-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-amber-900 dark:text-amber-100">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Arrangement
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-300/20">
                      {effectiveSectionOrder.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setArrangementSaveMessage(null);
                        setNoteError('');
                        setArrangementInput(defaultSectionOrder.join(' '));
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-amber-200 transition active:scale-[0.95] dark:bg-white/[0.08] dark:text-amber-100 dark:ring-amber-300/15"
                      aria-label="Reset arrangement to default"
                      title="Reset arrangement to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {defaultSectionOrder.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setArrangementSaveMessage(null);
                        setNoteError('');
                        setArrangementInput(value => `${value.trim()} ${code}`.trim());
                      }}
                      className="h-8 rounded-full bg-white px-3 font-mono text-xs font-black text-amber-800 ring-1 ring-amber-200 transition active:scale-[0.96] dark:bg-white/[0.08] dark:text-amber-100 dark:ring-amber-300/15"
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                  <input
                    value={arrangementInput}
                    onChange={event => {
                      setArrangementSaveMessage(null);
                      setNoteError('');
                      setArrangementInput(event.target.value.toUpperCase());
                    }}
                    className="h-10 min-w-0 rounded-full border border-amber-200 bg-white px-3 font-mono text-xs font-bold uppercase text-gray-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 dark:border-amber-300/20 dark:bg-white/[0.06] dark:text-white"
                    placeholder={defaultSectionOrder.join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => setClearArrangementConfirmOpen(true)}
                    disabled={arrangementSaving}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-500 ring-1 ring-red-200 transition active:scale-[0.96] disabled:opacity-60 dark:bg-white/[0.08] dark:text-red-300 dark:ring-red-400/20"
                    aria-label="Delete custom arrangement"
                    title="Delete custom arrangement"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSectionOrder}
                    disabled={arrangementSaving}
                    className="flex h-10 items-center gap-1.5 rounded-full bg-amber-600 px-3 text-xs font-black text-white shadow-lg shadow-amber-600/20 transition active:scale-[0.96] disabled:opacity-60"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    {arrangementSaving ? 'Saving' : 'Save'}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {arrangementSaveMessage && (
                    <motion.div
                      className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 text-xs font-black text-emerald-700 shadow-sm shadow-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {arrangementSaveMessage}
                    </motion.div>
                  )}
                </AnimatePresence>
                {noteError && (
                  <p className="text-xs font-bold leading-relaxed text-red-600 dark:text-red-300">
                    {noteError}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}

      {isEditing && sectionEditorEnabled ? (
        <div ref={chartScrollRef} className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? 'service-mode-chart-scroll bg-white px-4 pt-4 dark:bg-[#111412] sm:px-6 sm:pt-6' : 'bg-gray-50/70 px-5 py-5 dark:bg-black/20'}`}>
          <div className={`mx-auto ${fullBleed ? 'max-w-none space-y-0' : 'max-w-3xl space-y-3'}`}>
            {draftSections.map((section, index) => {
              const tone = getSectionTone(section.label);

              return (
                <section
                  key={section.id}
                  className={
                    fullBleed
                      ? 'border-t border-black/[0.06] px-0.5 py-5 transition first:border-t-0 dark:border-white/[0.08]'
                      : 'rounded-[24px] border border-black/[0.06] bg-white p-3 shadow-sm transition dark:border-white/[0.08] dark:bg-[#141815]'
                  }
                >
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <input
                      value={section.label}
                      onChange={event => updateDraftSection(section.id, { label: event.target.value })}
                      className={fullBleed
                        ? `h-8 min-w-0 flex-1 rounded-full border px-3 text-xs font-black uppercase tracking-[0.16em] outline-none transition focus:ring-4 focus:ring-emerald-500/10 ${tone.badge}`
                        : 'h-8 min-w-0 flex-1 rounded-full border border-black/[0.06] bg-gray-50 px-3 text-xs font-black uppercase tracking-[0.16em] text-gray-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white'
                      }
                      placeholder="Section name"
                    />
                    <button
                      type="button"
                      onClick={() => moveDraftSection(index, index - 1)}
                      disabled={index === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition active:scale-[0.96] disabled:opacity-35 dark:bg-white/[0.06] dark:text-white/50"
                      aria-label="Move section up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDraftSection(index, index + 1)}
                      disabled={index === draftSections.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition active:scale-[0.96] disabled:opacity-35 dark:bg-white/[0.06] dark:text-white/50"
                      aria-label="Move section down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertDraftSectionAfter(index)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition active:scale-[0.96] dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
                      aria-label={`Add section after ${section.label || 'this section'}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateDraftSection(index)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition active:scale-[0.96] dark:bg-emerald-500/10 dark:text-emerald-300"
                      aria-label="Duplicate section"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDraftSection(section.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition active:scale-[0.96] dark:bg-red-500/10 dark:text-red-300"
                      aria-label="Delete section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <AutoSizeSectionTextarea
                    value={section.body}
                    onChange={value => updateDraftSection(section.id, { body: value })}
                    placeholder={`G                 Em7\nThe splendor of a King, clothed in majesty,`}
                    flat={fullBleed}
                  />
                </section>
              );
            })}
          </div>
        </div>
      ) : isEditing ? (
        <textarea
          ref={plainTextareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onSelect={event => {
            selectionRef.current = {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
          }}
          className={`min-h-0 flex-1 resize-none font-mono text-[12px] leading-7 outline-none dark:text-white/85 ${
            fullBleed
              ? 'bg-white px-4 py-5 dark:bg-[#111412] sm:px-6'
              : 'bg-gray-50 p-5 dark:bg-black/20'
          }`}
          placeholder={`Verse 1\nG                 Em7\nThe splendor of a King, clothed in majesty,\n\nChorus\nG\nHow great is our God, sing with me,`}
          spellCheck={false}
        />
      ) : !hasDisplayableChartContent ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm px-6 py-8">
            <FileText className="mx-auto h-8 w-8 text-gray-400 dark:text-white/35" />
            <p className="mt-3 text-lg font-black">No chord chart yet</p>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-white/50">
              This song’s chart is blank at the moment. {editable ? 'Add the chords and lyrics when they are ready.' : 'Ask a song leader or admin to add it.'}
            </p>
            {editable && (
              <button
                onClick={() => {
                  setDraft('');
                  setIsEditing(true);
                }}
                className="mt-4 inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-sm font-bold text-white transition active:scale-[0.97]"
              >
                Add chart
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
        <div ref={chartScrollRef} className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? 'service-mode-chart-scroll px-4 pt-4 sm:px-6 md:pt-3 md:!pb-0' : 'px-5 py-5'}`}>
          <div className={`mx-auto ${fullBleed ? 'max-w-none space-y-0' : 'max-w-3xl space-y-4'}`}>
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
            {privateNotes.error && <p role="status" className="mb-2 text-xs text-amber-700 dark:text-amber-300">{privateNotes.error}</p>}
            {privateNotes.legacyCount > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-white/70"><span>{privateNotes.legacyCount} older private notes found on this device.</span><button type="button" disabled={privateNotes.importing} onClick={() => void privateNotes.importLegacy()} className="min-h-9 rounded-lg border border-current px-2 font-semibold disabled:opacity-50">{privateNotes.importing ? 'Importing…' : 'Import to my account'}</button></div>}
            <div ref={chartColumnsRef} className={fullBleed ? 'md:gap-8' : 'space-y-4'}>
            {arrangedChartSections.map((section, arrangementIndex) => {
              const selfNote = selfNotes[section.key];
              const teamNote = teamNotes[section.key]?.note;
              const isEditingSelf = editingNote?.sectionKey === section.key && editingNote.scope === 'self';
              const isEditingTeam = editingNote?.sectionKey === section.key && editingNote.scope === 'team';

              return (
                <section
                  key={`${section.key}-${arrangementIndex}`}
                  className={
                    fullBleed
                      ? 'group/section border-t border-black/[0.06] px-0.5 py-5 md:py-3 first:border-t-0 dark:border-white/[0.08]'
                      : 'group/section rounded-[24px] border border-black/[0.05] bg-white/75 p-4 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.035]'
                  }
                >
                  <div className={`${fullBleed ? 'mb-2' : 'mb-3'} relative flex min-h-5 [break-after:avoid-column] flex-wrap items-center gap-2`}>
                    <div
                      className={`mr-auto inline-flex max-w-[calc(100%-5rem)] items-center rounded-sm px-1.5 py-0.5 font-bold uppercase tracking-[0.1em] ${section.tone.highlight}`}
                      style={{ fontSize: `${sectionBadgeFontSize}px`, lineHeight: 1.15 }}
                    >
                      <span>{section.label}</span>
                    </div>
                    {songId && displaySettings.notesEnabled && (
                      <div className={`absolute right-0 top-1/2 -translate-y-1/2 inline-flex shrink-0 items-center gap-1 rounded-full border border-black/[0.04] bg-white/45 p-1 shadow-sm shadow-black/[0.02] transition dark:border-white/[0.06] dark:bg-white/[0.035] ${selfNote || teamNote || isEditingSelf || isEditingTeam ? 'opacity-100' : 'opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100 group-active/section:opacity-100'}`}>
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'self')}
                          className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full transition active:scale-[0.94] ${
                            selfNote
                              ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20'
                              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/60'
                          }`}
                          aria-label={selfNote ? `Edit private note for ${section.label}` : `Add private note for ${section.label}`}
                          title={selfNote ? 'Private note' : 'Add private note'}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {selfNote && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500 ring-1 ring-white dark:ring-[#111412]" />}
                        </button>
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'team')}
                          className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full transition active:scale-[0.94] ${
                            teamNote
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20'
                              : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-700 dark:text-white/35 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                          }`}
                          aria-label={teamNote ? `Edit team note for ${section.label}` : `Add team note for ${section.label}`}
                          title={teamNote ? 'Team note' : 'Add team note'}
                        >
                          {teamNote ? <StickyNote className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {teamNote && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-[#111412]" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {(selfNote || teamNote || isEditingSelf || isEditingTeam) && (
                    <div className="mb-4 grid gap-2">
                      {selfNote && !isEditingSelf && (
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'self')}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-semibold leading-relaxed text-sky-900 transition hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"
                          style={{ fontFamily: '"Comic Sans MS", "Bradley Hand", cursive', fontSize: `${noteFontSize}px` }}
                        >
                          <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300"><Lock className="h-3 w-3" /> Private note</span>
                          <span className="block whitespace-pre-wrap">{selfNote}</span>
                        </button>
                      )}
                      {teamNote && !isEditingTeam && (
                        <button
                          onClick={() => openSectionNote(section.key, section.label, 'team')}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold leading-relaxed text-emerald-950 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-50"
                          style={{ fontFamily: '"Comic Sans MS", "Bradley Hand", cursive', fontSize: `${noteFontSize}px` }}
                        >
                          <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300"><Users className="h-3 w-3" /> Team note</span>
                          <span className="block whitespace-pre-wrap">{teamNote}</span>
                        </button>
                      )}
                      {(isEditingSelf || isEditingTeam) && (
                        <div className="border-y border-black/[0.06] py-3 dark:border-white/[0.08]">
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
                          <p className="mb-2 text-xs text-gray-500 dark:text-white/65">{editingNote.scope === 'self' ? 'Only you can see this. ' : 'Shared with your team after saving. '}{noteRecoveryStatus.available ? 'Unsaved cues recover on this device.' : 'Recovery unavailable — keep this screen open.'}</p>
                          <textarea
                            disabled={notesSaving}
                            value={noteDraft}
                            onChange={event => setNoteDraft(event.target.value)}
                            className="min-h-28 w-full resize-none rounded-none border-0 bg-transparent px-0 py-1 text-sm font-semibold leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-white/35"
                            style={{ fontFamily: '"Comic Sans MS", "Bradley Hand", cursive', fontSize: `${noteFontSize}px` }}
                            placeholder={`Add a note for ${section.label.toLowerCase()}...`}
                          />
                          <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-black/[0.04] pt-2 dark:border-white/[0.06]">{(editingNote.scope === 'self' ? selfNotes[editingNote.sectionKey] : teamNotes[editingNote.sectionKey]?.note) && <button type="button" onClick={() => void saveSectionNote(true)} disabled={notesSaving} className="mr-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete note</button>}
                            <button disabled={notesSaving} onClick={() => setEditingNote(null)} className="min-h-11 rounded-full px-3 text-xs font-bold text-gray-500 hover:bg-black/[0.04] dark:text-white/50 dark:hover:bg-white/[0.06]">
                              Discard draft
                            </button>
                            <button onClick={() => void saveSectionNote()} disabled={notesSaving || !noteDraft.trim()} className="min-h-11 rounded-full bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-60">
                              {notesSaving ? 'Saving...' : 'Save note'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 font-mono">
                    {section.lines.map((line, index) => {
                      if (line.type === 'blank') return <div key={index} className="h-4" />;
                      const previousLine = section.lines[index - 1];
                      const nextLine = section.lines[index + 1];
                      const followsChordRow = !line.chords?.trim() && !!line.lyrics?.trim() && previousLine?.type === 'lyrics' && !!previousLine.chords?.trim() && !previousLine.lyrics?.trim();
                      const leadsLyricRow = !!line.chords?.trim() && !line.lyrics?.trim() && nextLine?.type === 'lyrics' && !!nextLine.lyrics?.trim() && !nextLine.chords?.trim();
                      const lineNoteKey = `${section.key}:line:${index}`;
                      const lineLabel = `${section.label} · line ${index + 1}`;
                      const lineSelfNote = selfNotes[lineNoteKey];
                      const lineTeamNote = teamNotes[lineNoteKey]?.note;
                      const isEditingLineSelf = editingNote?.sectionKey === lineNoteKey && editingNote.scope === 'self';
                      const isEditingLineTeam = editingNote?.sectionKey === lineNoteKey && editingNote.scope === 'team';
                      return (
                        <div key={index} className={`group/line relative flex break-inside-avoid-column min-w-0 flex-wrap items-end gap-x-3 rounded-xl py-1 whitespace-pre-wrap break-words transition ${displaySettings.notesEnabled && line.lyrics?.trim() ? 'hover:bg-amber-50/50 dark:hover:bg-amber-300/[0.025]' : ''} ${leadsLyricRow ? '!pb-0 -mb-1 [break-after:avoid-column]' : ''} ${followsChordRow ? '!pt-0 [break-before:avoid-column]' : ''}`}>
                          <ChartNoteTrigger enabled={displaySettings.notesEnabled && !!songId && !!line.lyrics?.trim() && !notesSaving} label={lineLabel} onOpen={() => openSectionNote(lineNoteKey, lineLabel, lineTeamNote && !lineSelfNote ? 'team' : 'self')}>
                          <AlignedChartLine chords={displaySettings.lyricsOnly ? '' : line.chords || ''} lyrics={line.lyrics || ''} chordSize={chordFontSize} lyricSize={lyricFontSize} chordClass={section.tone.chord} lyricClass={section.tone.lyric} chordBold={displaySettings.chordBold} lyricBold={displaySettings.lyricBold} chordItalic={displaySettings.chordItalic} lyricItalic={displaySettings.lyricItalic} />
                          </ChartNoteTrigger>
                          {(lineSelfNote || lineTeamNote) && <div className="flex max-w-full flex-wrap items-end gap-1.5">
                            {lineSelfNote && !isEditingLineSelf && <ChartLineNote text={lineSelfNote} scope="self" fontSize={noteFontSize} onEdit={() => openSectionNote(lineNoteKey, lineLabel, 'self')} />}
                            {lineTeamNote && !isEditingLineTeam && <ChartLineNote text={lineTeamNote} scope="team" fontSize={noteFontSize} onEdit={() => openSectionNote(lineNoteKey, lineLabel, 'team')} />}
                          </div>}
                          {(isEditingLineSelf || isEditingLineTeam) && <div className="mt-2 basis-full rounded-xl border border-amber-200 bg-[#fffdf4] p-2 dark:border-amber-500/20 dark:bg-amber-400/[0.06]"><div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans"><div className="inline-flex gap-1" role="group" aria-label="Note visibility">{(['self', 'team'] as const).map(scope => <button key={scope} type="button" aria-pressed={editingNote.scope === scope} disabled={notesSaving} onClick={() => openSectionNote(lineNoteKey, lineLabel, scope)} className={`min-h-8 rounded-md border px-2 text-[11px] font-semibold ${editingNote.scope === scope ? 'border-amber-400 bg-amber-200 text-amber-950' : 'border-gray-300 text-gray-600 dark:border-white/20 dark:text-white/70'}`}>{scope === 'self' ? 'Only me' : 'Team'}</button>)}</div><span className="text-[11px] leading-tight text-gray-500 dark:text-white/60">{editingNote.scope === 'self' ? 'Only you can see this' : 'Shared after saving'}</span></div><textarea aria-label="Line note text" autoFocus value={noteDraft} onChange={event => setNoteDraft(event.target.value)} disabled={notesSaving} rows={2} placeholder="Write a cue or flow note…" className="w-full resize-y border-0 bg-transparent p-0 leading-relaxed text-gray-900 outline-none focus:ring-0 dark:text-white" style={{ fontFamily: '"Comic Sans MS", "Bradley Hand", cursive', fontSize: `${noteFontSize}px` }} /><div className="mt-2 flex flex-wrap justify-end gap-2">{(editingNote.scope === 'self' ? selfNotes[editingNote.sectionKey] : teamNotes[editingNote.sectionKey]?.note) && <button type="button" onClick={() => void saveSectionNote(true)} disabled={notesSaving} className="mr-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete note</button>}<button type="button" onClick={() => setEditingNote(null)} disabled={notesSaving} className="min-h-11 px-3 text-xs font-bold text-gray-500">Discard draft</button><button type="button" onClick={() => void saveSectionNote()} disabled={notesSaving || !noteDraft.trim()} className="min-h-11 rounded-lg bg-amber-500 px-3 text-xs font-black text-amber-950 disabled:opacity-50">{notesSaving ? 'Saving…' : 'Save note'}</button></div></div>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            </div>
            <div className={fullBleed ? 'md:hidden' : ''}>{chartFooter}</div>
          </div>
        </div>
        {fullBleed && !externalDesktopNavigation && <div className="hidden shrink-0 border-t border-black/[0.06] bg-white px-4 py-2 dark:border-white/[0.08] dark:bg-[#111412] md:block" style={{paddingBottom:'max(8px, env(safe-area-inset-bottom))'}}>{chartFooter}</div>}
        </>
      )}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {clearArrangementConfirmOpen && (
            <motion.div
              className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 px-5 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                if (!arrangementSaving) setClearArrangementConfirmOpen(false);
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="clear-arrangement-title"
                className="w-full max-w-sm overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-4 text-gray-950 shadow-2xl shadow-black/25 dark:border-white/[0.08] dark:bg-[#141815] dark:text-white"
                initial={{ opacity: 0, y: 18, scale: 0.96, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(8px)' }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onClick={event => event.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-500/10 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/15">
                    <X className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p id="clear-arrangement-title" className="text-lg font-black tracking-[-0.02em]">
                      Clear arrangement?
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-500 dark:text-white/50">
                      This will empty the arrangement field so you can build a new order from the section buttons.
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-300/20 dark:bg-amber-500/10">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-800 dark:text-amber-100">Current arrangement</p>
                  <p className="mt-1 break-words font-mono text-xs font-bold text-amber-900 dark:text-amber-50">{arrangementInput.trim() || 'Empty'}</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearArrangementConfirmOpen(false)}
                    disabled={arrangementSaving}
                    className="h-11 rounded-2xl border border-black/[0.06] bg-gray-100 text-sm font-black text-gray-700 transition active:scale-[0.97] disabled:opacity-60 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white/70"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmClearSectionOrder}
                    disabled={arrangementSaving}
                    className="h-11 rounded-2xl bg-red-600 text-sm font-black text-white shadow-lg shadow-red-600/20 transition active:scale-[0.97] disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
