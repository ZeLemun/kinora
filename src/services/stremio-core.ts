import type {
  Manifest,
  Catalog,
  CatalogResponse,
  MetaResponse,
  StreamResponse,
  SubtitleResponse,
  InstalledAddon,
} from '../addon-types';

interface CoreModule {
  catalog: {
    request: (args: {
      addon: string;
      type: string;
      id: string;
      extra?: Record<string, string>;
    }) => Promise<CatalogResponse>;
    getAddons: () => Promise<{ manifests: Record<string, Manifest> }>;
  };
  meta: {
    request: (args: { addon: string; type: string; id: string }) => Promise<MetaResponse>;
  };
  stream: {
    request: (args: { addon: string; type: string; id: string }) => Promise<StreamResponse>;
  };
  subtitles: {
    request: (args: { addon: string; type: string; id: string; extra?: Record<string, string> }) => Promise<SubtitleResponse>;
  };
  library: {
    get: () => Promise<{ items: LibraryItem[] }>;
    set: (item: LibraryItem) => Promise<void>;
    remove: (type: string, id: string) => Promise<void>;
  };
  init: (config: { addons: InstalledAddon[] }) => Promise<void>;
}

interface LibraryItem {
  type: string;
  id: string;
  title: string;
  progress: number;
  duration: number;
  season?: number;
  episode?: number;
  lastWatched: number;
}

let corePromise: Promise<CoreModule> | null = null;

async function loadCore(): Promise<CoreModule> {
  if (corePromise) return corePromise;

  corePromise = (async () => {
    const module = await import('@stremio/stremio-core-web');
    const core = await module.default();

    return {
      catalog: {
        request: core.catalog.request.bind(core.catalog),
        getAddons: core.catalog.getAddons.bind(core.catalog),
      },
      meta: {
        request: core.meta.request.bind(core.meta),
      },
      stream: {
        request: core.stream.request.bind(core.stream),
      },
      subtitles: {
        request: core.subtitles.request.bind(core.subtitles),
      },
      library: {
        get: core.library.get.bind(core.library),
        set: core.library.set.bind(core.library),
        remove: core.library.remove.bind(core.library),
      },
      init: core.init.bind(core),
    };
  })();

  return corePromise;
}

export const stremioCore = {
  async init(addons: InstalledAddon[]) {
    const core = await loadCore();
    return core.init({ addons });
  },

  async getCatalog(addon: string, type: string, id: string, extra?: Record<string, string>) {
    const core = await loadCore();
    return core.catalog.request({ addon, type, id, extra });
  },

  async getMeta(addon: string, type: string, id: string) {
    const core = await loadCore();
    return core.meta.request({ addon, type, id });
  },

  async getStreams(addon: string, type: string, id: string) {
    const core = await loadCore();
    return core.stream.request({ addon, type, id });
  },

  async getSubtitles(addon: string, type: string, id: string, extra?: Record<string, string>) {
    const core = await loadCore();
    return core.subtitles.request({ addon, type, id, extra });
  },

  async getLibrary() {
    const core = await loadCore();
    return core.library.get();
  },

  async setLibraryItem(item: LibraryItem) {
    const core = await loadCore();
    return core.library.set(item);
  },

  async removeLibraryItem(type: string, id: string) {
    const core = await loadCore();
    return core.library.remove(type, id);
  },

  async getAvailableAddons() {
    const core = await loadCore();
    return core.catalog.getAddons();
  },
};

export const CINEMETA_URL = 'https://v3-cinemeta.strem.io';
export const CINEMETA_MANIFEST_URL = `${CINEMETA_URL}/manifest.json`;

export const DEFAULT_ADDONS = [
  {
    manifestUrl: CINEMETA_MANIFEST_URL,
    transportUrl: CINEMETA_URL,
  },
];

export async function fetchManifest(url: string): Promise<Manifest> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.statusText}`);
  return response.json();
}

export async function fetchAddonCatalogs(transportUrl: string): Promise<Catalog[]> {
  const manifest = await fetchManifest(`${transportUrl}/manifest.json`);
  return manifest.catalogs || [];
}