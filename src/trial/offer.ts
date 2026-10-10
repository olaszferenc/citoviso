// ADR-0354 — the trial's ONE discount with ONE deadline ("C", owner, 2026-10-10).
//
// The discount's job is to turn "maybe later" into "now". So the trialist keeps the very
// offer they would have had without the trial (the lead's intro / escalation offer), and it
// holds to the END of the trial's last day (Budapest) — the day the letters print. After
// that the continuation is list-priced: the deadline is real. No coupon after a purchase.
//
//   · pinTrialOffer   — at trial start: the largest LIVE initial offer of the lead (any of
//                       its tokens) gets expires_at = the trial's last day end; the others
//                       close now (discounts never stack, ADR-0088). None live → a
//                       `campaign` row on the trial's prospect at the operator-set intro
//                       percent (every trialist arrives on a /p/ link we gave out).
//   · liveTrialOffer  — the continuation's price source (handleOrderRequest, /folytatas).
//
// ⚠️ "Első díj": like every offer, it discounts THIS transaction only — the first year on
// annual billing, the first MONTH on monthly. Renewals recompute from list (billing.ts).

import { db } from "../db/client.js";
import { ensureOutreachOffer, getEscalationConfig, type ActiveOffer } from "../payment/offers.js";
import { budapestDayEnd, budapestIsoDay } from "../text/budapestTime.js";

/** The instant the trial offer ends: the END of the trial's last (Budapest) day. */
export function trialOfferDeadline(trialUntil: Date): Date {
  return budapestDayEnd(budapestIsoDay(trialUntil));
}

/**
 * Pin the trial's offer. Idempotent: a trial that already has `offer_id` is left alone
 * (a resumed start must not re-pick or re-extend). Returns the pinned offer id, or null
 * when nothing could be pinned (intro percent unset — cannot happen with a valid config).
 */
export async function pinTrialOffer(
  trial: { readonly id: string; readonly leadId: string; readonly prospectId: string | null; readonly trialUntil: Date; readonly offerId: string | null },
  now: Date,
): Promise<string | null> {
  if (trial.offerId) return trial.offerId;
  const deadline = trialOfferDeadline(trial.trialUntil);
  const prospects = await db
    .selectFrom("prospect")
    .select(["id", "sent_at"])
    .where("lead_id", "=", trial.leadId)
    .execute();
  // (a) a legacy send's intro offer exists only lazily — materialise it before choosing.
  for (const p of prospects) if (p.sent_at) await ensureOutreachOffer(p.id);

  const ids = prospects.map((p) => p.id);
  const live = ids.length
    ? await db
        .selectFrom("offer")
        .select(["id", "percent"])
        .where("prospect_id", "in", ids)
        .where("scope", "=", "initial")
        .whereRef("used_count", "<", "max_uses")
        .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
        .orderBy("percent", "desc")
        .orderBy("created_at", "asc")
        .execute()
    : [];

  let offerId: string | null = null;
  if (live.length) {
    // (b) the best one runs to the trial's end — an escalation's 72 hours included (ONE deadline).
    offerId = live[0]!.id;
    await db
      .updateTable("offer")
      .set({ expires_at: deadline, note: `ADR-0354: próba-ajánlat, a próba végéig (${trial.id})` })
      .where("id", "=", offerId)
      .execute();
    const rest = live.slice(1).map((o) => o.id);
    if (rest.length) {
      await db
        .updateTable("offer")
        .set({ expires_at: now, note: `ADR-0354: lezárva — a próba a nagyobb ajánlatot viszi (${trial.id})` })
        .where("id", "in", rest)
        .execute();
    }
  } else if (trial.prospectId) {
    // (c) no live offer (direct visitor of a link, or the intro already closed): the
    // operator-set intro percent — list price during the trial would scare them off.
    const { outreachPercent } = await getEscalationConfig();
    const c = await db
      .insertInto("offer")
      .values({
        kind: "campaign",
        prospect_id: trial.prospectId,
        percent: outreachPercent,
        scope: "initial",
        expires_at: deadline,
        note: `ADR-0354: próba-ajánlat (alap), a próba végéig (${trial.id})`,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    offerId = c.id;
  }
  if (offerId) {
    await db.updateTable("free_trial").set({ offer_id: offerId }).where("id", "=", trial.id).where("offer_id", "is", null).execute();
  }
  return offerId;
}

/** The trial's offer while it can still be used (live, unused) — else null (list price). */
export async function liveTrialOffer(tenantId: string, now = new Date()): Promise<ActiveOffer | null> {
  const r = await db
    .selectFrom("free_trial")
    .innerJoin("offer", "offer.id", "free_trial.offer_id")
    .select(["offer.id as id", "offer.kind as kind", "offer.percent as percent", "offer.expires_at as expiresAt"])
    .where("free_trial.tenant_id", "=", tenantId)
    .whereRef("offer.used_count", "<", "offer.max_uses")
    .where((eb) => eb.or([eb("offer.expires_at", "is", null), eb("offer.expires_at", ">", now)]))
    .executeTakeFirst();
  return r
    ? { id: r.id, kind: r.kind, percent: r.percent, expiresAt: r.expiresAt ? new Date(r.expiresAt as unknown as string) : null }
    : null;
}

/** Is this offer still usable at `now`? (The continuation's re-pricing gate.) */
export async function offerIsLive(offerId: string, now = new Date()): Promise<boolean> {
  const o = await db
    .selectFrom("offer")
    .select(["expires_at", "used_count", "max_uses"])
    .where("id", "=", offerId)
    .executeTakeFirst();
  if (!o) return false;
  if (Number(o.used_count) >= Number(o.max_uses)) return false;
  return !o.expires_at || new Date(o.expires_at as unknown as string) > now;
}

/**
 * The discount a trial's messages and screens may PROMISE — ONE answer for the letters,
 * the SMS, the admin strip and the continuation page (ADR-0354 "C": "Próba-kedvezmény").
 *
 *   · kind "trial"  — the C offer (free_trial.offer_id), live and unused: valid to the END
 *                     of the trial's last day; on the FIRST fee (annual = first year,
 *                     monthly = first month).
 *   · kind "coupon" — a pre-C trial's coupon (coupon_offer_id, ADR-0346): keeps its own
 *                     wording and its own date (it ran 90 days past the trial).
 *   · null          — nothing to promise (expired, used, 0 %): the list price, said by no one.
 */
export interface TrialDiscount {
  readonly kind: "trial" | "coupon";
  readonly percent: number;
  /** The last day it can be used (Budapest calendar day, ISO). */
  readonly untilIso: string;
}

export async function trialDiscount(trialId: string, now = new Date()): Promise<TrialDiscount | null> {
  const r = await db
    .selectFrom("free_trial")
    .leftJoin("offer as o", "o.id", "free_trial.offer_id")
    .leftJoin("offer as c", "c.id", "free_trial.coupon_offer_id")
    .select([
      "o.percent as oPercent",
      "o.expires_at as oUntil",
      "o.used_count as oUsed",
      "o.max_uses as oMax",
      "c.percent as cPercent",
      "c.expires_at as cUntil",
      "c.used_count as cUsed",
      "c.max_uses as cMax",
    ])
    .where("free_trial.id", "=", trialId)
    .executeTakeFirst();
  if (!r) return null;
  const live = (pct: number | null, until: unknown, used: unknown, max: unknown): Date | null => {
    if (!pct || pct <= 0) return null;
    if (Number(used ?? 0) >= Number(max ?? 1)) return null;
    const u = until ? new Date(until as string) : null;
    return u && u > now ? u : null;
  };
  const o = live(r.oPercent, r.oUntil, r.oUsed, r.oMax);
  if (o) return { kind: "trial", percent: r.oPercent!, untilIso: budapestIsoDay(o) };
  const c = live(r.cPercent, r.cUntil, r.cUsed, r.cMax);
  if (c) return { kind: "coupon", percent: r.cPercent!, untilIso: budapestIsoDay(c) };
  return null;
}
