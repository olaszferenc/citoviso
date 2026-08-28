// DERIVED i18n scope guard (ADR-0070 ②) — the list is no longer the doctrine.
//
// ⛔ WHY: the doctrine used to reach exactly as far as a HAND-KEPT file list, and
// that failed twice the same way: a file that builds customer text simply never
// got listed, every gate stayed green, and the miss surfaced only by luck or by
// the owner's own eyes. The last hole was src/outreach/draft.ts — the ENTIRE
// cold-outreach subject+body, 0 T() calls, masked only by the ADR-0036 country
// gate happening to keep every recipient Hungarian.
//
// WHAT THIS DOES: it DERIVES which files can put text in front of a customer,
// from the import graph — no human memory involved:
//
//   seed   = every file that imports the mail adapter (src/email/sender.js),
//            i.e. everything that can actually SEND;
//   scope  = the seeds plus their transitive imports (text is typically built in
//            a helper the sender-caller imports — draft.ts is exactly that);
//   flag   = scope ∩ { files containing Hungarian-looking string literals } that
//            are NEITHER on I18N_SOURCES NOR a justified exception.
//
// The hand lists remain, but demoted: I18N_SOURCES says "wrapped and harvested",
// EXCEPTIONS says "deliberately not translated, and here is why". A NEW file that
// feeds the mail path with Hungarian text is caught the moment it exists.
//
//   npx tsx scripts/i18n-scope.mts            — the gate
//   npx tsx scripts/i18n-scope.mts --self-test — red self-test (must detect)

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { I18N_SOURCES } from "./i18n-sources.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Files inside the derived scope that hold Hungarian text ON PURPOSE, each with
 * the reason it is exempt. Every entry is a hole — keep it short and justified.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  // Legal wording is a per-country LEGAL pack (§B.18, ADR-0067 ②): a mistranslated
  // ÁSZF is a liability, not a UI bug. Never machine translation.
  "src/legal.ts": "jogi szöveg — országonkénti JOGI csomag, nem gépi fordítás",
  // DATA registries: their literals are harvested BY FIELD NAME (extract-i18n) and
  // translated at render time via T(lang, m.label). Wrapping them here would break
  // the harvest (ADR-0067 ②).
  "src/modules.ts": "adat-regiszter — mezőnév szerinti betakarítás fordítja",
  "src/moduleConfig.ts": "adat-regiszter — mezőnév szerinti betakarítás fordítja",
  "src/domains.ts": "adat-regiszter (domain-ajánló szótöve) — nem levél-szöveg",
  // Operator-only pipeline reporting: reasons shown in the CONSOLE RUN REPORT,
  // never sent to the recipient (the mail body comes from draft.ts).
  "src/outreach/sendBatch.ts": "operátor-riport (skip-okok) — a címzett sosem látja",
  "src/outreach/outreachCheck.ts": "§C-kapu indoklásai — operátori verdikt-szöveg",
  "src/generator/provenanceCheck.ts": "§A-kapu verdikt-indoklásai — operátor/kurátor látja",
  "src/scraper/persist.ts": "scrape-összegző a konzol futás-riportjában — operátor látja",
  // ADR-0080: az SMS törzse KÉSZRE FORDÍTVA érkezik (billingEmail.ts, T()); ez a
  // fájl csak a kézbesítés kimenetelét naplózza az operátornak.
  "src/sms/sender.ts": "SMS-transzport — magyar szöveg csak operátor-napló, a törzs T()-ből jön",
  "src/payment/service.ts": "webhook-diszpécser — magyar szöveg csak operátor-napló (console.*)",
  "src/intake/mockRequest.ts":
    "a minta-igénylő űrlap válaszai a PUBLIKUS honlapon élnek — az ma egynyelvű magyar (§B.18 post-pilot adósság, ott konvertálandó)",
  "src/i18n/lang.ts": "LANG_NAME adat-térkép — a langNameLocalized fordítja literál T()-kkel",
  "src/i18n/packs.ts":
    "az AI-fordító PROMPTJA magyar (a fordítás utasítása) — modell-bemenet, sosem vevő-szöveg",
  // ADR-0078: a domain-beszerzés állapotgépe. A magyar szövegei KIVÉTEL NÉLKÜL
  // naplóüzenetek és dobott hibák (operátor/diagnosztika); a tenantnak szóló szöveg a
  // domainEmail.ts-ben él, ami RAJTA VAN az I18N_SOURCES listán.
  "src/domains/provisionDomain.ts":
    "beszerzés-napló és dobott hibák — operátor látja; a tenant-szöveg a domainEmail.ts-ben van",
  // A tenant-tartalom szerkesztője: a „Férőhely" / „fő" a SiteData-ba írt FORRÁS-string
  // (a kulcs maga a magyar szöveg, §B.18) — a vendég-oldalon a string-kulcsú fordítás
  // (ADR-0063 multilang) fordítja, ugyanaz a minta, mint a fenti adat-regisztereknél.
  // A scope-ba a domain-átköltöztetés re-renderelése (rerenderTenantSnapshot) hozta be.
  "src/tenant/editor.ts":
    "SiteData forrás-stringek (Férőhely/fő) — string-kulcsú fordítás fordítja, mint az adat-regisztereket",
};

const HU = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const SENDER = "src/email/sender.ts";

/** All .ts sources under src/, relative paths. */
async function listSources(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts"))
        out.push(path.join(dir, e.name));
    }
  }
  await walk("src");
  return out;
}

/** file → the src/ files it imports (relative import specifiers resolved). */
function importsOf(rel: string, src: string): string[] {
  const dir = path.dirname(rel);
  const out: string[] = [];
  for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
    let spec = m[1]!;
    spec = spec.replace(/\.js$/, ".ts");
    if (!spec.endsWith(".ts")) spec += ".ts";
    out.push(path.normalize(path.join(dir, spec)));
  }
  return out;
}

/** Does this file contain a customer-suspicious Hungarian literal?
 *  (Comments, operator logs and i18n-exempt lines are ignored — same contract
 *  as i18n-lint; T()-wrapped strings are FINE, they are the goal.) */
function hasBareHungarian(src: string): boolean {
  // Strip WHOLE console.<x>(...) calls first, paren-balanced: operator logs often
  // span lines (`console.error(\n  "…"\n)`), and a line-scoped skip missed them —
  // measured: three files flagged purely for their own log strings.
  let out = "";
  let i = 0;
  while (i < src.length) {
    const m = /console\.(log|error|warn)\s*\(/.exec(src.slice(i));
    if (!m) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, i + m.index);
    let j = i + m.index + m[0].length;
    let depth = 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") depth--;
      j++;
    }
    i = j;
  }
  src = out;
  for (let line of src.split("\n")) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (/i18n-exempt/.test(line)) continue;
    line = line
      .replace(/\bT\(\s*[a-zA-Z_$][\w$]*(?:\.[\w$]+)*\s*,\s*"(?:[^"\\]|\\.)*"/g, "T(_)")
      .replace(/\btr\(\s*"(?:[^"\\]|\\.)*"\s*\)/g, "tr(_)");
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)+)"|`([^`]*)`/g)) {
      const text = (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, "");
      if (HU.test(text)) return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  const files = await listSources();
  const sources = new Map<string, string>();
  for (const f of files) sources.set(f, await readFile(path.join(ROOT, f), "utf8"));

  const graph = new Map<string, string[]>();
  for (const [f, src] of sources) graph.set(f, importsOf(f, src).filter((i) => sources.has(i)));

  // Seeds: everything that imports the mail adapter — everything that can SEND.
  const seeds = files.filter((f) => graph.get(f)!.includes(SENDER));

  // Scope: the seeds, their DIRECT imports, and the mail builders' own imports.
  //
  // Deliberately NOT the full transitive closure. Measured on this repo: the full
  // closure is 94 files and drags in 30+ Hungarian-text files that never write a
  // mail (scraper prompts, guard verdicts, auth notes) — and a guard that cries
  // on 37 files gets an exception list nobody reads, which is how hand-lists
  // died in the first place. Every REAL text producer sits within one import of
  // a sender-caller (all five mail builders and draft.ts do); a deeper helper
  // would surface the moment a builder imports it, because builders are in scope.
  const scope = new Set<string>(seeds);
  for (const f of seeds) for (const dep of graph.get(f) ?? []) scope.add(dep);
  for (const f of files)
    if (f.startsWith("src/email/")) {
      scope.add(f);
      for (const dep of graph.get(f) ?? []) scope.add(dep);
    }

  const listed = new Set(I18N_SOURCES);
  const offenders = [...scope]
    .filter((f) => hasBareHungarian(sources.get(f)!))
    .filter((f) => !listed.has(f) && !(f in EXCEPTIONS));

  const selfTest = process.argv.includes("--self-test");
  if (selfTest) {
    // RED: with the lists blanked, the detector MUST fire — and the historical
    // hole (draft.ts) MUST be inside the derived scope. If either fails, the
    // guard is measuring nothing.
    const bare = [...scope].filter((f) => hasBareHungarian(sources.get(f)!));
    const ok = bare.length > 0 && scope.has("src/outreach/draft.ts");
    console.log(
      ok
        ? `✅ önteszt: a levezetett hatókör él (${scope.size} fájl, ebből ${bare.length} magyar-szöveges; draft.ts benne)`
        : `⛔ önteszt: a levezetés NEM talál (scope=${scope.size}, magyar=${bare.length}) — az őr vak`,
    );
    process.exit(ok ? 0 : 1);
  }

  if (offenders.length) {
    console.error(
      `⛔ i18n-scope: ${offenders.length} fájl ér el a levél-adapterig MAGYAR szöveggel úgy,\n` +
        `   hogy se az I18N_SOURCES listán, se az indokolt kivételek közt nincs (ADR-0070):`,
    );
    for (const f of offenders) console.error(`   · ${f}`);
    console.error(
      `   → vagy T()-burkolás + felvétel a scripts/i18n-sources.mjs listára,\n` +
        `   → vagy INDOKOLT kivétel a scripts/i18n-scope.mts EXCEPTIONS térképébe.`,
    );
    process.exit(1);
  }
  console.log(
    `✅ i18n-scope: a levél-útvonal levezetett hatóköre (${scope.size} fájl) lefedett — ` +
      `minden magyar-szöveges fájl listázott vagy indokolt kivétel.`,
  );
}

await main();
