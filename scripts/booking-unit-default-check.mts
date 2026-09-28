// ⛔⛔ A FOGLALÁSI WIDGET NYITÓ-EGYSÉGÉNEK ŐRE — kontraktus: assets/design-refs/tenant-site/booking-unit-default/
// (tulajdonosi jóváhagyás 2026-09-28, „1 — javasolt”; ADR-XXXX).
//
// A MÉRT LELET, amiért létezik (dev bérlő harom-huszar-apartments, 390 px, valódi touch): a widget
// a lista ELSŐ egységére nyitott — egy ár nélküli „egész szállás” egységre —, ezért minden vendég
// árajánlat-dobozt kapott, és telefonon az egység-választó az 1. lépésben 0×0 volt: a vendég egy
// másik egység naptárában választott napot, és csak a 2. lépésben derülhetett ki, hogy a szobákra
// VAN ár. HTTP- és JS-hiba nem volt — egy vak „van-e ár”-próba zöldet adott volna.
//
// Mit köt (a README ①–④):
//   ① a nyitó egység az első ÁRAS egység; a sorrend nem változik, az ár nélküli a listában marad;
//   ② telefonon a választó az 1. lépésben, a NAPTÁR FÖLÖTT, látható méretben; a 2. lépésben nincs;
//   ③ a 2. lépés összegzője megnevezi az egységet;
//   ④ asztalon a választó a jobb oszlopban marad (a helye nem változik); ablak-szűkítésre átköltözik.
//
// Eldobható fixtúra, valódi DB + valódi HTTP-szerver + valódi böngésző (390 touch + 1280).
// A `--selftest` a KIRENDERELT pillanatképben rontja vissza a történeti viselkedést (első egység,
// választó a mezők között), és ugyanazokat az állításokat futtatja — PIROSNAK KELL LENNIE.
//
//   npx tsx scripts/booking-unit-default-check.mts
//   npx tsx scripts/booking-unit-default-check.mts --selftest   ← PIROSNAK KELL LENNIE

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

const SELFTEST = process.argv.includes("--selftest");

import { once } from "node:events";
import { rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { setBasePrice } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown) =>
  c ? console.log(`  ✓ ${n}`) : (fail++, console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d)}`));

try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_bud", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_bud lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_bud tenant" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `bud-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `bud_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Nyitó-egység Teszt", intro: "Az egész ár nélkül, a szobák árazva.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: "owner@example.com" }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  // The measured shape: the whole place FIRST and unpriced (let as one), rooms after it, priced.
  const whole = await db.insertInto("site_unit").values({ site_id: site.id, name: "Az egész ház", sort_order: 0, is_whole_property: true, represents_whole: true }).returning("id").executeTakeFirstOrThrow();
  const room1 = await db.insertInto("site_unit").values({ site_id: site.id, name: "Nádas apartman", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const room2 = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kisházi szoba", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  await setBasePrice(room1.id, 24_000);
  await setBasePrice(room2.id, 16_000);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: "owner@example.com" }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  // ⛔ A piros önteszt a KIRENDERELT pillanatképet rontja vissza — ha a csere nem talál, HANGOSAN bukunk.
  if (SELFTEST) {
    const snap = path.join(ROOT, "sites", slug, "index.html");
    let html = await readFile(snap, "utf8");
    const pick = "if (!units[ui].unpriced) { unitSel.value = units[ui].id; break; }";
    const place = "    placeUnit();\n";
    if (!html.includes(pick) || !html.includes(place)) {
      console.error("⛔ ÖNTESZT: nem találom a nyitó-egység / áthelyezés sorát a pillanatképben — nem rontok vissza vakon.");
      process.exit(1);
    }
    html = html.replace(pick, "break;").replace(place, "\n");
    await writeFile(snap, html, "utf8");
    console.log("  🔴 ÖNTESZT: a pillanatkép visszarontva (első egység, választó a mezők között).\n");
  }

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const browser = await chromium.launch();
  const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  for (const [label, width, phone] of [["telefon", 390, true], ["asztali", 1280, false]] as const) {
    console.log(`\n══ ${label} (${width}px)`);
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 1000 }, hasTouch: phone, isMobile: phone });
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/t/${slug}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const state = () => page.evaluate(() => {
      const f = document.querySelector("form.cit-book") as HTMLFormElement;
      const s = f.querySelector("#cit-unit") as HTMLSelectElement;
      const r = s.getBoundingClientRect();
      const cal = f.querySelector(".cit-book__cal")!.getBoundingClientRect();
      return {
        value: s.value, options: [...s.options].map((o) => o.text),
        inCal: Boolean(s.closest(".cit-book__calcol")), w: Math.round(r.width), h: Math.round(r.height),
        aboveCal: r.bottom <= cal.top + 1,
      };
    });
    const s0 = await state();
    check("① a nyitó egység az első ÁRAS (Nádas apartman)", s0.value === room1.id, s0.value);
    check("① a sorrend változatlan, az ár nélküli a listában marad, jelölve", /Az egész ház/.test(s0.options[0] ?? "") && /egyedi ár/.test(s0.options[0] ?? "") && s0.options.length === 3, s0.options);
    if (phone) {
      check("② telefonon a választó az 1. lépésben, a naptár oszlopában", s0.inCal, s0);
      check("② …látható méretben (nem 0×0)", s0.w > 100 && s0.h >= 40, s0);
      check("② …a NAPTÁR FÖLÖTT", s0.aboveCal, s0);
    } else {
      check("④ asztalon a választó a jobb oszlopban marad", !s0.inCal && s0.w > 100, s0);
    }
    const f = page.locator("form.cit-book");
    await f.evaluate((el, [a, b]) => {
      const form = el as HTMLFormElement;
      (form.elements.namedItem("from") as HTMLInputElement).value = a!;
      form.from.dispatchEvent(new Event("change", { bubbles: true }));
      (form.elements.namedItem("to") as HTMLInputElement).value = b!;
      form.to.dispatchEvent(new Event("change", { bubbles: true }));
    }, [iso(20), iso(22)]);
    await page.waitForTimeout(500);
    const quote = await page.locator("[data-quote]").innerText();
    check("① a dátumok után azonnal ár (48 000 Ft), nem árajánlat-doboz", /48\s?000/.test(quote) && !/egyedi árat ad/.test(quote), quote.slice(0, 120));
    if (phone) {
      await page.locator(".cit-book__go").tap();
      await page.waitForTimeout(400);
      const sum = await page.locator(".cit-book__sum").innerText();
      check("③ a 2. lépés összegzője megnevezi az egységet", /Nádas apartman/.test(sum), sum);
      const s2 = await state();
      check("② a 2. lépésben a választó nem ismétlődik", s2.h === 0, s2);
      check("…a küldő gomb foglalást ígér", /Foglalási kérés/.test(await page.locator(".cit-book__submit").innerText()));
    } else {
      // ④ narrowing the window moves the ONE picker into step 1 (matchMedia change)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const s3 = await state();
      check("④ ablak-szűkítésre a választó átköltözik az 1. lépésbe", s3.inCal && s3.h >= 40, s3);
      check("④ …és egyetlen választó van (nem másolat)", (await page.locator('form.cit-book [name="unit"]').count()) === 1);
    }
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await ctx.close();
  }
  await browser.close();
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
if (SELFTEST) {
  if (fail === 0) {
    console.error("\n⛔ AZ ÖNTESZT NEM BUKOTT: a történeti viselkedést az őr átengedte — vak.");
    process.exit(1);
  }
  console.log(`\n🔴 ÖNTESZT: ${fail} bukás a történeti viselkedésen — az őr lát.`);
  process.exit(1);
}
console.log(fail ? `\n⛔ BOOKING-UNIT-DEFAULT: ${fail} bukás` : "\n🟢 BOOKING-UNIT-DEFAULT: a widget az első áras egységre nyit, telefonon a választó az 1. lépésben");
process.exit(fail ? 1 : 0);
