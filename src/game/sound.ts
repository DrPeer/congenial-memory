class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  /** A synthesized kitty meow. pitch 1 = normal; bigger cats use lower pitch. */
  meow(pitch = 1, volume = 0.22) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 520 * pitch;
    const dur = 0.42 + (1 - Math.min(pitch, 1.5)) * 0.25;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.06);
    gain.gain.setValueAtTime(volume, t + dur * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400 * Math.sqrt(pitch), t);
    filter.frequency.exponentialRampToValueAtTime(900 * Math.sqrt(pitch), t + dur);
    filter.Q.value = 3;

    const voice = (type: OscillatorType, mult: number, g: number) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      const f = base * mult;
      osc.frequency.setValueAtTime(f * 0.85, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + dur * 0.3);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + dur * 0.6);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
      const og = ctx.createGain();
      og.gain.value = g;
      osc.connect(og).connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    };
    voice("sawtooth", 1, 0.6);
    voice("triangle", 2.01, 0.35);
    voice("sine", 1, 0.5);

    // vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 8 * pitch;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);

    filter.connect(gain).connect(ctx.destination);
  }

  pop(pitch = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  chime(combo = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const count = Math.min(notes.length, 2 + combo);
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = notes[i] * (1 + combo * 0.02);
      const g = ctx.createGain();
      const s = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
      osc.connect(g).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.4);
    }
  }

  fanfare() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.07, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.3);
    });
  }

  sad() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [440, 392, 349.23, 293.66];
    seq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.22;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.12, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.4);
      osc.connect(g).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.45);
    });
  }
}

export const sfx = new Sfx();
