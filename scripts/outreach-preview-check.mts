// ⛔ THE OPERATOR MUST SEE THE WHOLE LETTER BEFORE SENDING IT (Elek FK-004 ①).
//
// What went wrong: the console's "Így néz ki a levél a címzett postafiókjában"
// preview was an iframe with a hard `height:560px`. The letter is ~1 180px tall, so
// it was cut off at the sign-off line — and everything that makes a cold commercial
// message LAWFUL lives below that cut: the signature, the small print, the
// UNSUBSCRIBE LINK and the legal-basis footer (§C.1/§C.2). There was no visible
// scrollbar either, so nothing on screen said "there is more". The operator was
// approving an irreversible message to a stranger having read two thirds of it.
//
// What this guard measures — in pixels, in a real browser, on the real route:
//   ① NO CLIPPING: the frame is at least as tall as the letter inside it.
//   ② THE LEGAL TAIL IS ACTUALLY VISIBLE: the unsubscribe link and the legal-basis
//      sentence resolve under elementFromPoint inside the frame's visible box.
//      (DOM presence is not visibility — measured the hard way more than once in
//      this codebase: an overflow ancestor clips an element that every isVisible()
//      call still calls visible.)
//   ③ NEGATIVE CONTROL: re-measure with the old fixed height forced back on, and
//      assert the guard goes RED. A guard that cannot fail is decoration.
//
// Usage: npx tsx scripts/outreach-preview-check.mts [--self-test]
//   --self-test runs ONLY the negative control and expects it to fail.

import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Frame, type Page } from "playwright-core";

import { config } from "../src/config.js";

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.CONSOLE_PORT = "0";

const SELF_TEST = process.argv.includes("--self-test");
/** The height the preview frame used to be pinned to — the bug, kept as the control. */
const BROKEN_HEIGHT = 560;

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`✅ ${what}`);
  else {
    failed++;
    console.error(`❌ ${what}${detail ? `\n     ${detail}` : ""}`);
  }
};

async function bootConsole(): Promise<{ port: number; cookie: string }> {
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
  if (!op) throw new Error("nincs operator_user a dev DB-ben");
  return { port: addr.port, cookie: mintOperatorCookieValue(op.id) };
}

/** Any prospect the console can draft for — the preview shape is the same for all. */
async function pickProspect(): Promise<string> {
  const { db } = await import("../src/db/client.js");
  const row = await db
    .selectFrom("prospect")
    .select("id")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (!row) throw new Error("nincs prospect a dev DB-ben — az őr nem tud mit mérni");
  return row.id;
}

interface Measurement {
  readonly frameBoxHeight: number;
  readonly letterHeight: number;
  readonly tailVisible: { unsubscribe: boolean; legal: boolean };
}

/**
 * Measure one viewport. `forceBroken` pins the old fixed height back on AFTER the
 * page's own fitting ran — that is the negative control, and it must produce exactly
 * the failure this guard exists to catch.
 */
async function measure(page: Page, url: string, forceBroken: boolean): Promise<Measurement> {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("iframe[data-cit-mailprev]");
  if (forceBroken) {
    await page.evaluate((h) => {
      const f = document.querySelector<HTMLIFrameElement>("iframe[data-cit-mailprev]");
      if (f) f.style.height = `${h}px`;
    }, BROKEN_HEIGHT);
  }
  // Let the hero image land and the fitter settle.
  await page.waitForTimeout(600);

  const frameBoxHeight = await page.evaluate(() => {
    const f = document.querySelector<HTMLIFrameElement>("iframe[data-cit-mailprev]");
    return f ? Math.round(f.getBoundingClientRect().height) : 0;
  });

  const frame = page.frames().find((fr: Frame) => fr.url().includes("/email-preview"));
  if (!frame) throw new Error("az előnézet-iframe nem töltött be");
  // ⚠️ The letter's INK EXTENT, not documentElement.scrollHeight — the latter is
  // floored at the frame's own viewport height, so a frame that is too TALL would
  // report a letter that is exactly as tall, and the comparison below would be
  // trivially true whatever the frame did.
  const letterHeight = await frame.evaluate(() => {
    let h = document.body ? document.body.scrollHeight : 0;
    const kids = document.body ? document.body.children : [];
    for (let i = 0; i < kids.length; i++) {
      h = Math.max(h, Math.ceil(kids[i]!.getBoundingClientRect().bottom));
    }
    return h;
  });

  // ⛔ PIXEL truth, not DOM truth: is the element at a point that lies INSIDE the
  // frame's visible box, and is that point actually occupied by it?
  // ⚠️ No named helpers inside evaluate(): the bundler rewrites them to a `__name`
  // call that does not exist in the page, and the whole measurement throws.
  const tailVisible = await frame.evaluate((visibleH: number) => {
    const results: Record<string, boolean> = { unsubscribe: false, legal: false };
    const targets: Array<[string, Element | undefined]> = [
      [
        "unsubscribe",
        Array.from(document.querySelectorAll("a")).find((a) => /unsubscribe/i.test(a.href)),
      ],
      [
        "legal",
        Array.from(document.querySelectorAll("p")).find((el) =>
          /jogos érdek|GDPR|Grt/iu.test(el.textContent ?? ""),
        ),
      ],
    ];
    for (const [key, el] of targets) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.bottom > visibleH) continue; // below the cut
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      results[key] = Boolean(at && (at === el || el.contains(at) || at.contains(el)));
    }
    return { unsubscribe: results.unsubscribe === true, legal: results.legal === true };
  }, frameBoxHeight);

  return { frameBoxHeight, letterHeight, tailVisible };
}

const VIEWPORTS = [
  { tag: "mobil 390px", width: 390, height: 844 },
  { tag: "asztali 1280px", width: 1280, height: 900 },
] as const;

async function run(forceBroken: boolean, label: string): Promise<number> {
  const before = failed;
  const { port, cookie } = await bootConsole();
  const prospectId = await pickProspect();
  const url = `http://localhost:${port}/prospect/${prospectId}/draft`;

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addCookies([
        { name: "cit_op_session", value: cookie, domain: "localhost", path: "/" },
      ]);
      const page = await context.newPage();
      const m = await measure(page, url, forceBroken);
      const where = `${label} / ${vp.tag}`;

      say(
        m.frameBoxHeight >= m.letterHeight,
        `${where}: az előnézet nem vág (keret ${m.frameBoxHeight}px ≥ levél ${m.letterHeight}px)`,
        `a levélből ${Math.max(0, m.letterHeight - m.frameBoxHeight)}px nem látszik`,
      );
      say(m.tailVisible.unsubscribe, `${where}: a LEIRATKOZÁS-link pixelben látszik`);
      say(m.tailVisible.legal, `${where}: a JOGALAP-sor pixelben látszik`);

      await context.close();
    }
  } finally {
    await browser.close();
  }
  return failed - before;
}

const newFailures = await run(SELF_TEST, SELF_TEST ? "ÖNTESZT (rögzített 560px)" : "szállított felület");

if (SELF_TEST) {
  console.log("\n── Önteszt ─────────────────────────────────────────────────────");
  if (newFailures > 0) {
    console.log(`✅ az őr PIROS a régi, rögzített ${BROKEN_HEIGHT}px-es kereten (${newFailures} bukás) — tud bukni`);
    process.exit(0);
  }
  console.error(`❌ az őr ZÖLD maradt a szándékosan visszarontott kereten — VAK, nem őr`);
  process.exit(1);
}

console.log(failed === 0 ? "\n🟢 outreach-preview-check: rendben" : `\n🔴 outreach-preview-check: ${failed} hiba`);
process.exit(failed === 0 ? 0 : 1);
