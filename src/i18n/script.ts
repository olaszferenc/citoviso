// ORSZÁG-RÉTEG 3/6 (ADR-XXXX): the WRITING SYSTEM of a language — the one fact the mock's
// homoglyph scrub, its web-font subset and its slug transliteration all hang on.
//
// ⛔ Not a hand-kept table: the script is a property of the language, and the platform's
// CLDR data already knows it (`new Intl.Locale("bg").maximize().script` → "Cyrl"). A new
// country row with a new language therefore needs no edit here.

/** ISO 15924 script code of a language ("Latn", "Cyrl", "Grek", …). Unknown → "Latn". */
export function scriptOfLang(lang: string | null | undefined): string {
  if (!lang) return "Latn";
  try {
    return new Intl.Locale(lang).maximize().script ?? "Latn";
  } catch {
    return "Latn";
  }
}

/** Does the language write in the Latin alphabet (Hungarian, Czech, German, …)? */
export function isLatinScript(lang: string | null | undefined): boolean {
  return scriptOfLang(lang) === "Latn";
}

/**
 * The Google Fonts `subset` names a page in this language needs ON TOP of "latin" — the
 * Latin subset always rides along (names, e-mail addresses, URLs are Latin on every page).
 * Hungarian/Czech/Polish/… letters (ő, ű, č, ř, ł) live in "latin-ext".
 */
export function fontSubsetsOfLang(lang: string | null | undefined): readonly string[] {
  switch (scriptOfLang(lang)) {
    case "Cyrl":
      return ["latin", "latin-ext", "cyrillic", "cyrillic-ext"];
    case "Grek":
      return ["latin", "latin-ext", "greek", "greek-ext"];
    default:
      return ["latin", "latin-ext"];
  }
}

// Latin ↔ Cyrillic lookalikes. LLM output occasionally carries a lookalike letter of the OTHER
// script inside a word — invisible on screen, but it breaks search, matching and the fact
// guard (one caught in production inside a Hungarian word, 2026-08).
const CYR_TO_LAT: Readonly<Record<string, string>> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i",
  А: "A", Е: "E", О: "O", Р: "P", С: "C", Х: "X", І: "I", В: "B", Н: "H", К: "K", М: "M", Т: "T",
};
const LAT_TO_CYR: Readonly<Record<string, string>> = {
  a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у",
  A: "А", E: "Е", O: "О", P: "Р", C: "С", X: "Х", B: "В", H: "Н", K: "К", M: "М", T: "Т",
};

const CYR = /[Ѐ-ӿ]/;
const LAT = /[A-Za-z]/;

/**
 * Align lookalike letters to the language's own script.
 *  · Latin-script language (Hungarian, Czech, …): every Cyrillic lookalike becomes its Latin
 *    twin — the behaviour the Hungarian mock always had, byte for byte.
 *  · Cyrillic language (Bulgarian, …): ONLY a mixed-script word is touched — its Latin
 *    lookalikes become Cyrillic ("хотeл" → "хотел"). A wholly Latin word (a brand, "Wi-Fi",
 *    an e-mail address) stays as written, and Cyrillic text is never transliterated.
 *  · Any other script (Greek, …): left untouched — no lookalike table is safer than a wrong one.
 */
export function alignHomoglyphs(s: string, lang?: string | null): string {
  const script = scriptOfLang(lang);
  if (script === "Latn") return s.replace(/[Ѐ-ӿіІ]/g, (ch) => CYR_TO_LAT[ch] ?? ch);
  if (script !== "Cyrl") return s;
  return s.replace(/[\p{L}\p{M}]+/gu, (word) =>
    CYR.test(word) && LAT.test(word) ? word.replace(/[A-Za-z]/g, (ch) => LAT_TO_CYR[ch] ?? ch) : word,
  );
}
