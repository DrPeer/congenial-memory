export type Expression =
  | "happy"
  | "open"
  | "sleepy"
  | "wink"
  | "surprised"
  | "smug"
  | "love"
  | "derp"
  | "cool";

export type Accessory = "none" | "bow" | "collar" | "crown" | "flower" | "glasses" | "star" | "pirate" | "tiara";

export interface CatDef {
  name: string;
  radius: number;
  body: string;
  shade: string;
  belly: string;
  ear: string;
  outline: string;
  stripes?: string;
  patch?: string;
  expression: Expression;
  accessory: Accessory;
  points: number;
  meowPitch: number;
}

export const CATS: CatDef[] = [
  {
    name: "Bean",
    radius: 18,
    body: "#fff6f0",
    shade: "#f3dcd2",
    belly: "#ffffff",
    ear: "#ffb8c9",
    outline: "#d9a5b2",
    expression: "open",
    accessory: "none",
    points: 10,
    meowPitch: 1.55,
  },
  {
    name: "Mochi",
    radius: 25,
    body: "#ffe1a8",
    shade: "#f2c26f",
    belly: "#fff3d6",
    ear: "#ffb3c1",
    outline: "#d69f5a",
    stripes: "#e8a94d",
    expression: "happy",
    accessory: "none",
    points: 30,
    meowPitch: 1.4,
  },
  {
    name: "Pudding",
    radius: 32,
    body: "#ffb98a",
    shade: "#f2985e",
    belly: "#ffe7d1",
    ear: "#ff9fb4",
    outline: "#cf7d47",
    stripes: "#e0834a",
    expression: "wink",
    accessory: "bow",
    points: 60,
    meowPitch: 1.28,
  },
  {
    name: "Nori",
    radius: 40,
    body: "#4b4a5c",
    shade: "#37364a",
    belly: "#f7f2f4",
    ear: "#ff9fb4",
    outline: "#2c2b3a",
    expression: "smug",
    accessory: "collar",
    points: 100,
    meowPitch: 1.15,
  },
  {
    name: "Biscuit",
    radius: 49,
    body: "#f4ead9",
    shade: "#dccbb0",
    belly: "#fffaf2",
    ear: "#e9b6bd",
    outline: "#b89f7a",
    patch: "#7a5a48",
    expression: "sleepy",
    accessory: "none",
    points: 150,
    meowPitch: 1.05,
  },
  {
    name: "Luna",
    radius: 59,
    body: "#b7b9d6",
    shade: "#9597bb",
    belly: "#e6e7f5",
    ear: "#f3b1c4",
    outline: "#7a7ca1",
    expression: "love",
    accessory: "flower",
    points: 210,
    meowPitch: 0.95,
  },
  {
    name: "Tofu",
    radius: 70,
    body: "#f7f3ee",
    shade: "#e0d5cb",
    belly: "#ffffff",
    ear: "#ffb8c9",
    outline: "#bcaea0",
    patch: "#f2a663",
    expression: "derp",
    accessory: "none",
    points: 280,
    meowPitch: 0.85,
  },
  {
    name: "Cocoa",
    shade: "#6d4630",
    radius: 82,
    body: "#8f5e44",
    belly: "#e8c7a8",
    ear: "#f2a9b5",
    outline: "#5a3a28",
    stripes: "#6a4330",
    expression: "cool",
    accessory: "glasses",
    points: 360,
    meowPitch: 0.75,
  },
  {
    name: "Sakura",
    radius: 95,
    body: "#ffc3d6",
    shade: "#f59fbb",
    belly: "#ffe9f0",
    ear: "#ff8fb0",
    outline: "#d47a97",
    expression: "happy",
    accessory: "bow",
    points: 450,
    meowPitch: 0.68,
  },
  {
    name: "Nimbus",
    radius: 109,
    body: "#cfe6ff",
    shade: "#a9cdf5",
    belly: "#eef6ff",
    ear: "#ffb3c8",
    outline: "#82a9d6",
    expression: "surprised",
    accessory: "star",
    points: 550,
    meowPitch: 0.6,
  },
  {
    name: "Royal Chonk",
    radius: 125,
    body: "#ffd88a",
    shade: "#f0bb55",
    belly: "#fff1cc",
    ear: "#ffaab8",
    outline: "#c9953a",
    stripes: "#e8a540",
    expression: "smug",
    accessory: "crown",
    points: 660,
    meowPitch: 0.5,
  },
  {
    name: "Cap'n Whiskers",
    radius: 137,
    body: "#7e8ba0",
    shade: "#5f6b81",
    belly: "#dfe6ef",
    ear: "#f2a9b5",
    outline: "#48536a",
    stripes: "#55617a",
    expression: "smug",
    accessory: "pirate",
    points: 800,
    meowPitch: 0.45,
  },
  {
    name: "Queen Flufforia",
    radius: 145,
    body: "#efe4ff",
    shade: "#cdbcec",
    belly: "#faf6ff",
    ear: "#ffb3c8",
    outline: "#9d86c9",
    patch: "#c9b6ef",
    expression: "love",
    accessory: "tiara",
    points: 1000,
    meowPitch: 0.4,
  },
];

export const MAX_TIER = CATS.length - 1;
export const MEGA_MERGE_BONUS = 2000;

/** Weighted random for droppable tiers (0..4) */
export function randomDropTier(): number {
  const weights = [38, 30, 18, 10, 4];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

export const COMBO_WORDS = [
  "",
  "",
  "Nice!",
  "Purrfect!",
  "Meow-velous!",
  "Cat-tastic!",
  "Fur-ocious!",
  "PAWSOME!!",
  "LEGENDARY!!!",
];

export function comboWord(combo: number): string {
  return COMBO_WORDS[Math.min(combo, COMBO_WORDS.length - 1)];
}
