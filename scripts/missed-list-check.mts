// ŐR: egy lapon EGY igazság — a „mi maradt ki a szövegből" lista nem térhet el
// önmagától a lead-lap két panelje között.
//
// ⛔ MÉRT HIBA (2026-09-11, Elek FK-003b ③): ugyanaz a lap fent „3 dolgot nem említ"-et
// írt (Wifi · Akadálymentes · Kerthelyiség), lent „4 igazolt tény kimaradt a szövegből"-t
// (Wifi · Akadálymentes · Babafelszerelés · Kert és grill). Más SZÁM és részben más
// TÉTELEK, ugyanabból a `marketMissed`-ből — a kurátornak nem volt honnan tudnia, melyik
// igaz. A hibát semmilyen típus vagy teszt nem foghatta meg: mindkét panel „helyesen"
// működött külön-külön.
//
// Mit bizonyít ez a script:
//  ① A KIRENDERELT LAPBÓL szedi ki mindkét listát (a szöveg-panel chipjei és a
//    forrás-panel `.sp-miss` sora), nem a közös segédfüggvény kétszeri hívásából. Az
//    utóbbi önmagával hasonlítaná össze magát, és akkor is zöld lenne, ha az egyik panel
//    közben visszatérne a nyers listához. Az őr azt mérje, ami SZÁMÍT.
//  ② VALÓDI leadeken fut, az adatbázis mock-artefaktumaival.
//  ③ NEGATÍV ÖNTESZT: egy szándékosan széthúzott bemeneten a mérőnek PIROSNAK kell
//    lennie. Enélkül a csupa-zöld semmit nem bizonyít (2026-09-09: egy elgépelt kulcs
//    miatt 17 sablon mért ugyanazt, csupa zölddel).
//
// Futtatás: npx tsx scripts/missed-list-check.mts [darabszám]

import { db } from "../src/db/client.js";
import { getLead } from "../src/console/data.js";
import { leadPage } from "../src/console/views.js";

const LIMIT = Number(process.argv[2] ?? "12");

/** A szöveg-panel „Ezeket nem említi" chipjei a kirenderelt HTML-ből. */
function topList(html: string): string[] {
  const box = /<div class="cp-chips" id="cp-miss">([\s\S]*?)<\/div>/.exec(html);
  if (!box) return [];
  return [...box[1]!.matchAll(/<span class="cp-pl">\+<\/span>([^<]*)</g)].map((m) => m[1]!.trim());
}

/** A forrás-panel „N igazolt tény kimaradt a szövegből" felsorolása. */
function bottomList(html: string): { items: string[]; count: number | null } {
  const box = /<div class="sp-miss">([\s\S]*?)<\/div>/.exec(html);
  if (!box) return { items: [], count: null };
  const n = /<b>\s*(\d+)\s/.exec(box[1]!);
  const span = /<span>([\s\S]*?)—/.exec(box[1]!);
  const items = span
    ? span[1]!
        .split("·")
        .map((s) => s.replace(/<[^>]*>/g, "").trim())
        .filter(Boolean)
    : [];
  return { items, count: n ? Number(n[1]) : null };
}

const norm = (a: readonly string[]): string =>
  [...a].map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()).sort().join(" | ");

interface Row {
  name: string;
  top: string[];
  bottom: string[];
  count: number | null;
  ok: boolean;
}

async function measure(): Promise<Row[]> {
  const leads = await db
    .selectFrom("mock_artifact")
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select(["lead.id as id", "lead.name as name"])
    .where("mock_artifact.inputs", "?", "marketMissed")
    .groupBy(["lead.id", "lead.name"])
    .orderBy("lead.name")
    .limit(LIMIT)
    .execute();

  const rows: Row[] = [];
  for (const l of leads) {
    const d = await getLead(l.id);
    if (!d) continue;
    const html = leadPage(d);
    const top = topList(html);
    const bottom = bottomList(html);
    // Ha egyik panel sem írt ki listát, nincs mit egyeztetni (nem lelet).
    if (!top.length && !bottom.items.length) continue;
    rows.push({
      name: l.name,
      top,
      bottom: bottom.items,
      count: bottom.count,
      // A SZÁM és a TARTALOM is egyezzen: a tulaj mindkettőt olvassa.
      ok: norm(top) === norm(bottom.items) && bottom.count === bottom.items.length,
    });
  }
  return rows;
}

const rows = await measure();
let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(
    `${r.ok ? "✅" : "❌"} ${r.name}\n` +
      `     fent (${r.top.length}): ${r.top.join(" · ") || "—"}\n` +
      `     lent (${r.count ?? "?"}): ${r.bottom.join(" · ") || "—"}`,
  );
}
if (!rows.length) console.log("⚠️  nincs mérhető lead (nincs marketMissed-et hordozó artefaktum)");

// ── NEGATÍV ÖNTESZT ─────────────────────────────────────────────────────────────
// Ugyanaz a mérő egy SZÁNDÉKOSAN széthúzott lapon: ha ez zöld, a mérő vak.
// ⚠️ A fixture a VALÓDI markupot utánozza (chip = <button>, a felirat </button>-nel zárul).
// Az első változatom egy leegyszerűsített alakot használt, és a mérő emiatt csak az ELSŐ
// chipet látta — vagyis a negatív kontroll a ROSSZ okból lett volna piros. A fixture
// bizonyítsa a saját útját.
const chips = (labels: readonly string[]): string =>
  `<div class="cp-chips" id="cp-miss">${labels
    .map((l) => `<button type="button" class="cp-chip miss" data-t="${l.toLowerCase()}"><span class="cp-pl">+</span>${l}</button>`)
    .join("")}</div>`;
const spMiss = (labels: readonly string[]): string =>
  `<div class="sp-miss"><b>${labels.length} igazolt tény kimaradt a szövegből:</b>` +
  `<span>${labels.join(" · ")} — a fenti szöveg-panelen visszaadhatók.</span></div>`;
const fakeOk = `${chips(["Wifi", "Kert"])}${spMiss(["Wifi", "Kert"])}`;
const fakeBad = `${chips(["Wifi", "Kert"])}${spMiss(["Wifi", "Kert", "Babafelszerelés"])}`;
const selfOk =
  norm(topList(fakeOk)) === norm(bottomList(fakeOk).items) &&
  bottomList(fakeOk).count === bottomList(fakeOk).items.length;
const selfBad =
  norm(topList(fakeBad)) === norm(bottomList(fakeBad).items) &&
  bottomList(fakeBad).count === bottomList(fakeBad).items.length;
console.log(
  `\n${selfOk && !selfBad ? "✅" : "❌"} önteszt: az egyező lapra zöld (${selfOk}), ` +
    `a széthúzottra PIROS (${!selfBad})`,
);
if (!selfOk || selfBad) {
  console.error("⛔ A MÉRŐ VAK — a negatív kontroll nem bukott el. A zöld sorok semmit nem érnek.");
  process.exit(1);
}

if (bad) {
  console.error(
    `\n⛔ ${bad} leaden a lap KÉT KÜLÖNBÖZŐ listát ad ugyanarra a kérdésre. ` +
      "A „mi maradt ki” egyetlen forrása a views.missedAmenityGroups() — aki mást számol, az hazudik.",
  );
  process.exit(1);
}
console.log(`\n✅ missed-list-check: ${rows.length} lead, mindkét panel ugyanazt mondja.`);
process.exit(0);
