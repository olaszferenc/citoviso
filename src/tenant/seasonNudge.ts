// THE END-OF-SEASON QUESTION — approved plan season-year-price ② (owner, 2026-09-23).
//
// "A nudge ideje ne naptári legyen, hanem a szezon záró napja után": the owner is asked
// what next year's price should be when they have just SEEN what worked, not on some
// calendar date. So on the morning after a recurring season's last day, one mail goes
// out: the season, this year's price, and a link to next year's card on the year strip.
//
// Rules (from the hourly booking tick, scripts/booking-maintenance.mts):
//   ① once per season and year — stamp `season_nudged_year` (0073, name approved by the
//      owner), claimed with a conditional UPDATE, so two overlapping ticks send one mail;
//   ② not at all when next year already has its own price — the question is answered;
//   ③ only within NUDGE_WINDOW_DAYS of the end: a season that ended months ago (or the
//      first run after a deploy) must not dig up old questions;
//   ④ not before MORNING_UTC_HOUR — "the morning after", not a mail at 00:05.
// "Nothing to do if it stays" is said in the mail: no answer is a valid answer, the
// recurring price simply holds next year too.

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";
import { getTenantModules } from "./modules.js";
import { formatAmount } from "./prices.js";
import { seasonRule } from "./seasonRule.js";

export const NUDGE_WINDOW_DAYS = 7;
/** 06:00 UTC = 07:00/08:00 in Hungary. */
export const MORNING_UTC_HOUR = 6;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const mdNice = (md: string): string => `${md.slice(0, 2)}. ${md.slice(3, 5)}.`;
const isoNice = (iso: string): string => `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;

export interface NudgeCandidate {
  readonly id: string;
  readonly unitId: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly amount: number;
  readonly nudgedYear: number | null;
}

/**
 * The decision, without the database: does THIS season get the question today, and
 * about which years? Exported for the guard, which measures it over whole calendars.
 */
export function nudgeDue(
  s: Pick<NudgeCandidate, "from" | "to" | "nudgedYear">,
  today: string,
  nextYearPriced: (year: number) => boolean,
): { endedYear: number; endedOn: string; nextYear: number } | null {
  const nextYear = seasonRule.firstOpenYear(s.from, s.to, today);
  const endedYear = nextYear - 1;
  const ended = seasonRule.occurrence(s.from, s.to, endedYear);
  if (!(ended.end < today && ended.end >= addDays(today, -NUDGE_WINDOW_DAYS))) return null;
  if (s.nudgedYear !== null && s.nudgedYear >= endedYear) return null;
  if (nextYearPriced(nextYear)) return null;
  return { endedYear, endedOn: ended.end, nextYear };
}

/**
 * `scope.siteId` limits the sweep to one site. The guard needs it: the dev DB is shared,
 * and an unscoped test run would stamp — and mail — every other tenant's seasons.
 */
export async function maintainSeasonNudges(
  now: Date = new Date(),
  scope: { siteId?: string } = {},
): Promise<{ sent: number }> {
  if (now.getUTCHours() < MORNING_UTC_HOUR) return { sent: 0 };
  const today = now.toISOString().slice(0, 10);

  let q = db
    .selectFrom("unit_price")
    .innerJoin("site_unit", "site_unit.id", "unit_price.unit_id")
    .innerJoin("site", "site.id", "site_unit.site_id")
    .select([
      "unit_price.id as id",
      "unit_price.unit_id as unitId",
      "unit_price.label as label",
      "unit_price.date_from as from",
      "unit_price.date_to as to",
      "unit_price.amount as amount",
      "unit_price.season_nudged_year as nudgedYear",
      "site_unit.name as unitName",
      "site.id as siteId",
      "site.tenant_id as tenantId",
    ])
    .where("unit_price.date_from", "is not", null)
    .where("unit_price.date_to", "is not", null)
    .where("unit_price.valid_from", "is", null)
    .where("unit_price.parent_id", "is", null);
  if (scope.siteId) q = q.where("site.id", "=", scope.siteId);
  const seasons = await q.execute();

  let sent = 0;
  const pricingOn = new Map<string, boolean>();
  for (const s of seasons) {
    if (!s.tenantId) continue;
    const children = await db
      .selectFrom("unit_price")
      .select(["valid_from", "amount"])
      .where("parent_id", "=", s.id)
      .execute();
    const byYear = new Map(children.map((c) => [Number(String(c.valid_from).slice(0, 4)), c.amount]));
    const due = nudgeDue({ from: s.from!, to: s.to!, nudgedYear: s.nudgedYear }, today, (y) => byYear.has(y));
    if (!due) continue;
    // A tenant who no longer has the pricing module is not asked about prices.
    if (!pricingOn.has(s.tenantId)) {
      const mv = await getTenantModules(s.tenantId);
      pricingOn.set(s.tenantId, mv.modules.some((m) => m.id === "pricing" && m.active));
    }
    if (!pricingOn.get(s.tenantId)) continue;

    // Claim first (conditional UPDATE): one season × year = one mail, whatever overlaps.
    const claim = await db
      .updateTable("unit_price")
      .set({ season_nudged_year: due.endedYear })
      .where("id", "=", s.id)
      .where((eb) => eb.or([eb("season_nudged_year", "is", null), eb("season_nudged_year", "<", due.endedYear)]))
      .executeTakeFirst();
    if (!Number(claim.numUpdatedRows)) continue;
    try {
      const ok = await askOwner({
        tenantId: s.tenantId,
        siteId: s.siteId,
        seasonId: s.id,
        unitName: s.unitName,
        label: s.label ?? "",
        from: s.from!,
        to: s.to!,
        amount: byYear.get(due.endedYear) ?? s.amount,
        yesterday: due.endedOn === addDays(today, -1),
        endedOn: due.endedOn,
        nextYear: due.nextYear,
      });
      if (ok) sent++;
    } catch (err) {
      console.error(`[season-nudge] a szezon végi levél NEM ment ki (${s.id}):`, err);
    }
  }
  return { sent };
}

async function askOwner(a: {
  tenantId: string;
  siteId: string;
  seasonId: string;
  unitName: string;
  label: string;
  from: string;
  to: string;
  amount: number;
  yesterday: boolean;
  endedOn: string;
  nextYear: number;
}): Promise<boolean> {
  const user = await db
    .selectFrom("tenant_user")
    .select(["contact_email"])
    .where("tenant_id", "=", a.tenantId)
    .executeTakeFirst();
  if (!user?.contact_email) {
    console.warn(`[season-nudge] nincs értesítési cím — a szezon végi kérdés (${a.siteId}, ${a.label}) CSAK naplózva`);
    return false;
  }
  const cfg = await db
    .selectFrom("site_module_config")
    .select("config")
    .where("site_id", "=", a.siteId)
    .where("module", "=", "pricing")
    .executeTakeFirst();
  const currency = String((cfg?.config as { currency?: string } | null)?.currency ?? "HUF");
  const lang = await prepareMailLang(await langForTenant(a.tenantId));
  const next = seasonRule.occurrence(a.from, a.to, a.nextYear);
  // The year strip opens on next year's card: the admin scrolls to #ev-<season>-<year>
  // and puts the cursor in its price field.
  const adminUrl =
    `${config.publicSiteUrl.replace(/\/$/, "")}/admin?tab=modulok&m=pricing` + `#ev-${a.seasonId}-${a.nextYear}`;
  const range = `${mdNice(a.from)} – ${mdNice(a.to)}`;
  const subject = T(lang, "Véget ért: {season} — mi legyen jövőre az ára?", { season: a.label });
  const text =
    T(lang, "Kedves Partnerünk!") +
    "\n\n" +
    (a.yesterday
      ? T(lang, "Tegnap véget ért ez az időszak: {season} ({range}), {unit}.", { season: a.label, range, unit: a.unitName })
      : T(lang, "{date} véget ért ez az időszak: {season} ({range}), {unit}.", {
          date: isoNice(a.endedOn),
          season: a.label,
          range,
          unit: a.unitName,
        })) +
    " " +
    T(lang, "Idén {amount}/éj volt az ára.", { amount: formatAmount(a.amount, currency, lang) }) +
    "\n\n" +
    T(
      lang,
      "A vendégek a következő alkalomra ({next}) már foglalhatnak. Ha akkor is ennyi legyen, nem kell tennie semmit — az ár magától érvényes marad. Ha változtatna, adja meg itt:",
      { next: next.label },
    ) +
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
    tenantId: a.tenantId,
    channel: "email",
    kind: "booking",
    subject,
    bodyText: text,
    recipient: user.contact_email,
  });
  return true;
}
