// ADR-0421 + owner doctrine 2026-10-26: a lead marked „Elutasító / nem érintett — ne keressük”
// (lead.contact_block_at) gets NO further message. ONE predicate for every trial runner that
// writes to the trialist — the ADR-0417 login reminders (l2–l8), the T−3 / T−1 warnings, the
// ADR-0425 escalation (m5 MMS, h7 letter) and the p7 purge warning — so the rule cannot drift
// between copies. The purge reads it too: „p7 sent OR contact_block” (retention.ts), so a blocked
// trial's data is still deleted on its scheduled day, never kept past the 90 days.
//
// Deliberately NOT here: the l0 start SMS — it answers the trialist's own form submit.

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
