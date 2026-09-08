/**
 * Kitty Drop — Expo shell (iOS + Android)
 * ---------------------------------------
 * This file is the ONLY "core" the mobile app adds. The game itself lives in the
 * web project at the repo root and is embedded here as one self-contained html
 * document (see scripts/build-game-bundle.mjs). Nothing in /src is modified to
 * make the game run on a phone.
 *
 * What the shell is responsible for:
 *   • rendering the game full-screen inside a WebView tuned for a canvas game
 *   • portrait lock + safe areas (notch / gesture bar)
 *   • persisting the web game's localStorage (best score) via AsyncStorage
 *   • recovering the WebView if iOS kills its content process under memory pressure
 *   • optional LIVE mode: point EXPO_PUBLIC_GAME_URL at `npm run dev` for hot editing
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

import { GAME_HTML, STORAGE_TOKEN } from "./src/gameHtml";

/** AsyncStorage key holding the web game's whole localStorage object. */
const STORAGE_KEY = "@kittydrop/web-storage";
/** Set by `npm run mobile:live` to load the Vite dev server instead of the bundle. */
const LIVE_URL = (process.env.EXPO_PUBLIC_GAME_URL ?? "").trim();
/** Same pink as the game's background, so there is never a white flash. */
const BG = "#ffd6e7";

type Storage = Record<string, string>;

// Keep the native splash up until the game html is ready to be shown.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* not available in Expo Go - safe to ignore */
});

export default function App() {
  const webRef = useRef<WebView>(null);
  const savedRef = useRef<Storage>({});

  // null = still reading AsyncStorage (so we don't reload the WebView with an empty best score)
  const [seed, setSeed] = useState<Storage | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------------------------- setup */

  // The game is designed for portrait (400x640 world), so lock it.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
      /* Expo Go / simulator may refuse - the app.json lock still applies */
    });
  }, []);

  // Load what the game saved on a previous launch.
  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded: Storage = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) loaded = (JSON.parse(raw) as Storage) ?? {};
      } catch {
        loaded = {};
      }
      if (!alive) return;
      savedRef.current = loaded;
      setSeed(loaded);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /**
   * The html we hand the WebView. The `%%KITTY_STORAGE%%` token inside the
   * injected bridge script is swapped for the saved storage (URI-encoded, so it
   * can never break out of the JS string).
   *
   * Deliberately memoised on `seed` only — writes coming back from the game go
   * to `savedRef`, never to state, or the WebView would reload mid-game.
   */
  const html = useMemo(() => {
    if (!seed) return null;
    const encoded = encodeURIComponent(JSON.stringify(seed));
    return GAME_HTML.replace(STORAGE_TOKEN, () => encoded);
  }, [seed]);

  /* ------------------------------------------------------- game -> native */

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let msg: { type?: string; payload?: unknown };
    try {
      msg = JSON.parse(event.nativeEvent.data) as typeof msg;
    } catch {
      return;
    }
    if (msg.type === "kitty:storage" && msg.payload && typeof msg.payload === "object") {
      savedRef.current = msg.payload as Storage;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedRef.current)).catch(() => {
        /* storage full / unavailable - the game keeps working in-memory */
      });
    } else if (msg.type === "kitty:ready") {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  const onLoadEnd = useCallback(() => {
    setReady(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // iOS can terminate the WebView's content process under memory pressure;
  // a canvas game is exactly the kind of thing that triggers it. Reload.
  const onContentProcessDidTerminate = useCallback(() => {
    setReady(false);
    webRef.current?.reload();
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setReady(false);
    webRef.current?.reload();
  }, []);

  /* -------------------------------------------------------------- render */

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          {html === null && !LIVE_URL ? (
            <Loading label="Waking up the kitties…" />
          ) : (
            <WebView
              ref={webRef}
              style={styles.web}
              containerStyle={styles.webContainer}
              source={LIVE_URL ? { uri: LIVE_URL } : { html: html as string }}
              originWhitelist={["*"]}
              onLoadEnd={onLoadEnd}
              onMessage={onMessage}
              onContentProcessDidTerminate={onContentProcessDidTerminate}
              onError={(e) => setError(e.nativeEvent.description || "The game failed to load")}
              onHttpError={(e) => setError(`The game failed to load (HTTP ${e.nativeEvent.statusCode})`)}
              /* --- canvas-game tuning ------------------------------------- */
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              setSupportMultipleWindows={false}
              allowsLinkPreview={false}
              textZoom={100} /* ignore the OS font-size setting so the HUD layout is identical */
              /* --- audio: the game synthesises meows with WebAudio --------- */
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={false}
              keyboardDisplayRequiresUserAction={false}
              /* --- dev tools ------------------------------------------------ */
              webviewDebuggingEnabled={__DEV__}
              javaScriptEnabled
              domStorageEnabled
            />
          )}

          {/* covers the WebView until the game has painted its first frame */}
          {!ready && !error && (
            <View style={styles.veil} pointerEvents="none">
              <Loading label={LIVE_URL ? `Connecting to ${LIVE_URL}` : "Waking up the kitties…"} />
            </View>
          )}
        </SafeAreaView>

        {error && (
          <View style={styles.veil}>
            <View style={styles.card}>
              <Text style={styles.cardEmoji}>😿</Text>
              <Text style={styles.cardTitle}>Aw, hairballs.</Text>
              <Text style={styles.cardText}>{error}</Text>
              <Text style={styles.cardHint} onPress={retry}>
                Tap to retry
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingEmoji}>🐱</Text>
      <ActivityIndicator size="large" color="#ff5c8a" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  webContainer: { flex: 1, backgroundColor: BG },
  veil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    backgroundColor: BG,
    justifyContent: "center",
  },
  loading: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center" },
  loadingEmoji: { fontSize: 52 },
  loadingText: { color: "#a0506e", fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  card: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#fff",
    borderRadius: 28,
    borderWidth: 4,
    gap: 6,
    marginHorizontal: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#7a3b55",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      default: { elevation: 8 },
    }),
  },
  cardEmoji: { fontSize: 44 },
  cardTitle: { color: "#7a3b55", fontSize: 22, fontWeight: "800" },
  cardText: { color: "#a0506e", fontSize: 13, textAlign: "center" },
  cardHint: { color: "#ff5c8a", fontSize: 14, fontWeight: "800", marginTop: 8 },
});
