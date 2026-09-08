/**
 * Cat pictures: records the SHARED drawCat() renderer into Skia Pictures once
 * per (tier, size) so HUD thumbnails / evolution strip / menu hero cost nothing
 * per frame. The in-game cats are drawn live through SkiaCtx2D instead.
 */
import { Skia, type SkPicture } from "@shopify/react-native-skia";

import { CATS } from "../../../src/game/cats";
import { drawCat } from "../../../src/game/drawCat";
import { SkiaCtx2D } from "./skiaCtx";

const cache = new Map<string, SkPicture>();

export function catPicture(tier: number, size: number, dim = false): SkPicture {
  const key = `${tier}:${size}:${dim ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const px = Math.max(8, Math.round(size));
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording({ x: 0, y: 0, width: px, height: px });
  const ctx = new SkiaCtx2D(canvas);
  if (dim) ctx.globalAlpha = 0.35;
  drawCat(ctx, px / 2, px / 2 + px * 0.04, px * 0.36, CATS[tier]);
  const picture = recorder.finishRecordingAsPicture();
  cache.set(key, picture);
  return picture;
}
