/**
 * Native background music — seamless WAV loops rendered offline from the
 * shared spec (scripts/gen-music.mjs ← src/game/musicSpec.ts). The web build
 * synthesises the same tracks live (src/game/music.ts).
 */
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/* static require() map — Metro needs literal requires for assets */
const SRC: Record<string, number> = {
  menu: require("../../assets/music/menu.wav"),
  meadow: require("../../assets/music/meadow.wav"),
  beach: require("../../assets/music/beach.wav"),
  hills: require("../../assets/music/hills.wav"),
};

class NativeMusic {
  enabled = true;
  private player: AudioPlayer | null = null;
  private trackId: string | null = null;

  /** start looping a track ("menu" | level id). No-op when already playing. */
  setTrack(id: string) {
    if (this.trackId === id && this.player) {
      if (this.enabled) this.player.play();
      return;
    }
    this.stop();
    this.trackId = id;
    if (!this.enabled) return;
    const src = SRC[id] ?? SRC.menu;
    try {
      const p = createAudioPlayer(src);
      p.loop = true;
      p.volume = 0.55;
      p.play();
      this.player = p;
    } catch {
      /* audio unavailable (silent failures keep the game running) */
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.player) {
      if (on) this.player.play();
      else this.player.pause();
    } else if (on && this.trackId) {
      const t = this.trackId;
      this.trackId = null;
      this.setTrack(t);
    }
  }

  stop() {
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        /* ignore */
      }
      this.player = null;
    }
    this.trackId = null;
  }
}

export const music = new NativeMusic();
