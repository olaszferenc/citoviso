// Legrövidebb foglalás — már választáskor (Elek-foglaló F-2, 2026-10-14): a 2 éjes minimumot a
// szelvény csak a beküldés után mondta ki, a naptár 1 éjre is árat adott, és a honlap sehol nem
// írta ki; egy IDŐSZAK saját minimuma pedig el sem jutott a böngészőbe.
//   ① a naptár az érkezés után a túl rövid távozási napokat nem kínálja (időszakon kívül a
//      modul minimuma, időszakon belül az időszaké), és a sáv kimondja: „legalább N éjszaka”;
//   ② gépelt túl rövid tartózkodásra a hiba azonnal (a szerver mondatával);
//   ③ az Árak táblázat soronként mondja a minimumot, csak ha 1-nél több (negatív kontroll);
//   ④ publicSeasons viszi az időszak minimumát.
// Futtatás: npx tsx scripts/booking-min-nights-check.mts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";
const ROOT = path.resolve(import.meta.dirname, "..");
const { config } = await import("../src/config.js");
const { bookingSlot } = await import("../src/engine/templateKit.js");
const { moduleSections } = await import("../src/engine/moduleSections.js");
const { publicSeasons } = await import("../src/tenant/prices.js");
type SiteData = import("../src/engine/recipe.js").SiteData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 260)}`}`);
  if (!c) fail++;
};
const iso = (o: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + o);
  return d.toISOString().slice(0, 10);
};

/* ── ①② the widget ── season = today+10 … today+40 (min 5); the module's minimum is 2. */
const SEASON = { from: iso(10).slice(5), to: iso(40).slice(5), validFrom: null, validTo: null, min: 5 };
async function html(): Promise<string> {
  const [moneyJs, seasonJs, runtimeJs, css] = await Promise.all(
    ["cit-money.js", "cit-season.cjs", "cit-runtime.js", "cit-modules.css"].map((f) => readFile(path.join(ROOT, "assets/runtime", f), "utf8")),
  );
  const d = {
    name: "Minimum Teszt", tagline: "", intro: "", highlights: [], photos: [], contact: { email: "info@example.com" },
    booking: { units: [{ id: "u1", name: "Vendégház", capacity: 4 }], minNights: 2, maxNights: 14, horizonMonths: 12, leadTimeDays: 0 },
  } as unknown as SiteData;
  const api = { blocked: [], mins: [SEASON], pricing: { currency: "HUF", unit: "per_night", rows: [{ base: true, amount: 18000, label: "Alapár" }, { base: false, amount: 25000, label: "Főszezon", from: SEASON.from, to: SEASON.to }] } };
  const stub =
    `<script>(function(){var real=window.fetch;window.fetch=function(u){var s=String(u);` +
    `if(s.indexOf("/api/foglaltsag/")>=0){return Promise.resolve({ok:true,json:function(){return Promise.resolve(${JSON.stringify(api)});}});}` +
    `return real.apply(this,arguments);};})();</script>`;
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${css}</style></head><body>` + stub + bookingSlot(d) + moduleSections(d) +
    `<script>${moneyJs}</script><script>${seasonJs}</script><script>${runtimeJs}</script></body></html>`
  );
}
async function show(page: Page, day: string): Promise<void> {
  for (let i = 0; i < 4 && !(await page.locator(`.cit-book__day[data-day="${day}"]:visible`).count()); i++) {
    await page.click(".cit-book__calnav--next");
    await page.waitForTimeout(120);
  }
}
const day = (page: Page, d: string) => page.locator(`.cit-book__day[data-day="${d}"]`).first();
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "bmin-")), "site.html");
  await writeFile(file, await html(), "utf8");
  for (const width of [390, 1280]) {
    console.log(`\n① naptár · ${width}px`);
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width === 390 });
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(500);
    // outside the season: the module's 2 nights
    await show(page, iso(50));
    await day(page, iso(50)).click();
    await page.waitForTimeout(150);
    const strip = (await page.locator("[data-nights]").first().textContent()) ?? "";
    check("⭐ időszakon kívül a sáv: „legalább 2 éjszaka”", /legalább 2 éjszaka/.test(strip), strip);
    await show(page, iso(51));
    check("⭐ 1 éjes távozás nem választható", await day(page, iso(51)).isDisabled());
    await show(page, iso(52));
    check("negatív kontroll: 2 éjes távozás választható", await day(page, iso(52)).isEnabled());
    // inside the season: its own 5 nights (a fresh page — the calendar opens on today)
    await page.reload();
    await page.waitForTimeout(500);
    await show(page, iso(20));
    await day(page, iso(20)).click();
    await page.waitForTimeout(150);
    const strip2 = (await page.locator("[data-nights]").first().textContent()) ?? "";
    check("⭐ időszakon belül a sáv: „legalább 5 éjszaka” (az időszak saját minimuma)", /legalább 5 éjszaka/.test(strip2), strip2);
    await show(page, iso(24));
    check("⭐ 4 éjes távozás az időszakban nem választható", await day(page, iso(24)).isDisabled());
    const lab = (await day(page, iso(24)).getAttribute("aria-label")) ?? "";
    check("a felolvasó is hallja: „legalább 5 éjszaka”", /legalább 5 éjszaka/.test(lab), lab);
    await show(page, iso(25));
    check("negatív kontroll: 5 éjes távozás választható", await day(page, iso(25)).isEnabled());

    console.log(`\n② gépelt túl rövid tartózkodás · ${width}px`);
    await page.evaluate(([a, b]) => {
      const f = document.querySelector<HTMLInputElement>("#cit-from")!, t = document.querySelector<HTMLInputElement>("#cit-to")!;
      f.value = a!; f.dispatchEvent(new Event("change"));
      t.value = b!; t.dispatchEvent(new Event("change"));
    }, [iso(20), iso(23)]);
    await page.waitForTimeout(200);
    const note = (await page.locator(".cit-book__note").first().textContent()) ?? "";
    check("⭐ 3 éj az időszakban → „Legalább 5 éjszakára lehet foglalni.” beküldés előtt", /Legalább 5 éjszakára lehet foglalni\./.test(note), note);
    check("JS-hiba 0", errs.length === 0, errs);
    await page.close();
  }
} finally {
  await browser.close();
}

/* ── ③ the price table ── */
console.log("\n③ Árak táblázat");
const priced = (bookingMin: number | null, seasonMin: number | null): string =>
  moduleSections({
    name: "T", tagline: "", intro: "", highlights: [], photos: [], contact: {},
    ...(bookingMin ? { booking: { units: [{ id: "u1", name: "Ház" }], minNights: bookingMin, maxNights: 14, horizonMonths: 12, leadTimeDays: 0 } } : {}),
    pricing: { currency: "HUF", unit: "per_night", note: "", units: [{ name: "Ház", base: 18000, seasons: [{ label: "Főszezon", from: "07-01", to: "08-31", amount: 25000, minNights: seasonMin }] }] },
  } as unknown as SiteData);
const t1 = priced(2, 5);
check("⭐ az időszak sorában „legalább 5 éj”", /Főszezon<br><small class="cit-price__min">legalább 5 éj/.test(t1), t1.slice(t1.indexOf("Főszezon"), t1.indexOf("Főszezon") + 120));
check("⭐ az „Egyéb időszakban” sorban a modul minimuma: „legalább 2 éj”", /Egyéb időszakban<br><small class="cit-price__min">legalább 2 éj/.test(t1));
check("negatív kontroll: 1 éjes minimum mellett nincs „legalább”", !/legalább/.test(priced(1, null)));
check("negatív kontroll: foglalás-modul nélkül nincs „legalább”", !/legalább/.test(priced(null, 5)));

/* ── ④ publicSeasons ── */
console.log("\n④ publicSeasons");
const ps = publicSeasons(
  [{ id: "s", label: "Főszezon", from: "07-01", to: "08-31", amount: 25000, isBase: false, minNights: 5, validFrom: null, validTo: null, parentId: null } as never],
  iso(0),
  12,
);
check("⭐ az időszak minimuma átmegy a honlap adatába", ps[0]?.minNights === 5, ps);

console.log(fail ? `\n⛔ BOOKING-MIN-NIGHTS: ${fail} bukás` : "\n🟢 BOOKING-MIN-NIGHTS: a minimum már választáskor látszik (naptár + sáv + Árak), az időszak sajátja is");
process.exit(fail ? 1 : 0);
