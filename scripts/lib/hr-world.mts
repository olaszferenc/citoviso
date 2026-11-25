// ORSZÁG-RÉTEG 3/10 — A HORVÁT TESZTVILÁG (scratch DB), egy helyen: a 3/10 regressziós e2e-je
// (scripts/country-hr-fix-e2e.mts) és Elek ismétlése (elek/runs/…/serve.mts) ugyanezt építi fel.
//
// What it builds, in a SCRATCH database only (never the shared dev DB, never production):
//   · migrations, the HR row of 0142 as migrated, Bábel's real hr packs;
//   · the 'hr' test price sheet (scripts/lib/hr-open-fixture.mts — HUF converted, scratch only);
//   · the owner's approval of HR (market row);
//   · a HR lead (Makarska) with a real engine mock (no AI: curator copy in Croatian), approved;
//   · a prospect and the cold letter SENT through the real send path (sendOutreachMail, mock
//     e-mail transport → outbox/) — so the intro offer is stamped exactly as in production
//     (Elek HR 2nd round: the letter was only rendered, no offer row → „no −25 % at the order”);
//   · the console and the public server in-process, and (optional) a one-port front that
//     routes like deploy/nginx/citoviso.conf (/p/ /configure/ /pay/ /privacy /mock/ /site/ →
//     console, the rest → public), so every link of a letter points at the test world.
//
// ⛔ The caller sets nothing: env (mock providers, ELEK_RUN, ports, PUBLIC_*_URL) is set HERE,
// before the first import that reads config. Nothing leaves the machine (fetch fence).

import pg from "pg";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./scratch-db.mts";

export interface HrWorldOptions {
  /** Scratch DB base name (a worktree/pid suffix is added). */
  readonly base: string;
  /** Fixed ports (Elek) or 0 = ephemeral (e2e). */
  readonly consolePort?: number;
  readonly publicPort?: number;
  /** One-port nginx-like front; omitted = none. */
  readonly frontPort?: number;
  /**
   * HR végpróba: "barion-test" = the REAL Barion gateway against the SANDBOX (api/secure.test.barion.com,
   * the dev .env's test shop); the fetch fence then lets exactly those two hosts through. Refuses to
   * run when the .env points anywhere else. The wallet is whatever BARION_WALLET_CURRENCIES says in the
   * caller's env (unset = the production default: forint only). Omitted = the mock gateway.
   */
  readonly payment?: "mock" | "barion-test";
  /**
   * "szamlazz-test" = the real Számlázz.hu adapter with the dev .env's TEST (OV) Agent key — the key guard
   * (src/invoicing/keyGuard.ts) refuses any other key in dev — and the fence lets www.szamlazz.hu through.
   * A real TEST-account invoice is made (OV- prefix, no NAV report). Omitted = the mock invoicer.
   */
  readonly invoice?: "mock" | "szamlazz-test";
}

/** The dev .env's Számlázz.hu TEST Agent key (the key guard decides whether it may serve). */
function szamlazzTestKey(repo: string): string {
  for (const line of readFileSync(path.resolve(repo, ".env"), "utf8").split("\n")) {
    const m = /^SZAMLAZZ_AGENT_KEY=(.*)$/.exec(line.trim());
    if (m && m[1]) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("hr-world: a Számlázz-TESZT módhoz a dev .env SZAMLAZZ_AGENT_KEY-e kell");
}

/** The dev .env's Barion sandbox settings — only when they really point at the test hosts. */
function barionSandboxEnv(repo: string): Record<string, string> {
  // BARION_SANDBOX_ENV_FILE: a separate sandbox shop's settings (same four keys, a 600 file outside the
  // repo) — e.g. the EUR-wallet test shop (2026-11-25): the shared dev .env's shop has no euro account,
  // and that shared file is not changed for one run. The same sandbox-only check applies to it.
  const file = process.env.BARION_SANDBOX_ENV_FILE ? path.resolve(process.env.BARION_SANDBOX_ENV_FILE) : path.resolve(repo, ".env");
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^(BARION_(?:POSKEY|PAYEE|URL|PAY_URL))=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  if (out.BARION_URL !== "https://api.test.barion.com" || out.BARION_PAY_URL !== "https://secure.test.barion.com" || !out.BARION_POSKEY) {
    throw new Error("hr-world: a Barion-TESZT mód csak a sandboxra mutató .env-vel indul (api.test.barion.com + secure.test.barion.com + POSKey)");
  }
  return out;
}

export interface HrWorld {
  readonly scratch: string;
  readonly origin: string;
  readonly frontOrigin: string | null;
  readonly consoleOrigin: string;
  readonly publicOrigin: string;
  readonly leadId: string;
  readonly prospectId: string;
  readonly token: string;
  readonly mockPath: string;
  readonly letterPath: string | null;
  /** 3/10: the personal letter for this lead, rendered (not sent). */
  readonly personalLetterPath: string | null;
  readonly opCookie: string;
  close(): Promise<void>;
}

const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}

/** Run `fn` with a frozen wall clock (no-arg Date / Date.now only), then restore it. */
async function atClock<T>(at: Date, fn: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixed = at.getTime();
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number | Date]));
    }
    static now(): number {
      return fixed;
    }
  }
  globalThis.Date = FrozenDate as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

const CONSOLE_PREFIXES = ["/p/", "/configure/", "/pay/", "/privacy", "/mock/", "/site/"];

export async function buildHrWorld(o: HrWorldOptions): Promise<HrWorld> {
  const REPO = process.cwd();
  const cport = o.consolePort ?? 0;
  const pport = o.publicPort ?? 0;
  const front = o.frontPort ?? null;
  // Letters carry the public https origin (the §C gate refuses a private-IP / http link — rightly);
  // a tester replaces it with the front's http://127.0.0.1:<front> (frontOrigin).
  const origin = "https://citoviso.test";

  process.env.EMAIL_PROVIDER = "mock";
  process.env.SMS_PROVIDER = "mock";
  process.env.MMS_PROVIDER = "mock";
  process.env.INVOICE_PROVIDER = "mock";
  process.env.PAYMENT_GATEWAY = "mock";
  process.env.REGISTRAR_PROVIDER = "mock";
  process.env.ELEK_RUN = "1"; // ADR-0095 ④: the mail transport refuses any non-elek@ recipient
  process.env.PUBLIC_BASE_URL = origin;
  process.env.PUBLIC_SITE_URL = origin;
  process.env.I18N_BOOT_TOPUP = "0";
  process.env.CONSOLE_PORT = String(cport);
  process.env.PUBLIC_PORT = String(pport);
  process.env.EMAIL_BCC = "";
  // Since 4fd41a77 every cold letter is the owner's letter, signed with the personal sender name — without
  // one it is HELD and the world had no letter (HR dev-próba 2026-11-23). A test name, never the owner's.
  process.env.OUTREACH_FOLLOWUP_SENDER_NAME = process.env.OUTREACH_FOLLOWUP_SENDER_NAME || "Elek";
  process.env.LEGAL_ENTITY_EU_VAT_NUMBER = process.env.LEGAL_ENTITY_EU_VAT_NUMBER || "HU00000000";
  for (const k of ["ANTHROPIC_API_KEY", "GOOGLE_MAPS_API_KEY", "SZAMLAZZ_AGENT_KEY", "BARION_POSKEY", "OUTREACH_SMS_ALLOWLIST"]) process.env[k] = "";
  const barionTest = o.payment === "barion-test";
  if (barionTest) {
    Object.assign(process.env, barionSandboxEnv(REPO));
    process.env.PAYMENT_GATEWAY = "barion";
  }
  const szamlazzTest = o.invoice === "szamlazz-test";
  if (szamlazzTest) {
    process.env.SZAMLAZZ_AGENT_KEY = szamlazzTestKey(REPO);
    process.env.INVOICE_PROVIDER = "szamlazz";
  }

  const scratch = scratchDbName(o.base);
  await sweepStaleScratchDbs(PG, o.base);
  registerScratchDrop(PG, scratch);
  await admin(`DROP DATABASE IF EXISTS ${scratch}`);
  await admin(`CREATE DATABASE ${scratch}`);
  execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: scratch, DATABASE_URL: "" }, stdio: "pipe" });
  process.env.PGDATABASE = scratch;
  process.env.DATABASE_URL = "";

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return realFetch(input, init);
    if (barionTest && /^https:\/\/(api|secure)\.test\.barion\.com\//.test(url)) return realFetch(input, init);
    if (szamlazzTest && /^https:\/\/www\.szamlazz\.hu\/szamla\//.test(url)) return realFetch(input, init);
    // …and the MNB rate the foreign-currency invoice names (src/billing/fxRate.ts), as in production.
    if (szamlazzTest && /^http:\/\/www\.mnb\.hu\/arfolyamok\.asmx/.test(url)) return realFetch(input, init);
    return new Response("blocked by hr-world fence", { status: 599 });
  }) as typeof fetch;

  const { db } = await import("../../src/db/client.ts");
  const { refreshCountries } = await import("../../src/country.ts");
  const { seedHrTestPrices, markMissingHrStrings, approveHr } = await import("./hr-open-fixture.mts");
  const { generateEngineMock } = await import("../../src/generator/generateEngine.ts");
  const { loadLead } = await import("../../src/generator/persist.ts");
  const { sendOutreachMail } = await import("../../src/outreach/sendBatch.ts");
  const { createFixtureParent } = await import("./fixture-parent.mts");
  const { mintOperatorCookieValue } = await import("../../src/auth/operatorAuth.ts");

  await refreshCountries();
  // 3/10: the production package composition and off-sale list (read 2026-11-22: the own domain is
  // Alap content, e-mail and newsletter off sale) — the scratch DB mirrors what a buyer sees there.
  // GLOBAL settings, scratch only (assertScratchDb in the fixture guards the database name).
  const { assertScratchDb } = await import("./hr-open-fixture.mts");
  assertScratchDb();
  const PROD_TIERS: Record<string, string> = {
    domain: "alap", enquiry: "alap", gallery: "alap", location: "alap",
    amenities: "ajanlott", reviews: "ajanlott", rooms: "ajanlott", usp: "ajanlott",
    booking: "teljes", email: "teljes", hours: "teljes", poi: "teljes", pricing: "teljes",
  };
  for (const [module_id, tier] of Object.entries(PROD_TIERS)) {
    await db.insertInto("package_module").values({ module_id, tier } as never).onConflict((oc) => oc.column("module_id").doUpdateSet({ tier } as never)).execute();
  }
  await db.insertInto("app_setting").values({ key: "module_sales_disabled", value: JSON.stringify(["newsletter", "email"]) } as never)
    .onConflict((oc) => oc.column("key").doUpdateSet({ value: JSON.stringify(["newsletter", "email"]) } as never)).execute();
  await db.updateTable("pricing_config").set({ domain_free_in_package: true } as never).where("region", "=", "hu").execute();
  await seedHrTestPrices();
  await markMissingHrStrings();
  await approveHr();

  const parent = await createFixtureParent(db as never, `${o.base}w`);
  // ⚠️ ELEK_RUN: the transport delivers only to elek@ — the lead's own address is Elek's.
  const raw = { name: "Apartmani Lavanda", country: "HR", city: "Makarska", lat: 43.296, lon: 17.017, email: "elek@citoviso.com", phone: "+385 21 612 345", address: "Obala kralja Tomislava 12, 21300 Makarska" };
  const lead = await db.insertInto("lead").values({ scrape_run_id: parent.runId, name: raw.name, raw, qualification: "no_site" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const copy = {
    fields: {
      "hero.lead": "Mirni apartmani u Makarskoj, nekoliko koraka od plaže",
      tagline: "Obiteljski apartmani s vrtom i pogledom na more",
      intro: "Apartmani Lavanda obiteljski su smještaj u Makarskoj. Sobe su prozračne, a vrt je navečer tih.",
      highlights: ["Vrt za odmor", "Blizu plaže", "Obiteljski doček"],
    },
  };
  const gen = await generateEngineMock(await loadLead(lead.id), "_e2e", { curatorCopy: copy as never, template: "wordmark-grow", skin: "coastal-fresh" });
  const art = await db.selectFrom("mock_artifact").select(["inputs", "path"]).where("id", "=", gen.artifactId).executeTakeFirstOrThrow();
  const mockPath = path.resolve(REPO, art.path!);
  // No photo leaves this world (fence): the curator's no-photo acknowledgement is what a real
  // operator gives on the send dialog for a picture-less lead.
  const noPhotoAck = { at: new Date().toISOString(), by: "hr-world", reason: "teszt-világ (scratch DB): kép nélküli horvát mock, a fotó nem cél" };
  // The mock was just made by TODAY's generator (the qafix code). The send gate (MOCK_CURRENT_GENERATOR_SQL)
  // counts a mock as current by its generated_at only after MOCK_HEROFIX_LIVE_AT — a fresh mock made before
  // that hour carries the same stamp the re-render gives (mockRefresh.ts), so the world never depends on
  // the wall clock. The gate itself is untouched.
  const { MOCK_HEROFIX_STAMP } = await import("../../src/outreach/mockPhotoGate.js");
  await db.updateTable("mock_artifact").set({ status: "approved", inputs: { ...(art.inputs as object), reviewVerdict: "pass", review: { verdict: "pass", by: "hr-world" }, noPhotoAck, terhatasAt: MOCK_HEROFIX_STAMP } } as never)
    .where("id", "=", gen.artifactId).execute();
  const token = `elekhr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const p = await db.insertInto("prospect").values({ lead_id: lead.id, token, mock_artifact_id: gen.artifactId, contact_email: "elek@citoviso.com" } as never)
    .returning("id").executeTakeFirstOrThrow();

  const op = await db.insertInto("operator_user").values({ username: `${o.base}op${process.pid}`, display_name: "HR world", role: "superadmin", password_hash: "x" } as never)
    .returning("id").executeTakeFirstOrThrow();

  const { server: consoleServer } = (await import("../../src/console/server.ts")) as { server: http.Server };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const { server: publicServer } = (await import("../../src/server/public.ts")) as { server: http.Server };
  if (!publicServer.listening) await once(publicServer, "listening");
  const cp = (consoleServer.address() as { port: number }).port;
  const pp = (publicServer.address() as { port: number }).port;

  // The cold letter through the REAL send path — it stamps the intro offer (ADR-0286).
  // Send-window: the world may be built on a Sunday night; the window itself is tested in
  // country-hr-e2e ⑤. ONLY for this one call the no-argument `new Date()` / Date.now() read a
  // Wednesday 10:00 Zagreb — the send path, its gates and its offer stamp run unchanged.
  const sent = await atClock(new Date("2026-11-25T09:00:00Z"), () => sendOutreachMail(p.id));
  let letterPath: string | null = null;
  if (sent.outcome.kind === "sent") {
    letterPath = path.resolve(REPO, "outbox", `${sent.outcome.emailId}.eml`);
    if (!existsSync(letterPath)) letterPath = null;
  } else {
    console.warn(`[hr-world] a hideg levél NEM ment ki: ${JSON.stringify(sent.outcome)}`);
  }

  // 3/10: the PERSONAL letter (experimentCopy.ts) for this HR lead, RENDERED — never sent: whether
  // a non-Hungarian lead gets it is the conversion session's experiment order (assignVariants), and
  // the world does not touch it. Same parts and HTML builder the send path uses.
  let personalLetterPath: string | null = null;
  try {
    const { buildDraftForProspect } = await import("../../src/outreach/draft.ts");
    const { personalParts, composePersonalBody, priceSentence } = await import("../../src/outreach/experimentCopy.ts");
    const { buildOutreachEmail } = await import("../../src/email/outreachEmail.ts");
    const dr = await buildDraftForProspect(p.id, { reserveLabel: false });
    if (dr) {
      const links = { cta: dr.draft.link, unsub: dr.draft.unsubscribeLink, privacy: dr.draft.privacyLink, ...(dr.draft.whyLink ? { why: dr.draft.whyLink } : {}) };
      const parts = personalParts(dr.input, dr.draft, priceSentence(dr.lang, dr.draft.parts.priceOffer, dr.market.country), "Elek (Citoviso)");
      const draft = { ...dr.draft, parts, body: composePersonalBody(parts, links, dr.lang) };
      const msg = buildOutreachEmail(draft, "elek@citoviso.com", { lang: dr.lang, bodyStyle: "personal", noImage: true });
      personalLetterPath = path.resolve(REPO, "outbox", `personal-${token}.html`);
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(path.dirname(personalLetterPath), { recursive: true });
      writeFileSync(personalLetterPath, `<!-- Subject: ${draft.subject} -->\n${(msg as { html?: string }).html ?? ""}\n<!-- TEXT -->\n<pre>${draft.body}</pre>`);
    }
  } catch (e) {
    console.warn(`[hr-world] a személyes levél nem renderelhető: ${(e as Error).message}`);
  }

  let frontServer: http.Server | null = null;
  if (front) {
    frontServer = http.createServer((req, res) => {
      const url = req.url ?? "/";
      const toConsole = CONSOLE_PREFIXES.some((x) => url === x.replace(/\/$/, "") || url.startsWith(x));
      const port = toConsole ? cp : pp;
      const up = http.request({ host: "127.0.0.1", port, path: url, method: req.method, headers: { ...req.headers, "x-forwarded-proto": "http", "x-forwarded-host": `127.0.0.1:${front}` } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      up.on("error", () => {
        res.writeHead(502);
        res.end("front: upstream error");
      });
      req.pipe(up);
    });
    frontServer.listen(front, "127.0.0.1");
    await once(frontServer, "listening");
  }

  return {
    scratch,
    origin,
    frontOrigin: front ? `http://127.0.0.1:${front}` : null,
    consoleOrigin: `http://127.0.0.1:${cp}`,
    publicOrigin: `http://127.0.0.1:${pp}`,
    leadId: lead.id,
    prospectId: p.id,
    token,
    mockPath,
    letterPath,
    personalLetterPath,
    opCookie: mintOperatorCookieValue(op.id),
    async close() {
      for (const s of [consoleServer, publicServer, frontServer]) {
        if (!s) continue;
        s.closeAllConnections();
        s.close();
      }
      if (existsSync(mockPath)) rmSync(mockPath, { force: true });
      // The send path froze a hero shot of the mock into the shared sites/_outreach-shots/.
      const shots = path.resolve(REPO, "sites", "_outreach-shots");
      if (existsSync(shots)) for (const f of readdirSync(shots)) if (f.startsWith(gen.artifactId)) rmSync(path.join(shots, f), { force: true });
      if (letterPath && existsSync(letterPath)) rmSync(letterPath, { force: true });
      if (personalLetterPath && existsSync(personalLetterPath)) rmSync(personalLetterPath, { force: true });
      await parent.drop();
      await db.destroy().catch(() => {});
    },
  };
}
