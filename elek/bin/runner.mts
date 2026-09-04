// Elek runner — layer 1, deterministic (no AI). Executes an FK scenario as a
// user would: in-process server on an ephemeral port (ui-shot pattern — the
// shared main-tree :4600/:4800 surface is never touched), forged stateless
// session cookie (no password, no DB write), Playwright steps, full-page shot
// of EVERY step, console errors + HTTP>=400 + dialogs recorded per step.
//
//   npx tsx elek/bin/runner.mts <FK-id | elek/scenarios/FK-….md>
//
// Output: elek/runs/<FK>-<ts>/result.jsonl + shots/NN.png  (gitignored)
//
// Rules (charter/SCENARIO-FORMAT.md): a failing "Előkészítés" section stops the
// whole run (remaining steps: blocked, ELŐFELTÉTEL-HIBA territory); an action
// error inside a section blocks the REST of that section only; a `kézi:` step is
// `manual` — machine green is not allowed on it.

process.env.CIT_SHOT = "1"; // suppress server boot self-heal (no AI calls, no DB writes)
// ADR-0095 ④ MECHANICAL guard: the in-process server refuses any email recipient
// other than elek@citoviso.com, and any SMS/MMS (own-SIM loopback is a separate,
// measurement-gated opt-in) — a wrong scenario cannot leak a message.
process.env.ELEK_RUN = "1";

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import type { Server } from "node:http";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

import { parseFk, findScenario, type FkScenario, type FkStep } from "../../src/elek/fkParse.js";
import { config } from "../../src/config.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function chromiumExe(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    config.chromiumPath,
    path.join(process.env.HOME ?? "", ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome"),
  ].filter((p): p is string => !!p);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("nincs használható Chromium (CHROMIUM_PATH?)");
}

// ── scenario ─────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error("használat: npx tsx elek/bin/runner.mts <FK-id | fájl>");
  process.exit(1);
}
const fk: FkScenario | null = /\.md$/i.test(arg)
  ? parseFk(path.resolve(arg))
  : findScenario(arg);
if (!fk) {
  console.error(`nincs ilyen forgatókönyv: ${arg}`);
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const RUN_DIR = path.join(ROOT, "elek", "runs", `${fk.id}-${ts}`);
const SHOTS = path.join(RUN_DIR, "shots");
mkdirSync(SHOTS, { recursive: true });

// ── server boot (in-process, ephemeral port) ─────────────────────────────────
async function bootServer(): Promise<string> {
  if (fk!.felulet === "konzol") {
    process.env.CONSOLE_PORT = "0";
    const { server } = (await import("../../src/console/server.js")) as { server: Server };
    if (!server.listening) await once(server, "listening");
    const a = server.address();
    if (!a || typeof a === "string") throw new Error("konzol szerver cím nélkül");
    return `http://127.0.0.1:${a.port}`;
  }
  process.env.PUBLIC_PORT = "0";
  const { server } = (await import("../../src/server/public.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("public szerver cím nélkül");
  return `http://127.0.0.1:${a.port}`;
}

// ── forged sessions (stateless HMAC cookie, server-side mint — charter §világa) ──
async function sessionCookie(user: string): Promise<{ name: string; value: string } | null> {
  if (user === "anon") return null;
  const { db } = await import("../../src/db/client.js");
  if (user === "operator-elek") {
    const { mintOperatorCookieValue } = await import("../../src/auth/operatorAuth.js");
    const op = await db
      .selectFrom("operator_user")
      .select("id")
      .where("username", "=", "elek")
      .executeTakeFirst();
    if (!op) throw new Error("ELŐFELTÉTEL: nincs `elek` operator_user a dev DB-ben");
    return { name: "cit_op_session", value: mintOperatorCookieValue(op.id) };
  }
  if (user === "tenant-elek") {
    const { mintTenantCookieValue } = await import("../../src/auth/tenantAuth.js");
    const tu = await db
      .selectFrom("tenant_user")
      .select(["id", "username"])
      .where("username", "like", "ELEK-TESZT%")
      .executeTakeFirst();
    if (!tu) throw new Error("ELŐFELTÉTEL: nincs ELEK-TESZT* tenant_user a dev DB-ben");
    return { name: "cit_session", value: mintTenantCookieValue(tu.id) };
  }
  throw new Error(`ismeretlen user: ${user}`);
}

// ── step primitives ──────────────────────────────────────────────────────────
const STEP_TIMEOUT = 10_000;

function quoted(s: string): string[] {
  return [...s.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

function isSelector(s: string): boolean {
  return /^[#.[]/.test(s);
}

async function doAction(page: Page, action: string): Promise<void> {
  const m = action.match(/^(kattints|írd|válaszd|várj)\s+(.*)$/);
  if (!m) throw new Error(`értelmezhetetlen akció: ${action}`);
  const [, verb, rest] = m;
  const q = quoted(rest);
  if (verb === "kattints") {
    const target = q[0] ?? rest.trim();
    const loc = isSelector(target)
      ? page.locator(target).first()
      : page
          .locator(
            `a:has-text("${target}"), button:has-text("${target}"), ` +
              `input[type=submit][value*="${target}"], [role=button]:has-text("${target}"), ` +
              `label:has-text("${target}"), summary:has-text("${target}")`,
          )
          .first();
    await loc.click({ timeout: STEP_TIMEOUT });
    return;
  }
  if (verb === "írd") {
    if (q.length < 2) throw new Error(`írd: két idézett arg kell: ${action}`);
    await page.locator(q[0]).first().fill(q[1], { timeout: STEP_TIMEOUT });
    return;
  }
  if (verb === "válaszd") {
    if (q.length < 2) throw new Error(`válaszd: két idézett arg kell: ${action}`);
    await page.locator(q[0]).first().selectOption({ label: q[1] }, { timeout: STEP_TIMEOUT });
    return;
  }
  // várj "<látható szöveg>" [mp] — optional timeout in seconds for long async
  // states (mock generation runs ~1-2 min while the page auto-reloads every 6s).
  // Any-visible polling: .first() would latch onto a hidden match (the <option>
  // trap), and a plain waitFor dies when the reload destroys the context.
  const text = q[0] ?? rest.trim();
  const secs = Number(rest.match(/"\s+(\d+)\s*$/)?.[1] ?? 0);
  const deadline = Date.now() + (secs > 0 ? secs * 1000 : STEP_TIMEOUT);
  for (;;) {
    let visible = false;
    try {
      const loc = page.getByText(text);
      const n = Math.min(await loc.count(), 30);
      for (let i = 0; i < n; i++) {
        if (await loc.nth(i).isVisible().catch(() => false)) {
          visible = true;
          break;
        }
      }
    } catch {
      // page mid-reload — poll again
    }
    if (visible) return;
    if (Date.now() > deadline) throw new Error(`várj: nem jelent meg időben: "${text}"`);
    await page.waitForTimeout(500);
  }
}

async function doCheck(page: Page, check: string): Promise<{ expr: string; ok: boolean; detail?: string }> {
  const vis = check.match(/^látható\s+"(.+)"$/);
  if (vis) {
    // ANY visible match counts — .first() would grab hidden matches (e.g. a
    // filter <option>) that precede the visible one in DOM order.
    const anyVisible = async (): Promise<boolean> => {
      const loc = page.getByText(vis[1]);
      const n = Math.min(await loc.count(), 30);
      for (let i = 0; i < n; i++) {
        if (await loc.nth(i).isVisible().catch(() => false)) return true;
      }
      return false;
    };
    let ok = await anyVisible();
    if (!ok) {
      // give slow renders one chance
      await page.waitForTimeout(2000);
      ok = await anyVisible();
    }
    return { expr: check, ok };
  }
  const notVis = check.match(/^nem látható\s+"(.+)"$/);
  if (notVis) {
    const count = await page.getByText(notVis[1]).count();
    let visible = false;
    for (let i = 0; i < count; i++) {
      if (await page.getByText(notVis[1]).nth(i).isVisible().catch(() => false)) visible = true;
    }
    return { expr: check, ok: !visible };
  }
  const cnt = check.match(/^darab\s+"(.+)"\s*>=\s*(\d+)$/);
  if (cnt) {
    const n = await page.locator(cnt[1]).count();
    return { expr: check, ok: n >= Number(cnt[2]), detail: `darab=${n}` };
  }
  const txt = check.match(/^szövege\s+"(.+)"\s*=\s*"(.*)"$/);
  if (txt) {
    const t = ((await page.locator(txt[1]).first().textContent({ timeout: STEP_TIMEOUT })) ?? "").trim();
    return { expr: check, ok: t === txt[2], detail: `szövege="${t}"` };
  }
  return { expr: check, ok: false, detail: "értelmezhetetlen várd-kifejezés" };
}

// ── run ──────────────────────────────────────────────────────────────────────
interface StepResult {
  section: string;
  step: number;
  text: string;
  status: "pass" | "fail" | "manual" | "blocked";
  kezi?: string;
  checks: { expr: string; ok: boolean; detail?: string }[];
  console_errors: string[];
  http_errors: string[];
  dialogs: string[];
  shot: string | null;
  error?: string;
}

const base = await bootServer();
const browser: Browser = await chromium.launch({ executablePath: chromiumExe() });

const contexts = new Map<string, BrowserContext>();
let pageErrors: string[] = [];
let httpErrors: string[] = [];
let dialogs: string[] = [];

async function contextFor(user: string): Promise<BrowserContext> {
  let ctx = contexts.get(user);
  if (ctx) return ctx;
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cookie = await sessionCookie(user);
  if (cookie) {
    await ctx.addCookies([{ ...cookie, url: base }]);
  }
  contexts.set(user, ctx);
  return ctx;
}

function armPage(page: Page): void {
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const loc = msg.location();
      pageErrors.push(msg.text() + (loc?.url ? ` [${loc.url}]` : ""));
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`);
  });
  page.on("dialog", async (d) => {
    dialogs.push(`${d.type()}: ${d.message()}`);
    await d.accept().catch(() => {});
  });
}

const pages = new Map<string, Page>();
async function pageFor(user: string): Promise<Page> {
  let p = pages.get(user);
  if (p) return p;
  p = await (await contextFor(user)).newPage();
  armPage(p);
  pages.set(user, p);
  return p;
}

const results: StepResult[] = [];
let currentUser = "anon";
let stepNo = 0;
let hardStop = false;

for (const sec of fk.sections) {
  const isPrep = /^előkészítés$/i.test(sec.title);
  let sectionBlocked = false;
  for (const st of sec.steps) {
    stepNo++;
    const shotName = `${String(stepNo).padStart(2, "0")}.png`;
    const res: StepResult = {
      section: sec.title,
      step: stepNo,
      text: st.text,
      status: "pass",
      checks: [],
      console_errors: [],
      http_errors: [],
      dialogs: [],
      shot: null,
    };
    if (st.kezi) res.kezi = st.kezi;
    if (hardStop || sectionBlocked) {
      res.status = "blocked";
      results.push(res);
      continue;
    }
    pageErrors = [];
    httpErrors = [];
    dialogs = [];
    try {
      if (st.user) currentUser = st.user;
      const page = await pageFor(currentUser);
      if (st.ut) await page.goto(base + st.ut, { timeout: STEP_TIMEOUT * 2 });
      for (const action of st.tedd) await doAction(page, action);
      for (const check of st.vard) res.checks.push(await doCheck(page, check));
      // A 60 000px tall list makes a full-page shot unjudgeable — cap it: very
      // tall pages get a viewport shot (the judgment surface a human would see).
      const tall = await page.evaluate(() => document.documentElement.scrollHeight > 12000);
      await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: !tall });
      res.shot = `shots/${shotName}`;
      const failed = res.checks.some((c) => !c.ok);
      res.status = st.kezi ? "manual" : failed ? "fail" : "pass";
      if (failed && st.kezi) res.status = "fail"; // a manual step with failing machine checks is a fail
    } catch (e) {
      res.status = "fail";
      res.error = e instanceof Error ? e.message : String(e);
      // action error blocks the rest of the section (format contract)
      sectionBlocked = true;
      try {
        const page = pages.get(currentUser);
        if (page) {
          await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: true });
          res.shot = `shots/${shotName}`;
        }
      } catch {
        // no shot — the page itself is gone
      }
    }
    res.console_errors = [...pageErrors];
    res.http_errors = [...httpErrors];
    res.dialogs = [...dialogs];
    results.push(res);
    if (isPrep && res.status === "fail") hardStop = true; // precondition failure = full stop
  }
}

for (const r of results) appendFileSync(path.join(RUN_DIR, "result.jsonl"), JSON.stringify(r) + "\n");

const tally = { pass: 0, fail: 0, manual: 0, blocked: 0 };
for (const r of results) tally[r.status]++;
console.log(`${fk.id} — ${fk.title}`);
console.log(`futás-mappa: ${path.relative(ROOT, RUN_DIR)}`);
console.log(
  `lépések: ${results.length} · pass=${tally.pass} fail=${tally.fail} manual=${tally.manual} blocked=${tally.blocked}`,
);
await browser.close();
process.exit(tally.fail > 0 ? 2 : 0);
