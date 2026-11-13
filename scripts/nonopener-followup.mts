// ADR-0442 — the non-opener follow-up, READ-ONLY view: who would get the letter and why the rest
// would not (src/outreach/nonOpenerFollowup.ts). The real sends ride the hourly tick
// (scripts/offer-followup.mts); this script never claims or sends.
//
//   npx tsx scripts/nonopener-followup.mts            counts per exclusion reason + the next 20
//   npx tsx scripts/nonopener-followup.mts --gates    also runs every send gate (dry run, no claim)

import { db } from "../src/db/client.js";
import {
  NONOPENER_EXCLUSION_LABEL,
  listNonOpenerCandidates,
  nonOpenerDailyCap,
  sendNonOpenerFollowup,
  type NonOpenerExclusion,
} from "../src/outreach/nonOpenerFollowup.js";

try {
  const list = await listNonOpenerCandidates();
  const ok = list.filter((c) => !c.excluded);
  const counts = new Map<NonOpenerExclusion, number>();
  for (const c of list) if (c.excluded) counts.set(c.excluded, (counts.get(c.excluded) ?? 0) + 1);
  console.log(`e-mailt kapott lead: ${list.length} · utánkövető-célpont most: ${ok.length} · napi keret: ${await nonOpenerDailyCap()}`);
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${NONOPENER_EXCLUSION_LABEL[k]}`);
  console.log("\nkövetkezők (sorrendben):");
  for (const c of ok.slice(0, 20)) {
    const gate = process.argv.includes("--gates") ? await sendNonOpenerFollowup(c, { dryRun: true }) : null;
    const g = gate ? (gate.kind === "dry-run" ? " ✓ kapuk zöldek" : ` ✗ ${gate.kind === "skipped" ? gate.reason : ""}`) : "";
    console.log(`  ${c.leadName} · ${c.segment ?? "?"} · utolsó: ${c.lastTouch?.toISOString().slice(0, 10)}${g}`);
  }
} finally {
  await db.destroy();
}
