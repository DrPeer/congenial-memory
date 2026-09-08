/**
 * Native SpriteBank: the SAME sticker pack (src/assets/sprites) decoded into
 * SkImages via expo-asset. warm() is fire-and-forget at game start; until a
 * sprite is decoded, renderScene falls back to emoji glyphs.
 */
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";

import { SPRITE_IDS, type SpriteBank, type SpriteId } from "../../../src/game/sprites";

const MODULES: Record<SpriteId, number> = {
  heart: require("../../../src/assets/sprites/heart.png"),
  paw: require("../../../src/assets/sprites/paw.png"),
  sparkle: require("../../../src/assets/sprites/sparkle.png"),
  star: require("../../../src/assets/sprites/star.png"),
  yarn: require("../../../src/assets/sprites/yarn.png"),
  fish: require("../../../src/assets/sprites/fish.png"),
  crown: require("../../../src/assets/sprites/crown.png"),
  bow: require("../../../src/assets/sprites/bow.png"),
  cloud: require("../../../src/assets/sprites/cloud.png"),
  pattern: require("../../../src/assets/sprites/pattern.png"),
  coin: require("../../../src/assets/sprites/coin.png"),
  target: require("../../../src/assets/sprites/target.png"),
  basket: require("../../../src/assets/sprites/basket.png"),
  tv: require("../../../src/assets/sprites/tv.png"),
  pawprint: require("../../../src/assets/sprites/pawprint.png"),
  speaker: require("../../../src/assets/sprites/speaker.png"),
  speakeroff: require("../../../src/assets/sprites/speakeroff.png"),
  pause: require("../../../src/assets/sprites/pause.png"),
  play: require("../../../src/assets/sprites/play.png"),
  home: require("../../../src/assets/sprites/home.png"),
  lock: require("../../../src/assets/sprites/lock.png"),
  trophy: require("../../../src/assets/sprites/trophy.png"),
  sadcat: require("../../../src/assets/sprites/sadcat.png"),
  party: require("../../../src/assets/sprites/party.png"),
  alert: require("../../../src/assets/sprites/alert.png"),
  flower: require("../../../src/assets/sprites/flower.png"),
  shell: require("../../../src/assets/sprites/shell.png"),
  mountain: require("../../../src/assets/sprites/mountain.png"),
  clover: require("../../../src/assets/sprites/clover.png"),
  drop: require("../../../src/assets/sprites/drop.png"),
};

class NativeSpriteBank implements SpriteBank {
  private imgs = new Map<SpriteId, SkImage>();
  private warming: Promise<void> | null = null;

  warm(): Promise<void> {
    if (!this.warming) {
      this.warming = Promise.all(
        SPRITE_IDS.map(async (id) => {
          try {
            const [asset] = await Asset.loadAsync(MODULES[id]);
            const res = await fetch(asset.uri);
            const buf = await res.arrayBuffer();
            const data = Skia.Data.fromBytes(new Uint8Array(buf));
            const img = Skia.Image.MakeImageFromEncoded(data);
            if (img) this.imgs.set(id, img);
          } catch {
            /* fall back to emoji glyphs for this sprite */
          }
        }),
      ).then(() => undefined);
    }
    return this.warming;
  }

  get(id: SpriteId): unknown | null {
    return this.imgs.get(id) ?? null;
  }
}

export const nativeSprites = new NativeSpriteBank();
