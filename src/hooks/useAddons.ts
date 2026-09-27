import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stremioCore, fetchManifest } from '../services/stremio-core';
import { useAppStore } from '../store/app-store';
import type { InstalledAddon } from '../addon-types';

export function useAddons() {
  const { installedAddons, addAddon, removeAddon } = useAppStore();
  const queryClient = useQueryClient();

  const installAddonMutation = useMutation({
    mutationFn: async (transportUrl: string): Promise<InstalledAddon> => {
      const manifest = await fetchManifest(`${transportUrl}/manifest.json`);
      return {
        manifest,
        transportUrl,
        enabled: true,
      };
    },
    onSuccess: (addon) => {
      addAddon(addon);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });

  const removeAddonMutation = useMutation({
    mutationFn: async (transportUrl: string) => {
      removeAddon(transportUrl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });

  return {
    installedAddons,
    installAddon: installAddonMutation.mutate,
    removeAddon: removeAddonMutation.mutate,
    isInstalling: installAddonMutation.isPending,
  };
}

export function useAvailableAddons() {
  return useQuery({
    queryKey: ['availableAddons'],
    queryFn: async () => {
      const core = await stremioCore.getAvailableAddons();
      return core.manifests;
    },
    staleTime: 1000 * 60 * 60,
  });
}