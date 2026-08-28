// Run the subscription renewal + dunning tick (ADR-0080). Invoked daily by the
// citoviso-billing.timer; --now injects the reference time so the ladder is
// testable step by step:
//   tsx scripts/billing-cycle.ts [--now=2026-09-29]
import { runBillingCycle } from "../src/payment/billing.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();

if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

const r = await runBillingCycle(now);
console.log(`billing-cycle @ ${now.toISOString()}:`, JSON.stringify(r));
await db.destroy();
