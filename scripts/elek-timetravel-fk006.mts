// FK-006 time-travel driver (Elek-rend, owner go-ahead 2026-09-06: "mehet az időutazás").
//
// Walks the ADR-0080 dunning ladder for the ELEK-TESZT tenant ONLY, with an
// injected reference time — the shared dev DB's other tenants never move
// (runBillingCycle tenantId filter exists exactly for this).
//
//   npx tsx scripts/elek-timetravel-fk006.mts <stage>
//
// stages (in order):
//   prenotify  → T−3  (2027-09-02): előértesítő levél
//   due        → T0   (2027-09-05): token-terhelés BUKIK (MOCK_RECURRING_FAIL) → fizetőlink-levél
//   remind     → T+3  (2027-09-08): emlékeztető
//   final      → T+7  (2027-09-12): utolsó figyelmeztetés
//   freeze     → T+10 (2027-09-15): felfüggesztés — vendégnek „átmenetileg nem elérhető”
//   thaw       → a nyitott megújulás-fizetés mock-webhookon PAID → azonnali visszakapcsolás
//   bookingexpire → egy pending foglalás-kérés 49 órásra tolva + lejáratás (vendég-levél)
//
// ⛔ Guards: dev-only (no DATABASE_URL), ELEK tenant only, gateway+SMS forced to
// mock, ELEK_RUN=1 so the mail transport refuses any non-elek@ recipient.

process.env.ELEK_RUN = "1";
process.env.PAYMENT_GATEWAY = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";

const ELEK_TENANT = "debb1c22-3a05-40e9-a5a3-ec91b088da74";

if (process.env.DATABASE_URL) {
  console.error("⛔ DATABASE_URL be van állítva — ez a driver CSAK a lokál dev DB-n futhat.");
  process.exit(1);
}

const stage = process.argv[2] ?? "";
// Stage dates DERIVE from the subscription's live period_end (each full walk
// advances a year — hardcoded dates would go stale after the first thaw).
const STAGE_OFFSET: Record<string, number> = {
  prenotify: -3,
  due: 0,
  remind: 3,
  final: 7,
  freeze: 10,
};

const { db, pool } = await import("../src/db/client.js");

async function stageDate(offsetDays: number): Promise<string> {
  const sub = await db
    .selectFrom("subscription")
    .select("current_period_end")
    .where("tenant_id", "=", ELEK_TENANT)
    .executeTakeFirst();
  if (!sub) {
    console.error("⛔ nincs subscription az ELEK tenanton");
    process.exit(1);
  }
  const d = new Date(`${String(sub.current_period_end).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function tick(nowIso: string): Promise<void> {
  // The failing-charge branch is the POINT of the ladder walk.
  process.env.MOCK_RECURRING_FAIL = "1";
  const { runBillingCycle } = await import("../src/payment/billing.js");
  const r = await runBillingCycle(new Date(`${nowIso}T07:00:00Z`), { tenantId: ELEK_TENANT });
  console.log(`[fk006] tick @ ${nowIso} →`, JSON.stringify(r));
}

async function thaw(): Promise<void> {
  // The renewal order's open payment, settled the same way the mock pay page
  // would (parse-free webhook path, ADR-0096) — payment → thaw is the REAL code.
  const payment = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.id as id", "payment.gateway_ref as ref", "payment.status as status"])
    .where("order_intent.tenant_id", "=", ELEK_TENANT)
    .where("order_intent.kind", "=", "renewal")
    .where("payment.status", "in", ["created", "pending"])
    .orderBy("payment.created_at", "desc")
    .executeTakeFirst();
  if (!payment?.ref) {
    console.error("⛔ nincs nyitott megújulás-fizetés — előbb a due…freeze lépcsők.");
    process.exit(1);
  }
  const { applyWebhookResult } = await import("../src/payment/service.js");
  const out = await applyWebhookResult({ gatewayRef: payment.ref, status: "paid" });
  console.log(`[fk006] thaw · payment ${payment.id} →`, JSON.stringify(out));
  const sub = await db
    .selectFrom("subscription")
    .select(["status", "current_period_end"])
    .where("tenant_id", "=", ELEK_TENANT)
    .executeTakeFirst();
  const site = await db
    .selectFrom("site")
    .select("status")
    .where("tenant_id", "=", ELEK_TENANT)
    .executeTakeFirst();
  console.log(`[fk006] utána: subscription=${sub?.status} period_end=${sub?.current_period_end} site=${site?.status}`);
}

async function bookingExpire(): Promise<void> {
  // Age ONE pending request past the 48h window, then run the same expiry the
  // hourly timer runs. The guest gets the "nem érkezett válasz" mail.
  const req = await db
    .selectFrom("booking_request")
    .innerJoin("site", "site.id", "booking_request.site_id")
    .select(["booking_request.id as id", "booking_request.guest_name as name"])
    .where("site.tenant_id", "=", ELEK_TENANT)
    .where("booking_request.status", "=", "pending")
    .orderBy("booking_request.created_at", "desc")
    .executeTakeFirst();
  if (!req) {
    console.error("⛔ nincs pending foglalás-kérés — előbb: psql -f scripts/seed-elek-booking.sql");
    process.exit(1);
  }
  await db
    .updateTable("booking_request")
    .set({ created_at: new Date(Date.now() - 49 * 3_600_000) as unknown as never })
    .where("id", "=", req.id)
    .execute();
  const { expireStaleRequests } = await import("../src/booking/requests.js");
  const n = await expireStaleRequests();
  console.log(`[fk006] booking-expire · ${req.name} 49 órásra tolva · lejáratva: ${n}`);
}

async function status(): Promise<void> {
  const sub = await db
    .selectFrom("subscription")
    .select(["status", "current_period_end", "frozen_at"])
    .where("tenant_id", "=", ELEK_TENANT)
    .executeTakeFirst();
  const site = await db
    .selectFrom("site")
    .select("status")
    .where("tenant_id", "=", ELEK_TENANT)
    .executeTakeFirst();
  console.log(JSON.stringify({ sub, site }));
}

if (stage in STAGE_OFFSET) await tick(await stageDate(STAGE_OFFSET[stage]!));
else if (stage === "thaw") await thaw();
else if (stage === "bookingexpire") await bookingExpire();
else if (stage === "status") await status();
else {
  console.error("használat: elek-timetravel-fk006.mts <prenotify|due|remind|final|freeze|thaw|bookingexpire|status>");
  process.exit(1);
}
await pool.end();
