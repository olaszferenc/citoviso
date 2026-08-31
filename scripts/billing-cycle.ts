// Run the subscription renewal + dunning tick (ADR-0080). Invoked daily by the
// citoviso-billing.timer; --now injects the reference time so the ladder is
// testable step by step:
//   tsx scripts/billing-cycle.ts [--now=2026-09-29]
import { runBillingCycle } from "../src/payment/billing.js";
import { sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();

if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

const r = await runBillingCycle(now);
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
await db.destroy();
