/**
 * Kapu — a Modulok fül bevezetője NE küldje a tulajt olyan irányba, amerre a
 * felület nem áll.
 *
 * Kiváltó (Elek FK-002 újramérés, 2026-09-14): a bekezdés első tagmondata azt
 * ígérte, hogy „Ami már az Öné, azt FENT találja" — a renderelt lapon viszont
 * MINDKÉT blokk a bekezdés ALATT van. Böngészővel mérve (mai-modulok-ful.html,
 * ELEK-szerű éves fiók, 12 aktív modul):
 *
 *     390 px:  bekezdés y=643 · „Az én moduljaim" y=915 · kirakat y=4242
 *    1280 px:  bekezdés y=432 · „Az én moduljaim" y=524 · kirakat y=1763
 *
 * A bekezdés FÖLÖTT csak az Előfizetés-kártya van, tehát a mondat egy nem létező
 * helyre mutatott. Egy ilyen mondatot nem lehet „emlékezetből" helyesen tartani:
 * a blokkok sorrendje bármelyik későbbi szálon megfordulhat, és a felirat némán
 * hazuggá válik (feedback_label_must_derive_from_predicate).
 *
 * Amit mér, a RENDERELT kimeneten (nem a forráson):
 *
 *  ⓪ a fixture bizonyítja, hogy tényleg a Modulok fület rendereltük;
 *  ① a tényleges sorrend: bevezető → „Az én moduljaim" → kirakat;
 *  ② az ELSŐ tagmondat (a megvásárolt blokkra mutató rész) ELŐRE mutat
 *    („alább"/„lentebb"/„utána"), és NEM tartalmaz visszafelé mutató irányt
 *    („fent"/„fentebb"/„feljebb"/„a lap tetején");
 *  ③ ugyanez a FAGYASZTOTT ág szövegére is (két külön mondat, két külön hiba-esély).
 *
 * ⚠️ A tiltás SZŰK: csak az első tagmondatra (az első `;`-ig) áll, mert a bekezdés
 * hátralévő része jogosan hivatkozhat felfelé (pl. az Előfizetés-kártyára, ami
 * tényleg fent van). Egy bekezdés-széles szó-feketelista fals pozitív lenne.
 *
 * Minden állítás mellett PIROS IKER: a JAVÍTÁS ELŐTTI, szó szerinti mondaton a
 * detektornak buknia KELL — különben nem ennek a hibának a detektora.
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

// ── fixture: ELEK-szerű, éves ütemű fiók (a mért képernyő) ─────────────────
const ACTIVE = [
  "gallery",
  "rooms",
  "amenities",
  "pricing",
  "location",
  "hours",
  "usp",
  "reviews",
  "poi",
  "booking",
  "newsletter",
] as const;

const mk = (
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
const MULT = 12 - getAnnualFreeMonths();
const modules = [...ACTIVE.map((id) => mk(id, true)), mk("enquiry", true, "booking"), mk("email", false)];
const modulesMonthly = ACTIVE.reduce(
  (s, id) => s + MODULE_CATALOG.find((m) => m.id === id)!.priceMonthly,
  0,
);
const totalMonthly = BASE + modulesMonthly;

const mv: TenantModuleView = { modules, baseMonthly: BASE, totalMonthly };

const mkSub = (frozen: boolean): SubscriptionAdminData => ({
  status: frozen ? "frozen" : "active",
  periodEnd: "2027-09-10",
  renewDay: 10,
  nextInvoiceTotal: totalMonthly,
  nextInvoiceItems: ACTIVE.map((id) => {
    const def = MODULE_CATALOG.find((m) => m.id === id)!;
    return { label: def.publicLabel, price: def.priceMonthly, isNew: false };
  }),
  payUrl: frozen ? "https://example.test/pay" : null,
  arrears: frozen ? { amount: totalMonthly * MULT, dueOn: "2027-09-10" } : null,
  closesOn: "2027-10-10",
  frozenOn: frozen ? "2027-09-20" : null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "annual",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: totalMonthly * MULT,
  annualSavings: totalMonthly * getAnnualFreeMonths(),
  annualFreeMonths: getAnnualFreeMonths(),
  autoCharge: false,
  coupon: null,
});

const render = (frozen: boolean) =>
  modulesSection(mv, mkSub(frozen), null, "hello@citoviso.com", null, "hu");

/** A bevezető bekezdés — az egyetlen `.adm-lead`, ami a két blokk ELŐTT áll. */
const introOf = (html: string): { text: string; at: number } | null => {
  // A bevezető a modul-FORM első bekezdése; a kártyán belüli figyelmeztetések
  // ugyanezt az osztályt viselik, ezért a form kezdete után keresünk.
  const formAt = html.indexOf('id="adm-modform"');
  if (formAt < 0) return null;
  const at = html.indexOf('<p class="adm-lead">', formAt);
  if (at < 0) return null;
  const end = html.indexOf("</p>", at);
  const text = html
    .slice(at + '<p class="adm-lead">'.length, end)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { text, at };
};

/** Visszafelé mutató irány — a bekezdés fölött CSAK az Előfizetés-kártya van. */
const BACKWARD = ["fent", "fentebb", "feljebb", "a lap tetején", "föntebb", "fönt"];
/** Előre mutató irány — a blokkok a bekezdés alatt következnek. */
const FORWARD = ["alább", "lentebb", "utána", "alatta", "következ"];

/** Az ELSŐ tagmondat: a megvásárolt blokkra mutató rész (az első `;`-ig). */
const firstClause = (text: string) => text.split(";")[0]!.toLowerCase();

/** A vizsgált állítás: az első tagmondat iránya egyezik-e a render sorrendjével. */
const verdict = (text: string) => {
  const c = firstClause(text);
  return {
    backward: BACKWARD.filter((w) => c.includes(w)),
    forward: FORWARD.filter((w) => c.includes(w)),
  };
};

const liveHtml = render(false);
const frozenHtml = render(true);

// ── ⓪ a fixture bizonyítja, hogy a Modulok fület rendereltük ───────────────
console.log("\n⓪ A fixture bizonyítja, hogy a Modulok fület rendereltük:\n");
const intro = introOf(liveHtml);
check(Boolean(intro), "a modul-form bevezető bekezdése megvan");
check(liveHtml.includes("Az én moduljaim"), "a kimenet tartalmazza „Az én moduljaim” blokkot");
check(
  liveHtml.includes("Bővítés — amit még hozzáadhat"),
  "a kimenet tartalmazza a kirakat-blokkot",
);

// ── ① a tényleges sorrend ──────────────────────────────────────────────────
console.log("\n① A RENDERELT sorrend: bevezető → az én moduljaim → kirakat:\n");
const mineAt = liveHtml.indexOf("Az én moduljaim");
const shopAt = liveHtml.indexOf("Bővítés — amit még hozzáadhat");
check(
  intro !== null && intro.at < mineAt && mineAt < shopAt,
  `a bevezető (${intro?.at}) MEGELŐZI a birtokolt blokkot (${mineAt}), az pedig a kirakatot (${shopAt})`,
);

// ── ② az irány-állítás egyezik a sorrenddel ────────────────────────────────
console.log("\n② A bevezető ELSŐ tagmondata ELŐRE mutat (mert a blokkok alatta vannak):\n");
const v = verdict(intro?.text ?? "");
check(
  v.backward.length === 0,
  v.backward.length === 0
    ? "⭐ nincs visszafelé mutató irány az első tagmondatban"
    : `visszafelé mutat, pedig a blokk ALATTA van: „${v.backward.join(", ")}” — „${firstClause(intro?.text ?? "")}”`,
);
check(
  v.forward.length > 0,
  v.forward.length > 0
    ? `⭐ előre mutat („${v.forward.join(", ")}”)`
    : "az első tagmondat egyáltalán nem mondja meg, merre keresse",
);

// ── ③ ugyanez a FAGYASZTOTT ág saját mondatán ──────────────────────────────
console.log("\n③ A fagyasztott ág KÜLÖN mondata is (két szöveg, két hiba-esély):\n");
const fIntro = introOf(frozenHtml);
check(Boolean(fIntro), "a fagyasztott ág bevezetője megvan");
check(
  fIntro !== null && fIntro.text !== intro?.text,
  "a fagyasztott ág TÉNYLEG a másik mondatot rendereli (nem ugyanazt mérjük kétszer)",
);
const fv = verdict(fIntro?.text ?? "");
check(
  fv.backward.length === 0,
  fv.backward.length === 0
    ? "⭐ a fagyasztott mondat sem küld felfelé"
    : `a fagyasztott mondat felfelé küld: „${fv.backward.join(", ")}”`,
);
check(fv.forward.length > 0, "⭐ a fagyasztott mondat is megmondja, merre keresse");

// ── PIROS IKER: a javítás ELŐTTI mondaton buknia KELL ──────────────────────
console.log("\n⚠️ PIROS IKER — a 2026-09-14 ELŐTTI, szó szerinti mondatokon buknia kell:\n");
const OLD_LIVE =
  "Ami már az Öné, azt fent találja; amit még hozzáadhat, azt alább — és mindegyiket meg is nézheti a saját oldalán, mielőtt dönt.";
const OLD_FROZEN =
  "Ami már az Öné, azt fent találja; amit még hozzáadhat, azt alább — az előnézet ilyenkor is megmutatja őket, de csak Önnek.";
for (const [name, old] of [
  ["élő ág", OLD_LIVE],
  ["fagyasztott ág", OLD_FROZEN],
] as const) {
  const ov = verdict(old);
  check(
    ov.backward.length > 0,
    ov.backward.length > 0
      ? `⭐ a régi ${name} mondatát elutasítja („${ov.backward.join(", ")}”)`
      : `⛔ a régi ${name} mondata ÁTMENNE — ez a detektor nem ezt a hibát méri`,
  );
}
// Álpozitív-kontroll: egy előre mutató mondat NEM bukhat meg.
const SANE = "Ami már az Öné, azt alább találja; amit még hozzáadhat, azt utána — nézze meg.";
check(
  verdict(SANE).backward.length === 0 && verdict(SANE).forward.length > 0,
  "⭐ álpozitív-kontroll: a helyes alakot átengedi",
);
// Szűkítés-kontroll: a bekezdés HÁTSÓ fele jogosan mutathat felfelé.
const BACK_LATER =
  "Ami már az Öné, azt alább találja; a számláját fent, az Előfizetés-kártyán találja meg.";
check(
  verdict(BACK_LATER).backward.length === 0,
  "⭐ szűkítés-kontroll: a MÁSODIK tagmondat „fent”-je nem fals pozitív",
);

console.log(
  bad === 0
    ? "\n✅ A bevezető iránya egyezik a renderelt sorrenddel.\n"
    : `\n❌ ${bad} hiba — a bevezető olyan helyre küldi a tulajt, ahol nincs semmi.\n`,
);
process.exit(bad === 0 ? 0 : 1);
