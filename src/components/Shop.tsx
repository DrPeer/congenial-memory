/**
 * Shop — cat-coin store (web): coin packs via the purchase seam, cosmetic
 * skins (themes / baskets / merge trails) bought with coins, equip instantly.
 * Native twin: mobile/src/native/ShopModal.tsx.
 */
import { useState } from "react";
import { getPurchaseProvider } from "../game/purchases";
import { COIN_PACKS, CUP_SKINS, SHOP_THEMES, TRAILS, type Equip } from "../game/shop";
import type { SpriteId } from "../game/sprites";
import Icon from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  coins: number;
  spend: (n: number) => boolean;
  grant: (n: number) => void;
  owned: string[];
  setOwned: (ids: string[]) => void;
  equip: Equip;
  setEquip: (e: Equip) => void;
  themeId: string;
  pickTheme: (id: string) => void;
}

export default function Shop({ open, onClose, coins, spend, grant, owned, setOwned, equip, setEquip, themeId, pickTheme }: Props) {
  const [checkout, setCheckout] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!open) return null;

  const buy = (id: string, price: number, kind: "theme" | "cup" | "trail") => {
    if (owned.includes(id) || !spend(price)) return;
    setOwned([...owned, id]);
    setNote(`Unlocked! Equip it below.`);
    if (kind === "cup") setEquip({ ...equip, cup: id });
    if (kind === "trail") setEquip({ ...equip, trail: id });
    if (kind === "theme") pickTheme(id);
    window.setTimeout(() => setNote(null), 2500);
  };

  const buyPack = async (packId: string, amount: number) => {
    const provider = getPurchaseProvider();
    const pack = COIN_PACKS.find((p) => p.id === packId);
    if (!pack || checkout) return;
    setCheckout(packId);
    const ok = await provider.purchase(pack);
    setCheckout(null);
    if (ok) {
      grant(amount);
      setNote(`+${amount} coins added!`);
      window.setTimeout(() => setNote(null), 2500);
    }
  };

  const Row = ({
    icon,
    name,
    blurb,
    right,
  }: {
    icon: SpriteId;
    name: string;
    blurb: string;
    right: React.ReactNode;
  }) => (
    <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-2.5 shadow-sm">
      <Icon id={icon} size={34} />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-bold text-[#7a3b55]">{name}</div>
        <div className="truncate text-[11px] text-[#a0506e]">{blurb}</div>
      </div>
      {right}
    </div>
  );

  const PriceBtn = ({ label, onClick, disabled }: { label: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-cute flex shrink-0 items-center gap-1 bg-[#ffd76a] px-3 py-1.5 text-xs font-bold text-[#7a5210] disabled:opacity-40"
    >
      {label}
    </button>
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#7a3b55]/40 p-4 backdrop-blur-[2px]">
      <div className="anim-pop max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-[28px] border-4 border-white bg-gradient-to-b from-white to-[#ffeaf2] p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-[#7a3b55]">
            <Icon id="basket" size={26} /> SHOP
          </h2>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[#ffd76a] px-3 py-1 text-sm font-bold text-[#7a5210]">
              <Icon id="coin" size={14} /> {coins.toLocaleString()}
            </span>
            <button onClick={onClose} className="btn-cute flex h-11 w-11 items-center justify-center bg-white">
              <Icon id="home" size={20} />
            </button>
          </div>
        </div>
        {note && (
          <div className="mb-2 rounded-xl bg-[#7ed08a] px-3 py-1.5 text-center text-xs font-bold text-white">{note}</div>
        )}

        {/* coin packs */}
        <div className="mb-1 mt-2 text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">COIN PACKS</div>
        <div className="flex flex-col gap-2">
          {COIN_PACKS.map((p) => (
            <Row
              key={p.id}
              icon="coin"
              name={`${p.label} · ${p.coins.toLocaleString()}`}
              blurb="Top up with real money (test-mode checkout today)"
              right={
                <button
                  onClick={() => void buyPack(p.id, p.coins)}
                  disabled={!!checkout}
                  className="btn-cute shrink-0 bg-[#57c6ff] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  ${p.priceUsd}
                </button>
              }
            />
          ))}
        </div>

        {/* theme skins */}
        <div className="mb-1 mt-3 text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">THEME SKINS</div>
        <div className="flex flex-col gap-2">
          {SHOP_THEMES.map((st) => {
            const has = owned.includes(st.theme.id);
            const active = themeId === st.theme.id;
            return (
              <Row
                key={st.theme.id}
                icon={st.icon}
                name={st.theme.name}
                blurb={st.blurb}
                right={
                  has ? (
                    <button
                      onClick={() => pickTheme(st.theme.id)}
                      className={`btn-cute shrink-0 px-3 py-1.5 text-xs font-bold ${active ? "bg-[#ff8fb0] text-white" : "bg-white text-[#a0506e]"}`}
                    >
                      {active ? "ON" : "USE"}
                    </button>
                  ) : (
                    <PriceBtn
                      label={
                        <>
                          <Icon id="coin" size={11} /> {st.price}
                        </>
                      }
                      onClick={() => buy(st.theme.id, st.price, "theme")}
                      disabled={coins < st.price}
                    />
                  )
                }
              />
            );
          })}
        </div>

        {/* basket skins */}
        <div className="mb-1 mt-3 text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">BASKETS</div>
        <div className="flex flex-col gap-2">
          {CUP_SKINS.map((c) => {
            const has = owned.includes(c.id);
            const active = equip.cup === c.id;
            return (
              <Row
                key={c.id}
                icon={c.icon}
                name={c.name}
                blurb={c.blurb}
                right={
                  has ? (
                    <button
                      onClick={() => setEquip({ ...equip, cup: active ? undefined : c.id })}
                      className={`btn-cute shrink-0 px-3 py-1.5 text-xs font-bold ${active ? "bg-[#ff8fb0] text-white" : "bg-white text-[#a0506e]"}`}
                    >
                      {active ? "ON" : "USE"}
                    </button>
                  ) : (
                    <PriceBtn
                      label={
                        <>
                          <Icon id="coin" size={11} /> {c.price}
                        </>
                      }
                      onClick={() => buy(c.id, c.price, "cup")}
                      disabled={coins < c.price}
                    />
                  )
                }
              />
            );
          })}
        </div>

        {/* merge trails */}
        <div className="mb-1 mt-3 text-[10px] font-bold tracking-[0.25em] text-[#c46b8f]">MERGE TRAILS</div>
        <div className="flex flex-col gap-2">
          {TRAILS.map((t) => {
            const has = owned.includes(t.id);
            const active = equip.trail === t.id;
            return (
              <Row
                key={t.id}
                icon={t.icon}
                name={t.name}
                blurb={t.blurb}
                right={
                  has ? (
                    <button
                      onClick={() => setEquip({ ...equip, trail: active ? undefined : t.id })}
                      className={`btn-cute shrink-0 px-3 py-1.5 text-xs font-bold ${active ? "bg-[#ff8fb0] text-white" : "bg-white text-[#a0506e]"}`}
                    >
                      {active ? "ON" : "USE"}
                    </button>
                  ) : (
                    <PriceBtn
                      label={
                        <>
                          <Icon id="coin" size={11} /> {t.price}
                        </>
                      }
                      onClick={() => buy(t.id, t.price, "trail")}
                      disabled={coins < t.price}
                    />
                  )
                }
              />
            );
          })}
        </div>

        <div className="mt-3 rounded-xl bg-white/70 p-2 text-center text-[10px] font-semibold text-[#a0506e]">
          Earn coins free by playing missions & merges — or top up in the store.
        </div>
      </div>

      {/* simulated checkout overlay */}
      {checkout && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2b2233]/80 p-6 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-xs rounded-[28px] border-4 border-white bg-white p-6 text-center shadow-2xl">
            <Icon id="coin" size={56} />
            <div className="mt-3 text-lg font-bold text-[#4a3b55]">Processing purchase…</div>
            <div className="mt-2 text-[11px] font-bold tracking-wide text-[#b0a8b8]">
              {getPurchaseProvider().modeLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
