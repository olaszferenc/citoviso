// PÉNZTÁRCA mock-kör — a tulaj útja végig, valódi kattintásokkal, képekkel (ADR-0226).
//
//   npx tsx scripts/wallet-tour.mts [--out <dir>]
//
// Amit a wallet-check NEM mér: a három folyamat a böngészőben, a két szerveren át
// (tenant-admin → konzol mock fizetőlap → /pay/done → vissza a Pénztárcába):
//   1. Kártya cseréje → tájékoztató ablak → mock fizetőlap, MasterCard ····8810,
//      „Megerősítem" → `card=ok`, a régi kártya „cserélve"; elutasítás-ág → `card=fail`,
//      semmi nem változik.
//   2. Modulok → fizetős modul → „Másik kártyával" → mock fizetőlap (kártyaválasztóval)
//      → a Pénztárca az új kártyát mutatja, a modul él.
//   3. Megbízás visszavonása → vissza a Pénztárcába: NINCS MENTETT KÁRTYA, „visszavonva",
//      „Kártya megadása".
// Minden ellenőrzőponton kép 390 és 1280 px-en (`<out>/NN-<név>-{mobil,asztali}.png`).
//
// ⛔ PÉNZ ÉS LEVÉL NEM MOZDUL: mock átjáró + mock számlázó + mock levél, a DINAMIKUS
// importok ELŐTT beállítva (reference_env_assignment_loses_to_esm_imports), és az első
// kattintás előtt VISSZAMÉRVE. A dev .env Barion-SANDBOX-ot ír: a sandbox valódi
// callbackeket küld, amit egy eldobott fixtúra már nem fogad („Unsuccessful callback").
// A szerverek ebből a fából, ideiglenes portokon futnak — a közös :4600/:4800 érintetlen.
// A fixtúra eldobható tenant, `finally`-ben takarít (a közös Elek-park nem változik).

process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.EMAIL_PROVIDER = "mock";
process.env.ELEK_RUN = "1"; // second lock: the mail sender refuses any non-Elek recipient
process.env.CIT_SHOT = "1"; // no boot self-heal (AI top-ups, sweeps)

import { mkdirSync } from "node:fs";
import { once } from "node:events";
import { createServer, type Server } from "node:net";
import type { Server as HttpServer } from "node:http";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]!) : path.join(ROOT, "assets/design-refs/_drafts/wallet-tour");
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (cond: boolean, what: string, detail = ""): void => {
  if (cond) console.log(`  ✓ ${what}`);
  else {
    failures++;
    console.error(`  ✗ ${what}${detail ? ` — ${detail}` : ""}`);
  }
};

async function freePort(): Promise<number> {
  const s: Server = createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const a = s.address();
  const port = typeof a === "object" && a ? a.port : 0;
  s.close();
  await once(s, "close");
  return port;
}

// Both origins must be known BEFORE config loads: the console's /pay/done sends a
// card_update back to config.publicSiteUrl, and the mock pay-link is built from
// PUBLIC_BASE_URL (the console). Without these the round would land on the MAIN tree.
const consolePort = await freePort();
const publicPort = await freePort();
const consoleOrigin = `http://127.0.0.1:${consolePort}`;
const publicOrigin = `http://127.0.0.1:${publicPort}`;
process.env.CONSOLE_PORT = String(consolePort);
process.env.PUBLIC_PORT = String(publicPort);
process.env.PUBLIC_BASE_URL = consoleOrigin;
process.env.PUBLIC_SITE_URL = publicOrigin;

const { sql } = await import("kysely");
const { db } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { getGateway } = await import("../src/payment/index.js");
const { chromium } = await import("playwright-core");

if (getGateway().name !== "mock" || (process.env.INVOICE_PROVIDER ?? "") !== "mock" || config.emailProvider !== "mock") {
  console.error(`ELŐFELTÉTEL: átjáró=${getGateway().name}, számlázó=${process.env.INVOICE_PROVIDER}, levél=${config.emailProvider} — mind mock kell. Leállok.`);
  process.exit(2);
}
if (config.publicSiteUrl !== publicOrigin) {
  console.error(`ELŐFELTÉTEL: publicSiteUrl=${config.publicSiteUrl}, várt ${publicOrigin} — a kör a fő fára futna. Leállok.`);
  process.exit(2);
}

const STAMP = `${Date.now()}`;
const ids = { def: "", run: "", lead: "", tenant: "", prospect: "", artifact: "", site: "" };

async function reap(): Promise<void> {
  if (ids.tenant) {
    const orders = await db
      .selectFrom("order_intent")
      .select("id")
      .where((eb) => eb.or([eb("tenant_id", "=", ids.tenant), ...(ids.prospect ? [eb("prospect_id", "=", ids.prospect)] : [])]))
      .execute();
    const orderIds = orders.map((o) => o.id as string);
    if (orderIds.length) {
      const pays = await db.selectFrom("payment").select("id").where("order_intent_id", "in", orderIds).execute();
      const payIds = pays.map((p) => p.id as string);
      if (payIds.length) {
        await db.deleteFrom("invoice").where("payment_id", "in", payIds).execute().catch((e) => console.error("reap invoice:", e.message));
        await db.deleteFrom("payment").where("id", "in", payIds).execute().catch((e) => console.error("reap payment:", e.message));
      }
    }
    await db.deleteFrom("saved_card_history").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    await db.deleteFrom("subscription").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    if (orderIds.length) await db.deleteFrom("order_intent").where("id", "in", orderIds).execute().catch((e) => console.error("reap order:", e.message));
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
    if (ids.site) await db.deleteFrom("site").where("id", "=", ids.site).execute().catch((e) => console.error("reap site:", e.message));
    await db.deleteFrom("tenant_user").where("tenant_id", "=", ids.tenant).execute().catch(() => {});
  }
  if (ids.prospect) await db.deleteFrom("prospect").where("id", "=", ids.prospect).execute().catch((e) => console.error("reap prospect:", e.message));
  if (ids.tenant) await db.deleteFrom("tenant").where("id", "=", ids.tenant).execute().catch((e) => console.error("reap tenant:", e.message));
  if (ids.artifact) await db.deleteFrom("mock_artifact").where("id", "=", ids.artifact).execute().catch(() => {});
  if (ids.lead) await db.deleteFrom("lead").where("id", "=", ids.lead).execute().catch((e) => console.error("reap lead:", e.message));
  if (ids.run) await db.deleteFrom("scrape_run").where("id", "=", ids.run).execute().catch(() => {});
  if (ids.def) await db.deleteFrom("scraper_definition").where("id", "=", ids.def).execute().catch(() => {});
}

let browser: import("playwright-core").Browser | null = null;
try {
  // ── fixture: a live-ish tenant with a stored Visa ····4242 mandate ──────────
  const NAME = "Tölgyfa Vendégház";
  const def = await db.insertInto("scraper_definition").values({ label: `wallettour${STAMP}`, country: "HU", region: "wt", industry: "szallas" } as never).returning("id").executeTakeFirstOrThrow();
  ids.def = def.id as string;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: ids.def } as never).returning("id").executeTakeFirstOrThrow();
  ids.run = run.id as string;
  const lead = await db.insertInto("lead").values({ scrape_run_id: ids.run, name: NAME, raw: sql`'{}'::jsonb` } as never).returning("id").executeTakeFirstOrThrow();
  ids.lead = lead.id as string;
  const tenant = await db.insertInto("tenant").values({ lead_id: ids.lead, display_name: NAME } as never).returning("id").executeTakeFirstOrThrow();
  ids.tenant = tenant.id as string;
  const user = await db
    .insertInto("tenant_user")
    .values({ tenant_id: ids.tenant, contact_email: "tolgyfa@example.com", username: `wallettour${STAMP}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: ids.lead,
      status: "approved",
      inputs: sql`${JSON.stringify({
        recipe: { template: "editorial", skin: "editorial-warm", archetype: "classic", sections: [{ kind: "hero" }, { kind: "enquiry" }] },
        siteData: { name: NAME, tagline: "Csend a Balaton-felvidéken", intro: "Két apartman, nagy kert.", highlights: ["Kert"], photos: [], contact: { email: "tolgyfa@example.com" } },
      })}::jsonb`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.artifact = artifact.id as string;
  const site = await db
    .insertInto("site")
    .values({ tenant_id: ids.tenant, preview_token: `wt${STAMP}`, source_artifact_id: ids.artifact, status: "provisioned", path: `sites/${ids.tenant}/index.html`, slug: `wallettour${STAMP}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.site = site.id as string;
  const prospect = await db.insertInto("prospect").values({ lead_id: ids.lead, token: `wallettour-${STAMP}` }).returning("id").executeTakeFirstOrThrow();
  ids.prospect = prospect.id as string;
  const buyer = {
    buyer_type: "business",
    buyer_tax_number: "12345678-2-42",
    buyer_name: "Tölgyfa Vendégház Kft.",
    buyer_country: "HU",
    buyer_zip: "8230",
    buyer_city: "Balatonfüred",
    buyer_address: "Tölgyfa u. 3.",
    buyer_email: "tolgyfa@example.com",
    vat_treatment: "aam",
  };
  const DAY = 86_400_000;
  const savedAt = new Date(Date.now() - 58 * DAY);
  const initial = await db
    .insertInto("order_intent")
    .values({ prospect_id: ids.prospect, kind: "initial", price: 6070, billing_period: "monthly", modules: JSON.stringify([]), status: "submitted", submitted_at: savedAt, ...buyer } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  // The initiating payment — its id IS the token (service.ts recurrenceId), so the
  // "Terhelések ezen a kártyán" list has a real first row.
  const initPay = await db
    .insertInto("payment")
    .values({ order_intent_id: initial.id as string, amount: 6070, period: "monthly", gateway: "mock", gateway_ref: `mock_seed_${STAMP}`, pay_url: "seed", status: "paid", initiates_recurrence: true, created_at: savedAt, paid_at: savedAt } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const renewal = await db
    .insertInto("order_intent")
    .values({ prospect_id: ids.prospect, tenant_id: ids.tenant, kind: "renewal", price: 6070, billing_period: "monthly", modules: JSON.stringify([]), status: "submitted", submitted_at: new Date(Date.now() - 28 * DAY), ...buyer } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const renewedAt = new Date(Date.now() - 28 * DAY);
  await db
    .insertInto("payment")
    .values({ order_intent_id: renewal.id as string, amount: 6070, period: "monthly", gateway: "mock", gateway_ref: `mock_mit_seed_${STAMP}`, pay_url: null, status: "paid", created_at: renewedAt, paid_at: renewedAt } as never)
    .execute();
  const periodEnd = new Date(Date.now() + 2 * DAY);
  await db
    .insertInto("subscription")
    .values({
      tenant_id: ids.tenant,
      status: "active",
      current_period_start: renewedAt,
      current_period_end: periodEnd,
      anchor_date: periodEnd,
      billing_period: "monthly",
      payment_method: "token",
      recurrence_token: initPay.id as string,
      card_brand: "Visa",
      card_last4: "4242",
      card_exp_month: 8,
      card_exp_year: 2028,
      card_saved_at: savedAt,
    } as never)
    .execute();

  // ── servers (this tree, ephemeral ports) ────────────────────────────────────
  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: HttpServer };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: HttpServer };
  if (!publicServer.listening) await once(publicServer, "listening");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const cookie = mintTenantCookieValue(user.id as string);

  browser = await chromium.launch({ executablePath: config.chromiumPath });
  const mk = async (width: number) => {
    const ctx = await browser!.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1 });
    await ctx.addCookies([{ name: "cit_session", value: cookie, url: publicOrigin }]);
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(`${e.message} @ ${page.url()}`));
    return { page, errs };
  };
  const desk = await mk(1280);
  const mob = await mk(390);
  const P = desk.page;

  let n = 0;
  /** Shoot the desktop page as it is, and the SAME url on the phone (optionally
   *  put into the same UI state by `prep`). Full page: these are review images. */
  /** The cookie bar covers the lower edge of every shot — decline it once per context
   *  (the choice is a cookie, so it holds for the rest of the run). */
  async function dismissCookies(p: import("playwright-core").Page): Promise<void> {
    const b = p.getByRole("button", { name: "Csak a szükségeseket" });
    if (await b.isVisible().catch(() => false)) await b.click();
  }
  /** The "Korábbi kártyák" list is a closed <details>: open it, so the image shows
   *  what the owner sees after one tap. */
  async function openHistory(p: import("playwright-core").Page): Promise<void> {
    const d = p.locator("details").filter({ hasText: "Korábbi kártyák" });
    if (await d.count()) await d.first().evaluate((el) => ((el as HTMLDetailsElement).open = true));
  }
  /** ⛔ NOT fullPage: a full-page capture paints the FIXED phone nav at the viewport's
   *  position, over the middle of the content (measured: it hid „Korábbi kártyák").
   *  Stretch the viewport to the document instead, so fixed bars sit where they do
   *  on a real screen — at the bottom — and nothing is covered. Restored after. */
  async function tallShot(p: import("playwright-core").Page, file: string): Promise<void> {
    // The Modulok tab is ~10 000 px tall on a phone: the decision there is the plan bar /
    // the confirm card / the result banner, all in the viewport — shoot just that.
    if (/tab=modulok/.test(p.url()) && (p.viewportSize()?.width ?? 0) < 600) {
      await p.screenshot({ path: file });
      return;
    }
    const vp = p.viewportSize()!;
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
    await p.waitForTimeout(100);
    await p.screenshot({ path: file });
    await p.setViewportSize(vp);
  }
  async function shot(name: string, prep?: (p: import("playwright-core").Page) => Promise<void>): Promise<void> {
    n++;
    await dismissCookies(P);
    if (P.url().includes("tab=penztarca")) await openHistory(P);
    const tag = `${String(n).padStart(2, "0")}-${name}`;
    await tallShot(P, path.join(OUT, `${tag}-asztali.png`));
    await mob.page.goto(P.url());
    await dismissCookies(mob.page);
    if (mob.page.url().includes("tab=penztarca")) await openHistory(mob.page);
    if (prep) await prep(mob.page);
    await mob.page.waitForTimeout(150);
    await tallShot(mob.page, path.join(OUT, `${tag}-mobil.png`));
  }
  const text = async (p: import("playwright-core").Page) => ((await p.locator("body").innerText()) ?? "").replace(/\s+/g, " ");
  const openChange = async (p: import("playwright-core").Page) => {
    await p.locator("[data-wal-change]").click();
    await p.locator("[data-wal-modal]").waitFor({ state: "visible" });
  };

  // ── 1. Kártya cseréje — siker ──────────────────────────────────────────────
  console.log("1) Kártya cseréje → mock fizetőlap → MasterCard ····8810");
  await P.goto(`${publicOrigin}/admin?tab=penztarca`);
  let t = await text(P);
  ok(t.includes("AUTOMATIKUS TERHELÉS BEKAPCSOLVA") && t.includes("4242"), "kiindulás: Visa ····4242, bekapcsolva");
  await shot("penztarca-kiindulas");

  await openChange(P);
  t = await text(P);
  ok(t.includes("Tovább a bankkártyás megerősítéshez") && t.includes("Mégsem"), "tájékoztató ablak: a két gomb");
  await shot("csere-ablak", openChange);

  await P.getByRole("button", { name: "Tovább a bankkártyás megerősítéshez" }).click();
  await P.waitForURL(/\/pay\/mock\//);
  ok(P.url().startsWith(consoleOrigin), "a mock fizetőlap a FÁ konzolján nyílik (nem a fő fán)", P.url());
  ok((await P.locator('input[name="card"]').count()) === 2, "fizetőlap: két próbakártya a választóban");
  await shot("csere-fizetolap");
  await P.locator('input[name="card"][value="mc8810"]').check();
  await P.locator('form[action$="/paid"] button[type="submit"]').click();
  await P.waitForURL(/tab=penztarca/);
  ok(P.url().includes("card=ok"), "visszatérés: ?tab=penztarca&card=ok", P.url());
  await openHistory(P);
  t = await text(P);
  ok(t.includes("···· ···· ···· 8810") && /MASTERCARD/i.test(t), "a kártya-kép: MASTERCARD ····8810");
  ok(t.includes("Korábbi kártyák (1)") && t.includes("cserélve") && t.includes("4242"), "előzmény: Korábbi kártyák (1), ····4242 cserélve");
  ok(t.includes("Kész: a mentett kártya ezután"), "siker-sáv");
  await shot("csere-siker");

  // ── 1b. Elutasítás-ág ──────────────────────────────────────────────────────
  console.log("1b) Kártya cseréje → a bank elutasítja → semmi nem változik");
  await P.goto(`${publicOrigin}/admin?tab=penztarca`);
  await openChange(P);
  await P.getByRole("button", { name: "Tovább a bankkártyás megerősítéshez" }).click();
  await P.waitForURL(/\/pay\/mock\//);
  const declineBtn = P.locator('form[action$="/failed"] button[type="submit"]');
  ok(((await declineBtn.textContent()) ?? "").includes("A bank elutasítja (próba)"), "fizetőlap: „A bank elutasítja (próba)” gomb", (await declineBtn.textContent()) ?? "");
  await declineBtn.click();
  await P.waitForURL(/tab=penztarca/);
  ok(P.url().includes("card=fail"), "visszatérés: card=fail", P.url());
  t = await text(P);
  ok(t.includes("···· ···· ···· 8810") && t.includes("Korábbi kártyák (1)"), "semmi nem változott: ····8810, előzmény 1");
  ok(t.includes("A bank elutasította a megerősítést"), "elutasítás-sáv");
  await shot("csere-elutasitva");

  // ── 2. Modul-vásárlás másik kártyával ──────────────────────────────────────
  console.log("2) Modulok → fizetős modul → Másik kártyával → mock fizetőlap → Visa ····4242");
  const pickPaid = async (p: import("playwright-core").Page): Promise<string | null> => {
    const box = p.locator('input[name="module"][data-committed="0"][data-price]:not([data-price="0"])').first();
    if ((await box.count()) === 0) return null;
    const id = await box.getAttribute("value");
    // The checkbox is visually hidden inside its "Hozzáadom" button-label — click
    // what the owner clicks.
    await box.locator("xpath=ancestor::label[1]").click();
    await p.locator("#adm-plan-card").waitFor({ state: "visible" });
    await p.locator('input[name="card"][value="new"]').check();
    return id;
  };
  await P.goto(`${publicOrigin}/admin?tab=modulok`);
  const moduleId = await pickPaid(P);
  ok(!!moduleId, "van fizetős, nem birtokolt modul", String(moduleId));
  const applyText = ((await P.locator("#adm-plan-apply").textContent()) ?? "").trim();
  ok(applyText.includes("Fizetés másik kártyával"), "a gomb felirata: „Fizetés másik kártyával — …”", applyText);
  ok((await text(P)).includes("Ez a kártya lesz ezután a mentett kártya"), "az ígéret a sávban");
  await shot("modul-masik-kartya", async (p) => {
    await pickPaid(p);
  });
  // 390 px: the plan bar shares the bottom edge with the fixed 3-row phone nav — can
  // the owner actually reach (hit) the pay button, after scrolling to it?
  {
    const m = mob.page; // already in the "másik kártya" state from the shot's prep
    const btn = m.locator("#adm-plan-apply");
    await btn.scrollIntoViewIfNeeded();
    const hit = await btn.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hit: !!top && (top === el || el.contains(top)), y: Math.round(r.top), h: innerHeight, over: top?.className ?? "" };
    });
    ok(hit.hit, "390 px: a fizetés-gomb görgetés után kattintható (nem takarja a navigáció)", JSON.stringify(hit));
  }
  // ADR-0113: a paid addition confirms on an itemised card first.
  const openConfirm = async (p: import("playwright-core").Page) => {
    await p.locator("#adm-plan-apply").click();
    await p.locator("[data-fc-modal]").waitFor({ state: "visible" });
  };
  await openConfirm(P);
  const goText = ((await P.locator("[data-fc-go]").textContent()) ?? "").trim();
  console.log(`    megerősítő ablak gombja: „${goText}”`);
  await shot("modul-megerosites", async (p) => {
    await pickPaid(p);
    await openConfirm(p);
  });
  await P.locator("[data-fc-go]").click();
  await P.waitForURL(/\/pay\/mock\//);
  ok((await P.locator('input[name="card"]').count()) === 2, "fizetőlap: kártyaválasztó (a fizetés tokent kér)");
  await shot("modul-fizetolap");
  await P.locator('input[name="card"][value="visa4242"]').check();
  await P.locator('form[action$="/paid"] button[type="submit"]').click();
  await P.waitForURL(new RegExp(`^${publicOrigin.replace(/[.]/g, "\\.")}/admin`));
  ok(P.url().includes("tab=modulok"), "visszatérés a Modulok fülre", P.url());
  {
    const b = P.getByText("bekapcsol", { exact: false }).first();
    const y = await b.evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY)).catch(() => -1);
    console.log(`    fizetés utáni visszajelzés a lapon: y=${y}px (asztali)`);
  }
  await shot("modul-fizetve");
  const ent = await db.selectFrom("module_entitlement").select(["module", "active"]).where("tenant_id", "=", ids.tenant).where("module", "=", moduleId ?? "").executeTakeFirst();
  ok(!!ent && ent.active === true, `a modul él (${moduleId})`);
  await P.goto(`${publicOrigin}/admin?tab=penztarca`);
  await openHistory(P);
  t = await text(P);
  ok(t.includes("···· ···· ···· 4242") && /VISA/i.test(t), "Pénztárca: az új kártya VISA ····4242");
  ok(t.includes("Korábbi kártyák (2)") && t.includes("8810"), "előzmény: a ····8810 is cserélve (2)");
  await shot("penztarca-modul-utan");

  // ── 3. Megbízás visszavonása ───────────────────────────────────────────────
  console.log("3) Megbízás visszavonása → vissza a Pénztárcába");
  const openRevoke = async (p: import("playwright-core").Page) => {
    await p.locator("[data-mand-revoke]").first().click();
    await p.locator("[data-mand-modal]").waitFor({ state: "visible" });
  };
  await openRevoke(P);
  await shot("visszavonas-ablak", openRevoke);
  await P.getByRole("button", { name: "Igen, visszavonom a megbízást" }).click();
  await P.waitForURL(/tab=penztarca/);
  await openHistory(P);
  t = await text(P);
  ok(t.includes("NINCS MENTETT KÁRTYA"), "NINCS MENTETT KÁRTYA");
  ok(t.includes("visszavonva"), "előzmény: visszavonva");
  ok((await P.locator("[data-wal-change]").textContent())?.includes("Kártya megadása") ?? false, "gomb: Kártya megadása");
  await shot("visszavonva");

  ok(desk.errs.length === 0 && mob.errs.length === 0, "JS-hiba nincs", [...desk.errs, ...mob.errs].join(" | "));
} finally {
  await browser?.close().catch(() => {});
  await reap();
  await db.destroy().catch(() => {});
}

console.log(`\nképek: ${OUT}`);
if (failures) {
  console.error(`wallet-tour: ${failures} eltérés.`);
  process.exit(1);
}
console.log("✅ wallet-tour: a három út a mock átjárón végigment.");
process.exit(0);
