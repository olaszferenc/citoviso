// OUTREACH LETTER TRUTH guard — Elek SZ-5 / H-3, owner's rulings 2026-10-02 (ADR-0306).
//
// WHY THIS EXISTS. The cold letter and its SMS are a FIXED template: per lead only the name,
// the Google rating and the segment branch change. Every gate before this one judged ONE
// rendered letter, so a branch nobody happened to render shipped unread. Measured live on
// 2026-10-02 (read-only):
//   · the „elavult” branch told 256 of 388 leads „a honlapja telefonon nehezen boldogul” —
//     211 of those sites had merely failed to load, 45 HAD a mobile view;
//   · the „van_labnyom” branch („Saját, modern oldal viszont még nincs a képben.”) contradicts
//     the classification that selected it, on every lead it ever reaches;
//   · a 1-star lead was greeted with „A Google-on 1 csillagos, 26 vélemény alapján.”
// plus the language the owner rejected („nincs a képben”, „élesítjük”, „forinttól az Öné”,
// „listaáron megy”, „A Citoviso Csapata”).
//
// WHAT IT MEASURES. It renders EVERY branch (segment × site-check × rating band) of the cold
// letter, both SMS shapes and the escalation follow-up, then asserts:
//   ① no rejected phrase in any branch;
//   ② each segment sentence states only what its measurement supports;
//   ③ a rating is quoted only from MIN_QUOTED_STARS up, and then with both numbers;
//   ④ „Ezért …” (a consequence) only follows a stated gap;
//   ⑤ the wording has a recorded PASS from the landlord-eyed LLM critic for its EXACT
//      template fingerprint (src/outreach/letterCritic.verdict.json). A wording change
//      without a fresh critic run is red: `npx tsx scripts/outreach-letter-critic.mts --run`.
//
// Usage: npx tsx scripts/outreach-letter-truth-check.mts

import { readFileSync } from "node:fs";
import { loadPricing } from "../src/pricing.js";
import { prepareMailLang } from "../src/i18n/mail.js";
import * as draft from "../src/outreach/draft.js";
import { db } from "../src/db/client.js";
import { LETTER_CRITIC_SYSTEM, OWNER_RULINGS, letterTemplateFingerprint, letterTemplateStrings, personalSenderName, proposesPersonalName } from "../src/outreach/letterCritic.js";
import { config } from "../src/config.js";

const ROOT = new URL("..", import.meta.url).pathname;
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : `\n      ${JSON.stringify(detail).slice(0, 600)}`}`);
  }
}

/** Phrases the owner / Elek rejected — none may appear in ANY branch. */
const REJECTED: readonly [RegExp, string][] = [
  [/nincs a képben/iu, "tükörfordítás („nincs a képben”)"],
  [/vélemény alapján\./iu, "alany nélküli csonka mondat („… vélemény alapján.”)"],
  [/boldogul/iu, "megszemélyesítés („a honlap boldogul”)"],
  [/Citoviso Csapata/u, "angolos nagybetű („A Citoviso Csapata”)"],
  [/élesítjük/iu, "informatikus szakszó a szállásadónak („élesítjük”)"],
  [/forinttól az Öné/iu, "reklámszöveg-fordulat („forinttól az Öné”)"],
  [/listaáron megy/iu, "beszélt nyelvi zárás („listaáron megy”)"],
  [/Előzetes látványterv az Önről/iu, "kettőspontos keretezés („Előzetes látványterv az Önről…”)"],
  [/nem találtunk hozzá/iu, "lógó „hozzá”"],
  [/\ba\(z\)/iu, "„a(z)”"],
];

const SEGMENTS = ["nincs_honlap", "0_labnyom", "elavult", "van_labnyom", null] as const;
const SITE = ["unreachable", "no_viewport", "responsive", null] as const;
const RATINGS = [null, { value: 4.7, count: 134 }, { value: 4, count: 5 }, { value: 3.9, count: 40 }, { value: 1, count: 26 }] as const;

await loadPricing();
const lang = await prepareMailLang("hu");
// The OWNER's number (2026-10-02), not the module's: a check that read the threshold from the
// code under test would approve any threshold it was handed.
const MIN = 4;
check("a küszöb exportált konstans (MIN_QUOTED_STARS = 4)", (draft as { MIN_QUOTED_STARS?: number }).MIN_QUOTED_STARS === 4);

const bodies: { key: string; body: string; seg: string | null; site: string | null; rating: { value: number; count: number } | null }[] = [];
for (const seg of SEGMENTS)
  for (const site of SITE)
    for (const rating of RATINGS) {
      const d = {
        leadName: "Próba Panzió", region: "", qualification: null, segment: seg,
        rating: rating ? { ...rating } : null, token: "T".repeat(24), lang, siteCheck: site,
      } as draft.DraftInput;
      const r = draft.renderDraft(d);
      bodies.push({ key: `${seg}/${site}/${rating ? rating.value : "–"}`, body: r.body, seg, site, rating: rating ? { ...rating } : null });
      bodies.push({ key: `sms:${seg}`, body: draft.renderSmsDraft(d).text, seg, site, rating: null });
      bodies.push({ key: `pair:${seg}`, body: draft.renderPairSmsDraft(d).text, seg, site, rating: null });
    }

// ① rejected phrases, across every branch + the follow-up template source (same family)
// The follow-up shares the letter's voice; judge its customer strings (T() literals), not its comments.
const follow = [...readFileSync(`${ROOT}src/outreach/escalationFollowup.ts`, "utf8").matchAll(/\bT\(\s*lang\s*,\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => m[1])
  .join("\n");
for (const [re, why] of REJECTED) {
  const hit = bodies.find((b) => re.test(b.body));
  check(`① nincs: ${why}`, !hit && !re.test(follow), hit ? hit.key : re.test(follow) ? "escalationFollowup.ts" : undefined);
}

// ② segment sentence ↔ measurement
const letters = bodies.filter((b) => !b.key.startsWith("sms:") && !b.key.startsWith("pair:"));
const notFound = /nem találtunk|nincs\s+(?:még\s+)?(?:saját|modern)[^.]{0,20}oldal|oldal[^.]{0,25}\bnincs\b/iu;
check("② modern / elavult oldalnál a levél nem állítja, hogy nincs oldala",
  letters.every((b) => !(b.seg === "van_labnyom" || b.seg === "elavult") || !notFound.test(b.body)),
  letters.find((b) => (b.seg === "van_labnyom" || b.seg === "elavult") && notFound.test(b.body))?.key);
check("② „telefon” csak elérhető + mobil-nézet nélküli mérésnél",
  letters.every((b) => !/telefon/iu.test(b.body.split("\n\n")[1] ?? "") || (b.seg === "elavult" && b.site === "no_viewport")),
  letters.find((b) => /telefon/iu.test(b.body.split("\n\n")[1] ?? "") && !(b.seg === "elavult" && b.site === "no_viewport"))?.key);
check("② elavult + mobil-nézet nélkül: kimondja",
  letters.filter((b) => b.seg === "elavult" && b.site === "no_viewport").every((b) => /nincs telefonra igazítva/iu.test(b.body)));
check("② elavult + nem töltött be: csak ennyit, időponthoz kötve",
  letters.filter((b) => b.seg === "elavult" && b.site === "unreachable").every((b) => /nem tudtuk megnyitni, amikor megnéztük/iu.test(b.body)));
check("② nincs honlap / ismeretlen: „nem találtunk”",
  letters.filter((b) => b.seg === "nincs_honlap" || b.seg === "0_labnyom" || b.seg === null).every((b) => /Saját honlapot viszont nem találtunk\./u.test(b.body)));

// ③ rating band
const hook = (b: string) => b.split("\n\n")[1] ?? "";
check(`③ ${MIN} csillag alatt a levél nem idéz értékelést`,
  letters.filter((b) => b.rating && b.rating.value < MIN).every((b) => !/csillag|értékelés/iu.test(b.body)),
  letters.find((b) => b.rating && b.rating.value < MIN && /csillag|értékelés/iu.test(b.body))?.key);
check(`③ ${MIN} csillagtól mindkét szám, alanyos mondatban`,
  letters.filter((b) => b.rating && b.rating.value >= MIN).every((b) =>
    new RegExp(`Láttuk, hogy a Google-on ${b.rating!.count} értékelés alapján ${String(b.rating!.value).replace(".", ",")} csillagos\\.`, "u").test(hook(b.body))),
  letters.find((b) => b.rating && b.rating.value >= MIN)?.body.split("\n\n")[1]);

// ④ consequence only after a gap
const gap = (b: (typeof letters)[number]) =>
  b.seg !== "van_labnyom" && !(b.seg === "elavult" && (b.site === "responsive" || b.site === null));
check("④ „Ezért …” csak kimondott hiány után",
  letters.every((b) => /^Ezért /u.test(b.body.split("\n\n")[2] ?? "") === gap(b)),
  letters.find((b) => /^Ezért /u.test(b.body.split("\n\n")[2] ?? "") !== gap(b))?.key);
check("④ a demó-keretezés minden ágban megvan („látványterv, nem kész oldal”)",
  letters.every((b) => /látványterv, nem kész oldal/u.test(b.body)));

// ⑤ landlord-eyed LLM critic: PASS recorded for this exact template fingerprint
const fp = letterTemplateFingerprint;
let rec: { fingerprint?: string; verdict?: string } = {};
try {
  rec = JSON.parse(readFileSync(`${ROOT}src/outreach/letterCritic.verdict.json`, "utf8"));
} catch {
  /* missing record = red below */
}
check("⑤ a levél-sablon ujjlenyomatára rögzített PASS van (szállásadó-szemű kritikus)",
  rec.fingerprint === fp() && rec.verdict === "PASS",
  { recorded: rec.fingerprint ?? null, verdict: rec.verdict ?? null, current: fp() });

// ⑥ owner's standing rulings (2026-10-02): „nem lesz az sms-ben meg sehol sem a nevem hardcode. Citoviso.”
// The PERSONAL part only: the brand („Citoviso”) as sender name is the ruling itself, not a name.
const sender = personalSenderName(config.outreachSender.name);
check("⑥ a sablon-literálokban nincs fix személynév (az aláírás a konfigból jön)",
  !sender || letterTemplateStrings().every((t) => !t.includes(sender)),
  letterTemplateStrings().find((t) => sender && t.includes(sender)));
check("⑥ az SMS a márkával zár, személynév nélkül",
  bodies.filter((b) => b.key.startsWith("sms:") || b.key.startsWith("pair:")).every((b) => /A Citoviso csapata/u.test(b.body) && (!sender || !b.body.includes(sender))));
check("⑥ a kritikus szabályai tartalmazzák a tulaj-döntéseket (nem javasolhat személynevet; „kötelezettségmentesen” marad)",
  OWNER_RULINGS.length >= 2 && OWNER_RULINGS.every((r) => LETTER_CRITIC_SYSTEM.includes(r)));
const NAME_FIX = [{ fix: "Kiss Anna, Citoviso" }, { fix: "Citoviso — Nagy Péter" }, ...(sender ? [{ fix: `${sender}, Citoviso` }] : [])];
const BRAND_FIX = [{ fix: "A Citoviso csapata" }, { fix: "hagyd ki" }, { fix: "Citoviso" }];
check("⑥ a személynév-szűrő elkapja a névvel aláíró javaslatot, a márkát átengedi",
  NAME_FIX.every((o) => proposesPersonalName(o, sender)) && BRAND_FIX.every((o) => !proposesPersonalName(o, sender)));
check("⑥ a márka mint küldő-név NEM személynév, a mellette álló személynév igen",
  ["Citoviso", "citoviso.com", "A Citoviso csapata", " Citoviso "].every((n) => personalSenderName(n) === "") &&
    personalSenderName("Olasz Ferenc") === "Olasz Ferenc" && personalSenderName("Olasz Ferenc, Citoviso") === "Olasz Ferenc" &&
    personalSenderName("Citovisoék") === "Citovisoék",
  ["Citoviso", "A Citoviso csapata", "Olasz Ferenc, Citoviso", "Citovisoék"].map((n) => `${n} → „${personalSenderName(n)}”`));
check("⑥ márka küldő-névvel a szűrő a márkás aláírást átengedi, a személynevest elkapja",
  !proposesPersonalName({ fix: "A Citoviso csapata" }, "Citoviso") && !proposesPersonalName({ fix: "Citoviso" }, "Citoviso") &&
    proposesPersonalName({ fix: "Kiss Anna, Citoviso" }, "Citoviso"));
const recObj = (rec as { objections?: { fix: string }[] }).objections ?? [];
check("⑥ a rögzített ítéletben nincs személynevet javasló kifogás",
  recObj.every((o) => !proposesPersonalName(o, sender)), recObj.find((o) => proposesPersonalName(o, sender)));

await db.destroy();
if (failures) {
  console.error(`\n⛔ outreach-letter-truth-check: ${failures} bukott állítás (${bodies.length} renderelt ág).` +
    `\n   Sablon-változás után: npx tsx scripts/outreach-letter-critic.mts --run`);
  process.exit(1);
}
console.log(`\n✅ outreach-letter-truth-check: ${bodies.length} renderelt ág — a levél és az SMS minden ága igaz és emberi.`);
