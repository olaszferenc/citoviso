// Photo-derived per-property accent (§B.6). The AI brief (generator/brief.ts) samples a
// palette from the property's OWN photos; historically the engine dropped it, so every
// property on the same skin got a byte-identical accent — the last structural "all the same"
// gap. This module harmonizes the photo accent INTO the chosen skin's safe rails: it keeps
// the photo's HUE (a lakeside blue, a wine-cellar red) but retargets its LIGHTNESS to match
// the skin accent's relative luminance, so the skin's contrast guarantees (readable on
// --cit-on-accent, light/dark character) never break. A dark-luxury skin stays dark; only
// the hue shifts per property. Fully deterministic → the live re-render (convertLead)
// reproduces the same accent (mock=live).

/** Parse #rgb / #rrggbb → [r,g,b] in 0..255, or null if not a valid hex color. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0..1) of an sRGB color. Hue-aware, unlike HSL lightness. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two sRGB colors. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

const MIN_SAT = 0.4; // keep the accent vivid even if the photo is muted
const MAX_SAT = 0.92;
const MIN_CONTRAST = 3.0; // WCAG AA for large UI elements / non-text accents

/**
 * Harmonize a photo-derived accent into a skin's safe rails: keep the derived HUE (+ a vivid
 * saturation), but binary-search its LIGHTNESS so its relative luminance matches the skin
 * accent's — inheriting the skin's hand-tuned contrast against --cit-on-accent. Returns the
 * skin accent unchanged if the derived color is invalid or the result still fails contrast.
 */
export function harmonizeAccent(
  derivedHex: string,
  skinAccentHex: string,
  onAccentHex: string,
): string {
  const derived = parseHex(derivedHex);
  const skinAccent = parseHex(skinAccentHex);
  const onAccent = parseHex(onAccentHex);
  if (!derived || !skinAccent || !onAccent) return skinAccentHex;

  const [h, s0] = rgbToHsl(derived);
  const s = Math.max(MIN_SAT, Math.min(MAX_SAT, s0));
  const targetLum = relativeLuminance(skinAccent);

  // Binary-search HSL lightness so the resulting luminance ≈ the skin accent's (monotonic in L).
  let lo = 0,
    hi = 1,
    rgb: [number, number, number] = skinAccent;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    rgb = hslToRgb(h, s, mid);
    if (relativeLuminance(rgb) < targetLum) lo = mid;
    else hi = mid;
  }

  // Safety net: if the hue shift still costs readable contrast, keep the skin's own accent.
  if (contrastRatio(rgb, onAccent) < MIN_CONTRAST) return skinAccentHex;
  return toHex(rgb[0], rgb[1], rgb[2]);
}

/** CSS `color-mix(in srgb, a p%, b)`: the gamma-encoded channels interpolated (what the browser paints). */
export function mixSrgb(a: [number, number, number], b: [number, number, number], pa: number): [number, number, number] {
  return [0, 1, 2].map((i) => a[i]! * pa + b[i]! * (1 - pa)) as [number, number, number];
}

/** WCAG AA for body text — every text on a coloured band (ADR-0500 ⑦). */
export const TEXT_MIN_CONTRAST = 4.5;

/**
 * The colour `fg` made readable on `bg` (≥ `min`), keeping its hue: mixed step by step towards black on a light
 * ground, towards white on a dark one — never swapped for a fixed colour. Unchanged when it already reads.
 */
export function readableOn(fgHex: string, bgHex: string, min = TEXT_MIN_CONTRAST): string {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return fgHex;
  if (contrastRatio(fg, bg) >= min) return toHex(fg[0], fg[1], fg[2]);
  const toward: [number, number, number] = relativeLuminance(bg) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.04; t <= 1.0001; t += 0.04) {
    const hex = toHex(...mixSrgb(toward, fg, t));
    // judged on the ROUNDED colour — the one the page paints
    if (contrastRatio(parseHex(hex)!, bg) >= min) return hex;
  }
  return toHex(toward[0], toward[1], toward[2]);
}

/**
 * THE BAND TOKENS (ADR-0500 ⑦, quality colleague 11-27: Jaja's „4,8 ★ Google-értékelés” light grey and Hullám's name
 * gold on the beige bottom bar). A template's „ink band” (`color-mix(ink 92–94%, black)`) is dark on a light skin and
 * LIGHT on a dark one (night-azure-gold: ink #f2ede2), but its text was always „bg mixed with white” and „accent mixed
 * with white” — light on light. Here the band and its texts are computed from the page's resolved tokens, each text
 * ≥ 4.5:1 on BOTH band shades (92 % and 94 %).
 */
export function bandTokens(tokens: Readonly<Record<string, string>>): Record<string, string> {
  const ink = parseHex(tokens["--cit-ink"] ?? "");
  const bg = parseHex(tokens["--cit-bg"] ?? "");
  const accent = parseHex(tokens["--cit-accent"] ?? "");
  if (!ink || !bg || !accent) return {};
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  const band = mixSrgb(ink, black, 0.92);
  const band2 = mixSrgb(ink, black, 0.94);
  const hex = (c: [number, number, number]) => toHex(c[0], c[1], c[2]);
  const onBoth = (fg: [number, number, number]) => readableOn(readableOn(hex(fg), hex(band)), hex(band2));
  const on = onBoth(mixSrgb(bg, white, 0.92));
  const onRgb = parseHex(on)!;
  return {
    "--cit-band": hex(band),
    "--cit-on-band": on,
    // the quieter line (labels, notes, links, the footer): the text half-way to the band, still ≥ 4.5:1
    "--cit-on-band-soft": onBoth(mixSrgb(onRgb, band, 0.72)),
    "--cit-accent-on-band": onBoth(mixSrgb(accent, white, 0.6)),
    // an accent-coloured LABEL on the page itself (the „Minta” pill of a sample section: 3.45:1 measured 11-27) —
    // the accent tinted towards the ink, readable on the page ground and on its cards
    "--cit-accent-text": readableOn(readableOn(hex(mixSrgb(accent, ink, 0.7)), hex(bg)), tokens["--cit-surface"] ?? hex(bg)),
  };
}
