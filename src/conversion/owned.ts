// "THIS LEAD ALREADY BOUGHT" — one predicate, two callers.
//
// WHAT IT FIXES (measured in dev, 2026-09-20): the outreach link `/p/<token>`
// served the mock, the configurator and the checkout to a lead who had ALREADY
// paid. Nothing on that path asked whether the lead was already a customer, so
// re-opening the cold letter re-charged them. The damage was worse than a
// duplicate: convertLead is idempotent on lead_id, ensureSubscriptionForOrder
// does nothing on conflict, and issueAndSendTenantLogin skips an existing login
// — so the second purchase created a payment and a real INVOICE, extended
// NOTHING, and handed the buyer no new thing whatsoever.
//
// ⛔ WHY ONE MODULE AND NOT TWO CHECKS: the screen that says "you already own
// this" and the gate that refuses the pay-link must answer the SAME question.
// A badge computed from its own private rule is how a screen ends up saying
// "buyable" while the operation refuses — the caller must be able to run the
// decision itself, not a lookalike.
//
// It lives under conversion/ (not console/) because src/payment must import it,
// and payment may not depend on the operator console.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { tenantSiteUrl } from "../domains.js";
import { TENANT_LOGIN_URL } from "../server/ownerLogin.js";

/** How far a paying lead actually got. The three states are NOT cosmetic: each
 *  one makes a different promise true, and the bar must not claim a live site
 *  for a customer whose activation stalled (§B.17 binds us about ourselves). */
export type OwnedStage =
  /** Paid, but activation has not produced a tenant (stalled — operator resolves). */
  | "paid_pending"
  /** Tenant + site exist, but the site is not public yet (ADR-0014 provisioned). */
  | "provisioned"
  /** The site is public. */
  | "live";

export interface OwnedSite {
  readonly stage: OwnedStage;
  readonly tenantId: string | null;
  /** Public URL of the live site; null while there is no slug/domain yet. */
  readonly siteUrl: string | null;
  /**
   * Where the owner signs in. ⛔ NOT `siteUrl + "/login"` — measured 2026-09-20:
   * that path 302s straight to the platform login anyway (public.ts:949), so
   * building our own would have been a second copy of an existing rule, and in
   * dev it pointed at a URL that merely bounced. One source: TENANT_LOGIN_URL.
   * Null only when there is no tenant at all (nothing to sign in to yet).
   */
  readonly loginUrl: string | null;
  /** When the first initial purchase was paid. */
  readonly paidAt: Date | null;
}

/**
 * Does this lead already own a site — and how far did it get?
 *
 * TRUE when EITHER leg holds, deliberately:
 *  · a tenant exists for the lead (the conversion ran), OR
 *  · an `initial` order of theirs has a PAID payment.
 *
 * The second leg is the one that matters most in practice. When activation
 * refuses (no photo-rights stamp, unapproved market, failed live render — see
 * payment/service.ts), the buyer has paid and has NO site. That is precisely the
 * moment they re-open the letter and try again, and a tenant-only check would
 * wave them through to a second charge.
 */
export async function ownedSiteForLead(leadId: string): Promise<OwnedSite | null> {
  const paid = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select("payment.paid_at as paidAt")
    .where("prospect.lead_id", "=", leadId)
    .where("order_intent.kind", "=", "initial")
    .where("payment.status", "=", "paid")
    .orderBy("payment.paid_at", "asc")
    .executeTakeFirst();

  const tenant = await db
    .selectFrom("tenant")
    .leftJoin("site", "site.tenant_id", "tenant.id")
    .select([
      "tenant.id as tenantId",
      "site.status as siteStatus",
      "site.slug as slug",
      "site.custom_domain as customDomain",
    ])
    .where("tenant.lead_id", "=", leadId)
    .executeTakeFirst();

  if (!paid && !tenant) return null;

  const paidAt = paid?.paidAt ? new Date(paid.paidAt as unknown as string) : null;
  if (!tenant) return { stage: "paid_pending", tenantId: null, siteUrl: null, loginUrl: null, paidAt };

  const siteUrl = tenantSiteUrl(config.publicSiteUrl, tenant.slug, tenant.customDomain);
  return {
    stage: tenant.siteStatus === "live" ? "live" : "provisioned",
    tenantId: tenant.tenantId,
    siteUrl,
    loginUrl: TENANT_LOGIN_URL,
    paidAt,
  };
}

/** The same question keyed by the outreach token — what the `/p/<token>` page has. */
export async function ownedSiteForProspectToken(token: string): Promise<OwnedSite | null> {
  const r = await db
    .selectFrom("prospect")
    .select("lead_id as leadId")
    .where("token", "=", token)
    .executeTakeFirst();
  return r ? ownedSiteForLead(r.leadId) : null;
}

/** …and keyed by the mock, which is what the order endpoint has in hand. The
 *  `/configure/:artifactId` path carries no token, so keying on the prospect
 *  alone would leave that route ungated. */
export async function ownedSiteForArtifact(artifactId: string): Promise<OwnedSite | null> {
  const r = await db
    .selectFrom("mock_artifact")
    .select("lead_id as leadId")
    .where("id", "=", artifactId)
    .executeTakeFirst();
  return r ? ownedSiteForLead(r.leadId) : null;
}
