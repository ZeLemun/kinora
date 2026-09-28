/**
 * RapidAPI 1xAPI — Football Live Streaming API.
 *
 * Free tier: 50 requests/day, returns direct HLS (.m3u8) streams for 50+ leagues.
 * This is the same source the "movie site" uses.
 *
 * Get a free key: https://rapidapi.com/1xapi-rapid-team/api/football-live-streaming-api
 * Store it in .env as VITE_RAPIDAPI_KEY.
 */

const BASE = 'https://football-live-streaming-api.p.rapidapi.com';
const HOST = 'football-live-streaming-api.p.rapidapi.com';

interface RapidStream {
  embedUrl: string;
  originalUrl: string;
  language: string;
  format: 'hls' | 'flv' | 'mp4';
  hd: boolean;
}

interface RapidMatchDetail {
  success: boolean;
  data: {
    match_info: {
      title: string;
      league: string;
      country: string;
      date: string;
      time: string;
      timestamp: number;
      home_team: string;
      away_team: string;
      home_score?: number;
      away_score?: number;
      status: string;
    };
    sources: RapidStream[];
  };
}

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY ?? '';

/**
 * Fetch direct playable streams for a match.
 *
 * The response includes HLS/FLV URLs that can be played via the proxy
 * (or directly if the stream allows CORS).
 */
export async function fetchRapidStreams(matchId: string): Promise<RapidStream[]> {
  if (!RAPIDAPI_KEY) {
    console.warn('RapidAPI key not configured (VITE_RAPIDAPI_KEY)');
    return [];
  }

  try {
    const res = await fetch(`${BASE}/match-detail/${matchId}`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': HOST,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 429) console.warn('RapidAPI quota exhausted');
      return [];
    }

    const json = await res.json() as RapidMatchDetail;
    return (json?.data?.sources ?? [])
      .filter((s) => s.format === 'hls' || s.format === 'flv')
      .map((s) => ({
        embedUrl: s.embedUrl,
        originalUrl: s.originalUrl,
        language: s.language,
        format: s.format,
        hd: s.hd,
      }));
  } catch (err) {
    console.error('RapidAPI fetch error:', err);
    return [];
  }
}

/**
 * Get today's fixtures with stream availability.
 *
 * The 1xAPI paginates 20 matches/page; free tier is 50 req/day.
 * One page = 20 matches = covers a full day's fixtures.
 */
export async function fetchRapidFixtures(date?: string): Promise<{ fixtures: any[]; hasMore: boolean }> {
  if (!RAPIDAPI_KEY) return { fixtures: [], hasMore: false };

  const d = date ?? new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(`${BASE}/fixtures?date=${d}&page=1`, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': HOST,
      },
    });
    if (!res.ok) return { fixtures: [], hasMore: false };
    const json = await res.json();
    return {
      fixtures: (json?.data ?? []).filter((f: any) => f.sources?.length > 0),
      hasMore: (json?.paging?.current_page ?? 1) < (json?.paging?.total_pages ?? 1),
    };
  } catch {
    return { fixtures: [], hasMore: false };
  }
}