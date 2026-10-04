import { normalizeEmail } from "../email/address.js";

// A CURATOR'S E-MAIL IS NOT THE SCRAPER'S TO REWRITE (ADR-0321 ③, owner 2026-10-04: „Igen”).
//
// Measured 2026-10-04: no re-enrich or backfill path read `raw.curatorEditedAt`. The web
// search replaced a stored address it judged "uncorroborated" with what it found
// (enrichWebSearch: storedIsWeak), the bulk re-enrich and `scrub-contacts` DELETED an address
// failing `isBusinessEmail`, and the medium-Places backfill swapped it for the first accepted
// ledger row — while the console's own button says „Nem ír felül kurátori adatot.” A curator
// typing the owner's gmail (the commonest real address) is exactly what those rules discard.
//
// Rule: the e-mail fields are the CURATOR'S once a curator CHANGED them (`raw.emailCuratedAt`,
// stamped by saveLeadEdits — a clearing included, so a cleared address stays cleared). Edits
// saved before that stamp existed fall back to: any address now, or one at the curator's first
// save. Only a gap no curator ever touched stays fillable by the scrape. Scrape paths may still ADD to the contact
// ledger (`raw.contacts`); they just do not move `raw.email` / `raw.otherEmails`.

interface CuratorEmailRaw {
  readonly email?: string | null;
  readonly otherEmails?: readonly string[] | null;
  readonly contactChannel?: string | null;
  readonly curatorEditedAt?: string | null;
  readonly emailCuratedAt?: string | null;
  readonly scrapedContact?: { readonly email?: string | null } | null;
}

/** Does a curator own this lead's e-mail fields? Pure. */
export function curatorOwnsEmail(raw: CuratorEmailRaw | null | undefined): boolean {
  if (raw?.emailCuratedAt) return true;
  if (!raw?.curatorEditedAt) return false;
  const now = normalizeEmail(raw.email) !== "" || (raw.otherEmails?.length ?? 0) > 0;
  const hadAtFirstSave = normalizeEmail(raw.scrapedContact?.email) !== "";
  return now || hadAtFirstSave;
}

/**
 * `after` with the e-mail fields of `before` restored when the curator owns them. The
 * contact channel goes back with them: it was derived from the address the scrape path
 * just tried to change. Everything else in `after` (ledger, listings, phone…) is kept.
 */
export function keepCuratorEmail<T extends object>(before: T, after: T): T {
  const b = before as CuratorEmailRaw;
  if (!curatorOwnsEmail(b)) return after;
  const out = { ...(after as Record<string, unknown>) };
  for (const k of ["email", "otherEmails", "contactChannel", "emailCuratedAt"] as const) {
    const v = (b as Record<string, unknown>)[k];
    if (v === undefined || v === null) delete out[k];
    else out[k] = v;
  }
  return out as T;
}
