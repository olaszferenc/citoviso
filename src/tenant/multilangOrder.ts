// ADR-0063 — the multilang purchase: order creation on the PROVEN order_intent →
// payment chain (0033 doctrine: never a parallel payment path). One purchase =
// one order_intent (kind='multilang') + one multilang_generation row; the webhook
// flips the generation to 'paid' and runs it.

import { db } from "../db/client.js";
import { MULTILANG_LANG_COUNT } from "../modules.js";
import { getOneTimePrice, loadPricing } from "../pricing.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { effectiveSiteForMultilang } from "./editor.js";
import { multilangContentHash } from "./multilangCore.js";
import { normalizeTargetLangs } from "./multilangGenerate.js";

export interface MultilangOrderResult {
  readonly ok: boolean;
  readonly orderId?: string;
  readonly error?: string;
}

/**
 * Create the paid order for a 3-language generation. Validates the language set
 * (exactly MULTILANG_LANG_COUNT supported codes, primary excluded — tulaj-döntés:
 * fix 3 nyelv egy áron) and records the CURRENT content hash: the buyer pays for
 * the state they see saved now (the admin told them to save everything first).
 * A language SWAP is the same purchase with a different set (ADR-0063 §3).
 */
export async function createMultilangOrder(
  tenantId: string,
  requestedLangs: readonly string[],
): Promise<MultilangOrderResult> {
  const site = await effectiveSiteForMultilang(tenantId);
  if (!site) return { ok: false, error: "a site még nem renderelhető" };
  const primaryLang = site.effective.lang ?? DEFAULT_LANG;
  const langs = normalizeTargetLangs(requestedLangs, primaryLang);
  if (langs.length !== MULTILANG_LANG_COUNT) {
    return { ok: false, error: `pontosan ${MULTILANG_LANG_COUNT} nyelvet kell választani` };
  }

  await loadPricing();
  const price = getOneTimePrice("multilang");
  if (price <= 0) return { ok: false, error: "a modul ára nincs beállítva" };

  const prospect = await db
    .selectFrom("prospect")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select("prospect.id as id")
    .where("tenant.id", "=", tenantId)
    .executeTakeFirst();
  if (!prospect) return { ok: false, error: "nincs kapcsolódó megrendelés-lánc" };

  // ⛔ BILLING IDENTITY, inherited (measured defect, 2026-08-28): the first
  // multilang order carried NO buyer fields, so issueInvoiceFor hit the 0029 gate
  // ("nincs számlázási nyilatkozat az orderen") and recorded a FAILED invoice —
  // the tenant paid 14 900 Ft and got no bizonylat. The buyer is the SAME legal
  // person who declared themselves at checkout, so the declaration is inherited
  // from their initial order rather than re-asked or (worse) fabricated.
  const buyer = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
    .select([
      "order_intent.buyer_type as buyerType",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_tax_number as taxNumber",
      "order_intent.buyer_eu_vat_number as euVat",
      "order_intent.buyer_country as country",
      "order_intent.buyer_zip as zip",
      "order_intent.buyer_city as city",
      "order_intent.buyer_address as address",
      "order_intent.buyer_email as email",
      "order_intent.vat_treatment as vatTreatment",
      "order_intent.buyer_vies_status as viesStatus",
      "order_intent.buyer_vies_name as viesName",
      "order_intent.billing_emails as billingEmails",
    ])
    .where("tenant.id", "=", tenantId)
    .where("order_intent.buyer_name", "is not", null)
    .orderBy("order_intent.submitted_at", "desc")
    .executeTakeFirst();
  // FAIL CLOSED: no declared buyer ⇒ no pay-link. Taking money we cannot invoice
  // is worse than refusing the sale (0029 doctrine).
  if (!buyer?.buyerName) {
    return {
      ok: false,
      error:
        "hiányzik a számlázási azonosság a korábbi megrendelésről — számla nélkül nem indítunk fizetést, kérjük vegye fel velünk a kapcsolatot",
    };
  }

  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      kind: "multilang",
      tenant_id: tenantId,
      modules: JSON.stringify(["multilang"]),
      price,
      billing_period: "monthly", // N/A for a one-time fee; the column is NOT NULL
      status: "submitted",
      submitted_at: new Date(),
      buyer_type: buyer.buyerType,
      buyer_name: buyer.buyerName,
      buyer_tax_number: buyer.taxNumber,
      buyer_eu_vat_number: buyer.euVat,
      buyer_country: buyer.country,
      buyer_zip: buyer.zip,
      buyer_city: buyer.city,
      buyer_address: buyer.address,
      buyer_email: buyer.email,
      vat_treatment: buyer.vatTreatment,
      buyer_vies_status: buyer.viesStatus,
      buyer_vies_name: buyer.viesName,
      billing_emails: buyer.billingEmails,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("multilang_generation")
    .values({
      site_id: site.site.id,
      tenant_id: tenantId,
      order_intent_id: order.id,
      languages: langs,
      content_hash: multilangContentHash(site.effective, site.units, site.site.recipe),
      status: "pending_payment",
    })
    .execute();

  return { ok: true, orderId: order.id };
}

/** Payment cleared for a multilang order: flip the generation to 'paid' and hand
 *  back its id so the caller can run it. Idempotent via the status guard. */
export async function markMultilangPaid(orderIntentId: string): Promise<string | null> {
  const gen = await db
    .selectFrom("multilang_generation")
    .select(["id", "status"])
    .where("order_intent_id", "=", orderIntentId)
    .executeTakeFirst();
  if (!gen) return null;
  if (gen.status !== "pending_payment") return gen.status === "paid" ? gen.id : null;
  await db
    .updateTable("multilang_generation")
    .set({ status: "paid" })
    .where("id", "=", gen.id)
    .execute();
  return gen.id;
}
