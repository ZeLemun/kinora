import { useEffect, useRef, useState } from 'react';
import { immersive } from '../services/immersive';

/**
 * Plays an `embed` source: a whole web page in an <iframe>.
 *
 * A trailer is one of these (YouTube), and so is a provider page that runs its
 * own player internally. The provider owns everything inside the frame — its
 * controls, its ad breaks, its buffering — so this component deliberately
 * exposes only what the host app can still control: leaving the player,
 * reloading a frame that wedged, and moving between sources.
 *
 * It does NOT reimplement a seek bar or a play/pause button. An <iframe> is an
 * opaque document: there is no `currentTime` to write to and no `paused` to set,
 * so a control bar drawn here would be decoration that does nothing. The
 * provider's own controls are already inside the frame.
 */
export function EmbedPlayer({
  src,
  title,
  onExit,
  onSwitchSource,
}: {
  src: string;
  title: string;
  onExit: () => void;
  onSwitchSource?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  /** Bumped to force a fresh document — the recovery path for a wedged frame. */
  const [reloadKey, setReloadKey] = useState(0);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Same full-bleed contract as VideoPlayer: a portrait player leaves most of a
     phone screen black, and landscape is held for as long as this is mounted. */
  useEffect(() => {
    immersive.enter();
    immersive.setLandscape(true);
    return () => {
      immersive.exit();
      immersive.setLandscape(false);
    };
  }, []);

  /* Many of these providers show an interstitial or an ad break before the
     player appears. Reloading has to be reachable, otherwise a frame that
     stalls on its own ad server leaves the viewer with no way out but back. */
  useEffect(() => {
    setLoading(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit, reloadKey, src]);

  const revealChrome = () => {
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeVisible(false), 3200);
  };

  const [chromeVisible, setChromeVisible] = useState(true);

  /* A tap anywhere on the frame is swallowed by the provider's own controls, so
     chrome is revealed on load and on tap-over rather than auto-hiding fast. */
  useEffect(() => {
    revealChrome();
    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reloadKey]);

  return (
    <div className="relative h-full w-full bg-black">
      <iframe
        key={`${src}#${reloadKey}`}
        src={src}
        title={title}
        onLoad={() => setLoading(false)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="origin"
        className="h-full w-full border-0"
      />

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : null}

      {/* Chrome. Kept mounted and toggled by opacity so switching sources never
          remounts the iframe and restarts playback. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity duration-300 ${
          chromeVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={onExit}
          aria-label="Close player"
          className="pointer-events-auto flex h-10 w-10 flex-none items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{title}</span>

        {onSwitchSource ? (
          <button
            onClick={onSwitchSource}
            aria-label="Change source"
            className="pointer-events-auto flex flex-none gap-1.5 rounded-full bg-black/55 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Sources
          </button>
        ) : null}

        <button
          onClick={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
            revealChrome();
          }}
          aria-label="Reload player"
          className="pointer-events-auto flex h-10 w-10 flex-none items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 9a8 8 0 0 0-14.7-3M4 15a8 8 0 0 0 14.7 3" />
          </svg>
        </button>
      </div>

      {/* Tap surface: first tap brings the chrome back if it faded. */}
      <button
        onClick={revealChrome}
        aria-label="Show player controls"
        className="absolute inset-x-0 bottom-0 h-24"
      />
    </div>
  );
}
