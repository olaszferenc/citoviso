// ADR-0405 — AUTOMATIC OUTREACH DISPATCH (owner, 2026-10-26: "SOS … hogy mielőbb elindulhasson
// az automata kiküldés … ezerszer kértem … ez a cél").
//
// The go list (MEHET) used to be text files on the dev machine and a Claude session clicked
// send-all lead by lead; when no session sat there, nothing went out (10-08 → 10-26). Now the
// go list is the `outreach_dispatch` table and a prod timer drains it.
//
// ⛔ EQUIVALENCE, NOT A SHORTCUT. One tick does what the console's send-all does, in the same
// order, with the same functions: photo gate → createProspect → guard/Vera confirm check →
// sendOutreachMail → startOutreachPair → activity log. Every send gate (unsubscribe, one-shot,
// address lock, §C, language pack, photo health, verdicts, weekday 9–16 window) re-runs inside
// those functions. What the console solves with a human click (a confirmable guard finding, a
// photo-gate acknowledgement, a pending Vera review) the timer NEVER acknowledges: the row
// goes to `held` with the reason, and a person decides.
//
// Pacing: ONE lead per tick (the timer fires every few minutes), a daily cap from the
// `outreach_auto` setting, and the master switch in the same setting (off by default).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { getSetting, setSetting } from "../console/appSettings.js";
import { createProspect } from "../console/data.js";
import { logLeadActivity, SYSTEM_ACTOR } from "../console/leadActivity.js";
import { assessMockPhotos, photoAcksOf, photoGateBlocks } from "./mockPhotoHealth.js";
import { ackCoversVerdicts, blockingVerdicts, hasPendingReview, verdictAckOf } from "./mockVerdictGate.js";
import { sendOutreachMail } from "./sendBatch.js";
import { startOutreachPair } from "./sendOutreachPair.js";
import { mockOutreachWindowBlocks } from "../sms/sendWindow.js";

export const AUTO_SETTING_KEY = "outreach_auto";
export const DEFAULT_DAILY_CAP = 40;

export interface AutoDispatchSettings {
  /** Master switch — false = the timer sends nothing (the queue keeps filling). */
  readonly enabled: boolean;
  /** Leads contacted per Budapest day by the timer (e-mail and/or pair counts as one). */
  readonly dailyCap: number;
}

export async function getAutoDispatchSettings(): Promise<AutoDispatchSettings> {
  const raw = await getSetting(AUTO_SETTING_KEY);
  let parsed: Partial<AutoDispatchSettings> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Partial<AutoDispatchSettings>) : {};
  } catch {
    // A broken value must not send: treat it as "off".
    return { enabled: false, dailyCap: DEFAULT_DAILY_CAP };
  }
  const cap = Number(parsed.dailyCap);
  return {
    enabled: parsed.enabled === true,
    dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CAP,
  };
}

export async function setAutoDispatchSettings(next: Partial<AutoDispatchSettings>): Promise<AutoDispatchSettings> {
  const cur = await getAutoDispatchSettings();
  const merged = { ...cur, ...next };
  await setSetting(AUTO_SETTING_KEY, JSON.stringify(merged));
  return merged;
}

export type EnqueueResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Put one lead on the go list. Refuses a lead already on it (any status — a held or cancelled
 * row is put back with `requeue`, deliberately), a lead already contacted, and an artifact
 * that is not this lead's or not approved by the curator.
 */
export async function enqueueDispatch(input: {
  leadId: string;
  artifactId: string;
  by: string;
}): Promise<EnqueueResult> {
  const art = await db
    .selectFrom("mock_artifact")
    .select(["lead_id", "status", "inputs"])
    .where("id", "=", input.artifactId)
    .executeTakeFirst();
  if (!art) return { ok: false, reason: "nincs ilyen mock" };
  if (art.lead_id !== input.leadId) return { ok: false, reason: "a mock nem ehhez a leadhez tartozik" };
  if (art.status !== "approved") return { ok: false, reason: `a mock nincs jóváhagyva (állapot: ${art.status})` };
  // Vera's PASS on the CURRENT text is a precondition of the go decision (ADR-0329); the tick
  // re-checks it (a later text change makes it stale → held).
  if ((art.inputs as { reviewVerdict?: unknown } | null)?.reviewVerdict !== "pass") {
    return { ok: false, reason: "nincs rögzített Vera-PASS ezen a mockon" };
  }
  const contacted = await alreadyContacted(input.leadId);
  if (contacted) return { ok: false, reason: contacted };
  const row = await db
    .insertInto("outreach_dispatch")
    .values({ lead_id: input.leadId, artifact_id: input.artifactId, queued_by: input.by })
    .onConflict((oc) => oc.column("lead_id").doNothing())
    .returning("id")
    .executeTakeFirst();
  if (!row) return { ok: false, reason: "már a kiküldési sorban van (ha tartva/visszavonva: requeue)" };
  return { ok: true, id: row.id };
}

/** Put a held / cancelled / skipped row back to the queue (a human decided). */
export async function requeueDispatch(leadId: string, by: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ status: "queued", note: `újra sorba: ${by}` })
    .where("lead_id", "=", leadId)
    .where("status", "in", ["held", "cancelled", "skipped"])
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

export async function cancelDispatch(leadId: string, by: string, reason: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ status: "cancelled", note: `visszavonta ${by}: ${reason}` })
    .where("lead_id", "=", leadId)
    .where("status", "in", ["queued", "held"])
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

/** Why this lead must not get a FIRST contact anymore, or null. */
async function alreadyContacted(leadId: string): Promise<string | null> {
  const p = await db
    .selectFrom("prospect")
    .select(["id"])
    .where("lead_id", "=", leadId)
    .where((eb) =>
      eb.or([
        eb("sent_at", "is not", null),
        eb("email_sent_at", "is not", null),
        eb("mms_sent_at", "is not", null),
        eb("sms_sent_at", "is not", null),
      ]),
    )
    .executeTakeFirst();
  return p ? "ez a lead már kapott megkeresést" : null;
}

/** Leads the timer contacted today (Budapest day). */
export async function sentToday(): Promise<number> {
  const r = await db
    .selectFrom("outreach_dispatch")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("status", "=", "sent")
    .where(
      "sent_at",
      ">=",
      sql<Date>`(date_trunc('day', now() AT TIME ZONE 'Europe/Budapest') AT TIME ZONE 'Europe/Budapest')`,
    )
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

export type TickOutcome =
  | { readonly kind: "off" }
  | { readonly kind: "window"; readonly reason: string }
  | { readonly kind: "cap"; readonly sent: number; readonly cap: number }
  | { readonly kind: "empty" }
  | { readonly kind: "done"; readonly leadId: string; readonly status: "sent" | "held" | "skipped"; readonly note: string };

/**
 * One tick: at most ONE lead. `force` skips only the master switch (for a supervised first
 * run); the window and the cap always hold.
 */
export async function runDispatchTick(now: Date, opts: { force?: boolean } = {}): Promise<TickOutcome> {
  // A tick that died mid-send leaves `sending`: it may or may not have sent, so a person
  // looks (held), never an automatic retry.
  await db
    .updateTable("outreach_dispatch")
    .set({ status: "held", note: "megszakadt futás — nézd meg a lead lapján, kiment-e, mielőtt újra sorba teszed" })
    .where("status", "=", "sending")
    .where("last_attempt_at", "<", new Date(now.getTime() - 30 * 60_000))
    .execute();

  const settings = await getAutoDispatchSettings();
  if (!settings.enabled && !opts.force) return { kind: "off" };
  const windowBlock = mockOutreachWindowBlocks(now);
  if (windowBlock) return { kind: "window", reason: windowBlock };
  const sent = await sentToday();
  if (sent >= settings.dailyCap) return { kind: "cap", sent, cap: settings.dailyCap };

  // Claim the oldest queued row; an overlapping tick finds nothing (SKIP LOCKED + status flip).
  const claimed = await db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("outreach_dispatch")
      .select(["id", "lead_id", "artifact_id"])
      .where("status", "=", "queued")
      .orderBy("queued_at")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst();
    if (!row) return null;
    await trx
      .updateTable("outreach_dispatch")
      .set({ status: "sending", attempts: sql`attempts + 1`, last_attempt_at: now })
      .where("id", "=", row.id)
      .execute();
    return row;
  });
  if (!claimed) return { kind: "empty" };

  let result: { status: "sent" | "held" | "skipped"; note: string; prospectId?: string };
  try {
    result = await dispatchOne(claimed.lead_id, claimed.artifact_id);
  } catch (e) {
    result = { status: "held", note: `hiba: ${(e as Error).message}`.slice(0, 500) };
  }
  await db
    .updateTable("outreach_dispatch")
    .set({
      status: result.status,
      note: result.note.slice(0, 1000),
      ...(result.prospectId ? { prospect_id: result.prospectId } : {}),
      ...(result.status === "sent" ? { sent_at: new Date() } : {}),
    })
    .where("id", "=", claimed.id)
    .execute();
  return { kind: "done", leadId: claimed.lead_id, status: result.status, note: result.note };
}

/** The console's send-all, step by step, without the human clicks (those → held). */
async function dispatchOne(
  leadId: string,
  artifactId: string,
): Promise<{ status: "sent" | "held" | "skipped"; note: string; prospectId?: string }> {
  const contacted = await alreadyContacted(leadId);
  if (contacted) return { status: "skipped", note: contacted };

  const art = await db
    .selectFrom("mock_artifact")
    .select(["status", "inputs"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!art) return { status: "skipped", note: "a mock időközben törlődött" };
  if (art.status !== "approved") return { status: "held", note: `a mock nincs jóváhagyva (állapot: ${art.status})` };

  // Photo gate — the same check POST /lead/:id/prospect runs before createProspect.
  const health = await assessMockPhotos(artifactId);
  if (photoGateBlocks(health, photoAcksOf(art.inputs))) {
    return { status: "held", note: `kép-kapu: ${health.verdict} — a lead lapján kell dönteni` };
  }

  // Guard findings + Vera review — what heldForVerdictConfirm sends to the confirm dialog.
  const blocking = blockingVerdicts(art.inputs);
  if (blocking.length > 0 && (hasPendingReview(blocking) || !ackCoversVerdicts(verdictAckOf(art.inputs), blocking))) {
    return {
      status: "held",
      note: hasPendingReview(blocking)
        ? "Vera-ellenőrzés hiányzik vagy elavult (a szöveg változott)"
        : "őr-lelet megerősítésre vár (a konzol küldés-felugrójában)",
    };
  }

  const prospect = await createProspect({ leadId, artifactId });
  if (!prospect) return { status: "skipped", note: "a lead nem található" };
  const prospectId = prospect.id;

  const mail = await sendOutreachMail(prospectId);
  const mailNote =
    mail.outcome.kind === "sent"
      ? "e-mail kiment"
      : mail.outcome.kind === "flagged"
        ? `e-mail FLAG: ${mail.outcome.reasons.join(" · ")}`
        : mail.outcome.kind === "skipped"
          ? `e-mail nem ment: ${mail.outcome.reason}`
          : "e-mail: dry-run";
  const pair = await startOutreachPair(prospectId);
  const pairNote = pair.ok ? `mobil-pár: ${pair.message}` : `mobil-pár nem ment: ${pair.message}`;
  const note = `${mailNote} · ${pairNote}`;

  if (mail.outcome.kind === "sent" || pair.ok) {
    await logLeadActivity({ leadId, tab: "ls-outreach", action: "prospect.send_all", actor: SYSTEM_ACTOR, subjectId: prospectId });
    return { status: "sent", note, prospectId };
  }
  return { status: "held", note, prospectId };
}

export interface DispatchStatus {
  readonly settings: AutoDispatchSettings;
  readonly sentToday: number;
  readonly counts: Readonly<Record<string, number>>;
}

export async function dispatchStatus(): Promise<DispatchStatus> {
  const rows = await db
    .selectFrom("outreach_dispatch")
    .select(["status", (eb) => eb.fn.countAll<string>().as("n")])
    .groupBy("status")
    .execute();
  return {
    settings: await getAutoDispatchSettings(),
    sentToday: await sentToday(),
    counts: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])),
  };
}
