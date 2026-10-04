// COPY-MANUAL GUARD — the rules of the curator's hand edit of a mock's copy (ADR-XXXX;
// contract: assets/design-refs/console/mock-copy-edit/README.md). Deterministic, no DB/AI.
//
//   ① the inline scripts (A form handlers, B preview editor) PARSE. Measured 2026-10-04: one
//      unescaped "\n" inside the TS template literal turned into a raw newline in a JS string,
//      the whole B editor died with a SyntaxError, and the page still LOOKED fine.
//   ② the save plan: unchanged → nothing; changed → recorded with the AI original; typed
//      back to the original → the mark goes; limits/required only on CHANGED fields.
//   ③ the overlay writes only the words (D3: the AI rewrite keeps hand-written fields) —
//      and recopy.ts actually applies it, after the critic too (a promise needs a guard).
//
//   npx tsx scripts/copy-manual-check.mts             # green run
//   npx tsx scripts/copy-manual-check.mts --self-test # RED control: a broken script must fail ①

import { readFileSync } from "node:fs";

import { copyEditorOverlay, mockCopyEditScript } from "../src/console/copyEditViews.js";
import {
  applyManualToSurface,
  COPY_LIMITS,
  normalizeCopy,
  overlayCopy,
  type ManualCopy,
} from "../src/engine/copyFields.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { planManualEdit } from "../src/generator/copyManual.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const ok = (c: boolean, m: string): void => {
  console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`);
  if (!c) failed++;
};

function parses(js: string): boolean {
  try {
    new Function(js);
    return true;
  } catch {
    return false;
  }
}

const recipe: Recipe = {
  template: "tilted-gallery",
  skin: "",
  archetype: "",
  sections: [
    { kind: "hero", copy: { lead: "Házi reggeli, kemencés sütés", accent: "kemencés sütés", eyebrow: "Köveskál" } },
    { kind: "features", copy: { eyebrow: "A porta", title: "Erzsike lekvárja és\na kemence melege" } },
    { kind: "enquiry" },
  ] as Recipe["sections"],
};
const data = {
  name: "Bánó Porta",
  tagline: "Erzsike és Gábor portáján csend vár.",
  intro: "x".repeat(COPY_LIMITS.intro + 50), // an AI original LONGER than the limit
  highlights: ["Házi reggeli", "Kerti kemence"],
  photos: [],
} as unknown as SiteData;

// ① scripts parse
if (SELF_TEST) {
  const broken = mockCopyEditScript().replace("function one(v)", "function one(v) {'\n'");
  const ok1 = !parses(broken);
  console.log(`${ok1 ? "✓" : "✗ FAIL"}  önteszt: a törött szkriptet észreveszi`);
  process.exit(ok1 ? 0 : 1);
}
ok(parses(mockCopyEditScript()), "① az A blokk szkriptje parse-olható");
const overlay = copyEditorOverlay(
  "00000000-0000-0000-0000-000000000000",
  { recipe, siteData: data },
  { frozen: false, leadName: "Bánó Porta", templateLabel: "Döntött galéria", backHref: "/lead/x" },
  "hu",
);
const editorJs = /<script data-cit-copyedit>([\s\S]*?)<\/script>/.exec(overlay)?.[1] ?? "";
ok(editorJs.length > 1000 && parses(editorJs), "① a B szerkesztő szkriptje parse-olható");
const cfgJson = /<script type="application\/json" id="cit-ced-cfg">([\s\S]*?)<\/script>/.exec(overlay)?.[1] ?? "";
let cfgOk = false;
try {
  cfgOk = typeof JSON.parse(cfgJson).fields === "object";
} catch {
  cfgOk = false;
}
ok(cfgOk, "① a B konfiguráció érvényes JSON");

// ② the save plan
const none = planManualEdit(recipe, data, {}, { tagline: data.tagline, "hero.lead": recipe.sections[0]!.copy!.lead! }, "op");
ok(none.changed.length === 0, "② változatlan mező → nincs változás");
const t1 = planManualEdit(recipe, data, {}, { tagline: "Új alcím a portának." }, "kurátor");
ok(
  t1.changed.join() === "tagline" && t1.manual.tagline?.orig === data.tagline && t1.manual.tagline?.source === "curator",
  "② átírt mező → kézi jelölés az AI-eredetivel, forrás: kurátor",
);
const data2 = { ...data, tagline: "Új alcím a portának." } as SiteData;
const back = planManualEdit(recipe, data2, t1.manual, { tagline: data.tagline }, "kurátor");
ok(back.changed.join() === "tagline" && !back.manual.tagline, "② visszaírva az eredetire → a jelölés megszűnik");
ok(Boolean(planManualEdit(recipe, data, {}, { "hero.lead": "  " }, "k").errors["hero.lead"]), "② üres főcím → hiba");
ok(
  Boolean(planManualEdit(recipe, data, {}, { tagline: "y".repeat(COPY_LIMITS.tagline + 1) }, "k").errors.tagline),
  `② ${COPY_LIMITS.tagline} karakternél hosszabb alcím → hiba`,
);
ok(
  Object.keys(planManualEdit(recipe, data, {}, { intro: data.intro, tagline: "Rövid új alcím." }, "k").errors).length === 0,
  "② a hosszabb AI-eredeti (változatlan) bemutatkozó nem blokkolja a másik mező mentését",
);
ok(
  Boolean(planManualEdit(recipe, data, {}, { highlights: ["a", "b", "c", "d", "e", "f", "g"] }, "k").errors.highlights),
  `② ${COPY_LIMITS.highlightsMax}-nál több kiemelés → hiba`,
);
ok(Boolean(planManualEdit(recipe, data, {}, { highlights: ["", " "] }, "k").errors.highlights), "② üres kiemelés-lista → hiba");
ok(normalizeCopy("features.title", " Első  sor \n\n második sor \n harmadik") === "Első sor\nmásodik sor", "② szakasz-cím: legfeljebb két sor, a sortörés megmarad");

// ③ overlay = words only; D3 wired into recopy
const ov = overlayCopy(recipe, data, { "features.title": "Új cím", tagline: "Új alcím." });
ok(
  ov.recipe.sections[1]!.copy!.title === "Új cím" && ov.recipe.sections[1]!.copy!.eyebrow === "A porta" &&
    ov.recipe.sections.length === recipe.sections.length && ov.data.tagline === "Új alcím." && ov.data.photos === data.photos,
  "③ a rávetítés csak a szavakat cseréli (szakasz-sorrend, fotók, többi mező marad)",
);
const manual: ManualCopy = {
  tagline: { value: "Kézi alcím.", orig: "AI alcím.", source: "curator", by: "k", at: "" },
  "hero.lead": { value: "Kézi főcím", orig: "AI főcím", source: "curator", by: "k", at: "" },
};
const surf = applyManualToSurface(
  { tagline: "AI új alcím.", intro: "AI intro.", highlights: ["AI"], editorial: { hero: { lead: "AI új főcím" } } },
  manual,
);
ok(surf.tagline === "Kézi alcím." && surf.editorial.hero?.lead === "Kézi főcím" && surf.intro === "AI intro.", "③ az AI-újraírás a kézi mezőt nem írja felül, a többit igen");
const recopySrc = readFileSync(new URL("../src/generator/recopy.ts", import.meta.url), "utf8");
const afterCritic = recopySrc.slice(recopySrc.indexOf("editorial = critic.copy.editorial;"));
ok(
  /applyManualCopy\(/.test(recopySrc) && /withManual\(\);/.test(afterCritic.slice(0, 400)),
  "③ a recopy.ts rávetíti a kézi mezőket — a vendég-kritikus után is",
);

if (failed) {
  console.log(`\n${failed} hiba`);
  process.exit(1);
}
console.log("\n✓ copy-manual-check: a kézi szöveg-átírás szabályai állnak");
