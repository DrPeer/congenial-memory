/**
 * Native mission store singleton: same MissionStore logic as web, persisted in
 * AsyncStorage with a synchronous in-memory cache (MissionStore loads sync).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { MissionStore, type MissionState } from "../../../src/game/missions";

const KEY = "kittydrop-missions";
let cache: MissionState | null = null;

export const missionStore = new MissionStore({
  load: () => cache ?? { progress: {}, done: [] },
  save: (s) => {
    cache = s;
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  },
});

/** call once at app start; merges persisted progress if nothing happened yet */
export function hydrateMissions(): Promise<void> {
  return AsyncStorage.getItem(KEY)
    .then((v) => {
      if (!v) return;
      if (Object.keys(missionStore.state.progress).length === 0) {
        const parsed = JSON.parse(v) as MissionState;
        cache = parsed;
        missionStore.state = parsed;
      }
    })
    .catch(() => {});
}
