// A60 ÖSSZESÍTŐ NYILATKOZAT — the data behind it (ADR-0443, accountant's rule 2026-11-12).
//
// Every reverse-charge invoice (EU company, VIES-valid, Áfa tv. 37. §) must be reported for
// its period on NAV form 26A60, sheet 26A60-03 „Közösségen belüli szolgáltatásnyújtások
// részletezése" (kitöltési útmutató 2026-04-29, nav.gov.hu …/26A60). Per row:
//   (a) the partner's country code (VIES form: Greece = EL),
//   (b) the partner's community VAT number,
//   (c) the net amount — IN THOUSAND FORINTS, rounded („ezer forintra kerekítve, ezer
//       forintban kell kitölteni"); the column total must equal field 92B of the VAT return.
// The period follows the VAT return (monthly or quarterly, due by the 20th of the next
// month); a period without intra-EU supply needs no filing.
//
// Filing format: ÁNYK (the general form filler) — NAV guarantees ÁNYK until 2026-12-31 and
// moves forms to ONYA; an ONYA import path for A60 was NOT found on 2026-11-12. So this
// module produces the ROWS (CSV for the accountant / for keying into ÁNYK); building the
// ÁNYK/ONYA import file is the next step once the route is confirmed with NAV.
import { sql } from "kysely";
import { db } from "../db/client.js";
import { budapestMidnight } from "../text/budapestTime.js";
import { invoiceNetHuf } from "./taxCounters.js";

export interface A60Period {
  readonly label: string;
  /** Budapest-midnight bounds, [from, to). */
  readonly from: Date;
  readonly to: Date;
}

/** "2026-11" (month) or "2026-Q4" (quarter) → the period; null = not that shape. */
export function parseA60Period(raw: string | null | undefined): A60Period | null {
  const s = String(raw ?? "").trim().toUpperCase();
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  const q = /^(\d{4})-Q([1-4])$/.exec(s);
  const iso = (y: number, mo: number) => `${y}-${String(mo).padStart(2, "0")}-01`;
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    return { label: s, from: budapestMidnight(iso(y, mo)), to: budapestMidnight(mo === 12 ? iso(y + 1, 1) : iso(y, mo + 1)) };
  }
  if (q) {
    const y = Number(q[1]);
    const first = (Number(q[2]) - 1) * 3 + 1;
    return { label: s, from: budapestMidnight(iso(y, first)), to: budapestMidnight(first === 10 ? iso(y + 1, 1) : iso(y, first + 3)) };
  }
  return null;
}

export interface A60Row {
  /** VIES country code (EL for Greece). */
  readonly country: string;
  /** The partner's VAT number WITHOUT the country prefix, as the form's column (b) takes it. */
  readonly vatNumber: string;
  readonly netHuf: number;
  /** Column (c): thousand forints, rounded. */
  readonly netThousandHuf: number;
  readonly invoices: number;
}

export interface A60Summary {
  readonly period: A60Period;
  readonly rows: readonly A60Row[];
  /** Reverse-charge invoices of the period that could not be converted (no MNB rate). */
  readonly unconverted: number;
}

const viesCountry = (iso: string): string => (iso.toUpperCase() === "GR" ? "EL" : iso.toUpperCase());

/** The A60 rows of a period: every issued reverse-charge invoice, grouped by partner VAT number. */
export async function a60Summary(period: A60Period): Promise<A60Summary> {
  const rows = await db
    .selectFrom("invoice")
    .innerJoin("payment", "payment.id", "invoice.payment_id")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select([
      "invoice.net as net",
      "invoice.currency as currency",
      "invoice.fx_rate as fxRate",
      "invoice.fulfillment_date as fulfilment",
      "invoice.issued_at as issuedAt",
      sql<string | null>`coalesce(invoice.buyer_country, order_intent.buyer_country)`.as("country"),
      sql<string | null>`coalesce(invoice.buyer_eu_vat_number, order_intent.buyer_eu_vat_number)`.as("vat"),
    ])
    .where("invoice.status", "=", "issued")
    .where(sql<boolean>`coalesce(invoice.vat_treatment, order_intent.vat_treatment) = 'reverse_charge'`)
    .where(sql<boolean>`coalesce(invoice.fulfillment_date::timestamptz, invoice.issued_at) >= ${period.from}`)
    .where(sql<boolean>`coalesce(invoice.fulfillment_date::timestamptz, invoice.issued_at) < ${period.to}`)
    .execute();
  const by = new Map<string, { country: string; vatNumber: string; netHuf: number; invoices: number }>();
  let unconverted = 0;
  for (const r of rows) {
    const raw = (r.fulfilment ?? r.issuedAt) as unknown;
    const day = typeof raw === "string" ? raw.slice(0, 10) : new Date(raw as string).toISOString().slice(0, 10);
    const huf = await invoiceNetHuf({ net: r.net, currency: r.currency, fxRate: r.fxRate === null ? null : Number(r.fxRate), day });
    if (huf === null) {
      unconverted++;
      continue;
    }
    const country = viesCountry(r.country ?? "");
    const v = String(r.vat ?? "").replace(/\s+/g, "").toUpperCase();
    const pref = v.slice(0, 2);
    const vatNumber = pref === country || (country === "EL" && pref === "GR") ? v.slice(2) : v;
    const key = `${country}|${vatNumber}`;
    const cur = by.get(key) ?? { country, vatNumber, netHuf: 0, invoices: 0 };
    cur.netHuf += huf;
    cur.invoices++;
    by.set(key, cur);
  }
  return {
    period,
    rows: [...by.values()]
      .map((r) => ({ ...r, netHuf: Math.round(r.netHuf), netThousandHuf: Math.round(r.netHuf / 1000) }))
      .sort((a, b) => a.country.localeCompare(b.country) || a.vatNumber.localeCompare(b.vatNumber)),
    unconverted,
  };
}

/** CSV for the accountant / ÁNYK keying (semicolon, the Hungarian Excel default). */
export function a60Csv(s: A60Summary): string {
  const head = "időszak;országkód;közösségi adószám;nettó (Ft);nettó (ezer Ft);számlák";
  const lines = s.rows.map((r) => [s.period.label, r.country, r.vatNumber, r.netHuf, r.netThousandHuf, r.invoices].join(";"));
  const tail = s.unconverted ? [`# ${s.unconverted} számla nem váltható át (nincs MNB-árfolyam) — HIÁNYZIK a fenti összegből`] : [];
  return [head, ...lines, ...tail].join("\n") + "\n";
}
