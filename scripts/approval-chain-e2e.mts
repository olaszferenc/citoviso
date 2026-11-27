// HR APPROVAL CHAIN (2026-11-27) — the waiting rows reach the owner's page or are set aside WITH a reason, in a
// SCRATCH database (never the shared dev DB, never production). Nothing is sent, nothing is rendered: the render
// gate's verdicts are seeded as cached verdicts on real files, so the step's note rules are measured exactly.
//
//   ① the photo count: a lead whose „≥5 own photos” came only from material.websiteImages (the site assessment's
//      image count) is a <5 lead now; a mock that SHOWS ≥5 own photos passes the photo rule whatever the count;
//   ② re-plan (mockRefresh.replanUnfitQueue): A · a lead holding ≥5 photos whose plan shows fewer, B · a lead with
//      fewer whose plan carries no town pick → the lead's plans are taken back (rejected, undo data in
//      lead.raw.replan), the row waits with REPLAN_NOTE; a re-planned lead whose NEW plan fails again is set aside
//      (PHOTO_SETASIDE_PREFIX) and not re-planned twice; a fit row, an old-generator plan, a town-pick plan untouched;
//   ③ re-gate (mockRefresh.regateStaleQueue): a plan FAILED on its current file → the row is set aside with the
//      gate's reason (GATE_HOLD_PREFIX); both plans passed on a set-aside row → back to QA_WAIT_NOTE and on the
//      owner's page; a verdict of an OLDER file (refreshed since) is not current — the row stays off the page;
//      countries take turns (FAIR_ORDER): with 3 old HU rows and 1 new HR row and a batch of 2 rows, the HR row is judged.
//
//   npx tsx scripts/approval-chain-e2e.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_apchain_e2e";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.I18N_BOOT_TOPUP = "0";
for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY"]) process.env[k] = "";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
  return new Response("blocked by approval-chain-e2e fence", { status: 599 });
}) as typeof fetch;

const { mkdtempSync, writeFileSync, statSync, utimesSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { db } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { refreshCountries } = await import("../src/country.js");
const { RENDER_GATE_VERSION } = await import("../src/outreach/mockRenderGate.js");
const { MOCK_HEROFIX_STAMP, DISPATCH_PHOTOS_OK_SQL } = await import("../src/outreach/mockPhotoGate.js");
const { APPROVAL_PENDING_NOTE, GATE_HOLD_PREFIX, PHOTO_SETASIDE_PREFIX, QA_WAIT_NOTE, REPLAN_NOTE } = await import("../src/outreach/mockQaReview.js");
const { replanUnfitQueue, regateStaleQueue, FAIR_ORDER } = await import("../src/generator/mockRefresh.js");
const { listPendingApprovals } = await import("../src/console/approvalQueue.js");
const { photoKindAvailable } = await import("../src/media/photoKind.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// Both countries open the <N branch with the town pick (the prod rows' dispatch_photo_mode, 0155).
await refreshCountries();
const rows = await db.selectFrom("country").select("iso2").where("iso2", "in", ["HU", "HR"]).execute();
const cc2 = rows.some((r) => r.iso2 === "HR") ? "HR" : "HU";
await db.updateTable("country").set({ dispatch_photo_mode: "own_town", dispatch_min_own_photos: 5 } as never).where("iso2", "in", ["HU", "HR"]).execute();
await refreshCountries();

const parent = await createFixtureParent(db as never, "apchain");
const stamp = Date.now().toString(36);
const dir = mkdtempSync(`${tmpdir()}/apchain-`);
const photos = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://example.invalid/${i}.jpg`, provenance: "portal" }));

async function lead(name: string, cc: string, material: Record<string, number>, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `${name} ${stamp}`, qualification: "no_site", raw: { country: cc, email: "info@x.example", material, ...extra } } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
type Verdict = "pass" | "fail" | null;
async function plan(leadId: string, o: { template: string; photos: number; town?: boolean; generatedAt?: Date; verdict?: Verdict; staleFile?: boolean }): Promise<string> {
  const file = `${dir}/${leadId}-${o.template}.html`;
  writeFileSync(file, "<!doctype html><title>e2e</title>");
  const mtime = Math.floor(statSync(file).mtimeMs / 1000);
  const inputs: Record<string, unknown> = {
    recipe: { template: o.template },
    terhatasAt: MOCK_HEROFIX_STAMP,
    review: { verdict: "pass", note: "MEHET (egylépéses): e2e" },
    siteData: { photos: photos(o.photos), ...(o.town ? { townPhoto: { url: "https://example.invalid/town.jpg" } } : {}) },
    ...(o.verdict
      ? {
          renderGate: {
            version: RENDER_GATE_VERSION,
            mtime: o.staleFile ? mtime - 600 : mtime,
            at: new Date().toISOString(),
            verdict: o.verdict,
            slots: 6,
            findings: o.verdict === "fail" ? [{ code: "repeat", detail: "ugyanaz a kép kétszer: a.jpg" }] : [],
          },
        }
      : {}),
  };
  const r = await db
    .insertInto("mock_artifact")
    .values({ lead_id: leadId, status: "approved", path: file, generated_at: o.generatedAt ?? new Date(), inputs } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}
async function row(leadId: string, mainId: string, note = APPROVAL_PENDING_NOTE, queuedAt = new Date()): Promise<void> {
  await db.insertInto("outreach_dispatch").values({ lead_id: leadId, artifact_id: mainId, queued_by: "e2e", status: "held", note, queued_at: queuedAt } as never).execute();
}
const noteOf = async (leadId: string) => (await db.selectFrom("outreach_dispatch").select("note").where("lead_id", "=", leadId).executeTakeFirst())?.note ?? "";
const statusesOf = async (leadId: string) => (await db.selectFrom("mock_artifact").select("status").where("lead_id", "=", leadId).execute()).map((m) => m.status);
const photosOk = async (mockId: string) =>
  (await db.selectFrom("mock_artifact as a").innerJoin("lead as l", "l.id", "a.lead_id").select(sql<boolean>`${DISPATCH_PHOTOS_OK_SQL}`.as("ok")).where("a.id", "=", mockId).executeTakeFirst())?.ok === true;

// ── ① the photo count ─────────────────────────────────────────────────────────────────────
console.log("① fotószám");
const phantom = await lead("Fantom Apartman", cc2, { placesPhotos: 0, portalPhotos: 0, websiteImages: 21 });
const phantomMain = await plan(phantom, { template: "wordmark-grow", photos: 0 });
await row(phantom, phantomMain);
const shows = await lead("Mutatós Vila", cc2, { placesPhotos: 0, portalPhotos: 3, websiteImages: 10 });
const showsMain = await plan(shows, { template: "parallax", photos: 6 });
check("csak websiteImages miatti „≥5 saját kép”: a lead <5-ös, a kép nélküli mockja nem megy át a fotószabályon", !(await photosOk(phantomMain)));
check("a mock 6 saját képet mutat, településkép nélkül → átmegy, bármit mond a lead tárolt száma (3)", await photosOk(showsMain));

// ── ② re-plan ─────────────────────────────────────────────────────────────────────────────
console.log("② újratervezés");
const late = await lead("Késő Képes Ház", cc2, { placesPhotos: 0, portalPhotos: 40, websiteImages: 10 }, { portalProfiles: [{ url: "https://late.example/", fetchedAt: "2099-01-01T00:00:00Z", photos: [] }] });
const lateMain = await plan(late, { template: "wordmark-grow", photos: 0 });
await row(late, lateMain);
const curated = await lead("Kurált Ház", cc2, { placesPhotos: 0, portalPhotos: 9 });
const curatedMain = await plan(curated, { template: "parallax", photos: 3 });
await row(curated, curatedMain);
const townLate = await lead("Településképes Ház", cc2, { placesPhotos: 0, portalPhotos: 12 });
const townLateMain = await plan(townLate, { template: "parallax", photos: 2, town: true });
await plan(townLate, { template: "gate-opening", photos: 2, town: true });
await row(townLate, townLateMain);
const fit = await lead("Rendben Panzió", cc2, { placesPhotos: 8 });
const fitMain = await plan(fit, { template: "parallax", photos: 8 });
await row(fit, fitMain);
const old = await lead("Régi Generátoros", cc2, { portalPhotos: 20 });
const oldMain = await plan(old, { template: "wordmark-grow", photos: 0, generatedAt: new Date("2026-11-10T10:00:00Z") });
await row(old, oldMain);
// re-planned once on the OWN way (before the measured count existed), its new plan shows 1: the town way is next
const again = await lead("Másodszor Településképpel", cc2, { portalPhotos: 9 }, { replan: { at: "2026-11-27T06:00:00Z", reason: "e2e" } });
await plan(again, { template: "wordmark-grow", photos: 0, generatedAt: new Date("2026-11-27T05:00:00Z") }).then((id) => db.updateTable("mock_artifact").set({ status: "rejected" }).where("id", "=", id).execute());
const againMain = await plan(again, { template: "wordmark-grow", photos: 1, generatedAt: new Date("2026-11-27T07:00:00Z") });
await row(again, againMain);
// both ways tried, the newest plan still has neither → set aside with the reason
const tried = await lead("Mindkét Út Kipróbálva", cc2, { portalPhotos: 9 }, { replan: { at: "2026-11-27T06:00:00Z", routes: ["own", "town"], reason: "e2e" } });
const triedMain = await plan(tried, { template: "wordmark-grow", photos: 0, generatedAt: new Date("2026-11-27T07:00:00Z") });
await row(tried, triedMain);
// set aside yesterday-style („TARTVA (képkapu)” after the own way): revived on the town way
const legacy = await lead("Tegnap Félretett", cc2, { portalPhotos: 7 }, { replan: { at: "2026-11-27T06:00:00Z", reason: "e2e", final: "2026-11-27T08:00:00Z" } });
const legacyMain = await plan(legacy, { template: "parallax", photos: 2, generatedAt: new Date("2026-11-27T07:00:00Z") });
await row(legacy, legacyMain, `${PHOTO_SETASIDE_PREFIX} a lead 7 saját képe helyett a mockon 2 van (min. 5) — újratervezés után is; nem tervezzük újra`);
// set aside the same way, but its plan carries a town pick: measured < 5 → it IS the town way → back to the gate
const legacyTown = await lead("Tegnap Félretett Településképes", cc2, { portalPhotos: 8 }, { replan: { at: "2026-11-27T06:00:00Z", reason: "e2e", final: "2026-11-27T08:00:00Z" } });
const legacyTownMain = await plan(legacyTown, { template: "parallax", photos: 2, town: true, generatedAt: new Date("2026-11-27T07:00:00Z") });
await row(legacyTown, legacyTownMain, `${PHOTO_SETASIDE_PREFIX} a lead 8 saját képe helyett a mockon 2 és településkép van (min. 5) — újratervezés után is; nem tervezzük újra`);

const usableOf = async (id: string) => ((await db.selectFrom("lead").select("raw").where("id", "=", id).executeTakeFirstOrThrow()).raw as { material?: { usablePhotos?: { n?: number; stored?: number } } }).material?.usablePhotos;
const replanOf = async (id: string) => ((await db.selectFrom("lead").select("raw").where("id", "=", id).executeTakeFirstOrThrow()).raw as { replan?: { route?: string; routes?: string[]; reason?: string; rejectedMocks?: string[]; note?: string; final?: string } }).replan;
const p = await replanUnfitQueue();
check("újratervezés: késői kép (saját út), kurált + fantom + egyszer-tervezett + tegnap félretett (településképes út) = 5; mindkét út után 1 félre",
  p.replanned === 5 && p.setAside === 1, JSON.stringify(p));
check("A · a terv UTÁN beolvasott hirdetés (40 kép): saját úton újratervezve, nincs visszamérés (a terv nem mondhat róluk semmit)",
  (await statusesOf(late)).every((s) => s === "rejected") && (await noteOf(late)) === REPLAN_NOTE && (await replanOf(late))?.route === "own" && !(await usableOf(late)), JSON.stringify(await replanOf(late)));
const lr = await replanOf(late);
check("A · visszaállítási adat a lead.raw.replan-ben (ok, a visszavett mockok, a régi jegyzet)",
  !!lr?.reason?.includes("40") && lr?.rejectedMocks?.length === 1 && lr?.note === APPROVAL_PENDING_NOTE, JSON.stringify(lr));
check("MÉRT · 9 tárolt képből a mai terv 3-at mutat → a használható szám 3 (a tárolt 9-hez kötve), és a lead ELSŐRE a településképes útra megy",
  (await usableOf(curated))?.n === 3 && (await usableOf(curated))?.stored === 9 && (await replanOf(curated))?.route === "town" && (await noteOf(curated)) === REPLAN_NOTE,
  JSON.stringify({ u: await usableOf(curated), r: await replanOf(curated) }));
check("MÉRT · a településképes terv (12 tárolt, 2 használható): visszamérve, nem tervezzük újra (a településkép-ág az övé)",
  (await usableOf(townLate))?.n === 2 && (await statusesOf(townLate)).every((s) => s === "approved"));
check("B · a fantom (valójában 0 saját kép, nincs településkép) a településképes útra", (await noteOf(phantom)) === REPLAN_NOTE && (await replanOf(phantom))?.route === "town");
check("a rendben lévő sor érintetlen", (await noteOf(fit)) === APPROVAL_PENDING_NOTE && (await statusesOf(fit))[0] === "approved");
check("a régi generátoros terv érintetlen (nem ennek a szabálynak a dolga)", (await noteOf(old)) === APPROVAL_PENDING_NOTE);
check("a saját úton egyszer újratervezett, 1 képes lead most a településképes utat kapja (nem áll félre)",
  (await noteOf(again)) === REPLAN_NOTE && JSON.stringify((await replanOf(again))?.routes) === JSON.stringify(["own", "town"]), JSON.stringify(await replanOf(again)));
check("mindkét út kipróbálva, az új terv sem jó → TARTVA (képkapu) okkal, „településképes újratervezés után is”",
  (await noteOf(tried)).startsWith(PHOTO_SETASIDE_PREFIX) && (await noteOf(tried)).includes("településképes"), await noteOf(tried));
check("a tegnap félretett (csak saját úton tervezett) lead újra él a településképes úton, a „final” jelölő nélkül (a lánc leveszi a tried-listáról)",
  (await noteOf(legacy)) === REPLAN_NOTE && (await replanOf(legacy))?.route === "town" && !(await replanOf(legacy))?.final, JSON.stringify(await replanOf(legacy)));
check("a tegnap félretett, településképes tervű lead (mért 2 kép) visszakerül a gépi kapu felé, újratervezés nélkül",
  (await noteOf(legacyTown)) === QA_WAIT_NOTE && (await usableOf(legacyTown))?.n === 2 && p.released >= 1 && (await statusesOf(legacyTown)).every((s) => s === "approved"), `${await noteOf(legacyTown)} ${JSON.stringify(p)}`);
const again2 = await replanUnfitQueue();
check("második futás: semmi új (idempotens)", again2.replanned === 0 && again2.setAside === 0 && again2.released === 0, JSON.stringify(again2));

// ── ③ re-gate ─────────────────────────────────────────────────────────────────────────────
console.log("③ render-kapu a várakozó sorokon");
if (!photoKindAvailable()) {
  check("a kép-osztályozó modell elérhető (models/clip-vit-b32-vision-q8.onnx) — nélküle a lépés nem fut", false);
} else {
  const failing = await lead("Bukó Terv", cc2, { placesPhotos: 8 });
  const failMain = await plan(failing, { template: "parallax", photos: 8, verdict: "fail" });
  await plan(failing, { template: "gate-opening", photos: 8, verdict: "pass" });
  await row(failing, failMain, QA_WAIT_NOTE);
  const back = await lead("Visszatérő Terv", cc2, { placesPhotos: 8 });
  const backMain = await plan(back, { template: "parallax", photos: 8, verdict: "pass" });
  await plan(back, { template: "gate-opening", photos: 8, verdict: "pass" });
  await row(back, backMain, `${GATE_HOLD_PREFIX} fő terv: e2e — korábbi bukás`);
  const staleF = await lead("Frissített Terv", cc2, { placesPhotos: 8 });
  const staleMain = await plan(staleF, { template: "parallax", photos: 8, verdict: "pass", staleFile: true });
  await plan(staleF, { template: "gate-opening", photos: 8, verdict: "pass" });
  await row(staleF, staleMain, QA_WAIT_NOTE);
  // judged under budget 0 for renders: only the note rules run on current verdicts (limit 0 = no render)
  const g = await regateStaleQueue(120_000, 0);
  check("bukott fő terv (a jelenlegi fájlon) → a sor félretéve a kapu okával", (await noteOf(failing)).startsWith(`${GATE_HOLD_PREFIX} fő terv: ugyanaz a kép kétszer`), await noteOf(failing));
  check("mindkét terv átment egy félretett soron → vissza a tulaj lapja felé (QA_WAIT_NOTE)", (await noteOf(back)) === QA_WAIT_NOTE, await noteOf(back));
  const page = (await listPendingApprovals()).map((i) => i.leadId);
  check("…és a jóváhagyó lapon van", page.includes(back), page.join(","));
  check("a bukott sor nincs a lapon", !page.includes(failing));
  check("egy RÉGEBBI fájl ítélete (azóta frissült) nem jelenlegi: a sor nincs a lapon, és a lépés megítélendőnek látja",
    !page.includes(staleF) && g.left >= 1, JSON.stringify(g));

  // countries take turns: 3 old HU rows + 1 new HR row, every plan without a verdict; with room for 2 rows
  // the HR row is among them (by queue age alone it would be last)
  if (cc2 === "HR") {
    const hu: string[] = [];
    for (let i = 0; i < 3; i++) {
      const l = await lead(`Régi HU ${i}`, "HU", { placesPhotos: 8 });
      const m = await plan(l, { template: "parallax", photos: 8 });
      await plan(l, { template: "gate-opening", photos: 8 });
      await row(l, m, QA_WAIT_NOTE, new Date(Date.UTC(2026, 10, 1 + i)));
      hu.push(l);
    }
    const hr = await lead("Új HR", "HR", { placesPhotos: 8 });
    const hrMain = await plan(hr, { template: "parallax", photos: 8 });
    await plan(hr, { template: "gate-opening", photos: 8 });
    await row(hr, hrMain, QA_WAIT_NOTE, new Date());
    const seen: string[] = [];
    // the order the step walks (the step's own FAIR_ORDER), without rendering
    const order = await db
      .selectFrom("outreach_dispatch as d")
      .innerJoin("lead as l", "l.id", "d.lead_id")
      .select("d.lead_id as id")
      .where("d.lead_id", "in", [...hu, hr])
      .orderBy(FAIR_ORDER)
      .execute();
    seen.push(...order.slice(0, 2).map((o) => o.id));
    check("országok felváltva: 3 régi HU sor mellett az új HR sor a második helyen (a sor-kor szerint az utolsó lenne)", seen[1] === hr, seen.join(","));

    // after a rule-version / stamp bump: the HU row that WAS on the owner's page (both plans passed under an older
    // version) is judged first inside its country — before the older HU rows that never passed
    const wasOnPage = await lead("Lapon Volt HU", "HU", { placesPhotos: 8 });
    const wm = await plan(wasOnPage, { template: "parallax", photos: 8, verdict: "pass" });
    const wa = await plan(wasOnPage, { template: "gate-opening", photos: 8, verdict: "pass" });
    await db.updateTable("mock_artifact").set({ inputs: sql`jsonb_set(inputs, '{renderGate,version}', '1'::jsonb)` as never }).where("id", "in", [wm, wa]).execute();
    await row(wasOnPage, wm, QA_WAIT_NOTE, new Date());
    const order2 = await db
      .selectFrom("outreach_dispatch as d")
      .innerJoin("lead as l", "l.id", "d.lead_id")
      .select("d.lead_id as id")
      .where("d.lead_id", "in", [...hu, hr, wasOnPage])
      .orderBy(FAIR_ORDER)
      .execute();
    check("bélyeg- / verzió-emelés után a lapon volt sor (régi passz mindkét terven) az országa ELSŐ sora, a régebbi, soha át nem ment sorok előtt",
      order2.filter((o) => o.id !== hr)[0]?.id === wasOnPage, order2.map((o) => o.id.slice(0, 6)).join(","));
  }
}

await parent.drop();
await db.destroy();
console.log(fails ? `\n✗ ${fails} hiba` : "\n✓ minden ellenőrzés zöld");
process.exit(fails ? 1 : 0);
