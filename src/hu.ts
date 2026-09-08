// Hungarian grammar helpers shared by every surface that writes Hungarian copy.
//
// ⛔ ONE copy only. The definite article lived privately inside the outreach
// letter builder; the console then printed a raw "a(z)" because it had no access
// to the rule (ADR-0101 ① bans "a(z)" — it reads as unfinished boilerplate).
// A grammar rule duplicated is a grammar rule that drifts.

/**
 * Definite article for a Hungarian word: vowel → "Az", otherwise "A". Leading
 * digits resolve by how the number is READ (1 → egy → az, 5 → öt → az).
 */
export function huArticle(name: string): string {
  const first = name.trim().charAt(0).toLowerCase();
  if ("aáeéiíoóöőuúüű".includes(first)) return "Az"; // i18n-exempt: vowel DATA, not copy
  if ("15".includes(first)) return "Az";
  return "A";
}

/** Lower-case form for mid-sentence use ("… az Alap csomagból"). */
export function huArticleLower(name: string): string {
  return huArticle(name).toLowerCase();
}
