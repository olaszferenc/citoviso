// Regression gate: an opted-out visitor sees the price the server will charge
// (ADR-0112, amended by the owner 2026-09-25).
//
// Measured 2026-09-25: the /p/ page resolved the offer only for TRACKED visitors,
// so an opted-out one read the list price (6 840 Ft) while handleOrderRequest
// charged the discounted one (5 130 Ft). The cold letter promised the discount in
// writing, so the price follows the offer on both branches; what the opt-out
// turns off is the PUSH — the deadline-bound decision card.
//
// Real browser, 390px + desktop, the SAME escalation offer rendered twice:
//   tracked   → the decision card mounts (control: proves the card path is alive);
//               on a phone it sits low with NO veil, so the plan stays visible
//               (Elek 2026-10-10, 02x), on desktop it keeps its veil (offer-ui ④)
//   offerQuiet→ NO decision card, but the struck list price + the discounted
//               payable figure are on screen, and the pay button charges it
//
// Run:  npx tsx scripts/optout-offer-price-check.mts
//       npx tsx scripts/optout-offer-price-check.mts --self-test   (must go RED)

import { chromium, type Browser } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELF_TEST = process.argv.includes("--self-test");
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const ORIGIN = "http://optout-offer.test";

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [{ url: `${ORIGIN}/hero.jpg`, alt: "A hotel", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

const OFFER = {
  kind: "escalation" as const,
  percent: 50,
  expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
};

async function build(quiet: boolean): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections: [],
  } as unknown as Recipe;
  let html = await injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name, {
    offer: OFFER,
    ...(quiet ? { offerQuiet: true } : {}),
  });
  if (SELF_TEST) {
    // Deliberate regression: the runtime ignores the quiet flag again.
    html = html.replace("if (PRICING.offerQuiet) return;", "");
  }
  return html;
}

const VIEWPORTS = [
  { tag: "390px", size: { width: 390, height: 844 } },
  { tag: "asztali", size: { width: 1440, height: 900 } },
];

async function run(browser: Browser, html: string, tag: string, size: { width: number; height: number }, quiet: boolean) {
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
  await page.waitForTimeout(400);
  const label = `${tag} · ${quiet ? "leiratkozott" : "követett"}`;
  const cards = await page.locator(".cit-cfg-esccard").count();
  if (quiet) check(cards === 0, `${label}: NINCS döntés-segítő kártya (mért: ${cards})`);
  else check(cards === 1, `${label}: a döntés-segítő kártya megjelenik (kontroll, mért: ${cards})`);
  if (!quiet && cards) {
    // Elek 2026-10-10 (02x): on a phone the veil + blur hid the whole plan. offer-ui ④:
    // veil on desktop, bottom-anchored card on mobile — and the plan must stay visible.
    await page.locator(".cit-cfg-esccard.cit-cfg-on").waitFor({ state: "visible", timeout: 5000 });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const v = document.querySelector(".cit-cfg-escveil") as HTMLElement;
      const vs = getComputedStyle(v);
      const r = (document.querySelector(".cit-cfg-esccard") as HTMLElement).getBoundingClientRect();
      return { veil: vs.display !== "none" && Number(vs.opacity) > 0, top: r.top, bottom: r.bottom, vh: innerHeight };
    });
    if (size.width <= 560) {
      check(!m.veil, `${label}: mobilon NINCS fátyol a terv előtt (mért: ${m.veil ? "van" : "nincs"})`);
      check(
        m.top >= m.vh * 0.55 && m.bottom <= m.vh,
        `${label}: a kártya alul ül, a képernyő felső 55%-a a terv (régi kártya: 383/844) (teteje ${Math.round(m.top)} / ${m.vh} px)`,
      );
    } else {
      check(m.veil, `${label}: asztalon a kártya fátyollal (offer-ui ④)`);
    }
  }

  // Close the card if present, then look at the price the buyer is going to pay.
  if (cards) await page.evaluate(() => document.querySelectorAll(".cit-cfg-escveil,.cit-cfg-esccard").forEach((n) => n.remove()));
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  const sum = page.locator(".cit-cfg-sum--offer");
  check((await sum.count()) >= 1, `${label}: az ár-kártya ajánlatos (áthúzott listaár + fizetendő)`);
  const text = (await page.locator(".cit-cfg-panel").innerText()).replace(/\s+/g, " ");
  // Step 1 names it as „<ajánlat> (−50%) −<Ft> az első díjból” since L3-2 (contract order-step1-offer);
  // the step-2 card keeps „−50% az első díjból”. Either way the −50% is said to be on the FIRST fee.
  check(/\(−50%\) −[\d\s\u00a0]+Ft az első díjból|−50% az első díjból/.test(text), `${label}: kimondja a −50%-ot az első díjra`);
  check(errors.length === 0, `${label}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

const browser = await chromium.launch();
try {
  const tracked = await build(false);
  const quiet = await build(true);
  check(!tracked.includes('"offerQuiet"'), "követett lapon nem megy ki offerQuiet");
  check(quiet.includes('"offerQuiet":true'), "leiratkozott lapon kimegy az offerQuiet");
  for (const vp of VIEWPORTS) {
    await run(browser, tracked, vp.tag, vp.size, false);
    await run(browser, quiet, vp.tag, vp.size, true);
  }
} finally {
  await browser.close();
}

console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ optout-offer-price-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
  if (SELF_TEST) {
    console.log("\n✅ self-test: a szándékos regresszió PIROS lett, ahogy kell.");
    process.exit(0);
  }
  process.exit(1);
}
if (SELF_TEST) {
  console.error("\n⛔ self-test: a szándékos regresszió ZÖLD maradt — az őr vak.");
  process.exit(1);
}
console.log(`\n✅ optout-offer-price-check: ${notes.length} állítás zöld`);
