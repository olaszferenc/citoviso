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
