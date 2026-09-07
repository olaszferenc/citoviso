// A tenant forgalmi kimutatásának ADATA (ADR-0108, jóváhagyott terv:
// assets/design-refs/tenant-admin/traffic/).
//
// A képernyő egyetlen kérdésre válaszol — „megérte-e?" —, ezért ez a modul nem
// „metrikákat" ad, hanem pontosan azokat a számokat, amiket a kontraktus kimond.
//
// ⛔ HÁROM SZABÁLY, MERT MINDHÁROM AZT DÖNTI EL, IGAZ-E, AMIT A VEVŐNEK MUTATUNK:
//   1. BOT SOHA. Minden lekérdezés `is_bot = false`-ra szűr. Egy crawler nem vendég;
//      ha benne van a számban, hamis állítást mutatunk egy fizető ügyfélnek (§B.17).
//   2. NINCS ARÁNY MINTA NÉLKÜL. A „minden N. látogatóból lesz megkeresés" mondat
//      csak akkor születik meg, ha VAN megkeresés — nullánál kimarad, nem „minden
//      ∞."-t írunk (a hiányzó-adat ág nem lehet csendes átengedés).
//   3. NINCS HOSZT-MONDAT SAJÁT DOMAIN NÉLKÜL. Ha a tenantnak nincs egyedi domainje,
//      a bontás kimarad — nem „0"-t írunk ki olyasmiről, amije nincs.

import { sql } from "kysely";
import { db } from "../db/client.js";

export interface TrafficReport {
  /** Hány NAPRA szól (30 vagy 7) — a felirat ebből jön. */
  readonly days: number;
  /** Egyedi látogató (napi lenyomat szerint), botok nélkül. */
  readonly visitors: number;
  /** Oldal-megnyitás (nyers megtekintés), botok nélkül. */
  readonly views: number;
  /**
   * Megkeresés az időszakban — a mondat második kiemelt száma.
   *
   * ⚠️ ELTÉRÉS A JÓVÁHAGYOTT TERVTŐL, mérésből: a terv két külön sort kért
   * („Foglalási kérés" és „Üzenet / érdeklődés"), de a rendszerben NINCS két
   * tároló. A gerinc érdeklődés-CTA (`enquiry`, domType: "booking") és a
   * foglalás-modul UGYANABBA a `booking_request` táblába ír, megkülönböztető mező
   * nélkül. Két sorra bontva az egyik mindig 0 lenne — az pedig nem részletesebb,
   * hanem hamis. Ezért EGY sor van, amíg a tárolás nem különbözteti meg őket.
   */
  readonly contacts: number;
  /** A Google-ből érkezett megnyitások aránya (0–100), null ha nincs mintánk. */
  readonly fromGooglePct: number | null;
  /** Telefonon nézők aránya (0–100), null ha nincs mintánk. */
  readonly mobilePct: number | null;
  /**
   * Hoszt-bontás — CSAK ha a tenantnak van saját domainje (különben null).
   * A tenant ebből látja, megérte-e a saját cím.
   */
  readonly hostSplit: { readonly domain: string; readonly custom: number; readonly slug: number } | null;
  /** „Minden N. látogatóból lesz megkeresés" — null, ha nincs megkeresés. */
  readonly visitorsPerContact: number | null;
  /**
   * Igaz, ha a képernyőnek az ÜRES állapotot kell mutatnia.
   *
   * A megnyitáshoz kötve, NEM a megkereséshez: mérve előfordul, hogy 0 megnyitás
   * mellett van megkeresés (régebbi kérés, vagy a mérés indulása előttről). Ilyenkor
   * a „0 vendég nézte meg az oldalát, és 7 kereste meg Önt" mondat önmagának
   * mondana ellent — az üres állapot az őszintébb.
   */
  readonly isEmpty: boolean;
}

/** Az időszak kezdete: N nappal ezelőtt, a nap elejétől. */
function since(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getTrafficReport(tenantId: string, days = 30): Promise<TrafficReport> {
  const from = since(days);

  // Egy körben minden látogatás-alapú szám — a botok itt esnek ki, egy helyen.
  const v = await db
    .selectFrom("site_visit")
    .select([
      db.fn.countAll().as("views"),
      sql<number>`count(distinct visitor_hash)`.as("visitors"),
      sql<number>`count(*) filter (where referrer = 'google.com')`.as("google"),
      sql<number>`count(*) filter (where device = 'mobile')`.as("mobile"),
      sql<number>`count(*) filter (where host_kind = 'custom')`.as("custom"),
      sql<number>`count(*) filter (where host_kind = 'slug')`.as("slug"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("is_bot", "=", false)
    .where(sql<boolean>`occurred_at >= ${from}`)
    .executeTakeFirstOrThrow();

  const views = Number(v.views);
  const visitors = Number(v.visitors);

  // A booking_request a SITE-hoz kötődik, nem a tenanthoz — join a site-on át.
  const booking = await db
    .selectFrom("booking_request")
    .innerJoin("site", "site.id", "booking_request.site_id")
    .select(db.fn.countAll().as("n"))
    .where("site.tenant_id", "=", tenantId)
    .where(sql<boolean>`booking_request.created_at >= ${from}`)
    .executeTakeFirst();

  const contacts = Number(booking?.n ?? 0);

  const site = await db
    .selectFrom("site")
    .select(["custom_domain as customDomain"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  return {
    days,
    visitors,
    views,
    contacts,
    // Arány CSAK mintával — 0 megnyitásból nem osztunk.
    fromGooglePct: views > 0 ? Math.round((Number(v.google) / views) * 100) : null,
    mobilePct: views > 0 ? Math.round((Number(v.mobile) / views) * 100) : null,
    hostSplit: site?.customDomain
      ? { domain: site.customDomain, custom: Number(v.custom), slug: Number(v.slug) }
      : null,
    // A megújításkor ez az egyetlen mondat, ami tényleg érvel — de csak akkor
    // mondható ki, ha VAN megkeresés (2. szabály).
    visitorsPerContact: contacts > 0 && visitors > 0 ? Math.round(visitors / contacts) : null,
    isEmpty: views === 0,
  };
}
