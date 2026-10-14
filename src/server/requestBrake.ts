// The public endpoints' request brake (Elek F-5, 2026-10-14).
//
// The booking POST used to count EVERY attempt per IP — a guest who mistyped a phone number
// four times was locked out on the fifth try, and the count was shared by every tenant and
// by three endpoints (booking, enquiry, review), so a guest who left a review on one site
// could not book on another. Two counters now, keyed by endpoint + tenant + IP:
//   · the RAW ceiling counts every POST (abuse brake: hammering is still stopped);
//   · the CREATED limit counts only what actually made a row (a validation error is free).

export interface BrakeClock {
  now(): number;
}

export class RequestBrake {
  private readonly hits = new Map<string, { n: number; until: number }>();

  constructor(private readonly clock: BrakeClock = { now: () => Date.now() }) {}

  /** Is `key` already at its limit? Reads only — nothing is counted. */
  over(key: string, limit: number): boolean {
    const hit = this.hits.get(key);
    return Boolean(hit && hit.until >= this.clock.now() && hit.n >= limit);
  }

  /** Count one event on `key` (a fresh window when the old one has passed). */
  add(key: string, windowMs: number): void {
    const now = this.clock.now();
    const hit = this.hits.get(key);
    if (!hit || hit.until < now) {
      this.hits.set(key, { n: 1, until: now + windowMs });
      if (this.hits.size > 5000) this.hits.clear(); // bounded: this is a guard, not a ledger
      return;
    }
    hit.n++;
  }

  /** Count and ask in one step: true when this event is over the limit (the raw ceiling). */
  hit(key: string, limit: number, windowMs: number): boolean {
    this.add(key, windowMs);
    const h = this.hits.get(key)!;
    return h.n > limit;
  }
}

/** One key shape for every caller: endpoint · tenant · client IP. */
export function brakeKey(route: string, tenantId: string, ip: string): string {
  return `${route}|${tenantId}|${ip}`;
}
