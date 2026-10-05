import { chromium } from "playwright-core";
const base = new URL(".", import.meta.url).href;
const b = await chromium.launch({ executablePath: process.env.CP }); const out = [];
const ok = (c, m) => out.push((c ? "PASS " : "FAIL ") + m);
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const p = await b.newPage({ viewport: vp }); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  // ---- forras ----
  await p.goto(base + "forras.html"); await p.waitForTimeout(400);
  ok(await p.$eval("#stage", (e) => e.dataset.size) === (vp.width < 600 ? "mobile" : "desktop"), `[${vp.width}] forras: start size`);
  ok(await p.$$eval("#photos img", (a) => a.every((i) => i.naturalWidth > 0)), `[${vp.width}] forras: 4 photos load`);
  ok(await p.isHidden("#v-stale"), `[${vp.width}] forras: stale flag hidden by default`);
  ok((await p.textContent("#v-flag")).includes("5 / 5"), `[${vp.width}] forras: ★1 warning 5/5`);
  await p.click('[data-vf="high"]'); ok((await p.$$("#voice .item")).length === 0, `[${vp.width}] forras: ★4–5 filter → 0`);
  await p.click('[data-vf="all"]'); ok((await p.$$("#voice .item")).length === 5, `[${vp.width}] forras: all → 5`);
  await p.check("#st-stale"); ok(await p.isVisible("#v-stale") && (await p.$$("#voice .item")).length === 0, `[${vp.width}] forras: stale → no voice + notice`);
  await p.click("#raw-t"); ok(!(await p.textContent("#raw")).includes("guestVoice"), `[${vp.width}] forras: raw pack drops guestVoice when stale`);
  await p.check("#st-noregion"); ok((await p.textContent("#kv-id")).includes("NINCS ADAT") && !(await p.textContent("#raw")).includes('"region"'), `[${vp.width}] forras: unknown region omitted`);
  await p.click('[data-open="dt0"]'); ok(await p.$eval("#dt0", (e) => e.classList.contains("open")), `[${vp.width}] forras: expand text`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${vp.width}] forras: no horizontal scroll`);
  // ---- urlap ----
  await p.goto(base + "urlap.html"); await p.waitForTimeout(300);
  ok(!(await p.isDisabled("#go")), `[${vp.width}] urlap: sample → button enabled`);
  ok((await p.textContent('[data-f="sellingPoints"] .n')).includes("4 tény") && (await p.textContent('[data-sprow="4"] .msg')).includes("nincs szó szerint"), `[${vp.width}] urlap: fake quote drops (4 ok, 1 drops)`);
  await p.fill("#in-hero\\.lead", ""); ok(await p.isDisabled("#go") && (await p.textContent('[data-f="hero.lead"] .msg')).includes("nem lehet üres"), `[${vp.width}] urlap: empty lead → error + disabled`);
  await p.fill("#in-hero\\.lead", "x".repeat(141)); ok((await p.textContent('[data-f="hero.lead"] .n')) === "141 / 140" && await p.isDisabled("#go"), `[${vp.width}] urlap: 141/140 over`);
  await p.fill("#in-hero\\.lead", "  Játszótér   a kertben,  panoráma  "); ok((await p.textContent('[data-f="hero.lead"] .n')) === "29 / 140", `[${vp.width}] urlap: whitespace normalized in count`);
  ok((await p.textContent('[data-f="hero.accent"] .msg')).includes("Nincs benne szó szerint"), `[${vp.width}] urlap: accent not in lead → warning`);
  await p.fill("#in-hero\\.accent", "panoráma"); ok((await p.innerHTML('[data-f="hero.lead"] .live')).includes("<em>panoráma</em>"), `[${vp.width}] urlap: live italic`);
  await p.fill('[data-hl="0"]', "Bézs csempés fürdőszoba"); ok((await p.textContent('[data-f="highlights"] .msg')).includes("Kiesik"), `[${vp.width}] urlap: decor highlight drops`);
  for (let i = 0; i < 2; i++) await p.click("#hl-add"); ok(await p.isDisabled("#hl-add") && (await p.$$("#hl input")).length === 6, `[${vp.width}] urlap: highlights cap 6`);
  await p.fill("#in-accent", "#12zz45"); ok(await p.isDisabled("#go"), `[${vp.width}] urlap: bad hex → disabled`);
  await p.fill("#in-accent", "#2f7"); ok(!(await p.isDisabled("#go")), `[${vp.width}] urlap: 3-digit hex ok (parseHex)`);
  await p.uncheck('[data-tpl="tilted-gallery"]'); await p.uncheck('[data-tpl="dopamine"]'); ok(await p.isDisabled("#go"), `[${vp.width}] urlap: no template → disabled`);
  await p.check('[data-tpl="dopamine"]'); ok((await p.textContent('[data-where="hero.eyebrow"]')).includes("dopamine: látszik"), `[${vp.width}] urlap: per-template visibility`);
  await p.check("#st-cap"); ok(await p.isDisabled("#go") && await p.isVisible("#cap"), `[${vp.width}] urlap: AI cap → blocked`);
  await p.uncheck("#st-cap"); await p.check('[data-tpl="tilted-gallery"]');
  await p.fill("#in-tagline", "Medence a kertben, a vendégek kedvence."); await p.click("#go");
  await p.waitForSelector("#cards .rc", { timeout: 6000 });
  ok((await p.$$("#cards .rc")).length === 2 && (await p.textContent("#cards")).includes("Poe írta") && (await p.textContent("#cards")).includes("fennakadt"), `[${vp.width}] urlap: 2 cards, Poe provenance, guard flags medence`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${vp.width}] urlap: no horizontal scroll`);
  await p.click("#st-empty"); ok(await p.isDisabled("#go"), `[${vp.width}] urlap: empty form → disabled`);
  ok(errs.length === 0, `[${vp.width}] JS errors: ${errs.length} ${errs.join(" | ")}`);
  await p.close();
}
await b.close(); console.log(out.join("\n")); console.log(out.filter((x) => x.startsWith("FAIL")).length + " FAIL");
