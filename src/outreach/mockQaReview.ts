// THE QUALITY COLLEAGUE'S REVIEW — a person-like look at every mock before its letter goes out.
//
// Owner 2026-11-25 („De miért nem lehet egy minőségi kollégát először, kiküldés előtt, megnézni,
// megnézetni vele?” → „Ok”): the machine gates (photoKind allow-list, mockRenderGate) throw out the
// obvious junk; the last word belongs to a colleague who LOOKS at the page as the lead will see it —
// the phone screens of the mock and the letter's picture — and passes or fails it with a reason.
// What the colleague has not passed does not go out, on any send path (the owner's sample letter,
// which is itself a look, excepted).
//
// The colleague is a subscription Claude session with eyes (no API key, no cost per call): it runs
// `scripts/qa-review.mts queue`, Reads the screenshots, and records `pass` / `fail` here.
//
// A review is bound to the mock FILE it saw (mtime, like the render gate's cache): a re-render makes
// it stale, and a stale review is no review.
import { stat } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { db } from "../db/client.js";

/** `mock_artifact.inputs` key holding the review. */
export const QA_REVIEW_KEY = "qaReview";
/** A fail must say what is wrong (the coordinator fixes from it). */
export const QA_FAIL_NOTE_MIN = 10;
/** The dispatch note of a row held by a failed review (re-queued only by a later pass). */
export const QA_HOLD_PREFIX = "minőségi kolléga:";
/** The dispatch note of a row held because its mock changed after the pass. */
export const QA_STALE_NOTE = "minőségi kolléga: a mock az átnézés óta változott — újra át kell nézni";
/**
 * The dispatch note of a row waiting for the OWNER's yes on the approval page (/jovahagyas).
 * Owner 2026-11-25: „csak akkor mehet ki egy e-mailes megkeresés, hogyha azt jóváhagyom a jóváhagyási
 * felületen. Csak azokat lássam jóváhagyandónak, amelyen a teljes kör végigment.” The colleague's pass
 * moves the row here; the owner's „Mehet” queues it again WITH his approval on the mock file.
 */
export const APPROVAL_PENDING_NOTE = "JÓVÁHAGYÁSRA VÁR (egylépéses átnéző: MEHET)";
/**
 * The dispatch note of a row the colleague has not looked at yet. Owner 2026-11-25: the rows the old
 * one-step reviewer had parked as „JÓVÁHAGYÁSRA VÁR” showed in the CRM as awaiting HIS approval
 * („1664 jóváhagyandó … ezek a régiek”) — a row only says that after the colleague's pass.
 */
export const QA_WAIT_NOTE = "minőségi kolléga: még nem nézte át — a tulaj lapjára csak az ő jóváhagyása után kerül";
/** `mock_artifact.inputs` key holding the owner's approval. */
export const OWNER_APPROVAL_KEY = "ownerApproval";
/** The dispatch note of a row held because its mock changed after the owner's yes. */
export const OWNER_STALE_NOTE = "tulaj: a mock a jóváhagyása óta változott — újra jóvá kell hagynia";

export interface QaReview {
  readonly verdict: "pass" | "fail";
  readonly note: string;
  readonly by: string;
  readonly at: string;
  /** Mock file mtime (seconds) the colleague saw. */
  readonly mtime: number;
}

export type QaState =
  | { readonly state: "pass"; readonly review: QaReview }
  | { readonly state: "fail"; readonly review: QaReview }
  | { readonly state: "missing" }
  | { readonly state: "stale"; readonly review: QaReview }
  | { readonly state: "nofile" };

/** SQL: the mock (alias `a`) carries a pass (freshness is checked on the file, in qaReviewState). */
export const MOCK_QA_PASSED_SQL = sql<boolean>`(a.inputs->${QA_REVIEW_KEY}->>'verdict') = 'pass'`;

/** SQL: the mock (alias `a`) carries the owner's approval (freshness is checked on the file). */
export const MOCK_OWNER_APPROVED_SQL = sql<boolean>`(a.inputs->${OWNER_APPROVAL_KEY}->>'mtime') is not null`;

export interface OwnerApproval {
  readonly by: string;
  readonly at: string;
  /** Mock file mtime (seconds) the owner approved. */
  readonly mtime: number;
}

export function ownerApprovalOf(inputs: unknown): OwnerApproval | null {
  const r = (inputs as Record<string, unknown> | null)?.[OWNER_APPROVAL_KEY] as Partial<OwnerApproval> | undefined;
  if (!r || typeof r.mtime !== "number") return null;
  return { by: String(r.by ?? ""), at: String(r.at ?? ""), mtime: r.mtime };
}

/** Why the mock may not go out for want of the owner's yes; null when he approved THIS file. */
export async function ownerApprovalBlock(artifactId: string): Promise<string | null> {
  const a = await db.selectFrom("mock_artifact").select(["path", "inputs"]).where("id", "=", artifactId).executeTakeFirst();
  const mtime = await mockMtime(a?.path);
  if (mtime == null) return "a mock fájlja hiányzik";
  const ok = ownerApprovalOf(a?.inputs);
  if (!ok) return "tulaj: még nem hagyta jóvá a jóváhagyó lapon (kiküldés csak a jóváhagyása után)";
  if (ok.mtime !== mtime) return OWNER_STALE_NOTE;
  return null;
}

/** Stamp the owner's yes on the mock file as it is now. */
export async function recordOwnerApproval(artifactId: string, by: string): Promise<boolean> {
  const a = await db.selectFrom("mock_artifact").select(["path"]).where("id", "=", artifactId).executeTakeFirst();
  const mtime = await mockMtime(a?.path);
  if (mtime == null) return false;
  const ok: OwnerApproval = { by, at: new Date().toISOString(), mtime };
  await db
    .updateTable("mock_artifact")
    .set({ inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{ownerApproval}', ${JSON.stringify(ok)}::jsonb, true)` })
    .where("id", "=", artifactId)
    .execute();
  return true;
}

export function qaReviewOf(inputs: unknown): QaReview | null {
  const r = (inputs as Record<string, unknown> | null)?.[QA_REVIEW_KEY] as Partial<QaReview> | undefined;
  if (!r || (r.verdict !== "pass" && r.verdict !== "fail") || typeof r.mtime !== "number") return null;
  return { verdict: r.verdict, note: String(r.note ?? ""), by: String(r.by ?? ""), at: String(r.at ?? ""), mtime: r.mtime };
}

async function mockMtime(relPath: string | null | undefined): Promise<number | null> {
  if (!relPath) return null;
  try {
    return Math.floor((await stat(path.resolve(process.cwd(), relPath))).mtimeMs / 1000);
  } catch {
    return null;
  }
}

export async function qaReviewState(artifactId: string): Promise<QaState> {
  const a = await db.selectFrom("mock_artifact").select(["path", "inputs"]).where("id", "=", artifactId).executeTakeFirst();
  const mtime = await mockMtime(a?.path);
  if (mtime == null) return { state: "nofile" };
  const review = qaReviewOf(a?.inputs);
  if (!review) return { state: "missing" };
  if (review.mtime !== mtime) return { state: "stale", review };
  return review.verdict === "pass" ? { state: "pass", review } : { state: "fail", review };
}

/** Operator-facing reason why a mock may not go out yet; null when the colleague passed it. */
export function qaBlockReason(s: QaState): string | null {
  switch (s.state) {
    case "pass":
      return null;
    case "fail":
      return `${QA_HOLD_PREFIX} nem hagyta jóvá — ${s.review.note}`;
    case "stale":
      return QA_STALE_NOTE;
    case "nofile":
      return "a mock fájlja hiányzik";
    default:
      return `${QA_HOLD_PREFIX} még nem nézte át (kiküldés csak a jóváhagyása után)`;
  }
}

/**
 * Record the colleague's verdict on the mock file as it is NOW. A fail holds the artifact's queued
 * dispatch rows with the reason; a pass moves the queued rows (and those an earlier fail or a stale
 * review held) to the owner's approval page — `requeued` counts them.
 */
export async function recordQaReview(
  artifactId: string,
  verdict: "pass" | "fail",
  note: string,
  by: string,
): Promise<{ ok: true; review: QaReview; held: number; requeued: number } | { ok: false; error: string }> {
  const n = note.trim();
  if (verdict === "fail" && n.length < QA_FAIL_NOTE_MIN) return { ok: false, error: `a nem-jóváhagyáshoz legalább ${QA_FAIL_NOTE_MIN} karakteres indok kell` };
  const a = await db.selectFrom("mock_artifact").select(["path"]).where("id", "=", artifactId).executeTakeFirst();
  if (!a) return { ok: false, error: "nincs ilyen mock" };
  const mtime = await mockMtime(a.path);
  if (mtime == null) return { ok: false, error: "a mock fájlja hiányzik" };
  const review: QaReview = { verdict, note: n, by, at: new Date().toISOString(), mtime };
  await db
    .updateTable("mock_artifact")
    .set({ inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{qaReview}', ${JSON.stringify(review)}::jsonb, true)` })
    .where("id", "=", artifactId)
    .execute();
  let held = 0;
  let requeued = 0;
  if (verdict === "fail") {
    const r = await db
      .updateTable("outreach_dispatch")
      .set({ status: "held", note: `${QA_HOLD_PREFIX} ${n}`.slice(0, 1000) })
      .where("artifact_id", "=", artifactId)
      .where("status", "=", "queued")
      .executeTakeFirst();
    held = Number(r.numUpdatedRows ?? 0);
  } else {
    // A pass does not send: the row goes to the owner's approval page (owner 2026-11-25).
    const r = await db
      .updateTable("outreach_dispatch")
      .set({ status: "held", note: APPROVAL_PENDING_NOTE })
      .where("artifact_id", "=", artifactId)
      .where((eb) => eb.or([eb("status", "=", "queued"), eb.and([eb("status", "=", "held"), eb("note", "like", `${QA_HOLD_PREFIX}%`)])]))
      .executeTakeFirst();
    requeued = Number(r.numUpdatedRows ?? 0);
  }
  return { ok: true, review, held, requeued };
}
