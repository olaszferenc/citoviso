// FROZEN-STATE guard — one screen may not claim two opposite things.
//
//   npx tsx scripts/frozen-state-check.mts [--self-test]
//
// Measured 2026-09-11 (Elek FK-006a): with the site answering 503, the Modulok
// tab rendered the suspension notice AND, ~250px below it, "BEKAPCSOLVA …
// nincs teendője", AND "elérhető marad", AND 11 module rows saying "Aktív az
// oldalán." Every one of those sentences is fine on its own — the bug only
// exists in their CO-OCCURRENCE, which is exactly what no unit test sees.
//
// So this measures the RENDERED HTML of a genuinely frozen subscription, not the
// source text: the sentences are built by different branches in different files,
// and a source scan cannot tell which of them fire together.
//
// The fixture is hermetic (no DB, no server): modulesSection() is called with a
// hand-built frozen SubscriptionAdminData + TenantModuleView, so the guard runs
// in a fresh clone and in pre-commit without the Elek park being up.
//
// --self-test flips the fixture to a state the guard MUST reject (a frozen
// subscription rendered with the live wording). A guard that has never been seen
// red is not evidence — feedback_fixture_must_prove_its_own_path.

import { modulesSection } from "../src/server/adminViews.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import type { TenantModuleView } from "../src/tenant/modules.js";

const selfTest = process.argv.includes("--self-test");

/** Sentences that must NEVER share a screen with a suspension notice. */
const FORBIDDEN: ReadonlyArray<{ needle: string; why: string }> = [
  {
    needle: "nincs teendője",
    why: "a tulajnak DE IGENIS van teendője: a honlapja le van kapcsolva, és fizetnie kell",
  },
  {
    needle: "elérhető marad",
    why: "a honlap NEM marad elérhető — épp most nem az",
  },
  {
    needle: "Aktív az oldalán",
    why: "egy modul nem lehet aktív az oldalon, amikor az oldal 503-at ad",
  },
];

/** What a suspended screen MUST say, or it is not doing its job either. */
const REQUIRED: ReadonlyArray<{ needle: string; why: string }> = [
  { needle: "NEM elérhető", why: "ki kell mondani, hogy a honlap nem elérhető" },
  { needle: "Rendezendő tartozás", why: "a tartozás összege a fagyasztott lap kötelező eleme" },
  { needle: "Szünetel", why: "a modulok állapotát ki kell mondani" },
];

const MODULES: TenantModuleView["modules"] = [
  ["gallery", "Képek a szállásról"],
  ["rooms", "Szobák, apartmanok"],
  ["booking", "Online foglalás"],
].map(([id, label]) => ({
  id: id!,
  label: label!,
  group: "offer",
  active: true,
  spine: false,
  priceMonthly: 690,
  cancelAtPeriodEnd: false,
  awaitingFirstCharge: false,
  supersededBy: null,
  publicDesc: null,
})) as unknown as TenantModuleView["modules"];

const MV = {
  modules: MODULES,
  baseMonthly: 4880,
  totalMonthly: 6950,
} as unknown as TenantModuleView;

/** A subscription in the state the ladder leaves at T+10. */
function frozenSub(): SubscriptionAdminData {
  return {
    status: "frozen",
    periodEnd: "2031-09-10",
    renewDay: 10,
    nextInvoiceTotal: 99900,
    nextInvoiceItems: [],
    payUrl: "https://example.invalid/pay",
    arrears: { amount: 99900, periodStart: "2031-09-10", periodEnd: "2032-09-10" },
    closesOn: "2031-10-10",
    frozenOn: "2031-09-20",
    restoredOn: null,
    cancelAtPeriodEnd: false,
    billingPeriod: "annual",
    pendingAnnual: false,
    pendingEffectiveDate: null,
    annualTotal: 99900,
    annualSavings: 19980,
    annualFreeMonths: 2,
    autoCharge: true,
    coupon: null,
  };
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};

// ── ① the frozen screen ────────────────────────────────────────────────────
// --self-test hands the view an 'active' subscription while still judging it as
// a suspension: the live wording comes back and every rule below must fire.
const sub = selfTest ? { ...frozenSub(), status: "active" as const } : frozenSub();
const html = modulesSection(MV, sub, null, "elek@citoviso.com", null, "hu");
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

console.log(
  selfTest
    ? "frozen-state-check --self-test: a fagyasztott lapot ÉLŐ szöveggel rendereljük — mindennek pirosnak kell lennie"
    : "frozen-state-check: a fagyasztott tulaj-admin renderelt kimenete",
);

for (const { needle, why } of FORBIDDEN) {
  const n = text.split(needle).length - 1;
  if (n > 0) fail(`${n}× „${needle}” a felfüggesztett lapon — ${why}`);
}
for (const { needle, why } of REQUIRED) {
  if (!text.includes(needle)) fail(`hiányzik: „${needle}” — ${why}`);
}

// ── ② the amount owed must be ON the screen, as a figure ───────────────────
if (!/99\s900/.test(text)) {
  fail("a tartozás összege (99 900) nem szerepel a lapon — a tulaj nem tudja meg, mennyit fizessen");
}

// ── ③ the settle button must sit WITH the problem, not at the far end of the
//     page: measured on the live page the only large filled pay button was a
//     NEW PURCHASE ~3660px down. Proxy: the pay control is inside the state card.
const stateCard = /<section class="adm-card adm-state[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
if (!selfTest && !/adm-owe__pay/.test(stateCard)) {
  fail("a rendezés gombja nincs a teendő-kártyán belül — a probléma és a kiút elszakadt");
}

// ── ④ the return must be as loud as the freeze ─────────────────────────────
const restored = modulesSection(
  MV,
  { ...frozenSub(), status: "active", arrears: null, frozenOn: null, restoredOn: "2031-09-21" },
  null,
  "elek@citoviso.com",
  null,
  "hu",
);
const restoredText = restored.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
if (!restoredText.includes("újra elérhető")) {
  fail("a visszakapcsolás után nincs megerősítés — a fagyás hangos, a visszatérés néma");
}
if (restoredText.includes("NEM elérhető")) {
  fail("a visszakapcsolt lap még mindig felfüggesztést állít");
}

if (failures === 0) {
  if (selfTest) {
    console.error(
      "\n⛔ ÖNTESZT BUKÁS: a romlott állapotot ZÖLDNEK láttam — az őr vak, nem a termék jó.",
    );
    process.exit(1);
  }
  console.log("✅ frozen-state-check: a felfüggesztett lap nem mond önmagának ellent.");
  process.exit(0);
}

if (selfTest) {
  console.log(`\n✅ önteszt: az őr ${failures} sértést talált a romlott állapoton — tehát lát.`);
  process.exit(0);
}
console.error(`\n⛔ frozen-state-check: ${failures} sértés.`);
process.exit(1);
