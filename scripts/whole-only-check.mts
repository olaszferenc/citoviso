// „CSAK EGYBEN ADOM KI" — a szobák bemutatásra — ŐR
// (ADR-0257, jóváhagyott terv: assets/design-refs/tenant-site/whole-only/, tulaj 2026-09-28:
// „Elfogadom a javaslatokat" — vendég-oldal A, admin X, `site_unit.whole_only`).
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver, a RENDERELT lapon — dev-bérlőt
// NEM renderel újra):
//   ① a 2. szoba felvételekor a kérdés HARMADIK válasza („csak") ott van, és böngészőben
//      (390 px, touch) a választás eltünteti az ár-mezőt, és kimondja, miért nincs;
//   ② „csak" → az eddigi egység az egész ÉS csak egyben kiadó; a felküldött ár NEM tárolódik;
//      a kizárás (`blockingUnitIds`) az ADR-0114 szerint változatlan;
//   ③ a vendég-lap: a foglalási választóban CSAK a ház; a bemutató szoba kártyája ott van
//      (látszik), de ár-sora nincs — akkor sem, ha a szobán régről maradt ár (az ártáblában sem);
//   ④ `/api/foglalas` a bemutató szobára 400, a házra nem „Ismeretlen egység";
//   ⑤ ár-nyaggatás sehol: `priceGapsOf` + `sitePriceGaps` (teendő, heti levél) a szobát
//      kihagyja; az Árak lapon nincs a szobának kártyája, egy mondat mondja meg, miért;
//   ⑥ a Szobák lap: a kártya „Csak egyben adom ki" állásban, a rácson „csak bemutatásra";
//      a 3. szoba felvevő űrlapján nincs ár-mező, és a felküldött ár nem tárolódik;
//   ⑦ a kártyán később átállítható („Egyben is kiadom" → a szoba újra foglalható, van ára,
//      a hiánya újra jelzett) — ez egyben a ③–⑤ NEGATÍV KONTROLLJA (a próbák tudnak pirosat adni);
//   ⑧ a DB-kényszer: whole_only csak az egész egységen lehet igaz.
//
// Usage: npx tsx scripts/whole-only-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, pool } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setBasePrice, getSitePrices } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { ensureUnits, getUnits, isBookableUnit, bookableUnits } = await import("../src/tenant/units.js");
const { blockingUnitIds } = await import("../src/tenant/unitScope.js");
const { priceGapsOf, sitePriceGaps } = await import("../src/tenant/priceGap.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240)}`}`);
  if (!c) fail++;
};

try {
  // ── fixture ────────────────────────────────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_woc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_woc lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Csak-egyben Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `woc-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `woc_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Hársfa Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: `o-${stamp}@example.com` } }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `woc_${stamp}`, contact_email: `o-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
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
  const PRICES = "/admin?tab=modulok&m=pricing";
  const grid = (html: string): string => {
    const i = html.indexOf('class="rs-grid"');
    const j = html.indexOf('class="unit-more"', i);
    return i < 0 ? "" : html.slice(i, j < 0 ? undefined : j);
  };
  const unitsAttr = (h: string) => (/data-cit-units="([^"]*)"/.exec(h)?.[1] ?? "").replace(/&quot;/g, '"');
  const markupOf = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const snapshot = async (): Promise<string> => {
    if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
    return readFile(path.join(siteDir, "index.html"), "utf8");
  };
  const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const book = (unit: string) =>
    fetch(`${BASE}/t/${slug}/api/foglalas`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ unit, from: iso(40), to: iso(42), name: "X", email: "x@example.com", phone: "+36301234567", guests: "2" }) });

  const house = (await ensureUnits(site.id))[0]!;
  await setBasePrice(house.id, 62000);

  // ── ① the third answer, in a real browser ─────────────────────────────
  console.log("\n① a harmadik válasz böngészőben (390 px, touch)");
  let html = await get(ROOMS);
  check("a kérdésben ott a harmadik válasz (csak, kötelező rádió)", /name="whole" value="csak" required/.test(html));
  check("…a szövege: „Csak egyben adom ki — a szobák bemutatásra”", html.includes("Csak egyben adom ki — a szobák bemutatásra"));
  check("az „igen” és a „nem” megmaradt", /name="whole" value="igen" required/.test(html) && /name="whole" value="nem" required/.test(html));
  {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(BASE + ROOMS, { waitUntil: "networkidle" });
    await page.locator("details.unit-more > summary").first().click();
    const form = page.locator("form.unit-row--new").first();
    const price = form.locator('input[name="price"]');
    const note = form.locator("[data-cit-when-csak]");
    check("választás előtt az ár-mező látható", await price.isVisible());
    check("…a „nem kell ár” mondat rejtett", !(await note.isVisible()));
    await form.locator('input[name="whole"][value="csak"]').check();
    check("„csak” → az ár-mező ELTŰNT", !(await price.isVisible()));
    check("„csak” → a „nem adok meg árat” pipa is", !(await form.locator('input[name="price_on_request"]').isVisible()));
    check("„csak” → kimondja, miért nincs ár", (await note.isVisible()) && /árat csak arra kérünk/.test(await note.innerText()));
    await form.locator('input[name="whole"][value="igen"]').check();
    check("„igen” → az ár-mező visszajön (a próba tud pirosat adni)", await price.isVisible());
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await browser.close();
    check("a böngésző-próba nem írt semmit (1 egység)", (await getUnits(site.id)).length === 1);
  }

  // ── ② the answer is stored ────────────────────────────────────────────
  console.log("\n② „csak” → a ház az egyetlen ajánlat");
  await post("/admin/units/save", { name: "Diófa szoba", capacity: "3", back: "rooms", whole: "csak", price: "18000" });
  let units = await getUnits(site.id);
  const room = units.find((u) => u.name === "Diófa szoba")!;
  const h1 = units.find((u) => u.id === house.id)!;
  check("2 egység", units.length === 2, units.length);
  check("a ház: az egész, csak egyben kiadó, maga a hely", h1.isWholeProperty && h1.wholeOnly && h1.representsWhole, h1);
  check("a szoba: nem egész, nem whole_only", !room.isWholeProperty && !room.wholeOnly);
  check("a felküldött ár NEM tárolódott a szobán", ((await getSitePrices(site.id)).get(room.id) ?? []).length === 0);
  check("a szoba nem foglalható, a ház igen", !isBookableUnit(room, units) && isBookableUnit(h1, units));
  check("bookableUnits = csak a ház", bookableUnits(units).map((u) => u.id).join() === house.id);
  check("a kizárás változatlan: a ház mindkettőt zárja", (await blockingUnitIds(house.id)).sort().join() === [house.id, room.id].sort().join());
  check("…és egy (régi) szobafoglalás a házat", (await blockingUnitIds(room.id)).sort().join() === [house.id, room.id].sort().join());

  // ── ③ the guest page ──────────────────────────────────────────────────
  console.log("\n③ a vendég-lap");
  // a price left on the room from before the switch must not surface anywhere
  await setBasePrice(room.id, 17777);
  let snap = await snapshot();
  let markup = markupOf(snap);
  check("a foglalási választóban CSAK a ház", unitsAttr(snap).includes(house.id) && !unitsAttr(snap).includes(room.id), unitsAttr(snap));
  check("a bemutató szoba LÁTSZIK (kártya a markupban)", markup.includes("Diófa szoba"));
  check("a szoba régi ára SEHOL a lapon (kártya, ártábla)", !/17[\s  .]?777/.test(markup));
  check("a ház ára ott van", /62[\s  .]?000/.test(markup));

  // ── ④ the booking API ─────────────────────────────────────────────────
  console.log("\n④ /api/foglalas");
  const rRoom = await book(room.id);
  check("bemutató szobára 400", rRoom.status === 400, rRoom.status);
  const rHouse = await book(house.id);
  const houseBody = await rHouse.text();
  check("a házra NEM „Ismeretlen egység”", !(rHouse.status === 400 && /Ismeretlen egység/.test(houseBody)), `${rHouse.status} ${houseBody}`);
  await db.deleteFrom("booking_request").where("site_id", "=", site.id).execute();

  // ── ⑤ no price nagging ────────────────────────────────────────────────
  console.log("\n⑤ ár-nyaggatás sehol");
  await db.deleteFrom("unit_price").where("unit_id", "=", room.id).execute();
  units = await getUnits(site.id);
  const today = iso(0);
  let gaps = priceGapsOf(units, await getSitePrices(site.id), today);
  check("priceGapsOf: az ár nélküli bemutató szoba NINCS a hiányok közt", !gaps.some((g) => g.unitId === room.id), gaps);
  check("sitePriceGaps (teendő, heti levél): üres", (await sitePriceGaps(site.id, today)).length === 0, await sitePriceGaps(site.id, today));
  html = await get(PRICES);
  check("az Árak lapon nincs a szobának kártyája", !html.includes(`id="ar-${room.id}"`));
  check("…a háznak van", html.includes(`id="ar-${house.id}"`));
  check("…és egy mondat mondja meg, miért", /data-cit-presentation-note/.test(html) && /A házat csak egyben adja ki/.test(html));
  check("a „Hol látják…” doboz nem sorolja a bemutató szobát az „Ár nélkül” esetek közé", !/Ár nélkül:[\s\S]{0,200}Diófa szoba/.test(html));
  check("a felső sor nem kér szobánkénti árat", !/Az árat szobánként adja meg/.test(html));

  // ── ⑥ the rooms screen ────────────────────────────────────────────────
  console.log("\n⑥ a Szobák lap");
  html = await get(ROOMS);
  check("a kártya „Csak egyben adom ki” állásban", /name="mode" value="only" checked/.test(html));
  check("a rácson a szoba: „csak bemutatásra”", /Diófa szoba<\/b><span>[^<]*csak bemutatásra/.test(grid(html)));
  check("a rácson a ház: „csak egyben kiadó”", new RegExp(`${h1.name}</b><span>[^<]*csak egyben kiadó`).test(grid(html)));
  check("a 3. szoba űrlapján nincs ár-mező és nincs „nem adok meg árat”", !/name="price"/.test(html) && !/name="price_on_request"/.test(html));
  check("…helyette a mondat", /data-cit-new-noprice/.test(html));
  await post("/admin/units/save", { name: "Tetőtéri szoba", capacity: "2", back: "rooms", price: "15000" });
  units = await getUnits(site.id);
  const room3 = units.find((u) => u.name === "Tetőtéri szoba")!;
  check("a 3. szoba is bemutató, a felküldött ára nem tárolódott", !isBookableUnit(room3, units) && ((await getSitePrices(site.id)).get(room3.id) ?? []).length === 0);

  // the finished surface, next to the approved picture (design-refs/tenant-site/whole-only/shots/admin-X-*)
  {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: config.chromiumPath });
    for (const [tag, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 900 }]] as const) {
      const ctx = await browser.newContext({ viewport: vp, ...(tag === "mobile" ? { hasTouch: true, isMobile: true } : {}) });
      await ctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
      const page = await ctx.newPage();
      for (const [name, p] of [["rooms", ROOMS], ["prices", PRICES]] as const) {
        await page.goto(BASE + p, { waitUntil: "networkidle" });
        if (name === "rooms") await page.locator("details.unit-more > summary").first().click();
        await page.screenshot({ path: path.join(ROOT, "assets", "Temp", `_woc-${path.basename(ROOT)}-${name}-${tag}.png`), fullPage: true });
      }
      await ctx.close();
    }
    await browser.close();
  }

  // ── ⑦ switched on the card; negative control ──────────────────────────
  console.log("\n⑦ a kártyán átállítva „Egyben is kiadom” — negatív kontroll");
  await post("/admin/units/whole", { mode: "also", unit: house.id });
  units = await getUnits(site.id);
  const h2 = units.find((u) => u.id === house.id)!;
  check("a ház egész marad, de már nem csak egyben", h2.isWholeProperty && !h2.wholeOnly);
  check("a szobák újra foglalhatók", isBookableUnit(room, units) && isBookableUnit(room3, units));
  gaps = priceGapsOf(units, await getSitePrices(site.id), today);
  check("negatív kontroll: a szoba ár-hiánya MOST jelzett", gaps.some((g) => g.unitId === room.id), gaps);
  await setBasePrice(room.id, 17777);
  snap = await snapshot();
  markup = markupOf(snap);
  check("negatív kontroll: a szoba a választóban", unitsAttr(snap).includes(room.id));
  check("negatív kontroll: a szoba ára a lapon", /17[\s  .]?777/.test(markup));
  html = await get(PRICES);
  check("negatív kontroll: az Árak lapon a szobának kártyája", html.includes(`id="ar-${room.id}"`) && !/data-cit-presentation-note/.test(html));
  await db.deleteFrom("unit_price").where("unit_id", "=", room.id).execute();
  await snapshot();
  html = await get(PRICES);
  check("negatív kontroll: ár nélküli FOGLALHATÓ szobát a doboz „Ár nélkül”-ként sorol", /Ár nélkül:[\s\S]{0,200}Diófa szoba/.test(html));
  await setBasePrice(room.id, 17777);
  const rRoom2 = await book(room.id);
  check("negatív kontroll: a szobára nem „Ismeretlen egység”", !(rRoom2.status === 400 && /Ismeretlen egység/.test(await rRoom2.text())));
  await db.deleteFrom("booking_request").where("site_id", "=", site.id).execute();
  // back to only, then off
  await post("/admin/units/whole", { mode: "only", unit: house.id });
  check("vissza „csak egyben”", (await getUnits(site.id)).find((u) => u.id === house.id)!.wholeOnly);
  await post("/admin/units/whole", { mode: "none", unit: house.id });
  units = await getUnits(site.id);
  check("„Nem adom ki egyben” → se egész, se whole_only", units.every((u) => !u.isWholeProperty && !u.wholeOnly));
  // an older form (the `on` switch) still means "also"
  await post("/admin/units/whole", { on: "1", unit: house.id });
  const h3 = (await getUnits(site.id)).find((u) => u.id === house.id)!;
  check("a régi űrlap (`on`) → „Egyben is kiadom”", h3.isWholeProperty && !h3.wholeOnly);

  // ── ⑧ the DB constraint ───────────────────────────────────────────────
  console.log("\n⑧ a DB-kényszer");
  let refused = false;
  try {
    await db.updateTable("site_unit").set({ whole_only: true }).where("id", "=", room.id).execute();
  } catch {
    refused = true;
  }
  check("whole_only egy nem-egész egységen ELUTASÍTVA (CHECK)", refused);
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("unit_price").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
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
console.log(fail ? `\n⛔ WHOLE-ONLY: ${fail} bukás` : "\n🟢 WHOLE-ONLY: csak egyben kiadó ház — a szobák látszanak, de nem foglalhatók és árat sem kérünk tőlük");
process.exit(fail ? 1 : 0);
