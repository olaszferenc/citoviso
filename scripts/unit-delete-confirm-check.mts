// Szoba-törlés megerősítéssel + a megmaradt szoba szerepe — ŐR
// (Elek élesi leletei A-1 · A-2 · A-3 · A-4, 2026-10-01; jóváhagyott terv:
//  assets/design-refs/tenant-admin/m1-elek-javitasok/, tulaj 2026-10-02, A-1 = „B").
//
// Mit mér (eldobható fixtúra, valódi DB + valódi HTTP-szerver, a RENDERELT admin-lapon):
//   ① A-1: a törlő gomb SEHOL nem töröl egy kattintásra — a Szobák lapon és a Foglalás
//      lapon is minden `formaction="/admin/units/delete"` egy `<details class="u-delx">`
//      megerősítőben ül; a megerősítő megnevezi a szobát és SZÁMOKKAL mondja, mi vész el
//      (lezárt nap, alapár + időszaki ár, naptár-szinkron, korábbi foglalás);
//   ② A-1 „B": függő (pending) vagy megajánlott (offered) kérésnél a lap MEGÁLLÍT (nincs
//      törlő gomb, a kérés hivatkozása és a vendég neve ott áll), és a szerver is elutasít
//      (deleteUnit + POST) — a szoba és a kérés megmarad;
//   ③ A-2: törlés után a megmaradt ISMERT szobánál az új-szoba űrlap nem kérdez „mi a
//      viszonyuk" kérdést; negatív kontroll: az egészet jelölő egységnél igen;
//   ④ A-3: az időszak „jún. 15. – aug. 31." alakban, nem „06-15 – 08-31";
//   ⑤ A-4: a Foglalások üres sorában nincs „✔" szövegjel, ikon van helyette.
//
// Usage: npx tsx scripts/unit-delete-confirm-check.mts

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
const { setBasePrice, addSeasonPrice } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { createUnit, deleteUnit, getUnits } = await import("../src/tenant/units.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { bookingRef } = await import("../src/booking/requests.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 240)}`}`);
  if (!c) fail++;
};
/** The page with every delete CONFIRMATION cut out — what is left must not delete. */
const outsideConfirm = (html: string): string => html.replace(/<details class="u-delx"[\s\S]*?<\/details>/g, "");
/** One unit's confirmation block. */
const confirmOf = (html: string, unitId: string): string =>
  html.match(new RegExp(`<details class="u-delx" data-u-del="${unitId}"[\\s\\S]*?</details>`))?.[0] ?? "";
const plus = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

try {
  // ── fixture ────────────────────────────────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_udc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_udc lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Törlés-teszt Panzió" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `udc-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `udc_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Törlés-teszt Panzió", intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8360 Keszthely, Teszt u. 1.", email: `u-${stamp}@example.com` } }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `udc_${stamp}`, contact_email: `u-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);

  // Two NAMED rooms (like Muschel after Elek's accidental delete) — neither is the whole place.
  const r1 = (await createUnit(site.id, "Erkélyes kétágyas szoba", 2, null))!;
  const r2 = (await createUnit(site.id, "Családi szoba", 3, null))!;
  await db.updateTable("site_unit").set({ represents_whole: false, is_whole_property: false, whole_only: false }).where("site_id", "=", site.id).execute();
  // r1 carries one of everything the cascade takes.
  await setBasePrice(r1, 18000);
  await addSeasonPrice(r1, "Főszezon", "06-15", "08-31", 28000);
  await db.insertInto("availability_day").values({ unit_id: r1, day: plus(20), state: "blocked", source: "manual" }).execute();
  await db.insertInto("calendar_link").values({ unit_id: r1, direction: "import", provider: "Szallas.hu", url: "https://example.com/ical.ics" }).execute();
  const req = (over: Record<string, unknown>) =>
    db.insertInto("booking_request").values({
      site_id: site.id, unit_id: r1, guest_name: "Teszt Vendég", guest_email: `g-${stamp}@example.com`,
      date_from: plus(40), date_to: plus(42), guests: 2, action_token: `udc-${stamp}-${Math.random().toString(36).slice(2)}`,
      ...over,
    } as never).returning("id").executeTakeFirstOrThrow();
  await req({ status: "declined" });
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
  const BOOKING = "/admin?tab=modulok&m=booking";

  // ── ① A-1: no one-tap delete, the confirmation counts the loss ──────────
  console.log("\n① A-1 · megerősítés, számokkal");
  for (const [where, url] of [["Szobák", ROOMS], ["Foglalás", BOOKING]] as const) {
    const html = await get(url);
    check(`${where}: van törlő gomb (a mérés nem üres lapon fut)`, html.includes('formaction="/admin/units/delete"'));
    check(`${where}: ⭐ minden törlő gomb a megerősítőben ül — egy kattintás nem töröl`,
      !outsideConfirm(html).includes('formaction="/admin/units/delete"'));
    const c1 = confirmOf(html, r1);
    check(`${where}: a megerősítő megnevezi a szobát`, c1.includes("Törli az „Erkélyes kétágyas szoba” szobát?"), c1.slice(0, 200));
    check(`${where}: ⭐ számokkal: 1 lezárt nap`, c1.includes("a naptárából 1 lezárt nap"), c1);
    check(`${where}: ⭐ számokkal: alapár + 1 időszaki ár`, c1.includes("az alapár és 1 időszaki ár"), c1);
    check(`${where}: ⭐ a naptár-szinkron néven`, c1.includes("a naptár-szinkron (Szallas.hu)"), c1);
    check(`${where}: ⭐ 1 korábbi foglalás`, c1.includes("1 korábbi (lezárt) foglalás"), c1);
    check(`${where}: „Mégsem” és „Igen, törlöm”`, c1.includes("Mégsem") && c1.includes("Igen, törlöm"));
    const c2 = confirmOf(html, r2);
    check(`${where}: üres szobánál kimondva, hogy nincs mit elveszíteni`, c2.includes("A szobához nem tartozik lezárt nap, ár vagy foglalás."), c2.slice(0, 300));
  }

  // ── ② A-1 „B": an open request stops the delete — on the page AND on the server ──
  console.log("\n② A-1 „B” · függő kérésnél megállít");
  const pend = await req({ status: "pending", unit_id: r2, guest_name: "Függő Vendég" });
  let html = await get(ROOMS);
  let c2 = confirmOf(html, r2);
  check("a lap megállít: „még nem törölhető”", c2.includes("A „Családi szoba” még nem törölhető"), c2.slice(0, 300));
  check("⭐ a megállító lapon NINCS törlő gomb", !c2.includes('formaction="/admin/units/delete"'));
  check("a kérés hivatkozása és a vendég neve ott áll", c2.includes(bookingRef(pend.id)) && c2.includes("Függő Vendég"), c2);
  check("út a Foglalásokhoz", c2.includes('href="/admin?tab=foglalasok"'));
  const refused = await deleteUnit(site.id, r2);
  check("⭐ deleteUnit elutasít függő kérésnél", refused.ok === false && /döntsön/.test(refused.reason ?? ""), refused);
  const loc = await post("/admin/units/delete", { id: r2, back: "rooms" });
  check("⭐ a POST is elutasít (régi lapról sem kerülhető meg)", loc.includes("hiba="), loc);
  check("a szoba megmaradt", (await getUnits(site.id)).some((u) => u.id === r2));
  check("a kérés megmaradt", Boolean(await db.selectFrom("booking_request").select("id").where("id", "=", pend.id).executeTakeFirst()));
  await db.updateTable("booking_request").set({ status: "offered" }).where("id", "=", pend.id).execute();
  check("⭐ megajánlott (offered) kérésnél is elutasít", (await deleteUnit(site.id, r2)).ok === false);
  html = await get(BOOKING);
  c2 = confirmOf(html, r2);
  check("a Foglalás lapon az ajánlat is megállít, a vendég döntését nevezve", c2.includes("a vendég válaszára"), c2.slice(0, 300));
  await db.updateTable("booking_request").set({ status: "pending" }).where("id", "=", pend.id).execute();

  // the confirmed path still deletes
  const ok = await post("/admin/units/delete", { id: r1, back: "rooms" });
  check("a megerősített törlés lefut (r1)", !ok.includes("hiba=") && !(await getUnits(site.id)).some((u) => u.id === r1), ok);

  // ── ③ A-2: the remaining KNOWN room is not offered as the whole place ──────
  console.log("\n③ A-2 · ismert szoba után nincs „mi a viszonyuk”");
  html = await get(ROOMS);
  check("⭐ az új-szoba űrlap nem kérdezi az egész szállást", !html.includes("<fieldset class=\"rs-wq\" data-cit-whole-q>"));
  check("a „marad az egész szállás” felkínálás sincs", !html.includes("marad az egész szállás"));
  check("helyette egy mondat mondja, hol állítható", html.includes("unit-new__room"));
  await db.updateTable("site_unit").set({ represents_whole: true }).where("id", "=", r2).execute();
  html = await get(ROOMS);
  check("negatív kontroll: az egészet jelölő egységnél a kérdés megjelenik", html.includes("<fieldset class=\"rs-wq\" data-cit-whole-q>"));
  await db.updateTable("site_unit").set({ represents_whole: false }).where("id", "=", r2).execute();

  // ── ④ A-3: the season reads like the picker ──────────────────────────────
  console.log("\n④ A-3 · időszak olvasható alakban");
  await addSeasonPrice(r2, "Főszezon", "06-15", "08-31", 28000);
  html = await get("/admin?tab=modulok&m=pricing");
  check("⭐ „jún. 15. – aug. 31. · minden évben”", html.includes("jún. 15. – aug. 31. · minden évben"), html.match(/[^>]{0,40}minden évben/)?.[0]);
  check("nincs nyers „06-15 – 08-31”", !html.includes("06-15 – 08-31"));

  // ── ⑤ A-4: no dingbat in the empty queue ────────────────────────────────
  console.log("\n⑤ A-4 · ikon, nem szövegjel");
  await db.deleteFrom("booking_request").where("site_id", "=", site.id).execute();
  html = await get("/admin?tab=foglalasok");
  const empty = html.match(/<div class="bk-empty">[\s\S]*?<\/div>/)?.[0] ?? "";
  check("a mérés a valódi üres sort nézi", empty.includes("Most nincs döntésre váró kérés."), empty);
  check("⭐ nincs „✔” szövegjel", !empty.includes("✔"), empty);
  check("SVG-ikon áll helyette", empty.includes("<svg"), empty);
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
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ UNIT-DELETE-CONFIRM: ${fail} bukás` : "\n🟢 UNIT-DELETE-CONFIRM: a szoba-törlés megerősít, nyitott kérésnél megállít; ismert szoba nem lesz „az egész szállás”; időszak és ikon rendben");
process.exit(fail ? 1 : 0);
