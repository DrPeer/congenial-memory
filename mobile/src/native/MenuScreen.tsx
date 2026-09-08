/**
 * MenuScreen — native port of the web menu (same copy, same palette).
 */
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CATS } from "../../../src/game/cats";
import { LEVELS } from "../../../src/game/levels";
import { missionStore } from "./missionsNative";
import { activeTheme, getThemes } from "../../../src/plugins/registry";
import { catPicture } from "./catPicture";
import { sfx } from "./sounds";

interface Props {
  best: number;
  themeId: string;
  onTheme: (id: string) => void;
  levelId: string;
  unlocked: string[];
  onSelectLevel: (id: string) => void;
  onPlay: () => void;
}

const DECO = ["🐾", "🧶", "💗", "🐟", "", "✨", "", "💗"];

export default function MenuScreen({ best, themeId, onTheme, levelId, unlocked, onSelectLevel, onPlay }: Props) {
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

  const [coins, setCoins] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem("kittydrop-coins")
      .then((v) => setCoins(Number(v || 0) || 0))
      .catch(() => {});
  }, []);

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
          <Animated.Text
            key={i}
            style={[
              styles.decoGlyph,
              {
                left: `${(i * 13 + 5) % 90}%`,
                top: `${(i * 23 + 8) % 90}%`,
                transform: [{ translateY: float }],
              },
            ]}
          >
            {g}
          </Animated.Text>
        ))}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.titleCat}>🐱</Text>
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
        <Text style={styles.howtoLine}>👆 Drag to aim, release to drop a kitty</Text>
        <Text style={styles.howtoLine}>💕 Two matching kitties merge into a bigger one</Text>
        <Text style={styles.howtoLine}>⚡ Quick chain merges = combo multipliers</Text>
        <Text style={styles.howtoLine}>️ Don't let the basket overflow!</Text>
      </View>

      <View style={styles.cta}>
        <View style={styles.coinChip}>
          <Text style={styles.coinChipText}>🪙 {coins.toLocaleString()} coins</Text>
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
                onPress={() => onSelectLevel(l.id)}
              >
                <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                  {open ? l.emoji : "🔒"} {l.name}
                </Text>
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
                <Text style={styles.missionReward}>+{m.reward}🪙</Text>
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
              <Text style={[styles.themeChipText, t.id === themeId && styles.themeChipTextActive]}>
                {t.emoji} {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {best > 0 && (
          <View style={styles.bestBadge}>
            <Text style={styles.bestBadgeText}>👑 Best: {best.toLocaleString()}</Text>
          </View>
        )}
        <Pressable
          style={styles.playBtn}
          onPress={() => {
            void sfx.unlock();
            sfx.meow(8);
            onPlay();
          }}
        >
          <Text style={styles.playText}>PLAY 🐾</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffd6e7", alignItems: "center", justifyContent: "space-between" },
  deco: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 },
  decoGlyph: { position: "absolute", fontSize: 30 },
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
