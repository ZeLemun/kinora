import { useEffect } from 'react';
import { stremioCore } from '../services/stremio-core';
import { useAppStore } from '../store/app-store';

/**
 * stremio-core-web only knows about add-ons that have been handed to
 * core.init(). Without this the catalog/meta/stream requests have nothing to
 * talk to and every lookup comes back empty.
 */
export function AddonBootstrap() {
  const installedAddons = useAppStore((s) => s.installedAddons);

  useEffect(() => {
    const addons = installedAddons.filter((a) => a.enabled !== false);
    if (addons.length === 0) return;
    stremioCore.init(addons).catch((err) => {
      console.error('Kinora: failed to initialise add-on engine', err);
    });
  }, [installedAddons]);

  return null;
}
