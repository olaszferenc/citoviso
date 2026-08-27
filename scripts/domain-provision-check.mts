// Regression guard for the AUTOMATED CUSTOM-DOMAIN BESZERZÉS (ADR-0071).
//
// WHAT IT PROVES: the FIZETÉS-triggered state machine drives a custom domain from
// `pending` all the way to `live` with the mock adapters, flips site.custom_domain
// ON (so public.ts 301s the slug host, ADR-0041) — and ONLY at the final live step —
// and is idempotent + resumable, because a domain purchase is real money and not
// returnable: a crash mid-propagation must never lose or double-buy.
//
// Measured invariants:
//   * HAPPY PATH — mock domain runs pending→live, custom_domain set, status live.
//   * TIMING — custom_domain stays NULL until 'live' (never 301 to a dead host).
//   * FAILURE — a 'taken' domain ends 'failed' with an error, custom_domain untouched.
//   * PROPAGATION — a 'dnsfail' domain parks at dns_pending and a re-run is a safe
//     no-op (no crash, no double register), i.e. resumable.
//   * IDEMPOTENCE — startDomainProvisioning refuses a second RUNNING row per domain
//     (the partial unique index), so a double webhook cannot start two purchases.
//   * ROUTE WIRING — handleWebhook actually calls the provisioner (a correct engine
//     is worthless if the webhook never fires it).
//
// ISOLATION: own throwaway database, dropped at the end (the dev DB is shared).
//
// Run:  npx tsx scripts/domain-provision-check.mts
//       npx tsx scripts/domain-provision-check.mts --self-test   (must go RED)

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
const SCRATCH = "citoviso_domain_check";
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

// ── 1. ROUTE WIRING — the webhook must fire the provisioner ──────────────────
const svc = readFileSync("src/payment/service.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok(/provisionOrderDomain/.test(svc), "a webhook importálja a domain-beszerzőt");
ok(
  /kind === "domain_upgrade"[\s\S]*?fireDomainProvisioning/.test(svc),
  "utólagos (domain_upgrade) rendelésnél a webhook elindítja a beszerzést",
);
ok(
  /activated\)\s*fireDomainProvisioning/.test(svc),
  "initial rendelésnél a beszerzés az élesítés UTÁN indul (regisztrált domain eset)",
);

// ── 1b. A FELÜLET BEKÖTÉSE (ADR-0078) — a motor semmit sem ér, ha a fül nem hívja ──
const views = readFileSync("src/server/adminViews.ts", "utf8");
const pub = readFileSync("src/server/public.ts", "utf8");
ok(/id: "webcim"/.test(views), "a „Webcím” fül szerepel a tenant-admin menüjében");
ok(/domainSection\(/.test(views), "a fül rendereli a domain-szekciót");
ok(
  /pathname === "\/admin\/domain\/order"/.test(pub),
  "létezik a megrendelés route (/admin/domain/order)",
);
// A SORREND számít: előbb rendelés, utána pay-link. A távolság azért 600, mert a
// két hívás közé a fail-closed hibakezelés esik (rendelés nélkül nincs fizetés).
ok(
  /createDomainUpgradeOrder\([\s\S]{0,600}?requestPayment\(/.test(pub),
  "⭐ a route ELŐBB rendelést hoz létre, majd fizetési linket kér",
  "a domaint sosem vehetjük meg fizetés előtt",
);
ok(
  !/provisionOrderDomain/.test(pub.slice(pub.indexOf('pathname === "/admin/domain/order"'), pub.indexOf('pathname === "/admin/domain/order"') + 1200)),
  "⭐ a megrendelés route NEM indít beszerzést (azt a fizetett webhook teszi)",
  "fizetés előtti vásárlás — idegen pénzen vennénk domaint",
);
// A lokál-teszt kapu: mock módban a slug-hoszt NEM 301-ezhet a nem létező domainre.
ok(
  /site\.viaSlug && site\.customDomain && !isMockDomainProvisioning\(\)/.test(pub),
  "⭐ lokál (mock) módban a régi cím kiszolgál, nem irányít halott domainre",
  "e nélkül a tesztfolyamat közepén elveszne a lokál honlap",
);
ok(
  /prospect/.test(readFileSync("scripts/demo-tenant.mts", "utf8")),
  "a demó-tenant prospectet is kap (különben egyetlen fizetős funkció sem próbálható lokálban)",
);

// ── 2. BEHAVIOUR ─────────────────────────────────────────────────────────────
async function admin(sql: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(sql);
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
process.env.REGISTRAR_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { startDomainProvisioning, runDomainProvisioning, resumePendingDomainProvisionings } = await import("../src/domains/provisionDomain.js");
const { createDomainUpgradeOrder, quoteDomainUpgrade } = await import("../src/domains/domainUpgrade.js");
const { provisionOrderDomain } = await import("../src/domains/provisionDomain.js");

let tok = 0;
async function makeSite(name: string, preview: string): Promise<{ tenantId: string; siteId: string }> {
  const def = await db.insertInto("scraper_definition")
    .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run")
    .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name, raw: sql`'{}'::jsonb` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant")
    .values({ lead_id: lead.id, display_name: name } as never).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("prospect")
    .values({ lead_id: lead.id, token: `domProsp${tok++}` } as never).execute();
  const site = await db.insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: preview, status: "live" } as never)
    .returning("id").executeTakeFirstOrThrow();
  return { tenantId: tenant.id, siteId: site.id };
}

async function siteRow(siteId: string) {
  return db.selectFrom("site")
    .select(["custom_domain", "custom_domain_status", "registrar_ref", "domain_provision_error"])
    .where("id", "=", siteId).executeTakeFirstOrThrow();
}

// ── HAPPY PATH ──
{
  const { tenantId, siteId } = await makeSite("Happy", "domTokHappy01");
  const id = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "happypanzio.hu", years: 2 });

  const mid = await siteRow(siteId);
  ok(mid.custom_domain === null, "⭐ a custom_domain NULL marad, amíg nem 'live' (nem 301-ez halott hosztra)",
    `custom_domain=${mid.custom_domain}`);
  ok(mid.custom_domain_status === "pending", "start után a state 'pending'", `state=${mid.custom_domain_status}`);

  const status = SELF_TEST ? "failed" : await runDomainProvisioning(id);
  ok(status === "live", "⭐ a mock beszerzés végigfut pending→live", `status=${status}`);
  const done = await siteRow(siteId);
  ok(done.custom_domain === "happypanzio.hu", "⭐ 'live'-nál a custom_domain élesedik", `custom_domain=${done.custom_domain}`);
  ok(done.custom_domain_status === "live", "a site state 'live'", `state=${done.custom_domain_status}`);
  ok(Boolean(done.registrar_ref), "a registrar-referencia eltárolva (auto-renew/átszállás)", `ref=${done.registrar_ref}`);
  ok(done.domain_provision_error === null, "sikeres beszerzésnél nincs hibaüzenet");

  // IDEMPOTENCE — re-run a completed provisioning is a safe no-op.
  const again = await runDomainProvisioning(id);
  ok(again === "live", "befejezett beszerzés újrafuttatása 'live' marad (idempotens)", `status=${again}`);
}

// ── FAILURE: a taken domain ──
{
  const { tenantId, siteId } = await makeSite("Taken", "domTokTaken01");
  const id = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "already-taken.hu", years: 1 });
  const status = await runDomainProvisioning(id);
  ok(status === "failed", "⭐ foglalt domain → 'failed' (nem veszünk rossz domaint)", `status=${status}`);
  const row = await siteRow(siteId);
  ok(row.custom_domain === null, "foglalt domainnél a custom_domain érintetlen (NULL)", `custom_domain=${row.custom_domain}`);
  ok(Boolean(row.domain_provision_error), "a hibaüzenet eltárolva a diagnosztikához", `err=${row.domain_provision_error}`);
}

// ── PROPAGATION: dns not yet active → parks, re-run is safe ──
{
  const { tenantId, siteId } = await makeSite("Slow", "domTokSlow01");
  const id = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "dnsfail-slow.hu", years: 1 });
  const s1 = await runDomainProvisioning(id);
  ok(s1 === "dns_pending", "⭐ nem-aktív zóna → dns_pending (nem hazudik live-ot)", `status=${s1}`);
  const s2 = await runDomainProvisioning(id);
  ok(s2 === "dns_pending", "újrafuttatás dns_pending marad (resumable, nem crashel, nem vesz újra)", `status=${s2}`);
  const row = await siteRow(siteId);
  ok(row.custom_domain === null, "propagáció alatt a custom_domain még NULL", `custom_domain=${row.custom_domain}`);
  ok(Boolean(row.registrar_ref), "a domain viszont MÁR megvéve (registrar_ref megvan) — nem vesszük újra", `ref=${row.registrar_ref}`);
}

// ── IDEMPOTENCE: a double webhook cannot start two purchases for one domain ──
{
  const { tenantId, siteId } = await makeSite("Dup", "domTokDup01");
  const a = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "dup-guard.hu", years: 1 });
  const b = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "dup-guard.hu", years: 1 });
  ok(a === b, "⭐ ugyanarra a domainre a második start ugyanazt a sort adja (nincs dupla vétel)", `a=${a} b=${b}`);
  const count = await db.selectFrom("domain_provisioning")
    .select(({ fn }) => fn.countAll<string>().as("n"))
    .where("domain", "=", "dup-guard.hu").executeTakeFirstOrThrow();
  ok(Number(count.n) === 1, "egyetlen beszerzés-sor a domainhez", `sorok: ${count.n}`);
}

// ── UTÓLAGOS VÉTEL: existing tenant → order → paid webhook path → live ──
{
  const { tenantId, siteId } = await makeSite("Upgrade", "domTokUpg01");

  const quote = quoteDomainUpgrade("uj-domain.hu");
  ok(quote?.domain === "uj-domain.hu", "a quote normalizálja a domaint");
  ok((quote?.price ?? 0) > 0, "a quote árat ad (custom_domain_yearly)", `ár=${quote?.price}`);
  ok(quote?.commitmentMonths === 24, "⭐ a quote 24 hó elköteleződést mond (ADR-0020)", `hó=${quote?.commitmentMonths}`);
  ok(quoteDomainUpgrade("nincs-vegzodes") === null, "hibás domain (nincs végződés) → nincs quote (null)");

  const orderId = SELF_TEST ? null : await createDomainUpgradeOrder(tenantId, "uj-domain.hu");
  ok(Boolean(orderId), "az utólagos domain-rendelés létrejön", "createDomainUpgradeOrder null-t adott");
  if (orderId) {
    const oi = await db.selectFrom("order_intent").selectAll().where("id", "=", orderId).executeTakeFirstOrThrow();
    ok(oi.kind === "domain_upgrade", "a rendelés 'domain_upgrade' fajtájú", `kind=${oi.kind}`);
    ok(oi.tenant_id === tenantId, "a rendelés az élő tenanthoz kötött");
    ok(oi.domain_type === "citoviso_registered", "domain_type = citoviso_registered");
    ok(oi.domain_name === "uj-domain.hu", "a rendelés a választott domaint hordozza");
    ok(Number(oi.commitment_months) === 24, "⭐ 24 hó elköteleződés a rendelésen", `hó=${oi.commitment_months}`);

    // The webhook path: on 'paid', provisionOrderDomain runs the whole beszerzés.
    const status = await provisionOrderDomain(orderId);
    ok(status === "live", "⭐ fizetés-triggerelt beszerzés → ÉLES (utólagos vétel)", `status=${status}`);
    const row = await siteRow(siteId);
    ok(row.custom_domain === "uj-domain.hu", "⭐ a meglévő site átköltözött az új domainre", `custom_domain=${row.custom_domain}`);
  }
}

// ── RESUME POLLER: a parked provisioning gets nudged; live ones are skipped ──
{
  const { tenantId, siteId } = await makeSite("Resume", "domTokRes01");
  // Park it: mock 'dnsfail' → stops at dns_pending on first run.
  const id = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "dnsfail-resume.hu", years: 1 });
  await runDomainProvisioning(id);
  const before = await siteRow(siteId);
  ok(before.custom_domain_status === "dns_pending", "parkolt beszerzés dns_pending-ben áll", `state=${before.custom_domain_status}`);

  const swept = await resumePendingDomainProvisionings();
  ok(swept.some((s) => s.id === id), "⭐ a poller felszedi a függő beszerzést", `felszedve: ${swept.map((s) => s.domain).join(",")}`);
  ok(!swept.some((s) => s.status === "live" && s.domain === "dnsfail-resume.hu"),
    "a mock dnsfail a pollerrel is dns_pending marad (nem hazudik live-ot)");
}

await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

console.log(failed === 0 ? "\n✅ MIND ZÖLD" : `\n❌ ${failed} BUKÁS`);
process.exit(failed === 0 ? 0 : 1);
