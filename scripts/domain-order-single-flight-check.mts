// Regression guard for the OWN-DOMAIN ORDER fixes of the Elek 10-11 round (ADR-0362).
//
// WHAT IT PROVES (each block names the Elek finding it closes):
//   B1  a tenant has at most ONE own-domain order alive. Two orders paid one after the
//       other, or in parallel, give 1 registration, 1 capture, 1 invoice and 0 holds left
//       `reserved`; a second order on a LIVE domain never writes `failed` onto the site;
//       the order-side blocker sees live / running / held / being-paid; a superseded
//       pay-link that is completed anyway has its hold released.
//   B2  a DNS/TLS error AFTER the purchase is `setup_retry` (not `failed`): the money is
//       captured, the operator is alerted, the tenant letter says the name is theirs, and
//       the resume timer takes it to `live`.
//   B3  after a released failure a NEW choice (`?d=`, `?check=`, `uj=1`) is never swallowed
//       by the failure screen, and the step-1 GET forms carry `uj=1`.
//   B4  the review screen prices the PICKED ending (.eu 1 200, not the primary 1 000), and
//       the Pénztárca/Modulok next charge equals the renewal the mint issues (domain incl.).
//   B5  the platform label chosen next to a custom domain is stored and used by activation.
//   K1  a not-offered ending is refused as such, never as "premium".
//   K2  the invoice mail's discount line is computed on the service part; the domain fee
//       has its own line; list − discount + domain = gross.
//   K3  a /pricing save keeps the legacy fields the form does not send.
//   K5  www.<custom domain> → 301 to the bare domain.
//   ÚJ-K1 (Elek „it”, 2026-10-12) a bought name stuck in dns_pending: 24 h → one operator alert,
//       72 h → a repeated alert + ONE tenant letter (none if setup_retry already sent it), never daily.
//
// The behaviour blocks run against the REAL modules on a throwaway database (mock
// registrar / DNS / gateway / invoice / mail). Measured against the code before this
// round (ADR-0362): B1 (sequential + parallel), B2, B3, B4 and K1 go RED there.
//
// Run:  npx tsx scripts/domain-order-single-flight-check.mts

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_domorder_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
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

// ── SOURCE WIRING (the parts that need a running server to exercise) ─────────────
const strip = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const pub = strip("src/server/public.ts");
const consoleSrv = strip("src/console/server.ts");
const svc = strip("src/payment/service.ts");
{
  const start = pub.indexOf('pathname === "/admin/domain/order"');
  const route = pub.slice(start, start + 4000);
  ok(/domainOrderLock\(/.test(route) && /domainOrderBlocker\(/.test(route),
    "⭐ B1: a /admin/domain/order tenantonként sorosít és a blokkolót kérdezi meg",
    "két fül / dupla kattintás egyszerre átjutna");
  ok(route.indexOf("domainOrderBlocker(") < route.indexOf("createDomainUpgradeOrder("),
    "B1: a blokkoló a rendelés létrehozása ELŐTT fut");
  ok(/blocker\.payUrl/.test(route), "B1: ugyanarra a névre a már futó fizetési linkre visz vissza (nincs 2. rendelés)");
}
ok(/oi\.platformLabel/.test(svc) && /"order_intent\.platform_label as platformLabel"/.test(svc),
  "⭐ B5: az aktiválás a saját domain mellé választott platform-címkére nevez át");
ok(/platform_label/.test(consoleSrv) && /platformLabel: domainEligible \? platformLabel : null/.test(consoleSrv),
  "B5: a rendelés a platform-címkét KÜLÖN mezőben rögzíti (nem a domain_name-ben)");
ok(/platform_label:/.test(readFileSync("assets/runtime/cit-configurator.js", "utf8")),
  "B5: a konfigurátor elküldi a választott platform-címet saját domain mellett");
ok(/raw === null \|\| raw\.trim\(\) === ""\) return fallback/.test(consoleSrv),
  "⭐ K3: a /pricing mentés a NEM küldött mezőt változatlanul hagyja (nem 0)");
ok(/viaWww/.test(pub) && /tenantSite\?\.viaWww[\s\S]{0,200}301/.test(pub),
  "⭐ K5: www.<saját domain> → 301 a csupasz saját domainre");

// ── BEHAVIOUR ────────────────────────────────────────────────────────────────────
async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
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
process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.DOMAIN_AVAILABILITY_SOURCE = "mock";

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const prov = await import("../src/domains/provisionDomain.js");
const up = await import("../src/domains/domainUpgrade.js");
const pay = await import("../src/payment/service.js");
const { MODULE_CATALOG } = await import("../src/modules.js");
const { getDns } = await import("../src/domains/dns/index.js");
const { setHouseAlertDeps } = await import("../src/console/houseAlert.js");
const pricing = await import("../src/pricing.js");

const alerts: { subject: string; text: string }[] = [];
setHouseAlertDeps({
  recipientEmail: async () => "ops@pelda.hu",
  send: async (m) => {
    alerts.push({ subject: m.subject, text: m.text });
    return true;
  },
  publicBaseUrl: () => "http://localhost",
});

/** One finding's block: a throw (e.g. a function the old code lacks) is a FAIL, not a stop. */
async function block(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    ok(false, `${label}: a blokk elszállt`, String((e as Error)?.message ?? e));
  }
}

let tok = 0;
async function makeTenant(name: string, opts: { entitle?: boolean } = {}): Promise<{ tenantId: string; siteId: string }> {
  const def = await db.insertInto("scraper_definition")
    .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name, raw: sql`'{}'::jsonb` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: name } as never)
    .returning("id").executeTakeFirstOrThrow();
  const p = await db.insertInto("prospect").values({ lead_id: lead.id, token: `domOrd${tok++}x` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `domOrdTok${tok++}`, status: "live", slug: `domord-${tok}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  await db.insertInto("order_intent").values({
    prospect_id: p.id, kind: "initial", modules: JSON.stringify([]), price: 4390, billing_period: "monthly",
    status: "submitted", submitted_at: new Date(), buyer_type: "individual", buyer_name: "Teszt Vevő",
    buyer_country: "HU", buyer_zip: "8600", buyer_city: "Siófok", buyer_address: "Fő u. 1.", buyer_email: "teszt@pelda.hu",
  } as never).execute();
  await db.insertInto("tenant_user").values({
    tenant_id: tenant.id, username: `domord${tok}`, contact_email: "tulaj@pelda.hu", password_hash: "x",
  } as never).execute();
  if (opts.entitle !== false) {
    for (const m of MODULE_CATALOG) {
      if (m.spine || m.billing === "once") continue;
      await db.insertInto("module_entitlement").values({ tenant_id: tenant.id, module: m.id, active: true } as never).execute();
    }
  }
  return { tenantId: tenant.id, siteId: site.id };
}
const payRow = (orderId: string) =>
  db.selectFrom("payment").select(["id", "status", "gateway_ref", "pay_url", "paid_at"])
    .where("order_intent_id", "=", orderId).orderBy("created_at", "desc").executeTakeFirstOrThrow();
async function waitSettled(orderIds: string[]): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const rows = await db.selectFrom("payment").select("status").where("order_intent_id", "in", orderIds).execute();
    // Until every beszerzés reached a terminal state (the detached run continues after the capture).
    const running = await db.selectFrom("domain_provisioning").select("id")
      .where("order_intent_id", "in", orderIds).where("status", "not in", ["live", "failed", "setup_retry"]).execute();
    if (!rows.some((r) => r.status === "reserved" || r.status === "pending") && running.length === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function tally(tenantId: string) {
  const regs = await db.selectFrom("domain_provisioning").select(["status", "registrar_ref"])
    .where("tenant_id", "=", tenantId).execute();
  const pays = await db.selectFrom("payment").innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.id as id", "payment.status as status"]).where("order_intent.tenant_id", "=", tenantId)
    .where("order_intent.kind", "=", "domain_upgrade").execute();
  const inv = pays.length
    ? Number((await db.selectFrom("invoice").select(sql<number>`count(*)`.as("n"))
        .where("payment_id", "in", pays.map((p) => p.id)).executeTakeFirstOrThrow()).n)
    : 0;
  return {
    registrations: regs.filter((r) => r.registrar_ref).length,
    captured: pays.filter((p) => p.status === "paid").length,
    reserved: pays.filter((p) => p.status === "reserved").length,
    released: pays.filter((p) => p.status === "released").length,
    invoices: inv,
  };
}
async function newPaidLink(tenantId: string, domain: string): Promise<{ orderId: string; ref: string }> {
  const orderId = await up.createDomainUpgradeOrder(tenantId, domain);
  if (!orderId) throw new Error(`no order for ${domain}`);
  await pay.requestPayment(orderId);
  return { orderId, ref: (await payRow(orderId)).gateway_ref! };
}

// B1 ① — two tabs, the SAME name, paid one after the other (Elek L7)
await block("B1 ①", async () => {
  const { tenantId, siteId } = await makeTenant("Fecske");
  const a = await newPaidLink(tenantId, "fecske-ket-ful.hu");
  const b = await newPaidLink(tenantId, "fecske-ket-ful.hu"); // what the old route minted for tab 2
  await pay.applyWebhookResult({ gatewayRef: b.ref, status: "paid" });
  await waitSettled([b.orderId]);
  await pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" });
  await waitSettled([a.orderId, b.orderId]);
  const t = await tally(tenantId);
  ok(t.registrations === 1, "⭐ B1 sorban fizetett két fül → 1 regisztráció", JSON.stringify(t));
  ok(t.captured === 1 && t.invoices === 1, "⭐ B1 sorban → 1 terhelés, 1 számla", JSON.stringify(t));
  ok(t.reserved === 0 && t.released === 1, "⭐ B1 sorban → a 2. fül zárolása FELOLDVA, 0 ragadt", JSON.stringify(t));
  const site = await db.selectFrom("site").select(["custom_domain_status", "custom_domain"]).where("id", "=", siteId).executeTakeFirstOrThrow();
  ok(site.custom_domain_status === "live", "B1 sorban → a site élő marad (a 2. rendelés nem írja failed-re)", JSON.stringify(site));
  const blocker = await up.domainOrderBlocker(tenantId);
  ok(blocker?.kind === "live", "B1 élő domain mellett a rendelés-blokkoló 'live'-ot mond (nincs 2. domain)", JSON.stringify(blocker));
});

// B1 ② — parallel payment of two orders (Elek L8)
await block("B1 ②", async () => {
  const { tenantId } = await makeTenant("Parhuzam");
  const a = await newPaidLink(tenantId, "parhuzam-egy.hu");
  const b = await newPaidLink(tenantId, "parhuzam-egy.hu");
  await Promise.all([
    pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" }),
    pay.applyWebhookResult({ gatewayRef: b.ref, status: "paid" }),
  ]);
  await waitSettled([a.orderId, b.orderId]);
  const t = await tally(tenantId);
  ok(t.registrations === 1 && t.captured === 1 && t.invoices === 1,
    "⭐ B1 párhuzamos fizetés → 1 regisztráció, 1 terhelés, 1 számla", JSON.stringify(t));
  ok(t.reserved === 0, "⭐ B1 párhuzamos → 0 ragadt `reserved` zárolás", JSON.stringify(t));
});

// B1 ③ — two different names in parallel on one site (the per-site index)
await block("B1 ③", async () => {
  const { tenantId } = await makeTenant("KetNev");
  const a = await newPaidLink(tenantId, "ketnev-egyik.hu");
  const b = await newPaidLink(tenantId, "ketnev-masik.hu");
  await Promise.all([
    pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" }),
    pay.applyWebhookResult({ gatewayRef: b.ref, status: "paid" }),
  ]);
  await waitSettled([a.orderId, b.orderId]);
  const t = await tally(tenantId);
  ok(t.registrations === 1 && t.captured === 1 && t.reserved === 0,
    "B1 két különböző név párhuzamosan → egy site-hoz egy vétel, 0 ragadt zárolás", JSON.stringify(t));
});

// B1 ④ — the order-side blocker: being paid / held; supersede releases a completed stale link
await block("B1 ④", async () => {
  const { tenantId } = await makeTenant("Blokk");
  const a = await newPaidLink(tenantId, "blokk-elso.hu");
  const bl = await up.domainOrderBlocker(tenantId);
  ok(bl?.kind === "paying" && bl.domain === "blokk-elso.hu" && !!(bl as { payUrl?: string }).payUrl,
    "B1 fizetésre váró link → a blokkoló 'paying' + a link (ugyanarra a névre oda visz vissza)", JSON.stringify(bl));
  await up.supersedePendingDomainPayments(tenantId);
  ok((await payRow(a.orderId)).status === "cancelled", "B1 másik név választásakor a régi, ki nem fizetett link felülírva");
  await pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" });
  await waitSettled([a.orderId]);
  const t = await tally(tenantId);
  ok(t.registrations === 0 && t.released === 1 && t.captured === 0,
    "⭐ B1 a felülírt link utólagos kifizetése → zárolás FELOLDVA, nincs vétel", JSON.stringify(t));
  // A stray reserved hold without a beszerzés row is released by the timer.
  const c = await newPaidLink(tenantId, "blokk-arva.hu");
  const pc = await payRow(c.orderId);
  await db.updateTable("payment").set({ status: "reserved", created_at: sql`now() - interval '1 hour'` } as never)
    .where("id", "=", pc.id).execute();
  ok((await up.domainOrderBlocker(tenantId))?.kind === "reserved", "B1 zárolt (reserved) fizetés → a blokkoló 'reserved'");
  await pay.settleDomainReservations();
  ok((await payRow(c.orderId)).status === "released", "⭐ B1 beszerzés nélküli, ragadt zárolást az időzítő feloldja");
});

// B2 — DNS/TLS error AFTER the purchase
await block("B2", async () => {
  const { tenantId, siteId } = await makeTenant("Ribizli");
  const dns = getDns() as unknown as { createZone: (d: string) => Promise<unknown> };
  const orig = dns.createZone.bind(dns);
  dns.createZone = async () => {
    throw new Error("zone API 503 (teszt)");
  };
  alerts.length = 0;
  const a = await newPaidLink(tenantId, "ribizli-dns.hu");
  await pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" });
  await waitSettled([a.orderId]);
  for (let i = 0; i < 40 && alerts.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
  const site = await db.selectFrom("site").select(["custom_domain_status"]).where("id", "=", siteId).executeTakeFirstOrThrow();
  const dp = await db.selectFrom("domain_provisioning").select(["status", "registrar_ref"]).where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  ok(dp.status === "setup_retry" && site.custom_domain_status === "setup_retry",
    "⭐ B2 vétel utáni DNS-hiba → setup_retry (NEM failed)", `dp=${dp.status} site=${site.custom_domain_status}`);
  ok((await payRow(a.orderId)).status === "paid", "B2 a név megvéve → a zárolt összeg lehívva (nem feloldva)");
  ok(alerts.some((x) => /ribizli-dns\.hu/.test(x.subject)), "⭐ B2 operátor-riasztás ment ki (házi riasztó)", JSON.stringify(alerts));
  // The owner mail is sent and logged AFTER the status flips to setup_retry: poll for it
  // (same pattern as the alert wait above) instead of reading once — a loaded box lost the race.
  const readMail = () => db.selectFrom("tenant_message").select(["subject", "body_text"]).where("tenant_id", "=", tenantId)
    .where("kind", "=", "domain").orderBy("sent_at", "desc").executeTakeFirst();
  let mail = await readMail();
  for (let i = 0; i < 100 && !mail; i++) {
    await new Promise((r) => setTimeout(r, 100));
    mail = await readMail();
  }
  ok(!!mail && /az Öné/.test(mail.subject ?? "") && !/elkelt|más lefoglalta/.test(`${mail.subject} ${mail.body_text}`),
    "⭐ B2 a tulaj levele igazat mond (a név az övé, a beállítás késik)", JSON.stringify(mail));
  dns.createZone = orig;
  const swept = await prov.resumePendingDomainProvisionings();
  ok(swept.some((s) => s.domain === "ribizli-dns.hu" && s.status === "live"),
    "⭐ B2 az időzítő újrapróbálja a DNS/TLS lépést → live", JSON.stringify(swept));
  const t = await tally(tenantId);
  ok(t.registrations === 1 && t.captured === 1, "B2 az újrapróba nem vesz és nem terhel újra", JSON.stringify(t));
});

// ÚJ-K1 (Elek „it” kör, 2026-10-12, ADR-XXXX) — a bought name STUCK in dns_pending
// (the mock DNS keeps every "dnsfail" label pending forever). Before: +1/+7/+30 days, 0 alert,
// 0 letter. Now: 24 h → one operator alert; 72 h → a repeated alert + ONE tenant letter; never daily.
await block("ÚJ-K1", async () => {
  const { tenantId } = await makeTenant("Ragadó");
  const DOMAIN = "ragado-dnsfail.hu";
  const a = await newPaidLink(tenantId, DOMAIN);
  await pay.applyWebhookResult({ gatewayRef: a.ref, status: "paid" });
  await waitSettled([a.orderId]);
  const row = () => db.selectFrom("domain_provisioning").select(["id", "status", "waiting_since", "stuck_stage", "delay_notice_at"] as never)
    .where("tenant_id", "=", tenantId).executeTakeFirstOrThrow() as Promise<{ id: string; status: string; waiting_since: Date | null; stuck_stage: number; delay_notice_at: Date | null }>;
  const r0 = await row();
  ok(r0.status === "dns_pending" && !!r0.waiting_since, "ÚJ-K1 a megvett név dns_pending-ben vár, az óra fut (waiting_since)", JSON.stringify(r0));
  const t0 = new Date(r0.waiting_since ?? Date.now()).getTime();
  const letters = async () => Number((await db.selectFrom("tenant_message").select((eb) => eb.fn.countAll().as("n"))
    .where("tenant_id", "=", tenantId).where("kind", "=", "domain").executeTakeFirstOrThrow()).n);
  const mine = () => alerts.filter((x) => x.subject.includes(DOMAIN));
  const at = async (h: number) => prov.resumePendingDomainProvisionings({ now: new Date(t0 + h * 3_600_000) });
  alerts.length = 0;
  await at(1);
  ok(mine().length === 0 && (await letters()) === 0, "ÚJ-K1 +1 óra: se riasztás, se levél", JSON.stringify(mine()));
  await at(25);
  ok(mine().length === 1 && (await row()).stuck_stage === 1, "⭐ ÚJ-K1 +25 óra: EGY operátor-riasztás", JSON.stringify(mine()));
  ok((await letters()) === 0, "ÚJ-K1 +25 óra: a tulaj még nem kap levelet");
  await at(30);
  ok(mine().length === 1, "⭐ ÚJ-K1 +30 óra: nincs második 24 órás riasztás", JSON.stringify(mine()));
  await at(73);
  ok(mine().length === 2 && /ISMÉTELT/.test(mine()[1]?.subject ?? ""), "⭐ ÚJ-K1 +73 óra: ismételt riasztás", JSON.stringify(mine()));
  const mail = await db.selectFrom("tenant_message").select(["subject", "body_text"]).where("tenant_id", "=", tenantId)
    .where("kind", "=", "domain").executeTakeFirst();
  ok((await letters()) === 1 && /az Öné/.test(mail?.subject ?? "") && /nincs teendője/.test(mail?.body_text ?? ""),
    "⭐ ÚJ-K1 +73 óra: EGY igaz tulaj-levél (a név az Öné, a beállítás tovább tart)", JSON.stringify(mail));
  ok(/most kapta meg/.test(mine()[1]?.text ?? ""), "ÚJ-K1 a riasztás kimondja, hogy a tulaj most kapott levelet", mine()[1]?.text ?? "");
  await at(24 * 7);
  await at(24 * 30);
  ok(mine().length === 2 && (await letters()) === 1, "⭐ ÚJ-K1 +7 / +30 nap: se új riasztás, se új levél (nem naponta)",
    `riasztás ${mine().length}, levél ${await letters()}`);
  ok((await row()).status === "dns_pending", "ÚJ-K1 a sor nem lép magától tovább (nem hazudunk élőt)");
  // A setup_retry letter already went out for this beszerzés → the 72 h step sends no second one.
  const other = await makeTenant("Ragadó2");
  const b = await newPaidLink(other.tenantId, "ragado2-dnsfail.hu");
  await pay.applyWebhookResult({ gatewayRef: b.ref, status: "paid" });
  await waitSettled([b.orderId]);
  await db.updateTable("domain_provisioning").set({ delay_notice_at: new Date() } as never).where("tenant_id", "=", other.tenantId).execute();
  const before2 = Number((await db.selectFrom("tenant_message").select((eb) => eb.fn.countAll().as("n")).where("tenant_id", "=", other.tenantId).executeTakeFirstOrThrow()).n);
  const ws2 = (await db.selectFrom("domain_provisioning").select("waiting_since" as never).where("tenant_id", "=", other.tenantId).executeTakeFirstOrThrow()) as { waiting_since: Date };
  await prov.resumePendingDomainProvisionings({ now: new Date(new Date(ws2.waiting_since).getTime() + 73 * 3_600_000) });
  const after2 = Number((await db.selectFrom("tenant_message").select((eb) => eb.fn.countAll().as("n")).where("tenant_id", "=", other.tenantId).executeTakeFirstOrThrow()).n);
  ok(after2 === before2 && alerts.some((x) => x.subject.includes("ragado2-dnsfail.hu") && /már korábban megkapta/.test(x.text)),
    "⭐ ÚJ-K1 ha a „tovább tart” levél már kiment (setup_retry), a 72 órás lépcső nem küld másodikat", `${before2} → ${after2}`);
});

// B3 / K1 / ISMERT — the Webcím view
await block("B3 / K1 / ISMERT", async () => {
  const { domainSection } = await import("../src/server/adminViews.js");
  const base = {
    currentHost: "ribizli.citoviso.com", customDomain: null, status: "failed" as const, error: "foglalt",
    failedDomain: "ribizli.hu", money: "released" as const, moneyAmount: 1000, activeDomain: "ribizli.hu",
    suggestions: [{ domain: "ribizli2.hu", availability: "free" as const }], priceMonthly: 1000, packageContent: false,
    offeredTlds: [".hu", ".eu"], eligible: true, minPackageMonthly: 7000, currency: "HUF", commitmentMonths: 12, mockMode: true,
  };
  const failScreen = domainSection(base, {});
  ok(/nem tudtuk megvásárolni/.test(failScreen), "B3 a feloldott bukás saját képernyője megvan");
  const restart = domainSection(base, { restart: true });
  ok(/name="uj" value="1"/.test(restart), "⭐ B3 „Másik név választása” után a GET-űrlapok viszik az uj=1-et");
  const picked = domainSection(base, { picked: "ribizli2.hu", pickedAvailability: "free" });
  ok(/Áttekintés/.test(picked) && !/nem tudtuk megvásárolni/.test(picked),
    "⭐ B3 az új választás (?d=) az Áttekintésre visz, nem vissza a hiba-képernyőre");
  const typed = domainSection(base, {
    check: { input: "ribizli.com", domain: "ribizli.com", reason: null, availability: null, tooExpensive: false, notOffered: true },
  });
  ok(/nem kínáljuk\. Választható: \.hu, \.eu/.test(typed) && !/prémium/.test(typed),
    "⭐ K1 nem kínált végződés → „nem kínáljuk, választható: …”, nem „prémium”");
  const manual = domainSection({ ...base, status: "none", money: null, priceMonthly: 0, packageContent: true },
    { picked: "ribizli2.hu", pickedAvailability: "free" });
  ok(!/Most zárolunk|próbálja újra/.test(manual) && /munkatársunk intézi/.test(manual),
    "ISMERT csomag-tartalom → nincs díj/zárolás/„próbálja újra”, kézi intézést mond");
  const retry = domainSection({ ...base, status: "setup_retry", money: "paid", activeDomain: "ribizli.hu" }, {});
  ok(/Az Öné/.test(retry) && !/más lefoglalta|nem tudtuk megvásárolni/.test(retry),
    "⭐ B2 a felület setup_retry-nél azt mondja: a név az Öné, a beállítás késik");
  const typedCom = await (await import("../src/domains/domainAdmin.js")).checkTypedDomain("ribizli.com");
  ok(typedCom.notOffered === true, "K1 a .com (nem kínált) a checkTypedDomain-ben notOffered", JSON.stringify(typedCom));
});

// B4 — the picked ending prices the review; the next charge = the minted renewal
await block("B4", async () => {
  await pricing.loadPricing(true);
  const hu = pricing.getTlds().find((t) => t.tld === ".hu")!;
  // A fresh DB has no pricing_config row — the endings are read only for a stored market.
  const sn = pricing.pricingSnapshot("hu");
  await pricing.savePricing({
    region: "hu", currency: sn.currency, baseMonthly: sn.baseMonthly, annualFreeMonths: sn.annualFreeMonths,
    customDomainMonthly: sn.customDomainMonthly, domainMaxPriceEur: sn.domainMaxPriceEur,
    domainMinCommitmentMonths: sn.domainMinCommitmentMonths, domainMinPackageMonthly: sn.domainMinPackageMonthly,
    domainBuyoutPrice: sn.domainBuyoutPrice, pricingConfirmed: true, modulePrices: Object.fromEntries(sn.modulePrices),
  });
  await pricing.saveDomainTlds("hu", [
    hu,
    { ...hu, tld: ".eu", costNet: 2499, monthlyFee: 1200, freeInPackage: false, offered: true },
  ]);
  await pricing.loadPricing(true);
  const { tenantId, siteId } = await makeTenant("Laguna");
  const { loadDomainAdmin } = await import("../src/domains/domainAdmin.js");
  const d = await loadDomainAdmin(tenantId, "Laguna", undefined, "laguna-uj.eu");
  const q = await up.quoteDomainUpgrade(tenantId, "laguna-uj.eu");
  ok(d.priceMonthly === 1200 && q?.price === 1200,
    "⭐ B4 .eu választásnál az Áttekintés díja = a rendelés díja = 1 200", `screen=${d.priceMonthly} order=${q?.price}`);
  // A live .eu domain + a subscription: the screen's next charge vs the minted renewal.
  await db.updateTable("site").set({ custom_domain: "laguna-uj.eu", custom_domain_status: "live" } as never).where("id", "=", siteId).execute();
  const start = new Date();
  for (const period of ["monthly", "annual"] as const) {
    await db.deleteFrom("subscription").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("order_intent").where("tenant_id", "=", tenantId).where("kind", "=", "renewal").execute();
    await db.insertInto("subscription").values({
      tenant_id: tenantId, billing_period: period, anchor_date: start, current_period_start: start,
      current_period_end: new Date(start.getTime() + 20 * 86_400_000), status: "active",
    } as never).execute();
    const { getTenantModules } = await import("../src/tenant/modules.js");
    const { getSubscriptionAdmin } = await import("../src/tenant/subscriptionAdmin.js");
    const { mintRenewalForTenant } = await import("../src/payment/billing.js");
    const sub = await getSubscriptionAdmin(tenantId, await getTenantModules(tenantId));
    const minted = await mintRenewalForTenant(tenantId, new Date());
    ok(!!sub && sub.nextChargeTotal === minted.price && (sub.domainFee?.monthly ?? 0) === 1200,
      `⭐ B4 (${period}) a képernyő következő terhelése = a kibocsátott megújulás (domain-díjjal)`,
      `screen=${sub?.nextChargeTotal} minted=${minted.price} domain=${JSON.stringify(sub?.domainFee)}`);
  }
});

// B5 — the order stores the platform label next to the custom domain
await block("B5", async () => {
  const { recordOrderIntent } = await import("../src/console/data.js");
  ok(typeof recordOrderIntent === "function", "B5 recordOrderIntent elérhető");
  const cols = await sql<{ column_name: string }>`select column_name from information_schema.columns where table_name = 'order_intent' and column_name = 'platform_label'`.execute(db);
  ok(cols.rows.length === 1, "B5 az order_intent.platform_label oszlop létezik");
});

// K2 — the invoice mail lines add up
await block("K2", async () => {
  const { buildInvoiceEmail } = await import("../src/email/invoiceEmail.js");
  const m = buildInvoiceEmail({
    to: "a@b.hu", buyerName: "Teszt", invoiceNumber: "T-1", gross: 50600, currency: "HUF", period: "annual",
    discount: { label: "Döntés-segítő ajánlat", percent: 50, listGross: 72400 }, domainFee: 14400,
  });
  ok(/−36\s?200 Ft/.test(m.text) && /Saját webcím: 14\s?400 Ft/.test(m.text),
    "⭐ K2 a kedvezmény a szolgáltatás-részre számol (−36 200), a domain-díj külön sorban (14 400)", m.text);
});

// K6 (Elek IT-kör) — a mock registrar never lets the REAL availability oracle answer
await block("K6", async () => {
  const { availabilitySource } = await import("../src/domains/availability.js");
  const saved = process.env.DOMAIN_AVAILABILITY_SOURCE;
  delete process.env.DOMAIN_AVAILABILITY_SOURCE;
  ok(availabilitySource() === "mock",
    "⭐ K6 mock regisztrátor mellett (forrás beállítás nélkül) a mock orákulum felel — nincs valódi API-hívás");
  process.env.DOMAIN_AVAILABILITY_SOURCE = "registrar";
  ok(availabilitySource() === "registrar", "K6 a valódi orákulum csak kifejezett opt-innel (registrar)");
  process.env.DOMAIN_AVAILABILITY_SOURCE = saved;
});

// A4 — every offered ending gets a suggestion (the cut to five happens AFTER the filter)
await block("A4", async () => {
  const { suggestDomains } = await import("../src/domains.js");
  const s = suggestDomains("ELEK-TESZT Laguna Panzió", [".hu", ".eu"]);
  ok(s.some((d) => d.endsWith(".eu")) && s.every((d) => /\.(hu|eu)$/.test(d)) && s.length <= 5,
    "⭐ A4 a javaslatok csak kínált végződésből állnak, és a .eu is kap egyet", JSON.stringify(s));
});

setHouseAlertDeps(null);
await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
console.log(failed === 0 ? "\n✅ MIND ZÖLD" : `\n❌ ${failed} BUKÁS`);
process.exit(failed === 0 ? 0 : 1);
