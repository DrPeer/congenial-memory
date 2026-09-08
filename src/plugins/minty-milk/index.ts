/**
 * Minty Milk — example second plugin: a fresh pastel-mint skin. Light-on-light,
 * so every hardcoded UI tint stays readable. Copy this folder (or run
 * `npm run plugin:new -- --id my-theme`) to add your own.
 */
import type { Theme } from "../../game/theme";
import type { GamePlugin } from "../types";

export const mintyMilkTheme: Theme = {
  id: "minty-milk",
  name: "Minty Milk",
  emoji: "🌿",
  hostBg: "#e2f6ec",
  hostBgMid: "#eefaf3",
  hostBgEnd: "#fffbe8",
  cupFillTop: "#fbfffd",
  cupFillBottom: "#e0f7ec",
  cupStroke: "#7fd0b4",
  cupRim: "rgba(127, 208, 180, 0.5)",
  cupShadow: "rgba(70, 140, 110, 0.2)",
  patternAlpha: 0.3,
  decorAlpha: 0.18,
  fishAlpha: 0.26,
};

export const mintyMilk: GamePlugin = {
  id: "minty-milk",
  description: "Pastel-mint alt skin: same game, fresher wrapper.",
  theme: mintyMilkTheme,
};
