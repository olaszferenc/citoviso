// QA airiness audit (measurement, ADR-0011 QA-gate). Quantifies "dead" vertical
// space per section — the soft airiness left after the reveal fix (MEMORY 2026-07-11/12).
// For each full-width band we measure rendered height vs. the vertical extent
// actually occupied by ink (text runs + images + buttons); the shortfall is the
// dead band (top gap + bottom gap + largest internal gap). Pure geometry from a
// real headless render — no fabrication. Used by scripts/qa-airiness.ts (CLI) and
// wired best-effort into generateMock as a non-blocking quality metric.

import { chromium } from "playwright-core";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.js";

export interface SectionBand {
  tag: string;
  cls: string;
  height: number;
  topGap: number;
  bottomGap: number;
  maxInnerGap: number;
  dead: number;
  fill: number;
}

export interface WidthReport {
  width: number;
  docHeight: number;
  vh: number;
  totalDead: number;
  deadPct: number; // totalDead / docHeight * 100
  sections: SectionBand[];
}

export interface AirinessReport {
  widths: WidthReport[];
  /** Worst (highest) dead-space percentage across the measured widths. */
  worstDeadPct: number;
}

// Passed to page.evaluate as a STRING so tsx/esbuild's `__name` name-helper is
// not injected into the browser context (it is undefined there → ReferenceError).
const AUDIT = `(() => {
  const vw = document.documentElement.clientWidth;
  const isBand = (el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 120 || r.width < vw * 0.82) return false;
    const t = el.tagName;
    if (t === "SCRIPT" || t === "STYLE" || t === "NOSCRIPT" || t === "HEAD") return false;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.position === "sticky") return false;
    if (el.closest("[aria-hidden='true'],[hidden]")) return false;
    return true;
  };
  const bandKids = (el) => Array.from(el.children).filter(isBand);
  let host = document.body, best = bandKids(document.body).length;
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const n = bandKids(el).length;
    if (n > best) { best = n; host = el; }
  }
  const sectionsEls = best >= 2 ? bandKids(host) : Array.from(document.body.children).filter(isBand);

  const isInk = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return false;
    const tag = el.tagName;
    if (tag === "IMG" || tag === "SVG" || tag === "VIDEO" || tag === "INPUT") return el.children.length === 0;
    if (tag === "A" || tag === "BUTTON") return true;
    return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0);
  };

  const out = [];
  for (const sec of sectionsEls) {
    const sr = sec.getBoundingClientRect();
    if (sr.height < 40) continue;
    const inks = Array.from(sec.querySelectorAll("*"))
      .filter(isInk).map((e) => e.getBoundingClientRect())
      .filter((r) => r.height > 0).sort((a, b) => a.top - b.top);
    const base = { tag: sec.tagName.toLowerCase(), cls: (sec.getAttribute("class") || "").slice(0, 30), height: Math.round(sr.height) };
    if (!inks.length) { out.push({ ...base, topGap: base.height, bottomGap: 0, maxInnerGap: 0, dead: base.height, fill: 0 }); continue; }
    const top = Math.min(...inks.map((r) => r.top));
    const bottom = Math.max(...inks.map((r) => r.bottom));
    let coverEnd = inks[0].bottom, maxGap = 0;
    for (const r of inks) { if (r.top > coverEnd) maxGap = Math.max(maxGap, r.top - coverEnd); coverEnd = Math.max(coverEnd, r.bottom); }
    const topGap = Math.max(0, top - sr.top), bottomGap = Math.max(0, sr.bottom - bottom);
    out.push({ ...base, topGap: Math.round(topGap), bottomGap: Math.round(bottomGap), maxInnerGap: Math.round(maxGap), dead: Math.round(topGap + bottomGap + maxGap), fill: +((bottom - top) / sr.height).toFixed(2) });
  }
  return { out, docHeight: document.documentElement.scrollHeight, vh: window.innerHeight };
})()`;

/**
 * Audit a mock's vertical rhythm. `target` is a file path OR a raw HTML string
 * (detected by a leading `<`). Returns per-width dead-space metrics.
 */
export async function auditAiriness(
  target: string,
  opts: { widths?: number[] } = {},
): Promise<AirinessReport> {
  const widths = opts.widths ?? [390, 1280];
  const isHtml = /^\s*</.test(target);
  const url = isHtml ? null : pathToFileURL(path.resolve(target)).href;

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    const reports: WidthReport[] = [];
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      try {
        if (url) await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
        else await page.setContent(target, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(400);
        const res = (await page.evaluate(AUDIT)) as {
          out: SectionBand[];
          docHeight: number;
          vh: number;
        };
        const totalDead = res.out.reduce((s, b) => s + b.dead, 0);
        reports.push({
          width,
          docHeight: res.docHeight,
          vh: res.vh,
          totalDead,
          deadPct: res.docHeight ? +((totalDead / res.docHeight) * 100).toFixed(1) : 0,
          sections: res.out,
        });
      } finally {
        await page.close();
      }
    }
    const worstDeadPct = reports.reduce((m, r) => Math.max(m, r.deadPct), 0);
    return { widths: reports, worstDeadPct };
  } finally {
    await browser.close();
  }
}
