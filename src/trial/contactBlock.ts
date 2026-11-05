// ADR-0421 + owner doctrine 2026-10-26: a lead marked „Elutasító / nem érintett — ne keressük”
// (lead.contact_block_at) gets NO further message. ONE predicate for every trial runner that
// writes to the trialist — the ADR-0417 login reminders (l2–l8), the T−3 / T−1 warnings and the
// ADR-0425 escalation (m5 MMS, h7 letter) — so the rule cannot drift between copies.
//
// Deliberately NOT here: the p7 purge warning (retention.ts). The purge only runs after a SENT
// p7, so blocking it would keep the data past the ÁSZF's 90 days — a legal duty, not outreach.

import { db } from "../db/client.js";

/** The detail written on a step skipped for this reason (ledger, lead-page ladder). */
export const CONTACT_BLOCK_DETAIL = "ne keressük (contact_block)"; // i18n-exempt: ledger detail, operator-facing

/** Is the lead behind this trial marked „ne keressük”? */
export async function trialContactBlocked(trialId: string): Promise<boolean> {
  const r = await db
    .selectFrom("free_trial")
    .innerJoin("lead", "lead.id", "free_trial.lead_id")
    .select("lead.contact_block_at as at")
    .where("free_trial.id", "=", trialId)
    .executeTakeFirst();
  return Boolean(r?.at);
}
