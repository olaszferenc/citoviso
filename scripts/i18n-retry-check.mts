// i18n-retry-check — the UI-string translator RETRIES what it dropped, and fails LOUDLY
// when the retry fails too (ADR-XXXX).
//
// ⛔ MEASURED 2026-09-30, production deploy GATE 5: `en: 3694/3701 — 7 UI-string hiányzik`.
// All seven carried the Hungarian article placeholder {Art}; the translator omitted it
// (English has no such article), the integrity check dropped the string, and NOTHING asked
// again — the boot self-heal failed the same seven twice. This check drives the real
// `translateStrings()` with a MOCK model (no API key, no DB write, no cost) and asserts:
//   ① a dropped string is re-asked, the retry prompt names the required placeholders, and
//     the second answer is kept;
//   ② if every round fails, the string ends up in `rejected` and an error is printed;
//   ③ omitting an article placeholder ({Art}) is NOT a violation, inventing one is;
//   ④ a translated string renders the article var empty (no Hungarian "A" in English),
//     the Hungarian source and the hu-fallback keep it.
// NEGATIVE CONTROL: ① with retries disabled must FAIL — otherwise the check could not tell
// a retrying translator from one that never retries.
//
//   npx tsx scripts/i18n-retry-check.mts

import { interpolate, placeholderProblem, translateStrings, type AskModel } from "../src/i18n/packs.js";

let failures = 0;
function expect(ok: boolean, what: string): void {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failures++;
    console.error(`  ✗ ${what}`);
  }
}

/** A scripted model: answer N (0-based) comes from `answers[N]`; every call is recorded. */
function scripted(answers: Array<(user: string) => Record<string, string>>): { ask: AskModel; calls: string[] } {
  const calls: string[] = [];
  const ask: AskModel = async (_system, user) => {
    const i = calls.length;
    calls.push(user);
    const f = answers[Math.min(i, answers.length - 1)]!;
    return JSON.stringify(f(user));
  };
  return { ask, calls };
}

/** Capture console.error during `fn` — the loud path must actually print. */
async function withErrors<T>(fn: () => Promise<T>): Promise<{ result: T; errors: string[] }> {
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a.map(String).join(" "));
  try {
    return { result: await fn(), errors };
  } finally {
    console.error = orig;
  }
}

const HU = "{Art} {domain} nevet nem tudtuk megvásárolni";
const OK = "We couldn't purchase {domain}";
const BROKEN = "We couldn't purchase the domain"; // lost {domain}

async function retryScenario(maxRetryRounds?: number): Promise<{ out: Record<string, string>; calls: string[] }> {
  const m = scripted([() => ({ [HU]: BROKEN, "Mentés": "Save" }), () => ({ [HU]: OK })]);
  const { result } = await withErrors(() => translateStrings("en", [HU, "Mentés"], m.ask, { maxRetryRounds }));
  return { out: result.out, calls: m.calls };
}

console.log("① eldobott string → újrapróba → siker");
{
  const { out, calls } = await retryScenario();
  expect(out[HU] === OK, "a második kör fordítása bekerült");
  expect(out["Mentés"] === "Save", "az első körben jó string megmaradt");
  expect(calls.length === 2, `első kör + pontosan egy újrapróba (mért: ${calls.length} hívás)`);
  expect(calls.slice(1).some((c) => c.includes('"{domain}"') && c.includes("kotelezo_placeholderek")), "az újrapróba-prompt tételesen kéri a {domain}-t");
}

console.log("② minden kör bukik → hangos hiba, a string a rejected-ben");
{
  const m = scripted([() => ({ [HU]: BROKEN })]);
  const { result, errors } = await withErrors(() => translateStrings("en", [HU], m.ask));
  expect(!(HU in result.out), "nem került be törött fordítás");
  expect(Boolean(result.rejected[HU]?.includes("{domain}")), `rejected ok-kal: ${result.rejected[HU] ?? "(nincs)"}`);
  expect(m.calls.length === 3, `1 + 2 újrapróba, nem több (mért: ${m.calls.length})`);
  expect(errors.some((e) => e.includes("ELDOBVA") && e.includes(HU)), "a bukás ki van írva (nem néma)");
}

console.log("② b) a nem-JSON válasz sem néma");
{
  const { result } = await withErrors(() => translateStrings("en", [HU], async () => "sorry, no", { maxRetryRounds: 0 }));
  expect(Boolean(result.rejected[HU]?.includes("nem értelmezhető")), "a rossz válasz rejected-ként jelenik meg");
}

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

console.log("NEGATÍV KONTROLL: újrapróba nélkül az ①-nek buknia kell");
{
  const { out } = await retryScenario(0);
  if (out[HU] === OK) {
    failures++;
    console.error("  ✗ újrapróba nélkül is átment — az ① nem méri az újrapróbát");
  } else console.log("  ✓ újrapróba nélkül a string elveszik (az ① tényleg az újrapróbát méri)");
}

if (failures) {
  console.error(`⛔ i18n-retry-check: ${failures} hiba`);
  process.exit(1);
}
console.log("✅ i18n-retry-check: az eldobott fordítás újrapróbálódik, a végleges bukás hangos, a névelő nem szivárog.");
process.exit(0);
