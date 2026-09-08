# AGENTS.md — working on Kitty Drop (for AI agents & humans)

Read this before changing anything. The repo is deliberately shaped so an agent can
add features **without being able to break the game**.

## The one invariant

> `src/game/sim.ts` is the frozen v1 system: physics constants, merge/combo/scoring
> rules, danger-line logic, drop cadence. **Never change gameplay numbers or logic.**
> Everything else (rendering, themes, sprites, HUD, menus, sounds, plugins) is fair game.

Parity rule: web and native render through the SAME code (`src/game/render.ts`,
`src/game/drawCat.ts`) via the `Ctx2D` interface (`src/game/ctx2d.ts`). If you add a
draw call, add it to `Ctx2D` + BOTH adapters (DOM canvas is free; Skia adapter lives in
`mobile/src/native/skiaCtx.ts`).

## Verify before you finish (mandatory)

```bash
npm run check            # web tsc + web build + headless sim smoke + mobile tsc
npm run check -- --full  # + Metro export for android AND ios (slow, thorough)
```

The sim smoke plays 4 simulated minutes headlessly and fails if merges/scoring/game-over
regress. If `npm run check` is green, the change is structurally safe.

## Adding a theme (the supported way to restyle)

```bash
npm run plugin:new -- --id peach-fuzz --name "Peach Fuzz" --emoji 🍑
# edit src/plugins/peach-fuzz/index.ts, add the printed line to src/plugins/registry.ts
npm run check
```

Themes are data (`src/game/theme.ts`); the picker in both menus lists every registered
plugin theme automatically. Plugins may carry cosmetics only (`src/plugins/types.ts`).

## Adding art (custom textures / emojis)

1. Generate a sticker **sheet** on a pure magenta `#FF00FF` background, even NxM grid,
   thick white outlines, flat pastel style (matches the existing pack).
2. Slice + chroma-key it into the shared sprite folder:
   ```bash
   npm run sprites:slice -- --sheet mobile/assets/_sheet-source.png \
     --names heart,paw,sparkle,star,yarn,fish,crown,bow,cloud
   ```
3. Register new ids in `src/game/sprites.ts` (`SpriteId`, `SPRITE_IDS`, and
   `GLYPH_SPRITE` if it replaces a particle emoji). Web + native pick the files up
   automatically (`spritesWeb.ts` / `spritesNative.ts`); until an image decodes, the
   renderer falls back to the original emoji glyph, so nothing can hard-break.
4. Backdrop texture = `src/assets/sprites/pattern.png` (drawn at `theme.patternAlpha`).

Keep source sheets in `mobile/assets/_*-source.png` (underscore = raw source, not bundled).

## Adding gameplay-adjacent features safely

- New HUD/menus: web = `src/App.tsx` + `src/components/Game.tsx`;
  native = `mobile/App.tsx` + `mobile/src/native/*Screen.tsx`. Mirror both.
- New sounds: extend `src/game/sound.ts` (web synth) **and** `scripts/gen-sounds.mjs`
  (native WAVs), then `node scripts/gen-sounds.mjs` + add the require to
  `mobile/src/native/sounds.ts`.
- Haptics: native only, in `GameScreen` merge/drop handlers.
- Never reach across: web must not import from `mobile/`; native must not import web
  hosts (`engine.ts`, `sound.ts`). Shared code = `src/game/*` + `src/plugins/*` only.

## Shipping what you built

```bash
npm run mobile            # QR → Expo Go (Skia/audio/haptics included in Go)
npm run mobile:update     # EAS Update → preview channel (no store review)
npm run mobile:apk        # installable Android artifact (free Expo account)
```

`runtimeVersion` follows `appVersion`: JS updates never land on incompatible builds.

## Style

- TypeScript strict everywhere; no `any` in shared code.
- Keep draw code allocation-light (it runs 60×/s on phones).
- Comments explain *why*; the renderer mirrors v1 geometry on purpose.
