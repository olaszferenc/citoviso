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
//   4. CSAK AZ IGAZ IDŐSZAKRÓL, ÉS CSAK HA AZ OLDAL MÁR ÉLT BENNE (ADR-0385). A jelentés
//      a megelőző 30 napot méri, ezért a levél a DÁTUMTARTOMÁNYT nevezi meg, nem egy
//      naptári hónapot (2026-10-14: a 13-án indult próbázó „szeptemberi forgalom" levelet
//      kapott csupa október 13-i adattal). Az oldalnak legalább TRAFFIC_MAIL_MIN_LIVE_DAYS
//      napja élnie kell — addig a 30 napos ablak nagyobb része olyan idő, amikor az oldal
//      nem is létezett. A futtató naponta fut, így a még fiatal oldal a küszöb napján
//      megkapja az első levelét (nem kell a következő hónapig várnia).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { APP_TZ, budapestParts } from "../text/budapestTime.js";
import { config } from "../config.js";
import { getEmailSender } from "../email/sender.js";
import { buildTrafficEmail } from "../email/trafficEmail.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { getTrafficReport, since } from "./trafficReport.js";

export interface TrafficMailResult {
  readonly sent: number;
  readonly skippedEmpty: number;
  readonly skippedAlready: number;
  /** 4. szabály: az oldal még nem élt elég régóta. */
  readonly skippedYoung: number;
  readonly failed: number;
}

/** The report window (days) — the same 30 days the Forgalom tab shows by default. */
export const TRAFFIC_WINDOW_DAYS = 30;

/**
 * Minimum days a site must have been live before its first traffic mail (ADR-0385):
 * 21 of the 30 days = the window is mostly real data, and the first mail still lands
 * within the owner's first month instead of waiting for the next calendar month.
 */
export const TRAFFIC_MAIL_MIN_LIVE_DAYS = 21;

/** „szeptember 14." — a nap a címzett nyelvén, BUDAPEST szerinti naptár (ADR-0289). */
export function dayLabel(d: Date, lang: string): string {
  try {
    return d.toLocaleDateString(lang, { month: "long", day: "numeric", timeZone: APP_TZ });
  } catch {
    const p = budapestParts(d);
    return `${p.month}.${p.day}.`;
  }
}

/** Is the site old enough for a traffic mail? `liveSince` null = no live stamp → never. */
export function trafficMailEligible(liveSince: Date | null, now: Date): boolean {
  return liveSince !== null && now.getTime() - liveSince.getTime() >= TRAFFIC_MAIL_MIN_LIVE_DAYS * 86_400_000;
}

/**
 * „szeptember 14. – október 14." — the period the numbers really cover: from the report's
 * day start (Budapest midnight, 30 days back) or the site's go-live day, whichever is later,
 * up to today (the report has no upper bound, so today's visits so far are in it).
 */
export function trafficPeriodLabel(liveSince: Date | null, now: Date, lang: string): string {
  const windowStart = since(TRAFFIC_WINDOW_DAYS, now);
  const from = liveSince && liveSince.getTime() > windowStart.getTime() ? liveSince : windowStart;
  return `${dayLabel(from, lang)} – ${dayLabel(now, lang)}`;
}

/**
 * Egy körben minden élő tenantnak. `now` injektálható, hogy a hónapforduló tesztelhető
 * legyen. A jelentés a MEGELŐZŐ 30 napról szól — nem naptári hónapról, mert a mérés
 * indulása óta eltelt idő tenantonként más, és a 30 nap mindig értelmezhető. A levél
 * ezért a dátumtartományt írja ki (4. szabály), nem hónapnevet.
 */
export async function sendMonthlyTrafficMails(now = new Date()): Promise<TrafficMailResult> {
  const out = { sent: 0, skippedEmpty: 0, skippedAlready: 0, skippedYoung: 0, failed: 0 };

  const tenants = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select([
      "site.tenant_id as tenantId",
      "site.slug as slug",
      "tenant.display_name as name",
      // A site without a live stamp (legacy) counts from its provisioning.
      sql<Date | null>`coalesce(site.live_at, site.provisioned_at)`.as("liveSince"),
    ])
    .where("site.status", "=", "live")
    .execute();

  for (const t of tenants) {
    try {
      const liveSince = t.liveSince ? new Date(t.liveSince) : null;
      // 4. szabály: a fiatal oldalnak még nincs 30 napja, amiről beszámolhatnánk.
      if (!trafficMailEligible(liveSince, now)) {
        out.skippedYoung++;
        continue;
      }

      // 2. szabály: ebben a hónapban ment már ki?
      const already = await db
        .selectFrom("tenant_message")
        .select("id")
        .where("tenant_id", "=", t.tenantId)
        .where("kind", "=", "traffic")
        // The month starts at Budapest midnight (ADR-0289) — not in the DB session's zone.
        .where(
          sql<boolean>`sent_at >= (date_trunc('month', ${now}::timestamptz AT TIME ZONE ${sql.lit(APP_TZ)}) AT TIME ZONE ${sql.lit(APP_TZ)})`,
        )
        .executeTakeFirst();
      if (already) {
        out.skippedAlready++;
        continue;
      }

      const report = await getTrafficReport(t.tenantId, TRAFFIC_WINDOW_DAYS);
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
        periodLabel: trafficPeriodLabel(liveSince, now, lang),
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
