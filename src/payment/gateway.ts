// Payment gateway abstraction (Slice 2 + ADR-0080 ④/⑤). The pilot payment flow:
//   order_intent → requestPayment → pay-link → payer pays → webhook → activate.
// We build behind THIS interface so a mock adapter runs the whole loop locally,
// and the real Barion adapter drops in unchanged (env PAYMENT_GATEWAY=barion).
//
// ADR-0080 ④: the checkout MAY initiate token storage (Barion InitiateRecurrence)
// so later renewals charge merchant-initiated (MIT), no payer present. A gateway
// that cannot do this simply leaves chargeRecurring undefined — the renewal
// engine then stays on the pay-link + dunning path.

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
  /** ADR-0080 ④: ask the gateway to store a charge token during this checkout. */
  readonly initiateRecurrence?: boolean;
  /** Merchant-chosen token id (we use the first payment's id); required when
   *  initiateRecurrence is set, and quoted verbatim at every later MIT charge. */
  readonly recurrenceId?: string;
}

/** ADR-0080 ④: a merchant-initiated charge with a stored token (payer absent). */
export interface RecurringChargeRequest {
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  /** The token minted at the initiating checkout (subscription.recurrence_token). */
  readonly recurrenceId: string;
  /** 0040: the initiating payment's card-scheme TraceId (3DS) — mandatory for
   *  Barion MIT; a gateway that does not use it ignores it. */
  readonly traceId?: string | null;
  readonly callbackUrl: string;
}

export interface RecurringChargeResult {
  readonly gatewayRef: string;
  /** 'pending' = accepted, final state arrives on the webhook. */
  readonly status: "paid" | "failed" | "pending";
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
  /** 0040: card-scheme TraceId of a paid, token-initiating payment (Barion). */
  readonly traceId?: string | null;
}

export interface PaymentGateway {
  readonly name: string;
  /** Create a hosted payment and return the pay-link + gateway ref. */
  createPayLink(req: PaymentRequest): Promise<PayLink>;
  /**
   * Resolve a gateway webhook into a final result, or null if not recognizable /
   * not yet final. `params` is the merged webhook query + body (the mock passes
   * {gatewayRef,status}; Barion passes {paymentId} and the adapter must call
   * GetPaymentState to learn the status → async). Returns null for non-final
   * states (e.g. Prepared/InProgress) so the caller does not act prematurely.
   */
  parseWebhook(
    params: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookResult | null>;
  /**
   * ADR-0080 ④: charge a stored token, payer absent (Barion MIT). Optional —
   * absent means the gateway cannot, and the renewal engine falls back to the
   * pay-link + dunning ladder.
   */
  chargeRecurring?(req: RecurringChargeRequest): Promise<RecurringChargeResult>;
}
