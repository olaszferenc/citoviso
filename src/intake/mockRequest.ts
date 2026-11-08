// Self-serve mock intake (ADR-0022). Turns a homepage request into a resolved lead and
// puts it on the colleagues' ZERO-API curated chain (2026-11-08: the old auto path called
// the paid writer model, and since the chain runs without an API key every request failed
// on the AI cap while the visitor read "Megkaptuk…"). The chain: Neo picks the lead up
// (adag.py on mock_request.status='needs_review' + flag curator_queue), Poe writes the
// curated copy (/lead/:id/generate-curated, no model call), Vera reviews — and Vera's PASS
// (console /artifact/:id/review) calls deliverInboundMock, which emails the requester.

import { randomBytes } from "node:crypto";
import path from "node:path";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { checkDemoFraming } from "../generator/provenanceCheck.js";
import { readServableMock } from "../generator/modelHtml.js";
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

/** Below this A4 confidence Neo is told to double-check the identification (A2). */
const AUTO_MIN_CONFIDENCE = 0.7;

/** Flag on a mock_request waiting for the curated chain (the colleagues' pick-up key). */
export const CURATOR_QUEUE_FLAG = "curator_queue";

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
      // Not found automatically — still the colleagues' job (Neo identifies it from the
      // name + pin by hand); the visitor was promised a mock, so the request must not die here.
      await setStatus(id, "needs_review", {
        flags: JSON.stringify([CURATOR_QUEUE_FLAG, "unresolved"]),
        error: "Nem sikerült automatikusan beazonosítani a vállalkozást (nincs találat).",
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

    // No generation here: the curated chain makes the mock (zero model calls). The flags
    // tell Neo what to double-check when he picks the lead up.
    const flags: string[] = [CURATOR_QUEUE_FLAG];
    if (resolved.confidence < AUTO_MIN_CONFIDENCE) {
      flags.push(`low_confidence(${resolved.confidence.toFixed(2)})`);
    }
    if (!resolved.onMap) flags.push("not_on_maps");
    await setStatus(id, "needs_review", { flags: JSON.stringify(flags), processed_at: new Date() });
    console.log(`[intake] ${req.business_name}: a kurátori láncra vár · ${flags.join(", ")}`); // i18n-exempt: operator log
  } catch (err) {
    // An intake error (e.g. the Places lookup is down) must not lose a visitor's request:
    // it waits for the colleagues with the error attached.
    await setStatus(id, "needs_review", {
      flags: JSON.stringify([CURATOR_QUEUE_FLAG, "intake_error"]),
      error: String((err as Error).message ?? err).slice(0, 500),
      processed_at: new Date(),
    });
  }
}

/**
 * Vera's PASS on a mock → if that mock's lead came from the homepage form and the
 * requester has not got a link yet, email it to them (the "Megkaptuk… elküldjük" promise).
 * The framed HTML is checked for demo framing (§A) first; a failing check leaves the
 * request waiting with a flag instead of sending. Returns what happened, for the log.
 */
export async function deliverInboundMock(artifactId: string): Promise<string> {
  const art = await db
    .selectFrom("mock_artifact")
    .select(["lead_id", "path", "status", "inputs"])
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!art) return "no_artifact";
  const req = await db
    .selectFrom("mock_request")
    .selectAll()
    .where("lead_id", "=", art.lead_id)
    .where("status", "=", "needs_review")
    .where("sent_at", "is", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  if (!req) return "not_inbound";
  if (art.status === "rejected") return "artifact_rejected";

  const flagsOf = (): string[] => {
    const f = req.flags as unknown;
    if (Array.isArray(f)) return f.map(String);
    try { return JSON.parse(String(f ?? "[]")) as string[]; } catch { return []; }
  };
  try {
    if (!art.path) throw new Error("no_path");
    // Read it exactly as /m/<token> will serve it (servePreview): resolved, servable, framed.
    const html = await frameDemoMock(await readServableMock(path.resolve(process.cwd(), art.path), art.inputs));
    if (checkDemoFraming(html).verdict !== "pass") {
      const flags = [...new Set([...flagsOf(), "provenance_flag"])];
      await db.updateTable("mock_request").set({ flags: JSON.stringify(flags), artifact_id: artifactId })
        .where("id", "=", req.id).execute();
      return "provenance_flag";
    }
  } catch {
    const flags = [...new Set([...flagsOf(), "html_unreadable"])];
    await db.updateTable("mock_request").set({ flags: JSON.stringify(flags), artifact_id: artifactId })
      .where("id", "=", req.id).execute();
    return "html_unreadable";
  }

  // /m/<token> serves whatever artifact_id points to — set it before the mail goes out.
  await db.updateTable("mock_request").set({ artifact_id: artifactId }).where("id", "=", req.id).execute();
  const base = config.publicSiteUrl || "http://100.97.188.105:4800";
  const previewUrl = `${base.replace(/\/$/, "")}/m/${req.token}`;
  // ADR-0067: announce the preview in the SAME language the preview was generated in.
  const mailLang = await prepareMailLang(await langForLead(art.lead_id));
  await getEmailSender().send(
    buildMockReadyEmail({ businessName: req.business_name, to: req.contact, previewUrl, lang: mailLang }),
  );
  await db
    .updateTable("mock_request")
    .set({ status: "sent", sent_at: new Date() })
    .where("id", "=", req.id)
    .execute();
  console.log(`[intake] ${req.business_name}: SENT → ${req.contact} (${previewUrl})`); // i18n-exempt: operator log
  return "sent";
}
