// „Országok / Árazás” 5. fázis (0156; terv assets/design-refs/console/orszagok-arazas/ README ⑩ — ÜTEMEZETT
// ÁRVÁLTOZÁS, B): what a price change of a region does to its subscribers, and the notice of a raise.
//
//   · impact: per subscription — cycle, next charge, the first charge at the new price (a raise: the first
//     renewal whose period starts on/after the start date; a cut: the next charge), now / new / difference;
//     the summary (affected / all, of which frozen; the monthly revenue change after the full transition;
//     when the notice goes; from when the new buyer and the existing subscriber pay). The SAME arithmetic
//     the renewal uses (billing.ts → pricing.computeMonthlyAt at the period's start day).
//   · notice: a raise's letter to every affected subscriber, the frozen ones too (owner 2026-11-26), once
//     per subscription (price_change_notice), in the tenant's language (template: email/priceChangeNotice.ts,
//     frozen design design-refs/console/arvaltozas-ertesito/).
import { db } from "../db/client.js";
import { billingEmails } from "../billing/partner.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { computeAnnualAt, computeMonthlyAt, type PriceDelta } from "../pricing.js";
import { buildPriceChangeNoticeEmail } from "../email/priceChangeNotice.js";
import { getEmailSender } from "../email/sender.js";
import { renewableModuleIds } from "./billing.js";

export interface SubImpact {
  readonly subscriptionId: string;
  readonly tenantId: string;
  readonly siteName: string;
  readonly frozen: boolean;
  readonly cycle: "monthly" | "annual";
  readonly currency: string;
  /** The next charge day (the current period's end). */
  readonly nextCharge: string;
  /** The first charge at the new price (null = the change does not touch this subscription's price). */
  readonly firstNewCharge: string | null;
  readonly now: number;
  readonly next: number;
  readonly diff: number;
}

export interface ChangeImpact {
  readonly region: string;
  readonly today: string;
  readonly raiseFrom: string | null;
  readonly subs: readonly SubImpact[];
  readonly affected: number;
  readonly total: number;
  readonly frozenAffected: number;
  /** Monthly-equivalent revenue change once every subscription pays the new price. */
  readonly monthlyDelta: number;
}

const dayOf = (d: unknown): string => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

function addMonths(day: string, m: number): string {
  const x = new Date(`${day}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + m);
  return x.toISOString().slice(0, 10);
}

/** The first period start on/after `from`, walking a subscription's cycle from its next charge. */
export function firstRenewalOnOrAfter(nextCharge: string, cycle: "monthly" | "annual", from: string): string {
  let d = nextCharge;
  for (let k = 0; k < 40 && d < from; k++) d = addMonths(d, cycle === "annual" ? 12 : 1);
  return d;
}

/**
 * The impact of a change being saved on the region's live subscriptions (active, past due, frozen).
 * `raise` is dated `raiseFrom`; `cut` takes effect today.
 */
export async function priceChangeImpact(
  region: string,
  change: { readonly raise: PriceDelta | null; readonly raiseFrom: string | null; readonly cut: PriceDelta | null },
  today: string,
): Promise<ChangeImpact> {
  const rows = await db
    .selectFrom("subscription as s")
    .innerJoin("tenant as t", "t.id", "s.tenant_id")
    .select(["s.id", "s.tenant_id", "t.display_name", "s.status", "s.billing_period", "s.pending_period", "s.current_period_end", "s.currency"])
    .where("s.pricing_region", "=", region)
    .where("s.status", "in", ["active", "past_due", "frozen"])
    .orderBy("s.current_period_end")
    .execute();
  const extra = [
    ...(change.cut ? [{ effectiveFrom: today, next: change.cut }] : []),
    ...(change.raise && change.raiseFrom ? [{ effectiveFrom: change.raiseFrom, next: change.raise }] : []),
  ];
  const subs: SubImpact[] = [];
  let monthlyDelta = 0;
  for (const r of rows) {
    const cycle = (r.pending_period ?? r.billing_period) as "monthly" | "annual";
    const nextCharge = dayOf(r.current_period_end) < today ? today : dayOf(r.current_period_end);
    const mods = await renewableModuleIds(r.tenant_id);
    const price = (day: string, x: typeof extra): number =>
      cycle === "annual" ? computeAnnualAt(mods, region, day, x) : computeMonthlyAt(mods, region, day, x);
    // The day the change reaches this subscription: a raise its first renewal on/after the date, a cut its next charge.
    const at = change.raise && change.raiseFrom ? firstRenewalOnOrAfter(nextCharge, cycle, change.raiseFrom) : nextCharge;
    const now = price(at, []);
    const next = price(at, extra);
    const diff = next - now;
    if (diff !== 0) monthlyDelta += cycle === "annual" ? diff / 12 : diff;
    subs.push({
      subscriptionId: r.id,
      tenantId: r.tenant_id,
      siteName: r.display_name,
      frozen: r.status === "frozen",
      cycle,
      currency: r.currency,
      nextCharge,
      firstNewCharge: diff !== 0 ? at : null,
      now,
      next,
      diff,
    });
  }
  const touched = subs.filter((x) => x.diff !== 0);
  return {
    region,
    today,
    raiseFrom: change.raise ? change.raiseFrom : null,
    subs,
    affected: touched.length,
    total: subs.length,
    frozenAffected: touched.filter((x) => x.frozen).length,
    monthlyDelta: Math.round(monthlyDelta),
  };
}

/**
 * Send the notice of a saved raise to every subscription whose price it raises — the frozen ones too —
 * once per subscription. `impact` is the one computed BEFORE the raise was scheduled (after it, the raise
 * is among the pending changes and „now” would already contain it). Returns how many subscriptions got it.
 */
export async function sendPriceChangeNotices(priceChangeId: string, impact: ChangeImpact): Promise<{ sent: number; skipped: number }> {
  const pc = await db.selectFrom("price_change").selectAll().where("id", "=", priceChangeId).executeTakeFirst();
  if (!pc || pc.kind !== "raise" || pc.cancelled_at) return { sent: 0, skipped: 0 };
  const effectiveFrom = dayOf(pc.effective_from);
  const done = new Set((await db.selectFrom("price_change_notice").select("subscription_id").where("price_change_id", "=", pc.id).execute()).map((r) => r.subscription_id));
  const sender = getEmailSender();
  let sent = 0;
  let skipped = 0;
  for (const s of impact.subs) {
    if (s.diff <= 0 || done.has(s.subscriptionId)) continue;
    const to = await billingEmails(s.tenantId);
    if (!to.length) {
      skipped++;
      continue;
    }
    const lang = await prepareMailLang(await langForTenant(s.tenantId));
    for (const addr of to) {
      await sender.send(
        buildPriceChangeNoticeEmail({
          to: addr,
          lang,
          siteName: s.siteName,
          currency: s.currency,
          cycle: s.cycle,
          now: s.now,
          next: s.next,
          effectiveFrom,
          firstNewCharge: s.firstNewCharge ?? effectiveFrom,
          frozen: s.frozen,
        }),
      );
    }
    await db
      .insertInto("price_change_notice")
      .values({ price_change_id: pc.id, subscription_id: s.subscriptionId, first_new_charge: s.firstNewCharge, sent_to: to.join(", ") })
      .onConflict((oc) => oc.columns(["price_change_id", "subscription_id"]).doNothing())
      .execute();
    sent++;
  }
  await db.updateTable("price_change").set({ notice_sent_at: new Date() }).where("id", "=", pc.id).execute();
  return { sent, skipped };
}
