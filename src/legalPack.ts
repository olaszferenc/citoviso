// ORSZÁG-RÉTEG 3/7 (ADR-0458) — THE COUNTRY LEGAL PACK.
//
// Until this step there was ONE legal pack, the Hungarian one (src/legal.ts and the pages
// built from it), and the ADR-0111 market gate kept every other country shut for that reason.
// The lawyer's position (owner, 2026-11-18): today's texts placed IN THE COUNTRY'S LANGUAGE
// allow business in that country until the lawyer comments further. So:
//
//   · a country's pack = THIS Hungarian wording, translated by Bábel (subscription session —
//     never the API, scripts/no-api-translation-check.mts), committed as
//     src/i18n/babel/legal/<CC>.json  {country, lang, base, entries: {<hu source>: <translation>}}
//     + the country's mandatory LOCAL items (src/legal.ts LEGAL_LOCAL, data);
//   · the KEY is the Hungarian source itself (whole sentence / whole paragraph), so a change of
//     the Hungarian wording leaves the old translation unmatched → the pack is INCOMPLETE → the
//     country's gate closes until Bábel re-translates. No stale legal text can be published;
//   · §H.22 holds: deterministic, versioned, stamped (`legalStamp`: country + language + base
//     version); nothing is generated at run time;
//   · ⛔ NO HUNGARIAN FALLBACK. A country whose pack is not complete is closed (market gate,
//     src/markets.ts), and the page renderers refuse a non-Hungarian pack with a gap.
//
// Two ways one dictionary is applied: `t(hu)` for the short stamped wordings (consents,
// cookie bar, outreach sentences), and `translateLegalHtml()` for our own legal PAGES, whose
// translation unit is a block element's inner HTML rendered with placeholder values (see
// `LEGAL_PLACEHOLDER`). The Hungarian pack never runs either: its output is the old one byte
// for byte (brief 3/7: the HU pack may not change).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASZF_VERSION,
  COOKIE_BAR_TEXT_V1,
  DPA_V1,
  legalLocalDefined,
  legalLocalFor,
  OUTREACH_LEGAL_BASIS_V1,
  OUTREACH_LETTER_LEGAL_V1,
  OUTREACH_TRACKING_NOTICE_V1,
  PHOTO_RIGHTS_DECLARATION_V1,
  PRIVACY_CUSTOMER_V1,
  RECURRING_MANDATE_SHORT_V1,
  RECURRING_MANDATE_V1,
  TENANT_LEGAL_VERSION,
  TERMS_ACCEPTANCE_V1,
  TRIAL_CLICKWRAP_V1,
  UNSUBSCRIBE_TEXT_V1,
  VAT_NOTE_AAM,
  VAT_NOTE_REVERSE_CHARGE,
  WITHDRAWAL_WAIVER_SHORT_V1,
  WITHDRAWAL_WAIVER_V1,
  ASZF_V1,
  WITHDRAWAL_NOTICE_V1,
  type LegalSection,
} from "./legal.js";

/** The home pack's country and language: identity translation, never a file. */
export const HOME_LEGAL_COUNTRY = "HU";
export const HOME_LEGAL_LANG = "hu";

/** The Hungarian source version a country pack translates. A pack whose `base` differs is stale. */
export const LEGAL_PACK_BASE = `aszf-${ASZF_VERSION}+tenant-${TENANT_LEGAL_VERSION}`;

/** The documents of a pack (brief 3/7 ①) — the completeness report counts per document. */
export const LEGAL_DOCS = [
  "aszf", // ÁSZF page (+ the consumer dispute line where the country has one)
  "own_imprint", // our own Impresszum page
  "withdrawal", // withdrawal notice page + the waiver wording (+ short label)
  "recurring", // recurring card mandate (+ short label)
  "privacy_customer", // our privacy notice (prospect + customer chapters)
  "dpa", // data-processing terms page
  "photo_rights", // the photo-rights declaration
  "checkout", // ÁSZF acceptance + VAT notes
  "trial", // the free-trial click-wrap
  "tenant_imprint", // the accommodation's imprint (+ the country's local items)
  "tenant_privacy", // the accommodation's privacy notice
  "cookie", // the payment-provider cookie bar
  "outreach_notice", // the letter's legal line + the tracked page's legal sentences
  "unsubscribe", // the unsubscribe confirmation and done page
] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

/**
 * Placeholder values the pages are rendered with when their SOURCE units are enumerated and
 * when a country page is translated: the dynamic facts (our registry data, the tenant's name)
 * must not be part of a translation key. A translation keeps every `{{…}}` token verbatim.
 */
export const LEGAL_PLACEHOLDER = (name: string): string => `{{${name}}}`;

interface PackFile {
  readonly country: string;
  readonly lang: string;
  readonly base: string;
  readonly entries: Readonly<Record<string, string>>;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Where the committed packs live. The e2e points this at a fixture directory (never the API). */
export function legalPackDir(): string {
  return process.env.CIT_LEGAL_PACK_DIR || path.resolve(HERE, "i18n/babel/legal");
}

let fileCache: { dir: string; byCountry: Map<string, PackFile> } | null = null;

function packFiles(): Map<string, PackFile> {
  const dir = legalPackDir();
  if (fileCache?.dir === dir) return fileCache.byCountry;
  const byCountry = new Map<string, PackFile>();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!/^[A-Z]{2}\.json$/.test(f)) continue;
      try {
        const j = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as PackFile;
        const cc = f.slice(0, 2);
        if (j.country !== cc || typeof j.lang !== "string" || typeof j.entries !== "object") {
          console.error(`[legal-pack] ${f}: hibás fejléc (country/lang/entries) — a csomag nem él`);
          continue;
        }
        byCountry.set(cc, j);
      } catch (e) {
        console.error(`[legal-pack] ${f}: olvashatatlan —`, e);
      }
    }
  }
  fileCache = { dir, byCountry };
  return byCountry;
}

/** Drop the file cache (the import tool and the e2e write packs while a process runs). */
export function resetLegalPackCache(): void {
  fileCache = null;
  sourceCache = null;
}

const cc2 = (c: string | null | undefined): string => (c ?? "").trim().toUpperCase();

// ── SOURCES ──────────────────────────────────────────────────────────────────

function sectionStrings(secs: readonly LegalSection[]): string[] {
  return secs.flatMap((s) => [s.heading, ...s.body]);
}

/** The stamped/short wordings, per document — plain strings, translated with `t()`. */
function stringSources(): [LegalDoc, string][] {
  const out: [LegalDoc, string][] = [];
  const add = (doc: LegalDoc, ...ss: string[]) => ss.forEach((s) => out.push([doc, s]));
  add("withdrawal", WITHDRAWAL_WAIVER_V1, WITHDRAWAL_WAIVER_SHORT_V1);
  add("recurring", RECURRING_MANDATE_V1, RECURRING_MANDATE_SHORT_V1);
  add("photo_rights", PHOTO_RIGHTS_DECLARATION_V1);
  add("checkout", TERMS_ACCEPTANCE_V1, VAT_NOTE_AAM, VAT_NOTE_REVERSE_CHARGE);
  add("trial", TRIAL_CLICKWRAP_V1);
  add("cookie", ...Object.values(COOKIE_BAR_TEXT_V1));
  add("outreach_notice", OUTREACH_LEGAL_BASIS_V1, OUTREACH_TRACKING_NOTICE_V1, OUTREACH_LETTER_LEGAL_V1);
  add("unsubscribe", ...Object.values(UNSUBSCRIBE_TEXT_V1));
  // The document bodies are ALSO units of their pages (below); listed here too so a pack
  // that translates the page also serves the structured text (ÁSZF in the console etc.).
  add("aszf", ...sectionStrings(ASZF_V1));
  add("withdrawal", ...sectionStrings(WITHDRAWAL_NOTICE_V1));
  add("dpa", ...sectionStrings(DPA_V1));
  add("privacy_customer", ...sectionStrings(PRIVACY_CUSTOMER_V1));
  return out;
}

/** A page-unit source: the renderers register them (dynamic import — no cycle, no DB). */
type PageSourceFn = (country: string) => Promise<[LegalDoc, string][]>;

async function pageSources(country: string): Promise<[LegalDoc, string][]> {
  const own = await import("./server/legalViews.js");
  const tenant = await import("./engine/legalPages.js");
  return [...(await own.ownLegalPageSources(country)), ...tenant.tenantLegalPageSources(country)];
}
export type { PageSourceFn };

let sourceCache: Map<string, Map<string, LegalDoc>> | null = null;

/**
 * Every Hungarian source unit a country's pack must translate, with its document. The
 * country matters only for its local items (labels) and its consumer dispute line.
 */
export async function legalSources(country: string): Promise<ReadonlyMap<string, LegalDoc>> {
  const cc = cc2(country);
  sourceCache ??= new Map();
  const hit = sourceCache.get(cc);
  if (hit) return hit;
  const m = new Map<string, LegalDoc>();
  for (const [doc, hu] of [...stringSources(), ...(await pageSources(cc))]) {
    const k = normUnit(hu);
    if (k && !m.has(k)) m.set(k, doc);
  }
  sourceCache.set(cc, m);
  return m;
}

/** Whitespace-normalised unit key (the HTML source spans lines; the key does not). */
export function normUnit(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ── THE PACK ─────────────────────────────────────────────────────────────────

/** Raised when a non-Hungarian pack is asked for a unit it does not have (never HU fallback). */
export class LegalPackGap extends Error {
  constructor(readonly country: string, readonly hu: string) {
    super(`[legal-pack] ${country}: hiányzó fordítás — „${hu.slice(0, 80)}…” (Bábelre vár)`);
  }
}

export interface LegalPack {
  readonly country: string;
  readonly lang: string;
  readonly home: boolean;
  /** Stamped next to every accepted wording: country/language/source version. */
  readonly stamp: string;
  /** The translation of one source unit. Hungarian: the source. Missing: throws LegalPackGap. */
  t(hu: string): string;
}

/** `HU/hu/aszf-1.5+tenant-1.0` — the acceptance record names the country and the language. */
export function legalStamp(country: string, lang: string): string {
  return `${cc2(country)}/${lang}/${LEGAL_PACK_BASE}`;
}

const HOME_PACK: LegalPack = {
  country: HOME_LEGAL_COUNTRY,
  lang: HOME_LEGAL_LANG,
  home: true,
  stamp: legalStamp(HOME_LEGAL_COUNTRY, HOME_LEGAL_LANG),
  t: (hu) => hu,
};

/** The Hungarian pack — what every surface used before this step, unchanged. */
export function homeLegalPack(): LegalPack {
  return HOME_PACK;
}

function packFromFile(f: PackFile): LegalPack {
  const entries = new Map(Object.entries(f.entries).map(([k, v]) => [normUnit(k), v]));
  return {
    country: f.country,
    lang: f.lang,
    home: false,
    stamp: legalStamp(f.country, f.lang),
    t(hu: string): string {
      const v = entries.get(normUnit(hu));
      if (v === undefined || v === "") throw new LegalPackGap(f.country, hu);
      return v;
    },
  };
}

/**
 * The pack of a country, or null when it has none in `expectedLang` (the country row's
 * `default_lang`). Says nothing about completeness — `legalPackStatus` does; the renderers
 * throw on a gap, so a half pack can never print Hungarian.
 */
export function legalPackRaw(country: string | null | undefined, expectedLang?: string | null): LegalPack | null {
  const cc = cc2(country);
  if (cc === HOME_LEGAL_COUNTRY) return HOME_PACK;
  const f = packFiles().get(cc);
  if (!f) return null;
  if (expectedLang && f.lang !== expectedLang) return null;
  return packFromFile(f);
}

export interface LegalPackStatus {
  readonly country: string;
  /** The language the pack must be in (the country row's default_lang); null = no row. */
  readonly lang: string | null;
  readonly complete: boolean;
  /** Units to translate / still missing, in total and per document. */
  readonly total: number;
  readonly missing: number;
  readonly byDoc: Readonly<Partial<Record<LegalDoc, { total: number; missing: number }>>>;
  /** The country's local-item schema exists (src/legal.ts LEGAL_LOCAL). */
  readonly localDefined: boolean;
  /** OUR consumer dispute body: null = the country needs none; false = needed and not set. */
  readonly consumerAdrSet: boolean | null;
  /** Why the gate is shut, Hungarian operator text (the „Országok” lap shows it). */
  readonly reasons: readonly string[];
  /** A few of the missing source units (for Bábel / the console). */
  readonly sampleMissing: readonly string[];
}

/** The configured consumer dispute body of a country (env), or null when it needs none. */
export function consumerAdrValue(country: string | null | undefined): string | null | undefined {
  const adr = legalLocalFor(country).consumerAdr;
  if (!adr) return undefined; // not needed
  const v = (process.env[adr.envKey] ?? "").trim();
  return v || null;
}

/**
 * Is a country's legal pack COMPLETE in its language? THE function the market gate, the
 * country-layer guard and the („Országok”) console listing read. ⛔ Fail-closed: no country
 * row language, no file, wrong language, stale base, any missing unit, an undefined local
 * schema → incomplete. Hungary is complete by definition (its pack IS the source).
 */
export async function legalPackStatus(country: string | null | undefined, expectedLang: string | null): Promise<LegalPackStatus> {
  const cc = cc2(country);
  const adr = consumerAdrValue(cc);
  const consumerAdrSet = adr === undefined ? null : adr !== null;
  if (cc === HOME_LEGAL_COUNTRY) {
    return { country: cc, lang: HOME_LEGAL_LANG, complete: true, total: 0, missing: 0, byDoc: {},
      localDefined: true, consumerAdrSet: null, reasons: [], sampleMissing: [] };
  }
  const reasons: string[] = [];
  const localDefined = legalLocalDefined(cc);
  if (!localDefined) reasons.push("a helyi kötelező elemek sémája nincs definiálva (LEGAL_LOCAL)");
  if (!expectedLang) reasons.push("nincs ország-sor (default_lang) — a csomag nyelve ismeretlen");
  const sources = await legalSources(cc);
  const f = packFiles().get(cc);
  if (!f) reasons.push("nincs jogi csomag ennek az országnak (Bábelre vár)");
  else {
    if (expectedLang && f.lang !== expectedLang) reasons.push(`a csomag nyelve ${f.lang}, az országé ${expectedLang}`);
    if (f.base !== LEGAL_PACK_BASE) reasons.push(`a csomag a(z) ${f.base} forrásverziót fordítja, a mai ${LEGAL_PACK_BASE}`);
  }
  const entries = new Map(Object.entries(f?.entries ?? {}).map(([k, v]) => [normUnit(k), v]));
  const byDoc: Partial<Record<LegalDoc, { total: number; missing: number }>> = {};
  const sampleMissing: string[] = [];
  let missing = 0;
  for (const [hu, doc] of sources) {
    const d = (byDoc[doc] ??= { total: 0, missing: 0 });
    d.total++;
    const v = entries.get(hu);
    if (!v) {
      d.missing++;
      missing++;
      if (sampleMissing.length < 5) sampleMissing.push(hu);
    }
  }
  if (f && missing) reasons.push(`${missing} jogi szöveg-egység nincs lefordítva (Bábelre vár)`);
  return {
    country: cc,
    lang: expectedLang,
    complete: reasons.length === 0,
    total: sources.size,
    missing: f ? missing : sources.size,
    byDoc,
    localDefined,
    consumerAdrSet,
    reasons,
    sampleMissing,
  };
}

/**
 * The pack a surface may PUBLISH for a country: complete, in the expected language — else
 * null (the caller does not publish: market gate shut, page 404, preview without legal pages).
 */
export async function legalPackFor(country: string | null | undefined, expectedLang: string | null): Promise<LegalPack | null> {
  const st = await legalPackStatus(country, expectedLang);
  return st.complete ? legalPackRaw(country, expectedLang) : null;
}

// ── BY LANGUAGE (the outreach surfaces that know the page language, not the country) ──

/**
 * A legal sentence in a LANGUAGE — for the tracked page, the letter, the unsubscribe page and
 * the cookie bar, which carry the lead's (= its country's default) language. Any country pack
 * in that language serves: the lawyer's position is that the content is the same, only the
 * language differs. Hungarian / no language → the source.
 *
 * ⛔ A miss is NOT a quiet Hungarian: it is reported through `onMiss` (the letter feeds the
 * ADR-0456 fallback list, so the §C gate holds the message) and logged loudly. The market gate
 * keeps such a country shut, so a contacted lead never reaches this branch.
 */
export function legalTextForLang(lang: string | null | undefined, hu: string, onMiss?: (hu: string) => void): string {
  const l = (lang ?? "").trim().toLowerCase();
  if (!l || l === HOME_LEGAL_LANG) return hu;
  const k = normUnit(hu);
  for (const f of packFiles().values()) {
    if (f.lang !== l) continue;
    for (const [src, v] of Object.entries(f.entries)) if (v && normUnit(src) === k) return v;
  }
  onMiss?.(hu);
  console.error(`[legal-pack] hiányzó jogi szöveg (${l}): „${hu.slice(0, 60)}…” — Bábelre vár`);
  return hu;
}

/** The country whose pack is in `lang` (first by code) — the outreach `/privacy?l=` link. */
export function legalCountryForLang(lang: string | null | undefined): string | null {
  const l = (lang ?? "").trim().toLowerCase();
  if (!l) return null;
  if (l === HOME_LEGAL_LANG) return HOME_LEGAL_COUNTRY;
  const hit = [...packFiles().values()].filter((f) => f.lang === l).map((f) => f.country).sort()[0];
  return hit ?? null;
}

// ── HTML PAGES ───────────────────────────────────────────────────────────────

/** Block elements whose inner HTML is one translation unit (inline markup stays in the key). */
const UNIT_RE = /<(title|h1|h2|h3|p|li|dt|dd|th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const TRANSLATED_ATTRS = /\b(aria-label|data-label|title|alt|placeholder)="([^"]*)"/g;
const HAS_TRANSLATED_ATTR = /\b(?:aria-label|data-label|title|alt|placeholder)="/;

/** Is there anything to translate in a unit (letters outside tags and placeholders)? */
function hasWords(inner: string): boolean {
  const text = inner.replace(/<[^>]*>/g, " ").replace(/\{\{[a-zA-Z0-9_]+\}\}/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ");
  return /\p{L}{2,}/u.test(text);
}

/** The translation units of a rendered HU page (block inner HTML + translated attributes). */
export function legalHtmlUnits(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(UNIT_RE)) {
    const inner = m[3] ?? "";
    if (hasWords(inner)) out.push(normUnit(inner));
    for (const a of (m[2] ?? "").matchAll(TRANSLATED_ATTRS)) if (hasWords(a[2] ?? "")) out.push(normUnit(a[2] ?? ""));
  }
  // Attributes on elements that are not units themselves (nav, section, details…).
  for (const a of html.replace(UNIT_RE, "").matchAll(TRANSLATED_ATTRS)) {
    if (hasWords(a[2] ?? "")) out.push(normUnit(a[2] ?? ""));
  }
  return out;
}

/**
 * Translate a rendered HU legal page (rendered with LEGAL_PLACEHOLDER values) into `pack`'s
 * language; `values` then fills the placeholders. Throws LegalPackGap on any missing unit —
 * the caller does not publish a half-translated legal page.
 */
export function translateLegalHtml(html: string, pack: LegalPack, values: Readonly<Record<string, string>> = {}): string {
  if (pack.home) return fill(html, values);
  const attr = (s: string) =>
    s.replace(TRANSLATED_ATTRS, (all, name: string, v: string) => (hasWords(v) ? `${name}="${pack.t(normUnit(v))}"` : all));
  let out = html.replace(UNIT_RE, (all, tag: string, attrs: string, inner: string) =>
    hasWords(inner) ? `<${tag}${attr(attrs)}>${pack.t(normUnit(inner))}</${tag}>` : `<${tag}${attr(attrs)}>${inner}</${tag}>`,
  );
  // Attributes of the elements that are not units (nav aria-label…); units were done above.
  out = out.replace(/<(?!(?:title|h1|h2|h3|p|li|dt|dd|th|td)\b)([a-z][a-z0-9-]*)\b([^>]*)>/gi, (all, tag: string, attrs: string) =>
    HAS_TRANSLATED_ATTR.test(attrs) ? `<${tag}${attr(attrs)}>` : all,
  );
  out = out.replace(/<html\b([^>]*)\blang="[^"]*"/i, (_a, pre: string) => `<html${pre}lang="${pack.lang}"`);
  return fill(out, values);
}

function fill(html: string, values: Readonly<Record<string, string>>): string {
  let out = html;
  for (const [k, v] of Object.entries(values)) out = out.replaceAll(LEGAL_PLACEHOLDER(k), v);
  return out;
}

/** Our own legal pages for a non-HU country carry `?c=<CC>` on their cross links. */
export function withCountryLinks(html: string, country: string): string {
  const cc = cc2(country);
  if (cc === HOME_LEGAL_COUNTRY) return html;
  return html.replace(
    /href="\/(impresszum|aszf|elallas|adatfeldolgozas|adatvedelem|privacy)"/g,
    (_a, p: string) => `href="/${p}?c=${cc}"`,
  );
}

/** Which tags/placeholders a translation must keep (Bábel import validation). */
export function legalUnitProblem(hu: string, tr: string): string | null {
  const ph = (s: string) => [...s.matchAll(/\{\{[a-zA-Z0-9_]+\}\}|\{[A-Z_]+\}/g)].map((m) => m[0]).sort().join("|");
  if (ph(hu) !== ph(tr)) return `helyőrző-eltérés: várt ${ph(hu) || "(nincs)"}, kapott ${ph(tr) || "(nincs)"}`;
  const tags = (s: string) => [...s.matchAll(/<\/?([a-z0-9]+)\b[^>]*>/gi)].map((m) => m[0].replace(/\s+/g, " ")).sort().join("|");
  if (tags(hu) !== tags(tr)) return "HTML-jelölés eltér (a <a href>/<b> elemeket változatlanul kell megtartani)";
  if (!tr.trim()) return "üres fordítás";
  return null;
}
