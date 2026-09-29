import { useEffect, useRef, useState } from 'react';
import { immersive } from '../services/immersive';
import { withAutoplay } from '../services/embed-providers';

/**
 * Plays an `embed` source: a whole web page in an <iframe>.
 *
 * A trailer is one of these (YouTube), and so is a provider page that runs its
 * own player internally. The provider owns everything inside the frame — its
 * controls, its ad breaks, its buffering — so this component deliberately
 * exposes only what the host app can still control: leaving the player,
 * reloading a frame that wedged, and moving between sources.
 *
 * It does NOT reimplement a seek bar, a play/pause button, subtitles, volume or
 * settings. An <iframe> is an opaque cross-origin document: there is no
 * `currentTime` to write to, no `paused` to set, and no subtitle track list to
 * read, so controls drawn here would be decoration that does nothing. The
 * provider's own versions are already inside the frame, and those are the ones
 * that actually work. Anything the host app wants to control has to be a direct
 * file source rather than an embed.
 *
 * The chrome is persistent rather than auto-hiding for the same reason: this
 * player does not own the transport, so it cannot re-show a control bar on tap
 * the way VideoPlayer does. Fading would leave the viewer with no way out.
 */
export function EmbedPlayer({
  src,
  title,
  providerName,
  providerId,
  onExit,
  onSwitchSource,
}: {
  src: string;
  /** Used for the iframe's accessible name only — never rendered on screen. */
  title: string;
  /** Shown in the app's own bar, e.g. "VidSrc". The provider shows the title. */
  providerName?: string;
  /** Used to look up the provider's autoplay flag. */
  providerId?: string;
  onExit: () => void;
  onSwitchSource?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  /** Bumped to force a fresh document — the recovery path for a wedged frame. */
  const [reloadKey, setReloadKey] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);

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

  /* `onExit` is intentionally NOT a dependency below. The parent recreates that
     closure every render, so including it re-ran this effect constantly and
     `setLoading(true)` re-asserted itself forever: the spinner never cleared
     and, because it covers the screen, it swallowed every tap meant for the
     provider's own controls. Held in a ref instead. */
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  /* Escape exits. Bound once, on the ref, so the listener is never torn down
     and re-added on every render. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Loading is tied to the frame's own document, nothing else. */
  useEffect(() => {
    setLoading(true);
  }, [reloadKey, src]);

  /* The bar hides while the film is being watched and comes back on a tap near
     the top edge. It is not a full-screen tap target: the provider's own
     controls live under this frame, and a screen-wide catcher would eat every
     press meant for them. */
  useEffect(() => {
    const timer = setTimeout(() => setChromeVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [chromeVisible, src, reloadKey]);

  const revealChrome = () => setChromeVisible(true);

  return (
    /* `isolate` matters: once the provider's video starts, the <iframe> is
       promoted to its own compositing layer and paints over anything that is
       merely a sibling. Without an isolated stacking context the top bar gets
       swallowed exactly when it is needed most — while the film is playing. */
    <div className="relative isolate h-full w-full bg-black">
      <iframe
        key={`${src}#${reloadKey}`}
        /* Autoplay is requested on the URL *and* permitted by `allow` below.
           Either alone is ignored by the browser, and the two failures look
           identical from here: a player sitting on its poster. */
        src={providerId ? withAutoplay(src, providerId) : src}
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
      {/*
        Persistent-while-wanted chrome. It hides itself while the film is being
        watched and returns on a tap near the top edge.

        `z-30` plus the `isolate` on the container are load-bearing: the frame
        gets its own compositing layer the moment video starts, and without
        both it painted straight over this bar.
      */}
      <div
        className={`absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-black/85 via-black/45 to-transparent p-2.5 transition-opacity duration-200 ${
          chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          onClick={onExit}
          aria-label="Back to title"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors active:bg-black/85"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* No title here. The provider draws its own over the video, and
            printing a second one stacked on top of it was the duplicate the
            viewer saw in the corner. The source name is still worth knowing, so
            only the provider is named. */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
          {providerName}
        </span>

        {onSwitchSource ? (
          <button
            onClick={onSwitchSource}
            aria-label="Change source"
            className="flex flex-none gap-1.5 rounded-full bg-black/60 px-3.5 py-2.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors active:bg-black/85"
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
          }}
          aria-label="Reload player"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors active:bg-black/85"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 9a8 8 0 0 0-14.7-3M4 15a8 8 0 0 0 14.7 3" />
          </svg>
        </button>
      </div>

      {/*
        Tap target for bringing the bar back.

        Mounted ONLY while the bar is hidden. When it was always present it sat
        above the frame's own top controls and swallowed their taps, which is
        why pressing a player button needed several tries: the first press hit
        this invisible catcher, and the app looked unresponsive.
      */}
      {!chromeVisible ? (
        <button
          onClick={revealChrome}
          aria-label="Show player controls"
          className="absolute inset-x-0 top-0 z-20 h-16"
        />
      ) : null}
    </div>
  );
}
