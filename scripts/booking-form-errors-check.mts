// A foglalási szelvény hibái egyszerre, a hibás mező kiemelve (Elek-foglaló F-6, 2026-10-14):
// egyszerre csak EGY hiba látszott, és a mező, amiről szólt, nem volt megjelölve — a vendég
// kijavította a nevet, elküldte, és csak akkor tudta meg, hogy a telefon is hiányzik.
//   ① üres űrlapnál mindhárom mondat egyszerre, a három mező aria-invalid, a fókusz az elsőn;
//   ② gépelésre a mező jelölése eltűnik; hibás e-mail-formátum külön mondatot kap;
//   ③ a szerver összes hibája látszik, nem csak az első (negatív kontroll: jó űrlapnál nincs jelölés).
// Futtatás: npx tsx scripts/booking-form-errors-check.mts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";
const ROOT = path.resolve(import.meta.dirname, "..");
const { config } = await import("../src/config.js");
const { bookingSlot } = await import("../src/engine/templateKit.js");
const { moduleSections } = await import("../src/engine/moduleSections.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 260)}`}`);
  if (!c) fail++;
};
const SERVER_ERRORS = ["Sajnos ezek a napok már foglaltak. Válasszon másik időpontot.", "Ide legfeljebb 4 vendég foglalhat. Kérjük, csökkentse a létszámot."];
async function html(): Promise<string> {
  const [moneyJs, seasonJs, runtimeJs, css] = await Promise.all(
    ["cit-money.js", "cit-season.cjs", "cit-runtime.js", "cit-modules.css"].map((f) => readFile(path.join(ROOT, "assets/runtime", f), "utf8")),
  );
  const d = {
    name: "Hiba Teszt", tagline: "", intro: "", highlights: [], photos: [], contact: { email: "info@example.com" },
    booking: { units: [{ id: "u1", name: "Vendégház", capacity: 4 }], minNights: 1, maxNights: 14, horizonMonths: 12, leadTimeDays: 0 },
  } as unknown as SiteData;
  const api = { blocked: [], mins: [], pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 18000, label: "Alapár" }] } };
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){return Promise.resolve(${JSON.stringify(api)});}});}` +
    `if(s.indexOf("/api/foglalas")>=0){return Promise.resolve({ok:false,status:400,json:function(){return Promise.resolve(${JSON.stringify({ ok: false, errors: SERVER_ERRORS })});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${css}</style></head><body>` + stub + bookingSlot(d) + moduleSections(d) +
    `<script>${moneyJs}</script><script>${seasonJs}</script><script>${runtimeJs}</script></body></html>`
  );
}
async function pick(page: Page): Promise<void> {
  const free = page.locator(".cit-book__day:not(:disabled):visible");
  for (let i = 0; i < 3 && (await free.count()) < 5; i++) { await page.click(".cit-book__calnav--next"); await page.waitForTimeout(150); }
  await free.nth(1).click();
  await free.nth(3).click();
  await page.waitForTimeout(250);
  if (await page.locator(".cit-book__go").isVisible()) { await page.click(".cit-book__go"); await page.waitForTimeout(300); }
}
const note = (page: Page) => page.locator(".cit-book__note").first();
const invalid = (page: Page, id: string) => page.locator(`#${id}`).getAttribute("aria-invalid");
const submit = async (page: Page) => {
  await page.locator(".cit-book__submit").evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.locator(".cit-book__submit").click();
  await page.waitForTimeout(400);
};

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "bferr-")), "site.html");
  await writeFile(file, await html(), "utf8");
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(500);
    await pick(page);

    console.log(`\n① üres űrlap · ${width}px`);
    await submit(page);
    const n1 = (await note(page).innerText()) ?? "";
    check("⭐ mindhárom mondat egyszerre", /adja meg a nevét/.test(n1) && /adja meg az e-mail címét/.test(n1) && /telefonszámát/.test(n1), n1);
    check("⭐ mindhárom mező megjelölve (aria-invalid)", (await invalid(page, "cit-name")) === "true" && (await invalid(page, "cit-email")) === "true" && (await invalid(page, "cit-phone")) === "true");
    check("⭐ a fókusz az első hibás mezőn", await page.evaluate(() => document.activeElement?.id === "cit-name"));

    console.log(`\n② javítás · ${width}px`);
    await page.fill("#cit-name", "Teszt Vendég");
    check("gépelésre a név jelölése eltűnik", (await invalid(page, "cit-name")) === null);
    await page.fill("#cit-email", "rossz-cim");
    await page.fill("#cit-phone", "+36301112222");
    await submit(page);
    const n2 = (await note(page).innerText()) ?? "";
    check("⭐ hibás e-mail-formátum: saját mondat, csak az e-mail jelölve", /érvényes e-mail címet/.test(n2) && !/nevét/.test(n2) && (await invalid(page, "cit-email")) === "true" && (await invalid(page, "cit-phone")) === null, n2);

    console.log(`\n③ a szerver összes hibája · ${width}px`);
    await page.fill("#cit-email", "vendeg@example.com");
    await submit(page);
    await page.waitForTimeout(300);
    const n3 = (await note(page).innerText()) ?? "";
    check("⭐ mindkét szerver-hiba látszik", SERVER_ERRORS.every((e) => n3.includes(e)), n3);
    check("negatív kontroll: jó űrlapnál egy mező sincs megjelölve", (await page.locator("[aria-invalid='true']").count()) === 0);
    check("JS-hiba 0", errs.length === 0, errs);
    if (process.env.SHOT_PREFIX) {
      await page.fill("#cit-name", "");
      await page.fill("#cit-email", "");
      await page.fill("#cit-phone", "");
      await submit(page);
      await page.locator(".cit-book__formcol").first().screenshot({ path: `${process.env.SHOT_PREFIX}-${width === 390 ? "m" : "d"}.png` });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(fail ? `\n⛔ BOOKING-FORM-ERRORS: ${fail} bukás` : "\n🟢 BOOKING-FORM-ERRORS: minden hiba egyszerre, a hibás mező megjelölve, a szerver összes hibája látszik");
process.exit(fail ? 1 : 0);
