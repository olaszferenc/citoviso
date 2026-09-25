// Az „egész szállás” VÁLASZTHATÓ egység — ŐR
// (ADR-XXXX, jóváhagyott terv: assets/design-refs/tenant-admin/whole-property-choice/, „B").
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver, a RENDERELT lapon):
//   ① EGY egységnél a fogalom láthatatlan: nincs kártya, nincs „az egész ház” a rácson,
//      nincs törlés-gomb, de az add-form felteszi a kérdést (kötelező rádió);
//   ② a 2. egység felvétele „nem” válasszal: SENKI nem az egész → a kizárás
//      (`blockingUnitIds`) mindkét egységnél csak önmaga; „igen” → az első az egész;
//   ③ a kártya (POST /admin/units/whole): bekapcsolva + egység → a jelölés ÁTTEHETŐ;
//      kikapcsolva → nincs jelölt, a rács sehol nem ír „az egész ház”-at;
//   ④ az egész szállás TÖRÖLHETŐ (ADR-0114 ⑦ hatályon kívül), utána 1 egység marad és a
//      kártya eltűnik; az utolsó egység törlése elutasítva;
//   ⑤ a tájékoztató szumma az Árak lapon: az egész alatt a szobák alapárának összege,
//      egész nélkül NINCS ilyen sor (a vendég-lapon SOHA — mérve a snapshoton);
//   ⑥ `ensureUnits` nem jelöl vissza: két jelöletlen egység jelöletlen marad;
//   ⑦ negatív kontroll: `peekUnits` sem talál ki egészet.
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
const { setBasePrice } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { ensureUnits, getUnits, peekUnits, deleteUnit, setWholeProperty } = await import("../src/tenant/units.js");
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
    const j = html.indexOf('class="rs-new"', i);
    return i < 0 ? "" : html.slice(i, j < 0 ? undefined : j);
  };
  const wholeOf = async (): Promise<string | null> => (await getUnits(site.id)).find((u) => u.isWholeProperty)?.id ?? null;

  // ── ① one unit: the concept is invisible ──────────────────────────────
  console.log("\n① egy egység");
  const first = (await ensureUnits(site.id))[0]!;
  check("ensureUnits az első (egyetlen) egységet egészként hozza létre", first.isWholeProperty === true);
  let html = await get(ROOMS);
  check("nincs kártya a rács fölött", !html.includes("data-cit-whole-card"));
  check("a rácson nincs „az egész ház”", !/az egész ház/.test(grid(html)));
  check("nincs törlés-gomb (az utolsó egység)", !html.includes('formaction="/admin/units/delete"'));
  check("az add-form felteszi a kérdést", html.includes("data-cit-whole-q"));
  check("a kérdés két KÖTELEZŐ rádió (igen/nem)", /name="whole" value="igen" required/.test(html) && /name="whole" value="nem" required/.test(html));
  check("a kérdés megnevezi az eddigi egységet", html.includes(`Eddig egy egysége volt: <b>${first.name}</b>`));

  // ── ② the second unit ─────────────────────────────────────────────────
  console.log("\n② a második egység felvétele");
  await post("/admin/units/save", { name: "Apartman 2", capacity: "2", back: "rooms", whole: "nem" });
  let units = await getUnits(site.id);
  const second = units.find((u) => u.name === "Apartman 2")!;
  check("2 egység", units.length === 2, units.length);
  check("„nem” → SENKI nem az egész", (await wholeOf()) === null);
  check("„nem” → az első egység csak önmagát zárja", (await blockingUnitIds(first.id)).join() === first.id);
  check("„nem” → a második is csak önmagát", (await blockingUnitIds(second.id)).join() === second.id);
  html = await get(ROOMS);
  check("2 egységnél VAN kártya", html.includes("data-cit-whole-card"));
  check("a kártya kikapcsolva (nincs checked)", !/data-cit-whole-on[^>]*checked|checked[^>]*data-cit-whole-on/.test(html) && !/name="on" value="1" checked/.test(html));
  check("a rácson sehol „az egész ház”", !/az egész ház/.test(grid(html)));
  check("a kérdés már NEM jelenik meg", !html.includes("data-cit-whole-q"));
  check("mindkét egységnek van törlés-gombja", (html.match(/formaction="\/admin\/units\/delete"/g) ?? []).length === 2);
  // „igen” — the same moment, the other answer
  await setWholeProperty(site.id, null);
  await deleteUnit(site.id, second.id);
  await post("/admin/units/save", { name: "Apartman 2", capacity: "2", back: "rooms", whole: "igen" });
  units = await getUnits(site.id);
  const second2 = units.find((u) => u.name === "Apartman 2")!;
  check("„igen” → az ELSŐ egység az egész", (await wholeOf()) === first.id);
  check("„igen” → az első foglalása mindkettőt zárja", (await blockingUnitIds(first.id)).sort().join() === [first.id, second2.id].sort().join());
  check("„igen” → a szoba foglalása az egészet is zárja", (await blockingUnitIds(second2.id)).sort().join() === [first.id, second2.id].sort().join());
  html = await get(ROOMS);
  check("a kártya bekapcsolva", /name="on" value="1" checked/.test(html));
  check("a rácson az első kártyán „az egész ház”", new RegExp(`${first.name}</b><span>[^<]*az egész ház`).test(grid(html)));

  // ── ③ the card moves / clears the flag ────────────────────────────────
  console.log("\n③ a kártya");
  await post("/admin/units/whole", { on: "1", unit: second2.id });
  check("áttéve a másodikra", (await wholeOf()) === second2.id);
  html = await get(ROOMS);
  check("a rácson most a MÁSODIK kártyán áll „az egész ház”", new RegExp(`Apartman 2</b><span>[^<]*az egész ház`).test(grid(html)));
  check("az elsőn már nincs", !new RegExp(`${first.name}</b><span>[^<]*az egész ház`).test(grid(html)));
  await post("/admin/units/whole", { unit: second2.id });
  check("kikapcsolva (nincs `on`) → senki nem az egész", (await wholeOf()) === null);
  html = await get(ROOMS);
  check("a rács sehol nem ír „az egész ház”-at", !/az egész ház/.test(grid(html)));
  const foreign = "00000000-0000-0000-0000-000000000000";
  await post("/admin/units/whole", { on: "1", unit: foreign });
  check("idegen egység-id → nem jelöl", (await wholeOf()) === null);

  // ── ⑤ the informational sum on the pricing screen ─────────────────────
  console.log("\n⑤ tájékoztató szumma az Árak lapon");
  await setWholeProperty(site.id, first.id);
  await setBasePrice(second2.id, 14_500);
  let pr = await get("/admin?tab=modulok&m=pricing");
  check("az egész alatt ott a szumma-sor", pr.includes("data-cit-whole-sum"));
  check("a sor a szobák alapárának összegét írja (14 500)", /data-cit-whole-sum[^>]*>[^<]*14\s?500/.test(pr));
  check("a sor kimondja: az egész ára ettől független", /Az egész szállás ára ettől független/.test(pr));
  check("a szumma-sor CSAK az egész kártyáján van (1 db)", (pr.match(/data-cit-whole-sum/g) ?? []).length === 1);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
  const pub = await readFile(path.join(siteDir, "index.html"), "utf8");
  check("a vendég-lapon NINCS szumma", !/Tájékoztatásul: a szobák külön/.test(pub) && !pub.includes("data-cit-whole-sum"));
  await setWholeProperty(site.id, null);
  pr = await get("/admin?tab=modulok&m=pricing");
  check("egész nélkül nincs szumma-sor", !pr.includes("data-cit-whole-sum"));

  // ── ④ deleting the whole place ────────────────────────────────────────
  console.log("\n④ az egész szállás törölhető");
  await setWholeProperty(site.id, first.id);
  const loc = await post("/admin/units/delete", { id: first.id, back: "rooms" });
  check("a törlés a Szobák lapra tér vissza", loc.includes("m=rooms") && loc.includes("saved=1"), loc);
  units = await getUnits(site.id);
  check("1 egység maradt, és nem az egész", units.length === 1 && !units[0]!.isWholeProperty);
  html = await get(ROOMS);
  check("egy egységnél a kártya eltűnt", !html.includes("data-cit-whole-card"));
  const last = await deleteUnit(site.id, units[0]!.id);
  check("az utolsó egység törlése ELUTASÍTVA", !last.ok && /Legalább egy/.test(last.reason ?? ""));
  const loc2 = await post("/admin/units/delete", { id: units[0]!.id, back: "rooms" });
  check("…és a HTTP-út a hibával a Szobák lapra visz", loc2.includes("m=rooms") && loc2.includes("hiba="), loc2);

  // ── ⑥/⑦ nothing invents a whole place ─────────────────────────────────
  console.log("\n⑥⑦ senki nem talál ki egészet");
  await post("/admin/units/save", { name: "Apartman 3", capacity: "3", back: "rooms", whole: "nem" });
  await setWholeProperty(site.id, null);
  const after = await ensureUnits(site.id);
  check("ensureUnits: két jelöletlen egység jelöletlen marad", after.length === 2 && after.every((u) => !u.isWholeProperty));
  const peek = await peekUnits(site.id);
  check("peekUnits sem jelöl", peek.every((u) => !u.isWholeProperty));
  check("a DB-ben sincs jelölt", (await wholeOf()) === null);
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
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
console.log(fail ? `\n⛔ WHOLE-PROPERTY-CHOICE: ${fail} bukás` : "\n🟢 WHOLE-PROPERTY-CHOICE: az egész szállás választható, törölhető, áttehető; a szumma csak a tulajnak");
process.exit(fail ? 1 : 0);
