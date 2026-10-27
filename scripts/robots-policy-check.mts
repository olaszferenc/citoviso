// ADR-0410 — robots.txt answers read per RFC 9309 §2.3.1 (owner's yes, 2026-10-27).
//
// What this proves, through the REAL mayFetch (fetch stubbed per origin, no network):
//   ① a 4xx robots.txt (401, 403, 404, 410) = no restrictions — the Fecske Kabin case
//      (fecskekabin.hu: robots.txt 403, pages 200 to our bot) is readable;
//   ② 429, 5xx, a network error and a timeout = complete disallow;
//   ③ a 2xx file is still obeyed (Disallow: / blocks, an Allow on the path lets through);
//   ④ ONE robots request per host — the second URL on the same host reads the cache.
// With the pre-fix code ① is red (401/403 blocked).
//
// Run: npx tsx scripts/robots-policy-check.mts

import { clearRobotsCache, mayFetch, robotsPolicyForStatus } from "../src/scraper/sources/portals/politeness.js";

let failures = 0;
const check = (label: string, pass: boolean, detail?: unknown): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✓" : "✗"} ${label}${pass || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};

console.log("robots.txt válasz → szabály (RFC 9309)");
const TABLE: [number, string][] = [
  [200, "parse"], [204, "parse"], [401, "allow_all"], [403, "allow_all"], [404, "allow_all"], [410, "allow_all"],
  [429, "block"], [500, "block"], [503, "block"], [302, "block"],
];
const wrong = TABLE.filter(([s, want]) => robotsPolicyForStatus(s) !== want).map(([s]) => `${s}→${robotsPolicyForStatus(s)}`);
check("robotsPolicyForStatus: 2xx olvas · 4xx (a 429 kivételével) szabad · 429, 5xx, egyéb tiltás", wrong.length === 0, wrong);

// Per-origin stub: status (or "throw" / "timeout"), optional body; counts robots requests.
type Reply = { status: number; body?: string } | "throw" | "timeout";
const replies = new Map<string, Reply>();
const robotsCalls = new Map<string, number>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === "/robots.txt") robotsCalls.set(url.origin, (robotsCalls.get(url.origin) ?? 0) + 1);
  const r = replies.get(url.origin);
  if (!r || r === "throw") throw new TypeError("fetch failed");
  if (r === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  return new Response(r.body ?? "", { status: r.status, headers: { "content-type": "text/plain" } });
}) as typeof fetch;

try {
  clearRobotsCache();
  const cases: [string, Reply, boolean][] = [
    ["https://fecskekabin.example", { status: 403, body: "Forbidden" }, true],
    ["https://auth.example", { status: 401 }, true],
    ["https://nofile.example", { status: 404 }, true],
    ["https://gone.example", { status: 410 }, true],
    ["https://busy.example", { status: 429 }, false],
    ["https://down.example", { status: 503 }, false],
    ["https://err.example", { status: 500 }, false],
    ["https://neterr.example", "throw", false],
    ["https://slow.example", "timeout", false],
  ];
  for (const [origin, reply] of cases) replies.set(origin, reply);
  for (const [origin, reply, allowed] of cases) {
    const r = await mayFetch(`${origin}/szallas/adatlap`);
    const label = typeof reply === "string" ? reply : `HTTP ${reply.status}`;
    check(`${allowed ? "①" : "②"} robots.txt ${label} → ${allowed ? "szabad" : "tilos"}`, r.allowed === allowed, r);
  }

  replies.set("https://rules.example", { status: 200, body: "User-agent: *\nDisallow: /\nAllow: /szallas/\n" });
  const blocked = await mayFetch("https://rules.example/admin/x");
  const allowed = await mayFetch("https://rules.example/szallas/y");
  check("③ 2xx fájl: a Disallow: / tilt, a hosszabb Allow enged", !blocked.allowed && allowed.allowed, { blocked, allowed });

  check("④ hostonként EGY robots-kérés (a második URL a gyorsítótárból)", robotsCalls.get("https://rules.example") === 1 && robotsCalls.get("https://fecskekabin.example") === 1, Object.fromEntries(robotsCalls));
} finally {
  globalThis.fetch = realFetch;
}

if (failures) {
  console.error(`\n⛔ robots-policy-check: ${failures} bukás — a robots.txt olvasata eltér az RFC 9309-től.`);
  process.exit(1);
}
console.log("\n✅ robots-policy-check: 4xx (a 429 kivételével) szabad, 429/5xx/hálózati hiba/időtúllépés tilos, a 2xx fájlt betartjuk, hostonként egy kérés.");
