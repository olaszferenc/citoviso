// Mock payment gateway (Slice 2) — runs the full pay-link loop locally with no
// account/keys. createPayLink points the payer at the console's /pay/mock/<ref>
// page (Fizetek / Elutasítom buttons), which posts to /pay/webhook/mock — exactly
// the shape the real Barion webhook will drive. Swap for the Barion adapter via
// PAYMENT_GATEWAY=barion once keys exist; the service + DB layer stay unchanged.

import type {
  CardInfo,
  PaymentGateway,
  PaymentRequest,
  PayLink,
  RecurringChargeRequest,
  RecurringChargeResult,
  WebhookResult,
} from "./gateway.js";

/**
 * ADR-0226: the mock gateway's two test cards — the pay page offers them on a
 * token-initiating payment. Shapes mirror what Barion's FundingInformation
 * reports (brand as the scheme names it, last 4, expiry).
 */
export const MOCK_CARDS: readonly { readonly id: string; readonly card: CardInfo }[] = [
  { id: "visa4242", card: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028 } },
  { id: "mc8810", card: { brand: "MasterCard", last4: "8810", expMonth: 3, expYear: 2029 } },
];

export function mockCard(id: string): CardInfo | null {
  return MOCK_CARDS.find((c) => c.id === id)?.card ?? null;
}

export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  async createPayLink(req: PaymentRequest): Promise<PayLink> {
    // The mock ref is just our own payment id — deterministic, easy to trace.
    const gatewayRef = `mock_${req.paymentId}`;
    // ABSOLUTE URL on purpose: the /pay/mock page lives on the CONSOLE process,
    // but the pay redirect can start from the tenant admin (public :4800) — a
    // relative link 404s there (measured: the multilang/upsell pay buttons).
    // PUBLIC_BASE_URL proxies to the console (the same base Barion callbacks use).
    const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    return { gatewayRef, payUrl: `${base}/pay/mock/${gatewayRef}` };
  }

  async parseWebhook(params: Record<string, unknown>): Promise<WebhookResult | null> {
    if (typeof params.gatewayRef !== "string") return null;
    if (params.status !== "paid" && params.status !== "failed") return null;
    // ADR-0226: the mock pay page lets the tester pick WHICH test card paid, so the
    // Pénztárca's card mask and the "másik kártya" swap run locally end to end.
    const card = typeof params.card === "string" ? mockCard(params.card) : null;
    return { gatewayRef: params.gatewayRef, status: params.status, ...(card ? { card } : {}) };
  }

  /** ADR-0226: the mock holds nothing, so releasing is always a success. */
  async finishReservation(gatewayRef: string, total: number): Promise<boolean> {
    console.log(`[payment:mock] zárolás lezárva · ${gatewayRef} · ${total} HUF`);
    return true;
  }

  /**
   * ADR-0080 ④: the mock MIT charge — succeeds instantly so the whole
   * auto-renewal loop runs locally. MOCK_RECURRING_FAIL=1 forces the failure
   * branch (dunning fallback) so THAT path is testable too, not just the happy one.
   */
  async chargeRecurring(req: RecurringChargeRequest): Promise<RecurringChargeResult> {
    const gatewayRef = `mock_mit_${req.paymentId}`;
    if (process.env.MOCK_RECURRING_FAIL === "1") {
      console.log(`[payment:mock] MIT terhelés SIKERTELEN (kényszerítve) · ${req.recurrenceId}`);
      return { gatewayRef, status: "failed" };
    }
    console.log(`[payment:mock] MIT terhelés OK · token ${req.recurrenceId} · ${req.amount} ${req.currency}`);
    return { gatewayRef, status: "paid" };
  }
}
