// ADR-0045 ③ (§J.25): document-level knowledge-base translation on the ADR-0036 spine.
// The unit is a WHOLE markdown entry (title + body), not a UI string — language_pack
// stays what it is. source_hash pins the Hungarian source version a translation was
// made from; a mismatch marks it stale until Bábel translates the new version.
//
// ⛔ NO API TRANSLATION (owner, 2026-10-27, ADR-0412): the only source of a KB translation
// is Bábel's committed seed, src/i18n/babel/kb/<lang>/<entry-id>.json
// ({source_hash, title, body}), made in his subscription session (babel-pack kb-export /
// kb-import). The ensure layer copies a seed into kb_translation when its source_hash
// matches the CURRENT Hungarian source and it passes the integrity check below.
//
// Integrity mirrors the placeholder guard of packs.ts: the **„…”** labels must be the
// labels the admin screen SHOWS IN THE ENTRY'S LANGUAGE (2026-11-26: the admin is
// translated into every EU language, so a Croatian guide quoting a Hungarian button sent
// the owner looking for a button that is not on his screen). The image paths and the
// heading skeleton must survive translation unchanged — a violating translation is
// dropped so the next ensure re-flags it.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { db } from "../db/client.js";
import { loadKbEntries, makeSnippet, type KbEntry } from "../kb/kb.js";
import { DEFAULT_LANG } from "./lang.js";

const KB_SEED_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "babel", "kb");

/** Version fingerprint of the Hungarian source an entry translation derives from. */
export function kbSourceHash(entry: Pick<KbEntry, "title" | "body">): string {
  return createHash("sha256").update(`${entry.title}\n${entry.body}`).digest("hex");
}

/**
 * A forrásban SZEREPLŐ képernyő-feliratok (`**„Mentés”**`), szóköz-normalizálva.
 *
 * ⛔ MÉRT HIBA (2026-09-15): a normalizálás nélkül ez az ellenőrzés HELYES fordításokat
 * dobott el. A magyar forrás sortöréssel tördel, ezért egy felirat átér a sor végén:
 * `**„Lemondom a\n  foglalást”**`. A fordítás ugyanazt a feliratot EGY sorba írja —
 * a képernyőn látható szöveg betűre azonos —, a nyers sztring-összehasonlítás mégis
 * eltérést látott, és a teljes fordítás elveszett („integritás-sértés"). Mérve: a
 * `sk/admin-bookings` jelölt 25/25 feliratot, 1/1 képet és 7/7 alcímet hozott, és
 * KIZÁRÓLAG két sortörés miatt bukott meg.
 *
 * A felirat az, amit a tulaj a GOMBON olvas — abban soha nincs sortörés. A tördelés
 * tipográfia, nem tartalom: az ellenőrzés a feliratot mérje, ne a sortörést. A
 * szigorúság megmarad — egy lefordított vagy megváltoztatott felirat továbbra is bukik.
 *
 * ⛔ MÉRT HIBA (2026-10-02, deploy 132a21a8, élesen 3/3 bukás): idézetblokkban
 * (`> **„A lemondása ettől függetlenül … nem megy végbe.”**`) a fordítás két sorba
 * tördelte a feliratot, a második sor pedig — markdownban helyesen — `> `-rel kezdődik.
 * A `>` a blokk jelölője, nem a felirat része: a sortöréssel együtt el kell engedni.
 */
const labelsOf = (md: string): string[] =>
  [...md.matchAll(/\*\*„([^”]+)”\*\*/g)]
    .map((m) => m[1]!.replace(/\n[ \t]*(?:>[ \t]*)+/g, " ").replace(/\s+/g, " ").trim())
    .sort();
const imagesOf = (md: string): string[] =>
  [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]!).sort();
const headingCount = (md: string): number =>
  md.split("\n").filter((l) => l.trimStart().startsWith("## ")).length;

// ── Label expectation per language (2026-11-26) ─────────────────────────────────────
// The admin renders every label through the tr()/T() lookup of its Hungarian source in
// packs/<lang>.json.
// So the label a guide in `lang` must quote is NOT the Hungarian **„…”** text but what
// the pack maps it to. Rule, not an exception list:
//   ① the label IS a catalogue string (after stripping markup) → the pack's translation
//      of it; untranslated in the pack → the screen falls back to Hungarian → Hungarian.
//   ② the label is a FRAGMENT of catalogue strings (`Befizetem` of „Befizetem — {amount}”,
//      `Mentve:` of „Mentve: {date}”) → the candidate must appear verbatim inside the
//      translation of one of those strings; none translated → Hungarian.
//   ③ in no catalogue string (an external screen, e.g. a bank page) → Hungarian.
// A Hungarian label where the pack has a translation fails (wrong language), and so does
// a label that is in no translation (a button that does not exist).

const I18N_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Screen text of a catalogue string / translation: markup gone, {placeholders} as „…”. */
const screenText = (s: string): string =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]+\}/g, "…")
    .replace(/\s+/g, " ")
    .trim();

let catalogScreen: { key: string; text: string }[] | null = null;
function catalogEntries(): { key: string; text: string }[] {
  if (!catalogScreen) {
    let keys: string[] = [];
    try {
      keys = JSON.parse(readFileSync(path.join(I18N_DIR, "catalog.json"), "utf8")) as string[];
    } catch {
      keys = [];
    }
    catalogScreen = keys.map((key) => ({ key, text: screenText(key) }));
  }
  return catalogScreen;
}

const packCache = new Map<string, Record<string, string>>();
function langPack(lang: string): Record<string, string> {
  let p = packCache.get(lang);
  if (!p) {
    try {
      p = JSON.parse(readFileSync(path.join(I18N_DIR, "babel", "packs", `${lang}.json`), "utf8")) as Record<string, string>;
    } catch {
      p = {};
    }
    packCache.set(lang, p);
  }
  return p;
}

/** Screen texts the `lang` pack gives for these catalogue keys (deduplicated). A plural
 *  value („plural:one={n} noć;few=…”, packs.ts 3/10) counts as each of its forms. */
function screenTranslations(keys: string[], lang: string): string[] {
  const pack = langPack(lang);
  const out = new Set<string>();
  for (const k of keys) {
    const v = pack[k];
    if (typeof v !== "string" || !v.trim()) continue;
    const forms = v.startsWith("plural:")
      ? v
          .slice("plural:".length)
          .split(";")
          .map((part) => part.slice(part.indexOf("=") + 1))
      : [v];
    for (const f of forms) if (f.trim()) out.add(screenText(f));
  }
  return [...out];
}

/** Does `candidate` stand where the Hungarian `label` stands, in a `lang` guide? */
type LabelAcceptor = (candidate: string) => boolean;

function labelAcceptor(label: string, lang: string): LabelAcceptor {
  const verbatim: LabelAcceptor = (c) => c === label;
  if (lang === DEFAULT_LANG) return verbatim;
  const translated = (keys: string[]): string[] => screenTranslations(keys, lang);
  const entries = catalogEntries();
  // ① whole catalogue string
  const exact = entries.filter((e) => e.text === label).map((e) => e.key);
  if (exact.length) {
    const t = translated(exact);
    return t.length ? (c) => t.includes(c) : verbatim;
  }
  // ② fragment of catalogue strings
  const containing = entries.filter((e) => e.text.includes(label)).map((e) => e.key);
  if (containing.length) {
    const t = translated(containing);
    return t.length ? (c) => c.length >= 2 && t.some((x) => x.includes(c)) : verbatim;
  }
  // ③ not a screen string of ours
  return verbatim;
}

/** Perfect matching source label ↔ candidate label (Kuhn): every source label needs its
 *  own candidate, and no candidate may be left over (an invented button). */
function labelsMatch(source: string[], candidate: string[], lang: string): boolean {
  if (source.length !== candidate.length) return false;
  const accept = source.map((l) => labelAcceptor(l, lang));
  const owner: number[] = new Array(candidate.length).fill(-1);
  const tryAssign = (i: number, seen: boolean[]): boolean => {
    for (let j = 0; j < candidate.length; j++) {
      if (seen[j] || !accept[i]!(candidate[j]!)) continue;
      seen[j] = true;
      if (owner[j] === -1 || tryAssign(owner[j]!, seen)) {
        owner[j] = i;
        return true;
      }
    }
    return false;
  };
  return source.every((_, i) => tryAssign(i, new Array(candidate.length).fill(false)));
}

/** Source labels a `lang` guide quotes wrongly (missing / Hungarian / non-existent) —
 *  for the report of babel-pack and the guards; [] when the labels are right. */
export function kbLabelProblems(sourceBody: string, candidateBody: string, lang: string): string[] {
  const src = labelsOf(sourceBody);
  const cand = labelsOf(candidateBody);
  if (labelsMatch(src, cand, lang)) return [];
  const used = new Set<number>();
  const bad: string[] = [];
  for (const l of src) {
    const a = labelAcceptor(l, lang);
    const j = cand.findIndex((c, k) => !used.has(k) && a(c));
    if (j === -1) bad.push(l);
    else used.add(j);
  }
  const extra = cand.filter((_, k) => !used.has(k)).map((c) => `+${c}`);
  return [...bad, ...extra];
}

/** What each Hungarian **„…”** label of `sourceBody` must read in `lang` (for kb-export):
 *  the exact label (①), „…in: <translation>” for a fragment (②), or the Hungarian label
 *  itself when the screen shows Hungarian (untranslated / external, ③). */
export function kbLabelHints(sourceBody: string, lang: string): Record<string, string> {
  const out: Record<string, string> = {};
  const entries = catalogEntries();
  const tr = (keys: string[]): string[] => screenTranslations(keys, lang);
  for (const label of new Set(labelsOf(sourceBody))) {
    const exact = tr(entries.filter((e) => e.text === label).map((e) => e.key));
    if (entries.some((e) => e.text === label)) {
      out[label] = exact.length ? exact.join(" | ") : label;
      continue;
    }
    const frag = tr(entries.filter((e) => e.text.includes(label)).map((e) => e.key));
    out[label] = frag.length ? `…in: ${frag.join(" | ")}` : label;
  }
  return out;
}

/** Structural integrity of a candidate `lang` translation against its Hungarian source —
 *  a broken document is worse than a re-run (same doctrine as the {placeholder} guard).
 *  `lang` omitted = Hungarian = labels verbatim. */
export function kbTranslationValid(sourceBody: string, candidateBody: string, lang: string = DEFAULT_LANG): boolean {
  return (
    candidateBody.trim().length > 0 &&
    labelsMatch(labelsOf(sourceBody), labelsOf(candidateBody), lang) &&
    JSON.stringify(imagesOf(sourceBody)) === JSON.stringify(imagesOf(candidateBody)) &&
    headingCount(sourceBody) === headingCount(candidateBody)
  );
}

/** One help entry as Bábel committed it (src/i18n/babel/kb/<lang>/<entry-id>.json). */
export interface KbSeed {
  readonly source_hash: string;
  readonly title: string;
  readonly body: string;
}

/** Bábel's committed help entries for `lang`, by entry id ({} when none). The files only
 *  change with a deploy (= a restart), so they are read once per process. */
export function kbSeeds(lang: string): Record<string, KbSeed> {
  let seeds = kbSeedCache.get(lang);
  if (!seeds) {
    seeds = {};
    let files: string[] = [];
    try {
      files = readdirSync(path.join(KB_SEED_DIR, lang)).filter((f) => f.endsWith(".json"));
    } catch {
      files = [];
    }
    for (const f of files) {
      try {
        seeds[f.slice(0, -5)] = JSON.parse(readFileSync(path.join(KB_SEED_DIR, lang, f), "utf8")) as KbSeed;
      } catch (err) {
        console.error(`[i18n] Bábel KB-mag olvashatatlan (${lang}/${f}): ${(err as Error).message}`);
      }
    }
    kbSeedCache.set(lang, seeds);
  }
  return seeds;
}
const kbSeedCache = new Map<string, Record<string, KbSeed>>();

/** Why a seed cannot serve `entry` right now (stale source, broken structure), or null. */
export function kbSeedProblem(entry: KbEntry, seed: KbSeed, lang: string): string | null {
  if (seed.source_hash !== kbSourceHash(entry)) return "elavult: a magyar forrás azóta változott";
  if (typeof seed.title !== "string" || !seed.title.trim()) return "üres cím";
  if (typeof seed.body !== "string" || !kbTranslationValid(entry.body, seed.body, lang))
    return "integritás-sértés (felirat / kép-útvonal / alcím-szám eltérés)";
  return null;
}

export interface KbPackStatus {
  readonly lang: string;
  readonly total: number;
  readonly missing: number;
  readonly ok: boolean;
}

/** ADR-0045/e: only tenant-facing entries translate. The operator console renders
 *  Hungarian today and tenants never reach the operator guides — translating them
 *  would be work without a reader, and §J.25 wants the guide to quote what the
 *  screen actually shows. If the console ever gets language packs, widen here. */
export const translatableKbEntries = (): KbEntry[] =>
  loadKbEntries().filter((e) => e.audience === "tenant");

/** Valid Bábel seeds for `lang` that kb_translation does not hold yet (entry id → seed). */
async function pendingKbSeeds(lang: string): Promise<Map<KbEntry, KbSeed>> {
  const out = new Map<KbEntry, KbSeed>();
  const seeds = kbSeeds(lang);
  if (lang === DEFAULT_LANG || !Object.keys(seeds).length) return out;
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "source_hash", "title", "body_md"])
    .where("lang", "=", lang)
    .execute();
  const have = new Map(rows.map((r) => [r.entry_id, r]));
  for (const entry of translatableKbEntries()) {
    const seed = seeds[entry.id];
    if (!seed || kbSeedProblem(entry, seed, lang)) continue;
    const row = have.get(entry.id);
    if (row && row.source_hash === seed.source_hash && row.title === seed.title.trim() && row.body_md === seed.body) continue;
    out.set(entry, seed);
  }
  return out;
}

/** How many of Bábel's committed help entries wait to be copied into the DB. */
export async function kbSeedPending(lang: string): Promise<number> {
  return (await pendingKbSeeds(lang)).size;
}

/**
 * Copy Bábel's committed, current help translations for `lang` into kb_translation and
 * report coverage (§J.25). Called from ensureLanguagePack, so every existing trigger —
 * boot, deploy, CLI, mock generation — applies a deployed seed with no new call sites.
 * ⛔ Translates nothing: a missing or stale entry stays missing until Bábel delivers it.
 */
export async function ensureKbTranslations(lang: string): Promise<KbPackStatus> {
  const pending = await pendingKbSeeds(lang);
  for (const [entry, seed] of pending) {
    await db
      .insertInto("kb_translation")
      .values({ entry_id: entry.id, lang, source_hash: seed.source_hash, title: seed.title.trim(), body_md: seed.body })
      .onConflict((oc) =>
        oc.columns(["entry_id", "lang"]).doUpdateSet({
          source_hash: seed.source_hash,
          title: seed.title.trim(),
          body_md: seed.body,
          updated_at: sql`now()`,
        }),
      )
      .execute();
  }
  if (pending.size) console.log(`[i18n] ${lang}: Bábel KB-mag alkalmazva — ${pending.size} cikk`);
  return kbCoverage(lang);
}

/** Coverage WITHOUT writing (tracking view): fresh-translation count vs entries. */
export async function kbCoverage(lang: string): Promise<KbPackStatus> {
  const entries = translatableKbEntries();
  if (lang === DEFAULT_LANG) return { lang, total: entries.length, missing: 0, ok: true };
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "source_hash"])
    .where("lang", "=", lang)
    .execute();
  const have = new Map(rows.map((r) => [r.entry_id, r.source_hash]));
  const missing = entries.filter((e) => have.get(e.id) !== kbSourceHash(e)).length;
  return { lang, total: entries.length, missing, ok: missing === 0 };
}

/**
 * The entry list with the language overlay applied. A stale translation still serves
 * (a readable guide beats a Hungarian fallback for a Polish owner) until Bábel delivers
 * the new version. Hungarian returns the source untouched.
 */
export async function localizedKbEntries(lang: string | undefined): Promise<KbEntry[]> {
  const entries = loadKbEntries();
  const l = lang || DEFAULT_LANG;
  if (l === DEFAULT_LANG) return entries;
  const rows = await db
    .selectFrom("kb_translation")
    .select(["entry_id", "title", "body_md"])
    .where("lang", "=", l)
    .execute();
  const byId = new Map(rows.map((r) => [r.entry_id, r]));
  return entries.map((e) => {
    const t = byId.get(e.id);
    return t
      ? { ...e, title: t.title, body: t.body_md, snippet: makeSnippet(t.body_md) }
      : e;
  });
}
