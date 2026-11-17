// ORSZÁG-RÉTEG 3/6 (ADR-0457): Cyrillic / Greek → Latin transliteration for the ASCII labels a
// name becomes (preview host, tenant slug, domain suggestion, mock file name).
//
// ⛔ Until 2026-11-17 `slugify("Къща Мария")` returned "" — the NFD accent strip leaves Cyrillic
// alone and the `[^a-z0-9]` filter then deleted every letter, so a Bulgarian lead got the
// Hungarian placeholder host `oldalam.citoviso.com`, `mock--<id>.html`, and no domain suggestion.
//
// Tables:
//  · Cyrillic: the Bulgarian Streamlined System (Закон за транслитерацията, 2009 — what Bulgarian
//    passports and road signs use: щ→sht, ъ→a, ю→yu), with the letters of the other Cyrillic
//    alphabets added (ы, э, ё, є, ї, ґ, ђ, ј, љ, њ, ћ, џ, ѓ, ќ, ѕ) so a Russian / Ukrainian /
//    Serbian / Macedonian name never loses a letter either.
//  · Greek: ELOT 743 (the Greek passport standard), simplified to single letters + the common
//    digraphs (θ→th, χ→ch, ψ→ps); accents are stripped first.
// Latin text passes through unchanged, so a Hungarian name's slug is byte for byte the old one.

const CYRILLIC: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
  // other Cyrillic alphabets
  ё: "yo", ы: "y", э: "e", є: "ye", і: "i", ї: "yi", ґ: "g",
  ђ: "dj", ј: "j", љ: "lj", њ: "nj", ћ: "c", џ: "dz", ѓ: "gj", ќ: "kj", ѕ: "dz",
};

const GREEK: Readonly<Record<string, string>> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k",
  λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t",
  υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

const NON_LATIN = /[Ͱ-ϿЀ-ӿ]/;

/** The name with every Cyrillic / Greek letter written in Latin (case kept loosely: an
 *  upper-case source letter gives a capitalised transliteration). Latin text is untouched. */
export function transliterate(s: string): string {
  if (!NON_LATIN.test(s)) return s;
  // Greek accents (ά, ΐ) decompose; the base letter is then looked up.
  const decomposed = s.normalize("NFD");
  let out = "";
  for (const ch of decomposed) {
    const lower = ch.toLowerCase();
    const hit = CYRILLIC[lower] ?? GREEK[lower];
    if (hit === undefined) {
      out += ch;
      continue;
    }
    out += ch !== lower && hit ? hit[0]!.toUpperCase() + hit.slice(1) : hit;
  }
  return out.normalize("NFC");
}
