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
