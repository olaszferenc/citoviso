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
import { isPlatformHosting, PLATFORM_DOMAIN, tenantSiteUrl } from "../domains.js";
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
  moveTenantPhoto,
  removeTenantPhoto,
  saveTenantContent,
  setTenantPhotoCaption,
  setTenantPhotoUnits,
  photosByUnit,
  rerenderTenantSnapshot,
} from "../tenant/editor.js";
import { getAssetStore } from "../tenant/assetStore.js";
import { adminDashboard, loginHelpPage, loginPage } from "./adminViews.js";
import type { AdminOpts } from "./adminViews.js";
import { filterKbEntries, kbAssetPath, pickKbEntry, renderKbBody } from "../kb/kb.js";
import { localizedKbEntries } from "../i18n/kbPacks.js";
import { TENANT_LOGIN_URL, injectOwnerLogin } from "./ownerLogin.js";
import { getTenantModules, setTenantModules } from "../tenant/modules.js";
import { MODULE_CATALOG } from "../modules.js";
import {
  bookingVerdictPage,
  hasSettingsScreen,
  moduleSettingsSection,
  reviewThanksPage,
  reviewVerdictPage,
} from "./moduleConfigViews.js";
import { createReview, decideReview, getReviews } from "../reviews/reviews.js";
import { getPlaceRating } from "../reviews/placeRating.js";
import {
  createUnit,
  deleteUnit,
  ensureUnits,
  setUnitAmenities,
  setUnitSeasonalOnly,
  unitBelongsToSite,
  updateUnit,
} from "../tenant/units.js";
import { createBookingRequest, decideRequest, getRequests } from "../booking/requests.js";
import { addSeasonPrice, deletePrice, getUnitPrices, setBasePrice } from "../tenant/prices.js";
import { buildUnitFeed, syncCalendarLink } from "../booking/sync.js";
import {
  getSiteModuleConfig,
  hasPreviousModuleConfig,
  restorePreviousModuleConfig,
  setSiteModuleConfig,
} from "../tenant/siteModuleConfig.js";
import {
  addCalendarLink,
  deleteCalendarLink,
  getCalendarLinks,
  getBlockedDaysFrom,
  getExportFeedUrl,
  getMonthAvailability,
  normaliseMonth,
  setManualMonthBlocks,
  unitByFeedToken,
} from "../tenant/availability.js";
import { MODULE_CONFIG_REGISTRY, type ModuleConfigValues } from "../moduleConfig.js";
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

/** Platform labels that are ours, not a tenant slug. */
const RESERVED_SUBDOMAINS = new Set(["www", "admin", "api", "mail", "app", "static", "assets"]);

/**
 * True for a `<label>.citoviso.com` host that did NOT resolve to a live site.
 * Falling through to the marketing landing there is wrong twice over: the owner
 * who follows their own site link is shown OUR homepage (reads as "my site is
 * gone" right after paying), and every made-up subdomain would answer 200 with
 * identical content — duplicate content across the whole *.citoviso.com network,
 * the exact reputation risk ADR-0041 guards against.
 */
function isUnclaimedTenantHost(req: http.IncomingMessage): boolean {
  const host = String(req.headers.host ?? "").split(":")[0]!.toLowerCase();
  const suffix = `.${PLATFORM_DOMAIN}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  return !!label && !label.includes(".") && !RESERVED_SUBDOMAINS.has(label);
}

/**
 * DEV-ONLY tenant access by slug path (/t/<slug>). Locally the wildcard host does
 * not resolve and a browser cannot set a Host header, so without this a local
 * end-to-end test can never open the site it just activated.
 *
 * ⚠️ Disabled whenever this process serves the real platform: on citoviso.com a
 * /t/<slug> URL would be a SECOND address for every tenant site, competing with
 * its own canonical — the duplicate-content problem ADR-0041 exists to prevent.
 */
const DEV_SLUG_PATH = !isPlatformHosting(config.publicSiteUrl);

async function resolveDevSlugSite(slug: string): Promise<TenantHostSite | null> {
  const row = await db
    .selectFrom("site")
    .select(["path", "tenant_id as tenantId", "slug", "custom_domain as customDomain"])
    .where("status", "=", "live")
    .where(sql<string>`lower(site.slug)`, "=", slug.toLowerCase())
    .executeTakeFirst();
  return row ? { ...row, viaSlug: true } : null;
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
/** Crude per-IP throttle for the public booking endpoints — a guest form is an open
 *  door, and a booking row is cheap to create but expensive to clean up. */
const bookingHits = new Map<string, { n: number; until: number }>();
function throttled(req: http.IncomingMessage, limit: number, windowMs: number): boolean {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0]!.trim();
  const now = Date.now();
  const hit = bookingHits.get(ip);
  if (!hit || hit.until < now) {
    bookingHits.set(ip, { n: 1, until: now + windowMs });
    if (bookingHits.size > 5000) bookingHits.clear(); // bounded: this is a guard, not a ledger
    return false;
  }
  hit.n++;
  return hit.n > limit;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

async function serveTenantHost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  site: TenantHostSite,
  pathname: string,
): Promise<void> {
  // ── ADR-0044 public booking endpoints (only on the tenant's own host) ──
  // Availability is served live rather than baked into the static snapshot: a frozen
  // calendar would keep offering nights that are already gone.
  const availMatch = /^\/api\/foglaltsag\/([0-9a-f-]{36})$/i.exec(pathname);
  if (availMatch) {
    const unitId = availMatch[1]!;
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId || !(await unitBelongsToSite(siteId, unitId))) {
      return sendJson(res, 404, { error: "unknown_unit" });
    }
    const today = new Date().toISOString().slice(0, 10);
    // Only busy DATES leave the building — no guest name, no contact, nothing personal.
    return sendJson(res, 200, { blocked: await getBlockedDaysFrom(unitId, today) });
  }

  if (req.method === "POST" && pathname === "/api/foglalas") {
    if (throttled(req, 5, 10 * 60_000)) {
      return sendJson(res, 429, { errors: ["Túl sok próbálkozás. Kérjük, várjon pár percet."] });
    }
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId) return sendJson(res, 404, { errors: ["Ismeretlen szállás."] });
    const form = await readFormBody(req);
    const unitId = form.get("unit") ?? "";
    if (!(await unitBelongsToSite(siteId, unitId))) {
      return sendJson(res, 400, { errors: ["Ismeretlen egység."] });
    }
    const result = await createBookingRequest(
      {
        siteId,
        unitId,
        guestName: form.get("name") ?? "",
        guestEmail: form.get("email") ?? "",
        guestPhone: form.get("phone"),
        dateFrom: form.get("from") ?? "",
        dateTo: form.get("to") ?? "",
        guests: Number(form.get("guests") ?? "1"),
        message: form.get("message"),
      },
      publicBaseUrl(req),
    );
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  // ── ADR-0046 guest review submission ────────────────────────────────────────
  // A plain form POST answered with a full page, not JSON: the form on the page is
  // JS-free by design, so the reply has to work without a script too.
  if (req.method === "POST" && pathname === "/api/velemeny") {
    const back = `${publicBaseUrl(req) ?? ""}/`;
    if (throttled(req, 3, 10 * 60_000)) {
      return send(res, 429, reviewThanksPage({ errors: ["Túl sok próbálkozás. Kérjük, várjon pár percet."], backUrl: back }));
    }
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId) return send(res, 404, reviewThanksPage({ errors: ["Ismeretlen szállás."], backUrl: back }));
    const form = await readFormBody(req);
    // An unknown unit is dropped rather than rejected: the review itself is still
    // worth keeping, it just belongs to the place as a whole.
    const unitId = form.get("unit") ?? "";
    const unitOk = unitId ? await unitBelongsToSite(siteId, unitId) : false;
    const result = await createReview(
      {
        siteId,
        unitId: unitOk ? unitId : null,
        authorName: form.get("name") ?? "",
        authorEmail: form.get("email"),
        rating: Number(form.get("rating") ?? "0"),
        body: form.get("body") ?? "",
        stayMonth: form.get("stay_month"),
      },
      publicBaseUrl(req),
    );
    return send(
      res,
      result.ok ? 200 : 400,
      reviewThanksPage({ ...(result.ok ? {} : { errors: result.errors }), backUrl: back }),
    );
  }

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
    // ADR-0044/d: the unit subpages are the URL production the visibility engine is
    // about. Listed from what was ACTUALLY written (site.edited_site_data.__unitPages),
    // never from the unit list — a sitemap must not advertise a URL that 404s.
    const pages = await unitPageSlugs(site.tenantId);
    const urls = [
      `  <url><loc>https://${canonicalHost}/</loc></url>`,
      ...pages.map((s) => `  <url><loc>https://${canonicalHost}/apartman/${s}</loc></url>`),
    ].join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    return send(res, 200, xml, "application/xml; charset=utf-8");
  }
  // ADR-0044/d unit subpage — the same static-snapshot serving as the homepage.
  const unitPage = /^\/apartman\/([a-z0-9-]{1,80})$/.exec(pathname);
  if (unitPage && site.path) {
    const file = path.join(path.dirname(path.resolve(process.cwd(), site.path)), "apartman", `${unitPage[1]}.html`);
    try {
      const raw = await readFile(file, "utf8");
      return send(res, 200, await injectOwnerLogin(raw));
    } catch {
      return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
    }
  }
  // Owner re-entry: the owner's instinct on their own site is <domain>/admin, which used to
  // 404. Send those guesses to the tenant login instead (302 — the admin does not live here).
  if (pathname === "/admin" || pathname === "/login") {
    res.writeHead(302, { Location: TENANT_LOGIN_URL });
    return void res.end();
  }
  if (pathname !== "/" && pathname !== "/index.html") {
    return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
  }
  if (!site.path) return send(res, 404, "<h1>Az oldal még nem érhető el.</h1>");
  try {
    const raw = await readFile(path.resolve(process.cwd(), site.path), "utf8");
    // LIVE host only — the preview/mock paths never get the login line (no account yet).
    send(res, 200, await injectOwnerLogin(raw));
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
  moduleId?: string | null,
  month?: string | null,
  cfgErrors?: string[],
  unitId?: string | null,
  helpTopic?: string | null,
  helpQuery?: string | null,
): Promise<void> {
  const session = await currentTenant(req);
  if (!session) return redirect(res, "/login");
  const content = await getTenantContent(session.tenantId);
  const site = await db
    .selectFrom("site")
    .select(["id", "preview_token", "slug", "custom_domain", "status"])
    .where("tenant_id", "=", session.tenantId)
    .executeTakeFirst();
  // Public URL only once the site is actually LIVE (ADR-0014 state machine).
  const siteUrl =
    site && site.status === "live"
      ? tenantSiteUrl(config.publicSiteUrl, site.slug, site.custom_domain)
      : null;
  const modules = await getTenantModules(session.tenantId);
  // ADR-0044/d: the Fotók tab assigns photos to units, so it needs the unit list.
  const adminUnits = site?.id
    ? (await ensureUnits(site.id)).map((u) => ({ id: u.id, name: u.name }))
    : [];

  // ADR-0044: ?m=<module> opens that module's settings screen. Only a module the
  // tenant actually has ACTIVE may be configured — otherwise the screen would let
  // someone set up something they have not bought.
  let moduleSettingsHtml: string | null = null;
  if (tab === "modulok" && moduleId && site?.id) {
    const active = modules.modules.find((m) => m.id === moduleId && m.active);
    if (active && hasSettingsScreen(moduleId)) {
      const cfg = await getSiteModuleConfig(site.id, moduleId);
      const canRestore = await hasPreviousModuleConfig(site.id, moduleId);
      // Availability hangs off a UNIT (0024). ensureUnits guarantees at least one,
      // so a single-unit owner never meets the concept — no picker, no choice.
      let booking;
      if (moduleId === "booking") {
        const units = await ensureUnits(site.id);
        const unit = (unitId && units.find((u) => u.id === unitId)) || units[0]!;
        booking = {
          month: await getMonthAvailability(unit.id, normaliseMonth(month)),
          units: units.map((u) => ({
            id: u.id,
            name: u.name,
            capacity: u.capacity,
            description: u.description,
          })),
          unitId: unit.id,
          links: await getCalendarLinks(unit.id),
          exportUrl: await getExportFeedUrl(unit.id, siteUrl),
          requests: await getRequests(site.id),
        };
      }
      // The rooms and pricing editors read the SAME site_unit rows the booking
      // calendar uses — three modules, one truth about what the owner rents out.
      let units;
      let pricing;
      if (moduleId === "rooms" || moduleId === "pricing") {
        const list = await ensureUnits(site.id);
        const assigned = photosByUnit(
          ((await getTenantContent(session.tenantId))?.photos ?? []) as never,
        );
        units = list.map((u) => ({
          id: u.id,
          name: u.name,
          capacity: u.capacity,
          description: u.description,
          slug: u.slug,
          amenities: u.amenities,
          photoCount: assigned.get(u.id)?.length ?? 0,
          seasonalOnly: u.seasonalOnly,
        }));
        if (moduleId === "pricing") {
          const prices: Record<string, Awaited<ReturnType<typeof getUnitPrices>>> = {};
          for (const u of list) prices[u.id] = await getUnitPrices(u.id);
          pricing = {
            units,
            prices,
            currency: String(cfg.config.currency ?? "HUF"),
          };
        }
      }

      // ADR-0046 — the review inbox plus whatever Google badge the visitor sees, so
      // the owner can check the claim rather than take the toggle on faith.
      let reviews;
      if (moduleId === "reviews") {
        reviews = {
          items: (await getReviews(site.id)).map((r) => ({
            id: r.id,
            authorName: r.authorName,
            rating: r.rating,
            body: r.body,
            stayMonth: r.stayMonth,
            unitName: r.unitName,
            status: r.status,
            verified: r.verified,
            token: r.token,
          })),
          google: await getPlaceRating(site.id).then((g) =>
            g ? { value: g.rating, count: g.userRatingCount, url: g.reviewsUrl } : null,
          ),
        };
      }

      moduleSettingsHtml = moduleSettingsSection(moduleId, {
        values: cfg.config,
        canRestore,
        priceMonthly: active.priceMonthly,
        ...(cfgErrors?.length ? { errors: cfgErrors } : {}),
        ...(booking ? { booking } : {}),
        ...(units ? { units } : {}),
        ...(pricing ? { pricing } : {}),
        ...(reviews ? { reviews } : {}),
      });
    }
  }

  // ADR-0045: the Súgó tab — repo-sourced KB entries, searched server-side so the
  // no-JS phone flow works. ?topic= accepts an anchor (admin.photos) or an entry id.
  // ③ (§J.25): served in the tenant's site language via the kb_translation overlay.
  let help: AdminOpts["help"] = null;
  if (tab === "sugo") {
    const entries = (await localizedKbEntries(content?.lang)).filter(
      (e) => e.audience === "tenant",
    );
    const open = helpTopic ? pickKbEntry(entries, helpTopic) : null;
    help = {
      topics: filterKbEntries(entries, helpQuery ?? "").map((e) => ({
        id: e.id,
        title: e.title,
        snippet: e.snippet,
      })),
      open: open
        ? {
            title: open.title,
            html: renderKbBody(open.body, `/admin/kb/${open.id}/`),
            updated: open.updated,
          }
        : null,
      query: helpQuery ?? "",
    };
  }

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
      moduleSettingsHtml,
      units: adminUnits,
      help,
    }),
  );
}

/**
 * Absolute base URL of the current request — the e-mail links (accept/decline)
 * and the calendar feed must be reachable from outside, so they cannot be relative.
 */
function publicBaseUrl(req: http.IncomingMessage): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${PORT}`);
  const proto = String(req.headers["x-forwarded-proto"] ?? (host.startsWith("localhost") ? "http" : "https"));
  return `${proto}://${host}`;
}

/** Unit subpages that were actually written for this tenant (drives the sitemap). */
async function unitPageSlugs(tenantId: string): Promise<string[]> {
  const row = await db
    .selectFrom("site")
    .select("edited_site_data")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  const raw = (row?.edited_site_data as { __unitPages?: unknown } | null)?.__unitPages;
  return Array.isArray(raw) ? raw.map(String).filter((s) => /^[a-z0-9-]+$/.test(s)) : [];
}

/** The tenant's site id — module config is keyed on the SITE (ADR-0044). */
async function tenantSiteId(tenantId: string): Promise<string | null> {
  const row = await db
    .selectFrom("site")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row?.id ?? null;
}

/** Guard: only a module the tenant actually has ACTIVE may be configured. */
async function tenantHasModule(tenantId: string, moduleId: string): Promise<boolean> {
  if (!MODULE_CONFIG_REGISTRY[moduleId]) return false;
  const mv = await getTenantModules(tenantId);
  return mv.modules.some((m) => m.id === moduleId && m.active);
}

/**
 * Form values → typed config, driven by the module's declared fields. An
 * unchecked checkbox simply does not post, hence the explicit `false`. Anything
 * the registry does not declare is ignored here and again in the store.
 */
function formToConfig(moduleId: string, form: URLSearchParams): ModuleConfigValues {
  const def = MODULE_CONFIG_REGISTRY[moduleId];
  const out: ModuleConfigValues = {};
  if (!def) return out;
  for (const f of def.fields) {
    if (f.type === "toggle") {
      out[f.key] = form.get(f.key) !== null;
      continue;
    }
    const raw = form.get(f.key);
    if (raw === null) continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[f.key] = n;
      continue;
    }
    if (f.type === "lines") {
      const items = raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      out[f.key] = f.maxItems ? items.slice(0, f.maxItems) : items;
      continue;
    }
    out[f.key] = raw.trim();
  }
  return out;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const { pathname } = url;

  // ── Tenant host routing (0017): <slug>.citoviso.com / a custom domain serves
  // THAT tenant's live site. Runs first, so a tenant host never falls through to
  // the marketing homepage. Only 'live' sites resolve — a provisioned (paid-for
  // but private) site stays token-only, keeping the ADR-0014 state machine intact.
  const tenantSite = await resolveTenantSite(req);
  if (tenantSite) return serveTenantHost(req, res, tenantSite, pathname);
  // Dev-only slug path (never on the platform — see DEV_SLUG_PATH).
  if (DEV_SLUG_PATH && pathname.startsWith("/t/")) {
    const rest = pathname.slice(3);
    const slash = rest.indexOf("/");
    const slug = slash === -1 ? rest : rest.slice(0, slash);
    const inner = slash === -1 ? "/" : rest.slice(slash);
    const devSite = slug ? await resolveDevSlugSite(slug) : null;
    if (!devSite) return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
    return serveTenantHost(req, res, devSite, inner);
  }
  // An unresolved tenant subdomain must NOT fall through to the landing page.
  if (isUnclaimedTenantHost(req)) {
    return send(
      res,
      404,
      "<h1>Ez az oldal még nem érhető el.</h1><p>Ha a sajátját keresi, írjon nekünk: " +
        `<a href="mailto:info@${PLATFORM_DOMAIN}">info@${PLATFORM_DOMAIN}</a>.</p>`,
    );
  }

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
  // ── ADR-0044: per-module settings ──
  // POST /admin/module-config — save one module's declarative fields.
  if (req.method === "POST" && pathname === "/admin/module-config") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const moduleId = form.get("module") ?? "";
    const siteId = await tenantSiteId(session.tenantId);
    if (!siteId || !(await tenantHasModule(session.tenantId, moduleId))) {
      return redirect(res, "/admin?tab=modulok");
    }
    const result = await setSiteModuleConfig(
      siteId,
      moduleId,
      formToConfig(moduleId, form),
      session.tenantUserId,
    );
    const back = `/admin?tab=modulok&m=${encodeURIComponent(moduleId)}`;
    if (!result.ok) {
      const q = result.errors.map((e) => `hiba=${encodeURIComponent(e)}`).join("&");
      return redirect(res, `${back}&${q}`);
    }
    return redirect(res, `${back}&saved=1`);
  }
  // POST /admin/module-config/restore — "tegyék vissza, ahogy volt".
  if (req.method === "POST" && pathname === "/admin/module-config/restore") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const moduleId = form.get("module") ?? "";
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId && (await tenantHasModule(session.tenantId, moduleId))) {
      await restorePreviousModuleConfig(siteId, moduleId, session.tenantUserId);
    }
    return redirect(res, `/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&saved=1`);
  }
  // POST /admin/availability — the booking calendar: this month's MANUAL blocks
  // for ONE unit. The unit is verified to belong to this tenant's site.
  if (req.method === "POST" && pathname === "/admin/availability") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const month = normaliseMonth(form.get("month"));
    const unit = form.get("unit") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "booking"))) {
      if (await unitBelongsToSite(siteId, unit)) {
        await setManualMonthBlocks(unit, month, form.getAll("day"));
      }
    }
    return redirect(res, `/admin?tab=modulok&m=booking&e=${encodeURIComponent(unit)}&ho=${month}&saved=1`);
  }
  // POST /admin/calendar-link — connect a portal calendar (owner never sees "iCal").
  if (req.method === "POST" && pathname === "/admin/calendar-link") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const url = (form.get("url") ?? "").trim();
    const unit = form.get("unit") ?? "";
    const back = `/admin?tab=modulok&m=booking&e=${encodeURIComponent(unit)}`;
    if (siteId && url && (await tenantHasModule(session.tenantId, "booking"))) {
      if (!(await unitBelongsToSite(siteId, unit))) return redirect(res, back);
      if (!/^https?:\/\//i.test(url)) {
        return redirect(
          res,
          `${back}&hiba=${encodeURIComponent("A link nem érvényes webcím. Másolja be újra, teljes egészében.")}`,
        );
      }
      // Sync immediately: the owner must see "14 foglalt napot látunk" right now —
      // that instant confirmation is what makes a non-technical owner believe it worked.
      const linkId = await addCalendarLink(unit, form.get("provider") ?? "Egyéb", url);
      await syncCalendarLink(linkId, unit, url);
    }
    return redirect(res, `${back}&saved=1`);
  }
  if (req.method === "POST" && pathname === "/admin/calendar-link/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId) await deleteCalendarLink(siteId, form.get("id") ?? "");
    return redirect(
      res,
      `/admin?tab=modulok&m=booking&e=${encodeURIComponent(form.get("unit") ?? "")}&saved=1`,
    );
  }
  // POST /admin/units/save — create or rename a bookable unit.
  if (req.method === "POST" && pathname === "/admin/units/save") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId) {
      const id = form.get("id") ?? "";
      const name = form.get("name") ?? "";
      const capRaw = Number(form.get("capacity") ?? "");
      const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw) : null;
      if (id && (await unitBelongsToSite(siteId, id))) {
        await updateUnit(siteId, id, name, cap, form.get("description"));
      } else if (!id) {
        await createUnit(siteId, name, cap, form.get("description"));
      }
    }
    return redirect(res, "/admin?tab=modulok&m=booking&saved=1");
  }
  if (req.method === "POST" && pathname === "/admin/units/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId) {
      const result = await deleteUnit(siteId, form.get("id") ?? "");
      if (!result.ok && result.reason) {
        return redirect(
          res,
          `/admin?tab=modulok&m=booking&hiba=${encodeURIComponent(result.reason)}`,
        );
      }
    }
    return redirect(res, "/admin?tab=modulok&m=booking&saved=1");
  }
  // POST /admin/photos/order — reorder; photos[0] is the cover in every template.
  if (req.method === "POST" && pathname === "/admin/photos/order") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const to = form.get("to");
    if (to === "up" || to === "down" || to === "cover") {
      await moveTenantPhoto(session.tenantId, form.get("url") ?? "", to);
    }
    return redirect(res, "/admin?tab=fotok&saved=1");
  }
  // POST /admin/photos/caption — the photo's alt text (templates, lightbox, screen readers).
  if (req.method === "POST" && pathname === "/admin/photos/caption") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await setTenantPhotoCaption(session.tenantId, form.get("url") ?? "", form.get("alt") ?? "");
    return redirect(res, "/admin?tab=fotok&saved=1");
  }
  // POST /admin/photos/units — assign a photo to units (one shared library).
  if (req.method === "POST" && pathname === "/admin/photos/units") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await setTenantPhotoUnits(session.tenantId, form.get("url") ?? "", form.getAll("unit"));
    return redirect(res, "/admin?tab=fotok&saved=1");
  }
  // POST /admin/units/content — a unit's own description + amenities (its subpage).
  if (req.method === "POST" && pathname === "/admin/units/content") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const unit = form.get("id") ?? "";
    if (siteId && (await unitBelongsToSite(siteId, unit))) {
      const units = await ensureUnits(siteId);
      const u = units.find((x) => x.id === unit)!;
      await updateUnit(siteId, unit, u.name, u.capacity, form.get("description"));
      await setUnitAmenities(
        siteId,
        unit,
        (form.get("amenities") ?? "").split(/\r?\n/),
      );
    }
    return redirect(res, "/admin?tab=modulok&m=rooms&saved=1");
  }
  // ── ADR-0044/c prices: an owner prices a UNIT, so every route is unit-scoped ──
  if (req.method === "POST" && pathname === "/admin/prices/base") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const unit = form.get("unit") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      if (await unitBelongsToSite(siteId, unit)) {
        const raw = Number(form.get("amount") ?? "");
        // Blank or zero clears the price: an owner must be able to take a number
        // back down, and an unset price renders nothing rather than a wrong figure.
        await setBasePrice(unit, Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null);
      }
    }
    return redirect(res, "/admin?tab=modulok&m=pricing&saved=1");
  }
  if (req.method === "POST" && pathname === "/admin/prices/season") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const unit = form.get("unit") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      if (await unitBelongsToSite(siteId, unit)) {
        const result = await addSeasonPrice(
          unit,
          form.get("label") ?? "",
          (form.get("from") ?? "").trim(),
          (form.get("to") ?? "").trim(),
          Number(form.get("amount") ?? ""),
          // ADR-0049: optional per-season minimum stay; empty → the module default.
          form.get("min_nights") ? Number(form.get("min_nights")) : null,
        );
        if (!result.ok) {
          const q = result.errors.map((e) => `hiba=${encodeURIComponent(e)}`).join("&");
          return redirect(res, `/admin?tab=modulok&m=pricing&${q}`);
        }
      }
    }
    return redirect(res, "/admin?tab=modulok&m=pricing&saved=1");
  }
  // ADR-0049 — "csak a felsorolt időszakokban adom ki", per unit. Off by default, so
  // an owner who never opens this screen keeps the all-year behaviour they had.
  if (req.method === "POST" && pathname === "/admin/units/seasonal") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const unit = form.get("unit") ?? "";
    if (siteId && (await unitBelongsToSite(siteId, unit))) {
      await setUnitSeasonalOnly(unit, form.get("seasonal_only") !== null);
      // The page shows which nights are free, so it has to be rebuilt.
      await rerenderTenantSnapshot(session.tenantId);
    }
    return redirect(res, "/admin?tab=modulok&m=pricing&saved=1");
  }

  if (req.method === "POST" && pathname === "/admin/prices/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId) await deletePrice(siteId, form.get("id") ?? "");
    return redirect(res, "/admin?tab=modulok&m=pricing&saved=1");
  }
  // POST /admin/booking/decide — the same verdict as the e-mail links, from the admin.
  if (req.method === "POST" && pathname === "/admin/booking/decide") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const verdict = form.get("verdict") === "accepted" ? "accepted" : "declined";
    const token = form.get("token") ?? "";
    // Ownership: the token must belong to a request on THIS tenant's site.
    const owned = siteId
      ? await db
          .selectFrom("booking_request")
          .select("id")
          .where("action_token", "=", token)
          .where("site_id", "=", siteId)
          .executeTakeFirst()
      : null;
    if (owned) {
      const r = await decideRequest(token, verdict, publicBaseUrl(req));
      if (r.outcome === "conflict") {
        return redirect(
          res,
          `/admin?tab=modulok&m=booking&hiba=${encodeURIComponent("Ezek a napok időközben foglalttá váltak, ezért nem fogadható el.")}`,
        );
      }
    }
    return redirect(res, "/admin?tab=modulok&m=booking&saved=1");
  }

  // ADR-0046 — the admin-side door to the same verdict. Ownership is checked on the
  // ROW, not the token, because the admin lists rows by id.
  if (req.method === "POST" && pathname === "/admin/review/decide") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const verdict = form.get("verdict") === "published" ? "published" : "rejected";
    const id = form.get("id") ?? "";
    const owned = siteId
      ? await db
          .selectFrom("site_review")
          .select("action_token")
          .where("id", "=", id)
          .where("site_id", "=", siteId)
          .executeTakeFirst()
      : null;
    if (owned) {
      // Re-deciding an already-decided review is a legitimate action here (taking a
      // published one down), so the row is reset to pending first — decideReview is
      // deliberately idempotent and would otherwise report "already".
      await db
        .updateTable("site_review")
        .set({ status: "pending" })
        .where("id", "=", id)
        .where("site_id", "=", siteId!)
        .execute();
      await decideReview(owned.action_token, verdict, publicBaseUrl(req));
      // Both directions change the page: publishing adds words, withdrawing removes them.
      await rerenderTenantSnapshot(session.tenantId);
    }
    return redirect(res, "/admin?tab=modulok&m=reviews&saved=1");
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

    // GET /naptar/<token>.ics — our outgoing calendar for one unit. Public by
    // design (a portal fetches it unauthenticated), but the token is opaque and
    // the feed carries only busy dates — no guest name, no contact, nothing personal.
    const feedMatch = /^\/naptar\/([A-Za-z0-9_-]{10,64})\.ics$/.exec(pathname);
    if (feedMatch) {
      const unit = await unitByFeedToken(feedMatch[1]!);
      if (!unit) return send(res, 404, "Nincs ilyen naptár.");
      const row = await db
        .selectFrom("site_unit")
        .select("name")
        .where("id", "=", unit)
        .executeTakeFirst();
      const ics = await buildUnitFeed(unit, row?.name ?? "Szállás");
      res.writeHead(200, {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      });
      res.end(ics);
      return;
    }

    // GET /foglalas/<token>/elfogadom|elutasitom — the owner's one-tap verdict
    // straight from the notification e-mail, with no login. This is what keeps the
    // module alive for an owner who will never open an admin to approve a booking.
    const decideMatch = /^\/foglalas\/([A-Za-z0-9_-]{16,80})\/(elfogadom|elutasitom)$/.exec(pathname);
    if (decideMatch) {
      const verdict = decideMatch[2] === "elfogadom" ? "accepted" : "declined";
      const r = await decideRequest(decideMatch[1]!, verdict, publicBaseUrl(req));
      return send(res, r.outcome === "unknown" ? 404 : 200, bookingVerdictPage(r));
    }

    // GET /velemeny/<token>/kiteszem|nem-teszem-ki — the owner's one-tap verdict on a
    // review, straight from the e-mail with no login (ADR-0046). Idempotent, because
    // mail clients prefetch links and owners double-tap.
    const revMatch = /^\/velemeny\/([A-Za-z0-9_-]{16,80})\/(kiteszem|nem-teszem-ki)$/.exec(pathname);
    if (revMatch) {
      const verdict = revMatch[2] === "kiteszem" ? "published" : "rejected";
      const r = await decideReview(revMatch[1]!, verdict, publicBaseUrl(req));
      // A published verdict changes what the page shows, and the page is a STATIC
      // file — without this rebuild the owner taps "Kiteszem" and nothing appears.
      if (r.ok && r.outcome === "published" && r.tenantId) {
        await rerenderTenantSnapshot(r.tenantId);
      }
      return send(res, r.outcome === "unknown" ? 404 : 200, reviewVerdictPage(r));
    }

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
        url.searchParams.get("m"),
        url.searchParams.get("ho"),
        url.searchParams.getAll("hiba"),
        url.searchParams.get("e"),
        url.searchParams.get("topic"),
        url.searchParams.get("q"),
      );
    // ADR-0045 §J.26: KB screenshots live in the repo — served session-gated and
    // path-fenced to kb/entries/<id>/assets/ (kbAssetPath refuses escapes).
    const kbAsset = /^\/admin\/kb\/([a-z0-9-]+)\/(assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp))$/.exec(
      pathname,
    );
    if (kbAsset) {
      if (!(await currentTenant(req))) return redirect(res, "/login");
      const abs = kbAssetPath(kbAsset[1]!, kbAsset[2]!);
      if (!abs) return send(res, 404, "Nincs ilyen kép.", "text/plain");
      try {
        const buf = await readFile(abs);
        res.writeHead(200, {
          "Content-Type": abs.endsWith(".png")
            ? "image/png"
            : abs.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg",
          "Cache-Control": "private, max-age=3600",
        });
        res.end(buf);
      } catch {
        send(res, 404, "Nincs ilyen kép.", "text/plain");
      }
      return;
    }
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

// ADR-0036 boot-time self-heal: a deploy+restart automatically tops up every known language
// pack to the current catalog (the catalog grows during development; a stale pack would leak
// Hungarian strings onto foreign pages). Fire-and-forget — boot must not block on the AI.
void (async () => {
  const { ensureAllLanguagePacks } = await import("../i18n/packs.js");
  const rows = await ensureAllLanguagePacks();
  for (const r of rows) {
    const kb = r.kb ? ` · KB ${r.kb.total - r.kb.missing}/${r.kb.total}` : "";
    console.log(
      `[i18n] csomag ${r.lang}: ${r.total - r.missing}/${r.total}${kb}${r.ok ? "" : " ⛔ HIÁNYOS"}`,
    );
  }
  if (!rows.length) console.log("[i18n] nincs nem-magyar nyelvterület — csomag-ellenőrzés kész");
})().catch((e) => console.error(`[i18n] boot-ellenőrzés hiba: ${(e as Error).message}`));
