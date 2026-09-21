// Module dependencies, bound to a TENANT's data (ADR-0192).
//
// src/modules.ts owns the RULE (which module needs which, and why); this file is
// the only place that answers the rule's questions about a real tenant: how many
// units they have, which modules they hold, and therefore what a change would
// leave behind. Everything that enforces the dependency — the toggle gate, the
// renewal sweep, the paid reconciliation, the guard — comes through here, so the
// same set can never be judged two different ways (feedback_one_rule_two_copies).
//
// ⛔ THE SET IS JUDGED AS A WHOLE, never an order row on its own: an upsell
// order's `modules` jsonb is a DELTA (ADR-0192 ③). Callers on the order path pass
// SUBMITTED ∪ ALREADY-HELD; anyone reading the jsonb alone rejects every upsell
// that does not re-buy its own dependencies.

import { sql } from "kysely";

import { getAlertRecipients } from "../console/appSettings.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { sendSms } from "../sms/sender.js";
import {
  MODULE_CATALOG,
  missingRequiredModules,
  removalClosure,
  type DependencyContext,
  type DependencyIssue,
  type MultiUnitState,
} from "../modules.js";

/**
 * How many bookable units the tenant has, as the `when: "multiUnit"` condition
 * needs it (ADR-0192 ④.4).
 *
 * ⛔ READ-ONLY on purpose. `getUnits()`/`ensureUnits()` CREATE a default unit and
 * backfill `is_whole_property` — a gate that writes while it judges is exactly the
 * defect ADR-0192 ② measured in the module preview (`renderTenantModulePreview`
 * → `ensureUnits` → INSERT).
 *
 * ⛔ "unknown" is NOT "no": no site, or no units recorded yet → the requirement
 * STANDS. The mock itself shows three room cards, so the opposite default would
 * contradict the screen the owner is looking at.
 *
 * ⚠️ Counts ALL units, including the ADR-0114 "whole property" row. Measured
 * (ADR-0192 ⑦): both readings — every unit, or every unit except the whole-property
 * one — mark the SAME sites multi-unit, so the simpler one is not a shortcut.
 */
export async function tenantMultiUnitState(tenantId: string): Promise<MultiUnitState> {
  const row = await db
    .selectFrom("site_unit")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select(sql<number>`count(*)::int`.as("n"))
    .where("site.tenant_id", "=", tenantId)
    .executeTakeFirst();
  const n = Number(row?.n ?? 0);
  if (n === 0) return "unknown";
  return n > 1 ? "yes" : "no";
}

/** The dependency context for this tenant (today: only the unit count). */
export async function tenantDependencyContext(tenantId: string): Promise<DependencyContext> {
  return { multiUnit: await tenantMultiUnitState(tenantId) };
}

/** Catalog ids that are always on and cannot be toggled away (the spine). */
function alwaysOnIds(): string[] {
  return MODULE_CATALOG.filter((m) => m.spine).map((m) => m.id);
}

/**
 * The modules the tenant HOLDS right now — active, including the ones cancelled
 * for the period end.
 *
 * ⭐ A cancelled-but-still-active module counts as held, deliberately: the tenant
 * paid for it until the renewal date and it still renders (`isRenderedModule`,
 * ADR-0193). Treating it as already gone would make the dependency vanish a month
 * before the module does — and the ADR-0192 lesson is the opposite one: the rule
 * must ALSO hold on the renewal day, when nobody is watching.
 */
export async function heldModuleIds(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module"])
    .where("tenant_id", "=", tenantId)
    .where("active", "=", true)
    .execute();
  return [...new Set([...rows.map((r) => r.module), ...alwaysOnIds()])];
}

/**
 * Would this WANTED set leave a module without a hard requirement? Empty array =
 * the change may proceed.
 *
 * The spine is folded in because the tenant cannot toggle it and a requirement may
 * legitimately point at it; `wanted` arrives already filtered to toggleable ids.
 */
export async function dependencyIssuesFor(
  tenantId: string,
  wanted: readonly string[],
): Promise<DependencyIssue[]> {
  const ctx = await tenantDependencyContext(tenantId);
  return missingRequiredModules([...wanted, ...alwaysOnIds()], ctx);
}

/**
 * Everything that must go with `moduleId` — the JOINT cancellation the screen
 * offers (ADR-0192 ④.2). ⛔ This COMPUTES the offer; it never performs it. An
 * automatic removing branch would reach into the ADR-0155 ③ data-loss trap, where
 * a missing field on the frozen admin page already reads as a cancellation.
 */
export async function cancellationGroup(
  tenantId: string,
  moduleId: string,
): Promise<string[]> {
  const ctx = await tenantDependencyContext(tenantId);
  return removalClosure(moduleId, await heldModuleIds(tenantId), ctx);
}

/** One pending cancellation that cannot be swept without breaking a live module. */
export interface HeldCancellation {
  readonly module: string;
  /** The still-active modules that would be left dangling. */
  readonly blockedBy: string[];
  /** The sentence from the catalogue — one source for every screen and every log. */
  readonly why: string;
}

/**
 * ⭐ THE UNATTENDED PATH. Which pending cancellations would, ON THE RENEWAL DAY,
 * leave an active module without its hard requirement?
 *
 * This is the case ADR-0192 ② singles out: at the moment the tenant clicks
 * "lemondom" the set is still VALID (the module lives until the period end), so a
 * guard tied to the toggle waves it through — and the rule then breaks on the
 * renewal day, with no human in the room. `applyRenewalPaid` sweeps every
 * `cancel_at_period_end` row in one statement and never asks this question.
 *
 * Returns the cancellations to HOLD BACK. Holding is the least-bad of three:
 * removing anyway leaves a paid booking calendar that cannot name a price;
 * cascading would silently delete a module the tenant paid for (forbidden,
 * ADR-0155 ③); holding costs us one cycle of a module we are not billing for, and
 * an operator alert forces a human to resolve it inside that cycle.
 */
export async function heldCancellations(tenantId: string): Promise<HeldCancellation[]> {
  const ctx = await tenantDependencyContext(tenantId);
  const rows = await db
    .selectFrom("module_entitlement")
    .select(["module", "cancel_at_period_end"])
    .where("tenant_id", "=", tenantId)
    .where("active", "=", true)
    .execute();

  const held = [...new Set([...rows.map((r) => r.module), ...alwaysOnIds()])];
  const leaving = rows.filter((r) => r.cancel_at_period_end).map((r) => r.module);
  if (!leaving.length) return [];

  // What the sweep WOULD leave behind, judged in one go: several modules can be
  // leaving at once, and holding them back one at a time would report a violation
  // that the full sweep does not actually produce.
  const after = held.filter((id) => !leaving.includes(id));
  const issues = missingRequiredModules(after, ctx);
  if (!issues.length) return [];

  const out: HeldCancellation[] = [];
  for (const id of leaving) {
    const blockedBy = issues.filter((i) => i.requiredId === id).map((i) => i.moduleId);
    if (!blockedBy.length) continue;
    out.push({
      module: id,
      blockedBy: [...new Set(blockedBy)],
      why: issues.find((i) => i.requiredId === id)!.why,
    });
  }
  return out;
}

/**
 * Accent-stripped for SMS: a Hungarian accent falls outside GSM-7, which cuts the
 * segment from 160 characters to 70 (the same reason src/text/money.ts bans NBSP).
 */
function ascii(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Operator-facing name of a catalog id (internal jargon is fine in an alert). */
function labelOf(id: string): string {
  return MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;
}

/**
 * The renewal held a cancellation back — a human has to resolve it inside this
 * cycle, so this must be as loud as the situation is quiet.
 *
 * Two channels, the same two as the AAM / pair / multilang alerts (ADR-0098). With
 * no recipient configured it says so LOUDLY and returns false rather than pretend
 * it warned anyone — a failure that prints nothing is worse than a red one
 * (feedback_silenced_failure_costs_hours).
 */
export async function alertHeldCancellations(
  tenantId: string,
  held: readonly HeldCancellation[],
): Promise<boolean> {
  if (!held.length) return true;
  const lines = held
    .map(
      (h) =>
        `${labelOf(h.module)} (lemondva, de ${h.blockedBy.map(labelOf).join(" + ")} él rá)`,
    )
    .join("; ");
  const rcpt = await getAlertRecipients();
  if (!rcpt.phone && !rcpt.email) {
    console.error(
      `[module-deps] ${tenantId}: a megújítás VISSZATARTOTT lemondás(oka)t — ${lines} —, ` +
        `de nincs riasztási címzett (konzol /settings vagy OWNER_ALERT_PHONE). ` +
        `Értesítés NEM ment ki, a tenant egy cikluson át ingyen viszi a modult.`,
    );
    return false;
  }
  // Internal, operator-facing text — outside the §B.18 customer-side i18n scope.
  if (rcpt.phone) {
    await sendSms({
      to: rcpt.phone,
      text:
        `Citoviso: modul-fuggoseg utkozes a megujitasnal — tenant ${tenantId}. ` +
        `Visszatartott lemondas: ${ascii(lines)}. ` +
        `A modul egy ciklusig ingyen fut. Kezi rendezes kell (kozos lemondas vagy visszavonas).`,
    });
  }
  if (rcpt.email) {
    await getEmailSender().send({
      to: rcpt.email,
      audience: "platform",
      subject: `Citoviso: modul-függőség ütközés a megújításnál — ${tenantId}`,
      text:
        `A megújítás visszatartott egy lemondást, mert elvégezve egy ÉLŐ modul maradt volna ` +
        `a kötelező párja nélkül (ADR-0192 ④.2 — kaszkád nincs).\n\n` +
        `Tenant: ${tenantId}\n${held
          .map(
            (h) =>
              `• ${labelOf(h.module)} — lemondva, de ${h.blockedBy
                .map(labelOf)
                .join(" + ")} még él rá.\n  ${h.why}`,
          )
          .join("\n")}\n\n` +
        `A visszatartott modul AKTÍV marad, de a megújítás NEM számlázta ki — ` +
        `tehát egy cikluson át ingyen fut. Rendezés: a tenant mondja le a csoportot együtt, ` +
        `vagy vonja vissza a lemondást.`,
    });
  }
  return true;
}
