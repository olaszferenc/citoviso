// SEO / discoverability head (03-INVARIANTS §H.21): the engine emits a discoverable page BY
// DEFAULT — real meta + Schema.org JSON-LD straight from the structured SiteData. Fact-safe:
// every field is included ONLY when it is real data (name/address/geo/rating off the lead);
// nothing is fabricated. Phase-aware robots: a MOCK (cold-outreach preview) is noindex (it is a
// demo, not the owner's live site — §A demo-framing); the LIVE tenant page is indexable.

import type { RenderPhase, SiteData } from "./recipe.js";

/** Escape a string for an HTML attribute value (meta content). */
function attr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A concise meta description from the real copy (tagline preferred, trimmed to ~160 chars). */
function metaDescription(d: SiteData): string {
  const base = (d.tagline || d.intro || "").trim().replace(/\s+/g, " ");
  return base.length > 160 ? base.slice(0, 157).trimEnd() + "…" : base;
}

/**
 * ADR-0041 <title> pattern: "<Name> — <City>" — the settlement is the strongest local-search
 * signal and the name alone wasted it. Facts only (no translatable copy → i18n-safe); the city
 * is skipped when the name already contains it ("Hotel Keszthely" stays as-is).
 */
export function seoTitle(d: SiteData): string {
  const city = d.place?.city?.trim();
  if (!city || d.name.toLowerCase().includes(city.toLowerCase())) return d.name;
  return `${d.name} — ${city}`;
}

/** Business JSON-LD built only from real fields (omit anything absent — never fabricate).
 *  The @type comes off the lead's industry (ADR-0041 — the industry is a parameter);
 *  legacy artifacts without one fall back to the pilot vertical's LodgingBusiness. */
function jsonLd(d: SiteData, canonicalUrl?: string): string {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": d.businessType ?? "LodgingBusiness",
    name: d.name,
  };
  const desc = metaDescription(d);
  if (desc) node.description = desc;
  if (canonicalUrl) node.url = canonicalUrl;
  if (d.photos.length) node.image = d.photos.slice(0, 6).map((p) => p.url);
  // NAP consistency (local SEO): street + locality + country, each ONLY when real —
  // the country comes off the lead facet (ADR-0038/0040), never assumed.
  if (d.contact.address || d.place?.city || d.place?.country) {
    node.address = {
      "@type": "PostalAddress",
      ...(d.contact.address ? { streetAddress: d.contact.address } : {}),
      ...(d.place?.city ? { addressLocality: d.place.city } : {}),
      ...(d.place?.country ? { addressCountry: d.place.country } : {}),
    };
  }
  if (d.geo) node.geo = { "@type": "GeoCoordinates", latitude: d.geo.lat, longitude: d.geo.lon };
  if (d.contact.phone) node.telephone = d.contact.phone;
  if (d.contact.email) node.email = d.contact.email;
  if (d.rating) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: d.rating.value,
      ...(d.rating.count != null ? { reviewCount: d.rating.count } : {}),
    };
  }
  // Escape "<" so the JSON can never break out of the <script> context.
  return JSON.stringify(node).replace(/</g, "\\u003c");
}

/**
 * Full SEO head fragment: description + robots (phase-aware) + canonical/og:url (live only,
 * from the persisted canonicalUrl — ADR-0041) + Open Graph/Twitter + JSON-LD.
 * The <title> is emitted by the renderer (use seoTitle). A mock never asserts a URL.
 */
export function renderSeoHead(d: SiteData, phase: RenderPhase): string {
  const desc = metaDescription(d);
  const robots =
    phase === "live" ? "index, follow" : "noindex, nofollow"; // mock = private demo preview
  // Canonical only on the LIVE render where the public URL is known (editor.ts injects it) —
  // without it, slug + custom-domain (or www) duplicates would split ranking signals.
  const canonical = phase === "live" ? d.canonicalUrl : undefined;
  const ogImage = d.photos[0]?.url;
  const lines = [
    desc ? `<meta name="description" content="${attr(desc)}">` : "",
    `<meta name="robots" content="${robots}">`,
    canonical ? `<link rel="canonical" href="${attr(canonical)}">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(seoTitle(d))}">`,
    desc ? `<meta property="og:description" content="${attr(desc)}">` : "",
    canonical ? `<meta property="og:url" content="${attr(canonical)}">` : "",
    ogImage ? `<meta property="og:image" content="${attr(ogImage)}">` : "",
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">`,
    `<script type="application/ld+json">${jsonLd(d, canonical)}</script>`,
  ];
  return lines.filter(Boolean).join("\n  ");
}
