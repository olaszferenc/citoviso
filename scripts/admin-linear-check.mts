// ADR-0224 — the tenant-admin „Linear" contract's guard
// (assets/design-refs/tenant-admin/admin-linear/README.md, „Őr" section).
//
// Why a browser and not a screenshot: the contract binds BEHAVIOUR — the back button
// hidden on one page and visible on the rest, no visible file field, no delete on demo
// photos, a grid/list toggle that switches, a theme that survives a reload, and a dark
// mode with no „white hole" surface. A static image looks the same whether these hold.
//
// Hermetic: adminDashboard() renders fixtures to a file, the assets load from the repo,
// no DB and no server — it runs on a fresh clone and in pre-commit.
//
//   npx tsx scripts/admin-linear-check.mts
//   npx tsx scripts/admin-linear-check.mts --self-test   (the red controls MUST fail)
//   npx tsx scripts/admin-linear-check.mts --kb          (+ kb-shot --check-committed, ADR-0220)

process.env.CIT_SHOT = "1";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";
import { config } from "../src/config.js";
import { adminDashboard } from "../src/server/adminViews.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
const WITH_KB = process.argv.includes("--kb");

let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

// ── fixtures (representative, never personal) ───────────────────────────────────
const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Nyugalom Vendégház",
  contactEmail: "kovacs.jozsef@gmail.com",
} as unknown as Parameters<typeof adminDashboard>[0];
const PHOTOS = [
  { url: "/assets/ui/tpl-organic.jpg", alt: "A kert nyáron" },
  { url: "/assets/ui/tpl-editorial.jpg", alt: "" },
  { url: "/assets/ui/tpl-watercolor.jpg", alt: "A terasz" },
];
const contentOf = (own: boolean) =>
  ({
    name: "Nyugalom Vendégház",
    tagline: "Csend, kert, Balaton",
    intro: "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal várjuk a vendégeinket.",
    highlights: [],
    photos: PHOTOS,
    usingOwnPhotos: own,
    status: "live",
    previewPath: null,
  }) as unknown as Parameters<typeof adminDashboard>[1];
const MV = {
  modules: [
    { id: "gallery", label: "Képek a szállásról", group: "offer", active: true, spine: false, priceMonthly: 490, cancelAtPeriodEnd: false, awaitingFirstCharge: false, supersededBy: null, publicDesc: null },
    { id: "rooms", label: "Szobák, apartmanok", group: "offer", active: true, spine: false, priceMonthly: 690, cancelAtPeriodEnd: false, awaitingFirstCharge: false, supersededBy: null, publicDesc: null },
  ],
  baseMonthly: 3900,
  totalMonthly: 5080,
} as unknown as NonNullable<Parameters<typeof adminDashboard>[2]["modules"]>;
const common = {
  modules: MV,
  siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
  previewToken: "demo",
  siteSlug: "nyugalom-vendeghaz",
  unreadMessages: 2,
  subSummary: { status: "active" as const, billingPeriod: "annual" as const, periodStart: "2026-06-28", periodEnd: "2027-06-28" },
  overview: {
    visitors7: 12,
    visitsByDay: [1, 3, 0, 2, 4, 1, 1],
    messages: [
      { id: "m1", subject: "Utolsó figyelmeztetés", sentAt: new Date("2026-08-29T10:00:00Z"), unread: true },
      { id: "m3", subject: "Számla — OV-2026-5", sentAt: new Date("2026-08-28T10:00:00Z"), unread: false },
    ],
  },
};

const tmp = await mkdtemp(path.join(tmpdir(), "admin-linear-"));
async function render(name: string, tab: string, own: boolean): Promise<string> {
  const html = adminDashboard(session, contentOf(own), { ...common, tab })
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `${name}.html`);
  await writeFile(file, html, "utf8");
  return pathToFileURL(file).href;
}
const pages = {
  overview: await render("overview", "attekintes", false),
  photosDemo: await render("photos-demo", "fotok", false),
  photosOwn: await render("photos-own", "fotok", true),
  texts: await render("texts", "szovegek", false),
};

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const SIZES = [
  { tag: "mobil 390", width: 390, height: 844 },
  { tag: "asztali 1280", width: 1280, height: 900 },
] as const;
const THEMES = ["light", "dark"] as const;

/** Pure-white backgrounds inside the shell (the „white hole" of README ⑧). The cover
 *  showcase paints its button white ON A PHOTO by contract, so it is excluded. */
async function whiteHoles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>(".adm-shell *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      if (getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)" && !el.closest(".adm-covc"))
        out.push(String(el.className).slice(0, 40) || el.tagName);
    });
    return out;
  });
}

/** --self-test: the sabotage the guard MUST catch (one per red control). */
async function sabotage(page: Page, which: "back" | "file" | "white" | "bnav"): Promise<void> {
  if (which === "back") await page.evaluate(() => document.querySelector(".adm-back")?.remove());
  if (which === "file") await page.addStyleTag({ content: ".adm-file[hidden]{display:block !important}" });
  if (which === "white") await page.addStyleTag({ content: ".adm-card,.adm-wc{background:#fff !important}" });
  if (which === "bnav") await page.evaluate(() => document.querySelector(".adm-bnav a")?.remove());
}

let selfTestHits = 0;
for (const size of SIZES) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("citui-theme", t);
      } catch {}
    }, theme);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const tag = `${size.tag} · ${theme}`;
    const mobile = size.width < 900;

    // ── Áttekintés ─────────────────────────────────────────────────────────────
    await page.goto(pages.overview);
    await page.waitForTimeout(150);
    if (SELF_TEST) await sabotage(page, "back");
    ok(`${tag}: a téma a gyökéren áll (${theme})`, (await page.getAttribute("html", "data-citui-theme")) === theme || (theme === "light" && !(await page.getAttribute("html", "data-citui-theme"))));
    ok(`${tag}: 3 widget az Áttekintésen`, (await page.locator(".adm-w [data-widget]").count()) === 3);
    ok(`${tag}: nyitókép-mutató jelen`, (await page.locator(".adm-covc img").count()) === 1);
    ok(`${tag}: teendő-lista jelen (fejléc + sorok)`, (await page.locator(".adm-todobox .adm-todo__h").count()) === 1 && (await page.locator(".adm-todo > li").count()) >= 3);
    const backHiddenOv = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".adm-back");
      if (!b) return "missing";
      return getComputedStyle(b).visibility === "hidden" || getComputedStyle(b).display === "none" ? "hidden" : "visible";
    });
    const backOk = backHiddenOv === "hidden";
    ok(`${tag}: a vissza-gomb REJTVE az Áttekintésen (de létezik)`, backOk, backHiddenOv);
    if (SELF_TEST && !backOk) selfTestHits++;
    if (mobile) {
      const n = await page.locator(".adm-bnav a").count();
      ok(`${tag}: a mobil alsó sávban PONTOSAN 5 elem`, n === 5, String(n));
      ok(`${tag}: az oldalsáv mobilon nem látszik`, !(await page.locator(".adm-side").isVisible()));
      ok(`${tag}: az előfizetés-kártya az Áttekintés alján (mobil)`, await page.locator(".adm-plan--m").isVisible());
    } else {
      ok(`${tag}: asztalin nincs alsó sáv`, !(await page.locator(".adm-bnav").isVisible()));
      ok(`${tag}: az oldalsáv csoportjai (4) és számlálói asztalin`, (await page.locator(".adm-side .adm-nav__g").count()) === 4 && (await page.locator(".adm-side .adm-nav__n").count()) >= 2);
      ok(`${tag}: az előfizetés-kártya az oldalsávban (asztali)`, await page.locator(".adm-side .adm-plan").isVisible());
    }
    if (theme === "dark") {
      if (SELF_TEST) await sabotage(page, "white");
      const holes = await whiteHoles(page);
      const clean = holes.length === 0;
      ok(`${tag}: sötét módban nincs #fff hátterű elem a tartalmi részen`, clean, holes.slice(0, 5).join(", "));
      if (SELF_TEST && !clean) selfTestHits++;
    }

    // ── Fotók (bemutató képek) ──────────────────────────────────────────────────
    await page.goto(pages.photosDemo);
    await page.waitForTimeout(150);
    if (SELF_TEST) await sabotage(page, "file");
    const backVisible = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".adm-back");
      return !!b && getComputedStyle(b).visibility !== "hidden" && b.getBoundingClientRect().height > 0;
    });
    ok(`${tag}: a vissza-gomb LÁTHATÓ a Fotókon`, backVisible);
    const visibleFile = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('input[type="file"]')).filter((i) => {
        const cs = getComputedStyle(i);
        return cs.display !== "none" && cs.visibility !== "hidden" && i.getBoundingClientRect().width > 0;
      }).length,
    );
    const fileOk = visibleFile === 0 && (await page.locator('input[type="file"]').count()) >= 1;
    ok(`${tag}: nincs LÁTHATÓ fájlmező a Fotókon (a rejtett létezik)`, fileOk, `látható: ${visibleFile}`);
    if (SELF_TEST && !fileOk) selfTestHits++;
    ok(`${tag}: bemutató állapotban NINCS törlés-gomb`, (await page.locator("form[data-del], .adm-ib--del, [data-bulkdel]:visible").count()) === 0);
    ok(`${tag}: bemutató állapotban nincs Kijelölés-gomb`, (await page.locator("[data-selmode]:visible").count()) === 0);
    ok(`${tag}: a húzza-ide sáv és a „Fotók választása" címke jelen`, (await page.locator("#adm-drop label[for='adm-file']").count()) === 1);
    ok(`${tag}: a fejlécben a Fotók elsődleges gombja (Feltöltés)`, (await page.locator(".adm-top label[for='adm-file']").count()) === 1);
    if (mobile) ok(`${tag}: a „Fényképezés" mobilon látszik`, await page.locator("label[for='adm-file-cam']").isVisible());
    else ok(`${tag}: a „Fényképezés" asztalin nem látszik`, !(await page.locator("label[for='adm-file-cam']").isVisible()));
    // grid → list
    ok(`${tag}: indulásra rács`, (await page.getAttribute("#adm-photos", "data-view")) === "grid" && (await page.locator(".adm-pgrid").isVisible()));
    await page.click("[data-view-seg] [data-view='list']");
    await page.waitForTimeout(100);
    ok(`${tag}: a Lista váltó működik (rács rejtve, sorok látszanak)`, (await page.getAttribute("#adm-photos", "data-view")) === "list" && (await page.locator(".adm-rows").isVisible()) && !(await page.locator(".adm-pgrid").isVisible()));
    // lightbox
    await page.click(".adm-r[data-i='1'] img");
    await page.waitForTimeout(150);
    ok(`${tag}: nagyítás nyílik, számlálóval`, (await page.locator("#adm-lb.on").count()) === 1 && /2 \/ 3/.test((await page.locator(".adm-lb__top b").textContent()) ?? ""));
    await page.keyboard.press("Escape");
    ok(`${tag}: Esc zárja a nagyítást`, (await page.locator("#adm-lb.on").count()) === 0);
    if (mobile) {
      if (SELF_TEST) await sabotage(page, "bnav");
      const n = await page.locator(".adm-bnav a").count();
      ok(`${tag}: a Fotókon is 5 elem az alsó sávban`, n === 5, String(n));
      if (SELF_TEST && n !== 5) selfTestHits++;
      // drawer opens (JS) and closes
      await page.click("[data-drawer-open]");
      await page.waitForTimeout(100);
      ok(`${tag}: a Menü kinyitja a bal fiókot`, await page.locator("#adm-menu .adm-menu").isVisible());
      ok(`${tag}: a fiókban a téma-sor és a Kilépés`, (await page.locator("#adm-menu [data-theme-toggle]").count()) === 1 && (await page.locator("#adm-menu a[href='/logout']").count()) === 1);
      await page.keyboard.press("Escape");
      ok(`${tag}: Esc zárja a fiókot`, !(await page.locator("#adm-menu .adm-menu").isVisible()));
    }
    if (!mobile) {
      const before = (await page.getAttribute("html", "data-citui-theme")) ?? "light";
      await page.click(".adm-top [data-theme-toggle]");
      await page.waitForTimeout(50);
      const after = (await page.getAttribute("html", "data-citui-theme")) ?? "light";
      ok(`${tag}: a téma-váltó vált (${before} → ${after})`, before !== after);
    }
    ok(`${tag}: JS-hiba 0`, errors.length === 0, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
}

// ── positive control: with OWN photos the delete controls exist ─────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(pages.photosOwn);
  await page.waitForTimeout(100);
  ok("saját fotóknál VAN törlés-gomb (a bemutató-tiltás nem renderelési hiba)", (await page.locator("form[data-del]").count()) >= 3);
  ok("saját fotóknál van Kijelölés-gomb", (await page.locator("[data-selmode='1']:visible").count()) === 1);
  await page.click("[data-selmode='1']");
  await page.click(".adm-t[data-i='0'] [data-sel]");
  await page.click(".adm-t[data-i='2'] [data-sel]");
  ok("a kijelölés számol (2 kijelölve) és a tömeges Törlés él", /2 /.test((await page.locator("[data-selcount]").textContent()) ?? "") && !(await page.locator("[data-bulkdel]").isDisabled()));
  await page.click("[data-bulkdel]");
  await page.waitForTimeout(100);
  ok("a tömeges törlés MEGERŐSÍTŐ párbeszédet nyit", (await page.locator("#adm-dlg.on").count()) === 1);
  await page.click("#adm-dlg [data-no]");
  ok("a Mégsem zárja a párbeszédet", (await page.locator("#adm-dlg.on").count()) === 0);
  // README ⑧: the choice PERSISTS — toggled by the click, read back after a reload
  // (this context has NO init script, so only the stored value can restore it).
  await page.goto(pages.photosDemo);
  await page.waitForTimeout(100);
  await page.click(".adm-top [data-theme-toggle]");
  await page.waitForTimeout(50);
  const chosen = (await page.getAttribute("html", "data-citui-theme")) ?? "light";
  await page.reload();
  await page.waitForTimeout(150);
  const restored = (await page.getAttribute("html", "data-citui-theme")) ?? "light";
  ok(`a téma-választás újratöltés után is megmarad (${chosen} → ${restored})`, chosen === "dark" && restored === "dark");
  // a plain tab keeps the frame: back visible, no primary button
  await page.goto(pages.texts);
  ok("a többi fül a keretet kapja (útvonal + vissza, elsődleges gomb nélkül)", (await page.locator(".adm-crumb b").textContent()) === "Szövegek" && (await page.locator(".adm-top label[for='adm-file']").count()) === 0);
  await ctx.close();
}

await browser.close();
await rm(tmp, { recursive: true, force: true });

if (WITH_KB) {
  console.log("\n── kb-shot --check-committed (ADR-0220: a súgó-képek frissek) ──");
  const r = spawnSync("npx", ["tsx", "scripts/kb-shot.mts", "--check-committed"], { cwd: ROOT, encoding: "utf8" });
  ok("a commitolt súgó-képek frissek", r.status === 0, (r.stdout + r.stderr).split("\n").filter((l) => l.includes("ELAVULT") || l.startsWith("   ")).slice(0, 6).join(" · "));
}

if (SELF_TEST) {
  // The four red controls: back button removed, file field shown, #fff in dark, bottom bar item removed.
  const pass = selfTestHits >= 4;
  console.log(`\n${pass ? "✅" : "⛔"} --self-test: ${selfTestHits} szabotázst fogott meg a 4-ből`);
  process.exit(pass ? 0 : 1);
}
console.log(bad ? `\n⛔ admin-linear-check: ${bad} bukás` : "\n✅ admin-linear-check: a szállított admin = a jóváhagyott Linear terv");
process.exit(bad ? 1 : 0);
