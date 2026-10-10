// ADR-0345 — what happens to a LAPSED free trial (ADR-0344) afterwards: its data is kept for
// 90 days from the end of the trial (owner, 2026-10-09 — the same span the trial coupon lives,
// ADR-0342), a warning letter goes 7 days before, and then everything the trial built is DELETED:
// the tenant and all that cascades from it (site, admin account, login tokens, modules,
// messages, the coupon) plus sites/<tenant_id>/ on disk (snapshot + uploaded photos).
//
//   · the lead goes back to 'qualified' (from 'conversion' only) — nothing of ours is left with it;
//   · the free_trial ROW stays — status 'purged', tenant_id NULL (0099: ON DELETE SET NULL),
//     `purge_report` = what was deleted (row counts per table, slug, files; never the content).
//     It is the one-trial-per-lead guard and the stamped ÁSZF acceptance.
//   · ⛔ never a paid trace: a subscription, a saved card, a domain, any payment on the tenant's
//     orders, a paid/pending payment on the lead's orders → REFUSED, loudly, left for a human.
//     (A converted trial is never 'lapsed'; this is the second lock, not the first.)
//   · ⛔ never without the warning: the purge needs the 'p7' e-mail SENT on a day at least 7
//     days before. A late warning (outage) moves the deletion, never shortens the notice.
//   · dry run: reports what WOULD go, deletes nothing, claims nothing.
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { db, pool } from "../db/client.js";
import { addIsoDays, budapestIsoDay, budapestMidnight, budapestWeekday, isoDayDiff } from "../text/budapestTime.js";
import { mockOutreachWindowOpen } from "../sms/sendWindow.js";

/** Days the lapsed trial's data is kept, counted from the trial's last day (ÁSZF 1.4). */
export const TRIAL_RETENTION_DAYS = 90;
/** The purge warning goes this many days before the purge day. */
export const PURGE_WARNING_DAYS = 7;

/** Budapest day on which the data may first be deleted: the day AFTER the 90th kept day.
 *  The trial coupon is valid to the END of trial end + 90 (budapestDayEnd), and the ÁSZF
 *  keeps the data "90 napig" — a 07:00 purge ON the 90th day deleted both while the
 *  warning letter still offered the coupon "<that day>-ig" (IT B1-PURGE, ADR-0352). */
export function purgeDay(trialUntil: Date): string {
  return addIsoDays(budapestIsoDay(trialUntil), TRIAL_RETENTION_DAYS + 1);
}

/** The weekday the warning goes on: purge day − 7, a weekend moved BACK to Friday
 *  (forward would shorten the notice the letter promises). */
export function purgeWarningDay(trialUntil: Date): string {
  let d = addIsoDays(purgeDay(trialUntil), -PURGE_WARNING_DAYS);
  const wd = budapestWeekday(new Date(`${d}T12:00:00Z`));
  if (wd === 6) d = addIsoDays(d, -1);
  if (wd === 0) d = addIsoDays(d, -2);
  return d;
}

/** The day the deletion actually happens once the warning left on `warnedDay`: never
 *  earlier than the scheduled purge day, never less than 7 days after the warning. */
export function effectivePurgeDay(trialUntil: Date, warnedDay: string): string {
  const scheduled = purgeDay(trialUntil);
  const earliest = addIsoDays(warnedDay, PURGE_WARNING_DAYS);
  return earliest > scheduled ? earliest : scheduled;
}

export interface PurgeWarningTarget {
  readonly trialId: string;
  readonly tenantId: string;
  readonly email: string;
  readonly contactName: string;
  readonly trialUntil: Date;
  /** ISO day (Budapest) the data will be deleted — what the letter promises. */
  readonly purgeDay: string;
}

export interface PurgeWarningDeps {
  /** Sends the warning e-mail; throws on failure. The WORDING is the owner's (§2b gate). */
  readonly sendEmail: (t: PurgeWarningTarget) => Promise<void>;
}

/**
 * The purge warnings due at `now` — weekday 9–16 only (ADR-0334), one e-mail per trial, the
 * ledger row (free_trial_notice step 'p7') claimed BEFORE the send. `deps = null` / dryRun:
 * only logs (a dry claim would burn the step, and without a SENT warning nothing is ever
 * deleted — the dry run is safe by construction).
 */
export async function runPurgeWarnings(
  now: Date,
  deps: PurgeWarningDeps | null,
  opts: { readonly onlyTrialIds?: readonly string[]; readonly dryRun?: boolean } = {},
): Promise<{ sent: number; failed: number; due: number; windowClosed: boolean }> {
  const out = { sent: 0, failed: 0, due: 0, windowClosed: false };
  const dry = opts.dryRun === true || deps === null;
  if (!mockOutreachWindowOpen(now)) return { ...out, windowClosed: true };
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return out;
  const todayStart = budapestMidnight(budapestIsoDay(now));
  let q = db
    .selectFrom("free_trial")
    .select(["id", "tenant_id", "contact_email", "contact_name", "trial_until"])
    .where("status", "=", "lapsed")
    .where("tenant_id", "is not", null)
    // A 'failed' p7 is retried once a day (IT C3.4): without it the purge never comes (it needs
    // a SENT warning) and the data outlives the ÁSZF's 90 days. 'claimed' / 'sent' are left
    // alone — a stale claim may have gone out, so that one stays with the operator (watch ②).
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("free_trial_notice")
            .select("id")
            .whereRef("free_trial_notice.free_trial_id", "=", "free_trial.id")
            .where("step", "=", "p7")
            .where((n) => n.or([n("status", "!=", "failed"), n("created_at", ">=", todayStart as never)])),
        ),
      ),
    );
  if (opts.onlyTrialIds) q = q.where("id", "in", [...opts.onlyTrialIds]);
  const today = budapestIsoDay(now);

  for (const t of await q.execute()) {
    const until = new Date(t.trial_until as unknown as string);
    if (purgeWarningDay(until) > today) continue;
    out.due++;
    const target: PurgeWarningTarget = {
      trialId: t.id,
      tenantId: t.tenant_id!,
      email: t.contact_email,
      contactName: t.contact_name,
      trialUntil: until,
      purgeDay: effectivePurgeDay(until, today),
    };
    if (dry) {
      console.log(`[trial] TÖRLÉS-FIGYELMEZTETÉS ESEDÉKES (száraz, nem küld, nem foglal) · próba ${t.id} · törlés ${target.purgeDay}`); // i18n-exempt: operátori napló
      continue;
    }
    // created_at = the run's `now`: the purge counts its 7 days from the day the warning went.
    // (`as never`: Generated<Timestamp> does not accept a value in the schema typing.)
    // A failed row is re-claimed atomically (failed → claimed); two overlapping runs cannot both win.
    const claimed =
      (await db
        .insertInto("free_trial_notice")
        .values({ free_trial_id: t.id, step: "p7", channel: "email", status: "claimed", detail: target.purgeDay, created_at: now as never })
        .onConflict((oc) => oc.columns(["free_trial_id", "step", "channel"]).doNothing())
        .returning("id")
        .executeTakeFirst()) ??
      (await db
        .updateTable("free_trial_notice")
        .set({ status: "claimed", detail: target.purgeDay, created_at: now as never })
        .where("free_trial_id", "=", t.id)
        .where("step", "=", "p7")
        .where("channel", "=", "email")
        .where("status", "=", "failed")
        .where("created_at", "<", todayStart as never)
        .returning("id")
        .executeTakeFirst());
    if (!claimed) continue;
    try {
      await deps!.sendEmail(target);
      await setWarning(t.id, "sent", target.purgeDay);
      out.sent++;
    } catch (e) {
      await setWarning(t.id, "failed", (e as Error).message.slice(0, 500));
      out.failed++;
      console.error(`[trial] törlés-figyelmeztetés SIKERTELEN · próba ${t.id}: ${(e as Error).message}`); // i18n-exempt: operátori napló
    }
  }
  return out;
}

async function setWarning(trialId: string, status: "sent" | "failed", detail: string): Promise<void> {
  await db
    .updateTable("free_trial_notice")
    .set({ status, detail })
    .where("free_trial_id", "=", trialId)
    .where("step", "=", "p7")
    .where("channel", "=", "email")
    .execute();
}

/**
 * Every table the purge empties for one tenant, with the rows that belong to it. The tenant
 * row's delete cascades to all of them (schema FKs); the list is here to COUNT for the report,
 * and scripts/free-trial-retention-check.mts proves it covers the schema's whole cascade tree
 * (a new cascading table without a line here turns the guard red).
 */
const SITES = "(SELECT id FROM site WHERE tenant_id = $1)";
const UNITS = "(SELECT su.id FROM site_unit su JOIN site s ON s.id = su.site_id WHERE s.tenant_id = $1)";
export const PURGE_TABLES: readonly { readonly table: string; readonly where: string }[] = [
  { table: "tenant", where: "id = $1" },
  { table: "site", where: "tenant_id = $1" },
  { table: "site_unit", where: `site_id IN ${SITES}` },
  { table: "availability_day", where: `unit_id IN ${UNITS}` },
  { table: "calendar_link", where: `unit_id IN ${UNITS}` },
  { table: "unit_price", where: `unit_id IN ${UNITS}` },
  { table: "booking_request", where: `site_id IN ${SITES}` },
  { table: "site_module_config", where: `site_id IN ${SITES}` },
  { table: "site_module_config_history", where: `site_id IN ${SITES}` },
  { table: "site_multilang", where: `site_id IN ${SITES}` },
  { table: "site_place_rating", where: `site_id IN ${SITES}` },
  { table: "site_review", where: `site_id IN ${SITES}` },
  // ADR-0356: a former slug is minted only at a PAID activation, which the blockers refuse —
  // listed so the cascade stays counted, not because a purge is expected to meet one.
  { table: "site_slug_alias", where: `site_id IN ${SITES}` },
  { table: "site_visit", where: `tenant_id = $1 OR site_id IN ${SITES}` },
  { table: "multilang_generation", where: `tenant_id = $1 OR site_id IN ${SITES}` },
  { table: "module_entitlement", where: "tenant_id = $1" },
  { table: "tenant_user", where: "tenant_id = $1" },
  { table: "login_token", where: "tenant_user_id IN (SELECT id FROM tenant_user WHERE tenant_id = $1)" },
  { table: "tenant_message", where: "tenant_id = $1" },
  { table: "tenant_legal", where: "tenant_id = $1" },
  { table: "offer", where: "tenant_id = $1" },
  { table: "order_intent", where: "tenant_id = $1" },
];

/** Tables that are never purged: a row here for the tenant (or a paid order of its lead)
 *  means money or a real asset changed hands → the purge is refused. */
export const PURGE_BLOCKERS: readonly { readonly what: string; readonly sql: string }[] = [
  { what: "előfizetés", sql: "SELECT count(*)::int AS n FROM subscription WHERE tenant_id = $1" },
  { what: "mentett kártya", sql: "SELECT count(*)::int AS n FROM saved_card_history WHERE tenant_id = $1" },
  { what: "domain", sql: "SELECT count(*)::int AS n FROM domain_provisioning WHERE tenant_id = $1 OR site_id IN (SELECT id FROM site WHERE tenant_id = $1)" },
  { what: "fizetés a tenant rendelésén", sql: "SELECT count(*)::int AS n FROM payment p JOIN order_intent o ON o.id = p.order_intent_id WHERE o.tenant_id = $1" },
  {
    what: "fizetett/függő fizetés a lead rendelésén",
    sql:
      "SELECT count(*)::int AS n FROM payment p JOIN order_intent o ON o.id = p.order_intent_id " +
      "JOIN prospect pr ON pr.id = o.prospect_id WHERE pr.lead_id = $2 AND p.status IN ('paid', 'pending')",
  },
];

export interface PurgeCandidate {
  readonly trialId: string;
  readonly tenantId: string;
  readonly slug: string | null;
  readonly purgeDay: string;
  /** null = deletable now; otherwise why not (warning missing/too recent, a paid trace). */
  readonly blockedBy: string | null;
  readonly rows: Readonly<Record<string, number>>;
  readonly files: number;
  readonly bytes: number;
}

export interface PurgeResult {
  readonly purged: number;
  readonly refused: number;
  readonly waiting: number;
  readonly candidates: readonly PurgeCandidate[];
}

/**
 * Delete the lapsed trials whose retention is over. `dryRun`: report only — nothing deleted.
 * `onlyTrialIds` narrows it for guards (the dev DB is shared). `dataRoot` = where sites/ lives
 * (process.cwd() in production, like the asset store).
 */
export async function purgeExpiredTrials(
  now: Date,
  opts: { readonly dryRun?: boolean; readonly onlyTrialIds?: readonly string[]; readonly dataRoot?: string } = {},
): Promise<PurgeResult> {
  const dry = opts.dryRun === true;
  const root = opts.dataRoot ?? process.cwd();
  if (opts.onlyTrialIds && opts.onlyTrialIds.length === 0) return { purged: 0, refused: 0, waiting: 0, candidates: [] };
  const today = budapestIsoDay(now);
  let q = db
    .selectFrom("free_trial")
    .leftJoin("free_trial_notice", (j) =>
      j
        .onRef("free_trial_notice.free_trial_id", "=", "free_trial.id")
        .on("free_trial_notice.step", "=", "p7")
        .on("free_trial_notice.channel", "=", "email"),
    )
    .select([
      "free_trial.id",
      "free_trial.lead_id",
      "free_trial.tenant_id",
      "free_trial.trial_until",
      "free_trial_notice.status as warn_status",
      "free_trial_notice.created_at as warned_at",
    ])
    .where("free_trial.status", "=", "lapsed")
    .where("free_trial.converted_at", "is", null)
    .where("free_trial.tenant_id", "is not", null);
  if (opts.onlyTrialIds) q = q.where("free_trial.id", "in", [...opts.onlyTrialIds]);

  const candidates: PurgeCandidate[] = [];
  let purged = 0;
  let refused = 0;
  let waiting = 0;
  for (const t of await q.execute()) {
    const until = new Date(t.trial_until as unknown as string);
    if (purgeDay(until) > today) continue;
    const tenantId = t.tenant_id!;

    let blockedBy: string | null = null;
    let isRefusal = false;
    for (const b of PURGE_BLOCKERS) {
      const n = await countRaw(b.sql, [tenantId, t.lead_id]);
      if (n > 0) {
        blockedBy = `fizetett nyom: ${b.what} (${n})`;
        isRefusal = true;
        break;
      }
    }
    if (!blockedBy) {
      if (t.warn_status !== "sent" || !t.warned_at) {
        blockedBy = t.warn_status ? `a figyelmeztetés állapota: ${t.warn_status}` : "a figyelmeztetés még nem ment ki";
      } else {
        const warnedDay = budapestIsoDay(new Date(t.warned_at as unknown as string));
        const due = effectivePurgeDay(until, warnedDay);
        if (due > today) blockedBy = `a figyelmeztetés ${warnedDay}-én ment, a törlés ${due}-tól`;
      }
    }

    const site = await db.selectFrom("site").select("slug").where("tenant_id", "=", tenantId).executeTakeFirst();
    const rows: Record<string, number> = {};
    for (const p of PURGE_TABLES) rows[p.table] = await countRaw(`SELECT count(*)::int AS n FROM ${p.table} WHERE ${p.where}`, [tenantId]);
    const dir = path.resolve(root, "sites", tenantId);
    const { files, bytes } = await measure(dir);
    const c: PurgeCandidate = { trialId: t.id, tenantId, slug: site?.slug ?? null, purgeDay: purgeDay(until), blockedBy, rows, files, bytes };
    candidates.push(c);

    if (blockedBy) {
      if (isRefusal) {
        refused++;
        console.error(`[trial] TÖRLÉS MEGTAGADVA · próba ${t.id} · tenant ${tenantId} · ${blockedBy} — kézi döntés kell`); // i18n-exempt: operátori napló
      } else {
        waiting++;
        console.log(`[trial] törlés vár · próba ${t.id} · ${blockedBy}`); // i18n-exempt: operátori napló
      }
      continue;
    }
    if (dry) {
      console.log(`[trial] TÖRÖLHETŐ (száraz, nem töröl) · próba ${t.id} · tenant ${tenantId} · ${site?.slug ?? "-"} · ${summarize(rows)} · ${files} fájl`); // i18n-exempt: operátori napló
      continue;
    }

    const report = { tenantId, slug: c.slug, purgeDay: c.purgeDay, rows, files, bytes, dir: path.relative(root, dir) };
    const done = await db.transaction().execute(async (trx) => {
      // Re-check inside the transaction: still lapsed, still unpaid (a payment may have landed
      // between the scan and now — continuing thaws the trial and flips it to 'converted').
      const still = await trx
        .selectFrom("free_trial")
        .select("id")
        .where("id", "=", t.id)
        .where("status", "=", "lapsed")
        .where("tenant_id", "=", tenantId)
        .forUpdate()
        .executeTakeFirst();
      if (!still) return false;
      await trx.deleteFrom("tenant").where("id", "=", tenantId).execute();
      // Coordinator, 2026-10-09: nothing of ours is left with the lead → back to 'qualified'
      // (only from 'conversion' — a lead someone moved on, e.g. disqualified, stays put).
      // The one-trial-per-lead lock is the free_trial row, which stays.
      await trx
        .updateTable("lead")
        .set({ lifecycle_status: "qualified" })
        .where("id", "=", t.lead_id)
        .where("lifecycle_status", "=", "conversion")
        .execute();
      await trx
        .updateTable("free_trial")
        .set({ status: "purged", purged_at: now, purge_report: JSON.stringify(report) })
        .where("id", "=", t.id)
        .execute();
      return true;
    });
    if (!done) continue;
    await rm(dir, { recursive: true, force: true });
    purged++;
    console.warn(`[trial] TÖRÖLVE (90 nap lejárt) · próba ${t.id} · tenant ${tenantId} · ${c.slug ?? "-"} · ${summarize(rows)} · ${files} fájl`); // i18n-exempt: operátori napló
  }
  return { purged, refused, waiting, candidates };
}

async function countRaw(text: string, params: readonly unknown[]): Promise<number> {
  // pg cannot type a bind value the text never references ($1 unused by a lead-only blocker):
  // pass only the referenced ones, renumbered in order.
  const used = [...new Set([...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const renumbered = text.replace(/\$(\d+)/g, (_, d: string) => `$${used.indexOf(Number(d)) + 1}`);
  const res = await pool.query<{ n: number }>(renumbered, used.map((i) => params[i - 1]));
  return res.rows[0]?.n ?? 0;
}

function summarize(rows: Readonly<Record<string, number>>): string {
  return Object.entries(rows)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
}

async function measure(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (d: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        files++;
        bytes += (await stat(p)).size;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}

/** Days until a lapsed trial's data is deleted (≥ 0), for surfaces that state the deadline. */
export function daysUntilPurge(trialUntil: Date, now: Date): number {
  return Math.max(0, isoDayDiff(budapestIsoDay(now), purgeDay(trialUntil)));
}
