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
//
// ⛔ THE PASS IS NOT A GATE ANY MORE (owner 2026-11-26 evening, ADR-0495). Measured on 11-26: 148 verdicts
// by four colleagues, ~85 % fails, nearly all the SAME two or three generator faults failed one by one; every
// generator fix made every pass stale (bound to the file), so the colleagues re-judged the same material all
// day, and the owner's page got 2 leads. The colleague's value was in FINDING rules the machine gate missed,
// not in judging each item. So: the owner's page and the dispatcher ask the MACHINE render gate (mockRenderGate.ts,
// not acknowledgeable, re-judged on every rule change) and the owner's own yes — a colleague's PASS is not needed.
// A colleague's FAIL on the current file still holds the row (a seen fault does not go out); a re-render clears
// it by mtime. The colleague works on a SAMPLE (`qa-review.mts sample`) and records fault KINDS (`note`,
// `findings`) that become rules — the 2c doctrine (one fault = one general rule, blind measurement).
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
export const QA_WAIT_NOTE = "gépi kapura vár — a tulaj lapjára a render-kapu passza után kerül (mindkét tervvel)";
/** The same row's note as written before 2026-11-26 (1 800+ live rows carry it); matched everywhere alongside the new one. */
export const QA_WAIT_NOTE_LEGACY = "minőségi kolléga: még nem nézte át — a tulaj lapjára csak az ő jóváhagyása után kerül";
/** Every note of a row waiting for the chain (owner's page / refresh / re-gate / messenger presence read). */
export const CHAIN_WAIT_NOTES: readonly string[] = [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE, QA_WAIT_NOTE_LEGACY];
/** `mock_artifact.inputs` key holding the colleague's non-blocking findings (fault kinds → rule candidates). */
export const QA_FINDINGS_KEY = "qaFindings";
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

/**
 * Operator-facing reason why a mock may not go out; null when nothing blocks. Since 2026-11-26 only a
 * colleague's FAIL on the current file (and a missing file) blocks — no review, a stale review or a pass
 * all let the machine gate and the owner decide.
 */
export function qaBlockReason(s: QaState): string | null {
  switch (s.state) {
    case "fail":
      return `${QA_HOLD_PREFIX} nem hagyta jóvá — ${s.review.note}`;
    case "nofile":
      return "a mock fájlja hiányzik";
    default:
      return null;
  }
}

async function mtimeOfArtifact(artifactId: string): Promise<number | null> {
  const a = await db.selectFrom("mock_artifact").select("path").where("id", "=", artifactId).executeTakeFirst();
  return mockMtime(a?.path);
}

/** The current file's mtime (seconds) of a mock, null when the file is missing — the gates' binding key. */
export const mockFileMtime = mtimeOfArtifact;

export interface QaFinding {
  /** Fault KIND, the rule candidate (e.g. „szobakártyán nem szoba”). */
  readonly category: string;
  /** Where it shows (sheet, screen) — so the coordinator finds it. */
  readonly where: string;
  readonly by: string;
  readonly at: string;
  readonly mtime: number;
}

/**
 * A NON-blocking finding on a mock (owner 2026-11-26): the colleague names the fault kind and where it is;
 * nothing is held. `findings` tallies the kinds across mocks — a kind seen on two or more mocks is a rule
 * candidate for the render gate or the generator, not an item to fail one by one.
 */
export async function recordQaFinding(artifactId: string, category: string, where: string, by: string): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  const c = category.trim();
  if (c.length < 4) return { ok: false, error: "a hiba-fajta legalább 4 karakter (ebből lesz a szabály)" };
  const mtime = await mtimeOfArtifact(artifactId);
  if (mtime == null) return { ok: false, error: "nincs ilyen mock, vagy a fájlja hiányzik" };
  const f: QaFinding = { category: c, where: where.trim(), by, at: new Date().toISOString(), mtime };
  await db
    .updateTable("mock_artifact")
    .set({ inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{qaFindings}', coalesce(inputs->'qaFindings', '[]'::jsonb) || ${JSON.stringify([f])}::jsonb, true)` })
    .where("id", "=", artifactId)
    .execute();
  const r = await db.selectFrom("mock_artifact").select(sql<number>`jsonb_array_length(coalesce(inputs->'qaFindings', '[]'::jsonb))`.as("n")).where("id", "=", artifactId).executeTakeFirst();
  return { ok: true, total: Number(r?.n ?? 0) };
}

/** The fault KIND of a fail note: the text before the first „ — ” / „:” (the colleagues write „kind — where”). */
export function faultKindOf(note: string): string {
  const m = /^\s*(?:\(\d+\)\s*)?([^—:\n]{4,80}?)\s*(?:—|:|$)/u.exec(note);
  return (m?.[1] ?? note.slice(0, 60)).trim().toLowerCase();
}

export interface FaultTally {
  readonly kind: string;
  readonly mocks: number;
  readonly leads: number;
  readonly examples: readonly string[];
}

/**
 * Fault kinds across the mocks since `since` — from the non-blocking findings and from the fail notes —
 * counted by mock and by lead, most frequent first. Two or more mocks with the same kind = a rule to write.
 */
export async function faultTally(since: Date): Promise<FaultTally[]> {
  const rows = await sql<{ id: string; lead_id: string; kind: string }>`
    select a.id, a.lead_id, f->>'category' as kind
      from mock_artifact a, jsonb_array_elements(coalesce(a.inputs->'qaFindings', '[]'::jsonb)) f
     where (f->>'at')::timestamptz >= ${since.toISOString()}::timestamptz
    union all
    select a.id, a.lead_id, a.inputs->'qaReview'->>'note' as kind
      from mock_artifact a
     where a.inputs->'qaReview'->>'verdict' = 'fail' and (a.inputs->'qaReview'->>'at')::timestamptz >= ${since.toISOString()}::timestamptz`.execute(db);
  const by = new Map<string, { mocks: Set<string>; leads: Set<string>; examples: string[] }>();
  for (const r of rows.rows) {
    const k = faultKindOf(r.kind ?? "");
    if (!k) continue;
    const e = by.get(k) ?? { mocks: new Set(), leads: new Set(), examples: [] };
    e.mocks.add(r.id);
    e.leads.add(r.lead_id);
    if (e.examples.length < 3) e.examples.push(r.id.slice(0, 8));
    by.set(k, e);
  }
  return [...by.entries()]
    .map(([kind, e]) => ({ kind, mocks: e.mocks.size, leads: e.leads.size, examples: e.examples }))
    .sort((a, b) => b.mocks - a.mocks || a.kind.localeCompare(b.kind));
}

/**
 * Record the colleague's verdict on the mock file as it is NOW. A fail holds the artifact's queued and
 * chain-waiting dispatch rows with the reason (a seen fault does not go out); a pass moves the queued rows
 * (and those an earlier fail held) to the owner's page — since 2026-11-26 the pass is not required there,
 * the machine gate and the owner decide. `requeued` counts the moved rows.
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
      .where((eb) => eb.or([eb("status", "=", "queued"), eb.and([eb("status", "=", "held"), eb("note", "in", [...CHAIN_WAIT_NOTES, QA_STALE_NOTE])])]))
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
