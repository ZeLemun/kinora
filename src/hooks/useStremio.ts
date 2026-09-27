import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stremioCore } from '../services/stremio-core';
import { useAppStore } from '../store/app-store';
import type { CatalogResponse, InstalledAddon, MetaResponse, StreamResponse, SubtitleResponse } from '../addon-types';

const CINEMETA_ADDON = 'com.linvo.cinemeta';

function getEnabledAddons() {
  return useAppStore.getState().installedAddons.filter((a) => a.enabled !== false);
}

/** Resource names declared by an add-on, flattened from both spec shapes. */
function resourceNames(addon: InstalledAddon): string[] {
  return (addon.manifest.resources ?? [])
    .map((r) => (typeof r === 'string' ? r : r.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

/** Does this add-on accept ids like the one we have (e.g. "tt1234567")? */
function acceptsId(addon: InstalledAddon, id: string): boolean {
  const prefixes = addon.manifest.idPrefixes;
  if (!prefixes || prefixes.length === 0) return true;
  return prefixes.some((p) => id.startsWith(p));
}

function getCatalogAddon(type: string): string {
  const addons = getEnabledAddons();
  const addon = addons.find(a => a.manifest.types.includes(type as 'movie' | 'series') && a.manifest.catalogs?.some(c => c.type === type));
  return addon?.manifest.id || CINEMETA_ADDON;
}

/**
 * Every enabled add-on that serves a given resource for this id — not just the
 * one that happens to also expose a catalog. Torrentio, for example, only
 * declares "stream", so looking it up through the catalog add-on would skip it.
 */
function getResourceAddons(resource: string, type: 'movie' | 'series', id: string): string[] {
  const matching = getEnabledAddons().filter(
    (a) =>
      resourceNames(a).includes(resource) &&
      (!a.manifest.types.length || a.manifest.types.includes(type)) &&
      acceptsId(a, id)
  );
  if (matching.length === 0) return [CINEMETA_ADDON];
  return matching.map((a) => a.manifest.id);
}

/** Merge the `key` array of every fulfilled result, ignoring rejected add-ons. */
function mergeByKey<T>(results: PromiseSettledResult<unknown>[], key: keyof T): T {
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

/** Fan out a stream request across every add-on that serves streams. */
async function fetchAllStreams(type: 'movie' | 'series', id: string): Promise<StreamResponse> {
  const results = await Promise.allSettled(
    getResourceAddons('stream', type, id).map((addon) => stremioCore.getStreams(addon, type, id))
  );
  return mergeByKey<StreamResponse>(results, 'streams');
}

/** Fan out a subtitle request across every add-on that serves subtitles. */
async function fetchAllSubtitles(
  type: 'movie' | 'series',
  id: string,
  extra?: Record<string, string>
): Promise<SubtitleResponse> {
  const results = await Promise.allSettled(
    getResourceAddons('subtitles', type, id).map((addon) =>
      stremioCore.getSubtitles(addon, type, id, extra)
    )
  );
  return mergeByKey<SubtitleResponse>(results, 'subtitles');
}

export function useCatalog(type: 'movie' | 'series', catalogId: string, extra?: Record<string, string>) {
  return useQuery({
    queryKey: ['catalog', type, catalogId, extra],
    queryFn: async (): Promise<CatalogResponse> => {
      const addonId = getCatalogAddon(type);
      return stremioCore.getCatalog(addonId, type, catalogId, extra);
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useMeta(type: 'movie' | 'series', id: string) {
  return useQuery({
    queryKey: ['meta', type, id],
    queryFn: async (): Promise<MetaResponse> => {
      const addonId = getCatalogAddon(type);
      return stremioCore.getMeta(addonId, type, id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

export function useStreams(type: 'movie' | 'series', id: string) {
  return useQuery({
    queryKey: ['streams', type, id],
    queryFn: () => fetchAllStreams(type, id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubtitles(type: 'movie' | 'series', id: string, extra?: Record<string, string>) {
  return useQuery({
    queryKey: ['subtitles', type, id, extra],
    queryFn: () => fetchAllSubtitles(type, id, extra),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

export function useLibrary() {
  const queryClient = useQueryClient();
  const { library, continueWatching, addToLibrary, removeFromLibrary, updateProgress } = useAppStore();

  const addToLibraryMutation = useMutation({
    mutationFn: async (item: { type: string; id: string; title: string; duration: number; poster?: string; season?: number; episode?: number }) => {
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
        addToLibrary({ type, id, title: title ?? id, poster, progress, duration, season, episode, lastWatched: Date.now() });
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