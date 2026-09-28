import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadMovie, loadSeries } from '../services/catalog';
import { mergeSources, trailerSource, useArchiveSources } from '../services/sources';
import { VideoPlayer } from '../components/VideoPlayer';
import { SourceChooser } from '../components/SourceChooser';
import { TrailerModal } from '../components/TrailerModal';
import { EmptyState } from '../components/ui';
import { usePlayer } from '../hooks/usePlayer';
import { useSourcePicker } from '../hooks/useSourcePicker';
import { useAppStore, type Episode, type Media, type MediaSource, selectProgressFor, selectRememberPosition, selectSetProgressAction, selectMarkWatchedAction } from '../store/app-store';

/** Opening/credits run we let the viewer skip past. */
const SKIP_INTRO = 90;

/**
 * How long to wait for the Internet Archive lookup before starting with
 * whatever is available. Without this bound a slow archive search leaves the
 * player spinning with nothing to show.
 */
const SOURCE_GRACE_MS = 2500;

/**
 * The player.
 *
 * The only thing that decides what actually plays is the source list: a full
 * source from Internet Archive, or the trailer as a clearly-labelled fallback,
 * so this page is never a dead end.
 */
export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { play, stop, setPlaying } = usePlayer();

  const mediaId = Number(id);
  const valid = Number.isFinite(mediaId) && mediaId > 0;

  // Series URLs carry `season`; film URLs do not. One query covers both, so a
  // player screen never fires two conflicting detail requests.
  const season = Number(params.get('season') ?? 0);
  const isSeriesUrl = season > 0;
  const episode = Number(params.get('episode') ?? 1);
  const srcParam = params.get('src');

  const [sourceIndex, setSourceIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [graceOver, setGraceOver] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const skipDismissed = useRef(false);
  const announced = useRef(false);

  const recordId = String(mediaId);
  const setProgress = useAppStore(selectSetProgressAction);
  const markWatched = useAppStore(selectMarkWatchedAction);
  const progress = useAppStore(selectProgressFor(recordId));
  const rememberPosition = useAppStore(selectRememberPosition);

  const detail = useQuery({
    queryKey: ['player', isSeriesUrl ? 'series' : 'movie', mediaId],
    queryFn: () => (isSeriesUrl ? loadSeries(mediaId) : loadMovie(mediaId)),
    enabled: valid,
    staleTime: 30 * 60_000,
  });

  const media: Media | undefined = detail.data;

  /* Sources ------------------------------------------------------------ */
  // The trailer is derived synchronously from TMDB, so it is available the
  // instant the detail request lands — no waiting on a second network call.
  const trailer = trailerSource(media);
  const archive = useArchiveSources(media);

  /** True once the archive lookup has stopped, however it turned out. */
  const archiveDone = !archive.isPending && !archive.isLoading;

  // Cap the wait: once the grace period lapses we start with whatever we have,
  // rather than spinning on a slow archive search.
  useEffect(() => {
    if (archiveDone) return;
    const id = setTimeout(() => setGraceOver(true), SOURCE_GRACE_MS);
    return () => clearTimeout(id);
  }, [archiveDone]);

  const list: MediaSource[] = useMemo(() => {
    const all = mergeSources(archive.data ?? [], trailer);
    if (!srcParam) return all;
    const chosen = all.find((s) => s.url === srcParam);
    if (chosen) return [chosen, ...all.filter((s) => s.url !== srcParam)];
    // Sources may still be in flight; hold the chosen URL so playback starts.
    return [
      { url: srcParam, label: 'Selected source', quality: 'HD', kind: 'free' as const },
      ...all,
    ];
  }, [archive.data, trailer, srcParam]);

  /**
   * Once playback has a source it keeps that one. The archive list can arrive
   * a moment later, and swapping the <video> out from under the viewer would
   * restart it from the beginning.
   */
  const source = useMemo(() => {
    if (picked) return list.find((s) => s.url === picked) ?? list[0];
    return list[Math.min(sourceIndex, Math.max(0, list.length - 1))];
  }, [picked, sourceIndex, list]);

  useEffect(() => {
    if (!picked && source) setPicked(source.url);
  }, [picked, source]);

  /**
   * Health-check every candidate, then let the winner take over. The chooser
   * stays open while this runs so the testing is visible rather than a blank
   * spinner, and the viewer can override the result at any point.
   */
  const picker = useSourcePicker(list, !srcParam);
  const { probes, checking, best } = picker;
  const [chooserOpen, setChooserOpen] = useState(true);

  // Auto-select the winner once probing settles, unless the viewer chose.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || checking || !best) return;
    autoPicked.current = true;
    if (!picked) setPicked(best.url);
    setChooserOpen(false);
  }, [checking, best, picked]);

  const chooseSource = (s: MediaSource) => {
    autoPicked.current = true;
    setPicked(s.url);
    setSourceIndex(list.findIndex((x) => x.url === s.url));
    skipDismissed.current = false;
    setShowSkip(false);
    setChooserOpen(false);
  };

  const ready = !!source && (graceOver || archiveDone || !!srcParam);
  /** A trailer is an <iframe>, not a <video src>, so it renders differently. */
  const isEmbed = source?.kind === 'embed';

  /* Episode navigation ----------------------------------------------- */
  const isSeries = !!media?.seasons?.length;

  const currentEpisode: Episode | undefined = useMemo(() => {
    if (!media?.seasons) return undefined;
    const s = Number(season) || 1;
    return media.seasons.find((x) => x.season === s)?.episodes.find((e) => e.episode === episode);
  }, [media, season, episode]);

  const flat = useMemo(
    () => media?.seasons?.flatMap((s) => s.episodes.map((e) => ({ season: s.season, ep: e }))) ?? [],
    [media]
  );

  const currentIndex = useMemo(
    () =>
      flat.findIndex((x) => x.season === (Number(season) || 1) && x.ep.episode === episode),
    [flat, season, episode]
  );

  const nextEpisode = currentIndex >= 0 && currentIndex + 1 < flat.length ? flat[currentIndex + 1] : undefined;
  const prevEpisode = currentIndex > 0 ? flat[currentIndex - 1] : undefined;

  const goToEpisode = (s: number, e: number) => {
    skipDismissed.current = false;
    setShowSkip(false);
    setParams({ season: String(s), episode: String(e) }, { replace: true });
  };

  /* Register with the global player so the mini bar can find this title. */
  useEffect(() => {
    if (!media || !source) return;
    play({
      media,
      source,
      season: isSeries ? Number(season) || 1 : undefined,
      episode: isSeries ? episode : undefined,
      episodeTitle: currentEpisode?.title,
      poster: currentEpisode?.still ?? media.backdrop ?? media.poster,
    });
  }, [
    media, source, isSeries, season, episode,
    currentEpisode?.title, currentEpisode?.still, play,
  ]);

  useEffect(() => {
    if (media && source && !announced.current) {
      announced.current = true;
      setPlaying(true);
    }
  }, [media, source, setPlaying]);

  /* Skip Intro -------------------------------------------------------- */
  useEffect(() => {
    if (skipDismissed.current) return;
    const v = document.querySelector('video');
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= 12 && v.currentTime < SKIP_INTRO) setShowSkip(true);
      if (v.currentTime >= SKIP_INTRO) setShowSkip(false);
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [source?.url]);

  const onTimeUpdate = (t: number, d: number) => {
    if (!rememberPosition || !media || d <= 0) return;
    setProgress({
      mediaId: recordId,
      type: media.type,
      title: media.title,
      poster: media.poster,
      backdrop: currentEpisode?.still ?? media.backdrop,
      time: t,
      duration: d,
      season: isSeries ? Number(season) || 1 : undefined,
      episode: isSeries ? episode : undefined,
      episodeTitle: currentEpisode?.title,
      updatedAt: Date.now(),
    });
  };

  const backTo = () => (isSeries ? `/series/${mediaId}` : `/movie/${mediaId}`);

  if (!valid) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <EmptyState title="Not found" message="That title doesn't exist." />
      </div>
    );
  }

  if (detail.isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-sm text-white/60">Loading…</p>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <EmptyState
          title="Couldn't load this title"
          message="Check your connection and try again."
          actionLabel="Go back"
          onAction={() => navigate(-1)}
        />
      </div>
    );
  }

  if (!source) {
    if (archive.isLoading && !graceOver) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">Finding something to play…</p>
        </div>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <EmptyState
          title="Nothing playable here"
          message="No source is available for this title right now."
          actionLabel="Go back"
          onAction={() => navigate(-1)}
        />
      </div>
    );
  }

  const title = isSeries && currentEpisode ? currentEpisode.title : media.title;
  const sublabel = isSeries
    ? `${media.title} · S${Number(season) || 1} E${episode}`
    : [media.year, media.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');

  const exit = () => {
    stop();
    navigate(backTo());
  };

  /* A trailer is a YouTube embed, not a video file. */
  if (isEmbed) {
    return (
      <TrailerModal
        videoKey={source.url.match(/embed\/([\w-]+)/)?.[1] ?? ''}
        onClose={exit}
      />
    );
  }

  return (
    <div className="h-full w-full bg-black">
      {/* Source chooser. Doubles as the "testing sources" screen. */}
      {chooserOpen && picker.ranked.length > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-4">
          <SourceChooser
            sources={picker.ranked}
            probes={probes}
            activeUrl={source.url}
            checking={checking || !ready}
            onPick={chooseSource}
            onClose={() => setChooserOpen(false)}
          />
        </div>
      ) : null}

      <VideoPlayer
        key={source.url}
        src={source.url}
        poster={currentEpisode?.still ?? media.backdrop ?? media.poster}
        title={title}
        subtitle={sublabel}
        startAt={progress?.time ?? 0}
        onExit={exit}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => {
          if (nextEpisode) {
            goToEpisode(nextEpisode.season, nextEpisode.ep.episode);
            return;
          }
          markWatched(recordId, media.type, media.title);
          exit();
        }}
        hasPrevious={!!prevEpisode}
        onPrevious={() => prevEpisode && goToEpisode(prevEpisode.season, prevEpisode.ep.episode)}
        onNext={
          nextEpisode ? () => goToEpisode(nextEpisode.season, nextEpisode.ep.episode) : undefined
        }
        upNext={
          nextEpisode
            ? {
                label: nextEpisode.ep.title,
                sublabel: `S${nextEpisode.season} · E${nextEpisode.ep.episode}`,
                onPlay: () => goToEpisode(nextEpisode.season, nextEpisode.ep.episode),
                onCancel: () => {
                  markWatched(recordId, media.type, media.title);
                  exit();
                },
              }
            : null
        }
      >
        {showSkip ? (
          <button
            onClick={() => {
              const v = document.querySelector('video');
              if (v) v.currentTime = SKIP_INTRO;
              skipDismissed.current = true;
              setShowSkip(false);
            }}
            className="absolute bottom-24 right-4 z-20 rounded-lg bg-black/70 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-transform hover:scale-105 sm:bottom-28"
          >
            Skip Intro
          </button>
        ) : null}

        {/* Re-open the chooser once it has been dismissed. */}
        {picker.ranked.length > 1 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChooserOpen((o) => !o);
            }}
            aria-label="Choose source"
            className="absolute left-3 top-14 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2" />
              <circle cx="9" cy="17" r="2" />
            </svg>
            {source.quality ?? 'Source'}
          </button>
        ) : null}
      </VideoPlayer>

    </div>
  );
}
