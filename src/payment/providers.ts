// PAYMENT PROVIDERS — what each one can charge, as FACTS with their source (ADR-0443).
//
// A country names its provider (country.payment_provider, 0135); the provider decides which
// currencies the country can be charged in. A country whose currency its provider does not
// accept cannot open: the pay-link is refused (requestPayment) and the console's market list
// says why (marketPaymentGaps). There is no "then charge in HUF/EUR instead" — the price IS
// in the country's own currency (owner, 2026-11-12), and converting it would be a different
// price.
//
// Only Barion exists today. A second provider is a NEW ENTRY here + its gateway adapter —
// never a branch in the order path.
//
// ⚠️ SOURCES (verified 2026-11-12):
//   · Barion `Currency`: docs.barion.com/Supported_currencies lists HUF, EUR, CZK, USD with
//     their minimum amounts (HUF 10, EUR 0.1, USD 0.1, CZK 1). The official PHP SDK enum
//     (github.com/barion/barion-web-php library/Enumerations/Currency.php) ALSO lists RON
//     and PLN — the docs page does not. RON/PLN are therefore NOT accepted here until one
//     sandbox Payment/Start in them passes and the shop wallet has an account in that
//     currency (Barion requires one per currency): fail closed on an unverified fact.
//   · Barion `Locale` (UILocale.php in the same SDK): hu-HU, en-US, de-DE, sl-SI, sk-SK,
//     fr-FR, cs-CZ, el-GR, es-ES, hr-HR, ro-RO, pl-PL, it-IT, bg-BG.
import { minorDigits } from "../text/money.js";
import { isTaxableBuyerCountry } from "../billing/taxCounters.js";

export interface ProviderCaps {
  readonly id: string;
  /** Accepted ISO 4217 codes → the provider's minimum amount, in OUR minor unit. */
  readonly currencies: Readonly<Record<string, { readonly minMinor: number }>>;
  /** Pay-page locales, BCP-47 with region, the first is the fallback. */
  readonly locales: readonly string[];
}

const BARION: ProviderCaps = {
  id: "barion",
  currencies: {
    HUF: { minMinor: 10 }, // 10 Ft (HUF has 0 minor digits here)
    EUR: { minMinor: 10 }, // 0.10 €
    USD: { minMinor: 10 }, // 0.10 $
    CZK: { minMinor: 100 }, // 1 Kč
  },
  locales: [
    "en-US", "hu-HU", "de-DE", "sl-SI", "sk-SK", "fr-FR", "cs-CZ", "el-GR", "es-ES", "hr-HR",
    "ro-RO", "pl-PL", "it-IT", "bg-BG",
  ],
};

const PROVIDERS: Readonly<Record<string, ProviderCaps>> = { barion: BARION };

/** The provider's capability row, or null for a name no adapter exists for. */
export function providerCaps(provider: string | null | undefined): ProviderCaps | null {
  return PROVIDERS[String(provider ?? "").trim().toLowerCase()] ?? null;
}

/** Does the provider take payments in this currency? */
export function providerAccepts(provider: string | null | undefined, currency: string | null | undefined): boolean {
  const caps = providerCaps(provider);
  const c = String(currency ?? "").trim().toUpperCase();
  return !!caps && !!caps.currencies[c] && minorDigits(c) !== null;
}

/**
 * Why a country cannot take payments (empty = it can): its provider has no adapter, or the
 * provider does not accept the country's currency. The console's market row and the
 * pay-link gate read this one list.
 */
export function marketPaymentGaps(row: { readonly paymentProvider: string; readonly currency: string }): string[] {
  const caps = providerCaps(row.paymentProvider);
  if (!caps) return [`ismeretlen fizetési szolgáltató: "${row.paymentProvider}"`];
  if (!providerAccepts(row.paymentProvider, row.currency)) {
    return [
      `a(z) ${caps.id} nem fogad ${row.currency} pénznemet (elfogadott: ${Object.keys(caps.currencies).join(", ")}) — a piac nem nyitható`,
    ];
  }
  return [];
}

/**
 * The card-verification amount (ADR-0226/0228) in a currency: the provider's own minimum —
 * the smallest charge it takes, refunded at once. null = the provider does not take it.
 */
export function cardVerifyAmountMinor(provider: string, currency: string): number | null {
  return providerCaps(provider)?.currencies[currency.toUpperCase()]?.minMinor ?? null;
}

/**
 * The pay page's locale from the BUYER's language: the provider locale whose language
 * matches ("ro" → "ro-RO", "cs"/"cz" → "cs-CZ"), else the provider's fallback (en-US).
 */
export function providerLocale(provider: string, lang: string | null | undefined): string {
  const caps = providerCaps(provider) ?? BARION;
  const l = String(lang ?? "").trim().toLowerCase().slice(0, 2).replace(/^cz$/, "cs");
  return caps.locales.find((x) => x.toLowerCase().startsWith(`${l}-`)) ?? caps.locales[0]!;
}

/**
 * ADR-0443: why a market cannot be OPENED (empty = it can, as far as money goes): no country
 * row, the provider cannot charge its currency, or its pricing region cannot price. The
 * console's market row shows this list and the open action refuses on it.
 */
export function marketOpenGaps(
  country: string,
  deps: {
    readonly row: (iso: string) => { readonly paymentProvider: string; readonly currency: string; readonly pricingRegion: string } | null;
    readonly regionGaps: (region: string) => string[];
  },
): string[] {
  // A non-EU buyer is not invoiceable in this round (the accountant has not ruled on it):
  // such a market does not open, so the pay-link gate (ADR-0111) keeps refusing it.
  const nonEu = isTaxableBuyerCountry(country) ? [] : ["nem EU-s ország — a számlázása ebben a körben nem megoldott (ADR-0443)"];
  const row = deps.row(country);
  if (!row) return [...nonEu, "nincs ország-sor (ADR-0437 ③)"];
  return [...nonEu, ...marketPaymentGaps(row), ...deps.regionGaps(row.pricingRegion).map((g) => `ár-régió „${row.pricingRegion}”: ${g}`)];
}
