/**
 * Web background music — a tiny lookahead scheduler that plays the shared
 * MusicTrack specs (src/game/musicSpec.ts) live through WebAudio.
 *
 * One looping chord progression per track: soft pad, sine/triangle/square
 * lead arpeggio, root-fifth bass and optional octave shimmer. The native app
 * plays pre-rendered WAV loops of the exact same spec (scripts/gen-music.mjs).
 */
import { musicTrackFor, trackFreq, type MusicTrack } from "./musicSpec";

class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private track: MusicTrack | null = null;
  private step = 0;
  private nextTime = 0;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      this.master.connect(lp).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** start looping a track ("menu" | level id). Safe to call repeatedly. */
  playTrack(id: string) {
    if (this.track?.id === id && this.timer !== null) return;
    this.stopScheduler();
    this.track = musicTrackFor(id);
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 90);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0.0001, this.ctx.currentTime, 0.08);
    }
    if (on && this.track && this.timer === null) this.playTrack(this.track.id);
  }

  stop() {
    this.stopScheduler();
    this.track = null;
  }

  private stopScheduler() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /* ------------------------------------------------------------ scheduler */

  private tick() {
    const ctx = this.ctx;
    const track = this.track;
    if (!ctx || !track || !this.enabled) return;
    const eighth = 60 / track.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.4) {
      this.scheduleStep(track, this.step, this.nextTime, eighth);
      this.step++;
      this.nextTime += eighth;
    }
  }

  private scheduleStep(track: MusicTrack, step: number, t: number, eighth: number) {
    const ctx = this.ctx!;
    const perBar = 8;
    const bar = Math.floor(step / perBar) % track.chords.length;
    const inBar = step % perBar;
    const chord = track.chords[bar];
    const barLen = eighth * perBar;

    // pad: whole-bar soft chord
    if (inBar === 0) {
      for (const s of chord) {
        this.voice(trackFreq(track, s), t, barLen * 0.98, "sine", track.padGain / chord.length, 0.12);
      }
    }

    // bass: root on beat 1, fifth on beat 3
    if (inBar === 0) this.voice(trackFreq(track, -12), t, eighth * 3.2, "sine", track.bassGain, 0.02);
    if (inBar === 4) this.voice(trackFreq(track, -5), t, eighth * 3.2, "sine", track.bassGain, 0.02);

    // lead arpeggio
    const idx = track.leadPattern[inBar];
    if (idx >= 0) {
      const s = chord[idx % chord.length];
      this.voice(trackFreq(track, s), t, eighth * 1.7, track.lead, track.leadGain, 0.012);
    }

    // shimmer: octave-up sparkle plinks
    if (track.shimmer && (inBar === 2 || inBar === 6)) {
      const s = chord[(bar + (inBar === 6 ? 1 : 0)) % chord.length] + 24;
      this.voice(trackFreq(track, s), t, eighth * 1.1, "sine", track.leadGain * 0.5, 0.008);
    }
    void ctx;
  }

  private voice(freq: number, t: number, dur: number, type: OscillatorType, gain: number, attack: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = Math.max(30, Math.min(6000, freq));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

export const music = new MusicBox();
