// ADR-0429 — the setup walk, end to end, against the approved plan
// (assets/design-refs/tenant-admin/modul-statusz/README): real server, real dev DB fixtures,
// real browser. What it measures (each a README binding):
//   · the first login (`elso=1`) opens the walk; „Később folytatom” leaves it
//   · "Hogyan adja ki?" → szobánként: the rooms are CREATED (and the house stays, ADR-0392);
//     capacity and price repeat per room; a bad price is refused with a message
//   · back within a topic, back ACROSS topics (to the previous topic's LAST question, prefilled)
//   · jump to a done topic from the topic list; a letting switch reopens the dependants per unit
//     (rooms → whole → whole_only)
//   · "Most kihagyom" on an optional topic; "Kihagyom" moves a topic to the end
//   · the module tiles count per unit ("1/3 szobának van ára"); the overview strip owns the
//     module to-dos; the module page embeds its topic's question; a page the walk opened leads back
//   · a missing module → the EXISTING cart with every held module kept; after payment the walk
//     continues at the very step it left
//   · both sizes in a browser, 0 JS errors
// Run: npx tsx scripts/setup-wizard-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.ANTHROPIC_API_KEY = "";

import { once } from "node:events";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
// Worktree-unique scratch (guard-scratch-scope-check): a parallel run never touches another tree's pictures.
const SCOPE = path.basename(ROOT);
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
const siteDirs: string[] = [];
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 400)}`);
  }
};

try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_swc", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");

  async function makeTenant(tag: string, modules: string[]): Promise<{ tenantId: string; siteId: string; tuId: string }> {
    const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `_swc ${tag}`, raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
    ids[`lead_${tag}`] = lead.id;
    const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `Varázsló ${tag} (teszt)` }).returning("id").executeTakeFirstOrThrow();
    ids[`tenant_${tag}`] = tenant.id;
    const slug = `swc-${tag}-${stamp}`;
    const site = await db.insertInto("site").values({
      tenant_id: tenant.id, preview_token: `swc_${tag}_${stamp}`, slug, status: "live", live_at: new Date(),
      path: `sites/${slug}/index.html`, source_artifact_id: art!.id,
      edited_site_data: JSON.stringify({ name: `Varázsló ${tag}`, intro: "Teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: `o-${tag}-${stamp}@example.com` }, businessType: "accommodation" }),
    }).returning("id").executeTakeFirstOrThrow();
    ids[`site_${tag}`] = site.id;
    siteDirs.push(path.join(ROOT, "sites", slug));
    const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `swc_${tag}_${stamp}`, contact_email: `o-${tag}-${stamp}@example.com`, password_hash: null }).returning("id").executeTakeFirstOrThrow();
    ids[`tu_${tag}`] = tu.id;
    await setTenantModules(tenant.id, modules);
    if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
    return { tenantId: tenant.id, siteId: site.id, tuId: tu.id };
  }
  const FULL = await makeTenant("full", ["rooms", "pricing", "booking", "hours", "amenities", "gallery", "location", "usp", "reviews"]);
  const ALAP = await makeTenant("alap", ["gallery", "location"]);

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cookieOf = (tu: string): string => `cit_session=${mintTenantCookieValue(tu)}`;
  const get = async (tu: string, p: string): Promise<{ status: number; loc: string; html: string }> => {
    const r = await fetch(BASE + p, { headers: { cookie: cookieOf(tu) }, redirect: "manual" });
    return { status: r.status, loc: r.headers.get("location") ?? "", html: r.status === 200 ? await r.text() : "" };
  };
  const post = async (tu: string, fields: Record<string, string | string[]>): Promise<{ status: number; loc: string; html: string }> => {
    const b = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) b.append(k, x);
    const r = await fetch(BASE + "/admin/beallitas", { method: "POST", headers: { cookie: cookieOf(tu), "Content-Type": "application/x-www-form-urlencoded" }, body: b, redirect: "manual" });
    return { status: r.status, loc: r.headers.get("location") ?? "", html: r.status === 200 ? await r.text() : "" };
  };
  const units = async (siteId: string) =>
    db.selectFrom("site_unit").select(["id", "name", "capacity", "represents_whole", "whole_only", "price_on_request"]).where("site_id", "=", siteId).orderBy("sort_order").execute();
  const page = (html: string): string => html.replace(/\s+/g, " ");

  console.log("── első belépés, szobánként kiadás (teljes csomag)");
  const first = await get(FULL.tuId, "/admin?elso=1");
  check("az első belépés (elso=1) a varázslóba visz", first.status === 302 && first.loc === "/admin/beallitas", first);
  let w = await get(FULL.tuId, "/admin/beallitas");
  check("az első téma a „Hogyan adja ki?”, három válasszal", /Hogyan adja ki a szállást\?/.test(w.html) && /Egyben adom ki, de a szobákat bemutatnám/.test(w.html));
  check("az első téma első kérdésén nincs Vissza", !/name="act" value="back"/.test(w.html));
  const again = await get(FULL.tuId, "/admin?elso=1");
  check("a varázsló egyszer nyílik magától (látta → az admin jön)", again.status === 200, again.status);

  let r = await post(FULL.tuId, { t: "letting", s: "0", act: "next", mode: "rooms" });
  check("szobánként → a szobák száma jön (Szobák modul megvan, nincs modul-lépés)", /s=1/.test(r.loc), r.loc);
  r = await post(FULL.tuId, { t: "letting", s: "1", act: "next", n: "3" });
  w = await get(FULL.tuId, r.loc);
  check("3 név-mező", (w.html.match(/name="name\d"/g) ?? []).length === 3);
  r = await post(FULL.tuId, { t: "letting", s: "2", act: "next", name0: "Deluxe", name1: "", name2: "Családi" });
  check("üres szobanév nem mehet", /e=/.test(r.loc) && decodeURIComponent(r.loc).includes("Minden szobának adjon nevet"), r.loc);
  r = await post(FULL.tuId, { t: "letting", s: "2", act: "next", name0: "Deluxe", name1: "Háromágyas", name2: "Családi" });
  let us = await units(FULL.siteId);
  check("a szobák LÉTREJÖTTEK, mellettük az egész ház (ADR-0392)", us.filter((u) => !u.represents_whole).map((u) => u.name).join(",") === "Deluxe,Háromágyas,Családi" && us.some((u) => u.represents_whole), us);
  w = await get(FULL.tuId, r.loc.startsWith("/admin/beallitas") ? r.loc : "/admin/beallitas");
  check("utána a Férőhely jön, szobánként (Deluxe)", /Hány fő fér el: Deluxe\?/.test(w.html));
  check("a téma első kérdésén „Vissza: Hogyan adja ki?”", /Vissza: Hogyan adja ki\?/.test(w.html));

  console.log("── vissza témák között, előtöltve");
  r = await post(FULL.tuId, { t: "capacity", s: "0", act: "back" });
  check("a vissza az előző téma UTOLSÓ kérdésére visz", /t=letting/.test(r.loc) && /s=2/.test(r.loc), r.loc);
  w = await get(FULL.tuId, r.loc);
  check("a mentett szobanevek előtöltve", /value="Háromágyas"/.test(w.html));
  r = await post(FULL.tuId, { t: "letting", s: "2", act: "back" });
  check("témán belül vissza az előző kérdésre", /t=letting/.test(r.loc) && /s=1/.test(r.loc), r.loc);

  console.log("── férőhely és ár szobánként");
  const roomIds = (await units(FULL.siteId)).filter((u) => !u.represents_whole);
  for (let i = 0; i < roomIds.length; i++) await post(FULL.tuId, { t: "capacity", s: String(i), act: "next", cap: String(2 + i) });
  us = await units(FULL.siteId);
  check("mindhárom szoba férőhelye mentve", us.filter((u) => !u.represents_whole).every((u, i) => u.capacity === 2 + i), us);
  r = await post(FULL.tuId, { t: "pricing", s: "0", act: "next", amount: "22e" });
  check("rossz ár („22e”) hibaüzenettel visszajön", decodeURIComponent(r.loc).includes("Csak számot írjon"), r.loc);
  r = await post(FULL.tuId, { t: "pricing", s: "0", act: "next", amount: "24 000 Ft" });
  check("jó ár → a következő szoba ára", /t=pricing/.test(r.loc) && /s=1/.test(r.loc), r.loc);
  const tiles = page((await get(FULL.tuId, "/admin?tab=modulok")).html);
  check("a csempe egységenként számol: „1/3 szobának van ára”", tiles.includes("1/3 szobának van ára"));
  check("csempék két csoportban", tiles.includes("Ami a foglaláshoz kell") && tiles.includes("Az oldal többi része"));
  check("a naptár zárolt, amíg az ár nincs kész (Előbb az árak)", /data-setup-tile="calendar"[^>]*>[\s\S]{0,600}Előbb az árak/.test(tiles));
  await post(FULL.tuId, { t: "pricing", s: "1", act: "next", amount: "20000" });
  await post(FULL.tuId, { t: "pricing", s: "2", act: "next", por: "1" });
  r = await post(FULL.tuId, { t: "pricing", s: "3", act: "next", min: "2" });
  const prices = await db.selectFrom("unit_price").innerJoin("site_unit", "site_unit.id", "unit_price.unit_id").select(["unit_price.amount"]).where("site_unit.site_id", "=", FULL.siteId).execute();
  us = await units(FULL.siteId);
  check("két szobának ára, a harmadik „ár kérésre” (setBasePrice / setUnitPriceOnRequest)", prices.length === 2 && us.filter((u) => u.price_on_request).length === 1, { prices, us });

  console.log("── ugrás kész témára, módváltás, függők újranyílnak");
  w = await get(FULL.tuId, "/admin/beallitas?t=letting");
  check("kész témára ugrás: a mentett válasz előtöltve (szobánként)", /value="rooms" checked/.test(w.html));
  r = await post(FULL.tuId, { t: "letting", s: "0", act: "next", mode: "whole" });
  us = await units(FULL.siteId);
  check("egészben → a szobák törölve, egy egység marad", us.length === 1, us);
  w = await get(FULL.tuId, "/admin/beallitas");
  check("a férőhely újra nyílik — most a házra", /Hány fő fér el: A szállás egésze\?|Hány fő fér el:/.test(w.html));
  await post(FULL.tuId, { t: "letting", s: "0", act: "next", mode: "wholeOnly" });
  await post(FULL.tuId, { t: "letting", s: "1", act: "next", n: "2" });
  await post(FULL.tuId, { t: "letting", s: "2", act: "next", name0: "Kék szoba", name1: "Zöld szoba" });
  us = await units(FULL.siteId);
  check("egyben + bemutató szobák: whole_only a házon (ADR-0257)", us.some((u) => u.represents_whole && u.whole_only) && us.filter((u) => !u.represents_whole).length === 2, us);
  w = await get(FULL.tuId, "/admin/beallitas?t=capacity");
  check("whole_only: a férőhely csak a házra kérdez", (w.html.match(/Hány fő fér el:/g) ?? []).length === 1 && /1\. kérdés \/ 1/.test(w.html));

  console.log("── kihagyás, nem kötelező téma");
  w = await get(FULL.tuId, "/admin/beallitas?t=usp");
  check("nem kötelező téma: „Nem kötelező” + „Most kihagyom”", /Nem kötelező/.test(w.html) && /Most kihagyom/.test(w.html));
  r = await post(FULL.tuId, { t: "usp", act: "skip" });
  check("kihagyva — nem kötelező", decodeURIComponent(r.loc).includes("Kihagyva (nem kötelező)"), r.loc);

  console.log("── Áttekintés, modul-lap, visszatérő sáv");
  const ov = page((await get(FULL.tuId, "/admin")).html);
  check("az Áttekintésen a beállítás-sáv", ov.includes("data-setup-band") && /Beállítás: \d+ \/ \d+ téma kész/.test(ov));
  check("a Teendők nem viszi a modul-tételt (bemutatkozó szöveg a sávé)", !ov.includes("Írja meg a bemutatkozó szöveget"));
  const hours = page((await get(FULL.tuId, "/admin?tab=modulok&m=hours")).html);
  check("a modul lapja beágyazza a téma kérdését", hours.includes('data-setup-panel="hours"') && hours.includes("Mikor érkezhet"));
  const hoursSave = await post(FULL.tuId, { t: "hours", s: "0", act: "next", from: "hours" });
  check("a panelről mentés hibaüzenettel a modul lapjára tér vissza (érkezés nélkül)", hoursSave.loc.startsWith("/admin?tab=modulok&m=hours"), hoursSave.loc);
  const ret = page((await get(FULL.tuId, "/admin?tab=modulok&m=reviews&vissza=varazslo&vt=reviews")).html);
  check("a varázslóból nyitott lapon: „Kész — vissza a beállításhoz”", ret.includes("data-setup-return") && ret.includes("Kész — vissza a beállításhoz"));

  console.log("── hiányzó modul → kosár → fizetés után ugyanott");
  await get(ALAP.tuId, "/admin/beallitas");
  r = await post(ALAP.tuId, { t: "letting", s: "0", act: "next", mode: "rooms" });
  w = await get(ALAP.tuId, r.loc);
  check("„Alap” csomag: „Ehhez a Szobák modul kell” + ár", /Ehhez a .* modul kell/.test(w.html) && /Ft\/hó/.test(w.html));
  r = await post(ALAP.tuId, { t: "letting", s: "1", act: "next" });
  check("választás nélkül nem lép tovább", decodeURIComponent(r.loc).includes("Válasszon"), r.loc);
  const cart = await post(ALAP.tuId, { t: "letting", s: "1", act: "next", choice: "buy" });
  const keep = [...cart.html.matchAll(/name="module" value="([a-z]+)"/g)].map((m) => m[1]);
  check("a kosár a MEGLÉVŐ /admin/modules űrlap", cart.status === 200 && cart.html.includes('action="/admin/modules"'));
  check("a kosár a meglévő modulokat is küldi (nincs véletlen lemondás) + a Szobák", ["gallery", "location", "rooms"].every((m) => keep.includes(m)), keep);
  await setTenantModules(ALAP.tenantId, ["gallery", "location", "rooms"]); // the payment, as the webhook would activate it
  const back = await get(ALAP.tuId, "/admin?tab=modulok&applied=1&mcharged=rooms");
  check("fizetés után a varázsló ugyanazon a lépésen folytatja", back.status === 302 && /t=letting/.test(back.loc) && /s=1/.test(back.loc), back);
  w = await get(ALAP.tuId, back.loc);
  check("„Megrendelve és kifizetve”", /Megrendelve és kifizetve/.test(w.html));

  console.log("── emlékeztetők (ADR-0417 + heti) a nyilvántartásból");
  const { buildLoginReminderSmsText, buildLoginReminderEmail } = await import("../src/email/loginEmail.js");
  const { smsEncoding } = await import("../src/sms/encoding.js");
  const url = "https://citoviso.com/login/jelszo/" + "x".repeat(43);
  const sms = buildLoginReminderSmsText({ siteName: "Marilyn Vendégház", daysLeft: 11, setPasswordUrl: url, missing: ["Hogyan adja ki?", "Árak", "Naptár-összekötés"], lang: "hu" });
  check("belépés-emlékeztető SMS: megnevezi a hiányt, GSM-7, ≤ 2 szelet", /Meg hianyzik: Hogyan adja ki\?, Arak \+1/.test(sms) && smsEncoding(sms).segments <= 2, sms);
  const longSms = buildLoginReminderSmsText({ siteName: "A Nagyon Hosszú Nevű Balatoni Családi Vendégház és Apartmanház", daysLeft: 11, setPasswordUrl: url, missing: ["Egy nagyon hosszú témanév ami nem fér el", "Még egy hosszú témanév"], lang: "hu" });
  check("ha nem férne 2 szeletbe, a lista nélküli SMS megy", !/hianyzik/.test(longSms) && smsEncoding(longSms).segments <= 2, longSms);
  const mail = buildLoginReminderEmail({ to: "a@b.hu", username: "u", setPasswordUrl: url, loginUrl: "https://x/login", siteName: "Marilyn Vendégház", contactName: null, daysLeft: 11, trialUntilIso: "2026-11-16", helpPhone: null, missing: ["Árak", "Férőhely"], lang: "hu" });
  check("belépés-emlékeztető e-mail: a hiánylista + végigvezetés", mail.text.includes("még ez hiányzik") && mail.text.includes("• Árak") && mail.text.includes("végigvezetjük"));
  const { maintainSetupReminders } = await import("../src/tenant/setupReminder.js");
  const t0 = new Date();
  let rr = await maintainSetupReminders(t0, { onlySiteId: FULL.siteId });
  check("heti emlékeztető: belépés előtt nem indul (az ADR-0417 beszél)", rr.started === 0 && rr.reminded === 0, rr);
  await db.updateTable("tenant_user").set({ last_login_at: t0 }).where("id", "=", FULL.tuId).execute();
  rr = await maintainSetupReminders(t0, { onlySiteId: FULL.siteId });
  check("belépés után a nyitott témákkal epizód indul", rr.started === 1, rr);
  rr = await maintainSetupReminders(new Date(t0.getTime() + 3 * 86_400_000), { onlySiteId: FULL.siteId });
  check("7 napon belül nincs levél", rr.reminded === 0, rr);
  rr = await maintainSetupReminders(new Date(t0.getTime() + 8 * 86_400_000), { onlySiteId: FULL.siteId });
  check("7 nap után EGY levél", rr.reminded === 1, rr);
  rr = await maintainSetupReminders(new Date(t0.getTime() + 9 * 86_400_000), { onlySiteId: FULL.siteId });
  check("a következő csak egy hét múlva", rr.reminded === 0, rr);
  await db.updateTable("lead").set({ contact_block_at: t0 }).where("id", "=", ids.lead_full!).execute();
  rr = await maintainSetupReminders(new Date(t0.getTime() + 20 * 86_400_000), { onlySiteId: FULL.siteId });
  check("„ne keressük” jel → nincs levél, az epizód lezárul (ADR-0421)", rr.reminded === 0 && rr.ended === 1, rr);

  console.log("── böngésző, mindkét méret");
  const shotDir = path.join(ROOT, "assets", "Temp", SCOPE, "setup-wizard-check");
  await mkdir(shotDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [size, vp] of [["mobile", { width: 390, height: 860 }], ["desktop", { width: 1280, height: 900 }]] as const) {
      const ctx = await browser.newContext({ viewport: vp });
      await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(FULL.tuId), url: BASE }]);
      const p = await ctx.newPage();
      const errs: string[] = [];
      p.on("pageerror", (e) => errs.push(e.message));
      p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      await p.goto(BASE + "/admin/beallitas?t=letting");
      // A real visitor answers the cookie banner first; the walk keeps room for it below.
      if (await p.locator(".cit-consent__no, [data-c=need]").first().isVisible().catch(() => false)) await p.locator(".cit-consent__no, [data-c=need]").first().click();
      else if (await p.locator(".cit-consent__yes").isVisible().catch(() => false)) await p.click(".cit-consent__yes");
      await p.screenshot({ path: path.join(shotDir, `varazslo-${size}.png`), fullPage: true });
      if (size === "mobile") {
        await p.click(".sw-prog summary");
        check("mobil: a „Témák” lista lenyílik, és kész témára lehet ugrani", await p.locator(".sw-rail--m a").count() > 0);
      } else {
        check("asztali: a témasor látszik, kész téma kattintható", await p.locator("nav.sw-rail a").count() > 0);
      }
      await p.check("input[name=mode][value=rooms]");
      await p.click("button[name=act][value=next]");
      await p.waitForLoadState("load");
      check(`${size}: a gomb a következő kérdésre visz`, /Hány szobát ad ki\?/.test(await p.content()));
      await p.click("button[name=act][value=back]");
      await p.waitForLoadState("load");
      check(`${size}: a Vissza gomb visszavisz`, /Hogyan adja ki a szállást\?/.test(await p.content()));
      await p.goto(BASE + "/admin?tab=modulok");
      await p.screenshot({ path: path.join(shotDir, `csempek-${size}.png`), fullPage: true });
      await p.goto(BASE + "/admin");
      await p.screenshot({ path: path.join(shotDir, `attekintes-${size}.png`), fullPage: true });
      check(`${size}: 0 JS-hiba`, errs.length === 0, errs);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`  képek: ${path.relative(ROOT, shotDir)}`);
} finally {
  if (server?.listening) server.close();
  for (const d of siteDirs) await rm(d, { recursive: true, force: true }).catch(() => {});
  for (const tag of ["full", "alap"]) {
    if (ids[`tu_${tag}`]) await db.deleteFrom("tenant_user").where("id", "=", ids[`tu_${tag}`]!).execute().catch(() => {});
    if (ids[`site_${tag}`]) await db.deleteFrom("site").where("id", "=", ids[`site_${tag}`]!).execute().catch(() => {});
    if (ids[`tenant_${tag}`]) {
      await db.deleteFrom("tenant_message").where("tenant_id", "=", ids[`tenant_${tag}`]!).execute().catch(() => {});
      await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids[`tenant_${tag}`]!).execute().catch(() => {});
      await db.deleteFrom("tenant").where("id", "=", ids[`tenant_${tag}`]!).execute().catch(() => {});
    }
    if (ids[`lead_${tag}`]) await db.deleteFrom("lead").where("id", "=", ids[`lead_${tag}`]!).execute().catch(() => {});
  }
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ SETUP-WIZARD: ${fail} bukás` : "\n🟢 SETUP-WIZARD: a varázsló a terv szerint vezet, a meglévő írásokon át ment, visszalép, ugrik, kosárba visz és ott folytatja");
process.exit(fail ? 1 : 0);
