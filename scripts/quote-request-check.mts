// ⛔⛔ AZ ÁRAJÁNLAT-MÓD ŐRE — kontraktus: assets/design-refs/tenant-site/quote-request/
// (tulajdonosi jóváhagyás 2026-09-22, „C" változat).
//
// A MÉRT LELET, amiért létezik. Ha a kiválasztott egységre — vagy a tartózkodás BÁRMELYIK
// éjszakájára — nem állt össze ár, a `renderQuote` NÉMÁN kiürítette az ár-dobozt
// (`if (!q) { el.innerHTML = ""; }`). Asztalon üres lyuk maradt a dátum-sáv alatt, mobilon
// összecsukódott — a naptár, az űrlap és a gomb viszont változatlanul működött, tehát a
// vendég megnyomta a „Foglalási kérés elküldése" gombot úgy, hogy SOHA nem látott árat.
//
// Miért END-TO-END és nem egység-teszt: a kontraktus HÁROM felületi tényt köt EGYSZERRE
// (a doboz tartalma · a gomb felirata · a gomb alatti ígéret), és azok három külön helyen
// épülnek. Egy `quoteFor`-ra írt egység-teszt mindháromra zöld lett volna.
//
// Eldobható fixtúrán mér: valódi DB + valódi HTTP-szerver + valódi böngésző, mindkét méreten.
// A `--selftest` nem szimulál: a KIRENDERELT pillanatképben cseréli vissza a történeti
// viselkedést (néma kiürítés), és újra lefuttatja ugyanazokat az állításokat.
//
//   npx tsx scripts/quote-request-check.mts
//   npx tsx scripts/quote-request-check.mts --selftest   ← PIROSNAK KELL LENNIE

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

const SELFTEST = process.argv.includes("--selftest");

import { once } from "node:events";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
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
  const def = await db.insertInto("scraper_definition").values({ label: "_ask", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_ask lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_ask tenant" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `ask-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `ask_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Árajánlat Teszt", intro: "Két egység, egyikre van ár.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: "owner@example.com" }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const priced = await db.insertInto("site_unit").values({ site_id: site.id, name: "Árazott apartman", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const unpriced = await db.insertInto("site_unit").values({ site_id: site.id, name: "Árazatlan faház", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  await setBasePrice(priced.id, 28_000);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: "owner@example.com" }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  // ⛔ A piros önteszt a KIRENDERELT pillanatképet rontja vissza a történeti alakra —
  // nem egy szintetikus lapot mér, hanem azt, amit a vendég kap. Ha a csere nem talál,
  // HANGOSAN bukunk: egy önteszt, ami némán nem ront vissza semmit, zöldet hazudna.
  if (SELFTEST) {
    const snap = path.join(ROOT, "sites", slug, "index.html");
    const html = await readFile(snap, "utf8");
    const marker = 'el.classList.add("cit-book__quote--ask");';
    if (!html.includes(marker)) {
      console.error("⛔ ÖNTESZT: nem találom az árajánlat-ágat a pillanatképben — nem tudok visszarontani.");
      process.exit(1);
    }
    const start = html.indexOf('if (!q) {');
    const end = html.indexOf('setAskMode(true);\n        return;\n      }');
    if (start < 0 || end < 0) {
      console.error("⛔ ÖNTESZT: az ág határai nem azonosíthatók — nem rontok vissza vakon.");
      process.exit(1);
    }
    await writeFile(snap, html.replace(marker, "/* visszarontva */").replace(
      /if \(!q\) \{[\s\S]*?setAskMode\(true\);\s*return;\s*\}/,
      'if (!q) { el.innerHTML = ""; return; }',
    ), "utf8");
    console.log("  🔴 ÖNTESZT: a pillanatkép visszarontva a NÉMA kiürítésre.\n");
  }

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;

  const browser = await chromium.launch();
  const OUT = path.join(ROOT, "assets", "Temp");
  await mkdir(OUT, { recursive: true });

  for (const [label, width, desktop] of [["mobil", 390, false], ["asztali", 1280, true]] as const) {
    console.log(`\n══ ${label} (${width}px)`);
    const ctx = await browser.newContext({ viewport: { width, height: 1100 } });
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/t/${slug}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // ⑤ a jelölés MÁR A VÁLASZTÓBAN
    const opts = await page.locator('select[name="unit"] option').allTextContents();
    check("⑤ az árazatlan egység a VÁLASZTÓBAN jelölve", opts.some((o) => /Árazatlan faház/.test(o) && /egyedi ár/.test(o)), opts);
    check("…és az árazott NINCS megjelölve", opts.some((o) => /Árazott apartman/.test(o) && !/egyedi ár/.test(o)), opts);

    const days = page.locator("[data-day]:not([disabled]):not(.is-blocked)");
    if ((await days.count()) >= 6) { await days.nth(3).click(); await page.waitForTimeout(150); await days.nth(5).click(); await page.waitForTimeout(600); }

    const sel = page.locator('select[name="unit"]').first();
    const cta = page.locator(".cit-book__submit").first();
    const note = page.locator(".cit-book__note").first();

    // ⑥ ÁRAZOTT: semmi nem változik
    await sel.selectOption({ index: 0 }); await page.waitForTimeout(700);
    check("⑥ árazott egységnél megjelenik az összeg", /\d[\d\s]*Ft/.test(await page.locator("[data-quote]").innerText()));
    check("⑥ …a gomb foglalást ígér", /Foglalási kérés/.test(await cta.innerText()), await cta.innerText());
    check("⑥ …és az alatta álló mondat is", /véglegessé/.test(await note.innerText()));

    // ②③④ ÁRAZATLAN: a néma üresség helyén magyarázat, a gomb és az ígéret EGYÜTT vált
    await sel.selectOption({ index: 1 }); await page.waitForTimeout(900);
    const quoteTxt = await page.locator("[data-quote]").innerText();
    check("② az üresség helyén MAGYARÁZAT áll", /egyedi árat ad/.test(quoteTxt), quoteTxt.slice(0, 120));
    check("② …és kimondja, hogy ez még nem kötelezettség", /nem vállal fizetési kötelezettséget/.test(quoteTxt));
    check("③ ⭐ a gomb árajánlatot kér", /Árajánlatot kérek/.test(await cta.innerText()), await cta.innerText());
    check("④ ⭐ a gomb alatti ígéret is árajánlatról szól", /árajánlattal válaszol/.test(await note.innerText()), await note.innerText());
    check("④ …és NEM ígér helyszíni fizetést egy ár nélküli kérésre", !/A fizetés a helyszínen/.test(await note.innerText()));

    // ⛔ A `note` elem KÖZÖS: a validációs hiba is ide íródik, és hiba nélkül az
    // alap-mondat áll vissza. Az első változatom emiatt árajánlat-módban is a FOGLALÁSI
    // ígéretet hozta vissza (a shot-booking-form őre mérte ki). Ezt VALÓDI úton tűzzük
    // ki: a létszám léptetése újrarajzoltatja az árat, tehát átmegy ugyanazon a
    // visszaállító ágon. ⚠️ Az első próbám SZINTETIKUS volt — kézzel vette le a
    // hiba-osztályt, de a visszaállítót sosem hívta meg —, és a saját hibáján bukott.
    await page.locator('.cit-book__step[data-step="1"]').first().click();
    await page.waitForTimeout(700);
    check(
      "⭐⭐ újrarajzolás után is az ÁRAJÁNLAT-mondat áll, nem a foglalási ígéret",
      /árajánlattal válaszol/.test(await note.innerText()) && !/A fizetés a helyszínen/.test(await note.innerText()),
      await note.innerText(),
    );
    check(
      "⭐ …és a gomb is árajánlatnál marad",
      /Árajánlatot kérek/.test(await cta.innerText()),
      await cta.innerText(),
    );

    check("⛔ és NINCS kitalált összeg", !/\d[\d\s]*Ft/.test(quoteTxt), quoteTxt.slice(0, 120));
    const box = await page.locator(".cit-book__ask").first().boundingBox();
    console.log(`     a magyarázó doboz: ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)} px`);
    await page.screenshot({ path: path.join(OUT, `ui-ask-${label}.png`) });

    // ⑥ vissza — a jelzés ne ragadjon be
    await sel.selectOption({ index: 0 }); await page.waitForTimeout(900);
    check("⑥ visszaváltva a gomb ÚJRA foglalást ígér (nem ragad be)", /Foglalási kérés/.test(await cta.innerText()), await cta.innerText());
    check("⑥ …és az ár is visszajön", /\d[\d\s]*Ft/.test(await page.locator("[data-quote]").innerText()));
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await ctx.close();
  }
  await browser.close();
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
if (SELFTEST) {
  if (fail === 0) {
    console.error("\n⛔ AZ ÖNTESZT NEM BUKOTT: a néma kiürítést az őr átengedte — vak.");
    process.exit(1);
  }
  console.log(`\n🔴 ÖNTESZT: ${fail} bukás a történeti viselkedésen — az őr lát.`);
  process.exit(1);
}
console.log(fail ? `\n⛔ QUOTE-REQUEST: ${fail} bukás` : "\n🟢 QUOTE-REQUEST: a szállított felület követi a jóváhagyott C tervet");
process.exit(fail ? 1 : 0);
