/**
 * Music spec — ONE source of truth for the background tracks.
 *
 * The web host synthesises these live (src/game/music.ts, WebAudio scheduler);
 * the native host plays pre-rendered loops (scripts/gen-music.mjs reads THIS
 * file through esbuild and writes mobile/assets/music/*.wav). Same chords,
 * same tempo, same vibe on both platforms.
 *
 * Tracks are keyed by screen/map: "menu" + one per level id.
 */
export interface MusicTrack {
  id: string;
  bpm: number;
  /** tonic frequency in Hz */
  rootHz: number;
  /** one chord per bar: semitone offsets from the root (may be negative) */
  chords: number[][];
  /** lead timbre */
  lead: "triangle" | "sine" | "square";
  /** 8 eighth-note slots per bar: index into the chord, -1 = rest */
  leadPattern: number[];
  /** sparkle arpeggio an octave up on the off-beats */
  shimmer: boolean;
  padGain: number;
  leadGain: number;
  bassGain: number;
}

export const MUSIC_TRACKS: Record<string, MusicTrack> = {
  // cosy music-box waltz for the menu / splash
  menu: {
    id: "menu",
    bpm: 92,
    rootHz: 261.63, // C4
    chords: [
      [0, 4, 7, 11], // Cmaj7
      [9, 12, 16, 19], // Am9
      [5, 9, 12, 16], // Fmaj7
      [7, 11, 14, 17], // G7
    ],
    lead: "triangle",
    leadPattern: [0, -1, 1, 2, -1, 1, -1, 2],
    shimmer: true,
    padGain: 0.05,
    leadGain: 0.075,
    bassGain: 0.11,
  },
  // bright pastoral loop — Sweet Meadow
  meadow: {
    id: "meadow",
    bpm: 104,
    rootHz: 349.23, // F4
    chords: [
      [0, 4, 7], // F
      [9, 12, 16], // Dm
      [5, 9, 12], // Bb
      [7, 11, 14], // C
    ],
    lead: "sine",
    leadPattern: [0, 1, -1, 2, 1, -1, 2, -1],
    shimmer: true,
    padGain: 0.055,
    leadGain: 0.085,
    bassGain: 0.12,
  },
  // breezy bossa — Sunny Shore (level id: beach)
  beach: {
    id: "beach",
    bpm: 112,
    rootHz: 293.66, // D4
    chords: [
      [0, 4, 7, 11], // Dmaj7
      [-3, 0, 4, 7], // Bm7
      [5, 9, 12, 16], // Gmaj7
      [7, 11, 14, 17], // A7
    ],
    lead: "sine",
    leadPattern: [0, -1, 2, -1, 1, -1, 3, -1],
    shimmer: false,
    padGain: 0.06,
    leadGain: 0.08,
    bassGain: 0.12,
  },
  // mysterious music-box — Clover Hills (level id: hills)
  hills: {
    id: "hills",
    bpm: 88,
    rootHz: 196.0, // G3
    chords: [
      [0, 3, 7], // Gm
      [-4, 0, 3], // Eb
      [3, 7, 10], // Bb
      [-2, 2, 5], // F
    ],
    lead: "square",
    leadPattern: [0, -1, 1, -1, 2, 1, -1, -1],
    shimmer: true,
    padGain: 0.045,
    leadGain: 0.05,
    bassGain: 0.1,
  },
};

/** theme-id → level-id aliases, so any host key resolves to the map track */
const TRACK_ALIASES: Record<string, string> = {
  "sunny-shore": "beach",
  shore: "beach",
  "clover-hills": "hills",
};

export function musicTrackFor(id: string): MusicTrack {
  const key = TRACK_ALIASES[id] ?? id;
  return MUSIC_TRACKS[key] ?? MUSIC_TRACKS.menu;
}

/** semitone offset -> frequency for a track */
export function trackFreq(track: MusicTrack, semitone: number): number {
  return track.rootHz * Math.pow(2, semitone / 12);
}

/** total loop length in seconds (bars × 4 beats) */
export function trackSeconds(track: MusicTrack): number {
  return (track.chords.length * 4 * 60) / track.bpm;
}
