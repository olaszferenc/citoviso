// TEXT REPETITION between two lines of a page (owner 2026-11-26, Monos Apartman: the „Nálunk” heading, its intro
// and the photo band said „a Fő téren szállhat meg” three times in a row; the quality colleagues failed this all
// day as „címsor-ismétlés”). Pure, locale-light: content stems (≥3 letters, no function words, first 5 letters),
// proper names stripped first (the lodging's and the town's name repeat legitimately). Two lines REPEAT each
// other when half of the shorter line's stems reappear in the other, or they share a run of four words.
const FUNCTION_WORDS = new Set([
  "ahol", "amely", "amelyben", "akik", "akinek", "hogy", "egy", "egyik", "mint", "pedig", "csak", "vagy", "valamint",
  "illetve", "között", "mellett", "után", "alatt", "felett", "előtt", "közel", "közelében", "minden", "nagy", "kicsi",
  "vannak", "van", "lesz", "itt", "ott", "ide", "oda", "the", "and", "with", "for", "from", "your", "our", "you",
  "und", "mit", "der", "die", "das", "für", "een", "het", "les", "des", "une", "con", "per", "una", "del", "nel",
  "nálunk", "önöket", "önt", "önök", "szeretettel", "várjuk", "meg", "nem", "igen", "már", "még", "is", "az", "a", "és",
  "ha", "de", "se", "sem", "el", "ki", "be", "le", "fel", "át", "ön", "mi", "ti", "ők", "ez", "azt", "ezt", "ami", "aki",
]);

export const TEXT_OVERLAP_MIN = 0.5;
const RUN_WORDS = 4;

const words = (t: string): string[] => t.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Strip the proper names (and their suffixed forms) so „Monos Apartman” ↔ „Monos” is not a repeat. */
export function stripProperNames(text: string, proper: readonly string[]): string {
  let t = text;
  for (const p of proper) {
    for (const w of words(p)) {
      if (w.length < 3) continue;
      t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\p{L}*`, "giu"), " ");
    }
  }
  return t;
}

/** Two-letter words that still name a thing on a lodging page. */
const SHORT_CONTENT = new Set(["fő", "tó"]);

export function contentStems(text: string): string[] {
  return words(text).filter((w) => (w.length >= 3 || SHORT_CONTENT.has(w)) && !FUNCTION_WORDS.has(w));
}

function sharedRun(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  let best = 0;
  for (let i = 0; i < wa.length; i++) {
    for (let j = 0; j < wb.length; j++) {
      let k = 0;
      while (i + k < wa.length && j + k < wb.length && wa[i + k] === wb[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/**
 * Two words are the same word when one is the other plus a SUFFIX of at most 3 letters („tér” ~ „téren”,
 * „kert” ~ „kertről”), or when both are 6+ letters and share their first 5 („légkondicionált” ~
 * „légkondicionálás”). „nap” ~ „napernyő” is NOT (blind sample 11-27: a POI line „Családi nap” matched).
 */
function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.startsWith(s) && l.length - s.length <= 3) return true;
  return s.length >= 6 && l.slice(0, 5) === s.slice(0, 5);
}

/**
 * 0..1 — how much the shorter line is already said by the other; 1 when they share a run of four words.
 * Lines of two content words repeat only when BOTH words recur (a shared single word is no repeat).
 */
export function textOverlap(a: string, b: string, proper: readonly string[] = []): number {
  // Numbered siblings („… apartman 1” / „… apartman 2”) are a list, not a repeat (blind sample 11-27).
  if (a.replace(/\d+/g, "#").trim().toLowerCase() === b.replace(/\d+/g, "#").trim().toLowerCase() && /\d/.test(a)) return 0;
  const sa = stripProperNames(a, proper);
  const sb = stripProperNames(b, proper);
  if (sharedRun(sa, sb) >= RUN_WORDS) return 1;
  const A = [...new Set(contentStems(sa))];
  const B = [...new Set(contentStems(sb))];
  const min = Math.min(A.length, B.length);
  if (min < 2) return 0;
  const shared = A.filter((x) => B.some((y) => sameStem(x, y))).length;
  // One shared word is a shared topic, not a repeat (Lugas: „Siófokon” in the H1 and in the intro).
  if (shared < 2) return 0;
  return shared / min;
}

export const repeatsText = (a: string, b: string, proper: readonly string[] = []): boolean => textOverlap(a, b, proper) >= TEXT_OVERLAP_MIN;
