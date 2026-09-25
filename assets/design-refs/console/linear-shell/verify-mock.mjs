// Draft verifier: element screenshots of the mock frame (both sizes × variants × themes)
// + click-through of every interactive part, JS errors counted. Output next to the mock.
import { chromium } from "playwright-core";
import path from "node:path";
import { pathToFileURL } from "node:url";
const dir = path.resolve("assets/design-refs/_drafts");
const url = pathToFileURL(path.join(dir, "konzol-linear.html")).href;
const browser = await chromium.launch();
const errors = [];
async function open(vp, hash) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(hash + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(hash + ": console " + m.text()); });
  await page.goto(url + "#" + hash);
  await page.waitForTimeout(400);
  return { page, ctx };
}
const M = { width: 390, height: 844 }, D = { width: 1240, height: 1000 };
const shots = [
  ["A-dash-light-desktop", D, "v=A&p=dash&t=light&s=desktop"], ["A-dash-light-mobile", M, "v=A&p=dash&t=light&s=mobile"],
  ["A-leads-light-desktop", D, "v=A&p=leads&t=light&s=desktop"], ["A-crm-light-desktop", D, "v=A&p=crm&t=light&s=desktop"], ["A-crm-light-mobile", M, "v=A&p=crm&t=light&s=mobile"], ["A-leads-light-mobile", M, "v=A&p=leads&t=light&s=mobile"],
  ["B-dash-light-desktop", D, "v=B&p=dash&t=light&s=desktop"], ["B-dash-light-mobile", M, "v=B&p=dash&t=light&s=mobile"],
  ["B-leads-light-desktop", D, "v=B&p=leads&t=light&s=desktop"], ["B-leads-light-mobile", M, "v=B&p=leads&t=light&s=mobile"],
  ["A-dash-dark-desktop", D, "v=A&p=dash&t=dark&s=desktop"], ["B-leads-dark-mobile", M, "v=B&p=leads&t=dark&s=mobile"],
];
for (const [name, vp, hash] of shots) {
  const { page, ctx } = await open(vp, hash);
  await page.locator("#frame").screenshot({ path: path.join(dir, `shot-${name}.png`) });
  await ctx.close();
}
// extra states: mobile drawer (A), qual popover open (A desktop leads), ⌘K dropdown (B desktop)
{ const { page, ctx } = await open(M, "v=A&p=leads&t=light&s=mobile");
  await page.click("#topMenu"); await page.waitForTimeout(200);
  await page.locator("#frame").screenshot({ path: path.join(dir, "shot-A-menu-mobile.png") }); await ctx.close(); }
{ const { page, ctx } = await open(D, "v=A&p=leads&t=light&s=desktop");
  await page.click("#qualChip"); await page.waitForTimeout(200);
  await page.locator("#frame").screenshot({ path: path.join(dir, "shot-A-leads-filter-desktop.png") }); await ctx.close(); }
{ const { page, ctx } = await open(D, "v=B&p=dash&t=light&s=desktop");
  await page.fill("#srchIn", "partner"); await page.waitForTimeout(200);
  await page.locator("#frame").screenshot({ path: path.join(dir, "shot-B-search-desktop.png") }); await ctx.close(); }

// ── behaviour checks ──
const R = [];
const ok = (n, c) => R.push((c ? "PASS " : "FAIL ") + n);
{ const { page, ctx } = await open(D, "v=A&p=dash&t=light&s=desktop");
  ok("A desktop: alapból minden modul csukva (Irányítópult + Súgó + 4 modul-sor)", (await page.locator("#nav a").count()) === 2 && (await page.locator("#nav .grp").count()) === 4 && (await page.locator("#nav .grp.is-open").count()) === 0);
  await page.click("#nav .grp[data-grp=crm] span"); await page.waitForTimeout(120);
  ok("CRM sorra kattintva: a CRM irányítópultja + a fa nyitva (7 funkció)", (await page.locator("#crumb").innerText()).replace(/\s+/g," ").trim() === "Konzol CRM" && (await page.locator("#nav .grp.is-open").count()) === 1 && (await page.locator("#nav a.sub").count()) === 7 && (await page.locator(".fl a").count()) === 7);
  ok("CRM irányítópult: a CRM widget + 3 figyelmeztetés + funkció-lista", (await page.locator(".wc").count()) === 1 && (await page.locator(".iss").count()) === 3);
  await page.click("#nav .grp[data-grp=fin] .chev"); await page.waitForTimeout(120);
  ok("a nyíl csak hajtogat: Pénzügy kinyílt, a lap maradt a CRM", (await page.locator("#nav .grp.is-open").count()) === 2 && (await page.locator("#crumb").innerText()).includes("CRM"));
  await page.click("#nav a.sub >> text=Partnerek"); await page.waitForTimeout(120);
  ok("Partnerek lap: csak a Pénzügy nyitva, a CRM becsukódott, útvonal Konzol › Pénzügy › Partnerek", (await page.locator("#nav .grp.is-open").count()) === 1 && (await page.locator("#nav .grp.is-open").getAttribute("data-grp")) === "fin" && (await page.locator("#crumb").innerText()).includes("Partnerek"));
  await page.click("#crumb >> text=Pénzügy"); await page.waitForTimeout(120);
  ok("útvonal Pénzügy → a Pénzügy irányítópultja (Riport/Rendszer: nincs figyelmeztetés → nincs üres doboz)", (await page.locator(".fl a").count()) === 5 && (await page.locator(".iss").count()) === 0);
  await page.click("#nav a >> text=Irányítópult"); await page.waitForTimeout(120);
  ok("Irányítópulton a ← rejtve", (await page.locator("#topBack").evaluate((e) => getComputedStyle(e).visibility)) === "hidden");
  await page.fill("#srchIn", "partner");
  ok("⌘K: 'partner' → 2 találat", (await page.locator("#srchDd a").count()) === 2);
  await page.press("#srchIn", "Enter"); await page.waitForTimeout(150);
  ok("⌘K Enter → Partnerek lap, útvonal Konzol › Pénzügy › Partnerek", (await page.locator("#crumb").innerText()).includes("Partnerek") && (await page.locator("#crumb").innerText()).includes("Pénzügy"));
  ok("alap-lapon a ← látható", (await page.locator("#topBack").evaluate((e) => getComputedStyle(e).visibility)) === "visible");
  await page.click("#topBack"); await page.waitForTimeout(150);
  ok("← visszavisz az Irányítópultra", (await page.locator("#crumb").innerText()).trim() === "Irányítópult");
  await page.click("#railBtn"); ok("sáv ikonsávvá csukható (56px)", Math.round((await page.locator(".side").boundingBox()).width) === 56);
  await page.click("#railBtn");
  await page.click("#themeBtn2"); ok("téma-váltó → dark", (await page.locator("#frame").getAttribute("data-theme")) === "dark");
  await page.goto(url + "#v=A&p=dash&s=desktop"); await page.reload(); await page.waitForTimeout(300);
  ok("a téma újratöltés után megmarad (localStorage)", (await page.locator("#frame").getAttribute("data-theme")) === "dark");
  const white = await page.evaluate(() => [...document.querySelectorAll("#frame *")].filter((e) => { const b = getComputedStyle(e).backgroundColor; return b === "rgb(255, 255, 255)"; }).length);
  ok("sötétben nincs #fff hátterű elem (fehér lyuk)", white === 0);
  await ctx.close(); }
{ const { page, ctx } = await open(D, "v=A&p=leads&t=light&s=desktop");
  ok("Lead-sor: 10 sor látható induláskor", (await page.locator("#leadTbl tbody tr:not(.hid)").count()) === 10);
  await page.click("#qualChip"); await page.locator("#qualPop label").first().click(); await page.waitForTimeout(100);
  ok("'nincs honlap' kikapcsolva → 1 sor (Camping Carina, elavult)", (await page.locator("#leadTbl tbody tr:not(.hid)").count()) === 1 && (await page.locator("#rowCnt").innerText()) === "1");
  ok("a chip felirata a szűrőből származik", (await page.locator("#qualChip").innerText()).includes("Kvalifikáció: elavult"));
  await page.click("text=Szűrők törlése"); await page.waitForTimeout(100);
  ok("Szűrők törlése → 10 sor", (await page.locator("#leadTbl tbody tr:not(.hid)").count()) === 10);
  await page.locator("#leadTbl tbody tr").first().click(); await page.waitForTimeout(100);
  ok("sorra kattintva lead-adatlap, útvonal Konzol › CRM › Lead-sor › Boróka ház", (await page.locator("#crumb").innerText()).includes("Lead-sor"));
  await ctx.close(); }
{ const { page, ctx } = await open(D, "v=B&p=dash&t=light&s=desktop");
  ok("B desktop: csak 6 modul-pont a sávban", (await page.locator("#nav a").count()) === 6);
  ok("B: 4 modul-kártya, 16 funkció", (await page.locator(".hc").count()) === 4 && (await page.locator(".hc li a").count()) === 16);
  await page.fill("#srchIn", "bizonylat"); await page.waitForTimeout(100);
  ok("B: a kereső a kártyákat is szűri (bizonylat → 2 funkció, 1 kártya)", (await page.locator(".hc li a:not(.hide)").count()) === 2 && (await page.locator(".hc:not(.hide)").count()) === 1);
  await page.press("#srchIn", "Escape"); await page.click(".hc__h >> nth=0"); await page.waitForTimeout(100);
  ok("B: modul-lapon fülsor 7 füllel (CRM)", (await page.locator(".tabs a").count()) === 7);
  await ctx.close(); }
{ const { page, ctx } = await open(M, "v=A&p=leads&t=light&s=mobile");
  ok("mobil: alsó sáv 5 elem", (await page.locator("#bnav a").count()) === 5);
  ok("mobil: az oldalsáv nem látszik", !(await page.locator(".side").isVisible()));
  const first = await page.locator("#leadTbl td").first().boundingBox();
  await page.locator(".tw").evaluate((e) => (e.scrollLeft = 400)); await page.waitForTimeout(100);
  const after = await page.locator("#leadTbl td").first().boundingBox();
  ok("mobil: Név oszlop ragad oldalra görgetve", Math.abs(first.x - after.x) < 1);
  await page.click("#topMenu"); await page.waitForTimeout(100);
  ok("mobil: Menü-fiók — Lead-sor lapon a CRM nyitva (7 alpont), a többi csukva", (await page.locator("#drawerBox .menu .grp.is-open").count()) === 1 && (await page.locator("#drawerBox .menu a.sub").count()) === 7);
  await page.click("#drawerBox >> text=Sötét mód"); ok("fiók: Sötét mód váltó működik", (await page.locator("#frame").getAttribute("data-theme")) === "dark");
  await ctx.close(); }
await browser.close();
console.log(R.join("\n"));
console.log("JS/console hibák:", errors.length, errors.slice(0, 5).join(" | "));
console.log("PASS:", R.filter((r) => r.startsWith("PASS")).length, "FAIL:", R.filter((r) => r.startsWith("FAIL")).length);
