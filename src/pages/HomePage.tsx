import { useMemo } from 'react';
import { Hero } from '../components/Hero';
import { MediaRow } from '../components/MediaRow';
import { useRows } from '../hooks/useCatalog';
import type { RowKey } from '../services/catalog';
import { useContinueWatching, type Media, type ProgressRecord } from '../store/app-store';
import { fetchRow } from '../services/catalog';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

const ROWS: { key: RowKey; title: string; to: string }[] = [
  { key: 'trending', title: 'Trending This Week', to: '/discover?sort=trending' },
  { key: 'nowPlaying', title: 'In Cinemas', to: '/discover?type=movie&sort=nowPlaying' },
  { key: 'popularSeries', title: 'Popular Series', to: '/discover?type=series&sort=popularSeries' },
  { key: 'popularMovies', title: 'Popular Movies', to: '/discover?type=movie&sort=popularMovies' },
  { key: 'topRatedMovies', title: 'Top Rated Movies', to: '/discover?type=movie&sort=topRatedMovies' },
  { key: 'topRatedSeries', title: 'Critically Acclaimed', to: '/discover?type=series&sort=topRatedSeries' },
  { key: 'upcomingMovies', title: 'Coming Soon', to: '/discover?type=movie&sort=upcomingMovies' },
];

/** Build a Media shell from a progress record, for Continue Watching. */
function toMedia(p: ProgressRecord): Media {
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

function resumeLabel(p: ProgressRecord) {
  const left = Math.max(0, p.duration - p.time);
  if (left < 60) return 'Under a minute left';
  if (left < 3600) return `${Math.round(left / 60)} min left`;
  return `${Math.floor(left / 3600)}h ${Math.round((left % 3600) / 60)}m left`;
}

/** Hero needs full metadata (overview, genres), which the list rows omit. */
function useHeroItems() {
  return useQuery({
    queryKey: ['home', 'hero'],
    queryFn: async () => {
      const [trending, popular] = await Promise.all([
        fetchRow('trending', 1),
        fetchRow('popularMovies', 1),
      ]);
      // Deduplicate: the hero should not cycle the same film twice.
      const seen = new Set<string>();
      return [...trending, ...popular]
        .filter((m) => m.backdrop && (seen.has(m.id) ? false : (seen.add(m.id), true)))
        .slice(0, 6);
    },
    staleTime: 30 * 60_000,
  });
}

export function HomePage() {
  const keys = useMemo(() => ROWS.map((r) => r.key), []);
  const { data, isLoading } = useRows(keys);
  const hero = useHeroItems();
  const continueWatching = useContinueWatching();

  const cwItems = useMemo(() => continueWatching.slice(0, 10).map(toMedia), [continueWatching]);

  return (
    <div className="pb-4">
      <Hero items={hero.data ?? []} isLoading={hero.isLoading} />

      <div className="relative z-10 -mt-8 space-y-8 px-4 sm:px-6 lg:-mt-24 lg:space-y-10 lg:px-10">
        {cwItems.length > 0 ? (
          <MediaRow
            title="Continue Watching"
            items={cwItems}
            variant="landscape"
            to="/library?tab=progress"
          >
            {(media) => {
              const rec = continueWatching.find((p) => p.mediaId === media.id);
              return (
                <div className="w-64 flex-none sm:w-72">
                  <Link
                    to={`/player/${media.id}${media.type === 'series' && rec?.season != null
                      ? `?season=${rec.season}&episode=${rec.episode ?? 1}`
                      : ''}`}
                    className="card card-hover group block"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-t-xl bg-card">
                      {media.backdrop ? (
                        <img
                          src={media.backdrop}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{ width: `${(rec ? (rec.time / rec.duration) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-b-xl px-3 py-2.5">
                      <h3 className="truncate text-sm font-semibold text-text">{media.title}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-text-muted">
                        {rec?.season != null
                          ? `S${rec.season} · E${rec.episode ?? 1} · ${rec.episodeTitle ?? ''}`
                          : resumeLabel(rec!)}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            }}
          </MediaRow>
        ) : null}

        {ROWS.map((row, i) => (
          <MediaRow key={row.key} title={row.title} items={data[i] ?? []} isLoading={isLoading} to={row.to} />
        ))}
      </div>
    </div>
  );
}
