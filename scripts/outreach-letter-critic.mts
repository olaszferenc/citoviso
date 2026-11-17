// Run the landlord-eyed critic over every branch of the cold letter + SMS and record the
// verdict against the template fingerprint (src/outreach/letterCritic.ts, ADR-0306).
//
// Usage:
//   npx tsx scripts/outreach-letter-critic.mts         → status only (no AI call)
//   npx tsx scripts/outreach-letter-critic.mts --run   → one critic run (claude CLI, subscription — no API), writes the verdict
//   npx tsx scripts/outreach-letter-critic.mts --run --country=BG → ORSZÁG-RÉTEG 3/6: the letter in that country's
//     language (Bábel's pack), read by a landlord of that country (letterCriticSystem); prints, writes no verdict
//     (the recorded verdict is the Hungarian template's).
//
// A FLAG verdict is recorded too (the gate stays red) — fix the wording and run again.

import { readFileSync, writeFileSync } from "node:fs";
import { loadPricing } from "../src/pricing.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import { renderDraft, renderPairSmsDraft, renderSmsDraft, type DraftInput } from "../src/outreach/draft.js";
import { critiqueLetter, MODEL, letterTemplateFingerprint, letterTemplateStrings, type LetterBranch } from "../src/outreach/letterCritic.js";
import { db } from "../src/db/client.js";

const VERDICT = new URL("../src/outreach/letterCritic.verdict.json", import.meta.url);
const fp = letterTemplateFingerprint();
let rec: { fingerprint?: string; verdict?: string } = {};
try {
  rec = JSON.parse(readFileSync(VERDICT, "utf8"));
} catch {
  /* none yet */
}
console.log(`sablon-ujjlenyomat: ${fp} · rögzített: ${rec.fingerprint ?? "—"} (${rec.verdict ?? "nincs ítélet"})`);
if (!process.argv.includes("--run")) {
  await db.destroy();
  process.exit(rec.fingerprint === fp && rec.verdict === "PASS" ? 0 : 1);
}

await loadPricing();
const countryArg = process.argv.find((a) => a.startsWith("--country="))?.slice("--country=".length).toUpperCase();
const { countryConfigSync } = await import("../src/country.js");
const { langName } = await import("../src/i18n/lang.js");
const countryRow = countryArg ? countryConfigSync(countryArg) : null;
if (countryArg && !countryRow) {
  console.error(`⛔ ismeretlen ország az ország-rétegben: ${countryArg}`);
  process.exit(2);
}
const foreign = countryRow && countryRow.defaultLang !== "hu" ? { languageName: langName(countryRow.defaultLang), countryName: countryRow.name } : undefined;
const lang = await prepareMailLang(countryRow?.defaultLang ?? "hu");
// trialDays: the trial sentence is part of the wording the critic judges (owner 2026-10-27).
const base = { leadName: "Rozé Fogadó", region: "", qualification: null, token: "T".repeat(24), lang, trialDays: 14 } as const;
const SITUATIONS: { label: string; d: Partial<DraftInput> }[] = [
  { label: "nincs saját honlapja; Google 4,7 ★ / 91 értékelés", d: { segment: "nincs_honlap", rating: { value: 4.7, count: 91 } } },
  { label: "nincs saját honlapja; nincs Google-értékelése (vagy 4,0 alatti)", d: { segment: "nincs_honlap", rating: null } },
  { label: "van régi honlapja, de a cég ellenőrzésekor nem töltött be; Google 4,1 ★ / 182", d: { segment: "elavult", siteCheck: "unreachable", rating: { value: 4.1, count: 182 } } },
  { label: "van régi honlapja, betölt, de nincs mobil-nézete; Google 4,5 ★ / 718", d: { segment: "elavult", siteCheck: "no_viewport", rating: { value: 4.5, count: 718 } } },
  { label: "van régi honlapja, mobilos, csak régi jelei vannak (flash, régi ©); nincs értékelés", d: { segment: "elavult", siteCheck: "responsive", rating: null } },
  { label: "van modern saját honlapja; Google 4,3 ★ / 352", d: { segment: "van_labnyom", rating: { value: 4.3, count: 352 } } },
];
const branches: LetterBranch[] = SITUATIONS.map((s) => ({ label: `LEVÉL — ${s.label}`, text: renderDraft({ ...base, segment: null, rating: null, ...s.d } as DraftInput).body }));
const d0 = { ...base, segment: "nincs_honlap", rating: null } as DraftInput;
branches.push({ label: "SMS — önálló megkeresés", text: renderSmsDraft(d0).text });
branches.push({ label: "SMS — az MMS-kép után érkező párja", text: renderPairSmsDraft(d0).text });
const follow = letterTemplateStrings().filter((s) => /Döntés-segítő|többször is megnézte|Szeretnénk segíteni|kedvezményes ár már be van/u.test(s));
// A foreign run reads the reminder's sentences in the country's language (Bábel's pack).
const { tSync } = await import("../src/i18n/packs.js");
branches.push({ label: "EMLÉKEZTETŐ-LEVÉL (aki többször megnézte a tervét) — a sablon mondatai", text: follow.map((x) => (foreign ? tSync(lang, x) : x)).join("\n\n") });

const res = await critiqueLetter(branches, foreign);
const blocking = res.objections.filter((o) => o.severity === "blokkolo");
const verdict = blocking.length ? "FLAG" : "PASS";
if (!foreign) writeFileSync(
  VERDICT,
  JSON.stringify({ fingerprint: fp, verdict, model: `${MODEL} (claude CLI, előfizetés)`, at: new Date().toISOString(), branches: branches.length, plan: res.plan, objections: res.objections }, null, 2) + "\n",
);
console.log(`\n${verdict === "PASS" ? "✅" : "⛔"} ítélet: ${verdict} — ${blocking.length} blokkoló, ${res.objections.length - blocking.length} javítandó`);
for (const o of res.objections) console.log(`  [${o.severity}] ${o.kind} · ${o.branch}\n     „${o.quote}” → ${o.fix}`);
await db.destroy();
process.exit(verdict === "PASS" ? 0 : 1);
