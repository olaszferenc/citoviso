// Payment service (Slice 2) — orchestrates the pilot pay-link loop, gateway-agnostic:
//   requestPayment  → create a 'pending' payment + a gateway pay-link
//   handleWebhook   → gateway confirms → 'paid' → ACTIVATE (site live), or 'failed'
//   deactivate      → non-pay / cancel → site 'suspended'
//
// Activation reuses convertLead (tenant + entitlements + provisioned site snapshot)
// then flips the site to 'live'. NB: 'live' is the state-machine go-live; the actual
// public hosting (custom domain + TLS) is the deferred hosting slice — here it means
// the DB state + the existing /site/<token> snapshot. Idempotent on the gateway ref.

import { db } from "../db/client.js";
import { isMarketApproved, normalizeCountryCode } from "../markets.js";
import { convertLead } from "../conversion/provision.js";
import { ownedSiteForLead } from "../conversion/owned.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { issueAndSendTenantLogin } from "../tenant/credentials.js";
import { tenantSiteUrl } from "../domains.js";
import { config } from "../config.js";
import { getInvoiceProvider } from "../invoicing/index.js";
import { upsertPartnerFromOrder } from "../billing/partner.js";
import { activateUpsell, undeliveredUpsellModules } from "../tenant/moduleUpsell.js";
import { alertUndeliveredUpsell } from "../console/payLinkAlert.js";
import { syncEntitlementsToPaid } from "../tenant/paidEntitlements.js";
import { provisionOrderDomain } from "../domains/provisionDomain.js";
import { deliverInvoiceEmail } from "../billing/invoiceDelivery.js";
import { markMultilangPaid } from "../tenant/multilangOrder.js";
import { runMultilangGeneration } from "../tenant/multilangGenerate.js";
import { computeAnnual, computeMonthly } from "../pricing.js";
import { getGateway } from "./index.js";
import { domainFeeForRenewal, renewableModuleIds } from "./billing.js";
import { applyRenewalPaid, ensureSubscriptionForOrder, nextChargeDate } from "./subscription.js";
import { grantNewSubscriberCouponForOrder, redeemOfferForOrder } from "./offers.js";
import { startSiteShot } from "./siteShot.js";

export interface RequestPaymentResult {
  readonly paymentId: string;
  readonly payUrl: string;
  readonly gatewayRef: string;
}

/**
 * ADR-0226 + ADR-XXXX: the amount a card-verification payment takes and refunds at once.
 * ⚠️ A Barion "Reservation" paid by BANK CARD is a real charge held in OUR wallet, and
 * FinishReservation(0) is a REFUND to the card (docs: up to 30 days, bank-dependent) —
 * NOT a hold release (measured in the sandbox 2026-09-24: CardPayment + RefundToBankCard).
 * Owner ruling: keep the mechanism, keep the amount small (10 Ft, sandbox-proven end to
 * end incl. the MIT charge on the token). Every sentence about it derives from this.
 */
export const CARD_VERIFY_AMOUNT_HUF = 10;

/** Create (or reuse a still-pending) pay-link for a submitted order intent.
 *  ADR-0226 `newCard`: an UPSELL the tenant chose to pay "with another card" —
 *  the pay-link then initiates a token, and the card that pays becomes the
 *  stored mandate (the plan-bar promise; without this it would be a lie). */
export async function requestPayment(
  orderIntentId: string,
  opts: { readonly newCard?: boolean } = {},
): Promise<RequestPaymentResult | null> {
  const oi = await db
    .selectFrom("order_intent")
    .select(["id", "price", "billing_period", "kind", "buyer_country"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi || oi.price == null) return null;

  // FULFILLMENT GATE (2026-08-14): only mint a pay-link once the mock is APPROVED.
  // activate() → convertLead() hard-requires an 'approved' artifact; without this
  // guard a buyer could pay (and be invoiced) on a still-'generated' mock, then
  // activation fails silently and they get nothing. No approved mock ⇒ no pay-link:
  // the order stays recorded, the buyer sees "we'll e-mail the pay-link", and the
  // operator re-issues it after approving (idempotent via the pending-reuse path).
  //
  // SCOPE (2026-09-05, Elek FK-005b): the gate guards ONLY orders whose paid-path
  // runs convertLead (initial purchase). A post-activation order (multilang,
  // domain, upsell, renewal) fulfils against the LIVE site; judging it by the
  // prospect's — possibly since-rejected — mock blocked a translation purchase
  // on a live tenant ("payerror" with no real error).
  if (oi.kind === "initial") {
    // ALREADY-A-CUSTOMER GATE (2026-09-20, measured in dev). Re-opening the cold
    // letter after buying served the checkout again and took the money again —
    // for nothing: convertLead is idempotent, the subscription anchor does not
    // move (onConflict doNothing), the login is not re-issued. The buyer got a
    // second charge and a real invoice in exchange for zero new service.
    //
    // ⛔ THE REFUSAL BELONGS HERE, not (only) on the page. The page can be a
    // stale tab and the form can be re-submitted, so a screen that merely hides
    // the button is not a gate. No pay-link ⇒ no charge is possible.
    // A legitimate second purchase (module, translation, domain, renewal) is
    // NOT an `initial` order and never reaches this branch — it is bought from
    // the admin against the live site.
    const lead = await db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .select("prospect.lead_id as leadId")
      .where("order_intent.id", "=", orderIntentId)
      .executeTakeFirst();
    const owned = lead ? await ownedSiteForLead(lead.leadId) : null;
    if (owned) {
      console.warn(
        `[payment] requestPayment ${orderIntentId} MEGTAGADVA: a lead MÁR VÁSÁROLT ` +
          `(állapot: ${owned.stage}${owned.siteUrl ? `, oldal: ${owned.siteUrl}` : ""}) — ` +
          `initial rendelésre nem adunk pay-linket, mert a második terhelés semmit nem adna hozzá`,
      );
      return null;
    }
    const artifact = await db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .leftJoin("mock_artifact", "mock_artifact.id", "prospect.mock_artifact_id")
      .select("mock_artifact.status as status")
      .where("order_intent.id", "=", orderIntentId)
      .executeTakeFirst();
    if (artifact?.status !== "approved") {
      console.warn(
        `[payment] requestPayment ${orderIntentId} HALASZTVA: a mock artifact nem 'approved' ` +
          `(jelenlegi: ${artifact?.status ?? "nincs"}) — pay-link nem adható ki jóváhagyásig`,
      );
      return null;
    }
  }

  // ADR-0111 MARKET GATE — no pay-link into a market whose legal pack is not approved.
  //
  // Unlike the fulfilment gate above (initial orders only), this one guards every NEW
  // commitment: taking money is the moment we take on a contract under some
  // jurisdiction's consumer law, and an upsell to a foreign tenant is no less binding
  // than the first purchase. The
  // buyer's country is the right key here (the service is performed where the
  // customer is), and an unknown country counts as closed — ADR-0110 would otherwise
  // publish a Hungarian imprint, citing Hungarian statutes, in a foreign company's
  // name.
  // ⚠️ EXCEPT renewals. Closing a market must not make an EXISTING customer unable to
  // pay: their contract was concluded while the market was open, and a revocation
  // works forwards, not backwards (same principle as the ÁSZF's own rule). Blocking a
  // renewal pay-link would push a paying tenant into dunning and then freeze — our
  // decision, their damage. New commitments (initial, module, domain, upsell) are
  // gated; keeping the lights on for someone we already sold to is not.
  if (oi.kind !== "renewal" && !(await isMarketApproved(oi.buyer_country))) {
    console.warn(
      `[payment] requestPayment ${orderIntentId} MEGTAGADVA: a(z) ` +
        `${normalizeCountryCode(oi.buyer_country) ?? "ismeretlen"} piac jogi csomagja nincs ` +
        `jóváhagyva (ADR-0111) — pay-link nem adható ki`,
    );
    return null;
  }

  const gw = getGateway();

  // Reuse an outstanding pending pay-link (idempotent re-request).
  const existing = await db
    .selectFrom("payment")
    .select(["id", "pay_url", "gateway_ref"])
    .where("order_intent_id", "=", orderIntentId)
    .where("status", "=", "pending")
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (existing?.pay_url && existing.gateway_ref) {
    return { paymentId: existing.id, payUrl: existing.pay_url, gatewayRef: existing.gateway_ref };
  }

  // ADR-0080 ④: a SUBSCRIPTION checkout stores a charge token (the payer consents
  // on the gateway's own pay page), so later renewals can charge automatically.
  // One-time purchases (multilang, domain) never initiate one — nothing recurs.
  // ADR-0226: a card_update exists ONLY for the token, and an upsell paid "with
  // another card" initiates too (the new card replaces the mandate). The FACT is
  // written on the payment row — the webhook reads it from there, not from kind.
  const wantsToken =
    oi.kind === "initial" ||
    oi.kind === "renewal" ||
    oi.kind === "card_update" ||
    (oi.kind === "upsell" && !!opts.newCard);
  // A card_update on a gateway that cannot release a hold would CHARGE the
  // verification amount — refuse instead of taking money the page said we would not.
  if (oi.kind === "card_update" && !gw.finishReservation) {
    console.warn(`[payment] card_update ${orderIntentId} MEGTAGADVA: az átjáró (${gw.name}) nem tud zárolást feloldani`);
    return null;
  }

  const payment = await db
    .insertInto("payment")
    .values({
      order_intent_id: orderIntentId,
      amount: oi.price,
      currency: "HUF",
      period: oi.billing_period,
      gateway: gw.name,
      status: "pending",
      initiates_recurrence: wantsToken,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const base = process.env.PUBLIC_BASE_URL ?? "";
  const link = await gw.createPayLink({
    paymentId: payment.id,
    amount: oi.price,
    currency: "HUF",
    period: oi.billing_period,
    // ADR-0063: a one-time purchase must not read "előfizetés" on the pay screen.
    description:
      oi.kind === "multilang"
        ? "Citoviso többnyelvű honlap — egyszeri generálási díj"
        : oi.kind === "domain_settlement"
          ? "Citoviso lemondás-elszámolás (hűségidő-kötbér és díjak)"
          : oi.kind === "upsell"
            ? "Citoviso modul-bővítés — időarányos első díj"
            : oi.kind === "card_update"
              ? "Citoviso kártya-megerősítés — azonnal visszautalva"
              : `Citoviso előfizetés (${oi.billing_period === "annual" ? "éves" : "havi"})`,
    callbackUrl: `${base}/pay/webhook/${gw.name}`,
    returnUrl: `${base}/pay/done`,
    ...(wantsToken ? { initiateRecurrence: true, recurrenceId: payment.id } : {}),
    ...(oi.kind === "card_update" ? { verification: true } : {}),
  });

  await db
    .updateTable("payment")
    .set({ gateway_ref: link.gatewayRef, pay_url: link.payUrl })
    .where("id", "=", payment.id)
    .execute();

  return { paymentId: payment.id, payUrl: link.payUrl, gatewayRef: link.gatewayRef };
}

/**
 * The pay-link of this tenant's newest still-open UPSELL payment, or null.
 *
 * ⛔ Why the banner reads this from the DB instead of receiving it on the redirect:
 * in production `payUrl` points at the GATEWAY's own domain (barion.ts →
 * `secure.barion.com`), so carrying it in our query string would make the admin an
 * open redirect — anyone could hand the tenant a `/admin?...&payurl=<anywhere>`
 * link. Keyed by tenant, the destination can only ever be a link WE minted for
 * THIS tenant.
 *
 * Only `pending` qualifies: a `failed` row is the declined MIT attempt itself, and
 * a `paid` one has nothing left to collect.
 */
export async function openUpsellPayUrl(tenantId: string): Promise<string | null> {
  const row = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.pay_url as payUrl"])
    .where("order_intent.kind", "=", "upsell")
    .where("order_intent.tenant_id", "=", tenantId)
    .where("payment.status", "=", "pending")
    .orderBy("payment.created_at", "desc")
    .executeTakeFirst();
  return row?.payUrl ?? null;
}

/** Handle a gateway webhook: mark paid/failed, and on paid activate the site. */
export async function handleWebhook(
  params: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ ok: boolean; activated?: boolean; pending?: boolean }> {
  const gw = getGateway();
  const res = await gw.parseWebhook(params, headers);
  if (!res) return { ok: false };
  if (res === "pending") {
    // In-flight at the gateway: acknowledge (200) — but ONLY for a payment we
    // actually issued. An unknown id stays loud (400 → the gateway alerts us),
    // because that is exactly the "a real payment has no row here" case.
    const ref = String(params.paymentId ?? params.PaymentId ?? params.gatewayRef ?? "");
    const known = ref
      ? await db
          .selectFrom("payment")
          .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
          .select(["payment.id as id", "payment.status as status", "order_intent.kind as kind"])
          .where("payment.gateway_ref", "=", ref)
          .executeTakeFirst()
      : undefined;
    if (!known) return { ok: false };
    // ADR-0226: a card-verification payment is a RESERVATION — "in flight" here
    // means the card was authenticated and the hold stands. Release it (0) at
    // once; the gateway then reports Succeeded and the token + card get stored
    // on the re-read. No money ever moves. A release that fails is logged and
    // retried on the next callback (the hold expires by itself at the period end).
    if (known.kind === "card_update" && known.status === "pending" && gw.finishReservation) {
      const released = await gw.finishReservation(ref, 0);
      if (!released) {
        console.error(`[payment] kártya-megerősítés: a zárolás feloldása NEM sikerült (${ref}) — újrapróba a következő callbacknél`);
        return { ok: true, pending: true };
      }
      const again = await gw.parseWebhook(params, headers);
      if (again && again !== "pending") return applyWebhookResult(again);
    }
    return { ok: true, pending: true };
  }
  return applyWebhookResult(res);
}

/**
 * Apply an ALREADY-PARSED webhook result. Split out for the /pay/mock page: its
 * buttons construct the parsed shape themselves, and routing that through the
 * CONFIGURED gateway's parser silently dropped it whenever the serving process
 * ran on Barion — the buyer saw "Sikeres fizetés" while the payment stayed
 * pending and nothing activated (measured 2026-09-05, Elek FK-005a).
 */
export async function applyWebhookResult(
  res: import("./gateway.js").WebhookResult,
): Promise<{ ok: boolean; activated?: boolean; alreadySettled?: boolean }> {
  const payment = await db
    .selectFrom("payment")
    .select(["id", "order_intent_id", "status"])
    .where("gateway_ref", "=", res.gatewayRef)
    .executeTakeFirst();
  if (!payment) return { ok: false };
  // Idempotent — and SAY SO: the replayed "paid" click used to re-render the
  // "terhelés megtörtént" page on a charge that never happened (Elek FK-005b H1).
  //
  // ⛔⛔ BUT "THE MONEY ARRIVED" IS NOT "THE PURCHASE WAS DELIVERED" (ADR-0196).
  // The payment flips to 'paid' ABOVE the settlement, so everything between the
  // two can fail — and this line then answered every retry with a shrug. Measured
  // 2026-09-21: after a failed activation the buyer had paid, held nothing, and a
  // re-delivered webhook refused to try again. That is the idempotency-swallows-
  // the-failure class, and it is exactly what made atomicity alone insufficient.
  //
  // ⚠️ SCOPED TO UPSELL, out loud: that is the path that was measured. The other
  // kinds (initial / renewal / multilang) keep today's behaviour — multilang
  // already carries its own re-runnable lifecycle row, and the initial conversion
  // is idempotent end to end. A silent widening here would be a guess.
  if (payment.status === "paid") {
    const redelivered = await redeliverUpsellIfNeeded(payment.order_intent_id);
    return { ok: true, activated: redelivered, alreadySettled: true };
  }

  if (res.status === "failed") {
    await db.updateTable("payment").set({ status: "failed" }).where("id", "=", payment.id).execute();
    return { ok: true, activated: false };
  }

  await db
    .updateTable("payment")
    .set({ status: "paid", paid_at: new Date() })
    .where("id", "=", payment.id)
    .execute();
  // An UPSELL (0033) extends a tenant that is already live: no provisioning, no
  // go-live — just switch on what was bought, then re-render so the new section
  // actually appears on the page. Routing it through activate() would try to
  // convert the lead a second time.
  const kindRow = await db
    .selectFrom("order_intent")
    .select(["kind", "tenant_id"])
    .where("id", "=", payment.order_intent_id)
    .executeTakeFirst();
  // ADR-0226 CARD_UPDATE: nothing was bought — the hold is released by the
  // caller (handleWebhook) and the ONLY deliverable is the mandate: the card
  // that just authenticated becomes the stored one. No invoice: no money moved.
  if (kindRow?.kind === "card_update") {
    const stored = await storeRecurrenceTokenIfInitiated(
      payment.id,
      payment.order_intent_id,
      res.traceId ?? null,
      res.card ?? null,
    );
    return { ok: true, activated: stored };
  }
  // ADR-0088: a paid offer-priced order burns one use of its offer. Renewals
  // redeem inside applyRenewalPaid instead — that path is also reached by the
  // token charge, which never passes through this webhook.
  if (kindRow?.kind !== "renewal") {
    await redeemOfferForOrder(payment.order_intent_id);
  }
  if (kindRow?.kind === "upsell") {
    const bought = await settleUpsellPaid(payment.order_intent_id);
    // ADR-0226: an upsell paid "with another card" initiated a token — that card
    // is the mandate now (no-op when the payment did not initiate one).
    await storeRecurrenceTokenIfInitiated(payment.id, payment.order_intent_id, res.traceId ?? null, res.card ?? null);
    await backfillCardMaskIfMissing(kindRow.tenant_id, res.card ?? null);
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: bought.length > 0 };
  }
  // ADR-0063 MULTILANG: a one-time generation purchase. The webhook must answer
  // fast, and the generation translates + renders 3 languages (minutes of LLM
  // work) — so it runs detached; its lifecycle lives in multilang_generation
  // (a crash leaves 'paid'/'failed', never a silent loss, and it can be re-run).
  if (kindRow?.kind === "multilang") {
    const genId = await markMultilangPaid(payment.order_intent_id);
    if (genId) {
      runMultilangGeneration(genId)
        .then((r) =>
          r.ok
            ? console.log(`[multilang] fizetve → legenerálva: ${(r.languages ?? []).join(", ")}`)
            : console.error(`[multilang] fizetve, de a generálás HIBÁZOTT: ${r.error}`),
        )
        .catch((e) => console.error(`[multilang] generálás-futtatás HIBA:`, e));
    } else {
      console.error(
        `[multilang] fizetett order (${payment.order_intent_id}) generálási rekord nélkül — kézi beavatkozás kell`,
      );
    }
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: Boolean(genId) };
  }

  // ADR-0080 RENEWAL: a subscription cycle got paid. All state moves in one
  // place (applyRenewalPaid): period advances, a frozen site thaws, the B-opció
  // first-charge flags clear, period-end module cancellations apply. Rerender
  // when the page's sections changed (module left) or the site just came back.
  if (kindRow?.kind === "renewal") {
    const settled = await applyRenewalPaid(payment.order_intent_id);
    if (settled && (settled.unfroze || settled.removedModules.length)) {
      await rerenderTenantSnapshot(settled.tenantId, { as: "live" });
      if (settled.unfroze) console.log(`[billing] fizetés beérkezett → site visszakapcsolva · ${settled.tenantId}`);
    }
    // ADR-0080 ④: a pay-link renewal that initiated a token upgrades the
    // subscription to auto-charge from the NEXT cycle on.
    await storeRecurrenceTokenIfInitiated(payment.id, payment.order_intent_id, res.traceId ?? null, res.card ?? null);
    // ADR-0226: a MIT renewal on a pre-0076 token also reports the card — the
    // Pénztárca learns the mask of a mandate stored before masks existed.
    await backfillCardMaskIfMissing(kindRow.tenant_id, res.card ?? null);
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: !!settled };
  }

  // ADR-0071 DOMAIN_UPGRADE: a live tenant bought a custom domain after the fact.
  // The site already exists — no activation — so just invoice and fire the automated
  // beszerzés (INWX buy → Cloudflare zone/NS/TLS → flip live + 301). The FIZETÉS is
  // the trigger; no human approval. It runs detached (TLS propagation is minutes) and
  // its lifecycle lives in domain_provisioning, so a crash never loses it (re-runnable).
  if (kindRow?.kind === "domain_upgrade") {
    fireDomainProvisioning(payment.order_intent_id);
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: true };
  }

  // ADR-0094 ② DOMAIN_SETTLEMENT: the early-exit kötbér got paid. Nothing to
  // activate — the cancellation is already armed (the settlement POST did it) and
  // the billing tick closes the site at the period end. Ownership transfer is an
  // operator act gated by ÁSZF §9 (full settlement), so here: invoice + loud log.
  // Falling through to activate() would try to convert the lead a second time.
  if (kindRow?.kind === "domain_settlement") {
    const oiRow = await db
      .selectFrom("order_intent")
      .select(["settlement_take_domain", "domain_name"])
      .where("id", "=", payment.order_intent_id)
      .executeTakeFirst();
    console.log(
      `[settlement] lemondás-elszámolás KIFIZETVE · tenant ${kindRow.tenant_id} · ` +
        `webcímet ${oiRow?.settlement_take_domain ? "ELVISZI (operátor: tulajdonjog-átadás indítható a maradéktalan rendezés után, ÁSZF §9)" : "nem viszi — nálunk marad"}`,
    );
    await issueInvoiceFor(payment.id);
    return { ok: true, activated: false };
  }

  const activated = await activate(payment.order_intent_id);
  // ADR-0080: the first paid payment gives birth to the tenant's subscription
  // (anchor = paid date). Idempotent; must follow activate() because the initial
  // order reaches its tenant only through the lead the activation just converted.
  if (activated) await ensureSubscriptionForOrder(payment.order_intent_id);
  // ADR-0080 ④: AFTER the subscription is born — the token hangs off its row.
  if (activated) await storeRecurrenceTokenIfInitiated(payment.id, payment.order_intent_id, res.traceId ?? null, res.card ?? null);
  // ADR-0088 §6: the conversion just made a subscriber — grant the welcome
  // coupon for their next purchase. AFTER activate(): the tenant only exists
  // through the lead this activation converted.
  if (activated) await grantNewSubscriberCouponForOrder(payment.order_intent_id);
  await issueInvoiceFor(payment.id); // best-effort (records a 'failed' row on error)
  // ADR-0071: an 'initial' order may also carry a custom domain (domain_type=
  // citoviso_registered). Now that the site is live, register + move it in. A no-op
  // (returns null) for citoviso_sub / own orders.
  if (activated) fireDomainProvisioning(payment.order_intent_id);
  return { ok: true, activated };
}

/**
 * ADR-0080 ④: the paid checkout initiated token storage (requestPayment sets
 * InitiateRecurrence for initial/renewal orders, recurrenceId = payment.id) —
 * record the token on the tenant's subscription and flip it to auto-charge.
 * No-op when the gateway cannot charge tokens (nothing was stored to use).
 */
async function storeRecurrenceTokenIfInitiated(
  paymentId: string,
  orderIntentId: string,
  traceId: string | null,
  card: import("./gateway.js").CardInfo | null = null,
): Promise<boolean> {
  if (!getGateway().chargeRecurring) return false;
  // ADR-0226: the FACT that this pay-link asked for a token lives on the payment
  // row (0076) — kind alone no longer decides (upsell "másik kártyával", card_update).
  const pay = await db
    .selectFrom("payment")
    .select("initiates_recurrence")
    .where("id", "=", paymentId)
    .executeTakeFirst();
  if (!pay?.initiates_recurrence) return false;
  const oi = await db
    .selectFrom("order_intent")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select(["order_intent.kind as kind", "order_intent.tenant_id as tenantId", "prospect.lead_id as leadId"])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  if (!oi) return false;
  let tenantId = oi.tenantId;
  if (!tenantId && oi.leadId) {
    const t = await db
      .selectFrom("tenant")
      .select("id")
      .where("lead_id", "=", oi.leadId)
      .executeTakeFirst();
    tenantId = t?.id ?? null;
  }
  if (!tenantId) return false;
  // ADR-0226: the card being REPLACED goes to the history (the Pénztárca's
  // "Korábbi kártyák"). Only a real, different mandate counts — a replayed
  // webhook for the same payment must not write a bogus "replaced" row.
  const prev = await db
    .selectFrom("subscription")
    .select(["recurrence_token", "card_brand", "card_last4", "card_exp_month", "card_exp_year", "card_saved_at"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!prev) return false;
  if (prev.recurrence_token === paymentId) return true; // idempotent replay
  const now = new Date();
  if (prev.recurrence_token) {
    await db
      .insertInto("saved_card_history")
      .values({
        tenant_id: tenantId,
        card_brand: prev.card_brand,
        card_last4: prev.card_last4,
        card_exp_month: prev.card_exp_month,
        card_exp_year: prev.card_exp_year,
        saved_at: (prev.card_saved_at ?? now) as unknown as never,
        ended_at: now as unknown as never,
        end_reason: "replaced",
      })
      .execute();
  }
  await db
    .updateTable("subscription")
    .set({
      recurrence_token: paymentId,
      recurrence_trace_id: traceId,
      payment_method: "token",
      card_brand: card?.brand ?? null,
      card_last4: card?.last4 ?? null,
      card_exp_month: card?.expMonth ?? null,
      card_exp_year: card?.expYear ?? null,
      card_saved_at: now as unknown as never,
      updated_at: now as unknown as never,
    })
    .where("tenant_id", "=", tenantId)
    .execute();
  console.log(
    `[billing] terhelési token eltárolva → auto-terhelés a következő ciklustól · tenant ${tenantId}` +
      (card?.last4 ? ` · kártya ${card.brand ?? "?"} ····${card.last4}` : " · kártya-maszk nélkül") +
      (prev.recurrence_token ? " · a korábbi kártya az előzményekbe került" : ""),
  );
  return true;
}

/**
 * ADR-0226: a mandate stored BEFORE 0076 has a token but no mask. Every later
 * charge on it (MIT renewal/upsell via the webhook) reports the card — fill the
 * mask in once, so the Pénztárca stops saying "a részletek a következő
 * terheléskor jelennek meg". Never overwrites a mask that is already there.
 */
async function backfillCardMaskIfMissing(
  tenantId: string | null,
  card: import("./gateway.js").CardInfo | null,
): Promise<void> {
  if (!tenantId || !card?.last4) return;
  await db
    .updateTable("subscription")
    .set({
      card_brand: card.brand,
      card_last4: card.last4,
      card_exp_month: card.expMonth,
      card_exp_year: card.expYear,
    })
    .where("tenant_id", "=", tenantId)
    .where("payment_method", "=", "token")
    .where("recurrence_token", "is not", null)
    .where("card_last4", "is", null)
    .execute();
}

export type RenewalChargeOutcome = "paid" | "pending" | "failed";

/**
 * ADR-0080 ④: charge a renewal with the stored token, payer absent. 'paid'
 * settles immediately (same path as the webhook); 'pending' means the gateway
 * accepted and the CALLBACK will settle; 'failed' → the caller falls back to
 * the pay-link + dunning ladder. Never throws.
 */
export async function chargeRenewalWithToken(
  orderIntentId: string,
  recurrenceToken: string,
  traceId: string | null,
): Promise<RenewalChargeOutcome> {
  try {
    const gw = getGateway();
    if (!gw.chargeRecurring) return "failed";
    const oi = await db
      .selectFrom("order_intent")
      .select(["id", "price", "billing_period", "kind", "buyer_country"])
      .where("id", "=", orderIntentId)
      .executeTakeFirst();
    if (!oi || oi.kind !== "renewal" || oi.price == null) return "failed";

    // Crash self-heal: the cycle may ALREADY be paid with the settlement lost
    // (a crash between mark-paid and applyRenewalPaid, or a rolled-back period).
    // Charging again would be a DOUBLE CHARGE — settle the paid payment instead.
    const alreadyPaid = await db
      .selectFrom("payment")
      .select("id")
      .where("order_intent_id", "=", orderIntentId)
      .where("status", "=", "paid")
      .executeTakeFirst();
    if (alreadyPaid) {
      console.warn(`[billing] a ciklus MÁR FIZETVE (${orderIntentId}) — rendezés terhelés helyett`);
      const settled = await applyRenewalPaid(orderIntentId);
      if (settled && (settled.unfroze || settled.removedModules.length)) {
        await rerenderTenantSnapshot(settled.tenantId, { as: "live" });
      }
      return "paid";
    }

    // One outstanding charge per cycle: reuse a pending MIT payment (a callback
    // may still be in flight for it), never mint a second. A pending row older
    // than a day is STALE (a crashed Start, or a callback that never came —
    // measured: a mid-throw requestPayment leaves exactly this shape) — waiting
    // on it forever would stall BOTH the token and the dunning path, so it gets
    // closed loudly and the charge proceeds fresh.
    const existing = await db
      .selectFrom("payment")
      .select(["id", "created_at"])
      .where("order_intent_id", "=", orderIntentId)
      .where("status", "=", "pending")
      .where("pay_url", "is", null)
      .executeTakeFirst();
    if (existing) {
      const ageMs = Date.now() - new Date(existing.created_at as unknown as string).getTime();
      if (ageMs < 24 * 3600_000) return "pending";
      await db
        .updateTable("payment")
        .set({ status: "cancelled" })
        .where("id", "=", existing.id)
        .execute();
      console.warn(`[billing] elakadt MIT-payment lezárva (${existing.id}) — új terhelés indul`);
    }

    const payment = await db
      .insertInto("payment")
      .values({
        order_intent_id: orderIntentId,
        amount: oi.price,
        currency: "HUF",
        period: oi.billing_period,
        gateway: gw.name,
        status: "pending",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const base = process.env.PUBLIC_BASE_URL ?? "";
    const res = await gw.chargeRecurring({
      paymentId: payment.id,
      amount: oi.price,
      currency: "HUF",
      description: `Citoviso előfizetés megújítás (${oi.billing_period === "annual" ? "éves" : "havi"})`,
      recurrenceId: recurrenceToken,
      traceId,
      callbackUrl: `${base}/pay/webhook/${gw.name}`,
    });
    await db
      .updateTable("payment")
      .set({ gateway_ref: res.gatewayRef || null })
      .where("id", "=", payment.id)
      .execute();

    if (res.status === "failed") {
      await db.updateTable("payment").set({ status: "failed" }).where("id", "=", payment.id).execute();
      return "failed";
    }
    if (res.status === "pending") return "pending"; // the callback settles it

    // Immediate success: settle exactly as the webhook's renewal branch would.
    await db
      .updateTable("payment")
      .set({ status: "paid", paid_at: new Date() })
      .where("id", "=", payment.id)
      .execute();
    const settled = await applyRenewalPaid(orderIntentId);
    if (settled && (settled.unfroze || settled.removedModules.length)) {
      await rerenderTenantSnapshot(settled.tenantId, { as: "live" });
    }
    await issueInvoiceFor(payment.id);
    return "paid";
  } catch (err) {
    console.error(`[billing] MIT terhelés HIBA (${orderIntentId}):`, (err as Error).message);
    return "failed";
  }
}

/**
 * Everything a PAID upsell settles, in one place (ADR-0113) — reached from the
 * gateway webhook AND from the instant MIT charge below, so the two paths can
 * never drift apart.
 *
 * Order matters: the reconciliation runs BEFORE the re-render, so the published
 * page matches what was actually bought. syncEntitlementsToPaid is the same
 * billing truth as the initial activation, and for the same reason —
 * activateUpsell writes `active: true` only, so anything the tenant was holding
 * unpaid would ride along untouched.
 */
/**
 * A paid upsell that never reached the tenant's entitlements: settle it again.
 *
 * Returns true when this call actually delivered something. Never throws — a
 * webhook replay must not be turned into a gateway error by a second failure —
 * but it is never SILENT either: a purchase that stays undelivered after the
 * retry is money taken for nothing, so a human is told
 * (`feedback_auto_retry_needs_heartbeat_and_cap`: an auto-retry without a final
 * human alarm is just a quieter outage).
 */
async function redeliverUpsellIfNeeded(orderIntentId: string): Promise<boolean> {
  let missing: string[];
  try {
    missing = await undeliveredUpsellModules(orderIntentId);
  } catch (err) {
    console.error(`[upsell] kézbesítés-ellenőrzés HIBA (${orderIntentId}):`, (err as Error).message);
    return false;
  }
  if (!missing.length) return false;
  console.warn(
    `[upsell] KIFIZETVE, DE NEM KÉZBESÍTVE (${orderIntentId}): ${missing.join(", ")} — újrarendezés.`,
  );
  try {
    await settleUpsellPaid(orderIntentId);
  } catch (err) {
    await alertUndeliveredUpsell(orderIntentId, missing, (err as Error).message);
    return false;
  }
  const still = await undeliveredUpsellModules(orderIntentId).catch(() => missing);
  if (still.length) {
    await alertUndeliveredUpsell(orderIntentId, still, "az újrarendezés lefutott, de a modulok továbbra sem aktívak");
    return false;
  }
  return true;
}

export async function settleUpsellPaid(orderIntentId: string): Promise<string[]> {
  const bought = await activateUpsell(orderIntentId);
  const oi = await db
    .selectFrom("order_intent")
    .select("tenant_id")
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (oi?.tenant_id) {
    await syncEntitlementsToPaid(oi.tenant_id);
    if (bought.length) {
      // The live page renders from the snapshot, so an entitlement alone would
      // change the bill without changing the site the buyer just paid for.
      await rerenderTenantSnapshot(oi.tenant_id, { as: "live" });
    }
  }
  console.log(`[upsell] fizetve → bekapcsolt modulok: ${bought.join(", ") || "nincs"}`);
  return bought;
}

/**
 * ADR-0113 ①: charge a module first fee with the stored token, payer absent —
 * the module activates the moment the charge succeeds. 'pending' means the
 * gateway accepted and the CALLBACK settles (the webhook's upsell branch);
 * 'failed' → the caller falls back to a pay-link. Never throws.
 */
export async function chargeUpsellWithToken(
  orderIntentId: string,
  recurrenceToken: string,
  traceId: string | null,
): Promise<RenewalChargeOutcome> {
  try {
    const gw = getGateway();
    if (!gw.chargeRecurring) return "failed";
    const oi = await db
      .selectFrom("order_intent")
      .select(["id", "price", "billing_period", "kind"])
      .where("id", "=", orderIntentId)
      .executeTakeFirst();
    if (!oi || oi.kind !== "upsell" || oi.price == null) return "failed";

    // Crash self-heal: the order may ALREADY be paid with the settlement lost.
    // Charging again would be a DOUBLE CHARGE — settle the paid payment instead.
    const alreadyPaid = await db
      .selectFrom("payment")
      .select("id")
      .where("order_intent_id", "=", orderIntentId)
      .where("status", "=", "paid")
      .executeTakeFirst();
    if (alreadyPaid) {
      console.warn(`[upsell] MÁR FIZETVE (${orderIntentId}) — rendezés terhelés helyett`);
      await settleUpsellPaid(orderIntentId);
      return "paid";
    }

    // One outstanding charge per order: a pending MIT payment may still have a
    // callback in flight — never mint a second charge beside it.
    const existing = await db
      .selectFrom("payment")
      .select(["id"])
      .where("order_intent_id", "=", orderIntentId)
      .where("status", "=", "pending")
      .where("pay_url", "is", null)
      .executeTakeFirst();
    if (existing) return "pending";

    const payment = await db
      .insertInto("payment")
      .values({
        order_intent_id: orderIntentId,
        amount: oi.price,
        currency: "HUF",
        period: oi.billing_period,
        gateway: gw.name,
        status: "pending",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const base = process.env.PUBLIC_BASE_URL ?? "";
    const res = await gw.chargeRecurring({
      paymentId: payment.id,
      amount: oi.price,
      currency: "HUF",
      description: "Citoviso modul-bővítés — időarányos első díj",
      recurrenceId: recurrenceToken,
      traceId,
      callbackUrl: `${base}/pay/webhook/${gw.name}`,
    });
    await db
      .updateTable("payment")
      .set({ gateway_ref: res.gatewayRef || null })
      .where("id", "=", payment.id)
      .execute();

    if (res.status === "failed") {
      await db.updateTable("payment").set({ status: "failed" }).where("id", "=", payment.id).execute();
      return "failed";
    }
    if (res.status === "pending") return "pending"; // the callback settles it

    // Immediate success: settle exactly as the webhook's upsell branch would.
    await db
      .updateTable("payment")
      .set({ status: "paid", paid_at: new Date() })
      .where("id", "=", payment.id)
      .execute();
    await redeemOfferForOrder(orderIntentId);
    await settleUpsellPaid(orderIntentId);
    await issueInvoiceFor(payment.id);
    return "paid";
  } catch (err) {
    console.error(`[upsell] MIT terhelés HIBA (${orderIntentId}):`, (err as Error).message);
    return "failed";
  }
}

/** Fire the automated domain beszerzés detached, with logging (ADR-0071). */
function fireDomainProvisioning(orderIntentId: string): void {
  provisionOrderDomain(orderIntentId)
    .then((status) => {
      if (status === null) return; // no custom domain on this order
      if (status === "live") console.log(`[domain] beszerzés kész → ÉLES: ${orderIntentId}`);
      else if (status === "failed") console.error(`[domain] beszerzés HIBÁZOTT: ${orderIntentId}`);
      else console.log(`[domain] beszerzés folyamatban (${status}), újrafuttatás kell: ${orderIntentId}`);
    })
    .catch((e) => console.error(`[domain] beszerzés-futtatás HIBA:`, e));
}

/**
 * Issue an invoice for a paid payment via the invoice provider (mock now,
 * Számlázz.hu Számla Agent once validated). Idempotent (skips if already issued).
 *
 * ⛔ HISTORY, so this never regresses (0029): the buyer used to be FABRICATED —
 * name = lead.name (the Google Maps marketing name), address = a regex split of
 * that Maps address string, taxNumber = hardcoded null. Every company customer
 * therefore received an invoice with no adószám: unbookable as a cost, absent
 * from their NAV Online Számla account, and a guaranteed storno request. The
 * mock provider validated none of it, so the chain stayed green.
 *
 * The buyer now comes from the DECLARATION captured at checkout. If an order has
 * no declaration (a pre-0029 row) we do NOT guess: we record a 'failed' invoice
 * with a clear reason so the operator issues it by hand. A wrong invoice is
 * worse than a missing one.
 */
/**
 * Invoice line items for a paid order (ADR-0100). The custom domain's yearly
 * fee — when the order carries one — is its OWN line, never folded silently
 * into the subscription line; a 'domain_upgrade' order is a domain line only
 * (it used to mislabel as "előfizetés (éves, 0 modul)").
 */
/**
 * A számla megjegyzése — a jogi mondat, és ha volt kupon, a LEVEZETÉS.
 *
 * ⛔ EGY PÉLDÁNY, és szándékosan itt, nem a hívás helyén: ez az egyetlen hely, ahol a
 * kedvezmény úgy fér el a számlán, hogy a TÉTELEKHEZ nem nyúlunk. Külön kedvezmény-sor
 * tilos — a Számlázz.hu összeadja a tételeket, tehát egy −4 925 Ft-os sor a 14 775 Ft-os
 * végösszeget 9 850-re vinné (ADR-0205).
 */
export function invoiceComment(
  reverse: boolean,
  offerPercent: number | null | undefined,
  listPrice: number | null | undefined,
  amount: number,
): string {
  const legal = reverse
    ? "A szolgáltatás teljesítési helye a megrendelő tagállama — fordított adózás (Áfa tv. 37. §). Reverse charge."
    : "Alanyi adómentes (AAM).";
  if (!offerPercent || !listPrice || listPrice <= amount) return legal;
  return (
    `${legal} Üdvözlő kedvezmény: a ${listPrice.toLocaleString("hu-HU")} Ft-os díjból ` +
    `−${offerPercent}%, így a fizetendő ${amount.toLocaleString("hu-HU")} Ft.`
  );
}

export function buildInvoiceItems(
  p: {
    amount: number;
    kind: string;
    settlementTakeDomain: boolean | null;
    domainFee: number | null;
    domainName: string | null;
    /** ADR-0205: a kupon százaléka, ha volt — a tétel neve mondja ki. */
    offerPercent?: number | null;
  },
  cadence: "monthly" | "annual" | "once",
  periodLabel: string,
  modCount: number,
  vatKey: string,
): { name: string; quantity: number; unitNet: number; vatKey: string; net: number; vat: number; gross: number }[] {
  const line = (name: string, amount: number) => ({
    name,
    quantity: 1,
    unitNet: amount,
    vatKey,
    net: amount,
    vat: 0,
    gross: amount,
  });
  const domainLabel = `Citoviso saját domain${p.domainName ? ` (${p.domainName})` : ""} — éves díj`;
  if (p.kind === "domain_settlement")
    return [
      line(
        `Citoviso lemondás-elszámolás (hűségidő-kötbér${p.settlementTakeDomain ? " + webcím-vételár" : ""})`,
        p.amount,
      ),
    ];
  if (p.kind === "domain_upgrade") return [line(domainLabel, p.amount)];
  if (cadence === "once") return [line(`Citoviso többnyelvű honlap (egyszeri generálási díj)`, p.amount)];
  // ADR-0205: ha kupon csökkentette az árat, a TÉTEL NEVE mondja ki. ⛔ Külön
  // kedvezmény-SORT nem veszünk fel: a Számlázz.hu összeadja a tételeket, tehát egy
  // −4 925 Ft-os sor a 14 775 Ft-os végösszeget 9 850-re vinné — vagyis rosszul
  // számláznánk. A név bővítése az összegekhez nem nyúl.
  const subscriptionLine = line(
    `Citoviso előfizetés (${periodLabel}, ${modCount} modul)` +
      (p.offerPercent ? ` — ${p.offerPercent}% kedvezménnyel` : ""),
    p.amount - (p.domainFee ?? 0),
  );
  return p.domainFee && p.domainFee > 0
    ? [subscriptionLine, line(domainLabel, p.domainFee)]
    : [subscriptionLine];
}

async function issueInvoiceFor(paymentId: string): Promise<void> {
  const already = await db
    .selectFrom("invoice")
    .select("id")
    .where("payment_id", "=", paymentId)
    .where("status", "=", "issued")
    .executeTakeFirst();
  if (already) return;

  const p = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    // leftJoin: a rendelések többségéhez NINCS kupon — egy innerJoin némán eltüntetné
    // a számlát azoknál, vagyis a kedvezmény láthatóvá tétele venné el a számlát
    // mindenki mástól.
    .leftJoin("offer", "offer.id", "order_intent.offer_id")
    .select([
      "payment.amount as amount",
      "payment.currency as currency",
      "payment.period as period",
      // ADR-0063/0065: a one-time purchase must not be billed to the buyer as a
      // "havi"/"éves" subscription in the mail (billing_period is N/A there).
      "order_intent.kind as kind",
      "order_intent.modules as modules",
      "order_intent.settlement_take_domain as settlementTakeDomain",
      "order_intent.domain_fee as domainFee",
      "order_intent.domain_name as domainName",
      "order_intent.buyer_type as buyerType",
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_tax_number as taxNumber",
      "order_intent.buyer_eu_vat_number as euVatNumber",
      "order_intent.buyer_country as country",
      "order_intent.buyer_zip as zip",
      "order_intent.buyer_city as city",
      "order_intent.buyer_address as address",
      "order_intent.buyer_email as buyerEmail",
      "order_intent.vat_treatment as vatTreatment",
      // ADR-0205: a kedvezmény a SZÁMLÁN is látszik. A listaárat eddig TÁROLTUK, de
      // sosem olvastuk vissza ide, ezért a vevő egy 14 775 Ft-os végösszeget kapott
      // minden nyom nélkül arról, hogy az egy 19 700 Ft-os díj kedvezményes ára.
      "order_intent.list_price as listPrice",
      // A százalék a KUPONBÓL jön, nem a két összeg hányadosából: a kerekítés egy
      // 33 %-os kuponból „32 %"-ot csinálhatna a számlán, és egy számla nem tippelhet.
      "offer.percent as offerPercent",
      "prospect.contact_email as email",
    ])
    .where("payment.id", "=", paymentId)
    .executeTakeFirst();
  if (!p) return;

  const provider = getInvoiceProvider();

  // NO DECLARATION ⇒ NO GUESS. Pre-0029 orders (and any path that skipped the
  // checkout gate) get a recorded failure the operator can act on, never an
  // invoice built from marketing data.
  if (!p.buyerType || !p.buyerName) {
    const reason =
      "Nincs számlázási nyilatkozat az orderen (0029 előtti rendelés) — a számlát kézzel kell kiállítani; " +
      "vevő-adatot a lead marketing-nevéből SOSEM fabrikálunk.";
    await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        vat_key: "AAM",
        vat_rate: 0,
        net: p.amount,
        gross: p.amount,
        currency: p.currency,
        status: "failed",
        error: reason,
      })
      .execute();
    console.error(`[invoice] KIHAGYVA (${paymentId}): ${reason}`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  // Cadence for the buyer-facing mail; 'multilang' and the ADR-0094 settlement
  // are one-time fees, not a period.
  const cadence: "monthly" | "annual" | "once" =
    p.kind === "multilang" || p.kind === "domain_settlement"
      ? "once"
      : p.period === "annual"
        ? "annual"
        : "monthly";
  // ⚠️ The INVOICE LINE below stays Hungarian on purpose: it is the text of a
  // LEGAL document issued by a Hungarian provider (Számlázz.hu). Legal wording is
  // a per-country LEGAL pack question (§B.18), not UI translation — the buyer's
  // covering E-MAIL is what ADR-0067 localizes.
  const periodLabel = cadence === "once" ? "egyszeri" : cadence === "annual" ? "éves" : "havi";
  const modCount = ((p.modules as unknown as string[]) ?? []).length;
  // Reverse charge (Áfa tv. 37. §) is decided at order time against a VIES-verified
  // VAT number; everything else is AAM. The DB constraint guarantees the pairing.
  const reverse = p.vatTreatment === "reverse_charge";
  const vatKey = reverse ? "TAM" : "AAM";
  const input = {
    buyer: {
      name: p.buyerName,
      // Billing address wins over the outreach contact — that is the whole point.
      email: p.buyerEmail ?? p.email,
      zip: p.zip,
      city: p.city,
      address: p.address,
      taxNumber: p.taxNumber,
      euVatNumber: p.euVatNumber,
      country: p.country,
    },
    items: buildInvoiceItems(p, cadence, periodLabel, modCount, vatKey),
    currency: p.currency,
    issueDate: today,
    fulfillmentDate: today,
    dueDate: today,
    paymentMethod: "Bankkártya",
    paid: true,
    comment: invoiceComment(reverse, p.offerPercent, p.listPrice, p.amount),
  };

  try {
    const res = await provider.issueInvoice(input);
    const issued = await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        invoice_number: res.invoiceNumber,
        vat_key: vatKey,
        vat_rate: 0,
        net: res.net || p.amount,
        gross: res.gross || p.amount,
        currency: p.currency,
        status: "issued",
        // 0030: keep the document itself, so there is a bizonylat to show the
        // buyer, hand to the accountant and attach to a bank reconciliation.
        pdf_base64: res.pdfBase64 ?? null,
        fulfillment_date: today,
        due_date: today,
        vat_treatment: reverse ? "reverse_charge" : "aam",
      })
      // ADR-0084: the id anchors the tenant's message log entry to this bizonylat,
      // so the Üzenetek row can link straight to it on the Dokumentumok tab.
      .returning("id")
      .executeTakeFirstOrThrow();
    console.log(
      `[invoice] kiállítva ${res.invoiceNumber} (${provider.name}) · ${p.amount} ${p.currency}`,
    );
    // DELIVERY. Separate from issuance and deliberately AFTER the insert: the
    // bizonylat is the thing that must survive, so a mail outage may never lose
    // it. Runs once per payment because this whole function returns early when
    // an 'issued' invoice already exists.
    await deliverInvoiceEmail({
      paymentId,
      invoiceId: issued.id,
      invoiceNumber: res.invoiceNumber,
      gross: res.gross || p.amount,
      currency: p.currency,
      period: cadence,
      pdfBase64: res.pdfBase64 ?? null,
      buyerName: p.buyerName,
      buyerIsPerson: p.buyerType === "individual",
      buyerEmail: p.buyerEmail ?? p.email,
    });
  } catch (e) {
    await db
      .insertInto("invoice")
      .values({
        payment_id: paymentId,
        provider: provider.name,
        vat_key: "AAM",
        vat_rate: 0,
        net: p.amount,
        gross: p.amount,
        currency: p.currency,
        status: "failed",
        error: (e as Error).message,
      })
      .execute();
    console.error(`[invoice] hiba: ${(e as Error).message}`);
  }
}

/** Paid → provision (convertLead) + flip the site to public 'live' + advance lead. */
async function activate(orderIntentId: string): Promise<boolean> {
  const oi = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "order_intent.modules as modules",
      "order_intent.photo_rights_declared_at as photoRightsAt",
      "order_intent.domain_type as domainType",
      "order_intent.domain_name as domainName",
      "prospect.lead_id as leadId",
      "prospect.mock_artifact_id as artifactId",
      "prospect.contact_email as contactEmail",
      // The credentials letter greets the buyer by name (a person only).
      "order_intent.buyer_name as buyerName",
      "order_intent.buyer_type as buyerType",
      // ADR-0111: the market gate below needs the buyer's jurisdiction.
      "order_intent.buyer_country as buyerCountry",
    ])
    .where("order_intent.id", "=", orderIntentId)
    .executeTakeFirst();
  // The ONLY refusal here that used to be silent. Every other `return false`
  // below logs; this one just vanished — the buyer paid, saw "we are finalising
  // your site", and nobody knew. A paid activation that stops must always say so.
  if (!oi || !oi.artifactId) {
    console.error(
      `[payment] activate ${orderIntentId} MEGTAGADVA: ` +
        (oi
          ? "a prospecthez nincs mock artifact kötve — kurátori rendezés kell"
          : "nincs ilyen order_intent (vagy nincs prospectje)") +
        " — a vevő FIZETETT, de nem lesz élő oldala",
    );
    return false;
  }
  // §A recheck at the go-live edge (guard finding, 2026-08-01): an order without
  // the stamped photo-rights declaration (e.g. a pre-0015 row) must NOT
  // auto-activate — it stays paid+provisioned for the operator to resolve.
  if (!oi.photoRightsAt) {
    console.error(
      `[payment] activate ${orderIntentId} MEGTAGADVA: nincs §A fotó-jog nyilatkozat az orderen — kurátori rendezésig nem élesíthető`,
    );
    return false;
  }
  const modules = (oi.modules as unknown as string[]) ?? [];
  // ADR-0032: honor the buyer's freely-chosen platform subdomain (only for the platform-sub
  // option; a custom domain is handled by the domain fields). The label part before the first
  // dot is the slug; uniqueSiteSlug re-checks it's clean+free at provision time.
  const preferredSlug =
    oi.domainType === "citoviso_sub" && oi.domainName ? String(oi.domainName).split(".")[0] : null;
  try {
    // convertLead requires an APPROVED artifact — activation implies the operator
    // approved the mock. It provisions tenant + entitlements + private snapshot.
    const conv = await convertLead(oi.leadId, oi.artifactId, modules, preferredSlug);
    // §A go-live edge: a legacy HTML-copy artifact cannot pass the per-photo live
    // policy (no structured photos to filter) — it stays paid+provisioned for the
    // operator to resolve, same as a missing declaration.
    if (conv.renderSource === "copy") {
      console.error(
        `[payment] activate ${orderIntentId} MEGTAGADVA: legacy (HTML-másolat) artifact — a §A fotó-policy nem alkalmazható, kurátori élesítés kell`,
      );
      return false;
    }
    // BILLING TRUTH, and it must run BEFORE the live render. convertLead only ever
    // turns entitlements ON, so an operator's pre-payment ALL-IN preview (ADR-0014)
    // survived this paid activation and the snapshot below would publish modules
    // nobody bought — measured 2026-08-26: ten of them on one live tenant. The
    // order matters because moduleContentFor() reads entitlements when rendering.
    await syncEntitlementsToPaid(conv.tenantId);
    // §A go-live edge, in this order: render the PUBLIC snapshot FIRST (photo policy
    // drops places/streetview/watermarked imagery; the preview noindex is replaced),
    // and flip the site live only if that render succeeded — a failed render must
    // never leave a live site serving the demo-photo snapshot.
    // ADR-0111 MARKET GATE at the go-live edge. This is the strictest of the three,
    // because going live is what PUBLISHES legal pages: since ADR-0110 every live site
    // carries an imprint and a privacy notice built from Hungarian statutes. Serving
    // those in an Austrian company's name would be worse than having no legal page at
    // all — a confidently wrong legal document. The site stays paid+provisioned (the
    // customer keeps their preview and their money's worth) and an operator resolves it.
    if (!(await isMarketApproved(oi.buyerCountry))) {
      console.error(
        `[payment] activate ${orderIntentId} MEGTAGADVA: a(z) ` +
          `${normalizeCountryCode(oi.buyerCountry) ?? "ismeretlen"} piac jogi csomagja nincs ` +
          `jóváhagyva (ADR-0111) — a site provisioned marad, a vevő FIZETETT: ` +
          `kurátori rendezés kell (piac jóváhagyása vagy visszatérítés)`,
      );
      return false;
    }
    const rendered = await rerenderTenantSnapshot(conv.tenantId, { as: "live" });
    if (!rendered) {
      console.error(
        `[payment] activate ${orderIntentId} MEGTAGADVA: a §A-policys live render nem sikerült — a site provisioned marad, kurátori rendezés kell`,
      );
      return false;
    }
    await db
      .updateTable("site")
      .set({ status: "live", live_at: new Date() })
      .where("tenant_id", "=", conv.tenantId)
      .execute();
    // ④ ① — build the confirmation's site screenshot NOW, while the buyer is still
    // on the gateway. Fire-and-forget by contract: the page never waits for it, and
    // a failed shot simply falls through to the cover photo. This is the only place
    // where the snapshot is known-fresh AND we have time to spare.
    startSiteShot(conv.tenantId);
    await db
      .updateTable("lead")
      .set({ lifecycle_status: "activation" })
      .where("id", "=", oi.leadId)
      .where("lifecycle_status", "in", [
        "qualified",
        "mock_curation",
        "outreach",
        "conversion",
        "subscription",
      ])
      .execute();

    // PARTNER REGISTRY (0032): the paid order becomes an accounting counterparty
    // here, because this is the first point where a LEGAL name + tax number exist
    // (the 0029 declaration). The buyer's billing e-mail addresses land as
    // partner_contact rows, which is where invoices and notices are addressed
    // from. Best-effort and idempotent: a registry hiccup must not un-do a paid
    // activation, and a re-delivered webhook must not mint a second partner.
    try {
      const p = await upsertPartnerFromOrder(orderIntentId, conv.tenantId);
      if (p) {
        console.log(
          `[payment] partner ${p.created ? "létrehozva" : "frissítve"} · ${p.partnerId} · ` +
            `számlázási címzettek: ${p.billingEmails.join(", ") || "nincs"}`,
        );
      } else {
        console.warn(
          `[payment] activate ${orderIntentId}: nincs jogi név az orderen (pre-0029?) — partner NEM jött létre, operátori rendezés kell`,
        );
      }
    } catch (err) {
      console.error(`[payment] partner-rögzítés hiba (${orderIntentId}):`, err);
    }

    // OWNER ACCESS (the last A–Z step): issue the tenant login and e-mail the
    // credentials, so the buyer can sign in and edit their text/photos right after
    // paying. Idempotent per tenant (issueTenantLogin keeps one owner user).
    // Best-effort: a mail/credential failure must never un-do a paid activation —
    // the operator can re-issue from the console.
    try {
      const existingLogin = await db
        .selectFrom("tenant_user")
        .select("id")
        .where("tenant_id", "=", conv.tenantId)
        .executeTakeFirst();
      if (!existingLogin && oi.contactEmail) {
        const tenantRow = await db
          .selectFrom("tenant")
          .select("display_name")
          .where("id", "=", conv.tenantId)
          .executeTakeFirst();
        const login = await issueAndSendTenantLogin(
          conv.tenantId,
          tenantRow?.display_name ?? "oldalam",
          oi.contactEmail,
          { name: oi.buyerName, isPerson: oi.buyerType === "individual" },
        );
        console.log(
          `[payment] tenant-belépés kiadva · ${login.username} → ${login.contactEmail}`,
        );
      } else if (!existingLogin) {
        console.warn(
          `[payment] activate ${orderIntentId}: nincs contact_email a prospecten — a tenant-belépést az operátornak kell kiadnia`,
        );
      }
    } catch (e) {
      console.error(
        `[payment] tenant-belépés kiadása SIKERTELEN (a site él, kézzel pótolandó): ${(e as Error).message}`,
      );
    }
    return true;
  } catch (e) {
    console.error(`[payment] activate ${orderIntentId} hiba: ${(e as Error).message}`);
    return false;
  }
}

/** What the buyer needs right after paying: where their site lives and how to get in. */
export interface ActivationSummary {
  readonly businessName: string;
  /**
   * The tenant this activation produced.
   *
   * ⛔ NOT the same as `order_intent.tenant_id`: for a FIRST purchase that column
   * is NULL, because the tenant is born during activation and is found through the
   * lead. Measured 2026-09-20 on the confirmation page's site preview — keying it
   * off the order would have blanked the preview for exactly the new customers it
   * was built for, while working fine for upsells.
   */
  readonly tenantId: string | null;
  /** Public URL of the live site (<slug>.citoviso.com), or null if not live yet. */
  readonly siteUrl: string | null;
  /** Login username (the credentials mail carries the password). */
  readonly username: string | null;
  /** Where the credentials were sent. */
  readonly contactEmail: string | null;
  /**
   * Charged amount (HUF) — the buyer must see WHAT was taken on the result page
   * itself, not first in the invoice mail (Elek FK-005a HIBA, 2026-09-05).
   */
  readonly amount: number | null;
  /**
   * The STANDING obligation the buyer just took on (checkout-fullscreen ⑪).
   *
   * Measured defect: the confirmation acknowledged the 74 925 Ft charge and said
   * nothing about the next one — that it comes automatically, WHEN, or that it is
   * 99 900 Ft because the discount was one-off (+33%). A buyer who only reads this
   * screen would learn about the renewal from their bank statement.
   *
   * Computed the way billing.ts actually mints the renewal (list price over the
   * renewable modules + the never-discounted domain fee for the cycle), so this is
   * the real figure, not an estimate. Null when no subscription exists yet.
   */
  readonly renewal: {
    /** ISO date (YYYY-MM-DD) of the current period's end = the next charge. */
    readonly date: string;
    readonly amount: number;
    readonly period: "monthly" | "annual";
  } | null;
}

/**
 * What the NEXT charge will be, computed exactly as billing.ts mints it
 * (mintRenewalOrder: list price over the renewable modules + the domain fee for
 * the cycle). ⛔ Deliberately not a simplified copy: a confirmation that promises
 * one number while the timer charges another is the defect, not the cure.
 *
 * Best-effort — a failure here must never break the confirmation screen, so it
 * returns null and the page falls back to wording that promises no figure.
 */
async function renewalPreview(tenantId: string): Promise<ActivationSummary["renewal"]> {
  try {
    const sub = await db
      .selectFrom("subscription")
      .select(["billing_period", "pending_period"])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    // The DATE the buyer was promised at checkout comes from ONE definition
    // (ADR-0080 ①) — the same one the configurator reads before the money moves,
    // so the two screens cannot drift (Elek FK-005a H-1).
    const date = await nextChargeDate(tenantId);
    if (!sub || !date) return null;
    const period = (sub.pending_period ?? sub.billing_period) as "monthly" | "annual";
    const months = period === "annual" ? 12 : 1;
    const moduleIds = await renewableModuleIds(tenantId);
    const listPrice = period === "annual" ? computeAnnual(moduleIds) : computeMonthly(moduleIds);
    const domain = await domainFeeForRenewal(tenantId, months);
    return {
      date,
      amount: listPrice + (domain?.fee ?? 0),
      period,
    };
  } catch (e) {
    console.error(`[payment] megújulás-előnézet hiba (${tenantId}): ${(e as Error).message}`);
    return null;
  }
}

/**
 * Post-payment summary for the buyer's confirmation screen, resolved from the
 * gateway reference. Read-only; returns nulls rather than throwing, so the
 * confirmation page always renders.
 */
export async function getActivationSummary(gatewayRef: string): Promise<ActivationSummary | null> {
  const row = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .leftJoin("tenant", "tenant.lead_id", "lead.id")
    .leftJoin("site", "site.tenant_id", "tenant.id")
    .leftJoin("tenant_user", "tenant_user.tenant_id", "tenant.id")
    .select([
      "lead.name as businessName",
      "site.slug as slug",
      "site.status as siteStatus",
      "site.custom_domain as customDomain",
      "tenant_user.username as username",
      "tenant_user.contact_email as tenantEmail",
      "prospect.contact_email as prospectEmail",
      "payment.amount as amount",
      "tenant.id as tenantId",
    ])
    .where("payment.gateway_ref", "=", gatewayRef)
    .executeTakeFirst();
  if (!row) return null;
  return {
    renewal: row.tenantId ? await renewalPreview(row.tenantId) : null,
    businessName: row.businessName,
    tenantId: row.tenantId ?? null,
    siteUrl:
      row.siteStatus === "live"
        ? tenantSiteUrl(config.publicSiteUrl, row.slug, row.customDomain)
        : null,
    username: row.username ?? null,
    contactEmail: row.tenantEmail ?? row.prospectEmail ?? null,
    amount: row.amount ?? null,
  };
}

// The old lead-keyed deactivate() is gone (ADR-0080): non-payment now walks the
// notified dunning ladder in billing.ts (freeze at T+10, cancel at T+30), and the
// state transitions live in subscription.ts — a silent suspend has no caller left.
