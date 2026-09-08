/**
 * Levels — progression worlds. Level 1 is the classic meadow; winning it unlocks
 * two themed worlds with their own obstacles & harder win conditions.
 *
 * A level bundles: cosmetics (Theme), physics modifiers (cup inset, obstacles)
 * and the win tier. Everything lives in the shared core, so web + native play
 * identical levels.
 */
import { sweetBerryTheme } from "../plugins/sweet-berry";
import type { Theme } from "./theme";

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  kind: "reef" | "boulder";
}

/** environment flavour drawn behind the jar (render.ts) */
export type LevelEnv = "meadow" | "shore" | "hills";

/**
 * Per-level cat reskin: the same 13 kitties, repainted & restyled so each map
 * feels like a different cast (sea kitties on the shore, forest kitties in the
 * hills). Shared core → identical on web + native.
 */
export interface CatLook {
  /** body/shade pairs, cycled by tier */
  palette: { body: string; shade: string }[];
  pattern: "none" | "stripes" | "spots";
  accessory: "none" | "shell" | "clover";
  ears: "normal" | "fin" | "tuft";
}

export interface LevelDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  env: LevelEnv;
  /** repaint + restyle the whole cat cast on this map */
  catLook?: CatLook;
  theme: Theme;
  /** static physics blobs sitting inside the cup */
  obstacles: Obstacle[];
  /** cup walls move inward by this many px (harder stacking) */
  cupInset: number;
  /** creating this tier completes the level */
  winTier: number;
  /** losing here: retrying costs an ad watch (level 1 retries are free) */
  retryNeedsAd: boolean;
}

const sunnyShore: Theme = {
  id: "sunny-shore",
  name: "Sunny Shore",
  emoji: "🏖️",
  hostBg: "#cdeffd",
  hostBgMid: "#dff6ff",
  hostBgEnd: "#fff3d0",
  cupFillTop: "#fffbef",
  cupFillBottom: "#ffe9c4",
  cupStroke: "#f2b267",
  cupRim: "rgba(242, 178, 103, 0.5)",
  cupShadow: "rgba(160, 120, 60, 0.22)",
  patternAlpha: 0.3,
  decorAlpha: 0.18,
  fishAlpha: 0.32,
};

const cloverHills: Theme = {
  id: "clover-hills",
  name: "Clover Hills",
  emoji: "⛰️",
  hostBg: "#d9f2d0",
  hostBgMid: "#e7f7df",
  hostBgEnd: "#fff8dc",
  cupFillTop: "#fbfff7",
  cupFillBottom: "#e2f4d6",
  cupStroke: "#7cb86a",
  cupRim: "rgba(124, 184, 106, 0.5)",
  cupShadow: "rgba(70, 120, 55, 0.22)",
  patternAlpha: 0.28,
  decorAlpha: 0.18,
  fishAlpha: 0.24,
};

export const LEVELS: LevelDef[] = [
  {
    id: "meadow",
    name: "Sweet Meadow",
    emoji: "",
    env: "meadow",
    desc: "The classic basket. Raise a Sakura to win!",
    theme: sweetBerryTheme,
    obstacles: [],
    cupInset: 0,
    winTier: 8,
    retryNeedsAd: false,
  },
  {
    id: "beach",
    name: "Sunny Shore",
    emoji: "",
    env: "shore",
    desc: "Reef rocks eat basket space. Raise a Nimbus to win!",
    catLook: {
      palette: [
        { body: "#8fe0d8", shade: "#54b3ab" }, // lagoon
        { body: "#ffa184", shade: "#e07a5f" }, // coral
        { body: "#ffe3b8", shade: "#e0b678" }, // sand
        { body: "#b8ecdc", shade: "#7cc9b4" }, // seafoam
        { body: "#cfe6ff", shade: "#93b8e0" }, // tide blue
        { body: "#f7ecff", shade: "#c9aee6" }, // pearl lilac
      ],
      pattern: "stripes",
      accessory: "shell",
      ears: "fin",
    },
    theme: sunnyShore,
    obstacles: [
      { x: 140, y: 470, r: 34, kind: "reef" },
      { x: 262, y: 545, r: 27, kind: "reef" },
    ],
    cupInset: 0,
    winTier: 9,
    retryNeedsAd: true,
  },
  {
    id: "hills",
    name: "Clover Hills",
    emoji: "",
    env: "hills",
    desc: "Narrow basket + boulders. Raise a Royal Chonk to win!",
    catLook: {
      palette: [
        { body: "#a8d48e", shade: "#74a85c" }, // moss
        { body: "#c9a27e", shade: "#9c744e" }, // bark
        { body: "#e9f4d2", shade: "#b9d494" }, // fern cream
        { body: "#8fb89a", shade: "#5f8a6c" }, // pine
        { body: "#f0e6c8", shade: "#c8b78c" }, // wheat
        { body: "#d8c3a5", shade: "#a8906e" }, // fawn
      ],
      pattern: "spots",
      accessory: "clover",
      ears: "tuft",
    },
    theme: cloverHills,
    obstacles: [
      { x: 120, y: 500, r: 30, kind: "boulder" },
      { x: 205, y: 430, r: 24, kind: "boulder" },
      { x: 278, y: 540, r: 32, kind: "boulder" },
    ],
    cupInset: 16,
    winTier: 10,
    retryNeedsAd: true,
  },
];

export function getLevel(id: string): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** resolved repaint for one kitty on a level (undefined = classic look) */
export interface ResolvedLook {
  body: string;
  shade: string;
  pattern: "none" | "stripes" | "spots";
  accessory: "none" | "shell" | "clover";
  ears: "normal" | "fin" | "tuft";
}

export function catLookFor(level: LevelDef, tier: number): ResolvedLook | undefined {
  const look = level.catLook;
  if (!look) return undefined;
  const p = look.palette[tier % look.palette.length];
  return { body: p.body, shade: p.shade, pattern: look.pattern, accessory: look.accessory, ears: look.ears };
}
