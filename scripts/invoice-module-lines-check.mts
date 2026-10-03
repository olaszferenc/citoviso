// ŐR: a modul-vásárlás számlája modulonként külön sort kap, és a sorok összege BETŰRE a terhelt
// összeg (INV-1, tulaj-döntés „B” 2026-10-03; kontraktus: assets/design-refs/console/invoice-module-lines/).
//
// A lelet (Elek 3. kör): a modul-bővítés tétele „Citoviso előfizetés (havi, 3 modul)” volt — nem mondta,
// hogy modul-bővítés, sem azt, melyik modulok. A tulaj modulonkénti sort kért, a kerekítési kockázatot
// pedig nekünk kell megoldani: a Számlázz.hu összeadja a tételeket, tehát egy forint eltérés rossz számla.
//
// Mit tart (se DB, se hálózat):
//   ① a szétosztás: minden sor ≥ 1 Ft, a többi a havidíj arányában, a teljes maradék a legnagyobb
//     havidíjú sorra (egyenlőségnél az elsőre) — és az összeg MINDIG pontos;
//   ② 0, 1 és sok modul, 98%-os és kupon nélküli eset, összeg < modulszám, domain-díjjal;
//   ③ a nem-upsell tételek változatlanok;
//   ④ a Számlázz-kérés (XML) pontosan ezeket a sorokat hordozza, a bruttók összege a terhelt összeg;
//   ⑤ a bekötés: a számla-kiállítás a rendelés moduljaiból építi a sorokat.
//
// Futtatás: npx tsx scripts/invoice-module-lines-check.mts
import { readFileSync } from "node:fs";

import { buildInvoiceItems, splitInvoiceAmount } from "../src/payment/service.js";

let failures = 0;
let pass = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) pass++;
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// ── ① the split rule ───────────────────────────────────────────────────────────
{
  check("a tulaj példája: 1 251 Ft, 690/490/490 → 517/367/367", JSON.stringify(splitInvoiceAmount(1251, [690, 490, 490])) === "[517,367,367]", splitInvoiceAmount(1251, [690, 490, 490]));
  // A brute-force sweep: the sum is exact, every line >= 1, the remainder sits on ONE line.
  let bad: unknown = null;
  outer: for (let amount = 0; amount <= 3000; amount += 7) {
    for (const w of [[490], [690, 490], [490, 490, 490], [990, 690, 490, 290], [1, 1000], [0, 0, 0], [490, 690, 490, 490, 290, 990, 490, 490]]) {
      const s = splitInvoiceAmount(amount, w);
      if (amount < w.length) {
        if (s !== null) { bad = { amount, w, s, why: "kevés pénz: null kell (összevont sor)" }; break outer; }
        continue;
      }
      if (!s || s.length !== w.length || sum(s) !== amount || s.some((x) => x < 1 || !Number.isInteger(x))) {
        bad = { amount, w, s };
        break outer;
      }
    }
  }
  check("⛔ söprés (0–3000 Ft × 7 súly-készlet): az összeg mindig pontos, minden sor egész és ≥ 1 Ft", bad === null, bad);
  // Determinism: the remainder goes to the largest weight, first on a tie.
  const r = splitInvoiceAmount(1000, [490, 690, 690]);
  const floors = [1, 1, 1].map((b, i) => b + Math.floor((997 * [490, 690, 690][i]!) / 1870));
  check("a maradék a LEGNAGYOBB havidíjú sorra kerül, egyenlőségnél az elsőre (2. sor)",
    !!r && r[0] === floors[0] && r[2] === floors[2] && r[1] === 1000 - floors[0]! - floors[2]!, { r, floors });
  check("ugyanaz a bemenet → ugyanaz a kimenet", JSON.stringify(splitInvoiceAmount(1000, [490, 690, 690])) === JSON.stringify(r));
  check("0 Ft, 0 modul → null (nincs mit szétosztani)", splitInvoiceAmount(0, []) === null);
  check("csupa 0 súly → egyenlő arány, összeg pontos", sum(splitInvoiceAmount(10, [0, 0, 0]) ?? []) === 10);
}

// ── ② the invoice lines ────────────────────────────────────────────────────────
const MODS = [
  { label: "Vendégek véleménye", weight: 690 },
  { label: "Térkép, megközelítés", weight: 490 },
  { label: "Árak, szezonok", weight: 490 },
];
const up = (amount: number, mods: typeof MODS, offerPercent: number | null, domainFee: number | null = null) =>
  buildInvoiceItems(
    { amount, kind: "upsell", settlementTakeDomain: null, domainFee, domainName: domainFee ? "pelda.hu" : null, offerPercent, moduleLines: mods },
    "monthly", "havi", mods.length, "AAM",
  );
{
  const many = up(1251, MODS, 25);
  check("sok modul: modulonként egy sor", many.length === 3, many.map((i) => i.name));
  check("a sor neve: „Citoviso modul: <név> (havi) — 25% kedvezménnyel”", many[0]!.name === "Citoviso modul: Vendégek véleménye (havi) — 25% kedvezménnyel", many[0]!.name);
  check("⛔ sok modul: a bruttók összege = a terhelt 1 251 Ft", sum(many.map((i) => i.gross)) === 1251, many.map((i) => i.gross));
  check("a nettó = bruttó = egységár (AAM), mennyiség 1", many.every((i) => i.net === i.gross && i.unitNet === i.gross && i.quantity === 1 && i.vat === 0));

  const one = up(367, MODS.slice(1, 2), 25);
  check("1 modul: egy sor a teljes összeggel", one.length === 1 && one[0]!.gross === 367 && one[0]!.name.startsWith("Citoviso modul: Térkép"), one);

  const none = up(500, [], null);
  check("0 modul: egy „Citoviso modul-bővítés (havi)” sor a teljes összeggel", none.length === 1 && none[0]!.name === "Citoviso modul-bővítés (havi)" && none[0]!.gross === 500, none);

  const p98 = up(33, MODS, 98);
  check("⛔ 98%-os kupon (33 Ft, 3 modul): az összeg pontos, nincs 0 Ft-os sor", sum(p98.map((i) => i.gross)) === 33 && p98.length === 3 && p98.every((i) => i.gross >= 1), p98.map((i) => [i.name, i.gross]));
  check("98%: a név kimondja a kedvezményt", p98.every((i) => i.name.endsWith("— 98% kedvezménnyel")));

  const tiny = up(2, MODS, 98);
  check("összeg < modulszám (2 Ft, 3 modul): egy összevont sor, minden modul nevével", tiny.length === 1 && tiny[0]!.gross === 2 && MODS.every((m) => tiny[0]!.name.includes(m.label)), tiny);

  const plain = up(1670, MODS, null);
  check("⛔ kupon nélkül: az összeg pontos, nincs kedvezmény-utótag", sum(plain.map((i) => i.gross)) === 1670 && plain.every((i) => !/kedvezménnyel/.test(i.name)), plain.map((i) => [i.name, i.gross]));

  const dom = up(1251 + 1000, MODS, 25, 1000);
  check("domain-díjjal: a modul-sorok + a domain-sor = a terhelt összeg, a domain külön sor",
    sum(dom.map((i) => i.gross)) === 2251 && dom.length === 4 && /saját domain/.test(dom[3]!.name) && dom[3]!.gross === 1000, dom.map((i) => [i.name, i.gross]));
}

// ── ③ other kinds unchanged ────────────────────────────────────────────────────
{
  const init = buildInvoiceItems({ amount: 7240, kind: "initial", settlementTakeDomain: null, domainFee: null, domainName: null, offerPercent: 25, moduleLines: MODS }, "monthly", "havi", 7, "AAM");
  check("az induló előfizetés változatlan: egy „Citoviso előfizetés (havi, 7 modul)” sor",
    init.length === 1 && init[0]!.name === "Citoviso előfizetés (havi, 7 modul) — 25% kedvezménnyel", init);
}

// ── ④ the Számlázz request carries exactly these lines ─────────────────────────
{
  process.env.SZAMLAZZ_DEMO = "1";
  const { SzamlazzAgent } = await import("../src/invoicing/szamlazz.js");
  const items = up(1251, MODS, 25);
  const xml: string = (new SzamlazzAgent("") as unknown as { buildXml(i: unknown): string }).buildXml({
    buyer: { name: "Teszt Vevő", email: null, zip: "8600", city: "Siófok", address: "Teszt u. 1.", taxNumber: null, euVatNumber: null, country: "HU" },
    items, currency: "HUF", issueDate: "2026-10-03", fulfillmentDate: "2026-10-03", dueDate: "2026-10-03",
    paymentMethod: "bankkártya", paid: true, comment: "", externalId: "inv-module-lines-check",
  });
  const names = [...xml.matchAll(/<megnevezes>([^<]*)<\/megnevezes>/g)].map((m) => m[1]);
  const gross = [...xml.matchAll(/<bruttoErtek>([^<]*)<\/bruttoErtek>/g)].map((m) => Number(m[1]));
  check("⛔ a Számlázz-XML a modulonkénti sorokat hordozza", JSON.stringify(names) === JSON.stringify(items.map((i) => i.name)), names);
  check("⛔ a Számlázz-XML bruttóinak összege a terhelt 1 251 Ft", sum(gross) === 1251, gross);
}

// ── ⑤ wiring ───────────────────────────────────────────────────────────────────
{
  const svc = readFileSync(new URL("../src/payment/service.ts", import.meta.url), "utf8");
  check("a kiállítás a rendelés moduljaiból építi a sorokat (moduleLines)", /moduleLines: invoiceModuleLines\(/.test(svc), "nincs bekötve");
}

console.log(`\ninvoice-module-lines-check: ${pass} zöld, ${failures} bukás`);
process.exit(failures ? 1 : 0);
