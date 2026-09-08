import { useCallback, useEffect, useRef, useState } from "react";
import CatIcon from "./components/CatIcon";
import Game from "./components/Game";
import { CATS } from "./game/cats";
import { sfx } from "./game/sound";
import { music } from "./game/music";
import { MODE_LIST, getMode, type ModeDef } from "./game/sim";
import { LEVELS, getLevel } from "./game/levels";
import { EQUIP_KEY, OWNED_KEY, type Equip } from "./game/shop";
import { setOwnedSkins } from "./plugins/registry";
import { MissionStore } from "./game/missions";
import { LEVEL_ICON } from "./game/sprites";
import { activeTheme, getThemes, setActiveThemeId } from "./plugins/registry";
import Icon from "./components/Icon";
import Shop from "./components/Shop";

const LEVEL_KEY = "kittydrop-level";
const LEVELS_KEY = "kittydrop-levels";
const MISSIONS_KEY = "kittydrop-missions";

const BEST_KEY = "kittydrop-best";
const THEME_KEY = "kittydrop-theme";

const PROFILE_KEY = "kittydrop-profile";
const MODE_KEY = "kittydrop-mode";
const MUSIC_KEY = "kittydrop-music";

export default function App() {
  const [screen, setScreen] = useState<"splash" | "menu" | "game">("splash");
  const [splashReady, setSplashReady] = useState(false);
  const [profile, setProfile] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PROFILE_KEY);
    } catch {
      return null;
    }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [mode, setMode] = useState<ModeDef>(() => {
    try {
      return getMode(localStorage.getItem(MODE_KEY));
    } catch {
      return getMode(null);
    }
  });
  const [musicOn, setMusicOn] = useState(true);
  const [entered, setEntered] = useState(false);
  const [best, setBest] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY) || 0);
    } catch {
      return 0;
    }
  });
  const [heroTier, setHeroTier] = useState(6);
  const [levelId, setLevelId] = useState<string>(() => {
    try {
      return localStorage.getItem(LEVEL_KEY) || "meadow";
    } catch {
      return "meadow";
    }
  });
  const [coins, setCoins] = useState<number>(() => Number(localStorage.getItem("kittydrop-coins") || 0) || 0);
  const [shopOpen, setShopOpen] = useState(false);
  const [owned, setOwned] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(OWNED_KEY) || "null") ?? [];
    } catch {
      return [];
    }
  });
  const [equip, setEquip] = useState<Equip>(() => {
    try {
      return JSON.parse(localStorage.getItem(EQUIP_KEY) || "null") ?? {};
    } catch {
      return {};
    }
  });
  const [unlocked, setUnlocked] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LEVELS_KEY) || "null") ?? ["meadow"];
    } catch {
      return ["meadow"];
    }
  });
  const missionList = (() => {
    try {
      const store = new MissionStore({
        load: () => JSON.parse(localStorage.getItem(MISSIONS_KEY) || "null") ?? { progress: {}, done: [] },
        save: () => {},
      });
      return store.list().filter((m) => !m.complete).slice(0, 3);
    } catch {
      return [];
    }
  })();

  // keep the theme registry aware of owned shop skins
  useEffect(() => {
    setOwnedSkins(owned);
  }, [owned]);

  // splash loading beat: spinning paw, then the buttons appear
  useEffect(() => {
    const t = window.setTimeout(() => setSplashReady(true), 750);
    return () => window.clearTimeout(t);
  }, []);

  // menu music (+ re-sync the music toggle when coming back from a run)
  useEffect(() => {
    if (screen !== "menu" || !entered) return;
    let on = true;
    try {
      on = localStorage.getItem(MUSIC_KEY) !== "0";
    } catch {
      /* ignore */
    }
    setMusicOn(on);
    music.setEnabled(on);
    music.playTrack("menu");
  }, [screen, entered]);

  const enterMenu = useCallback(() => {
    sfx.unlock();
    setEntered(true);
    setScreen("menu");
  }, []);

  const pickMode = useCallback((m: ModeDef) => {
    setMode(m);
    sfx.pop(1.1);
    try {
      localStorage.setItem(MODE_KEY, m.id);
    } catch {
      /* ignore */
    }
  }, []);

  const saveProfile = useCallback(() => {
    const name = loginName.trim().slice(0, 14);
    if (!name) return;
    setProfile(name);
    try {
      localStorage.setItem(PROFILE_KEY, name);
    } catch {
      /* ignore */
    }
    setLoginOpen(false);
    enterMenu();
  }, [loginName, enterMenu]);

  const updateOwned = useCallback((ids: string[]) => {
    setOwned(ids);
    try {
      localStorage.setItem(OWNED_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const updateEquip = useCallback((e: Equip) => {
    setEquip(e);
    try {
      localStorage.setItem(EQUIP_KEY, JSON.stringify(e));
    } catch {
      /* ignore */
    }
  }, []);

  // ref mirror so spend() can answer synchronously (state updaters run late)
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const writeCoins = useCallback((v: number) => {
    coinsRef.current = v;
    localStorage.setItem("kittydrop-coins", String(v));
    setCoins(v);
  }, []);
  const spendCoins = useCallback(
    (n: number) => {
      if (coinsRef.current < n) return false;
      writeCoins(coinsRef.current - n);
      return true;
    },
    [writeCoins],
  );
  const grantCoins = useCallback(
    (n: number) => {
      writeCoins(coinsRef.current + n);
    },
    [writeCoins],
  );

  const selectLevel = useCallback((id: string) => {
    setLevelId(id);
    music.playTrack(id); // the soundtrack follows the chosen map, right away
    try {
      localStorage.setItem(LEVEL_KEY, id);
    } catch {
      /* ignore */
    }
    setUnlocked((u) => {
      if (u.includes(id)) return u;
      const next = [...u, id];
      try {
        localStorage.setItem(LEVELS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      setOwnedSkins(owned); // shop themes must be registered before validation
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) setActiveThemeId(saved);
    } catch {
      /* ignore */
    }
    return activeTheme().id;
  });

  useEffect(() => {
    const t = window.setInterval(() => setHeroTier((h) => (h + 1) % CATS.length), 1500);
    return () => window.clearInterval(t);
  }, []);

  const theme = activeTheme();
  useEffect(() => {
    document.documentElement.style.background = theme.hostBg;
    document.body.style.background = theme.hostBg;
  }, [theme]);

  const pickTheme = useCallback((id: string) => {
    setActiveThemeId(id);
    setThemeId(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const onBest = useCallback((b: number) => {
    setBest(b);
    try {
      localStorage.setItem(BEST_KEY, String(b));
    } catch {
      /* ignore */
    }
  }, []);

  if (screen === "splash") {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-6"
        style={{ background: `linear-gradient(to bottom, ${theme.hostBg}, ${theme.hostBgMid}, ${theme.hostBgEnd})` }}
      >
        {/* floating deco */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
          {(["pawprint", "heart", "sparkle", "yarn", "pawprint", "flower"] as const).map((g, i) => (
            <span key={i} className="anim-float absolute" style={{ left: `${(i * 17 + 6) % 88}%`, top: `${(i * 29 + 10) % 85}%`, animationDelay: `${i * 0.4}s` }}>
              <Icon id={g} size={26 + (i % 3) * 8} />
            </span>
          ))}
        </div>

        {/* logo */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="anim-wiggle rounded-full bg-white/60 p-4 shadow-2xl">
            <CatIcon tier={6} size={110} />
          </div>
          <h1 className="text-stroke mt-3 text-6xl font-bold leading-none text-[#ff5c8a] drop-shadow-[0_5px_0_#fff]">
            Kitty Drop
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#a0506e]">Merge fluffy kitties · Make the Royal Chonk!</p>
        </div>

        {/* loading / entry */}
        <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-3">
          {!splashReady ? (
            <div className="flex flex-col items-center gap-2 text-[#a0506e]">
              <span className="animate-spin"><Icon id="pawprint" size={34} /></span>
              <span className="text-xs font-bold tracking-wide">warming up the whiskers…</span>
            </div>
          ) : loginOpen ? (
            <div className="anim-pop w-full rounded-3xl border-4 border-white bg-white/85 p-4 shadow-xl">
              <div className="mb-2 text-center text-xs font-bold tracking-[0.25em] text-[#c46b8f]">YOUR NAME</div>
              <input
                autoFocus
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                maxLength={14}
                placeholder="e.g. Mochi"
                className="w-full rounded-2xl border-2 border-[#ffd6e7] bg-white px-4 py-3 text-center text-base font-bold text-[#7a3b55] outline-none focus:border-[#ff8fb0]"
                aria-label="Player name"
              />
              <div className="mt-2 text-center text-[10px] font-semibold text-[#b08a9c]">
                saved on this device only — no account, no server
              </div>
              <button
                onClick={saveProfile}
                disabled={!loginName.trim()}
                className="btn-cute mt-3 w-full bg-gradient-to-b from-[#ff8fb0] to-[#ff5c8a] py-3 text-lg text-white disabled:opacity-40"
              >
                SAVE & PLAY
              </button>
            </div>
          ) : (
            <>
              {profile && (
                <button
                  onClick={enterMenu}
                  className="btn-cute anim-pop w-full bg-gradient-to-b from-[#ff8fb0] to-[#ff5c8a] py-4 text-xl text-white"
                >
                  <span className="inline-flex items-center gap-2"><Icon id="crown" size={20} /> CONTINUE, {profile.toUpperCase()}</span>
                </button>
              )}
              <button
                onClick={enterMenu}
                className={`btn-cute w-full py-3.5 text-lg ${profile ? "bg-white/85 text-[#a0506e]" : "anim-pop bg-gradient-to-b from-[#7ed8b4] to-[#4ec9a5] text-white"}`}
              >
                <span className="inline-flex items-center gap-2"><Icon id="pawprint" size={20} /> PLAY AS GUEST</span>
              </button>
              <button
                onClick={() => setLoginOpen(true)}
                className="btn-cute w-full bg-white/85 py-3 text-sm font-bold text-[#a0506e]"
              >
                <span className="inline-flex items-center gap-2"><Icon id="home" size={16} /> {profile ? "CHANGE NAME" : "LOGIN"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === "game") {
    return (
      <div className="h-full w-full">
        <Game
          onExit={() => {
            setScreen("menu");
            setCoins(Number(localStorage.getItem("kittydrop-coins") || 0) || 0);
          }}
          best={best}
          onBest={onBest}
          level={getLevel(levelId)}
          onSelectLevel={selectLevel}
          equip={equip}
          mode={mode}
        />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),24px)]"
      style={{ background: `linear-gradient(to bottom, ${theme.hostBg}, ${theme.hostBgMid}, ${theme.hostBgEnd})` }}
    >
      {/* floating deco */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden text-3xl opacity-30">
        {(["pawprint", "yarn", "heart", "fish", "pawprint", "sparkle", "pawprint", "heart"] as const).map((g, i) => (
          <span
            key={i}
            className="anim-float absolute"
            style={{
              left: `${(i * 13 + 5) % 90}%`,
              top: `${(i * 23 + 8) % 90}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            {g}
          </span>
        ))}
      </div>

      {/* title */}
      <div className="relative z-10 mt-4 text-center">
        <div className="anim-wiggle inline-block"><CatIcon tier={2} size={64} /></div>
        <h1 className="text-stroke mt-1 text-5xl font-bold leading-none text-[#ff5c8a] drop-shadow-[0_4px_0_#fff]">
          Kitty Drop
        </h1>
        <p className="mt-2 text-sm font-semibold text-[#a0506e]">Merge fluffy kitties · Make the Royal Chonk!</p>
        {profile && (
          <div className="mt-1.5 flex items-center gap-1 rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold text-[#7a3b55] shadow">
            <Icon id="crown" size={12} /> Hi, {profile}!
          </div>
        )}
      </div>

      {/* hero cat */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="anim-float rounded-full bg-white/50 p-3 shadow-xl">
          <CatIcon tier={heroTier} size={190} />
        </div>
        <div className="mt-2 rounded-full bg-white/80 px-4 py-1 text-sm font-bold text-[#7a3b55] shadow">
          {CATS[heroTier].name} · +{CATS[heroTier].points} pts
        </div>
      </div>

      {/* how to play */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl border-4 border-white bg-white/70 p-4 text-sm text-[#7a3b55] shadow-lg backdrop-blur-sm">
        <div className="mb-2 text-center text-xs font-bold tracking-[0.25em] text-[#c46b8f]">HOW TO PLAY</div>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2"><Icon id="pawprint" size={16} /> Drag to aim, release to drop a kitty</li>
          <li className="flex items-center gap-2"><Icon id="heart" size={16} /> Two matching kitties merge into a bigger one</li>
          <li className="flex items-center gap-2"><Icon id="sparkle" size={16} /> Quick chain merges = combo multipliers</li>
          <li className="flex items-center gap-2"><Icon id="alert" size={16} /> Don't let the basket overflow!</li>
        </ul>
      </div>

      {/* buttons */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShopOpen(true)}
            className="btn-cute flex items-center gap-2 bg-[#ffd76a] px-5 py-2 text-sm font-bold text-[#7a5210]"
          >
            <Icon id="basket" size={18} /> SHOP · <Icon id="coin" size={14} /> {coins.toLocaleString()}
          </button>
          <button
            onClick={() => {
              const v = !musicOn;
              setMusicOn(v);
              try {
                localStorage.setItem(MUSIC_KEY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
              music.setEnabled(v);
              if (v) music.playTrack("menu");
            }}
            className="btn-cute flex h-10 items-center gap-1 bg-white/85 px-3 text-sm font-bold"
            style={{ color: musicOn ? "#ff5c8a" : "#cbb8c4" }}
            aria-label="Toggle background music"
          >
            ♪ {musicOn ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {LEVELS.map((l) => {
            const open = unlocked.includes(l.id);
            return (
              <button
                key={l.id}
                disabled={!open}
                onClick={() => selectLevel(l.id)}
                className={`btn-cute px-3 py-1 text-xs ${
                  l.id === levelId ? "bg-[#ff8fb0] text-white" : "bg-white/80 text-[#a0506e]"
                } ${open ? "" : "opacity-50"}`}
              >
                <Icon id={open ? (LEVEL_ICON[l.id] ?? "flower") : "lock"} size={14} /> {l.name}
              </button>
            );
          })}
        </div>
        {missionList.length > 0 && (
          <div className="w-full max-w-sm rounded-2xl bg-white/70 px-4 py-2 text-left shadow-sm">
            <div className="text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">MISSIONS</div>
            {missionList.map((m) => (
              <div key={m.id} className="flex justify-between text-[11px] font-semibold text-[#a0506e]">
                <span>
                  {m.text} ({m.value}/{m.goal})
                </span>
                <span className="flex items-center gap-0.5 text-[#7a5210]">
                  +{m.reward}
                  <Icon id="coin" size={10} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {getThemes().map((t) => (
            <button
              key={t.id}
              onClick={() => pickTheme(t.id)}
              className={`btn-cute px-3 py-1 text-xs ${
                t.id === themeId ? "bg-[#ff8fb0] text-white" : "bg-white/80 text-[#a0506e]"
              }`}
            >
              <span
                className="mr-1 inline-block h-3 w-3 rounded-full border border-white/70 align-[-0.1em]"
                style={{ backgroundColor: t.hostBg }}
              />
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#ffd76a] px-4 py-1 text-sm font-bold text-[#7a5210] shadow-md">
          <Icon id="coin" size={16} /> {(Number(localStorage.getItem("kittydrop-coins") || 0) || 0).toLocaleString()} coins
        </div>
        {best > 0 && (
          <div className="rounded-full bg-[#ffd88a] px-4 py-1 text-sm font-bold text-[#7a3b55] shadow">
            <Icon id="crown" size={14} /> Best: {best.toLocaleString()}
          </div>
        )}
        {/* difficulty modes */}
        <div className="w-full">
          <div className="mb-1 text-center text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">CHOOSE YOUR MODE</div>
          <div className="grid grid-cols-3 gap-2">
            {MODE_LIST.map((m) => {
              const active = m.id === mode.id;
              return (
                <button
                  key={m.id}
                  onClick={() => pickMode(m)}
                  className={`btn-cute flex flex-col items-center gap-0.5 rounded-2xl border-4 px-1.5 py-2 text-center transition-transform ${active ? "scale-[1.04] border-white shadow-lg" : "border-transparent opacity-70"}`}
                  style={{ backgroundColor: active ? m.color : "#ffffffcc" }}
                  aria-pressed={active}
                >
                  <span className={`text-sm font-bold ${active ? "text-white" : "text-[#7a3b55]"}`}>{m.name}</span>
                  <span className={`text-[9px] font-semibold leading-tight ${active ? "text-white/90" : "text-[#a0506e]"}`}>
                    {m.id === "easy" ? "long fuse · 0.8×" : m.id === "hard" ? "short fuse · 1.5×" : "classic · 1×"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => {
            sfx.unlock();
            sfx.meow(1.1);
            setScreen("game");
          }}
          className="btn-cute w-full py-4 text-2xl text-white"
          style={{ background: `linear-gradient(to bottom, ${mode.color}, ${mode.color}dd)` }}
        >
          <span className="inline-flex items-center gap-2">PLAY · {mode.name} <Icon id="pawprint" size={22} /></span>
        </button>
      </div>
      <Shop
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        coins={coins}
        spend={spendCoins}
        grant={grantCoins}
        owned={owned}
        setOwned={updateOwned}
        equip={equip}
        setEquip={updateEquip}
        themeId={themeId}
        pickTheme={pickTheme}
      />
    </div>
  );
}
