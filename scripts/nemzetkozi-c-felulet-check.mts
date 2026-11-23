// NEMZETKÖZI C — the two non-Hungarian surfaces (owner's surface-gate exception, 2026-11-22),
// in a SCRATCH database (migration 0142 brings the real HR row; never the shared dev DB).
//
//   ① mock: on a page in another language (not English) an English portal unit name gives way
//      to its TYPE in the page language (roomNames.ts localRoomName → templateKit.ts
//      roomTypeName, one T() per type). Until Bábel imports the keys the render REPORTS them as
//      fallbacks (packs.ts collectFallbacks) — the existing language gate holds such a page;
//      the English name never shows. The Hungarian page is byte-identical; English keeps the name.
//   ② tenant admin › Online foglalás › „Hirdeti máshol is?”: an HR lodging gets only its
//      country's calendarSyncPortals (Booking.com + Airbnb) — cards, tutorial tabs and the
//      intro sentence; a HU lodging and a country-less (legacy) one get all three, unchanged.
//   Screenshots (390 + 1280) land in assets/design-refs/_drafts/nemzetkozi-c/ (gitignored).
//
//   npx tsx scripts/nemzetkozi-c-felulet-check.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_nemzc_felulet";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.I18N_BOOT_TOPUP = "0";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY"]) process.env[k] = "";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by nemzetkozi-c-felulet-check fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { config } = await import("../src/config.js");
const { chromium } = await import("playwright-core");
const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { localRoomName, hungarianRoomName } = await import("../src/engine/roomNames.js");
const { roomTypeName } = await import("../src/engine/templateKit.js");
const { collectFallbacks, ensureLanguagePack } = await import("../src/i18n/packs.js");
const { calendarSyncPortals } = await import("../src/country.js");
const { portalRooms } = await import("../src/generator/generateEngine.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail: unknown = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}

const OUT = path.resolve(import.meta.dirname, "../assets/design-refs/_drafts/nemzetkozi-c");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: config.chromiumPath });

try {
  // ── ① mock ──────────────────────────────────────────────────────────────────────────────
  console.log("① mock: angol portál-szobanév → a lap nyelvén a szoba TÍPUSA");
  await ensureLanguagePack("hr", { wait: true }); // Bábel's committed hr pack into the SCRATCH DB (no translation)
  const TYPE_KEYS = ["lakosztály", "stúdió", "apartman", "nyaraló", "ház", "bungaló", "hálóterem", "ikerszoba", "kétszemélyes szoba", "háromszemélyes szoba", "négyszemélyes szoba", "egyszemélyes szoba", "családi szoba"];
  const hu = { lang: "hu" };
  check("minden típus a saját T()-kulcsára fut (nem a „Szoba” alapra)", TYPE_KEYS.every((t) => roomTypeName(hu, t) !== "Szoba"), TYPE_KEYS.filter((t) => roomTypeName(hu, t) === "Szoba"));
  const CASES: Record<string, string> = {
    "Private Bathroom Twin Room": "ikerszoba",
    "Apartment with Sea View": "apartman",
    "Deluxe Double Room with Balcony": "kétszemélyes szoba",
    "Family Room": "családi szoba",
    "Junior Suite": "lakosztály",
    "Holiday Home": "nyaraló",
    "Studio": "stúdió",
    "Mixed Dormitory": "hálóterem",
  };
  const seen: string[] = [];
  const wrong = Object.entries(CASES).filter(([en, t]) => localRoomName(en, "hr", (x) => (seen.push(x), x)) !== t);
  check("HR: az angol név típusra fordul", wrong.length === 0, wrong);
  check("⛔ angol lapon a név marad", localRoomName("Private Bathroom Twin Room", "en", () => "X") === "Private Bathroom Twin Room");
  check("⛔ nem angol (helyi) név marad", localRoomName("Apartman Lavanda", "hr", () => "X") === "Apartman Lavanda" && localRoomName("Soba s pogledom", "hr", () => "X") === "Soba s pogledom");
  check("⛔ magyar lapon a régi hungarianRoomName (bájtra)", Object.keys(CASES).every((en) => localRoomName(en, "hu", () => "X") === hungarianRoomName(en)));

  const leadFix = { portalProfiles: [{ matchBand: "high", url: "https://x.booking.com/", rooms: [{ name: "Private Bathroom Twin Room", capacity: 2 }, { name: "Apartment with Sea View", capacity: 4 }] }] };
  const prHr = collectFallbacks(() => portalRooms(leadFix as never, { lang: "hr" }));
  check("portalRooms HR: nincs angol név a szobákban", prHr.value.rooms.every((r) => !/Room|Apartment/.test(r.name)), prHr.value.rooms);
  check("portalRooms HU: változatlan (magyar név)", portalRooms(leadFix as never, { lang: "hu" }).rooms[0]?.name === "Saját fürdőszobás ikerszoba");

  const PIX = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#8fa98c"/></svg>`).toString("base64");
  const base = {
    name: "Apartmani Lavanda", tagline: "", intro: "", highlights: [], contact: {},
    photos: [1, 2, 3, 4].map((i) => ({ url: `${PIX}#${i}`, alt: `foto ${i}` })),
    rooms: [{ name: "Private Bathroom Twin Room", capacity: "2", note: "2 Bunk beds" }, { name: "Apartment with Sea View", capacity: "4" }, { name: "Family Room", capacity: "5" }],
  };
  const { T: Tk } = await import("../src/engine/templateKit.js");
  const PENDING = ["Ikerszoba", "Apartman", "Családi szoba"].filter((k) => collectFallbacks(() => Tk({ lang: "hr" }, k)).fallbacks.length > 0);
  console.log(`   (Bábelre vár a hr csomagban: ${PENDING.join(", ") || "—"})`);
  let englishLeft = 0;
  let notReported = 0;
  for (const [id, tpl] of Object.entries(TEMPLATES)) {
    const recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] } as never;
    const r = collectFallbacks(() => renderSite(recipe, { ...base, lang: "hr" } as never, { phase: "mock" }));
    if (/Private Bathroom Twin Room|Apartment with Sea View|Family Room/.test(r.value)) englishLeft++;
    // A key the hr pack lacks (Hungarian shown) must be REPORTED; a translated one („Apartman” is Croatian too) is not a fallback.
    if (PENDING.some((k) => !r.fallbacks.includes(k))) notReported++;
  }
  check("⛔ HR mock: egyik sablonban sincs angol szobanév", englishLeft === 0, `${englishLeft} sablon`);
  check("⛔ magyar szó a horvát lapon csak JELENTETT fallbackként (a nyelvi kapu tartja, Bábelre vár)", notReported === 0, `${notReported} sablon`);
  const live = renderSite({ template: "parallax", skin: TEMPLATES.parallax!.skins[0]!, archetype: "stacked", sections: [] } as never, { ...base, lang: "hr" } as never, { phase: "live" });
  check("⛔ élő lapon a tulaj egységneve érintetlen", /Private Bathroom Twin Room/.test(live));
  const enHtml = renderSite({ template: "parallax", skin: TEMPLATES.parallax!.skins[0]!, archetype: "stacked", sections: [] } as never, { ...base, lang: "en" } as never, { phase: "mock" });
  check("⛔ angol mockon az angol név marad", /Private Bathroom Twin Room/.test(enHtml));

  // HR dev-próba 2026-11-23 (Elek): the generated alt „<név> — N. kép” (and the lightbox list) in the page language.
  const altBase = { ...base, photos: base.photos.map((p, i) => ({ ...p, alt: `Apartmani Lavanda — ${i + 1}. kép` })) };
  const pRecipe = { template: "parallax", skin: TEMPLATES.parallax!.skins[0]!, archetype: "stacked", sections: [{ kind: "hero" }, { kind: "gallery" }] } as never;
  const hrAlt = renderSite(pRecipe, { ...altBase, lang: "hr" } as never, { phase: "mock" });
  const huAlt = renderSite(pRecipe, { ...altBase, lang: "hu" } as never, { phase: "mock" });
  const slika = Tk({ lang: "hr" }, "{n}. kép", { n: 2 });
  check("HR mock: a generált alt a lap nyelvén (nincs „— N. kép”)", !/— \d+\. kép/.test(hrAlt) && (slika === "2. kép" || hrAlt.includes(`Apartmani Lavanda — ${slika}`)), slika);
  check("⛔ HU mock: a generált alt bájtra változatlan („— 2. kép”)", huAlt.includes("Apartmani Lavanda — 2. kép"));

  // HR dev-próba 2026-11-23 (Elek, IT): the guest's booking page / letter showed „Smještaj: A szállás egésze”.
  const { shownUnitName } = await import("../src/booking/requests.js");
  const { prepareMailLang } = await import("../src/i18n/mail.js");
  const hrMail = await prepareMailLang("hr");
  const whole = shownUnitName("A szállás egésze", hrMail);
  check("HR vendég: az alap-egység neve a levél nyelvén", whole !== "A szállás egésze" || hrMail === "hu", whole);
  check("⛔ a tulaj adta egységnév érintetlen, a lista tagonként", shownUnitName("Studio Lavanda, A szállás egésze", hrMail) === `Studio Lavanda, ${whole}` && shownUnitName("A szállás egésze", "hu") === "A szállás egésze");

  const mockFile = path.join(OUT, "hr-mock-parallax.html");
  writeFileSync(mockFile, renderSite({ template: "parallax", skin: TEMPLATES.parallax!.skins[0]!, archetype: "stacked", sections: [{ kind: "hero" }, { kind: "rooms" }] } as never, { ...base, lang: "hr" } as never, { phase: "mock" }));

  // ── ② tenant admin ──────────────────────────────────────────────────────────────────────
  console.log("② tenant-admin „Hirdeti máshol is?”: HR = Booking + Airbnb, HU / ország nélküli = mind a három");
  check("calendarSyncPortals: HR = Booking + Airbnb, HU = + Szállás.hu", JSON.stringify(calendarSyncPortals("HR")) === '["Booking.com","Airbnb"]' && JSON.stringify(calendarSyncPortals("HU")) === '["Booking.com","Szállás.hu","Airbnb"]', [calendarSyncPortals("HR"), calendarSyncPortals("HU")]);

  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "nemzc");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  async function tenant(tag: string, country: string | null, lang: string): Promise<{ cookie: string }> {
    const lead = await db.insertInto("lead")
      .values({ scrape_run_id: parent.runId, name: `Teszt ${tag}`, raw: sql`${JSON.stringify(country ? { country } : {})}::jsonb` } as never)
      .returning("id").executeTakeFirstOrThrow();
    const t = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `Teszt ${tag}` } as never).returning("id").executeTakeFirstOrThrow();
    const u = await db.insertInto("tenant_user").values({ tenant_id: t.id, contact_email: `${tag}@example.com`, username: `nemzc-${tag}-${Date.now()}` } as never).returning("id").executeTakeFirstOrThrow();
    const art = await db.insertInto("mock_artifact").values({
      lead_id: lead.id, status: "approved",
      inputs: sql`${JSON.stringify({
        recipe: { template: "editorial", skin: "editorial-warm", archetype: "classic", sections: [{ kind: "hero" }, { kind: "enquiry" }] },
        siteData: { name: `Teszt ${tag}`, tagline: "Teszt", intro: "Teszt.", highlights: ["Kert"], photos: [], contact: { email: `${tag}@example.com` }, lang },
      })}::jsonb`,
    } as never).returning("id").executeTakeFirstOrThrow();
    const site = await db.insertInto("site").values({
      tenant_id: t.id, preview_token: `nemzc${tag}${Date.now()}`, source_artifact_id: art.id, status: "provisioned", path: `sites/${t.id}/index.html`, slug: `nemzc-${tag}-${Date.now()}`,
    } as never).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("module_entitlement").values({ tenant_id: t.id, module: "booking", active: true } as never).execute();
    const { ensureUnits } = await import("../src/tenant/units.js");
    await ensureUnits(site.id);
    return { cookie: mintTenantCookieValue(u.id) };
  }
  const T_HU = await tenant("hu", "HU", "hu");
  const T_LEG = await tenant("leg", null, "hu");
  const T_HR = await tenant("hr", "HR", "hr");

  const { server } = (await import("../src/server/public.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("nincs szerver-cím");
  const BASE = `http://localhost:${addr.port}`;

  async function card(who: { cookie: string }, width: number, shot?: string): Promise<{ html: string; tabs: string[]; cards: string; lead: string; errors: string[] }> {
    const ctx = await browser.newContext({ viewport: { width, height: 950 } });
    await ctx.addCookies([{ name: "cit_session", value: who.cookie, url: BASE }]);
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/admin?tab=modulok&m=booking`, { waitUntil: "networkidle" });
    const el = page.locator("#portal-naptar");
    const n = await el.count();
    const html = n ? await el.evaluate((e) => e.outerHTML) : "";
    const tabs = n ? await el.locator(".pguide__tab").allInnerTexts() : [];
    const cards = n ? (await el.locator(".psync").innerText()) : "";
    const lead = n ? await el.locator(".adm-lead").first().innerText() : "";
    if (shot && n) {
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(OUT, `${shot}.png`) });
    }
    await ctx.close();
    return { html, tabs, cards, lead, errors };
  }

  const hu1 = await card(T_HU, 1280, "admin-hu-desktop");
  const leg = await card(T_LEG, 1280);
  check("HU: a kártya megvan, a fül-sor Booking.com · Szállás.hu · Airbnb", hu1.tabs.join("|") === "Booking.com|Szállás.hu|Airbnb", hu1.tabs);
  check("HU: a régi bevezető mondat (Szállás.hu-val)", /Booking\.com-on, a Szállás\.hu-n vagy az Airbnb-n/.test(hu1.lead), hu1.lead);
  // Per-tenant ids/tokens (unit id, feed token, slug) differ by construction — masked; the rest is byte-for-byte.
  const mask = (h: string): string => h.replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>").replaceAll(/\/(?:ical|naptar)\/[^"'\s<\/]+/g, "/feed/<tok>").replaceAll(/nemzc-?[a-z]+-?\d+/g, "<slug>");
  const [mh, ml] = [mask(hu1.html), mask(leg.html)];
  const at = [...mh].findIndex((c, i) => c !== ml[i]);
  check("⛔ HU (ország-sorral) = ország nélküli régi tenant, bájtra (a kártya HTML-je)", mh.length > 0 && mh === ml, at < 0 ? "hossz" : `${mh.slice(at - 60, at + 60)} ≠ ${ml.slice(at - 60, at + 60)}`);

  for (const [width, tag] of [[390, "mobile"], [1280, "desktop"]] as const) {
    const hr = await card(T_HR, width, `admin-hr-${tag}`);
    check(`HR ${width}px: a kártya megvan`, hr.html.length > 0);
    check(`HR ${width}px: útmutató-fülek = Booking.com · Airbnb`, hr.tabs.join("|") === "Booking.com|Airbnb", hr.tabs);
    check(`HR ${width}px: ⛔ Szállás.hu sehol a kártyában`, !/Szállás\.hu|szallas\.hu/i.test(hr.html));
    check(`HR ${width}px: JS-hiba nincs`, hr.errors.length === 0, hr.errors.join(" | "));
    if (width === 1280) console.log(`   (HR bevezető: ${hr.lead.slice(0, 140)}…)`);
    if (width === 390) await card(T_HU, 390, "admin-hu-mobile");
  }

  // Mock shots (the HR mock file rendered above).
  for (const [width, tag] of [[390, "mobile"], [1280, "desktop"]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(`file://${mockFile}`, { waitUntil: "load" });
    await page.screenshot({ path: path.join(OUT, `hr-mock-${tag}.png`), fullPage: true });
    await ctx.close();
  }
  console.log(`   képek: ${path.relative(process.cwd(), OUT)}/`);
} finally {
  await browser.close();
  await db.destroy();
}

console.log(fails ? `\n⛔ nemzetkozi-c-felulet-check: ${fails}/${total} hiba` : `\n✅ nemzetkozi-c-felulet-check: ${total} ellenőrzés zöld`);
process.exit(fails ? 1 : 0);
