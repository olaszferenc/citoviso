/**
 * LEAD-NAPLÓ — ki szerkesztette utoljára a lead egyes füleit (migration 0089).
 *
 * Jóváhagyott terv: `assets/design-refs/console/lead-lastedit/` (A változat, 2026-10-05).
 * A lead-lap minden fülének második sora („ferenc · ma 13:20", nincs adat → „—"), a
 * mock-kártya „Létrehozta: …" sora és a „Döntés" zárójele innen, illetve a valódi
 * operátorból születik.
 *
 * ⛔ A szerzőt a KÉRÉS pillanatában kell megfogni: a háttérben futó generálás a mockot
 * percekkel később írja, amikor a kérés (és vele az operátor) már sehol sincs. Ezért a
 * hívó adja át az `Actor`-t, és a kész artefaktum-id-vel naplóz.
 *
 * ⛔ A napló SOHA nem buktatja el a műveletet, amit rögzít: egy elveszett naplósor
 * „—"-t mutat a fülön, egy elbukott mentés viszont elvett munka lenne.
 */
import { db } from "../db/client.js";
import type { LeadActivityTab } from "../db/schema.js";
import type { OperatorSession } from "../auth/operatorAuth.js";

export type { LeadActivityTab };

/** Who did it — the three kinds the plan keeps apart (README ③). */
export type Actor =
  | { readonly kind: "operator"; readonly operatorId: string | null; readonly label: string }
  | { readonly kind: "owner" }
  | { readonly kind: "system" };

export const SYSTEM_ACTOR: Actor = { kind: "system" };
export const OWNER_ACTOR: Actor = { kind: "owner" };

/** The signed-in operator as an actor. No session (a token-less internal call) = system. */
export function operatorActor(op: Pick<OperatorSession, "operatorUserId" | "username"> | null): Actor {
  return op ? { kind: "operator", operatorId: op.operatorUserId, label: op.username } : SYSTEM_ACTOR;
}

/** The name written into `curator_decision.decided_by` (plan ⑤: the real operator, not "console"). */
export function decidedByOf(op: Pick<OperatorSession, "username"> | null): string {
  return op?.username ?? "system";
}

export async function logLeadActivity(e: {
  readonly leadId: string;
  readonly tab: LeadActivityTab;
  readonly action: string;
  readonly actor: Actor;
  readonly subjectId?: string | null;
}): Promise<void> {
  try {
    await db
      .insertInto("lead_activity")
      .values({
        lead_id: e.leadId,
        tab: e.tab,
        action: e.action,
        actor_kind: e.actor.kind,
        operator_id: e.actor.kind === "operator" ? e.actor.operatorId : null,
        actor_label: e.actor.kind === "operator" ? e.actor.label : null,
        subject_id: e.subjectId ?? null,
      })
      .execute();
  } catch (err) {
    console.error(`[lead-activity] ${e.leadId} ${e.tab} ${e.action}: ${(err as Error).message}`);
  }
}

/** The lead an artifact belongs to (routes keyed by artifact id). */
export async function leadOfArtifact(artifactId: string): Promise<string | null> {
  const row = await db.selectFrom("mock_artifact").select("lead_id").where("id", "=", artifactId).executeTakeFirst();
  return row?.lead_id ?? null;
}

/** The lead a prospect belongs to (routes keyed by prospect id). */
export async function leadOfProspect(prospectId: string): Promise<string | null> {
  const row = await db.selectFrom("prospect").select("lead_id").where("id", "=", prospectId).executeTakeFirst();
  return row?.lead_id ?? null;
}

/** Same as `logLeadActivity`, the lead resolved from an artifact id. */
export async function logArtifactActivity(
  artifactId: string,
  tab: LeadActivityTab,
  action: string,
  actor: Actor,
): Promise<void> {
  const leadId = await leadOfArtifact(artifactId).catch(() => null);
  if (leadId) await logLeadActivity({ leadId, tab, action, actor, subjectId: artifactId });
}

/** Same as `logLeadActivity`, the lead resolved from a prospect id. */
export async function logProspectActivity(
  prospectId: string,
  tab: LeadActivityTab,
  action: string,
  actor: Actor,
): Promise<void> {
  const leadId = await leadOfProspect(prospectId).catch(() => null);
  if (leadId) await logLeadActivity({ leadId, tab, action, actor, subjectId: prospectId });
}

export interface LeadActivityEntry {
  readonly kind: "operator" | "owner" | "system";
  /** Operator username; null for owner/system (the view names those itself). */
  readonly label: string | null;
  readonly action: string;
  readonly at: string;
}

export interface LeadActivityView {
  /** The newest entry per tab. A missing tab = nothing recorded → „—". */
  readonly lastByTab: ReadonlyMap<string, LeadActivityEntry>;
  /** Who created each mock (artifact id → the generating entry). */
  readonly creators: ReadonlyMap<string, LeadActivityEntry & { readonly curated: boolean }>;
  /** When the log was switched on — a mock older than this is „a napló előtti mock". */
  readonly since: string | null;
}

export const EMPTY_ACTIVITY: LeadActivityView = { lastByTab: new Map(), creators: new Map(), since: null };

/** Actions that CREATE a mock — the card's „Létrehozta" line reads these. */
export const MOCK_CREATE_ACTIONS = ["mock.generate", "mock.generate_curated"] as const;

export async function getLeadActivity(leadId: string): Promise<LeadActivityView> {
  const [rows, mig] = await Promise.all([
    db
      .selectFrom("lead_activity")
      .select(["tab", "action", "actor_kind", "actor_label", "subject_id", "at"])
      .where("lead_id", "=", leadId)
      .orderBy("at", "desc")
      .limit(500)
      .execute(),
    db
      .selectFrom("schema_migrations")
      .select("applied_at")
      .where("name", "=", "0089_lead_activity.sql")
      .executeTakeFirst(),
  ]);
  const lastByTab = new Map<string, LeadActivityEntry>();
  const creators = new Map<string, LeadActivityEntry & { curated: boolean }>();
  for (const r of rows) {
    const e: LeadActivityEntry = {
      kind: r.actor_kind,
      label: r.actor_label,
      action: r.action,
      at: new Date(r.at as unknown as string).toISOString(),
    };
    if (!lastByTab.has(r.tab)) lastByTab.set(r.tab, e);
    if (r.subject_id && (MOCK_CREATE_ACTIONS as readonly string[]).includes(r.action) && !creators.has(r.subject_id)) {
      creators.set(r.subject_id, { ...e, curated: r.action === "mock.generate_curated" });
    }
  }
  return {
    lastByTab,
    creators,
    since: mig ? new Date(mig.applied_at as unknown as string).toISOString() : null,
  };
}
