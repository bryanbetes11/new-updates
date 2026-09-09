import { strToU8, zipSync } from 'fflate';
import { readSongBookProArchive, readChartUploadFiles } from '../src/lib/songBookProImport';
import { parseChordProMetadata } from '../src/lib/chordPro';
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const archive = (songs: unknown[], version = '1.0') => zipSync({
  'dataFile.txt': strToU8(`${version}\r\n${JSON.stringify({ songs })}`),
  'unused.pdf': strToU8('not a chart'),
});
const song = { type: 1, name: 'Example', author: 'Test Artist', key: 10, KeyShift: 2, content: '[G]Example [C]line', Capo: 2 };
const result = readSongBookProArchive(archive([song, { ...song, Deleted: true }, { type: 2 }, { ...song, content: '' }]), 'example.sbp');
assert(result.charts.length === 1 && result.skipped === 3, 'Only live text charts should be extracted');
const metadata = parseChordProMetadata(result.charts[0].text);
assert(metadata.title === 'Example' && metadata.artist === 'Test Artist' && metadata.key === 'G', 'Metadata must survive extraction');
assert(result.charts[0].text.includes('[G]Example [C]line') && result.charts[0].text.includes('{capo: 2}'), 'Stored chords and capo must survive without display transposition');
const explicit = readSongBookProArchive(archive([{ ...song, content: '{key: Em}\n[Em]Example' }]), 'explicit.sbp');
assert(parseChordProMetadata(explicit.charts[0].text).key === 'Em', 'Explicit ChordPro keys win');
for (const bytes of [new Uint8Array([1,2,3]), archive([], '2.0'), zipSync({ 'dataFile.txt': strToU8('1.0\ninvalid') }), archive(Array(501).fill(song))]) {
  let failed = false;
  try { readSongBookProArchive(bytes, 'invalid.sbp'); } catch { failed = true; }
  assert(failed, 'Malformed, unsupported and oversized imports must fail');
}
const mixed = await readChartUploadFiles([
  new File([new Uint8Array(archive([song])).buffer], 'EXAMPLE.SBP'),
  new File(['{title: Direct}\n[C]Example'], 'direct.cho'),
]);
assert(mixed.charts.length === 2, 'Mixed file selections remain supported');
let rejected = false;
try { await readChartUploadFiles([new File(['anything'], 'wrong.zip')]); } catch { rejected = true; }
assert(rejected, 'Wrong file types must explain the failure');
