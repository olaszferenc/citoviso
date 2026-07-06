// Google Programmable Search via the Custom Search JSON API — the official,
// legally clean web-search route (not browser scraping). Free 100 queries/day,
// then paid. Needs GOOGLE_MAPS_API_KEY (with "Custom Search API" enabled) + a
// CSE id (GOOGLE_CSE_ID) created with "Search the entire web".
const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

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
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.items ?? []).map((i) => ({
    title: i.title ?? "",
    link: i.link ?? "",
    snippet: i.snippet ?? "",
  }));
}
