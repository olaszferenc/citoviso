// The Citoviso mark and lockup — the ONE place our own surfaces get the logo from
// (ADR-0236). Before this, three hand-drawn inline SVGs (console, tenant admin, the
// homepage) and a fourth file (the favicon) showed four different marks.
//
// The geometry is NOT redrawn here: it is read from the owner-approved E4 asset files
// (assets/brand/mark-e4-{dark,light}.svg, contract: assets/design-refs/console/brand-mark/
// README.md). Dark surface → the dark variant (light eye, white play); light surface →
// the light variant (navy→cyan eye, cyan play). The browser tab is light, so the favicon
// is the light variant.
//
// The lockup is "B" (owner, 2026-09-26): the mark IS the letter C, followed by the word
// "itoviso"; the mark is 1.6× the letter size and the word is centred on it — the ratio
// the /pay/* header was approved at (34 px mark / 21 px word). Its CSS lives in the
// design core (citui.css `.citui-lockup`).
import { readFileSync } from "node:fs";
import path from "node:path";

export type MarkVariant = "dark" | "light";

const SRC: Record<MarkVariant, string> = {
  dark: readAsset("dark"),
  light: readAsset("light"),
};

function readAsset(v: MarkVariant): string {
  return readFileSync(path.resolve(process.cwd(), `assets/brand/mark-e4-${v}.svg`), "utf8");
}

/** The approved file as a standalone SVG document (favicon, data: URI). */
export function markFile(v: MarkVariant): string {
  return SRC[v];
}

/** The favicon: the LIGHT variant — the browser tab is light, the dark variant's white
 *  play vanishes on it. */
export function faviconSvg(): string {
  return SRC.light;
}

export function markDataUri(v: MarkVariant): string {
  return `data:image/svg+xml;base64,${Buffer.from(SRC[v]).toString("base64")}`;
}

// Every inline copy gets its own gradient id: an SVG gradient referenced from a
// `display:none` copy (the other theme's mark, a closed drawer) does not paint in
// Chrome, so two copies sharing one id would leave the visible eye empty.
let seq = 0;

/**
 * The mark inline, cropped to the drawing, so the element's height IS the height of the C.
 * The arc's centre is NOT the box centre: through (84.6, 29.3)/(84.6, 90.7) with r=42 it
 * sits at x≈55.94, so with the 6-unit half stroke the C spans x 7.94..90.6 and y 12..108;
 * the play tip reaches x=102. (A 12..106 crop cut the left of the C flat — seen on the
 * 1806 px invoice render, 2026-09-26.)
 */
export const MARK_VIEWBOX = "7.5 12 95 96";
export function markSvg(v: MarkVariant, cls = "", size?: number): string {
  const id = `cit-eye-${v}-${++seq}`;
  const dims = size ? ` width="${Math.round((size * 95) / 96)}" height="${size}"` : "";
  return SRC[v]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .trim()
    .replace(/ xmlns="[^"]+"/, "")
    .replace(/ role="img" aria-label="[^"]*"/, ` aria-hidden="true" focusable="false"${cls ? ` class="${cls}"` : ""}${dims}`)
    .replace('viewBox="0 0 120 120"', `viewBox="${MARK_VIEWBOX}"`)
    .replace(/cit-eye-(dark|light)(?!-\d)/g, id);
}

/** A mark that follows the page theme (`data-citui-theme`): both variants in the
 *  markup, the design core shows the one for the current theme. */
export function markThemed(size: number): string {
  return (
    `<span class="citui-mark-themed" style="--citui-mark-size:${size}px">` +
    markSvg("light", "citui-mark--light") +
    markSvg("dark", "citui-mark--dark") +
    `</span>`
  );
}

export interface LockupOpts {
  /** The surface under it: "dark" | "light", or "themed" to follow data-citui-theme. */
  readonly on: MarkVariant | "themed";
  /** Anything after "itoviso" in the same word run (e.g. " konzol"). Already escaped. */
  readonly suffix?: string;
  /** A second line under the word (e.g. "belső konzol"). Already escaped. */
  readonly sub?: string;
  /** Wrap it in a link. */
  readonly href?: string;
  readonly cls?: string;
}

/** The "B" lockup: the mark as the C + "itoviso". Accessible name: "Citoviso". */
export function lockup(o: LockupOpts): string {
  const marks =
    o.on === "themed"
      ? markSvg("light", "citui-lockup__mark citui-mark--light") + markSvg("dark", "citui-lockup__mark citui-mark--dark")
      : markSvg(o.on, "citui-lockup__mark");
  const word =
    `<span class="citui-lockup__word">itoviso${o.suffix ?? ""}` +
    (o.sub ? `<small>${o.sub}</small>` : "") +
    `</span>`;
  const cls = `citui-lockup citui-lockup--on-${o.on}${o.cls ? ` ${o.cls}` : ""}`;
  const inner = `<span class="citui-sr">Citoviso${o.suffix ?? ""}${o.sub ? ` — ${o.sub}` : ""}</span><span aria-hidden="true" class="citui-lockup__row">${marks}${word}</span>`;
  return o.href
    ? `<a class="${cls}" href="${o.href}">${inner}</a>`
    : `<span class="${cls}">${inner}</span>`;
}

/**
 * The homepage hero illustration: the big mark on the CYAN sphere (`.visual-core`).
 * Same E4 geometry (owner, 2026-09-26: "igen javítsd" — the old drawing had the play
 * inside the C), recoloured for the one surface where the brand cyan is the BACKGROUND:
 * a cyan arc and a cyan play would vanish into it, so the arc is white and the play navy;
 * the eye is the light variant's (navy→cyan sphere with its highlight).
 */
export function heroMarkSvg(): string {
  // The full 120 box, not the tight crop: in the 128 px slot that keeps the C at the
  // old drawing's ~102 px, with the sphere's breathing room around it.
  return markSvg("light")
    .replace(`viewBox="${MARK_VIEWBOX}"`, 'viewBox="0 0 120 120"')
    .replace('stroke="#1fb6d6"', 'stroke="#ffffff"')
    .replace(/(<path d="M82 49 L82 71 L102 60 Z" fill=")#1fb6d6"/, '$1#0e2a47"');
}
