// A vendég az ár-alapot a FOGLALT egységre kapja, és az idegenforgalmi adó a beküldés
// után sem tűnik el — ŐR (Elek élesi leletei V-2 · V-3, 2026-10-01; jóváhagyott terv:
// assets/design-refs/tenant-admin/m1-elek-javitasok/ ③ ④, tulaj 2026-10-02).
//
// Mit mér:
//   ① V-2 (valódi böngésző, a valódi widget): SZOBA választásakor a mondat a szobát
//      nevezi („a szoba egészére … („Erkélyes kétágyas szoba”)”), és NEM mondja, hogy
//      „a TELJES SZÁLLÁSRA”; az egész-szállás egységnél igen (kétirányú mérés).
//   ② V-3 nyugta, a HÁROM állapot: megadott IFA → tételes sor összeggel; 0 („nincs IFA”)
//      → a nyugta nem is említi; kitöltetlen → kimondja, összeg NÉLKÜL (§B.17).
//   ③ V-3 mobil 2. lépés: az összesítő alatt ott az IFA-sor, és a léptetővel frissül.
//   ④ V-3 szerver (valódi DB, eldobható fixtúra): a kérés BEFAGYASZTJA az adót
//      (`quoted_tax_per_person_night`: 500 / 0 / NULL), a summary viszi, és a
//      „rögzítettük” + a visszaigazoló levél kiírja (outbox/, @example.com).
//
//   npx tsx scripts/booking-tax-receipt-check.mts

process.env.CIT_SHOT = "1";
process.env.EMAIL_PROVIDER = "mock";

import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const STARTED = Date.now();
const { config } = await import("../src/config.js");
const { bookingSlot } = await import("../src/engine/templateKit.js");
const { moduleSections } = await import("../src/engine/moduleSections.js");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setBasePrice } = await import("../src/tenant/prices.js");
const { createUnit } = await import("../src/tenant/units.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { createBookingRequest, decideRequest } = await import("../src/booking/requests.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 260)}`}`);
  if (!c) fail++;
};
const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

/* ── the real widget, built by hand like booking-price-clarity-check ───────── */
const ROOM = "22222220-2222-2222-2222-222222222220";
const WHOLE = "22222221-2222-2222-2222-222222222221";
function siteData(): SiteData {
  return {
    name: "Muschel Teszt Panzió",
    tagline: "",
    intro: "",
    highlights: [],
    photos: [],
    contact: { email: "info@example.com" },
    booking: {
      units: [
        { id: ROOM, name: "Erkélyes kétágyas szoba", capacity: 2 },
        { id: WHOLE, name: "A szállás egésze", capacity: 5, whole: true },
      ],
      minNights: 1,
      maxNights: 14,
      horizonMonths: 12,
      leadTimeDays: 0,
      touristTaxPerPersonNight: 500,
    },
  } as unknown as SiteData;
}
async function pageHtml(summaryTax: number | undefined): Promise<string> {
  const [moneyJs, seasonJs, runtimeJs, modulesCss] = await Promise.all([
    readFile(path.join(ROOT, "assets/runtime/cit-money.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-season.cjs"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
    readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
  ]);
  const d = siteData();
  const summary = {
    dateFrom: iso(20), dateTo: iso(23), nights: 3, guests: 2, unitName: "Erkélyes kétágyas szoba",
    ref: "FG-ABC123", total: 54000, currency: "HUF", expireHours: 48, guestEmail: "vendeg@example.com",
    lines: [{ label: "Alapár", nights: 3, perNight: 18000, guests: 1, sum: 54000 }],
    ...(summaryTax !== undefined ? { touristTaxPerPersonNight: summaryTax } : {}),
  };
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u,o){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify({ blocked: [], pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 18000, label: "Alapár" }] } })});}});}` +
    `if(s.indexOf("/api/foglalas")>=0){return Promise.resolve({ok:true,json:function(){` +
    `return Promise.resolve(${JSON.stringify({ ok: true, summary })});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>:root{--cit-bg:#fff;--cit-ink:#16283f;--cit-muted:#5b6b7f;--cit-line:#dbe3ec;--cit-accent:#0e7f8c;--cit-radius:14px}body{font-family:system-ui,sans-serif;margin:0}</style>` +
    `<style>${modulesCss}</style></head><body>` + stub + bookingSlot(d) + moduleSections(d) +
    `<script>${moneyJs}</script><script>${seasonJs}</script><script>${runtimeJs}</script></body></html>`
  );
}
async function open(browser: Awaited<ReturnType<typeof chromium.launch>>, html: string, width: number): Promise<Page> {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "btax-")), "site.html");
  await writeFile(file, html, "utf8");
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(400);
  return page;
}
async function pickDays(page: Page): Promise<void> {
  const free = page.locator(".cit-book__day:not(:disabled):visible");
  for (let i = 0; i < 3 && (await free.count()) < 5; i++) {
    await page.click(".cit-book__calnav--next");
    await page.waitForTimeout(150);
  }
  await free.nth(1).click();
  await free.nth(4).click();
  await page.waitForTimeout(250);
}
async function submit(page: Page): Promise<string> {
  if (await page.locator(".cit-book__go").isVisible()) { await page.click(".cit-book__go"); await page.waitForTimeout(300); }
  await page.fill("#cit-name", "Teszt Vendég");
  await page.fill("#cit-email", "vendeg@example.com");
  if (await page.locator("#cit-phone").count()) await page.fill("#cit-phone", "+36301112222");
  await page.locator(".cit-book__submit").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.locator(".cit-book__submit").click();
  await page.waitForTimeout(800);
  if (!(await page.locator(".cit-book--done").count())) return `NINCS NYUGTA: ${(await page.locator(".cit-book__note").first().textContent()) ?? ""}`;
  return (await page.locator(".cit-book--done").textContent()) ?? "";
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  // ── ① V-2 ──────────────────────────────────────────────────────────────
  console.log("\n① V-2 · az ár-alap a foglalt egységet mondja");
  {
    const page = await open(browser, await pageHtml(500), 1280);
    await page.selectOption("select[name='unit']", ROOM);
    await page.waitForTimeout(250);
    await pickDays(page);
    const room = (await page.locator(".cit-book__qbasis").textContent()) ?? "";
    check("⭐ szobánál a szobát nevezi", room.includes("a szoba egészére") && room.includes("„Erkélyes kétágyas szoba”"), room);
    check("⭐ szobánál NEM mondja „a TELJES SZÁLLÁSRA”", !room.includes("TELJES SZÁLLÁSRA"), room);
    await page.selectOption("select[name='unit']", WHOLE);
    await page.waitForTimeout(400);
    await pickDays(page);
    const whole = (await page.locator(".cit-book__qbasis").textContent()) ?? "";
    check("negatív kontroll: az egész-szállás egységnél „a TELJES SZÁLLÁSRA”", whole.includes("TELJES SZÁLLÁSRA"), whole);
    await page.close();
  }

  // ── ② V-3 receipt, three states ────────────────────────────────────────
  console.log("\n② V-3 · nyugta, három állapot");
  for (const [label, tax, want] of [
    ["megadott (500)", 500, (r: string) => /A helyszínen fizetendő ezen felül/.test(r) && /3 000 Ft/.test(r)],
    ["„nincs IFA” (0)", 0, (r: string) => !/idegenforgalmi/i.test(r)],
    ["kitöltetlen", undefined, (r: string) => /az összegéről a szállásadó tájékoztatja/.test(r) && !/500/.test(r)],
  ] as const) {
    const page = await open(browser, await pageHtml(tax), 1280);
    await page.selectOption("select[name='unit']", ROOM);
    await page.waitForTimeout(250);
    await pickDays(page);
    const r = await submit(page);
    check(`a nyugta megjelent (${label})`, /Elküldtük a kérését/.test(r), r.slice(0, 80));
    check(`⭐ nyugta, IFA ${label}`, want(r), r.slice(r.indexOf("Összesen"), r.indexOf("Összesen") + 200));
    await page.close();
  }

  // ── ③ V-3 phone step 2 ─────────────────────────────────────────────────
  console.log("\n③ V-3 · mobil 2. lépés");
  {
    const page = await open(browser, await pageHtml(500), 390);
    await pickDays(page);
    await page.click(".cit-book__go");
    await page.waitForTimeout(300);
    const s1 = (await page.locator(".cit-book__sum").textContent()) ?? "";
    check("⭐ az összesítő alatt ott az IFA-sor", /Idegenforgalmi adó/.test(s1) && /× 2 fő/.test(s1), s1);
    await page.locator(".cit-book__step[data-step='1']").first().click();
    await page.waitForTimeout(300);
    const s2 = (await page.locator(".cit-book__sum").textContent()) ?? "";
    check("⭐ a léptetővel frissül (2 → 3 fő)", /× 3 fő/.test(s2), s2);
    await page.close();
  }
} finally {
  await browser.close();
}

// ── ④ V-3 server: frozen on the request, carried by the letters ──────────────
console.log("\n④ V-3 · szerver: befagyasztva, a levelekben is");
const OUTBOX = path.join(ROOT, "outbox");
async function mailsTo(who: string): Promise<{ subject: string; body: string }[]> {
  await new Promise((r) => setTimeout(r, 900));
  const out: { subject: string; body: string }[] = [];
  for (const f of (await readdir(OUTBOX).catch(() => [] as string[])).sort()) {
    const p = path.join(OUTBOX, f);
    if ((await stat(p)).mtimeMs < STARTED) continue;
    const raw = await readFile(p, "utf8");
    if (!(/^To: (.*)$/m.exec(raw)?.[1] ?? "").includes(who)) continue;
    out.push({ subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "", body: raw.slice(raw.indexOf("\n\n") + 2) });
  }
  return out;
}
const ids: Record<string, string> = {};
try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_btx", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_btx lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "IFA-teszt Panzió" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db.insertInto("site").values({ tenant_id: tenant.id, preview_token: `btx_${stamp}`, slug: `btx-${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  await setTenantModules(tenant.id, ["booking", "pricing"]);
  const unit = (await createUnit(site.id, "Erkélyes kétágyas szoba", 2, null))!;
  await setBasePrice(unit, 18000);
  let offset = 30;
  for (const [label, tax, stored, mailWant] of [
    ["megadott (500)", 500, 500, (b: string) => /idegenforgalmi adó/.test(b) && /3 000 Ft/.test(b)],
    ["„nincs IFA” (0)", 0, 0, (b: string) => !/idegenforgalmi/i.test(b)],
    ["kitöltetlen", "", null, (b: string) => /az összegéről a szállásadó tájékoztatja/.test(b)],
  ] as const) {
    await setSiteModuleConfig(site.id, "booking", { notifyEmail: `owner-${stamp}@example.com`, touristTaxPerPersonNight: tax }, "test");
    const guest = `g${offset}-${stamp}@example.com`;
    const res = await createBookingRequest(
      { siteId: site.id, unitId: unit, guestName: "Teszt Vendég", guestEmail: guest, guestPhone: "+36301112222", dateFrom: iso(offset), dateTo: iso(offset + 3), guests: 2 },
      null,
    );
    offset += 10;
    check(`a kérés létrejött (${label})`, res.ok, res.errors);
    const row = await db.selectFrom("booking_request").select(["quoted_tax_per_person_night", "action_token"]).where("id", "=", res.id!).executeTakeFirstOrThrow();
    check(`⭐ befagyasztva a kérésen (${label})`, row.quoted_tax_per_person_night === stored, row.quoted_tax_per_person_night);
    const want = stored === null ? undefined : stored;
    check(`a summary viszi (${label})`, res.summary?.touristTaxPerPersonNight === want, res.summary?.touristTaxPerPersonNight);
    // The setting changes AFTER sending — the confirmation must still say what was frozen.
    if (stored === 500) await setSiteModuleConfig(site.id, "booking", { notifyEmail: `owner-${stamp}@example.com`, touristTaxPerPersonNight: 900 }, "test");
    await decideRequest(row.action_token, "accepted", null);
    const mails = await mailsTo(guest);
    const ack = mails.find((m) => /rögzítettük/.test(m.subject));
    const conf = mails.find((m) => /Visszaigazolt foglalás/.test(m.subject));
    check(`„rögzítettük” levél megjött (${label})`, Boolean(ack), mails.map((m) => m.subject));
    check(`⭐ „rögzítettük” levél, IFA ${label}`, Boolean(ack && mailWant(ack.body)));
    check(`visszaigazoló levél megjött (${label})`, Boolean(conf), mails.map((m) => m.subject));
    check(`⭐ visszaigazoló levél, IFA ${label}${stored === 500 ? " — a beküldéskori összeg, nem a később átírt" : ""}`,
      Boolean(conf && mailWant(conf.body) && !(stored === 500 && /900 Ft/.test(conf.body))));
  }
} finally {
  if (ids.siteId) {
    await db.deleteFrom("availability_day").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ BOOKING-TAX-RECEIPT: ${fail} bukás` : "\n🟢 BOOKING-TAX-RECEIPT: az ár-alap a foglalt egységet mondja; az IFA a nyugtán, a mobil 2. lépésben és mindkét vendég-levélben ott van (három állapot)");
process.exit(fail ? 1 : 0);
