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
import { decodeEntities } from "./portals/extract.js";
import { noteDeadKey } from "../../console/keyDeath.js";

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

/**
 * A Brave title/description as plain text. Brave marks the query words with
 * `<strong>` INSIDE the text, and the mark can split a word: the lead's name is the
 * query, so "írj a hajas</strong>.bela@gmail.com" came back for Hajas Família
 * (2026-09-27), and the e-mail pattern fished ".bela@gmail.com" — the address minus
 * its name word, on 2 live leads. Inline marks go WITHOUT a gap (the word stays
 * whole), any other tag becomes a space, entities are decoded.
 */
export function braveText(s: string | undefined): string {
  return decodeEntities(
    String(s ?? "")
      .replace(/<\/?(?:strong|b|em|i|mark)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " "),
  );
}

/** One Brave call: the results, or the HTTP failure for the failover to judge. */
type BraveOutcome =
  | { ok: true; results: WebResult[] }
  | { ok: false; status: number; body: string };

/** Brave Search — the primary backend (ADR-0026). */
async function braveSearch(
  query: string,
  apiKey: string,
  num: number,
): Promise<BraveOutcome> {
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
    return { ok: false, status: res.status, body };
  }
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return {
    ok: true,
    results: (data.web?.results ?? []).map((r) => ({
      title: braveText(r.title),
      link: r.url ?? "",
      snippet: braveText(r.description),
    })),
  };
}

// ── Key failover (owner 2026-11-08: a spare key "ha a másik kifogyna") ─────────────────
// config.braveApiKeys lists the keys in order. A key that is out of credit (402 —
// measured 2026-11-08 on the first key: "HTTP 402" once its credit ran out), rejected
// (401/403) or still rate-limited after one patient retry (429) is benched, and the
// SAME query goes to the next key at once — a dropped query would silently lose a
// lead's discovery (the credibility bug ADR-0026 exists to prevent). A benched key is
// tried again after its bench time, so a key whose monthly credit renews comes back
// by itself. The ops alert (noteDeadKey) fires only when NO key is left.
const BENCH_MS: Record<number, number> = {
  401: 6 * 3_600_000,
  402: 3_600_000,
  403: 6 * 3_600_000,
  429: 10 * 60_000,
};
const benchedUntil = new Map<string, number>();

function braveKeyLabel(keys: string[], key: string): string {
  const i = keys.indexOf(key);
  return i <= 0 ? "BRAVE_API_KEY" : `BRAVE_API_KEY_${i + 1}`;
}

/** Keys in failover order, the benched ones skipped. Exported for the check script. */
export function braveUsableKeys(now = Date.now()): string[] {
  return config.braveApiKeys.filter((k) => (benchedUntil.get(k) ?? 0) <= now);
}

async function braveWithFailover(query: string, num: number): Promise<WebResult[]> {
  const keys = config.braveApiKeys;
  let last: { status: number; body: string; label: string } | null = null;
  for (const key of braveUsableKeys()) {
    let out = await braveSearch(query, key, num);
    if (!out.ok && out.status === 429) {
      // A per-second burst limit clears in a second; only a 429 that persists means
      // the key's quota is spent.
      await new Promise((r) => setTimeout(r, BRAVE_MIN_GAP_MS));
      out = await braveSearch(query, key, num);
    }
    if (out.ok) return out.results;
    const label = braveKeyLabel(keys, key);
    last = { status: out.status, body: out.body, label };
    const bench = BENCH_MS[out.status];
    if (bench === undefined) {
      // 422, 5xx …: a problem with THIS query or Brave itself — another key won't help.
      warnOnce(
        `brave-${out.status}`,
        `⛔ BRAVE SEARCH HIBA (HTTP ${out.status}, ${label})` +
          `\n   ${out.body.replace(/\s+/g, " ").slice(0, 200)}`,
      );
      return [];
    }
    benchedUntil.set(key, Date.now() + bench);
    console.error(
      `⚠️ ${label}: HTTP ${out.status}` +
        (out.status === 402 ? " (elfogyott a kerete)" : out.status === 429 ? " (kvóta/rate limit)" : " (érvénytelen kulcs)") +
        ` → ${Math.round(bench / 60_000)} percre félreteszem, a következő kulccsal próbálom.`,
    );
  }
  if (last && (last.status === 401 || last.status === 402 || last.status === 403)) {
    noteDeadKey("brave", `minden Brave-kulcs használhatatlan; utolsó: ${last.label} HTTP ${last.status}: ${last.body.slice(0, 200)}`);
  }
  warnOnce(
    `brave-all-${last?.status ?? "benched"}`,
    `⛔ BRAVE SEARCH: NINCS HASZNÁLHATÓ KULCS (${keys.length} db beállítva` +
      (last ? `, utolsó: ${last.label} HTTP ${last.status}` : ", mind félretéve") +
      ") → a webes keresés kimarad. Új kulcs: BRAVE_API_KEY_" + (keys.length + 1) + " a .env-ben.",
  );
  return [];
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
  return Boolean(config.braveApiKeys.length > 0 || (config.googleMapsApiKey && config.googleCseId));
}

/** Which backend a search would use right now (for operator-facing logs). */
export function webSearchBackend(): "brave" | "google_cse" | "none" {
  if (config.braveApiKeys.length > 0) return "brave";
  if (config.googleMapsApiKey && config.googleCseId) return "google_cse";
  return "none";
}

/**
 * Search the open web. Brave first; Google CSE only as a legacy fallback. The
 * apiKey/cseId params are the CSE credentials (kept for call-site compatibility);
 * the Brave keys come from config (BRAVE_API_KEY, then BRAVE_API_KEY_2 … as failover).
 */
export async function webSearch(
  query: string,
  apiKey?: string,
  cseId?: string,
  num = 5,
): Promise<WebResult[]> {
  if (config.braveApiKeys.length > 0) {
    return braveThrottled(() => braveWithFailover(query, num));
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
