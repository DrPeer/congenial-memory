import { useCallback, useEffect, useState } from "react";
import CatIcon from "./components/CatIcon";
import Game from "./components/Game";
import { CATS } from "./game/cats";
import { sfx } from "./game/sound";

const BEST_KEY = "kittydrop-best";

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

  useEffect(() => {
    const t = window.setInterval(() => setHeroTier((h) => (h + 1) % CATS.length), 1500);
    return () => window.clearInterval(t);
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
        <Game onExit={() => setScreen("menu")} best={best} onBest={onBest} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#ffd6e7] via-[#ffe3ee] to-[#fff3d6] px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),24px)]">
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
