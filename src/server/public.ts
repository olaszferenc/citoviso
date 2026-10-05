// Public web server (ADR-0022): serves the static homepage from public/ AND the
// self-serve intake API. Replaces the dev python static server on :4800.
//   GET  /                     → public/index.html
//   GET  /<static asset>       → public/<asset>
//   POST /api/mock-request     → enqueue an auto-mock, return { ok, token }
//   GET  /m/:token             → the generated preview for a request token
//   GET  /login              → login placeholder (ADR-0021 ③ builds the real one)
// Run: tsx src/server/public.ts   (persist with setsid/nohup like the preview server)

import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { applyOffer, bestActiveCouponForTenant } from "../payment/offers.js";
import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "kysely";

import { db } from "../db/client.js";
import { runWithViewZone, viewToday, viewZone } from "../tenant/zoneCtx.js";
import { setTenantTimeZone, tenantTimeZone, zonePickerDataFor } from "../tenant/timeZone.js";
import { isValidTimeZone } from "../text/zoneTime.js";
import type { ZonePickerData } from "../tenant/zonePicker.js";
import { midnightIn, todayIn, yearIn } from "../text/zoneTime.js";
import { config } from "../config.js";
import { injectConsent, markAudience } from "./consent.js";
import { isPlatformHosting, normalizeCustomDomain, PLATFORM_DOMAIN, tenantSiteUrl } from "../domains.js";
import { prospectTokenForLabel } from "../outreach/previewLabel.js";
import { esc, privacyPage } from "../console/views.js";
import { renderSuspendedPage, suspendedLang } from "./suspendedPage.js";
import { TENANT_LEGAL_PATHS } from "../engine/legalPages.js";
import { hostingProvider, loadTenantLegal, saveTenantLegal } from "../tenant/legalIdentity.js";
import {
  adatfeldolgozasPage,
  aszfPage,
  elallasPage,
  impresszumPage,
} from "./legalViews.js";
import { createMockRequest } from "../intake/mockRequest.js";
import { frameDemoMock } from "../generator/demoFrame.js";
import {
  authenticate,
  changeTenantPassword,
  clearSession,
  currentTenant,
  safeAdminNext,
  setSession,
  updateContactEmail,
} from "../auth/tenantAuth.js";
import {
  addTenantPhotos,
  getTenantContent,
  moveTenantPhoto,
  removeTenantPhoto,
  saveTenantContent,
  getTenantContact,
  saveTenantContact,
  setTenantPhotoCaption,
  setTenantPhotoUnits,
  setTenantUnitPhotos,
  setTenantUnitCover,
  unitCoverPhoto,
  photosByUnit,
  rerenderTenantSnapshot,
  renderTenantModulePreview,
  moduleContentFor,
} from "../tenant/editor.js";
import { priceSiteView } from "../tenant/priceSiteView.js";
import { CONTACT_ERRORS, type ContactErrorKey } from "../tenant/contact.js";
import { normalizeUpload } from "../tenant/photoUpload.js";
import { getAssetStore } from "../tenant/assetStore.js";
import {
  adminDashboard,
  chargeRetryAnchor,
  DECLINED_NOTE_ANCHOR,
  domainSettlementSection,
  forgotPasswordPage,
  forgotPasswordSentPage,
  passwordLinkDeadPage,
  passwordSetDonePage,
  setPasswordPage,
  loginPage,
} from "./adminViews.js";
import { calendarFocus, pendingInOrder } from "./bookingViews.js";
import { decoratePreview, parsePreviewSet } from "./modulePreview.js";
import type { AdminOpts, DomainSettlementView } from "./adminViews.js";
import { filterKbEntries, kbAssetPath, loadKbEntries, pickKbEntry, renderKbBody } from "../kb/kb.js";
import { localizedKbEntries } from "../i18n/kbPacks.js";
import { TENANT_LOGIN_URL, injectOwnerLogin } from "./ownerLogin.js";
import {
  filledContentFields,
  getTenantModules,
  paidButEmptyModules,
  siteRendersModule,
  tenantRendersModule,
} from "../tenant/modules.js";
import { applyModuleChange } from "../tenant/moduleChange.js";
import { createFirstChargeOrder } from "../tenant/moduleUpsell.js";
import { getSubscriptionAdmin, getSubscriptionSummary, setSubscriptionCancel } from "../tenant/subscriptionAdmin.js";
import { createCardUpdateOrder, getWalletAdmin } from "../tenant/wallet.js";
import { revokeAutoCharge, setPendingBillingPeriod } from "../payment/subscription.js";
import { retryRenewalCharge } from "../payment/retryCharge.js";
import { chargeUpsellWithToken, openUpsellPayUrl, requestPayment } from "../payment/service.js";
import { MODULE_CATALOG } from "../modules.js";
import { DEFAULT_LANG, langName, uiLangs } from "../i18n/lang.js";
import { T, langForTenant, prepareMailLang } from "../i18n/mail.js";
import { peekPasswordToken, setPasswordWithToken } from "../auth/passwordLink.js";
import { sendPasswordResetLinks } from "../tenant/credentials.js";
import { loginLocked, recordLoginFailure } from "../auth/loginGuard.js";
import { getMultilang } from "../tenant/multilangCore.js";
import { multilangCardData } from "../tenant/multilangCard.js";
import { composeAmenities, splitAmenities } from "../tenant/amenityCatalog.js";
import { createMultilangOrder } from "../tenant/multilangOrder.js";
import { listTenantInvoices, listTenantAgreements, tenantInvoicePdf } from "../tenant/documents.js";
import { countUnreadMessages, isUnread, listTenantMessages, markAllMessagesRead, markMessageRead } from "../tenant/messages.js";
import { isMessageTopic } from "../tenant/messageTopics.js";
// ADR-0071/0078 — saját webcím: adat a fülhöz, rendelés, és a lokál-teszt kapu.
import { loadDomainAdmin, checkTypedDomain } from "../domains/domainAdmin.js";
import { checkWebcimAvailability } from "../domains/availability.js";
import { createDomainUpgradeOrder } from "../domains/domainUpgrade.js";
import { activeDomainCommitment } from "../domains/domainCommitment.js";
import {
  createSettlementOrder,
  openSettlement,
  settlementQuote,
  voidUnpaidSettlement,
} from "../domains/domainSettlement.js";
import { sendSettlementMail } from "../domains/settlementNotify.js";
import { payEntryUrl } from "../payment/payEntryUrl.js";
import { isMockDomainProvisioning, provisionOrderDomain } from "../domains/provisionDomain.js";
import {
  bookingVerdictPage,
  bookingDecideConfirmPage,
  guestCancelConfirmPage,
  guestCancelDonePage,
  hasSettingsScreen,
  moduleSettingsSection,
  type NewUnitView,
  reviewThanksPage,
  reviewVerdictPage,
  reviewDecideConfirmPage,
} from "./moduleConfigViews.js";
import { createReview, decideReview, getReviews, peekReviewDecision } from "../reviews/reviews.js";
import { getPlaceRating } from "../reviews/placeRating.js";
import {
  createUnit,
  deleteUnit,
  unitDeletionImpacts,
  ensureUnits,
  setUnitAmenities,
  setUnitSeasonalOnly,
  setUnitPriceOnRequest,
  setWholeProperty,
  settleFormerWhole,
  futureAcceptedBookings,
  getUnits,
  adminUnitOrder,
  bookableUnits,
  guestUnits,
  isBookableUnit,
  isWholeOnlySite,
  unitBelongsToSite,
  updateUnit,
} from "../tenant/units.js";
import {
  bookingExpireHours,
  cancelRequest,
  createBookingRequest,
  decideRequest,
  peekDecision,
  getRequests,
  loadOfferView,
  markRequestsSeen,
  peekCancelView,
  peekGuestOffer,
  recordOfferAcceptedByOwner,
  respondToOffer,
  sendOffer,
  getSentOffers,
  pendingRequestCount,
  parseOfferAmount,
} from "../booking/requests.js";
import { RE_GUEST_CANCEL, RE_GUEST_OFFER, RE_OWNER_OFFER, RE_OWNER_DECIDE, RE_OWNER_REVIEW, servesOnTenantHostToo } from "./mailLinkRoutes.js";
import {
  guestOfferPage,
  guestOfferResultPage,
  ownerOfferPage,
  ownerOfferSentPage,
} from "./offerViews.js";
import { createEnquiry } from "../booking/enquiry.js";
import {
  addSeasonPrice,
  deletePrice,
  getUnitPrices,
  moveSeasonPrice,
  setBasePrice,
  setSeasonYearPrice,
  updateSeasonPrice,
  unitPriceStatus,
  type UnitPriceStatus,
} from "../tenant/prices.js";
import { sitePriceGaps } from "../tenant/priceGap.js";
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
import { MODULE_CONFIG_REGISTRY, effectiveModuleConfig, type ModuleConfigValues } from "../moduleConfig.js";
import { recordSiteVisit } from "../analytics/siteVisit.js";
import { readOrder, readPicks, resolvePicks, sanitizePicks, siteOwnSettlement, siteProgramPool } from "../events/picks.js";
import { distanceKm } from "../events/gates.js";
import { getTrafficReport, getVisitorSeries } from "../analytics/trafficReport.js";
import { messagePreview } from "../tenant/messagePreview.js";
import { clientIp } from "./clientIp.js";
import { faviconSvg, heroMarkSvg, lockup } from "../ui/brand.js";
import {
  computeAnnual,
  formatPrice,
  getCurrency,
  getOneTimePrice,
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

/**
 * A süti-sáv + a Barion Pixel beillesztése a KÖZÖS kimeneten.
 *
 * ⛔ A snippet és a CÍMZETT-szabály a `src/server/consent.ts`-ben él, mert a
 * `citoviso.com` élesben KÉT processz között van felosztva (nginx), és a másik
 * processz (konzol :4600) viszi a vevő fizetési útját. Egy szabály két példányban
 * két igazság — a `/privacy` és az `/adatvedelem` pontosan ezt csinálta.
 */
/**
 * A VENDÉGNEK szóló lapok — a határ, egy helyen.
 *
 * ⚠️ A minták NEVESÍTVE vannak, és a route-ok UGYANEZEKET használják lentebb: egy
 * szabály két példányban két igazság, és a lemondó-útvonal mintája már eddig is két
 * helyen élt. Aki új vendég-lapot vesz fel, ide is beírja — és az őr
 * (`scripts/consent-style-check.mts`) a RENDERELT lapon méri, hogy sikerült-e.
 */
const RE_MOCK_PREVIEW = /^\/m\/([a-f0-9]{8,64})$/;
const RE_PREVIEW_SITE = /^\/site\/([A-Za-z0-9_-]{10,64})$/;
// The mail-linked routes live in ONE module, shared with the tenant-host dispatcher
// below and with scripts/guest-link-host-check.mts (see mailLinkRoutes.ts for why).
const GUEST_PAGE_ROUTES: readonly RegExp[] = [
  // A generált szállás-oldal MAGA, csak másik ajtón: a `/site/<preview_token>` ugyanazt
  // a `sites/<tenant>/index.html`-t adja ki, amit a tenant-host (mérve: bájtazonos
  // forrás), a `/m/<token>` pedig annak a bemutató-változatát — amit ráadásul HIDEG
  // megkeresésben kap meg valaki, aki semmit nem kért tőlünk.
  RE_PREVIEW_SITE,
  RE_MOCK_PREVIEW,
  // A vendég lemondó lapjai (GET megerősítés + POST eredmény). Itt a vendég a saját
  // foglalását mondja le a szállásadónál — nálunk semmit nem fizet.
  RE_GUEST_CANCEL,
  // A vendég ajánlat-lapja (booking-offer ⑪): ugyanaz a vendég, ugyanaz a szállás.
  RE_GUEST_OFFER,
];

function send(res: http.ServerResponse, code: number, body: string | Buffer, type = "text/html; charset=utf-8"): void {
  const out =
    typeof body === "string" && type.startsWith("text/html") ? injectConsent(body, res) : body;
  res.writeHead(code, { "Content-Type": type });
  res.end(out);
}

async function readRawBody(req: http.IncomingMessage, limit = 64_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    // Over the limit: keep DRAINING, stop keeping. Throwing inside the loop destroyed
    // the request mid-upload, so the refusal never reached the browser and its XHR
    // hung at 100% — holding up every file queued behind it.
    if (size <= limit) chunks.push(c as Buffer);
  }
  if (size > limit) throw new Error("body too large");
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * One photo per request (the Fotók tab and the room editor both send them one by
 * one): 6 MB of image is ~8 MB as base64, plus the JSON around it. The global 64 KB
 * cap refused every real photo.
 */
const PHOTO_BODY_LIMIT = 8_500_000;

async function readJsonBody(req: http.IncomingMessage, limit?: number): Promise<Record<string, unknown>> {
  const raw = await readRawBody(req, limit);
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

/**
 * Redirect after a save that CHANGES WHAT THE GUEST SEES.
 *
 * The public page is a static snapshot (sites/<tenant>/index.html): a DB write on
 * its own changes nothing a visitor can load. Measured 2026-09-08 on the owner's
 * own site: two units added at 18:18 and 18:20 sat in `site_unit` while the served
 * page — written at 18:16 — still showed a single room. The admin said "Mentve",
 * the site said otherwise, and nothing in between reported the gap.
 *
 * So the re-render is not a per-route detail to remember: every content-affecting
 * admin save goes out through THIS door, and scripts/snapshot-propagation-check.mts
 * fails the build if a new one does not (or is not listed there with a reason).
 */
/** ADR-0241 — the contact form's fields; an absent field stays `undefined` (= keep). */
function contactEditsFrom(form: URLSearchParams): import("../tenant/contact.js").ContactEdits {
  const get = (k: string) => (form.has(k) ? (form.get(k) ?? "") : undefined);
  return { address: get("address"), phone: get("phone"), email: get("email"), lat: get("lat"), lon: get("lon") };
}

/** Refused fields travel back as `pe=<key>` — keys, never free text in the URL. */
function contactErrorQuery(errors: readonly ContactErrorKey[]): string {
  return errors.length ? "&" + errors.map((e) => `pe=${encodeURIComponent(e)}`).join("&") : "&pe=save";
}

function contactErrorsFrom(params: URLSearchParams): ContactErrorKey[] {
  return params.getAll("pe").filter((k): k is ContactErrorKey => k in CONTACT_ERRORS);
}

async function redirectRerendered(
  res: http.ServerResponse,
  tenantId: string,
  to: string,
): Promise<void> {
  // Best-effort: a render failure must not swallow a save the owner already made —
  // it is louder in the log than a lost redirect would be in the browser.
  try {
    await rerenderTenantSnapshot(tenantId);
  } catch (e) {
    console.error(`[admin] snapshot ÚJRARENDERELÉS HIBA (tenant ${tenantId}):`, e);
  }
  redirect(res, to);
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
 * ⛔ MÉRT PROBLÉMA (2026-09-11): a CDN a saját CSS/JS fájljainkat NÉGY ÓRÁRA
 * gyorsítótárazza (`cache-control: max-age=14400`, `cf-cache-status: HIT`), és
 * purge-kulcsunk nincs. A süti-sáv így élesen a lap ALJÁRA esett (`position:
 * static`, a doboz teteje 12560px egy 844px magas nézetben): a HTML már az ÚJ
 * volt, a stíluslap még a RÉGI. A deploy zöld volt, a látogató mégis törött
 * oldalt kapott — és a fizetési sáv is rossz méretben jelent meg.
 *
 * Ezért a hivatkozás a TARTALOMHOZ kötődik: a fájl rövid tartalom-ujjlenyomata
 * bekerül a query-be, tehát megváltozott tartalomhoz ÚJ cím tartozik, amit a
 * gyorsítótár nem ismerhet. Boot-időben számoljuk (deploy után a fájlok nem
 * változnak), így kérésenként nincs lemez-olvasás.
 */
const assetVersions = new Map<string, string>();
async function assetVersion(rel: string): Promise<string> {
  const cached = assetVersions.get(rel);
  if (cached) return cached;
  let v = "0";
  try {
    const buf = await readFile(path.join(PUBLIC_DIR, rel.replace(/^\//, "")));
    v = createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch {
    /* hiányzó fájl: verzió nélkül megy — a 404-et nem ez a réteg oldja meg */
  }
  assetVersions.set(rel, v);
  return v;
}

/** A SAJÁT css/js hivatkozásainkhoz ?v=<tartalom-ujjlenyomat>, hogy a CDN ne
 *  szolgálhasson ki elavult HTML+CSS párost. */
async function withAssetVersions(html: string): Promise<string> {
  const refs = [...html.matchAll(/(?:href|src)="(\/assets\/[^"?]+\.(?:css|js))"/g)].map((m) => m[1]!);
  let out = html;
  for (const rel of [...new Set(refs)]) {
    const v = await assetVersion(rel);
    out = out.split(`"${rel}"`).join(`"${rel}?v=${v}"`);
  }
  return out;
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
  let rendered = html.replace(
    /<!--CIT_PRICE_BLOCK-->[\s\S]*?<!--\/CIT_PRICE_BLOCK-->/,
    `<!--CIT_PRICE_BLOCK-->${block}<!--/CIT_PRICE_BLOCK-->`,
  );
  // The header and the footer are dark: the "B" lockup (dark E4 + white word) from the
  // one brand source (ADR-0236). The file only carries a plain-text fallback.
  rendered = rendered.replace(
    /<!--CIT_BRAND-->[\s\S]*?<!--\/CIT_BRAND-->/g,
    () => lockup({ on: "dark", href: "#top", cls: "citui-lockup--lg" }),
  );
  // The hero illustration: the same E4 mark, recoloured for the cyan sphere it sits on.
  rendered = rendered.replace(/<!--CIT_HERO_MARK-->[\s\S]*?<!--\/CIT_HERO_MARK-->/, () => heroMarkSvg());
  rendered = await withAssetVersions(rendered);
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
    send(res, 200, await frameDemoMock(html)); // demo-framing footer at serve time (§A)
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
  /** ADR-0108: the visit rows hang off the site, not just the tenant. */
  readonly siteId: string;
  readonly tenantId: string;
  readonly slug: string | null;
  readonly customDomain: string | null;
  /** ADR-0080: 'suspended' (billing freeze) serves a 503 courtesy page, NOT a
   *  silent 404 — Retry-After keeps Google from dropping the site's index. */
  readonly status: "live" | "suspended";
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
    .select(["id as siteId", "path", "tenant_id as tenantId", "slug", "custom_domain as customDomain", "status"])
    .where("status", "in", ["live", "suspended"])
    .where((eb) =>
      label
        ? eb(sql<string>`lower(site.slug)`, "=", label)
        : eb(sql<string>`lower(site.custom_domain)`, "=", host),
    )
    .executeTakeFirst();
  return row ? ({ ...row, viaSlug: !!label } as TenantHostSite) : null;
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

/** The first label of a `<label>.citoviso.com` host (lowercase). */
function hostLabel(req: http.IncomingMessage): string {
  const host = String(req.headers.host ?? "").split(":")[0]!.toLowerCase();
  return host.slice(0, -`.${PLATFORM_DOMAIN}`.length);
}

/** Request headers the console's /p/<token> page may read (language, device, own-view, consent). */
const PREVIEW_FORWARD_HEADERS = [
  "user-agent", "accept", "accept-language", "cookie", "x-real-ip",
  "cf-connecting-ip", "cf-ipcountry", "x-forwarded-proto",
];

/**
 * ADR-XXXX: serve the console's /p/<token> page on the lead's preview host, in place.
 * The console is the ONLY renderer of that page (tracking, configurator, owned/opt-out
 * framing) — duplicating it here would be a second truth. The GET records nothing
 * (ADR-0291), so the internal hop changes no measurement.
 */
async function proxyPreviewPage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  token: string,
  search: string,
): Promise<void> {
  const consolePort = Number(process.env.CONSOLE_PORT ?? "4600");
  const headers: Record<string, string> = {};
  for (const h of PREVIEW_FORWARD_HEADERS) {
    const v = req.headers[h];
    if (typeof v === "string") headers[h] = v;
  }
  try {
    const r = await fetch(`http://127.0.0.1:${consolePort}/p/${encodeURIComponent(token)}${search}`, {
      headers,
      redirect: "manual",
    });
    const out: Record<string, string | string[]> = {
      "content-type": r.headers.get("content-type") ?? "text/html; charset=utf-8",
      // A preview is never indexable, whatever the page itself says (ADR-0014).
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    };
    const cookies = r.headers.getSetCookie();
    if (cookies.length) out["set-cookie"] = cookies;
    const loc = r.headers.get("location");
    if (loc) out.location = loc;
    res.writeHead(r.status, out);
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (err) {
    console.error(`[public] preview host → console /p/ failed:`, (err as Error).message);
    send(res, 502, "<h1>Az oldal átmenetileg nem érhető el.</h1><p>Kérjük, próbálja újra néhány perc múlva.</p>");
  }
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

/**
 * ADR-0110 — public path → legal snapshot filename on the tenant's own host.
 *
 * Derived from TENANT_LEGAL_PATHS so the router, the footer links and the renderer
 * cannot drift apart: the dead `href="#"` in the footer existed precisely because
 * the link and the page were never tied to one another.
 */
const LEGAL_SNAPSHOT_FILES: Readonly<Record<string, string>> = {
  [TENANT_LEGAL_PATHS.privacy]: "adatvedelem.html",
  [TENANT_LEGAL_PATHS.imprint]: "impresszum.html",
};

async function resolveDevSlugSite(slug: string): Promise<TenantHostSite | null> {
  const row = await db
    .selectFrom("site")
    .select(["id as siteId", "path", "tenant_id as tenantId", "slug", "custom_domain as customDomain", "status"])
    .where("status", "in", ["live", "suspended"])
    .where(sql<string>`lower(site.slug)`, "=", slug.toLowerCase())
    .executeTakeFirst();
  return row ? ({ ...row, viaSlug: true } as TenantHostSite) : null;
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
 *  door, and a booking row is cheap to create but expensive to clean up. Keyed on
 *  `clientIp()` (ADR-0280) — the same rule as the login brake. */
const bookingHits = new Map<string, { n: number; until: number }>();
function throttled(req: http.IncomingMessage, limit: number, windowMs: number): boolean {
  const ip = clientIp(req);
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

/** ADR-0080 ⑦: bearer-secret check of the SMS-relay API (constant-time). */
function smsRelayAuthorized(req: http.IncomingMessage): boolean {
  const secret = config.smsRelaySecret;
  if (!secret) return false; // feature off → the routes 404
  const header = String(req.headers.authorization ?? "");
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

/**
 * Load what the FROZEN site's courtesy page tells the guest (ADR-0080 ⑥,
 * ADR-0119 ③, approved plan `assets/design-refs/console/freeze-state/`).
 *
 * Measured 2026-09-11: this page used to be two anonymous sentences. The guest
 * could not tell whether they were even in the right place, and had no way to
 * reach the host — a dead end in front of someone who wanted to book.
 *
 * The RENDERING lives in `suspendedPage.ts` so a guard can measure the sentences
 * without booting this server (ADR-0157); here we only read the data.
 *
 * The contact comes from the property's OWN site data — the same details the
 * live site shows guests — NOT from `tenant_legal`, which is the billing/legal
 * identity (often a private address, and frequently empty anyway).
 */
async function suspendedPage(tenantId: string, lang: string): Promise<string> {
  let name = "";
  let city = "";
  let email = "";
  let phone = "";
  let address = "";
  try {
    const row = await db
      .selectFrom("site")
      .leftJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
      .select(["mock_artifact.inputs as inputs", "site.edited_site_data as edits"])
      .where("site.tenant_id", "=", tenantId)
      .executeTakeFirst();
    const sd = ((row?.inputs as { siteData?: Record<string, unknown> } | null)?.siteData ??
      {}) as Record<string, unknown>;
    const edits = (row?.edits ?? {}) as Record<string, unknown>;
    const contact = (sd.contact ?? {}) as Record<string, string | undefined>;
    const place = (sd.place ?? {}) as Record<string, string | undefined>;
    // The owner's own edit of the name wins — that is what their guests know.
    name = String(edits.name ?? sd.name ?? "");
    city = String(place.city ?? "");
    email = String(contact.email ?? "");
    phone = String(contact.phone ?? "");
    address = String(contact.address ?? "");
  } catch (err) {
    // A missing artifact must not turn the courtesy page into a 500 — degrade to
    // the anonymous version rather than serving nothing at all.
    console.error(`[public] felfüggesztett lap: az adat nem olvasható (${tenantId})`, err);
  }
  return renderSuspendedPage({ name, city, email, phone, address }, lang);
}


async function serveTenantHost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  site: TenantHostSite,
  pathname: string,
): Promise<void> {
  /**
   * The language EVERY answer on this host must speak — the refusals included.
   *
   * ⛔ Mérve 2026-09-15 (az ADR-0157 ⑦ átadó-listája): ezen a hoston tizenegy
   * válasz beégetett magyar volt — a foglalás és az érdeklődés hibaüzenetei, és
   * minden 404-es lap. Egy horvát szállás vendége horvát oldalon kapott magyar
   * elutasítást; a nyelv KÉZNÉL VOLT (`site.tenantId`), csak senki nem kérte el.
   *
   * Memoizált: több ág is kérheti egy kérésen belül, és a throttle-ág is kéri (egy
   * eldobott kérés se váltson nyelvet), de a lekérdezés kérésenként legfeljebb
   * egyszer fut.
   *
   * ⚠️ A hívási helyeken MINDIG `const lang = await tenantLang()` előzi meg a
   * `T(lang, …)`-ot, sosem `T(await tenantLang(), …)`: a katalógus-betakarító
   * regexe AZONOSÍTÓT vár nyelv-argumentumként, az `await …` alak nem illeszkedne
   * rá — a string megint kimaradna a nyelvi csomagból, minden kapu zöldje mellett.
   */
  let langMemo: Promise<string> | null = null;
  const tenantLang = (): Promise<string> =>
    (langMemo ??= langForTenant(site.tenantId).then(prepareMailLang));

  // ── ADR-0080 billing freeze: EVERYTHING on a suspended host answers 503 ──
  // A courtesy page, not a silent 404: the guest learns the site is temporarily
  // down (in the site's own language), and Retry-After tells Google to come back
  // instead of dropping the pages from the index — that protects the tenant, who
  // will most likely pay and return. The booking/review APIs are inside the 503
  // too: a frozen site must not keep taking reservations.
  if (site.status === "suspended") {
    // ADR-0157: answer in the language the guest ARRIVED in, when the tenant paid
    // for it — not always the primary one (the freeze branch used to run before
    // the /<lang>/ router, so it never saw the prefix).
    const paidLangs = site.path ? await multilangLangsFor(site.path) : [];
    const lang = await prepareMailLang(
      suspendedLang(pathname, paidLangs, await langForTenant(site.tenantId)),
    );
    res.statusCode = 503;
    res.setHeader("Retry-After", "86400");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(await suspendedPage(site.tenantId, lang));
    return;
  }

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
    const today = todayIn(await tenantTimeZone(site.tenantId)); // the accommodation's today (ADR-0290)
    // Only busy DATES leave the building — no guest name, no contact, nothing personal.
    // Prices ride along (owner decree 2026-09-06): the widget shows the stay total
    // at booking time. Public data — the same numbers the pricing section renders.
    //
    // ⛔⛔ …AND ONLY WHEN THE PRICING MODULE ACTUALLY RENDERS (ADR-0193). This endpoint
    // used to skip the entitlement question entirely, so a tenant who cancelled
    // `pricing` had the price vanish from the PAGE while this JSON kept feeding the
    // widget — the guest read a stay total on a site that quotes no prices. Same
    // predicate as the renderer (isRenderedModule), asked through one function, so
    // the page and the widget cannot disagree about whether this site has prices.
    const pricingLive = await siteRendersModule(siteId, "pricing");
    const priceRows = pricingLive ? await getUnitPrices(unitId) : [];
    const pricingRow = await db
      .selectFrom("site_module_config")
      .select("config")
      .where("site_id", "=", siteId)
      .where("module", "=", "pricing")
      .executeTakeFirst();
    const pricingCfg = effectiveModuleConfig(
      "pricing",
      (pricingRow?.config ?? null) as Record<string, unknown> | null,
      null,
    );
    return sendJson(res, 200, {
      blocked: await getBlockedDaysFrom(unitId, today),
      pricing: priceRows.length
        ? {
            currency: String(pricingCfg.currency ?? "HUF"),
            unit: String(pricingCfg.unit ?? "per_night"),
            rows: priceRows.map((p) => ({
              label: p.label,
              from: p.from,
              to: p.to,
              amount: p.amount,
              base: p.isBase,
              // 0072: the browser runs the same rule, so it needs the same window.
              validFrom: p.validFrom,
              validTo: p.validTo,
            })),
          }
        : null,
    });
  }

  // ── Enquiry card (the spine's "Foglalási igény") — approved contract:
  // assets/design-refs/tenant-site/enquiry-card/README.md. NOT a booking: no
  // unit, no hold — record + notify, the owner simply replies to the guest.
  if (req.method === "POST" && pathname === "/api/erdeklodes") {
    const lang = await tenantLang();
    if (throttled(req, 5, 10 * 60_000)) {
      return sendJson(res, 429, {
        errors: [T(lang, "Túl sok próbálkozás. Kérjük, várjon pár percet.")],
      });
    }
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId) return sendJson(res, 404, { errors: [T(lang, "Ismeretlen szállás.")] });
    const form = await readFormBody(req);
    const result = await createEnquiry({
      siteId,
      dateFrom: form.get("from") ?? "",
      dateTo: form.get("to") ?? "",
      guests: Number(form.get("guests") ?? "1"),
      guestName: form.get("name") ?? "",
      guestEmail: form.get("email"),
      guestPhone: form.get("phone"),
    });
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  if (req.method === "POST" && pathname === "/api/foglalas") {
    const lang = await tenantLang();
    if (throttled(req, 5, 10 * 60_000)) {
      return sendJson(res, 429, {
        errors: [T(lang, "Túl sok próbálkozás. Kérjük, várjon pár percet.")],
      });
    }
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId) return sendJson(res, 404, { errors: [T(lang, "Ismeretlen szállás.")] });
    const form = await readFormBody(req);
    const unitId = form.get("unit") ?? "";
    if (!(await unitBelongsToSite(siteId, unitId))) {
      return sendJson(res, 400, { errors: [T(lang, "Ismeretlen egység.")] });
    }
    // ADR-0256: a hidden unit (the whole place, not let as one) takes no NEW request — the
    // page does not offer it, and a hand-made POST must not either. Running bookings on it
    // are untouched (owner, 2026-09-28: „ok B").
    // ADR-0257: likewise a presentation room when the place is let ONLY as one — the page
    // offers the whole house alone, and a hand-made POST must not book a room of it.
    if (!bookableUnits(await getUnits(siteId)).some((u) => u.id === unitId)) {
      return sendJson(res, 400, { errors: [T(lang, "Ismeretlen egység.")] });
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
    // ADR-0067: this page answers the GUEST, on the tenant's own site — so it
    // speaks the SITE's language. Resolved before the throttle branch, so even the
    // refusal is in the right language. (A `tenantLang()` memón át: ez volt az
    // EGYETLEN ág, ami már helyesen csinálta — most a többi is ugyanazt hívja,
    // hogy ne legyen két mechanizmus, ami elcsúszhat.)
    const guestLang = await tenantLang();
    if (throttled(req, 3, 10 * 60_000)) {
      return send(
        res,
        429,
        reviewThanksPage({
          errors: [T(guestLang, "Túl sok próbálkozás. Kérjük, várjon pár percet.")],
          backUrl: back,
          lang: guestLang,
        }),
      );
    }
    const siteId = await tenantSiteId(site.tenantId);
    if (!siteId) {
      return send(
        res,
        404,
        reviewThanksPage({
          errors: [T(guestLang, "Ismeretlen szállás.")],
          backUrl: back,
          lang: guestLang,
        }),
      );
    }
    const form = await readFormBody(req);
    // ADR-0110 ⑤ — the consent GATE, not just a checkbox in the markup. Publishing a
    // visitor's name runs on consent (GDPR 6(1)(a)), and a `required` attribute is a
    // browser hint: a hand-rolled POST bypasses it. Without the tick nothing is
    // stored — we refuse rather than keep the review "just in case".
    if (form.get("consent") !== "1") {
      return send(
        res,
        400,
        reviewThanksPage({
          errors: [
            T(guestLang, "A közzétételhez az Ön hozzájárulása szükséges — jelölje be a négyzetet."),
          ],
          backUrl: back,
          lang: guestLang,
        }),
      );
    }
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
      reviewThanksPage({
        ...(result.ok ? {} : { errors: result.errors }),
        backUrl: back,
        lang: guestLang,
      }),
    );
  }

  // ADR-0041 permanent redirect: the slug host stops serving content once the tenant has a
  // custom domain — same path, 301, so search engines transfer the accumulated signals.
  // ⛔ KIVÉTEL mock-beszerzésnél (ADR-0071, lokál teszt): a mock-registrar által „megvett”
  // domain nem létezik a DNS-ben, így a 301 egy HALOTT címre vinné a lokál teszt-honlapot,
  // és a tesztfolyamat közepén elveszne az oldal. Ilyenkor a slug-hoszt szolgál ki tovább —
  // a folyamat így végig tesztelhető valódi domain vásárlása nélkül (tulaj kérése,
  // 2026-08-27). Élesben (REGISTRAR_PROVIDER=inwx) a 301 normálisan fut.
  if (site.viaSlug && site.customDomain && !isMockDomainProvisioning()) {
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
  // The automatic /favicon.ico probe 404-ed on every tenant page load — a standing
  // console error under every green step (Elek FK-007, same lelet as the console's).
  if (pathname === "/favicon.ico") {
    try {
      // The one brand source (ADR-0236): the LIGHT E4 — the browser tab is light.
      const svg = faviconSvg();
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "max-age=86400" });
      res.end(svg);
      return;
    } catch {
      return send(res, 404, "not found");
    }
  }
  if (pathname === "/sitemap.xml" && canonicalHost) {
    // ADR-0044/d: the unit subpages are the URL production the visibility engine is
    // about. Listed from what was ACTUALLY written (site.edited_site_data.__unitPages),
    // never from the unit list — a sitemap must not advertise a URL that 404s.
    const pages = await unitPageSlugs(site.tenantId);
    // ADR-0063: paid language versions are URL production too (ADR-0041). Listed
    // from the PAID state (site_multilang) — the snapshots exist exactly for those.
    const mlLangs = site.path ? await multilangLangsFor(site.path) : [];
    const urls = [
      `  <url><loc>https://${canonicalHost}/</loc></url>`,
      ...pages.map((s) => `  <url><loc>https://${canonicalHost}/apartman/${s}</loc></url>`),
      ...mlLangs.map((l) => `  <url><loc>https://${canonicalHost}/${l}/</loc></url>`),
    ].join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
    return send(res, 200, xml, "application/xml; charset=utf-8");
  }
  // ADR-0110 — the tenant's own legal pages. Static snapshots like every other page,
  // rewritten on every content save, so a changed contact address cannot leave a stale
  // notice behind. Same file-existence truth as the unit subpages: no snapshot, no page.
  const legalFile = LEGAL_SNAPSHOT_FILES[pathname];
  if (legalFile && site.path) {
    const file = path.join(path.dirname(path.resolve(process.cwd(), site.path)), legalFile);
    try {
      return send(res, 200, await readFile(file, "utf8"));
    } catch {
      // A site provisioned before ADR-0110 has no legal snapshot yet. Saying so is
      // better than a bare 404 on a page the footer links to.
      const lang = await tenantLang();
      return send(res, 404, `<h1>${T(lang, "Ez az oldal még nem érhető el.")}</h1>`);
    }
  }

  // ADR-0044/d unit subpage — the same static-snapshot serving as the homepage.
  const unitPage = /^\/apartman\/([a-z0-9-]{1,80})$/.exec(pathname);
  if (unitPage && site.path) {
    const file = path.join(path.dirname(path.resolve(process.cwd(), site.path)), "apartman", `${unitPage[1]}.html`);
    try {
      const raw = await readFile(file, "utf8");
      return send(res, 200, await injectOwnerLogin(raw));
    } catch {
      const lang = await tenantLang();
      return send(res, 404, `<h1>${T(lang, "Nincs ilyen oldal.")}</h1>`);
    }
  }
  // ADR-0063 paid language versions: /<lang>/ and /<lang>/apartman/<slug> serve the
  // per-language static snapshots the paid generation wrote. Same file-existence
  // truth as the unit pages — no snapshot on disk, no page (never a stray 200).
  const langPage = /^\/([a-z]{2})(\/(?:index\.html)?|\/apartman\/([a-z0-9-]{1,80}))?$/.exec(pathname);
  if (langPage && site.path) {
    const [, lang, , unitSlug] = langPage;
    const dir = path.join(path.dirname(path.resolve(process.cwd(), site.path)), lang!);
    const file = unitSlug ? path.join(dir, "apartman", `${unitSlug}.html`) : path.join(dir, "index.html");
    try {
      const raw = await readFile(file, "utf8");
      return send(res, 200, await injectOwnerLogin(raw));
    } catch {
      // ⚠️ NOT the requested `lang` prefix — we are here precisely because that
      //    language version does not exist. The site's OWN language is the only
      //    thing we can honestly answer in (same reasoning as ADR-0157 ③).
      //    Külön néven, hogy ne árnyékolja a fenti URL-előtagot.
      const siteLang = await tenantLang();
      return send(res, 404, `<h1>${T(siteLang, "Nincs ilyen oldal.")}</h1>`);
    }
  }
  // Owner re-entry: the owner's instinct on their own site is <domain>/admin, which used to
  // 404. Send those guesses to the tenant login instead (302 — the admin does not live here).
  if (pathname === "/admin" || pathname === "/login") {
    res.writeHead(302, { Location: TENANT_LOGIN_URL });
    return void res.end();
  }
  if (pathname !== "/" && pathname !== "/index.html") {
    const lang = await tenantLang();
    return send(res, 404, `<h1>${T(lang, "Nincs ilyen oldal.")}</h1>`);
  }
  if (!site.path) {
    const lang = await tenantLang();
    return send(res, 404, `<h1>${T(lang, "Az oldal még nem érhető el.")}</h1>`);
  }
  try {
    const raw = await readFile(path.resolve(process.cwd(), site.path), "utf8");
    // LIVE host only — the preview/mock paths never get the login line (no account yet).
    send(res, 200, await injectOwnerLogin(raw));
    // ADR-0108: count the view AFTER the page went out, and never await it — the
    // guest's page load must not wait for (or fail with) the measurement. Only a
    // real, successfully served page counts: 404s, assets and the API routes above
    // have all returned before this point.
    recordSiteVisit(req, {
      tenantId: site.tenantId,
      siteId: site.siteId,
      host: String(req.headers.host ?? "").split(":")[0]!.toLowerCase(),
      isCustomDomain: !site.viaSlug,
    });
  } catch {
    const lang = await tenantLang();
    send(res, 404, `<h1>${T(lang, "Az oldal pillanatkép nem található.")}</h1>`);
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
  /** ADR-0198 — a szoba-szerkesztő felugrójának füle (`fl`) és nyugtázó kódja (`uz`). */
  roomTab?: string | null,
  roomNotice?: string | null,
): Promise<void> {
  const session = await currentTenant(req);
  // A mail link to one card of the admin must survive the login (owner, 2026-09-24):
  // the path + query ride along as `next`; the #card part is added by the login page.
  if (!session) {
    const next = safeAdminNext(req.url ?? "");
    return redirect(res, next && next !== "/admin" ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
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
  // ── freeze-state-v2 ⑨ (tulajdonosi döntés, 2026-09-15) ───────────────────────
  // A felfüggesztett hoszt címe. ⛔ NEM a `siteUrl`: az kimondottan azt jelenti,
  // hogy a lap ÉLŐ (a fejléc-gomb és a lábazat-linkek arra épülnek), és ha itt
  // feloldanám, a fagyasztott fiók úgy viselkedne, mintha publikus volna.
  //   Külön mező, mert külön kérdés: a tulaj azt is látni akarja, ami az ÖVÉ
  // (belső előnézet), és azt is, amit a VILÁG lát (az 503-as udvarias lap).
  const guestViewUrl =
    site && site.status === "suspended"
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
  // ADR-0080: the subscription drives the Modulok tab (card, plan bar) AND the
  // per-module price form — an annual account must read its fee in annual terms
  // (approved contract: design-refs/console/modules-annual-pricing/). Loaded once,
  // ABOVE the settings block, so both read the same billing period.
  let subscription: AdminOpts["subscription"] = null;
  if (tab === "modulok") subscription = await getSubscriptionAdmin(session.tenantId, modules);

  // ── „kifizette, de üres" (jóváhagyott terv: paid-empty-a, 2026-09-21) ────────
  // A modul, amiért FIZET, de a vendégnek semmit nem mutat, saját teendő-sort kap
  // az Áttekintésen. Mérve ugyanaznap a tulaj saját tenantján: 14 775 Ft-ért vett
  // három modult, ebből kettő (pricing, poi) üresen maradt, ezért az élő lapról
  // teljesen hiányzott — és egyetlen képernyő sem szólt róla.
  //
  // ⛔ Az ürességet a RENDERELŐ SAJÁT kimenetéből olvassuk (moduleContentFor), nem
  // egy második heurisztikával: egy `site_module_config` sor létezhet üres tömbbel
  // is, és akkor a lapon továbbra sincs semmi — a másik kérdést feltevő őr zölden
  // engedte volna át, miközben a vevő üres szakaszt lát.
  let paidEmpty: AdminOpts["paidEmpty"] = [];
  let priceGaps: AdminOpts["priceGaps"] = [];
  const overviewTab = !tab || tab === "attekintes";
  if (overviewTab && site?.id) {
    const moduleContent = await moduleContentFor(session.tenantId, site.id);
    // ⛔ `.data` — a modul-mezők ott ülnek, a ModuleContent felső szintje csak burkoló
    // (`{ data, photoCap, units }`). A burkolót átadva a halmaz `data/photoCap/units`
    // lett volna, vagyis EGYETLEN modul-mező sem szerepelt benne: a predikátum minden
    // modult üresnek mond — véletlenül helyes eredménnyel az üres tenanton, és HAMIS
    // riasztással minden kitöltöttön. (Mérve 2026-09-21, a saját első változatomon.)
    paidEmpty = paidButEmptyModules(modules, filledContentFields(moduleContent.data));
    // Csak akkor kérdezzük le az előfizetést, ha van mit árazni vele: az ár ugyanazzal
    // a szabállyal képződik, mint a Modulok fülön (éves fióknál az éves összeg vezet),
    // hogy ne kerüljön két különböző osztó a tulaj két képernyőjére.
    if (paidEmpty.length) subscription ??= await getSubscriptionAdmin(session.tenantId, modules);
    // ADR-0208 ⑥.4 — the incomplete-price row. ⛔ Not beside a paid-empty "Árak" row:
    // that one already says the whole section is empty; two rows about the same gap
    // would read as two problems.
    if (!paidEmpty.some((m) => m.id === "pricing")) priceGaps = await sitePriceGaps(site.id);
  }

  // ── ADR-0224: the frame's subscription card (every tab) + the Áttekintés widgets ──
  const subSummary = await getSubscriptionSummary(session.tenantId);
  let overview: AdminOpts["overview"] = null;
  if (overviewTab) {
    const series = await getVisitorSeries(session.tenantId, 7);
    const inbox = await listTenantMessages(session.tenantId);
    // ADR-0274 ①: the requests waiting for a decision reach the Áttekintés — a strip
    // at the top and one Teendők row each. FK-015 measured the opposite: the new
    // request stood only as a cut-off line in the Üzenetek widget.
    const bookingOn = site?.id ? await tenantHasModule(session.tenantId, "booking") : false;
    const expire = bookingOn && site?.id ? await bookingExpireHours(site.id) : 0;
    const pendingNow = bookingOn && site?.id ? pendingInOrder(await getRequests(site.id, 100), expire) : [];
    overview = {
      pendingBookings: { items: pendingNow, expireHours: expire },
      visitors7: series.visitors,
      visitsByDay: series.byDay,
      messages: inbox.rows.slice(0, 3).map((m) => ({
        id: m.id,
        subject: m.subject ?? messagePreview(m, "", content?.lang ?? "hu"),
        sentAt: m.sentAt,
        unread: isUnread(m, m.thread),
      })),
    };
  }

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
        const units = adminUnitOrder(await ensureUnits(site.id));
        // A calendar only for a unit a guest can BOOK (ADR-0257 open point): a presentation
        // room or the hidden whole place gets no booking can land on it — its calendar would
        // ask the owner to mark nights nobody can take. An old link to one opens the first
        // bookable unit instead.
        const bookable = new Set(bookableUnits(units).map((u) => u.id));
        const unit =
          (unitId && units.find((u) => u.id === unitId && bookable.has(u.id))) ||
          units.find((u) => bookable.has(u.id)) ||
          units[0]!;
        const deletion = await unitDeletionImpacts(site.id);
        booking = {
          month: await getMonthAvailability(unit.id, normaliseMonth(month, viewZone())),
          units: units.map((u) => ({
            // Elek A-1: the delete confirmation says what goes with the unit; A-2: only a
            // unit that stands for the whole place is asked about it when a second is added.
            deletion: deletion.get(u.id),
            representsWhole: u.representsWhole,
            id: u.id,
            name: u.name,
            capacity: u.capacity,
            description: u.description,
            // ADR-0114: the calendar has to SAY why a night it cannot release is taken,
            // and the wording differs for the whole place ("egy másik egység") and a
            // room ("az egész szállás").
            isWholeProperty: u.isWholeProperty,
            // ADR-0257: the add-room form asks no price when the place is let only as one.
            wholeOnly: u.wholeOnly,
            // The calendar tabs list only these (see `bookable` above).
            bookable: bookable.has(u.id),
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
      let photoLibrary;
      let unitAmenities;
      if (moduleId === "rooms" || moduleId === "pricing") {
        const list = adminUnitOrder(await ensureUnits(site.id));
        const libraryPhotos = ((await getTenantContent(session.tenantId))?.photos ?? []) as never;
        const assigned = photosByUnit(libraryPhotos);
        const deletion = await unitDeletionImpacts(site.id);
        units = list.map((u) => ({
          id: u.id,
          // Elek A-1: the delete confirmation says what goes with the unit; A-2: only a
          // unit that stands for the whole place is asked about it when a second is added.
          deletion: deletion.get(u.id),
          representsWhole: u.representsWhole,
          name: u.name,
          capacity: u.capacity,
          description: u.description,
          slug: u.slug,
          amenities: u.amenities,
          photoCount: assigned.get(u.id)?.length ?? 0,
          // The picker's checked state (approved plan B): which library photos
          // this unit already owns.
          photoUrls: (assigned.get(u.id) ?? []).map((p) => p.url),
          // ADR-0198: resolved by the SAME function the public render uses, so the
          // admin cannot show one picture while the page serves another.
          coverUrl: unitCoverPhoto(u.id, libraryPhotos)?.url ?? null,
          seasonalOnly: u.seasonalOnly,
          // ADR-0114: the card says "az egész ház" — it changes what the unit MEANS.
          isWholeProperty: u.isWholeProperty,
          priceOnRequest: u.priceOnRequest,
          // ADR-0257: let only as one — the card's three states and the "csak bemutatásra" tag.
          wholeOnly: u.wholeOnly,
        }));
        // The shared library the room card offers to pick from.
        photoLibrary = ((await getTenantContent(session.tenantId))?.photos ?? []) as never;
        // The per-unit amenity picker (plan F) needs the amenities module state
        // and the site-wide picks — the latter render greyed on the room card.
        if (moduleId === "rooms") {
          const amenitiesActive = await tenantHasModule(session.tenantId, "amenities");
          const siteCfg = await getSiteModuleConfig(site.id, "amenities");
          const siteItems = Array.isArray(siteCfg.config.items)
            ? (siteCfg.config.items as unknown[]).map(String)
            : [];
          unitAmenities = {
            active: amenitiesActive,
            siteSelected: splitAmenities(siteItems).selected,
          };
        }
        if (moduleId === "pricing") {
          const prices: Record<string, Awaited<ReturnType<typeof getUnitPrices>>> = {};
          for (const u of list) prices[u.id] = await getUnitPrices(u.id);
          // ADR-0208 ⑥.2–⑥.4: the card's state line comes from the ONE predicate the
          // overview to-do and the weekly reminder read.
          const status: Record<string, UnitPriceStatus> = {};
          const priceToday = viewToday(); // the accommodation's today (ADR-0290)
          for (const u of list) status[u.id] = unitPriceStatus(prices[u.id] ?? [], u, priceToday);
          // ADR-0256 ③: the rooms a guest never sees get no "nincs ára" line — the same
          // rule (guestUnits) the guest page, the to-do row and the reminder read.
          const shownToGuest = new Set(guestUnits(list).map((u) => u.id));
          // 0074: which season is open for editing, which year card was just saved or
          // refused, and where the refusal text belongs (next to it, not at the top).
          const qp = new URL(req.url ?? "/", "http://x").searchParams;
          pricing = {
            units,
            prices,
            status,
            editSeason: qp.get("edit"),
            savedSeason: qp.get("sv"),
            yearFocus: qp.get("ev"),
            ...(cfgErrors?.length && (qp.get("edit") || qp.get("ev")) ? { inlineErrors: cfgErrors } : {}),
            currency: String(cfg.config.currency ?? "HUF"),
            // The SAME predicate the page and the season rule use (isRenderedModule):
            // active AND not superseded — "is the calendar actually on the page?"
            bookingActive: await tenantRendersModule(session.tenantId, "booking"),
            // The rooms button's target: the SAME predicate the screen gate above
            // uses (`active` = m.active in the tenant's module list), so the button
            // never points at a screen that would not open.
            roomsActive: modules.modules.some((m) => m.id === "rooms" && m.active),
            siteView: await priceSiteView(session.tenantId),
            guestHidden: list.filter((u) => !shownToGuest.has(u.id)).map((u) => u.id),
            // ADR-0257: let only as one → the rooms are presentation, no price asked.
            presentationRooms: isWholeOnlySite(list)
              ? list.filter((u) => !isBookableUnit(u, list)).map((u) => u.id)
              : [],
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
          // The decide route's PRG round trip reuses the `e` (row id) + `uz` (what
          // happened) query slots the room editor already carries.
          done:
            unitId && (roomNotice === "published" || roomNotice === "rejected" || roomNotice === "withdrawn")
              ? { id: unitId, verdict: roomNotice as "published" | "rejected" | "withdrawn" }
              : null,
        };
      }

      // The weekly program recommender's picker (approved contract B): the live pool
      // of the tenant's circle + the stored choice, resolved by the same function the
      // render and the weekly mail use (src/events/picks.ts).
      let programs;
      if (moduleId === "poi") {
        const programPool = await siteProgramPool(site.id);
        const { state, events } = programPool;
        const storedPicks = readPicks(cfg.config);
        const ownById = new Map(storedPicks.flatMap((x) => ("own" in x ? [[x.id, x.own] as const] : [])));
        // Before the first gathering the circle may not be cached yet — the own-program
        // card still says "Helyben (<settlement>)" (approved plan programajanlo-gyujtes A).
        const ownName = programPool.own?.name ?? (await siteOwnSettlement(site.id)) ?? "";
        programs = {
          state,
          pool: events.map((e) => ({
            id: e.id,
            start: e.start,
            end: e.end,
            name: e.name,
            settlement: e.settlement,
            distanceKm: e.distanceKm,
            sourceUrl: e.sourceUrl,
            sourceHost: e.sourceHost,
          })),
          // Own programs travel as their stored fields (the card edits THEM), with the
          // resolved place label beside them (ADR-0238).
          picks: resolvePicks(storedPicks, programPool).map((p) =>
            p.own
              ? {
                  id: p.id,
                  own: ownById.get(p.id)!,
                  settlement: p.settlement || ownName,
                  distanceKm: p.distanceKm,
                  away: p.away === true,
                }
              : p.title !== p.name
                ? { id: p.id, title: p.title }
                : { id: p.id },
          ),
          order: readOrder(cfg.config),
          ownSettlement: ownName,
          // The circle's settlements: the "Máshol" field suggests them and shows the
          // distance at once (the server computes the same on save).
          places: programPool.own
            ? programPool.around.map((x) => ({ name: x.name, km: distanceKm(programPool.own!, x) }))
            : [],
          today: programPool.today,
          saved,
        };
      }

      // ADR-0208 ⑥.3 — the new-unit row (rooms / booking) asks for a price when pricing
      // is on; `uj`+`ue` carry the outcome of the save back to the same screen.
      let newUnit: NewUnitView | null = null;
      if (moduleId === "rooms" || moduleId === "booking") {
        const q = new URL(req.url ?? "/", "http://x").searchParams;
        const state = q.get("uj");
        const ue = q.get("ue") ?? "";
        const flashUnit =
          state && ["ar", "ajanlat", "kimondva", "nincs", "rossz"].includes(state)
            ? (await getUnits(site.id)).find((u) => u.id === ue)
            : undefined;
        const priceCfg = await getSiteModuleConfig(site.id, "pricing");
        newUnit = {
          pricingActive: await tenantHasModule(session.tenantId, "pricing"),
          currency: String(priceCfg.config.currency ?? "HUF"),
          back: moduleId,
          flash: flashUnit
            ? { state: state as NonNullable<NewUnitView["flash"]>["state"], unitId: flashUnit.id, unitName: flashUnit.name }
            : null,
          // ADR-0256: the second question names the running bookings of the only unit so far.
          formerWholeBookings: await (async () => {
            const only = await getUnits(site.id);
            return only.length === 1 ? futureAcceptedBookings(only[0]!.id) : 0;
          })(),
        };
      }

      // ADR-0241: the Térkép screen carries the shared address + pin card.
      const placeFacts = moduleId === "location" ? await getTenantContact(session.tenantId) : null;
      moduleSettingsHtml = moduleSettingsSection(moduleId, {
        ...(placeFacts
          ? {
              place: {
                facts: placeFacts,
                mapsKey: config.googleMapsBrowserKey,
                errors: contactErrorsFrom(new URL(req.url ?? "/", "http://x").searchParams),
                failed: new URL(req.url ?? "/", "http://x").searchParams.getAll("pe").includes("save"),
                lang: content?.lang ?? "hu",
              },
            }
          : {}),
        // ADR-0067: the settings screens speak the tenant's own site language.
        lang: content?.lang ?? "hu",
        values: cfg.config,
        canRestore,
        priceMonthly: active.priceMonthly,
        // Same rule as the module chips: if a price is shown, it is shown in the
        // period the account is billed in (0 = monthly account, no conversion).
        annualMult:
          subscription?.billingPeriod === "annual" ? 12 - subscription.annualFreeMonths : 0,
        // 0074: a season-edit / year-card refusal is shown next to that control.
        ...(cfgErrors?.length && !pricing?.inlineErrors ? { errors: cfgErrors } : {}),
        ...(booking ? { booking } : {}),
        ...(units ? { units } : {}),
        ...(pricing ? { pricing } : {}),
        ...(reviews ? { reviews } : {}),
        ...(programs ? { programs } : {}),
        ...(photoLibrary ? { photoLibrary } : {}),
        ...(unitAmenities ? { unitAmenities } : {}),
        // ADR-0198 — a felugró állapota a körút után: melyik szoba, melyik fül, és
        // mi történt. A `#szoba-<id>` horgony nyitja a felugrót (`:target`), ez
        // pedig a fület és a nyugtázó üzenetet adja hozzá.
        ...(newUnit ? { newUnit } : {}),
        ...(moduleId === "rooms"
          ? { roomsView: { openUnitId: unitId ?? null, tab: roomTab ?? null, notice: roomNotice ?? null } }
          : {}),
      });
    }
  }

  // ADR-0063: the multilang card's data (Modulok tab, no settings screen open).
  // The assembly lives in multilangCard.ts so the guard measures the SAME code
  // the page renders (Elek FK-005b, 2026-09-11 — the card was blind to payment).
  let multilang: AdminOpts["multilang"] = null;
  if (tab === "modulok" && !moduleSettingsHtml && site?.id) {
    multilang = await multilangCardData({
      siteId: site.id,
      tenantId: session.tenantId,
      primaryLang: content?.lang ?? DEFAULT_LANG,
      siteUrl,
      // A failed pay redirect must not eat the buyer's picked languages (H4) — nor,
      // since ADR-0128, the tier they had chosen.
      preselect: (new URL(req.url ?? "/", "http://x").searchParams.get("langs") ?? "")
        .split(",")
        .filter(Boolean),
      tier: new URL(req.url ?? "/", "http://x").searchParams.get("tier"),
    });
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
        category: e.category,
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

  // ADR-0078: a „Webcím" fül adata. CSAK ezen a fülön töltjük be, mert a javaslatok
  // elérhetőség-mérése hálózati munka (DNS+RDAP) — más fülön fölösleges késleltetés.
  let domain: AdminOpts["domain"] = null;
  let domainView: AdminOpts["domainView"] = {};
  if (tab === "webcim" && site?.id) {
    await loadPricing();
    const q = new URL(req.url ?? "/", "http://x").searchParams;
    domain = await loadDomainAdmin(session.tenantId, session.displayName);
    const typed = q.get("check");
    const picked = q.get("d");
    // ADR-0251: the review step shows a FRESH registrar verdict ("Szabad — most
    // ellenőrizve") — a name picked minutes ago may be gone, and a stale "free"
    // would be the one promise the pay button rests on.
    const pickedNorm = picked ? normalizeCustomDomain(picked) : null;
    const pickedDomain = pickedNorm?.ok && pickedNorm.domain ? pickedNorm.domain : null;
    domainView = {
      ...(pickedDomain ? { picked: pickedDomain, pickedAvailability: await checkWebcimAvailability(pickedDomain) } : {}),
      ...(typed ? { check: await checkTypedDomain(typed) } : {}),
      ...(q.get("payerror") === "1" ? { payError: true } : {}),
      ...(q.get("uj") === "1" ? { restart: true } : {}),
    };
  }

  // ADR-0108: a „Forgalom" fül adata. Csak ezen a fülön kérdezzük le — több aggregáló
  // lekérdezés, más fülön fölösleges terhelés. A `nap` a jóváhagyott terv két
  // időszak-gombja; bármi más 30-ra esik vissza (a query-nek nem hiszünk).
  let traffic: AdminOpts["traffic"] = null;
  if (tab === "forgalom") {
    const q = new URL(req.url ?? "/", "http://x").searchParams;
    traffic = await getTrafficReport(session.tenantId, q.get("nap") === "7" ? 7 : 30);
  }

  // ADR-0080 (approved B plan): the Modulok tab carries the subscription card +
  // the applied-changes confirmation. Loaded only on that tab.
  let moduleApplied: AdminOpts["moduleApplied"] = null;
  let domainSettle: AdminOpts["domainSettle"] = null;
  if (tab === "modulok") {
    // ADR-0094 ②: the danger zone branches on the RUNNING domain commitment —
    // with one, "Előfizetés lemondása" links to the interposed settlement page.
    const [commitment, settle] = await Promise.all([
      activeDomainCommitment(session.tenantId),
      openSettlement(session.tenantId),
    ]);
    domainSettle = { commitmentActive: !!commitment, settlementPaid: !!settle?.paid };
    const q = new URL(req.url ?? "/", "http://x").searchParams;
    // Shared by the applied- and the declined-charge branch: both name modules
    // back to the tenant, and both take the ids from a URL anyone can edit.
    const ids = (key: string) =>
      (q.get(key) ?? "")
        .split(",")
        .filter((id) => modules.modules.some((m) => m.id === id));
    if (q.get("applied") === "1") {
      moduleApplied = {
        added: ids("madd"),
        cancelled: ids("mcancel"),
        other: ids("mother"),
        // ADR-0113: instant-charge outcome riding the redirect.
        charged: ids("mcharged"),
        chargedAmount: Math.max(0, Number(q.get("mamount")) || 0),
        // ADR-0205: a kedvezmény levezetése. ⛔ Csak akkor fogadjuk el, ha a listaár
        // TÉNYLEG nagyobb a fizetettnél és a százalék értelmes — a paraméter a
        // címsorból jön, tehát bárki átírhatja: egy kitalált „mlist" különben hamis
        // kedvezményt íratna ki a saját visszaigazolására.
        chargedListPrice: Math.max(0, Number(q.get("mlist")) || 0),
        chargedOfferPercent: Math.min(100, Math.max(0, Number(q.get("mpct")) || 0)),
        // Elek F-3: the offer's KIND, whitelisted (it rides the address bar) — the
        // receipt names the discount by it instead of always "Üdvözlő kedvezmény".
        chargedOfferKind: (["outreach", "escalation", "coupon", "campaign"] as const).find((k) => k === q.get("mkind")) ?? null,
        chargePending: q.get("mpending") === "1",
      };
    }
    // ADR-0094 ④: the module change was refused by the domain-commitment floor.
    const floorBlock = Number(q.get("floorblock"));
    if (Number.isFinite(floorBlock) && floorBlock > 0) {
      moduleApplied = { added: [], cancelled: [], other: [], floorBlockedAt: floorBlock };
    }
    // ADR-0119 ⑥: the add was refused because the site is suspended.
    if (q.get("frozenblock") === "1") {
      moduleApplied = { added: [], cancelled: [], other: [], frozenBlocked: true };
    }
    // The stored card was DECLINED (owner ruling 2026-09-22): nothing was charged
    // and the paid module did NOT switch on — but anything else in the same submit
    // DID land, so the banner carries those ids too and says so.
    if (q.get("payfail") === "1") {
      moduleApplied = {
        added: ids("madd"),
        cancelled: ids("mcancel"),
        other: ids("mother"),
        payFailedModules: ids("mfail"),
        payFailedUrl: await openUpsellPayUrl(session.tenantId),
      };
    }
  }

  // ADR-0084: a „Dokumentumok" és „Üzenetek" fül adata. A számla-lekérdezés a
  // 4 lépéses invoice→payment→order→prospect→tenant láncon megy, ezért csak azon
  // a fülön futtatjuk. Az olvasatlan-számláló viszont MINDEN fülön kell — a
  // jelvény a navban ül, nem az Üzenetek lapon.
  const unreadMessages = await countUnreadMessages(session.tenantId);
  const params = new URL(req.url ?? "/", "http://x").searchParams;
  let documents: AdminOpts["documents"] = null;
  let legal: AdminOpts["legal"] = null;
  let zone: ZonePickerData | null = null;
  let wallet: AdminOpts["wallet"] = null;
  let contact: AdminOpts["contact"] = null;
  let walletFlash: AdminOpts["walletFlash"] = null;
  let messages: AdminOpts["messages"] = null;

  // Jóváhagyott terv 2026-09-06: a Foglalások fül adata + a jelvény MINDEN fülön.
  // ADR-0274 ①: a jelvény a DÖNTÉSRE VÁRÓ kérések száma — a fül megnyitásától nem tűnik el.
  let bookings: AdminOpts["bookings"] = null;
  let pendingBookings = 0;
  const hasBooking = site?.id ? await tenantHasModule(session.tenantId, "booking") : false;
  if (site?.id && hasBooking) {
    if (tab === "foglalasok") {
      // The tab render marks the requests SEEN (the card's „new" frame). ⛔ It no
      // longer empties the badge: that counts what still WAITS for a decision
      // (ADR-0274 ①) — opening the tab is not deciding.
      await markRequestsSeen(site.id);
      const requests = await getRequests(site.id, 100);
      const expireHours = await bookingExpireHours(site.id);
      // ADR-0274 ④ (FK-015): with no unit/month in the URL the calendar opens where
      // the owner's NEXT DECISION is — the linked request (?k=), else the most urgent
      // pending one, else the next arrival. It used to open on the first unit and the
      // current month: „nincs foglalt nap", next to „Következő érkezés 2026. 10. 24.".
      const targetRow = params.get("k") ? requests.find((r) => r.token === params.get("k")) : undefined;
      // Right after a confirmation the calendar shows WHAT became booked: the decided
      // request's unit and month, opened (ADR-0274 ④, the approved mock's end state).
      const justAccepted =
        params.get("mit") === "visszaigazolva" ? requests.find((r) => r.id === params.get("d")) : undefined;
      const focusRow = calendarFocus(requests, expireHours, params.get("k") ?? justAccepted?.token ?? null);
      const bkUnit =
        adminUnits.find((u) => u.id === params.get("u")) ??
        (!params.get("u") && focusRow ? adminUnits.find((u) => u.id === focusRow.unitId) : undefined) ??
        adminUnits[0] ??
        null;
      const bkMonth = await getMonthAvailability(
        bkUnit?.id ?? "",
        normaliseMonth(params.get("ho") ?? (!params.get("u") && focusRow ? focusRow.dateFrom.slice(0, 7) : null), viewZone()),
      );
      const openDay = /^\d{4}-\d{2}-\d{2}$/.test(params.get("nap") ?? "")
        ? params.get("nap")
        : null;
      // The tapped booked day → its booking, via the availability row's source anchor.
      let openDayBooking = null;
      if (openDay && bkUnit) {
        const dayRow = await db
          .selectFrom("availability_day")
          .select("source")
          .where("unit_id", "=", bkUnit.id)
          .where("day", "=", openDay)
          .executeTakeFirst();
        const reqId = dayRow?.source.startsWith("booking:")
          ? dayRow.source.slice("booking:".length)
          : null;
        openDayBooking = reqId ? (requests.find((r) => r.id === reqId) ?? null) : null;
      }
      // "Idén visszaigazolt" — TWO numbers, because there are two facts and the tile
      // used to print the wrong one as if it were the other (Elek FK-007: it read
      // "2 foglalás" with nothing left standing). The headline is what EXISTS now;
      // the cancellations are named next to it, not folded into it or dropped.
      // Midnight of 1 January in the ACCOMMODATION's zone (ADR-0290) — the same year
      // bookingViews counts in (both read the request's view zone).
      const yearStart = midnightIn(`${yearIn(new Date(), viewZone())}-01-01`, viewZone());
      const countYear = async (status: "accepted" | "cancelled"): Promise<number> => {
        const row = await db
          .selectFrom("booking_request")
          .select(db.fn.countAll().as("n"))
          .where("site_id", "=", site.id)
          .where("status", "=", status)
          .where("decided_at", ">=", yearStart)
          .executeTakeFirst();
        return Number(row?.n ?? 0);
      };
      const [yearLive, yearGone] = await Promise.all([
        countYear("accepted"),
        countYear("cancelled"),
      ]);
      // What the verdict that led HERE actually did, resolved to names from the rows
      // already loaded — the ids travel in the URL, the names never do.
      const decidedId = params.get("d");
      const mit = params.get("mit");
      const decidedRow = decidedId ? requests.find((r) => r.id === decidedId) : undefined;
      const outcome =
        decidedRow && (mit === "visszaigazolva" || mit === "elutasitva" || mit === "lemondva")
          ? {
              kind: mit as "visszaigazolva" | "elutasitva" | "lemondva",
              name: decidedRow.guestName,
              dateFrom: decidedRow.dateFrom,
              dateTo: decidedRow.dateTo,
              autoDeclined: (params.get("auto") ?? "")
                .split(",")
                .filter(Boolean)
                .map((id) => requests.find((r) => r.id === id)?.guestName)
                .filter((x): x is string => Boolean(x)),
            }
          : null;
      const panelParam = params.get("panel");
      bookings = {
        units: adminUnits,
        unitId: bkUnit?.id ?? "",
        month: bkMonth,
        calendarOpen:
          params.get("naptar") === "1" || openDay != null || (params.get("mit") === "visszaigazolva" && !params.get("u")),
        openDay,
        openDayBooking,
        panel:
          panelParam === "pend" || panelParam === "arr" || panelParam === "year"
            ? panelParam
            : null,
        requests,
        targetId: targetRow?.id ?? null,
        sentOffers: await getSentOffers(site.id),
        yearAccepted: yearLive,
        yearCancelled: yearGone,
        outcome,
        expireHours,
      };
    }
    pendingBookings = await pendingRequestCount(site.id);
  }
  if (tab === "dokumentumok") {
    const [invoices, agreements, sub] = await Promise.all([
      listTenantInvoices(session.tenantId),
      listTenantAgreements(session.tenantId),
      getSubscriptionAdmin(session.tenantId, modules),
    ]);
    documents = {
      invoices,
      agreements,
      sub: params.get("sub") === "szerzodesek" ? "szerzodesek" : "szamlak",
      year: params.get("f") || "mind",
      q: params.get("q") ?? "",
      nextRenewal: sub?.periodEnd ? new Date(sub.periodEnd) : null,
      // Kontraktus ⑦: MÉRT tartozás. Nincs előfizetés → a kérdés fel sem tehető → null.
      owed: sub ? (sub.arrears?.amount ?? 0) : null,
    };
  } else if (tab === "elerhetoseg") {
    // ADR-0241: the public contact facts (owner override > scrape) + the browser map key.
    const facts = await getTenantContact(session.tenantId);
    contact = facts
      ? {
          facts,
          mapsKey: config.googleMapsBrowserKey,
          errors: contactErrorsFrom(params),
          failed: params.getAll("pe").includes("save"),
          lang: content?.lang ?? "hu",
        }
      : null;
  } else if (tab === "penztarca") {
    // ADR-0226: the wallet reads the card from its own loader and the next-charge
    // AMOUNT from the subscription card's rule — one number, one source.
    [wallet, subscription] = await Promise.all([
      getWalletAdmin(session.tenantId),
      getSubscriptionAdmin(session.tenantId, modules),
    ]);
    const c = params.get("card");
    walletFlash = c === "ok" || c === "fail" || c === "err" ? c : null;
  } else if (tab === "fiok") {
    // ADR-0290: the accommodation's time zone picker.
    zone = await zonePickerDataFor(session.tenantId);
    // ADR-0110: the published legal identity, seeded from the buyer record. Loaded
    // only for this tab — every other tab would pay two queries for nothing.
    const st = await loadTenantLegal(session.tenantId);
    legal = {
      who: st.who,
      missing: st.missing,
      // Links only once the site is public: pointing at a page that is not served
      // yet would be exactly the dead link this ADR exists to remove.
      privacyUrl: siteUrl ? `${siteUrl.replace(/\/$/, "")}${TENANT_LEGAL_PATHS.privacy}` : null,
      imprintUrl: siteUrl ? `${siteUrl.replace(/\/$/, "")}${TENANT_LEGAL_PATHS.imprint}` : null,
    };
  } else if (tab === "uzenetek") {
    // Opening a message marks it read — the click IS the acknowledgement, so it
    // happens before the list is read back (otherwise the badge would lag by one).
    const openId = params.get("open");
    if (openId) await markMessageRead(session.tenantId, openId);
    // ── A jóváhagyott „A" terv HÁROM FÜGGETLEN dimenziója ────────────────────
    // Kontraktus: assets/design-refs/tenant-admin/uzenetek-tema-szuro/README.md ②.
    // ⚠️ A RÉGI egyparaméteres `f=` bemenetként tovább él (súgó-képek, könyvjelzők,
    // kimenő linkek), de már csak fordítjuk: a felület a három új paramétert írja.
    const legacy = params.get("f") ?? "";
    const topicParam = params.get("t") ?? "";
    const topic = isMessageTopic(topicParam) ? topicParam : "mind";
    const channelParam = params.get("c") ?? (legacy === "email" || legacy === "sms" ? legacy : "");
    const channel = channelParam === "email" || channelParam === "sms" ? channelParam : "";
    const unreadOnly = params.get("u") === "1" || legacy === "olvasatlan";
    const q = params.get("q") ?? "";
    // Kontraktus ①: melyik ÜGY lépései vannak kinyitva. Több is lehet egyszerre —
    // a szál-kulcs (`kind:dunning`, `booking_request:<uuid>`) nem tartalmaz vesszőt.
    const openThreads = (params.get("sz") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const list = await listTenantMessages(session.tenantId, { topic, channel, unread: unreadOnly, q });
    messages = {
      messages: list.rows,
      unread: openId ? await countUnreadMessages(session.tenantId) : unreadMessages,
      topic,
      channel,
      unreadOnly,
      q,
      total: list.total,
      mindCount: list.mindCount,
      topicCounts: list.topicCounts,
      channelCounts: list.channelCounts,
      unreadCount: list.unreadCount,
      openThreads,
      confirmRead: params.get("olv") === "1",
      openId,
    };
  }

  send(
    res,
    200,
    adminDashboard(session, content, {
      saved,
      // Read straight off the request: serveAdmin already carries nine positional
      // arguments, and a tenth for one banner flag would make every call site worse.
      // The Webcím tab renders its OWN pay-error (domainSection) — the frame banner
      // speaks about "the new module", which on the domain page was simply false.
      payError: tab !== "webcim" && new URL(req.url ?? "/", "http://x").searchParams.get("payerror") === "1",
      previewToken: site?.preview_token,
      modules,
      paidEmpty,
      priceGaps,
      subscription,
      moduleApplied,
      domainSettle,
      supportEmail: config.supportEmail,
      tab,
      siteUrl,
      guestViewUrl,
      chargeRetry: new URL(req.url ?? "/", "http://x").searchParams.get("ujra"),
      moduleSettingsHtml,
      openModule: moduleSettingsHtml ? (moduleId ?? null) : null,
      units: adminUnits,
      help,
      multilang,
      multilangError:
        new URL(req.url ?? "/", "http://x").searchParams.get("mlerror") || null,
      domain,
      domainView,
      traffic,
      documents,
      messages,
      legal,
      zone,
      zoneError: tab === "fiok" && params.get("tzerr") === "1",
      wallet,
      walletFlash,
      contact,
      // A jelvény a navban ül → minden fülön aktuális kell legyen, nem csak az
      // Üzenetek lapon. Megnyitás után a frissen olvasottat már nem számoljuk.
      unreadMessages: messages ? messages.unread : unreadMessages,
      bookings,
      pendingBookings,
      subSummary,
      overview,
      siteSlug: site?.slug ?? null,
      photosView: new URL(req.url ?? "/", "http://x").searchParams.get("v") === "list" ? "list" : "grid",
    }),
  );
}

/**
 * Absolute base URL of the current request — the e-mail links (accept/decline)
 * and the calendar feed must be reachable from outside, so they cannot be relative.
 */
function publicBaseUrl(req: http.IncomingMessage): string {
  // ADR-0278: the host comes from `Host` — the header the site itself is resolved from —
  // never from X-Forwarded-Host. Production nginx does not overwrite that header, so a
  // client-sent value reached Node untouched, and one forged booking request put the
  // owner's accept link (with its action_token) on a foreign domain. No legitimate
  // sender exists: nginx passes the original Host, and dev is reached directly.
  const host = String(req.headers.host ??`localhost:${PORT}`);
  // Without a proxy header the scheme is the socket's own: this server speaks plain
  // HTTP, so guessing "https" for any non-localhost host (e.g. the dev box reached
  // on its Tailscale IP) produced links that die with ERR_SSL_PROTOCOL_ERROR.
  // Production nginx always sets X-Forwarded-Proto, so it is unaffected.
  const encrypted = (req.socket as { encrypted?: boolean }).encrypted === true;
  const proto = String(req.headers["x-forwarded-proto"] ?? (encrypted ? "https" : "http")).split(",")[0]!.trim();
  return `${proto}://${host}`;
}

/** ADR-0063: language snapshots that actually EXIST on disk for a site path —
 *  the sitemap only advertises what serves (file-existence truth, like the unit
 *  pages). A 2-letter dir with an index.html = a written paid language version. */
async function multilangLangsFor(sitePath: string): Promise<string[]> {
  const dir = path.dirname(path.resolve(process.cwd(), sitePath));
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const langs: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || !/^[a-z]{2}$/.test(e.name)) continue;
      try {
        await readFile(path.join(dir, e.name, "index.html"), "utf8");
        langs.push(e.name);
      } catch {
        /* no index → not a served language */
      }
    }
    return langs.sort();
  } catch {
    return [];
  }
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

  // The browser's automatic /favicon.ico probe hits the ORIGIN ROOT on every host
  // (Elek FK-007: standing 404 under a green step, on the /t/ dev path too, where
  // the tenant-host copy of this handler never runs). First, before any dispatch.
  if (req.method === "GET" && pathname === "/favicon.ico") {
    try {
      // The one brand source (ADR-0236): the LIGHT E4 — the browser tab is light.
      const svg = faviconSvg();
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "max-age=86400" });
      res.end(svg);
      return;
    } catch {
      return send(res, 404, "not found");
    }
  }

  // ── Tenant host routing (0017): <slug>.citoviso.com / a custom domain serves
  // THAT tenant's live site. Runs first, so a tenant host never falls through to
  // the marketing homepage. Only 'live' sites resolve — a provisioned (paid-for
  // but private) site stays token-only, keeping the ADR-0014 state machine intact.
  const tenantSite = await resolveTenantSite(req);
  // ⛔ EXCEPT the routes our mails link to (+ the assets their pages load): the mail
  // was built from THIS host (publicBaseUrl), and the tenant handler answered them
  // with "Nincs ilyen oldal." — every owner/guest mail link was dead in production
  // (measured 2026-09-24). They fall through to the platform handlers below, on
  // the host the person is already on. One list: mailLinkRoutes.ts.
  if (tenantSite && !servesOnTenantHostToo(pathname)) return serveTenantHost(req, res, tenantSite, pathname);
  // Dev-only slug path (never on the platform — see DEV_SLUG_PATH).
  //
  // ⛔ EZ AZ ÁG A CÍMZETT-DEKLARÁCIÓ ELŐTT VAN (2026-09-14). Korábban utána állt,
  // ezért a `/t/<slug>` dev-úton kiszolgált VENDÉG-OLDAL megkapta a süti-sávot és
  // a Barion Pixelt — pont amit a befagyasztott terv kizár („a vendég nem nálunk
  // fizet"). A host-úton (`<slug>.citoviso.com`) helyes volt, és a `consent-check`
  // ④ szabálya CSAK azt az utat mérte — a dev-út a vakfoltjában volt, miközben
  // Elek a vendég-oldalt ezen az úton látja (FK-007 H2).
  // ⚠️ A pozíció ma már nem az EGYETLEN védelem: a címzett alapértelmezése „nem a
  // miénk", a vendég-lapoké pedig kimondott (`GUEST_PAGE_ROUTES`).
  if (DEV_SLUG_PATH && pathname.startsWith("/t/")) {
    const rest = pathname.slice(3);
    const slash = rest.indexOf("/");
    const slug = slash === -1 ? rest : rest.slice(0, slash);
    const inner = slash === -1 ? "/" : rest.slice(slash);
    const devSite = slug ? await resolveDevSlugSite(slug) : null;
    if (!devSite) return send(res, 404, "<h1>Nincs ilyen oldal.</h1>");
    return serveTenantHost(req, res, devSite, inner);
  }
  // ── A LAP CÍMZETTJE (ld. PAGE_AUDIENCE) ─────────────────────────────────────
  // Idáig a két tenant-ág (host- és dev-slug-út) már kilépett, ott a címzett soha
  // nem lesz „own" — az alapértelmezés a NEM-követés, tehát egy fentebb kilépő új ág
  // sem tud véletlenül Pixelt kapni. Innen a saját webshopunk lapjai jönnek, KIVÉVE
  // azt a néhány útvonalat, amely ugyaninnen szolgálja ki a tenant VENDÉGÉT.
  markAudience(res, GUEST_PAGE_ROUTES.some((re) => re.test(pathname)) ? "guest" : "own");
  // An unresolved tenant subdomain must NOT fall through to the landing page.
  // A RESOLVED one that got here is a mail-link/asset pass-through (above) — it is
  // claimed, and the platform handler below is exactly what the mail pointed at.
  // ADR-XXXX: a lead's OWN preview subdomain (lead.preview_label) — the outreach link.
  // "/" is the lead's live /p/<token> page, served in place by the console (the address
  // bar keeps the friendly host); every other path behaves as on citoviso.com, exactly
  // as nginx already routes it (/p/… → console, the rest → here), so the page's own
  // calls (/p/<token>/view, /assets, /api …) keep working on this host.
  const previewToken =
    !tenantSite && isUnclaimedTenantHost(req) ? await prospectTokenForLabel(hostLabel(req)) : null;
  if (previewToken && req.method === "GET" && pathname === "/") {
    return proxyPreviewPage(req, res, previewToken, url.search);
  }
  if (!tenantSite && !previewToken && isUnclaimedTenantHost(req)) {
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
    const next = safeAdminNext(form.get("next"));
    // ADR-0277: failed-attempt throttle per IP, checked BEFORE the password.
    if (loginLocked("tenant", req)) {
      const lang = await prepareMailLang(DEFAULT_LANG);
      return send(
        res,
        429,
        loginPage(
          {
            text: T(lang, "Túl sok sikertelen belépési kísérlet. Kérjük, próbálja újra 10 perc múlva."),
            kind: "bad",
          },
          consoleLoginUrl(req),
          lang,
          next,
        ),
      );
    }
    const uid = await authenticate(form.get("username") ?? "", form.get("password") ?? "");
    if (!uid) {
      recordLoginFailure("tenant", req);
      return send(
        res,
        401,
        loginPage(
          { text: "Hibás felhasználónév vagy jelszó.", kind: "bad" },
          consoleLoginUrl(req),
          undefined,
          next,
        ),
      );
    }
    setSession(res, uid);
    // Back to where the link pointed (only ever inside /admin — safeAdminNext).
    return redirect(res, next ?? "/admin");
  }
  // Elek T-3: "Elfelejtett jelszó?" — mail a fresh link. The SAME answer whether or
  // not the account exists; every request counts against the per-IP limit.
  if (req.method === "POST" && pathname === "/login/help") {
    const form = await readFormBody(req);
    const lang = await prepareMailLang(
      uiLangs().includes(form.get("lang") ?? "") ? (form.get("lang") as string) : DEFAULT_LANG,
    );
    const ident = (form.get("identifier") ?? "").trim();
    if (!ident) return send(res, 400, forgotPasswordPage(lang, true));
    if (loginLocked("pwreset", req)) return send(res, 429, forgotPasswordSentPage(config.supportEmail, lang));
    recordLoginFailure("pwreset", req);
    try {
      const n = await sendPasswordResetLinks(ident);
      console.log(`[auth] jelszó-link kérés · ${n} levél ment ki`);
    } catch (e) {
      // Loud in the log, identical on the page — the answer must not reveal anything.
      console.error(`[auth] jelszó-link kiküldése SIKERTELEN: ${(e as Error).message}`);
    }
    return send(res, 200, forgotPasswordSentPage(config.supportEmail, lang));
  }
  // Elek T-3: spend the one-time link — set the password, end every older session,
  // open a fresh one.
  {
    const pwLinkPost = /^\/login\/jelszo\/([A-Za-z0-9_-]{20,100})$/.exec(pathname);
    if (req.method === "POST" && pwLinkPost) {
      const form = await readFormBody(req);
      const token = pwLinkPost[1]!;
      const v = await peekPasswordToken(token);
      const lang = await prepareMailLang(v.ok ? await langForTenant(v.tenantId) : DEFAULT_LANG);
      if (!v.ok) return send(res, 410, passwordLinkDeadPage(lang));
      const r = await setPasswordWithToken(token, form.get("password") ?? "", form.get("password2") ?? "");
      if (!r.ok) {
        if (r.error === "link") return send(res, 410, passwordLinkDeadPage(lang));
        return send(res, 400, setPasswordPage({ token, username: v.username, siteName: v.siteName }, lang, r.error));
      }
      setSession(res, r.tenantUserId);
      console.log(`[auth] jelszó beállítva egyszeri linkkel · ${v.username}`);
      return send(res, 200, passwordSetDonePage(lang));
    }
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
    // T-3: the change ended every older session — THIS one gets a fresh cookie.
    if (!err) setSession(res, session.tenantUserId);
    return redirect(res, err ? `/admin?pw=${encodeURIComponent(err)}` : "/admin?saved=1");
  }
  // ADR-0084: a tenant SAJÁT számlájának PDF-je. A tenant-azonosító a WHERE része
  // (nem csak a session ellenőrzése) — egy másik bérlő bizonylatának id-jére ez
  // 404-et ad, nem tartalmat. A nem létező, az idegen és a PDF nélküli eset
  // SZÁNDÉKOSAN azonos válasz: így egy id-próbálgatás semmit nem árul el.
  if (req.method === "GET" && /^\/admin\/szamla\/[^/]+\.pdf$/.test(pathname)) {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const invoiceId = pathname.slice("/admin/szamla/".length, -".pdf".length);
    const doc = await tenantInvoicePdf(session.tenantId, invoiceId);
    // A „nincs ilyen", az „idegen bérlőé" és a „nem sikerült pótolni" SZÁNDÉKOSAN
    // ugyanaz a válasz — egy id-próbálgatás így semmit nem árul el. A szöveg viszont
    // legyen HASZNÁLHATÓ: a tulaj tudja, mi a következő lépése (ADR-0086).
    if (!doc) {
      return send(
        res,
        404,
        "A bizonylat most nem érhető el. A számlát e-mailben is elküldtük — a melléklet ott megtalálható. Ha nem találja, írjon nekünk és pótoljuk.",
      );
    }
    const buf = Buffer.from(doc.pdfBase64, "base64");
    const name = `szamla-${(doc.invoiceNumber ?? "bizonylat").replace(/[^\w-]/g, "")}.pdf`;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": buf.length,
      // inline: a telefon beépített nézegetője megnyitja; a letöltés onnan egy koppintás.
      "Content-Disposition": `inline; filename="${name}"`,
      // Bizonylat: sosem köztes gyorsítótárba (Cloudflare/proxy), csak a böngészőbe.
      "Cache-Control": "private, no-store",
    });
    res.end(buf);
    return;
  }
  if (req.method === "POST" && pathname === "/admin/uzenetek/olvasott") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    // A gomb a SZŰRT listára hat (tulaj-döntés, 2026-09-13): ugyanazt a szűrőt
    // kapja, amit a lista renderelt — a form rejtett mezőiből. Szűrő nélkül a
    // jelentése változatlan (az egész postaláda).
    const form = await readFormBody(req);
    const topicParam = form.get("t") ?? "";
    const channelParam = form.get("c") ?? "";
    const query = {
      topic: isMessageTopic(topicParam) ? topicParam : "mind",
      channel: channelParam === "email" || channelParam === "sms" ? channelParam : "",
      unread: form.get("u") === "1",
      q: form.get("q") ?? "",
    };
    await markAllMessagesRead(session.tenantId, query);
    // ⚠️ A szűrésbe térünk vissza, nem a lista tetejére — a tulaj ott dolgozott.
    // Az „Olvasatlan" kapcsolót NEM visszük vissza: épp most tüntettük el a
    // tartalmát, tehát üres listára érkezne, magyarázat nélkül.
    const back = new URLSearchParams({
      tab: "uzenetek",
      t: query.topic === "mind" ? "" : query.topic,
      c: query.channel,
      q: query.q,
    });
    for (const [k, v] of [...back.entries()]) if (!v) back.delete(k);
    return redirect(res, `/admin?${back.toString()}`);
  }
  // ADR-0241 — POST /admin/elerhetoseg: address, map pin, phone, e-mail. All-or-nothing;
  // a refusal returns to the same screen with the failing fields named.
  if (req.method === "POST" && pathname === "/admin/elerhetoseg") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const r = await saveTenantContact(session.tenantId, contactEditsFrom(form));
    if (!r.ok) return redirect(res, `/admin?tab=elerhetoseg${contactErrorQuery(r.errors)}`);
    return redirect(res, "/admin?tab=elerhetoseg&saved=1");
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
  // POST /admin/modules — tenant self-service module selection.
  //
  // ADR-0113 (supersedes the ADR-0080 ② B-opció): free changes (cancel, rejoin,
  // 0 Ft add, legacy switch-off) apply immediately; a PAID new module activates
  // only when its prorated first fee is paid. Token mandate → instant MIT charge
  // here; no mandate (or a failed charge) → pay-link redirect, the webhook
  // activates. Fail-closed: an unpaid add changes nothing.
  if (req.method === "POST" && pathname === "/admin/modules") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const change = await applyModuleChange(session.tenantId, form.getAll("module"));
    // ADR-0094 ④: refused — nothing was written; tell the tenant WHY (floor).
    if (change.refusedBelowFloor) {
      return redirect(res, `/admin?tab=modulok&floorblock=${change.refusedBelowFloor.floor}`);
    }
    // ADR-0119 ⑥: the ADD was refused because the site is suspended for
    // non-payment. Any cancellations in the same POST DID go through, so this is
    // a notice, not a rollback — but it has to be SAID, otherwise the tenant just
    // watches a switch snap back with no explanation.
    if (change.refusedWhileFrozen?.length) {
      return redirect(res, "/admin?tab=modulok&frozenblock=1");
    }
    if (change.renderNeeded) {
      // The live page renders from the snapshot — an entitlement alone would
      // change the bill without changing the site (same reason as the upsell had).
      await rerenderTenantSnapshot(session.tenantId, { as: "live" });
    }
    const q = [
      change.added.length ? `madd=${change.added.join(",")}` : "",
      change.cancelled.length ? `mcancel=${change.cancelled.join(",")}` : "",
      [...change.rejoined, ...change.switchedOff].length
        ? `mother=${[...change.rejoined, ...change.switchedOff].join(",")}`
        : "",
    ]
      .filter(Boolean)
      .join("&");

    if (change.requiresPayment.length) {
      const sub = await db
        .selectFrom("subscription")
        .select([
          "billing_period",
          "current_period_end",
          "payment_method",
          "recurrence_token",
          "recurrence_trace_id",
        ])
        .where("tenant_id", "=", session.tenantId)
        .executeTakeFirst();
      if (!sub) return redirect(res, `/admin?tab=modulok&payerror=1${q ? `&${q}` : ""}`);
      const order = await createFirstChargeOrder(
        session.tenantId,
        change.requiresPayment,
        sub.billing_period as "monthly" | "annual",
        new Date(sub.current_period_end as unknown as string),
      );
      if (!order) return redirect(res, `/admin?tab=modulok&payerror=1${q ? `&${q}` : ""}`);

      // ADR-0226 (wallet ⑧): the tenant chose "Másik kártyával" — skip the stored
      // card and mint a pay-link that INITIATES a token, so the card that pays
      // becomes the mandate (the plan bar promised exactly that).
      const newCard = form.get("card") === "new";
      if (newCard && sub.payment_method === "token" && sub.recurrence_token) {
        const link = await requestPayment(order.orderId, { newCard: true });
        if (!link) return redirect(res, `/admin?tab=modulok&payerror=1${q ? `&${q}` : ""}`);
        return redirect(res, link.payUrl);
      }
      // Stored mandate: charge now, payer absent — success activates on the spot.
      if (sub.payment_method === "token" && sub.recurrence_token) {
        const outcome = await chargeUpsellWithToken(
          order.orderId,
          sub.recurrence_token,
          sub.recurrence_trace_id,
        );
        if (outcome === "paid") {
          // ADR-0205: a kedvezmény LEVEZETÉSE is utazik, nem csak a végösszeg. A
          // korábbi redirect kizárólag `mamount`-ot vitt, ezért a sáv csak a 14 775 Ft-ot
          // tudta kiírni — a 19 700 Ft-os díjat és a −25 %-ot nem —, pedig mindkettő ott
          // van az orderben. A tulaj emiatt nem tudta ellenőrizni a saját számláját, és
          // maga jelezte, hogy „kevésnek tűnik" (2026-09-21).
          // ⛔ `mlist` csak akkor megy, ha VOLT kedvezmény: enélkül a sáv üres
          // „−0 Ft" sort írna arra, aki teljes áron vett.
          const discount =
            order.offerPercent && order.listPrice > order.price
              ? `&mlist=${order.listPrice}&mpct=${order.offerPercent}${order.offerKind ? `&mkind=${order.offerKind}` : ""}`
              : "";
          return redirect(
            res,
            `/admin?tab=modulok&applied=1&mcharged=${change.requiresPayment.join(",")}` +
              `&mamount=${order.price}${discount}${q ? `&${q}` : ""}`,
          );
        }
        if (outcome === "pending") {
          return redirect(res, `/admin?tab=modulok&applied=1&mpending=1${q ? `&${q}` : ""}`);
        }
        // ⛔ DECLINED MIT → we stop on OUR OWN screen and say so (owner ruling,
        // 2026-09-22). This used to fall straight through to the pay-link below,
        // and that redirect is the problem: in production `payUrl` is the
        // GATEWAY's own page (barion.ts → secure.barion.com), where we cannot
        // write a single word. The tenant read „a kártyáját 4 900 Ft-tal
        // terheljük", clicked, and landed on a stranger's payment form — never
        // learning that the stored card was the thing that failed. (Dev runs the
        // Barion SANDBOX — `secure.test.barion.com` — so this was reproducible
        // locally too; it was simply never exercised with a declined MIT.)
        //   The pay-link is still minted here (it IS the way forward, and the
        // banner needs a real target — charge-retry-note-check ②/③), but the
        // tenant now clicks it knowingly.
        const retry = await requestPayment(order.orderId);
        if (!retry) return redirect(res, `/admin?tab=modulok&payerror=1${q ? `&${q}` : ""}`);
        // ⛔ A fragment NEM dekoráció (mérve 2026-09-22, 390px ÉS 1280px): nélküle a
        // tulaj a lap tetejére érkezik, a sáv pedig a hajtás alatt marad — a bukás
        // ugyanolyan néma, mint a gateway-re dobás volt.
        return redirect(
          res,
          `/admin?tab=modulok&payfail=1&mfail=${change.requiresPayment.join(",")}` +
            `${q ? `&${q}` : ""}#${DECLINED_NOTE_ANCHOR}`,
        );
      }
      const link = await requestPayment(order.orderId);
      if (!link) return redirect(res, `/admin?tab=modulok&payerror=1${q ? `&${q}` : ""}`);
      return redirect(res, link.payUrl);
    }
    return redirect(res, `/admin?tab=modulok&applied=1${q ? `&${q}` : ""}`);
  }
  // ADR-0080 ③ — whole-subscription cancel / resume (danger zone of the B plan).
  // Cancel arms cancel_at_period_end: the site stays live until the period end,
  // then the billing tick closes it. Resume disarms — nothing was lost.
  if (
    req.method === "POST" &&
    (pathname === "/admin/subscription/cancel" || pathname === "/admin/subscription/resume")
  ) {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const cancel = pathname.endsWith("/cancel");
    // ADR-0094 ②: under a running domain commitment there is NO free cancellation
    // — the UI links to the settlement page, and this guard keeps a hand-crafted
    // POST from routing around it (a UI branch alone is not a gate).
    if (cancel && (await activeDomainCommitment(session.tenantId))) {
      return redirect(res, "/admin/subscription/settlement");
    }
    if (!cancel) {
      const open = await openSettlement(session.tenantId);
      // A PAID kötbér cannot be un-paid by a button — resuming after it is a
      // support conversation, so the route refuses silently-honestly (the UI
      // does not offer the button in this state either).
      if (open?.paid) return redirect(res, "/admin?tab=modulok");
      // An UNPAID settlement must not survive the resume as a dangling money claim.
      await voidUnpaidSettlement(session.tenantId);
    }
    await setSubscriptionCancel(session.tenantId, cancel);
    return redirect(res, "/admin?tab=modulok");
  }
  // ADR-0094 ② (approved plan B): close the cancellation THROUGH the settlement.
  // Order → pay-link → arm the cancel → the promised e-mail. Fail closed at every
  // step: no pay-link ⇒ nothing armed, nothing left recorded.
  if (req.method === "POST" && pathname === "/admin/subscription/settlement") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const takeDomain = form.get("takedomain") === "1";
    const order = await createSettlementOrder(session.tenantId, takeDomain);
    if (!order.ok || !order.orderId) {
      return redirect(
        res,
        `/admin/subscription/settlement?err=${encodeURIComponent(order.error ?? "ismeretlen hiba")}`,
      );
    }
    const pay = await requestPayment(order.orderId);
    if (!pay) {
      await voidUnpaidSettlement(session.tenantId);
      return redirect(
        res,
        `/admin/subscription/settlement?err=${encodeURIComponent(
          "a fizetési linket nem sikerült kiállítani — semmit nem rögzítettünk, próbálja meg újra",
        )}`,
      );
    }
    await setSubscriptionCancel(session.tenantId, true);
    // The done screen PROMISES the pay-link e-mail — send it now (dispatcher
    // module: the mail adapter must not become an import of this route file).
    const quote = await settlementQuote(session.tenantId);
    const open = await openSettlement(session.tenantId);
    await sendSettlementMail({
      tenantId: session.tenantId,
      orderId: order.orderId,
      domainName: quote?.domainName ?? "",
      total: open?.total ?? 0,
      currency: getCurrency(),
      monthsRemaining: quote?.commitment.remainingMonths ?? 0,
      penaltyBase: quote?.penaltyBase ?? 0,
      takeDomain,
      // The STABLE link: the letter outlives the gateway's payment window.
      payUrl: payEntryUrl(pay.paymentId),
      accessEndDate: quote?.accessEndDate ?? null,
    });
    return redirect(res, "/admin/subscription/settlement");
  }
  // ADR-0088 ⑨ — revoke the recurring-card mandate (two-step in the UI: the
  // confirm dialog posts here). Forward-looking: the fee stays due, the cycle
  // falls back to the pay-link path, and the token is DROPPED (not disabled).
  if (req.method === "POST" && pathname === "/admin/subscription/auto-charge-off") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    await revokeAutoCharge(session.tenantId);
    // ADR-0226: the revoke can start from the Pénztárca too — go back to where
    // the tenant was (a fixed value, never a raw redirect target).
    const form = await readFormBody(req);
    return redirect(res, form.get("back") === "penztarca" ? "/admin?tab=penztarca" : "/admin?tab=modulok");
  }
  // ── ADR-0226 (wallet ④): „Kártya cseréje / megadása" — a card_update order whose
  // pay-link HOLDS the verification amount and initiates a token; the webhook
  // releases the hold and the paying card becomes the mandate. Fail closed at
  // every step: no order / no pay-link ⇒ nothing changed, and the tab SAYS so.
  if (req.method === "POST" && pathname === "/admin/wallet/change-card") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const order = await createCardUpdateOrder(session.tenantId);
    if (!order.ok || !order.orderId) {
      console.warn(`[wallet] kártyacsere-order NEM készült · ${session.tenantId} · ${order.error ?? "?"}`);
      return redirect(res, "/admin?tab=penztarca&card=err");
    }
    const pay = await requestPayment(order.orderId);
    if (!pay) return redirect(res, "/admin?tab=penztarca&card=err");
    return redirect(res, pay.payUrl);
  }
  // ── freeze-state-v2 ⑤: KÉZI terhelés-újrapróbálás ────────────────────────────
  // A jóváhagyott terv „Újrapróbálom ezzel a kártyával" gombjának hiányzó útja.
  // A leggyakoribb elutasítás a fedezethiány; ha a tulaj közben feltöltötte a
  // kártyát, ma nincs mit tennie, mert a létra a FAGYÁS UTÁN már nem próbálkozik.
  //   ⛔ A gomb megléte NEM bizonyíték: minden előfeltételt (van-e tartozás, van-e
  // tárolt kártya, van-e rendezendő order, jár-e még a türelmi idő, maradt-e a
  // sorozatból) a `retryRenewalCharge` mér ÚJRA, és a korlátok egy feltételes
  // UPDATE WHERE-jében ülnek — két párhuzamos kattintásból pontosan egy nyer.
  //   A visszajelzés MINDEN ágon MÁS: egy összevont „nem sikerült" itt azt a hibát
  // követné el, amit ez a kör javít — nem mondaná meg, mit tehet a tulaj.
  if (req.method === "POST" && pathname === "/admin/subscription/retry-charge") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const r = await retryRenewalCharge(session.tenantId);
    const code = r.ok ? `t_${r.outcome}` : r.refusal;
    console.log(`[billing] kézi terhelés-újrapróba · ${session.tenantId} · ${code}`);
    // ⛔ A HORGONY (tulajdonosi döntés, 2026-09-15): a redirect eddig fragment
    // nélkül tért vissza, tehát a tulaj a lap TETEJÉRE érkezett — a gombok, amikről
    // a visszajelzés beszél, mérve ~3 600 bájttal lejjebb állnak. A horgonyt a NÉZET
    // adja (`chargeRetryAnchor`), mert ő tudja, melyik kimenetnél melyik kiút
    // létezik; ahol nincs teendő, ott üres, hogy ne görgessen el az üzenet elől.
    return redirect(
      res,
      `/admin?tab=modulok&ujra=${encodeURIComponent(code)}${chargeRetryAnchor(code)}`,
    );
  }
  // ADR-0088 §8 — monthly→annual switch, armed for the NEXT renewal (approved
  // B plan). Nothing is charged here; after the redirect the card re-renders
  // the truthful state (armed box with the honest effective date / reverted).
  // Refused codes are structural no-ops (no sub → no card; already annual →
  // no CTA), so a bare redirect is honest — what the tenant sees IS the state.
  if (
    req.method === "POST" &&
    (pathname === "/admin/subscription/period-annual" ||
      pathname === "/admin/subscription/period-monthly")
  ) {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const r = await setPendingBillingPeriod(
      session.tenantId,
      pathname.endsWith("/period-annual") ? "annual" : null,
    );
    if (!r.ok) {
      console.warn(
        `[subscription] periódus-váltás elutasítva (${r.error}) · tenant ${session.tenantId}`,
      );
    }
    return redirect(res, "/admin?tab=modulok");
  }
  // ADR-0063: POST /admin/multilang — the one-time translation purchase. Order +
  // pay-link, then straight to the gateway; the generation runs from the webhook.
  // Fail-closed like the upsell: no pay-link ⇒ no order left dangling as "bought".
  if (req.method === "POST" && pathname === "/admin/multilang") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    // Carry the picked languages through every error redirect — a failed pay
    // attempt used to wipe the buyer's selection too (Elek FK-005b H4).
    // ADR-0128: the TIER travels with the selection — dropping it on an error redirect
    // would bounce the buyer back to the Alap card after they had chosen Teljes.
    const tierQ = String(form.get("tier") ?? "");
    const langsQ =
      `&langs=${encodeURIComponent(form.getAll("lang").join(","))}` +
      `&tier=${encodeURIComponent(tierQ)}`;
    const order = await createMultilangOrder(session.tenantId, form.getAll("lang"), tierQ);
    if (!order.ok || !order.orderId) {
      return redirect(
        res,
        `/admin?tab=modulok&mlerror=${encodeURIComponent(order.error ?? "ismeretlen hiba")}${langsQ}#tobbnyelvu`,
      );
    }
    const pay = await requestPayment(order.orderId);
    if (!pay) {
      console.error(
        `[multilang] ${session.tenantId}: nem sikerült fizetési linket kiadni (order ${order.orderId})`,
      );
      return redirect(res, `/admin?tab=modulok&payerror=1${langsQ}#tobbnyelvu`);
    }
    return redirect(res, pay.payUrl);
  }
  // ── ADR-0078: saját webcím megrendelése (a jóváhagyott B változat 2. lépéséről) ──
  // A multilang (0036) útját követi: order_intent → pay-link → webhook. A domain
  // VÁSÁRLÁSA itt nem történik meg — azt a fizetés utáni webhook indítja (ADR-0071),
  // mert fizetés előtt venni idegen pénzen vásárlás lenne.
  if (req.method === "POST" && pathname === "/admin/domain/order") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const wanted = String(form.get("domain") ?? "");
    await loadPricing();
    // ADR-0251: once more at the registrar, right before the pay-link. Anything but
    // "free" goes back to the review step, which re-checks and says why — we never
    // open a payment for a name we do not know to be buyable this minute.
    const wantedNorm = normalizeCustomDomain(wanted);
    if (!wantedNorm.ok || !wantedNorm.domain || (await checkWebcimAvailability(wantedNorm.domain)) !== "free") {
      return redirect(res, `/admin?tab=webcim&d=${encodeURIComponent(wanted)}`);
    }
    const orderId = await createDomainUpgradeOrder(session.tenantId, wanted);
    if (!orderId) {
      console.error(`[domain] ${session.tenantId}: nem sikerült rendelést létrehozni (${wanted})`);
      return redirect(res, "/admin?tab=webcim&payerror=1");
    }
    // ADR-0093 waived fee (0 Ft): there is nothing to pay, so the gateway is
    // skipped — a 0-amount pay-link only "works" on the mock; Barion would
    // reject it live (mock-path-masks-live-path trap). The ORDER itself is the
    // trigger: settle it and start the provisioning exactly as the paid webhook
    // would. No invoice — no consideration to invoice.
    const created = await db
      .selectFrom("order_intent")
      .select(["price"])
      .where("id", "=", orderId)
      .executeTakeFirstOrThrow();
    if ((created.price ?? 0) === 0) {
      // Settle with a 0-amount 'paid' payment row (gateway 'none') so the money
      // trail stays queryable — the order is delivered, nothing was owed.
      await db
        .insertInto("payment")
        .values({
          order_intent_id: orderId,
          amount: 0,
          currency: "HUF",
          period: "annual",
          gateway: "none",
          status: "paid",
          paid_at: new Date(),
        })
        .execute();
      provisionOrderDomain(orderId).catch((e) =>
        console.error(`[domain] 0 Ft-os beszerzés-futtatás HIBA (${orderId}):`, e),
      );
      return redirect(res, "/admin?tab=webcim");
    }
    const pay = await requestPayment(orderId);
    if (!pay) {
      console.error(`[domain] ${session.tenantId}: nincs fizetési link (order ${orderId})`);
      return redirect(res, `/admin?tab=webcim&d=${encodeURIComponent(wanted)}&payerror=1`);
    }
    return redirect(res, pay.payUrl);
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
    // AMENITY PICKER (plan F): the screen posts checked catalogue labels (`am`) +
    // free lines (`other`); storage stays the `items` lines field, so we compose
    // it here — the picker is a UI layer, not a new data channel.
    if (moduleId === "amenities" && (form.has("am") || form.has("other"))) {
      form.set(
        "items",
        composeAmenities(form.getAll("am"), form.get("other") ?? "", "property").join("\n"),
      );
    }
    // ADR-0241: the Térkép screen posts the shared place card too. Saved FIRST and
    // without its own render — the redirect below re-renders once for both.
    if (moduleId === "location" && form.has("address")) {
      const place = await saveTenantContact(
        session.tenantId,
        { address: form.get("address") ?? "", lat: form.get("lat") ?? "", lon: form.get("lon") ?? "" },
        { render: false },
      );
      if (!place.ok) {
        return redirect(res, `/admin?tab=modulok&m=location${contactErrorQuery(place.errors)}`);
      }
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
    // A module's settings ARE page content (amenity list, contact block, opening
    // hours, newsletter copy…), so the snapshot has to carry the new values.
    return redirectRerendered(res, session.tenantId, `${back}&saved=1`);
  }
  // POST /admin/programs — the weekly program recommender's picker (approved contract B).
  // ⛔ Only ids from THIS tenant's live pool are stored: the form is client-built, and
  // a foreign or invented id must not land on the page (§B.17 — no source, no row).
  if (req.method === "POST" && pathname === "/admin/programs") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const siteId = await tenantSiteId(session.tenantId);
    if (!siteId || !(await tenantHasModule(session.tenantId, "poi"))) {
      return redirect(res, "/admin?tab=modulok");
    }
    const form = await readFormBody(req);
    let posted: unknown = [];
    try {
      posted = JSON.parse(form.get("picks") ?? "[]");
    } catch {
      posted = [];
    }
    const programPool = await siteProgramPool(siteId);
    const stored = readPicks((await getSiteModuleConfig(siteId, "poi")).config);
    // ADR-0238: own programs pass the ONE rule set (src/events/ownPrograms.ts); a
    // gathered id still has to be in THIS tenant's live pool.
    const picks = sanitizePicks(posted, programPool, stored);
    const order = form.get("order") === "manual" ? "manual" : "date";
    const result = await setSiteModuleConfig(siteId, "poi", { picks, order }, session.tenantUserId);
    const back = "/admin?tab=modulok&m=poi";
    if (!result.ok) {
      const q = result.errors.map((e) => `hiba=${encodeURIComponent(e)}`).join("&");
      return redirect(res, `${back}&${q}`);
    }
    return redirectRerendered(res, session.tenantId, `${back}&saved=1`);
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
    return redirectRerendered(
      res,
      session.tenantId,
      `/admin?tab=modulok&m=${encodeURIComponent(moduleId)}&saved=1`,
    );
  }
  // POST /admin/availability — the booking calendar: this month's MANUAL blocks
  // for ONE unit. The unit is verified to belong to this tenant's site.
  if (req.method === "POST" && pathname === "/admin/availability") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const month = normaliseMonth(form.get("month"), viewZone());
    const unit = form.get("unit") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "booking"))) {
      if (await unitBelongsToSite(siteId, unit)) {
        await setManualMonthBlocks(unit, month, form.getAll("day"));
      }
    }
    // The Foglalások tab posts the same month-set semantics; only the way back differs.
    if (form.get("back") === "foglalasok") {
      return redirect(
        res,
        `/admin?tab=foglalasok&u=${encodeURIComponent(unit)}&ho=${month}&naptar=1&saved=1`,
      );
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
    let newUnit: { id: string; state: "ar" | "ajanlat" | "nincs" | "rossz" } | null = null;
    if (siteId) {
      const id = form.get("id") ?? "";
      const name = form.get("name") ?? "";
      const capRaw = Number(form.get("capacity") ?? "");
      const cap = Number.isFinite(capRaw) && capRaw > 0 ? Math.round(capRaw) : null;
      if (id && (await unitBelongsToSite(siteId, id))) {
        await updateUnit(siteId, id, name, cap, form.get("description"));
      } else if (!id) {
        const before = await getUnits(siteId);
        const whole = form.get("whole");
        // ADR-0256 (approved plan whole-property-second-question): on "Nem" the owner also
        // says what the unit so far WAS — his first room (with a name) or nothing he lets
        // (hidden from the guest). The browser checks this before sending; this is the
        // same rule for a form sent without JS, and it refuses BEFORE anything is written,
        // so a half-answered form never leaves a new room behind with the old unit unsettled.
        const first = form.get("first");
        const firstName = (form.get("first_name") ?? "").replace(/\s+/g, " ").trim();
        if (before.length === 1 && whole === "nem" && name.trim()) {
          const why =
            first !== "szoba" && first !== "rejt"
              ? `Válassza ki, mi legyen az eddigi „${before[0]!.name}” egységgel.`
              : first === "szoba" && !firstName
                ? "Adjon nevet az első szobájának."
                : first === "szoba" && firstName.toLowerCase() === name.replace(/\s+/g, " ").trim().toLowerCase()
                  ? "A két szoba neve nem lehet ugyanaz."
                  : "";
          if (why) {
            const back = form.get("back") === "rooms" ? "rooms" : "booking";
            return redirect(res, `/admin?tab=modulok&m=${back}&hiba=${encodeURIComponent(why)}`);
          }
        }
        const created = await createUnit(siteId, name, cap, form.get("description"));
        // ADR-0232: the SECOND unit is the moment the owner decides whether the place is
        // also let as one — the add form asks (required radio), the answer sets or clears
        // the flag on the unit that was there before. No answer (an older form, or a
        // 3rd+ unit) leaves the flag as it is.
        // ADR-0257: "csak" = the place is let ONLY as one — the unit so far is the whole
        // place and the one offer; the new room (and every later one) is presentation.
        if (created && before.length === 1 && (whole === "igen" || whole === "nem" || whole === "csak")) {
          const letAsOne = whole === "igen" || whole === "csak";
          await setWholeProperty(siteId, letAsOne ? before[0]!.id : null, whole === "csak");
          await settleFormerWhole(
            siteId,
            before[0]!.id,
            letAsOne ? "egesz" : first === "rejt" ? "rejt" : "szoba",
            firstName,
          );
        }
        // ADR-0257 (owner: „szobák nem kérnek árát"): a presentation room is asked no price —
        // the form shows no field, and a price sent anyway (an old form) is not stored.
        const presentation =
          whole === "csak" || (before.length > 1 && before.some((u) => u.wholeOnly && u.isWholeProperty));
        // ADR-0208 ⑥.3 (approved plan price-on-request ②): with pricing on, the new-unit
        // row asks for the price or "nem adok meg árat". ⛔ It never refuses the save
        // (ADR-0193 ①) — a unit without either is created, and the flash says what
        // that means and offers both ways out.
        if (created && !presentation && (await tenantHasModule(session.tenantId, "pricing"))) {
          const amount = parseOfferAmount(form.get("price") ?? "");
          if (amount.value) {
            await setBasePrice(created, amount.value);
            newUnit = { id: created, state: "ar" };
          } else if (form.get("price_on_request") !== null) {
            await setUnitPriceOnRequest(created, true);
            newUnit = { id: created, state: "ajanlat" };
          } else {
            // A malformed amount is not silently dropped as "no price": the flash
            // names it, so the owner knows the figure they typed was not taken.
            newUnit = { id: created, state: amount.error ? "rossz" : "nincs" };
          }
        }
      }
    }
    // The owner comes back to the screen the row was on (rooms or booking) — the
    // flash about the price has to be where they are looking.
    const back = form.get("back") === "rooms" ? "rooms" : "booking";
    // `#nu-flash`: on a phone the flash sits ~600 px down, under the cookie bar and the
    // fixed bottom nav (measured) — without the anchor the owner lands on the page and
    // never sees what just happened to the unit they added.
    const flash = newUnit ? `&uj=${newUnit.state}&ue=${encodeURIComponent(newUnit.id)}#nu-flash` : "";
    // A new or renamed unit is a ROOM CARD on the page (and its own subpage) — the
    // snapshot has to be rebuilt or the owner adds apartments nobody can see.
    return redirectRerendered(res, session.tenantId, `/admin?tab=modulok&m=${back}&saved=1${flash}`);
  }
  if (req.method === "POST" && pathname === "/admin/units/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    // The owner comes back to the screen the button was on (rooms editor or booking).
    const back = form.get("back") === "rooms" ? "rooms" : "booking";
    if (siteId) {
      const result = await deleteUnit(siteId, form.get("id") ?? "");
      if (!result.ok && result.reason) {
        return redirect(
          res,
          `/admin?tab=modulok&m=${back}&hiba=${encodeURIComponent(result.reason)}`,
        );
      }
    }
    return redirectRerendered(res, session.tenantId, `/admin?tab=modulok&m=${back}&saved=1`);
  }
  // POST /admin/units/whole — ADR-0232: which unit is the whole place, if any (the card
  // above the rooms grid, approved plan whole-property-choice B). Unchecked → none.
  if (req.method === "POST" && pathname === "/admin/units/whole") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    if (siteId) {
      const unit = form.get("unit") ?? "";
      // ADR-0257: three states (none / also / only); an older form sends the `on` checkbox.
      const mode = form.get("mode") ?? (form.get("on") !== null ? "also" : "none");
      const on = (mode === "also" || mode === "only") && unit && (await unitBelongsToSite(siteId, unit));
      await setWholeProperty(siteId, on ? unit : null, mode === "only");
    }
    // The flag changes what the guest's calendar blocks and what the room card says —
    // the snapshot is rebuilt like after any unit edit.
    return redirectRerendered(res, session.tenantId, "/admin?tab=modulok&m=rooms&saved=1#szobak");
  }
  // POST /admin/photos/order — reorder; photos[0] is the cover in every template.
  if (req.method === "POST" && pathname === "/admin/photos/order") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const to = form.get("to") ?? "";
    if (to === "up" || to === "down" || to === "cover") {
      await moveTenantPhoto(session.tenantId, form.get("url") ?? "", to);
    } else if (/^\d{1,3}$/.test(to)) {
      // ADR-0224 ⑥: drag-and-drop lands the picture on an absolute position.
      await moveTenantPhoto(session.tenantId, form.get("url") ?? "", Number(to));
    }
    return redirect(res, "/admin?tab=fotok&saved=1");
  }
  // POST /admin/photos/caption — the photo's alt text (templates, lightbox, screen readers).
  if (req.method === "POST" && pathname === "/admin/photos/caption") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const r = await setTenantPhotoCaption(session.tenantId, form.get("url") ?? "", form.get("alt") ?? "");
    // ADR-0224 ⑥: the tab saves captions in place (fetch) — answer JSON, not a redirect.
    if (String(req.headers["x-requested-with"] ?? "") === "fetch")
      return send(res, r.ok ? 200 : 400, JSON.stringify({ ok: r.ok }), MIME[".json"]);
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
    // ADR-0198: which tab the owner was on, so the round trip puts them back there
    // instead of dropping them on "Alapok" after every star-click.
    const tabRaw = form.get("fl") ?? "";
    const backTab = tabRaw === "kep" || tabRaw === "fel" ? tabRaw : "alap";
    let notice = "mentve";
    // This route was the ONE unit-scoped save with no module gate at all (found
    // 2026-08-26 while its neighbours — prices, booking — all checked): the link
    // was hidden without the rooms module, but a direct POST wrote anyway. Same
    // class as the ADR-0033 hole: the gate measured the VIEW, not the operation.
    if (
      siteId &&
      (await tenantHasModule(session.tenantId, "rooms")) &&
      (await unitBelongsToSite(siteId, unit))
    ) {
      const units = await ensureUnits(siteId);
      const u = units.find((x) => x.id === unit)!;
      // ADR-0198: the name and the capacity moved ONTO the room editor — until now a
      // room was edited on two separate forms ("Mit ad ki?" and the content card) and
      // the owner had to know which half lived where. A blank name would be a silent
      // wipe, so it falls back to the stored one; a blank capacity is a real value
      // ("nincs megadva"), so it clears.
      const postedName = (form.get("name") ?? "").trim();
      const capRaw = Number(form.get("capacity") ?? "");
      const capacity = form.has("capacity")
        ? Number.isFinite(capRaw) && capRaw > 0
          ? Math.round(capRaw)
          : null
        : u.capacity;
      await updateUnit(siteId, unit, postedName || u.name, capacity, form.get("description"));
      // AMENITY PICKER (plan F; owner decision: unit amenities need rooms AND
      // amenities). Module active → compose checked labels + free lines, with
      // scope enforced server-side (a forged property-only label is dropped).
      // Module inactive → the card shows the conversion panel and posts no
      // amenity fields; the stored list is left untouched, never cleared.
      if (await tenantHasModule(session.tenantId, "amenities")) {
        if (form.has("am") || form.has("amenities_other")) {
          await setUnitAmenities(
            siteId,
            unit,
            composeAmenities(form.getAll("am"), form.get("amenities_other") ?? "", "unit"),
          );
        } else if (form.has("amenities")) {
          // Legacy textarea shape — kept so an in-flight old form still saves.
          await setUnitAmenities(siteId, unit, (form.get("amenities") ?? "").split(/\r?\n/));
        }
      }
      // The photo picker lives on the room card now (owner, 2026-08-25), so the
      // same save carries the picture assignment. `photo` is absent when the
      // owner never opened the picker — then the assignment is left untouched;
      // an OPENED-but-empty picker posts the marker below and clears it.
      //
      // ADR-0198: the ★ (make it the cover) is a submit button of this SAME form, so
      // one round trip carries the text, the ticks and the intent.
      const makeCover = form.get("set_cover") ?? "";
      if (form.get("photos_touched")) {
        const before = await getTenantContent(session.tenantId);
        const photosBefore = (before?.photos ?? []) as never as { url: string; units?: string[] }[];
        const mineBefore = photosBefore.filter((p) => (p.units ?? []).includes(unit)).map((p) => p.url);
        const coverBefore = unitCoverPhoto(unit, (before?.photos ?? []) as never)?.url ?? "";
        const picked = form.getAll("photo");
        await setTenantUnitPhotos(session.tenantId, unit, picked);
        // ⛔ A levételt az ÁLLAPOT-KÜLÖNBSÉGBŐL olvassuk, nem egy külön „unassign"
        // szándék-mezőből: a tulaj a pipa levételével is levehet egy képet, és akkor
        // is jár neki a három tényállás egyike — különben a legfontosabb mondat
        // („a közös képtárban benne marad") pont a szokásos úton maradna el.
        const removed = mineBefore.filter((url) => !picked.includes(url));
        if (removed.length) {
          // The owner is owed the truth about what just happened to the cover: a
          // replacement stepped in, or the card lost its picture altogether.
          notice = !removed.includes(coverBefore) ? "le" : picked.length ? "lekov" : "lenincs";
        }
        if (makeCover) {
          const wasAssigned = picked.includes(makeCover);
          const r = await setTenantUnitCover(session.tenantId, unit, makeCover);
          if (r.ok) notice = wasAssigned ? "borito" : "boritoplus";
        }
      }
    }
    // The description and the amenities ride the room card; only the photo branch
    // re-rendered before, so a text-only save stayed invisible on the page.
    return redirectRerendered(
      res,
      session.tenantId,
      `/admin?tab=modulok&m=rooms&saved=1&e=${encodeURIComponent(unit)}` +
        `&fl=${backTab}&uz=${notice}#szoba-${encodeURIComponent(unit)}`,
    );
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
    // The price is a LINE on the room card and a row in the price table.
    return redirectRerendered(res, session.tenantId, "/admin?tab=modulok&m=pricing&saved=1");
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
    return redirectRerendered(res, session.tenantId, "/admin?tab=modulok&m=pricing&saved=1");
  }
  // 0074 (approved plan season-year-price): a saved season can be CHANGED — name,
  // days, price, minimum. Before, the only way was delete + re-add. An error keeps the
  // edit open (`edit=`) and shows next to it, not at the top of a long page.
  if (req.method === "POST" && pathname === "/admin/prices/season/edit") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const id = form.get("id") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      const min = (form.get("min_nights") ?? "").trim();
      const result = await updateSeasonPrice(siteId, id, {
        label: form.get("label") ?? "",
        from: form.get("from") ?? "",
        to: form.get("to") ?? "",
        amount: Number(String(form.get("amount") ?? "").replace(/[\s.\u00a0]/g, "")),
        minNights: min ? Number(min) : null,
      });
      if (!result.ok && result.errors.length) {
        const q = result.errors.map((e) => `hiba=${encodeURIComponent(e)}`).join("&");
        return redirect(res, `/admin?tab=modulok&m=pricing&edit=${encodeURIComponent(id)}&${q}#s-${encodeURIComponent(id)}`);
      }
    }
    return redirectRerendered(
      res,
      session.tenantId,
      `/admin?tab=modulok&m=pricing&saved=1&sv=${encodeURIComponent(id)}#s-${encodeURIComponent(id)}`,
    );
  }
  // Where two seasons share days, the one higher on the list prices them — the owner
  // decides that order (2026-09-23), so it can be changed in place.
  if (req.method === "POST" && pathname === "/admin/prices/season/move") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const id = form.get("id") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      await moveSeasonPrice(siteId, id, form.get("dir") === "up" ? -1 : 1);
    }
    return redirectRerendered(res, session.tenantId, `/admin?tab=modulok&m=pricing&saved=1#s-${encodeURIComponent(id)}`);
  }
  // One YEAR's price of a season (the year strip). `op=clear` removes it, and the
  // recurring price holds that year again. The redirect lands on the same card.
  if (req.method === "POST" && pathname === "/admin/prices/year") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const season = form.get("season") ?? "";
    const year = Number(form.get("year") ?? "");
    const ev = `${encodeURIComponent(season)}-${Number.isFinite(year) ? year : 0}`;
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      const clear = form.get("op") === "clear";
      const result = await setSeasonYearPrice(siteId, season, {
        year,
        amount: clear ? "" : (form.get("amount") ?? ""),
        from: clear ? null : form.get("from"),
        to: clear ? null : form.get("to"),
      });
      if (!result.ok && result.errors.length) {
        const q = result.errors.map((e) => `hiba=${encodeURIComponent(e)}`).join("&");
        return redirect(res, `/admin?tab=modulok&m=pricing&ev=${ev}&${q}#ev-${ev}`);
      }
    }
    return redirectRerendered(res, session.tenantId, `/admin?tab=modulok&m=pricing&saved=1&ev=${ev}#ev-${ev}`);
  }
  // ADR-0208 ⑥.2 — "nem adok meg alapárat", per unit (approved plan price-on-request A).
  // Saved on toggle. The page lists the unit as "Egyedi ajánlat alapján" from now on,
  // so it is re-rendered. `back` lets the new-unit flash on the rooms/booking screen
  // record the same decision without sending the owner to another tab.
  if (req.method === "POST" && pathname === "/admin/prices/request") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const unit = form.get("unit") ?? "";
    if (siteId && (await tenantHasModule(session.tenantId, "pricing"))) {
      if (await unitBelongsToSite(siteId, unit)) {
        await setUnitPriceOnRequest(unit, form.get("on") !== null);
      }
    }
    const back = form.get("back");
    const target =
      back === "rooms" || back === "booking"
        ? `/admin?tab=modulok&m=${back}&saved=1&uj=kimondva&ue=${encodeURIComponent(unit)}#nu-flash`
        : "/admin?tab=modulok&m=pricing&saved=1";
    return redirectRerendered(res, session.tenantId, target);
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
    return redirectRerendered(res, session.tenantId, "/admin?tab=modulok&m=pricing&saved=1");
  }
  // POST /foglalas/<token>/ajanlat — the owner sends the price offer (booking-offer ⑤–⑧).
  // No login: the owner's single-use action token from the mail IS the authorization,
  // exactly like the one-tap verdict links it replaces on a quote request.
  const ownerOfferPost = req.method === "POST" && RE_OWNER_OFFER.exec(pathname);
  if (ownerOfferPost) {
    const token = ownerOfferPost[1]!;
    const form = await readFormBody(req);
    // ADR-0267 (approved plan booking-offer-scope, „A"): the price goes into the list only
    // when „Mentsem az árlistába is?" is ticked AND one of its two ways is chosen.
    const into = form.get("into") === "1";
    const input = {
      amount: form.get("amount") ?? "",
      into,
      save: into ? form.get("save") : "request",
      note: form.get("note"),
    };
    const r = await sendOffer(token, input, publicBaseUrl(req));
    if (r.outcome === "sent") {
      const v = await loadOfferView(token);
      return send(res, 200, ownerOfferSentPage(r, v.hostName ?? ""));
    }
    const v = await loadOfferView(token);
    return send(
      res,
      r.outcome === "unknown" ? 404 : r.outcome === "invalid" ? 400 : 200,
      ownerOfferPage(v, {
        errors: r.errors,
        amount: input.amount,
        into,
        save: input.save ?? "",
        note: input.note ?? "",
      }),
    );
  }

  // POST /ajanlat/<offer_token>/elfogadom | nem-kerem — the GUEST answers (⑪/⑫).
  const guestOfferPost = req.method === "POST" && RE_GUEST_OFFER.exec(pathname);
  if (guestOfferPost && guestOfferPost[2]) {
    const v = await respondToOffer(
      guestOfferPost[1]!,
      guestOfferPost[2] === "elfogadom" ? "accept" : "decline",
      publicBaseUrl(req),
    );
    return send(res, v.outcome === "unknown" ? 404 : 200, guestOfferResultPage(v));
  }

  // POST /admin/booking/offer-accept — ⑬ the owner records a phone/letter acceptance.
  if (req.method === "POST" && pathname === "/admin/booking/offer-accept") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const token = form.get("token") ?? "";
    const owned = siteId
      ? await db
          .selectFrom("booking_request")
          .select("id")
          .where("action_token", "=", token)
          .where("site_id", "=", siteId)
          .executeTakeFirst()
      : null;
    if (owned) {
      const r = await recordOfferAcceptedByOwner(token, publicBaseUrl(req));
      if (r.outcome === "conflict") {
        return redirect(
          res,
          `/admin?tab=foglalasok&hiba=${encodeURIComponent("Ezek a napok időközben foglalttá váltak, ezért nem fogadható el.")}`,
        );
      }
    }
    return redirectRerendered(res, session.tenantId, "/admin?tab=foglalasok&saved=1");
  }

  // POST /foglalas/<token>/lemondom — the GUEST's cancel (approved plan, 2026-09-06).
  // No login: the single-use token from the confirmation mail IS the authorization.
  const guestCancel = req.method === "POST" && RE_GUEST_CANCEL.exec(pathname);
  if (guestCancel) {
    const form = await readFormBody(req);
    const r = await cancelRequest({
      token: guestCancel[1]!,
      by: "guest",
      note: form.get("uzenet"),
      publicBaseUrl: publicBaseUrl(req),
    });
    return send(res, r.outcome === "unknown" ? 404 : 200, guestCancelDonePage(r));
  }

  // POST /foglalas/<token>/elfogadom|elutasitom — the owner's verdict, from the confirm
  // page the mail link opens (Elek V-1, 2026-10-01: the GET only shows). No login: the
  // single-use token from the notification mail IS the authorization.
  const ownerDecide = req.method === "POST" && RE_OWNER_DECIDE.exec(pathname);
  if (ownerDecide) {
    const verdict = ownerDecide[2] === "elfogadom" ? "accepted" : "declined";
    const r = await decideRequest(ownerDecide[1]!, verdict, publicBaseUrl(req));
    // Booking-offer ②: a request with NO price is answered with an offer, not a verdict.
    if (r.outcome === "needs_offer") return redirect(res, `/foglalas/${ownerDecide[1]!}/ajanlat`);
    return send(res, r.outcome === "unknown" ? 404 : 200, bookingVerdictPage(r));
  }

  // POST /velemeny/<token>/kiteszem|nem-teszem-ki — the owner's review verdict, from the
  // confirm page the mail link opens (Elek V-1). Idempotent: owners double-tap.
  const ownerReview = req.method === "POST" && RE_OWNER_REVIEW.exec(pathname);
  if (ownerReview) {
    const verdict = ownerReview[2] === "kiteszem" ? "published" : "rejected";
    const r = await decideReview(ownerReview[1]!, verdict, publicBaseUrl(req));
    // A published verdict changes what the page shows, and the page is a STATIC
    // file — without this rebuild the owner taps "Kiteszem" and nothing appears.
    if (r.ok && r.outcome === "published" && r.tenantId) {
      await rerenderTenantSnapshot(r.tenantId);
    }
    return send(res, r.outcome === "unknown" ? 404 : 200, reviewVerdictPage(r));
  }

  // POST /admin/booking/decide — the same verdict as the e-mail links, from the admin,
  // plus the owner's word to the guest (approved plan ⑤: the note is quoted in the mail).
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
      const r = await decideRequest(token, verdict, publicBaseUrl(req), form.get("uzenet"));
      // Booking-offer ②: a request with no price is answered with an offer, not a verdict.
      if (r.outcome === "needs_offer") return redirect(res, `/foglalas/${token}/ajanlat`);
      if (r.outcome === "conflict") {
        return redirect(
          res,
          `/admin?tab=foglalasok&hiba=${encodeURIComponent("Ezek a napok időközben foglalttá váltak, ezért nem fogadható el.")}`,
        );
      }
      // Elek FK-007: a verdict that confirmed one guest and auto-refused two others
      // used to end in "Mentve — az oldalad frissült." The ids (not names — this is
      // a URL) let the screen say WHO got what, from rows it already loads.
      if (r.id) {
        const auto = (r.autoDeclinedIds ?? []).slice(0, 8).join(",");
        return redirect(
          res,
          `/admin?tab=foglalasok&d=${encodeURIComponent(r.id)}&mit=${r.outcome === "accepted" ? "visszaigazolva" : "elutasitva"}` +
            (auto ? `&auto=${encodeURIComponent(auto)}` : ""),
        );
      }
    }
    return redirect(res, "/admin?tab=foglalasok&saved=1");
  }

  // POST /admin/booking/cancel — the OWNER ends an accepted booking (approved plan ⑦:
  // from the calendar day panel or the history list; the guest is mailed, days freed).
  if (req.method === "POST" && pathname === "/admin/booking/cancel") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const siteId = await tenantSiteId(session.tenantId);
    const id = form.get("id") ?? "";
    // ⛔ MÉRVE (B8, 2026-09-14): the redirect dropped the calendar state, so cancelling
    // from the OPEN calendar snapped it shut and reset it to the current month and the
    // first unit. The form carries the view back (bookingViews › viewState); it is
    // whitelisted here character by character, so the field can never become an open
    // redirect or smuggle extra parameters.
    const view = form.get("nezet") ?? "";
    const back = /^[a-zA-Z0-9=&_%.-]{0,120}$/.test(view) ? view : "";
    const backQs = back ? `&${back}` : "";
    // uuid guard: a malformed id must 404 quietly, not throw a Postgres cast error.
    const owned =
      siteId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? await db
            .selectFrom("booking_request")
            .select("id")
            .where("id", "=", id)
            .where("site_id", "=", siteId)
            .executeTakeFirst()
        : null;
    if (owned) {
      const r = await cancelRequest({
        id,
        by: "owner",
        note: form.get("uzenet"),
        publicBaseUrl: publicBaseUrl(req),
      });
      if (r.outcome === "cancelled") {
        return redirect(
          res,
          `/admin?tab=foglalasok&d=${encodeURIComponent(id)}&mit=lemondva${backQs}`,
        );
      }
    }
    return redirect(res, `/admin?tab=foglalasok&saved=1${backQs}`);
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
          .select(["action_token", "status"])
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
      // Name what the tap did on the screen it returns to (approved contract B).
      const done =
        verdict === "published" ? "published" : owned.status === "published" ? "withdrawn" : "rejected";
      return redirect(
        res,
        `/admin?tab=modulok&m=reviews&e=${encodeURIComponent(id)}&uz=${done}#velemenyek`,
      );
    }
    return redirect(res, "/admin?tab=modulok&m=reviews");
  }

  // ADR-0290 — the owner sets the accommodation's time zone (Fiók tab). Only a real IANA
  // name is stored; anything else (a hand-made POST, an empty filtered select) keeps
  // the stored zone and says so.
  if (req.method === "POST" && pathname === "/admin/timezone") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    const tz = form.get("time_zone") ?? "";
    if (!isValidTimeZone(tz)) return redirect(res, "/admin?tab=fiok&tzerr=1#idozona");
    await setTenantTimeZone(session.tenantId, tz);
    // The published page is a snapshot: which dated price and which program count as
    // "today" follow the accommodation's zone — re-render so the guest sees the new day.
    return redirectRerendered(res, session.tenantId, "/admin?tab=fiok&saved=1#idozona");
  }
  if (req.method === "POST" && pathname === "/admin/contact") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await updateContactEmail(session.tenantUserId, form.get("contact_email") ?? "");
    return redirect(res, "/admin?saved=1");
  }
  // ADR-0110 — the tenant edits what its own imprint and privacy notice publish.
  // Every field may legitimately be blank (a private person has no registry number),
  // so nothing is rejected here; a MISSING statutory field is reported on the panel
  // and rendered loudly on the page, which is the honest handling of a gap.
  if (req.method === "POST" && pathname === "/admin/legal") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    await saveTenantLegal(session.tenantId, {
      legalName: form.get("legal_name"),
      address: form.get("address"),
      taxNumber: form.get("tax_number"),
      regNumber: form.get("reg_number"),
      ntakId: form.get("ntak_id"),
      email: form.get("email"),
      phone: form.get("phone"),
    });
    // The legal pages are static snapshots: without a re-render the owner would save
    // and see the old text — the very "silent no-op" this codebase keeps tripping on.
    await rerenderTenantSnapshot(session.tenantId);
    return redirect(res, "/admin?tab=fiok&saved=1#jogi-adatok");
  }
  if (req.method === "POST" && pathname === "/admin/photos") {
    const session = await currentTenant(req);
    if (!session) return send(res, 401, JSON.stringify({ ok: false }), MIME[".json"]);
    try {
      const body = await readJsonBody(req, PHOTO_BODY_LIMIT);
      const all = Array.isArray(body.images) ? body.images : [];
      const images = all.slice(0, 12);
      // ⛔ ADR-0198: a refused file used to be a silent `continue` — the owner got
      // "ok: true" and a picture that never arrived. Every refusal now NAMES the file
      // and the reason, and travels back as an ERROR, not as part of a success.
      const errors: { file: string; reason: string }[] = [];
      const nameOf = (it: unknown, i: number): string =>
        String((it as Record<string, unknown>)?.name ?? "").slice(0, 120) || `${i + 1}. kép`;
      if (all.length > images.length) {
        errors.push({
          file: "",
          reason: `Egyszerre legfeljebb 12 képet tölthet fel; ${all.length - images.length} kimaradt.`,
        });
      }
      // The shared library holds 24 pictures (addTenantPhotos slices there). Without
      // this the overflow was dropped inside the writer with nothing said.
      const contentNow = await getTenantContent(session.tenantId);
      const libCount = contentNow?.usingOwnPhotos ? (contentNow.photos?.length ?? 0) : 0;
      let room = Math.max(0, 24 - libCount);
      // ADR-0198: uploading FROM a room assigns the picture to that room in the same
      // step — one shared library, marked where it belongs (ADR-0044 §11).
      const unitId = String(body.unit ?? "").trim();
      const siteIdForUnit = unitId ? await tenantSiteId(session.tenantId) : null;
      const unitOk = Boolean(
        unitId && siteIdForUnit && (await unitBelongsToSite(siteIdForUnit, unitId)),
      );
      const store = getAssetStore();
      const saved: { url: string; alt: string; units?: string[] }[] = [];
      for (const [i, it] of images.entries()) {
        const dataUrl = String((it as Record<string, unknown>)?.dataUrl ?? "");
        const alt = String((it as Record<string, unknown>)?.alt ?? session.displayName).slice(0, 160);
        const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
        if (!m) {
          errors.push({ file: nameOf(it, i), reason: "nem kép (JPEG, PNG vagy WEBP kell)" });
          continue;
        }
        const buf = Buffer.from(m[2], "base64");
        if (buf.length > 6_000_000) {
          errors.push({
            file: nameOf(it, i),
            reason: `${(buf.length / 1_000_000).toFixed(1).replace(".", ",")} MB — a legnagyobb feltölthető méret 6 MB`,
          });
          continue;
        }
        if (room <= 0) {
          errors.push({ file: nameOf(it, i), reason: "a közös képtárba legfeljebb 24 kép fér" });
          continue;
        }
        // Rotated upright, capped at the hero's width, metadata (GPS) stripped —
        // src/tenant/photoUpload.ts; the browser has usually done it already.
        let norm: Awaited<ReturnType<typeof normalizeUpload>>;
        try {
          norm = await normalizeUpload(buf);
        } catch {
          errors.push({ file: nameOf(it, i), reason: "nem kép (JPEG, PNG vagy WEBP kell)" });
          continue;
        }
        const a = await store.save(session.tenantId, norm.ext, norm.data);
        room -= 1;
        saved.push({ url: a.url, alt, ...(unitOk ? { units: [unitId] } : {}) });
      }
      // Did this unit have a cover before? If not, the first uploaded picture becomes
      // it (through the fallback resolver) — and the screen says so. If it HAD one,
      // the upload must not silently change what the public page shows (ADR-0198 ②).
      const hadCover = unitOk
        ? Boolean(unitCoverPhoto(unitId, (contentNow?.photos ?? []) as never))
        : true;
      if (saved.length) await addTenantPhotos(session.tenantId, saved);
      return send(
        res,
        200,
        JSON.stringify({
          // `ok` keeps its old meaning — the request was handled — because the Fotók
          // tab's script branches on it; WHAT was refused travels in `errors`, and it
          // is the caller's job to show a refusal as a refusal (the room editor does).
          ok: true,
          count: saved.length,
          assigned: unitOk && saved.length > 0,
          becameCover: unitOk && !hadCover && saved.length > 0,
          errors,
        }),
        MIME[".json"],
      );
    } catch (err) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((err as Error).message) }), MIME[".json"]);
    }
  }
  if (req.method === "POST" && pathname === "/admin/photos/delete") {
    const session = await currentTenant(req);
    if (!session) return redirect(res, "/login");
    const form = await readFormBody(req);
    // ADR-0224 ⑥: one form, one OR MANY urls (the selection mode's bulk delete).
    for (const url of form.getAll("url").filter(Boolean)) {
      await removeTenantPhoto(session.tenantId, url);
      await getAssetStore().remove(session.tenantId, url);
    }
    return redirect(res, "/admin?tab=fotok&saved=1");
  }

  // ── ADR-0080 ⑦ SMS-relay API: the Debian-box relay drains sms_outbox here. ──
  // The GSM modem NEVER moves to the prod VPS (owner decree 2026-08-29) — it is a
  // callable service on the dev box. Two-phase: pull marks 'sending' (a relay
  // crash re-queues after 10 min), ack settles sent/failed. Bearer-secret auth,
  // constant-time compare; no secret configured → the endpoints do not exist.
  if (req.method === "POST" && pathname === "/api/sms-relay/pull") {
    if (!smsRelayAuthorized(req)) return send(res, 404, "Not found");
    // Stale 'sending' rows (a relay that died mid-batch) go back to the queue.
    await db
      .updateTable("sms_outbox")
      .set({ status: "queued" })
      .where("status", "=", "sending")
      .where("pulled_at", "<", new Date(Date.now() - 10 * 60_000))
      .execute();
    const batch = await db
      .selectFrom("sms_outbox")
      .select(["id", "to_phone", "body"])
      .where("status", "=", "queued")
      .orderBy("created_at", "asc")
      .limit(10)
      .execute();
    if (batch.length) {
      await db
        .updateTable("sms_outbox")
        .set((eb) => ({
          status: "sending" as const,
          pulled_at: new Date(),
          attempts: eb("attempts", "+", 1),
        }))
        .where("id", "in", batch.map((b) => b.id))
        .execute();
    }
    return sendJson(res, 200, { messages: batch });
  }
  if (req.method === "POST" && pathname === "/api/sms-relay/ack") {
    if (!smsRelayAuthorized(req)) return send(res, 404, "Not found");
    const b = await readJsonBody(req);
    const results = Array.isArray(b.results) ? b.results : [];
    for (const r of results) {
      const id = String((r as { id?: unknown }).id ?? "");
      const ok = (r as { ok?: unknown }).ok === true;
      const error = String((r as { error?: unknown }).error ?? "").slice(0, 500) || null;
      if (!id) continue;
      if (ok) {
        await db
          .updateTable("sms_outbox")
          .set({ status: "sent", sent_at: new Date(), last_error: null })
          .where("id", "=", id)
          .execute();
      } else {
        // Retry up to 3 attempts, then park as failed (visible, not silent).
        const row = await db
          .selectFrom("sms_outbox")
          .select("attempts")
          .where("id", "=", id)
          .executeTakeFirst();
        await db
          .updateTable("sms_outbox")
          .set({ status: (row?.attempts ?? 0) >= 3 ? "failed" : "queued", last_error: error })
          .where("id", "=", id)
          .execute();
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  // ── ADR-0282 MMS-relay API: the same Debian-box modem, the same bearer secret. ──
  // One message per pull (a send is ~90 s); a stale 'sending' becomes 'unknown',
  // never re-sent; the ack stamps the pair's mms_sent_at and starts its SMS half.
  if (req.method === "POST" && pathname === "/api/mms-relay/pull") {
    if (!smsRelayAuthorized(req)) return send(res, 404, "Not found");
    const { pullMms } = await import("../mms/relayQueue.js");
    return sendJson(res, 200, { messages: await pullMms() });
  }
  if (req.method === "POST" && pathname === "/api/mms-relay/ack") {
    if (!smsRelayAuthorized(req)) return send(res, 404, "Not found");
    const b = await readJsonBody(req);
    const results = (Array.isArray(b.results) ? b.results : []).map((r) => {
      const o = r as { id?: unknown; ok?: unknown; messageId?: unknown; error?: unknown };
      return {
        id: String(o.id ?? ""),
        ok: o.ok === true,
        messageId: o.messageId ? String(o.messageId).slice(0, 200) : undefined,
        error: o.error ? String(o.error) : undefined,
      };
    });
    const { ackMms } = await import("../mms/relayQueue.js");
    return sendJson(res, 200, { ok: true, sent: await ackMms(results) });
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
    const m = RE_MOCK_PREVIEW.exec(pathname);
    if (m) return servePreview(res, m[1]);

    const site = RE_PREVIEW_SITE.exec(pathname);
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

    // GET /foglalas/<token>/elfogadom|elutasitom — the owner's verdict link straight
    // from the notification e-mail, with no login. ⛔ GET only CONFIRMS (Elek V-1,
    // measured live 2026-10-01): mail-link scanners open every link without a click, and
    // this GET used to confirm or refuse a guest's booking. The POST above decides.
    const decideMatch = RE_OWNER_DECIDE.exec(pathname);
    if (decideMatch) {
      const verdict = decideMatch[2] === "elfogadom" ? "accepted" : "declined";
      const v = await peekDecision(decideMatch[1]!, verdict);
      // Booking-offer ②: an old mail's accept on a request with NO price does not
      // confirm — it opens the offer page, where the price is set first.
      if (v.outcome === "needs_offer") return redirect(res, `/foglalas/${decideMatch[1]!}/ajanlat`);
      return send(res, v.outcome === "unknown" ? 404 : 200, bookingDecideConfirmPage(v, decideMatch[1]!, verdict));
    }

    // GET /foglalas/<token>/ajanlat — the owner's offer page (booking-offer ④).
    const ownerOfferGet = RE_OWNER_OFFER.exec(pathname);
    if (ownerOfferGet) {
      const v = await loadOfferView(ownerOfferGet[1]!);
      return send(res, v.outcome === "unknown" ? 404 : 200, ownerOfferPage(v));
    }

    // GET /ajanlat/<offer_token> — the guest's offer page (⑪): SHOWS, never decides —
    // mail clients prefetch links.
    const guestOfferGet = RE_GUEST_OFFER.exec(pathname);
    if (guestOfferGet && !guestOfferGet[2]) {
      const v = await peekGuestOffer(guestOfferGet[1]!);
      return send(res, v.outcome === "unknown" ? 404 : 200, guestOfferPage(v, guestOfferGet[1]!));
    }

    // GET /foglalas/<token>/lemondom — the guest's cancel link from the confirmation
    // mail (approved plan C, 2026-09-06). GET only CONFIRMS: prefetching clients must
    // never cancel a stay; the actual cancel is the POST below.
    const cancelMatch = RE_GUEST_CANCEL.exec(pathname);
    if (cancelMatch) {
      const v = await peekCancelView(cancelMatch[1]!);
      return send(
        res,
        v.outcome === "unknown" ? 404 : 200,
        guestCancelConfirmPage(v, cancelMatch[1]!),
      );
    }

    // GET /velemeny/<token>/kiteszem|nem-teszem-ki — the owner's verdict link on a
    // review, straight from the e-mail with no login (ADR-0046). ⛔ GET only CONFIRMS
    // (Elek V-1): a scanner's visit used to publish the review. The POST above decides.
    const revMatch = RE_OWNER_REVIEW.exec(pathname);
    if (revMatch) {
      const verdict = revMatch[2] === "kiteszem" ? "published" : "rejected";
      const v = await peekReviewDecision(revMatch[1]!, verdict);
      return send(res, v.outcome === "unknown" ? 404 : 200, reviewDecideConfirmPage(v, revMatch[1]!, verdict));
    }

    // ADR-0067: /login lives on the platform host with NO tenant context, so the
    // language arrives as a hint on the link the owner clicked on their own site
    // (ownerLogin.ts). Unknown/unsupported → Hungarian.
    const loginLang = await prepareMailLang(
      uiLangs().includes(url.searchParams.get("lang") ?? "")
        ? (url.searchParams.get("lang") as string)
        : DEFAULT_LANG,
    );
    if (pathname === "/login") {
      return send(
        res,
        200,
        loginPage(undefined, consoleLoginUrl(req), loginLang, safeAdminNext(url.searchParams.get("next"))),
      );
    }
    // Elek T-3: "Elfelejtett jelszó?" — the self-service request form.
    if (pathname === "/login/help") {
      return send(res, 200, forgotPasswordPage(loginLang));
    }
    // Elek T-3: the one-time password link. ⛔ The GET only LOOKS (mail scanners
    // open links): a valid link shows the form; only its POST spends the token.
    const pwLinkGet = /^\/login\/jelszo\/([A-Za-z0-9_-]{20,100})$/.exec(pathname);
    if (pwLinkGet) {
      const v = await peekPasswordToken(pwLinkGet[1]!);
      if (!v.ok) return send(res, 410, passwordLinkDeadPage(loginLang));
      return send(res, 200, setPasswordPage({ token: pwLinkGet[1]!, username: v.username, siteName: v.siteName }, loginLang));
    }
    // GDPR Art. 13/14 notice. /adatvedelem is the canonical Hungarian path the
    // footers link to; /privacy stays a live alias because outreach mails have
    // already gone out carrying it (it was the only legal route that existed).
    if (pathname === "/adatvedelem" || pathname === "/privacy") {
      return send(res, 200, privacyPage(config.outreachSender));
    }
    // Legal document layer (ADR-0056).
    if (pathname === "/impresszum") return send(res, 200, impresszumPage());
    if (pathname === "/aszf") return send(res, 200, aszfPage());
    if (pathname === "/elallas") return send(res, 200, elallasPage());
    if (pathname === "/adatfeldolgozas") return send(res, 200, adatfeldolgozasPage());
    // ADR-0089 — "így nézne ki az oldalamon": the tenant's OWN page rendered with
    // the module set in `on=`. Session-gated and ⛔ writes nothing (no entitlement,
    // no snapshot) — see renderTenantModulePreview. The view state (focus/only)
    // rides the URL HASH, so every shop-card thumbnail reuses ONE cached document
    // instead of forcing a full render each.
    if (pathname === "/admin/modules/preview") {
      const session = await currentTenant(req);
      if (!session) return redirect(res, "/login");
      const lang = await prepareMailLang(await langForTenant(session.tenantId));
      const shown = parsePreviewSet(url.searchParams.get("on"));
      const mv = await getTenantModules(session.tenantId);
      const owned = new Set(
        mv.modules.filter((m) => m.active && !m.supersededBy).map((m) => m.id),
      );
      const html = await renderTenantModulePreview(session.tenantId, shown);
      if (!html) return send(res, 404, T(lang, "Nincs megjeleníthető honlap."), "text/plain");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      });
      res.end(decoratePreview(html, { owned, shown, lang }));
      return;
    }
    // ADR-0094 ② (approved plan B — contract: design-refs/console/domain-settlement):
    // the interposed settlement page. Only reachable with a RUNNING domain
    // commitment; without one the modules tab's own cancel box is the way.
    if (pathname === "/admin/subscription/settlement") {
      const session = await currentTenant(req);
      if (!session) return redirect(res, "/login");
      const quote = await settlementQuote(session.tenantId);
      if (!quote) return redirect(res, "/admin?tab=modulok");
      const open = await openSettlement(session.tenantId);
      const content = await getTenantContent(session.tenantId);
      const view: DomainSettlementView = {
        domainName: quote.domainName,
        monthsTotal: quote.commitment.months,
        monthsElapsed: Math.max(0, quote.commitment.months - quote.commitment.remainingMonths),
        monthsRemaining: quote.commitment.remainingMonths,
        penaltyBase: quote.penaltyBase,
        penaltyTotal: quote.penaltyTotal,
        buyoutPrice: quote.buyoutPrice,
        accessEndDate: quote.accessEndDate,
        // The done screen renders the RECORDED order (DB truth), never a query flag.
        done: open ? { takeDomain: open.takeDomain, total: open.total } : null,
        error: url.searchParams.get("err"),
      };
      send(
        res,
        200,
        adminDashboard(session, content, {
          tab: "modulok",
          moduleSettingsHtml: domainSettlementSection(view, content?.lang ?? "hu"),
          modules: await getTenantModules(session.tenantId),
          supportEmail: config.supportEmail,
          unreadMessages: await countUnreadMessages(session.tenantId),
          subSummary: await getSubscriptionSummary(session.tenantId),
        }),
      );
      return;
    }
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
        url.searchParams.get("fl"),
        url.searchParams.get("uz"),
      );
    // ADR-0045 §J.26: KB screenshots live in the repo — served session-gated and
    // path-fenced to kb/entries/<id>/assets/ (kbAssetPath refuses escapes).
    const kbAsset = /^\/admin\/kb\/([a-z0-9-]+)\/(assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp))$/.exec(
      pathname,
    );
    if (kbAsset) {
      if (!(await currentTenant(req))) return redirect(res, "/login");
      // ADR-0045/e two-tier model (owner decree): the tenant surface serves ONLY
      // tenant-audience material. Without this fence a logged-in tenant could
      // fetch an internal (operator) guide screenshot by guessing the URL.
      const entry = loadKbEntries().find((e) => e.id === kbAsset[1]);
      if (!entry || entry.audience !== "tenant")
        return send(res, 404, "Nincs ilyen kép.", "text/plain");
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

// Exported so scripts/ui-shot.mts can boot this server on an ephemeral port
// (PUBLIC_PORT=0) and read the assigned port back for screenshotting.
export const server = http.createServer((req, res) => {
  // ADR-0290: each request gets its own accommodation-zone context (views read it).
  runWithViewZone(() => handle(req, res)).catch((err) => {
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
// Skipped under CIT_SHOT=1: a screenshot run must never trigger AI top-ups or DB writes.
if (process.env.CIT_SHOT !== "1") {
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
}
