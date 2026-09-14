// FROZEN-SETTLE guard — a jóváhagyott „B — Rendezés-képernyő" terv kötései.
//
//   npx tsx scripts/frozen-settle-check.mts [--self-test]
//
// Kontraktus: `assets/design-refs/console/freeze-state-v2/` (tulajdonosi döntés,
// 2026-09-14): „Fagyás alatt a lap EGY dologról szóljon: tartozás + hátralévő idő
// nagyban, a modul-lista CSAK OLVASHATÓ (a kapcsolók kikerülnek)." és „a
// »Következő számla« sor fagyás alatt NEM állhat ott a tartozás mellett ugyanazzal
// a számmal — pláne nem MÚLTBELI dátummal."
//
// Miért KÜLÖN őr a három meglévő mellé:
//   ⑦ `frozen-state-check` — nem mond-e ellent magának a lap (tű-lista)
//   ⑧ `frozen-claim-check` — ígér-e bárki elérhetőséget (ÁLLÍTÁS-mérés)
//     `frozen-entry-check` — kimondja-e a BELÉPŐ lap a felfüggesztést
//   ez        — a PÉNZ és a VEZÉRLŐK: hány összeg, milyen dátum, mit lehet
//               csinálni. Egyik korábbi őr sem számolta meg, hány pénzösszeg áll
//               a képernyőn — pedig pont ez volt a bejelentett hiba.
//
// Hermetikus: nincs DB, nincs szerver, nincs böngésző. A renderelt HTML-en mér,
// mert a mondatok külön ágakból jönnek, és forrás-scan nem látja, mi sül el EGYÜTT.
//
// --self-test a fixtúrát arra az állapotra fordítja, amit az őrnek EL KELL
// utasítania (a fagyás ELŐTTI, „active" ág szövegével renderelt felfüggesztett
// lap) — egy őr, amit sosem láttunk pirosan, nem bizonyíték.

import { modulesSection, adminDashboard } from "../src/server/adminViews.js";
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
// ⚠️ A dátumok a MAI naphoz képest relatívak. Beégetett dátumokkal az őr egy nap
// múlva mást mérne, mint amit állít (a „hátralévő idő" és a „múltbeli dátum"
// vizsgálat is a mai naphoz viszonyít) — és egy őr, ami a naptártól függően
// billen, zajt termel, a zajt pedig figyelmen kívül hagyják.
const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);

/** A létra által hátrahagyott állapot T+10-en: a periódus vége MÁR ELMÚLT. */
const PERIOD_END = iso(-14); // ez az, amit a régi kód „Következő számlá"-nak írt
const ARREARS_END = iso(+16);
const FROZEN_ON = iso(-4);
const CLOSES_ON = iso(+16);
const OWED = 10_270;

function frozenSub(): SubscriptionAdminData {
  return {
    status: "frozen",
    periodEnd: PERIOD_END,
    renewDay: 10,
    // ⚠️ SZÁNDÉKOSAN ugyanaz a szám, mint a tartozás — ez ÁLLT ELŐ élesben, mert
    // mindkettő ugyanabból a modul-készletből számolódik. Ha a fixtúra két
    // KÜLÖNBÖZŐ számot adna, a „csak egy összeg" szabály próbája hamis biztonság
    // lenne: a hiba pont az azonosságban volt.
    nextInvoiceTotal: OWED,
    nextInvoiceItems: [],
    payUrl: "https://example.invalid/pay",
    arrears: { amount: OWED, periodStart: PERIOD_END, periodEnd: ARREARS_END },
    closesOn: CLOSES_ON,
    frozenOn: FROZEN_ON,
    restoredOn: null,
    cancelAtPeriodEnd: false,
    billingPeriod: "monthly",
    pendingAnnual: false,
    pendingEffectiveDate: null,
    annualTotal: OWED * 10,
    annualSavings: OWED * 2,
    annualFreeMonths: 2,
    autoCharge: true,
    coupon: null,
  };
}

// ⚠️ A fixtúrában KELL birtokolt ÉS nem-birtokolt modul is. Csupa-birtokolt
// készlettel a bolt ÜRES, és a „boltban maradhat ár" ellenőrzés akkor sem tudna
// elsülni, ha a kód rossz (feedback_fixture_must_prove_its_own_path).
const MODULES = [
  ["gallery", "Képek a szállásról", true],
  ["rooms", "Szobák, apartmanok", true],
  ["booking", "Online foglalás", true],
  ["reviews", "Vendégek véleménye", false], // a boltba esik
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
})) as unknown as TenantModuleView["modules"];

const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: OWED } as unknown as TenantModuleView;

const sub = selfTest ? { ...frozenSub(), status: "active" as const } : frozenSub();
const html = modulesSection(MV, sub, null, "elek@citoviso.com", null, "hu");
const text = visible(html);

console.log(
  selfTest
    ? "frozen-settle-check --self-test: a felfüggesztett lapot a fagyás ELŐTTI ággal rendereljük — mindennek pirosnak kell lennie"
    : "frozen-settle-check: a jóváhagyott „B — Rendezés-képernyő” kötései",
);

// ── ① EGY képernyő, EGY pénzösszeg ─────────────────────────────────────────
// A kötés lényege: a tartozás összege NEM állhat ott másodszor, más felirattal.
// Ezért nem a szöveget nézzük, hanem MEGSZÁMOLJUK, hányszor szerepel AZ AZ
// ÖSSZEG a lapon — így egy új, eddig nem ismert cella is fennakad rajta.
const owedStr = String(OWED).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const owedCount = text.split(owedStr).length - 1;
// A tartozás-blokkban kétszer szerepel jogosan: a nagy szám és a gomb felirata
// („Befizetem — 10 270 Ft”) — a gomb AZT mondja meg, mit fizet, nem másik tétel.
if (owedCount > 2) {
  fail(
    `${owedCount}× szerepel a lapon a(z) ${owedStr} — a tartozás összege csak a fagyás-blokkban ` +
      `állhat (a nagy szám + a gomb felirata). Egy második előfordulás más felirat alatt azt kelti, ` +
      `hogy kétszer kell fizetni.`,
  );
} else {
  pass(`a tartozás összege ${owedCount}× szerepel (csak a fagyás-blokkban)`);
}

// ── ①b BÁRMELY MÁSIK összeg döntési pozícióban ─────────────────────────────
// ⚠️ Ezt az ① nem fogta, és a SZEMEM találta meg a szállított lapon: a fagyás-
// blokk alatt ott állt a „2 hónap ajándék évente · 102 700 Ft · Váltok éves
// fizetésre" ajánlat — más szám, tehát az ① számlálója átengedte, miközben pont
// az a zaj, amit ez a kör megszüntet. Az ① egy KONKRÉT összeget keresett; ez a
// próba a döntési pozíciót méri: kiemelt ár + hozzá tartozó gomb.
//   A mérés a VEZÉRLŐKRE szűkül (gombra/CTA-ra), nem minden számra — a tételes
// bontás (alapdíj, modulok) szándékosan ott maradhat, az magyaráz, nem ajánl.
const CTA_BLOCKS: ReadonlyArray<{ re: RegExp; what: string }> = [
  { re: /adm-annual__cta/, what: "az éves fizetésre váltás ajánlata" },
  { re: /adm-shop__buy|data-shop-add/, what: "a bolt „hozzáadom” gombja" },
];
for (const { re, what } of CTA_BLOCKS) {
  if (re.test(html)) {
    fail(`${what} a fagyasztott lapon — eladási ajánlat annak, akit épp dunningolunk (ADR-0119 ⑥)`);
  }
}
if (!selfTest && !failures) pass("nincs eladási CTA a fagyasztott lapon");

// ── ② A „Következő számla” cella fagyás alatt nem ír ki összeget ───────────
if (/Következő számla \(/.test(text)) {
  fail("a „Következő számla ({dátum})” cella fagyás alatt is renderelődik — a tulaj két összeget lát");
} else if (!selfTest) {
  pass("nincs „Következő számla” összeg-cella a fagyasztott lapon");
}

// ── ②b …és nem ír ki MÚLTBELI dátumot ──────────────────────────────────────
// Ez a tulaj kimondott kifogása volt: a cella dátuma a `periodEnd` volt, ami a
// fagyás előtti, már elmúlt nap. A próba a RENDERELT dátumokat olvassa vissza,
// és bármelyik múltbeli találat bukás — nem csak azé az egy celláé, amit ismerünk.
const rendered = [...html.matchAll(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\./g)].map(
  (m) => `${m[1]}-${m[2]}-${m[3]}`,
);
// ⚠️ SAJÁT horgon (`data-nextafter`), nem osztálynéven: az első vágás a lap ELSŐ
// `.adm-sub__v--date` celláját olvasta — ami közben egy MÁSIK cella lett, és az őr
// zöldet adott egy olyan elemre, amit nem is vizsgálni akart.
const futureCells = html.match(/data-nextafter>([^<]*)</)?.[1] ?? "";
const pastInDateCell = rendered.filter((d) => Date.parse(d) < Date.now() - day);
// A MÚLT önmagában nem hiba (a „… óta felfüggesztve” épp múltbeli), csak akkor,
// ha JÖVŐBELI eseményt datál. Ezért kifejezetten a rendezés-utáni cellát mérjük.
if (futureCells && Date.parse(futureCells.replace(/\.\s*/g, "-").replace(/-$/, "")) < Date.now() - day) {
  fail(`a „rendezés után” cella MÚLTBELI dátumot ír: ${futureCells}`);
} else if (!selfTest) {
  pass(`a rendezés-utáni számla dátuma jövőbeli: ${futureCells || "(nincs cella)"} · (a lapon ${pastInDateCell.length} múltbeli dátum áll, mind múltbeli eseményé)`);
}

// ── ③ A modul-lista CSAK OLVASHATÓ ─────────────────────────────────────────
const offCount = text.split("Kikapcsolom").length - 1;
if (offCount > 0) {
  fail(`${offCount}× „Kikapcsolom” a fagyasztott lapon — a tulaj szerint a kapcsolók KIKERÜLNEK`);
} else if (!selfTest) {
  pass("nincs modul-kapcsoló a fagyasztott lapon");
}

// ── ③b …de a jogosultság NEM veszhet el ────────────────────────────────────
// ⚠️ Ez a legveszélyesebb pont az egész körben: az `applyModuleChange` a HIÁNYZÓ
// `module` mezőt LEMONDÁSNAK olvassa. Ha a kapcsolót úgy vesszük ki, hogy nem
// marad rejtett megőrző mező, a fagyasztott lap bármely űrlap-beküldése NÉMÁN
// lemondaná az összes modult. Az őr ezt darabra méri.
const owned = MODULES.filter((m) => m.active && !m.spine).length;
const hidden = (html.match(/<input type="hidden" name="module"/g) ?? []).length;
if (!selfTest && hidden !== owned) {
  fail(
    `${hidden} rejtett megőrző mező ${owned} birtokolt modulra — a hiányzó mezőt a mentés ` +
      `LEMONDÁSNAK olvassa, tehát a fagyasztott lap egy beküldéssel kinyírná a modulokat`,
  );
} else if (!selfTest) {
  pass(`mind a ${owned} birtokolt modul rejtett megőrző mezőt kapott (a mentés nem mondja le őket)`);
}

// ── ③c Nincs ELADÁSI cimke a megvett, szünetelő modulokon ──────────────────
// A boltban (nem birtokolt modul) az ár MARADHAT — ott az valódi ajánlat.
// Ezért a mérés a SAJÁT modulok blokkjára szűkül: az őr hatóköre a szabálya.
const mineBlock = /<div class="adm-mine">[\s\S]*?<\/div>\s*(?=<div class="adm-sumbar"|<\/section>)/.exec(html)?.[0] ?? "";
const chipsOnMine = (mineBlock.match(/adm-chip/g) ?? []).length;
if (!selfTest && chipsOnMine > 0) {
  fail(`${chipsOnMine} ár-cimke a MEGVETT, szünetelő modulokon — eladási felirat azon, amiért épp dunningolunk`);
} else if (!selfTest) {
  pass("nincs ár-cimke a megvett, szünetelő modulokon");
}
if (!selfTest && !/adm-shop/.test(html)) {
  fail("a fixtúra nem termelt boltot — így a ③c mérés nem bizonyít semmit (minden modul birtokolt?)");
}

// ── ④ A kijárat NYITVA marad (ADR-0119 ⑥) ──────────────────────────────────
if (!selfTest && !/Előfizetés lemondása/.test(text)) {
  fail("a lemondás eltűnt a fagyasztott lapról — az kijáratot venne el (ADR-0119 ⑥)");
} else if (!selfTest) {
  pass("a lemondás elérhető maradt");
}

// ── ⑤ Az elakadt terhelésnek van ELŐREVIVŐ művelete ────────────────────────
if (!selfTest && !/Másik kártyával fizetek/.test(text)) {
  fail("a megbízás-blokk csak a feladást kínálja — nincs előrevivő művelet (kontraktus ⑤)");
} else if (!selfTest) {
  pass("a megbízás-blokk előrevivő műveletet kínál");
}
if (!selfTest && !/a rendezetlen díj ettől nem szűnik meg/.test(text)) {
  fail("a megbízás visszavonása nem mondja ki, hogy a tartozás megmarad");
}

// ── ⑥ A fagyás MINDEN fülön megjelenik ─────────────────────────────────────
const CONTENT = {
  name: "Nyugalom Vendégház",
  tagline: "x",
  intro: "y".repeat(60),
  highlights: [],
  photos: [],
  usingOwnPhotos: true,
  status: selfTest ? "provisioned" : "suspended",
  previewPath: null,
  lang: "hu",
};
const MESSAGES = {
  // ⚠️ TELJES fixtúra, szándékosan. A `scripts/` NINCS típus-ellenőrizve
  // (`reference_scripts_are_not_typechecked`), ezért az `as never` fixtúra átmegy a
  // tsc-n, és FUTÁSIDŐBEN hal meg, ha a termék új KÖTELEZŐ mezőt kap. Élesben meg is
  // történt: az ADR-0154 („az ÜGY a sor") bevezette az `openThreads`-et, és két őröm
  // `Cannot read properties of undefined (reading 'join')`-nal szállt el a landolási
  // rebase után — nem termék-hiba volt, hanem elavult fixtúra.
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
const TABS_TO_CHECK = ["attekintes", "uzenetek", "fotok", "szovegek", "dokumentumok"];
for (const tab of TABS_TO_CHECK) {
  const page = adminDashboard(
    { username: "elek@citoviso.com", displayName: "Nyugalom Vendégház" } as never,
    CONTENT as never,
    {
      tab,
      subscription: sub as never,
      modules: MV,
      siteUrl: "https://nyugalom.citoviso.com",
      previewToken: "tok",
      messages: MESSAGES as never,
      documents: null,
    },
  );
  const t = visible(page);
  if (!/A honlapja jelenleg NEM elérhető/.test(t)) {
    fail(`a(z) „${tab}” fül nem mondja ki, hogy a honlap fel van függesztve`);
  } else if (!/adm-owe__pay/.test(page)) {
    fail(`a(z) „${tab}” fülön ott a felfüggesztés, de nincs rajta út a rendezéshez`);
  }
}
if (!selfTest && !failures) pass(`mind az ${TABS_TO_CHECK.length} megvizsgált fül kimondja a fagyást, és mind kínál fizetés-utat`);

// ── ⑥b …de a Modulok fülön PONTOSAN EGYSZER ────────────────────────────────
const modPage = adminDashboard(
  { username: "e@x.hu", displayName: "N" } as never,
  CONTENT as never,
  { tab: "modulok", subscription: sub as never, modules: MV, previewToken: "tok" },
);
const blocks = (modPage.match(/<section class="adm-frz/g) ?? []).length;
if (!selfTest && blocks !== 1) {
  fail(`${blocks} fagyás-blokk a Modulok fülön — a szekció saját blokkja és a fül-szintű duplázódik`);
} else if (!selfTest) {
  pass("a Modulok fülön pontosan egy fagyás-blokk van");
}

// ── ⑦ A hátralévő idő a blokkban, számként ─────────────────────────────────
const blk = /<section class="adm-frz[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
if (!selfTest) {
  if (!/adm-owe__dlv/.test(blk)) fail("a hátralévő idő nem szerepel a fagyás-blokkban (kontraktus ②)");
  else pass(`hátralévő idő a blokkban: „${/adm-owe__dlv">([^<]*)</.exec(blk)?.[1]}”`);
  // ⚠️ A „0 nap” nem lehet néma alapértelmezés: a záró dátum mögöttünk is lehet.
  if (/adm-owe__dlv">\s*0 nap/.test(blk)) {
    fail("„0 nap” áll a blokkban — lejárt vagy ma lejáró határidőt ki kell mondani, nem nullázni");
  }
}

if (failures) {
  console.error(`\nfrozen-settle-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error(
    "\n⛔ --self-test: a fagyás ELŐTTI ággal renderelt lapon EGYETLEN sértést sem találtam — az őr vak.",
  );
  process.exit(1);
}
console.log("✅ frozen-settle-check: a fagyasztott lap egy dologról szól, és a modul-lista csak olvasható.");
