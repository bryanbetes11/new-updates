import { normalizeSongTitle, sanitizeSongTitle } from '../src/lib/songTitle';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(sanitizeSongTitle('  Bro. Give   Thanks  '), 'Give Thanks', 'cleans display titles');
expectEqual(normalizeSongTitle('Give Thanks'), normalizeSongTitle('give-thanks'), 'ignores case and punctuation for duplicate matching');
expectEqual(normalizeSongTitle('Aawit, Sasayaw'), normalizeSongTitle('Aawit Sasayaw'), 'matches comma variants');
expectEqual(normalizeSongTitle('Give Thanks'), 'givethanks', 'creates a stable normalized title');
