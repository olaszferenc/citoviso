// The curator's template pair is honoured EXACTLY or refused out loud (src/generator/templatePicks.ts).
// Live cases (Poe2, 2026-11-04): „Parallax + Fejezetes” on Martina 9f5723d0 and Balatinus 00ec9215
// came back as two Parallax / Parallax + Fullbleed. Prod 2026-11-04: the stored pairs of those runs
// were parallax + horizontal (17:24, 17:31 UTC) and, earlier, fullbleed + parallax (Balatinus
// 2026-10-06) — the console filtered and deduped the requested ids WITHOUT a word, so any id that
// was not a pickable template id vanished and the run went on with the rest (or the default).
// Hermetic: no DB, no network.
import { readFileSync } from "node:fs";
import { isPickableTemplate, OWNER_ALLOWED_TEMPLATES, TEMPLATES } from "../src/engine/templates.js";
import * as picksMod from "../src/generator/templatePicks.js";
import { assertTemplateHonoured, FIRST_TEMPLATE_DEFAULT, isNewMockTemplate, OWNER_BANNED_TEMPLATES, requireExplicitPick, resolveTemplatePicks } from "../src/generator/templatePicks.js";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail ? `\n     ${detail}` : ""}`);
  if (!ok) failed++;
}

check("a két élő sablon létezik (parallax, horizontal = Fejezetes)", Boolean(TEMPLATES.parallax && TEMPLATES.horizontal) && /^Fejezetes/.test(TEMPLATES.horizontal!.label));

// ⛔ TULAJ-DOKTRÍNA (2026-11-04, ADR-0422): „soha többet nem lehet a fejezetest mock típust használni”.
const banPair = resolveTemplatePicks(["parallax", "horizontal"], 2);
check("„Parallax + Fejezetes” → hangos elutasítás (Fejezetes kivezetve), nem csendes helyettesítés",
  !banPair.ok && /Fejezetes/.test(banPair.message) && /soha többet/.test(banPair.message) && /Kapunyitás/.test(banPair.message) && /Névből/.test(banPair.message), JSON.stringify(banPair));
check("Fejezetes egyedül is elutasítva (/generate)", !resolveTemplatePicks(["horizontal"], 21).ok);
check("új mockhoz a Fejezetes nem választható (isNewMockTemplate), a Parallax igen",
  !isNewMockTemplate("horizontal") && isNewMockTemplate("parallax") && OWNER_BANNED_TEMPLATES.has("horizontal"));
check("a regiszter is kivezeti (retired → a választóból és a Forrás-csomag sablonlistájából eltűnik; „Fejezetes = kuka”)",
  TEMPLATES.horizontal!.retired === true && !isPickableTemplate("horizontal") && isPickableTemplate("parallax"));
// ⛔ TULAJ (2026-11-04, ADR-0423): „ami még választható: parralax · kapunyitás · névből növő”.
const pickable = Object.keys(TEMPLATES).filter(isPickableTemplate).sort();
check("csak a tulaj három sablonja választható (parallax, gate-opening, wordmark-grow)",
  pickable.join(",") === "gate-opening,parallax,wordmark-grow" && OWNER_ALLOWED_TEMPLATES.size === 3, pickable.join(","));
const others = Object.keys(TEMPLATES).filter((t) => !OWNER_ALLOWED_TEMPLATES.has(t));
check(`minden más (${others.length} sablon) elutasítva a curate-ben és a /generate-ben, a megengedett hármat megnevezve`,
  others.length > 0 && others.every((t) => { const r = resolveTemplatePicks([t], 2); return !r.ok && (OWNER_BANNED_TEMPLATES.has(t) || (/Parallax/.test(r.message) && /Kapunyitás/.test(r.message) && /Névből/.test(r.message))); }));
let otherThrew = 0;
for (const t of others) { try { assertTemplateHonoured(undefined, t); } catch { otherThrew++; } }
check("motor: a listán kívüli sablon új mockként nem renderel (alapértelmezésből vagy CLI-ből sem)", otherThrew === others.length, `${otherThrew}/${others.length}`);
// ⛔ TULAJ (2026-11-04): „random bazdmeg! amelyik jobb” — a konzolon NINCS alapértelmezett sablon,
// se első, se második terv; csak kifejezett választás, különben hangos bukás.
check("nincs második-terv alapértelmezés (SECOND_TEMPLATE_DEFAULT megszűnt)", !("SECOND_TEMPLATE_DEFAULT" in picksMod));
const none = requireExplicitPick(resolveTemplatePicks([], 2));
check("üres sablonkérés a konzolon → hangos bukás, a megengedett hármat megnevezve, nincs alapértelmezés",
  !none.ok && /Nincs kiválasztott sablon/.test(none.message) && /Parallax/.test(none.message) && /Kapunyitás/.test(none.message) && /Névből/.test(none.message), JSON.stringify(none));
const one = requireExplicitPick(resolveTemplatePicks(["wordmark-grow"], 2));
check("egy kifejezett választás (Névből növő) átmegy, változatlanul", one.ok && one.templates.join(",") === "wordmark-grow");
check("a motor tartaléka (csak nem-konzolos hívónak: nyilvános mock-kérés, CLI) választható sablon", isNewMockTemplate(FIRST_TEMPLATE_DEFAULT));
const consoleSrc = readFileSync(new URL("../src/console/" + "server.ts", import.meta.url), "utf8");
const genPart = consoleSrc.slice(consoleSrc.indexOf("const genMatch ="), consoleSrc.indexOf("const packMatch ="));
check("bekötés: a /generate és a /generate-curated is requireExplicitPick-kel fut, a /generate nem tölt be [undefined]-et",
  (genPart.match(/requireExplicitPick\(resolveTemplatePicks\(/g) ?? []).length === 2 && !/: \[undefined\]/.test(genPart));
const engineSrc = readFileSync(new URL("../src/generator/generateEngine.ts", import.meta.url), "utf8");
check("bekötés: a motor alapértelmezett sablona a FIRST_TEMPLATE_DEFAULT (nem a beégetett fullbleed)", /const DEFAULT_TEMPLATE = FIRST_TEMPLATE_DEFAULT;/.test(engineSrc));
const viewsSrc = readFileSync(new URL("../src/console/views.ts", import.meta.url), "utf8");
check("bekötés: a konzol sablonválasztója az isPickableTemplate-en át szűr", /\.filter\(\(t\) => isPickableTemplate\(t\.id\)\)/.test(viewsSrc));
// The pair Poe2 is now steered to: exactly that pair, in that order.
const pair = resolveTemplatePicks(["parallax", "gate-opening"], 2);
check("„Parallax + Kapunyitás” → pontosan parallax + gate-opening", pair.ok && pair.templates.join(",") === "parallax,gate-opening", JSON.stringify(pair));

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
const three = resolveTemplatePicks(["parallax", "gate-opening", "wordmark-grow"], 2);
check("kurátori futás: 3 sablon → elutasítás", !three.ok, JSON.stringify(three));
const empty = resolveTemplatePicks([], 2);
check("üres kérés → üres lista a feloldóban (a konzol requireExplicitPick-je bukik rajta)", empty.ok && empty.templates.length === 0);

// The engine's proof: a requested template rendered as anything else is a failure.
let threw = "";
try { assertTemplateHonoured("parallax", undefined); } catch (e) { threw = (e as Error).message; }
check("motor: kért Parallax, fotó nélkül kompozíció lenne → hiba, nincs mock", /Parallax/.test(threw), threw);
threw = "";
try { assertTemplateHonoured("gate-opening", "parallax"); } catch (e) { threw = (e as Error).message; }
check("motor: kért Kapunyitás helyett Parallax → hiba", /Kapunyitás/.test(threw) && /Parallax/.test(threw), threw);
threw = "";
try { assertTemplateHonoured("horizontal", "horizontal"); } catch (e) { threw = (e as Error).message; }
check("motor: Fejezetes új mockként akkor sem renderel, ha valaki a végpontot megkerüli", /Fejezetes/.test(threw) && /Nem mentettem/.test(threw), threw);
let ok = true;
try { assertTemplateHonoured("parallax", "parallax"); assertTemplateHonoured(undefined, "parallax"); } catch { ok = false; }
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
console.log("✅ template-pick-check: a kért sablonpár pontosan teljesül, vagy hangosan bukik; a Fejezetes új mockhoz kivezetve.");
