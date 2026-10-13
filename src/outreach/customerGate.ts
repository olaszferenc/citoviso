// The "already a customer" gate of every COLD outreach path (Elek 10-13 O-1).
//
// Measured on the live console (2026-10-13): a lead with a running free trial and a live
// trial site still read „Kiküldve: még nem — ez a következő”, and the draft page said
// „E-mail: most kiküldhető — a küldő-út minden kapuja zöld”. None of the send gates in
// src/outreach/ asked about the trial or the tenant — only the trial campaign did. One
// careless click would have mailed a trialing owner „Ez egy honlap-terv az Ön szállásáról”.
//
// ONE predicate for the mail path (sendOutreachMail), the mobile paths (mobileOutreachGates:
// SMS, MMS+SMS pair) and the console's workflow band. Same two legs as the trial campaign
// (trialCampaign.ts: `bought` · `trial`): the lead owns a site (a tenant, or a paid initial
// order — ownedSiteForLead) OR has any free_trial row (active, lapsed, converted, purged:
// once a person has tried the product, a cold „here is a design” letter is the wrong one).

import { db } from "../db/client.js";
import { ownedSiteForLead } from "../conversion/owned.js";

/** Why a cold outreach to this lead is refused (operator-facing, Hungarian), or null. */
export async function alreadyCustomerBlocks(leadId: string): Promise<string | null> {
  if (await ownedSiteForLead(leadId)) {
    return "a lead már ügyfél (saját oldala van vagy fizetett) — hideg megkeresés tilos"; // i18n-exempt: operátori üzenet, sosem éri el a leadet
  }
  const trial = await db.selectFrom("free_trial").select("status").where("lead_id", "=", leadId).executeTakeFirst();
  if (trial) {
    return `a lead próbázó (próba: ${trial.status}) — hideg megkeresés tilos, a próbázót a próba-kampány kezeli`; // i18n-exempt: operátori üzenet, sosem éri el a leadet
  }
  return null;
}
