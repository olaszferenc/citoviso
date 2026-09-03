// Operator console — the web layer (ADR-0003: built-in node:http, no framework).
// A tiny hand-rolled router over the console data/views + the generator service.
// Long-running: it does NOT close the shared pool. Post/Redirect/Get for mutations.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { TEMPLATES } from "../engine/templates.js";
import { generateEngineMock } from "../generator/generateEngine.js";
import { recopyArtifact } from "../generator/recopy.js";
import { resolveGatedPhotos } from "../generator/generate.js";
import { clusterCandidates, findDuplicateCandidates, ruleOnPair, type DupVerdict } from "./duplicates.js";
import {
  buildDocumentsCsv,
  getDocumentFile,
  getDocuments,
  getPartnerContacts,
  getPartnerDetail,
  getPartnerDocuments,
  getPartnerTimeline,
  listPartners,
  type PartnerDocQuery,
  type PartnerListQuery,
} from "./partnerData.js";
import {
  documentsPage,
  partnersPage,
  partnerNewPage,
  partnerPage,
  type PartnerTab,
} from "./partnerViews.js";
import {
  bootstrapLegalEntityFromConfig,
  createDocument,
  createPartner,
  getFinanceCounts,
  listLegalEntities,
  listPartnerOptions,
  resolveDocType,
} from "./partnerData.js";
import { documentNewPage } from "./partnerViews.js";
import { huTaxNumberProblem, normalizeHuTaxNumber, parseEuVat } from "../billing/taxId.js";
import { loadLead } from "../generator/persist.js";
import {
  createProspect,
  curateArtifact,
  deleteArtifact,
  getConversion,
  getLead,
  getOrderIntents,
  getPayments,
  getProspectByToken,
  getProspectActivity,
  getProspects,
  getSiteByToken,
  getTenantAdminByToken,
  listLeads,
  markProspectSent,
  getProspectChannelState,
  recordEvent,
  recordOrderIntent,
  recordView,
  saveLeadEdits,
  setProspectContactEmail,
  unsubscribeProspect,
  type LeadQuery,
} from "./data.js";
import { reenrichOne } from "../scraper/reenrichOne.js";
import { rescrapePhotos } from "../scraper/rescrapePhotos.js";
import { validateBuyer, type BuyerInput } from "../billing/buyer.js";
import { buildBillingPrefill } from "../billing/prefill.js";
import type { BillingPrefill } from "../generator/configurator.js";
import { getActivationSummary, handleWebhook, requestPayment } from "../payment/service.js";
import {
  applyOffer,
  bestActiveOfferForProspect,
  bestActiveOfferForProspectToken,
  ensureEscalationOffer,
} from "../payment/offers.js";
import { multilangPayResultPage, payMockPage, payPendingPage, payResultPage } from "./views.js";
import { checkSubdomainAvailable, convertLead } from "../conversion/provision.js";
import { injectConfigurator } from "../generator/configurator.js";
import {
  checkAvailability,
  normalizeCustomDomain,
  suggestWithAvailability,
} from "../domains.js";
import { MODULE_CATALOG, modulesForConversion } from "../modules.js";
import {
  computeAnnual,
  computeMonthly,
  getDomainMinCommitmentMonths,
  loadPricing,
  pricingRegions,
  pricingSnapshot,
  savePricing,
} from "../pricing.js";
import { buildDraftForProspect } from "../outreach/draft.js";
import { checkOutreachDraft } from "../outreach/outreachCheck.js";
import { sendOutreachMail } from "../outreach/sendBatch.js";
import { sendOutreachSms, smsAllowlistBlocks } from "../outreach/sendOutreachSms.js";
import { startOutreachPair, sendPairSmsHalf, getPairJob } from "../outreach/sendOutreachPair.js";
import { renderPairSmsDraft } from "../outreach/draft.js";
import { ensureMmsJpeg } from "../mms/sender.js";
import { normalizePhone } from "../sms/sender.js";
import { buildOutreachEmail, HERO_CID } from "../email/outreachEmail.js";
import { normalizeProspectPath } from "./prospectPath.js";
import { ensureHeroShot } from "../outreach/heroShot.js";
import { outreachDraftPage, privacyPage, prospectActivityPage } from "./views.js";
import {
  adatfeldolgozasPage,
  aszfPage,
  elallasPage,
  impresszumPage,
} from "../server/legalViews.js";

/**
 * Legal documents are readable WITHOUT an operator session: a prospect opens the
 * ÁSZF from the checkout and the privacy notice from the outreach mail, and
 * neither of them has (or should need) a console login.
 */
const LEGAL_PATHS = new Set([
  "/adatvedelem",
  "/privacy",
  "/impresszum",
  "/aszf",
  "/elallas",
  "/adatfeldolgozas",
]);
import { config } from "../config.js";
import { db } from "../db/client.js";
import { layout, leadPage, leadsPage, tenantAdminPage, scrapePage, reportPage } from "./views.js";
import { dashboardPage, operatorLoginPage, operatorLoginHelpPage, settingsPage } from "./views.js";
import { pricingPage, mapPage, regionsPage } from "./views.js";
import { duplicatesPage, helpPage } from "./views.js";
import { filterKbEntries, kbAssetPath, loadKbEntries, pickKbEntry, renderKbBody } from "../kb/kb.js";
import { getScrapeJob, startScrapeJob } from "./scrapeJob.js";
import { getFunnelReport, getScrapeRuns } from "./data.js";
import { deactivateRegion, disqualifyLead, listLeadsForMap, listRegions, markPlacesSource, requalifyLead, saveRegion } from "./data.js";
import { loadRegions, REGIONS } from "../scraper/regions.js";
import {
  authenticateOperator,
  changeOperatorPassword,
  clearOperatorSession,
  currentOperator,
  readOperatorSession,
  setOperatorSession,
} from "../auth/operatorAuth.js";
import path_mod from "node:path";
import { runWithConsoleLang, setConsoleLang } from "./i18nCtx.js";
import { supportedLangs } from "../i18n/lang.js";
import { prepareMailLang } from "../i18n/mail.js";

const PORT = Number(process.env.CONSOLE_PORT ?? "4600");

// Lead ids with a generation in flight (mock generation takes ~1-2 min). The
// POST returns immediately; the lead page shows a "folyamatban" state and
// auto-refreshes until the artifact appears. In-memory is fine — single process.
const generating = new Set<string>();
/** Artifacts whose text is being rewritten right now (one at a time per artifact). */
const recopying = new Set<string>();

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

/** Merge a webhook's query params + body (JSON or form-urlencoded) into one bag.
 *  Gateways differ: the mock posts JSON {gatewayRef,status}; Barion's callback
 *  carries paymentId (form/query). The adapter reads what it needs. */
async function readWebhookParams(
  req: http.IncomingMessage,
  url: URL,
): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams) params[k] = v;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw) {
    const ct = String(req.headers["content-type"] ?? "");
    if (ct.includes("application/json")) {
      try {
        Object.assign(params, JSON.parse(raw));
      } catch {
        /* ignore malformed JSON */
      }
    } else {
      for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
    }
  }
  return params;
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
    .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
    .select([
      "mock_artifact.path as path",
      "lead.name as leadName",
      "mock_artifact.inputs as inputs",
      "lead.address as leadAddress",
      "lead.raw as leadRaw",
    ])
    .where("mock_artifact.id", "=", artifactId)
    .executeTakeFirst();
  if (!a?.path) return send(res, 404, layout("404", "<p>Nincs ilyen mock.</p>"));
  try {
    const html = await readFile(a.path, "utf8");
    // ADR-0036: the configurator UI renders in the buyer's language (persisted on the artifact).
    const lang = ((a.inputs ?? {}) as { siteData?: { lang?: string } }).siteData?.lang;
    send(
      res,
      200,
      await injectConfigurator(html, artifactId, a.leadName, {
        ...(lang ? { lang } : {}),
        billingPrefill: leadBillingPrefill(a.leadAddress, a.leadRaw),
      }),
    );
  } catch {
    send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
  }
}

/**
 * Checkout prefill from a lead (0029). The country/city facets live in lead.raw
 * (ADR-0038 stored them without a migration), so both callers read them here
 * rather than each re-deriving the shape.
 */
function leadBillingPrefill(
  address: string | null,
  raw: unknown,
  contactEmail?: string | null,
): BillingPrefill {
  const facets = (raw ?? {}) as { country?: string; city?: string };
  return buildBillingPrefill(
    {
      address,
      country: facets.country ?? null,
      city: facets.city ?? null,
    },
    contactEmail ?? null,
  );
}

/**
 * Shared order-submit handler for BOTH prospect routes: the untracked
 * /configure/:artifactId/request and the tracked /p/:token/request (which
 * binds the order to the token's prospect). Body: modules + billing_period +
 * price + domain choice (ADR-0020).
 */
async function handleOrderRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  artifactId: string,
  prospectToken?: string,
): Promise<void> {
  const body = (await readJson(req)) as {
    modules?: unknown;
    billing_period?: unknown;
    price?: unknown;
    domain_type?: unknown;
    domain_name?: unknown;
    photo_rights_declared?: unknown;
    recurring_consent?: unknown;
  };
  // §A gate: the order carries the photo-rights self-declaration (possession +
  // warranty + indemnification) — without it a demo-photo site could go live.
  if (body.photo_rights_declared !== true) {
    send(res, 400, JSON.stringify({ ok: false, error: "photo_rights_declaration_required" }), "application/json");
    return;
  }
  // ADR-0088 ⑨ RECURRING MANDATE GATE: the payment we are about to start stores
  // the card for merchant-initiated renewals — without the buyer's explicit,
  // recorded consent that mandate would be taken, not given. Server-side like
  // every other checkout gate; the client tick is display-only.
  if (body.recurring_consent !== true) {
    send(res, 400, JSON.stringify({ ok: false, error: "recurring_consent_required" }), "application/json");
    return;
  }
  // BILLING GATE (0029): no valid buyer identity ⇒ no order and no pay-link.
  // Re-validated SERVER-side even though the configurator validates too — the
  // client is display-only here exactly as it is for the price below. Without
  // this the invoice fell back to lead.name + a regex-split Maps address + a
  // NULL tax number, i.e. an unusable invoice for every company buyer.
  const buyerCheck = await validateBuyer(body as BuyerInput, {
    requireTerms: Boolean(config.termsUrl),
  });
  if (!buyerCheck.ok) {
    send(
      res,
      400,
      JSON.stringify({ ok: false, error: "billing_details_invalid", fields: buyerCheck.errors }),
      "application/json",
    );
    return;
  }
  const buyer = buyerCheck.value;
  for (const flag of buyer.flags) {
    console.warn(`[console] SZÁMLÁZÁSI FIGYELMEZTETÉS (order beküldés): ${flag}`);
  }
  // Tenant-only/one-time modules (ADR-0063) cannot enter a subscription order.
  const catalogIds = new Set(MODULE_CATALOG.filter((m) => !m.tenantOnly).map((m) => m.id));
  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m): m is string => typeof m === "string" && catalogIds.has(m))
    : [];
  const billingPeriod = body.billing_period === "annual" ? "annual" : "monthly";
  // SECURITY (guard-agent finding, 2026-08-01): the charged price is computed
  // SERVER-side from the ONE pricing source (pricing.ts, operator-set) — the
  // client figure is display-only; a mismatch is logged as a tamper/drift signal.
  await loadPricing();
  const clientPrice = typeof body.price === "number" ? Math.round(body.price) : null;
  // ADR-0088: the computed amount is the LIST price; a tracked prospect may hold
  // an offer (outreach −25% / escalation / campaign — the single largest one,
  // never stacked), and then the TRANSACTION is discounted: this order only,
  // renewals recompute from list in billing.ts.
  const listPrice =
    billingPeriod === "annual" ? computeAnnual(modules) : computeMonthly(modules);
  const offer = prospectToken
    ? await bestActiveOfferForProspectToken(prospectToken)
    : null;
  const price = offer ? applyOffer(listPrice, offer) : listPrice;
  // Tamper/drift signal: the client figure is display-only. Until the offer UI
  // lands the configurator shows the list price, so both figures are "honest".
  if (clientPrice !== null && clientPrice !== price && clientPrice !== listPrice) {
    console.warn(
      `[console] ÁR-ELTÉRÉS az order-submitnél: kliens ${clientPrice} ≠ szerver ${price} (lista ${listPrice}) ` +
        `(modulok: ${modules.join(",") || "—"} · ${billingPeriod}) — a SZERVER-ár került rögzítésre`,
    );
  }
  // Domain choice (ADR-0020): default = platform subdomain; a custom domain
  // registered through us implies the minimum commitment.
  const domainType =
    body.domain_type === "citoviso_registered" || body.domain_type === "own"
      ? body.domain_type
      : "citoviso_sub";
  const domainName =
    typeof body.domain_name === "string" && body.domain_name.trim()
      ? body.domain_name.trim().toLowerCase().slice(0, 253)
      : null;
  // ADR-0093: operator-set commitment (pricing_config; loadPricing ran above).
  const commitmentMonths =
    domainType === "citoviso_registered" ? getDomainMinCommitmentMonths() : null;
  const rec = await recordOrderIntent({
    artifactId,
    modules,
    billingPeriod,
    price,
    domainType,
    domainName,
    commitmentMonths,
    photoRightsDeclared: true,
    recurringConsent: true,
    buyer,
    ...(prospectToken ? { prospectToken } : {}),
    ...(offer ? { offerId: offer.id, listPrice } : {}),
  });
  console.log(
    `[console] CSOMAG-IGÉNY · ${rec?.leadName ?? "?"} (lead ${rec?.leadId ?? "?"}) · ` +
      `${price ?? "?"} Ft/${billingPeriod === "annual" ? "év" : "hó"}` +
      (offer ? ` (lista ${listPrice} Ft, −${offer.percent}% ${offer.kind}-ajánlat)` : "") +
      ` · modulok: ${modules.join(", ") || "—"} · ` +
      `domain: ${domainType}${domainName ? ` (${domainName})` : ""}${commitmentMonths ? ` · ${commitmentMonths} hó elköteleződés` : ""}` +
      (prospectToken ? " · követett link" : ""),
  );
  // AUTOMATIC order→payment hand-off: issue the pay-link in the same request and
  // return it, so the configurator can send the buyer straight to checkout. From
  // there the chain is self-driving: pay → gateway webhook → activate (tenant +
  // entitlements + live site) → invoice. No operator step in the happy path.
  let payUrl: string | null = null;
  if (rec?.orderIntentId) {
    try {
      const pay = await requestPayment(rec.orderIntentId);
      payUrl = pay?.payUrl ?? null;
    } catch (e) {
      // Never fail the order on a gateway hiccup — the intent is recorded and the
      // operator can re-issue the link from the console.
      console.error(`[console] pay-link hiba (order ${rec.orderIntentId}):`, e);
    }
  }
  send(res, 200, JSON.stringify({ ok: true, ...(payUrl ? { payUrl } : {}) }), "application/json");
}

/**
 * GDPR/Grt. transparency footer for the TRACKED prospect page (PILOT.md §6):
 * a discreet, honest notice that viewing data is recorded (legitimate-interest
 * B2B outreach) + a working unsubscribe link. Injected before </body>.
 * Colours are literal on purpose: this overlays an ENGINE-rendered mock
 * (data plane, --cit-* skins) that never loads citui.css, so --citui-* tokens
 * would not resolve here. Neutral greys, no brand chrome.
 */
function injectTrackingNotice(html: string, token: string): string {
  const notice =
    `<div style="padding:14px 18px;text-align:center;font:12px/1.6 system-ui,sans-serif;` +
    `color:#8a8f98;background:#101216">Ezt az előnézetet személyre szabottan Önnek készítettük. ` +
    `A megtekintés adatai (megnyitás, görgetés, kipróbált elemek) rögzülnek, hogy az ajánlatot ` +
    `az igényeihez igazíthassuk (jogos érdek). ` +
    `<a href="/privacy" style="color:#8a8f98;text-decoration:underline">Adatkezelési tájékoztató</a> · ` +
    `<a href="/p/${token}/unsubscribe" style="color:#8a8f98;text-decoration:underline">Leiratkozás</a></div>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${notice}</body>`);
  return html + notice;
}

/** Neutral page after unsubscribe (no tracking, no sell). */
function unsubscribedPage(): string {
  return layout(
    "Leiratkozva",
    `<div class="panel" style="max-width:480px;margin:48px auto;text-align:center">
       <h2>Leiratkozott</h2>
       <p class="mut">Nem keressük többé ezzel az ajánlattal, és a megtekintési adatok rögzítését
       leállítottuk. Ha mégis érdekli a saját weboldala, írjon nekünk bátran.</p></div>`,
    { chrome: false },
  );
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

  // ── Design core static files (ADR-0021: one central CSS for all surfaces). ──
  if (method === "GET" && /^\/assets\/ui\/[a-z0-9._-]+$/i.test(path)) {
    const file = path_mod.resolve(process.cwd(), "public", path.slice(1));
    try {
      const type = path.endsWith(".css")
        ? "text/css; charset=utf-8"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".js")
            ? "text/javascript; charset=utf-8"
            : path.endsWith(".jpg") || path.endsWith(".jpeg")
              ? "image/jpeg"
              : path.endsWith(".png")
                ? "image/png"
                : "application/octet-stream";
      res.writeHead(200, { "content-type": type, "cache-control": "max-age=300" });
      res.end(await readFile(file));
      return;
    } catch {
      return send(res, 404, "not found", "text/plain; charset=utf-8");
    }
  }

  // ── Operator login (control-plane realm, ADR-0021) ──────────────────────────
  const publicLoginUrl = `${config.publicSiteUrl.replace(/\/+$/, "")}/login`;
  if (path === "/login") {
    if (method === "GET") return send(res, 200, operatorLoginPage(null, publicLoginUrl));
    if (method === "POST") {
      const form = await readBody(req);
      const id = await authenticateOperator(form.get("username") ?? "", form.get("password") ?? "");
      if (!id) {
        return send(
          res,
          200,
          operatorLoginPage(
            "Hibás felhasználónév vagy jelszó. (Ügyfélként nem itt, hanem a honlapon tudsz belépni.)",
            publicLoginUrl,
          ),
        );
      }
      setOperatorSession(res, id);
      return redirect(res, "/");
    }
  }
  if (method === "GET" && path === "/login/help") {
    return send(res, 200, operatorLoginHelpPage(publicLoginUrl));
  }
  if (method === "GET" && path === "/logout") {
    clearOperatorSession(res);
    return redirect(res, "/login");
  }
  // ADR-0067 ③: the operator picks their OWN console language. Stored on the
  // account (0037), so it follows them to any browser — a per-session choice would
  // quietly reset and read as a bug.
  if (method === "POST" && path === "/operator/lang") {
    const op = await currentOperator(req);
    if (!op) return redirect(res, "/login");
    const form = await readBody(req);
    const wanted = String(form.get("lang") ?? "");
    if (!supportedLangs().includes(wanted)) return redirect(res, req.headers.referer ?? "/");
    await db
      .updateTable("operator_user")
      .set({ lang: wanted })
      .where("id", "=", op.operatorUserId)
      .execute();
    setConsoleLang(wanted);
    // Provision the pack NOW rather than on the next render: the switch is the
    // moment the operator expects to see the change, not a page later.
    await prepareMailLang(wanted);
    return redirect(res, req.headers.referer ?? "/");
  }

  // ── AUTH GATE: everything is operator-only EXCEPT the prospect/tenant/payment
  // surfaces that outsiders must reach by design. Network trust (Tailscale) is
  // NOT the auth model — this console must survive public hosting.
  const isPublicPath =
    path.startsWith("/p/") || // tracked outreach links (prospect)
    path.startsWith("/pay/") || // pay pages + gateway webhook
    path.startsWith("/configure/") || // prospect configurator + order submit
    path.startsWith("/site/") || // provisioned site preview (token)
    path.startsWith("/admin/") || // tenant token page (data plane)
    LEGAL_PATHS.has(path);
  if (!isPublicPath && !readOperatorSession(req)) {
    return redirect(res, "/login");
  }

  // GET / — Irányítópult (module hub, owner's admin-hub mock).
  if (method === "GET" && path === "/") {
    const op = await currentOperator(req);
    return send(
      res,
      200,
      dashboardPage(
        await getFunnelReport(),
        getScrapeJob().running,
        op?.displayName ?? "operátor",
        await getFinanceCounts(),
      ),
    );
  }
  // GET /help — searchable knowledge base (ADR-0045/e §J), help-center layout
  // (approved plan: design-refs/console/help-center). TWO-TIER model (owner
  // decree, 2026-09-01): the internal user sees ALL guides — the operator set
  // AND the tenant set (support means seeing what the customer sees). Behind
  // the auth gate above; the tenant surface stays tenant-only in public.ts.
  if (method === "GET" && path === "/help") {
    const entries = loadKbEntries();
    const topic = url.searchParams.get("topic");
    const q = url.searchParams.get("q") ?? "";
    const open = topic ? pickKbEntry(entries, topic) : null;
    const topicsOf = (audience: "operator" | "tenant") =>
      filterKbEntries(entries.filter((e) => e.audience === audience), q).map((e) => ({
        id: e.id,
        title: e.title,
        snippet: e.snippet,
      }));
    return send(
      res,
      200,
      helpPage({
        operatorTopics: topicsOf("operator"),
        tenantTopics: topicsOf("tenant"),
        open: open
          ? {
              id: open.id,
              title: open.title,
              html: renderKbBody(open.body, `/help/${open.id}/`),
              updated: open.updated,
            }
          : null,
        query: q,
      }),
    );
  }
  // GET /help/<id>/assets/… — KB screenshots (§J.26): repo-sourced, path-fenced
  // (kbAssetPath refuses escapes), operator-gated by the auth gate above.
  const kbAsset = /^\/help\/([a-z0-9-]+)\/(assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp))$/.exec(
    path,
  );
  if (method === "GET" && kbAsset) {
    const abs = kbAssetPath(kbAsset[1]!, kbAsset[2]!);
    if (!abs) return send(res, 404, "Nincs ilyen kép.", "text/plain; charset=utf-8");
    try {
      const buf = await readFile(abs);
      res.writeHead(200, {
        "content-type": abs.endsWith(".png")
          ? "image/png"
          : abs.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg",
        "cache-control": "private, max-age=3600",
      });
      res.end(buf);
      return;
    } catch {
      return send(res, 404, "Nincs ilyen kép.", "text/plain; charset=utf-8");
    }
  }
  // GET /settings — operator account + password change.
  if (method === "GET" && path === "/settings") {
    const op = await currentOperator(req);
    if (!op) return redirect(res, "/login");
    const k = url.searchParams.get("pw");
    const notice = k ? { ok: k.startsWith("ok:"), text: k.replace(/^(ok|hiba):/, "") } : null;
    return send(res, 200, settingsPage(op, notice));
  }
  // POST /settings/password — change the logged-in operator's password.
  if (method === "POST" && path === "/settings/password") {
    const op = await currentOperator(req);
    if (!op) return redirect(res, "/login");
    const form = await readBody(req);
    const next = form.get("next") ?? "";
    const msg =
      next !== (form.get("next2") ?? "")
        ? "A két új jelszó nem egyezik."
        : await changeOperatorPassword(op.operatorUserId, form.get("current") ?? "", next);
    return redirect(
      res,
      `/settings?pw=${encodeURIComponent(msg ? `hiba:${msg}` : "ok:Jelszó módosítva.")}`,
    );
  }
  // GET /pricing — operator-editable pricing admin (PILOT.md §7d ②).
  if (method === "GET" && path === "/pricing") {
    const op = await currentOperator(req);
    if (!op) return redirect(res, "/login");
    await loadPricing(true);
    const region = url.searchParams.get("region") || undefined;
    const k = url.searchParams.get("saved");
    const notice = k ? { ok: k.startsWith("ok:"), text: k.replace(/^(ok|hiba):/, "") } : null;
    return send(res, 200, pricingPage(pricingSnapshot(region), pricingRegions(), notice));
  }
  // POST /pricing — persist the prices + the "confirmed" gate flip (per region).
  if (method === "POST" && path === "/pricing") {
    const op = await currentOperator(req);
    if (!op) return redirect(res, "/login");
    const form = await readBody(req);
    const num = (name: string, fallback: number): number => {
      const v = Number(form.get(name));
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    const region = form.get("region") || undefined;
    const snap = pricingSnapshot(region);
    const modulePrices: Record<string, number> = {};
    for (const m of MODULE_CATALOG) {
      if (m.spine) continue;
      modulePrices[m.id] = num(`m_${m.id}`, snap.modulePrices.get(m.id) ?? 0);
    }
    try {
      await savePricing({
        region: snap.region,
        currency: snap.currency,
        baseMonthly: num("base_monthly", snap.baseMonthly),
        annualFreeMonths: num("annual_free_months", snap.annualFreeMonths),
        customDomainYearly: num("custom_domain_yearly", snap.customDomainYearly),
        // ADR-0093 domain terms (cap, commitment, free threshold, buyout, loyalty).
        domainMaxPriceEur: num("domain_max_price_eur", snap.domainMaxPriceEur),
        domainMinCommitmentMonths: num("domain_min_commitment_months", snap.domainMinCommitmentMonths),
        domainFreeMinMonthly: num("domain_free_min_monthly", snap.domainFreeMinMonthly),
        domainBuyoutPrice: num("domain_buyout_price", snap.domainBuyoutPrice),
        domainLoyaltyMonths: num("domain_loyalty_months", snap.domainLoyaltyMonths),
        pricingConfirmed: form.get("pricing_confirmed") === "on",
        modulePrices,
      });
      // encodeURIComponent is NOT optional here: an accented string dropped raw
      // into a Location header gets latin-1'd by the client, and the page came
      // back showing "�raz�s mentve." The error branch below always did it right.
      return redirect(
        res,
        `/pricing?region=${encodeURIComponent(snap.region)}&saved=${encodeURIComponent("ok:Árazás mentve.")}`,
      );
    } catch (err) {
      return redirect(
        res,
        `/pricing?saved=${encodeURIComponent(`hiba:Mentés sikertelen: ${(err as Error).message}`)}`,
      );
    }
  }
  // GET /leads (with optional filter/sort query params)
  if (method === "GET" && path === "/leads") {
    const sp = url.searchParams;
    const dir = sp.get("dir");
    const q: LeadQuery = {
      sort: sp.get("sort") ?? undefined,
      dir: dir === "asc" ? "asc" : dir === "desc" ? "desc" : undefined,
      disqualified: sp.get("disqualified") ?? undefined,
      name: sp.get("name") ?? undefined,
      // Multi-select columns arrive as repeated params (?qualification=a&qualification=b).
      region: sp.getAll("region").filter(Boolean),
      country: sp.getAll("country").filter(Boolean),
      city: sp.getAll("city").filter(Boolean),
      qualification: sp.getAll("qualification").filter(Boolean),
      contact: sp.getAll("contact").filter(Boolean),
      mock: sp.getAll("mock").filter(Boolean),
      minPhotos: sp.get("minPhotos") ? Number(sp.get("minPhotos")) : undefined,
      minMaterial: sp.get("minMaterial") ? Number(sp.get("minMaterial")) : undefined,
    };
    // DEFAULT FILTER (owner decree): a fresh /leads shows the ACTIONABLE leads —
    // no/outdated website with at least one photo — not all 590. It applies ONLY when
    // no filter is set; sorting keeps it, an explicit "?all=1" (the clear button) drops
    // it, and any manual filter takes over. Injected into q so the header renders it as
    // live filter state (checked boxes + min-photos), so it persists when the operator
    // adds another filter.
    const anyFilter =
      !!q.name ||
      (q.region?.length ?? 0) > 0 ||
      (q.country?.length ?? 0) > 0 ||
      (q.city?.length ?? 0) > 0 ||
      (q.qualification?.length ?? 0) > 0 ||
      (q.contact?.length ?? 0) > 0 ||
      (q.mock?.length ?? 0) > 0 ||
      q.minPhotos != null ||
      q.minMaterial != null ||
      q.disqualified === "1";
    if (!anyFilter && sp.get("all") !== "1") {
      q.qualification = ["no_site", "outdated"];
      q.minPhotos = 1;
      q.defaulted = true;
    }
    return send(res, 200, leadsPage(await listLeads(q), q));
  }
  // GET /partners — partner registry list (PARTNER-UI-SPEC.md: the financial/CRM
  // face of a counterparty; separate surface from the lead list by owner decree).
  if (method === "GET" && path === "/partners") {
    const t = url.searchParams.get("type");
    const q: PartnerListQuery = {
      q: url.searchParams.get("q")?.trim() || undefined,
      type: t === "customer" || t === "supplier" ? t : undefined,
    };
    return send(res, 200, partnersPage(await listPartners(q), q));
  }
  // Shared query-string reader for the Bizonylatok filters (page + CSV export).
  const partnerDocQueryFrom = (u: URL): PartnerDocQuery => {
    const paid = u.searchParams.get("paid");
    const date = (k: string) => {
      const v = u.searchParams.get(k) ?? "";
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    };
    const cur = u.searchParams.get("currency") ?? "";
    return {
      type: resolveDocType(u.searchParams.get("type") ?? undefined)?.id,
      paid: paid === "1" ? true : paid === "0" ? false : undefined,
      q: u.searchParams.get("q")?.trim() || undefined,
      no: u.searchParams.get("no")?.trim() || undefined,
      partner: u.searchParams.get("partner")?.trim() || undefined,
      from: date("from"),
      to: date("to"),
      dueFrom: date("dueFrom"),
      dueTo: date("dueTo"),
      currency: /^[A-Z]{3}$/.test(cur) ? cur : undefined,
    };
  };
  // GET /documents — the global document list: ONE searchable table over all
  // partners' documents; direction is a FILTER, not a section (owner decree).
  if (method === "GET" && path === "/documents") {
    const dq = partnerDocQueryFrom(url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    return send(res, 200, documentsPage(await getDocuments(dq, undefined, { page }), dq));
  }
  // GET /documents.csv — the same filtered list for Excel. `all` is deliberate:
  // the export ships every matching row, never just the page on screen.
  if (method === "GET" && path === "/documents.csv") {
    const csv = buildDocumentsCsv(await getDocuments(partnerDocQueryFrom(url), undefined, { all: true }));
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bizonylatok.csv"`,
    });
    res.end(csv);
    return;
  }
  // GET/POST /documents/new — manual document registration (the door a
  // supplier invoice arrives through; source='manual').
  if (path === "/documents/new") {
    const formOpts = async () => ({
      partners: await listPartnerOptions(),
      entities: await listLegalEntities(),
      canBootstrapEntity: Boolean(config.legalEntity.name),
    });
    if (method === "GET") return send(res, 200, documentNewPage(await formOpts()));
    if (method === "POST") {
      const form = await readBody(req);
      const values: Record<string, string> = {};
      for (const [k, val] of form) if (k !== "file_data") values[k] = val;
      const get = (k: string) => (form.get(k) ?? "").trim() || null;
      const bad = async (message: string) =>
        send(res, 200, documentNewPage(await formOpts(), values, message));
      // ONE type field (owner decree): "Vevői számla" / "Szállítói számla" / … —
      // direction + doc_type come from the catalog, never typed by the operator.
      const typeOpt = resolveDocType(get("type") ?? undefined);
      const partnerId = get("partner_id");
      const legalEntityId = get("legal_entity_id");
      const documentNumber = get("document_number");
      const issueDate = get("issue_date");
      if (!typeOpt) return bad("Válassz számlatípust.");
      if (!partnerId) return bad("Partner nélkül nincs bizonylat — válassz, vagy rögzíts újat.");
      if (!legalEntityId) return bad("A könyvelőcég (jogi entitás) kötelező.");
      if (!documentNumber) return bad("A bizonylatszám kötelező (ami a számlán áll).");
      if (!issueDate) return bad("A kelte kötelező.");
      const num = (s: string | null): number | null => {
        if (!s) return null;
        const n = Number(s.replace(/\s/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const gross = num(get("gross"));
      if (gross === null || gross === 0) return bad("A bruttó összeg kötelező (sztornónál negatív).");
      const net = num(get("net")) ?? gross; // AAM/simple case: net = gross
      const paid = form.get("paid") === "on";
      // Számlakép: base64 dataURL from the client (tenant-admin upload pattern)
      // → written into the SHARED sites/_documents/ store (every tree sees it).
      let documentFile: string | null = null;
      let documentMime: string | null = null;
      const fileData = form.get("file_data") ?? "";
      if (fileData) {
        const m = /^data:(application\/pdf|image\/jpeg|image\/png);base64,(.+)$/.exec(fileData);
        if (!m) return bad("A számlakép csak PDF, JPG vagy PNG lehet.");
        const buf = Buffer.from(m[2]!, "base64");
        if (buf.length > 8 * 1024 * 1024) return bad("A számlakép túl nagy (max 8 MB).");
        const ext = m[1] === "application/pdf" ? "pdf" : m[1] === "image/png" ? "png" : "jpg";
        const dir = `sites/_documents/${issueDate.slice(0, 4)}`;
        await mkdir(dir, { recursive: true });
        documentFile = `${dir}/${randomUUID()}.${ext}`;
        await writeFile(documentFile, buf);
        documentMime = m[1]!;
      }
      await createDocument({
        legalEntityId,
        direction: typeOpt.direction,
        docType: typeOpt.docType,
        partnerId,
        documentNumber,
        issueDate,
        fulfillmentDate: get("fulfillment_date"),
        dueDate: get("due_date"),
        net,
        vat: gross - net,
        gross,
        currency: get("currency") ?? "HUF",
        vatTreatment: get("vat_treatment"),
        paid,
        paidAt: paid ? (get("paid_at") ?? issueDate) : null,
        note: get("note"),
        documentFile,
        documentMime,
      });
      return redirect(res, `/documents?q=${encodeURIComponent(documentNumber)}`);
    }
  }
  // POST /entities/bootstrap — create the first legal entity from LEGAL_ENTITY_* env.
  if (method === "POST" && path === "/entities/bootstrap") {
    if (!config.legalEntity.name) return redirect(res, "/documents/new");
    await bootstrapLegalEntityFromConfig(config.legalEntity);
    return redirect(res, "/documents/new");
  }
  // GET/POST /partners/new — manual partner registration (suppliers never
  // arrive via a payment; the auto path stays upsertPartnerFromOrder).
  if (path === "/partners/new") {
    if (method === "GET") return send(res, 200, partnerNewPage());
    if (method === "POST") {
      const form = await readBody(req);
      const values: Record<string, string> = {};
      for (const [k, val] of form) values[k] = val;
      const get = (k: string) => (form.get(k) ?? "").trim() || null;
      const name = get("name");
      const isSupplier = form.get("is_supplier") === "on";
      const isCustomer = form.get("is_customer") === "on";
      const country = (get("country") ?? "HU").toUpperCase();
      let taxNumber = get("tax_number");
      const euVatRaw = get("eu_vat_number");
      const bad = (message: string) => send(res, 200, partnerNewPage(values, { message }));
      if (!name) return bad("A jogi név kötelező.");
      if (!isSupplier && !isCustomer) return bad("Legalább egy szerep kell: szállító és/vagy vevő.");
      if (!/^[A-Z]{2}$/.test(country)) return bad("Az ország ISO-2 kód (pl. HU, DE).");
      if (taxNumber && country === "HU") {
        const problem = huTaxNumberProblem(taxNumber);
        if (problem) return bad(`Adószám: ${problem}`);
        taxNumber = normalizeHuTaxNumber(taxNumber);
      }
      let euVatNumber: string | null = null;
      if (euVatRaw) {
        const parsed = parseEuVat(euVatRaw, country);
        if (!parsed) return bad("A közösségi adószám alakja nem érvényes (pl. DE812871812).");
        euVatNumber = parsed.formatted;
      }
      const result = await createPartner({
        name,
        isCustomer,
        isSupplier,
        taxNumber,
        euVatNumber,
        registrationNo: get("registration_no"),
        country,
        zip: get("zip"),
        city: get("city"),
        address: get("address"),
        email: get("email"),
        phone: get("phone"),
        note: get("note"),
        bankAccountNo: get("bank_account_no"),
        bankName: get("bank_name"),
      });
      if (!result.ok)
        return send(res, 200, partnerNewPage(values, { message: result.error, existingId: result.existingId }));
      return redirect(res, `/partner/${result.id}`);
    }
  }
  // GET /partner/:id — partner page: header + role-dependent KPIs + tabs.
  const partnerMatch = /^\/partner\/([0-9a-f-]{36})$/i.exec(path);
  if (method === "GET" && partnerMatch) {
    const d = await getPartnerDetail(partnerMatch[1]!);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen partner.</p>"));
    const t = url.searchParams.get("tab");
    const tab: PartnerTab =
      t === "activity" || t === "documents" || t === "contacts"
        ? t
        : t === "subscription" && d.isCustomer
          ? "subscription"
          : "overview";
    const timeline = tab === "activity" ? await getPartnerTimeline(d.id) : [];
    const docQuery = partnerDocQueryFrom(url);
    // Overview needs the documents too: the KPI strip + havi bontás chart
    // (MineREAL) are computed from them.
    // Overview derives its KPI strip + monthly chart FROM the rows, so it needs
    // every document; only the Bizonylatok tab itself is paginated.
    const docs =
      tab === "documents" || tab === "overview"
        ? tab === "overview"
          ? await getPartnerDocuments(d.id, {}, { all: true })
          : await getPartnerDocuments(d.id, docQuery, {
              page: Number.parseInt(url.searchParams.get("page") ?? "1", 10),
            })
        : null;
    const contacts = tab === "contacts" ? await getPartnerContacts(d.id) : [];
    return send(res, 200, partnerPage(d, tab, timeline, docs, docQuery, contacts));
  }
  // GET /partner/:id/documents.csv — the filtered document list for Excel
  // (UTF-8 BOM + semicolon separator: opens correctly in Hungarian Excel).
  const partnerCsvMatch = /^\/partner\/([0-9a-f-]{36})\/documents\.csv$/i.exec(path);
  if (method === "GET" && partnerCsvMatch) {
    const csv = buildDocumentsCsv(
      await getPartnerDocuments(partnerCsvMatch[1]!, partnerDocQueryFrom(url), { all: true }),
    );
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bizonylatok-${partnerCsvMatch[1]!.slice(0, 8)}.csv"`,
    });
    res.end(csv);
    return;
  }
  // GET /accounting-document/:id/file — the stored document image (Számlakép).
  const docFileMatch = /^\/accounting-document\/([0-9a-f-]{36})\/file$/i.exec(path);
  if (method === "GET" && docFileMatch) {
    const f = await getDocumentFile(docFileMatch[1]!);
    if (!f) return send(res, 404, layout("404", "<p>Ehhez a bizonylathoz nincs tárolt számlakép.</p>"));
    try {
      const abs = path_mod.resolve(process.cwd(), f.file);
      const buf = await readFile(abs);
      res.writeHead(200, {
        "content-type": f.mime ?? "application/pdf",
        "content-disposition": "inline",
      });
      res.end(buf);
    } catch {
      return send(res, 404, layout("404", "<p>A számlakép-fájl nem található a tárban.</p>"));
    }
    return;
  }
  // GET /scrape — launcher + live log + run history (PILOT.md §7d ①).
  // GET /duplicates — suspected-duplicate groups awaiting a ruling.
  if (method === "GET" && path === "/duplicates") {
    const clusters = clusterCandidates(await findDuplicateCandidates(300));
    return send(res, 200, duplicatesPage(clusters));
  }
  // POST /duplicates/rule — the operator's verdict for one group. Stored per
  // pair (that is the exact unit of knowledge) but decided once per group.
  if (method === "POST" && path === "/duplicates/rule") {
    const form = await readBody(req);
    const verdict = form.get("verdict") ?? "";
    const keptId = form.get("kept") ?? undefined;
    const signal = form.get("signal") ?? undefined;
    let pairs: { a: string; b: string }[] = [];
    try {
      pairs = JSON.parse(form.get("pairs") ?? "[]");
    } catch {
      return redirect(res, "/duplicates");
    }
    if (!["duplicate", "same_owner", "unrelated"].includes(verdict)) {
      return redirect(res, "/duplicates");
    }
    for (const p of pairs) {
      await ruleOnPair({
        aId: p.a,
        bId: p.b,
        verdict: verdict as DupVerdict,
        keptId,
        signal,
      });
    }
    return redirect(res, "/duplicates");
  }
  if (method === "GET" && path === "/scrape") {
    await loadRegions(true); // operator-defined areas (0018), not just the built-ins
    const regions = Object.values(REGIONS).map((r) => ({ id: r.id, label: r.label }));
    const notice = url.searchParams.get("hiba");
    return send(res, 200, scrapePage(getScrapeJob(), await getScrapeRuns(), regions, notice));
  }
  // POST /scrape/start — spawn the existing CLI as a child process (one at a time).
  if (method === "POST" && path === "/scrape/start") {
    const form = await readBody(req);
    const regionId = form.get("region") ?? "";
    await loadRegions(true); // operator-defined areas (0018)
    if (!REGIONS[regionId]) return redirect(res, "/scrape?hiba=Ismeretlen%20régió");
    const cap = form.get("cap") ? Number(form.get("cap")) : undefined;
    const err = startScrapeJob(regionId, cap);
    return redirect(res, err ? `/scrape?hiba=${encodeURIComponent(err)}` : "/scrape");
  }
  // GET /map — everything scraped so far on one map (coverage + blank spots).
  if (method === "GET" && path === "/scrape/map") {
    return send(res, 200, mapPage(await listLeadsForMap(), await listRegions()));
  }
  // GET /regions — scrape-area admin (define WHERE we hunt).
  if (method === "GET" && path === "/scrape/regions") {
    return send(res, 200, regionsPage(await listRegions(), url.searchParams.get("ok") ?? undefined));
  }
  // POST /regions — create or update an area (id = stable slug; runs reference it).
  if (method === "POST" && path === "/scrape/regions") {
    const form = await readBody(req);
    const num = (k: string) => Number(String(form.get(k) ?? "").replace(",", "."));
    const id = (form.get("id") ?? "").trim().toLowerCase();
    const label = (form.get("label") ?? "").trim();
    const centerLat = num("centerLat"), centerLon = num("centerLon"), radiusKm = num("radiusKm");
    const valid =
      /^[a-z0-9-]+$/.test(id) && label &&
      [centerLat, centerLon, radiusKm].every(Number.isFinite) &&
      Math.abs(centerLat) <= 90 && Math.abs(centerLon) <= 180 &&
      radiusKm > 0 && radiusKm <= 100; // cap: a huge radius means a huge API bill
    if (!valid) return redirect(res, "/scrape/regions?ok=Hib%C3%A1s%20adatok%20%E2%80%94%20nem%20mentettem");
    await saveRegion({ id, label, centerLat, centerLon, radiusKm, active: form.get("active") === "on" });
    await loadRegions(true); // the launcher offers it immediately
    return redirect(res, "/scrape/regions?ok=Ter%C3%BClet%20mentve");
  }
  // POST /regions/:id/deactivate — retire an area (kept for history).
  const regOffMatch = /^\/scrape\/regions\/([a-z0-9-]+)\/deactivate$/.exec(path);
  if (method === "POST" && regOffMatch) {
    await deactivateRegion(regOffMatch[1]!);
    await loadRegions(true);
    return redirect(res, "/scrape/regions?ok=Ter%C3%BClet%20kivonva");
  }
  // GET /report — pilot funnel report (H1–H5 + segment breakdown).
  if (method === "GET" && path === "/report") {
    return send(res, 200, reportPage(await getFunnelReport()));
  }
  // GET /lead/:id
  const leadMatch = /^\/lead\/([0-9a-f-]{36})$/i.exec(path);
  if (method === "GET" && leadMatch) {
    const d = await getLead(leadMatch[1]);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen lead.</p>"));
    const conversion = await getConversion(leadMatch[1]);
    const orders = await getOrderIntents(leadMatch[1]);
    const payments = await getPayments(leadMatch[1]);
    const prospects = await getProspects(leadMatch[1]);
    const flashMsg = url.searchParams.get("flash");
    return send(
      res,
      200,
      leadPage(d, generating.has(leadMatch[1]), conversion, orders, payments, prospects,
        flashMsg
          ? { message: flashMsg, ok: url.searchParams.get("flashKind") !== "bad" }
          : null),
    );
  }
  // POST /lead/:id/generate — fire-and-forget; generation runs ~1-2 min in the
  // background, the lead page polls. Redirect immediately (no 2-min hang).
  const genMatch = /^\/lead\/([0-9a-f-]{36})\/generate$/i.exec(path);
  if (method === "POST" && genMatch) {
    const id = genMatch[1];
    if (!generating.has(id)) {
      // ADR-0027: the CURATOR picks the art template(s) + may steer the voice with a free-text
      // prompt (the §B.17 fact contract still governs downstream). The picker is multi-select:
      // each chosen template yields its OWN mock (distinct file + artifact row). Unknown/empty
      // selection → a single default-template mock.
      const form = await readBody(req);
      const templates = [...new Set(form.getAll("template").map((t) => t.trim()))].filter(
        (t) => t && TEMPLATES[t],
      );
      const curatorPrompt = form.get("curatorPrompt")?.trim().slice(0, 600) || undefined;
      const picks: (string | undefined)[] = templates.length ? templates : [undefined];
      generating.add(id);
      void loadLead(id)
        .then((loaded) =>
          // One mock per picked template; allSettled so one failure does not sink the rest.
          Promise.allSettled(
            picks.map((template) =>
              generateEngineMock(loaded, undefined, {
                ...(template ? { template } : {}),
                ...(curatorPrompt ? { curatorPrompt } : {}),
              }),
            ),
          ).then((results) => {
            for (const r of results)
              if (r.status === "rejected")
                console.error(`[console] generate ${id} hiba:`, r.reason);
          }),
        )
        .catch((err) => console.error(`[console] generate ${id} hiba:`, err))
        .finally(() => generating.delete(id));
    }
    return redirect(res, `/lead/${id}`);
  }
  // POST /lead/:id/data — curator edits lead contact/reachability (ADR-0029): add missing
  // OR correct existing (phone/email/website/address/name). Saved onto raw → next generation.
  const dataMatch = /^\/lead\/([0-9a-f-]{36})\/data$/i.exec(path);
  if (method === "POST" && dataMatch) {
    const form = await readBody(req);
    await saveLeadEdits(
      dataMatch[1],
      {
        name: form.get("name") ?? undefined,
        phone: form.get("phone") ?? undefined,
        email: form.get("email") ?? undefined,
        website: form.get("website") ?? undefined,
        address: form.get("address") ?? undefined,
        country: form.get("country") ?? undefined,
        city: form.get("city") ?? undefined,
      },
      new Date(),
    );
    return redirect(res, `/lead/${dataMatch[1]}`);
  }
  // POST /lead/:id/reenrich — re-run the enrichment chain for THIS lead (rotted
  // website link, corrected city, a source that went live since the scrape).
  // Synchronous: it is a handful of HTTP calls for one lead, and the operator
  // wants the verdict on the page they are looking at, not a background job.
  const reenrichMatch = /^\/lead\/([0-9a-f-]{36})\/reenrich$/i.exec(path);
  if (method === "POST" && reenrichMatch) {
    const result = await reenrichOne(reenrichMatch[1]);
    return redirect(
      res,
      `/lead/${reenrichMatch[1]}?flash=${encodeURIComponent(result.message)}` +
        `&flashKind=${result.ok ? "ok" : "bad"}#ls-data`,
    );
  }
  // POST /lead/:id/rescrape-photos — re-pull ONLY the portal photo strip (and
  // its material count) for THIS lead. Separate from reenrich because the portal
  // read is the slow pass the general reenrich skips; the operator triggers it
  // from the Fotók panel where the photos are shown. Synchronous, like reenrich.
  const rescrapeMatch = /^\/lead\/([0-9a-f-]{36})\/rescrape-photos$/i.exec(path);
  if (method === "POST" && rescrapeMatch) {
    const result = await rescrapePhotos(rescrapeMatch[1]);
    return redirect(
      res,
      `/lead/${rescrapeMatch[1]}?flash=${encodeURIComponent(result.message)}` +
        `&flashKind=${result.ok ? "ok" : "bad"}#ls-photos`,
    );
  }
  // POST /artifact/:id/curate
  const curMatch = /^\/artifact\/([0-9a-f-]{36})\/curate$/i.exec(path);
  if (method === "POST" && curMatch) {
    const form = await readBody(req);
    const decision = form.get("decision");
    if (decision === "approve" || decision === "reject") {
      await curateArtifact(curMatch[1], decision, form.get("notes") ?? undefined);
    }
    // Land back at the artifacts section (not the page top) so curating a mock keeps the
    // curator's place. Strip any existing fragment off the referer before anchoring.
    const back = (req.headers.referer ?? "/").replace(/#.*$/, "");
    return redirect(res, `${back}#mock-artifacts`);
  }
  // POST /artifact/:id/recopy — regenerate ONLY the wording of an existing mock, with an
  // optional curator instruction. The template/skin/photos/layout are untouched (that is
  // the whole point: the operator liked the look and wants different words). Fire-and-
  // forget like the full generate — one AI call plus the guards takes ~30-60s.
  const recopyMatch = /^\/artifact\/([0-9a-f-]{36})\/recopy$/i.exec(path);
  if (method === "POST" && recopyMatch) {
    const id = recopyMatch[1]!;
    const form = await readBody(req);
    const prompt = form.get("recopyPrompt")?.trim().slice(0, 600) || undefined;
    if (!recopying.has(id)) {
      recopying.add(id);
      void recopyArtifact(id, prompt)
        .then((r) => console.log(`[console] recopy ${id}: ${r.message}`))
        .catch((err) => console.error(`[console] recopy ${id} hiba:`, err))
        .finally(() => recopying.delete(id));
    }
    const back = (req.headers.referer ?? "/").replace(/#.*$/, "");
    return redirect(res, `${back}#ls-mocks`);
  }
  // POST /artifact/:id/delete — remove an approved-but-not-yet-sent mock (house-side
  // cleanup). Guarded server-side by deleteArtifact (a sent/converted mock is a no-op).
  const delMatch = /^\/artifact\/([0-9a-f-]{36})\/delete$/i.exec(path);
  if (method === "POST" && delMatch) {
    await deleteArtifact(delMatch[1]);
    const back = (req.headers.referer ?? "/").replace(/#.*$/, "");
    return redirect(res, `${back}#mock-artifacts`);
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
  // GET /configure/:artifactId/domains — custom-domain suggestions with a
  // preliminary availability check (ADR-0020; cheap DNS+RDAP layer, no key).
  const cfgDomMatch = /^\/configure\/([0-9a-f-]{36})\/domains$/i.exec(path);
  if (method === "GET" && cfgDomMatch) {
    const a = await db
      .selectFrom("mock_artifact")
      .innerJoin("lead", "lead.id", "mock_artifact.lead_id")
      .select("lead.name as leadName")
      .where("mock_artifact.id", "=", cfgDomMatch[1])
      .executeTakeFirst();
    if (!a) return send(res, 404, JSON.stringify({ suggestions: [] }), "application/json");
    const suggestions = await suggestWithAvailability(a.leadName);
    return send(res, 200, JSON.stringify({ suggestions }), "application/json");
  }
  // GET /configure/:artifactId/subdomain?label=... — preliminary availability of a buyer-chosen
  // platform subdomain label (ADR-0032). Returns { ok, normalized, reason }.
  const cfgSubMatch = /^\/configure\/([0-9a-f-]{36})\/subdomain$/i.exec(path);
  if (method === "GET" && cfgSubMatch) {
    const label = url.searchParams.get("label") ?? "";
    const r = await checkSubdomainAvailable(label);
    return send(res, 200, JSON.stringify({ ...r, host: r.normalized ? `${r.normalized}.citoviso.com` : "" }), "application/json");
  }
  // GET /configure/:artifactId/domain-check?name=... — preliminary availability of a
  // domain the buyer TYPED (when none of our suggestions appeals). Same cheap DNS+RDAP
  // layer as the suggestions, so the verdict carries the same "preliminary" caveat.
  const cfgDomCheckMatch = /^\/configure\/([0-9a-f-]{36})\/domain-check$/i.exec(path);
  if (method === "GET" && cfgDomCheckMatch) {
    const norm = normalizeCustomDomain(url.searchParams.get("name") ?? "");
    if (!norm.ok) {
      return send(res, 200, JSON.stringify({ ok: false, reason: norm.reason }), "application/json");
    }
    const availability = await checkAvailability(norm.domain!);
    return send(
      res,
      200,
      JSON.stringify({ ok: true, domain: norm.domain, availability }),
      "application/json",
    );
  }
  // POST /configure/:artifactId/request — the prospect's chosen package
  // (untracked route; the tracked twin is /p/:token/request).
  const cfgReqMatch = /^\/configure\/([0-9a-f-]{36})\/request$/i.exec(path);
  if (method === "POST" && cfgReqMatch) {
    return handleOrderRequest(req, res, cfgReqMatch[1]);
  }

  // GDPR Art. 13/14 privacy notice (linked from the outreach mail + the /p/
  // tracking footer; §C.2 + §H.22 deterministic legal text). /adatvedelem is the
  // canonical path; /privacy stays a live alias for already-sent outreach mails.
  if (method === "GET" && (path === "/adatvedelem" || path === "/privacy")) {
    return send(res, 200, privacyPage(config.outreachSender));
  }
  // The rest of the legal layer (ADR-0056). These are served HERE as well as on
  // the public site because the checkout lives on the console: `config.termsUrl`
  // resolves to a relative /aszf, and the prospect opens it from /configure/.
  if (method === "GET" && path === "/impresszum") return send(res, 200, impresszumPage());
  if (method === "GET" && path === "/aszf") return send(res, 200, aszfPage());
  if (method === "GET" && path === "/elallas") return send(res, 200, elallasPage());
  if (method === "GET" && path === "/adatfeldolgozas") {
    return send(res, 200, adatfeldolgozasPage());
  }

  // ── /p/<token> — the TRACKED outreach link (PILOT.md §2.5 + §3). ──────────────
  // GET/POST /p/:token/unsubscribe — GDPR/Grt. opt-out (must precede the page
  // route). POST serves RFC 8058 one-click unsubscribe (List-Unsubscribe-Post):
  // mailbox providers POST with no body and expect a 2xx, no page needed.
  // /p/<slug>/<token> → /p/<token>, so every route below and every link already
  // sent in the bare-token shape match unchanged (see prospectPath.ts for why).
  const pPath = normalizeProspectPath(path);

  const unsubMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/unsubscribe$/.exec(pPath);
  if ((method === "GET" || method === "POST") && unsubMatch) {
    await unsubscribeProspect(unsubMatch[1]);
    if (method === "POST") return send(res, 200, "OK", "text/plain; charset=utf-8");
    return send(res, 200, unsubscribedPage());
  }
  // POST /p/:token/event — engagement/configurator event beacon.
  const pEventMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/event$/.exec(pPath);
  if (method === "POST" && pEventMatch) {
    const p = await getProspectByToken(pEventMatch[1]);
    if (!p || p.unsubscribed) return send(res, 204, "");
    const body = (await readJson(req)) as {
      viewId?: unknown;
      type?: unknown;
      payload?: unknown;
    };
    const viewId = typeof body.viewId === "string" ? body.viewId : null;
    const type =
      typeof body.type === "string" ? body.type.slice(0, 40).replace(/[^a-z0-9_]/g, "") : null;
    if (viewId && type && /^[0-9a-f-]{36}$/i.test(viewId)) {
      const payload =
        body.payload && typeof body.payload === "object"
          ? (body.payload as Record<string, unknown>)
          : {};
      await recordEvent(p.id, viewId, type, payload);
    }
    return send(res, 204, "");
  }
  // POST /p/:token/request — order submit bound to the token's prospect.
  const pReqMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/request$/.exec(pPath);
  if (method === "POST" && pReqMatch) {
    const p = await getProspectByToken(pReqMatch[1]);
    if (!p) return send(res, 404, JSON.stringify({ ok: false }), "application/json");
    return handleOrderRequest(req, res, p.artifactId, pReqMatch[1]);
  }
  // GET /p/:token — the instrumented prospect preview: one mock_view per page
  // load (return visit = new session), configurator overlay + event beacons +
  // GDPR transparency footer. Unsubscribed → neutral page, zero tracking.
  const pMatch = /^\/p\/([A-Za-z0-9_-]{16,})$/.exec(pPath);
  if (method === "GET" && pMatch) {
    const p = await getProspectByToken(pMatch[1]);
    if (!p) return send(res, 404, layout("404", "<p>Nincs ilyen oldal.</p>"));
    if (p.unsubscribed) return send(res, 200, unsubscribedPage());
    try {
      const html = await readFile(p.artifactPath, "utf8");
      const viewId = await recordView(
        p.id,
        (req.headers["user-agent"] as string | undefined) ?? null,
        (req.headers.referer as string | undefined) ?? null,
      );
      // ADR-0088 §4: 3rd visit without a purchase mints the one-time, deadline-
      // bound decision-helper offer — BEFORE resolution, so this very view
      // already renders the decision card.
      const escalation = await ensureEscalationOffer(p.id);
      if (escalation) {
        console.log(
          `[offer] eszkalációs ajánlat (−${escalation.percent}%, ` +
            `lejárat ${escalation.expiresAt?.toISOString() ?? "?"}) · prospect ${p.id}`,
        );
      }
      const offer = await bestActiveOfferForProspect(p.id);
      // 0029: prefill the checkout from the lead + the prospect's contact address,
      // so the mandatory billing step is a confirmation rather than a form-fill.
      const pf = await db
        .selectFrom("prospect")
        .innerJoin("lead", "lead.id", "prospect.lead_id")
        .select([
          "lead.address as leadAddress",
          "lead.raw as leadRaw",
          "prospect.contact_email as contactEmail",
        ])
        .where("prospect.token", "=", pMatch[1])
        .executeTakeFirst();
      const page = await injectConfigurator(html, p.artifactId, p.leadName, {
        requestUrl: `/p/${pMatch[1]}/request`,
        track: { url: `/p/${pMatch[1]}/event`, viewId },
        ...(p.lang ? { lang: p.lang } : {}),
        billingPrefill: leadBillingPrefill(
          pf?.leadAddress ?? null,
          pf?.leadRaw,
          pf?.contactEmail ?? null,
        ),
        ...(offer
          ? {
              offer: {
                kind: offer.kind,
                percent: offer.percent,
                expiresAt: offer.expiresAt ? offer.expiresAt.toISOString() : null,
              },
            }
          : {}),
      });
      return send(res, 200, injectTrackingNotice(page, pMatch[1]));
    } catch {
      return send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
    }
  }
  // GET /lead/:id/photos — the lead's REAL photos, resolved on demand (a Places
  // lookup costs money, so it runs only when an operator opens the lead).
  const photosMatch = /^\/lead\/([0-9a-f-]{36})\/photos$/i.exec(path);
  if (method === "GET" && photosMatch) {
    try {
      const loaded = await loadLead(photosMatch[1]!);
      const media = await resolveGatedPhotos(loaded.lead);
      // The lookup we just paid for IS a source of this lead's data — record it,
      // so "Források" stops claiming OSM-only while showing Places photos.
      // Low-band matches are not attributed to the lead (A4), so not recorded.
      if (media.placeId && media.matchBand && media.matchBand !== "low") {
        await markPlacesSource(photosMatch[1]!, media.placeId).catch(() => {});
      }
      return send(
        res,
        200,
        JSON.stringify({
          // {url, provenance} per photo — the operator must be able to tell a portal
          // listing image from a Places one when judging "is this really their place?".
          photos: (media.photos ?? []).map((p) => ({ url: p.url, provenance: p.provenance })),
          rating: media.rating ?? null,
          ratingCount: media.userRatingCount ?? null,
          band: media.matchBand ?? null,
        }),
        "application/json",
      );
    } catch {
      return send(res, 200, JSON.stringify({ photos: [] }), "application/json");
    }
  }
  // POST /lead/:id/disqualify — operator rules the lead out (kept, never deleted).
  const disqMatch = /^\/lead\/([0-9a-f-]{36})\/disqualify$/i.exec(path);
  if (method === "POST" && disqMatch) {
    const form = await readBody(req);
    await disqualifyLead(disqMatch[1]!, (form.get("reason") ?? "").trim() || "nincs megadva");
    return redirect(res, `/lead/${disqMatch[1]}`);
  }
  // POST /lead/:id/requalify — undo the ruling.
  const reqMatch = /^\/lead\/([0-9a-f-]{36})\/requalify$/i.exec(path);
  if (method === "POST" && reqMatch) {
    await requalifyLead(reqMatch[1]!);
    return redirect(res, `/lead/${reqMatch[1]}`);
  }
  // POST /lead/:id/prospect — operator creates the tracked prospect (segment +
  // e-mail) for an artifact; the lead page then shows the copyable /p/ link.
  const prosMatch = /^\/lead\/([0-9a-f-]{36})\/prospect$/i.exec(path);
  if (method === "POST" && prosMatch) {
    const form = await readBody(req);
    const artifactId = form.get("artifactId");
    if (artifactId) {
      await createProspect({
        leadId: prosMatch[1],
        artifactId,
        segment: form.get("segment") ?? undefined,
        contactEmail: form.get("email")?.trim() || undefined,
      });
    }
    return redirect(res, `/lead/${prosMatch[1]}#prospects`);
  }
  // POST /prospect/:id/sent — operator marks the A2 MANUAL e-mail as actually sent
  // (copied the draft into their mail client). Channel-explicit since ADR-0082.
  const sentMatch = /^\/prospect\/([0-9a-f-]{36})\/sent$/i.exec(path);
  if (method === "POST" && sentMatch) {
    const form = await readBody(req);
    await markProspectSent(sentMatch[1], "email");
    return redirect(res, form.get("leadId") ? `/lead/${form.get("leadId")}` : "/");
  }
  // GET /prospect/:id/draft — the §C-gated outreach e-mail draft: pipeline
  // send button (PASS + contact e-mail) with the A2 manual copy as fallback.
  const draftMatch = /^\/prospect\/([0-9a-f-]{36})\/draft$/i.exec(path);
  if (method === "GET" && draftMatch) {
    const d = await buildDraftForProspect(draftMatch[1]);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen prospect.</p>"));
    const check = checkOutreachDraft(d.draft, d.input.leadName, d.lang);
    const p = await db
      .selectFrom("prospect")
      .select("contact_email")
      .where("id", "=", draftMatch[1])
      .executeTakeFirst();
    // ADR-0082: per-channel state, so a used channel says so BEFORE the click.
    const chState = await getProspectChannelState(draftMatch[1]);
    const k = url.searchParams.get("kuldes");
    const notice = k
      ? { ok: k.startsWith("ok:"), text: k.replace(/^(ok|hiba):/, "") }
      : null;
    return send(
      res,
      200,
      outreachDraftPage(
        draftMatch[1],
        d.input,
        d.draft,
        check,
        p?.contact_email ?? null,
        notice,
        {
          // ADR-0083: the mobile channel is the MMS+SMS pair — the box shows the
          // pair's companion wording, the exact text that goes out.
          sms: renderPairSmsDraft(d.input),
          phone: d.phone,
          emailSentAt: chState?.emailSentAt ?? null,
          smsSentAt: chState?.smsSentAt ?? null,
          mmsSentAt: chState?.mmsSentAt ?? null,
          pairJob: getPairJob(draftMatch[1]),
          // Say it BEFORE the click: an allowlisted-out number has a dead button.
          smsBlockedReason: (() => {
            const to = d.phone ? normalizePhone(d.phone) : null;
            return to ? smsAllowlistBlocks(to) : null;
          })(),
        },
        d.leadId,
      ),
    );
  }
  // POST /prospect/:id/contact-email — set/replace the recipient on an existing tracked link
  // (ADR-0031) so the pipeline send has a target without recreating the prospect.
  const cemailMatch = /^\/prospect\/([0-9a-f-]{36})\/contact-email$/i.exec(path);
  if (method === "POST" && cemailMatch) {
    const form = await readBody(req);
    await setProspectContactEmail(cemailMatch[1], form.get("email") ?? "");
    return redirect(res, `/prospect/${cemailMatch[1]}/draft`);
  }
  // POST /prospect/:id/send-sms — STANDALONE SMS, kept for backcompat/CLI parity;
  // the UI no longer offers it (ADR-0083: the MMS+SMS pair replaced it).
  const smsMatch = /^\/prospect\/([0-9a-f-]{36})\/send-sms$/i.exec(path);
  if (method === "POST" && smsMatch) {
    const r = await sendOutreachSms(smsMatch[1]);
    const msg = `${r.ok ? "ok" : "hiba"}:${r.ok ? r.message : `Nem küldhető — ${r.message}`}`;
    return redirect(res, `/prospect/${smsMatch[1]}/draft?kuldes=${encodeURIComponent(msg)}`);
  }
  // POST /prospect/:id/send-all — owner request (2026-08-30): ONE click starts BOTH
  // channels. The e-mail goes synchronously (fast), then the MMS+SMS pair starts as
  // a background job. The channels stay independent: one failing does not stop the
  // other, and the notice reports each outcome separately.
  const allMatch = /^\/prospect\/([0-9a-f-]{36})\/send-all$/i.exec(path);
  if (method === "POST" && allMatch) {
    const mail = await sendOutreachMail(allMatch[1]);
    const mailMsg =
      mail.outcome.kind === "sent"
        ? `kiküldve (${mail.outcome.provider})`
        : mail.outcome.kind === "flagged"
          ? `§C FLAG: ${mail.outcome.reasons.join(" · ")}`
          : mail.outcome.kind === "skipped"
            ? mail.outcome.reason
            : "dry-run";
    const pair = await startOutreachPair(allMatch[1]);
    const ok = mail.outcome.kind === "sent" && pair.ok;
    const msg = `${ok ? "ok" : "hiba"}:E-mail: ${mailMsg} · Mobil-páros: ${pair.message}`;
    return redirect(res, `/prospect/${allMatch[1]}/draft?kuldes=${encodeURIComponent(msg)}`);
  }
  // POST /prospect/:id/send-pair — start the ADR-0083 MMS+SMS pair as a background
  // job (~60–90 s real send); the draft page's timeline follows it.
  const pairMatch = /^\/prospect\/([0-9a-f-]{36})\/send-pair$/i.exec(path);
  if (method === "POST" && pairMatch) {
    const r = await startOutreachPair(pairMatch[1]);
    const msg = `${r.ok ? "ok" : "hiba"}:${r.ok ? r.message : `Nem küldhető — ${r.message}`}`;
    return redirect(res, `/prospect/${pairMatch[1]}/draft?kuldes=${encodeURIComponent(msg)}`);
  }
  // POST /prospect/:id/send-pair-sms — retry the SMS half of a BROKEN pair (the MMS
  // is out, the companion text failed). The pair's claim stays either way.
  const pairSmsMatch = /^\/prospect\/([0-9a-f-]{36})\/send-pair-sms$/i.exec(path);
  if (method === "POST" && pairSmsMatch) {
    const r = await sendPairSmsHalf(pairSmsMatch[1]);
    const msg = `${r.ok ? "ok" : "hiba"}:${r.ok ? r.message : `Nem küldhető — ${r.message}`}`;
    return redirect(res, `/prospect/${pairSmsMatch[1]}/draft?kuldes=${encodeURIComponent(msg)}`);
  }
  // GET /prospect/:id/mms-preview.jpg — the EXACT image the MMS would carry (hero
  // shot → ≤290 KB JPEG). The timeline shows it so the operator judges the real
  // artifact, not a description of it.
  const mmsPrevMatch = /^\/prospect\/([0-9a-f-]{36})\/mms-preview\.jpg$/i.exec(path);
  if (method === "GET" && mmsPrevMatch) {
    const pr = await db
      .selectFrom("prospect")
      .select("mock_artifact_id")
      .where("id", "=", mmsPrevMatch[1])
      .executeTakeFirst();
    const shot = pr?.mock_artifact_id ? await ensureHeroShot(pr.mock_artifact_id) : null;
    if (!shot) return send(res, 404, layout("404", "<p>Nincs hero-kép ehhez a prospecthez.</p>"));
    const jpeg = await ensureMmsJpeg(shot);
    const buf = await readFile(jpeg);
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length });
    res.end(buf);
    return;
  }
  // GET /prospect/:id/activity — what the lead actually DID on the /p page
  // (sessions + event timeline + derived intent signals).
  const actMatch = /^\/prospect\/([0-9a-f-]{36})\/activity$/i.exec(path);
  if (method === "GET" && actMatch) {
    const a = await getProspectActivity(actMatch[1]);
    if (!a) return send(res, 404, layout("404", "<p>Nincs ilyen prospect.</p>"));
    return send(res, 200, prospectActivityPage(a));
  }
  // GET /prospect/:id/email-preview — the EXACT HTML mail the pipeline would
  // send (operator preview; renders in FLAG state too — viewing is not sending).
  const mailPrevMatch = /^\/prospect\/([0-9a-f-]{36})\/email-preview$/i.exec(path);
  if (method === "GET" && mailPrevMatch) {
    const d = await buildDraftForProspect(mailPrevMatch[1]);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen prospect.</p>"));
    const p = await db
      .selectFrom("prospect")
      .select(["contact_email", "mock_artifact_id"])
      .where("id", "=", mailPrevMatch[1])
      .executeTakeFirst();
    const shot = p?.mock_artifact_id ? await ensureHeroShot(p.mock_artifact_id) : null;
    const msg = buildOutreachEmail(d.draft, p?.contact_email ?? "cimzett@example.com", {
      heroShotPath: shot,
    });
    // The CID-inline hero is substituted with the servable /hero.png URL for the preview.
    const html = (msg.html ?? msg.text).replaceAll(
      `cid:${HERO_CID}`,
      `/prospect/${mailPrevMatch[1]}/hero.png`,
    );
    return send(res, 200, html);
  }
  // GET /prospect/:id/hero.png — the cached hero shot for the e-mail preview.
  const heroMatch = /^\/prospect\/([0-9a-f-]{36})\/hero\.png$/i.exec(path);
  if (method === "GET" && heroMatch) {
    const p = await db
      .selectFrom("prospect")
      .select("mock_artifact_id")
      .where("id", "=", heroMatch[1])
      .executeTakeFirst();
    const shot = p?.mock_artifact_id ? await ensureHeroShot(p.mock_artifact_id) : null;
    if (!shot) return send(res, 404, "nincs hero-shot", "text/plain; charset=utf-8");
    res.writeHead(200, { "content-type": "image/png" });
    res.end(await readFile(shot));
    return;
  }
  // POST /prospect/:id/send — pipeline send (B szelet): §C gate re-runs inside
  // sendOutreachMail; Post/Redirect/Get with the outcome in the query string.
  const sendMatch = /^\/prospect\/([0-9a-f-]{36})\/send$/i.exec(path);
  if (method === "POST" && sendMatch) {
    const r = await sendOutreachMail(sendMatch[1]);
    const msg =
      r.outcome.kind === "sent"
        ? `ok:Kiküldve (${r.outcome.provider}) — ${r.to}; státusz: sent`
        : r.outcome.kind === "flagged"
          ? `hiba:§C FLAG — nem küldhető: ${r.outcome.reasons.join(" · ")}`
          : `hiba:Nem küldhető — ${r.outcome.kind === "skipped" ? r.outcome.reason : "dry-run"}`;
    return redirect(res, `/prospect/${sendMatch[1]}/draft?kuldes=${encodeURIComponent(msg)}`);
  }
  // POST /lead/:id/convert — approved mock → provisioned private preview.
  const convMatch = /^\/lead\/([0-9a-f-]{36})\/convert$/i.exec(path);
  if (method === "POST" && convMatch) {
    const id = convMatch[1];
    const form = await readBody(req);
    const artifactId = form.get("artifactId");
    if (artifactId) {
      // Modules are the OWNER's configurator choice (order intent), not an operator
      // pick; ALL-IN when they haven't configured yet. Single source of truth.
      const orders = await getOrderIntents(id);
      await convertLead(id, artifactId, modulesForConversion(orders));
    }
    return redirect(res, `/lead/${id}`);
  }
  // POST /lead/:id/request-payment — issue a pay-link for the lead's latest
  // submitted order intent (pilot: per-cycle pay-link, non-pay → deactivate).
  const reqPayMatch = /^\/lead\/([0-9a-f-]{36})\/request-payment$/i.exec(path);
  if (method === "POST" && reqPayMatch) {
    const id = reqPayMatch[1];
    const oi = await db
      .selectFrom("order_intent")
      .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
      .select("order_intent.id as id")
      .where("prospect.lead_id", "=", id)
      .where("order_intent.status", "=", "submitted")
      .orderBy("order_intent.created_at", "desc")
      .executeTakeFirst();
    if (oi) await requestPayment(oi.id);
    return redirect(res, `/lead/${id}`);
  }
  // GET /pay/done — Barion sends the buyer's browser back here (RedirectUrl)
  // with ?paymentId=<gateway ref>. The redirect itself carries NO outcome, and
  // the server-to-server callback may not have landed yet (a local dev box is
  // unreachable for it entirely) — so resolve the state through the SAME
  // idempotent webhook path (Barion adapter → GetPaymentState), then show the
  // buyer the result screen.
  if (method === "GET" && path === "/pay/done") {
    const ref = url.searchParams.get("paymentId") ?? url.searchParams.get("PaymentId") ?? "";
    if (ref) await handleWebhook({ paymentId: ref }, {});
    const p = ref
      ? await db
          .selectFrom("payment")
          .select(["status", "amount"])
          .where("gateway_ref", "=", ref)
          .executeTakeFirst()
      : undefined;
    if (!p) return send(res, 404, layout("404", "<p>Nincs ilyen fizetés.</p>"));
    if (p.status === "pending") return send(res, 200, payPendingPage());
    const paid = p.status === "paid";
    // ⛔ A MULTILANG purchase is NOT an activation (measured defect, 2026-08-28):
    // the buyer already HAS a live site and login, so the generic "your site is
    // live, here are your credentials" page was both wrong and confusing. What
    // they need to know is: the charge went through, the translation is running,
    // and where the language versions will appear.
    const kindRow = await db
      .selectFrom("payment")
      .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
      .select(["order_intent.kind as kind", "order_intent.tenant_id as tenantId"])
      .where("payment.gateway_ref", "=", ref)
      .executeTakeFirst();
    if (paid && kindRow?.kind === "multilang" && kindRow.tenantId) {
      return send(res, 200, await multilangPayResultPage(kindRow.tenantId, p.amount));
    }
    const summary = paid ? await getActivationSummary(ref) : null;
    // "Activated" for the buyer = credentials/site exist (webhook may have run
    // earlier, so handleWebhook's own flag can be a stale false here).
    const activated = Boolean(summary?.siteUrl ?? summary?.username);
    // The tenant login lives on the PUBLIC server; this page is served by the
    // console, so the URL must be absolute or the buyer lands on OUR sign-in.
    return send(
      res,
      200,
      payResultPage(paid, activated, {
        ...summary,
        amount: p.amount,
        loginUrl: `${config.publicSiteUrl.replace(/\/+$/, "")}/login`,
      }),
    );
  }
  // GET /pay/mock/:ref — the MOCK hosted pay page (Fizetek / Elutasítom).
  const mockPayMatch = /^\/pay\/mock\/(mock_[0-9a-f-]+)$/i.exec(path);
  if (method === "GET" && mockPayMatch) {
    const p = await db
      .selectFrom("payment")
      .select(["amount", "period", "status"])
      .where("gateway_ref", "=", mockPayMatch[1])
      .executeTakeFirst();
    if (!p) return send(res, 404, layout("404", "<p>Nincs ilyen fizetés.</p>"));
    return send(res, 200, payMockPage(mockPayMatch[1], p.amount, p.period, p.status));
  }
  // POST /pay/mock/:ref/(paid|failed) — the mock pay page's buttons drive the
  // same webhook path the real gateway will (constructs the webhook body).
  const mockPayDoMatch = /^\/pay\/mock\/(mock_[0-9a-f-]+)\/(paid|failed)$/i.exec(path);
  if (method === "POST" && mockPayDoMatch) {
    const r = await handleWebhook(
      { gatewayRef: mockPayDoMatch[1], status: mockPayDoMatch[2] },
      {},
    );
    const paid = mockPayDoMatch[2] === "paid";
    // Tell the buyer what actually happened: their live URL + how to sign in.
    const summary = paid ? await getActivationSummary(mockPayDoMatch[1]) : null;
    return send(
      res,
      200,
      payResultPage(paid, r.activated ?? false, summary ?? undefined),
    );
  }
  // POST /pay/webhook/:gateway — JSON webhook endpoint (real gateway / tests).
  const webhookMatch = /^\/pay\/webhook\/[a-z]+$/i.exec(path);
  if (method === "POST" && webhookMatch) {
    const params = await readWebhookParams(req, url);
    const r = await handleWebhook(
      params,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return send(res, r.ok ? 200 : 400, JSON.stringify(r), "application/json");
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

// Exported so scripts/ui-shot.mts can boot this server on an ephemeral port
// (CONSOLE_PORT=0) and read the assigned port back for screenshotting.
export const server = http.createServer((req, res) => {
  // ADR-0067 ③: every request runs inside its OWN language context. It starts as
  // Hungarian, and currentOperator() fills in the operator's language the moment
  // the session is read — so no route can forget to pass it on, and two operators
  // with different languages cannot interfere.
  runWithConsoleLang(() =>
    handle(req, res).catch((err) => {
      console.error(err);
      send(res, 500, layout("500", `<p>Hiba: ${(err as Error).message}</p>`));
    }),
  );
});

server.listen(PORT, () => {
  console.log(`Citoviso operátor-konzol → http://localhost:${PORT}`);
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
      console.log(`[i18n] csomag ${r.lang}: ${r.total - r.missing}/${r.total}${r.ok ? "" : " ⛔ HIÁNYOS"}`);
    }
    if (!rows.length) console.log("[i18n] nincs nem-magyar nyelvterület — csomag-ellenőrzés kész");
  })().catch((e) => console.error(`[i18n] boot-ellenőrzés hiba: ${(e as Error).message}`));
}
