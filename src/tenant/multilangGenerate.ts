// ADR-0063 „Többnyelvű honlap" — the PAID generation: translate the site's CURRENT
// persisted content into the purchased 3 languages and write per-language static
// snapshots (sites/<tenant_id>/<lang>/…) through the SAME deterministic engine as
// the primary (mock=live; never a fresh AI design — snapshot doctrine).
//
// §B.17 in translation: the translator TRANSFERS, it never authors — no number,
// price, name or fact may appear, vanish or change. Enforced two ways: the system
// prompt states it, and a digit-integrity guard drops any translation whose digit
// sequences differ from the source (source survives loudly instead).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";
import { db } from "../db/client.js";
import type { SiteData } from "../engine/recipe.js";
import { renderSite } from "../engine/render.js";
import { injectRuntime } from "../generator/runtime.js";
import { toPrivatePreview } from "../conversion/provision.js";
import { ensureLanguagePack } from "../i18n/packs.js";
import { DEFAULT_LANG, langName, supportedLangs } from "../i18n/lang.js";
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

/**
 * AI-translate free-text site content to `lang`. Returns source→translated.
 * Same adapter pattern as the UI-pack translator (i18n/packs.ts), but the register
 * is the GUEST-facing site copy and the §B.17 fact-preservation rules are hard.
 */
async function translateStrings(
  lang: string,
  strings: readonly string[],
): Promise<Record<string, string>> {
  if (!config.anthropicApiKey) {
    throw new Error("multilang: nincs ANTHROPIC_API_KEY a fordítás-generáláshoz");
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const out: Record<string, string> = {};
  // Site copy runs longer than UI strings (intro paragraphs) → smaller batches.
  for (let i = 0; i < strings.length; i += 20) {
    const batch = strings.slice(i, i + 20);
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system:
        `Professzionális honosító-fordító vagy: egy szálláshely honlapjának vendég-oldali ` +
        `szövegeit fordítod magyarról ${langName(lang)} nyelvre. SZIGORÚ szabályok: ` +
        `(1) ÁTÜLTETSZ, nem alkotsz — tényt, számot, árat, mértéket, dátumot, tulajdonnevet ` +
        `nem adhatsz hozzá, nem hagyhatsz el és nem változtathatsz meg; ` +
        `(2) a hangnem természetes, vendégcsalogató, de tartalmilag PONTOSAN a forrás; ` +
        `(3) tulajdonneveket (a szállás neve, településnevek, Citoviso, Google) nem fordítasz — ` +
        `település ismert exonimája használható (Wien/Vienna); ` +
        `(4) semmi magyarázat — CSAK a kért JSON.`,
      messages: [
        {
          role: "user",
          content:
            `Add vissza JSON objektumként: {"<magyar forrás>": "<fordítás>", ...} ` +
            `pontosan ezekre a szövegekre:\n` +
            JSON.stringify(batch, null, 1),
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") continue;
    const jsonText = block.text.slice(block.text.indexOf("{"), block.text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as Record<string, string>;
    for (const src of batch) {
      const tr = parsed[src];
      if (typeof tr !== "string" || !tr.trim()) continue;
      // §B.17 digit integrity: a "translation" that changes any number is dropped —
      // the Hungarian source surviving on the page is honest; a wrong price is not.
      if (digits(src) !== digits(tr)) {
        console.error(`[multilang] szám-eltérés a fordításban (${lang}), forrás marad: "${src}"`);
        continue;
      }
      out[src] = tr;
    }
  }
  return out;
}

export interface MultilangRunResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly languages?: string[];
}

/** Valid, deduped target set: supported codes, primary excluded. */
export function normalizeTargetLangs(langs: readonly string[], primaryLang: string): string[] {
  const supported = new Set(supportedLangs());
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
    .set({ status: "generating" })
    .where("id", "=", generationId)
    .execute();

  try {
    const site = await effectiveSiteForMultilang(gen.tenant_id);
    if (!site) throw new Error("a site nem renderelhető (nincs recipe/siteData)");
    const s = site.site;
    const primaryLang = site.effective.lang ?? DEFAULT_LANG;
    const langs = normalizeTargetLangs(gen.languages, primaryLang);
    if (!langs.length) throw new Error("nincs érvényes célnyelv");

    // UI strings (T()/tr() surface) come from the one-time language packs — make
    // sure every target pack exists before any page renders in that language.
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

    for (const lang of langs) {
      const map = await translateStrings(lang, sourceStrings);
      const { data, units } = applyTranslationMap(site.effective, site.units, map, lang);
      // The recipe's editorial voice (section kickers/headings) translates too —
      // without this the German page carried Hungarian section titles (measured).
      const recipe = translateRecipe(s.recipe, map);
      const dir = path.join(baseDir, lang);
      await mkdir(dir, { recursive: true });

      const html = await injectRuntime(renderSite(recipe, data, { phase: "live" }), lang);
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
          const page = await injectRuntime(renderSite(recipe, pageData, { phase: "live" }), lang);
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
      .set({ status: "failed", error: msg, finished_at: new Date() as unknown as never })
      .where("id", "=", generationId)
      .execute();
    return { ok: false, error: msg };
  }
}
