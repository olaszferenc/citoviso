// ŐR: kivezetett sablonú mock nem mehet ki újra, és nem épülhet belőle próba-oldal (ADR-0423).
//
// A MÉRT LELET (éles, 2026-11-24). Az ADR-0423 csak a GENERÁLÁS ajtaját zárta (konzol-választó,
// generátor, motor). A régi mockot újrahasználó utak nem nézték a sablont: 11-17…11-18 között
// 39 nem-nyitó utánkövető levél ment ki horizontal / fullbleed / tilted-gallery mockkal, és a
// Freedom 50 próbája (11-24) egy októberi link horizontal 1. tervére épült. Tulaj, 11-26:
// „1 ok javítsd”.
//
// Amit mér:
//   ① A DÖNTÉS: `retiredTemplateReason` a tulaj három sablonját (parallax · gate-opening ·
//      wordmark-grow) átengedi, minden mást (és a recept nélküli régi HTML-másolatot) megfog.
//   ② A BEKÖTÉS: minden kiküldési kapu és a próbaindítás TÉNYLEG hívja — a függvénytörzsben,
//      nem csak importálja: artifactBlocks (utánkövető, próba-kampány, viselkedés-levél),
//      mobileOutreachGates (minden SMS/MMS), enqueueDispatch + a sor küldése (autoDispatch),
//      startTrial (currentTemplatePlanOf).
//
// Futtatás:       npx tsx scripts/retired-template-send-check.mts
// Piros önteszt:  npx tsx scripts/retired-template-send-check.mts --self-test
//   (egy szintetikus, a hívás nélküli függvénytörzsön elvárja a pirosat, és egy kivezetett
//    sablont átengedő döntésen is.)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { retiredTemplateReason } from "../src/outreach/templateGate.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");

const engine = (template: string) => ({ engine: "composition", recipe: { template }, siteData: {} });

/** The body of `function <name>` in a source text (up to the next top-level declaration). */
function bodyOf(src: string, name: string): string | null {
  const m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const rest = src.slice(m.index);
  const end = rest.slice(1).search(/\n(?:export\s|async\s+function\s|function\s|\/\*\*)/);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

type Wire = { file: string; fn: string; call: string; times?: number };
const WIRES: readonly Wire[] = [
  { file: "src/outreach/trialCampaign.ts", fn: "artifactBlocks", call: "retiredTemplateReason(" },
  { file: "src/outreach/sendOutreachSms.ts", fn: "mobileOutreachGates", call: "retiredTemplateReason(" },
  { file: "src/outreach/autoDispatch.ts", fn: "enqueueDispatch", call: "retiredTemplateReason(" },
  { file: "src/trial/start.ts", fn: "startTrial", call: "currentTemplatePlanOf(" },
  { file: "src/trial/start.ts", fn: "currentTemplatePlanOf", call: "isCurrentTemplateArtifact(", times: 2 },
];

function checkWires(read: (file: string) => string, wires: readonly Wire[]): string[] {
  const errs: string[] = [];
  for (const w of wires) {
    const body = bodyOf(read(w.file), w.fn);
    if (!body) { errs.push(`${w.file}: nincs ${w.fn} függvény`); continue; }
    const n = body.split(w.call).length - 1;
    if (n < (w.times ?? 1)) errs.push(`${w.file} · ${w.fn}: nem hívja ${w.call.slice(0, -1)}-t (${n}/${w.times ?? 1})`);
  }
  return errs;
}

function checkDecision(decide: (inputs: unknown) => string | null): string[] {
  const errs: string[] = [];
  for (const t of ["parallax", "gate-opening", "wordmark-grow"]) {
    if (decide(engine(t)) !== null) errs.push(`a(z) ${t} a tulaj sablonja, mégis megfogja`);
  }
  for (const t of ["horizontal", "fullbleed", "tilted-gallery", "editorial", "nincs-ilyen"]) {
    if (decide(engine(t)) === null) errs.push(`a(z) ${t} kivezetett/ismeretlen, mégis átengedi`);
  }
  if (decide({ html: "<p>régi másolat</p>" }) === null) errs.push("a recept nélküli régi HTML-másolatot átengedi");
  return errs;
}

const files = new Map<string, string>();
for (const f of new Set(WIRES.map((w) => w.file))) files.set(f, await readFile(resolve(ROOT, f), "utf8"));
// The autoDispatch send path (the queue tick) is an unexported function: the file must carry
// the call at least twice (enqueue + send).
const autoDispatchCalls = files.get("src/outreach/autoDispatch.ts")!.split("retiredTemplateReason(").length - 1;

if (SELF_TEST) {
  const fake = new Map(files);
  fake.set("src/outreach/trialCampaign.ts", "export async function artifactBlocks(id) {\n  return null;\n}\n");
  const wireRed = checkWires((f) => fake.get(f)!, WIRES).length > 0;
  const decisionRed = checkDecision(() => null).length > 0;
  if (!wireRed || !decisionRed) {
    console.error(`✗ önteszt: az őr nem ment pirosra (bekötés: ${wireRed}, döntés: ${decisionRed})`);
    process.exit(1);
  }
  console.log("✓ önteszt: a hiányzó bekötésre és a rossz döntésre is piros");
  process.exit(0);
}

const errs = [...checkDecision(retiredTemplateReason), ...checkWires((f) => files.get(f)!, WIRES)];
if (autoDispatchCalls < 2) errs.push(`src/outreach/autoDispatch.ts: a sor küldése nem hívja retiredTemplateReason-t (${autoDispatchCalls}/2)`);
if (errs.length) {
  for (const e of errs) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(`✓ kivezetett sablon: a döntés helyes, ${WIRES.length + 1} bekötés megvan`);
