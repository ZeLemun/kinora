import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ercin.kinora',
  appName: 'Kinora',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Preferences: {
      group: 'kinora',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#16171d',
      showSpinner: false,
    },
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