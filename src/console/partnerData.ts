// Partner console — data access (PARTNER-UI-SPEC.md). The partner page is the
// financial + CRM face of a counterparty; the lead page stays the marketing face
// (owner decree: two separate surfaces that reference each other). Same style as
// data.ts: thin Kysely queries, small pilot volume, aggregation stitched in JS.
//
// i18n note: every string here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { db } from "../db/client.js";
import { computeAnnual, computeMonthly, getCurrency, loadPricing } from "../pricing.js";

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

// ── Partner page (/partner/:id) ─────────────────────────────────────────────

export interface PartnerBankAccountView {
  readonly accountNo: string;
  readonly bankName: string | null;
  readonly currency: string | null;
  readonly isDefault: boolean;
}

/** The customer face: the platform subscription behind this partner. */
export interface PartnerTenantView {
  readonly tenantId: string;
  readonly leadId: string;
  readonly displayName: string;
  readonly siteStatus: string | null;
  readonly slug: string | null;
  readonly customDomain: string | null;
  readonly liveAt: string | null;
  readonly previewToken: string | null;
  readonly modules: string[];
  /** Current subscription value from the ACTIVE module set (pricing engine). */
  readonly monthlyFee: number;
  readonly annualFee: number;
  readonly feeCurrency: string;
}

export interface PartnerDetail {
  readonly id: string;
  readonly name: string;
  readonly isCustomer: boolean;
  readonly isSupplier: boolean;
  readonly active: boolean;
  readonly taxNumber: string | null;
  readonly euVatNumber: string | null;
  readonly registrationNo: string | null;
  readonly country: string;
  readonly zip: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly createdAt: string;
  readonly bankAccounts: PartnerBankAccountView[];
  readonly tenant: PartnerTenantView | null;
  /** Unpaid outgoing gross — their open debt to us. */
  readonly receivable: MoneyByCurrency;
  /** Unpaid incoming gross — our open debt to them. */
  readonly payable: MoneyByCurrency;
  /** Incoming gross over the last 365 days — the supplier KPI. */
  readonly yearSpend: MoneyByCurrency;
  readonly docCount: number;
}

/** Everything the partner page header + KPI tiles + overview tab need. */
export async function getPartnerDetail(id: string): Promise<PartnerDetail | null> {
  const p = await db
    .selectFrom("partner")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!p) return null;

  const banks = await db
    .selectFrom("partner_bank_account")
    .select(["account_no", "bank_name", "currency", "is_default"])
    .where("partner_id", "=", id)
    .where("active", "=", true)
    .orderBy("is_default", "desc")
    .execute();

  // Document KPIs in one grouped pass (per currency — never summed across).
  const aggs = await db
    .selectFrom("accounting_document")
    .select(({ fn }) => [
      "direction",
      "currency",
      "paid",
      "issue_date",
      fn.countAll().as("n"),
      fn.sum("gross").as("gross"),
    ])
    .where("partner_id", "=", id)
    .where("status", "!=", "void")
    .groupBy(["direction", "currency", "paid", "issue_date"])
    .execute();
  const receivable: MoneyByCurrency = {};
  const payable: MoneyByCurrency = {};
  const yearSpend: MoneyByCurrency = {};
  let docCount = 0;
  const yearAgo = Date.now() - 365 * 86_400_000;
  for (const a of aggs) {
    const gross = Number(a.gross ?? 0);
    docCount += Number(a.n);
    if (a.direction === "outgoing") {
      if (!a.paid) receivable[a.currency] = (receivable[a.currency] ?? 0) + gross;
    } else {
      if (!a.paid) payable[a.currency] = (payable[a.currency] ?? 0) + gross;
      if (new Date(a.issue_date as unknown as string).getTime() >= yearAgo)
        yearSpend[a.currency] = (yearSpend[a.currency] ?? 0) + gross;
    }
  }

  // Customer face: subscription state + current fee from the ACTIVE modules.
  let tenant: PartnerTenantView | null = null;
  if (p.tenant_id) {
    const t = await db
      .selectFrom("tenant")
      .select(["id", "lead_id", "display_name"])
      .where("id", "=", p.tenant_id)
      .executeTakeFirst();
    if (t) {
      const site = await db
        .selectFrom("site")
        .select(["status", "slug", "custom_domain", "live_at", "preview_token"])
        .where("tenant_id", "=", t.id)
        .executeTakeFirst();
      const mods = await db
        .selectFrom("module_entitlement")
        .select("module")
        .where("tenant_id", "=", t.id)
        .where("active", "=", true)
        .orderBy("module")
        .execute();
      await loadPricing();
      const region = p.country === "HU" ? "hu" : "global";
      const modules = mods.map((m) => m.module);
      tenant = {
        tenantId: t.id,
        leadId: t.lead_id,
        displayName: t.display_name,
        siteStatus: site?.status ?? null,
        slug: site?.slug ?? null,
        customDomain: site?.custom_domain ?? null,
        liveAt: site?.live_at ? new Date(site.live_at as unknown as string).toISOString() : null,
        previewToken: site?.preview_token ?? null,
        modules,
        monthlyFee: computeMonthly(modules, region),
        annualFee: computeAnnual(modules, region),
        feeCurrency: getCurrency(region),
      };
    }
  }

  return {
    id: p.id,
    name: p.name,
    isCustomer: p.is_customer,
    isSupplier: p.is_supplier,
    active: p.active,
    taxNumber: p.tax_number,
    euVatNumber: p.eu_vat_number,
    registrationNo: p.registration_no,
    country: p.country,
    zip: p.zip,
    city: p.city,
    address: p.address,
    email: p.email,
    phone: p.phone,
    createdAt: new Date(p.created_at as unknown as string).toISOString(),
    bankAccounts: banks.map((b) => ({
      accountNo: b.account_no,
      bankName: b.bank_name,
      currency: b.currency,
      isDefault: b.is_default,
    })),
    tenant,
    receivable,
    payable,
    yearSpend,
    docCount,
  };
}
