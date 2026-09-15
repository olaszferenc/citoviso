// Contract gate for the pay step's ITEM BOX — "what am I actually buying?"
// Approved plan: assets/design-refs/configurator/checkout-item-block/README.md
//
// WHY THIS EXISTS — and why a label-only gate could never have caught it:
//
//   The same block was ALREADY APPROVED on 2026-09-11. The parent contract
//   (../checkout-fullscreen/plan.html, lines 215–220) draws a named line item:
//   property name, the product in one sentence, the list price and the discount
//   row. It was never built. Measured 2026-09-14 on the rendered panel, at 390px
//   and at desktop: the entire billing step reported `mentionsSiteName: false`
//   and `mentionsSectionCount: false` — the buyer typed a card number on a screen
//   that never said whose website it was for. The manifest did not even CARRY the
//   name, so the runtime could not have printed it if it had wanted to.
//
//   `contract-drift-check` did not miss this by accident: it pins the literals a
//   README quotes as **„…"**, and this block's content is DATA (a lead's name),
//   not a literal. It was not wrong — it was never asked. So the README now also
//   declares STRUCTURAL anchors, and this gate measures BEHAVIOUR on the real
//   rendered panel.
//
// WHAT IT REFUSES TO TRUST:
//
//   ⛔ Not a source grep. A block can exist in the source and never render (wrong
//      branch, hidden parent, a `[hidden]` beaten by a display rule). Everything
//      below is measured after walking the buyer's actual path to the pay step.
//
//   ⛔ Not "the number changed". Contract ⑦ says switching the cycle must not
//      leave ANY figure from the other cycle on screen, so the check collects
//      every visible amount before and after the switch and requires the whole
//      set to move — not just the one the author happened to remember.
//
// Run:  npx tsx scripts/checkout-item-block-check.mts
//       npx tsx scripts/checkout-item-block-check.mts --self-test   (must go RED)

import { chromium, type Page } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELF_TEST = process.argv.includes("--self-test");
const PROPERTY = "Nyugalom Vendégház";

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const demo = {
  lang: "hu",
  name: PROPERTY,
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [{ url: "https://picsum.photos/seed/cit-item/1600/1000", alt: "A hotel", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

/** Rendered through the REAL path — a fixture of the panel can only prove itself. */
async function build(opts: { name?: string; offer: boolean; regress?: string }): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = {
    template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [],
  } as unknown as Recipe;
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, { ...demo, name: opts.name ?? PROPERTY } as SiteData)),
    "00000000-0000-4000-8000-000000000000",
    opts.name ?? PROPERTY,
    {
      billingPrefill: { zip: "8360", city: "Keszthely", email: "elo@pelda.hu", country: "HU" },
      ...(opts.offer ? { offer: { kind: "outreach" as const, percent: 25, expiresAt: null } } : {}),
    },
  );
  if (opts.regress) {
    const r = REGRESSIONS[opts.regress]!;
    const before = html;
    html = html.replace(r.from, r.to);
    // ⛔ A regression that silently does not match turns the self-test into a lie:
    // the run reports "red" for rules it never actually exercised. Measured the
    // hard way earlier this session on a sibling gate.
    if (html === before) {
      console.error(`⛔ ÖNTESZT-HIBA: a(z) "${opts.regress}" visszarontás nem fogott — az őr nem lett megmérve.`);
      process.exit(1);
    }
  }
  return html;
}

/**
 * ⛔ SEVERAL regressions, not one. Deleting the box only ever exercised rule ①:
 * with the box gone the run skips everything else, so a self-test that stopped
 * there would advertise "this gate can go red" while rules ②–⑦ had never been
 * fired at all. Each case below targets a DIFFERENT rule group.
 */
const REGRESSIONS: Record<string, { from: RegExp; to: string; hits: string }> = {
  // ① the approved block silently absent — the defect this gate exists for
  "nincs-doboz": { from: /'<div class="cit-cfg-item">'/, to: "''", hits: "①" },
  // ⑥ the pressed state synced BY IDENTITY again → two switches, two truths
  // ⚠️ The FAITHFUL form of the old bug. The first attempt injected the original
  // `x === b` identity test into syncPeriodButtons(), where `b` is not in scope —
  // that threw at load and the panel never initialised, so the run proved nothing
  // about rule ⑥, only that a broken page is broken. This version narrows the
  // sync to the pay-step switch, which is exactly the observable defect: two
  // switches, one state, disagreeing indicators.
  "ket-igazsag": {
    from: /panel\.querySelectorAll\("\.cit-cfg-popt"\)\.forEach\(function \(x\) \{\n      var on = x\.getAttribute/,
    to: 'panel.querySelectorAll(".cit-cfg-period3 .cit-cfg-popt").forEach(function (x) {\n      var on = x.getAttribute',
    hits: "⑥",
  },
  // ⑧ the SHIPPED bug, verbatim: the card price baked in at build time, always
  // monthly, never following the cycle switch standing right below it.
  "kartya-mindig-havi": {
    from: /slot\.textContent = fmt\(presetTotal\(p\)\);/,
    to: "slot.textContent = fmt(presetMonthly(p));",
    hits: "⑧",
  },
  "kartya-rossz-egyseg": {
    from: /unit\.textContent = period === "annual" \? tr\("\/év"\) : tr\("\/hó"\);/,
    to: 'unit.textContent = tr("/hó");',
    hits: "⑧",
  },
  // ③④⑦ the box stops following the cycle → stale figures from the other cycle
  "nem-koveti-az-utemet": {
    from: /function syncItemBlock\(\) \{\n    var sub = panel\.querySelector\(".cit-cfg-item-sub"\);\n    if \(!sub\) return;/,
    to: 'function syncItemBlock() {\n    var sub = panel.querySelector(".cit-cfg-item-sub");\n    if (!sub) return;\n    if (sub.textContent) return;',
    hits: "③④⑦",
  },
};

/** Walk the buyer's real path: launch → modules → §A rights → billing step. */
/**
 * ⑧ The MODULE STEP's package cards (ADR-0164 ③ again, one step earlier).
 *
 * ⛔ Measured 2026-09-15: the annual cycle is preselected, yet every card read
 * "9 500 Ft/hó" while the summary in the SAME footer said "95 000 Ft / év" — a
 * ten-fold gap one glance apart, on the screen where the buyer picks a package.
 * The card price was also computed once at build time, so the cycle switch
 * standing right below the cards never moved it at all.
 */
const STEP1 = `(function () {
  var AMT = /\\d{1,3}(?:[\\u00a0 ]\\d{3})*/;
  var cards = Array.prototype.map.call(document.querySelectorAll(".cit-cfg-preset"), function (el) {
    var pr = el.querySelector(".cit-cfg-preset__price");
    var small = pr ? pr.querySelector("small") : null;
    var r = pr ? pr.getBoundingClientRect() : null;
    var txt = pr ? (pr.innerText || "").replace(/\\s+/g, " ").trim() : "";
    var num = txt.match(AMT);
    return {
      id: el.getAttribute("data-preset"),
      active: el.classList.contains("cit-cfg-preset--on"),
      text: txt,
      unit: small ? (small.textContent || "").trim() : null,
      amount: num ? Number(num[0].replace(/[^\\d]/g, "")) : null,
      // ⛔ Overflow is MEASURED: the annual figure is longer than the monthly one,
      // and a price that wraps or clips on a 390px card is a new defect, not a fix.
      overflow: pr ? pr.scrollWidth - Math.ceil(r.width) : null
    };
  });
  var sum = document.querySelector(".cit-cfg-sum");
  var struck = sum ? sum.querySelector("s") : null;
  var sn = struck ? (struck.textContent || "").match(AMT) : null;
  return {
    cards: cards,
    // the summary's STRUCK list price — the same basis the cards show
    listPrice: sn ? Number(sn[0].replace(/[^\\d]/g, "")) : null
  };
})()`;

async function openPayStep(page: Page, file: string): Promise<void> {
  await page.goto(pathToFileURL(file).href);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 20000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(350);
  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-rights").check();
  await page.waitForTimeout(120);
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(500);
}

/**
 * ⛔ String probe: tsx's esbuild adds __name wrappers to arrow functions, which
 * throw "ReferenceError: __name is not defined" inside page.evaluate.
 */
const READ = `(function () {
  function t(s) { var e = document.querySelector(s); return e ? (e.innerText || "").trim() : null; }
  var step3 = document.querySelector(".cit-cfg-step3");
  var item = document.querySelector(".cit-cfg-item");
  var disc = document.querySelector(".cit-cfg-item-disc");
  var scroll = document.querySelector(".cit-cfg-co-scroll");
  var hint = document.querySelector(".cit-cfg-co-hint");
  // Every amount currently on the pay step, in document order.
  // ⛔ Anchored thousand-groups, not "digits and blanks": the loose class matched
  // only the LAST group of "7 492 Ft" and read 7 492 as 492 — a parsing bug that
  // would have reported a real price mismatch on correct code.
  var AMT = /\\d{1,3}(?:[\\u00a0 ]\\d{3})*\\s*Ft/g;
  var amounts = (step3 ? (step3.innerText || "") : "").match(AMT) || [];
  var sumAmounts = ((document.querySelector(".cit-cfg-sum") || {}).innerText || "").match(AMT) || [];
  var hr = hint && !hint.hasAttribute("hidden") ? hint.getBoundingClientRect() : null;
  var sr = scroll ? scroll.getBoundingClientRect() : null;
  return {
    hasItem: !!item,
    // Contract ①: the item box is the FIRST block of the scrolling zone.
    firstInScroll: !!(scroll && scroll.firstElementChild === item),
    eyebrow: t(".cit-cfg-item-eyebrow"),
    name: t(".cit-cfg-item-name"),
    sub: t(".cit-cfg-item-sub"),
    listLbl: (document.querySelector(".cit-cfg-item-list") || { children: [] }).children[0]
      ? document.querySelector(".cit-cfg-item-list").children[0].textContent : null,
    listVal: (document.querySelector(".cit-cfg-item-list") || { children: [] }).children[1]
      ? document.querySelector(".cit-cfg-item-list").children[1].textContent : null,
    discHidden: disc ? disc.hasAttribute("hidden") : null,
    discVal: disc && !disc.hasAttribute("hidden") ? disc.children[1].textContent : null,
    // every period button in the WHOLE panel, so "one state" can be checked
    periods: Array.prototype.map.call(document.querySelectorAll(".cit-cfg-popt"), function (x) {
      return x.getAttribute("data-period") + ":" + (x.classList.contains("cit-cfg-popt--on") ? "on" : "off");
    }),
    payBtn: (document.querySelector(".cit-cfg-pay") || {}).textContent,
    nextCharge: t(".cit-cfg-nextcharge"),
    amounts: amounts,
    sumAmounts: sumAmounts,
    // ⛔ Does the scroll cue's band intersect the scroller's VISIBLE viewport?
    // (An element whose rect falls below the scroller is CLIPPED, not covered —
    // counting that as an overlap is a false alarm the first probe produced.)
    cueOverlapsForm: !!(hr && sr) && !(hr.bottom <= sr.top || hr.top >= sr.bottom),
  };
})()`;

interface Read {
  hasItem: boolean; firstInScroll: boolean; eyebrow: string | null; name: string | null;
  sub: string | null; listLbl: string | null; listVal: string | null;
  discHidden: boolean | null; discVal: string | null; periods: string[];
  payBtn: string | null; nextCharge: string | null; amounts: string[]; sumAmounts: string[];
  cueOverlapsForm: boolean;
}

async function runAll(regress?: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "cit-item-"));
  const withOffer = join(dir, "offer.html");
  const noOffer = join(dir, "nooffer.html");
  const noName = join(dir, "noname.html");
  await writeFile(withOffer, await build({ offer: true, regress }), "utf8");
  await writeFile(noOffer, await build({ offer: false, regress }), "utf8");
  await writeFile(noName, await build({ offer: true, name: "", regress }), "utf8");

  const browser = await chromium.launch();
  try {
    for (const size of [
      { tag: "390px", width: 390, height: 844 },
      { tag: "desktop", width: 1280, height: 900 },
    ]) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
      const jsErrors: string[] = [];
      page.on("pageerror", (e) => jsErrors.push(e.message));
      // ⑧ the module step FIRST — the cards live there, one screen before the pay step
      await page.goto(pathToFileURL(withOffer).href);
      await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 20000 });
      await page.locator(".cit-cfg-launch").click();
      await page.waitForTimeout(450);
      await checkCards(page, size.tag);

      await openPayStep(page, withOffer);
      await page.evaluate("window.scrollTo(0,0)");

      const a = (await page.evaluate(READ)) as Read;
      const T = `[${size.tag}]`;
      check(a.hasItem, `${T} ① a fizetés-lépésen OTT a tétel-doboz`);
      if (!a.hasItem) { await page.close(); continue; }
      check(a.firstInScroll, `${T} ① …a görgethető zóna ELSŐ blokkjaként`);
      check(a.eyebrow === "AMIT MEGRENDEL", `${T} ① kötő felirat: „Amit megrendel” (mérve: "${a.eyebrow}")`);
      check(a.name === PROPERTY, `${T} ② a doboz a SZÁLLÁS nevét írja ki (mérve: "${a.name}")`);
      check(/Citoviso honlap/.test(a.sub ?? ""), `${T} ③ …és megnevezi a terméket`);
      check(/éves előfizetés/.test(a.sub ?? ""), `${T} ③ …a választott ciklussal (éves)`);
      check(/2 hónap ingyen/.test(a.sub ?? ""), `${T} ③ …az ingyen hónapok a konfigból (2)`);
      check(a.listLbl === "Éves listaár", `${T} ④ a listaár sora MEGNEVEZI az ütemet (mérve: "${a.listLbl}")`);
      check(/\/ év$/.test((a.listVal ?? "").trim()), `${T} ④ …és az érték is éves (mérve: "${a.listVal}")`);
      check(a.discHidden === false, `${T} ④ ajánlattal VAN kedvezmény-sor (mérve: "${a.discVal}")`);
      check((a.discVal ?? "").startsWith("−"), `${T} ④ …levonásként, negatív előjellel`);
      check(!a.cueOverlapsForm, `${T} a görgetés-jelzés NEM takarja az űrlapot (sávja a görgőn kívül)`);

      // ⑥ ONE state: the pay-step switch drives the module-step switch too.
      const annualOn = a.periods.filter((p) => p === "annual:on").length;
      check(a.periods.length >= 4, `${T} ⑥ két váltó van a panelen (${a.periods.length} gomb)`);
      check(
        annualOn === a.periods.length / 2 && !a.periods.includes("monthly:on"),
        `${T} ⑥ induláskor MINDEN váltó ugyanazt mutatja (${a.periods.join(" ")})`,
      );

      // ⑦ switching on the PAY step must move EVERY figure on the screen
      await page.locator('.cit-cfg-period3 [data-period="monthly"]').click();
      await page.waitForTimeout(300);
      const b = (await page.evaluate(READ)) as Read;
      check(/havi előfizetés/.test(b.sub ?? ""), `${T} ⑦ a tétel mondata HAVIRA vált`);
      check(b.listLbl === "Havi listaár", `${T} ⑦ a listaár sora is (mérve: "${b.listLbl}")`);
      check(/\/ hó$/.test((b.listVal ?? "").trim()), `${T} ⑦ …és az értéke (mérve: "${b.listVal}")`);
      check(
        !b.periods.includes("annual:on") && b.periods.filter((p) => p === "monthly:on").length === b.periods.length / 2,
        `${T} ⑥ a fizetőoldali váltás a MÁSIK váltót is átbillenti (${b.periods.join(" ")})`,
      );
      check(b.payBtn !== a.payBtn, `${T} ⑦ a fizetés-gomb felirata is követi (${a.payBtn} → ${b.payBtn})`);
      check(b.nextCharge !== a.nextCharge, `${T} ⑦ a következő terhelés mondata is`);
      // The whole set must move: no figure may survive from the other cycle.
      const stale = b.amounts.filter((x) => a.amounts.includes(x));
      check(
        stale.length === 0,
        `${T} ⑦ EGYETLEN szám sem maradt az előző ütemből (bent maradt: ${stale.join(", ") || "—"})`,
      );
      // …and the box must agree with the headline card: list − discount = payable.
      const num = (s: string): number => Number(s.replace(/[^\d]/g, ""));
      const list = num(b.listVal ?? "0");
      const off = num(b.discVal ?? "0");
      const payable = b.sumAmounts.length ? num(b.sumAmounts[b.sumAmounts.length - 1]!) : -1;
      check(
        list - off === payable,
        `${T} ⑦ a doboz és a nagy szám EGYEZIK: ${list} − ${off} = ${list - off} (kártya: ${payable})`,
      );

      check(jsErrors.length === 0, `${T} nincs JS-hiba a folyamatban (${jsErrors.join(" | ") || "0"})`);
      await page.close();
    }

    // ── no offer → NO discount row (a "−0 Ft" line reads as a broken sum) ─────
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await openPayStep(page, noOffer);
      const r = (await page.evaluate(READ)) as Read;
      check(r.hasItem, "[ajánlat nélkül] a tétel-doboz ott van");
      check(r.discHidden === true, `[ajánlat nélkül] NINCS kedvezmény-sor (mérve: "${r.discVal}")`);
      await page.close();
    }

    // ── no name → the box must NOT invent one (§B.17) ────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await openPayStep(page, noName);
      const r = (await page.evaluate(READ)) as Read;
      check(r.hasItem, "[név nélkül] a tétel-doboz ott van (az árak attól még kellenek)");
      check(r.name === null, `[név nélkül] a lap NEM talál ki nevet (mérve: "${r.name}")`);
      check(/Citoviso honlap/.test(r.sub ?? ""), "[név nélkül] …de a termék megnevezése marad");
      await page.close();
    }
  } finally {
    await browser.close();
  }
}


interface Card { id: string; active: boolean; text: string; unit: string | null; amount: number | null; overflow: number | null }
interface Step1 { cards: Card[]; listPrice: number | null }

/** ⑧ The package cards must carry the SELECTED cycle — and follow the switch. */
async function checkCards(page: Page, tag: string): Promise<void> {
  const T = `[${tag}]`;
  const annual = (await page.evaluate(STEP1)) as Step1;
  check(annual.cards.length > 0, `${T} ⑧ vannak csomag-kártyák (${annual.cards.length})`);
  check(
    annual.cards.every((c) => c.unit === "/év"),
    `${T} ⑧ éves ütemben MINDEN kártya „/év” egységet visel (mérve: ${annual.cards.map((c) => c.unit).join(", ")})`,
  );
  check(
    annual.cards.every((c) => (c.overflow ?? 1) <= 0),
    `${T} ⑧ az éves szám BEFÉR a kártyába (túlcsordulás: ${annual.cards.map((c) => c.overflow).join(", ")})`,
  );
  // ⭐ The strongest assertion: the ACTIVE card's figure IS the summary's struck
  // list price. Same screen, same basis — they cannot be allowed to disagree.
  const act = annual.cards.find((c) => c.active) ?? annual.cards[0]!;
  check(
    act.amount !== null && act.amount === annual.listPrice,
    `${T} ⑧ az aktív kártya ára = az összegző áthúzott listaára (${act.amount} vs ${annual.listPrice})`,
  );

  await page.locator('[data-period="monthly"]').first().click();
  await page.waitForTimeout(350);
  const monthly = (await page.evaluate(STEP1)) as Step1;
  check(
    monthly.cards.every((c) => c.unit === "/hó"),
    `${T} ⑧ havi ütemben MINDEN kártya „/hó”-ra vált (mérve: ${monthly.cards.map((c) => c.unit).join(", ")})`,
  );
  const moved = monthly.cards.every((c, i) => c.amount !== annual.cards[i]!.amount);
  check(moved, `${T} ⑧ …és a SZÁM is mozdul (${annual.cards.map((c) => c.amount).join("/")} → ${monthly.cards.map((c) => c.amount).join("/")})`);
  const actM = monthly.cards.find((c) => c.active) ?? monthly.cards[0]!;
  check(
    actM.amount !== null && actM.amount === monthly.listPrice,
    `${T} ⑧ havi ütemben is egyezik az összegzővel (${actM.amount} vs ${monthly.listPrice})`,
  );
  await page.locator('[data-period="annual"]').first().click();
  await page.waitForTimeout(350);
}

async function main(): Promise<void> {
  if (!SELF_TEST) {
    await runAll();
    for (const n of notes) console.log(n);
    if (failures.length) {
      console.error(`\n⛔ checkout-item-block: ${failures.length} sértés:`);
      for (const f of failures) console.error(`   ✗ ${f}`);
      process.exit(1);
    }
    console.log(`\n✅ checkout-item-block: ${notes.length} állítás zöld — a fizetőoldal megnevezi, mit vesz a vevő.`);
    return;
  }
  // ⛔ EVERY rule group must be shown to fire, not just the first one.
  let allRed = true;
  for (const [name, r] of Object.entries(REGRESSIONS)) {
    failures.length = 0;
    notes.length = 0;
    await runAll(name);
    if (failures.length === 0) {
      console.error(`⛔ ÖNTESZT: a(z) "${name}" visszarontáson (${r.hits}) az őr ZÖLD maradt — ezt a szabályt nem méri.`);
      allRed = false;
    } else {
      console.log(`✅ "${name}" (${r.hits}) → ${failures.length} sértés:`);
      for (const f of failures.slice(0, 6)) console.log(`     ✗ ${f}`);
      if (failures.length > 6) console.log(`     … és még ${failures.length - 6}`);
    }
  }
  if (!allRed) process.exit(1);
  console.log(`\n✅ ÖNTESZT: mind a(z) ${Object.keys(REGRESSIONS).length} visszarontás pirosra viszi az őrt — minden szabály-csoport mérve.`);
}

await main();
