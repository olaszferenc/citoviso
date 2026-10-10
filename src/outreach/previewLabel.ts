// The lead's OWN preview subdomain — https://<label>.citoviso.com (ADR-0330).
//
// Why (owner, 2026-10-05): the outreach link
//   https://citoviso.com/p/vecsey-apartman/63cNoWfy448yNdmeietS2YWf
// carries the business name already, but the 24-character mixed-case token after it
// "might scare the lead off: what if it is a virus". The owner's ruling: the lead gets
// its own subdomain. If the buyer keeps that address at purchase it stays; if they
// choose another one, the reservation is released.
//
// What the label is NOT: a secret. Anyone typing a business name can open that lead's
// preview — the owner accepted this for the friendlier link (the mock is built from
// public data, noindexed, and framed as a plan). The unguessable /p/<token> link keeps
// working for every message already sent, and every sub-route the page calls
// (/p/<token>/view, /request, /unsubscribe …) still keys on the token.
//
// The label lives on the LEAD, not the prospect: a lead may have several tracked links
// (archived ones, a regenerated mock), but one address. It opens the lead's LIVE
// prospect — the most recent not-archived one — the same rule the console uses.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { PLATFORM_DOMAIN, RESERVED_SLUGS, isPlatformHosting, slugify } from "../domains.js";

/** Longest label we mint (DNS allows 63; a phone screen does not). */
const MAX_LABEL = 40;

/** Trim a slug to MAX_LABEL without leaving a trailing hyphen. */
function clip(slug: string): string {
  return slug.slice(0, MAX_LABEL).replace(/-+$/, "");
}

/**
 * The settlement from a Hungarian address ("8600 Siófok, Vécsey u. 12." → "siofok"),
 * used only to tell two same-named businesses apart. null when the address does not
 * carry the usual "<4-digit postcode> <city>," shape — we never guess one.
 */
export function cityOfAddress(address: string | null | undefined): string | null {
  const m = /\b\d{4}\s+([^,\d]+?)\s*(?:,|$)/.exec(address ?? "");
  const city = m ? slugify(m[1]!) : "";
  return city.length >= 2 ? city : null;
}

/**
 * Candidate labels in preference order: the name, then name + city, then numbered.
 * Pure — the DB decides which is free.
 */
export function labelCandidates(name: string, address: string | null | undefined): string[] {
  const base = clip(slugify(name));
  if (base.length < 3) return [];
  const out = [base];
  const city = cityOfAddress(address);
  if (city && !base.endsWith(`-${city}`)) out.push(clip(`${base.slice(0, MAX_LABEL - city.length - 1)}-${city}`));
  for (let i = 2; i <= 50; i++) out.push(`${base.slice(0, MAX_LABEL - String(i).length - 1).replace(/-+$/, "")}-${i}`);
  return [...new Set(out)].filter((l) => !RESERVED_SLUGS.has(l));
}

/**
 * True when `label` is held by someone other than `leadId`: a site's platform slug of
 * another lead's tenant, a FORMER slug of such a site (ADR-0356: the old address 301s
 * forever, so it is never handed out again), or another lead's preview reservation.
 * A site of THIS lead does not block it (the buyer keeping, or returning to, their own
 * address).
 */
export async function labelHeldByOther(label: string, leadId: string | null): Promise<boolean> {
  const l = label.toLowerCase();
  const site = await db
    .selectFrom("site")
    .leftJoin("tenant", "tenant.id", "site.tenant_id")
    .select(["site.id as id", "tenant.lead_id as leadId"])
    .where(sql<boolean>`lower(site.slug) = ${l}`)
    .executeTakeFirst();
  if (site && site.leadId !== leadId) return true;
  const alias = await db
    .selectFrom("site_slug_alias")
    .innerJoin("site", "site.id", "site_slug_alias.site_id")
    .leftJoin("tenant", "tenant.id", "site.tenant_id")
    .select("tenant.lead_id as leadId")
    .where(sql<boolean>`lower(site_slug_alias.slug) = ${l}`)
    .executeTakeFirst();
  if (alias && alias.leadId !== leadId) return true;
  let q = db.selectFrom("lead").select("id").where(sql<boolean>`lower(preview_label) = ${l}`);
  if (leadId) q = q.where("id", "!=", leadId);
  return !!(await q.executeTakeFirst());
}

/**
 * The lead's preview label — the existing one, or a newly reserved one. Idempotent:
 * once assigned it never changes (it may already be in a sent message). Returns null
 * only when the name yields no usable label (fewer than 3 letters/digits).
 */
export async function ensurePreviewLabel(leadId: string): Promise<string | null> {
  const lead = await db
    .selectFrom("lead")
    .select(["name", "address", "preview_label"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!lead) return null;
  if (lead.preview_label) return lead.preview_label;
  for (const candidate of labelCandidates(lead.name, lead.address)) {
    if (await labelHeldByOther(candidate, leadId)) continue;
    try {
      // `preview_label IS NULL` keeps a concurrent first send from minting twice.
      const r = await db
        .updateTable("lead")
        .set({ preview_label: candidate })
        .where("id", "=", leadId)
        .where("preview_label", "is", null)
        .returning("preview_label")
        .executeTakeFirst();
      if (r?.preview_label) return r.preview_label;
      const again = await db.selectFrom("lead").select("preview_label").where("id", "=", leadId).executeTakeFirst();
      return again?.preview_label ?? null;
    } catch (err) {
      // Unique index (lead_preview_label_uq): another lead took it between the check
      // and the write — try the next candidate.
      if ((err as { code?: string }).code === "23505") continue;
      throw err;
    }
  }
  return null;
}

/**
 * The label ensurePreviewLabel WOULD return, without reserving it — for dry runs that must
 * not mutate (IT D-8k: a `--kapuk` preview minted 8 live preview subdomains). The existing
 * label, else the first free candidate; a later real send may still get another one if a
 * concurrent lead takes it first.
 */
export async function peekPreviewLabel(leadId: string): Promise<string | null> {
  const lead = await db
    .selectFrom("lead")
    .select(["name", "address", "preview_label"])
    .where("id", "=", leadId)
    .executeTakeFirst();
  if (!lead) return null;
  if (lead.preview_label) return lead.preview_label;
  for (const candidate of labelCandidates(lead.name, lead.address)) {
    if (!(await labelHeldByOther(candidate, leadId))) return candidate;
  }
  return null;
}

/**
 * The absolute preview link for a label — ONLY on the real platform, where the
 * wildcard host resolves. Locally (Tailscale / localhost) there is no wildcard DNS,
 * so the caller keeps the /p/<slug>/<token> link that actually opens.
 */
export function previewLink(label: string | null | undefined, publicBaseUrl: string): string | null {
  if (!label || !isPlatformHosting(publicBaseUrl)) return null;
  return `https://${label}.${PLATFORM_DOMAIN}`;
}

/**
 * The token of the prospect a preview host opens: the plan the lead was SENT — the
 * most recently sent, live one first; archiving is not deletion, an address already
 * sent keeps opening. Only a lead with no sent prospect falls back to the newest one.
 * Elek3 A9: ordering by created_at alone opened a newer, never-sent mock variant on the
 * host the lead's letter named. null = no such label (or no prospect yet).
 */
export async function prospectTokenForLabel(label: string): Promise<string | null> {
  const row = await db
    .selectFrom("prospect")
    .innerJoin("lead", "lead.id", "prospect.lead_id")
    .select("prospect.token as token")
    .where(sql<boolean>`lower(lead.preview_label) = ${label.toLowerCase()}`)
    .orderBy(sql`prospect.sent_at IS NOT NULL`, "desc")
    .orderBy(sql`prospect.archived_at IS NULL`, "desc")
    .orderBy(sql`prospect.sent_at desc nulls last`)
    .orderBy("prospect.created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  return row?.token ?? null;
}

/**
 * Purchase (owner's ruling): the address the buyer keeps stays, any other is released.
 * Called after provisioning with the site's final platform slug — when that IS the
 * label, the tenant's live site takes the host over; otherwise the label is freed.
 */
export async function releasePreviewLabelUnlessKept(leadId: string, siteSlug: string | null): Promise<void> {
  await db
    .updateTable("lead")
    .set({ preview_label: null })
    .where("id", "=", leadId)
    .where("preview_label", "is not", null)
    .where(sql<boolean>`lower(preview_label) <> ${(siteSlug ?? "").toLowerCase()}`)
    .execute();
}
