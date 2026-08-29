// Mock payment gateway (Slice 2) — runs the full pay-link loop locally with no
// account/keys. createPayLink points the payer at the console's /pay/mock/<ref>
// page (Fizetek / Elutasítom buttons), which posts to /pay/webhook/mock — exactly
// the shape the real Barion webhook will drive. Swap for the Barion adapter via
// PAYMENT_GATEWAY=barion once keys exist; the service + DB layer stay unchanged.

import type {
  PaymentGateway,
  PaymentRequest,
  PayLink,
  RecurringChargeRequest,
  RecurringChargeResult,
  WebhookResult,
} from "./gateway.js";

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
    return { gatewayRef: params.gatewayRef, status: params.status };
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
