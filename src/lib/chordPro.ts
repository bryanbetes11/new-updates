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
const CHORD_ROOT_PATTERN = '[A-G](?:#|b)?';
const CHORD_QUALITY_PATTERN = '(?:maj|min|m|mi|dim|aug|sus|add|ø|o|\\+|-)?';
const CHORD_EXTENSION_PATTERN = '(?:[0-9]+)?(?:maj|min|m|dim|aug|sus|add|no|omit|alt|#|b|\\d|\\(|\\)|\\+|-|\\/)*';
const CHORD_BASS_PATTERN = `(?:/${CHORD_ROOT_PATTERN})?`;
const CHORD_TOKEN_PATTERN = new RegExp(`^(?:N\\.?C\\.?|${CHORD_ROOT_PATTERN}${CHORD_QUALITY_PATTERN}${CHORD_EXTENSION_PATTERN}${CHORD_BASS_PATTERN})$`, 'i');

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
      if (['c', 'comment', 'soc', 'startofchorus', 'sov', 'startofverse', 'sob', 'startofbridge', 'sop', 'startofpart', 'sot', 'startoftab'].includes(key)) {
        return { type: 'section', section: value || directive[1].trim() };
      }
      if (['eoc', 'endofchorus', 'eov', 'endofverse', 'eob', 'endofbridge', 'eop', 'endofpart', 'eot', 'endoftab'].includes(key)) {
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

  if (isChordOnlyLine(line)) {
    return {
      type: 'lyrics',
      chords: chordOnlyLineToPlainText(line).trimEnd(),
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
  const tokens = line.trim().split(/\s+/).filter(token => token.length > 0);
  const meaningfulTokens = tokens.filter(token => !isChordRhythmToken(token));
  if (meaningfulTokens.length === 0) return false;

  const chordTokenCount = meaningfulTokens.filter(token => chordTokenToChordPro(token) !== null).length;
  if (chordTokenCount === meaningfulTokens.length) return true;

  return meaningfulTokens.length >= 3
    && chordTokenCount >= 2
    && chordTokenCount / meaningfulTokens.length >= 0.75;
}

function chordOnlyLineToChordPro(line: string) {
  return line.replace(/\S+/g, token => {
    const chordToken = chordTokenToChordPro(token);
    if (chordToken) return chordToken;
    if (isChordRhythmToken(token)) return token;

    const fallbackChord = token.trim().replace(/[.,;:!?]+$/, '');
    return fallbackChord ? `[${escapeChordProText(fallbackChord)}]` : token;
  });
}

function chordOnlyLineToPlainText(line: string) {
  return line.replace(/\S+/g, token => chordTokenToPlainText(token) ?? token);
}

function chordTokenToChordPro(token: string) {
  const parts = parseChordTokenParts(token);
  if (!parts) return null;
  return parts.map(part => part.type === 'chord' ? `[${part.value}]` : part.value).join('');
}

function chordTokenToPlainText(token: string) {
  const parts = parseChordTokenParts(token);
  return parts ? parts.map(part => part.value).join('') : null;
}

function isChordRhythmToken(token: string) {
  return /^[|/\\]+$/.test(token) || /^[-–—]+$/.test(token);
}

function parseChordTokenParts(token: string): Array<{ type: 'chord' | 'separator'; value: string }> | null {
  const trimmed = token.trim().replace(/[.,;:!?]+$/, '');
  if (!trimmed) return null;

  const dashedParts = splitDashedChordToken(trimmed);
  if (dashedParts) return dashedParts;

  if (CHORD_TOKEN_PATTERN.test(trimmed)) return [{ type: 'chord', value: trimmed }];

  const compactChords = splitCompactChordToken(trimmed);
  if (!compactChords) return null;
  return compactChords.flatMap((chord, index) => (
    index === 0
      ? [{ type: 'chord' as const, value: chord }]
      : [{ type: 'separator' as const, value: ' ' }, { type: 'chord' as const, value: chord }]
  ));
}

function splitDashedChordToken(token: string): Array<{ type: 'chord' | 'separator'; value: string }> | null {
  if (!/[-–—]/.test(token)) return null;

  const pieces = token.split(/([-–—]+)/).filter(piece => piece.length > 0);
  if (pieces.length < 3) return null;

  const result: Array<{ type: 'chord' | 'separator'; value: string }> = [];
  for (const piece of pieces) {
    if (/^[-–—]+$/.test(piece)) {
      result.push({ type: 'separator', value: piece });
      continue;
    }

    const compactChords = CHORD_TOKEN_PATTERN.test(piece) ? [piece] : splitCompactChordToken(piece);
    if (!compactChords) return null;
    compactChords.forEach((chord, index) => {
      if (index > 0) result.push({ type: 'separator', value: ' ' });
      result.push({ type: 'chord', value: chord });
    });
  }

  return result.some(part => part.type === 'separator') ? result : null;
}

function splitCompactChordToken(token: string): string[] | null {
  if (CHORD_TOKEN_PATTERN.test(token)) return [token];

  const rootMatches = Array.from(token.matchAll(/[A-G](?:#|b)?/g));
  if (rootMatches.length < 2) return null;

  for (let i = 1; i < rootMatches.length; i += 1) {
    const splitIndex = rootMatches[i].index ?? -1;
    if (splitIndex <= 0) continue;
    const head = token.slice(0, splitIndex);
    const tail = token.slice(splitIndex);
    if (!CHORD_TOKEN_PATTERN.test(head)) continue;
    const tailParts = splitCompactChordToken(tail);
    if (tailParts) return [head, ...tailParts];
  }

  return null;
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
