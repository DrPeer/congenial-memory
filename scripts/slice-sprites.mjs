#!/usr/bin/env node
/**
 * slice-sprites.mjs — turn a generated sticker SHEET into game sprites.
 *
 *   node scripts/slice-sprites.mjs --sheet mobile/assets/_sheet-source.png \
 *        --names heart,paw,sparkle,star,yarn,fish,crown,bow,cloud [--cols 3] [--size 128]
 *
 * Convention (see AGENTS.md "Adding art"): generate the sheet on a PURE MAGENTA
 * #FF00FF background in an even grid; this script chroma-keys magenta to alpha,
 * trims each cell to its sticker and writes src/assets/sprites/<name>.png.
 * Requires `sharp` (dev-only, not a game dependency):  npm i -D sharp  (or npx).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const get = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};
const sheet = get("--sheet", "");
const names = String(get("--names", "")).split(",").map((s) => s.trim()).filter(Boolean);
const cols = Number(get("--cols", 3));
const size = Number(get("--size", 128));
if (!sheet || !names.length || !existsSync(sheet)) {
  console.error("usage: node scripts/slice-sprites.mjs --sheet <png> --names a,b,c [--cols 3] [--size 128]");
  process.exit(1);
}

const ensureSharp = () => {
  try {
    return require("sharp");
  } catch {
    console.log("• installing sharp (dev-only)…");
    spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["i", "-D", "--no-audit", "--no-fund", "sharp"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    return require("sharp");
  }
};
const require = (await import("node:module")).createRequire(import.meta.url);
const sharp = ensureSharp();

const MAG = [255, 0, 255];
const meta = await sharp(sheet).metadata();
const cw = Math.floor(meta.width / cols);
const ch = Math.floor(meta.height / Math.ceil(names.length / cols));

for (let i = 0; i < names.length; i++) {
  const left = (i % cols) * cw;
  const top = Math.floor(i / cols) * ch;
  const { data, info } = await sharp(sheet)
    .extract({ left, top, width: cw, height: ch })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let p = 0; p < info.width * info.height; p++) {
    const o = p * info.channels;
    const q = p * 4;
    const d = Math.sqrt((data[o] - MAG[0]) ** 2 + (data[o + 1] - MAG[1]) ** 2 + (data[o + 2] - MAG[2]) ** 2);
    const alpha = d <= 40 ? 0 : d >= 110 ? 255 : Math.round(((d - 40) / 70) * 255);
    out[q] = data[o]; out[q + 1] = data[o + 1]; out[q + 2] = data[o + 2]; out[q + 3] = alpha;
    if (alpha > 8) {
      const x = p % info.width;
      const y = (p / info.width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const m = 4;
  minX = Math.max(0, minX - m); minY = Math.max(0, minY - m);
  maxX = Math.min(info.width - 1, maxX + m); maxY = Math.min(info.height - 1, maxY + m);
  const file = path.join(ROOT, "src", "assets", "sprites", `${names[i]}.png`);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
  console.log("✔", path.relative(ROOT, file));
}
