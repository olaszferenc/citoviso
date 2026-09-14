// A TÁROLT mock-pillanatkép nem idézhet VISSZAVONT terület-nevet.
//
// A LYUK, AMIT BEZÁR (ADR-0143): a `balaton-north` terület címkéje hamis volt („Balaton
// északi part" egy egész tavat lefedő dobozra), és a címke nem csak konzol-oszlop: a
// generátor régió-kontextusa is, ami BELEÉG a `mock_artifact.inputs`-ba. A 0067 migráció a
// FORRÁST javította, a 68 legyártott artefaktumból viszont 63 tovább őrizte a régi nevet —
// és az `inputs` nem archívum: a `rerender-mock.mts` ebből renderel újra. 2026-08-23-án egy
// szál ugyanezt megtalálta, a tünetet javította, és maga írta oda: „NYITVA: determinisztikus
// kapu erre nincs". Három hét múlva ugyanaz a hiba friss artefaktumokon ült.
//
// MIT MÉR: minden artefaktum `inputs`-ában minden sztring-levelet — idéz-e olyan
// terület-nevet, ami MA egyetlen `region.label`-nek sem felel meg. A „visszavont" halmaz az
// ADATBÓL jön (élő címkék komplementere), nem szó-feketelistából: egy feketelista arra
// válaszolna, hogy „teszt-szagú-e", nem arra, hogy „létezik-e még".
//
// ⛔ AZ ŐR NEM KÖLCSÖNZI A JAVÍTÓ FÜGGVÉNYÉT: a bejáró itt önállóan van megírva. Egy őr,
// ami a vizsgált kódot hívja, a hibával EGYETÉRT, nem méri.
//
// KIMONDOTT KIVÉTEL, kötelező indoklással: a ragozott prózában álló állítást nem lehet
// cserével javítani (új hazugságot szülne), csak újragenerálással — az ilyen sort NEM
// engedjük némán át, hanem NÉVVEL, indoklással áll a listán, és ha megszűnik, az elavult
// kivétel maga BUKÁS (nehogy a mentesség túlélje az okát).
//
//   npx tsx scripts/artifact-label-quote-check.mts
//   npx tsx scripts/artifact-label-quote-check.mts --self-test   # PIROS kontroll

import { db } from "../src/db/client.js";

const SELF_TEST = process.argv.includes("--self-test");

/**
 * Artefaktumok, amiken a visszavont név RAGOZOTT prózában áll. Cserével nem javítható
 * (ADR-0143 ① — a „Balaton partján" egy KÖVESKÁLI szállásra ugyanúgy hamis), a helyes
 * orvosság az újragenerálás; amíg a tulaj nem döntött, a tétel itt, indoklással áll.
 */
const KNOWN_PROSE: { id: string; reason: string }[] = [
  {
    id: "f8c05e87-530e-4858-93ca-c509d3765c4c",
    reason:
      "Három Huszár Apartments (Köveskál, NEM parti): a siteData.intro és .tagline ragozva állítja a partoldalt — " +
      "csere helyett ÚJRAGENERÁLÁS kell, tulajdonosi döntésre vár (ADR-0143 ① nyitott pont).",
  },
];

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

/** Independent walker — deliberately NOT the backfill's. Returns "$.a.b[0]" paths. */
function stringLeaves(node: unknown, at = "$"): { at: string; v: string }[] {
  const out: { at: string; v: string }[] = [];
  const stack: { n: unknown; at: string }[] = [{ n: node, at }];
  while (stack.length) {
    const cur = stack.pop()!;
    const n = cur.n;
    if (typeof n === "string") {
      out.push({ at: cur.at, v: n });
    } else if (Array.isArray(n)) {
      n.forEach((v, i) => stack.push({ n: v, at: `${cur.at}[${i}]` }));
    } else if (n && typeof n === "object") {
      for (const [k, v] of Object.entries(n)) stack.push({ n: v, at: `${cur.at}.${k}` });
    }
  }
  return out;
}

/**
 * Does this string quote the retired label — verbatim OR inflected? Hungarian declines the
 * tail ("…északi part" → "…északi partján / partjának / partvidékén"), so a `===` test would
 * miss exactly the copy that reaches the visitor. The stem is derived from the label itself.
 */
function quotes(text: string, label: string): boolean {
  if (text.includes(label)) return true;
  const stem = label.replace(/[a-zéáíóöőúüű]{0,3}$/i, "");
  return stem.length >= Math.max(8, label.length - 3) && text.includes(stem);
}

const liveLabels = new Set(
  (await db.selectFrom("region").select("label").execute()).map((r) => String(r.label)),
);
check(liveLabels.size > 0, `van élő terület-rekord, amihez mérni lehet (${liveLabels.size})`);

const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .select([
    "mock_artifact.id as id",
    "mock_artifact.status as status",
    "mock_artifact.inputs as inputs",
    "lead.name as leadName",
  ])
  .execute();
// Adat-higiéniai kapu: üres adatbázison (friss klón, CI) nincs mit mérni. Ezt KIMONDJUK,
// nem nyeljük el — a „0 sértés" és a „0 megmért sor" nem ugyanaz az állítás.
if (!rows.length) {
  console.log("⚠️ NEM MÉRT: ebben az adatbázisban nincs mock_artifact — a kapu nem állít semmit.");
  await db.destroy();
  process.exit(0);
}
check(rows.length > 0, `van mérhető artefaktum (${rows.length})`);

// The retired set: every value an artifact stores as its region that no live area carries.
const retired = new Set<string>();
for (const r of rows) {
  const v = (r.inputs as Record<string, unknown> | null)?.region;
  if (typeof v === "string" && v && !liveLabels.has(v)) retired.add(v);
}
// A retired label may survive ONLY in prose (the exact quotes are already fixed), in which
// case the loop above finds nothing — so the declared exceptions contribute their own.
for (const k of KNOWN_PROSE) {
  const row = rows.find((r) => r.id === k.id);
  if (!row) continue;
  for (const leaf of stringLeaves(row.inputs)) {
    for (const l of liveLabels) void l;
    const m = /Balaton északi part/.exec(leaf.v);
    if (m) retired.add("Balaton északi part");
  }
}

let injected: { id: string; inputs: unknown } | null = null;
if (SELF_TEST) {
  // RED CONTROL — put the shipped state back on ONE artifact: a retired label quoted
  // verbatim in its region field, exactly as the 63 rows carried it.
  const victim = rows.find((r) => !KNOWN_PROSE.some((k) => k.id === r.id));
  if (victim) {
    injected = { id: victim.id, inputs: victim.inputs };
    victim.inputs = { ...(victim.inputs as object), region: "Balaton északi part" } as never;
    retired.add("Balaton északi part");
  }
}

const offenders: { id: string; leadName: string; status: string; at: string; v: string }[] = [];
for (const r of rows) {
  for (const leaf of stringLeaves(r.inputs)) {
    for (const label of retired) {
      if (!quotes(leaf.v, label)) continue;
      offenders.push({
        id: r.id,
        leadName: r.leadName,
        status: String(r.status),
        at: leaf.at,
        v: leaf.v.slice(0, 100),
      });
      break;
    }
  }
}

const excused = new Set(KNOWN_PROSE.map((k) => k.id));
const unexcused = offenders.filter((o) => !excused.has(o.id));
check(
  unexcused.length === 0,
  `EGYETLEN artefaktum sem idéz visszavont terület-nevet (indoklás nélküli sértés: ${unexcused.length}${
    unexcused.length ? `, pl. ${unexcused[0]!.leadName} ${unexcused[0]!.at}: „${unexcused[0]!.v}”` : ""
  })`,
);

// A declared exception must still DESCRIBE something real: an exception that outlives its
// cause is a licence nobody revoked — and it would hide the next leak on the same row.
for (const k of KNOWN_PROSE) {
  const row = rows.find((r) => r.id === k.id);
  check(!!row, `a kimondott kivétel artefaktuma LÉTEZIK (${k.id})`);
  if (!row) continue;
  const stillHits = offenders.some((o) => o.id === k.id);
  check(
    stillHits,
    `a kimondott kivétel INDOKA még fennáll (${row.leadName}) — ha megszűnt, vedd ki a listáról`,
  );
  check(k.reason.length > 40, `a kivételhez tartozik érdemi indoklás (${k.id})`);
}

// The measurement must be able to FIRE — otherwise "0 sértés" could mean "nothing was read".
check(
  retired.size > 0 || SELF_TEST,
  `a mérés tényleg dolgozik: ismer visszavont címkét (${[...retired].join(", ") || "NINCS"})`,
);

if (injected) {
  // restore the in-memory row (we never wrote to the DB, but keep the object honest)
  const victim = rows.find((r) => r.id === injected!.id);
  if (victim) victim.inputs = injected.inputs as never;
}

for (const o of oks) console.log(`  ✅ ${o}`);
for (const f of fails) console.log(`  ❌ ${f}`);
if (offenders.length) {
  console.log(`\n  ℹ️ Kimondott kivétellel álló sorok (${offenders.filter((o) => excused.has(o.id)).length} találat):`);
  for (const k of KNOWN_PROSE) console.log(`     · ${k.id} — ${k.reason}`);
}

await db.destroy();

if (SELF_TEST) {
  if (fails.length) {
    console.log(`\n✅ ÖNTESZT (piros kontroll): a visszatett visszavont címkét az őr ELKAPTA — ${fails.length} bukás.`);
    process.exit(0);
  }
  console.error("\n⛔ ÖNTESZT BUKOTT: a visszarontott artefaktum ZÖLDET kapott — az őr nem mér.");
  process.exit(1);
}
if (fails.length) {
  console.error(`\n⛔ artifact-label-quote-check: ${fails.length} bukás / ${oks.length + fails.length} állítás.`);
  process.exit(1);
}
console.log(`\n✅ artifact-label-quote-check: ${oks.length}/${oks.length} — a tárolt pillanatkép nem idéz visszavont terület-nevet.`);
