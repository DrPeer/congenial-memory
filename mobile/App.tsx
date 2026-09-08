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
import { EQUIP_KEY, OWNED_KEY, type Equip } from "../src/game/shop";
import { activeTheme, setActiveThemeId, setOwnedSkins } from "../src/plugins/registry";
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
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [equip, setEquip] = useState<Equip>({});

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setBest(Number((await AsyncStorage.getItem(BEST_KEY)) || 0));
        setCoins(Number((await AsyncStorage.getItem("kittydrop-coins")) || 0) || 0);
        const savedOwned = await AsyncStorage.getItem(OWNED_KEY);
        const ownedIds = savedOwned ? (JSON.parse(savedOwned) as string[]) : [];
        setOwned(ownedIds);
        setOwnedSkins(ownedIds); // before theme restore so shop themes validate
        const savedEquip = await AsyncStorage.getItem(EQUIP_KEY);
        if (savedEquip) setEquip(JSON.parse(savedEquip) as Equip);
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

  const writeCoins = useCallback((v: number) => {
    setCoins(v);
    AsyncStorage.setItem("kittydrop-coins", String(v)).catch(() => {});
  }, []);
  const spendCoins = useCallback(
    (n: number) => {
      if (coins < n) return false;
      writeCoins(coins - n);
      return true;
    },
    [coins, writeCoins],
  );
  const grantCoins = useCallback(
    (n: number) => {
      writeCoins(coins + n);
    },
    [coins, writeCoins],
  );
  const updateOwned = useCallback((ids: string[]) => {
    setOwned(ids);
    setOwnedSkins(ids);
    AsyncStorage.setItem(OWNED_KEY, JSON.stringify(ids)).catch(() => {});
  }, []);
  const updateEquip = useCallback((e: Equip) => {
    setEquip(e);
    AsyncStorage.setItem(EQUIP_KEY, JSON.stringify(e)).catch(() => {});
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
            onExit={() => {
              setScreen("menu");
              // GameScreen owns the wallet while playing — re-sync on return
              AsyncStorage.getItem("kittydrop-coins")
                .then((v) => setCoins(Number(v || 0) || 0))
                .catch(() => {});
            }}
            level={getLevel(levelId)}
            onSelectLevel={onSelectLevel}
            equip={equip}
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
            coins={coins}
            spend={spendCoins}
            grant={grantCoins}
            owned={owned}
            setOwned={updateOwned}
            equip={equip}
            setEquip={updateEquip}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
