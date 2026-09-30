// ADR-XXXX — the escalation follow-up tick, HOURLY (citoviso-offer-followup.timer).
// It used to ride the daily 07:00 billing tick; with an operator-set delay from 1 hour
// (ADR-0286) a daily tick made the reminder late by up to a day and let it miss short
// offers entirely. Outside 8–20 Budapest the run sends nothing (followupWindowBlocks);
// a reminder due at night goes with the first run of the morning. One send per offer
// is guaranteed by the atomic claim (claimFollowup), not by the tick interval.
//   tsx scripts/offer-followup.mts [--now=2026-10-01T09:00:00+02:00]

import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

try {
  const f = await sendEscalationFollowups(now);
  console.log(`offer-followup @ ${now.toISOString()}:`, JSON.stringify(f));
} catch (e) {
  // Non-zero exit → the unit's OnFailure= mails the house (ADR-0276).
  console.error("offer-followup HIBA:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
