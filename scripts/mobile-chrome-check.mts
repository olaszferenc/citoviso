// Phone chrome gate (ADR-0253, contract: assets/design-refs/tenant-site/mobile-chrome-B).
// gate-runner: self-overlap-safe — renders in memory (setContent), writes no file, no row, no shared path; the --selftest and the gate may run side by side (ADR-XXXX)
//
// The owner's rule, verbatim: „amint elérjük a foglalási részt, tűnjön el ez a sáv”. A guest
// tapped "Foglalás", picked her dates, and then tried to SEND with the phone bar's
// "FOGLALÁS" button that had stayed on screen the whole way — it only jumps back up; the
// real "Foglalási kérés elküldése" sat further down, unnoticed. So:
//
//   ① while ANY part of the booking block (#cit-booking — or, with no booking module, the
//     enquiry form's #cit-enquiry) is on screen, NO sticky booking button may be visible —
//     not the phone bar, not a sticky header's CTA, not a sticky dock; phone AND desktop.
//     Scrolled through the block in ≤ 40 px steps, with the widget EMPTY and FILLED
//     (two dates picked, "Tovább", the fields typed in — the filled form is the taller one);
//   ② a phone has a working nav: the menu button opens, Esc / a tap outside / a menu item
//     close it, and the item lands its section on screen; or the template's own phone nav
//     ([data-cit-ownnav]) shows links;
//   ③ the phone bar is not on the first screen (it arrives after the hero) and does not
//     exist on a desktop;
//   ④ no JS error; innerWidth === the device width (a phone widens its layout viewport
//     instead of scrolling sideways — memory: phone widens layout viewport).
//
// Every template renders twice: the MOCK (booking sample → #cit-booking) and a LIVE page
// WITHOUT the booking module (enquiry form → #cit-enquiry).
//
//   npx tsx scripts/mobile-chrome-check.mts                 gate: 19 templates × 2 pages × 2 viewports
//   npx tsx scripts/mobile-chrome-check.mts --only=fullbleed,cinematic
//   npx tsx scripts/mobile-chrome-check.mts --selftest      negative control (planted faults must go red)
//   npx tsx scripts/mobile-chrome-check.mts a.html b.html   measure given files (e.g. a pre-fix render)
//
// Transitions are switched off while measuring: the rule is about what STAYS on screen; a
// 0.28 s slide-out would otherwise be read as a violation at the entering step.
process.env.CIT_SHOT = "1";

import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";

const args = process.argv.slice(2);
const flag = (n: string): string => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=").slice(1).join("=");
const onlyIds = flag("only").split(",").filter(Boolean);
const selftest = args.includes("--selftest");
const files = args.filter((a) => !a.startsWith("--"));

// ── fixture: the same rich guest shape as guest-mobile-check (rooms · gallery · reviews) ──
const demo: SiteData = {
  name: "Lidó Wellness és Bor Villa Példa", // a LONG name on purpose: the bugs this gate guards were name-length bound
  tagline: "Csend és kilátás a hegy tetején",
  intro:
    "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel, borpincével és wellness-részleggel.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness és szauna", "Teraszos étterem", "Ingyenes parkolás", "Gigabit WiFi"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-2/900/1100", alt: "Szoba", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-3/900/700", alt: "Terasz", provenance: "owner" },
    { url: "https://picsum.photos/seed/cit-4/900/700", alt: "Étterem", provenance: "owner" },
  ],
  contact: { email: "foglalas@hotelpelda.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [
    { name: "Superior szoba", capacity: "2 fő · 26 m²", note: "Városra néző, franciaágyas.", price: "42 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r1/900/560", alt: "Superior" } },
    { name: "Deluxe panoráma", capacity: "2 fő · 32 m²", note: "Franciaerkély a várra.", price: "58 000 Ft / éj", photo: { url: "https://picsum.photos/seed/cit-r2/900/560", alt: "Deluxe" } },
  ],
  reviews: [
    { quote: "A tetőteraszról nézni a kivilágított várat — ezért önmagában megérte.", author: "Andrea", meta: "Budapest" },
    { quote: "Az árakat előre, pontosan láttuk.", author: "Péter", meta: "Nyíregyháza" },
  ],
  stats: [{ value: "4,6", label: "Google-értékelés · 1 892 vélemény", icon: "star" }, { value: "84", label: "szoba" }],
  faqs: [{ q: "Mikor van check-in?", a: "Érkezés 15:00-tól, távozás 11:00-ig." }],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
};
const baseSections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map(
  (kind) => ({ kind }),
);

interface Target { id: string; html?: string; file?: string; expect?: string[] }

async function render(id: string, phase: "mock" | "live"): Promise<string> {
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: baseSections };
  return injectRuntime(renderSite(recipe, demo, { phase }), demo.lang);
}

// Planted faults (--selftest): each must make its rule go red; the clean pages must not.
// The old behaviour = the bar shown AND its button not stepping aside: the runtime hides the
// bar's own button too (cit-away), so a planted "bar stays" must defeat both, or it models nothing.
const OLD_BAR = `<style>html [data-cit-mobbar]{visibility:visible!important;transform:none!important} html [data-cit-mobbar] .cit-away, html [data-cit-mobbar] a{visibility:visible!important;opacity:1!important}</style>`;
const PLANTED: { id: string; tpl: string; phase: "mock" | "live"; add: string; expect: string[] }[] = [
  { id: "selftest-bar-stays", tpl: "fullbleed", phase: "mock", add: OLD_BAR, expect: ["①sticky-cta-at-block"] },
  { id: "selftest-header-cta-stays", tpl: "fullbleed", phase: "mock", add: `<style>html .cit-away{visibility:visible!important;opacity:1!important;pointer-events:auto!important}</style>`, expect: ["①sticky-cta-at-block"] },
  { id: "selftest-enquiry-bar-stays", tpl: "cinematic", phase: "live", add: OLD_BAR, expect: ["①sticky-cta-at-block"] },
  { id: "selftest-no-menu", tpl: "fullbleed", phase: "mock", add: `<script>addEventListener('load',function(){setTimeout(function(){var b=document.querySelector('.cit-pmenu-btn');if(b)b.remove()},0)})</script>`, expect: ["②nincs-mobil-menü"] },
  { id: "selftest-menu-no-close", tpl: "fullbleed", phase: "mock", add: `<script>document.addEventListener('keydown',function(e){if(e.key==='Escape')e.stopImmediatePropagation()},true)</script>`, expect: ["②menü-zárás"] },
  { id: "selftest-overflow", tpl: "fullbleed", phase: "mock", add: `<style>body{min-width:430px}</style>`, expect: ["④innerWidth"] },
  { id: "selftest-bar-on-desktop", tpl: "fullbleed", phase: "mock", add: `<style>@media (min-width:701px){html [data-cit-mobbar]{display:flex!important;visibility:visible!important;transform:none!important;position:fixed!important;bottom:0!important}}</style>`, expect: ["③asztali-sáv"] },
];

async function targets(): Promise<Target[]> {
  if (selftest) {
    const out: Target[] = [
      { id: "selftest-clean-fullbleed", html: await render("fullbleed", "mock"), expect: [] },
      { id: "selftest-clean-cinematic-live", html: await render("cinematic", "live"), expect: [] },
    ];
    for (const p of PLANTED) out.push({ id: p.id, html: (await render(p.tpl, p.phase)).replace("</body>", `${p.add}</body>`), expect: p.expect });
    return out;
  }
  if (files.length) return files.map((f) => ({ id: path.basename(f).replace(/\.html?$/i, ""), file: path.resolve(f) }));
  const out: Target[] = [];
  for (const id of Object.keys(TEMPLATES)) {
    if (onlyIds.length && !onlyIds.includes(id)) continue;
    out.push({ id: `${id}·foglalás`, html: await render(id, "mock") });
    out.push({ id: `${id}·érdeklődés`, html: await render(id, "live") });
  }
  return out;
}

// ── in-page probes (strings, so no tsx helper leaks into the page) ─────────────────────
const LIB = `
  const W = innerWidth, H = innerHeight;
  const effOp = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  const vis = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    if (effOp(el) < 0.05) return false; const r = el.getBoundingClientRect(); if (!(r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W)) return false;
    const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit) || hit.contains(el)); };
  const positioned = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const book = document.getElementById('cit-booking');
  const enq = document.getElementById('cit-enquiry');
  const block = book || (enq && enq.querySelector('form, input, textarea') ? enq : null);
  const BOOK_RE = /foglal|érdeklőd|ajánlat|időpont/i;
`;

/** Visible sticky booking buttons right now, and whether the block is on screen. */
const PROBE = `(() => { ${LIB}
  if (!block) return { noBlock: true };
  const br = block.getBoundingClientRect();
  const blockIn = br.bottom > 0 && br.top < H;
  const bad = [];
  for (const el of document.querySelectorAll('a, button')) {
    if (block.contains(el) || el.closest('form, #cit-pmenu')) continue;
    const href = el.getAttribute('href') || '';
    const t = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (!(href === '#cit-booking' || href === '#cit-enquiry' || (t.length < 45 && BOOK_RE.test(t)))) continue;
    if (!positioned(el) || !vis(el)) continue;
    bad.push(t.slice(0, 30) || href);
  }
  return { blockIn, bad, top: Math.round(br.top + scrollY), bottom: Math.round(br.bottom + scrollY), y: Math.round(scrollY) };
})()`;

const settle = (p: Page) => p.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));

type Finding = { rule: string; msg: string };

async function sweep(p: Page, state: string, F: (rule: string, msg: string) => void): Promise<number> {
  const first: any = await p.evaluate(PROBE);
  if (first.noBlock) { F("①nincs-blokk", "nincs #cit-booking / érdeklődő űrlap a lapon"); return 0; }
  const H = await p.evaluate(() => innerHeight);
  // from a screen above the block to a screen below it, ≤ 40 px a step
  const from = Math.max(0, first.top - H - 80), to = first.bottom + 80;
  let steps = 0, hits = 0;
  for (let y = from; y <= to; y += 40) {
    await p.evaluate((yy) => scrollTo(0, yy), y);
    await settle(p);
    const r: any = await p.evaluate(PROBE);
    steps++;
    if (r.blockIn && r.bad.length) {
      if (hits++ < 3) F("①sticky-cta-at-block", `${state}: y=${r.y} a blokk a képernyőn, mégis látszik: ${r.bad.join(" | ")}`);
    }
    if (r.y < y - 60) break; // reached the page end
  }
  if (hits > 3) F("①sticky-cta-at-block", `${state}: …összesen ${hits} lépésben (${steps} mért)`);
  return steps;
}

async function fillBooking(p: Page, mobile: boolean): Promise<void> {
  const hasBook = await p.locator("#cit-booking form.cit-book--request").count();
  if (hasBook) {
    const days: string[] = await p.evaluate(() => {
      const ms = document.querySelectorAll("#cit-booking .cit-book__month");
      const m = ms[1] ?? ms[0];
      return m ? [...m.querySelectorAll("button.cit-book__day")].filter((b: any) => !b.disabled && !String(b.className).includes("busy")).map((b) => b.getAttribute("data-day")!) : [];
    });
    for (const d of [days[3], days[6]].filter(Boolean)) {
      await p.evaluate((dd) => (document.querySelector(`#cit-booking [data-day="${dd}"]`) as HTMLElement | null)?.click(), d);
      await settle(p);
    }
    const go = p.locator("#cit-booking .cit-book__go");
    if (mobile && (await go.isVisible()) && (await go.isEnabled())) { await go.click(); await settle(p); }
  }
  const scope = hasBook ? "#cit-booking" : "#cit-enquiry";
  await p.evaluate((sc) => {
    const vals: Record<string, string> = { name: "Teszt Elek", email: "teszt@example.com", phone: "+36301234567", message: "Két éjszakára, két főre." };
    for (const el of document.querySelectorAll(`${sc} input, ${sc} textarea`)) {
      const i = el as HTMLInputElement; const k = i.name || i.type;
      if (["hidden", "checkbox", "radio", "date", "submit"].includes(i.type)) continue;
      const v = vals[k] ?? vals[i.type] ?? "";
      if (v) { i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }, scope);
  await settle(p);
}

async function menuChecks(p: Page, F: (rule: string, msg: string) => void): Promise<void> {
  await p.evaluate(() => scrollTo(0, 0)); await settle(p);
  const btn = p.locator(".cit-pmenu-btn");
  const hasBtn = (await btn.count()) > 0 && (await btn.isVisible());
  const own = await p.evaluate(() => { const n = document.querySelector("[data-cit-ownnav]"); if (!n) return -1;
    return [...n.querySelectorAll('a[href^="#"]')].filter((a) => { const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0; }).length; });
  if (!hasBtn) {
    if (own >= 2) return; // the template's own phone nav (links on screen)
    F("②nincs-mobil-menü", own >= 0 ? `a saját nav ${own} linket mutat telefonon` : "se menü-gomb, se saját telefonos nav");
    return;
  }
  const open = () => p.evaluate(() => { const m = document.getElementById("cit-pmenu"); return !!m && !m.hidden && getComputedStyle(m).display !== "none"; });
  await btn.click(); await settle(p);
  if (!(await open())) { F("②menü-nyitás", "a menü-gomb nem nyitja a menüt"); return; }
  const barWhileOpen = await p.evaluate(() => { const b = document.querySelector("[data-cit-mobbar]"); return !!b && getComputedStyle(b).visibility !== "hidden"; });
  if (barWhileOpen) F("②menü-sáv", "nyitott menü mellett a foglalás-sáv látszik");
  await p.keyboard.press("Escape"); await settle(p);
  if (await open()) { F("②menü-zárás", "Esc nem zárja a menüt"); await btn.click(); await settle(p); }
  await btn.click(); await settle(p);
  const H = await p.evaluate(() => innerHeight);
  await p.mouse.click(12, H - 12); await settle(p);
  if (await open()) { F("②menü-zárás", "a menün kívüli koppintás nem zárja"); await btn.click(); await settle(p); }
  await btn.click(); await settle(p);
  const item = await p.evaluate(() => { const a = document.querySelector("#cit-pmenu li:not(.cit-pmenu__book) a"); return a ? a.getAttribute("href") : null; });
  if (!item) { F("②menü-üres", "a menüben nincs szekció-link"); return; }
  await p.locator(`#cit-pmenu a[href="${item}"]`).first().click();
  await p.waitForTimeout(250); await settle(p);
  if (await open()) F("②menü-zárás", `a menüpont (${item}) nem zárja a menüt`);
  const landed = await p.evaluate((h) => { const t = document.querySelector(h!); if (!t) return null; const r = t.getBoundingClientRect(); return Math.round(r.top); }, item);
  if (landed === null || landed < -2 || landed > 200) F("②menü-ugrás", `a menüpont (${item}) célja nem a képernyő tetején: top=${landed}px`);
}

async function measure(page: Page, t: Target, vp: { w: number; h: number; mobile: boolean }): Promise<Finding[]> {
  const out: Finding[] = [];
  const F = (rule: string, msg: string) => out.push({ rule, msg });
  const errs: string[] = [];
  // Google's map-embed bootstrap ("google is not defined" thrown INSIDE init_embed.js on
  // maps.gstatic.com, a CORS-refused maps.googleapis.com RPC) is a third-party race the page
  // cannot influence — same rule as guest-mobile-check ⑩; 2026-09-28 it failed 3–5 random pages
  // per run. Recognised by the ORIGIN (the error's first stack frame), never by the message
  // alone: our own scripts' errors still count.
  const MAPS = /maps\.gstatic\.com|maps\.googleapis\.com/;
  const onErr = (e: Error) => {
    if (MAPS.test(String(e.stack || "").split("\n").slice(0, 2).join(" "))) return;
    errs.push(e.message.slice(0, 120));
  };
  const onCon = (m: any) => {
    if (m.type() !== "error" || /Failed to load resource|ERR_FAILED|favicon/.test(m.text())) return;
    if (MAPS.test(m.location()?.url ?? "") || /^Access to XMLHttpRequest at 'https:\/\/maps\.googleapis\.com\//.test(m.text())) return;
    errs.push(m.text().slice(0, 120));
  };
  page.on("pageerror", onErr); page.on("console", onCon);
  try {
    if (t.file) await page.setContent(readFileSync(t.file, "utf8"), { waitUntil: "load", timeout: 30000 });
    else await page.setContent(t.html!, { waitUntil: "load", timeout: 30000 });
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important}" });
    await page.waitForSelector("form.cit-book--request, #cit-enquiry form, #cit-enquiry input", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(150);
    const iw = await page.evaluate(() => innerWidth);
    if (iw !== vp.w) F("④innerWidth", `innerWidth ${iw} ≠ ${vp.w} (a lap kiszélesíti a nézetet)`);
    const bar = page.locator("[data-cit-mobbar]");
    const barVisible = async () => (await bar.count()) > 0 && (await page.evaluate(() => { const b = document.querySelector("[data-cit-mobbar]")!; const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.top < innerHeight && r.height > 0; }));
    if (vp.mobile) {
      // the bar waits for the hero's end only where the hero has its OWN booking button
      const heroCta = await page.evaluate(`(() => { const h = document.querySelector('h1'); const c = h && (h.closest('header, section') || h); if (!c) return false;
        return [...c.querySelectorAll('a[href="#cit-booking"], a[href="#cit-enquiry"]')].some(a => { for (let e = a; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return false; } return a.offsetParent !== null; }); })()`);
      if (heroCta && (await barVisible())) F("③sáv-a-hero-n", "a foglalás-sáv már az első képernyőn látszik, pedig a hero-nak saját foglalás-gombja van (egyszerre egy)");
      if (!heroCta && (await bar.count()) && !(await barVisible())) F("③nincs-cta-az-első-képernyőn", "a hero-nak nincs foglalás-gombja, és a sáv sem látszik az első képernyőn");
      await menuChecks(page, F);
    } else {
      for (const y of [0, 1200, 3000]) { await page.evaluate((yy) => scrollTo(0, yy), y); await settle(page); if (await barVisible()) { F("③asztali-sáv", `asztalon alsó foglalás-sáv látszik (y=${y})`); break; } }
      if ((await page.locator(".cit-pmenu-btn").count()) && (await page.locator(".cit-pmenu-btn").isVisible())) F("③asztali-menügomb", "asztalon menü-gomb látszik");
    }
    await sweep(page, "üres", F);
    await fillBooking(page, vp.mobile);
    await sweep(page, "kitöltve", F);
  } catch (e) {
    F("⑤futás", (e as Error).message.slice(0, 160));
  }
  page.off("pageerror", onErr); page.off("console", onCon);
  if (errs.length) F("④JS-hiba", errs.slice(0, 2).join(" · "));
  return out;
}

const VIEWPORTS = [
  { id: "390", w: 390, h: 844, mobile: true },
  { id: "1440", w: 1440, h: 900, mobile: false },
];

// ⏱️ PARALLEL, SAME MEASUREMENT (lassu-land-vizsgalat, ADR-XXXX). The gate was the critical path of
// every template-touching land: 76 page × viewport measurements one after another, 577 s alone
// (+164 s --selftest). Now JOBS workers take the (viewport, target) pairs from one queue. Each
// worker owns its OWN browser context per viewport, and every target still gets a FRESH page,
// so parallel pages share no storage, fragment or focus; the measure() steps and every rule are
// unchanged. Results are printed in the original (viewport, target) order, so the output is the
// same as the serial run's. CIT_MCC_JOBS=1 = the old serial behaviour (one context per viewport).
const JOBS = Math.max(1, Number(process.env.CIT_MCC_JOBS) || 4);
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const list = await targets();
let failed = 0;
const selfBad: string[] = [];
type Vp = (typeof VIEWPORTS)[number];
const work: { vp: Vp; t: Target; fs?: Finding[] }[] = [];
for (const vp of VIEWPORTS) for (const t of list) work.push({ vp, t });
let next = 0;
async function worker(): Promise<void> {
  const ctxs = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();
  try {
    while (next < work.length) {
      const w = work[next++]!;
      let ctx = ctxs.get(w.vp.id);
      if (!ctx) {
        ctx = await browser.newContext({ viewport: { width: w.vp.w, height: w.vp.h }, isMobile: w.vp.mobile, hasTouch: w.vp.mobile, deviceScaleFactor: 1 });
        await ctx.route("**/*", (r) => { const rt = r.request().resourceType(); return rt === "image" || rt === "font" || rt === "media" ? r.abort() : r.continue(); });
        ctxs.set(w.vp.id, ctx);
      }
      // a FRESH page per target: a reused one keeps the previous #fragment (the menu-item
      // jump), and the next document would load already scrolled to it
      const page = await ctx.newPage();
      w.fs = await measure(page, w.t, w.vp);
      await page.close();
    }
  } finally {
    for (const c of ctxs.values()) await c.close();
  }
}
await Promise.all(Array.from({ length: Math.min(JOBS, work.length) }, () => worker()));
for (const { vp, t, fs: found } of work) {
  // ⛔ A pair without a result is a measurement that never happened — never a green.
  const fs = found ?? [{ rule: "⑤futás", msg: "a mérés nem futott le (nincs eredmény)" }];
  if (selftest) {
    const got = new Set(fs.map((f) => f.rule));
    const exp = t.expect ?? [];
    // a planted fault shows on the viewport it is planted for; the clean pages must stay green on both
    const relevant = exp.filter((r) => (r.startsWith("③asztali") ? !vp.mobile : r.startsWith("②") || r.startsWith("④") ? vp.mobile : true));
    const planted = t.id.includes("header-cta") ? !vp.mobile : t.id.includes("desktop") ? !vp.mobile : t.id.includes("bar-stays") || t.id.includes("menu") || t.id.includes("overflow") ? vp.mobile : true;
    if (!exp.length && fs.length) selfBad.push(`${t.id} @${vp.id}: TISZTA lap piros: ${fs.map((f) => f.rule + " " + f.msg).join(" / ")}`);
    if (exp.length && planted) for (const r of relevant) if (!got.has(r)) selfBad.push(`${t.id} @${vp.id}: a beültetett hibát (${r}) NEM fogta meg — ${fs.map((f) => f.rule).join(",") || "zöld"}`);
    console.log(`${fs.length ? "🔴" : "🟢"} ${t.id.padEnd(30)} @${vp.id}  ${fs.map((f) => f.rule).join(", ")}`);
    continue;
  }
  if (fs.length) failed++;
  console.log(`${fs.length ? "🔴" : "🟢"} ${t.id.padEnd(30)} @${vp.id}`);
  for (const f of fs) console.log(`     ${f.rule}  ${f.msg}`);
}
await browser.close();
if (selftest) {
  if (selfBad.length) { console.log("\n⛔ ÖNTESZT BUKOTT:"); for (const s of selfBad) console.log("  " + s); process.exit(1); }
  console.log("\n✅ önteszt: a tiszta lapok zöldek, minden beültetett hiba piros");
  process.exit(0);
}
console.log(failed ? `\n⛔ mobile-chrome-check: ${failed} lap/nézet bukott` : `\n✅ mobile-chrome-check: ${list.length} lap × ${VIEWPORTS.length} nézet zöld (${JOBS} párhuzamos munkás)`);
process.exit(failed ? 1 : 0);
