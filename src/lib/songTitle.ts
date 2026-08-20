export const sanitizeSongTitle = (title: string): string => title
  .replace(/(Bro\.?|Sis\.?|Brother|Sister)\s*/gi, '')
  .replace(/\bSTand\b/g, 'Stand')
  .replace(/\bKatapaTan\b/g, 'Katapatan')
  .replace(/\bKatapan\b/g, 'Katapatan')
  .replace(/\bItaTanghal\b/g, 'Itatanghal')
  .replace(/\bIStand\b/g, 'I Stand')
  .replace(/\bIn Awe\b/g, 'in Awe')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizeSongTitle = (title: string): string => sanitizeSongTitle(title)
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();
