// Language flags as INLINE SVG (§B design doctrine: own icon set, never emoji —
// an emoji flag also renders differently on every OS and is missing on Windows).
//
// Deliberately SIMPLIFIED: at 20×14 px a flag is a recognition cue, not a coat of
// arms. Stripes and the few crosses that carry the identity; nothing that turns
// into mud at this size. The rounded clip keeps them from looking like raw blocks.

const FLAGS: Readonly<Record<string, string>> = {
  hu: '<rect width="20" height="4.67" fill="#ce2939"/><rect y="4.67" width="20" height="4.66" fill="#fff"/><rect y="9.33" width="20" height="4.67" fill="#477050"/>',
  de: '<rect width="20" height="4.67"/><rect y="4.67" width="20" height="4.66" fill="#dd0000"/><rect y="9.33" width="20" height="4.67" fill="#ffce00"/>',
  it: '<rect width="6.67" height="14" fill="#008c45"/><rect x="6.67" width="6.66" height="14" fill="#fff"/><rect x="13.33" width="6.67" height="14" fill="#cd212a"/>',
  pl: '<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#dc143c"/>',
  sk: '<rect width="20" height="4.67" fill="#fff"/><rect y="4.67" width="20" height="4.66" fill="#0b4ea2"/><rect y="9.33" width="20" height="4.67" fill="#ee1c25"/>',
  cs: '<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#d7141a"/><path d="M0 0l9 7-9 7z" fill="#11457e"/>',
  ro: '<rect width="6.67" height="14" fill="#002b7f"/><rect x="6.67" width="6.66" height="14" fill="#fcd116"/><rect x="13.33" width="6.67" height="14" fill="#ce1126"/>',
  hr: '<rect width="20" height="4.67" fill="#ff0000"/><rect y="4.67" width="20" height="4.66" fill="#fff"/><rect y="9.33" width="20" height="4.67" fill="#171796"/>',
  sl: '<rect width="20" height="4.67" fill="#fff"/><rect y="4.67" width="20" height="4.66" fill="#0000c6"/><rect y="9.33" width="20" height="4.67" fill="#d50000"/>',
  // English → the Union Jack, reduced to its two crosses (the diagonals read as
  // noise below ~24px, so they are dropped rather than smeared).
  en: '<rect width="20" height="14" fill="#012169"/><path d="M0 5.2h20v3.6H0z" fill="#fff"/><path d="M8.2 0h3.6v14H8.2z" fill="#fff"/><path d="M0 6h20v2H0z" fill="#c8102e"/><path d="M9 0h2v14H9z" fill="#c8102e"/>',

  // ── ADR-0128: the 19 languages that joined the sellable set ──────────────────
  // Same simplification rule as above. Skipping any of these is not cosmetic:
  // flagSvg() returns "" for an unknown code, so the guest-facing switcher would
  // show a bare name where every other language has a flag.
  bg: '<rect width="20" height="4.67" fill="#fff"/><rect y="4.67" width="20" height="4.66" fill="#00966e"/><rect y="9.33" width="20" height="4.67" fill="#d62612"/>',
  nl: '<rect width="20" height="4.67" fill="#ae1c28"/><rect y="4.67" width="20" height="4.66" fill="#fff"/><rect y="9.33" width="20" height="4.67" fill="#21468b"/>',
  et: '<rect width="20" height="4.67" fill="#0072ce"/><rect y="4.67" width="20" height="4.66"/><rect y="9.33" width="20" height="4.67" fill="#fff"/>',
  fr: '<rect width="6.67" height="14" fill="#002395"/><rect x="6.67" width="6.66" height="14" fill="#fff"/><rect x="13.33" width="6.67" height="14" fill="#ed2939"/>',
  ga: '<rect width="6.67" height="14" fill="#169b62"/><rect x="6.67" width="6.66" height="14" fill="#fff"/><rect x="13.33" width="6.67" height="14" fill="#ff883e"/>',
  lt: '<rect width="20" height="4.67" fill="#fdb913"/><rect y="4.67" width="20" height="4.66" fill="#006a44"/><rect y="9.33" width="20" height="4.67" fill="#c1272d"/>',
  sr: '<rect width="20" height="4.67" fill="#c6363c"/><rect y="4.67" width="20" height="4.66" fill="#0c4076"/><rect y="9.33" width="20" height="4.67" fill="#fff"/>',
  ru: '<rect width="20" height="4.67" fill="#fff"/><rect y="4.67" width="20" height="4.66" fill="#0039a6"/><rect y="9.33" width="20" height="4.67" fill="#d52b1e"/>',
  uk: '<rect width="20" height="7" fill="#0057b7"/><rect y="7" width="20" height="7" fill="#ffd700"/>',
  mt: '<rect width="10" height="14" fill="#fff"/><rect x="10" width="10" height="14" fill="#cf142b"/>',
  lv: '<rect width="20" height="14" fill="#9e3039"/><rect y="5.6" width="20" height="2.8" fill="#fff"/>',
  es: '<rect width="20" height="14" fill="#aa151b"/><rect y="3.5" width="20" height="7" fill="#f1bf00"/>',
  // Nordic crosses — the bar is offset to the hoist, as on the real flags.
  da: '<rect width="20" height="14" fill="#c8102e"/><rect x="5.6" width="2.6" height="14" fill="#fff"/><rect y="5.7" width="20" height="2.6" fill="#fff"/>',
  fi: '<rect width="20" height="14" fill="#fff"/><rect x="5.6" width="2.6" height="14" fill="#003580"/><rect y="5.7" width="20" height="2.6" fill="#003580"/>',
  sv: '<rect width="20" height="14" fill="#006aa7"/><rect x="5.6" width="2.6" height="14" fill="#fecc00"/><rect y="5.7" width="20" height="2.6" fill="#fecc00"/>',
  // Norway: a blue cross with a white border — two crosses stacked.
  no: '<rect width="20" height="14" fill="#ba0c2f"/><rect x="4.9" width="4.4" height="14" fill="#fff"/><rect y="4.8" width="20" height="4.4" fill="#fff"/><rect x="6" width="2.2" height="14" fill="#00205b"/><rect y="5.9" width="20" height="2.2" fill="#00205b"/>',
  // Portugal: the green/red split plus the armillary spot on the seam — without
  // that dot it reads as a generic bicolour.
  pt: '<rect width="8" height="14" fill="#006600"/><rect x="8" width="12" height="14" fill="#f00"/><circle cx="8" cy="7" r="2.5" fill="#fc0"/>',
  // Greece: nine stripes turn to mud at 14px, so four white bars carry the field
  // and the canton keeps the cross — those two are what make it Greek.
  el: '<rect width="20" height="14" fill="#0d5eaf"/><rect y="1.56" width="20" height="1.56" fill="#fff"/><rect y="4.67" width="20" height="1.56" fill="#fff"/><rect y="7.78" width="20" height="1.56" fill="#fff"/><rect y="10.89" width="20" height="1.56" fill="#fff"/><rect width="7.78" height="7.78" fill="#0d5eaf"/><rect x="3.11" width="1.56" height="7.78" fill="#fff"/><rect y="3.11" width="7.78" height="1.56" fill="#fff"/>',
  // Turkey: the crescent is the difference of two discs; the star is a small
  // wedge — anything more detailed is a smudge at this size.
  tr: '<rect width="20" height="14" fill="#e30a17"/><circle cx="8" cy="7" r="3.3" fill="#fff"/><circle cx="9.4" cy="7" r="2.7" fill="#e30a17"/><path d="M13.6 7l1.1-1.5v3z" fill="#fff"/>',
};

/** Inline SVG flag for a language code; empty string when we have no flag. */
export function flagSvg(lang: string, size = 20): string {
  const body = FLAGS[lang];
  if (!body) return "";
  const h = Math.round((size * 14) / 20);
  return (
    `<svg width="${size}" height="${h}" viewBox="0 0 20 14" aria-hidden="true" ` +
    `style="display:block;border-radius:2px;flex:0 0 auto">${body}</svg>`
  );
}
