#!/usr/bin/env npx tsx
/**
 * ADMIN CART DEPENDENCY guard — when a shop card brings other paid modules into the
 * cart (ADR-0192: booking → pricing → rooms), the owner is TOLD, at the click and in
 * the cart: what came in, why, what each costs, and the total effect (now + monthly).
 *
 *   npx tsx scripts/admin-cart-dependency-check.mts [--self-test]
 *
 * THE MEASURED HOLE (Elek ADM-1, live 2026-10-02, tenant `teszt-muschel-panzio`): "Online
 * foglalás" → „Kosárba teszem” put THREE lines in the cart — „+ bekapcsol · Szobák,
 * apartmanok”, „+ bekapcsol · Árak, szezonok”, „+ bekapcsol · Online foglalás” — and said
 * nothing about why. The owner expected 742 Ft and saw 1 627 Ft; the monthly fee rose by
 * 2 170 Ft, not 990. The module-dependency contract (2026-09-21) bound the explanation to
 * the module ROW; the 2026-09-28 cart (ADR-0255) moved buying onto shop cards, which never
 * carried the pill or the rail, and the cart listed flat lines. module-dependency-cart-check
 * is green throughout: it drives the LEAD configurator, not the tenant admin.
 *
 * Contract: assets/design-refs/console/modules-cart-dependency/ (owner: B, 2026-10-02).
 *
 * Measures, on the REAL modulesSection() render in a browser, at 390 and 1280 px:
 *   ① the click: rooms + pricing are ticked; the driver card shows the notice naming both,
 *     with "most" = the cart's own „Fizetendő most” and the monthly delta
 *   ② the cart groups: one driver line, two „ehhez jár” sub-lines, each with its OWN
 *     catalogue sentence (booking→pricing, pricing→rooms), line amounts sum to the total,
 *     and the summary sentence says „együtt +2 170 Ft/hó”
 *   ③ the brought-in shop cards carry the „együtt jár” pill and the rail
 *   ④ no raw catalogue id on screen; zero JS errors
 *   ⑤ removing the driver gives everything back: empty cart, no notice
 *
 * --self-test: the same run on origin/main's PRE-FIX adminViews.ts — must go RED.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { MODULE_CATALOG } from "../src/modules.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");
const PRE_FIX_REF = "3e4eb7ac"; // origin/main when ADM-1 was measured
let failures = 0;
const check = (label: string, pass: boolean, detail: unknown = ""): void => {
  if (!pass) failures++;
  const d = typeof detail === "string" ? detail : JSON.stringify(detail);
  console.log(`  ${pass ? "✅" : "❌"} ${label}${!pass && d ? ` — ${d.slice(0, 400)}` : ""}`);
};

const ROOT = process.cwd();
const CSS =
  readFileSync(path.join(ROOT, "public/assets/ui/citui.css"), "utf8") +
  "\n" +
  readFileSync(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8");

// Elek's account: gallery + enquiry + location, 25% welcome coupon, renewal in a month.
const OWNED = new Set(["gallery", "enquiry", "location"]);
const mv: TenantModuleView = {
  modules: MODULE_CATALOG.filter((m) => !m.retired).map((m) => ({
    id: m.id,
    label: m.publicLabel,
    publicDesc: m.publicDesc,
    group: m.group,
    spine: Boolean(m.spine),
    active: OWNED.has(m.id),
    priceMonthly: m.priceMonthly,
    supersededBy: null,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  })),
  baseMonthly: 3900,
  totalMonthly: 4880,
};
const periodEnd = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
const sub = {
  status: "active",
  periodEnd,
  renewDay: Number(periodEnd.slice(8, 10)),
  nextInvoiceTotal: 4880,
  nextInvoiceItems: [],
  payUrl: null,
  arrears: null,
  closesOn: null,
  frozenOn: null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 0,
  annualSavings: 0,
  annualFreeMonths: 2,
  autoCharge: false,
  cardLabel: null,
  coupon: { percent: 25, expiresAt: "2026-12-31", kind: "coupon" },
  keptOffers: [],
} as unknown as SubscriptionAdminData;

const cat = (id: string) => MODULE_CATALOG.find((m) => m.id === id)!;
const WHY_BOOKING_PRICING = cat("booking").requires!.find((r) => r.id === "pricing")!.why;
const WHY_PRICING_ROOMS = cat("pricing").requires!.find((r) => r.id === "rooms")!.why;
const MONTHLY = cat("booking").priceMonthly + cat("pricing").priceMonthly + cat("rooms").priceMonthly;
const money = (s: string | null): number | null => {
  const m = (s ?? "").replace(/[\s  ]/g, "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
};
const huf = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

type ModulesSection = (typeof import("../src/server/adminViews.js"))["modulesSection"];
let modulesSection: ModulesSection;
let tmp = "";
if (SELF_TEST) {
  tmp = path.resolve("src/server/.__selftest_cart_adminViews.ts");
  await writeFile(
    tmp,
    execFileSync("git", ["show", `${PRE_FIX_REF}:src/server/adminViews.ts`], { encoding: "utf8", maxBuffer: 64 << 20 }),
  );
  modulesSection = (await import(tmp)).modulesSection as ModulesSection;
} else {
  modulesSection = (await import("../src/server/adminViews.js")).modulesSection;
}

const html =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head>` +
  `<body><div class="adm-shell"><main class="adm-main"><div class="adm-main__inner">` +
  modulesSection(mv, sub, null, "hello@citoviso.com", null, "hu", null, "yes") +
  `</div></main></div></body></html>`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const visibleText = (p: Page, sel: string) =>
  p.evaluate((s) => {
    const el = document.querySelector<HTMLElement>(s);
    return el && el.offsetParent !== null ? el.innerText.replace(/\s+/g, " ").trim() : "";
  }, sel);

try {
  for (const [name, width] of [["mobil 390", 390], ["asztali 1280", 1280]] as const) {
    console.log(`\n[${name}]`);
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(String(e)));
    await page.setContent(html, { waitUntil: "load" });

    // ① the click — on the shop card's own button, as the owner does it
    await page.locator('#mod-booking label.adm-shop__add').click();
    const ticked = await page.evaluate(() =>
      ["booking", "pricing", "rooms"].map(
        (id) => document.querySelector<HTMLInputElement>(`input[name="module"][value="${id}"][data-committed]`)?.checked,
      ),
    );
    check("① a kattintás a Szobákat és az Árakat is a kosárba teszi", ticked.every(Boolean), ticked);
    const payNow = money(await page.locator("#adm-plan-paysum").textContent());
    const notice = await visibleText(page, "#mod-booking [data-dep-notice]");
    check(
      "① a foglalás kártyáján a kattintás pillanatában LÁTSZIK a tájékoztatás, mindkét modul nevével",
      notice.includes("Árak, szezonok") && notice.includes("Szobák, apartmanok"),
      notice,
    );
    check(
      "① …és a „most” összege a kosár „Fizetendő most”-ja, a havidíj a három modul összege",
      payNow !== null && notice.includes(`most ${huf(payNow)} Ft`) && notice.includes(`+${huf(MONTHLY)} Ft`),
      { notice, payNow },
    );

    // ② the cart, grouped
    if (width < 900) await page.locator("#adm-cartpill").click();
    const cart = await visibleText(page, "#adm-planrows");
    const subs = await page.locator("#adm-planrows .adm-planbar__row--sub").count();
    check("② a kosár csoportosít: egy vezérlő sor + két „ehhez jár” al-sor", subs === 2 && (cart.match(/ehhez jár/g) ?? []).length === 2, cart);
    check(
      "② mindkét al-sor a SAJÁT él indoklását idézi (foglalás→árak, árak→szobák)",
      cart.includes(WHY_BOOKING_PRICING) && cart.includes(WHY_PRICING_ROOMS),
      cart,
    );
    const lines = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#adm-planrows [data-line-now]")].map((e) => Number(e.dataset.lineNow)),
    );
    check(
      "② a sorok összege = Fizetendő most",
      lines.length === 3 && payNow !== null && lines.reduce((a, b) => a + b, 0) === payNow,
      { lines, payNow },
    );
    check(
      "② az összegző mondat: „együtt +2 170 Ft/hó”, a most fizetendővel",
      payNow !== null && cart.includes(`együtt +${huf(MONTHLY)} Ft/hó`) && cart.includes(`most ${huf(payNow)} Ft`),
      cart,
    );

    // ③ the brought-in cards
    for (const id of ["rooms", "pricing"]) {
      const pill = await visibleText(page, `#mod-${id} .dep-tag`);
      const rail = await visibleText(page, `#mod-${id} .dep-rail`);
      check(`③ a(z) ${cat(id).publicLabel} kártyáján „együtt jár” pirula és indoklás`, /együtt jár/i.test(pill) && rail.includes("ehhez jár"), { pill, rail });
    }

    // ④ no raw ids, no JS errors
    const shown = (await visibleText(page, "#adm-planrows")) + (await visibleText(page, "#mod-booking"));
    check("④ nyers katalógus-id nem kerül a képernyőre", !/\b(booking|pricing|rooms)\b/.test(shown), shown);
    check("④ JS-hiba = 0", jsErrors.length === 0, jsErrors);

    // ⑤ give it all back
    if (width < 900) await page.keyboard.press("Escape");
    await page.locator("#mod-booking label.adm-shop__add").click();
    const left = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('input[name="module"][data-committed="0"]')].filter((c) => c.checked).length,
    );
    check("⑤ a foglalás kivétele mindent visszavesz, és a tájékoztatás eltűnik", left === 0 && !(await visibleText(page, "#mod-booking [data-dep-notice]")), left);
    await page.close();
  }
} finally {
  await browser.close();
  if (tmp) await rm(tmp, { force: true });
}

if (SELF_TEST) {
  const ok = failures >= 6;
  console.log(
    ok
      ? `\n✅ ÖNTESZT: a javítás előtti adminViews.ts-en ${failures} állítás bukott — az őr lát\n`
      : `\n❌ ÖNTESZT: csak ${failures} bukás — az őr NEM a kosár-magyarázatot méri\n`,
  );
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
