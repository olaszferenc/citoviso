// ⛔⛔ AZ ÁRAJÁNLAT-ÚT ŐRE — kontraktus: assets/design-refs/tenant-admin/booking-offer/
// (tulajdonosi jóváhagyás 2026-09-23, „B" út + érvényesség + tulaj-oldali rögzítés).
//
// A MÉRT LELET, amiért létezik. Ár nélküli kérésnél a tulaj levele az árat NÉMÁN
// kihagyta, „Új foglalási kérés"-nek hívta, és egy koppintásos „Elfogadom" gombot adott,
// ami a foglalást ÁR NÉLKÜL véglegesítette — a vendég árajánlatot kért, és összeg
// nélküli visszaigazolást kapott.
//
// Miért END-TO-END: a kontraktus egy LÁNCOT köt (tulaj-levél → ajánlat-lap → árlista →
// vendég-levél → vendég-lap → foglalás → két értesítés), és a láncszemek öt fájlban
// épülnek. A tavalyi lecke (ADR-0208 ④.1): a saját végponttól-végpontig mérésem hatóköre
// a saját vakfoltom — ezért a lánc a KÉZBESÍTETT levelek linkjein halad tovább, nem a
// függvényeken.
//
// ⭐ POZITÍV KONTROLL (a brief tanulsága): egy ÁRAZOTT kérésnek VÁLTOZATLANUL a régi,
// koppintásos levelet kell kapnia. Ha az őr azt sem találja, a levél-olvasás vak, és
// minden „nincs benne /elfogadom" állítás üresen lenne zöld.
//
// Eldobható fixtúra, valódi DB + HTTP-szerver + böngésző, mindkét méreten. A levelek
// @example.com címre mennek — a ReservedRecipientGuard SMTP mellett is az outbox/-ba
// tereli őket, tehát valódi levél nem mehet ki.
//
//   npx tsx scripts/booking-offer-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCOPE = path.basename(ROOT); // worktree-unique scratch key: assets/Temp is a SYMLINK shared by every worktree
const { config } = await import("../src/config.js");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { addSeasonPrice, setBasePrice, getUnitPrices } = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const req = await import("../src/booking/requests.js");
const { maintainDatedPrices } = await import("../src/tenant/priceExpiry.js");

const ids: Record<string, string> = {};
let server: Server | null = null;
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 400)}`);
  }
};

const STARTED = Date.now();
const OUTBOX = path.join(ROOT, "outbox");
interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly file: string;
}
/** Every mail written since the run started to a recipient containing `who`. */
async function mailsTo(who: string): Promise<Mail[]> {
  // Sends are fire-and-forget in the product — give them a beat to land.
  await new Promise((r) => setTimeout(r, 700));
  const out: Mail[] = [];
  let files: string[] = [];
  try {
    files = await readdir(OUTBOX);
  } catch {
    return out;
  }
  for (const f of files.sort()) {
    const p = path.join(OUTBOX, f);
    if ((await stat(p)).mtimeMs < STARTED) continue;
    const raw = await readFile(p, "utf8");
    const to = /^To: (.*)$/m.exec(raw)?.[1] ?? "";
    if (!to.includes(who)) continue;
    out.push({
      to,
      subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "",
      body: raw.slice(raw.indexOf("\n\n") + 2),
      file: f,
    });
  }
  return out;
}
const onlyNew = (all: Mail[], seen: Set<string>): Mail[] => {
  const n = all.filter((m) => !seen.has(m.file));
  n.forEach((m) => seen.add(m.file));
  return n;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

try {
  const stamp = Date.now().toString(36);
  const OWNER = `owner-${stamp}@example.com`;
  const GUEST = `guest-${stamp}@example.com`;
  const today = new Date().toISOString().slice(0, 10);
  // The next June 28 at least ten days away — inside the 12-month horizon.
  let year = Number(today.slice(0, 4));
  if (`${year}-06-18` < today) year++;
  const ARR = `${year}-06-28`;
  const DEP = `${year}-07-03`;
  const UNTIL = `${year}-09-30`;

  // ── fixture ───────────────────────────────────────────────────────────────
  const def = await db.insertInto("scraper_definition").values({ label: "_offer", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_offer lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Rózsa Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `offer-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `offer_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Rózsa Vendégház", intro: "Árajánlat-teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 1.", email: OWNER }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const upper = await db.insertInto("site_unit").values({ site_id: site.id, name: "Emeleti szoba", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const priced = await db.insertInto("site_unit").values({ site_id: site.id, name: "Árazott apartman", capacity: 4, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  const ground = await db.insertInto("site_unit").values({ site_id: site.id, name: "Földszinti szoba", capacity: 2, sort_order: 3 }).returning("id").executeTakeFirstOrThrow();
  const annex = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kerti ház", capacity: 2, sort_order: 4 }).returning("id").executeTakeFirstOrThrow();
  const attic = await db.insertInto("site_unit").values({ site_id: site.id, name: "Padlásszoba", capacity: 2, sort_order: 5 }).returning("id").executeTakeFirstOrThrow();
  // The tenant's own login (the admin shot) and contact address (the reminder).
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `offer_${stamp}`, contact_email: OWNER, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  const season = await addSeasonPrice(upper.id, "Főszezon", "07-01", "08-31", 32_000);
  if (!season.ok) throw new Error("szezon-ár nem ment: " + season.errors.join(","));
  await setBasePrice(priced.id, 28_000);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");

  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const BASE = `http://127.0.0.1:${port}`;
  /** A link from a delivered mail, re-pointed at the test server (path kept). */
  const local = (url: string): string => BASE + new URL(url).pathname;
  const seenOwner = new Set<string>();
  const seenGuest = new Set<string>();

  const book = async (unitId: string, from: string, to: string): Promise<{ ok: boolean; total: unknown }> => {
    const r = await fetch(`${BASE}/t/${slug}/api/foglalas`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ unit: unitId, name: "Kiss Anna", email: GUEST, phone: "+36 30 555 1234", from, to, guests: "2", message: "Két felnőtt, esetleg kiságyat kérnénk. Mennyi lenne?" }),
    });
    const j = (await r.json()) as { ok: boolean; summary?: { total: unknown }; errors?: string[] };
    if (!j.ok) console.error("     foglalás elutasítva:", j.errors);
    return { ok: j.ok, total: j.summary?.total };
  };

  // ── ⭐ POZITÍV KONTROLL: árazott kérés → a régi, koppintásos levél ────────────
  console.log("\n⭐ Pozitív kontroll — az árazott kérés változatlan");
  const pc = await book(priced.id, addDays(ARR, 10), addDays(ARR, 12));
  check("az árazott kérés elmegy, befagyasztott árral", pc.ok && typeof pc.total === "number", pc);
  const pcMail = onlyNew(await mailsTo(OWNER), seenOwner);
  check("…és a tulaj levele MEGÉRKEZIK (különben a levél-olvasás vak)", pcMail.length === 1, pcMail.map((m) => m.subject));
  check("…„Foglalási kérés” a tárgy", /^Foglalási kérés/.test(pcMail[0]?.subject ?? ""), pcMail[0]?.subject);
  check("…és van benne koppintásos /elfogadom", /\/elfogadom/.test(pcMail[0]?.body ?? ""));
  onlyNew(await mailsTo(GUEST), seenGuest);

  // ── ① ② a quote request: honest owner mail, no one-tap accept ───────────────
  console.log("\n①② Ár nélküli kérés — a tulaj levele");
  const q = await book(upper.id, ARR, DEP);
  check("a kérés elmegy, ár NÉLKÜL", q.ok && q.total === null, q);
  const ownerMail = onlyNew(await mailsTo(OWNER), seenOwner);
  const om = ownerMail[0];
  check("egy tulaj-levél ment ki", ownerMail.length === 1, ownerMail.map((m) => m.subject));
  check("② a tárgy „Árajánlat-kérés”", /^Árajánlat-kérés/.test(om?.subject ?? ""), om?.subject);
  check("② kimondja: a vendég nem látott árat", /A vendég nem látott árat/.test(om?.body ?? ""));
  check("② megnevezi a 3 árazatlan éjszakát", /3 éjszakára nincs megadott ár/.test(om?.body ?? ""), (om?.body ?? "").slice(0, 400));
  check("② ⛔ NINCS benne koppintásos /elfogadom", !/\/elfogadom/.test(om?.body ?? ""));
  const offerUrl = /(https?:\/\/[^\s"<]+\/foglalas\/[A-Za-z0-9_-]+\/ajanlat)/.exec(om?.body ?? "")?.[1];
  check("② van benne ajánlat-link", !!offerUrl);
  const gAck = onlyNew(await mailsTo(GUEST), seenGuest);
  check("⑭ a vendég „rögzítettük” levele árajánlat-kérést mond", /^Árajánlat-kérését rögzítettük/.test(gAck[0]?.subject ?? ""), gAck.map((m) => m.subject));

  const row0 = await db.selectFrom("booking_request").selectAll().where("site_id", "=", site.id).where("unit_id", "=", upper.id).executeTakeFirstOrThrow();
  ids.req1 = row0.id;
  const actionToken = row0.action_token;

  // ② a régi levél koppintásos linkje NEM véglegesít — az ajánlat-lapra visz
  const oldTap = await fetch(`${BASE}/foglalas/${actionToken}/elfogadom`, { redirect: "manual" });
  check("② a régi „Elfogadom” link átirányít az ajánlat-lapra", oldTap.status === 302 && /\/ajanlat$/.test(oldTap.headers.get("location") ?? ""), { s: oldTap.status, l: oldTap.headers.get("location") });
  const afterTap = await db.selectFrom("booking_request").select("status").where("id", "=", row0.id).executeTakeFirstOrThrow();
  const daysAfterTap = await db.selectFrom("availability_day").select("day").where("source", "=", `booking:${row0.id}`).execute();
  check("② …a kérés függő marad, egyetlen nap sem foglalt", afterTap.status === "pending" && daysAfterTap.length === 0, { s: afterTap.status, d: daysAfterTap.length });

  // ── ④–⑦ the owner's offer page, in a real browser, both sizes ────────────────
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const OUT = path.join(ROOT, `assets/Temp/_offer-${SCOPE}`);
  await mkdir(OUT, { recursive: true });
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    console.log(`\n④–⑦ Ajánlat-lap — ${label} (${width}px)`);
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(local(offerUrl!), { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    check("④ a hiányzó sor 3 éjszakát kér", /Új ár · 3 éj/.test(body), body.slice(0, 300));
    check("④ a Főszezon a meglévő áron, fixen áll", /Főszezon · 2 éj × 32 000 Ft/.test(body));
    // The label is uppercased by CSS, so innerText reads "VENDÉG" — match case-free.
    check("④ a vendég üzenete „Vendég” címkével", /vendég\s*„Két felnőtt/i.test(body), body.slice(0, 600));
    check("⑥ üres dátumnál a figyelmeztetés látszik, és megnevezi a szezont", /Nincs lejárati dátum\.[\s\S]*Főszezon/.test(await page.locator("[data-validity]").innerText()));
    check("a küldés tiltva, amíg nincs ár", await page.locator("[data-send]").isDisabled());
    await page.fill("[data-amount]", "abc");
    check("⑦ hibás bevitelre hibaüzenet", /Csak számot írjon/.test(await page.locator("[data-amount-err]").innerText()));
    check("⑦ …és a küldés tiltva", await page.locator("[data-send]").isDisabled());
    await page.fill("[data-amount]", "26.000");
    check("⑦ „26.000” → összesen 142 000 Ft", /142 000 Ft/.test(await page.locator("[data-total]").innerText()), await page.locator("[data-total]").innerText());
    await page.locator("[data-amount]").blur();
    check("⑦ elhagyáskor „26 000”-re formáz", (await page.locator("[data-amount]").inputValue()) === "26 000");
    await page.fill("[data-until]", addDays(ARR, 1));
    check("⑥ a tartózkodásnál korábbi dátum hibát ad", /Legalább/.test(await page.locator("[data-until-err]").innerText()));
    check("⑥ …és a küldés tiltva", await page.locator("[data-send]").isDisabled());
    await page.fill("[data-until]", UNTIL);
    check("⑥ érvényes dátumnál kimondja a lejáratot és az emlékeztetőt", /-ig érvényes[\s\S]*emlékeztetjük/.test(await page.locator("[data-validity]").innerText()));
    await page.locator("[data-until]").fill("");
    await page.locator("[data-until]").dispatchEvent("change");
    check("⑥ „Nincs vége” után a figyelmeztetés visszajön", /Nincs lejárati dátum/.test(await page.locator("[data-validity]").innerText()));
    await page.fill("[data-until]", UNTIL);
    await page.screenshot({ path: path.join(OUT, `offer-owner-${label}.png`), fullPage: true });
    // Layout ⑮: two columns on desktop, one on mobile.
    const cols = await page.locator(".of-grid > *").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    check(`⑮ elrendezés: ${label === "asztali" ? "két hasáb egymás mellett" : "egy hasáb"}`, label === "asztali" ? cols[0] !== cols[1] : cols[0] === cols[1], cols);
    if (label === "asztali") {
      await page.fill("#of-note", "A kiságyat szívesen odakészítjük.");
      await Promise.all([page.waitForLoadState("networkidle"), page.locator("[data-send]").click()]);
      await page.waitForSelector("[data-offer-sent]");
      check("⑧ a tulaj lapja: „Ajánlat elküldve, 142 000 Ft”", /Ajánlat elküldve, 142 000 Ft/.test(await page.locator("[data-offer-sent]").innerText()));
      await page.screenshot({ path: path.join(OUT, `offer-owner-sent-${label}.png`), fullPage: true });
    }
    check("nincs JS-hiba", jsErr.length === 0, jsErr);
    await ctx.close();
  }

  // ── ⑤ ⑧ what the send wrote ──────────────────────────────────────────────────
  console.log("\n⑤⑧ Amit a küldés írt");
  const r1 = await db.selectFrom("booking_request").selectAll().where("id", "=", row0.id).executeTakeFirstOrThrow();
  check("⑧ a kérés „offered”, az ár ráfagyva (142 000)", r1.status === "offered" && r1.quoted_total === 142_000, { s: r1.status, t: r1.quoted_total });
  check("⑩ a vendég kulcsa KÜLÖN kulcs", !!r1.offer_token && r1.offer_token !== r1.action_token);
  const days1 = await db.selectFrom("availability_day").select("day").where("source", "=", `booking:${r1.id}`).execute();
  check("⑧ a napok még szabadok", days1.length === 0, days1.length);
  const prices = await getUnitPrices(upper.id);
  const dated = prices.find((p) => p.isBase && p.validTo);
  check("⑤⑥ az ár DÁTUMOS alapárként került az árlistába", !!dated && dated.amount === 26_000 && dated.validFrom === today && dated.validTo === UNTIL, prices);
  const avail = (await (await fetch(`${BASE}/t/${slug}/api/foglaltsag/${upper.id}`)).json()) as { pricing: { rows: { validTo?: string }[] } };
  check("a böngésző ugyanazt az ablakot kapja (JSON)", avail.pricing.rows.some((r) => r.validTo === UNTIL), avail.pricing);
  const pub = await (await fetch(`${BASE}/t/${slug}/`)).text();
  const untilCell = `– ${UNTIL.slice(0, 4)}. ${UNTIL.slice(5, 7)}. ${UNTIL.slice(8, 10)}.`;
  check("a honlap ártáblája kimondja a záró napot (újrarenderelve)", pub.includes(untilCell));

  // The three surfaces the offer flow changed outside the mock (surface gate): the
  // public price table's end date, the pricing tab's dated row, the module-page card.
  const { mintTenantCookieValue: mintCookie } = await import("../src/auth/tenantAuth.js");
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    await ctx.addCookies([{ name: "cit_session", value: mintCookie(tu.id), url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/t/${slug}/`, { waitUntil: "networkidle" });
    const sec = page.locator('[data-cit-module="pricing"]').first();
    check(`ártábla ${label}: a dátumos alapár sora a záró napot mutatja`, (await sec.innerText()).includes(untilCell), (await sec.innerText()).slice(0, 300));
    await sec.screenshot({ path: path.join(OUT, `surface-pricetable-${label}.png`) });
    await page.goto(`${BASE}/admin?tab=modulok&m=pricing`, { waitUntil: "networkidle" });
    const card = page.locator(".adm-card", { hasText: "Emeleti szoba" }).filter({ hasText: "Alapár, dátummal" }).first();
    check(`Árazás lap ${label}: „Alapár, dátummal” sor a dátumokkal`, (await card.count()) === 1 && (await card.innerText()).includes(`${UNTIL.slice(0, 4)}. ${UNTIL.slice(5, 7)}. ${UNTIL.slice(8, 10)}.`));
    check(`Árazás lap ${label}: az „Alapár” mező üres marad (a dátumos nem tölti ki)`, (await card.locator('input[name="amount"]').first().inputValue()) === "");
    await card.screenshot({ path: path.join(OUT, `surface-pricingtab-${label}.png`) });
    await ctx.close();
  }

  // ── ⑨ ⑩ the guest's letter and key ────────────────────────────────────────────
  console.log("\n⑨⑩ A vendég levele és kulcsa");
  const gOffer = onlyNew(await mailsTo(GUEST), seenGuest).find((m) => /^Árajánlat:/.test(m.subject));
  check("⑨ a vendég „Árajánlat:” levelet kapott", !!gOffer);
  check("⑨ benne az összeg és a tulaj üzenete", /142 000 Ft/.test(gOffer?.body ?? "") && /kiságyat szívesen/.test(gOffer?.body ?? ""));
  check("⑨ kimondja: addig más is lefoglalhatja", /más is lefoglalhatja/.test(gOffer?.body ?? ""));
  check("⑩ ⛔ a vendég levelében NINCS a tulaj kulcsa", !(gOffer?.body ?? "").includes(r1.action_token));
  const guestUrl = /(https?:\/\/[^\s"<]+\/ajanlat\/[A-Za-z0-9_-]+)/.exec(gOffer?.body ?? "")?.[1];
  check("⑨ van benne vendég-link", !!guestUrl);
  check("⑩ a tulaj kulcsa a vendég-úton 404", (await fetch(`${BASE}/ajanlat/${r1.action_token}`)).status === 404);
  check("⑩ a vendég kulcsa a tulaj-úton 404", (await fetch(`${BASE}/foglalas/${r1.offer_token}/ajanlat`)).status === 404);

  // ── ⑪ ⑫ the guest's page: shows first, the button decides ─────────────────────
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(local(guestUrl!), { waitUntil: "networkidle" });
    check(`⑪ ${label}: a lap megmutatja az ajánlatot`, /Az ajánlat[\s\S]*142 000 Ft/.test(await page.locator("body").innerText()));
    await page.screenshot({ path: path.join(OUT, `offer-guest-${label}.png`), fullPage: true });
    check(`${label}: nincs JS-hiba`, jsErr.length === 0, jsErr);
    await ctx.close();
  }
  const stillOffered = await db.selectFrom("booking_request").select("status").where("id", "=", r1.id).executeTakeFirstOrThrow();
  check("⑪ két megnyitás (előtöltés) után sem döntött semmit", stillOffered.status === "offered", stillOffered.status);

  console.log("\n⑪⑫ A vendég elfogadja");
  const accCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const accPage = await accCtx.newPage();
  await accPage.goto(local(guestUrl!), { waitUntil: "networkidle" });
  await Promise.all([accPage.waitForLoadState("networkidle"), accPage.getByRole("button", { name: "Elfogadom az ajánlatot" }).click()]);
  check("⑫ a vendég lapja: „Foglalása végleges”", (await accPage.locator("[data-offer-outcome]").getAttribute("data-offer-outcome")) === "accepted_now");
  await accPage.screenshot({ path: path.join(OUT, "offer-guest-accepted-mobil.png"), fullPage: true });
  await accCtx.close();
  const r2 = await db.selectFrom("booking_request").selectAll().where("id", "=", r1.id).executeTakeFirstOrThrow();
  const days2 = await db.selectFrom("availability_day").select("day").where("source", "=", `booking:${r1.id}`).execute();
  check("⑪ elfogadva, a vendég döntött", r2.status === "accepted" && r2.decided_by === "guest", { s: r2.status, by: r2.decided_by });
  check("⑪ mind az 5 éjszaka foglalt", days2.length === 5, days2.length);
  const gConf = onlyNew(await mailsTo(GUEST), seenGuest).find((m) => /^Visszaigazolt foglalás/.test(m.subject));
  check("⑫ a vendég visszaigazolást kap az ajánlott árral", /Az ajánlott ár:[\s\S]*142 000 Ft/.test(gConf?.body ?? ""), gConf?.subject);
  const oAcc = onlyNew(await mailsTo(OWNER), seenOwner).find((m) => /elfogadta az ajánlatát/.test(m.subject));
  check("⑫ a tulaj levelet kap: „… elfogadta az ajánlatát”", !!oAcc);
  const again = await fetch(`${BASE}/ajanlat/${r1.offer_token}/elfogadom`, { method: "POST" });
  check("második elfogadás: „már elfogadta”, semmi nem duplázódik", /már elfogadta/.test(await again.text()) &&
    (await db.selectFrom("availability_day").select("day").where("source", "=", `booking:${r1.id}`).execute()).length === 5);

  // ── ⑬ ⑫ the other endings, on a unit with no price at all ────────────────────
  console.log("\n⑬ Tulaj-oldali rögzítés · „Nem kérem” · közben elkelt · lejárat");
  const mk = async (unitId: string, from: string, to: string): Promise<string> => {
    const r = await req.createBookingRequest(
      { siteId: site.id, unitId, guestName: "Nagy Béla", guestEmail: GUEST, guestPhone: "+36 30 111 2222", dateFrom: from, dateTo: to, guests: 2, message: null },
      BASE,
    );
    if (!r.ok || !r.id) throw new Error("kérés bukott: " + r.errors.join(","));
    return r.id;
  };
  const tok = async (id: string): Promise<string> =>
    (await db.selectFrom("booking_request").select("action_token").where("id", "=", id).executeTakeFirstOrThrow()).action_token;

  // ⑬ owner records — no date → the TIMELESS base
  const g1 = await mk(ground.id, addDays(ARR, 30), addDays(ARR, 32));
  const s1 = await req.sendOffer(await tok(g1), { amount: "18 000", until: "" }, BASE);
  check("dátum nélküli ajánlat elmegy", s1.ok && s1.total === 36_000, s1);
  const gp = await getUnitPrices(ground.id);
  check("⑥ dátum nélkül IDŐTLEN alapár lett", gp.some((p) => p.isBase && !p.validFrom && p.amount === 18_000), gp);
  onlyNew(await mailsTo(OWNER), seenOwner);
  const rec = await req.recordOfferAcceptedByOwner(await tok(g1), BASE);
  const g1row = await db.selectFrom("booking_request").select(["status", "decided_by"]).where("id", "=", g1).executeTakeFirstOrThrow();
  check("⑬ a tulaj rögzítette: elfogadva, a tulaj döntött", rec.outcome === "accepted" && g1row.status === "accepted" && g1row.decided_by === "owner", { rec: rec.outcome, ...g1row });
  check("⑬ …és a tulaj NEM kap levelet a saját lépéséről", onlyNew(await mailsTo(OWNER), seenOwner).every((m) => !/elfogadta az ajánlatát/.test(m.subject)));

  // Three quote requests on the annex BEFORE any price exists (each is a quote).
  const aDec = await mk(annex.id, addDays(ARR, 40), addDays(ARR, 42));
  const aExp = await mk(annex.id, addDays(ARR, 50), addDays(ARR, 52));
  const aCon = await mk(annex.id, addDays(ARR, 60), addDays(ARR, 62));
  const aOwn = await mk(annex.id, addDays(ARR, 70), addDays(ARR, 72));
  const pAttic = await mk(attic.id, addDays(ARR, 80), addDays(ARR, 82));
  onlyNew(await mailsTo(OWNER), seenOwner);
  onlyNew(await mailsTo(GUEST), seenGuest);
  await req.sendOffer(await tok(aDec), { amount: "15 000", until: addDays(ARR, 100) }, BASE);
  await req.sendOffer(await tok(aExp), { amount: "", until: "" }, BASE);
  await req.sendOffer(await tok(aCon), { amount: "", until: "" }, BASE);
  await req.sendOffer(await tok(aOwn), { amount: "", until: "" }, BASE);

  // ── ⑬ the Foglalások tab, as the signed-in tenant, both sizes ──────────────────
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tu.id), url: BASE }]);
    const page = await ctx.newPage();
    const jsErr: string[] = [];
    page.on("pageerror", (e) => jsErr.push(e.message));
    await page.goto(`${BASE}/admin?tab=foglalasok`, { waitUntil: "networkidle" });
    const offeredCards = page.locator("[data-bk-offered]");
    check(`⑬ ${label}: a kiküldött ajánlatok külön blokkban („Ajánlatra vár”)`, (await offeredCards.count()) === 4 && /ajánlatra vár/i.test(await page.locator("body").innerText()), await offeredCards.count());
    check(`⑬ ${label}: a kártya kimondja a lejáratot`, /Ajánlat kiküldve · lejár/.test(await offeredCards.first().innerText()));
    check(`⑬ ${label}: van „A vendég elfogadta” gomb`, (await page.getByRole("button", { name: "A vendég elfogadta (telefonon / levélben)" }).count()) === 4);
    const quoteCard = page.locator(`#req-${pAttic}`);
    check(`② ${label}: az ár nélküli függő kérés „Ajánlatot küldök”-et kínál`, (await quoteCard.locator(`a[href="/foglalas/${await tok(pAttic)}/ajanlat"]`).count()) === 1);
    check(`② ${label}: …és NINCS rajta „Visszaigazolom”`, !/Visszaigazolom/.test(await quoteCard.innerText()));
    // Quote-author contract (tenant-admin/booking-quote-author): the offer's note is the
    // OWNER's, even though the GUEST closed the request (decided_by = guest). The first
    // shot labelled it „Vendég" — measured on the rendered row, not on the data.
    check(`⑧ ${label}: az ajánlat üzenete „Ön” címkét visel`, (await page.locator(".bk-quote--owner", { hasText: "kiságyat szívesen" }).count()) === 1);
    check(`⑧ ${label}: …és NEM „Vendég”-et`, (await page.locator(".bk-quote--guest", { hasText: "kiságyat szívesen" }).count()) === 0);
    await page.locator("#kerelmek").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `offer-admin-${label}.png`), fullPage: true });
    if (label === "asztali") {
      await Promise.all([
        page.waitForLoadState("networkidle"),
        page.locator(`#req-${aOwn} button`).click(),
      ]);
      const own = await db.selectFrom("booking_request").select(["status", "decided_by"]).where("id", "=", aOwn).executeTakeFirstOrThrow();
      check("⑬ a gomb valódi kattintással rögzít: elfogadva, a tulaj döntött", own.status === "accepted" && own.decided_by === "owner", own);
    }
    check(`${label}: nincs JS-hiba`, jsErr.length === 0, jsErr);
    await ctx.close();
  }
  const offTok = async (id: string): Promise<string> =>
    (await db.selectFrom("booking_request").select("offer_token").where("id", "=", id).executeTakeFirstOrThrow()).offer_token!;
  const annexRows = await db.selectFrom("booking_request").select(["id", "status", "quoted_total"]).where("id", "in", [aDec, aExp, aCon]).execute();
  check("a már árazott időszakra is elmegy az ajánlat (ár nem kell)", annexRows.every((r) => r.status === "offered" && r.quoted_total === 30_000), annexRows);
  onlyNew(await mailsTo(OWNER), seenOwner);

  // „Nem kérem”
  const dec = await fetch(`${BASE}/ajanlat/${await offTok(aDec)}/nem-kerem`, { method: "POST" });
  const decRow = await db.selectFrom("booking_request").select(["status", "decided_by"]).where("id", "=", aDec).executeTakeFirstOrThrow();
  check("⑫ „Nem kérem” → lezárva, a vendég döntött", dec.status === 200 && decRow.status === "declined" && decRow.decided_by === "guest", decRow);
  check("⑫ …a tulaj levelet kap", onlyNew(await mailsTo(OWNER), seenOwner).some((m) => /nem kérte az ajánlatot/.test(m.subject)));

  // lejárat — a határidő az ELKÜLDÉSTŐL számít
  await db.updateTable("booking_request").set({ offered_at: new Date(Date.now() - 49 * 3_600_000) }).where("id", "=", aExp).execute();
  const nExp = await req.expireStaleOffers();
  const expRow = await db.selectFrom("booking_request").select("status").where("id", "=", aExp).executeTakeFirstOrThrow();
  check("⑫ 48 óra után az ajánlat lejár", nExp >= 1 && expRow.status === "expired", { nExp, s: expRow.status });
  check("⑫ …mindkét fél levelet kap", onlyNew(await mailsTo(GUEST), seenGuest).some((m) => /árajánlat lejárt/.test(m.subject)) &&
    onlyNew(await mailsTo(OWNER), seenOwner).some((m) => /Lejárt egy árajánlat/.test(m.subject)));
  check("⑫ a lejárt ajánlat lapja „lejárt”-at mond", /lejárt/.test(await (await fetch(`${BASE}/ajanlat/${await offTok(aExp)}`)).text()));

  // közben elkelt
  for (let i = 0; i < 2; i++) {
    await db.insertInto("availability_day").values({ unit_id: annex.id, day: addDays(addDays(ARR, 60), i), state: "booked", source: "manual" }).execute();
  }
  const con = await fetch(`${BASE}/ajanlat/${await offTok(aCon)}/elfogadom`, { method: "POST" });
  const conRow = await db.selectFrom("booking_request").select("status").where("id", "=", aCon).executeTakeFirstOrThrow();
  check("⑫ közben elkelt → a vendég ezt látja", /közben elkeltek/.test(await con.text()));
  check("⑫ …a kérés lezárult, nem foglalt", conRow.status === "declined", conRow.status);
  check("⑫ …a tulaj értesítést kap", onlyNew(await mailsTo(OWNER), seenOwner).some((m) => /közben elkeltek/.test(m.subject)));

  // ── ⑥ the dated price over time ──────────────────────────────────────────────
  console.log("\n⑥ A dátumos ár az időben");
  await db.updateTable("unit_price").set({ valid_to: addDays(today, 5), expiry_notified_at: null }).where("unit_id", "=", upper.id).where("valid_to", "is not", null).execute();
  onlyNew(await mailsTo(OWNER), seenOwner);
  const m1 = await maintainDatedPrices(today);
  check("⑥ 14 napon belüli lejáratnál emlékeztető megy", m1.reminded >= 1, m1);
  check("⑥ …a tulaj megkapja", onlyNew(await mailsTo(OWNER), seenOwner).some((m) => /Hamarosan lejár egy ár: Emeleti szoba/.test(m.subject)));
  const m2 = await maintainDatedPrices(today);
  check("⑥ másodszor NEM megy ki (egy ablak = egy levél)", m2.reminded === 0, m2);
  await db.updateTable("unit_price").set({ valid_from: addDays(today, -10), valid_to: addDays(today, -1) }).where("unit_id", "=", upper.id).where("valid_to", "is not", null).execute();
  const m3 = await maintainDatedPrices(today);
  const left = (await getUnitPrices(upper.id)).filter((p) => p.validTo);
  check("⑥ lejárat után a sor lekerül", m3.expired >= 1 && left.length === 0, { m3, left });
  const pub2 = await (await fetch(`${BASE}/t/${slug}/`)).text();
  check("⑥ …és a honlap ártáblája már nem mutatja (újrarenderelve)", !pub2.includes("26 000"));

  await browser.close();
} finally {
  if (server?.listening) server.close();
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
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
console.log(fail ? `\n⛔ BOOKING-OFFER: ${fail} bukás` : "\n🟢 BOOKING-OFFER: a lánc a jóváhagyott B tervet követi, levéltől foglalásig");
process.exit(fail ? 1 : 0);
