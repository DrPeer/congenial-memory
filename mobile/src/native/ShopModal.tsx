/**
 * ShopModal — native twin of the web Shop: coin packs (test-mode checkout),
 * theme / basket / trail skins bought with coins, equip instantly.
 */
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getPurchaseProvider } from "../../../src/game/purchases";
import { COIN_PACKS, CUP_SKINS, SHOP_THEMES, TRAILS, type Equip } from "../../../src/game/shop";
import Icon from "./Icon";

interface Props {
  visible: boolean;
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

function Row({ icon, name, blurb, right }: { icon: string; name: string; blurb: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Icon id={icon} size={30} />
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowBlurb} numberOfLines={1}>
          {blurb}
        </Text>
      </View>
      {right}
    </View>
  );
}

export default function ShopModal({ visible, onClose, coins, spend, grant, owned, setOwned, equip, setEquip, themeId, pickTheme }: Props) {
  const [checkout, setCheckout] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 2500);
  };

  const buy = (id: string, price: number, kind: "theme" | "cup" | "trail") => {
    if (owned.includes(id) || !spend(price)) return;
    setOwned([...owned, id]);
    flash("Unlocked! Equipped for you.");
    if (kind === "cup") setEquip({ ...equip, cup: id });
    if (kind === "trail") setEquip({ ...equip, trail: id });
    if (kind === "theme") pickTheme(id);
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
      flash(`+${amount} coins added!`);
    }
  };

  const UseBtn = ({ active, onPress }: { active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.useBtn, active && styles.useBtnActive]}>
      <Text style={[styles.useBtnText, active && styles.useBtnTextActive]}>{active ? "ON" : "USE"}</Text>
    </Pressable>
  );

  const CoinBtn = ({ price, onPress, disabled }: { price: number; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.coinBtn, disabled && { opacity: 0.4 }]}>
      <Icon id="coin" size={12} />
      <Text style={styles.coinBtnText}> {price}</Text>
    </Pressable>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon id="basket" size={22} />
              <Text style={styles.title}> SHOP</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.coinChip}>
                <Icon id="coin" size={13} />
                <Text style={styles.coinChipText}> {coins.toLocaleString()}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Icon id="home" size={18} />
              </Pressable>
            </View>
          </View>

          {note && <Text style={styles.note}>{note}</Text>}

          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            <Section title="COIN PACKS">
              {COIN_PACKS.map((p) => (
                <Row
                  key={p.id}
                  icon="coin"
                  name={`${p.label} · ${p.coins.toLocaleString()}`}
                  blurb="Top up with real money (test-mode checkout today)"
                  right={
                    <Pressable
                      onPress={() => void buyPack(p.id, p.coins)}
                      disabled={!!checkout}
                      style={[styles.packBtn, !!checkout && { opacity: 0.4 }]}
                    >
                      <Text style={styles.packBtnText}>${p.priceUsd}</Text>
                    </Pressable>
                  }
                />
              ))}
            </Section>

            <Section title="THEME SKINS">
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
                        <UseBtn active={active} onPress={() => pickTheme(st.theme.id)} />
                      ) : (
                        <CoinBtn price={st.price} onPress={() => buy(st.theme.id, st.price, "theme")} disabled={coins < st.price} />
                      )
                    }
                  />
                );
              })}
            </Section>

            <Section title="BASKETS">
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
                        <UseBtn active={active} onPress={() => setEquip({ ...equip, cup: active ? undefined : c.id })} />
                      ) : (
                        <CoinBtn price={c.price} onPress={() => buy(c.id, c.price, "cup")} disabled={coins < c.price} />
                      )
                    }
                  />
                );
              })}
            </Section>

            <Section title="MERGE TRAILS">
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
                        <UseBtn active={active} onPress={() => setEquip({ ...equip, trail: active ? undefined : t.id })} />
                      ) : (
                        <CoinBtn price={t.price} onPress={() => buy(t.id, t.price, "trail")} disabled={coins < t.price} />
                      )
                    }
                  />
                );
              })}
            </Section>

            <Text style={styles.footnote}>Earn coins free by playing missions & merges — or top up in the store.</Text>
          </ScrollView>
        </View>

        {checkout && (
          <View style={styles.checkout}>
            <View style={styles.checkoutCard}>
              <Icon id="coin" size={52} />
              <ActivityIndicator size="large" color="#ff8fb0" style={{ marginTop: 12 }} />
              <Text style={styles.checkoutTitle}>Processing purchase…</Text>
              <Text style={styles.checkoutSub}>{getPurchaseProvider().modeLabel}</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(122,59,85,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    borderRadius: 26,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#fff4f9",
    padding: 14,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#7a3b55" },
  coinChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffd76a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  coinChipText: { fontWeight: "800", color: "#7a5210", fontSize: 13 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  note: { backgroundColor: "#7ed08a", color: "#fff", fontWeight: "800", fontSize: 12, textAlign: "center", borderRadius: 12, paddingVertical: 6, marginBottom: 8 },
  section: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: "#c46b8f", marginTop: 10, marginBottom: 6 },
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 16, padding: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 13, fontWeight: "800", color: "#7a3b55" },
  rowBlurb: { fontSize: 10, color: "#a0506e" },
  packBtn: { backgroundColor: "#57c6ff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  packBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  coinBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffd76a", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  coinBtnText: { color: "#7a5210", fontWeight: "800", fontSize: 12 },
  useBtn: { backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 52, alignItems: "center" },
  useBtnActive: { backgroundColor: "#ff8fb0" },
  useBtnText: { color: "#a0506e", fontWeight: "800", fontSize: 12 },
  useBtnTextActive: { color: "#fff" },
  footnote: { fontSize: 10, fontWeight: "700", color: "#a0506e", textAlign: "center", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 8, marginTop: 12 },
  checkout: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(43,34,51,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  checkoutCard: { width: "100%", maxWidth: 280, borderRadius: 26, borderWidth: 4, borderColor: "#fff", backgroundColor: "#fff", padding: 24, alignItems: "center" },
  checkoutTitle: { marginTop: 12, fontSize: 16, fontWeight: "800", color: "#4a3b55", textAlign: "center" },
  checkoutSub: { marginTop: 6, fontSize: 11, fontWeight: "700", color: "#b0a8b8", textAlign: "center" },
});
