/**
 * Guard of the weekly program recommender's picker (tenant admin, `poi`), measured
 * on the REAL screen served by THIS worktree — not on the draft.
 *
 *   npx tsx scripts/programs-editor-check.mts
 *
 * The approved contract (assets/design-refs/console/programajanlo/README.md) says the
 * guard must cover its measured list "nem kevesebbet". Every line of that list is
 * asserted here, plus what the draft could not measure: the save round trip (order
 * and rewritten title READ BACK after reload), the mobile tab counters, and the
 * forbidden left/right wording.
 *
 * OWN DISPOSABLE FIXTURE (not a real tenant): gathered programs EXPIRE in two weeks and
 * the shared park changes under us, so a guard leaning on a real pool would turn red
 * by the calendar, not by a defect. The fixture seeds its own lead/tenant/site and a
 * two-settlement circle with 14 programs in north-east Hungary (negative OSM ids, far
 * from every real circle AND from module-config-check's fixture), and removes every
 * row and the rendered site files at the end, pass or fail.
 */
import { once } from "node:events";
import type { Server } from "node:http";

(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
process.env.CIT_SHOT = "1"; // no boot self-heal side effects
process.env.PUBLIC_PORT = "0";

const { chromium } = await import("playwright-core");
const { config } = await import("../src/config.js");
const { db, pool } = await import("../src/db/client.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { siteProgramPool } = await import("../src/events/picks.js");
const { server } = (await import("../src/server/public.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;

let fails = 0;
function ok(cond: boolean, msg: string): void {
  console.log(`${cond ? "  ok " : "  FAIL"} ${msg}`);
  if (!cond) fails++;
}

const { sql } = await import("kysely");
const { rm } = await import("node:fs/promises");
const path = await import("node:path");
const OWN = "-990101";
const NEAR = "-990102";
const STAMP = Date.now();
const ids: { def?: string; run?: string; lead?: string; tenant?: string; site?: string } = {};
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const plus = (n: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function seed() {
  const def = await db.insertInto("scraper_definition")
    .values({ label: "programs-editor", country: "HU", region: "pe", industry: "szallas" } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.def = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.run = run.id;
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_Programajánló őr", raw: sql`'{}'::jsonb`, lat: 48.0, lng: 22.0, address: "Fő utca 1, _Peofalva" } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.lead = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "_Programajánló őr" } as never)
    .returning("id").executeTakeFirstOrThrow();
  ids.tenant = tenant.id;
  const user = await db.insertInto("tenant_user")
    .values({ tenant_id: tenant.id, contact_email: "pe-teszt@example.com", username: `pe-teszt-${STAMP}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const artifact = await db.insertInto("mock_artifact").values({
    lead_id: lead.id,
    status: "approved",
    inputs: sql`${JSON.stringify({
      recipe: { template: "editorial", skin: "editorial-warm", archetype: "classic", sections: [{ kind: "hero" }] },
      siteData: { name: "_Programajánló őr", tagline: "Teszt", intro: "Teszt szállás az őrhöz.", highlights: ["Kert"], photos: [], contact: { email: "pe-teszt@example.com" } },
    })}::jsonb`,
  } as never).returning("id").executeTakeFirstOrThrow();
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `pechk${STAMP}`, source_artifact_id: artifact.id,
    status: "provisioned", path: `sites/${tenant.id}/index.html`, slug: `pe-teszt-${STAMP}`,
  } as never).returning("id").executeTakeFirstOrThrow();
  ids.site = site.id;
  await db.insertInto("module_entitlement").values({ tenant_id: tenant.id, module: "poi", active: true } as never).execute();

  await db.insertInto("settlement").values([
    { osm_id: OWN, name: "_Peofalva", lat: 48.0, lon: 22.0, population: 700 },
    { osm_id: NEAR, name: "_Peoszomszed", lat: 48.09, lon: 22.0, population: 5000 },
  ]).onConflict((oc) => oc.column("osm_id").doNothing()).execute();
  await db.insertInto("event_gather_run").values({ settlement_osm_id: OWN, status: "done", finished_at: new Date() }).execute();
  const names = ["Szüreti napok", "Termelői piac", "Családi futónap", "Borkóstoló est", "Kézműves vásár",
    "Falunap", "Orgonakoncert", "Teljesítménytúra", "Lecsófőző verseny", "Kiállításmegnyitó",
    "Néptáncgála", "Gyertyafényes vacsora", "Bográcsfesztivál", "Csillagtúra"];
  await db.insertInto("local_event").values(names.map((n, i) => ({
    settlement_osm_id: i % 3 === 0 ? OWN : NEAR,
    name: `_${n}`,
    start_date: plus(1 + (i % 12)),
    source_url: `https://example.com/p${i}`,
    via: "llm" as const,
    dedup_key: `pe-${i}`,
  }))).execute();
  return { id: user.id, siteId: site.id, name: "_Programajánló őr" };
}

const tu = await seed();
const livePool = await siteProgramPool(tu.siteId);
console.log(`fixture: ${tu.name} | pool: ${livePool.state}, ${livePool.events.length} program`);
if (livePool.state !== "ok" || livePool.events.length !== 14) {
  ok(false, `ELŐFELTÉTEL: a fixture-kör 14 programja nem áll össze (${livePool.state}, ${livePool.events.length})`);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const base = `http://127.0.0.1:${port}`;
const URL_ = `${base}/admin?tab=modulok&m=poi`;

async function page(width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([
    { name: "cit_session", value: mintTenantCookieValue(tu.id), domain: "127.0.0.1", path: "/" },
  ]);
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return { p, errs, ctx };
}
// Actions go through the DOM, not Playwright's click(): its auto-scroll can move a
// clipped container and grade a hidden control as reachable (measured trap).
const act = (p: import("playwright-core").Page, sel: string) =>
  p.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);

try {
  // ── start from an EMPTY choice, so "0 → 10" is measured, not inherited ──────
  await db.deleteFrom("site_module_config").where("site_id", "=", tu.siteId).where("module", "=", "poi").execute();

  // ════════════════════════════════ desktop ════════════════════════════════
  console.log("\nasztali (1280 px)");
  {
    const { p, errs } = await page(1280);
    await p.goto(URL_);
    ok(await p.isVisible(".pa"), "a választó megjelenik");
    ok(!(await p.isVisible(".pa-tabs")), "① asztalon NINCS fül");
    ok(
      (await p.isVisible("[data-pa-pane=pool]")) && (await p.isVisible("[data-pa-pane=sel]")),
      "① asztalon a két hasáb EGYSZERRE látszik",
    );
    const w = await p.$eval(".pa", (e) => e.getBoundingClientRect().width);
    console.log(`      választó konténer-szélesség: ${Math.round(w)} px`);
    const [hp, hs] = await p.$$eval("[data-pa-list]", (xs) => xs.map((x) => x.getBoundingClientRect().height));
    ok(hs! >= hp! * 0.95, `⑥ az üres hasáb végigér a másik mellett (${Math.round(hs!)} / ${Math.round(hp!)} px)`);
    ok(await p.isVisible("[data-pa-list=sel] .pa-empty"), "⑥ üres állapot-üzenet látszik");
    const intro = (await p.textContent(".pa-intro")) ?? "";
    ok(!/bal(ra|oldal| oldal)|jobb(ra|oldal| oldal)/i.test(intro), "① a bevezető nem hivatkozik bal/jobb oldalra");
    const foot = (await p.textContent(".pa-refresh")) ?? "";
    ok(/Következő frissítés/.test(foot) && /megmarad/.test(foot) && /lejárt/.test(foot), "⑦ lábazat: következő frissítés + megmarad + lejártak lekerülnek");
    ok(await p.isDisabled("[data-pa-save]"), "változtatás nélkül a mentés tiltott");
    ok(/szabad 10 helyre automatikusan/.test((await p.textContent("[data-pa-auto]")) ?? "") && (await p.isVisible("[data-pa-auto]")),
      "⑤(honlap) üres választásnál kimondja: a szabad 10 helyet az automatika tölti");

    // ② the 10 limit
    for (let i = 0; i < 10; i++) await act(p, "[data-pa-list=pool] [data-pa-act=add]:not([disabled])");
    const n = await p.$$eval("[data-pa-list=sel] [data-pa-item]", (x) => x.length);
    ok(n === 10, `kiválasztva: ${n}`);
    const counter = (await p.textContent("[data-pa-c=sel]"))?.trim();
    ok(counter === "10 / 10", `② számláló: "${counter}"`);
    ok(await p.$eval("[data-pa-c=sel]", (e) => e.classList.contains("is-full")), "② betelt számláló kiemelt");
    const addable = await p.$$eval("[data-pa-list=pool] [data-pa-act=add]", (bs) => bs.filter((b) => !(b as HTMLButtonElement).disabled).length);
    const addTotal = await p.$$eval("[data-pa-list=pool] [data-pa-act=add]", (bs) => bs.length);
    ok(addTotal > 0 && addable === 0, `② 11. tétel tiltva (${addTotal} gombból ${addable} aktív)`);
    ok(await p.isVisible("[data-pa-full]"), "② „Betelt” üzenet LÁTHATÓ (isVisible)");
    ok(!(await p.isVisible("[data-pa-auto]")), "betelt állapotban az automatika-mondat eltűnik");
    await act(p, "[data-pa-list=pool] [data-pa-act=add]");
    ok((await p.$$eval("[data-pa-list=sel] [data-pa-item]", (x) => x.length)) === 10, "② tiltott gomb programból hívva sem vesz fel 11.-et");

    // ③ order
    const ids0 = await p.$$eval("[data-pa-list=sel] [data-pa-item]", (xs) => xs.map((x) => x.getAttribute("data-pa-item")));
    ok(await p.isDisabled("[data-pa-list=sel] [data-pa-item]:first-child [data-pa-act=up]"), "③ a legfelső „fel” nyila tiltott");
    ok(await p.isDisabled("[data-pa-list=sel] [data-pa-item]:last-child [data-pa-act=down]"), "③ a legalsó „le” nyila tiltott");
    await act(p, `[data-pa-list=sel] [data-pa-item="${ids0[2]}"] [data-pa-act=up]`);
    const ids1 = await p.$$eval("[data-pa-list=sel] [data-pa-item]", (xs) => xs.map((x) => x.getAttribute("data-pa-item")));
    ok(ids1[1] === ids0[2] && ids1[2] === ids0[1], "③ a 3. tétel „fel” után a 2. helyre került");

    // ④ source links
    const links = await p.$$eval("[data-pa-item] .pa-m a", (as) => as.map((a) => [a.getAttribute("target"), a.getAttribute("href")]));
    ok(links.length >= 10 && links.every(([t, h]) => t === "_blank" && /^https?:\/\//.test(h ?? "")), `④ minden tételnél forrás-link, új lapra (${links.length} db)`);

    // ⑤ rewrite the first title
    const firstSel = `[data-pa-list=sel] [data-pa-item="${ids1[0]}"]`;
    await act(p, `${firstSel} [data-pa-act=edit]`);
    ok(await p.$eval(`${firstSel} [data-pa-name]`, (e) => e.getAttribute("contenteditable") === "true"), "⑤ „átírom” szerkeszthetővé teszi a címet");
    await p.$eval(`${firstSel} [data-pa-name]`, (e) => { e.textContent = "Őrteszt átírt cím"; });
    await act(p, `${firstSel} [data-pa-act=edit]`);
    ok((await p.textContent(`${firstSel} [data-pa-name]`))?.trim() === "Őrteszt átírt cím", "⑤ „kész” után az átírt cím áll");

    ok(!(await p.isDisabled("[data-pa-save]")), "mentés gomb aktív");
    await Promise.all([p.waitForNavigation(), act(p, "[data-pa-save]")]);
    ok(await p.isVisible(".pa-saved"), "mentés után visszajelzés LÁTHATÓ");
    const ids2 = await p.$$eval("[data-pa-list=sel] [data-pa-item]", (xs) => xs.map((x) => x.getAttribute("data-pa-item")));
    ok(JSON.stringify(ids2) === JSON.stringify(ids1), "③ a sorrend a mentés+újratöltés után is ugyanaz");
    ok((await p.textContent(`[data-pa-list=sel] [data-pa-item="${ids1[0]}"] [data-pa-name]`))?.trim() === "Őrteszt átírt cím", "⑤ az átírt cím a mentés után is megmaradt");
    const row = await db.selectFrom("site_module_config").select(["config", "version"]).where("site_id", "=", tu.siteId).where("module", "=", "poi").executeTakeFirst();
    const stored = (row?.config as { picks?: { id: string; title?: string }[] })?.picks ?? [];
    ok(row?.version === 2 && stored.length === 10 && stored[0]?.title === "Őrteszt átírt cím", `DB: v${row?.version}, ${stored.length} pick, az első címe átírva`);
    ok(errs.length === 0, `JS-hiba: ${errs.length}${errs.length ? " — " + errs[0] : ""}`);
  }

  // ═══════════════════════════ forged save: foreign id ═══════════════════════════
  console.log("\nhamisított mentés");
  {
    const { p, ctx } = await page(1280);
    await p.goto(URL_);
    const res = await ctx.request.post(`${base}/admin/programs`, {
      form: { picks: JSON.stringify([{ id: "00000000-0000-4000-8000-000000000000" }, ...livePool.events.slice(0, 11).map((e) => ({ id: e.id }))]) },
      maxRedirects: 0,
    });
    ok(res.status() === 302 || res.status() === 303, `a mentés átirányít (${res.status()})`);
    const row = await db.selectFrom("site_module_config").select("config").where("site_id", "=", tu.siteId).where("module", "=", "poi").executeTakeFirst();
    const stored = (row?.config as { picks?: { id: string }[] })?.picks ?? [];
    ok(!stored.some((x) => x.id.startsWith("00000000")), "idegen/kitalált id NEM kerül a sorba");
    ok(stored.length === 10, `11 beküldött valódi id-ből legfeljebb 10 tárolódik (${stored.length})`);
  }

  // ════════════════════════════════ mobile ════════════════════════════════
  console.log("\nmobil (390 px)");
  await db.deleteFrom("site_module_config").where("site_id", "=", tu.siteId).where("module", "=", "poi").execute();
  {
    const { p, errs } = await page(390);
    await p.goto(URL_);
    ok(await p.isVisible(".pa-tabs"), "① mobilon fülek vannak");
    const tabPool = (await p.textContent("[data-pa-tab=pool]"))?.replace(/\s+/g, " ").trim();
    ok(tabPool === `Javasolt (${livePool.events.length})`, `① fül-felirat darabszámmal: "${tabPool}"`);
    ok(await p.isVisible("[data-pa-pane=pool]") && !(await p.isVisible("[data-pa-pane=sel]")), "① mobilon egyszerre egy hasáb");
    await act(p, "[data-pa-list=pool] [data-pa-act=add]");
    const tabSel = (await p.textContent("[data-pa-tab=sel]"))?.replace(/\s+/g, " ").trim();
    ok(tabSel === "Az Ön oldalán (1)", `① a másik fül számlálója követi: "${tabSel}"`);
    await act(p, "[data-pa-tab=sel]");
    ok(await p.isVisible("[data-pa-pane=sel]") && !(await p.isVisible("[data-pa-pane=pool]")), "① fülváltás a kiválasztottakra");
    ok((await p.$$eval("[data-pa-list=sel] [data-pa-item]", (x) => x.length)) === 1, "a felvett tétel a másik fülön ott van");
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 0, `nincs vízszintes túlfolyás (${overflow} px)`);
    ok(errs.length === 0, `JS-hiba: ${errs.length}${errs.length ? " — " + errs[0] : ""}`);
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
  if (ids.tenant) await rm(path.resolve(process.cwd(), "sites", ids.tenant), { recursive: true, force: true }).catch(() => {});
  await db.deleteFrom("local_event").where("settlement_osm_id", "in", [OWN, NEAR]).execute().catch(() => {});
  await db.deleteFrom("event_gather_run").where("settlement_osm_id", "in", [OWN, NEAR]).execute().catch(() => {});
  await db.deleteFrom("settlement").where("osm_id", "in", [OWN, NEAR]).execute().catch(() => {});
  if (ids.site) {
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.site).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.site).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.site).execute().catch(() => {});
  }
  if (ids.tenant) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("tenant_user").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenant).execute().catch(() => {});
  }
  if (ids.lead) {
    await db.deleteFrom("mock_artifact").where("lead_id", "=", ids.lead).execute().catch(() => {});
    await db.deleteFrom("lead").where("id", "=", ids.lead).execute().catch(() => {});
  }
  if (ids.run) await db.deleteFrom("scrape_run").where("id", "=", ids.run).execute().catch(() => {});
  if (ids.def) await db.deleteFrom("scraper_definition").where("id", "=", ids.def).execute().catch(() => {});
  await pool.end();
}

console.log(fails ? `\n⛔ ${fails} FAIL` : "\n✅ a programajánló-választó minden kontraktus-állítása ZÖLD");
process.exit(fails ? 1 : 0);
