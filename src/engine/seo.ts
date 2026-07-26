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

/** LodgingBusiness JSON-LD built only from real fields (omit anything absent — never fabricate). */
function jsonLd(d: SiteData): string {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: d.name,
  };
  const desc = metaDescription(d);
  if (desc) node.description = desc;
  if (d.photos.length) node.image = d.photos.slice(0, 6).map((p) => p.url);
  if (d.contact.address) {
    node.address = { "@type": "PostalAddress", streetAddress: d.contact.address, addressCountry: "HU" };
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
 * Full SEO head fragment: description + robots (phase-aware) + Open Graph/Twitter + JSON-LD.
 * The <title> is emitted by the renderer; this adds everything else. Canonical/og:url are
 * omitted until a live domain exists (added at provisioning), so no wrong URL is ever asserted.
 */
export function renderSeoHead(d: SiteData, phase: RenderPhase): string {
  const desc = metaDescription(d);
  const robots =
    phase === "live" ? "index, follow" : "noindex, nofollow"; // mock = private demo preview
  const ogImage = d.photos[0]?.url;
  const lines = [
    desc ? `<meta name="description" content="${attr(desc)}">` : "",
    `<meta name="robots" content="${robots}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(d.name)}">`,
    desc ? `<meta property="og:description" content="${attr(desc)}">` : "",
    ogImage ? `<meta property="og:image" content="${attr(ogImage)}">` : "",
    `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">`,
    `<script type="application/ld+json">${jsonLd(d)}</script>`,
  ];
  return lines.filter(Boolean).join("\n  ");
}
