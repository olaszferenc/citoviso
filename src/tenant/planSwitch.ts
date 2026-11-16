// tervvaltas E (2026-11-16, owner: „a 2 két tervet bármikor lehessen váltogatni. Miért ne?”) —
// the owner switches the site between the plans its link offered, during the trial and after
// purchase. Contract: assets/design-refs/console/tervvalto-admin/README.md; ADR-XXXX.
//
// What a switch IS (B report 2.2–2.5): `site.source_artifact_id` points at another plan's
// artifact and the snapshot is re-rendered. Everything the owner edited lives in
// `site.edited_site_data` (field-named, template-free) and in the module tables, so it carries
// over; what they never edited comes from the new plan's own data. Nothing paid runs (B 2.7).
//
// ⛔ Only the lead's OWN offered plans (listProspectPlans) — the ones that passed Vera, the
// design gate and the room filter. A raw template swap would skip all three (B 2.8).
// ⛔ A plan a curator REJECTED stays refused (the human NO on its content). The one exception
// is a reject written by the approval of a sibling plan („superseded_by:” — the one-approved-
// mock-per-lead rule, curateArtifact): that is bookkeeping, not a verdict, and refusing it
// would make „Visszavonás” fail after the first switch.

import { db } from "../db/client.js";
import { approveArtifactForBuyerOrder, curateArtifact } from "../console/data.js";
import { listProspectPlans } from "../outreach/planSet.js";
import { rerenderTenantSnapshot } from "./editor.js";

/** One plan as the Kinézet tab shows it. */
export interface TenantPlan {
  /** The number the lead saw on the link (/p/<token>/v/<n>) — „1. terv”, „2. terv”. */
  readonly n: number;
  readonly artifactId: string;
  /** recipe.template — the view turns it into a one-line description. */
  readonly template: string;
  /** False: a curator rejected it, or it has nothing to render from. Shown, never offered. */
  readonly available: boolean;
}

export interface TenantPlanSet {
  readonly siteId: string;
  readonly siteStatus: string;
  /** The plan the site renders now (site.source_artifact_id). */
  readonly currentArtifactId: string;
  readonly plans: readonly TenantPlan[];
  /** The plan the LAST switch came from, when it is still switchable — „Visszavonás”. */
  readonly previousArtifactId: string | null;
}

type Exec = typeof db;

function templateOf(inputs: unknown): string | null {
  const i = (inputs ?? {}) as { recipe?: { template?: unknown }; siteData?: unknown };
  if (!i.recipe || !i.siteData) return null;
  return typeof i.recipe.template === "string" ? i.recipe.template : "";
}

/** Rejected by a curator's verdict (not by a sibling's approval)? */
async function rejectedByVerdict(artifactId: string, exec: Exec): Promise<boolean> {
  const last = await exec
    .selectFrom("curator_decision")
    .select(["decision", "notes"])
    .where("mock_artifact_id", "=", artifactId)
    .orderBy("decided_at", "desc")
    .executeTakeFirst();
  // A 'rejected' status with no decision row is a verdict too (fail-closed).
  if (!last) return true;
  return !(last.decision === "reject" && (last.notes ?? "").startsWith("superseded_by:"));
}

/**
 * The plan set behind a tenant's site, or null when the tenant has no site to switch.
 *
 * The set is the link's (listProspectPlans) — of the lead's prospects, the one whose plans
 * contain the plan the site runs now. A site whose source is in no plan set (an old,
 * hand-provisioned site) gets ONE plan: nothing to switch, and the tab says so.
 */
export async function tenantPlanSet(tenantId: string, exec: Exec = db): Promise<TenantPlanSet | null> {
  const site = await exec
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["site.id as siteId", "site.status as status", "site.source_artifact_id as source", "tenant.lead_id as leadId"])
    .where("site.tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!site?.source) return null;
  const current = site.source;

  const prospects = await exec
    .selectFrom("prospect")
    .innerJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
    .select(["prospect.id as id", "mock_artifact.id as artifactId", "mock_artifact.path as artifactPath"])
    .where("prospect.lead_id", "=", site.leadId)
    .orderBy("prospect.created_at", "desc")
    .execute();
  let set: { n: number; artifactId: string }[] = [{ n: 1, artifactId: current }];
  for (const p of prospects) {
    const plans = await listProspectPlans(p.id, { artifactId: p.artifactId, artifactPath: p.artifactPath ?? "" }, exec);
    if (plans.some((x) => x.artifactId === current)) {
      set = plans.map((x) => ({ n: x.n, artifactId: x.artifactId }));
      break;
    }
  }

  const rows = await exec
    .selectFrom("mock_artifact")
    .select(["id", "status", "inputs", "lead_id"])
    .where("id", "in", set.map((x) => x.artifactId))
    .execute();
  const plans: TenantPlan[] = [];
  for (const x of set) {
    const r = rows.find((y) => y.id === x.artifactId);
    const template = r ? templateOf(r.inputs) : null;
    let available = !!r && r.lead_id === site.leadId && template !== null;
    if (available && r!.status === "rejected" && x.artifactId !== current) available = !(await rejectedByVerdict(x.artifactId, exec));
    plans.push({ n: x.n, artifactId: x.artifactId, template: template ?? "", available });
  }

  const last = await exec
    .selectFrom("site_plan_switch")
    .select(["from_artifact_id", "to_artifact_id"])
    .where("site_id", "=", site.siteId)
    .orderBy("at", "desc")
    .executeTakeFirst();
  const prev =
    last && last.to_artifact_id === current && last.from_artifact_id && last.from_artifact_id !== current
      ? plans.find((p) => p.artifactId === last.from_artifact_id && p.available)?.artifactId ?? null
      : null;

  return { siteId: site.siteId, siteStatus: site.status, currentArtifactId: current, plans, previousArtifactId: prev };
}

export type SwitchResult =
  | { readonly ok: true; readonly from: string; readonly to: string; readonly n: number }
  | { readonly ok: false; readonly error: "no_site" | "not_found" | "not_available" | "same" | "render_failed" };

/**
 * Switch the tenant's site to another of its plans. `actor`: 'tenant_user:<id>' from the admin.
 *
 * Order matters: the snapshot renders FROM the DB row, so the row moves first; a failed render
 * moves it back and re-renders the old plan — the owner never ends up on a plan whose page
 * could not be built, and no log row claims a switch that did not happen.
 */
export async function switchSitePlan(tenantId: string, artifactId: string, actor: string): Promise<SwitchResult> {
  const set = await tenantPlanSet(tenantId);
  if (!set) return { ok: false, error: "no_site" };
  const plan = set.plans.find((p) => p.artifactId === artifactId);
  if (!plan) return { ok: false, error: "not_found" };
  if (artifactId === set.currentArtifactId) return { ok: false, error: "same" };
  if (!plan.available) return { ok: false, error: "not_available" };

  // The buyer's choice IS the approval (2026-09-13 rule, the ADR-0449 pattern): a `generated`
  // alternative is approved, logged, so the payment gate (/folytatas → requestPayment) and the
  // paid conversion accept the plan the site now runs.
  const st = await db.selectFrom("mock_artifact").select("status").where("id", "=", artifactId).executeTakeFirst();
  if (st?.status === "generated") await approveArtifactForBuyerOrder(artifactId, `site_switch:${set.siteId}`);
  // A sibling-superseded plan (see the header) is approved back the same logged way.
  else if (st?.status === "rejected") await curateArtifact(artifactId, "approve", `site_switch:${set.siteId}`, "buyer_order");

  const from = set.currentArtifactId;
  await db.updateTable("site").set({ source_artifact_id: artifactId }).where("id", "=", set.siteId).execute();
  let rendered = false;
  try {
    rendered = await rerenderTenantSnapshot(tenantId, { quietStale: true });
  } catch (e) {
    console.error(`[plan-switch] render HIBA (tenant ${tenantId}, ${artifactId}):`, e);
  }
  if (!rendered) {
    await db.updateTable("site").set({ source_artifact_id: from }).where("id", "=", set.siteId).execute();
    await rerenderTenantSnapshot(tenantId, { quietStale: true }).catch(() => false);
    return { ok: false, error: "render_failed" };
  }
  await db
    .insertInto("site_plan_switch")
    .values({ site_id: set.siteId, from_artifact_id: from, to_artifact_id: artifactId, actor })
    .execute();
  return { ok: true, from, to: artifactId, n: plan.n };
}
