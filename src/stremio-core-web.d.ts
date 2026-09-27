declare module '@stremio/stremio-core-web' {
  interface CoreModule {
    catalog: {
      request: (args: { addon: string; type: string; id: string; extra?: Record<string, string> }) => Promise<{ metas: any[] }>;
      getAddons: () => Promise<{ manifests: Record<string, any> }>;
    };
    meta: {
      request: (args: { addon: string; type: string; id: string }) => Promise<{ meta: any }>;
    };
    stream: {
      request: (args: { addon: string; type: string; id: string }) => Promise<{ streams: any[] }>;
    };
    subtitles: {
      request: (args: { addon: string; type: string; id: string; extra?: Record<string, string> }) => Promise<{ subtitles: any[] }>;
    };
    library: {
      get: () => Promise<{ items: any[] }>;
      set: (item: any) => Promise<void>;
      remove: (type: string, id: string) => Promise<void>;
    };
    init: (config: { addons: any[] }) => Promise<void>;
  }

  const stremioCoreWeb: () => Promise<CoreModule>;
  export default stremioCoreWeb;
}