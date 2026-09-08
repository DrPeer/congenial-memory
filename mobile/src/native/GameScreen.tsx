/**
 * GameScreen — native Kitty Drop.
 *
 * Physics + rules: src/game/sim.ts (shared with web).
 * Painting:      src/game/render.ts through SkiaCtx2D, recorded into an SkPicture
 *                each frame (same draw calls the web canvas gets).
 * Juice:         expo-haptics + expo-audio (WAV renditions of the web synth).
 */
import { Canvas, Picture, Skia, type SkPicture } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATS, MAX_TIER, comboWord } from "../../../src/game/cats";
import { renderScene } from "../../../src/game/render";
import { KittySim, WORLD_H, WORLD_W, type MergeEvent } from "../../../src/game/sim";
import { activeTheme } from "../../../src/plugins/registry";
import { catPicture } from "./catPicture";
import { nativeSprites } from "./spritesNative";
import { sfx } from "./sounds";
import { SkiaCtx2D } from "./skiaCtx";

interface Props {
  best: number;
  onBest: (b: number) => void;
  onExit: () => void;
}

interface Banner {
  id: number;
  text: string;
  sub?: string;
  color: string;
}

const BG = "#ffd6e7";

export default function GameScreen({ best, onBest, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const simRef = useRef<KittySim | null>(null);
  const viewRef = useRef({ w: 0, h: 0, scale: 1, offX: 0, offY: 0 });
  const dragging = useRef(false);
  const bannerId = useRef(0);
  const bestRef = useRef(best);
  bestRef.current = best;

  const [picture, setPicture] = useState<SkPicture | null>(null);
  const [score, setScore] = useState(0);
  const [bump, setBump] = useState(0);
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(0);
  const [danger, setDanger] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(sfx.muted);
  const [over, setOver] = useState<{ score: number; biggest: number; isBest: boolean } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [discover, setDiscover] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const [showChain, setShowChain] = useState(false);
  const [runKey, setRunKey] = useState(0);

  /* ------------------------------------------------------- sim + render loop */

  const handleMerge = useCallback((e: MergeEvent) => {
    if (e.mega) {
      sfx.fanfare();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bannerId.current++;
      setBanner({ id: bannerId.current, text: "MEGA MEOW!!", sub: `+${e.points} 👑`, color: "#ffb300" });
      return;
    }
    if (e.newTier !== null) sfx.meow(e.newTier);
    if (e.combo > 1) sfx.chime(e.combo);
    Haptics.impactAsync(e.combo >= 3 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (e.combo >= 2) {
      bannerId.current++;
      setBanner({
        id: bannerId.current,
        text: comboWord(e.combo),
        sub: `${e.combo}x combo · +${e.points}`,
        color: e.combo >= 5 ? "#ff3d6e" : e.combo >= 3 ? "#8b5cf6" : "#ff8fb0",
      });
    }
  }, []);

  useEffect(() => {
    setOver(null);
    setScore(0);
    setDanger(false);
    setPaused(false);
    setBanner(null);
    setDiscover(null);
    setUnlocked(new Set([0, 1, 2, 3, 4]));

    const sim = new KittySim({
      onScore: (s) => {
        setScore(s);
        setBump((b) => b + 1);
      },
      onNext: (c, n) => {
        setCurrent(c);
        setNext(n);
      },
      onMerge: handleMerge,
      onDanger: setDanger,
      onGameOver: (s, biggest) => {
        sfx.sad();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        const isBest = s > bestRef.current;
        if (isBest) onBest(s);
        setOver({ score: s, biggest, isBest });
      },
      onDiscover: (tier) => {
        setUnlocked((u) => new Set([...u, tier]));
        setDiscover(tier);
        setTimeout(() => setDiscover((d) => (d === tier ? null : d)), 1800);
      },
    });
    simRef.current = sim;

    void nativeSprites.warm();

    let running = true;
    let raf = 0;
    sim.prime(performance.now());
    const loop = (t: number) => {
      if (!running) return;
      sim.step(t);
      const { w, h, scale, offX, offY } = viewRef.current;
      if (w > 0 && h > 0) {
        const recorder = pictureRecorder();
        const canvas = recorder.beginRecording({ x: 0, y: 0, width: w, height: h });
        const ctx = new SkiaCtx2D(canvas);
        ctx.translate(offX, offY);
        ctx.scale(scale, scale);
        renderScene(ctx, sim, t, { theme: activeTheme(), sprites: nativeSprites });
        setPicture(recorder.finishRecordingAsPicture());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      sim.destroy();
      simRef.current = null;
    };
  }, [runKey, handleMerge, onBest]);

  /* ------------------------------------------------------------- pause on bg */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const sim = simRef.current;
      if (!sim || sim.over) return;
      if (state !== "active" && !sim.paused) {
        sim.paused = true;
        setPaused(true);
      }
    });
    return () => sub.remove();
  }, []);

  /* ------------------------------------------------------------- ui helpers */

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), 1300);
    return () => clearTimeout(t);
  }, [banner]);

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    const scale = Math.min(width / WORLD_W, height / WORLD_H);
    viewRef.current = {
      w: Math.round(width),
      h: Math.round(height),
      scale,
      offX: (width - WORLD_W * scale) / 2,
      offY: (height - WORLD_H * scale) / 2,
    };
  };

  const worldX = (locationX: number) => (locationX - viewRef.current.offX) / viewRef.current.scale;

  const onGrant = (e: { nativeEvent: { locationX: number } }) => {
    const sim = simRef.current;
    if (!sim || paused || over) return;
    void sfx.unlock();
    dragging.current = true;
    sim.setPointerWorldX(worldX(e.nativeEvent.locationX));
  };
  const onMove = (e: { nativeEvent: { locationX: number } }) => {
    const sim = simRef.current;
    if (!sim || paused || over || !dragging.current) return;
    sim.setPointerWorldX(worldX(e.nativeEvent.locationX));
  };
  const onRelease = (e: { nativeEvent: { locationX: number } }) => {
    const sim = simRef.current;
    if (!sim || paused || over || !dragging.current) return;
    dragging.current = false;
    sim.setPointerWorldX(worldX(e.nativeEvent.locationX));
    const tier = sim.currentTier;
    if (sim.drop()) sfx.pop(tier);
  };

  const togglePause = () => {
    const sim = simRef.current;
    if (!sim || over) return;
    sim.paused = !sim.paused;
    setPaused(sim.paused);
  };
  const toggleMute = () => {
    sfx.muted = !sfx.muted;
    setMuted(sfx.muted);
    if (!sfx.muted) sfx.pop(3);
  };
  const restart = () => {
    setRunKey((k) => k + 1);
    setBanner(null);
    setDiscover(null);
  };

  /* ------------------------------------------------------------------ view */

  const theme = activeTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.hostBg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <View style={[styles.scoreBox, danger && styles.danger]}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text key={bump} style={styles.scoreValue}>
              {score.toLocaleString()}
            </Text>
          </View>
          <View style={styles.bestChip}>
            <Text style={styles.bestChipText}>👑 BEST {Math.max(best, score).toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.hudRight}>
          <View style={styles.nextBox}>
            <Text style={styles.scoreLabel}>NEXT</Text>
            <View style={styles.nextThumb}>
              <Canvas style={{ width: 44, height: 44 }}>
                <Picture picture={catPicture(next, 44)} />
              </Canvas>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable style={styles.hudBtn} onPress={() => setShowChain((s) => !s)}>
              <Text style={styles.hudBtnText}>🐾</Text>
            </Pressable>
            <Pressable style={styles.hudBtn} onPress={toggleMute}>
              <Text style={styles.hudBtnText}>{muted ? "🔇" : "🔊"}</Text>
            </Pressable>
            <Pressable style={styles.hudBtn} onPress={togglePause}>
              <Text style={styles.hudBtnText}>{paused ? "▶️" : "⏸️"}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.droppingRow}>
        <View style={styles.droppingChip}>
          <Text style={styles.droppingText}>
            Dropping <Text style={styles.droppingName}>{CATS[current].name}</Text> · worth{" "}
            {CATS[Math.min(current + 1, MAX_TIER)].points} on merge
          </Text>
        </View>
      </View>

      {/* play field */}
      <View
        style={styles.field}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={() => (dragging.current = false)}
      >
        <Canvas style={StyleSheet.absoluteFill}>{picture ? <Picture picture={picture} /> : null}</Canvas>

        {banner && (
          <View key={banner.id} pointerEvents="none" style={styles.bannerWrap}>
            <Text style={[styles.bannerText, { color: banner.color }]}>{banner.text}</Text>
            {banner.sub ? <Text style={styles.bannerSub}>{banner.sub}</Text> : null}
          </View>
        )}

        {discover !== null && (
          <View pointerEvents="none" style={styles.discoverWrap}>
            <View style={styles.discoverCard}>
              <Canvas style={{ width: 56, height: 56 }}>
                <Picture picture={catPicture(discover, 56)} />
              </Canvas>
              <View>
                <Text style={styles.discoverLabel}>NEW KITTY!</Text>
                <Text style={styles.discoverName}>{CATS[discover].name}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* evolution strip */}
      <View style={styles.strip}>
        {CATS.map((c, i) => (
          <View key={c.name} style={styles.stripCell}>
            <Canvas style={{ width: 18 + i * 2.4, height: 18 + i * 2.4, opacity: unlocked.has(i) ? 1 : 0.35 }}>
              <Picture picture={catPicture(i, Math.round(18 + i * 2.4))} />
            </Canvas>
          </View>
        ))}
      </View>

      {/* modals */}
      {showChain && (
        <Modal onClose={() => setShowChain(false)}>
          <Text style={styles.modalTitle}>Kitty Evolution</Text>
          <Text style={styles.modalSub}>Merge two of the same kitty to make the next one!</Text>
          <View style={styles.chainList}>
            {CATS.map((c, i) => (
              <View key={c.name} style={styles.chainRow}>
                <Canvas style={{ width: 40, height: 40, opacity: unlocked.has(i) ? 1 : 0.35 }}>
                  <Picture picture={catPicture(i, 40)} />
                </Canvas>
                <View style={styles.chainInfo}>
                  <Text style={styles.chainName}>{unlocked.has(i) ? c.name : "???"}</Text>
                  <Text style={styles.chainTier}>Tier {i + 1}</Text>
                </View>
                <Text style={styles.chainPoints}>+{c.points}</Text>
              </View>
            ))}
            <View style={styles.chainMega}>
              <Text style={styles.chainMegaText}>
                👑 Two Royal Chonks merging = +2000 MEGA MEOW bonus! Combos multiply points ×1.5 each.
              </Text>
            </View>
          </View>
          <Pressable style={[styles.btn, { backgroundColor: "#ff8fb0" }]} onPress={() => setShowChain(false)}>
            <Text style={styles.btnTextWhite}>Got it!</Text>
          </Pressable>
        </Modal>
      )}

      {paused && !over && (
        <Modal>
          <Text style={styles.modalEmoji}>😴</Text>
          <Text style={styles.modalTitle}>Paused</Text>
          <Pressable style={[styles.btn, { backgroundColor: "#ff8fb0" }]} onPress={togglePause}>
            <Text style={styles.btnTextWhite}>▶ Resume</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: "#ffd88a" }]} onPress={restart}>
            <Text style={styles.btnTextDark}>🔄 Restart</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: "#ffffff" }]} onPress={onExit}>
            <Text style={styles.btnTextDark}>🏠 Menu</Text>
          </Pressable>
        </Modal>
      )}

      {over && (
        <Modal>
          <Text style={styles.modalEmoji}>{over.isBest ? "🏆" : "😿"}</Text>
          <Text style={styles.modalTitle}>{over.isBest ? "NEW BEST!" : "Too many kitties!"}</Text>
          <Text style={styles.modalSub}>The basket overflowed with fluff</Text>
          <View style={styles.finalBox}>
            <Text style={styles.finalLabel}>FINAL SCORE</Text>
            <Text style={styles.finalScore}>{over.score.toLocaleString()}</Text>
            <Text style={styles.modalSub}>Best: {Math.max(best, over.score).toLocaleString()}</Text>
          </View>
          <View style={styles.biggestRow}>
            <Canvas style={{ width: 56, height: 56 }}>
              <Picture picture={catPicture(over.biggest, 56)} />
            </Canvas>
            <View>
              <Text style={styles.discoverLabel}>BIGGEST KITTY</Text>
              <Text style={styles.discoverName}>{CATS[over.biggest].name}</Text>
            </View>
          </View>
          <Pressable style={[styles.btn, { backgroundColor: "#ff8fb0" }]} onPress={restart}>
            <Text style={styles.btnTextWhite}>🐱 Play Again</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: "#ffffff" }]} onPress={onExit}>
            <Text style={styles.btnTextDark}>🏠 Menu</Text>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* one recorder reused across frames */
const pictureRecorder = (() => {
  let rec: ReturnType<typeof Skia.PictureRecorder> | null = null;
  return () => {
    if (!rec) rec = Skia.PictureRecorder();
    return rec;
  };
})();

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <View style={styles.modalBack} onStartShouldSetResponder={() => true}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose ?? (() => {})} />
      <View style={styles.modalCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  hud: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  hudLeft: { gap: 6 },
  hudRight: { alignItems: "flex-end", gap: 6 },
  scoreBox: { backgroundColor: "#a97c6a", borderRadius: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 12, paddingVertical: 6 },
  danger: { shadowColor: "#ff5078", shadowOpacity: 0.8, shadowRadius: 12, elevation: 6 },
  scoreLabel: { color: "#ffe4c8", fontSize: 10, fontWeight: "800", letterSpacing: 3 },
  scoreValue: { color: "#fff", fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
  bestChip: { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  bestChipText: { color: "#a0506e", fontSize: 11, fontWeight: "700" },
  nextBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#a97c6a", borderRadius: 16, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 8, paddingVertical: 4 },
  nextThumb: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 999 },
  btnRow: { flexDirection: "row", gap: 6 },
  hudBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  hudBtnText: { fontSize: 16 },
  droppingRow: { alignItems: "center", marginTop: -2 },
  droppingChip: { backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 },
  droppingText: { color: "#a0506e", fontSize: 12, fontWeight: "700" },
  droppingName: { color: "#ff5c8a", fontSize: 12, fontWeight: "800" },
  field: { flex: 1 },
  bannerWrap: { position: "absolute", top: "22%", left: 0, right: 0, alignItems: "center" },
  bannerText: { fontSize: 38, fontWeight: "800", textAlign: "center", textShadowColor: "rgba(255,255,255,0.9)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  bannerSub: { fontSize: 16, fontWeight: "700", color: "#7a3b55", marginTop: 4 },
  discoverWrap: { position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center" },
  discoverCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff0f6", borderRadius: 24, borderWidth: 3, borderColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 },
  discoverLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#c46b8f" },
  discoverName: { fontSize: 20, fontWeight: "800", color: "#7a3b55" },
  strip: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 },
  stripCell: { alignItems: "center", marginHorizontal: 1 },
  modalBack: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(122,59,85,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 28, borderWidth: 4, borderColor: "#fff", padding: 20, gap: 10 },
  modalEmoji: { fontSize: 44, textAlign: "center" },
  modalTitle: { fontSize: 24, fontWeight: "800", color: "#7a3b55", textAlign: "center" },
  modalSub: { fontSize: 12, color: "#a0506e", textAlign: "center" },
  chainList: { gap: 6, maxHeight: 300 },
  chainRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff0f6", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chainInfo: { flex: 1 },
  chainName: { fontSize: 14, fontWeight: "700", color: "#7a3b55" },
  chainTier: { fontSize: 11, color: "#c46b8f" },
  chainPoints: { fontSize: 14, fontWeight: "700", color: "#ff5c8a" },
  chainMega: { backgroundColor: "#fff4d6", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chainMegaText: { fontSize: 12, color: "#8a6d1f" },
  finalBox: { backgroundColor: "#fff0f6", borderRadius: 16, padding: 12, alignItems: "center", gap: 4 },
  finalLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: "#c46b8f" },
  finalScore: { fontSize: 36, fontWeight: "800", color: "#ff5c8a" },
  biggestRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fff4d6", borderRadius: 16, padding: 8 },
  btn: { borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnTextWhite: { color: "#fff", fontSize: 17, fontWeight: "800" },
  btnTextDark: { color: "#7a3b55", fontSize: 17, fontWeight: "800" },
});
