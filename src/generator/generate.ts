// Mock generation as a service (Pillar 2). Takes a loaded lead, renders the
// standalone HTML mock, and records a mock_artifact row. Both the CLI (run.ts)
// and the operator console call this — one code path, clean boundary.

import { writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { scoreMatch } from "../scraper/confidence.js";
import { placesLookup } from "../scraper/sources/googleMaps.js";
import { generateCopy } from "./copy.js";
import { resolvePhotos, streetViewUrl } from "./images.js";
import { loadLead, recordMockArtifact, type LoadedLead } from "./persist.js";
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

export interface GenerateResult {
  readonly artifactId: string;
  readonly path: string;
  readonly leadName: string;
  readonly photos: number;
  readonly heroType: "places" | "streetview" | "none";
  readonly matchBand?: string;
  readonly copySource: "ai" | "template";
}

/**
 * Render a mock for a loaded lead and record the mock_artifact. Confidence-gated
 * photo use (A4): better no photos than the wrong lead's photos. Runs keyless
 * (template copy, no photos) when API keys are absent.
 */
export async function generateMock(
  loaded: LoadedLead,
  regionId = "badacsony",
): Promise<GenerateResult> {
  const { id: leadId, lead } = loaded;
  const ctx = REGIONS[regionId] ?? {
    label: regionId,
    tagline: "",
    introBase: "",
    features: [],
  };

  // A4 — score the per-lead Places match and GATE photo usage by confidence.
  let photos: string[] = [];
  let matchBand: string | undefined;
  if (lead.lat != null && lead.lon != null && config.googleMapsApiKey) {
    const m = await placesLookup(
      lead.name,
      lead.lat,
      lead.lon,
      config.googleMapsApiKey,
    );
    if (m) {
      const conf = scoreMatch({
        distanceMeters: m.distanceMeters,
        nameSimilarity: m.nameSimilarity,
        corroboratedByOsm: lead.sources.includes("osm"),
      });
      matchBand = conf.band;
      const stars = m.rating ? ` ${m.rating}★/${m.userRatingCount ?? "?"}` : "";
      console.log(
        `  match: "${m.placeName}"${stars} · konfidencia ${conf.score.toFixed(2)} [${conf.band}] · ${conf.reasons.join(" · ")}`,
      );
      if (conf.band === "low") {
        console.log(
          "  ⛔ ALACSONY konfidencia → fotók ELHAGYVA (biztonságos fallback)",
        );
      } else {
        photos = await resolvePhotos(m.photoRefs, 6);
        if (conf.band === "medium") {
          console.log("  ⚠️ KÖZEPES konfidencia → kurátor-review ajánlott");
        }
      }
    }
  }

  const hero =
    photos[0] ??
    (lead.lat != null && lead.lon != null
      ? streetViewUrl(lead.lat, lead.lon)
      : "");
  const heroType: GenerateResult["heroType"] = hero
    ? photos.length
      ? "places"
      : "streetview"
    : "none";

  // AI copy — the differentiating "mag". Vision-grounded when photos exist;
  // falls back to template copy if no key.
  const copy = await generateCopy({
    name: lead.name,
    region: ctx.label,
    regionContext: ctx.tagline,
    imageUrls: photos,
  });

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

  const path = `mock-${slugify(lead.name)}.html`;
  await writeFile(path, render(data), "utf8");

  const artifactId = await recordMockArtifact({
    leadId,
    path,
    inputs: {
      leadName: lead.name,
      region: ctx.label,
      regionId,
      photos: photos.length,
      heroType,
      matchBand: matchBand ?? null,
      copySource: copy ? "ai" : "template",
    },
  });

  return {
    artifactId,
    path,
    leadName: lead.name,
    photos: photos.length,
    heroType,
    matchBand,
    copySource: copy ? "ai" : "template",
  };
}

/** Convenience for the CLI: resolve a lead by id/name/most-recent, then generate. */
export async function generateMockFor(
  idOrName?: string,
  regionId = "badacsony",
): Promise<GenerateResult> {
  const loaded = await loadLead(idOrName);
  console.log(`lead ${loaded.id} · ${loaded.lead.name}`);
  return generateMock(loaded, regionId);
}
