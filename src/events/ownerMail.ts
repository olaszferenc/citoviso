// The weekly program-recommender mail to the OWNER (never to guests — owner ruling,
// 2026-09-22). Runs after the Monday gathering (scripts/gather-events.mts).
//
// Rules, same spine as the monthly traffic mail (ADR-0108):
//   1. ONCE A WEEK per tenant — the tenant_message log (kind 'programs') is the
//      idempotency anchor, so a re-run in the same week sends nothing twice.
//   2. SILENCE when there is nothing to choose from: an empty pool mail would only
//      say "nothing happened" and teach the owner to ignore the next one.
//   3. Only LIVE sites whose tenant renders `poi`. One tenant's failure never stops
//      the rest.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getEmailSender } from "../email/sender.js";
import { buildProgramsEmail } from "../email/programsEmail.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { tenantRendersModule } from "../tenant/modules.js";
import { PROGRAMS_ON_PAGE, readPicks, resolvePicks, siteOwnSettlement, siteProgramPool } from "./picks.js";

export interface ProgramsMailResult {
  sent: number;
  skippedEmpty: number;
  skippedAlready: number;
  failed: number;
}

export async function sendWeeklyProgramMails(opts: { dryRun?: boolean; now?: Date } = {}): Promise<ProgramsMailResult> {
  const now = opts.now ?? new Date();
  const out: ProgramsMailResult = { sent: 0, skippedEmpty: 0, skippedAlready: 0, failed: 0 };
  const sites = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["site.id as siteId", "site.tenant_id as tenantId", "site.slug", "tenant.display_name as name"])
    .where("site.status", "=", "live")
    .execute();

  for (const s of sites) {
    try {
      if (!(await tenantRendersModule(s.tenantId, "poi"))) continue;
      const already = await db
        .selectFrom("tenant_message")
        .select("id")
        .where("tenant_id", "=", s.tenantId)
        .where("kind", "=", "programs")
        .where(sql<boolean>`sent_at >= date_trunc('week', ${now}::timestamptz)`)
        .executeTakeFirst();
      if (already) {
        out.skippedAlready++;
        continue;
      }
      const programPool = await siteProgramPool(s.siteId);
      const { state, events } = programPool;
      if (state !== "ok" || !events.length) {
        out.skippedEmpty++;
        continue;
      }
      const cfg = await db
        .selectFrom("site_module_config")
        .select("config")
        .where("site_id", "=", s.siteId)
        .where("module", "=", "poi")
        .executeTakeFirst();
      const picked = resolvePicks(readPicks((cfg?.config ?? {}) as Record<string, unknown>), programPool);
      // Own programs take a slot but are not in the gathered pool (ADR-0238).
      const autoCount = Math.min(PROGRAMS_ON_PAGE - picked.length, events.length - picked.filter((p) => !p.own).length);
      const nearest = [...events]
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.start.localeCompare(b.start))
        .slice(0, 5)
        .sort((a, b) => a.start.localeCompare(b.start));

      const user = await db
        .selectFrom("tenant_user")
        .select("contact_email")
        .where("tenant_id", "=", s.tenantId)
        .where("contact_email", "is not", null)
        .executeTakeFirst();
      const to = user?.contact_email;
      if (!to) {
        out.skippedEmpty++;
        continue;
      }
      const lang = await prepareMailLang(await langForTenant(s.tenantId));
      const msg = buildProgramsEmail({
        to,
        siteName: s.name ?? s.slug ?? "",
        area: (await siteOwnSettlement(s.siteId)) ?? "",
        poolCount: events.length,
        pickedCount: picked.length,
        autoCount: Math.max(0, autoCount),
        nearest,
        adminUrl: `${config.publicSiteUrl}/admin?tab=modulok&m=poi`,
        lang,
      });
      if (opts.dryRun) {
        console.log(`  → menne: ${s.name} <${to}> — ${msg.subject}`);
        out.sent++;
        continue;
      }
      await getEmailSender().send(msg);
      // ADR-0084: into the tenant's own inbox too — AND the weekly idempotency anchor.
      await logTenantMessage({
        tenantId: s.tenantId,
        channel: "email",
        kind: "programs",
        subject: msg.subject,
        bodyText: msg.text,
        recipient: to,
      });
      out.sent++;
    } catch (e) {
      out.failed++;
      console.error(`[programs-mail] tenant ${s.tenantId}: kiküldés HIBA:`, e);
    }
  }
  return out;
}
