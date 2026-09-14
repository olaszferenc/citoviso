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
 * MIT KAPUZ ÉS MIT NEM — kimondva, mert a hallgatás itt hazugság lenne.
 *
 * KAPUZ: az ÖNÁLLÓAN álló címke-idézetet (`inputs.region`, `copy.eyebrow`-szerű régió-jelölő).
 * Ez mechanikusan javítható — a `backfill-artifact-region.mts` meg is teszi —, tehát a
 * visszarontása valódi, cselekvésre kész bukás.
 *
 * NEM KAPUZ, de MINDIG KIÍRJA: a RAGOZOTT prózát („…a Balaton északi partján…"). Ott a csere
 * új hazugságot szülne (a mért eset egy KÖVESKÁLI, azaz nem parti szállás — „a Balaton
 * partján" ugyanúgy hamis), a helyes orvosság az újragenerálás.
 *
 * ⛔ EZ A LISTA SZÁNDÉKOSAN NEM AZONOSÍTÓ-ALAPÚ. Az első változatában egy konkrét artefaktum
 * UUID-ja állt kivételként, ÉS az őr bukásnak vette, ha a kivétel artefaktuma eltűnik („a
 * mentesség ne élje túl az okát"). A tulaj jelezte, hogy a dev teszt-adatot a nap végi purge
 * elviszi — vagyis az az őr a purge MÁSNAPJÁN mindenkinél pirosra váltott volna, egy olyan ok
 * miatt, ami közben HELYESEN szűnt meg. Egy efemer dev-azonosító nem való commitolt kapuba: a
 * szabály SZERKEZETI (önálló idézet vs. próza), és a próza-találat nevesítve, számmal,
 * indoklással jelenik meg minden futáson.
 */

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

// A VISSZAVONT halmaz az ADATBÓL jön: minden érték, amit egy artefaktum a saját
// terület-neveként őriz, de ma egyetlen élő `region.label`-nek sem felel meg. Se szó-lista,
// se beégetett azonosító — a kérdés nem az, hogy „gyanús-e", hanem hogy „létezik-e még".
const retired = new Set<string>();
for (const r of rows) {
  const v = (r.inputs as Record<string, unknown> | null)?.region;
  if (typeof v === "string" && v && !liveLabels.has(v)) retired.add(v);
}

let injected: { id: string; inputs: unknown } | null = null;
if (SELF_TEST) {
  // PIROS KONTROLL — a kiszállított állapot visszatéve EGY artefaktumra: a visszavont név
  // szó szerint a region mezőben, pontosan úgy, ahogy a 63 soron állt.
  const victim = rows[0];
  if (victim) {
    injected = { id: victim.id, inputs: victim.inputs };
    victim.inputs = { ...(victim.inputs as object), region: "Balaton északi part" } as never;
    retired.add("Balaton északi part");
  }
}

// Nincs visszavont név → nincs elcsúszás, amit mérni lehetne. Ezt is KIMONDJUK: a „0 sértés"
// és a „nem volt mihez mérni" két különböző állítás.
if (!retired.size) {
  console.log(
    `⚠️ NEM MÉRT: egyetlen artefaktum sem őriz visszavont terület-nevet (${rows.length} sor átnézve,\n` +
      `   élő címkék: ${[...liveLabels].map((l) => `„${l}"`).join(", ")}) — a kapu nem állít semmit.`,
  );
  await db.destroy();
  process.exit(0);
}

interface Hit {
  readonly id: string;
  readonly leadName: string;
  readonly status: string;
  readonly at: string;
  readonly v: string;
  /** The label stands ALONE in this field → mechanically replaceable → gated. */
  readonly standalone: boolean;
}

/** Fields that carry a sentence, not a marker: there a quote is inflected prose. */
const PROSE_KEYS = /\.(intro|tagline|introBase|body|text|description|lead|sub)$/;

const hits: Hit[] = [];
for (const r of rows) {
  for (const leaf of stringLeaves(r.inputs)) {
    for (const label of retired) {
      if (!quotes(leaf.v, label)) continue;
      hits.push({
        id: r.id,
        leadName: r.leadName,
        status: String(r.status),
        at: leaf.at,
        v: leaf.v.slice(0, 110),
        standalone: leaf.v.trim() === label && !PROSE_KEYS.test(leaf.at),
      });
      break;
    }
  }
}

const standalone = hits.filter((h) => h.standalone);
const prose = hits.filter((h) => !h.standalone);

check(
  standalone.length === 0,
  `EGYETLEN artefaktum sem viseli ÖNÁLLÓAN a visszavont terület-nevet (sértés: ${standalone.length}${
    standalone.length ? `, pl. ${standalone[0]!.leadName} ${standalone[0]!.at}: „${standalone[0]!.v}”` : ""
  })`,
);

// A mérés tudjon TÜZELNI — különben a „0 sértés" azt is jelenthetné, hogy semmit nem olvasott.
check(
  retired.size > 0,
  `a mérés tényleg dolgozik: ismer visszavont címkét (${[...retired].map((l) => `„${l}"`).join(", ")})`,
);

if (injected) {
  const victim = rows.find((r) => r.id === injected!.id);
  if (victim) victim.inputs = injected.inputs as never;
}

for (const o of oks) console.log(`  ✅ ${o}`);
for (const f of fails) console.log(`  ❌ ${f}`);

// A NEM KAPUZOTT réteg — minden futáson kiírva, névvel. Ez nem „figyelmeztetés a kapu
// helyett": a kapu a mechanikusan javíthatót fogja, ez pedig kimondja, mi az, amit
// SZÁNDÉKOSAN nem javítunk cserével, és miért.
console.log(
  `\n  ℹ️ NEM KAPUZOTT — ragozott prózában álló idézet: ${prose.length}\n` +
    `     (a csere itt ÚJ hazugságot szülne, a helyes orvosság az újragenerálás)`,
);
for (const p of prose.slice(0, 10)) {
  console.log(`     · ${p.leadName} [${p.status}] ${p.at}: „${p.v}…”`);
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
