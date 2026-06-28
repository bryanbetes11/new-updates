declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

type Context = {
  params: {
    id: string;
  };
};

type SnapshotSong = {
  artist?: string | null;
  category?: string | null;
  title?: string | null;
  youtubeUrl?: string | null;
};

type PublicShareSnapshot = {
  eventDate?: string | null;
  eventId?: string | null;
  eventType?: string | null;
  songs?: SnapshotSong[] | null;
  songLeaderName?: string | null;
  startTime?: string | null;
  title?: string | null;
};

type PublicShareRow = {
  event_id: string;
  snapshot: PublicShareSnapshot;
  token: string;
};

type PreviewSong = {
  artist: string;
  artworkDataUrl?: string | null;
  artworkUrl: string | null;
  category: string;
  title: string;
};

type EventPreview = {
  dateLabel: string;
  description: string;
  detailLine: string;
  eventId: string;
  eventType: string;
  imageUrl: string;
  leaderName: string;
  songs: PreviewSong[];
  timeLabel: string;
  title: string;
};

const fallbackImagePath = '/servesync-logo-latest.png?v=2026-05-10-pwa-update-flow-v2';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getSnapshotFromInlineToken(token: string) {
  if (!token.startsWith('snapshot-')) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(token.slice('snapshot-'.length))) as PublicShareSnapshot;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getEnv(name: string) {
  return Netlify.env.get(name);
}

function getSupabaseConfig() {
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  return url && key ? { key, url } : null;
}

function formatEventDate(dateValue?: string | null) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Manila',
    weekday: 'short',
  }).format(date);
}

function formatEventTime(timeValue?: string | null) {
  if (!timeValue) return '';
  const [hourValue, minuteValue] = timeValue.split(':');
  const hour = Number(hourValue);
  const minute = Number(minuteValue || '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeValue;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getYouTubeThumbnailUrl(url?: string | null) {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }

  return null;
}

function getSearchArtworkUrl(song?: SnapshotSong | null) {
  const title = song?.title?.trim();
  const artist = song?.artist?.trim();
  const searchTerm = [title, artist, 'album cover'].filter(Boolean).join(' ');
  if (!searchTerm) return null;

  const params = new URLSearchParams({
    c: '7',
    h: '630',
    o: '5',
    p: '0',
    pid: '1.7',
    q: searchTerm,
    rs: '1',
    w: '1200',
  });
  return `https://tse.mm.bing.net/th?${params.toString()}`;
}

function getSongArtworkUrl(song?: SnapshotSong | null) {
  return getYouTubeThumbnailUrl(song?.youtubeUrl)
    || getSearchArtworkUrl(song);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fetchImageDataUrl(url?: string | null) {
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'ServeSyncSharePreview/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 650_000) return null;

    return `data:${contentType.split(';')[0]};base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function withEmbeddedArtwork(songs: PreviewSong[]) {
  const hydrated = await Promise.all(
    songs.slice(0, 6).map(async song => ({
      ...song,
      artworkDataUrl: await fetchImageDataUrl(song.artworkUrl),
    })),
  );

  return songs.map((song, index) => hydrated[index] || song);
}

async function getPublicShare(token: string, config: { key: string; url: string }) {
  const response = await fetch(`${config.url}/rest/v1/rpc/get_public_event_share`, {
    body: JSON.stringify({ p_token: token }),
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) return null;
  const data = await response.json() as PublicShareRow[];
  return data[0] || null;
}

async function getEventPreview(token: string, origin: string) {
  const inlineSnapshot = getSnapshotFromInlineToken(token);
  const config = inlineSnapshot ? null : getSupabaseConfig();
  const share = config ? await getPublicShare(token, config) : null;
  const snapshot = inlineSnapshot || share?.snapshot || {};
  if (!inlineSnapshot && !share) return null;
  const rawSongs = Array.isArray(snapshot.songs) ? snapshot.songs : [];
  const previewSongs = rawSongs
    .filter(song => song?.title)
    .slice(0, 6)
    .map(song => ({
      artist: song.artist || '',
      artworkUrl: getSongArtworkUrl(song),
      category: song.category || '',
      title: song.title || '',
    }));
  const imageUrl = previewSongs[0]?.artworkUrl || `${origin}${fallbackImagePath}`;
  const dateLabel = formatEventDate(snapshot.eventDate);
  const timeLabel = formatEventTime(snapshot.startTime);
  const leaderName = snapshot.songLeaderName || '';
  const eventType = snapshot.eventType || '';
  const detailLine = [eventType, leaderName, dateLabel, timeLabel].filter(Boolean).join(' - ');
  const songLine = previewSongs.length > 0
    ? previewSongs.slice(0, 6).map(song => song.title).filter(Boolean).join(' - ')
    : '';

  return {
    dateLabel,
    description: [detailLine, songLine].filter(Boolean).join(' | '),
    detailLine,
    eventId: snapshot.eventId || share?.event_id || '',
    eventType,
    imageUrl,
    leaderName,
    songs: previewSongs,
    timeLabel,
    title: snapshot.title || 'ServeSync Event',
  } satisfies EventPreview;
}

function renderArtworkTile(song: PreviewSong | undefined, index: number, x: number, y: number, width: number, height = width) {
  const fallbackColors = [
    ['#34d399', '#052e22'],
    ['#a78bfa', '#111827'],
    ['#38bdf8', '#082f49'],
    ['#fb7185', '#2e1018'],
    ['#facc15', '#271a07'],
    ['#f472b6', '#2e1024'],
  ][index % 6];
  const textScale = Math.min(width, height);
  const titleSize = Math.max(21, Math.round(textScale * 0.095));
  const artistSize = Math.max(15, Math.round(textScale * 0.062));
  const titleLength = width < 430 ? 24 : 34;
  const safeTitle = escapeHtml(truncateText(song?.title || 'ServeSync', titleLength));
  const safeArtist = escapeHtml(truncateText(song?.artist || song?.category || 'Worship', titleLength));
  const safeArtworkUrl = song?.artworkDataUrl || song?.artworkUrl ? escapeHtml(song?.artworkDataUrl || song?.artworkUrl || '') : null;

  return `<g clip-path="url(#tile-${index})">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fallbackColors[1]}" />
    <linearGradient id="tile-fallback-${index}" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${fallbackColors[0]}" />
      <stop offset="1" stop-color="${fallbackColors[1]}" />
    </linearGradient>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#tile-fallback-${index})" />
    ${safeArtworkUrl ? `<image href="${safeArtworkUrl}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />` : ''}
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#tile-shade)" />
    <text x="${x + 22}" y="${y + height - 46}" fill="#ffffff" font-size="${titleSize}" font-weight="850" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
    <text x="${x + 22}" y="${y + height - 19}" fill="#d6fff0" font-size="${artistSize}" font-weight="700" font-family="Inter, Arial, sans-serif">${safeArtist}</text>
  </g>`;
}

function renderSongRow(song: PreviewSong | undefined, index: number, x: number, y: number) {
  const safeTitle = escapeHtml(truncateText(song?.title || `Song ${index + 1}`, 31));
  const safeMeta = escapeHtml(truncateText([song?.artist, song?.category].filter(Boolean).join(' - ') || 'Worship', 38));
  const safeKey = escapeHtml(String(index + 1));
  const safeArtworkUrl = song?.artworkUrl ? escapeHtml(song.artworkUrl) : null;

  return `<g>
    <rect x="${x}" y="${y}" width="414" height="58" rx="15" fill="#ffffff" fill-opacity="0.085" stroke="#ffffff" stroke-opacity="0.105" />
    <clipPath id="row-art-${index}"><rect x="${x + 10}" y="${y + 10}" width="38" height="38" rx="10" /></clipPath>
    <rect x="${x + 10}" y="${y + 10}" width="38" height="38" rx="10" fill="#18c985" />
    ${safeArtworkUrl ? `<image href="${safeArtworkUrl}" x="${x + 10}" y="${y + 10}" width="38" height="38" preserveAspectRatio="xMidYMid slice" clip-path="url(#row-art-${index})" />` : ''}
    <rect x="${x + 10}" y="${y + 10}" width="38" height="38" rx="10" fill="#18c985" fill-opacity="0.35" />
    <text x="${x + 29}" y="${y + 35}" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="900" font-family="Inter, Arial, sans-serif">${safeKey}</text>
    <text x="${x + 62}" y="${y + 28}" fill="#ffffff" font-size="21" font-weight="850" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
    <text x="${x + 62}" y="${y + 48}" fill="#a7b1ad" font-size="15" font-weight="650" font-family="Inter, Arial, sans-serif">${safeMeta}</text>
  </g>`;
}

async function renderPreviewImageSvg(preview: EventPreview | null, origin: string) {
  const fallbackPreview: EventPreview = {
    dateLabel: '',
    description: 'Open the event setlist, assignments, and team details in ServeSync.',
    detailLine: 'Open in ServeSync',
    eventId: '',
    eventType: 'Event',
    imageUrl: `${origin}${fallbackImagePath}`,
    leaderName: '',
    songs: [],
    timeLabel: '',
    title: 'ServeSync Event',
  };
  const data = preview || fallbackPreview;
  const artworkSongs = await withEmbeddedArtwork(data.songs.length > 0
    ? data.songs
    : [{ artist: 'ServeSync', artworkUrl: data.imageUrl, category: 'Worship', title: data.title }]);
  const safeTitle = escapeHtml(truncateText(data.title, 25));
  const safeDetailLine = escapeHtml(truncateText(data.detailLine || data.description, 62));
  const safeSongCount = escapeHtml(`${data.songs.length || artworkSongs.length} songs`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#18251e" />
      <stop offset="0.45" stop-color="#070908" />
      <stop offset="1" stop-color="#050505" />
    </linearGradient>
    <radialGradient id="glow" cx="58%" cy="10%" r="70%">
      <stop offset="0" stop-color="#25e39b" stop-opacity="0.28" />
      <stop offset="0.55" stop-color="#25e39b" stop-opacity="0.04" />
      <stop offset="1" stop-color="#25e39b" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tile-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="0.52" stop-color="#000000" stop-opacity="0.08" />
      <stop offset="1" stop-color="#000000" stop-opacity="0.68" />
    </linearGradient>
    <linearGradient id="detail-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111513" />
      <stop offset="0.45" stop-color="#07140f" />
      <stop offset="1" stop-color="#050505" />
    </linearGradient>
    <clipPath id="frame-clip"><rect x="0" y="0" width="1200" height="630" rx="38" /></clipPath>
    <clipPath id="tile-0"><rect x="0" y="0" width="400" height="245" /></clipPath>
    <clipPath id="tile-1"><rect x="400" y="0" width="400" height="245" /></clipPath>
    <clipPath id="tile-2"><rect x="800" y="0" width="400" height="245" /></clipPath>
    <clipPath id="tile-3"><rect x="0" y="245" width="400" height="245" /></clipPath>
    <clipPath id="tile-4"><rect x="400" y="245" width="400" height="245" /></clipPath>
    <clipPath id="tile-5"><rect x="800" y="245" width="400" height="245" /></clipPath>
  </defs>
  <g clip-path="url(#frame-clip)">
    <rect width="1200" height="630" fill="url(#bg)" />
    <rect width="1200" height="630" fill="url(#glow)" />
    ${renderArtworkTile(artworkSongs[0], 0, 0, 0, 400, 245)}
    ${renderArtworkTile(artworkSongs[1] || artworkSongs[0], 1, 400, 0, 400, 245)}
    ${renderArtworkTile(artworkSongs[2] || artworkSongs[0], 2, 800, 0, 400, 245)}
    ${renderArtworkTile(artworkSongs[3] || artworkSongs[0], 3, 0, 245, 400, 245)}
    ${renderArtworkTile(artworkSongs[4] || artworkSongs[1] || artworkSongs[0], 4, 400, 245, 400, 245)}
    ${renderArtworkTile(artworkSongs[5] || artworkSongs[2] || artworkSongs[0], 5, 800, 245, 400, 245)}
    <rect x="0" y="490" width="1200" height="140" fill="url(#detail-bg)" />
    <rect x="0" y="489" width="1200" height="1" fill="#ffffff" opacity="0.14" />
    <text x="46" y="545" fill="#ffffff" font-size="46" font-weight="950" font-family="Inter, Arial, sans-serif">${safeTitle}</text>
    <text x="46" y="587" fill="#48e6a0" font-size="25" font-weight="800" font-family="Inter, Arial, sans-serif">${safeDetailLine}</text>
    <text x="1010" y="545" text-anchor="end" fill="#63f2b3" font-size="23" font-weight="900" font-family="Inter, Arial, sans-serif">${safeSongCount}</text>
    <text x="1010" y="587" text-anchor="end" fill="#6e7773" font-size="23" font-weight="700" font-family="Inter, Arial, sans-serif">mcjcworship.org</text>
  </g>
</svg>`;
}

function renderPreviewHtml({
  appUrl,
  description,
  imageUrl,
  shareUrl,
  title,
}: {
  appUrl: string;
  description: string;
  imageUrl: string;
  shareUrl: string;
  title: string;
}) {
  const pageTitle = `ServeSync - ${title}`;
  const safeTitle = escapeHtml(pageTitle);
  const safeDescription = escapeHtml(description || 'Open this event in ServeSync.');
  const safeImageUrl = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeAppUrl = escapeHtml(appUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeShareUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ServeSync" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:secure_url" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(560px, calc(100vw - 32px)); }
      img { display: block; width: 100%; aspect-ratio: 1.91 / 1; object-fit: cover; border-radius: 16px; background: #111; }
      h1 { margin: 18px 0 8px; font-size: 28px; line-height: 1.05; }
      p { margin: 0 0 20px; color: #c9c9c9; line-height: 1.45; }
      a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border-radius: 999px; background: #18c985; color: #04140e; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <img src="${safeImageUrl}" alt="" />
      <h1>${escapeHtml(title)}</h1>
      <p>${safeDescription}</p>
      <a href="${safeAppUrl}">Open in ServeSync</a>
    </main>
  </body>
</html>`;
}

export default async (req: Request, context: Context) => {
  const token = context.params.id;
  const requestUrl = new URL(req.url);
  const origin = requestUrl.origin;
  const shareBaseUrl = `${origin}/share/events/${encodeURIComponent(token)}`;
  const previewVersion = requestUrl.searchParams.get('preview') || 'six-song-grid-v4';
  const previewQuery = `preview=${encodeURIComponent(previewVersion)}`;
  const shareUrl = `${shareBaseUrl}?${previewQuery}`;
  const preview = await getEventPreview(token, origin).catch(() => null);
  const appUrl = preview?.eventId
    ? `${origin}/events/${encodeURIComponent(preview.eventId)}`
    : `${origin}/login`;

  if (requestUrl.pathname.endsWith('/image')) {
    return new Response(await renderPreviewImageSvg(preview, origin), {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
    });
  }

  const html = renderPreviewHtml({
    appUrl,
    description: preview?.description || 'Open the event setlist, assignments, and team details in ServeSync.',
    imageUrl: `${shareBaseUrl}/image?${previewQuery}`,
    shareUrl,
    title: preview?.title || 'ServeSync Event',
  });

  return new Response(html, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
};

export const config = {
  path: ['/share/events/:id', '/share/events/:id/image'],
};
