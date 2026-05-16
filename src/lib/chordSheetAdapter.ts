import { ChordProFormatter, ChordsOverWordsParser, UltimateGuitarParser } from 'chordsheetjs';
import { parseChordProMetadata, plainEditorToChordPro } from './chordPro';

export type ImportedChordSheetFormat = 'chordpro' | 'ultimate-guitar' | 'chords-over-words' | 'plain-text';

export interface NormalizedImportedChordSheet {
  chordproText: string;
  detectedFormat: ImportedChordSheetFormat;
  normalizedByChordSheetJS: boolean;
}

interface NormalizeImportedChordSheetOptions {
  preferredFormat?: 'auto' | 'ultimate-guitar' | 'chords-over-words';
}

const CHORDPRO_DIRECTIVE_PATTERN = /^\s*\{\s*[^}:]+\s*:?\s*[^}]*\}\s*$/m;
const CHORDPRO_INLINE_CHORD_PATTERN = /\[[A-G](?:#|b)?[^\]\s]*\]/;
const BRACKETED_SECTION_PATTERN = /^\s*\[[^\]]+\]\s*$/m;
const BRACKETED_RHYTHM_TOKEN_PATTERN = /\[(?:[|/\\]+|-+)\]/;
const SECTION_DIRECTIVE_PATTERN = /\{\s*(start_of_(chorus|verse|bridge|part|tab)|soc|sov|sob|sop|sot)\s*:?\s*([^}]*)\}/gi;
const END_SECTION_DIRECTIVE_PATTERN = /^\s*\{\s*(end_of_(chorus|verse|bridge|part|tab)|eoc|eov|eob|eop|eot)\s*:?\s*[^}]*\}\s*$/gim;

function isLikelyChordPro(text: string) {
  return CHORDPRO_DIRECTIVE_PATTERN.test(text) || (CHORDPRO_INLINE_CHORD_PATTERN.test(text) && !BRACKETED_SECTION_PATTERN.test(text));
}

function cleanChordSheetJsChordPro(text: string) {
  return text
    .replace(SECTION_DIRECTIVE_PATTERN, (_match, directive: string, _longName: string, label: string) => {
      const normalizedDirective = directive.toLowerCase();
      const fallbackLabel = normalizedDirective.includes('chorus') || normalizedDirective === 'soc'
        ? 'Chorus'
        : normalizedDirective.includes('verse') || normalizedDirective === 'sov'
          ? 'Verse'
          : normalizedDirective.includes('bridge') || normalizedDirective === 'sob'
            ? 'Bridge'
            : normalizedDirective.includes('tab') || normalizedDirective === 'sot'
              ? 'Tab'
              : 'Section';
      return `{c: ${(label || fallbackLabel).trim()}}`;
    })
    .replace(END_SECTION_DIRECTIVE_PATTERN, '')
    .replace(/\[([^\]]+)\]/g, (_match, chord: string) => `[${normalizeChordSpelling(chord)}]`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeChordSpelling(chord: string) {
  return chord.replace(/\b([A-G](?:#|b)?)ma(?=\d)/g, '$1maj');
}

function parseWithChordSheetJs(text: string, format: Exclude<ImportedChordSheetFormat, 'chordpro' | 'plain-text'>) {
  const parser = format === 'ultimate-guitar'
    ? new UltimateGuitarParser({ preserveWhitespace: true })
    : new ChordsOverWordsParser();
  const song = parser.parse(text, format === 'chords-over-words' ? { chopFirstWord: false } : undefined);
  return cleanChordSheetJsChordPro(new ChordProFormatter().format(song));
}

function isUsableChordPro(text: string) {
  return text.trim().length > 0 && !BRACKETED_RHYTHM_TOKEN_PATTERN.test(text);
}

export function normalizeImportedChordSheet(
  input: string,
  options: NormalizeImportedChordSheetOptions = {},
): NormalizedImportedChordSheet {
  const rawText = input.replace(/\r\n?/g, '\n').trim();

  if (!rawText) {
    return { chordproText: '', detectedFormat: 'plain-text', normalizedByChordSheetJS: false };
  }

  if (isLikelyChordPro(rawText)) {
    return {
      chordproText: rawText,
      detectedFormat: 'chordpro',
      normalizedByChordSheetJS: false,
    };
  }

  const formats: Array<Exclude<ImportedChordSheetFormat, 'chordpro' | 'plain-text'>> =
    options.preferredFormat === 'chords-over-words'
      ? ['chords-over-words', 'ultimate-guitar']
      : ['ultimate-guitar', 'chords-over-words'];

  for (const format of formats) {
    try {
      const chordproText = parseWithChordSheetJs(rawText, format);
      if (isUsableChordPro(chordproText)) {
        return {
          chordproText,
          detectedFormat: format,
          normalizedByChordSheetJS: true,
        };
      }
    } catch {
      // Fall back to the next parser, then to ServeSync's plain editor converter.
    }
  }

  const chordproText = plainEditorToChordPro(rawText);
  return {
    chordproText,
    detectedFormat: 'plain-text',
    normalizedByChordSheetJS: false,
  };
}

export function parseImportedChordSheetMetadata(input: string) {
  return parseChordProMetadata(normalizeImportedChordSheet(input).chordproText);
}
