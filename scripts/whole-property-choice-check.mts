// AZ EGÉSZ HÁZ — EGYSZERŰSÍTVE — ŐR
// (ADR-0392, jóváhagyott terv: assets/design-refs/tenant-admin/whole-house-simple/, tulaj 2026-10-15:
// „csináld"; felülírja az ADR-0232 kártyáját és „melyik szoba" választóját, az ADR-0256 rejtését).
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver, a RENDERELT lapon):
//   ① EGY egységnél nincs ház-kártya; az alapnevű egységnél nincs kérdés; a tulaj által
//      átnevezett egyetlen egységnél két KÖTELEZŐ rádió: „az egész ház” / „az első szobám”;
//   ② a válasz nélküli felvételt a szerver elutasítja, és SEMMIT nem ír;
//   ③ „az egész ház” → az eddigi marad a ház, az új az első szoba; a ház és a szoba kizárja
//      egymást, két szoba egymást nem (`blockingUnitIds`);
//   ④ a Szobák lap: ház-kártya, NINCS „melyik szoba” választó és háromutas rádió, a ház nem
//      kártya a rácson; ADR-XXXX: szobánként kiadva a háznak NINCS ár-mezője (a vendég minden
//      szobát kipipál); „Csak egyben” módban az alapára: hibás → elutasítva, jó → mentve, üres → törölve;
//   ⑤ „Csak egyben adom ki” pipa ki/be (`whole_only`);
//   ⑥ több szobánál a ház nem törölhető, egy szobánál igen;
//   ⑦ „az első szobám” → az eddigi szoba lesz, a ház KÜLÖN jön létre (alapnévvel, ár nélkül);
//   ⑧ `ensureUnits` rendbe teszi a régi adatot: a régi választóval szobára tett jelölés,
//      a rejtett („nem adom ki egyben”) ház, ház nélküli két szoba — negatív kontrollal:
//      `peekUnits` nem ír; egy szoba ház nélkül marad;
//   ⑨ ADR-XXXX: a vendég-lap listájában a szobák, a ház NEM; az Árak lapon a háznak nincs
//      ár-kártyája (és tájékoztató szumma sincs), a vendég-lapon sincs;
//   ⑩ böngészőben (390 px, touch): a pipa magától ment, 0 JS-hiba.
//
// Usage: npx tsx scripts/whole-property-choice-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setBasePrice, getSitePrices } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { ensureUnits, getUnits, peekUnits, deleteUnit, DEFAULT_UNIT_NAME } = await import("../src/tenant/units.js");
const { blockingUnitIds } = await import("../src/tenant/unitScope.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 220)}`}`);
  if (!c) fail++;
};

try {
  // ── fixture ────────────────────────────────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_wpc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_wpc lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Egész-szállás Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `wpc-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `wpc_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Egész-szállás Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: `w-${stamp}@example.com` } }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `wpc_${stamp}`, contact_email: `w-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const COOKIE = `cit_session=${mintTenantCookieValue(tu.id)}`;
  const get = async (p: string): Promise<string> => (await fetch(BASE + p, { headers: { cookie: COOKIE } })).text();
  const post = async (p: string, body: Record<string, string>): Promise<string> => {
    const r = await fetch(BASE + p, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: COOKIE, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    return r.headers.get("location") ?? "";
  };
  const ROOMS = "/admin?tab=modulok&m=rooms";
  /** The grid only (the popups sit after it and repeat the meta line). */
  const grid = (html: string): string => {
    const i = html.indexOf('class="rs-grid"');
    const j = html.indexOf('class="unit-more"', i); // the add form under the grid (room-add-B)
    return i < 0 ? "" : html.slice(i, j < 0 ? undefined : j);
  };

  const unitsAttr = (h: string) => (/data-cit-units="([^"]*)"/.exec(h)?.[1] ?? "").replace(/&quot;/g, '"');
  const snapshot = async (): Promise<string> => {
    if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
    return readFile(path.join(siteDir, "index.html"), "utf8");
  };

  // ── ① one unit ─────────────────────────────────────────────────────────
  console.log("\n① egy egység");
  const first = (await ensureUnits(site.id))[0]!;
  let html = await get(ROOMS);
  check("nincs ház-kártya", !html.includes("data-cit-whole-card"));
  check("az alapnevű egységnél nincs kérdés", !html.includes("data-cit-whole-q"));
  await db.updateTable("site_unit").set({ name: "Matróz ház" }).where("id", "=", first.id).execute();
  html = await get(ROOMS);
  check("átnevezett egyetlen egység → kérdés", html.includes("data-cit-whole-q"));
  check("…két KÖTELEZŐ rádió (egesz / szoba)", /name="first" value="egesz" required/.test(html) && /name="first" value="szoba" required/.test(html));
  check("…megnevezi az eddigi egységet", html.includes("Mi az eddigi „Matróz ház”?"));
  check("nincs régi háromutas kérdés", !/name="whole"/.test(html));

  // ── ② no answer → nothing written ──────────────────────────────────────
  console.log("\n② válasz nélkül");
  let loc = await post("/admin/units/save", { name: "Szoba A", capacity: "2", back: "rooms" });
  check("elutasítva, kimondott üzenettel", /hiba=/.test(loc) && decodeURIComponent(loc).includes("Mondja meg, mi az eddigi „Matróz ház”"), loc);
  check("…és SEMMI nem íródott (1 egység)", (await getUnits(site.id)).length === 1);

  // ── ③ „az egész ház” ───────────────────────────────────────────────────
  console.log("\n③ „az egész ház”");
  await post("/admin/units/save", { name: "Szoba A", capacity: "2", back: "rooms", first: "egesz" });
  let units = await getUnits(site.id);
  const house = units.find((u) => u.id === first.id)!;
  const roomA = units.find((u) => u.name === "Szoba A")!;
  check("2 egység", units.length === 2, units.length);
  check("az eddigi a ház: a hely, egyben kiadó, nem csak-egyben", house.representsWhole && house.isWholeProperty && !house.wholeOnly, house);
  check("az új a szoba", !roomA.representsWhole && !roomA.isWholeProperty);
  await post("/admin/units/save", { name: "Szoba C", capacity: "3", back: "rooms" });
  units = await getUnits(site.id);
  const roomC = units.find((u) => u.name === "Szoba C")!;
  check("a 3. egységnél nincs kérdés, és nem jön második ház", units.filter((u) => u.representsWhole).length === 1 && units.length === 3);
  check("a ház mindkét szobát zárja", (await blockingUnitIds(house.id)).sort().join() === [house.id, roomA.id, roomC.id].sort().join());
  check("egy szoba a házat zárja, a másik szobát NEM", (await blockingUnitIds(roomA.id)).sort().join() === [house.id, roomA.id].sort().join());

  // ── ④ the rooms screen + the house price ────────────────────────────────
  console.log("\n④ a Szobák lap");
  html = await get(ROOMS);
  check("ház-kártya", html.includes("data-cit-whole-card") && html.includes('id="egesz-haz"'));
  // ADR-XXXX: the house is no separate offer beside its rooms — the card says so, and has no price field.
  check("„egy vagy több szobát … egy kérésben” mondat", html.includes("A vendég egy vagy több szobát foglalhat egy kérésben"));
  check("szobánként kiadva NINCS ár-mező a ház kártyáján", !html.includes(`class="rs-house__price"`));
  await post("/admin/units/whole", { what: "only", only: "1" });
  html = await get(ROOMS);
  check("NINCS „melyik szoba” választó", !html.includes("data-cit-whole-pick") && !/melyik szoba/.test(html));
  check("NINCS háromutas rádió", !/name="mode"/.test(html) && !html.includes("Egyben is kiadom") && !html.includes("Nem adom ki egyben"));
  check("a ház NEM kártya a rácson", !grid(html).includes(`data-rs-card="${house.id}"`) && grid(html).includes(`data-rs-card="${roomA.id}"`));
  check("a ház szerkesztője elérhető a kártyáról", html.includes(`href="#szoba-${house.id}"`) && html.includes(`id="szoba-${house.id}"`));
  check("a kártya: 2 szoba · 5 fő", /2 szoba · 5 fő/.test(html));
  check("ár nélkül: „a vendég árajánlatot kér”", html.includes("nincs megadva — a vendég árajánlatot kér"));
  loc = await post("/admin/units/whole", { what: "price", price: "abc" });
  check("hibás ár → elutasítva, kimondva", decodeURIComponent(loc).includes("Az ár egy pozitív egész szám legyen"), loc);
  check("…és nem mentődött", ((await getSitePrices(site.id)).get(house.id) ?? []).length === 0);
  loc = await post("/admin/units/whole", { what: "price", price: "60.000 Ft" });
  check("jó ár (ezres pont, Ft) → mentve", ((await getSitePrices(site.id)).get(house.id) ?? []).some((p) => p.isBase && p.amount === 60000), loc);
  html = await get(ROOMS + "&haz=ar");
  check("a kártya mutatja az árat és azt, hogy mentve", /60[\s  ]000/.test(html) && html.includes("Mentve: az egész ház ára."));
  await post("/admin/units/whole", { what: "price", price: "" });
  check("üres ár → törölve", ((await getSitePrices(site.id)).get(house.id) ?? []).length === 0);
  await setBasePrice(house.id, 60000);

  // ── ⑤ „Csak egyben adom ki” ────────────────────────────────────────────
  console.log("\n⑤ „Csak egyben adom ki”");
  check("bepipálva → whole_only", (await getUnits(site.id)).find((u) => u.id === house.id)!.wholeOnly);
  html = await get(ROOMS);
  check("a kártya kimondja", html.includes("A vendég csak az egész házat foglalhatja.") && /name="only" value="1" checked/.test(html));
  await post("/admin/units/whole", { what: "only" });
  const hOff = (await getUnits(site.id)).find((u) => u.id === house.id)!;
  check("kivéve → a ház foglalható marad, csak a pipa megy le", hOff.isWholeProperty && hOff.representsWhole && !hOff.wholeOnly);

  // ── ⑥ delete rules ─────────────────────────────────────────────────────
  console.log("\n⑥ törlés");
  const del = await deleteUnit(site.id, house.id);
  check("két szobánál a ház NEM törölhető", !del.ok && /Az egész ház nem törölhető/.test(del.reason ?? ""), del);
  check("egy szoba törölhető", (await deleteUnit(site.id, roomC.id)).ok);
  check("…utána a ház is (egy szoba maradt)", (await deleteUnit(site.id, house.id)).ok);
  units = await getUnits(site.id);
  check("egy egység maradt: a szoba, ház nélkül — és ensureUnits sem csinál házat", units.length === 1 && (await ensureUnits(site.id)).length === 1);

  // ── ⑦ „az első szobám” ─────────────────────────────────────────────────
  console.log("\n⑦ „az első szobám”");
  await db.updateTable("site_unit").set({ represents_whole: true, is_whole_property: true, name: "Nádas apartman" }).where("id", "=", roomA.id).execute();
  await post("/admin/units/save", { name: "Szoba B", capacity: "2", back: "rooms", first: "szoba" });
  units = await getUnits(site.id);
  const nadas = units.find((u) => u.id === roomA.id)!;
  const house2 = units.find((u) => u.representsWhole)!;
  check("3 egység: két szoba + a ház", units.length === 3, units.map((u) => u.name));
  check("az eddigi szoba lett (nevét megtartja)", !nadas.representsWhole && !nadas.isWholeProperty && nadas.name === "Nádas apartman", nadas);
  check("a ház KÜLÖN jött létre, alapnévvel, foglalhatóan", !!house2 && house2.id !== roomA.id && house2.name === DEFAULT_UNIT_NAME && house2.isWholeProperty, house2);
  check("…ár nélkül", ((await getSitePrices(site.id)).get(house2.id) ?? []).length === 0);

  // ── ⑧ ensureUnits settles older data ───────────────────────────────────
  console.log("\n⑧ régi adat rendbetétele");
  const roomB = units.find((u) => u.name === "Szoba B")!;
  // the removed picker: a ROOM marked as the whole place, no house
  await db.deleteFrom("site_unit").where("id", "=", house2.id).execute();
  await db.updateTable("site_unit").set({ is_whole_property: true, whole_only: true }).where("id", "=", roomB.id).execute();
  const peekN = (await peekUnits(site.id)).length;
  check("negatív kontroll: peekUnits nem ír", peekN === 2 && (await getUnits(site.id)).length === 2);
  units = await ensureUnits(site.id);
  const picked = units.find((u) => u.id === roomB.id)!;
  check("a régi választóval jelölt szoba lett a ház (csak-egyben megmarad)", picked.representsWhole && picked.isWholeProperty && picked.wholeOnly, picked);
  check("…a másik szoba szoba maradt", units.filter((u) => u.representsWhole).length === 1);
  // hidden house (ADR-0256 „nem adom ki egyben")
  await db.updateTable("site_unit").set({ is_whole_property: false, whole_only: false }).where("id", "=", roomB.id).execute();
  units = await ensureUnits(site.id);
  check("a rejtett ház újra foglalható", units.find((u) => u.id === roomB.id)!.isWholeProperty);
  // two rooms, no house
  await db.updateTable("site_unit").set({ represents_whole: false, is_whole_property: false, whole_only: false }).where("site_id", "=", site.id).execute();
  units = await ensureUnits(site.id);
  check("két szoba, ház nélkül → a ház létrejön", units.length === 3 && units.filter((u) => u.representsWhole && u.isWholeProperty).length === 1, units.map((u) => [u.name, u.representsWhole]));
  const house3 = units.find((u) => u.representsWhole)!;
  await setBasePrice(house3.id, 60000);
  await setBasePrice(nadas.id, 20000);
  await setBasePrice(roomB.id, 25000);

  // ── ⑨ guest page + owner-side sum ──────────────────────────────────────
  console.log("\n⑨ vendég-lap és Árak");
  const snap = await snapshot();
  const u9 = unitsAttr(snap);
  check("a vendég listájában a két szoba, a ház NEM", u9.includes(nadas.id) && u9.includes(roomB.id) && !u9.includes(house3.id), u9);
  html = await get("/admin?tab=modulok&m=pricing");
  check("az Árak lapon a háznak NINCS ár-kártyája, szumma sincs", !html.includes(`id="ar-${house3.id}"`) && !/Tájékoztatásul/.test(html) && html.includes(`id="ar-${nadas.id}"`));
  const markup = snap.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  check("a vendég-lapon NINCS szumma", !/Tájékoztatásul/.test(markup) && !/45[\s  ]000/.test(markup));

  // ── ⑩ in a real browser ────────────────────────────────────────────────
  console.log("\n⑩ böngészőben (390 px, touch)");
  {
    const { chromium } = await import("playwright-core");
    const { config } = await import("../src/config.js");
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(BASE + ROOMS, { waitUntil: "networkidle" });
    check("JS-sel a „Mentés” gomb rejtve (a pipa magától ment)", !(await page.locator("[data-cit-house-save]").isVisible()));
    await Promise.all([page.waitForURL(/haz=csak/), page.locator('[data-cit-house-only] input[name="only"]').check()]);
    check("a pipa magától mentett", (await getUnits(site.id)).find((u) => u.id === house3.id)!.wholeOnly);
    check("…és kimondja", await page.locator(".rs-house__saved").isVisible());
    await page.screenshot({ path: path.join(ROOT, "assets", "Temp", `_whs-${path.basename(ROOT)}-mobile.png`), fullPage: true });
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    // the desktop picture next to the approved plan (design-refs/tenant-admin/whole-house-simple/)
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await dctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
    const dpage = await dctx.newPage();
    await dpage.goto(BASE + ROOMS + "#egesz-haz", { waitUntil: "networkidle" });
    await dpage.screenshot({ path: path.join(ROOT, "assets", "Temp", `_whs-${path.basename(ROOT)}-desktop.png`) });
    await browser.close();
  }
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("availability_day").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
  }
  if (ids.tuId) await db.deleteFrom("tenant_user").where("id", "=", ids.tuId).execute().catch(() => {});
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ WHOLE-HOUSE: ${fail} bukás` : "\n🟢 WHOLE-HOUSE (ADR-0392): a ház külön egység, nem szoba; szobák mellett nem külön ajánlat (ADR-XXXX); egy pipa: csak egyben, ár csak ott");
process.exit(fail ? 1 : 0);
