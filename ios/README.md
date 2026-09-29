# Building the iOS app

The Android build is done from Windows. **iOS is not** — `xcodebuild` needs macOS
and Xcode, and there is no way around that. This is a toolchain limit, not a
configuration problem.

Two routes, depending on whether you have a Mac available.

## Route 1 — GitHub Actions (works from Windows, no Mac)

`.github/workflows/ios.yml` builds an **unsigned** `.ipa` on a `macos-14`
runner. Push to `main`, or run the workflow by hand from the Actions tab, then
download `Kinora-unsigned-ipa` from the run summary.

The workflow deliberately signs nothing. A signed build needs a certificate that
only exists on a machine with Xcode access, and a half-signed build fails at
install with a profile error that gives no clue. An unsigned build is signed
afterwards on your own machine by Sideloadly or AltStore, which works fine on
Windows.

### Installing it (Windows)

1. Download **Sideloadly** from [sideloadly.io](https://sideloadly.io).
2. Connect the iPhone by USB and trust the computer.
3. Enter your Apple ID in Sideloadly. Use a throwaway one if you prefer — an
   Apple ID is not a secret here, but it is an account.
4. Drag in `Kinora-unsigned.ipa`, pick the device, hit Start.
5. On the phone, **Settings → Privacy & Security → Developer Mode** must be on.
   Sideloadly will prompt for it.

**Free Apple ID: the install expires after 7 days** and needs re-installing.
That is Apple's limit on free provisioning, not a bug in the build. A paid
Developer account ($99/year) gives 12 months and a year's certificates.

## Route 2 — a Mac

```bash
npm ci
npm run build
npx cap sync ios
cd ios/App
pod install          # not needed if the project is on SwiftPM
open App.xcworkspace  # the .xcworkspace, not the .xcodeproj
```

Then select your team under Signing & Capabilities and run on a device. For an
`.ipa` to sideload, use **Product → Archive → Distribute App**.

## What is different from Android

The web app is identical — same bundle, same features. What differs is the
native layer, and all of it lives in `ios/App/App/`:

| Android | iOS | Why it is not shared |
|---|---|---|
| `MainActivity.java` | `SceneDelegate.swift` | Different lifecycle; the web view exists after `makeKeyAndVisible` |
| `ImmersivePlugin.java` | `ImmersivePlugin.swift` | Status bar and home indicator are per-view-controller on iOS |
| `BackButtonPlugin.java` | `BackButtonPlugin.swift` | iOS has no `KEYCODE_BACK`; the swipe gesture is suppressed instead |
| Navigation guards in `MainActivity` | `NavigationGuardPlugin.swift` | `WKNavigationDelegate` + `WKUIDelegate` instead of `WebViewClient` |

Every call from the web app is wrapped in a `try`/`catch` in
`src/services/immersive.ts` and `src/services/back-button.ts`, so a plugin that
is missing or fails degrades to "no immersive mode" rather than a broken player.

### The navigation guard is the important one

It is what stops tapping play in a provider frame from opening Safari to an
advert. It closes two paths on iOS, the same two as on Android:

1. Top-level navigation to a host outside `server.allowNavigation`. The list is
   read through Capacitor's own `shouldAllowNavigation(to:)`, so both platforms
   are configured from `capacitor.config.ts` and cannot drift apart.
2. `target="_blank"` / `window.open()` popups, which never reach the navigation
   delegate and are caught by `WKUIDelegate.createWebViewWith`.

`EXTERNAL_LINK_HOSTS` in `NavigationGuardPlugin.swift` is the short list of
hosts allowed to open in Safari. **Adding a host there means adverts may open
that one in Safari** — it is a deliberate allow-list, not a denylist.

## Known gaps

- **Not compiled yet.** This has not been through Xcode. Expect to fix
  something on the first real build; the Swift is written against the Capacitor
  8 APIs in `node_modules/@capacitor/ios` and those were checked, but a compiler
  is a compiler.
- **No subtitles anywhere**, on either platform. Providers handle their own
  inside the frame.
- **`EXTERNAL_LINK_HOSTS` still lists the sports hosts** even though the sports
  section was removed. They are harmless — nothing links to them — but the list
  should be emptied, and the Android one already was.
