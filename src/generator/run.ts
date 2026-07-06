// CLI for the mock generator (walking skeleton).
// Usage: npm run generate -- "<lead name or index>" [regionId]
// Reads leads-<region>.json, pulls fresh Places photos for the chosen lead,
// resolves image URLs, and renders a standalone HTML mock.

import { readFile, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { placesLookup } from "../scraper/sources/googleMaps.js";
import type { QualifiedLead } from "../scraper/types.js";
import { generateCopy } from "./copy.js";
import { resolvePhotos, streetViewUrl } from "./images.js";
import { render, type MockData, type MockFeature } from "./render.js";

interface RegionContext {
  label: string;
  tagline: string;
  introBase: string;
  features: MockFeature[];
}

// Regional "mag" — the context that makes a mock feel local even when the lead's
// own data is thin. Hand-authored for Badacsony; the regional scraper is a later slice.
const REGIONS: Record<string, RegionContext> = {
  badacsony: {
    label: "Badacsony",
    tagline:
      "A Balaton partján, a Badacsonyi borvidék lábánál — panoráma, borpincék és nádfedeles nyugalom.",
    introBase:
      "a Badacsonyi borvidék szívében, néhány percre a Balaton partjától. Bortúrák, kilátás a tóra és csendes, otthonos pihenés várja a vendégeket.",
    features: [
      { icon: "wifi", label: "Ingyenes Wi-Fi" },
      { icon: "parking", label: "Parkolás a háznál" },
      { icon: "view", label: "Panoráma a Balatonra" },
      { icon: "coffee", label: "Reggeli / borkóstoló" },
      { icon: "location", label: "A borvidék szívében" },
      { icon: "key", label: "Önálló bejárat" },
    ],
  },
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "mock"
  );
}

function pickLead(leads: QualifiedLead[], arg?: string): QualifiedLead {
  if (!arg) return leads[0];
  const n = Number(arg);
  if (Number.isInteger(n) && leads[n]) return leads[n];
  const found = leads.find((l) =>
    l.name.toLowerCase().includes(arg.toLowerCase()),
  );
  if (!found) throw new Error(`No lead matching "${arg}"`);
  return found;
}

async function main(): Promise<void> {
  const leadArg = process.argv[2];
  const regionId = process.argv[3] ?? "badacsony";
  const ctx = REGIONS[regionId] ?? {
    label: regionId,
    tagline: "",
    introBase: "",
    features: [],
  };

  const leads = JSON.parse(
    await readFile(`leads-${regionId}.json`, "utf8"),
  ) as QualifiedLead[];
  const lead = pickLead(leads, leadArg);

  let photos: string[] = [];
  if (lead.lat != null && lead.lon != null && config.googleMapsApiKey) {
    const m = await placesLookup(
      lead.name,
      lead.lat,
      lead.lon,
      config.googleMapsApiKey,
    );
    if (m?.photoRefs.length) photos = await resolvePhotos(m.photoRefs, 6);
  }

  const hero =
    photos[0] ??
    (lead.lat != null && lead.lon != null
      ? streetViewUrl(lead.lat, lead.lon)
      : "");

  // AI copy — the differentiating "mag". Vision-grounded when photos exist;
  // falls back to template copy if no key.
  const copy = await generateCopy({
    name: lead.name,
    region: ctx.label,
    regionContext: ctx.tagline,
    imageUrls: photos,
  });
  console.log(
    `  copy: ${copy ? `AI (claude-opus-4-8${photos.length ? ", vision" : ""})` : "template (no key)"}`,
  );
  if (copy?.highlights?.length) {
    console.log(`  highlights: ${copy.highlights.join(" · ")}`);
  }

  const data: MockData = {
    name: lead.name,
    region: ctx.label,
    regionTagline: copy?.tagline ?? ctx.tagline,
    heroImage: hero,
    photos,
    intro: copy?.intro ?? `A ${lead.name} ${ctx.introBase}`,
    features: ctx.features,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    mapUrl:
      lead.lat != null && lead.lon != null
        ? `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`
        : undefined,
  };

  const out = `mock-${slugify(lead.name)}.html`;
  await writeFile(out, render(data), "utf8");
  console.log(`Rendered: ${lead.name} → ${out}`);
  console.log(
    `  photos: ${photos.length} · hero: ${hero ? (photos.length ? "places" : "streetview") : "none"} · contact: ${lead.phone ?? lead.email ?? "–"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
