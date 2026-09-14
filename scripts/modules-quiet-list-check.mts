/**
 * Kapu — „Csendes lista": a Modulok fül a JÓVÁHAGYOTT tervet szállítja.
 *
 * Kontraktus: `assets/design-refs/console/modules-quiet-list/README.md`
 * (tulajdonosi döntés, 2026-09-14, Elek FK-002).
 *
 * ⚠️ Ez az őr BÖNGÉSZŐBEN mér, nem a forráson. A kötött állítások fele VIZUÁLIS
 * („melyik szám a nagyobb?", „a lemondás jobbra van-e?"), és egy sztring-kereső
 * ezekre MÁS KÉRDÉSRE válaszolna (feedback_badge_answered_one_of_nine_gates).
 * A tördelés-visszaesés például csak a valódi vázban (248 px oldalsáv + 900 px
 * tartalom-plafon) és valódi szélességen látszik — az első mérésem pont azért
 * hitte mobil-specifikusnak, mert egy tágabb saját vázban mértem.
 *
 * Amit mér (a kontraktus pontjaival):
 *   ① §6  a BIRTOKOLT modul árán nincs „+", a KIRAKAT kártyáján van;
 *   ② §7  éves fiónál az ÉVES szám a nagyobb (mérve, nem feltételezve),
 *         havi fiónál nincs éves alak;
 *   ③ §1  a sor `display:grid`, és a lemondás x-pozíciója a „Megnézem"-é UTÁN
 *         van — 390 ÉS 1280 px-en (a régi `flex-wrap` mindkettőn balra törte);
 *   ④ §2  a lemondás nem `citui-btn`, de LÁTHATÓ és kattintható, és a nyugalmi
 *         színe olvasható (kontraszt mérve — nem cián világos háttéren);
 *   ⑤ §3  a sorokban 0× szerepel az alapeset-mondat, a gyűjtő-mondat száma a
 *         VALÓDI alapesetű sorok számával egyezik, fagyasztva pedig eltűnik —
 *         ÉS a `FK-006b` tűje (`látható "Aktív az oldalán"`) a RUNNER SAJÁT
 *         mechanizmusával (`page.getByText`) továbbra is fog;
 *   ⑥ §4  a fejléc-pirula összege = az összegző = a számla-cella, és a
 *         kapcsolgatás MINDHÁRMAT együtt mozgatja;
 *   ⑦ §5  a számla-`<details>` nyitva.
 *
 * PIROS ÖNTESZT (`--self-test`): a lapra ráterítjük a 2026-09-14 ELŐTTI alakot
 * (vissza a „+", vissza a havi-kiemelés, vissza a `flex-wrap`, gombbá tett
 * lemondás, fejléc-pirula és gyűjtő-mondat nélkül, csukott számlával), és MINDEN
 * állításnak buknia KELL. Aki sosem bukott, azt senki nem tesztelte.
 */
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { modulesSection } from "../src/server/adminViews.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getAnnualFreeMonths, getBaseMonthly } from "../src/pricing.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
/** Which named assertions went red — the self-test verdicts on THIS, not on a count. */
const red = new Set<string>();
const check = (c: boolean, m: string, id = "") => {
  if (c) console.log(`  ✓ ${m}`);
  else {
    bad++;
    if (id) red.add(id);
    console.log(`  ✗ ${m}`);
  }
};

/**
 * ⛔ A piros önteszt NEM darabszámra megy.
 *
 * Az első változatom „legalább 20 bukás"-t várt, és 12-t kapott — mert a
 * regresszió egy része NEM alanya ezeknek az állításoknak (a kirakat „+”-a, a
 * kontraszt, a fagyasztott ág, a havi fiók helyesen marad zöld). Egy küszöbszám
 * ezt nem tudja megkülönböztetni a „van egy detektor, ami a régi felületet is
 * átengedi" esettől — pontosan azt a kérdést hagyná nyitva, amiért az önteszt
 * van. Ezért NÉVSZERINT soroljuk fel, minek KELL elbuknia a régi alakon.
 */
const MUST_FAIL_ON_OLD = [
  "owned-no-plus",
  "annual-leads",
  "annual-bigger",
  "grid-1280",
  "grid-390",
  "off-order-1280",
  "off-order-390",
  "off-not-btn",
  "plain-rows-0",
  "plain-count",
  "head-pill",
  "head-follows",
  "details-open",
  "monthly-no-plus",
  "base-label-superseded",
] as const;

const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
const flat = (s: string) => s.replace(/ /g, " ");

// ── fixture: a MÉRT ELEK-állapot (12 aktív modul, ebből 11 számlázott) ─────
const PAID = [
  "gallery",
  "rooms",
  "amenities",
  "pricing",
  "location",
  "hours",
  "usp",
  "reviews",
  "poi",
  "booking",
  "newsletter",
] as const;

const mk = (
  id: string,
  active: boolean,
  supersededBy: string | null = null,
): TenantModuleView["modules"][number] => {
  const def = MODULE_CATALOG.find((m) => m.id === id);
  if (!def) throw new Error(`ismeretlen modul a fixture-ben: ${id}`);
  return {
    id,
    label: def.publicLabel,
    publicDesc: def.publicDesc,
    group: def.group,
    spine: Boolean(def.spine),
    active,
    priceMonthly: def.priceMonthly,
    supersededBy,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  };
};

const BASE = getBaseMonthly();
const FREE = getAnnualFreeMonths();
const MULT = 12 - FREE;
const modules = [...PAID.map((id) => mk(id, true)), mk("enquiry", true, "booking"), mk("email", false)];
// Független referencia: a KATALÓGUSBÓL, nem a nézet által kapott összegekből
// (feedback_guard_must_not_borrow_its_subject).
const MODULES_MONTHLY = PAID.reduce(
  (s, id) => s + MODULE_CATALOG.find((m) => m.id === id)!.priceMonthly,
  0,
);
const MONTHLY = BASE + MODULES_MONTHLY;
const ANNUAL = MONTHLY * MULT;
const PLAIN_ROWS = PAID.length; // a gerinc külön mondatot kap, a 11 fizetős az alapeset

const mv: TenantModuleView = { modules, baseMonthly: BASE, totalMonthly: MONTHLY };

const mkSub = (
  period: "monthly" | "annual",
  frozen = false,
): SubscriptionAdminData => ({
  status: frozen ? "frozen" : "active",
  periodEnd: "2027-09-10",
  renewDay: 10,
  nextInvoiceTotal: MONTHLY,
  nextInvoiceItems: PAID.map((id) => {
    const d = MODULE_CATALOG.find((m) => m.id === id)!;
    return { label: d.publicLabel, price: d.priceMonthly, isNew: false };
  }),
  payUrl: frozen ? "https://example.test/pay" : null,
  arrears: frozen ? { amount: ANNUAL, dueOn: "2027-09-10" } : null,
  closesOn: "2027-10-10",
  frozenOn: frozen ? "2027-09-20" : null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: period,
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: MONTHLY * MULT,
  annualSavings: MONTHLY * FREE,
  annualFreeMonths: FREE,
  autoCharge: false,
  coupon: null,
});

/** A VALÓDI admin-váz (248 px oldalsáv + `.adm-main__inner` 900 px plafon).
 *  ⛔ E nélkül a sor ~1240 px széles lenne 1280-on, és a tördelést egy olyan
 *  szélességen mérnénk, ami a terméken sosem fordul elő. */
const CSS =
  readFileSync(path.join(ROOT, "public/assets/ui/citui.css"), "utf8") +
  "\n" +
  readFileSync(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8");

const pageHtml = (sub: SubscriptionAdminData | null) =>
  `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}</style></head>` +
  `<body><div class="adm-shell">` +
  `<aside class="adm-side"><div class="adm-side__brand">Citoviso</div>` +
  `<nav class="adm-nav"><a href="#">Áttekintés</a><a href="#" class="is-active">Modulok</a></nav></aside>` +
  `<main class="adm-main"><div class="adm-main__inner">` +
  `<div class="adm-pagehead"><h1>Modulok</h1></div>` +
  modulesSection(mv, sub, null, "hello@citoviso.com", null, "hu") +
  `</div></main></div></body></html>`;

/**
 * A 2026-09-14 ELŐTTI alak visszaállítása a renderelt lapon — a piros önteszt
 * alanya. Nem „valami elrontás": pontosan azokat a tulajdonságokat teszi vissza,
 * amiket aznap mértem a régi felületen.
 */
const REGRESS = `(() => {
  const st = document.createElement('style');
  // ⚠️ A régi ár EGY SORBAN állt („+490 Ft/hó = 4 900 Ft/év"), és épp ez a
  // szélesség feszítette szét a sort 1280 px-en is. Az első öntesztem a kétsoros
  // (keskeny) árat hagyta benn, ezért a sor kényelmesen elfért, és az
  // „off-order-1280" detektor ZÖLD maradt egy olyan alakon, amit el KELL utasítania.
  st.textContent = '.adm-mine__row{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap!important}'
    + '.adm-mine__t{flex:1 1 190px}.adm-mine__p{margin-left:auto}'
    + '.adm-mine__a{display:contents}'
    + '.adm-price__lead{display:inline!important;font-size:.82rem!important;font-weight:700}'
    + '.adm-price__alt{display:inline!important;font-size:1.02rem!important;font-weight:700;'
    + 'color:var(--citui-navy-900)!important}';
  document.head.appendChild(st);
  document.querySelectorAll('.adm-mine__off').forEach(function(l){
    l.classList.add('citui-btn','citui-btn--ghost');
  });
  // A régi alakban a HAVI állt elöl és az éves kísérte („+490 Ft/hó = 4 900 Ft/év”):
  // a sorrendet is vissza kell fordítani, különben az „annual-leads” detektor egy
  // olyan lapon marad zöld, ahol a havi a vezető szám.
  document.querySelectorAll('.adm-mine__p .adm-price').forEach(function(w){
    const lead = w.querySelector('.adm-price__lead'), alt = w.querySelector('.adm-price__alt');
    if (!lead || !alt) { if (lead && lead.textContent.indexOf('+') !== 0) lead.textContent = '+' + lead.textContent; return; }
    const y = lead.textContent, m = alt.textContent;
    lead.textContent = '+' + m;
    alt.textContent = ' = ' + y;
  });
  const now = document.getElementById('adm-mine-now'); if (now) now.remove();
  const all = document.getElementById('adm-mine-all'); if (all) all.remove();
  document.querySelectorAll('.adm-mine__row .adm-mine__t').forEach(function(t){
    if (!t.querySelector('span')) {
      const s = document.createElement('span'); s.textContent = 'Aktív az oldalán.'; t.appendChild(s);
    }
  });
  const d = document.querySelector('details.adm-sub__items'); if (d) d.open = false;
  // ⑨ A 2026-09-14 (②) ELŐTTI alapdíj-felirat: feltétel nélkül „időpontkérés",
  // akkor is, amikor ugyanez a lap „nem számítjuk"-nak jelöli azt a modult.
  document.querySelectorAll('.adm-sub__row span, .adm-sumbar__l').forEach(function(e){
    if (/^Alapdíj/.test(e.textContent.trim())) e.textContent = 'Alapdíj (honlap + időpontkérés)';
  });
})()`;

const TMP = mkdtempSync(path.join(os.tmpdir(), "cit-quietlist-"));
const fileFor = (name: string, html: string) => {
  const p = path.join(TMP, name);
  writeFileSync(p, html, "utf8");
  return pathToFileURL(p).href;
};

const URL_ANNUAL = fileFor("annual.html", pageHtml(mkSub("annual")));
const URL_MONTHLY = fileFor("monthly.html", pageHtml(mkSub("monthly")));
const URL_FROZEN = fileFor("frozen.html", pageHtml(mkSub("annual", true)));

const browser = await chromium.launch({ executablePath: config.chromiumPath });

const open = async (url: string, width: number): Promise<Page> => {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript("window.__name = (f) => f;");
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(150);
  if (SELF_TEST) await page.evaluate(REGRESS);
  return page;
};

/** WCAG relatív luminancia — a kontrasztot MÉRJÜK, nem feltételezzük. */
const contrast = (fg: number[], bg: number[]): number => {
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const rgb = (s: string): number[] =>
  (s.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);

console.log(
  SELF_TEST
    ? "\n⚠️ PIROS ÖNTESZT — a 2026-09-14 ELŐTTI alakon MINDEN állításnak buknia kell:\n"
    : "\n── Modulok fül — „Csendes lista” kontraktus (modules-quiet-list) ──\n",
);

// ── ⓪ a fixture bizonyítja, hogy a Modulok fület rendereltük ───────────────
const p1280 = await open(URL_ANNUAL, 1280);
console.log("⓪ A fixture a Modulok fület rendereli:\n");
const rowCount = await p1280.locator(".adm-mine__row").count();
// ⚠️ Ez az EGYETLEN állítás, ami az öntesztben is zöld: a regresszió a lap
// SZERKEZETÉT állítja vissza, nem a fixture-t. Ha ez bukna, semmit sem mérünk.
check(rowCount === PAID.length + 1, `${PAID.length + 1} birtokolt sor renderelt (${rowCount})`);

// ── ① „+" csak a kirakatban ────────────────────────────────────────────────
console.log("\n① §6 — a MEGVETT modul árán nincs „+”, a kirakatén van:\n");
const owned = flat(await p1280.locator(".adm-mine .adm-price__lead").first().innerText());
check(!owned.startsWith("+"), `a birtokolt modul ára „${owned}” — nem hozzáadandó tétel`, "owned-no-plus");
const shop = flat(await p1280.locator(".adm-shop__card .adm-price__lead").first().innerText());
check(shop.startsWith("+"), `a kirakat-kártyán MARAD a „+” („${shop}”) — ott valódi növekmény`);

// ── ② az ÉVES szám a nagyobb (MÉRVE) ───────────────────────────────────────
console.log("\n② §7 — éves fiónál az ÉVES szám a kiemelt (betűméret mérve):\n");
const sizes = (await p1280.evaluate(
  "(() => { const r = document.querySelector('.adm-mine__p');" +
    "const l = r.querySelector('.adm-price__lead'), a = r.querySelector('.adm-price__alt');" +
    "const px = e => parseFloat(getComputedStyle(e).fontSize);" +
    "return { leadText: l.textContent, altText: a ? a.textContent : '', lead: px(l), alt: a ? px(a) : 0 }; })()",
)) as { leadText: string; altText: string; lead: number; alt: number };
check(
  /\/év/.test(flat(sizes.leadText)),
  `a KIEMELT szám az éves („${flat(sizes.leadText).trim()}”)`,
  "annual-leads",
);
check(
  sizes.lead > sizes.alt,
  sizes.lead > sizes.alt
    ? `⭐ az éves betűmérete NAGYOBB (${sizes.lead}px > ${sizes.alt}px) — a legnagyobb szám az, amit fizet`
    : `a havi a nagyobb vagy egyenlő (${sizes.lead}px ≤ ${sizes.alt}px) — a régi szabály él`,
  "annual-bigger",
);
check(
  /\/hó/.test(flat(sizes.altText)),
  "a havi alak megmarad kíséretként (ezen hasonlítja össze a modulokat)",
);

// ── ③ a sor RÁCS, és a lemondás nem törik balra ────────────────────────────
console.log("\n③ §1 — a sor rács, és a lemondás a „Megnézem” UTÁN van (390 ÉS 1280 px):\n");
for (const [w, page] of [
  [1280, p1280],
  [390, await open(URL_ANNUAL, 390)],
] as const) {
  const geo = (await page.evaluate(
    "(() => { const row = document.querySelector('.adm-mine__row');" +
      "const pv = row.querySelector('[data-pv]'), off = row.querySelector('.adm-mine__off');" +
      "const b = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; };" +
      "return { disp: getComputedStyle(row).display, pv: b(pv), off: b(off) }; })()",
  )) as { disp: string; pv: { x: number; y: number }; off: { x: number; y: number } };
  check(geo.disp === "grid", `@${w}px a sor display=${geo.disp}`, `grid-${w}`);
  check(
    geo.off.x > geo.pv.x,
    geo.off.x > geo.pv.x
      ? `⭐ @${w}px a lemondás a „Megnézem” UTÁN (x=${geo.off.x} > ${geo.pv.x})`
      : `@${w}px a lemondás BALRA került (x=${geo.off.x} ≤ ${geo.pv.x}, y ${geo.off.y} vs ${geo.pv.y}) — a tördelés visszatért`,
    `off-order-${w}`,
  );
}

// ── ④ halk, de látható és olvasható ────────────────────────────────────────
console.log("\n④ §2 — a lemondás halk, de LÁTHATÓ, kattintható és olvasható:\n");
const offInfo = (await p1280.evaluate(
  "(() => { const l = document.querySelector('.adm-mine__off');" +
    "const cs = getComputedStyle(l); const r = l.getBoundingClientRect();" +
    "let bg = 'rgb(255,255,255)', n = l.parentElement;" +
    "while (n) { const c = getComputedStyle(n).backgroundColor;" +
    "if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } n = n.parentElement; }" +
    "return { btn: l.classList.contains('citui-btn'), color: cs.color, bg," +
    "visible: r.width > 0 && r.height > 0, cb: !!l.querySelector('input[type=checkbox]') }; })()",
)) as { btn: boolean; color: string; bg: string; visible: boolean; cb: boolean };
check(!offInfo.btn, offInfo.btn ? "még mindig citui-btn (teljes súlyú gomb)" : "nem `citui-btn`", "off-not-btn");
check(offInfo.visible && offInfo.cb, "LÁTHATÓ és a kapcsolóját hordozza (egy kattintás)");
const ratio = contrast(rgb(offInfo.color), rgb(offInfo.bg));
check(
  ratio >= 4.5,
  ratio >= 4.5
    ? `⭐ a nyugalmi színe olvasható (kontraszt ${ratio.toFixed(2)} ≥ 4,5)`
    : `a lemondás színe olvashatatlan (kontraszt ${ratio.toFixed(2)} < 4,5)`,
);

// ── ⑤ az alapeset EGYSZER — de nem VESZETT EL ──────────────────────────────
console.log("\n⑤ §3 — az alapeset egyszer szerepel, és a FK-006b tűje továbbra is fog:\n");
const inRows = await p1280.evaluate(
  "(() => [...document.querySelectorAll('.adm-mine__row .adm-mine__t span')]" +
    ".filter(s => /Aktív az oldalán/.test(s.textContent)).length)()",
);
check(inRows === 0, `a SOROKBAN 0× szerepel az alapeset-mondat (${inRows})`, "plain-rows-0");
const allText = flat(await p1280.locator("#adm-mine-all").innerText().catch(() => ""));
const claimed = Number((allText.match(/\d+/) ?? ["0"])[0]);
check(
  claimed === PLAIN_ROWS,
  claimed === PLAIN_ROWS
    ? `⭐ a gyűjtő-mondat ${claimed} alapesetű modult állít — pont annyi, amennyi (${PLAIN_ROWS})`
    : `a gyűjtő-mondat ${claimed}-t állít, a valóság ${PLAIN_ROWS}`,
  "plain-count",
);
// ⛔ A RUNNER SAJÁT mechanizmusa: az FK-006b `várd: látható "Aktív az oldalán"`
// sora `page.getByText`-tel keres. Ha ez nem fog, a forgatókönyv NÉMÁN bukna.
const needle = p1280.getByText("Aktív az oldalán");
let needleVisible = false;
for (let i = 0; i < Math.min(await needle.count(), 30); i++) {
  if (await needle.nth(i).isVisible().catch(() => false)) needleVisible = true;
}
check(
  needleVisible,
  needleVisible
    ? "⭐ az FK-006b tűje („Aktív az oldalán”) a runner saját keresőjével LÁTHATÓ"
    : "⛔ az FK-006b `várd: látható \"Aktív az oldalán\"` sora ELBUKNA — az információ elveszett",
);
const pFrozen = await open(URL_FROZEN, 1280);
const frozenHasAll = (await pFrozen.locator("#adm-mine-all").count()) > 0;
check(
  !frozenHasAll,
  !frozenHasAll
    ? "⭐ fagyasztás alatt a gyűjtő-mondat NEM jelenik meg (a frozen-state-check tiltása sértetlen)"
    : "fagyasztás alatt is kiírja, hogy aktív — az oldal közben 503-at ad",
);

// ── ⑥ EGY igazság: fejléc-pirula = összegző = számla-cella ─────────────────
console.log("\n⑥ §4 — a fejléc-pirula, az összegző és a számla-cella UGYANAZ:\n");
const trio = (await p1280.evaluate(
  "(() => { const t = s => (document.querySelector(s)?.textContent || '').replace(/\\u00a0/g,' ').trim();" +
    "return { now: t('#adm-mine-now'), sum: t('#adm-sum-total'), inv: t('#adm-next-total') }; })()",
)) as { now: string; sum: string; inv: string };
check(trio.now.includes(huf(ANNUAL)), `a fejléc-pirula: „${trio.now}” (várt ${huf(ANNUAL)})`, "head-pill");
check(trio.sum === huf(ANNUAL), `az összegző: „${trio.sum}”`);
check(trio.inv.includes(huf(ANNUAL)), `a számla-cella: „${trio.inv}”`);
// A kapcsolgatás MINDHÁRMAT mozgatja — egy statikus fejléc-szám, amit a lenti
// összegző meghazudtol, rosszabb, mint a semmi.
await p1280.evaluate(
  "(() => { const cb = document.querySelector('input[name=module][data-price=\"990\"]');" +
    "cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); })()",
);
await p1280.waitForTimeout(120);
const after = (await p1280.evaluate(
  "(() => { const t = s => (document.querySelector(s)?.textContent || '').replace(/\\u00a0/g,' ').trim();" +
    "return { now: t('#adm-mine-now'), sum: t('#adm-sum-total') }; })()",
)) as { now: string; sum: string };
const want = huf(ANNUAL - 990 * MULT);
check(
  after.sum === want && after.now.includes(want),
  after.sum === want && after.now.includes(want)
    ? `⭐ lemondás után MINDKETTŐ ${want} (a fejléc követi az összegzőt)`
    : `szétcsúsztak: fejléc „${after.now}” · összegző „${after.sum}” (várt ${want})`,
  "head-follows",
);

// ── ⑦ a számla-tételek nyitva ──────────────────────────────────────────────
console.log("\n⑦ §5 — a tételes számla NYITVA:\n");
const detOpen = await p1280.evaluate(
  "(() => !!document.querySelector('details.adm-sub__items')?.open)()",
);
check(Boolean(detOpen), "a „A következő számla tételei” alapból nyitva van", "details-open");

// ── ⑧ havi fiónál nincs éves alak ──────────────────────────────────────────
console.log("\n⑧ §7 — HAVI fiónál nem jelenik meg éves alak (ott zaj lenne):\n");
const pMonthly = await open(URL_MONTHLY, 1280);
const mineText = flat(await pMonthly.locator(".adm-mine").innerText());
check(!/\/év/.test(mineText), "a birtokolt listában nincs „/év” havi fiónál");
const mLead = flat(await pMonthly.locator(".adm-mine .adm-price__lead").first().innerText());
check(!mLead.startsWith("+"), `havi fiónál is „+” nélkül: „${mLead}”`, "monthly-no-plus");

// ── ⑨ §9 — az alapdíj felirata nem nevezhet meg KIVÁLTOTT funkciót ─────────
// Tulajdonosi döntés 2026-09-14 (②). A régi felirat feltétel nélkül „időpontkérés"-t
// írt — ugyanazon a lapon, amelyik az Időpontkérés sorát „nem számítjuk"-kal jelöli,
// mert az Online foglalás váltotta ki. Kettő közül az egyik szükségképpen hamis volt.
console.log("\n⑨ §9 — az alapdíj felirata a gerinc-slot VALÓDI állapotából származik:\n");
/** A két fogyasztó felirata: a NYITOTT számla sora és az összegző cellája. */
const baseLabels = async (page: Page) =>
  (await page.evaluate(
    "(() => { const inv = [...document.querySelectorAll('.adm-sub__row span')]" +
      ".map(s => s.textContent.trim()).filter(t => /^Alapdíj/.test(t));" +
      "const sum = [...document.querySelectorAll('.adm-sumbar__l')]" +
      ".map(s => s.textContent.trim()).filter(t => /^Alapdíj/.test(t));" +
      "return { inv, sum }; })()",
  )) as { inv: string[]; sum: string[] };

// A fixture gerince KI VAN VÁLTVA (enquiry → booking), tehát ez a hibás eset.
const supersededLabels = await baseLabels(p1280);
const supersededHas = flat(await p1280.locator(".adm-mine").innerText()).includes("nem számítjuk");
check(supersededHas, "a fixture TÉNYLEG a kiváltott esetet rendereli („nem számítjuk” a listában)");
const allLabels = [...supersededLabels.inv, ...supersededLabels.sum];
check(allLabels.length === 2, `az alapdíj felirata 2 helyen áll (${allLabels.length})`);
check(
  allLabels.length > 0 && allLabels.every((l) => l === allLabels[0]),
  allLabels.every((l) => l === allLabels[0])
    ? `⭐ EGY forrás: a számla-sor és az összegző szó szerint ugyanaz („${allLabels[0]}”)`
    : `szétcsúszott: ${allLabels.map((l) => `„${l}”`).join(" ≠ ")}`,
  "base-label-one-source",
);
check(
  allLabels.every((l) => !/időpontkérés/i.test(l)),
  allLabels.every((l) => !/időpontkérés/i.test(l))
    ? `⭐ kiváltott gerincnél a felirat NEM nevezi meg a kiváltott funkciót („${allLabels[0]}”)`
    : `a felirat „időpontkérés”-t ígér, miközben a lap „nem számítjuk”-nak jelöli: „${allLabels[0]}”`,
  "base-label-superseded",
);

// ⛔ És NEM úgy oldjuk meg, hogy törlünk: ahol a gerinc TÉNYLEG fut, ott meg kell
// neveznie (feedback_layout_swap_silently_removes_information).
const plainModules = modules.map((m) => (m.spine ? { ...m, supersededBy: null } : m));
const plainMv: TenantModuleView = { ...mv, modules: plainModules };
const plainHtml =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>${CSS}</style></head>` +
  `<body><div class="adm-shell"><main class="adm-main"><div class="adm-main__inner">` +
  modulesSection(plainMv, mkSub("annual"), null, "hello@citoviso.com", null, "hu") +
  `</div></main></div></body></html>`;
const pPlain = await open(fileFor("plain.html", plainHtml), 1280);
const plainLabels = await baseLabels(pPlain);
const plainAll = [...plainLabels.inv, ...plainLabels.sum];
check(
  plainAll.length > 0 && plainAll.every((l) => /időpontkérés/i.test(l)),
  plainAll.every((l) => /időpontkérés/i.test(l))
    ? `⭐ futó gerincnél a felirat MEGNEVEZI („${plainAll[0]}”) — nem töröltünk információt`
    : `a futó gerincnél sem nevezi meg: „${plainAll[0] ?? "(nincs)"}”`,
  "base-label-plain",
);
check(
  flat(await pPlain.locator(".adm-mine").innerText()).includes("az árban"),
  "a futó gerinc sora „az árban” chipet visel (a modules-billing §8 chipjéhez nem nyúltunk)",
);

await browser.close();

if (SELF_TEST) {
  const survived = MUST_FAIL_ON_OLD.filter((id) => !red.has(id));
  if (survived.length === 0) {
    console.log(
      `\n✅ PIROS ÖNTESZT: a régi alakon mind a ${MUST_FAIL_ON_OLD.length} kötött állítás elbukott — a detektorok ÉLNEK.` +
        `\n   (A többi zölden maradt, és ez HELYES: a kirakat „+”-a, a kontraszt, a fagyasztott ág és a havi fiók` +
        `\n    nem alanya a visszarontásnak — ezért megy névsorra az önteszt, nem darabszámra.)\n`,
    );
    process.exit(0);
  }
  console.log(
    `\n❌ PIROS ÖNTESZT: ${survived.length} detektor ÁTENGEDNÉ a régi felületet: ${survived.join(", ")}\n`,
  );
  process.exit(1);
}

console.log(
  bad === 0
    ? "\n✅ A Modulok fül a jóváhagyott „Csendes lista” tervet szállítja.\n"
    : `\n❌ ${bad} eltérés a jóváhagyott kontraktustól.\n`,
);
process.exit(bad === 0 ? 0 : 1);
