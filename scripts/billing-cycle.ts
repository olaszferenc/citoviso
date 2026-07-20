// Run the recurring billing cycle (Slice 3). Pilot: invoked manually or by cron.
//   tsx scripts/billing-cycle.ts [--now=2026-09-01] [--grace=7]
// --now injects the reference time (default: real now) so the loop is testable.
import { runBillingCycle } from "../src/payment/billing.js";
import { db } from "../src/db/client.js";

const nowArg = process.argv.find((a) => a.startsWith("--now="));
const graceArg = process.argv.find((a) => a.startsWith("--grace="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();
const graceDays = graceArg ? Number(graceArg.slice("--grace=".length)) : 7;

if (Number.isNaN(now.getTime())) {
  console.error("invalid --now date");
  process.exit(1);
}

const r = await runBillingCycle(now, { graceDays });
console.log(`billing-cycle @ ${now.toISOString()} (grace ${graceDays}d):`, JSON.stringify(r));
await db.destroy();
