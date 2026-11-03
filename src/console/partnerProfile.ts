// PARTNER PROFILE — the customer/supplier sheet's data beyond the money ledger
// (owner 2026-11-03: „a CRM partner oldalak is semmitmondóak … partnert nem is tudom
// szerkeszteni … Nem látom a saját domainnevüket, ha megrendelték, annak lejáratát, semmit.”).
// Approved plan: assets/design-refs/console/partner-adatlap/ (A — Fülek).
//
// What lives here:
//   · the RELATIONS of a partner: tenant, lead (marketing face), site, tenant users;
//   · the SUBSCRIPTION as the tenant sees it — the next charge comes from the SAME
//     getSubscriptionAdmin() the tenant's own Pénztárca reads, so the console and the
//     customer can never show two different amounts (the first-payment coupon does not
//     renew: Duna Vibe House paid 4 957 Ft, the 12-03 renewal charges 6 610 Ft);
//   · the payments of the partner's tenant;
//   · the custom DOMAINS — from the SUB-E domain registry's getDomainsForTenant()
//     (one source per fact with the /domains list);
//   · the „Figyelendő” attention list derived from the above;
//   · EDITING: validation (the same rules as /partners/new and the checkout) + the
//     transactional update of the partner row and its contacts.
//
// SOURCE RULE (written on the edit form too): the partner row is the operator-maintained
// billing identity — the next invoice, pay request and renewal read it (billing.ts).
// The order's declaration (ADR-0055, immutable), an issued invoice, the lead (marketing
// face) and the tenant's login e-mail are NEVER rewritten from here. A newer order's
// declaration refreshes the partner again (billing/partner.ts upsertPartnerFromOrder).

import { sql } from "kysely";

import { db } from "../db/client.js";
import { huTaxNumberProblem, normalizeHuTaxNumber, parseEuVat } from "../billing/taxId.js";
import { normalizePhone } from "../text/phone.js";
import { getSubscriptionAdmin } from "../tenant/subscriptionAdmin.js";
import { getTenantModules } from "../tenant/modules.js";
import { getDomainsForTenant, type DomainRecord, type DomainStepKey } from "./domainRegistry.js";

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

export interface PartnerRelations {
  readonly tenant: { readonly id: string; readonly displayName: string; readonly status: string; readonly createdAt: string } | null;
  readonly lead: {
    readonly id: string;
    readonly name: string;
    readonly place: string | null;
    readonly stage: string;
    /** The lead's own phone (E.164) — where the cold outreach went. */
    readonly phone: string | null;
  } | null;
  readonly site: {
    readonly status: string;
    readonly slug: string | null;
    readonly customDomain: string | null;
    readonly liveAt: string | null;
    readonly previewToken: string | null;
  } | null;
  readonly users: readonly {
    readonly username: string;
    readonly email: string;
    readonly role: string;
    readonly lastLoginAt: string | null;
    readonly passwordSetAt: string | null;
  }[];
}

export interface PartnerSubscription {
  readonly status: "active" | "past_due" | "frozen" | "cancelled";
  readonly billingPeriod: "monthly" | "annual";
  readonly periodStart: string;
  readonly periodEnd: string;
  /** What the next renewal at periodEnd charges (the tenant Pénztárca's number). */
  readonly nextCharge: number | null;
  /** The monthly rate of the current module set (list price, no coupon). */
  readonly monthlyRate: number | null;
  readonly autoCharge: boolean;
  readonly paymentMethod: "invoice" | "token";
  readonly card: { readonly brand: string | null; readonly last4: string; readonly exp: string | null; readonly savedAt: string | null } | null;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancelledAt: string | null;
  readonly frozenAt: string | null;
  readonly pendingPeriod: "annual" | "monthly" | null;
}

export interface PartnerPayment {
  readonly at: string;
  readonly amount: number;
  readonly currency: string;
  readonly period: string;
  readonly gateway: string;
  readonly ref: string | null;
  readonly status: string;
  readonly kind: string;
}

export interface PartnerDomain {
  readonly domain: string;
  readonly status: string;
  readonly registrarRef: string | null;
  readonly orderedAt: string;
  readonly finishedAt: string | null;
  readonly waitingSince: string | null;
  readonly nsActiveAt: string | null;
  readonly registrarNote: string | null;
  readonly boughtNoticeAt: string | null;
  readonly expiresAt: string | null;
  /** True once the daily renewal sync read the expiry from the registrar. */
  readonly expiresConfirmed: boolean;
  readonly autoRenew: boolean | null;
  readonly renewProblem: string | null;
}

export interface AttentionItem {
  readonly kind: "wait" | "warn" | "bad";
  readonly title: string;
  readonly detail: string;
  /** Present on the „phone missing, the lead has one” item: the number to take over. */
  readonly takePhone?: string;
}

export interface PartnerProfile {
  readonly relations: PartnerRelations;
  readonly subscription: PartnerSubscription | null;
  readonly payments: readonly PartnerPayment[];
  readonly domains: readonly PartnerDomain[];
  readonly attention: readonly AttentionItem[];
}

/** Relations of the partner's tenant (empty for a supplier). */
async function relationsOf(tenantId: string | null): Promise<PartnerRelations> {
  if (!tenantId) return { tenant: null, lead: null, site: null, users: [] };
  const t = await db
    .selectFrom("tenant")
    .select(["id", "lead_id", "display_name", "status", "created_at"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  if (!t) return { tenant: null, lead: null, site: null, users: [] };
  const [lead, site, users] = await Promise.all([
    db.selectFrom("lead").select(["id", "name", "address", "lifecycle_status", "raw"]).where("id", "=", t.lead_id).executeTakeFirst(),
    db
      .selectFrom("site")
      .select(["status", "slug", "custom_domain", "live_at", "preview_token"])
      .where("tenant_id", "=", t.id)
      .executeTakeFirst(),
    db
      .selectFrom("tenant_user")
      .select(["username", "contact_email", "role", "last_login_at", "password_set_at"])
      .where("tenant_id", "=", t.id)
      .orderBy("created_at")
      .execute(),
  ]);
  const raw = (lead?.raw ?? {}) as { city?: string; phone?: string };
  return {
    tenant: { id: t.id, displayName: t.display_name, status: t.status, createdAt: iso(t.created_at)! },
    lead: lead
      ? {
          id: lead.id,
          name: lead.name,
          place: [raw.city, lead.address].filter(Boolean).join(", ") || null,
          stage: lead.lifecycle_status,
          phone: raw.phone ? normalizePhone(String(raw.phone)) : null,
        }
      : null,
    site: site
      ? {
          status: site.status,
          slug: site.slug,
          customDomain: site.custom_domain,
          liveAt: iso(site.live_at),
          previewToken: site.preview_token,
        }
      : null,
    users: users.map((u) => ({
      username: u.username,
      email: u.contact_email,
      role: u.role,
      lastLoginAt: iso(u.last_login_at),
      passwordSetAt: iso(u.password_set_at),
    })),
  };
}

async function subscriptionOf(tenantId: string): Promise<PartnerSubscription | null> {
  const s = await db
    .selectFrom("subscription")
    .select([
      "status",
      "billing_period",
      "current_period_start",
      "current_period_end",
      "payment_method",
      "card_brand",
      "card_last4",
      "card_exp_month",
      "card_exp_year",
      "card_saved_at",
      "cancel_at_period_end",
      "cancelled_at",
      "frozen_at",
      "pending_period",
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!s) return null;
  // The tenant's own Pénztárca model — read-only; null-safe (a model that cannot be
  // built must not take the partner page down with it).
  let nextCharge: number | null = null;
  let monthlyRate: number | null = null;
  let autoCharge = s.payment_method === "token";
  try {
    const admin = await getSubscriptionAdmin(tenantId, await getTenantModules(tenantId));
    if (admin) {
      nextCharge = admin.nextChargeTotal;
      monthlyRate = admin.nextInvoiceTotal;
      autoCharge = admin.autoCharge;
    }
  } catch (err) {
    console.warn(`[partner] a megújítási összeg nem számolható (${tenantId}): ${(err as Error).message}`); // i18n-exempt: operátori napló
  }
  const day = (v: unknown) => iso(v)!.slice(0, 10);
  return {
    status: s.status,
    billingPeriod: s.billing_period,
    periodStart: day(s.current_period_start),
    periodEnd: day(s.current_period_end),
    nextCharge,
    monthlyRate,
    autoCharge,
    paymentMethod: s.payment_method,
    card: s.card_last4
      ? {
          brand: s.card_brand,
          last4: s.card_last4,
          exp: s.card_exp_month && s.card_exp_year ? `${String(s.card_exp_month).padStart(2, "0")}/${s.card_exp_year}` : null,
          savedAt: iso(s.card_saved_at),
        }
      : null,
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
    cancelledAt: iso(s.cancelled_at),
    frozenAt: iso(s.frozen_at),
    pendingPeriod: s.pending_period,
  };
}

/** Every payment of the tenant: the initial order hangs off the lead's prospect, the
 *  later ones (renewal, upsell, …) off the tenant — the same chain getPartnerDetail uses. */
async function paymentsOf(tenantId: string, leadId: string): Promise<PartnerPayment[]> {
  const rows = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .leftJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select([
      "payment.created_at",
      "payment.paid_at",
      "payment.amount",
      "payment.currency",
      "payment.period",
      "payment.gateway",
      "payment.gateway_ref",
      "payment.status",
      "order_intent.kind",
    ])
    .where((eb) =>
      eb.or([
        eb.and([eb("prospect.lead_id", "=", leadId), eb("order_intent.kind", "=", "initial")]),
        eb("order_intent.tenant_id", "=", tenantId),
      ]),
    )
    // Reservations and abandoned pay attempts are noise on a customer sheet.
    .where("payment.status", "in", ["paid", "failed", "pending"])
    .orderBy("payment.created_at", "desc")
    .limit(100)
    .execute();
  return rows.map((r) => ({
    at: iso(r.paid_at ?? r.created_at)!,
    amount: r.amount,
    currency: r.currency,
    period: r.period,
    gateway: r.gateway,
    ref: r.gateway_ref,
    status: r.status,
    kind: r.kind,
  }));
}

/** The tenant's custom domains — read from the SUB-E domain registry (one source per fact:
 *  the /domains list and this block show the same record). The newest attempt per name. */
export async function partnerDomains(tenantId: string): Promise<PartnerDomain[]> {
  const records = await getDomainsForTenant(tenantId);
  const stepAt = (r: DomainRecord, k: DomainStepKey): Date | null => r.steps.find((st) => st.key === k)?.at ?? null;
  return records.map((r) => ({
    domain: r.domain,
    status: r.status,
    registrarRef: r.registrarRef,
    orderedAt: iso(stepAt(r, "ordered") ?? r.startedAt)!,
    finishedAt: iso(stepAt(r, "live")),
    waitingSince: iso(r.waitingSince),
    nsActiveAt: iso(stepAt(r, "ns")),
    registrarNote: r.registrarNote,
    boughtNoticeAt: iso(stepAt(r, "bought")),
    expiresAt: iso(r.expiresAt),
    expiresConfirmed: Boolean(r.expiresAt) && !r.expiryEstimated,
    autoRenew: r.autoRenew,
    renewProblem: r.renewProblem,
  }));
}

const DOMAIN_WAITING = new Set(["pending", "registering", "registered", "dns_pending", "tls_pending", "setup_retry"]);

/** „Figyelendő”: only facts that ask for attention, each with what is going on. */
export function attentionFor(
  partner: { readonly phone: string | null },
  rel: PartnerRelations,
  sub: PartnerSubscription | null,
  domains: readonly PartnerDomain[],
  fmtTime: (isoTs: string) => string,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const d of domains) {
    if (d.status === "failed")
      out.push({ kind: "bad", title: `${d.domain} — a beszerzés sikertelen`, detail: "A név nem lett a miénk; a rendelés kézi rendezést kér." });
    else if (d.status === "dns_pending" && d.domain.endsWith(".hu"))
      out.push({
        kind: "wait",
        title: `${d.domain} — a .hu Nyilvántartó megerősítésére vár`,
        detail: `A név megvéve${d.registrarRef ? ` (rendelés ${d.registrarRef})` : ""}; a DNS a cfm.drr.hu megerősítés után áll be.${d.waitingSince ? ` ${fmtTime(d.waitingSince)} óta vár.` : ""}`,
      });
    else if (DOMAIN_WAITING.has(d.status))
      out.push({
        kind: "wait",
        title: `${d.domain} — beállítás alatt`,
        detail: `Állapot: ${d.status}${d.waitingSince ? `, ${fmtTime(d.waitingSince)} óta` : ""}.`,
      });
    if (d.renewProblem) out.push({ kind: "bad", title: `${d.domain} — megújítási gond`, detail: d.renewProblem });
    else if (d.expiresAt && !d.expiresConfirmed && d.status !== "failed")
      out.push({
        kind: "warn",
        title: "A domain lejárata még nem a regisztrátortól jön",
        detail: `${d.expiresAt.slice(0, 10)} = helyben számolt érték; a napi megújítás-szinkron olvassa le a valódit.`,
      });
  }
  if (!partner.phone && rel.lead?.phone)
    out.push({
      kind: "warn",
      title: "A partneren nincs telefonszám",
      detail: "A lead-adatban van:",
      takePhone: rel.lead.phone,
    });
  if (sub?.status === "past_due") out.push({ kind: "bad", title: "Elmaradt fizetés", detail: `A ${sub.periodEnd}-i terhelés nem sikerült.` });
  if (sub?.status === "frozen") out.push({ kind: "bad", title: "Az előfizetés befagyasztva", detail: "Fizetés hiányában a honlap nem elérhető." });
  if (sub?.cancelAtPeriodEnd) out.push({ kind: "warn", title: "Lemondta az előfizetést", detail: `A ${sub.periodEnd}-i időszakvég lezárja.` });
  if (sub?.card?.exp) {
    const [mm, yyyy] = sub.card.exp.split("/").map(Number);
    const end = new Date(Date.UTC(yyyy!, mm!, 1)); // first day after the expiry month
    if (end.getTime() <= new Date(`${sub.periodEnd}T00:00:00Z`).getTime() + 86_400_000)
      out.push({ kind: "warn", title: "A mentett kártya lejár a következő terhelés előtt", detail: `${sub.card.brand ?? ""} ••${sub.card.last4}, lejárat ${sub.card.exp}.` });
  }
  return out;
}

export async function getPartnerProfile(
  partner: { readonly tenantId: string | null; readonly phone: string | null },
  fmtTime: (isoTs: string) => string,
): Promise<PartnerProfile> {
  const relations = await relationsOf(partner.tenantId);
  const tid = relations.tenant?.id ?? null;
  const [subscription, payments, domains] = tid
    ? await Promise.all([subscriptionOf(tid), paymentsOf(tid, relations.lead?.id ?? ""), partnerDomains(tid)])
    : [null, [], []];
  return {
    relations,
    subscription,
    payments,
    domains,
    attention: attentionFor(partner, relations, subscription, domains, fmtTime),
  };
}

// ── EDITING ──────────────────────────────────────────────────────────────────

export type ContactKind = "billing" | "general" | "technical" | "legal";
export const CONTACT_KINDS: readonly ContactKind[] = ["billing", "general", "technical", "legal"];

export interface PartnerContactInput {
  readonly id: string | null;
  readonly kind: ContactKind;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly primary: boolean;
}

export interface PartnerEditInput {
  readonly name: string;
  readonly country: string;
  readonly zip: string;
  readonly city: string;
  readonly address: string;
  readonly taxNumber: string;
  readonly euVatNumber: string;
  readonly email: string;
  readonly phone: string;
  readonly note: string;
  readonly contacts: readonly PartnerContactInput[];
  /** The company e-mail changed: move the primary billing recipient along. */
  readonly syncBilling: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Field → problem (Hungarian, operator-facing). Empty = valid. The client form mirrors
 *  these rules; this is the authority. */
export function partnerEditProblems(v: PartnerEditInput): Record<string, string> {
  const p: Record<string, string> = {};
  const country = v.country.trim().toUpperCase();
  if (v.name.trim().length < 2) p.name = "A számlázási név kötelező (legalább 2 karakter).";
  if (!/^[A-Z]{2}$/.test(country)) p.country = "Az ország ISO-2 kód (pl. HU, DE).";
  if (country === "HU" && v.zip.trim() && !/^[1-9][0-9]{3}$/.test(v.zip.trim())) p.zip = "Magyar irányítószám: 4 számjegy (pl. 1188).";
  if (country === "HU" && v.taxNumber.trim()) {
    const why = huTaxNumberProblem(v.taxNumber);
    if (why) p.tax = why;
  }
  if (v.euVatNumber.trim() && !parseEuVat(v.euVatNumber, country)) p.euvat = "A közösségi adószám alakja nem érvényes (pl. DE812871812).";
  if (v.email.trim() && !EMAIL.test(v.email.trim())) p.email = "Ez nem e-mail-cím alak (pl. nev@domain.hu).";
  if (v.phone.trim() && !normalizePhone(v.phone)) p.phone = "Nem érvényes telefonszám — a magyar számnál a körzet/szolgáltató és a hossz is számít.";
  v.contacts.forEach((c, i) => {
    if (!c.email.trim() && !c.phone.trim()) p[`c${i}`] = "Adj meg e-mailt vagy telefont.";
    else if (c.email.trim() && !EMAIL.test(c.email.trim())) p[`c${i}`] = "Hibás e-mail.";
    else if (c.phone.trim() && !normalizePhone(c.phone)) p[`c${i}`] = "Hibás telefonszám.";
  });
  for (const k of CONTACT_KINDS) {
    const inKind = v.contacts.filter((c) => c.kind === k);
    if (inKind.filter((c) => c.primary).length > 1) p.contacts = "Szerepenként egy elsődleges lehet.";
    const mails = inKind.map((c) => c.email.trim().toLowerCase()).filter(Boolean);
    if (new Set(mails).size !== mails.length) p.contacts = "Ugyanaz az e-mail egy szerepben csak egyszer szerepelhet.";
  }
  // A customer's invoice must go somewhere: when billing contacts exist, one is primary with e-mail.
  const billing = v.contacts.filter((c) => c.kind === "billing");
  if (billing.length && !billing.some((c) => c.primary && c.email.trim()))
    p.contacts = "Kell egy elsődleges SZÁMLÁZÁSI e-mail — oda megy a számla.";
  return p;
}

export type PartnerUpdateResult = { readonly ok: true } | { readonly ok: false; readonly problems: Record<string, string> };

/** Validate + write the partner row and its contacts in one transaction. */
/** `by` = operator_user.id (the audit columns are FKs to it), null when unknown. */
export async function updatePartner(partnerId: string, v: PartnerEditInput, by: string | null): Promise<PartnerUpdateResult> {
  const problems = partnerEditProblems(v);
  if (Object.keys(problems).length) return { ok: false, problems };
  const country = v.country.trim().toUpperCase();
  const s = (x: string) => x.trim() || null;
  const tax = v.taxNumber.trim() ? (country === "HU" ? normalizeHuTaxNumber(v.taxNumber) : v.taxNumber.trim()) : null;
  const eu = v.euVatNumber.trim() ? (parseEuVat(v.euVatNumber, country)?.formatted ?? null) : null;
  const email = s(v.email);
  const phone = v.phone.trim() ? normalizePhone(v.phone) : null;

  try {
    return await writePartner(partnerId, v, by, { country, tax, eu, email, phone });
  } catch (err) {
    // The unique indexes are the real guard (tax / EU VAT / contact e-mail per role).
    if ((err as { code?: string }).code === "23505")
      return { ok: false, problems: { contacts: "Ütközés egy másik rekorddal (adószám vagy ismétlődő e-mail) — nem mentettem." } };
    throw err;
  }
}

async function writePartner(
  partnerId: string,
  v: PartnerEditInput,
  by: string | null,
  n: { country: string; tax: string | null; eu: string | null; email: string | null; phone: string | null },
): Promise<PartnerUpdateResult> {
  const { country, tax, eu, email, phone } = n;
  const s = (x: string) => x.trim() || null;
  return db.transaction().execute(async (trx): Promise<PartnerUpdateResult> => {
    const before = await trx.selectFrom("partner").select(["id", "email"]).where("id", "=", partnerId).forUpdate().executeTakeFirst();
    if (!before) return { ok: false, problems: { name: "Nincs ilyen partner." } };
    // The tax number is the partner's identity key — two partners must not share it.
    if (tax) {
      const twin = await trx.selectFrom("partner").select("id").where("tax_number", "=", tax).where("id", "!=", partnerId).executeTakeFirst();
      if (twin) return { ok: false, problems: { tax: "Ez az adószám már egy másik partneren áll." } };
    }
    await trx
      .updateTable("partner")
      .set({
        name: v.name.trim(),
        country,
        zip: s(v.zip),
        city: s(v.city),
        address: s(v.address),
        tax_number: tax,
        eu_vat_number: eu,
        email,
        phone,
        note: s(v.note),
        updated_at: sql`now()`,
        updated_by: by,
      })
      .where("id", "=", partnerId)
      .execute();

    let contacts = v.contacts.map((c) => ({
      ...c,
      email: c.email.trim().toLowerCase(),
      phone: c.phone.trim() ? (normalizePhone(c.phone) ?? c.phone.trim()) : "",
    }));
    if (v.syncBilling && email && before.email && email.toLowerCase() !== before.email.toLowerCase())
      contacts = contacts.map((c) =>
        c.kind === "billing" && c.primary && c.email === before.email!.toLowerCase() ? { ...c, email: email.toLowerCase() } : c,
      );

    // Contacts: removed rows go, kept rows update, new rows insert. Primaries are cleared
    // first so the one-primary-per-kind index never sees two during the swap.
    const existing = await trx.selectFrom("partner_contact").select("id").where("partner_id", "=", partnerId).execute();
    const keep = new Set(contacts.map((c) => c.id).filter((x): x is string => Boolean(x)));
    const gone = existing.map((r) => r.id).filter((x) => !keep.has(x));
    if (gone.length) await trx.deleteFrom("partner_contact").where("id", "in", gone).execute();
    await trx.updateTable("partner_contact").set({ is_primary: false }).where("partner_id", "=", partnerId).execute();
    for (const c of contacts) {
      const row = { kind: c.kind, name: c.name.trim() || null, email: c.email || null, phone: c.phone || null, is_primary: c.primary };
      if (c.id && existing.some((e) => e.id === c.id))
        await trx
          .updateTable("partner_contact")
          .set({ ...row, active: true, updated_at: sql`now()`, updated_by: by })
          .where("id", "=", c.id)
          .where("partner_id", "=", partnerId)
          .execute();
      else await trx.insertInto("partner_contact").values({ ...row, partner_id: partnerId, created_by: by }).execute();
    }
    return { ok: true };
  });
}

/** The editable contact rows (active and inactive), in display order, with ids. */
export async function getEditableContacts(partnerId: string): Promise<(PartnerContactInput & { readonly note: string | null })[]> {
  const rows = await db
    .selectFrom("partner_contact")
    .select(["id", "kind", "name", "email", "phone", "is_primary", "note"])
    .where("partner_id", "=", partnerId)
    .orderBy("kind")
    .orderBy("is_primary", "desc")
    .orderBy("created_at")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    primary: r.is_primary,
    note: r.note,
  }));
}
