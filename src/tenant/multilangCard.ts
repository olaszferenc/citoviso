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
import { DEFAULT_LANG, langName, supportedLangs } from "../i18n/lang.js";
import { MULTILANG_LANG_COUNT } from "../modules.js";
import { applyOffer, bestActiveCouponForTenant } from "../payment/offers.js";
import { getOneTimePrice, loadPricing } from "../pricing.js";
import { getMultilang } from "./multilangCore.js";
import type { MultilangAdminData, MultilangPaidState } from "../server/adminViews.js";

/**
 * A paid generation that has not finished within this many minutes is STALLED:
 * the work runs detached in the server process, so a restart (or a crash) kills
 * it and leaves the row on 'generating' forever — measured twice in the dev park.
 * The card must not keep promising "a few minutes" in that case; it says the
 * truth (megakadt) and still refuses a second charge, because the money is in.
 */
export const MULTILANG_STALL_MINUTES = 20;

/** The latest generation of a site together with the payment that paid for it. */
export interface LatestMultilangGeneration {
  readonly genStatus: string;
  readonly error: string | null;
  readonly languages: readonly string[];
  readonly createdAt: Date;
  readonly payStatus: string | null;
  readonly paidAt: Date | null;
  readonly amount: number | null;
  readonly ref: string | null;
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
    payStatus: row.payStatus ?? null,
    paidAt: (row.paidAt as unknown as Date | null) ?? null,
    amount: row.amount ?? null,
    ref: row.ref ?? null,
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
  const startedMinutes = (now.getTime() - gen.createdAt.getTime()) / 60_000;
  const phase =
    gen.genStatus === "failed"
      ? "failed"
      : startedMinutes > MULTILANG_STALL_MINUTES
        ? "stalled"
        : "running";
  return {
    phase,
    langs: [...gen.languages],
    langNames: gen.languages.map((l) => langName(l)),
    amount: gen.amount,
    ref: gen.ref,
    paidAt: fmtStamp(gen.paidAt ?? gen.createdAt),
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
  const listPrice = getOneTimePrice("multilang");
  return {
    price: listPrice,
    couponPercent: coupon?.percent ?? null,
    couponPrice: coupon ? applyOffer(listPrice, coupon) : null,
    preselect: input.preselect ?? [],
    count: MULTILANG_LANG_COUNT,
    primaryLangName: langName(primaryLang),
    options: supportedLangs()
      .filter((l) => l !== primaryLang)
      .map((l) => ({ code: l, name: langName(l) })),
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
  return paid.phase === "running"
    ? "ezt a generálást már kifizette — a fordítás készül, újra fizetnie nem kell"
    : "ezt a generálást már kifizette, de a generálás elakadt — csapatunk újraindítja, újra fizetnie nem kell";
}
