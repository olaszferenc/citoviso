// DATED PRICES OVER TIME — approved plan booking-offer ⑥ (tulaj, 2026-09-23).
//
// A price the owner set on the offer page WITH an end date promises two things on
// screen: "a lejárat előtt emlékeztetjük", and — implicitly — that the page stops
// quoting it once it has ended. Both are kept here, from the hourly booking tick
// (scripts/booking-maintenance.mts):
//
//   ① REMIND once, REMIND_DAYS before the last day (stamp: expiry_notified_at).
//   ② When the window has closed, the row is REMOVED and the tenant's page is
//      re-rendered. The snapshot is static: without the re-render the price table
//      would keep showing a price no night can be charged at any more (§B.17).
//
// ⭐ Why 14 days: the booking widget sells up to 12 months ahead, so the gap the
// lapse opens is already bookable when the reminder arrives — the owner needs time
// to decide next season's price, but a reminder a month early is forgotten by the
// day it matters. One mail per window, never repeated (the stamp), so it cannot
// become noise.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";
import { formatAmount } from "./prices.js";

export const REMIND_DAYS = 14;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function niceIso(iso: string): string {
  return `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
}

export async function maintainDatedPrices(
  today: string = new Date().toISOString().slice(0, 10),
): Promise<{ reminded: number; expired: number }> {
  // ① Reminders — the window ends within REMIND_DAYS and nobody was told yet.
  const due = await db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select([
      "unit_price.id as id",
      "unit_price.amount as amount",
      "unit_price.valid_to as validTo",
      "site_unit.name as unitName",
      "site.tenant_id as tenantId",
      "site.id as siteId",
    ])
    .where("unit_price.valid_to", "is not", null)
    // 0073 (owner, 2026-09-23): a YEAR price of a season ("Főszezon 2027") gets no
    // "lejár egy ár" mail — when it ends, the recurring season price takes over, so no
    // night is left unpriced and the mail's promise ("a vendég nem lát árat") would be
    // false. Next year's price is asked by the end-of-season question instead.
    .where("unit_price.date_from", "is", null)
    .where("unit_price.expiry_notified_at", "is", null)
    .where("unit_price.valid_to", ">=", today)
    .where("unit_price.valid_to", "<=", addDays(today, REMIND_DAYS))
    .execute();

  let reminded = 0;
  for (const r of due) {
    // Claim first (conditional UPDATE): two overlapping ticks send one mail, not two.
    const claim = await db
      .updateTable("unit_price")
      .set({ expiry_notified_at: new Date() })
      .where("id", "=", r.id)
      .where("expiry_notified_at", "is", null)
      .executeTakeFirst();
    if (!Number(claim.numUpdatedRows)) continue;
    try {
      await remindOwner(r.tenantId, r.siteId, r.unitName, r.amount, r.validTo!);
      reminded++;
    } catch (err) {
      console.error(`[price-expiry] az emlékeztető NEM ment ki (${r.id}):`, err);
    }
  }

  // ② Lapsed windows — remove, then re-render each touched tenant once.
  const lapsed = await db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select(["unit_price.id as id", "site.tenant_id as tenantId"])
    .where("unit_price.valid_to", "is not", null)
    .where("unit_price.valid_to", "<", today)
    .execute();
  const tenants = new Set<string>();
  for (const r of lapsed) {
    await db.deleteFrom("unit_price").where("id", "=", r.id).execute();
    if (r.tenantId) tenants.add(r.tenantId);
  }
  if (tenants.size) {
    const { rerenderTenantSnapshot } = await import("./editor.js");
    for (const t of tenants) {
      try {
        await rerenderTenantSnapshot(t);
      } catch (err) {
        console.error(`[price-expiry] az oldal újrarenderelése nem sikerült (${t}):`, err);
      }
    }
  }
  return { reminded, expired: lapsed.length };
}

async function remindOwner(
  tenantId: string,
  siteId: string,
  unitName: string,
  amount: number,
  validTo: string,
): Promise<void> {
  const user = await db
    .selectFrom("tenant_user")
    .select(["contact_email"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!user?.contact_email) {
    console.warn(`[price-expiry] nincs értesítési cím — a lejáró ár (${siteId}, ${unitName}) CSAK naplózva`);
    return;
  }
  const cfg = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", siteId)
    .where("module", "=", "pricing")
    .executeTakeFirst();
  const currency = String((cfg?.config as { currency?: string } | null)?.currency ?? "HUF");
  const lang = await prepareMailLang(await langForTenant(tenantId));
  const adminUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/admin?tab=modulok&m=pricing`;
  const subject = T(lang, "Hamarosan lejár egy ár: {unit}", { unit: unitName });
  const text =
    T(lang, "Kedves Partnerünk!") +
    "\n\n" +
    T(
      lang,
      "Ez az ár {date} után lejár: {unit}, {amount}/éj. Utána azokra az éjszakákra, amelyekre nincs időszaki ár, a vendég nem lát árat, és árajánlatot kér.",
      { unit: unitName, amount: formatAmount(amount, currency, lang), date: niceIso(validTo) },
    ) +
    "\n\n" +
    T(lang, "Ha az ár a következő időszakra is érvényes, adja meg újra a Modulok fülön, az „Árak, szezonok” modulnál:") +
    `\n${adminUrl}\n\n` +
    T(lang, "Üdvözlettel,") +
    "\nCitoviso";
  await getEmailSender().send({
    to: user.contact_email,
    // Our own service notice to the tenant, no guest data → pilot BCC applies.
    audience: "platform",
    subject,
    text,
  });
  await logTenantMessage({
    tenantId,
    channel: "email",
    kind: "booking",
    subject,
    bodyText: text,
    recipient: user.contact_email,
  });
}
