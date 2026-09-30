// Targeted re-translation of the Hungarian-article keys (ADR-0281 follow-up).
//
// Before ADR-0281 the translator kept the {art}/{Art}/{art2} tokens (the Hungarian
// definite article „A”/„Az”) in every language, and two keys („Felülírta: {art} {when}-i
// … mock.”) turned into a possessive („Overridden by: {art}'s mockup…”). The new render
// blanks the token, but a bad translation stays bad until it is asked for again. This
// removes EXACTLY the catalog keys that carry an article token from every language_pack
// row, lets the normal self-heal (ensureAllLanguagePacks = i18n-pack-status --ensure)
// re-translate them with the ADR-0281 prompt, and reads the result back.
//
//   npx tsx scripts/i18n-article-refresh.mts        → DRY: per language, which keys it would drop
//   npx tsx scripts/i18n-article-refresh.mts --go   → drop + re-translate + verify (AI cost, DB write)
//
// Only the language_pack UI strings are touched; the KB translations (kb_translation) are not.
// Exit 0 = every article key is present in every language with no Hungarian article left.

import { loadCatalog, ensureAllLanguagePacks, knownLanguages } from "../src/i18n/packs.js";
import { withAiUsage } from "../src/ai/usage.js";
import { db } from "../src/db/client.js";
import { sql } from "kysely";

const go = process.argv.includes("--go");

// ADR-0281 ①: art, Art, art2 … are the Hungarian definite article.
const ARTICLE_TOKEN = /\{art\d*\}/i;
// A Hungarian article left in a translation: „A”/„Az” as a standalone word opening the
// string (the {Art} position), or „a”/„az” standing right before a placeholder.
const HU_ARTICLE_RESIDUE = /^\s*(Az|A)\s+(?=\{|[„"])|^\s*Az\s|(^|\s)(a|az)\s+\{(?!art)/;

const catalog = await loadCatalog();
const keys = catalog.filter((s) => ARTICLE_TOKEN.test(s));
const langs = await knownLanguages();

async function packsNow(): Promise<Map<string, Record<string, string>>> {
  // Straight from the DB — the packs.ts cache must stay cold until ensure reloads it.
  const rows = await db.selectFrom("language_pack").select(["lang", "strings"]).execute();
  return new Map(rows.map((r) => [r.lang, r.strings as unknown as Record<string, string>]));
}

console.log(`Névelős katalógus-kulcs: ${keys.length} · nyelvek: ${langs.join(", ") || "—"}\n`);
const before = await packsNow();
for (const lang of langs) {
  const pack = before.get(lang) ?? {};
  const present = keys.filter((k) => pack[k]);
  console.log(`${lang}: ${present.length}/${keys.length} névelős kulcs van a csomagban → ${go ? "kiveszem" : "kivenném"}`);
  for (const k of present) console.log(`   · ${k}\n       ${pack[k]}`);
}

if (!go) {
  console.log(`\nSZÁRAZ futás — semmi nem íródott. Élesítés: npx tsx scripts/i18n-article-refresh.mts --go`);
  await db.destroy();
  process.exit(0);
}

// ① Drop the article keys from every pack (jsonb minus text[]; other keys untouched).
for (const lang of langs) {
  if (!before.has(lang)) continue;
  await db
    .updateTable("language_pack")
    .set({ strings: sql`strings - ${sql.val(keys)}::text[]` as never, updated_at: sql`now()` as never })
    .where("lang", "=", lang)
    .execute();
}
console.log(`\n① ${keys.length} kulcs kivéve ${langs.filter((l) => before.has(l)).length} csomagból.`);

// ② Re-translate through the normal self-heal, with the AI meter on.
const { result: statuses, usage } = await withAiUsage(() => ensureAllLanguagePacks());
console.log("② ensureAllLanguagePacks:");
for (const s of statuses) console.log(`   ${s.lang}: ${s.total - s.missing}/${s.total}${s.ok ? " ✅" : " ⛔"}`);
const fmt = (n: number): string => n.toLocaleString("hu-HU");
console.log(
  `   AI-költség: ${usage.calls} hívás · ${fmt(usage.inputTokens)} be / ${fmt(usage.outputTokens)} ki token · ` +
    `${usage.costUsd.toFixed(4)} USD` +
    (usage.unpricedCalls ? ` · ⚠️ ${usage.unpricedCalls} hívás árazatlan` : ""),
);

// ③ Read back: every article key in every language, no Hungarian article left.
const after = await packsNow();
let bad = 0;
console.log("③ visszamérés:");
for (const lang of langs) {
  const pack = after.get(lang) ?? {};
  const missing = keys.filter((k) => !pack[k]);
  const residue = keys.filter((k) => pack[k] && HU_ARTICLE_RESIDUE.test(pack[k]!));
  bad += missing.length + residue.length;
  console.log(
    `   ${lang}: ${keys.length - missing.length}/${keys.length} megvan` +
      (residue.length ? ` · ⛔ ${residue.length} magyar névelő-maradvány` : " · névelő-maradvány nincs"),
  );
  for (const k of missing) console.log(`      ⛔ hiányzik: ${k}`);
  for (const k of residue) console.log(`      ⛔ ${k}\n         ${pack[k]}`);
}

await db.destroy();
if (bad) {
  console.error(`\n⛔ i18n-article-refresh: ${bad} hiba — lásd fent.`);
  process.exit(1);
}
console.log(`\n✅ i18n-article-refresh: ${keys.length} névelős kulcs × ${langs.length} nyelv újrafordítva, tiszta.`);
process.exit(0);
