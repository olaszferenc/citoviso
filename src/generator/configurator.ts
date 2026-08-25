// Prospect configurator injector (ADR-0015) — the visible sell layer.
//
// Serve-time only: the console injects this into a mock when serving the
// prospect-facing /configure/:artifactId route. It is NOT baked into the stored
// artifact file (which stays a pure snapshot) nor into the emailed link target's
// source — the configurator is an overlay the prospect interacts with BEFORE
// paying (module toggle + live preview + §B.17 sample state).
//
// Same inline-runtime approach as runtime.ts (ADR-0011): the CSS/JS are read from
// assets/runtime and inlined so the page stays standalone. A JSON manifest of the
// module catalog (present vs sample) is embedded for the client to render.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MODULE_CATALOG,
  GROUP_LABELS,
  PRESETS,
  detectPresentModules,
} from "../modules.js";
import {
  loadPricing,
  getBaseMonthly,
  getAnnualFreeMonths,
  getCustomDomainYearly,
  getModulePrice,
} from "../pricing.js";
import {
  CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
  subdomainHost,
} from "../domains.js";
import {
  PHOTO_RIGHTS_DECLARATION_V1,
  TERMS_ACCEPTANCE_V1,
  WITHDRAWAL_WAIVER_V1,
} from "../legal.js";
import { packForClientAsync } from "../i18n/packs.js";
import { config } from "../config.js";
import { EU_VAT_COUNTRIES } from "../billing/taxId.js";

/**
 * Countries selectable at checkout: Hungary first (the pilot market), then the
 * EU member states — a non-EU buyer is out of scope for now and would need a
 * different VAT treatment than either branch we implement.
 */
const COUNTRY_LABELS: Readonly<Record<string, string>> = {
  HU: "Magyarország", AT: "Ausztria", BE: "Belgium", BG: "Bulgária", CY: "Ciprus",
  CZ: "Csehország", DE: "Németország", DK: "Dánia", EE: "Észtország", EL: "Görögország",
  ES: "Spanyolország", FI: "Finnország", FR: "Franciaország", HR: "Horvátország",
  IE: "Írország", IT: "Olaszország", LT: "Litvánia", LU: "Luxemburg", LV: "Lettország",
  MT: "Málta", NL: "Hollandia", PL: "Lengyelország", PT: "Portugália", RO: "Románia",
  SE: "Svédország", SI: "Szlovénia", SK: "Szlovákia",
};

const BILLING_COUNTRIES: readonly { code: string; label: string }[] = [
  { code: "HU", label: COUNTRY_LABELS.HU! },
  ...EU_VAT_COUNTRIES.filter((c) => c !== "HU")
    .map((c) => ({ code: c, label: COUNTRY_LABELS[c] ?? c }))
    .sort((a, b) => a.label.localeCompare(b.label, "hu")),
];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.resolve(HERE, "../../assets/runtime");

let cached: string | null = null;

async function configuratorBlock(): Promise<string> {
  if (cached) return cached;
  const css = await readFile(path.join(RUNTIME_DIR, "cit-configurator.css"), "utf8");
  const js = await readFile(path.join(RUNTIME_DIR, "cit-configurator.js"), "utf8");
  cached = `<style data-cit-configurator-css>\n${css}\n</style>\n<script data-cit-configurator-js>\n${js}\n</script>\n`;
  return cached;
}

export interface ConfiguratorManifest {
  readonly artifactId: string;
  readonly requestUrl: string;
  readonly groups: Record<string, string>;
  /** ADR-0036: buyer-language pack for the client runtime's tr() — Hungarian → empty map. */
  readonly i18n: Record<string, string>;
  /** Pricing (HUF). annualFreeMonths: annual prepay = 12 − free months. */
  readonly pricing: { readonly base: number; readonly annualFreeMonths: number; readonly currency: string };
  /** §A: the EXACT declaration wording shown at the checkbox = the stamped text. */
  readonly photoRightsText: string;
  /** Checkout billing step (0029) — WHO is buying, collected before payment. */
  readonly billing: {
    /** Lead-derived prefill: the buyer confirms, rather than types, their data. */
    readonly prefill: BillingPrefill;
    /** Selectable countries (HU first, then the EU member states). */
    readonly countries: readonly { readonly code: string; readonly label: string }[];
    /**
     * Public ÁSZF URL, or null while the document does not exist. Null hides the
     * acceptance row entirely — a tick-box pointing at a missing document is
     * worse than none (see config.termsUrl).
     */
    readonly termsUrl: string | null;
    /** EXACT wordings shown = the wordings stamped onto the order (§H.22). */
    readonly termsText: string;
    readonly withdrawalText: string;
  };
  /** Tracked-outreach instrumentation (/p/<token>, PILOT.md §3); absent on the
   *  operator-facing /configure route (no prospect → nothing to measure). */
  readonly track?: { readonly url: string; readonly viewId: string };
  /** Domain step (ADR-0020): platform subdomain default + custom-domain upsell. */
  readonly domain: {
    /** The default host under the platform domain (e.g. "sissi.citoviso.com"). */
    readonly sub: string;
    /** The default subdomain LABEL (before the dot) — prefill for the free-choice input. */
    readonly subLabel: string;
    /** The platform suffix shown after the editable label (".citoviso.com"). */
    readonly subBase: string;
    /** Endpoint checking a chosen subdomain label's availability (ADR-0032). */
    readonly subCheckUrl: string;
    /** Server endpoint returning custom-domain suggestions with availability. */
    readonly suggestUrl: string;
    /** Endpoint checking a domain the buyer TYPED (none of the suggestions fit). */
    readonly checkUrl: string;
    /** Yearly price (HUF) of a custom domain through us (placeholder — owner sets). */
    readonly customYearly: number;
    /** Minimum subscription commitment (months) with a custom domain. */
    readonly minCommitmentMonths: number;
  };
  /**
   * ⛔ The page's call-to-action in BOTH states (owner ruling 2026-08-25).
   *
   * The booking section already disappeared with the module, but the CALLING
   * surfaces did not: the hero band and the nav still said "Foglalás / Szabad
   * időpontok megtekintése" in a package that does not include booking. Promising
   * a feature the buyer is not paying for is not a display bug, it is a con —
   * so the client switches these strings with the module.
   */
  readonly cta: {
    readonly booking: { readonly title: string; readonly button: string; readonly href: string };
    readonly enquiry: { readonly title: string; readonly button: string; readonly href: string };
  };
  readonly presets: { readonly id: string; readonly label: string; readonly note: string; readonly modules: string[] }[];
  readonly modules: {
    readonly id: string;
    /** Prospect-facing plain label (owner language, no jargon). */
    readonly label: string;
    /** Prospect-facing one-line description (info icon in the panel). */
    readonly desc: string;
    readonly group: string;
    readonly present: boolean;
    readonly spine: boolean;
    /** Monthly add-on price (HUF); 0 = included in base. */
    readonly price: number;
    /** Module ids this one replaces when selected (shared slot). */
    readonly supersedes?: string[];
    readonly domType?: string;
    /** Extra `data-cit-module` anchors this module also owns (e.g. reviews has
     *  three page states). Without these the toggle found nothing to move. */
    readonly domTypesAlso?: readonly string[];
  }[];
}

/** Optional overrides for the tracked-outreach flow (/p/<token>). */
export interface ConfiguratorOpts {
  /** Override the order-submit endpoint (e.g. /p/<token>/request). */
  readonly requestUrl?: string;
  /** Event-beacon config; present only on the tracked prospect route. */
  readonly track?: { readonly url: string; readonly viewId: string };
  /** ADR-0036: buyer language for the configurator UI; absent/hu → empty i18n map. */
  readonly lang?: string;
  /**
   * Best-effort billing prefill from the lead (0029). The buyer CONFIRMS these
   * rather than typing them, which is what keeps a mandatory checkout step from
   * costing conversions. Being wrong here is harmless — a human corrects it
   * before paying; that is precisely why the same guessy address split must NOT
   * be used as the invoice source of truth.
   */
  readonly billingPrefill?: BillingPrefill;
}

/** Lead-derived checkout prefill — every field optional and unverified. */
export interface BillingPrefill {
  readonly name?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly address?: string;
  readonly email?: string;
  /** ISO 3166-1 alpha-2; defaults to HU when the lead has no country facet. */
  readonly country?: string;
}

/** Build the module manifest the client renders: present (anchored) vs sample.
 *  Async: refreshes the operator-set pricing snapshot so the prospect always sees
 *  the current prices (the owner may have just edited them on /pricing). */
export async function buildManifest(
  html: string,
  artifactId: string,
  leadName: string,
  opts: ConfiguratorOpts = {},
): Promise<ConfiguratorManifest> {
  await loadPricing();
  const present = new Set(detectPresentModules(html));
  return {
    artifactId,
    requestUrl: opts.requestUrl ?? `/configure/${artifactId}/request`,
    ...(opts.track ? { track: opts.track } : {}),
    groups: GROUP_LABELS,
    i18n: await packForClientAsync(opts.lang),
    pricing: { base: getBaseMonthly(), annualFreeMonths: getAnnualFreeMonths(), currency: "Ft" },
    // §A single-source: the checkbox label IS the stamped wording (guard finding —
    // the recorded acceptance must equal what the prospect actually saw).
    photoRightsText: PHOTO_RIGHTS_DECLARATION_V1,
    billing: {
      prefill: opts.billingPrefill ?? {},
      countries: BILLING_COUNTRIES,
      termsUrl: config.termsUrl || null,
      // Same single-source rule as §A above: what they read is what we stamp.
      termsText: TERMS_ACCEPTANCE_V1,
      withdrawalText: WITHDRAWAL_WAIVER_V1,
    },
    domain: {
      sub: subdomainHost(leadName),
      // ADR-0032: the buyer may freely CHOOSE the subdomain label; these feed the input + check.
      subLabel: subdomainHost(leadName).split(".")[0]!,
      subBase: ".citoviso.com",
      subCheckUrl: `/configure/${artifactId}/subdomain`,
      suggestUrl: `/configure/${artifactId}/domains`,
      checkUrl: `/configure/${artifactId}/domain-check`,
      customYearly: getCustomDomainYearly(),
      minCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
    },
    cta: {
      booking: {
        title: "Foglalás",
        button: "Szabad időpontok megtekintése",
        href: "#cit-booking",
      },
      enquiry: {
        title: "Foglalási igény",
        button: "Érdeklődés küldése",
        href: "#cit-enquiry",
      },
    },
    presets: PRESETS.map((p) => ({ id: p.id, label: p.label, note: p.note, modules: p.modules })),
    // NB: the prospect sees `publicLabel` (plain), never the operator jargon label.
    // Tenant-only/one-time modules (ADR-0063) are not offered here: the purchase
    // needs a provisioned site with saved content, which a prospect has none of.
    modules: MODULE_CATALOG.filter((m) => !m.tenantOnly).map((m) => ({
      id: m.id,
      label: m.publicLabel,
      desc: m.publicDesc,
      group: m.group,
      present: present.has(m.id),
      spine: !!m.spine,
      price: getModulePrice(m.id),
      // Ids this module replaces: the client greys them out and drops them from the
      // total, so a prospect is never charged for two things that share one slot
      // ("ha van foglalás, akkor nincs érdeklődés").
      ...(m.supersedes ? { supersedes: [...m.supersedes] } : {}),
      ...(m.domType ? { domType: m.domType } : {}),
      ...(m.domTypesAlso ? { domTypesAlso: [...m.domTypesAlso] } : {}),
    })),
  };
}

/**
 * Inject the prospect configurator (manifest + inline CSS/JS) before </body>.
 * Idempotent. The manifest is a JSON script tag the client runtime reads.
 */
export async function injectConfigurator(
  html: string,
  artifactId: string,
  leadName: string,
  opts: ConfiguratorOpts = {},
): Promise<string> {
  if (html.includes("data-cit-configurator")) return html; // already injected
  const manifest = await buildManifest(html, artifactId, leadName, opts);
  const manifestTag =
    `<script type="application/json" data-cit-configurator>` +
    JSON.stringify(manifest) +
    `</script>\n`;
  const block = manifestTag + (await configuratorBlock());
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + "\n" + block; // no </body> — append as a safe fallback
}
