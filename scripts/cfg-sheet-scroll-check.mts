// A RENDELÉS-PANEL GÖRGETÉSE TELEFONON — a húzás a PANELT viszi, nem a mögötte lévő lapot
// (tulajdonosi bejelentés, 2026-09-26: „nem is lehet vásárolni, mert nem a vásárlási
// szekció gördül, hanem a honlap maga").
//
//   npx tsx scripts/cfg-sheet-scroll-check.mts             (ŐR: 3 sablon × 4 tartás: 390, 360, fekvő 844 és 932)
//   npx tsx scripts/cfg-sheet-scroll-check.mts --selftest  (+ PIROS önteszt: a javítás kivéve)
//
// MIT MÉR, ÉS MIÉRT ÍGY
//
//  · VALÓDI ÉRINTÉS-GESZTUS (CDP Input.dispatchTouchEvent: touchStart → touchMove×N → touchEnd),
//    mobil-emulált kontextusban (isMobile + hasTouch). NEM mouse.wheel: a kerék-esemény
//    más úton lánc-görget, és a hiba pont az ujj húzásán jött elő.
//  · A GESZTUS HELYÉT a panel SAJÁT geometriájából vesszük (fej / lista / lábléc sávja),
//    nem egy kitűzött szelektor-magasságból: a panel lépés-szerkezetét egy párhuzamos szál
//    írja át, és az őrnek mindkét elrendezésen értelmesnek kell maradnia.
//  · A LAP görgetését window.scrollY-ból mérjük, a panelét a panelen belüli görgetők
//    scrollTop-jainak összegéből — így mindegy, melyik része görget (lista vagy egész lap).
//  · A LISTA VÉGÉN is húzunk: a lánc-görgetés (overscroll) ott indul el, ahol a belső
//    görgető kifogy — az üres-lista-közép húzás egymagában ezt nem mutatja meg.
//  · Az ÉLŐ ELŐNÉZET nem veszhet el: modul-kapcsolásra a lap továbbra is odagörget
//    („látja a változást”, a revealChange) — ezt is mérjük, a rögzítés ALATT.
//
// Szabályok (tartásonként):
//   S1  a panel fején, listáján, láblécén húzva (föl ÉS le, a lista elején ÉS végén) a lap
//       NEM mozdul (|ΔscrollY| ≤ 2 px)
//   S2  a panel teljes tartalma elérhető: ha a panelben van görgethető rész, a listán
//       fölfelé húzva a végéig eljut (a panel-görgetők mind a végükön)
//   S3  a mögöttes lap élő előnézete él: egy kikapcsolt modul bekapcsolására a lap
//       odagörget (ΔscrollY ≠ 0) — nyitott panellel
//   S4  a panel bezárása után a lap újra görgethető (semmi nem ragad be)
//   S6  NEM lap-zár: a panel mellett/fölött látszó lap-sáv húzásra továbbra is görget
//   S7  a 2. lépésen és a fizetés-lépésen (teljes felület) is: a panel fölső/közép/alsó sávján húzva a lap áll
//   S8  …és az őr nem nyeli el a fizetés-űrlap SAJÁT görgetését: húzással a végéig ér
//   S9  …és ott a „Fizetek” gomb a képernyőn van, és az ujj ŐT találja (fekvőn is — tulaj, 2026-09-26)
//   S0  (a mérés hitele) csukott panellel ugyanaz a gesztus GÖRGETI a lapot
//
// Kimenet (gitignore-olt): assets/design-refs/_drafts/cfg-sheet-scroll/<sablon>-<tartás>.png

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.ELEK_RUN = "1"; // mechanical mail/SMS/MMS guard (nothing may leave)
process.env.EMAIL_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";

import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";

import { config } from "../src/config.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets", "design-refs", "_drafts", "cfg-sheet-scroll");
const args = process.argv.slice(2);
const SELFTEST = args.includes("--selftest");
const ORIGIN = "http://cfg-scroll.local";
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
interface Vp { id: string; width: number; height: number; ua: string }
const VIEWPORTS: Vp[] = [
  { id: "390", width: 390, height: 844, ua: IPHONE_UA },
  { id: "360", width: 360, height: 780, ua: ANDROID_UA },
  { id: "land", width: 844, height: 390, ua: IPHONE_UA },
  // a big phone sideways: ≥ 900 px wide, so the checkout's two-column grid branch is live too
  { id: "land932", width: 932, height: 430, ua: IPHONE_UA },
];
// fullbleed: fixed booking bar; brutalism: the page that widened the layout viewport;
// dark-luxury: the owner's screenshot skin family
const TEMPLATES = (process.env.CFG_ONLY ?? "fullbleed,brutalism,dark-luxury").split(",");

type Sabotage = "none" | "no-fix" | "no-landcol";

function chromiumExe(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    config.chromiumPath,
    path.join(process.env.HOME ?? "", ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome"),
  ].filter((p): p is string => !!p);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("nincs használható Chromium (CHROMIUM_PATH?)");
}

async function fixture(tpl: string, sabotage: Sabotage): Promise<string> {
  const { renderSite } = await import("../src/engine/render.js");
  const { TEMPLATES: T } = await import("../src/engine/templates.js");
  const { injectRuntime } = await import("../src/generator/runtime.js");
  const { injectConfigurator } = await import("../src/generator/configurator.js");
  const pn = await import("../src/console/prospectNotice.js");
  const data = {
    name: "ELEK-PRÓBA Vendégház",
    tagline: "Szigliget, Balaton",
    intro: "Szigligeten, a várdomb és a strand között, tágas kerttel és nyolc fő számára kényelmes házzal.",
    highlights: ["Teraszos kert, grillsarok", "Strand néhány perc sétára", "Saját parkoló"],
    geo: { lat: 46.8, lon: 17.43 },
    photos: [1, 2, 3, 4, 5, 6].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
    rooms: [
      { name: "Kétágyas szoba", capacity: "2 fő", note: "Kertre néző.", price: "24 000 Ft / éj", photo: { url: PIX, alt: "szoba" } },
      { name: "Családi szoba", capacity: "4 fő", note: "Két helyiség.", price: "36 000 Ft / éj", photo: { url: PIX, alt: "szoba" } },
    ],
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Kossuth utca 36, Szigliget, 8264" },
  };
  const recipe = { skin: T[tpl]!.skins[0]!, archetype: "stacked", template: tpl, sections: [] };
  let html = await injectRuntime(renderSite(recipe as never, data as never));
  html = await injectConfigurator(html, "00000000-0000-0000-0000-000000000000", data.name, {});
  html = pn.containHorizontalOverflow(html);
  if (sabotage === "no-landcol") {
    // the sideways one-column paying step, taken out: its media query can never match
    const before = html;
    html = html.replace("@media (max-height: 520px) {\n  .cit-cfg-panel--billing {", "@media (max-height: 1px) {\n  .cit-cfg-panel--billing {");
    if (html === before) throw new Error("a no-landcol szabotázs nem találta a fekvő fizetés-blokkot");
  }
  if (sabotage === "no-fix") {
    // the fix, taken out: the panel's touchmove guard never fires, no overscroll containment
    const before = html;
    html = html.replace(/panel\.addEventListener\(\s*"touchmove"/, 'panel.addEventListener("x-sabotaged-touchmove"').replace(/overscroll-behavior:\s*contain/g, "overscroll-behavior: auto");
    if (html === before || /panel\.addEventListener\(\s*"touchmove"/.test(html)) throw new Error("a szabotázs nem talált javítást — az önteszt semmit nem venne ki");
  }
  return html;
}

/** Page-scroll and the sum of the panel's own scrollers, read in one go. */
const STATE = `(() => {
  const p = document.querySelector(".cit-cfg-panel");
  const sc = [p, ...p.querySelectorAll("*")].filter((n) => {
    const s = getComputedStyle(n);
    return /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.getClientRects().length;
  });
  return {
    y: Math.round(window.scrollY),
    panelScroll: sc.reduce((a, n) => a + n.scrollTop, 0),
    scrollers: sc.map((n) => ({ cls: String(n.className).slice(0, 40), top: Math.round(n.scrollTop), max: n.scrollHeight - n.clientHeight })),
    atEnd: sc.every((n) => n.scrollHeight - n.clientHeight - n.scrollTop <= 2),
  };
})()`;
interface State { y: number; panelScroll: number; scrollers: { cls: string; top: number; max: number }[]; atEnd: boolean }

/** Gesture points from the panel's own geometry: head band, list band, footer band. */
const ZONES = `(() => {
  const p = document.querySelector(".cit-cfg-panel");
  const pr = p.getBoundingClientRect();
  const vis = (sel) => { const n = p.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect();
    const top = Math.max(r.top, pr.top, 0), bot = Math.min(r.bottom, pr.bottom, innerHeight);
    return bot - top >= 16 ? { x: Math.round(pr.left + pr.width / 2), y: Math.round((top + bot) / 2), h: Math.round(bot - top) } : null; };
  return { panel: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), left: Math.round(pr.left), width: Math.round(pr.width) },
    head: vis(".cit-cfg-head"), body: vis(".cit-cfg-body"), foot: vis(".cit-cfg-foot") };
})()`;
interface Pt { x: number; y: number; h: number }
interface Zones { panel: { top: number; bottom: number; left: number; width: number }; head: Pt | null; body: Pt | null; foot: Pt | null }

async function swipe(page: Page, x: number, y: number, dy: number): Promise<void> {
  // Raw touchStart → touchMove×N → touchEnd, the path a finger takes. (Measured:
  // Input.synthesizeScrollGesture scrolls NOTHING in this headless Chromium — not even a
  // plain 4000 px page — so a guard built on it would be green on everything.)
  const cdp = await page.context().newCDPSession(page);
  const steps = 12;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(y + (dy * i) / steps) }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(450); // fling/momentum settles
}

async function run(browser: Browser, tpl: string, vp: Vp, sabotage: Sabotage): Promise<Record<string, [boolean, unknown]>> {
  const html = await fixture(tpl, sabotage);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: vp.ua, locale: "hu-HU",
  });
  const publicDir = path.join(ROOT, "public");
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/${tpl}`) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (u.pathname.startsWith("/assets/")) {
      const f = path.join(publicDir, u.pathname.replace(/^\/+/, ""));
      try {
        const body = await readFile(f);
        return route.fulfill({ status: 200, contentType: f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "application/octet-stream", body });
      } catch {
        return route.fulfill({ status: 404, body: "" });
      }
    }
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  const page = await ctx.newPage();
  const jsErrors: string[] = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  await page.goto(`${ORIGIN}/${tpl}`, { waitUntil: "load" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  const res: Record<string, [boolean, unknown]> = {};
  try {
    // the lead has read a bit of the page before opening the order panel
    await page.evaluate(`window.scrollTo(0, Math.min(600, document.documentElement.scrollHeight - innerHeight - 200))`);
    await page.waitForTimeout(200);
    // S0 — the gesture itself works: with the panel closed, the same swipe scrolls the page.
    // (A gesture that moves nothing would make S1 green on every page.)
    const g0 = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    await swipe(page, Math.round(vp.width / 2), Math.round(vp.height * 0.6), -200);
    const g1 = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    res.S0_gesture_moves_the_page = [Math.abs(g1 - g0) > 20, { before: g0, after: g1 }];
    await page.evaluate(`document.querySelector(".cit-cfg-launch").click()`);
    await page.waitForTimeout(700);
    const open = (await page.evaluate(`document.querySelector(".cit-cfg-panel").classList.contains("cit-cfg-open")`)) as boolean;
    if (!open) return { S0_panel_opens: [false, "a panel nem nyílt ki"] };
    const z = (await page.evaluate(ZONES)) as Zones;
    await page.screenshot({ path: path.join(OUT, `${tpl}-${vp.id}${sabotage === "none" ? "" : `-${sabotage}`}.png`) });

    // S1 — page must not move under any drag on the panel
    const moves: { where: string; dy: number; pageDelta: number; panelDelta: number }[] = [];
    const zones = (["head", "body", "foot"] as const).filter((k) => z[k]);
    for (const where of zones) {
      const pt = z[where]!;
      for (const dy of [-260, 260, -260]) {
        const a = (await page.evaluate(STATE)) as State;
        await swipe(page, pt.x, pt.y, dy);
        const b = (await page.evaluate(STATE)) as State;
        moves.push({ where, dy, pageDelta: b.y - a.y, panelDelta: b.panelScroll - a.panelScroll });
      }
    }
    // …and at the END of the panel's scroller, where overscroll chaining starts
    if (z.body) {
      for (let i = 0; i < 12; i++) {
        const s = (await page.evaluate(STATE)) as State;
        if (s.atEnd) break;
        await swipe(page, z.body.x, z.body.y, -300);
      }
      for (const dy of [-300, -300]) {
        const a = (await page.evaluate(STATE)) as State;
        await swipe(page, z.body.x, z.body.y, dy);
        const b = (await page.evaluate(STATE)) as State;
        moves.push({ where: "body@end", dy, pageDelta: b.y - a.y, panelDelta: b.panelScroll - a.panelScroll });
      }
    }
    const pageMoved = moves.filter((m) => Math.abs(m.pageDelta) > 2);
    res.S1_drag_on_panel_keeps_page_still = [pageMoved.length === 0, pageMoved];

    // S2 — the whole panel reachable by dragging it
    const s2 = (await page.evaluate(STATE)) as State;
    const scrollable = s2.scrollers.length > 0;
    res.S2_panel_content_reachable = [!scrollable || s2.atEnd, { scrollers: s2.scrollers, gestures: moves.filter((m) => m.where.startsWith("body")) }];

    // S6 — NOT a page lock: the page strip left beside/above the panel still scrolls under
    // the finger (the owner browses the live preview without closing the panel)
    {
      const pz = z.panel;
      const px = pz.left > 120 ? Math.round(pz.left / 2) : Math.round(vp.width / 2);
      const py = pz.left > 120 ? Math.round(vp.height / 2) : Math.round(pz.top / 2);
      await page.evaluate(`window.scrollTo(0, 400)`);
      await page.waitForTimeout(150);
      const a = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
      const hitPanel = (await page.evaluate(`!!document.elementFromPoint(${px}, ${py})?.closest(".cit-cfg-panel")`)) as boolean;
      await swipe(page, px, py, -120);
      const b = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
      res.S6_page_beside_panel_still_scrolls = [!hitPanel && Math.abs(b - a) > 20, { at: [px, py], hitPanel, before: a, after: b }];
    }

    // S3 — live preview: switch on a module that is off → the page scrolls to it (panel open)
    await page.evaluate(`window.scrollTo(0, 0)`);
    await page.waitForTimeout(150);
    const y0 = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    // the default preset is "everything on": switch a sample module off, then on again —
    // the switch-ON is what reveals the change on the page
    const toggled = (await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.cit-cfg-panel .cit-cfg-row[data-id]:not(.cit-cfg-locked)')];
      // a SAMPLE module first: its section is injected low on the page, so revealing it must scroll
      const pick = rows.find((r) => r.querySelector(".sample") && r.getAttribute("aria-pressed") === "true") || rows.find((r) => r.getAttribute("aria-pressed") === "true") || rows[0];
      if (!pick) return null;
      if (pick.getAttribute("aria-pressed") === "true") pick.click();
      window.scrollTo(0, 0);
      pick.click();
      return pick.getAttribute("data-id") + ":" + pick.getAttribute("aria-pressed");
    })()`)) as string | null;
    await page.waitForTimeout(1200);
    const y1 = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    res.S3_preview_scrolls_to_change = [toggled !== null && y1 !== y0, { toggled, y0, y1 }];

    // S7 — the order steps keep the rule: step 2 (the footer grows) and the paying step
    // (full surface); top / middle / bottom band of the panel, both directions — the page
    // behind must not move. The step gates (photo-rights box, domain) are not what is
    // measured here, so the submit is un-disabled after ticking the box.
    {
      await page.evaluate(`window.scrollTo(0, 400)`);
      const bands = async (): Promise<unknown[]> => {
        const pr = (await page.evaluate(`(() => { const r = document.querySelector(".cit-cfg-panel").getBoundingClientRect(); return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, innerHeight), x: r.left + r.width / 2 }; })()`)) as { top: number; bottom: number; x: number };
        const moved: unknown[] = [];
        for (const f of [0.08, 0.5, 0.92]) {
          for (const dy of [-220, 220]) {
            const a = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
            await swipe(page, Math.round(pr.x), Math.round(pr.top + (pr.bottom - pr.top) * f), dy);
            const b = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
            if (Math.abs(b - a) > 2) moved.push({ f, dy, before: a, after: b });
          }
        }
        return moved;
      };
      const step2 = (await page.evaluate(`(() => { const b = document.querySelector(".cit-cfg-panel .cit-cfg-next"); if (!b) return false; b.click();
        const s = document.querySelector(".cit-cfg-panel .cit-cfg-step2"); return !!s && !s.hidden; })()`)) as boolean;
      await page.waitForTimeout(400);
      const moved2 = step2 ? await bands() : ["2. lépés nem nyílt"];
      const billing = (await page.evaluate(`(() => { const rb = document.querySelector(".cit-cfg-panel .cit-cfg-rights"); if (rb && !rb.checked) rb.click();
        const sb = document.querySelector(".cit-cfg-panel .cit-cfg-submit"); if (!sb) return false; sb.disabled = false; sb.click();
        return document.querySelector(".cit-cfg-panel").classList.contains("cit-cfg-panel--billing"); })()`)) as boolean;
      await page.waitForTimeout(600);
      const moved3 = billing ? await bands() : ["fizetés-lépés nem nyílt"];
      res.S7_order_steps_keep_page_still = [moved2.length === 0 && moved3.length === 0, { step2: moved2, billing: moved3 }];
      // S8 — …and the guard does not swallow the paying form's OWN scrolling: dragging the
      // form's middle up reaches the end of every scroller in the panel (consents + pay)
      if (billing) {
        // the finger on the box that scrolls: the form's own scroller upright, the whole
        // panel on a short/sideways screen (one column)
        const mid = (await page.evaluate(`(() => {
          const f = document.querySelector(".cit-cfg-co-scroll");
          const own = f && /(auto|scroll)/.test(getComputedStyle(f).overflowY) && f.scrollHeight > f.clientHeight + 1;
          const r = (own ? f : document.querySelector(".cit-cfg-panel")).getBoundingClientRect();
          const t = Math.max(r.top, 0), b = Math.min(r.bottom, innerHeight); return { x: r.left + r.width / 2, y: (t + b) / 2 }; })()`)) as { x: number; y: number };
        const s0 = (await page.evaluate(STATE)) as State;
        for (let i = 0; i < 12; i++) {
          const st = (await page.evaluate(STATE)) as State;
          if (st.atEnd) break;
          await swipe(page, Math.round(mid.x), Math.round(mid.y), -300);
        }
        const s1 = (await page.evaluate(STATE)) as State;
        res.S8_paying_form_scrolls_itself = [s1.atEnd && (s0.scrollers.length === 0 || s1.panelScroll > s0.panelScroll || s0.atEnd), { before: s0.scrollers, after: s1.scrollers }];
        // S9 — …and at the end the pay button is ON the screen and a finger there hits IT
        const pay = (await page.evaluate(`(() => { const b = document.querySelector(".cit-cfg-panel .cit-cfg-pay"); if (!b) return { found: false };
          const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
          const inView = r.top >= 0 && r.bottom <= innerHeight && r.height > 0;
          const h = inView ? document.elementFromPoint(x, y) : null;
          return { found: true, inView, hitSelf: !!(h && (h === b || b.contains(h))), rect: [Math.round(r.top), Math.round(r.bottom)], vh: innerHeight }; })()`)) as { found: boolean; inView?: boolean; hitSelf?: boolean };
        res.S9_pay_button_reachable = [pay.found && !!pay.inView && !!pay.hitSelf, pay];
      } else {
        res.S8_paying_form_scrolls_itself = [false, "fizetés-lépés nem nyílt"];
        res.S9_pay_button_reachable = [false, "fizetés-lépés nem nyílt"];
      }
    }

    // S4 — close the panel: the page scrolls again (no stuck lock)
    await page.evaluate(`document.querySelector(".cit-cfg-close").click()`);
    await page.waitForTimeout(500);
    const a = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    await swipe(page, Math.round(vp.width / 2), Math.round(vp.height * 0.45), a > 300 ? 260 : -260);
    const b = (await page.evaluate(`Math.round(window.scrollY)`)) as number;
    res.S4_page_scrolls_after_close = [Math.abs(b - a) > 20, { before: a, after: b }];
    res.S5_no_js_errors = [jsErrors.length === 0, jsErrors];
    (res as Record<string, unknown>).__zones = z;
  } finally {
    await ctx.close();
  }
  return res;
}

const browser = await chromium.launch({ executablePath: chromiumExe() });
await mkdir(OUT, { recursive: true });
let failures = 0;
/**
 * Named, OPEN exceptions — reported loudly, never graded green, and the run says when
 * one has gone away. Each needs its reason and its owner (memory: a recorded failure
 * must not grade green).
 */
const KNOWN_OPEN: Record<string, string> = {
  // (2026-09-26: the sideways paying step — "Fizetek" below the edge — was listed here
  // until the owner decided: sideways, the paying step scrolls as one column. Fixed.)
  "360:S8_paying_form_scrolls_itself":
    "álló 360×780-on a fizetés-lépés számlázási űrlapjának ablaka ~24 px, a pipa-blokk takarja — a két-lépéses " +
    "átszervezés (A szál, ADR-0240) után jelent meg (előtte 152 px, zöld); a „Fizetek” látszik, de az űrlap nem " +
    "tölthető ki → az A szálnak / a koordinátornak jelezve (2026-09-26), a B szál hatókörén kívül",
};
let knownOpen = 0;
const check = (name: string, ok: boolean, detail?: unknown): void => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail).slice(0, 400)}`}`);
  }
};
try {
  if (process.env.CFG_ONLY) console.log(`⚠️  SZŰKÍTVE (CFG_ONLY=${process.env.CFG_ONLY}) — a többi sablon KIHAGYVA`);
  console.log(`\nŐR — telefonon a rendelés-panel görget, nem a lap (${TEMPLATES.length} sablon × ${VIEWPORTS.map((v) => v.id).join("/")})`);
  for (const tpl of TEMPLATES) {
    for (const vp of VIEWPORTS) {
      const r = await run(browser, tpl, vp, "none");
      console.log(`\n${tpl} @ ${vp.id}`);
      for (const [k, v] of Object.entries(r)) {
        if (k.startsWith("__")) continue;
        const [ok, detail] = v as [boolean, unknown];
        const known = KNOWN_OPEN[`${vp.id}:${k}`];
        if (known && !ok) {
          knownOpen++;
          console.log(`  ⚠ ${k} — ISMERT, NYITOTT (nem zöld): ${known}`);
        } else if (known && ok) {
          console.log(`  ✓ ${k} — a KNOWN_OPEN kivétel MEGSZŰNT, vedd ki a listából`);
        } else check(k, ok, ok ? undefined : detail);
      }
    }
  }
  if (SELFTEST) {
    console.log("\nPIROS ÖNTESZT — a javítás kivéve (nincs érintés-őr, nincs overscroll-elzárás): S1 (és állón S7) legyen PIROS, S3/S6 zöld");
    for (const vp of [VIEWPORTS[0]!, VIEWPORTS[2]!]) {
      const r = await run(browser, "fullbleed", vp, "no-fix");
      const upright = vp.height > vp.width;
      check(`no-fix @ ${vp.id} → S1 PIROS`, r.S1_drag_on_panel_keeps_page_still?.[0] === false, r.S1_drag_on_panel_keeps_page_still?.[1]);
      check(`no-fix @ ${vp.id} → S3 (előnézet) zöld marad`, r.S3_preview_scrolls_to_change?.[0] === true, r.S3_preview_scrolls_to_change?.[1]);
      // sideways the steps scroll as ONE panel column, so a band drag moves the panel, not
      // the page, even without the guard (measured) — the red S7 control is upright only
      if (upright) check(`no-fix @ ${vp.id} → S7 (2. lépés + fizetés) PIROS`, r.S7_order_steps_keep_page_still?.[0] === false, r.S7_order_steps_keep_page_still?.[1]);
      check(`no-fix @ ${vp.id} → S6 (a lap a panel mellett görget) zöld marad`, r.S6_page_beside_panel_still_scrolls?.[0] === true, r.S6_page_beside_panel_still_scrolls?.[1]);
    }
    console.log("\nPIROS ÖNTESZT — a fekvő egy-oszlopos fizetés kivéve: S9 („Fizetek” elérhető) PIROS fekvőn, álló 390-en zöld");
    for (const vp of [VIEWPORTS[2]!, VIEWPORTS[3]!]) {
      const r = await run(browser, "fullbleed", vp, "no-landcol");
      check(`no-landcol @ ${vp.id} → S9 PIROS`, r.S9_pay_button_reachable?.[0] === false, r.S9_pay_button_reachable?.[1]);
    }
    const r390 = await run(browser, "fullbleed", VIEWPORTS[0]!, "no-landcol");
    check("no-landcol @ 390 → S9 zöld marad (állón a fekvő blokk nem sül el)", r390.S9_pay_button_reachable?.[0] === true, r390.S9_pay_button_reachable?.[1]);
  }
} finally {
  await browser.close();
}
if (knownOpen) console.log(`\n⚠ ${knownOpen} ISMERT, NYITOTT lelet (lásd fent) — ezek NEM zöldek, tulaj-döntésre várnak`);
console.log(failures ? `\n✗ cfg-sheet-scroll-check: ${failures} bukás` : `\n✓ cfg-sheet-scroll-check: minden mért szabály zöld${knownOpen ? ` (+${knownOpen} ismert nyitott)` : ""}`);
process.exit(failures ? 1 : 0);
