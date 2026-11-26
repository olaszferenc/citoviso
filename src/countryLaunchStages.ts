// „Országok / Árazás” 3. fázis (terv assets/design-refs/console/orszagok-arazas/ README ⑧): the launch list's
// DETAIL that does not gate the market — beside countryReadiness (the closing items stay ITS; no second
// completeness logic — country-layer-check ⑫):
//   · Bábel broken down: Felület (buyer-side UI strings), Levelek (letter + outreach strings), Jogi csomag
//     (the legal pack's units), Súgó (the tenant help entries) — count, percent;
//   · Kontakt: leads with an e-mail / with a phone;
//   · Mock: leads with a mock / with a mock the quality colleague passed (the gate before the owner);
//   · Kiküldés: the market gate's first reason while it is shut.
// Read-only. The region / tile / walk / lead numbers are marketLaunchStatus (src/scout/discoveryAreas.ts).
import { readFile } from "node:fs/promises";
import { sql } from "kysely";
import { countryConfig } from "./country.js";
import { db } from "./db/client.js";
import { LEAD_COUNTRY_SQL } from "./db/leadCountrySql.js";
import { DEFAULT_LANG } from "./i18n/lang.js";
import { kbCoverage } from "./i18n/kbPacks.js";
import { buyerCatalog, missingBuyerPackStrings } from "./i18n/packs.js";
import { legalPackStatus } from "./legalPack.js";
import { marketGate } from "./markets.js";
import { MOCK_QA_PASSED_SQL } from "./outreach/mockQaReview.js";

export interface PartCount {
  readonly total: number;
  readonly done: number;
}

export interface LaunchStages {
  readonly iso: string;
  readonly lang: string | null;
  readonly babel: { readonly ui: PartCount; readonly mail: PartCount; readonly legal: PartCount; readonly kb: PartCount };
  readonly contact: { readonly email: number; readonly phone: number };
  readonly mock: { readonly made: number; readonly passed: number };
  /** The market gate's first reason while it is shut (null = open). */
  readonly sendReason: string | null;
}

let contextCache: Record<string, string> | null = null;
async function catalogContext(): Promise<Record<string, string>> {
  if (contextCache) return contextCache;
  try {
    contextCache = JSON.parse(await readFile(new URL("./i18n/catalog-context.json", import.meta.url), "utf8")) as Record<string, string>;
  } catch {
    contextCache = {};
  }
  return contextCache;
}

/** A string the letters / the outreach carry (catalog-context: „level” or „megkereses”). */
const isMail = (ctx: string | undefined): boolean => !!ctx && /(^|\+)(level|megkereses)(\+|$)/.test(ctx);

export async function countryLaunchStages(iso: string): Promise<LaunchStages> {
  const cc = iso.trim().toUpperCase();
  const cfg = await countryConfig(cc);
  const lang = cfg?.defaultLang ?? null;
  const scope = await buyerCatalog();
  const ctx = await catalogContext();
  const missing = new Set(lang ? await missingBuyerPackStrings(lang, { withSeed: true }) : scope);
  const mailScope = scope.filter((s) => isMail(ctx[s]));
  const uiScope = scope.filter((s) => !isMail(ctx[s]));
  const part = (list: readonly string[]): PartCount => ({ total: list.length, done: list.filter((s) => !missing.has(s)).length });
  const legal = await legalPackStatus(cc, lang);
  const kb = lang ? await kbCoverage(lang) : { total: 0, missing: 0 };
  const counts = await sql<{ email: string; phone: string; made: string; passed: string }>`
    select count(*) filter (where btrim(coalesce(l.raw->>'email','')) <> '') as email,
           count(*) filter (where btrim(coalesce(l.raw->>'phone','')) <> '') as phone,
           count(*) filter (where exists (select 1 from mock_artifact a where a.lead_id = l.id)) as made,
           count(*) filter (where exists (select 1 from mock_artifact a where a.lead_id = l.id and ${MOCK_QA_PASSED_SQL})) as passed
      from lead l where ${LEAD_COUNTRY_SQL} = ${cc}`.execute(db);
  const c = counts.rows[0] ?? { email: "0", phone: "0", made: "0", passed: "0" };
  const gate = await marketGate(cc);
  return {
    iso: cc,
    lang,
    babel: {
      ui: lang === DEFAULT_LANG ? { total: uiScope.length, done: uiScope.length } : part(uiScope),
      mail: lang === DEFAULT_LANG ? { total: mailScope.length, done: mailScope.length } : part(mailScope),
      legal: { total: legal.total, done: legal.total - legal.missing },
      kb: { total: kb.total, done: kb.total - kb.missing },
    },
    contact: { email: Number(c.email), phone: Number(c.phone) },
    mock: { made: Number(c.made), passed: Number(c.passed) },
    sendReason: gate.open ? null : (gate.reasons[0] ?? null),
  };
}
