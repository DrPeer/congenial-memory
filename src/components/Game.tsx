import { useCallback, useEffect, useRef, useState } from "react";
import { CATS, comboWord, MAX_TIER } from "../game/cats";
import { KittyEngine, type MergeEvent } from "../game/engine";
import { sfx } from "../game/sound";
import CatIcon from "./CatIcon";

interface Props {
  onExit: () => void;
  best: number;
  onBest: (b: number) => void;
}

interface Banner {
  id: number;
  text: string;
  sub?: string;
  color: string;
}

export default function Game({ onExit, best, onBest }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<KittyEngine | null>(null);
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
  const bannerId = useRef(0);
  const bestRef = useRef(best);
  bestRef.current = best;
  const dragging = useRef(false);

  const handleMerge = useCallback((e: MergeEvent) => {
    if (e.mega) {
      bannerId.current++;
      setBanner({ id: bannerId.current, text: "MEGA MEOW!!", sub: `+${e.points} 👑`, color: "#ffb300" });
      return;
    }
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

  // create engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    setOver(null);
    setScore(0);
    setDanger(false);
    setPaused(false);
    setUnlocked(new Set([0, 1, 2, 3, 4]));

    const eng = new KittyEngine(canvas, {
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
        const isBest = s > bestRef.current;
        if (isBest) onBest(s);
        setOver({ score: s, biggest, isBest });
      },
      onDiscover: (tier) => {
        setUnlocked((u) => new Set([...u, tier]));
        setDiscover(tier);
        window.setTimeout(() => setDiscover((d) => (d === tier ? null : d)), 1800);
      },
    });
    engineRef.current = eng;

    const doResize = () => {
      const rect = wrap.getBoundingClientRect();
      eng.resize(rect.width, rect.height);
    };
    doResize();
    const ro = new ResizeObserver(doResize);
    ro.observe(wrap);
    eng.start();

    return () => {
      ro.disconnect();
      eng.destroy();
      engineRef.current = null;
    };
  }, [runKey, handleMerge, onBest]);

  // banner auto clear
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), 1300);
    return () => window.clearTimeout(t);
  }, [banner]);

  // pointer input
  const onPointerDown = (e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng || paused || over) return;
    sfx.unlock();
    dragging.current = true;
    eng.setPointer(e.clientX);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng || paused || over) return;
    eng.setPointer(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng || paused || over) return;
    if (!dragging.current) return;
    dragging.current = false;
    eng.setPointer(e.clientX);
    eng.drop();
  };

  const togglePause = () => {
    const eng = engineRef.current;
    if (!eng || over) return;
    eng.paused = !eng.paused;
    setPaused(eng.paused);
  };
  const toggleMute = () => {
    sfx.muted = !sfx.muted;
    setMuted(sfx.muted);
    if (!sfx.muted) sfx.pop();
  };
  const restart = () => {
    setRunKey((k) => k + 1);
    setBanner(null);
    setDiscover(null);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#ffd6e7]">
      {/* HUD */}
      <div className="relative z-10 flex items-start justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-1">
        {/* left: score */}
        <div className="flex flex-col gap-1.5">
          <div
            className={`rounded-2xl border-4 border-white bg-[#a97c6a] px-3 py-1.5 text-white shadow-md ${danger ? "anim-danger" : ""}`}
          >
            <div className="text-[10px] font-bold tracking-[0.25em] text-[#ffe4c8]">SCORE</div>
            <div key={bump} className="anim-bump text-2xl font-bold leading-none tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[#a0506e] shadow-sm">
            👑 BEST {Math.max(best, score).toLocaleString()}
          </div>
        </div>

        {/* right: next + buttons */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 rounded-2xl border-4 border-white bg-[#a97c6a] px-2 py-1 shadow-md">
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#ffe4c8]">NEXT</div>
            <div className="anim-float rounded-full bg-white/25">
              <CatIcon tier={next} size={44} />
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowChain((s) => !s)}
              className="btn-cute flex h-9 w-9 items-center justify-center bg-white text-base text-[#a0506e]"
              aria-label="Evolution"
            >
              🐾
            </button>
            <button
              onClick={toggleMute}
              className="btn-cute flex h-9 w-9 items-center justify-center bg-white text-base"
              aria-label="Mute"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={togglePause}
              className="btn-cute flex h-9 w-9 items-center justify-center bg-white text-base"
              aria-label="Pause"
            >
              {paused ? "▶️" : "⏸️"}
            </button>
          </div>
        </div>
      </div>

      {/* current cat name */}
      <div className="pointer-events-none relative z-10 -mt-1 flex justify-center">
        <div className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold text-[#a0506e] shadow-sm">
          Dropping <span className="text-[#ff5c8a]">{CATS[current].name}</span> · worth {CATS[Math.min(current + 1, MAX_TIER)].points} on merge
        </div>
      </div>

      {/* canvas */}
      <div
        ref={wrapRef}
        className="relative flex-1 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragging.current = false)}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* combo banner */}
        {banner && (
          <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[22%] z-20 flex flex-col items-center">
            <div
              className="anim-combo text-stroke text-center text-4xl font-bold drop-shadow-[0_3px_0_rgba(255,255,255,0.9)]"
              style={{ color: banner.color }}
            >
              {banner.text}
              {banner.sub && <div className="mt-1 text-base font-bold text-[#7a3b55]">{banner.sub}</div>}
            </div>
          </div>
        )}

        {/* discovery popup */}
        {discover !== null && (
          <div className="pointer-events-none absolute inset-x-0 top-[40%] z-20 flex justify-center">
            <div className="anim-pop flex items-center gap-3 rounded-3xl border-4 border-white bg-gradient-to-br from-[#fff0f6] to-[#ffe0ec] px-4 py-2 shadow-xl">
              <CatIcon tier={discover} size={56} />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#c46b8f]">NEW KITTY!</div>
                <div className="text-xl font-bold text-[#7a3b55]">{CATS[discover].name}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* evolution chain strip */}
      <div className="relative z-10 bg-white/60 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-sm">
        <div className="flex items-end justify-center gap-0.5">
          {CATS.map((c, i) => (
            <div key={c.name} className="flex flex-col items-center">
              <CatIcon tier={i} size={18 + i * 2.4} dim={!unlocked.has(i)} />
              {i < MAX_TIER && <span className="-mt-1 text-[8px] text-[#c46b8f]">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* chain modal */}
      {showChain && (
        <Modal onClose={() => setShowChain(false)}>
          <h2 className="mb-2 text-center text-2xl font-bold text-[#7a3b55]">Kitty Evolution</h2>
          <p className="mb-3 text-center text-xs text-[#a0506e]">Merge two of the same kitty to make the next one!</p>
          <div className="grid max-h-[50vh] grid-cols-1 gap-1.5 overflow-y-auto pr-1">
            {CATS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 rounded-2xl bg-[#fff0f6] px-3 py-1.5">
                <CatIcon tier={i} size={40} dim={!unlocked.has(i)} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#7a3b55]">{unlocked.has(i) ? c.name : "???"}</div>
                  <div className="text-[11px] text-[#c46b8f]">Tier {i + 1}</div>
                </div>
                <div className="text-sm font-bold text-[#ff5c8a]">+{c.points}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-2xl bg-[#fff4d6] px-3 py-2 text-xs text-[#8a6d1f]">
              👑 Two Royal Chonks merging = <b>+2000</b> MEGA MEOW bonus! Combos multiply points ×1.5 each.
            </div>
          </div>
          <button onClick={() => setShowChain(false)} className="btn-cute mt-3 w-full bg-[#ff8fb0] py-2.5 text-white">
            Got it!
          </button>
        </Modal>
      )}

      {/* pause modal */}
      {paused && !over && (
        <Modal>
          <div className="mb-1 text-center text-5xl">😴</div>
          <h2 className="mb-4 text-center text-2xl font-bold text-[#7a3b55]">Paused</h2>
          <div className="flex flex-col gap-2">
            <button onClick={togglePause} className="btn-cute w-full bg-[#ff8fb0] py-3 text-lg text-white">
              ▶ Resume
            </button>
            <button onClick={restart} className="btn-cute w-full bg-[#ffd88a] py-3 text-[#7a3b55]">
              🔄 Restart
            </button>
            <button onClick={onExit} className="btn-cute w-full bg-white py-3 text-[#a0506e]">
              🏠 Menu
            </button>
          </div>
        </Modal>
      )}

      {/* game over modal */}
      {over && (
        <Modal>
          <div className="anim-pop text-center">
            <div className="mb-1 text-5xl">{over.isBest ? "🏆" : "😿"}</div>
            <h2 className="text-3xl font-bold text-[#7a3b55]">{over.isBest ? "NEW BEST!" : "Too many kitties!"}</h2>
            <p className="mb-3 text-xs text-[#a0506e]">The basket overflowed with fluff</p>
            <div className="mb-3 rounded-2xl bg-[#fff0f6] p-3">
              <div className="text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">FINAL SCORE</div>
              <div className="text-4xl font-bold text-[#ff5c8a]">{over.score.toLocaleString()}</div>
              <div className="mt-1 text-xs text-[#a0506e]">Best: {Math.max(best, over.score).toLocaleString()}</div>
            </div>
            <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-[#fff4d6] p-2">
              <CatIcon tier={over.biggest} size={56} />
              <div className="text-left">
                <div className="text-[10px] font-bold tracking-widest text-[#8a6d1f]">BIGGEST KITTY</div>
                <div className="text-lg font-bold text-[#7a3b55]">{CATS[over.biggest].name}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={restart} className="btn-cute w-full bg-[#ff8fb0] py-3 text-lg text-white">
                🐱 Play Again
              </button>
              <button onClick={onExit} className="btn-cute w-full bg-white py-3 text-[#a0506e]">
                🏠 Menu
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#7a3b55]/40 p-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="anim-pop w-full max-w-sm rounded-[28px] border-4 border-white bg-gradient-to-b from-white to-[#ffeaf2] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
