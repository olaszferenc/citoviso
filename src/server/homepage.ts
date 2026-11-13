/*
 * The public marketing homepage (public/index.html) rendered with its live parts:
 * the package cards and prices from the LIVE pricing source, and the brand lockups.
 * Approved design: assets/design-refs/public-site/landing/ ("C · Szem", 2026-11-07).
 * Kept apart from the server module so it can be rendered (and tested) on its own.
 */
import type http from "node:http";
import { esc } from "../console/views.js";
import { DEFAULT_MULTILANG_TIER } from "../modules.js";
import { getDisabledModules } from "../moduleSales.js";
import { offeredPackagesFrom, type OfferedPackage } from "../packageOffer.js";
import { isTier, tierHasDomain, type PackageAssignment } from "../packages.js";
import {
  formatPrice,
  getAnnualFreeMonths,
  getMultilangTierPrice,
  getPackageAssignment,
  loadPricing,
  pricingSnapshot,
  resolvePricingRegion,
  regionPriceGaps,
} from "../pricing.js";
import { lockup } from "../ui/brand.js";

/** One line of a homepage package card: shown when the tier's modules carry it. */
interface HomeFeature {
  readonly text: string;
  readonly has: (mods: ReadonlySet<string>, tierHasDomainNow: boolean) => boolean;
}

/** The package-card lines, in display order. Each is bound to the modules (or the domain
 *  pseudo-module) that make it TRUE, so a card can never list what its tier does not carry. */
const HOME_FEATURES: readonly HomeFeature[] = [
  { text: "Személyre szabott honlap, mobilra kész", has: () => true },
  { text: "Galéria, térkép, ajánlatkérő űrlap", has: (m) => m.has("gallery") && m.has("location") && m.has("enquiry") },
  { text: "Saját .hu domain", has: (_m, d) => d },
  { text: "Beküldés a Google-nek", has: () => true },
  { text: "Szobák és felszereltség", has: (m) => m.has("rooms") && m.has("amenities") },
  { text: "Vendégvélemények", has: (m) => m.has("reviews") },
  { text: "„Miért nálunk” szakasz", has: (m) => m.has("usp") },
  { text: "Online foglalás, portál-naptár szinkronnal", has: (m) => m.has("booking") },
  { text: "Szezonális árak, nyitvatartás", has: (m) => m.has("pricing") && m.has("hours") },
  { text: "Programajánló a környékről", has: (m) => m.has("poi") },
];

/** „Minden, ami az Alapban” — the lead line of the next tier up. */
const HOME_TIER_IN: Record<string, string> = { alap: "az Alapban", ajanlott: "az Ajánlottban" };

const HOME_TICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

/**
 * The homepage package cards from the LIVE offer (the same packages and monthly list
 * prices as the configurator: offeredPackagesFrom), cheapest first. Both the monthly and
 * the yearly price are rendered; the page's toggle only switches between them.
 * Yearly = monthly × (12 − free months).
 */
export function homepagePlansHtml(
  pkgs: readonly OfferedPackage[],
  freeMonths: number,
  currency: string,
  assignment: PackageAssignment,
): string {
  const tiers = [...pkgs].filter((p) => Number.isFinite(p.monthly) && p.monthly > 0).sort((x, y) => x.monthly - y.monthly);
  if (!tiers.length) return "";
  const yearMonths = Math.max(1, 12 - Math.max(0, freeMonths));
  const lines = (p: OfferedPackage): string[] => {
    const mods = new Set(p.modules);
    const dom = isTier(p.id) && tierHasDomain(assignment, p.id);
    return HOME_FEATURES.filter((f) => f.has(mods, dom)).map((f) => f.text);
  };
  let prev: string[] = [];
  let prevId = "";
  const cards = tiers.map((p) => {
    const own = lines(p);
    const shown = prevId ? [`Minden, ami ${HOME_TIER_IN[prevId] ?? "az előző csomagban"}`, ...own.filter((t) => !prev.includes(t))] : own;
    prev = own;
    prevId = p.id;
    const year = p.monthly * yearMonths;
    const hot = p.id === "ajanlott";
    return (
      `<div class="plan${hot ? " hot" : ""} rv" data-tier="${esc(p.id)}">` +
      (hot ? `<span class="tag">Ezt ajánljuk</span>` : "") +
      `<h3>${esc(p.label)}</h3>` +
      `<div class="price"><span class="m">${formatPrice(p.monthly, currency)}<small> / hó</small></span>` +
      `<span class="y">${formatPrice(year, currency)}<small> / év</small></span></div>` +
      `<div class="yr"><span class="y">havonta ${formatPrice(p.monthly, currency)} helyett ${formatPrice(Math.round(year / 12), currency)}</span></div>` +
      `<ul>${shown.map((t) => `<li>${HOME_TICK}${esc(t)}</li>`).join("")}</ul>` +
      `</div>`
    );
  });
  const top = tiers[tiers.length - 1]!;
  return `<div class="plans" data-full-year="${formatPrice(top.monthly * yearMonths, currency)}">${cards.join("")}</div>`;
}

/**
 * Render the marketing homepage with its prices bound to the LIVE pricing source
 * (region-aware, §C-gated). public/index.html carries markers we fill server-side:
 * <!--CIT_PRICE_BLOCK--> (the package cards, homepagePlansHtml) and <!--CIT_ML_PRICE-->
 * (the one-time multilingual from-price). If the visitor's region price is NOT
 * owner-confirmed, no number is shown at all — a "custom offer" fallback instead
 * (Fttv./§C: never advertise an unconfirmed price). Region: ?region= override →
 * CF-IPCountry → Accept-Language.
 */
export async function renderHomepage(
  html: string,
  headers: http.IncomingHttpHeaders,
  regionOverride: string | null,
): Promise<string> {
  await loadPricing();
  const region = resolvePricingRegion(headers, regionOverride);
  const snap = pricingSnapshot(region);
  let plans = "";
  let ml = "";
  // ADR-0443: an incomplete region shows NO price (the "custom offer" block), never a guess.
  if (snap.pricingConfirmed && regionPriceGaps(region).length === 0) {
    plans = homepagePlansHtml(
      offeredPackagesFrom(await getDisabledModules(), region),
      getAnnualFreeMonths(region),
      snap.currency,
      getPackageAssignment(),
    );
    const mlPrice = getMultilangTierPrice(DEFAULT_MULTILANG_TIER, region);
    if (mlPrice > 0 && DEFAULT_MULTILANG_TIER.cap) {
      ml = ` (${DEFAULT_MULTILANG_TIER.cap} nyelv ${formatPrice(mlPrice, snap.currency)}-tól)`;
    }
  }
  // No confirmed price (or no valid package): the file's static "custom offer" block stays.
  let rendered = plans
    ? html.replace(/<!--CIT_PRICE_BLOCK-->[\s\S]*?<!--\/CIT_PRICE_BLOCK-->/, () => `<!--CIT_PRICE_BLOCK-->${plans}<!--/CIT_PRICE_BLOCK-->`)
    : html;
  rendered = rendered.replace(/<!--CIT_ML_PRICE-->[\s\S]*?<!--\/CIT_ML_PRICE-->/, () => ml);
  if (!plans) rendered = rendered.replace(/<div class="toggle"[\s\S]*?<\/div>/, "");
  const free = getAnnualFreeMonths(region);
  rendered = rendered.replace("Évente — 2 hónap ingyen", free > 0 ? `Évente — ${free} hónap ingyen` : "Évente");
  // The header follows the stage (dark over the intro, light after it): the themed
  // lockup (brand-slot flips data-citui-theme). The footer is dark. One brand source
  // (ADR-0236); the file only carries a plain-text fallback.
  let brandN = 0;
  rendered = rendered.replace(/<!--CIT_BRAND-->[\s\S]*?<!--\/CIT_BRAND-->/g, () =>
    brandN++ === 0
      ? lockup({ on: "themed", href: "#top" })
      : lockup({ on: "dark", href: "#top" }),
  );
  return rendered;
}
