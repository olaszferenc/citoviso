// Partner console — data access (PARTNER-UI-SPEC.md). The partner page is the
// financial + CRM face of a counterparty; the lead page stays the marketing face
// (owner decree: two separate surfaces that reference each other). Same style as
// data.ts: thin Kysely queries, small pilot volume, aggregation stitched in JS.
//
// i18n note: every string here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { db } from "../db/client.js";

/** Per-currency amount map (a document carries its OWN currency — summing across
 *  currencies would be a lie, so aggregates are keyed by ISO 4217 code). */
export type MoneyByCurrency = Record<string, number>;

export interface PartnerListRow {
  readonly id: string;
  readonly name: string;
  readonly city: string | null;
  readonly taxNumber: string | null;
  readonly isCustomer: boolean;
  readonly isSupplier: boolean;
  readonly active: boolean;
  /** Non-void accounting documents linked to this partner. */
  readonly docCount: number;
  /** Gross of outgoing (customer-side) documents, per currency. */
  readonly revenue: MoneyByCurrency;
  /** Unpaid gross of outgoing documents — their debt to us. */
  readonly receivable: MoneyByCurrency;
  /** Gross of incoming (supplier-side) documents, per currency. */
  readonly spend: MoneyByCurrency;
  /** Unpaid gross of incoming documents — our debt to them. */
  readonly payable: MoneyByCurrency;
}

export interface PartnerListQuery {
  /** Free-text search on name / tax number / city. */
  q?: string;
  /** Role filter: customer | supplier | (undefined = all). */
  type?: "customer" | "supplier";
}

/** Partner list with per-partner document aggregates (count, turnover, open items). */
export async function listPartners(q: PartnerListQuery = {}): Promise<PartnerListRow[]> {
  let query = db
    .selectFrom("partner")
    .select(["id", "name", "city", "tax_number", "is_customer", "is_supplier", "active"])
    .orderBy("name", "asc");
  if (q.type === "customer") query = query.where("is_customer", "=", true);
  if (q.type === "supplier") query = query.where("is_supplier", "=", true);
  if (q.q) {
    const like = `%${q.q}%`;
    query = query.where((eb) =>
      eb.or([
        eb("name", "ilike", like),
        eb("tax_number", "ilike", like),
        eb("city", "ilike", like),
      ]),
    );
  }
  const partners = await query.execute();

  // One grouped pass over the documents, stitched onto the partners in JS.
  const aggs = await db
    .selectFrom("accounting_document")
    .select(({ fn }) => [
      "partner_id",
      "direction",
      "currency",
      "paid",
      fn.countAll().as("n"),
      fn.sum("gross").as("gross"),
    ])
    .where("partner_id", "is not", null)
    .where("status", "!=", "void")
    .groupBy(["partner_id", "direction", "currency", "paid"])
    .execute();

  const byPartner = new Map<
    string,
    { docCount: number; revenue: MoneyByCurrency; receivable: MoneyByCurrency; spend: MoneyByCurrency; payable: MoneyByCurrency }
  >();
  const add = (m: MoneyByCurrency, cur: string, v: number) => {
    m[cur] = (m[cur] ?? 0) + v;
  };
  for (const a of aggs) {
    const pid = a.partner_id!;
    let agg = byPartner.get(pid);
    if (!agg) {
      agg = { docCount: 0, revenue: {}, receivable: {}, spend: {}, payable: {} };
      byPartner.set(pid, agg);
    }
    const gross = Number(a.gross ?? 0);
    agg.docCount += Number(a.n);
    if (a.direction === "outgoing") {
      add(agg.revenue, a.currency, gross);
      if (!a.paid) add(agg.receivable, a.currency, gross);
    } else {
      add(agg.spend, a.currency, gross);
      if (!a.paid) add(agg.payable, a.currency, gross);
    }
  }

  return partners.map((p) => {
    const agg = byPartner.get(p.id) ?? {
      docCount: 0,
      revenue: {},
      receivable: {},
      spend: {},
      payable: {},
    };
    return {
      id: p.id,
      name: p.name,
      city: p.city,
      taxNumber: p.tax_number,
      isCustomer: p.is_customer,
      isSupplier: p.is_supplier,
      active: p.active,
      ...agg,
    };
  });
}
