/**
 * Kapu — az Elek-futó ÍTÉLETE vegye figyelembe a néma hibákat (ADR-0130 ②).
 *
 * Kiváltó (Elek FK-004, 2026-09-13): a runner lépésenként rögzítette a konzol-hibákat és a
 * HTTP >= 400 válaszokat a `result.jsonl`-be, majd az ítéletnél FIGYELMEN KÍVÜL HAGYTA őket.
 * A törött MMS-előnézet 404-e KÉT lépésen ott volt, mind a kettő `pass` lett, és csak egy
 * friss szemű kiértékelő olvasta ki a naplóból. Egy mérőeszköz, ami rögzíti a bukást és
 * zöldre értékeli, rosszabb, mint a semmi: bizalmat gyárt.
 *
 * Amit mér:
 *
 *  ① A tiszta osztályozó-logika (`classifyStepNoise`): a nem-tűrt hiba pirosra visz, a
 *     kimondott kivétel átmegy AZ INDOKKAL, a semmire nem illeszkedő minta kiíródik.
 *  ② A forgatókönyv-parser: `tűrt-hiba: <minta> — <indok>` beolvasódik, és INDOK NÉLKÜL
 *     hangosan bukik (a puszta minta néma bukás-engedély lenne).
 *  ③ ÉLES FUTÁS, negatívan ÉS pozitívan (ez a lényeg — a ① tiszta függvény akkor is zöld
 *     lehet, ha a runner sosem hívja meg):
 *       · egy fixture-forgatókönyv, ami ZÖLD ellenőrzésekkel 404-et hoz → a lépés `fail`,
 *         a hibaszöveg megnevezi a néma hibát, a futó exit-kódja 2;
 *       · UGYANAZ a fixture egyetlen `tűrt-hiba:` sorral → `pass`, és a 404 a
 *         `tolerated_errors`-ben ül az indokkal (a kivétel KIMONDOTT, nem alapértelmezés).
 *  ④ A valódi forgatókönyvek egyetlen `tűrt-hiba:` sora sem lehet indoklás nélküli, és a
 *     készlet parse-olható marad.
 *
 * Futtatás: npx tsx scripts/elek-noise-verdict-check.mts
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { classifyStepNoise, noiseErrorText } from "../src/elek/stepVerdict.js";
import { parseFk, listScenarios } from "../src/elek/fkParse.js";

const execFileP = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const TMP = path.join(ROOT, "elek", "runs", "_guard-noise");

let bad = 0;
const ok = (m: string): void => console.log(`  ✓ ${m}`);
const fail = (m: string): void => {
  bad++;
  console.log(`  ✗ ${m}`);
};
const check = (cond: boolean, m: string): void => (cond ? ok(m) : fail(m));

console.log("Elek néma-hiba kapu — egy lépés nem lehet zöld, ha hiba keletkezett rajta\n");

// ── ① az osztályozó ─────────────────────────────────────────────────────────
console.log("① osztályozó: mi visz pirosra, mi mehet át kimondva");
const err404 = "404 http://127.0.0.1:38581/prospect/abc/mms-preview.jpg";
const errCon = "Failed to load resource: the server responded with a status of 404 (Not Found)";

const plain = classifyStepNoise({ consoleErrors: [errCon], httpErrors: [err404], tolerated: [] });
check(plain.offending.length === 2, "kivétel nélkül MINDKÉT rögzített hiba pirosra visz");
check(plain.toleratedHits.length === 0, "nincs hallgatólagos tűrés");

const clean = classifyStepNoise({ consoleErrors: [], httpErrors: [], tolerated: [] });
check(clean.offending.length === 0, "hiba nélküli lépés tiszta marad (nem hamis pozitív)");

const frozen = classifyStepNoise({
  consoleErrors: [],
  httpErrors: ["503 http://127.0.0.1:36783/t/elek-teszt-vendeghaz/"],
  tolerated: [{ pattern: "503 /t/elek-teszt-vendeghaz/", reason: "a fagyasztott lap így felel" }],
});
check(frozen.offending.length === 0, "a kimondott kivétel átmegy (fagyasztott honlap 503-a)");
check(
  frozen.toleratedHits[0]?.reason === "a fagyasztott lap így felel",
  "az átengedett hiba VISZI az indokot (a napló megmondja, miért volt szabad)",
);
check(frozen.unusedPatterns.length === 0, "az illeszkedő minta nem számít elavultnak");

const stale = classifyStepNoise({
  consoleErrors: [],
  httpErrors: [err404],
  tolerated: [{ pattern: "503 /t/valami-mas/", reason: "régi engedmény" }],
});
check(stale.offending.length === 1, "a MÁSRA szóló kivétel nem takarja el az igazi hibát");
check(
  stale.unusedPatterns[0] === "503 /t/valami-mas/",
  "az illeszkedés nélküli minta kiíródik (elavult engedmény = hamis állítás a termékről)",
);
check(
  classifyStepNoise({
    consoleErrors: ["404 HTTP://127.0.0.1/X/MMS-PREVIEW.JPG"],
    httpErrors: [],
    tolerated: [{ pattern: "mms-preview.jpg", reason: "teszt" }],
  }).offending.length === 0,
  "az illesztés kis/nagybetű-érzéketlen (az efemer port miatt csak részszöveg írható)",
);
// A minta TOKENJEI külön illeszkednek: a rögzített szövegben a status és az útvonal
// között ott áll az efemer host — egyetlen részszövegként a „503 /t/…” sosem fogna.
check(
  classifyStepNoise({
    consoleErrors: [],
    httpErrors: ["404 http://127.0.0.1:5555/masik/utvonal"],
    tolerated: [{ pattern: "404 /t/elek-teszt-vendeghaz/", reason: "más lapra szól" }],
  }).offending.length === 1,
  "a token-illesztés nem válik parttalanná: a MÁSIK útvonal 404-e nem csúszik át",
);
check(noiseErrorText([err404]).includes("néma hiba a lépésen"), "a hibaszöveg megnevezi az osztályt");

// ── ② a parser ──────────────────────────────────────────────────────────────
console.log("\n② parser: a `tűrt-hiba:` indoka KÖTELEZŐ");
mkdirSync(TMP, { recursive: true });
const scenario = (turt: string): string =>
  `# FK-Z99 — Néma-hiba kapu fixture

cél: Egy szándékosan nem létező publikus útvonal: az ellenőrzések ZÖLDEK, a navigáció mégis 404.
felület: publikus

## Mérés

- [ ] A nem létező lap betölt (a lap létezik, a válasz 404)
  user: anon
  út: /nincs-ilyen-oldal-elek-nema-hiba-kapu
  várd: darab "body" >= 1
${turt}`;

const goodFile = path.join(TMP, "FK-Z99-tolerated.md");
const badFile = path.join(TMP, "FK-Z99-noreason.md");
const rawFile = path.join(TMP, "FK-Z99-raw.md");
writeFileSync(rawFile, scenario(""), "utf8");
writeFileSync(
  goodFile,
  scenario(
    '  tűrt-hiba: /nincs-ilyen-oldal-elek-nema-hiba-kapu — szándékosan nem létező útvonal: ITT a 404 a mérés TÁRGYA\n',
  ),
  "utf8",
);
writeFileSync(badFile, scenario("  tűrt-hiba: 404 valami\n"), "utf8");

const parsedGood = parseFk(goodFile);
const step = parsedGood.sections[0].steps[0];
check(step.turtHiba.length === 1, "a `tűrt-hiba:` sor beolvasódik");
check(
  step.turtHiba[0]?.pattern === "/nincs-ilyen-oldal-elek-nema-hiba-kapu" &&
    step.turtHiba[0].reason.includes("szándékosan"),
  "a minta és az indok külön áll (nem egy összeolvadt sztring)",
);
check(parseFk(rawFile).sections[0].steps[0].turtHiba.length === 0, "kivétel nélkül üres a lista");
let threw = "";
try {
  parseFk(badFile);
} catch (e) {
  threw = (e as Error).message;
}
check(
  threw.includes("tűrt-hiba") && threw.includes("KÖTELEZŐ"),
  `indok nélkül a parser HANGOSAN bukik (${threw ? "dobott" : "NEM dobott"})`,
);

// ── ③ éles futás, negatívan és pozitívan ────────────────────────────────────
console.log("\n③ ÉLES runner-futás — a szabály a futóban is érvényes");

interface RunOut {
  code: number;
  stdout: string;
  steps: Record<string, unknown>[];
}
async function runFixture(file: string): Promise<RunOut> {
  const before = new Set(existsSync(path.join(ROOT, "elek", "runs")) ? readdirSync(path.join(ROOT, "elek", "runs")) : []);
  let code = 0;
  let stdout = "";
  try {
    const r = await execFileP("npx", ["tsx", "elek/bin/runner.mts", file], {
      cwd: ROOT,
      timeout: 180_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = r.stdout;
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    code = typeof err.code === "number" ? err.code : 1;
    stdout = err.stdout ?? "";
    if (!stdout) throw e;
  }
  const dirs = readdirSync(path.join(ROOT, "elek", "runs")).filter(
    (d) => d.startsWith("FK-Z99-") && !before.has(d),
  );
  const dir = dirs.sort().at(-1);
  const steps = dir
    ? readFileSync(path.join(ROOT, "elek", "runs", dir, "result.jsonl"), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>)
    : [];
  if (dir) rmSync(path.join(ROOT, "elek", "runs", dir), { recursive: true, force: true });
  return { code, stdout, steps };
}

// NEGATÍV: nincs kivétel → a lépés PIROS, pedig a `várd:` mind zöld
const neg = await runFixture(rawFile);
const negStep = neg.steps[0] ?? {};
check(
  Array.isArray(negStep.checks) && (negStep.checks as { ok: boolean }[]).every((c) => c.ok),
  "a fixture `várd:` ellenőrzései ZÖLDEK (a piros tehát CSAK a néma hibából jön)",
);
check(
  Array.isArray(negStep.http_errors) && (negStep.http_errors as string[]).some((h) => h.startsWith("404 ")),
  "a 404 rögzítve van a lépésen",
);
check(negStep.status === "fail", `a lépés PIROS a rögzített 404 miatt (status=${String(negStep.status)})`);
check(
  String(negStep.error ?? "").includes("néma hiba a lépésen"),
  "a lépés hibaszövege megnevezi, hogy néma hiba miatt piros",
);
check(neg.code === 2, `a futó exit-kódja 2 (mérve: ${neg.code}) — a run-all is látja`);
check(neg.stdout.includes("⛔"), "a futás összegzése KIMONDJA a néma hibát (nem csak a JSONL-ben van)");

// POZITÍV: ugyanaz a 404, kimondott kivétellel → ZÖLD, az indok a naplóban
const pos = await runFixture(goodFile);
const posStep = pos.steps[0] ?? {};
check(posStep.status === "pass", `kimondott kivétellel a lépés ZÖLD (status=${String(posStep.status)})`);
check(
  Array.isArray(posStep.http_errors) && (posStep.http_errors as string[]).length === 1,
  "a hiba TOVÁBBRA IS rögzítve van (nem tüntettük el, csak megengedtük)",
);
check(
  Array.isArray(posStep.tolerated_errors) &&
    (posStep.tolerated_errors as { reason: string }[])[0]?.reason.includes("szándékosan"),
  "a `tolerated_errors` viszi az INDOKOT is",
);
check(pos.code === 0, `a futó exit-kódja 0 (mérve: ${pos.code})`);

// ── ④ a valódi készlet ──────────────────────────────────────────────────────
console.log("\n④ a valódi forgatókönyvek");
let scenarioCount = 0;
let toleratedLines = 0;
try {
  for (const s of listScenarios()) {
    scenarioCount++;
    for (const sec of s.sections) {
      for (const st of sec.steps) {
        for (const t of st.turtHiba) {
          toleratedLines++;
          if (!t.reason || t.reason.length < 10) fail(`${s.id}: indoklás nélküli tűrt-hiba (${t.pattern})`);
        }
      }
    }
  }
  ok(`mind a ${scenarioCount} forgatókönyv parse-olható · ${toleratedLines} kimondott kivétel`);
} catch (e) {
  fail(`a készlet nem parse-olható: ${(e as Error).message}`);
}

rmSync(TMP, { recursive: true, force: true });
console.log(bad ? `\n⛔ ${bad} sértés` : "\n✅ néma-hiba kapu: az ítélet a rögzített hibákat is számolja");
process.exit(bad ? 1 : 0);
