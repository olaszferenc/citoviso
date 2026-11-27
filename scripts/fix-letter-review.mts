// THE CORRECTION LETTER'S REVIEW (Vera) — verdict ONLY (ADR-XXXX). The single-pass checker (~/rc-briefs/egylepes-elo,
// run2.py) judges the correction letter's two new plans exactly as it judges any pair; its MEHET is recorded here as
// the Vera PASS on both plans — and NOTHING else: no re-render (that would change the files the owner approved), no
// curator step, no dispatch row (the lead was contacted; the correction goes by its own path, fixLetter.ts).
//
//   npx tsx scripts/fix-letter-review.mts <file: lead|main|alt|reason per line> [--check]
//   → "OK   <lead>" | "NEM  <lead> — <why>"
// Refuses any pair that is not the main + second plan of a ready / approved fix_letter row.
import { readFileSync } from "node:fs";
import { db } from "../src/db/client.js";
import { recordReview } from "../src/outreach/mockVerdictGate.js";

const BY = "Egylépéses átnéző";
const check = process.argv.includes("--check");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("használat: fix-letter-review.mts <lead|main|alt|reason fájl> [--check]"); // i18n-exempt: operator log
  process.exit(2);
}
const rows = readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split("|"));
for (const [leadId, mainId, altId, reason] of rows) {
  const f = await db
    .selectFrom("fix_letter")
    .select(["status", "main_id", "alt_id"])
    .where("lead_id", "=", leadId ?? "")
    .executeTakeFirst();
  if (!f || !["ready", "approved"].includes(f.status) || f.main_id !== mainId || f.alt_id !== altId) {
    console.log(`NEM  ${leadId} — nem egy várakozó javító levél két terve`); // i18n-exempt: operator log
    continue;
  }
  if (check) {
    console.log(`CHK  ${leadId} ok`); // i18n-exempt: operator log
    continue;
  }
  const ref = `javito-level/${leadId!.slice(0, 8)}`;
  await recordReview(mainId!, { verdict: "pass", by: BY, ref, note: `MEHET (egylépéses, javító levél): ${reason ?? ""}`.slice(0, 400) });
  await recordReview(altId!, { verdict: "pass", by: BY, ref, note: "második terv PASS (egylépéses, javító levél)" });
  console.log(`OK   ${leadId}`); // i18n-exempt: operator log
}
process.exit(0);
