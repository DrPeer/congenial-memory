/**
 * GamePlugin — the extension point for humans AND AI agents.
 *
 * A plugin may contribute *content and cosmetics* only:
 *   • themes  (repaints; mechanics in src/game/sim.ts are frozen at v1)
 *   • (future) sprite packs, menu decorations, cat accessory palettes…
 *
 * Rules for adding one (see AGENTS.md):
 *   1. create src/plugins/<id>/index.ts exporting `const plugin: GamePlugin`
 *   2. register it in src/plugins/registry.ts (one import line)
 *   3. never import from mobile/ or touch sim.ts physics constants
 */
import type { Theme } from "../game/theme";

export interface GamePlugin {
  id: string;
  /** human/AI-readable description of what this plugin adds */
  description?: string;
  theme?: Theme;
}
