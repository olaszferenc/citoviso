// THE PIPELINE REFRESHES ITS OWN MOCKS (owner 2026-11-25: „Miért te renderelsz oldalakat? Az magának a
// folyamatnak a feladata … Ha te manuálisan javítasz valamit, annak kurvára semmi értelme nincsen.”).
//
// When the generator's rules change, the send gates move their bar (mockPhotoGate.ts
// MOCK_CURRENT_GENERATOR_SQL: generated after MOCK_HEROFIX_LIVE_AT, or re-rendered with stamp
// MOCK_HEROFIX_STAMP). Until 11-25 a mock below the bar simply waited — for a person to run
// scripts/rerender-terhatas.mts by hand. Now the dispatcher's own timer (scripts/outreach-dispatch.mts
// tick) re-renders a small batch of them every firing, from the persisted inputs through the CURRENT
// engine (never the AI planner: the inputs ARE the design, §I), the photo curation included. The
// refreshed mock goes back to the machine gate (its row gets QA_WAIT_NOTE; owner 2026-11-26); a colleague's pass
// puts it on the owner's approval page — nothing is sent by a refresh.
//
// One function, two callers: this timer step and the manual round script (rerender-terhatas.mts).
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { sql } from "kysely";
import { db } from "../db/client.js";
import type { Photo, Recipe, SiteData } from "../engine/recipe.js";
import { gatePhotoOf } from "../engine/templates/gateOpening.js";
import { photoKindAvailable } from "../media/photoKind.js";
import { DISPATCH_PHOTOS_OK_SQL, LEAD_MIN_OWN_PHOTOS_SQL, LEAD_OWN_PHOTOS_SQL, MOCK_CURRENT_GENERATOR_SQL, MOCK_HEROFIX_STAMP, MOCK_MIN_GENERATED_AT } from "../outreach/mockPhotoGate.js";
import { LEAD_COUNTRY_SQL } from "../db/leadCountrySql.js";
import { CHAIN_WAIT_NOTES, GATE_HOLD_PREFIX, PHOTO_SETASIDE_PREFIX, QA_HOLD_PREFIX, QA_WAIT_NOTE, REPLAN_NOTE, mockFileMtime } from "../outreach/mockQaReview.js";
import { secondPlanOf } from "../outreach/secondPlan.js";
import { cachedRenderGate, renderGateFor, stockOkFor, type RenderGateResult } from "../outreach/mockRenderGate.js";
import { DEPTH_TEMPLATES, withDepthArm } from "./depthArm.js";
import { persistMockLanguage, renderMockMeasured } from "./mockLanguage.js";
import { secureMockPhotos } from "./photoTransport.js";
import { curateMockPhotos } from "./photoCurate.js";
import { getHeroPin } from "./heroOverride.js";
import { accentFromPhotoUrls } from "../media/photoAccent.js";

export interface RefreshRow {
  readonly id: string;
  readonly lead_id: string;
  readonly path: string | null;
  readonly inputs: unknown;
  readonly generated_at: unknown;
}

export interface RefreshResult {
  readonly arm: string;
  readonly depth: boolean;
  readonly gateChanged: boolean;
  readonly duplicates: number;
  readonly offPage: number;
  readonly heroMoved: boolean;
}

/**
 * Re-render ONE mock from its persisted inputs with the current engine into the same file, and stamp
 * it (inputs.terhatasAt = MOCK_HEROFIX_STAMP). `backupDir`: the HTML (gzipped) is kept there the first
 * time the mock is touched. Throws when the mock has no inputs or file.
 */
export async function refreshMock(row: RefreshRow, opts: { readonly backupDir?: string } = {}): Promise<RefreshResult> {
  const inputs = (row.inputs ?? {}) as Record<string, unknown>;
  const recipe = inputs.recipe as Recipe | undefined;
  const stored = inputs.siteData as SiteData | undefined;
  if (!recipe || !stored || !row.path) throw new Error("a mocknak nincs mentett terve vagy fájlja");
  if (!existsSync(row.path)) throw new Error("a mock fájlja hiányzik");
  if (opts.backupDir) {
    mkdirSync(opts.backupDir, { recursive: true });
    const gz = path.join(opts.backupDir, `${row.id}.html.gz`);
    if (!existsSync(gz)) await writeFile(gz, gzipSync(await readFile(row.path)));
  }
  const { heroDepth: _old, ...base } = stored;
  let siteData = base as SiteData;
  let duplicates = 0;
  let offPage = 0;
  let heroMoved = false;
  // The generator's own photo step (its own photos are in the inputs only for current-generator mocks).
  if (new Date(String(row.generated_at)) >= new Date(MOCK_MIN_GENERATED_AT) && (siteData.photos?.length ?? 0) > 0) {
    // The colleague's hero choice (lead_hero_override) wins over the machine's.
    const pin = await getHeroPin(String(row.lead_id)).catch(() => null);
    const c = await curateMockPhotos(siteData.photos as readonly Photo[], { pinnedUrl: pin?.url ?? null });
    duplicates = c.duplicates.length;
    offPage = c.offPage.length;
    heroMoved = c.heroMoved;
    siteData = { ...siteData, photos: c.photos };
  }
  let gateChanged = false;
  if (recipe.template === "gate-opening") {
    // Always recomputed: the hero fix can make the old gate photo the new hero (an opening onto itself).
    const pick = gatePhotoOf((siteData.photos ?? []) as readonly Photo[]);
    if (pick?.url !== siteData.gatePhoto?.url) {
      const { gatePhoto: _stale, ...noGate } = siteData;
      siteData = (pick ? { ...noGate, gatePhoto: pick } : noGate) as SiteData;
      gateChanged = true;
    }
  }
  // §B.6 (owner 2026-11-26): a mock without its own accent gets one from its photos here, so the waiting
  // stock recolours itself — the skin's accent stays only when the photos carry no colour of their own.
  if (!siteData.palette?.accent && (siteData.photos?.length ?? 0) > 0) {
    const accent = await accentFromPhotoUrls((siteData.photos ?? []).map((p) => p.url)).catch(() => null);
    if (accent) siteData = { ...siteData, palette: { accent } };
  }
  const depth = await withDepthArm(siteData, { leadId: String(row.lead_id), artifactId: String(row.id), template: recipe.template });
  siteData = depth.siteData;
  const { html, language } = await renderMockMeasured(recipe, siteData, { phase: "mock" });
  const secured = await secureMockPhotos(html, String(row.id), (siteData.photos ?? []).map((p) => p.url), String(row.lead_id));
  await writeFile(row.path, secured.html, "utf8");
  await db
    .updateTable("mock_artifact")
    .set({ inputs: JSON.stringify({ ...inputs, siteData, heroDepthArm: depth.arm, terhatasAt: MOCK_HEROFIX_STAMP }) } as never)
    .where("id", "=", row.id)
    .execute();
  await persistMockLanguage(String(row.id), language);
  return { arm: depth.arm ?? "off", depth: depth.arm === "depth", gateChanged, duplicates, offPage, heroMoved };
}

/** How many below-the-bar mocks one dispatcher firing refreshes at most. */
export const REFRESH_BATCH = 30;

/**
 * The dispatcher timer's refresh step: the waiting mocks (queued / held dispatch rows, ≥5 own photos)
 * that are below the current generator's bar, re-rendered a batch at a time within `budgetMs`.
 * Their dispatch rows go back to the quality colleague. Returns the counts for the timer log.
 */
export async function refreshStaleQueue(budgetMs: number, limit = REFRESH_BATCH): Promise<{ refreshed: number; failed: number; left: number }> {
  if (!photoKindAvailable() || budgetMs <= 0) return { refreshed: 0, failed: 0, left: -1 };
  const stale = await db
    .selectFrom("outreach_dispatch as d")
    .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
    .innerJoin("lead as l", "l.id", "d.lead_id")
    .select(["a.id as id", "a.lead_id as lead_id", "a.path as path", "a.inputs as inputs", "a.generated_at as generated_at", "d.id as dispatchId"])
    .where("d.status", "in", ["queued", "held"])
    // Not the rows a person or a rule took out (twins, no contact …): only those waiting for the review chain.
    .where(CHAIN_ROWS)
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    // Since qafix7 (11-26 night) the TOWN-PAGE mocks (<5 own photos, town picture) are refreshed too: the HU
    // row's own_town branch is open, and a stamp bump otherwise strands them (not current, never refreshed).
    .where(sql<boolean>`(${LEAD_OWN_PHOTOS_SQL} >= ${LEAD_MIN_OWN_PHOTOS_SQL} or a.inputs->'siteData'->'townPhoto' is not null)`)
    .where(sql<boolean>`a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz`)
    .where(sql<boolean>`not ${MOCK_CURRENT_GENERATOR_SQL}`)
    // A half-done offer first (owner 2026-11-26): a lead with one plan already passed by the colleague.
    .orderBy(sql`exists (select 1 from mock_artifact m where m.lead_id = d.lead_id and m.inputs->'qaReview'->>'verdict' = 'pass') desc`)
    // Countries take turns (HR approval chain 2026-11-27): by queue age alone a new market waits behind the
    // home market's whole backlog — the 74 HR rows sat behind ~2 300 older HU rows.
    .orderBy(FAIR_ORDER)
    .limit(limit)
    .execute();
  const started = Date.now();
  let refreshed = 0;
  let failed = 0;
  const backupDir = path.resolve(process.cwd(), "sites/_mock-refresh-backup");
  for (const r of stale) {
    if (Date.now() - started > budgetMs) break;
    try {
      await refreshMock(r, { backupDir });
      // A changed mock is a new look for the colleague (and the owner's old yes, if any, is stale by mtime).
      await db.updateTable("outreach_dispatch").set({ status: "held", note: QA_WAIT_NOTE }).where("id", "=", r.dispatchId).where("status", "in", ["queued", "held"]).execute();
      refreshed++;
    } catch (e) {
      failed++;
      console.warn(`  ⚠️ mock-frissítés ${r.id}: ${e instanceof Error ? e.message : String(e)}`); // i18n-exempt: operator log
    }
  }
  // THE SECOND PLAN of every row waiting for the chain is refreshed too (owner 2026-11-25: the letter
  // needs both plans) — rows whose own plan is already current first, so a whole offer gets ready.
  if (Date.now() - started <= budgetMs) {
    const waiting = await db
      .selectFrom("outreach_dispatch as d")
      .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
      .innerJoin("lead as l", "l.id", "d.lead_id")
      .select(["d.lead_id as leadId", "d.artifact_id as mainId"])
      .where("d.status", "in", ["queued", "held"])
      .where(CHAIN_ROWS)
      .where(sql<boolean>`${LEAD_OWN_PHOTOS_SQL} >= ${LEAD_MIN_OWN_PHOTOS_SQL}`)
      .where(MOCK_CURRENT_GENERATOR_SQL)
      .orderBy(FAIR_ORDER)
      .execute();
    for (const w of waiting) {
      if (Date.now() - started > budgetMs) break;
      const alt = await secondPlanOf(w.leadId, w.mainId);
      if (!alt || alt.current) continue;
      const row = await db.selectFrom("mock_artifact").select(["id", "lead_id", "path", "inputs", "generated_at"]).where("id", "=", alt.id).executeTakeFirst();
      if (!row) continue;
      try {
        await refreshMock(row, { backupDir });
        refreshed++;
      } catch (e) {
        failed++;
        console.warn(`  ⚠️ 2. terv frissítése ${alt.id}: ${e instanceof Error ? e.message : String(e)}`); // i18n-exempt: operator log
      }
    }
  }
  const leftRow = await db
    .selectFrom("outreach_dispatch as d")
    .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
    .innerJoin("lead as l", "l.id", "d.lead_id")
    .select(db.fn.countAll().as("n"))
    .where("d.status", "in", ["queued", "held"])
    .where(CHAIN_ROWS)
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(sql<boolean>`(${LEAD_OWN_PHOTOS_SQL} >= ${LEAD_MIN_OWN_PHOTOS_SQL} or a.inputs->'siteData'->'townPhoto' is not null)`)
    .where(sql<boolean>`a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz`)
    .where(sql<boolean>`not ${MOCK_CURRENT_GENERATOR_SQL}`)
    .executeTakeFirst();
  return { refreshed, failed, left: Number(leftRow?.n ?? 0) };
}

/**
 * Countries take turns (HR approval chain, 2026-11-27): the n-th waiting row of every country before the
 * (n+1)-th of any, oldest first within a country. Aliases `d` = outreach_dispatch, `l` = its lead.
 */
export const FAIR_ORDER = sql`row_number() over (partition by ${LEAD_COUNTRY_SQL} order by d.queued_at), d.queued_at`;

/** The waiting rows the refresh / re-gate / re-plan steps work on (alias `d`). */
const CHAIN_ROWS = (eb: any) =>
  eb.or([
    eb("d.status", "=", "queued"),
    eb("d.note", "in", [...CHAIN_WAIT_NOTES]),
    eb("d.note", "like", `${QA_HOLD_PREFIX}%`),
    eb("d.note", "like", `${GATE_HOLD_PREFIX}%`),
  ]);

/** The cached verdict of a plan's CURRENT file (rule version, mtime and stock rule), null when there is none. */
async function currentVerdict(artifactId: string): Promise<RenderGateResult | null> {
  const a = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", artifactId).executeTakeFirst();
  const mtime = await mockFileMtime(artifactId);
  if (mtime == null) return null;
  return cachedRenderGate(a?.inputs, mtime, await stockOkFor(artifactId));
}

/** One-line reason of the failed plans for the dispatch note (k = 0: the main plan, 1: the second). */
function gateHoldNote(failed: readonly { k: number; v: RenderGateResult }[]): string {
  const why = failed
    .map(({ k, v }) => `${k === 0 ? "fő terv" : "2. terv"}: ${v.findings.slice(0, 3).map((f) => f.detail).join(" · ")}${v.findings.length > 3 ? ` (+${v.findings.length - 3})` : ""}`)
    .join(" | ");
  return `${GATE_HOLD_PREFIX} ${why} — egy generátor-szabály után a gép újrarendereli és újraítéli`.slice(0, 1000);
}

/**
 * THE MACHINE RENDER GATE ON THE WAITING ROWS (11-26 rule change; 11-27 HR approval chain). The owner's page
 * shows only a row whose two plans hold a pass on their CURRENT file. Here every waiting row's plans (main +
 * second) without one are judged — a missing, older-rule OR older-file verdict alike (the file changes on every
 * refresh) — a batch per firing within `budgetMs`, countries taking turns (FAIR_ORDER), the rows with a
 * colleague's pass first. Then the row's note follows the verdicts:
 *   · a plan FAILED → the row is set aside with the gate's reason (GATE_HOLD_PREFIX) instead of waiting
 *     silently; a generator change re-renders it (refreshStaleQueue) and it is judged again;
 *   · both plans passed on a set-aside row → back on the way to the owner's page (QA_WAIT_NOTE).
 * A row the photo rule fails is the re-plan's (replanUnfitQueue), not the gate's. Measured on prod
 * 2026-11-27: of 4 137 waiting plans 32 had a current verdict (HR 10 of 118); the step judged ~5 a firing,
 * oldest first, so the HR rows (queued last) were never reached.
 */
export async function regateStaleQueue(
  budgetMs: number,
  limit = 40,
): Promise<{ judged: number; held: number; released: number; left: number }> {
  if (!photoKindAvailable() || budgetMs <= 0) return { judged: 0, held: 0, released: 0, left: -1 };
  const rows = await db
    .selectFrom("outreach_dispatch as d")
    .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
    .innerJoin("lead as l", "l.id", "d.lead_id")
    .select(["d.id as dispatchId", "d.status as status", "d.note as note", "d.lead_id as leadId", "d.artifact_id as mainId"])
    .where("d.status", "in", ["queued", "held"])
    .where(CHAIN_ROWS)
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(MOCK_CURRENT_GENERATOR_SQL)
    .where(DISPATCH_PHOTOS_OK_SQL)
    .orderBy(sql`(coalesce(a.inputs->'qaReview'->>'verdict', '') = 'pass') desc`)
    .orderBy(FAIR_ORDER)
    .execute();
  const started = Date.now();
  let judged = 0;
  let held = 0;
  let released = 0;
  let left = 0;
  for (let i = 0; i < rows.length; i++) {
    // Out of time: the rows not reached yet wait for the next firing (the note rules too).
    if (Date.now() - started > budgetMs) return { judged, held, released, left: left + rows.length - i };
    const r = rows[i]!;
    if (!r.mainId) continue;
    const alt = await secondPlanOf(r.leadId, r.mainId).catch(() => null);
    const plans = [r.mainId, ...(alt ? [alt.id] : [])];
    const verdicts: (RenderGateResult | null)[] = [];
    for (const id of plans) {
      let v = await currentVerdict(id);
      if (!v && Date.now() - started <= budgetMs && judged < limit) {
        await renderGateFor(id).catch(() => undefined);
        judged++;
        // A crashed render is not stored (renderGateFor) — unknown, judged again next firing.
        v = await currentVerdict(id);
      }
      verdicts.push(v);
    }
    if (verdicts.some((v) => v === null)) left++;
    // Only a held row waiting for the chain changes its note; a queued (owner-approved) row is the sender's.
    if (r.status !== "held") continue;
    const failed = verdicts.flatMap((v, k) => (v?.verdict === "fail" ? [{ k, v }] : []));
    if (failed.length) {
      const note = gateHoldNote(failed);
      if (note !== r.note) {
        const u = await db.updateTable("outreach_dispatch").set({ note }).where("id", "=", r.dispatchId).where("status", "=", "held").where("note", "=", r.note).executeTakeFirst();
        held += Number(u.numUpdatedRows ?? 0);
      }
    } else if (r.note?.startsWith(GATE_HOLD_PREFIX) && alt && verdicts.every((v) => v?.verdict === "pass")) {
      const u = await db.updateTable("outreach_dispatch").set({ note: QA_WAIT_NOTE }).where("id", "=", r.dispatchId).where("status", "=", "held").where("note", "=", r.note).executeTakeFirst();
      released += Number(u.numUpdatedRows ?? 0);
    }
  }
  return { judged, held, released, left };
}

/** How many unfit rows one dispatcher firing re-plans at most (each costs the chain one main plan). */
export const REPLAN_BATCH = 40;

/**
 * A MAIN PLAN THAT CANNOT CARRY THE LEAD'S PHOTOS GOES BACK TO THE MAIN PLAN (HR approval chain, 2026-11-27).
 * Measured on prod: 39 of the 74 waiting HR rows (HU: 39 current-generator ones) could never reach the owner's
 * page, whatever the render gate said —
 *   A · the lead holds ≥ its country's minimum own photos, the mock shows fewer (the own-site photos were read
 *       into the lead AFTER the plan was made — 20:49 vs 19:43 —, or the count had included the site
 *       assessment's image count): a photo-less wordmark plan without a second plan, or a town-photo plan;
 *   B · the lead holds fewer and the mock carries no town pick at all.
 * The refresh cannot help (it re-renders the persisted photo set). So the lead's plans are taken back
 * (status 'rejected', undo data in lead.raw.replan), the row waits with REPLAN_NOTE, and the chain's main plan
 * (fo-cand.sql: a lead without a live plan) plans it again with what it holds now — its photos (A) or its
 * town's judged picture set (B; no good picture anywhere → set aside by the town-picture step). The chain's fill
 * step re-points this row to the new plan. A lead re-planned once whose NEW plan fails again is set aside with
 * the reason (PHOTO_SETASIDE_PREFIX) — never re-planned twice. Only current-generator plans (MOCK_MIN_GENERATED_AT).
 */
export async function replanUnfitQueue(limit = REPLAN_BATCH): Promise<{ replanned: number; setAside: number }> {
  const rows = await db
    .selectFrom("outreach_dispatch as d")
    .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
    .innerJoin("lead as l", "l.id", "d.lead_id")
    .select([
      "d.id as dispatchId",
      "d.note as note",
      "d.lead_id as leadId",
      "a.generated_at as generatedAt",
      sql<number>`(case when jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' then jsonb_array_length(a.inputs->'siteData'->'photos') else 0 end)`.as("mockPhotos"),
      sql<number>`${LEAD_OWN_PHOTOS_SQL}`.as("own"),
      sql<number>`${LEAD_MIN_OWN_PHOTOS_SQL}`.as("min"),
      sql<boolean>`a.inputs->'siteData'->'townPhoto' is not null`.as("town"),
      sql<string | null>`l.raw->'replan'->>'at'`.as("replanAt"),
    ])
    .where("d.status", "=", "held")
    .where((eb) => eb.or([eb("d.note", "in", [...CHAIN_WAIT_NOTES]), eb("d.note", "like", `${GATE_HOLD_PREFIX}%`)]))
    .where("a.status", "<>", "rejected")
    .where(sql<boolean>`a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz`)
    .where(sql<boolean>`not ${DISPATCH_PHOTOS_OK_SQL}`)
    .where(
      sql<boolean>`((${LEAD_OWN_PHOTOS_SQL} >= ${LEAD_MIN_OWN_PHOTOS_SQL})
        or (a.inputs->'siteData'->'townPhoto' is null and a.inputs->'siteData'->'townGallery' is null))`,
    )
    .orderBy(FAIR_ORDER)
    .limit(limit)
    .execute();
  let replanned = 0;
  let setAside = 0;
  for (const r of rows) {
    const own = Number(r.own);
    const min = Number(r.min);
    const shown = Number(r.mockPhotos);
    const reason =
      own >= min
        ? `a lead ${own} saját képe helyett a mockon ${shown}${r.town ? " és településkép" : ""} van (min. ${min})`
        : `a leadnek ${own} saját képe van (min. ${min}), a mockon nincs településkép`;
    if (r.replanAt && new Date(String(r.generatedAt)) > new Date(r.replanAt)) {
      // Re-planned once and the NEW plan fails the same rule: the lead's photos do not make a page — set aside.
      const note = `${PHOTO_SETASIDE_PREFIX} ${reason} — újratervezés után is; nem tervezzük újra`.slice(0, 1000);
      const u = await db.updateTable("outreach_dispatch").set({ note }).where("id", "=", r.dispatchId).where("status", "=", "held").where("note", "=", r.note).executeTakeFirst();
      if (Number(u.numUpdatedRows ?? 0)) {
        await db
          .updateTable("lead")
          .set({ raw: sql`jsonb_set(raw, '{replan,final}', to_jsonb(now()::text))` as never })
          .where("id", "=", r.leadId)
          .execute();
        setAside++;
      }
      continue;
    }
    if (r.replanAt) continue; // taken back already; the chain's main plan has not made the new one yet
    await db.transaction().execute(async (tx) => {
      const live = await tx.selectFrom("mock_artifact").select("id").where("lead_id", "=", r.leadId).where("status", "<>", "rejected").execute();
      const ids = live.map((m) => m.id);
      const u = await tx.updateTable("outreach_dispatch").set({ note: REPLAN_NOTE }).where("id", "=", r.dispatchId).where("status", "=", "held").where("note", "=", r.note).executeTakeFirst();
      if (!Number(u.numUpdatedRows ?? 0) || !ids.length) return;
      await tx.updateTable("mock_artifact").set({ status: "rejected" }).where("id", "in", ids).execute();
      const replan = { at: new Date().toISOString(), reason, rejectedMocks: ids, note: r.note, leadPhotos: own, mockPhotos: shown };
      await tx
        .updateTable("lead")
        .set({ raw: sql`coalesce(raw, '{}'::jsonb) || jsonb_build_object('replan', ${JSON.stringify(replan)}::jsonb)` as never })
        .where("id", "=", r.leadId)
        .execute();
      replanned++;
    });
  }
  return { replanned, setAside };
}
