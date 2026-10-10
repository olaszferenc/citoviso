// Run the subscription renewal + dunning tick (ADR-0080). Invoked daily by the
// citoviso-billing.timer; --now injects the reference time so the ladder is
// testable step by step:
//   tsx scripts/billing-cycle.ts [--now=2026-09-29] [--tenant=<uuid>]
// --tenant: dev/teszt szűkítés EGY tenantra (FK-006 időutazás a közös dev DB-ben).
import { runBillingCycle } from "../src/payment/billing.js";
import { checkAamAlert } from "../src/console/aamAlert.js";
import { retryFailedInvoices } from "../src/billing/invoiceRetry.js";
import { db } from "../src/db/client.js";
import { endTrialGrantsAfterConversion, lapseExpiredTrials } from "../src/trial/expiry.js";
import { purgeExpiredTrials } from "../src/trial/retention.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
const tenantId = tenantArg ? tenantArg.slice("--tenant=".length) : undefined;

if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

// ADR-0276: a side step that fails must not end the run (billing already happened),
// but it must not exit 0 either — the unit's OnFailure= mails the house only on a
// non-zero exit, and a swallowed error was exactly the silence we are closing.
let sideStepFailed = false;

const r = await runBillingCycle(now, tenantId ? { tenantId } : undefined);
console.log(`billing-cycle @ ${now.toISOString()}:`, JSON.stringify(r));
// ADR-0344: a card-less trial past its end pauses (site 503, trial modules off) on the
// same daily tick. Separate from the ladder above: a trial has no subscription row.
// --tenant narrows it too (the dev DB is shared).
try {
  const trialIds = tenantId
    ? (await db.selectFrom("free_trial").select("id").where("tenant_id", "=", tenantId).execute()).map((t) => t.id)
    : undefined;
  const t = await lapseExpiredTrials(now, trialIds ? { onlyTrialIds: trialIds } : {});
  console.log(`trial-lapse @ ${now.toISOString()}:`, JSON.stringify(t));
  // ADR-0354 ⓑ: a trial bought before its end kept the unchosen modules to that end.
  const g = await endTrialGrantsAfterConversion(now, trialIds ? { onlyTrialIds: trialIds } : {});
  console.log(`trial-grants-end @ ${now.toISOString()}:`, JSON.stringify(g));
} catch (e) {
  console.error("trial-lapse HIBA:", e);
  sideStepFailed = true;
}
// ADR-0345: a lapsed trial's data is deleted 90 days after its end — DRY until the warning
// letter's wording is approved (§2b): it only logs what would go. Without a SENT warning it
// deletes nothing anyway; the dry flag is the second lock. Not narrowed by --tenant: a
// purged trial has no tenant, and the dry run writes nothing.
try {
  const p = await purgeExpiredTrials(now, { dryRun: true });
  console.log(`trial-purge (száraz) @ ${now.toISOString()}:`, JSON.stringify({ purged: p.purged, refused: p.refused, waiting: p.waiting, due: p.candidates.length }));
  if (p.refused > 0) sideStepFailed = true;
} catch (e) {
  console.error("trial-purge HIBA:", e);
  sideStepFailed = true;
}
// ADR-0088 §4b: the escalation follow-up NO LONGER rides this daily tick — its delay is
// operator-set from 1 hour (ADR-0286), so it runs hourly on its own timer
// (citoviso-offer-followup.timer → scripts/offer-followup.mts, ADR-0287).
// ADR-0098: the AAM-cap SMS guard rides the same daily tick — the threshold is
// crossed at most twice a year, daily resolution is plenty. Loud, non-blocking.
try {
  const a = await checkAamAlert(now);
  console.log(`aam-alert @ ${now.toISOString()}:`, JSON.stringify(a));
} catch (e) {
  console.error("aam-alert HIBA:", e);
  sideStepFailed = true;
}
// ADR-0283: a failed invoice is re-issued once a day, at most INVOICE_AUTO_RETRY_LIMIT
// times — the buyer paid; a fixed Számlázz account must reach them without a human.
try {
  const i = await retryFailedInvoices(now);
  console.log(`invoice-retry @ ${now.toISOString()}:`, JSON.stringify(i));
} catch (e) {
  console.error("invoice-retry HIBA:", e);
  sideStepFailed = true;
}
await db.destroy();
if (sideStepFailed) process.exitCode = 1;
