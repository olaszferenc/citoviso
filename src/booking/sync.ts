// Portal calendar sync — the half of the booking module that actually prevents
// double booking (ADR-0044/b).
//
// IMPORT: pull a portal's feed and mark those nights busy on OUR calendar, scoped
//   to `ical:<linkId>` so a portal can only ever add or release ITS OWN days.
// EXPORT: serve our calendar as a feed the portal can pull, so bookings taken here
//   close down there too.
//
// Only both directions together close the loop. Import alone still lets Booking.com
// sell a night a guest already took on the owner's own site.
//
// Fetching a URL the tenant supplied is an outbound request to an address we do not
// control, so it is treated as untrusted input (ADR-0367, Elek 2026-10-11 K2/K3):
//   - http(s) only, and only to a PUBLIC address: loopback, private, link-local, CGNAT,
//     metadata and the like are refused — checked on the resolved address (the DNS
//     lookup itself is the gate, so a name cannot resolve one way for the check and
//     another for the connect), and again on every redirect hop;
//   - a refused address answers with the SAME sentence as an unreachable one, so the
//     owner field cannot be used to map which internal ports are open;
//   - the size cap is enforced WHILE streaming: past the cap the download is cut, with
//     or without a content-length;
//   - a hard timeout per link, and the periodic run has bounded parallelism and an
//     overall budget (K8), so a hanging portal never holds up the expiry jobs.
// A portal being slow or broken must never hang the admin or fill the memory.

import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import { buildIcs, importIcsBlockedDays } from "./ical.js";
import { todayForUnit } from "../tenant/timeZone.js";
import { config } from "../config.js";
import { isPlatformHosting } from "../domains.js";
import {
  applyImportedDays,
  allImportLinks,
  claimLastingFailures,
  getBlockedDaysFrom,
  importSourcesOf,
  markConflictsNotified,
  recordSyncResult,
  reconcileConflicts,
  releaseFailureClaim,
} from "../tenant/availability.js";
import { sendOwnerSyncConflict, sendOwnerSyncFailing } from "./syncMail.js";

/** Feeds are small; anything larger is a misconfigured URL, not a calendar. */
export const MAX_FEED_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
/** K8: links synced at once in the periodic run. */
export const SYNC_PARALLEL = 6;
/** K8: the periodic run's overall budget — the expiry jobs come after it (unit limit 300 s). */
export const SYNC_BUDGET_MS = 120_000;
/** K7: a link failing without a break for this long gets the owner a mail (once). */
export const LASTING_FAILURE_HOURS = 24;

/** Owner-facing sentences (A2: a human sentence, never an HTTP status). */
export const SYNC_MSG = {
  badUrl: "A link nem érvényes webcím.",
  unreachable: "A link nem érhető el, vagy nem naptár. Másolja be újra a portál naptár-exportjának linkjét.",
  refused: "A portál most nem adja ki a naptárat ezen a linken. Ha a portálon új linket kapott, másolja be azt.",
  timeout: "A portál nem válaszolt időben.",
  tooBig: "A naptár szokatlanul nagy — ellenőrizze a linket.",
  notCalendar: "Ez a link nem naptár. A portálon a naptár-exportot keresse.",
  missing: "Hiányzik a link.",
} as const;

/**
 * A5: the parser notes that tell the owner something is MISSING or GUESSED. A skipped
 * cancelled booking, an empty calendar and a written-as-is timezone are the normal
 * shape of a portal feed (Szállás.hu writes TZID on every event) — counting them would
 * put a warning on every healthy card.
 */
export function ownerRelevantWarnings(warnings: readonly string[]): string[] {
  return warnings.filter((w) => !/STATUS:CANCELLED|nem tartalmaz VEVENT|TZID=/.test(w));
}

export interface SyncOutcome {
  readonly ok: boolean;
  readonly dayCount: number;
  /** Owner-facing message when ok === false. */
  readonly error?: string;
  readonly warnings: string[];
}

// ── address policy (K3) ──────────────────────────────────────────────────────

/**
 * Local tests point links at 127.0.0.1. Allowed ONLY with an explicit env switch AND
 * off the platform (dev): in production `publicSiteUrl` is the platform host, so the
 * switch does nothing there even if someone set it. And only LOOPBACK — private,
 * link-local and metadata addresses stay refused even in dev, so a test can still
 * prove that a redirect to one of them is stopped.
 */
export function privateTargetsAllowed(): boolean {
  return process.env.CALENDAR_SYNC_ALLOW_PRIVATE === "1" && !isPlatformHosting(config.publicSiteUrl);
}

function isLoopback(ip: string): boolean {
  return net.isIP(ip) === 4 ? inV4(ip, "127.0.0.0/8") : ip === "::1" || /^::ffff:127\./i.test(ip);
}

/** The policy: a non-public address is refused (dev loopback exception aside). */
export function refusedAddress(ip: string): boolean {
  return isBlockedAddress(ip) && !(privateTargetsAllowed() && isLoopback(ip));
}

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/") as [string, string];
  const n = Number(bits);
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", // "this" network
  "10.0.0.0/8", // private
  "100.64.0.0/10", // CGNAT (Tailscale lives here)
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local + cloud metadata 169.254.169.254
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved + broadcast
];

/** Expand an IPv6 address to its 8 hextets (handles `::` and an embedded IPv4 tail). */
function v6Hextets(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const n = v4ToInt(v4[1]!);
    s = s.slice(0, -v4[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const all = [...h, ...Array(Math.max(0, fill)).fill("0"), ...t];
  if (all.length !== 8) return null;
  const out = all.map((x) => parseInt(x || "0", 16));
  return out.some((x) => Number.isNaN(x) || x < 0 || x > 0xffff) ? null : out;
}

/** True when an address must never be fetched: anything not on the public internet. */
export function isBlockedAddress(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return BLOCKED_V4.some((c) => inV4(ip, c));
  if (fam !== 6) return true;
  const h = v6Hextets(ip);
  if (!h) return true;
  // IPv4-mapped / -compatible / NAT64 / 6to4: judge the embedded IPv4.
  const embedded = (a: number, b: number): string => `${a >>> 8}.${a & 0xff}.${b >>> 8}.${b & 0xff}`;
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) {
    if (h[5] === 0 && h[6] === 0 && (h[7] ?? 0) <= 1) return true; // :: and ::1
    return isBlockedAddress(embedded(h[6]!, h[7]!));
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) return isBlockedAddress(embedded(h[6]!, h[7]!)); // NAT64
  if (h[0] === 0x2002) return isBlockedAddress(embedded(h[1]!, h[2]!)); // 6to4
  const first = h[0]!;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (first === 0x2001 && h[1] === 0x0db8) return true; // documentation
  if (first === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true; // discard-only
  return false;
}

class BlockedTarget extends Error {}

/**
 * The connect-time gate: resolve, and refuse when ANY resolved address is non-public.
 * Used as the socket's `lookup`, so the address we check is the address we connect to.
 */
function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  cb: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err, "", 0);
    const list = addrs as dns.LookupAddress[];
    if (!list.length) return cb(new Error("no address") as NodeJS.ErrnoException, "", 0);
    if (list.some((a) => refusedAddress(a.address))) {
      return cb(new BlockedTarget(hostname) as NodeJS.ErrnoException, "", 0);
    }
    if (options.all) return cb(null, list);
    return cb(null, list[0]!.address, list[0]!.family);
  });
}

// ── download ─────────────────────────────────────────────────────────────────

type Fetched = { text: string; error?: undefined } | { text?: undefined; error: string };

/** One hop: GET, streamed with a byte cap. Resolves with a redirect target or the body. */
function getOnce(
  target: URL,
  signal: AbortSignal,
): Promise<{ redirect: string } | { status: number } | { body: string } | { error: string }> {
  return new Promise((resolve) => {
    const host = target.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && refusedAddress(host)) {
      return resolve({ error: SYNC_MSG.unreachable });
    }
    const mod = target.protocol === "https:" ? https : http;
    let settled = false;
    const done = (v: Parameters<typeof resolve>[0]): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const req = mod.get(
      target,
      {
        signal,
        lookup: safeLookup as unknown as net.LookupFunction,
        headers: {
          "User-Agent": "citoviso-bot/0.1 (+https://citoviso.com)",
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
        },
      },
      (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          return done({ redirect: String(res.headers.location) });
        }
        if (code < 200 || code >= 300) {
          res.resume();
          return done({ status: code });
        }
        const len = Number(res.headers["content-length"] ?? "0");
        if (len > MAX_FEED_BYTES) {
          res.destroy();
          return done({ error: SYNC_MSG.tooBig });
        }
        // K2: count WHILE reading — the cap must hold without a content-length too.
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_FEED_BYTES) {
            chunks.length = 0;
            res.destroy();
            req.destroy();
            return done({ error: SYNC_MSG.tooBig });
          }
          chunks.push(c);
        });
        res.on("end", () => done({ body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", () => done({ error: signal.aborted ? SYNC_MSG.timeout : SYNC_MSG.unreachable }));
      },
    );
    req.on("error", (err) => {
      if (signal.aborted) return done({ error: SYNC_MSG.timeout });
      // K3: a refused address and a closed port read the same to the owner.
      void err;
      done({ error: SYNC_MSG.unreachable });
    });
  });
}

/** Download a calendar feed defensively. Never throws — returns a plain outcome. */
export async function fetchFeed(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Fetched> {
  if (!/^https?:\/\//i.test(url)) return { error: SYNC_MSG.badUrl };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      return { error: SYNC_MSG.badUrl };
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (current.protocol !== "http:" && current.protocol !== "https:") return { error: SYNC_MSG.unreachable };
      const r = await getOnce(current, ac.signal);
      if ("error" in r) return { error: r.error };
      if ("status" in r) return { error: SYNC_MSG.refused };
      if ("redirect" in r) {
        try {
          current = new URL(r.redirect, current);
        } catch {
          return { error: SYNC_MSG.unreachable };
        }
        continue;
      }
      if (!/BEGIN:VCALENDAR/i.test(r.body)) {
        // The most common owner mistake: pasting the listing page instead of the feed.
        return { error: SYNC_MSG.notCalendar };
      }
      return { text: r.body };
    }
    return { error: SYNC_MSG.unreachable };
  } finally {
    clearTimeout(timer);
  }
}

// ── one link ─────────────────────────────────────────────────────────────────

/**
 * Pull one link's feed and apply it. The result is recorded on the link row and in its
 * short log so the admin can state plainly what happened. A failed sync changes no
 * night: the nights it brought last time stay in force until a successful one.
 */
export async function syncCalendarLink(
  linkId: string,
  unitId: string,
  url: string | null,
  opts: { timeoutMs?: number; publicBaseUrl?: string | null } = {},
): Promise<SyncOutcome> {
  const started = Date.now();
  if (!url) {
    await recordSyncResult(linkId, { ok: false, dayCount: null, error: SYNC_MSG.missing, ms: 0 });
    return { ok: false, dayCount: 0, error: SYNC_MSG.missing, warnings: [] };
  }
  const got = await fetchFeed(url, opts.timeoutMs);
  if (got.error !== undefined) {
    await recordSyncResult(linkId, { ok: false, dayCount: null, error: got.error, ms: Date.now() - started });
    return { ok: false, dayCount: 0, error: got.error, warnings: [] };
  }

  const parsed = importIcsBlockedDays(got.text);
  const out = await applyImportedDays(linkId, unitId, parsed.days);
  await recordSyncResult(linkId, {
    ok: true,
    dayCount: out.taken,
    error: null,
    warnings: ownerRelevantWarnings(parsed.warnings),
    before: out.before,
    ms: Date.now() - started,
  });

  // K1: a night we already sold came in from the portal — nothing is deleted, the owner
  // decides. One mail per NEW conflict; a mail failure leaves them untold for the next run.
  const untold = await reconcileConflicts(linkId, out.conflicts);
  if (untold.length) {
    try {
      await sendOwnerSyncConflict(linkId, untold);
      await markConflictsNotified(linkId, untold);
    } catch (err) {
      console.error(`[booking:sync] ütközés-levél NEM ment ki (${linkId}):`, err);
    }
  }
  return { ok: true, dayCount: out.taken, warnings: parsed.warnings };
}

// ── the periodic run ─────────────────────────────────────────────────────────

export interface SyncAllResult {
  readonly links: number;
  readonly ok: number;
  readonly failed: number;
  /** K8: links not reached inside the budget — they go first next hour (oldest sync first). */
  readonly skipped: number;
  /** K7: owners mailed about a lasting failure in this run. */
  readonly alerted: number;
}

/**
 * Sync every connected portal calendar. Drives the periodic job; never throws.
 * K8: at most SYNC_PARALLEL at once, oldest-synced first, and no new link is started
 * once the budget is spent — a few hanging feeds cannot hold up the expiry jobs.
 */
export async function syncAllCalendarLinks(
  opts: { parallel?: number; budgetMs?: number; timeoutMs?: number } = {},
): Promise<SyncAllResult> {
  const parallel = Math.max(1, opts.parallel ?? SYNC_PARALLEL);
  const budget = opts.budgetMs ?? SYNC_BUDGET_MS;
  const links = (await allImportLinks()).sort(
    (a, b) => (a.lastSyncAt?.getTime() ?? 0) - (b.lastSyncAt?.getTime() ?? 0),
  );
  const deadline = Date.now() + budget;
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < links.length) {
      const l = links[next++]!;
      const left = deadline - Date.now();
      if (left <= 1000) {
        skipped++;
        continue;
      }
      try {
        // A link never runs past the run's budget either.
        const out = await syncCalendarLink(l.id, l.unitId, l.url, {
          timeoutMs: Math.min(opts.timeoutMs ?? FETCH_TIMEOUT_MS, left),
        });
        if (out.ok) ok++;
        else failed++;
      } catch (err) {
        failed++;
        await recordSyncResult(l.id, {
          ok: false,
          dayCount: null,
          error: (err as Error).message.slice(0, 200),
        }).catch(() => undefined);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, links.length) }, worker));

  const alerted = await alertLastingFailures();
  return { links: links.length, ok, failed, skipped, alerted };
}

/** K7: mail the owner of every link failing for a day — once, until it heals. */
export async function alertLastingFailures(hours = LASTING_FAILURE_HOURS): Promise<number> {
  let sent = 0;
  for (const l of await claimLastingFailures(hours)) {
    try {
      await sendOwnerSyncFailing(l);
      sent++;
    } catch (err) {
      console.error(`[booking:sync] tartós-hiba levél NEM ment ki (${l.id}):`, err);
      await releaseFailureClaim(l.id);
    }
  }
  return sent;
}

// ── export ───────────────────────────────────────────────────────────────────

/**
 * Our own outgoing feed for a unit: every blocked night from today on.
 * A6: addressed to one portal (`provider`), it leaves out the nights that portal
 * sent us — handing them back would keep a night the portal cancelled closed there.
 * A7: DTSTAMP is the generation time (RFC 5545 §3.8.7.2); UIDs stay stable, so a
 * portal still sees an unchanged calendar as unchanged events.
 */
export async function buildUnitFeed(unitId: string, unitName: string, provider?: string | null): Promise<string> {
  const today = await todayForUnit(unitId); // the accommodation's today (ADR-0290)
  const exclude = provider ? await importSourcesOf(unitId, provider) : [];
  const days = await getBlockedDaysFrom(unitId, today, exclude);
  return buildIcs({
    unitName,
    blockedDays: days,
    dtstamp: new Date(),
  });
}
