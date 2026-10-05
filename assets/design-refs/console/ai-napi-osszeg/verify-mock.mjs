// Click-through proof of the frozen plan (A + B). Run: node assets/design-refs/console/ai-napi-osszeg/verify-mock.mjs
// SHOT_DIR=<dir> also writes the per-state screenshots.
import { chromium } from "playwright-core";
const here = new URL(".", import.meta.url).pathname;
const url = "file://" + here + "plan.html";
const out = process.env.SHOT_DIR ? process.env.SHOT_DIR + "/" : null;
const b = await chromium.launch(); const errs = []; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
for (const [size, vw] of [["mobil", 390], ["asztali", 1280]]) {
  const p = await b.newPage({ viewport: { width: vw, height: 900 } });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
  await p.goto(url); await p.waitForTimeout(300);
  for (const st of ["dev","prod"]) { await p.click(`[data-st="${st}"]`); const sw = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= vw, `${size} ${st} no h-overflow (${sw})`); }
  await p.addStyleTag({ content: ".dr-top{position:static!important}.ai-bar>i{transition:none!important}" });
  ok(await p.evaluate(() => document.body.className) === (vw < 900 ? "is-mobile" : "is-desktop"), "auto size " + size);
  const sec = i => p.locator(".dr-stage").nth(i);
  for (const st of ["dev", "near", "blocked", "prod"]) {
    await p.click(`[data-st="${st}"]`);
    const lv = await p.getAttribute("[data-ai-pill]", "data-lv");
    ok(lv === { dev: "ok", near: "near", blocked: "blocked", prod: "blocked" }[st], `${size} ${st} lv=${lv}`);
    const dis = await p.isDisabled("[data-gen]");
    ok(dis, `${size} ${st} gen disabled with no pick`);
    if (st === "blocked" || st === "prod") {
      const msg = await p.textContent('[data-v="B"] [data-show="blocked"] span');
      ok(/^Elérted a napi AI-költségplafont: ma \$\d+\.\d\d \/ \$20\.00 \(\d+ mock\)\. Új generálás holnap 0:00-tól \(budapesti idő\) indítható\.$/.test(msg), "capmsg " + msg);
      await p.click('[data-v="B"] .tpl-card >> nth=0'); ok(await p.isDisabled("[data-gen]"), "blocked stays disabled after pick");
      await p.click('[data-v="B"] .tpl-card >> nth=0');
    }
    // A popover
    await p.click("[data-ai-pill]"); ok(await p.isVisible("[data-ai-pop]"), "pop opens");
    if (out) await sec(0).screenshot({ path: `${out}A-${st}-${size}.png` });
    await p.keyboard.press("Escape"); ok(!(await p.isVisible("[data-ai-pop]")), "pop esc");
    if (out) await sec(1).screenshot({ path: `${out}B-${st}-${size}.png` });
  }
  // B flow: near + pick 3 → over-cap warning → run → blocked
  await p.click('[data-st="near"]');
  for (const i of [0, 1, 2]) await p.click(`[data-v="B"] .tpl-card >> nth=${i}`);
  ok(!(await p.isDisabled("[data-gen]")), "near+3 enabled");
  ok(await p.isVisible("[data-over]"), "over-cap warning visible (18.40 + 3×0.657 > 20)" );
  if (out) await sec(1).screenshot({ path: `${out}B-near-3pick-${size}.png` });
  await p.click("[data-gen]");
  ok(await p.getAttribute("[data-ai-pill]", "data-lv") !== "ok", "after run lv");
  // dev + 1 pick → no over warning, enabled
  await p.click('[data-st="dev"]'); await p.click('[data-v="B"] .tpl-card >> nth=0');
  ok(!(await p.isVisible("[data-over]")), "dev+1 no over"); ok(!(await p.isDisabled("[data-gen]")), "dev+1 enabled");
  // +1 until blocked
  let n = 0; while ((await p.getAttribute("[data-ai-pill]", "data-lv")) !== "blocked" && n < 200) { await p.click("#plus"); n++; }
  ok(n > 0 && n < 200, "plus reaches blocked after " + n);
  // theme dark
  await p.click('[data-theme="dark"]'); ok(await p.getAttribute(".cf", "data-citui-theme") === "dark", "dark");
  await p.close();
}
console.log({ pass, fail, jsErrors: errs });
if (fail || errs.length) process.exitCode = 1;
await b.close();
