// Referrer host → source group, for the tenant activity block and the Riport › Tenantok tab
// (frozen plan: assets/design-refs/console/tenant-aktivitas/).
//
// WHY A GROUP AND NOT THE HOST: the owner asked "honnan jönnek" — the answer is "Google",
// "Facebook", "a portálról", not a list of hostnames (google.hu, google.com, l.facebook.com,
// m.facebook.com…). The input is ONLY what site_visit already stores (the bare referrer host,
// ADR-0108 ⑤) — no new measurement: UTM, country and the viewed sub-page are NOT known here
// (owner decision 2026-11-04: no new data collection in this round).
//
// ⛔ "OURS" IS NOT A GUEST SOURCE. citoviso.com hosts the tenant admin (/admin → „Oldal”
// link) and admin.citoviso.com is the operator console — a visit referred from either is the
// owner or us looking at the site. The report excludes the whole day of such a fingerprint
// (see tenantActivity.ts), so this group never reaches a guest figure.
//
// Pure functions. Self-test: `npx tsx src/analytics/referrerGroup.ts --self-test`.

import { fileURLToPath } from "node:url";
import { PLATFORM_DOMAIN } from "../domains.js";

export type SourceGroup =
  | "direct"
  | "google"
  | "bing"
  | "search_other"
  | "social"
  | "portal"
  | "mail"
  | "self"
  | "ours"
  | "other";

const PORTALS = [
  "szallas.hu",
  "booking.com",
  "airbnb.",
  "zimmerinfo.hu",
  "hovamenjek.hu",
  "szallasvadasz.hu",
  "travelminit.",
  "szallasguru.hu",
  "utazzitthon.hu",
  "lake-balaton.com",
  "tripadvisor.",
];

const has = (host: string, suffix: string): boolean => host === suffix || host.endsWith(`.${suffix}`);

/**
 * Classify one stored referrer host. `siteHost` is the host the visit itself arrived on —
 * a referrer equal to it (or to the tenant's other host) is navigation inside the site.
 */
export function sourceGroupOf(referrer: string | null, siteHosts: readonly string[] = []): SourceGroup {
  const h = (referrer ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!h) return "direct";
  if (siteHosts.some((s) => s.replace(/^www\./, "").toLowerCase() === h)) return "self";
  if (h === PLATFORM_DOMAIN || h === `admin.${PLATFORM_DOMAIN}`) return "ours";
  // Android apps send their package name as the referrer.
  if (h === "com.google.android.gm" || /(^|\.)mail\.|outlook\.|freemail\.hu|citromail\.hu/.test(h)) return "mail";
  if (/(^|\.)google\.[a-z.]+$/.test(h) || h === "com.google.android.googlequicksearchbox") return "google";
  if (has(h, "bing.com")) return "bing";
  if (/(^|\.)(duckduckgo\.com|yahoo\.com|yandex\.[a-z]+|baidu\.com|ecosia\.org|startpage\.com)$/.test(h)) return "search_other";
  if (/(^|\.)(facebook\.com|fb\.com|instagram\.com|messenger\.com|tiktok\.com|youtube\.com|t\.co|x\.com)$/.test(h) || h.startsWith("com.facebook.") || h.startsWith("com.instagram.")) return "social";
  if (PORTALS.some((p) => (p.endsWith(".") ? h.includes(p) : has(h, p)))) return "portal";
  return "other";
}

/** "ours" = the tenant admin or the operator console: the owner / us, never a guest. */
export const isOwnReferrer = (referrer: string | null): boolean => sourceGroupOf(referrer) === "ours";

function selfTest(): void {
  const cases: [string | null, SourceGroup, string[]?][] = [
    [null, "direct"],
    ["", "direct"],
    ["google.com", "google"],
    ["www.google.hu", "google"],
    ["com.google.android.googlequicksearchbox", "google"],
    ["com.google.android.gm", "mail"],
    ["bing.com", "bing"],
    ["baidu.com", "search_other"],
    ["l.facebook.com", "social"],
    ["m.facebook.com", "social"],
    ["instagram.com", "social"],
    ["szallas.hu", "portal"],
    ["www.booking.com", "portal"],
    ["citoviso.com", "ours"],
    ["admin.citoviso.com", "ours"],
    ["sama-vendeghaz.citoviso.com", "self", ["sama-vendeghaz.citoviso.com"]],
    ["overseer.hu", "self", ["overseer.hu", "www.overseer.hu"]],
    ["teszt-rebeka-panzio.citoviso.com", "other"],
    ["ovenremodel.kjibs.com", "other"],
  ];
  let bad = 0;
  for (const [ref, want, hosts] of cases) {
    const got = sourceGroupOf(ref, hosts ?? []);
    if (got !== want) {
      bad++;
      console.error(`✗ ${String(ref)} → ${got} (várt: ${want})`);
    }
  }
  if (bad) {
    console.error(`referrerGroup self-test: ${bad} hiba`);
    process.exit(1);
  }
  console.log(`✓ referrerGroup self-test: ${cases.length}/${cases.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--self-test")) selfTest();
