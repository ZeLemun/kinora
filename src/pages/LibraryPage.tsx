import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useLibrary, useFavorites } from '../hooks/useStremio';
import { Rail, EmptyState, type RailItem } from '../components';
import { tmdb } from '../services/tmdb';
import { cn } from '../utils/cn';
import { useState } from 'react';

export function LibraryPage() {
  const { t } = useTranslation();
  const { continueWatching, library } = useLibrary();
  const { favorites: favIds } = useFavorites();
  const [tab, setTab] = useState<'continue' | 'list' | 'favorites'>('continue');

  const toRailItem = (item: (typeof library)[number]): RailItem => ({
    id: item.id,
    name: item.title,
    poster: item.poster,
    type: item.type === 'series' ? 'series' : 'movie',
  });

  const continueItems = continueWatching.map(toRailItem);
  const listItems = library
    .filter((item) => !continueWatching.some((c) => c.type === item.type && c.id === item.id))
    .map(toRailItem);
  const favoriteItems = library.filter((item) => favIds.includes(item.id)).map(toRailItem);

  const tabs = [
    { key: 'continue' as const, label: t('continueWatching') },
    { key: 'list' as const, label: t('myList') },
    { key: 'favorites' as const, label: t('favorites') },
  ];

  return (
    <div className="px-4 py-5">
      <h1 className="mb-4 text-2xl font-bold text-text">{t('library')}</h1>

      <div className="mb-6 flex gap-1 rounded-xl bg-surface p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              'min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm',
              tab === item.key ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'continue' &&
        (continueItems.length === 0 ? (
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            title={t('noContinueWatching')}
          />
        ) : (
          <div className="space-y-3">
            {continueItems.map((item) => {
              const full = continueWatching.find((c) => c.id === item.id);
              const poster = tmdb.resolveImage(item.poster, 'w342');
              const pct =
                full && full.duration > 0
                  ? Math.min(100, Math.round((full.progress / full.duration) * 100))
                  : 0;
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={`/watch/${item.type}/${item.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
                >
                  {poster ? (
                    <img
                      src={poster}
                      alt={item.name}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      className="h-24 w-16 flex-none rounded-lg bg-surface-hover object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-16 flex-none items-center justify-center rounded-lg bg-surface-hover text-xl font-semibold text-text-muted">
                      {item.name.charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-text">{item.name}</h3>
                    {full?.season ? (
                      <p className="mt-0.5 text-xs text-text-muted">
                        S{full.season} E{full.episode}
                      </p>
                    ) : null}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {pct}% {t('watched')}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

      {tab === 'list' &&
        (listItems.length === 0 ? (
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
            title={t('myListEmpty')}
          />
        ) : (
          <Rail title={t('myList')} items={listItems} />
        ))}

      {tab === 'favorites' &&
        (favoriteItems.length === 0 ? (
          <EmptyState
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }
            title={t('noFavorites')}
          />
        ) : (
          <Rail title={t('favorites')} items={favoriteItems} />
        ))}
    </div>
  );
}
