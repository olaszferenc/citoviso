// Az „egész szállás” VÁLASZTHATÓ egység — ŐR
// (ADR-0232, jóváhagyott terv: assets/design-refs/tenant-admin/whole-property-choice/, „B").
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
//   ⑧ ADR-0256 (terv: design-refs/tenant-admin/whole-property-second-question/, „B”): a „Nem”
//      után a MÁSODIK kérdés — hiányos válasznál a szerver SEMMIT nem ír (három kimondott
//      üzenet); a futó foglalás VALÓDI számmal áll a lapon (0-nál nincs mondat); „rejtse el” →
//      az egység megmarad, a foglalása él, de a vendég nem látja (választó, szoba-kártya),
//      és új kérést sem vesz fel (/api/foglalas 400); a kártyán visszakapcsolva újra látszik;
//      „ez az első szobám” → átnevezve, új slug, látható; + negatív kontroll a predikátumra.
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
const { ensureUnits, getUnits, peekUnits, deleteUnit, setWholeProperty, isGuestVisibleUnit, guestUnits } = await import("../src/tenant/units.js");
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
  check("a kérdés megnevezi az eddigi egységet", html.includes(`Eddig egy szobája volt: <b>${first.name}</b>`));

  // ── ①b the second question in a REAL browser (phone, touch) — ADR-0256 ──
  // The server refuses a half answer (⑧), but the owner should hear it BEFORE sending, in
  // words, and the name field must be a field (the radio rule once sized it 16×16 px).
  console.log("\n①b a második kérdés böngészőben (390 px, touch)");
  {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.addCookies([{ name: "cit_session", value: COOKIE.split("=").slice(1).join("="), url: BASE }]);
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(BASE + ROOMS, { waitUntil: "networkidle" });
    const q2 = page.locator("[data-cit-whole-q2]");
    const err = page.locator("[data-cit-whole-q2-err]");
    const form = page.locator("form.unit-row--new");
    // the add form is collapsed by default (approved plan room-add-B) — open it the owner's way
    await page.locator("details.unit-more > summary").first().click();
    check("alapból a második kérdés rejtett", !(await q2.isVisible()));
    await page.locator('input[name="whole"][value="nem"]').check();
    check("„Nem” → a második kérdés látható (CSS)", await q2.isVisible());
    await form.locator('input[name="name"]').fill("Kisházi szoba");
    await form.locator('input[name="name"]').press("Enter");
    await page.waitForTimeout(300);
    check("válasz nélkül a böngésző NEM küld (a lap marad)", page.url().endsWith(ROOMS), page.url());
    check("…és kimondja, mi hiányzik", (await err.isVisible()) && /Válassza ki, mi legyen az eddigi/.test(await err.innerText()), await err.innerText());
    await page.locator('input[name="first"][value="szoba"]').check();
    // the finished surface, next to the approved picture (design-refs/…/shots/b-mobile-1-err-first.png)
    await page.locator("[data-cit-whole-q]").evaluate((e) => e.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(ROOT, "assets", "Temp", `_wpc-${path.basename(ROOT)}-q2-mobile.png`) });
    const nameBox = await page.locator('input[name="first_name"]').boundingBox();
    check("„Ez az első szobám” → a név-mező MEZŐ méretű (nem 16×16)", (nameBox?.width ?? 0) > 150 && (nameBox?.height ?? 0) > 24, nameBox);
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(300);
    check("név nélkül: „Adjon nevet az első szobájának.”", /Adjon nevet az első szobájának\./.test(await err.innerText()) && page.url().endsWith(ROOMS));
    await page.locator('input[name="first_name"]').fill("kisházi szoba");
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(300);
    check("azonos névvel: „A két szoba neve nem lehet ugyanaz.”", /A két szoba neve nem lehet ugyanaz\./.test(await err.innerText()) && page.url().endsWith(ROOMS));
    await page.locator('input[name="whole"][value="igen"]').check();
    check("„Igen” → a második kérdés újra rejtett", !(await q2.isVisible()));
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await browser.close();
    check("a böngésző-próba nem írt semmit (1 egység)", (await getUnits(site.id)).length === 1);
  }

  // ── ② the second unit ─────────────────────────────────────────────────
  console.log("\n② a második egység felvétele");
  // ADR-0256: „nem” now carries the second answer — here „ez az első szobám”, keeping its
  // name, which is exactly what „nem” meant before (the first unit becomes a plain room).
  await post("/admin/units/save", { name: "Apartman 2", capacity: "2", back: "rooms", whole: "nem", first: "szoba", first_name: first.name });
  let units = await getUnits(site.id);
  const second = units.find((u) => u.name === "Apartman 2")!;
  check("2 egység", units.length === 2, units.length);
  check("„nem” → SENKI nem az egész", (await wholeOf()) === null);
  check("„nem” → az első egység csak önmagát zárja", (await blockingUnitIds(first.id)).join() === first.id);
  check("„nem” → a második is csak önmagát", (await blockingUnitIds(second.id)).join() === second.id);
  html = await get(ROOMS);
  check("2 egységnél VAN kártya", html.includes("data-cit-whole-card"));
  // ADR-XXXX: the card has three states (none / also / only) instead of the old switch.
  check("a kártya „Nem adom ki egyben” állásban", /name="mode" value="none" checked/.test(html) && !/name="mode" value="(also|only)" checked/.test(html));
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
  check("a kártya „Egyben is kiadom” állásban", /name="mode" value="also" checked/.test(html));
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
  await post("/admin/units/save", { name: "Apartman 3", capacity: "3", back: "rooms", whole: "nem", first: "szoba", first_name: "Apartman 2" });
  await setWholeProperty(site.id, null);
  const after = await ensureUnits(site.id);
  check("ensureUnits: két jelöletlen egység jelöletlen marad", after.length === 2 && after.every((u) => !u.isWholeProperty));
  const peek = await peekUnits(site.id);
  check("peekUnits sem jelöl", peek.every((u) => !u.isWholeProperty));
  check("a DB-ben sincs jelölt", (await wholeOf()) === null);

  // ── ⑧ the second question (ADR-0256) ──────────────────────────────────
  console.log("\n⑧ a második kérdés: mi volt az eddigi egység?");
  const fresh = async () => {
    await db.deleteFrom("booking_request").where("site_id", "=", site.id).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", site.id).execute();
    return (await ensureUnits(site.id))[0]!;
  };
  let base = await fresh();
  check("az alapértelmezett egység MAGA A HELY (represents_whole)", base.representsWhole === true && base.isWholeProperty === true);
  html = await get(ROOMS);
  check("a második kérdés a lapon (data-cit-whole-q2)", html.includes("data-cit-whole-q2"));
  check("két második válasz: szoba / rejt", /name="first" value="szoba"/.test(html) && /name="first" value="rejt"/.test(html));
  check("0 futó foglalásnál NINCS foglalás-mondat", !/jövőbeli foglalása van/.test(html));
  const refused = async (body: Record<string, string>, want: RegExp, label: string) => {
    const l = decodeURIComponent(await post("/admin/units/save", { name: "Kisházi szoba", capacity: "2", back: "rooms", whole: "nem", ...body }));
    check(`${label} → a hiba a lapra megy`, l.includes("m=rooms") && want.test(l), l);
    check(`${label} → SEMMI nem íródott (1 egység, érintetlen)`, (await getUnits(site.id)).length === 1 && (await getUnits(site.id))[0]!.name === base.name);
  };
  await refused({}, /Válassza ki, mi legyen az eddigi „A szállás egésze” egységgel\./, "második válasz nélkül");
  await refused({ first: "szoba", first_name: "  " }, /Adjon nevet az első szobájának\./, "„szoba” név nélkül");
  await refused({ first: "szoba", first_name: " kisházi  SZOBA " }, /A két szoba neve nem lehet ugyanaz\./, "„szoba” az új szoba nevével");
  // a running booking on the unit so far — the screen names the REAL count
  const today = new Date();
  const iso = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  await db.insertInto("booking_request").values({ site_id: site.id, unit_id: base.id, guest_name: "_wpc vendég", guest_email: "wpc@example.com", guest_phone: null, date_from: iso(30), date_to: iso(32), message: null, status: "accepted", action_token: `wpc_${stamp}_a`, decided_at: new Date(), seen_at: null, decision_note: null, decided_by: "owner", quoted_total: null, quoted_currency: null, quoted_lines: null, offered_at: null, offer_token: null }).execute();
  html = await get(ROOMS);
  check("1 futó foglalásnál a mondat a VALÓDI számmal", /Ennek az egységnek 1 jövőbeli foglalása van — azok érvényben maradnak, csak új foglalás nem érkezhet rá\./.test(html));
  // „rejtse el” — allowed with a running booking (owner: „ok B”)
  await post("/admin/units/save", { name: "Kisházi szoba", capacity: "2", back: "rooms", whole: "nem", first: "rejt" });
  units = await getUnits(site.id);
  const hidden = units.find((u) => u.id === base.id)!;
  const room = units.find((u) => u.name === "Kisházi szoba")!;
  check("„rejt” → 2 egység, a régi MEGMARADT", units.length === 2 && Boolean(hidden));
  check("„rejt” → a régi a hely, de nem kiadó egyben", hidden.representsWhole && !hidden.isWholeProperty);
  check("„rejt” → a vendég NEM látja (isGuestVisibleUnit)", !isGuestVisibleUnit(hidden) && isGuestVisibleUnit(room));
  check("„rejt” → a futó foglalás érvényben", Boolean(await db.selectFrom("booking_request").select("id").where("unit_id", "=", base.id).where("status", "=", "accepted").executeTakeFirst()));
  check("„rejt” → a szobák függetlenek (senki nem zár senkit)", (await blockingUnitIds(room.id)).join() === room.id);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
  let snap = await readFile(path.join(siteDir, "index.html"), "utf8");
  const unitsAttr = (h: string) => (/data-cit-units="([^"]*)"/.exec(h)?.[1] ?? "").replace(/&quot;/g, '"');
  check("a vendég-lap foglalási választójában NINCS a rejtett egység", !unitsAttr(snap).includes(base.id) && unitsAttr(snap).includes(room.id), unitsAttr(snap));
  // the MARKUP, not the inlined runtime: the runtime carries tr("A szállás egésze") as a label
  const markup = snap.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  check("a vendég-lap markupjában nincs „A szállás egésze” (szoba-kártya, ár-sor)", !/A szállás egésze/.test(markup), [...markup.matchAll(/A szállás egésze/g)].map((m) => markup.slice(Math.max(0, m.index! - 160), m.index! + 40)).join(" ‖ "));
  check("…a látható szoba viszont ott van", markup.includes("Kisházi szoba"));
  const book = await fetch(`${BASE}/t/${slug}/api/foglalas`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ unit: base.id, from: iso(40), to: iso(42), name: "X", email: "x@example.com", phone: "+36301234567", guests: "2" }) });
  check("rejtett egységre ÚJ kérés nem jön (/api/foglalas 400)", book.status === 400, book.status);
  // switched back on the card → the guest sees it again
  await post("/admin/units/whole", { on: "1", unit: base.id });
  check("a kártyán visszakapcsolva újra LÁTHATÓ", isGuestVisibleUnit((await getUnits(site.id)).find((u) => u.id === base.id)!));
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
  snap = await readFile(path.join(siteDir, "index.html"), "utf8");
  check("…és a vendég-lap választójában újra ott van", unitsAttr(snap).includes(base.id));
  check("negatív kontroll: láthatóan a markupban IS ott a neve (a fenti hiány-próba tud pirosat adni)",
    /A szállás egésze/.test(snap.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")));
  // „ez az első szobám” — renamed, re-slugged, visible
  base = await fresh();
  await post("/admin/units/save", { name: "Kisházi szoba", capacity: "2", back: "rooms", whole: "nem", first: "szoba", first_name: "  Nádas   apartman " });
  const renamed = (await getUnits(site.id)).find((u) => u.id === base.id)!;
  check("„szoba” → átnevezve (szóközök normalizálva)", renamed.name === "Nádas apartman", renamed.name);
  check("„szoba” → új slug a névből", renamed.slug === "nadas-apartman", renamed.slug);
  check("„szoba” → nem a hely, nem az egész, LÁTHATÓ", !renamed.representsWhole && !renamed.isWholeProperty && isGuestVisibleUnit(renamed));
  // „igen” — it keeps standing for the place and is let as one
  base = await fresh();
  await post("/admin/units/save", { name: "Kisházi szoba", capacity: "2", back: "rooms", whole: "igen" });
  const kept = (await getUnits(site.id)).find((u) => u.id === base.id)!;
  check("„igen” → a hely, egyben kiadó, látható", kept.representsWhole && kept.isWholeProperty && isGuestVisibleUnit(kept));
  // negative control: the predicate is not a constant, and the fallback never empties
  const U = (r: boolean, w: boolean) => ({ representsWhole: r, isWholeProperty: w });
  check("negatív kontroll: a predikátum mind a négy állapotot megkülönbözteti",
    isGuestVisibleUnit(U(true, true)) && !isGuestVisibleUnit(U(true, false)) && isGuestVisibleUnit(U(false, false)) && isGuestVisibleUnit(U(false, true)));
  check("negatív kontroll: csak rejtett egység → a lista nem ürül ki", guestUnits([U(true, false)]).length === 1 && guestUnits([U(true, false), U(false, false)]).length === 1);
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
console.log(fail ? `\n⛔ WHOLE-PROPERTY-CHOICE: ${fail} bukás` : "\n🟢 WHOLE-PROPERTY-CHOICE: az egész szállás választható, törölhető, áttehető; a szumma csak a tulajnak; a nem kiadó egész a vendég elől rejtve");
process.exit(fail ? 1 : 0);
