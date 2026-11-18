// ORSZÁG-RÉTEG 3/7 (ADR-0458): the country legal pack seen through the COUNTRY LAYER — the
// pack must be in the country row's `default_lang` (ADR-0437). Kept apart from legalPack.ts so
// that module stays free of the database (the outreach guards import it).
import { countryConfig } from "./country.js";
import { legalPackFor, legalPackStatus, type LegalPack, type LegalPackStatus } from "./legalPack.js";

/** ISO-2 upper case (markets.ts has the same rule; not imported — markets imports this module). */
function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** The completeness of a country's pack in its own language (the gate and the „Országok” lap). */
export async function countryLegalStatus(country: string | null | undefined): Promise<LegalPackStatus> {
  const cc = normalizeCountryCode(country) ?? "";
  const row = cc ? await countryConfig(cc) : null;
  return legalPackStatus(cc, row?.defaultLang ?? null);
}

/** The pack a surface may publish for a country; null = incomplete (do not publish, never HU). */
export async function countryLegalPack(country: string | null | undefined): Promise<LegalPack | null> {
  const cc = normalizeCountryCode(country);
  if (!cc) return null;
  const row = await countryConfig(cc);
  return legalPackFor(cc, row?.defaultLang ?? null);
}
