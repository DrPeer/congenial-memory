/**
 * Ads — the revive/retry ad slot. Today a cute simulated sponsor reel runs
 * (no ad network exists for Expo Go / plain web previews); the provider seam
 * below is where a real SDK (AdMob on a dev build, AdSense on web) plugs in
 * later without touching game code.
 */
export const AD_SECONDS = 8;

export interface FakeAd {
  emoji: string;
  title: string;
  tagline: string;
}

export const FAKE_ADS: FakeAd[] = [
  { emoji: "🐟", title: "Tuna Crunchies", tagline: "The snack your cat secretly demands." },
  { emoji: "🧶", title: "YarnBnB", tagline: "Cozy balls of yarn, rented by the hour." },
  { emoji: "📦", title: "BoxFort", tagline: "If it fits, they sits. Guaranteed." },
  { emoji: "🥛", title: "Milk & Co.", tagline: "Fresh cream for distinguished chonks." },
];

export function pickFakeAd(seed = Math.random()): FakeAd {
  return FAKE_ADS[Math.floor(seed * FAKE_ADS.length) % FAKE_ADS.length];
}

/** Future real-ad seam: implement show() to resolve true when the ad completes. */
export interface AdProvider {
  show(): Promise<boolean>;
}

/** Default: resolves after the host's simulated reel finishes (host times it). */
export class SimulatedAdProvider implements AdProvider {
  show(): Promise<boolean> {
    return new Promise((res) => setTimeout(() => res(true), AD_SECONDS * 1000));
  }
}
