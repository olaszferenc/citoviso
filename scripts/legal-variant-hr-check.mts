// HR LEGAL VARIANT — DRAFT GUARD (ADR-0471, JAVASLAT). The Croatian-law draft of the legal pack
// (src/legalVariantHR.ts) is a set of SOURCE-unit replacements that stays SWITCHED OFF until the
// owner (and the lawyer) approve it. This check proves the draft is harmless and still current:
//
//   ① switched off: `enabled === false`, status "draft";
//   ② disconnected: no module under src/ imports the variant (only this check and the export);
//   ③ current: every replaced `hu` unit is a live source unit of TODAY's HR pack (legalSources),
//      so a change of the Hungarian wording shows up here as a stale draft, not as a silent miss;
//   ④ well-formed: the variant keeps the unit's placeholders and markup (legalUnitProblem), names
//      at least one official source, and every source / lawyer-question id it cites exists;
//   ⑤ honest: no Hungarian statute or authority survives in a variant text (45/2014, Grt., NAIH,
//      Eker.tv., 2001. évi CVIII., 2000. évi C., „magyar jog”, kormányhivatal) unless the unit is
//      marked `keepsHu` with a reason (a Hungarian-law point that stays by design);
//   ⑥ today's HR pack is untouched: complete in `hr`, and every replaced unit still translates to
//      the committed HR.json entry (the live pack never sees the variant).
//
//   npx tsx scripts/legal-variant-hr-check.mts            → the checks (exit 1 on a failure)
//   npx tsx scripts/legal-variant-hr-check.mts --export   → the Bábel worksheet (JSON, stdout)
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { legalPackRaw, legalPackStatus, legalSources, legalUnitProblem, normUnit, LEGAL_PACK_BASE } from "../src/legalPack.ts";
import { LEGAL_VARIANT_HR } from "../src/legalVariantHR.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const V = LEGAL_VARIANT_HR;

if (process.argv.includes("--export")) {
  // The worksheet Bábel fills: the VARIANT Hungarian source → Croatian. The key is the whole unit,
  // exactly like src/i18n/babel/legal/<CC>.json; nothing here is loaded by the live pack.
  const entries = Object.fromEntries(V.units.map((u) => [normUnit(u.variant), ""]));
  console.log(JSON.stringify({ country: V.country, variant: V.variant, lang: "hr", base: V.base, entries }, null, 1));
  process.exit(0);
}

let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`⛔ ${msg}`);
    fail++;
  }
};

// ① switched off
ok(V.enabled === false && V.status === "draft", "① a HR-variáns KIKAPCSOLT tervezet (enabled=false, status=draft)");

// ② disconnected
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|mts|js|mjs)$/.test(f) ? [p] : [];
  });
}
const importers = walk(path.join(ROOT, "src"))
  .filter((p) => !p.endsWith("legalVariantHR.ts"))
  .filter((p) => /legalVariantHR/.test(readFileSync(p, "utf8")))
  .map((p) => path.relative(ROOT, p));
ok(importers.length === 0, `② élő modul nem importálja a variánst${importers.length ? ` — ${importers.join(", ")}` : ""}`);

// ③ current
const sources = await legalSources("HR");
const stale = V.units.filter((u) => !sources.has(normUnit(u.hu)));
ok(V.base === LEGAL_PACK_BASE, `③ a variáns a mai forrásverzióra épül (${V.base} = ${LEGAL_PACK_BASE})`);
ok(stale.length === 0, `③ minden lecserélt egység a mai HR-csomag forrás-egysége (${V.units.length - stale.length}/${V.units.length})`);
for (const u of stale) console.error(`   elavult: ${u.id} — „${u.hu.slice(0, 70)}…”`);
const ids = V.units.map((u) => u.id);
ok(new Set(ids).size === ids.length, "③ az egység-azonosítók egyediek");
const dupHu = V.units.length - new Set(V.units.map((u) => normUnit(u.hu))).size;
ok(dupHu === 0, "③ egy forrás-egységet egy variáns cserél");

// ④ well-formed
for (const u of V.units) {
  const p = legalUnitProblem(u.hu, u.variant);
  if (p) ok(false, `④ ${u.id}: ${p}`);
  if (normUnit(u.hu) === normUnit(u.variant)) ok(false, `④ ${u.id}: a variáns azonos a mai szöveggel`);
  if (!u.basis.length) ok(false, `④ ${u.id}: nincs hivatalos forrás`);
  for (const b of u.basis) if (!V.sources[b]) ok(false, `④ ${u.id}: ismeretlen forrás „${b}”`);
  for (const q of u.lawyer ?? []) if (!V.lawyerQuestions.some((x) => x.id === q)) ok(false, `④ ${u.id}: ismeretlen ügyvédi kérdés „${q}”`);
}
for (const [id, s] of Object.entries(V.sources)) {
  if (!/^https:\/\//.test(s.url) || !/^\d{4}-\d{2}-\d{2}$/.test(s.accessed)) ok(false, `④ forrás ${id}: URL vagy dátum hiányzik`);
}
ok(fail === 0, `④ ${V.units.length} egység: helyőrző/jelölés ép, forrás és kérdés-hivatkozás létezik`);

// ⑤ honest
const HU_LAW = /45\/2014|Grt\.|NAIH|Eker\.?\s*tv|CVIII|2000\. évi C\.|magyar jog|kormányhivatal|Nemzeti Adatvédelmi/;
const leftovers = V.units.filter((u) => HU_LAW.test(u.variant) && !u.keepsHu);
ok(leftovers.length === 0, "⑤ a variáns-szövegekben nincs magyar jogszabály/hatóság (kivéve a jelölt, szándékos pontokat)");
for (const u of leftovers) console.error(`   ${u.id}: ${u.variant.match(HU_LAW)?.[0]}`);

// ⑥ today's HR pack untouched
const st = await legalPackStatus("HR", "hr");
ok(st.complete, `⑥ a mai HR-csomag teljes (${st.total} egység, hiány ${st.missing})`);
const pack = legalPackRaw("HR", "hr");
const committed = JSON.parse(readFileSync(path.join(ROOT, "src/i18n/babel/legal/HR.json"), "utf8")) as { entries: Record<string, string> };
const byKey = new Map(Object.entries(committed.entries).map(([k, v]) => [normUnit(k), v]));
const drift = pack ? V.units.filter((u) => pack.t(u.hu) !== byKey.get(normUnit(u.hu))) : V.units;
ok(drift.length === 0, "⑥ a lecserélt egységek élesen ma is a véglegesített HR.json fordítását adják (a variáns nem ér el az élő csomagig)");

console.log(fail ? `\n⛔ ${fail} hiba` : `\n✅ HR-variáns tervezet: ${V.units.length} egység, ${V.lawyerQuestions.length} ügyvédi kérdés, kikapcsolva`);
process.exit(fail ? 1 : 0);
