#!/usr/bin/env node
/**
 * new-plugin.mjs — scaffold a theme plugin in seconds (for humans and AI agents).
 *
 *   node scripts/new-plugin.mjs --id peach-fuzz --name "Peach Fuzz" --emoji 🍑
 *
 * Creates src/plugins/<id>/index.ts with a full Theme stub and prints the one
 * registry line to add. Mechanics stay untouched by construction: a plugin can
 * only carry cosmetics (see src/plugins/types.ts).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : "";
};
const id = get("--id") || "my-theme";
const name = get("--name") || id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const emoji = get("--emoji") || "🎀";

const dir = path.join(ROOT, "src", "plugins", id);
if (existsSync(dir)) {
  console.error(`✖ src/plugins/${id} already exists`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const varName = id.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

writeFileSync(
  path.join(dir, "index.ts"),
  `/**
 * ${name} — theme plugin (scaffolded by scripts/new-plugin.mjs).
 * Cosmetics only: mechanics live in src/game/sim.ts and are frozen at v1.
 */
import type { Theme } from "../../game/theme";
import type { GamePlugin } from "../types";

export const ${varName}Theme: Theme = {
  id: "${id}",
  name: "${name}",
  emoji: "${emoji}",
  hostBg: "#ffd6e7",
  hostBgMid: "#ffe3ee",
  hostBgEnd: "#fff3d6",
  cupFillTop: "#fff6fa",
  cupFillBottom: "#ffdfed",
  cupStroke: "#f79ec0",
  cupRim: "rgba(247, 158, 192, 0.5)",
  cupShadow: "rgba(190, 95, 130, 0.2)",
  patternAlpha: 0.4,
  decorAlpha: 0.16,
  fishAlpha: 0.28,
};

export const ${varName}: GamePlugin = {
  id: "${id}",
  description: "TODO: describe this skin",
  theme: ${varName}Theme,
};
`,
);

console.log(`✔ created src/plugins/${id}/index.ts`);
console.log(`\nnow register it in src/plugins/registry.ts:`);
console.log(`  import { ${varName} } from "./${id}";`);
console.log(`  export const plugins: GamePlugin[] = [sweetBerry, mintyMilk, ${varName}];`);
console.log(`\nthen verify:  npm run check`);
