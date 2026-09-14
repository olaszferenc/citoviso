// A TÁROLT pillanatkép ne idézzen olyan terület-nevet, amit azóta visszavontunk.
//
// MIÉRT (ADR-0143 ① nyitott pontja): a `balaton-north` terület címkéje „Balaton északi
// part" volt, a doboza viszont az EGÉSZ tavat fedi — a 0067 migráció ezért „Balaton"-ra
// javította. A már legyártott mockok `inputs` pillanatképe azonban a RÉGI címkét őrzi, és
// az `inputs` nem archívum: a `rerender-mock.mts` ebből renderel újra („the persisted
// inputs ARE the design"), tehát egy determinisztikus újrarenderelés VISSZAHOZNÁ a hamis
// partoldal-állítást — déli parti és nem parti szereplőkre is.
//
// ⛔ AMIT SZÁNDÉKOSAN NEM CSINÁL — és miért:
//
// ① NEM „igazítja a tárolt címkét az élőhöz". Mérve: egy artefaktum `balaton-north`
//    területről jött, mégis „Badacsony (Badacsonytomaj környéke)" a tárolt címkéje, mert a
//    `resolveRegion()` a lead KOORDINÁTÁI alapján a szűkebb, bennfoglalt dobozt választotta.
//    Ez NEM hiba — egy vak „legyen egyenlő" szabály viszont elrontotta volna. A szkript
//    ezért kizárólag VISSZAVONT címkére illeszt: olyan sztringre, ami ma egyetlen
//    `region.label`-nek sem felel meg.
//
// ② NEM ír át PRÓZÁT. Egy artefaktumon a hamis állítás ragozva ül a szövegben („a Balaton
//    északi partján", egy KÖVESKÁLI — nem parti — szálláson). Ott a csere új hazugságot
//    gyártana („a Balaton partján" ugyanúgy hamis), a helyes orvosság az ÚJRAGENERÁLÁS.
//    A szkript ezt a sort NÉVVEL kiírja és érintetlenül hagyja — a `--go` sem nyúl hozzá.
//    Kizárólag PONTOS címke-idézeteket cserél: `inputs.region` és a `copy.eyebrow`-szerű
//    mezők, ahol a címke önmagában, régió-jelölőként áll.
//
// Biztosítékok: alapból SZÁRAZ futás · sha256-os mentés az írás ELŐTT · egy tranzakció ·
// frissítés AZONOSÍTÓ szerint · visszaolvasás · és hangosan kiírja, mit hagyott ki.
//
//   npx tsx scripts/backfill-artifact-region.mts          # száraz futás (alapértelmezett)
//   npx tsx scripts/backfill-artifact-region.mts --go     # tényleges írás

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/db/client.js";

const GO = process.argv.includes("--go");
const ROOT = path.resolve(import.meta.dirname, "..");

/** Prose fields: a retired label INSIDE a sentence is not substitutable (see ② above). */
const PROSE_KEYS = new Set(["intro", "tagline", "introBase", "body", "text", "description"]);

interface Hit {
  readonly at: string;
  readonly value: string;
  readonly prose: boolean;
}

/** Every string leaf equal to — or containing — one of the retired labels. */
function findQuotes(node: unknown, retired: Set<string>, at = "$", key = ""): Hit[] {
  if (typeof node === "string") {
    for (const r of retired) {
      if (node === r) return [{ at, value: node, prose: false }];
      if (node.includes(r) || node.includes(r.replace(/ part$/, " partj"))) {
        return [{ at, value: node, prose: true }];
      }
    }
    // inflected forms of the retired label's tail ("…északi partján", "…partvidékének")
    for (const r of retired) {
      const stem = r.split(" ").slice(-2).join(" ").replace(/t$/, "");
      if (stem.length > 6 && node.includes(stem)) return [{ at, value: node, prose: true }];
    }
    return [];
  }
  if (Array.isArray(node)) return node.flatMap((v, i) => findQuotes(v, retired, `${at}[${i}]`, key));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => findQuotes(v, retired, `${at}.${k}`, k));
  }
  return [];
}

/** Replace EXACT-match string leaves (never substrings) — returns a new object. */
function replaceExact(node: unknown, from: string, to: string, key = ""): unknown {
  if (typeof node === "string") {
    if (node !== from) return node;
    // A prose-named field never gets substituted, even on an exact match.
    return PROSE_KEYS.has(key) ? node : to;
  }
  if (Array.isArray(node)) return node.map((v) => replaceExact(v, from, to, key));
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, replaceExact(v, from, to, k)]),
    );
  }
  return node;
}

const liveLabels = new Set(
  (await db.selectFrom("region").select("label").execute()).map((r) => String(r.label)),
);
const areaLabel = new Map(
  (await db.selectFrom("region").select(["id", "label"]).execute()).map((r) => [
    String(r.id),
    String(r.label),
  ]),
);

const rows = await db
  .selectFrom("mock_artifact")
  .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
  .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
  .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
  .select([
    "mock_artifact.id as id",
    "mock_artifact.status as status",
    "mock_artifact.inputs as inputs",
    "lead.name as leadName",
    "lead.raw as raw",
    "scraper_definition.region as area",
  ])
  .execute();

// RETIRED labels — derived from the data, not typed in: any area-label-shaped value stored
// in an artifact that no live region carries. (Today: exactly the pre-0067 one.)
const retired = new Set<string>();
for (const r of rows) {
  const v = (r.inputs as Record<string, unknown> | null)?.region;
  if (typeof v === "string" && v && !liveLabels.has(v)) retired.add(v);
}

console.log(`mock_artifact: ${rows.length}`);
console.log(`élő terület-címkék: ${[...liveLabels].map((l) => `„${l}"`).join(", ")}`);
console.log(
  `VISSZAVONT, még idézett címke: ${retired.size ? [...retired].map((l) => `„${l}"`).join(", ") : "(nincs)"}`,
);
if (!retired.size) {
  console.log("\n✅ Nincs mit javítani.");
  await db.destroy();
  process.exit(0);
}

const toFix: { id: string; from: string; to: string; next: unknown; leadName: string; at: string[] }[] = [];
const proseOnly: string[] = [];
const skipped: string[] = [];

for (const r of rows) {
  const hits = findQuotes(r.inputs, retired);
  if (!hits.length) continue;
  const exact = hits.filter((h) => !h.prose);
  const prose = hits.filter((h) => h.prose);
  const city = ((r.raw ?? {}) as { city?: string }).city ?? "?";

  if (prose.length) {
    proseOnly.push(
      `  ${r.id} · ${r.status} · ${r.leadName} (${city})\n` +
        prose.map((p) => `      ${p.at}: „${p.value.slice(0, 110)}…"`).join("\n"),
    );
  }
  if (!exact.length) continue;

  const live = areaLabel.get(String(r.area));
  if (!live) {
    skipped.push(`  ${r.id} · ${r.leadName}: a gyűjtési területéhez (${r.area}) nincs élő rekord`);
    continue;
  }
  const from = exact[0]!.value;
  toFix.push({
    id: r.id,
    from,
    to: live,
    next: replaceExact(r.inputs, from, live),
    leadName: r.leadName,
    at: exact.map((e) => e.at),
  });
}

console.log(`\nPONTOS címke-idézet (cserélhető): ${toFix.length} artefaktum`);
const byField = new Map<string, number>();
for (const f of toFix) for (const a of f.at) byField.set(a.replace(/\[\d+\]/g, "[]"), (byField.get(a.replace(/\[\d+\]/g, "[]")) ?? 0) + 1);
for (const [k, v] of byField) console.log(`   ${String(v).padStart(3)}  ${k}`);

if (proseOnly.length) {
  console.log(`\n⛔ PRÓZÁBAN ÁLLÓ, RAGOZOTT állítás — NEM cserélem (újragenerálás kell): ${proseOnly.length}`);
  for (const p of proseOnly) console.log(p);
}
if (skipped.length) {
  console.log(`\n⚠️ KIHAGYVA: ${skipped.length}`);
  for (const s of skipped) console.log(s);
}

if (!GO) {
  console.log(`\n🔍 SZÁRAZ FUTÁS — semmi nem íródott. Íráshoz: --go`);
  await db.destroy();
  process.exit(0);
}

// ── Backup BEFORE the write, with a checksum that can prove it is whole ───────
const backupDir = path.join(ROOT, "_backups");
await mkdir(backupDir, { recursive: true });
const stamp = (await db.selectFrom("mock_artifact").select(db.fn.max("generated_at").as("t")).executeTakeFirst())?.t;
const name = `artifact-region-${String(stamp ?? "x").replace(/[^0-9]/g, "").slice(0, 14)}.json`;
const payload = JSON.stringify(
  rows.filter((r) => toFix.some((f) => f.id === r.id)).map((r) => ({ id: r.id, inputs: r.inputs })),
  null,
  2,
);
const sum = createHash("sha256").update(payload).digest("hex");
await writeFile(path.join(backupDir, name), payload, "utf8");
await writeFile(path.join(backupDir, `${name}.sha256`), `${sum}  ${name}\n`, "utf8");
console.log(`\n💾 Mentés az írás ELŐTT: _backups/${name} (sha256 ${sum.slice(0, 16)}…)`);

// ── One transaction, update BY ID, then read back ─────────────────────────────
await db.transaction().execute(async (trx) => {
  for (const f of toFix) {
    await trx
      .updateTable("mock_artifact")
      .set({ inputs: f.next as never })
      .where("id", "=", f.id)
      .execute();
  }
});

const after = await db.selectFrom("mock_artifact").select(["id", "inputs"]).execute();
let stillStale = 0;
for (const a of after) {
  if (findQuotes(a.inputs, retired).some((h) => !h.prose)) stillStale++;
}
console.log(`\n✅ ${toFix.length} artefaktum frissítve.`);
console.log(`   visszaolvasva — maradt PONTOS visszavont-címke idézet: ${stillStale} (várt: 0)`);
if (stillStale) {
  console.error("⛔ A visszaolvasás NEM üres — nézd meg kézzel, a mentés a backups/ alatt van.");
  await db.destroy();
  process.exit(1);
}
await db.destroy();
