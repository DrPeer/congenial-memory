import { useCallback, useEffect, useState } from "react";
import CatIcon from "./components/CatIcon";
import Game from "./components/Game";
import { CATS } from "./game/cats";
import { sfx } from "./game/sound";
import { LEVELS, getLevel } from "./game/levels";
import { MissionStore } from "./game/missions";
import { activeTheme, getThemes, setActiveThemeId } from "./plugins/registry";

const LEVEL_KEY = "kittydrop-level";
const LEVELS_KEY = "kittydrop-levels";
const MISSIONS_KEY = "kittydrop-missions";

const BEST_KEY = "kittydrop-best";
const THEME_KEY = "kittydrop-theme";

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
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

  const selectLevel = useCallback((id: string) => {
    setLevelId(id);
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

  if (screen === "game") {
    return (
      <div className="h-full w-full">
        <Game
          onExit={() => setScreen("menu")}
          best={best}
          onBest={onBest}
          level={getLevel(levelId)}
          onSelectLevel={selectLevel}
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
        {["🐾", "🧶", "💗", "🐟", "🐾", "✨", "🐾", "💗"].map((g, i) => (
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
        <div className="anim-wiggle inline-block text-6xl">🐱</div>
        <h1 className="text-stroke mt-1 text-5xl font-bold leading-none text-[#ff5c8a] drop-shadow-[0_4px_0_#fff]">
          Kitty Drop
        </h1>
        <p className="mt-2 text-sm font-semibold text-[#a0506e]">Merge fluffy kitties · Make the Royal Chonk!</p>
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
          <li>👆 Drag to aim, release to drop a kitty</li>
          <li>💕 Two matching kitties merge into a bigger one</li>
          <li>⚡ Quick chain merges = combo multipliers</li>
          <li>⚠️ Don't let the basket overflow!</li>
        </ul>
      </div>

      {/* buttons */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-3">
        <div className="flex gap-2">
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
                {open ? l.emoji : "🔒"} {l.name}
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
                <span className="text-[#7a5210]">+{m.reward}🪙</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {getThemes().map((t) => (
            <button
              key={t.id}
              onClick={() => pickTheme(t.id)}
              className={`btn-cute px-3 py-1 text-xs ${
                t.id === themeId ? "bg-[#ff8fb0] text-white" : "bg-white/80 text-[#a0506e]"
              }`}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>
        <div className="rounded-full bg-[#ffd76a] px-4 py-1 text-sm font-bold text-[#7a5210] shadow-md">
          🪙 {(Number(localStorage.getItem("kittydrop-coins") || 0) || 0).toLocaleString()} coins
        </div>
        {best > 0 && (
          <div className="rounded-full bg-[#ffd88a] px-4 py-1 text-sm font-bold text-[#7a3b55] shadow">
            👑 Best: {best.toLocaleString()}
          </div>
        )}
        <button
          onClick={() => {
            sfx.unlock();
            sfx.meow(1.1);
            setScreen("game");
          }}
          className="btn-cute w-full bg-gradient-to-b from-[#ff8fb0] to-[#ff5c8a] py-4 text-2xl text-white"
        >
          PLAY 🐾
        </button>
      </div>
    </div>
  );
}
