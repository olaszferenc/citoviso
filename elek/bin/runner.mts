// Elek runner — layer 1, deterministic (no AI). Executes an FK scenario as a
// user would: in-process server on an ephemeral port (ui-shot pattern — the
// shared main-tree :4600/:4800 surface is never touched), forged stateless
// session cookie (no password, no DB write), Playwright steps, TWO full-page
// shots of EVERY step (asztali 1280px + telefonos 390px — lásd a `capture`
// szakaszt), console errors + HTTP>=400 + dialogs recorded per step.
//
//   npx tsx elek/bin/runner.mts <FK-id | elek/scenarios/FK-….md>
//
// Output: elek/runs/<FK>-<ts>/result.jsonl + shots/NN.png + shots/NN-mobil.png
//         (gitignored)
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
// Charter: külső fizetés-gateway indítása TILOS — a lokál mock-gateway útja a
// teszt része. MECHANICAL, like the mail guard: with the main .env on Barion
// sandbox the buy flow navigated to the REAL hosted page (measured 2026-09-05;
// the scenario's "Mock fizetőoldal" check stopped the run before any click).
process.env.PAYMENT_GATEWAY = "mock";

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

import { parseFk, findScenario, type FkScenario, type FkStep } from "../../src/elek/fkParse.js";
import { classifyStepNoise, noiseErrorText } from "../../src/elek/stepVerdict.js";
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
// ELEK_RUN_TAG: a matrix orchestrator (FK-010: 19 styles × 2 leads) runs the SAME
// scenario many times — the tag keeps the run folders apart and readable.
const runTag = (process.env.ELEK_RUN_TAG ?? "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const RUN_DIR = path.join(ROOT, "elek", "runs", `${fk.id}-${runTag ? runTag + "-" : ""}${ts}`);
const SHOTS = path.join(RUN_DIR, "shots");
mkdirSync(SHOTS, { recursive: true });

// ── server boot (in-process, ephemeral port) ─────────────────────────────────
async function bootConsole(): Promise<string> {
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("konzol szerver cím nélkül");
  return `http://127.0.0.1:${a.port}`;
}

async function bootServer(): Promise<string> {
  // `felület: fájl` — the page IS a file (a generated mock: runtime inlined, nothing to
  // fetch). No server, no cookie; `út:` resolves to a file:// URL in gotoUrl().
  if (fk!.felulet === "fájl") return "";
  // ⛔ THE PAY PAGES LIVE ON THE CONSOLE (measured 2026-09-11): a tenant-admin
  // scenario that walks a purchase leaves the public server at the pay-link — and
  // that link is built from PUBLIC_BASE_URL, i.e. it pointed at the MAIN TREE's
  // :4600. So the payment half of FK-005b silently measured OTHER CODE than the
  // worktree under test: four fixes were in the tree, the run reported them
  // missing. Boot the console in-process too and aim the pay-links at it, so a
  // run measures exactly the tree it was started from.
  const consoleOrigin = await bootConsole();
  process.env.PUBLIC_BASE_URL = consoleOrigin;
  if (fk!.felulet === "konzol") return consoleOrigin;
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
    // ⚠️ C-kolláció: a LIKE kis/nagybetű-érzékeny, a username pedig slugosított
    // kisbetűs ('elek-teszt-vendeghaz') — az 'ELEK-TESZT%' minta ÜRESRE futott.
    const { sql } = await import("kysely");
    const tu = await db
      .selectFrom("tenant_user")
      .select(["id", "username"])
      .where(sql<string>`lower(username)`, "like", "elek-teszt%")
      .executeTakeFirst();
    if (!tu) throw new Error("ELŐFELTÉTEL: nincs elek-teszt* tenant_user a dev DB-ben");
    return { name: "cit_session", value: mintTenantCookieValue(tu.id) };
  }
  throw new Error(`ismeretlen user: ${user}`);
}

// ── step primitives ──────────────────────────────────────────────────────────
const STEP_TIMEOUT = 10_000;

function quoted(s: string): string[] {
  return [...s.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

// ${VAR} → process.env.VAR in út/tedd/várd values. The orchestrator passes
// run-derived state this way (e.g. the /p/ path Elek read out of his own mail);
// a missing variable is a loud precondition error, never a silent literal.
function subst(s: string): string {
  return s.replace(/\$\{([A-Z0-9_]+)\}/g, (_, v: string) => {
    const val = process.env[v];
    if (val == null) throw new Error(`hiányzó env-helyettesítő: \${${v}}`);
    return val;
  });
}

/** `út:` → navigable URL: a route on the booted server, or (felület: fájl) a file path
 *  relative to the repo root — the generated mocks live there. */
function gotoUrl(ut: string): string {
  if (fk!.felulet !== "fájl") return base + ut;
  const abs = path.isAbsolute(ut) ? ut : path.resolve(ROOT, ut);
  if (!existsSync(abs)) throw new Error(`ELŐFELTÉTEL: nincs ilyen fájl: ${abs}`);
  return pathToFileURL(abs).href;
}

function isSelector(s: string): boolean {
  return /^[#.[]/.test(s);
}

async function doAction(page: Page, action: string): Promise<void> {
  // `vissza` — the buyer's back button (failure-matrix territory: what does the
  // pay page do when they navigate back after a decline or a success?).
  if (action.trim() === "vissza") {
    await page.goBack({ timeout: STEP_TIMEOUT * 2 });
    return;
  }
  // `újratöltés` — F5 mid-flow. A pay page that is served from cache lies about
  // its own state (Elek FK-005b H4, 2026-09-11: after a decline the back-step
  // showed a byte-identical "pending" screen), and a reload is the cheapest way
  // to ask the server what it really thinks.
  if (action.trim() === "újratöltés") {
    await page.reload({ timeout: STEP_TIMEOUT * 2 });
    return;
  }
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
    // A one-shot trigger REMOVES ITSELF on success (the outreach send button is
    // replaced by the "Az e-mail már kiment" note). Playwright then re-resolves
    // the now-detached locator and times out — reporting a failure for a click
    // that LANDED. Measured 2026-09-10 on FK-004: the mail was sent (prospect
    // status=sent), the step was red, and the whole chain below it read as
    // blocked. Distinguish the two cases instead of silencing either: if the
    // trigger is genuinely gone, the click did its job; if it is still there,
    // the failure is real and must be re-thrown.
    try {
      await loc.click({ timeout: STEP_TIMEOUT });
    } catch (e) {
      // An INFINITE CSS animation (the configurator's "2 hó ingyen" nudge/shine,
      // ADR-0211) keeps the target's box moving, so Playwright's stability wait
      // never settles and the click times out — measured 2026-09-24 on FK-005a
      // (green on 09-13, red after the animation landed). A human taps a moving
      // button fine; click it where it is now. Only this one failure mode is
      // forced — a hidden/detached/covered target still fails loudly.
      if (String((e as Error).message).includes("not stable")) {
        // A forced click lands wherever the box is NOW — so first ask the page
        // what sits at that point. A covered button forced "successfully" would
        // be a silent miss (the handler never runs, the step stays green).
        const cover = await loc.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (!top || top === el || el.contains(top)) return null;
          return `${top.tagName.toLowerCase()}${top.className ? "." + String(top.className).trim().split(/\s+/).join(".") : ""}` +
            ` @ ${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)} (box ${Math.round(r.y)}–${Math.round(r.bottom)})`;
        });
        if (cover) throw new Error(`a célpontot takarja: ${cover} — ${String((e as Error).message).split("\n")[0]}`);
        await loc.click({ force: true, timeout: STEP_TIMEOUT });
        return;
      }
      if ((await loc.count()) > 0) {
        // "element is not visible" names nothing: say WHAT hides it (its own box, or the
        // nearest ancestor that is display:none / zero-sized), so the next reader does not
        // need three bisect runs to find out (FK-010, 2026-09-26).
        // "…subtree intercepts pointer events" names the cover but not WHY: say what the DOM
        // hit-test returns at the click point and the cover's stacking (2026-09-26, aurora X).
        if (/intercepts pointer events/.test(String((e as Error).message))) {
          const why = await loc.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            const stack = document.elementsFromPoint(cx, cy).slice(0, 4).map((n) => {
              const cs = getComputedStyle(n);
              return `${n.tagName.toLowerCase()}${n.className ? "." + String(n.className).trim().split(/\s+/)[0] : ""}(pos=${cs.position},z=${cs.zIndex},pe=${cs.pointerEvents})`;
            });
            const top = document.elementFromPoint(cx, cy);
            const domSaysTarget = !!top && (top === el || el.contains(top));
            return `${domSaysTarget ? "DOM-TOP " : ""}pont ${Math.round(cx)},${Math.round(cy)} · réteg-sor: ${stack.join(" > ")} · box ${Math.round(r.width)}×${Math.round(r.height)} · scrollY=${Math.round(window.scrollY)} vw=${window.innerWidth}`;
          }).catch(() => "?");
          // The DOM's own hit-test (elementFromPoint — what a real tap resolves to) says the
          // target IS on top, Playwright's actionability check disagrees (measured 2026-09-26,
          // aurora popover X at 390: DOM → button, Playwright → the img beneath it, after the
          // three-viewport captures). A tap would land; click it where it is. A genuinely
          // covered target (DOM says something else) still fails loudly, with the layer stack.
          if (why.startsWith("DOM-TOP ")) {
            await loc.click({ force: true, timeout: STEP_TIMEOUT });
            return;
          }
          throw new Error(`${String((e as Error).message).split("\n")[0]} — a célpont takarva: ${why}`);
        }
        if (/not visible/.test(String((e as Error).message))) {
          const why = await loc.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            let hidden = "";
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              const acs = getComputedStyle(a);
              const ar = a.getBoundingClientRect();
              if (acs.display === "none" || acs.visibility === "hidden" || (ar.width === 0 && ar.height === 0)) {
                hidden = `${a.tagName.toLowerCase()}${a.className ? "." + String(a.className).trim().split(/\s+/).join(".") : ""} display=${acs.display} visibility=${acs.visibility} box=${Math.round(ar.width)}×${Math.round(ar.height)}`;
                break;
              }
            }
            return `box ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)} display=${cs.display} visibility=${cs.visibility} opacity=${cs.opacity}` + (hidden ? ` · rejtő ős: ${hidden}` : "") + ` · scrollY=${Math.round(window.scrollY)} vw=${window.innerWidth}`;
          }).catch(() => "?");
          throw new Error(`${String((e as Error).message).split("\n")[0]} — a célpont állapota: ${why}`);
        }
        throw e;
      }
    }
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
  // `darab` now takes >= / <= / == . Absence needs a SELECTOR, not a word: the
  // suspended page was asserted with `nem látható "Foglalás"` and went red on its
  // own honest sentence ("Foglalással, érkezéssel kapcsolatos kérdésével…"), while
  // the thing actually being judged — that a frozen site takes no reservations —
  // was never measured. A substring is a proxy; the module anchor is the fact.
  const cnt = check.match(/^darab\s+"(.+)"\s*(>=|<=|==)\s*(\d+)$/);
  if (cnt) {
    const n = await page.locator(cnt[1]!).count();
    const want = Number(cnt[3]);
    const ok = cnt[2] === ">=" ? n >= want : cnt[2] === "<=" ? n <= want : n === want;
    return { expr: check, ok, detail: `darab=${n}` };
  }
  const txt = check.match(/^szövege\s+"(.+)"\s*=\s*"(.*)"$/);
  if (txt) {
    const t = ((await page.locator(txt[1]).first().textContent({ timeout: STEP_TIMEOUT })) ?? "").trim();
    return { expr: check, ok: t === txt[2], detail: `szövege="${t}"` };
  }
  return { expr: check, ok: false, detail: "értelmezhetetlen várd-kifejezés" };
}

// ── capture ──────────────────────────────────────────────────────────────────
// TWO shots per step, one per size. The owner works on a PHONE, yet every image
// this runner ever produced was 1280px wide — and in the 2026-09-14 full matrix
// FIVE separate evaluators independently wrote that they COULD NOT JUDGE the
// mobile view because no 390px frame existed ("a futásban egyetlen 390 px-es
// felvétel sincs", FK-001/FK-004b/FK-005a/FK-005b/FK-007). We were fixing blind
// exactly the size the owner uses.
//
// ⛔ WHY NOT A SECOND RUN AT 390px: the scenarios MUTATE the world — FK-004 sends
// the outreach mail, FK-005a takes a payment and provisions a tenant. Replaying
// the steps in a narrow context would double every side effect. Resizing the LIVE
// page instead keeps the exact same application state, so the two images are the
// same moment at two widths — which is precisely what "judge the phone view" needs.
//
// ⚠️ WHAT THIS DOES NOT PROVE: the viewport changes the LAYOUT, not the browser.
// The context stays desktop (isMobile/touch can only be set at context creation),
// so a mobile shot proves how the page LOOKS at 390px, never that the flow is
// OPERABLE by thumb. Measured first: the server branches on user-agent nowhere
// (only records it for analytics) and every breakpoint in our CSS is a width
// query (520–960px), so width alone does reproduce the phone layout. Operability
// at 390px remains an open, separately-earned claim — do not read it into these
// images. The `várd:` checks keep running at 1280 only, so verdicts are unchanged.
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
// `nézet: telefon` (FK-010): the context IS a phone (touch + mobile flag, 390 px), the
// checks and clicks run there, and the SECONDARY frames are the landscape phone
// (844×390 — orientation is not width: a landscape phone hid 8 of 10 controls once) and
// the desktop. `shot_mobile` stays the 390 px frame in both modes, so every consumer of
// result.jsonl keeps reading the same field for the same picture.
const PHONE_MODE = fk.nezet === "telefon";
const LANDSCAPE = { width: 844, height: 390 };
const PRIMARY = PHONE_MODE ? MOBILE : DESKTOP;

// A 60 000px tall list makes a full-page shot unjudgeable — cap it: very tall
// pages get a viewport shot (the judgment surface a human would see). The cap was
// written as "height > 12 000px" when 1280px was the only width that existed.
//
// ⛔ A RAW HEIGHT cap is NOT viewport-neutral. The same content is taller at 390px,
// so an absolute limit trips on LESS content in the narrow pass — the mobile half
// would be silently the weaker evidence, which is the very blind spot this change
// exists to close, reappearing in miniature. So the cap is on the stitched image's
// AREA, set to exactly what the old rule allowed at desktop width (1280 × 12 000).
// At 1280px the two formulations are the same predicate — desktop behaviour is
// unchanged by construction — while 390px gets the proportionally equal budget.
const SHOT_AREA_CAP = 1280 * 12_000;

// ELEK_TRACE_JS: a JS expression evaluated on the page after every action, check and
// capture, printed with a tag — for the day a step fails and nothing else says why
// (FK-010, 2026-09-26: the calendar month reset between two steps, unreproducible
// outside the runner). Development aid; silent when unset.
const TRACE = process.env.ELEK_TRACE_JS ?? "";
async function trace(page: Page, tag: string): Promise<void> {
  if (!TRACE) return;
  const v = await page.evaluate(TRACE).catch((e) => `trace error: ${(e as Error).message}`);
  console.log(`  [trace] ${tag}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
}

/** One capture at the page's CURRENT viewport — all the hard-won settle rules. */
async function capture(page: Page, file: string): Promise<void> {
  // Re-measured PER VIEWPORT: the page reflows, so the desktop verdict never carries.
  const tall = await page.evaluate(
    (cap) => document.documentElement.scrollHeight * window.innerWidth > cap,
    SHOT_AREA_CAP,
  );
  // Double-rAF settle: let pending paints (class toggles, sticky layers)
  // reach the screen before capturing — the shot must show the DOM's truth.
  const settle = (): Promise<void> =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined)))));
  await settle();
  // Lazy-loaded images below the fold never load on an unscrolled page, so
  // the full-page shot showed placeholder boxes where real photos render —
  // a false "missing photo" finding. Walk the page once, then return.
  if (!tall) {
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
  }
  // Full-page stitch duplicates sticky/fixed bars mid-image and covers real
  // content (evidence artifact, not an app bug — Elek flagged it twice).
  // Neutralize for the capture only, then restore.
  const stickyOff = !tall;
  if (stickyOff) {
    await page.evaluate(() => {
      const touched: { el: HTMLElement; pos: string }[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const p = getComputedStyle(el).position;
        if (p === "sticky" || p === "fixed") {
          touched.push({ el, pos: el.style.position });
          el.style.position = "static";
        }
      }
      (window as unknown as { __elekRestore?: () => void }).__elekRestore = () => {
        for (const t of touched) t.el.style.position = t.pos;
      };
    });
  }
  // The sticky→static swap moves layout — without a SECOND settle the old
  // stuck layer leaves a raster ghost in the capture (the tab badge painted
  // as a floating white pill over content — Elek H2, two rounds running).
  if (stickyOff) await settle();
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: !tall });
  if (stickyOff) {
    await page.evaluate(() => (window as unknown as { __elekRestore?: () => void }).__elekRestore?.());
  }
  await trace(page, `capture ${file}`);
}

let mobileCaptureMs = 0;

/**
 * Narrow the live page to 390px, capture, then put it BACK to 1280.
 * ⛔ The restore is not tidiness: the next step's clicks must land in the same
 * viewport the scenarios were written and measured against. Leaving the page
 * narrow would silently change what every following step tests. It runs in a
 * `finally`, so a capture error cannot strand the run in mobile width.
 */
async function captureMobile(page: Page, file: string): Promise<void> {
  await captureAt(page, file, MOBILE);
}

/** Capture at another size and put the page BACK to the run's primary size (see above). */
async function captureAt(page: Page, file: string, size: { width: number; height: number }): Promise<void> {
  const t0 = Date.now();
  try {
    await page.setViewportSize(size);
    // Let the width-driven relayout happen (media/container queries, srcset
    // swaps, JS resize handlers) before anything is measured or painted.
    await page.waitForTimeout(200);
    await capture(page, file);
  } finally {
    await page.setViewportSize(PRIMARY).catch(() => {});
    mobileCaptureMs += Date.now() - t0;
  }
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
  /** Asztali felvétel (1280px) — a mező NEVE és jelentése változatlan. */
  shot: string | null;
  /** Telefonos felvétel (390px) UGYANARRÓL az állapotról — a kiértékelő MINDKETTŐT nézi. */
  shot_mobile: string | null;
  /** `nézet: telefon` futásban: FEKVŐ telefon (844×390) — a tartás nem szélesség. */
  shot_land?: string | null;
  error?: string;
  /** ADR-0131: recorded errors that a `tűrt-hiba:` line lawfully let through. */
  tolerated_errors?: { error: string; reason: string }[];
  /** Declared `tűrt-hiba:` patterns that matched nothing here (stale licence). */
  tolerated_unused?: string[];
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
  // reducedMotion: a smooth scroll in flight at screenshot time captured the
  // sticky tab strip from a STALE compositor layer — the shot showed the OLD
  // active tab while the DOM was correct (measured 2026-09-05, tabrepro5). A
  // manual tester's eye never sees that frame; the runner must not either.
  ctx = await browser.newContext({
    viewport: PRIMARY,
    // A phone is not a narrow desktop: touch events, the mobile flag (meta viewport,
    // :hover semantics) — the guest's real browser. Only in `nézet: telefon` runs.
    ...(PHONE_MODE ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: "reduce",
  });
  const cookie = await sessionCookie(user);
  if (cookie) {
    await ctx.addCookies([{ ...cookie, url: base }]);
  }
  contexts.set(user, ctx);
  return ctx;
}

function armPage(page: Page): void {
  // A bare "SyntaxError: Invalid or unexpected token" names no file — the stack's
  // first frame does (measured 2026-09-24: three runs to locate one broken script).
  page.on("pageerror", (e) => {
    const frame = String(e.stack ?? "").split("\n").find((l) => /https?:\/\//.test(l));
    pageErrors.push(String(e) + (frame ? ` [${frame.trim()}]` : ""));
  });
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
    const mobileShotName = `${String(stepNo).padStart(2, "0")}-mobil.png`;
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
      shot_mobile: null,
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
      if (st.ut) await page.goto(gotoUrl(subst(st.ut)), { timeout: STEP_TIMEOUT * 2 });
      for (const action of st.tedd) {
        // `?`-prefixed = best-effort (tedd?:): overlays that only exist on some
        // visits. Failure is recorded in-band via the shot, never a step-fail.
        if (action.startsWith("?")) {
          try {
            await doAction(page, subst(action.slice(1)));
          } catch {
            // absent overlay — carry on
          }
          continue;
        }
        await doAction(page, subst(action));
        await trace(page, `${stepNo}. tedd ${action.slice(0, 40)}`);
      }
      for (const check of st.vard) res.checks.push(await doCheck(page, subst(check)));
      await trace(page, `${stepNo}. várd`);
      res.shot = `shots/${shotName}`;
      res.shot_mobile = `shots/${mobileShotName}`;
      if (PHONE_MODE) {
        // Primary = the phone frame the checks just ran on; then landscape + desktop.
        const landName = `${String(stepNo).padStart(2, "0")}-fekvo.png`;
        await capture(page, mobileShotName);
        await captureAt(page, landName, LANDSCAPE);
        res.shot_land = `shots/${landName}`;
        await captureAt(page, shotName, DESKTOP);
      } else {
        await capture(page, shotName);
        await captureMobile(page, mobileShotName);
      }
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
          if (PHONE_MODE) await page.setViewportSize(DESKTOP);
          await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: true });
          res.shot = `shots/${shotName}`;
          // ⛔ The FAILURE branches were the loudest part of the blind spot:
          // "a bukás-ágak mobilon nem lettek lefényképezve" (FK-005b, 2026-09-14).
          // Plain screenshot like the desktop one above — on a half-dead page the
          // evaluate()-based capture() could throw and cost us the evidence.
          // Its own try/catch: losing the mobile frame must not cost the desktop one.
          try {
            await page.setViewportSize(MOBILE);
            await page.waitForTimeout(200);
            await page.screenshot({ path: path.join(SHOTS, mobileShotName), fullPage: true });
            res.shot_mobile = `shots/${mobileShotName}`;
          } catch {
            // no mobile frame — the desktop one above still stands
          } finally {
            await page.setViewportSize(PRIMARY).catch(() => {});
          }
        }
      } catch {
        // no shot — the page itself is gone
      }
    }
    res.console_errors = [...pageErrors];
    res.http_errors = [...httpErrors];
    res.dialogs = [...dialogs];
    // ⛔ SILENT-FAILURE GATE (ADR-0131). These two arrays were recorded and then
    // ignored: FK-004's 404 MMS preview passed TWICE, and only a fresh-eyed reader
    // of the log caught it. A step cannot be green if something failed on it; a
    // LAWFUL error must be declared in the scenario (`tűrt-hiba: <minta> — <indok>`).
    const statusBeforeNoise = res.status;
    if (res.status !== "blocked") {
      const noise = classifyStepNoise({
        consoleErrors: res.console_errors,
        httpErrors: res.http_errors,
        tolerated: st.turtHiba,
      });
      if (noise.toleratedHits.length) res.tolerated_errors = noise.toleratedHits;
      if (noise.unusedPatterns.length) res.tolerated_unused = noise.unusedPatterns;
      if (noise.offending.length) {
        // Keep an action error's own message — it is the more specific truth.
        res.error = res.error ? `${res.error} · ${noiseErrorText(noise.offending)}` : noiseErrorText(noise.offending);
        // ⚠️ Deliberately NOT sectionBlocked / hardStop when the step's own checks
        // were green: noise means "something broke here", not "the precondition is
        // missing", and the later steps' evidence is still worth collecting. A
        // real precondition failure (checks red / action threw) still stops.
        res.status = "fail";
      }
    }
    results.push(res);
    // Precondition failure = full stop — but a NOISE-only red (the step's own
    // checks passed) is not a missing precondition, so the run continues and the
    // remaining evidence still gets collected.
    if (isPrep && statusBeforeNoise === "fail") hardStop = true;
  }
}

for (const r of results) appendFileSync(path.join(RUN_DIR, "result.jsonl"), JSON.stringify(r) + "\n");

const tally = { pass: 0, fail: 0, manual: 0, blocked: 0 };
for (const r of results) tally[r.status]++;
console.log(`${fk.id} — ${fk.title}${PHONE_MODE ? " · TELEFON-nézet (390×844, touch)" : ""}`);
console.log(`futás-mappa: ${path.relative(ROOT, RUN_DIR)}`);
console.log(
  `lépések: ${results.length} · pass=${tally.pass} fail=${tally.fail} manual=${tally.manual} blocked=${tally.blocked}`,
);
// Name the price of the second size out loud, every run: the mobile half is the
// only part a future session can decide to drop, so it must never be a guess.
const shotsDesktop = results.filter((r) => r.shot).length;
const shotsMobile = results.filter((r) => r.shot_mobile).length;
const missingMobile = results.filter((r) => r.shot && !r.shot_mobile).map((r) => r.step);
console.log(
  `képek: ${shotsDesktop} asztali (1280px) + ${shotsMobile} telefonos (390px) · ` +
    `a telefonos felvétel ${(mobileCaptureMs / 1000).toFixed(1)} mp-et tett a futáshoz`,
);
// A desktop frame without its mobile pair is a silent return of the blind spot on
// exactly that step — say which, instead of letting the evaluator discover a gap.
if (missingMobile.length) {
  console.log(`⚠️ telefonos felvétel NÉLKÜL maradt lépés: ${missingMobile.join(", ")}`);
}
// ADR-0131: name the silent failures out loud — the whole point is that they no
// longer need a human to read the JSONL to be noticed.
const noisy = results.filter(
  (r) => r.status === "fail" && /^néma hiba a lépésen|· néma hiba a lépésen/.test(r.error ?? ""),
);
for (const r of noisy) console.log(`⛔ ${r.step}. lépés — ${r.error}`);
const staleTolerations = results.flatMap((r) =>
  (r.tolerated_unused ?? []).map((p) => `${r.step}. lépés: "${p}"`),
);
if (staleTolerations.length) {
  console.log(`⚠️ nem illeszkedő tűrt-hiba minta (elavult engedmény?): ${staleTolerations.join(" · ")}`);
}
await browser.close();
process.exit(tally.fail > 0 ? 2 : 0);
