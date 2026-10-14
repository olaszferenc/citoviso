// ADR-0389 — férőhely-túllépés (Elek F-1, 2026-10-14: 7 fős kérés egy 4 fős házra ment át, és a
// szállásadó SEHOL nem kapott figyelmeztetést). Az őr végponttól végpontig nézi:
//   ① a szelvény léptetője a választott egység férőhelyénél megáll (390 px és 1280 px), egységváltásra követ;
//   ② a szerver a férőhely fölött elutasít, a férőhelyen elfogad (negatív kontroll);
//   ③ a régi / utólag szűkített túllépő kérésnél a tulaj-levél, az admin-kártya + a visszaigazolás
//      lépése és a levél-link megerősítő oldala figyelmeztet — a férőhelyen belüli kérésnél NEM.
// Futtatás: npx tsx scripts/booking-capacity-check.mts
import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";
const ROOT = path.resolve(import.meta.dirname, "..");
const STARTED = Date.now();
const { config } = await import("../src/config.js");
const { bookingSlot } = await import("../src/engine/templateKit.js");
const { moduleSections } = await import("../src/engine/moduleSections.js");
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setBasePrice } = await import("../src/tenant/prices.js");
const { createUnit } = await import("../src/tenant/units.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { createBookingRequest, getRequests, notifyOwner, overCapacity, peekDecision } = await import("../src/booking/requests.js");
const { bookingsSection } = await import("../src/server/bookingViews.js");
const { bookingDecideConfirmPage } = await import("../src/server/moduleConfigViews.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 260)}`}`);
  if (!c) fail++;
};
const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

console.log("\n⓪ a szabály");
check("4 fős egységre 7 fő → túllépés (4)", overCapacity(7, 4) === 4);
check("4 fős egységre 4 fő → nincs túllépés", overCapacity(4, 4) === null);
check("férőhely nélküli egység → nincs korlát (nem találunk ki számot)", overCapacity(30, null) === null);

/* ── ① the widget ─────────────────────────────────────────────────────────── */
const ROOM = "33333330-3333-3333-3333-333333333330";
const HOUSE = "33333331-3333-3333-3333-333333333331";
async function pageHtml(): Promise<string> {
  const [moneyJs, seasonJs, runtimeJs, css] = await Promise.all(
    ["cit-money.js", "cit-season.cjs", "cit-runtime.js", "cit-modules.css"].map((f) => readFile(path.join(ROOT, "assets/runtime", f), "utf8")),
  );
  const d = {
    name: "Férőhely Teszt", tagline: "", intro: "", highlights: [], photos: [], contact: { email: "info@example.com" },
    booking: {
      units: [{ id: ROOM, name: "Kétágyas szoba", capacity: 2 }, { id: HOUSE, name: "Vendégház", capacity: 5 }],
      minNights: 1, maxNights: 14, horizonMonths: 12, leadTimeDays: 0,
    },
  } as unknown as SiteData;
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){return Promise.resolve(` +
    `${JSON.stringify({ blocked: [], pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 18000, label: "Alapár" }] } })});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${css}</style></head><body>` + stub + bookingSlot(d) + moduleSections(d) +
    `<script>${moneyJs}</script><script>${seasonJs}</script><script>${runtimeJs}</script></body></html>`
  );
}
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "bcap-")), "site.html");
  await writeFile(file, await pageHtml(), "utf8");
  for (const width of [390, 1280]) {
    console.log(`\n① szelvény · ${width}px`);
    const page: Page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(400);
    const free = page.locator(".cit-book__day:not(:disabled):visible");
    for (let i = 0; i < 3 && (await free.count()) < 5; i++) { await page.click(".cit-book__calnav--next"); await page.waitForTimeout(150); }
    await free.nth(1).click();
    await free.nth(4).click();
    await page.waitForTimeout(250);
    if (await page.locator(".cit-book__go").isVisible()) { await page.click(".cit-book__go"); await page.waitForTimeout(300); }
    const plus = page.locator(".cit-book__step[data-step='1']").first();
    const count = async (): Promise<number> => Number(await page.locator("[data-guests]").first().textContent());
    // On the phone's step 2 the unit picker sits in step 1 — the change event is what counts.
    const pick = (id: string) =>
      page.evaluate((v) => {
        const sel = document.querySelector<HTMLSelectElement>("select[name='unit']")!;
        sel.value = v;
        sel.dispatchEvent(new Event("change"));
      }, id);
    await pick(ROOM);
    await page.waitForTimeout(250);
    check("⭐ a 2 fős szobánál a „+” tiltva 2 főnél", (await count()) === 2 && (await plus.isDisabled()), await count());
    const note = page.locator("[data-cit-capnote]");
    check("⭐ kimondja: „Ide legfeljebb 2 vendég foglalhat.”", (await note.isVisible()) && /Ide legfeljebb 2 vendég foglalhat\./.test((await note.textContent()) ?? ""));
    await pick(HOUSE);
    await page.waitForTimeout(250);
    check("negatív kontroll: az 5 fős háznál a „+” él, a mondat nincs ott", (await plus.isEnabled()) && (await note.isHidden()));
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click();
    check("⭐ a háznál 5-nél megáll", (await count()) === 5 && (await plus.isDisabled()), await count());
    await pick(ROOM);
    await page.waitForTimeout(250);
    check("⭐ vissza a szobára → a létszám 2-re igazodik", (await count()) === 2, await count());
    check("JS-hiba 0", errs.length === 0, errs);
    await page.close();
  }
} finally {
  await browser.close();
}

/* ── ②–③ the server, the owner's letter, the card, the confirm page ─────────── */
const OUTBOX = path.join(ROOT, "outbox");
async function mailsTo(who: string): Promise<{ subject: string; body: string }[]> {
  await new Promise((r) => setTimeout(r, 900));
  const out: { subject: string; body: string }[] = [];
  for (const f of (await readdir(OUTBOX).catch(() => [] as string[])).sort()) {
    const p = path.join(OUTBOX, f);
    if ((await stat(p)).mtimeMs < STARTED) continue;
    const raw = await readFile(p, "utf8");
    if (!(/^To: (.*)$/m.exec(raw)?.[1] ?? "").includes(who)) continue;
    out.push({ subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "", body: raw.slice(raw.indexOf("\n\n") + 2).replace(/=\r?\n/g, "") });
  }
  return out;
}
const ids: Record<string, string> = {};
try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_bcap", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_bcap lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Férőhely Teszt" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db.insertInto("site").values({ tenant_id: tenant.id, preview_token: `bcap_${stamp}`, slug: `bcap-${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  await setTenantModules(tenant.id, ["booking", "pricing"]);
  const owner = `owner-${stamp}@example.com`;
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: owner }, "test");
  const unit = (await createUnit(site.id, "Vendégház", 4, null))!;
  await setBasePrice(unit, 20000);
  const ask = (guests: number, off: number) =>
    createBookingRequest(
      { siteId: site.id, unitId: unit, guestName: "Teszt Vendég", guestEmail: `g${off}-${stamp}@example.com`, guestPhone: "+36301112222", dateFrom: iso(off), dateTo: iso(off + 3), guests },
      null,
    );

  console.log("\n② szerver");
  const over = await ask(7, 30);
  check("⭐ 7 fő a 4 fős házra → elutasítva, a vendég szavával", !over.ok && (over.errors ?? []).some((e) => e.startsWith("Ide legfeljebb 4 vendég foglalhat.")), over.errors);
  check("⭐ … és nem jött létre kérés", (await db.selectFrom("booking_request").select("id").where("site_id", "=", site.id).execute()).length === 0);
  const fits = await ask(4, 40);
  check("negatív kontroll: 4 fő a 4 fős házra → elfogadva", fits.ok, fits.errors);
  const fitMail = (await mailsTo(owner)).find((m) => /Foglalási kérés/.test(m.subject));
  check("negatív kontroll: a férőhelyen belüli kérés tulaj-levelében nincs figyelmeztetés", Boolean(fitMail) && !/a férőhely 4 fő/.test(fitMail!.body));

  console.log("\n③ régi / utólag szűkített túllépő kérés");
  // The capacity is lowered after the request (or the request predates the check): 4 guests, 3 places.
  await db.updateTable("site_unit").set({ capacity: 3 }).where("id", "=", unit).execute();
  const row = await db.selectFrom("booking_request").select(["id", "action_token"]).where("id", "=", fits.id!).executeTakeFirstOrThrow();
  await notifyOwner(row.id, row.action_token, owner, null);
  const warnMail = (await mailsTo(owner)).filter((m) => /Foglalási kérés/.test(m.subject)).pop();
  check("⭐ tulaj-levél: „Figyelem: a vendég 4 főre kér, a férőhely 3 fő.”", /Figyelem: a vendég 4 főre kér, a férőhely 3 fő\./.test(warnMail?.body ?? ""), (warnMail?.body ?? "").slice(0, 300));
  const reqs = await getRequests(site.id);
  check("az admin-lista viszi a férőhelyet", reqs[0]?.capacity === 3, reqs[0]?.capacity);
  const month = iso(0).slice(0, 7);
  const monthView = {
    month, label: "teszt hónap", prevMonth: month, nextMonth: month, leadingBlanks: 0, blockedCount: 0, importedCount: 0,
    cells: Array.from({ length: 28 }, (_, i) => ({
      day: `${month}-${String(i + 1).padStart(2, "0")}`, dom: i + 1, blocked: false, source: null, editable: true, past: false, detail: null,
    })),
  };
  const tab = (rs: typeof reqs) =>
    bookingsSection(
      {
        units: [{ id: unit, name: "Vendégház" }], unitId: unit, month: monthView, calendarOpen: false, openDay: null, openDayBooking: null,
        panel: null, requests: rs, yearAccepted: 0, yearCancelled: 0, expireHours: 48, outcome: null,
      } as unknown as Parameters<typeof bookingsSection>[0],
      "hu",
    );
  const html = tab(reqs);
  check("⭐ admin-kártya: a figyelmeztetés a kártyán", /data-bk-cap[^>]*>[\s\S]{0,400}Figyelem: a vendég 4 főre kér, a férőhely 3 fő\./.test(html));
  check("⭐ admin: a „Visszaigazolom” lépésben is ott", /bk-cf__cap/.test(html));
  check("negatív kontroll: férőhelyen belül nincs jelzés", !/data-bk-cap/.test(tab(reqs.map((r) => ({ ...r, capacity: 4 })))));
  const peek = await peekDecision(row.action_token, "accepted");
  check("a levél-link nézete viszi a férőhelyet", peek.capacity === 3, peek);
  const page = bookingDecideConfirmPage(peek, row.action_token, "accepted");
  check("⭐ levél-link megerősítő oldala: „Figyelem: a vendég 4 főre kér, a férőhely 3 fő.”", /data-cap-warn[\s\S]{0,400}Figyelem: a vendég 4 főre kér, a férőhely 3 fő\./.test(page));
  check("negatív kontroll: férőhely nélkül nincs jelzés", !/data-cap-warn/.test(bookingDecideConfirmPage({ ...peek, capacity: undefined }, row.action_token, "accepted")));
} finally {
  if (ids.siteId) {
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("unit_price").where("unit_id", "in", db.selectFrom("site_unit").select("id").where("site_id", "=", ids.siteId)).execute().catch(() => {});
    await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config_history").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site_module_config").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
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
console.log(fail ? `\n⛔ BOOKING-CAPACITY: ${fail} bukás` : "\n🟢 BOOKING-CAPACITY: a férőhely fölött a szelvény megáll, a szerver elutasít; a régi túllépő kérésnél a levél, a kártya és a megerősítés figyelmeztet");
process.exit(fail ? 1 : 0);
