// Re-apply TODAY's website rules to the stored lead stock.
// Usage: npx tsx scripts/requalify-websites.mts [--apply]
//
// WHY: the portal catalogue grew all through 2026-08-19/20 (each new region
// surfaced more listing hosts, ADR-0037). Leads scraped BEFORE a host was known
// kept the verdict made under the old rules — so a lead whose only "website" is
// an apartman.hu / hungaryhotel.net / lake-balaton.com listing page still sits
// there as `modern`, i.e. "has a modern site, not a target". That is the FALSE
// NEGATIVE direction of the §F credibility bug: we silently drop a real
// customer instead of contacting them.
//
// Deterministic and offline: no search, no fetch, no API cost — it only re-runs
// classifyWebsite() over what is already stored. The assessment block is dropped
// when the site turns out to be a portal, because it describes that portal page
// (its "outdated" verdict says nothing about a business with no site at all).
//
// Only pre-outreach leads are rewritten; anything already contacted is listed
// for the operator instead of being silently requalified.

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { classifyWebsite, isMvpLead } from "../src/scraper/qualify.js";
import { qualificationOf } from "../src/scraper/persist.js";
import type { QualifiedLead } from "../src/scraper/types.js";

const apply = process.argv.slice(2).includes("--apply");
const UPDATABLE = ["qualified", "mock_curation"];

const rows = await db
  .selectFrom("lead")
  .select(["id", "name", "qualification", "lifecycle_status", "raw"])
  .where("lifecycle_status", "not in", ["terminated", "disqualified"])
  .execute();

let changed = 0;
let skipped = 0;
const lines: string[] = [];

for (const r of rows) {
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  if (!raw.website) continue;
  const status = classifyWebsite(raw.website);
  if (status === raw.websiteStatus) continue; // verdict unchanged

  const next: QualifiedLead = { ...raw, websiteStatus: status };
  if (status !== "has_own") {
    // The assessment measured a portal page — it cannot speak for this business.
    delete (next as { assessment?: unknown }).assessment;
  }
  (next as { isLead?: boolean }).isLead =
    isMvpLead(status) || Boolean(next.assessment?.outdated);
  const q = qualificationOf(next);

  if (!UPDATABLE.includes(r.lifecycle_status)) {
    skipped++;
    lines.push(`  ⚠️ KÉZI  ${r.name} (${r.lifecycle_status}): ${r.qualification} → ${q}`);
    continue;
  }
  lines.push(
    `  ${r.qualification.padEnd(8)} → ${q.padEnd(8)} ${r.name} · ${raw.website.slice(0, 52)}`,
  );
  changed++;
  if (!apply) continue;
  await db
    .updateTable("lead")
    .set({ raw: sql`${JSON.stringify(next)}::jsonb`, qualification: q })
    .where("id", "=", r.id)
    .execute();
}

console.log(
  `Honlap-újraminősítés a mai szabályokkal — ${apply ? "ÉLES ÍRÁS" : "DRY-RUN (--apply írna)"}\n`,
);
console.log(lines.length ? lines.join("\n") : "  (nincs eltérés)");
console.log(
  `\n${changed} lead ${apply ? "átminősítve" : "átminősítendő"}` +
    (skipped ? ` · ${skipped} outreach után — kézi átnézésre jelölve` : ""),
);
process.exit(0);
