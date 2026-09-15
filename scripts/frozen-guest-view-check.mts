// FROZEN-GUEST-VIEW őr — a tulaj azt is látja, ami az ÖVÉ, és azt is, amit a VILÁG.
//
//   npx tsx scripts/frozen-guest-view-check.mts [--self-test]
//
// Kontraktus: `assets/design-refs/console/freeze-state-v2/` ⑨ (tulajdonosi döntés,
// 2026-09-15): „a gomb felirata fagyás alatt »Előnézet — csak Ön látja«, ÉS a
// fagyás-blokk mondja ki, mit lát közben a VENDÉG."
//
// KÉT hibát zár le, és MINDKETTŐ a sajátom volt:
//
//  ① A fejléc-gomb felirata az ELLENKEZŐ irányba hazudott. A bejelentés szerint a gomb
//     „figyelmeztetés nélkül visz a fagyasztott lapra" — MÉRVE nem: a `public.ts` a
//     `siteUrl`-t csak `live` státuszban adja át, fagyás alatt tehát a BELSŐ előnézetre
//     esik vissza. Törött link nincs. A baj a felirat: az „Oldal megtekintése" azt
//     ígéri, hogy azt látja, ami a látogatónak megy — közben a tulaj a teljes, működő
//     oldalt kapja, a látogató meg 503-at. A gomb megnyugtat, pont amikor nem kéne.
//
//  ② A „B — Rendezés-képernyő" refaktorom NÉMÁN elvitte azt a hármas ténylistát,
//     amiben egyedül állt, hogy a látogató nem üres lapot és nem nyers hibát kap
//     (feedback_layout_swap_silently_removes_information). A tulaj legnagyobb félelme
//     épp ez, és a képernyő nem válaszolt rá.
//
// ⛔ AZ ŐR LÉNYEGE: az admin állítását a VALÓDI vendég-lap RENDERJÉN méri, nem egy
// kézzel másolt hasonmáson. Ha a vendég-lapról eltűnik a szállásnév vagy az
// elérhetőség, az admin ígérete hamissá válik — és ezt itt kell megtudni, nem a
// tulajtól. (A vendég-lapot 2026-09-14-én egy PÁRHUZAMOS szál írta át: kikerült az
// „átmenetileg" és a visszatérés-ígéret. Az admin szövege azóta sem ígérhet
// visszatérést — ezt is méri.)
//
// Hermetikus: nincs DB, nincs szerver, nincs böngésző.
//
// --self-test a fixtúrát a JAVÍTÁS ELŐTTI állapotra fordítja (nincs vendég-nézet-cím,
// és a lapot nem fagyasztottként rendereljük) — az őrnek pirosra kell mennie.

import { adminDashboard, modulesSection } from "../src/server/adminViews.js";
import { renderSuspendedPage } from "../src/server/suspendedPage.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import type { TenantModuleView } from "../src/tenant/modules.js";

const selfTest = process.argv.includes("--self-test");

const visible = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};
const pass = (msg: string) => console.log(`  ✔ ${msg}`);

// ── fixtúra ────────────────────────────────────────────────────────────────
const day = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 10);

/** A látogató adatai — UGYANEZ megy a vendég-lapra és az admin ígéretébe. */
const TENANT = {
  name: "Nyugalom Vendégház",
  city: "Kaposvár",
  email: "info@nyugalom.hu",
  phone: "+36 30 123 4567",
  address: "Fő utca 1.",
};
const GUEST_URL = "https://nyugalom.citoviso.com";
const PREVIEW_TOKEN = "TOK123";

const SUB = {
  status: "frozen",
  periodEnd: iso(-14),
  renewDay: 10,
  nextInvoiceTotal: 10_270,
  nextInvoiceItems: [],
  payUrl: "https://example.invalid/pay",
  arrears: { amount: 10_270, periodStart: iso(-14), periodEnd: iso(16) },
  closesOn: iso(16),
  frozenOn: iso(-4),
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 102_700,
  annualSavings: 20_540,
  annualFreeMonths: 2,
  autoCharge: true,
  coupon: null,
} as unknown as SubscriptionAdminData;

const MV = {
  modules: [
    ["gallery", "Képek a szállásról", true],
    ["reviews", "Vendégek véleménye", false],
  ].map(([id, label, active]) => ({
    id,
    label,
    group: "offer",
    active,
    spine: false,
    priceMonthly: 490,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
    supersededBy: null,
    publicDesc: null,
  })),
  baseMonthly: 4880,
  totalMonthly: 10_270,
} as unknown as TenantModuleView;

const CONTENT = {
  name: TENANT.name,
  tagline: "Csend a Zselic szélén",
  intro: "A Nyugalom Vendégház a Zselic peremén várja a pihenni vágyókat.",
  highlights: [],
  photos: [],
  usingOwnPhotos: true,
  // A --self-test a fagyás ELŐTTI ágat rendereli: ekkor a felirat a régi marad.
  status: selfTest ? "live" : "suspended",
  previewPath: null,
  lang: "hu",
};

const MESSAGES = {
  messages: [],
  unread: 0,
  topic: "mind",
  channel: "",
  unreadOnly: false,
  q: "",
  openThreads: [],
  confirmRead: false,
  total: 0,
  mindCount: 0,
  topicCounts: {},
  channelCounts: {},
  unreadCount: 0,
  openId: null,
};

const page = adminDashboard(
  { username: "elek@citoviso.com", displayName: TENANT.name } as never,
  CONTENT as never,
  {
    tab: "modulok",
    // a self-testben nincs fagyás → a régi felirat és a hiányzó vendég-sor a VÁRT bukás
    subscription: (selfTest ? { ...SUB, status: "active" } : SUB) as never,
    modules: MV,
    previewToken: PREVIEW_TOKEN,
    siteUrl: null, // ahogy a public.ts teszi felfüggesztett site-nál
    guestViewUrl: selfTest ? null : GUEST_URL,
    messages: MESSAGES as never,
  },
);
const text = visible(page);

console.log(
  selfTest
    ? "frozen-guest-view-check --self-test: a fagyás ELŐTTI ágat rendereljük — mindennek pirosnak kell lennie"
    : "frozen-guest-view-check: a tulaj látja a sajátját ÉS azt, amit a világ",
);

// ── ① A fejléc-gomb felirata fagyás alatt nem ígér nyilvános nézetet ───────
const btn = /<a class="adm-viewbtn"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(page);
if (!btn) {
  fail("nincs fejléc-gomb a lapon — a fixtúra nem azt rendereli, amit mérni akarok");
} else {
  const label = visible(btn[2]!).trim();
  const href = btn[1]!;
  if (/Oldal megtekintése/.test(label)) {
    fail(
      `a fejléc-gomb felirata fagyás alatt is „${label}” — azt ígéri, hogy azt látja, ` +
        `ami a látogatónak megy, közben a saját, működő oldalát kapja`,
    );
  } else if (!/Előnézet/.test(label)) {
    fail(`a fejléc-gomb felirata nem mondja ki, hogy ez ELŐNÉZET: „${label}”`);
  } else if (!selfTest) {
    pass(`a fejléc-gomb felirata: „${label}”`);
  }
  // ⚠️ …és tényleg az ELŐNÉZETRE visz, nem a felfüggesztett hosztra. A felirat és a
  // cél együtt igaz vagy együtt hamis — külön mérve mindkettő átcsúszhatna.
  if (!selfTest) {
    if (!href.includes(PREVIEW_TOKEN)) {
      fail(`a fejléc-gomb nem az előnézetre visz: href="${href}"`);
    } else if (href.includes(GUEST_URL)) {
      fail("a fejléc-gomb a felfüggesztett nyilvános hosztra visz — ott 503 várja");
    } else {
      pass(`a fejléc-gomb célja az előnézet: ${href}`);
    }
  }
}

// ── ② A blokk KIMONDJA, mit lát közben a látogató ───────────────────────────
if (!/Mit lát közben a látogató/.test(text)) {
  fail(
    "a fagyás-blokk nem mondja meg, mit lát közben a látogató — a tulaj legnagyobb " +
      "félelmére (elveszítem a vendégeket?) nincs válasz a képernyőn",
  );
} else if (!selfTest) {
  pass("a blokk kimondja, mit lát közben a látogató");
}

// ── ③ …és van ÚT is oda, nem csak állítás ──────────────────────────────────
const glink = /<a class="adm-frz__glink" href="([^"]*)"/.exec(page);
if (!selfTest) {
  if (!glink) fail("nincs link a látogatói nézethez — az állítás ellenőrizhetetlen marad");
  else if (glink[1] !== GUEST_URL) fail(`a látogatói link nem a nyilvános hosztra visz: ${glink[1]}`);
  else pass(`a látogatói nézet elérhető: ${glink[1]}`);
}

// ── ④ ⭐ AMIT AZ ADMIN ÍGÉR, AZ TÉNYLEG OTT VAN A VENDÉG-LAPON ──────────────
// Ez az őr gerince. Az admin felsorol három dolgot; mindhármat a VALÓDI vendég-lap
// renderjén keressük vissza. Kézzel másolt hasonmás helyett egy forrás
// (feedback_one_rule_two_copies) — ha a vendég-lapról eltűnik valamelyik, az admin
// ígérete hamissá válik, és itt derül ki, nem a tulajnál.
const guestPage = visible(renderSuspendedPage(TENANT as never, "hu"));
const PROMISED: ReadonlyArray<{ what: string; needle: string }> = [
  { what: "a szállás neve", needle: TENANT.name },
  { what: "a település", needle: TENANT.city },
  { what: "az e-mail elérhetőség", needle: TENANT.email },
  { what: "a telefonszám", needle: TENANT.phone },
];
for (const { what, needle } of PROMISED) {
  if (!guestPage.includes(needle)) {
    fail(
      `az admin azt ígéri, hogy a látogató látja: ${what} — de a RENDERELT vendég-lapon ` +
        `NINCS ott („${needle}”). Az admin mondata hamissá vált.`,
    );
  }
}
if (!selfTest && !failures) pass(`mind a ${PROMISED.length} ígért elem ott van a renderelt vendég-lapon`);

// ── ⑤ Az admin sora sem ígérhet VISSZATÉRÉST ───────────────────────────────
// A vendég-lapról egy párhuzamos szál (2026-09-14) szándékosan kivette az
// „átmenetileg"-et és a „nézzen vissza holnap"-ot: fizetés híján a 30. napon a honlap
// VÉGLEG lekerül. Ugyanazt az ígéretet egy szinttel feljebb sem írhatjuk vissza.
const guestLine = /<p class="adm-frz__guest">([\s\S]*?)<\/p>/.exec(page)?.[1] ?? "";
const RETURN_PROMISE = ["átmenetileg", "nézzen vissza", "hamarosan", "dolgozunk rajta"];
for (const n of RETURN_PROMISE) {
  if (visible(guestLine).toLowerCase().includes(n)) {
    fail(`a látogatói sor visszatérést ígér („${n}”) — a vendég-lapról épp ezt vettük ki`);
  }
}
if (!selfTest && guestLine) pass("a látogatói sor tényeket állít, visszatérést nem ígér");

// ── ⑥ A Modulok fül önálló útja is kapja (nem csak a fül-szintű blokk) ─────
// A `modulesSection()` a SAJÁT blokkját rendereli — ha a paraméter oda nem jut el,
// épp a pénz-lapon maradna el a látogatói nézet, miközben a többi fülön ott van.
if (!selfTest) {
  const modOnly = modulesSection(MV, SUB, null, "elek@citoviso.com", null, "hu", GUEST_URL);
  if (!/adm-frz__glink/.test(modOnly)) {
    fail("a modulesSection() saját blokkjába nem jut el a látogatói nézet címe");
  } else {
    pass("a Modulok fül saját blokkja is kínálja a látogatói nézetet");
  }
}

if (failures) {
  console.error(`\nfrozen-guest-view-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error("\n⛔ --self-test: a fagyás ELŐTTI ágon EGYETLEN sértést sem találtam — az őr vak.");
  process.exit(1);
}
console.log("✅ frozen-guest-view-check: a tulaj a sajátját ELŐNÉZETKÉNT látja, és megnézheti, mit lát a világ.");
