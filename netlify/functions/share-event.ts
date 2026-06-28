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

type EventRow = {
  event_date?: string | null;
  event_type?: string | null;
  id: string;
  song_leader_id?: string | null;
  start_time?: string | null;
  title?: string | null;
};

type ProfileRow = {
  first_name?: string | null;
  id: string;
  last_name?: string | null;
  nickname?: string | null;
};

type SetlistSongRow = {
  position?: number | null;
  song_category?: string | null;
  songs?: {
    artist?: string | null;
    title?: string | null;
    youtube_url?: string | null;
  } | null;
  youtube_url?: string | null;
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

function getEnv(name: string) {
  return Netlify.env.get(name);
}

function getSupabaseConfig() {
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  return url && key ? { key, url } : null;
}

function isPreviewBot(userAgent: string) {
  return /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|whatsapp|telegrambot|linkedinbot|discordbot|slackbot|skypeuripreview|pinterest/i.test(userAgent);
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

function getLeaderName(profile?: ProfileRow | null) {
  if (!profile) return '';
  return profile.nickname || [profile.first_name, profile.last_name].filter(Boolean).join(' ');
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

function getSearchArtworkUrl(song?: SetlistSongRow | null) {
  const title = song?.songs?.title?.trim();
  const artist = song?.songs?.artist?.trim();
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

async function supabaseGet<T>(path: string, params: URLSearchParams, config: { key: string; url: string }) {
  const response = await fetch(`${config.url}/rest/v1/${path}?${params.toString()}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  if (!response.ok) return null;
  return await response.json() as T;
}

async function getEventPreview(eventId: string, origin: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const eventParams = new URLSearchParams({
    id: `eq.${eventId}`,
    limit: '1',
    select: 'id,title,event_date,start_time,event_type,song_leader_id',
  });
  const events = await supabaseGet<EventRow[]>('events', eventParams, config);
  const event = events?.[0];
  if (!event) return null;

  const setlistParams = new URLSearchParams({
    event_id: `eq.${eventId}`,
    limit: '1',
    select: 'setlist_songs(position,song_category,youtube_url,songs(title,artist,youtube_url))',
  });
  const setlists = await supabaseGet<Array<{ setlist_songs?: SetlistSongRow[] | null }>>('setlists', setlistParams, config);
  const songs = (setlists?.[0]?.setlist_songs || [])
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  let leaderName = '';
  if (event.song_leader_id) {
    const profileParams = new URLSearchParams({
      id: `eq.${event.song_leader_id}`,
      limit: '1',
      select: 'id,first_name,last_name,nickname',
    });
    const profiles = await supabaseGet<ProfileRow[]>('profiles', profileParams, config);
    leaderName = getLeaderName(profiles?.[0]);
  }

  const firstSong = songs.find(song => song.songs?.title);
  const imageUrl = getYouTubeThumbnailUrl(firstSong?.youtube_url || firstSong?.songs?.youtube_url)
    || getSearchArtworkUrl(firstSong)
    || `${origin}${fallbackImagePath}`;
  const dateLabel = formatEventDate(event.event_date);
  const timeLabel = formatEventTime(event.start_time);
  const detailLine = [event.event_type, leaderName, dateLabel, timeLabel].filter(Boolean).join(' - ');
  const songLine = songs.length > 0
    ? songs.slice(0, 4).map(song => song.songs?.title).filter(Boolean).join(' • ')
    : '';

  return {
    description: [detailLine, songLine].filter(Boolean).join(' | '),
    imageUrl,
    title: event.title || 'ServeSync Event',
  };
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
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050505; color: white; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(420px, calc(100vw - 32px)); }
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
  const eventId = context.params.id;
  const requestUrl = new URL(req.url);
  const origin = requestUrl.origin;
  const appUrl = `${origin}/events/${encodeURIComponent(eventId)}`;
  const shareUrl = `${origin}/share/events/${encodeURIComponent(eventId)}`;

  if (!isPreviewBot(req.headers.get('user-agent') || '')) {
    return Response.redirect(appUrl, 302);
  }

  const preview = await getEventPreview(eventId, origin).catch(() => null);
  const html = renderPreviewHtml({
    appUrl,
    description: preview?.description || 'Open the event setlist, assignments, and team details in ServeSync.',
    imageUrl: preview?.imageUrl || `${origin}${fallbackImagePath}`,
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
  path: '/share/events/:id',
};
