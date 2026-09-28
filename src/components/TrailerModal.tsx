import { useEffect, useState } from 'react';
import { XIcon } from './ui';

/**
 * In-app trailer playback.
 *
 * These come from TMDB's /videos endpoint, which returns YouTube ids rather
 * than media files — TMDB hosts no video content itself. Embedding the YouTube
 * player is the one form of "play something" that works without an account.
 */
export function TrailerModal({ videoKey, onClose }: { videoKey: string; onClose: () => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fade-in fixed inset-0 z-[110] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Trailer"
    >
      <div className="flex flex-none items-center justify-end p-2">
        <button
          onClick={onClose}
          aria-label="Close trailer"
          className="rounded-full p-2 text-white/90 transition-colors hover:bg-white/10"
        >
          <XIcon />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <iframe
          // `youtube-nocookie` still sets its own cookies, but it does not
          // touch the viewer's until play, and it blocks the ad/analytics
          // preload requests the regular embed makes.
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
          title="Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full border-0"
        />
        {!ready ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            onLoad={() => setReady(true)}
          >
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
