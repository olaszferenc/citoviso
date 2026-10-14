// A próba-űrlap e-mail mezője előre kitöltve (Elek N-1, 2026-10-14): a megkereső levél erre a
// címre ment, a fizetési űrlap már előtölti (CFG.billing.prefill ← prospect.contact_email), a
// próba-űrlap viszont üresen kérte újra. Prefill nélkül üres marad (negatív kontroll), és a
// vendég által beírt cím nem íródik felül.
// Futtatás: npx tsx scripts/trial-email-prefill-check.mts
import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { injectRuntime } from "../src/generator/runtime.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${JSON.stringify(d)}`}`);
  if (!c) fail++;
};
const ORIGIN = "http://mock.test";
const TOK = "fixtureTokenAbcdefgh12";
const PLAN = `${ORIGIN}/p/${TOK}`;
const DATA = {
  name: "Próba Vendégház", tagline: "Teszt", intro: "Teszt szállás a Balatonnál.", highlights: ["Csendes", "Kert"],
  photos: [], contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "8630 Balatonboglár, Teszt u. 1." },
} as unknown as SiteData;
const templateId = Object.keys(TEMPLATES)[0]!;
const recipe = { skin: TEMPLATES[templateId]!.skins[0]!, archetype: "stacked", template: templateId, sections: [] } as unknown as Recipe;
async function page(prefill: Record<string, string>): Promise<string> {
  const base = await injectRuntime(renderSite(recipe, DATA, { phase: "mock" }));
  return injectConfigurator(base, "00000000-0000-4000-8000-000000000001", DATA.name, {
    trial: { enabled: true as const, days: 14, url: `/p/${TOK}/trial`, privacyUrl: "/privacy" },
    billingPrefill: prefill,
  });
}
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  for (const [label, prefill, want] of [
    ["a megkeresett cím előtöltve", { email: "tulaj@example.com" }, "tulaj@example.com"],
    ["negatív kontroll: prefill nélkül üres", {}, ""],
  ] as const) {
    for (const width of [390, 1280]) {
      const html = await page(prefill);
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const p = await ctx.newPage();
      const errs: string[] = [];
      p.on("pageerror", (e) => errs.push(String(e)));
      await p.route("**/*", (r) => (new URL(r.request().url()).pathname === `/p/${TOK}` ? r.fulfill({ contentType: "text/html; charset=utf-8", body: html }) : r.fulfill({ status: 204, body: "" })));
      await p.goto(PLAN, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(600);
      await p.locator(".cit-cfg-trialpill").first().evaluate((b) => (b as HTMLButtonElement).click());
      await p.waitForTimeout(400);
      const v = await p.locator('.cit-cfg-tsheet [name="email"]').inputValue();
      check(`${width}px: ${label}`, v === want, v);
      // SHOT_PREFIX=<path> → the sheet as the owner sees it (before/after evidence).
      if (process.env.SHOT_PREFIX && want) await p.locator(".cit-cfg-tsheet").screenshot({ path: `${process.env.SHOT_PREFIX}-${width === 390 ? "m" : "d"}.png` });
      check(`${width}px: JS-hiba 0`, errs.length === 0, errs);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(fail ? `\n⛔ TRIAL-EMAIL-PREFILL: ${fail} bukás` : "\n🟢 TRIAL-EMAIL-PREFILL: a próba-űrlapon a megkeresett e-mail cím előre ott van");
process.exit(fail ? 1 : 0);
