// Domain beszerzés állapotgép (ADR-0071). A domain-vétel VALÓDI PÉNZ és nem visszáru
// (🚪 egyirányú), ezért a pipeline IDEMPOTENS és ÚJRAFUTTATHATÓ: egy crash a több-perces
// TLS-propagáció alatt sosem hagyhat fél állapotot. Minden lépés PERZISZTÁL, mielőtt a
// következőbe lép, így a `runDomainProvisioning` bárhonnan folytatja, ahol elakadt.
//
//   pending → registering → registered → dns_pending → tls_pending → live   (+ failed)
//   registered/dns_pending/tls_pending ──(DNS/TLS error)──▶ setup_retry ──(timer)──▶ registered …
//
// ADR-XXXX (Elek 10-11): `failed` means "we could NOT buy the name" (the hold is released).
// Once the registrar sold it to us the name is the tenant's and the money is taken, so a
// later DNS/TLS error is `setup_retry` — retried by the resume timer, the operator alerted —
// never "someone else took it". And a tenant has at most ONE domain order in flight: a
// second paid order for a tenant that already has a live or running one is refused here
// and its hold released (two tabs, a double click, two parallel webhooks).
//
// A `site.custom_domain` CSAK a tls_pending→live átmenetnél íródik be — előbb nem,
// különben a public.ts (ADR-0041) egy még nem élő hosztra 301-ezne. A live lépés
// re-rendereli a snapshotot, hogy a canonical/og:url az új domainre álljon
// (reference_snapshot_rerender_propagation: a canonical a statikus HTML-be van sütve).

import { sql } from "kysely";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { rerenderTenantSnapshot } from "../tenant/editor.js";
import { getRegistrar, DomainTakenError, LIVE_REGISTRAR_PROVIDERS } from "./registrar/index.js";
import { getDns } from "./dns/index.js";
import { getEmailSender } from "../email/sender.js";
import { buildDomainLiveEmail, buildDomainFailedEmail, buildDomainSetupDelayedEmail } from "../email/domainEmail.js";
import { alertHouse } from "../console/houseAlert.js";
import { langForTenant, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "../tenant/messages.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { assertUnderCostCap } from "./costCap.js";

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
 * Élesben (bármely VALÓDI registrar, ADR-0103 óta a websupport) ez false → a 301 normálisan
 * működik. A lista a selectorból jön: ha csak itt szerepelne a provider neve, egy új registrar
 * bekötése némán mock-nak minősítené az éles beszerzést (pontosan ez történt a websupporttal).
 */
export function isMockDomainProvisioning(): boolean {
  return !LIVE_REGISTRAR_PROVIDERS.includes(config.domains.registrarProvider.toLowerCase());
}

export type DomainProvisioningStatus =
  | "pending"
  | "registering"
  | "registered"
  | "dns_pending"
  | "tls_pending"
  /** ADR-XXXX: bought + paid, the DNS/TLS setup failed and is being retried. */
  | "setup_retry"
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
  outcome: "live" | "failed" | "setup_retry",
  domain: string,
  /** ADR-0251: the failed purchase's hold was released — nothing was charged. */
  released = false,
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
      outcome === "setup_retry"
        ? buildDomainSetupDelayedEmail({ to, domain, lang })
        : outcome === "live"
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
            released,
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
  // ⛔ A LIVE site is never pulled back by another row (Elek B1): a second purchase of a
  // name the tenant already runs would come back "taken" from the registrar, and its
  // `failed` must not overwrite the working domain's state on the site.
  let q = db
    .updateTable("site")
    .set({
      custom_domain_status: status,
      ...(extra.registrarRef !== undefined ? { registrar_ref: extra.registrarRef } : {}),
      domain_provision_error: extra.error ?? null,
    })
    .where("id", "=", siteId);
  if (status !== "live") q = q.where("custom_domain_status", "!=", "live");
  await q.execute();
}

/** Is this site's own domain already live? (Then no second order may touch it.) */
async function siteIsLive(siteId: string): Promise<boolean> {
  const row = await db
    .selectFrom("site")
    .select(["custom_domain_status"])
    .where("id", "=", siteId)
    .executeTakeFirst();
  return row?.custom_domain_status === "live";
}

/**
 * ADR-XXXX (Elek B2): the operator alert for a bought-and-paid name whose DNS/TLS setup
 * failed — through the house alert channel (ADR-0279: "[TESZT]" off the live host).
 * Operator text — outside the §B.18 buyer-facing i18n scope.
 */
async function alertSetupRetry(domain: string, tenantId: string, error: string): Promise<void> {
  await alertHouse({
    tag: "domain-setup",
    subject: `Citoviso: ${domain} megvéve, de a beállítás elakadt (DNS/TLS)`,
    text:
      `A(z) ${domain} nevet a regisztrátornál megvettük, a zárolt díjat lehívtuk, a cím ` +
      `beállítása (zóna / A-rekord / tanúsítvány) viszont hibára futott.\n\n` +
      `Tenant: ${tenantId}\nHiba: ${error}\n\n` +
      `Állapot: setup_retry — a resume-domains időzítő a 'registered' lépéstől újrapróbálja. ` +
      `A tulaj felülete és levele azt mondja: a név az övé, a beállítás késik, nincs teendője.\n` +
      `Ha nem áll helyre: a hiba okának megnézése, majd  npx tsx scripts/resume-domains.mts\n`,
  });
}

/**
 * Create (or reuse) the beszerzés record and mark the site `pending`. Called from the
 * payment webhook `paid` branch — the FIZETÉS is the trigger, no human approval.
 *
 * Idempotent per ORDER: a re-delivered webhook of the same order gets its own running row
 * back. ADR-XXXX (Elek B1): a DIFFERENT order is refused (null) when the site already has
 * a live domain or another running beszerzés — the caller then releases that order's hold.
 * Two partial unique indexes (per domain, per site) back this against parallel webhooks;
 * losing that race is the same refusal, never a raw `duplicate key` and a stuck hold.
 */
export async function startDomainProvisioning(input: StartDomainInput): Promise<string | null> {
  const running = await db
    .selectFrom("domain_provisioning")
    .select(["id", "order_intent_id", "domain", "site_id"])
    .where((eb) =>
      eb.or([
        eb(sql<string>`lower(domain)`, "=", input.domain.toLowerCase()),
        eb("site_id", "=", input.siteId),
      ]),
    )
    .where("status", "not in", ["live", "failed"])
    .execute();
  const same = running.find(
    (r) => r.order_intent_id === input.orderIntentId && r.domain.toLowerCase() === input.domain.toLowerCase(),
  );
  if (same) return same.id;
  if (running.length > 0) {
    console.warn(
      `[domain] második beszerzés ELUTASÍTVA (${input.domain}, order ${input.orderIntentId ?? "—"}): ` +
        `már fut egy (${running.map((r) => `${r.domain} / order ${r.order_intent_id ?? "—"}`).join(", ")})`,
    );
    return null;
  }
  if (await siteIsLive(input.siteId)) {
    console.warn(
      `[domain] második beszerzés ELUTASÍTVA (${input.domain}, order ${input.orderIntentId ?? "—"}): ` +
        `a site saját domainje már él`,
    );
    return null;
  }

  let row: { id: string };
  try {
    row = await db
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
  } catch (e) {
    // A parallel webhook won the insert (23505 on one of the two partial indexes).
    if ((e as { code?: string }).code === "23505") {
      console.warn(
        `[domain] második beszerzés ELUTASÍTVA (${input.domain}, order ${input.orderIntentId ?? "—"}): ` +
          `egy párhuzamos rendelés megelőzte (egyedi index)`,
      );
      return null;
    }
    throw e;
  }
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
  const id = await startOrderDomainProvisioning(orderIntentId);
  return id ? runDomainProvisioning(id) : null;
}

/**
 * The SYNCHRONOUS half of provisionOrderDomain: create (or reuse) the beszerzés row
 * and mark the site `pending`, without running it. ADR-0251: the held-payment path
 * awaits this before answering, so the buyer returning from the gateway lands on the
 * "zárolva → megvásároljuk" screen, not on step 1 of a registration that has not
 * been recorded yet. Returns null when the order carries no custom domain.
 */
export async function startOrderDomainProvisioning(orderIntentId: string): Promise<string | null> {
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

  return startDomainProvisioning({
    tenantId,
    siteId: site.id,
    orderIntentId,
    domain: order.domain_name,
    years: 1, // the driver recomputes from commitment_months; kept for the type only
  });
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
      "domain_provisioning.order_intent_id as orderIntentId",
    ])
    .where("domain_provisioning.id", "=", provisioningId)
    .executeTakeFirst();
  if (!p) throw new Error(`domain_provisioning ${provisioningId} nem található`);
  if (p.status === "live" || p.status === "failed") return p.status;
  const wasRetrying = p.status === "setup_retry";

  const registrar = getRegistrar();
  const dns = getDns();
  // Registration period: cover the subscription commitment, min. 1 year. The
  // 24-month commitment (ADR-0020) ⇒ 2 years; a plain order ⇒ 1 year.
  const years = Math.max(1, Math.ceil((p.commitmentMonths ?? 12) / 12));

  // Outside the try: the catch must know whether the name was already bought
  // (ADR-0251 — a failure BEFORE the purchase releases the buyer's hold).
  let registrarRef = p.registrarRef;
  try {
    let status = p.status as DomainProvisioningStatus;
    // setup_retry: the name is ours — re-enter at the DNS step (zone/A records are
    // idempotent in every adapter: the Websupport zone is read, the A records upserted).
    if (status === "setup_retry") status = "registered";

    // 1) pending → registering → registered: atomic buy at the registrar.
    if (status === "pending" || status === "registering") {
      // ADR-0093 price-cap guard: the LAST line of defense before real money.
      // The offer stage filters expensive domains too, but only this check sees
      // the registrar's authoritative price. Fail-closed: if the adapter cannot
      // price the domain, getYearlyPriceEur throws and the run lands in `failed`
      // — an unknown price is never a free pass (§B.17 missing-data branch).
      // ADR-0360 ③: the cap is per ending, NET, in the registrar's currency.
      await assertUnderCostCap(p.domain);
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
      // ADR-0251: the name is ours → NOW the held amount is taken (never before).
      // A capture that fails stays `reserved`; the resume timer retries it.
      if (p.orderIntentId) {
        const { captureDomainReservation } = await import("../payment/service.js");
        await captureDomainReservation(p.orderIntentId);
      }
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
    // ADR-XXXX (Elek B2): AFTER the purchase the name is the tenant's and the hold was
    // captured — this is a setup delay, not a failed purchase. Retried by the timer from
    // `registered`; alerted and told to the tenant ONCE (on entering the state).
    if (registrarRef) {
      await setStatus(p.id, p.siteId, "setup_retry", { registrarRef, error: msg });
      if (p.orderIntentId) {
        // A capture the purchase step missed is still owed (settleDomainReservations retries too).
        const { captureDomainReservation } = await import("../payment/service.js");
        await captureDomainReservation(p.orderIntentId).catch(() => false);
      }
      if (!wasRetrying) {
        console.error(`[domain] ⛔ ${p.domain}: megvéve, de a beállítás elakadt → setup_retry (${msg})`);
        await alertSetupRetry(p.domain, p.tenantId, msg);
        await notifyTenant(p.tenantId, p.siteId, "setup_retry", p.domain);
      } else {
        console.warn(`[domain] ${p.domain}: setup_retry újrapróba sem sikerült (${msg})`);
      }
      return "setup_retry";
    }
    const liveAlready = await siteIsLive(p.siteId);
    await setStatus(p.id, p.siteId, "failed", { error: msg });
    // ADR-0251: failed BEFORE the purchase → the hold goes back, nothing is charged.
    // (After the purchase the name is the tenant's; a later DNS/TLS failure is ours
    // to fix, not a reason to refund a name we hold for them.)
    let released = false;
    if (!registrarRef && p.orderIntentId) {
      const { releaseDomainReservation } = await import("../payment/service.js");
      released = await releaseDomainReservation(p.orderIntentId);
    }
    // A tenant fizetett és vár — a kudarcról MAGUNKTÓL szólunk, nem hagyjuk, hogy
    // legközelebbi belépéskor szembesüljön vele.
    // A second order on a site whose domain is live: the tenant has a working domain —
    // a "we could not buy it" letter about the duplicate would only confuse.
    if (!liveAlready) await notifyTenant(p.tenantId, p.siteId, "failed", p.domain, released);
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
    .where("status", "in", ["pending", "registering", "registered", "dns_pending", "tls_pending", "setup_retry"])
    .orderBy("created_at", "asc")
    .execute();
  const out: { id: string; domain: string; status: DomainProvisioningStatus }[] = [];
  for (const r of rows) {
    const status = await runDomainProvisioning(r.id);
    out.push({ id: r.id, domain: r.domain, status });
  }
  return out;
}
