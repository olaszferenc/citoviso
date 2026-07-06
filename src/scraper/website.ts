import type { WebsiteAssessment } from "./types.js";

// Assess whether an existing own website looks outdated. MVP heuristic over the
// raw HTML (dependency-free, regex-based); a vision-AI pass is a later slice.
// The signals are chosen to be high-precision (few false "outdated" verdicts).

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 300_000;

// Legacy HTML/tech markers → strong "this site is old" evidence.
const LEGACY_MARKERS: Array<readonly [RegExp, string]> = [
  [/<font\b/i, "font-tag"],
  [/<center\b/i, "center-tag"],
  [/<marquee\b/i, "marquee-tag"],
  [/\bbgcolor\s*=/i, "bgcolor-attr"],
  [/<frameset\b/i, "frameset"],
  [/\.swf\b|<embed\b/i, "flash"],
  [/jquery-1\.[0-9]/i, "old-jquery"],
];

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "citoviso-scraper/0.1" },
    });
    if (!res.ok || !res.body) return null;
    // Read at most MAX_BYTES so a huge page can't stall us.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return Buffer.concat(chunks).toString("utf8");
  } catch {
    return null; // timeout, DNS failure, TLS error, etc. → treated as unreachable
  } finally {
    clearTimeout(timer);
  }
}

export async function assessWebsite(url: string): Promise<WebsiteAssessment> {
  const html = await fetchHtml(url);
  if (html === null) {
    // A domain that exists (has_own) but does not respond is a strong lead.
    return {
      reachable: false,
      responsive: false,
      signals: ["unreachable"],
      imageCount: 0,
      outdated: true,
    };
  }

  const imageCount = (html.match(/<img\b/gi) ?? []).length;
  const signals: string[] = [];
  const responsive = /<meta[^>]+name=["']?viewport["']?/i.test(html);
  if (!responsive) signals.push("no-viewport");
  for (const [re, label] of LEGACY_MARKERS) {
    if (re.test(html)) signals.push(label);
  }

  let copyrightYear: number | undefined;
  const matches = [
    ...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,12}((?:19|20)\d{2})/gi),
  ];
  if (matches.length) {
    copyrightYear = Math.max(...matches.map((m) => parseInt(m[1], 10)));
    if (copyrightYear <= new Date().getFullYear() - 3) {
      signals.push(`old-copyright-${copyrightYear}`);
    }
  }

  // Outdated if not mobile-responsive, or at least two independent old signals.
  const outdated = !responsive || signals.length >= 2;
  return { reachable: true, responsive, copyrightYear, signals, imageCount, outdated };
}
