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
import { readFileSync, existsSync } from "node:fs";
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
// A SORREND számít: előbb rendelés, utána pay-link. A távolság azért 1600, mert a
// két hívás közé a fail-closed hibakezelés ÉS az ADR-0093 0 Ft-os (elengedett díjú)
// rendezés-ág esik (rendelés nélkül nincs fizetés).
ok(
  /createDomainUpgradeOrder\([\s\S]{0,1600}?requestPayment\(/.test(pub),
  "⭐ a route ELŐBB rendelést hoz létre, majd fizetési linket kér",
  "a domaint sosem vehetjük meg fizetés előtt",
);
// ADR-0093: a 0 Ft-os (elengedett díjú) rendelésnél nincs mit fizetni, ezért a
// route MAGA rendezi (status='paid') és indítja a beszerzést — fizetős rendelésnél
// viszont továbbra is CSAK a fizetett webhook indíthat. Azt mérjük, ami számít:
// a route-beli indítás KIZÁRÓLAG a 0-ár kapu mögött állhat.
{
  const start = pub.indexOf('pathname === "/admin/domain/order"');
  const route = pub.slice(start, start + 2200);
  const fire = route.indexOf("provisionOrderDomain(");
  const zeroGate = route.indexOf("=== 0");
  const settled = route.indexOf('status: "paid"');
  ok(
    fire === -1 || (zeroGate !== -1 && zeroGate < fire && settled !== -1 && settled < fire),
    "⭐ a route beszerzést CSAK a 0 Ft-os (rendezett) ág mögött indít — fizetősnél a webhook",
    "fizetés előtti vásárlás — idegen pénzen vennénk domaint",
  );
}
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

// ── 1c. AZ ÍGÉRET ÉS A TELJESÍTÉSE EGYÜTT (§B.17 magunkra is áll) ──
// A felület azt ígéri, hogy e-mailben szólunk. Ha a kód ezt nem teszi meg, az olyan
// állítás, amit a rendszer nem teljesít — ugyanaz a hiba-osztály, mint egy kitalált
// tény a generált oldalon. Ezért a kettőt EGYÜTT mérjük: ha az ígéret ott van, a
// küldésnek is lennie kell.
const prov = readFileSync("src/domains/provisionDomain.ts", "utf8");
const promisesMail = /E-mailben jelezzük/.test(views);
ok(promisesMail, "a felület ígéri az értesítést (a folyamat percekig fut a háttérben)");
if (promisesMail) {
  ok(
    /notifyTenant\([\s\S]{0,120}"live"/.test(prov),
    "⭐ …és SIKERES beszerzésnél tényleg megy értesítő",
    "ígéret teljesítés nélkül",
  );
  ok(
    /notifyTenant\([\s\S]{0,120}"failed"/.test(prov),
    "⭐ …és SIKERTELEN beszerzésnél is (a tenant fizetett és vár)",
    "a kudarcról magunktól kell szólni, nem a következő belépéskor",
  );
}
ok(
  /src\/email\/domainEmail\.ts/.test(readFileSync("scripts/i18n-sources.mjs", "utf8")),
  "⭐ az értesítő az i18n-őr fájllistáján van (különben némán magyarul menne ki)",
  "az őr hatóköre = a doktrína (ADR-0067/0070 kétszer ütött be)",
);

// ── 1d. AZ ÜZEMELTETÉSI RECEPT NEM VESZHET EL ──
// A beszerzés az NS/TLS-propagáció miatt PERCEKIG parkol; timer nélkül a tenant
// kifizetné a domaint, és a folyamat félúton állna — épp a „zéró emberi interakció"
// ígéret bukna a leglassabb lépésnél. A unit-fájlok ezért verziózva vannak, hogy az
// éles telepítés reprodukálható legyen (nem ad-hoc ssh-parancs).
for (const f of [
  "scripts/resume-domains.mts",
  "deploy/systemd/citoviso-domain-resume.service",
  "deploy/systemd/citoviso-domain-resume.timer",
]) {
  ok(existsSync(f), `megvan az üzemeltetési recept: ${f}`);
}

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

  const quote = await quoteDomainUpgrade(tenantId, "uj-domain.hu");
  ok(quote?.domain === "uj-domain.hu", "a quote normalizálja a domaint");
  // Code defaults: base 3900 Ft/hó < 8000 Ft free-threshold → the fee is charged.
  ok((quote?.price ?? 0) > 0, "a küszöb ALATTI csomagnál a quote árat ad (custom_domain_yearly)", `ár=${quote?.price}`);
  ok(quote?.commitmentMonths === 12, "⭐ a quote 12 hó elköteleződést mond (ADR-0093, a 24 lazítva)", `hó=${quote?.commitmentMonths}`);
  ok((await quoteDomainUpgrade(tenantId, "nincs-vegzodes")) === null, "hibás domain (nincs végződés) → nincs quote (null)");

  // ADR-0093 free-domain rule at the threshold (unit-level, code defaults):
  // 8000 Ft/hó package → 0 (waived); one forint below → the yearly fee.
  const { resolveDomainYearly, getDomainFreeMinMonthly, getCustomDomainYearly } = await import("../src/pricing.js");
  const freeMin = getDomainFreeMinMonthly();
  ok(resolveDomainYearly(freeMin) === 0, "⭐ a küszöböt elérő csomagnál a domain-díj 0 (ingyen, ADR-0093)", `küszöb=${freeMin}`);
  ok(resolveDomainYearly(freeMin - 1) === getCustomDomainYearly(), "a küszöb alatt a teljes éves díj jár", `díj=${resolveDomainYearly(freeMin - 1)}`);

  const orderId = SELF_TEST ? null : await createDomainUpgradeOrder(tenantId, "uj-domain.hu");
  ok(Boolean(orderId), "az utólagos domain-rendelés létrejön", "createDomainUpgradeOrder null-t adott");
  if (orderId) {
    const oi = await db.selectFrom("order_intent").selectAll().where("id", "=", orderId).executeTakeFirstOrThrow();
    ok(oi.kind === "domain_upgrade", "a rendelés 'domain_upgrade' fajtájú", `kind=${oi.kind}`);
    ok(oi.tenant_id === tenantId, "a rendelés az élő tenanthoz kötött");
    ok(oi.domain_type === "citoviso_registered", "domain_type = citoviso_registered");
    ok(oi.domain_name === "uj-domain.hu", "a rendelés a választott domaint hordozza");
    ok(Number(oi.commitment_months) === 12, "⭐ 12 hó elköteleződés a rendelésen (ADR-0093)", `hó=${oi.commitment_months}`);

    // The webhook path: on 'paid', provisionOrderDomain runs the whole beszerzés.
    const status = await provisionOrderDomain(orderId);
    ok(status === "live", "⭐ fizetés-triggerelt beszerzés → ÉLES (utólagos vétel)", `status=${status}`);
    const row = await siteRow(siteId);
    ok(row.custom_domain === "uj-domain.hu", "⭐ a meglévő site átköltözött az új domainre", `custom_domain=${row.custom_domain}`);
  }
}

// ── INGYEN DOMAIN (ADR-0093): küszöb feletti csomagnál a rendelés díja 0 ──
{
  const { tenantId } = await makeSite("Freebie", "domTokFree01");
  const { MODULE_CATALOG } = await import("../src/modules.js");
  // Cross the free threshold: entitle every monthly-billed catalog module.
  for (const m of MODULE_CATALOG) {
    if (m.spine || m.billing === "once") continue;
    await db.insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: m.id, active: true } as never)
      .execute();
  }
  const quote = await quoteDomainUpgrade(tenantId, "nagycsomag.hu");
  ok(quote?.price === 0, "⭐ küszöb FELETTI csomagnál a quote díja 0 (ingyen domain)", `ár=${quote?.price}`);
  const orderId = await createDomainUpgradeOrder(tenantId, "nagycsomag.hu");
  ok(Boolean(orderId), "a 0 Ft-os rendelés is létrejön");
  if (orderId) {
    const oi = await db.selectFrom("order_intent").select(["price"]).where("id", "=", orderId).executeTakeFirstOrThrow();
    ok(Number(oi.price) === 0, "⭐ a rendelésen 0 Ft az ár (amit lát = amit fizet)", `ár=${oi.price}`);
  }
}

// ── CSOMAG-PADLÓ (ADR-0094 ④): hűségidő alatt a vállalt minimum alá nem csúszhat ──
{
  const { tenantId } = await makeSite("Floor", "domTokFloor01");
  const { MODULE_CATALOG } = await import("../src/modules.js");
  const { applyModuleChange } = await import("../src/tenant/moduleChange.js");
  const { activeDomainCommitment } = await import("../src/domains/domainCommitment.js");
  const monthlyIds = MODULE_CATALOG.filter((m) => !m.spine && m.billing !== "once").map((m) => m.id);
  for (const id of monthlyIds) {
    await db.insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: id, active: true } as never)
      .execute();
  }
  // Paid free-domain order (price 0, gateway 'none') → running commitment with a floor.
  const orderId = await createDomainUpgradeOrder(tenantId, "padlopanzio.hu");
  ok(Boolean(orderId), "a padló-teszt rendelése létrejön (ingyen domain)");
  if (orderId) {
    const oi = await db.selectFrom("order_intent").select(["committed_min_monthly"]).where("id", "=", orderId).executeTakeFirstOrThrow();
    ok(Number(oi.committed_min_monthly) === 8000, "⭐ az ingyen-domain rendelés BEFAGYASZTJA a padlót (8000)", `padló=${oi.committed_min_monthly}`);
    await db.insertInto("payment")
      .values({ order_intent_id: orderId, amount: 0, currency: "HUF", period: "annual", gateway: "none", status: "paid", paid_at: new Date() } as never)
      .execute();
    const c = await activeDomainCommitment(tenantId);
    ok(c?.floorMonthly === 8000 && c.remainingMonths >= 11, "⭐ a futó hűség kiolvasható (padló + hátralévő hónapok)", `c=${JSON.stringify(c)}`);

    // Sinking below the floor (drop every module → base 3900 < 8000) is REFUSED atomically.
    const refuse = await applyModuleChange(tenantId, []);
    ok(Boolean(refuse.refusedBelowFloor), "⭐ padló alá csökkentés ELUTASÍTVA (semmi nem íródott)", JSON.stringify(refuse));
    const still = await db.selectFrom("module_entitlement")
      .select(({ fn }) => fn.countAll<string>().as("n"))
      .where("tenant_id", "=", tenantId).where("active", "=", true).where("cancel_at_period_end", "=", false)
      .executeTakeFirstOrThrow();
    ok(Number(still.n) === monthlyIds.length, "a modulok érintetlenek maradtak (atomi elutasítás)", `aktív=${still.n}`);

    // Keeping the package at/above the floor passes untouched.
    const keep = await applyModuleChange(tenantId, monthlyIds);
    ok(!keep.refusedBelowFloor, "padló FELETT a módosítás szabad (no-op átmegy)");
  }
}

// ── LEMONDÁS-ELSZÁMOLÁS (ADR-0094 ②, jóváhagyott B terv) ──
// Hűségidő alatt nincs szabad lemondás: kötbér mindig, vételár csak ha viszi a
// domaint; a route nem kerülhető meg kézzel gyártott POST-tal sem.
{
  // Szerkezeti őrök: a viselkedés-teszt scratch-DB-n fut, a route-huzalozást a
  // forráson mérjük (a motor semmit sem ér, ha a route nem hívja / megkerülhető).
  ok(
    /pathname === "\/admin\/subscription\/cancel"[\s\S]{0,900}?activeDomainCommitment/.test(pub),
    "⭐ a lemondás-route futó hűségnél a settlement-lapra terel (a UI-elágazás önmagában nem kapu)",
    "kézzel gyártott POST-tal ingyen lemondható lenne a hűséges előfizetés",
  );
  ok(
    /createSettlementOrder\([\s\S]{0,900}?requestPayment\(/.test(pub),
    "a settlement-route ELŐBB rendelést hoz létre, majd fizetési linket kér",
  );
  ok(
    /if \(!pay\) \{[\s\S]{0,200}?voidUnpaidSettlement/.test(pub),
    "⭐ pay-link hiba → az elszámolás visszavonva (fail closed, nincs félig rögzített lemondás)",
  );
  ok(
    /resume[\s\S]{0,900}?voidUnpaidSettlement/.test(pub),
    "⭐ meggondolásnál (resume) a kifizetetlen elszámolás törlődik (nincs függő pénz-igény)",
  );
  ok(
    /kind === "domain_settlement"[\s\S]{0,900}?issueInvoiceFor/.test(svc),
    "a webhook a kifizetett elszámolást számlázza és NEM aktivál újra",
  );

  const { tenantId } = await makeSite("Settle", "domTokSettle01");
  const { MODULE_CATALOG } = await import("../src/modules.js");
  const { settlementQuote, createSettlementOrder, openSettlement, voidUnpaidSettlement } =
    await import("../src/domains/domainSettlement.js");
  const monthlyIds = MODULE_CATALOG.filter((m) => !m.spine && m.billing !== "once").map((m) => m.id);
  for (const id of monthlyIds) {
    await db.insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module: id, active: true } as never)
      .execute();
  }
  ok((await settlementQuote(tenantId)) === null, "hűség nélkül nincs elszámolás (quote=null)");
  const upgId = await createDomainUpgradeOrder(tenantId, "elszamolo.hu");
  ok(Boolean(upgId), "az elszámolás-teszt hűség-rendelése létrejön (ingyen domain)");
  if (upgId) {
    await db.insertInto("payment")
      .values({ order_intent_id: upgId, amount: 0, currency: "HUF", period: "annual", gateway: "none", status: "paid", paid_at: new Date() } as never)
      .execute();
    const q = await settlementQuote(tenantId);
    ok(q?.penaltyBase === 8000, "⭐ a kötbér-alap a rendelésen BEFAGYASZTOTT padló (8000)", `alap=${q?.penaltyBase}`);
    ok(q !== null && q.penaltyTotal === q.commitment.remainingMonths * 8000, "kötbér = hátralévő hónapok × vállalt minimum", `összeg=${q?.penaltyTotal}`);
    ok(q?.buyoutPrice === 20000, "a webcím-vételár a definiált paraméter (20 000)", `ár=${q?.buyoutPrice}`);
    ok(q?.domainName === "elszamolo.hu", "a quote a hűséggel érintett domaint nevezi meg", `domain=${q?.domainName}`);

    // 0029 fail-closed: no declared buyer anywhere in the chain → no order, no pay-link.
    const noBuyer = await createSettlementOrder(tenantId, false);
    ok(!noBuyer.ok && /számláz/.test(noBuyer.error ?? ""), "⭐ vevő-azonosság nélkül NINCS elszámolás-order (0029 fail-closed)", JSON.stringify(noBuyer));

    await db.updateTable("order_intent")
      .set({ buyer_type: "business", buyer_name: "Elszámoló Kft.", buyer_tax_number: "12345678-2-41", buyer_email: "penz@elszamolo.hu", vat_treatment: "aam" } as never)
      .where("id", "=", upgId).execute();
    const s1 = await createSettlementOrder(tenantId, false);
    ok(s1.ok === true, "vevővel az elszámolás-order létrejön", JSON.stringify(s1));
    if (s1.orderId && q) {
      const oi1 = await db.selectFrom("order_intent").selectAll().where("id", "=", s1.orderId).executeTakeFirstOrThrow();
      ok(oi1.kind === "domain_settlement", "a rendelés 'domain_settlement' fajtájú", `kind=${oi1.kind}`);
      ok(Number(oi1.price) === q.penaltyTotal && oi1.settlement_take_domain === false,
        "⭐ webcím nélkül: ár = kötbér (a vevő pontosan azt fizeti, amit a lap mutat)", `ár=${oi1.price}`);

      // The tenant re-decides WITH the domain: the old order is superseded, never left dangling.
      const s2 = await createSettlementOrder(tenantId, true);
      ok(s2.ok === true && Boolean(s2.orderId), "a döntés-módosítás új elszámolás-ordert ad");
      if (s2.orderId) {
        const oi2 = await db.selectFrom("order_intent").selectAll().where("id", "=", s2.orderId).executeTakeFirstOrThrow();
        ok(Number(oi2.price) === q.penaltyTotal + q.buyoutPrice && oi2.settlement_take_domain === true,
          "⭐ webcímmel: ár = kötbér + vételár", `ár=${oi2.price}`);
        const old = await db.selectFrom("order_intent").select("status").where("id", "=", s1.orderId).executeTakeFirstOrThrow();
        ok(old.status === "abandoned", "a felülírt elszámolás-order lezárva (nem marad kettős követelés)", `status=${old.status}`);
        const open = await openSettlement(tenantId);
        ok(open?.orderId === s2.orderId && open.takeDomain === true && !open.paid, "openSettlement a friss, kifizetetlen rendelést adja");

        // Change of heart: the unpaid settlement is voided — nothing owed remains.
        ok((await voidUnpaidSettlement(tenantId)) === true && (await openSettlement(tenantId)) === null,
          "⭐ meggondolás: a kifizetetlen elszámolás eltűnik (viselkedés-szinten is)");

        // A PAID settlement refuses a second round (that money moved).
        const s3 = await createSettlementOrder(tenantId, false);
        if (s3.orderId) {
          await db.insertInto("payment")
            .values({ order_intent_id: s3.orderId, amount: q.penaltyTotal, currency: "HUF", period: "monthly", gateway: "mock", status: "paid", paid_at: new Date() } as never)
            .execute();
          const s4 = await createSettlementOrder(tenantId, true);
          ok(!s4.ok && /kifizetve/.test(s4.error ?? ""), "⭐ KIFIZETETT elszámolás mellett nincs második kör", JSON.stringify(s4));
          ok((await voidUnpaidSettlement(tenantId)) === false, "kifizetett elszámolást a resume sem töröl");
        }
      }
    }
  }
}

// ── ELSZÁMOLÁS PADLÓ NÉLKÜL (ADR-0094 ④): fizetős domain — az adathiányos ág ──
{
  const { tenantId } = await makeSite("SettleFee", "domTokSettle02");
  const { settlementQuote } = await import("../src/domains/domainSettlement.js");
  const { computeMonthly } = await import("../src/pricing.js");
  // Base package (3900) < free threshold → the yearly fee is charged, no floor frozen.
  const upgId = await createDomainUpgradeOrder(tenantId, "fizetos-elszamolo.hu");
  ok(Boolean(upgId), "a fizetős (padló nélküli) hűség-rendelés létrejön");
  if (upgId) {
    const oi = await db.selectFrom("order_intent").select(["price", "committed_min_monthly"]).where("id", "=", upgId).executeTakeFirstOrThrow();
    ok(oi.committed_min_monthly === null, "fizetős domain-rendelésen nincs befagyasztott padló");
    await db.insertInto("payment")
      .values({ order_intent_id: upgId, amount: oi.price ?? 0, currency: "HUF", period: "annual", gateway: "mock", status: "paid", paid_at: new Date() } as never)
      .execute();
    const q = await settlementQuote(tenantId);
    ok(q?.commitment.floorMonthly === null, "a futó hűségen sincs padló");
    ok(q?.penaltyBase === computeMonthly([]), "⭐ padló nélkül a kötbér-alap a MA megújuló csomag havi díja (ADR-0094 ④ — az adathiányos ág nem vak)", `alap=${q?.penaltyBase}`);
  }
}

// ── ÁR-PLAFON (ADR-0093): prémium domain se ajánlatban, se vételben ──
{
  const { tenantId, siteId } = await makeSite("Premium", "domTokPrem01");

  // Offer-side: the order must be REFUSED up front (no pay-then-fail purchase).
  const refused = await createDomainUpgradeOrder(tenantId, "premium-panzio.hu");
  ok(refused === null, "⭐ plafon feletti (prémium) domainre a rendelés el sem indul", `orderId=${refused}`);

  // Purchase-side: even if a provisioning row exists, the guard kills it before
  // real money — the LAST line of defense (fail-closed).
  const id = await startDomainProvisioning({ tenantId, siteId, orderIntentId: null, domain: "premium-panzio.hu", years: 1 });
  const status = SELF_TEST ? "live" : await runDomainProvisioning(id);
  ok(status === "failed", "⭐ a vétel-oldali ár-őr a plafon feletti domaint 'failed'-re viszi (nem vesz)", `status=${status}`);
  const row = await siteRow(siteId);
  ok(row.custom_domain === null, "plafon-bukásnál a custom_domain érintetlen", `custom_domain=${row.custom_domain}`);
  ok(/ár-plafon/.test(row.domain_provision_error ?? ""), "a hibaüzenet megnevezi az ár-plafont (ADR-0093)", `err=${row.domain_provision_error}`);
  ok(row.registrar_ref === null, "⭐ regisztráció NEM történt (nincs registrar_ref) — pénz nem mozgott", `ref=${row.registrar_ref}`);
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
