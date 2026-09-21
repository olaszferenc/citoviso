// PAID-EMPTY guard — a modul, amiért FIZET, de a vendégnek semmit nem mutat.
//
//   npx tsx scripts/paid-empty-check.mts [--self-test]
//
// A MÉRT LELET (2026-09-21, a tulaj saját tenantján, élő adaton): 14 775 Ft-ért
// vett három modult (pricing + poi + booking). A `booking` kapott tartalmat és
// renderelt; a másik kettő üresen maradt, ezért az ÉLŐ lapról teljesen hiányzott —
// az „Árak" és „A környéken" szó 0-szor fordult elő a kiszolgált HTML-ben. És erről
// egyetlen képernyő sem szólt: a modul-lista „aktív"-ot írt, az Áttekintés Teendői
// pedig csak fotóról, bemutatkozóról és publikálásról beszéltek. A vevő fizetett,
// és nem kapott semmit — anélkül, hogy megtudta volna.
//
// ⛔ MIÉRT KÉT SZINTEN MÉR:
//   · a PREDIKÁTUM (paidButEmptyModules) — mert a hamis riasztás ugyanolyan kár,
//     mint a néma hiba: négy modul (booking, location, reviews, enquiry) MINDIG
//     renderel valamit, ezeket dunningolni hazugság lenne.
//   · a RENDERELT LAP — mert a sor létezhet hibátlan predikátum mellett is úgy,
//     hogy nem mondja meg a nevet, az árat vagy a teendőt. A hiány a SZÁLLÍTOTT
//     HTML-ben él (admin-list-labels-check precedense).
//
// HERMETIKUS: se DB, se szerver, se hálózat — kézzel épített fixtúra, hogy friss
// klónon és pre-commitban is fusson, a közös teszt-park állapotától függetlenül.
//
// --self-test: a lapot VISSZARONTVA rendereljük (ár nélküli sor, elhallgatott
// „kifizette, de üres", halott Kitöltöm-gomb). Egy őr, amit sosem láttunk pirosan,
// nem bizonyíték (feedback_fixture_must_prove_its_own_path).

import { adminDashboard } from "../src/server/adminViews.js";
import { filledContentFields, paidButEmptyModules, type TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";
import { MODULE_CATALOG } from "../src/modules.js";

const selfTest = process.argv.includes("--self-test");
let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "  ✅" : "  ❌"} ${label}${extra ? ` — ${extra}` : ""}`);
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── fixtúra ──────────────────────────────────────────────────────────────────
// ⛔ A MODUL NEVE A KATALÓGUSBÓL JÖN, nem kézzel gépelve. Az első változatom két
// nevet KITALÁLT („Érkezés, távozás" a `hours`-ra, „Amiért minket választanak" az
// `usp`-re), a súgó pedig ugyanazokat idézte — az őr a saját téves feltevését
// igazolta vissza, zárt hurokban, és a hibát csak a tudásbázis-őr emberi verdiktje
// fogta meg. A termék forrása a mérce (getTenantModules is innen tölti a `label`-t).
type Mod = TenantModuleView["modules"][number];
const labelOf = (id: string): string => {
  const c = MODULE_CATALOG.find((x) => x.id === id);
  if (!c) throw new Error(`nincs ilyen modul a katalógusban: ${id}`);
  return c.publicLabel;
};
const mod = (id: string, over: Partial<Mod> = {}): Mod =>
  ({
    id,
    label: labelOf(id),
    group: "offer",
    active: true,
    spine: false,
    priceMonthly: 490,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
    supersededBy: null,
    publicDesc: "",
    ...over,
  }) as unknown as Mod;

const MODULES: Mod[] = [
  mod("pricing"),
  mod("poi"),
  mod("amenities"),
  mod("rooms", { priceMonthly: 690 }),
  mod("hours", { priceMonthly: 290 }),
  // Ezeknek NINCS valódi üres állapotuk — mindig renderelnek valamit.
  mod("booking", { priceMonthly: 990 }),
  mod("location"),
  mod("reviews", { priceMonthly: 690 }),
  mod("enquiry", { spine: true, priceMonthly: 0 }),
  mod("usp"),
  // Nem számlázott állapotok.
  mod("gallery", { cancelAtPeriodEnd: true }),
];
const MV = { modules: MODULES, baseMonthly: 4880, totalMonthly: 12000 } as unknown as TenantModuleView;

const SUB = {
  status: "active",
  billingPeriod: "annual",
  pendingAnnual: false,
  annualFreeMonths: 2,
  annualTotal: 99900,
  autoCharge: true,
  arrears: null,
  coupon: null,
} as unknown as SubscriptionAdminData;

const session = { tenantId: "t1", username: "elek@citoviso.com", displayName: "Teszt Szállás" } as never;
const content = { lang: "hu", status: "live", usingOwnPhotos: true, intro: "x".repeat(60) } as never;

// ── A) a PREDIKÁTUM ──────────────────────────────────────────────────────────
console.log("\n── A predikátum (paidButEmptyModules)");

const empty = filledContentFields({});
const idsOf = (filled: ReadonlySet<string>) =>
  paidButEmptyModules(MV, filled)
    .map((m) => m.id)
    .sort();

const allEmpty = idsOf(empty);
ok(
  "üres tenanton pontosan az öt üresíthető modul",
  JSON.stringify(allEmpty) === JSON.stringify(["amenities", "hours", "poi", "pricing", "rooms"]),
  allEmpty.join(", ") || "(egy sem)",
);

// NEGATÍV KONTROLL — a hamis riasztás ugyanolyan kár, mint a néma hiba.
for (const never of ["booking", "location", "reviews", "enquiry", "usp"]) {
  ok(`${never}: SOHA nem kerül a listába (mindig renderel valamit)`, !allEmpty.includes(never));
}
ok("gallery: lemondott modul nem kerül a listába", !allEmpty.includes("gallery"));

// Kitöltött modul eltűnik.
const filledPoi = idsOf(filledContentFields({ poi: ["Strand — 300 m"] }));
ok("kitöltött poi kiesik a listából", !filledPoi.includes("poi"), filledPoi.join(", "));
ok("a többi bent marad tőle", filledPoi.includes("pricing") && filledPoi.includes("amenities"));

// Minden kitöltve → egyetlen sor sem.
const allFilled = idsOf(
  filledContentFields({ poi: ["x"], pricing: { currency: "HUF" }, amenities: ["x"], rooms: [{}], hours: { note: "x" } }),
);
ok("mindent kitöltve egyetlen sor sem marad", allFilled.length === 0, allFilled.join(", ") || "(egy sem)");

// Az ÜRES ÉRTÉK nem tartalom: egy explicit undefined mező nem számít kitöltöttnek.
const undef = idsOf(filledContentFields({ poi: undefined }));
ok("undefined mező nem számít tartalomnak", undef.includes("poi"));

// ── B) a RENDERELT LAP ───────────────────────────────────────────────────────
console.log("\n── A renderelt Áttekintés");

const paidEmpty = paidButEmptyModules(MV, empty);
let html = adminDashboard(session, content, {
  modules: MV,
  paidEmpty,
  subscription: SUB,
  supportEmail: "elek@citoviso.com",
});

/** A javítás ELŐTTI (vagy elrontott) állapot — az őrnek pirosnak kell lennie rá. */
function regress(s: string): string {
  return s
    .replace(/<span class="adm-todo__price">[\s\S]*?<\/span>\s*<\/span>/g, "</span>")
    .replace(/— kifizette, de üres, ezért a vendég ma nem látja/g, "—")
    .replace(/href="\/admin\?tab=modulok&m=[^"]*"/g, 'href="#"');
}
if (selfTest) html = regress(html);

const rows = html.match(/<li class="pending adm-todo__paid">[\s\S]*?<\/li>/g) ?? [];
ok(`minden kifizetett-üres modul kap sort (${paidEmpty.length} db)`, rows.length === paidEmpty.length, `${rows.length} sor`);

for (const m of paidEmpty) {
  const row = rows.find((r) => r.includes(m.label));
  if (!row) {
    ok(`${m.id}: van sora a nevével`, false);
    continue;
  }
  const text = stripTags(row);
  ok(`${m.id}: a sor kimondja a modul nevét`, text.includes(m.label));
  ok(`${m.id}: a sor kimondja, hogy kifizette, de üres`, /kifizette, de üres/.test(text));
  ok(`${m.id}: a sor megmondja, mi hiányzik belőle`, /Amíg nincs benne /.test(text));
  // ⛔ AZ ÁR A FIÓK ÜTEMÉBEN: éves fiókon az ÉVES összeg vezet. Egy beégetett
  // „490 Ft/hó" itt két különböző osztót tett volna a tulaj két képernyőjére.
  ok(`${m.id}: az ár a fiók ütemében vezet (éves)`, /\/év/.test(text), text.slice(0, 90));
  // A gomb nem lehet halott: vagy a modul beállító lapjára, vagy a Modulok fülre visz.
  const href = /href="([^"]*)"/.exec(row)?.[1] ?? "";
  ok(`${m.id}: a Kitöltöm gomb valódi útvonalra mutat`, href.startsWith("/admin"), href || "(nincs href)");
}

// Ha nincs mit jelezni, a lap NEM gyárt fantom-figyelmeztetést.
const cleanHtml = adminDashboard(session, content, {
  modules: MV,
  paidEmpty: [],
  subscription: SUB,
  supportEmail: "elek@citoviso.com",
});
ok(
  "üres lista → egyetlen ilyen sor sincs a lapon",
  !/adm-todo__paid/.test(cleanHtml) && !/kifizette, de üres/.test(stripTags(cleanHtml)),
);

console.log(
  fails === 0
    ? "\n🟢 PAID-EMPTY: minden állítás áll"
    : `\n🔴 PAID-EMPTY: ${fails} bukás`,
);
if (selfTest) {
  console.log(
    fails > 0
      ? "✅ ÖNTESZT: a visszarontott lapot az őr elutasította."
      : "❌ ÖNTESZT: a visszarontott lap ÁTMENT — az őr nem bizonyít semmit.",
  );
  process.exit(fails > 0 ? 0 : 1);
}
process.exit(fails === 0 ? 0 : 1);
