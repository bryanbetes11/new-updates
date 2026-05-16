export interface ChordProMetadata {
  title: string;
  artist: string;
  key: string;
  capo: string;
}

export interface ChordProLine {
  type: 'section' | 'lyrics' | 'blank';
  section?: string;
  chords?: string;
  lyrics?: string;
}

export interface PlainEditorSection {
  label: string;
  body: string;
}

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};
const FLAT_KEY_NAMES = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']);

const normalizeDirectiveKey = (key: string) => key.trim().toLowerCase().replace(/_/g, '');
const SECTION_LABEL_PATTERN = /^(intro|instrumental|interlude|verse(?:\s+\d+)?|v\d+|pre[-\s]?chorus|prechorus|pc|chorus|refrain|bridge(?:\s+\d+)?|b\d+|tag|ending|outro|part(?:\s+\d+)?|section(?:\s+\d+)?|vamp|turnaround|breakdown|hook|channel)$/i;
const CHORD_TOKEN_PATTERN = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|ø)?[0-9]*(?:[#b0-9()+/.-]*)?(?:\/[A-G](?:#|b)?)?$/;

export function parseChordProMetadata(chordpro: string): ChordProMetadata {
  const metadata: ChordProMetadata = { title: '', artist: '', key: '', capo: '' };

  chordpro.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\{\s*([^:}]+)\s*:?\s*([^}]*)\}$/);
    if (!match) return;
    const key = normalizeDirectiveKey(match[1]);
    const value = match[2].trim();
    if (key === 'title' || key === 't') metadata.title = value;
    if (key === 'artist' || key === 'subtitle' || key === 'st') metadata.artist = value;
    if (key === 'key') metadata.key = value;
    if (key === 'capo') metadata.capo = value;
  });

  return metadata;
}

export function parseChordPro(chordpro: string): ChordProLine[] {
  return chordpro.split(/\r?\n/).map(rawLine => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return { type: 'blank' };

    const directive = line.match(/^\{\s*([^:}]+)\s*:?\s*([^}]*)\}$/);
    if (directive) {
      const key = normalizeDirectiveKey(directive[1]);
      const value = directive[2].trim();
      if (['title', 't', 'artist', 'subtitle', 'st', 'key', 'capo'].includes(key)) {
        return null;
      }
      if (['c', 'comment', 'soc', 'startofchorus', 'sov', 'startofverse', 'sob', 'startofbridge'].includes(key)) {
        return { type: 'section', section: value || directive[1].trim() };
      }
      if (['eoc', 'endofchorus', 'eov', 'endofverse', 'eob', 'endofbridge'].includes(key)) {
        return null;
      }
      return { type: 'section', section: value || directive[1].trim() };
    }

    return parseChordLine(line);
  }).filter(Boolean) as ChordProLine[];
}

function parseChordLine(line: string): ChordProLine {
  if (isChordOnlyChordProLine(line)) {
    return {
      type: 'lyrics',
      chords: line.replace(/\[([^\]]+)\]/g, (_, chord: string) => chord.trim()).trimEnd(),
      lyrics: '',
    };
  }

  let lyrics = '';
  let chords = '';
  let lyricIndex = 0;
  let chordBuffer = '';

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '[') {
      const closeIndex = line.indexOf(']', i);
      if (closeIndex !== -1) {
        const chord = line.slice(i + 1, closeIndex).trim();
        chords = padTo(chords, lyricIndex);
        chords += chord;
        chordBuffer = chord;
        i = closeIndex;
        continue;
      }
    }

    lyrics += char;
    lyricIndex += 1;
    if (chordBuffer) {
      if (/\s/.test(char) && chords.length >= lyricIndex - 1) {
        chords += ' ';
      }
      chords = padTo(chords, lyricIndex);
      chordBuffer = '';
    }
  }

  return { type: 'lyrics', chords: chords.trimEnd(), lyrics: lyrics.trimEnd() };
}

function isChordOnlyChordProLine(line: string) {
  return /\[[^\]]+\]/.test(line)
    && line.replace(/\[[^\]]+\]/g, '').replace(/[\s|/\\\-–—]+/g, '').length === 0;
}

function padTo(value: string, targetLength: number) {
  if (value.length >= targetLength) return value;
  return value + ' '.repeat(targetLength - value.length);
}

export function transposeChordPro(chordpro: string, semitones: number): string {
  if (!semitones) return chordpro;
  return chordpro.replace(/\[([^\]]+)\]/g, (_, chord: string) => `[${transposeChord(chord, semitones)}]`);
}

export function transposeChord(chord: string, semitones: number): string {
  return chord.replace(/\b([A-G](?:#|b)?)([^/\s]*)/g, (_match, root: string, suffix: string) => {
    const normalized = FLAT_TO_SHARP[root] || root;
    const currentIndex = SHARP_NOTES.indexOf(normalized);
    if (currentIndex === -1) return `${root}${suffix}`;
    const nextIndex = (currentIndex + semitones + 120) % 12;
    return `${SHARP_NOTES[nextIndex]}${suffix}`;
  });
}

export function transposeKey(key: string, semitones: number): string {
  const normalized = normalizeKeyName(key);
  if (!normalized) return '';

  const currentIndex = SHARP_NOTES.indexOf(normalized);
  if (currentIndex === -1) return key;

  const nextKey = SHARP_NOTES[(currentIndex + semitones + 120) % 12];
  return shouldPreferFlatKey(key, nextKey) ? SHARP_TO_FLAT[nextKey] || nextKey : nextKey;
}

export function getKeyTransposeOffset(fromKey: string, toKey: string): number {
  const from = normalizeKeyName(fromKey);
  const to = normalizeKeyName(toKey);
  if (!from || !to) return 0;

  const fromIndex = SHARP_NOTES.indexOf(from);
  const toIndex = SHARP_NOTES.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return 0;

  let offset = toIndex - fromIndex;
  if (offset > 6) offset -= 12;
  if (offset < -6) offset += 12;
  return offset;
}

export function detectChordProKey(chordpro: string, fallbackKey = ''): string {
  const chordRoots = Array.from(chordpro.matchAll(/\[([^\]]+)\]/g))
    .map(match => getChordRoot(match[1]))
    .filter((root): root is string => !!root);

  if (chordRoots.length === 0) {
    return normalizeKeyName(fallbackKey) || normalizeKeyName(parseChordProMetadata(chordpro).key) || '';
  }

  const firstRoot = chordRoots[0];
  const lastRoot = chordRoots[chordRoots.length - 1];
  let bestKey = firstRoot;
  let bestScore = -Infinity;

  SHARP_NOTES.forEach(key => {
    const scale = getMajorScale(key);
    const tonic = scale[0];
    const subdominant = scale[3];
    const dominant = scale[4];
    const relativeMinor = scale[5];
    let score = 0;

    chordRoots.forEach((root, index) => {
      if (scale.includes(root)) score += 2;
      else score -= 3;
      if (root === tonic) score += 4;
      if (root === dominant || root === subdominant) score += 1.5;
      if (root === relativeMinor) score += 1;
      if (index === 0 && root === tonic) score += 8;
      if (index === chordRoots.length - 1 && root === tonic) score += 5;
    });

    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  return displayKeyName(bestKey, fallbackKey || parseChordProMetadata(chordpro).key);
}

export function detectArrangementSections(chordpro: string): string[] {
  const sections = parseChordPro(chordpro)
    .filter(line => line.type === 'section' && line.section)
    .map(line => line.section as string);

  return Array.from(new Set(sections));
}

export function formatChordProForPlainEditor(chordpro: string): string {
  return parseChordPro(chordpro).map(line => {
    if (line.type === 'blank') return '';
    if (line.type === 'section') return line.section || '';
    return [line.chords || '', line.lyrics || ''].filter(value => value.length > 0).join('\n');
  }).join('\n');
}

export function plainEditorToChordPro(plainText: string, originalChordPro = ''): string {
  const metadata = extractMetadataDirectives(originalChordPro);
  const lines = plainText.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [...metadata];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const trimmed = currentLine.trim();

    if (!trimmed) {
      output.push(currentLine);
      continue;
    }

    if (isSectionLabel(trimmed)) {
      output.push(`{c: ${toDisplaySectionLabel(trimmed)}}`);
      continue;
    }

    if (isChordOnlyLine(currentLine)) {
      output.push(chordOnlyLineToChordPro(currentLine));
      continue;
    }

    output.push(escapeChordProText(currentLine));
  }

  return output.join('\n');
}

export function plainEditorSectionsToChordPro(sections: PlainEditorSection[], originalChordPro = ''): string {
  const output: string[] = [...extractMetadataDirectives(originalChordPro)];

  sections.forEach((section, index) => {
    if (index > 0) output.push('');
    output.push(`{c: ${toDisplaySectionLabel(section.label || 'Section')}}`);

    if (section.body.length > 0) {
      output.push(...plainEditorToChordPro(section.body, '').split('\n'));
    }
  });

  return output.join('\n');
}

function extractMetadataDirectives(chordpro: string): string[] {
  return chordpro
    .split(/\r?\n/)
    .filter(line => {
      const match = line.match(/^\{\s*([^:}]+)\s*:?\s*([^}]*)\}$/);
      if (!match) return false;
      return ['title', 't', 'artist', 'subtitle', 'st', 'key', 'capo'].includes(normalizeDirectiveKey(match[1]));
    });
}

function isSectionLabel(line: string) {
  return SECTION_LABEL_PATTERN.test(line);
}

function toDisplaySectionLabel(label: string) {
  return label
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function isChordOnlyLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(token => !['|', '/', '-', '–', '—'].includes(token));
  return tokens.length > 0 && tokens.every(token => CHORD_TOKEN_PATTERN.test(token));
}

function chordOnlyLineToChordPro(line: string) {
  return line.replace(/\S+/g, token => CHORD_TOKEN_PATTERN.test(token) ? `[${token}]` : token);
}

function escapeChordProText(text: string) {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function normalizeKeyName(key: string) {
  const match = key.trim().match(/^([A-G](?:#|b)?)/);
  if (!match) return '';
  return FLAT_TO_SHARP[match[1]] || match[1];
}

function getChordRoot(chord: string) {
  const match = chord.trim().match(/^([A-G](?:#|b)?)/);
  if (!match) return null;
  return FLAT_TO_SHARP[match[1]] || match[1];
}

function getMajorScale(key: string) {
  const start = SHARP_NOTES.indexOf(key);
  const intervals = [0, 2, 4, 5, 7, 9, 11];
  return intervals.map(interval => SHARP_NOTES[(start + interval) % 12]);
}

function shouldPreferFlatKey(sourceKey: string, nextKey: string) {
  return sourceKey.includes('b') || FLAT_KEY_NAMES.has(sourceKey) || ['A#', 'D#', 'G#'].includes(nextKey);
}

function displayKeyName(key: string, sourceKey: string) {
  return shouldPreferFlatKey(sourceKey, key) ? SHARP_TO_FLAT[key] || key : key;
}
