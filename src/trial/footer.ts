// ADR-0344 C2c ② — the footer's "why you got this" for a platform letter that is not about
// the trial itself (password reset, the owner's booking letters). While the account's
// card-less trial RUNS, the owner did not order anything yet: „…oldalát a Citovisónál
// próbálja ki." — exactly like the T−3/T−1 letters. Everyone else: „…rendelte meg."
//   Only an ACTIVE trial (coordinator's wording, 2026-10-09). A lapsed trialist did not
// order either — open question to the coordinator; until then they get the default.
//   No tenant (a booking whose site has none) → the default: the frame never guesses.

import { db } from "../db/client.js";
import type { FooterReason } from "../email/platformLayout.js";

export async function footerReasonForTenant(tenantId: string | null | undefined): Promise<FooterReason> {
  if (!tenantId) return "order";
  const row = await db
    .selectFrom("free_trial")
    .select("status")
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "active")
    .executeTakeFirst();
  return row ? "trial" : "order";
}
