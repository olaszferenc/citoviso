// ADR-XXXX — the automatic outreach queue's ORDER (owner, 2026-10-27: „a honlap nélküliek
// mennek elsőként, és ha elfogytak, jöhetnek a többiek”).
//
// What this proves, on the real claim query (DISPATCH_PRIORITY):
//   ① a NEWER no-site row goes before an OLDER modern-site row (the owner's case);
//   ② the ranks: no own site (no_site, or raw.websiteStatus none / portal_only) → outdated →
//      modern → not classified; within a rank the oldest queued row;
//   ③ runDispatchTick claims with that order (structural: the priority comes BEFORE queued_at).
//
// The dev DB is SHARED: everything runs inside ONE transaction that is rolled back — the leads'
// qualification edits and the dispatch rows never become visible to anyone else.
//
// Run: npx tsx scripts/dispatch-priority-check.mts

import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { DISPATCH_PRIORITY } from "../src/outreach/autoDispatch.js";

let failures = 0;
const check = (label: string, pass: boolean, detail?: unknown): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✓" : "✗"} ${label}${pass || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};

class Rollback extends Error {}

const CASES = [
  { key: "modern, legrégebbi", qualification: "modern", websiteStatus: "has_own", ageMin: 180 },
  { key: "elavult", qualification: "outdated", websiteStatus: "has_own", ageMin: 120 },
  { key: "honlap nélküli, újabb", qualification: "no_site", websiteStatus: "none", ageMin: 60 },
  { key: "csak portál (minősítetlen)", qualification: "unknown", websiteStatus: "portal_only", ageMin: 30 },
  { key: "minősítetlen, legrégebbi", qualification: "unknown", websiteStatus: null, ageMin: 240 },
] as const;
const EXPECTED = ["honlap nélküli, újabb", "csak portál (minősítetlen)", "elavult", "modern, legrégebbi", "minősítetlen, legrégebbi"];

console.log("dispatch-sorrend: honlap nélküli elöl (ADR-XXXX)");
try {
  await db.transaction().execute(async (trx) => {
    const free = await trx
      .selectFrom("lead")
      .innerJoin("mock_artifact", "mock_artifact.lead_id", "lead.id")
      .leftJoin("outreach_dispatch", "outreach_dispatch.lead_id", "lead.id")
      .where("outreach_dispatch.id", "is", null)
      .select(["lead.id as leadId", "mock_artifact.id as artifactId"])
      .distinctOn("lead.id")
      .limit(CASES.length)
      .execute();
    check(`van ${CASES.length} sorba még nem tett, mockos lead a méréshez`, free.length === CASES.length, free.length);
    if (free.length < CASES.length) throw new Rollback();

    const now = Date.now();
    const ids = new Map<string, string>();
    for (const [i, c] of CASES.entries()) {
      const f = free[i]!;
      await trx
        .updateTable("lead")
        .set({
          qualification: c.qualification,
          raw: c.websiteStatus
            ? sql`jsonb_set(coalesce(raw, '{}'::jsonb), '{websiteStatus}', ${JSON.stringify(c.websiteStatus)}::jsonb)`
            : sql`coalesce(raw, '{}'::jsonb) - 'websiteStatus'`,
        })
        .where("id", "=", f.leadId)
        .execute();
      const row = await trx
        .insertInto("outreach_dispatch")
        .values({ lead_id: f.leadId, artifact_id: f.artifactId, queued_by: "dispatch-priority-check", queued_at: new Date(now - c.ageMin * 60_000) })
        .returning("id")
        .executeTakeFirstOrThrow();
      ids.set(row.id, c.key);
    }

    // The claim's own ordering, over this run's rows only.
    const order = (
      await trx
        .selectFrom("outreach_dispatch")
        .select(["id"])
        .where("id", "in", [...ids.keys()])
        .where("status", "=", "queued")
        .orderBy(DISPATCH_PRIORITY)
        .orderBy("queued_at")
        .execute()
    ).map((r) => ids.get(r.id)!);

    check("① az újabb honlap nélküli sor a régebbi modern ELÉ kerül", order.indexOf("honlap nélküli, újabb") < order.indexOf("modern, legrégebbi"), order);
    check("② sorrend: honlap nélküli (no_site, portal_only) → elavult → modern → minősítetlen; rangon belül a régebbi", JSON.stringify(order) === JSON.stringify(EXPECTED), order);
    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) throw e;
}

const src = readFileSync(new URL("../src/outreach/autoDispatch.ts", import.meta.url), "utf8");
const claim = src.slice(src.indexOf("export async function runDispatchTick"));
check("③ a runDispatchTick claimje a prioritással rendez, és csak azon belül queued_at szerint",
  /\.orderBy\(DISPATCH_PRIORITY\)\s*\.orderBy\("queued_at"\)/.test(claim.slice(0, claim.indexOf("forUpdate"))));

await db.destroy();
if (failures) {
  console.error(`\n⛔ dispatch-priority-check: ${failures} bukás — a kiküldési sor nem a tulaj sorrendjében megy.`);
  process.exit(1);
}
console.log("\n✅ dispatch-priority-check: a honlap nélküliek mennek elsőként, utánuk az elavult, majd a modern honlapúak.");
