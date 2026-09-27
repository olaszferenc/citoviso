// Adat-réteg a tenant-admin „Webcím" füléhez (ADR-0078 B változat).
//
// Csak ADATOT ad; minden vevő-oldali FELIRAT a nézetben születik (adminViews.ts), mert az
// van az i18n-őr fájllistáján — a tenant a saját site-nyelvén kapja a felületet (§B.18).
//
// A B változat 3 lépése (a befagyasztott kontraktus szerint,
// assets/design-refs/console/domain/README.md): 1. Név → 2. Áttekintés → 3. Kész.

import { db } from "../db/client.js";
import {
  PLATFORM_DOMAIN,
  normalizeCustomDomain,
  suggestDomains,
} from "../domains.js";
import { checkWebcimAvailability, type WebcimAvailability } from "./availability.js";
import {
  loadPricing,
  computeMonthly,
  isDomainEligible,
  domainFeeForCycle,
  getDomainMinPackageMonthly,
  getCurrency,
  getDomainMaxPriceEur,
  getDomainMinCommitmentMonths,
} from "../pricing.js";
import { renewableModuleIds } from "../payment/billing.js";
import { getRegistrar } from "./registrar/index.js";
import { isMockDomainProvisioning, type DomainProvisioningStatus } from "./provisionDomain.js";

/**
 * ADR-0093 offer-stage price screen: true when the domain is KNOWN to cost more
 * than the operator-set cap — such a domain must not be offered at all (otherwise
 * the buyer pays the package first and the purchase then dies on the cap, i.e. a
 * refund path). When the adapter cannot price (the INWX stub until its first live
 * order), the offer is NOT blocked — this pre-check is advisory; the purchase-side
 * guard in provisionDomain.ts is the authoritative, fail-closed gate.
 *
 * The cap guards OUR registrar cost, so it is deliberately NOT region-scoped:
 * every call site (here, domainUpgrade, provisionDomain) reads the DEFAULT
 * region's value — one knob, set on the console /pricing HU page.
 */
export async function exceedsPriceCap(domain: string): Promise<boolean> {
  try {
    return (await getRegistrar().getYearlyPriceEur(domain)) > getDomainMaxPriceEur();
  } catch (e) {
    console.warn(`[domain] ár-előszűrés kihagyva (${domain}): ${(e as Error).message}`);
    return false;
  }
}

export interface DomainSuggestionView {
  readonly domain: string;
  readonly availability: WebcimAvailability;
}

/**
 * ADR-XXXX: what happened to the MONEY of the newest domain order — the status
 * screens say it out loud ("zárolva", "terheltük", "nem terheltünk semmit").
 *   reserved — held, registration running · paid — captured after the purchase
 *   released — the purchase failed, the hold was given back (nothing charged)
 *   charged  — a legacy order charged up front (before the hold flow)
 */
export type DomainMoneyState = "reserved" | "paid" | "released" | "charged" | null;

export interface DomainAdminData {
  /** A honlap jelenlegi címe (<slug>.citoviso.com), ha van slug. */
  readonly currentHost: string | null;
  /** A már megvásárolt egyedi domain (csak 'live' állapotban van kitöltve). */
  readonly customDomain: string | null;
  /** A beszerzés állapota — ez vezérli, melyik képernyő látszik. */
  readonly status: DomainProvisioningStatus | "none";
  /** Az utolsó hiba (a 'failed' képernyőn), ha volt. */
  readonly error: string | null;
  /** Az a domain, amit a sikertelen beszerzés meg akart venni (hogy meg tudjuk nevezni). */
  readonly failedDomain: string | null;
  /** ADR-XXXX: the newest domain order's money state (see DomainMoneyState). */
  readonly money: DomainMoneyState;
  /** ADR-XXXX: that order's amount (held / charged), for the status rows. */
  readonly moneyAmount: number | null;
  /** The domain the newest beszerzés is about (in flight or failed). */
  readonly activeDomain: string | null;
  readonly suggestions: readonly DomainSuggestionView[];
  /** ADR-0109 ①: the custom domain's MONTHLY fee (was: yearly). */
  readonly priceMonthly: number;
  /** ADR-0109 ②/⑧: may this tenant have a custom domain at all (LIST package)? */
  readonly eligible: boolean;
  /** The entry threshold to show when `eligible` is false. */
  readonly minPackageMonthly: number;
  readonly currency: string;
  readonly commitmentMonths: number;
  /**
   * Mock (lokál) módban fut-e a beszerzés. A felület ezt KIMONDJA, mert ilyenkor a régi
   * cím marad élő (nincs 301) — különben a tesztelő azt hinné, hogy elromlott valami.
   */
  readonly mockMode: boolean;
}

/** Egy beírt domain ellenőrzésének eredménye (a „saját ötlet" mező mögött). */
export interface DomainCheckResult {
  readonly input: string;
  /** A normalizált alak, ha értelmes volt. */
  readonly domain: string | null;
  /** Sima magyar indoklás, ha nem használható (a normalizálótól). */
  readonly reason: string | null;
  readonly availability: WebcimAvailability | null;
  /**
   * ADR-0093: a domain regisztrációs díja meghaladja az ár-plafont (prémium domain)
   * — nem kínálható fel; a nézet mondja ki a vevőnek, miért nem.
   */
  readonly tooExpensive: boolean;
}

/**
 * Ellenőriz egy tenant által beírt domaint: normalizálás (a VALÓDI szabályokkal) + előzetes
 * elérhetőség + ár-plafon előszűrés (ADR-0093). Nem ír semmit; a vásárlás külön lépés.
 */
export async function checkTypedDomain(raw: string, region?: string): Promise<DomainCheckResult> {
  const norm = normalizeCustomDomain(raw);
  if (!norm.ok || !norm.domain) {
    return { input: raw, domain: null, reason: norm.reason ?? null, availability: null, tooExpensive: false };
  }
  await loadPricing();
  const [availability, tooExpensive] = await Promise.all([
    checkWebcimAvailability(norm.domain),
    exceedsPriceCap(norm.domain),
  ]);
  return { input: raw, domain: norm.domain, reason: null, availability, tooExpensive };
}

/**
 * A „Webcím" fül teljes adata. A javaslatok elérhetőségét párhuzamosan méri (DNS+RDAP),
 * és CSAK akkor, ha a tenant még nem tart a folyamatban — futó/kész beszerzésnél a
 * javaslat-lista értelmetlen hálózati munka lenne.
 */
export async function loadDomainAdmin(
  tenantId: string,
  displayName: string,
  regionId?: string,
): Promise<DomainAdminData> {
  const site = await db
    .selectFrom("site")
    .select(["slug", "custom_domain", "custom_domain_status", "domain_provision_error"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  const status = (site?.custom_domain_status ?? "none") as DomainProvisioningStatus | "none";
  const inFlight = status !== "none" && status !== "failed";

  // A sikertelen kísérlet domainje az append-only naplóból (a site-on nincs eltárolva,
  // mert oda csak a SIKERES domain kerül — a 'failed' képernyőnek viszont meg kell
  // tudnia nevezni, mit nem sikerült megvenni).
  let failedDomain: string | null = null;
  if (status === "failed") {
    const row = await db
      .selectFrom("domain_provisioning")
      .select(["domain"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "failed")
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    failedDomain = row?.domain ?? null;
  }

  // ADR-XXXX: the money state of the newest domain order (the one the status
  // screen talks about). A hold row says `reservation`; a legacy paid row does not.
  let money: DomainMoneyState = null;
  let moneyAmount: number | null = null;
  let activeDomain: string | null = null;
  if (status !== "none") {
    const dp = await db
      .selectFrom("domain_provisioning")
      .select(["domain"])
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    activeDomain = dp?.domain ?? null;
    const pay = await db
      .selectFrom("domain_provisioning")
      .innerJoin("payment", "payment.order_intent_id", "domain_provisioning.order_intent_id")
      .select(["payment.status as status", "payment.reservation as reservation", "payment.amount as amount"])
      .where("domain_provisioning.tenant_id", "=", tenantId)
      .orderBy("domain_provisioning.created_at", "desc")
      .orderBy("payment.created_at", "desc")
      .executeTakeFirst();
    if (pay) {
      moneyAmount = pay.amount;
      money = !pay.reservation
        ? pay.status === "paid" ? "charged" : null
        : pay.status === "reserved" || pay.status === "paid" || pay.status === "released"
          ? pay.status
          : null;
    }
  }

  await loadPricing();
  const suggestions: DomainSuggestionView[] = [];
  if (!inFlight) {
    const candidates = suggestDomains(displayName);
    const checks = await Promise.all(
      candidates.map(async (d) => ({
        availability: await checkWebcimAvailability(d),
        // ADR-0093: a known-over-cap (premium) domain is never offered — see
        // exceedsPriceCap; generated suggestions simply drop it.
        overCap: await exceedsPriceCap(d),
      })),
    );
    candidates.forEach((domain, i) => {
      if (!checks[i]!.overCap) suggestions.push({ domain, availability: checks[i]!.availability });
    });
  }

  return {
    currentHost: site?.slug ? `${site.slug}.${PLATFORM_DOMAIN}` : null,
    customDomain: site?.custom_domain ?? null,
    status,
    error: site?.domain_provision_error ?? null,
    failedDomain,
    money,
    moneyAmount,
    activeDomain,
    suggestions,
    // ADR-0109: the SAME fee the order will charge (quoteDomainUpgrade). What the
    // review screen shows must equal what the pay-link takes (§B.17 on ourselves).
    // Eligibility is judged on the LIST package total — a discount never buys it (⑧).
    priceMonthly: domainFeeForCycle(1, regionId),
    eligible: isDomainEligible(
      computeMonthly(await renewableModuleIds(tenantId), regionId),
      regionId,
    ),
    minPackageMonthly: getDomainMinPackageMonthly(regionId),
    currency: getCurrency(regionId),
    commitmentMonths: getDomainMinCommitmentMonths(regionId),
    mockMode: isMockDomainProvisioning(),
  };
}
