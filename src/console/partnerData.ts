// Partner console — data access (PARTNER-UI-SPEC.md). The partner page is the
// financial + CRM face of a counterparty; the lead page stays the marketing face
// (owner decree: two separate surfaces that reference each other). Same style as
// data.ts: thin Kysely queries, small pilot volume, aggregation stitched in JS.
//
// i18n note: every string here is operator-facing (internal console) — outside
// the §B.18 customer-facing i18n scope.

import { db } from "../db/client.js";
import { MODULE_CATALOG } from "../modules.js";
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

// ── Timeline (Előzmények / Aktivitás — the CRM heart, spec §3) ──────────────

/** One merged-timeline entry. Titles are operator-facing (internal console). */
export interface TimelineEvent {
  /** ISO timestamp the event happened at. */
  readonly at: string;
  /** Source bucket for the badge: lead|mock|megkeresés|aktivitás|rendelés|fizetés|számla|oldal|admin. */
  readonly kind: string;
  readonly title: string;
  readonly detail: string;
  /** Console deep link (lead page, activity page, …), if one exists. */
  readonly href: string | null;
}

function iso(v: unknown): string {
  return new Date(v as string | number | Date).toISOString();
}

/** Amount as the document/payment carries it — per its own currency. */
function money(amount: number, currency: string): string {
  const n = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return currency === "HUF" ? `${n} Ft` : `${n} ${currency}`;
}

const moduleLabel = (id: string): string =>
  MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;

/** Mock-event types worth a timeline row of their own; the rest (scroll/dwell)
 *  are summarised into the visit-opened row. Labels mirror views.ts EVENT_LABEL. */
const SIGNIFICANT_EVENTS: Readonly<Record<string, string>> = {
  panel_open: "megnyitotta a konfigurátort",
  module_add: "bekapcsolt egy modult",
  module_remove: "kikapcsolt egy modult",
  preset_select: "csomagot választott",
  period_select: "fizetési ciklust váltott",
  domain_select: "domain-típust választott",
  domain_pick: "domainnevet választott",
  photo_rights_declared: "elfogadta a fotó-jog nyilatkozatot",
  order_intent_submitted: "ELKÜLDTE A MEGRENDELÉST",
  checkout_redirect: "továbbment a fizetéshez",
};

/**
 * The merged, single-timeline history of a partner across all nine sources
 * (spec table). A supplier has no lead/tenant chain — its timeline is its
 * documents; the query plan simply finds nothing on the marketing chain.
 */
export async function getPartnerTimeline(partnerId: string): Promise<TimelineEvent[]> {
  const p = await db
    .selectFrom("partner")
    .select(["id", "tenant_id", "is_customer", "created_at"])
    .where("id", "=", partnerId)
    .executeTakeFirst();
  if (!p) return [];

  const ev: TimelineEvent[] = [];
  ev.push({
    at: iso(p.created_at),
    kind: "partner",
    title: "Partner-törzsadat létrejött",
    // A customer partner is born from the payment-time billing declaration; a
    // supplier is keyed in when its first incoming document is recorded.
    detail: p.is_customer ? "az első fizetés számlázási nyilatkozatából" : "",
    href: null,
  });

  // ── Accounting documents — the only source a pure supplier has. ──
  const docs = await db
    .selectFrom("accounting_document")
    .select([
      "id",
      "direction",
      "doc_type",
      "document_number",
      "issue_date",
      "gross",
      "currency",
      "paid",
      "paid_at",
      "booked",
      "booked_at",
    ])
    .where("partner_id", "=", partnerId)
    .where("status", "!=", "void")
    .execute();
  for (const d of docs) {
    const no = d.document_number ?? "szám nélkül";
    const dirLabel = d.direction === "outgoing" ? "kimenő" : "bejövő";
    const typeLabel = d.doc_type === "storno" ? "sztornó" : d.doc_type === "invoice" ? "számla" : d.doc_type;
    ev.push({
      at: iso(d.issue_date),
      kind: "számla",
      title: `${dirLabel} ${typeLabel} kiállítva — ${no}`,
      detail: money(Number(d.gross), d.currency),
      href: null,
    });
    if (d.paid && d.paid_at)
      ev.push({
        at: iso(d.paid_at),
        kind: "számla",
        title: `${typeLabel} kiegyenlítve — ${no}`,
        detail: money(Number(d.gross), d.currency),
        href: null,
      });
    if (d.booked && d.booked_at)
      ev.push({ at: iso(d.booked_at), kind: "számla", title: `könyvelve — ${no}`, detail: "", href: null });
  }

  // ── The marketing/subscription chain hangs off the tenant link. ──
  if (!p.tenant_id) return sortDesc(ev);
  const tenant = await db
    .selectFrom("tenant")
    .select(["id", "lead_id", "created_at"])
    .where("id", "=", p.tenant_id)
    .executeTakeFirst();
  if (!tenant) return sortDesc(ev);
  const leadId = tenant.lead_id;

  // lead + lead_provenance: when/where we found them, which data came whence.
  const lead = await db
    .selectFrom("lead")
    .select(["id", "name", "category", "address", "created_at"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (lead) {
    ev.push({
      at: iso(lead.created_at),
      kind: "lead",
      title: `Lead megtalálva: ${lead.name}`,
      detail: [lead.category, lead.address].filter(Boolean).join(" · "),
      href: `/lead/${lead.id}`,
    });
    const prov = await db
      .selectFrom("lead_provenance")
      .select(({ fn }) => ["source", fn.countAll().as("n"), fn.min("observed_at").as("first")])
      .where("lead_id", "=", leadId)
      .groupBy("source")
      .execute();
    for (const s of prov)
      ev.push({
        at: iso(s.first),
        kind: "lead",
        title: `Adatforrás bekötve: ${s.source}`,
        detail: `${s.n} adatmező`,
        href: `/lead/${leadId}`,
      });
  }

  // mock_artifact + curator_decision: generated / approved / rejected.
  const artifacts = await db
    .selectFrom("mock_artifact")
    .select(["id", "status", "generated_at"])
    .where("lead_id", "=", leadId)
    .execute();
  const artifactIds = artifacts.map((a) => a.id);
  for (const a of artifacts)
    ev.push({
      at: iso(a.generated_at),
      kind: "mock",
      title: "Mock legenerálva",
      detail: "",
      href: `/mock/${a.id}`,
    });
  if (artifactIds.length) {
    const decisions = await db
      .selectFrom("curator_decision")
      .select(["decision", "notes", "decided_by", "decided_at"])
      .where("mock_artifact_id", "in", artifactIds)
      .execute();
    for (const c of decisions)
      ev.push({
        at: iso(c.decided_at),
        kind: "mock",
        title: c.decision === "approve" ? "Mock jóváhagyva" : "Mock elutasítva",
        detail: [c.decided_by, c.notes].filter(Boolean).join(" · "),
        href: null,
      });
  }

  // prospect: outreach sent / unsubscribed.
  const prospects = await db
    .selectFrom("prospect")
    .select(["id", "token", "contact_email", "sent_at", "unsubscribed_at"])
    .where("lead_id", "=", leadId)
    .execute();
  const prospectIds = prospects.map((pr) => pr.id);
  for (const pr of prospects) {
    if (pr.sent_at)
      ev.push({
        at: iso(pr.sent_at),
        kind: "megkeresés",
        title: "Megkeresés kiküldve",
        detail: pr.contact_email ?? "",
        href: `/prospect/${pr.id}/activity`,
      });
    if (pr.unsubscribed_at)
      ev.push({
        at: iso(pr.unsubscribed_at),
        kind: "megkeresés",
        title: "Leiratkozott a megkeresésről",
        detail: "",
        href: null,
      });
  }

  // mock_view + mock_event: the real gold — what they DID on the mock.
  if (prospectIds.length) {
    const views = await db
      .selectFrom("mock_view")
      .select(["id", "prospect_id", "started_at"])
      .where("prospect_id", "in", prospectIds)
      .execute();
    const viewIds = views.map((v) => v.id);
    const events = viewIds.length
      ? await db
          .selectFrom("mock_event")
          .select(["mock_view_id", "type", "payload", "occurred_at"])
          .where("mock_view_id", "in", viewIds)
          .execute()
      : [];
    const byView = new Map<string, typeof events>();
    for (const e of events) {
      const list = byView.get(e.mock_view_id) ?? [];
      list.push(e);
      byView.set(e.mock_view_id, list);
    }
    for (const v of views) {
      const ves = byView.get(v.id) ?? [];
      const maxScroll = ves
        .filter((e) => e.type === "scroll")
        .reduce((m, e) => Math.max(m, Number((e.payload as { pct?: number }).pct ?? 0)), 0);
      const prospect = prospects.find((pr) => pr.id === v.prospect_id);
      ev.push({
        at: iso(v.started_at),
        kind: "aktivitás",
        title: "Megnyitotta a mockot",
        detail: maxScroll ? `${maxScroll}% görgetés` : "",
        href: prospect ? `/prospect/${prospect.id}/activity` : null,
      });
      for (const e of ves) {
        const label = SIGNIFICANT_EVENTS[e.type];
        if (!label) continue;
        const payload = (e.payload ?? {}) as Record<string, unknown>;
        const detail =
          e.type === "module_add" || e.type === "module_remove"
            ? typeof payload.module === "string"
              ? moduleLabel(payload.module)
              : ""
            : e.type === "preset_select"
              ? String(payload.preset ?? "")
              : e.type === "period_select"
                ? payload.period === "annual"
                  ? "éves"
                  : "havi"
                : e.type === "domain_pick"
                  ? String(payload.domain ?? "")
                  : "";
        ev.push({
          at: iso(e.occurred_at),
          kind: "aktivitás",
          title: label,
          detail,
          href: prospect ? `/prospect/${prospect.id}/activity` : null,
        });
      }
    }
  }

  // order_intent: initial orders via the prospects, upsells via the tenant.
  const orders = prospectIds.length
    ? await db
        .selectFrom("order_intent")
        .select([
          "id",
          "price",
          "billing_period",
          "modules",
          "status",
          "created_at",
          "submitted_at",
          "kind",
          "domain_type",
          "domain_name",
        ])
        .where((eb) =>
          eb.or([eb("prospect_id", "in", prospectIds), eb("tenant_id", "=", tenant.id)]),
        )
        .execute()
    : await db
        .selectFrom("order_intent")
        .select([
          "id",
          "price",
          "billing_period",
          "modules",
          "status",
          "created_at",
          "submitted_at",
          "kind",
          "domain_type",
          "domain_name",
        ])
        .where("tenant_id", "=", tenant.id)
        .execute();
  const orderIds = orders.map((o) => o.id);
  for (const o of orders) {
    const kindLabel = o.kind === "upsell" ? "Bővítés (upsell)" : "Megrendelés";
    if (o.submitted_at) {
      const mods = (o.modules ?? []) as string[];
      ev.push({
        at: iso(o.submitted_at),
        kind: "rendelés",
        title: `${kindLabel} elküldve`,
        detail: [
          `${mods.length} modul`,
          o.billing_period === "annual" ? "éves" : "havi",
          o.price != null ? money(o.price, "HUF") : "",
          o.domain_name ?? "",
        ]
          .filter(Boolean)
          .join(" · "),
        href: null,
      });
    } else {
      ev.push({
        at: iso(o.created_at),
        kind: "rendelés",
        title: `${kindLabel} indítva (konfigurátor)`,
        detail: o.status === "abandoned" ? "félbehagyva" : "",
        href: null,
      });
    }
  }

  // payment: initiated / paid / failed.
  if (orderIds.length) {
    const payments = await db
      .selectFrom("payment")
      .select(["amount", "currency", "gateway", "status", "created_at", "paid_at"])
      .where("order_intent_id", "in", orderIds)
      .execute();
    for (const pay of payments) {
      ev.push({
        at: iso(pay.created_at),
        kind: "fizetés",
        title: "Fizetés kezdeményezve",
        detail: `${money(pay.amount, pay.currency)} · ${pay.gateway}`,
        href: null,
      });
      if (pay.status === "paid" && pay.paid_at)
        ev.push({
          at: iso(pay.paid_at),
          kind: "fizetés",
          title: "Fizetés beérkezett",
          detail: money(pay.amount, pay.currency),
          href: null,
        });
      else if (pay.status === "failed")
        ev.push({
          at: iso(pay.created_at),
          kind: "fizetés",
          title: "Fizetés sikertelen",
          detail: money(pay.amount, pay.currency),
          href: null,
        });
    }
  }

  // site + module_entitlement: provisioning, go-live, modules switched on.
  const site = await db
    .selectFrom("site")
    .select(["provisioned_at", "live_at", "slug", "custom_domain"])
    .where("tenant_id", "=", tenant.id)
    .executeTakeFirst();
  if (site) {
    ev.push({
      at: iso(site.provisioned_at),
      kind: "oldal",
      title: "Oldal previzionálva (privát előnézet)",
      detail: "",
      href: `/lead/${leadId}`,
    });
    if (site.live_at)
      ev.push({
        at: iso(site.live_at),
        kind: "oldal",
        title: "Oldal élesítve (publikus)",
        detail: site.custom_domain ?? (site.slug ? `${site.slug}.citoviso.com` : ""),
        href: `/lead/${leadId}`,
      });
  }
  // Conversion switches many modules on in one write — group by second so the
  // timeline shows one row with the list, not a dozen identical rows.
  const ents = await db
    .selectFrom("module_entitlement")
    .select(["module", "active", "created_at"])
    .where("tenant_id", "=", tenant.id)
    .orderBy("created_at", "asc")
    .execute();
  const entGroups = new Map<string, string[]>();
  for (const e of ents) {
    const key = iso(e.created_at).slice(0, 19);
    const list = entGroups.get(key) ?? [];
    list.push(moduleLabel(e.module) + (e.active ? "" : " (már kikapcsolva)"));
    entGroups.set(key, list);
  }
  for (const [key, mods] of entGroups)
    ev.push({
      at: `${key}.000Z`,
      kind: "oldal",
      title: mods.length === 1 ? "Modul bekapcsolva" : `${mods.length} modul bekapcsolva`,
      detail: mods.join(", "),
      href: null,
    });

  // tenant_user: admin access exists / last login (did they EVER log in).
  const users = await db
    .selectFrom("tenant_user")
    .select(["username", "created_at", "last_login_at"])
    .where("tenant_id", "=", tenant.id)
    .execute();
  for (const u of users) {
    ev.push({
      at: iso(u.created_at),
      kind: "admin",
      title: "Admin-hozzáférés létrehozva",
      detail: u.username,
      href: null,
    });
    if (u.last_login_at)
      ev.push({
        at: iso(u.last_login_at),
        kind: "admin",
        title: "Utoljára belépett az adminba",
        detail: u.username,
        href: null,
      });
  }

  return sortDesc(ev);
}

function sortDesc(ev: TimelineEvent[]): TimelineEvent[] {
  return ev.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

// ── Bizonylatok tab (spec §3: MineREAL-minta 1:1) ───────────────────────────

export interface PartnerDocQuery {
  /** outgoing (vevői) | incoming (szállítói) | undefined = mind. */
  direction?: "outgoing" | "incoming";
  /** true = fizetve, false = nem fizetve, undefined = mind. */
  paid?: boolean;
}

export interface PartnerDocRow {
  readonly id: string;
  readonly direction: "outgoing" | "incoming";
  readonly docType: string;
  readonly documentNumber: string | null;
  readonly issueDate: string;
  readonly dueDate: string | null;
  readonly net: number;
  readonly gross: number;
  readonly currency: string;
  readonly paid: boolean;
  readonly paidAt: string | null;
  /** The legal entity whose books carry this document. */
  readonly entityName: string;
  /** Document image on file (document_file) — enables the Számlakép button. */
  readonly hasFile: boolean;
}

/** Aging buckets over the UNPAID items (computed from due_date — never stored). */
export interface AgingBuckets {
  readonly notDue: MoneyByCurrency;
  readonly d1to30: MoneyByCurrency;
  readonly d31to60: MoneyByCurrency;
  readonly d61to90: MoneyByCurrency;
  readonly d90plus: MoneyByCurrency;
}

/** Payment habit, computed from paid_at − due_date (spec: never a column). */
export interface PaymentHabit {
  /** Average settle offset in days; negative = pays before the deadline. */
  readonly avgDays: number;
  /** Share of documents settled by their due date (0..1). */
  readonly onTimeRatio: number;
  /** How many settled documents the numbers stand on. */
  readonly sample: number;
}

export interface PartnerDocuments {
  readonly rows: PartnerDocRow[];
  /** Gross totals of the filtered list, per currency. */
  readonly totalGross: MoneyByCurrency;
  readonly paidGross: MoneyByCurrency;
  readonly openGross: MoneyByCurrency;
  /** Aging over unpaid items matching the DIRECTION filter (paid filter ignored
   *  by design — korosítás is a statement about the open items). */
  readonly aging: AgingBuckets;
  readonly habit: PaymentHabit | null;
}

/** Document list + computed KPIs for the partner's Bizonylatok tab. */
export async function getPartnerDocuments(
  partnerId: string,
  q: PartnerDocQuery = {},
): Promise<PartnerDocuments> {
  let query = db
    .selectFrom("accounting_document")
    .leftJoin("legal_entity", "legal_entity.id", "accounting_document.legal_entity_id")
    .select([
      "accounting_document.id as id",
      "direction",
      "doc_type",
      "document_number",
      "issue_date",
      "due_date",
      "accounting_document.net as net",
      "accounting_document.gross as gross",
      "accounting_document.currency as currency",
      "paid",
      "paid_at",
      "document_file",
      "legal_entity.name as entity_name",
    ])
    .where("partner_id", "=", partnerId)
    .where("accounting_document.status", "!=", "void")
    .orderBy("issue_date", "desc");
  if (q.direction) query = query.where("direction", "=", q.direction);
  const all = await query.execute();

  const add = (m: Record<string, number>, cur: string, v: number) => {
    m[cur] = (m[cur] ?? 0) + v;
  };
  const totalGross: MoneyByCurrency = {};
  const paidGross: MoneyByCurrency = {};
  const openGross: MoneyByCurrency = {};
  const aging = {
    notDue: {} as MoneyByCurrency,
    d1to30: {} as MoneyByCurrency,
    d31to60: {} as MoneyByCurrency,
    d61to90: {} as MoneyByCurrency,
    d90plus: {} as MoneyByCurrency,
  };
  let settleSum = 0;
  let onTime = 0;
  let settled = 0;
  const now = Date.now();

  for (const d of all) {
    const gross = Number(d.gross);
    // Aging: unpaid items only, bucketed by days past due.
    if (!d.paid) {
      const due = d.due_date ? new Date(d.due_date as unknown as string).getTime() : null;
      const overdueDays = due === null ? 0 : Math.floor((now - due) / 86_400_000);
      const bucket =
        due === null || overdueDays <= 0
          ? aging.notDue
          : overdueDays <= 30
            ? aging.d1to30
            : overdueDays <= 60
              ? aging.d31to60
              : overdueDays <= 90
                ? aging.d61to90
                : aging.d90plus;
      add(bucket, d.currency, gross);
    }
    // Payment habit: settled items with both dates.
    if (d.paid && d.paid_at && d.due_date) {
      const diffDays =
        (new Date(d.paid_at as unknown as string).getTime() -
          new Date(d.due_date as unknown as string).getTime()) /
        86_400_000;
      settleSum += diffDays;
      if (diffDays <= 0) onTime++;
      settled++;
    }
  }

  const filtered = q.paid === undefined ? all : all.filter((d) => d.paid === q.paid);
  for (const d of filtered) {
    const gross = Number(d.gross);
    add(totalGross, d.currency, gross);
    add(d.paid ? paidGross : openGross, d.currency, gross);
  }

  return {
    rows: filtered.map((d) => ({
      id: d.id,
      direction: d.direction,
      docType: d.doc_type,
      documentNumber: d.document_number,
      issueDate: iso(d.issue_date),
      dueDate: d.due_date ? iso(d.due_date) : null,
      net: Number(d.net),
      gross: Number(d.gross),
      currency: d.currency,
      paid: d.paid,
      paidAt: d.paid_at ? iso(d.paid_at) : null,
      entityName: d.entity_name ?? "?",
      hasFile: Boolean(d.document_file),
    })),
    totalGross,
    paidGross,
    openGross,
    aging,
    habit: settled ? { avgDays: settleSum / settled, onTimeRatio: onTime / settled, sample: settled } : null,
  };
}

/**
 * The filtered document list as CSV for Excel (spec: Excel-export). UTF-8 BOM +
 * semicolon separator + comma decimals — the trio Hungarian Excel expects; a
 * plain comma-separated file would land in one column.
 */
export function buildDocumentsCsv(docs: PartnerDocuments): string {
  const field = (v: string): string => (/[";\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = [
    ["Számla szám", "Irány", "Típus", "Kelte", "Határidő", "Nettó", "Bruttó", "Deviza", "Fizetve", "Fizetés dátuma", "Könyvelőcég"],
    ...docs.rows.map((r) => [
      r.documentNumber ?? "",
      r.direction === "outgoing" ? "vevői" : "szállítói",
      r.docType,
      r.issueDate.slice(0, 10),
      r.dueDate?.slice(0, 10) ?? "",
      String(r.net).replace(".", ","),
      String(r.gross).replace(".", ","),
      r.currency,
      r.paid ? "igen" : "nem",
      r.paidAt?.slice(0, 10) ?? "",
      r.entityName,
    ]),
  ];
  return "\uFEFF" + lines.map((l) => l.map(field).join(";")).join("\r\n");
}

/** The stored document image (Számlakép) of one document, for streaming. */
export async function getDocumentFile(
  documentId: string,
): Promise<{ file: string; mime: string | null } | null> {
  const d = await db
    .selectFrom("accounting_document")
    .select(["document_file", "document_mime"])
    .where("id", "=", documentId)
    .executeTakeFirst();
  if (!d?.document_file) return null;
  return { file: d.document_file, mime: d.document_mime };
}
