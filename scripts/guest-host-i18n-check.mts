// GUEST-HOST i18n guard — a tenant SAJÁT hostján egyetlen válasz sem beszélhet
// beégetett magyarul, a 404-ek és az elutasítások sem.
//
//   npx tsx scripts/guest-host-i18n-check.mts [--self-test]
//
// ⛔⛔ MIÉRT KELL KÜLÖN ŐR (mérve 2026-09-15, ADR-0157 ⑦ átadó-listája).
// A `serveTenantHost()` tizenegy válasza beégetett magyar volt — a foglalás és az
// érdeklődés hibaüzenetei, és MINDEN 404-es lap. Egy horvát szállás vendége horvát
// oldalon kapott magyar elutasítást, miközben a nyelv KÉZNÉL VOLT (`site.tenantId`).
//
// Az `i18n-lint.mts` ezt nem tudja megfogni, és ez NEM az ő hibája: a `public.ts`
// nem vehető fel a lint listájára, amíg a SAJÁT magyar marketing-landingünk
// szövegeinek fordítása nyitott ÜZLETI kérdés. Ez az őr ezért nem fájlra, hanem
// EGYETLEN FÜGGVÉNYRE mér — pontosan arra a felületre, ahol a tenant VENDÉGE jár.
//
// ⛔ ÉS EGY VAKFOLTOT IS BEZÁR: az `i18n-lint` magyar-heurisztikája ÉKEZETRE néz
// (`[áéíóöőúüű]`), ezért a „Nincs ilyen oldal." — amiben egyetlen ékezet sincs —
// SOHA nem akadt volna fenn rajta. Itt ezért ékezet ÉS gyakori magyar szótő is
// jelez.

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = "src/server/public.ts";
const FN = "async function serveTenantHost(";

const selfTest = process.argv.includes("--self-test");

/**
 * A mért függvény TÖRZSE a termék forrásából.
 *
 * ⛔ Ha a függvényt átnevezik vagy áthelyezik, ez DOBJON — ne mérjen némán üres
 * szövegen (feedback_fixture_must_prove_its_own_path: egy elgépelt kulcs miatt
 * 17 sablon mérése futott ugyanarra a lapra, csupa zölddel).
 */
function functionBody(src: string): string {
  const at = src.indexOf(FN);
  if (at < 0) {
    throw new Error(
      `a mért függvény NINCS MEG: „${FN}” a ${FILE}-ban — átnevezték? ` +
        `Az őr inkább dobja el magát, mint hogy üres törzsön mérjen zöldet.`,
    );
  }
  // A törzs a következő oszlop-0-ás `}`-ig tart (a fájl prettier-formázott).
  const end = src.indexOf("\n}\n", at);
  if (end < 0) throw new Error(`a(z) „${FN}” záró zárójele nem található`);
  return src.slice(at, end);
}

/** Kommentek el — a doktrína a RENDERELT szövegre szól, nem a magyarázatra. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** A rendesen BURKOLT hívások el: `T(lang, "…")`, `T(consoleLang(), "…")`, `tr("…")`. */
function stripWrapped(s: string): string {
  return s
    .replace(/\bT\(\s*[a-zA-Z_$][\w$]*(?:\.[\w$]+)*(?:\([^()]*\))?\s*,\s*"(?:[^"\\]|\\.)*"/g, "T(_,_W_")
    .replace(/\btr\(\s*"(?:[^"\\]|\\.)*"\s*\)/g, "tr(_W_)");
}

const ACCENT = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
/**
 * ÉKEZET NÉLKÜLI magyar. Szűk, szándékosan: ezek a szavak kód-tokenben gyakorlatilag
 * nem fordulnak elő, prózában viszont igen. A „Nincs ilyen oldal." mind a hármat hozza.
 */
const HU_WORDS = /\b(nincs|sincs|ilyen|oldal|oldalt|nem|van|kell|lehet|hiba|hibas)\b/i;

/** Szöveg-e egyáltalán? Egy-szavas technikai token (pl. "no-store") nem próza. */
function looksLikeProse(t: string): boolean {
  return t.split(/\s+/).filter(Boolean).length >= 2;
}

interface Hit {
  readonly text: string;
  readonly why: string;
}

/**
 * ⚠️ SORONKÉNT pásztázunk, nem a teljes törzsön egyben.
 * Mérve: egy törzs-széles `/"…"/g` a korábbi idézőjelekhez igazodva ELCSÚSZIK
 * (regex-literálok, escape-elt idézőjelek), és a keresett stringet EGYÁLTALÁN nem
 * találja meg — a saját öntesztem buktatta le, mielőtt zöldet jelenthettem volna
 * egy vak őrre. A sor-szintű pásztázás az elcsúszást egy sorra korlátozza; ezt az
 * `i18n-lint.mts` is így csinálja.
 */
function rawHungarian(body: string): Hit[] {
  const clean = stripWrapped(stripComments(body));
  const out: Hit[] = [];
  const seen = new Set<string>();
  const literals: string[] = [];
  for (const line of clean.split("\n")) {
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)+)"/g)) literals.push(m[1]!);
    for (const m of line.matchAll(/`([^`]*)`/g)) literals.push(m[1]!);
  }
  for (const raw of literals) {
    const text = raw
      .replace(/\$\{[^}]*\}/g, " ") // sablon-behelyettesítés
      .replace(/<[^>]*>/g, " ") // HTML-tagek
      .replace(/\s+/g, " ")
      .trim();
    if (!text || seen.has(text)) continue;
    const accented = ACCENT.test(text);
    const wordy = HU_WORDS.test(text);
    if (!accented && !wordy) continue;
    if (!looksLikeProse(text)) continue;
    seen.add(text);
    out.push({
      text,
      why: accented ? "ékezetes magyar" : "ÉKEZET NÉLKÜLI magyar (a lint nem látná)",
    });
  }
  return out;
}

const src = await readFile(path.join(ROOT, FILE), "utf8");
let body: string;
try {
  body = functionBody(src);
} catch (err) {
  // Olvasható bukás, nem nyers stack: a pre-commit kimenetében ez az egyetlen
  // esély arra, hogy valaki megértse, miért állt meg a commitja.
  console.error(`⛔ guest-host-i18n-check: ${(err as Error).message}`);
  process.exit(1);
}

console.log(
  `guest-host-i18n-check: beégetett magyar a ${FILE} → ${FN.replace("async function ", "").replace("(", "()")} törzsében`,
);
console.log(`  törzs: ${body.split("\n").length} sor a termék forrásából`);

if (selfTest) {
  // ── PIROS ÖNTESZT ────────────────────────────────────────────────────────
  // A visszarontás a VALÓDI törzsbe helyettesít, nem beírt ál-kódba: ha a termék
  // szövege megváltozik, az önteszt HANGOSAN bukik, nem mér csendben mást.
  const PROBES: ReadonlyArray<{ from: string; to: string; label: string }> = [
    {
      from: '`<h1>${T(lang, "Nincs ilyen oldal.")}</h1>`',
      to: '"<h1>Nincs ilyen oldal.</h1>"',
      label: "ÉKEZET NÉLKÜLI 404-lap (ezt a lint sosem látná)",
    },
    {
      from: '[T(lang, "Ismeretlen szállás.")]',
      to: '["Ismeretlen szállás."]',
      label: "ékezetes JSON-hibaüzenet",
    },
    {
      from: '`<h1>${T(lang, "Az oldal pillanatkép nem található.")}</h1>`',
      to: '"<h1>Az oldal pillanatkép nem található.</h1>"',
      label: "ékezetes 404-lap a pillanatkép-ágon",
    },
  ];
  let failed = 0;
  for (const p of PROBES) {
    if (!body.includes(p.from)) {
      console.error(
        `\n⛔ ÖNTESZT BUKÁS: a visszarontás nem illeszkedik — a termék kódja megváltozott:\n     ${p.from}\n   Az őr így NEM azt méri, amit hisz; frissítsd a PROBES-t.`,
      );
      process.exit(1);
    }
    const hits = rawHungarian(body.replace(p.from, p.to));
    const caught = hits.some((h) => p.to.includes(h.text.split(" ").slice(0, 3).join(" ")));
    console.log(`  ${caught ? "✓" : "⛔"} ${p.label} — ${hits.length} találat`);
    if (!caught) failed++;
  }
  if (failed) {
    console.error(`\n⛔ ÖNTESZT BUKÁS: ${failed} visszarontást NEM vett észre az őr.`);
    process.exit(1);
  }
  // ÁLPOZITÍV-kontroll: a tiszta törzsön némának kell lennie.
  const cleanHits = rawHungarian(body);
  if (cleanHits.length) {
    console.error(
      `\n⛔ ÖNTESZT BUKÁS: a JAVÍTOTT törzsön is talált ${cleanHits.length} „sértést” — álpozitív:`,
    );
    for (const h of cleanHits) console.error(`     „${h.text.slice(0, 80)}” (${h.why})`);
    process.exit(1);
  }
  console.log(
    `\n✅ önteszt: mind a ${PROBES.length} visszarontás fennakadt, a javított törzs pedig néma (0 álpozitív).`,
  );
  process.exit(0);
}

const hits = rawHungarian(body);
if (hits.length) {
  console.error(`\n⛔ ${hits.length} beégetett magyar szöveg a vendég hostján:`);
  for (const h of hits) console.error(`   · „${h.text.slice(0, 90)}”  — ${h.why}`);
  console.error(
    `\n   A nyelv KÉZNÉL VAN: \`const lang = await tenantLang();\` majd \`T(lang, "…")\`.\n` +
      `   ⚠️ NE \`T(await tenantLang(), "…")\` — a katalógus-betakarító azonosítót vár,\n` +
      `      az await-alak nem illeszkedik rá, és a string kimarad a nyelvi csomagból.`,
  );
  process.exit(1);
}
console.log("✅ guest-host-i18n-check: a vendég hostján minden válasz nyelvi csomagból olvas.");
