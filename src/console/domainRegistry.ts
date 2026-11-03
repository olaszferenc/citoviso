// THE DOMAIN REGISTRY — every name we bought and hold, in one place (SUB-E, owner 2026-11-03:
// „kell valahova egy rész a kezelt domainekről: mit vettünk meg, lejárat, melyik tenant
// használja, mik a statisztikái, folyamat: megvettük, regisztráltuk, bejegyezték, beköltöztünk”).
//
// DATA ONLY — no labels, no HTML. The /domains view and the partner page (SUB-C) render it;
// both read the SAME record, so the list and the partner block can never disagree.
//
// Sources (nothing here is invented — an unmeasured step stays `at: null`, §B.17):
//   domain_provisioning — the beszerzés truth (one row per purchase attempt; the newest per
//                         name wins), its waits, alerts and the registry trail (0122)
//   site                — the held name's expiry / auto-renew as MEASURED at the registrar (0114)
//   order_intent + payment — when it was ordered and paid
//   tenant / partner    — who uses it (partner.tenant_id)
//   pricing (domain_tld) — the purchase cost; the monthly fee by the SAME rule billing uses
//                         (domainFeeForCycle over the tenant's renewable modules), so "covered
//                         by the package" here means exactly "no domain line on the invoice"

import { db } from "../db/client.js";
import { config } from "../config.js";
import { domainFeeForCycle, loadPricing, offeredTldOf } from "../pricing.js";
import { renewableModuleIds } from "../payment/billing.js";
import { getDisabledModules } from "../moduleSales.js";
import { isHouseDomain } from "../domains/domainRenewal.js";

const DAY = 86_400_000;

/** The life path, in order. `confirm` exists only for .hu (the registry's e-mail confirmation). */
export type DomainStepKey = "ordered" | "paid" | "bought" | "confirm" | "ns" | "tls" | "live";
export type DomainStepState = "done" | "current" | "stuck" | "todo";

export interface DomainStep {
  readonly key: DomainStepKey;
  /** Measured time of the step; null = not measured (the view says „nincs adat”). */
  readonly at: Date | null;
  readonly state: DomainStepState;
  /**
   * Why `at` is null on a done step — a machine reason the view words:
   *  house      = our own name, bought by hand (no order, no payment)
   *  untracked  = the step happened, but its time is not stored (TLS; pre-0112 NS; confirm before 0122)
   */
  readonly gap?: "house" | "untracked";
}

/** How the domain's running cost is covered for the tenant. */
export type DomainCover = "house" | "package" | "fee" | "settled";

/** Why a row asks for attention (the „Figyelmet kér” filter); empty = fine. */
export type DomainAttention =
  | "failed"
  | "stuck_24h"
  | "stuck_72h"
  | "registrar_note"
  | "expires_60"
  | "expires_30"
  | "expires_7"
  | "renew_problem"
  | "subscription_ended";

export interface DomainRecord {
  readonly provisioningId: string;
  readonly siteId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly tenantStatus: "active" | "suspended" | "closed";
  readonly slug: string | null;
  readonly partnerId: string | null;
  readonly partnerName: string | null;
  readonly domain: string;
  /** ".hu" — the last label. */
  readonly tld: string;
  /** Our own name (citoviso.hu …): renewal set by hand, kept out of cost/turnaround stats. */
  readonly house: boolean;
  /** The configured registrar provider (one per installation today). */
  readonly registrar: string;
  readonly registrarRef: string | null;
  readonly serviceRef: string | null;
  readonly status: string;
  readonly error: string | null;
  readonly orderIntentId: string | null;
  readonly orderKind: string | null;
  readonly steps: readonly DomainStep[];
  /** Since when the setup waits (NS delegation / certificate); null when not waiting. */
  readonly waitingSince: Date | null;
  /** 0 none · 1 = 24 h operator alert sent · 2 = 72 h alert + tenant mail. */
  readonly stuckStage: number;
  readonly delayNoticeAt: Date | null;
  readonly registrarNote: string | null;
  readonly registrarNoteAt: Date | null;
  /** Measured at the registrar by the daily sync; until its first run, purchase + 1 year. */
  readonly expiresAt: Date | null;
  /** True while the daily renewal sync has not read this name yet (the expiry is the estimate). */
  readonly expiryEstimated: boolean;
  readonly autoRenew: boolean | null;
  /** Set when the subscription ended: no renewal past this expiry. */
  readonly renewEnd: Date | null;
  readonly renewCheckedAt: Date | null;
  readonly renewProblem: string | null;
  readonly cover: DomainCover;
  /** Monthly fee the tenant pays for the name (0 = package content / house). Market currency. */
  readonly monthlyFee: number;
  /** NET yearly purchase / renewal cost at the registrar; null = never measured. */
  readonly costNet: number | null;
  readonly costCurrency: string | null;
  readonly attention: readonly DomainAttention[];
  /** Whole days to expiry (negative = lapsed); null = unknown. */
  readonly daysLeft: number | null;
}

/** The order's/paid times and the trail, as one flat row — the query's shape. */
interface Row {
  id: string;
  site_id: string;
  tenant_id: string;
  order_intent_id: string | null;
  domain: string;
  status: string;
  registrar_ref: string | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
  waiting_since: Date | null;
  stuck_stage: number;
  delay_notice_at: Date | null;
  ns_active_at: Date | null;
  registrar_note: string | null;
  registrar_note_at: Date | null;
  bought_notice_at: Date | null;
  confirm_link_at: Date | null;
  registry_recorded_at: Date | null;
  slug: string | null;
  domain_expires_at: Date | null;
  registrar_service_ref: string | null;
  domain_auto_renew: boolean | null;
  domain_renew_end: Date | null;
  domain_renew_checked_at: Date | null;
  domain_renew_problem: string | null;
  tenant_name: string;
  tenant_status: "active" | "suspended" | "closed";
  partner_id: string | null;
  partner_name: string | null;
  order_kind: string | null;
  ordered_at: Date | null;
  paid_at: Date | null;
  settled: boolean | null;
}

const ORDER: readonly DomainStepKey[] = ["ordered", "paid", "bought", "confirm", "ns", "tls", "live"];

/** The step the row is waiting on (null = live: every step done). */
function currentStep(status: string, hu: boolean, boughtSeen: boolean): DomainStepKey | null {
  switch (status) {
    case "pending":
    case "registering":
      return "bought";
    case "registered":
    case "dns_pending":
      // .hu: the delegation waits for the registry's confirmation — unless we saw it recorded.
      return hu && !boughtSeen ? "confirm" : "ns";
    case "tls_pending":
    case "setup_retry":
      return "tls";
    case "live":
      return null;
    default:
      return "bought";
  }
}

/** THE LIFE PATH, pure — exported for the guard. */
export function lifeSteps(r: {
  status: string;
  tld: string;
  house: boolean;
  stuckStage: number;
  orderedAt: Date | null;
  paidAt: Date | null;
  boughtAt: Date | null;
  confirmLinkAt: Date | null;
  registryRecordedAt: Date | null;
  nsActiveAt: Date | null;
  liveAt: Date | null;
  /** For a failed row: did the purchase itself go through? */
  bought: boolean;
}): DomainStep[] {
  const hu = r.tld === ".hu";
  const keys = ORDER.filter((k) => k !== "confirm" || hu);
  const failed = r.status === "failed";
  const cur = failed ? (r.bought ? (hu && !r.registryRecordedAt ? "confirm" : "ns") : "bought") : currentStep(r.status, hu, !!r.registryRecordedAt);
  const curIdx = cur === null ? keys.length : keys.indexOf(cur);
  const at: Record<DomainStepKey, Date | null> = {
    ordered: r.orderedAt,
    paid: r.paidAt,
    bought: r.boughtAt,
    // The registry recording proves the confirmation; the link's arrival is the start of the step.
    confirm: r.registryRecordedAt,
    ns: r.nsActiveAt,
    // tls_pending → live is one transition; the certificate time is not stored on its own.
    tls: null,
    live: r.liveAt,
  };
  return keys.map((key, i): DomainStep => {
    const state: DomainStepState =
      i < curIdx ? "done" : i === curIdx ? (failed || r.stuckStage >= 2 ? "stuck" : "current") : "todo";
    let gap: DomainStep["gap"];
    if (state === "done" && !at[key]) gap = r.house && (key === "ordered" || key === "paid") ? "house" : "untracked";
    return { key, at: at[key], state, ...(gap ? { gap } : {}) };
  });
}

/** THE ATTENTION RULE, pure — exported for the guard. */
export function attentionOf(
  r: {
    status: string;
    stuckStage: number;
    registrarNote: string | null;
    renewProblem: string | null;
    renewEnd: Date | null;
    house: boolean;
  },
  daysLeft: number | null,
): DomainAttention[] {
  const out: DomainAttention[] = [];
  if (r.status === "failed") out.push("failed");
  if (r.status !== "live" && r.status !== "failed") {
    if (r.stuckStage >= 2) out.push("stuck_72h");
    else if (r.stuckStage === 1) out.push("stuck_24h");
    if (r.registrarNote) out.push("registrar_note");
  }
  if (r.renewProblem) out.push("renew_problem");
  // A name we stopped renewing is not a warning — it is meant to lapse — but a live name
  // under an ended subscription is (owner: „ha az előfizetés megszűnt, de a domain él”).
  if (r.renewEnd && r.status === "live") out.push("subscription_ended");
  else if (daysLeft !== null && !r.house) {
    if (daysLeft <= 7) out.push("expires_7");
    else if (daysLeft <= 30) out.push("expires_30");
    else if (daysLeft <= 60) out.push("expires_60");
  }
  return out;
}

function tldOf(domain: string): string {
  const i = domain.lastIndexOf(".");
  return i < 0 ? "" : domain.slice(i).toLowerCase();
}

async function loadRows(filter?: { tenantId?: string; partnerId?: string }): Promise<Row[]> {
  let q = db
    .selectFrom("domain_provisioning as dp")
    .innerJoin("site as s", "s.id", "dp.site_id")
    .innerJoin("tenant as t", "t.id", "dp.tenant_id")
    .leftJoin("partner as p", "p.tenant_id", "dp.tenant_id")
    .leftJoin("order_intent as oi", "oi.id", "dp.order_intent_id")
    .select((eb) => [
      "dp.id",
      "dp.site_id",
      "dp.tenant_id",
      "dp.order_intent_id",
      "dp.domain",
      "dp.status",
      "dp.registrar_ref",
      "dp.error",
      "dp.created_at",
      "dp.finished_at",
      "dp.waiting_since",
      "dp.stuck_stage",
      "dp.delay_notice_at",
      "dp.ns_active_at",
      "dp.registrar_note",
      "dp.registrar_note_at",
      "dp.bought_notice_at",
      "dp.confirm_link_at",
      "dp.registry_recorded_at",
      "s.slug",
      "s.domain_expires_at",
      "s.registrar_service_ref",
      "s.domain_auto_renew",
      "s.domain_renew_end",
      "s.domain_renew_checked_at",
      "s.domain_renew_problem",
      "t.display_name as tenant_name",
      "t.status as tenant_status",
      "p.id as partner_id",
      "p.name as partner_name",
      "oi.kind as order_kind",
      "oi.created_at as ordered_at",
      eb
        .selectFrom("payment")
        .select("payment.paid_at")
        .whereRef("payment.order_intent_id", "=", "dp.order_intent_id")
        .where("payment.paid_at", "is not", null)
        .orderBy("payment.paid_at", "asc")
        .limit(1)
        .as("paid_at"),
      // ADR-0094: the leaver took the name (buyout inside the settlement order).
      eb
        .selectFrom("order_intent as so")
        .select("so.settlement_take_domain")
        .whereRef("so.tenant_id", "=", "dp.tenant_id")
        .where("so.kind", "=", "domain_settlement")
        .where("so.settlement_take_domain", "=", true)
        .limit(1)
        .as("settled"),
    ])
    // The newest attempt per name is the name's state; older (failed) attempts stay in history.
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("domain_provisioning as newer")
            .select("newer.id")
            .whereRef("newer.domain", "=", "dp.domain")
            .whereRef("newer.created_at", ">", "dp.created_at"),
        ),
      ),
    );
  if (filter?.tenantId) q = q.where("dp.tenant_id", "=", filter.tenantId);
  if (filter?.partnerId) q = q.where("p.id", "=", filter.partnerId);
  // Timestamp columns select as Date (pg driver); the row type spells that out.
  return (await q.orderBy("dp.created_at", "desc").execute()) as unknown as Row[];
}

async function toRecords(rows: readonly Row[], now: Date): Promise<DomainRecord[]> {
  if (!rows.length) return [];
  await loadPricing();
  const disabled = await getDisabledModules();
  const modulesByTenant = new Map<string, string[]>();
  const out: DomainRecord[] = [];
  for (const r of rows) {
    const house = isHouseDomain(r.domain);
    const tld = tldOf(r.domain);
    const bought = !!r.registrar_ref || ["registered", "dns_pending", "tls_pending", "setup_retry", "live"].includes(r.status);
    // The purchase moment: the "we bought your name" mark is set in the same step as the wait start.
    const boughtAt = bought ? (r.bought_notice_at ?? r.waiting_since) : null;
    const steps = lifeSteps({
      status: r.status,
      tld,
      house,
      stuckStage: r.stuck_stage,
      orderedAt: r.ordered_at,
      paidAt: r.paid_at,
      boughtAt,
      confirmLinkAt: r.confirm_link_at,
      registryRecordedAt: r.registry_recorded_at,
      nsActiveAt: r.ns_active_at,
      liveAt: r.status === "live" ? r.finished_at : null,
      bought,
    });
    const daysLeft = r.domain_expires_at ? Math.floor((r.domain_expires_at.getTime() - now.getTime()) / DAY) : null;
    let cover: DomainCover;
    let monthlyFee = 0;
    if (house) cover = "house";
    else if (r.settled) cover = "settled";
    else {
      let mods = modulesByTenant.get(r.tenant_id);
      if (!mods) {
        mods = await renewableModuleIds(r.tenant_id);
        modulesByTenant.set(r.tenant_id, mods);
      }
      monthlyFee = domainFeeForCycle(1, undefined, { domain: r.domain, modules: mods, disabled });
      cover = monthlyFee > 0 ? "fee" : "package";
    }
    const tldRow = offeredTldOf(r.domain);
    const waiting = r.status !== "live" && r.status !== "failed";
    out.push({
      provisioningId: r.id,
      siteId: r.site_id,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenantStatus: r.tenant_status,
      slug: r.slug,
      partnerId: r.partner_id,
      partnerName: r.partner_name,
      domain: r.domain,
      tld,
      house,
      registrar: config.domains.registrarProvider,
      registrarRef: r.registrar_ref,
      serviceRef: r.registrar_service_ref,
      status: r.status,
      error: r.error,
      orderIntentId: r.order_intent_id,
      orderKind: r.order_kind,
      steps,
      waitingSince: waiting ? r.waiting_since : null,
      stuckStage: r.stuck_stage,
      delayNoticeAt: r.delay_notice_at,
      registrarNote: r.registrar_note,
      registrarNoteAt: r.registrar_note_at,
      expiresAt: r.domain_expires_at,
      expiryEstimated: !!r.domain_expires_at && !r.domain_renew_checked_at,
      autoRenew: r.domain_auto_renew,
      renewEnd: r.domain_renew_end,
      renewCheckedAt: r.domain_renew_checked_at,
      renewProblem: r.domain_renew_problem,
      cover,
      monthlyFee,
      costNet: tldRow?.costNet ?? null,
      costCurrency: tldRow?.costCurrency ?? null,
      attention: attentionOf(
        {
          status: r.status,
          stuckStage: r.stuck_stage,
          registrarNote: r.registrar_note,
          renewProblem: r.domain_renew_problem,
          renewEnd: r.domain_renew_end,
          house,
        },
        daysLeft,
      ),
      daysLeft,
    });
  }
  return out;
}

/** Every name we manage, newest first (the /domains list). */
export async function listDomains(now: Date = new Date()): Promise<DomainRecord[]> {
  return toRecords(await loadRows(), now);
}

/** The names one tenant uses — the partner page's domain block (SUB-C) calls this. */
export async function getDomainsForTenant(tenantId: string, now: Date = new Date()): Promise<DomainRecord[]> {
  return toRecords(await loadRows({ tenantId }), now);
}

/** The names behind one partner (partner.tenant_id → its tenant's names). */
export async function getDomainsForPartner(partnerId: string, now: Date = new Date()): Promise<DomainRecord[]> {
  return toRecords(await loadRows({ partnerId }), now);
}

/** One name by its beszerzés row (the drawer / deep link). */
export async function getDomainRecord(provisioningId: string, now: Date = new Date()): Promise<DomainRecord | null> {
  const all = await listDomains(now);
  return all.find((d) => d.provisioningId === provisioningId) ?? null;
}

export interface DomainStats {
  readonly total: number;
  readonly byState: { readonly live: number; readonly running: number; readonly failed: number };
  readonly byTld: ReadonlyArray<{ readonly tld: string; readonly n: number }>;
  /** Non-house names expiring within 90 days, soonest first, with the renewal's purchase cost. */
  readonly expiring90: ReadonlyArray<{ readonly domain: string; readonly daysLeft: number; readonly costNet: number | null }>;
  readonly expiring90Cost: number;
  /** Average step durations (ms) over the non-house names that have both ends measured; n = sample. */
  readonly turnaround: Readonly<Record<"paid" | "bought" | "ns" | "live" | "total", { readonly ms: number; readonly n: number } | null>>;
  /** Last 6 calendar months (Budapest-agnostic UTC months): purchase cost and separate domain revenue. */
  readonly months: ReadonlyArray<{ readonly month: string; readonly cost: number; readonly revenue: number }>;
  readonly attention: number;
}

/** THE SUMMARY, pure over the records — exported for the guard. */
export function domainStats(records: readonly DomainRecord[], now: Date = new Date()): DomainStats {
  const byState = { live: 0, running: 0, failed: 0 };
  const tlds = new Map<string, number>();
  const expiring: Array<{ domain: string; daysLeft: number; costNet: number | null }> = [];
  const sums: Record<string, { ms: number; n: number }> = {};
  const add = (k: string, ms: number): void => {
    if (ms < 0) return;
    const s = (sums[k] ??= { ms: 0, n: 0 });
    s.ms += ms;
    s.n++;
  };
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthKeys.push(m.toISOString().slice(0, 7));
  }
  const months = new Map(monthKeys.map((k) => [k, { month: k, cost: 0, revenue: 0 }]));
  let attention = 0;
  for (const r of records) {
    if (r.status === "live") byState.live++;
    else if (r.status === "failed") byState.failed++;
    else byState.running++;
    tlds.set(r.tld, (tlds.get(r.tld) ?? 0) + 1);
    if (r.attention.length) attention++;
    if (r.house) continue;
    if (r.daysLeft !== null && r.daysLeft <= 90 && r.daysLeft >= 0) expiring.push({ domain: r.domain, daysLeft: r.daysLeft, costNet: r.costNet });
    const at = (k: DomainStepKey): Date | null => r.steps.find((s) => s.key === k)?.at ?? null;
    const chain: ReadonlyArray<readonly ["paid" | "bought" | "ns" | "live", DomainStepKey, DomainStepKey]> = [
      ["paid", "ordered", "paid"],
      ["bought", "paid", "bought"],
      ["ns", "bought", "ns"],
      ["live", "ns", "live"],
    ];
    for (const [k, from, to] of chain) {
      const a = at(from);
      const b = at(to);
      if (a && b) add(k, b.getTime() - a.getTime());
    }
    const o = at("ordered");
    const l = at("live");
    if (o && l) add("total", l.getTime() - o.getTime());
    const bought = at("bought");
    const bm = bought?.toISOString().slice(0, 7);
    if (bm && months.has(bm) && r.costNet !== null) months.get(bm)!.cost += r.costNet;
    if (r.cover === "fee" && l) {
      const lm = l.toISOString().slice(0, 7);
      for (const k of monthKeys) if (k >= lm) months.get(k)!.revenue += r.monthlyFee;
    }
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);
  const avg = (k: string) => (sums[k] ? { ms: sums[k].ms / sums[k].n, n: sums[k].n } : null);
  return {
    total: records.length,
    byState,
    byTld: [...tlds].map(([tld, n]) => ({ tld, n })).sort((a, b) => b.n - a.n),
    expiring90: expiring,
    expiring90Cost: expiring.reduce((s, e) => s + (e.costNet ?? 0), 0),
    turnaround: { paid: avg("paid"), bought: avg("bought"), ns: avg("ns"), live: avg("live"), total: avg("total") },
    months: monthKeys.map((k) => months.get(k)!),
    attention,
  };
}

