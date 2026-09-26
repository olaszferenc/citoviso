// The STABLE pay-link a letter carries: /pay/go/<payment id> (see payEntry.ts).
// Kept dependency-free on purpose: billing.ts and service.ts import each other, and
// the letter builders must not pull the gateway machinery in to format one URL.

/** The URL a letter carries instead of the gateway's short-lived one. */
export function payEntryUrl(paymentId: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/pay/go/${paymentId}`;
}
