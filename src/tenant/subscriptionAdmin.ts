// Subscription data + actions for the tenant admin (ADR-0080, approved B plan).
// The view card needs: renewal day, current fee, the NEXT invoice (total + items),
// payment-state banners (past_due/frozen with the open pay-link), and the
// whole-subscription cancel/resume pair (danger zone).

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
import { getAnnualFreeMonths, getBaseMonthly, getModulePrice, loadPricing } from "../pricing.js";
import { addMonths } from "../payment/subscription.js";
import { DUNNING_CANCEL_OFFSET_DAYS } from "../payment/billing.js";
import { bestActiveCouponForTenant } from "../payment/offers.js";
import { isBilledModule, type TenantModuleView } from "./modules.js";

export interface NextInvoiceItem {
  readonly label: string;
  readonly price: number;
  /** ADR-0080 ②: appears on this invoice for the first time. */
  readonly isNew: boolean;
}

export interface SubscriptionAdminData {
  readonly status: "active" | "past_due" | "frozen" | "cancelled";
  /** ISO date of the next renewal (current period end). */
  readonly periodEnd: string;
  /** Day-of-month of the anchor (the tenant's renewal day). */
  readonly renewDay: number;
  readonly nextInvoiceTotal: number;
  readonly nextInvoiceItems: NextInvoiceItem[];
  /** The open (pending) renewal payment's pay-link, for the banner button. */
  readonly payUrl: string | null;
  // ── The DEBT. Measured 2026-09-11: while frozen, the screen showed only
  // forward-looking figures ("Következő számla"), so the owner could not learn
  // what to pay from the page that told them to pay. The arrears are the price
  // of the cycle being dunned — the renewal order minted for current_period_end.
  readonly arrears: {
    readonly amount: number;
    readonly periodStart: string;
    readonly periodEnd: string;
  } | null;
  /** T+30: the day the unpaid cycle closes for good (ADR-0080 ⑤) — the deadline
   *  the frozen screen owes the owner. */
  readonly closesOn: string;
  /** ISO date the freeze took effect — "since when can my guests not reach me". */
  readonly frozenOn: string | null;
  /** ISO date a freeze was last LIFTED by payment (0063), while it is still
   *  recent news. NULL once the return has been acknowledged long enough — a
   *  permanent "you are back" banner would be its own kind of noise. */
  readonly restoredOn: string | null;
  /**
   * WHICH cycle the owner just paid for, and the document that proves it.
   *
   * WHY (Elek FK-006b ZAVAROS-1/2): a zöld „újra elérhető" sáv kimondta, hogy a díj
   * rendezve, és hogy a számlát elküldtük — de soha nem mondta meg, MELY IDŐSZAK van
   * ezzel kifizetve, és úgy hivatkozott a bizonylatra, hogy nem vezetett el hozzá.
   * „A tulaj a visszakapcsolás után nem tudja megmondani, meddig van rendezve a
   * szolgáltatása."
   *
   * ⛔ MÉRVE, HOGY AZ `arrears` ERRE NEM JÓ: az csak `past_due`/`frozen` állapotban él
   * (lásd az `owes` kaput lentebb), a sáv viszont pont akkor jelenik meg, amikor a fiók
   * MÁR ÚJRA AKTÍV — ott mindig `null` volna. A kifizetett ciklus ilyenkor maga a FOLYÓ
   * időszak: a fizetés a `current_period_start/end`-et a kifizetett rendelés időszakára
   * állítja (`src/payment/subscription.ts`).
   *
   * ⚠️ §B.17: minden mező csak akkor áll benne, ha MEGTALÁLTUK. Számla nélkül nincs
   * `invoiceId` — a felület nem ígérhet linket, amit nem tud megnyitni.
   */
  readonly settled: {
    readonly periodStart: string;
    readonly periodEnd: string;
    /** A bizonylat bruttója; `null`, ha a számla még nem áll rendelkezésre. */
    readonly amount: number | null;
    readonly invoiceId: string | null;
    readonly invoiceNumber: string | null;
  } | null;
  /** Whole-subscription cancellation armed — closes at periodEnd. */
  readonly cancelAtPeriodEnd: boolean;
  // ── ADR-0088 §8: monthly→annual switch (approved B plan) ──
  readonly billingPeriod: "monthly" | "annual";
  /** The switch is armed and not yet applied by a paid annual renewal. */
  readonly pendingAnnual: boolean;
  /** ISO date the armed switch takes effect: periodEnd — or one cycle later
   *  when the upcoming renewal was already minted at the monthly price. */
  readonly pendingEffectiveDate: string | null;
  /** Annual totals for the CURRENT module set (12 months at 10 monthly fees). */
  readonly annualTotal: number;
  readonly annualSavings: number;
  readonly annualFreeMonths: number;
  // ── ADR-0088 ⑨: recurring-card mandate (ADR-0080 ④ made the charge, this
  // makes it VISIBLE and revocable — a stored credential the customer cannot
  // see or cancel is the "silent gate" failure). ──
  /** A usable stored mandate exists → the fordulónap charges automatically. */
  readonly autoCharge: boolean;
  /** ADR-XXXX: the stored card named for the plan bar ("Visa ····4242");
   *  null without a mandate — or on a pre-0076 token whose mask is unknown yet. */
  readonly cardLabel: string | null;
  /** The tenant's live welcome/campaign coupon for their NEXT purchase. */
  readonly coupon: { readonly percent: number; readonly expiresAt: string | null } | null;
}

/** How long the "your site is back" confirmation stays on the screen (0063).
 *  Three days (owner ruling, 2026-09-12 — the first cut was a week): long enough
 *  that an owner who paid and closed the tab still sees it next time they log in,
 *  short enough that it does not become furniture. */
const RESTORE_NOTICE_DAYS = 3;

function recentRestore(restoredAt: unknown): string | null {
  if (!restoredAt) return null;
  const d = new Date(restoredAt as string);
  if (Number.isNaN(d.getTime())) return null;
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  return ageDays <= RESTORE_NOTICE_DAYS ? isoDate(d) : null;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** NULL when the tenant has no subscription yet (site not paid/live). */
export async function getSubscriptionAdmin(
  tenantId: string,
  mv: TenantModuleView,
): Promise<SubscriptionAdminData | null> {
  const sub = await db
    .selectFrom("subscription")
    .select([
      "id",
      "status",
      "anchor_date",
      // A KIFIZETETT időszak kezdete (a `settled` mezőhöz): fizetéskor a rendelés
      // időszakára áll át, tehát a folyó időszak MAGA a most kifizetett ciklus.
      "current_period_start",
      "current_period_end",
      "cancel_at_period_end",
      "billing_period",
      "pending_period",
      "payment_method",
      "recurrence_token",
      "card_brand",
      "card_last4",
      "restored_at",
      "frozen_at",
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!sub) return null;
  await loadPricing();

  // The next invoice = base + every module that will still be subscribed at the
  // renewal: active, not leaving at the period end, monthly-billed, not replaced.
  const items: NextInvoiceItem[] = mv.modules
    .filter(isBilledModule)
    .map((m) => ({
      label: m.label,
      price: getModulePrice(m.id),
      isNew: m.awaitingFirstCharge,
    }));
  const total = items.reduce((s, i) => s + i.price, getBaseMonthly());

  // The open pay-link of the CURRENT cycle's renewal order, if the ladder already
  // minted one — the banner's "Díj rendezése" button target.
  const openPay = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.pay_url as payUrl"])
    .where("order_intent.kind", "=", "renewal")
    .where("order_intent.tenant_id", "=", tenantId)
    .where("payment.status", "=", "pending")
    .orderBy("payment.created_at", "desc")
    .executeTakeFirst();

  // The renewal order of the cycle being dunned is keyed by its period start —
  // the SAME key findOrCreateRenewalOrder uses, so the figure on screen is the
  // figure the ladder is collecting, not a recomputed look-alike.
  const dunned = await db
    .selectFrom("order_intent")
    .select(["price", "renewal_period_start as ps", "renewal_period_end as pe"])
    .where("kind", "=", "renewal")
    .where("tenant_id", "=", tenantId)
    .where("renewal_period_start", "=", sub.current_period_end)
    .executeTakeFirst();
  // Only OWED while the ladder is actually running: an 'active' subscription has
  // nothing outstanding even though last cycle's order row still exists.
  const owes = sub.status === "past_due" || sub.status === "frozen";
  const arrears =
    owes && dunned?.price
      ? {
          amount: dunned.price,
          periodStart: isoDate(new Date(dunned.ps as unknown as string)),
          periodEnd: isoDate(new Date(dunned.pe as unknown as string)),
        }
      : null;

  // ── MELY IDŐSZAK VAN KIFIZETVE, ÉS HOL A BIZONYLAT (Elek FK-006b ZAVAROS-1/2) ──
  // Csak akkor kérdezzük meg, ha a visszakapcsolás FRISS hír — különben egy fölösleges
  // lekérdezés futna minden admin-lapon.
  const restoredOn = recentRestore(sub.restored_at);
  let settled: SubscriptionAdminData["settled"] = null;
  if (restoredOn) {
    // A kifizetett ciklus MAGA a folyó időszak: a fizetés a current_period_start/end-et
    // a kifizetett rendelés időszakára állítja (src/payment/subscription.ts).
    const periodStart = isoDate(new Date(sub.current_period_start as unknown as string));
    const periodEnd = isoDate(new Date(sub.current_period_end as unknown as string));
    // A bizonylat UGYANAZON a kulcson: a rendelés időszak-kezdete. Sztornózott számlát
    // nem ajánlunk fel — az nem bizonyítja a kifizetést.
    const doc = await db
      .selectFrom("invoice")
      .innerJoin("payment", "payment.id", "invoice.payment_id")
      .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
      .select(["invoice.id as id", "invoice.invoice_number as no", "invoice.gross as gross"])
      .where("order_intent.tenant_id", "=", tenantId)
      .where("order_intent.kind", "=", "renewal")
      .where("order_intent.renewal_period_start", "=", sub.current_period_start)
      .where("invoice.status", "=", "issued")
      .orderBy("invoice.issued_at", "desc")
      .executeTakeFirst();
    settled = {
      periodStart,
      periodEnd,
      // ⚠️ §B.17: az ÖSSZEG a bizonylatról jön, nem a rendelés árából „valószínűsítve".
      // Bizonylat nélkül nincs szám és nincs link — a sáv ilyenkor csak az időszakot mondja.
      amount: doc?.gross ?? null,
      invoiceId: doc?.id ?? null,
      invoiceNumber: doc?.no ?? null,
    };
  }

  // ADR-0088 §8: the armed switch's HONEST effective date. When the upcoming
  // renewal was already minted at the monthly price (the timer runs days ahead
  // of the due date), the switch lands one cycle later — the card must say the
  // date that is actually true, not the nearest one.
  const periodEndDate = new Date(sub.current_period_end as unknown as string);
  const pendingAnnual = sub.pending_period === "annual";
  let pendingEffectiveDate: string | null = null;
  if (pendingAnnual) {
    const mintedMonthly = await db
      .selectFrom("order_intent")
      .select("id")
      .where("kind", "=", "renewal")
      .where("tenant_id", "=", tenantId)
      .where("renewal_period_start", "=", sub.current_period_end)
      .where("billing_period", "=", "monthly")
      .executeTakeFirst();
    pendingEffectiveDate = isoDate(mintedMonthly ? addMonths(periodEndDate, 1) : periodEndDate);
  }
  const freeMonths = getAnnualFreeMonths();
  // ADR-0088 ⑨: a mandate counts only with a token we could actually charge —
  // 'token' without one would advertise an automation that silently falls back.
  const autoCharge = sub.payment_method === "token" && !!sub.recurrence_token;
  const coupon = await bestActiveCouponForTenant(tenantId);

  return {
    status: sub.status,
    periodEnd: isoDate(periodEndDate),
    renewDay: new Date(sub.anchor_date as unknown as string).getDate(),
    nextInvoiceTotal: total,
    nextInvoiceItems: items,
    payUrl: openPay?.payUrl ?? null,
    arrears,
    closesOn: isoDate(addDays(periodEndDate, DUNNING_CANCEL_OFFSET_DAYS)),
    frozenOn: sub.frozen_at ? isoDate(new Date(sub.frozen_at as unknown as string)) : null,
    restoredOn,
    settled,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    billingPeriod: sub.billing_period,
    pendingAnnual,
    pendingEffectiveDate,
    annualTotal: total * (12 - freeMonths),
    annualSavings: total * freeMonths,
    annualFreeMonths: freeMonths,
    autoCharge,
    cardLabel: autoCharge && sub.card_last4 ? `${sub.card_brand ?? ""} ····${sub.card_last4}`.trim() : null,
    coupon: coupon
      ? {
          percent: coupon.percent,
          expiresAt: coupon.expiresAt ? isoDate(coupon.expiresAt) : null,
        }
      : null,
  };
}

/** Arm / disarm the whole-subscription cancellation (takes effect at period end). */
export async function setSubscriptionCancel(
  tenantId: string,
  cancel: boolean,
): Promise<void> {
  await db
    .updateTable("subscription")
    .set({
      cancel_at_period_end: cancel,
      cancelled_at: cancel ? new Date() : null,
      updated_at: new Date() as unknown as never,
    })
    .where("tenant_id", "=", tenantId)
    .execute();
  console.log(`[subscription] tenant ${tenantId}: lemondás ${cancel ? "ÉLESÍTVE" : "visszavonva"}`);
}
