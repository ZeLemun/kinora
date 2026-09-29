import { useQuery } from '@tanstack/react-query';
import {
  fetchGenres,
  fetchRow,
  rememberGenres,
  type RowKey,
} from '../services/catalog';
import type { Media, MediaType } from '../store/app-store';

/** One TMDB row. Rows are large, stable lists, so they cache for a while. */
export function useRow(key: RowKey, page = 1) {
  return useQuery({
    queryKey: ['row', key, page],
    queryFn: () => fetchRow(key, page),
    staleTime: 10 * 60_000,
  });
}

/** Home page loads several rows; each is a separate cached query. */
export function useRows(keys: RowKey[]) {
  const queries = keys.map((key) => useRow(key));
  return {
    // `as const` keeps the tuple length tied to the input, so callers can zip.
    data: keys.map((_, i) => queries[i].data ?? []) as Media[][],
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

export function useGenres(type: MediaType) {
  return useQuery({
    queryKey: ['genres', type],
    queryFn: async () => {
      const genres = await fetchGenres(type);
      rememberGenres(type, genres);
      return genres;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
