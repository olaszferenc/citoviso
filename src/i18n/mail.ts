// ADR-0067 — the i18n doctrine reaches the OUTGOING MAIL.
//
// ⛔ WHY THIS FILE EXISTS (measured 2026-08-25, owner catch): every customer mail
// — tenant credentials, invoice, preview-ready, booking confirmations to the
// tenant's GUESTS, review thank-yous — was hardcoded Hungarian, `<html lang="hu">`
// and all. A Polish tenant, and that tenant's German guest, would have received
// Hungarian. The rendered PAGE was doctrine-bound and guarded (ADR-0036 §B.18),
// but the guards' FILE LISTS never included src/email/*, so the whole mail surface
// sat outside the doctrine while every gate stayed green.
//
// The call shape is deliberately IDENTICAL to the page-side T(d, "…"): the
// extractor and the lint both key on `T(<ident>, "…")`, so the mail chain joins
// the existing machinery instead of growing a parallel one that can drift.

import { db } from "../db/client.js";
import { DEFAULT_LANG, langForCountry } from "./lang.js";
import { ensureLanguagePack, tSync } from "./packs.js";

/**
 * Translate one mail string to `lang` (the Hungarian source IS the key), with
 * {placeholder} substitution. Same contract as the page-side T().
 */
export function T(
  lang: string | undefined,
  hu: string,
  vars?: Record<string, string | number>,
): string {
  let s = tSync(lang, hu);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/**
 * A language's display name, IN the reader's language ("niemiecki (Deutsch)" for
 * a Polish reader, not "német (Deutsch)"). Written as literal T() calls on
 * purpose: the catalog extractor only sees literals, so a lookup table keyed by
 * code would silently ship untranslated. The endonym in brackets is universal
 * and stays as-is.
 */
export function langNameLocalized(code: string, readerLang: string | undefined): string {
  switch (code) {
    case "hu":
      return T(readerLang, "magyar");
    case "pl":
      return T(readerLang, "lengyel (polski)");
    case "de":
      return T(readerLang, "német (Deutsch)");
    case "sk":
      return T(readerLang, "szlovák (slovenčina)");
    case "cs":
      return T(readerLang, "cseh (čeština)");
    case "ro":
      return T(readerLang, "román (română)");
    case "hr":
      return T(readerLang, "horvát (hrvatski)");
    case "sl":
      return T(readerLang, "szlovén (slovenščina)");
    case "it":
      return T(readerLang, "olasz (italiano)");
    case "en":
      return T(readerLang, "angol (English)");
    // ── ADR-0128: the 19 languages that joined the sellable set ────────────────
    // ⛔ Literal T() calls, one per language, for the reason stated above: the
    // catalog extractor only sees literals. A `T(readerLang, LANG_NAME[code])`
    // one-liner would look tidier and ship every name untranslated.
    case "sr":
      return T(readerLang, "szerb (srpski)");
    case "uk":
      return T(readerLang, "ukrán (українська)");
    case "fr":
      return T(readerLang, "francia (français)");
    case "nl":
      return T(readerLang, "holland (Nederlands)");
    case "ga":
      return T(readerLang, "ír (Gaeilge)");
    case "es":
      return T(readerLang, "spanyol (español)");
    case "pt":
      return T(readerLang, "portugál (português)");
    case "el":
      return T(readerLang, "görög (ελληνικά)");
    case "mt":
      return T(readerLang, "máltai (Malti)");
    case "da":
      return T(readerLang, "dán (dansk)");
    case "sv":
      return T(readerLang, "svéd (svenska)");
    case "fi":
      return T(readerLang, "finn (suomi)");
    case "no":
      return T(readerLang, "norvég (norsk)");
    case "et":
      return T(readerLang, "észt (eesti)");
    case "lv":
      return T(readerLang, "lett (latviešu)");
    case "lt":
      return T(readerLang, "litván (lietuvių)");
    case "bg":
      return T(readerLang, "bolgár (български)");
    case "ru":
      return T(readerLang, "orosz (русский)");
    case "tr":
      return T(readerLang, "török (Türkçe)");
    default:
      return code;
  }
}

/**
 * ADR-0128 — a multilang TIER's name in the reader's language. Same literal-T()
 * discipline as langNameLocalized: the tier name lives in MULTILANG_TIERS as data,
 * and `T(readerLang, tier.name)` would never reach the catalog.
 */
export function multilangTierName(id: string, readerLang: string | undefined): string {
  switch (id) {
    case "alap":
      return T(readerLang, "Alap");
    case "bovitett":
      return T(readerLang, "Bővített");
    case "teljes":
      return T(readerLang, "Teljes");
    default:
      return id;
  }
}

/** ADR-0128 — a language-picker region heading, in the reader's language. */
export function langRegionName(key: string, readerLang: string | undefined): string {
  switch (key) {
    case "neighbours":
      return T(readerLang, "Szomszédok");
    case "central":
      return T(readerLang, "Közép-Európa");
    case "west":
      return T(readerLang, "Nyugat-Európa");
    case "south":
      return T(readerLang, "Dél-Európa");
    case "north":
      return T(readerLang, "Észak-Európa");
    case "east":
      return T(readerLang, "Kelet-Európa");
    default:
      return key;
  }
}

/**
 * The language a tenant (and their guests) must be written to: the SITE's own
 * language, which ADR-0036 already derived from the region's country and froze
 * into the generated site data. One truth — the page and the mail can never
 * disagree about what language this customer speaks.
 */
export async function langForTenant(tenantId: string): Promise<string> {
  const row = await db
    .selectFrom("site")
    .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("mock_artifact.inputs as inputs")
    .where("site.tenant_id", "=", tenantId)
    .executeTakeFirst();
  return readLang(row?.inputs);
}

/** Same, keyed on a bookable UNIT (price/season editors hold only the unit id). */
export async function langForUnit(unitId: string): Promise<string> {
  const row = await db
    .selectFrom("site_unit")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("mock_artifact.inputs as inputs")
    .where("site_unit.id", "=", unitId)
    .executeTakeFirst();
  return readLang(row?.inputs);
}

/** Same, keyed on the site id (booking/review flows already hold that). */
export async function langForSite(siteId: string): Promise<string> {
  const row = await db
    .selectFrom("site")
    .innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("mock_artifact.inputs as inputs")
    .where("site.id", "=", siteId)
    .executeTakeFirst();
  return readLang(row?.inputs);
}

/**
 * A LEAD has no site yet. Its language is the one its MOCK was generated in —
 * the same frozen `siteData.lang` the tenant would inherit on conversion, so the
 * preview mail and the previewed page can never disagree. Falls back to the
 * scrape definition's country (ADR-0036), then Hungarian.
 */
export async function langForLead(leadId: string): Promise<string> {
  const art = await db
    .selectFrom("mock_artifact")
    .select("inputs")
    .where("lead_id", "=", leadId)
    .orderBy("generated_at", "desc")
    .executeTakeFirst();
  const fromArtifact = pickLang(art?.inputs);
  if (fromArtifact) return fromArtifact;
  const row = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin(
      "scraper_definition",
      "scraper_definition.id",
      "scrape_run.scraper_definition_id",
    )
    .select("scraper_definition.country as country")
    .where("lead.id", "=", leadId)
    .executeTakeFirst();
  return langForCountry(row?.country ?? null);
}

function pickLang(inputs: unknown): string | null {
  const lang = (inputs as { siteData?: { lang?: unknown } } | null)?.siteData?.lang;
  return typeof lang === "string" && lang ? lang : null;
}

function readLang(inputs: unknown): string {
  return pickLang(inputs) ?? DEFAULT_LANG;
}

/**
 * Load/provision the pack so the SYNC T() lookups in a mail builder resolve.
 * Never throws: a pack outage must not swallow a credentials or invoice mail —
 * tSync then falls back to Hungarian per string, loudly.
 */
export async function prepareMailLang(lang: string): Promise<string> {
  if (lang === DEFAULT_LANG) return lang;
  try {
    const st = await ensureLanguagePack(lang);
    if (st.missing > 0) {
      console.error(`[mail] hiányos nyelvi csomag (${lang}): ${st.missing} string — hu-fallback`);
    }
  } catch (err) {
    console.error(`[mail] nyelvi csomag HIBA (${lang}): ${(err as Error).message}`);
  }
  return lang;
}
