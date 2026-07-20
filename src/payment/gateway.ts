// Payment gateway abstraction (Slice 2). The pilot payment flow is:
//   order_intent → requestPayment → pay-link → payer pays → webhook → activate.
// We build behind THIS interface so a mock adapter runs the whole loop locally,
// and the real Barion adapter drops in unchanged once the account + keys exist
// (env PAYMENT_GATEWAY=barion). No stored-card / MIT here — the pilot uses a
// per-period PAY-LINK (a fresh one-off payment each cycle; non-pay → deactivate);
// auto-charge (Barion MIT) is a later phase (see BACKLOG).

export interface PaymentRequest {
  /** Our payment.id (opaque, round-trips through the gateway). */
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly period: "monthly" | "annual";
  readonly description: string;
  /** Absolute webhook URL the gateway calls on completion. */
  readonly callbackUrl: string;
  /** Absolute URL the payer returns to after paying. */
  readonly returnUrl: string;
}

export interface PayLink {
  /** The gateway's payment reference (Barion PaymentId; mock: our own ref). */
  readonly gatewayRef: string;
  /** The hosted pay page the payer is sent to. */
  readonly payUrl: string;
}

export interface WebhookResult {
  readonly gatewayRef: string;
  readonly status: "paid" | "failed";
}

export interface PaymentGateway {
  readonly name: string;
  /** Create a hosted payment and return the pay-link + gateway ref. */
  createPayLink(req: PaymentRequest): Promise<PayLink>;
  /** Parse + verify a gateway webhook; return null if not a recognizable/valid one. */
  parseWebhook(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookResult | null;
}
