// WHAT an invoice covers — the one register that names the billed item.
//
// WHY THIS FILE EXISTS (Elek FK-001, measured 2026-09-12): the tenant's
// „Dokumentumok" list showed 18 near-identical rows — number, date, amount,
// „Kifizetve · AAM" — and not one word about WHAT was bought. Measured in the
// dev park those 18 rows were in fact TWO different products (11 × annual
// subscription at 99 900 Ft, 7 × one-off multilingual generation at 14 900 Ft),
// and nothing on screen said so.
//
// ⛔ The item name is DERIVED from the order, never typed next to the row
// (feedback_label_must_derive_from_predicate): `order_intent.kind` +
// `billing_period` are the columns the money itself is built from, so a row can
// not name a product it was not billed for. The same key drives:
//   • the invoice row in the tenant admin (src/server/adminViews.ts)
//   • the subject of the covering invoice mail (src/email/invoiceEmail.ts)
// Before this, the mail subject said „Citoviso előfizetés" for EVERY invoice —
// including the 14 900 Ft one-off multilingual fee, which is not a subscription
// at all (§B.17: the screen may not state something untrue).
//
// The KEY is stable and language-free; the LABEL is localized here because this
// file is on the i18n doctrine's list (scripts/i18n-sources.mjs) — the label may
// not be duplicated into the view and the mail, or the two will drift.

import { T } from "../i18n/mail.js";

/** Stable identity of the billed item. Never stored — derived from the order. */
export type InvoiceItemKey =
  | "subscription"
  | "subscription_renewal"
  | "multilang"
  | "module_upsell"
  | "domain_upgrade"
  | "domain_settlement";

/** Billing cadence of the item, when the item HAS one. */
export type InvoiceItemPeriod = "annual" | "monthly" | "once";

/**
 * The item behind one invoice, from the order that produced it.
 *
 * `orderKind` is `order_intent.kind` (schema: initial | upsell | multilang |
 * domain_upgrade | renewal | domain_settlement). An unknown value falls back to
 * the subscription key rather than throwing: a document list must still render
 * if a future order kind ships before this register learns it — but the guard
 * (scripts/admin-list-labels-check.mts) asserts the mapping stays total.
 */
export function invoiceItemKey(orderKind: string): InvoiceItemKey {
  switch (orderKind) {
    case "renewal":
      return "subscription_renewal";
    case "multilang":
      return "multilang";
    case "upsell":
      return "module_upsell";
    case "domain_upgrade":
      return "domain_upgrade";
    case "domain_settlement":
      return "domain_settlement";
    default:
      return "subscription";
  }
}

/** Every key this register knows — the guard iterates it, so it can not rot. */
export const INVOICE_ITEM_KEYS: readonly InvoiceItemKey[] = [
  "subscription",
  "subscription_renewal",
  "multilang",
  "module_upsell",
  "domain_upgrade",
  "domain_settlement",
];

/**
 * Does this item recur? A one-off purchase must never read „előfizetés"
 * (ADR-0063) — the cadence belongs to the subscription keys only.
 */
export function invoiceItemPeriod(
  key: InvoiceItemKey,
  billingPeriod: string | null,
): InvoiceItemPeriod {
  if (key !== "subscription" && key !== "subscription_renewal") return "once";
  return billingPeriod === "annual" ? "annual" : "monthly";
}

/**
 * The customer-facing name of the item, in the reader's language.
 *
 * Formal address (magázódás) and no brand prefix: the tenant is inside their own
 * Citoviso admin, so „Citoviso előfizetés" would repeat the obvious and push the
 * distinguishing word off a 390px row.
 */
export function invoiceItemLabel(
  key: InvoiceItemKey,
  period: InvoiceItemPeriod,
  lang = "hu",
): string {
  const cadence = period === "annual" ? T(lang, "éves") : T(lang, "havi");
  switch (key) {
    case "subscription":
      return T(lang, "Honlap-előfizetés ({period})", { period: cadence });
    case "subscription_renewal":
      return T(lang, "Előfizetés megújítása ({period})", { period: cadence });
    case "multilang":
      return T(lang, "Többnyelvű honlap — egyszeri generálási díj");
    case "module_upsell":
      return T(lang, "Modul-bővítés — időarányos első díj");
    case "domain_upgrade":
      return T(lang, "Saját webcím");
    case "domain_settlement":
      return T(lang, "Lemondás-elszámolás");
  }
}

/** Convenience: order columns → the finished label, in one call. */
export function invoiceItemNameOf(
  orderKind: string,
  billingPeriod: string | null,
  lang = "hu",
): string {
  const key = invoiceItemKey(orderKind);
  return invoiceItemLabel(key, invoiceItemPeriod(key, billingPeriod), lang);
}
