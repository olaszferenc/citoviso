// DECLINED-MANDATE-NOTE guard — az elutasított kártyaterhelés sávja.
//
//   npx tsx scripts/declined-mandate-note-check.mts [--self-test]
//
// MIT VÉD (tulajdonosi döntés, 2026-09-22). A tárolt kártya-megbízás terhelése
// elbukhat (fedezethiány, lejárt kártya, visszavont token). Addig a szerver
// ilyenkor AZONNAL a pay-linkre irányított — ami ÉLESBEN a gateway saját lapja
// (`barion.ts` → secure.barion.com), ahol egy szavunk sincs. A tulaj tehát azt
// olvasta, hogy „a kártyáját 4 900 Ft-tal terheljük", rákattintott, és egy idegen
// fizetőoldalon találta magát — sosem tudva meg, hogy épp a KÁRTYÁJA bukott el.
// ⚠️ Helyesbítve 2026-09-23: a dev is a Barion SANDBOXOT futtatja (`.env`
// PAYMENT_GATEWAY=barion), tehát lokálban is reprodukálható volt — csak senki nem
// futtatott elutasított MIT-et. E2E-próba: PAYMENT_GATEWAY=mock + MOCK_RECURRING_FAIL=1.
//   Ma a szerver a Modulok fülön áll meg, és ez a sáv mondja ki, mi történt.
//
// ⚠️ MIÉRT KÜLÖN ŐR, amikor a `charge-retry-note-check` ugyanezt a lapot méri:
// annak a fixtúrája a `?ujra=` kódokra van kalibrálva, erre az ágra RÁ SEM LÁT —
// zölden. Egy szomszédos őr zöldje nem a te állításodról szól
// (`feedback_narrow_recognizer_is_a_false_green`).
//
// HÉT állítás, mind a RENDERELT lapon — mert a mondatokat külön ágak építik, és
// forrás-grep nem mondja meg, melyik melyikkel jelenik meg EGYÜTT:
//
//   ① A SÁV MEGSZÓLAL. Elutasított terhelés után a lapon ott a figyelmeztető sáv,
//      `role="alert"`-tel. Némán elnyelt bukás = a tulaj nem tudja, hogy nincs meg,
//      amit venni akart (`feedback_silenced_failure_costs_hours`).
//   ② NEM ÁLLÍT BEKAPCSOLÁST. A sáv nem mondhatja, hogy a modul él vagy hogy
//      megterheltük — a fizetős add ilyenkor SEMMIT nem írt a DB-be
//      (`moduleChange.ts`: „Pay-pending adds change nothing yet").
//      ⛔ És a zöld „Kész." sáv sem állhat mellette: két ellentétes ítélet egy
//      képernyőn (`feedback_one_rule_two_copies`).
//   ③ IRÁNY-TILALOM. Se „fenti", se „alábbi" — az irány a képernyő-magasságtól
//      függ, a NÉV nem (tulajdonosi szabály, 2026-09-15).
//   ④ A KIJÁRAT VALÓDI. Van pay-link → a sávban kattintható `<a href>` áll, PONT
//      arra az URL-re. Nincs pay-link → a sáv NEM ígér gombot. Egy nem létező
//      kiútra küldeni rosszabb, mint hallgatni
//      (`feedback_label_must_derive_from_predicate`).
//   ⑤ A LEMONDÁS SORSA KIMONDVA. Vegyes beküldésnél (lemondás + fizetős vétel) a
//      lemondás MEGTÖRTÉNT, a vétel nem. Ha ezt a sáv elhallgatja, a tulaj egy
//      „cserének" szánt lépés után csak a vesztes felét látja.
//   ⑥ NINCS ÖSSZEG a sávban. A jóváhagyott kontraktus szerint a szám EGY helyen
//      állhat; egy második előfordulás úgy olvasódik, mintha kétszer kellene
//      fizetni (ezt egy IDEGEN őr, a `frozen-settle-check` mérte ki annak idején).
//   ⑦ A SÁV LÁTSZIK IS. ⛔ Ezt a KÉP mérte ki, nem a kód (2026-09-22, `ui-shot
//      --fold`, 390 ÉS 1280 px): fragment nélkül a redirect a lap TETEJÉRE érkezik,
//      ahol az Előfizetés-kártya áll, a sáv pedig a hajtás ALATT marad — a tulaj egy
//      változatlannak látszó lapra kerül vissza, és a bukás ugyanolyan néma, mint a
//      gateway-re dobás volt. Két lábon mérve, mert külön-külön mindkettő hamis
//      zöldet adna: a horgony-CÉL a nézetben, a rá MUTATÓ fragment a route-ban.
//
// HERMETIKUS: se DB, se szerver, se hálózat — az `adminDashboard()` kézzel épített
// fixtúrát kap, így friss klónon és pre-commitban is fut, a KÖZÖS teszt-park nélkül.
//
// --self-test: a MÉRENDŐ LAPOT rontjuk vissza (nem a terméket), és elvárjuk, hogy
// MINDEGYIK szabály pirosra tudjon menni. Egy őr, ami sosem bukik, nem őr
// (`feedback_guard_greenly_defended_the_bug`).

import { readFileSync } from "node:fs";

import { adminDashboard, DECLINED_NOTE_ANCHOR as ANCHOR } from "../src/server/adminViews.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const selfTest = process.argv.includes("--self-test");

const DIRECTION_WORDS = [
  "fenti", "fentebb", "feljebb", "odafent", "a fent ", "fent lév",
  "lenti", "lentebb", "lejjebb", "odalent", "a lent ", "lent lév",
  "alábbi", "alább", "az alanti",
] as const;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── fixtúra ──────────────────────────────────────────────────────────────────
const MODULES = [
  ["gallery", "Képek a szállásról", true],
  ["booking", "Online foglalás", false],
  ["reviews", "Vendégek véleménye", true],
].map(([id, label, active]) => ({
  id, label, group: "offer", active,
  spine: false, priceMonthly: 690, cancelAtPeriodEnd: false,
  awaitingFirstCharge: false, supersededBy: null, publicDesc: null,
})) as unknown as TenantModuleView["modules"];

const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: 6950 } as unknown as TenantModuleView;

const SUB = {
  status: "active", periodEnd: "2031-09-10", renewDay: 10,
  nextInvoiceTotal: 6950, nextInvoiceItems: [], payUrl: null, arrears: null,
  closesOn: null, frozenOn: null, restoredOn: null, cancelAtPeriodEnd: false,
  billingPeriod: "monthly", pendingAnnual: false, pendingEffectiveDate: null,
  annualTotal: 69500, annualSavings: 13900, annualFreeMonths: 2,
  autoCharge: true, coupon: null,
} as unknown as SubscriptionAdminData;

const session = { tenantId: "t1", username: "elek@citoviso.com", displayName: "Teszt Szállás" } as never;
const content = { lang: "hu", status: "live" } as never;

/** A gateway saját lapja — ÉLESBEN ilyet kap a pay-link (barion.ts). */
const PAY_URL = "https://secure.barion.invalid/Pay?Id=abc123";

/**
 * A mérendő esetek. ⚠️ A fixtúra állapota nem tetszőleges: azt tükrözi, amit a
 * szerver `payfail=1` ága TÉNYLEGESEN átad (`public.ts`) — a fizetős modul ilyenkor
 * NEM kerül az `added` listába, mert a DB-be sem került be
 * (`feedback_debug_flag_manufactured_a_false_failure`).
 */
const CASES: ReadonlyArray<{
  name: string;
  applied: Record<string, unknown>;
  why: string;
}> = [
  {
    name: "sima_bukas",
    applied: { added: [], cancelled: [], other: [], payFailedModules: ["booking"], payFailedUrl: PAY_URL },
    why: "egy fizetős modul, elutasított kártya",
  },
  {
    name: "vegyes_bukas",
    applied: { added: [], cancelled: ["reviews"], other: [], payFailedModules: ["booking"], payFailedUrl: PAY_URL },
    why: "csere: a lemondás átment, a vétel nem",
  },
  {
    name: "nincs_paylink",
    applied: { added: [], cancelled: [], other: [], payFailedModules: ["booking"], payFailedUrl: null },
    why: "a pay-link sem készült el — kijáratot ígérni tilos",
  },
];

let failures = 0;
const fired = new Set<string>();
const fail = (rule: string, msg: string) => {
  failures++;
  fired.add(rule);
  console.error(`  ⛔ [${rule}] ${msg}`);
};

console.log(
  selfTest
    ? "declined-mandate-note-check --self-test: VISSZARONTOTT lapot mérünk — MIND A HÉT szabálynak pirosnak kell lennie"
    : "declined-mandate-note-check: az elutasított kártyaterhelés sávja a renderelt tulaj-admin lapon",
);

/**
 * A visszarontás a MÉRENDŐ LAPON — ⚠️ SZABÁLYONKÉNT EGY, sosem mind egyszerre.
 *
 * ⛔ Az első változatom mind a hatot egyszerre rontotta, és az önteszt kimutatta,
 * hogy ez HASZNÁLHATATLAN: az ① rontása (nincs sáv) `continue`-val elvágta a
 * mérést, így ②–⑥ sosem futott le, és „vaknak" látszott — pedig csak nem jutott
 * hozzájuk vezérlés. Egy önteszt, ami a saját rontásán bukik el, nem a terméket
 * méri (`feedback_debug_flag_manufactured_a_false_failure`).
 */
function regress(html: string, rule: string): string {
  switch (rule) {
    case "①": // a sáv riasztó jellege eltűnik
      return html.replace(/role="alert"/g, 'role="presentation"');
    case "②": // a sáv bekapcsolást állít — az ellenkezőjét a ténynek
      return html.replace(/Ezért nem kapcsoltuk be/g, "Mostantól él, és megterheltük — ");
    case "③": // irány-szó a kijárat neve helyett
      return html.replace(/Fizetés kézzel/g, "Fizetés a fenti gombbal");
    case "④": // a kattintható kijárat href nélkül marad
      return html.replace(/(<a class="citui-btn citui-btn--primary")\s+href="[^"]*"/g, "$1");
    case "⑤": // a lemondás sorsa eltűnik
      return html.replace(/ — a lemondása viszont érvénybe lépett\./g, ".");
    case "⑥": // összeg kerül a sávba
      return html.replace(/és terhelés sem történt/g, "és terhelés sem történt a 4 900 Ft-ból");
    case "⑦": // a sáv elveszti a horgony-cél szerepét
      return html.replace(new RegExp(`id="${ANCHOR}"`, "g"), 'data-volt-horgony="1"');
    default:
      return html;
  }
}

let measured = 0;

/** Egy eset teljes mérése. `regressRule`: melyik szabályt rontsuk vissza (önteszt). */
function measureCase(
  { name, applied, why }: (typeof CASES)[number],
  regressRule: string | null,
): void {
  let html = adminDashboard(session, content, {
    tab: "modulok",
    modules: MV,
    subscription: SUB,
    moduleApplied: applied,
    supportEmail: "elek@citoviso.com",
  } as never);
  if (regressRule) html = regress(html, regressRule);
  measured++;

  const label = regressRule ? `${name} [visszarontva: ${regressRule}]` : `${name} (${why})`;

  // A sáv kivágása. A piros ág `role="alert"`-et visel — ez EGYBEN az ① állítás.
  // ⚠️ Az attribútum-SORREND nem rögzített (az `id` a `class` elé került, amikor a
  // sáv horgony-céllá vált), ezért a felismerő sorrend-független — különben az őr
  // a saját termékén menne vakra (`feedback_narrow_recognizer_is_a_false_green`).
  const m = /<div [^>]*class="adm-applied"[^>]*role="alert"[\s\S]*?<\/div>\s*(?=<)/.exec(html);
  const noteHtml = m?.[0] ?? "";
  if (!noteHtml) {
    fail("①", `${label}: nincs figyelmeztető sáv a lapon — a bukás némán elnyelődik`);
    return;
  }
  const noteText = stripTags(noteHtml);
  const lower = noteText.toLowerCase();

  // ── ② NEM ÁLLÍT BEKAPCSOLÁST ──────────────────────────────────────────────
  for (const claim of ["mostantól él", "megterheltük", "bekapcsoltuk a", "sikeres"]) {
    if (lower.includes(claim)) {
      fail(
        "②",
        `${label}: a sáv „${claim}" fordulatot visel, pedig a vásárlás NEM jött létre ` +
          `(a fizetős add semmit nem írt a DB-be) — a mondat az ellenkezőjét állítja a ténynek`,
      );
    }
  }
  // A zöld „Kész." sáv nem állhat mellette.
  if (/<div class="adm-applied" role="status"/.test(html)) {
    fail(
      "②",
      `${label}: a zöld „Kész." sáv EGYÜTT jelenik meg a bukás-sávval — ` +
        `két ellentétes ítélet egy képernyőn`,
    );
  }

  // ── ③ IRÁNY-TILALOM ───────────────────────────────────────────────────────
  for (const w of DIRECTION_WORDS) {
    if (lower.includes(w)) {
      fail("③", `${label}: a sáv „${w}" irány-szóval küld — nevezd meg a kijáratot, ne az irányt`);
    }
  }

  // ── ④ A KIJÁRAT VALÓDI ────────────────────────────────────────────────────
  const anchor = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(noteHtml);
  const promisesExit = /fizet/i.test(noteText);
  if (applied.payFailedUrl) {
    if (!anchor) {
      fail(
        "④",
        `${label}: van kiadott pay-link, de a sávban nincs kattintható elem valódi href-fel — ` +
          `a sáv IRÁNYT mondana a TETT helyett`,
      );
    } else if (anchor[1] !== applied.payFailedUrl) {
      fail(
        "④",
        `${label}: a sáv máshová visz (${anchor[1]}), mint a kiadott pay-link (${String(applied.payFailedUrl)})`,
      );
    }
  } else if (anchor && promisesExit) {
    fail(
      "④",
      `${label}: nincs kiadott pay-link, a sáv mégis fizetési kijáratot kínál (${anchor[1]}) — ` +
        `nem létező kiútra küld`,
    );
  }

  // ── ⑤ A LEMONDÁS SORSA KIMONDVA ───────────────────────────────────────────
  const cancelled = (applied.cancelled as string[]) ?? [];
  if (cancelled.length && !/lemondás/i.test(noteText)) {
    fail(
      "⑤",
      `${label}: ugyanabban a beküldésben lemondás is történt (és ÁTMENT), de a sáv hallgat róla — ` +
        `a tulaj a „cserének" szánt lépés után csak a vesztes felét látja`,
    );
  }

  // ── ⑦ A SÁV HORGONY-CÉL, ÉS A REDIRECT ODA IS VISZ ────────────────────────
  // ⛔ Ezt a KÉP mérte ki, nem a kód (2026-09-22, `ui-shot --fold`, 390 ÉS 1280 px):
  // fragment nélkül a redirect a lap tetejére érkezik, a sáv pedig a hajtás alatt
  // marad — a bukás ugyanolyan néma, mint a gateway-re dobás volt. Két lábon áll,
  // mert külön-külön mindkettő hamis zöldet adna: a horgony-cél a NÉZETBEN, a rá
  // mutató fragment a ROUTE-ban (`feedback_restructure_blinds_a_foreign_guard`).
  if (!new RegExp(`id="${ANCHOR}"`).test(noteHtml)) {
    fail(
      "⑦",
      `${label}: a sáv nem horgony-cél (id="${ANCHOR}") — a redirect a lap tetejére érkezik, ` +
        `az üzenet a hajtás alatt marad, és a tulaj sosem látja meg`,
    );
  }

  // ── ⑥ NINCS ÖSSZEG A SÁVBAN ───────────────────────────────────────────────
  if (/\d[\d\s ]*Ft/.test(noteText)) {
    fail(
      "⑥",
      `${label}: a sáv összeget ír ki — a szám a jóváhagyott kontraktus szerint EGY helyen állhat, ` +
        `különben úgy olvasódik, mintha kétszer kellene fizetni`,
    );
  }
}

// Éles mérés: minden eset, rontás nélkül. Öntesztben: szabályonként KÜLÖN kör, hogy
// egy rontás ne takarja el a többi szabályt.
if (selfTest) {
  for (const rule of ["①", "②", "③", "④", "⑤", "⑥", "⑦"]) {
    // ⑤-öt csak az az eset tudja megszólaltatni, amelyikben VAN lemondás; ④-et csak
    // az, amelyikben van pay-link. A rossz esetre kötött rontás egy ÉP szabályt
    // mutatna vaknak (`feedback_debug_flag_manufactured_a_false_failure`).
    const cases =
      rule === "⑤"
        ? CASES.filter((c) => ((c.applied.cancelled as string[]) ?? []).length > 0)
        : rule === "④"
          ? CASES.filter((c) => !!c.applied.payFailedUrl)
          : CASES;
    for (const c of cases) measureCase(c, rule);
  }
} else {
  for (const c of CASES) measureCase(c, null);
}

// ── ⑦ MÁSODIK LÁB: a ROUTE odavisz-e ─────────────────────────────────────────
// A nézet-oldali `id` önmagában hamis zöld: horgony-cél, amire senki nem mutat.
// A `payfail=1` redirectnek a fragmentet is vinnie kell. Forrás-állítás, mert a
// POST-handler nem hívható ki hermetikusan — de a NEGATÍV kontroll itt is jár:
// ha a redirect-sort nem találjuk meg, az MAGA a bukás, nem néma átugrás
// (`feedback_narrow_recognizer_is_a_false_green`).
if (!selfTest) {
  const routeSrc = readFileSync(new URL("../src/server/public.ts", import.meta.url), "utf8");
  // ⚠️ A redirect TÖBB template-literálból áll (`…payfail=1…` + `…#${ANCHOR}`), ezért
  // egyetlen backtick-párra illeszteni nem lehet: az első változatom pont a fragmentet
  // vágta le, és a hiányára bukott — a SAJÁT helyes kódomon.
  let anchored = 0;
  let idx = routeSrc.indexOf("payfail=1");
  if (idx < 0) {
    fail(
      "⑦",
      "a `payfail=1` redirect nem található a route-ban — vagy átnevezték, vagy elveszett; " +
        "így az őr némán vak lenne arra, hogy a tulaj hova érkezik",
    );
  }
  while (idx >= 0) {
    // A redirect-hívás vége: a lezáró `);` az első pont, ameddig az URL épül.
    const tail = routeSrc.slice(idx, routeSrc.indexOf(");", idx) + 2);
    if (tail.includes("DECLINED_NOTE_ANCHOR") || tail.includes(`#${ANCHOR}`)) anchored++;
    else {
      fail(
        "⑦",
        `a redirect fragment nélkül küld — a tulaj a lap tetejére érkezik, a sáv a hajtás ` +
          `alatt marad. A hívás: ${tail.replace(/\s+/g, " ").slice(0, 120)}`,
      );
    }
    idx = routeSrc.indexOf("payfail=1", idx + 1);
  }
  // ⛔ A pipa CSAK akkor jár, ha tényleg minden ág horgonyoz. Az első változatom a
  // bukás MELLÉ írta ki a zöld sort (`feedback_recorded_failure_must_not_grade_green`).
  if (anchored && !fired.has("⑦")) {
    console.log(`  ✓ ⑦ második láb: a route mind a(z) ${anchored} payfail-redirectje a sávra horgonyoz.`);
  }
}

// ── negatív kontroll: a mérés lát-e egyáltalán? ───────────────────────────────
// Elutasítás NÉLKÜL a sávnak NEM szabad megjelennie. Enélkül az őr zölden átmenne
// egy olyan lapon is, ami MINDIG kiírja a bukást (`feedback_guard_greenly_defended_the_bug`).
if (!selfTest) {
  const cleanHtml = adminDashboard(session, content, {
    tab: "modulok",
    modules: MV,
    subscription: SUB,
    moduleApplied: { added: ["gallery"], cancelled: [], other: [] },
    supportEmail: "elek@citoviso.com",
  } as never);
  const stray = /<div class="adm-applied"[^>]*role="alert"[\s\S]*?nem sikerült megterhelni/.test(cleanHtml);
  if (stray) {
    fail("kontroll", "sikeres módosítás után is megjelenik a bukás-sáv — a sáv nem a bukásra reagál");
  } else {
    console.log("  ✓ negatív kontroll: bukás nélkül a sáv NEM jelenik meg — a mérés a tényre reagál.");
  }
}

if (selfTest) {
  const expected = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];
  const missing = expected.filter((r) => !fired.has(r));
  if (missing.length) {
    console.error(
      `\n❌ declined-mandate-note-check --self-test: ${missing.join(", ")} NEM tudott pirosra menni — ` +
        `ezek a szabályok vakok, a zöldjük semmit nem bizonyít.`,
    );
    process.exit(1);
  }
  console.log(`\n✅ declined-mandate-note-check --self-test: mind a hét szabály pirosra ment (${failures} sértés).`);
  process.exit(0);
}

if (failures) {
  console.error(`\n❌ declined-mandate-note-check: ${failures} sértés.`);
  process.exit(1);
}
console.log(
  `✅ declined-mandate-note-check: ${measured} eset — a bukás kimondva, kijárat valódi, ` +
    `lemondás sorsa közölve, összeg és irány-szó nincs.`,
);
