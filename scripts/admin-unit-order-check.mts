// AZ ADMIN EGYSÉG-SORRENDJÉNEK ŐRE (ADR-XXXX, tulaj 2026-09-29: „legyen A)").
//
// A mért lelet (Elek FK-013, 2026-09-28): „A szállás egésze” a tulaj MINDEN listájában elöl állt
// (Szobák rács, szoba-felugró, Árak kártyák, Online foglalás naptár-fül) — akkor is, ha nem adja ki
// egyben, és a vendég nem is látja. A tulaj első koppintása és első beírt ára egy olyan egységre
// ment, amit senki nem foglalhat.
//
// Mit köt:
//   ① REJTETT egész (represents_whole ∧ ¬is_whole_property): mind a négy listában a VÉGÉN;
//      a naptár-fülön nincs füle, és egy mondat kimondja, miért nincs naptára;
//   ② EGYBEN IS KIADÓ egész: marad ELÖL, a naptár-fülön is — ez a ① NEGATÍV KONTROLLJA: ugyanaz a
//      próba ELÖL-t mér, tehát a „végén” nem a próba vakságából jön;
//   ③ CSAK EGYBEN kiadó ház (ADR-0257): elöl; a naptár-fülön csak a ház — a bemutató szobáknak nincs
//      naptára, és egy mondat megnevezi őket („a házzal együtt foglalható”); egy régi link egy
//      bemutató szoba naptárára a házat nyitja;
//   ④ csak megjelenítés: a `sort_order` nem változik.
//
// Eldobható fixtúra, valódi DB + valódi HTTP-szerver (a dev-bérlőket nem érinti).
//
//   npx tsx scripts/admin-unit-order-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { ensureUnits, createUnit } = await import("../src/tenant/units.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 240)}`}`);
  if (!c) fail++;
};

/** Unit ids in markup order, read from one attribute pattern (first appearance wins). */
function orderBy(html: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(re)) if (!out.includes(m[1]!)) out.push(m[1]!);
  return out;
}

try {
  // ── fixture ────────────────────────────────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_auo", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_auo lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Sorrend Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `auo-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `auo_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Sorrend Vendégház", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1." } }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `auo_${stamp}`, contact_email: `o-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);

  const whole = (await ensureUnits(site.id))[0]!;
  const roomA = (await createUnit(site.id, "Nádas apartman", 4, null))!;
  const roomB = (await createUnit(site.id, "Kerti stúdió", 2, null))!;
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const COOKIE = `cit_session=${mintTenantCookieValue(tu.id)}`;
  const get = async (p: string): Promise<string> => (await fetch(BASE + p, { headers: { cookie: COOKIE } })).text();

  const setWhole = (isWhole: boolean, only: boolean) =>
    db.updateTable("site_unit").set({ is_whole_property: isWhole, whole_only: only }).where("id", "=", whole.id).execute();

  /** The four admin lists, each as unit ids in the order the owner meets them. */
  const lists = async (): Promise<{ grid: string[]; pops: string[]; prices: string[]; tabs: string[]; booking: string }> => {
    const rooms = await get("/admin?tab=modulok&m=rooms");
    const pricing = await get("/admin?tab=modulok&m=pricing");
    const booking = await get("/admin?tab=modulok&m=booking");
    const tabsHtml = /<div class="unit-tabs"[\s\S]*?<\/div>/.exec(booking)?.[0] ?? "";
    return {
      grid: orderBy(rooms, /data-rs-card="([0-9a-f-]{36})"/g),
      pops: orderBy(rooms, /data-rs-modal="([0-9a-f-]{36})"/g),
      prices: orderBy(pricing, /id="ar-([0-9a-f-]{36})"/g),
      tabs: orderBy(tabsHtml, /[&;]e=([0-9a-f-]{36})/g),
      booking,
    };
  };
  // Optional evidence: AUO_SHOTS=<dir> photographs the lists at 390 px and desktop (not a gate).
  const shots = async (name: string, route: string): Promise<void> => {
    const dir = process.env.AUO_SHOTS;
    if (!dir) return;
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch();
    for (const [label, vp] of [["mobil", { width: 390, height: 844 }], ["asztali", { width: 1280, height: 900 }]] as const) {
      const ctx = await browser.newContext({ viewport: vp, isMobile: label === "mobil", hasTouch: label === "mobil" });
      await ctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.screenshot({ path: path.join(dir, `${name}-${label}.png`), fullPage: false });
      await ctx.close();
    }
    await browser.close();
  };
  const pos = (list: string[], id: string): string =>
    list.indexOf(id) === 0 ? "elöl" : list.indexOf(id) === list.length - 1 ? "a végén" : list.indexOf(id) < 0 ? "nincs" : "középen";

  // ── ① hidden whole place ───────────────────────────────────────────────
  console.log("\n① a nem kiadó (rejtett) egész — a VÉGÉN");
  await setWhole(false, false);
  let l = await lists();
  check("Szobák rács: az egész a végén", pos(l.grid, whole.id) === "a végén" && l.grid.length === 3, l.grid);
  check("Szoba-felugrók: az egész a végén", pos(l.pops, whole.id) === "a végén" && l.pops.length === 3, l.pops);
  check("Árak kártyák: az egész a végén (ha van kártyája)", !l.prices.includes(whole.id) || pos(l.prices, whole.id) === "a végén", l.prices);
  check("…a szobák a tulaj sorrendjében (Nádas, Kerti)", l.grid[0] === roomA && l.grid[1] === roomB, l.grid);
  check("Naptár-fül: az egésznek NINCS füle", !l.tabs.includes(whole.id) && l.tabs.length === 2, l.tabs);
  check("…és egy mondat megmondja, miért nincs naptára", /data-cit-unit-nocal>[^<]*A szállás egésze: nem kiadó egyben, ezért nincs naptára\./.test(l.booking));
  check("…a naptár a szobán nyílik, nem az egészen", new RegExp(`name="unit" value="${roomA}"`).test(l.booking), "nem a Nádas naptára");
  await shots("rejtett-egesz-szobak", "/admin?tab=modulok&m=rooms#szobak");
  await shots("rejtett-egesz-naptar", "/admin?tab=modulok&m=booking");

  // ── ② let as one as well — the negative control ──────────────────────────
  console.log("\n② egyben is kiadó egész — ELÖL (negatív kontroll: ugyanaz a próba)");
  await setWhole(true, false);
  l = await lists();
  check("Szobák rács: az egész elöl", pos(l.grid, whole.id) === "elöl", l.grid);
  check("Szoba-felugrók: az egész elöl", pos(l.pops, whole.id) === "elöl", l.pops);
  check("Árak kártyák: az egész elöl", pos(l.prices, whole.id) === "elöl", l.prices);
  check("Naptár-fül: három fül, az egész elöl", l.tabs.length === 3 && l.tabs[0] === whole.id, l.tabs);
  check("…nincs „nincs naptára” mondat", !/data-cit-unit-nocal/.test(l.booking));

  // ── ③ let ONLY as one ─────────────────────────────────────────────────
  console.log("\n③ csak egyben kiadó ház — elöl, a szobáknak nincs naptára");
  await setWhole(true, true);
  l = await lists();
  check("Szobák rács: a ház elöl", pos(l.grid, whole.id) === "elöl", l.grid);
  check("Szoba-felugrók: a ház elöl", pos(l.pops, whole.id) === "elöl", l.pops);
  check("Árak kártyák: a ház elöl", pos(l.prices, whole.id) === "elöl", l.prices);
  check("Naptár-fül: nincs fülsor (egyetlen foglalható egység)", l.tabs.length === 0, l.tabs);
  check("…a mondat megnevezi a bemutató szobákat", /data-cit-unit-nocal>Nádas apartman, Kerti stúdió: a házzal együtt foglalható, ezért nincs külön naptára\./.test(l.booking));
  check("…a naptár a házé", new RegExp(`name="unit" value="${whole.id}"`).test(l.booking));
  await shots("csak-egyben-naptar", "/admin?tab=modulok&m=booking");
  const old = await get(`/admin?tab=modulok&m=booking&e=${roomA}`);
  check("egy régi link a bemutató szoba naptárára a HÁZAT nyitja", new RegExp(`name="unit" value="${whole.id}"`).test(old) && !new RegExp(`name="unit" value="${roomA}"`).test(old));

  // ── ④ display only ────────────────────────────────────────────────────
  console.log("\n④ csak megjelenítés");
  const so = await db.selectFrom("site_unit").select(["id", "sort_order"]).where("site_id", "=", site.id).orderBy("sort_order").execute();
  check("a sort_order változatlan (egész 0, Nádas 1, Kerti 2)", so.map((r) => r.id).join() === [whole.id, roomA, roomB].join(), so);
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
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
console.log(fail ? `\n⛔ ADMIN-UNIT-ORDER: ${fail} bukás` : "\n🟢 ADMIN-UNIT-ORDER: a nem kiadó egész a lista végén, a naptár csak foglalható egységnek jár");
process.exit(fail ? 1 : 0);
