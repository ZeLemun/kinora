import { useQuery } from '@tanstack/react-query';

/**
 * OMDb as a metadata supplement.
 *
 * TMDB is the primary source; OMDb adds the IMDb rating and vote count, which
 * users often trust more, plus a couple of fields TMDB omits. It is keyed on
 * IMDb id, which TMDB hands back in `external_ids`, so the two compose without
 * a second title lookup.
 *
 * OMDb is slow (its free tier rate-limits aggressively) and the rating is a
 * nice-to-have, so this is always best-effort: a failure leaves the TMDB
 * values in place rather than blocking a detail page.
 *
 * The key is read from `.env` — see the note in `tmdb.ts` about what putting
 * it in the bundle does and does not protect.
 */

const BASE = 'https://www.omdbapi.com/';
const KEY = import.meta.env.VITE_OMDB_API_KEY ?? '';

export interface OmdbRatings {
  imdbRating?: number;
  imdbVotes?: number;
  metascore?: number;
  rottenTomatoes?: string;
  rated?: string;
  /** OMDb's own genre list, which uses different names than TMDB's. */
  genres?: string[];
}

export function useOmdbRatings(imdbId: string | undefined) {
  return useQuery({
    queryKey: ['omdb', imdbId],
    queryFn: async (): Promise<OmdbRatings> => {
      if (!KEY || !imdbId) return {};
      const res = await fetch(`${BASE}?i=${encodeURIComponent(imdbId)}&apikey=${KEY}`);
      if (!res.ok) return {};
      const json = await res.json();
      if (json?.Response !== 'True') return {};

      const rt = (json.Ratings ?? []).find(
        (r: any) => r.Source === 'Rotten Tomatoes'
      )?.Value;

      return {
        imdbRating: Number(json.imdbRating) || undefined,
        imdbVotes: Number(String(json.imdbVotes ?? '').replace(/,/g, '')) || undefined,
        metascore: Number(json.Metascore) || undefined,
        rottenTomatoes: rt ?? undefined,
        rated: json.Rated && json.Rated !== 'N/A' ? json.Rated : undefined,
        genres: json.Genre && json.Genre !== 'N/A' ? String(json.Genre).split(', ') : undefined,
      };
    },
    enabled: !!KEY && !!imdbId,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });
}
