const GUIDE_MARKER = 'Guide attached for this setlist:';

export function splitSetlistGuideNote(text: string) {
  const marker = text.indexOf(GUIDE_MARKER);
  if (marker < 0) return { note: text, sections: [] as { title: string; text: string }[] };
  const attachment = text.slice(marker + GUIDE_MARKER.length).trim();
  const sections: { title: string; text: string }[] = [];
  for (const line of attachment.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s+([^:]+):\s*(.*)$/);
    if (match) sections.push({ title: match[1].trim(), text: match[2] });
    else if (sections.length) sections[sections.length - 1].text += '\n' + line;
    else if (line.trim()) return { note: text, sections: [] }; // Preserve unfamiliar saved formats.
  }
  return sections.length ? { note: text.slice(0, marker).trimEnd(), sections } : { note: text, sections };
}
