// COUPON-VISIBLE guard — a kapott kedvezmény LÁTSZIK, és közben egy fillér sem mozdul.
//
//   npx tsx scripts/coupon-visible-check.mts [--self-test]
//
// A MÉRT LELET (2026-09-21): a tulaj 14 775 Ft-ot fizetett három modulért, és nem tudta
// eldönteni, jó-e a szám („nekem kevésnek tűnik"). Jó volt: 19 700 Ft-os díj, 25 %-os
// üdvözlő kupon. De ezt egyik képernyő sem mondta ki — sem a visszaigazoló sáv, sem a
// számla —, pedig a `list_price` és az `offer.percent` ott van a rendelésben. Ha a TULAJ
// nem tudja ellenőrizni a saját terhelését, a vevő végképp nem.
//
// ⛔ A LEGFONTOSABB ÁLLÍTÁS NEM A SZÖVEG, HANEM A PÉNZ: a Számlázz.hu a tételeket
// ÖSSZEADJA, ezért egy külön „−4 925 Ft" kedvezmény-sor a 14 775 Ft-os végösszeget
// 9 850-re vinné — vagyis a láthatóvá tételből rosszul számlázás lenne. Az őr ezért
// minden esetben visszaméri, hogy a tételek összege PONTOSAN a terhelt összeg maradt.
//
// HERMETIKUS: se DB, se szerver, se hálózat.
//
// --self-test: a sávot és a számlát VISSZARONTVA mérjük (kedvezmény elhallgatva, vesszős
// felsorolás, és egy kedvezmény-SOR, ami elviszi a végösszeget). Egy őr, amit sosem
// láttunk pirosan, nem bizonyíték.

import { adminDashboard, type ModuleAppliedFlash } from "../src/server/adminViews.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import { buildInvoiceItems, invoiceComment } from "../src/payment/service.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import { MODULE_CATALOG } from "../src/modules.js";

const selfTest = process.argv.includes("--self-test");
let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "  ✅" : "  ❌"} ${label}${extra ? ` — ${extra}` : ""}`);
};
const strip = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
   .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ── a mért vásárlás ──────────────────────────────────────────────────────────
const LIST = 19700, PAID = 14775, PCT = 25, MODS = ["pricing", "poi", "booking"];

type Mod = TenantModuleView["modules"][number];
const mod = (id: string): Mod =>
  ({
    id,
    // A név a KATALÓGUSBÓL — kézzel gépelve az őr a saját feltevését igazolná vissza.
    label: MODULE_CATALOG.find((c) => c.id === id)!.publicLabel,
    group: "offer", active: true, spine: false, priceMonthly: 490,
    cancelAtPeriodEnd: false, awaitingFirstCharge: false, supersededBy: null, publicDesc: "",
  }) as unknown as Mod;
const MV = { modules: MODS.map(mod), baseMonthly: 3900, totalMonthly: 9000 } as unknown as TenantModuleView;
const session = { tenantId: "t1", username: "e@x.hu", displayName: "Teszt" } as never;
const content = { lang: "hu", status: "live", usingOwnPhotos: true, intro: "x".repeat(60) } as never;

/**
 * A sáv kivágása a PÁROSÍTOTT záró tagig.
 *
 * ⛔ NEM non-greedy regexszel (`[\s\S]*?</div>`): a sáv mostantól beágyazott `<div>`-eket
 * tartalmaz (a nyugta-levezetést), és a lusta illesztés az ELSŐ belső `</div>`-nél megáll.
 * Mérve: az őr így a sáv törzsét levágta, és HIBÁTLAN kódra jelentett négy bukást
 * (2026-09-22). Egy mérőeszköz, ami a mért dolgot csonkolja, nem mér semmit.
 */
function sliceElement(html: string, startMarker: string): string {
  const from = html.indexOf(startMarker);
  if (from < 0) return "";
  let depth = 0;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = from;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index + m[0].length);
  }
  return html.slice(from);
}

// ── az előfizetés — a „Következő számla" tételei ─────────────────────────────
// A megújítás-mondat a KÖVETKEZŐ SZÁMLÁBÓL számol (2026-09-28, Myrna Haus: „4 620 Ft/év"
// egy HAVI fiókon, ahol a 4 620 az időarányos díj volt). A fixtúrán a számlán egy
// NEM-most-vett modul is áll, hogy a mondat ne a teljes számlát írja ki.
const priceOf = (id: string) => MODULE_CATALOG.find((c) => c.id === id)!.priceMonthly;
const EXTRA = MODULE_CATALOG.find((c) => c.priceMonthly > 0 && !MODS.includes(c.id))!;
const ITEMS = [...MODS, EXTRA.id].map((id) => ({
  id, label: MODULE_CATALOG.find((c) => c.id === id)!.publicLabel, price: priceOf(id), isNew: MODS.includes(id),
}));
const FREE = 2;
const mkSub = (period: "monthly" | "annual", pendingAnnual = false): SubscriptionAdminData => {
  const total = ITEMS.reduce((s, i) => s + i.price, 3900);
  return {
    status: "active", periodEnd: "2026-10-28", renewDay: 28,
    nextInvoiceTotal: total, nextInvoiceItems: ITEMS, payUrl: null, arrears: null,
    closesOn: "2026-11-27", frozenOn: null, restoredOn: null, settled: null, cancelAtPeriodEnd: false,
    billingPeriod: period, pendingAnnual, pendingEffectiveDate: pendingAnnual ? "2026-10-28" : null,
    annualTotal: total * (12 - FREE), annualSavings: total * FREE, annualFreeMonths: FREE,
    autoCharge: false, coupon: null,
  } as unknown as SubscriptionAdminData;
};
const MONTHLY = mkSub("monthly");

const page = (flash: ModuleAppliedFlash, sub: SubscriptionAdminData | null = MONTHLY): string =>
  adminDashboard(session, content, {
    tab: "modulok", modules: MV, moduleApplied: flash, supportEmail: "e@x.hu", subscription: sub,
  });
const banner = (flash: ModuleAppliedFlash, sub: SubscriptionAdminData | null = MONTHLY): string => {
  const cut = sliceElement(page(flash, sub), '<div class="adm-applied"');
  if (!cut) throw new Error("nincs .adm-applied sáv a lapon — a fixtúra nem azt méri, amit hisz");
  return cut;
};

// ── ① A SÁV, kuponnal ────────────────────────────────────────────────────────
console.log("\n── A visszaigazoló sáv, kuponnal");
let withCoupon = banner({
  added: [], cancelled: [], other: [], charged: MODS,
  chargedAmount: PAID, chargedListPrice: LIST, chargedOfferPercent: PCT,
});
if (selfTest) {
  // Visszarontás: a kedvezmény elhallgatva, és a felsorolás újra vesszős.
  withCoupon = withCoupon
    .replace(/<div class="adm-rcpt">[\s\S]*?<\/div>\s*<span class="adm-rcpt__note">[\s\S]*?<\/span>/, "")
    .replace(/ · /g, ", ");
}
const wcText = strip(withCoupon);
ok("a levezetés kiírja a teljes díjat", wcText.includes("19 700"), wcText.slice(0, 120));
ok("kiírja a kedvezmény ÖSSZEGÉT", wcText.includes("4 925"));
ok("kiírja a kedvezmény SZÁZALÉKÁT", /25\s*%/.test(wcText));
ok("kiírja a terhelt összeget", wcText.includes("14 775"));
ok("figyelmeztet a megújítás árára", /megújítás/.test(wcText) && /adm-rcpt__note/.test(withCoupon));
// ⛔ A modulnevek MAGUK is vesszősek, ezért a vesszős felsorolás ÖT tételnek olvasódik
// három helyett — pont így nézett ki a tulaj képernyője, miközben a számla „3 modul"-t írt.
ok("a modulokat NEM vessző választja el", wcText.includes("·"), "elválasztó");

// ── ② A SÁV, kupon nélkül ────────────────────────────────────────────────────
console.log("\n── A visszaigazoló sáv, kupon NÉLKÜL");
const noCoupon = strip(banner({
  added: [], cancelled: [], other: [], charged: MODS, chargedAmount: LIST,
}));
ok("nincs kedvezmény-szó", !/kedvezmény/i.test(noCoupon), noCoupon.slice(0, 110));
ok("nincs „−0 Ft” levezetés", !/−0|- 0 Ft/.test(noCoupon));
ok("a terhelt összeg megvan", noCoupon.includes("19 700"));

// ── ②b A MEGÚJÍTÁS-MONDAT = a következő számla megfelelő sorai ────────────────
// ⛔ MÉRT HIBA (2026-09-28): „a következő megújításkor 4 620 Ft/év" egy HAVI fiókon —
// az időarányos díj, beégetett „/év"-vel. A mondat összegét a RENDERELT „A következő
// számla tételei" sorokból mérjük vissza (a most vett modulok sorai × a számla szorzója),
// nem a fixtúrából: így a mondat és a számla csak EGYÜTT lehet igaz.
console.log("\n── A megújítás-mondat a következő számla soraiból, a fiók ütemében");
const huNum = (t: string) => Number(t.replace(/[^\d]/g, ""));
const labelIds = new Map(ITEMS.map((i) => [i.label, i.id]));
const renewCase = (name: string, sub: SubscriptionAdminData, unit: "/hó" | "/év") => {
  let html = page({
    added: [], cancelled: [], other: [], charged: MODS,
    chargedAmount: PAID, chargedListPrice: LIST, chargedOfferPercent: PCT,
  }, sub);
  if (selfTest && unit === "/hó") {
    // Visszarontás: a régi mondat — az időarányos listaár, beégetett „/év"-vel.
    html = html.replace(/(<span class="adm-rcpt__note"[^>]*>)[\s\S]*?(<\/span>)/,
      `$1A kedvezmény egyszeri — a következő megújításkor ${LIST.toLocaleString("hu-HU")} Ft/év díjjal szerepelnek a számlán.$2`);
  }
  const note = strip(/<span class="adm-rcpt__note"[^>]*>[\s\S]*?<\/span>/.exec(html)?.[0] ?? "");
  const said = huNum(/megújításkor (.+?) Ft\//.exec(note)?.[1] ?? "");
  // A számla renderelt sorai: címke → ár.
  const items = /<details class="adm-sub__items"[^>]*>([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  let rows = 0;
  for (const m of items.matchAll(/<div class="adm-sub__row"><span>([\s\S]*?)<\/span><b>([^<]+)<\/b><\/div>/g)) {
    const label = strip(m[1]!).replace(/\s*·\s*új$/, "");
    if (MODS.includes(labelIds.get(label) ?? "")) rows += huNum(m[2]!);
  }
  const mult = /éves díj = (\d+) havi díj/.exec(strip(items))?.[1];
  const want = rows * (mult ? Number(mult) : 1);
  console.log(`   ${name}: „${note}"`);
  ok(`${name}: a mondat a fiók ütemében szól (${unit})`, note.includes(`Ft${unit}`) && !note.includes(unit === "/hó" ? "/év" : "/hó"));
  ok(`${name}: a mondat összege = a következő számla megfelelő sorai`, rows > 0 && said === want, `${said} Ft (a számla sorai: ${want} Ft)`);
  // Csak ott értelmes, ahol a kettő különbözik: a fixtúra 19 700-as listaára épp a három
  // modul ÉVES díja (1 970 × 10), tehát éves fiókon a helyes szám véletlenül egyezik vele.
  if (want !== LIST) ok(`${name}: NEM az időarányos listaárat mondja`, said !== LIST);
};
renewCase("havi fiók", MONTHLY, "/hó");
renewCase("éves fiók", mkSub("annual"), "/év");
renewCase("havi fiók, éves váltás élesítve", mkSub("monthly", true), "/év");
{
  // Ha a most vett modul nincs a következő számlán, a mondat hallgat — nem ígér számot.
  const none = banner({
    added: [], cancelled: [], other: [], charged: MODS,
    chargedAmount: PAID, chargedListPrice: LIST, chargedOfferPercent: PCT,
  }, { ...MONTHLY, nextInvoiceItems: ITEMS.filter((i) => !MODS.includes(i.id)) } as SubscriptionAdminData);
  ok("a számlán nem szereplő modulra nincs megújítás-ígéret", !/megújításkor/.test(strip(none)));
}

// ── ③ A SZÁMLA — és a pénz ───────────────────────────────────────────────────
console.log("\n── A számla tételei és a végösszeg");
const inv = (offerPercent: number | null) =>
  buildInvoiceItems(
    { amount: PAID, kind: "upsell", settlementTakeDomain: null, domainFee: null, domainName: null, offerPercent },
    "annual", "éves", MODS.length, "AAM",
  );
let items = inv(PCT);
if (selfTest) {
  // A tiltott megoldás: külön kedvezmény-SOR. A Számlázz.hu összeadja a tételeket,
  // tehát ez ELVISZI a végösszeget — az őrnek meg kell fognia.
  items = [...items, { name: "Üdvözlő kedvezmény", quantity: 1, unitNet: -(LIST - PAID), vatKey: "AAM",
    net: -(LIST - PAID), vat: 0, gross: -(LIST - PAID) }];
}
const sum = items.reduce((s, i) => s + i.gross, 0);
ok("⛔ a tételek összege PONTOSAN a terhelt összeg", sum === PAID, `${sum} Ft (várt: ${PAID})`);
ok("a tétel neve kimondja a kedvezményt", /25% kedvezménnyel/.test(items[0]!.name), items[0]!.name);
ok("egyetlen előfizetés-tétel van (nincs kedvezmény-sor)", items.length === 1, `${items.length} tétel`);

// ⚠️ A `toLocaleString("hu-HU")` NEM-TÖRŐ szóközzel tagol ezresenként, a keresés viszont
// sima szóközt ír. A sávnál a strip() ezt elfedte, itt nem volt — és az őr ettől jelentett
// bukást egy hibátlan megjegyzésre (mérve 2026-09-22). A mérés normalizál.
const norm = (s: string) => s.replace(/\s+/g, " ");
const cmt = norm(invoiceComment(false, PCT, LIST, PAID));
ok("a megjegyzés megadja a teljes levezetést", cmt.includes("19 700") && cmt.includes("25") && cmt.includes("14 775"), cmt);
ok("a jogi mondat elöl marad", cmt.startsWith("Alanyi adómentes (AAM)."));

const cmtNone = norm(invoiceComment(false, null, 0, PAID));
ok("kupon nélkül a megjegyzés változatlan", cmtNone === "Alanyi adómentes (AAM).", cmtNone);
const itemsNone = inv(null);
ok("kupon nélkül a tétel neve változatlan", !/kedvezmény/.test(itemsNone[0]!.name), itemsNone[0]!.name);
ok("kupon nélkül is stimmel az összeg", itemsNone.reduce((s, i) => s + i.gross, 0) === PAID);

console.log(fails === 0 ? "\n🟢 COUPON-VISIBLE: minden állítás áll" : `\n🔴 COUPON-VISIBLE: ${fails} bukás`);
if (selfTest) {
  console.log(fails > 0 ? "✅ ÖNTESZT: a visszarontott állapotot az őr elutasította."
                        : "❌ ÖNTESZT: a visszarontás ÁTMENT — az őr nem bizonyít semmit.");
  process.exit(fails > 0 ? 0 : 1);
}
process.exit(fails === 0 ? 0 : 1);
