// ORSZÁG-RÉTEG 3/8 (ADR-0460) ACCEPTANCE — the console's „Országok” lap, in a SCRATCH database
// (never the shared dev DB, never production). Nothing is sent, nothing is translated: the
// language pack and the price sheet that complete the country are FIXTURES written into the
// scratch DB (marker strings, never a translation), the network is fenced.
//
// Walked in a real browser (Playwright, the worktree's own console on an ephemeral port):
//   ① a new country (BG) on the lap: the starter row is Bulgarian with EUR (euro area since
//      2026-01-01); a BGN currency, a mistyped zone and a 0-leading calling code each show
//      their error live; the save refuses while a field is wrong, then writes the row;
//   ② the readiness shows the gaps, the approve button is disabled, and a hand-made POST to
//      /settings/markets is REFUSED by the server too (no market row, no log row);
//   ③ every condition met by fixtures (EUR price sheet, buyer-side bg pack) and on the lap
//      (holidays through the holiday editor) → the approve button is live → the market opens
//      → the gate every cold-outreach / order path reads (isMarketApproved) is open;
//   ④ an approved country that loses a condition (a holiday removed) shuts the gate again;
//   ⑤ HU: the row is byte-identical before and after a "Mentés" of its untouched form, its
//      gate is open throughout, its readiness complete (its empty holiday list a warning);
//   ⑥ 0 JS errors on every page.
//
//   npx tsx scripts/country-page-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:http";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_country_page_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

process.env.CIT_SHOT = "1"; // no boot self-heal (no AI, no background writes)
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.PUBLIC_BASE_URL = "https://citoviso.test";
process.env.I18N_BOOT_TOPUP = "0";
process.env.CONSOLE_PORT = "0";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY", "OUTREACH_SMS_ALLOWLIST"]) process.env[k] = "";

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

// Network fence: nothing leaves the machine (the browser is fenced below as well).
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by country-page-e2e fence", { status: 599 });
}) as typeof fetch;

const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries } = await import("../src/country.js");
const pricing = await import("../src/pricing.js");
const { MODULE_CATALOG, MULTILANG_TIERS } = await import("../src/modules.js");
const { buyerCatalog } = await import("../src/i18n/packs.js");
const { isMarketApproved, marketGate } = await import("../src/markets.js");
const { countryReadiness } = await import("../src/countryReadiness.js");
const { config } = await import("../src/config.js");
const { chromium } = await import("playwright-core");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

/** The HU row as JSON, without its write stamp — "byte-identical" is measured on this. */
async function huRow(): Promise<string> {
  const r = await sql<{ j: unknown }>`select to_jsonb(c) - 'updated_at' as j from country c where iso2 = 'HU'`.execute(db);
  return JSON.stringify(r.rows[0]?.j ?? null);
}

// ── the console, this worktree's code, ephemeral port ──────────────────────────────────────
const op = await db
  .insertInto("operator_user")
  .values({ username: "country-e2e", display_name: "Country E2E", role: "superadmin", password_hash: "x" })
  .returning("id")
  .executeTakeFirstOrThrow();
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
const BASE = `http://localhost:${addr.port}`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: BASE }]);
await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
const page = await context.newPage();
const jsErrors: string[] = [];
page.on("pageerror", (e) => jsErrors.push(e.message));

/** Wait for the live check to settle (debounce 250 ms + the round trip). */
async function settle(): Promise<void> {
  await page.waitForTimeout(350);
  await page.waitForLoadState("networkidle");
}
/** Type into a field and wait for THE live check that answers it. */
async function liveFill(sel: string, value: string): Promise<void> {
  const answered = page.waitForResponse((r) => r.url().endsWith("/countries/check"), { timeout: 20_000 });
  await page.fill(sel, value);
  const r = await answered;
  if (!r.ok()) console.log(`   (élő ellenőrzés: HTTP ${r.status()} — ${(await r.text()).slice(0, 200)})`);
  await page.waitForTimeout(100);
}
/** Click „Mentés” and wait for the page the save answers with (a 422 page or the redirect target). */
async function saveAndWait(): Promise<void> {
  // Mark the current document: the answer (a 422 page or the redirect to the saved row) is a NEW one.
  await page.evaluate(() => { (window as unknown as { __before?: boolean }).__before = true; });
  await page.click("[data-save]");
  await page.waitForFunction(() => !(window as unknown as { __before?: boolean }).__before && document.readyState === "complete", null, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}
const errOf = async (field: string): Promise<string> =>
  ((await page.locator(`[data-field="${field}"] .cty-f__e`).first().textContent()) ?? "").trim();

// Migration 0150 seeds BG (with IT, ES, PT, FR): this walk adds BG FROM SCRATCH on the lap, so the
// scratch DB starts without it (scratch only — never the shared dev DB).
await db.deleteFrom("market_log").where("country", "=", "BG").execute();
await db.deleteFrom("market").where("country", "=", "BG").execute();
await db.deleteFrom("country").where("iso2", "=", "BG").execute();
await refreshCountries();
const huBefore = await huRow();
try {
  console.log("\n⑤ HU kiinduló állapot");
  check("HU piac-kapu nyitva", await isMarketApproved("HU"));
  const huR = await countryReadiness("HU");
  check("HU teljesség: complete", huR.complete, huR.reasons.join(" · "));
  check("HU ünnepnap: figyelmeztetés, nem zár", huR.items.some((i) => i.key === "holidays" && i.state === "warn" && !i.gating));

  console.log("\n① Új ország (BG) a lapon");
  await page.goto(`${BASE}/countries`, { waitUntil: "networkidle" });
  check("a táblázat listázza HU-t", (await page.locator("#ovrow-HU").count()) === 1);
  await page.fill('.cty-new input[name="new"]', "bg");
  await page.click('.cty-new button[type="submit"]');
  await page.waitForLoadState("networkidle");
  check("a szerkesztő megnyílt (Új ország)", (await page.locator("#cty-drawer[data-new='1']").count()) === 1);
  check("BG kezdősor: EUR", (await page.inputValue('[name="currency"]')) === "EUR");
  check("BG kezdősor: bg nyelv, Europe/Sofia, +359", (await page.inputValue('[name="defaultLang"]')) === "bg" &&
    (await page.inputValue('[name="timeZone"]')) === "Europe/Sofia" && (await page.inputValue('[name="dialCode"]')) === "359");

  await liveFill('[name="currency"]', "BGN");
  check("BGN → élő hiba (euróövezet)", /EUR/.test(await errOf("currency")), await errOf("currency"));
  await page.fill('[name="currency"]', "EUR");
  await liveFill('[name="timeZone"]', "Europe/Sofa");
  check("elgépelt időzóna → élő hiba", /IANA/.test(await errOf("timeZone")), await errOf("timeZone"));
  await page.fill('[name="timeZone"]', "Europe/Sofia");
  await page.fill('[name="name"]', "Bulgária");
  await page.selectOption('[name="pricingRegion"]', "global");
  await page.click('#cty-subtabs [data-sub="phone"]');
  await liveFill('[name="dialCode"]', "0359");
  check("0-val kezdődő hívószám → élő hiba", /0-val/.test(await errOf("dialCode")), await errOf("dialCode"));
  await page.fill('[name="dialCode"]', "359");
  await page.fill('[name="phoneNsnMin"]', "8");
  await page.fill('[name="phoneNsnMax"]', "9");
  await page.fill('[data-chip-in="mobilePrefixes"]', "87");
  await page.press('[data-chip-in="mobilePrefixes"]', "Enter");

  // Save with the discovery fields still empty → refused, nothing written.
  await saveAndWait();
  const noRow = await db.selectFrom("country").select("iso2").where("iso2", "=", "BG").executeTakeFirst();
  check("hiányos mentés → elutasítva, sor nincs", !noRow);
  const discN = await page.locator('[data-subpanel="discovery"]:not([hidden])').count();
  check("…és a hibás mező helyére ugrik (Felderítés)", discN === 1,
    `${page.url()} · látható: ${(await page.locator("[data-subpanel]:not([hidden])").evaluateAll((els) => els.map((e) => e.getAttribute("data-subpanel")))).join(",")} · ${await page.locator(".cty-notice").allTextContents()}`);
  for (const [i, v] of ["41.23", "22.36", "44.22", "28.61"].entries()) await page.fill(`[name="bbox${i}"]`, v);
  await page.fill('[data-chip-in="kw.accommodation"]', "къща за гости");
  await page.press('[data-chip-in="kw.accommodation"]', "Enter");
  await saveAndWait();
  const bg = await db.selectFrom("country").selectAll().where("iso2", "=", "BG").executeTakeFirst();
  check("mentés → a BG sor megvan", !!bg);
  check("BG sor: EUR, bg, +359, legal_pack bg", bg?.currency === "EUR" && bg?.default_lang === "bg" && bg?.dial_code === "359" && bg?.legal_pack === "bg");

  console.log("\n② Hiányok → tiltott jóváhagyás");
  await page.goto(`${BASE}/countries?iso=BG&step=open`, { waitUntil: "networkidle" });
  const r0 = await countryReadiness("BG");
  const bad0 = r0.items.filter((i) => i.gating && i.state === "bad").map((i) => i.key);
  // The bg buyer pack is Bábel's committed work since 2026-11 (src/i18n/babel/packs) — the language may already be complete.
  check("a teljesség hiányokat mutat (ár, ünnep)", ["prices", "holidays"].every((k) => bad0.includes(k as never)), bad0.join(","));
  check("a lapon a hiányok pirosak", (await page.locator(".cty-rd__i--bad").count()) >= 3);
  check("„Piac megnyitása” gomb TILTVA", await page.locator('#cty-gate button[type="submit"]').isDisabled());
  const forced = await page.request.post(`${BASE}/settings/markets`, {
    form: { country: "BG", action: "approve", reason: "kézi próbálkozás" },
    maxRedirects: 0,
  });
  check("kézi POST → a szerver is elutasítja", forced.status() === 303 && /hiba/.test(decodeURIComponent(forced.headers()["location"] ?? "")));
  const mk0 = await db.selectFrom("market").select("legal_status").where("country", "=", "BG").executeTakeFirst();
  const log0 = await db.selectFrom("market_log").select("action").where("country", "=", "BG").execute();
  check("…nincs piac-sor és naplósor", !mk0 && log0.length === 0);

  console.log("\n③ Minden feltétel teljesítve (fixtúra + a lap) → megnyitható");
  // EUR price sheet — every required module price, a base fee (fixture values, scratch DB).
  await pricing.createPricingRegion("eur", "EUR");
  await db.updateTable("pricing_config").set({ base_monthly: 990, pricing_confirmed: true } as never).where("region", "=", "eur").execute();
  const ids = new Set([...MODULE_CATALOG.filter((m) => !m.spine && !(m as { retired?: boolean }).retired).map((m) => m.id), ...MULTILANG_TIERS.map((t) => t.priceId)]);
  for (const id of ids) {
    await db.insertInto("module_price_region").values({ region: "eur", module_id: id, price_monthly: 100 } as never).execute();
  }
  await pricing.loadPricing(true);
  // Buyer-side bg pack — MARKER strings (never a translation), scratch DB only.
  const scope = await buyerCatalog();
  const marker = Object.fromEntries(scope.map((hu) => [hu, `‹bg› ${hu.replace(/[aáeéiíoóöőuúüű]/gi, "·")}`]));
  await db.insertInto("language_pack").values({ lang: "bg", strings: JSON.stringify(marker) } as never)
    .onConflict((oc) => oc.column("lang").doUpdateSet({ strings: JSON.stringify(marker) } as never)).execute();
  // Region + holidays on the LAP (the holiday editor, every year).
  await page.goto(`${BASE}/countries?iso=BG&step=data`, { waitUntil: "networkidle" });
  await page.selectOption('[name="pricingRegion"]', "eur");
  await page.click('.cty-step[data-goto="outreach"]');
  for (const d of ["2026-01-01", "2026-03-03", "2026-05-01"]) {
    await page.fill("#hol-date", d);
    await page.click("#hol-add");
  }
  await settle();
  check("ünnepnap-szerkesztő: mindkét év lefedve", (await page.locator("#hol-years .cty-tag--ok").count()) === 2,
    `${(await page.locator("#hol-years").first().innerHTML()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")} · #hol-years: ${await page.locator("#hol-years").count()}`);
  await saveAndWait();
  const r1 = await countryReadiness("BG");
  check("BG teljes", r1.complete, r1.reasons.join(" · "));
  check("…de még nincs jóváhagyva → a kapu zárva", !(await isMarketApproved("BG")));
  await page.goto(`${BASE}/countries?iso=BG&step=open`, { waitUntil: "networkidle" });
  check("„Piac megnyitása” gomb ÉL", await page.locator('#cty-gate button[type="submit"]').isEnabled());
  await page.fill('#cty-gate textarea[name="reason"]', "bolgár csomag — elfogadási teszt");
  await page.click('#cty-gate button[type="submit"]');
  await page.waitForLoadState("networkidle");
  const g1 = await marketGate("BG");
  check("a piac megnyílt (jóváhagyva + teljes)", g1.open && g1.approved, g1.reasons.join(" · "));
  check("az ország-lapon „Fut”", /Fut/.test((await page.locator(".hub-h").textContent()) ?? ""));
  const log1 = await db.selectFrom("market_log").select(["action", "actor"]).where("country", "=", "BG").execute();
  check("a döntés naplózva, a bejelentkezett operátor nevén", log1.length === 1 && log1[0]!.actor === "country-e2e");

  console.log("\n④ Jóváhagyott, de hiányossá vált → a kapu újra zár");
  await db.updateTable("country").set({ public_holidays: JSON.stringify([]) } as never).where("iso2", "=", "BG").execute();
  await refreshCountries();
  check("ünnepnapok nélkül a kapu ZÁRVA", !(await isMarketApproved("BG")));
  await page.goto(`${BASE}/countries`, { waitUntil: "networkidle" });
  check("a táblázatban „Jóváhagyva, hiányos”", /hiányos/.test((await page.locator("#ovrow-BG .hub-st").textContent()) ?? ""));

  console.log("\n⑤ HU változatlan");
  await page.goto(`${BASE}/countries?iso=HU&step=data`, { waitUntil: "networkidle" });
  await saveAndWait();
  check("HU sor bitre azonos a mentés után", (await huRow()) === huBefore);
  check("HU piac-kapu nyitva", await isMarketApproved("HU"));

  console.log("\n⑦ „Országok / Árazás” (orszagok-arazas 1. fázis): egy lap, három fül");
  await page.goto(`${BASE}/countries?iso=HU`, { waitUntil: "networkidle" });
  check("három fül: Ország, Árazás, Kiküldés", (await page.locator(".hub-tabs [data-tab]").count()) === 3);
  check("Ország fül: alapadatok + Indítás + indulás-lista", (await page.locator(".hub-facts").count()) === 1 && (await page.locator("#hub-gate").count()) === 1 && (await page.locator("#hub-launch li").count()) >= 10);
  await page.click('.hub-tabs [data-tab="price"]');
  await page.waitForLoadState("networkidle");
  check("Árazás fül: a régió árazó űrlapja", /tab=price/.test(page.url()) && (await page.locator('#pr2-form input[name="region"]').inputValue()) === "hu");
  await page.click('.hub-tabs [data-tab="out"]');
  await page.waitForLoadState("networkidle");
  check("Kiküldés fül: csak olvas (a választó tiltva)", (await page.locator('input[name="out-mode"]').count()) === 2 && (await page.locator('input[name="out-mode"]:not([disabled])').count()) === 0);
  check("Kiküldés fül: összesítő + hat szakasz", (await page.locator("#out-sum .hub-kpi").count()) === 4 && (await page.locator('[id^="out-"].hub-card').count()) === 6);
  const rd = await page.request.get(`${BASE}/pricing`, { maxRedirects: 0 });
  check("/pricing → a hazai ország Árazás füle", rd.status() === 303 && /\/countries\?iso=HU&tab=price/.test(rd.headers()["location"] ?? ""), rd.headers()["location"] ?? "");
  const rg = await page.request.get(`${BASE}/pricing?region=global`, { maxRedirects: 0 });
  check("/pricing?region=global → a globális ársor saját útja", /\/countries\/global-pricing\?region=global/.test(rg.headers()["location"] ?? ""), rg.headers()["location"] ?? "");
  await page.goto(`${BASE}/countries/global-pricing`, { waitUntil: "networkidle" });
  check("a globális ársor szerkeszthető", (await page.locator('#pr2-form input[name="region"]').inputValue()) === "global");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/countries`, { waitUntil: "networkidle" });
  check("mobilon kártyák, a táblázat rejtve", (await page.locator("#ovcard-HU").isVisible()) && !(await page.locator(".hub-tablewrap").isVisible()));
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log("\n⑥ JS-hibák");
  check("0 JS-hiba", jsErrors.length === 0, jsErrors.join(" | "));
} finally {
  await browser.close().catch(() => {});
  server.close();
  await db.destroy().catch(() => {});
}
console.log(fails ? `\n⛔ country-page-e2e: ${fails} hiba` : "\n✅ country-page-e2e: az Országok lap elfogadva");
process.exit(fails ? 1 : 0);
