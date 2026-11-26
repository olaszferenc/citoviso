// THE SECOND PLAN IS PART OF THE OFFER (owner 2026-11-25, on the first approvable letter, Sirató 82:
// „nincs második mock. így maga a megkeresés nem hagyható jóvá … Csak az hagyható jóvá, ahol van második
// terv is.”). This overrides ADR-0433 („one plan is enough”, 2026-11-08) for the cold letter.
//
// One rule, every step: the refresh step re-renders it, the machine gate judges it, the approval page
// lists a lead only when BOTH plans passed the chain, and the dispatcher attaches exactly this plan (and
// refuses to send without it). Owner 2026-11-26: the quality colleague's pass is not part of the chain;
// a colleague's FAIL on the current file still holds (mockQaReview.ts).
import { stat } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { DEPTH_TEMPLATES } from "../generator/depthArm.js";
import { MOCK_CURRENT_GENERATOR_SQL } from "./mockPhotoGate.js";
import { cachedRenderGate, stockOkFor } from "./mockRenderGate.js";
import { qaReviewState } from "./mockQaReview.js";

export interface SecondPlan {
  readonly id: string;
  readonly path: string | null;
  readonly current: boolean;
}

/**
 * The lead's second plan for a letter whose main plan is `mainId`: the newest other mock of the
 * lead in another outreach template, not rejected, with a file. `current` = made by (or refreshed
 * with) the current generator.
 */
export async function secondPlanOf(leadId: string, mainId: string): Promise<SecondPlan | null> {
  const main = await db.selectFrom("mock_artifact").select(sql<string>`inputs->'recipe'->>'template'`.as("t")).where("id", "=", mainId).executeTakeFirst();
  const r = await db
    .selectFrom("mock_artifact as a")
    .select(["a.id as id", "a.path as path", sql<boolean>`${MOCK_CURRENT_GENERATOR_SQL}`.as("current")])
    .where("a.lead_id", "=", leadId)
    .where("a.id", "!=", mainId)
    .where("a.status", "!=", "rejected")
    .where("a.path", "is not", null)
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "in", [...DEPTH_TEMPLATES])
    .where(sql<string>`a.inputs->'recipe'->>'template'`, "!=", main?.t ?? "")
    .orderBy("a.generated_at", "desc")
    .executeTakeFirst();
  return r ? { id: r.id, path: r.path, current: Boolean(r.current) } : null;
}

async function mtimeOf(relPath: string | null): Promise<number | null> {
  if (!relPath) return null;
  try {
    return Math.floor((await stat(path.resolve(process.cwd(), relPath))).mtimeMs / 1000);
  } catch {
    return null;
  }
}

/** Has this plan passed the whole chain on its current file (current generator, colleague, machine gate)? */
export async function planChainPassed(plan: SecondPlan | null): Promise<boolean> {
  if (!plan || !plan.current) return false;
  const qa = await qaReviewState(plan.id);
  if (qa.state === "fail" || qa.state === "nofile") return false;
  const a = await db.selectFrom("mock_artifact").select("inputs").where("id", "=", plan.id).executeTakeFirst();
  const mtime = await mtimeOf(plan.path);
  return mtime != null && cachedRenderGate(a?.inputs, mtime, await stockOkFor(plan.id))?.verdict === "pass";
}

/** Operator-facing reason the letter may not go out for want of its second plan; null when it passed. */
export async function secondPlanBlock(leadId: string, mainId: string): Promise<string | null> {
  const plan = await secondPlanOf(leadId, mainId);
  if (!plan) return "nincs második terv (más sablonú mock) — a megkeresés csak két tervvel mehet ki (tulaj 2026-11-25)";
  if (!(await planChainPassed(plan))) return "a második terv még nem járta végig a láncot (frissítés → gépi kapu), vagy a minőségi kolléga megfogta";
  return null;
}
