// THE ELEK PARK'S IDENTITY — who the ELEK-TESZT lead is, and which tracked link is HIS.
//
// ⛔ THE MEASURED DEFECT (2026-09-26/27). The matrix driver (`elek/bin/run-all.mts`)
// resolved "the ELEK prospect" by CONTACT E-MAIL: the newest `prospect` row whose
// `contact_email` is elek@citoviso.com. That held for as long as Elek's address sat
// on exactly one lead. On 2026-09-26 the FK-009 thread seeded 38 tracked links on
// the two 19-style dev leads (Ifjúsági Szállás Tihany, Laguna Panzió) with the SAME
// address — on purpose, so a stray "send" could only ever reach Elek's own mailbox.
// From then on the driver's "newest elek@ row" was a Laguna Panzió link: FK-008b
// opened a stranger's mock, the FK-004 re-arm reset all 39 rows, and the
// "tracked link exists" precondition was true even with no ELEK-TESZT link at all.
//
// The address is a SAFETY property (where a mail may go), not an IDENTITY (whose
// link this is). Identity is the lead: the seed (`scripts/seed-elek-lead.mts`) names
// the lead `ELEK_LEAD_NAME`, and a tracked link belongs to the park iff its `lead_id`
// is that lead's. Everything below is pure so `scripts/elek-precondition-check.mts`
// can prove it on fixtures — including the negative control: a NEWER foreign row
// with Elek's address must never win.

/** The lead the seed creates and every park round measures on. ONE spelling. */
export const ELEK_LEAD_NAME = "ELEK-TESZT Vendégház";

/** Elek's own mailbox — the only address a park send may reach (charter, fixed). */
export const ELEK_EMAIL = "elek@citoviso.com";

/** The columns the choice needs; the driver's row type is wider. */
export interface ProspectLike {
  readonly lead_id: string;
  readonly contact_email: string | null;
  readonly created_at: Date | string;
}

/**
 * The park's tracked link among `rows`: the NEWEST prospect whose `lead_id` is the
 * ELEK-TESZT lead's. The address is deliberately NOT part of the choice — a row on
 * a foreign lead carrying elek@ is not Elek's link, and a row on Elek's lead with a
 * different address is still his (the seed rewrites every mail key to elek@, so in
 * practice both hold; the rule must not depend on the second).
 *
 * `elekLeadId === null` (the seed has not run yet) → null: no lead, no link.
 */
export function elekProspectOf<T extends ProspectLike>(rows: readonly T[], elekLeadId: string | null): T | null {
  if (!elekLeadId) return null;
  let best: T | null = null;
  for (const r of rows) {
    if (r.lead_id !== elekLeadId) continue;
    if (!best || new Date(r.created_at).getTime() > new Date(best.created_at).getTime()) best = r;
  }
  return best;
}
