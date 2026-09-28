/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TMDB v3 API key. See .env.example. */
  readonly VITE_TMDB_API_KEY?: string;
  /** OMDb API key. Adds IMDb ratings alongside TMDB's. */
  readonly VITE_OMDB_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
