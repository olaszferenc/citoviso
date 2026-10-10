// ADR-0287 — the escalation follow-up tick, HOURLY (citoviso-offer-followup.timer).
// It used to ride the daily 07:00 billing tick; with an operator-set delay from 1 hour
// (ADR-0286) a daily tick made the reminder late by up to a day and let it miss short
// offers entirely. Outside 8–20 Budapest the run sends nothing (followupWindowBlocks);
// a reminder due at night goes with the first run of the morning. One send per offer
// is guaranteed by the atomic claim (claimFollowup), not by the tick interval.
//
// ADR-0344 — the same hourly tick carries the free-trial T−3 / T−1 warnings (they must go
// weekdays 9–16, the daily 07:00 billing tick never runs inside that window). Both LIVE
// with the owner-approved wording (src/trial/notices.ts, trialNoticeDeps): the e-mail
// since C2, the accent-free SMS with the link since C2b (2026-10-09).
//
// ADR-0345 — and the purge warning 7 days before a lapsed trial's data is deleted (same
// weekday 9–16 window). LIVE with the owner-approved letter "A" (2026-10-09,
// assets/design-refs/console/proba-torles-level/); the daily purge itself stays DRY until
// it goes live with the big deploy (separate owner permission).
// The same tick runs the free-trial WATCH (src/trial/watch.ts, migration 0100): five stuck-
// trial states (lapse overdue, warning failed, site not live, paid continuation without
// invoice/subscription, login letter not sent) → operator e-mail + SMS, once per incident.
// HOURLY on purpose: it also catches the daily 07:00 billing tick being dead.
// EVERY step has its own try/catch (as billing-cycle.ts): one shared block let a throwing
// escalation follow-up skip the trial warnings and the purge warning every hour while the
// fault lasted (IT C6.1). A failed step → non-zero exit, the rest still run.
//   tsx scripts/offer-followup.mts [--now=2026-10-01T09:00:00+02:00]

import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { runTrialNotices } from "../src/trial/expiry.js";
import { purgeWarningDeps, trialNoticeDeps } from "../src/trial/notices.js";
import { runPurgeWarnings } from "../src/trial/retention.js";
import { runTrialWatch } from "../src/trial/watch.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

// Non-zero exit → the unit's OnFailure= mails the house (ADR-0276).
try {
  const f = await sendEscalationFollowups(now);
  console.log(`offer-followup @ ${now.toISOString()}:`, JSON.stringify(f));
} catch (e) {
  console.error("offer-followup HIBA:", e);
  process.exitCode = 1;
}
try {
  const n = await runTrialNotices(now, trialNoticeDeps(now));
  console.log(`trial-notices (e-mail + SMS éles) @ ${now.toISOString()}:`, JSON.stringify(n));
} catch (e) {
  console.error("trial-notices HIBA:", e);
  process.exitCode = 1;
}
try {
  const w = await runPurgeWarnings(now, purgeWarningDeps(now));
  console.log(`trial-purge-warnings (éles) @ ${now.toISOString()}:`, JSON.stringify(w));
} catch (e) {
  console.error("trial-purge-warnings HIBA:", e);
  process.exitCode = 1;
}
try {
  const w = await runTrialWatch(now);
  console.log(`trial-watch @ ${now.toISOString()}:`, JSON.stringify(w));
  // An alert that could not go out is a failure of this tick too (OnFailure= mails the house).
  if (w.failedKinds.length > 0) process.exitCode = 1;
} catch (e) {
  console.error("trial-watch HIBA:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
