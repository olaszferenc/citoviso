// gate-lane: own-fixture-only
// The console frame's guard — contract: assets/design-refs/console/linear-shell/README.md
// („Őr” section). Owner decree (2026-09-25): the tenant-admin's „Linear” design is the base
// of the internal console too, with module rows that are pages AND fold the tree.
//
// Why a browser and not a screenshot: the contract binds BEHAVIOUR — every module closed
// on the home and only the active one open elsewhere; the chevron that folds without
// navigating; the ← that is hidden on the home and points one level up elsewhere; a ⌘K
// index built from the SAME tree as the sidebar; a theme that survives a reload; a dark
// mode with no „white hole”; exactly five items on the phone's bottom bar. A static image
// looks the same whether these hold.
//
// Hermetic: the views render fixtures to a file inside a request context, the assets load
// from the repo, no DB and no HTTP — it runs on a fresh clone and in pre-commit.
//
//   npx tsx scripts/console-linear-check.mts
//   npx tsx scripts/console-linear-check.mts --self-test   (the red controls MUST fail)

process.env.CIT_SHOT = "1";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";
import { config } from "../src/config.js";
import { runWithConsoleLang, setConsoleNav } from "../src/console/i18nCtx.js";
import { activeTrail, navLeaves, navTree, type NavNumbers } from "../src/console/nav.js";
import { dashboardPage, layout, modulePage, type HubData } from "../src/console/views.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

// ── fixtures (representative, never personal) ───────────────────────────────────
const NUMBERS: NavNumbers = { players: 600, approvedMocks: 11, documents: 12, partners: 7, sellable: 13, catalog: 14 };
const DATA: HubData = {
  r: {
    total: { sent: 6, orderIntent: 6 },
    segments: [],
    leadTotals: { players: 600, leads: 260, mocks: 40, approved: 11 },
  } as unknown as HubData["r"],
  scrapeRunning: false,
  operatorName: "Ferenc",
  fin: { docs: 12, open: 3, overdue: 1, partners: 7, aamYearNetHuf: 4_200_000, aamLimitHuf: 18_000_000, aamFxDocs: 0 },
  sales: { on: 13, all: 14 },
  stale: null,
};

/** Render inside a request context, as the HTTP layer would (language + nav numbers). */
function inRequest<T>(fn: () => T): T {
  return runWithConsoleLang(() => {
    setConsoleNav(NUMBERS);
    return fn();
  });
}

const tmp = await mkdtemp(path.join(tmpdir(), "console-linear-"));
async function render(name: string, html: string): Promise<string> {
  const file = path.join(tmp, `${name}.html`);
  await writeFile(
    file,
    html
      .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
      .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`),
    "utf8",
  );
  return pathToFileURL(file).href;
}
const pages = {
  home: await render("home", inRequest(() => dashboardPage(DATA))),
  crm: await render("crm", inRequest(() => modulePage("crm", DATA)!)),
  leads: await render("leads", inRequest(() => layout("Aktív leadek", `<div class="panel"><h2>Aktív leadek</h2><p>260 sor</p></div>`, { active: "/leads" }))),
  leadPage: await render("lead", inRequest(() => layout("Boróka ház", `<div class="panel"><h2>Boróka ház</h2></div>`, { active: "/lead/abc" }))),
};

// ── the tree itself (no browser) ─────────────────────────────────────────────────
console.log("\nnav.ts — a fa:");
ok("ismeretlen modul → null (404), nem üres lap", inRequest(() => modulePage("nincs-ilyen", DATA)) === null);
ok("„/lead/abc” a Lead-sor alá esik (CRM › Lead-sor)", activeTrail("/lead/abc").map((n) => n.id).join(">") === "crm>leads");
ok("„/hub/crm” magát a CRM sort világítja", activeTrail("/hub/crm").map((n) => n.id).join(">") === "crm");
ok("„/partner/x” a Partnerek alá esik", activeTrail("/partner/x").map((n) => n.id).join(">") === "finance>partners");
ok("„/” csak az Irányítópultot", activeTrail("/").map((n) => n.id).join(">") === "home");
const leaves = navLeaves(navTree());
ok("minden levélnek van href-je és egyedi id-je", leaves.every((l) => l.leaf.href) && new Set(leaves.map((l) => l.leaf.id)).size === leaves.length);

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const SIZES = [
  { tag: "mobil 390", width: 390, height: 844 },
  { tag: "asztali 1280", width: 1280, height: 900 },
] as const;

/** Pure-white backgrounds inside the shell (the „white hole” of README ⑦). */
async function whiteHoles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>(".con-shell *, .con-drawer *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      if (getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)") out.push(String(el.className).slice(0, 40) || el.tagName);
    });
    return out;
  });
}

/** --self-test: the sabotage the guard MUST catch (one per red control). */
async function sabotage(page: Page, what: string): Promise<void> {
  if (!SELF_TEST) return;
  if (what === "back") await page.evaluate(() => document.querySelector(".con-back")?.remove());
  if (what === "fold") await page.evaluate(() => document.querySelectorAll(".con-nav__kids").forEach((k) => k.removeAttribute("hidden")));
  if (what === "white") await page.addStyleTag({ content: ".con-att{background:#fff !important}" });
  if (what === "bnav") await page.evaluate(() => document.querySelector(".con-bnav a:last-child")?.remove());
  if (what === "cmdk") await page.evaluate(() => document.querySelectorAll("[data-k-dd] a").forEach((a, i) => i > 0 && a.remove()));
}
const expectedRed = { back: 0, fold: 0, white: 0, bnav: 0, cmdk: 0 };
const okRed = (key: keyof typeof expectedRed, label: string, cond: boolean, detail = ""): void => {
  if (SELF_TEST && !cond) expectedRed[key]++;
  ok(label, cond, detail);
};

for (const size of SIZES) {
  const mobile = size.width < 900;
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  console.log(`\n${size.tag} — Irányítópult:`);
  await page.goto(pages.home);
  await sabotage(page, "back");
  await sabotage(page, "fold");
  okRed("back", "a ← az Irányítópulton rejtve", (await page.locator(".con-back.is-hidden").count()) === 1);
  okRed("fold", "alapból MINDEN modul csukva", (await page.locator(".con-nav__grp.is-open").count()) === 0 && (await page.locator(".con-nav__kids:not([hidden])").count()) === 0);
  ok("4 modul-sor a fában", (await page.locator(".con-nav .con-nav__grp").count()) === 4);
  ok("3 modul-widget (CRM · Pénzügy · Megkeresések)", (await page.locator("[data-widget]").count()) === 3);
  ok("„Figyelmet kér” lista a régi chipek predikátumaival (lejárt · nyitott · eladó · lead · adatgyűjtés)", (await page.locator("[data-attention] .con-att__row").count()) === 5);
  ok("nincs többé hero és modul-kártya", (await page.locator(".con-hero, .con-modgrid, .con-hubsearch").count()) === 0);
  ok("a Súgó a fában (help-collapse-check horgonya)", (await page.locator('.con-nav a[href="/help"]').count()) === 1);
  if (mobile) {
    await sabotage(page, "bnav");
    okRed("bnav", "alsó sáv: pontosan 5 elem (Irányítópult + 3 modul + Menü)", (await page.locator(".con-bnav a").count()) === 5);
    ok("az oldalsáv nem látszik", !(await page.locator(".con-side").isVisible()));
    await page.click(".con-top__menu");
    ok("a Menü-fiók kinyílik, benne a teljes fa", (await page.locator("#con-menu.on").count()) === 1 && (await page.locator("#con-menu .con-nav__grp").count()) === 4);
    await page.keyboard.press("Escape");
    ok("Escape csukja a fiókot", (await page.locator("#con-menu.on").count()) === 0);
  } else {
    ok("az oldalsáv 232 px", Math.round((await page.locator(".con-side").boundingBox())!.width) === 232);
    await page.click("[data-rail]");
    ok("ikonsávvá csukható (56 px)", Math.round((await page.locator(".con-side").boundingBox())!.width) === 56);
    await page.reload();
    ok("a sáv állapota megmarad újratöltés után", Math.round((await page.locator(".con-side").boundingBox())!.width) === 56);
    await page.click("[data-rail]");
    // ⌘K: the index is the SAME tree the sidebar shows.
    await page.fill("[data-k]", "partner");
    await sabotage(page, "cmdk");
    okRed("cmdk", "⌘K „partner” → 2 találat (Partnerek · Új partner rögzítése), az első kiemelve /partners-re", (await page.locator("[data-k-dd] a").count()) === 2 && (await page.locator("[data-k-dd] a.is-hi").getAttribute("href")) === "/partners");
    await page.fill("[data-k]", "xyzq");
    ok("⌘K nincs találat → mondja", (await page.locator(".con-k__none").count()) === 1);
    await page.keyboard.press("Escape");
  }

  console.log(`${size.tag} — CRM modul-irányítópult (/hub/crm):`);
  await page.goto(pages.crm);
  ok("útvonal: Konzol › CRM", (await page.locator(".con-crumb").innerText()).replace(/\s+/g, " ").trim() === "Konzol CRM");
  ok("a ← látható és egy szinttel feljebb (/) mutat", (await page.locator(".con-back:not(.is-hidden)").count()) === 1 && (await page.locator(".con-back").getAttribute("href")) === "/");
  const navSel = mobile ? "#con-menu" : ".con-nav";
  ok("CSAK a CRM nyitva, a 7 funkciója látszik", (await page.locator(`${navSel} .con-nav__grp.is-open`).count()) === 1 && (await page.locator(`${navSel} .con-nav__grp.is-open`).getAttribute("data-grp")) === "crm" && (await page.locator(`${navSel} .con-nav__kids:not([hidden]) .con-nav__sub`).count()) === 7);
  ok("a CRM widgetje + a CRM 3 figyelmeztetése + a 7 funkció listája", (await page.locator("[data-widget=crm]").count()) === 1 && (await page.locator("[data-widget]").count()) === 1 && (await page.locator("[data-attention] .con-att__row").count()) === 3 && (await page.locator("[data-functions] a").count()) === 7);
  ok("a funkció-lista számlálója = a sáv számlálója (600 · 11 · 13/14 eladó)", (await page.locator("[data-functions]").innerText()).includes("600") && (await page.locator("[data-functions]").innerText()).includes("13/14 eladó"));
  // The chevron folds WITHOUT navigating.
  const before = page.url();
  if (mobile) await page.click(".con-top__menu");
  await page.click(`${navSel} .con-nav__grp[data-grp=finance] [data-fold]`);
  ok("a nyíl csak hajtogat: Pénzügy kinyílt, a lap maradt", page.url() === before && (await page.locator(`${navSel} .con-nav__grp.is-open`).count()) === 2 && (await page.locator(`${navSel} .con-nav__grp[data-grp=finance] + .con-nav__kids:not([hidden]) .con-nav__sub`).count()) === 5);
  await page.click(`${navSel} .con-nav__grp[data-grp=finance] [data-fold]`);
  ok("…és vissza is csukja", (await page.locator(`${navSel} .con-nav__grp.is-open`).count()) === 1);

  console.log(`${size.tag} — Lead-sor + lead-lap (funkció-lap a fában):`);
  await page.goto(pages.leads);
  // The markup always carries the whole trail; the phone SHOWS only „parent › page"
  // (a four-part trail left one letter of the page name visible at 390 px).
  ok("útvonal (a jelölésben): Konzol › CRM › Lead-sor, a CRM a modul-irányítópultra visz", (await page.locator(".con-crumb").textContent())!.replace(/\s+/g, "") === "KonzolCRMLead-sor" && (await page.locator('.con-crumb a[href="/hub/crm"]').count()) === 1);
  ok(
    mobile ? "telefonon LÁTSZIK: CRM › Lead-sor (a „Konzol” rejtve)" : "asztalin LÁTSZIK: Konzol › CRM › Lead-sor",
    (await page.locator(".con-crumb").innerText()).replace(/\s+/g, " ").trim() === (mobile ? "CRM Lead-sor" : "Konzol CRM Lead-sor"),
  );
  ok("a ← a CRM irányítópultjára mutat", (await page.locator(".con-back").getAttribute("href")) === "/hub/crm");
  ok("a CRM nyitva, a Lead-sor aktív, a többi csukva", (await page.locator(`${navSel} .con-nav__grp.is-open`).count()) === 1 && (await page.locator(`${navSel} .con-nav__sub.is-active[href="/leads"]`).count()) === 1);
  await page.goto(pages.leadPage);
  ok("a lead adatlapja (/lead/…) is a Lead-sor alatt világít", (await page.locator(`${navSel} .con-nav__sub.is-active[href="/leads"]`).count()) === 1 && (await page.locator(".con-crumb b").innerText()) === "Boróka ház");

  console.log(`${size.tag} — téma:`);
  await page.goto(pages.home);
  if (mobile) {
    await page.click(".con-top__menu");
    await page.click("#con-menu [data-theme-toggle]");
    await page.keyboard.press("Escape");
  } else await page.click(".con-top__theme");
  ok("váltó → sötét", (await page.locator("html[data-citui-theme=dark]").count()) === 1);
  await page.reload();
  ok("a téma megmarad újratöltés után", (await page.locator("html[data-citui-theme=dark]").count()) === 1);
  await sabotage(page, "white");
  const holes = await whiteHoles(page);
  okRed("white", "sötétben nincs #fff hátterű felület (Irányítópult)", holes.length === 0, holes.slice(0, 4).join(", "));
  await page.goto(pages.leads);
  const holes2 = await whiteHoles(page);
  ok("sötétben nincs #fff hátterű felület (panel-os lap)", holes2.length === 0, holes2.slice(0, 4).join(", "));
  await page.evaluate(() => localStorage.clear());
  ok("nincs JS-hiba", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
await rm(tmp, { recursive: true, force: true });

if (SELF_TEST) {
  const hits = Object.values(expectedRed).filter((n) => n > 0).length;
  const pass = hits === Object.keys(expectedRed).length;
  console.log(`\n${pass ? "✅" : "⛔"} --self-test: ${hits} szabotázst fogott meg az ${Object.keys(expectedRed).length}-ből`);
  process.exit(pass ? 0 : 1);
}
console.log(bad ? `\n⛔ console-linear-check: ${bad} sértés` : "\n✅ console-linear-check: a keret a jóváhagyott terv szerint viselkedik");
process.exit(bad ? 1 : 0);
