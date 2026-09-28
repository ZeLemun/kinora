import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Media, MediaSource } from '../store/app-store';

/**
 * Playback state lives above the router so that navigating away from a playing
 * title can hand the video to the mini player instead of tearing it down. The
 * <video> element itself always lives in the PlayerPage; this only records
 * which media and source are loaded so the mini bar can be rendered anywhere.
 */

export interface PlaybackTarget {
  media: Media;
  source: MediaSource;
  /** For series, the episode currently loaded. */
  season?: number;
  episode?: number;
  episodeTitle?: string;
  poster?: string;
}

interface PlayerApi {
  target: PlaybackTarget | null;
  /** Bumped to ask the player page to start a different source. */
  play: (target: PlaybackTarget) => void;
  stop: () => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PlaybackTarget | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = useCallback((next: PlaybackTarget) => {
    setTarget((cur) =>
      // Re-clicking the same source is a no-op, so the video does not restart.
      cur && cur.media.id === next.media.id && cur.source.url === next.source.url && cur.episode === next.episode
        ? cur
        : next
    );
  }, []);

  const stop = useCallback(() => {
    setTarget(null);
    setPlaying(false);
  }, []);

  const api = useMemo(
    () => ({ target, play, stop, playing, setPlaying }),
    [target, play, stop, playing]
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  return (
    useContext(PlayerContext) ?? {
      target: null,
      play: () => undefined,
      stop: () => undefined,
      playing: false,
      setPlaying: () => undefined,
    }
  );
}
