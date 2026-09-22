// ⛔⛔ A SZEZON-ILLESZTÉS EGY PÉLDÁNYBAN — az őr, ami ezt igazolja.
//
// A LELET, ami miatt ez létezik (ADR-0197 ③ nyomán, mérve 2026-09-22). A „melyik ár-sor
// vonatkozik erre az éjszakára?" kérdés KÉT példányban élt, és a kettőt semmi nem vetette
// össze: `src/tenant/prices.ts` (seasonCovers + priceOn — ez a szám FAGY RÁ a foglalási
// kérésre és megy ki a vendég levelében) és `assets/runtime/cit-runtime.js` (ugyanaz a két
// függvény — ezt OLVASSA a vendég beküldés előtt). Ráadásul a hónap-nap feltevés
// (`slice(5, 10)`) ÖT helyen élt külön.
//
// Miért nem elég a paritás-őr mintája (cit-money.js): egy eltérő FORMÁZÓ csúnya stringet
// ír, egy eltérő ÁR-KIVÁLASZTÓ mást ígér, mint amit terhel — ez az ADR-0193 ② károsztálya.
// Ezért itt nincs ikerpéldány: EGY fájl (assets/runtime/cit-season.cjs), amit a szerver
// require-ol, és amit a generátor bájtra ugyanígy inline-ol a lapba.
//
// ⛔ AMI SZÁNDÉKOSAN NEM LETT EGY PÉLDÁNY: a `scripts/booking-price-coherence-check.mts`
// SAJÁT `covers()`-e. Egy orákulum, ami a vizsgált kódot importálja, nem tud vele
// ellentmondani — az a `feedback_guard_must_not_borrow_its_subject`. Ez az őr ugyanezt
// tartja: a referencia-implementáció ITT, ebben a fájlban készül, és NEM hívja a CitSeason-t.
//
// Amit állít:
//   ① A lapba inline-olt szöveg BÁJTRA azonos a fájllal, amit a szerver require-ol.
//   ② A szerver és a böngésző ugyanazt a sort választja — FÜGGETLEN referenciához mérve.
//   ③ A termék kódjában nem maradt nyers hónap-nap vágás (a feltevés egy helyen él).
//   ④ Év-előtagú dátum NEM illeszkedik némán — ez a mai, kimondott korlát.
//
// Futtatás:
//   npx tsx scripts/season-rule-check.mts
//   npx tsx scripts/season-rule-check.mts --selftest   ← PIROSNAK KELL LENNIE

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const selftest = process.argv.includes("--selftest");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const RULE_PATH = path.join(ROOT, "assets/runtime/cit-season.cjs");
const RULE_SRC = readFileSync(RULE_PATH, "utf8");

interface Rule {
  covers(from: string | null, to: string | null, md: string): boolean;
  monthDayOf(iso: string): string;
  rowFor<T>(rows: readonly T[], md: string, isBase: (r: T) => boolean): T | null;
}

/** Load a copy of the rule the way the BROWSER gets it: plain script, global var. */
function loadAsBrowser(src: string): Rule {
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.CitSeason as Rule;
}

// ─────────────────────────────────────────────────────────────────────────────
// ① A lapba kerülő szöveg = a szerver által betöltött fájl (bájtra)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n① Egy példány — a lapba inline-olt szöveg és a szerver fájlja");

const { SEASON_JS, seasonRule } = (await import("../src/tenant/seasonRule.js")) as {
  SEASON_JS: string;
  seasonRule: Rule;
};
check("a loader ugyanazt a fájlt olvassa be, amit az őr", SEASON_JS === RULE_SRC);

const runtimeTs = readFileSync(path.join(ROOT, "src/generator/runtime.ts"), "utf8");
check(
  "a generátor a lapba INLINE-olja a szezon-szabályt (nem külön kérés)",
  runtimeTs.includes("cit-season.cjs"),
);
// A sorrend nem ízlés: a cit-runtime.js hívja a CitSeason-t, tehát előtte kell állnia.
const iSeason = runtimeTs.indexOf("cit-season.cjs");
const iRuntime = runtimeTs.indexOf('"cit-runtime.js"');
check("a szezon-szabály a cit-runtime.js ELŐTT kerül a lapra", iSeason > 0 && iRuntime > iSeason, {
  iSeason,
  iRuntime,
});

// ─────────────────────────────────────────────────────────────────────────────
// ② Szerver és böngésző ugyanazt választja — FÜGGETLEN referenciához mérve
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n② A szerver és a böngésző ugyanazt a sort választja");

// ⛔ A `--selftest` nem szimulál: a böngésző-oldalt a TÖRTÉNETI, eltérő szabállyal tölti
// be — a wrap-öt nem ismerő változattal, ami a karácsonyi (12-20 → 01-05) áron csendben
// mást választ. Ha ettől nem pirosodik, az őr vak.
const HISTORICAL = `var CitSeason = (function(){
  function covers(from,to,md){ return !!from && !!to && md >= from && md <= to; }
  function monthDayOf(iso){ return String(iso).slice(5,10); }
  function rowFor(rows,md,isBase){
    if(!rows||!rows.length) return null;
    var base=null;
    for(var i=0;i<rows.length;i++){ var r=rows[i];
      if(isBase(r)){ if(!base) base=r; continue; }
      if(covers(r.from,r.to,md)) return r; }
    return base; }
  return { covers: covers, monthDayOf: monthDayOf, rowFor: rowFor };
})();
if (typeof module !== "undefined" && module.exports) module.exports = CitSeason;`;

const browser = loadAsBrowser(selftest ? HISTORICAL : RULE_SRC);

/** FÜGGETLEN referencia — szándékosan MÁS alakban írva, és nem hívja a CitSeason-t. */
function refCovers(from: string, to: string, md: string): boolean {
  const f = Number(from.replace("-", ""));
  const t = Number(to.replace("-", ""));
  const d = Number(md.replace("-", ""));
  return f <= t ? d >= f && d <= t : d >= f || d <= t;
}

interface Row {
  readonly id: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly isBase: boolean;
}
const ROWS: Row[] = [
  { id: "base", from: null, to: null, isBase: true },
  { id: "fo", from: "06-15", to: "08-31", isBase: false },
  { id: "kar", from: "12-20", to: "01-05", isBase: false }, // ÁTFORDUL az évhatáron
];

function refRowFor(md: string): string {
  for (const r of ROWS) {
    if (r.isBase) continue;
    if (refCovers(r.from!, r.to!, md)) return r.id;
  }
  return "base";
}

// Minden naptári nap — nem mintavétel: a wrap pont a széleken bukik.
let mismatchServer = 0;
let mismatchBrowser = 0;
let wrapDays = 0;
const days: string[] = [];
for (let m = 1; m <= 12; m++) {
  for (let d = 1; d <= 31; d++) {
    const md = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push(md);
  }
}
for (const md of days) {
  const want = refRowFor(md);
  const srv = seasonRule.rowFor(ROWS, md, (r) => r.isBase)?.id ?? "none";
  const brw = browser.rowFor(ROWS, md, (r) => r.isBase)?.id ?? "none";
  if (srv !== want) mismatchServer++;
  if (brw !== want) mismatchBrowser++;
  if (want === "kar") wrapDays++;
}
check(`a szerver mind a ${days.length} napon a referenciát követi`, mismatchServer === 0, mismatchServer);
check(`a böngésző mind a ${days.length} napon a referenciát követi`, mismatchBrowser === 0, mismatchBrowser);
// ⭐ Utó-feltétel: ha a fixtúra nem tartalmaz ÁTFORDULÓ szezont, a ② állítás üresen
// futna — pont azt nem mérné, amiben a két példány eltérhet.
check("a mérés tartalmaz évhatáron átforduló szezont (különben üresen futna)", wrapDays > 0, wrapDays);

// ─────────────────────────────────────────────────────────────────────────────
// ③ A hónap-nap feltevés EGY helyen él
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n③ A hónap-nap feltevés nem szóródik szét újra");

const PRODUCT_FILES = [
  "src/tenant/prices.ts",
  "src/tenant/availability.ts",
  "src/booking/requests.ts",
  "assets/runtime/cit-runtime.js",
];
for (const rel of PRODUCT_FILES) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  // Csak az ÁR-úton számít; az "ical:" prefix-vágás nem ez.
  const raw = [...src.matchAll(/\.slice\(5,\s*10\)/g)].length;
  check(`${rel}: nincs nyers hónap-nap vágás`, raw === 0, raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// ③b ⛔⛔ A PÁROSÍTÁS — aki kézzel rak össze lapot, hozza a szabályt is
// ─────────────────────────────────────────────────────────────────────────────
//
// MÉRT HIBA, a bevezetés napján (2026-09-22). Három script NEM a termék injektorán
// (`src/generator/runtime.ts`) át épít lapot, hanem kézzel fűzi össze a runtime-fájlokat.
// Az új `cit-season.cjs` nélkül a `cit-runtime.js` egy UNDEFINED `CitSeason`-ön hal meg,
// és az ár-bontás NÉMÁN eltűnik: a `booking-price-clarity-check` 7 állítása ment pirosra,
// és egyikük sem mondta, hogy a runtime szállt el. Ugyanez a csapda egyszer már elsült a
// `cit-money.js`-szel — ezért van a money-format-check-ben ugyanilyen párosítás-állítás.
// ⭐ „Miből áll a lap runtime-ja" ettől még KÉT helyen van felsorolva (az injektorban és
// minden kézi összerakóban); ez az állítás nem szünteti meg a kettősséget, csak
// MEGSZÓLAL, ha elválnak.
console.log("\n③b A párosítás — kézi lapépítő nem felejtheti el a szabályt");

const HAND_BUILT = [
  "scripts/booking-price-clarity-check.mts",
  "scripts/booking-outcome-truth-check.mts",
  "scripts/shot-booking-form.mts",
];
for (const rel of HAND_BUILT) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  // Csak azt kérjük számon, aki tényleg beágyazza a widget-runtime-ot.
  if (!src.includes("assets/runtime/cit-runtime.js")) continue;
  check(`${rel}: a cit-runtime.js mellé hozza a cit-season.cjs-t is`, src.includes("cit-season.cjs"));
}
// ⭐ Utó-feltétel: ha a lista elavul (átnevezés, törlés), az állítások ÜRESEN futnának —
// és a párosítás-őr némán semmit sem bizonyítana.
const stillHandBuilt = HAND_BUILT.filter((rel) =>
  readFileSync(path.join(ROOT, rel), "utf8").includes("assets/runtime/cit-runtime.js"),
);
check(
  "…és a lista élő (van kit számon kérni)",
  stillHandBuilt.length === HAND_BUILT.length,
  { vart: HAND_BUILT.length, talalt: stillHandBuilt.length },
);

// ─────────────────────────────────────────────────────────────────────────────
// ④ A mai, KIMONDOTT korlát: év-előtagú dátum nem illeszkedik némán
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n④ Az év-előtagú szezon ma NEM illeszkedik — kimondva, nem véletlenül");

const yearRow: Row[] = [
  { id: "base", from: null, to: null, isBase: true },
  { id: "fo2027", from: "2027-06-15", to: "2027-08-31", isBase: false },
];
const hit = seasonRule.rowFor(yearRow, "07-10", (r) => r.isBase)?.id;
check(
  "év-előtagú szezon NEM nyer — az alapárra esik vissza (a bővítés még nem él)",
  hit === "base",
  hit,
);
check(
  "…és az írás oldalán is elutasított (isMonthDay)",
  !(await import("../src/tenant/prices.js")).isMonthDay("2027-06-15"),
);

// ─────────────────────────────────────────────────────────────────────────────
// Az önteszt utó-feltétele — egy halott szabályt az összevont darabszám elfedne
// ─────────────────────────────────────────────────────────────────────────────
if (selftest) {
  if (failures === 0) {
    console.error(
      "\n⛔ AZ ÖNTESZT NEM BUKOTT: a visszarontott böngésző-példányt az őr átengedte — vak.",
    );
    process.exit(1);
  }
  if (mismatchBrowser === 0) {
    console.error(
      "\n⛔ AZ ÖNTESZT ROSSZ HELYEN BUKOTT: nem a böngésző-paritás szólalt meg, " +
        "tehát nem azt bizonyítja, amiért íródott.",
    );
    process.exit(1);
  }
  // ⚠️ HANGOSAN KIMONDVA, amit az önteszt NEM mér: csak a ② (böngésző-paritás) ágat
  // rontja vissza. Az ① (bájt-azonosság + inline sorrend), a ③ (szétszóródó hónap-nap
  // vágás) és a ④ (év-előtagú dátum) FÁJL-állapotot mér, amit egy futásidejű csere nem
  // tud előállítani — ezeket egy valódi visszarontás (a sor törlése) buktatná. Ez
  // ismert, megnevezett hézag, nem néma kihagyás.
  console.log(
    `\n🔴 SEASON-RULE ÖNTESZT: ${failures} bukás, ${mismatchBrowser} eltérő nap — a ② ág él.` +
      "\n   (Az ①/③/④ ág fájl-állapotot mér; azokat az önteszt NEM rontja vissza.)",
  );
  process.exit(1);
}

console.log(
  failures
    ? `\n⛔ SEASON-RULE: ${failures} bukás`
    : "\n🟢 SEASON-RULE: egy példány, a két oldal egyezik, a feltevés egy helyen él",
);
process.exit(failures ? 1 : 0);
