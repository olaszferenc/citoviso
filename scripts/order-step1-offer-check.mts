// ŐR: a konfigurátor 1. lépésének összesítője UGYANAZT a megtakarítást mondja, mint a 2. lépés (L3-2, tulaj-döntés
// „B” 2026-10-03; kontraktus: assets/design-refs/console/order-step1-offer/), és a 2. lépés gombja alatti mondat
// nem mondja „Nem kötelező”-nek a kötelező pipa mellett (L-6, tulaj-döntés „A”; console/order-step2-note/).
//
// A lelet (Elek 3. kör): az 1. lépés alján zöld „−2 325 Ft/hó” állt — a VÁLTOZÁS-jelző (6 975 → 4 650 Ft), ami
// megtakarításnak olvasható —, a 2. lépésen „−4 650 Ft” (a listaárhoz mérve): egy ajánlat, két megtakarítás.
// És a „Tovább a számlázási adatokhoz” alatt „Nem kötelező.” állt, a kötelező képjogi pipa mellett.
//
// Mit tart (valódi böngésző, a valódi konfigurátor-futtatóval; 390 px és asztal):
//   ① ajánlattal az 1. lépés áthúzza ugyanazt a listaárat, mint a 2. lépés kártyája, a terhelt összeg ugyanaz;
//   ② az ajánlat-sor az ajánlat NEVÉT és a listaár − terhelt különbséget mondja — a 2. lépés összegével;
//   ③ ajánlattal csomagváltásra NINCS változás-csip; ajánlat nélkül VAN (a jelzés máshol megmarad);
//   ④ a 2. lépés jegyzete „Ez még nem fizetés.”-sel kezdődik, „Nem kötelező” nincs benne;
//   ⑤ JS-hiba 0.
//
// Futtatás: npx tsx scripts/order-step1-offer-check.mts
import { chromium, type Browser } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { offerLabel } from "../src/payment/offers.js";

const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const ORIGIN = "http://order-step1-offer.test";
const failures: string[] = [];
let passed = 0;
const check = (ok: boolean, label: string) => (ok ? passed++ : failures.push(label));

const demo = {
  name: "Erika villa",
  tagline: "Csendes környék Siófokon",
  intro: "Csendes környék, a szabadstrand kb. 5 perc sétára.",
  highlights: ["Szabadstrand kb. 5 perc sétára"],
  photos: [{ url: `${ORIGIN}/hero.jpg`, alt: "A ház", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "8600 Siófok, Teszt u. 1." },
} as SiteData;

async function build(offer: boolean): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] } as unknown as Recipe;
  return injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name, {
    ...(offer ? { offer: { kind: "escalation" as const, label: offerLabel("hu", "escalation"), percent: 50, expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString() } } : {}),
  });
}

const digits = (s: string | null | undefined) => {
  const m = (s ?? "").replace(/[\s ]/g, "").match(/\d+/g);
  return m ? m.map(Number) : [];
};

async function run(browser: Browser, html: string, tag: string, size: { width: number; height: number }, offer: boolean) {
  const page = await browser.newPage({ viewport: size });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(`${ORIGIN}/**`, (route) =>
    new URL(route.request().url()).pathname === "/"
      ? route.fulfill({ status: 200, contentType: "text/html", body: html })
      : route.fulfill({ status: 204, body: "" }),
  );
  await page.goto(`${ORIGIN}/`);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => document.querySelectorAll(".cit-cfg-escveil,.cit-cfg-esccard").forEach((n) => n.remove()));
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  const label = `${tag} · ${offer ? "ajánlattal" : "ajánlat nélkül"}`;

  // ③ a package switch: the change chip.
  const presets = page.locator(".cit-cfg-preset");
  if ((await presets.count()) >= 2) {
    await presets.nth(1).click();
    await page.waitForTimeout(150);
    await presets.nth(0).click();
    await page.waitForTimeout(150);
    const chips = await page.locator(".cit-cfg-mini__amt .cit-cfg-delta").count();
    if (offer) check(chips === 0, `${label}: ⛔ csomagváltásra nincs változás-csip (mért: ${chips})`);
    else check(chips >= 1, `${label}: ajánlat nélkül a változás-csip megmarad (mért: ${chips})`);
  } else check(false, `${label}: nincs két csomag a váltás-próbához`);

  const miniStruck = await page.locator(".cit-cfg-mini__amt s").textContent().catch(() => null);
  const miniHtml = (await page.locator(".cit-cfg-mini__amt").innerHTML()).replace(/<s>[\s\S]*?<\/s>/, "");
  const miniCharge = digits(miniHtml.replace(/<[^>]+>/g, " "))[0] ?? null;
  const offerLine = (await page.locator(".cit-cfg-mini__offer").textContent()) ?? "";

  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(300);
  if (offer) {
    const cardList = digits(await page.locator(".cit-cfg-off-list").first().textContent())[0] ?? null;
    const cardCharge = digits(await page.locator(".cit-cfg-sum--offer b").first().textContent())[0] ?? null;
    check(miniStruck !== null && digits(miniStruck)[0] === cardList, `${label}: ① az 1. lépés áthúzott listaára = a 2. lépés kártyájáé (${miniStruck} vs ${cardList})`);
    check(miniCharge !== null && miniCharge === cardCharge, `${label}: ① a terhelt összeg egyezik (${miniCharge} vs ${cardCharge})`);
    const saving = cardList !== null && cardCharge !== null ? cardList - cardCharge : -1;
    check(digits(offerLine).includes(saving), `${label}: ② az ajánlat-sor a 2. lépés megtakarítását mondja (${saving}) — „${offerLine}”`);
    check(/Döntés-segítő ajánlat \(−50%\)/.test(offerLine), `${label}: ② az ajánlat-sor az ajánlat nevével kezdődik — „${offerLine}”`);
  } else {
    check(miniStruck === null, `${label}: ajánlat nélkül nincs áthúzott ár`);
  }
  // ④ L-6
  const note = ((await page.locator(".cit-cfg-step2 .cit-cfg-note").first().textContent()) ?? "").trim();
  check(/^Ez még nem fizetés\. /.test(note), `${label}: ④ a jegyzet „Ez még nem fizetés.”-sel kezdődik — „${note.slice(0, 60)}”`);
  check(!/Nem kötelező/.test(note), `${label}: ④ nincs „Nem kötelező” a kötelező pipa mellett`);
  check(errors.length === 0, `${label}: ⑤ nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

const browser = await chromium.launch();
try {
  const withOffer = await build(true);
  const without = await build(false);
  for (const [tag, size] of [["390px", { width: 390, height: 844 }], ["asztali", { width: 1440, height: 900 }]] as const) {
    await run(browser, withOffer, tag, size, true);
    await run(browser, without, tag, size, false);
  }
} finally {
  await browser.close();
}
for (const f of failures) console.error(`  ✗ ${f}`);
console.log(`\norder-step1-offer-check: ${passed} zöld, ${failures.length} bukás`);
process.exit(failures.length ? 1 : 0);
