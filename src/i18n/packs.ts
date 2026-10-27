// ADR-0036: language packs — one-time AI-provisioned UI-string translations, persisted in
// the language_pack table, deterministic afterwards (mock=live safe). The catalog's KEY is
// the Hungarian source string itself (no invented key names): templates call T(d, "Galéria")
// and the pack maps that exact string to its translation. {placeholders} are preserved and
// guarded. Hungarian needs no pack (the source IS the string).

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { db, pool } from "../db/client.js";
import { babelCall, babelSystem, surfaceOf } from "./babel.js";
import { newTranslationRun, TranslationBudgetError, type TranslationRun } from "./budget.js";
import { ensureKbTranslations, kbCoverage, type KbPackStatus } from "./kbPacks.js";
import { DEFAULT_LANG, langName } from "./lang.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(HERE, "catalog.json");

// In-memory pack cache: lang → (hu string → translated string). Loaded once per process;
// ensureLanguagePack refreshes it after generation. Render-time lookup must be synchronous.
const cache = new Map<string, Record<string, string>>();
let catalogCache: string[] | null = null;

/** The extracted source-string catalog (scripts/extract-i18n.mts writes it). */
export async function loadCatalog(): Promise<string[]> {
  if (catalogCache) return catalogCache;
  try {
    catalogCache = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as string[];
  } catch {
    catalogCache = [];
    console.error("[i18n] HIÁNYZÓ catalog.json — futtasd: npx tsx scripts/extract-i18n.mts");
  }
  return catalogCache;
}

/** Synchronous translation lookup for render time. Hungarian returns the source. A missing
 *  pack/string falls back to Hungarian LOUDLY (once per key) — ensureLanguagePack before
 *  generation is the real guard; this is the belt-and-braces path. */
const warned = new Set<string>();
export function tSync(lang: string | undefined, hu: string): string {
  const l = lang || DEFAULT_LANG;
  if (l === DEFAULT_LANG) return hu;
  const hit = cache.get(l)?.[hu];
  if (hit) return hit;
  const wk = `${l}:${hu}`;
  if (!warned.has(wk)) {
    warned.add(wk);
    console.error(`[i18n] hiányzó fordítás (${l}): "${hu}" — hu-fallback (pack-guard futott?)`);
  }
  return hu;
}

/** {placeholder} tokens of a string, order-insensitive set. */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((m) => m[0]).sort();
}

// ADR-0281: {art}/{Art}/{art2} carry the HUNGARIAN definite article (huArticle → "A"/"Az").
// Measured 2026-09-30 on the dev packs: every language kept the token, so the English UI
// printed "We couldn't purchase A example.hu"; and production dropped 7 strings outright
// because the translator (rightly) omitted it and the integrity check demanded it. In a
// non-Hungarian rendering the token is therefore blanked, and the translator may omit it.
const ARTICLE_VAR = /^art\d*$/i;

function isArticleToken(tok: string): boolean {
  return ARTICLE_VAR.test(tok.slice(1, -1));
}

/**
 * Why a translation breaks the placeholder contract, or null if it keeps it. Every
 * non-article placeholder must survive verbatim; article placeholders are optional, but
 * a translation must not invent one the source does not have.
 */
export function placeholderProblem(hu: string, tr: string): string | null {
  const src = placeholders(hu);
  const out = placeholders(tr);
  const need = src.filter((t) => !isArticleToken(t));
  const got = out.filter((t) => !isArticleToken(t));
  if (need.join("|") !== got.join("|"))
    return `placeholder-eltérés: várt ${need.join(" ") || "(nincs)"}, kapott ${got.join(" ") || "(nincs)"}`;
  const foreign = out.filter((t) => isArticleToken(t) && !src.includes(t));
  if (foreign.length) return `idegen névelő-placeholder: ${foreign.join(" ")}`;
  return null;
}

/**
 * Substitute {vars} into an already-looked-up string — the shared body of both T()s.
 * When the string really IS a translation (not the Hungarian fallback), the Hungarian
 * article vars render empty, together with one adjacent space.
 */
export function interpolate(
  lang: string | undefined,
  hu: string,
  s: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return s;
  const translated = (lang || DEFAULT_LANG) !== DEFAULT_LANG && s !== hu;
  for (const [k, v] of Object.entries(vars)) {
    if (translated && ARTICLE_VAR.test(k)) {
      s = s.replace(new RegExp(`\\{${k}\\} ?| ?\\{${k}\\}`, "g"), "");
      continue;
    }
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/**
 * Install a pack directly into the in-memory cache, bypassing the DB.
 *
 * ADR-0067 ②: this exists for the PSEUDO-LOCALE guard. The accent heuristic in
 * i18n-lint cannot see unaccented Hungarian ("1 db" shipped to a Polish tenant
 * exactly that way), so the structural check renders every surface in a language
 * whose pack marks each translated string — anything left unmarked in the output
 * is, by construction, a string that never went through T().
 */
export function installPack(lang: string, strings: Record<string, string>): void {
  cache.set(lang, strings);
}

/** Load a pack from the DB into the cache (no-op for Hungarian). */
export async function loadPack(lang: string): Promise<Record<string, string> | null> {
  if (lang === DEFAULT_LANG) return null;
  const cached = cache.get(lang);
  if (cached) return cached;
  const row = await db
    .selectFrom("language_pack")
    .select("strings")
    .where("lang", "=", lang)
    .executeTakeFirst();
  if (!row) return null;
  const strings = row.strings as unknown as Record<string, string>;
  cache.set(lang, strings);
  return strings;
}

/** One model round-trip: system + user prompt → the raw text answer (null = no text). */
export type AskModel = (system: string, user: string) => Promise<string | null>;

/** Retry rounds after the first pass — each only for the strings the previous one dropped. */
const MAX_RETRY_ROUNDS = 2;

/** First-pass batch size. Bábel answers by index (no Hungarian echo), so a batch of 60
 *  costs about what 40 did when the answer repeated every source string as its key. */
const BATCH = 60;

/**
 * Translate `strings` to `lang` through `ask`, with placeholder-integrity checking and
 * RETRY. Measured 2026-09-30 in production: 7 strings failed the check, were dropped, and
 * nothing asked again — the boot self-heal failed the same 7 twice, so the pack could
 * never become complete. Now a dropped string is re-asked (up to MAX_RETRY_ROUNDS) in a
 * small batch whose prompt lists, per string, the placeholders that must appear verbatim.
 * What still fails is reported LOUDLY and returned in `rejected`.
 *
 * Bábel (ADR-0411): every item carries its SURFACE (`surfaceOf`), batches are ordered by
 * surface so one batch reads like one screen, and the answer is keyed by the item index
 * (a Hungarian-keyed answer is still accepted). The system prompt comes from the caller
 * (`babelSystem`) — this function only shapes the batches and checks the answers.
 */
export async function translateStrings(
  lang: string,
  strings: string[],
  ask: AskModel,
  opts: { maxRetryRounds?: number; system?: string; surfaceOf?: (hu: string) => string } = {},
): Promise<{ out: Record<string, string>; rejected: Record<string, string>; stopped?: TranslationBudgetError }> {
  const maxRetry = opts.maxRetryRounds ?? MAX_RETRY_ROUNDS;
  const surface = opts.surfaceOf ?? (() => "egyeb");
  const system = opts.system ?? babelSystem(lang, "ui");
  const out: Record<string, string> = {};
  let rejected: Record<string, string> = {};

  const runBatch = async (batch: string[], user: string): Promise<void> => {
    let parsed: Record<string, string>;
    try {
      const text = await ask(system, user);
      if (!text) throw new Error("üres válasz");
      parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
    } catch (err) {
      // A spent budget is not a bad answer: it stops the whole run, loudly, upstream.
      if (err instanceof TranslationBudgetError) throw err;
      for (const hu of batch) rejected[hu] = `a válasz nem értelmezhető: ${(err as Error).message}`;
      return;
    }
    batch.forEach((hu, i) => {
      const tr = parsed[String(i)] ?? parsed[hu];
      if (typeof tr !== "string" || !tr.trim()) {
        rejected[hu] = "hiányzik a válaszból";
        return;
      }
      // Placeholder integrity: a broken translation is worse than a re-run.
      const problem = placeholderProblem(hu, tr);
      if (problem) {
        rejected[hu] = problem;
        return;
      }
      out[hu] = tr;
    });
  };

  try {
    // One batch ≈ one surface: the order groups the strings of a screen together.
    const ordered = [...strings].sort((a, b) => surface(a).localeCompare(surface(b)));
    for (let i = 0; i < ordered.length; i += BATCH) {
      const batch = ordered.slice(i, i + BATCH);
      const items = batch.map((hu, n) => ({ i: n, hu, felulet: surface(hu) }));
      await runBatch(
        batch,
        `Fordítsd ${langName(lang)} nyelvre. Add vissza JSON objektumként: {"<i>": "<fordítás>", ...}:\n` +
          JSON.stringify(items, null, 0),
      );
    }

    for (let round = 1; round <= maxRetry && Object.keys(rejected).length; round++) {
      const again = Object.keys(rejected);
      console.error(`[i18n] újrapróba ${round}/${maxRetry} (${lang}): ${again.length} string`);
      rejected = {};
      for (let i = 0; i < again.length; i += 10) {
        const batch = again.slice(i, i + 10);
        const spec = batch.map((hu, n) => {
          const req = placeholders(hu).filter((t) => !isArticleToken(t));
          return { i: n, magyar: hu, felulet: surface(hu), kotelezo_placeholderek: req };
        });
        await runBatch(
          batch,
          `Az előző fordításod ezeknél megsértette a placeholder-szabályt. Fordítsd újra őket; a ` +
            `"kotelezo_placeholderek" MINDEGYIKE betűre, kapcsos zárójellel szerepeljen a fordításban, ` +
            `más {kapcsos} token ne (az {art}/{Art}/{art2} maradjon ki). ` +
            `Add vissza JSON objektumként: {"<i>": "<fordítás>", ...}:\n` +
            JSON.stringify(spec, null, 1),
        );
      }
    }
  } catch (err) {
    // A ceiling stops the run; what was translated so far is KEPT (the caller persists it).
    if (err instanceof TranslationBudgetError) return { out, rejected, stopped: err };
    throw err;
  }

  for (const [hu, why] of Object.entries(rejected))
    console.error(`[i18n] ⛔ fordítás ELDOBVA újrapróba után is (${lang}): "${hu}" — ${why}`);
  return { out, rejected };
}

/** AI-translate the given Hungarian strings to `lang` through Bábel. Returns hu→translated;
 *  strings that keep breaking the placeholder contract are left out so the coverage guard
 *  re-flags them. Throws TranslationBudgetError when a ceiling stops the run. */
async function translateBatch(
  lang: string,
  strings: string[],
  run: TranslationRun,
): Promise<{ out: Record<string, string>; stopped?: TranslationBudgetError }> {
  const system = babelSystem(lang, "ui");
  const ask: AskModel = async (sys, user) => {
    const ans = await babelCall(run, "translateUiBatch", sys, user, 8000);
    if (ans.stopReason === "max_tokens") throw new Error("a válasz elvágódott a token-korlátnál");
    return ans.text;
  };
  const r = await translateStrings(lang, strings, ask, { system, surfaceOf });
  return { out: r.out, stopped: r.stopped };
}

export interface PackStatus {
  readonly lang: string;
  readonly total: number;
  readonly missing: number;
  readonly ok: boolean;
  /** ADR-0045 ③: knowledge-base coverage for the same language (null = not checked). */
  readonly kb?: KbPackStatus | null;
}

/**
 * READ-ONLY coverage: which catalog strings `lang` is missing RIGHT NOW.
 *
 * Never translates, never writes, costs nothing. It exists because a SCREEN may have
 * to ask "would this send succeed?" without paying for it: `ensureLanguagePack` below
 * PROVISIONS (AI call + DB upsert), so rendering a page through it would spend money
 * and mutate state on a GET. The send path and the screen therefore share this one
 * measurement, and only differ in whether they may act on the gap.
 */
export async function missingPackStrings(lang: string): Promise<string[]> {
  const catalog = await loadCatalog();
  if (lang === DEFAULT_LANG || !catalog.length) return [];
  const existing = (await loadPack(lang)) ?? {};
  return catalog.filter((s) => !existing[s]);
}

/**
 * Ensure the language pack for `lang` exists and fully covers the extracted catalog —
 * the ADR-0036 automation hook. Missing entries are translated by Bábel and upserted; the
 * cache refreshes. Returns coverage; `ok=false` means generation could not complete (missing
 * key, API failure, spend ceiling) — callers log loudly, generation still proceeds with
 * hu-fallback.
 *
 * ⛔ ONE RUN PER LANGUAGE (ADR-0411). Measured 2026-10-27 in production: a console language
 * switch to `sl` started this inside the request; the browser gave up (499/504), every
 * reload and every further console page started ANOTHER full run (16 runs, 5 within 20
 * seconds), because nothing knew a run was already going — $130 in an hour. Now:
 *  - within a process, every caller of the same language shares ONE promise;
 *  - across processes (console, public, CLI, deploy), a Postgres advisory lock per language
 *    admits one runner. `wait: true` (default) queues behind it and then re-reads the pack
 *    from the DB (normally complete by then — nothing left to translate); `wait: false`
 *    returns the current coverage at once and starts nothing.
 */
export async function ensureLanguagePack(lang: string, opts: { wait?: boolean } = {}): Promise<PackStatus> {
  if (lang === DEFAULT_LANG) return coverageNow(lang);
  const running = inflight.get(lang);
  if (running) return running;
  // Fast path — the common case (every letter calls this): complete pack, complete KB, no
  // pending Bábel seed → nothing to do, no lock, no connection held.
  const now = await coverageNow(lang);
  if (now.ok && applyBabelSeed(lang, (await loadPack(lang)) ?? {}, await loadCatalog()).changed === 0) return now;
  const again = inflight.get(lang); // another caller may have started while we measured
  if (again) return again;
  const p = exclusiveRun(lang, opts.wait ?? true).finally(() => inflight.delete(lang));
  inflight.set(lang, p);
  return p;
}

const inflight = new Map<string, Promise<PackStatus>>();

/** True while THIS process is provisioning `lang` (the console's „készül” notice). */
export function packBuilding(lang: string): boolean {
  return inflight.has(lang);
}

/**
 * Synchronous pack state for a page frame (render time cannot await): null when the
 * language is Hungarian or its pack covers the catalog; otherwise whether THIS process is
 * translating it and how many strings still fall back to Hungarian.
 */
export function packGapSync(lang: string): { building: boolean; missing: number } | null {
  if (lang === DEFAULT_LANG) return null;
  const building = inflight.has(lang);
  const pack = cache.get(lang) ?? {};
  const missing = catalogCache ? catalogCache.filter((s) => !pack[s]).length : building ? -1 : 0;
  return building || missing > 0 ? { building, missing } : null;
}

/**
 * Start provisioning `lang` in the BACKGROUND if its pack is incomplete, and return at once.
 * For request paths (console language switch, page renders, scrape start): they render with
 * the hu-fallback meanwhile and never wait for — or re-start — a translation.
 */
export function requestLanguagePack(lang: string): void {
  if (lang === DEFAULT_LANG || inflight.has(lang)) return;
  void (async () => {
    if ((await missingPackStrings(lang)).length === 0 && (await kbCoverage(lang)).ok) return;
    await ensureLanguagePack(lang, { wait: false });
  })().catch((e) => console.error(`[i18n] háttér-provisioning HIBA (${lang}): ${(e as Error).message}`));
}

/** Advisory-lock key: one per language, namespaced so it collides with nothing else. */
const lockKey = (lang: string): string => `citoviso:i18n-pack:${lang}`;

/** How long a waiting caller queues behind another process's run before giving up. */
const LOCK_WAIT = "20min";

async function exclusiveRun(lang: string, wait: boolean): Promise<PackStatus> {
  // A session-level advisory lock lives on ONE connection: hold a dedicated pool client
  // for the run (one per language per process at most, thanks to `inflight`).
  const conn = await pool.connect();
  let locked = false;
  try {
    const got = await conn.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [lockKey(lang)]);
    locked = got.rows[0]?.ok === true;
    if (!locked) {
      if (!wait) {
        console.log(`[i18n] ${lang}: egy másik folyamat már fordítja — nem indítok újat`);
        return await coverageNow(lang, { fresh: true });
      }
      console.log(`[i18n] ${lang}: egy másik folyamat már fordítja — megvárom, nem indítok újat`);
      await conn.query(`set lock_timeout = '${LOCK_WAIT}'`);
      try {
        await conn.query("select pg_advisory_lock(hashtext($1))", [lockKey(lang)]);
        locked = true;
      } catch (err) {
        console.error(`[i18n] ${lang}: a másik fordítás nem ért véget ${LOCK_WAIT} alatt — hu-fallback (${(err as Error).message})`);
        return await coverageNow(lang, { fresh: true });
      } finally {
        await conn.query("reset lock_timeout").catch(() => undefined);
      }
    }
    // Whoever held the lock before us may have written the pack: read the DB, not the cache.
    cache.delete(lang);
    return await provision(lang);
  } finally {
    if (locked) await conn.query("select pg_advisory_unlock(hashtext($1))", [lockKey(lang)]).catch(() => undefined);
    conn.release();
  }
}

/** Coverage without translating. `fresh` re-reads the pack from the DB (another process wrote it). */
async function coverageNow(lang: string, opts: { fresh?: boolean } = {}): Promise<PackStatus> {
  const catalog = await loadCatalog();
  if (lang === DEFAULT_LANG || !catalog.length) return { lang, total: catalog.length, missing: 0, ok: true };
  if (opts.fresh) cache.delete(lang);
  const missing = (await missingPackStrings(lang)).length;
  const kb = await kbCoverage(lang);
  return { lang, total: catalog.length, missing, ok: missing === 0 && kb.ok, kb };
}

/** Write the whole pack row and refresh this process's cache. */
async function upsertPack(lang: string, strings: Record<string, string>): Promise<void> {
  await db
    .insertInto("language_pack")
    .values({ lang, strings: JSON.stringify(strings) as never, status: "generated" })
    .onConflict((oc) =>
      oc.column("lang").doUpdateSet({
        strings: JSON.stringify(strings) as never,
        updated_at: sql`now()`,
      }),
    )
    .execute();
  cache.set(lang, strings);
}

/** Bábel's committed pack for `lang` (src/i18n/babel/packs/<lang>.json), {} when none. */
export function babelSeed(lang: string): Record<string, string> {
  let seed = seedCache.get(lang);
  if (!seed) {
    try {
      seed = JSON.parse(readFileSync(path.join(HERE, "babel", "packs", `${lang}.json`), "utf8")) as Record<string, string>;
    } catch {
      seed = {};
    }
    seedCache.set(lang, seed); // the file only changes with a deploy (= a restart)
  }
  return seed;
}
const seedCache = new Map<string, Record<string, string>>();

/**
 * Overlay Bábel's seed on a pack: every seed entry that is in the catalogue and keeps the
 * placeholder contract replaces the pack's value. Returns the merged pack and how many
 * strings it changed (0 = nothing to write).
 */
export function applyBabelSeed(
  lang: string,
  pack: Record<string, string>,
  catalog: readonly string[],
): { merged: Record<string, string>; changed: number } {
  const seed = babelSeed(lang);
  const known = new Set(catalog);
  const merged = { ...pack };
  let changed = 0;
  for (const [hu, tr] of Object.entries(seed)) {
    if (!known.has(hu) || typeof tr !== "string" || !tr.trim() || placeholderProblem(hu, tr)) continue;
    if (merged[hu] !== tr) {
      merged[hu] = tr;
      changed++;
    }
  }
  return { merged, changed };
}

/** The run itself — only ever entered under the language's lock. */
async function provision(lang: string): Promise<PackStatus> {
  const catalog = await loadCatalog();
  if (!catalog.length) return { lang, total: 0, missing: 0, ok: true };
  const run = newTranslationRun(lang);
  let existing = (await loadPack(lang)) ?? {};
  // Bábel's own, reviewed translations (made in his session, committed, shipped by deploy)
  // come FIRST and win over machine output; the API only fills what they leave open.
  const seeded = applyBabelSeed(lang, existing, catalog);
  if (seeded.changed) {
    existing = seeded.merged;
    await upsertPack(lang, existing);
    console.log(`[i18n] ${lang}: Bábel-mag alkalmazva — ${seeded.changed} string a babel/packs/${lang}.json-ból`);
  }
  let missing = await missingPackStrings(lang);
  let stopped: TranslationBudgetError | undefined;
  if (missing.length) {
    console.log(`[i18n] nyelvi csomag provisioning (Bábel): ${lang} — ${missing.length} hiányzó string`);
    try {
      const r = await translateBatch(lang, missing, run);
      stopped = r.stopped;
      const merged = { ...existing, ...r.out };
      await upsertPack(lang, merged);
      missing = catalog.filter((s) => !merged[s]);
    } catch (err) {
      console.error(`[i18n] csomag-generálás HIBA (${lang}): ${(err as Error).message}`);
    }
  }
  // ADR-0045 ③ (§J.25): a language is only "ready" WITH its knowledge base — same
  // entry point as the UI strings, so every existing trigger (scrape into a region,
  // mock generation, boot self-heal, CLI) covers the KB with no new call sites.
  // A KB failure must not break the string pack; it reports loudly instead. A spent
  // budget skips the KB: the ceiling stops the RUN, not just the step.
  let kb: KbPackStatus | null = null;
  if (stopped) {
    kb = await kbCoverage(lang);
  } else {
    try {
      kb = await ensureKbTranslations(lang, run);
    } catch (err) {
      console.error(`[i18n] KB-fordítás HIBA (${lang}): ${(err as Error).message}`);
    }
  }
  const status = {
    lang,
    total: catalog.length,
    missing: missing.length,
    ok: missing.length === 0 && (kb?.ok ?? false),
    kb,
  };
  console.log(`[i18n] ${lang}: futás vége — ${run.calls} hívás, $${run.spentUsd.toFixed(2)}`);
  if (missing.length)
    console.error(`[i18n] ⛔ hiányos csomag (${lang}): ${missing.length}/${catalog.length}`);
  if (kb && !kb.ok) console.error(`[i18n] ⛔ hiányos KB (${lang}): ${kb.missing}/${kb.total}`);
  return status;
}

/** The full pack map for client-side injection (booking widget / configurator). Hungarian →
 *  empty map (the client falls back to its source literals). */
export function packForClient(lang: string | undefined): Record<string, string> {
  if (!lang || lang === DEFAULT_LANG) return {};
  return cache.get(lang) ?? {};
}

/** Async variant that loads the pack from the DB on a cold cache first (serve paths on a
 *  fresh process must not silently fall back to Hungarian). */
export async function packForClientAsync(lang: string | undefined): Promise<Record<string, string>> {
  if (!lang || lang === DEFAULT_LANG) return {};
  return (await loadPack(lang)) ?? {};
}

/** Every language the system currently KNOWS about: existing packs ∪ the languages implied
 *  by the active regions' countries. This is the tracking universe for pack coverage. */
export async function knownLanguages(): Promise<string[]> {
  const { langForCountry } = await import("./lang.js");
  const langs = new Set<string>();
  const packs = await db.selectFrom("language_pack").select("lang").execute();
  for (const p of packs) langs.add(p.lang);
  const regions = await db
    .selectFrom("region")
    .select("country")
    .where("active", "=", true)
    .execute()
    .catch(() => []);
  for (const r of regions) {
    const l = langForCountry(r.country);
    if (l !== DEFAULT_LANG) langs.add(l);
  }
  return [...langs].sort();
}

/**
 * Deploy-time / boot-time self-heal (ADR-0036 kiegészítés): during development the catalog
 * keeps growing, so existing packs silently go stale until the next generation event for that
 * language. This ensures EVERY known language's pack covers the current catalog — missing
 * entries are AI-translated and persisted. Wired into server startup, so a deploy+restart
 * tops the packs up automatically; also runnable as a CLI (scripts/i18n-pack-status.mts).
 */
export async function ensureAllLanguagePacks(): Promise<PackStatus[]> {
  const langs = await knownLanguages();
  const out: PackStatus[] = [];
  for (const lang of langs) out.push(await ensureLanguagePack(lang));
  return out;
}

/** Coverage report WITHOUT generating (the tracking view): pack size vs catalog +
 *  KB translation freshness (ADR-0045 ③). */
export async function packCoverage(): Promise<PackStatus[]> {
  const catalog = await loadCatalog();
  const langs = await knownLanguages();
  const out: PackStatus[] = [];
  for (const lang of langs) {
    const pack = (await loadPack(lang)) ?? {};
    const missing = catalog.filter((s) => !pack[s]).length;
    const kb = await kbCoverage(lang);
    out.push({ lang, total: catalog.length, missing, ok: missing === 0 && kb.ok, kb });
  }
  return out;
}
