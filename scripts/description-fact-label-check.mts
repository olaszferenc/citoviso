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
// Se AI, se hálózat, se DB.

import { descriptionSellingPoints } from "../src/generator/marketCheck.js";

const SELF_TEST = process.argv.includes("--self-test");
const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/** A 2026-10-04-ig kiszállított szabály: bármely „parkol" → „Saját parkoló". */
const OLD = (d: readonly string[]) => (d.join(" ").toLowerCase().includes("parkol") ? ["Saját parkoló"] : []);
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
