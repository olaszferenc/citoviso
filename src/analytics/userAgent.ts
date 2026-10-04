// User-Agent → device / OS / browser, and referrer → host (ADR-0322 ③, ADR-0108).
//
// WHY THIS EXISTS: the mock link used to store the raw User-Agent and the full referrer,
// while the tenant site (ADR-0108) stored only a device class and a bare host. One rule,
// two places. This file is the ONE place: the mock view stores what it extracts here and
// nothing raw — the report needs "mobile / tablet / desktop", not a fingerprint.
//
// ⛔ Pure functions, no I/O. The rules are fixed by the self-test below
// (`npx tsx src/analytics/userAgent.ts --self-test`) on recorded UA strings, so a later
// tweak cannot silently reclassify a device.

import { fileURLToPath } from "node:url";

export type DeviceClass = "mobile" | "tablet" | "desktop" | "bot" | "unknown";
export type OsName = "iOS" | "Android" | "Windows" | "macOS" | "Linux" | "egyéb";
export type BrowserName = "Safari" | "Chrome" | "Firefox" | "Edge" | "Samsung" | "egyéb";

export interface ParsedUserAgent {
  readonly device: DeviceClass;
  readonly os: OsName | null;
  readonly browser: BrowserName | null;
}

/**
 * Known crawler / monitor / link-preview signatures. Deliberately broad substrings —
 * the same list the tenant-site counter uses (src/analytics/siteVisit.ts imports it):
 * a bot counted as a human inflates every number on the report.
 */
export const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|vkshare|w3c_validator|whatsapp|flipboard|tumblr|telegram|discord|slack|preview|monitor|uptime|pingdom|lighthouse|headless|curl|wget|python-requests|axios|go-http-client|java\/|okhttp/i;

function osOf(ua: string): OsName {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os x/i.test(ua)) return "macOS";
  if (/linux|x11|cros/i.test(ua)) return "Linux";
  return "egyéb";
}

// Order matters: Edge and Samsung Internet both carry "Chrome", Chrome on iOS carries
// "Safari", every Chromium carries "Safari".
function browserOf(ua: string): BrowserName {
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
  if (/samsungbrowser\//i.test(ua)) return "Samsung";
  if (/firefox\/|fxios\//i.test(ua)) return "Firefox";
  if (/chrome\/|crios\/|chromium\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return "Safari";
  // In-app WebViews on iOS (Messenger, Gmail…) omit "Safari/" but are WebKit = Safari.
  if (/iphone|ipad|ipod/i.test(ua) && /applewebkit/i.test(ua)) return "Safari";
  return "egyéb";
}

function deviceOf(ua: string): DeviceClass {
  if (/ipad/i.test(ua)) return "tablet";
  // Android phones say "Mobile"; Android tablets do not.
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "mobile" : "tablet";
  if (/tablet|kindle|silk\//i.test(ua)) return "tablet";
  if (/iphone|ipod|windows phone|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Classify a User-Agent. Empty/missing → `unknown` (nothing to classify, and not
 * evidence of a bot on its own here: the mock view is recorded only on a human sign,
 * ADR-0291). A known bot → `bot`, with OS/browser left null (they would be noise).
 *
 * ⚠️ iPadOS 13+ Safari identifies as a Mac ("Macintosh … Version/… Safari") — it is
 * counted as desktop. The server cannot tell them apart without client hints; the
 * report must not claim more precision than this.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const s = (ua ?? "").trim();
  if (!s) return { device: "unknown", os: null, browser: null };
  if (BOT_PATTERN.test(s)) return { device: "bot", os: null, browser: null };
  return { device: deviceOf(s), os: osOf(s), browser: browserOf(s) };
}

/** Bare hostname of the referrer ("google.com"), never the path or query. */
export function referrerHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const h = new URL(raw).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

// ── self-test ────────────────────────────────────────────────────────────────
const SAMPLES: readonly [string, ParsedUserAgent][] = [
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    { device: "mobile", os: "iOS", browser: "Safari" },
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
    { device: "mobile", os: "iOS", browser: "Chrome" },
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]",
    { device: "mobile", os: "iOS", browser: "Safari" },
  ],
  [
    "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    { device: "tablet", os: "iOS", browser: "Safari" },
  ],
  [
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    { device: "mobile", os: "Android", browser: "Chrome" },
  ],
  [
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
    { device: "mobile", os: "Android", browser: "Samsung" },
  ],
  [
    "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    { device: "tablet", os: "Android", browser: "Chrome" },
  ],
  [
    "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
    { device: "mobile", os: "Android", browser: "Firefox" },
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    { device: "desktop", os: "Windows", browser: "Edge" },
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    { device: "desktop", os: "Windows", browser: "Chrome" },
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    { device: "desktop", os: "Windows", browser: "Firefox" },
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    { device: "desktop", os: "macOS", browser: "Safari" },
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    { device: "desktop", os: "Linux", browser: "Chrome" },
  ],
  [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    { device: "bot", os: null, browser: null },
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36",
    { device: "bot", os: null, browser: null },
  ],
  ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", { device: "bot", os: null, browser: null }],
  ["", { device: "unknown", os: null, browser: null }],
];

const REFERRERS: readonly [string | null, string | null][] = [
  ["https://www.google.com/search?q=panzio", "google.com"],
  ["https://mail.google.com/mail/u/0/#inbox/abc", "mail.google.com"],
  ["android-app://com.google.android.gm/", "com.google.android.gm"],
  ["not a url", null],
  ["", null],
  [null, null],
];

function selfTest(): number {
  let fail = 0;
  for (const [ua, want] of SAMPLES) {
    const got = parseUserAgent(ua);
    if (got.device !== want.device || got.os !== want.os || got.browser !== want.browser) {
      fail++;
      console.error(`✗ ${ua.slice(0, 90)}\n   várt ${JSON.stringify(want)}\n   kapott ${JSON.stringify(got)}`);
    }
  }
  for (const [ref, want] of REFERRERS) {
    const got = referrerHost(ref);
    if (got !== want) {
      fail++;
      console.error(`✗ referrerHost(${JSON.stringify(ref)}) = ${JSON.stringify(got)}, várt ${JSON.stringify(want)}`);
    }
  }
  const total = SAMPLES.length + REFERRERS.length;
  if (fail) console.error(`userAgent önteszt: ${fail}/${total} BUKOTT`);
  else console.log(`userAgent önteszt: ${total}/${total} zöld`);
  return fail ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--self-test")) {
  process.exit(selfTest());
}
