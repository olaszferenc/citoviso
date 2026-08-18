// ADR-0036: language packs — one-time AI-provisioned UI-string translations, persisted in
// the language_pack table, deterministic afterwards (mock=live safe). The catalog's KEY is
// the Hungarian source string itself (no invented key names): templates call T(d, "Galéria")
// and the pack maps that exact string to its translation. {placeholders} are preserved and
// guarded. Hungarian needs no pack (the source IS the string).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "kysely";

import { config } from "../config.js";
import { db } from "../db/client.js";
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

/** AI-translate the given Hungarian strings to `lang`. Returns hu→translated. Placeholders
 *  ({name}, {price}…) must survive verbatim; violations are dropped so the guard re-flags. */
async function translateBatch(lang: string, strings: string[]): Promise<Record<string, string>> {
  if (!config.anthropicApiKey) throw new Error("i18n: nincs ANTHROPIC_API_KEY a csomag-generáláshoz");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const out: Record<string, string> = {};
  // Modest batches keep each response well-formed and reviewable.
  for (let i = 0; i < strings.length; i += 40) {
    const batch = strings.slice(i, i + 40);
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system:
        `Professzionális UI-honosító vagy. A megadott magyar felület-feliratokat fordítsd ` +
        `${langName(lang)} nyelvre. Szabályok: (1) tömör, természetes UI-nyelv, a szállás/vendéglátás ` +
        `regiszterében; (2) a {kapcsos} placeholdereket VÁLTOZATLANUL őrizd meg; (3) tulajdonneveket ` +
        `(Citoviso, Google) ne fordíts; (4) semmi magyarázat — CSAK a kért JSON.`,
      messages: [
        {
          role: "user",
          content:
            `Add vissza JSON objektumként: {"<magyar>": "<fordítás>", ...} pontosan ezekre:\n` +
            JSON.stringify(batch, null, 1),
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") continue;
    const jsonText = block.text.slice(block.text.indexOf("{"), block.text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as Record<string, string>;
    for (const hu of batch) {
      const tr = parsed[hu];
      if (typeof tr !== "string" || !tr.trim()) continue;
      // Placeholder integrity: a broken translation is worse than a re-run.
      if (placeholders(hu).join("|") !== placeholders(tr).join("|")) continue;
      out[hu] = tr;
    }
  }
  return out;
}

export interface PackStatus {
  readonly lang: string;
  readonly total: number;
  readonly missing: number;
  readonly ok: boolean;
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
  let missing = catalog.filter((s) => !existing[s]);
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
  const status = { lang, total: catalog.length, missing: missing.length, ok: missing.length === 0 };
  if (!status.ok) console.error(`[i18n] ⛔ hiányos csomag (${lang}): ${missing.length}/${catalog.length}`);
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
