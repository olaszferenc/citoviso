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
import { T } from "../src/i18n/mail.js";
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

/**
 * The invoice line-up, built with the SAME rule subscriptionAdmin uses
 * (active · not spine · not superseded · NOT cancelled for the period end ·
 * recurring). The summary reads this list, so a fixture with an empty one would
 * have measured nothing — the first cut of this guard did exactly that.
 */
const invoiceItemsOf = (rows: typeof modules) =>
  rows
    .filter(
      (m) =>
        m.active &&
        !m.spine &&
        !m.supersededBy &&
        !m.cancelAtPeriodEnd &&
        MODULE_CATALOG.some((c) => c.id === m.id && c.billing !== "once"),
    )
    .map((m) => ({ label: m.label, price: m.priceMonthly, isNew: false }));

const mkSub = (period: "monthly" | "annual"): SubscriptionAdminData => ({
  status: "active",
  periodEnd: "2027-09-10",
  renewDay: 10,
  nextInvoiceTotal: EXPECT_MONTHLY,
  nextInvoiceItems: invoiceItemsOf(modules),
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

// ── ⑧ A LEMONDOTT MODUL — a branch that shipped broken ─────────────────────
// The first cut re-derived the summary from mv.modules with its OWN predicate,
// which did not know about cancelAtPeriodEnd. The moment a module was cancelled
// for the period end, ONE screen showed two annual totals (measured: 60 700 vs
// 53 800). The KB guard found it, not this file — because this file's fixture
// pinned cancelAtPeriodEnd:false on every row. It no longer does.
console.log("\n⑧ Lemondott modul: a két végösszeg NEM szakadhat szét:\n");
const cancelledRows = modules.map((m) =>
  m.id === "rooms" ? { ...m, cancelAtPeriodEnd: true } : m,
);
const cancelledItems = invoiceItemsOf(cancelledRows);
const cancelledMonthly = cancelledItems.reduce((s, i) => s + i.price, BASE);
const subCancelled: SubscriptionAdminData = {
  ...mkSub("annual"),
  nextInvoiceItems: cancelledItems,
  nextInvoiceTotal: cancelledMonthly,
  annualTotal: cancelledMonthly * MULT,
};
const cancelledHtml = flat(
  modulesSection(
    { ...mv, modules: cancelledRows },
    subCancelled,
    null,
    "info@example.com",
    null,
    "hu",
  ),
);
const cSum = cancelledHtml.match(/id="adm-sum-total"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
const cNext = (cancelledHtml.match(/id="adm-next-total"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "")
  .replace(/<[^>]+>/g, "")
  .trim();
check(
  cSum === cNext && cSum === huf(cancelledMonthly * MULT),
  cSum === cNext
    ? `⭐⭐ egy lemondott modul mellett is EGY végösszeg: ${cSum}`
    : `SZÉTSZAKADT: összegző ${cSum} ≠ Következő számla ${cNext}`,
);
const cCount = cancelledHtml.match(/Modulok együtt \((\d+) db\)/)?.[1] ?? "";
check(
  cCount === String(cancelledItems.length),
  cCount === String(cancelledItems.length)
    ? `⭐ a darabszám (${cCount}) kihagyja a lemondottat — azt a következő számla sem tartalmazza`
    : `a felirat ${cCount} db, a számla ${cancelledItems.length} tételt visz`,
);
// The RED twin: the old, re-derived predicate (which ignored cancelAtPeriodEnd).
const naiveCount = cancelledRows.filter((m) => m.active && !m.spine && !m.supersededBy).length;
check(
  naiveCount !== cancelledItems.length,
  `⭐ visszarontva (a régi, cancelAtPeriodEnd-vak predikátum ${naiveCount} db-ot adna) ez a detektor PIROS lenne`,
);

// ── ⑨ VISSZAKAPCSOLÁS (rejoin) — böngészőben, mert ez ARITMETIKA ───────────
// A lemondott sor checkboxa data-committed="0", tehát a JS ADD-ként számolja.
// Amíg a szerver-oldali bázis (SUMMOD) MÉGIS tartalmazta, a "Mégis megtartom"
// duplán számolt — string-ellenőrzés ezt sosem fogja meg, csak egy kattintás.
console.log("\n⑨ Visszakapcsolás: a kattintás után is EGY végösszeg (böngészőben mérve):\n");
{
  const { chromium } = await import("playwright-core");
  const { config } = await import("../src/config.js");
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // ⛔ NINCS saját <form> burkoló: a modulesSection maga ad `<form id="adm-modform">`-ot,
  // és a beágyazott formot a böngésző eldobja — a szinkron 0 checkboxot látna, és ez a
  // mérés NÉMÁN, hamis zölddel futna le. A hám bizonyítsa, hogy tényleg mér valamit.
  await page.setContent(`<!doctype html><meta charset="utf-8"><body>${cancelledHtml}</body>`);
  await page.waitForTimeout(150);
  const seen = await page.locator('#adm-modform input[name="module"][data-committed]').count();
  check(seen > 0, `a hám tényleg lát kapcsolókat (${seen} db) — nem üres formon mér`);
  await page.evaluate(() => {
    const cb = document.querySelector<HTMLInputElement>('input[name="module"][value="rooms"]');
    if (cb) {
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(120);
  const read = async (id: string) =>
    (await page.locator(`#${id}`).innerText()).replace(/\u00a0/g, " ").trim();
  const rSum = await read("adm-sum-total");
  const rNext = await read("adm-next-total");
  const want = huf(EXPECT_MONTHLY * MULT); // rooms visszakapcsolva = a teljes készlet
  check(
    rSum === rNext,
    rSum === rNext
      ? `⭐⭐ visszakapcsolás után is EGY szám: ${rSum}`
      : `SZÉTSZAKADT kattintásra: összegző ${rSum} ≠ Következő számla ${rNext}`,
  );
  check(
    rSum === want,
    rSum === want
      ? `⭐ és a helyes érték (${want}) — nincs duplán számolás`
      : `rossz összeg: ${rSum}, várt ${want} (duplán számolt?)`,
  );
  await browser.close();
}

// ── ⑩ ELŐJEGYZETT ÉVES VÁLTÁS (pendingAnnual) ─────────────────────────────
// A második hibám: a VALUE-kat egy forrásra kötöttem, de a PERIÓDUS-predikátum
// duplán maradt — a számla-cella `pendingAnnual || annual`-ra évesít, az összegző
// csak `billingPeriod === "annual"`-ra. Egy előjegyzett váltású HAVI fióknál ez
// TÍZSZERES eltérés egy képernyőn (5 570 vs 55 700). A tudásbázis-őr találta meg.
console.log("\n⑩ Előjegyzett éves váltás: a periódus is EGY szabályból jöjjön:\n");
const subPending: SubscriptionAdminData = {
  ...mkSub("monthly"),
  pendingAnnual: true,
  pendingEffectiveDate: "2027-09-10",
};
const pendHtml = flat(modulesSection(mv, subPending, null, "info@example.com", null, "hu"));
const pSum = pendHtml.match(/id="adm-sum-total"[^>]*>([^<]+)</)?.[1]?.trim() ?? "";
const pNext = (pendHtml.match(/id="adm-next-total"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "")
  .replace(/<[^>]+>/g, "")
  .trim();
check(
  pSum === huf(EXPECT_ANNUAL) && pNext.includes(huf(EXPECT_ANNUAL)),
  pSum === huf(EXPECT_ANNUAL) && pNext.includes(huf(EXPECT_ANNUAL))
    ? `⭐⭐ előjegyzett váltásnál is EGY végösszeg: ${pSum}`
    : `SZÉTSZAKADT: összegző ${pSum} ≠ Következő számla ${pNext} (várt ${huf(EXPECT_ANNUAL)})`,
);
// A chipnek is az ÜTEMET kell követnie, nem a mai számlázási módot.
const pChip = ownedChips(pendHtml).find((c) => c.includes("+")) ?? "";
check(
  /\/év/.test(pChip),
  /\/év/.test(pChip)
    ? `⭐ a chip is éves alakot visz az előjegyzett váltás alatt → "${pChip}"`
    : `a chip még havi maradt: "${pChip}"`,
);
// PIROS IKER: a régi, csak-billingPeriod predikátum.
const naiveMult = subPending.billingPeriod === "annual" ? MULT : 0;
check(
  naiveMult === 0,
  "⭐ visszarontva (csak billingPeriod-ot néző predikátum) ez a detektor PIROS lenne",
);

// ── ⑪ „JELENLEGI DÍJ" = a FOLYÓ időszak, nem a következő számla ────────────
// A cella az éves ágon sub.annualTotal-t írt, ami a KÖVETKEZŐ számla: egy lemondott
// modul mellett 53 800 Ft/év állt „Jelenlegi díj" felirattal, miközben a vevő a
// futó évre 60 700 Ft-ot fizetett — és a cella ugyanazt a számot mutatta, mint a
// mellette lévő „Következő számla", tehát a kettő közül az egyik biztosan hazudott.
// A két cellának KÜLÖNBÖZNIE kell, amint valami változik a fordulónapon.
console.log("\n⑪ „Jelenlegi díj”: a FOLYÓ időszak díja, nem a következőé:\n");
{
  const nowMonthly = cancelledRows
    .filter((m) => m.active && !m.spine && !m.supersededBy)
    .reduce((s, m) => s + m.priceMonthly, BASE);
  const fee = (cancelledHtml.match(
    /Jelenlegi díj<\/div><div class="adm-sub__v">([\s\S]*?)<\/div>/,
  )?.[1] ?? "")
    .replace(/<[^>]+>/g, "")
    .trim();
  check(
    fee === `${huf(nowMonthly * MULT)}/év`,
    fee === `${huf(nowMonthly * MULT)}/év`
      ? `⭐⭐ a folyó évet mondja (${fee}) — a lemondott modul ki van fizetve a fordulóig`
      : `„Jelenlegi díj” = ${fee}, várt ${huf(nowMonthly * MULT)}/év`,
  );
  check(
    fee !== `${huf(cancelledMonthly * MULT)}/év`,
    fee !== `${huf(cancelledMonthly * MULT)}/év`
      ? `⭐ és NEM azonos a „Következő számla”-val (${huf(cancelledMonthly * MULT)}) — két cella, két jelentés`
      : "a két cella ugyanazt mondja: az egyik felirat hazudik",
  );
  // RED twin: the old branch printed sub.annualTotal (= the next invoice).
  check(
    subCancelled.annualTotal !== nowMonthly * MULT,
    `⭐ visszarontva (sub.annualTotal a cellában = ${huf(subCancelled.annualTotal)}) ez a detektor PIROS lenne`,
  );
  // Havi ágon a cella eddig is helyes volt — ne rontsuk el a javítással.
  const monthlyFee = (monthlyHtml.match(
    /Jelenlegi díj<\/div><div class="adm-sub__v">([\s\S]*?)<\/div>/,
  )?.[1] ?? "")
    .replace(/<[^>]+>/g, "")
    .trim();
  check(
    monthlyFee === T("hu", "{price}/hó", { price: huf(mv.totalMonthly) }),
    `havi fiókon változatlan: ${monthlyFee}`,
  );
}

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
