// FROZEN-ENTRY guard — a felfüggesztés a BELÉPŐ képernyőn is látszik, és a
// teendő a TULAJÉ, nem a miénk.
//
//   npx tsx scripts/frozen-entry-check.mts [--self-test]
//
// Miért kellett HARMADIK őr az ADR-0119 mellé (mérve 2026-09-14, renderelt lapon):
//   A ⑦ (`frozen-state-check`) és a ⑧ (`frozen-claim-check`) is a `modulesSection()`
//   kimenetén mér — vagyis a 13 fülből EGYEN. A tulaj viszont nem oda lép be:
//   a `adminDashboard` alapértelmezett füle az `attekintes`. Teljes fagyás alatt
//   ezen a lapon MÉRVE: 0× „Rendezendő tartozás", 0× az összeg, 0× fizetés-gomb —
//   és a „Teendők" lista egyetlen nyitott tétele ez volt:
//
//       „Az oldal még nem publikus — a Citoviso élesíti, amint minden készen áll"
//
//   Ez nem hiányzó tény, hanem ROSSZ tény, és a MI javunkra rossz: az okot ránk
//   hárítja, a tulajnak pedig nem hagy tennivalót azon az egy képernyőn, ahol az
//   egyetlen igaz válasz az, hogy „fizessen, és azonnal visszakapcsol" (§B.17).
//   Az ADR-0119 ① tiltása („a »nincs teendője« felfüggesztés alatt TILOS") tehát
//   ERRE A FÜLRE is szól — csak eddig SENKI nem mérte.
//
// Az őr ezért a TELJES `adminDashboard()`-ot rendereli, fülről fülre, egy
// felfüggesztett site + fagyasztott előfizetés párossal. Hermetikus: nincs DB,
// nincs szerver, fut friss klónon és pre-commitban is.
//
// ⛔ AMIT EZ AZ ŐR NEM BIZONYÍT (kimondva, hogy ne olvasódjon „megoldva"-ként):
//   a lap SZÖVEGÉT méri, nem az ELSŐ FESTÉS láthatóságát. Mérve 2026-09-14,
//   390×844-en: a lenti, javított teendő-sor y=730..878 közt áll, a fix alsó
//   fülsáv (`.adm-side`, mobilon `position:fixed;bottom:0`) pedig y=658-tól —
//   vagyis elsőre A SÁV ALATT van, és csak görgetés után olvasható
//   (`elementFromPoint` a sor közepén `.adm-nav`-ot ad). Takarva NINCS
//   (`.adm-main__inner` 208px alsó padingja kigörgethetővé teszi), de LÁTHATÓ
//   SEM. Hogy a fagyás-állapot HOL és MEKKORA súllyal jelenjen meg a belépő
//   lapon, az TERVEZŐI döntés — a §2b terv-kapunál van, nem itt.
//
// --self-test a fixtúrát arra az állapotra fordítja, amit az őrnek EL KELL utasítania
// (a fagyás előtti szöveggel renderelt felfüggesztett lap) — egy őr, amit sosem láttunk
// pirosan, nem bizonyíték (feedback_fixture_must_prove_its_own_path).

import { adminDashboard } from "../src/server/adminViews.js";

const selfTest = process.argv.includes("--self-test");

/** A lap LÁTHATÓ szövege — a script/style törzse ELŐBB kimegy, különben a
 *  progresszív JS által beállított feliratok „megjelenő szövegként" ütnének vissza
 *  (ugyanaz a csapda, amit a frozen-state-check 2026-09-13-án megmért). */
function visible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

/** A „Teendők" lista nyers HTML-je — az `<li class="done|pending">` jelölés is kell,
 *  mert a „kipipálva" és a „nyitva" két KÜLÖNBÖZŐ állítás ugyanarról a sorról. */
function todoList(html: string): string {
  return /<ul class="adm-todo">[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "";
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ⛔ ${msg}`);
};

// ── fixtúra ────────────────────────────────────────────────────────────────
// A dátumok a létra valós sorrendjét követik: a periódus VÉGE (= a dunningolt
// ciklus kezdete) ELŐBB van, mint a fagyás napja — ezért írhat ma a lap egy
// MÚLTBELI napra „Következő számlá"-t.
const SUB = {
  status: "frozen",
  periodEnd: "2026-08-10",
  renewDay: 10,
  nextInvoiceTotal: 10270,
  nextInvoiceItems: [],
  payUrl: "https://example.invalid/pay",
  arrears: { amount: 10270, periodStart: "2026-08-10", periodEnd: "2026-09-10" },
  closesOn: "2026-09-09",
  frozenOn: "2026-08-20",
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 102700,
  annualSavings: 20540,
  annualFreeMonths: 2,
  autoCharge: true,
  coupon: null,
};

const MODULES = [
  ["gallery", "Képek a szállásról", true],
  ["rooms", "Szobák, apartmanok", true],
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
}));

const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: 5860 };

// ⚠️ A `status` a SITE állapota (payment/billing.ts:584 állítja 'suspended'-re a
// fagyáskor) — a `--self-test` ezt fordítja vissza 'provisioned'-re, vagyis a
// felfüggesztett fiókot a fagyás ELŐTTI ág szövegével rendereli. Pontosan azt az
// állapotot állítja elő, amit 2026-09-14-én a valódi lapon mértem.
const CONTENT = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a Zselic szélén",
  intro: "A Nyugalom Vendégház a Zselic peremén, erdő szélén várja a pihenni vágyókat.",
  highlights: [],
  photos: [],
  usingOwnPhotos: true,
  status: selfTest ? "provisioned" : "suspended",
  previewPath: null,
  lang: "hu",
};

const SESSION = { username: "elek@citoviso.com", displayName: "Nyugalom Vendégház" };

const MESSAGES = {
  messages: [],
  unread: 0,
  topic: "mind",
  channel: "",
  unreadOnly: false,
  q: "",
  topicCounts: {},
  channelCounts: {},
  total: 0,
};

/** Az a fül, amire a tulaj BELÉP (adminDashboard alapértelmezése). Üres `tab`-bal
 *  kérjük, hogy az őr az ALAPÉRTELMEZÉST mérje, ne egy általunk beírt nevet: ha a
 *  belépő fül egyszer megváltozik, az őr magától arra fordul. */
function render(tab?: string): string {
  return adminDashboard(SESSION as never, CONTENT as never, {
    tab,
    subscription: SUB as never,
    modules: MV as never,
    siteUrl: "https://nyugalom.citoviso.com",
    previewToken: "tok",
    messages: MESSAGES as never,
  });
}

console.log(
  selfTest
    ? "frozen-entry-check --self-test: a felfüggesztett fiókot a fagyás ELŐTTI szöveggel rendereljük — mindennek pirosnak kell lennie"
    : "frozen-entry-check: a belépő képernyő egy felfüggesztett fiókkal",
);

const entryHtml = render(); // no tab → the landing tab, whatever it is
const entryText = visible(entryHtml);
const entryTodo = visible(todoList(entryHtml));

// ── ① A teendő a TULAJÉ ────────────────────────────────────────────────────
// Nem egyetlen tű: a fizetés-cselekvés bármelyik megfogalmazása megteszi, tehát a
// szöveg átírható anélkül, hogy az őr elavulna — de eltüntetni nem lehet.
const OWNER_ACTION = ["rendezze a díjat", "befizet", "díj rendezése", "kiegyenlít", "fizesse"];
if (!OWNER_ACTION.some((n) => entryTodo.toLowerCase().includes(n))) {
  fail(
    "a belépő lap „Teendők" +
      '" listája nem nevezi meg a tulaj egyetlen valódi teendőjét (a díj rendezését) — ' +
      `a lista ma ezt mondja: „${entryTodo.trim().slice(0, 200)}"`,
  );
}

// ── ② …és nem a MIÉNK ──────────────────────────────────────────────────────
// Aktor-áthárító fordulatok halmaza, nem egy mondat pillanatképe: bármelyik azt
// üzeni, hogy a tulajnak várnia kell, miközben fizetnie kellene.
const BLAME_SHIFT: ReadonlyArray<{ needle: string; why: string }> = [
  { needle: "a Citoviso élesíti", why: "a fagyást NEM mi oldjuk fel — a befizetés oldja fel" },
  { needle: "amint minden készen áll", why: "minden készen áll: egyedül a díj hiányzik" },
  { needle: "hamarosan elérhető", why: "magától nem lesz elérhető, fizetés kell hozzá" },
  { needle: "dolgozunk rajta", why: "nincs mit dolgoznunk rajta — a labda a tulajnál van" },
];
for (const { needle, why } of BLAME_SHIFT) {
  const n = entryText.split(needle).length - 1;
  if (n > 0) fail(`${n}× „${needle}” a felfüggesztett fiók belépő lapján — ${why}`);
}

// ── ③ A felfüggesztést KI IS MONDJA a belépő lap ────────────────────────────
// (Ez a javítás előtt is zöld volt — az állapot-csempe kiírta. Azért van itt, hogy
// egy későbbi átrendezés ne tudja NÉMÁN elvinni, ami ma megvan.)
if (!/[Ff]elfüggeszt/.test(entryText)) {
  fail("a belépő lap sehol nem mondja ki, hogy a honlap fel van függesztve");
}

// ── ④ Egy KIPIPÁLT teendő nem állíthatja, hogy az oldal élő ────────────────
const doneItems = (todoList(entryHtml).match(/<li class="done">[\s\S]*?<\/li>/g) ?? []).map(visible);
for (const li of doneItems) {
  if (/élő|nyilvános|elérhető/.test(li)) {
    fail(`kipipált teendő élő oldalt állít a felfüggesztés alatt: „${li.trim().slice(0, 120)}”`);
  }
}

// ── ⑤ Kettős tagadás egy visszafordíthatatlan gomb fölött ──────────────────
// Szerkezeti próba, nem egy mondat pillanatképe: a magyar „X NÉLKÜL SEM Y"
// fordulat két tagadást tesz egy állítás elé. A lemondás-zóna szövege ilyen volt
// (Elek FK-006a) — közvetlenül az előfizetést lezáró gomb fölött.
const doubleNegation = (text: string): string | null =>
  /[^.]*\bnélkül\s+se[m]?\b[^.]*\./.exec(text)?.[0]?.trim() ?? null;

const modulesText = visible(render("modulok"));
const dn = doubleNegation(modulesText);
if (dn) fail(`kettős tagadás a felfüggesztett lapon: „${dn.slice(0, 160)}”`);

// ⚠️ A `--self-test` a SITE-státuszt billenti, az ⑤ ága viszont az ELŐFIZETÉS
// állapotán ül — vagyis a fenti sor az öntesztben sem sülne el, és egy néma,
// sosem-tüzelt detektort kapnánk (feedback_guard_greenly_defended_the_bug).
// Ezért a detektort a SAJÁT bemenetén is megszólaltatjuk: az a mondat, ami
// 2026-09-13-ig élesben állt, és egy olyan, ami helyes — mindkét irányban.
if (selfTest) {
  const HISTORICAL_BAD =
    "A honlap jelenleg fel van függesztve. Lemondás esetén a rendezetlen díj " +
    "kiegyenlítése nélkül sem kapcsol vissza, és az előfizetés lezárul.";
  const CONTROL_OK = "Visszakapcsolni a rendezetlen díj befizetésével tud.";
  if (!doubleNegation(HISTORICAL_BAD)) {
    fail("⑤ detektor: a 2026-09-13-ig élt, kettős tagadású mondatot NEM ismeri fel — vak");
  } else {
    console.log("  ✔ ⑤ detektor tüzel a történeti rossz mondatra");
  }
  if (doubleNegation(CONTROL_OK)) {
    fail("⑤ detektor: a HELYES mondatra is elsül — álpozitív, minden commitot megölne");
  } else {
    console.log("  ✔ ⑤ detektor hallgat a helyes mondatra (nincs álpozitív)");
  }
}

// ── ⑥ A belépő lapról EL KELL JUTNI a tartozáshoz ──────────────────────────
// A pontos hely (melyik fül, melyik kártya) TERVEZŐI kérdés — az viszont nem,
// hogy legyen út: link nélkül a „rendezze a díjat" csak egy jámbor óhaj.
if (!/href="\/admin\?tab=modulok"/.test(todoList(entryHtml))) {
  fail("a belépő lap teendő-sora nem visz el oda, ahol a tartozás rendezhető");
}

if (failures) {
  console.error(`\nfrozen-entry-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error(
    "\n⛔ --self-test: a romlott állapotra EGYETLEN sértést sem találtam — az őr vak. " +
      "Egy zöld önteszt itt nem siker, hanem a bizonyíték hiánya.",
  );
  process.exit(1);
}
console.log("✅ frozen-entry-check: a belépő lap kimondja a felfüggesztést, és a tulajra bízza a teendőt.");
