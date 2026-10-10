// SHARED-CONTACT gate: a cold message must not go to an address or number that
// also belongs to ANOTHER live lead, unless a human ruled that the two share an
// owner.
//
// WHY (owner, 2026-09-28): the worst outcome of a wrong match is not a missed lead
// but a mock for business A landing in the inbox of its competitor next door. The
// dev stock measured the risk as real, not theoretical: eight neighbour pairs where
// the medium-confidence side carries the other's phone/e-mail (Anchor Apartmanház ←
// BL YachtClub, Anita Apartman ← Judit Apartmanház, Naro Camping ← Hotel Jogar, …),
// plus intermediary addresses sitting as the primary contact of several leads
// (a portal's support@ on three, one agency gmail on ten).
//
// A shared contact is AMBIGUOUS on its own — one owner with two houses is legitimate
// (duplicates.ts). So the machine does not decide which lead the contact belongs to;
// it stops the send and names the other leads. The operator's ruling on the
// Duplikátumok page releases it:
//   · same_owner → the contact is legitimately shared → sendable
//   · duplicate  → the loser is disqualified, so it no longer counts here
//   · unrelated  → two different businesses on ONE contact: at least one of them is
//                  wrong, so the block STAYS — the fix is correcting the contact.

import { db } from "../db/client.js";
import { normalizeEmail } from "../email/address.js";
import { ELEK_EMAIL } from "../elek/park.js";
import { phoneKey } from "../scraper/contactLedger.js";
import type { QualifiedLead } from "../scraper/types.js";
import { leadEmails } from "../email/leadEmails.js";

/** Leads that no longer receive anything — their contacts cannot collide. */
export const INACTIVE = ["terminated", "disqualified"] as const;

/** Same threshold as the Duplikátumok page: a value on more leads than this is an intermediary's. */
const INTERMEDIARY_MIN = 7;

export type ContactKind = "email" | "phone";

function keyOf(kind: ContactKind, value: string): string | null {
  if (kind === "email") {
    const e = normalizeEmail(value);
    return e.includes("@") ? e : null;
  }
  const p = phoneKey(value);
  return p.length >= 8 ? p : null;
}

/** Every e-mail/phone this lead is known by: the primaries (all of the lead's e-mail
 *  addresses, ADR-0321) plus the ACCEPTED ledger entries. */
function contactKeysOf(raw: QualifiedLead, kind: ContactKind): Set<string> {
  const out = new Set<string>();
  const primaries = kind === "email" ? leadEmails(raw) : raw.phone ? [raw.phone] : [];
  const values = [
    ...primaries,
    ...(raw.contacts ?? []).filter((c) => c.kind === kind && c.accepted).map((c) => c.value),
  ];
  for (const v of values) {
    const k = keyOf(kind, v);
    if (k) out.add(k);
  }
  return out;
}

/**
 * Other live leads that carry this contact and are NOT released by a same_owner /
 * duplicate ruling. Empty = the contact is this lead's alone (or ruled shared).
 */
export async function foreignHoldersOf(
  leadId: string,
  kind: ContactKind,
  value: string,
): Promise<{ id: string; name: string; city?: string }[]> {
  const target = keyOf(kind, value);
  if (!target) return [];

  const rows = await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .where("id", "!=", leadId)
    .where("lifecycle_status", "not in", [...INACTIVE])
    .execute();

  const holders = new Map<string, { id: string; name: string; city?: string }>();
  for (const r of rows) {
    const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
    if (contactKeysOf(raw, kind).has(target)) {
      holders.set(r.id, { id: r.id, name: r.name, city: raw.city });
    }
  }

  // A prospect row IS the address we would mail — another lead's prospect on the
  // same mailbox is the same collision, even if its lead record says otherwise.
  if (kind === "email") {
    const pros = await db
      .selectFrom("prospect")
      .innerJoin("lead", "lead.id", "prospect.lead_id")
      .select(["lead.id as id", "lead.name as name", "prospect.contact_email as email"])
      .where("lead.id", "!=", leadId)
      .where("lead.lifecycle_status", "not in", [...INACTIVE])
      .where("prospect.contact_email", "is not", null)
      .execute();
    for (const p of pros) {
      if (!holders.has(p.id) && keyOf("email", p.email ?? "") === target) {
        holders.set(p.id, { id: p.id, name: p.name });
      }
    }
  }
  if (!holders.size) return [];

  const released = await db
    .selectFrom("lead_link")
    .select(["lead_a", "lead_b"])
    .where("verdict", "in", ["same_owner", "duplicate"])
    .where((eb) => eb.or([eb("lead_a", "=", leadId), eb("lead_b", "=", leadId)]))
    .execute();
  for (const l of released) holders.delete(l.lead_a === leadId ? l.lead_b : l.lead_a);

  return [...holders.values()];
}

/**
 * The gate itself: the operator-facing reason when the send must stop, or null.
 * `exempt` covers the owner's own test identities (Elek's address, allowlisted
 * test numbers) — they sit on several test leads BY DESIGN.
 */
export async function sharedContactBlocks(
  leadId: string,
  kind: ContactKind,
  value: string,
  exempt = false,
): Promise<string | null> {
  if (exempt) return null;
  if (kind === "email" && normalizeEmail(value) === normalizeEmail(ELEK_EMAIL)) return null;

  const others = await foreignHoldersOf(leadId, kind, value);
  if (!others.length) return null;

  const what = kind === "email" ? "e-mail-cím" : "telefonszám";
  if (others.length + 1 >= INTERMEDIARY_MIN) {
    return (
      `ez a ${what} (${value}) további ${others.length} szálláson is szerepel — közvetítő vagy iroda címe, ` +
      `nem a szállás saját elérhetősége. Add meg a lead saját elérhetőségét a Begyűjtött adatok panelen.`
    );
  }
  const names = others
    .slice(0, 3)
    .map((o) => (o.city ? `${o.name} (${o.city})` : o.name))
    .join(", ");
  return (
    `ez a ${what} (${value}) egy másik szálláshoz is tartozik: ${names}${others.length > 3 ? " …" : ""} — ` +
    `lehet, hogy a szomszédé, és akkor a mock a konkurenshez menne. Ha azonos a tulaj, jelöld így a Duplikátumok lapon; ` +
    `ha nem, javítsd a lead elérhetőségét.`
  );
}
