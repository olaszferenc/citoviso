// TAX COUNTERS for foreign buyers — the accountant's rule (MEMORY.md 2026-11-12), ADR-0443.
//
//   · EU company with a VIES-valid VAT number → reverse charge (Áfa tv. 37. §, Számlázz key
//     EUFAD37): no Hungarian VAT, not in the AAM cap (accountant; to be confirmed), listed
//     in the A60 summary (a60.ts).
//   · EU private person (and an EU business without a valid VAT number — a non-taxable
//     person for the place of supply) → AAM, counts into the AAM cap. BUT our product is an
//     ELECTRONICALLY SUPPLIED SERVICE (subscription software + hosting), so the cross-border
//     B2C sales to other member states count into the EU-wide 10 000 € threshold (Áfa tv.
//     49/A. § (1) c), VAT Directive Art. 59c): above it the buyer country's VAT is due,
//     through OSS. Registering for OSS is the OWNER's decision — until then, at the
//     threshold every NEW such sale is held back (fail closed) and the owner is told.
//   · Non-EU buyer: blocked in this round (isTaxableBuyerCountry false).
//
// Thresholds, verified 2026-11-12:
//   · AAM cap — Áfa tv. 188. § (2) as amended by 2025. évi LXXXIV. tv. 14. §: 20 000 000 Ft
//     for 2026 (18 M in 2025, 22 M from 2027, 24 M from 2028). NAV, 2025-12-11:
//     nav.gov.hu/ado/afa/Emelkedik_az_alanyi_adomentesseg_ertekhatara. Overridable on the
//     settings store (app_setting `tax_aam_limit_huf`) without a deploy.
//   · OSS — 10 000 € combined over all member states, net, per calendar year; the PREVIOUS
//     year must also have stayed under it (Áfa tv. 49/A. § (1) c)). Override:
//     `tax_oss_limit_eur`. Warning from `tax_warn_pct` (default 80) %.
import { sql } from "kysely";
import { db } from "../db/client.js";
import { getSetting } from "../console/appSettings.js";
import { budapestMidnight, budapestYear } from "../text/budapestTime.js";
import { minorToMajor } from "../text/money.js";
import { EU_VAT_COUNTRIES } from "./taxId.js";
import { mnbRate } from "./fxRate.js";

/** Where WE are established — the seller's country is a fact about us, not about the flow. */
export const SELLER_COUNTRY = "HU";

/** Áfa tv. 188. § (2) per tax year (the statute's own schedule). */
const AAM_LIMIT_BY_YEAR: ReadonlyArray<readonly [number, number]> = [
  [2028, 24_000_000],
  [2027, 22_000_000],
  [2026, 20_000_000],
  [2025, 18_000_000],
];

/** The statutory AAM cap of a tax year (before 2025: the 2025 figure is the floor we know). */
export function statutoryAamLimitHuf(year: number): number {
  return AAM_LIMIT_BY_YEAR.find(([y]) => year >= y)?.[1] ?? AAM_LIMIT_BY_YEAR[AAM_LIMIT_BY_YEAR.length - 1]![1];
}

export interface TaxThresholds {
  readonly aamLimitHuf: number;
  readonly ossLimitEur: number;
  readonly warnPct: number;
  /** True where the value came from the settings store, not the statute default. */
  readonly aamFromSettings: boolean;
}

const positive = (v: string | null): number | null => {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function taxThresholds(year = budapestYear(new Date())): Promise<TaxThresholds> {
  const [aam, oss, warn] = await Promise.all([
    getSetting("tax_aam_limit_huf"),
    getSetting("tax_oss_limit_eur"),
    getSetting("tax_warn_pct"),
  ]);
  return {
    aamLimitHuf: positive(aam) ?? statutoryAamLimitHuf(year),
    ossLimitEur: positive(oss) ?? 10_000,
    warnPct: Math.min(99, positive(warn) ?? 80),
    aamFromSettings: positive(aam) !== null,
  };
}

/** VIES writes Greece as EL; our country column holds ISO-2 (GR). */
const euIso = new Set(EU_VAT_COUNTRIES.map((c) => (c === "EL" ? "GR" : c)));

/** An EU member state other than ours. */
export function isOtherEuCountry(country: string | null | undefined): boolean {
  const c = String(country ?? "").trim().toUpperCase();
  return c !== SELLER_COUNTRY && euIso.has(c);
}

/** May we invoice a buyer of this country at all in this round? HU + EU; non-EU blocked. */
export function isTaxableBuyerCountry(country: string | null | undefined): boolean {
  const c = String(country ?? "").trim().toUpperCase();
  return c === SELLER_COUNTRY || euIso.has(c);
}

/** Does this sale count into the OSS threshold? Another member state, not reverse charge. */
export function isOssCountedSale(o: {
  readonly buyer_country: string | null;
  readonly vat_treatment: string | null;
}): boolean {
  return isOtherEuCountry(o.buyer_country) && o.vat_treatment !== "reverse_charge";
}

interface CountedInvoice {
  readonly net: number;
  readonly currency: string;
  readonly fxRate: number | null;
  readonly day: string;
}

/** An invoice's net in HUF — its stored MNB rate first, else the rate of its day. null = unknown. */
export async function invoiceNetHuf(i: CountedInvoice): Promise<number | null> {
  if (i.currency === "HUF") return i.net;
  const rate = i.fxRate ?? (await mnbRate(i.currency, i.day))?.rate ?? null;
  return rate === null ? null : minorToMajor(i.net, i.currency) * rate;
}

/** An invoice's net in EUR (the OSS threshold's unit), via the MNB rates of its day. */
async function invoiceNetEur(i: CountedInvoice): Promise<number | null> {
  if (i.currency === "EUR") return minorToMajor(i.net, "EUR");
  const huf = await invoiceNetHuf(i);
  const eur = await mnbRate("EUR", i.day);
  return huf === null || !eur ? null : huf / eur.rate;
}

const dayOf = (v: unknown): string =>
  typeof v === "string" ? v.slice(0, 10) : new Date(v as string).toISOString().slice(0, 10);

/** The OSS-counted invoices of one calendar year (buyer facts: the invoice's, else the order's). */
async function ossInvoices(year: number): Promise<CountedInvoice[]> {
  const from = budapestMidnight(`${year}-01-01`);
  const to = budapestMidnight(`${year + 1}-01-01`);
  const rows = await db
    .selectFrom("invoice")
    .innerJoin("payment", "payment.id", "invoice.payment_id")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select([
      "invoice.net as net",
      "invoice.currency as currency",
      "invoice.fx_rate as fxRate",
      "invoice.issued_at as issuedAt",
      "invoice.fulfillment_date as fulfilment",
      sql<string | null>`coalesce(invoice.buyer_country, order_intent.buyer_country)`.as("buyerCountry"),
      sql<string | null>`coalesce(invoice.vat_treatment, order_intent.vat_treatment)`.as("vatTreatment"),
    ])
    .where("invoice.status", "=", "issued")
    .where(sql<boolean>`invoice.issued_at >= ${from} and invoice.issued_at < ${to}`)
    .execute();
  return rows
    .filter((r) => isOssCountedSale({ buyer_country: r.buyerCountry, vat_treatment: r.vatTreatment }))
    .map((r) => ({
      net: r.net,
      currency: r.currency,
      fxRate: r.fxRate === null ? null : Number(r.fxRate),
      day: dayOf(r.fulfilment ?? r.issuedAt),
    }));
}

export interface OssStatus {
  readonly year: number;
  readonly eurThisYear: number;
  readonly eurPrevYear: number;
  readonly limitEur: number;
  readonly pct: number;
  readonly warn: boolean;
  /** New OSS-counted sales are held back (threshold reached, or a sum could not be computed). */
  readonly blocked: boolean;
  /** Invoices that could not be converted (no MNB rate) — the sum is then UNKNOWN. */
  readonly unknown: number;
  readonly reason: string;
}

async function sumEur(list: readonly CountedInvoice[]): Promise<{ eur: number; unknown: number }> {
  let eur = 0;
  let unknown = 0;
  for (const i of list) {
    const v = await invoiceNetEur(i);
    if (v === null) unknown++;
    else eur += v;
  }
  return { eur, unknown };
}

/** The OSS counter (current + previous calendar year, Budapest year). */
export async function ossStatus(now = new Date()): Promise<OssStatus> {
  const year = budapestYear(now);
  const t = await taxThresholds(year);
  const [cur, prev] = await Promise.all([ossInvoices(year), ossInvoices(year - 1)]);
  const a = await sumEur(cur);
  const b = await sumEur(prev);
  const pct = Math.round((a.eur / t.ossLimitEur) * 100);
  const unknown = a.unknown + b.unknown;
  const over = a.eur >= t.ossLimitEur;
  const prevOver = b.eur >= t.ossLimitEur;
  const reason = unknown
    ? `${unknown} számla nem váltható át (nincs MNB-árfolyam) — az összeg ismeretlen`
    : prevOver
      ? `az előző évi EU-s magánszemély-forgalom ${Math.round(b.eur)} € ≥ ${t.ossLimitEur} €`
      : `${Math.round(a.eur)} € / ${t.ossLimitEur} € (${pct}%)`;
  return {
    year,
    eurThisYear: a.eur,
    eurPrevYear: b.eur,
    limitEur: t.ossLimitEur,
    pct,
    warn: pct >= t.warnPct,
    blocked: unknown > 0 || over || prevOver,
    unknown,
    reason,
  };
}
