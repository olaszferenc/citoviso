// The curator's template pair is honoured EXACTLY or refused out loud (src/generator/templatePicks.ts).
// Live cases (Poe2, 2026-11-04): „Parallax + Fejezetes” on Martina 9f5723d0 and Balatinus 00ec9215
// came back as two Parallax / Parallax + Fullbleed. Prod 2026-11-04: the stored pairs of those runs
// were parallax + horizontal (17:24, 17:31 UTC) and, earlier, fullbleed + parallax (Balatinus
// 2026-10-06) — the console filtered and deduped the requested ids WITHOUT a word, so any id that
// was not a pickable template id vanished and the run went on with the rest (or the default).
// Hermetic: no DB, no network.
import { readFileSync } from "node:fs";
import { TEMPLATES } from "../src/engine/templates.js";
import { assertTemplateHonoured, resolveTemplatePicks } from "../src/generator/templatePicks.js";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail ? `\n     ${detail}` : ""}`);
  if (!ok) failed++;
}

check("a két élő sablon létezik és választható (parallax, horizontal = Fejezetes)", Boolean(TEMPLATES.parallax && TEMPLATES.horizontal) && /^Fejezetes/.test(TEMPLATES.horizontal!.label));

// The pair Poe2 asked for, by id: exactly that pair, in that order.
const pair = resolveTemplatePicks(["parallax", "horizontal"], 2);
check("„Parallax + Fejezetes” (Martina, Balatinus) → pontosan parallax + horizontal", pair.ok && pair.templates.join(",") === "parallax,horizontal", JSON.stringify(pair));

// The silent paths of before, each now loud.
const byLabel = resolveTemplatePicks(["parallax", "Fejezetes"], 2);
check("címke azonosító helyett („Fejezetes”) → hangos elutasítás, nem csendes egy-Parallax", !byLabel.ok && /Fejezetes/.test(byLabel.message), JSON.stringify(byLabel));
const twice = resolveTemplatePicks(["parallax", "parallax"], 2);
check("kétszer ugyanaz (két Parallax) → hangos elutasítás, nem csendes összevonás", !twice.ok && /kétszer/.test(twice.message), JSON.stringify(twice));
const retired = Object.values(TEMPLATES).find((t) => t.retired);
if (retired) {
  const r = resolveTemplatePicks(["parallax", retired.id], 2);
  check(`kivezetett sablon (${retired.id}) → hangos elutasítás`, !r.ok, JSON.stringify(r));
}
const unknownOnly = resolveTemplatePicks(["fejezetes"], 2);
check("csak ismeretlen id → elutasítás (a /generate nem esik csendben a fullbleed alapértelmezésre)", !unknownOnly.ok, JSON.stringify(unknownOnly));
const three = resolveTemplatePicks(["parallax", "horizontal", "fullbleed"], 2);
check("kurátori futás: 3 sablon → elutasítás", !three.ok, JSON.stringify(three));
const empty = resolveTemplatePicks([], 2);
check("üres kérés → üres lista (a hívó dönt: /generate = alapértelmezett, curate = hiba)", empty.ok && empty.templates.length === 0);

// The engine's proof: a requested template rendered as anything else is a failure.
let threw = "";
try { assertTemplateHonoured("horizontal", undefined); } catch (e) { threw = (e as Error).message; }
check("motor: kért Fejezetes, fotó nélkül kompozíció lenne → hiba, nincs mock", /Fejezetes/.test(threw), threw);
threw = "";
try { assertTemplateHonoured("horizontal", "parallax"); } catch (e) { threw = (e as Error).message; }
check("motor: kért Fejezetes helyett Parallax → hiba", /Fejezetes/.test(threw) && /Parallax/.test(threw), threw);
let ok = true;
try { assertTemplateHonoured("horizontal", "horizontal"); assertTemplateHonoured(undefined, "fullbleed"); } catch { ok = false; }
check("motor: a teljesült kérés és a kérés nélküli futás átmegy", ok);

// Wiring: both console routes use the resolver (no isPickableTemplate filter left on the
// generate paths), and the engine asserts before it renders.
const server = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
const gen = server.slice(server.indexOf("const genMatch ="), server.indexOf("const packMatch ="));
check(
  "bekötés: /generate és /generate-curated a resolveTemplatePicks-en át, csendes szűrő nélkül",
  (gen.match(/resolveTemplatePicks\(/g) ?? []).length === 2 && !/isPickableTemplate\(t\)/.test(gen) && !/new Set\(/.test(gen),
);
const engine = readFileSync(new URL("../src/generator/generateEngine.ts", import.meta.url), "utf8");
check(
  "bekötés: a motor a render ELŐTT ellenőrzi a kért sablont",
  /assertTemplateHonoured\(opts\.template, finalRecipe\.template\)/.test(engine) &&
    engine.indexOf("assertTemplateHonoured(opts.template") < engine.indexOf("renderSite(finalRecipe"),
);

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a kért sablonpár csendben helyettesíthető.`);
  process.exit(1);
}
console.log("✅ template-pick-check: a kért sablonpár pontosan teljesül, vagy hangosan bukik.");
