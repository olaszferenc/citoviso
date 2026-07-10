// Operator console — the web layer (ADR-0003: built-in node:http, no framework).
// A tiny hand-rolled router over the console data/views + the generator service.
// Long-running: it does NOT close the shared pool. Post/Redirect/Get for mutations.

import { readFile } from "node:fs/promises";
import http from "node:http";
import { generateMock } from "../generator/generate.js";
import { loadLead } from "../generator/persist.js";
import { curateArtifact, getLead, listLeads, type LeadQuery } from "./data.js";
import { db } from "../db/client.js";
import { layout, leadPage, leadsPage } from "./views.js";

const PORT = Number(process.env.CONSOLE_PORT ?? "4600");

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
    return d
      ? send(res, 200, leadPage(d))
      : send(res, 404, layout("404", "<p>Nincs ilyen lead.</p>"));
  }
  // POST /lead/:id/generate
  const genMatch = /^\/lead\/([0-9a-f-]{36})\/generate$/i.exec(path);
  if (method === "POST" && genMatch) {
    const loaded = await loadLead(genMatch[1]);
    await generateMock(loaded);
    return redirect(res, `/lead/${genMatch[1]}`);
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
