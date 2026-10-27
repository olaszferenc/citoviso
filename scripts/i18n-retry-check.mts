// i18n-retry-check — the {placeholder} contract and the Hungarian article (ADR-0281).
//
// ⛔ MEASURED 2026-09-30, production deploy GATE 5: `en: 3694/3701 — 7 UI-string hiányzik`.
// All seven carried the Hungarian article placeholder {Art}; the translator omitted it
// (English has no such article) and the integrity check dropped the string. The retrying
// API translator this check also covered is GONE (owner, 2026-10-27, ADR-0412: translation
// only from Bábel's subscription session) — what remains is the contract every seed entry
// passes (placeholderProblem, babel-pack import + applyBabelSeed) and its rendering:
//   ③ omitting an article placeholder ({Art}) is NOT a violation, inventing one is;
//   ④ a translated string renders the article var empty (no Hungarian "A" in English),
//     the Hungarian source and the hu-fallback keep it.
//
//   npx tsx scripts/i18n-retry-check.mts

import { interpolate, placeholderProblem } from "../src/i18n/packs.js";

let failures = 0;
function expect(ok: boolean, what: string): void {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failures++;
    console.error(`  ✗ ${what}`);
  }
}

const HU = "{Art} {domain} nevet nem tudtuk megvásárolni";
const OK = "We couldn't purchase {domain}";
const BROKEN = "We couldn't purchase the domain"; // lost {domain}

console.log("③ a névelő-placeholder elhagyható, kitalálni nem szabad");
expect(placeholderProblem(HU, OK) === null, "{Art} elhagyva → rendben");
expect(placeholderProblem(HU, "We couldn't purchase {Art} {domain}") === null, "{Art} megtartva → rendben");
expect(placeholderProblem(HU, BROKEN) !== null, "{domain} elveszett → hiba");
expect(placeholderProblem("{domain} foglalt", "{Art} {domain} is taken") !== null, "kitalált {Art} → hiba");
expect(placeholderProblem("{a} és {b}", "{a} and {b}") === null, "nem-névelő placeholderek változatlanul");

console.log("④ megjelenítés: angolul nincs magyar névelő");
{
  const v = { Art: "A", domain: "example.hu" };
  expect(interpolate("en", HU, "We couldn't purchase {Art} {domain}", v) === "We couldn't purchase example.hu", "a régi, {Art}-ot őrző fordítás is tiszta");
  expect(interpolate("en", HU, "{Art} {domain} is taken.", v) === "example.hu is taken.", "mondatkezdő {Art}");
  expect(interpolate("en", "Minden {art} {prev} csomagból:", "Everything from the {prev} package {art}:", { art: "az", prev: "Alap" }) === "Everything from the Alap package:", "mondatvégi {art}");
  expect(interpolate("hu", HU, HU, v) === "A example.hu nevet nem tudtuk megvásárolni", "magyarul marad a névelő");
  expect(interpolate("en", HU, HU, v) === "A example.hu nevet nem tudtuk megvásárolni", "hu-fallback (nincs fordítás) → a névelő marad");
}

if (failures) {
  console.error(`⛔ i18n-retry-check: ${failures} hiba`);
  process.exit(1);
}
console.log("✅ i18n-retry-check: a placeholder-szerződés él, a névelő nem szivárog.");
process.exit(0);
