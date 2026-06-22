export interface LyricsSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  source: string;
  lyrics: string;
}

export function normalizeLyricsSearchResults(data: unknown): LyricsSearchResult[] {
  if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) {
    return [];
  }

  return data.results.reduce<LyricsSearchResult[]>((results, result, index) => {
    if (!result || typeof result !== 'object') return results;

    const record = result as Record<string, unknown>;
    const lyrics = typeof record.lyrics === 'string' ? record.lyrics.trim() : '';
    if (!lyrics) return results;

    results.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id : `lyrics-result-${index}`,
      title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : 'Untitled song',
      artist: typeof record.artist === 'string' && record.artist.trim() ? record.artist.trim() : 'Unknown artist',
      album: typeof record.album === 'string' && record.album.trim() ? record.album : null,
      duration: typeof record.duration === 'number' ? record.duration : null,
      source: typeof record.source === 'string' && record.source.trim() ? record.source : 'Lyrics search',
      lyrics,
    });

    return results;
  }, []);
}

export function getSingleLyricsAutofill(results: LyricsSearchResult[]): string {
  return results.length === 1 ? results[0].lyrics : '';
}

export function normalizeLyricsInputForSave(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}
