import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { discover } from '../services/catalog';
import { PosterGrid } from '../components/MediaCard';
import { EmptyState, SkeletonCard } from '../components/ui';
import { cn } from '../utils/cn';
import type { MediaType } from '../store/app-store';

const SORTS: { key: string; label: string; sortBy: string }[] = [
  { key: 'popular', label: 'Popular', sortBy: 'popularity.desc' },
  { key: 'top', label: 'Top Rated', sortBy: 'vote_average.desc' },
  { key: 'recent', label: 'Most Recent', sortBy: 'primary_release_date.desc' },
];

const SERIES_SORTS: { key: string; label: string; sortBy: string }[] = [
  { key: 'popular', label: 'Popular', sortBy: 'popularity.desc' },
  { key: 'top', label: 'Top Rated', sortBy: 'vote_average.desc' },
  { key: 'recent', label: 'Most Recent', sortBy: 'first_air_date.desc' },
];

/** `/movies` and `/series` — one page, two very similar listings. */
export function CatalogPage({ type }: { type: MediaType }) {
  const sorts = type === 'movie' ? SORTS : SERIES_SORTS;
  const [sort, setSort] = useState('popular');
  const active = sorts.find((s) => s.key === sort) ?? sorts[0];

  const query = useInfiniteQuery({
    queryKey: ['catalog', type, active.sortBy],
    queryFn: ({ pageParam = 1 }) =>
      discover({ type, sortBy: active.sortBy, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length * 20 < (last.total ?? 0) ? pages.length + 1 : undefined,
    staleTime: 5 * 60_000,
  });

  const items = (query.data?.pages ?? []).flatMap((p) => p.results);
  const total = query.data?.pages?.[0]?.total ?? 0;

  return (
    <div className="pb-10">
      <header className="px-4 pb-4 pt-5 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {type === 'movie' ? 'Movies' : 'Series'}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {total > 0 ? `${total.toLocaleString()} titles` : 'Loading…'}
        </p>
        <div className="mt-4 flex gap-1.5">
          {sorts.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                sort === s.key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-card text-text-secondary hover:bg-elevated hover:text-text'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-10">
        {query.isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Couldn't load the catalog"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing here yet" />
        ) : (
          <PosterGrid items={items} />
        )}

        {query.hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="btn btn-secondary px-6 py-2.5 text-sm disabled:opacity-50"
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
