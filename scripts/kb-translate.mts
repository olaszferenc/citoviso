// KB-FORDÍTÁS-KÖR — a súgó eljuttatása MINDEN élő nyelvre (§J.25, ADR-0184).
//
//   npx tsx scripts/kb-translate.mts            # minden élő nyelv
//   npx tsx scripts/kb-translate.mts pl sk      # csak a megnevezettek
//
// ⚠️ A FUTTATÁS SORRENDJE MAGA A SZABÁLY: a KB-SZERKESZTÉS **UTÁN** futtasd. A 2026-09-15-i
// hiba pontosan ez volt: lefuttattam a kört, aztán MÉG EGYSZER hozzányúltam a cikkhez, és
// azt már nem fordíttattam újra — a lengyel és a szlovák tulaj a frissen javított hibákat
// olvasta tovább, mert magyar fallback NINCS.
//
// ⛔ NINCS API-FORDÍTÁS (tulaj, 2026-10-27, ADR-XXXX): ez a kör Bábel COMMITOLT súgó-fordításait
// (src/i18n/babel/kb/<nyelv>/<cikk>.json) teszi a DB-be. Ami hiányzik vagy elavult, az Bábel
// sessionjére vár (`babel-pack.mts kb-export <nyelv>`) — újrapróbálni nincs mit, a kör HANGOSAN bukik.

import { db } from "../src/db/client.js";
import { ensureLanguagePack } from "../src/i18n/packs.js";
import { kbCoverage } from "../src/i18n/kbPacks.js";

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const live = (await db.selectFrom("language_pack").select("lang").execute()).map((r) => r.lang);
const langs = wanted.length ? wanted.filter((l) => live.includes(l)) : live;

// ⛔ Amit kihagyunk, azt HANGOSAN hagyjuk ki — a néma kihagyás úgy néz ki, mint a siker.
for (const w of wanted) {
  if (!live.includes(w)) console.log(`  ⚠️ „${w}" nem élő nyelvi csomag — kihagyva.`);
}
if (!langs.length) {
  console.log("nincs mit fordítani (nincs élő nyelvi csomag vagy nincs egyezés).");
  await db.destroy();
  process.exit(0);
}

let failed = 0;
for (const lang of langs) {
  const before = await kbCoverage(lang);
  if (before.ok) {
    console.log(`  ${lang}: már friss (${before.total}/${before.total}) — nincs teendő.`);
    continue;
  }
  await ensureLanguagePack(lang);
  const after = await kbCoverage(lang);
  if (after.ok) {
    console.log(`  ${lang}: ✅ teljes (Bábel-mag, indulás: ${before.total - before.missing}/${before.total})`);
  } else {
    failed++;
    console.error(
      `  ${lang}: ⛔ ${after.missing}/${after.total} cikk Bábelre vár — npx tsx scripts/babel-pack.mts kb-export ${lang}`,
    );
  }
}

// ── VISSZAMÉRÉS: a saját kimenetemből, nem a saját listámból ─────────────────
// `feedback_registration_count_must_be_read_back`: amit elvégeztünk, azt a REGISZTERBŐL
// olvassuk vissza, nem abból, amit hinni szeretnénk róla.
console.log("\n=== visszamérés (írás nélkül):");
let allOk = true;
for (const lang of live) {
  const c = await kbCoverage(lang);
  if (!c.ok) allOk = false;
  console.log(`  ${lang}: ${c.total - c.missing}/${c.total} ${c.ok ? "✅" : `⛔ ${c.missing}`}`);
}
await db.destroy();

if (!allOk || failed) {
  console.error("\n❌ kb-translate: MARADT lefedetlen nyelv — a súgó nem jutott el mindenhová.");
  process.exit(1);
}
console.log(`\n✅ kb-translate: mind a(z) ${live.length} élő nyelv teljes.`);
