import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useMeta, useStreams, useSubtitles, useLibrary, useFavorites } from '../hooks/useStremio';
import { useDetails, tmdb } from '../hooks/useTMDB';
import { formatRuntime, formatYear, formatRating, cn } from '../utils/cn';
import { Button, Badge } from '../components/ui/basic';
import { ErrorFallback, LoadingState } from '../components/ErrorFallback';
import type { Stream } from '../addon-types';
import { PlayerModal } from '../components/PlayerModal';

export function DetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { library, addToLibrary, removeFromLibrary, updateProgress } = useLibrary();
  const { favorites, toggleFavorite } = useFavorites();

  const isMovie = type === 'movie';
  const mediaType = isMovie ? 'movie' : 'series';
  const tmdbType = isMovie ? 'movie' : 'tv';

  // Routes may carry either a TMDB numeric id (from TMDB rails) or a Stremio/IMDb id.
  const rawId = id ?? '';
  const isImdbId = /^tt\d+/i.test(rawId);
  const tmdbId = isImdbId ? 0 : Number(rawId) || 0;

  const { data: tmdbData, isLoading: tmdbLoading, error: tmdbError } = useDetails(tmdbType, tmdbId);

  // Cinemeta (and every other addon) keys on IMDb ids, so we must resolve them first.
  const imdbId = isImdbId ? rawId : (tmdbData?.external_ids?.imdb_id ?? '');

  const { data: metaData } = useMeta(mediaType, imdbId);

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [player, setPlayer] = useState<Stream | null>(null);

  const streamId = !isMovie && imdbId ? `${imdbId}:${season}:${episode}` : imdbId;
  const { data: streamsData, isLoading: streamsLoading } = useStreams(mediaType, streamId);
  const { data: subtitlesData } = useSubtitles(mediaType, streamId);

  const meta = metaData?.meta;
  const details = tmdbData;
  const streams = streamsData?.streams ?? [];
  const subtitles = subtitlesData?.subtitles ?? [];

  const title = meta?.name ?? details?.title ?? details?.name ?? rawId;
  const overview = meta?.description ?? details?.overview ?? t('noDescription');
  const poster = tmdb.resolveImage(meta?.poster ?? details?.poster_path ?? null, 'w500');
  // Prefer TMDB artwork (known to load); fall back to metahub by IMDb id.
  const backdrop =
    tmdb.resolveImage(details?.backdrop_path ?? null, 'w1280') ??
    (meta?.id ? `https://images.metahub.space/background/medium/${meta.id}/bg.jpg` : null);
  const releaseInfo = meta?.releaseInfo ?? details?.release_date ?? details?.first_air_date;
  const rating = meta?.rating ?? details?.vote_average;
  const genres = meta?.genres ?? details?.genres?.map((g) => g.name) ?? [];
  const runtime = details?.runtime ?? details?.episode_run_time?.[0];
  const cast = details?.credits?.cast?.slice(0, 12) ?? [];
  const videos =
    details?.videos?.results?.filter(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    ) ?? [];
  const seasons = (details?.seasons ?? []).filter((s) => s.season_number > 0);

  const isInLibrary = library.some((item) => item.id === rawId);
  const isFavorite = favorites.includes(rawId);
  const autoplay = location.pathname.startsWith('/watch');
  const autoTried = useRef(false);

  // On /watch routes open the first available stream as soon as it arrives.
  useEffect(() => {
    if (!autoplay || autoTried.current) return;
    if (streams.length > 0) {
      autoTried.current = true;
      setPlayer(streams[0]);
    }
  }, [autoplay, streams]);

  if (!isImdbId && tmdbLoading) return <LoadingState message={t('loading')} />;

  if (!isImdbId && (tmdbError || !details)) {
    return (
      <ErrorFallback
        message={t('notFound')}
        error={tmdbError instanceof Error ? tmdbError : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const handleListToggle = () => {
    if (isInLibrary) {
      removeFromLibrary({ type: mediaType, id: rawId });
      return;
    }
    addToLibrary({
      type: mediaType,
      id: rawId,
      title,
      duration: runtime ?? 0,
      poster: details?.poster_path ?? meta?.poster ?? undefined,
    });
  };

  const handleWatch = () => {
    if (streams.length > 0) setPlayer(streams[0]);
  };

  // Advances to the next episode and immediately opens its first stream.
  const goToNextEpisode = () => {
    const next = episode + 1;
    setEpisode(next);
    setPlayer(null);
    // Wait for the query keyed on the new episode id to resolve.
    pendingNext.current = next;
  };

  // Once the new episode's streams arrive, open them without another tap.
  const pendingNext = useRef<number | null>(null);
  useEffect(() => {
    if (pendingNext.current === null) return;
    if (episode !== pendingNext.current) return;
    if (streams.length > 0) {
      setPlayer(streams[0]);
      pendingNext.current = null;
    }
  }, [episode, streams]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Backdrop header — same pattern as the home Hero, which renders reliably. */}
      <div className="relative h-[58vh] max-h-[480px] w-full overflow-hidden">
        {backdrop ? (
          <img src={backdrop} alt="" className="h-full w-full object-cover object-top" />
        ) : poster ? (
          <div
            className="h-full w-full scale-110 bg-cover bg-center blur-2xl"
            style={{ backgroundImage: `url(${poster})`, opacity: 0.5 }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />

        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-6">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm"
                >
                  {g}
                </span>
              ))}
            </div>

            <h1 className="line-clamp-2 text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl">
              {title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85 sm:text-sm">
              <span className="rounded bg-white/15 px-1.5 py-0.5 font-medium backdrop-blur-sm">
                {isMovie ? t('movies') : t('series')}
              </span>
              {releaseInfo ? <span>{formatYear(releaseInfo)}</span> : null}
              {runtime ? <span>{formatRuntime(runtime)}</span> : null}
              {rating ? (
                <span className="flex items-center gap-1 text-yellow-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {formatRating(rating)}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleWatch} disabled={streams.length === 0} size="md" className="gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t('watchNow')}
              </Button>
              <Button variant="secondary" onClick={handleListToggle} size="md" className="gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isInLibrary ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {isInLibrary ? t('removeFromList') : t('addToList')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => toggleFavorite(rawId)}
                aria-label={t('favorites')}
                className="border border-white/20 bg-white/10 px-3 text-white hover:bg-white/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate(-1)}
        className="absolute left-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
        aria-label="Indietro"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="mx-auto w-full max-w-5xl px-4 pb-10">
        {/* Poster + quick facts, in normal flow so nothing gets clipped. */}
        <div className="-mt-12 flex gap-4">
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="aspect-[2/3] w-24 flex-none rounded-lg object-cover shadow-xl sm:w-32"
            />
          ) : (
            <div className="flex aspect-[2/3] w-24 flex-none items-center justify-center rounded-lg bg-surface-hover text-2xl font-semibold text-text-muted sm:w-32">
              {title.charAt(0)}
            </div>
          )}

          <dl className="min-w-0 flex-1 space-y-1.5 pt-1 text-sm">
            {meta?.director && (
              <div>
                <dt className="inline text-text-muted">{t('director')}: </dt>
                <dd className="inline text-text">{meta.director}</dd>
              </div>
            )}
            {releaseInfo && (
              <div>
                <dt className="inline text-text-muted">{t('year')}: </dt>
                <dd className="inline text-text">{formatYear(releaseInfo)}</dd>
              </div>
            )}
            {runtime && (
              <div>
                <dt className="inline text-text-muted">{t('episodes')}: </dt>
                <dd className="inline text-text">{formatRuntime(runtime)}</dd>
              </div>
            )}
          </dl>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-muted">{overview}</p>

        {/* Seasons */}
        {!isMovie && seasons.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-text">{t('seasons')}</h2>
            <div className="rail gap-2 pb-2">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => {
                    setSeason(s.season_number);
                    setEpisode(1);
                  }}
                  className={cn(
                    'flex-none whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    season === s.season_number
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-muted hover:bg-surface-hover'
                  )}
                >
                  {s.name || `${t('seasons')} ${s.season_number}`}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Episodes */}
        {!isMovie && meta?.videos && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-text">{t('episodes')}</h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Array.from({ length: Math.max(1, season) === 0 ? 0 : 12 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setEpisode(n)}
                  className={cn(
                    'rounded-lg py-2 text-sm font-medium transition-colors',
                    episode === n ? 'bg-primary text-white' : 'bg-surface text-text-muted'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Next episode shortcut for series */}
        {!isMovie && (
          <Button
            variant="secondary"
            onClick={goToNextEpisode}
            className="mt-4 h-11 w-full gap-2 rounded-[10px] sm:w-auto sm:px-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l10 8-10 8V4z" />
            </svg>
            {t('nextEpisode')} · S{season} E{episode + 1}
          </Button>
        )}

        {/* Streams */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-wide text-text sm:text-lg">
              {t('sources')}
            </h2>
            <span className="text-[11px] text-text-muted">
              {streamsLoading ? t('loading') : streams.length}
            </span>
          </div>

          {streams.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-center">
              <p className="text-sm text-text">{t('noStreams')}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {t('noStreamsHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {streams.map((stream, i) => (
                <button
                  key={`${stream.url}-${i}`}
                  onClick={() => setPlayer(stream)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">
                      {stream.title || stream.behaviorHints?.bingeGroup || `Source ${i + 1}`}
                    </p>
                    {stream.behaviorHints?.filename && (
                      <p className="truncate text-xs text-text-muted">{stream.behaviorHints.filename}</p>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {stream.quality && <Badge variant="primary">{stream.quality}</Badge>}
                    {stream.behaviorHints?.notWebReady && <Badge variant="warning">P2P</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Subtitles */}
        {subtitles.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-text">{t('subtitles')}</h2>
            <div className="flex flex-wrap gap-2">
              {subtitles.slice(0, 24).map((sub) => (
                <Badge key={sub.id}>{sub.title || sub.lang}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-text">{t('cast')}</h2>
            <div className="rail gap-3 pb-2">
              {cast.map((person) => (
                <div key={person.id} className="rail-item w-20 flex-none text-center">
                  {person.profile_path ? (
                    <img
                      src={tmdb.getProfileUrl(person.profile_path) ?? ''}
                      alt={person.name}
                      loading="lazy"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-hover text-lg font-semibold text-text-muted">
                      {person.name.charAt(0)}
                    </div>
                  )}
                  <p className="mt-2 truncate text-xs text-text">{person.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trailers */}
        {videos.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-text">{t('trailers')}</h2>
            <div className="rail gap-3 pb-2">
              {videos.slice(0, 6).map((v) => (
                <a
                  key={v.id}
                  href={`https://www.youtube.com/watch?v=${v.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rail-item w-56 flex-none"
                >
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-black">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white/80">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="mt-2 truncate text-xs text-text-muted">{v.name}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {player && (
        <PlayerModal
          stream={player}
          subtitles={subtitles}
          title={title}
          onNext={!isMovie ? goToNextEpisode : undefined}
          nextLabel={!isMovie ? `${t('nextEpisode')} · S${season} E${episode + 1}` : undefined}
          onProgress={(seconds, duration) => {
            if (duration > 0) {
              updateProgress({
                type: mediaType,
                id: rawId,
                progress: seconds,
                duration,
                title,
                poster: details?.poster_path ?? meta?.poster ?? undefined,
                season,
                episode,
              });
            }
          }}
          onClose={() => {
            setPlayer(null);
            if (autoplay) navigate(`/${mediaType}/${rawId}`, { replace: true });
          }}
        />
      )}
    </div>
  );
}
