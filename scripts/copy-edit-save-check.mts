// copy-edit-save-check — az /artifact/:id/edit szerkesztőben a „Mentés” akkor is elküldi az
// átírt mezőt, ha a kurátor a mező lezárása („Kész”) NÉLKÜL kattint rá.
//
// Miért (Poe, 2026-10-26, Olympos B 0a0c283c): a galéria-címet átírta, és szerkesztés közben a
// „Mentés”-re kattintott. A gomb nyitott mezőnél le volt tiltva, a kattintás néma maradt, a sáv
// közben „8 átírva · mentve”-t mutatott (gépeléskor nem frissült); újratöltés után a régi cím
// állt. Poe végül a lead-kártya űrlapján javította.
//
// Amit mér (valódi böngésző, a valódi szerkesztő-szkript, a POST elfogva — DB és hálózat nincs):
//   ① gépelés közben a sáv „nem mentett”-et mond, és a „Mentés” kattintható;
//   ② „Mentés” nyitott mezővel → a POST viszi a mezőt (c.features.title = az új szöveg);
//   ③ a lezárt mezős út (Kész → Mentés) változatlanul működik.
//   npx tsx scripts/copy-edit-save-check.mts

import { chromium } from "playwright-core";
import { config } from "../src/config.js";
import { copyEditorOverlay } from "../src/console/copyEditViews.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const ID = "0a0c283c-eff3-4739-a9dd-169a6195a8c2";
const recipe: Recipe = {
  template: "tilted-gallery",
  skin: "",
  archetype: "",
  sections: [
    { kind: "hero", copy: { lead: "Budaörsi szállás", eyebrow: "Szállás · Budaörs" } },
    { kind: "features", copy: { eyebrow: "Galéria", title: "Fotók a házról, az udvarról és az étteremről" } },
    { kind: "enquiry" },
  ] as Recipe["sections"],
};
const data = {
  name: "Olympos Panzio",
  tagline: "Nálunk Budaörsön pihenhet.",
  intro: "Budaörsön várjuk vendégeinket.",
  highlights: ["Budaörsön"],
  photos: [],
  contact: {},
} as unknown as SiteData;
const html = renderSite(recipe, data, { phase: "mock" });
const overlay = copyEditorOverlay(
  ID,
  { recipe, siteData: data },
  { frozen: false, leadName: "Olympos Panzio", templateLabel: "Döntött galéria", backHref: "/lead/x" },
  "hu",
);
const at = html.lastIndexOf("</body>");
const page0 = at >= 0 ? `${html.slice(0, at)}${overlay}${html.slice(at)}` : html + overlay;

const NEW = "Fotók a házról, az udvarról és az étkezőről";
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const run = async (closeFirst: boolean) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const posts: string[] = [];
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.url().endsWith(`/artifact/${ID}/copy`)) {
        posts.push(req.postData() ?? "");
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, message: "Mentve (1 mező)", manualKeys: ["features.title"], verdicts: {} }) });
      }
      if (req.url() === `http://console.test/artifact/${ID}/edit`) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: page0 });
      return route.fulfill({ status: 204, body: "" });
    });
    await page.goto(`http://console.test/artifact/${ID}/edit`);
    await page.click("#cit-ced-toggle");
    const title = page.locator('[data-cit-copy="features.title"]').first();
    await title.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(NEW);
    const sum = await page.locator("#cit-ced-sum").innerText();
    const saveEnabled = await page.locator("#cit-ced-save").isEnabled();
    if (closeFirst) await page.locator(".cit-ced-pop [data-a=done]").click();
    // A disabled button (the bug) would make Playwright wait 30 s — fail fast and report it.
    await page.locator("#cit-ced-save").click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.close();
    return { sum, saveEnabled, posts, errors };
  };

  console.log("① + ② Mentés nyitott mezővel (Poe útja)");
  const open = await run(false);
  check("gépelés közben a sáv „1 nem mentett”-et mond (nem „mentve”)", /1 nem mentett/.test(open.sum) && !/· mentve/.test(open.sum), open.sum);
  check("a „Mentés” kattintható nyitott mezővel", open.saveEnabled);
  const sent = open.posts[0] ? new URLSearchParams(open.posts[0]).get("c.features.title") : null;
  check("a POST elviszi az átírt címet", open.posts.length === 1 && sent === NEW, open.posts);
  check("JS-hiba nincs", open.errors.length === 0, open.errors);

  console.log("③ Kész → Mentés (a régi út)");
  const closed = await run(true);
  const sent2 = closed.posts[0] ? new URLSearchParams(closed.posts[0]).get("c.features.title") : null;
  check("lezárt mezővel is elküldi", closed.posts.length === 1 && sent2 === NEW, closed.posts);
} finally {
  await browser.close();
}

if (failures) {
  console.error(`\n❌ copy-edit-save-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ copy-edit-save-check: a szerkesztő Mentése nyitott mezővel is elküldi az átírást.");
