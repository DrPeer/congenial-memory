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

import GameScreen from "./src/native/GameScreen";
import MenuScreen from "./src/native/MenuScreen";

const BEST_KEY = "kittydrop-best"; // same key as the web build

export default function App() {
  useKeepAwake();
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [best, setBest] = useState(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setBest(Number((await AsyncStorage.getItem(BEST_KEY)) || 0));
      } catch {
        /* first launch */
      }
    })();
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
          <GameScreen best={best} onBest={onBest} onExit={() => setScreen("menu")} />
        ) : (
          <MenuScreen best={best} onPlay={() => setScreen("game")} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
