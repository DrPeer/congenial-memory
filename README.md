# Kitty Drop 🐱

A fluffy cat-merge game (Suika-style). React + matter-js physics, hand-drawn canvas cats,
synthesised meows. Ships as **one shared game core** with two front-ends:

| Target            | Renderer                          | Command          |
| ----------------- | --------------------------------- | ---------------- |
| Web (browser)     | DOM canvas + WebAudio             | `npm run dev`    |
| iOS + Android       | React Native Skia + expo-audio    | `npm run mobile` |

The rules, physics and every draw call live in `src/game/` and are used by **both** platforms —
they cannot drift apart. See [Architecture](#architecture).

---

## 1. Requirements

- **Node.js 20+** and npm
- For phones: the free **Expo Go** app
  ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
  [iOS](https://apps.apple.com/app/expo-go/id982107773)). Skia, audio and haptics are all
  included in Expo Go — no custom dev client needed.
- No Xcode / Android Studio required for device testing (iOS *simulator* needs macOS).

## 2. Setup (once)

```bash
npm run mobile:setup     # installs web deps + mobile deps
```

## 3. Run it

### On a phone / emulator (Expo)

```bash
npm run mobile           # starts Expo, prints a QR code
```

- **Android** — Expo Go → *Scan QR code* (or press `a` for an emulator).
- **iPhone** — scan the QR with the **Camera app** → opens Expo Go.
- Same Wi‑Fi needed; on cellular / strict networks: `npm run mobile -- --tunnel`.

### In the browser (unchanged)

```bash
npm run dev              # http://localhost:5173
npm run build            # single-file production build in dist/
npm run preview:phone    # serve dist/ on 0.0.0.0:4173 for phones on your LAN
```

### Phone testing without Expo Go

```bash
npm run preview:phone                              # terminal 1
npx cloudflared tunnel --url http://127.0.0.1:4173 # terminal 2 → public https URL
```

Open the printed URL in Safari → *Share → Add to Home Screen* (web build, not the native app).

---

## Themes & plugins (safe playground for humans & AI)

- Every skin is a **plugin**: `src/plugins/<id>/` exports a `Theme` and registers with
  one line in `src/plugins/registry.ts`. Both menus show all themes as chips; the pick
  persists (`kittydrop-theme` key). Ships with *Sweet Berry* (default) and *Minty Milk*.
- Scaffold one: `npm run plugin:new -- --id peach-fuzz --name "Peach Fuzz" --emoji 🍑`
- Art pipeline: generate a magenta-back sticker sheet →
  `npm run sprites:slice -- --sheet <png> --names a,b,c` → shared `src/assets/sprites/*.png`,
  drawn identically on web (`HTMLImageElement`) and native (`SkImage`). Until a sprite
  decodes, the renderer falls back to the original emoji glyphs — nothing can hard-break.
- **Mechanics are frozen**: `src/game/sim.ts` is the original v1 system; themes/plugins
  only repaint.
- `npm run check` verifies everything (typechecks both platforms, builds the web game,
  and plays a headless sim smoke; add `--full` to also Metro-export both OS bundles).
- AI agents: read [`AGENTS.md`](AGENTS.md) first — invariants, recipes, ship commands.

## Play/test in ANY phone browser (no install, no Arena needed)

- The web build is a single self-contained HTML file, published at `docs/index.html`.
- Public CDN link (works on cellular, anywhere):
  `https://cdn.jsdelivr.net/gh/DrPeer/congenial-memory@arena/01a07d54-congenial-memory/docs/index.html`
  (CDN caches briefly — a fresh publish shows up within minutes.)
- Optional permanent short URL: enable GitHub Pages once — repo **Settings → Pages →
  Deploy from a branch → branch `arena/01a07d54-congenial-memory`, folder `/docs`** — then the
  game lives at `https://drpeer.github.io/congenial-memory/`.
- After changing the game, republish with: `npm run pages:publish` (builds, commits + pushes `docs/index.html`).
- Note: Arena's in-chat live preview only renders *inside* Arena's UI; plain phone browsers
  need one of the URLs above.

## Architecture

```
src/game/
  cats.ts        cat definitions, tiers, combo words      ─┐
  sim.ts         matter-js physics + ALL rules (pure TS)   │  shared core
  render.ts      the whole picture, drawn via Ctx2D        │  (no DOM, no RN)
  drawCat.ts     fluffy cat painter (paths only)          ─
  ctx2d.ts       minimal Canvas2D interface                │
                                                          ─┘
        ▲                                    ▲
        │ CanvasRenderingContext2D           │ SkiaCtx2D (Skia adapter)
        │                                    │
  web:  engine.ts (RAF loop, WebAudio,   mobile: native/* (Skia Pictures,
        vibrate, DOM canvas)                     expo-audio WAVs, haptics,
                                                 RN HUD/menus, EAS Update)
```

- **Web** (`src/game/engine.ts`): thin host — canvas, RAF, sound, vibration.
- **Native** (`mobile/src/native/`): thin host — Skia records each frame of the
  *same* `renderScene()` into a Picture; HUD/menus are React Native; meows are WAV
  renditions of the web synth (`scripts/gen-sounds.mjs`, same envelopes/oscillators);
  merges also fire `expo-haptics`.
- Best score persists per platform via the same key (`kittydrop-best`): localStorage on
  web, AsyncStorage in the app.
- Regenerate sound assets after touching `sound.ts` math: `node scripts/gen-sounds.mjs`.

## Scripts

| Command                    | What it does                                              |
| -------------------------- | --------------------------------------------------------- |
| `npm run dev` / `build`    | web game dev server / production single-file build         |
| `npm run preview:phone`    | serve the web build on your LAN for phones                 |
| `npm run mobile`           | Expo dev server + QR (native app, Expo Go)                 |
| `npm run mobile:setup`     | install web + mobile dependencies                          |
| `npm run mobile:typecheck` | type-check the native app                                  |
| `npm run mobile:update`    | **EAS Update** → push the current game to the `preview` channel |
| `npm run mobile:update:prod` | EAS Update → `production` channel                        |
| `npm run mobile:apk`       | cloud-build an installable Android .apk (free Expo account) |
| `npm run mobile:ipa`       | cloud-build an iOS .ipa (needs Apple Developer Program)     |
| `npm run mobile:ipa:sim`   | cloud-build for the iOS simulator (no Apple account)        |

## Shipping updates over the air (EAS Update)

JS-only changes (game rules, art, HUD — i.e. almost everything) reach installed apps
**without store review**:

```bash
npm i -g eas-cli && eas login     # once, free Expo account
npm run mobile:update             # builds + publishes to the preview channel
```

Apps built with a given channel pull updates on launch (`runtimeVersion` follows
`appVersion`, so updates never land on incompatible native builds). Native-side changes
(new permissions, SDK bumps) still need a store build: `npm run mobile:apk` / `mobile:ipa`
(profiles in `mobile/eas.json`).

## Installable builds (.ipa / .apk)

| Artifact                        | Requires                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| Android .apk                    | free Expo account — `npm run mobile:apk`                         |
| iOS .ipa for real iPhones       | free Expo account + **Apple Developer Program ($99/yr)** — `npm run mobile:ipa` |
| iOS simulator build             | free Expo account, macOS to run it — `npm run mobile:ipa:sim`    |

iOS binaries must be compiled & signed on macOS; EAS Build provides cloud Macs so you never
install Xcode, but Apple signing still requires the Developer Program. Before your first
store build, set your own `ios.bundleIdentifier` / `android.package` in `mobile/app.json`
(placeholder: `com.kittydrop.game`).

## Project layout

```
src/                 shared game core + web host (engine.ts, App.tsx, components/)
scripts/
  start-mobile.mjs   the `npm run mobile` launcher
  gen-sounds.mjs     web synth → mobile/assets/sounds/*.wav
mobile/              Expo app: App.tsx, native/ (Skia adapter, screens, sounds), eas.json
mobile/assets/       icon + splash artwork (icon.png, icon-source.png) + sound WAVs
index.html           web entry
```

## Notes & known behaviour

- The native app uses system fonts (Fredoka is web-only for now); gameplay/art are identical.
- Native meows are pre-rendered WAVs: same synth, fixed per-tier volume/pitch (web stays live).
- The game auto-pauses when the native app is backgrounded; portrait is locked.
- Google Fonts stays external on web; offline it falls back to the system font. The native
  app is fully offline.
