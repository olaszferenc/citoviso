// Guest-on-a-phone gate + measurement (FK-010 companion, 2026-09-26).
//
// The generated site is used by a GUEST on a phone: she reads rooms and prices, pages
// the gallery, picks dates on the calendar, sends a (sample) request, writes a review.
// This script walks that path in a REAL mobile context (touch + mobile flag, not a
// resized desktop page) on every template + archetype (gate mode) or on the given mock
// files (measurement mode), at three viewports — 390×844 (iPhone), 360×780 (cheap
// Android) and 844×390 (LANDSCAPE: orientation is not width, a landscape phone hid
// 8 of 10 controls once) — and measures, never eyeballs:
//
//   ① horizontal overflow (document wider than the viewport, and WHO sticks out)
//   ② the booking CTA reachable in the first screen + a nav that does not eat the screen
//   ③ touch targets: every visible control < 44×44 px (Apple HIG / WCAG 2.5.5)
//   ④ inputs with font-size < 16 px (iOS zooms the page on focus)
//   ⑤ sticky/fixed bands that cover the viewport (any orientation)
//   ⑥ the booking widget: calendar pages, two taps pick a range, a reversed/past range
//      shows its error WITHIN ONE SCREEN of the date strip, the quote and the submit are
//      within one screen of each other, the sample receipt lands in view
//   ⑦ the room popover opens, fits the viewport, scrolls, closes
//   ⑧ the gallery lightbox opens, the image fits, closes
//   ⑨ the review form: control sizes, the (sample) submit answers
//   ⑩ JS errors on the page
//
// Playwright's own click()/fill() auto-scrolls the target into view and would HIDE an
// unreachable control (measured 2026-09-xx — memory: autoscroll hides offscreen control):
// every judgement here reads getBoundingClientRect() at a scroll position WE set.
//
//   npx tsx scripts/guest-mobile-check.mts                       gate: templates+archetypes
//   npx tsx scripts/guest-mobile-check.mts mock-a.html mock-b…   measure the given files
//   flags: --shots=<dir>  write PNG evidence per page/viewport/moment
//          --vp=390|360|land  restrict viewports (comma list)
//          --json=<file>     machine-readable findings
//          --only=<id>       gate subset by template/archetype id
//
// Exit 1 when any HARD rule fails (see RULES below); ERGONOMIC findings are printed but
// only fail when --strict is given, so the gate stays honest about what it enforces.
process.env.CIT_SHOT = "1";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";

import { config } from "../src/config.js";
import { ARCHETYPES } from "../src/engine/archetypes.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { PORTAL_USER_AGENT } from "../src/scraper/sources/portals/politeness.js";

const args = process.argv.slice(2);
const flag = (n: string): string => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=").slice(1).join("=");
const files = args.filter((a) => !a.startsWith("--"));
const shotsDir = flag("shots");
const jsonOut = flag("json");
const strict = args.includes("--strict");
const onlyIds = flag("only").split(",").filter(Boolean);
const vpFilter = flag("vp").split(",").filter(Boolean);

const selftest = args.includes("--selftest");
// Gate mode (no files) measures 390 only — the pre-commit budget; `--vp=all` runs the three.
const vpWanted = vpFilter.includes("all") ? [] : vpFilter.length ? vpFilter : files.length ? [] : ["390"];
const VIEWPORTS = [
  { id: "390", width: 390, height: 844 },
  { id: "360", width: 360, height: 780 },
  { id: "land", width: 844, height: 390 },
].filter((v) => !vpWanted.length || vpWanted.includes(v.id));

// ── gate fixture (same shape as mobile-sticky-check: rooms + gallery + reviews render) ──
const demo: SiteData = {
  name: "Hotel Példa",
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
  stats: [{ value: "9,2", label: "vendégértékelés", icon: "star" }, { value: "84", label: "szoba" }],
  faqs: [{ q: "Mikor van check-in?", a: "Érkezés 15:00-tól, távozás 11:00-ig." }],
  rating: { value: 4.6, count: 1892 },
  place: { city: "Példaváros", country: "HU" },
};
const baseSections: Recipe["sections"] = (["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const).map(
  (kind) => ({ kind }),
);

interface Target { id: string; kind: "template" | "archetype" | "file"; html?: string; file?: string }

// ── negative control (--selftest): the SAME page with deliberate regressions must go red on
// the rules that claim to catch them; the clean render must not. A guard that cannot fail is
// a false green (memory: guard_greenly_defended_the_bug).
const SELFTEST_REGRESSIONS: { id: string; css: string; expect: string[] }[] = [
  { id: "selftest-overlay-under-bar", css: `.cit-rd, .cit-lb { z-index: 1 !important } .st-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#000;z-index:100}`, expect: ["⑦bezárás-elérhetetlen", "⑧bezárás-elérhetetlen"] },
  { id: "selftest-tiny-controls", css: `.cit-book__calnav{width:20px!important;height:20px!important;flex-basis:20px!important} .cit-rd__x{width:20px!important;height:20px!important}`, expect: ["③érintési-cél", "⑦bezárás-kicsi"] },
  { id: "selftest-overflow", css: `body{min-width:600px}`, expect: ["①túlfolyás"] },
  { id: "selftest-calendar-dead", css: ``, expect: [] }, // the JS below kills the handler; judged by the "paged" probe
];
// a dead "next month" button: the widget's own listener never runs (capture-phase stop)
const SELFTEST_DEAD_JS = `<script>document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.cit-book__calnav--next'))e.stopImmediatePropagation()},true)</script>`;

async function targets(): Promise<Target[]> {
  if (selftest) {
    const tpl = TEMPLATES["editorial"]!;
    const recipe: Recipe = { template: "editorial", skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: baseSections };
    const clean = await injectRuntime(renderSite(recipe, demo, { phase: "mock" }), demo.lang);
    const out: Target[] = [{ id: "selftest-clean", kind: "template", html: clean }];
    for (const r of SELFTEST_REGRESSIONS) out.push({ id: r.id, kind: "template", html: clean.replace("</body>", `<style>${r.css}</style>${r.id === "selftest-overlay-under-bar" ? '<div class="st-bar"></div>' : ""}${r.id === "selftest-calendar-dead" ? SELFTEST_DEAD_JS : ""}</body>`) });
    return out;
  }
  if (files.length) return files.map((f) => ({ id: path.basename(f).replace(/\.html?$/i, ""), kind: "file", file: path.resolve(f) }));
  const out: Target[] = [];
  for (const id of Object.keys(TEMPLATES)) {
    if (onlyIds.length && !onlyIds.includes(id)) continue;
    const tpl = TEMPLATES[id]!;
    const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: baseSections };
    out.push({ id, kind: "template", html: await injectRuntime(renderSite(recipe, demo, { phase: "mock" }), demo.lang) });
  }
  for (const arch of Object.values(ARCHETYPES)) {
    if (onlyIds.length && !onlyIds.includes(arch.id)) continue;
    const recipe: Recipe = { skin: "editorial-warm", archetype: arch.id, sections: baseSections };
    out.push({ id: arch.id, kind: "archetype", html: await injectRuntime(renderSite(recipe, demo, { phase: "mock" }), demo.lang) });
  }
  return out;
}

// ── in-page probes (strings: no tsx __name helper leaks into the page) ─────────────────
// Common helpers, prepended to every probe.
const LIB = `
  // ⛔ Templates set scroll-behavior:smooth — a programmatic scroll is then an ANIMATION,
  // and a rect read 80 ms later still shows the old position (measured: the receipt
  // "landed" mid-flight, 1 615 px down). Judge positions, not the tween.
  document.documentElement.style.scrollBehavior = 'auto'; document.body.style.scrollBehavior = 'auto';
  const W = window.innerWidth, H = window.innerHeight;
  // Visible = painted: display/visibility/opacity checked up the ANCESTOR chain too — aurora's
  // app bar is opacity:0 + pointer-events:none until scrolled, and its button was reported
  // "covered by the masthead" while nobody could see it (false positive, 2026-09-26).
  const vis = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || (e !== el && cs.pointerEvents === 'none')) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
  const txt = (el) => (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\\s+/g,' ').slice(0, 40);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; };
  const fullyInView = (el) => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= H + 1 && r.left >= -1 && r.right <= W + 1; };
  // an ANCESTOR on top counts as cover: a figure's ::after wash painted over the <img> takes the
  // tap, and the picture's own listener never runs (fullbleed, 2026-09-26) — only descendants pass
  const covered = (el) => { const r = el.getBoundingClientRect(); const cx = r.x + r.width/2, cy = r.y + r.height/2; if (cx < 0 || cy < 0 || cx > W || cy > H) return null; const top = document.elementFromPoint(cx, cy); if (!top || top === el || el.contains(top)) return null; return name(top); };
  const CONTROLS = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary';
`;

const PROBE_STATIC = `(() => { ${LIB}
  const out = {};
  // ① horizontal overflow + culprits
  const de = document.documentElement;
  out.scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
  // a mobile browser answers a too-wide page by ZOOMING OUT (the layout viewport grows past
  // the device width, everything shrinks) — the same defect wearing a different face
  out.zoomedOut = W > (window.__vpW || W) + 1;
  out.overflowX = out.scrollW > W + 1 || out.zoomedOut;
  out.overflowCulprits = [];
  if (out.overflowX) {
    const DEV = window.__vpW || W; // when zoomed out, "sticks out" means past the DEVICE width
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el); if (cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.right > DEV + 2 && r.width > 0 && r.height > 0 && vis(el)) {
        // skip children of an already-listed culprit
        if (out.overflowCulprits.some(c => c.el.contains(el))) continue;
        // skip elements inside a horizontally scrolling container (a carousel is fine)
        let p = el.parentElement, scrollable = false;
        while (p && p !== document.body) { const pc = getComputedStyle(p); if (/(auto|scroll)/.test(pc.overflowX)) { scrollable = true; break; } p = p.parentElement; }
        if (scrollable) continue;
        out.overflowCulprits.push({ el, sel: name(el), right: Math.round(r.right), w: Math.round(r.width) });
      }
    }
    out.overflowCulprits = out.overflowCulprits.slice(0, 6).map(c => ({ sel: c.sel, right: c.right, w: c.w }));
  }
  // ② first screen: booking CTA + nav
  const ctas = [...document.querySelectorAll('a[href="#cit-booking"], a[href="#cit-enquiry"], .cit-nav-cta, [data-cit-module="booking"][data-cit-variant="cta"] a')].filter(vis);
  const ctaInFold = ctas.filter(fullyInView);
  out.ctaCount = ctas.length;
  const coverEl = (el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return top && top !== el && !el.contains(top) && !top.contains(el) ? top : null; };
  out.ctaInFold = ctaInFold.map(a => { const c = coverEl(a); const byOwnBar = !!(c && (c.closest('a[href="#cit-booking"], a[href="#cit-enquiry"]') || c.querySelector('a[href="#cit-booking"], a[href="#cit-enquiry"]'))); return { sel: name(a), text: txt(a), r: rect(a), covered: covered(a), byOwnBar }; });
  const navs = [...document.querySelectorAll('nav, header')].filter(vis);
  out.nav = navs.slice(0, 3).map(n => ({ sel: name(n), pos: getComputedStyle(n).position, r: rect(n), links: [...n.querySelectorAll('a')].filter(vis).length }));
  out.hasHamburger = !!document.querySelector('[aria-label*="menü" i], [aria-label*="menu" i], .hamburger, .burger, [class*="nav-toggle"], [class*="menu-toggle"], button[aria-expanded]');
  // sticky/fixed bands: height vs viewport (the covering-dock rule, any orientation)
  out.sticky = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if ((cs.position === 'sticky' || cs.position === 'fixed') && vis(el) && cs.pointerEvents !== 'none') {
      const r = el.getBoundingClientRect();
      if (r.width >= W * 0.6) out.sticky.push({ sel: name(el), pos: cs.position, h: Math.round(r.height), pct: Math.round(r.height / H * 100) });
    }
  }
  out.sticky = out.sticky.slice(0, 8);
  // ③ touch targets (visible controls, page-wide, excluding the runtime overlays which are closed now)
  out.small = []; out.controlCount = 0;
  for (const el of document.querySelectorAll(CONTROLS)) {
    if (!vis(el)) continue;
    if (el.closest('.cit-lb, .cit-rd')) continue;
    out.controlCount++;
    const r = el.getBoundingClientRect();
    // a label wrapping an input is the real target
    const lab = el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') ? el.closest('label') : null;
    const rr = lab ? lab.getBoundingClientRect() : r;
    const w = Math.round(rr.width), h = Math.round(rr.height);
    // calendar day cells: 7 in a 262px column cannot reach 44 — 36+ is the honest floor there
    // a bare <a> inside running text (phone number, e-mail, a link in a paragraph) is text, not a control
    const inNav = !!el.closest('nav, header, [role=navigation]');
    const inlineText = el.tagName === 'A' && !inNav && !(el.className && /btn|cta|book|hot|go\b|nav/i.test(String(el.className)));
    const ctx = (el.closest('nav, header, footer, p, li, dd, address, td, figcaption, small, form') || {}).tagName || '';
    if (el.classList.contains('cit-book__day') ? (w < 36 || h < 36) : (w < 44 || h < 44)) out.small.push({ sel: name(el), text: txt(el), w, h, inlineText, ctx, group: (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase()) });
  }
  // ④ input font-size < 16
  out.smallFont = [];
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
    if (!vis(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) out.smallFont.push({ sel: name(el), fs: Math.round(fs * 10) / 10 });
  }
  // ② the CTA's JUMP: does the booking section land in view, or under the sticky bar?
  out.jump = null;
  const jumpA = ctaInFold[0] || ctas[0];
  if (jumpA) {
    const href = jumpA.getAttribute('href') || '';
    const target = href.startsWith('#') ? document.querySelector(href) : null;
    if (target) {
      window.scrollTo(0, 0); target.scrollIntoView({ block: 'start', behavior: 'auto' });
      const tr = target.getBoundingClientRect();
      // what is the topmost element at the target's first content row?
      const title = target.querySelector('h1,h2,h3,.cit-book__title,.cit-modsec__title,.cit-modsec__h') || target;
      const ttr = title.getBoundingClientRect();
      const cov = (() => { const cx = Math.min(W - 4, Math.max(4, ttr.x + Math.min(ttr.width, 60) / 2)), cy = ttr.y + Math.min(ttr.height, 20) / 2; if (cy < 0 || cy > H) return 'képernyőn kívül'; const top = document.elementFromPoint(cx, cy); if (!top || top === title || title.contains(top) || target.contains(top)) return null; return name(top); })();
      out.jump = { href, targetY: Math.round(tr.top), titleY: Math.round(ttr.top), titleText: txt(title), coveredBy: cov };
      window.scrollTo(0, 0);
    }
  }
  // ⑩ modules present
  out.modules = [...document.querySelectorAll('[data-cit-module]')].map(s => s.getAttribute('data-cit-module'));
  out.hasBooking = !!document.querySelector('.cit-book--request');
  out.hasRooms = !!document.querySelector('.cit-room__open[data-cit-room]');
  out.hasGallery = !!document.querySelector('[data-cit-module="gallery"] img');
  out.hasReviewForm = !!document.querySelector('form.cit-rev-f');
  out.map = (() => { const f = document.querySelector('.cit-map__frame, [data-cit-module="map"] iframe'); return f ? { r: rect(f), overflow: f.getBoundingClientRect().right > W + 1 } : null; })();
  out.footer = (() => { const f = document.querySelector('footer'); return f ? { links: [...f.querySelectorAll('a')].filter(vis).length, text: (f.textContent||'').replace(/\\s+/g,' ').slice(0,160) } : null; })();
  out.lang = document.documentElement.lang || '';
  return out;
})()`;

// ⑥ booking widget walk. Scroll to the widget ourselves, then judge rects at THAT scroll.
const PROBE_BOOKING = `(async () => { ${LIB}
  const form = document.querySelector('form.cit-book--request'); if (!form) return null;
  const out = {};
  const q = (s) => form.querySelector(s);
  const shift = (iso, d) => { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0,10); };
  const today = new Date(); const tISO = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0,10);
  const setDate = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  // scroll so the calendar head is at the top of the screen
  // a sticky top bar eats the first N px of every screen — scroll so the calendar sits UNDER it
  // measured AFTER scrolling there: the scrolled-in app bars (opacity 0 at the top) and the
  // late-sticking navs only exist at that scroll position
  const cal = q('.cit-book__cal'); const calTop = cal.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, Math.max(0, calTop - 8)); await new Promise(r => setTimeout(r, 600)); // the scrolled-in bars fade for .3s; under load longer
  const stickyH = (() => { let m = 0; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if ((cs.position === 'sticky' || cs.position === 'fixed') && vis(el)) { const r = el.getBoundingClientRect(); if (r.top <= 20 && r.width >= W * 0.6 && r.height < H * 0.4) m = Math.max(m, r.bottom); } } return m; })();
  out.stickyTop = Math.round(stickyH);
  window.scrollTo(0, Math.max(0, calTop - stickyH - 8)); await new Promise(r => setTimeout(r, 80));
  out.widgetTop = Math.round(calTop);
  out.widgetHeight = Math.round(form.getBoundingClientRect().height);
  // calendar controls
  const next = q('.cit-book__calnav--next'); const prev = q('.cit-book__calnav');
  out.calNav = { next: next ? { r: rect(next), disabled: next.disabled, inView: fullyInView(next), covered: covered(next) } : null, prev: prev ? { r: rect(prev), disabled: prev.disabled } : null };
  const label0 = q('.cit-book__mlabel')?.textContent || '';
  if (next && !next.disabled) { next.click(); await new Promise(r => setTimeout(r, 60)); }
  const label1 = q('.cit-book__mlabel')?.textContent || '';
  out.calPaged = label0 !== label1;
  out.monthsVisible = [...form.querySelectorAll('.cit-book__month')].filter(vis).length;
  const days = [...form.querySelectorAll('.cit-book__day')].filter(vis);
  const dr = days.map(rect); const dayW = dr.length ? Math.min(...dr.map(r=>r.w)) : 0, dayH = dr.length ? Math.min(...dr.map(r=>r.h)) : 0;
  out.day = { count: days.length, minW: dayW, minH: dayH, fs: days[0] ? parseFloat(getComputedStyle(days[0]).fontSize) : 0 };
  // two taps pick a range (free days on the shown month)
  const free = days.filter(b => !b.disabled);
  let picked = null;
  // ⚠️ renderCal() REBUILDS the grid after every tap — the second tap must be re-queried,
  // a stale handle is a detached button (a real thumb never has this problem).
  if (free.length > 3) { free[1].click(); await new Promise(r => setTimeout(r, 40)); const free2 = [...form.querySelectorAll('.cit-book__day')].filter(b => vis(b) && !b.disabled); free2[3].click(); await new Promise(r => setTimeout(r, 80)); picked = { from: q('#cit-from').value, to: q('#cit-to').value, nights: (q('[data-nights]')?.textContent||'').trim() }; }
  out.picked = picked;
  // where is the price/answer relative to the date strip, at the current scroll? (no scroll change)
  const dates = q('.cit-book__dates'); const quote = q('[data-quote]'); const note = q('.cit-book__note'); const submit = q('.cit-book__submit');
  out.quote = { html: (quote?.textContent||'').trim().slice(0,80), r: quote ? rect(quote) : null };
  out.datesR = dates ? rect(dates) : null;
  out.submitR = submit ? rect(submit) : null;
  out.noteR = note ? rect(note) : null;
  out.datesToNote = dates && note ? Math.round(note.getBoundingClientRect().top - dates.getBoundingClientRect().bottom) : null;
  // reversed range via the inputs → error sentence: where is it, relative to the date strip?
  setDate(q('#cit-from'), shift(tISO, 40)); setDate(q('#cit-to'), shift(tISO, 38)); await new Promise(r => setTimeout(r, 80));
  const err = form.querySelector('.cit-book__note--err');
  // scroll so the date strip is at the top: is the error on the same screen?
  const dsTop = dates.getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, dsTop - stickyH - 8)); await new Promise(r => setTimeout(r, 60));
  out.reversed = { errShown: !!err, text: (err?.textContent||'').trim().slice(0,80), errR: err ? rect(err) : null, errInScreenWithDates: err ? fullyInView(err) : null, submitDisabled: submit?.disabled, distance: err ? Math.round(err.getBoundingClientRect().top - dates.getBoundingClientRect().bottom) : null };
  // past date
  setDate(q('#cit-from'), shift(tISO, -3)); setDate(q('#cit-to'), shift(tISO, 2)); await new Promise(r => setTimeout(r, 80));
  const err2 = form.querySelector('.cit-book__note--err');
  out.past = { errShown: !!err2, text: (err2?.textContent||'').trim().slice(0,80), submitDisabled: submit?.disabled };
  // valid range typed → quote/ask + submit enabled; then the sample submit
  setDate(q('#cit-from'), shift(tISO, 40)); setDate(q('#cit-to'), shift(tISO, 42)); await new Promise(r => setTimeout(r, 80));
  const stepBtns = [...form.querySelectorAll('.cit-book__step')].map(b => ({ r: rect(b), fs: parseFloat(getComputedStyle(b).fontSize) }));
  out.stepper = stepBtns;
  out.inputs = [...form.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(vis).map(el => ({ sel: name(el), h: rect(el).h, fs: Math.round(parseFloat(getComputedStyle(el).fontSize)*10)/10 }));
  out.quoteToSubmit = quote && submit ? Math.round(submit.getBoundingClientRect().top - quote.getBoundingClientRect().bottom) : null;
  out.quoteR = quote ? rect(quote) : null;
  out.valid = { quote: (quote?.textContent||'').trim().slice(0,60), submitDisabled: submit?.disabled, submitText: (submit?.textContent||'').trim(), submitR: rect(submit), submitCovered: (() => { submit.scrollIntoView({block:'center'}); return covered(submit); })() };
  // submit (demo: nothing leaves the page)
  const isDemo = form.closest('[data-cit-module]')?.hasAttribute('data-cit-demo');
  out.demo = !!isDemo;
  if (isDemo) {
    form.requestSubmit ? form.requestSubmit() : submit.click();
    await new Promise(r => setTimeout(r, 400));
    const done = document.querySelector('.cit-book--done');
    // the receipt's HEADLINE must be readable where the scroll left it: on screen AND not under a sticky bar
    const head = done ? (done.querySelector('.cit-book__title') || done) : null;
    out.receipt = done ? { shown: true, text: (done.textContent||'').trim().slice(0,100), r: rect(done), inView: inView(done), topInView: done.getBoundingClientRect().top >= -1 && done.getBoundingClientRect().top < H, headCovered: covered(head), headR: rect(head) } : { shown: false };
  }
  return out;
})()`;

const PROBE_ROOMS = `(async () => { ${LIB}
  const opener = document.querySelector('.cit-room__open[data-cit-room]'); if (!opener) return null;
  const out = {};
  opener.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 60));
  out.openerR = rect(opener); out.openerCovered = covered(opener);
  const btns = [...document.querySelectorAll('[data-cit-room]')].filter(vis).map(b => ({ sel: name(b), text: txt(b), r: rect(b) }));
  out.openers = btns.slice(0, 6);
  opener.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await new Promise(r => setTimeout(r, 250));
  const rd = document.querySelector('.cit-rd[data-open]');
  if (!rd) { out.opened = false; return out; }
  out.opened = true;
  const panel = rd.querySelector('.cit-rd__panel'); const body = rd.querySelector('.cit-rd__body'); const x = rd.querySelector('.cit-rd__x'); const cta = rd.querySelector('[data-rd-cta]');
  const pr = panel.getBoundingClientRect();
  out.panel = { r: rect(panel), fits: pr.top >= -1 && pr.bottom <= H + 1 && pr.left >= -1 && pr.right <= W + 1, overflowY: getComputedStyle(panel).overflowY, bodyOverflowY: body ? getComputedStyle(body).overflowY : null, scrollable: (panel.scrollHeight > panel.clientHeight + 2) || (body && body.scrollHeight > body.clientHeight + 2), contentH: Math.max(panel.scrollHeight, body ? body.scrollHeight : 0) };
  out.close = x ? { r: rect(x), inView: fullyInView(x), covered: covered(x) } : null;
  out.cta = cta ? { r: rect(cta), inView: fullyInView(cta), text: txt(cta) } : null;
  out.bodyLocked = getComputedStyle(document.body).overflow === 'hidden' || document.documentElement.classList.contains('cit-lock') || getComputedStyle(document.documentElement).overflow === 'hidden';
  out.title = (rd.querySelector('h3')?.textContent||'').trim();
  out.imgR = (() => { const im = rd.querySelector('.cit-rd__img'); return im ? rect(im) : null; })();
  // close via the X
  x && x.click(); await new Promise(r => setTimeout(r, 200));
  out.closed = !document.querySelector('.cit-rd[data-open]');
  return out;
})()`;

const PROBE_GALLERY = `(async () => { ${LIB}
  const img = [...document.querySelectorAll('[data-cit-module="gallery"] img')].find(vis); if (!img) return null;
  const out = {};
  img.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 60));
  out.thumbR = rect(img); out.thumbCovered = covered(img);
  const gal = img.closest('[data-cit-module="gallery"]');
  out.galleryOverflow = (() => { for (const el of gal.querySelectorAll('img, figure, div')) { const r = el.getBoundingClientRect(); if (r.right > W + 2 && vis(el)) { let p = el.parentElement, sc = false; while (p && p !== document.body) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { sc = true; break; } p = p.parentElement; } if (!sc) return { sel: name(el), right: Math.round(r.right) }; } } return null; })();
  // tap = dispatch on whatever is painted at the picture's centre (what a thumb hits)
  const tr0 = img.getBoundingClientRect(); const hit = document.elementFromPoint(tr0.x + tr0.width/2, tr0.y + tr0.height/2) || img;
  hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await new Promise(r => setTimeout(r, 250));
  const lb = document.querySelector('.cit-lb[data-open]');
  if (!lb) { out.opened = false; return out; }
  out.opened = true;
  const im = lb.querySelector('.cit-lb__img'); const next = lb.querySelector('.cit-lb__btn--next'); const close = lb.querySelector('.cit-lb__btn--close');
  const ir = im.getBoundingClientRect();
  out.img = { r: rect(im), fits: ir.left >= -1 && ir.right <= W + 1 && ir.top >= -1 && ir.bottom <= H + 1 };
  out.next = next ? { r: rect(next), vis: vis(next), inView: fullyInView(next), covered: covered(next) } : null;
  out.close = close ? { r: rect(close), inView: fullyInView(close), covered: covered(close) } : null;
  out.count = (lb.querySelector('.cit-lb__count')?.textContent||'').trim();
  if (next && vis(next)) { next.click(); await new Promise(r => setTimeout(r, 120)); out.countAfterNext = (lb.querySelector('.cit-lb__count')?.textContent||'').trim(); }
  close && close.click(); await new Promise(r => setTimeout(r, 150));
  out.closed = !document.querySelector('.cit-lb[data-open]');
  return out;
})()`;

const PROBE_REVIEW = `(async () => { ${LIB}
  const f = document.querySelector('form.cit-rev-f'); if (!f) return null;
  const out = {};
  f.scrollIntoView({ block: 'start' }); await new Promise(r => setTimeout(r, 60));
  out.formH = rect(f).h;
  out.controls = [...f.querySelectorAll('input:not([type=hidden]), select, textarea, button')].filter(vis).map(el => { const lab = (el.type === 'checkbox') ? el.closest('label') : null; const r = lab ? lab.getBoundingClientRect() : el.getBoundingClientRect(); return { sel: name(el), w: Math.round(r.width), h: Math.round(r.height), fs: el.type === 'checkbox' ? 16 : Math.round(parseFloat(getComputedStyle(el).fontSize)*10)/10, overflow: r.right > W + 1 }; });
  out.demo = f.hasAttribute('data-cit-demo');
  const set = (n, v) => { const el = f.querySelector('[name="' + n + '"]'); if (!el) return; if (el.tagName === 'SELECT') { el.selectedIndex = 1; } else if (el.type === 'checkbox') { el.checked = true; } else { el.value = v; } el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('name', 'Elek Vendég'); set('rating', ''); set('body', 'Csendes, tiszta, a házigazda segítőkész volt.'); set('email', 'elek@citoviso.com'); set('consent', '');
  if (out.demo) { f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit], button')?.click(); await new Promise(r => setTimeout(r, 300)); const gone = !document.querySelector('form.cit-rev-f'); const note = document.querySelector('[data-cit-module="review-form"] .cit-modsec__note'); out.submitted = { formGone: gone, note: (note?.textContent||'').trim().slice(0,100), noteInView: note ? inView(note) : null }; }
  return out;
})()`;

// ── run ────────────────────────────────────────────────────────────────────────────────
interface Finding { page: string; vp: string; sev: "HIBA" | "ERGONÓMIA" | "ZAVAROS" | "GYANÚ"; rule: string; detail: string }
const findings: Finding[] = [];
const raw: Record<string, unknown> = {};
function F(page: string, vp: string, sev: Finding["sev"], rule: string, detail: string): void {
  findings.push({ page, vp, sev, rule, detail });
}

/** Scroll through the page once and return to the top: lazy images below the fold load
 *  only when reached, and a photo without a reserved height reflows everything under it
 *  (measured: the receipt "landed" 5 369 px below where scrollIntoView had put it). A guest
 *  reaches the widget by scrolling, so she has them loaded — the probe must too. */
async function walk(page: Page): Promise<void> {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto"; document.body.style.scrollBehavior = "auto";
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

async function shot(page: Page, id: string, vp: string, moment: string): Promise<void> {
  if (!shotsDir) return;
  const dir = path.join(shotsDir, id);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${vp}-${moment}.png`), fullPage: false }).catch(() => {});
}

async function main(): Promise<void> {
  const list = await targets();
  const browser: Browser = await chromium.launch({ executablePath: config.chromiumPath });
  let n = 0;
  for (const t of list) {
    for (const vp of VIEWPORTS) {
      n++;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        userAgent: PORTAL_USER_AGENT,
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]!));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
      // Gate mode: never fetch remote images/fonts (speed, offline). File mode: let the real
      // photos load — their intrinsic size is part of the overflow question.
      if (t.kind !== "file") {
        await page.route("**/*", (route) => {
          const rt = route.request().resourceType();
          return rt === "image" || rt === "font" || rt === "media" ? route.abort() : route.continue();
        });
      }
      try {
        if (t.kind === "file") await page.goto(pathToFileURL(t.file!).href, { waitUntil: "load", timeout: 30_000 }).catch(() => {});
        else await page.setContent(t.html!, { waitUntil: "load", timeout: 20_000 });
        await page.waitForSelector("form.cit-book--request, .cit-book", { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(t.kind === "file" ? 900 : 200);
        // Intro overlays (arch-frames / wordmark-grow) play out first
        await page.evaluate(() => document.querySelectorAll(".cit-fintro,.cit-intro").forEach((e) => e.remove()));
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, t.id, vp.id, "1-fold");
        await walk(page);
        await page.evaluate(`window.__vpW = ${vp.width}`);
        const st = (await page.evaluate(PROBE_STATIC)) as Record<string, any>;
        const key = `${t.id}@${vp.id}`;
        raw[key] = { static: st };
        const P = t.id;
        // ① overflow
        if (st.overflowX) F(P, vp.id, "HIBA", "①túlfolyás", st.zoomedOut ? `a lap szélesebb a készüléknél, a böngésző kicsinyít (elrendezés ${st.scrollW}px a ${vp.width}px-es telefonon)` : `a lap ${st.scrollW}px széles (${vp.width}px nézetben) — kilóg: ${st.overflowCulprits.map((c: any) => `${c.sel} (jobb széle ${c.right}px)`).join(", ") || "?"}`);
        // ② CTA in fold
        if (st.ctaCount && !st.ctaInFold.length) F(P, vp.id, "ERGONÓMIA", "②CTA-hajtás", `van foglalás-CTA a lapon (${st.ctaCount}), de az első képernyőn egy sem látható`);
        for (const c of st.ctaInFold) {
          if (c.covered) F(P, vp.id, c.byOwnBar ? "ERGONÓMIA" : "HIBA", "②CTA-takarva", `az első képernyő CTA-ját (${c.text}) takarja: ${c.covered}${c.byOwnBar ? " (a lap saját foglalás-sávja — egy görgetéssel szabad)" : ""}`);
          if (c.r.h < 44) F(P, vp.id, "ERGONÓMIA", "②CTA-kicsi", `az első képernyő CTA-ja (${c.text}) ${c.r.w}×${c.r.h}px`);
        }
        if (st.jump && st.jump.coveredBy) F(P, vp.id, "ERGONÓMIA", "②CTA-ugrás-takart", `a CTA ugrása (${st.jump.href}) után a cél címe („${st.jump.titleText}”) ${st.jump.coveredBy === "képernyőn kívül" ? "a képernyőn kívül" : "a tapadó sáv alatt: " + st.jump.coveredBy} (y=${st.jump.titleY})`);
        if (!st.hasHamburger && st.nav.length) {
          const links = st.nav.reduce((a: number, nv: any) => a + nv.links, 0);
          if (links === 0) F(P, vp.id, "ERGONÓMIA", "②nav-üres", `a fejléc/nav látható, de 0 link (${st.nav.map((x: any) => x.sel).join(",")})`);
        }
        // ⑤ sticky bands
        for (const s of st.sticky) {
          if (s.pct >= 25) F(P, vp.id, "HIBA", "⑤tapadó-sáv", `${s.sel} position:${s.pos}, ${s.h}px = a képernyő ${s.pct}%-a`);
          else if (s.pct >= 15) F(P, vp.id, "ERGONÓMIA", "⑤tapadó-sáv", `${s.sel} position:${s.pos}, ${s.h}px = a képernyő ${s.pct}%-a`);
        }
        // ③ touch targets — grouped
        const groups: Record<string, { n: number; ex: any }> = {};
        for (const s of st.small) { (groups[s.group] ??= { n: 0, ex: s }).n++; }
        for (const [g, v] of Object.entries(groups)) {
          // the shared masthead's booking link is a PROMISED 44px (ADR-0235 ①): below that it is a
          // defect, not an ergonomics note — a rule that only warns is a dead rule (parent session, 2026-09-26: 43px)
          const tiny = ((v.ex.w < 24 || v.ex.h < 24) && !v.ex.inlineText) || g === "cit-mast-hot";
          F(P, vp.id, tiny ? "HIBA" : "ERGONÓMIA", "③érintési-cél", `${v.n}× .${g} < 44px (pl. „${v.ex.text}” ${v.ex.w}×${v.ex.h}px)`);
        }
        // ④ input font
        if (st.smallFont.length) F(P, vp.id, "ERGONÓMIA", "④input-betű", `${st.smallFont.length} mező < 16px (iOS nagyít): ${st.smallFont.slice(0, 3).map((x: any) => `${x.sel} ${x.fs}px`).join(", ")}`);
        // map
        if (st.map?.overflow) F(P, vp.id, "HIBA", "④térkép-túlfolyás", `a térkép-keret jobb széle ${st.map.r.x + st.map.r.w}px`);
        // ⑥ booking
        if (st.hasBooking) {
          const b = (await page.evaluate(PROBE_BOOKING)) as Record<string, any> | null;
          raw[key] = { ...(raw[key] as object), booking: b };
          if (b) {
            if (!b.calPaged && b.calNav.next && !b.calNav.next.disabled) F(P, vp.id, "HIBA", "⑥naptár-lapoz", `a „következő hónap” gomb nem lapoz (címke változatlan)`);
            if (b.calNav.next?.covered) F(P, vp.id, "HIBA", "⑥naptár-takarva", `a hónap-léptetőt takarja: ${b.calNav.next.covered}`);
            if (b.day.minW < 32 || b.day.minH < 32) F(P, vp.id, b.day.minW < 24 || b.day.minH < 24 ? "HIBA" : "ERGONÓMIA", "⑥nap-cella", `a naptár napjai ${b.day.minW}×${b.day.minH}px (betű ${b.day.fs}px)`);
            if (b.picked && !(b.picked.from && b.picked.to)) F(P, vp.id, "HIBA", "⑥két-érintés", `két nap érintése nem adott tartományt (from=${b.picked.from} to=${b.picked.to})`);
            if (b.reversed.errShown === false) F(P, vp.id, "HIBA", "⑥fordított-dátum", `fordított dátumra nincs hibaüzenet`);
            else if (b.reversed.errInScreenWithDates === false) F(P, vp.id, "ERGONÓMIA", "⑥hibaüzenet-távol", `a hibaüzenet („${b.reversed.text}”) ${b.reversed.distance}px-re a dátum-sávtól — nem egy képernyőn (${vp.height}px)`);
            if (b.past.errShown === false) F(P, vp.id, "HIBA", "⑥múltbeli-dátum", `múltbeli érkezésre nincs hibaüzenet`);
            if (b.quoteToSubmit != null && b.quoteToSubmit > vp.height - 100) F(P, vp.id, "ERGONÓMIA", "⑥ár→gomb-távol", `az ár-összegzés és a küldő gomb ${b.quoteToSubmit}px-re egymástól (képernyő ${vp.height}px)`);
            for (const s of b.stepper) if (s.r.w < 44 || s.r.h < 44) { F(P, vp.id, "ERGONÓMIA", "⑥létszám-gomb", `a vendégszám ± gombja ${s.r.w}×${s.r.h}px`); break; }
            const smallIn = b.inputs.filter((i: any) => i.fs < 16);
            if (smallIn.length) F(P, vp.id, "ERGONÓMIA", "⑥widget-input-betű", `${smallIn.length} widget-mező < 16px: ${smallIn.slice(0, 3).map((i: any) => `${i.sel} ${i.fs}px`).join(", ")}`);
            if (b.valid.submitDisabled) F(P, vp.id, "HIBA", "⑥gomb-tiltva", `érvényes tartományra is tiltott a küldő gomb`);
            if (b.valid.submitCovered) F(P, vp.id, "HIBA", "⑥gomb-takarva", `a küldő gombot takarja: ${b.valid.submitCovered}`);
            if (b.valid.submitR.h < 44) F(P, vp.id, "ERGONÓMIA", "⑥gomb-kicsi", `a küldő gomb ${b.valid.submitR.w}×${b.valid.submitR.h}px`);
            if (b.demo && b.receipt && !b.receipt.shown) F(P, vp.id, "HIBA", "⑥nyugta", `minta-beküldés után nincs nyugta`);
            if (b.demo && b.receipt?.shown && !b.receipt.topInView) F(P, vp.id, "HIBA", "⑥nyugta-képen-kívül", `a nyugta teteje a képernyőn kívül (y=${b.receipt.r.y})`);
            else if (b.demo && b.receipt?.shown && b.receipt.headCovered) F(P, vp.id, "ERGONÓMIA", "⑥nyugta-takarva", `a nyugta címét a tapadó sáv takarja: ${b.receipt.headCovered} (y=${b.receipt.headR.y})`);
            await shot(page, t.id, vp.id, "6-nyugta");
          }
        } else if (t.kind === "file") F(P, vp.id, "GYANÚ", "⑥nincs-widget", `nincs foglalás-widget a lapon (modulok: ${st.modules.join(",")})`);
        // ⑦ rooms — a FRESH page state (the booking probe left a receipt behind).
        // ⛔ NOT page.reload(): a setContent() page reloads to about:blank, so in gate mode the
        // rooms/gallery/review probes silently never ran (caught by --selftest, 2026-09-26).
        if (st.hasRooms) {
          if (t.kind === "file") await page.goto(pathToFileURL(t.file!).href, { waitUntil: "load", timeout: 30_000 }).catch(() => {});
          else await page.setContent(t.html!, { waitUntil: "load", timeout: 20_000 });
          await page.waitForTimeout(t.kind === "file" ? 700 : 200);
          await page.evaluate(() => document.querySelectorAll(".cit-fintro,.cit-intro").forEach((e) => e.remove()));
          await walk(page);
          const r = (await page.evaluate(PROBE_ROOMS)) as Record<string, any> | null;
          raw[key] = { ...(raw[key] as object), rooms: r };
          if (r) {
            if (!r.opened) F(P, vp.id, "HIBA", "⑦szoba-felugró", `a szoba-kártya érintése nem nyit felugrót (${r.openerCovered ? "takarja: " + r.openerCovered : "nincs data-open"})`);
            else {
              await page.evaluate(`(async()=>{const o=document.querySelector('.cit-room__open[data-cit-room]');o&&o.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await new Promise(r=>setTimeout(r,200));})()`);
              await shot(page, t.id, vp.id, "7-szoba");
              await page.evaluate(() => (document.querySelector(".cit-rd__x") as HTMLElement | null)?.click());
              if (!r.panel.fits) F(P, vp.id, "HIBA", "⑦felugró-levágva", `a szoba-felugró panelje nem fér a képernyőre (${r.panel.r.w}×${r.panel.r.h}, y=${r.panel.r.y}…${r.panel.r.b})`);
              if (!r.panel.scrollable && r.panel.contentH > r.panel.r.h + 4) F(P, vp.id, "HIBA", "⑦felugró-nem-görgethető", `a felugró tartalma ${r.panel.contentH}px, a panel ${r.panel.r.h}px, és nem görgethető`);
              if (r.close && (!r.close.inView || r.close.covered)) F(P, vp.id, "HIBA", "⑦bezárás-elérhetetlen", `a felugró X gombja ${r.close.inView ? "takarva: " + r.close.covered : "képernyőn kívül"}`);
              if (r.close && (r.close.r.w < 44 || r.close.r.h < 44)) F(P, vp.id, "ERGONÓMIA", "⑦bezárás-kicsi", `a felugró X gombja ${r.close.r.w}×${r.close.r.h}px`);
              if (r.cta && !r.cta.inView && !r.panel.scrollable) F(P, vp.id, "ERGONÓMIA", "⑦felugró-CTA", `a felugró „${r.cta.text}” gombja nem látszik és a panel nem görgethető`);
              if (!r.closed) F(P, vp.id, "HIBA", "⑦bezárás", `az X nem zárja a felugrót`);
            }
          }
        }
        // ⑧ gallery
        if (st.hasGallery) {
          const g = (await page.evaluate(PROBE_GALLERY)) as Record<string, any> | null;
          raw[key] = { ...(raw[key] as object), gallery: g };
          if (g) {
            if (g.galleryOverflow) F(P, vp.id, "HIBA", "⑧galéria-túlfolyás", `galéria-elem kilóg: ${g.galleryOverflow.sel} (jobb széle ${g.galleryOverflow.right}px)`);
            if (!g.opened) F(P, vp.id, "HIBA", "⑧nagyítás", `a galéria-kép érintése nem nyit nagyítót${g.thumbCovered ? " (takarja: " + g.thumbCovered + ")" : ""}`);
            else {
              await page.evaluate(`(async()=>{const i=[...document.querySelectorAll('[data-cit-module="gallery"] img')].find(e=>e.getBoundingClientRect().width>0);if(i){const r=i.getBoundingClientRect();(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)||i).dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));}await new Promise(r=>setTimeout(r,200));})()`);
              await shot(page, t.id, vp.id, "8-galeria");
              await page.evaluate(() => (document.querySelector(".cit-lb__btn--close") as HTMLElement | null)?.click());
              if (!g.img.fits) F(P, vp.id, "HIBA", "⑧nagyított-kép-kilóg", `a nagyított kép ${g.img.r.w}×${g.img.r.h} @${g.img.r.x},${g.img.r.y} nem fér a képernyőre`);
              if (g.next?.vis && (g.next.r.w < 44 || g.next.r.h < 44)) F(P, vp.id, "ERGONÓMIA", "⑧lapozó-kicsi", `a nagyító lapozója ${g.next.r.w}×${g.next.r.h}px`);
              if (g.next?.vis && g.countAfterNext === g.count) F(P, vp.id, "HIBA", "⑧lapozás", `a nagyító „következő” gombja nem lép (${g.count})`);
              if (g.close && (!g.close.inView || g.close.covered)) F(P, vp.id, "HIBA", "⑧bezárás-elérhetetlen", `a nagyító X gombja ${g.close.inView ? "takarva" : "képernyőn kívül"}`);
              if (!g.closed) F(P, vp.id, "HIBA", "⑧bezárás", `az X nem zárja a nagyítót`);
            }
          }
        }
        // ⑨ review form
        if (st.hasReviewForm) {
          const rv = (await page.evaluate(PROBE_REVIEW)) as Record<string, any> | null;
          raw[key] = { ...(raw[key] as object), review: rv };
          if (rv) {
            await shot(page, t.id, vp.id, "9-velemeny");
            const smallC = rv.controls.filter((c: any) => c.h < 44);
            if (smallC.length) F(P, vp.id, "ERGONÓMIA", "⑨vélemény-vezérlő", `${smallC.length} vezérlő < 44px magas: ${smallC.slice(0, 3).map((c: any) => `${c.sel} ${c.w}×${c.h}`).join(", ")}`);
            const sf = rv.controls.filter((c: any) => c.fs < 16 && /input|select|textarea/.test(c.sel));
            if (sf.length) F(P, vp.id, "ERGONÓMIA", "⑨vélemény-betű", `${sf.length} mező < 16px`);
            if (rv.controls.some((c: any) => c.overflow)) F(P, vp.id, "HIBA", "⑨vélemény-túlfolyás", `vezérlő kilóg: ${rv.controls.filter((c: any) => c.overflow).map((c: any) => c.sel).join(",")}`);
            if (rv.demo && rv.submitted && !rv.submitted.formGone) F(P, vp.id, "HIBA", "⑨vélemény-küldés", `a minta-vélemény beküldése után az űrlap marad, nincs válasz`);
          }
        }
        // ⑩ JS errors
        const jsErr = errors.filter((e) => !/net::ERR|Failed to load resource|ERR_NAME_NOT_RESOLVED|favicon/i.test(e));
        if (jsErr.length) F(P, vp.id, "HIBA", "⑩js-hiba", jsErr.slice(0, 2).join(" · "));
        (raw[key] as any).errors = errors;
        console.log(`  ${String(n).padStart(3)}/${list.length * VIEWPORTS.length} ${t.kind.padEnd(9)} ${t.id.padEnd(46)} @${vp.id.padEnd(4)} — ${findings.filter((f) => f.page === P && f.vp === vp.id).length} lelet`);
      } finally {
        await ctx.close();
      }
    }
  }
  await browser.close();

  // ── report ───────────────────────────────────────────────────────────────────────────
  const by = (sev: Finding["sev"]) => findings.filter((f) => f.sev === sev);
  console.log(`\n${findings.length} lelet — HIBA ${by("HIBA").length} · ERGONÓMIA ${by("ERGONÓMIA").length} · ZAVAROS ${by("ZAVAROS").length} · GYANÚ ${by("GYANÚ").length}`);
  // rule × page matrix: what is COMMON (every page) vs template-specific
  const pages = [...new Set(findings.map((f) => f.page))];
  const totalPages = list.length;
  const rules = [...new Set(findings.map((f) => f.rule))];
  console.log(`\nSzabály × lapok (${totalPages} lap × ${VIEWPORTS.length} nézet):`);
  for (const r of rules.sort()) {
    const fr = findings.filter((f) => f.rule === r);
    const ps = new Set(fr.map((f) => f.page));
    const vps = [...new Set(fr.map((f) => f.vp))].join("/");
    const common = ps.size === totalPages ? "KÖZÖS (minden lap)" : `${ps.size}/${totalPages} lap: ${[...ps].slice(0, 6).join(", ")}${ps.size > 6 ? "…" : ""}`;
    console.log(`  ${fr[0]!.sev.padEnd(9)} ${r.padEnd(24)} ${String(fr.length).padStart(3)}× @${vps.padEnd(12)} ${common}`);
    console.log(`      pl. ${fr[0]!.page}@${fr[0]!.vp}: ${fr[0]!.detail}`);
  }
  void pages;
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ findings, raw }, null, 1));
  if (selftest) {
    // ① the clean page carries no HIBA; ② every planted regression fires the rule that claims it
    let bad = 0;
    const cleanHard = findings.filter((f) => f.page === "selftest-clean" && f.sev === "HIBA");
    if (cleanHard.length) { bad++; console.error(`❌ önteszt: a tiszta lap HIBÁ-t kapott: ${cleanHard.map((f) => f.rule).join(", ")}`); }
    for (const r of SELFTEST_REGRESSIONS) {
      const got = new Set(findings.filter((f) => f.page === r.id).map((f) => f.rule));
      for (const e of r.expect) if (!got.has(e)) { bad++; console.error(`❌ önteszt: ${r.id} → a(z) ${e} szabály NEM szólalt meg (kapott: ${[...got].join(", ") || "semmi"})`); }
    }
    // the dead "next month" button: the paging probe must say so
    const dead = findings.some((f) => f.page === "selftest-calendar-dead" && f.rule === "⑥naptár-lapoz");
    if (!dead) { bad++; console.error(`❌ önteszt: selftest-calendar-dead → a ⑥naptár-lapoz szabály nem szólalt meg`); }
    if (bad) { console.error(`\n❌ guest-mobile-check önteszt: ${bad} hiányzó piros`); process.exit(1); }
    console.log(`\n✅ guest-mobile-check önteszt: tiszta lap 0 HIBA, ${SELFTEST_REGRESSIONS.length} ültetett hiba mind piros`);
    return;
  }
  const hard = by("HIBA").length;
  const soft = by("ERGONÓMIA").length;
  if (hard || (strict && soft)) {
    console.error(`\n❌ guest-mobile-check: ${hard} HIBA${strict ? ` + ${soft} ERGONÓMIA` : ""}`);
    process.exit(1);
  }
  console.log(`\n✅ guest-mobile-check: 0 HIBA (${soft} ergonómiai lelet, --strict nélkül nem bukó)`);
}

main().catch((e) => { console.error(`❌ ${(e as Error).stack ?? e}`); process.exit(1); });
