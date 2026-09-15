// CHARGE-RETRY-NOTE guard — a visszajelzés ne IRÁNYT mondjon, hanem VIGYEN.
//
//   npx tsx scripts/charge-retry-note-check.mts [--self-test]
//
// Mérve 2026-09-15 a renderelt tulaj-admin lapon: a kézi terhelés-újrapróba
// visszajelző sávja NÉGY ágon „a fenti gombbal" fordulattal küldött, miközben a
// hivatkozott gombok MIND LEJJEBB álltak (a sáv a 6 660. bájtnál, a gombok a
// 10 200–10 800. bájtnál), a redirect pedig fragmentet sem vitt — a tulaj tehát a
// lap TETEJÉRE érkezett, és telefonon fölfelé kereste azt, ami alatta volt.
//   ⛔ És a baj nem csak az irány volt. A „nincs_kartya" ág pontosan akkor áll elő,
// amikor `payment_method !== 'token'` — ami BITRE ugyanaz a predikátum, mint az
// `autoCharge` —, tehát ilyenkor a „Másik kártyával fizetek" gomb MEG SEM JELENIK:
// a sáv egy NEM LÉTEZŐ kijáratra küldött (`feedback_label_must_derive_from_predicate`).
//
// Ez az őr ÖT állítást mér, mindet a RENDERELT lapon — mert a mondatokat külön
// ágak építik külön fájlokban, és egy forrás-grep nem tudja megmondani, melyik
// melyikkel jelenik meg EGYÜTT:
//
//   ① IRÁNY-TILALOM. Sem a sáv, sem a mandátum-blokk nem küldhet fel/le mutató
//      szóval. Az irány a képernyő-magasságtól függ, a NÉV nem (tulajdonosi szabály,
//      2026-09-15). Ez fogta meg az ÖTÖDIK „fenti"-t is, a blokk saját szövegében.
//   ② A MEGNEVEZETT KIJÁRAT LÉTEZZEN. Amit a sáv idéz vagy linkel, annak VALÓDI,
//      kattintható vezérlőként ott kell lennie a lapon — vagy a sávnak egyáltalán nem
//      szabad kijáratot ígérnie. (`feedback_gate_measured_text_not_its_source`: a
//      szöveget a FORRÁSÁHOZ mérjük, nem önmagához.)
//   ③ A SÁV VIGYE IS A TETTET — de csak a TÁVOLIT. Ahol a mandátum-blokk „Másik
//      kártyával fizetek" gombja a lapon van (~1 200 px-szel lejjebb), ott a sávban
//      álljon kattintható elem valódi `href`-fel. A fagyás-blokk befizetés-gombja
//      ezzel szemben 390px-en mérve a sávval EGY képernyőn van — azt nem duplázzuk.
//   ④ A HORGONY CÉLJA LÉTEZZEN, és teendő-mentes ágon ne is legyen horgony.
//   ⑤ A SÁV NE ISMÉTELJE MEG A TARTOZÁS ÖSSZEGÉT. Ezt egy IDEGEN őr
//      (`frozen-settle-check`) mérte ki: az összeg a jóváhagyott kontraktus szerint
//      csak a fagyás-blokkban állhat, különben úgy néz ki, mintha kétszer kellene
//      fizetni. Az idegen őr fixtúrájában nincs `?ujra=` kód, tehát erre az ágra
//      sosem látna rá (`feedback_restructure_blinds_a_foreign_guard`).
//
// HERMETIKUS: se DB, se szerver, se hálózat — az `adminDashboard()` kézzel épített
// fixtúrát kap, így friss klónon és pre-commitban is fut, a KÖZÖS teszt-park nélkül.
//
// --self-test: a mérendő lapot VISSZARONTVA rendereljük (a javítás előtti szöveggel
// és egy nem létező gombra mutató kijárattal). Egy őr, amit sosem láttunk pirosan,
// nem bizonyíték (`feedback_fixture_must_prove_its_own_path`).

import { adminDashboard, chargeRetryAnchor } from "../src/server/adminViews.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import type { TenantModuleView } from "../src/tenant/modules.js";

const selfTest = process.argv.includes("--self-test");

/** Fel/le mutató szavak. ⚠️ Nem `\b`-vel: a JS szóhatára csak ASCII-t ismer, ezért
 *  egy magyar szó elején az ékezet előtt NINCS határ (ADR-0157 mért hibája — három
 *  szabály halott volt tőle). Ezért nyers illesztés, kisbetűsített szövegen. */
const DIRECTION_WORDS = [
  "fenti", "fentebb", "feljebb", "odafent", "a fent ", "fent lév",
  "lenti", "lentebb", "lejjebb", "odalent", "a lent ", "lent lév",
  "alábbi", "alább", "az alanti",
] as const;

/** A lap VALÓDI, kattintható vezérlői — felirat szerint. A sáv csak ezekre küldhet. */
const REAL_CONTROLS = /<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi;

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
  ["booking", "Online foglalás", true],
  ["reviews", "Vendégek véleménye", false],
].map(([id, label, active]) => ({
  id, label, group: "offer", active,
  spine: false, priceMonthly: 690, cancelAtPeriodEnd: false,
  awaitingFirstCharge: false, supersededBy: null, publicDesc: null,
})) as unknown as TenantModuleView["modules"];

const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: 6950 } as unknown as TenantModuleView;

function sub(over: Record<string, unknown> = {}): SubscriptionAdminData {
  return {
    status: "frozen", periodEnd: "2031-09-10", renewDay: 10,
    nextInvoiceTotal: 99900, nextInvoiceItems: [],
    payUrl: "https://example.invalid/pay",
    arrears: { amount: 99900, periodStart: "2031-09-10", periodEnd: "2032-09-10" },
    closesOn: "2031-10-10", frozenOn: "2031-09-20", restoredOn: null,
    cancelAtPeriodEnd: false, billingPeriod: "annual", pendingAnnual: false,
    pendingEffectiveDate: null, annualTotal: 99900, annualSavings: 19980,
    annualFreeMonths: 2, autoCharge: true, coupon: null, ...over,
  } as unknown as SubscriptionAdminData;
}

const session = { tenantId: "t1", username: "elek@citoviso.com", displayName: "Teszt Szállás" } as never;
const content = { lang: "hu", status: "suspended" } as never;

/**
 * A mérendő esetek. ⚠️ A FIXTÚRA ÁLLAPOTA NEM TETSZŐLEGES: a szerver-oldali
 * visszautasítás előfeltételét tükrözi, különben olyan párosítást mérnénk, ami
 * élesben elő sem fordul (`feedback_debug_flag_manufactured_a_false_failure`).
 *   · nincs_kartya  → `payment_method !== 'token'`, tehát `autoCharge:false`
 *   · nincs_tartozas→ csak `frozen`/`past_due` alatt van mit beszedni, tehát aktív
 *   · t_paid        → a terhelés sikerült, a honlap visszakapcsolt
 * A többi ág valódi fagyás, tárolt kártyával.
 */
const CASES: ReadonlyArray<{ code: string; tab: string; s: SubscriptionAdminData; why: string }> = [
  { code: "t_paid", tab: "modulok", s: sub({ status: "active", restoredOn: "2031-09-21" }), why: "sikeres terhelés" },
  { code: "t_pending", tab: "modulok", s: sub(), why: "a bank még nem válaszolt" },
  { code: "t_failed", tab: "modulok", s: sub(), why: "a bank elutasította" },
  { code: "varakozas", tab: "modulok", s: sub(), why: "türelmi idő" },
  { code: "sorozat_vege", tab: "modulok", s: sub(), why: "elfogyott a sorozat" },
  { code: "nincs_kartya", tab: "modulok", s: sub({ autoCharge: false }), why: "nincs tárolt kártya" },
  { code: "nincs_tartozas", tab: "modulok", s: sub({ status: "active", arrears: null }), why: "nincs tartozás" },
  { code: "ismeretlen_kod", tab: "modulok", s: sub(), why: "ismeretlen kód → alapértelmezett ág" },
  // ⚠️ A `?ujra=` MINDEN fülön olvasódik (public.ts), a két kártya-gomb viszont CSAK
  // a Modulok fülön él. Ha ez a sor kimarad, az őr némán vak arra az esetre, amikor a
  // sáv olyan gombot nevezne meg, ami ezen a fülön nincs is a lapon.
  { code: "t_failed", tab: "uzenetek", s: sub(), why: "más fül — ott csak a befizetés-gomb van" },
  { code: "sorozat_vege", tab: "dokumentumok", s: sub(), why: "más fül — ott csak a befizetés-gomb van" },
];

let failures = 0;
/** Melyik szabály szólalt meg — az önteszt ezen méri, hogy MINDEGYIK tud pirosra menni. */
const fired = new Set<string>();
const fail = (rule: string, msg: string) => {
  failures++;
  fired.add(rule);
  console.error(`  ⛔ [${rule}] ${msg}`);
};

console.log(
  selfTest
    ? "charge-retry-note-check --self-test: VISSZARONTOTT lapot mérünk — MIND AZ ÖT szabálynak pirosnak kell lennie"
    : "charge-retry-note-check: a kézi terhelés-újrapróba visszajelzése a renderelt tulaj-admin lapon",
);

/** A visszarontás: a javítás ELŐTTI irány-szavas szöveg + egy nem létező kijárat. */
function regress(html: string): string {
  return html
    .replace(
      /Próbálja meg később, vagy fizessen másik kártyával:/g,
      "Próbálja meg később, vagy fizessen másik kártyával a fenti gombbal.",
    )
    .replace(/A díjat így tudja rendezni:/g, "A fenti fizetési linken tud fizetni.")
    .replace(/a díjat így tudja rendezni:/g, "a fenti fizetési linken tud fizetni.")
    .replace(/addig itt tud fizetni:/g, "addig a fenti gombbal tud fizetni.")
    // a mai (link nélküli) közeli-kijárat mondatok történeti, irány-szavas alakja
    .replace(/a díjat bankkártyával rendezheti\./g, "a fenti fizetési linken tud fizetni.")
    .replace(/rendezze a díjat bankkártyával\./g, "fizessen a fenti gombbal.")
    .replace(/A díjat másik bankkártyával rendezheti\./g, "Fizessen másik kártyával a fenti gombbal.")
    // ⑤ visszarontása: a tartozás összege bekerül a sáv szövegébe is
    .replace(/(NEM vontunk le semmit)/g, "$1 a 99 900 Ft-ból")
    // ④ visszarontása: a horgony célja eltűnik a lapról
    .replace(/ id="terheles-uzenet"/g, ' data-volt-horgony="terheles-uzenet"')
    // ② visszarontása: a kijárat olyan feliratot visel, ami sehol nem áll gombként.
    .replace(/(class="[^"]*adm-banner__go[^"]*"[^>]*>)[^<]*(<\/a>)/g, "$1Rendezés a pénztárban ▸$2")
    // ③ visszarontása: a kattintható elem href nélkül marad.
    .replace(/(<a class="[^"]*adm-banner__go[^"]*")\s+href="[^"]*"/g, "$1");
}

for (const { code, tab, s, why } of CASES) {
  let html = adminDashboard(session, content, {
    tab, modules: MV, subscription: s, chargeRetry: code, supportEmail: "elek@citoviso.com",
  });
  if (selfTest) html = regress(html);

  const label = `${code} @${tab} (${why})`;

  // A sáv kivágása. ⚠️ A `.adm-saved` is sáv (a sikeres ág azt használja), különben
  // az egyik ág NÉMÁN kimaradna a mérésből.
  const m = selfTest
    ? /<div (?:id|data-volt-horgony)="terheles-uzenet"[\s\S]*?<\/div>\s*(?=<)/.exec(html)
    : /<div id="terheles-uzenet"[\s\S]*?<\/div>\s*(?=<)/.exec(html);
  const noteHtml = m?.[0] ?? "";
  if (!noteHtml) {
    fail("0", `${label}: nincs visszajelző sáv a lapon — a tulaj nem tudja meg, mi történt`);
    continue;
  }
  const noteText = stripTags(noteHtml).toLowerCase();

  // ── ① IRÁNY-TILALOM (a sávban ÉS a mandátum-blokkban) ─────────────────────
  const mand = /<div class="adm-mand">[\s\S]*?<\/div><\/div>/.exec(html)?.[0] ?? "";
  for (const [zone, text] of [["sáv", noteText], ["mandátum-blokk", stripTags(mand).toLowerCase()]] as const) {
    for (const w of DIRECTION_WORDS) {
      if (text.includes(w)) {
        fail(
          "①",
          `${label}: a ${zone} „${w}" irány-szóval küld — az irány a képernyő-magasságtól függ, ` +
            `a NÉV nem. Nevezd meg a gombot (és vidd is oda).`,
        );
      }
    }
  }

  // ── ② A MEGNEVEZETT KIJÁRAT LÉTEZZEN ──────────────────────────────────────
  // A lapon VALÓDI vezérlőként álló feliratok — a sávon KÍVÜLRŐL gyűjtve, hogy a
  // sáv ne igazolhassa saját magát (`feedback_guard_must_not_borrow_its_subject`).
  const outside = html.replace(noteHtml, " ");
  const controls = new Set<string>();
  for (const mm of outside.matchAll(REAL_CONTROLS)) {
    const t = stripTags(mm[2] ?? "");
    if (t) controls.add(t);
  }
  // Amit a sáv IDÉZ („…") vagy LINKEL.
  const quoted = [...noteHtml.matchAll(/„([^”]{3,80})”/g)].map((x) => x[1]!.trim());
  const linked = [...noteHtml.matchAll(/class="[^"]*adm-banner__go[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((x) =>
    stripTags(x[1] ?? "").replace(/\s*▸\s*$/, "").trim(),
  );
  for (const name of [...quoted, ...linked]) {
    const exists = [...controls].some((c) => c === name || c.replace(/\s*▸\s*$/, "") === name);
    if (!exists) {
      fail(
        "②",
        `${label}: a sáv a „${name}" kijáratot ígéri, de a lapon NINCS ilyen gomb/link. ` +
          `Valódi vezérlők: ${[...controls].slice(0, 8).join(" · ") || "(egy sem)"}`,
      );
    }
  }

  // ── ③ A SÁV VIGYE IS A TETTET ─────────────────────────────────────────────
  // Ahol a lapon van járható fizetési út, ott a sáv ne csak beszéljen róla.
  // ⚠️ A TÁVOLI út a mérce, nem „bármilyen fizetés-gomb". 390px-en mérve a fagyás-blokk
  // befizetés-gombja a sávval EGY képernyőn van (a sáv teteje y=16, a gomb ugyanott
  // látszik) — azt nem kell megduplázni, sőt TILOS is (⑤: vinné az összeget). A
  // mandátum-blokk „Másik kártyával fizetek" gombja viszont ~1 200 px-szel lejjebb ül:
  // EZT kell a sávnak magával hoznia, különben az üzenet a görgetés szerencséjén múlik.
  const farExit = [...controls].some((c) => c === "Másik kártyával fizetek");
  const payControl = farExit || [...controls].some((c) => /Befizetem|Díj rendezése/.test(c));
  const go = /<a class="[^"]*adm-banner__go[^"]*"([^>]*)>/.exec(noteHtml);
  const noAction = code === "t_paid" || code === "t_pending" || code === "nincs_tartozas";
  if (farExit && !noAction) {
    if (!go) {
      fail(
        "③",
        `${label}: a lapon a „Másik kártyával fizetek" ~1 200 px-szel lejjebb ül, és a sávban ` +
          `NINCS kattintható kijárat — a tulajnak oda kell görgetnie.`,
      );
    } else if (!/href="[^"]+"/.test(go[1] ?? "")) {
      fail("③", `${label}: a sáv kijárata href nélküli — halott gomb, ami kattinthatónak látszik.`);
    }
  }
  if (!payControl && go) {
    fail("③", `${label}: a sáv kijáratot kínál, miközben a lapon egyetlen fizetési vezérlő sincs.`);
  }
  // A közeli út nem maradhat MEGEMLÍTETLENÜL sem: ha van hova fizetni, a sáv ne
  // küldje a tulajt e-mailt írni (`feedback_gate_must_not_refuse_the_paying_customer`).
  if (payControl && !noAction && /írjon nekünk\.$/i.test(stripTags(noteHtml).trim()) && !go) {
    fail("③", `${label}: van élő fizetési út a lapon, a sáv mégis CSAK az e-mailt ajánlja fel.`);
  }

  // ── ⑤ A SÁV NE ISMÉTELJE MEG A TARTOZÁS ÖSSZEGÉT ──────────────────────────
  // ⚠️ Ezt egy IDEGEN őr (`frozen-settle-check`) mérte ki rajtam: a jóváhagyott
  // „B — Rendezés-képernyő" kontraktus szerint a tartozás összege CSAK a fagyás-
  // blokkban állhat (a nagy szám + a gomb felirata), mert egy harmadik előfordulás
  // más felirat alatt azt kelti, hogy KÉTSZER kell fizetni. Az első javításom a
  // befizetés-gombot nevezte meg a sávban — a felirat viszont viszi az összeget, és
  // 2-ről 3-ra vitte az előfordulásokat.
  //   ⛔ Az idegen őr fixtúrájában NINCS `?ujra=` kód, tehát erre az ágra SOHA nem
  // látna rá (`feedback_restructure_blinds_a_foreign_guard`) — ezért áll a szabály ITT.
  if (s.arrears) {
    const amount = String((s.arrears as { amount: number }).amount);
    const grouped = new RegExp(amount.replace(/(\d)(?=(\d{3})+$)/g, "$1\\s?"));
    if (grouped.test(stripTags(noteHtml))) {
      fail(
        "⑤",
        `${label}: a sáv MEGISMÉTLI a tartozás összegét (${amount}) — a kontraktus szerint az ` +
          `csak a fagyás-blokkban állhat, különben úgy néz ki, mintha kétszer kellene fizetni.`,
      );
    }
  }

  // ── ④ A HORGONY CÉLJA LÉTEZZEN ────────────────────────────────────────────
  const frag = chargeRetryAnchor(code);
  if (frag && !html.includes(`id="${frag.slice(1)}"`)) {
    fail("④", `${label}: a redirect a ${frag} horgonyra visz, de az az elem nincs a lapon.`);
  }
  if (!frag && !noAction) {
    fail("④", `${label}: nincs teendő-mentes ág, mégsem kap horgonyt — a tulaj a lap tetején keresgél.`);
  }
}

// ── NEGATÍV KONTROLL: a TÖRTÉNETI hibát is elkapja-e? ───────────────────────
// ⚠️ A fenti önteszt a SAJÁT szintetikus visszarontásomat méri. Az viszont nem
// bizonyítja, hogy a szabály a VALÓDI hibaosztályra köt — egy őr, ami csak a maga
// kitalált sértését ismeri fel, zölden védheti a bejelentett hibát
// (`feedback_guard_greenly_defended_the_bug`).
//   A történeti hiba konkrét: a „nincs_kartya" ág a „Másik kártyával fizetek"
// gombra küldött, miközben `autoCharge:false` mellett az a gomb MEG SEM JELENIK a
// lapon. Ezt itt SZÁNDÉKOSAN előállítjuk, és megköveteljük, hogy a ② szabály
// megszólaljon rá. Ha nem szólal meg, az őr maga a hiba.
{
  const page = adminDashboard(session, content, {
    tab: "modulok", modules: MV, subscription: sub({ autoCharge: false }),
    chargeRetry: "nincs_kartya", supportEmail: "elek@citoviso.com",
  });
  const noteHtml = /<div id="terheles-uzenet"[\s\S]*?<\/div>\s*(?=<)/.exec(page)?.[0] ?? "";
  // A történeti kijárat BEINJEKTÁLÁSA ebbe a sávba. ⚠️ Nem cserével: a javítás óta
  // ezen az ágon szándékosan NINCS kijárat-link (az a tartozás összegét vinné a sávba,
  // ⑤), tehát egy `replace` üresen futna — és a negatív kontroll NÉMÁN semmit sem
  // bizonyítana. Ezt a saját utó-feltételem fogta meg, miután a ③ szabályt átírtam.
  const historic = noteHtml.replace(
    /<\/div>\s*$/,
    `<a class="citui-btn adm-banner__go" href="https://example.invalid/pay">Másik kártyával fizetek ▸</a></div>`,
  );
  const outside = page.replace(noteHtml, " ");
  const controls = new Set<string>();
  for (const mm of outside.matchAll(REAL_CONTROLS)) {
    const t = stripTags(mm[2] ?? "");
    if (t) controls.add(t);
  }
  const named = stripTags(
    /class="[^"]*adm-banner__go[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(historic)?.[1] ?? "",
  ).replace(/\s*▸\s*$/, "").trim();
  const wouldFire = named !== "" && ![...controls].some((c) => c === named);
  if (!wouldFire) {
    console.error(
      `  ⛔ NEGATÍV KONTROLL BUKÁS: a történeti hibát („${named}" a nincs_kartya ágon) az őr ` +
        `NEM ismerné fel — vagy a sáv-kivágás avult el, vagy a vezérlő-gyűjtés lát valamit, ` +
        `ami nincs a lapon. Ez az őr így zölden védené a bejelentett hibát.`,
    );
    failures++;
  } else if (!selfTest) {
    console.log(
      `  ✓ negatív kontroll: a „${named}" a nincs_kartya ágon VALÓBAN nem létező gomb — a ② szabály rálát.`,
    );
  }
}

// ── UTÓ-FELTÉTEL: mérte-e egyáltalán, amit mérni küldtük? ────────────────────
// `feedback_narrow_recognizer_is_a_false_green`: egy szűk felismerő NÉMÁN kihagy,
// és a zöld összesítő elfedi. Ha a sáv-kivágó regex elavul (osztálynév-csere), a
// ciklus minden ágon `continue`-zna, és 0 bukással ZÖLDET adna.
const measured = CASES.length;
if (measured < 10) {
  console.error(`  ⛔ csak ${measured} esetet mértünk — a lefedettség ROMLOTT, nézd meg a CASES listát`);
  failures++;
}

if (selfTest) {
  if (failures === 0) {
    console.error(
      "\n❌ ÖNTESZT-BUKÁS: a visszarontott lapon EGYETLEN szabály sem szólalt meg — " +
        "ez az őr nem tud pirosra menni, tehát nem bizonyít semmit.",
    );
    process.exit(1);
  }
  // ⛔ Nem elég, hogy „valami" pirosra ment: ha egy szabály SOHA nem szólal meg, akkor
  // az halott, és a zöld összesítő elfedi (ADR-0157: minden osztály viseljen saját
  // bizonyító esetet). Az összevont darabszám pont ezt tudja eltakarni.
  const MUST = ["①", "②", "③", "④", "⑤"];
  const dead = MUST.filter((r) => !fired.has(r));
  if (dead.length) {
    console.error(
      `\n❌ ÖNTESZT-BUKÁS: ${dead.join(", ")} szabály NEM szólalt meg a visszarontott lapon — ` +
        `halott szabály, amit a ${failures} sértés összesítője elfedne.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✅ önteszt: ${failures} sértés a visszarontott lapon, és MIND AZ ÖT szabály (${MUST.join(", ")}) ` +
      `bizonyítottan pirosra tud menni.`,
  );
  process.exit(0);
}

if (failures) {
  console.error(`\n❌ charge-retry-note-check: ${failures} sértés.`);
  process.exit(1);
}
console.log(`✅ charge-retry-note-check: ${measured} eset — irány-szó nincs, minden megnevezett kijárat létezik, és a sáv oda is visz.`);
