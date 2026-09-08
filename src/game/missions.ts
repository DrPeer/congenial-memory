/**
 * Missions — lightweight meta goals with coin rewards, shared by web+native.
 * Hosts feed game events into MissionStore; it persists progress under
 * `kittydrop-missions` and reports freshly completed missions so the host can
 * toast + pay out.
 */
export interface MissionDef {
  id: string;
  text: string;
  goal: number;
  reward: number;
}

export const MISSIONS: MissionDef[] = [
  { id: "merge25", text: "Merge 25 kitties (total)", goal: 25, reward: 15 },
  { id: "combo3", text: "Reach a 3x combo", goal: 3, reward: 10 },
  { id: "tier6", text: "Raise a Luna (tier 6)", goal: 6, reward: 20 },
  { id: "score1500", text: "Score 1,500 in one run", goal: 1500, reward: 25 },
  { id: "booster1", text: "Use any booster", goal: 1, reward: 5 },
  { id: "survive1", text: "Clear a TOO FULL fuse", goal: 1, reward: 15 },
  { id: "win_meadow", text: "Complete Sweet Meadow", goal: 1, reward: 40 },
  { id: "win_beach", text: "Complete Sunny Shore", goal: 1, reward: 60 },
  { id: "win_hills", text: "Complete Clover Hills", goal: 1, reward: 80 },
  { id: "score5000", text: "Score 5,000 in one run", goal: 5000, reward: 40 },
  { id: "skin1", text: "Equip a custom skin from the shop", goal: 1, reward: 10 },
];

export type MissionEvent =
  | { type: "merge"; count: number }
  | { type: "combo"; value: number }
  | { type: "tier"; value: number }
  | { type: "runScore"; value: number }
  | { type: "booster" }
  | { type: "survived" }
  | { type: "win"; levelId: string }
  | { type: "equipSkin" };

export interface MissionState {
  progress: Record<string, number>;
  done: string[];
}

export class MissionStore {
  state: MissionState = { progress: {}, done: [] };
  private save: (s: MissionState) => void;

  constructor(persist: { load: () => MissionState; save: (s: MissionState) => void }) {
    this.save = persist.save;
    try {
      const s = persist.load();
      if (s && s.progress && s.done) this.state = s;
    } catch {
      /* fresh */
    }
  }

  /** apply an event; returns missions completed by it (host pays + toasts) */
  apply(ev: MissionEvent): MissionDef[] {
    const add = (id: string, v: number) => {
      const cur = this.state.progress[id] ?? 0;
      this.state.progress[id] = Math.max(cur, v);
    };
    const inc = (id: string, n = 1) => {
      this.state.progress[id] = (this.state.progress[id] ?? 0) + n;
    };
    switch (ev.type) {
      case "merge":
        inc("merge25", ev.count);
        break;
      case "combo":
        add("combo3", ev.value);
        break;
      case "tier":
        add("tier6", ev.value);
        break;
      case "runScore":
        add("score1500", ev.value);
        add("score5000", ev.value);
        break;
      case "equipSkin":
        inc("skin1");
        break;
      case "booster":
        inc("booster1");
        break;
      case "survived":
        inc("survive1");
        break;
      case "win":
        inc(`win_${ev.levelId}`);
        break;
    }
    const completed: MissionDef[] = [];
    for (const m of MISSIONS) {
      if (this.state.done.includes(m.id)) continue;
      if ((this.state.progress[m.id] ?? 0) >= m.goal) {
        this.state.done.push(m.id);
        completed.push(m);
      }
    }
    if (completed.length) this.save(this.state);
    return completed;
  }

  /** for menu lists */
  list(): Array<MissionDef & { value: number; complete: boolean }> {
    return MISSIONS.map((m) => ({
      ...m,
      value: Math.min(m.goal, this.state.progress[m.id] ?? 0),
      complete: this.state.done.includes(m.id),
    }));
  }
}
