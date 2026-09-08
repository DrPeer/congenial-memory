#!/usr/bin/env node
/**
 * build-game-bundle.mjs
 * ---------------------
 * Core plumbing between the web game and the Expo (iOS / Android) shell.
 *
 *   1. builds the existing Vite game exactly as-is (`vite build` -> dist/index.html,
 *      which vite-plugin-singlefile already inlines into ONE self-contained html file)
 *   2. injects a tiny "native bridge" shim into that html (persistent storage +
 *      a ready ping) WITHOUT touching a single line of game code
 *   3. writes the result as a TS module the Expo app can import:
 *      mobile/src/gameHtml.ts
 *
 * The game sources in /src stay untouched - this script only reads build output.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DIST_HTML = path.join(ROOT, "dist", "index.html");
const OUT_DIR = path.join(ROOT, "mobile", "src");
const OUT_FILE = path.join(OUT_DIR, "gameHtml.ts");

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const quiet = args.has("--quiet");

const log = (...m) => !quiet && console.log(...m);

/** Token replaced at runtime by the Expo shell with the device's saved storage. */
const STORAGE_TOKEN = "%%KITTY_STORAGE%%";

/**
 * Injected immediately after <head>, i.e. before any game script runs.
 * Gives the sandboxed WebView a localStorage that persists through the shell
 * (AsyncStorage), so the "best score" survives app restarts on iOS + Android.
 */
const NATIVE_BRIDGE = `<script id="kitty-native-bridge">
(function () {
  var SEED = "${STORAGE_TOKEN}";
  var store = {};
  try {
    if (SEED.indexOf("%%") !== 0) store = JSON.parse(decodeURIComponent(SEED)) || {};
  } catch (e) {
    store = {};
  }

  function post(type, payload) {
    try {
      var rn = window.ReactNativeWebView;
      if (rn && typeof rn.postMessage === "function") {
        rn.postMessage(JSON.stringify({ type: type, payload: payload }));
      }
    } catch (e) {
      /* running in a plain browser - nothing to bridge to */
    }
  }

  var timer = null;
  function flush() {
    if (timer !== null) return;
    timer = setTimeout(function () {
      timer = null;
      post("kitty:storage", store);
    }, 150);
  }

  var bridge = {
    getItem: function (k) {
      k = String(k);
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem: function (k, v) {
      store[String(k)] = String(v);
      flush();
    },
    removeItem: function (k) {
      delete store[String(k)];
      flush();
    },
    clear: function () {
      store = {};
      flush();
    },
    key: function (i) {
      var ks = Object.keys(store);
      return i >= 0 && i < ks.length ? ks[i] : null;
    },
    get length() {
      return Object.keys(store).length;
    }
  };

  try {
    Object.defineProperty(window, "localStorage", { value: bridge, writable: true, configurable: true });
  } catch (e) {
    try {
      window.localStorage = bridge;
    } catch (e2) {
      /* give up quietly - the game already guards every storage access */
    }
  }

  window.addEventListener("pagehide", function () {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      post("kitty:storage", store);
    }
  });

  if (document.readyState === "complete") post("kitty:ready", true);
  else window.addEventListener("load", function () { post("kitty:ready", true); });
})();
</script>`;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------------ 1. build */
if (!skipBuild) {
  log("→ building web game (vite build)…");
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const cmd = existsSync(viteBin)
    ? { file: process.execPath, args: [viteBin, "build"] }
    : { file: process.platform === "win32" ? "npm.cmd" : "npm", args: ["run", "build"] };

  const res = spawnSync(cmd.file, cmd.args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (res.error) fail(`could not run the web build: ${res.error.message}`);
  if (res.status !== 0) fail("vite build failed - fix the web build first");
}

if (!existsSync(DIST_HTML)) {
  fail(`expected ${path.relative(ROOT, DIST_HTML)} to exist. Run without --skip-build.`);
}

/* ------------------------------------------------------- 2. read + sanity-check */
let html = readFileSync(DIST_HTML, "utf8");

// vite-plugin-singlefile must have inlined everything, otherwise the WebView
// would need to load sibling files from a server.
const externalLocal = [
  ...html.matchAll(/<script[^>]+src=["'](?!https?:|data:)([^"']+)["']/gi),
  ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?!https?:|data:)([^"']+)["']/gi),
].map((m) => m[1]);
if (externalLocal.length) {
  fail(
    `dist/index.html still references local files (${externalLocal.join(", ")}).\n` +
      `  The Expo shell needs ONE self-contained html file - keep vite-plugin-singlefile enabled.`,
  );
}

const injected = html.replace(/<head([^>]*)>/i, (m) => `${m}\n${NATIVE_BRIDGE}`);
if (injected === html) fail("could not find <head> in dist/index.html to inject the native bridge");
html = injected;

const kb = (statSync(DIST_HTML).size / 1024).toFixed(1);

/* ------------------------------------------------------------- 3. write module */
mkdirSync(OUT_DIR, { recursive: true });

// escape for a JS template literal
const escaped = html.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const out = `/* eslint-disable */
/**
 * AUTO-GENERATED - DO NOT EDIT.
 *
 * The complete Kitty Drop web game as ONE self-contained html document
 * (html + css + js inlined by vite-plugin-singlefile), plus the native bridge
 * shim injected by scripts/build-game-bundle.mjs.
 *
 * Regenerate with:  npm run mobile:bundle   (from the repo root)
 * Built from:       dist/index.html (${kb} kB on disk)
 */
export const GAME_HTML = \`${escaped}\`;

/** Token the shell replaces with the device's saved storage before loading. */
export const STORAGE_TOKEN = "${STORAGE_TOKEN}";
`;

writeFileSync(OUT_FILE, out, "utf8");

log(
  `✔ mobile game bundle written → ${path.relative(ROOT, OUT_FILE)} ` +
    `(${(Buffer.byteLength(out) / 1024).toFixed(1)} kB, source ${kb} kB)`,
);
