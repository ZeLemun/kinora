import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stremioCore } from '../services/stremio-core';
import { useAppStore } from '../store/app-store';
import type { CatalogResponse, MetaResponse, StreamResponse, SubtitleResponse } from '../addon-types';

const CINEMETA_ADDON = 'com.linvo.cinemeta';

function getEnabledAddons() {
  return useAppStore.getState().installedAddons.filter(a => a.enabled);
}

function getCatalogAddon(type: string): string {
  const addons = getEnabledAddons();
  const addon = addons.find(a => a.manifest.types.includes(type as 'movie' | 'series') && a.manifest.catalogs?.some(c => c.type === type));
  return addon?.manifest.id || CINEMETA_ADDON;
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
    queryFn: async (): Promise<StreamResponse> => {
      const addonId = getCatalogAddon(type);
      return stremioCore.getStreams(addonId, type, id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubtitles(type: 'movie' | 'series', id: string, extra?: Record<string, string>) {
  return useQuery({
    queryKey: ['subtitles', type, id, extra],
    queryFn: async (): Promise<SubtitleResponse> => {
      const addonId = getCatalogAddon(type);
      return stremioCore.getSubtitles(addonId, type, id, extra);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });
}

export function useLibrary() {
  const queryClient = useQueryClient();
  const { library, continueWatching, addToLibrary, removeFromLibrary, updateProgress } = useAppStore();

  const addToLibraryMutation = useMutation({
    mutationFn: async (item: { type: string; id: string; title: string; duration: number; season?: number; episode?: number }) => {
      addToLibrary({ ...item, progress: 0, lastWatched: Date.now() });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (params: { type: string; id: string; progress: number; duration: number; season?: number; episode?: number }) => {
      updateProgress(params.type, params.id, params.progress, params.duration, params.season, params.episode);
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