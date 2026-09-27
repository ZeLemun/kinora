/** A resource is either a bare name ("stream") or a per-type object descriptor. */
export type ResourceSpec = string | { name: string; types?: string[]; idPrefixes?: string[] };

export interface Manifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: ResourceSpec[];
  types: string[];
  idPrefixes?: string[];
  catalogs?: Catalog[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
}

export interface Catalog {
  type: string;
  id: string;
  name: string;
  extra?: Extra[];
  extraSupported?: string[];
  extraRequired?: string[];
  genres?: string[];
}

export interface Extra {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
}

export interface MetaItem {
  id: string;
  type: 'movie' | 'series' | 'channel';
  name: string;
  poster?: string;
  posterShape?: 'regular' | 'landscape' | 'square';
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  trailer?: string;
  director?: string;
  cast?: string[];
  genres?: string[];
  rating?: number;
  runtime?: string;
  certification?: string;
  country?: string;
  language?: string;
  imdb_id?: string;
  tmdb_id?: number;
  videos?: Video[];
  episodes?: Episode[];
  related?: string[];
  externalLinks?: ExternalLink[];
}

export interface Video {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  overview?: string;
  thumbnail?: string;
}

export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  overview?: string;
  released?: string;
  thumbnail?: string;
}

export interface ExternalLink {
  name: string;
  url: string;
}

export interface MetaResponse {
  meta: MetaItem;
}

export interface CatalogResponse {
  metas: MetaItem[];
}

export interface Stream {
  url: string;
  title?: string;
  quality?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
    videoSize?: number;
    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
}

export interface StreamResponse {
  streams: Stream[];
}

export interface Subtitle {
  id: string;
  url: string;
  lang: string;
  title?: string;
}

export interface SubtitleResponse {
  subtitles: Subtitle[];
}

export interface AddonConfig {
  key: string;
  title: string;
  type: 'text' | 'password' | 'checkbox' | 'select' | 'multiSelect';
  /** Stremio serves plain strings; some add-ons send {value,label} objects. */
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  default?: string | boolean | string[];
}

export interface AddonConfigResponse {
  config: AddonConfig[];
}

export type Resource =
  | 'manifest'
  | 'catalog'
  | 'meta'
  | 'stream'
  | 'subtitles'
  | 'addon_catalog';

export interface AddonCatalogItem {
  manifest: Manifest;
  transportUrl: string;
  enabled: boolean;
}

export interface InstalledAddon {
  manifest: Manifest;
  transportUrl: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface LibraryItem {
  type: string;
  id: string;
  title: string;
  poster?: string;
  progress: number;
  duration: number;
  season?: number;
  episode?: number;
  lastWatched: number;
}