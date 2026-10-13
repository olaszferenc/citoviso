// Regression guard for the PAYMENT-FREE claim of a package-content name (ADR-0381).
//
// Before: a tenant whose package carries the own name (fee 0, ADR-0360) pressed „Ezt kérem”
// on the Webcím tab, and the server only sent a house alert — an operator bought and wired
// the name by hand ("Az igénylést munkatársunk intézi"). The owner's decision (2026-10-13):
// the package name runs the SAME automatic beszerzés as a paid one, only without a hold and
// a charge.
//
// WHAT IT PROVES (against the REAL modules on a throwaway database; mock registrar / DNS /
// gateway / mail — nothing real is bought or sent):
//   ① a claim runs the beszerzés to `live` with 0 charge (one 0-amount `paid` row, gateway
//     'none', no hold, no invoice) and 0 house alerts; the hűségidő starts with it
//   ② ONE package name at a time: two parallel claims → one beszerzés, the other refused;
//     a claim next to a live name → refused
//   ③ a registrar failure takes the paid failure branch (`failed`, the house alert, the
//     tenant letter) — the letter and the screen say nothing was paid, the 0 row is
//     cancelled, so no hűségidő is left behind
//   ④ a package that does NOT carry the name is never claimed for free; after a downgrade
//     the renewal charges the name's fee again (ADR-0360 — unchanged)
//   ⑤ the Webcím review step offers the claim (no fee, no hold, no "munkatársunk intézi"),
//     and the route claims instead of alerting the house
//
// Measured on the code before ADR-0381: ①, ②, ③ and ⑤ go RED (no claimPackageDomain; the
// route alerts the house; the screen promises a colleague).
//
// Run:  npx tsx scripts/domain-package-claim-check.mts

import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_dompkg_check";
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
/** One block: a throw (e.g. a function the old code lacks) is a FAIL, not a stop. */
async function block(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    ok(false, `${label}: a blokk elszállt`, String((e as Error)?.message ?? e));
  }
}

// ── ⑤ SOURCE WIRING (the route needs a running server to exercise) ───────────────
const strip = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
{
  const pub = strip("src/server/public.ts");
  const start = pub.indexOf('pathname === "/admin/domain/order"');
  const route = pub.slice(start, start + 5000);
  ok(/claimPackageDomain\(/.test(route), "⭐ ⑤ a /admin/domain/order a csomag-tartalom nevet díj nélkül IGÉNYLI (claimPackageDomain)",
    "a route nem hívja a claimPackageDomain-t");
  ok(!/domain-claim/.test(route) && !/alertHouse\(/.test(route),
    "⭐ ⑤ a route nem küld ház-riasztást kézi intézésre", "ház-riasztás maradt a route-ban");
  ok(route.indexOf("domainOrderBlocker(") < route.indexOf("claimPackageDomain("),
    "⑤ a blokkoló (ADR-0362) az igénylés ELŐTT fut");
}

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
const up = await import("../src/domains/domainUpgrade.js") as Record<string, unknown> & typeof import("../src/domains/domainUpgrade.js");
const { MODULE_CATALOG } = await import("../src/modules.js");
const { setHouseAlertDeps } = await import("../src/console/houseAlert.js");
const pricing = await import("../src/pricing.js");
const { seedAssignment, tierModules } = await import("../src/packages.js");
const { activeDomainCommitment } = await import("../src/domains/domainCommitment.js");
const { domainFeeForRenewal } = await import("../src/payment/billing.js");
const { loadDomainAdmin } = await import("../src/domains/domainAdmin.js");
const { domainSection } = await import("../src/server/adminViews.js");

const alerts: { subject: string; text: string }[] = [];
setHouseAlertDeps({
  recipientEmail: async () => "ops@pelda.hu",
  send: async (m) => {
    alerts.push({ subject: m.subject, text: m.text });
    return true;
  },
  publicBaseUrl: () => "http://localhost",
});

// The pricing state is PINNED in this process: the Ajánlott package carries the name, and
// the .hu ending is free in the package (ADR-0360 ④) — the owner's „csomag-tartalom” case.
const assignment = new Map(seedAssignment());
assignment.set("domain", "ajanlott");
const hu = {
  tld: ".hu", offered: true, costNet: 1990, costCurrency: "HUF", costMeasuredAt: "2026-10-11T09:30:00.000Z",
  maxCost: 5000, monthlyFee: 1000, freeInPackage: true,
};
pricing.overridePricingStateInProcess({ assignment, tlds: [hu], domainFreeInPackage: true, domainMinPackageMonthly: 7000 });

let tok = 0;
async function makeTenant(name: string, opts: { entitle?: boolean } = {}): Promise<{ tenantId: string; siteId: string }> {
  const def = await db.insertInto("scraper_definition")
    .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never).returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name, raw: sql`'{}'::jsonb` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: name } as never)
    .returning("id").executeTakeFirstOrThrow();
  const p = await db.insertInto("prospect").values({ lead_id: lead.id, token: `domPkg${tok++}x` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `domPkgTok${tok++}`, status: "live", slug: `dompkg-${tok}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  await db.insertInto("order_intent").values({
    prospect_id: p.id, kind: "initial", modules: JSON.stringify([]), price: 9990, billing_period: "monthly",
    status: "submitted", submitted_at: new Date(), buyer_type: "individual", buyer_name: "Teszt Vevő",
    buyer_country: "HU", buyer_zip: "8600", buyer_city: "Siófok", buyer_address: "Fő u. 1.", buyer_email: "teszt@pelda.hu",
  } as never).execute();
  await db.insertInto("tenant_user").values({
    tenant_id: tenant.id, username: `dompkg${tok}`, contact_email: "tulaj@pelda.hu", password_hash: "x",
  } as never).execute();
  if (opts.entitle !== false) {
    for (const m of MODULE_CATALOG) {
      if (m.spine || m.billing === "once") continue;
      await db.insertInto("module_entitlement").values({ tenant_id: tenant.id, module: m.id, active: true } as never).execute();
    }
  }
  return { tenantId: tenant.id, siteId: site.id };
}
async function money(tenantId: string) {
  const pays = await db.selectFrom("payment").innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.id as id", "payment.status as status", "payment.amount as amount", "payment.gateway as gateway",
      "payment.reservation as reservation", "payment.pay_url as payUrl"])
    .where("order_intent.tenant_id", "=", tenantId).where("order_intent.kind", "=", "domain_upgrade").execute();
  const invoices = pays.length
    ? Number((await db.selectFrom("invoice").select(sql<number>`count(*)`.as("n"))
        .where("payment_id", "in", pays.map((p) => p.id)).executeTakeFirstOrThrow()).n)
    : 0;
  return { pays, invoices };
}
const claim = up.claimPackageDomain as typeof import("../src/domains/domainUpgrade.js").claimPackageDomain;
if (typeof claim !== "function") ok(false, "⭐ ①②③ a díj nélküli igénylés (claimPackageDomain) létezik", "nincs ilyen függvény");

// ① a package name is claimed and bought automatically — 0 charge, 0 house alert
await block("①", async () => {
  const { tenantId, siteId } = await makeTenant("Csomag Panzió");
  const quote = await up.quoteDomainUpgrade(tenantId, "csomagpanzio.hu");
  ok(quote?.price === 0, "① a csomag hordozza a nevet: a díj 0 (ADR-0360)", JSON.stringify(quote));
  alerts.length = 0;
  const r = await claim(tenantId, "csomagpanzio.hu");
  ok(r.ok, "⭐ ① a csomag-tartalom név igénylése elindul (nem kézi intézés)", JSON.stringify(r));
  if (!r.ok) return;
  const site0 = await db.selectFrom("site").select(["custom_domain_status"]).where("id", "=", siteId).executeTakeFirstOrThrow();
  ok(site0.custom_domain_status === "pending", "① a beszerzés-sor az igénylés VÁLASZA ELŐTT áll (a fül a folyamat-képernyőt mutatja)",
    String(site0.custom_domain_status));
  const status = await prov.runDomainProvisioning(r.provisioningId);
  const site = await db.selectFrom("site").select(["custom_domain", "custom_domain_status"]).where("id", "=", siteId).executeTakeFirstOrThrow();
  ok(status === "live" && site.custom_domain === "csomagpanzio.hu",
    "⭐ ① a mock regisztrátoron végigfut: live, a site a saját nevén", `${status} / ${site.custom_domain}`);
  const m = await money(tenantId);
  ok(m.pays.length === 1 && m.pays[0]!.amount === 0 && m.pays[0]!.gateway === "none" && !m.pays[0]!.reservation && !m.pays[0]!.payUrl,
    "⭐ ① 0 terhelés: egy 0 Ft-os sor (gateway 'none'), nincs zárolás, nincs fizetési link", JSON.stringify(m.pays));
  ok(m.invoices === 0, "① nincs számla (nincs ellenérték)", String(m.invoices));
  ok(alerts.length === 0, "⭐ ① sikernél 0 ház-riasztás", alerts.map((a) => a.subject).join(" | "));
  const c = await activeDomainCommitment(tenantId);
  ok(c?.domainName === "csomagpanzio.hu", "① a hűségidő a névvel indul (ÁSZF 1.5 §9)", JSON.stringify(c));
  const live = await db.selectFrom("tenant_message").select(["subject"]).where("tenant_id", "=", tenantId).execute();
  ok(live.some((x) => /Elkészült a saját webcíme/.test(x.subject ?? "")), "① a tulaj megkapja az „elkészült” levelet",
    live.map((x) => x.subject).join(" | "));

  // ② a second claim next to a LIVE name is refused
  const again = await claim(tenantId, "csomagpanzio2.hu");
  ok(!again.ok && again.reason === "blocked", "⭐ ② élő név mellett második csomag-tartalom igénylés ELUTASÍTVA", JSON.stringify(again));

  // ④ downgrade: the name's fee starts on the next renewal (ADR-0360, unchanged)
  const ajanlott = tierModules(assignment, "ajanlott");
  const drop = ajanlott.find((id) => MODULE_CATALOG.some((m) => m.id === id && !m.spine && m.billing !== "once"));
  if (drop) {
    await db.updateTable("module_entitlement").set({ active: false }).where("tenant_id", "=", tenantId).where("module", "=", drop).execute();
    const due = await domainFeeForRenewal(tenantId, 1);
    ok((due?.fee ?? 0) > 0, "④ kisebb csomagra váltva a név díja a következő megújításon elindul", JSON.stringify(due));
  } else ok(false, "④ nincs eldobható modul az Ajánlottban (fixture)");
});

// ② two parallel claims (two tabs / a double click) — ONE beszerzés
await block("② párhuzamos", async () => {
  const { tenantId } = await makeTenant("Iker Panzió");
  const [a, b] = await Promise.all([claim(tenantId, "ikerpanzio.hu"), claim(tenantId, "ikerpanzio2.hu")]);
  const oks = [a, b].filter((x) => x.ok).length;
  const rows = await db.selectFrom("domain_provisioning").select(["domain"]).where("tenant_id", "=", tenantId).execute();
  ok(oks === 1 && rows.length === 1, "⭐ ② két egyidejű igénylés → EGY beszerzés, a másik elutasítva",
    `${JSON.stringify([a, b])} · sorok: ${rows.map((r) => r.domain).join(",")}`);
  const m = await money(tenantId);
  ok(m.pays.filter((p) => p.status === "paid").length === 1, "② egy élő 0 Ft-os sor marad (a vesztes nem hagy nyomot)",
    JSON.stringify(m.pays));
});

// ③ registrar failure → the paid failure branch, without any money sentence
await block("③", async () => {
  const { tenantId, siteId } = await makeTenant("Balsors Panzió");
  alerts.length = 0;
  // A name the mock registrar refuses at purchase ("taken"): sold between the check and the buy.
  const r = await claim(tenantId, "takenpanzio.hu");
  ok(r.ok, "③ az igénylés elindul", JSON.stringify(r));
  if (!r.ok) return;
  const status = await prov.runDomainProvisioning(r.provisioningId);
  ok(status === "failed", "⭐ ③ regisztrátor-hiba → failed (a fizetős hibaág)", status);
  ok(alerts.some((a) => /domain-regisztráció NEM sikerült/.test(a.subject) && /Csomag-tartalom igénylés/.test(a.text)),
    "⭐ ③ a ház ugyanazt a riasztást kapja, mint fizetősnél (csomag-tartalomként megnevezve)",
    alerts.map((a) => a.subject).join(" | "));
  const m = await money(tenantId);
  ok(m.pays.length === 1 && m.pays[0]!.status === "cancelled", "③ a 0 Ft-os sor visszavonva", JSON.stringify(m.pays));
  ok((await activeDomainCommitment(tenantId)) === null, "⭐ ③ bukott igénylés után NINCS futó hűségidő");
  const mail = await db.selectFrom("tenant_message").select(["subject", "body_text"]).where("tenant_id", "=", tenantId).execute();
  const letter = mail.find((x) => /Nem tudtuk megvásárolni/.test(x.subject ?? ""));
  ok(!!letter && /nem fizetett érte semmit/.test(letter.body_text) && !/zárolás|befizetett|terheltük/.test(letter.body_text),
    "⭐ ③ a tulaj levele igaz: nem fizetett semmit — nincs zárolás/befizetés-mondat", letter?.body_text ?? "nincs levél");
  const d = await loadDomainAdmin(tenantId, "Balsors Panzió");
  ok(d.money === "free" && d.status === "failed", "③ a fül a díjmentes állapotot látja", `${d.money} / ${d.status}`);
  const screen = domainSection(d, {});
  ok(/nem tudtuk megvásárolni|más lefoglalta/.test(screen) && /Nem fizetett érte semmit/.test(screen) &&
      !/befizetett összeg|zárolás|munkatársunk intézi/i.test(screen),
    "⭐ ③ a hiba-képernyő nem ígér többet a fizetős hibaágnál, és nem beszél pénzről", screen.slice(0, 400));
  // A new choice after the failure is not blocked.
  const next = await claim(tenantId, "balsorspanzio.hu");
  ok(next.ok, "③ bukás után új név igényelhető", JSON.stringify(next));
  void siteId;
});

// ④ a package that does NOT carry the name is never claimed for free
await block("④", async () => {
  const { tenantId } = await makeTenant("Kis Panzió", { entitle: false });
  const r = await claim(tenantId, "kispanzio.hu");
  ok(!r.ok && r.reason === "not_package", "⭐ ④ csomag nélkül nincs díjmentes igénylés", JSON.stringify(r));
  const rows = await db.selectFrom("order_intent").select("id").where("tenant_id", "=", tenantId).execute();
  ok(rows.length === 0, "④ rendelés sem jön létre", String(rows.length));
});

// ⑤ the review step
await block("⑤ nézet", async () => {
  const base = {
    currentHost: "ribizli.citoviso.com", customDomain: null, status: "none" as const, error: null,
    failedDomain: null, money: null, moneyAmount: null, activeDomain: null,
    suggestions: [{ domain: "ribizli.hu", availability: "free" as const }], priceMonthly: 0, packageContent: true,
    feeByDomain: { "ribizli.hu": 0 } as Record<string, number>, feeRange: { min: 0, max: 0 },
    listFeeByDomain: { "ribizli.hu": 1000 } as Record<string, number>, listFeeRange: { min: 1000, max: 1200 },
    offeredTlds: [".hu"], eligible: true, minPackageMonthly: 7000, currency: "HUF", commitmentMonths: 12, mockMode: true,
  };
  const review = domainSection(base, { picked: "ribizli.hu", pickedAvailability: "free" });
  ok(/type="submit"/.test(review) && /a csomag része/.test(review) && !/munkatársunk intézi/.test(review) &&
      !/Most zárolunk|Tovább a fizetéshez/.test(review),
    "⭐ ⑤ az Áttekintés díj és zárolás nélkül igényeltet — nincs „munkatársunk intézi”", review.slice(0, 600));
  // Owner „ok” 2026-10-13: the step-1 fee line of a package-carried name — the package
  // sentence with the SELECTED ending's /pricing fee, the band before a selection, never „0 Ft”.
  {
    const two = {
      ...base,
      suggestions: [
        { domain: "ribizli.hu", availability: "free" as const },
        { domain: "ribizli.eu", availability: "free" as const },
      ],
      feeByDomain: { "ribizli.hu": 0, "ribizli.eu": 0 } as Record<string, number>,
      listFeeByDomain: { "ribizli.hu": 1000, "ribizli.eu": 1200 } as Record<string, number>,
    };
    // "1 000 Ft" must not read as "0 Ft": drop the thousands separators first.
    const zeroFt = (h: string) => /\b0\s*Ft/.test(h.replace(/(\d)[\s\u00a0\u202f](?=\d{3})/g, "$1"));
    const step1 = domainSection(two, {});
    const line = /<span data-dfee-line>([^<]*)<\/span>/.exec(step1)?.[1] ?? "";
    ok(/^A név a csomag része, külön díja nincs\. Ha kisebb csomagra vált, a név díja \(1[\s\u00a0\u202f]000 Ft\/hó\) elindul\.$/.test(line),
      "⭐ csomag-tartalom: a díjsor „A név a csomag része, külön díja nincs. Ha kisebb csomagra vált, a név díja (1 000 Ft/hó) elindul.”", line);
    const eu = /value="ribizli\.eu" data-dline="([^"]*)"/.exec(step1)?.[1] ?? "";
    ok(/a név díja \(1[\s\u00a0\u202f]200 Ft\/hó\) elindul/.test(eu), "⭐ csomag-tartalom: a .eu kijelölése a saját /pricing díját hozza (1 200 Ft/hó)", eu);
    const none = domainSection({ ...two, suggestions: two.suggestions.map((x) => ({ ...x, availability: "taken" as const })) }, {});
    const noneLine = /<span data-dfee-line>([^<]*)<\/span>/.exec(none)?.[1] ?? "";
    ok(/a név díja \(1[\s\u00a0\u202f]000–1[\s\u00a0\u202f]200 Ft\/hó\) elindul/.test(noneLine),
      "⭐ csomag-tartalom, kijelölés nélkül: díjsáv (1 000–1 200 Ft/hó)", noneLine);
    ok(![line, eu, noneLine].some(zeroFt) && !/A név díja/.test(line + eu + noneLine) && !/vállalásával jár/.test(line + eu + noneLine),
      "⭐ csomag-tartalomnál a díjsorban nincs „0 Ft”, sem a fizetős mondat", `${line} | ${eu} | ${noneLine}`);
    const paid = domainSection({ ...two, packageContent: false, priceMonthly: 1000, feeByDomain: { "ribizli.hu": 1000, "ribizli.eu": 1200 } }, {});
    const paidLine = /<span data-dfee-line>([^<]*)<\/span>/.exec(paid)?.[1] ?? "";
    ok(/^A név díja 1[\s\u00a0\u202f]000 Ft\/hó, és 12 hónapos előfizetés vállalásával jár\./.test(paidLine) && !/csomag része/.test(paid),
      "fizetős névnél a díjsor változatlan", paidLine);
  }
  const running = domainSection({ ...base, status: "dns_pending", money: "free", moneyAmount: 0, activeDomain: "ribizli.hu" }, {});
  ok(/Már intézzük/.test(running) && !/Összeg zárolva|terheltük/.test(running),
    "⑤ folyamatban: a fizetős út meglévő képernyője, pénz-sorok nélkül", running.slice(0, 400));
});

setHouseAlertDeps(null);
await db.destroy();
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
console.log(failed === 0 ? "\n✅ MIND ZÖLD" : `\n❌ ${failed} BUKÁS`);
process.exit(failed === 0 ? 0 : 1);
