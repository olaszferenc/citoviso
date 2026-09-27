// Named gate subjects from the SHARED dev DB — each one an explicit predicate, and a LOUD failure
// when nothing satisfies it (ADR-0252, ADR-0249 ⑥; guard: scripts/gate-subject-check.mts).
//
// A gate that takes "the first operator_user / the newest lead / any partner" measures the shared
// DB's row order, not the change under test: 2026-09-27 three gates were red on a clean origin/main
// for exactly that. Every helper here says WHAT the subject must carry for the measurement to mean
// something, orders by a stable key (oldest first — new rows from other sessions do not reshuffle
// it), and throws "ELŐFELTÉTEL" instead of returning undefined, so no caller can skip silently.
//
// The `db` is passed in: gates import the client dynamically after setting their env (ESM hoisting).

import type { Kysely } from "kysely";
import type { Database } from "../../src/db/schema.js";

type Db = Kysely<Database>;

/** The dedicated test operator (`npx tsx scripts/operator-user.ts claude-test`). */
export const GATE_OPERATOR = "claude-test";

const precondition = (what: string, fix: string) => () => new Error(`ELŐFELTÉTEL HIÁNYZIK: ${what} — ${fix}`);

/**
 * The console login of a gate: the `claude-test` operator, never "any operator". An operator row
 * carries the console LANGUAGE of that person (`operator_user.lang`, ADR-0067 ③) — a gate falling
 * back to the first row would render the console in whatever language that person chose.
 */
export async function gateOperator(db: Db): Promise<{ id: string }> {
  return db
    .selectFrom("operator_user")
    .select("id")
    .where("username", "=", GATE_OPERATOR)
    .executeTakeFirstOrThrow(
      precondition(`nincs „${GATE_OPERATOR}” operátor a dev DB-ben`, `hozd létre: npx tsx scripts/operator-user.ts ${GATE_OPERATOR}`),
    );
}

/**
 * A tenant-admin login whose tenant HAS a site: the admin tabs, the photo upload and the help
 * panels only exist for a tenant with a site. Oldest such login first.
 */
export async function gateTenantUserWithSite(db: Db): Promise<{ id: string }> {
  return db
    .selectFrom("tenant_user")
    .select("tenant_user.id as id")
    .where(({ exists, selectFrom }) => exists(selectFrom("site").select("site.id").whereRef("site.tenant_id", "=", "tenant_user.tenant_id")))
    .orderBy("tenant_user.created_at", "asc")
    .orderBy("tenant_user.id", "asc")
    .limit(1)
    .executeTakeFirstOrThrow(precondition("nincs site-tal rendelkező tenant-fiók a dev DB-ben", "a tenant-admin felület nem mérhető"));
}

/**
 * A lead whose console page carries its full shape: at least one mock_artifact (the mock block)
 * AND at least one prospect (the outreach block). A bare scraped lead shows neither, so a surface
 * scan on it would pass without seeing half the page. Oldest such lead first.
 */
export async function gateLeadWithMockAndProspect(db: Db): Promise<{ id: string; name: string }> {
  return db
    .selectFrom("lead")
    .select(["lead.id as id", "lead.name as name"])
    .where(({ exists, selectFrom }) => exists(selectFrom("mock_artifact").select("mock_artifact.id").whereRef("mock_artifact.lead_id", "=", "lead.id")))
    .where(({ exists, selectFrom }) => exists(selectFrom("prospect").select("prospect.id").whereRef("prospect.lead_id", "=", "lead.id")))
    .orderBy("lead.created_at", "asc")
    .orderBy("lead.id", "asc")
    .limit(1)
    .executeTakeFirstOrThrow(precondition("nincs mockkal ÉS prospecttel rendelkező lead a dev DB-ben", "a /lead/<id> lap teljes alakja nem mérhető"));
}

/**
 * A prospect the console can draft an outreach letter for: it points at a mock artifact (the
 * letter links the mock). Oldest first.
 */
export async function gateDraftableProspect(db: Db): Promise<{ id: string }> {
  return db
    .selectFrom("prospect")
    .select("prospect.id as id")
    .where("prospect.mock_artifact_id", "is not", null)
    .orderBy("prospect.created_at", "asc")
    .orderBy("prospect.id", "asc")
    .limit(1)
    .executeTakeFirstOrThrow(precondition("nincs mockhoz kötött prospect a dev DB-ben", "a levél-vázlat nem mérhető"));
}

/**
 * An ACTIVE partner with at least one contact row: the /partner/<id> page then shows its contact
 * block too (a contact-less partner renders an empty section). Oldest first.
 */
export async function gatePartnerWithContact(db: Db): Promise<{ id: string }> {
  return db
    .selectFrom("partner")
    .select("partner.id as id")
    .where("partner.active", "=", true)
    .where(({ exists, selectFrom }) => exists(selectFrom("partner_contact").select("partner_contact.id").whereRef("partner_contact.partner_id", "=", "partner.id")))
    .orderBy("partner.created_at", "asc")
    .orderBy("partner.id", "asc")
    .limit(1)
    .executeTakeFirstOrThrow(precondition("nincs aktív, kapcsolattartós partner a dev DB-ben", "a partner-lap nem mérhető"));
}
