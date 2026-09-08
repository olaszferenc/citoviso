// ADR-0110 — assembling the accommodation's published legal identity.
//
// Three sources, in this order of authority:
//   1. `tenant_legal` — what the owner typed on the admin's "Jogi adatok" panel.
//   2. the buyer record on the most recent order (name, seat, tax number, e-mail):
//      the same person, already verified at checkout, so an untouched tenant still
//      publishes a correct imprint instead of an empty one.
// There is deliberately NO third source. An earlier version fell back to the site's
// own contact details for the phone and e-mail — but only in the RENDERER, not in the
// admin panel, so the owner saw an empty "Közzétett telefonszám" field while the
// imprint published a number (caught by the knowledge-base audit). One source for
// both sides is worth more than a clever fallback: the site's contact block still
// shows the phone to the visitor, it is simply not a published legal fact until the
// owner says so — and Eker.tv. 4. § does not require one.
//
// Anything still unknown stays `null` and renders as a loud missing marker. We do
// not guess, and we do not drop the row: the blind branch is exactly where the
// output is worst, so it has to be the visible one.
import { db } from "../db/client.js";
import { config } from "../config.js";
import type { HostingProviderIdentity, TenantLegalIdentity } from "../legal.js";
import { missingImprintFields } from "../legal.js";

export interface TenantLegalState {
  readonly who: TenantLegalIdentity;
  /** From the buyer record; decides whether a registry number is owed. */
  readonly buyerType: "individual" | "business" | null;
  /** Statutory imprint fields we still do not hold (Eker.tv. 4. §). */
  readonly missing: readonly string[];
  /** True when the tenant has never edited its legal data (values are seeded). */
  readonly seeded: boolean;
}

function trimOrNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

/** '8625' + 'Szólád' + 'Kossuth Lajos utca 12.' → '8625 Szólád, Kossuth Lajos utca 12.' */
function joinAddress(
  zip: string | null,
  city: string | null,
  street: string | null,
): string | null {
  const head = [zip, city].filter(Boolean).join(" ");
  const full = [head, street].filter(Boolean).join(", ");
  return full.trim() ? full : null;
}

export async function loadTenantLegal(tenantId: string): Promise<TenantLegalState> {
  const own = await db
    .selectFrom("tenant_legal")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  // The buyer record of the most recent order that actually carries buyer data —
  // an abandoned intent may have none, and inheriting nulls from it would hide a
  // perfectly good earlier record.
  const buyer = await db
    .selectFrom("order_intent")
    .select([
      "buyer_name",
      "buyer_type",
      "buyer_tax_number",
      "buyer_zip",
      "buyer_city",
      "buyer_address",
      "buyer_email",
    ])
    .where("tenant_id", "=", tenantId)
    .where("buyer_name", "is not", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();

  const who: TenantLegalIdentity = {
    legalName: trimOrNull(own?.legal_name) ?? trimOrNull(buyer?.buyer_name),
    address:
      trimOrNull(own?.address) ??
      joinAddress(
        trimOrNull(buyer?.buyer_zip),
        trimOrNull(buyer?.buyer_city),
        trimOrNull(buyer?.buyer_address),
      ),
    taxNumber: trimOrNull(own?.tax_number) ?? trimOrNull(buyer?.buyer_tax_number),
    // Never inherited: nothing in the checkout asks for a registry number.
    regNumber: trimOrNull(own?.reg_number),
    ntakId: trimOrNull(own?.ntak_id),
    email: trimOrNull(own?.email) ?? trimOrNull(buyer?.buyer_email),
    phone: trimOrNull(own?.phone),
  };

  const buyerType = (buyer?.buyer_type as "individual" | "business" | null | undefined) ?? null;
  return {
    who,
    buyerType,
    missing: missingImprintFields(who, buyerType),
    seeded: !own,
  };
}

/**
 * Us, as the hosting provider named on the tenant's imprint. Facts come from the
 * environment (`config.legalEntity`), the same source our own imprint uses — so
 * they live in the prod .env, not in git. Empty means we do not hold it, and the
 * page says so instead of printing a placeholder.
 */
export function hostingProvider(): HostingProviderIdentity {
  const e = config.legalEntity;
  return {
    name: e.name || "Citoviso",
    address: trimOrNull(e.address),
    email: e.email || "info@citoviso.com",
    site: "citoviso.com",
  };
}

/** Field values coming off the admin form; blank means "clear it". */
export interface TenantLegalEdit {
  readonly legalName?: string | null;
  readonly address?: string | null;
  readonly taxNumber?: string | null;
  readonly regNumber?: string | null;
  readonly ntakId?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
}

/**
 * Save the tenant's published legal data (upsert).
 *
 * Blanks are stored as NULL rather than as empty strings, so "we do not hold it"
 * has ONE representation everywhere — the renderer's missing-marker and the
 * admin's warning then agree by construction instead of by convention.
 */
export async function saveTenantLegal(tenantId: string, edit: TenantLegalEdit): Promise<void> {
  const row = {
    legal_name: trimOrNull(edit.legalName),
    address: trimOrNull(edit.address),
    tax_number: trimOrNull(edit.taxNumber),
    reg_number: trimOrNull(edit.regNumber),
    ntak_id: trimOrNull(edit.ntakId),
    email: trimOrNull(edit.email),
    phone: trimOrNull(edit.phone),
    updated_at: new Date(),
  };
  await db
    .insertInto("tenant_legal")
    .values({ tenant_id: tenantId, ...row })
    .onConflict((oc) => oc.column("tenant_id").doUpdateSet(row))
    .execute();
}
