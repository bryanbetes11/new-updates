import { strFromU8, unzipSync } from 'fflate';

export interface ImportedChartFile { name: string; text: string }
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SONGS = 500;
const cleanMetadata = (value: unknown) => typeof value === 'string'
  ? value.replace(/[{}\r\n]/g, ' ').trim() : '';

/** Read SongbookPro 1.0 sharing archives, never executing embedded content. */
export function readSongBookProArchive(bytes: Uint8Array, fileName: string) {
  if (bytes.length > MAX_BYTES) throw new Error('SongBookPro files must be 20 MB or smaller.');
  let data: Uint8Array | undefined;
  try {
    const entries = unzipSync(bytes, { filter: entry => {
      if (entry.name !== 'dataFile.txt') return false;
      if (entry.originalSize > MAX_BYTES) throw new Error('Archive data is too large.');
      return true;
    } });
    data = entries['dataFile.txt'];
  } catch {
    throw new Error(`${fileName}: cannot read this SongBookPro archive. It may be damaged or too large.`);
  }
  if (!data || data.length > MAX_BYTES) throw new Error(`${fileName}: missing or oversized SongBookPro song data.`);
  const text = strFromU8(data).replace(/^\uFEFF/, '');
  const boundary = text.indexOf('\n');
  if (boundary < 0 || text.slice(0, boundary).trim() !== '1.0') {
    throw new Error(`${fileName}: unsupported SongBookPro format. Export .cho charts instead.`);
  }
  let document: { songs?: unknown };
  try { document = JSON.parse(text.slice(boundary + 1)); }
  catch { throw new Error(`${fileName}: the song data is not valid JSON.`); }
  if (!document || !Array.isArray(document.songs)) throw new Error(`${fileName}: no song list found.`);
  if (document.songs.length > MAX_SONGS) throw new Error('Please import no more than 500 songs at a time.');
  const charts: ImportedChartFile[] = [];
  let skipped = 0;
  for (const value of document.songs) {
    if (!value || typeof value !== 'object') { skipped++; continue; }
    const song = value as Record<string, unknown>;
    if (song.Deleted || song.type !== 1 || typeof song.content !== 'string' || !song.content.trim()) {
      skipped++; continue;
    }
    const title = cleanMetadata(song.name) || 'Untitled Song';
    const artist = cleanMetadata(song.author);
    // SongbookPro stores base keys chromatically from A. Keep the source
    // chart key, not KeyShift or per-set keyOfset (display transpositions).
    const keys = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];
    const key = typeof song.key === 'number' && Number.isInteger(song.key) ? keys[song.key] : undefined;
    const headers = [`{title: ${title}}`];
    if (artist) headers.push(`{artist: ${artist}}`);
    if (key && !/\{(?:key|k)\s*:/i.test(song.content)) headers.push(`{key: ${key}}`);
    if (Number.isInteger(song.Capo) && Number(song.Capo) > 0 && Number(song.Capo) <= 12
      && !/\{capo\s*:/i.test(song.content)) headers.push(`{capo: ${song.Capo}}`);
    charts.push({ name: `${fileName}/${title}.cho`, text: `${headers.join('\n')}\n${song.content}` });
  }
  return { charts, skipped };
}

export async function readChartUploadFiles(files: File[]) {
  const charts: ImportedChartFile[] = [];
  let skipped = 0;
  if (files.reduce((size, file) => size + file.size, 0) > MAX_BYTES) throw new Error('Select up to 20 MB of chart files at a time.');
  for (const file of files) {
    if (/\.sbp$/i.test(file.name)) {
      const result = readSongBookProArchive(new Uint8Array(await file.arrayBuffer()), file.name);
      charts.push(...result.charts);
      skipped += result.skipped;
    } else if (/\.cho$/i.test(file.name)) {
      const text = await file.text();
      if (text.trim()) charts.push({ name: file.name, text });
      else skipped++;
    } else throw new Error(`${file.name}: choose .cho or .sbp files.`);
    if (charts.length > MAX_SONGS || charts.reduce((size, chart) => size + chart.text.length, 0) > MAX_BYTES) {
      throw new Error('This selection is too large. Import up to 500 songs / 20 MB at a time.');
    }
  }
  return { charts, skipped };
}
