// Regression gate: at the moment of paying, the three mandatory consents, the
// total and the pay button must ALL be on screen — on a 390px phone and on a
// desktop — and the button must refuse until every consent is ticked.
//
// WHY THIS EXISTS (measured, Elek FK-005a 2026-09-11, on the shipped panel):
// the billing step's scroll box was 276px tall holding 1284px of content. The pay
// button sat at y≈1766 in an 844px viewport, all three consents were off screen,
// there was no scroll affordance, and the withdrawal notice was cut MID-SENTENCE
// at the panel's bottom edge ("…a 14 napos"). At desktop 900px the button was at
// y≈1424 — also outside. Not one screenshot in the whole run showed the consents,
// the total and the button together.
//
// WHAT IT MEASURES — and what it deliberately refuses to trust:
//
//   ⛔ isVisible() is NOT the yardstick. It answers "does this element have a
//      box", which stayed TRUE the entire time the button was 900px below the
//      fold. The verdict here is document.elementFromPoint at the element's
//      centre: if something else answers, the buyer cannot press it.
//
//   ⛔ Playwright's own actionability is NOT the yardstick either. click() and
//      check() auto-scroll, and that scroll moves even an overflow:hidden
//      ancestor — measured: a deliberately broken layout (pay bar parked at
//      top:2200px) passed at 390px purely because check() had dragged it into
//      view first. So: scroll positions are reset immediately before every
//      probe, and consents are ticked via evaluate(), never via check().
//
// Contract: assets/design-refs/configurator/checkout-fullscreen/README.md ②⑨.
//
// Run:  npx tsx scripts/checkout-viewport-check.mts
//       npx tsx scripts/checkout-viewport-check.mts --self-test   (must go RED)

import { chromium, type Page } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELF_TEST = process.argv.includes("--self-test");
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const PREVIEW = "/tmp/cit-checkout-viewport-check.html";

/** Phone and desktop are two separate design decisions — both are measured. */
const SIZES = [
  { tag: "390px", width: 390, height: 844 },
  { tag: "desktop", width: 1280, height: 900 },
];

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const demo = {
  lang: "hu",
  name: "Nyugalom Vendégház",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

/**
 * Rendered through the REAL path — renderSite → injectRuntime → injectConfigurator
 * — not a fixture of the panel. A fixture can only prove itself.
 *
 * The offer is ON deliberately: it is the TALLEST state of the price card (struck
 * list price + payable + offer line), so anything that fits here fits without it.
 */
async function buildPreview(): Promise<void> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections: [],
  } as unknown as Recipe;
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    ARTIFACT_ID,
    demo.name,
    {
      billingPrefill: { zip: "8360", city: "Keszthely", email: "elo@pelda.hu", country: "HU" },
      offer: { kind: "outreach", percent: 25, expiresAt: null },
    },
  );
  if (SELF_TEST) {
    // Deliberate regression: the action block stops being a pinned, non-scrolling
    // flex item and is parked below the fold — i.e. EXACTLY the shipped defect
    // this gate was written for. This MUST go red at both sizes.
    html = html.replace(
      ".cit-cfg-co-act {\n  flex: 0 0 auto;",
      ".cit-cfg-co-act {\n  position: absolute;\n  top: 2200px;\n  flex: 0 0 auto;",
    );
  }
  await writeFile(PREVIEW, html, "utf8");
}

/** Walk the buyer's real path: launch → modules → §A rights → billing step. */
async function openCheckout(page: Page): Promise<void> {
  await page.goto(pathToFileURL(PREVIEW).href);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-rights").check();
  await page.waitForTimeout(120);
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(400);
}

/**
 * The probe body is a STRING on purpose: tsx's esbuild adds `__name` wrappers to
 * arrow functions, which throws `ReferenceError: __name is not defined` inside
 * page.evaluate.
 */
const PROBE = `(function () {
  // Reset every scroll container FIRST — see the header note about auto-scroll.
  window.scrollTo(0, 0);
  var all = document.querySelectorAll("*");
  for (var i = 0; i < all.length; i++) if (all[i].scrollTop) all[i].scrollTop = 0;

  var vw = window.innerWidth, vh = window.innerHeight;
  function probe(el, name) {
    if (!el) return { name: name, missing: true };
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { name: name, zeroBox: true, inView: false, hits: false };
    var cx = Math.round(r.left + r.width / 2);
    var cy = Math.round(r.top + r.height / 2);
    var hit = cx >= 0 && cx < vw && cy >= 0 && cy < vh ? document.elementFromPoint(cx, cy) : null;
    return {
      name: name,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      inView: r.top >= 0 && r.bottom <= vh,
      hits: !!hit && (hit === el || el.contains(hit) || hit.contains(el)),
    };
  }

  var out = [];
  var rows = document.querySelectorAll(".cit-cfg-co-act .cit-cfg-consent");
  for (var j = 0; j < rows.length; j++) {
    if (rows[j].hasAttribute("hidden")) continue;
    var key = rows[j].getAttribute("data-c") || ("pipa" + (out.length + 1));
    out.push(probe(rows[j].querySelector('input[type="checkbox"]'), "pipa:" + key));
  }
  var payBtn = document.querySelector(".cit-cfg-pay");
  out.push(probe(payBtn, "Fizetek gomb"));
  out.push(probe(document.querySelector(".cit-cfg-sum"), "végösszeg"));

  var scroll = document.querySelector(".cit-cfg-co-scroll");
  var headP = document.querySelector(".cit-cfg-head p");
  var waiverShort = document.querySelector(".cit-cfg-waiver-short");
  var vat = document.querySelector(".cit-cfg-vatnote");
  var next = document.querySelector(".cit-cfg-nextcharge");
  var hint = document.querySelector(".cit-cfg-co-hint");
  return {
    items: out,
    consentCount: out.filter(function (o) { return o.name.indexOf("pipa:") === 0; }).length,
    payDisabled: payBtn ? payBtn.disabled === true : null,
    payLabel: payBtn ? payBtn.textContent : null,
    payNote: (document.querySelector(".cit-cfg-paynote") || {}).textContent || "",
    strap: headP ? headP.innerText : "",
    waiverShort: waiverShort ? waiverShort.innerText : "",
    vatText: vat ? vat.innerText : "",
    nextChargeText: next ? next.innerText : "",
    scrollable: scroll ? scroll.scrollHeight - scroll.clientHeight > 4 : false,
    hintShown: hint ? !hint.hasAttribute("hidden") : false,
    sumText: (document.querySelector(".cit-cfg-sum") || {}).innerText || "",
  };
})()`;

/** Tick every visible consent WITHOUT Playwright's actionability scroll. */
const TICK_ALL = `(function () {
  var rows = document.querySelectorAll(".cit-cfg-co-act .cit-cfg-consent");
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].hasAttribute("hidden")) continue;
    var b = rows[i].querySelector('input[type="checkbox"]');
    if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); }
  }
})()`;

interface Probe {
  items: { name: string; inView?: boolean; hits?: boolean; top?: number; bottom?: number; missing?: boolean }[];
  consentCount: number;
  payDisabled: boolean | null;
  payLabel: string | null;
  payNote: string;
  strap: string;
  waiverShort: string;
  vatText: string;
  nextChargeText: string;
  scrollable: boolean;
  hintShown: boolean;
  sumText: string;
}

async function auditSize(page: Page, size: (typeof SIZES)[number]): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: size.width, height: size.height });
  await openCheckout(page);

  const before = (await page.evaluate(PROBE)) as Probe;

  // ── ① ONE VIEW: consents + total + button, measured by pixel ────────────────
  const offscreen = before.items.filter((i) => i.missing || !i.inView || !i.hits);
  check(
    offscreen.length === 0,
    `${size.tag}: a pipák, a végösszeg és a Fizetek gomb EGY nézetben` +
      (offscreen.length
        ? ` — kilóg: ${offscreen
            .map((i) => `${i.name}@${i.top}..${i.bottom}${i.hits === false ? " (takarva)" : ""}`)
            .join(", ")}`
        : ""),
  );
  check(before.consentCount === 3, `${size.tag}: három kötelező hozzájárulás látszik (${before.consentCount})`);

  // ── ② the header may not contradict the button under it ────────────────────
  check(
    !before.strap.includes("Most nem fizet semmit"),
    `${size.tag}: a fejléc NEM állítja, hogy „Most nem fizet semmit"`,
  );
  check(
    /terhelést indít/.test(before.strap),
    `${size.tag}: a fejléc kimondja, hogy a gomb terhelést indít`,
  );

  // ── ③ the legal line is a whole sentence, the full text opens in place ──────
  check(
    /[.!?]\s*$/u.test(before.waiverShort.trim()),
    `${size.tag}: az elállási sor EGÉSZ mondat („…${before.waiverShort.trim().slice(-28)}")`,
  );
  // ⛔ Driven through the DOM, not locator.click(): Playwright's actionability
  // wait THROWS when the control is off screen, and an exception aborts the run
  // instead of reporting a failure. A gate that dies cannot say what is wrong —
  // and "off screen" is precisely the defect this file exists to report.
  const openFull = `(function () {
    var b = document.querySelector('.cit-cfg-more[data-more="withdrawal"]');
    if (b) b.click();
    var f = document.querySelector('.cit-cfg-full[data-full="withdrawal"]');
    return { opened: !!f && !f.hasAttribute("hidden"), text: f ? f.innerText.trim() : "" };
  })()`;
  const fullBefore = await page.evaluate(
    `(function(){ var f = document.querySelector('.cit-cfg-full[data-full="withdrawal"]'); return !!f && !f.hasAttribute("hidden"); })()`,
  );
  const opened = (await page.evaluate(openFull)) as { opened: boolean; text: string };
  const fullText = opened.text;
  check(fullBefore === false, `${size.tag}: a törvényi szöveg alapból zárva`);
  check(
    opened.opened && /45\/2014/.test(fullText) && /elveszítem\.$/.test(fullText),
    `${size.tag}: a teljes törvényi szöveg helyben nyílik és VÉGIG megvan (${fullText.length} karakter)`,
  );
  await page.evaluate(openFull); // close it again
  await page.waitForTimeout(150);

  // ── ④ VAT and the standing obligation are stated BEFORE paying ─────────────
  check(/ÁFÁ-t nem tartalmaz/.test(before.vatText), `${size.tag}: az ÁFA-státusz ki van írva`);
  check(
    /következő terhelés/i.test(before.nextChargeText) && /\d/.test(before.nextChargeText),
    `${size.tag}: a következő terhelés dátummal+összeggel szerepel`,
  );

  // ── ⑤ scroll affordance only when there IS something to scroll ─────────────
  check(
    before.hintShown === before.scrollable,
    `${size.tag}: a görgetés-jelzés a MÉRT állapotot követi (görgethető=${before.scrollable}, jelez=${before.hintShown})`,
  );

  // ── ⑥ the gate: refused until all three, and the refusal says why ──────────
  check(before.payDisabled === true, `${size.tag}: 0 pipával a gomb TILTOTT`);
  check(/0\s*\/\s*3/.test(before.payNote), `${size.tag}: a jegyzet megnevezi a hiányt („${before.payNote.slice(0, 44)}")`);
  check(
    (before.payLabel ?? "").includes("Ft"),
    `${size.tag}: a gomb felirata megnevezi az összeget („${before.payLabel}")`,
  );
  // The big number and the button must agree — a button promising a different
  // figure from the price card is how the two silently drift apart.
  const payAmount = (before.payLabel ?? "").replace(/[^\d]/g, "");
  check(
    payAmount.length > 0 && before.sumText.replace(/\s/g, "").includes(payAmount.replace(/\s/g, "")),
    `${size.tag}: a gomb összege megegyezik az ár-kártya fizetendő összegével (${payAmount})`,
  );

  await page.evaluate(TICK_ALL);
  await page.waitForTimeout(200);
  const after = (await page.evaluate(PROBE)) as Probe;
  check(after.payDisabled === false, `${size.tag}: mind a 3 pipával a gomb ENGEDVE`);
  // And STILL in one view after ticking — the rows grow when they wrap.
  const offAfter = after.items.filter((i) => i.missing || !i.inView || !i.hits);
  check(offAfter.length === 0, `${size.tag}: bejelölés UTÁN is egy nézetben marad`);

  check(errors.length === 0, `${size.tag}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
}

/** A company is not a consumer: two consents, and the counter must follow. */
async function auditBusinessBranch(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCheckout(page);
  await page.locator('.cit-cfg-bt[data-btype="business"]').click();
  await page.waitForTimeout(250);
  const p = (await page.evaluate(PROBE)) as Probe;
  check(p.consentCount === 2, `cég ág: két kötelező hozzájárulás (${p.consentCount})`);
  check(/0\s*\/\s*2/.test(p.payNote), `cég ág: a számláló 2-re vált („${p.payNote.slice(0, 40)}")`);
  const off = p.items.filter((i) => i.missing || !i.inView || !i.hits);
  check(off.length === 0, `cég ág: a döntés 390px-en is egy nézetben (${off.map((i) => i.name).join(", ")})`);
  // The hidden waiver must not be smuggled through as ticked.
  const waiverChecked = await page.evaluate(
    `(function(){ var b = document.querySelector(".cit-cfg-waiver"); return !!(b && b.checked); })()`,
  );
  check(waiverChecked === false, "cég ág: a rejtett elállási pipa NINCS bejelölve");
}

/**
 * The CONFIRMATION must state the standing obligation (contract ⑪) — measured on
 * the rendered HTML, both with a known renewal and without one.
 *
 * ⚠️ Why this lives here and not in the Elek run: the mock gateway's payUrl is
 * ABSOLUTE (PUBLIC_BASE_URL, src/payment/mock.ts), so from the pay click onwards
 * FK-005a leaves the worktree's ephemeral server and lands on the MAIN tree's
 * console. Its 05/06 screenshots therefore show whatever is on main, not the
 * change under test — a worktree fix cannot show up there until it lands.
 */
async function auditConfirmation(page: Page): Promise<void> {
  const { payResultPage } = await import("../src/console/views.js");
  const base = {
    siteUrl: "https://pelda.citoviso.com",
    username: "pelda-vendeghaz",
    contactEmail: "vevo@pelda.hu",
    amount: 74_925,
    loginUrl: "https://pelda.citoviso.com/login",
  };
  const html = payResultPage(true, true, {
    ...base,
    renewal: { date: "2027-09-11", amount: 99_900, period: "annual" },
  });
  for (const [re, label] of [
    [/Következő terhelés/, "megnevezi a KÖVETKEZŐ TERHELÉST"],
    [/2027\. 09\. 11\./, "kiírja a következő terhelés DÁTUMÁT"],
    [/99\s*900/, "kiírja a következő terhelés ÖSSZEGÉT"],
    [/Automatikus/, "kimondja, hogy AUTOMATIKUSAN megújul"],
    [/ÁFÁ-t nem tartalmaz/, "kimondja az ÁFA-státuszt"],
    [/Előfizetés lemondása/, "megmondja, HOL mondható le"],
    [/Számla/, "megmondja, mikor jön a SZÁMLA"],
  ] as const) {
    check(re.test(html), `visszaigazolás: ${label}`);
  }
  // ⛔ The half-path defect: "Belépés: /login" told a paying customer nothing.
  check(
    !/>\s*\/login\s*</.test(html),
    "visszaigazolás: a belépés NEM csupasz „/login” útvonal",
  );
  const noLogin = payResultPage(true, true, { ...base, loginUrl: null, renewal: null });
  check(
    !/\/login/.test(noLogin) && /e-mailben küldjük/.test(noLogin),
    "visszaigazolás: abszolút URL híján az e-mailre utal, nem fél útvonalra",
  );
  check(
    /Következő terhelés/.test(noLogin) && !/NaN|undefined|null/.test(noLogin),
    "visszaigazolás: ismeretlen fordulónapnál is MOND valamit, számhulladék nélkül",
  );

  // The NOT-YET-ACTIVATED confirmation is a confirmation too: the card is charged
  // and the renewal is anchored, so it owes the same standing-obligation box.
  const pending = payResultPage(true, false, { ...base, renewal: null });
  check(
    /előfizetése/i.test(pending) && /Következő terhelés/.test(pending),
    "visszaigazolás (még nem élesedett): a tartós kötelezettséget IS kimondja",
  );

  // ── the FAILURE screen: a way out that can actually be READ ────────────────
  // MEASURED (Elek FK-005b, 2026-09-12): `.con a` (0,1,1) beats `.citui-btn--*`
  // (0,1,0), so the only escape button rendered cyan-on-cyan — contrast 1.16,
  // while every machine check reported the label as "visible".
  const failHtml = payResultPage(false, false, {
    ref: "mock_deadbeef",
    retryUrl: "/pay/mock/mock_deadbeef",
  });
  check(/Nem történt terhelés/.test(failHtml), "bukás-oldal: kimondja, hogy NEM történt terhelés");
  check(/citui-btn/.test(failHtml), "bukás-oldal: van KATTINTHATÓ újrapróba-gomb");
  check(/mock_deadbeef/.test(failHtml), "bukás-oldal: van hivatkozási azonosító, amit idézni lehet");
  await page.setContent(failHtml);
  for (const f of ["public/assets/ui/citui.css", "public/assets/ui/citui-console.css"]) {
    await page.addStyleTag({ path: f });
  }
  await page.waitForTimeout(200);
  const contrast = (await page.evaluate(`(function () {
    function lum(c) {
      var m = c.match(/[\\d.]+/g).map(Number).slice(0, 3).map(function (v) {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    }
    var btn = document.querySelector(".citui-btn");
    if (!btn) return { ratio: 0, missing: true };
    var cs = getComputedStyle(btn);
    // The button paints a GRADIENT; measure against its first stop (the darker end).
    var g = cs.backgroundImage.match(/rgba?\\([^)]+\\)/g);
    var bg = g && g.length ? g[0] + ")" : cs.backgroundColor;
    var L1 = lum(cs.color), L2 = lum(bg);
    return { ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100, fg: cs.color, bg: bg };
  })()`)) as { ratio: number; fg?: string; bg?: string; missing?: boolean };
  check(
    contrast.ratio >= 4.5,
    `bukás-oldal: az újrapróba-gomb felirata OLVASHATÓ (kontraszt ${contrast.ratio}, küszöb 4.5 — ${contrast.fg} a ${contrast.bg} felett)`,
  );

  // Pixel check: the box must actually be on screen, not merely in the markup.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(html);
  await page.waitForTimeout(200);
  const boxSeen = await page.evaluate(`(function () {
    var hs = document.querySelectorAll("h3");
    var box = null;
    for (var i = 0; i < hs.length; i++) if (/előfizetése/i.test(hs[i].textContent)) box = hs[i].parentNode;
    if (!box) return { found: false };
    var r = box.getBoundingClientRect();
    var cx = Math.round(r.left + r.width / 2);
    var cy = Math.round(r.top + Math.min(r.height / 2, 40));
    var hit = cy >= 0 && cy < window.innerHeight ? document.elementFromPoint(cx, cy) : null;
    return { found: true, h: Math.round(r.height), hits: !!hit && box.contains(hit) };
  })()`) as { found: boolean; h?: number; hits?: boolean };
  check(
    boxSeen.found && !!boxSeen.hits && (boxSeen.h ?? 0) > 60,
    `visszaigazolás: az „Az előfizetése" doboz 390px-en LÁTSZIK (${boxSeen.h ?? 0}px)`,
  );
}

async function main(): Promise<void> {
  await buildPreview();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const s of SIZES) await auditSize(page, s);
    await auditBusinessBranch(page);
    await auditConfirmation(page);
  } finally {
    await browser.close();
  }

  for (const n of notes) console.log(n);
  if (SELF_TEST) {
    if (failures.length) {
      console.log(`\n✅ self-test: az őr PIROSRA ment a szándékos rontáson (${failures.length} bukás):`);
      for (const f of failures) console.log(`   - ${f}`);
      process.exit(0);
    }
    console.error("\n⛔ self-test: az őr ZÖLD maradt egy elrontott felületen — az őr NEM ŐR.");
    process.exit(1);
  }
  if (failures.length) {
    console.error(`\n⛔ checkout-viewport-check: ${failures.length} bukás`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log(`\n✅ checkout-viewport-check: ${notes.length} ellenőrzés zöld.`);
}

await main();
