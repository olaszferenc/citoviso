// ŐR — „az üres mező mondja meg, mit lát a vendég MOST".
//
// A tulaj kérése (2026-09-14): emlékeztető a Modulok → Foglalás lapon arról, hogy az
// idegenforgalmi adó mezője üres, tehát a honlapján nem jelenik meg összeg.
//
// Miért kell rá őr — három hibaosztály, mind megtörtént már ebben a projektben:
//  ① A NEM MÚLÓ EMLÉKEZTETŐ. Ha a figyelmeztetés kitöltés után is ott marad, akkor
//     nem állapotot jelent, hanem zajt — és HAMIS is lesz. Ezért a döntő állítás nem
//     az, hogy „üresen látszik", hanem hogy „kitöltve ELTŰNIK".
//  ② A KÉT PÉLDÁNYBAN ÁLLÓ MONDAT. A mező `help`-je az időtlen szabály, az
//     `emptyNote` a jelen idejű állapot. Ha mindkettő elmondja ugyanazt, a képernyőn
//     egy mondat áll kétszer (`feedback_one_rule_two_copies`).
//  ③ ⛔⛔ A MÁS KÉRDÉSRE VÁLASZOLÓ FELIRAT. Az emlékeztető azt ÁLLÍTJA a vendég-lapról,
//     hogy ott nem jelenik meg összeg. Ezt nem elhinni kell, hanem MEGMÉRNI a valódi
//     motor kimenetén — különben a két felület külön igazságot mond
//     (`feedback_label_must_derive_from_predicate`).
//
//   npx tsx scripts/module-empty-state-note-check.mts
//   npx tsx scripts/module-empty-state-note-check.mts --selftest   (pirosra kell mennie)

process.env.CIT_SHOT = "1";

import { MODULE_CONFIG_REGISTRY } from "../src/moduleConfig.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import { moduleSections } from "../src/engine/moduleSections.js";
import type { SiteData } from "../src/engine/recipe.js";

const SELFTEST = process.argv.includes("--selftest");
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const FIELD = "touristTaxPerPersonNight";
const def = MODULE_CONFIG_REGISTRY["booking"];
const field = def?.fields.find((f) => f.key === FIELD);

console.log("\n① A mező deklarációja: van állapot-emlékeztető, és NEM ismétli a szabályt:");
{
  check("van `booking` modul-konfig és megvan az IFA-mező", Boolean(field), FIELD);
  if (field) {
    check("⭐ a mezőnek VAN állapot-emlékeztetője (emptyNote)", Boolean(field.emptyNote));
    // ⛔ A két szöveg NEM mondhatja ugyanazt. Mondat-szinten hasonlítunk: ha a `help`
    // bármelyik érdemi mondata szó szerint ott van az emptyNote-ban (vagy fordítva),
    // az duplikáció — a képernyőn ugyanaz áll kétszer.
    const sentences = (t: string): string[] =>
      t
        .split(/[.?!]/)
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.length > 25);
    const h = sentences(field.help ?? "");
    const e = sentences(field.emptyNote ?? "");
    const shared = h.filter((x) => e.includes(x));
    check(
      "⭐ a `help` és az `emptyNote` NEM ugyanazt mondja (nincs kétszer álló mondat)",
      shared.length === 0,
      shared.join(" | "),
    );
    check(
      "az emlékeztető JELEN IDEJŰ állapotot mond (nem általános szabályt)",
      /most|jelenleg/i.test(field.emptyNote ?? ""),
    );
  }
}

/* ── a RENDERELT admin-lap, két állapotban ────────────────────────────────── */

function adminPage(values: Record<string, unknown>): string {
  return moduleSettingsSection("booking", {
    values,
    priceMonthly: 990,
    annualMult: 10,
    canRestore: false,
    errors: [],
    booking: {
      units: [{ id: "u1", name: "A szállás egésze", capacity: 6 }],
      month: {
        month: "2026-09",
        label: "2026. szeptember",
        prevMonth: "2026-08",
        nextMonth: "2026-10",
        leadingBlanks: 1,
        cells: [],
        blockedCount: 0,
        importedCount: 0,
      },
      unitId: "u1",
      // ⚠️ A `scripts/` NINCS típus-ellenőrizve (tsconfig include = src/**), és az
      // `as never` elnyeli a hiányzó mezőt — ezért a fixture-t a TERMÉK típusából
      // (BookingEditorData) építem végig, nem emlékezetből.
      links: [],
      exportUrl: null,
      requests: [],
    },
  } as never);
}

console.log("\n② A renderelt lap: üresen SZÓL, kitöltve HALLGAT:");
{
  const empty = adminPage({ ...def!.defaults });
  const filled = adminPage({ ...def!.defaults, [FIELD]: 450 });

  check(
    "üres mezőnél az emlékeztető ott van, a mezőhöz kötve",
    empty.includes(`data-cfg-empty="${FIELD}"`),
  );
  // ⛔ EZ A DÖNTŐ ÁLLÍTÁS. A ⭐⭐ azért jár, mert egy soha el nem tűnő figyelmeztetés
  // nemcsak zaj, hanem HAZUGSÁG is: azt állítaná, hogy nincs összeg, miközben van.
  const observed = SELFTEST ? empty : filled;
  check(
    "⭐⭐ KITÖLTVE az emlékeztető ELTŰNIK",
    !observed.includes(`data-cfg-empty="${FIELD}"`),
    SELFTEST ? "ÖNTESZT: az ÜRES lapot mérem a kitöltött helyett" : "még mindig ott van",
  );
  // ⛔ A HARMADIK ÁLLAPOT (KB-őr FLAG): aki 0-t ír be, KIMONDTA, hogy nincs IFA-ja.
  // Neki az emlékeztető hazugság lenne — és örökre ott ragadna, mert a régi kód a
  // 0-t üresnek vette. A mező alapértéke ezért üres string, nem 0.
  const zero = adminPage({ ...def!.defaults, [FIELD]: 0 });
  check(
    "⭐⭐ 0-nál („nálam nincs IFA”) sincs emlékeztető — a 0 nyilatkozat, nem üresség",
    !zero.includes(`data-cfg-empty="${FIELD}"`),
  );
  check(
    "az alapérték ÜRES (nem 0), különben a kitöltetlen és a „nincs IFA” egybeolvad",
    def!.defaults[FIELD] === "",
    String(def!.defaults[FIELD]),
  );
  check(
    "a `help` megmondja, hogyan kell a „nincs IFA” esetet jelezni",
    /0-t/.test(field?.help ?? ""),
  );
  check(
    "a mező `help`-je viszont MINDKÉT állapotban ott marad (az időtlen szabály)",
    empty.includes("a szállásdíjon felül") && filled.includes("a szállásdíjon felül"),
  );
  // Csak ahhoz az egy mezőhöz tartozik — nem szórunk emlékeztetőt a lapra.
  const notes = empty.match(/data-cfg-empty="/g)?.length ?? 0;
  check("pontosan EGY állapot-emlékeztető van a lapon", notes === 1, `talált: ${notes}`);
}

/* ── ③ AZ ÁLLÍTÁS IGAZ-E? A vendég-lapon mérve ────────────────────────────── */

console.log("\n③ ⛔ Amit az emlékeztető ÁLLÍT a vendég-lapról, az igaz-e (mérve):");
{
  const site = (ifa: number | null): SiteData =>
    ({
      name: "Nyugalom Vendégház",
      tagline: "",
      intro: "",
      highlights: [],
      photos: [],
      contact: { email: "info@example.com", phone: "+36 30 123 4567" },
      rooms: [{ name: "A szállás egésze", capacity: "6 fő", note: "", price: "" }],
      booking: {
        units: [{ id: "u1", name: "A szállás egésze", capacity: 6 }],
        minNights: 2,
        maxNights: 14,
        horizonMonths: 12,
        leadTimeDays: 0,
        // ⛔ A SAJÁT fixture-em eldobta a 0-t (`ifa ? … : {}`) — pont azt az állapotot,
        // amit mérni akar. `null` = kitöltetlen, `0` = kimondott nem.
        ...(ifa === null ? {} : { touristTaxPerPersonNight: ifa }),
      },
    }) as unknown as SiteData;

  const guestEmpty = moduleSections(site(null));
  const guestFilled = moduleSections(site(450));

  check(
    "⭐⭐ ÜRES mezőnél a vendég-lap tényleg NEM visz ki összeget (data-cit-ifa nincs)",
    !/data-cit-ifa=/.test(guestEmpty),
  );
  check(
    "⭐ KITÖLTVE viszont kiviszi — tehát a mező tényleg számít",
    /data-cit-ifa="450"/.test(guestFilled),
  );
  // ⛔ A két felület EGY igazságot mondjon: az admin emlékeztetője és a vendég-lap
  // viselkedése ugyanabból az egy mezőből következik.
  check(
    "⭐⭐ a két felület EGYEZIK: ahol az admin emlékeztet, ott a vendég-lapon nincs szám",
    adminPage({ ...def!.defaults }).includes(`data-cfg-empty="${FIELD}"`) &&
      !/data-cit-ifa=/.test(guestEmpty),
  );
  // ⛔ A KIMONDOTT NULLA külön állapot: a lap NEM hallgat róla véletlenül, hanem
  // tudja, hogy nincs — és ezért nem is említi az adót.
  const guestZero = moduleSections(site(0));
  check(
    "⭐⭐ 0-nál a lap KIVISZI a nyilatkozatot (data-cit-ifa=\"0\"), nem hagyja üresen",
    /data-cit-ifa="0"/.test(guestZero),
  );
  // ⛔ Ez az állítás korábban ROSSZ OKBÓL volt zöld: a „?" (nem teljesült ág) is külön
  // értéknek számított a halmazban, így akkor is hármat mért, ha két eset egybeolvadt.
  // Most a HÁROM VÁRT kimenetet tűzöm ki név szerint.
  const outcome = (html: string): string => {
    const m = /data-cit-ifa="([^"]*)"/.exec(html);
    return m ? `attr:${m[1]}` : "nincs-attr";
  };
  const got = [outcome(guestEmpty), outcome(guestZero), outcome(guestFilled)];
  check(
    "⭐ és a három állapot HÁROM különböző kimenetet ad (nincs két egybeolvadó eset)",
    JSON.stringify(got) === JSON.stringify(["nincs-attr", "attr:0", "attr:450"]),
    got.join(" · "),
  );
}

/* ── verdikt ──────────────────────────────────────────────────────────────── */

if (SELFTEST) {
  const key = "⭐⭐ KITÖLTVE az emlékeztető ELTŰNIK";
  if (failures.includes(key) && failures.length === 1) {
    console.log(
      "\n✅ ÖNTESZT: a döntő állítás pirosra ment, amikor a rossz (üres) állapotot kapta — " +
        "vagyis tényleg a KÜLÖNBSÉGET méri, nem a jelenlétet. A többi állítás közben zöld maradt.",
    );
    process.exit(0);
  }
  console.log(`\n⛔ ÖNTESZT BUKOTT: a várt piros ${failures.includes(key) ? "megvolt" : "HIÁNYZIK"}, összes bukás: ${failures.length}`);
  process.exit(1);
}

if (failures.length) {
  console.log(`\n⛔ ${failures.length} bukás:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✅ module-empty-state-note-check: az üres mező megmondja, mit lát a vendég — és kitöltve elhallgat.");
