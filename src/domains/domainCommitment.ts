// Domain hűségidő state (ADR-0094). One place answers: does this tenant have a
// RUNNING domain commitment, what package floor did it freeze, and how much of
// it is left — the module-floor guard (④) and the early-exit settlement screen
// both read THIS, so the two can never disagree.
//
// The commitment window starts when the domain order was PAID (a 0 Ft waived
// order carries a gateway='none' paid row — public.ts settles it explicitly)
// and runs commitment_months from there. Both order kinds are covered by the
// prospect → lead → tenant chain: initial orders have no tenant_id, and the
// domain_upgrade order reuses the tenant's original prospect.

import { db } from "../db/client.js";

export interface DomainCommitment {
  /** Package floor (monthly, HUF) frozen at order; null = no floor (paid-fee domain). */
  readonly floorMonthly: number | null;
  /** Committed months (operator-set at order time). */
  readonly months: number;
  /** When the commitment started (the order's paid_at). */
  readonly startedAt: Date;
  /** When the commitment ends (startedAt + months). */
  readonly endsAt: Date;
  /** Whole months still owed (ceil; ≥1 while the commitment runs). */
  readonly remainingMonths: number;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/**
 * The tenant's RUNNING domain commitment, or null when none (no domain order,
 * or the hűségidő is already served). If several paid domain orders exist (rare:
 * re-order after a failed provisioning), the one ending LAST wins.
 */
export async function activeDomainCommitment(tenantId: string): Promise<DomainCommitment | null> {
  const rows = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .innerJoin("payment", "payment.order_intent_id", "order_intent.id")
    .select([
      "order_intent.committed_min_monthly as floor",
      "order_intent.commitment_months as months",
      "payment.paid_at as paidAt",
    ])
    .where("tenant.id", "=", tenantId)
    .where("order_intent.domain_type", "=", "citoviso_registered")
    .where("order_intent.commitment_months", "is not", null)
    .where("payment.status", "=", "paid")
    .execute();

  const now = new Date();
  let best: DomainCommitment | null = null;
  for (const r of rows) {
    if (!r.paidAt || !r.months) continue;
    const startedAt = new Date(r.paidAt);
    const endsAt = addMonths(startedAt, r.months);
    if (endsAt <= now) continue; // served — no running commitment from this order
    if (!best || endsAt > best.endsAt) {
      const remaining = Math.max(
        1,
        Math.ceil((endsAt.getTime() - now.getTime()) / (30.44 * 24 * 3600 * 1000)),
      );
      best = {
        floorMonthly: r.floor,
        months: r.months,
        startedAt,
        endsAt,
        remainingMonths: remaining,
      };
    }
  }
  return best;
}
