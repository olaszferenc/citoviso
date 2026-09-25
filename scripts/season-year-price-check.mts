// ⛔⛔ AZ ÉVHEZ KÖTÖTT SZEZONÁR ŐRE — kontraktus: assets/design-refs/tenant-admin/season-year-price/
// (tulajdonosi jóváhagyás 2026-09-23, B·1 „kilógó kártya”; + fel/le sorrend, parent_id,
// season_nudged_year, és NINCS „lejár egy ár” levél az évre szóló szezonra).
//
// A MÉRT TÉNYÁLLÁS, amiért létezik (ADR-0208 ③): a szezon `MM-DD`, év nélkül, ezért a 12
// hónapos foglalási horizonton belül 2027 júliusára ugyanaz az ár fagyott be, mint idénre.
// A 0072 az adatot és a szabályt megadta, a FELÜLET hiányzott. Ez az őr a láncot méri:
//   ① adat-réteg — normalizálás, évre szóló ár (visszaeséssel), saját napok, szerkesztés
//      (a követő éves ár viszi a napokat, a saját napos nem), sorrend (a feljebb álló nyer),
//      kaszkád-törlés;
//   ② Árazás lap — valódi HTTP + böngésző, MINDKÉT méreten: évsáv, kilógó kártya, végtelen
//      görgetés, nyilak, szerkesztő, élő előnézet (átnyúló dátum + átfedés), kártya-mentés
//      a böngészőből, a levél-linkre ugrás és fókusz, JS-hiba = 0;
//   ③ honlap-ártábla — évet csak az éves árú szezon kap, év nélküli sora NEM marad;
//   ④ szezon végi kérdés — a döntés-függvény naptárakon, majd DB-n: egyszer, reggel, 7 napon
//      belül, és nem, ha a jövő évi ár megvan; a „lejár egy ár” levél az éves szezonra nem megy.
//
// ⭐ POZITÍV KONTROLL mindenhol, ahol „nincs” az állítás: a lejárat-levél a DÁTUMOS ALAPÁRRA
// továbbra is kimegy (különben az „éves szezonra nem megy” üresen zöld); a nudge egy esetben
// TÉNYLEG kimegy (különben a „nem megy ki” ágak üresen zöldek).
//
// Eldobható fixtúra; a levelek @example.com címre mennek (outbox/), a nudge a fixtúra
// site-jára szűkítve fut — a közös dev-DB más tenantjait nem bélyegzi és nem levelezi.
//
//   npx tsx scripts/season-year-price-check.mts

process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
// ⛔ A söprés (maintainDatedPrices) a tulajdonosnak LEVELET küld; dev-ben EMAIL_PROVIDER=smtp
// él, és a park 6 tenant-usere valódi (gmail) címet visel — a kapu minden commiton valódi
// levelet küldhetett volna (mérve 2026-09-25: 0 ment ki, a lyuk ettől még nyitva volt). A mock
// adapter outbox/-ba ír. A dinamikus import ELŐTT kell (a config az env-et betöltéskor olvassa).
// Őr: scripts/server-import-env-check.mts (③ e-mail szabály).
process.env.EMAIL_PROVIDER = "mock";

import { once } from "node:events";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCOPE = path.basename(ROOT); // worktree-unique scratch key: assets/Temp is a SYMLINK shared by every worktree
const OUT = path.join(ROOT, `assets/Temp/_season-year-price-${SCOPE}`);
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const P = await import("../src/tenant/prices.js");
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const { maintainDatedPrices } = await import("../src/tenant/priceExpiry.js");
const { maintainSeasonNudges, nudgeDue } = await import("../src/tenant/seasonNudge.js");
const { seasonRule } = await import("../src/tenant/seasonRule.js");

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
async function mailsTo(who: string): Promise<Mail[]> {
  await new Promise((r) => setTimeout(r, 500));
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
    out.push({ to, subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "", body: raw.slice(raw.indexOf("\n\n") + 2), file: f });
  }
  return out;
}
const seen = new Set<string>();
const fresh = (all: Mail[]): Mail[] => {
  const n = all.filter((m) => !seen.has(m.file));
  n.forEach((m) => seen.add(m.file));
  return n;
};
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const at = (iso: string, hour = 8): Date => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`);
const isoNice = (iso: string): string => `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
const onNight = async (unitId: string, iso: string): Promise<number | null> =>
  P.priceOn(await P.getUnitPrices(unitId), iso)?.amount ?? null;

try {
  await mkdir(OUT, { recursive: true });
  const stamp = Date.now().toString(36);
  const OWNER = `owner-${stamp}@example.com`;
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = Number(today.slice(0, 4));

  // ── fixture ───────────────────────────────────────────────────────────────
  const def = await db.insertInto("scraper_definition").values({ label: "_syp", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_syp lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Nyárfa Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `syp-${stamp}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `syp_${stamp}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Nyárfa Vendégház", intro: "Szezonár-teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 2.", email: OWNER }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const kert = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kertre néző apartman", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const fahaz = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kis faház", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `syp_${stamp}`, contact_email: OWNER, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await P.setBasePrice(kert.id, 19_000);
  await P.setBasePrice(fahaz.id, 15_000);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms", "gallery"]);

  // ── ① adat-réteg ──────────────────────────────────────────────────────────
  console.log("\n① Adat-réteg");
  const norm: [string, string | null][] = [
    ["11-01", "11-01"], ["11.01", "11-01"], ["11. 01.", "11-01"], ["11/1", "11-01"], ["1101", "11-01"], ["6.1", "06-01"],
    ["13-01", null], ["02-30", null], ["abc", null], ["", null], ["02-29", "02-29"],
  ];
  for (const [raw, want] of norm) check(`normMonthDay(${JSON.stringify(raw)}) = ${want}`, P.normMonthDay(raw) === want, P.normMonthDay(raw));

  const main = await P.addSeasonPrice(kert.id, "Főszezon", "06-15", "08-31", 28_000, 3);
  const off = await P.addSeasonPrice(kert.id, "Holtszezon", "11.01", "03.01", 16_000);
  const xmas = await P.addSeasonPrice(fahaz.id, "Ünnepek", "12-20", "01-05", 22_000, 2);
  const winter = await P.addSeasonPrice(fahaz.id, "Téli ár", "11-15", "02-28", 13_000);
  check("a szezonok felvéve (a „11.01” alak is)", main.ok && off.ok && xmas.ok && winter.ok, [main, off, xmas, winter]);
  const find = async (unit: string, label: string) => (await P.getUnitPrices(unit)).find((r) => r.label === label && !r.parentId && !r.validFrom)!;
  const sMain = await find(kert.id, "Főszezon");
  const sOff = await find(kert.id, "Holtszezon");
  const sXmas = await find(fahaz.id, "Ünnepek");
  const sWinter = await find(fahaz.id, "Téli ár");
  check("a „11.01 – 03.01” 11-01 – 03-01-ként tárolva", sOff.from === "11-01" && sOff.to === "03-01", sOff);

  const yMain = seasonRule.firstOpenYear("06-15", "08-31", today);
  const r1 = await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain, amount: "35 000" });
  check(`éves ár: Főszezon ${yMain} = 35 000`, r1.ok, r1);
  const child = (await P.getUnitPrices(kert.id)).find((r) => r.parentId === sMain.id);
  check("…a sor a szezonhoz kötve, az adott évi ablakkal", child?.validFrom === `${yMain}-06-15` && child?.validTo === `${yMain}-08-31` && child?.from === "06-15", child);
  check(`…${yMain}-07-10 éjszakája 35 000`, (await onNight(kert.id, `${yMain}-07-10`)) === 35_000);
  check(`…${yMain + 1}-07-10 éjszakája VISSZAESIK a 28 000-re`, (await onNight(kert.id, `${yMain + 1}-07-10`)) === 28_000);
  check(`…${yMain}-09-10 (szezonon kívül) az alapár`, (await onNight(kert.id, `${yMain}-09-10`)) === 19_000);
  const again = await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain, amount: "36000" });
  const kids = (await P.getUnitPrices(kert.id)).filter((r) => r.parentId === sMain.id);
  check("egy szezon × év = egy sor (a második felülírja)", again.ok && kids.length === 1 && kids[0]!.amount === 36_000, kids);
  await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain, amount: "35000" });

  const yOff = seasonRule.firstOpenYear("11-01", "03-01", today);
  const r2 = await P.setSeasonYearPrice(site.id, sOff.id, { year: yOff, amount: "15.000", from: "10.15", to: "03-01" });
  const offChild = (await P.getUnitPrices(kert.id)).find((r) => r.parentId === sOff.id);
  check(`saját napok: Holtszezon ${yOff}/${String(yOff + 1).slice(2)} 10-15-től, évhatáron át`, r2.ok && offChild?.validFrom === `${yOff}-10-15` && offChild?.validTo === `${yOff + 1}-03-01` && offChild?.amount === 15_000, offChild);
  check(`…${yOff}-10-20 éjszakája 15 000 (a saját nap nyit)`, (await onNight(kert.id, `${yOff}-10-20`)) === 15_000);
  check(`…${yOff + 1}-10-20 éjszakája az alapár (más évben nincs saját nap)`, (await onNight(kert.id, `${yOff + 1}-10-20`)) === 19_000);

  const bad1 = await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain + 1, amount: "abc" });
  check("hibás összeg → visszautasítva, üzenettel", !bad1.ok && bad1.errors.length === 1, bad1);
  const bad2 = await P.setSeasonYearPrice(site.id, sMain.id, { year: thisYear - 1, amount: "30000" });
  check("lezajlott év → visszautasítva", !bad2.ok && bad2.errors.length === 1, bad2);
  const bad3 = await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain + 1, amount: "30000", from: "13-01", to: "08-31" });
  check("lehetetlen nap → visszautasítva", !bad3.ok, bad3);
  const foreign = await P.setSeasonYearPrice("00000000-0000-0000-0000-000000000000", sMain.id, { year: yMain + 1, amount: "30000" });
  check("idegen site szezonjára nem írható", !foreign.ok);
  await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain + 2, amount: "40000" });
  const cleared = await P.setSeasonYearPrice(site.id, sMain.id, { year: yMain + 2, amount: "" });
  check("üres összeg saját nap nélkül → az éves ár törlődik, az ismétlődő él", cleared.ok && cleared.cleared === true && (await onNight(kert.id, `${yMain + 2}-07-10`)) === 28_000);

  // edit: the following year price moves with the days, the own-days one keeps them
  const e1 = await P.updateSeasonPrice(site.id, sMain.id, { label: "Nyári főszezon", from: "6.1", to: "0915", amount: 29_000, minNights: 4 });
  const afterMain = await P.getUnitPrices(kert.id);
  const mainRow = afterMain.find((r) => r.id === sMain.id)!;
  const mainKid = afterMain.find((r) => r.parentId === sMain.id)!;
  check("szerkesztés: név, napok (normalizálva), ár, minimum", e1.ok && mainRow.label === "Nyári főszezon" && mainRow.from === "06-01" && mainRow.to === "09-15" && mainRow.amount === 29_000 && mainRow.minNights === 4, mainRow);
  check("…a követő éves ár az új napokra költözik, az ára marad", mainKid.validFrom === `${yMain}-06-01` && mainKid.validTo === `${yMain}-09-15` && mainKid.amount === 35_000 && mainKid.label === "Nyári főszezon", mainKid);
  const e2 = await P.updateSeasonPrice(site.id, sOff.id, { label: "Holtszezon", from: "11-05", to: "03-01", amount: 16_000, minNights: null });
  const offKid = (await P.getUnitPrices(kert.id)).find((r) => r.parentId === sOff.id)!;
  check("…a SAJÁT napos éves ár megtartja a napjait", e2.ok && offKid.validFrom === `${yOff}-10-15` && offKid.from === "10-15", offKid);
  const e3 = await P.updateSeasonPrice(site.id, sOff.id, { label: "", from: "11-05", to: "3.1", amount: 0, minNights: 99 });
  check("hibás szerkesztés → mind a három hiba megnevezve, semmi nem íródik", !e3.ok && e3.errors.length === 3 && (await find(kert.id, "Holtszezon")).amount === 16_000, e3);

  // order: where two seasons share days, the one higher on the list prices them
  const xmasNight = `${seasonRule.firstOpenYear("12-20", "01-05", today)}-12-25`;
  check("sorrend: az Ünnepek áll feljebb → karácsonykor 22 000", (await onNight(fahaz.id, xmasNight)) === 22_000);
  await P.moveSeasonPrice(site.id, sWinter.id, -1);
  check("…a Téli ár feljebb lépve → karácsonykor 13 000", (await onNight(fahaz.id, xmasNight)) === 13_000);
  await P.moveSeasonPrice(site.id, sWinter.id, 1);
  check("…visszalépve → 22 000", (await onNight(fahaz.id, xmasNight)) === 22_000);

  // ── ② Árazás lap ───────────────────────────────────────────────────────────
  console.log("\n② Az Árazás lap — valódi HTTP + böngésző, mindkét méreten");
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const browser = await chromium.launch();
  const errs: string[] = [];
  const firstLabel = seasonRule.occurrence("06-01", "09-15", yMain).label;
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tu.id), url: BASE }]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(`${label}: ${e.message}`));
    await page.goto(`${BASE}/admin?tab=modulok&m=pricing`, { waitUntil: "networkidle" });
    const block = page.locator(`#s-${sMain.id}`);
    const strip = block.locator("[data-strip]");
    check(`${label}: a Nyári főszezon alatt ott az évsáv`, (await strip.count()) === 1);
    const card = block.locator(`#ev-${sMain.id}-${yMain}`);
    check(`${label}: a ${yMain}-es kártya „saját ár” 35 000-rel`, /saját ár/i.test(await card.innerText()) && (await card.locator('input[name="amount"]').inputValue()) === "35 000");
    check(`${label}: a fejléc az első nyitott évet mondja`, (await block.locator("[data-ys-t]").innerText()).includes(firstLabel));
    check(`${label}: a nyilak látszanak (a szkript él)`, await block.locator("[data-ys-next]").isVisible());
    const peek = await strip.evaluate((st) => {
      const r = st.getBoundingClientRect();
      return [...st.querySelectorAll(".ys-cell")].some((c) => { const b = c.getBoundingClientRect(); return b.left < r.right - 20 && b.right > r.right; });
    });
    check(`${label}: a következő kártya kilóg jobbra (látszik, hogy van még)`, peek);
    const n0 = await strip.locator(".ys-cell").count();
    for (let i = 0; i < 5; i++) {
      await strip.evaluate((st) => { st.scrollLeft = st.scrollWidth; });
      await page.waitForTimeout(120);
    }
    const n1 = await strip.locator(".ys-cell").count();
    check(`${label}: végtelen görgetés (${n0} → ${n1} kártya)`, n1 >= n0 + 8, { n0, n1 });
    await strip.evaluate((st) => { st.scrollLeft = 0; });
    await page.waitForTimeout(100);
    await block.locator("[data-ys-next]").click();
    await page.waitForTimeout(700);
    check(`${label}: a jobb nyíl egy évet lép`, (await block.locator("[data-ys-t]").innerText()).includes(String(yMain + 1)), await block.locator("[data-ys-t]").innerText());
    const wrapCard = page.locator(`#ev-${sOff.id}-${yOff}`);
    check(`${label}: az átnyúló szezon kártyája „${yOff}/${String(yOff + 1).slice(2)}”, saját napokkal`, (await wrapCard.innerText()).includes(`${yOff}/${String(yOff + 1).slice(2)}`) && /saját napok/.test(await wrapCard.innerText()));
    check(`${label}: az „átnyúlik az év végén” jelölés a soron`, /átnyúlik az év végén/i.test(await page.locator(`#s-${sOff.id}`).innerText()));
    // add form: live preview of a wrapping season + the overlap note
    const add = page.locator(".adm-card", { hasText: "Kis faház" }).locator("[data-sadd]");
    await add.locator('input[name="from"]').fill("11.01");
    await add.locator('input[name="to"]').fill("03.01");
    const pv = await add.locator("[data-sprev]").innerText();
    const ex = seasonRule.occurrence("11-01", "03-01", seasonRule.firstOpenYear("11-01", "03-01", today));
    check(`${label}: előnézet — „${isoNice(ex.start)} – ${isoNice(ex.end)}”, átnyúlik`, pv.includes(`${isoNice(ex.start)} – ${isoNice(ex.end)}`) && /Átnyúlik/.test(pv), pv);
    check(`${label}: előnézet — átfedés MINDKÉT időszakkal, a győztes megnevezve`, /Ünnepek/.test(pv) && /Téli ár/.test(pv) && /feljebb álló/.test(pv), pv);
    check(`${label}: előnézet — nincs dupla pont`, !/\.\./.test(pv), pv);
    await add.locator('input[name="from"]').fill("13-01");
    check(`${label}: lehetetlen napra hibaüzenet az előnézetben`, /hónap-nap/.test(await add.locator("[data-sprev]").innerText()));
    await page.locator(`#s-${sMain.id}`).screenshot({ path: path.join(OUT, `evsav-${label}.png`) });
    // edit
    await page.goto(`${BASE}/admin?tab=modulok&m=pricing&edit=${sMain.id}#s-${sMain.id}`, { waitUntil: "networkidle" });
    const ed = page.locator(`[data-sedit="${sMain.id}"]`);
    check(`${label}: a Szerkesztés az adott szezon helyén nyílik, kitöltve`, (await ed.count()) === 1 && (await ed.locator('input[name="label"]').inputValue()) === "Nyári főszezon");
    check(`${label}: a szerkesztő kimondja, hogy az éves ár megmarad`, /megmaradnak/.test(await ed.innerText()));
    await ed.screenshot({ path: path.join(OUT, `szerkesztes-${label}.png`) });
    // the mail link: #ev-<season>-<year> brings the card into view, cursor in its field
    await page.goto(`${BASE}/admin?tab=modulok&m=pricing#ev-${sMain.id}-${yMain + 1}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.closest("form")?.id ?? `${document.activeElement?.tagName}|${location.hash}|${!!document.getElementById(location.hash.slice(1))}`);
    check(`${label}: a levél-link a ${yMain + 1}-es kártyára ugrik, a kurzor az ár-mezőben`, focused === `ev-${sMain.id}-${yMain + 1}`, focused);
    await ctx.close();
  }
  // The mail link WITHOUT a session (a phone opens it in another browser): the login
  // must bring the owner back to the very card, cursor in its field (owner, 2026-09-24).
  {
    const { hashPassword } = await import("../src/auth/tenantAuth.js");
    await db.updateTable("tenant_user").set({ password_hash: hashPassword("szezon-teszt-42") }).where("id", "=", tu.id).execute();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(`belépés: ${e.message}`));
    const target = `/admin?tab=modulok&m=pricing#ev-${sMain.id}-${yMain + 1}`;
    await page.goto(`${BASE}${target}`, { waitUntil: "networkidle" });
    const u1 = new URL(page.url());
    check("levél-link belépés nélkül → a belépő oldal, a céllal (next)", u1.pathname === "/login" && u1.searchParams.get("next") === "/admin?tab=modulok&m=pricing", page.url());
    check("…a kártya-horgony (#) is megmaradt", u1.hash === `#ev-${sMain.id}-${yMain + 1}`, u1.hash);
    await page.fill("#username", `syp_${stamp}`);
    await page.fill("#password", "szezon-teszt-42");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click('button[type="submit"]')]);
    await page.waitForTimeout(300);
    const u2 = new URL(page.url());
    check("belépés után a linkelt lapra ér (nem a kezdőlapra)", u2.pathname === "/admin" && u2.search === "?tab=modulok&m=pricing" && u2.hash === `#ev-${sMain.id}-${yMain + 1}`, page.url());
    const foc = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest("form")?.id ?? "");
    check(`…és a ${yMain + 1}-es kártyán áll a kurzor`, foc === `ev-${sMain.id}-${yMain + 1}`, foc);
    await page.screenshot({ path: path.join(OUT, "level-link-belepes-utan-mobil.png") });
    await ctx.close();
    // ⛔ never an open redirect: a foreign target lands on the plain admin
    for (const evil of ["//evil.example/x", "https://evil.example/", "/admin//evil.example", "/admin\\evil", "/login"]) {
      const r = await fetch(`${BASE}/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: `syp_${stamp}`, password: "szezon-teszt-42", next: evil }).toString(),
      });
      check(`nyitott átirányítás nincs: next=${JSON.stringify(evil)} → /admin`, r.status === 302 && r.headers.get("location") === "/admin", { status: r.status, loc: r.headers.get("location") });
    }
    // positive control for the same probe: a real /admin target IS honoured
    const ok = await fetch(`${BASE}/login`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: `syp_${stamp}`, password: "szezon-teszt-42", next: "/admin?tab=modulok&m=pricing#ev-x-1" }).toString(),
    });
    check("⭐ pozitív kontroll: egy /admin cél viszont érvényes", ok.headers.get("location") === "/admin?tab=modulok&m=pricing#ev-x-1", ok.headers.get("location"));
  }
  // a year card saved from the browser (the real form, the real route)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tu.id), url: BASE }]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(`mentés: ${e.message}`));
    await page.goto(`${BASE}/admin?tab=modulok&m=pricing#ev-${sMain.id}-${yMain + 1}`, { waitUntil: "networkidle" });
    const c = page.locator(`#ev-${sMain.id}-${yMain + 1}`);
    await c.locator('input[name="amount"]').fill("38 000");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), c.locator('button[type="submit"]').first().click()]);
    const c2 = page.locator(`#ev-${sMain.id}-${yMain + 1}`);
    check("böngészős mentés: a kártya „saját ár” lett, visszajelzéssel", /saját ár/i.test(await c2.innerText()) && /Mentve/.test(await c2.innerText()), await c2.innerText());
    check("…a DB-ben ott az éves sor", (await onNight(kert.id, `${yMain + 1}-07-10`)) === 38_000);
    await c2.locator('input[name="amount"]').fill("abc");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), c2.locator('button[type="submit"]').first().click()]);
    const c3 = page.locator(`#ev-${sMain.id}-${yMain + 1}`);
    check("böngészős hibás összeg: a hiba A KÁRTYÁN áll, nem a lap tetején", /számmal/.test(await c3.innerText()) && (await page.locator(".mcfg-err").count()) === 0, await c3.innerText());
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.locator(`#ev-${sMain.id}-${yMain + 1} button[value="clear"]`).click()]);
    check("„Vissza az ismétlődőre” → az éves sor törölve", (await onNight(kert.id, `${yMain + 1}-07-10`)) === 29_000);
    await ctx.close();
  }
  check("JS-hiba az Árazás lapon: 0", errs.length === 0, errs);

  // ── ③ honlap-ártábla ──────────────────────────────────────────────────────
  console.log("\n③ A honlap ártáblája");
  await rerenderTenantSnapshot(tenant.id, { as: "live" });
  for (const [label, width] of [["mobil", 390], ["asztali", 1280]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/t/${slug}/`, { waitUntil: "networkidle" });
    const sec = page.locator('[data-cit-module="pricing"]').first();
    // textContent per cell, tab-joined: the runtime hides every unit but one behind a tab,
    // and innerText of a hidden row loses its cell breaks.
    const rows = await sec.locator("table tbody tr").evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()).join("\t")),
    );
    const mainRows = rows.filter((r) => /Nyári főszezon/i.test(r));
    check(`${label}: a Nyári főszezon évvel szerepel, a saját árával`, mainRows.some((r) => r.includes(`Nyári főszezon ${yMain}`) && /35\s000/.test(r)), mainRows);
    check(`${label}: …és NINCS év nélküli sora (az idei árat ígérné jövőre is)`, mainRows.every((r) => /\d{4}/.test(r.split("\t")[0] ?? r)), mainRows);
    check(`${label}: az Ünnepek (nincs éves ára) év nélküli sor marad`, rows.some((r) => /^Ünnepek\s/i.test(r) && !/Ünnepek \d{4}/.test(r)), rows);
    await sec.screenshot({ path: path.join(OUT, `artabla-${label}.png`) });
    await ctx.close();
  }
  await browser.close();

  // ── ④ szezon végi kérdés + lejárat ─────────────────────────────────────────
  console.log("\n④ A szezon végi kérdés");
  const S = { from: "06-15", to: "08-31", nudgedYear: null };
  const no = (): boolean => false;
  check("döntés: a záró nap utáni reggelen esedékes", JSON.stringify(nudgeDue(S, "2027-09-01", no)) === JSON.stringify({ endedYear: 2027, endedOn: "2027-08-31", nextYear: 2028 }), nudgeDue(S, "2027-09-01", no));
  check("döntés: a záró napon még NEM", nudgeDue(S, "2027-08-31", no) === null);
  check("döntés: 7 napon belül még igen, a 8. napon már nem", nudgeDue(S, "2027-09-07", no) !== null && nudgeDue(S, "2027-09-08", no) === null);
  check("döntés: szezon közben nem", nudgeDue(S, "2027-07-10", no) === null);
  check("döntés: ha arról az évről már kérdeztünk, nem", nudgeDue({ ...S, nudgedYear: 2027 }, "2027-09-01", no) === null);
  check("döntés: ha a jövő évi ár megvan, nem", nudgeDue(S, "2027-09-01", (y) => y === 2028) === null);
  check("döntés: évhatáron átnyúló szezon (11-01 – 03-01) a márc. 2-i reggelen, a 2026-os alkalomról", nudgeDue({ from: "11-01", to: "03-01", nudgedYear: null }, "2027-03-02", no)?.endedYear === 2026);
  // Every day of two calendar years: exactly one due day per season-year inside the window
  // start, i.e. the rule never fires twice for one year once stamped.
  let firstDays = 0;
  for (let i = 0; i < 730; i++) {
    const d = addDays("2027-01-01", i);
    const due = nudgeDue(S, d, no);
    const prev = nudgeDue(S, addDays(d, -1), no);
    if (due && (!prev || prev.endedYear !== due.endedYear)) firstDays++;
  }
  check("730 nap: évente pontosan egy első esedékes nap", firstDays === 2, firstDays);

  // DB: the Ünnepek season (no year price for next year) gets exactly one mail
  const yx = seasonRule.firstOpenYear("12-20", "01-05", today);
  const endX = seasonRule.occurrence("12-20", "01-05", yx).end;
  fresh(await mailsTo(OWNER));
  check("9 nappal a vége után: nem megy ki", (await maintainSeasonNudges(at(addDays(endX, 9)), { siteId: site.id })).sent === 0);
  check("a záró nap utáni hajnalban (03:00 UTC) még nem", (await maintainSeasonNudges(at(addDays(endX, 1), 3), { siteId: site.id })).sent === 0);
  const n1 = await maintainSeasonNudges(at(addDays(endX, 1)), { siteId: site.id });
  const got = fresh(await mailsTo(OWNER));
  const xm = got.find((m) => m.subject.includes("Ünnepek"));
  check("⭐ pozitív kontroll: a záró nap utáni reggelen kimegy", n1.sent >= 1 && !!xm, { n1, subjects: got.map((m) => m.subject) });
  check("…tárgy: „Véget ért: Ünnepek — mi legyen jövőre az ára?”", xm?.subject === "Véget ért: Ünnepek — mi legyen jövőre az ára?", xm?.subject);
  check("…„Tegnap véget ért”, az idei ár, és „nem kell tennie semmit”", /Tegnap véget ért/.test(xm?.body ?? "") && /22\s000/.test(xm?.body ?? "") && /nem kell tennie semmit/.test(xm?.body ?? ""), xm?.body);
  check(`…a link a ${yx + 1}-es kártyára visz`, (xm?.body ?? "").includes(`#ev-${sXmas.id}-${yx + 1}`), xm?.body);
  const stampRow = await db.selectFrom("unit_price").select("season_nudged_year").where("id", "=", sXmas.id).executeTakeFirst();
  check("…bélyeg: season_nudged_year = a lezajlott év", stampRow?.season_nudged_year === yx, stampRow);
  const n2 = await maintainSeasonNudges(at(addDays(endX, 2)), { siteId: site.id });
  check("másnap NEM megy ki újra (egy szezon × év = egy levél)", n2.sent === 0 && !fresh(await mailsTo(OWNER)).some((m) => m.subject.includes("Ünnepek")), n2);
  // Téli ár: next year already priced → no question
  const yw = seasonRule.firstOpenYear("11-15", "02-28", today);
  await P.setSeasonYearPrice(site.id, sWinter.id, { year: yw + 1, amount: "14000" });
  const endW = seasonRule.occurrence("11-15", "02-28", yw).end;
  await maintainSeasonNudges(at(addDays(endW, 1)), { siteId: site.id });
  check("ha a jövő évi ár megvan, a kérdés nem megy ki", !fresh(await mailsTo(OWNER)).some((m) => m.subject.includes("Téli ár")));

  console.log("\n④ A lejárat — az éves szezonra nincs „lejár egy ár” levél");
  // Positive control first: a DATED BASE still gets its reminder.
  await P.addDatedBasePrice(fahaz.id, 17_000, addDays(today, -3), addDays(today, 5));
  await db.updateTable("unit_price").set({ valid_from: addDays(today, -10), valid_to: addDays(today, 5), expiry_notified_at: null }).where("id", "=", offKid.id).execute();
  fresh(await mailsTo(OWNER));
  await maintainDatedPrices(today);
  const exp = fresh(await mailsTo(OWNER));
  check("⭐ pozitív kontroll: a dátumos alapár emlékeztetője kimegy", exp.some((m) => /Hamarosan lejár egy ár: Kis faház/.test(m.subject)), exp.map((m) => m.subject));
  check("az éves szezonra (Holtszezon) NEM megy „lejár egy ár”", !exp.some((m) => /Kertre néző/.test(m.subject)), exp.map((m) => m.subject));
  const stillNull = await db.selectFrom("unit_price").select("expiry_notified_at").where("id", "=", offKid.id).executeTakeFirst();
  check("…és nincs is lebélyegezve", stillNull?.expiry_notified_at === null, stillNull);
  await db.updateTable("unit_price").set({ valid_from: addDays(today, -10), valid_to: addDays(today, -1) }).where("id", "=", offKid.id).execute();
  await maintainDatedPrices(today);
  const afterLapse = await P.getUnitPrices(kert.id);
  check("lejárt éves ár: a sor lekerül, az ismétlődő szezon marad", !afterLapse.some((r) => r.id === offKid.id) && afterLapse.some((r) => r.id === sOff.id));

  // cascade
  await P.deletePrice(site.id, sMain.id);
  check("a szezon törlése az éves árait is viszi (ON DELETE CASCADE)", !(await P.getUnitPrices(kert.id)).some((r) => r.parentId === sMain.id));
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
console.log(fail ? `\n⛔ SEASON-YEAR-PRICE: ${fail} bukás` : "\n🟢 SEASON-YEAR-PRICE: az évhez kötött szezonár a jóváhagyott B·1 tervet követi");
process.exit(fail ? 1 : 0);
