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

### ✅ THE PLAYER WORKS — verified on device

Confirmed playing on the phone: landscape, Netflix-styled chrome, video
rendering, scrub bar advancing to 0:10/0:10. The player is **not** the problem.

To verify it without a debrid account, the detail page appends a clearly
labelled entry to the Sources list whenever nothing is genuinely playable:

> Player demo — test clip, not this title

It is only added when `playableCount === 0`, so it never masks real results.

### ⚠️ Real movies still need a debrid account

**Reproduce it:** open any title → *Sources*. The streams that come back are
torrent/P2P descriptors, not HTTP URLs, so the player has nothing to load.

**Root cause:** the WebView has no torrent engine. See below.

---

There is **no free, no-account source of playable HTTP streams.** Two ways forward — pick one:

I tested every plausible add-on against the real Stremio API:

| Add-on | Result |
|---|---|
| **Torrentio** | 50 streams, but **every one has `url: undefined`** — they're torrent descriptors for Stremio's *built-in libtorrent engine*. A WebView has no torrent engine. |
| **MediaFusion** | 1 stream, and it's an `/static/exceptions/invalid` placeholder. All its providers fail without config. |
| **Cinemeta** | Returns P2P torrents. Not playable. |

ElfHosted's own docs confirm this: *"We don't recommend running Stremio in 'free mode' (no provider, just P2P or HTTP-direct addons)."*

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
- **Streams/subtitles:** `src/services/addon-client.ts` — a **direct addon-v3 HTTP client**
- **Default add-ons:** Cinemeta + MediaFusion (persisted store v3, `migrate` repairs stale transport URLs)

### `stremio-core-web` was REMOVED — don't put it back

The plan's "escape hatch" fired. `@stremio/stremio-core-web` is a **CommonJS
wasm-bindgen module** whose entry point is a low-level `start()` / `dispatch()`
RPC bridge — *not* the `default()` factory the wrapper assumed. That threw
`TypeError: (intermediate value).default is not a function` and the WASM was
never initialised, so streams silently never loaded.

`addon-client.ts` now does the protocol directly (six GETs) and was strictly
better: no WASM, no worker, no `init()` step, no init-failure failure mode. The
WASM chunk is gone from the build.

Add-on config travels as query params (`?debridToken=…`), which is what the
debrid add-ons expect. `stremio://…` install links are unwrapped on paste.

### The `crossOrigin` trap (cost real time)

`<video crossOrigin="anonymous">` applies a **CORS check** that most stream
hosts and debrid CDNs do not satisfy — playback dies with a generic media
error. I had it set "for subtitles" and it silently killed *all* playback.
**Never set `crossOrigin` on the video element.**

### The add-on configure flow is HTML, not JSON

`/configure` on every real add-on (Torrentio, MediaFusion, Comet…) returns
**text/html** — it's the page that generates the `stremio://` install link. The
app therefore opens it in the system browser via `@capacitor/browser` and
detects a JSON response as a bonus. `AddonConfigForm` renders the form when one
is actually available.

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
- `PlayerModal` shows a full-screen "Up next" takeover in the last 20s and on
  `ended`, with a red countdown ring and an 8s auto-advance
- Also a persistent "Next episode" button on the series detail page
- `onProgress` persists watch progress → powers Continue Watching

**Netflix-style player** (`PlayerModal.tsx`)
- Forces **landscape** on open via `@capacitor/screen-orientation`, unlocks on exit
- Chrome auto-hides after 3.2s, tap to toggle, centre play/pause
- Red scrub bar with buffered indicator, 10s skip buttons, volume slider,
  fullscreen, subtitle picker, Netflix-red spinner and error state
- Keyboard: `space`/`k` play-pause, `←`/`→` seek, `f` fullscreen, `m` mute, `esc` exit

**Light/dark theme fixed** — `:root` is now the light palette and `.dark` on
`<html>` swaps the dark one, so the toggle (and `system`) actually work.
Previously every token was hardcoded dark.

⚠️ The next-episode flow still needs a real series with playable streams.

---

## 5. Todo

**Blocked on your decision (§2):**
- [ ] Pick Option A (debrid) or B (torrent engine)
- [ ] **Until then the app is a catalogue browser, not a player** — the single most important outstanding item

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
- **Never use PowerShell `Set-Content` on source files.** It re-encodes as ANSI and silently corrupts every non-ASCII character (`è`, `ñ`, `ó`) into invalid UTF-8. The symptom is a confusing `UNLOADABLE_DEPENDENCY … stream did not contain valid UTF-8` from rolldown, while `tsc` passes clean. Use the `edit`/`write` tools instead. If it happens: `git checkout -- <file>` and redo with the edit tool.
- **React error #310 = "rendered more hooks than during the previous render."** Cause: a `useEffect`/`useRef` placed *after* an early `return`. In `DetailPage` the loading/error guards used to sit above the next-episode hooks, which blanked the whole page. All hooks must come before any early return.

---

## 7. Licencing

- Use **only MIT** packages. `stremio-web` is GPL-2.0 — reference only, never copy.
- `stremio-brand` has no licence (trademark) — never touch. App is branded **Kinora**.
- MIT in use: `@stremio/stremio-core-web` 0.63.2, `@stremio/stremio-colors` 5.2.0, `@stremio/stremio-icons` 5.15.0, `@stremio/stremio-video` 0.0.98.
