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
  CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
  normalizeCustomDomain,
  suggestDomains,
  checkAvailability,
  type DomainAvailability,
} from "../domains.js";
import { getCustomDomainYearly, getCurrency } from "../pricing.js";
import { isMockDomainProvisioning, type DomainProvisioningStatus } from "./provisionDomain.js";

export interface DomainSuggestionView {
  readonly domain: string;
  readonly availability: DomainAvailability;
}

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
  readonly suggestions: readonly DomainSuggestionView[];
  readonly priceYearly: number;
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
  readonly availability: DomainAvailability | null;
}

/**
 * Ellenőriz egy tenant által beírt domaint: normalizálás (a VALÓDI szabályokkal) + előzetes
 * elérhetőség. Nem ír semmit; a vásárlás külön lépés.
 */
export async function checkTypedDomain(raw: string): Promise<DomainCheckResult> {
  const norm = normalizeCustomDomain(raw);
  if (!norm.ok || !norm.domain) {
    return { input: raw, domain: null, reason: norm.reason ?? null, availability: null };
  }
  const availability = await checkAvailability(norm.domain);
  return { input: raw, domain: norm.domain, reason: null, availability };
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

  const suggestions: DomainSuggestionView[] = [];
  if (!inFlight) {
    const candidates = suggestDomains(displayName);
    const checks = await Promise.all(candidates.map((d) => checkAvailability(d)));
    candidates.forEach((domain, i) => suggestions.push({ domain, availability: checks[i]! }));
  }

  return {
    currentHost: site?.slug ? `${site.slug}.${PLATFORM_DOMAIN}` : null,
    customDomain: site?.custom_domain ?? null,
    status,
    error: site?.domain_provision_error ?? null,
    failedDomain,
    suggestions,
    priceYearly: getCustomDomainYearly(regionId),
    currency: getCurrency(regionId),
    commitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
    mockMode: isMockDomainProvisioning(),
  };
}
