// ⛔⛔ EGY KEREKÍTÉSI SZABÁLY — a képernyő száma és a terhelés száma ugyanaz.
//
// A MÉRT LELET (ADR-0192 ⑧.2, 2026-09-21). A kupon-kerekítés KÉT példányban élt:
//   · kliens (`adminViews.ts`):  MODULONKÉNT  `Math.floor(p*FCM*(100-CPCT)/100)`, majd összeg
//   · szerver (`moduleUpsell.ts`): a VÉGÖSSZEGEN `applyOffer(monthly*months)`
// `sum(floor(x))` és `floor(sum(x))` nem ugyanaz a függvény. Élő adaton mérve: **1 626 Ft a
// képernyőn, 1 627 a terhelésen** — a vevő mást lát, mint amit a kártyájáról levonunk.
//
// ⛔ AMIÉRT EDDIG EGYETLEN ZÖLD SEM ÉRT SEMMIT: a park egyetlen upsellje ÉVES, és ott a két
// út VÉLETLENÜL egybeesik. Ezért ez az őr HAVI kosarat mér, és — mielőtt bármit állítana —
// BEBIZONYÍTJA, hogy a fixture meg tudja különböztetni a két szabályt (⑤). Egy fixture, ami
// a hibás kódon is zöld, nem fixture.
//
// Amit mér — a RENDERELT lapon, valódi böngészőben, ÉS a valódi rendelés-úton:
//   ① a sáv „Fizetendő most" száma == a FÜGGETLEN referencia-számítás
//   ② a `createFirstChargeOrder()` által a `order_intent`-be írt ár == ugyanaz
//   ③ ⭐ a kettő EGYENLŐ (ez a bejelentett hiba maga)
//   ④ a megerősítő kártya SORAI pontosan a kártya VÉGÖSSZEGÉT adják ki
//      (különben a lap olyan tételeket sorolna, amik nem adják ki a saját alsó sorát)
//   ⑤ ⭐⭐ a fixture DISZKRIMINÁL: a történeti (modulonkénti) szabály MÁS számot adna
//   ⑥ éves ütemben is egyeznek (a javítás nem rontotta el azt az utat, ahol eddig jó volt)
//
// ⚠️ A referencia-számítás SZÁNDÉKOSAN nem a `couponRule`-t hívja: egy őr, ami a vizsgált
// függvénnyel mér, minden visszarontást zölden átenged (feedback_guard_must_not_borrow_its_subject).
//
// Futtatás:
//   npx tsx scripts/coupon-rounding-check.mts
//   npx tsx scripts/coupon-rounding-check.mts --self-test   ← PIROSNAK KELL LENNIE
//
// Az önteszt a lapra visszateszi a TÖRTÉNETI kliens-szabályt (modulonkénti kerekítés,
// összegezve), újraszinkronizál, és ugyanazokat az állításokat futtatja le.

process.env.CIT_SHOT = "1";

import { readFileSync } from "node:fs";
import path from "node:path";

import { chromium, type Page } from "playwright-core";

import { db, pool } from "../src/db/client.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getModulePrice, loadPricing } from "../src/pricing.js";
import { COUPON_JS } from "../src/payment/couponRule.js";
import { modulesSection } from "../src/server/adminViews.js";
import { getTenantModules, setTenantModules } from "../src/tenant/modules.js";
import { createFirstChargeOrder, proratedFirstChargeMonths } from "../src/tenant/moduleUpsell.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    bad++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/**
 * THE INDEPENDENT ORACLE — this guard's own arithmetic, written out in full.
 *
 * The whole basket is prorated, then discounted, then floored ONCE. Deliberately not a
 * call into couponRule: the question is whether the product agrees with the rule, and an
 * oracle that IS the rule can only ever answer "yes".
 */
function referenceTotal(prices: readonly number[], months: number, percent: number): number {
  const list = prices.reduce((s, p) => s + p, 0) * months;
  return Math.floor((list * (100 - percent)) / 100);
}

/** The HISTORICAL client rule: discount each module, then add. Kept to prove ⑤ and ⑥. */
function perModuleTotal(prices: readonly number[], months: number, percent: number): number {
  return prices.reduce((s, p) => s + Math.floor((p * months * (100 - percent)) / 100), 0);
}

/** "1 627 Ft" / "1 627 Ft" (nbsp) → 1627. */
function money(s: string): number | null {
  const m = /(\d[\d\s .]*)/.exec(s ?? "");
  if (!m) return null;
  const n = Number(m[1]!.replace(/[\s .]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isoInDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const CSS =
  readFileSync(path.join(ROOT, "public/assets/ui/citui.css"), "utf8") +
  "\n" +
  readFileSync(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8");

const mkSub = (
  period: "monthly" | "annual",
  periodEnd: string,
  percent: number,
): SubscriptionAdminData =>
  ({
    status: "active",
    periodEnd,
    renewDay: Number(periodEnd.slice(8, 10)),
    nextInvoiceTotal: 0,
    nextInvoiceItems: [],
    payUrl: null,
    arrears: null,
    closesOn: null,
    frozenOn: null,
    restoredOn: null,
    cancelAtPeriodEnd: false,
    billingPeriod: period,
    pendingAnnual: false,
    pendingEffectiveDate: null,
    annualTotal: 0,
    annualSavings: 0,
    annualFreeMonths: 0,
    autoCharge: false,
    coupon: { percent, expiresAt: null },
  }) as unknown as SubscriptionAdminData;

/**
 * The red control: the SAME page, served with the HISTORICAL rule in place of the shared
 * one. The rule is spliced into the delivered HTML (the admin script inlines
 * assets/runtime/cit-coupon.cjs verbatim), so the browser runs pre-2026-09-21 arithmetic
 * through the unmodified product code around it.
 *
 * ⛔ Overriding `CitCoupon` from page.evaluate() does NOT work and must not be attempted:
 * the admin script is an IIFE, so the `var` never reaches `window` — the first version of
 * this control died on "CitCoupon is not defined" instead of quietly measuring nothing.
 */
const HISTORICAL_JS = `var CitCoupon = {
  discount: function (a, p) { return Math.floor((a * (100 - p)) / 100); },
  splitFirstCharge: function (prices, months, percent) {
    var lines = [], total = 0;
    for (var i = 0; i < prices.length; i++) {
      var v = Math.floor((prices[i] * months * (100 - percent)) / 100);
      lines.push(v); total += v;
    }
    return { lines: lines, total: total };
  }
};`;

const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string } = {};
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

try {
  await loadPricing();

  // ── the basket: three paid, non-spine, recurring modules ────────────────────
  const BASKET = MODULE_CATALOG.filter(
    (m) => !m.spine && m.billing !== "once" && getModulePrice(m.id) > 0,
  )
    .slice(0, 3)
    .map((m) => m.id);
  const PRICES = BASKET.map((id) => getModulePrice(id));
  if (BASKET.length < 2) throw new Error("a katalógusban nincs elég fizetős modul a méréshez");

  // ⭐⭐ THE DISCRIMINATING COUPON, derived — not guessed. The percentage is picked so
  // that the two rules PROVABLY disagree on this basket; if no percentage can separate
  // them, this guard cannot prove anything and says so instead of printing a green line.
  const MONTHS = 1; // monthly period ⇒ proratedFirstChargeMonths caps at 1
  let PCT = 0;
  for (let p = 1; p <= 99; p++) {
    if (referenceTotal(PRICES, MONTHS, p) !== perModuleTotal(PRICES, MONTHS, p)) {
      PCT = p;
      break;
    }
  }
  console.log(
    `Kosár: ${BASKET.join(" + ")} = ${PRICES.join(" + ")} Ft/hó · ${MONTHS} hó · kupon ${PCT}%`,
  );
  check(
    "⭐⭐ a fixture DISZKRIMINÁL: a történeti szabály MÁS számot ad erre a kosárra",
    PCT > 0 && referenceTotal(PRICES, MONTHS, PCT) !== perModuleTotal(PRICES, MONTHS, PCT),
    { referencia: referenceTotal(PRICES, MONTHS, PCT), tortenetei: perModuleTotal(PRICES, MONTHS, PCT) },
  );
  if (!PCT) throw new Error("egyetlen kupon-százalék sem választja szét a két szabályt");

  const EXPECTED = referenceTotal(PRICES, MONTHS, PCT);
  const HISTORICAL = perModuleTotal(PRICES, MONTHS, PCT);

  // ── fixture: a tenant who owns nothing paid, with a live purchase coupon ────
  const stamp = Date.now().toString(36);
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_coupon_check",
      country: "HU",
      region: "_test",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "_coupon_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `coupon_${stamp}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_coupon_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  // createFirstChargeOrder inherits the billing identity from the latest DECLARED
  // order — without it there is no order at all (fail-closed, by design).
  await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      // `initial` REQUIRES a null tenant_id (order_intent_upsell_tenant_chk) — the
      // buyer is resolved through prospect → lead → tenant, not through this column.
      kind: "initial",
      modules: JSON.stringify([]),
      price: 0,
      billing_period: "monthly",
      status: "submitted",
      submitted_at: new Date(),
      buyer_type: "individual",
      buyer_name: "Kupon Teszt",
      buyer_country: "HU",
      buyer_zip: "1111",
      buyer_city: "Budapest",
      buyer_address: "Teszt u. 1.",
      buyer_email: "kupon@example.com",
    } as never)
    .execute();
  await db
    .insertInto("offer")
    .values({
      tenant_id: tenant.id,
      kind: "coupon",
      scope: "purchase",
      percent: PCT,
      max_uses: 1,
      used_count: 0,
    } as never)
    .execute();
  await setTenantModules(tenant.id, []);

  const periodEnd = isoInDays(20);
  check(
    "a havi ütem 1 hónapra árazza az első terhelést (az őr feltevése MÉRVE)",
    proratedFirstChargeMonths("monthly", new Date(periodEnd)) === MONTHS,
    proratedFirstChargeMonths("monthly", new Date(periodEnd)),
  );

  // ── ② the CHARGE: the real order-writing path ───────────────────────────────
  const order = await createFirstChargeOrder(tenant.id, BASKET, "monthly", new Date(periodEnd));
  check("a rendelés létrejött", Boolean(order), order);
  check(
    "② a TERHELÉS (order_intent.price) a referencia-számítással egyezik",
    order?.price === EXPECTED,
    { terheles: order?.price, referencia: EXPECTED },
  );

  // ── ① the SCREEN: the rendered Modulok tab, in a browser ────────────────────
  const mv = await getTenantModules(tenant.id);
  for (const id of BASKET) {
    check(
      `a(z) \`${id}\` modul kapcsolható a lapon (nem letiltott eladás)`,
      mv.modules.some((m) => m.id === id && !m.active),
      mv.modules.map((m) => m.id),
    );
  }

  let html =
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head>` +
    `<body><div class="adm-shell"><main class="adm-main"><div class="adm-main__inner">` +
    modulesSection(mv, mkSub("monthly", periodEnd, PCT), null, "hello@citoviso.com", null, "hu") +
    `</div></main></div></body></html>`;

  check(
    "a KÖZÖS kerekítési szabály tényleg kiment a lapra (nem egy második példány)",
    html.includes(COUPON_JS),
  );
  if (SELF_TEST) {
    const regressed = html.replace(COUPON_JS, HISTORICAL_JS);
    // A no-op replace would make the self-test measure the FIXED page and call its green
    // "the guard is blind" — the loudest possible lie. It must be provably applied.
    check("önteszt: a történeti szabály beépült a lapba", regressed !== html);
    html = regressed;
  }

  browser = await chromium.launch();
  const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const jsErrors: string[] = [];
  page.on("pageerror", (e) => jsErrors.push(String(e)));
  await page.setContent(html, { waitUntil: "load" });

  for (const id of BASKET) {
    await page.evaluate((mid) => {
      const cb = document.querySelector<HTMLInputElement>(
        `input[name="module"][value="${mid}"][data-committed]`,
      );
      if (cb) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, id);
  }

  check("a lapon nincs JS-hiba", jsErrors.length === 0, jsErrors);

  const barText = await page.locator("#adm-plan-paysum").textContent();
  const screenTotal = money(barText ?? "");
  check(
    "① a SÁV „Fizetendő most" + `" száma a referencia-számítással egyezik`,
    screenTotal === EXPECTED,
    { kepernyo: screenTotal, referencia: EXPECTED },
  );

  check(
    "③ ⭐ a KÉPERNYŐ és a TERHELÉS ugyanazt a számot mondja",
    screenTotal !== null && screenTotal === order?.price,
    { kepernyo: screenTotal, terheles: order?.price },
  );

  // ── ④ the confirm card: its own lines must add up to its own total ──────────
  await page.locator("#adm-plan-apply").click();
  await page.waitForSelector("[data-fc-modal]:not([hidden])", { timeout: 5000 });
  const cardLines = await page.$$eval(".adm-fc__line", (els) =>
    els.map((e) => ({
      total: e.classList.contains("adm-fc__line--total"),
      value: e.querySelector("b")?.textContent ?? "",
    })),
  );
  const items = cardLines.filter((l) => !l.total).map((l) => money(l.value) ?? 0);
  const cardTotal = money(cardLines.find((l) => l.total)?.value ?? "");
  check(
    "④ a megerősítő kártya SORAI pontosan a kártya végösszegét adják ki",
    items.length === BASKET.length && items.reduce((s, v) => s + v, 0) === cardTotal,
    { sorok: items, osszeg: cardTotal },
  );
  check(
    "a kártya végösszege is a referencia-szám",
    cardTotal === EXPECTED,
    { kartya: cardTotal, referencia: EXPECTED },
  );

  // ── ⑥ the annual path, where the two rules used to agree by accident ────────
  const annualEnd = isoInDays(300);
  const annualMonths = proratedFirstChargeMonths("annual", new Date(annualEnd));
  const annualOrder = await createFirstChargeOrder(
    tenant.id,
    BASKET,
    "annual",
    new Date(annualEnd),
  );
  check(
    "⑥ éves ütemben is a referencia-szám megy a rendelésre",
    annualOrder?.price === referenceTotal(PRICES, annualMonths, PCT),
    { rendeles: annualOrder?.price, referencia: referenceTotal(PRICES, annualMonths, PCT) },
  );

  console.log(
    `\n  (referencia: ${EXPECTED} Ft · a történeti, modulonkénti szabály: ${HISTORICAL} Ft — ` +
      `${Math.abs(EXPECTED - HISTORICAL)} Ft eltérés)`,
  );
} finally {
  await browser?.close();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}

if (SELF_TEST) {
  if (bad) {
    console.log(`\n✅ önteszt: a történeti kliens-szabályon ${bad} állítás pirosra ment — az őr lát.`);
    process.exit(0);
  }
  console.error("\n⛔ ÖNTESZT-BUKÁS: a modulonkénti kerekítés ZÖLD maradt — az őr VAK.");
  process.exit(1);
}

if (bad) {
  console.error(`\n⛔ coupon-rounding-check: ${bad} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ coupon-rounding-check: egy kerekítési szabály — a képernyő és a terhelés egy szám.");
