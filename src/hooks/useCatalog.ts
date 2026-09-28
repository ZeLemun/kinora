import { useQuery } from '@tanstack/react-query';
import {
  discover,
  fetchGenres,
  fetchRow,
  rememberGenres,
  type DiscoverFilters,
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

export function useDiscover(filters: DiscoverFilters) {
  return useQuery({
    queryKey: ['discover', filters],
    queryFn: () => discover(filters),
    staleTime: 5 * 60_000,
    // Keep the previous page on screen while the next one loads, so the grid
    // doesn't flash empty between pages.
    placeholderData: (prev) => prev,
  });
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
