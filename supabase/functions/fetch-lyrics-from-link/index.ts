import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FetchLyricsPayload {
  title?: string;
  artist?: string;
}

interface LyricsResult {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  source: string;
  lyrics: string;
}

const PROVIDER_TIMEOUT_MS = 6500;

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchLrclib(title: string, artist?: string): Promise<LyricsResult[]> {
  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("track_name", title);
  if (artist?.trim()) {
    url.searchParams.set("artist_name", artist.trim());
  }

  let data: unknown;
  try {
    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        "User-Agent": "ServeSyncLyricsFinder/1.0",
        "Accept": "application/json",
      },
    });

    if (!response.ok) return [];
    data = await response.json();
  } catch (error) {
    console.warn("LRCLIB lyrics lookup failed:", error);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data
    .filter((item) => typeof item?.plainLyrics === "string" && item.plainLyrics.trim())
    .slice(0, 8)
    .map((item, index) => ({
      id: item.id ? String(item.id) : `lrclib-${index}`,
      title: item.trackName || title,
      artist: item.artistName || artist || "Unknown artist",
      album: item.albumName || null,
      duration: typeof item.duration === "number" ? item.duration : null,
      source: "LRCLIB",
      lyrics: normalizeWhitespace(item.plainLyrics),
    }));
}

async function searchLyricsOvh(title: string, artist: string): Promise<LyricsResult[]> {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  let data: { lyrics?: unknown };
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) return [];
    data = await response.json() as { lyrics?: unknown };
  } catch (error) {
    console.warn("lyrics.ovh lyrics lookup failed:", error);
    return [];
  }

  if (typeof data?.lyrics !== "string" || !data.lyrics.trim()) return [];

  return [{
    id: `lyricsovh-${title}-${artist}`,
    title,
    artist,
    album: null,
    duration: null,
    source: "lyrics.ovh",
    lyrics: normalizeWhitespace(data.lyrics),
  }];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { title, artist }: FetchLyricsPayload = await req.json();
    const normalizedTitle = title?.trim();
    const normalizedArtist = artist?.trim();

    if (!normalizedTitle) {
      return new Response(JSON.stringify({ error: "song title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lrclibResults = await searchLrclib(normalizedTitle, normalizedArtist);
    if (lrclibResults.length === 0 && normalizedArtist) {
      lrclibResults = await searchLrclib(normalizedTitle);
    }

    if (lrclibResults.length > 0) {
      return new Response(JSON.stringify({ results: lrclibResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (normalizedArtist) {
      const lyricsOvhResults = await searchLyricsOvh(normalizedTitle, normalizedArtist);
      if (lyricsOvhResults.length > 0) {
        return new Response(JSON.stringify({ results: lyricsOvhResults }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "No lyrics found for this song", results: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
