// Operator console — the web layer (ADR-0003: built-in node:http, no framework).
// A tiny hand-rolled router over the console data/views + the generator service.
// Long-running: it does NOT close the shared pool. Post/Redirect/Get for mutations.

import { readFile } from "node:fs/promises";
import http from "node:http";
import { generateMock } from "../generator/generate.js";
import { loadLead } from "../generator/persist.js";
import {
  curateArtifact,
  getConversion,
  getLead,
  getSiteByToken,
  getTenantAdminByToken,
  listLeads,
  type LeadQuery,
} from "./data.js";
import { convertLead } from "../conversion/provision.js";
import { injectConfigurator } from "../generator/configurator.js";
import { db } from "../db/client.js";
import { layout, leadPage, leadsPage, tenantAdminPage } from "./views.js";

const PORT = Number(process.env.CONSOLE_PORT ?? "4600");

// Lead ids with a generation in flight (mock generation takes ~1-2 min). The
// POST returns immediately; the lead page shows a "folyamatban" state and
// auto-refreshes until the artifact appears. In-memory is fine — single process.
const generating = new Set<string>();

function send(
  res: http.ServerResponse,
  status: number,
  body: string,
  type = "text/html; charset=utf-8",
): void {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function redirect(res: http.ServerResponse, to: string): void {
  res.writeHead(303, { location: to });
  res.end();
}

async function readBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

/** Serve the mock HTML for an artifact, using ONLY the path stored in the DB. */
async function serveMock(res: http.ServerResponse, artifactId: string): Promise<void> {
  const a = await db
    .selectFrom("mock_artifact")
    .select("path")
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!a?.path) return send(res, 404, layout("404", "<p>Nincs ilyen mock.</p>"));
  try {
    const html = await readFile(a.path, "utf8");
    send(res, 200, html);
  } catch {
    send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
  }
}

/** Serve a mock with the PROSPECT CONFIGURATOR overlay injected (ADR-0015). The
 *  stored artifact stays pure; the interactive sell layer is added at serve time. */
async function serveConfigure(res: http.ServerResponse, artifactId: string): Promise<void> {
  const a = await db
    .selectFrom("mock_artifact")
    .select("path")
    .where("id", "=", artifactId)
    .executeTakeFirst();
  if (!a?.path) return send(res, 404, layout("404", "<p>Nincs ilyen mock.</p>"));
  try {
    const html = await readFile(a.path, "utf8");
    send(res, 200, await injectConfigurator(html, artifactId));
  } catch {
    send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
  }
}

/** Serve a provisioned site's private preview by its opaque token (noindex is
 *  baked into the snapshot at provisioning time). */
async function serveSite(res: http.ServerResponse, token: string): Promise<void> {
  const s = await getSiteByToken(token);
  if (!s?.path) return send(res, 404, layout("404", "<p>Nincs ilyen oldal.</p>"));
  try {
    const html = await readFile(s.path, "utf8");
    send(res, 200, html);
  } catch {
    send(res, 404, layout("404", "<p>Az oldal-pillanatkép nem található.</p>"));
  }
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  // GET / (with optional filter/sort query params)
  if (method === "GET" && path === "/") {
    const sp = url.searchParams;
    const dir = sp.get("dir");
    const q: LeadQuery = {
      sort: sp.get("sort") ?? undefined,
      dir: dir === "asc" ? "asc" : dir === "desc" ? "desc" : undefined,
      qualification: sp.get("qualification") ?? undefined,
      contact: sp.get("contact") ?? undefined,
      mock: sp.get("mock") ?? undefined,
      minPhotos: sp.get("minPhotos") ? Number(sp.get("minPhotos")) : undefined,
    };
    return send(res, 200, leadsPage(await listLeads(q), q));
  }
  // GET /lead/:id
  const leadMatch = /^\/lead\/([0-9a-f-]{36})$/i.exec(path);
  if (method === "GET" && leadMatch) {
    const d = await getLead(leadMatch[1]);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen lead.</p>"));
    const conversion = await getConversion(leadMatch[1]);
    return send(res, 200, leadPage(d, generating.has(leadMatch[1]), conversion));
  }
  // POST /lead/:id/generate — fire-and-forget; generation runs ~1-2 min in the
  // background, the lead page polls. Redirect immediately (no 2-min hang).
  const genMatch = /^\/lead\/([0-9a-f-]{36})\/generate$/i.exec(path);
  if (method === "POST" && genMatch) {
    const id = genMatch[1];
    if (!generating.has(id)) {
      generating.add(id);
      void loadLead(id)
        .then((loaded) => generateMock(loaded))
        .catch((err) => console.error(`[console] generate ${id} hiba:`, err))
        .finally(() => generating.delete(id));
    }
    return redirect(res, `/lead/${id}`);
  }
  // POST /artifact/:id/curate
  const curMatch = /^\/artifact\/([0-9a-f-]{36})\/curate$/i.exec(path);
  if (method === "POST" && curMatch) {
    const form = await readBody(req);
    const decision = form.get("decision");
    if (decision === "approve" || decision === "reject") {
      await curateArtifact(curMatch[1], decision, form.get("notes") ?? undefined);
    }
    return redirect(res, req.headers.referer ?? "/");
  }
  // GET /mock/:artifactId
  const mockMatch = /^\/mock\/([0-9a-f-]{36})$/i.exec(path);
  if (method === "GET" && mockMatch) {
    return serveMock(res, mockMatch[1]);
  }
  // GET /configure/:artifactId — prospect configurator (mock + interactive sell).
  const cfgMatch = /^\/configure\/([0-9a-f-]{36})$/i.exec(path);
  if (method === "GET" && cfgMatch) {
    return serveConfigure(res, cfgMatch[1]);
  }
  // POST /configure/:artifactId/request — the prospect's chosen package. Pilot:
  // log for the operator (A2, house-side follow-up); no schema change yet.
  const cfgReqMatch = /^\/configure\/([0-9a-f-]{36})\/request$/i.exec(path);
  if (method === "POST" && cfgReqMatch) {
    const body = (await readJson(req)) as { modules?: unknown };
    const modules = Array.isArray(body.modules)
      ? body.modules.filter((m): m is string => typeof m === "string")
      : [];
    const row = await db
      .selectFrom("mock_artifact")
      .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
      .select(["lead.id as leadId", "lead.name as leadName"])
      .where("mock_artifact.id", "=", cfgReqMatch[1])
      .executeTakeFirst();
    console.log(
      `[console] CSOMAG-IGÉNY · ${row?.leadName ?? "?"} (lead ${row?.leadId ?? "?"}) · ` +
        `artifact ${cfgReqMatch[1]} · modulok: ${modules.join(", ") || "—"}`,
    );
    return send(res, 200, JSON.stringify({ ok: true, modules }), "application/json");
  }
  // POST /lead/:id/convert — approved mock → provisioned private preview.
  const convMatch = /^\/lead\/([0-9a-f-]{36})\/convert$/i.exec(path);
  if (method === "POST" && convMatch) {
    const id = convMatch[1];
    const form = await readBody(req);
    const artifactId = form.get("artifactId");
    if (artifactId) {
      await convertLead(id, artifactId, form.getAll("module"));
    }
    return redirect(res, `/lead/${id}`);
  }
  // GET /site/:token — the provisioned private preview (opaque token).
  const siteMatch = /^\/site\/([A-Za-z0-9_-]{16,})$/.exec(path);
  if (method === "GET" && siteMatch) {
    return serveSite(res, siteMatch[1]);
  }
  // GET /admin/:token — read-only tenant self-service view (same opaque token).
  const adminMatch = /^\/admin\/([A-Za-z0-9_-]{16,})$/.exec(path);
  if (method === "GET" && adminMatch) {
    const v = await getTenantAdminByToken(adminMatch[1]);
    return v
      ? send(res, 200, tenantAdminPage(v))
      : send(res, 404, layout("404", "<p>Nincs ilyen tenant.</p>"));
  }

  send(res, 404, layout("404", "<p>Nincs ilyen oldal.</p>"));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    send(res, 500, layout("500", `<p>Hiba: ${(err as Error).message}</p>`));
  });
});

server.listen(PORT, () => {
  console.log(`Citoviso operátor-konzol → http://localhost:${PORT}`);
});
