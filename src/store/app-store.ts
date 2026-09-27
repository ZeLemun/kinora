import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LibraryItem, InstalledAddon } from '../addon-types';

interface AppState {
  theme: 'dark' | 'light' | 'system';
  language: string;
  serverUrl: string;
  installedAddons: InstalledAddon[];
  library: LibraryItem[];
  continueWatching: LibraryItem[];
  favorites: string[];
  searchHistory: string[];
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: string) => void;
  setServerUrl: (url: string) => void;
  addAddon: (addon: InstalledAddon) => void;
  removeAddon: (transportUrl: string) => void;
  toggleFavorite: (id: string) => void;
  addToLibrary: (item: LibraryItem) => void;
  removeFromLibrary: (type: string, id: string) => void;
  updateProgress: (type: string, id: string, progress: number, duration: number, season?: number, episode?: number) => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

const defaultAddons: InstalledAddon[] = [
  {
    manifest: {
      id: 'com.linvo.cinemeta',
      version: '3.0.14',
      name: 'Cinemeta',
      description: 'The official addon for movie and series catalogs',
      resources: ['catalog', 'meta', 'stream', 'subtitles', 'addon_catalog'],
      types: ['movie', 'series'],
      idPrefixes: ['tt'],
      catalogs: [
        { type: 'movie', id: 'top', name: 'Popular', extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }], genres: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'] },
        { type: 'series', id: 'top', name: 'Popular', extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }], genres: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western', 'Reality-TV', 'Talk-Show', 'Game-Show'] },
        { type: 'movie', id: 'year', name: 'New', extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }], genres: Array.from({ length: 107 }, (_, i) => String(2026 - i)) },
        { type: 'series', id: 'year', name: 'New', extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }], genres: Array.from({ length: 67 }, (_, i) => String(2026 - i)) },
        { type: 'movie', id: 'imdbRating', name: 'Featured', extra: [{ name: 'genre' }, { name: 'skip' }], genres: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'] },
        { type: 'series', id: 'imdbRating', name: 'Featured', extra: [{ name: 'genre' }, { name: 'skip' }], genres: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western', 'Reality-TV', 'Talk-Show', 'Game-Show'] },
        { type: 'series', id: 'last-videos', name: 'Last videos', extra: [{ name: 'lastVideosIds', isRequired: true, optionsLimit: 100 }] },
        { type: 'series', id: 'calendar-videos', name: 'Calendar videos', extra: [{ name: 'calendarVideosIds', isRequired: true, optionsLimit: 100 }] },
      ],
      behaviorHints: { configurable: false },
    },
    transportUrl: 'https://v3-cinemeta.strem.io',
    enabled: true,
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, _get) => ({
      theme: 'dark',
      language: 'en',
      serverUrl: '',
      installedAddons: defaultAddons,
      library: [],
      continueWatching: [],
      favorites: [],
      searchHistory: [],

      setTheme: (theme) => {
        set({ theme });
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
      },

      setLanguage: (language) => set({ language }),

      setServerUrl: (serverUrl) => set({ serverUrl }),

      addAddon: (addon) =>
        set((state) => ({
          installedAddons: [...state.installedAddons.filter((a) => a.transportUrl !== addon.transportUrl), addon],
        })),

      removeAddon: (transportUrl) =>
        set((state) => ({
          installedAddons: state.installedAddons.filter((a) => a.transportUrl !== transportUrl),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((f) => f !== id)
            : [...state.favorites, id],
        })),

      addToLibrary: (item) =>
        set((state) => ({
          library: [...state.library.filter((i) => !(i.type === item.type && i.id === item.id)), item],
        })),

      removeFromLibrary: (type, id) =>
        set((state) => ({
          library: state.library.filter((i) => !(i.type === type && i.id === id)),
          continueWatching: state.continueWatching.filter((i) => !(i.type === type && i.id === id)),
        })),

      updateProgress: (type, id, progress, duration, season, episode) =>
        set((state) => {
          const existing = state.library.find((i) => i.type === type && i.id === id);
          const title = existing?.title || id;
          const newItem: LibraryItem = { type, id, title, progress, duration, season, episode, lastWatched: Date.now() };
          const library = [...state.library.filter((i) => !(i.type === type && i.id === id)), newItem];
          const continueWatching = library
            .filter((i) => i.progress > 0 && i.progress < i.duration * 0.9)
            .sort((a, b) => b.lastWatched - a.lastWatched)
            .slice(0, 20);
          return { library, continueWatching };
        }),

      addSearchHistory: (query) =>
        set((state) => ({
          searchHistory: [query, ...state.searchHistory.filter((q) => q !== query)].slice(0, 20),
        })),

      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'kinora-storage',
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        serverUrl: state.serverUrl,
        installedAddons: state.installedAddons,
        library: state.library,
        favorites: state.favorites,
        searchHistory: state.searchHistory,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  const { theme } = useAppStore.getState();
  document.documentElement.classList.toggle('dark', theme === 'dark');
}