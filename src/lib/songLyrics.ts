import { parseChordPro } from './chordPro';

export type SongLyricsSource = 'saved' | 'chart' | 'missing';

interface SongLyricsFields {
  lyrics?: string | null;
  chordpro_text?: string | null;
}

export function extractLyricsFromChordPro(chordProText: string | null | undefined): string {
  if (!chordProText?.trim()) return '';

  const parsedLines = parseChordPro(chordProText);
  const hasLyricContent = parsedLines.some(line => line.type === 'lyrics' && Boolean(line.lyrics?.trim()));
  if (!hasLyricContent) return '';

  return parsedLines
    .map(line => {
      if (line.type === 'section') return line.section?.trim() || '';
      if (line.type === 'lyrics') return line.lyrics?.trimEnd() || '';
      return '';
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getEffectiveSongLyrics(song: SongLyricsFields | null | undefined): string {
  const savedLyrics = song?.lyrics?.trim();
  if (savedLyrics) return savedLyrics;
  return extractLyricsFromChordPro(song?.chordpro_text);
}

export function getSongLyricsSource(song: SongLyricsFields | null | undefined): SongLyricsSource {
  if (song?.lyrics?.trim()) return 'saved';
  return extractLyricsFromChordPro(song?.chordpro_text) ? 'chart' : 'missing';
}
