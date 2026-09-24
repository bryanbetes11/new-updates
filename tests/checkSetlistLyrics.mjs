// Isolated Edge Function handler test: no network, database writes, or real reports.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = (await readFile(new URL('../supabase/functions/check-setlist/index.ts', import.meta.url), 'utf8'))
  .replace(/^import "jsr:@supabase\/functions-js\/edge-runtime\.d\.ts";\s*/m, '');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

let handler;
let lyricsResponse = () => new Response(JSON.stringify({ error: 'No lyrics found' }), { status: 404 });
const calls = [];
const mockFetch = async url => {
  calls.push(String(url));
  return lyricsResponse(String(url));
};
new Function('Deno', 'fetch', compiled)({ serve: callback => { handler = callback; } }, mockFetch);
assert.equal(typeof handler, 'function');

const song = (title, lyrics) => ({ title, artist: 'Artist', slot: 'Worship', lyrics });
const check = async songs => {
  const response = await handler(new Request('http://localhost/check-setlist', {
    method: 'POST',
    body: JSON.stringify({ theme: 'Grace', language: 'english', songs }),
  }));
  return { status: response.status, body: await response.json() };
};

let result = await check([song('Missing One'), song('Missing Two')]);
assert.equal(result.status, 400);
assert.match(result.body.error, /Missing One.*Missing Two/);
assert.equal(result.body.report, undefined, 'a missing song prevents a partial or approving report');
assert.equal(calls.length, 2, 'the existing lyrics.ovh fallback is attempted for each missing song');

calls.length = 0;
result = await check([
  song('Placeholder', '[Lyrics for "Placeholder" by Artist could not be automatically retrieved. Please add them manually.]'),
  song('Chords', 'G C D\n|: C/G D/F# Cmaj7/G :|\nAm F G'),
  song('Resource', 'https://example.com/chart.pdf'),
  song('Headings', 'Verse 1\nChorus'),
]);
assert.equal(result.status, 400);
for (const title of ['Placeholder', 'Chords', 'Resource', 'Headings']) {
  assert.ok(result.body.error.includes(title), `${title} must be named as missing`);
}
assert.equal(calls.length, 4, 'unreadable supplied content also gets the lyrics fallback');

calls.length = 0;
result = await check([song('Saved Lyrics', 'Jesus is my hope and my song.')]);
assert.equal(result.status, 200);
assert.ok(result.body.report);
assert.equal(result.body.report.songsWithLyrics[0].lyricsSource, 'provided');
assert.equal(calls.length, 0, 'readable saved or chart-extracted lyrics need no lookup');

lyricsResponse = () => new Response(JSON.stringify({ lyrics: 'Lyrics not available' }), { status: 200 });
result = await check([song('Fallback Placeholder')]);
assert.equal(result.status, 400);
assert.match(result.body.error, /Fallback Placeholder/);
assert.equal(result.body.report, undefined);

lyricsResponse = () => new Response(JSON.stringify({ lyrics: 'Jesus is my hope and my song.' }), { status: 200 });
result = await check([song('Fetched Lyrics')]);
assert.equal(result.status, 200);
assert.equal(result.body.report.songsWithLyrics[0].lyricsSource, 'fetched');

result = await check([]);
assert.equal(result.status, 400);
assert.equal(result.body.report, undefined);

console.log('PASS check-setlist lyrics: missing and unreadable blocked after fallback, readable provided/fetched accepted');
