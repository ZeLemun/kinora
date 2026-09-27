import { useEffect, useRef, useState } from 'react';
import type { Stream, Subtitle } from '../addon-types';

interface PlayerModalProps {
  stream: Stream;
  subtitles: Subtitle[];
  title: string;
  onClose: () => void;
  /** Supplied for series so the player can roll into the next episode. */
  onNext?: () => void;
  nextLabel?: string;
  /** Progress callback so the parent can persist continue-watching. */
  onProgress?: (seconds: number, duration: number) => void;
}

/** Show the next-episode prompt once this many seconds remain. */
const NEXT_EPISODE_AT = 20;
const COUNTDOWN_SECONDS = 5;

/**
 * Native HLS/MP4 playback. Both Android WebView and iOS WKWebView can play
 * HLS natively, so no JS player is required.
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
  const [activeSub, setActiveSub] = useState<string>('');
  const [tracks, setTracks] = useState<Subtitle[]>(subtitles);
  const [showNext, setShowNext] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    setTracks(subtitles);
  }, [subtitles]);

  // Reset the next-episode prompt whenever the source changes.
  useEffect(() => {
    setShowNext(false);
    setCountdown(COUNTDOWN_SECONDS);
  }, [stream.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const textTracks = video.textTracks;
    for (let i = 0; i < textTracks.length; i++) textTracks[i].mode = 'disabled';
    if (activeSub) {
      const index = subtitles.findIndex((s) => s.id === activeSub);
      if (index >= 0 && textTracks[index]) textTracks[index].mode = 'showing';
    }
  }, [activeSub, subtitles]);

  // Watch the clock: surface the prompt near the end, then roll over.
  useEffect(() => {
    if (!onNext) return;
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      onProgress?.(video.currentTime, video.duration || 0);
      const remaining = (video.duration || 0) - video.currentTime;
      if (remaining > 0 && remaining <= NEXT_EPISODE_AT) setShowNext(true);
    };
    const onEnded = () => setShowNext(true);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, [onNext, onProgress]);

  // Auto-advance once the prompt has been up for a few seconds.
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

  const hasUrl = typeof stream.url === 'string' && /^https?:\/\//i.test(stream.url);
  const notWebReady = stream.behaviorHints?.notWebReady === true;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex flex-none items-center gap-3 px-3 py-2">
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
          aria-label="Chiudi"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h3 className="text-hero-shadow-sm min-w-0 flex-1 truncate text-sm font-medium text-white">
          {title}
        </h3>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        {hasUrl ? (
          <video
            ref={videoRef}
            src={stream.url}
            controls
            autoPlay
            playsInline
            crossOrigin="anonymous"
            className="h-full w-full"
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
        ) : (
          <div className="max-w-md space-y-2 px-6 text-center text-sm text-white/80">
            <p>{notWebReady ? p2pReason : noUrlReason}</p>
            {stream.behaviorHints?.filename && (
              <p className="break-all text-xs text-white/50">{stream.behaviorHints.filename}</p>
            )}
          </div>
        )}

        {/* Next-episode prompt */}
        {showNext && onNext && (
          <div className="absolute inset-x-0 bottom-0 flex justify-end p-4">
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l10 8-10 8V4z" />
                <path d="M18 4v16" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              {nextLabel}
              <span className="rounded bg-black/25 px-1.5 text-xs tabular-nums">{countdown}</span>
            </button>
          </div>
        )}
      </div>

      {tracks.length > 0 && (
        <div className="flex flex-none gap-2 overflow-x-auto scrollbar-hide border-t border-white/10 px-3 py-2">
          <button
            onClick={() => setActiveSub('')}
            className={
              activeSub === ''
                ? 'flex-none rounded-full bg-primary px-3 py-1 text-xs font-medium text-white'
                : 'flex-none rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80'
            }
          >
            Off
          </button>
          {tracks.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setActiveSub(sub.id)}
              className={
                activeSub === sub.id
                  ? 'flex-none rounded-full bg-primary px-3 py-1 text-xs font-medium text-white'
                  : 'flex-none rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80'
              }
            >
              {sub.title || sub.lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const p2pReason =
  'Questo flusso usa il protocollo torrent (P2P) e non puo essere riprodotto in questa app. ' +
  'Configura un servizio debrid (Real-Debrid, TorBox, AllDebrid) in un add-on per ottenere link HTTP diretti.';

const noUrlReason =
  'Questo flusso non espone un indirizzo web riproducibile. ' +
  'Configura un servizio debrid in un add-on per ottenere link HTTP diretti.';
