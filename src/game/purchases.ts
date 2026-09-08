/**
 * Purchases — the real-money seam for coin packs.
 *
 * Today: SimulatedCheckout runs a clearly-labelled TEST-MODE checkout (no money
 * moves; this sandbox has no store accounts or payment backend).
 *
 * To go live later, implement PurchaseProvider with:
 *  - native: RevenueCat or expo-iap (needs a dev build + App Store / Play
 *    console products matching COIN_PACKS ids)
 *  - web:    Stripe Checkout / Payment Links (needs a tiny backend)
 * and swap it in via setPurchaseProvider(). Game/shop code never changes.
 */
import { COIN_PACKS, type CoinPack } from "./shop";

export interface PurchaseProvider {
  /** resolves true when the purchase completed and coins may be granted */
  purchase(pack: CoinPack): Promise<boolean>;
  /** shown in the checkout UI so testers always know the mode */
  readonly modeLabel: string;
}

export class SimulatedCheckout implements PurchaseProvider {
  readonly modeLabel = "SANDBOX TEST MODE — no real charge";
  purchase(_pack: CoinPack): Promise<boolean> {
    return new Promise((res) => setTimeout(() => res(true), 2200));
  }
}

let provider: PurchaseProvider = new SimulatedCheckout();

export function setPurchaseProvider(p: PurchaseProvider) {
  provider = p;
}
export function getPurchaseProvider(): PurchaseProvider {
  return provider;
}
export function getPack(id: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.id === id);
}
