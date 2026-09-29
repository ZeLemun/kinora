import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Hosts the WebView is allowed to navigate to itself.
 *
 * Without this, `Bridge.launchIntent` sends any URL whose host differs from the
 * app's own to `ACTION_VIEW`, so tapping "play" in the middle of a provider
 * frame threw the viewer out into Chrome mid-film. These entries keep the embed
 * playing inside the player the app already draws.
 *
 * Deliberately narrow: per-host rather than a wildcard. Hosts that only exist to
 * be linked out to — a broadcaster page, for instance — are still meant to open
 * in the system browser.
 */
const IN_APP_HOSTS = [
  'vidsrc.to',
  'vidcore.org',
  'multiembed.mov',
  'vaplayer.ru',
  // 2embed.online 301s here, so the redirect target is the host that matters.
  'www.2embed.online',
  '2embed.online',
  '2embed.stream',
  'www.superembed.stream',
  'player.vimeo.com',
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'archive.org',
];

const config: CapacitorConfig = {
  appId: 'com.ercin.kinora',
  appName: 'Kinora',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: IN_APP_HOSTS,
  },
  plugins: {
    Preferences: {
      group: 'kinora',
    },
    /*
     * No SplashScreen and no ScreenOrientation.
     *
     * Both were removed because their iOS sources failed to compile against the
     * Capacitor core the SwiftPM package resolved — 17 errors, all inside
     * those two packages, calling `reject` / `getString` / `viewController`
     * members the resolved core does not have. Neither is referenced anywhere
     * in src, so the fix costs nothing: the launch screen storyboard already
     * covers the splash, and ImmersivePlugin does the landscape lock.
     */
    StatusBar: {
      style: 'dark',
      backgroundColor: '#16171d',
    },
  },
  ios: {
    scheme: 'kinora',
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavBarToVisibleBounds: true,
    allowsLinkPreview: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    buildType: 'debug',
  },
};

export default config;
