/**
 * srcset candidates, parsed the way the HTML standard does: a candidate's URL is a run of
 * NON-WHITESPACE that may itself contain commas; a comma separates candidates only after
 * the URL (trailing comma) or after its descriptor. Splitting on every comma cut Wix URLs
 * („…/v1/fit/w_480,h_480,q_90,enc_avif,quality_auto/<file> 480w”) into pieces, and the last
 * piece resolved to a dead „<host>/quality_auto/<file>” (2026-10-26: 77 photos on 8 leads —
 * Manduláskert, Gyógynövények Völgye, LUX, Fordan, Baladise, Arborétum, Gabi, Vigánd).
 */
export function parseSrcset(srcset: string): { url: string; w: number }[] {
  const out: { url: string; w: number }[] = [];
  let i = 0;
  const n = srcset.length;
  const isSpace = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);
  while (i < n) {
    while (i < n && (isSpace(srcset[i]) || srcset[i] === ",")) i++;
    if (i >= n) break;
    let j = i;
    while (j < n && !isSpace(srcset[j])) j++;
    let url = srcset.slice(i, j);
    i = j;
    let descriptor = "";
    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
    } else {
      let k = i;
      while (k < n && srcset[k] !== ",") k++;
      descriptor = srcset.slice(i, k).trim();
      i = k + 1;
    }
    if (!url) continue;
    const w = Number(descriptor.split(/\s+/)[0]?.replace(/[wx]$/i, "")) || 0;
    out.push({ url, w });
  }
  return out;
}

/** The largest candidate of a srcset („a.jpg 480w, b.jpg 1200w” → b.jpg). */
export function largestFromSrcset(srcset: string): string | undefined {
  let best: { url: string; w: number } | undefined;
  for (const c of parseSrcset(srcset)) if (!best || c.w > best.w) best = c;
  return best?.url;
}

/**
 * A dead piece of a comma-cut Wix srcset, resolved against the page („<host>/quality_auto/<file>”,
 * „<x>.wixsite.com/mysite/quality_auto/<file>”). parseSrcset no longer makes them, but rows read
 * before 2026-10-26 keep them: a re-pull of the homepage adds a NEW profile and leaves the old
 * /galeria, /szobaink profiles in place (Gyógynövények Völgye, Manduláskert, Fordan, LUX —
 * 13 dead URLs after the deploy). A live Wix transform URL always carries „/v1/” before it.
 */
export function isCutSrcsetUrl(url: string): boolean {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  return /\/quality_auto\//i.test(path) && !/\/v1\//i.test(path);
}
