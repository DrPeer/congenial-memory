# Kitty Drop 🐱

A fluffy cat-merge game (Suika-style). Built with React + canvas + matter-js, styled with Tailwind.

The repo now ships **two front-ends that share one game**:

| Target                | How it runs                                                        | Command                  |
| --------------------- | ------------------------------------------------------------------ | ------------------------ |
| Web (browser)         | Vite dev server / static build                                     | `npm run dev`            |
| iOS + Android (Expo)  | The same game, embedded in a native WebView shell (Expo SDK 57)     | `npm run mobile`         |

> **The game itself is untouched.** Everything under `src/` is exactly the web game.
> The mobile app is a thin "core" (`mobile/` + `scripts/`) that packages that game and runs it
> full-screen on a phone. See [How the mobile core works](#how-the-mobile-core-works).

---

## 1. Requirements

- **Node.js 20+** and npm
- For phones: the free **Expo Go** app
  - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
  - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107773)
- No Xcode / Android Studio needed to run on a device or an Android emulator.
  (An iOS *simulator* requires macOS + Xcode.)

## 2. One-time setup

```bash
npm run mobile:setup     # installs web deps + mobile deps
```

## 3. Run it

### On a phone / emulator (Expo)

```bash
npm run mobile
```

That's the whole command. It:

1. builds the web game (`vite build` → one self-contained `dist/index.html`),
2. injects it into the Expo app (`mobile/src/gameHtml.ts`),
3. starts the Expo dev server and prints a **QR code**.

Then:

- **Android** — open Expo Go → *Scan QR code* (or press `a` in the terminal to boot an emulator).
- **iPhone** — scan the QR code with the **Camera app** → it offers to open Expo Go.
- Phone and PC must be on the **same Wi-Fi**. If your network blocks device-to-device
  traffic (hotels, campus Wi-Fi…), use a tunnel instead:

```bash
npm run mobile -- --tunnel
```

Other useful passthroughs (anything after `--` goes to `expo start`):

```bash
npm run mobile -- --android      # also launch a connected Android device/emulator
npm run mobile -- --ios          # also launch an iOS simulator (macOS only)
npm run mobile -- --offline      # no phone nearby? bundle check only
```

### Live-edit the game on the phone

```bash
npm run mobile:live
```

Starts `vite dev` next to Expo and points the app at it, so edits in `src/` hot-reload
straight onto the device. (In this mode the phone needs network access to your PC.)

### In the browser (unchanged)

```bash
npm run dev        # http://localhost:5173
npm run build      # single-file production build in dist/
npm run preview
```

---

## How the mobile core works

```
src/**  (the game, unchanged)
   │  vite build  (vite-plugin-singlefile → html+css+js inlined into ONE file)
   ▼
dist/index.html
   │  scripts/build-game-bundle.mjs
   │    • sanity-checks that nothing is left as an external file
   │    • injects a ~60-line "native bridge" right after <head>
   ▼
mobile/src/gameHtml.ts        (generated, git-ignored)
   │  Metro
   ▼
mobile/App.tsx  →  react-native-webview (full-screen canvas-game WebView)
```

The injected bridge is the only code that touches the game's environment, and it never
modifies game logic:

- **`localStorage` persistence** — a WebView loaded from a string has no usable
  `localStorage`, so the bridge provides one backed by the shell; the shell saves it with
  `AsyncStorage`. Your 👑 best score survives app restarts.
- **`kitty:ready` ping** — lets the shell hide its loading view once the game has booted.

The shell (`mobile/App.tsx`) additionally handles the phone-only bits: portrait lock,
safe areas (notch / gesture bar), audio autoplay policy, no scroll/zoom/rubber-banding,
ignoring the OS font-size setting, and reloading the WebView if iOS kills it under
memory pressure.

Game code stays 100% web-standard (canvas, WebAudio, pointer events), which is why it
runs identically in a browser and in the WebView — and why porting individual pieces to
native React Native later is optional, not required.

## Scripts

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | web game, Vite dev server                                         |
| `npm run build`        | web game, production single-file build                            |
| `npm run mobile`       | build game bundle → start Expo (QR code)                          |
| `npm run mobile:live`  | same, but the app loads the Vite dev server (hot reload on phone) |
| `npm run mobile:bundle`| rebuild `mobile/src/gameHtml.ts` only                             |
| `npm run mobile:setup` | install web + mobile dependencies                                 |
| `npm run mobile:install`| install mobile dependencies only                                 |
| `npm run mobile:typecheck` | type-check the Expo shell                                     |

Inside `mobile/` you can also use the stock Expo commands (`npx expo start`, `--android`,
`--ios`, `--tunnel`); its `prestart` hook rebuilds the game bundle first.

## Project layout

```
src/                  the game (web + mobile share it) — do not special-case platforms here
scripts/
  build-game-bundle.mjs   web build → mobile/src/gameHtml.ts (+ native bridge)
  start-mobile.mjs        the `npm run mobile` launcher (vite + expo orchestration)
mobile/               Expo app: App.tsx shell, app.json, assets
  src/gameHtml.ts     GENERATED — never edit, never commit
index.html            web entry (also the template for the mobile bundle)
```

## Installable builds (.ipa / .apk)

First, the honest physics of iOS signing — this decides what is possible where:

| You want                                        | What it requires                                                                 | Command                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| Test on a real phone, **zero accounts**          | nothing (Expo Go)                                                                 | `npm run mobile`           |
| **Android .apk** anyone can install              | free Expo account only                                                            | `npm run mobile:apk`       |
| **iOS .ipa for a real iPhone**                   | free Expo account **+ Apple Developer Program ($99/yr)**; built & signed on Expo's cloud Macs (EAS Build) | `npm run mobile:ipa`       |
| iOS build for the Simulator                      | free Expo account, no Apple account — but only runs inside Xcode's simulator on a Mac | `npm run mobile:ipa:sim`   |

There is deliberately **no `.ipa` in this repo, and none can be produced on Windows or Linux**:
Apple requires iOS binaries to be compiled *and signed* on macOS with Xcode. EAS Build rents you
Expo's cloud Macs so you never install Xcode, but the signing certificate still comes from your
Apple Developer membership. A free Apple ID can only sign builds through Xcode on a Mac you
physically control (7-day certificates, re-sideloading weekly).

### One-command .ipa (once you have the accounts)

```bash
npm i -g eas-cli          # once
eas login                 # free Expo account
npm run mobile:ipa        # = bundle the game, then: eas build --platform ios --profile preview
```

On the first build EAS links the project, asks for your Apple Developer credentials **once**,
generates the certificates/provisioning profile for you, builds on a cloud Mac, and then gives
you a page with a QR code and a **download link for the `.ipa`** (`preview` profile = internal
distribution, i.e. ad-hoc signed for the devices whose UDID you registered when prompted).
Same page can push the build to TestFlight later via `eas submit`.

`mobile/eas.json` profiles: `development` (dev client), `preview` (installable .ipa / .apk),
`simulator` (Mac-only simulator build), `production` (store submission).

### Test on an iPhone with no build at all

`npm run mobile` + Expo Go is the intended zero-friction test loop. The production web build is
also a single self-contained html file (`dist/index.html`): host it anywhere (or
`npm run preview -- --host`) and iPhone Safari → *Share → Add to Home Screen* gives you a
full-screen, app-icon experience of the exact same game.

## Releasing to the stores (later)

The shell is already a normal Expo project, so when you're ready:

1. `npm --prefix mobile install -g eas-cli && eas login`
2. `cd mobile && eas build:configure` — set your own `ios.bundleIdentifier` /
   `android.package` in `mobile/app.json` first (the placeholder is `com.kittydrop.game`).
3. `eas build --platform android` / `--platform ios` produces installable `.aab` / `.ipa`
   builds (the embedded game works offline — no server involved).

App name, icon and splash come from `mobile/app.json` + `mobile/assets/`
(`icon-source.png` is the editable source artwork for the icons).

## Notes & known behaviour

- The Google-Fonts stylesheet (`Fredoka`) stays external; on a device without internet the
  game falls back to the system font. Everything else is fully offline inside the app.
- Sound is synthesised with WebAudio; on iOS the first tap (the PLAY button) unlocks it,
  same as in the browser.
- `mobile/src/gameHtml.ts` is generated on every `npm run mobile`, so the phone always runs
  exactly what's in `src/` right now.
