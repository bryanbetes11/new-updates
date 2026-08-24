export interface MentionRange {
  start: number;
  end: number;
}

export function findMentionImmediatelyBeforeCursor(
  text: string,
  cursor: number,
  mentionHandles: string[],
): MentionRange | null {
  const beforeCursor = text.slice(0, cursor);
  const normalizedHandles = mentionHandles
    .map(handle => handle.trim().replace(/^@/, ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const handle of normalizedHandles) {
    const mention = `@${handle}`;
    if (!beforeCursor.toLowerCase().endsWith(mention.toLowerCase())) continue;

    const start = cursor - mention.length;
    const precedingCharacter = text[start - 1];
    if (start === 0 || /\s/.test(precedingCharacter)) {
      return { start, end: cursor };
    }
  }

  return null;
}
