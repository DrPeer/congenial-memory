/**
 * Sweet Berry — the default candy-pink skin: sticker-pack sprites, soft
 * backdrop texture, cream-and-rose basket. Same game, sweeter wrapper.
 */
import type { Theme } from "../../game/theme";
import type { GamePlugin } from "../types";

export const sweetBerryTheme: Theme = {
  id: "sweet-berry",
  name: "Sweet Berry",
  emoji: "🍓",
  hostBg: "#ffd6e7",
  hostBgMid: "#ffe3ee",
  hostBgEnd: "#fff3d6",
  cupFillTop: "#fff6fa",
  cupFillBottom: "#ffdfed",
  cupStroke: "#f79ec0",
  cupRim: "rgba(247, 158, 192, 0.5)",
  cupShadow: "rgba(190, 95, 130, 0.2)",
  patternAlpha: 0.4,
  decorAlpha: 0.16,
  fishAlpha: 0.28,
};

export const sweetBerry: GamePlugin = {
  id: "sweet-berry",
  description: "Default candy skin: sticker sprites + pastel backdrop texture.",
  theme: sweetBerryTheme,
};
