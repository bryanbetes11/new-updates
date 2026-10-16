/** Keep existing anchors on the first pass, and isolate notes on later repeats. */
export function withChartNoteOccurrences<T extends { key: string; label: string }>(sections: readonly T[]) {
  const counts = new Map<string, number>();
  return sections.map(section => {
    const occurrence = (counts.get(section.key) || 0) + 1;
    counts.set(section.key, occurrence);
    return {
      ...section,
      noteKey: occurrence === 1 ? section.key : `${section.key}:repeat:${occurrence}`,
      noteLabel: occurrence === 1 ? section.label : `${section.label} · repeat ${occurrence}`,
    };
  });
}
