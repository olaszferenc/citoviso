// Automatic Search Console submission of every live lodging site (ADR-XXXX).
//
// RECONCILIATION, not a call inside the go-live code paths. The trial start, the purchase
// and the custom-domain flip only change `site` — this tick (citoviso-search-console.timer)
// reads what is live and brings Google in line, so:
//   • a Google outage / quota / missing key can NEVER fail a trial start, a purchase or a
//     domain going live (they do not even know this exists);
//   • it is idempotent: one row per (site, address) — UNIQUE(site_id, kind) — and a
//     sitemap is submitted again only when its <loc> set changed (trigger ③);
//   • a failure retries with backoff, and after MAX_SILENT_FAILURES the house gets ONE mail.
//
// Triggers (owner decision 2026-11-03):
//   ① <slug>.citoviso.com — when site.status becomes 'live' (trial or purchase, whichever
//      comes first), under the ONE Domain property sc-domain:citoviso.com.
//   ② own domain — when site.custom_domain is set (provisionDomain flips it exactly when
//      DNS + TLS are measured OK → custom_domain_status 'live'), under sc-domain:<domain>,
//      which the service account verifies itself via a DNS TXT in the zone WE run
//      (Websupport, ADR-0103 terv-B). From then on the slug host 301s to the own domain, so
//      its row is RETIRED (a redirecting sitemap would be reported "Couldn't fetch").
//   ③ the sitemap's <loc> set changed (new unit subpage, new paid language) → re-submit.
//
// ⛔ The REAL Google client is built only on the live host (scripts/search-console-tick.mts);
// dev runs the same code against the recording mock and its local public server.

import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import type { DnsAdapter } from "../domains/dns/dns.js";
import type { GoogleCall, SearchConsoleClient } from "./googleSearchConsole.js";

/** How often an already submitted sitemap is re-read for changes (trigger ③). */
export const RECHECK_MS = 6 * 3600_000;
/** After the TXT is written, give the zone this long before asking Google to check it. */
export const TXT_SETTLE_MS = 5 * 60_000;
/** The house hears about a target after this many consecutive failures — once. */
export const MAX_SILENT_FAILURES = 5;
/** Targets handled per tick: each costs ≤ 5 Google calls, the quota is 200 QPM per user. */
export const PER_TICK = 30;

/** Retry delay after the n-th consecutive failure: 15 min, 30, 60 … capped at 24 h. */
export function backoffMs(attempts: number): number {
  return Math.min(15 * 60_000 * 2 ** Math.max(0, attempts - 1), 24 * 3600_000);
}

export interface SitemapFetch {
  /** HTTP status; 0 = transport error. */
  readonly status: number;
  readonly body: string;
}

export interface TickDeps {
  readonly client: SearchConsoleClient;
  readonly dns: DnsAdapter;
  /** Read https://<host>/sitemap.xml exactly as Google would (no redirect following). */
  readonly fetchSitemap: (host: string) => Promise<SitemapFetch>;
  readonly platformProperty: string;
  readonly ownerEmails: readonly string[];
  readonly now?: () => Date;
  readonly alert?: (subject: string, text: string) => Promise<boolean>;
  /** Restrict to these sites (the check's fixture) — default: every live site. */
  readonly siteIds?: readonly string[];
}

export interface TickResult {
  readonly planned: number;
  readonly retired: number;
  readonly submitted: string[];
  readonly unchanged: number;
  readonly waiting: string[];
  readonly failed: string[];
}

/** The <loc> set of a sitemap, sorted — null when the body is not a urlset at all. */
export function sitemapLocs(body: string): string[] | null {
  if (!/<urlset[\s>]/.test(body)) return null;
  return [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!).sort();
}

export const locsHash = (locs: readonly string[]): string =>
  createHash("sha256").update(locs.join("\n")).digest("hex");

interface Desired {
  readonly siteId: string;
  readonly kind: "platform" | "custom";
  readonly host: string;
  readonly property: string;
  readonly sitemapUrl: string;
}

/** Pure: which addresses of a live site should be in Search Console right now. */
export function desiredTargets(
  site: { id: string; slug: string | null; customDomain: string | null; customDomainStatus: string },
  platformProperty: string,
): Desired[] {
  const out: Desired[] = [];
  const custom = site.customDomain && site.customDomainStatus === "live" ? site.customDomain.toLowerCase() : null;
  if (site.slug && !custom) {
    const host = `${site.slug.toLowerCase()}.${PLATFORM_DOMAIN}`;
    out.push({ siteId: site.id, kind: "platform", host, property: platformProperty, sitemapUrl: `https://${host}/sitemap.xml` });
  }
  if (custom) {
    out.push({
      siteId: site.id,
      kind: "custom",
      host: custom,
      property: `sc-domain:${custom}`,
      sitemapUrl: `https://${custom}/sitemap.xml`,
    });
  }
  return out;
}

async function logEvent(
  live: boolean,
  e: { targetId?: string | null; property?: string | null; action: string; call: GoogleCall },
): Promise<void> {
  await db
    .insertInto("search_console_event")
    .values({
      target_id: e.targetId ?? null,
      property: e.property ?? null,
      action: e.action,
      ok: e.call.ok,
      http_status: e.call.status || null,
      detail: e.call.detail.slice(0, 2000),
      live,
    })
    .execute();
}

/** Bring the desired set into the table: new rows, changed addresses, retired slug rows. */
async function plan(deps: TickDeps, now: Date): Promise<{ planned: number; retired: number }> {
  let q = db
    .selectFrom("site")
    .select(["id", "slug", "custom_domain as customDomain", "custom_domain_status as customDomainStatus"])
    .where("status", "=", "live");
  if (deps.siteIds) q = q.where("id", "in", deps.siteIds.length ? [...deps.siteIds] : ["00000000-0000-0000-0000-000000000000"]);
  const sites = await q.execute();
  let planned = 0;
  let retired = 0;
  for (const s of sites) {
    const want = desiredTargets(s, deps.platformProperty);
    for (const d of want) {
      // New → pending. Same (site, kind) but a different address (a changed slug or
      // domain) → back to pending with no submitted hash; untouched otherwise.
      const r = await db
        .insertInto("search_console_target")
        .values({ site_id: d.siteId, kind: d.kind, host: d.host, property: d.property, sitemap_url: d.sitemapUrl, next_attempt_at: now })
        .onConflict((oc) =>
          oc.columns(["site_id", "kind"]).doUpdateSet({
            host: d.host,
            property: d.property,
            sitemap_url: d.sitemapUrl,
            status: sql<"pending">`case when search_console_target.sitemap_url = excluded.sitemap_url and search_console_target.status <> 'retired' then search_console_target.status else 'pending' end`,
            submitted_hash: sql<string | null>`case when search_console_target.sitemap_url = excluded.sitemap_url then search_console_target.submitted_hash else null end`,
            attempts: sql<number>`case when search_console_target.sitemap_url = excluded.sitemap_url and search_console_target.status <> 'retired' then search_console_target.attempts else 0 end`,
            next_attempt_at: sql<Date>`case when search_console_target.sitemap_url = excluded.sitemap_url and search_console_target.status <> 'retired' then search_console_target.next_attempt_at else excluded.next_attempt_at end`,
            updated_at: sql<Date>`case when search_console_target.sitemap_url = excluded.sitemap_url and search_console_target.status <> 'retired' then search_console_target.updated_at else now() end`,
          }),
        )
        .returning(sql<boolean>`(xmax = 0)`.as("inserted"))
        .executeTakeFirst();
      if (r?.inserted) planned++;
    }
    // ② the own domain is live → the slug address 301s there: retire its row.
    if (!want.some((d) => d.kind === "platform")) {
      const gone = await db
        .updateTable("search_console_target")
        .set({ status: "retired", updated_at: new Date(), last_error: null })
        .where("site_id", "=", s.id)
        .where("kind", "=", "platform")
        .where("status", "<>", "retired")
        .returning(["id", "property"])
        .execute();
      for (const g of gone) {
        retired++;
        await logEvent(deps.client.live, {
          targetId: g.id,
          property: g.property,
          action: "retire",
          call: { ok: true, status: 0, detail: "a saját domain élő — a citoviso.com-os cím 301-gyel oda visz" },
        });
      }
    }
  }
  return { planned, retired };
}

type PropertyReady = { ready: true } | { ready: false; wait: boolean; error: string };

/** Is the property verified and added for the service account? Drives it there for own domains. */
async function ensureProperty(deps: TickDeps, targetId: string, kind: "platform" | "custom", property: string, now: Date): Promise<PropertyReady> {
  const live = deps.client.live;
  let prop = await db.selectFrom("search_console_property").selectAll().where("property", "=", property).executeTakeFirst();
  if (kind === "platform") {
    // One-time setup (scripts/search-console-setup.mts) — the tick never verifies citoviso.com.
    if (prop?.verified_at && prop.added_at) return { ready: true };
    return { ready: false, wait: true, error: `beállításra vár: a(z) ${property} tulajdon nincs ellenőrizve (scripts/search-console-setup.mts)` };
  }
  const domain = property.replace(/^sc-domain:/, "");
  if (!prop) {
    await db.insertInto("search_console_property").values({ property, kind: "custom" }).onConflict((oc) => oc.column("property").doNothing()).execute();
    prop = await db.selectFrom("search_console_property").selectAll().where("property", "=", property).executeTakeFirstOrThrow();
  }
  const setProp = (v: Record<string, unknown>) =>
    db.updateTable("search_console_property").set({ ...v, updated_at: now }).where("property", "=", property).execute();

  let token = prop.verify_token;
  if (!token) {
    const r = await deps.client.getDomainToken(domain);
    await logEvent(live, { targetId, property, action: "verify_token", call: r });
    if (!r.ok || !r.token) {
      await setProp({ last_error: `getToken: ${r.detail}` });
      return { ready: false, wait: false, error: `ellenőrző token: HTTP ${r.status} ${r.detail}` };
    }
    token = r.token;
    await setProp({ verify_token: token });
  }
  let txtAt = prop.txt_written_at ? new Date(prop.txt_written_at as unknown as string) : null;
  if (!txtAt) {
    try {
      await deps.dns.ensureApexTxt(domain, token);
      await logEvent(live, { targetId, property, action: "dns_txt", call: { ok: true, status: 0, detail: `TXT @ ${domain} (${deps.dns.name})` } });
      txtAt = now;
      await setProp({ txt_written_at: now });
    } catch (e) {
      const msg = (e as Error).message;
      await logEvent(live, { targetId, property, action: "dns_txt", call: { ok: false, status: 0, detail: msg } });
      await setProp({ last_error: `TXT: ${msg}` });
      return { ready: false, wait: false, error: `TXT-rekord: ${msg}` };
    }
  }
  if (!prop.verified_at) {
    if (now.getTime() - txtAt.getTime() < TXT_SETTLE_MS) {
      return { ready: false, wait: true, error: "a TXT-rekord terjedésére vár" };
    }
    const r = await deps.client.verifyDomain(domain, deps.ownerEmails);
    await logEvent(live, { targetId, property, action: "verify", call: r });
    if (!r.ok) {
      await setProp({ last_error: `verify: ${r.detail}` });
      return { ready: false, wait: false, error: `ellenőrzés: HTTP ${r.status} ${r.detail}` };
    }
    await setProp({ verified_at: now, last_error: null });
  }
  if (!prop.added_at) {
    const r = await deps.client.addSite(property);
    await logEvent(live, { targetId, property, action: "add_site", call: r });
    if (!r.ok) {
      await setProp({ last_error: `sites.add: ${r.detail}` });
      return { ready: false, wait: false, error: `sites.add: HTTP ${r.status} ${r.detail}` };
    }
    await setProp({ added_at: now, last_error: null });
  }
  return { ready: true };
}

interface TargetRow {
  id: string;
  site_id: string;
  kind: "platform" | "custom";
  host: string;
  property: string;
  sitemap_url: string;
  status: string;
  submitted_hash: string | null;
  attempts: number;
  alerted_at: unknown;
}

type Outcome = "submitted" | "unchanged" | "waiting" | "failed";

async function processTarget(deps: TickDeps, t: TargetRow, now: Date): Promise<Outcome> {
  const live = deps.client.live;
  const upd = (v: Record<string, unknown>) =>
    db.updateTable("search_console_target").set({ ...v, updated_at: now }).where("id", "=", t.id).execute();

  const fail = async (error: string): Promise<Outcome> => {
    const attempts = t.attempts + 1;
    await upd({
      status: t.status === "submitted" ? "submitted" : "pending",
      attempts,
      last_error: error,
      checked_at: now,
      next_attempt_at: new Date(now.getTime() + backoffMs(attempts)),
    });
    if (attempts >= MAX_SILENT_FAILURES && !t.alerted_at && deps.alert) {
      const sent = await deps.alert(
        `Citoviso: a(z) ${t.host} oldalt ${attempts}. próbára sem sikerült beküldeni a Google-nek`,
        `A Search Console-beküldés (ADR-XXXX) ${attempts} egymás utáni próbán át hibázott.\n\n` +
          `Cím: ${t.sitemap_url}\nTulajdon: ${t.property}\nUtolsó hiba: ${error}\n\n` +
          `Az oldal működik, a vendégek elérik — csak a Google-nek nem jeleztük, hogy létezik. ` +
          `Az időzítő tovább próbálkozik (legfeljebb naponta), ez a levél egyszer jön.\n` +
          `Napló: search_console_event (target_id = ${t.id}).\n`,
      );
      if (sent) await upd({ alerted_at: now });
    }
    return "failed";
  };

  // 1) The sitemap as Google will see it — also proves the address serves THIS site.
  let sm: SitemapFetch;
  try {
    sm = await deps.fetchSitemap(t.host);
  } catch (e) {
    sm = { status: 0, body: (e as Error).message };
  }
  const locs = sm.status === 200 ? sitemapLocs(sm.body) : null;
  const ownLocs = locs?.every((l) => l.startsWith(`https://${t.host}/`)) ?? false;
  if (!locs || locs.length === 0 || !ownLocs) {
    const why = sm.status !== 200 ? (sm.status ? `HTTP ${sm.status}` : `nem elérhető (${sm.body.slice(0, 200)})`) : !locs ? "nem sitemap (nincs <urlset>)" : locs.length === 0 ? "üres sitemap" : "idegen hoszt a <loc>-ban";
    await logEvent(live, { targetId: t.id, property: t.property, action: "sitemap_fetch", call: { ok: false, status: sm.status, detail: `${t.sitemap_url}: ${why}` } });
    return fail(`sitemap: ${why}`);
  }
  const hash = locsHash(locs);
  if (t.status === "submitted" && t.submitted_hash === hash) {
    await upd({ checked_at: now, next_attempt_at: new Date(now.getTime() + RECHECK_MS), attempts: 0, last_error: null });
    return "unchanged";
  }

  // 2) The property must be ours (verified + added) before a sitemap can go under it.
  const prop = await ensureProperty(deps, t.id, t.kind, t.property, now);
  if (!prop.ready) {
    if (prop.wait) {
      // Not a failure of this target — no backoff growth, no alert; look again soon.
      await upd({ last_error: prop.error, checked_at: now, next_attempt_at: new Date(now.getTime() + (t.kind === "platform" ? 3600_000 : TXT_SETTLE_MS)) });
      return "waiting";
    }
    return fail(prop.error);
  }

  // 3) Submit.
  const r = await deps.client.submitSitemap(t.property, t.sitemap_url);
  await logEvent(live, { targetId: t.id, property: t.property, action: "submit", call: { ...r, detail: `${locs.length} URL · ${r.detail}` } });
  if (!r.ok) return fail(`sitemaps.submit: HTTP ${r.status} ${r.detail}`);
  await upd({
    status: "submitted",
    submitted_hash: hash,
    submitted_at: now,
    attempts: 0,
    last_error: null,
    alerted_at: null,
    checked_at: now,
    next_attempt_at: new Date(now.getTime() + RECHECK_MS),
  });
  return "submitted";
}

/** One reconciliation pass. Never throws for a single target's failure. */
export async function runSearchConsoleTick(deps: TickDeps): Promise<TickResult> {
  const now = (deps.now ?? (() => new Date()))();
  const { planned, retired } = await plan(deps, now);

  let q = db
    .selectFrom("search_console_target as t")
    .innerJoin("site as s", "s.id", "t.site_id")
    .select(["t.id", "t.site_id", "t.kind", "t.host", "t.property", "t.sitemap_url", "t.status", "t.submitted_hash", "t.attempts", "t.alerted_at"])
    .where("s.status", "=", "live")
    .where("t.status", "in", ["pending", "submitted"])
    .where("t.next_attempt_at", "<=", now)
    .orderBy("t.next_attempt_at")
    .limit(PER_TICK);
  if (deps.siteIds) q = q.where("t.site_id", "in", deps.siteIds.length ? [...deps.siteIds] : ["00000000-0000-0000-0000-000000000000"]);
  const due = (await q.execute()) as TargetRow[];

  const res = { planned, retired, submitted: [] as string[], unchanged: 0, waiting: [] as string[], failed: [] as string[] };
  for (const t of due) {
    let o: Outcome;
    try {
      o = await processTarget(deps, t, now);
    } catch (e) {
      // A DB/programming error on one row must not stop the others.
      console.error(`[search-console] ${t.sitemap_url}: ${(e as Error).message}`);
      o = "failed";
    }
    if (o === "submitted") res.submitted.push(t.sitemap_url);
    else if (o === "unchanged") res.unchanged++;
    else if (o === "waiting") res.waiting.push(t.sitemap_url);
    else res.failed.push(t.sitemap_url);
  }
  return res;
}
