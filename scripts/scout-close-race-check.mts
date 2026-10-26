// scout-close-race-check — a felderítő csempe lezárása EGYSZER történik, és egy második kérés
// nem csinálhatja vissza az elsőt.
//
// Miért (Magellan, 2026-10-26, megye-so F2, origin/main cf041692): két egyidejű
// POST /scout/tile/F2/close. A `closeScoutTile` zár nélkül olvasott, a csempe-update nem volt
// feltételes, így MINDKÉT kérés „sikeres” lezárást látott (procRows=80). A második kérés
// `startScoutJob`-ja „busy” lett (az első jobja futott), és a busy-ág `reopenScoutTile`-ja az
// első kérés friss lezárását visszacsinálta (proc → new), mielőtt az első job a forrást olvasta:
// a futás 0 sort kapott, és a `batchedRun` elnyelt forrás-hibával is „completed” lett.
//
// Amit mér:
//   ① két egyidejű close: pontosan EGY zár le (procRows = a new sorok), a másik `{error:"closed"}`;
//   ② a célzott újranyitás csak a megadott sorokat viszi vissza new-ba (másét nem), üres lista no-op;
//   ③ a forrás-fázis a forrás hibáját nem nyeli el: `failedSources` + figyelmeztetés a futáson;
//   ④ bekötés: a route a „closed” ágon nem indít jobot, a busy-ág csak a saját sorait nyitja,
//      a --scout futás forrás-hibán megbukik, a kliens kérés közben nem engedi újra a gombot.
//
// A közös dev DB-be saját, egyedi régiójú csempét ír, és a végén törli. Böngésző és AI nincs.
//   npx tsx scripts/scout-close-race-check.mts

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/db/client.js";
import { closeScoutTile, getTile, reopenScoutTile } from "../src/scout/store.js";
import { SCOUT_KEYWORDS } from "../src/scout/rules.js";
import { runSourcePhase } from "../src/scraper/batchedRun.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const REGION = `zz-guard-${randomUUID().slice(0, 8)}`;
const kw = Object.fromEntries(SCOUT_KEYWORDS.map((k) => [k, 1]));

let nextIdx = 0;
async function makeTile(label: string, places: number): Promise<string> {
  const idx = nextIdx++;
  const t = await db
    .insertInto("scout_tile")
    .values({
      region: REGION, parent_id: null, idx, grid_row: 0, grid_col: idx, label,
      south: 46.9, west: 18.0, north: 46.95, east: 18.1, state: "work", kw: JSON.stringify(kw),
      closed_at: null, scrape_run_id: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let i = 0; i < places; i++) {
    await db
      .insertInto("scout_place")
      .values({
        tile_id: t.id, region: REGION, name: `Guard ${label} ${i}`, lat: 46.91 + i / 1000, lon: 18.05,
        ftid: null, link: `https://maps.example/${label}/${i}`, status: "new", known_lead_id: null,
        address: null, city: null, phone: null, website: null, photo_count: null, rating: null,
        rating_count: null, found_links: null, verdict: null, category: null, lead_id: null,
      })
      .execute();
  }
  return t.id;
}

async function statuses(tileId: string): Promise<string[]> {
  const r = await db.selectFrom("scout_place").select("status").where("tile_id", "=", tileId).execute();
  return r.map((x) => x.status).sort();
}

try {
  // An inactive throw-away region (never offered on the launcher), removed in `finally`.
  await db
    .insertInto("region")
    .values({ id: REGION, label: "guard", south: 46.9, west: 18.0, north: 46.95, east: 18.1, center_lat: null, center_lon: null, radius_km: null, active: false })
    .execute();
  console.log("① két egyidejű lezárás");
  const a = await makeTile("A", 3);
  const tile = (await getTile(a))!;
  const [r1, r2] = await Promise.all([closeScoutTile(tile), closeScoutTile(tile)]);
  const ok = [r1, r2].filter((r) => "procRows" in r);
  const closed = [r1, r2].filter((r) => "error" in r && r.error === "closed");
  check("pontosan egy kérés zár le", ok.length === 1 && closed.length === 1, [r1, r2]);
  check("a lezáró a három új sort viszi feldolgozásba (RETURNING)", ok[0] !== undefined && "procRows" in ok[0] && ok[0].procRows === 3 && ok[0].procIds.length === 3, ok[0]);
  check("a sorok proc állapotban maradnak", JSON.stringify(await statuses(a)) === JSON.stringify(["proc", "proc", "proc"]), await statuses(a));
  const again = await closeScoutTile((await getTile(a))!);
  check("a már lezárt csempe újabb lezárása: closed", "error" in again && again.error === "closed", again);

  console.log("② célzott újranyitás");
  const b = await makeTile("B", 2);
  const rb = await closeScoutTile((await getTile(b))!);
  const foreign = await db.selectFrom("scout_place").select("id").where("tile_id", "=", a).limit(1).executeTakeFirstOrThrow();
  await reopenScoutTile(a, []);
  check("üres lista: semmi nem nyílik újra", JSON.stringify(await statuses(a)) === JSON.stringify(["proc", "proc", "proc"]));
  if ("procIds" in rb) {
    await reopenScoutTile(b, rb.procIds.slice(0, 1));
    check("csak a megadott sor megy vissza new-ba", JSON.stringify(await statuses(b)) === JSON.stringify(["new", "proc"]), await statuses(b));
    await reopenScoutTile(b, [foreign.id]);
    check("más csempe sora nem nyílik újra ezen az úton", JSON.stringify(await statuses(a)) === JSON.stringify(["proc", "proc", "proc"]));
  } else check("B lezárható", false, rb);

  console.log("③ a forrás hibája nem nyelődik el");
  const boom = { name: "magellan", fetch: async () => { throw new Error("teszt-hiba"); } };
  const src = await runSourcePhase(randomUUID(), null, [boom as never], {} as never, () => {});
  check("failedSources a hibás forrást nevezi", src.failedSources.length === 1 && src.failedSources[0] === "magellan", src.failedSources);
  check("a hiba figyelmeztetésként a futáson marad", src.warnings.some((w) => /magellan.*hibával állt le.*teszt-hiba/.test(w)), src.warnings);

  console.log("④ bekötés");
  const read = (p: string) => readFileSync(path.join(import.meta.dirname, "..", p), "utf8");
  const routes = read("src/console/scoutRoutes.ts");
  check("route: a „closed” ág nem indít jobot", /r\.error === "closed"[\s\S]{0,400}?return true;/.test(routes) && routes.indexOf('r.error === "closed"') < routes.indexOf("startScoutJob("));
  check("route: a busy-ág csak a saját sorait nyitja (procIds)", /reopenScoutTile\(tile\.id, r\.procIds\)/.test(routes));
  const run = read("src/scraper/run.ts");
  check("run.ts: --scout forrás-hibán megbukik, 0 sornál figyelmeztet", /if \(scout\) \{[\s\S]{0,300}failedSources\.length[\s\S]{0,200}throw new Error/.test(run) && /0 munkalap-sort/.test(run));
  const views = read("src/console/scoutViews.ts");
  check("kliens: kérés közben a lezáró gomb nem engedélyeződik újra", /t\.canClose&&!closing/.test(views) && /if\(closing\)return;closing=true/.test(views));
} finally {
  const tiles = await db.selectFrom("scout_tile").select("id").where("region", "=", REGION).execute();
  if (tiles.length) {
    await db.deleteFrom("scout_place").where("tile_id", "in", tiles.map((t) => t.id)).execute();
    await db.deleteFrom("scout_tile").where("region", "=", REGION).execute();
  }
  await db.deleteFrom("region").where("id", "=", REGION).execute();
  await db.destroy();
}

if (failures) {
  console.error(`\n❌ scout-close-race-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ scout-close-race-check: a csempe egyszer zárul, a második kérés nem csinálja vissza, a forrás hibája látszik.");
