// ADR-0036: language packs — one-time AI-provisioned UI-string translations, persisted in
// the language_pack table, deterministic afterwards (mock=live safe). The catalog's KEY is
// the Hungarian source string itself (no invented key names): templates call T(d, "Galéria")
// and the pack maps that exact string to its translation. {placeholders} are preserved and
// guarded. Hungarian needs no pack (the source IS the string).

import { recordAiUsage } from "../ai/usage.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { ensureKbTranslations, kbCoverage, type KbPackStatus } from "./kbPacks.js";
import { recordTranslationSpend } from "./spend.js";
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

/**
 * Translate `strings` to `lang` through `ask`, with placeholder-integrity checking and
 * RETRY. Measured 2026-09-30 in production: 7 strings failed the check, were dropped, and
 * nothing asked again — the boot self-heal failed the same 7 twice, so the pack could
 * never become complete. Now a dropped string is re-asked (up to MAX_RETRY_ROUNDS) in a
 * small batch whose prompt lists, per string, the placeholders that must appear verbatim.
 * What still fails is reported LOUDLY and returned in `rejected`.
 */
export async function translateStrings(
  lang: string,
  strings: string[],
  ask: AskModel,
  opts: { maxRetryRounds?: number } = {},
): Promise<{ out: Record<string, string>; rejected: Record<string, string> }> {
  const maxRetry = opts.maxRetryRounds ?? MAX_RETRY_ROUNDS;
  const system =
    `Professzionális UI-honosító vagy. A megadott magyar felület-feliratokat fordítsd ` +
    `${langName(lang)} nyelvre. Szabályok: (1) tömör, természetes UI-nyelv, a szállás/vendéglátás ` +
    `regiszterében; (2) a {kapcsos} placeholdereket VÁLTOZATLANUL őrizd meg; kivétel az {art}, {Art}, ` +
    `{art2}: ezek a magyar határozott névelőt (a/az) jelölik, nem-magyar nyelven üresen jelennek meg — ` +
    `a fordításból hagyd ki őket; (3) tulajdonneveket (Citoviso, Google) ne fordíts; ` +
    `(4) semmi magyarázat — CSAK a kért JSON.`;
  const out: Record<string, string> = {};
  let rejected: Record<string, string> = {};

  const runBatch = async (batch: string[], user: string): Promise<void> => {
    let parsed: Record<string, string>;
    try {
      const text = await ask(system, user);
      if (!text) throw new Error("üres válasz");
      parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
    } catch (err) {
      for (const hu of batch) rejected[hu] = `a válasz nem értelmezhető: ${(err as Error).message}`;
      return;
    }
    for (const hu of batch) {
      const tr = parsed[hu];
      if (typeof tr !== "string" || !tr.trim()) {
        rejected[hu] = "hiányzik a válaszból";
        continue;
      }
      // Placeholder integrity: a broken translation is worse than a re-run.
      const problem = placeholderProblem(hu, tr);
      if (problem) {
        rejected[hu] = problem;
        continue;
      }
      out[hu] = tr;
    }
  };

  // Modest batches keep each response well-formed and reviewable.
  for (let i = 0; i < strings.length; i += 40) {
    const batch = strings.slice(i, i + 40);
    await runBatch(
      batch,
      `Add vissza JSON objektumként: {"<magyar>": "<fordítás>", ...} pontosan ezekre:\n` +
        JSON.stringify(batch, null, 1),
    );
  }

  for (let round = 1; round <= maxRetry && Object.keys(rejected).length; round++) {
    const again = Object.keys(rejected);
    console.error(`[i18n] újrapróba ${round}/${maxRetry} (${lang}): ${again.length} string`);
    rejected = {};
    for (let i = 0; i < again.length; i += 10) {
      const batch = again.slice(i, i + 10);
      const spec = batch.map((hu) => {
        const req = placeholders(hu).filter((t) => !isArticleToken(t));
        return { magyar: hu, kotelezo_placeholderek: req };
      });
      await runBatch(
        batch,
        `Az előző fordításod ezeknél megsértette a placeholder-szabályt. Fordítsd újra őket; a ` +
          `"kotelezo_placeholderek" MINDEGYIKE betűre, kapcsos zárójellel szerepeljen a fordításban, ` +
          `más {kapcsos} token ne (az {art}/{Art}/{art2} maradjon ki). ` +
          `Add vissza JSON objektumként: {"<magyar>": "<fordítás>", ...}:\n` +
          JSON.stringify(spec, null, 1),
      );
    }
  }

  for (const [hu, why] of Object.entries(rejected))
    console.error(`[i18n] ⛔ fordítás ELDOBVA újrapróba után is (${lang}): "${hu}" — ${why}`);
  return { out, rejected };
}

/** AI-translate the given Hungarian strings to `lang`. Returns hu→translated; strings that
 *  keep breaking the placeholder contract are left out so the coverage guard re-flags them. */
async function translateBatch(lang: string, strings: string[]): Promise<Record<string, string>> {
  if (!config.anthropicApiKey) throw new Error("i18n: nincs ANTHROPIC_API_KEY a csomag-generáláshoz");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const ask: AskModel = async (system, user) => {
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
    });
    recordAiUsage("translateUiBatch", "claude-opus-4-8", res.usage);
    await recordTranslationSpend("translateUiBatch", lang, "claude-opus-4-8", res.usage);
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : null;
  };
  return (await translateStrings(lang, strings, ask)).out;
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
 * the ADR-0036 automation hook. Missing entries are AI-translated and upserted; the cache
 * refreshes. Returns coverage; `ok=false` means generation could not complete (missing key,
 * API failure) — callers log loudly, generation still proceeds with hu-fallback.
 */
export async function ensureLanguagePack(lang: string): Promise<PackStatus> {
  const catalog = await loadCatalog();
  if (lang === DEFAULT_LANG || !catalog.length) {
    return { lang, total: catalog.length, missing: 0, ok: true };
  }
  const existing = (await loadPack(lang)) ?? {};
  let missing = await missingPackStrings(lang);
  if (missing.length) {
    console.log(`[i18n] nyelvi csomag provisioning: ${lang} — ${missing.length} hiányzó string`);
    try {
      const translated = await translateBatch(lang, missing);
      const merged = { ...existing, ...translated };
      await db
        .insertInto("language_pack")
        .values({ lang, strings: JSON.stringify(merged) as never, status: "generated" })
        .onConflict((oc) =>
          oc.column("lang").doUpdateSet({
            strings: JSON.stringify(merged) as never,
            updated_at: sql`now()`,
          }),
        )
        .execute();
      cache.set(lang, merged);
      missing = catalog.filter((s) => !merged[s]);
    } catch (err) {
      console.error(`[i18n] csomag-generálás HIBA (${lang}): ${(err as Error).message}`);
    }
  }
  // ADR-0045 ③ (§J.25): a language is only "ready" WITH its knowledge base — same
  // entry point as the UI strings, so every existing trigger (scrape into a region,
  // mock generation, boot self-heal, CLI) covers the KB with no new call sites.
  // A KB failure must not break the string pack; it reports loudly instead.
  let kb: KbPackStatus | null = null;
  try {
    kb = await ensureKbTranslations(lang);
  } catch (err) {
    console.error(`[i18n] KB-fordítás HIBA (${lang}): ${(err as Error).message}`);
  }
  const status = {
    lang,
    total: catalog.length,
    missing: missing.length,
    ok: missing.length === 0 && (kb?.ok ?? false),
    kb,
  };
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
