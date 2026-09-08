#!/usr/bin/env node
/**
 * gen-music.mjs — renders the shared background-music specs
 * (src/game/musicSpec.ts) to seamless looping WAVs for the NATIVE app
 * (expo-audio has no WebAudio scheduler). The web build plays the same spec
 * live through src/game/music.ts — one source of truth, two platforms.
 *
 *   node scripts/gen-music.mjs   ->  mobile/assets/music/*.wav
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const OUT = path.join(ROOT, "mobile", "assets", "music");
const FS = 22050;

/* ---- load the shared spec through esbuild (TS -> ESM, single source) ---- */
const tmp = mkdtempSync(path.join(tmpdir(), "kd-music-"));
const specOut = path.join(tmp, "musicSpec.mjs");
execFileSync(
  path.join(ROOT, "node_modules", "esbuild", "bin", "esbuild"),
  [
    path.join(ROOT, "src", "game", "musicSpec.ts"),
    "--bundle",
    "--format=esm",
    `--outfile=${specOut}`,
    "--log-level=error",
  ],
  { stdio: "inherit" },
);
const { MUSIC_TRACKS, trackFreq, trackSeconds } = await import(specOut);

/* ------------------------------------------------------------ rendering */

function renderTrack(track) {
  const secs = trackSeconds(track);
  const len = Math.round(secs * FS);
  const buf = new Float64Array(len);
  const eighth = 60 / track.bpm / 2;

  const addVoice = (startSec, durSec, sampleFn, gain) => {
    const start = Math.round(startSec * FS);
    const n = Math.round(durSec * FS);
    for (let i = 0; i < n; i++) {
      // wrap tails around the loop point so the WAV loops seamlessly
      buf[(start + i) % len] += sampleFn(i / FS, i / n) * gain;
    }
  };

  const env = (attack) => (t, k) => {
    if (t < attack) return t / attack;
    return Math.pow(1 - k, 1.6);
  };

  const steps = track.chords.length * 8;
  for (let step = 0; step < steps; step++) {
    const bar = Math.floor(step / 8) % track.chords.length;
    const inBar = step % 8;
    const chord = track.chords[bar];
    const t0 = step * eighth;
    const barLen = eighth * 8;

    // pad
    if (inBar === 0) {
      for (const s of chord) {
        const f = trackFreq(track, s);
        let ph = 0;
        addVoice(t0, barLen * 0.98, (t, k) => {
          ph += (2 * Math.PI * f) / FS;
          const e = t < barLen * 0.18 ? t / (barLen * 0.18) : Math.pow(1 - k, 0.8);
          return Math.sin(ph) * e;
        }, track.padGain / chord.length);
      }
    }
    // bass: root beat 1, fifth beat 3
    if (inBar === 0 || inBar === 4) {
      const f = trackFreq(track, inBar === 0 ? -12 : -5);
      let ph = 0;
      addVoice(t0, eighth * 3.2, (t) => {
        ph += (2 * Math.PI * f) / FS;
        return Math.sin(ph) * Math.exp(-t * 2.2) * Math.min(1, t / 0.02);
      }, track.bassGain);
    }
    // lead arpeggio
    const idx = track.leadPattern[inBar];
    if (idx >= 0) {
      const f = trackFreq(track, chord[idx % chord.length]);
      const dur = eighth * 1.7;
      let ph = 0;
      addVoice(t0, dur, (t, k) => {
        ph += (2 * Math.PI * f) / FS;
        const wave =
          track.lead === "sine"
            ? Math.sin(ph)
            : track.lead === "triangle"
              ? Math.sin(ph) - Math.sin(3 * ph) / 9 + Math.sin(5 * ph) / 25
              : Math.sin(ph) + Math.sin(3 * ph) / 3.6 + Math.sin(5 * ph) / 6.5;
        return wave * env(0.012)(t, k);
      }, track.leadGain);
    }
    // shimmer
    if (track.shimmer && (inBar === 2 || inBar === 6)) {
      const s = chord[(bar + (inBar === 6 ? 1 : 0)) % chord.length] + 24;
      const f = trackFreq(track, s);
      let ph = 0;
      addVoice(t0, eighth * 1.1, (t, k) => {
        ph += (2 * Math.PI * f) / FS;
        return Math.sin(ph) * env(0.008)(t, k);
      }, track.leadGain * 0.5);
    }
  }

  // gentle soft-clip
  for (let i = 0; i < len; i++) buf[i] = Math.tanh(buf[i]) * 0.92;
  return buf;
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
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * scale)) * 32767), 44 + i * 2);
  }
  return bytes;
}

mkdirSync(OUT, { recursive: true });
const files = [];
for (const track of Object.values(MUSIC_TRACKS)) {
  const name = `${track.id}.wav`;
  writeFileSync(path.join(OUT, name), wav(renderTrack(track)));
  files.push(name);
}
console.log(`✔ wrote ${files.length} music loops → mobile/assets/music/ (${files.join(", ")})`);
