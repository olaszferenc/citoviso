// Regression gate: the configurator may say "Megkaptuk a rendelését" ONLY when
// the server confirmed the order (ok:true + pending:true).
//
// Measured 2026-09-25: a pay click that landed while the console restarted got a
// proxy 502 (HTML, not JSON → {}), fell through to showThanks(), and told the
// buyer "a colleague will contact you" — while NO order_intent was written and NO
// operator alert went out. Nobody ever would have called.
//
// Each case replays the real buyer path (panel → plan → billing → pay) in a real
// browser at 390px and desktop, with the order POST answered by a stubbed server:
//   502 HTML · network abort · unhandled 400 → failed-send line, form kept, pay
//                                              button re-armed, NO thanks text
//   ok:true + pending:true                   → thanks text (the one true case)
//
// Run:  npx tsx scripts/order-send-failed-check.mts [--shot <dir>]
//       npx tsx scripts/order-send-failed-check.mts --self-test   (must go RED)

import { chromium, type Browser, type Route } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELF_TEST = process.argv.includes("--self-test");
// --shot <dir>: also save the failed-send state per viewport, for a human look.
const SHOT_DIR = process.argv.includes("--shot") ? process.argv[process.argv.indexOf("--shot") + 1] : null;
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const ORIGIN = "http://order-send.test";
const THANKS = "Megkaptuk a rendelését.";
const FAILED = "Nem sikerült elküldeni a rendelését";

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

async function buildPreview(): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections: [],
  } as unknown as Recipe;
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    ARTIFACT_ID,
    demo.name,
    {
      billingPrefill: {
        name: "Teszt Elek",
        zip: "8360",
        city: "Keszthely",
        address: "Fő utca 1.",
        email: "elo@pelda.hu",
        country: "HU",
      },
    },
  );
  if (SELF_TEST) {
    // Deliberate regression: the old fall-through — anything unconfirmed thanks
    // the buyer. This MUST go red.
    html = html.replace(
      'showSendFailed(data && data.error ? String(data.error) : "no_confirmation");',
      "showThanks(chosen);",
    );
  }
  return html;
}

type Answer = (route: Route) => Promise<void>;
const CASES: ReadonlyArray<{ name: string; answer: Answer; confirmed: boolean }> = [
  {
    name: "502 proxy-HTML (konzol-újraindulás)",
    answer: (r) => r.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" }),
    confirmed: false,
  },
  { name: "hálózati hiba", answer: (r) => r.abort("connectionrefused"), confirmed: false },
  {
    name: "kezeletlen 400 (photo_rights_declaration_required)",
    answer: (r) =>
      r.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "photo_rights_declaration_required" }),
      }),
    confirmed: false,
  },
  {
    name: "szerver-visszaigazolás (ok + pending)",
    answer: (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, pending: true }) }),
    confirmed: true,
  },
];

const VIEWPORTS = [
  { tag: "390px", size: { width: 390, height: 844 } },
  { tag: "asztali", size: { width: 1440, height: 900 } },
];

async function runCase(
  browser: Browser,
  html: string,
  vp: (typeof VIEWPORTS)[number],
  c: (typeof CASES)[number],
): Promise<void> {
  const page = await browser.newPage({ viewport: vp.size });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let posts = 0;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    if (route.request().method() === "POST" && u.pathname.endsWith("/request")) {
      posts++;
      return c.answer(route);
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-rights").check();
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(250);
  await page.locator('.cit-cfg-bt[data-btype="individual"]').click();
  await page.evaluate(`(function () {
    var rows = document.querySelectorAll(".cit-cfg-co-act .cit-cfg-consent");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].hasAttribute("hidden")) continue;
      var b = rows[i].querySelector('input[type="checkbox"]');
      if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  })()`);
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-pay").click();
  await page.waitForTimeout(700);

  const label = `${vp.tag} · ${c.name}`;
  check(posts === 1, `${label}: a rendelés-POST egyszer ment ki (mért: ${posts})`);
  const text = (await page.locator(".cit-cfg-panel").innerText()).replace(/\s+/g, " ");
  if (c.confirmed) {
    check(text.includes(THANKS), `${label}: a visszaigazolt rendelés köszönő szöveget kap`);
    check(!text.includes(FAILED), `${label}: nincs hibasor a visszaigazolt rendelésen`);
  } else {
    check(!text.includes(THANKS), `${label}: NINCS „${THANKS}” visszaigazolás nélkül`);
    const warn = page.locator(".cit-cfg-sendfail");
    if (SHOT_DIR && c.name.startsWith("502") && (await warn.count()) === 1) {
      await warn.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOT_DIR}/order-send-failed-${vp.tag}.png` });
    }
    check(
      (await warn.count()) === 1 && (await warn.isVisible()),
      `${label}: a hibasor LÁTHATÓ`,
    );
    // The regressed thanks screen replaces the whole foot: no button, no form.
    // That is a finding, not a crash — record it and stop this case.
    const pay = page.locator(".cit-cfg-pay");
    const zip = page.locator('.cit-cfg-i[data-f="buyer_zip"]');
    const armed =
      (await pay.count()) === 1 && (await pay.isEnabled()) && (await pay.getAttribute("data-busy")) === null;
    check(armed, `${label}: a fizetés-gomb újra megnyomható (nem ragad „Ellenőrzés…”-en)`);
    check(
      (await zip.count()) === 1 && (await zip.inputValue()) === "8360",
      `${label}: a kitöltött adatok megmaradtak`,
    );
    if (armed) {
      // A retry must actually go out again — and a second failure must not stack lines.
      await pay.click();
      await page.waitForTimeout(600);
      check(posts === 2, `${label}: az újrapróbálás ÚJ kérést küld (mért: ${posts})`);
      check((await page.locator(".cit-cfg-sendfail").count()) === 1, `${label}: ismételt hibánál egy hibasor marad`);
    } else {
      check(false, `${label}: az újrapróbálás nem is indítható`);
    }
  }
  check(errors.length === 0, `${label}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

async function main(): Promise<void> {
  const html = await buildPreview();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  try {
    for (const vp of VIEWPORTS) for (const c of CASES) await runCase(browser, html, vp, c);
  } finally {
    await browser.close();
  }
  console.log(notes.join("\n"));
  if (failures.length) {
    console.error(`\n⛔ order-send-failed-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
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
  console.log(`\n✅ order-send-failed-check: ${notes.length} állítás zöld`);
}

await main();
