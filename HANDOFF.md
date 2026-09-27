# Kinora — Session Handoff

**Date:** 28 Sep 2026
**Status:** Android app builds, installs and runs. UI is Stremio-like. **Playback is blocked on a Debrid decision.**

---

## 1. Quick start

```powershell
$env:ANDROID_HOME = "C:\Users\ercin\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
cd "C:\Users\ercin\Desktop\coding\stremio moviestream ios android"

npm run build              # tsc -b && vite build   (MUST run before cap sync)
npx cap sync android
cd android; .\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

**Gotchas that cost time today**
- `npm run build` **before** `npx cap sync android`. Skipping it ships a stale bundle (this is why the "navbar won't lock" fix appeared not to work).
- `npx cap build android` fails (wants a release keystore). Use `gradlew.bat assembleDebug`.
- Do **not** set `JAVA_HOME` manually — `android/gradle.properties` already pins JDK 17 at `C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot`. Setting it wrong makes gradle fail immediately.
- Screenshots are 1080x2400 but get displayed scaled to 900x2000. `adb input tap` needs **real** coords → multiply what you see by 1.2.
- The phone sleeps during long builds. `adb shell svc power stayon true` + `input keyevent KEYCODE_WAKEUP` + `wm dismiss-keyguard` first.
- Package id is `com.ercin.kinora` (not `com.kinora.app`).
- Package is `type: module`, but `server.cjs` is CommonJS — hence the `.cjs` extension.
- Tailwind v4: `@apply` cannot reference custom utilities. Write them as plain CSS in `index.css`.
- `tsc` is strict — unused imports/vars are **errors**.

---

## 2. THE open question: can it play video?

**No, not yet — and this needs your decision.**

I tested every plausible add-on against the real Stremio API:

| Add-on | Result |
|---|---|
| **Torrentio** | 50 streams, but **every one has `url: undefined`** — they're torrent descriptors for Stremio's *built-in libtorrent engine*. A WebView has no torrent engine. |
| **MediaFusion** | 1 stream, and it's an `/static/exceptions/invalid` placeholder. All its providers fail without config. |
| **Cinemeta** | Returns P2P torrents. Not playable. |

ElfHosted's own docs confirm this: *"We don't recommend running Stremio in 'free mode' (no provider, just P2P or HTTP-direct addons)."*

There is **no free, no-account source of playable HTTP streams.** Two ways forward — pick one:

### Option A — Debrid (recommended, ~free, 1–2h work)
User gets a token for Real-Debrid / TorBox / AllDebrid / Premiumize, installs **AIOStreams**, **Comet** or **MediaFusion**, and pastes it into the Configure form. Those add-ons then return real `https://` URLs that play in a plain `<video>`.

✅ **Already built:** full add-on configuration UI (see §4). Nothing blocking.

### Option B — Embed a torrent engine (big)
Actually play P2P by shipping a torrent client. Options are a native Capacitor plugin (libtorrent) or WebTorrent WASM. WebTorrent is impractical for 4K video (slow peer discovery, no HTTP-range seeking). This is a multi-day, high-risk change and changes the app's architecture.

**My recommendation: Option A.** Do B only if you want a P2P-capable client.

---

## 3. Architecture as it stands

Bundled-first Capacitor app. No server needed for playback (the Server URL setting was **removed** at your request). `server.cjs` is only a PC dev/preview host.

```
Vite + React 19 + TS + Tailwind v4 + Capacitor 8  →  Android (done)  →  iOS (next)
```

- **Metadata:** TMDB (`src/services/tmdb.ts`, key `2a5568baeef016cd5241440fab2767de`)
- **Streams/subtitles:** Stremio add-on protocol via `@stremio/stremio-core-web` 0.63.2 (MIT)
- **Engine init:** `src/components/AddonBootstrap.tsx` — **critical**, the core knows zero add-ons until `init()` is called. This was a silent killer of the streams list.
- **Default add-ons:** Cinemeta + MediaFusion (persisted store v3, `migrate` repairs stale transport URLs)

**The TMDB→IMDb bridge:** rails carry TMDB numeric ids but every add-on keys on `tt…`. `DetailPage` reads `details.external_ids.imdb_id` and passes *that* to `useMeta`/`useStreams`. Getting this wrong is what caused the original "Content not found".

**Stream fan-out:** `useStreams`/`useSubtitles` query **every** enabled add-on declaring that resource (not just the one with a catalog) and merge via `Promise.allSettled` — otherwise stream-only add-ons are silently skipped. Also flattens both manifest resource shapes (bare string vs `{name, types, idPrefixes}` object).

---

## 4. What was built this session

**Fixes**
- `DetailPage.tsx` rewritten (had duplicate `const` declarations and a genuine syntax error — `seasons.map(` closed with `)}`)
- `omdb-imdb.ts` export conflicts (TS2305 / TS2484)
- `stremioCore.init()` was never called → **0 streams**
- MediaFusion transportUrl → `.../stremio` (the bare host returns empty for every id)
- `AddonConfig.options` type: Stremio sends `string[]`, not `{value,label}[]`
- Removed duplicated CSS block in `index.css`
- Removed Server URL setting (UI + store field + persist)
- Removed the top bar ("Kinora" + search)
- Nav labels English: Home / Search / Library / Settings (was hardcoded Italian)

**UI**
- Hero: stacked crossfade carousel + **Ken Burns** slow zoom, `fadeUp` copy animation, 10s duration, disabled under `prefers-reduced-motion`
- Hero title uses layered `text-hero-shadow` (2px + 10px + 28px) so it reads over bright fanart
- Lighter scrim: transparent top → solid bottom, so the art actually shows
- Single metadata row: ★ rating · year · genres
- Buttons: uniform `h-11`, `rounded-[10px]`, equal width on mobile
- Pagination dots moved to bottom-right, above the CTAs
- `TopTenRail` is now a **poster grid with 2:3 tiles and top-left rank pills** (was the "vertical list with rank numbers" you complained about)
- Rails: 8px gaps, `.rail-bleed` so the next poster peeks
- Section headers: title left, "SEE ALL" right, optional action slot
- **New** `BrowsePage` (`/browse/:type/:catalog`) — the "See all" target, with genre filter, sort, pagination
- **New** `AddonConfigForm` — renders any add-on's `/configure` manifest (text/password/checkbox/select)
- Landscape: shorter hero (`34vh`), capped tile width, more grid columns, full-width nav
- Landscape + keyboard open → nav collapses (`useViewport.ts`)
- Nav is a **flex sibling of the scroll area**, not `position: fixed`, so it can never scroll away
- Movie/TV toggle moved onto the "Trending" header row
- Poster labels forced single-line with ellipsis
- i18n: added ~25 keys × 3 languages (en/it/es)

**Next episode (asked for, implemented, untested)**
- `PlayerModal` shows a "Next episode" pill in the last 20s and on `ended`
- 5s auto-countdown, then advances automatically
- Also a persistent "Next episode" button on the series detail page
- `onProgress` persists watch progress → powers Continue Watching

⚠️ The next-episode flow has **not been manually verified** — it needs a series with real streams, which is blocked behind §2.

---

## 5. Todo

**Blocked on your decision (§2):**
- [ ] Pick Option A (debrid) or B (torrent engine)

**Then:**
- [ ] Verify next-episode auto-advance on a real series
- [ ] Verify progress → Continue Watching → resume
- [ ] `AddonConfigForm` is untested against a live `/configure` response
- [ ] Remove MediaFusion from defaults if it stays useless (its config is required)

**UI polish still open:**
- [ ] Landscape hero: you asked for side-by-side (text left / art right) — currently still a stacked banner, just shorter
- [ ] Landscape nav: I did full-width; you also floated a **left vertical rail** (Stremio desktop/TV style) — pick one
- [ ] Continue Watching row on Home when progress exists
- [ ] Library posters come from `LibraryItem.poster`, which is only set from the detail page — items added before that ship with no artwork
- [ ] WebView logs `tile memory limits exceeded` — consider smaller images / `loading="lazy"` tuning

**Later:**
- [ ] iOS build (cloud Mac, `.github/workflows/ios.yml` + `ios/App/ExportOptions.plist` exist). Remember `NSLocalNetworkUsageDescription` + ATS exceptions or it shows blank
- [ ] Termux server (`server.cjs` already ported for this)

---

## 6. Gotcha log

- The dev WebView silently swallowed `stremioCore.init()` failures. When a resource list is empty, check init before blaming the add-on.
- `screencap` on a sleeping device returns pure black — that cost a debugging detour early on.
- A bundle that "doesn't change" is almost always a missing `npm run build` before `cap sync`.
- Cinemeta's `stream` resource returns **torrents**, not HTTP. Don't read "N streams found" as "N playable streams".

---

## 7. Licencing

- Use **only MIT** packages. `stremio-web` is GPL-2.0 — reference only, never copy.
- `stremio-brand` has no licence (trademark) — never touch. App is branded **Kinora**.
- MIT in use: `@stremio/stremio-core-web` 0.63.2, `@stremio/stremio-colors` 5.2.0, `@stremio/stremio-icons` 5.15.0, `@stremio/stremio-video` 0.0.98.
