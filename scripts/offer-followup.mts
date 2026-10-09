// ADR-0287 — the escalation follow-up tick, HOURLY (citoviso-offer-followup.timer).
// It used to ride the daily 07:00 billing tick; with an operator-set delay from 1 hour
// (ADR-0286) a daily tick made the reminder late by up to a day and let it miss short
// offers entirely. Outside 8–20 Budapest the run sends nothing (followupWindowBlocks);
// a reminder due at night goes with the first run of the morning. One send per offer
// is guaranteed by the atomic claim (claimFollowup), not by the tick interval.
//
// ADR-XXXX — the same hourly tick carries the free-trial T−3 / T−1 warnings (they must go
// weekdays 9–16, the daily 07:00 billing tick never runs inside that window). ⛔ The e-mail
// and SMS wording waits for the owner's approval (§2b), so until then this runs DRY: it logs
// what is due and neither sends nor claims (runTrialNotices dryRun — a dry claim would burn
// the step). There is deliberately no switch to turn sending on: the senders do not exist
// yet; they get wired here together with the approved text.
//   tsx scripts/offer-followup.mts [--now=2026-10-01T09:00:00+02:00]

import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { runTrialNotices } from "../src/trial/expiry.js";
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
  const n = await runTrialNotices(now, null, { dryRun: true });
  console.log(`trial-notices (száraz) @ ${now.toISOString()}:`, JSON.stringify(n));
} catch (e) {
  // Non-zero exit → the unit's OnFailure= mails the house (ADR-0276).
  console.error("offer-followup HIBA:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
