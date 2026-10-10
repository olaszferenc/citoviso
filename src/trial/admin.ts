// ADR-0344 C2c — what the tenant admin shows about a card-less free trial (approved plan
// "A", owner 2026-10-09; contract: assets/design-refs/console/proba-admin-sav/).
//
//   · active    → a thin strip on EVERY tab: days left, the end date, the discount, „Folytatom";
//                 warn tone from 3 days before the end. Not dismissable.
//   · lapsed    → the paused-site block (the trial has no subscription row, so the
//                 subscription freeze block never renders for it — measured 2026-10-09:
//                 the admin of a lapsed trial said NOTHING).
//   · converted → nothing; from then on the subscription speaks (purged: no tenant left).

import { db } from "../db/client.js";
import { config } from "../config.js";
import { MODULE_CATALOG } from "../modules.js";
import { budapestIsoDay } from "../text/budapestTime.js";
import { trialDaysLeft } from "./notices.js";
import { trialDiscount, type TrialDiscount } from "./offer.js";
import { effectivePurgeDay, purgeDay } from "./retention.js";

/** The strip turns warn this many days before the end (mock: „3 nappal a vége előtt"). */
export const TRIAL_WARN_DAYS = 3;

export interface TrialAdminState {
  readonly status: "active" | "lapsed";
  /** Budapest calendar days to the last day; 0 = ends today, negative = already over. */
  readonly daysLeft: number;
  /** The trial's length in days — the meter's denominator. */
  readonly totalDays: number;
  readonly untilIso: string;
  /**
   * ADR-0354 "C": the ONE discount the screens may promise (trialDiscount — the same answer
   * the letters and the continuation page get). kind "trial" = the „Próba-kedvezmény" (to the
   * end of the trial's last day, on the first fee); kind "coupon" = a pre-C trial's coupon,
   * which keeps its old wording; null = nothing to promise.
   */
  readonly discount: TrialDiscount | null;
  /** `/p/<token>/folytatas` on the platform host — null when it cannot be built. */
  readonly continueUrl: string | null;
  /** ADR-0345: the Budapest day the lapsed trial's data is deleted (end + 90 days; once the
   *  'p7' warning went, the day it actually moves to — effectivePurgeDay). */
  readonly purgeIso: string;
  /** The 'p7' purge warning e-mail has been sent. */
  readonly purgeWarned: boolean;
  /**
   * Lapsed only (empty while active): the modules the trial GAVE (module_entitlement
   * rows with trial_grant — lapseExpiredTrials switched exactly these off), in catalog
   * order, retired ones left out. `label` is the catalog's tenant-facing name (the one
   * the Modulok tab shows), still untranslated — the renderer runs it through T().
   * `spine` = in every package, so paying brings it back; the rest was trial-only.
   */
  readonly modules: readonly TrialGrantedModule[];
}

export interface TrialGrantedModule {
  readonly id: string;
  readonly label: string;
  readonly spine: boolean;
}

/** The trial-granted modules of a tenant, in catalog order (retired ones skipped). */
async function trialGrantedModules(tenantId: string): Promise<TrialGrantedModule[]> {
  const rows = await db
    .selectFrom("module_entitlement")
    .select("module")
    .where("tenant_id", "=", tenantId)
    .where("trial_grant", "=", true)
    .execute();
  const ids = new Set(rows.map((r) => r.module));
  return MODULE_CATALOG.filter((m) => ids.has(m.id) && !m.retired).map((m) => ({
    id: m.id,
    label: m.publicLabel,
    spine: Boolean(m.spine),
  }));
}

/** The trial state the admin frame renders, or null (no trial, or already paid). */
export async function trialAdminState(tenantId: string, now = new Date()): Promise<TrialAdminState | null> {
  const row = await db
    .selectFrom("free_trial")
    .leftJoin("prospect", "prospect.id", "free_trial.prospect_id")
    .select([
      "free_trial.id as id",
      "free_trial.status as status",
      "free_trial.started_at as startedAt",
      "free_trial.trial_until as trialUntil",
      "prospect.token as token",
    ])
    .where("free_trial.tenant_id", "=", tenantId)
    .executeTakeFirst();
  // 'purged' (ADR-0345: the lapsed trial's data deleted after 90 days) keeps no tenant_id, so it
  // cannot match here — named anyway, so the type stays honest.
  if (!row || row.status === "converted" || row.status === "purged") return null;
  const until = new Date(row.trialUntil as unknown as string);
  const started = new Date(row.startedAt as unknown as string);
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  const warn =
    row.status === "lapsed"
      ? await db
          .selectFrom("free_trial_notice")
          .innerJoin("free_trial", "free_trial.id", "free_trial_notice.free_trial_id")
          .select(["free_trial_notice.status as status", "free_trial_notice.created_at as at"])
          .where("free_trial.tenant_id", "=", tenantId)
          .where("free_trial_notice.step", "=", "p7")
          .where("free_trial_notice.channel", "=", "email")
          .executeTakeFirst()
      : undefined;
  const warned = warn?.status === "sent" && warn.at != null;
  return {
    status: row.status,
    daysLeft: trialDaysLeft(now, until),
    totalDays: Math.max(1, trialDaysLeft(started, until)),
    untilIso: budapestIsoDay(until),
    discount: await trialDiscount(row.id, now),
    continueUrl: base && row.token ? `${base}/p/${row.token}/folytatas` : null,
    purgeIso: warned ? effectivePurgeDay(until, budapestIsoDay(new Date(warn!.at as unknown as string))) : purgeDay(until),
    purgeWarned: warned,
    modules: row.status === "lapsed" ? await trialGrantedModules(tenantId) : [],
  };
}
