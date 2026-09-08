// Havi forgalmi levél kiküldése (ADR-0108).
//
// A tenant a fordulónapon mérlegel — ez a levél viszi oda a választ magától.
//
// ⛔ HÁROM SZABÁLY, MERT MINDHÁROM AZT DÖNTI EL, KAP-E A VEVŐ HASZNOS VAGY KÁROS LEVELET:
//   1. ÜRES HÓNAPRÓL NEM KÜLDÜNK. A „0 vendég nézte meg" levél nem tájékoztat, csak
//      elkedvetlenít — és pont akkor érkezne, amikor a tulaj amúgy is a lemondáson
//      gondolkodik. Hallgatni itt őszintébb, mint statisztikát mímelni.
//   2. HAVONTA EGYSZER. Az idempotenciát a tenant_message napló adja (ADR-0084): ha az
//      adott hónapra már van 'traffic' bejegyzés, nem küldünk újat. Így a futtató
//      újraindítható, és egy kimaradt nap sem eredményez dupla levelet.
//   3. EGY TENANT HIBÁJA NEM ÁLLÍTJA MEG A TÖBBIT. Minden címzett külön try/catch —
//      egy rossz e-mail cím nem viheti el az egész havi kört.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getEmailSender } from "../email/sender.js";
import { buildTrafficEmail } from "../email/trafficEmail.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { getTrafficReport } from "./trafficReport.js";

export interface TrafficMailResult {
  readonly sent: number;
  readonly skippedEmpty: number;
  readonly skippedAlready: number;
  readonly failed: number;
}

/** „augusztus" — a lezárt hónap neve a címzett nyelvén. */
function monthLabel(d: Date, lang: string): string {
  try {
    return d.toLocaleDateString(lang, { month: "long" });
  } catch {
    return String(d.getMonth() + 1);
  }
}

/**
 * Egy körben minden élő tenantnak. `now` injektálható, hogy a hónapforduló tesztelhető
 * legyen. A jelentés a MEGELŐZŐ 30 napról szól — nem naptári hónapról, mert a mérés
 * indulása óta eltelt idő tenantonként más, és a 30 nap mindig értelmezhető.
 */
export async function sendMonthlyTrafficMails(now = new Date()): Promise<TrafficMailResult> {
  const out = { sent: 0, skippedEmpty: 0, skippedAlready: 0, failed: 0 };

  const tenants = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["site.tenant_id as tenantId", "site.slug as slug", "tenant.display_name as name"])
    .where("site.status", "=", "live")
    .execute();

  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);

  for (const t of tenants) {
    try {
      // 2. szabály: ebben a hónapban ment már ki?
      const already = await db
        .selectFrom("tenant_message")
        .select("id")
        .where("tenant_id", "=", t.tenantId)
        .where("kind", "=", "traffic")
        .where(sql<boolean>`sent_at >= date_trunc('month', ${now}::timestamptz)`)
        .executeTakeFirst();
      if (already) {
        out.skippedAlready++;
        continue;
      }

      const report = await getTrafficReport(t.tenantId, 30);
      // 1. szabály: üres hónapról hallgatunk.
      if (report.isEmpty) {
        out.skippedEmpty++;
        continue;
      }

      const user = await db
        .selectFrom("tenant_user")
        .select(["contact_email"])
        .where("tenant_id", "=", t.tenantId)
        .where("contact_email", "is not", null)
        .executeTakeFirst();
      const to = user?.contact_email;
      if (!to) {
        out.skippedEmpty++;
        continue;
      }

      const lang = await prepareMailLang(await langForTenant(t.tenantId));
      const msg = buildTrafficEmail({
        to,
        siteName: t.name ?? t.slug ?? "",
        periodLabel: monthLabel(periodStart, lang),
        report,
        adminUrl: `${config.publicSiteUrl}/admin?tab=forgalom`,
        lang,
      });
      await getEmailSender().send(msg);
      // ADR-0084: ugyanaz a levél a tenant saját postafiókjába — ez EGYBEN az
      // idempotencia-horgony is, tehát a naplózás nem opcionális dísz.
      await logTenantMessage({
        tenantId: t.tenantId,
        channel: "email",
        kind: "traffic",
        subject: msg.subject,
        bodyText: msg.text,
        recipient: to,
      });
      out.sent++;
    } catch (e) {
      out.failed++;
      console.error(`[traffic-mail] tenant ${t.tenantId}: kiküldés HIBA:`, e);
    }
  }
  return out;
}
