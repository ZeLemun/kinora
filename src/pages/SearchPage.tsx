import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { search } from '../services/catalog';
import { PosterCard } from '../components/MediaCard';
import { EmptyState, SkeletonCard } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../utils/cn';

type Tab = 'all' | 'movies' | 'series' | 'people';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movies', label: 'Movies' },
  { key: 'series', label: 'Series' },
  { key: 'people', label: 'People' },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<Tab>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebounce(draft, 350);

  useEffect(() => {
    const merged = new URLSearchParams(params);
    if (debounced) merged.set('q', debounced);
    else merged.delete('q');
    setParams(merged, { replace: true });
    // Only the debounced value should drive the URL, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep the field in sync when the URL changes from elsewhere (e.g. back).
  useEffect(() => setDraft(query), [query]);

  // ⌘K / Ctrl+K focuses the field from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => search(debounced),
    enabled: debounced.trim().length > 0,
    staleTime: 5 * 60_000,
  });

  const media = results.data?.media ?? [];
  const people = results.data?.people ?? [];

  const filtered = media.filter((m) =>
    tab === 'all' ? true : tab === 'movies' ? m.type === 'movie' : m.type === 'series'
  );
  const showPeople = tab === 'all' || tab === 'people';
  const showMedia = tab !== 'people';

  const searching = debounced.trim().length > 0;

  return (
    <div className="pb-10">
      <div className="px-4 pt-5 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Search</h1>

        <div className="relative mt-4">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Movies, series, people…"
            aria-label="Search"
            autoComplete="off"
            className="input h-12 pl-11 pr-16 text-base"
          />
          {draft ? (
            <button
              onClick={() => {
                setDraft('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted transition-colors hover:bg-elevated hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:block">
              ⌘K
            </kbd>
          )}
        </div>

        {searching ? (
          <div className="rail rail-bleed fade-edges mt-4">
            <div className="flex gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex-none rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                    tab === t.key
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-card text-text-secondary hover:bg-elevated hover:text-text'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-4 pt-6 sm:px-6 lg:px-10">
        {!searching ? (
          <EmptyState
            title="What are you looking for?"
            message="Search for a film, a series or a person."
          />
        ) : results.isLoading ? (
          <>
            {tab !== 'people' ? (
              <div className="rail rail-bleed fade-edges">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : null}
          </>
        ) : results.isError ? (
          <EmptyState
            title="Search failed"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => results.refetch()}
          />
        ) : media.length === 0 && people.length === 0 ? (
          <EmptyState
            title={`No results for "${debounced}"`}
            message="Try a different spelling or a shorter query."
          />
        ) : (
          <div className="space-y-8">
            {showMedia && filtered.length > 0 ? (
              <section>
                <div className="rail rail-bleed fade-edges">
                  {filtered.map((m) => (
                    <PosterCard key={`${m.type}-${m.id}`} media={m} />
                  ))}
                </div>
              </section>
            ) : null}

            {showPeople && people.length > 0 ? (
              <section>
                <h2 className="mb-3 text-base font-semibold text-text sm:text-lg">People</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {people.map((p) => (
                    <div key={p.id} className="card card-hover p-3">
                      <div className="flex items-center gap-3">
                        {p.profile ? (
                          <img
                            src={p.profile}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 flex-none rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-elevated text-lg font-bold text-text-muted">
                            {p.name.charAt(0)}
                          </span>
                        )}
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                          {p.name}
                        </p>
                      </div>
                      {p.knownFor.length > 0 ? (
                        <p className="mt-2 truncate text-[11px] text-text-muted">
                          {p.knownFor.map((k) => k.title).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {showMedia && tab !== 'all' && filtered.length === 0 ? (
              <EmptyState
                title="No matches in this category"
                message="Try the All tab."
                actionLabel="Show all"
                onAction={() => setTab('all')}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
