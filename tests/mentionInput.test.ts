import { findMentionImmediatelyBeforeCursor } from '../src/lib/mentionInput';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const handle = ['Fiona_Leones'];

expectEqual(
  findMentionImmediatelyBeforeCursor('@Fiona_Leones', 13, handle),
  { start: 0, end: 13 },
  'matches the exact mention token',
);
expectEqual(
  findMentionImmediatelyBeforeCursor('@Fiona_Leones hello', 19, handle),
  null,
  'does not treat typed reply text as part of the mention',
);
expectEqual(
  findMentionImmediatelyBeforeCursor('@Fiona_Leones hello', 18, handle),
  null,
  'ordinary reply text remains character editable while backspacing',
);
expectEqual(
  findMentionImmediatelyBeforeCursor('Reply to @Fiona_Leones', 22, handle),
  { start: 9, end: 22 },
  'matches a known mention after a word boundary',
);
expectEqual(
  findMentionImmediatelyBeforeCursor('email@Fiona_Leones', 18, handle),
  null,
  'does not match a handle embedded in another token',
);
