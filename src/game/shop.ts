/**
 * Shop — the cat-coin store: cosmetic skins (themes, baskets, merge trails)
 * bought with coins, and coin packs bought with real money through the
 * purchase seam in purchases.ts (simulated checkout today; RevenueCat /
 * expo-iap / Stripe plug in later without touching this catalog).
 *
 * Coins are earned two ways, exactly as designed: playing quests/missions
 * and runs, OR topping up with money.
 */
import type { SpriteId } from "./sprites";
import type { Theme } from "./theme";

export const OWNED_KEY = "kittydrop-owned";
export const EQUIP_KEY = "kittydrop-equip";

export interface CoinPack {
  id: string;
  coins: number;
  priceUsd: string;
  label: string;
}

export const COIN_PACKS: CoinPack[] = [
  { id: "pouch", coins: 500, priceUsd: "0.99", label: "Coin Pouch" },
  { id: "bag", coins: 1200, priceUsd: "1.99", label: "Coin Bag" },
  { id: "chest", coins: 3000, priceUsd: "4.99", label: "Coin Chest" },
];

export interface SkinTheme {
  theme: Theme;
  price: number;
  icon: SpriteId;
  blurb: string;
}

export const SHOP_THEMES: SkinTheme[] = [
  {
    price: 200,
    icon: "sparkle",
    blurb: "Dark arcade glow for night sessions.",
    theme: {
      id: "neon-night",
      name: "Midnight Neon",
      emoji: "",
      hostBg: "#1b1030",
      hostBgMid: "#241640",
      hostBgEnd: "#2d1b4e",
      cupFillTop: "#2a1b4a",
      cupFillBottom: "#1d1236",
      cupStroke: "#8f7bff",
      cupRim: "rgba(143, 123, 255, 0.5)",
      cupShadow: "rgba(0, 0, 0, 0.5)",
      patternAlpha: 0.2,
      decorAlpha: 0.25,
      fishAlpha: 0.3,
    },
  },
  {
    price: 150,
    icon: "heart",
    blurb: "Extra-sweet pink frosting everywhere.",
    theme: {
      id: "candy-pop",
      name: "Candy Pop",
      emoji: "",
      hostBg: "#ffe0f0",
      hostBgMid: "#ffeaf4",
      hostBgEnd: "#fff0f8",
      cupFillTop: "#ffffff",
      cupFillBottom: "#ffd9ea",
      cupStroke: "#ff6fa5",
      cupRim: "rgba(255, 111, 165, 0.5)",
      cupShadow: "rgba(200, 80, 130, 0.2)",
      patternAlpha: 0.42,
      decorAlpha: 0.2,
      fishAlpha: 0.3,
    },
  },
  {
    price: 150,
    icon: "drop",
    blurb: "Cool sea-glass pastels.",
    theme: {
      id: "ocean-dream",
      name: "Ocean Dream",
      emoji: "",
      hostBg: "#d8f0ff",
      hostBgMid: "#e6f6ff",
      hostBgEnd: "#f4fbff",
      cupFillTop: "#f2fbff",
      cupFillBottom: "#d5ecfa",
      cupStroke: "#5aa7e8",
      cupRim: "rgba(90, 167, 232, 0.5)",
      cupShadow: "rgba(70, 120, 170, 0.22)",
      patternAlpha: 0.32,
      decorAlpha: 0.18,
      fishAlpha: 0.34,
    },
  },
  {
    price: 150,
    icon: "shell",
    blurb: "Warm peach sundown vibes.",
    theme: {
      id: "sunset-peach",
      name: "Sunset Peach",
      emoji: "",
      hostBg: "#ffe8d6",
      hostBgMid: "#fff0e2",
      hostBgEnd: "#fff7ec",
      cupFillTop: "#fff7f0",
      cupFillBottom: "#ffe3cd",
      cupStroke: "#f2926b",
      cupRim: "rgba(242, 146, 107, 0.5)",
      cupShadow: "rgba(180, 100, 60, 0.22)",
      patternAlpha: 0.34,
      decorAlpha: 0.18,
      fishAlpha: 0.3,
    },
  },
];

export interface CupSkin {
  id: string;
  name: string;
  icon: SpriteId;
  price: number;
  blurb: string;
  /** paints over the theme's cup colors */
  paint: Pick<Theme, "cupFillTop" | "cupFillBottom" | "cupStroke" | "cupRim" | "cupShadow">;
}

export const CUP_SKINS: CupSkin[] = [
  {
    id: "wicker",
    name: "Wicker Basket",
    icon: "basket",
    price: 120,
    blurb: "Hand-woven picnic classic.",
    paint: {
      cupFillTop: "#e8c48f",
      cupFillBottom: "#d1a468",
      cupStroke: "#a97c4f",
      cupRim: "rgba(169, 124, 79, 0.5)",
      cupShadow: "rgba(120, 80, 40, 0.25)",
    },
  },
  {
    id: "golden",
    name: "Golden Tub",
    icon: "crown",
    price: 250,
    blurb: "For royalty-tier chonks.",
    paint: {
      cupFillTop: "#ffe9a8",
      cupFillBottom: "#f7cf6b",
      cupStroke: "#d6a929",
      cupRim: "rgba(214, 169, 41, 0.55)",
      cupShadow: "rgba(150, 110, 20, 0.25)",
    },
  },
  {
    id: "crystal",
    name: "Crystal Bowl",
    icon: "drop",
    price: 200,
    blurb: "Icy glass, extra sparkle.",
    paint: {
      cupFillTop: "#eaf6ff",
      cupFillBottom: "#cfe6ff",
      cupStroke: "#8fc7f2",
      cupRim: "rgba(143, 199, 242, 0.6)",
      cupShadow: "rgba(90, 140, 190, 0.25)",
    },
  },
];

export interface Trail {
  id: string;
  name: string;
  icon: SpriteId;
  price: number;
  blurb: string;
  sprites: SpriteId[];
}

export const TRAILS: Trail[] = [
  { id: "love", name: "Love Burst", icon: "heart", price: 100, blurb: "Merges explode in hearts.", sprites: ["heart", "heart", "sparkle"] },
  { id: "royal", name: "Royal Burst", icon: "crown", price: 150, blurb: "Crowns & stars on every merge.", sprites: ["crown", "star", "sparkle"] },
  { id: "ocean", name: "Splash Burst", icon: "fish", price: 100, blurb: "Fishy confetti splash.", sprites: ["fish", "drop", "sparkle"] },
];

export interface Equip {
  cup?: string;
  trail?: string;
}

export function findCupSkin(id?: string): CupSkin | undefined {
  return CUP_SKINS.find((c) => c.id === id);
}
export function findTrail(id?: string): Trail | undefined {
  return TRAILS.find((t) => t.id === id);
}
