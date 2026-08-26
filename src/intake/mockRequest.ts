// Self-serve auto-mock intake orchestrator (ADR-0022). Turns a homepage request
// into a resolved lead → generated mock → guardian gates → (gated-auto) emailed
// preview. createMockRequest enqueues + returns instantly; processMockRequest runs
// the pipeline fire-and-forget (mirrors the console's non-blocking generate).

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { generateEngineMock } from "../generator/generateEngine.js";
import { checkDemoFraming } from "../generator/provenanceCheck.js";
import { frameDemoMock } from "../generator/demoFrame.js";
import { resolveBusiness } from "../scraper/resolveOne.js";
import {
  ensureScraperDefinition,
  startScrapeRun,
} from "../scraper/persist.js";
import type { QualifiedLead, Region } from "../scraper/types.js";
import { getEmailSender } from "../email/sender.js";
import { buildMockReadyEmail } from "../email/mockRequestEmail.js";
import { langForLead, prepareMailLang } from "../i18n/mail.js";

/** Minimum A4 confidence for blind auto-send; below → human review (A2). */
const AUTO_MIN_CONFIDENCE = 0.7;

/** Synthetic region for inbound leads (bbox = rough Hungary; unused for the box). */
const INBOUND_REGION: Region = {
  id: "inbound",
  label: "Beérkező igény",
  bbox: [45.7, 16.1, 48.6, 22.9],
};

export interface MockRequestInput {
  businessName: string;
  town?: string;
  businessType?: string;
  contact: string;
  mapsLink?: string;
  lat?: number | null;
  lon?: number | null;
}

/** Insert the request row (status 'received') and kick off async processing. */
export async function createMockRequest(
  input: MockRequestInput,
): Promise<{ id: string; token: string }> {
  const token = randomBytes(16).toString("hex");
  const row = await db
    .insertInto("mock_request")
    .values({
      token,
      business_name: input.businessName.slice(0, 200),
      town: (input.town ?? "").slice(0, 120),
      business_type: input.businessType ?? null,
      contact: input.contact.slice(0, 200),
      maps_link: input.mapsLink ?? null,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      status: "received",
      flags: JSON.stringify([]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Fire-and-forget: the HTTP response returns immediately.
  void processMockRequest(row.id).catch((err) => {
    console.error(`[intake] mock_request ${row.id} feldolgozás hiba:`, err);
  });

  return { id: row.id, token };
}

async function setStatus(
  id: string,
  status: "resolving" | "generating" | "sent" | "needs_review" | "failed",
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db.updateTable("mock_request").set({ status, ...extra }).where("id", "=", id).execute();
}

/** Persist a resolved inbound lead and return its id. */
async function persistInboundLead(lead: QualifiedLead): Promise<string> {
  const defId = await ensureScraperDefinition(INBOUND_REGION, lead.industry, [
    "inbound_request",
  ]);
  const runId = await startScrapeRun(defId);
  const row = await db
    .insertInto("lead")
    .values({
      scrape_run_id: runId,
      name: lead.name,
      lat: lead.lat ?? null,
      lng: lead.lon ?? null,
      address: lead.address ?? null,
      category: lead.industry,
      qualification: "no_site",
      weight: null,
      match_confidence: lead.matchConfidence ?? null,
      raw: JSON.stringify(lead),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .updateTable("scrape_run")
    .set({ status: "completed", finished_at: new Date(), stats: JSON.stringify({ inbound: 1 }) })
    .where("id", "=", runId)
    .execute();
  return row.id;
}

/** The pipeline: resolve → generate → gates → gated-auto send. */
export async function processMockRequest(id: string): Promise<void> {
  const req = await db
    .selectFrom("mock_request")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!req) return;

  try {
    await setStatus(id, "resolving");
    const resolved = await resolveBusiness({
      name: req.business_name,
      town: req.town || undefined,
      lat: req.lat,
      lon: req.lon,
      mapsLink: req.maps_link,
    });
    if (!resolved) {
      await setStatus(id, "failed", {
        error: "Nem sikerült beazonosítani a vállalkozást (nincs találat).",
        processed_at: new Date(),
      });
      return;
    }

    const leadId = await persistInboundLead(resolved.lead);
    await db
      .updateTable("mock_request")
      .set({ lead_id: leadId, match_confidence: resolved.confidence })
      .where("id", "=", id)
      .execute();

    await setStatus(id, "generating");
    const result = await generateEngineMock({ id: leadId, lead: resolved.lead });

    // Guardian gates — any FLAG (or a weak/uncorroborated match) → human review.
    const flags: string[] = [];
    if (resolved.confidence < AUTO_MIN_CONFIDENCE) {
      flags.push(`low_confidence(${resolved.confidence.toFixed(2)})`);
    }
    if (!resolved.onMap) flags.push("not_on_maps");
    if (result.designVerdict !== "pass") flags.push("design_flag");
    try {
      // Check the FRAMED html — the same demo-framing the requester will see (§A).
      const html = await frameDemoMock(await readFile(result.path, "utf8"));
      if (checkDemoFraming(html).verdict !== "pass") flags.push("provenance_flag");
    } catch {
      flags.push("html_unreadable");
    }

    if (flags.length) {
      await db
        .updateTable("mock_request")
        .set({
          status: "needs_review",
          artifact_id: result.artifactId,
          flags: JSON.stringify(flags),
          processed_at: new Date(),
        })
        .where("id", "=", id)
        .execute();
      console.log(`[intake] ${req.business_name}: needs_review · ${flags.join(", ")}`);
      return;
    }

    // Auto-send: email the preview link.
    const base = config.publicSiteUrl || "http://100.97.188.105:4800";
    const previewUrl = `${base.replace(/\/$/, "")}/m/${req.token}`;
    const sender = getEmailSender();
    // ADR-0067: announce the preview in the SAME language the preview was
    // generated in — the mail and the page must not disagree.
    const mailLang = await prepareMailLang(await langForLead(leadId));
    await sender.send(
      buildMockReadyEmail({
        businessName: req.business_name,
        to: req.contact,
        previewUrl,
        lang: mailLang,
      }),
    );

    await db
      .updateTable("mock_request")
      .set({
        status: "sent",
        artifact_id: result.artifactId,
        processed_at: new Date(),
        sent_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
    console.log(`[intake] ${req.business_name}: SENT → ${req.contact} (${previewUrl})`);
  } catch (err) {
    await setStatus(id, "failed", {
      error: String((err as Error).message ?? err).slice(0, 500),
      processed_at: new Date(),
    });
  }
}
