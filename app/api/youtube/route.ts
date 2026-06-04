import { NextRequest, NextResponse } from 'next/server';

// yt-search does not ship ESM types; use require for CJS compat
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yts = require('yt-search');

/* ── Simple in-memory cache (1-hour TTL) ── */
interface CacheEntry {
  results: YouTubeResult[];
  ts: number;
}

interface YouTubeResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
  duration: string;
  views: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/youtube?q=Newton's+second+law+explained
 *
 * Scrapes YouTube search results via yt-search (no API key needed).
 * Returns top 3 video results as JSON.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Missing ?q= query parameter' }, { status: 400 });
  }

  const cacheKey = q.trim().toLowerCase();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.results);
  }

  try {
    const searchResults = await yts(q.trim());
    const videos: YouTubeResult[] = (searchResults.videos || [])
      .slice(0, 3)
      .map((v: any) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
        channelTitle: v.author?.name || v.author || 'Unknown',
        url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
        duration: v.timestamp || '',
        views: v.views || 0,
      }));

    // Store in cache
    cache.set(cacheKey, { results: videos, ts: Date.now() });

    return NextResponse.json(videos);
  } catch (err: any) {
    console.error('[YouTube Scrape Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube results', detail: err.message },
      { status: 502 }
    );
  }
}
