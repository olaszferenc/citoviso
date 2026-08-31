// POLITENESS LAYER for portal reading — the part that decides whether we are
// allowed to fetch a page at all, and how fast.
//
// Three rules, all enforced here rather than at the call sites (a call site that
// can forget them will eventually forget them):
//   1. robots.txt is obeyed, per host, with the Allow/Disallow longest-match rule.
//      hovamenjek.hu is the live proof that a naive "Disallow prefix" reading is
//      wrong: it disallows /upload/places/ but ALLOWS /upload/places/*.jpg — i.e.
//      exactly the gallery images, which a prefix-only crawler would skip.
//   2. One request at a time per host, with a minimum gap (Crawl-delay honoured
//      when published). Different hosts may run in parallel, capped globally.
//   3. An identifiable User-Agent pointing at our own domain — no pretending to
//      be a browser, and no bypassing a challenge page. A host that answers a
//      Cloudflare interstitial has said no; we take the no (see registry.ts).
//
// Static fetch is the default. A headless render is only used when a registry
// entry explicitly asks for it, because a browser costs ~100× a fetch.

import { config } from "../../../config.js";

/** Honest, contactable identity. Never spoof a browser UA. */
export const PORTAL_USER_AGENT = "citoviso-bot/0.1 (+https://citoviso.com)";

/** The token robots.txt groups are matched against (UA up to the first slash). */
const ROBOTS_TOKEN = "citoviso-bot";

const ROBOTS_TIMEOUT_MS = 8_000;
const PAGE_TIMEOUT_MS = 20_000;
/** Portal listing pages run 20–250 KB; the cap stops a runaway stream. */
const MAX_BYTES = 900_000;
/** Default gap between two requests to the SAME host. */
const DEFAULT_GAP_MS = 1_500;
/** How long a parsed robots.txt is trusted (ms). */
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

interface RobotsRule {
  readonly allow: boolean;
  readonly path: string;
}

interface RobotsPolicy {
  readonly rules: RobotsRule[];
  readonly crawlDelayMs?: number;
  /** True when robots.txt could not be read in a way we may treat as permissive. */
  readonly blockedByFailure: boolean;
  readonly fetchedAt: number;
}

const robotsCache = new Map<string, RobotsPolicy>();
/** Per-host serialisation chain: one in-flight request per host, with a gap. */
const hostChain = new Map<string, Promise<unknown>>();

/** Convert one robots.txt path pattern into an anchored regex (`*` and `$` supported). */
function patternToRegex(pattern: string): RegExp {
  let src = "";
  for (const ch of pattern) {
    if (ch === "*") src += ".*";
    else if (ch === "$") src += "$";
    else src += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + src);
}

/**
 * Parse robots.txt into the rule set that applies to US. Groups are collected
 * for our token and for `*`; the specific token wins outright when present,
 * which is what the standard says and what a portal expects.
 */
export function parseRobots(text: string): Omit<RobotsPolicy, "fetchedAt" | "blockedByFailure"> {
  const groups = new Map<string, { rules: RobotsRule[]; crawlDelay?: number }>();
  let currentAgents: string[] = [];
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group.
      if (!lastLineWasAgent) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (!currentAgents.length) continue;

    for (const agent of currentAgents) {
      const g = groups.get(agent) ?? { rules: [] };
      if (field === "disallow") {
        // An empty Disallow means "allow everything" — it adds no rule.
        if (value) g.rules.push({ allow: false, path: value });
      } else if (field === "allow") {
        if (value) g.rules.push({ allow: true, path: value });
      } else if (field === "crawl-delay") {
        const n = Number(value.replace(",", "."));
        if (Number.isFinite(n) && n > 0) g.crawlDelay = n;
      }
      groups.set(agent, g);
    }
  }

  const mine = groups.get(ROBOTS_TOKEN) ?? groups.get("*");
  return {
    rules: mine?.rules ?? [],
    crawlDelayMs: mine?.crawlDelay ? Math.round(mine.crawlDelay * 1000) : undefined,
  };
}

/**
 * Is `pathname` allowed by these rules? Longest matching pattern wins; on an
 * equal-length tie Allow wins (the standard's tie-break, and the permissive
 * direction only where the host was explicit).
 */
export function robotsAllows(policy: Pick<RobotsPolicy, "rules">, pathname: string): boolean {
  let best: { len: number; allow: boolean } | undefined;
  for (const rule of policy.rules) {
    if (!patternToRegex(rule.path).test(pathname)) continue;
    const len = rule.path.replace(/[*$]/g, "").length;
    if (!best || len > best.len || (len === best.len && rule.allow)) {
      best = { len, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}

async function loadRobots(origin: string): Promise<RobotsPolicy> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;

  let policy: RobotsPolicy;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      redirect: "follow",
      headers: { "User-Agent": PORTAL_USER_AGENT, Accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) {
      // No robots.txt at all = no restrictions (the standard's reading).
      policy = { rules: [], blockedByFailure: false, fetchedAt: Date.now() };
    } else if (!res.ok) {
      // 401/403/5xx: the host is telling us something we must not read past.
      policy = { rules: [], blockedByFailure: true, fetchedAt: Date.now() };
    } else {
      const text = (await res.text()).slice(0, 200_000);
      policy = { ...parseRobots(text), blockedByFailure: false, fetchedAt: Date.now() };
    }
  } catch {
    // Network/timeout: we cannot prove we are allowed, so we do not fetch.
    policy = { rules: [], blockedByFailure: true, fetchedAt: Date.now() };
  }
  robotsCache.set(origin, policy);
  return policy;
}

/** May we fetch this URL? Returns the reason (Hungarian) when the answer is no. */
export async function mayFetch(
  url: string,
): Promise<{ allowed: boolean; reason?: string; crawlDelayMs?: number }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { allowed: false, reason: "értelmezhetetlen URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { allowed: false, reason: `nem HTTP protokoll (${u.protocol})` };
  }
  const policy = await loadRobots(u.origin);
  if (policy.blockedByFailure) {
    return { allowed: false, reason: "a robots.txt nem olvasható — nem kockáztatunk" };
  }
  if (!robotsAllows(policy, u.pathname + u.search)) {
    return { allowed: false, reason: "a robots.txt tiltja ezt az útvonalat" };
  }
  return { allowed: true, crawlDelayMs: policy.crawlDelayMs };
}

/** Run `task` serialised against other tasks on the same host, with a gap after. */
function throttled<T>(host: string, gapMs: number, task: () => Promise<T>): Promise<T> {
  const prev = hostChain.get(host) ?? Promise.resolve();
  const run = prev.then(task, task);
  hostChain.set(
    host,
    run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, gapMs))),
  );
  return run;
}

/**
 * Charset from the Content-Type header or a <meta charset>, defaulting to UTF-8.
 * `wasDeclared` distinguishes "the page said UTF-8" from "nobody said anything and we
 * assumed UTF-8" — only the second may be second-guessed when the decode produces
 * replacement characters (see the caller).
 */
function charsetOf(contentType: string, head: Buffer): { charset: string; wasDeclared: boolean } {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return { charset: fromHeader.toLowerCase(), wasDeclared: true };
  const sniff = head.subarray(0, 2048).toString("latin1");
  const meta =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1] ??
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(sniff)?.[1];
  return meta
    ? { charset: meta.toLowerCase(), wasDeclared: true }
    : { charset: "utf-8", wasDeclared: false };
}

export interface PortalPage {
  readonly finalUrl: string;
  readonly html: string;
  readonly status: number;
  readonly renderedByBrowser: boolean;
}

/**
 * Fetch a portal page politely: robots-checked, host-serialised, size-capped and
 * charset-decoded (portal stock includes pre-UTF8 sites). Returns null with a
 * logged reason rather than throwing — one unreadable listing must never take a
 * scrape run down.
 */
export async function fetchPortalPage(
  url: string,
  opts: { gapMs?: number; render?: boolean } = {},
): Promise<{ page: PortalPage | null; reason?: string }> {
  const gate = await mayFetch(url);
  if (!gate.allowed) return { page: null, reason: gate.reason };

  const host = new URL(url).host;
  const gap = Math.max(opts.gapMs ?? DEFAULT_GAP_MS, gate.crawlDelayMs ?? 0);

  return throttled(host, gap, async () => {
    if (opts.render) {
      const rendered = await renderPage(url);
      if (rendered) return { page: rendered };
      return { page: null, reason: "a böngészős renderelés nem sikerült" };
    }
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": PORTAL_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "hu,en;q=0.6",
        },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!res.ok || !res.body) {
        return { page: null, reason: `HTTP ${res.status}` };
      }
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
      const buf = Buffer.concat(chunks);
      const declared = charsetOf(res.headers.get("content-type") ?? "", buf);
      let html: string;
      try {
        html = new TextDecoder(declared.charset).decode(buf);
      } catch {
        html = buf.toString("utf8"); // unknown label → best effort
      }
      // UNDECLARED + MOJIBAKE → retry as Central European. Measured on
      // turistautak.hu/poi.php (2026-08-31): no Content-Type charset, no <meta charset>,
      // and the bytes are ISO-8859-2 — so the UTF-8 default turned every Hungarian accent
      // into U+FFFD. We only second-guess a page that declared NOTHING, and only when the
      // decode visibly failed, so a correctly-labelled page is never re-interpreted.
      if (!declared.wasDeclared && /�/.test(html)) {
        try {
          const latin2 = new TextDecoder("iso-8859-2").decode(buf);
          if (!/�/.test(latin2)) html = latin2;
        } catch {
          /* keep the UTF-8 reading */
        }
      }
      return {
        page: { finalUrl: res.url, html, status: res.status, renderedByBrowser: false },
      };
    } catch (err) {
      return { page: null, reason: (err as Error).name === "TimeoutError" ? "időtúllépés" : "hálózati hiba" };
    }
  });
}

/**
 * Headless render — the escape hatch for portals whose listing body is built by
 * JavaScript. Opt-in per registry entry only; the seed portals all serve their
 * facts in the static HTML, so this stays cold on the normal path.
 */
async function renderPage(url: string): Promise<PortalPage | null> {
  const { chromium } = await import("playwright-core");
  let browser;
  try {
    browser = await chromium.launch({ executablePath: config.chromiumPath });
    const context = await browser.newContext({ userAgent: PORTAL_USER_AGENT, locale: "hu-HU" });
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    const html = await page.content();
    const finalUrl = page.url();
    const status = res?.status() ?? 0;
    await context.close();
    return { finalUrl, html, status, renderedByBrowser: true };
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
