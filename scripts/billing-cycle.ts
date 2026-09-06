// Run the subscription renewal + dunning tick (ADR-0080). Invoked daily by the
// citoviso-billing.timer; --now injects the reference time so the ladder is
// testable step by step:
//   tsx scripts/billing-cycle.ts [--now=2026-09-29] [--tenant=<uuid>]
// --tenant: dev/teszt szűkítés EGY tenantra (FK-006 időutazás a közös dev DB-ben).
import { runBillingCycle } from "../src/payment/billing.js";
import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { checkAamAlert } from "../src/console/aamAlert.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
const tenantId = tenantArg ? tenantArg.slice("--tenant=".length) : undefined;

if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

const r = await runBillingCycle(now, tenantId ? { tenantId } : undefined);
console.log(`billing-cycle @ ${now.toISOString()}:`, JSON.stringify(r));
// ADR-0088 §4b: the escalation follow-up rides the same daily tick — its
// 24–48h window is wider than the tick interval, so daily resolution suffices.
// Failures are per-prospect and loud; they never block the billing result.
try {
  const f = await sendEscalationFollowups(now);
  console.log(`offer-followup @ ${now.toISOString()}:`, JSON.stringify(f));
} catch (e) {
  console.error("offer-followup HIBA:", e);
}
// ADR-0098: the AAM-cap SMS guard rides the same daily tick — the threshold is
// crossed at most twice a year, daily resolution is plenty. Loud, non-blocking.
try {
  const a = await checkAamAlert(now);
  console.log(`aam-alert @ ${now.toISOString()}:`, JSON.stringify(a));
} catch (e) {
  console.error("aam-alert HIBA:", e);
}
await db.destroy();
