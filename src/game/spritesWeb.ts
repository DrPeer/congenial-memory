/**
 * Web SpriteBank: the shared sticker pack as HTMLImageElements.
 * Images start loading at module import; renderScene falls back to emoji
 * glyphs until each one is decoded, so first paint is never blocked.
 */
import bow from "../assets/sprites/bow.png";
import cloud from "../assets/sprites/cloud.png";
import crown from "../assets/sprites/crown.png";
import fish from "../assets/sprites/fish.png";
import heart from "../assets/sprites/heart.png";
import pattern from "../assets/sprites/pattern.png";
import paw from "../assets/sprites/paw.png";
import sparkle from "../assets/sprites/sparkle.png";
import star from "../assets/sprites/star.png";
import yarn from "../assets/sprites/yarn.png";
import { SPRITE_IDS, type SpriteBank, type SpriteId } from "./sprites";

const URLS: Record<SpriteId, string> = {
  heart,
  paw,
  sparkle,
  star,
  yarn,
  fish,
  crown,
  bow,
  cloud,
  pattern,
};

class WebSpriteBank implements SpriteBank {
  private imgs = new Map<SpriteId, HTMLImageElement>();

  constructor() {
    for (const id of SPRITE_IDS) {
      const img = new Image();
      img.src = URLS[id];
      this.imgs.set(id, img);
    }
  }

  get(id: SpriteId): unknown | null {
    const img = this.imgs.get(id);
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }
}

export const webSprites: SpriteBank = new WebSpriteBank();
