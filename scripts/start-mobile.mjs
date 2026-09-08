#!/usr/bin/env node
/**
 * start-mobile.mjs — one command to get Kitty Drop running on iOS / Android.
 *
 *   npm run mobile                 build the game bundle, then start Expo (QR code)
 *   npm run mobile -- --tunnel     same, through Expo's tunnel (different networks)
 *   npm run mobile -- --android    also boot a connected Android emulator/device
 *   npm run mobile -- --ios        also boot a connected iOS simulator (macOS only)
 *   npm run mobile:live            also run the Vite dev server and point the app
 *                                  at it, so edits to /src hot-reload on the phone
 *
 * Everything else (the game itself) is untouched - this only wires up processes.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const MOBILE = path.join(ROOT, "mobile");
const BUNDLE = path.join(ROOT, "scripts", "build-game-bundle.mjs");
const GAME_HTML_MODULE = path.join(MOBILE, "src", "gameHtml.ts");
const VITE_PORT = Number(process.env.VITE_PORT || 5173);

const argv = process.argv.slice(2);
const consumed = new Set(["--live", "--skip-build"]);
const live = argv.includes("--live");
const skipBuild = argv.includes("--skip-build") || live;
const expoArgs = ["start", ...argv.filter((a) => !consumed.has(a))];

const isWin = process.platform === "win32";
const run = (cmd, args, opts = {}) => spawn(cmd, args, { stdio: "inherit", ...opts });

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/* ---------------------------------------------------------- pre-flight checks */
if (!existsSync(path.join(ROOT, "node_modules", "vite"))) {
  fail(`the web game's dependencies are missing.\n  Run:  npm install`);
}
if (!existsSync(path.join(MOBILE, "node_modules", "expo"))) {
  fail(`the Expo app's dependencies are missing.\n  Run:  npm run mobile:install`);
}

/* ----------------------------------------------------- 1. game bundle (unless live) */
if (!skipBuild || !existsSync(GAME_HTML_MODULE)) {
  const res = run(process.execPath, [BUNDLE], { stdio: "inherit" });
  const code = await new Promise((resolve) => res.on("exit", resolve));
  if (code !== 0) fail("could not build the game bundle for mobile");
}

/* ---------------------------------------------------------- 2. optional vite dev server */
let viteChild = null;
let gameUrl = "";

function lanIPv4() {
  if (process.env.GAME_HOST) return process.env.GAME_HOST;
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const i of list ?? []) {
      if (i.family === "IPv4" && !i.internal) candidates.push({ name, address: i.address });
    }
  }
  // prefer wired/wifi over docker/vm interfaces
  const preferred = candidates.find((c) => /en|eth|wlan|wi-fi|wifi/i.test(c.name));
  return (preferred ?? candidates[0])?.address ?? "127.0.0.1";
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect({ port, host });
      sock.once("connect", () => {
        sock.end();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`nothing listened on :${port}`));
        else setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

if (live) {
  console.log(`→ starting Vite dev server on :${VITE_PORT} …`);
  viteChild = run(process.execPath, [
    path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
    "--host",
    "0.0.0.0",
    "--port",
    String(VITE_PORT),
    "--strictPort",
  ], { cwd: ROOT });
  await waitForPort(VITE_PORT).catch(() => fail(`Vite dev server did not start on port ${VITE_PORT}`));
  gameUrl = `http://${lanIPv4()}:${VITE_PORT}`;
  console.log(`→ phones will load the game from ${gameUrl} (edit /src and it hot-reloads)`);
}

/* --------------------------------------------------------------- 3. expo start */
console.log(`→ starting Expo (mobile/) with: expo ${expoArgs.join(" ")}\n`);

const expoChild = run(process.execPath, [path.join(MOBILE, "node_modules", "expo", "bin", "cli"), ...expoArgs], {
  cwd: MOBILE,
  env: { ...process.env, ...(gameUrl ? { EXPO_PUBLIC_GAME_URL: gameUrl } : {}) },
});

/* ------------------------------------------------------------------ teardown */
const shutdown = () => {
  for (const child of [viteChild]) {
    if (child && !child.killed) child.kill("SIGTERM");
  }
};
expoChild.on("exit", () => {
  shutdown();
  process.exit(0);
});
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    shutdown();
    if (!expoChild.killed) expoChild.kill(sig);
  });
}
