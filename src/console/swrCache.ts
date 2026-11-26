// STALE-WHILE-REVALIDATE for the console's heavy read-only numbers (owner 2026-11-26: „rákattintok
// valamire oszt malmozhatok míg bármi is betölt”). Measured on the 2-vCPU VPS the same day: every
// hub click recomputed the lead stock (8.7 s), the open-per-channel card (5.8 s) and the funnel
// (2.6 s) in series — 35 s for the dashboard.
//
// The rule: a click never waits for a recomputation it has a recent answer for. The cached value
// is served at once; when it is older than `ttlMs`, ONE background recomputation starts (concurrent
// clicks share it), and the next click sees the fresh numbers. Only the very first call (empty
// cache) waits. A failed recomputation keeps the last good value and is retried on the next call.
// Nothing runs while nobody looks at the console — there is no timer.

interface Entry<T> {
  value?: T;
  at: number;
  pending: Promise<T> | null;
}

const entries = new Map<string, Entry<unknown>>();

/** The cached value of `key` (recomputed with `compute` in the background once older than `ttlMs`). */
export async function swr<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  let e = entries.get(key) as Entry<T> | undefined;
  if (!e) {
    e = { at: 0, pending: null };
    entries.set(key, e as Entry<unknown>);
  }
  const entry = e;
  const refresh = (): Promise<T> => {
    if (!entry.pending) {
      entry.pending = compute()
        .then((v) => {
          entry.value = v;
          entry.at = Date.now();
          return v;
        })
        .finally(() => {
          entry.pending = null;
        });
    }
    return entry.pending;
  };
  if (!("value" in entry)) return refresh();
  if (Date.now() - entry.at > ttlMs) refresh().catch(() => undefined);
  return entry.value as T;
}

/** Drop `key` (or every key) — the next call recomputes and waits. For tests and explicit invalidation. */
export function swrForget(key?: string): void {
  if (key === undefined) entries.clear();
  else entries.delete(key);
}
