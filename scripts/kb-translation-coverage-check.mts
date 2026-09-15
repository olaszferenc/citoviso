// KB-FORDÍTÁS-LEFEDETTSÉG kapu (§J.25, ADR-0184).
//
//   npx tsx scripts/kb-translation-coverage-check.mts [--self-test]
//
// ⛔ MÉRT HIBA (2026-09-15, harmadik független tudásbázis-őr). Módosítottam két súgó-cikket,
// lefuttattam a fordítás-kört, majd egy őr-verdikt nyomán MÉG EGYSZER hozzányúltam a
// cikkhez — és azt már nem fordíttattam újra. **A sorrend maga volt a hiba.**
// A következmény nem elméleti: a `kbPacks.ts` kimondja, hogy „a stale translation still
// serves" — MAGYAR FALLBACK NINCS. A lengyel és a szlovák tulaj szó szerint a két frissen
// javított hibát olvasta: „pod kartą Abonament" / „pod kartou Predplatné" (a kártya ALÁ
// küld, ahol nincs semmi) és „a nad nim tytułem" / „nad ním s nadpisom" (a címet a pirula
// FÖLÉ teszi).
//
// ⛔⛔ ÉS A RÉS SZERKEZETI VOLT, NEM FIGYELMETLENSÉG: a `kbCoverage()` LÉTEZETT és pontosan
// ezt mérte, de SEHOL nem volt bekötve — sem a pre-commitban, sem a napi söprésben. Ugyanaz
// a mintázat, mint az ADR-0183-nál: a meglévő kapuk MÁS KÉRDÉSRE válaszolnak. A `kb-check`
// a szerkezetet és a feliratokat méri, a `kb-freshness` a dátumokat és a képeket — egyik sem
// azt, hogy a MÓDOSÍTOTT cikk eljutott-e minden élő nyelvre.
//
// Amit mér: minden ÉLŐ nyelvi csomagra a fordítható (tenant) súgó-cikkek közül hány van
// FRISSEN lefordítva — a `source_hash` a magyar forrásból származik, tehát egy szerkesztés
// azonnal elavulttá teszi a fordítást. Egyetlen elavult cikk is PIROS.
//
// ⚠️ DB-T IGÉNYEL (a fordítások ott élnek). Elérhetetlen adatbázisnál NEM enged át némán:
// hangosan bukik, mert egy „nem tudtam megmérni" ág, ami zöldet ad, pontosan az a hamis
// bizalom, ami idáig vezetett (`feedback_silenced_failure_costs_hours`).

import { db } from "../src/db/client.js";
import { kbCoverage } from "../src/i18n/kbPacks.js";
import { kbSourceHash } from "../src/i18n/kbPacks.js";
import { loadKbEntries } from "../src/kb/kb.js";

const selfTest = process.argv.includes("--self-test");

/** A kapu döntése — KÜLÖN függvény, hogy az önteszt meg tudja szólaltatni DB nélkül is. */
export function coverageBlocking(
  rows: ReadonlyArray<{ lang: string; total: number; missing: number }>,
): boolean {
  return rows.some((r) => r.missing > 0);
}

if (selfTest) {
  // Egy kapu, amit sosem láttunk pirosan, nem kapu. Pozitív kontroll is kell: ha a
  // predikátum MINDIG false-t adna, a „minden nyelv teljes" ág vakon zöld lenne.
  const cases: ReadonlyArray<{ why: string; rows: { lang: string; total: number; missing: number }[]; want: boolean }> = [
    {
      why: "A VALÓDI hiba: pl és sk 1-1 cikkel lemaradt",
      rows: [
        { lang: "de", total: 19, missing: 0 },
        { lang: "en", total: 19, missing: 0 },
        { lang: "pl", total: 19, missing: 1 },
        { lang: "sk", total: 19, missing: 1 },
      ],
      want: true,
    },
    { why: "egyetlen nyelv, egyetlen hiány is PIROS", rows: [{ lang: "pl", total: 19, missing: 1 }], want: true },
    { why: "minden nyelv teljes → zöld", rows: [{ lang: "de", total: 19, missing: 0 }, { lang: "pl", total: 19, missing: 0 }], want: false },
    { why: "nincs élő nyelvi csomag → nincs mit követelni", rows: [], want: false },
  ];
  let bad = 0;
  for (const c of cases) {
    const got = coverageBlocking(c.rows);
    const ok = got === c.want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✅" : "⛔"} ${c.why} → ${got ? "BLOKKOL" : "átenged"} (várt: ${c.want ? "BLOKKOL" : "átenged"})`);
  }
  const fired = cases.filter((c) => c.want).length;
  if (!fired) {
    console.error("⛔ önteszt: egyetlen PIROS esetet sem tűztünk ki — ez nem próba.");
    process.exit(1);
  }
  if (bad) {
    console.error(`\n❌ kb-translation-coverage önteszt: ${bad} eset nem a várt eredményt adta.`);
    process.exit(1);
  }
  console.log(
    `\n✅ kb-translation-coverage önteszt: ${cases.length} eset, ebből ${fired} BLOKKOL — ` +
      `a kapu képes pirosra menni, és a teljes lefedettséget átengedi.`,
  );
  console.log("ℹ️ Az önteszt NEM nyúlt adatbázishoz és nem fordított.");
  process.exit(0);
}

let langs: { lang: string }[];
try {
  langs = await db.selectFrom("language_pack").select("lang").execute();
} catch (err) {
  // ⛔ NEM néma átengedés. Lásd a fejlécet: a „nem tudtam megmérni" ág zöldje pont az a
  // hamis bizalom, amiért ez a kapu létrejött.
  console.error(
    `⛔ kb-translation-coverage: az adatbázis nem érhető el, ezért NEM tudjuk megmérni, ` +
      `hogy a súgó minden élő nyelvre eljutott-e.\n   ${(err as Error).message}\n` +
      `   (Dev-gépen: a közös Postgres a /tmp:5433 socketen, citoviso_dev.)`,
  );
  process.exit(1);
}

if (!langs.length) {
  console.log("✅ kb-translation-coverage: nincs élő nyelvi csomag — nincs mit lefedni.");
  await db.destroy();
  process.exit(0);
}

const entries = loadKbEntries().filter((e) => e.audience === "tenant");
const rows: { lang: string; total: number; missing: number }[] = [];
/** Melyik nyelven MELYIK cikk maradt le — a puszta darabszám nem mondja meg, mit kell tenni. */
const stale = new Map<string, string[]>();

for (const { lang } of langs) {
  const c = await kbCoverage(lang);
  rows.push({ lang, total: c.total, missing: c.missing });
  if (c.missing > 0) {
    const have = new Map(
      (
        await db
          .selectFrom("kb_translation")
          .select(["entry_id", "source_hash"])
          .where("lang", "=", lang)
          .execute()
      ).map((r) => [r.entry_id, r.source_hash]),
    );
    stale.set(
      lang,
      entries.filter((e) => have.get(e.id) !== kbSourceHash(e)).map((e) => e.id),
    );
  }
}
await db.destroy();

for (const r of rows) {
  const s = stale.get(r.lang);
  console.log(
    `  ${r.lang}: ${r.total - r.missing}/${r.total} ${r.missing ? `⛔ ${r.missing} (${s?.join(", ")})` : "✅"}`,
  );
}

// ⛔ UTÓ-FELTÉTEL: ha a nyelv-lekérdezés vagy a cikk-szűrés elromlana, a ciklus üresen
// futna, és a kapu NÉMÁN zöldet adna (`feedback_narrow_recognizer_is_a_false_green`).
if (!rows.length || !entries.length) {
  console.error(
    `⛔ kb-translation-coverage: a MÉRÉS romlott el — ${rows.length} nyelv, ${entries.length} fordítható cikk. ` +
      `Nulla mérésből nem következik, hogy minden rendben.`,
  );
  process.exit(1);
}

if (coverageBlocking(rows)) {
  console.error(
    `\n❌ kb-translation-coverage: a súgó NEM jutott el minden élő nyelvre.\n` +
      `   A magyar forrás megváltozott, a fordítás viszont a RÉGI szöveget szolgálja ki —\n` +
      `   magyar fallback NINCS, tehát az érintett tulaj a régi (esetleg hibás) súgót olvassa.\n\n` +
      `   Javítás:  npx tsx scripts/kb-translate.mts\n` +
      `   ⚠️ A fordítás-kört a KB-SZERKESZTÉS UTÁN futtasd, ne előtte — a sorrend maga a hiba volt.`,
  );
  process.exit(1);
}
console.log(
  `✅ kb-translation-coverage: ${entries.length} tenant-cikk mind a(z) ${rows.length} élő nyelven friss.`,
);
