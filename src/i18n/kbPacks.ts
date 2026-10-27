// ADR-0045 ③ (§J.25): document-level knowledge-base translation on the ADR-0036 spine.
// The unit is a WHOLE markdown entry (title + body), not a UI string — language_pack
// stays what it is. source_hash pins the Hungarian source version a translation was
// made from; a mismatch marks it stale until Bábel translates the new version.
//
// ⛔ NO API TRANSLATION (owner, 2026-10-27, ADR-XXXX): the only source of a KB translation
// is Bábel's committed seed, src/i18n/babel/kb/<lang>/<entry-id>.json
// ({source_hash, title, body}), made in his subscription session (babel-pack kb-export /
// kb-import). The ensure layer copies a seed into kb_translation when its source_hash
// matches the CURRENT Hungarian source and it passes the integrity check below.
//
// Integrity mirrors the placeholder guard of packs.ts: the **„…”** labels (the admin
// screen shows these in Hungarian today, so the guide must quote them VERBATIM), the
// image paths and the heading skeleton must survive translation unchanged — a
// violating translation is dropped so the next ensure re-flags it.

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

/** Structural integrity of a candidate translation against its Hungarian source —
 *  a broken document is worse than a re-run (same doctrine as the {placeholder} guard). */
export function kbTranslationValid(sourceBody: string, candidateBody: string): boolean {
  return (
    candidateBody.trim().length > 0 &&
    JSON.stringify(labelsOf(sourceBody)) === JSON.stringify(labelsOf(candidateBody)) &&
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
export function kbSeedProblem(entry: KbEntry, seed: KbSeed): string | null {
  if (seed.source_hash !== kbSourceHash(entry)) return "elavult: a magyar forrás azóta változott";
  if (typeof seed.title !== "string" || !seed.title.trim()) return "üres cím";
  if (typeof seed.body !== "string" || !kbTranslationValid(entry.body, seed.body))
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
    if (!seed || kbSeedProblem(entry, seed)) continue;
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
