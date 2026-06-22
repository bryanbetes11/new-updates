import { getSingleLyricsAutofill, normalizeLyricsInputForSave, normalizeLyricsSearchResults } from '../src/lib/lyricsSearch';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const emptyResults = normalizeLyricsSearchResults({ error: 'No lyrics found', results: [] });
expectEqual(emptyResults.length, 0, 'keeps no-result responses empty so stale choices are cleared');

const normalized = normalizeLyricsSearchResults({
  results: [
    { id: 'one', title: '  Amazing Grace  ', artist: '', lyrics: '  Verse one\nVerse two  ', source: 'LRCLIB' },
    { id: 'bad', title: 'Instrumental', artist: 'Someone', lyrics: '   ' },
  ],
});
expectEqual(normalized.length, 1, 'drops results without usable lyrics');
expectEqual(normalized[0].title, 'Amazing Grace', 'trims provider title before display');
expectEqual(normalized[0].artist, 'Unknown artist', 'fills missing artist display value');
expectEqual(normalized[0].lyrics, 'Verse one\nVerse two', 'trims lyrics before inserting into the editor');
expectEqual(getSingleLyricsAutofill(normalized), 'Verse one\nVerse two', 'autofills exactly one result');

const multipleResults = normalizeLyricsSearchResults({
  results: [
    { id: 'one', title: 'A', artist: 'B', lyrics: 'First' },
    { id: 'two', title: 'A', artist: 'C', lyrics: 'Second' },
  ],
});
expectEqual(getSingleLyricsAutofill(multipleResults), '', 'does not overwrite manual input when multiple choices need review');
expectEqual(normalizeLyricsInputForSave('  manually pasted lyrics  '), 'manually pasted lyrics', 'trims manual lyrics before saving');
expectEqual(normalizeLyricsInputForSave('   '), null, 'saves empty manual input as null');
