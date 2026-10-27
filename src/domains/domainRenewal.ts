// THE OWN DOMAIN'S RENEWAL (ADR-0403, owner 2026-10-25).
//
// Measured 2026-10-25: overseer.hu sat in our Websupport account with `autoExtend: false` —
// nothing in code renewed a name, read its real expiry or watched it, so it would have
// lapsed on 2027-10-21 while the tenant kept paying the monthly domain fee (ADR-0109). At
// Websupport the only machine path to renewal is the service's auto-renew switch: the
// registrar pays the renewal from our credit before expiry. So renewal = keeping that switch
// in the RIGHT position, every day, and saying so when it cannot be kept there.
//
// The rule (owner 2026-10-25, verbatim intent):
//   • paying tenant → the switch is ON;
//   • the subscription ended (tenant cancelled OR 30 days of non-payment) → on that day:
//       ≥ RENEW_ONCE_DAYS left until expiry → OFF (no more renewal, the name lapses);
//       <  RENEW_ONCE_DAYS left → renewed ONCE more, then OFF.
//     Stored as site.domain_renew_end: no renewal past this expiry. A comeback clears it.
//   • the ended tenant's own domain answers with a redirect to our landing (public.ts).
//
// The daily sync (scripts/domain-renewal-sync.mts) reads the registrar, writes the measured
// expiry + switch to the site row, flips the switch where it is wrong, and records any
// problem on the row; the hourly stall watch alerts the house from that record.
//
// Operator text — outside the §B.18 customer-facing i18n scope.

import { db } from "../db/client.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import type { DomainService, RegistrarAdapter } from "./registrar/registrar.js";

/** Owner 2026-10-25: at least this many days to expiry at cancellation → no more renewal. */
export const RENEW_ONCE_DAYS = 90;
/** A name we renew that expires within this many days must be covered by the credit. */
export const RENEW_WARN_DAYS = 30;
/** Stage of the purchase from which the name is ours at the registrar. */
export const HELD_STATUSES = ["registered", "dns_pending", "tls_pending", "setup_retry", "live"] as const;

/**
 * Our own names. Owner 2026-10-27: the sync never touches them — citoviso.hu sits on the
 * `tls-proba` test tenant's provisioning row, and a cancelled subscription there would
 * switch OUR domain's renewal off. Their renewal is set by hand in the registrar account.
 */
export const HOUSE_DOMAINS: readonly string[] = ["citoviso.hu", PLATFORM_DOMAIN];

export function isHouseDomain(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return HOUSE_DOMAINS.some((h) => d === h || d.endsWith(`.${h}`));
}

const DAY = 86_400_000;

/**
 * The expiry past which an ended tenant's name is not renewed. ≥ RENEW_ONCE_DAYS left → the
 * current expiry itself (the switch goes off now). Fewer → one day past it, so the renewal
 * that moves the expiry a year on still happens, and the moved expiry turns the switch off.
 */
export function renewEndAtCancel(cancelledAt: Date, expiresAt: Date): Date {
  const left = expiresAt.getTime() - cancelledAt.getTime();
  return left >= RENEW_ONCE_DAYS * DAY ? expiresAt : new Date(expiresAt.getTime() + DAY);
}

/** Should the switch be on? NULL end = paying tenant. An unknown expiry under an end = off. */
export function wantAutoRenew(expiresAt: Date | null, renewEnd: Date | null): boolean {
  if (!renewEnd) return true;
  return expiresAt !== null && expiresAt.getTime() < renewEnd.getTime();
}

export interface RenewalRow {
  readonly siteId: string;
  readonly tenantId: string;
  readonly domain: string;
  /** When the purchase reached the registrar (the provisioning row's start). */
  readonly boughtAt: Date;
  readonly subscriptionStatus: string | null;
  readonly cancelledAt: Date | null;
  readonly renewEnd: Date | null;
}

export interface RenewalOutcome {
  readonly siteId: string;
  readonly domain: string;
  readonly service: DomainService | null;
  readonly renewEnd: Date | null;
  readonly want: boolean;
  /** The switch was flipped by this run (to `want`). */
  readonly flipped: boolean;
  readonly problems: string[];
}

/** A purchase this fresh may not be listed as a service yet — no alarm for it. */
const NEW_PURCHASE_GRACE_MS = DAY;

/**
 * Decide and act on one name. Pure apart from the registrar: reads the service, fixes the
 * stored end on a cancellation / comeback, flips the switch if it is wrong.
 */
export async function reconcileRenewal(row: RenewalRow, registrar: RegistrarAdapter, now: Date): Promise<RenewalOutcome> {
  const problems: string[] = [];
  let service: DomainService | null = null;
  try {
    service = await registrar.getService(row.domain);
  } catch (e) {
    problems.push(`a regisztrátor nem olvasható: ${(e as Error).message}`);
    return { siteId: row.siteId, domain: row.domain, service: null, renewEnd: row.renewEnd, want: true, flipped: false, problems };
  }

  const ended = row.subscriptionStatus === "cancelled";
  let renewEnd = row.renewEnd;
  if (!ended) renewEnd = null; // a comeback (or never ended): we renew
  else if (!renewEnd && service?.expiresAt) renewEnd = renewEndAtCancel(row.cancelledAt ?? now, service.expiresAt);

  if (!service) {
    // An ended tenant's name may be gone after its lapse — that is the rule working.
    if (!ended && now.getTime() - row.boughtAt.getTime() > NEW_PURCHASE_GRACE_MS) {
      problems.push("a név NINCS a regisztrátor-fiókunk szolgáltatásai között — nem tudjuk megújítani");
    }
    return { siteId: row.siteId, domain: row.domain, service, renewEnd, want: !ended, flipped: false, problems };
  }

  const want = wantAutoRenew(service.expiresAt, renewEnd);
  let flipped = false;
  if (service.autoRenew !== want) {
    try {
      service = await registrar.setAutoRenew(service.serviceRef, want);
      flipped = true;
    } catch (e) {
      problems.push(`az automatikus megújítás ${want ? "BEkapcsolása" : "KIkapcsolása"} nem sikerült: ${(e as Error).message}`);
    }
  }
  if (want && service.expiresAt && service.expiresAt.getTime() < now.getTime()) {
    problems.push(`a név ${isoDay(service.expiresAt)}-án LEJÁRT, és nem újult meg`);
  }
  return { siteId: row.siteId, domain: row.domain, service, renewEnd, want, flipped, problems };
}

/** The credit must cover every renewal due within RENEW_WARN_DAYS. Returns the problem, or null. */
export function creditProblem(outcomes: readonly RenewalOutcome[], credit: number | null, now: Date): string | null {
  const due = outcomes.filter(
    (o) => o.want && o.service?.expiresAt && o.service.expiresAt.getTime() - now.getTime() < RENEW_WARN_DAYS * DAY,
  );
  if (!due.length) return null;
  const need = due.reduce((s, o) => s + (o.service?.renewalPrice ?? 0), 0);
  if (credit !== null && credit >= need) return null;
  return (
    `a regisztrátor-kredit ${credit ?? "?"} Ft, a ${RENEW_WARN_DAYS} napon belül megújuló nevek ` +
    `(${due.map((o) => o.domain).join(", ")}) nettó ${need} Ft-ot vinnek — a megújítás a kreditből megy`
  );
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** The names we hold at the registrar, one row per site, with the subscription's state. */
export async function loadRenewalRows(): Promise<RenewalRow[]> {
  const rows = await db
    .selectFrom("domain_provisioning as dp")
    .innerJoin("site", "site.id", "dp.site_id")
    .leftJoin("subscription as sub", "sub.tenant_id", "dp.tenant_id")
    .select([
      "dp.site_id as siteId",
      "dp.tenant_id as tenantId",
      "dp.domain as domain",
      "dp.created_at as boughtAt",
      "sub.status as subscriptionStatus",
      "sub.cancelled_at as cancelledAt",
      "site.domain_renew_end as renewEnd",
    ])
    .where("dp.status", "in", [...HELD_STATUSES])
    .orderBy("dp.created_at", "desc")
    .execute();
  const seen = new Set<string>();
  const out: RenewalRow[] = [];
  for (const r of rows) {
    const k = `${r.siteId}|${r.domain.toLowerCase()}`;
    if (seen.has(k) || isHouseDomain(r.domain)) continue;
    seen.add(k);
    out.push({
      siteId: r.siteId,
      tenantId: r.tenantId,
      domain: r.domain.toLowerCase(),
      boughtAt: new Date(r.boughtAt as unknown as string),
      subscriptionStatus: r.subscriptionStatus ?? null,
      cancelledAt: r.cancelledAt ? new Date(r.cancelledAt as unknown as string) : null,
      renewEnd: r.renewEnd ? new Date(r.renewEnd as unknown as string) : null,
    });
  }
  return out;
}

/** One sync run: reconcile every held name, write the measurements, return the outcomes. */
export async function syncDomainRenewals(registrar: RegistrarAdapter, now: Date = new Date()): Promise<RenewalOutcome[]> {
  const rows = await loadRenewalRows();
  const outcomes: RenewalOutcome[] = [];
  for (const r of rows) outcomes.push(await reconcileRenewal(r, registrar, now));

  let credit: number | null = null;
  try {
    credit = await registrar.accountCredit();
  } catch {
    credit = null;
  }
  const short = creditProblem(outcomes, credit, now);
  for (const o of outcomes) {
    const due = o.want && o.service?.expiresAt && o.service.expiresAt.getTime() - now.getTime() < RENEW_WARN_DAYS * DAY;
    if (short && due) o.problems.push(short);
    await db
      .updateTable("site")
      .set({
        ...(o.service
          ? {
              domain_expires_at: (o.service.expiresAt ?? null) as never,
              registrar_service_ref: o.service.serviceRef,
              domain_auto_renew: o.service.autoRenew,
            }
          : {}),
        domain_renew_end: (o.renewEnd ?? null) as never,
        domain_renew_checked_at: now as never,
        domain_renew_problem: o.problems.length ? o.problems.join(" · ") : null,
      })
      .where("id", "=", o.siteId)
      .execute();
  }
  return outcomes;
}
