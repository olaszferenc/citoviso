// ADR-XXXX — the end of a card-less free trial (ADR-0342): it PAUSES, it never charges.
//
//   · lapse    — a trial past `trial_until` → free_trial 'lapsed', the site 'suspended'
//                (the public host then serves the ADR-0080 ⑥ 503 + Retry-After courtesy
//                page, never a 404), the `trial_grant` modules off. Admin login and every
//                piece of data stay: continuing = paying, and the payment thaws it.
//   · warnings — T−3 and T−1 (e-mail + SMS), only on weekdays 9–16 Budapest (ADR-0334's
//                window). A step that falls on a weekend moves BACK to that Friday: moving
//                it forward would put a T−1 after the freeze (a Sunday expiry's Monday).
//                When both steps land on the same day only the later one (t1) goes — two
//                letters in one hour saying the same date is noise, not care.
//
// ⛔ The trial tenant has NO subscription row, so nothing here touches the billing ladder,
// and nothing in the billing ladder touches a trial (ADR-0342).
import { db } from "../db/client.js";
import { addIsoDays, budapestIsoDay, budapestWeekday } from "../text/budapestTime.js";
import { mockOutreachWindowOpen } from "../sms/sendWindow.js";

export interface LapseResult {
  readonly lapsed: number;
  readonly sitesSuspended: number;
  readonly modulesOff: number;
}

/**
 * Lapse every running trial whose time is up. Idempotent: only `status='active'` rows
 * move, so a re-run (or a crashed run resumed) does nothing twice. `onlyTrialIds` narrows
 * it for guards — the dev DB is shared, a guard must never lapse somebody else's trial.
 */
export async function lapseExpiredTrials(
  now: Date,
  opts: { readonly onlyTrialIds?: readonly string[] } = {},
): Promise<LapseResult> {
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return { lapsed: 0, sitesSuspended: 0, modulesOff: 0 };
  let q = db
    .updateTable("free_trial")
    .set({ status: "lapsed", lapsed_at: now })
    .where("status", "=", "active")
    .where("trial_until", "<=", now);
  if (opts.onlyTrialIds) q = q.where("id", "in", [...opts.onlyTrialIds]);
  const rows = await q.returning(["id", "tenant_id"]).execute();

  let sitesSuspended = 0;
  let modulesOff = 0;
  for (const r of rows) {
    if (!r.tenant_id) continue; // a claim whose provisioning never finished: nothing is public
    const s = await db
      .updateTable("site")
      .set({ status: "suspended" })
      .where("tenant_id", "=", r.tenant_id)
      .where("status", "=", "live")
      .returning("id")
      .execute();
    sitesSuspended += s.length;
    // Only what the trial GAVE goes off; a module the tenant paid for (trial_grant
    // cleared by syncEntitlementsToPaid) is not ours to take.
    const m = await db
      .updateTable("module_entitlement")
      .set({ active: false })
      .where("tenant_id", "=", r.tenant_id)
      .where("trial_grant", "=", true)
      .where("active", "=", true)
      .returning("module")
      .execute();
    modulesOff += m.length;
    console.warn(`[trial] LEJÁRT → szünetel · próba ${r.id} · tenant ${r.tenant_id} · ${m.length} próba-modul ki`); // i18n-exempt: operátori napló
  }
  return { lapsed: rows.length, sitesSuspended, modulesOff };
}

export type NoticeStep = "t3" | "t1";
const STEP_DAYS: Record<NoticeStep, number> = { t3: 3, t1: 1 };

/** The weekday (Budapest) a step is sent on: trial_until's day − N, a weekend moved back
 *  to Friday. Null = the step does not exist for this trial (it would fall before the
 *  trial's first day) or it collides with the later step (t3 on t1's day → t1 only). */
export function noticeSendDay(step: NoticeStep, startedAt: Date, trialUntil: Date): string | null {
  const day = (s: NoticeStep): string => {
    let d = addIsoDays(budapestIsoDay(trialUntil), -STEP_DAYS[s]);
    const wd = budapestWeekday(new Date(`${d}T12:00:00Z`));
    if (wd === 6) d = addIsoDays(d, -1);
    if (wd === 0) d = addIsoDays(d, -2);
    return d;
  };
  const d = day(step);
  if (d < budapestIsoDay(startedAt)) return null;
  if (step === "t3" && d >= (day("t1") ?? "")) return null;
  return d;
}

export interface TrialNoticeTarget {
  readonly trialId: string;
  readonly tenantId: string;
  readonly step: NoticeStep;
  readonly email: string;
  readonly phone: string | null;
  readonly trialUntil: Date;
}

export interface TrialNoticeDeps {
  /** Sends the step's e-mail; throws on failure. The WORDING is the owner's (§2b gate). */
  readonly sendEmail: (t: TrialNoticeTarget) => Promise<void>;
  /** Sends the step's SMS; throws on failure. */
  readonly sendSms: (t: TrialNoticeTarget & { phone: string }) => Promise<void>;
}

/**
 * The T−3 / T−1 warnings due at `now`. Nothing goes out outside the weekday 9–16 window,
 * and a (trial, step, channel) row is CLAIMED before the send, so a second run — or two
 * overlapping ones — can never send twice. Only the HIGHEST due step is sent; a lower one
 * that was missed is recorded as skipped (no two letters in one go after an outage).
 *
 * `dryRun` (deps = null): only LOGS what is due — no send, and no ledger row either, because
 * the claim is written before the send: a dry claim would burn the step for good, and the
 * day the wording is approved the trial would get nothing (§2b — until then the hourly tick
 * runs dry, scripts/offer-followup.mts).
 */
export async function runTrialNotices(
  now: Date,
  deps: TrialNoticeDeps | null,
  opts: { readonly onlyTrialIds?: readonly string[]; readonly dryRun?: boolean } = {},
): Promise<{ sent: number; skipped: number; failed: number; due: number; windowClosed: boolean }> {
  const out = { sent: 0, skipped: 0, failed: 0, due: 0, windowClosed: false };
  const dry = opts.dryRun === true || deps === null;
  if (!mockOutreachWindowOpen(now)) return { ...out, windowClosed: true };
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return out;
  let q = db
    .selectFrom("free_trial")
    .select(["id", "tenant_id", "contact_email", "contact_phone", "started_at", "trial_until"])
    .where("status", "=", "active")
    .where("tenant_id", "is not", null)
    .where("trial_until", ">", now);
  if (opts.onlyTrialIds) q = q.where("id", "in", [...opts.onlyTrialIds]);
  const today = budapestIsoDay(now);

  for (const t of await q.execute()) {
    const started = new Date(t.started_at as unknown as string);
    const until = new Date(t.trial_until as unknown as string);
    const due = (["t1", "t3"] as const).filter((s) => {
      const d = noticeSendDay(s, started, until);
      return d !== null && d <= today;
    });
    if (!due.length) continue;
    const [step, ...older] = due;
    if (dry) {
      const done = await db
        .selectFrom("free_trial_notice")
        .select("id")
        .where("free_trial_id", "=", t.id)
        .where("step", "=", step!)
        .executeTakeFirst();
      if (done) continue;
      out.due++;
      console.log(`[trial] ESEDÉKES (száraz, nem küld, nem foglal) · ${step} · próba ${t.id} · lejár ${until.toISOString()}`); // i18n-exempt: operátori napló
      continue;
    }
    for (const s of older) {
      for (const channel of ["email", "sms"] as const) {
        const r = await claim(t.id, s, channel, "skipped", "egy későbbi lépcső már esedékes");
        if (r) out.skipped++;
      }
    }
    const target: TrialNoticeTarget = {
      trialId: t.id,
      tenantId: t.tenant_id!,
      step: step!,
      email: t.contact_email,
      phone: t.contact_phone,
      trialUntil: until,
    };
    if (await claim(t.id, step!, "email", "claimed", null)) {
      try {
        await deps!.sendEmail(target);
        await mark(t.id, step!, "email", "sent", null);
        out.sent++;
      } catch (e) {
        await mark(t.id, step!, "email", "failed", (e as Error).message.slice(0, 500));
        out.failed++;
        console.error(`[trial] ${step} e-mail SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }
    if (!t.contact_phone) {
      if (await claim(t.id, step!, "sms", "skipped", "nincs telefonszám")) out.skipped++;
    } else if (await claim(t.id, step!, "sms", "claimed", null)) {
      try {
        await deps!.sendSms({ ...target, phone: t.contact_phone });
        await mark(t.id, step!, "sms", "sent", null);
        out.sent++;
      } catch (e) {
        await mark(t.id, step!, "sms", "failed", (e as Error).message.slice(0, 500));
        out.failed++;
        console.error(`[trial] ${step} SMS SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
      }
    }
  }
  return out;
}

/** Insert the (trial, step, channel) row; false = it already existed (sent, claimed or skipped). */
async function claim(
  trialId: string,
  step: NoticeStep,
  channel: "email" | "sms",
  status: "claimed" | "skipped",
  detail: string | null,
): Promise<boolean> {
  const r = await db
    .insertInto("free_trial_notice")
    .values({ free_trial_id: trialId, step, channel, status, detail })
    .onConflict((oc) => oc.columns(["free_trial_id", "step", "channel"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return Boolean(r);
}

async function mark(
  trialId: string,
  step: NoticeStep,
  channel: "email" | "sms",
  status: "sent" | "failed",
  detail: string | null,
): Promise<void> {
  await db
    .updateTable("free_trial_notice")
    .set({ status, detail })
    .where("free_trial_id", "=", trialId)
    .where("step", "=", step)
    .where("channel", "=", channel)
    .execute();
}
