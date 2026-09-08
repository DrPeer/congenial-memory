// Metro config for the monorepo layout: the native app imports the SHARED game
// core straight from ../src/game (sim.ts, render.ts, drawCat.ts, cats.ts) so the
// web and native builds can never drift apart.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, "..")];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "..", "node_modules"),
];

// don't crawl the web project's node_modules (vite & friends are irrelevant here)
const rootNodeModules = path.resolve(__dirname, "..", "node_modules") + path.sep;
const rootSrc = rootNodeModules.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*";
const existing = config.resolver.blockList;
const parts = (Array.isArray(existing) ? existing : existing ? [existing] : []).map((r) => `(${r.source})`);
parts.push(`(${rootSrc})`);
config.resolver.blockList = new RegExp(parts.join("|"));

module.exports = config;
