import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const translations: Record<string, Record<string, string>> = {
  en: {
    home: 'Home',
    search: 'Search',
    library: 'Library',
    settings: 'Settings',
    movies: 'Movies',
    series: 'TV Shows',
    trending: 'Trending',
    popular: 'Popular',
    topRated: 'Top Rated',
    upcoming: 'Upcoming',
    nowPlaying: 'Now Playing',
    featured: 'Featured',
    new: 'New',
    genres: 'Genres',
    year: 'Year',
    watchNow: 'Watch Now',
    moreInfo: 'More Info',
    addToList: 'Add to List',
    removeFromList: 'Remove from List',
    continueWatching: 'Continue Watching',
    myList: 'My List',
    favorites: 'Favorites',
    history: 'History',
    searchPlaceholder: 'Search movies & shows...',
    noResults: 'No results found',
    noDescription: 'No description available',
    seasons: 'Seasons',
    episodes: 'Episodes',
    cast: 'Cast',
    similar: 'Similar',
    trailers: 'Trailers',
    subtitles: 'Subtitles',
    audio: 'Audio',
    quality: 'Quality',
    server: 'Server',
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    theme: 'Theme',
    language: 'Language',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
    about: 'About',
    version: 'Version',
    serverUrl: 'Server URL',
    serverUrlPlaceholder: 'http://your-phone:3000',
    testConnection: 'Test Connection',
    connected: 'Connected',
    disconnected: 'Disconnected',
    addons: 'Addons',
    installAddon: 'Install Addon',
    addonUrl: 'Addon URL',
    addonUrlPlaceholder: 'https://example.com/manifest.json',
  },
  it: {
    home: 'Home',
    search: 'Cerca',
    library: 'Libreria',
    settings: 'Impostazioni',
    movies: 'Film',
    series: 'Serie TV',
    trending: 'Di Tendenza',
    popular: 'Popolari',
    topRated: 'Miglior Valutati',
    upcoming: 'In Arrivo',
    nowPlaying: 'Al Cinema',
    featured: 'In Evidenza',
    new: 'Novità',
    genres: 'Generi',
    year: 'Anno',
    watchNow: 'Guarda Ora',
    moreInfo: 'Più Info',
    addToList: 'Aggiungi alla Lista',
    removeFromList: 'Rimuovi dalla Lista',
    continueWatching: 'Continua a Guardare',
    myList: 'La Mia Lista',
    favorites: 'Preferiti',
    history: 'Cronologia',
    searchPlaceholder: 'Cerca film e serie...',
    noResults: 'Nessun risultato',
    noDescription: 'Nessuna descrizione disponibile',
    seasons: 'Stagioni',
    episodes: 'Episodi',
    cast: 'Cast',
    similar: 'Simili',
    trailers: 'Trailer',
    subtitles: 'Sottotitoli',
    audio: 'Audio',
    quality: 'Qualità',
    server: 'Server',
    loading: 'Caricamento...',
    error: 'Errore',
    retry: 'Riprova',
    theme: 'Tema',
    language: 'Lingua',
    dark: 'Scuro',
    light: 'Chiaro',
    system: 'Sistema',
    about: 'Informazioni',
    version: 'Versione',
    serverUrl: 'URL Server',
    serverUrlPlaceholder: 'http://tuo-telefono:3000',
    testConnection: 'Testa Connessione',
    connected: 'Connesso',
    disconnected: 'Disconnesso',
    addons: 'Addon',
    installAddon: 'Installa Addon',
    addonUrl: 'URL Addon',
    addonUrlPlaceholder: 'https://esempio.com/manifest.json',
  },
  es: {
    home: 'Inicio',
    search: 'Buscar',
    library: 'Biblioteca',
    settings: 'Ajustes',
    movies: 'Películas',
    series: 'Series',
    trending: 'Tendencias',
    popular: 'Populares',
    topRated: 'Mejor Valorados',
    upcoming: 'Próximamente',
    nowPlaying: 'En Cines',
    featured: 'Destacados',
    new: 'Novedades',
    genres: 'Géneros',
    year: 'Año',
    watchNow: 'Ver Ahora',
    moreInfo: 'Más Info',
    addToList: 'Añadir a Lista',
    removeFromList: 'Quitar de Lista',
    continueWatching: 'Continuar Viendo',
    myList: 'Mi Lista',
    favorites: 'Favoritos',
    history: 'Historial',
    searchPlaceholder: 'Buscar películas y series...',
    noResults: 'Sin resultados',
    noDescription: 'Sin descripción disponible',
    seasons: 'Temporadas',
    episodes: 'Episodios',
    cast: 'Reparto',
    similar: 'Similares',
    trailers: 'Tráilers',
    subtitles: 'Subtítulos',
    audio: 'Audio',
    quality: 'Calidad',
    server: 'Servidor',
    loading: 'Cargando...',
    error: 'Error',
    retry: 'Reintentar',
    theme: 'Tema',
    language: 'Idioma',
    dark: 'Oscuro',
    light: 'Claro',
    system: 'Sistema',
    about: 'Acerca de',
    version: 'Versión',
    serverUrl: 'URL del Servidor',
    serverUrlPlaceholder: 'http://tu-telefono:3000',
    testConnection: 'Probar Conexión',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    addons: 'Addons',
    installAddon: 'Instalar Addon',
    addonUrl: 'URL del Addon',
    addonUrlPlaceholder: 'https://ejemplo.com/manifest.json',
  },
};

type Language = keyof typeof translations;
type TranslationKey = keyof typeof translations.en;

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  availableLanguages: { code: Language; name: string }[];
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('kinora-language') as Language) || 'en';
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('kinora-language', language);
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'it', name: 'Italiano' },
    { code: 'es', name: 'Español' },
  ];

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}