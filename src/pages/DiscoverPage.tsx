import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { discover } from '../services/catalog';
import { useGenres } from '../hooks/useCatalog';
import { ListItem, PosterGrid } from '../components/MediaCard';
import { EmptyState, SkeletonCard } from '../components/ui';
import { cn } from '../utils/cn';
import type { MediaType } from '../store/app-store';

type SortKey =
  | 'trending'
  | 'popularMovies'
  | 'topRatedMovies'
  | 'upcomingMovies'
  | 'nowPlaying'
  | 'popularSeries'
  | 'topRatedSeries'
  | 'recent';

const SORTS: { key: SortKey; label: string; type: MediaType; sortBy: string }[] = [
  { key: 'trending', label: 'Trending', type: 'movie', sortBy: 'popularity.desc' },
  { key: 'popularMovies', label: 'Popular Movies', type: 'movie', sortBy: 'popularity.desc' },
  { key: 'topRatedMovies', label: 'Top Rated Movies', type: 'movie', sortBy: 'vote_average.desc' },
  { key: 'nowPlaying', label: 'In Cinemas', type: 'movie', sortBy: 'primary_release_date.desc' },
  { key: 'upcomingMovies', label: 'Coming Soon', type: 'movie', sortBy: 'primary_release_date.asc' },
  { key: 'popularSeries', label: 'Popular Series', type: 'series', sortBy: 'popularity.desc' },
  { key: 'topRatedSeries', label: 'Acclaimed Series', type: 'series', sortBy: 'vote_average.desc' },
  { key: 'recent', label: 'New This Week', type: 'series', sortBy: 'first_air_date.desc' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();

  const sortKey = (params.get('sort') as SortKey) ?? 'trending';
  const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0];
  const type: MediaType = (params.get('type') as MediaType) ?? sort.type;
  const genreId = params.get('genre') ? Number(params.get('genre')) : undefined;
  const year = params.get('year') ? Number(params.get('year')) : undefined;

  const [grid, setGrid] = useState<'grid' | 'list'>('grid');

  const genres = useGenres(type);

  const query = useInfiniteQuery({
    queryKey: ['discover', sortKey, type, genreId, year],
    queryFn: ({ pageParam = 1 }) =>
      discover({ type, genreId, sortBy: sort.sortBy, year, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length * 20 < (last.total ?? 0) ? pages.length + 1 : undefined,
    staleTime: 5 * 60_000,
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.results),
    [query.data]
  );
  const total = query.data?.pages?.[0]?.total ?? 0;

  const patch = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => {
      if (v === null) merged.delete(k);
      else merged.set(k, v);
    });
    setParams(merged, { replace: true });
  };

  const activeGenres = genres.data ?? [];

  return (
    <div className="pb-10">
      <header className="px-4 pb-4 pt-5 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-text-muted">
          {total > 0 ? `${total.toLocaleString()} titles` : 'Browse everything'}
        </p>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-30 -mx-0 border-y border-line bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
        {/* Sort */}
        <div className="rail rail-bleed fade-edges mb-2.5">
          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => patch({ sort: s.key, type: s.type })}
                className={cn(
                  'flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  sortKey === s.key
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-card text-text-secondary hover:bg-elevated hover:text-text'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type + genre + year + layout */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full flex-none gap-1 rounded-lg bg-card p-1 sm:w-auto">
            {(['movie', 'series'] as MediaType[]).map((t) => (
              <button
                key={t}
                onClick={() => patch({ type: t })}
                aria-pressed={type === t}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none',
                  type === t ? 'bg-elevated text-text' : 'text-text-muted hover:text-text'
                )}
              >
                {t === 'movie' ? 'Movies' : 'Series'}
              </button>
            ))}
          </div>

          <select
            value={genreId ?? ''}
            onChange={(e) => patch({ genre: e.target.value || null })}
            aria-label="Filter by genre"
            className="input h-9 min-w-0 flex-1 py-0 pr-7 text-xs sm:w-40 sm:flex-none"
          >
            <option value="">All genres</option>
            {activeGenres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={year ?? ''}
            onChange={(e) => patch({ year: e.target.value || null })}
            aria-label="Filter by year"
            className="input h-9 min-w-0 flex-1 py-0 pr-7 text-xs sm:w-32 sm:flex-none"
          >
            <option value="">Any year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {genreId || year ? (
            <button
              onClick={() => patch({ genre: null, year: null })}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Clear
            </button>
          ) : null}

          <div className="ml-auto hidden gap-1 rounded-lg bg-card p-1 sm:flex">
            {(['grid', 'list'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGrid(g)}
                aria-label={`${g} view`}
                aria-pressed={grid === g}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  grid === g ? 'bg-elevated text-text' : 'text-text-muted hover:text-text'
                )}
              >
                {g === 'grid' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 5h18v2H3zM3 11h18v2H3zM3 17h18v2H3z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pt-5 sm:px-6 lg:px-10">
        {query.isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Couldn't load titles"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try a different genre or year."
            actionLabel="Clear filters"
            onAction={() => patch({ genre: null, year: null })}
          />
        ) : grid === 'grid' ? (
          <PosterGrid items={items} />
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((m) => (
              <ListItem key={`${m.type}-${m.id}`} media={m} />
            ))}
          </div>
        )}

        {query.isFetchingNextPage ? (
          <div className="mt-6 flex justify-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : null}

        {query.hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => query.fetchNextPage()}
              className="btn btn-secondary px-6 py-2.5 text-sm"
            >
              Load more
            </button>
          </div>
        ) : items.length > 0 ? (
          <p className="mt-8 text-center text-xs text-text-muted">End of results</p>
        ) : null}
      </div>
    </div>
  );
}
