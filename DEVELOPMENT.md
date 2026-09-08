# DEVELOPMENT.md — Kitty Drop: the complete handover

Everything needed to continue this project later (you on your PC, or any AI agent).
Short version: **read `AGENTS.md` for the rules, this file for the map + history + gotchas.**

---

## 1. What this project is

**Kitty Drop** — a cat-merge drop game (Suika-style): drag a dropper, drop cats into a
basket, same-tier cats merge into the next tier, combos multiply score, overflow past the
dashed danger line = game over. Original v1 was a single-page web game; today it is:

| Target | How | Status |
|---|---|---|
| Web (browser, single file) | Vite + React + DOM canvas | ✅ shipped, `docs/index.html` |
| Android + iOS native | Expo SDK 57 / React Native 0.86, **no WebView**: Skia renders the same core | ✅ code-complete, Expo-Go testable |
| OTA updates | EAS Update (channels dev/preview/production) | ✅ configured |
| Installables | EAS Build (`.apk` free; `.ipa` needs Apple Dev $99) | ✅ scripted |

**The v1 rules are the baseline.** `src/game/sim.ts` (matter-js physics, merge/combo/scoring,
danger logic, timings) behaves like the first version; change existing numbers only on
explicit user request. Post-v1 additions live in sim.ts so both platforms share them:
overfull countdown fuse (`DANGER_FUSE_MS` + `dangerLeft`), coin minting (`MergeEvent.coins`),
boosters `raiseCup()` / `shootTopCat()` (costs `BOOST_*`, cap `MAX_CUP_LIFT`, fx `sim.shots`).

## 2. Repository map

```
src/game/            THE shared core (web + native run this exact code)
  sim.ts             frozen v1 mechanics (matter-js world, merges, combos, score)
  render.ts          renderScene(ctx, sim, now, {theme, sprites}) — all layers
  drawCat.ts         vector cat painter (tiers 0..6 + accessories)
  ctx2d.ts           the Ctx2D interface = the parity contract (+ drawImage)
  engine.ts          WEB host: rAF loop, input, audio, DOM canvas
  sprites.ts         SpriteId list, SpriteBank iface, glyph→sprite map, decor slots
  spritesWeb.ts      web bank: vite png imports → HTMLImageElement
  levels.ts          3 worlds: theme + obstacles + cup inset + win tier
  missions.ts        MissionStore: shared meta goals + coin rewards
  musicSpec.ts       ONE music source: chord loops per map (web synth + wav gen)
  music.ts           web BGM scheduler (WebAudio lookahead loop)
  ads.ts             ad-slot seam (simulated sponsor reel today)
  shop.ts            shop catalog: coin packs, theme/basket/trail skins, Equip type
  purchases.ts       real-money seam: PurchaseProvider + SimulatedCheckout (test mode)
  theme.ts           Theme data shape (colors, alphas) — cosmetics only
  cats.ts sound.ts   tier defs / web synth SFX
src/assets/sprites/  generated sticker PNGs (128px) + pattern.png (512 tile)
src/plugins/         THEME PLUGINS: sweet-berry (default), minty-milk + registry.ts
src/App.tsx          web menu (theme chips, best score, hero cat, wallet + shop host)
src/components/      web Game.tsx (HUD/modals), Shop.tsx, Icon.tsx, CatIcon.tsx
mobile/              Expo app (its own package.json/node_modules!)
  App.tsx            menu/game switch, AsyncStorage best+theme, portrait lock
  src/native/
    missionsNative.ts AsyncStorage-backed MissionStore singleton
    skiaCtx.ts       Skia adapter implementing Ctx2D (the ONLY native draw code)
    GameScreen.tsx   rAF loop → PictureRecorder → <Picture>, touch input, haptics
    MenuScreen.tsx   native menu + theme chips + SHOP button
    ShopModal.tsx    native shop (RN twin of web Shop.tsx)
    spritesNative.ts expo-asset → bytes → SkImage bank
    sounds.ts        31 WAV pools (expo-audio); catPicture.ts Skia cat portraits
    musicNative.ts   expo-audio loop player for the WAV music tracks
  assets/sounds/     generated WAVs (scripts/gen-sounds.mjs)
  assets/_*-source.png  raw AI sheet sources (underscore = not bundled)
scripts/
  check.mjs          THE gate: web tsc + web build + sim smoke + mobile tsc (--full: Metro exports)
  new-plugin.mjs     theme plugin scaffolder
  slice-sprites.mjs  magenta sheet → chroma-key → src/assets/sprites/*.png
  screenshot-game.mjs headless gameplay frames via real renderer → screenshots/*.png
  gen-sounds.mjs     offline WebAudio math → 31 WAVs
  gen-music.mjs      musicSpec.ts → seamless loop WAVs (native BGM)
  start-mobile.mjs   friendly `npm run mobile` launcher
docs/index.html      published single-file web build (GitHub Pages / CDN)
AGENTS.md            rules for AI agents (invariants, recipes, verify-before-finish)
```

## 3. Commands cheat-sheet

```bash
npm run check                # ALWAYS before/after changes (both platforms + sim smoke)
npm run check -- --full      # + Metro export android & ios (thorough, slow)
npm run dev                  # web dev server
npm run build && npm run preview:phone   # web prod build served on :4173
npm run plugin:new -- --id x --name X --emoji 🎀   # new theme plugin
npm run sprites:slice -- --sheet <png> --names a,b # new sticker art
node scripts/screenshot-game.mjs         # eyeball a real rendered frame headlessly
npm run pages:publish        # rebuild + push docs/index.html (web test URL)
npm run mobile               # QR for Expo Go (run on YOUR PC; add --tunnel for cellular)
npm run mobile:update        # EAS Update → preview channel (installed apps only)
npm run mobile:apk           # installable Android via EAS cloud (free account)
npm run mobile:ipa           # .ipa via EAS cloud Macs (needs Apple Developer $99)
```

First time on a PC: `npm run mobile:setup` (installs root + mobile deps).

## 4. How to add things (recipes)

- **Theme**: `plugin:new` → edit colors in `src/plugins/<id>/index.ts` → one import line in
  `registry.ts` → done; both menus list it automatically; pick persists (`kittydrop-theme`).
- **Sprite/sticker**: generate sheet on **pure #FF00FF** grid → `sprites:slice` → add id to
  `SpriteId`/`SPRITE_IDS` (+`GLYPH_SPRITE` if it replaces a particle emoji). Web & native
  banks pick files up automatically; emoji fallback covers load time.
- **Backdrop texture**: replace `src/assets/sprites/pattern.png` (drawn at `theme.patternAlpha`).
- **Sound**: add synth voice in `src/game/sound.ts` AND a generator case in
  `scripts/gen-sounds.mjs`, run it, add `require(...)` line in `mobile/src/native/sounds.ts`.
- **Drawing calls**: add to `Ctx2D` + `skiaCtx.ts` (web canvas satisfies new methods for free
  only if signatures match DOM canvas).
- **HUD/menu**: mirror in web (`App.tsx`/`Game.tsx`) and native (`MenuScreen`/`GameScreen`).

## 5. Gotchas learned the hard way (do not relearn)

- Metro/Expo SDK 57: `expo/metro` does not exist → `expo/metro-config`; blockList must be ONE
  merged RegExp (arrays with different flags throw).
- react-native-skia 2.x: no `useDrawCallback`; render via `PictureRecorder` + `<Picture>` per
  frame; canvas TYPE is `SkCanvas`; enums capitalized (`StrokeCap.Round`); `drawImageRect`.
- expo-audio: no `shouldDuckOthers`; use `interruptionMode:"mixWithOthers"` + `playsInSilentMode`.
- Metro can't see dynamic asset paths → sounds/sprites are hand-listed `require()`s.
- Vite host checks: `server.allowedHosts` AND `preview.allowedHosts` = true.
- Launcher scripts must NOT set `CI` in the spawned Expo env.
- Sandbox (Arena) network: only npm registry works — no ngrok/cloudflared/localtunnel, no
  browser downloads; phone tests from sandbox are impossible, test from your PC.
- Arena live previews render ONLY inside Arena's UI (phone Safari shows "Preview Unavailable").
- jsDelivr CDN link of `docs/index.html` was reported not working by the user (reason unknown —
  possibly regional/CDN cache); prefer GitHub Pages (enable once: Settings → Pages → branch
  `arena/01a07d54-congenial-memory`, folder `/docs`) or just open `docs/index.html` from disk.
- iPhone on cellular can't see LAN IPs: from your PC use `npx expo start --tunnel` or EAS builds.

## 6. State & history (as of 2026-09-08)

- Branch `arena/01a07d54-congenial-memory`, PR #1 open vs `main`:
  https://github.com/DrPeer/congenial-memory/pull/1
- Key commits: native rewrite (`ba23ad6`), themes+plugins+stickers (`0a94e9b`),
  Pages publish + phone-test docs (later commits).
- Verified green: `npm run check`, Metro android+ios bundles, web single-file build.
- Shop live (coins→skins, money→coins via test-mode checkout); real store billing
  awaits a provider hookup (RevenueCat/expo-iap native, Stripe web) — seam is ready.
- Splash (guest/local login) + 3 difficulty modes + scope-aim shoot booster +
  themed BGM (web synth / native WAV loops) + glass-jar visual pass: all in.
- Headless frames for both themes: `screenshots/frame-*.png` (regenerate anytime).

## 7. Ideas parked for later

- More plugin kinds (sprite packs, cat accessory palettes, seasonal events) — `GamePlugin`
  interface is the extension point.
- GitHub Pages enablement (one settings click) for a permanent public test URL.
- EAS first-build from your PC → then `npm run mobile:update` becomes the everyday update loop.
- Store listing assets (icons exist in `mobile/assets/`), privacy policy page for stores.
