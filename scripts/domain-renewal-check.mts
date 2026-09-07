// Regression guard for the DOMAIN-YEAR RENEWAL FEE (ADR-0100).
//
// WHAT IT PROVES: the custom domain's 2nd+ year fee is collected by the ONE
// anchor renewal whose period contains the domain anniversary — as its own
// order/invoice component — and is re-resolved against the CURRENT package
// (ADR-0093 ②: waived above the threshold). Before ADR-0100 nobody billed it:
// the renewal engine priced modules only, while the registrar renews on OUR cost.
//
// Measured invariants:
//   * FEE DUE — annual renewal whose period holds the anniversary carries
//     price = package + yearly fee, domain_fee + domain_name stamped.
//   * IDEMPOTENT — a second mint for the same period returns the SAME order
//     (no double fee on timer re-runs).
//   * WAIVED — above the operator-set package threshold the fee is 0: no
//     domain_fee, price = package only.
//   * MONTHLY WINDOW — with monthly billing ONLY the cycle containing the
//     anniversary bills the fee; the cycle before it does not.
//   * NOT OURS — a failed/never-registered domain never bills.
//   * INVOICE LINE — the fee is its own invoice item (structural), and a
//     'domain_upgrade' order gets a domain line, not "előfizetés (0 modul)".
//
// ISOLATION: own throwaway database, dropped at the end (the dev DB is shared).
//
// Run:  npx tsx scripts/domain-renewal-check.mts
//       npx tsx scripts/domain-renewal-check.mts --self-test   (must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH = "citoviso_domain_renewal_check";
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

// ── 1. STRUCTURAL — the fee path exists end to end ──────────────────────────
const billing = readFileSync("src/payment/billing.ts", "utf8");
ok(/domainFeeForRenewal/.test(billing), "a megújulás-motor minden ciklusban szedi a havidíjat (domainFeeForRenewal)");
ok(
  // ⛔ Structure, not the English word: the first version of this guard grepped for
  // "anniversary" and went RED on the comment DOCUMENTING the removal.
  !/domainFeeForPeriod/.test(billing) && !/setFullYear\(/.test(billing),
  "⭐ az évforduló-ablak KIVEZETVE (ADR-0109 felülírja az ADR-0100 ①–②-t)",
  "havi díjnál nincs „melyik ciklus szedi” kérdés — mindegyik szedi",
);
ok(
  /const total = price \+ domainFee/.test(billing),
  "⭐ a díj a kupon-kedvezmény UTÁN adódik a teljes árhoz (kedvezmény sosem éri)",
  "az ajánlat a MI szolgáltatásunkat árazza, a domain átfolyó registrar-költség",
);
ok(
  /domain_fee: domainFee, domain_name: domainDue\.domain/.test(billing),
  "a renewal order viszi a domain_fee-t és a domain nevét (számla-tételhez)",
);
const svc = readFileSync("src/payment/service.ts", "utf8");
ok(/buildInvoiceItems/.test(svc) && /order_intent\.domain_fee as domainFee/.test(svc),
  "a számla-kiállító olvassa a domain_fee-t és tételekre bont");
ok(
  /kind === "domain_upgrade"\) return \[line\(domainLabel/.test(svc),
  "⭐ a domain_upgrade számlája saját domain-tételt kap (nem „előfizetés, 0 modul”)",
);
const console_ = readFileSync("src/console/server.ts", "utf8");
ok(/domainFee: domainFee \|\| null/.test(console_), "az induló rendelés is lepecsételi a domain_fee-t");

// ── 2. BEHAVIOUR (scratch DB) ───────────────────────────────────────────────
async function admin(sqlText: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(sqlText);
  await c.end();
}
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});

process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { mintRenewalForTenant } = await import("../src/payment/billing.js");
const {
  loadPricing,
  getCustomDomainMonthly,
  domainFeeForCycle,
  computeAnnual,
  computeMonthly,
  pricingSnapshot,
  savePricing,
} = await import("../src/pricing.js");

/** Operator-set knob via the real pricing API; forces the snapshot fresh. */
async function setThreshold(minPackageMonthly: number): Promise<void> {
  await loadPricing(true);
  const s = pricingSnapshot();
  await savePricing({
    baseMonthly: s.baseMonthly,
    annualFreeMonths: s.annualFreeMonths,
    customDomainMonthly: s.customDomainMonthly,
    domainMaxPriceEur: s.domainMaxPriceEur,
    domainMinCommitmentMonths: s.domainMinCommitmentMonths,
    domainMinPackageMonthly: minPackageMonthly,
    domainBuyoutPrice: s.domainBuyoutPrice,
    pricingConfirmed: s.pricingConfirmed,
    modulePrices: Object.fromEntries(s.modulePrices),
  } as never);
  await loadPricing(true);
}

let tok = 0;
async function makeTenant(opts: {
  name: string;
  billingPeriod: "monthly" | "annual";
  periodEnd: Date;
  domain?: string | null;
  domainStatus?: string;
  registeredAt?: Date | null;
}): Promise<string> {
  const def = await db.insertInto("scraper_definition")
    .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run")
    .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: opts.name, raw: sql`'{}'::jsonb` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant")
    .values({ lead_id: lead.id, display_name: opts.name } as never)
    .returning("id").executeTakeFirstOrThrow();
  await db.insertInto("prospect")
    .values({ lead_id: lead.id, token: `domRenew${tok++}` } as never).execute();
  await db.insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `domRenewTok${tok}`,
      status: "live",
      custom_domain: opts.domain ?? null,
      custom_domain_status: (opts.domainStatus ?? (opts.domain ? "live" : "none")) as never,
      domain_registered_at: opts.registeredAt ?? null,
    } as never)
    .execute();
  const start = new Date(opts.periodEnd);
  start.setMonth(start.getMonth() - (opts.billingPeriod === "annual" ? 12 : 1));
  await db.insertInto("subscription")
    .values({
      tenant_id: tenant.id,
      billing_period: opts.billingPeriod,
      anchor_date: start,
      current_period_start: start,
      current_period_end: opts.periodEnd,
      status: "active",
    } as never)
    .execute();
  return tenant.id;
}

async function orderRow(orderId: string) {
  return db.selectFrom("order_intent")
    .select(["price", "domain_fee", "domain_name"])
    .where("id", "=", orderId).executeTakeFirstOrThrow();
}

const T = new Date("2027-06-15T00:00:00");
const NOW = new Date("2027-06-15T00:00:00");

// ── EVERY CYCLE BILLS (annual): 12 x the monthly fee, no anniversary ──
{
  await setThreshold(1); // the threshold is an ENTRY condition now — irrelevant here
  const tid = await makeTenant({
    name: "Éves Panzió",
    billingPeriod: "annual",
    periodEnd: T,
    domain: "evespanzio.hu",
    // --self-test breaks the INPUT (a domain we do not hold), so the fee-due
    // assertions below must go RED. An assertion suite that cannot fail is décor.
    domainStatus: SELF_TEST ? "failed" : undefined,
    registeredAt: new Date("2026-08-15T00:00:00"),
  });
  const fee = domainFeeForCycle(12);
  ok(
    fee === getCustomDomainMonthly() * 12,
    "az éves ciklus díja = 12 x havidíj",
    `fee=${fee}, havidíj=${getCustomDomainMonthly()}`,
  );
  const { orderIntentId, price } = await mintRenewalForTenant(tid, NOW);
  ok(!!orderIntentId, "éves megújulás: order létrejön");
  const row = await orderRow(orderIntentId!);
  ok(
    price === computeAnnual([]) + fee,
    "⭐ a megújulás ára = csomag + a ciklus saját-cím díja",
    `price=${price}, várt=${computeAnnual([])}+${fee}`,
  );
  ok(Number(row.domain_fee) === fee, "a domain_fee lepecsételve", `domain_fee=${row.domain_fee}`);
  ok(row.domain_name === "evespanzio.hu", "a domain neve az orderen (számla-tétel)", `név=${row.domain_name}`);

  // ── IDEMPOTENT: a timer re-run must not double the fee ──
  const again = await mintRenewalForTenant(tid, NOW);
  ok(again.orderIntentId === orderIntentId, "⭐ újrafuttatás UGYANAZT az ordert adja (nincs dupla díj)");
  ok(again.price === price, "az ár változatlan az újrafuttatáson", `ár=${again.price}`);
}

// ── NO WAIVER: a huge package pays the same fee (ADR-0093 ② kivezetve) ──
{
  await setThreshold(1); // "any package clears the bar" used to mean FREE — no longer
  const tid = await makeTenant({
    name: "Nagy Csomag Panzió",
    billingPeriod: "annual",
    periodEnd: T,
    domain: "nagycsomag.hu",
    registeredAt: new Date("2026-08-15T00:00:00"),
  });
  const { orderIntentId, price } = await mintRenewalForTenant(tid, NOW);
  const row = await orderRow(orderIntentId!);
  ok(
    price === computeAnnual([]) + domainFeeForCycle(12),
    "⭐ NINCS ingyen-ág: a nagy csomag is fizeti a havidíjat",
    `price=${price}`,
  );
  ok(Number(row.domain_fee) > 0, "a díj tétele ott van a nagy csomagnál is", `domain_fee=${row.domain_fee}`);
}

// ── MONTHLY CYCLE: 1 x the monthly fee, and it recurs (no anniversary window) ──
{
  await setThreshold(1);
  const fee = domainFeeForCycle(1);
  const tid = await makeTenant({
    name: "Havi Panzió",
    billingPeriod: "monthly",
    periodEnd: T,
    domain: "havipanzio.hu",
    registeredAt: new Date("2026-08-15T00:00:00"),
  });
  const first = await mintRenewalForTenant(tid, NOW);
  ok(
    first.price === computeMonthly([]) + fee,
    "⭐ a havi ciklus is szedi a díjat (nem csak az évfordulós)",
    `price=${first.price}, várt=${computeMonthly([])}+${fee}`,
  );
  ok(
    Number((await orderRow(first.orderIntentId!)).domain_fee) === fee,
    "a havi ciklus díja = 1 x havidíj",
  );
}

// ── NOT OURS: a failed beszerzés never bills (§B.17) ──
{
  await setThreshold(1);
  const tid = await makeTenant({
    name: "Bukott Domain",
    billingPeriod: "annual",
    periodEnd: T,
    domain: "bukott.hu",
    domainStatus: "failed",
    registeredAt: new Date("2026-08-15T00:00:00"),
  });
  const { price } = await mintRenewalForTenant(tid, NOW);
  ok(price === computeAnnual([]), "⭐ bukott/regisztrálatlan domain SOSEM számláz", `price=${price}`);
}

await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

if (failed) {
  console.error(`\n✗ domain-renewal-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ domain-renewal-check: a saját cím HAVI díja minden megújulási cikluson él (ADR-0109).");
