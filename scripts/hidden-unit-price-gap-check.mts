// Guard: a unit the guest never sees gets no "nincs ára" (ADR-0256 ③, owner ruling 2026-09-28).
//
// ADR-0256 hides the whole-place unit from the guest when it is not let as one
// (`represents_whole AND NOT is_whole_property`, `guestUnits`). Nobody can book it, so asking
// the owner to price it — on the Árak card, as an Áttekintés to-do, in the weekly reminder —
// would be a false alarm about a room that does not exist for anyone. All three readers must
// ask the SAME rule the guest page filters by.
//
// Pure (no DB): the shared dev DB has no hidden unit today and may not be written to, so the
// rule is measured on its DB-free core (`priceGapsOf` — the reminder AND the to-do read it) and
// on the rendered Árak card (`moduleSettingsSection`), each with a positive control.
// Run: npx tsx scripts/hidden-unit-price-gap-check.mts [--self-test]
//   --self-test hands the card no `guestHidden` (the pre-ADR-0256 state) → must go RED.

import { priceGapsOf } from "../src/tenant/priceGap.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const ok = (c: boolean, m: string, d = ""): void => {
  console.log(`${c ? "✓" : "✗"} ${m}${d && !c ? `\n   ↳ ${d}` : ""}`);
  if (!c) failed++;
};
const TODAY = "2026-10-01";
const base = (id: string, amount: number) => [{ id: `p-${id}`, label: "Alapár", from: null, to: null, amount, isBase: true }];
const unit = (id: string, name: string, representsWhole: boolean, isWholeProperty: boolean) => ({
  id, name, seasonalOnly: false, priceOnRequest: false, representsWhole, isWholeProperty,
});

// ① the rule on the mail / to-do path
{
  const hiddenWhole = unit("u0", "A szállás egésze", true, false);
  const roomNoPrice = unit("u1", "Kisházi szoba", false, false);
  const roomPriced = unit("u2", "Nádas apartman", false, false);
  const prices = new Map([["u2", base("u2", 24000)]]) as never;
  const gaps = priceGapsOf([hiddenWhole, roomNoPrice, roomPriced], prices, TODAY).map((g) => g.unitId);
  ok(!gaps.includes("u0"), "① a vendég elől rejtett egész szállás NEM kér árat (teendő, emlékeztető)", gaps.join(","));
  ok(gaps.includes("u1"), "① kontroll: a látható, ár nélküli szoba igen", gaps.join(","));
  ok(!gaps.includes("u2"), "① kontroll: az árazott szoba nem");

  const letWhole = unit("u0", "A szállás egésze", true, true);
  const g2 = priceGapsOf([letWhole, roomPriced], prices, TODAY).map((g) => g.unitId);
  ok(g2.includes("u0"), "① egyben KIADOTT egész szállás ár nélkül → kér árat", g2.join(","));

  const g3 = priceGapsOf([hiddenWhole], new Map() as never, TODAY).map((g) => g.unitId);
  ok(g3.includes("u0"), "① ha csak a rejtett egység maradt (guestUnits sosem üres) → azt árazni kell", g3.join(","));
}

// ② the Árak card
{
  const u = (id: string, name: string, isWholeProperty: boolean) => ({
    id, name, capacity: 2, description: null, slug: id, amenities: [], photoCount: 0, isWholeProperty,
    seasonalOnly: false, priceOnRequest: false,
  });
  const html = moduleSettingsSection("pricing", {
    canRestore: true,
    priceMonthly: 490,
    values: effectiveModuleConfig("pricing", null, null),
    pricing: {
      units: [u("u0", "A szállás egésze", false), u("u1", "Kisházi szoba", false)],
      prices: { u0: [], u1: [] },
      currency: "HUF",
      bookingActive: false,
      roomsActive: true,
      status: { u0: "none", u1: "none" },
      today: TODAY,
      siteView: null,
      ...(SELF_TEST ? {} : { guestHidden: ["u0"] }),
    },
  } as never);
  const card = (id: string): string => {
    const i = html.indexOf(`id="ar-${id}"`);
    const j = html.indexOf('id="ar-', i + 1);
    return i < 0 ? "" : html.slice(i, j < 0 ? undefined : j);
  };
  ok(card("u0") !== "" && card("u1") !== "", "② mindkét kártya renderelt");
  ok(!/data-price-state="none"/.test(card("u0")), "② a rejtett egység kártyáján NINCS „Nincs ára.” sor");
  ok(/data-price-state="none"/.test(card("u1")), "② kontroll: a látható, ár nélküli szobán ott van");
}

if (failed) {
  console.error(`\n⛔ hidden-unit-price-gap-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ hidden-unit-price-gap-check: a vendég elől rejtett egységért nem kérünk árat (ADR-0256 ③).");
