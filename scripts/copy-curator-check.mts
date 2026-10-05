// COPY-CURATOR GUARD — „generálás kurátori szöveggel” (ADR-0326, Poe; plan: szovegkurator/
// TERV.md §6 item 8). Deterministic, no DB/AI.
//
//   ① the pack validator: a good pack passes; every red control fails (over-limit, unknown
//      key, missing required field, bad hex); an unverifiable quote DROPS (§B.17); homoglyphs go.
//   ② ONE RULE: copyCurator reuses the hand edit's limit check and the AI's quote gate — it
//      must not grow its own copy of either (feedback_one_rule_two_copies). Same over-limit
//      value → the same message from both paths.
//   ③ engine wiring: curator mode makes NO copywriter call, NO market regeneration, and runs
//      NO AI guard (market, critic, fact — ADR-XXXX): the mock gets reviewVerdict "pending"
//      (Vera's review), and the provenance (copyOrigin + copyManual) is persisted with it.
//   ④ the send gate does not exempt curator text: a curator mock with a flag still blocks.
//   ⑤ provenance round-trips through manualCopyOf (by = Poe, orig = "").
//
//   npx tsx scripts/copy-curator-check.mts             # green run
//   npx tsx scripts/copy-curator-check.mts --self-test # MUTATION probe: each broken wiring must fail ③

import { readFileSync } from "node:fs";

import { manualCopyOf, type CopyKey } from "../src/engine/copyFields.js";
import { curatorManualOf, validateCuratorCopy, type CuratorCopy } from "../src/generator/copyCurator.js";
import { planManualEdit } from "../src/generator/copyManual.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { blockingVerdicts } from "../src/outreach/mockVerdictGate.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const ok = (c: boolean, m: string): void => {
  console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`);
  if (!c) failed++;
};

// ③ as a pure function of the engine source, so the self-test can feed it mutants.
function wiringFindings(src: string): string[] {
  const bad: string[] = [];
  if (!/curated\s*\?\s*\{\s*brief:\s*curated\.brief[\s\S]{0,200}:\s*await generateBriefAndCopy\(briefInput\)/.test(src))
    bad.push("a kurátori mód nem kerüli meg az író-hívást (generateBriefAndCopy)");
  if (!/if \(!curated && market\.verdict === "flag" && market\.critique\)/.test(src))
    bad.push("a piaci újragenerálás kurátori módban is lefut");
  // ADR-XXXX: on the curator path no AI guard runs; Vera's review replaces them ("pending").
  for (const g of ["market = await verifyMarketRelevance({", "factCheck = await verifyFactuality({"])
    if (!new RegExp(`if \\(!curated\\) try \\{\\s*${g.replace(/[()[\]{}.*+?^$|\\]/g, "\\$&")}`).test(src))
      bad.push(`kurátori módban is lefut: ${g}`);
  if (/judgeGuestCopy\(/.test(src)) bad.push("a kritikus kurátori módban is ítél (judgeGuestCopy)");
  if (!/copyOrigin: "curator",[\s\S]{0,200}reviewVerdict: "pending",/.test(src))
    bad.push("a kurátori mock nem kap \"pending\" Vera-ítéletet (a kapu átengedné)");
  if (!/copyOrigin: "curator",[\s\S]{0,300}copyManual: curatorManualOf\(/.test(src))
    bad.push("a provenance (copyOrigin + copyManual) nem perszisztálódik");
  for (const key of ["factVerdict:", "marketVerdict:", "...criticInputs,"])
    if (!src.includes(key)) bad.push(`a(z) ${key} ítélet nem perszisztálódik`);
  return bad;
}

const engineSrc = readFileSync("src/generator/generateEngine.ts", "utf8");

if (SELF_TEST) {
  const mutants: [string, string][] = [
    ["író-hívás mindig", engineSrc.replace(/curated\s*\?\s*\{\s*brief:\s*curated\.brief/, "false ? { brief: curated.brief")],
    ["piaci retry kurátorra is", engineSrc.replace("if (!curated && market.verdict", "if (market.verdict")],
    ["piac-őr kurátorra is", engineSrc.replace("if (!curated) try {\n    market", "try {\n    market")],
    ["tény-őr kurátorra is", engineSrc.replace("if (!curated) try {\n    factCheck", "try {\n    factCheck")],
    ["nincs pending", engineSrc.replace('reviewVerdict: "pending",', "")],
    ["provenance hiányzik", engineSrc.replace('copyOrigin: "curator",', "")],
    ["kritikus-ítélet nincs mentve", engineSrc.replace("...criticInputs,", "")],
  ];
  let allCaught = wiringFindings(engineSrc).length === 0;
  console.log(`${allCaught ? "✓" : "✗ FAIL"}  önteszt: az ép forrás zöld`);
  for (const [name, mutant] of mutants) {
    const caught = mutant !== engineSrc && wiringFindings(mutant).length > 0;
    console.log(`${caught ? "✓" : "✗ FAIL"}  önteszt: a mutáns „${name}” bukik`);
    allCaught &&= caught;
  }
  process.exit(allCaught ? 0 : 1);
}

// ① validator
const corpus = [
  "A ház a Balaton partjától 200 méterre fekszik, saját kerttel és grillezővel.",
  "Spokojna i cicha okolica, a reggeli bőséges volt.",
];
const good: CuratorCopy = {
  fields: {
    "hero.lead": "Kerti esték a part közelében",
    "hero.accent": "part közelében",
    tagline: "Családoknak, akik а csendet keresik", // Cyrillic "а" on purpose
    intro: "Kétszáz méter a parttól, saját kert grillezővel.",
    highlights: ["Saját kert grillezővel", "Bézs csempés fürdőszoba"],
    "reviews.title": "Amit a\nvendégek mondanak",
  },
  sellingPoints: [
    { label: "Grillező", quote: "saját kerttel és grillezővel" },
    { label: "Medence", quote: "nagy medence a kertben" },
  ],
  accent: "#2f6b78",
};
const g = validateCuratorCopy(good, corpus);
ok(g.ok, "① a jó csomag átmegy");
if (g.ok) {
  ok(g.copy.brief.tagline === "Családoknak, akik a csendet keresik", "① a homoglifa kicserélődik");
  ok(g.copy.sellingPoints.length === 1 && g.copy.sellingPoints[0]!.label === "Grillező", "① a forrásban nem szereplő idézet kiesik (§B.17)");
  ok(g.copy.warnings.some((w) => w.includes("Medence")), "① a kieső tényt jelenti");
  ok(g.copy.warnings.some((w) => w.includes("Bézs csempés")), "① a díszítés-kiemelés kiesését jelenti");
  ok(g.copy.editorial.reviews?.title === "Amit a\nvendégek mondanak" && g.copy.editorial.hero?.lead === "Kerti esték a part közelében", "① a szakaszcímek az editorialba kerülnek");
  ok(g.copy.by === "Poe" && g.copy.accent === "#2f6b78", "① by = Poe, a HEX-akcent megmarad");
}
const red = (name: string, pack: CuratorCopy, key: string): void => {
  const r = validateCuratorCopy(pack, corpus);
  ok(!r.ok && Boolean(r.errors[key]), `① piros kontroll: ${name}`);
};
red("túl hosszú főcím", { ...good, fields: { ...good.fields, "hero.lead": "x".repeat(141) } }, "hero.lead");
red("ismeretlen mező", { ...good, fields: { ...good.fields, "price.title": "Árak" } }, "price.title");
red("hiányzó bemutatkozó", { ...good, fields: { ...good.fields, intro: "" } }, "intro");
red("üres kiemelés-lista", { ...good, fields: { ...good.fields, highlights: [] } }, "highlights");
red("hét kiemelés", { ...good, fields: { ...good.fields, highlights: ["a", "b", "c", "d", "e", "f", "g"] } }, "highlights");
red("hibás HEX", { ...good, accent: "kék" }, "accent");

// ② one rule
const curatorSrc = readFileSync("src/generator/copyCurator.ts", "utf8");
ok(/import \{ copyValueError, normalizeCopyValue \} from "\.\/copyManual\.js"/.test(curatorSrc), "② a kézi szerkesztés határ-ellenőrzését használja");
ok(/import \{ validateSellingPoints/.test(curatorSrc), "② az AI idézet-kapuját használja (brief.validateSellingPoints)");
ok(!/COPY_LIMITS|\.length > \d|function validateSellingPoints/.test(curatorSrc), "② nincs saját határ- vagy idézet-szabály");
const longTagline = "y".repeat(161);
const recipe: Recipe = { template: "x", skin: "", archetype: "", sections: [{ kind: "hero", copy: { lead: "L" } }] } as unknown as Recipe;
const data = { name: "N", tagline: "T", intro: "I", highlights: ["H"], photos: [] } as unknown as SiteData;
const manualErr = planManualEdit(recipe, data, {}, { tagline: longTagline }, "Neo").errors.tagline;
const r2 = validateCuratorCopy({ ...good, fields: { ...good.fields, tagline: longTagline } }, corpus);
ok(Boolean(manualErr) && !r2.ok && r2.errors.tagline === manualErr, "② ugyanaz a túl hosszú érték ugyanazt az üzenetet adja mindkét úton");

// ③ engine wiring
const findings = wiringFindings(engineSrc);
ok(findings.length === 0, `③ a generálás bekötése${findings.length ? ": " + findings.join("; ") : ""}`);

// ④ the gate does not exempt curator text
const flagged = blockingVerdicts({ copyOrigin: "curator", factVerdict: "pass", marketVerdict: "pass", designVerdict: "pass", guestCriticVerdict: "flag", guestCriticReason: "leltáros nyitás" });
ok(flagged.some((b) => b.key === "guestCriticVerdict"), "④ a kurátori mock flagje is blokkol a kiküldési kapun");
const gateSrc = readFileSync("src/outreach/mockVerdictGate.ts", "utf8");
ok(!gateSrc.includes("copyOrigin"), "④ a kapu nem ágazik el a szöveg eredete szerint");

// ⑤ provenance round-trip
const keys: CopyKey[] = ["hero.lead", "tagline"];
const manual = curatorManualOf(keys, (k) => (k === "tagline" ? "T" : "L"), "Poe");
const back = manualCopyOf({ copyManual: JSON.parse(JSON.stringify(manual)) });
ok(back.tagline?.by === "Poe" && back.tagline.orig === "" && back.tagline.source === "curator" && back["hero.lead"]?.value === "L", "⑤ a provenance visszaolvasható (by = Poe, orig = \"\")");

if (failed) {
  console.log(`\n✗ copy-curator-check: ${failed} hiba`);
  process.exit(1);
}
console.log("\n✓ copy-curator-check: zöld");
