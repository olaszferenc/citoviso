// A LEAD ELSŐ MEGNYITÁSA TELEFONON — a kiküldött /p/<token> lap mérése úgy, ahogy
// a szállásadó a hideg levél / SMS / MMS linkjéről látja (Elek FK-009, 2026-09-26).
//
//   npx tsx scripts/lead-mobile-check.mts                 (a links.json minden lapja, 3 nézet)
//   npx tsx scripts/lead-mobile-check.mts --only=tihany-artdeco,laguna-aurora
//   npx tsx scripts/lead-mobile-check.mts --vp=390        (csak egy nézet: 390 | 360 | land)
//   npx tsx scripts/lead-mobile-check.mts --links=<fájl>  (más link-lista)
//   npx tsx scripts/lead-mobile-check.mts --gate           (ŐR: 5 sablon fixture-ön, DB-lead nélkül)
//   npx tsx scripts/lead-mobile-check.mts --gate --selftest (PIROS önteszt: 4 visszarontás)
//
// MIT MÉR, ÉS MIÉRT ÍGY
//
//  · FRISS BETÖLTÉS, MOBIL-EMULÁCIÓVAL (isMobile + touch + mobil UA), nem egy asztali
//    lap keskenyítése. A runner átméretezés-műterméke (FK-008b H-1: „telefonon nyitva
//    a vásárlói panel") pont abból jött, hogy a lap 1280-on töltődött be, és a ≤560 px
//    ág csak a betöltéskor dönt. Itt minden nézet SAJÁT kontextus, saját betöltés.
//  · VIEWPORT-KÉP, nem teljes-lapos: a teljes-lapos kép a ragadó/fixed elemet a
//    végleges helyére festi, tehát egy takaró sáv is zöldnek látszik
//    (reference_fullpage_shot_hides_dead_sticky). A lap alját GÖRGETÉSSEL érjük el.
//  · GEOMETRIA + elementFromPoint, nem az elem saját véleménye: a láblécet és a
//    pirulát azon a ponton kérdezzük, ahol az ujj érne hozzá.
//  · HÁROM TARTÁS: 390×844 (elsődleges), 360×780 (olcsó Android), 844×390 (FEKVŐ) —
//    a tartás nem szélesség: fekvő telefonon a rögzített sávok a magasság felét is
//    elvihetik (memória: 10-ből 8 vezérlő láthatatlan volt egy korábbi szálban).
//  · SÚLY: minden válasz mérete típusonként (dokumentum/kép/szkript/css/betű), képek
//    száma, lazy-load arány — a wow mobil-neten múlik.
//
// Kimenet (gitignore-olt, a MUNKAFÁN belül, hogy RC-ből megnyitható legyen):
//   assets/design-refs/_drafts/lead-mobile/shots/<lead>-<stílus>/<nézet>-NN-<mi>.png
//   assets/design-refs/_drafts/lead-mobile/report.json + REPORT.md

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.ELEK_RUN = "1"; // mechanical mail/SMS/MMS guard (nothing may leave)
process.env.EMAIL_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import type { Server } from "node:http";
import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright-core";

import { config } from "../src/config.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DRAFTS = path.join(ROOT, "assets", "design-refs", "_drafts", "lead-mobile");
const args = process.argv.slice(2);
const flag = (n: string): string | null => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=")[1] ?? null;
const LINKS_FILE = flag("links") ?? path.join(DRAFTS, "links.json");
const ONLY = (flag("only") ?? "").split(",").filter(Boolean);
const VP_ONLY = flag("vp");

interface Link {
  leadId: string;
  leadName: string;
  leadSlug: string;
  style: string;
  token: string;
  path: string;
  envKey: string;
}

interface Viewport {
  id: "390" | "360" | "land";
  label: string;
  width: number;
  height: number;
  dpr: number;
  ua: string;
}
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const VIEWPORTS: Viewport[] = [
  { id: "390", label: "390×844 álló", width: 390, height: 844, dpr: 2, ua: IPHONE_UA },
  { id: "360", label: "360×780 álló (olcsó Android)", width: 360, height: 780, dpr: 1, ua: ANDROID_UA },
  { id: "land", label: "844×390 FEKVŐ", width: 844, height: 390, dpr: 1, ua: IPHONE_UA },
];

function chromiumExe(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    config.chromiumPath,
    path.join(process.env.HOME ?? "", ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome"),
  ].filter((p): p is string => !!p);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("nincs használható Chromium (CHROMIUM_PATH?)");
}

async function bootConsole(): Promise<string> {
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("konzol szerver cím nélkül");
  return `http://127.0.0.1:${a.port}`;
}

// ── in-page probes (strings: no tsx __name helper in the page) ──────────────

type Rect = { top: number; left: number; width: number; height: number; bottom: number; right: number };

interface FirstScreen {
  vw: number;
  vh: number;
  /** page-level horizontal overflow: can the document be scrolled sideways? */
  hOverflowPx: number;
  /** template elements wider than the device, CLIPPED by the served page (info for the content thread) */
  pokingPx: number;
  /** visible elements poking out to the right (top 5) */
  overflowers: { sel: string; right: number }[];
  banner: (Rect & { text: string }) | null;
  bannerFontPx: number | null;
  consent: Rect | null;
  /** first element that carries the lead's name (heading preferred) */
  name: (Rect & { tag: string; fontPx: number; visible: boolean; inViewport: boolean }) | null;
  /** any real photo (img or background) visible in the first viewport? */
  heroPhoto: { sel: string; top: number; height: number; loaded: boolean; naturalW: number } | null;
  /** fixed/sticky elements at load, with their height share */
  fixed: { sel: string; pos: string; h: number; top: number; bottom: number }[];
  imgs: { total: number; lazy: number; broken: number; eager: number };
  panelOpen: boolean;
  scrollHeight: number;
}

const FIRST = `(leadName) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => el.checkVisibility
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : true;
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
  const sel = (el) => (el.tagName || "").toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && el.className.toString ? "." + el.className.toString().trim().split(/\\s+/).slice(0, 2).join(".") : "");

  // page-level horizontal overflow = can the DOCUMENT actually be scrolled sideways?
  // (scrollWidth alone also counts overflow that overflow-x:clip already cut off —
  // the served page clips it, so the lead cannot reach it, while the template's
  // poking-out elements are still listed below as a note for the content thread)
  const de = document.documentElement;
  const x0 = window.scrollX;
  window.scrollTo(1e6, window.scrollY);
  const hOverflowPx = Math.max(0, Math.round(window.scrollX));
  window.scrollTo(x0, window.scrollY);
  const pokingPx = Math.max(0, Math.max(de.scrollWidth, document.body.scrollWidth) - vw);
  const overflowers = [];
  if (pokingPx > 1) {
    for (const el of document.querySelectorAll("body *")) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.right > vw + 1 && r.left < vw) {
        // only if no ancestor clips it
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          const pc = getComputedStyle(p);
          if (/(hidden|auto|scroll|clip)/.test(pc.overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (!clipped) overflowers.push({ sel: sel(el), right: Math.round(r.right) });
      }
      if (overflowers.length >= 5) break;
    }
  }

  const bannerEl = document.querySelector("[data-cit-framing]");
  const banner = bannerEl ? Object.assign(rect(bannerEl), { text: (bannerEl.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120) }) : null;
  const bannerFontPx = bannerEl ? parseFloat(getComputedStyle(bannerEl).fontSize) : null;
  const consentEl = document.getElementById("cit-consent");
  const consent = consentEl && vis(consentEl) ? rect(consentEl) : null;

  // the lead's name: prefer headings, then any element whose OWN text carries it
  const needle = leadName.toLowerCase();
  let name = null;
  const cands = [...document.querySelectorAll("h1, h2, .cit-hero *, header *, [class*='hero'] *, body *")];
  for (const el of cands) {
    if (el.closest("[data-cit-framing]") || el.closest("#cit-consent") || el.closest("[class*='cit-cfg']")) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\\s+/g, " ").trim().toLowerCase();
    if (!own || own.indexOf(needle) < 0) continue;
    if (!vis(el)) continue;
    const r = rect(el);
    if (r.width < 4 || r.height < 4) continue;
    name = Object.assign(r, { tag: el.tagName.toLowerCase(), fontPx: parseFloat(getComputedStyle(el).fontSize),
      visible: true, inViewport: r.top >= 0 && r.bottom <= vh });
    break;
  }

  // hero photo in the first viewport: an <img> or an element with a background-image
  let heroPhoto = null;
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[class*='cit-cfg']") || el.closest("#cit-consent")) continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.width < 120 || r.height < 120) continue;
    if (el.tagName === "IMG") {
      heroPhoto = { sel: sel(el), top: Math.round(r.top), height: Math.round(r.height), loaded: el.complete && el.naturalWidth > 0, naturalW: el.naturalWidth };
      break;
    }
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none" && /url\\(/.test(bg)) {
      heroPhoto = { sel: sel(el), top: Math.round(r.top), height: Math.round(r.height), loaded: true, naturalW: -1 };
      break;
    }
  }

  // Fixed/sticky layers that would COVER content: the visible band only (a bottom
  // sheet translated off-screen still has a rect), and only if a finger at the band's
  // centre lands on it (a decorative pointer-events:none backdrop covers nothing).
  const fixed = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (!vis(el) || cs.pointerEvents === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 8) continue;
    const top = Math.max(0, r.top), bottom = Math.min(vh, r.bottom);
    if (bottom - top < 8) continue;
    const cx = r.left + r.width / 2, cy = (top + bottom) / 2;
    const h = document.elementFromPoint(Math.min(vw - 1, Math.max(0, cx)), cy);
    if (!h || !(h === el || el.contains(h))) continue;
    fixed.push({ sel: sel(el), pos: cs.position, h: Math.round(bottom - top), top: Math.round(top), bottom: Math.round(bottom) });
  }

  const all = [...document.images];
  const imgs = {
    total: all.length,
    lazy: all.filter((i) => i.loading === "lazy").length,
    eager: all.filter((i) => i.loading !== "lazy").length,
    broken: all.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).length,
  };
  const panel = document.querySelector(".cit-cfg-panel");
  return { vw, vh, hOverflowPx, pokingPx: Math.round(pokingPx), overflowers, banner, bannerFontPx, consent, name, heroPhoto, fixed, imgs,
    panelOpen: !!(panel && panel.classList.contains("cit-cfg-open")), scrollHeight: de.scrollHeight };
}`;

interface HitProbe {
  found: boolean;
  rect: Rect | null;
  inViewport: boolean;
  /** what the finger would hit at the element's centre */
  hitSelf: boolean;
  hitBy: string | null;
  fontPx: number | null;
  text: string;
}

/** Where is `selector` (or text-matched anchor) and would a tap at its centre reach it? */
const HIT = `(q) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  let el = null;
  if (q.selector) el = document.querySelector(q.selector);
  if (!el && q.text) {
    for (const a of document.querySelectorAll(q.within || "body")) {
      for (const c of a.querySelectorAll("a, summary, button")) {
        if ((c.textContent || "").replace(/\\s+/g, " ").trim() === q.text) { el = c; break; }
      }
      if (el) break;
    }
  }
  if (!el) return { found: false, rect: null, inViewport: false, hitSelf: false, hitBy: null, fontPx: null, text: "" };
  const r = el.getBoundingClientRect();
  const rect = { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const inViewport = r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw && r.width > 0 && r.height > 0;
  let hitSelf = false, hitBy = null;
  if (inViewport) {
    const h = document.elementFromPoint(cx, cy);
    hitSelf = !!h && (h === el || el.contains(h) || (h.contains && h.contains(el) && h.tagName !== "BODY" && h.tagName !== "HTML"));
    if (!hitSelf) hitBy = h ? (h.tagName.toLowerCase() + (h.id ? "#" + h.id : "") + (h.className && h.className.toString ? "." + h.className.toString().trim().split(/\\s+/).slice(0,2).join(".") : "")) : "null";
  }
  return { found: true, rect, inViewport, hitSelf, hitBy, fontPx: parseFloat(getComputedStyle(el).fontSize),
    text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60) };
}`;

interface BottomProbe {
  scrollY: number;
  atBottom: boolean;
  footer: (Rect & { text: string; fontPx: number }) | null;
  privacy: HitProbe;
  unsub: HitProbe;
  pill: HitProbe;
  consent: Rect | null;
  /** fixed elements that overlap the footer's rectangle */
  footerCoveredBy: string[];
  /** how much of the viewport height is taken by fixed elements, at the bottom */
  fixedSharePct: number;
}

const BOTTOM = `() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const de = document.documentElement;
  const atBottom = Math.abs(window.scrollY + vh - de.scrollHeight) < 3;
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && el.className.toString ? "." + el.className.toString().trim().split(/\\s+/).slice(0, 2).join(".") : "");
  // the tracked footer = the LAST direct child of body that carries "Leiratkozás"
  let footerEl = null;
  for (const el of [...document.body.children].reverse()) {
    if (/Leiratkozás/.test(el.textContent || "") && getComputedStyle(el).position !== "fixed") { footerEl = el; break; }
  }
  const footer = footerEl ? Object.assign(rect(footerEl), { text: (footerEl.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
    fontPx: parseFloat(getComputedStyle(footerEl).fontSize) }) : null;
  // ⛔ the FOOTER's links, not the first match on the page: the framing bar's closed
  // <details> carries the same two labels, and a body-wide search returned those
  // (rect at −14 400 px) — a false "not on screen" on every page.
  if (footerEl) footerEl.setAttribute("data-lm-footer", "1");
  const hit = ${HIT};
  const privacy = hit({ text: "Adatkezelési tájékoztató", within: footerEl ? "[data-lm-footer]" : "body" });
  const unsub = hit({ text: "Leiratkozás", within: footerEl ? "[data-lm-footer]" : "body" });
  const pill = hit({ selector: ".cit-cfg-launch.cit-cfg-in" });
  const consentEl = document.getElementById("cit-consent");
  const consent = consentEl && consentEl.offsetParent !== null ? rect(consentEl) : (consentEl && getComputedStyle(consentEl).display !== "none" ? rect(consentEl) : null);
  const footerCoveredBy = [];
  let fixedPx = 0;
  const seenBands = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0" || cs.pointerEvents === "none") continue;
    const r0 = el.getBoundingClientRect();
    if (r0.width < 40 || r0.height < 8) continue;
    // the VISIBLE band only, and only if a finger there lands on this layer (an
    // off-screen bottom sheet and a pointer-events:none backdrop cover nothing)
    const r = { top: Math.max(0, r0.top), bottom: Math.min(vh, r0.bottom), left: Math.max(0, r0.left), right: Math.min(vw, r0.right) };
    if (r.bottom - r.top < 8 || r.right - r.left < 8) continue;
    const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (!h || !(h === el || el.contains(h))) continue;
    // count height once per overlapping band (a bar and its child are one band)
    const band = seenBands.find((b) => !(r.bottom <= b.top || r.top >= b.bottom));
    if (band) { band.top = Math.min(band.top, r.top); band.bottom = Math.max(band.bottom, r.bottom); }
    else seenBands.push({ top: r.top, bottom: r.bottom });
    if (footer) {
      const f = footer;
      if (!(r.bottom <= f.top || r.top >= f.bottom || r.right <= f.left || r.left >= f.right)) footerCoveredBy.push(sel(el));
    }
  }
  for (const b of seenBands) fixedPx += Math.min(vh, b.bottom) - Math.max(0, b.top);
  return { scrollY: Math.round(window.scrollY), atBottom, footer, privacy, unsub, pill, consent, footerCoveredBy,
    fixedSharePct: Math.round((fixedPx / vh) * 100) };
}`;

interface PanelProbe {
  open: boolean;
  panel: Rect | null;
  fitsViewport: boolean;
  /** the panel's primary button (first visible button in its foot) */
  cta: HitProbe;
  /** how much of the viewport the open panel takes */
  sharePct: number;
  bodyScrollable: boolean;
}

const PANEL = `() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const panel = document.querySelector(".cit-cfg-panel");
  if (!panel) return { open: false, panel: null, fitsViewport: false, cta: { found: false }, sharePct: 0, bodyScrollable: false };
  const r = panel.getBoundingClientRect();
  const rect = { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  const hit = ${HIT};
  // The decision button of the first page (.cit-cfg-next, "Tovább a megrendeléshez");
  // ⛔ NOT "the first big button in the panel" — that picked the "Havi" option and
  // graded a landscape page green while the real button sat under the consent bar.
  let ctaSel = panel.querySelector(".cit-cfg-next") ? ".cit-cfg-next" : null;
  const foot = panel.querySelector(".cit-cfg-foot, .cit-cfg-actions, [class*='cit-cfg-co-act']") || panel;
  for (const b of ctaSel ? [] : foot.querySelectorAll("button, a")) {
    const cs = getComputedStyle(b);
    const br = b.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || br.width < 80 || br.height < 30) continue;
    b.setAttribute("data-lm-cta", "1"); ctaSel = "[data-lm-cta='1']"; break;
  }
  let cta = ctaSel ? hit({ selector: ctaSel }) : { found: false, rect: null, inViewport: false, hitSelf: false, hitBy: null, fontPx: null, text: "" };
  // REACHABLE, not necessarily on screen without a scroll: on a 390 px tall viewport
  // the panel's head + list + decision cannot all fit, and the visitor scrolls the
  // panel. What must hold is that a scroll brings the button on screen AND that a
  // finger then lands on it (not on the consent bar).
  const insidePanel = cta.rect ? cta.rect.top >= r.top - 1 && cta.rect.bottom <= r.bottom + 1 : true;
  if (cta.found && (!cta.inViewport || !insidePanel) && ctaSel) {
    document.querySelector(ctaSel).scrollIntoView({ block: "end", behavior: "instant" });
    cta = Object.assign(hit({ selector: ctaSel }), { neededScroll: true });
  }
  const body = panel.querySelector(".cit-cfg-body");
  return { open: panel.classList.contains("cit-cfg-open"), panel: rect,
    fitsViewport: r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1,
    cta, sharePct: Math.round((Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top)) / vh) * 100),
    bodyScrollable: !!(body && body.scrollHeight > body.clientHeight + 4) };
}`;

// ── the run ─────────────────────────────────────────────────────────────────

interface Weight {
  requests: number;
  bytes: { document: number; image: number; script: number; stylesheet: number; font: number; other: number; total: number };
  images: { url: string; bytes: number; status: number }[];
  failed: { url: string; status: number }[];
}

interface PageReport {
  lead: string;
  leadName: string;
  style: string;
  vp: Viewport["id"];
  path: string;
  first: FirstScreen;
  pill: HitProbe;
  pillAppearedMs: number | null;
  why: { opened: boolean; block: HitProbe; privacy: HitProbe; unsub: HitProbe };
  consentHeightPct: number | null;
  bottom: BottomProbe;
  panel: PanelProbe;
  weight: Weight;
  jsErrors: string[];
  httpErrors: string[];
  shots: string[];
  flags: { level: "HIBA" | "ERGONÓMIA" | "ZAVAROS" | "GYANÚ"; what: string }[];
}

function fmtKB(b: number): string {
  return `${Math.round(b / 1024)} KB`;
}

async function measure(
  ctx: BrowserContext,
  origin: string,
  link: Link,
  vp: Viewport,
  shotDir: string,
): Promise<PageReport> {
  const page = await ctx.newPage();
  const jsErrors: string[] = [];
  const httpErrors: string[] = [];
  const weight: Weight = {
    requests: 0,
    bytes: { document: 0, image: 0, script: 0, stylesheet: 0, font: 0, other: 0, total: 0 },
    images: [],
    failed: [],
  };
  page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") jsErrors.push(`console: ${m.text().slice(0, 200)}`);
  });
  const pending: Promise<void>[] = [];
  page.on("response", (res: Response) => {
    const req = res.request();
    const type = req.resourceType();
    weight.requests++;
    const url = res.url();
    const st = res.status();
    if (st >= 400) {
      httpErrors.push(`${st} ${url.slice(0, 140)}`);
      weight.failed.push({ url, status: st });
    }
    pending.push(
      (async () => {
        let n = Number(res.headers()["content-length"] ?? NaN);
        if (!Number.isFinite(n)) {
          try {
            n = (await res.body()).length;
          } catch {
            n = 0;
          }
        }
        const key = (["document", "image", "script", "stylesheet", "font"] as const).find((k) => k === type) ?? "other";
        weight.bytes[key] += n;
        weight.bytes.total += n;
        if (type === "image") weight.images.push({ url, bytes: n, status: st });
      })(),
    );
  });

  const shots: string[] = [];
  const shot = async (n: number, what: string): Promise<void> => {
    const f = path.join(shotDir, `${vp.id}-${String(n).padStart(2, "0")}-${what}.png`);
    await page.screenshot({ path: f, fullPage: false });
    shots.push(path.relative(DRAFTS, f));
  };
  const settle = (): Promise<void> =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined)))));

  const t0 = Date.now();
  await page.goto(origin + link.path, { waitUntil: "load", timeout: 45_000 });
  await page.waitForTimeout(350);
  await settle();
  // ① the first screen, before the pill's 2,6 s beat
  const first = (await page.evaluate(`(${FIRST})(${JSON.stringify(link.leadName)})`)) as FirstScreen;
  await shot(1, "first");

  // ② the invite pill: appears after ~2,6 s or on scroll — we wait, we do not scroll
  let pillAppearedMs: number | null = null;
  try {
    await page.waitForSelector(".cit-cfg-launch.cit-cfg-in", { state: "attached", timeout: 5000 });
    pillAppearedMs = Date.now() - t0;
    await page.waitForTimeout(1100); // fade-in 0,5 s + placeLaunch 0,9 s
  } catch {
    pillAppearedMs = null;
  }
  await settle();
  const pill = (await page.evaluate(`(${HIT})(${JSON.stringify({ selector: ".cit-cfg-launch.cit-cfg-in" })})`)) as HitProbe;
  const consentNow = (await page.evaluate(`(() => { const c = document.getElementById("cit-consent"); if (!c) return null;
    const cs = getComputedStyle(c); if (cs.display === "none" || cs.visibility === "hidden") return null;
    const r = c.getBoundingClientRect(); return { h: r.height, vh: window.innerHeight }; })()`)) as { h: number; vh: number } | null;
  const consentHeightPct = consentNow ? Math.round((consentNow.h / consentNow.vh) * 100) : null;
  await shot(2, "pill");

  // ③ „Miért kaptam?" — a finger on the summary
  const why = { opened: false, block: { found: false } as HitProbe, privacy: { found: false } as HitProbe, unsub: { found: false } as HitProbe };
  const summary = page.locator("[data-cit-framing] details summary").first();
  if ((await summary.count()) > 0) {
    try {
      await summary.tap({ timeout: 3000 });
    } catch {
      await summary.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
    await settle();
    why.opened = await page.evaluate(`(() => { const d = document.querySelector("[data-cit-framing] details"); return !!(d && d.open); })()`);
    why.block = (await page.evaluate(`(${HIT})(${JSON.stringify({ selector: "[data-cit-framing] details > div" })})`)) as HitProbe;
    why.privacy = (await page.evaluate(`(${HIT})(${JSON.stringify({ text: "Adatkezelési tájékoztató", within: "[data-cit-framing]" })})`)) as HitProbe;
    why.unsub = (await page.evaluate(`(${HIT})(${JSON.stringify({ text: "Leiratkozás", within: "[data-cit-framing]" })})`)) as HitProbe;
    await shot(3, "why");
    // close it again — the rest of the walk is the default state
    try {
      await summary.tap({ timeout: 2000 });
    } catch {
      /* stays open — recorded in why.opened only */
    }
  }

  // ④ the bottom of the page: legal links reachable and tappable?
  // ⚠️ Instant, repeated: the templates set scroll-behavior:smooth, so ONE scrollTo
  // animates and a probe read mid-way looked like an unreachable bottom (measured:
  // 6297 → 12979 → 14433 → 14662 on artdeco). Walk the page (JS lazy-loaders fire
  // on scroll), then pin the bottom until the height stops changing.
  await page.evaluate(`(async () => { const de = document.documentElement; de.style.scrollBehavior = "auto";
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < de.scrollHeight; y += step) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise(r => setTimeout(r, 40)); }
    let last = -1;
    for (let i = 0; i < 12; i++) { window.scrollTo({ top: de.scrollHeight, behavior: "instant" }); await new Promise(r => setTimeout(r, 150));
      if (de.scrollHeight === last && Math.abs(window.scrollY + window.innerHeight - de.scrollHeight) < 3) break; last = de.scrollHeight; }
    de.style.scrollBehavior = ""; })()`);
  await page.waitForTimeout(700); // placeLaunch after scroll (120 ms debounce + transition)
  await settle();
  const bottom = (await page.evaluate(`(${BOTTOM})()`)) as BottomProbe;
  await shot(4, "bottom");

  // ⑤ the buyer's entry: tap the pill → the configurator's first page
  let panel: PanelProbe = { open: false, panel: null, fitsViewport: false, cta: { found: false } as HitProbe, sharePct: 0, bodyScrollable: false };
  const pillLoc = page.locator(".cit-cfg-launch.cit-cfg-in");
  if ((await pillLoc.count()) > 0) {
    // back near the top first: the lead taps the pill where it first sees it
    await page.evaluate(`window.scrollTo(0, Math.round(window.innerHeight * 0.4))`);
    await page.waitForTimeout(500);
    try {
      await pillLoc.tap({ timeout: 3000, force: false });
    } catch (e) {
      jsErrors.push(`pirula-koppintás sikertelen: ${(e as Error).message.split("\n")[0].slice(0, 160)}`);
    }
    await page.waitForTimeout(700);
    await settle();
    panel = (await page.evaluate(`(${PANEL})()`)) as PanelProbe;
    await shot(5, "config");
  }

  await Promise.allSettled(pending);
  weight.images.sort((a, b) => b.bytes - a.bytes);
  await page.close();

  // ── verdicts (rules are the findings' spine; the picture is the proof) ─────
  const flags: PageReport["flags"] = [];
  const vh = first.vh;
  if (first.hOverflowPx > 2) flags.push({ level: "HIBA", what: `a lap oldalra görgethető ${first.hOverflowPx} px-t (${first.overflowers.map((o) => o.sel).join(", ") || "?"})` });
  else if (first.pokingPx > 2) flags.push({ level: "GYANÚ", what: `a sablon ${first.pokingPx} px-t kilóg jobbra (elvágva, nem görgethető): ${first.overflowers.map((o) => o.sel).slice(0, 3).join(", ")} → testvér-szál` });
  // ⛔ THE SILENT FORM OF OVERFLOW: on a phone Chromium does not scroll sideways, it
  // WIDENS the layout viewport to the content (brutalism's marquee, measured
  // 2026-09-26: innerWidth 780 on a 390 device) — scrollWidth − innerWidth is then 0,
  // while every fixed layer (consent bar, pill, framing) is laid out on the wide
  // viewport and lands half or fully OFF the screen. The device width is the truth.
  if (first.vw !== vp.width) flags.push({ level: "HIBA", what: `a lap szélesebb a telefonnál: layout viewport ${first.vw} px a ${vp.width} px-es készüléken (túlfolyó elem — a süti-sáv/pirula/keret kicsúszik)` });
  if (!first.banner) flags.push({ level: "HIBA", what: "nincs keret-sáv a lap tetején" });
  if (first.banner && first.banner.height / vh > 0.3) flags.push({ level: "ERGONÓMIA", what: `a keret-sáv a képernyő ${Math.round((first.banner.height / vh) * 100)}%-a` });
  if (first.name && !first.name.inViewport) flags.push({ level: "ERGONÓMIA", what: `a szállás neve a hajtás ALATT (top ${Math.round(first.name.top)} px, vh ${vh})` });
  if (!first.name) flags.push({ level: "GYANÚ", what: "a szállás neve nem található látható szövegként az első képernyőn" });
  if (!first.heroPhoto) flags.push({ level: "ERGONÓMIA", what: "az első képernyőn nincs fotó" });
  if (first.heroPhoto && !first.heroPhoto.loaded) flags.push({ level: "HIBA", what: `az első képernyő fotója TÖRÖTT (${first.heroPhoto.sel}) → testvér-szál/adat` });
  if (first.panelOpen) flags.push({ level: "HIBA", what: "a vásárlói panel NYITVA áll betöltéskor" });
  if (pillAppearedMs == null) flags.push({ level: "HIBA", what: "a hívó pirula nem jelent meg 5 mp alatt görgetés nélkül" });
  if (pill.found && !pill.inViewport) flags.push({ level: "HIBA", what: "a pirula a képernyőn kívül áll" });
  if (pill.found && pill.inViewport && !pill.hitSelf) flags.push({ level: "HIBA", what: `a pirulát takarja: ${pill.hitBy}` });
  if (pill.rect && pill.rect.height < 44) flags.push({ level: "ERGONÓMIA", what: `a pirula ${Math.round(pill.rect.height)} px magas (< 44)` });
  if (consentHeightPct != null && consentHeightPct > 25) flags.push({ level: "ERGONÓMIA", what: `a süti-sáv a képernyő ${consentHeightPct}%-a` });
  const fixedTop = first.fixed.filter((f) => f.h / vh > 0.4);
  if (fixedTop.length) flags.push({ level: "HIBA", what: `takaró rögzített elem betöltéskor: ${fixedTop.map((f) => `${f.sel} ${f.h}px`).join(", ")}` });
  if (!why.opened) flags.push({ level: "HIBA", what: "a „Miért kaptam?” nem nyílt ki koppintásra" });
  if (why.opened && why.block.found && !why.block.inViewport) flags.push({ level: "ERGONÓMIA", what: "a kinyitott magyarázat kilóg a képernyőből" });
  for (const [n, h] of [["Adatkezelési tájékoztató (sáv)", why.privacy], ["Leiratkozás (sáv)", why.unsub]] as const) {
    if (why.opened && h.found && h.inViewport && !h.hitSelf) flags.push({ level: "HIBA", what: `${n} linket takarja: ${h.hitBy}` });
    if (h.rect && h.rect.height < 24) flags.push({ level: "ERGONÓMIA", what: `${n} érintési célja ${Math.round(h.rect.height)} px (< 24)` });
  }
  if (!bottom.footer) flags.push({ level: "HIBA", what: "nincs jogi lábléc a lap alján" });
  if (bottom.footer && !bottom.atBottom) flags.push({ level: "GYANÚ", what: "a lap nem görgethető az aljáig" });
  for (const [n, h] of [["Adatkezelési tájékoztató (lábléc)", bottom.privacy], ["Leiratkozás (lábléc)", bottom.unsub]] as const) {
    if (!h.found) flags.push({ level: "HIBA", what: `${n} link hiányzik` });
    else if (!h.inViewport) flags.push({ level: "HIBA", what: `${n} a lap alján sem kerül a képernyőre` });
    else if (!h.hitSelf) flags.push({ level: "HIBA", what: `${n} linket takarja: ${h.hitBy}` });
    if (h.rect && h.rect.height < 24) flags.push({ level: "ERGONÓMIA", what: `${n} érintési célja ${Math.round(h.rect.height)} px (< 24)` });
    if (h.fontPx != null && h.fontPx < 12) flags.push({ level: "ERGONÓMIA", what: `${n} betűmérete ${h.fontPx} px (< 12)` });
  }
  if (bottom.footerCoveredBy.length) flags.push({ level: "ERGONÓMIA", what: `a láblécre rögzített elem fekszik: ${[...new Set(bottom.footerCoveredBy)].join(", ")}` });
  if (bottom.fixedSharePct > 40) flags.push({ level: "ERGONÓMIA", what: `a lap alján a rögzített sávok a képernyő ${bottom.fixedSharePct}%-át viszik` });
  if (pill.found && !panel.open) flags.push({ level: "HIBA", what: "a pirula koppintására nem nyílt ki a konfigurátor" });
  if (panel.open && !panel.fitsViewport) flags.push({ level: "HIBA", what: `a konfigurátor kilóg a képernyőből (${JSON.stringify(panel.panel && { top: Math.round(panel.panel.top), bottom: Math.round(panel.panel.bottom) })})` });
  if (panel.open && panel.cta.found && !panel.cta.inViewport) flags.push({ level: "HIBA", what: "a konfigurátor fő gombja nincs a képernyőn" });
  if (panel.open && panel.cta.found && panel.cta.inViewport && !panel.cta.hitSelf) flags.push({ level: "HIBA", what: `a konfigurátor fő gombját takarja: ${panel.cta.hitBy}` });
  if (panel.open && panel.sharePct > 92) flags.push({ level: "ERGONÓMIA", what: `a konfigurátor a képernyő ${panel.sharePct}%-át fedi` });
  if (jsErrors.length) flags.push({ level: "HIBA", what: `JS-hiba: ${jsErrors[0]}` });
  if (weight.failed.length) flags.push({ level: "GYANÚ", what: `${weight.failed.length} sikertelen kérés (${weight.failed[0]!.status} ${weight.failed[0]!.url.slice(0, 80)})` });
  if (weight.bytes.total > 3 * 1024 * 1024) flags.push({ level: "ERGONÓMIA", what: `a lap ${fmtKB(weight.bytes.total)} (> 3 MB) mobil-neten` });
  if (first.imgs.total > 6 && first.imgs.lazy === 0) flags.push({ level: "ERGONÓMIA", what: `${first.imgs.total} kép, egyik sem lazy-load` });
  if (first.imgs.broken) flags.push({ level: "GYANÚ", what: `${first.imgs.broken} törött kép a lapon → testvér-szál/adat` });

  return {
    lead: link.leadSlug,
    leadName: link.leadName,
    style: link.style,
    vp: vp.id,
    path: link.path,
    first,
    pill,
    pillAppearedMs,
    why,
    consentHeightPct,
    bottom,
    panel,
    weight,
    jsErrors,
    httpErrors,
    shots,
    flags,
  };
}

/** Undo the measurement's own opt-out on the product's rails (audit-logged). */
async function liftUnsubscribe(token: string): Promise<void> {
  const { db } = await import("../src/db/client.js");
  const { resubscribeProspect } = await import("../src/console/data.js");
  const row = await db.selectFrom("prospect").select(["id", "unsubscribed_at"]).where("token", "=", token).executeTakeFirst();
  if (!row?.unsubscribed_at) {
    console.log(`  leiratkozás-visszavonás: nem volt mit (${token.slice(0, 6)}…)`);
    return;
  }
  const r = await resubscribeProspect(row.id, "lead-mobile-check", "mérési GET a /unsubscribe úton (FK-009), nem a lead döntése");
  console.log(`  leiratkozás-visszavonás (${token.slice(0, 6)}…): ${r.ok ? "ok" : "NEM"} — ${r.message}`);
  if (!r.ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(LINKS_FILE, "utf8")) as { links: Link[] };
  let links = raw.links;
  if (ONLY.length) links = links.filter((l) => ONLY.includes(`${l.leadSlug}-${l.style}`));
  const vps = VIEWPORTS.filter((v) => !VP_ONLY || v.id === VP_ONLY);
  if (!links.length || !vps.length) {
    console.error("nincs mit mérni (--only / --vp szűrő?)");
    process.exit(1);
  }
  const origin = await bootConsole();
  const browser: Browser = await chromium.launch({ executablePath: chromiumExe() });
  const reports: PageReport[] = [];
  const extras: { vp: string; name: string; route: string; probe: Record<string, unknown>; jsErrors: string[]; shot: string }[] = [];
  const started = Date.now();
  try {
    for (const vp of vps) {
      for (const link of links) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.dpr,
          isMobile: true,
          hasTouch: true,
          userAgent: vp.ua,
          locale: "hu-HU",
        });
        const shotDir = path.join(DRAFTS, "shots", `${link.leadSlug}-${link.style}`);
        await mkdir(shotDir, { recursive: true });
        let rep: PageReport;
        try {
          rep = await measure(ctx, origin, link, vp, shotDir);
        } catch (e) {
          rep = {
            lead: link.leadSlug, leadName: link.leadName, style: link.style, vp: vp.id, path: link.path,
            first: null as unknown as FirstScreen, pill: { found: false } as HitProbe, pillAppearedMs: null,
            why: { opened: false, block: { found: false } as HitProbe, privacy: { found: false } as HitProbe, unsub: { found: false } as HitProbe },
            consentHeightPct: null, bottom: null as unknown as BottomProbe, panel: null as unknown as PanelProbe,
            weight: { requests: 0, bytes: { document: 0, image: 0, script: 0, stylesheet: 0, font: 0, other: 0, total: 0 }, images: [], failed: [] },
            jsErrors: [], httpErrors: [], shots: [], flags: [{ level: "HIBA", what: `a mérés elszállt: ${(e as Error).message.slice(0, 200)}` }],
          };
        }
        await ctx.close();
        reports.push(rep);
        const worst = rep.flags.find((f) => f.level === "HIBA") ? "HIBA" : rep.flags.length ? rep.flags[0]!.level : "ok";
        console.log(
          `${vp.id.padEnd(4)} ${link.leadSlug.padEnd(7)} ${link.style.padEnd(15)} ${String(rep.flags.length).padStart(2)} lelet ${worst.padEnd(9)} ` +
            (rep.weight ? `${fmtKB(rep.weight.bytes.total).padStart(8)} · ${rep.weight.images.length} kép` : ""),
        );
      }
    }
    // ④ the two style-independent pages of the lead's way out — once per viewport.
    // ⛔ A GET ON /unsubscribe OPTS THE PROSPECT OUT (the mail's one-click link), so
    // this is done on the LAST link only, AFTER its own measurements, and the row is
    // lifted again through the product's own resubscribeProspect (logged, not a
    // silent SQL flip). The ordering is the safety: the unsubscribed page is served
    // to that token until the lift runs.
    const unsubLink = links[links.length - 1]!;
    for (const vp of vps) {
      const link = unsubLink;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true, userAgent: vp.ua, locale: "hu-HU",
      });
      const dir = path.join(DRAFTS, "shots", "_kozos");
      await mkdir(dir, { recursive: true });
      for (const [name, route] of [["unsub", `${link.path}/unsubscribe`], ["privacy", "/privacy"]] as const) {
        const page = await ctx.newPage();
        const errs: string[] = [];
        page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
        try {
          const res = await page.goto(origin + route, { waitUntil: "load", timeout: 30_000 });
          await page.waitForTimeout(400);
          const probe = (await page.evaluate(`(() => { const de = document.documentElement; const vw = innerWidth;
            const btn = [...document.querySelectorAll("button, input[type=submit], a")].map(b => ({ t: (b.textContent || b.value || "").trim().slice(0, 40), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })).filter(b => b.t);
            return { status: 0, hOverflowPx: Math.max(0, Math.max(de.scrollWidth, document.body.scrollWidth) - vw), fontPx: parseFloat(getComputedStyle(document.body).fontSize), h1: (document.querySelector("h1,h2") || {}).textContent || "", controls: btn.slice(0, 8), scrollHeight: de.scrollHeight }; })()`)) as Record<string, unknown>;
          probe.status = res?.status() ?? 0;
          const f = path.join(dir, `${vp.id}-${name}.png`);
          await page.screenshot({ path: f, fullPage: false });
          extras.push({ vp: vp.id, name, route, probe, jsErrors: errs, shot: path.relative(DRAFTS, f) });
        } catch (e) {
          extras.push({ vp: vp.id, name, route, probe: { error: (e as Error).message.slice(0, 200) }, jsErrors: errs, shot: "" });
        }
        await page.close();
      }
      await ctx.close();
    }
    await liftUnsubscribe(unsubLink.token);
  } finally {
    await browser.close();
  }
  await mkdir(DRAFTS, { recursive: true });
  await writeFile(path.join(DRAFTS, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), reports, extras }, null, 1));
  await writeFile(path.join(DRAFTS, "REPORT.md"), renderMd(reports, Date.now() - started) + renderExtras(extras));
  const hiba = reports.reduce((n, r) => n + r.flags.filter((f) => f.level === "HIBA").length, 0);
  console.log(`\n${reports.length} mérés · HIBA-lelet ${hiba} · riport: ${path.relative(ROOT, path.join(DRAFTS, "REPORT.md"))}`);
  process.exit(0);
}

function renderExtras(extras: { vp: string; name: string; route: string; probe: Record<string, unknown>; jsErrors: string[]; shot: string }[]): string {
  const lines = ["\n## Leiratkozás + adatvédelem (stílus-független, nézetenként)\n", "| nézet | lap | HTTP | túlfolyás | betű px | cím | vezérlők | JS-hiba | kép |", "|---|---|---|---|---|---|---|---|---|"];
  for (const e of extras) {
    const p = e.probe as { status?: number; hOverflowPx?: number; fontPx?: number; h1?: string; controls?: { t: string; h: number; w: number }[]; error?: string };
    lines.push(`| ${e.vp} | ${e.name} | ${p.status ?? "?"} | ${p.hOverflowPx ?? "?"} | ${p.fontPx ?? "?"} | ${(p.h1 ?? p.error ?? "").toString().trim().slice(0, 50)} | ${(p.controls ?? []).map((c) => `${c.t} ${c.w}×${c.h}`).join("; ").slice(0, 160)} | ${e.jsErrors.length} | ${e.shot} |`);
  }
  return lines.join("\n") + "\n";
}

function renderMd(reports: PageReport[], ms: number): string {
  const lines: string[] = [];
  lines.push(`# Lead-mobil mérés — ${reports.length} lap-nézet (${Math.round(ms / 1000)} s)\n`);
  // common (wrapper-layer) findings: same text on ≥ 60 % of pages
  const byWhat = new Map<string, number>();
  for (const r of reports) for (const f of r.flags) byWhat.set(`${f.level} · ${f.what.replace(/\d+/g, "N")}`, (byWhat.get(`${f.level} · ${f.what.replace(/\d+/g, "N")}`) ?? 0) + 1);
  const common = [...byWhat.entries()].filter(([, n]) => n >= reports.length * 0.6).sort((a, b) => b[1] - a[1]);
  lines.push(`## Közös (a keret rétege — ${reports.length} lap-nézetből ≥ 60 %-on)\n`);
  for (const [w, n] of common) lines.push(`- ${w} — ${n}×`);
  if (!common.length) lines.push("- (nincs közös lelet)");
  lines.push(`\n## Laponként\n`);
  lines.push(`| nézet | lead | stílus | túlfolyás | sáv px | név a hajtás felett | fotó | pirula | süti % | lábléc-linkek | konfig | súly | képek (lazy) | JS-hiba | leletek |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of reports) {
    const f = r.first;
    const fl = r.flags.map((x) => `**${x.level}** ${x.what}`).join("<br>");
    const pill = r.pill.found ? (r.pill.inViewport ? (r.pill.hitSelf ? "ok" : `takart: ${r.pill.hitBy}`) : "kívül") : "nincs";
    const foot = r.bottom ? `${r.bottom.privacy.hitSelf ? "✓" : "✗"}/${r.bottom.unsub.hitSelf ? "✓" : "✗"}` : "?";
    const cfg = r.panel ? (r.panel.open ? (r.panel.fitsViewport && r.panel.cta.hitSelf ? "ok" : "gond") : "nem nyílt") : "?";
    lines.push(
      `| ${r.vp} | ${r.lead} | ${r.style} | ${f ? f.hOverflowPx : "?"} | ${f?.banner ? Math.round(f.banner.height) : "—"} | ${f?.name ? (f.name.inViewport ? "igen" : `nem (${Math.round(f.name.top)})`) : "?"} | ${f?.heroPhoto ? (f.heroPhoto.loaded ? "van" : "TÖRÖTT") : "nincs"} | ${pill} | ${r.consentHeightPct ?? "—"} | ${foot} | ${cfg} | ${fmtKB(r.weight.bytes.total)} | ${f ? `${f.imgs.total} (${f.imgs.lazy})` : "?"} | ${r.jsErrors.length} | ${fl} |`,
    );
  }
  lines.push(`\n## Súly részletesen (390)\n`);
  lines.push(`| lead | stílus | összes | dokumentum | képek | szkript | css | betű | kérések | legnagyobb kép |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of reports.filter((x) => x.vp === "390")) {
    const b = r.weight.bytes;
    const big = r.weight.images[0];
    lines.push(`| ${r.lead} | ${r.style} | ${fmtKB(b.total)} | ${fmtKB(b.document)} | ${fmtKB(b.image)} | ${fmtKB(b.script)} | ${fmtKB(b.stylesheet)} | ${fmtKB(b.font)} | ${r.weight.requests} | ${big ? `${fmtKB(big.bytes)} ${big.url.slice(0, 60)}` : "—"} |`);
  }
  return lines.join("\n") + "\n";
}

// ═══════════════════════════════ ŐR-MÓD ═══════════════════════════════════════
//
// The same probes on FIXTURES instead of the dev DB's two leads, so the rules that
// came out of the 2026-09-26 measurement hold on every commit: the page as the
// console really serves it to a TRACKED visitor (renderSite → runtime → lazy →
// configurator → framing bar → legal footer → consent bar), served to the browser
// through a route interceptor (no server, no network, no DB lead). Five templates,
// each for a named reason (the framing guard's set + brutalism's marquee).
//
// RED SELF-TEST: each rule is broken on purpose in the served HTML, and the guard
// must go red on exactly that rule. A guard never seen red proves nothing.

const GATE_TEMPLATES: ReadonlyArray<[string, string]> = [
  ["fullbleed", "position:absolute nav + fixed booking bar under the footer"],
  ["aurora", "fixed decorative backdrop + body>*{position:relative}"],
  ["brutalism", "nowrap marquee — the page that widened the layout viewport"],
  ["dark-luxury", "dark skin; consent buttons wrapped here"],
  ["organic", "light skin, primary CTA under the consent bar"],
];
const GATE_ORIGIN = "http://lm-fixture.local";
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

type Sabotage = "none" | "no-clearance" | "no-tap" | "overflow" | "no-lazy" | "panel-under-consent";

async function gateFixture(tpl: string, sabotage: Sabotage): Promise<string> {
  const { renderSite } = await import("../src/engine/render.js");
  const { TEMPLATES } = await import("../src/engine/templates.js");
  const { injectRuntime } = await import("../src/generator/runtime.js");
  const { injectConfigurator } = await import("../src/generator/configurator.js");
  const pn = await import("../src/console/prospectNotice.js");
  const { injectConsent, markAudience } = await import("../src/server/consent.js");
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
  const recipe = { skin: TEMPLATES[tpl]!.skins[0]!, archetype: "stacked", template: tpl, sections: [] };
  const token = "hWAeKUweNOvCiAAMz6hlqUAA";
  let html = await injectRuntime(renderSite(recipe as never, data as never));
  if (sabotage !== "no-lazy") html = pn.lazyLoadBelowFold(html);
  html = await injectConfigurator(html, "00000000-0000-0000-0000-000000000000", data.name, {});
  html = pn.containHorizontalOverflow(html);
  html = pn.injectTrackingNotice(pn.injectTrackingBanner(pn.disableIntroAnimation(html), token), token);
  const res = {};
  markAudience(res, "own");
  html = injectConsent(html, res);
  if (sabotage === "no-clearance") html = html.replace(/padding-bottom:calc\(14px \+ var\(--citui-cfg-clear[^)]*\)\)\)?;?/g, "");
  if (sabotage === "no-tap") html = html.replace(/display:inline-block;padding:6px [28]px;/g, "");
  if (sabotage === "overflow") html = html.replace("</head>", "<style>body{min-width:120vw}</style></head>");
  if (sabotage === "panel-under-consent") html = html.replace(/height:\s*calc\(100% - var\(--citui-consent-h, 0px\)\);/, "height:100%;");
  return html;
}

async function gate(): Promise<void> {
  const selftest = args.includes("--selftest");
  const browser: Browser = await chromium.launch({ executablePath: chromiumExe() });
  const publicDir = path.join(ROOT, "public");
  let failures = 0;
  const check = (name: string, ok: boolean, detail?: unknown): void => {
    if (ok) console.log(`  ✓ ${name}`);
    else {
      failures++;
      console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail).slice(0, 300)}`}`);
    }
  };
  const gateDir = path.join(ROOT, "assets", "Temp", `_lead-mobile-gate-${path.basename(ROOT)}`);
  await mkdir(gateDir, { recursive: true });

  /** One page, one viewport, one sabotage → the rule verdicts. */
  async function run(tpl: string, vp: Viewport, sabotage: Sabotage): Promise<{ r: PageReport; rules: Record<string, boolean>; lazyOk: boolean }> {
    const html = await gateFixture(tpl, sabotage);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: vp.ua, locale: "hu-HU",
    });
    await ctx.route(`${GATE_ORIGIN}/**`, async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === `/${tpl}`) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      if (u.pathname.startsWith("/assets/")) {
        const f = path.join(publicDir, u.pathname.replace(/^\/+/, ""));
        if (!f.startsWith(publicDir)) return route.fulfill({ status: 403, body: "" });
        try {
          const body = await readFile(f);
          const ct = f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : f.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
          return route.fulfill({ status: 200, contentType: ct, body });
        } catch {
          return route.fulfill({ status: 404, body: "" });
        }
      }
      // beacons, privacy, anything else: an empty OK — nothing leaves the machine
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    });
    const link: Link = { leadId: "fixture", leadName: "ELEK-PRÓBA Vendégház", leadSlug: "fixture", style: tpl, token: "x", path: `/${tpl}`, envKey: "" };
    const shotDir = path.join(gateDir, `${tpl}-${sabotage}`);
    await mkdir(shotDir, { recursive: true });
    const r = await measure(ctx, GATE_ORIGIN, link, vp, shotDir);
    // R5 — lazy below the fold, read from the DOM the browser built
    const pg = await ctx.newPage();
    await pg.goto(`${GATE_ORIGIN}/${tpl}`, { waitUntil: "domcontentloaded" });
    const lazy = (await pg.evaluate(`(() => { const im = [...document.images]; return { total: im.length, lazyAfterTwo: im.slice(2).filter(i => i.loading === "lazy").length, after: im.slice(2).length }; })()`)) as { total: number; lazyAfterTwo: number; after: number };
    await pg.close();
    await ctx.close();
    const rules = {
      R1_no_overflow: r.first.hOverflowPx <= 2 && r.first.vw === vp.width,
      R2_footer_links_tappable: r.bottom.privacy.found && r.bottom.privacy.inViewport && r.bottom.privacy.hitSelf && r.bottom.unsub.found && r.bottom.unsub.inViewport && r.bottom.unsub.hitSelf,
      R3_tap_targets: [r.bottom.privacy, r.bottom.unsub, r.why.privacy, r.why.unsub].every((h) => h.rect != null && h.rect.height >= 24),
      R4_pill_and_panel: r.pill.found && r.pill.inViewport && r.pill.hitSelf && r.panel.open && r.panel.fitsViewport && r.panel.cta.found && r.panel.cta.inViewport && r.panel.cta.hitSelf,
      R6_no_js_errors: r.jsErrors.length === 0,
    };
    return { r, rules, lazyOk: lazy.after === 0 || lazy.lazyAfterTwo === lazy.after };
  }

  try {
    const vps = VIEWPORTS.filter((v) => v.id === "390" || v.id === "land");
    console.log(`\nŐR — a kiküldött lap telefonon (${GATE_TEMPLATES.length} sablon × ${vps.map((v) => v.id).join("/")})`);
    for (const [tpl, why] of GATE_TEMPLATES) {
      for (const vp of vps) {
        const { r, rules, lazyOk } = await run(tpl, vp, "none");
        console.log(`\n${tpl} @ ${vp.id} — ${why}`);
        for (const [k, ok] of Object.entries(rules)) check(k, ok, ok ? undefined : r.flags.map((f) => f.what));
        check("R5_lazy_below_fold", lazyOk);
      }
    }
    if (selftest) {
      console.log("\nPIROS ÖNTESZT — minden visszarontás a SAJÁT szabályát fordítsa pirosra (fullbleed @ 390)");
      const vp = VIEWPORTS[0]!;
      const cases: [Sabotage, string][] = [
        ["no-clearance", "R2_footer_links_tappable"],
        ["no-tap", "R3_tap_targets"],
        ["overflow", "R1_no_overflow"],
        ["no-lazy", "R5_lazy_below_fold"],
      ];
      // …and the landscape-only one: the side panel's decision block under the consent bar
      cases.push(["panel-under-consent", "R4_pill_and_panel"]);
      for (const [sab, rule] of cases) {
        const { rules, lazyOk } = await run("fullbleed", sab === "panel-under-consent" ? VIEWPORTS[2]! : vp, sab);
        const verdict = rule === "R5_lazy_below_fold" ? lazyOk : (rules as Record<string, boolean>)[rule]!;
        check(`visszarontás „${sab}" → ${rule} PIROS`, verdict === false);
        // …and only that one: a sabotage that also breaks unrelated rules would hide what is measured
        const others = Object.entries(rules).filter(([k]) => k !== rule && k !== "R6_no_js_errors");
        check(`visszarontás „${sab}" a többi szabályt békén hagyja`, others.every(([, ok]) => ok), others.filter(([, ok]) => !ok).map(([k]) => k));
      }
    }
  } finally {
    await browser.close();
  }
  console.log(failures ? `\n✗ lead-mobile-check: ${failures} bukás` : "\n✓ lead-mobile-check: minden szabály zöld");
  process.exit(failures ? 1 : 0);
}

if (args.includes("--gate")) await gate();
else await main();
