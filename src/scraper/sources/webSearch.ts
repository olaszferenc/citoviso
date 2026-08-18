// Web search behind ONE interface, with a pluggable backend (ADR-0026).
//
// WHY NOT Google CSE: Programmable Search "entire web" is being sunset — new
// engines can no longer get it and existing ones die 2027-01-01 — so the CSE path
// is a dead end we must not build on. Bing's Web Search API was shut down
// 2025-08-11. The chosen replacement is BRAVE SEARCH (independent index, cheap,
// no site-restriction trap). See _planning/memory/2026-07-07_presence_detection.md.
//
// The dispatcher keeps CSE as a legacy fallback ONLY for engines that still have
// entire-web rights. With no backend the callers degrade gracefully (empty
// result) but LOUDLY — a silent empty result once mis-qualified real websites as
// "no site", which is a credibility bug, not a missing feature.

import { config } from "../../config.js";

const CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export interface WebResult {
  title: string;
  link: string;
  snippet: string;
}

/** One warning per reason per process — a batch loop must not spam the log. */
const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message);
}

// The Brave free plan allows 1 query/second. Callers run with concurrency (the
// enrichers use 3 workers), so the limit is enforced HERE, where it belongs:
// all Brave calls are serialized on a promise chain with a minimum gap. A 429
// would silently drop a lead's discovery — the exact credibility bug ADR-0026
// exists to prevent — so waiting a second is always the better trade.
const BRAVE_MIN_GAP_MS = 1_100;
let braveChain: Promise<unknown> = Promise.resolve();
function braveThrottled<T>(task: () => Promise<T>): Promise<T> {
  const run = braveChain.then(task);
  braveChain = run
    .catch(() => {})
    .then(() => new Promise((r) => setTimeout(r, BRAVE_MIN_GAP_MS)));
  return run;
}

/** Brave Search — the primary backend (ADR-0026). */
async function braveSearch(
  query: string,
  apiKey: string,
  num: number,
): Promise<WebResult[]> {
  // NOTE: Brave has no HU market — country=HU is rejected with HTTP 422 (the
  // enum only lists ~37 markets). country=ALL + search_lang=hu is the correct
  // combination for Hungarian queries (verified live 2026-08-18).
  const url =
    `${BRAVE_ENDPOINT}?q=${encodeURIComponent(query)}` +
    `&count=${num}&country=ALL&search_lang=hu`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    warnOnce(
      `brave-${res.status}`,
      `⛔ BRAVE SEARCH HIBA (HTTP ${res.status})` +
        (res.status === 401 || res.status === 403
          ? " → érvénytelen vagy hiányzó BRAVE_API_KEY."
          : res.status === 429
            ? " → rate limit (az ingyenes csomag 1 lekérdezés/másodperc)."
            : "") +
        `\n   ${body.replace(/\s+/g, " ").slice(0, 200)}`,
    );
    return [];
  }
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title ?? "",
    link: r.url ?? "",
    snippet: r.description ?? "",
  }));
}

/** Google Programmable Search — LEGACY fallback (entire-web sunset 2027-01-01). */
async function cseSearch(
  query: string,
  apiKey: string,
  cseId: string,
  num: number,
): Promise<WebResult[]> {
  const url =
    `${CSE_ENDPOINT}?key=${apiKey}&cx=${cseId}` +
    `&q=${encodeURIComponent(query)}&num=${num}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    warnOnce(
      `cse-${res.status}`,
      `⛔ GOOGLE CSE HIBA (HTTP ${res.status})` +
        (res.status === 403
          ? " → a Custom Search API nincs engedélyezve; ráadásul az 'entire web' keresés kivezetés alatt (2027-01-01). A helyes út: BRAVE_API_KEY."
          : "") +
        `\n   ${body.replace(/\s+/g, " ").slice(0, 200)}`,
    );
    return [];
  }
  const data = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.items ?? []).map((i) => ({
    title: i.title ?? "",
    link: i.link ?? "",
    snippet: i.snippet ?? "",
  }));
}

/** True when ANY web-search backend is configured (callers can skip the work). */
export function webSearchAvailable(): boolean {
  return Boolean(config.braveApiKey || (config.googleMapsApiKey && config.googleCseId));
}

/** Which backend a search would use right now (for operator-facing logs). */
export function webSearchBackend(): "brave" | "google_cse" | "none" {
  if (config.braveApiKey) return "brave";
  if (config.googleMapsApiKey && config.googleCseId) return "google_cse";
  return "none";
}

/**
 * Search the open web. Brave first; Google CSE only as a legacy fallback. The
 * apiKey/cseId params are the CSE credentials (kept for call-site compatibility);
 * the Brave key comes from config.
 */
export async function webSearch(
  query: string,
  apiKey?: string,
  cseId?: string,
  num = 5,
): Promise<WebResult[]> {
  if (config.braveApiKey) {
    const key = config.braveApiKey;
    return braveThrottled(() => braveSearch(query, key, num));
  }
  // Fall back to the configured CSE credentials so the behaviour always matches
  // webSearchBackend() (callers may pass them explicitly or not at all).
  const key = apiKey || config.googleMapsApiKey;
  const cx = cseId || config.googleCseId;
  if (key && cx) return cseSearch(query, key, cx, num);
  warnOnce(
    "no-backend",
    "⛔ WEBES KERESÉS KIKAPCSOLVA: nincs BRAVE_API_KEY (és nincs használható CSE) — " +
      "a honlap-felderítés és a kontakt-keresés kimarad.",
  );
  return [];
}
