// One-off (owner 2026-11-25, „1664 jóváhagyandó mokot látok … ezek a régiek”): the rows the old one-step
// reviewer parked as „JÓVÁHAGYÁSRA VÁR” have not been through the quality colleague, yet the CRM showed
// them as awaiting the owner. They get the colleague's wait note; his pass moves them to the owner's page.
//
//   npx tsx scripts/qa-wait-relabel.mts          → dry run (counts only)
//   npx tsx scripts/qa-wait-relabel.mts --go     → relabel
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { APPROVAL_PENDING_NOTE, QA_REVIEW_KEY, QA_WAIT_NOTE } from "../src/outreach/mockQaReview.js";

const go = process.argv.includes("--go");
// A row stays on the owner's page only when its mock carries the colleague's pass (freshness is re-checked there).
const notPassed = sql<boolean>`not exists (select 1 from mock_artifact a where a.id = outreach_dispatch.artifact_id and (a.inputs->${QA_REVIEW_KEY}->>'verdict') = 'pass')`;
const base = db.selectFrom("outreach_dispatch").where("status", "=", "held").where("note", "=", APPROVAL_PENDING_NOTE);
const total = Number((await base.select(db.fn.countAll().as("n")).executeTakeFirst())?.n ?? 0);
const stale = Number((await base.where(notPassed).select(db.fn.countAll().as("n")).executeTakeFirst())?.n ?? 0);
console.log(`„JÓVÁHAGYÁSRA VÁR” sor: ${total} · ebből a kolléga nem hagyta jóvá: ${stale}`);
if (go && stale) {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ note: QA_WAIT_NOTE })
    .where("status", "=", "held")
    .where("note", "=", APPROVAL_PENDING_NOTE)
    .where(notPassed)
    .executeTakeFirst();
  console.log(`✅ átírva: ${Number(r.numUpdatedRows ?? 0)} sor → „${QA_WAIT_NOTE}”`);
} else if (!go) console.log("(szárazfuttatás — írás: --go)");
await db.destroy();
