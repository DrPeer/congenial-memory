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
import coin from "../assets/sprites/coin.png";
import target from "../assets/sprites/target.png";
import basket from "../assets/sprites/basket.png";
import tv from "../assets/sprites/tv.png";
import pawprint from "../assets/sprites/pawprint.png";
import speaker from "../assets/sprites/speaker.png";
import speakeroff from "../assets/sprites/speakeroff.png";
import pause from "../assets/sprites/pause.png";
import play from "../assets/sprites/play.png";
import home from "../assets/sprites/home.png";
import lock from "../assets/sprites/lock.png";
import trophy from "../assets/sprites/trophy.png";
import sadcat from "../assets/sprites/sadcat.png";
import party from "../assets/sprites/party.png";
import alert from "../assets/sprites/alert.png";
import flower from "../assets/sprites/flower.png";
import shell from "../assets/sprites/shell.png";
import mountain from "../assets/sprites/mountain.png";
import clover from "../assets/sprites/clover.png";
import drop from "../assets/sprites/drop.png";

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
  coin,
  target,
  basket,
  tv,
  pawprint,
  speaker,
  speakeroff,
  pause,
  play,
  home,
  lock,
  trophy,
  sadcat,
  party,
  alert,
  flower,
  shell,
  mountain,
  clover,
  drop,
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
