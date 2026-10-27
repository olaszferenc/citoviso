// ADR-0036: language packs — UI-string translations persisted in the language_pack table,
// deterministic afterwards (mock=live safe). ⛔ Since 2026-10-27 (ADR-XXXX) the ONLY source of
// a translation is Bábel's committed pack (src/i18n/babel/packs/<lang>.json, made in his
// subscription session): no code path translates through the API. The catalog's KEY is
// the Hungarian source string itself (no invented key names): templates call T(d, "Galéria")
// and the pack maps that exact string to its translation. {placeholders} are preserved and
// guarded. Hungarian needs no pack (the source IS the string).

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { db, pool } from "../db/client.js";
import { ensureKbTranslations, kbCoverage, kbSeedPending, type KbPackStatus } from "./kbPacks.js";
import { DEFAULT_LANG } from "./lang.js";

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
 *  pack/string falls back to Hungarian LOUDLY (once per key) — until Bábel translates it. */
const warned = new Set<string>();
export function tSync(lang: string | undefined, hu: string): string {
  const l = lang || DEFAULT_LANG;
  if (l === DEFAULT_LANG) return hu;
  const hit = cache.get(l)?.[hu];
  if (hit) return hit;
  const wk = `${l}:${hu}`;
  if (!warned.has(wk)) {
    warned.add(wk);
    console.error(`[i18n] hiányzó fordítás (${l}): "${hu}" — hu-fallback (Bábelre vár: babel-pack export ${l})`);
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
 * Never writes, costs nothing. It exists because a SCREEN may have to ask "would this
 * send succeed?" without mutating state on a GET: `ensureLanguagePack` below WRITES
 * (applies Bábel's seed to the DB). The send path and the screen therefore share this one
 * measurement, and only differ in whether they may act on the gap.
 */
export async function missingPackStrings(lang: string): Promise<string[]> {
  const catalog = await loadCatalog();
  if (lang === DEFAULT_LANG || !catalog.length) return [];
  const existing = (await loadPack(lang)) ?? {};
  return catalog.filter((s) => !existing[s]);
}

/**
 * Bring the language pack for `lang` up to what Bábel has COMMITTED — the ADR-0036
 * automation hook. Bábel's seed (UI strings + help entries) is applied to the DB and the
 * cache refreshes. Nothing is translated here: ⛔ no API call (owner, 2026-10-27,
 * ADR-XXXX). Returns coverage; `ok=false` means Bábel has not translated everything yet —
 * callers log loudly, rendering proceeds with the hu-fallback, and `babel-pack export`
 * lists the gap for Bábel's session.
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
  // Fast path — the common case (every letter calls this): nothing of Bábel's seed is
  // waiting to be applied → nothing to do, no lock, no connection held. A gap Bábel has not
  // translated yet is NOT work for this function (it can only be filled by his session).
  if (!(await seedPending(lang))) return coverageNow(lang);
  const again = inflight.get(lang); // another caller may have started while we measured
  if (again) return again;
  const p = exclusiveRun(lang, opts.wait ?? true).finally(() => inflight.delete(lang));
  inflight.set(lang, p);
  return p;
}

const inflight = new Map<string, Promise<PackStatus>>();

/** True while THIS process is applying Bábel's seed for `lang`. */
export function packBuilding(lang: string): boolean {
  return inflight.has(lang);
}

/**
 * Synchronous pack state for a page frame (render time cannot await): null when the
 * language is Hungarian or its pack covers the catalog; otherwise whether THIS process is
 * applying Bábel's seed and how many strings still fall back to Hungarian.
 */
export function packGapSync(lang: string): { building: boolean; missing: number } | null {
  if (lang === DEFAULT_LANG) return null;
  const building = inflight.has(lang);
  const pack = cache.get(lang) ?? {};
  const missing = catalogCache ? catalogCache.filter((s) => !pack[s]).length : building ? -1 : 0;
  return building || missing > 0 ? { building, missing } : null;
}

/**
 * Apply Bábel's pending seed for `lang` in the BACKGROUND, and return at once. For request
 * paths (console language switch, page renders, scrape start): they render with the
 * hu-fallback meanwhile and never wait.
 */
export function requestLanguagePack(lang: string): void {
  if (lang === DEFAULT_LANG || inflight.has(lang)) return;
  void (async () => {
    if (!(await seedPending(lang))) return;
    await ensureLanguagePack(lang, { wait: false });
  })().catch((e) => console.error(`[i18n] háttér-provisioning HIBA (${lang}): ${(e as Error).message}`));
}

/** Advisory-lock key: one per language, namespaced so it collides with nothing else. */
const lockKey = (lang: string): string => `citoviso:i18n-pack:${lang}`;

/** How long a waiting caller queues behind another process's run before giving up (a run
 *  only copies committed files into the DB — seconds, not minutes). */
const LOCK_WAIT = "2min";

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
        console.log(`[i18n] ${lang}: egy másik folyamat már alkalmazza a Bábel-magot — nem indítok újat`);
        return await coverageNow(lang, { fresh: true });
      }
      console.log(`[i18n] ${lang}: egy másik folyamat már alkalmazza a Bábel-magot — megvárom`);
      await conn.query(`set lock_timeout = '${LOCK_WAIT}'`);
      try {
        await conn.query("select pg_advisory_lock(hashtext($1))", [lockKey(lang)]);
        locked = true;
      } catch (err) {
        console.error(`[i18n] ${lang}: a másik futás nem ért véget ${LOCK_WAIT} alatt — hu-fallback (${(err as Error).message})`);
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

/** Coverage without writing. `fresh` re-reads the pack from the DB (another process wrote it). */
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

/** Bábel's committed work for `lang` that the DB does not have yet (UI strings + help
 *  entries). 0 → ensureLanguagePack has nothing to do. */
async function seedPending(lang: string): Promise<number> {
  const ui = applyBabelSeed(lang, (await loadPack(lang)) ?? {}, await loadCatalog()).changed;
  return ui + (await kbSeedPending(lang));
}

/** The run itself — only ever entered under the language's lock. Copies Bábel's committed
 *  seed into the DB; ⛔ translates nothing (no API call, ADR-XXXX). */
async function provision(lang: string): Promise<PackStatus> {
  const catalog = await loadCatalog();
  if (!catalog.length) return { lang, total: 0, missing: 0, ok: true };
  const existing = (await loadPack(lang)) ?? {};
  const seeded = applyBabelSeed(lang, existing, catalog);
  if (seeded.changed) {
    await upsertPack(lang, seeded.merged);
    console.log(`[i18n] ${lang}: Bábel-mag alkalmazva — ${seeded.changed} string a babel/packs/${lang}.json-ból`);
  }
  const missing = catalog.filter((s) => !seeded.merged[s]).length;
  // ADR-0045 ③ (§J.25): a language is only "ready" WITH its knowledge base — same entry
  // point as the UI strings. A KB failure must not break the string pack; it reports loudly.
  let kb: KbPackStatus | null = null;
  try {
    kb = await ensureKbTranslations(lang);
  } catch (err) {
    console.error(`[i18n] KB-mag HIBA (${lang}): ${(err as Error).message}`);
  }
  if (missing)
    console.error(
      `[i18n] ⛔ hiányos csomag (${lang}): ${missing}/${catalog.length} — hu-fallback; Bábelre vár ` +
        `(npx tsx scripts/babel-pack.mts export ${lang})`,
    );
  if (kb && !kb.ok) console.error(`[i18n] ⛔ hiányos KB (${lang}): ${kb.missing}/${kb.total} — Bábelre vár (babel-pack kb-export ${lang})`);
  return { lang, total: catalog.length, missing, ok: missing === 0 && (kb?.ok ?? false), kb };
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
 * Deploy-time / boot-time sync (ADR-0036 kiegészítés): applies Bábel's committed seed to
 * EVERY known language and reports what is still missing. Wired into server startup, so a
 * deploy+restart brings the packs up to the deployed version; also runnable as a CLI
 * (scripts/i18n-pack-status.mts --ensure). ⛔ It never translates (ADR-XXXX): a gap stays a
 * gap until Bábel fills it in his session.
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
