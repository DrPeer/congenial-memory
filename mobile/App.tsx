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
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getLevel } from "../src/game/levels";
import { getMode, type ModeDef } from "../src/game/sim";
import { music } from "./src/native/musicNative";
import { sfx } from "./src/native/sounds";
import Icon from "./src/native/Icon";
import { catPicture } from "./src/native/catPicture";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { EQUIP_KEY, OWNED_KEY, type Equip } from "../src/game/shop";
import { activeTheme, setActiveThemeId, setOwnedSkins } from "../src/plugins/registry";
import { hydrateMissions } from "./src/native/missionsNative";

const LEVEL_KEY = "kittydrop-level";
const LEVELS_KEY = "kittydrop-levels";
import GameScreen from "./src/native/GameScreen";
import MenuScreen from "./src/native/MenuScreen";

const BEST_KEY = "kittydrop-best"; // same key as the web build
const THEME_KEY = "kittydrop-theme";
const PROFILE_KEY = "kittydrop-profile";
const MODE_KEY = "kittydrop-mode";

export default function App() {
  useKeepAwake();
  const [screen, setScreen] = useState<"splash" | "menu" | "game">("splash");
  const [splashReady, setSplashReady] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [mode, setMode] = useState<ModeDef>(getMode(null));
  const [entered, setEntered] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const [best, setBest] = useState(0);
  const [themeId, setThemeId] = useState(activeTheme().id);
  const [levelId, setLevelId] = useState("meadow");
  const [unlocked, setUnlocked] = useState<string[]>(["meadow"]);
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [equip, setEquip] = useState<Equip>({});

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    const t = setTimeout(() => setSplashReady(true), 750);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [spin]);

  useEffect(() => {
    (async () => {
      try {
        setBest(Number((await AsyncStorage.getItem(BEST_KEY)) || 0));
        setCoins(Number((await AsyncStorage.getItem("kittydrop-coins")) || 0) || 0);
        setProfile(await AsyncStorage.getItem(PROFILE_KEY));
        setMode(getMode(await AsyncStorage.getItem(MODE_KEY)));
        music.setEnabled((await AsyncStorage.getItem("kittydrop-music")) !== "0");
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

  useEffect(() => {
    if (screen === "menu" && entered) music.setTrack("menu");
  }, [screen, entered]);

  const enterMenu = useCallback(() => {
    void sfx.unlock();
    setEntered(true);
    setScreen("menu");
    music.setTrack("menu");
  }, []);

  const pickMode = useCallback((m: ModeDef) => {
    setMode(m);
    sfx.pop(1);
    AsyncStorage.setItem(MODE_KEY, m.id).catch(() => {});
  }, []);

  const saveProfile = useCallback(() => {
    const name = loginName.trim().slice(0, 14);
    if (!name) return;
    setProfile(name);
    AsyncStorage.setItem(PROFILE_KEY, name).catch(() => {});
    setLoginOpen(false);
    enterMenu();
  }, [loginName, enterMenu]);

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
        {screen === "splash" ? (
          <SplashScreen
            ready={splashReady}
            spin={spin}
            profile={profile}
            loginOpen={loginOpen}
            loginName={loginName}
            setLoginName={setLoginName}
            setLoginOpen={setLoginOpen}
            onGuest={enterMenu}
            onSave={saveProfile}
          />
        ) : screen === "game" ? (
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
            mode={mode}
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
            profile={profile}
            mode={mode}
            onMode={pickMode}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

/* ------------------------------------------------------------------ splash */

function SplashScreen({
  ready,
  spin,
  profile,
  loginOpen,
  loginName,
  setLoginName,
  setLoginOpen,
  onGuest,
  onSave,
}: {
  ready: boolean;
  spin: Animated.Value;
  profile: string | null;
  loginOpen: boolean;
  loginName: string;
  setLoginName: (v: string) => void;
  setLoginOpen: (v: boolean) => void;
  onGuest: () => void;
  onSave: () => void;
}) {
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={sp.root}>
      <View style={sp.logoWrap}>
        <View style={sp.logoCircle}>
          <Canvas style={{ width: 110, height: 110 }}>
            <Picture picture={catPicture(6, 110)} />
          </Canvas>
        </View>
        <Text style={sp.title}>Kitty Drop</Text>
        <Text style={sp.subtitle}>Merge fluffy kitties · Make the Royal Chonk!</Text>
      </View>

      <View style={sp.entry}>
        {!ready ? (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Animated.View style={{ transform: [{ rotate: rot }] }}>
              <Icon id="pawprint" size={34} />
            </Animated.View>
            <Text style={sp.loading}>warming up the whiskers…</Text>
          </View>
        ) : loginOpen ? (
          <View style={sp.loginCard}>
            <Text style={sp.loginTitle}>YOUR NAME</Text>
            <TextInput
              autoFocus
              value={loginName}
              onChangeText={setLoginName}
              onSubmitEditing={onSave}
              maxLength={14}
              placeholder="e.g. Mochi"
              style={sp.input}
              accessibilityLabel="Player name"
            />
            <Text style={sp.loginNote}>saved on this device only — no account, no server</Text>
            <Pressable style={[sp.primary, !loginName.trim() && { opacity: 0.4 }]} onPress={onSave} disabled={!loginName.trim()}>
              <Text style={sp.primaryText}>SAVE & PLAY</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12, width: "100%" }}>
            {profile && (
              <Pressable style={sp.primary} onPress={onGuest} accessibilityRole="button">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon id="crown" size={20} />
                  <Text style={sp.primaryText}>CONTINUE, {profile.toUpperCase()}</Text>
                </View>
              </Pressable>
            )}
            <Pressable style={[sp.guest, profile && sp.guestSmall]} onPress={onGuest} accessibilityRole="button">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon id="pawprint" size={20} />
                <Text style={[sp.primaryText, profile && { color: "#a0506e" }]}>PLAY AS GUEST</Text>
              </View>
            </Pressable>
            <Pressable style={sp.secondary} onPress={() => setLoginOpen(true)} accessibilityRole="button">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon id="home" size={16} />
                <Text style={sp.secondaryText}>{profile ? "CHANGE NAME" : "LOGIN"}</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffd6e7", alignItems: "center", justifyContent: "center", gap: 32, padding: 24 },
  logoWrap: { alignItems: "center" },
  logoCircle: { backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 999, padding: 16, shadowColor: "#7a3b55", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  title: { marginTop: 14, fontSize: 52, fontWeight: "800", color: "#ff5c8a", textShadowColor: "#fff", textShadowRadius: 2, textShadowOffset: { width: 0, height: 4 } },
  subtitle: { marginTop: 8, fontSize: 13, fontWeight: "700", color: "#a0506e", textAlign: "center" },
  entry: { width: "100%", maxWidth: 320, alignItems: "center" },
  loading: { fontSize: 12, fontWeight: "800", color: "#a0506e", letterSpacing: 1 },
  loginCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 24, borderWidth: 4, borderColor: "#fff", padding: 18, alignItems: "center", shadowColor: "#7a3b55", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  loginTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 3, color: "#c46b8f", marginBottom: 10 },
  input: { width: "100%", borderRadius: 16, borderWidth: 2, borderColor: "#ffd6e7", backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 16, textAlign: "center", fontSize: 16, fontWeight: "800", color: "#7a3b55" },
  loginNote: { marginTop: 8, fontSize: 10, fontWeight: "700", color: "#b08a9c", textAlign: "center" },
  primary: { backgroundColor: "#ff5c8a", borderRadius: 999, paddingVertical: 16, alignItems: "center", borderWidth: 3, borderColor: "#fff", shadowColor: "#7a3b55", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5, width: "100%", marginTop: 12 },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  guest: { backgroundColor: "#4ec9a5", borderRadius: 999, paddingVertical: 16, alignItems: "center", borderWidth: 3, borderColor: "#fff", shadowColor: "#1d6a4c", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5, width: "100%" },
  guestSmall: { backgroundColor: "rgba(255,255,255,0.9)", paddingVertical: 12 },
  secondary: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 999, paddingVertical: 12, alignItems: "center", width: "100%" },
  secondaryText: { color: "#a0506e", fontSize: 13, fontWeight: "800" },
});
