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
import { PHOTO_RIGHTS_DECLARATION_V1 } from "../legal.js";
import { packForClientAsync } from "../i18n/packs.js";

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
    /** Yearly price (HUF) of a custom domain through us (placeholder — owner sets). */
    readonly customYearly: number;
    /** Minimum subscription commitment (months) with a custom domain. */
    readonly minCommitmentMonths: number;
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
    domain: {
      sub: subdomainHost(leadName),
      // ADR-0032: the buyer may freely CHOOSE the subdomain label; these feed the input + check.
      subLabel: subdomainHost(leadName).split(".")[0]!,
      subBase: ".citoviso.com",
      subCheckUrl: `/configure/${artifactId}/subdomain`,
      suggestUrl: `/configure/${artifactId}/domains`,
      customYearly: getCustomDomainYearly(),
      minCommitmentMonths: CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS,
    },
    presets: PRESETS.map((p) => ({ id: p.id, label: p.label, note: p.note, modules: p.modules })),
    // NB: the prospect sees `publicLabel` (plain), never the operator jargon label.
    modules: MODULE_CATALOG.map((m) => ({
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
