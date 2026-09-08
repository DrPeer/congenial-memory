#!/usr/bin/env node
/**
 * start-mobile.mjs — one command to get Kitty Drop running on iOS / Android.
 *
 *   npm run mobile                 start Expo (QR code for Expo Go)
 *   npm run mobile -- --tunnel     through Expo's tunnel (different networks)
 *   npm run mobile -- --android    also boot a connected Android emulator/device
 *   npm run mobile -- --ios        also boot an iOS simulator (macOS only)
 *
 * The app is fully native now (Skia + matter-js): nothing is pre-built, Metro
 * bundles the shared game core from ../src straight from source.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const MOBILE = path.join(ROOT, "mobile");

const expoArgs = ["start", ...process.argv.slice(2)];

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!existsSync(path.join(MOBILE, "node_modules", "expo"))) {
  fail(`the Expo app's dependencies are missing.\n  Run:  npm run mobile:setup`);
}

console.log(`→ starting Expo (mobile/) with: expo ${expoArgs.join(" ")}\n`);
console.log("  scan the QR with Expo Go, or press a / i for emulator / simulator.\n");

const child = spawn(process.execPath, [path.join(MOBILE, "node_modules", "expo", "bin", "cli"), ...expoArgs], {
  cwd: MOBILE,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
