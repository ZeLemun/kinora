import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useAppStore,
  useContinueWatching,
  useFavorites,
  useHistory,
  useWatchlist,
  selectClearProgress,
  type Media,
  type ProgressRecord,
} from '../store/app-store';
import { PosterCard } from '../components/MediaCard';
import { ConfirmDialog, ContextMenu, EmptyState, useToast, type MenuItem } from '../components/ui';
import { loadMovie, loadSeries } from '../services/catalog';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../utils/cn';

type Tab = 'progress' | 'watchlist' | 'favorites' | 'history';

const TABS: { key: Tab; label: string }[] = [
  { key: 'progress', label: 'Continue Watching' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'history', label: 'History' },
];

/**
 * `/library` plus the `/watchlist` and `/favorites` shortcuts — all four tabs
 * live in one component so the routes differ only by the initial tab.
 */
export function LibraryPage({ initialTab = 'progress' }: { initialTab?: Tab }) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(fromUrl && TABS.some((t) => t.key === fromUrl) ? fromUrl : initialTab);
  const [confirmClear, setConfirmClear] = useState(false);

  const { toast } = useToast();
  const progress = useContinueWatching();
  const watchlist = useWatchlist();
  const favorites = useFavorites();
  const history = useHistory();

  const select = (next: Tab) => {
    setTab(next);
    const merged = new URLSearchParams(params);
    merged.set('tab', next);
    setParams(merged, { replace: true });
  };

  const ids =
    tab === 'watchlist' ? watchlist : tab === 'favorites' ? favorites : tab === 'history' ? history : null;

  // Watchlist/favorites/history store bare ids, so hydrate them from TMDB.
  // Each id is cached, so revisiting a tab is instant.
  const hydrated = useQuery({
    queryKey: ['library', tab, ids?.join(',') ?? ''],
    queryFn: async (): Promise<Media[]> => {
      const list = ids ?? [];
      const settled = await Promise.allSettled(
        list.slice(0, 60).map((id) =>
          /^\d+$/.test(id) ? loadMovie(Number(id)) : loadSeries(Number(id))
        )
      );
      return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    },
    enabled: ids !== null && ids.length > 0,
    staleTime: 30 * 60_000,
  });

  const items = tab === 'progress' ? progress.map(recordToMedia) : hydrated.data ?? [];
  const loading = tab === 'progress' ? false : hydrated.isLoading;
  const isEmpty = !loading && items.length === 0;

  return (
    <div className="pb-10">
      <header className="px-4 pb-3 pt-5 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Library</h1>
          {tab === 'history' && history.length > 0 ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs font-medium text-text-muted transition-colors hover:text-[var(--color-danger)]"
            >
              Clear history
            </button>
          ) : null}
        </div>

        <div className="rail rail-bleed fade-edges mt-4">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => select(t.key)}
                className={cn(
                  'flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  tab === t.key
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-card text-text-secondary hover:bg-elevated hover:text-text'
                )}
              >
                {t.label}
                {t.key === 'watchlist' && watchlist.length > 0 ? (
                  <span className="ml-1.5 opacity-70">{watchlist.length}</span>
                ) : null}
                {t.key === 'favorites' && favorites.length > 0 ? (
                  <span className="ml-1.5 opacity-70">{favorites.length}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 pt-5 sm:px-6 lg:px-10">
        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton aspect-[2/3] w-full rounded-xl" />
                <div className="skeleton h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyForTab tab={tab} />
        ) : tab === 'progress' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {progress.map((rec) => (
              <ProgressCard key={rec.mediaId} record={rec} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((m) => (
              <PosterCard key={`${m.type}-${m.id}`} media={m} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear watch history?"
        message="This removes every title from your history. Watchlist and favorites are not affected."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={() => {
          useAppStore.getState().clearHistory();
          setConfirmClear(false);
          toast('History cleared', 'success');
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EmptyForTab({ tab }: { tab: Tab }) {
  if (tab === 'progress') {
    return (
      <EmptyState
        title="Nothing in progress"
        message="Start watching something and it will show up here so you can pick it back up."
      />
    );
  }
  if (tab === 'watchlist') {
    return (
      <EmptyState
        title="Your watchlist is empty"
        message="Tap the bookmark on any title to save it for later."
      />
    );
  }
  if (tab === 'favorites') {
    return (
      <EmptyState
        title="No favorites yet"
        message="Tap the heart on any title to keep it here."
      />
    );
  }
  return <EmptyState title="No watch history" message="Titles you play will be listed here." />;
}

function recordToMedia(p: ProgressRecord): Media {
  return {
    id: p.mediaId,
    type: p.type,
    title: p.title,
    poster: p.poster,
    backdrop: p.backdrop,
    overview: '',
    genres: [],
    cast: [],
  };
}

function ProgressCard({ record }: { record: ProgressRecord }) {
  const pct = record.duration > 0 ? (record.time / record.duration) * 100 : 0;
  const clearProgress = useAppStore(selectClearProgress);
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);

  const menu: MenuItem[] = [
    {
      label: 'Remove from Continue Watching',
      tone: 'danger',
      onSelect: () => {
        clearProgress(record.mediaId);
        toast('Removed from Continue Watching');
      },
    },
  ];

  return (
    <div className="card card-hover relative flex gap-3 p-3">
      <Link
        to={`/player/${record.mediaId}${
          record.season != null ? `?season=${record.season}&episode=${record.episode ?? 1}` : ''
        }`}
        className="relative h-20 w-36 flex-none overflow-hidden rounded-lg bg-card"
      >
        {record.backdrop || record.poster ? (
          <img
            src={record.backdrop ?? record.poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-text">{record.title}</h3>
        <p className="mt-0.5 text-[11px] text-text-muted">
          {record.season != null
            ? `S${record.season} · E${record.episode ?? 1}${record.episodeTitle ? ` · ${record.episodeTitle}` : ''}`
            : `${Math.floor(record.time / 60)} min watched`}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">
          {Math.max(0, Math.round((record.duration - record.time) / 60))} min left
        </p>
      </div>

      <span className="relative flex-none self-start">
        <button
          ref={menuAnchor}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 20.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
          </svg>
        </button>
        <ContextMenu
          open={menuOpen}
          anchorRef={menuAnchor}
          items={menu}
          onClose={() => setMenuOpen(false)}
        />
      </span>
    </div>
  );
}
