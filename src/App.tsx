import { useCallback, useEffect, useRef, useState } from "react";
import CatIcon from "./components/CatIcon";
import Game from "./components/Game";
import { CATS } from "./game/cats";
import { sfx } from "./game/sound";
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
        <button
          onClick={() => setShopOpen(true)}
          className="btn-cute flex items-center gap-2 bg-[#ffd76a] px-5 py-2 text-sm font-bold text-[#7a5210]"
        >
          <Icon id="basket" size={18} /> SHOP · <Icon id="coin" size={14} /> {coins.toLocaleString()}
        </button>
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
        <button
          onClick={() => {
            sfx.unlock();
            sfx.meow(1.1);
            setScreen("game");
          }}
          className="btn-cute w-full bg-gradient-to-b from-[#ff8fb0] to-[#ff5c8a] py-4 text-2xl text-white"
        >
          <span className="inline-flex items-center gap-2">PLAY <Icon id="pawprint" size={22} /></span>
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
