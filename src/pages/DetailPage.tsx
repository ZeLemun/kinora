import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadMovie, loadSeries, similar } from '../services/catalog';
import { mergeSources, trailerSource, useArchiveSources } from '../services/sources';
import { useOmdbRatings } from '../services/omdb';
import { useSourcePicker } from '../hooks/useSourcePicker';
import { getEmbedSources } from '../services/embed-providers';
import { MediaRow } from '../components/MediaRow';
import { TrailerModal } from '../components/TrailerModal';
import { EmptyState, SkeletonDetail, useToast } from '../components/ui';
import {
  useAppStore,
  useIsFavorite,
  useIsInWatchlist,
  useProgressFor,
  selectToggleWatchlist,
  selectToggleFavorite,
  type Episode,
  type MediaType,
} from '../store/app-store';
import { cn } from '../utils/cn';

const fmtRuntime = (min?: number) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '');

const LONG_DATE = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Detail page for both a film and a series. Series get a season selector and an
 * episode browser; films get a source list and a trailer.
 */
export function DetailPage({ type }: { type: MediaType }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const mediaId = Number(id);
  const valid = Number.isFinite(mediaId) && mediaId > 0;

  const detail = useQuery({
    queryKey: ['detail', type, mediaId],
    queryFn: () => (type === 'movie' ? loadMovie(mediaId) : loadSeries(mediaId)),
    enabled: valid,
    staleTime: 30 * 60_000,
  });

  const media = detail.data;

  // IMDb score, metascore and certificate. Best-effort: a failure here leaves
  // the TMDB values alone rather than holding up the page.
  const omdb = useOmdbRatings(media?.imdbId);
  const imdb = omdb.data;
  const certification = imdb?.rated ?? media?.certification;
  /* Sources. The archive lookup runs in the background; the trailer is
     derived from the detail response and is therefore available immediately. */
  const archive = useArchiveSources(media);
  const mergedSources = useMemo(
    () => mergeSources(archive.data ?? [], trailerSource(media)),
    [archive.data, media]
  );
  const picker = useSourcePicker(mergedSources, true);
  const { probes } = picker;

  const [season, setSeason] = useState<number | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const isWatchlisted = useIsInWatchlist(String(mediaId));
  const isFavorite = useIsFavorite(String(mediaId));
  const progress = useProgressFor(String(mediaId));  const toggleWatchlist = useAppStore(selectToggleWatchlist);
  const toggleFavorite = useAppStore(selectToggleFavorite);

  const related = useQuery({
    queryKey: ['similar', type, mediaId],
    queryFn: () => similar(media!),
    enabled: !!media,
    staleTime: 30 * 60_000,
  });

  const seasons = media?.seasons ?? [];
  const activeSeason = season ?? seasons[0]?.season ?? 1;
  const episodes = useMemo(
    () => seasons.find((s) => s.season === activeSeason)?.episodes ?? [],
    [seasons, activeSeason]
  );

  /* Embed sources (iframe players: vidsrc, superembed, vidapi, …). Built from
     the TMDB id, so they exist as soon as `media` does and never need a second
     request. This must be declared before the early returns below — a hook
     after a conditional return is React error #310. */
  const embedSources = useMemo(
    () => getEmbedSources({ id: mediaId, type: type === 'movie' ? 'movie' : 'tv' }, activeSeason, 1),
    [mediaId, type, activeSeason]
  );

  /** Probed direct sources + embed sources, in the order the chooser offers them. */
  const allSources = useMemo(
    () => [
      ...picker.ranked,
      ...embedSources.map((e) => ({
        url: e.url,
        label: e.provider.name,
        quality: 'HD',
        kind: 'embed' as const,
      })),
    ],
    [picker.ranked, embedSources]
  );

  /**
   * What "Watch Now" can actually open. A provider embed counts: it always
   * loads a frame. Only a *failed direct file* disqualifies a source, which is
   * why this is not simply `playable.length > 0` — that expression used to be
   * false for most titles, which styled Watch Now as secondary even though the
   * embeds below it were perfectly good.
   */
  const playable = picker.ranked.filter(
    (s) => s.kind === 'embed' || probes[s.url]?.state !== 'failed'
  );

  if (!valid) {
    return <EmptyState title="Not found" message="That title doesn't exist." />;
  }

  if (detail.isLoading) return <SkeletonDetail />;

  if (detail.isError || !media) {
    return (
      <EmptyState
        title="Couldn't load this title"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => detail.refetch()}
      />
    );
  }

  const resume =
    progress && progress.time > 5 && progress.time < progress.duration - 10
      ? `${Math.floor(progress.time / 60)}:${String(Math.floor(progress.time % 60)).padStart(2, '0')}`
      : null;

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="pb-12">
      {/* Backdrop */}
      <div className="relative h-[46dvh] w-full overflow-hidden bg-card sm:h-[56dvh] lg:h-[600px]">
        {media.backdrop ? (
          <img
            src={media.backdrop}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-elevated to-card" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-background" />

        <button
          onClick={back}
          aria-label="Go back"
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:left-5 sm:top-5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Title block */}
      <div className="relative -mt-24 px-4 sm:-mt-32 sm:px-6 lg:-mt-40 lg:px-10">
        <div className="flex gap-4 sm:gap-6">
          <div className="w-24 flex-none sm:w-36 lg:w-44">
            <div className="overflow-hidden rounded-xl border border-line shadow-2xl">
              <div className="aspect-[2/3] bg-card">
                {media.poster ? (
                  <img src={media.poster} alt={media.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-2 sm:pt-6">
            <h1 className="text-hero-shadow-sm text-2xl font-bold leading-tight text-text sm:text-4xl lg:text-5xl">
              {media.title}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-text-secondary sm:text-sm">
              {media.rating ? (
                <span className="flex items-center gap-1 font-semibold text-yellow-400" title="TMDB">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {media.rating.toFixed(1)}
                </span>
              ) : null}
              {imdb?.imdbRating ? (
                <span
                  className="flex items-center gap-1 font-semibold text-yellow-400"
                  title={imdb.imdbVotes ? `${imdb.imdbVotes.toLocaleString()} IMDb votes` : 'IMDb'}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">IMDb</span>
                  {imdb.imdbRating.toFixed(1)}
                </span>
              ) : null}
              {imdb?.metascore ? (
                <span className="font-semibold text-text-secondary" title="Metacritic">
                  <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">MC</span>{' '}
                  {imdb.metascore}
                </span>
              ) : null}
              {media.year && <span>{media.year}</span>}
              {fmtRuntime(media.runtime) && <span>{fmtRuntime(media.runtime)}</span>}
              {certification && (
                <span className="badge badge-default border border-line">{certification}</span>
              )}
              <span className="badge badge-default border border-line">
                {media.type === 'movie' ? 'Movie' : 'Series'}
              </span>
            </div>

            {/* Genres */}
            {media.genres.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {media.genres.map((g) => {
                    const gid = GENRE_IDS[g];
                    return gid ? (
                      <Link
                        key={g}
                        to={`/discover?type=${media.type}&sort=${
                          media.type === 'movie' ? 'popularMovies' : 'popularSeries'
                        }&genre=${gid}`}
                        className="rounded-full bg-card px-2.5 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-elevated hover:text-text"
                      >
                        {g}
                      </Link>
                    ) : (
                      <span
                        key={g}
                        className="rounded-full bg-card px-2.5 py-0.5 text-[11px] text-text-secondary"
                      >
                        {g}
                      </span>
                    );
                  })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to={`/player/${media.id}${type === 'series' ? `?season=${activeSeason}&episode=1` : ''}`}
            className={cn(
              'btn h-11 px-6 text-sm sm:text-base',
              playable.length > 0 ? 'btn-primary' : 'btn-secondary'
            )}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            {resume ? `Resume from ${resume}` : 'Watch Now'}
          </Link>

          <button
            onClick={() => {
              const r = toggleWatchlist(String(mediaId));
              toast(
                r === 'added' ? 'Added to Watchlist' : 'Removed from Watchlist',
                r === 'added' ? 'success' : 'default'
              );
            }}
            aria-pressed={isWatchlisted}
            aria-label={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className="btn btn-secondary h-11 flex-1 gap-2 px-4 text-sm sm:flex-none"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isWatchlisted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
            </svg>
            {isWatchlisted ? 'Saved' : 'Add'}
          </button>

          <button
            onClick={() => {
              const r = toggleFavorite(String(mediaId));
              toast(
                r === 'added' ? 'Added to Favorites' : 'Removed from Favorites',
                r === 'added' ? 'success' : 'default'
              );
            }}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            className="btn btn-secondary h-11 w-11 flex-none px-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {media.trailerKey ? (
            <button
              onClick={() => setTrailerOpen(true)}
              className="btn btn-secondary h-11 flex-1 gap-2 px-4 text-sm sm:flex-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
              </svg>
              Trailer
            </button>
          ) : null}
        </div>

        {/* Sources */}
        {allSources.length > 0 ? (
          <div className="mt-5 rounded-xl border border-line bg-card p-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Available sources
            </h3>
            <ul className="mt-2.5 space-y-1.5">
              {allSources.map((s) => {
                const isEmbed = s.kind === 'embed';
                const dead = !isEmbed && probes[s.url]?.state === 'failed';
                return (
                  <li key={s.url}>
                    {isEmbed ? (
                      /* Embeds play in the in-app player, not a browser tab:
                         the frame needs immersive/landscape, a source chooser and
                         a back action, none of which an external tab provides. */
                      <Link
                        to={`/player/${media.id}?src=${encodeURIComponent(s.url)}${
                          type === 'series' ? `&season=${activeSeason}&episode=1` : ''
                        }`}
                        className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-2.5 py-2 text-sm transition-colors hover:bg-elevated"
                      >
                        <span className="badge badge-default flex-none">Embed</span>
                        <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-text-muted" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ) : (
                      <Link
                        to={`/player/${media.id}?src=${encodeURIComponent(s.url)}${
                          type === 'series' ? `&season=${activeSeason}&episode=1` : ''
                        }`}
                        aria-disabled={dead}
                        onClick={(e) => dead && e.preventDefault()}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          dead
                            ? 'opacity-45'
                            : 'hover:bg-elevated'
                        )}
                      >
                        <span
                          className={cn(
                            'badge flex-none',
                            dead ? 'badge-danger' : 'badge-success'
                          )}
                        >
                          {dead ? 'Failed' : s.quality ?? 'HD'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
            {archive.isFetching ? (
              <p className="mt-2 text-[11px] text-text-muted">Looking for more sources…</p>
            ) : null}
          </div>
        ) : archive.isLoading ? (
          <div className="mt-5 rounded-xl border border-line bg-card p-3.5">
            <div className="skeleton h-4 w-24" />
            <div className="mt-3 space-y-2">
              <div className="skeleton h-9 w-full rounded-lg" />
              <div className="skeleton h-9 w-3/4 rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-line bg-card p-3.5">
            <p className="text-sm text-text-muted">
              No full-length source is available for this title. The trailer still plays.
            </p>
          </div>
        )}

        {/* Overview */}
        {media.overview ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Overview</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{media.overview}</p>
          </div>
        ) : null}

        {/* Cast */}
        {media.cast.length > 0 ? (
          <div className="mt-7">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">Cast</h2>
            <div className="rail rail-bleed fade-edges">
              {media.cast.slice(0, 12).map((p) => (
                <div key={p.id} className="w-24 flex-none text-center">
                  <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-card">
                    {p.profile ? (
                      <img
                        src={p.profile}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-text-muted">
                        {p.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-xs font-medium text-text">{p.name}</p>
                  {p.character && (
                    <p className="truncate text-[11px] text-text-muted">{p.character}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Episode browser */}
        {type === 'series' ? (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Episodes</h2>
              {seasons.length > 1 ? (
                <select
                  value={activeSeason}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  aria-label="Select season"
                  className="input h-9 w-auto py-0 pr-8 text-xs"
                >
                  {seasons.map((s) => (
                    <option key={s.season} value={s.season}>
                      Season {s.season}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {episodes.length === 0 ? (
              <EmptyState title="No episodes listed yet" message="TMDB has no episode data for this season." />
            ) : (
              <ul className="space-y-1.5">
                {episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    media={media}
                    episode={ep}
                    activeSeason={activeSeason}
                    progress={progress}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* Related */}
        {related.data && related.data.length > 0 ? (
          <div className="mt-10">
            <MediaRow title="More Like This" items={related.data} to="/discover" />
          </div>
        ) : null}
      </div>

      {trailerOpen && media.trailerKey ? (
        <TrailerModal videoKey={media.trailerKey} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EpisodeRow({
  media,
  episode,
  activeSeason,
  progress,
}: {
  media: { id: string; title: string; type: MediaType };
  episode: Episode;
  activeSeason: number;
  progress?: { season?: number; episode?: number; time: number; duration: number };
}) {
  const isCurrent =
    progress?.season === activeSeason && progress.episode === episode.episode;
  const pct = isCurrent && progress && progress.duration > 0 ? (progress.time / progress.duration) * 100 : 0;

  return (
    <li>
      <Link
        to={`/player/${media.id}?season=${activeSeason}&episode=${episode.episode}`}
        className="group flex gap-3 rounded-xl p-2 transition-colors hover:bg-elevated"
      >
        <div className="relative h-16 w-28 flex-none overflow-hidden rounded-lg bg-card">
          {episode.still ? (
            <img
              src={episode.still}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          {pct > 0 ? (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
              <span className="block h-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold tabular-nums text-text-muted">
              E{episode.episode}
            </span>
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
              {episode.title}
            </h3>
            <span className="flex-none text-[11px] text-text-muted">{episode.runtime}m</span>
          </div>
          {episode.overview ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
              {episode.overview}
            </p>
          ) : null}
          {episode.airDate ? (
            <p className="mt-1 text-[11px] text-text-muted">
              Aired {LONG_DATE.format(new Date(episode.airDate))}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

/**
 * TMDB genre ids, so the genre chips can link into a filtered Discover.
 * Movie and TV share most ids but not all, hence two tables.
 */
const MOVIE_GENRE_IDS: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, 'Music': 10402, Mystery: 9648, Romance: 10749,
  'Science Fiction': 878, Thriller: 53, War: 10752, Western: 37,
};

const TV_GENRE_IDS: Record<string, number> = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10759, 'Kids': 10762, Mystery: 9648,
  News: 10763, Reality: 10764, 'Sci-Fi & Fantasy': 10765, Soap: 10766,
  Talk: 10767, War: 10752,
};

const GENRE_IDS: Record<string, number> = { ...MOVIE_GENRE_IDS, ...TV_GENRE_IDS };
