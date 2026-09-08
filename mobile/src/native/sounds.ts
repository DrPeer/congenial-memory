/**
 * Native sound: the web game synthesises meows live with WebAudio; React Native
 * has no WebAudio, so scripts/gen-sounds.mjs renders the same synth to WAVs and
 * this module plays them through expo-audio with a tiny voice pool per sound
 * (so overlapping meows during combos don't cut each other off).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/* static require() map — Metro needs literal requires for assets */
const SRC: Record<string, number> = {
  meow00: require("../../assets/sounds/meow00.wav"),
  meow01: require("../../assets/sounds/meow01.wav"),
  meow02: require("../../assets/sounds/meow02.wav"),
  meow03: require("../../assets/sounds/meow03.wav"),
  meow04: require("../../assets/sounds/meow04.wav"),
  meow05: require("../../assets/sounds/meow05.wav"),
  meow06: require("../../assets/sounds/meow06.wav"),
  meow07: require("../../assets/sounds/meow07.wav"),
  meow08: require("../../assets/sounds/meow08.wav"),
  meow09: require("../../assets/sounds/meow09.wav"),
  meow10: require("../../assets/sounds/meow10.wav"),
  pop00: require("../../assets/sounds/pop00.wav"),
  pop01: require("../../assets/sounds/pop01.wav"),
  pop02: require("../../assets/sounds/pop02.wav"),
  pop03: require("../../assets/sounds/pop03.wav"),
  pop04: require("../../assets/sounds/pop04.wav"),
  pop05: require("../../assets/sounds/pop05.wav"),
  pop06: require("../../assets/sounds/pop06.wav"),
  pop07: require("../../assets/sounds/pop07.wav"),
  pop08: require("../../assets/sounds/pop08.wav"),
  pop09: require("../../assets/sounds/pop09.wav"),
  pop10: require("../../assets/sounds/pop10.wav"),
  chime02: require("../../assets/sounds/chime02.wav"),
  chime03: require("../../assets/sounds/chime03.wav"),
  chime04: require("../../assets/sounds/chime04.wav"),
  chime05: require("../../assets/sounds/chime05.wav"),
  chime06: require("../../assets/sounds/chime06.wav"),
  chime07: require("../../assets/sounds/chime07.wav"),
  chime08: require("../../assets/sounds/chime08.wav"),
  shoot: require("../../assets/sounds/shoot.wav"),
  raise: require("../../assets/sounds/raise.wav"),
  fanfare: require("../../assets/sounds/fanfare.wav"),
  sad: require("../../assets/sounds/sad.wav"),
};

const POOL = 3;
const pad = (n: number) => String(Math.max(0, Math.min(10, Math.round(n)))).padStart(2, "0");

class NativeSfx {
  muted = false;
  private pools = new Map<string, AudioPlayer[]>();
  private cursor = new Map<string, number>();
  private ready = false;

  async unlock() {
    if (this.ready) return;
    this.ready = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
    } catch {
      /* best effort */
    }
  }

  private pool(name: string): AudioPlayer[] | null {
    const src = SRC[name];
    if (src === undefined) return null;
    let p = this.pools.get(name);
    if (!p) {
      p = Array.from({ length: POOL }, () => createAudioPlayer(src));
      this.pools.set(name, p);
    }
    return p;
  }

  play(name: string) {
    if (this.muted) return;
    void this.unlock();
    const p = this.pool(name);
    if (!p) return;
    const i = (this.cursor.get(name) ?? 0) % POOL;
    this.cursor.set(name, i + 1);
    const player = p[i];
    try {
      player.seekTo(0);
      player.play();
    } catch {
      /* ignore */
    }
  }

  meow(tier: number) {
    this.play(`meow${pad(tier)}`);
  }
  pop(tier: number) {
    this.play(`pop${pad(tier)}`);
  }
  chime(combo: number) {
    this.play(`chime${pad(Math.max(2, Math.min(8, combo)))}`);
  }
  shoot() {
    this.play("shoot");
  }
  raiseCup() {
    this.play("raise");
  }
  fanfare() {
    this.play("fanfare");
  }
  sad() {
    this.play("sad");
  }
}

export const sfx = new NativeSfx();
