// ORSZÁG-RÉTEG 3/9 (ADR-0461) — TEST FIXTURE: open the Croatian market in a SCRATCH database.
//
// The HR row itself comes from migration 0142 (real master data). What a scratch run adds here is
// ONLY what the owner will do himself on the console, and only as a TEST AID:
//   · the 'hr' price sheet = today's Hungarian (HUF) sheet converted to EUR at a fixed test rate.
//     ⛔ Owner 2026-11-19: every country prices in its own currency WITHOUT conversion — these
//     numbers are a scratch-only crutch and must never reach the shared dev DB or production;
//   · the 'hr' domain endings (.hr first, + .com/.eu) with the HU fees converted the same way;
//   · the owner's approval (market row) — through the console's own approve action when a test
//     wants to walk it, else here.
// Language and legal packs are NOT faked: Bábel's hr UI seed and HR legal pack are real
// (src/i18n/babel/packs/hr.json, src/i18n/babel/legal/HR.json). ONLY the buyer-side strings
// Bábel has not translated yet get a visible MARKER („‹hr› …”, scripts/lib/country-ready-fixture.mts
// — never a translation), so a scratch run can open the market; the e2e lists which ones.
//
// ⛔ Refuses to run against anything that is not a scratch database (the shared dev DB is
// citoviso_dev; scratch names carry a "_<worktree>_<pid>" suffix — scripts/lib/scratch-db.mts).

/** Test-only HUF→EUR rate (≈ MNB mid-rate, autumn 2026). A crutch for a scratch run, not a price. */
export const TEST_HUF_PER_EUR = 390;

/** HUF (0 decimals) → EUR minor units (cents) at the test rate. */
export const hufToEurCents = (huf: number): number => Math.round((huf * 100) / TEST_HUF_PER_EUR);

/** The database this process will write to — must be a scratch one. */
export function assertScratchDb(): string {
  const name = process.env.PGDATABASE ?? "";
  if (process.env.DATABASE_URL) throw new Error("hr-open-fixture: DATABASE_URL be van állítva — csak scratch DB-n fut");
  if (!/^citoviso_[a-z0-9_]+_[a-z0-9]+_\d+$/.test(name) || name === "citoviso_dev") {
    throw new Error(`hr-open-fixture: „${name}” nem scratch adatbázis — a HR teszt-ár CSAK scratch DB-be kerülhet`);
  }
  return name;
}

/** Fill the 'hr' region with the converted HU sheet (base, modules, domain terms, endings). */
export async function seedHrTestPrices(): Promise<{ base: number; modules: number }> {
  assertScratchDb();
  const pricing = await import("../../src/pricing.ts");
  const { MODULE_CATALOG, MULTILANG_TIERS } = await import("../../src/modules.ts");
  await pricing.loadPricing(true);
  // 3/10: since migration 0149 the 'hr' layer is REAL (the owner's one-time euro copy of the live HU
  // packages, .com) — a migrated scratch DB already carries it, and the fixture never overwrites it.
  const hrNow = pricing.pricingRegions().find((s) => s.region === "hr");
  if (hrNow && hrNow.baseMonthly > 0) return { base: hrNow.baseMonthly, modules: hrNow.modulePrices.size };
  const hu = pricing.pricingRegions().find((s) => s.region === "hu");
  if (!hu) throw new Error("hr-open-fixture: nincs 'hu' ár-régió a scratch DB-ben");
  if (!pricing.pricingRegions().some((s) => s.region === "hr")) await pricing.createPricingRegion("hr", "EUR");
  const ids = [
    ...MODULE_CATALOG.filter((m) => !m.spine && !(m as { retired?: boolean }).retired).map((m) => m.id),
    ...MULTILANG_TIERS.map((t) => t.priceId),
  ];
  const modulePrices: Record<string, number> = {};
  for (const id of ids) {
    const huf = hu.modulePrices.get(id);
    if (typeof huf === "number") modulePrices[id] = hufToEurCents(huf);
  }
  await pricing.savePricing({
    region: "hr",
    currency: "EUR",
    baseMonthly: hufToEurCents(hu.baseMonthly),
    annualFreeMonths: hu.annualFreeMonths,
    customDomainMonthly: hufToEurCents(hu.customDomainMonthly),
    domainMaxPriceEur: hu.domainMaxPriceEur,
    domainMinCommitmentMonths: hu.domainMinCommitmentMonths,
    domainMinPackageMonthly: hufToEurCents(hu.domainMinPackageMonthly),
    domainBuyoutPrice: hufToEurCents(hu.domainBuyoutPrice),
    domainFreeInPackage: hu.domainFreeInPackage,
    pricingConfirmed: true,
    modulePrices,
  } as never);
  const huTld = pricing.offeredTlds("hu")[0];
  const fee = hufToEurCents(huTld?.monthlyFee ?? 1000);
  const tld = (t: string) => ({
    // 3/10: the purchase cost is in the REGISTRAR's currency (it answers in HUF for every ending,
    // see registrar getYearlyNetPrice), not the market's: an EUR cap made every .hr purchase
    // fail the cost-cap check („currencies differ”) in Elek's HR round.
    tld: t, offered: true, costNet: 1990, costCurrency: "HUF", costMeasuredAt: "2026-11-19T00:00:00.000Z",
    maxCost: 9000, monthlyFee: fee, freeInPackage: huTld?.freeInPackage ?? false,
  });
  await pricing.saveDomainTlds("hr", [tld(".hr"), tld(".com"), tld(".eu")]);
  await pricing.loadPricing(true);
  return { base: hufToEurCents(hu.baseMonthly), modules: Object.keys(modulePrices).length };
}

/** Buyer-side hr strings Bábel has not translated yet (after the seed). */
export async function missingHrStrings(): Promise<string[]> {
  const { missingBuyerPackStrings } = await import("../../src/i18n/packs.ts");
  return missingBuyerPackStrings("hr", { withSeed: true });
}

/** Fill ONLY the untranslated buyer-side hr strings with a marker (scratch only). Returns them. */
export async function markMissingHrStrings(): Promise<string[]> {
  assertScratchDb();
  const packs = await import("../../src/i18n/packs.ts");
  await packs.ensureLanguagePack("hr");
  const missing = await missingHrStrings();
  if (missing.length) await (await import("./country-ready-fixture.mts")).makeCountryReady("HR", "hr");
  return missing;
}

/** The owner's approval of HR (market row) — scratch only. */
export async function approveHr(): Promise<void> {
  assertScratchDb();
  const { db } = await import("../../src/db/client.ts");
  await db.insertInto("market").values({ country: "HR", legal_status: "approved", approved_by: "e2e" } as never)
    .onConflict((oc) => oc.column("country").doUpdateSet({ legal_status: "approved" } as never)).execute();
}
