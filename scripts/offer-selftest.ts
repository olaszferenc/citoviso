// ADR-0088 offer-layer self-test — runs against the shared dev DB. The pg pool
// hands each query a different connection, so a raw BEGIN/ROLLBACK would NOT
// wrap them — instead every created row is tracked and deleted in `finally`
// (prospect deletion cascades its offers and views; nothing else is touched).
// Red/green: exits 1 loudly on the first failed expectation.
//
//   npx tsx scripts/offer-selftest.ts
//
// What it proves (the parts a tsc pass cannot):
//   • entitlement: no sent_at stamp → NO intro offer (direct path stays list)
//   • sent_at stamp → intro offer materialises lazily, −25%
//   • no stacking: escalation (−50%) + outreach (−25%) → the ONE largest wins
//   • expiry: an expired escalation stops winning (falls back to −25%)
//   • redemption: used_count reaches max_uses → the offer stops resolving,
//     and a webhook-retry double-redeem cannot over-burn it
//   • EGYSZERI: a second escalation insert is refused by the unique index
//   • coupon: tenant-scoped resolution + applyOffer floor math

import { db } from "../src/db/client.js";
import {
  applyOffer,
  bestActiveCouponForTenant,
  bestActiveOfferForProspect,
  ensureOutreachOffer,
  redeemOffer,
} from "../src/payment/offers.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${ok ? "✓ " : "✗ "} ${name}\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`,
  );
  if (!ok) failures++;
}

const madeProspects: string[] = [];
let madeTenant: string | null = null;

try {
  // Borrow an existing lead (read-only anchor) that has no tenant yet, so the
  // coupon leg can hang a throwaway tenant off it without tripping one-per-lead.
  const lead = await db
    .selectFrom("lead")
    .leftJoin("tenant", "tenant.lead_id", "lead.id")
    .select("lead.id as id")
    .where("tenant.id", "is", null)
    .limit(1)
    .executeTakeFirst();
  if (!lead) throw new Error("nincs tenant nélküli lead a dev DB-ben — a teszt horgony nélkül maradt");

  // 1) Direct prospect (no sent_at) → list price, no offer.
  const direct = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `offer-selftest-direct-${process.pid}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  madeProspects.push(direct.id);
  check("direkt út (nincs sent_at) → nincs ajánlat", await bestActiveOfferForProspect(direct.id), null);

  // 2) Outreach-touched prospect → intro offer materialises, −25%.
  const touched = await db
    .insertInto("prospect")
    .values({
      lead_id: lead.id,
      token: `offer-selftest-touched-${process.pid}`,
      sent_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  madeProspects.push(touched.id);
  const intro = await bestActiveOfferForProspect(touched.id);
  check("outreach-érintett → intro ajánlat −25%", intro && [intro.kind, intro.percent], ["outreach", 25]);
  await ensureOutreachOffer(touched.id); // second call must not duplicate
  const introCount = await db
    .selectFrom("offer")
    .select(db.fn.countAll<number>().as("n"))
    .where("prospect_id", "=", touched.id)
    .executeTakeFirst();
  check("idempotens materializálás (1 sor)", Number(introCount?.n), 1);

  // 3) Escalation joins → the single LARGEST wins (no stacking).
  const esc = await db
    .insertInto("offer")
    .values({
      kind: "escalation",
      prospect_id: touched.id,
      percent: 50,
      scope: "initial",
      expires_at: new Date(Date.now() + 3_600_000),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const best = await bestActiveOfferForProspect(touched.id);
  check("eszkaláció mellett a legnagyobb EGY nyer (−50%)", best && [best.kind, best.percent], ["escalation", 50]);

  // 4) EGYSZERI: a second escalation row is refused by the unique index.
  const dup = await db
    .insertInto("offer")
    .values({
      kind: "escalation",
      prospect_id: touched.id,
      percent: 60,
      scope: "initial",
      expires_at: new Date(Date.now() + 3_600_000),
    })
    .onConflict((oc) => oc.doNothing())
    .returning("id")
    .executeTakeFirst();
  check("második eszkaláció nem jöhet létre (unique index)", dup ?? null, null);

  // 5) Expiry: push the escalation into the past → −25% wins again.
  await db
    .updateTable("offer")
    .set({ expires_at: new Date(Date.now() - 1000) })
    .where("id", "=", esc.id)
    .execute();
  const afterExpiry = await bestActiveOfferForProspect(touched.id);
  check("lejárt eszkaláció → vissza az intro −25%-ra", afterExpiry && afterExpiry.percent, 25);

  // 6) Redemption: burning max_uses kills resolution; double-redeem cannot over-burn.
  const introRow = await db
    .selectFrom("offer")
    .select("id")
    .where("prospect_id", "=", touched.id)
    .where("kind", "=", "outreach")
    .executeTakeFirstOrThrow();
  await redeemOffer(introRow.id);
  await redeemOffer(introRow.id); // webhook retry
  const used = await db
    .selectFrom("offer")
    .select("used_count")
    .where("id", "=", introRow.id)
    .executeTakeFirstOrThrow();
  check("dupla beváltás nem éget túl (max_uses=1)", used.used_count, 1);
  check("elhasznált ajánlat nem oldódik fel többé", await bestActiveOfferForProspect(touched.id), null);

  // 7) applyOffer floor math (never overcharges by rounding).
  check("applyOffer 39000 · −25%", applyOffer(39000, { percent: 25 }), 29250);
  check("applyOffer 9990 · −50%", applyOffer(9990, { percent: 50 }), 4995);
  check("applyOffer kerekítés lefelé (1001 · −25%)", applyOffer(1001, { percent: 25 }), 750);

  // 8) Coupon: tenant-scoped resolution.
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "OFFER-SELFTEST (törlődik)" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  madeTenant = tenant.id;
  check("tenant kupon nélkül → null", await bestActiveCouponForTenant(tenant.id), null);
  await db
    .insertInto("offer")
    .values({
      kind: "coupon",
      tenant_id: tenant.id,
      percent: 25,
      scope: "purchase",
      expires_at: new Date(Date.now() + 86_400_000),
    })
    .execute();
  const coupon = await bestActiveCouponForTenant(tenant.id);
  check("üdvözlő kupon feloldódik (−25%)", coupon && [coupon.kind, coupon.percent], ["coupon", 25]);
} finally {
  // Tear down ONLY our rows; offer/mock_view rows cascade off the prospects.
  if (madeTenant) {
    await db.deleteFrom("offer").where("tenant_id", "=", madeTenant).execute();
    await db.deleteFrom("tenant").where("id", "=", madeTenant).execute();
  }
  if (madeProspects.length) {
    await db.deleteFrom("prospect").where("id", "in", madeProspects).execute();
  }
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n✗ OFFER-SELFTEST: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ OFFER-SELFTEST: minden ellenőrzés zöld (a teszt-sorok törölve, a DB érintetlen)");
