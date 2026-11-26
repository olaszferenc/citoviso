// „Országok / Árazás” 2. fázis (0157; terv assets/design-refs/console/orszagok-arazas/ README ③ ⑤–⑧): a country's
// LIFECYCLE and the picker's machine work.
//   · pick — a new country from the world catalog: its own pricing region in its official currency with a
//     SUGGESTED starting price sheet (the „global” EUR sheet at today's MNB rate, rounded to a price ending),
//     UNCONFIRMED (pricing_confirmed = false — the readiness stays red until the owner confirms it);
//   · launch („Indulás”) — launched_at + the market approved WITHOUT completeness (ADR-0460 ② amended: the
//     approval is the launch; the SEND asks for completeness — the market gate is approved && complete);
//     the opening automaton (regions, tiles, discovery — cit9d514f15) starts from the approved market;
//   · pause („Szünetel”) / resume („Folytatás”) — paused_at closes the market gate (countryReadiness); the
//     renewals of running subscriptions go on (ADR-0111). The home market cannot be paused.
// Status (computed, never a column): Felvéve → Indulás → Fut, or Szünetel.
import { allCountriesSync, countryConfig, refreshCountries, type CountryConfig } from "./country.js";
import { catalogCountry } from "./countryCatalog.js";
import { db } from "./db/client.js";
import { approveMarket, HOME_MARKET } from "./markets.js";
import { mnbRate } from "./billing/fxRate.js";
import { createPricingRegion, hasPricingRegion, loadPricing, pricingSnapshot, savePricing } from "./pricing.js";
import { minorDigits } from "./text/money.js";

export type LifecycleStatus = "added" | "launching" | "running" | "paused";

/** The computed status: Szünetel → paused; no Indulás → added; else running when the gate is open. */
export function lifecycleStatus(cfg: Pick<CountryConfig, "launchedAt" | "pausedAt">, gateOpen: boolean): LifecycleStatus {
  if (cfg.pausedAt) return "paused";
  if (!cfg.launchedAt) return "added";
  return gateOpen ? "running" : "launching";
}

/** A price in major units rounded to a price ending: 9.90-style with minor digits, ...90 without. */
function priceEnding(major: number, digits: number): number {
  if (major <= 0) return 0;
  if (digits > 0) return Math.max(0.9, Math.ceil(major) - 0.1);
  return Math.max(90, Math.ceil(major / 100) * 100 - 10);
}

/**
 * The picker's machine work: the country's own pricing region (lower-case ISO) in its official currency, with
 * the suggested starting sheet. Idempotent: an existing region is left as it is. Returns a note for the operator.
 */
export async function ensureCountryRegion(iso: string, today: string): Promise<{ region: string; created: boolean; suggested: boolean; note: string }> {
  const c = catalogCountry(iso);
  const region = iso.trim().toLowerCase();
  if (!c) return { region, created: false, suggested: false, note: "a katalógus nem ismeri az országot" }; // i18n-exempt: operátori napló
  await loadPricing(true);
  if (hasPricingRegion(region)) return { region, created: false, suggested: false, note: "az ár-régió már megvolt" }; // i18n-exempt: operátori napló
  if (minorDigits(c.currency) === null) return { region, created: false, suggested: false, note: `a pénznem (${c.currency}) nem ISO 4217 — ár-régió nem jött létre` }; // i18n-exempt: operátori napló
  await createPricingRegion(region, c.currency);
  // The suggestion: the „global” EUR sheet converted at today's MNB rate (EUR→HUF→target), price-ended.
  if (!hasPricingRegion("global")) return { region, created: true, suggested: false, note: "nincs globális ársor a javaslathoz" }; // i18n-exempt: operátori napló
  const g = pricingSnapshot("global");
  const eur = await mnbRate("EUR", today);
  const tgt = await mnbRate(c.currency, today);
  if (!eur || !tgt) return { region, created: true, suggested: false, note: `az MNB-árfolyam (${c.currency}) nem érhető el — az árakat kézzel kell megadni` }; // i18n-exempt: operátori napló
  const gDigits = minorDigits(g.currency) ?? 2;
  const tDigits = minorDigits(c.currency) ?? 0;
  const factor = g.currency === "EUR" ? eur.rate / tgt.rate : 1;
  const conv = (minor: number): number => {
    const major = (minor / 10 ** gDigits) * factor;
    return Math.round(priceEnding(major, tDigits) * 10 ** tDigits);
  };
  const s = pricingSnapshot(region);
  await savePricing({
    region,
    currency: c.currency,
    baseMonthly: conv(g.baseMonthly),
    annualFreeMonths: g.annualFreeMonths,
    customDomainMonthly: conv(g.customDomainMonthly),
    domainMaxPriceEur: g.domainMaxPriceEur,
    domainMinCommitmentMonths: g.domainMinCommitmentMonths,
    domainMinPackageMonthly: conv(g.domainMinPackageMonthly),
    domainBuyoutPrice: conv(g.domainBuyoutPrice),
    pricingConfirmed: false, // a suggestion — the owner confirms it on the „Árazás” tab
    domainFreeInPackage: s.domainFreeInPackage,
    modulePrices: Object.fromEntries([...g.modulePrices].map(([id, v]) => [id, conv(v)])),
  });
  return { region, created: true, suggested: true, note: `kezdő ársor javasolva (globális EUR × MNB ${eur.date}), jóváhagyatlan` }; // i18n-exempt: operátori napló
}

/** „Indulás”: launched_at + the market approved without completeness. */
export async function launchCountry(iso: string, actor: string): Promise<boolean> {
  const cfg = await countryConfig(iso);
  if (!cfg) return false;
  await db.updateTable("country").set({ launched_at: cfg.launchedAt ?? new Date(), paused_at: null, paused_by: null }).where("iso2", "=", cfg.iso2).execute();
  const ok = await approveMarket({ country: cfg.iso2, actor, reason: "Indulás (Országok / Árazás)" });
  await refreshCountries();
  return ok;
}

/** „Szünetel”: the gate shuts (the home market never). */
export async function pauseCountry(iso: string, actor: string): Promise<boolean> {
  const cfg = await countryConfig(iso);
  if (!cfg || cfg.iso2 === HOME_MARKET) return false;
  await db.updateTable("country").set({ paused_at: new Date(), paused_by: actor }).where("iso2", "=", cfg.iso2).execute();
  await db.insertInto("market_log").values({ country: cfg.iso2, action: "pause", actor, reason: "Szünetel (Országok / Árazás)" }).execute();
  await refreshCountries();
  return true;
}

/** „Folytatás”: the pause is lifted (the gate opens again when approved && complete). */
export async function resumeCountry(iso: string, actor: string): Promise<boolean> {
  const cfg = await countryConfig(iso);
  if (!cfg || !cfg.pausedAt) return false;
  await db.updateTable("country").set({ paused_at: null, paused_by: null }).where("iso2", "=", cfg.iso2).execute();
  await db.insertInto("market_log").values({ country: cfg.iso2, action: "resume", actor, reason: "Folytatás (Országok / Árazás)" }).execute();
  await refreshCountries();
  return true;
}

/** Every country of the catalog not yet a row — the picker greys the rest. */
export function alreadyAdded(): ReadonlySet<string> {
  return new Set(allCountriesSync().map((c) => c.iso2));
}
