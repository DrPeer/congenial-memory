import { useCallback, useEffect, useRef, useState } from "react";
import { CATS, comboWord, MAX_TIER } from "../game/cats";
import { AD_SECONDS, pickFakeAd, type FakeAd } from "../game/ads";
import { LEVELS, type LevelDef } from "../game/levels";
import { MissionStore, type MissionEvent } from "../game/missions";
import { BOOST_RAISE_COST, BOOST_SHOOT_COST, MAX_CUP_LIFT, type ModeDef } from "../game/sim";
import { music } from "../game/music";
import { KittyEngine, type MergeEvent } from "../game/engine";
import { sfx } from "../game/sound";
import { findCupSkin, findTrail } from "../game/shop";
import { LEVEL_ICON } from "../game/sprites";
import { activeTheme } from "../plugins/registry";
import CatIcon from "./CatIcon";
import Icon from "./Icon";

interface Props {
  onExit: () => void;
  best: number;
  onBest: (b: number) => void;
  level: LevelDef;
  onSelectLevel: (id: string) => void;
  equip: { cup?: string; trail?: string };
  mode: ModeDef;
}

const MISSIONS_KEY = "kittydrop-missions";
const REVIVE_COST = 30;

interface Banner {
  id: number;
  text: string;
  sub?: string;
  color: string;
}

const COINS_KEY = "kittydrop-coins";
const loadCoins = () => {
  try {
    return Number(localStorage.getItem(COINS_KEY) || 0) || 0;
  } catch {
    return 0;
  }
};
const saveCoins = (v: number) => {
  try {
    localStorage.setItem(COINS_KEY, String(v));
  } catch {
    /* ignore */
  }
};

export default function Game({ onExit, best, onBest, level, onSelectLevel, equip, mode }: Props) {
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
  const [coins, setCoins] = useState(loadCoins);
  const [aiming, setAiming] = useState(false);
  const [musicOn, setMusicOn] = useState(() => {
    try {
      return localStorage.getItem("kittydrop-music") !== "0";
    } catch {
      return true;
    }
  });
  const [win, setWin] = useState(false);
  const [reviveUsed, setReviveUsed] = useState(false);
  const [ad, setAd] = useState<{ purpose: "revive" | "retry"; left: number } | null>(null);
  const [adCard, setAdCard] = useState<FakeAd | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => window.clearInterval(t);
  }, []);
  const dangerRef = useRef(false);
  const missionsRef = useRef<MissionStore | null>(null);
  if (!missionsRef.current) {
    missionsRef.current = new MissionStore({
      load: () => {
        try {
          return JSON.parse(localStorage.getItem(MISSIONS_KEY) || "null") ?? { progress: {}, done: [] };
        } catch {
          return { progress: {}, done: [] };
        }
      },
      save: (st) => localStorage.setItem(MISSIONS_KEY, JSON.stringify(st)),
    });
  }

  const feed = useCallback((ev: MissionEvent) => {
    const done = missionsRef.current!.apply(ev);
    if (done.length) {
      setCoins((c) => {
        let v = c;
        for (const m of done) v += m.reward;
        saveCoins(v);
        return v;
      });
      setToast(done.map((m) => `${m.text}  +${m.reward} coins`).join("  ·  "));
      window.setTimeout(() => setToast(null), 2800);
    }
  }, []);

  const startAd = useCallback((purpose: "revive" | "retry") => {
    setAdCard(pickFakeAd());
    setAd({ purpose, left: AD_SECONDS });
  }, []);

  // ad countdown; on zero, deliver the promised reward action
  useEffect(() => {
    if (!ad) return;
    if (ad.left <= 0) {
      const purpose = ad.purpose;
      setAd(null);
      setAdCard(null);
      if (purpose === "revive") {
        if (engineRef.current?.revive()) {
          setOver(null);
          setReviveUsed(true);
        }
      } else {
        setOver(null);
        setRunKey((k) => k + 1);
      }
      return;
    }
    const t = window.setTimeout(() => setAd((a) => (a ? { ...a, left: a.left - 1 } : a)), 1000);
    return () => window.clearTimeout(t);
  }, [ad]);
  const bannerId = useRef(0);
  const bestRef = useRef(best);
  bestRef.current = best;
  const dragging = useRef(false);

  const spendCoins = useCallback((n: number) => {
    setCoins((c) => {
      const v = Math.max(0, c - n);
      saveCoins(v);
      return v;
    });
  }, []);

  const handleMerge = useCallback((e: MergeEvent) => {
    setCoins((c) => {
      const v = c + e.coins;
      saveCoins(v);
      return v;
    });
    feed({ type: "merge", count: 1 });
    if (e.combo > 1) feed({ type: "combo", value: e.combo });
    if (e.newTier !== null) feed({ type: "tier", value: e.newTier });
    if (e.mega) {
      bannerId.current++;
      setBanner({ id: bannerId.current, text: "MEGA MEOW!!", sub: `+${e.points} MEGA`, color: "#ffb300" });
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
  }, [feed]);

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
    setWin(false);
    setReviveUsed(false);
    dangerRef.current = false;

    const eng = new KittyEngine(
      canvas,
      {
        onScore: (s) => {
          setScore(s);
          setBump((b) => b + 1);
          feed({ type: "runScore", value: s });
        },
      onNext: (c, n) => {
        setCurrent(c);
        setNext(n);
      },
        onMerge: handleMerge,
        onDanger: (d) => {
          setDanger(d);
          if (!d && dangerRef.current && !eng.over) feed({ type: "survived" });
          dangerRef.current = d;
        },
        onWin: () => {
          setWin(true);
          feed({ type: "win", levelId: level.id });
        },
      onGameOver: (s, biggest) => {
        const isBest = s > bestRef.current;
        if (isBest) onBest(s);
        setOver({ score: s, biggest, isBest });
        setCoins((c) => {
          saveCoins(c);
          return c;
        });
      },
        onDiscover: (tier) => {
          setUnlocked((u) => new Set([...u, tier]));
          setDiscover(tier);
          window.setTimeout(() => setDiscover((d) => (d === tier ? null : d)), 1800);
        },
      },
      level,
      mode,
    );
    setAiming(false);
    eng.setLook({ cupSkin: findCupSkin(equip.cup), trail: findTrail(equip.trail) });
    if (equip.cup || equip.trail) feed({ type: "equipSkin" });
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
  }, [runKey, handleMerge, onBest, feed, level, equip, mode]);

  // themed background music for this map
  useEffect(() => {
    music.setEnabled(musicOn);
    music.playTrack(level.id);
    return () => music.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

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
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (eng.aiming) {
      eng.setAim(e.clientX, e.clientY);
      dragging.current = false;
      return;
    }
    dragging.current = true;
    eng.setPointer(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng || paused || over) return;
    if (eng.aiming) {
      eng.setAim(e.clientX, e.clientY);
      return;
    }
    eng.setPointer(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng || paused || over) return;
    if (eng.aiming) {
      eng.setAim(e.clientX, e.clientY);
      if (eng.shootAtAim()) setAiming(false);
      return;
    }
    if (!dragging.current) return;
    dragging.current = false;
    eng.setPointer(e.clientX);
    eng.drop();
  };

  const cancelAim = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.cancelAim();
    setAiming(false);
    setCoins((c) => {
      const v = c + BOOST_SHOOT_COST;
      saveCoins(v);
      return v;
    });
    sfx.pop(0.8);
  };

  const toggleMusic = () => {
    const v = !musicOn;
    setMusicOn(v);
    try {
      localStorage.setItem("kittydrop-music", v ? "1" : "0");
    } catch {
      /* ignore */
    }
    music.setEnabled(v);
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
    <div
      className="relative flex h-full w-full select-none flex-col overflow-hidden"
      style={{ backgroundColor: activeTheme().hostBg }}
    >
      {/* HUD */}
      <div className="relative z-10 flex items-start justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-1">
        {/* left: score */}
        <div className="flex flex-col gap-1.5">
          <div
            className={`rounded-2xl border-4 border-white bg-gradient-to-b from-[#bd917d] to-[#96644f] px-3 py-1.5 text-white shadow-[0_4px_12px_rgba(90,50,35,0.35)] ${danger ? "anim-danger" : ""}`}
          >
            <div className="text-[10px] font-bold tracking-[0.25em] text-[#ffe4c8]">SCORE</div>
            <div key={bump} className="anim-bump text-2xl font-bold leading-none tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[#a0506e] shadow-sm">
            <Icon id="crown" size={12} /> BEST {Math.max(best, score).toLocaleString()}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#ffd76a] px-2.5 py-1 text-[11px] font-bold text-[#7a5210] shadow-sm">
            <Icon id="coin" size={14} /> {coins.toLocaleString()}
          </div>
          <div
            className="rounded-xl px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-sm"
            style={{ backgroundColor: mode.color }}
          >
            {mode.name} · ×{mode.scoreMult} SCORE
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
              onClick={() => {
                const eng = engineRef.current;
                if (!eng || aiming || coins < BOOST_SHOOT_COST || over || paused) return;
                spendCoins(BOOST_SHOOT_COST);
                feed({ type: "booster" });
                eng.beginAim();
                setAiming(true);
                setBanner({ id: Date.now(), text: "SCOPE ON!", sub: "tap a kitty to launch it", color: "#5aa7e8" });
              }}
              disabled={coins < BOOST_SHOOT_COST || !!over || paused || aiming}
              className={`btn-cute relative flex h-11 min-w-11 items-center justify-center gap-0.5 bg-[#bfe3ff] px-2 disabled:opacity-40 ${aiming ? "anim-danger" : ""}`}
              aria-label="Shoot a kitty (scope mode)"
              title="Arm the scope, then tap WHICH kitty to launch"
            >
              <Icon id="target" size={22} />
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#28577a]">
                <Icon id="coin" size={10} />
                {BOOST_SHOOT_COST}
              </span>
            </button>
            <button
              onClick={() => {
                const eng = engineRef.current;
                if (eng && eng.boostRaiseCup()) {
                  spendCoins(BOOST_RAISE_COST);
                  feed({ type: "booster" });
                }
              }}
              disabled={coins < BOOST_RAISE_COST || !!over || paused || (engineRef.current?.cupLift ?? 0) >= MAX_CUP_LIFT}
              className="btn-cute relative flex h-11 min-w-11 items-center justify-center gap-0.5 bg-[#c9f2df] px-2 disabled:opacity-40"
              aria-label="Raise the cup"
              title="Stretch the cup taller for 20s (more room!)"
            >
              <Icon id="basket" size={22} />
              {(engineRef.current?.raiseLeft ?? 0) > 0 ? (
                <span className="text-[10px] font-bold text-[#1d6a4c]">
                  {Math.ceil((engineRef.current?.raiseLeft ?? 0) / 1000)}s
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#1d6a4c]">
                  <Icon id="coin" size={10} />
                  {BOOST_RAISE_COST}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowChain((s) => !s)}
              className="btn-cute flex h-11 w-11 items-center justify-center bg-white text-[#a0506e]"
              aria-label="Evolution"
            >
              <Icon id="pawprint" size={22} />
            </button>
            <button
              onClick={toggleMute}
              className="btn-cute flex h-11 w-11 items-center justify-center bg-white"
              aria-label="Mute sound effects"
            >
              <Icon id={muted ? "speakeroff" : "speaker"} size={22} />
            </button>
            <button
              onClick={toggleMusic}
              className="btn-cute flex h-11 w-11 items-center justify-center bg-white text-xl font-bold"
              style={{ color: musicOn ? "#ff5c8a" : "#cbb8c4" }}
              aria-label="Toggle background music"
              title="Background music"
            >
              ♪
            </button>
            <button
              onClick={togglePause}
              className="btn-cute flex h-11 w-11 items-center justify-center bg-white"
              aria-label="Pause"
            >
              <Icon id={paused ? "play" : "pause"} size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* current cat name */}
      <div className="pointer-events-none relative z-10 -mt-1 flex justify-center">
        <div className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold text-[#a0506e] shadow-sm">
          <Icon id={LEVEL_ICON[level.id] ?? "flower"} size={14} />{" "}
          <span className="text-[#8a5a3a]">{level.name}</span> · dropping{" "}
          <span className="text-[#ff5c8a]">{CATS[current].name}</span>
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

        {/* scope cancel (refunds the shot) */}
        {aiming && (
          <div className="absolute inset-x-0 top-2 z-30 flex justify-center">
            <button
              onClick={cancelAim}
              className="btn-cute flex items-center gap-2 bg-white/95 px-4 py-2 text-xs font-bold text-[#a0506e] shadow-lg"
              aria-label="Cancel scope and refund"
            >
              <Icon id="home" size={16} /> CANCEL · refund <Icon id="coin" size={13} /> {BOOST_SHOOT_COST}
            </button>
          </div>
        )}

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
              <Icon id="crown" size={14} /> Two Royal Chonks merging = <b>+2000</b> MEGA MEOW bonus! Combos multiply points ×1.5 each.
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
          <div className="mb-1 flex justify-center"><Icon id="pause" size={56} /></div>
          <h2 className="mb-4 text-center text-2xl font-bold text-[#7a3b55]">Paused</h2>
          <div className="flex flex-col gap-2">
            <button onClick={togglePause} className="btn-cute w-full bg-[#ff8fb0] py-3 text-lg text-white">
              ▶ Resume
            </button>
            <button onClick={restart} className="btn-cute w-full bg-[#ffd88a] py-3 text-[#7a3b55]">
              <Icon id="play" size={18} /> Restart
            </button>
            <button onClick={onExit} className="btn-cute w-full bg-white py-3 text-[#a0506e]">
              <Icon id="home" size={18} /> Menu
            </button>
          </div>
        </Modal>
      )}

      {/* mission toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[12%] z-40 flex justify-center px-4">
          <div className="anim-pop flex items-center gap-2 rounded-2xl border-4 border-white bg-[#7ed08a] px-4 py-2 text-sm font-bold text-white shadow-xl">
            <Icon id="party" size={20} /> {toast}
          </div>
        </div>
      )}

      {/* level complete → choose next world */}
      {win && !over && (
        <Modal>
          <div className="anim-pop text-center">
            <div className="mb-1 flex justify-center">
              <Icon id="party" size={56} />
            </div>
            <h2 className="text-3xl font-bold text-[#7a3b55]">LEVEL COMPLETE!</h2>
            <p className="mb-4 text-xs text-[#a0506e]">
              {level.emoji} {level.name} cleared — pick your next world:
            </p>
            <div className="flex flex-col gap-2">
              {LEVELS.filter((l) => l.id !== "meadow").map((l) => (
                <button
                  key={l.id}
                  onClick={() => onSelectLevel(l.id)}
                  className="btn-cute flex items-center gap-3 bg-white p-3 text-left"
                >
                  <Icon id={LEVEL_ICON[l.id] ?? "flower"} size={40} />
                  <span>
                    <span className="block text-lg font-bold text-[#7a3b55]">{l.name}</span>
                    <span className="block text-[11px] text-[#a0506e]">{l.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setWin(false)} className="btn-cute mt-2 w-full bg-white/70 py-2 text-xs text-[#a0506e]">
              keep playing here
            </button>
          </div>
        </Modal>
      )}

      {/* simulated sponsor reel (ad slot) */}
      {ad && adCard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2b2233]/80 p-6 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-sm rounded-[28px] border-4 border-white bg-white p-6 text-center shadow-2xl">
            <div className="text-[10px] font-bold tracking-[0.3em] text-[#b0a8b8]">SPONSOR REEL · AD</div>
            <div className="my-4 flex justify-center">
              <Icon id={adCard.icon} size={72} />
            </div>
            <div className="text-2xl font-bold text-[#4a3b55]">{adCard.title}</div>
            <div className="mt-1 text-sm text-[#7a6b88]">{adCard.tagline}</div>
            <div className="mt-5 text-xs font-bold text-[#b0a8b8]">reward in {ad.left}s…</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eee6f2]">
              <div
                className="h-full rounded-full bg-[#57c6ff] transition-all duration-1000"
                style={{ width: `${((AD_SECONDS - ad.left) / AD_SECONDS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* game over modal */}
      {over && (
        <Modal>
          <div className="anim-pop text-center">
            <div className="mb-1 flex justify-center">
              <Icon id={over.isBest ? "trophy" : "sadcat"} size={56} />
            </div>
            <h2 className="text-3xl font-bold text-[#7a3b55]">{over.isBest ? "NEW BEST!" : "Too many kitties!"}</h2>
            <p className="mb-3 text-xs text-[#a0506e]">The basket overflowed with fluff</p>
            <div className="mb-3 rounded-2xl bg-[#fff0f6] p-3">
              <div className="text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">FINAL SCORE</div>
              <div className="text-4xl font-bold text-[#ff5c8a]">{over.score.toLocaleString()}</div>
              <div className="mt-1 text-xs text-[#a0506e]">Best: {Math.max(best, over.score).toLocaleString()}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-[#7a5210]">
                <Icon id="coin" size={12} /> +{(engineRef.current?.coinsEarned ?? 0).toLocaleString()} coins banked
              </div>
            </div>
            <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-[#fff4d6] p-2">
              <CatIcon tier={over.biggest} size={56} />
              <div className="text-left">
                <div className="text-[10px] font-bold tracking-widest text-[#8a6d1f]">BIGGEST KITTY</div>
                <div className="text-lg font-bold text-[#7a3b55]">{CATS[over.biggest].name}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {!reviveUsed && (
                <>
                  <button
                    onClick={() => startAd("revive")}
                    className="btn-cute flex w-full items-center justify-center gap-2 bg-[#57c6ff] py-3 text-lg text-white"
                  >
                    <Icon id="tv" size={22} /> Watch ad → revive & continue
                  </button>
                  <button
                    onClick={() => {
                      if (coins >= REVIVE_COST && engineRef.current?.revive()) {
                        spendCoins(REVIVE_COST);
                        setOver(null);
                        setReviveUsed(true);
                      }
                    }}
                    disabled={coins < REVIVE_COST}
                    className="btn-cute flex w-full items-center justify-center gap-2 bg-[#ffd76a] py-3 text-lg text-[#7a5210] disabled:opacity-40"
                  >
                    <Icon id="coin" size={20} /> {REVIVE_COST} → revive & continue
                  </button>
                </>
              )}
              {level.retryNeedsAd ? (
                <button
                  onClick={() => startAd("retry")}
                  className="btn-cute flex w-full items-center justify-center gap-2 bg-[#ff8fb0] py-3 text-lg text-white"
                >
                  <Icon id="tv" size={22} /> Watch ad → retry {level.name}
                </button>
              ) : (
                <button
                  onClick={restart}
                  className="btn-cute flex w-full items-center justify-center gap-2 bg-[#ff8fb0] py-3 text-lg text-white"
                >
                  <Icon id="pawprint" size={22} /> Play Again
                </button>
              )}
              <button
                onClick={onExit}
                className="btn-cute flex w-full items-center justify-center gap-2 bg-white py-3 text-[#a0506e]"
              >
                <Icon id="home" size={20} /> Menu
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
        className="anim-pop max-h-[86vh] w-full max-w-sm overflow-y-auto rounded-[28px] border-4 border-white bg-gradient-to-b from-white to-[#ffeaf2] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
