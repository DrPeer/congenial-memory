#!/usr/bin/env node
/**
 * check.mjs — the single verification gate for humans AND AI agents.
 *
 *   npm run check          web typecheck + web build + sim smoke + mobile typecheck
 *   npm run check -- --full   also Metro-bundles the native app for android+ios
 *
 * If this passes, a change is structurally safe: both platforms compile and the
 * frozen v1 simulation still plays a full game headlessly.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = path.join(ROOT, "mobile");
const full = process.argv.includes("--full");

const SIM_SMOKE = `
const { KittySim, WORLD_W } = require("%BUNDLE%");
let score = 0, merges = 0, over = null;
const sim = new KittySim({
  onScore: (s) => (score = s),
  onNext: () => {},
  onMerge: () => merges++,
  onDanger: () => {},
  onGameOver: (s, b) => (over = { s, b }),
  onDiscover: () => {},
});
let t = 0; sim.prime(t); let drops = 0;
for (let f = 0; f < 60 * 240 && !over; f++) {
  t += 1000 / 60; sim.step(t);
  if (f % 40 === 0 && sim.canDrop) { sim.setPointerWorldX(60 + ((drops * 37) % (WORLD_W - 120))); if (sim.drop()) drops++; }
}
if (!merges || !score || !over) { console.error("sim smoke FAIL", { merges, score, over }); process.exit(1); }
console.log("sim smoke ok:", JSON.stringify({ drops, merges, score, over }));
`;

function run(label, cmd, args, cwd) {
  process.stdout.write(`• ${label} … `);
  const res = spawnSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
  if (res.status !== 0) {
    console.log("FAIL");
    console.error((res.stdout || "").toString().slice(-3000));
    console.error((res.stderr || "").toString().slice(-3000));
    process.exit(1);
  }
  console.log("ok");
  return res;
}

const npx = (p) => path.join(p, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");

run("web typecheck", npx(ROOT), ["--noEmit", "-p", "tsconfig.json"], ROOT);
run("web build", process.execPath, [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build"], ROOT);

const tmp = mkdtempSync(path.join(os.tmpdir(), "kitty-"));
const bundle = path.join(tmp, "sim.bundle.js");
run(
  "sim bundle",
  path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild"),
  ["src/game/sim.ts", "--bundle", "--platform=node", "--format=cjs", `--outfile=${bundle}`, "--log-level=error"],
  ROOT,
);
writeFileSync(path.join(tmp, "smoke.cjs"), SIM_SMOKE.replace("%BUNDLE%", bundle));
run("sim smoke (v1 rules play headlessly)", process.execPath, [path.join(tmp, "smoke.cjs")], ROOT);

run("mobile typecheck", npx(MOBILE), ["--noEmit"], MOBILE);

if (full) {
  for (const platform of ["android", "ios"]) {
    const out = path.join(tmp, `export-${platform}`);
    run(
      `metro export ${platform}`,
      process.execPath,
      [path.join(MOBILE, "node_modules", "expo", "bin", "cli"), "export", "--platform", platform, "--output-dir", out],
      MOBILE,
    );
  }
}

console.log("\n✔ all checks passed");
