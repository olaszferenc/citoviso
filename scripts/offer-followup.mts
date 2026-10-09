// ADR-0287 — the escalation follow-up tick, HOURLY (citoviso-offer-followup.timer).
// It used to ride the daily 07:00 billing tick; with an operator-set delay from 1 hour
// (ADR-0286) a daily tick made the reminder late by up to a day and let it miss short
// offers entirely. Outside 8–20 Budapest the run sends nothing (followupWindowBlocks);
// a reminder due at night goes with the first run of the morning. One send per offer
// is guaranteed by the atomic claim (claimFollowup), not by the tick interval.
//
// ADR-0344 — the same hourly tick carries the free-trial T−3 / T−1 warnings (they must go
// weekdays 9–16, the daily 07:00 billing tick never runs inside that window). The e-mail
// goes with the owner-approved wording (2026-10-09, src/trial/notices.ts); the SMS stays
// DRY (sendSms null — neither sent nor claimed) until its form is approved.
//
// ADR-0345 — and the purge warning 7 days before a lapsed trial's data is deleted (same
// weekday 9–16 window). DRY (deps null — only logged, no ledger row) until the letter's
// wording is approved; without a sent warning the daily purge deletes nothing.
//   tsx scripts/offer-followup.mts [--now=2026-10-01T09:00:00+02:00]

import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { runTrialNotices } from "../src/trial/expiry.js";
import { trialNoticeDeps } from "../src/trial/notices.js";
import { runPurgeWarnings } from "../src/trial/retention.js";
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
  const n = await runTrialNotices(now, trialNoticeDeps(now));
  console.log(`trial-notices (e-mail éles, SMS száraz) @ ${now.toISOString()}:`, JSON.stringify(n));
  const w = await runPurgeWarnings(now, null, { dryRun: true });
  console.log(`trial-purge-warnings (száraz) @ ${now.toISOString()}:`, JSON.stringify(w));
} catch (e) {
  // Non-zero exit → the unit's OnFailure= mails the house (ADR-0276).
  console.error("offer-followup HIBA:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
