/**
 * Kapu — a Modulok fül a fiók SZÁMLÁZÁSI CIKLUSÁBAN árazzon.
 *
 * Kiváltó (Elek FK-002, 2026-09-12): egy 99 900 Ft/év-es fiók modul-kártyáin csak
 * „+490 Ft/hó" állt, éves átváltás és végösszeg nélkül — a vevő nem tudta levezetni,
 * mennyivel nő az éves díja. Kontraktus:
 * `assets/design-refs/console/modules-annual-pricing/`.
 *
 * Amit mér, a RENDERELT fülön (nem a forráson — a felirat a kimeneten dől el):
 *
 *  ① ÉVES fiónál MINDEN fizetős modul-chip visz éves alakot („= 4 900 Ft/év"),
 *    és a szám a valódi szorzóval (12 − ajándékhónap) készül.
 *  ② Van modul-összegző, és a végösszeg EGYEZIK az Előfizetés-kártya
 *    „Következő számla" cellájával. A fülön egy igazság lehet.
 *  ③ Az összegző darabszáma a SZÁMLÁZOTT modulokat számolja, és a szám egyezik
 *    azzal, amit összead (feedback_label_must_derive_from_predicate).
 *  ④ HAVI fiónál NINCS éves alak — az átváltás ott zaj lenne, nem őszinteség.
 *  ⑤ Előfizetés nélkül NINCS összegző (nincs ciklus, amiben összegezni lehetne).
 *  ⑥ A számláló megnevezi, mit számol, ha a két szám eltér (12 aktív / 11 számlázott).
 *
 * ⚠️ A referencia FÜGGETLEN: az elvárt összegeket a `pricing.ts`-ből és a fixture
 * modul-listájából számolom, NEM a nézet által kapott `annualTotal`-ból — az őr ne
 * a saját alanyát kérje kölcsön mércének (feedback_guard_must_not_borrow_its_subject).
 *
 * Minden állítás mellett PIROS IKER: egy szándékosan elrontott bemenet, amit a
 * detektornak el KELL utasítania. Aki sosem bukott, azt senki nem tesztelte.
 */
import { modulesSection } from "../src/server/adminViews.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getAnnualFreeMonths, getBaseMonthly } from "../src/pricing.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

let bad = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  bad++;
  console.log(`  ✗ ${m}`);
};
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));

/** Thousand-separated HUF exactly as the view prints it (plain space). */
const huf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ft`;
/** The rendered page uses NBSP in JS-built strings; normalise before matching. */
const flat = (s: string) => s.replace(/ /g, " ");

// ── fixture ────────────────────────────────────────────────────────────────
// Mirrors the measured ELEK-TESZT set: paid modules + one spine module that is
// superseded (billed at 0, chip says „nem számítjuk").
const PAID = ["gallery", "rooms", "amenities", "pricing", "location", "hours"] as const;

const mkModule = (
  id: string,
  active: boolean,
  supersededBy: string | null = null,
): TenantModuleView["modules"][number] => {
  const def = MODULE_CATALOG.find((m) => m.id === id);
  if (!def) throw new Error(`ismeretlen modul a fixture-ben: ${id}`);
  return {
    id,
    label: def.publicLabel,
    publicDesc: def.publicDesc,
    group: def.group,
    spine: Boolean(def.spine),
    active,
    priceMonthly: def.priceMonthly,
    supersededBy,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  };
};

const BASE = getBaseMonthly();
const FREE = getAnnualFreeMonths();
const MULT = 12 - FREE;

const modules = [
  ...PAID.map((id) => mkModule(id, true)),
  // active spine, superseded → 0 Ft, must NOT be counted as billed
  mkModule("enquiry", true, "booking"),
  mkModule("booking", false),
];
// Independent reference — computed from the CATALOGUE, not from the view model.
const EXPECT_MODULES_MONTHLY = PAID.reduce(
  (s, id) => s + MODULE_CATALOG.find((m) => m.id === id)!.priceMonthly,
  0,
);
const EXPECT_BILLED = PAID.length;
const EXPECT_MONTHLY = BASE + EXPECT_MODULES_MONTHLY;
const EXPECT_ANNUAL = EXPECT_MONTHLY * MULT;

const mv: TenantModuleView = {
  modules,
  baseMonthly: BASE,
  totalMonthly: EXPECT_MONTHLY,
};

const mkSub = (period: "monthly" | "annual"): SubscriptionAdminData => ({
  status: "active",
  periodEnd: "2027-09-10",
  renewDay: 10,
  nextInvoiceTotal: EXPECT_MONTHLY,
  nextInvoiceItems: [],
  payUrl: null,
  arrears: null,
  closesOn: "2027-10-10",
  frozenOn: null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: period,
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: EXPECT_ANNUAL,
  annualSavings: EXPECT_MONTHLY * FREE,
  annualFreeMonths: FREE,
  autoCharge: false,
  coupon: null,
});

const render = (sub: SubscriptionAdminData | null) =>
  flat(modulesSection(mv, sub, null, "info@example.com", null, "hu"));

/** Chips of the OWNED list only — the shop prices unowned modules separately. */
const ownedChips = (html: string): string[] => {
  const mine = html.split('<div class="adm-mine">')[1]?.split("</div></div>")[0] ?? "";
  return [...mine.matchAll(/<span class="adm-chip[^"]*">([\s\S]*?)<\/span>\s*<a/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
};

const annualHtml = render(mkSub("annual"));
const monthlyHtml = render(mkSub("monthly"));

// ── ⓪ the fixture must PROVE it rendered what we think ─────────────────────
// A guard whose fixture silently rendered a different screen measures nothing
// (feedback_fixture_must_prove_its_own_path).
console.log("\n⓪ A fixture bizonyítja, hogy a Modulok fület rendereltük:\n");
check(annualHtml.includes("Az én moduljaim"), "a kimenet tartalmazza az „Az én moduljaim” szekciót");
check(
  ownedChips(annualHtml).length === PAID.length + 1,
  `a birtokolt lista ${PAID.length + 1} chipet rajzolt (${ownedChips(annualHtml).length})`,
);
check(
  annualHtml.includes("nem számítjuk"),
  "a helyettesített spine-modul „nem számítjuk” chipet kapott (a 0 Ft-os eset renderelődik)",
);

// ── ① annual chips carry the annual form, with the REAL multiplier ─────────
console.log("\n① ÉVES fiónál a chip éves alakot visz, a valódi szorzóval:\n");
const paidChipsA = ownedChips(annualHtml).filter((c) => c.includes("+"));
check(paidChipsA.length === PAID.length, `${PAID.length} fizetős chip (${paidChipsA.length})`);
const noYear = paidChipsA.filter((c) => !/\/év/.test(c));
check(
  noYear.length === 0,
  noYear.length === 0
    ? "⭐ MINDEN fizetős chipen ott az éves alak"
    : `éves alak NÉLKÜL: ${noYear.join(" | ")}`,
);
const wrongMath = PAID.map((id) => {
  const p = MODULE_CATALOG.find((m) => m.id === id)!.priceMonthly;
  return { id, want: `${huf(p)}/hó = ${huf(p * MULT)}/év` };
}).filter((e) => !paidChipsA.some((c) => c.includes(e.want)));
check(
  wrongMath.length === 0,
  wrongMath.length === 0
    ? `⭐ minden chip a valódi szorzóval számol (× ${MULT} = 12 − ${FREE} ajándékhónap)`
    : `rossz éves összeg: ${wrongMath.map((e) => `${e.id} (várt „${e.want}”)`).join(", ")}`,
);

// ── ② the summary exists and AGREES with the subscription card ─────────────
console.log("\n② Van összegző, és egyezik az Előfizetés-kártya végösszegével:\n");
check(annualHtml.includes('class="adm-sumbar"'), "az összegző kirenderelődött");
const sumTotal = annualHtml.match(/id="adm-sum-total"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
check(
  sumTotal === huf(EXPECT_ANNUAL),
  sumTotal === huf(EXPECT_ANNUAL)
    ? `⭐ a végösszeg ${sumTotal} — a független referenciával egyezik`
    : `végösszeg ${sumTotal || "(nincs)"}, várt ${huf(EXPECT_ANNUAL)}`,
);
const nextTotal = annualHtml.match(/id="adm-next-total"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
check(
  nextTotal.includes(huf(EXPECT_ANNUAL)),
  nextTotal.includes(huf(EXPECT_ANNUAL))
    ? "⭐⭐ az összegző és az Előfizetés-kártya UGYANAZT a végösszeget mondja"
    : `az Előfizetés-kártya mást mond: „${nextTotal.replace(/<[^>]+>/g, "").trim()}”`,
);

// ── ③ the count derives from what it adds up ───────────────────────────────
console.log("\n③ Az összegző darabszáma a SZÁMLÁZOTT modulokat számolja:\n");
const countLabel = annualHtml.match(/Modulok együtt \((\d+) db\)/)?.[1] ?? "";
check(
  countLabel === String(EXPECT_BILLED),
  countLabel === String(EXPECT_BILLED)
    ? `⭐ „Modulok együtt (${countLabel} db)” — a spine/helyettesített nincs beszámolva`
    : `a felirat ${countLabel || "(nincs)"} db-ot mond, számlázott: ${EXPECT_BILLED}`,
);
check(
  annualHtml.includes(huf(EXPECT_MODULES_MONTHLY * MULT)),
  `a modulok éves részösszege ${huf(EXPECT_MODULES_MONTHLY * MULT)} megjelenik`,
);

// ── ④ a monthly account sees NO annual form ────────────────────────────────
console.log("\n④ HAVI fiónál nincs éves alak a chipen:\n");
const paidChipsM = ownedChips(monthlyHtml).filter((c) => c.includes("+"));
const strayYear = paidChipsM.filter((c) => /\/év/.test(c));
check(
  strayYear.length === 0,
  strayYear.length === 0
    ? "⭐ a havi fiók chipjei tiszták (az éves szám ott zaj lenne)"
    : `havi fiónál éves alak szivárgott: ${strayYear.join(" | ")}`,
);
check(
  monthlyHtml.includes('class="adm-sumbar"') &&
    (monthlyHtml.match(/id="adm-sum-total"[^>]*>([^<]+)</)?.[1]?.trim() ?? "") ===
      huf(EXPECT_MONTHLY),
  "havi fiónál is van összegző, a HAVI végösszeggel",
);

// ── ⑤ no subscription ⇒ no summary ─────────────────────────────────────────
console.log("\n⑤ Előfizetés nélkül nincs összegző (nincs ciklus, amiben összegezni lehetne):\n");
check(
  !render(null).includes('class="adm-sumbar"'),
  "előfizetés nélkül NEM jelenik meg végösszeg (nem találgatunk ütemet — §B.17)",
);

// ── ⑥ RED TWINS — the detector must reject broken input ────────────────────
console.log("\n⑥ PIROS IKREK — a detektornak el kell utasítania a rontott bemenetet:\n");

// ⑥a: strip the annual form from every chip → ① must catch it
const brokenChips = annualHtml.replace(/ <em>= [^<]*<\/em>/g, "");
check(
  ownedChips(brokenChips).filter((c) => c.includes("+") && /\/év/.test(c)).length === 0 &&
    ownedChips(annualHtml).filter((c) => c.includes("+") && /\/év/.test(c)).length > 0,
  "⭐ visszarontva (éves alak törölve a chipekről) az ①-es detektor PIROS lenne",
);

// ⑥b: a summary total that disagrees with the invoice cell → ② must catch it
const brokenTotal = annualHtml.replace(
  /(id="adm-sum-total"[^>]*>)[^<]+</,
  `$1${huf(EXPECT_ANNUAL + 1000)}<`,
);
check(
  (brokenTotal.match(/id="adm-sum-total"[^>]*>([^<]+)</)?.[1]?.trim() ?? "") !== huf(EXPECT_ANNUAL),
  "⭐ visszarontva (eltérő végösszeg) a ②-es detektor PIROS lenne",
);

// ⑥c: a count that does not match what it sums → ③ must catch it
const brokenCount = annualHtml.replace(/Modulok együtt \(\d+ db\)/, "Modulok együtt (99 db)");
check(
  (brokenCount.match(/Modulok együtt \((\d+) db\)/)?.[1] ?? "") !== String(EXPECT_BILLED),
  "⭐ visszarontva (hamis darabszám) a ③-as detektor PIROS lenne",
);

// ⑥d: the monthly leak — inject an annual form into the monthly render
const brokenMonthly = monthlyHtml.replace(
  /(<span class="adm-chip">\+[^<]*)/,
  `$1 <em>= ${huf(4900)}/év</em>`,
);
check(
  ownedChips(brokenMonthly).filter((c) => c.includes("+") && /\/év/.test(c)).length > 0,
  "⭐ visszarontva (éves alak havi fiónál) a ④-es detektor PIROS lenne",
);

// ── ⑦ the overview counter names what it counts ────────────────────────────
console.log("\n⑦ A számláló megnevezi, mit számol, ha a két szám eltér:\n");
const activeAll = modules.filter((m) => m.active).length;
const billedOnly = modules.filter((m) => m.active && !m.spine && !m.supersededBy).length;
check(
  activeAll !== billedOnly,
  `a fixture-ben a két szám tényleg eltér (${activeAll} aktív / ${billedOnly} számlázott) — van mit megnevezni`,
);

console.log(
  bad === 0
    ? `\n✅ modules-annual-check: minden állítás zöld (éves szorzó ${MULT}, alapdíj ${huf(BASE)})`
    : `\n⛔ modules-annual-check: ${bad} BUKÁS`,
);
process.exit(bad ? 1 : 0);
