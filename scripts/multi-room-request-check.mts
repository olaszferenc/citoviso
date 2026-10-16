// ⛔⛔ TÖBB SZOBA EGY FOGLALÁSI KÉRÉSBEN — kontraktus: assets/design-refs/tenant-site/multi-room/
// (tulajdonosi jóváhagyás 2026-10-16, „B” — előbb a dátum, aztán a szabad szobák; ADR-XXXX).
//
// A MÉRT LELET, amiért létezik (tulaj, 2026-10-16): egy foglalási kérés EGY egységre szólt — a
// vendég-űrlapon egy <select> —, ezért aki két szobát akart, két kérést küldött, és az „egész ház”
// külön, saját árú tételként állt a szobák mellett. A tulaj szavával: „ez így szerintem fos”.
//
// Mit köt (a README ①–⑧), valódi DB + valódi HTTP-szerver + valódi böngésző (390 touch + 1280):
//   ① szobánként kiadó szálláson az egész ház NEM ajánlat (a widget listájában nincs, a POST elutasítja);
//   ② a naptár csak azt az éjt zárja, amikor EGYIK szoba sem szabad;
//   ③ a dátum után a szobák listája: a szabad pipálható, a foglalt szürke, kimondva „Erre az időszakra foglalt”;
//   ④ az ár szobánként tételes, az összeg a szobák összege; a létszám-plafon a férőhelyek összege;
//   ⑤ egy kérés megy el, benne minden pipált szoba (unit_ids), a nyugta „Szobák” sorral;
//   ⑥ a visszaigazolás egyben: minden szoba lezár; az ütköző függő kérés automatikusan elutasítva;
//   ⑦ a lemondás minden szobát felszabadít;
//   ⑧ több szobás árajánlat: a tulaj egy éjszakai árat ad a szobákra együtt, árlistába nem kerül.
//
// A `--selftest` a KIRENDERELT pillanatképben kikapcsolja a több szobás módot (a régi egy-egységes
// út fut), és ugyanazokat az állításokat futtatja — PIROSNAK KELL LENNIE.
//
//   npx tsx scripts/multi-room-request-check.mts
//   npx tsx scripts/multi-room-request-check.mts --selftest   ← PIROSNAK KELL LENNIE

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
// No real mail leaves a guard: owner/guest mails go to the mock provider.
process.env.EMAIL_PROVIDER = "mock";

const SELFTEST = process.argv.includes("--selftest");

import { once } from "node:events";
import { rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const { db, pool } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { setBasePrice, getUnitPrices } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { createBookingRequest, decideRequest, cancelRequest, sendOffer, loadOfferView } = await import("../src/booking/requests.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown) =>
  c ? console.log(`  ✓ ${n}`) : (fail++, console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d)}`));
const iso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_mr", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_mr lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_mr tenant" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `mr-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `mr_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Több Szoba Teszt", intro: "Három szoba, egy ház.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: "owner@example.com" }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  // The ADR-0392 shape: the house as its own (priced!) unit beside three priced rooms.
  const house = await db.insertInto("site_unit").values({ site_id: site.id, name: "Az egész ház", sort_order: 0, is_whole_property: true, represents_whole: true }).returning("id").executeTakeFirstOrThrow();
  const nadas = await db.insertInto("site_unit").values({ site_id: site.id, name: "Nádas apartman", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const kis = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kisházi szoba", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  const kerti = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kerti stúdió", capacity: 3, sort_order: 3 }).returning("id").executeTakeFirstOrThrow();
  await setBasePrice(house.id, 90_000);
  await setBasePrice(nadas.id, 24_000);
  await setBasePrice(kis.id, 16_000);
  await setBasePrice(kerti.id, 19_000);
  // The Nádas is taken on days 30–31 (a portal booking, say): the guest's calendar must stay open.
  for (const d of [iso(30), iso(31)]) {
    await db.insertInto("availability_day").values({ unit_id: nadas.id, day: d, state: "blocked", source: "manual" }).execute();
  }
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: "owner@example.com", minNights: 1, autoDeclineHours: 48 }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  if (SELFTEST) {
    const snap = path.join(ROOT, "sites", slug, "index.html");
    let html = await readFile(snap, "utf8");
    const flag = "var multi = units.length > 1;";
    if (!html.includes(flag)) {
      console.error("⛔ ÖNTESZT: nem találom a több szobás mód kapcsolóját a pillanatképben — nem rontok vissza vakon.");
      process.exit(1);
    }
    await writeFile(snap, html.replace(flag, "var multi = false;"), "utf8");
    console.log("  🔴 ÖNTESZT: a pillanatképben a több szobás mód kikapcsolva.\n");
  }

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const browser = await chromium.launch({ executablePath: config.chromiumPath });

  for (const [label, width, phone] of [["telefon", 390, true], ["asztali", 1280, false]] as const) {
    console.log(`\n══ ${label} (${width}px)`);
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 1000 }, hasTouch: phone, isMobile: phone });
    const page = await ctx.newPage();
    // A missing element must FAIL a check, not hang the guard for 30 s and crash it.
    page.setDefaultTimeout(5_000);
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    const posted: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/foglalas")) posted.push(r.postData() ?? ""); });
    try {
    await page.goto(`http://127.0.0.1:${port}/t/${slug}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const f = page.locator("form.cit-book");
    check("① nincs egység-legördülő (a régi egy-egységes választó)", (await f.locator("select[name=unit]").count()) === 0);
    const setDates = async (a: string, b: string) => {
      await f.evaluate((el, [x, y]) => {
        const form = el as HTMLFormElement;
        (form.elements.namedItem("from") as HTMLInputElement).value = x!;
        form.from.dispatchEvent(new Event("change", { bubbles: true }));
        (form.elements.namedItem("to") as HTMLInputElement).value = y!;
        form.to.dispatchEvent(new Event("change", { bubbles: true }));
      }, [a, b]);
      await page.waitForTimeout(350);
    };
    const hint = await f.locator("[data-cit-roomlist]").innerText().catch(() => "");
    check("③ dátum előtt a lista a napokat kéri", /Előbb válassza ki a napokat/.test(hint), hint);
    // ② day 30 is busy for the Nádas only — the calendar keeps it open.
    const d30busy = await f.evaluate((el, d) => {
      const b = el.querySelector(`[data-day="${d}"]`);
      return b ? b.classList.contains("cit-book__day--busy") : null;
    }, iso(30));
    check("② az egy szobában foglalt nap a naptárban NYITVA (más szoba szabad)", d30busy === false || d30busy === null, d30busy);

    await setDates(iso(29), iso(32));
    const names = await f.locator("[data-cit-roomlist] .cit-book__roomn").allInnerTexts();
    check("① a listában a 3 szoba, az egész ház NINCS", names.length === 3 && !names.some((n) => /egész ház/.test(n)), names);
    check("③ a foglalt Nádas nem pipálható", await f.locator(`[data-cit-room-pick][value="${nadas.id}"]`).isDisabled());
    check("③ …és kimondja: „Erre az időszakra foglalt”", /Erre az időszakra foglalt/.test(await f.locator(".cit-book__room.is-off").innerText()));
    check("…a gomb két szobát ajánl („Mind a 2 szabad szobát kérem”)", /Mind a 2 szabad szobát kérem/.test(await f.locator("[data-cit-room-all]").innerText()));

    await setDates(iso(20), iso(23));
    check("„Mind a 3 szobát kérem (az egész ház)” ha mind szabad", /Mind a 3 szobát kérem \(az egész ház\)/.test(await f.locator("[data-cit-room-all]").innerText()));
    check("szoba nélkül nincs ár és nincs küldés", (await f.locator("[data-quote]").innerText()).trim() === "" && (await f.locator(".cit-book__submit").isDisabled()));
    await f.locator(`[data-cit-room-pick][value="${nadas.id}"]`).check();
    await f.locator(`[data-cit-room-pick][value="${kerti.id}"]`).check();
    await page.waitForTimeout(300);
    const quote = await f.locator("[data-quote]").innerText();
    check("④ az ár szobánként tételes", /Nádas apartman — Alapár/.test(quote) && /Kerti stúdió — Alapár/.test(quote), quote.slice(0, 200));
    check("④ …összesen 72 000 + 57 000 = 129 000 Ft", /129\s000/.test(quote), quote.slice(0, 300));
    // `MR_SHOTS=<dir>`: the finished surface at the decision point, for the eye (§2b ②).
    if (process.env.MR_SHOTS) await f.screenshot({ path: path.join(process.env.MR_SHOTS, `kesz-szobak-${label}.png`) });
    if (phone) {
      await page.locator(".cit-book__go").tap();
      await page.waitForTimeout(350);
      const sum = await page.locator(".cit-book__sum").innerText();
      check("a 2. lépés összegzője a két szobát nevezi meg", /Nádas apartman, Kerti stúdió/.test(sum), sum);
    }
    for (let i = 0; i < 9; i++) {
      const plus = f.locator(".cit-book__step[data-step='1']");
      if (await plus.isDisabled()) break;
      await plus.click();
    }
    check("④ a létszám a két szoba férőhelyénél (4+3=7) megáll", (await f.locator("[data-guests]").innerText()) === "7");
    await f.locator("#cit-name").fill("Teszt Vendég");
    await f.locator("#cit-email").fill(`mr-${label}@example.com`);
    await f.locator("#cit-phone").fill("06 30 123 4567");
    await f.locator(".cit-book__submit").click();
    await page.waitForTimeout(1200);
    const receipt = await page.locator(".cit-book--done").innerText().catch(() => "");
    if (process.env.MR_SHOTS) await page.locator(".cit-book--done").screenshot({ path: path.join(process.env.MR_SHOTS, `kesz-nyugta-${label}.png`) }).catch(() => {});
    check("⑤ a nyugta „Szobák” sorral, a két szobával", /Szobák/.test(receipt) && /Nádas apartman, Kerti stúdió/.test(receipt), receipt.slice(0, 300));
    check("⑤ egy POST, benne két unit mező", posted.length === 1 && (posted[0]!.match(/(^|&)unit=/g) ?? []).length === 2, posted);
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    } catch (err) {
      check("a vendég-út végigment", false, String(err).split("\n")[0]);
    }
    await ctx.close();
  }
  await browser.close();

  console.log("\n══ szerver");
  const rows = await db.selectFrom("booking_request").select(["id", "unit_ids", "quoted_total", "action_token"]).where("site_id", "=", site.id).execute();
  check("⑤ két kérés jött létre (telefon + asztali), mindkettő két szobával", rows.length === 2 && rows.every((r) => r.unit_ids.length === 2), rows.map((r) => r.unit_ids.length));
  check("④ a fagyasztott ár 129 000", rows.every((r) => Number(r.quoted_total) === 129_000), rows.map((r) => r.quoted_total));

  // ① a hand-made POST with the house and a room together
  const mixed = await fetch(`http://127.0.0.1:${port}/t/${slug}/api/foglalas`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams([["unit", house.id], ["unit", kis.id], ["from", iso(40)], ["to", iso(42)], ["guests", "2"], ["name", "X"], ["email", "x@example.com"], ["phone", "06301234567"]]).toString(),
  });
  check("① az egész ház POST-ja elutasítva (szobánként kiadó szállás)", mixed.status === 400, mixed.status);

  // ⑥ accept one → both rooms booked, the other (overlapping) request auto-declined
  // The server half stands on its own: if the browser half made no requests (the self-test),
  // the two overlapping multi-room requests are made here, so ⑥–⑧ still run and report.
  if (rows.length < 2) {
    for (const who of ["a", "b"]) {
      await createBookingRequest({ siteId: site.id, unitId: nadas.id, unitIds: [nadas.id, kerti.id], guestName: `Szerver ${who}`, guestEmail: `srv-${who}@example.com`, guestPhone: "06301234567", dateFrom: iso(20), dateTo: iso(23), guests: 2 }, null);
    }
    rows.splice(0, rows.length, ...(await db.selectFrom("booking_request").select(["id", "unit_ids", "quoted_total", "action_token"]).where("site_id", "=", site.id).execute()));
  }
  const [first, second] = rows;
  const acc = await decideRequest(first!.action_token, "accepted", null, null);
  check("⑥ visszaigazolva", acc.outcome === "accepted", acc.outcome);
  const days = await db.selectFrom("availability_day").select(["unit_id"]).where("source", "=", `booking:${first!.id}`).execute();
  check("⑥ mindkét szoba 3-3 éje lezárva", days.filter((d) => d.unit_id === nadas.id).length === 3 && days.filter((d) => d.unit_id === kerti.id).length === 3, days.length);
  const loser = await db.selectFrom("booking_request").select(["status", "decided_by"]).where("id", "=", second!.id).executeTakeFirstOrThrow();
  check("⑥ az ütköző kérés automatikusan elutasítva", loser.status === "declined" && loser.decided_by === "auto", loser);
  // a one-room request for the Kisházi on the same nights is NOT in the way
  const solo = await createBookingRequest({ siteId: site.id, unitId: kis.id, guestName: "Solo", guestEmail: "solo@example.com", guestPhone: "06301234567", dateFrom: iso(20), dateTo: iso(23), guests: 2 }, null);
  check("a nem érintett szoba ugyanarra az időre foglalható", solo.ok, solo.errors);
  const busy = await createBookingRequest({ siteId: site.id, unitId: kis.id, unitIds: [kis.id, kerti.id], guestName: "Busy", guestEmail: "busy@example.com", guestPhone: "06301234567", dateFrom: iso(21), dateTo: iso(22), guests: 2 }, null);
  check("a foglalt szobát tartalmazó kérés név szerint elutasítva", !busy.ok && /Kerti stúdió/.test(busy.errors.join(" ")), busy.errors);
  const over = await createBookingRequest({ siteId: site.id, unitId: kis.id, unitIds: [kis.id, nadas.id], guestName: "Sok", guestEmail: "sok@example.com", guestPhone: "06301234567", dateFrom: iso(50), dateTo: iso(52), guests: 7 }, null);
  check("④ a férőhelyek összege (2+4) fölött a szerver is elutasít", !over.ok && /legfeljebb 6/.test(over.errors.join(" ")), over.errors);

  // ⑦ cancel frees every room
  const cx = await cancelRequest({ id: first!.id, by: "owner", publicBaseUrl: null });
  check("⑦ lemondva", cx.outcome === "cancelled", cx.outcome);
  const left = await db.selectFrom("availability_day").select("unit_id").where("source", "=", `booking:${first!.id}`).execute();
  check("⑦ mindkét szoba felszabadult", left.length === 0, left.length);

  // ⑧ a multi-room quote request (Kisházi has no price for the stay) → one per-night price for the set
  await db.deleteFrom("unit_price").where("unit_id", "=", kis.id).execute();
  const q = await createBookingRequest({ siteId: site.id, unitId: kis.id, unitIds: [kis.id, kerti.id], guestName: "Ajánlat", guestEmail: "aj@example.com", guestPhone: "06301234567", dateFrom: iso(60), dateTo: iso(62), guests: 3 }, null);
  check("⑧ ár nélküli szobával árajánlat-kérés (nincs fagyasztott ár)", q.ok && q.summary?.total === null, q);
  const qrow = await db.selectFrom("booking_request").select("action_token").where("id", "=", q.id!).executeTakeFirstOrThrow();
  const view = await loadOfferView(qrow.action_token);
  check("⑧ az ajánlat-lap a 2 szobát együtt árazza, minden éjre", view.rooms === 2 && view.missing?.length === 2 && (view.known ?? []).length === 0, view);
  const sent = await sendOffer(qrow.action_token, { amount: "40 000", into: true, save: "base" }, null);
  check("⑧ az ajánlat 2 éj × 40 000 = 80 000", sent.ok && sent.total === 80_000, sent);
  check("⑧ …és semmi nem került árlistába", (await getUnitPrices(kis.id)).length === 0 && sent.savedAs === "request", sent.savedAs);
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.siteId) {
    const units = await db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId).execute();
    if (units.length) await db.deleteFrom("availability_day").where("unit_id", "in", units.map((u) => u.id)).execute().catch(() => {});
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
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
    console.error("\n⛔ AZ ÖNTESZT NEM BUKOTT: az egy-egységes utat az őr átengedte — vak.");
    process.exit(1);
  }
  console.log(`\n🔴 ÖNTESZT: ${fail} bukás az egy-egységes úton — az őr lát.`);
  process.exit(1);
}
console.log(fail ? `\n⛔ MULTI-ROOM: ${fail} bukás` : "\n🟢 MULTI-ROOM: több szoba egy kérésben — vendég, szerver, visszaigazolás, lemondás, ajánlat");
process.exit(fail ? 1 : 0);
