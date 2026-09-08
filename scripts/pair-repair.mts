// ADR-0112 — one repair tick for BROKEN MMS+SMS pairs (owner: "mindenképp az
// automatikus újra küldés kell").
//
// A broken pair = the MMS went out, the companion SMS did not. Since ADR-0112 the
// SMS is the only carrier of the tracked link, so until it lands the recipient
// holds an advertising image with no way to the legal footer and no opt-out.
// This tick closes that gap without an operator watching a screen.
//
// Runs from the MAIN tree via citoviso-pair-repair.timer (every minute), like the
// SMS relay — the GSM modem lives on THIS box (ADR-0080 ⑦), so the mobile channel
// is repaired here. Idempotent and cheap: it only acts on pairs whose backoff has
// elapsed, and the SMS half re-runs every §C gate (fresh opt-out check included)
// before anything goes out. Outside the 8:00–20:00 window it does nothing and
// burns no attempts (owner's ruling: no night-time texting).
//
//   tsx scripts/pair-repair.mts

import { repairBrokenPairs } from "../src/outreach/pairRepair.js";

const r = await repairBrokenPairs();

if (r.broken === 0) {
  console.log("[pair-repair] nincs törött pár.");
} else {
  console.log(
    `[pair-repair] törött pár: ${r.broken} · helyreállt: ${r.repaired} · újrapróba: ${r.retrying} · ` +
      `lezárva: ${r.closed} · feladva+riasztás: ${r.gaveUp}`,
  );
  for (const n of r.notes) console.log(`  ${n}`);
}

process.exit(0);
