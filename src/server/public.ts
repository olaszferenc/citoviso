// Public web server (ADR-0022): serves the static homepage from public/ AND the
// self-serve intake API. Replaces the dev python static server on :4800.
//   GET  /                     → public/index.html
//   GET  /<static asset>       → public/<asset>
//   POST /api/mock-request     → enqueue an auto-mock, return { ok, token }
//   GET  /m/:token             → the generated preview for a request token
//   GET  /belepes              → login placeholder (ADR-0021 ③ builds the real one)
// Run: tsx src/server/public.ts   (persist with setsid/nohup like the preview server)

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client.js";
import { createMockRequest } from "../intake/mockRequest.js";
import { frameDemoMock } from "../generator/demoFrame.js";
import {
  authenticate,
  clearSession,
  currentTenant,
  setSession,
} from "../auth/tenantAuth.js";
import { getTenantContent, saveTenantContent } from "../tenant/editor.js";
import { adminDashboard, loginPage } from "./adminViews.js";

const PORT = Number(process.env.PUBLIC_PORT ?? "4800");
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

function send(res: http.ServerResponse, code: number, body: string | Buffer, type = "text/html; charset=utf-8"): void {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

async function readRawBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64_000) throw new Error("body too large");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readFormBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  return new URLSearchParams(await readRawBody(req));
}

function redirect(res: http.ServerResponse, to: string): void {
  res.writeHead(302, { Location: to });
  res.end();
}

/** Serve a file from public/, blocking path traversal. */
async function serveStatic(res: http.ServerResponse, urlPath: string): Promise<void> {
  const rel = decodeURIComponent(urlPath.split("?")[0]);
  const clean = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const target = clean === "/" || clean === "" ? "index.html" : clean.replace(/^\/+/, "");
  const abs = path.join(PUBLIC_DIR, target);
  if (!abs.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const buf = await readFile(abs);
    send(res, 200, buf, MIME[path.extname(abs)] ?? "application/octet-stream");
  } catch {
    send(res, 404, "<h1>404</h1>", "text/html; charset=utf-8");
  }
}

/** Serve the generated preview HTML for a request token. */
async function servePreview(res: http.ServerResponse, token: string): Promise<void> {
  const row = await db
    .selectFrom("mock_request")
    .leftJoin("mock_artifact", "mock_artifact.id", "mock_request.artifact_id")
    .select(["mock_request.status as status", "mock_artifact.path as path"])
    .where("mock_request.token", "=", token)
    .executeTakeFirst();
  if (!row) return send(res, 404, "<h1>Nincs ilyen előnézet.</h1>");
  if (!row.path) {
    return send(
      res,
      200,
      `<!DOCTYPE html><meta charset="utf-8"><title>Készül</title>` +
        `<div style="font:16px system-ui;max-width:480px;margin:80px auto;text-align:center">` +
        `<h2>Az előnézete még készül…</h2><p>Néhány pillanat, és frissítsd az oldalt.</p></div>`,
    );
  }
  try {
    const html = await readFile(path.resolve(process.cwd(), row.path), "utf8");
    send(res, 200, frameDemoMock(html)); // demo-framing footer at serve time (§A)
  } catch {
    send(res, 404, "<h1>Az előnézet fájl nem található.</h1>");
  }
}

/** Serve a tenant site snapshot by its preview_token (data-plane). */
async function servePreviewSite(res: http.ServerResponse, token: string): Promise<void> {
  const s = await db
    .selectFrom("site")
    .select("path")
    .where("preview_token", "=", token)
    .executeTakeFirst();
  if (!s?.path) return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
  try {
    const html = await readFile(path.resolve(process.cwd(), s.path), "utf8");
    send(res, 200, html);
  } catch {
    send(res, 404, "<h1>Az oldal pillanatkép nem található.</h1>");
  }
}

/** GET /admin — the session-gated tenant dashboard. */
async function serveAdmin(req: http.IncomingMessage, res: http.ServerResponse, saved: boolean): Promise<void> {
  const session = await currentTenant(req);
  if (!session) return redirect(res, "/belepes");
  const content = await getTenantContent(session.tenantId);
  const site = await db
    .selectFrom("site")
    .select("preview_token")
    .where("tenant_id", "=", session.tenantId)
    .executeTakeFirst();
  send(res, 200, adminDashboard(session, content, saved, site?.preview_token));
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const { pathname } = url;

  // ── Tenant auth + admin (data-plane, ADR-0023) ──
  if (req.method === "POST" && pathname === "/belepes") {
    const form = await readFormBody(req);
    const uid = await authenticate(form.get("email") ?? "", form.get("password") ?? "");
    if (!uid) {
      return send(res, 401, loginPage({ text: "Hibás e-mail vagy jelszó.", kind: "bad" }));
    }
    setSession(res, uid);
    return redirect(res, "/admin");
  }
  if (req.method === "POST" && pathname === "/admin/szoveg") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/belepes");
    const form = await readFormBody(req);
    await saveTenantContent(session.tenantId, {
      name: form.get("name") ?? undefined,
      tagline: form.get("tagline") ?? undefined,
      intro: form.get("intro") ?? undefined,
      highlights: (form.get("highlights") ?? "").split(/\r?\n/),
    });
    return redirect(res, "/admin?saved=1");
  }

  if (req.method === "POST" && pathname === "/api/mock-request") {
    try {
      const b = await readJsonBody(req);
      const businessName = String(b.business ?? "").trim();
      const contact = String(b.contact ?? "").trim();
      if (!businessName || !contact) {
        return send(res, 400, JSON.stringify({ ok: false, error: "missing_fields" }), MIME[".json"]);
      }
      const num = (v: unknown): number | null => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : null;
      };
      const { token } = await createMockRequest({
        businessName,
        contact,
        town: b.town ? String(b.town).trim() : undefined,
        businessType: b.type ? String(b.type).trim() : undefined,
        mapsLink: b.maps_link ? String(b.maps_link).trim() : undefined,
        lat: num(b.lat),
        lon: num(b.lon),
      });
      return send(res, 200, JSON.stringify({ ok: true, token }), MIME[".json"]);
    } catch (err) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((err as Error).message) }), MIME[".json"]);
    }
  }

  if (req.method === "GET") {
    const m = pathname.match(/^\/m\/([a-f0-9]{8,64})$/);
    if (m) return servePreview(res, m[1]);

    const site = pathname.match(/^\/site\/([A-Za-z0-9_-]{10,64})$/);
    if (site) return servePreviewSite(res, site[1]);

    if (pathname === "/belepes") return send(res, 200, loginPage());
    if (pathname === "/admin") return serveAdmin(req, res, url.searchParams.get("saved") === "1");
    if (pathname === "/kilepes") {
      clearSession(res);
      return redirect(res, "/");
    }
    return serveStatic(res, pathname);
  }

  send(res, 405, "Method Not Allowed", "text/plain");
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("[public] handler error:", err);
    if (!res.headersSent) send(res, 500, "Internal Server Error", "text/plain");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Citoviso publikus szerver → http://0.0.0.0:${PORT} (public/ + /api/mock-request)`);
});
