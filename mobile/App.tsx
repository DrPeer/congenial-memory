/**
 * Kitty Drop — native Expo app (iOS + Android).
 *
 * No WebView: the game is React Native all the way down.
 *   • rules + physics : src/game/sim.ts   (shared with the web build)
 *   • rendering       : src/game/render.ts painted through Skia (SkiaCtx2D)
 *   • juice           : expo-haptics + expo-audio (WAV renditions of the web synth)
 *   • updates         : EAS Update (JS-only changes ship without store review)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getLevel } from "../src/game/levels";
import { activeTheme, setActiveThemeId } from "../src/plugins/registry";
import { hydrateMissions } from "./src/native/missionsNative";

const LEVEL_KEY = "kittydrop-level";
const LEVELS_KEY = "kittydrop-levels";
import GameScreen from "./src/native/GameScreen";
import MenuScreen from "./src/native/MenuScreen";

const BEST_KEY = "kittydrop-best"; // same key as the web build
const THEME_KEY = "kittydrop-theme";

export default function App() {
  useKeepAwake();
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [best, setBest] = useState(0);
  const [themeId, setThemeId] = useState(activeTheme().id);
  const [levelId, setLevelId] = useState("meadow");
  const [unlocked, setUnlocked] = useState<string[]>(["meadow"]);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setBest(Number((await AsyncStorage.getItem(BEST_KEY)) || 0));
        const savedLevel = await AsyncStorage.getItem(LEVEL_KEY);
        if (savedLevel) setLevelId(savedLevel);
        const savedLevels = await AsyncStorage.getItem(LEVELS_KEY);
        if (savedLevels) setUnlocked(JSON.parse(savedLevels) as string[]);
        void hydrateMissions();
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        if (savedTheme) {
          setActiveThemeId(savedTheme);
          setThemeId(savedTheme);
        }
      } catch {
        /* first launch */
      }
    })();
  }, []);

  const onSelectLevel = useCallback((id: string) => {
    setLevelId(id);
    AsyncStorage.setItem(LEVEL_KEY, id).catch(() => {});
    setUnlocked((u) => {
      if (u.includes(id)) return u;
      const next = [...u, id];
      AsyncStorage.setItem(LEVELS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const onTheme = useCallback((id: string) => {
    setActiveThemeId(id);
    setThemeId(id);
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
  }, []);

  const onBest = useCallback((b: number) => {
    setBest(b);
    AsyncStorage.setItem(BEST_KEY, String(b)).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: "#ffd6e7" }}>
        {screen === "game" ? (
          <GameScreen
            best={best}
            onBest={onBest}
            onExit={() => setScreen("menu")}
            level={getLevel(levelId)}
            onSelectLevel={onSelectLevel}
          />
        ) : (
          <MenuScreen
            best={best}
            themeId={themeId}
            onTheme={onTheme}
            levelId={levelId}
            unlocked={unlocked}
            onSelectLevel={onSelectLevel}
            onPlay={() => setScreen("game")}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
