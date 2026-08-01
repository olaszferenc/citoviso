// Operator console — the web layer (ADR-0003: built-in node:http, no framework).
// A tiny hand-rolled router over the console data/views + the generator service.
// Long-running: it does NOT close the shared pool. Post/Redirect/Get for mutations.

import { readFile } from "node:fs/promises";
import http from "node:http";
import { generateEngineMock } from "../generator/generateEngine.js";
import { loadLead } from "../generator/persist.js";
import {
  createProspect,
  curateArtifact,
  getConversion,
  getLead,
  getOrderIntents,
  getPayments,
  getProspectByToken,
  getProspects,
  getSiteByToken,
  getTenantAdminByToken,
  listLeads,
  markProspectSent,
  recordEvent,
  recordOrderIntent,
  recordView,
  unsubscribeProspect,
  type LeadQuery,
} from "./data.js";
import { handleWebhook, requestPayment } from "../payment/service.js";
import { payMockPage, payResultPage } from "./views.js";
import { convertLead } from "../conversion/provision.js";
import { injectConfigurator } from "../generator/configurator.js";
import { CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS, suggestWithAvailability } from "../domains.js";
import { computeAnnual, computeMonthly, MODULE_CATALOG } from "../modules.js";
import { buildDraftForProspect } from "../outreach/draft.js";
import { checkOutreachDraft } from "../outreach/outreachCheck.js";
import { sendOutreachMail } from "../outreach/sendBatch.js";
import { buildOutreachEmail, HERO_CID } from "../email/outreachEmail.js";
import { ensureHeroShot } from "../outreach/heroShot.js";
import { outreachDraftPage, privacyPage } from "./views.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { layout, leadPage, leadsPage, tenantAdminPage, scrapePage, reportPage } from "./views.js";
import { dashboardPage, operatorLoginPage, operatorLoginHelpPage, settingsPage } from "./views.js";
import { getScrapeJob, startScrapeJob } from "./scrapeJob.js";
import { getFunnelReport, getScrapeRuns } from "./data.js";
import { REGIONS } from "../scraper/regions.js";
import {
  authenticateOperator,
  changeOperatorPassword,
  clearOperatorSession,
  currentOperator,
  readOperatorSession,
  setOperatorSession,
} from "../auth/operatorAuth.js";
import path_mod from "node:path";

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
    .select(["mock_artifact.path as path", "lead.name as leadName"])
    .where("mock_artifact.id", "=", artifactId)
    .executeTakeFirst();
  if (!a?.path) return send(res, 404, layout("404", "<p>Nincs ilyen mock.</p>"));
  try {
    const html = await readFile(a.path, "utf8");
    send(res, 200, await injectConfigurator(html, artifactId, a.leadName));
  } catch {
    send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
  }
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
  };
  const catalogIds = new Set(MODULE_CATALOG.map((m) => m.id));
  const modules = Array.isArray(body.modules)
    ? body.modules.filter((m): m is string => typeof m === "string" && catalogIds.has(m))
    : [];
  const billingPeriod = body.billing_period === "annual" ? "annual" : "monthly";
  // SECURITY (guard-agent finding, 2026-08-01): the charged price is computed
  // SERVER-side from the ONE pricing source (modules.ts) — the client figure is
  // display-only; a mismatch is logged as a tamper/price-drift signal.
  const clientPrice = typeof body.price === "number" ? Math.round(body.price) : null;
  const price = billingPeriod === "annual" ? computeAnnual(modules) : computeMonthly(modules);
  if (clientPrice !== null && clientPrice !== price) {
    console.warn(
      `[console] ÁR-ELTÉRÉS az order-submitnél: kliens ${clientPrice} ≠ szerver ${price} ` +
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
  const commitmentMonths =
    domainType === "citoviso_registered" ? CUSTOM_DOMAIN_MIN_COMMITMENT_MONTHS : null;
  const rec = await recordOrderIntent({
    artifactId,
    modules,
    billingPeriod,
    price,
    domainType,
    domainName,
    commitmentMonths,
    ...(prospectToken ? { prospectToken } : {}),
  });
  console.log(
    `[console] CSOMAG-IGÉNY · ${rec?.leadName ?? "?"} (lead ${rec?.leadId ?? "?"}) · ` +
      `${price ?? "?"} Ft/${billingPeriod === "annual" ? "év" : "hó"} · modulok: ${modules.join(", ") || "—"} · ` +
      `domain: ${domainType}${domainName ? ` (${domainName})` : ""}${commitmentMonths ? ` · ${commitmentMonths} hó elköteleződés` : ""}` +
      (prospectToken ? " · követett link" : ""),
  );
  send(res, 200, JSON.stringify({ ok: true }), "application/json");
}

/**
 * GDPR/Grt. transparency footer for the TRACKED prospect page (PILOT.md §6):
 * a discreet, honest notice that viewing data is recorded (legitimate-interest
 * B2B outreach) + a working unsubscribe link. Injected before </body>.
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

  // ── AUTH GATE: everything is operator-only EXCEPT the prospect/tenant/payment
  // surfaces that outsiders must reach by design. Network trust (Tailscale) is
  // NOT the auth model — this console must survive public hosting.
  const isPublicPath =
    path.startsWith("/p/") || // tracked outreach links (prospect)
    path.startsWith("/pay/") || // pay pages + gateway webhook
    path.startsWith("/configure/") || // prospect configurator + order submit
    path.startsWith("/site/") || // provisioned site preview (token)
    path.startsWith("/admin/") || // tenant token page (data plane)
    path === "/privacy";
  if (!isPublicPath && !readOperatorSession(req)) {
    return redirect(res, "/login");
  }

  // GET / — Vezérlőpult (dashboard).
  if (method === "GET" && path === "/") {
    const op = await currentOperator(req);
    return send(
      res,
      200,
      dashboardPage(await getFunnelReport(), getScrapeJob().running, op?.displayName ?? "operátor"),
    );
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
  // GET /leads (with optional filter/sort query params)
  if (method === "GET" && path === "/leads") {
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
  // GET /scrape — launcher + live log + run history (PILOT.md §7d ①).
  if (method === "GET" && path === "/scrape") {
    const regions = Object.values(REGIONS).map((r) => ({ id: r.id, label: r.label }));
    const notice = url.searchParams.get("hiba");
    return send(res, 200, scrapePage(getScrapeJob(), await getScrapeRuns(), regions, notice));
  }
  // POST /scrape/start — spawn the existing CLI as a child process (one at a time).
  if (method === "POST" && path === "/scrape/start") {
    const form = await readBody(req);
    const regionId = form.get("region") ?? "";
    if (!REGIONS[regionId]) return redirect(res, "/scrape?hiba=Ismeretlen%20régió");
    const cap = form.get("cap") ? Number(form.get("cap")) : undefined;
    const err = startScrapeJob(regionId, cap);
    return redirect(res, err ? `/scrape?hiba=${encodeURIComponent(err)}` : "/scrape");
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
    return send(
      res,
      200,
      leadPage(d, generating.has(leadMatch[1]), conversion, orders, payments, prospects),
    );
  }
  // POST /lead/:id/generate — fire-and-forget; generation runs ~1-2 min in the
  // background, the lead page polls. Redirect immediately (no 2-min hang).
  const genMatch = /^\/lead\/([0-9a-f-]{36})\/generate$/i.exec(path);
  if (method === "POST" && genMatch) {
    const id = genMatch[1];
    if (!generating.has(id)) {
      generating.add(id);
      void loadLead(id)
        .then((loaded) => generateEngineMock(loaded))
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
  // POST /configure/:artifactId/request — the prospect's chosen package
  // (untracked route; the tracked twin is /p/:token/request).
  const cfgReqMatch = /^\/configure\/([0-9a-f-]{36})\/request$/i.exec(path);
  if (method === "POST" && cfgReqMatch) {
    return handleOrderRequest(req, res, cfgReqMatch[1]);
  }

  // GET /privacy — GDPR Art. 13/14 privacy notice (linked from the outreach
  // mail + the /p/ tracking footer; §C.2 + §H.22 deterministic legal text).
  if (method === "GET" && path === "/privacy") {
    return send(res, 200, privacyPage(config.outreachSender));
  }

  // ── /p/<token> — the TRACKED outreach link (PILOT.md §2.5 + §3). ──────────────
  // GET/POST /p/:token/unsubscribe — GDPR/Grt. opt-out (must precede the page
  // route). POST serves RFC 8058 one-click unsubscribe (List-Unsubscribe-Post):
  // mailbox providers POST with no body and expect a 2xx, no page needed.
  const unsubMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/unsubscribe$/.exec(path);
  if ((method === "GET" || method === "POST") && unsubMatch) {
    await unsubscribeProspect(unsubMatch[1]);
    if (method === "POST") return send(res, 200, "OK", "text/plain; charset=utf-8");
    return send(res, 200, unsubscribedPage());
  }
  // POST /p/:token/event — engagement/configurator event beacon.
  const pEventMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/event$/.exec(path);
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
  const pReqMatch = /^\/p\/([A-Za-z0-9_-]{16,})\/request$/.exec(path);
  if (method === "POST" && pReqMatch) {
    const p = await getProspectByToken(pReqMatch[1]);
    if (!p) return send(res, 404, JSON.stringify({ ok: false }), "application/json");
    return handleOrderRequest(req, res, p.artifactId, pReqMatch[1]);
  }
  // GET /p/:token — the instrumented prospect preview: one mock_view per page
  // load (return visit = new session), configurator overlay + event beacons +
  // GDPR transparency footer. Unsubscribed → neutral page, zero tracking.
  const pMatch = /^\/p\/([A-Za-z0-9_-]{16,})$/.exec(path);
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
      const page = await injectConfigurator(html, p.artifactId, p.leadName, {
        requestUrl: `/p/${pMatch[1]}/request`,
        track: { url: `/p/${pMatch[1]}/event`, viewId },
      });
      return send(res, 200, injectTrackingNotice(page, pMatch[1]));
    } catch {
      return send(res, 404, layout("404", "<p>A mock fájl nem található a lemezen.</p>"));
    }
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
    return redirect(res, `/lead/${prosMatch[1]}`);
  }
  // POST /prospect/:id/sent — operator marks the outreach as actually sent.
  const sentMatch = /^\/prospect\/([0-9a-f-]{36})\/sent$/i.exec(path);
  if (method === "POST" && sentMatch) {
    const form = await readBody(req);
    await markProspectSent(sentMatch[1]);
    return redirect(res, form.get("leadId") ? `/lead/${form.get("leadId")}` : "/");
  }
  // GET /prospect/:id/draft — the §C-gated outreach e-mail draft: pipeline
  // send button (PASS + contact e-mail) with the A2 manual copy as fallback.
  const draftMatch = /^\/prospect\/([0-9a-f-]{36})\/draft$/i.exec(path);
  if (method === "GET" && draftMatch) {
    const d = await buildDraftForProspect(draftMatch[1]);
    if (!d) return send(res, 404, layout("404", "<p>Nincs ilyen prospect.</p>"));
    const check = checkOutreachDraft(d.draft, d.input.leadName);
    const p = await db
      .selectFrom("prospect")
      .select("contact_email")
      .where("id", "=", draftMatch[1])
      .executeTakeFirst();
    const k = url.searchParams.get("kuldes");
    const notice = k
      ? { ok: k.startsWith("ok:"), text: k.replace(/^(ok|hiba):/, "") }
      : null;
    return send(
      res,
      200,
      outreachDraftPage(draftMatch[1], d.input, d.draft, check, p?.contact_email ?? null, notice),
    );
  }
  // GET /prospect/:id/email-preview — the EXACT HTML mail the pipeline would
  // send (operator preview; renders in FLAG state too — viewing is not sending).
  // The CID-inline hero image is substituted with the servable /hero.png URL.
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
      await convertLead(id, artifactId, form.getAll("module"));
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
    return send(res, 200, payResultPage(mockPayDoMatch[2] === "paid", r.activated ?? false));
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

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    send(res, 500, layout("500", `<p>Hiba: ${(err as Error).message}</p>`));
  });
});

server.listen(PORT, () => {
  console.log(`Citoviso operátor-konzol → http://localhost:${PORT}`);
});
