// ŐR: egy leaden EGY jóváhagyott mock lehet — kivéve, amit már kiküldtünk.
//
// ⛔ MÉRT HIBA (2026-09-11, Elek FK-003b ⑤): az ELEK-TESZT leaden két „approved"
// artefaktum állt egyszerre. A lead-lap, a nyitókép-panel és a megkeresés viszont EGYES
// számban gondolkodik („a jóváhagyott mock"), és `active[0]`-t vesz — vagyis a képernyő
// egy tetszőlegesen kiválasztott mockot nevezett A jóváhagyottnak, a kurátor meg nem
// tudhatta, melyiket viszi tovább a megkeresés.
//
// Miért ŐR és nem UNIQUE INDEX: a §I-kivétel (amit már kiküldtünk, az áll) miatt két
// approved LEGÁLISAN is együtt élhet — egy kiküldött és egy új. Egy vak adatbázis-
// megszorítás ilyenkor magát a jóváhagyást utasítaná el. Az invariánst a kód tartja
// (console/data.curateArtifact), ez a script pedig MEGMÉRI, hogy tartja-e.
//
// Futtatás: npx tsx scripts/one-approved-check.mts

import { db } from "../src/db/client.js";

const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select(({ fn, ref }) => [
    "lead.id as leadId",
    "lead.name as name",
    fn.count<number>("mock_artifact.id").as("approved"),
    fn
      .count<number>(ref("mock_artifact.id"))
      .filterWhere(({ exists, selectFrom }) =>
        exists(
          selectFrom("prospect")
            .select("prospect.id")
            .whereRef("prospect.mock_artifact_id", "=", "mock_artifact.id")
            .where("prospect.sent_at", "is not", null),
        ),
      )
      .as("sent"),
  ])
  .where("mock_artifact.status", "=", "approved")
  .groupBy(["lead.id", "lead.name"])
  .having((eb) => eb(eb.fn.count("mock_artifact.id"), ">", 1))
  .execute();

// A megengedett többes: minden extra approved mögött KIKÜLDÖTT ajánlat áll (§I).
const bad = rows.filter((r) => Number(r.approved) - Number(r.sent) > 1);
for (const r of rows) {
  const extra = Number(r.approved) - Number(r.sent);
  console.log(
    `${extra > 1 ? "❌" : "✅"} ${r.name}: ${r.approved} approved (ebből ${r.sent} már kiküldve)`,
  );
}

// ── NEGATÍV ÖNTESZT: a számláló tényleg a „nem kiküldött" többletet nézi-e? ──────────
const probe = (approved: number, sent: number): boolean => approved - sent > 1;
const selfRed = probe(2, 0); // két jóváhagyott, egyik sem ment ki → PIROS
const selfGreen = !probe(2, 1) && !probe(1, 0); // kiküldött + új → zöld; egyetlen → zöld
console.log(
  `\n${selfRed && selfGreen ? "✅" : "❌"} önteszt: 2 nem-kiküldött → piros (${selfRed}), ` +
    `1 kiküldött + 1 új → zöld (${selfGreen})`,
);
if (!selfRed || !selfGreen) {
  console.error("⛔ A MÉRŐ VAK — a negatív kontroll nem viselkedik.");
  process.exit(1);
}

if (bad.length) {
  console.error(
    `\n⛔ ${bad.length} leaden egynél több NEM KIKÜLDÖTT jóváhagyott mock van. ` +
      "A felület egyes számban beszél róla („a jóváhagyott mock”), tehát a kurátor nem tudja, melyiket viszi a megkeresés.",
  );
  process.exit(1);
}
console.log(`\n✅ one-approved-check: leadenként legfeljebb egy nem-kiküldött jóváhagyott mock.`);
process.exit(0);
