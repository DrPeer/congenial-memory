#!/usr/bin/env node
/**
 * gen-sounds.mjs — renders the game's synthesised sounds to WAV assets so the
 * NATIVE app can play them with expo-audio (React Native has no WebAudio).
 *
 * The math mirrors src/game/sound.ts (the web WebAudio graph): same envelopes,
 * same oscillator stacks, same lowpass sweep (+ vibrato), approximated with a
 * per-sample RBJ biquad. Web keeps using live WebAudio; native uses these files.
 *
 *   node scripts/gen-sounds.mjs     ->  mobile/assets/sounds/*.wav
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const OUT = path.join(ROOT, "mobile", "assets", "sounds");
const FS = 22050;

/* cat meow pitches/points copied from src/game/cats.ts (kept in sync by hand) */
const MEOW_PITCH = [1.55, 1.4, 1.28, 1.15, 1.05, 0.95, 0.85, 0.75, 0.68, 0.6, 0.5];

const expAt = (anchors, t) => {
  // anchors: [[time, value], ...] exponential interpolation between them
  if (t <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [t0, v0] = anchors[i];
    const [t1, v1] = anchors[i + 1];
    if (t <= t1) {
      const k = (t - t0) / Math.max(1e-9, t1 - t0);
      return v0 * Math.pow(v1 / v0, k);
    }
  }
  return anchors[anchors.length - 1][1];
};

function biquadLowpassCoeffs(fc, q, fs) {
  const w0 = (2 * Math.PI * Math.max(20, fc)) / fs;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cw) / 2) / a0,
    b1: (1 - cw) / a0,
    b2: ((1 - cw) / 2) / a0,
    a1: (-2 * cw) / a0,
    a2: (1 - alpha) / a0,
  };
}

function render(dur, sample) {
  const n = Math.ceil(dur * FS);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = sample(i / FS);
  return out;
}

function mixBuffers(list) {
  const len = Math.max(...list.map((b) => b.length));
  const out = new Float64Array(len);
  for (const b of list) for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

function wav(buf) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const scale = peak > 0.98 ? 0.98 / peak : 1;
  const n = buf.length;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + n * 2, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(FS, 24);
  bytes.writeUInt32LE(FS * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, buf[i] * scale));
    bytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return bytes;
}

/* ------------------------------------------------------------------ voices */

function meow(pitch, volume) {
  const dur = 0.42 + (1 - Math.min(pitch, 1.5)) * 0.25;
  const base = 520 * pitch;
  const gainEnv = (t) => {
    if (t < 0.06) return expAt([[0, 0.0001], [0.06, volume]], t);
    if (t < dur * 0.55) return volume;
    return expAt([[dur * 0.55, volume], [dur, 0.0001]], t);
  };
  const voice = (type, mult, g) => {
    const f = base * mult;
    const anchors = [[0, f * 0.85], [dur * 0.3, f * 1.35], [dur * 0.6, f * 1.15], [dur, f * 0.7]];
    let phase = 0;
    return render(dur + 0.05, (t) => {
      const fr = expAt(anchors, t);
      phase += (2 * Math.PI * fr) / FS;
      const frac = (phase / (2 * Math.PI)) % 1;
      let s = 0;
      if (type === "sawtooth") s = 2 * frac - 1;
      else if (type === "triangle") s = 1 - 4 * Math.abs(frac - 0.5);
      else s = Math.sin(phase);
      return s * g;
    });
  };
  const dry = mixBuffers([voice("sawtooth", 1, 0.6), voice("triangle", 2.01, 0.35), voice("sine", 1, 0.5)]);
  // lowpass with sweeping cutoff + 9Hz vibrato on the cutoff
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const filtered = render(dry.length / FS, (t) => {
    const fc = expAt([[0, 1400 * Math.sqrt(pitch)], [dur, 900 * Math.sqrt(pitch)]], t) + 8 * pitch * Math.sin(2 * Math.PI * 9 * t);
    const c = biquadLowpassCoeffs(fc, 3, FS);
    const x = dry[Math.min(dry.length - 1, Math.round(t * FS))] || 0;
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  });
  return render(filtered.length / FS, (t) => filtered[Math.round(t * FS)] * gainEnv(t));
}

function pop(pitch) {
  let phase = 0;
  return render(0.16, (t) => {
    const f = expAt([[0, 380 * pitch], [0.12, 140 * pitch]], t);
    phase += (2 * Math.PI * f) / FS;
    const g = expAt([[0, 0.18], [0.14, 0.0001]], t);
    return Math.sin(phase) * g;
  });
}

function toneSeq(freqs, { type, gain, step, attack, decay, mult = 1 }) {
  const total = step * (freqs.length - 1) + decay + 0.05;
  return render(total, (t) => {
    let out = 0;
    freqs.forEach((f0, i) => {
      const s = i * step;
      if (t < s || t > s + decay) return;
      const lt = t - s;
      const g = lt < attack ? expAt([[0, 0.0001], [attack, gain]], lt) : expAt([[attack, gain], [decay, 0.0001]], lt);
      const f = f0 * mult;
      let v = 0;
      const ph = 2 * Math.PI * f * lt;
      if (type === "triangle") {
        const frac = (f * lt) % 1;
        v = 1 - 4 * Math.abs(frac - 0.5);
      } else if (type === "square") {
        v = ((f * lt) % 1) < 0.5 ? 1 : -1;
      } else v = Math.sin(ph);
      out += v * g;
    });
    return out;
  });
}

const chime = (combo) => {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  const count = Math.min(notes.length, 2 + combo);
  return toneSeq(notes.slice(0, count), { type: "triangle", gain: 0.12, step: 0.06, attack: 0.02, decay: 0.35, mult: 1 + combo * 0.02 });
};
const fanfare = () => toneSeq([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5], { type: "square", gain: 0.07, step: 0.11, attack: 0.02, decay: 0.25 });
const sad = () => toneSeq([440, 392, 349.23, 293.66], { type: "triangle", gain: 0.12, step: 0.22, attack: 0.03, decay: 0.4 });

/* ------------------------------------------------------------------ write */

mkdirSync(OUT, { recursive: true });
const files = [];
MEOW_PITCH.forEach((p, i) => {
  const name = `meow${String(i).padStart(2, "0")}.wav`;
  writeFileSync(path.join(OUT, name), wav(meow(p, 0.18 + i * 0.012)));
  files.push(name);
});
MEOW_PITCH.forEach((_, i) => {
  const name = `pop${String(i).padStart(2, "0")}.wav`;
  writeFileSync(path.join(OUT, name), wav(pop(1.2 - i * 0.08)));
  files.push(name);
});
for (let c = 2; c <= 8; c++) {
  const name = `chime${String(c).padStart(2, "0")}.wav`;
  writeFileSync(path.join(OUT, name), wav(chime(c)));
  files.push(name);
}
writeFileSync(path.join(OUT, "fanfare.wav"), wav(fanfare()));
writeFileSync(path.join(OUT, "sad.wav"), wav(sad()));
files.push("fanfare.wav", "sad.wav");

console.log(`✔ wrote ${files.length} wav assets → mobile/assets/sounds/ (${files.join(", ").slice(0, 120)}…)`);
