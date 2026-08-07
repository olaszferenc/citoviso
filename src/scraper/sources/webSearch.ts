// Google Programmable Search via the Custom Search JSON API — the official,
// legally clean web-search route (not browser scraping). Free 100 queries/day,
// then paid. Needs GOOGLE_MAPS_API_KEY (with "Custom Search API" enabled) + a
// CSE id (GOOGLE_CSE_ID) created with "Search the entire web".
const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/** One warning per status code per process — the loop must not spam the log. */
const warned = new Set<number>();
function warnOnce(status: number, body: string): void {
  if (warned.has(status)) return;
  warned.add(status);
  const hint =
    status === 403
      ? " → kapcsold be a Custom Search API-t a Google Cloud projektben (console.cloud.google.com ▸ APIs ▸ Custom Search API ▸ Enable), majd futtasd újra."
      : status === 429
        ? " → napi kvóta elfogyott (a Custom Search ingyenes kerete 100 lekérdezés/nap)."
        : "";
  const detail = body.replace(/\s+/g, " ").slice(0, 200);
  console.error(`⛔ WEBES KERESÉS NEM MŰKÖDIK (HTTP ${status})${hint}\n   ${detail}`);
}

export interface WebResult {
  title: string;
  link: string;
  snippet: string;
}

export async function webSearch(
  query: string,
  apiKey: string,
  cseId: string,
  num = 5,
): Promise<WebResult[]> {
  const url =
    `${ENDPOINT}?key=${apiKey}&cx=${cseId}` +
    `&q=${encodeURIComponent(query)}&num=${num}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    // A misconfigured search (API not enabled, bad key, quota) used to look exactly
    // like "no results" — so leads WITH a website were silently qualified as having
    // none. Fail LOUDLY once per process instead of degrading in silence.
    warnOnce(res.status, await res.text().catch(() => ""));
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
