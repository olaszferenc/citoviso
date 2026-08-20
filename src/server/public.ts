// Public web server (ADR-0022): serves the static homepage from public/ AND the
// self-serve intake API. Replaces the dev python static server on :4800.
//   GET  /                     → public/index.html
//   GET  /<static asset>       → public/<asset>
//   POST /api/mock-request     → enqueue an auto-mock, return { ok, token }
//   GET  /m/:token             → the generated preview for a request token
//   GET  /login              → login placeholder (ADR-0021 ③ builds the real one)
// Run: tsx src/server/public.ts   (persist with setsid/nohup like the preview server)

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";

import { db } from "../db/client.js";
import { config } from "../config.js";
import { PLATFORM_DOMAIN } from "../domains.js";
import { privacyPage } from "../console/views.js";
import { createMockRequest } from "../intake/mockRequest.js";
import { frameDemoMock } from "../generator/demoFrame.js";
import {
  authenticate,
  changeTenantPassword,
  clearSession,
  currentTenant,
  setSession,
  updateContactEmail,
} from "../auth/tenantAuth.js";
import {
  addTenantPhotos,
  getTenantContent,
  removeTenantPhoto,
  saveTenantContent,
} from "../tenant/editor.js";
import { getAssetStore } from "../tenant/assetStore.js";
import { adminDashboard, loginHelpPage, loginPage } from "./adminViews.js";
import { getTenantModules, setTenantModules } from "../tenant/modules.js";
import { MODULE_CATALOG } from "../modules.js";
import {
  computeAnnual,
  formatPrice,
  loadPricing,
  pricingSnapshot,
  resolvePricingRegion,
} from "../pricing.js";

/**
 * Console (operator) login URL for the cross-realm link on the customer login.
 * In production the console lives on its own admin subdomain behind TLS; the
 * ":4600" form is a LOCAL-DEV fallback only (that port is firewalled in prod, so
 * emitting it publicly produced a dead link).
 */
function consoleLoginUrl(req: http.IncomingMessage): string {
  if (config.consoleUrl) return `${config.consoleUrl.replace(/\/+$/, "")}/login`;
  const host = String(req.headers.host ?? "").split(":")[0]!.toLowerCase();
  if (!host) return "";
  // Any platform host (citoviso.com, www, a tenant subdomain) → the admin subdomain.
  if (host === PLATFORM_DOMAIN || host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    return `https://admin.${PLATFORM_DOMAIN}/login`;
  }
  return `http://${host}:4600/login`; // local dev / Tailscale IP
}

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

/**
 * Serve the marketing homepage with its price bound to the LIVE pricing source
 * (region-aware, §C-gated). The price block in public/index.html is a
 * <!--CIT_PRICE_BLOCK--> marker we fill server-side: the confirmed annual price for
 * the visitor's region, or — if that region's price is NOT owner-confirmed — a
 * "custom offer, ask for the free sample" fallback (Fttv./§C: never advertise an
 * unconfirmed price). Region: ?region= override → CF-IPCountry → Accept-Language.
 */
async function serveHomepage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  let html: string;
  try {
    html = await readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
  } catch {
    return send(res, 404, "<h1>404</h1>", "text/html; charset=utf-8");
  }
  await loadPricing();
  const region = resolvePricingRegion(req.headers, url.searchParams.get("region"));
  const snap = pricingSnapshot(region);
  const unitStyle =
    "font-size:1.1rem;font-weight:600;color:var(--citui-muted);letter-spacing:0;";
  let block: string;
  if (snap.pricingConfirmed) {
    const annual = computeAnnual([], region);
    block =
      `<div class="price">${formatPrice(annual, snap.currency)}` +
      `<span style="${unitStyle}"> / évtől</span></div>` +
      `<div class="price-note">vagy kényelmes havi konstrukcióban</div>`;
  } else {
    // §C gate closed: no concrete number until the owner confirms the price.
    block =
      `<div class="price">Egyedi ajánlat</div>` +
      `<div class="price-note">Kérd az ingyenes mintát — a pontos árat személyre szabva mutatjuk meg.</div>`;
  }
  // Replace everything between the markers (inclusive) — the static block in the
  // file is only the no-render fallback for a raw file-serve.
  const rendered = html.replace(
    /<!--CIT_PRICE_BLOCK-->[\s\S]*?<!--\/CIT_PRICE_BLOCK-->/,
    `<!--CIT_PRICE_BLOCK-->${block}<!--/CIT_PRICE_BLOCK-->`,
  );
  send(res, 200, rendered);
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

/** Tenant-uploaded asset: /uploads/<tenantUuid>/<file> (path-traversal guarded). */
async function serveUpload(res: http.ServerResponse, pathname: string): Promise<void> {
  const up = pathname.match(/^\/uploads\/([0-9a-f-]{36})\/([A-Za-z0-9._-]+)$/);
  if (!up) return send(res, 404, "<h1>404</h1>");
  const abs = path.resolve(process.cwd(), "sites", up[1]!, "uploads", up[2]!);
  const root = path.resolve(process.cwd(), "sites", up[1]!, "uploads");
  if (!abs.startsWith(root)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const buf = await readFile(abs);
    send(res, 200, buf, MIME[path.extname(abs)] ?? "application/octet-stream");
  } catch {
    send(res, 404, "<h1>404</h1>");
  }
}

/** The tenant site a request's Host resolves to, or null for platform hosts (0017). */
interface TenantHostSite {
  readonly path: string | null;
  readonly tenantId: string;
  readonly slug: string | null;
  readonly customDomain: string | null;
  /** ADR-0041: the request arrived on the <slug>.citoviso.com host (not the custom domain). */
  readonly viaSlug: boolean;
}

/**
 * Map the request Host to a LIVE tenant site: <slug>.citoviso.com (platform
 * subdomain) or the tenant's own custom domain. Platform hosts (citoviso.com,
 * www, admin, any non-matching name) return null → normal site routing.
 */
async function resolveTenantSite(req: http.IncomingMessage): Promise<TenantHostSite | null> {
  const host = String(req.headers.host ?? "").split(":")[0]!.toLowerCase();
  if (!host || host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`) return null;

  const suffix = `.${PLATFORM_DOMAIN}`;
  const isSub = host.endsWith(suffix);
  // A platform subdomain resolves by its slug label; anything else may be a
  // custom domain the tenant registered through us.
  const label = isSub ? host.slice(0, -suffix.length) : null;
  if (label && (label.includes(".") || label === "admin")) return null; // deeper/reserved hosts stay ours

  const row = await db
    .selectFrom("site")
    .select(["path", "tenant_id as tenantId", "slug", "custom_domain as customDomain"])
    .where("status", "=", "live")
    .where((eb) =>
      label
        ? eb(sql<string>`lower(site.slug)`, "=", label)
        : eb(sql<string>`lower(site.custom_domain)`, "=", host),
    )
    .executeTakeFirst();
  return row ? { ...row, viaSlug: !!label } : null;
}

/** The site's canonical public host: custom domain first, else the platform slug host. */
function tenantCanonicalHost(site: TenantHostSite): string | null {
  if (site.customDomain) return site.customDomain;
  if (site.slug) return `${site.slug}.${PLATFORM_DOMAIN}`;
  return null;
}

/** Serve a tenant host: the live snapshot at "/", robots/sitemap (ADR-0041), its uploads,
 *  else 404 in-site. A slug host with a live custom domain 301s there (ADR-0041 — otherwise
 *  the ranking equity accrued on the slug would be lost at the domain upsell). */
async function serveTenantHost(
  res: http.ServerResponse,
  site: TenantHostSite,
  pathname: string,
): Promise<void> {
  // ADR-0041 permanent redirect: the slug host stops serving content once the tenant has a
  // custom domain — same path, 301, so search engines transfer the accumulated signals.
  if (site.viaSlug && site.customDomain) {
    res.writeHead(301, { Location: `https://${site.customDomain}${pathname}` });
    return void res.end();
  }
  // Tenant-owned uploads keep working on the tenant host (the snapshot references
  // them by absolute path).
  if (pathname.startsWith("/uploads/")) return serveUpload(res, pathname);
  // ADR-0041 index entry points: robots + a one-URL sitemap (grows with RÉTEG B subpages).
  const canonicalHost = tenantCanonicalHost(site);
  if (pathname === "/robots.txt") {
    const lines = ["User-agent: *", "Allow: /"];
    if (canonicalHost) lines.push("", `Sitemap: https://${canonicalHost}/sitemap.xml`);
    return send(res, 200, lines.join("\n") + "\n", "text/plain; charset=utf-8");
  }
  if (pathname === "/sitemap.xml" && canonicalHost) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${canonicalHost}/</loc></url>
</urlset>
`;
    return send(res, 200, xml, "application/xml; charset=utf-8");
  }
  if (pathname !== "/" && pathname !== "/index.html") {
    return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
  }
  if (!site.path) return send(res, 404, "<h1>Az oldal még nem érhető el.</h1>");
  try {
    const html = await readFile(path.resolve(process.cwd(), site.path), "utf8");
    send(res, 200, html);
  } catch {
    send(res, 404, "<h1>Az oldal pillanatkép nem található.</h1>");
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
async function serveAdmin(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  saved: boolean,
  tab?: string,
): Promise<void> {
  const session = await currentTenant(req);
  if (!session) return redirect(res, "/login");
  const content = await getTenantContent(session.tenantId);
  const site = await db
    .selectFrom("site")
    .select(["preview_token", "slug", "custom_domain", "status"])
    .where("tenant_id", "=", session.tenantId)
    .executeTakeFirst();
  // Public URL only once the site is actually LIVE (ADR-0014 state machine).
  const siteUrl =
    site && site.status === "live"
      ? site.custom_domain
        ? `https://${site.custom_domain}`
        : site.slug
          ? `https://${site.slug}.${PLATFORM_DOMAIN}`
          : null
      : null;
  const modules = await getTenantModules(session.tenantId);
  send(
    res,
    200,
    adminDashboard(session, content, {
      saved,
      previewToken: site?.preview_token,
      modules,
      supportEmail: config.outreachSender.email || "hello@citoviso.com",
      tab,
      siteUrl,
    }),
  );
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const { pathname } = url;

  // ── Tenant host routing (0017): <slug>.citoviso.com / a custom domain serves
  // THAT tenant's live site. Runs first, so a tenant host never falls through to
  // the marketing homepage. Only 'live' sites resolve — a provisioned (paid-for
  // but private) site stays token-only, keeping the ADR-0014 state machine intact.
  const tenantSite = await resolveTenantSite(req);
  if (tenantSite) return serveTenantHost(res, tenantSite, pathname);

  // ── Tenant auth + admin (data-plane, ADR-0023) ──
  if (req.method === "POST" && pathname === "/login") {
    const form = await readFormBody(req);
    const uid = await authenticate(form.get("username") ?? "", form.get("password") ?? "");
    if (!uid) {
      return send(
        res,
        401,
        loginPage(
          { text: "Hibás felhasználónév vagy jelszó.", kind: "bad" },
          consoleLoginUrl(req),
        ),
      );
    }
    setSession(res, uid);
    return redirect(res, "/admin");
  }
  // POST /admin/password — tenant password change (Fiók card).
  if (req.method === "POST" && pathname === "/admin/password") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const next = form.get("next") ?? "";
    const err =
      next !== (form.get("next2") ?? "")
        ? "A két új jelszó nem egyezik."
        : await changeTenantPassword(session.tenantUserId, form.get("current") ?? "", next);
    return redirect(res, err ? `/admin?pw=${encodeURIComponent(err)}` : "/admin?saved=1");
  }
  if (req.method === "POST" && pathname === "/admin/text") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await saveTenantContent(session.tenantId, {
      name: form.get("name") ?? undefined,
      tagline: form.get("tagline") ?? undefined,
      intro: form.get("intro") ?? undefined,
      highlights: (form.get("highlights") ?? "").split(/\r?\n/),
    });
    return redirect(res, "/admin?saved=1");
  }
  // POST /admin/modules — tenant self-service module selection (ADR-0034).
  if (req.method === "POST" && pathname === "/admin/modules") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await setTenantModules(session.tenantId, form.getAll("module"));
    return redirect(res, "/admin?tab=modulok&saved=1");
  }
  if (req.method === "POST" && pathname === "/admin/contact") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await updateContactEmail(session.tenantUserId, form.get("contact_email") ?? "");
    return redirect(res, "/admin?saved=1");
  }
  if (req.method === "POST" && pathname === "/admin/photos") {
    const session = await currentTenant(req);
    if (!session) return send(res, 401, JSON.stringify({ ok: false }), MIME[".json"]);
    try {
      const body = await readJsonBody(req);
      const images = Array.isArray(body.images) ? body.images.slice(0, 12) : [];
      const store = getAssetStore();
      const saved: { url: string; alt: string }[] = [];
      for (const it of images) {
        const dataUrl = String((it as Record<string, unknown>)?.dataUrl ?? "");
        const alt = String((it as Record<string, unknown>)?.alt ?? session.displayName).slice(0, 160);
        const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
        if (!m) continue;
        const buf = Buffer.from(m[2], "base64");
        if (buf.length > 6_000_000) continue; // 6 MB cap per image
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        const a = await store.save(session.tenantId, ext, buf);
        saved.push({ url: a.url, alt });
      }
      if (saved.length) await addTenantPhotos(session.tenantId, saved);
      return send(res, 200, JSON.stringify({ ok: true, count: saved.length }), MIME[".json"]);
    } catch (err) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((err as Error).message) }), MIME[".json"]);
    }
  }
  if (req.method === "POST" && pathname === "/admin/photos/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const url = form.get("url") ?? "";
    if (url) {
      await removeTenantPhoto(session.tenantId, url);
      await getAssetStore().remove(session.tenantId, url);
    }
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

    // Tenant-uploaded assets: /uploads/<tenantUuid>/<file>
    if (pathname.startsWith("/uploads/")) return serveUpload(res, pathname);

    if (pathname === "/login") return send(res, 200, loginPage(undefined, consoleLoginUrl(req)));
    if (pathname === "/login/help") {
      return send(res, 200, loginHelpPage(config.outreachSender.email || "hello@citoviso.com"));
    }
    // GDPR Art. 13/14 notice — the homepage mock-request form links here.
    if (pathname === "/privacy") return send(res, 200, privacyPage(config.outreachSender));
    if (pathname === "/admin")
      return serveAdmin(
        req,
        res,
        url.searchParams.get("saved") === "1",
        url.searchParams.get("tab") ?? undefined,
      );
    if (pathname === "/logout") {
      clearSession(res);
      return redirect(res, "/");
    }
    // Homepage: rendered (not raw static) so its price binds to the live pricing.
    if (pathname === "/" || pathname === "/index.html") {
      return serveHomepage(req, res, url);
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
