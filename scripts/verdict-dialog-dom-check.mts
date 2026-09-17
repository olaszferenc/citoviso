// DOM-measurement of the send-confirmation dialog on the REAL draft page.
//
// A screenshot cannot answer the question that matters here: WHERE does the second
// click POST to? A dialog that looks right but submits to the wrong route (or drops
// the `confirmVerdicts` field) would either send nothing, or send while the ack was
// never recorded. A full-page shot cannot answer "is it modal?" either — it paints a
// modal at the top of the image (measured trap, 2026-09-11) — so the eye is the wrong
// instrument here and the DOM is the right one.
//
// ⛔ READ-ONLY BY CONSTRUCTION: the page is rendered with GET and NOTHING is clicked.
// Clicking the confirm button here would send a REAL cold e-mail to a real person.
//
// Run: npx tsx scripts/verdict-dialog-dom-check.mts
import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";

const PROSPECT = process.env.VD_PROSPECT ?? "863bbbc1-e7d4-4bc7-a250-6b00febe35e6";

const fails: string[] = [];
let pass = 0;
const ck = (ok: boolean, msg: string): void => {
  if (ok) pass++;
  else fails.push(msg);
};

/**
 * In-process console on an ephemeral port + a signed operator cookie — the same
 * pattern `scripts/ui-shot.mts` uses. ⚠️ The env var is set BEFORE the dynamic
 * import on purpose: a static `import` would be hoisted above the assignment and the
 * server would bind the real port (this exact ordering trap once sent a real e-mail).
 */
async function bootConsole(): Promise<{ port: number; cookie: string }> {
  process.env.CONSOLE_PORT = "0";
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { db } = await import("../src/db/client.js");
  const op =
    (await db
      .selectFrom("operator_user")
      .select("id")
      .where("username", "=", "claude-test")
      .executeTakeFirst()) ??
    (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
  if (!op) throw new Error("nincs operator_user a dev DB-ben — konzol-route nem lőhető");
  return { port: addr.port, cookie: mintOperatorCookieValue(op.id) };
}

const srv = await bootConsole();
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const base = `http://localhost:${srv.port}`;

async function newPage(): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ name: "cit_op_session", value: srv.cookie, url: base }]);
  return ctx.newPage();
}

try {
  // Every send button must get its OWN confirmation that restarts THAT channel.
  for (const [label, action] of [
    ["e-mail", "send"],
    ["mindkettő", "send-all"],
    ["mobil-páros", "send-pair"],
  ] as const) {
    const page = await newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`${base}/prospect/${PROSPECT}/draft?verdictConfirm=${action}`);

    const dlg = page.locator("#cit-verdict-confirm");
    const present = (await dlg.count()) === 1;
    ck(present, `${label}: nincs felugró a lapon`);
    if (!present) {
      await page.close();
      continue;
    }
    ck(await dlg.isVisible(), `${label}: a felugró nem látszik`);
    ck(errs.length === 0, `${label}: JS-hiba a lapon: ${errs.join(" | ")}`);

    // ⭐ THE POINT: the second click must start the SAME channel the curator pressed.
    const form = dlg.locator("form");
    const act = await form.getAttribute("action");
    ck(act === `/prospect/${PROSPECT}/${action}`, `${label}: a felugró máshova küld: ${act}`);
    ck((await form.getAttribute("method"))?.toLowerCase() === "post", `${label}: nem POST`);
    const hidden = await form.locator('input[name="confirmVerdicts"]').getAttribute("value");
    ck(hidden === "1", `${label}: hiányzik a confirmVerdicts=1 (a szerver enélkül NEM küld) — "${hidden}"`);

    // The finding must be NAMED on the screen — „FLAG (designVerdict)" was the bug.
    const text = (await dlg.textContent()) ?? "";
    ck(/Tényhűség-kapu/.test(text), `${label}: a lelet nincs megnevezve`);
    ck(/Ingyenes wifi|Klíma|Reggeli/.test(text), `${label}: a tényhűség-lelet tételei hiányoznak`);
    ck(/nem vonható vissza/.test(text), `${label}: nem mondja ki, hogy visszavonhatatlan`);
    // A dialog with ONE door is a trap: the way out must not be the send itself.
    ck((await dlg.locator("a.vg-dlg__cancel").count()) === 1, `${label}: nincs „Mégsem” kiút`);
    await page.close();
  }

  // NEGATIVE CONTROL: without the flag there must be NO dialog. Otherwise it would pop
  // up on every visit and the second click would stop meaning anything.
  {
    const page = await newPage();
    await page.goto(`${base}/prospect/${PROSPECT}/draft`);
    ck((await page.locator("#cit-verdict-confirm").count()) === 0, "⛔ a felugró flag NÉLKÜL is megjelent");
    await page.close();
  }

  // NEGATIVE CONTROL: an unknown action must not render a dialog that posts somewhere odd.
  {
    const page = await newPage();
    await page.goto(`${base}/prospect/${PROSPECT}/draft?verdictConfirm=kamu`);
    ck(
      (await page.locator("#cit-verdict-confirm").count()) === 0,
      "⛔ ismeretlen művelet-névre is megjelent a felugró",
    );
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\nverdict-dialog-dom-check: ${pass} zöld, ${fails.length} bukás`);
if (fails.length) {
  for (const f of fails) console.error(`  ⛔ ${f}`);
  process.exit(1);
}
process.exit(0);
