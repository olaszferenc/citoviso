// Mock generation as a service (Pillar 2). Takes a loaded lead, renders the
// standalone HTML mock, and records a mock_artifact row. Both the CLI (run.ts)
// and the operator console call this — one code path, clean boundary.

import { writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { scoreMatch } from "../scraper/confidence.js";
import { REGIONS as GEO_REGIONS } from "../scraper/regions.js";
import { placesLookup } from "../scraper/sources/googleMaps.js";
import { generateCopy } from "./copy.js";
import {
  classifyLead,
  generateFromCorpus,
  loadCorpus,
  selectCorpusDesign,
} from "./mockFromCorpus.js";
import { injectRuntime } from "./runtime.js";
import { auditAiriness } from "./qaAiriness.js";
import { verifyFactuality, type FactCheckVerdict } from "./factCheck.js";
import { resolvePhotos, streetViewUrl } from "./images.js";
import {
  loadLead,
  recordMockArtifact,
  usedArchetypesInRegion,
  type LoadedLead,
} from "./persist.js";
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
  /** Which engine produced the mock: the grounded AI generator or the fallback template. */
  readonly engine: "ai" | "template";
  /** Structural archetype (AI engine only) — recorded for region anti-collision. */
  readonly archetype?: string;
  readonly photos: number;
  readonly heroType: "places" | "streetview" | "none";
  readonly matchBand?: string;
  /** Factuality gate verdict (AI engine only) — pass | flag | error. */
  readonly factVerdict?: FactCheckVerdict["verdict"];
}

/**
 * Render a mock for a loaded lead and record the mock_artifact. Confidence-gated
 * photo use (A4). Preferred path: grounded AI generation (ADR-0007) — real photos,
 * no fabricated facts, structural variety, region anti-collision. Falls back to the
 * parametric template (keyless, no photos, or on AI failure).
 */
/** Resolve region id + display label: explicit id wins, else the geo bbox that
 * contains the lead's coords (regions.ts), else a neutral fallback. */
function resolveRegion(
  regionId: string | undefined,
  lat: number | null | undefined,
  lon: number | null | undefined,
): { id: string; label: string } {
  if (regionId && GEO_REGIONS[regionId]) {
    return { id: regionId, label: GEO_REGIONS[regionId].label };
  }
  if (lat != null && lon != null) {
    for (const r of Object.values(GEO_REGIONS)) {
      const [s, w, n, e] = r.bbox;
      if (lat >= s && lat <= n && lon >= w && lon <= e) {
        return { id: r.id, label: r.label };
      }
    }
  }
  const id = regionId ?? "badacsony";
  return { id, label: REGIONS[id]?.label ?? id };
}

export async function generateMock(
  loaded: LoadedLead,
  regionId?: string,
): Promise<GenerateResult> {
  const { id: leadId, lead } = loaded;
  const region = resolveRegion(regionId, lead.lat, lead.lon);
  const resolvedRegionId = region.id;
  const ctx = REGIONS[resolvedRegionId] ?? {
    label: region.label,
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
  const mapUrl =
    lead.lat != null && lead.lon != null
      ? `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`
      : undefined;
  const contact = {
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    mapUrl,
  };
  const path = `mock-${slugify(lead.name)}.html`;
  // Photos the AI can ground on: real Places photos, or a Street View baseline.
  const aiPhotos = photos.length ? photos : hero ? [hero] : [];

  // 1) Grounded generation via the CORPUS pipeline (agent-2, ADR-0008/0009/0011):
  //    classify → select a tier-corpus design (region anti-collision) → ground on
  //    real photos/facts → inline the module runtime. Needs a key + ≥1 photo.
  if (config.anthropicApiKey && aiPhotos.length) {
    try {
      const forMock = {
        name: lead.name,
        region: region.label,
        photos: aiPhotos,
        contact,
      };
      const cls = await classifyLead(forMock);
      const corpus = cls ? await loadCorpus() : [];
      const avoid = await usedArchetypesInRegion(resolvedRegionId);
      const sel =
        cls && corpus.length
          ? await selectCorpusDesign(corpus, cls, { avoidArchetypes: avoid })
          : null;
      const ai = cls && sel ? await generateFromCorpus(forMock, cls, sel) : null;
      if (ai && sel && /<html/i.test(ai.html)) {
        await writeFile(path, await injectRuntime(ai.html), "utf8");
        // QA-gate (ADR-0011): measure vertical-rhythm dead space at mobile width.
        // Best-effort + non-blocking — a headless-render hiccup must never fail a
        // generation. Recorded as a quality metric (no auto-regeneration yet).
        let airinessDeadPct: number | null = null;
        try {
          const qa = await auditAiriness(path, { widths: [390] });
          airinessDeadPct = qa.worstDeadPct;
          const flag = airinessDeadPct > 22 ? " ⚠️ levegős (>22%)" : "";
          console.log(`  QA airiness: ${airinessDeadPct}% holt függőleges sáv (mobil)${flag}`);
        } catch (qaErr) {
          console.warn(`  [generate] QA airiness kihagyva: ${(qaErr as Error).message}`);
        }
        // Factuality gate (DOMAIN §B.17): verify no HARD fact was fabricated. A FLAG
        // (or verifier error) keeps the mock in curation — never auto-outreach (§G.20).
        let factCheck: FactCheckVerdict | null = null;
        try {
          factCheck = await verifyFactuality({
            html: ai.html,
            lead: {
              name: lead.name,
              region: region.label,
              address: lead.address,
              phone: lead.phone,
              email: lead.email,
            },
            photos: aiPhotos,
          });
          if (factCheck.verdict === "pass") {
            console.log(`  ✅ tényhűség: PASS (${factCheck.candidates.length} jelölt ellenőrizve)`);
          } else if (factCheck.verdict === "flag") {
            const bad = factCheck.facts.filter((f) => !f.sourced).map((f) => `"${f.fact}"`).join(", ");
            console.log(`  ⛔ tényhűség: FLAG → kurátor-sor · forrástalan: ${bad || factCheck.reason}`);
          } else {
            console.log(`  ⚠️ tényhűség: nem verifikálható (${factCheck.reason}) → kurátor-sor`);
          }
        } catch (fcErr) {
          console.warn(`  [generate] tényhűség-ellenőrzés kihagyva: ${(fcErr as Error).message}`);
        }
        const artifactId = await recordMockArtifact({
          leadId,
          path,
          inputs: {
            engine: "ai",
            archetype: ai.archetype,
            environment: ai.environment,
            tier: ai.tier,
            corpusId: ai.corpusId,
            style: sel.entry.style,
            leadName: lead.name,
            region: region.label,
            regionId: resolvedRegionId,
            photos: photos.length,
            heroType,
            matchBand: matchBand ?? null,
            airinessDeadPct,
            factVerdict: factCheck?.verdict ?? null,
            factUnsourced: factCheck ? factCheck.facts.filter((f) => !f.sourced).map((f) => f.fact) : [],
            factCandidates: factCheck?.candidates.length ?? 0,
          },
        });
        console.log(
          `  korpusz-mock: ${ai.archetype} · ${ai.environment}-${ai.tier} (corpus=${ai.corpusId}; régióban kerülve: ${avoid.length})`,
        );
        return {
          artifactId,
          path,
          leadName: lead.name,
          engine: "ai",
          archetype: ai.archetype,
          photos: photos.length,
          heroType,
          matchBand,
          factVerdict: factCheck?.verdict,
        };
      }
    } catch (err) {
      console.warn(
        `  [generate] korpusz-generálás hiba → template fallback: ${(err as Error).message}`,
      );
    }
  }

  // 2) Fallback — parametric template render (keyless, no photos, or AI failure).
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
    mapUrl,
  };
  await writeFile(path, render(data), "utf8");
  const artifactId = await recordMockArtifact({
    leadId,
    path,
    inputs: {
      engine: "template",
      leadName: lead.name,
      region: ctx.label,
      regionId: resolvedRegionId,
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
    engine: "template",
    photos: photos.length,
    heroType,
    matchBand,
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
