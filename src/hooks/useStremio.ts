import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptsId,
  fetchManifest,
  isEnabled,
  resourceNames,
  toTransport,
} from '../services/addon-client';
import { useAppStore } from '../store/app-store';
import type {
  CatalogResponse,
  InstalledAddon,
  MetaResponse,
  StreamResponse,
  SubtitleResponse,
} from '../addon-types';

const CINEMETA_URL = 'https://v3-cinemeta.strem.io';

function enabledAddons(): InstalledAddon[] {
  return useAppStore.getState().installedAddons.filter(isEnabled);
}

/** The add-on that provides catalogs of this type (Cinemeta by default). */
function catalogTransportFor(type: string) {
  const addons = enabledAddons();
  const match = addons.find(
    (a) =>
      a.manifest.types.includes(type) && a.manifest.catalogs?.some((c) => c.type === type)
  );
  return toTransport(
    match ?? {
      manifest: {
        id: 'com.linvo.cinemeta',
        version: '3.0.14',
        name: 'Cinemeta',
        description: '',
        resources: ['catalog', 'meta', 'stream', 'subtitles'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
      },
      transportUrl: CINEMETA_URL,
      enabled: true,
    }
  );
}

/**
 * Every enabled add-on that serves a resource for this id. Stream-only add-ons
 * (Torrentio, Comet…) declare no catalogs, so they must be discovered by
 * resource, not by catalog lookup.
 */
function transportsForResource(
  resource: string,
  type: 'movie' | 'series',
  id: string
) {
  const matching = enabledAddons().filter(
    (a) =>
      resourceNames(a.manifest).includes(resource) &&
      (!a.manifest.types.length || a.manifest.types.includes(type)) &&
      acceptsId(a.manifest, id)
  );
  if (matching.length === 0) {
    return [catalogTransportFor(type)];
  }
  return matching.map(toTransport);
}

async function fanOut<T>(
  transports: ReturnType<typeof transportsForResource>,
  call: (t: ReturnType<typeof toTransport>) => Promise<T>,
  key: keyof T
): Promise<T> {
  const results = await Promise.allSettled(transports.map(call));
  const merged = { [key]: [] } as T;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const list = (result.value as Record<string, unknown> | null)?.[key as string];
    if (Array.isArray(list)) {
      (merged as Record<string, unknown[]>)[key as string].push(...list);
    }
  }
  return merged;
}

export function useCatalog(
  type: 'movie' | 'series',
  catalogId: string,
  extra?: Record<string, string | number | undefined>
) {
  return useQuery({
    queryKey: ['catalog', type, catalogId, extra],
    queryFn: (): Promise<CatalogResponse> =>
      catalogTransportFor(type).catalog(type, catalogId, extra),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMeta(type: 'movie' | 'series', id: string) {
  return useQuery({
    queryKey: ['meta', type, id],
    queryFn: (): Promise<MetaResponse> =>
      catalogTransportFor(type).meta(type, id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

export function useStreams(type: 'movie' | 'series', id: string) {
  return useQuery({
    queryKey: ['streams', type, id],
    queryFn: (): Promise<StreamResponse> =>
      fanOut<StreamResponse>(
        transportsForResource('stream', type, id),
        (t) => t.stream(type, id),
        'streams'
      ),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubtitles(
  type: 'movie' | 'series',
  id: string,
  extra?: Record<string, string | number | undefined>
) {
  return useQuery({
    queryKey: ['subtitles', type, id, extra],
    queryFn: (): Promise<SubtitleResponse> =>
      fanOut<SubtitleResponse>(
        transportsForResource('subtitles', type, id),
        (t) => t.subtitles(type, id, extra),
        'subtitles'
      ),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

export function useLibrary() {
  const queryClient = useQueryClient();
  const { library, continueWatching, addToLibrary, removeFromLibrary, updateProgress } = useAppStore();

  const addToLibraryMutation = useMutation({
    mutationFn: async (item: {
      type: string;
      id: string;
      title: string;
      duration: number;
      poster?: string;
      season?: number;
      episode?: number;
    }) => {
      addToLibrary({ ...item, progress: 0, lastWatched: Date.now() });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (params: {
      type: string;
      id: string;
      progress: number;
      duration: number;
      title?: string;
      poster?: string;
      season?: number;
      episode?: number;
    }) => {
      const { type, id, progress, duration, title, poster, season, episode } = params;
      if (title || poster) {
        addToLibrary({
          type,
          id,
          title: title ?? id,
          poster,
          progress,
          duration,
          season,
          episode,
          lastWatched: Date.now(),
        });
      } else {
        updateProgress(type, id, progress, duration, season, episode);
      }
      queryClient.invalidateQueries({ queryKey: ['continueWatching'] });
    },
  });

  const removeFromLibraryMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      removeFromLibrary(type, id);
      queryClient.invalidateQueries({ queryKey: ['continueWatching'] });
    },
  });

  return {
    library,
    continueWatching,
    addToLibrary: addToLibraryMutation.mutate,
    updateProgress: updateProgressMutation.mutate,
    removeFromLibrary: removeFromLibraryMutation.mutate,
  };
}

export function useFavorites() {
  const { favorites, toggleFavorite } = useAppStore();
  return { favorites, toggleFavorite };
}

export function useSearchHistory() {
  const { searchHistory, addSearchHistory, clearSearchHistory } = useAppStore();
  return { searchHistory, addSearchHistory, clearSearchHistory };
}

export { fetchManifest };
