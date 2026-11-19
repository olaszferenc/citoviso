// ORSZÁG-RÉTEG 3/8 (ADR-XXXX) — writing a country row from the console's „Országok” lap.
//
// The row is validated by the SAME rules the lap checks live (countryRules.ts), then written
// in one statement and the in-process snapshot (country.ts) is re-read, so the next request
// of this server already sees it (other processes pick it up within REFRESH_MS). Nothing else
// is touched: prices live on the Árazás lap, texts are Bábel's, the market approval has its
// own logged action (/settings/markets).
//
// ⛔ The table only grows by rows; columns are never dropped here (migration additive-only).
import { sql } from "kysely";
import { allCountriesSync, refreshCountries } from "./country.js";
import { draftToColumns, validateCountryDraft, type CountryDraft, type CountryErrors } from "./countryRules.js";
import { db } from "./db/client.js";
import { paymentProviderIds } from "./payment/providers.js";
import { loadPricing, pricingRegions } from "./pricing.js";

export interface SaveCountryResult {
  readonly ok: boolean;
  readonly errors: CountryErrors;
}

/** The validation context of the moment: existing codes (new row only), regions, providers. */
export async function countryValidationContext(isNew: boolean): Promise<{
  existing: readonly string[] | null;
  regions: readonly string[];
  providers: readonly string[];
}> {
  await loadPricing();
  await refreshCountries();
  return {
    existing: isNew ? allCountriesSync().map((c) => c.iso2) : null,
    regions: pricingRegions().map((s) => s.region),
    providers: paymentProviderIds(),
  };
}

/**
 * Validate and write a country row. `isNew` = INSERT (refused when the code exists), else
 * UPDATE of that code (refused when it does not). Returns the errors when it refuses — then
 * nothing was written.
 */
export async function saveCountry(draft: CountryDraft, opts: { isNew: boolean; lang: string }): Promise<SaveCountryResult> {
  const ctx = await countryValidationContext(opts.isNew);
  const errors = validateCountryDraft(draft, { lang: opts.lang, ...ctx });
  if (Object.keys(errors).length) return { ok: false, errors };
  const cols = draftToColumns(draft);
  if (opts.isNew) {
    await db
      .insertInto("country")
      .values({ ...cols, updated_at: sql`now()` } as never)
      .execute();
  } else {
    const { iso2: _iso, ...rest } = cols;
    const res = await db
      .updateTable("country")
      .set({ ...rest, updated_at: sql`now()` } as never)
      .where("iso2", "=", draft.iso2)
      .executeTakeFirst();
    if (!Number(res.numUpdatedRows ?? 0)) return { ok: false, errors: { iso2: "—" } };
  }
  await refreshCountries();
  return { ok: true, errors: {} };
}
