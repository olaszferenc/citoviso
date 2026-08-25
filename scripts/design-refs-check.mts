// ŐR: a Tervek-felület (ADR-0068) fájl-feloldása és listázása.
//
// WHY: a `/design/raw/<rel>` útvonal a KÉRÉSBŐL kapott relatív úton olvas fájlt a
// lemezről. Ha ez kimászik az `assets/design-refs/`-ből, a konzol tetszőleges fájlt
// szolgál ki (`.env`, kulcsok). Ezért a feloldó ELUTASÍTÁSAIT determinisztikusan
// mérjük — nem elmélet: a támadó-minták (`..`, abszolút út, URL-kódolt `..`,
// null-bájt) mind valós eszköztár.
//
// A második fele azt méri, ami a tulajnak SZÁMÍT: a lista tényleg a munkafából él,
// vagyis egy frissen odatett terv index-frissítés NÉLKÜL megjelenik. Pontosan ez
// volt a régi (külső appos) workflow bukása.
//
//   npx tsx scripts/design-refs-check.mts

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { listDesignRefs, resolveRef } from "../src/console/designRefs.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── 1. Fájl-feloldás: mi NEM mehet ki ────────────────────────────────────────
console.log("Fájl-feloldás (path traversal):\n");

// ⚠️ A lista KÉT külön védelmet mér, és ez nem mindegy: az első blokk mintáit a
// `.html`-szűrő is elfogná, ezért ÖNMAGUKBAN hamis biztonságot adnának (a
// kimászás-védelem kivételével is zöldek maradtak — pirosra tesztelve, 2026-08-25).
// A második blokk minden mintája `.html`-re végződik, tehát KIZÁRÓLAG a
// könyvtár-bezártság állíthatja meg őket. Új mintát ide kell tenni.
const MUST_REJECT: readonly string[] = [
  // (a) nem terv-fájl → a kiterjesztés-szűrő fogja
  "../../.env",
  "../../../etc/passwd",
  "console/../../.env",
  "/etc/passwd",
  "/home/citoviso/citoviso/.env",
  "console/x.html\0.png",
  "console/x.txt",
  "",
  "..%2f..%2f.env",
  // (b) ÉRVÉNYES .html, de a mappán KÍVÜL → csak a bezártság állítja meg
  "../../public/index.html",
  "../../../tmp/evil.html",
  "console/../../../tmp/evil.html",
  "/tmp/evil.html",
  "console/../../.design-sync/x.html",
];
const leaked = MUST_REJECT.filter((r) => resolveRef(r) !== null);
check(`⭐⭐ mind a ${MUST_REJECT.length} kimászási kísérlet elutasítva`, leaked.length === 0, leaked);

const MUST_ACCEPT: readonly string[] = ["console/finance-c-tabla.html", "corpus/kozep/1.html"];
const blocked = MUST_ACCEPT.filter((r) => resolveRef(r) === null);
check("valódi terv-út átmegy", blocked.length === 0, blocked);

// ÖNTESZT: a feloldó a repón BELÜLRE mutat, nem akárhova.
{
  const full = resolveRef("console/finance-c-tabla.html");
  const base = path.resolve(process.cwd(), "assets/design-refs");
  check("önteszt: az elfogadott út a design-refs alatt marad", !!full && full.startsWith(base + path.sep));
}

// ── 2. A lista a MUNKAFÁBÓL él (nincs index, nincs frissítés-gomb) ───────────
console.log("\nA lista a fájlrendszert tükrözi:\n");

const before = await listDesignRefs();
check("a meglévő tervek látszanak", before.some((g) => g.items.length > 0), before.map((g) => `${g.group}:${g.items.length}`));

const probeDir = path.resolve(process.cwd(), "assets/design-refs/_probe");
const probe = path.join(probeDir, "probe.html");
try {
  await mkdir(probeDir, { recursive: true });
  await writeFile(probe, "<!doctype html><title>Próba-terv</title><h1>x</h1>", "utf8");
  const after = await listDesignRefs();
  const found = after.flatMap((g) => g.items).some((i) => i.rel === "_probe/probe.html");
  // A `_` prefixű mappát a listázó SZÁNDÉKOSAN kihagyja (munkamappa), ezért a
  // próbát a valós csoportban is elvégezzük — az a mérvadó.
  check("a `_` prefixű munkamappa nem szivárog a listába", !found);
} finally {
  await rm(probeDir, { recursive: true, force: true });
}

const realProbe = path.resolve(process.cwd(), "assets/design-refs/console/zz-ellenorzo-proba.html");
try {
  await writeFile(realProbe, "<!doctype html><title>Ellenőrző próba</title><h1>x</h1>", "utf8");
  const after = await listDesignRefs();
  const item = after.flatMap((g) => g.items).find((i) => i.rel === "console/zz-ellenorzo-proba.html");
  check("⭐⭐ frissen odatett terv AZONNAL megjelenik (nincs index-frissítés)", !!item);
  check("a címét a saját <title>-jéből veszi", item?.title === "Ellenőrző próba", item?.title);
} finally {
  await rm(realProbe, { force: true });
}

// ÖNTESZT: a törlés is látszik — a lista nem cache-el.
{
  const after = await listDesignRefs();
  const stillThere = after.flatMap((g) => g.items).some((i) => i.rel === "console/zz-ellenorzo-proba.html");
  check("önteszt: a törölt terv el is tűnik (nincs beragadt kártya)", !stillThere);
}

if (failures) {
  console.error(`\n⛔ design-refs-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ design-refs-check: a Tervek-lista a munkafát tükrözi, és nem olvas ki belőle.");
