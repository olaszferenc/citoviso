// Accent- and case-insensitive folding for user-facing SEARCH (ADR-0084).
//
// ⚠️ WHY THIS IS NOT DONE IN SQL. The pilot database was created with collation
// and ctype `C`, so Postgres folds ASCII only: `lower('PRÓBA')` returns `'prÓba'`,
// and `subject ILIKE '%próba%'` does NOT match `'PRÓBA'`. Every accented capital
// silently falls out of an SQL-side case-insensitive search — measured, not assumed.
//
// Folding here also strips diacritics, which is what an owner typing on a phone
// actually wants: "proba" finds "PRÓBA", "szamla" finds "számla".
//
// Scale note: callers fold in JS over an already tenant-scoped, bounded row set
// (one mailbox / one document list). If a list ever grows past a few thousand rows,
// the fix is an ICU collation or a folded index column — not a bigger LIKE.
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "");
}

/** True when `haystack` contains `needle`, ignoring case and accents. */
export function foldIncludes(haystack: string, needle: string): boolean {
  const q = fold(needle.trim());
  return q === "" || fold(haystack).includes(q);
}
