// work-queue-check — a hosszú munka a KÜLÖN dolgozóban fut, a deploy nem vár rá és nem veszíti el
// (ADR-XXXX, tulaj 2026-11-26: „a deploy prioritást élvez”).
//
// Miért: mérve 2026-09-11 és 2026-11-26 (scripts/scrape-restart-probe.mts, a régi kódon): a
// felderítés a konzol gyerekfolyamata volt, a `systemctl restart citoviso-console` megölte, a
// csempe 8 sora `proc`-ban ragadt, és senki nem folytatta — ezért várt a deploy GATE 4-e.
//
// Amit mér (a közös dev DB-ben, saját eldobható `zz-restart-…` régióval, gyerekfolyamat nélkül, ~5 s):
//   ① a sorba tétel idempotens: ugyanaz a csempe kétszer = EGY élő job
//   ② a dolgozó halála (kill -9) után a következő dolgozó az árva jobot megszakítottnak jelöli,
//      és a hozzá tartozó, „running”-ban maradt futást is azonnal lezárja
//   ③ a megszakadt job visszamegy a sorba; ha nincs mit folytatni (0 proc sor) → kész; ha
//      MAX_RESUME_ATTEMPTS-szer szakadt meg → feladja (nem végtelen hurok)
//   ④ a dolgozón KÍVÜL indított (ssh) és megszakadt futás job-leírásából új job lesz, egyszer
//   ⑤ deploy-jelző alatt a folytató semmit nem indít
//   ⑥ a beragadt-csempe takarító nem nyitja újra azt a csempét, aminek a munkája él vagy
//      folytatásra vár — a valóban beragadtat igen
//   ⑦ bekötés: a konzol nem indít gyerekfolyamatot (csak sorba tesz), a run.ts leírja magát,
//      adaghatáron megáll, a jelre kétszer is helyesen reagál; a dolgozó a run.ts-t közvetlenül
//      (nem npx-burokban) indítja; a unit a repóban van, prod célú; a deploy a kódcsere előtt jelez
//
//   npx tsx scripts/work-queue-check.mts
//   npx tsx scripts/work-queue-check.mts --self-test
//     ⛔ NEGATÍV FUTÁS (visszarontás): ugyanezek a mérések a RÉGI viselkedésre — sima (dedupe
//     nélküli) sorba tétel, a régi in-process spawn-os scrapeJob.ts, a `process.once`-os run.ts és
//     a várakoztató deploy-prod.sh (git-ből, 431c83ac) → mindnek PIROSNAK kell lennie.
//
// A viselkedés valós folyamatokkal: scripts/scrape-restart-probe.mts (konzol-restart, kill -9,
// deploy-jelző — duplikátum- és veszteség-méréssel).

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { MAX_RESUME_ATTEMPTS } from "../src/scraper/jobSpec.js";
import { reapStuckScoutTiles } from "../src/scout/store.js";
import { claimNextWork, enqueueWork, releaseOrphanedWork } from "../src/worker/queue.js";
import { resumeInterrupted } from "../src/worker/resume.js";

const SELF_TEST = process.argv.includes("--self-test");
const LEGACY = "431c83ac"; // origin/main before ADR-XXXX: in-process spawn, waiting GATE 4
const REGION = `zz-restart-${randomUUID().slice(0, 8)}`;
process.env.CIT_WORKER_ONLY_REGION = REGION; // this check's queue calls touch only its own region
const ROOT = path.join(import.meta.dirname, "..");
let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  const want = SELF_TEST ? !ok : ok;
  if (want) console.log(`  ✓ ${name}${SELF_TEST ? " (helyesen PIROS a régi viselkedésen)" : ""}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}${SELF_TEST ? " ← az önteszten ZÖLD maradt: ez a mérés nem mér semmit" : ""}`);
  }
}
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const legacy = (p: string) => execFileSync("git", ["show", `${LEGACY}:${p}`], { cwd: ROOT, encoding: "utf8" });

let nextIdx = 0;
async function makeTile(label: string, procRows: number): Promise<string> {
  const idx = nextIdx++;
  const t = await db
    .insertInto("scout_tile")
    .values({
      region: REGION, parent_id: null, idx, grid_row: 0, grid_col: idx, label,
      south: 46.9, west: 18.0, north: 46.95, east: 18.1, state: "done", kw: JSON.stringify({}),
      closed_at: new Date(Date.now() - 30 * 60_000), scrape_run_id: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let i = 0; i < procRows; i++) {
    await db
      .insertInto("scout_place")
      .values({
        tile_id: t.id, region: REGION, name: `Őr ${label} ${i}`, lat: 46.91 + i / 1000, lon: 18.05,
        ftid: null, link: `https://maps.example/wq/${label}/${i}`, status: "proc", known_lead_id: null,
        address: null, city: null, phone: null, website: null, photo_count: null, rating: null,
        rating_count: null, found_links: null, verdict: null, category: null, lead_id: null,
      })
      .execute();
  }
  return t.id;
}

let defId = "";
async function makeRun(status: "running" | "failed", job: Record<string, unknown> | null, interrupted: boolean): Promise<string> {
  const r = await db
    .insertInto("scrape_run")
    .values({
      scraper_definition_id: defId,
      status,
      started_at: new Date(Date.now() - 60_000),
      heartbeat_at: new Date(),
      finished_at: status === "failed" ? new Date() : null,
      stats: JSON.stringify(interrupted ? { interrupted: true } : {}),
      job: job ? JSON.stringify(job) : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
const jobRow = (id: string) => db.selectFrom("work_job").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const runRow = (id: string) => db.selectFrom("scrape_run").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
const liveJobs = () =>
  db.selectFrom("work_job").select(["id", "status", "payload"]).where(sql<boolean>`payload->>'region' = ${REGION}`).where("status", "in", ["queued", "running"]).execute();

const scratch = path.join(process.env.CLAUDE_CODE_TMPDIR || tmpdir(), `cit-wq-${REGION}`);
try {
  mkdirSync(scratch, { recursive: true });
  await db
    .insertInto("region")
    .values({ id: REGION, label: "zz work-queue őr", south: 46.9, west: 18.0, north: 46.95, east: 18.1, center_lat: null, center_lon: null, radius_km: null, active: false })
    .execute();
  defId = (
    await db
      .insertInto("scraper_definition")
      .values({ label: "zz őr", country: "HU", region: `${REGION}:magellan`, industry: "accommodation", sources: JSON.stringify(["magellan"]) })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;

  console.log("① a sorba tétel idempotens");
  const tA = await makeTile("A", 3);
  if (SELF_TEST) {
    // legacy stand-in: a plain insert per click, no live key
    for (let i = 0; i < 2; i++)
      await db.insertInto("work_job").values({ kind: "scout", payload: JSON.stringify({ region: REGION, scout: tA }), dedupe_key: null, enqueued_by: "legacy" }).execute();
  } else {
    await enqueueWork("scout", { region: REGION, scout: tA }, "check");
    await enqueueWork("scout", { region: REGION, scout: tA }, "check");
  }
  check("ugyanaz a csempe kétszer sorba téve = egy élő job", (await liveJobs()).length === 1, (await liveJobs()).length);
  await db.deleteFrom("work_job").where(sql<boolean>`payload->>'region' = ${REGION}`).execute();

  if (!SELF_TEST) {
    console.log("② kill -9 után: árva job + futó sora");
    const jA = (await enqueueWork("scout", { region: REGION, scout: tA }, "check"))!;
    const claimed = await claimNextWork();
    check("a dolgozó felveszi (running, attempts 1)", claimed?.id === jA && (await jobRow(jA)).status === "running" && (await jobRow(jA)).attempts === 1);
    const rA = await makeRun("running", { region: REGION, scout: tA, workJob: jA, attempt: 1 }, false);
    const n = await releaseOrphanedWork();
    check("a következő dolgozó az árva jobot megszakítottnak jelöli", n === 1 && (await jobRow(jA)).status === "interrupted");
    const ra = await runRow(rA);
    check("…és a „running”-ban maradt futását azonnal lezárja (interrupted)", ra.status === "failed" && (ra.stats as { interrupted?: boolean }).interrupted === true, ra.status);

    console.log("③ folytatás a sorból");
    let out = await resumeInterrupted(() => false);
    check("a megszakadt job visszamegy a sorba", out.some((o) => o.id === jA && o.outcome === "requeued") && (await jobRow(jA)).status === "queued", out);
    check("a futása foglaltnak számít (a ④ ág nem tesz be még egyet)", (await runRow(rA)).resumed_at !== null && (await liveJobs()).length === 1);
    await db.updateTable("work_job").set({ status: "interrupted", finished_at: new Date() }).where("id", "=", jA).execute();
    await db.updateTable("scout_place").set({ status: "lead" }).where("tile_id", "=", tA).execute();
    out = await resumeInterrupted(() => false);
    check("0 proc sor: nincs mit folytatni → kész, nem indul újra", out.some((o) => o.id === jA && o.outcome === "nothing-left") && (await jobRow(jA)).status === "done", out);
    const tB = await makeTile("B", 2);
    const jB = (await enqueueWork("scout", { region: REGION, scout: tB }, "check"))!;
    await db.updateTable("work_job").set({ status: "interrupted", finished_at: new Date(), attempts: MAX_RESUME_ATTEMPTS }).where("id", "=", jB).execute();
    out = await resumeInterrupted(() => false);
    check(`${MAX_RESUME_ATTEMPTS}. megszakítás után feladja (nincs végtelen hurok)`, out.some((o) => o.id === jB && o.outcome === "gave-up") && (await jobRow(jB)).status === "failed", out);

    console.log("④ a dolgozón kívül (ssh) indított futás");
    const tC = await makeTile("C", 2);
    const rC = await makeRun("failed", { region: REGION, scout: tC, cap: null, attempt: 1, resumeOf: null, workJob: null }, true);
    out = await resumeInterrupted(() => false);
    const live = await liveJobs();
    check("a megszakadt ssh-futásból új job lesz (resumeOf, attempt 2)", out.some((o) => o.id === rC && o.outcome === "enqueued") && live.some((j) => (j.payload as { resumeOf?: string; attempt?: number }).resumeOf === rC && (j.payload as { attempt?: number }).attempt === 2), { out, live });
    out = await resumeInterrupted(() => false);
    check("…egyszer: a második menet nem tesz be még egyet", !out.some((o) => o.id === rC) && (await liveJobs()).length === 1, out);
    const rOld = await makeRun("failed", null, true);
    out = await resumeInterrupted(() => false);
    check("job-leírás nélküli (régi kódú) futást nem indít", !out.some((o) => o.id === rOld));

    console.log("⑤ deploy-jelző alatt");
    const tD = await makeTile("D", 2);
    const rD = await makeRun("failed", { region: REGION, scout: tD, cap: null, attempt: 1, resumeOf: null, workJob: null }, true);
    out = await resumeInterrupted(() => true);
    check("a folytató semmit nem indít, a futás vár", out.length === 0 && (await runRow(rD)).resumed_at === null);
    const marker = path.join(scratch, "DEPLOYING");
    writeFileSync(marker, "x");
    process.env.CIT_DEPLOY_MARKER = marker;
    out = await resumeInterrupted();
    check("…a valódi jelzőfájlra is (CIT_DEPLOY_MARKER)", out.length === 0 && (await runRow(rD)).resumed_at === null);
    rmSync(marker);

    console.log("⑥ a beragadt-csempe takarító");
    const tE = await makeTile("E", 2); // pending resume (rD style)
    await makeRun("failed", { region: REGION, scout: tE, cap: null, attempt: 1, resumeOf: null, workJob: null }, true);
    const tF = await makeTile("F", 2); // live run of an ssh script
    await makeRun("running", { region: REGION, scout: tF, cap: null, attempt: 1, resumeOf: null, workJob: null }, false);
    const tG = await makeTile("G", 2); // truly stuck: nothing runs, nothing waits
    await reapStuckScoutTiles(REGION, []);
    const st = async (t: string) => (await db.selectFrom("scout_tile").select("state").where("id", "=", t).executeTakeFirstOrThrow()).state;
    check("folytatásra váró csempét nem nyit újra", (await st(tE)) === "done");
    check("élő (ssh) futás csempéjét nem nyit újra", (await st(tF)) === "done");
    check("a valóban beragadtat újranyitja", (await st(tG)) === "work");
  }

  console.log("⑦ bekötés");
  const scrapeJob = SELF_TEST ? legacy("src/console/scrapeJob.ts") : read("src/console/scrapeJob.ts");
  check("a konzol nem indít gyerekfolyamatot (csak sorba tesz)", !/node:child_process/.test(scrapeJob) && /enqueueWork\(/.test(scrapeJob));
  const run = SELF_TEST ? legacy("src/scraper/run.ts") : read("src/scraper/run.ts");
  check("run.ts leírja magát a során (recordScrapeJob)", /await recordScrapeJob\(runId, job\)/.test(run));
  check("run.ts adaghatáron megáll a deploy-jelzőre", /shouldStop: \(\) => deployInProgress\(\)/.test(run) && /err instanceof StopAtBoundary/.test(run));
  check("run.ts a jelre kétszer is helyesen reagál (on + őr, nem once)", /process\.on\(sig,[\s\S]{0,80}if \(stopping\) return;/.test(run) && !/process\.once\(sig/.test(run));
  if (!SELF_TEST) {
    const worker = read("src/worker/main.ts");
    check("a dolgozó a run.ts-t közvetlenül indítja (process.execPath --import tsx), nem npx-burokban", /spawn\(process\.execPath, \["--import", "tsx"/.test(worker) && !/spawn\("npx"/.test(worker));
    const unit = read("deploy/systemd/citoviso-worker.service");
    const targets = JSON.parse(read("deploy/systemd/targets.json")) as { services: Record<string, { target: string }> };
    check("a dolgozó unitja a repóban, Restart=always, prod célú", /Restart=always/.test(unit) && /src\/worker\/main\.ts/.test(unit) && targets.services["citoviso-worker.service"]?.target === "prod");
  }
  const deploy = SELF_TEST ? legacy("scripts/deploy-prod.sh") : read("scripts/deploy-prod.sh");
  check(
    "a deploy nem vár: a kódcsere előtt jelez, a restart után igazol",
    /^deploy_signal$/m.test(deploy) && /^worker_continue_check$/m.test(deploy) && !/Várd meg a végét/.test(deploy),
  );
} finally {
  await db.deleteFrom("work_job").where(sql<boolean>`payload->>'region' = ${REGION}`).execute().catch(() => {});
  await db.deleteFrom("scout_place").where("region", "=", REGION).execute().catch(() => {});
  await db.deleteFrom("scout_tile").where("region", "=", REGION).execute().catch(() => {});
  if (defId) await db.deleteFrom("scrape_run").where("scraper_definition_id", "=", defId).execute().catch(() => {});
  await db.deleteFrom("scraper_definition").where("region", "=", `${REGION}:magellan`).execute().catch(() => {});
  await db.deleteFrom("region").where("id", "=", REGION).execute().catch(() => {});
  rmSync(scratch, { recursive: true, force: true });
  await db.destroy();
}
if (failures) {
  console.error(`\n⛔ work-queue-check${SELF_TEST ? " --self-test" : ""}: ${failures} hiba`);
  process.exit(1);
}
console.log(SELF_TEST ? "\n✅ önteszt: minden mérés pirosra megy a régi viselkedésen" : "\n✅ work-queue-check: a hosszú munka a dolgozóban, a deploy nem vár és nem veszít munkát");
