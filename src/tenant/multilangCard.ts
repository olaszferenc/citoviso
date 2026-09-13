// ADR-0063 „Többnyelvű honlap" — the Modulok-tab card's VIEW DATA, in one place.
//
// ⛔ WHY IT LEFT public.ts (measured defect, Elek FK-005b, 2026-09-11): the card
// said NOTHING about the payment that had just happened. Before and after a
// 14 900 Ft charge the 1280×3518 page differed in three narrow stripes only (a
// message badge and the three language ticks clearing) — and the
// "Fizetés és generálás (14 900 Ft)" button stayed ACTIVE, so the buyer could not
// tell whether a click would start a SECOND order. The one green line on the card
// ("A fordítás készül") came from a generation row left behind by an EARLIER run,
// i.e. it was already there BEFORE the payment: it carried zero information about
// this purchase.
//
// The fix anchors the card on the PAYMENT, not on the generation's progress, and
// the assembly lives here so the guard (scripts/module-purchase-state-check.mts)
// can measure the very same function the admin page renders.

import { db } from "../db/client.js";
import { DEFAULT_LANG, LANG_REGIONS, langName, siteLangs } from "../i18n/lang.js";
import { MULTILANG_TIERS, multilangTier, DEFAULT_MULTILANG_TIER } from "../modules.js";
import { applyOffer, bestActiveCouponForTenant } from "../payment/offers.js";
import { getMultilangTierPrice, loadPricing } from "../pricing.js";
import { getMultilang } from "./multilangCore.js";
import type { MultilangAdminData, MultilangPaidState } from "../server/adminViews.js";
import { isSubscriptionFrozen } from "../payment/subscription.js";

// ADR-0118: a staleness threshold is a WATCHER parameter, so it lives with the
// watcher — the card only reads it, and the two can no longer drift apart.
import { MAX_MULTILANG_ATTEMPTS, MULTILANG_STALL_MINUTES } from "./multilangResume.js";
export { MAX_MULTILANG_ATTEMPTS, MULTILANG_STALL_MINUTES };

/** The latest generation of a site together with the payment that paid for it. */
export interface LatestMultilangGeneration {
  readonly genStatus: string;
  readonly error: string | null;
  readonly languages: readonly string[];
  readonly createdAt: Date;
  /** Last sign of life from the run (ADR-0118); null = it never reported in. */
  readonly heartbeatAt: Date | null;
  /** Automatic attempts already spent. */
  readonly attempts: number;
  /** When the operator alert went out — this is the "we gave up" marker. */
  readonly alertAt: Date | null;
  readonly payStatus: string | null;
  readonly paidAt: Date | null;
  readonly amount: number | null;
  readonly ref: string | null;
  /** ADR-0128: which package was bought. */
  readonly tier: string;
}

export async function latestMultilangGeneration(
  siteId: string,
): Promise<LatestMultilangGeneration | null> {
  const row = await db
    .selectFrom("multilang_generation as g")
    .leftJoin("payment as p", "p.order_intent_id", "g.order_intent_id")
    .select([
      "g.status as genStatus",
      "g.error as error",
      "g.languages as languages",
      "g.created_at as createdAt",
      "g.heartbeat_at as heartbeatAt",
      "g.attempts as attempts",
      "g.alert_at as alertAt",
      "g.tier as tier",
      "p.status as payStatus",
      "p.paid_at as paidAt",
      "p.amount as amount",
      "p.gateway_ref as ref",
    ])
    .where("g.site_id", "=", siteId)
    .orderBy("g.created_at", "desc")
    .executeTakeFirst();
  if (!row) return null;
  return {
    genStatus: row.genStatus,
    error: row.error ?? null,
    languages: (row.languages ?? []) as string[],
    createdAt: row.createdAt as unknown as Date,
    heartbeatAt: (row.heartbeatAt as unknown as Date | null) ?? null,
    attempts: row.attempts ?? 0,
    alertAt: (row.alertAt as unknown as Date | null) ?? null,
    payStatus: row.payStatus ?? null,
    paidAt: (row.paidAt as unknown as Date | null) ?? null,
    amount: row.amount ?? null,
    ref: row.ref ?? null,
    tier: row.tier ?? "alap",
  };
}

/**
 * The paid-but-not-yet-delivered state, or null. This is the fact the card was
 * missing: `payStatus === 'paid'` is the buyer's receipt — it stays true whether
 * the translation is running, stalled or failed, and it is what forbids a second
 * charge for the same thing.
 */
export function paidStateOf(
  gen: LatestMultilangGeneration | null,
  now = new Date(),
): MultilangPaidState | null {
  if (!gen || gen.payStatus !== "paid" || gen.genStatus === "done") return null;
  // ⛔ ÉLETJEL, nem indulási idő (ADR-0118). A régi mérce ("20 perce indult") egy
  // LASSÚ, de élő futást is megakadtnak mondott volna; a heartbeat a futásból jön.
  const idleMinutes = (now.getTime() - (gen.heartbeatAt ?? gen.createdAt).getTime()) / 60_000;
  // ⛔ A „feladtuk" külön fázis, mert a felület NEM ígérhet automatikus újraindítást,
  // amikor a sorozat már elfogyott és EMBER kapta meg az ügyet.
  const exhausted = gen.alertAt !== null || gen.attempts >= MAX_MULTILANG_ATTEMPTS;
  const phase = exhausted
    ? "gave_up"
    : gen.genStatus === "failed"
      ? "failed"
      : idleMinutes > MULTILANG_STALL_MINUTES
        ? "stalled"
        : "running";
  return {
    phase,
    attempts: gen.attempts,
    langs: [...gen.languages],
    langNames: gen.languages.map((l) => langName(l)),
    amount: gen.amount,
    ref: gen.ref,
    paidAt: fmtStamp(gen.paidAt ?? gen.createdAt),
    tierId: multilangTier(gen.tier).id,
  };
}

/** Local wall-clock stamp the buyer can match against their bank statement. */
function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${p(d.getMonth() + 1)}. ${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface MultilangCardInput {
  readonly siteId: string;
  readonly tenantId: string;
  /** The site's own language — it is never a purchasable target. */
  readonly primaryLang?: string | null;
  /** Public base URL of a LIVE site (language links), null otherwise. */
  readonly siteUrl?: string | null;
  /** Language codes to pre-check (restored after a failed pay redirect). */
  readonly preselect?: readonly string[];
  /** Tier to open on (restored after a failed pay redirect); default = Alap. */
  readonly tier?: string | null;
}

/**
 * A kártya KATALÓGUS-fele: mit lehet venni és mennyiért — tenant-adat nélkül, tisztán
 * a konstansokból (ADR-0128).
 *
 * ⛔ MIÉRT KÜLÖN FÜGGVÉNY: a `scripts/` NINCS a tsconfig `include`-jában (csak `src/**`),
 * ezért az őrök kézzel épített kártya-fixture-jeit a fordító NEM ellenőrzi — a
 * `shot-multilang.mts` például `: MultilangAdminData` annotációval is átment, miközben
 * hiányoztak belőle az új mezők, és három őr futásidőben szállt el. Ha mindenki EBBŐL
 * épít, egy új mező nem maradhat ki csendben.
 */
export function multilangCatalogView(primaryLang: string): {
  tiers: MultilangAdminData["tiers"];
  selectedTier: string;
  totalTargets: number;
  regions: MultilangAdminData["regions"];
  options: MultilangAdminData["options"];
} {
  const targets = siteLangs().filter((l) => l !== primaryLang);
  const options = targets.map((l) => ({ code: l, name: langName(l) }));
  const byCode = new Map(options.map((o) => [o.code, o]));
  const tiers = MULTILANG_TIERS.map((t) => {
    const cap = t.cap ?? targets.length;
    const price = getMultilangTierPrice(t);
    return {
      id: t.id,
      name: t.name,
      cap,
      isAll: t.cap === null,
      price,
      effPrice: price,
      unitPrice: cap > 0 ? Math.round(price / cap) : price,
    };
  });
  return {
    tiers,
    selectedTier: DEFAULT_MULTILANG_TIER.id,
    totalTargets: targets.length,
    regions: LANG_REGIONS.map((r) => ({
      key: r.key,
      langs: r.codes.map((c) => byCode.get(c)).filter((o): o is { code: string; name: string } => !!o),
    })).filter((r) => r.langs.length > 0),
    options,
  };
}

/** Everything the Modulok-tab multilang card renders — one query set, one truth. */
export async function multilangCardData(input: MultilangCardInput): Promise<MultilangAdminData> {
  await loadPricing();
  const primaryLang = input.primaryLang ?? DEFAULT_LANG;
  const state = await getMultilang(input.siteId);
  const gen = await latestMultilangGeneration(input.siteId);
  const paid = paidStateOf(gen);
  // ADR-0088 §6: the welcome coupon redeems on the NEXT purchase — it used to
  // apply SILENTLY at charge time while the card kept the list price (Elek
  // FK-005b H3/G1). The card must show what will actually be charged.
  const coupon = await bestActiveCouponForTenant(input.tenantId);
  // ADR-0119 ⑥: a suspended site may not be sold a new module.
  const frozen = await isSubscriptionFrozen(input.tenantId);

  // ⛔ EGY FORRÁS a célnyelvekre és a sávokra (multilangCatalogView): a picker, a
  // „Teljes" sáv kapacitása és a „Választható: N nyelv" felirat mind EBBŐL számol.
  const catalog = multilangCatalogView(primaryLang);

  // ADR-0088 §6: a bemutatkozó kupon a KÖVETKEZŐ vásárláskor számít be — korábban
  // NÉMÁN, a kártya listaára mellett (Elek FK-005b H3/G1). MINDEN sávra kiszámoljuk,
  // hogy a vevő a ténylegesen fizetendő összegeket hasonlítsa össze, ne három listaárat.
  const tiers = catalog.tiers.map((t) => {
    const effPrice = coupon ? applyOffer(t.price, coupon) : t.price;
    return {
      ...t,
      effPrice,
      unitPrice: t.cap > 0 ? Math.round(effPrice / t.cap) : effPrice,
    };
  });
  // A KIFIZETETT vásárlás a ténylegesen megvett sávra rögzíti a kártyát — különben a
  // nyugta egy csomagot nevezne meg, a kártyák meg egy másikat emelnék ki.
  const selected =
    tiers.find((t) => t.id === (paid ? multilangTier(gen?.tier).id : multilangTier(input.tier).id)) ??
    tiers.find((t) => t.id === DEFAULT_MULTILANG_TIER.id)!;

  return {
    price: selected.effPrice,
    frozen,
    couponPercent: coupon?.percent ?? null,
    couponPrice: coupon ? selected.effPrice : null,
    preselect: input.preselect ?? [],
    count: selected.cap,
    tiers,
    selectedTier: selected.id,
    totalTargets: catalog.totalTargets,
    regions: catalog.regions,
    primaryLangName: langName(primaryLang),
    options: catalog.options,
    state: state
      ? {
          languages: state.languages,
          langNames: state.languages.map((l) => langName(l)),
          status: state.status,
          generatedAt: state.generatedAt.toISOString().slice(0, 10),
        }
      : null,
    paid,
    // Kept for the (rare) unpaid-failure case; a PAID failure is reported by
    // `paid.phase === "failed"`, which also gates the button.
    failedError: !paid && gen?.genStatus === "failed" ? (gen.error ?? "ismeretlen hiba") : null,
    // Stale translations still SERVE (ADR-0063 §5: the paid state stays up), so
    // the links stay valid in both states — only on a live site (public URLs).
    langUrls:
      input.siteUrl && state
        ? state.languages.map((l) => ({ lang: l, url: `${input.siteUrl}/${l}/` }))
        : [],
  };
}

/**
 * ⛔ THE GATE IS ON THE WRITE, not on the button (ADR-0113 ⑤,
 * feedback_additive_write_is_not_a_gate): a hand-made POST must not be able to
 * buy the same generation twice. Returns the refusal reason, or null when a new
 * purchase is legitimate (never bought, or the last one was delivered).
 */
export async function multilangPurchaseBlockedReason(siteId: string): Promise<string | null> {
  const gen = await latestMultilangGeneration(siteId);
  const paid = paidStateOf(gen);
  if (!paid) return null;
  // A visszautasítás INDOKA is igaz legyen, ne csak a tény (ADR-0118): amíg van
  // hátra próbálkozás, a rendszer tényleg újraindítja; utána ember viszi tovább.
  switch (paid.phase) {
    case "running":
      return "ezt a generálást már kifizette — a fordítás készül, újra fizetnie nem kell";
    case "gave_up":
      return "ezt a generálást már kifizette, de a generálás többszöri próbálkozás után sem sikerült — munkatársunk már tud róla és keresi Önt, újra fizetnie nem kell";
    default:
      return "ezt a generálást már kifizette, de a generálás elakadt — a rendszer automatikusan újraindítja, újra fizetnie nem kell";
  }
}
