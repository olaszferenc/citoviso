// THE PLAN SET OF ONE TRACKED LINK — the rules every surface counts with (the page,
// the letter, the SMS, the claim). Its own module on purpose: the send paths need these
// rules, and importing the console's data module from the mail chain would pull all of
// its operator-facing Hungarian into the i18n scope (ADR-0070 derived scope). Nothing
// here renders a word; it only counts.
//
// Contract: assets/design-refs/prospect-page/plan-tabs/.

import type { Kysely, Transaction } from "kysely";
import { db } from "../db/client.js";
import type { Database } from "../db/schema.js";

/** One plan the lead can switch to: its number AS THE LEAD SEES IT, and its artifact. */
export interface ProspectPlan {
  /** 1-based, gap-free display number — also the /p/<token>/v/<n> path segment. */
  readonly n: number;
  readonly artifactId: string;
  readonly artifactPath: string;
}

/** The contract's cap: the approved mock + at most two alternatives. */
export const MAX_PLANS = 3;

/**
 * Every plan on a tracked link, in the order the lead sees them.
 *
 * Plan 1 is ALWAYS the prospect's own mock (the approved one, the letter's image);
 * the alternatives follow by their stored position. An alternative that has since
 * been rejected or lost its file DROPS OUT rather than rendering a broken tab — and
 * the numbers close up, because the lead reads "3 plans" off the switcher and a
 * gap ("1, 3") would be a visible lie about the count.
 *
 * A link without alternatives returns ONE plan: every caller treats length < 2 as
 * "nothing from the multi-plan contract applies".
 */
export async function listProspectPlans(
  prospectId: string,
  primary: { readonly artifactId: string; readonly artifactPath: string },
  exec: Kysely<Database> | Transaction<Database> = db,
): Promise<ProspectPlan[]> {
  // ⛔ ONCE OFFERED, A PLAN STANDS (§I, jog/provenance-őr FLAG 2026-09-23): the letter
  // said "mindhármat" — a curator's later reject may not shrink the link under it. Plan 1
  // already behaves so (getProspectByToken never filtered on status); the alternatives
  // now match. Before any channel claimed the link, a rejected alternative still drops.
  const offered = await isPlanSetOffered(prospectId, exec);
  let q = exec
    .selectFrom("prospect_variant")
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect_variant.mock_artifact_id")
    .select(["mock_artifact.id as artifactId", "mock_artifact.path as artifactPath"])
    .where("prospect_variant.prospect_id", "=", prospectId)
    .where("mock_artifact.path", "is not", null)
    .where("mock_artifact.id", "!=", primary.artifactId);
  if (!offered) q = q.where("mock_artifact.status", "!=", "rejected");
  const alts = await q.orderBy("prospect_variant.position").execute();
  const plans: ProspectPlan[] = [{ n: 1, ...primary }];
  for (const a of alts) {
    if (plans.length >= MAX_PLANS) break;
    plans.push({ n: plans.length + 1, artifactId: a.artifactId, artifactPath: a.artifactPath! });
  }
  return plans;
}

/**
 * Has ANY channel claimed or sent this link? Then its plan set is what we offered.
 *
 * Not just `sent_at`: every send path CLAIMS first (email_sent_at / sms_sent_at /
 * mms_sent_at) and stamps `sent_at` only afterwards — a lock keyed on `sent_at` alone
 * left a window in which the letter was already being built with N plans while the set
 * could still change (jog/provenance-őr FLAG, 2026-09-23).
 */
export async function isPlanSetOffered(
  prospectId: string,
  exec: Kysely<Database> | Transaction<Database> = db,
): Promise<boolean> {
  const p = await exec
    .selectFrom("prospect")
    .select(["sent_at", "email_sent_at", "sms_sent_at", "mms_sent_at"])
    .where("id", "=", prospectId)
    .executeTakeFirst();
  return !!p && (p.sent_at != null || p.email_sent_at != null || p.sms_sent_at != null || p.mms_sent_at != null);
}

/**
 * The CLAIM-TIME check of every send path: is the link's plan count still the one the
 * message was written with? Call it INSIDE the claim's transaction — it locks the
 * prospect row, and setProspectVariants takes the same lock, so the two serialise: either
 * the set changed first (this returns false → the send skips, the next run rebuilds the
 * message) or the claim landed first (and the set is locked from then on).
 */
export async function planCountStill(
  trx: Transaction<Database>,
  prospectId: string,
  expected: number,
): Promise<boolean> {
  const p = await trx
    .selectFrom("prospect")
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select(["mock_artifact.id as artifactId", "mock_artifact.path as artifactPath"])
    .where("prospect.id", "=", prospectId)
    .forUpdate("prospect")
    .executeTakeFirst();
  if (!p?.artifactPath) return Number(expected) <= 1;
  const n = (await listProspectPlans(prospectId, { artifactId: p.artifactId, artifactPath: p.artifactPath }, trx))
    .length;
  return n === Math.max(1, Math.min(MAX_PLANS, Number(expected) || 1));
}


/**
 * Is this artifact an ALTERNATIVE plan on any tracked link? Then it is frozen exactly like
 * plan 1 is: the hero override and the re-copy refuse to re-render it under the lead
 * (§I — jog/provenance-őr FLAG 2026-09-23: both freezes only asked about
 * prospect.mock_artifact_id, so a plan 2/3 could change after the letter went out).
 * Same strictness as plan 1's freeze: ATTACHED is enough, not only "sent".
 */
export async function isAttachedAsAlternative(
  artifactId: string,
  exec: Kysely<Database> | Transaction<Database> = db,
): Promise<boolean> {
  const r = await exec
    .selectFrom("prospect_variant")
    .select("prospect_id")
    .where("mock_artifact_id", "=", artifactId)
    .executeTakeFirst();
  return !!r;
}
