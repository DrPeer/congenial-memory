/**
 * Plugin registry — single place where plugins are registered and where the
 * hosts (web engine / native app) ask for the active theme.
 *
 * AI agents: to add a feature skin, drop a folder in src/plugins/ and add ONE
 * import + array entry below. Nothing else in the repo needs to change.
 */
import { SHOP_THEMES } from "../game/shop";
import { DEFAULT_THEME_ID, type Theme } from "../game/theme";
import { mintyMilk } from "./minty-milk";
import { sweetBerry } from "./sweet-berry";
import type { GamePlugin } from "./types";

export const plugins: GamePlugin[] = [sweetBerry, mintyMilk];

let activeThemeId: string = DEFAULT_THEME_ID;
/** ids of shop skins the player owns (host persists + sets at boot) */
let ownedSkins: string[] = [];

export function setOwnedSkins(ids: string[]) {
  ownedSkins = ids;
}

export function getThemes(): Theme[] {
  const pluginThemes = plugins.map((p) => p.theme).filter((t): t is Theme => Boolean(t));
  const shopThemes = SHOP_THEMES.filter((st) => ownedSkins.includes(st.theme.id)).map((st) => st.theme);
  return [...pluginThemes, ...shopThemes];
}

export function getTheme(id: string): Theme | undefined {
  return getThemes().find((t) => t.id === id);
}

export function setActiveThemeId(id: string) {
  if (getTheme(id)) activeThemeId = id;
}

export function activeTheme(): Theme {
  return getTheme(activeThemeId) ?? getTheme(DEFAULT_THEME_ID)!;
}

export type { GamePlugin };
