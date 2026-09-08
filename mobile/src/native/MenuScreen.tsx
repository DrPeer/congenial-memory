/**
 * MenuScreen — native port of the web menu (same copy, same palette).
 */
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATS } from "../../../src/game/cats";
import { LEVELS } from "../../../src/game/levels";
import { LEVEL_ICON } from "../../../src/game/sprites";
import { missionStore } from "./missionsNative";
import type { Equip } from "../../../src/game/shop";
import { MODE_LIST, type ModeDef } from "../../../src/game/sim";
import { music } from "./musicNative";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ShopModal from "./ShopModal";
import { activeTheme, getThemes } from "../../../src/plugins/registry";
import { catPicture } from "./catPicture";
import Icon, { ICON_SRC } from "./Icon";
import { sfx } from "./sounds";

interface Props {
  best: number;
  themeId: string;
  onTheme: (id: string) => void;
  levelId: string;
  unlocked: string[];
  onSelectLevel: (id: string) => void;
  onPlay: () => void;
  coins: number;
  spend: (n: number) => boolean;
  grant: (n: number) => void;
  owned: string[];
  setOwned: (ids: string[]) => void;
  equip: Equip;
  setEquip: (e: Equip) => void;
  profile: string | null;
  mode: ModeDef;
  onMode: (m: ModeDef) => void;
}

const DECO = ["pawprint", "yarn", "heart", "fish", "pawprint", "sparkle", "pawprint", "heart"];

export default function MenuScreen({ best, themeId, onTheme, levelId, unlocked, onSelectLevel, onPlay, coins, spend, grant, owned, setOwned, equip, setEquip, profile, mode, onMode }: Props) {
  const insets = useSafeAreaInsets();
  const [heroTier, setHeroTier] = useState(6);
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => setHeroTier((h) => (h + 1) % CATS.length), 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const [shopOpen, setShopOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem("kittydrop-music")
      .then((v) => setMusicOn(v !== "0"))
      .catch(() => {});
  }, []);
  const toggleMusic = () => {
    setMusicOn((on) => {
      const v = !on;
      AsyncStorage.setItem("kittydrop-music", v ? "1" : "0").catch(() => {});
      music.setEnabled(v);
      if (v) music.setTrack("menu");
      return v;
    });
  };

  const theme = activeTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.hostBg },
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 20),
          paddingLeft: insets.left + 24,
          paddingRight: insets.right + 24,
        },
      ]}
    >
      {/* floating deco */}
      <View pointerEvents="none" style={styles.deco}>
        {DECO.map((g, i) => (
          <Animated.Image
            key={i}
            source={ICON_SRC[g] ?? ICON_SRC.pawprint}
            style={[
              styles.decoGlyph,
              {
                left: `${(i * 13 + 5) % 90}%`,
                top: `${(i * 23 + 8) % 90}%`,
                transform: [{ translateY: float }],
              },
            ]}
            resizeMode="contain"
          />
        ))}
      </View>

      <View style={styles.titleWrap}>
        <Canvas style={{ width: 64, height: 64 }}>
          <Picture picture={catPicture(2, 64)} />
        </Canvas>
        <Text style={styles.title}>Kitty Drop</Text>
        <Text style={styles.tagline}>Merge fluffy kitties · Make the Royal Chonk!</Text>
      </View>

      <View style={styles.heroWrap}>
        <View style={styles.heroBubble}>
          <Canvas style={{ width: 190, height: 190 }}>
            <Picture picture={catPicture(heroTier, 190)} />
          </Canvas>
        </View>
        <View style={styles.heroChip}>
          <Text style={styles.heroChipText}>
            {CATS[heroTier].name} · +{CATS[heroTier].points} pts
          </Text>
        </View>
      </View>

      <View style={styles.howto}>
        <Text style={styles.howtoTitle}>HOW TO PLAY</Text>
        <View style={styles.howtoLineRow}>
          <Icon id="pawprint" size={16} />
          <Text style={styles.howtoLine}>Drag to aim, release to drop a kitty</Text>
        </View>
        <View style={styles.howtoLineRow}>
          <Icon id="heart" size={16} />
          <Text style={styles.howtoLine}>Two matching kitties merge into a bigger one</Text>
        </View>
        <View style={styles.howtoLineRow}>
          <Icon id="sparkle" size={16} />
          <Text style={styles.howtoLine}>Quick chain merges = combo multipliers</Text>
        </View>
        <View style={styles.howtoLineRow}>
          <Icon id="alert" size={16} />
          <Text style={styles.howtoLine}>Don't let the basket overflow!</Text>
        </View>
      </View>

      <View style={styles.cta}>
        {profile && (
          <View style={styles.profileChip}>
            <Icon id="crown" size={12} />
            <Text style={styles.profileText}> Hi, {profile}!</Text>
          </View>
        )}
        <View style={[styles.coinChip, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <Icon id="coin" size={16} />
          <Text style={styles.coinChipText}>{coins.toLocaleString()} coins</Text>
        </View>
        <View style={styles.themeRow}>
          {LEVELS.map((l) => {
            const open = unlocked.includes(l.id);
            const active = l.id === levelId;
            return (
              <Pressable
                key={l.id}
                disabled={!open}
                style={[styles.themeChip, active && styles.themeChipActive, !open && { opacity: 0.5 }]}
                onPress={() => {
                  onSelectLevel(l.id);
                  music.setTrack(l.id); // soundtrack follows the chosen map
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon id={open ? (LEVEL_ICON[l.id] ?? "flower") : "lock"} size={14} />
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>{l.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.missionBox}>
          <Text style={styles.missionTitle}>MISSIONS</Text>
          {missionStore
            .list()
            .filter((m) => !m.complete)
            .slice(0, 3)
            .map((m) => (
              <View key={m.id} style={styles.missionRow}>
                <Text style={styles.missionText}>
                  {m.text} ({m.value}/{m.goal})
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={styles.missionReward}>+{m.reward}</Text>
                  <Icon id="coin" size={10} />
                </View>
              </View>
            ))}
        </View>
        <View style={styles.themeRow}>
          {getThemes().map((t) => (
            <Pressable
              key={t.id}
              style={[styles.themeChip, t.id === themeId && styles.themeChipActive]}
              onPress={() => onTheme(t.id)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: t.hostBg,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.7)",
                  }}
                />
                <Text style={[styles.themeChipText, t.id === themeId && styles.themeChipTextActive]}>{t.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {best > 0 && (
          <View style={styles.bestBadge}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon id="crown" size={14} />
              <Text style={styles.bestBadgeText}>Best: {best.toLocaleString()}</Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "center", marginBottom: 10 }}>
          <Pressable style={styles.shopBtn} onPress={() => { sfx.pop(0); setShopOpen(true); }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon id="basket" size={18} />
              <Text style={styles.shopText}> SHOP · </Text>
              <Icon id="coin" size={14} />
              <Text style={styles.shopText}> {coins.toLocaleString()}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.musicBtn} onPress={toggleMusic} accessibilityRole="button" accessibilityLabel="Toggle background music">
            <Text style={{ fontSize: 18, fontWeight: "800", color: musicOn ? "#ff5c8a" : "#cbb8c4" }}>♪</Text>
          </Pressable>
        </View>

        <View style={styles.modeWrap}>
          <Text style={styles.modeTitle}>CHOOSE YOUR MODE</Text>
          <View style={styles.modeRow}>
            {MODE_LIST.map((m) => {
              const active = m.id === mode.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.modeCard, active && { backgroundColor: m.color, borderColor: "#fff", transform: [{ scale: 1.04 }] }]}
                >
                  <Text style={[styles.modeName, active && { color: "#fff" }]}>{m.name}</Text>
                  <Text style={[styles.modeDesc, active && { color: "rgba(255,255,255,0.9)" }]}>
                    {m.id === "easy" ? "long fuse · 0.8×" : m.id === "hard" ? "short fuse · 1.5×" : "classic · 1×"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable
          style={[styles.playBtn, { backgroundColor: mode.color }]}
          onPress={() => {
            void sfx.unlock();
            sfx.meow(8);
            onPlay();
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.playText}>PLAY · {mode.name}</Text>
            <Icon id="pawprint" size={24} />
          </View>
        </Pressable>
      </View>

      <ShopModal
        visible={shopOpen}
        onClose={() => setShopOpen(false)}
        coins={coins}
        spend={spend}
        grant={grant}
        owned={owned}
        setOwned={setOwned}
        equip={equip}
        setEquip={setEquip}
        themeId={themeId}
        pickTheme={onTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffd6e7", alignItems: "center", justifyContent: "space-between" },
  deco: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 },
  decoGlyph: { position: "absolute", width: 30, height: 30 },
  titleWrap: { alignItems: "center", marginTop: 16 },
  titleCat: { fontSize: 60 },
  title: { fontSize: 46, fontWeight: "800", color: "#ff5c8a", textShadowColor: "#fff", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  tagline: { marginTop: 8, fontSize: 14, fontWeight: "600", color: "#a0506e" },
  heroWrap: { alignItems: "center" },
  heroBubble: { backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 999, padding: 12, shadowColor: "#7a3b55", shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  heroChip: { marginTop: 8, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4 },
  heroChipText: { fontSize: 14, fontWeight: "700", color: "#7a3b55" },
  howto: { width: "100%", maxWidth: 380, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 24, borderWidth: 4, borderColor: "#fff", padding: 16, gap: 6 },
  howtoTitle: { textAlign: "center", fontSize: 12, fontWeight: "800", letterSpacing: 4, color: "#c46b8f", marginBottom: 2 },
  howtoLine: { fontSize: 14, color: "#7a3b55" },
  howtoLineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cta: { width: "100%", maxWidth: 380, alignItems: "center", gap: 12 },
  themeRow: { flexDirection: "row", gap: 8 },
  missionBox: { width: "100%", maxWidth: 380, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  missionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: "#c46b8f" },
  missionRow: { flexDirection: "row", justifyContent: "space-between" },
  missionText: { fontSize: 11, fontWeight: "600", color: "#a0506e" },
  missionReward: { fontSize: 11, fontWeight: "700", color: "#7a5210" },
  coinChip: { borderRadius: 999, backgroundColor: "#ffd76a", paddingHorizontal: 14, paddingVertical: 6 },
  coinChipText: { fontSize: 13, fontWeight: "800", color: "#7a5210" },
  themeChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.8)" },
  themeChipActive: { backgroundColor: "#ff8fb0" },
  themeChipText: { fontSize: 12, fontWeight: "700", color: "#a0506e" },
  themeChipTextActive: { color: "#fff" },
  bestBadge: { backgroundColor: "#ffd88a", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4 },
  bestBadgeText: { fontSize: 14, fontWeight: "700", color: "#7a3b55" },
  musicBtn: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  profileChip: { flexDirection: "row", alignItems: "center", alignSelf: "center", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  profileText: { fontSize: 12, fontWeight: "800", color: "#7a3b55" },
  modeWrap: { width: "100%", marginBottom: 10 },
  modeTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: "#c46b8f", textAlign: "center", marginBottom: 6 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 16, borderWidth: 3, borderColor: "transparent", paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", opacity: 0.85 },
  modeName: { fontSize: 13, fontWeight: "800", color: "#7a3b55" },
  modeDesc: { fontSize: 9, fontWeight: "700", color: "#a0506e", marginTop: 2 },
  shopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#ffd76a", borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, alignSelf: "center", marginBottom: 10, borderWidth: 3, borderColor: "#fff", shadowColor: "#7a3b55", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  shopText: { fontSize: 15, fontWeight: "800", color: "#7a5210" },
  playBtn: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#ff5c8a",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 0,
    elevation: 4,
  },
  playText: { color: "#fff", fontSize: 24, fontWeight: "800" },
});
