// ADR-0063 „Többnyelvű honlap" — the PAID generation: translate the site's CURRENT
// persisted content into the purchased 3 languages and write per-language static
// snapshots (sites/<tenant_id>/<lang>/…) through the SAME deterministic engine as
// the primary (mock=live; never a fresh AI design — snapshot doctrine).
//
// §B.17 in translation: the translator TRANSFERS, it never authors — no number,
// price, name or fact may appear, vanish or change. Enforced by a digit-integrity guard
// that drops any translation whose digit sequences differ from the source.
//
// ⛔ NO API TRANSLATION (owner, 2026-10-27, ADR-0412): the site copy is translated by
// Bábel in his subscription session (babel-pack site-export / site-import) and committed
// as src/i18n/babel/sites/<site-id>/<lang>.json ({hu source: translation}). This job only
// READS that file. While any source string is untranslated the generation fails with a
// „Bábelre vár” error — the resume watcher retries, and after its series the operator is
// alerted to hand the work to Bábel (multilangResume.ts). A half-Hungarian paid page never
// ships.

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "../db/client.js";
import type { SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { withLegalStrip } from "../engine/legalPages.js";
import { loadTenantLegal } from "./legalIdentity.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { DEFAULT_LANG, siteLangs } from "../i18n/lang.js";
import {
  effectiveSiteForMultilang,
  photosByUnit,
  rerenderTenantSnapshot,
  unitPageData,
  type PhotoEdit,
} from "./editor.js";
import {
  applyTranslationMap,
  collectTranslatableStrings,
  decorateWithLanguages,
  multilangContentHash,
  translateRecipe,
  type TranslatableUnit,
} from "./multilangCore.js";

/** Digit sequences of a string, order-preserving — the §B.17 integrity fingerprint. */
function digits(s: string): string {
  return (s.match(/\d+/g) ?? []).join("|");
}

/** Bábel's committed site translation for `siteId` × `lang` (hu source → translation). */
export function babelSiteSeedPath(siteId: string, lang: string): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../i18n/babel/sites", siteId, `${lang}.json`);
}

/** Thrown when Bábel has not (fully) translated a paid site yet — never a silent half page. */
export class AwaitingBabelError extends Error {
  constructor(readonly siteId: string, readonly lang: string, readonly missing: number) {
    super(
      `Bábelre vár (${lang}): ${missing} szöveg nincs lefordítva — ` +
        `npx tsx scripts/babel-pack.mts site-export ${siteId} ${lang}`,
    );
    this.name = "AwaitingBabelError";
  }
}

/**
 * The site copy in `lang`, from Bábel's committed file. Returns source→translated for
 * every source string, or throws AwaitingBabelError naming how many are missing. A seed
 * entry that changes a number (§B.17 digit integrity) counts as missing, loudly.
 */
export function babelSiteTranslations(
  siteId: string,
  lang: string,
  strings: readonly string[],
): Record<string, string> {
  let seed: Record<string, string> = {};
  try {
    seed = JSON.parse(readFileSync(babelSiteSeedPath(siteId, lang), "utf8")) as Record<string, string>;
  } catch {
    seed = {};
  }
  const out: Record<string, string> = {};
  let missing = 0;
  for (const src of strings) {
    const tr = seed[src];
    if (typeof tr !== "string" || !tr.trim()) {
      missing++;
      continue;
    }
    // §B.17 digit integrity: a "translation" that changes any number is refused.
    if (digits(src) !== digits(tr)) {
      console.error(`[multilang] szám-eltérés Bábel fordításában (${lang}), nem használható: "${src}"`);
      missing++;
      continue;
    }
    out[src] = tr;
  }
  if (missing) throw new AwaitingBabelError(siteId, lang, missing);
  return out;
}

export interface MultilangRunResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly languages?: string[];
}

/** Valid, deduped target set: supported codes, primary excluded. */
export function normalizeTargetLangs(langs: readonly string[], primaryLang: string): string[] {
  const supported = new Set(siteLangs());
  return [...new Set(langs.map((l) => l.trim().toLowerCase()))].filter(
    (l) => supported.has(l) && l !== primaryLang,
  );
}

/**
 * Run a PAID generation end to end. Idempotent per generation row: only a
 * 'paid' (or a retried 'failed'/'generating') row runs; 'done' returns ok.
 * The translation source is the CURRENT persisted effective content — the tenant
 * was told to save everything first, and whatever is saved NOW is what they pay
 * for; the stored hash is updated to match, so the state starts 'active'.
 */
export async function runMultilangGeneration(generationId: string): Promise<MultilangRunResult> {
  const gen = await db
    .selectFrom("multilang_generation")
    .selectAll()
    .where("id", "=", generationId)
    .executeTakeFirst();
  if (!gen) return { ok: false, error: "nincs ilyen generálás" };
  if (gen.status === "done") return { ok: true, languages: gen.languages };
  if (gen.status === "pending_payment") return { ok: false, error: "a generálás nincs kifizetve" };

  await db
    .updateTable("multilang_generation")
    .set({ status: "generating", heartbeat_at: new Date() })
    .where("id", "=", generationId)
    .execute();

  try {
    const site = await effectiveSiteForMultilang(gen.tenant_id);
    if (!site) throw new Error("a site nem renderelhető (nincs recipe/siteData)");
    const s = site.site;
    const primaryLang = site.effective.lang ?? DEFAULT_LANG;
    const langs = normalizeTargetLangs(gen.languages, primaryLang);
    if (!langs.length) throw new Error("nincs érvényes célnyelv");

    // UI strings (T()/tr() surface) come from Bábel's language packs — make sure every
    // target pack is complete before any page renders in that language.
    // The gate is the STRING coverage only: PackStatus.ok also folds in the ADMIN
    // knowledge-base translations (ADR-0045 ③), and a KB gap must not block a PAID
    // guest-site generation — the KB self-heals on its own triggers (measured live:
    // a single dropped KB entry failed the whole purchase here).
    for (const lang of langs) {
      const pack = await ensureLanguagePack(lang);
      if (pack.missing > 0) {
        throw new Error(`hiányos nyelvi csomag (${lang}): ${pack.missing} string hiányzik`);
      }
      if (!pack.ok) {
        console.error(`[multilang] KB-fordítás hiányos (${lang}) — a generálás megy tovább, a KB ön-gyógyul`);
      }
    }

    const sourceStrings = collectTranslatableStrings(site.effective, site.units, s.recipe);
    // Every language's copy must be there BEFORE the first file is written.
    const maps = new Map(langs.map((lang) => [lang, babelSiteTranslations(s.id, lang, sourceStrings)]));
    const currentHash = multilangContentHash(site.effective, site.units, s.recipe);
    const baseDir = path.dirname(path.resolve(process.cwd(), s.path!));
    const finalize = (html: string): string =>
      s.status === "live" ? html : toPrivatePreview(html, s.id);
    const decorate = (html: string, lang: string): string =>
      decorateWithLanguages(html, {
        current: lang,
        primaryLang,
        languages: langs,
        ...(s.status === "live" && s.canonicalUrl ? { baseUrl: s.canonicalUrl } : {}),
      });

  // ADR-0110: the paid language versions carry the same standing legal strip as the
  // primary page. Without it the /de/ and /en/ pages had NO imprint link at all —
  // the very gap this ADR closed on the Hungarian page (KB audit, 2026-09-08). The
  // legal PAGES themselves stay Hungarian: a legal pack is not a translation (§B.18).
  const legalWho = (await loadTenantLegal(s.tenantId)).who;

    for (const lang of langs) {
      // ADR-0118 ÉLETJEL: a watcher must tell a SLOW run from a DEAD one — or it would
      // start a second run alongside a live one (racing writes on the same files).
      await db
        .updateTable("multilang_generation")
        .set({ heartbeat_at: new Date() })
        .where("id", "=", generationId)
        .execute();
      const map = maps.get(lang)!;
      const { data, units } = applyTranslationMap(site.effective, site.units, map, lang);
      // The recipe's editorial voice (section kickers/headings) translates too —
      // without this the German page carried Hungarian section titles (measured).
      const recipe = translateRecipe(s.recipe, map);
      const dir = path.join(baseDir, lang);
      await mkdir(dir, { recursive: true });

      const html = withLegalStrip(
        await injectRuntime(
          renderSite(recipe, data, { phase: "live", hideGallery: site.hideGallery, hideAnchors: site.hideAnchors }),
          lang,
          "live",
        ),
        legalWho,
      );
      await writeFile(path.join(dir, "index.html"), finalize(decorate(html, lang)), "utf8");

      // ADR-0044/d unit subpages, unit-scoped data through the SAME recipe. Slugs are
      // NOT translated — /de/apartman/<slug> mirrors /apartman/<slug> one-to-one.
      if (units.length > 1) {
        const byUnit = photosByUnit((data.photos ?? []) as PhotoEdit[]);
        await mkdir(path.join(dir, "apartman"), { recursive: true });
        for (const u of units as TranslatableUnit[]) {
          if (!u.slug) continue;
          const pageData: SiteData | null = unitPageData(
            data,
            u,
            byUnit.get(u.id) ?? [],
            s.status === "live" && s.canonicalUrl ? `${s.canonicalUrl}/${lang}` : undefined,
          );
          if (!pageData) continue;
          const page = withLegalStrip(
            await injectRuntime(
              renderSite(recipe, pageData, { phase: "live", hideGallery: site.hideGallery, hideAnchors: site.hideAnchors }),
              lang,
              "live",
            ),
            legalWho,
          );
          await writeFile(
            path.join(dir, "apartman", `${u.slug}.html`),
            finalize(decorate(page, lang)),
            "utf8",
          );
        }
      }

      // The translated data snapshot: a motor-CSS/template fix can re-render these
      // pages DETERMINISTICALLY later without paying for a new translation
      // (snapshot-rerender doctrine) — the translation is the paid asset, not the HTML.
      await writeFile(path.join(dir, "data.json"), JSON.stringify({ data, units, recipe }), "utf8");
    }

    // The paid state becomes the anchor: languages + the hash of what was translated.
    await db
      .insertInto("site_multilang")
      .values({
        site_id: gen.site_id,
        languages: langs,
        status: "active",
        content_hash: currentHash,
        generated_at: new Date() as unknown as never,
        notified_at: null,
        updated_at: new Date() as unknown as never,
      })
      .onConflict((oc) =>
        oc.column("site_id").doUpdateSet({
          languages: langs,
          status: "active",
          content_hash: currentHash,
          generated_at: new Date(),
          notified_at: null,
          updated_at: new Date(),
        }),
      )
      .execute();

    // Billing truth: the module entitlement turns on with the first paid generation.
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: gen.tenant_id, module: "multilang", active: true })
      .onConflict((oc) => oc.columns(["tenant_id", "module"]).doUpdateSet({ active: true }))
      .execute();

    // Primary snapshot picks up the language switcher + hreflang (ADR-0063 §6).
    await rerenderTenantSnapshot(gen.tenant_id);

    await db
      .updateTable("multilang_generation")
      .set({
        status: "done",
        error: null,
        content_hash: currentHash,
        languages: langs,
        heartbeat_at: new Date(),
        finished_at: new Date() as unknown as never,
      })
      .where("id", "=", generationId)
      .execute();
    return { ok: true, languages: langs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[multilang] generálás HIBA (${generationId}): ${msg}`);
    await db
      .updateTable("multilang_generation")
      // heartbeat_at is the UNIFORM "last time anything happened" marker (ADR-0118):
      // the watcher's backoff reads it on failed rows too, so a transient failure
      // (empty API balance) waits out the window instead of looping instantly.
      .set({
        status: "failed",
        error: msg,
        heartbeat_at: new Date(),
        finished_at: new Date() as unknown as never,
      })
      .where("id", "=", generationId)
      .execute();
    return { ok: false, error: msg };
  }
}
