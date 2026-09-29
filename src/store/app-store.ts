import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

/* ------------------------------------------------------------------ */
/*  Media model                                                        */
/* ------------------------------------------------------------------ */

export type MediaType = 'movie' | 'series';

export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  overview: string;
  runtime: number; // minutes
  still?: string; // 16:9 image
  airDate?: string;
}

export interface Season {
  season: number;
  name: string;
  overview?: string;
  poster?: string;
  episodes: Episode[];
}

export interface Media {
  id: string;
  type: MediaType;
  title: string;
  poster?: string;
  backdrop?: string;
  logo?: string;
  overview: string;
  year?: number;
  runtime?: number; // minutes
  rating?: number;
  genres: string[];
  cast: { id: number; name: string; character?: string; profile?: string }[];
  director?: string;
  certification?: string;
  language?: string;
  /** IMDb id, used to look up the OMDb ratings. */
  imdbId?: string;
  /** Filled in from OMDb; TMDB's own score stays in `rating`. */
  imdbRating?: number;
  imdbVotes?: number;
  metascore?: number;
  /** Present for series. */
  seasons?: Season[];
  /** Playable sources, in priority order. First playable wins on "Play". */
  sources?: MediaSource[];
  trailerKey?: string;
}

export interface MediaSource {
  url: string;
  label: string;
  quality?: string;
  /**
   * `free`  — a real video file; handed to <video src> after a health check.
   * `embed` — a page to put in an <iframe> (a YouTube trailer). Never probed,
   *           and never passed to <video>, which would reject the page URL.
   */
  kind: 'free' | 'embed';
}

/* ------------------------------------------------------------------ */
/*  Library / progress records                                         */
/* ------------------------------------------------------------------ */

export interface ProgressRecord {
  mediaId: string;
  type: MediaType;
  title: string;
  poster?: string;
  backdrop?: string;
  /** seconds watched */
  time: number;
  /** seconds total */
  duration: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  /**
   * UI language. This is a preference only: the catalogue is fetched from TMDB
   * in a fixed locale, so changing it does not yet re-fetch in that language.
   */
  language: string;
  autoplayNextEpisode: boolean;
  rememberPosition: boolean;
  skipIntro: boolean;
}

interface AppState {
  progress: Record<string, ProgressRecord>;
  watchlist: string[];
  favorites: string[];
  history: string[];
  settings: Settings;

  setProgress: (record: ProgressRecord) => void;
  clearProgress: (mediaId: string) => void;
  toggleWatchlist: (mediaId: string) => 'added' | 'removed';
  toggleFavorite: (mediaId: string) => 'added' | 'removed';
  removeFromWatchlist: (mediaId: string) => void;
  removeFavorite: (mediaId: string) => void;
  clearHistory: () => void;
  markWatched: (mediaId: string, type: MediaType, title: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
}

const defaultSettings: Settings = {
  theme: 'dark',
  language: 'en',
  autoplayNextEpisode: true,
  rememberPosition: true,
  skipIntro: false,
};

const EMPTY = { progress: {}, watchlist: [], favorites: [], history: [], settings: defaultSettings };

/** Key used to look a record up regardless of season/episode. */
export const mediaKey = (mediaId: string) => mediaId;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      setProgress: (record) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [mediaKey(record.mediaId)]: { ...record, updatedAt: Date.now() },
          },
        })),

      clearProgress: (mediaId) =>
        set((s) => {
          const next = { ...s.progress };
          delete next[mediaKey(mediaId)];
          return { progress: next };
        }),

      toggleWatchlist: (mediaId) => {
        const has = get().watchlist.includes(mediaId);
        set((s) => ({
          watchlist: has
            ? s.watchlist.filter((id) => id !== mediaId)
            : [...s.watchlist, mediaId],
        }));
        return has ? 'removed' : 'added';
      },

      toggleFavorite: (mediaId) => {
        const has = get().favorites.includes(mediaId);
        set((s) => ({
          favorites: has ? s.favorites.filter((id) => id !== mediaId) : [...s.favorites, mediaId],
        }));
        return has ? 'removed' : 'added';
      },

      removeFromWatchlist: (mediaId) =>
        set((s) => ({ watchlist: s.watchlist.filter((id) => id !== mediaId) })),

      removeFavorite: (mediaId) =>
        set((s) => ({ favorites: s.favorites.filter((id) => id !== mediaId) })),

      clearHistory: () => set({ history: [] }),

      markWatched: (mediaId, type, title) =>
        set((s) => ({
          history: [mediaId, ...s.history.filter((id) => id !== mediaId)].slice(0, 200),
          progress: {
            ...s.progress,
            [mediaKey(mediaId)]: {
              mediaId,
              type,
              title,
              time: 1,
              duration: 1,
              updatedAt: Date.now(),
            },
          },
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetAll: () => set({ ...EMPTY, settings: { ...defaultSettings } }),
    }),
    {
      name: 'kinora-library',
      version: 1,
      partialize: (s) => ({
        progress: s.progress,
        watchlist: s.watchlist,
        favorites: s.favorites,
        history: s.history,
        settings: s.settings,
      }),
    }
  )
);

/* ------------------------------------------------------------------ */
/*  Selectors                                                          */
/* ------------------------------------------------------------------ */

export const useIsInWatchlist = (id: string) =>
  useAppStore((s) => s.watchlist.includes(id));
export const useIsFavorite = (id: string) => useAppStore((s) => s.favorites.includes(id));
export const useProgressFor = (id: string) => useAppStore((s) => s.progress[mediaKey(id)]);

/**
 * These two derive a *new array* from store state, so they must be compared
 * shallowly. Without it every snapshot is a fresh reference, `useSyncExternalStore`
 * sees the value change on every read, and React spins forever
 * ("Maximum update depth exceeded", error #185).
 */
export const useContinueWatching = () =>
  useAppStore(
    useShallow((s) =>
      Object.values(s.progress)
        .filter((p) => p.duration > 0 && p.time > 0 && p.time / p.duration < 0.95)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    )
  );

export const useHistory = () => useAppStore(useShallow((s) => [...s.history].reverse()));

/** Watchlist as a stable array reference (for iteration). */
export const useWatchlist = () => useAppStore(useShallow((s) => s.watchlist));

/** Favorites as a stable array reference (for iteration). */
export const useFavorites = () => useAppStore(useShallow((s) => s.favorites));

/** Theme selector - stable reference for theme value. */
export const selectTheme = (s: AppState) => s.settings.theme;

/** Autoplay next episode setting. */
export const selectAutoplayNextEpisode = (s: AppState) => s.settings.autoplayNextEpisode;

/** Remember position setting. */
export const selectRememberPosition = (s: AppState) => s.settings.rememberPosition;

/** Whether the player offers a "Skip Intro" control. */
export const selectSkipIntro = (s: AppState) => s.settings.skipIntro;

/** Progress record for a specific media ID. */
export const selectProgressFor = (id: string) => (s: AppState) => s.progress[mediaKey(id)];

/** Set progress action. */
export const selectSetProgress = (s: AppState) => s.setProgress;

/** Mark watched action. */
export const selectMarkWatched = (s: AppState) => s.markWatched;

/** Clear progress action. */
export const selectClearProgress = (s: AppState) => s.clearProgress;

/** Toggle watchlist action. */
export const selectToggleWatchlist = (s: AppState) => s.toggleWatchlist;

/** Toggle favorite action. */
export const selectToggleFavorite = (s: AppState) => s.toggleFavorite;

/** Set progress action. */
export const selectSetProgressAction = (s: AppState) => s.setProgress;

/** Mark watched action. */
export const selectMarkWatchedAction = (s: AppState) => s.markWatched;
