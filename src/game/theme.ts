/**
 * Theme — the visual skin of Kitty Drop.
 *
 * Mechanics (sim.ts) never read this: a theme only repaints. Geometry, physics,
 * scoring and timings stay exactly as the original v1 game.
 */
export interface Theme {
  id: string;
  name: string;
  /** menu/HUD chip shown in the theme picker */
  emoji: string;
  /** page/view background behind the canvas */
  hostBg: string;
  /** web menu gradient mid + end stops (native menus use hostBg solid) */
  hostBgMid: string;
  hostBgEnd: string;
  cupFillTop: string;
  cupFillBottom: string;
  cupStroke: string;
  cupRim: string;
  cupShadow: string;
  /** opacity of the tiled backdrop texture (sprites/pattern.png) */
  patternAlpha: number;
  /** opacity of the floating decor sprites */
  decorAlpha: number;
  /** opacity of the fish motif on the cup */
  fishAlpha: number;
}

export const DEFAULT_THEME_ID = "sweet-berry";
