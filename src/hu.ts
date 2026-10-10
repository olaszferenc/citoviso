// Hungarian grammar helpers shared by every surface that writes Hungarian copy.
//
// ⛔ ONE copy only. The definite article lived privately inside the outreach
// letter builder; the console then printed a raw "a(z)" because it had no access
// to the rule (ADR-0101 ① bans "a(z)" — it reads as unfinished boilerplate).
// A grammar rule duplicated is a grammar rule that drifts.

/**
 * Definite article for a Hungarian word: vowel → "Az", otherwise "A". Leading
 * digits resolve by how the number is READ: 5… is always "öt…" (5, 50, 500 → az);
 * a leading 1 depends on its place — "egy" / "ezer" / "egymillió" (1, 1 000,
 * 1 000 000 → az) but "tíz…" / "száz…" (10–19, 100–199 → a). Every other leading
 * digit reads with a consonant (kettő/húsz, három, négy, hat, hét, nyolc, kilenc).
 */
export function huArticle(name: string): string {
  const t = name.trim();
  const digits = /^\d+/.exec(t)?.[0];
  if (digits) {
    const n = digits.replace(/^0+(?=\d)/, "");
    if (n[0] === "5") return "Az";
    if (n[0] === "1" && n.length % 3 === 1) return "Az";
    return "A";
  }
  const first = t.charAt(0).toLowerCase();
  if ("aáeéiíoóöőuúüű".includes(first)) return "Az"; // i18n-exempt: vowel DATA, not copy
  return "A";
}

/** Lower-case form for mid-sentence use ("… az Alap csomagból"). */
export function huArticleLower(name: string): string {
  return huArticle(name).toLowerCase();
}
