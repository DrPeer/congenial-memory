/**
 * Sprites — custom generated sticker art shared by web + native.
 *
 * Files live in src/assets/sprites/*.png (chroma-keyed sticker sheet slices,
 * see AGENTS.md "Adding art"). The renderer asks a SpriteBank for a handle;
 * web hands out HTMLImageElements, native hands out SkImages. If a sprite is
 * not ready yet the renderer falls back to the original emoji glyphs, so the
 * game never breaks while assets load.
 */
export type SpriteId =
  | "heart"
  | "paw"
  | "sparkle"
  | "star"
  | "yarn"
  | "fish"
  | "crown"
  | "bow"
  | "cloud"
  | "pattern";

export const SPRITE_IDS: SpriteId[] = [
  "heart",
  "paw",
  "sparkle",
  "star",
  "yarn",
  "fish",
  "crown",
  "bow",
  "cloud",
  "pattern",
];

export interface SpriteBank {
  /** platform-opaque handle (HTMLImageElement | SkImage) or null if not loaded */
  get(id: SpriteId): unknown | null;
}

/** v1 particle/decor glyphs mapped onto the sticker pack (same slots, same motion) */
export const GLYPH_SPRITE: Record<string, SpriteId> = {
  "💕": "heart",
  "💖": "heart",
  "💗": "heart",
  "✨": "sparkle",
  "🐾": "paw",
  "⭐": "star",
  "👑": "crown",
  "🧶": "yarn",
  "🐟": "fish",
  "☁️": "cloud",
};

/** the v1 floating-decor slot list, expressed as sprites */
export const DECOR_SPRITES: SpriteId[] = ["paw", "heart", "paw", "yarn", "paw", "heart", "fish", "paw"];
