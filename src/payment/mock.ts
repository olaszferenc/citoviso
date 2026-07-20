// Mock payment gateway (Slice 2) — runs the full pay-link loop locally with no
// account/keys. createPayLink points the payer at the console's /pay/mock/<ref>
// page (Fizetek / Elutasítom buttons), which posts to /pay/webhook/mock — exactly
// the shape the real Barion webhook will drive. Swap for the Barion adapter via
// PAYMENT_GATEWAY=barion once keys exist; the service + DB layer stay unchanged.

import type { PaymentGateway, PaymentRequest, PayLink, WebhookResult } from "./gateway.js";

export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  async createPayLink(req: PaymentRequest): Promise<PayLink> {
    // The mock ref is just our own payment id — deterministic, easy to trace.
    const gatewayRef = `mock_${req.paymentId}`;
    return { gatewayRef, payUrl: `/pay/mock/${gatewayRef}` };
  }

  parseWebhook(body: unknown): WebhookResult | null {
    const b = (body ?? {}) as { gatewayRef?: unknown; status?: unknown };
    if (typeof b.gatewayRef !== "string") return null;
    if (b.status !== "paid" && b.status !== "failed") return null;
    return { gatewayRef: b.gatewayRef, status: b.status };
  }
}
