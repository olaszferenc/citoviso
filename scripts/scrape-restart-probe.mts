// scrape-restart-probe — does a felderítés job survive what a deploy (and worse) does to it?
// (ADR-0497, tulaj 2026-11-26: „a deploy prioritást élvez” — a deploy never waits for running work.)
//
// Dev machine only (the shared dev DB; the fő fa console :4600 for the console scenario).
// An ACTIVE throw-away region `zz-restart-<8>` with one tile and N rows whose websites point at
// a black hole (each row's website check waits for its timeout → the job runs long enough to be
// hit), processed by the WORKER (src/worker/main.ts — spawned by this probe as `node --import tsx`,
// its own deploy marker in the scratch dir, so nothing else on the machine sees it), then:
//
//   --scenario console   `sudo systemctl restart citoviso-console` mid-job → the job is untouched
//                        (same run.ts pid alive, the run completes)
//   --scenario kill9     `kill -9` of the worker mid-job (its child dies with it, like systemd's
//                        cgroup stop) → a new worker continues and completes it
//   --scenario deploy    the deploy marker mid-job → the child stops at its next batch boundary
//                        (exit 75, batch size 3 here), the worker idles; marker removed → the
//                        worker exits 0, a new one (the „new code”) continues and completes it
//
// Every scenario then checks: all rows left `proc` (lead / nolead), each row points at exactly one
// lead, and no lead was created twice (one per row name). Everything it created is removed.
//
//   npx tsx scripts/scrape-restart-probe.mts --scenario kill9 [--rows 8] [--wait 300]
//   … --via-console   close the tile through POST /scout/tile/<id>/close (the console enqueues)
//                     instead of enqueueing directly — needs this code in the fő fa console
//   … --expect continued|dead   exit 1 when the verdict differs (default: continued)

import { randomUUID } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { scoutKeywords } from "../src/scout/rules.js";
import { enqueueWork } from "../src/worker/queue.js";

const BASE = process.env.CIT_CONSOLE_URL ?? "http://localhost:4600";
const argv = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : d;
};
const SCENARIO = opt("--scenario", "kill9");
const ROWS = Number(opt("--rows", "8"));
const WAIT_S = Number(opt("--wait", "300"));
const EXPECT = opt("--expect", "continued");
const VIA_CONSOLE = argv.includes("--via-console");
const REGION = `zz-restart-${randomUUID().slice(0, 8)}`;
const WORKER = `probe-${REGION.slice(-8)}`;
const SCRATCH = path.join(process.env.CLAUDE_CODE_TMPDIR || tmpdir(), `cit-probe-${REGION}`);
const MARKER = path.join(SCRATCH, "DEPLOYING");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (s: string) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s ${s}`);

if (!["console", "kill9", "deploy"].includes(SCENARIO)) throw new Error(`ismeretlen --scenario: ${SCENARIO}`);

let worker: ChildProcess | null = null;
function startWorker(label: string): ChildProcess {
  const w = spawn(process.execPath, ["--import", "tsx", "src/worker/main.ts"], {
    cwd: path.join(import.meta.dirname, ".."),
    env: {
      ...process.env,
      CIT_WORKER_NAME: WORKER,
      CIT_DEPLOY_MARKER: MARKER,
      CIT_WORKER_ONLY_REGION: REGION, // the probe worker touches only its own region's jobs
      // several batches per tile, so the deploy scenario has a boundary to stop at
      SCRAPE_BATCH_SIZE: SCENARIO === "deploy" ? "3" : process.env.SCRAPE_BATCH_SIZE ?? "500",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = (b: Buffer) => {
    for (const l of b.toString("utf8").split("\n")) if (/\[worker |\[resume\]/.test(l)) log(`   ${label}│ ${l.trim()}`);
  };
  w.stdout?.on("data", tag);
  w.stderr?.on("data", tag);
  log(`   dolgozó indul (${label}, pid ${w.pid})`);
  return w;
}

function runTsPids(): string[] {
  try {
    return execFileSync("pgrep", ["-f", `src/scraper/[r]un\\.ts ${REGION} `], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function runs() {
  return db
    .selectFrom("scrape_run as r")
    .innerJoin("scraper_definition as d", "d.id", "r.scraper_definition_id")
    .select(["r.id", "r.status", "r.finished_at", "r.error"])
    .where("d.region", "=", `${REGION}:magellan`)
    .orderBy("r.created_at")
    .execute();
}
async function placeStatuses(tileId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of await db.selectFrom("scout_place").select("status").where("tile_id", "=", tileId).execute()) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

async function login(): Promise<string> {
  const txt = readFileSync(path.join(homedir(), ".config", "citoviso", "magellan-dev-operator.txt"), "utf8");
  const user = /Felhasználónév:\s*(\S+)/.exec(txt)?.[1] ?? "";
  const pass = /Jelszó:\s*(\S+)/.exec(txt)?.[1] ?? "";
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE },
    body: new URLSearchParams({ username: user, password: pass }).toString(),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`belépés sikertelen (HTTP ${res.status})`);
  return cookie;
}
async function consoleUp(maxS: number): Promise<number | null> {
  const start = Date.now();
  while (Date.now() - start < maxS * 1000) {
    try {
      if ((await fetch(`${BASE}/login`, { redirect: "manual" })).status < 500) return Math.round((Date.now() - start) / 1000);
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return null;
}

let verdict = "?";
let tileId = "";
try {
  mkdirSync(SCRATCH, { recursive: true });
  const kw = Object.fromEntries(scoutKeywords("HU").map((k) => [k, 1]));
  await db
    .insertInto("region")
    .values({ id: REGION, label: "zz restart-próba", south: 46.9, west: 18.0, north: 46.95, east: 18.1, center_lat: null, center_lon: null, radius_km: null, active: true })
    .execute();
  tileId = (
    await db
      .insertInto("scout_tile")
      .values({
        region: REGION, parent_id: null, idx: 0, grid_row: 0, grid_col: 0, label: "R1",
        south: 46.9, west: 18.0, north: 46.95, east: 18.1, state: VIA_CONSOLE ? "work" : "done", kw: JSON.stringify(kw),
        closed_at: VIA_CONSOLE ? null : new Date(), scrape_run_id: null,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  for (let i = 0; i < ROWS; i++) {
    await db
      .insertInto("scout_place")
      .values({
        tile_id: tileId, region: REGION, name: `Próba Vendégház ${i}`, lat: 46.905 + i * 0.004, lon: 18.05,
        ftid: null, link: `https://maps.example/restart/${REGION}/${i}`, status: VIA_CONSOLE ? "new" : "proc", known_lead_id: null,
        address: null, city: "Próbafalva", phone: null, website: `http://10.255.255.${i + 1}/`, photo_count: null,
        rating: null, rating_count: null, found_links: null, verdict: null, category: null, lead_id: null,
      })
      .execute();
  }
  log(`① ${REGION}: 1 csempe, ${ROWS} sor · forgatókönyv: ${SCENARIO}`);
  if (VIA_CONSOLE) {
    const cookie = await login();
    const r = await fetch(`${BASE}/scout/tile/${tileId}/close`, { method: "POST", headers: { cookie, origin: BASE, "content-type": "application/json" }, body: "{}" });
    const b = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
    if (b.error) throw new Error(`a lezárás nem ment: ${b.error} ${b.message ?? ""}`);
    log("   lezárva a konzolon át — a konzol sorba tette");
  } else {
    await enqueueWork("scout", { region: REGION, scout: tileId }, "probe");
    log("   sorba téve (work_job)");
  }
  worker = startWorker("1");

  let running = false;
  for (let i = 0; i < 90 && !running; i++) {
    running = (await runs()).some((r) => r.status === "running");
    if (!running) await sleep(1000);
  }
  if (!running) throw new Error("a job 90 mp alatt sem nyitott futást");
  await sleep(4000);
  const pidsBefore = runTsPids();
  log(`② fut · run.ts pid ${pidsBefore.join(",") || "—"} · sorok ${JSON.stringify(await placeStatuses(tileId))}`);

  const hitAt = new Date();
  if (SCENARIO === "console") {
    log("   sudo systemctl restart citoviso-console …");
    execFileSync("sudo", ["-n", "systemctl", "restart", "citoviso-console"], { stdio: "inherit" });
    log(`   konzol újra fent: ${(await consoleUp(120)) ?? "NEM"} mp`);
    const alive = pidsBefore.filter((p) => runTsPids().includes(p));
    log(`   a run.ts folyamat ${alive.length ? `ÉL (${alive.join(",")}) — a konzol-restart nem érte el` : "MEGHALT"}`);
  } else if (SCENARIO === "kill9") {
    log(`   kill -9 a dolgozóra (pid ${worker.pid}) és a gyerekére — ahogy a systemd a cgroupot …`);
    process.kill(worker.pid!, "SIGKILL");
    for (const p of pidsBefore) process.kill(Number(p), "SIGKILL");
    await sleep(2000);
    worker = startWorker("2 (a systemd Restart=always helyett)");
  } else {
    writeFileSync(MARKER, new Date().toISOString());
    log("   deploy-jelző kint — a futó darab a következő adaghatáron áll meg; a deploy NEM vár");
    for (let i = 0; i < 120; i++) {
      if (!runTsPids().length) break;
      await sleep(1000);
    }
    log(`   a darab megállt: ${runTsPids().length ? "NEM (120 mp)" : "igen"} · runs ${(await runs()).map((r) => r.status).join(",")} · sorok ${JSON.stringify(await placeStatuses(tileId))}`);
    await sleep(3000);
    rmSync(MARKER, { force: true });
    log("   deploy-jelző le — a dolgozó kilép, az „új kód” indul");
    const old = worker;
    await new Promise<void>((r) => (old.exitCode !== null ? r() : old.once("exit", () => r())));
    log(`   az 1. dolgozó kilépett (exit ${old.exitCode})`);
    worker = startWorker("2 (új kód)");
  }

  const deadline = Date.now() + WAIT_S * 1000;
  let last = "";
  while (Date.now() < deadline) {
    const rs = await runs();
    const st = await placeStatuses(tileId);
    const line = `runs ${rs.map((r) => `${r.id.slice(0, 8)}:${r.status}`).join(" ")} · sorok ${JSON.stringify(st)}`;
    if (line !== last) log(`③ ${line}`);
    last = line;
    const completedAfter = rs.some((r) => r.status === "completed" && r.finished_at && r.finished_at > hitAt);
    if (completedAfter && !st.proc && !rs.some((r) => r.status === "running")) {
      verdict = "continued";
      break;
    }
    await sleep(2000);
  }
  if (verdict === "?") verdict = "dead";

  // ④ no duplicates: every row → exactly one lead; one lead per row name
  const places = await db.selectFrom("scout_place").select(["name", "status", "lead_id"]).where("tile_id", "=", tileId).execute();
  const leads = await db
    .selectFrom("lead as l")
    .innerJoin("scrape_run as r", "r.id", "l.scrape_run_id")
    .innerJoin("scraper_definition as d", "d.id", "r.scraper_definition_id")
    .select(["l.id", "l.name"])
    .where("d.region", "=", `${REGION}:magellan`)
    .execute();
  const byName = new Map<string, number>();
  for (const l of leads) byName.set(l.name, (byName.get(l.name) ?? 0) + 1);
  const dupes = [...byName].filter(([, n]) => n > 1);
  const unlinked = places.filter((p) => p.status !== "nolead" && !p.lead_id);
  log(`④ leadek: ${leads.length} · ${ROWS} sor · duplikátum: ${dupes.length ? JSON.stringify(dupes) : "0"} · lead nélküli sor: ${unlinked.length}`);
  if (verdict === "continued" && (dupes.length || unlinked.length)) verdict = "duplicated-or-lost";
  for (const r of await runs()) log(`   · ${r.id.slice(0, 8)} ${r.status}${r.error ? ` — ${r.error.slice(0, 120)}` : ""}`);
  log(
    `ÍTÉLET (${SCENARIO}): ${verdict === "continued" ? "✅ a munka magától végigment, duplikátum és veszteség nélkül" : `❌ ${verdict}`}`,
  );
} catch (e) {
  verdict = `error: ${(e as Error).message}`;
  console.error(`HIBA: ${(e as Error).message}`);
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 3000));
  }
  for (const p of runTsPids()) process.kill(Number(p), "SIGKILL");
  await db.deleteFrom("work_job").where(sql<boolean>`payload->>'region' = ${REGION}`).execute().catch(() => {});
  await db.deleteFrom("worker_state").where("name", "=", WORKER).execute().catch(() => {});
  await db.deleteFrom("scout_place").where("region", "=", REGION).execute().catch(() => {});
  await db.deleteFrom("scout_tile").where("region", "=", REGION).execute().catch(() => {});
  await db.deleteFrom("scraper_definition").where("region", "=", `${REGION}:magellan`).execute().catch(() => {});
  await db.deleteFrom("region").where("id", "=", REGION).execute().catch(() => {});
  rmSync(SCRATCH, { recursive: true, force: true });
  if (SCENARIO === "console") log(`⑤ konzol: ${(await consoleUp(60)) === null ? "NEM ÁLL" : "fent"}`);
  log(`⑤ takarítva (${REGION})`);
  await db.destroy();
}
if (verdict !== EXPECT) {
  console.error(`✗ várt: ${EXPECT}, mért: ${verdict}`);
  process.exit(1);
}
