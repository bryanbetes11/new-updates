import { extractLyricsFromChordPro, getEffectiveSongLyrics, getSongLyricsSource, hasReadableSongLyrics } from '../src/lib/songLyrics';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const chart = `{title: Test Song}
{artist: Test Artist}
{c: Verse 1}
[G]Amazing [C]grace
How [D]sweet the sound

{c: Chorus}
[Em]I once was lost`;

expectEqual(
  extractLyricsFromChordPro(chart),
  'Verse 1\nAmazing grace\nHow sweet the sound\n\nChorus\nI once was lost',
  'extracts readable lyrics and section labels without chord symbols or metadata',
);
expectEqual(
  extractLyricsFromChordPro('{c: Intro}\n[G] [C] [D]'),
  '',
  'does not treat a chord-only chart as usable lyrics',
);
expectEqual(
  getEffectiveSongLyrics({ lyrics: ' Saved lyrics ', chordpro_text: chart }),
  'Saved lyrics',
  'prefers saved lyrics over the chart fallback',
);
expectEqual(
  getEffectiveSongLyrics({ lyrics: null, chordpro_text: chart }),
  'Verse 1\nAmazing grace\nHow sweet the sound\n\nChorus\nI once was lost',
  'uses chart lyrics when separate lyrics are unavailable',
);
expectEqual(getSongLyricsSource({ lyrics: 'Words', chordpro_text: chart }), 'saved', 'reports saved lyrics source');
expectEqual(getSongLyricsSource({ lyrics: null, chordpro_text: chart }), 'chart', 'reports chart lyrics source');
expectEqual(getSongLyricsSource({ lyrics: null, chordpro_text: null }), 'missing', 'reports missing lyrics source');
expectEqual(hasReadableSongLyrics('Verse 1\nChorus\nIntro'), false, 'section headings alone are not lyrics');
expectEqual(hasReadableSongLyrics('G C D\nAm F G'), false, 'plain chord rows are not lyrics');
expectEqual(hasReadableSongLyrics('|: C/G D/F# :|\nCmaj7/G  Dsus4/A  |  Am/F'), false, 'slash chords and repeat bars are not lyrics');
expectEqual(hasReadableSongLyrics('Jesus'), true, 'a short real lyric line is enough');
expectEqual(extractLyricsFromChordPro('{c: Verse 1}\n[G] [C]\nLyrics not available'), '', 'chart placeholders do not satisfy the gate');
expectEqual(getSongLyricsSource({ lyrics: 'https://example.com/chart.pdf', chordpro_text: null }), 'missing', 'a PDF link is not machine-readable lyrics');
expectEqual(getSongLyricsSource({ lyrics: 'Verse 1', chordpro_text: chart }), 'chart', 'chart lyrics remain usable when saved field is only a heading');
expectEqual(getSongLyricsSource({ lyrics: null, chordpro_text: '![](chart.png)' }), 'missing', 'an image reference is not lyrics');
