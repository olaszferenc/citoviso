// LEÍRÁS-TÉNYCÍMKE KAPU — „a gépi címke nem állíthat többet, mint a forrás mondata".
//
// A LELET (2026-10-04, Kerekerdő élesen, csak olvasva): a `descriptionSellingPoints` puszta
// részszó-egyezéssel címkéz. A forrás „az autóval érkezőknek zárt parkoló biztosított" →
// címke „Saját parkoló" → a lapon „Saját zárt parkoló". A tényhűség-kapu átengedte, mert a
// címke a SAJÁT forrás-listáján állt (forrásoltnak látszott). ADR-0292: parkoló ≠ saját parkoló
// — az állítás TERJEDELMÉT kell az idézettel összevetni, nem a meglétét.
//
//   npx tsx scripts/description-fact-label-check.mts             # zöld futás
//   npx tsx scripts/description-fact-label-check.mts --self-test # PIROS kontroll
//
// MÁSODIK LELET (2026-10-05, Bánó Porta, Köveskál): „a Káli medencében található" → „Medence"
// szolgáltatás, és a ≥60-as súly miatt a rangsor ELEJÉRE került (a főcím onnan merít). A
// földrajzi medence (tulajdonnév + medence) hely, nem úszómedence.
//
// Se AI, se hálózat, se DB.

import { descriptionSellingPoints } from "../src/generator/marketCheck.js";

const SELF_TEST = process.argv.includes("--self-test");
const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/** A visszarontott szabályok: bármely „parkol" → „Saját parkoló" (2026-10-04-ig),
 *  bármely „medenc" → „Medence" (2026-10-05-ig). */
const OLD = (d: readonly string[]) => {
  const t = d.join(" ").toLowerCase();
  return [...(t.includes("parkol") ? ["Saját parkoló"] : []), ...(t.includes("medenc") ? ["Medence"] : [])];
};
const facts = SELF_TEST ? OLD : descriptionSellingPoints;

// Valódi forrásmondatok (élesen mért leírásokból).
const KEREKERDO = "Helyben 3 kerékpár bérlésére is van lehetőség, az autóval érkezőknek zárt parkoló biztosított.";
const STREET = "Parkolási lehetőség az utcán, ingyenesen.";
const OWN = "A vendégeknek saját parkoló áll rendelkezésre az udvarban.";

{
  const f = facts([KEREKERDO]);
  check(!f.includes("Saját parkoló"), `Kerekerdő „zárt parkoló biztosított" → nem „Saját parkoló" (kapott: ${f.join(", ") || "—"})`);
  check(f.includes("Parkoló") || SELF_TEST, `…de a parkoló ténye megmarad („Parkoló") (kapott: ${f.join(", ") || "—"})`);
}
{
  const f = facts([STREET]);
  check(!f.includes("Saját parkoló"), `utcai parkolás → nem „Saját parkoló" (kapott: ${f.join(", ") || "—"})`);
}
{
  const f = SELF_TEST ? ["Saját parkoló"] : descriptionSellingPoints([OWN]);
  check(f.includes("Saját parkoló") && !f.includes("Parkoló"), `forrásban kimondott „saját parkoló" → „Saját parkoló", egy címke (pozitív kontroll; kapott: ${f.join(", ")})`);
}

// Földrajzi medence (valódi leírás-részletek a dev-DB-ből, 2026-10-05).
for (const geo of [
  "8 km-re Révfülöp fölött, a Káli medencében található Köveskál.",
  "a Balaton-felvidéki Nemzeti Parkhoz tartozó Káli-medence egyik hangulatos faluja",
  "Szállások a Káli-medencében, csendes környezetben.",
  "A Kárpát-medence egyik legszebb tája.",
]) {
  const f = facts([geo]);
  check(!f.includes("Medence"), `földrajzi medence → nem „Medence" („${geo.slice(0, 40)}…"; kapott: ${f.join(", ") || "—"})`);
}
// Pozitív kontroll: a valódi úszómedence megmarad (mondat elején nagybetűs jelzővel is).
for (const pool of [
  "Barátságos, család-és állatbarát szállás medencével, szaunával, kerttel.",
  "Fűtött medence várja a vendégeket a kertben.",
  "A kertben medence, napozóágyak. A Káli-medence közepén.",
]) {
  const f = facts([pool]);
  check(f.includes("Medence"), `úszómedence → „Medence" („${pool.slice(0, 40)}…"; kapott: ${f.join(", ") || "—"})`);
}

for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
console.log(`\ndescription-fact-label-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`);
if (SELF_TEST) {
  if (fails.length === 0) {
    console.error("\n⛔ ÖNTESZT-BUKÁS: a visszarontott viselkedésre az őr ZÖLDET adott.");
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment a visszarontott viselkedésen.`);
  process.exit(0);
}
if (fails.length) process.exit(1);
console.log("✅ a leírásból vett tény-címke nem állít többet, mint a forrás mondata");
