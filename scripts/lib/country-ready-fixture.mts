// ORSZÁG-RÉTEG 3/8 (ADR-XXXX) — TEST FIXTURE: make a synthetic country READY for the market gate
// (src/countryReadiness.ts) in a SCRATCH database, so a test that opens a foreign market keeps
// measuring what it always measured. ⛔ NOT a translation and never the API: the language pack
// gets MARKER strings (‹lang› + the Hungarian with its vowels broken) for the buyer-side strings
// the pack does not have yet — existing entries (a test's own fixture, Bábel's seed) are kept,
// so a test that deliberately leaves a gap still sees its gap. Holidays: one every-year day when
// the row has none (the readiness needs this year and the next covered).
//
// Use ONLY on a scratch DB (it writes language_pack and the country row).
import { sql } from "kysely";

/** Make `iso` (pack language `lang`) ready: holidays + a complete buyer-side pack. */
export async function makeCountryReady(iso: string, lang: string): Promise<void> {
  const { db } = await import("../../src/db/client.ts");
  const { refreshCountries } = await import("../../src/country.ts");
  const packs = await import("../../src/i18n/packs.ts");
  await sql`update country set public_holidays = '["01-01"]'::jsonb
            where iso2 = ${iso} and jsonb_array_length(public_holidays) = 0`.execute(db);
  await refreshCountries();
  const scope = await packs.buyerCatalog();
  const have = (await packs.loadPack(lang)) ?? {};
  const merged: Record<string, string> = { ...have };
  for (const hu of scope) merged[hu] ??= `‹${lang}› ${hu.replace(/[aáeéiíoóöőuúüű]/gi, "·")}`;
  await db
    .insertInto("language_pack")
    .values({ lang, strings: JSON.stringify(merged), status: "generated" } as never)
    .onConflict((oc) => oc.column("lang").doUpdateSet({ strings: JSON.stringify(merged) } as never))
    .execute();
  packs.installPack(lang, merged);
}

/**
 * Complete a pricing region's sheet (scratch DB): a base fee and every required module price
 * that is still missing (fixture values; existing prices are kept). Reloads the price snapshot.
 */
export async function completePriceSheet(region: string, base = 990, modulePrice = 100): Promise<void> {
  const { db } = await import("../../src/db/client.ts");
  const pricing = await import("../../src/pricing.ts");
  const { MODULE_CATALOG, MULTILANG_TIERS } = await import("../../src/modules.ts");
  await sql`update pricing_config set base_monthly = ${base} where region = ${region} and base_monthly <= 0`.execute(db);
  const ids = new Set([
    ...MODULE_CATALOG.filter((m) => !m.spine && !(m as { retired?: boolean }).retired).map((m) => m.id),
    ...MULTILANG_TIERS.map((t) => t.priceId),
  ]);
  for (const id of ids) {
    await db.insertInto("module_price_region").values({ region, module_id: id, price_monthly: modulePrice } as never)
      .onConflict((oc) => oc.columns(["region", "module_id"]).doNothing()).execute();
  }
  await pricing.loadPricing(true);
}
