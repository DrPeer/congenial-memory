/**
 * Icon — native twin of src/components/Icon.tsx: the same custom generated
 * sticker icons via RN Image (no system emoji, identical art on iOS/Android).
 */
import { Image, type ImageStyle } from "react-native";

const SRC: Record<string, number> = {
  alert: require("../../../src/assets/sprites/alert.png"),
  basket: require("../../../src/assets/sprites/basket.png"),
  clover: require("../../../src/assets/sprites/clover.png"),
  coin: require("../../../src/assets/sprites/coin.png"),
  crown: require("../../../src/assets/sprites/crown.png"),
  drop: require("../../../src/assets/sprites/drop.png"),
  flower: require("../../../src/assets/sprites/flower.png"),
  home: require("../../../src/assets/sprites/home.png"),
  lock: require("../../../src/assets/sprites/lock.png"),
  mountain: require("../../../src/assets/sprites/mountain.png"),
  party: require("../../../src/assets/sprites/party.png"),
  pause: require("../../../src/assets/sprites/pause.png"),
  pawprint: require("../../../src/assets/sprites/pawprint.png"),
  play: require("../../../src/assets/sprites/play.png"),
  sadcat: require("../../../src/assets/sprites/sadcat.png"),
  shell: require("../../../src/assets/sprites/shell.png"),
  speaker: require("../../../src/assets/sprites/speaker.png"),
  speakeroff: require("../../../src/assets/sprites/speakeroff.png"),
  target: require("../../../src/assets/sprites/target.png"),
  trophy: require("../../../src/assets/sprites/trophy.png"),
  tv: require("../../../src/assets/sprites/tv.png"),
};

export const ICON_SRC = SRC;

export default function Icon({ id, size = 18, style }: { id: string; size?: number; style?: ImageStyle }) {
  const src = SRC[id];
  if (!src) return null;
  return <Image source={src} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}
