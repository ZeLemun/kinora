# Kinora

A Stremio-style streaming client for iOS and Android, built with React, TypeScript, Tailwind CSS, and Capacitor.

## Features

- **Movies & TV Shows** - Browse trending, popular, top-rated, and upcoming content
- **Search** - Find movies and shows across TMDB
- **Library** - My List, Continue Watching, and Favorites
- **Addon Support** - Powered by Stremio's addon protocol (Cinemeta pre-installed)
- **Native Player** - HLS/MP4 playback with subtitle support
- **Offline-First** - Works without a server, optional Termux server for HLS proxy
- **24 Languages** - Full i18n support

## Architecture

```
┌─ iPhone / Android ──────────────────┐       ┌─ Android Phone (Termux) ──────┐
│  Kinora.app                         │       │  node server.cjs              │
│  ├─ React + TypeScript + Tailwind   │ ──HTTP─▶│    ├─ Static assets         │
│  ├─ @stremio/stremio-core-web       │       │    ├─ /api/stream (HLS proxy) │
│  ├─ TMDB integration                │       │    └─ /api/tmdb (TMDB proxy)  │
│  └─ Capacitor native shell          │       │  bound 0.0.0.0:3000           │
└─────────────────────────────────────┘       └──────────────────────────────┘
```

**Bundled-first design**: The app works completely offline/standalone. The Termux server is optional - it provides an HLS CORS/Referer proxy for streams that need it.

## Quick Start

### Prerequisites

- Node.js 18+
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- Android phone with Termux (optional, for server)

### Install Dependencies

```bash
npm install
```

### Development

```bash
# Start Vite dev server
npm run dev

# Start Kinora server (for testing HLS proxy)
npm run server
```

### Build for Production

```bash
npm run build
npx cap sync
```

## Termux Server Setup (Optional but Recommended)

The Termux server provides an HLS CORS/Referer proxy that enables streams which require specific headers.

### On your Android phone:

1. Install **Termux** (from F-Droid or GitHub, not Play Store)
2. Install **Termux:API** and **Termux:Boot** (optional, for auto-start)
3. Copy this project folder to your phone (e.g., via USB, Syncthing, or git)

```bash
# In Termux:
pkg update && pkg upgrade -y
pkg install nodejs -y
pkg install termux-api termux-boot -y

# Navigate to project
cd ~/storage/downloads/kinora  # adjust path

# Install deps
npm install

# Start server
npm run server
```

The server will be available at `http://<phone-ip>:3000`

### Configure in Kinora App

1. Open Kinora → Settings
2. Enter Server URL: `http://<phone-ip>:3000` (or use Tailscale MagicDNS)
3. Tap "Test Connection" - should show "Connected"

### Keep Server Alive

```bash
# Prevent sleep
termux-wake-lock

# Run in background (install tmux first: pkg install tmux)
tmux new -s kinora
npm run server
# Ctrl+B, D to detach
```

Or use `termux-services` for auto-start on boot.

### Network Access Options

| Method | Pros | Cons |
|--------|------|------|
| **Tailscale** (recommended) | Works anywhere, stable address | Need Tailscale account |
| **Local Wi-Fi + mDNS** | Zero config | Home network only |
| **Cloudflare Tunnel** | Works anywhere | Exposes proxy publicly |

**Tailscale setup:**
```bash
pkg install tailscale
tailscale up
# Get your MagicDNS name: tailscale status --json | jq .Self.DNSName
# Use: http://your-device.tailnet-xxxx.ts.net:3000
```

## Android Build

```bash
# Build debug APK (runs entirely on Windows)
npx cap build android

# Or with Gradle directly
cd android
./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Install APK

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or transfer the APK to your phone and install manually.

## iOS Build

**Requires macOS** (or cloud Mac via Codemagic/GitHub Actions).

### Option 1: Codemagic (Easiest, Free Tier)

1. Push this repo to GitHub
2. Go to [codemagic.io](https://codemagic.io), connect repo
3. Select iOS workflow, build
4. Download unsigned `.ipa`

### Option 2: GitHub Actions (Free for Public Repos)

The `.github/workflows/ios.yml` workflow builds on macOS runners and uploads the `.ipa` as an artifact.

### Option 3: Local Mac

```bash
# On macOS
cd ios
pod install
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build -exportOptionsPlist ExportOptions.plist
```

### Install .ipa on iPhone

- **SideStore** (recommended): Install via SideStore app on iPhone
- **Sideloadly**: Windows app, drag-and-drop `.ipa`
- **AltStore**: Similar to SideStore
- **TrollStore**: Permanent install (requires jailbreak/TrollStore-compatible iOS)

## Project Structure

```
stremio moviestream ios android/
├── src/
│   ├── components/       # React components (Hero, Rail, MetaCard, etc.)
│   ├── pages/            # Page components (Home, Search, Library, Detail, Settings)
│   ├── hooks/            # Custom hooks (useStremio, useTMDB, useTranslation, etc.)
│   ├── services/         # API services (stremio-core, tmdb)
│   ├── store/            # Zustand store (app state)
│   ├── utils/            # Utilities (cn, formatting)
│   ├── addon-types.ts    # TypeScript types for Stremio addon protocol
│   ├── App.tsx           # Main app with routing
│   └── main.tsx          # Entry point
├── server.cjs            # Node.js static server + HLS/TMDB proxy
├── capacitor.config.ts   # Capacitor configuration
├── tailwind.config.js    # Tailwind CSS config
└── termux-requirements.txt  # Termux setup instructions
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| UI | React 19 + TypeScript + Tailwind CSS v4 |
| Data | @stremio/stremio-core-web (MIT) + TMDB API |
| State | Zustand + TanStack Query |
| Routing | React Router v7 |
| Native | Capacitor 7 (iOS WKWebView / Android WebView) |
| Icons | @stremio/stremio-icons |
| Colors | @stremio/stremio-colors |

## Stremio Addons

Pre-installed:
- **Cinemeta** - Official movie/series catalogs (Popular, New, Featured, etc.)

Add more in Settings → Addons:
- Torrentio
- OpenSubtitles
- Community addons

## License

MIT for the app code. Stremio core is MIT licensed. TMDB data © TMDB.

## Credits

- **Stremio** for the addon protocol and core engine (MIT)
- **TMDB** for movie/TV metadata
- **iptv-org** for Live TV reference implementation