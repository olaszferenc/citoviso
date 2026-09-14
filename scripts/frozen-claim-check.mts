// FROZEN-CLAIM guard — while the site is suspended, no card may promise availability.
//
//   npx tsx scripts/frozen-claim-check.mts [--self-test]
//
// ⛔⛔ WHY THIS EXISTS, AND WHY frozen-state-check.mts WAS NOT ENOUGH
// (mérve 2026-09-13, Elek FK-006a HIBA-1). On ONE frozen page the todo card said
// „A honlapja jelenleg NEM elérhető", and a few hundred pixels below the
// multilingual card said „Az oldala 3 választott nyelven is ELÉRHETŐ LESZ" and
// „a nyelvi változatok maguktól megjelennek"; higher up: „meg is nézheti a saját
// oldalán". The existing guard checked THREE LITERAL NEEDLES ("nincs teendője",
// "elérhető marad", "Aktív az oldalán") and all three PASSED — because the page
// said the same thing IN DIFFERENT WORDS.
//
// So a needle list cannot be the mechanism: it only ever knows the sentences we
// already caught once. This guard measures the CLAIM instead —
//
//     SUBJECT (the tenant's site / its content / a module)
//   + PREDICATE (is reachable · appears · is visible · is up to date)
//   + POLARITY (not negated, not qualified by the freeze)
//   = an availability promise, whatever words carry it.
//
// A NEW sentence with NEW wording ("a vendégek már böngészhetik az oldalát") is
// caught without anyone updating this file. That is the whole point.
//
// The corpus is rendered from the PRODUCT SOURCE (MODULE_CATALOG) across many
// states, not from a hand-copied fixture: scripts/ is not typechecked, so a
// hand-built fixture silently rots (reference_scripts_are_not_typechecked, and
// it has already happened here — feedback_fixture_must_prove_its_own_path).

import { modulesSection, multilangSection } from "../src/server/adminViews.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import { multilangCatalogView } from "../src/tenant/multilangCard.js";
import { MODULE_CATALOG } from "../src/modules.js";

const selfTest = process.argv.includes("--self-test");

/** The page as the OWNER sees it (script/style bodies are not visible text). */
function visible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── the claim model ────────────────────────────────────────────────────────
//
// ① SUBJECT — the sentence must be ABOUT the tenant's site or its content.
//    Without this, "a visszatérő vendégeit hírlevélben érheti el" (reaching
//    GUESTS, not the site being reachable) would be a false positive.
const SUBJECT = /(oldala|oldalán|oldalon|oldalát|honlapja|honlapját|honlap\b|nyelvi változat|fordítás|modul)/i;

// ② PREDICATE — availability, in any of the forms Hungarian actually uses here.
//    Each entry is a claim TYPE, not a sentence: new wording of the same claim
//    still matches.
//    `needsPage`: a VIEWING verb is only an availability claim when it is about
//    the owner's own page. „Addig is megnézheti, mit kínálunk” (the shop catalog)
//    is true under a freeze; „meg is nézheti a saját oldalán” is not. Without this
//    split the guard reds on a correct sentence — measured, 2026-09-14.
const PREDICATES: ReadonlyArray<{ rx: RegExp; claim: string; needsPage?: boolean }> = [
  // ⚠️ (?!ség|sége) — „Elérhetőség” is a group heading and „elérhetőségével” is the
  //    guest-facing contact line; neither claims the site is reachable.
  { rx: /el(é|e)rhet(ő|ők)(?!s(é|e)g)/gi, claim: "elérhető (a látogató eléri)" },
  { rx: /ér(i|ik|het|heti|hetők)\s+el/gi, claim: "eléri (a látogató eléri)" },
  { rx: /(meg)?jelen(ik|nek|het|hetnek)(\s+meg)?/gi, claim: "megjelenik (a tartalom kikerül)" },
  { rx: /jelennek\s+meg/gi, claim: "megjelennek (a tartalom kikerül)" },
  { rx: /l(á|a)that(ó|óvá|ja|ják|nak)/gi, claim: "látható (a vendég látja)" },
  { rx: /l(á|a)t(ja|ják|nak|hatja)/gi, claim: "látja (a vendég látja)" },
  {
    rx: /n(é|e)zheti|megn(é|e)zheti|megtekintheti|b(ö|o)ngészheti/gi,
    claim: "megnézheti (a saját oldalán)",
    needsPage: true,
  },
  { rx: /naprak(é|e)sz(ek)?/gi, claim: "naprakész (élő tartalmat sugall)" },
  { rx: /akt(í|i)v az oldal/gi, claim: "aktív az oldalán" },
];

/** The owner's own page — the only subject that turns a viewing verb into a promise. */
const PAGE = /(oldala|oldalán|oldalon|oldalát|honlapja|honlapját|honlap\b)/i;

// ③ POLARITY — a negator IMMEDIATELY BEFORE the predicate cancels the claim.
//    ⚠️ Sentence-wide negation would be too loose: "Az oldala elérhető, nem kell
//    tennie semmit" contains "nem" but still promises availability. So the window
//    is the 40 characters PRECEDING the predicate, where a Hungarian negator sits.
const NEGATOR = /\b(nem|sem|nincs|sincs|egyik\s+\w+\s+sem)\b/i;
const NEG_WINDOW = 40;

// ④ QUALIFIER — the sentence itself names the freeze and defers the availability
//    ("a rendezés után válnak láthatóvá"). That is not a promise about NOW.
const QUALIFIER = /(felfüggeszt|rendezés után|rendezéséig|rendezése után|szünetel|csak Önnek|előnézet)/i;

/**
 * Catalog product copy that is NOT a claim about THIS tenant's live site: it
 * describes what a module does, on a shop card that already says "Rendezés után
 * vehető fel". ⛔ SPOKEN, NOT SILENT (and fails closed): the exemption is by
 * EXACT sentence, so editing any of these — or adding a new description — stops
 * matching and turns the guard red until a human re-classifies it.
 */
const PRODUCT_COPY_EXEMPT: ReadonlyArray<{ text: string; why: string }> = [
  {
    text: "Feliratkozó-mező az oldalon — a visszatérő vendégeit később hírlevélben érheti el.",
    why: "az „érheti el” itt a VENDÉGET éri el hírlevélben, nem az oldal elérhetőségéről szól",
  },
];

interface Violation {
  readonly where: string;
  readonly sentence: string;
  readonly claim: string;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

const exemptUsed = new Set<string>();

function claimsIn(where: string, html: string): Violation[] {
  const out: Violation[] = [];
  for (const s of sentences(visible(html))) {
    const exempt = PRODUCT_COPY_EXEMPT.find((e) => s.includes(e.text));
    if (exempt) {
      exemptUsed.add(exempt.text);
      continue;
    }
    if (!SUBJECT.test(s)) continue;
    if (QUALIFIER.test(s)) continue;
    for (const { rx, claim, needsPage } of PREDICATES) {
      if (needsPage && !PAGE.test(s)) continue;
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(s))) {
        const before = s.slice(Math.max(0, m.index - NEG_WINDOW), m.index);
        if (NEGATOR.test(before)) continue;
        out.push({ where, sentence: s, claim });
        break;
      }
      if (out.length && out[out.length - 1]!.sentence === s) break;
    }
  }
  return out;
}

// ── fixtures, built FROM THE PRODUCT SOURCE ────────────────────────────────
// Half the catalog owned, half in the shop: an all-active set renders an EMPTY
// shop and half the surface would go unmeasured.
const MODULES = MODULE_CATALOG.filter((m) => !m.tenantOnly).map((m, i) => ({
  id: m.id,
  label: m.publicLabel ?? m.label,
  group: m.group,
  active: i % 2 === 0,
  spine: !!m.spine,
  priceMonthly: m.priceMonthly,
  cancelAtPeriodEnd: false,
  awaitingFirstCharge: false,
  supersededBy: null,
  publicDesc: m.publicDesc,
})) as unknown as TenantModuleView["modules"];

const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: 6950 } as unknown as TenantModuleView;

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
  } as unknown as SubscriptionAdminData;
}

// --self-test renders the page with an ACTIVE subscription while still judging it
// as a freeze: every "frozen" branch flips back to the live wording, so the very
// sentences FK-006a measured must come back and every rule must fire.
const sub = selfTest ? ({ ...frozenSub(), status: "active" } as SubscriptionAdminData) : frozenSub();

const mlBase = {
  ...multilangCatalogView("hu"),
  price: 14900,
  count: 3,
  primaryLangName: "magyar",
  langUrls: [],
  frozen: !selfTest,
};

/** Every state the multilingual card can be in — each is its own set of sentences. */
const ML_STATES: ReadonlyArray<{ name: string; data: Record<string, unknown> }> = [
  { name: "nincs vásárlás", data: { state: null, paid: null, failedError: null } },
  {
    name: "kifizetve, fut",
    data: {
      state: null,
      failedError: null,
      paid: { phase: "running", attempts: 0, langs: ["en", "de"], langNames: ["angol", "német"], amount: 14900, ref: "CIT-1", paidAt: "2031-09-20", tierId: "alap" },
    },
  },
  {
    name: "kifizetve, újraindult",
    data: {
      state: null,
      failedError: null,
      paid: { phase: "running", attempts: 2, langs: ["en"], langNames: ["angol"], amount: 14900, ref: "CIT-2", paidAt: "2031-09-20", tierId: "alap" },
    },
  },
  {
    name: "kifizetve, feladtuk",
    data: {
      state: null,
      failedError: null,
      paid: { phase: "gave_up", attempts: 5, langs: ["en"], langNames: ["angol"], amount: 14900, ref: "CIT-3", paidAt: "2031-09-20", tierId: "alap" },
    },
  },
  {
    name: "kész, naprakész",
    data: {
      paid: null,
      failedError: null,
      state: { languages: ["en", "de"], langNames: ["angol", "német"], status: "active", generatedAt: "2031-09-20" },
    },
  },
  {
    name: "kész, elavult",
    data: {
      paid: null,
      failedError: null,
      state: { languages: ["en"], langNames: ["angol"], status: "stale", generatedAt: "2031-09-01" },
    },
  },
];

const violations: Violation[] = [];
violations.push(...claimsIn("Modulok lap", modulesSection(MV, sub, null, "elek@citoviso.com", null, "hu")));
for (const st of ML_STATES) {
  violations.push(
    ...claimsIn(`Többnyelvű kártya (${st.name})`, multilangSection({ ...mlBase, ...st.data } as never, "hu")),
  );
}

console.log(
  selfTest
    ? "frozen-claim-check --self-test: a fagyasztott lapot ÉLŐ szöveggel rendereljük — az állítás-mérőnek pirosnak kell lennie"
    : "frozen-claim-check: elérhetőség-ÁLLÍTÁSOK a felfüggesztett tulaj-admin renderelt kimenetén",
);

// The exemption must be SEEN to apply: an exemption that silently stops matching
// (because the copy changed) would quietly shrink the guard's reach.
for (const e of PRODUCT_COPY_EXEMPT) {
  if (!exemptUsed.has(e.text)) {
    console.log(`  ⚠️  kivétel nem illeszkedett (a szöveg megváltozott?): „${e.text.slice(0, 60)}…”`);
  }
}

if (violations.length) {
  for (const v of violations) {
    console.error(`  ⛔ [${v.where}] ${v.claim}\n     „${v.sentence.slice(0, 190)}”`);
  }
}

if (violations.length === 0) {
  if (selfTest) {
    console.error(
      "\n⛔ ÖNTESZT BUKÁS: az élő szövegű fagyasztott lapot TISZTÁNAK láttam — az őr vak, nem a termék jó.",
    );
    process.exit(1);
  }
  console.log("✅ frozen-claim-check: egyetlen kártya sem ígér elérhetőséget a felfüggesztés alatt.");
  process.exit(0);
}

if (selfTest) {
  console.log(`\n✅ önteszt: az őr ${violations.length} elérhetőség-állítást talált a romlott állapoton — tehát lát.`);
  process.exit(0);
}
console.error(`\n⛔ frozen-claim-check: ${violations.length} elérhetőség-állítás a felfüggesztett lapon.`);
process.exit(1);
