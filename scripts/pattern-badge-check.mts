// Guard for the OPERATOR pattern badge (which template/skin drew this mock?).
//
//   npx tsx scripts/pattern-badge-check.mts
//
// Measures three things that can each fail silently:
//   ① the badge is THERE and NAMES the pattern on the operator preview (/mock/:id),
//   ② it is genuinely VISIBLE — a template's own CSS can out-specify an injected overlay
//      (measured: aurora.ts "body>*{position:relative}" drops it to the page bottom), so
//      the verdict is elementFromPoint, not display:block,
//   ③ ⛔ it NEVER reaches a buyer: the lead-facing /configure/:id must not carry it, and
//      neither may the stored file on disk.
process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { once } from "node:events";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { mintOperatorCookieValue } from "../src/auth/operatorAuth.js";
import { patternSummary, type PatternInputs } from "../src/generator/patternBadge.js";

const fails: string[] = [];
const ok = (msg: string, cond: boolean) => {
  console.log(`${cond ? "  ✅" : "  ❌"} ${msg}`);
  if (!cond) fails.push(msg);
};

const arts = await db
  .selectFrom("mock_artifact")
  .select(["id", "path", "inputs"])
  .orderBy("generated_at", "desc")
  .limit(6)
  .execute();
if (!arts.length) {
  console.error("❌ nincs mock_artifact a dev DB-ben — az őr nem tud mérni");
  process.exit(1);
}

process.env.CONSOLE_PORT = "0";
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
const base = `http://127.0.0.1:${addr.port}`;
const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
if (!op) throw new Error("nincs operator_user a dev DB-ben");
const cookie = `cit_op_session=${mintOperatorCookieValue(op.id)}`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });

for (const a of arts) {
  const inputs = (a.inputs ?? {}) as PatternInputs;
  const summary = patternSummary(inputs);
  const label = `${inputs.template ?? inputs.archetype ?? "?"}/${inputs.skin ?? "?"}`;
  console.log(`\n▸ ${label} (${a.path})`);
  if (!summary) {
    ok(`${label}: a minta-összefoglaló üres (se sablon, se archetípus, se skin)`, false);
    continue;
  }

  // ① the operator preview names the pattern
  const opRes = await fetch(`${base}/mock/${a.id}`, { headers: { cookie } });
  const opHtml = await opRes.text();
  if (opHtml.includes("nem található a lemezen")) {
    console.log("  ⏭  a mock fájl nincs meg ebben a fában — kihagyva");
    continue;
  }
  ok(`${label}: a jelölő ott van az operátori előnézeten`, opHtml.includes("cit-pbadge"));
  ok(`${label}: a sáv kimondja a mintát ("${summary}")`, opHtml.includes(summary));
  ok(
    `${label}: a fül címe a mintával kezdődik`,
    new RegExp(`<title>${summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — `).test(opHtml),
  );

  // ③ NEGATIVE: the buyer-facing configurator and the stored file stay clean
  const buyerHtml = await (await fetch(`${base}/configure/${a.id}`)).text();
  ok(`${label}: ⛔ a vevő-oldali /configure NEM kapja meg`, !buyerHtml.includes("cit-pbadge"));
  const stored = await readFile(a.path, "utf8").catch(() => "");
  ok(`${label}: ⛔ a tárolt fájl tiszta maradt`, !stored.includes("cit-pbadge"));

  // ② visible for real, and behaves
  for (const [w, h, vp] of [
    [390, 844, "mobil"],
    [1280, 900, "desktop"],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([
      { name: "cit_op_session", value: cookie.split("=")[1]!, domain: "127.0.0.1", path: "/" },
    ]);
    const p = await ctx.newPage();
    const errs: string[] = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(`${base}/mock/${a.id}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(700);
    const hit = async (sel: string) =>
      p.evaluate((s) => {
        const e = document.querySelector(s);
        if (!e) return { shown: false, hit: false };
        const r = e.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const t =
          r.width && r.height && cy > 0 && cy < innerHeight
            ? document.elementFromPoint(cx, cy)
            : null;
        return { shown: getComputedStyle(e).display !== "none", hit: !!t?.closest(".cit-pbadge") };
      }, sel);

    ok(`${label}/${vp}: a sáv PIXELEN is látszik`, (await hit(".cit-pbadge__bar")).hit);
    ok(`${label}/${vp}: a panel alapból csukva`, !(await hit(".cit-pbadge__panel")).shown);
    await p.click(".cit-pbadge__btn");
    await p.waitForTimeout(300);
    ok(`${label}/${vp}: Részletek → a panel látszik`, (await hit(".cit-pbadge__panel")).hit);
    await p.click(".cit-pbadge__x");
    await p.waitForTimeout(300);
    const dot = await p.evaluate(() => {
      const e = document.querySelector(".cit-pbadge")!;
      return { hidden: e.getAttribute("data-hidden"), w: Math.round(e.getBoundingClientRect().width) };
    });
    ok(`${label}/${vp}: × → pöttyé zsugorodik`, dot.hidden === "1" && dot.w < 80);
    await p.click(".cit-pbadge__dot");
    await p.waitForTimeout(300);
    ok(
      `${label}/${vp}: a pöttyből visszajön`,
      (await p.evaluate(() => document.querySelector(".cit-pbadge")!.getAttribute("data-hidden"))) ===
        "0",
    );
    ok(`${label}/${vp}: nincs JS-hiba (${errs.join("|")})`, errs.length === 0);
    await ctx.close();
  }
}

await browser.close();
await db.destroy();
server.close();

if (fails.length) {
  console.error(`\n❌ pattern-badge-check: ${fails.length} bukás`);
  process.exit(1);
}
console.log("\n✅ pattern-badge-check: a minta-jelölő megszólal az operátornak, és NEM megy ki a vevőnek");
process.exit(0);
