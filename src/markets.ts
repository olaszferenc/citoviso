// ADR-0111 — which countries' legal packs are approved, in ONE place.
//
// The gates that read this (cold outreach, pay-link, go-live) are all fail-closed:
// anything that is not an explicit 'approved' row keeps the market shut. That is the
// whole point — a market opens because someone took responsibility for its legal
// pack, never because a lookup happened to return nothing.
import { sql } from "kysely";
import { db } from "./db/client.js";

/** Our home market: the entire legal pack (ÁSZF, elállás, DPA, tenant pages) is HU law. */
export const HOME_MARKET = "HU";

export interface MarketRow {
  readonly country: string;
  readonly approved: boolean;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
  readonly note: string | null;
}

/**
 * ISO-2, upper case. Everything that reaches the gates goes through here, because
 * `buyer_country` is filled by a human at checkout and `scraper_definition.country`
 * by an operator — 'hu', 'Hu' and ' HU ' all occur, and a case-sensitive compare
 * would silently CLOSE a market that is in fact open (or, worse, the reverse).
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * Is this country's legal pack approved?
 *
 * A null/unknown country is NOT approved. That is deliberate: "we do not know where
 * this customer is" is not a reason to publish a Hungarian imprint in their name.
 */
export async function isMarketApproved(country: string | null | undefined): Promise<boolean> {
  const cc = normalizeCountryCode(country);
  if (!cc) return false;
  const row = await db
    .selectFrom("market")
    .select("legal_status")
    .where("country", "=", cc)
    .executeTakeFirst();
  return row?.legal_status === "approved";
}

/** Every known market, home first, then alphabetically — the console list. */
export async function listMarkets(): Promise<readonly MarketRow[]> {
  const rows = await db
    .selectFrom("market")
    .select(["country", "legal_status", "approved_by", "approved_at", "note"])
    .orderBy("country")
    .execute();
  return rows
    .map((r) => ({
      country: r.country,
      approved: r.legal_status === "approved",
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      note: r.note,
    }))
    .sort((a, b) => (a.country === HOME_MARKET ? -1 : b.country === HOME_MARKET ? 1 : 0));
}

/**
 * Countries we have actually MET — every country a scrape area or a buyer brought in,
 * whether or not it has a market row yet. Without this the console could only show
 * markets someone already thought of, and the Polish lead that just arrived would be
 * invisible until it was too late.
 */
export async function encounteredCountries(): Promise<readonly string[]> {
  const fromAreas = await db
    .selectFrom("scraper_definition")
    .select("country")
    .distinct()
    .execute();
  const fromBuyers = await db
    .selectFrom("order_intent")
    .select("buyer_country")
    .distinct()
    .execute();
  const all = new Set<string>();
  for (const r of fromAreas) {
    const c = normalizeCountryCode(r.country);
    if (c) all.add(c);
  }
  for (const r of fromBuyers) {
    const c = normalizeCountryCode(r.buyer_country);
    if (c) all.add(c);
  }
  all.add(HOME_MARKET);
  // Home market first, then alphabetical: the console list should open with the market
  // the product actually stands on, not with whichever country sorts first.
  return [...all].sort((a, b) =>
    a === HOME_MARKET ? -1 : b === HOME_MARKET ? 1 : a.localeCompare(b),
  );
}

export interface MarketDecision {
  readonly country: string;
  /** The signed-in operator. Never a form field — that would make the audit self-reported. */
  readonly actor: string;
  /** Mandatory, and enforced here as well as in the browser. */
  readonly reason: string;
}

/**
 * Open a market. Returns false when the reason is missing — and then NOTHING happens:
 * no status change and no log row, so a rejected attempt cannot look like a decision
 * (the same rule the opt-out revocation follows).
 */
export async function approveMarket(d: MarketDecision): Promise<boolean> {
  const cc = normalizeCountryCode(d.country);
  const reason = d.reason.trim();
  if (!cc || reason.length < 3) return false;
  await db
    .insertInto("market")
    .values({
      country: cc,
      legal_status: "approved",
      approved_by: d.actor,
      approved_at: sql`now()` as unknown as Date,
      note: reason,
      updated_at: sql`now()` as unknown as Date,
    })
    .onConflict((oc) =>
      oc.column("country").doUpdateSet({
        legal_status: "approved",
        approved_by: d.actor,
        approved_at: sql`now()` as unknown as Date,
        note: reason,
        updated_at: sql`now()` as unknown as Date,
      }),
    )
    .execute();
  await db
    .insertInto("market_log")
    .values({ country: cc, action: "approve", actor: d.actor, reason })
    .execute();
  return true;
}

/**
 * Close a market again. The row stays (with its history) — only the status flips, so
 * "was Poland ever open, and who closed it?" is answerable from the log.
 */
export async function revokeMarket(d: MarketDecision): Promise<boolean> {
  const cc = normalizeCountryCode(d.country);
  const reason = d.reason.trim();
  if (!cc || reason.length < 3 || cc === HOME_MARKET) return false; // the home market is not revocable here
  const res = await db
    .updateTable("market")
    .set({ legal_status: "pending", note: reason, updated_at: sql`now()` as unknown as Date })
    .where("country", "=", cc)
    .executeTakeFirst();
  if (!Number(res.numUpdatedRows ?? 0)) return false;
  await db
    .insertInto("market_log")
    .values({ country: cc, action: "revoke", actor: d.actor, reason })
    .execute();
  return true;
}

/** Decision history for one country, newest first. */
export async function marketLog(
  country: string,
): Promise<readonly { action: string; actor: string; reason: string; at: Date }[]> {
  const cc = normalizeCountryCode(country);
  if (!cc) return [];
  const rows = await db
    .selectFrom("market_log")
    .select(["action", "actor", "reason", "created_at"])
    .where("country", "=", cc)
    .orderBy("created_at", "desc")
    .limit(20)
    .execute();
  return rows.map((r) => ({ action: r.action, actor: r.actor, reason: r.reason, at: r.created_at }));
}
