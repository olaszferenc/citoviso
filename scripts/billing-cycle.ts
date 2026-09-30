// Run the subscription renewal + dunning tick (ADR-0080). Invoked daily by the
// citoviso-billing.timer; --now injects the reference time so the ladder is
// testable step by step:
//   tsx scripts/billing-cycle.ts [--now=2026-09-29] [--tenant=<uuid>]
// --tenant: dev/teszt szűkítés EGY tenantra (FK-006 időutazás a közös dev DB-ben).
import { runBillingCycle } from "../src/payment/billing.js";
import { checkAamAlert } from "../src/console/aamAlert.js";
import { retryFailedInvoices } from "../src/billing/invoiceRetry.js";
import { db } from "../src/db/client.js";

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
// ADR-0088 §4b: the escalation follow-up NO LONGER rides this daily tick — its delay is
// operator-set from 1 hour (ADR-0286), so it runs hourly on its own timer
// (citoviso-offer-followup.timer → scripts/offer-followup.mts, ADR-XXXX).
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
