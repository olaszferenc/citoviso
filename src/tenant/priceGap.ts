// ADR-0208 ⑥.4 — which units of a site have an INCOMPLETE price list the owner has
// not declared ("nem adok meg árat"). One reader for every screen that says so: the
// overview to-do row and the weekly reminder mail. The per-unit rule itself is
// `unitPriceStatus` (prices.ts), which the Árazás card's state line also runs —
// three surfaces, one predicate (feedback_one_rule_two_copies).

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";
import { siteRendersModule } from "./modules.js";
import { getSitePrices, unitPriceStatus } from "./prices.js";

export interface PriceGap {
  readonly unitId: string;
  readonly name: string;
  /** none = no night priced · partial = some nights priced, some not. */
  readonly status: "none" | "partial";
}

/**
 * The site's undeclared price gaps, in the owner's unit order.
 *
 * ⛔ Asks the entitlement first (`siteRendersModule`, ADR-0193): without the pricing
 * module on the page there is no price list to be incomplete, and a to-do or a mail
 * asking for prices the page cannot show would be the ADR-0194 false alarm.
 */
export async function sitePriceGaps(
  siteId: string,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<PriceGap[]> {
  if (!(await siteRendersModule(siteId, "pricing"))) return [];
  // ⛔ Read directly, not through units.ts: this module sends MAIL, and pulling units.ts
  // onto the mail path brings its Hungarian admin strings into the i18n scope (the
  // i18n-scope gate). Only the four fields the rule needs; same order as getUnits.
  const [units, prices] = await Promise.all([
    db
      .selectFrom("site_unit")
      .select(["id", "name", "seasonal_only", "price_on_request"])
      .where("site_id", "=", siteId)
      .orderBy("sort_order")
      .orderBy("created_at")
      .execute(),
    getSitePrices(siteId),
  ]);
  const out: PriceGap[] = [];
  for (const u of units) {
    const status = unitPriceStatus(
      prices.get(u.id) ?? [],
      { seasonalOnly: u.seasonal_only, priceOnRequest: u.price_on_request },
      today,
    );
    if (status === "none" || status === "partial") out.push({ unitId: u.id, name: u.name, status });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * ADR-0208 ⑥.4 — the weekly reminder (approved plan price-on-request ⑦)
 * ------------------------------------------------------------------ */

/**
 * The cadence the owner chose (2026-09-23): first mail after 7 days of an undeclared
 * gap, then weekly, with NO cap — it stops when every unit is priced or declared.
 * ⭐ Why not sooner: in the first week the owner is usually still setting up, inside
 * the admin, where the to-do row and the Árazás card already say it; and every guest
 * who asks for a quote in the meantime already mails him (ADR-0215). The reminder is
 * for the owner who does NOT open the admin — the gap ADR-0194's row cannot reach.
 */
export const GAP_REMIND_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * One pass of the hourly tick (scripts/booking-maintenance.mts):
 *   ① a live site with an undeclared gap gets `price_gap_since` (the episode starts);
 *   ② one with no gap any more gets both stamps cleared (the episode ends — a later
 *      gap starts a fresh 7-day wait instead of mailing at once);
 *   ③ a site whose episode is ≥ 7 days old, and whose last mail is ≥ 7 days old, is
 *      CLAIMED with a conditional UPDATE and mailed once.
 * `now` is a parameter so the guard can walk the calendar without sleeping.
 * `onlySiteId` narrows the pass to ONE site: the dev DB is shared by every worktree,
 * and an unnarrowed test pass would stamp — and mail — every other tenant's site.
 */
export async function maintainPriceGaps(
  now: Date = new Date(),
  opts: { readonly onlySiteId?: string } = {},
): Promise<{ started: number; ended: number; reminded: number }> {
  const today = now.toISOString().slice(0, 10);
  // Live sites, plus any site still carrying an episode (it may have gone offline or
  // lost the module since — the stamp must still be cleared).
  const sites = await db
    .selectFrom("site")
    .select(["id", "tenant_id", "status", "price_gap_since", "price_gap_reminded_at"])
    .where((eb) => eb.or([eb("status", "=", "live"), eb("price_gap_since", "is not", null)]))
    .$if(Boolean(opts.onlySiteId), (q) => q.where("id", "=", opts.onlySiteId!))
    .execute();

  let started = 0;
  let ended = 0;
  let reminded = 0;
  for (const s of sites) {
    // A suspended/deactivated site is not selling — no mail about its prices.
    const gaps = s.status === "live" ? await sitePriceGaps(s.id, today) : [];
    if (!gaps.length) {
      if (s.price_gap_since) {
        await db
          .updateTable("site")
          .set({ price_gap_since: null, price_gap_reminded_at: null })
          .where("id", "=", s.id)
          .execute();
        ended++;
      }
      continue;
    }
    if (!s.price_gap_since) {
      await db.updateTable("site").set({ price_gap_since: now }).where("id", "=", s.id).where("price_gap_since", "is", null).execute();
      started++;
      continue;
    }
    const since = new Date(s.price_gap_since);
    if (now.getTime() - since.getTime() < GAP_REMIND_DAYS * DAY_MS) continue;
    const due = new Date(now.getTime() - GAP_REMIND_DAYS * DAY_MS);
    // Claim first: two overlapping ticks send one mail, not two.
    const claim = await db
      .updateTable("site")
      .set({ price_gap_reminded_at: now })
      .where("id", "=", s.id)
      .where((eb) => eb.or([eb("price_gap_reminded_at", "is", null), eb("price_gap_reminded_at", "<=", due)]))
      .executeTakeFirst();
    if (!Number(claim.numUpdatedRows)) continue;
    try {
      await remindPriceGap(s.tenant_id, gaps, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
      reminded++;
    } catch (err) {
      console.error(`[price-gap] az emlékeztető NEM ment ki (${s.id}):`, err);
    }
  }
  return { started, ended, reminded };
}

async function remindPriceGap(tenantId: string, gaps: readonly PriceGap[], days: number): Promise<void> {
  const user = await db
    .selectFrom("tenant_user")
    .select(["contact_email"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!user?.contact_email) {
    console.warn(`[price-gap] nincs értesítési cím — az ár-hiány (${tenantId}) CSAK naplózva`);
    return;
  }
  const lang = await prepareMailLang(await langForTenant(tenantId));
  const adminUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/admin?tab=modulok&m=pricing`;
  const n = gaps.length;
  const subject =
    n === 1
      ? T(lang, "1 szobájának nincs ára — a vendég nem lát árat")
      : T(lang, "{n} szobájának nincs ára — a vendég nem lát árat", { n });
  const lines = gaps
    .map(
      (g) =>
        `• ${g.name} — ${
          g.status === "none" ? T(lang, "egyik éjszakára sincs ár") : T(lang, "az év egy részére nincs ár")
        }`,
    )
    .join("\n");
  const text =
    T(lang, "Kedves Partnerünk!") +
    "\n\n" +
    // ⛔ The days belong to the SITE's episode, not to each unit: a room added mid-episode
    // has not been unpriced for {days} days, so the sentence must not say it has.
    T(lang, "A szállása árazása {days} napja hiányos.", { days }) +
    " " +
    (n === 1
      ? T(lang, "Ennek a szobának nincs (teljes) ára a honlapján:")
      : T(lang, "Ezeknek a szobáknak nincs (teljes) ára a honlapján:")) +
    `\n\n${lines}\n\n` +
    T(lang, "A vendég ezekre nem lát árat: foglalás helyett árajánlatot kér, és Önnek minden kérésre külön kell ajánlatot küldenie.") +
    "\n\n" +
    T(lang, "Az árakat itt adhatja meg:") +
    `\n${adminUrl}\n\n` +
    T(lang, "Ha ezekre a szobákra szándékosan nem ad meg árat, mert mindig egyedi ajánlatot küld, pipálja be az Árazás lapon: „Nem adok meg alapárat”. Akkor több emlékeztetőt nem küldünk róluk.") +
    "\n\n" +
    T(lang, "Hetente emlékeztetjük, amíg minden szobának ára van, vagy be nem jelöli, hogy nem ad meg árat.") +
    "\n\n" +
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
