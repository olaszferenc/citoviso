// THE PIPELINE REFRESHES ITS OWN MOCKS (owner 2026-11-25: „Miért te renderelsz oldalakat? Az magának a
// folyamatnak a feladata … Ha te manuálisan javítasz valamit, annak kurvára semmi értelme nincsen.”).
//
// When the generator's rules change, the send gates move their bar (mockPhotoGate.ts
// MOCK_CURRENT_GENERATOR_SQL: generated after MOCK_HEROFIX_LIVE_AT, or re-rendered with stamp
// MOCK_HEROFIX_STAMP). Until 11-25 a mock below the bar simply waited — for a person to run
// scripts/rerender-terhatas.mts by hand. Now the dispatcher's own timer (scripts/outreach-dispatch.mts
// tick) re-renders a small batch of them every firing, from the persisted inputs through the CURRENT
// engine (never the AI planner: the inputs ARE the design, §I), the photo curation included. The
// refreshed mock goes back to the quality colleague (its row gets QA_WAIT_NOTE); the colleague's pass
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
import { DISPATCH_MIN_OWN_PHOTOS, LEAD_OWN_PHOTOS_SQL, MOCK_CURRENT_GENERATOR_SQL, MOCK_HEROFIX_STAMP, MOCK_MIN_GENERATED_AT } from "../outreach/mockPhotoGate.js";
import { APPROVAL_PENDING_NOTE, QA_HOLD_PREFIX, QA_WAIT_NOTE } from "../outreach/mockQaReview.js";
import { secondPlanOf } from "../outreach/secondPlan.js";
import { RENDER_GATE_VERSION, renderGateFor } from "../outreach/mockRenderGate.js";
import { DEPTH_TEMPLATES, withDepthArm } from "./depthArm.js";
import { persistMockLanguage, renderMockMeasured } from "./mockLanguage.js";
import { secureMockPhotos } from "./photoTransport.js";
import { curateMockPhotos } from "./photoCurate.js";
import { getHeroPin } from "./heroOverride.js";

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
    .where((eb) => eb.or([eb("d.status", "=", "queued"), eb("d.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE]), eb("d.note", "like", `${QA_HOLD_PREFIX}%`)]))
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(sql<boolean>`${LEAD_OWN_PHOTOS_SQL} >= ${DISPATCH_MIN_OWN_PHOTOS}`)
    .where(sql<boolean>`a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz`)
    .where(sql<boolean>`not ${MOCK_CURRENT_GENERATOR_SQL}`)
    .orderBy("d.queued_at")
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
      .where((eb) => eb.or([eb("d.status", "=", "queued"), eb("d.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE]), eb("d.note", "like", `${QA_HOLD_PREFIX}%`)]))
      .where(sql<boolean>`${LEAD_OWN_PHOTOS_SQL} >= ${DISPATCH_MIN_OWN_PHOTOS}`)
      .where(MOCK_CURRENT_GENERATOR_SQL)
      .orderBy("d.queued_at")
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
    .where((eb) => eb.or([eb("d.status", "=", "queued"), eb("d.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE]), eb("d.note", "like", `${QA_HOLD_PREFIX}%`)]))
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(sql<boolean>`${LEAD_OWN_PHOTOS_SQL} >= ${DISPATCH_MIN_OWN_PHOTOS}`)
    .where(sql<boolean>`a.generated_at >= ${MOCK_MIN_GENERATED_AT}::timestamptz`)
    .where(sql<boolean>`not ${MOCK_CURRENT_GENERATOR_SQL}`)
    .executeTakeFirst();
  return { refreshed, failed, left: Number(leftRow?.n ?? 0) };
}

/**
 * RE-JUDGE AFTER A RULE CHANGE (11-26): a new render-gate version makes every cached verdict stale, and the
 * owner's page shows only plans whose verdict is current — Erzsébet's two passed plans dropped off the page
 * after the gate went 12 → 13, and nothing re-ran the gate. Here the waiting rows' plans (main + second) with a
 * stale or missing verdict are judged again, a batch per firing; the ones the quality colleague already passed
 * first, so a ready offer returns to the owner's page soonest.
 */
export async function regateStaleQueue(budgetMs: number, limit = 40): Promise<{ judged: number; left: number }> {
  if (!photoKindAvailable() || budgetMs <= 0) return { judged: 0, left: -1 };
  const rows = await db
    .selectFrom("outreach_dispatch as d")
    .innerJoin("mock_artifact as a", "a.id", "d.artifact_id")
    .select(["d.lead_id as leadId", "d.artifact_id as mainId", "a.inputs as inputs"])
    .where("d.status", "in", ["queued", "held"])
    .where((eb) => eb.or([eb("d.status", "=", "queued"), eb("d.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE]), eb("d.note", "like", `${QA_HOLD_PREFIX}%`)]))
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(MOCK_CURRENT_GENERATOR_SQL)
    .orderBy(sql`(coalesce(a.inputs->'qaReview'->>'verdict', '') = 'pass') desc`)
    .orderBy("d.queued_at")
    .limit(limit * 3)
    .execute();
  const stale = (inputs: unknown): boolean => (inputs as { renderGate?: { version?: number } } | null)?.renderGate?.version !== RENDER_GATE_VERSION;
  const started = Date.now();
  let judged = 0;
  let left = 0;
  for (const r of rows) {
    const ids: string[] = [];
    if (stale(r.inputs)) ids.push(r.mainId);
    const alt = await secondPlanOf(r.leadId, r.mainId).catch(() => null);
    if (alt) {
      const ai = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", alt.id).executeTakeFirst();
      if (stale(ai?.inputs)) ids.push(alt.id);
    }
    for (const id of ids) {
      if (Date.now() - started > budgetMs || judged >= limit) {
        left++;
        continue;
      }
      await renderGateFor(id).catch(() => undefined);
      judged++;
    }
  }
  return { judged, left };
}
