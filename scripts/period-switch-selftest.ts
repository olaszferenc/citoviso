// ADR-0088 §8 self-test — monthly→annual switch semantics. Runs on the shared
// dev DB with tracked rows + full cleanup (NOT via runBillingCycle: that would
// mint renewal orders and advance dunning state for every other session's
// tenants). Red/green: exits 1 on the first failed expectation.
//
//   npx tsx scripts/period-switch-selftest.ts
//
// What it proves:
//   • arming: monthly sub → pending_period='annual'; annual sub → refused
//   • revert: pending → NULL
//   • honest effective-date: with the next renewal ALREADY minted, arming
//     reports appliesNextCycle=true
//   • adoption: paying an ANNUAL renewal flips billing_period and clears
//     pending; paying a MONTHLY renewal (minted before arming) keeps the
//     armed switch alive — it must not be silently swallowed

import { db } from "../src/db/client.js";
import {
  applyRenewalPaid,
  setPendingBillingPeriod,
} from "../src/payment/subscription.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${ok ? "✓ " : "✗ "} ${name}\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`,
  );
  if (!ok) failures++;
}

let tenantId: string | null = null;
let prospectId: string | null = null;
const orderIds: string[] = [];

async function subState(): Promise<{ billing: string; pending: string | null }> {
  const s = await db
    .selectFrom("subscription")
    .select(["billing_period", "pending_period"])
    .where("tenant_id", "=", tenantId!)
    .executeTakeFirstOrThrow();
  return { billing: s.billing_period, pending: s.pending_period };
}

async function mintRenewal(period: "monthly" | "annual", start: Date, end: Date): Promise<string> {
  const row = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospectId!,
      kind: "renewal",
      tenant_id: tenantId!,
      modules: JSON.stringify([]),
      price: 1000,
      billing_period: period,
      status: "submitted",
      submitted_at: new Date(),
      renewal_period_start: start,
      renewal_period_end: end,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  orderIds.push(row.id);
  return row.id;
}

try {
  const lead = await db
    .selectFrom("lead")
    .leftJoin("tenant", "tenant.lead_id", "lead.id")
    .select("lead.id as id")
    .where("tenant.id", "is", null)
    .limit(1)
    .executeTakeFirst();
  if (!lead) throw new Error("nincs tenant nélküli lead a dev DB-ben");
  const t = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "PERIOD-SWITCH-SELFTEST (törlődik)" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = t.id;
  const p = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `period-switch-selftest-${process.pid}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  prospectId = p.id;

  const anchor = new Date("2026-08-15T10:00:00Z");
  const periodEnd = new Date("2026-09-15T10:00:00Z");
  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenantId,
      billing_period: "monthly",
      anchor_date: anchor,
      current_period_start: anchor,
      current_period_end: periodEnd,
    })
    .execute();

  // 1) arm on a monthly sub
  const arm = await setPendingBillingPeriod(tenantId, "annual");
  check("élesítés havi előfizetésen", [arm.ok, arm.appliesNextCycle ?? false], [true, false]);
  check("pending_period felírva", await subState(), { billing: "monthly", pending: "annual" });

  // 2) revert
  const rev = await setPendingBillingPeriod(tenantId, null);
  check("visszavonás", rev.ok, true);
  check("pending_period törölve", await subState(), { billing: "monthly", pending: null });

  // 3) minted-order case: renewal for the NEXT period already exists → honest flag
  await mintRenewal("monthly", periodEnd, new Date("2026-10-15T10:00:00Z"));
  const armLate = await setPendingBillingPeriod(tenantId, "annual");
  check("kész számla mellett: appliesNextCycle", armLate.appliesNextCycle ?? false, true);

  // 4) paying the OLD (monthly) renewal must NOT swallow the armed switch
  const paidMonthly = await applyRenewalPaid(orderIds[0]!);
  check("havi megújulás fizetve → a váltás ÉLVE marad", [
    Boolean(paidMonthly),
    (await subState()).billing,
    (await subState()).pending,
  ], [true, "monthly", "annual"]);

  // 5) paying an ANNUAL renewal adopts the period and clears the flag
  const annualOrder = await mintRenewal(
    "annual",
    new Date("2026-10-15T10:00:00Z"),
    new Date("2027-10-15T10:00:00Z"),
  );
  await applyRenewalPaid(annualOrder);
  check("éves megújulás fizetve → átvétel + törlés", await subState(), {
    billing: "annual",
    pending: null,
  });

  // 6) arming on an already-annual sub is refused
  const armAnnual = await setPendingBillingPeriod(tenantId, "annual");
  check("éves előfizetésen az élesítés elutasítva", armAnnual.ok, false);
} finally {
  if (tenantId) {
    await db.deleteFrom("dunning_event").where("order_intent_id", "in",
      db.selectFrom("order_intent").select("id").where("tenant_id", "=", tenantId)).execute();
    await db.deleteFrom("order_intent").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("subscription").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  }
  if (prospectId) await db.deleteFrom("prospect").where("id", "=", prospectId).execute();
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n✗ PERIOD-SWITCH-SELFTEST: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ PERIOD-SWITCH-SELFTEST: minden ellenőrzés zöld (a teszt-sorok törölve)");
