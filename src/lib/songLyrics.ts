import { parseChordPro } from './chordPro';

export type SongLyricsSource = 'saved' | 'chart' | 'missing';

interface SongLyricsFields {
  lyrics?: string | null;
  chordpro_text?: string | null;
}

const SECTION_ONLY = /^(?:intro|instrumental|interlude|verse(?:\s+\d+)?|v\d+|pre[-\s]?chorus|chorus(?:\s+\d+)?|refrain|bridge(?:\s+\d+)?|b\d+|tag|ending|outro|part(?:\s+\d+)?|section(?:\s+\d+)?|vamp|turnaround|breakdown|hook)\s*[:-]?$/i;
const RESOURCE_ONLY = /^(?:https?:\/\/|data:|file:|%PDF|!\[|<img\b|\S+\.(?:pdf|png|jpe?g|webp)(?:\?\S*)?$)/i;
const PLACEHOLDER_ONLY = /^(?:lyrics?|words?)\s+(?:not available|unavailable|missing|pending|coming soon|to be added|needed)\.?$/i;
const CHORD_ONLY = /^(?:\s*(?:N\.?C\.?|[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?[0-9#b+()]*)\s*)+$/i;

function isReadableLyricLine(value: string | null | undefined): boolean {
  const line = value?.trim() || '';
  const chordCandidate = line.replace(/[-–—|:/\\]+/g, ' ').trim();
  return /\p{L}/u.test(line)
    && !SECTION_ONLY.test(line)
    && !RESOURCE_ONLY.test(line)
    && !PLACEHOLDER_ONLY.test(line)
    && !CHORD_ONLY.test(chordCandidate);
}

function parseReadableChartLines(value: string) {
  return parseChordPro(value.split(/\r?\n/).filter(line => !RESOURCE_ONLY.test(line.trim())).join('\n'));
}

export function hasReadableSongLyrics(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return parseReadableChartLines(value).some(line => line.type === 'lyrics' && isReadableLyricLine(line.lyrics));
}

export function extractLyricsFromChordPro(chordProText: string | null | undefined): string {
  if (!chordProText?.trim()) return '';

  const parsedLines = parseReadableChartLines(chordProText);
  const hasLyricContent = parsedLines.some(line => line.type === 'lyrics' && isReadableLyricLine(line.lyrics));
  if (!hasLyricContent) return '';

  return parsedLines
    .map(line => {
      if (line.type === 'section') return line.section?.trim() || '';
      if (line.type === 'lyrics' && isReadableLyricLine(line.lyrics)) return line.lyrics?.trimEnd() || '';
      return '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getEffectiveSongLyrics(song: SongLyricsFields | null | undefined): string {
  const savedLyrics = song?.lyrics?.trim();
  if (hasReadableSongLyrics(savedLyrics)) return savedLyrics || '';
  return extractLyricsFromChordPro(song?.chordpro_text);
}

export function getSongLyricsSource(song: SongLyricsFields | null | undefined): SongLyricsSource {
  if (hasReadableSongLyrics(song?.lyrics)) return 'saved';
  return extractLyricsFromChordPro(song?.chordpro_text) ? 'chart' : 'missing';
}
