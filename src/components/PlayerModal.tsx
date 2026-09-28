import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { immersive } from '../services/immersive';
import type { Stream, Subtitle } from '../addon-types';

interface PlayerModalProps {
  stream: Stream;
  subtitles: Subtitle[];
  title: string;
  onClose: () => void;
  /** Supplied for series so the player can roll into the next episode. */
  onNext?: () => void;
  nextLabel?: string;
  onProgress?: (seconds: number, duration: number) => void;
}

/** Show the next-episode prompt once this many seconds remain. */
const NEXT_EPISODE_AT = 20;
const COUNTDOWN_SECONDS = 8;
const CONTROLS_HIDE_MS = 3200;

const p2pReason =
  'This source uses the torrent (P2P) protocol and cannot be played in this app. ' +
  'Configure a debrid service (Real-Debrid, TorBox, AllDebrid) in an add-on to get direct HTTP links.';
const noUrlReason =
  'This source does not expose a playable web address. ' +
  'Configure a debrid service in an add-on to get direct HTTP links.';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/**
 * Netflix-style full-screen player: tap to toggle chrome, chrome auto-hides,
 * scrubbing bar, volume, fullscreen and a next-episode takeover.
 */
export function PlayerModal({
  stream,
  subtitles,
  title,
  onClose,
  onNext,
  nextLabel,
  onProgress,
}: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tracks, setTracks] = useState<Subtitle[]>(subtitles);
  const [activeSub, setActiveSub] = useState<string>('');
  const [showNext, setShowNext] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const [chrome, setChrome] = useState(true);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [subsOpen, setSubsOpen] = useState(false);

  const hasUrl = typeof stream.url === 'string' && /^https?:\/\//i.test(stream.url);

  // Watching always means landscape, full screen, no system bars.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let locked = false;

    ScreenOrientation.lock({ orientation: 'landscape' })
      .then(() => {
        locked = true;
      })
      .catch(() => undefined);
    StatusBar.hide().catch(() => undefined);
    void immersive.enter();
    // Some WebViews honour this as immersive mode too.
    document.documentElement.requestFullscreen?.().catch(() => undefined);

    // Bars come back after a transient swipe; hide them again once chrome returns.
    const onVisibility = () => {
      if (chrome) void immersive.reapply();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      void immersive.exit();
      StatusBar.show().catch(() => undefined);
      if (locked) ScreenOrientation.unlock().catch(() => undefined);
    };
  }, [chrome]);

  useEffect(() => setTracks(subtitles), [subtitles]);

  useEffect(() => {
    setShowNext(false);
    setCountdown(COUNTDOWN_SECONDS);
    setFailed(null);
    setCurrent(0);
    setDuration(0);
  }, [stream.url]);

  // Reset the takeover whenever the source changes.
  useEffect(() => {
    if (!onNext) setShowNext(false);
  }, [onNext, stream.url]);

  // --- keyboard shortcuts (desktop / TV remotes) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          bumpChrome();
          break;
        case 'ArrowLeft':
          video.currentTime = Math.max(0, video.currentTime - 10);
          bumpChrome();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          setMuted((m) => {
            video.muted = !m;
            return !m;
          });
          break;
        case 'Escape':
          document.fullscreenElement ? document.exitFullscreen() : onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const bumpChrome = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) setChrome(false);
    }, CONTROLS_HIDE_MS);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
    bumpChrome();
  }, [bumpChrome]);

  /**
   * Jump by `delta` seconds. Resumes playback when the clip had ended, and
   * refuses to run before metadata is known — otherwise currentTime is NaN and
   * the browser jumps to 0 or to the end instead of seeking.
   */
  const skipBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const target = Math.max(0, Math.min(video.duration - 0.25, video.currentTime + delta));
    video.currentTime = target;
    setCurrent(target);
    if (video.ended || video.paused) {
      void video.play().catch(() => undefined);
      setPaused(false);
    }
    bumpChrome();
  }, [bumpChrome]);

  const toggleFullscreen = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      // Native immersive mode also drops the gesture/nav bar.
      void immersive.enter();
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, seconds));
    setCurrent(video.currentTime);
  };

  // --- media element wiring ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration || 0);
      setWaiting(false);
    };
    const onTime = () => {
      if (!scrubbing) setCurrent(video.currentTime);
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
      onProgress?.(video.currentTime, video.duration || 0);
      const remaining = (video.duration || 0) - video.currentTime;
      if (onNext && remaining > 0 && remaining <= NEXT_EPISODE_AT) setShowNext(true);
    };
    const onEnded = () => {
      setPaused(true);
      if (onNext) setShowNext(true);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => {
      setWaiting(false);
      setPaused(false);
      setFailed(null);
    };
    const onError = () => {
      setWaiting(false);
      setPaused(true);
      setFailed('Playback failed. The source may be offline or block direct playback.');
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('durationchange', onLoaded);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', onTime);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('durationchange', onLoaded);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', onTime);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
    };
  }, [onNext, onProgress, scrubbing]);

  // Text-track mode sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tt = video.textTracks;
    for (let i = 0; i < tt.length; i++) tt[i].mode = 'disabled';
    if (activeSub) {
      const index = subtitles.findIndex((s) => s.id === activeSub);
      if (index >= 0 && tt[index]) tt[index].mode = 'showing';
    }
  }, [activeSub, subtitles, tracks]);

  // Auto-advance once the takeover has been up long enough.
  useEffect(() => {
    if (!showNext || !onNext) return;
    setCountdown(COUNTDOWN_SECONDS);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onNext();
          return COUNTDOWN_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showNext, onNext]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const barTime = scrubbing ? scrubTime : current;
  const pct = duration > 0 ? (barTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      onMouseMove={bumpChrome}
      onTouchStart={bumpChrome}
    >
      <video
        ref={videoRef}
        src={hasUrl ? stream.url : undefined}
        autoPlay
        playsInline
        // NB: deliberately no crossOrigin — forcing it applies a CORS check that
        // most stream/CDN hosts (including debrid links) do not satisfy, which
        // silently kills playback.
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="h-full w-full bg-black object-contain"
      >
        {tracks.map((sub) => (
          <track
            key={sub.id}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.lang}
            label={sub.title || sub.lang}
          />
        ))}
      </video>

      {!hasUrl && (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <div className="max-w-lg space-y-3 text-center">
            <p className="text-base text-white/90">
              {stream.behaviorHints?.notWebReady ? p2pReason : noUrlReason}
            </p>
            {stream.behaviorHints?.filename && (
              <p className="break-all text-xs text-white/40">{stream.behaviorHints.filename}</p>
            )}
            <p className="text-xs text-white/40">{stream.title}</p>
          </div>
        </div>
      )}

      {failed && (
        <div className="absolute inset-x-0 bottom-24 mx-auto max-w-md px-6 text-center text-sm text-red-500">
          {failed}
        </div>
      )}

      {/* Spinner */}
      {waiting && hasUrl && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-[var(--color-netflix)]" />
        </div>
      )}

      {/* Next-episode takeover */}
      {showNext && onNext && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-gradient-to-r from-black via-black/85 to-black/40 px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Up next</p>
          <h2 className="max-w-md text-center text-2xl font-bold text-white sm:text-3xl">
            {nextLabel}
          </h2>
          <div className="relative h-16 w-16">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="var(--color-netflix)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - countdown / COUNTDOWN_SECONDS)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <button
              onClick={onNext}
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Play now"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M6 4l14 8-14 8V4z" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setShowNext(false)}
            className="rounded-lg border border-white/25 px-5 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Top chrome */}
      <div
        className={`absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-4 pb-16 pt-3 transition-opacity duration-300 ${
          chrome || showNext ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <h3 className="text-hero-shadow-sm min-w-0 flex-1 truncate text-base font-semibold text-white sm:text-lg">
            {title}
          </h3>
        </div>
      </div>

      {/* Centre play/pause */}
      {chrome && !showNext && (
        <button
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 p-5 text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
            </svg>
          )}
        </button>
      )}

      {/* Bottom chrome */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 ${
          chrome || showNext ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Scrub bar */}
        <div
          className="group relative -mt-6 h-6 cursor-pointer"
          onMouseDown={(e) => {
            setScrubbing(true);
            const rect = e.currentTarget.getBoundingClientRect();
            const t = ((e.clientX - rect.left) / rect.width) * (duration || 0);
            setScrubTime(t);
          }}
          onMouseMove={(e) => {
            if (!scrubbing) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setScrubTime(((e.clientX - rect.left) / rect.width) * (duration || 0));
          }}
          onMouseUp={() => {
            seekTo(scrubTime);
            setScrubbing(false);
          }}
          onMouseLeave={() => scrubbing && (seekTo(scrubTime), setScrubbing(false))}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded bg-white/25">
            <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${bufPct}%` }} />
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-netflix)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-netflix)] opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="mt-1 flex items-center gap-4 text-white">
          <button onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l14 8-14 8V4z" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => skipBy(-10)}
            aria-label="Back 10 seconds"
            className="flex flex-none items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L7 9l4 4M7 9h7a6 6 0 110 12" />
            </svg>
            <span className="hidden sm:inline">10</span>
          </button>
          <button
            onClick={() => skipBy(10)}
            aria-label="Forward 10 seconds"
            className="flex flex-none items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l4 4-4 4M17 9h-7a6 6 0 100 12" />
            </svg>
            <span className="hidden sm:inline">10</span>
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              aria-label="Mute"
            >
              {muted || volume === 0 ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M22 9l-6 6M16 9l6 6" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                const el = videoRef.current;
                if (el) {
                  el.volume = v;
                  el.muted = v === 0;
                }
                setVolume(v);
                setMuted(v === 0);
              }}
              className="hidden h-1 w-24 cursor-pointer accent-[var(--color-netflix)] sm:block"
              aria-label="Volume"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/80">
            {formatTime(barTime)} <span className="text-white/45">/ {formatTime(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-4">
            {tracks.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setSubsOpen((o) => !o)}
                  aria-label="Subtitles"
                  className="rounded px-1 py-0.5 text-xs font-semibold"
                >
                  <span className="border-b-2 border-[var(--color-netflix)] pb-0.5">CC</span>
                </button>
                {subsOpen && (
                  <div className="absolute bottom-8 right-0 w-48 overflow-hidden rounded-lg bg-black/90 py-1 shadow-xl ring-1 ring-white/10">
                    <button
                      onClick={() => {
                        setActiveSub('');
                        setSubsOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        activeSub === '' ? 'text-[var(--color-netflix)]' : 'text-white/80'
                      }`}
                    >
                      Off
                    </button>
                    {tracks.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveSub(sub.id);
                          setSubsOpen(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          activeSub === sub.id ? 'text-[var(--color-netflix)]' : 'text-white/80'
                        }`}
                      >
                        {sub.title || sub.lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFullscreen} aria-label="Fullscreen">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
