// Domain beszerzés állapotgép (ADR-0071). A domain-vétel VALÓDI PÉNZ és nem visszáru
// (🚪 egyirányú), ezért a pipeline IDEMPOTENS és ÚJRAFUTTATHATÓ: egy crash a több-perces
// TLS-propagáció alatt sosem hagyhat fél állapotot. Minden lépés PERZISZTÁL, mielőtt a
// következőbe lép, így a `runDomainProvisioning` bárhonnan folytatja, ahol elakadt.
//
//   pending → registering → registered → dns_pending → tls_pending → live   (+ failed)
//
// A `site.custom_domain` CSAK a tls_pending→live átmenetnél íródik be — előbb nem,
// különben a public.ts (ADR-0041) egy még nem élő hosztra 301-ezne. A live lépés
// re-rendereli a snapshotot, hogy a canonical/og:url az új domainre álljon
// (reference_snapshot_rerender_propagation: a canonical a statikus HTML-be van sütve).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { getRegistrar, DomainTakenError } from "./registrar/index.js";
import { getDns } from "./dns/index.js";
import { getEmailSender } from "../email/sender.js";
import { buildDomainLiveEmail, buildDomainFailedEmail } from "../email/domainEmail.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { PLATFORM_DOMAIN } from "../domains.js";

/**
 * Igaz, ha a domain-beszerzés MOCK adaptereken fut (lokál fejlesztés/teszt).
 *
 * MIÉRT KELL EZ (tulaj kérése, 2026-08-27: „lokálon legyen tesztelhető, ne igényeljünk
 * tényleg honlapot a tesztfolyamat közben"): a mock „megveszi" pl. a napfenypanzio.hu-t
 * és beírja a `site.custom_domain`-be — onnantól az ADR-0041 301-e a slug-hosztról egy
 * NEM LÉTEZŐ címre irányítana, és a lokál teszt-honlap halott lenne. Mock módban tehát a
 * régi (slug) cím marad kiszolgálva; a felület viszont a valós állapotot mutatja, hogy a
 * folyamat végig tesztelhető legyen.
 *
 * Élesben (REGISTRAR_PROVIDER=inwx) ez false → a 301 normálisan működik.
 */
export function isMockDomainProvisioning(): boolean {
  return config.domains.registrarProvider.toLowerCase() !== "inwx";
}

export type DomainProvisioningStatus =
  | "pending"
  | "registering"
  | "registered"
  | "dns_pending"
  | "tls_pending"
  | "live"
  | "failed";

export interface StartDomainInput {
  readonly tenantId: string;
  readonly siteId: string;
  readonly orderIntentId: string | null;
  /** Normalized, registrable domain (domains.ts::normalizeCustomDomain). */
  readonly domain: string;
  /** Registration period in years (≥1). The 24-month SUBSCRIPTION commitment is separate. */
  readonly years: number;
}

/**
 * Értesítés a tenantnak a beszerzés VÉGÁLLAPOTÁRÓL (ADR-0078).
 *
 * A felület és a tudásbázis is ígéri („e-mailben jelezzük, amint kész") — az ígéretet a
 * rendszernek teljesítenie kell. Best-effort: ha a levél nem megy ki, az NEM ronthatja el
 * a beszerzést (a domain már a tenanté), ezért csak naplózunk. A tenant a SAJÁT
 * site-nyelvén kapja (§B.18).
 */
async function notifyTenant(
  tenantId: string,
  siteId: string,
  outcome: "live" | "failed",
  domain: string,
): Promise<void> {
  try {
    const user = await db
      .selectFrom("tenant_user")
      .select(["contact_email"])
      .where("tenant_id", "=", tenantId)
      .where("contact_email", "is not", null)
      .executeTakeFirst();
    const to = user?.contact_email;
    if (!to) return; // nincs hova — a beszerzés ettől még érvényes

    const site = await db
      .selectFrom("site")
      .select(["slug"])
      .where("id", "=", siteId)
      .executeTakeFirst();
    const lang = await prepareMailLang(await langForTenant(tenantId));
    const msg =
      outcome === "live"
        ? buildDomainLiveEmail({
            to,
            domain,
            previousHost: site?.slug ? `${site.slug}.${PLATFORM_DOMAIN}` : null,
            lang,
          })
        : buildDomainFailedEmail({
            to,
            domain,
            adminUrl: `${config.publicSiteUrl}/admin?tab=webcim`,
            lang,
          });
    await getEmailSender().send(msg);
    // ADR-0084: the same notice into the tenant's own mailbox.
    await logTenantMessage({
      tenantId,
      channel: "email",
      kind: "domain",
      subject: msg.subject,
      bodyText: msg.text,
      recipient: to,
    });
  } catch (e) {
    console.error(`[domain] értesítő e-mail nem ment ki (${tenantId}, ${outcome}):`, e);
  }
}

/** Mirror a provisioning status onto BOTH the append-only row and the site (1:1). */
async function setStatus(
  provisioningId: string,
  siteId: string,
  status: DomainProvisioningStatus,
  extra: { registrarRef?: string | null; error?: string | null } = {},
): Promise<void> {
  const finished = status === "live" || status === "failed";
  await db
    .updateTable("domain_provisioning")
    .set({
      status,
      ...(extra.registrarRef !== undefined ? { registrar_ref: extra.registrarRef } : {}),
      ...(extra.error !== undefined ? { error: extra.error } : {}),
      ...(finished ? { finished_at: new Date() } : {}),
    })
    .where("id", "=", provisioningId)
    .execute();
  await db
    .updateTable("site")
    .set({
      custom_domain_status: status,
      ...(extra.registrarRef !== undefined ? { registrar_ref: extra.registrarRef } : {}),
      domain_provision_error: extra.error ?? null,
    })
    .where("id", "=", siteId)
    .execute();
}

/**
 * Create (or reuse) the beszerzés record and mark the site `pending`. Called from the
 * payment webhook `paid` branch — the FIZETÉS is the trigger, no human approval.
 * Idempotent per domain: the partial unique index refuses a second RUNNING row for the
 * same domain, so a double webhook cannot start two purchases.
 */
export async function startDomainProvisioning(input: StartDomainInput): Promise<string> {
  const existing = await db
    .selectFrom("domain_provisioning")
    .select(["id"])
    .where(sql<string>`lower(domain)`, "=", input.domain.toLowerCase())
    .where("status", "not in", ["live", "failed"])
    .executeTakeFirst();
  if (existing) return existing.id;

  const row = await db
    .insertInto("domain_provisioning")
    .values({
      site_id: input.siteId,
      tenant_id: input.tenantId,
      order_intent_id: input.orderIntentId,
      domain: input.domain,
      status: "pending",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .updateTable("site")
    .set({ custom_domain_status: "pending", domain_provision_error: null })
    .where("id", "=", input.siteId)
    .execute();
  return row.id;
}

/**
 * The FIZETÉS-triggered entry point (called detached from the payment webhook, ADR-0071).
 * Reads the paid order's custom-domain choice, finds the tenant's site, and starts +
 * runs the beszerzés. Returns null when the order carries no custom domain to register
 * (a plain citoviso_sub / own order — nothing to buy). No human approval: the buyer
 * chose the domain and paid, so registering it IS the purchased service.
 */
export async function provisionOrderDomain(
  orderIntentId: string,
): Promise<DomainProvisioningStatus | null> {
  const order = await db
    .selectFrom("order_intent")
    .select(["tenant_id", "domain_type", "domain_name"])
    .where("id", "=", orderIntentId)
    .executeTakeFirst();
  if (!order || order.domain_type !== "citoviso_registered" || !order.domain_name) return null;

  // domain_upgrade orders carry tenant_id directly; 'initial' orders carry it NULL
  // (the CHECK enforces that) and only get a tenant after activate() — resolve that
  // tenant via the order → prospect → lead → tenant chain (as tenant/editor.ts does).
  let tenantId = order.tenant_id;
  if (!tenantId) {
    const t = await db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .innerJoin("tenant", "tenant.lead_id", "prospect.lead_id")
      .select("tenant.id as id")
      .where("order_intent.id", "=", orderIntentId)
      .executeTakeFirst();
    tenantId = t?.id ?? null;
  }
  if (!tenantId) return null;

  const site = await db
    .selectFrom("site")
    .select(["id"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!site) return null;

  const id = await startDomainProvisioning({
    tenantId,
    siteId: site.id,
    orderIntentId,
    domain: order.domain_name,
    years: 1, // the driver recomputes from commitment_months; kept for the type only
  });
  return runDomainProvisioning(id);
}

/**
 * Drive one beszerzés forward from wherever it is. Safe to re-run: each state re-enters
 * only the step it is on. Returns the status it reached — `tls_pending`/`dns_pending`
 * mean "propagation not done yet, call again later" (a poller/cron re-invokes); `live`
 * or `failed` are terminal. With the mock adapters the whole chain completes in one call.
 */
export async function runDomainProvisioning(provisioningId: string): Promise<DomainProvisioningStatus> {
  const p = await db
    .selectFrom("domain_provisioning")
    .innerJoin("site", "site.id", "domain_provisioning.site_id")
    .leftJoin("order_intent", "order_intent.id", "domain_provisioning.order_intent_id")
    .select([
      "domain_provisioning.id as id",
      "domain_provisioning.site_id as siteId",
      "domain_provisioning.tenant_id as tenantId",
      "domain_provisioning.domain as domain",
      "domain_provisioning.status as status",
      "domain_provisioning.registrar_ref as registrarRef",
      "order_intent.commitment_months as commitmentMonths",
    ])
    .where("domain_provisioning.id", "=", provisioningId)
    .executeTakeFirst();
  if (!p) throw new Error(`domain_provisioning ${provisioningId} nem található`);
  if (p.status === "live" || p.status === "failed") return p.status;

  const registrar = getRegistrar();
  const dns = getDns();
  // Registration period: cover the subscription commitment, min. 1 year. The
  // 24-month commitment (ADR-0020) ⇒ 2 years; a plain order ⇒ 1 year.
  const years = Math.max(1, Math.ceil((p.commitmentMonths ?? 12) / 12));

  try {
    let status = p.status as DomainProvisioningStatus;
    let registrarRef = p.registrarRef;

    // 1) pending → registering → registered: atomic buy at the registrar.
    if (status === "pending" || status === "registering") {
      await setStatus(p.id, p.siteId, "registering");
      const reg = await registrar.register(p.domain, { years });
      registrarRef = reg.registrarRef;
      await db
        .updateTable("site")
        .set({ domain_registered_at: reg.registeredUntil ?? null })
        .where("id", "=", p.siteId)
        .execute();
      await setStatus(p.id, p.siteId, "registered", { registrarRef });
      status = "registered";
    }

    // 2) registered → dns_pending: create the zone, delegate NS, point at our server.
    if (status === "registered") {
      const zone = await dns.createZone(p.domain);
      await registrar.setNameservers(p.domain, zone.nameservers);
      if (config.domains.serverIp) await dns.pointToServer(p.domain, config.domains.serverIp);
      await setStatus(p.id, p.siteId, "dns_pending", { registrarRef });
      status = "dns_pending";
    }

    // 3) dns_pending → tls_pending: wait for NS delegation to activate.
    if (status === "dns_pending") {
      const zs = await dns.zoneStatus(p.domain);
      if (zs !== "active") return "dns_pending"; // propagation not done — re-run later
      await setStatus(p.id, p.siteId, "tls_pending", { registrarRef });
      status = "tls_pending";
    }

    // 4) tls_pending → live: wait for the certificate, then flip the domain live.
    if (status === "tls_pending") {
      const cs = await dns.certificateStatus(p.domain);
      if (cs !== "active") return "tls_pending"; // cert not issued yet — re-run later
      // The domain goes live: NOW the public host serves it and the slug host 301s.
      await db
        .updateTable("site")
        .set({ custom_domain: p.domain })
        .where("id", "=", p.siteId)
        .execute();
      // Canonical/og:url are baked into the static snapshot → re-render for the new host.
      await rerenderTenantSnapshot(p.tenantId, { as: "live" });
      await setStatus(p.id, p.siteId, "live", { registrarRef, error: null });
      // A felület ezt ígéri („e-mailben jelezzük, amint kész") — teljesítjük.
      await notifyTenant(p.tenantId, p.siteId, "live", p.domain);
      return "live";
    }

    return status;
  } catch (err) {
    const msg = err instanceof DomainTakenError ? err.message : String((err as Error)?.message ?? err);
    await setStatus(p.id, p.siteId, "failed", { error: msg });
    // A tenant fizetett és vár — a kudarcról MAGUNKTÓL szólunk, nem hagyjuk, hogy
    // legközelebbi belépéskor szembesüljön vele.
    await notifyTenant(p.tenantId, p.siteId, "failed", p.domain);
    return "failed";
  }
}

/**
 * Re-drive every unfinished beszerzés (ADR-0071). NS-delegation + Universal SSL take
 * MINUTES, so a beszerzés that reached dns_pending/tls_pending during the webhook
 * parks there and must be nudged forward later — that is what this does, called from
 * a scheduled job (scripts/resume-domains.mts). Terminal rows (live/failed) are skipped.
 * Runs sequentially: a handful of in-flight domains at pilot scale, and each step is a
 * couple of API calls — no need to fan out.
 */
export async function resumePendingDomainProvisionings(): Promise<
  { id: string; domain: string; status: DomainProvisioningStatus }[]
> {
  const rows = await db
    .selectFrom("domain_provisioning")
    .select(["id", "domain"])
    .where("status", "in", ["pending", "registering", "registered", "dns_pending", "tls_pending"])
    .orderBy("created_at", "asc")
    .execute();
  const out: { id: string; domain: string; status: DomainProvisioningStatus }[] = [];
  for (const r of rows) {
    const status = await runDomainProvisioning(r.id);
    out.push({ id: r.id, domain: r.domain, status });
  }
  return out;
}
