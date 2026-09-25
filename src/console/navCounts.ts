// Live numbers beside the navigation nodes (sidebar, module dashboards, ⌘K) — ONE cheap
// read per request, cached briefly, keyed by the node ids of nav.ts. The dashboard
// widgets read the same numbers, so a count in the sidebar and the widget beside it
// can never disagree (Elek FK-003: a badge and the list it opens must say the same).
//
// ⛔ Only counts the operator can act on from the node; a number that answers a
// different question than the screen it opens is a false label
// (feedback_badge_answered_one_of_nine_gates).

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getDisabledModules } from "../moduleSales.js";
import type { NavNumbers } from "./nav.js";

const TTL_MS = 15_000;
let cache: { at: number; value: NavNumbers } | null = null;

export async function getNavNumbers(): Promise<NavNumbers> {  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const [players, approved, docs, partners, disabled] = await Promise.all([
    db.selectFrom("lead").select(db.fn.countAll().as("n")).executeTakeFirst(),
    db.selectFrom("mock_artifact").select(db.fn.countAll().as("n")).where("status", "=", "approved").executeTakeFirst(),
    db.selectFrom("accounting_document").select(db.fn.countAll().as("n")).where("status", "!=", "void").executeTakeFirst(),
    db.selectFrom("partner").select(db.fn.countAll().as("n")).where("active", "=", true).executeTakeFirst(),
    getDisabledModules(),
  ]);
  const value: NavNumbers = {
    players: Number(players?.n ?? 0),
    approvedMocks: Number(approved?.n ?? 0),
    documents: Number(docs?.n ?? 0),
    partners: Number(partners?.n ?? 0),
    sellable: MODULE_CATALOG.length - disabled.size,
    catalog: MODULE_CATALOG.length,
  };
  cache = { at: Date.now(), value };
  return value;
}

/** Test seam: forget the cache (guards render several fixtures in one process). */
export function resetNavCountsCache(): void {
  cache = null;
}
