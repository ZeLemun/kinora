import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../utils/cn';
import { useAppStore } from '../store/app-store';
import { immersive } from '../services/immersive';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface UpNext {
  label: string;
  sublabel?: string;
  onPlay: () => void;
  onCancel: () => void;
}

/** Seconds of silence before the up-next card takes over. */
const UP_NEXT_LEAD = 20;

/* ------------------------------------------------------------------ */
/*  Player                                                            */
/* ------------------------------------------------------------------ */

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title: string;
  subtitle?: string;
  /** Seconds to resume from, or 0 to start at the beginning. */
  startAt?: number;
  onEnded?: () => void;
  onExit?: () => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  upNext?: UpNext | null;
  /** Enables the next-episode button in the transport bar. */
  onNext?: () => void;
  hasPrevious?: boolean;
  onPrevious?: () => void;
  autoPlay?: boolean;
  children?: ReactNode;
}

export function VideoPlayer({
  src,
  poster,
  title,
  subtitle,
  startAt = 0,
  onEnded,
  onExit,
  onTimeUpdate,
  upNext,
  onNext,
  hasPrevious,
  onPrevious,
  autoPlay = true,
  children,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekedToStart = useRef(false);

  const autoplayNextEpisode = useAppStore((s) => s.settings.autoplayNextEpisode);

  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chrome, setChrome] = useState(true);
  /** Second-tap panel: volume, skip, speed and quality in one place. */
  const [extras, setExtras] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);

  /* transient overlays ------------------------------------------------- */
  const [seekFlash, setSeekFlash] = useState<{ dir: -1 | 1; at: number } | null>(null);
  const [upNextOpen, setUpNextOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [volumeFlash, setVolumeFlash] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Chrome visibility                                                 */
  /* ------------------------------------------------------------------ */

  const revealChrome = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // Never hide while a menu or panel is up, or while paused.
      setChrome((prev) => {
        if (!playing || menuOpen || extras) return prev;
        return false;
      });
    }, 3200);
  }, [playing, menuOpen, extras]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  /* Immersive mode. Re-hides the bars whenever chrome is shown again, but
     never tears down and re-enters — that used to cause a visible stutter on
     every control toggle (the effect had `chrome` in its dependencies while
     also re-showing the bars, so each toggle was a full unlock/re-lock). */
  useEffect(() => {
    if (!chrome) return;
    immersive.enter();
  }, [chrome]);

  /* A portrait video player wastes most of a phone screen. There is no
     fullscreen control — the player is always full-bleed — so landscape is
     simply held for as long as the player is mounted. */
  useEffect(() => {
    immersive.setLandscape(true);
    return () => {
      immersive.exit();
      immersive.setLandscape(false);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Media element                                                    */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed]);

  /* Resume once, as soon as metadata gives us a real duration. Seeking before
     then lands on NaN and silently jumps the video to the end. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || seekedToStart.current) return;
    if (!Number.isFinite(startAt) || startAt <= 0) {
      seekedToStart.current = true;
      return;
    }
    const onMeta = () => {
      if (seekedToStart.current) return;
      seekedToStart.current = true;
      // Never resume into the last few seconds: that reads as "finished".
      const limit = Math.max(0, (Number.isFinite(v.duration) ? v.duration : 0) - 10);
      const target = Math.min(startAt, limit);
      if (target > 0) {
        v.currentTime = target;
        setTime(target);
      }
      if (autoPlay) v.play().catch(() => undefined);
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [src, startAt, autoPlay]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      const from = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      // With no real duration, ±10s on a 10s clip just slams to the edges, so
      // refuse rather than jump.
      if (d <= 0) return;
      const next = Math.max(0, Math.min(d, from + delta));
      v.currentTime = next;
      setTime(next);
      setSeekFlash({ dir: delta < 0 ? -1 : 1, at: next });
      setTimeout(() => setSeekFlash(null), 550);
      // Skipping while paused should stay paused — the user pressed a seek
      // button, not play. Only resume if it was already playing.
      if (!v.paused) v.play().catch(() => undefined);
    },
    []
  );

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    v.currentTime = Math.max(0, Math.min(t, d || t));
  }, []);

  const onTime = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (scrub === null) setTime(v.currentTime);
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setBuffered(
      v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0
    );
    onTimeUpdate?.(v.currentTime, d);
  }, [scrub, onTimeUpdate]);

  const commitScrub = useCallback(
    (t: number) => {
      seekTo(t);
      setTime(t);
      setScrub(null);
    },
    [seekTo]
  );

  /* ------------------------------------------------------------------ */
  /*  Up-next countdown                                                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!upNext) {
      setUpNextOpen(false);
      setCountdown(null);
      return;
    }
    const remaining = duration - time;
    if (remaining <= UP_NEXT_LEAD) {
      setUpNextOpen(true);
      setCountdown(Math.max(0, Math.ceil(remaining)));
    }
  }, [upNext, duration, time]);

  // Counts down in real time rather than jumping on media-time ticks, so it
  // stays smooth even when playback is buffering.
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) {
      upNext?.onPlay();
      setUpNextOpen(false);
    }
  }, [countdown, upNext]);

  /* Pause while the up-next card is up, unless autoplay is on. */
  useEffect(() => {
    if (!upNextOpen || autoplayNextEpisode) return;
    videoRef.current?.pause();
  }, [upNextOpen, autoplayNextEpisode]);

  /* ------------------------------------------------------------------ */
  /*  Keyboard shortcuts                                                */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(10);
          break;
        case 'l':
        case 'L':
          seekBy(30);
          break;
        case 'j':
        case 'J':
          seekBy(-30);
          break;
        case 'm':
        case 'M':
          setMuted((m) => !m);
          break;
        case 'Escape':
          if (extras) setExtras(false);
          else if (menuOpen) setMenuOpen(false);
          else onExit?.();
          break;
        default:
          break;
      }
      revealChrome();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle, seekBy, extras, menuOpen, onExit, revealChrome]);

  const shownTime = scrub ?? time;

  /**
   * Tapping the picture never pauses. It only walks one level deeper into the
   * controls: hidden → transport bar, transport bar → the extras panel with
   * volume, skip and speed. Pausing is the play button's job alone.
   */
  const onPictureTap = useCallback(() => {
    if (upNextOpen) return;
    if (!chrome) {
      revealChrome();
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setExtras((e) => {
      if (e) revealChrome();
      return !e;
    });
  }, [chrome, menuOpen, upNextOpen, revealChrome]);

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden bg-black"
      onClick={onPictureTap}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        // No `crossOrigin`: it applies a CORS check that most stream hosts
        // fail, which silently kills playback entirely.
        onPlay={() => {
          setPlaying(true);
          setStalled(false);
          revealChrome();
        }}
        onPause={() => {
          setPlaying(false);
          setChrome(true);
        }}
        onTimeUpdate={onTime}
        onProgress={onTime}
        onLoadedMetadata={() => {
          setLoading(false);
          const v = videoRef.current;
          if (v) setDuration(Number.isFinite(v.duration) ? v.duration : 0);
        }}
        onWaiting={() => setStalled(true)}
        onPlaying={() => setStalled(false)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => onEnded?.()}
        onError={() => {
          setLoading(false);
          setError('This source could not be played.');
        }}
        className="h-full w-full bg-black object-contain"
      />

      {/* Loading / stalled */}
      {(loading || stalled) && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-11 w-11 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <p className="text-sm text-white/80">{error}</p>
          {onExit && (
            <button onClick={onExit} className="btn btn-secondary px-4 py-2 text-sm">
              Go back
            </button>
          )}
        </div>
      ) : null}

      {/* Paused: a large, tappable play target in the middle of the picture. */}
      {!playing && !error && !upNextOpen ? (
        <button
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      ) : null}

      {/* ±10s flash */}
      {seekFlash ? (
        <div
          key={seekFlash.at}
          className="fade-in pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
            <SkipGlyph dir={seekFlash.dir} size={44} label={String(Math.round(seekFlash.at))} />
          </span>
        </div>
      ) : null}

      {/* Volume overlay */}
      {volumeFlash !== null ? (
        <div className="fade-in pointer-events-none absolute right-5 top-1/2 z-10 -translate-y-1/2">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/60 px-3 py-4 backdrop-blur-sm">
            <span className="text-sm font-semibold tabular-nums text-white">
              {Math.round(volumeFlash * 100)}%
            </span>
            <div className="h-24 w-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="w-full rounded-full bg-white"
                style={{ height: `${volumeFlash * 100}%`, marginTop: `${(1 - volumeFlash) * 96}px` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Top bar */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 to-transparent px-3 pb-8 pt-3 transition-opacity duration-300',
          chrome ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onExit?.()}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h2>
            {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 transition-opacity duration-300',
          chrome ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrub bar with buffered range */}
        <div className="group relative mb-3 h-4 w-full touch-none">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
            <div
              className="absolute inset-y-0 left-0 bg-white/25"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-accent)]"
              style={{ width: `${duration > 0 ? (shownTime / duration) * 100 : 0}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={shownTime}
            aria-label="Seek"
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={(e) => commitScrub(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => commitScrub(Number((e.target as HTMLInputElement).value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${duration > 0 ? (shownTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Scrub preview time */}
        {scrub !== null ? (
          <div
            className="pointer-events-none absolute -top-1 z-30 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-xs font-medium tabular-nums text-white"
            style={{ left: `${duration > 0 ? (scrub / duration) * 100 : 0}%` }}
          >
            {fmtTime(scrub)}
          </div>
        ) : null}

        <div className="flex items-center gap-1 sm:gap-2">
          {hasPrevious ? (
            <IconBtn label="Previous episode" onClick={onPrevious}>
              <path d="M11 6 5 12l6 6M19 6l-6 6 6 6" />
            </IconBtn>
          ) : null}

          <button
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            {playing ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => seekBy(-10)}
            aria-label="Back 10 seconds"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
          >
            <SkipGlyph dir={-1} />
          </button>

          <button
            onClick={() => seekBy(10)}
            aria-label="Forward 10 seconds"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
          >
            <SkipGlyph dir={1} />
          </button>

          {onNext ? (
            <button
              onClick={onNext}
              aria-label="Next episode"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : null}

          <span className="ml-1 flex-none text-xs tabular-nums text-white/85">
            {fmtTime(shownTime)} <span className="text-white/45">/ {fmtTime(duration)}</span>
          </span>

          <div className="flex flex-1 items-center justify-end gap-1">
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            >
              {muted || volume === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              )}
            </button>

            {/* Opens the extras panel: volume, skip and speed in one place. */}
            <button
              onClick={() => setExtras((e) => !e)}
              aria-label="Volume, skip and speed"
              aria-expanded={extras}
              className={cn(
                'flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors hover:bg-white/10',
                extras ? 'bg-white/20 text-white' : 'text-white/90'
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h9M17 7h3M4 17h3M11 17h9" />
                <circle cx="15" cy="7" r="2" />
                <circle cx="9" cy="17" r="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Extras panel — the second tap on the picture. */}
      {extras && chrome ? (
        <div
          className="pop-in absolute inset-x-0 bottom-[104px] z-20 mx-auto w-[min(92%,26rem)] sm:bottom-[112px]"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Playback options"
        >
          <div className="rounded-2xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur-xl">
            {/* Skip */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                className="flex flex-col items-center gap-1 text-white/85 transition-transform active:scale-90"
              >
                <SkipGlyph dir={-1} size={40} />
                <span className="text-[10px] font-medium">10s</span>
              </button>
              <button
                onClick={toggle}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white transition-transform active:scale-90"
              >
                {playing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                className="flex flex-col items-center gap-1 text-white/85 transition-transform active:scale-90"
              >
                <SkipGlyph dir={1} size={40} />
                <span className="text-[10px] font-medium">10s</span>
              </button>
            </div>

            {/* Volume */}
            <div className="mt-4 flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="flex-none text-white/70"
                aria-hidden
              >
                {muted || volume === 0 ? (
                  <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />
                ) : (
                  <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                )}
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                  setVolumeFlash(v);
                  setTimeout(() => setVolumeFlash(null), 700);
                }}
                className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
              />
              <span className="w-9 flex-none text-right text-[11px] font-semibold tabular-nums text-white/80">
                {Math.round((muted ? 0 : volume) * 100)}%
              </span>
            </div>

            {/* Speed */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors',
                    speed === s ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
                  )}
                >
                  {s === 1 ? 'Normal' : `${s}×`}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Next episode takeover */}
      {upNextOpen && upNext ? (
        <div
          className="pop-in absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md text-center">
            <h3 className="text-lg font-semibold text-white">Next episode</h3>
            <p className="mt-1 text-sm text-white/60">{upNext.sublabel ?? upNext.label}</p>

            {countdown !== null && countdown > 0 ? (
              <div className="relative mx-auto mt-7 h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden>
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="4" />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 36}
                    strokeDashoffset={2 * Math.PI * 36 * (1 - (countdown ?? 0) / Math.ceil(UP_NEXT_LEAD))}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums text-white">
                  {countdown}
                </span>
              </div>
            ) : null}

            <div className="mt-7 flex items-center justify-center gap-3">
              <button onClick={upNext.onCancel} className="btn btn-secondary px-5 py-2.5 text-sm text-white">
                Cancel
              </button>
              <button onClick={upNext.onPlay} className="btn btn-primary px-5 py-2.5 text-sm">
                Play Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bits                                                               */
/* ------------------------------------------------------------------ */

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/**
 * Circular "replay 10 / forward 10" arrow with the number set inside it.
 *
 * Built from an arc plus an HTML label rather than an SVG <text>: the WebView
 * renders <text> inside a stroked <svg> at the wrong baseline and size, which
 * is what made the old buttons look broken.
 */
function SkipGlyph({
  dir,
  size = 20,
  label = '10',
}: {
  dir: -1 | 1;
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="relative flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Mirroring the glyph is more reliable than hand-writing a second path.
        style={{ transform: dir === -1 ? 'scaleX(-1)' : undefined }}
        aria-hidden
      >
        <path d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4" />
        <path d="M20.5 2.9V7h-4.1" />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold leading-none"
        style={{ fontSize: size * 0.34, paddingTop: size * 0.04 }}
      >
        {label}
      </span>
    </span>
  );
}

export function ShortcutHint({ items }: { items: { key: string; label: string }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((i) => (
        <div key={i.key} className="contents">
          <dt>
            <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
              {i.key}
            </kbd>
          </dt>
          <dd className="text-text-secondary">{i.label}</dd>
        </div>
      ))}
    </dl>
  );
}
