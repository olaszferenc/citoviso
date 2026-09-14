// FROZEN-PHONE őr — a fagyás-blokk telefonon ELSŐ FESTÉSKOR is olvasható.
//
//   npx tsx scripts/frozen-phone-check.mts [--self-test]
//
// Kontraktus: `assets/design-refs/console/freeze-state-v2/` ⑦.
//
// Miért kell BÖNGÉSZŐ hozzá (a másik három fagyás-őr mind szöveget mér):
//   A szöveg jelenléte NEM láthatóság. Mérve 2026-09-14, 390×844-en: az előző
//   körben javított teendő-sor y=730..878 közt állt, a mobilon FIX alsó fülsáv
//   (`.adm-side` → `position:fixed;bottom:0`) pedig y=658-tól — vagyis a mondat
//   ott volt a lapon, a `visible()`-alapú őr zölden át is engedte, a telefonos
//   tulaj mégis a fülsávot látta a helyén. Takarva nem volt (a `.adm-main__inner`
//   208px alsó padingja kigörgethetővé teszi), de LÁTHATÓ sem.
//
//   Ezért ez az őr `elementFromPoint`-tal ítél, GÖRGETÉS NÉLKÜL, a nyitó nézetben
//   — és nem teljes-lapos képről, mert az a fix/sticky elemeket a végleges helyükre
//   festi, és egy sosem látható sávot is zöldnek mutatna
//   (reference_fullpage_shot_hides_dead_sticky).
//
// Hermetikus: a VALÓDI `adminDashboard()`-ot rendereli fagyasztott fixtúrával, a
// stíluslapokat beágyazza, és `file://`-ról nyitja meg. Nincs DB, nincs szerver.
//
// --self-test a lapot a JAVÍTÁS ELŐTTI elrendezéssel rendereli (a blokk a lap
// aljára tolva, ahogy a teendő-sor állt) — az őrnek pirosra kell mennie.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

import { adminDashboard } from "../src/server/adminViews.js";

const selfTest = process.argv.includes("--self-test");

const day = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 10);

const SUB = {
  status: "frozen",
  periodEnd: iso(-14),
  renewDay: 10,
  nextInvoiceTotal: 10_270,
  nextInvoiceItems: [],
  payUrl: "https://example.invalid/pay",
  arrears: { amount: 10_270, periodStart: iso(-14), periodEnd: iso(16) },
  closesOn: iso(16),
  frozenOn: iso(-4),
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 102_700,
  annualSavings: 20_540,
  annualFreeMonths: 2,
  autoCharge: true,
  coupon: null,
};

const MODULES = [
  ["gallery", "Képek a szállásról", true],
  ["rooms", "Szobák, apartmanok", true],
  ["reviews", "Vendégek véleménye", false],
].map(([id, label, active]) => ({
  id,
  label,
  group: "offer",
  active,
  spine: false,
  priceMonthly: 490,
  cancelAtPeriodEnd: false,
  awaitingFirstCharge: false,
  supersededBy: null,
  publicDesc: null,
}));

const CONTENT = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a Zselic szélén",
  intro: "A Nyugalom Vendégház a Zselic peremén, erdő szélén várja a pihenni vágyókat.",
  highlights: [],
  photos: [],
  usingOwnPhotos: true,
  status: "suspended",
  previewPath: null,
  lang: "hu",
};

/** ⛔ A --self-test a JAVÍTÁS ELŐTTI helyzetet állítja elő: a blokkot a nyitó
 *  nézeten túlra tolja, pontosan úgy, ahogy a teendő-sor állt (y≈730 a 844-es
 *  nézetben, a 658-tól kezdődő fix fülsáv alatt). Ha az őr erre is zöld, akkor
 *  nem a láthatóságot méri, hanem a jelenlétet. */
const BREAK_CSS = `<style>.adm-frz{margin-top:560px}</style>`;

const css = ["public/assets/ui/citui.css", "public/assets/ui/citui-admin.css"]
  .map((p) => readFileSync(p, "utf8"))
  .join("\n");

const dir = mkdtempSync(join(tmpdir(), "frozen-phone-"));
const files: { tab: string; path: string }[] = [];
for (const tab of ["attekintes", "modulok", "uzenetek"]) {
  const html = adminDashboard(
    { username: "elek@citoviso.com", displayName: "Nyugalom Vendégház" } as never,
    CONTENT as never,
    {
      tab,
      subscription: SUB as never,
      modules: { modules: MODULES, baseMonthly: 4880, totalMonthly: 10_270 } as never,
      siteUrl: "https://nyugalom.citoviso.com",
      previewToken: "tok",
      // ⚠️ TELJES fixtúra: a `scripts/` nincs típus-ellenőrizve, ezért a hiányzó
      // KÖTELEZŐ mező csak futásidőben derül ki (élesben meg is történt az
      // ADR-0154 `openThreads` mezőjével) — `reference_scripts_are_not_typechecked`.
      messages: {
        messages: [],
        unread: 0,
        topic: "mind",
        channel: "",
        unreadOnly: false,
        q: "",
        openThreads: [],
        confirmRead: false,
        total: 0,
        mindCount: 0,
        topicCounts: {},
        channelCounts: {},
        unreadCount: 0,
        openId: null,
      } as never,
    },
  );
  const path = join(dir, `${tab}.html`);
  writeFileSync(
    path,
    html
      .replace(/<link rel="stylesheet" href="\/assets\/ui\/[^"]*">/g, "")
      .replace("</head>", `<style>${css}</style>${selfTest ? BREAK_CSS : ""}</head>`),
  );
  files.push({ tab, path });
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};

console.log(
  selfTest
    ? "frozen-phone-check --self-test: a blokkot a nyitó nézeten túlra toljuk — mindennek pirosnak kell lennie"
    : "frozen-phone-check: látszik-e a fagyás-blokk telefonon, görgetés nélkül",
);

const browser = await chromium.launch();
for (const { tab, path } of files) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(path).href, { waitUntil: "networkidle" });
  // ⛔ SEMMILYEN görgetés/`click()` a mérés előtt: a Playwright auto-scrollja az
  // `overflow:hidden` konténert is elgörgeti, és egy sosem látható vezérlőt is
  // zöldre mérne (feedback_autoscroll_hides_offscreen_control).
  const r = (await page.evaluate(`(function(){
    var blk = document.querySelector(".adm-frz");
    if (!blk) return { hiba: "nincs fagyás-blokk" };
    function judge(el, name){
      if (!el) return { name: name, verdict: "HIÁNYZIK" };
      var r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return { name: name, verdict: "A NYITÓ NÉZETEN KÍVÜL", top: Math.round(r.top) };
      var t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      if (t === el || el.contains(t)) return { name: name, verdict: "OK", top: Math.round(r.top) };
      var c = t, cls = "";
      while (c) { if (c.className && typeof c.className === "string") { cls = c.className; break; } c = c.parentNode; }
      return { name: name, verdict: "TAKARVA: " + cls, top: Math.round(r.top) };
    }
    return { parts: [ judge(blk.querySelector(".adm-owe__v"), "az összeg"),
                      judge(blk.querySelector(".adm-owe__pay"), "a fizetés-gomb") ] };
  })()`)) as { hiba?: string; parts?: { name: string; verdict: string; top?: number }[] };

  if (r.hiba) {
    fail(`[${tab}] ${r.hiba}`);
  } else {
    for (const p of r.parts!) {
      if (p.verdict === "OK") {
        if (!selfTest) console.log(`  ✔ [${tab}] ${p.name} látszik görgetés nélkül (top=${p.top})`);
      } else {
        fail(`[${tab}] ${p.name}: ${p.verdict} — a telefonos tulaj belépéskor nem látja`);
      }
    }
  }
  await page.close();
}
await browser.close();

if (failures) {
  console.error(`\nfrozen-phone-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error(
    "\n⛔ --self-test: a lap aljára tolt blokkra sem találtam sértést — az őr a JELENLÉTET méri, nem a láthatóságot.",
  );
  process.exit(1);
}
console.log("✅ frozen-phone-check: a tartozás és a fizetés-gomb telefonon, görgetés nélkül látszik.");
