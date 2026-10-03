// ŐR: a Google-értékelés (★-átlag + darabszám) EGY szabállyal kerül ki — §B.17, 03-INVARIANTS 7. pont.
//
// A LELET (2026-10-02, Kapunyitás SUB, tényhűség-őr agent FLAG): a Lidó Wellness és Bor Villa
// mockján „4,8 · 25 vélemény” állt a szállás SAJÁT értékeléseként, 0,605-ös párosítási biztonságon.
// A §B.17 0,7-et kér — és az élő jelvény (`reviews/placeRating.ts`) ezt is kérte a saját
// `MIN_CONFIDENCE = 0.7` példányával —, a generátor (`generate.ts`) viszont csak a „low” sávot
// (< 0,45) dobta el, mert a számot a FOTÓ-kapura ültette. Egy tény, két szabály, két igazság.
// Ma egy helyen él: `scraper/confidence.ts` → `ratingAttributable`; a generátor
// `attributedRating`-je és az élő jelvény is azt kérdezi.
//
// Mit tart (DB és hálózat nélkül):
//   ① a szabály: 0,605 (Lidó) → NEM; 0,699 → NEM; 0,7 → igen; ismeretlen → NEM;
//   ② a generátor döntése (`attributedRating`) a Lidó-párosításon nem ad számot, egy erősön igen;
//   ③ egy szabály, egy hely: a generátor és az élő jelvény a közös függvényt hívja, és egyikben
//     sincs saját küszöb-példány; a `resolveGatedPhotos` a számot az `attributedRating`-ből veszi;
//   ④ a kurátor a lead-lapon a gyenge párosítás számát is látja (diagnózis, nem állítás) —
//     a szigorítás nem vesz el információt onnan, ahol a párosítást ítélik.
//
//   npx tsx scripts/rating-attribution-check.mts              # zöld futás
//   npx tsx scripts/rating-attribution-check.mts --self-test  # PIROS kontroll: a régi szabály
//                                                             #   (band != low) a Lidón számot ad

import { readFileSync } from "node:fs";
import { RATING_MIN_CONFIDENCE, ratingAttributable, scoreMatch } from "../src/scraper/confidence.js";
import { attributedRating } from "../src/generator/generate.js";

const SELF_TEST = process.argv.includes("--self-test");

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  if (ok) pass++;
  else failures.push(`${name} — ${detail}`);
};
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

type Match = { score: number; band: string; rating?: number; userRatingCount?: number };
// The rule under test. The self-test swaps in the pre-2026-10-03 generator rule, which must
// turn this guard red on the Lidó case.
const decide = (m: Match) =>
  SELF_TEST ? (m.band !== "low" ? { rating: m.rating, userRatingCount: m.userRatingCount } : {}) : attributedRating(m);

// ── ① the rule ────────────────────────────────────────────────────────────────
{
  check("A küszöb a §B.17 0,7-je", RATING_MIN_CONFIDENCE === 0.7, String(RATING_MIN_CONFIDENCE));
  for (const [score, want] of [
    [0.605, false],
    [0.699, false],
    [0.7, true],
    [0.93, true],
  ] as const) {
    check(`ratingAttributable(${score}) = ${want}`, ratingAttributable(score) === want, String(ratingAttributable(score)));
  }
  check("Ismeretlen biztonság (null) NEM elég", !ratingAttributable(null), "átment");
  check("NaN NEM elég", !ratingAttributable(Number.NaN), "átment");
}

// ── ② the generator's decision on the measured case ───────────────────────────
{
  // Lidó Wellness és Bor Villa — the measured match (0,605, medium band, 4,8 / 25).
  const lido: Match = { score: 0.605, band: "medium", rating: 4.8, userRatingCount: 25 };
  const r = decide(lido);
  check("⛔ Lidó (0,605, közepes sáv): a mockra NEM kerül Google-értékelés", r.rating == null && r.userRatingCount == null, JSON.stringify(r));
  // A medium band from the "not lodging" cap, score above 0,7: the documented rule is the score.
  const capped = scoreMatch({ distanceMeters: 20, nameSimilarity: 1, corroboratedByOsm: true, placeKind: "other" });
  check("(fixture) a nem-szállás típusú hely közepesre korlátozva, 0,7 fölötti pontszámmal", capped.band === "medium" && capped.score >= 0.7, JSON.stringify(capped));
  const strong: Match = { score: 0.86, band: "high", rating: 4.6, userRatingCount: 88 };
  const s = decide(strong);
  check("Erős párosítás (0,86): a valódi szám kimegy", s.rating === 4.6 && s.userRatingCount === 88, JSON.stringify(s));
  const low: Match = { score: 0.3, band: "low", rating: 4.9, userRatingCount: 5 };
  check("Alacsony sáv: nincs szám", decide(low).rating == null, JSON.stringify(decide(low)));
}

// ── ③ one rule, one place ────────────────────────────────────────────────────
{
  const gen = read("src/generator/generate.ts");
  const badge = read("src/reviews/placeRating.ts");
  check("A generátor a közös szabályt importálja", /import \{[^}]*\bratingAttributable\b[^}]*\} from "\.\.\/scraper\/confidence\.js"/.test(gen), "nincs import");
  check("Az élő jelvény a közös szabályt importálja", /import \{[^}]*\bratingAttributable\b[^}]*\} from "\.\.\/scraper\/confidence\.js"/.test(badge), "nincs import");
  check("Az élő jelvény a közös szabállyal kapuz", /if \(!ratingAttributable\(row\.match_confidence\)\) return null;/.test(badge), "a kapu nem a közös függvény");
  check("Az élő jelvényben nincs saját küszöb-példány", !/MIN_CONFIDENCE|match_confidence\s*<\s*0[.,]\d/.test(badge), "saját küszöb él");
  check("Az `attributedRating` a közös szabályt kérdezi", /if \(m\.rating == null \|\| !ratingAttributable\(m\.score\)\) return \{\};/.test(gen), "más szabály");
  check(
    "A `resolveGatedPhotos` a számot az `attributedRating`-ből veszi",
    /\(\{ rating, userRatingCount \} = attributedRating\(m\)\);/.test(gen),
    "a szám nem a szabályon át jön",
  );
  check(
    "A generátor sehol nem ad számot közvetlenül a párosításból (`rating = m.rating`)",
    !/\brating = m\.rating\b|userRatingCount = m\.userRatingCount\b/.test(gen),
    "közvetlen hozzárendelés él",
  );
}

// ── ④ the curator still sees the match's number ──────────────────────────────
{
  const server = read("src/console/server.ts");
  check(
    "A lead-lap fotó-paneljén a PÁROSÍTÁS száma áll (diagnózis, sávval együtt)",
    /rating: media\.matchRating\?\.value \?\? null,/.test(server) && /ratingCount: media\.matchRating\?\.count \?\? null,/.test(server),
    "a panel a kapuzott számot mutatná — a gyenge párosítás árulkodó száma eltűnne",
  );
}

if (SELF_TEST) {
  // The old rule must fail EXACTLY on the Lidó case — and nothing else may go red.
  const caught = failures.some((f) => f.startsWith("⛔ Lidó"));
  const stray = failures.filter((f) => !f.startsWith("⛔ Lidó"));
  console.log(caught ? "✅ PIROS KONTROLL: a régi szabály (band != low) a Lidón számot ad — az őr elkapta" : "⛔ PIROS KONTROLL: a régi szabály ÁTCSÚSZOTT — az őr vak");
  if (stray.length) console.log(`⛔ idegen bukás az öntesztben:\n  ${stray.join("\n  ")}`);
  process.exit(caught && !stray.length ? 0 : 1);
}
if (failures.length) {
  console.log(`⛔ rating-attribution-check: ${failures.length} bukás (${pass} zöld):\n  ✗ ${failures.join("\n  ✗ ")}`);
  process.exit(1);
}
console.log(`✅ rating-attribution-check: ${pass} állítás zöld — a Google-értékelés egy szabállyal (≥ ${RATING_MIN_CONFIDENCE}) kerül ki`);
