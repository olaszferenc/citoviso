// Visual check for the multilang card (ADR-0063) — the Modulok tab with the
// one-time translation module in its three states: never bought, active, stale.
// Same serverless pattern as shot-module-config.mts: the views are pure functions,
// the design core loads off disk, and the ~390px phone view is the one that counts.
//
//   npx tsx scripts/shot-multilang.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { adminDashboard, type MultilangAdminData } from "../src/server/adminViews.js";
import { getTenantModules } from "../src/tenant/modules.js";

const ROOT = path.resolve(import.meta.dirname, "..");

const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Nyugalom Vendégház",
  contactEmail: "kovacs.jozsef@gmail.com",
} as unknown as Parameters<typeof adminDashboard>[0];

const content = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro: "Kétszáz méterre a strandtól, saját kerttel.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
} as unknown as Parameters<typeof adminDashboard>[1];

const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);

const base: MultilangAdminData = {
  price: 14900,
  count: 3,
  primaryLangName: "magyar",
  options: [
    { code: "de", name: "német (Deutsch)" },
    { code: "en", name: "angol (English)" },
    { code: "pl", name: "lengyel (polski)" },
    { code: "cs", name: "cseh (čeština)" },
    { code: "sk", name: "szlovák (slovenčina)" },
    { code: "ro", name: "román (română)" },
  ],
  state: null,
  generating: false,
  failedError: null,
  langUrls: [],
};

const VARIANTS: readonly { name: string; ml: MultilangAdminData }[] = [
  { name: "multilang-new", ml: base },
  {
    name: "multilang-stale",
    ml: {
      ...base,
      state: {
        languages: ["de", "en", "pl"],
        langNames: ["német (Deutsch)", "angol (English)", "lengyel (polski)"],
        status: "stale",
        generatedAt: "2026-08-20",
      },
      langUrls: [
        { lang: "de", url: "https://nyugalom-vendeghaz.citoviso.com/de/" },
        { lang: "en", url: "https://nyugalom-vendeghaz.citoviso.com/en/" },
        { lang: "pl", url: "https://nyugalom-vendeghaz.citoviso.com/pl/" },
      ],
    },
  },
];

async function shoot(name: string, ml: MultilangAdminData): Promise<string[]> {
  const html = adminDashboard(session, content, {
    tab: "modulok",
    modules,
    siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
    previewToken: "demo",
    multilang: ml,
  }).replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);

  const dir = await mkdtemp(path.join(tmpdir(), "mlang-"));
  const file = path.join(dir, `${name}.html`);
  await writeFile(file, html, "utf8");

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const out: string[] = [];
  for (const [suffix, viewport, mobile] of [
    ["mobile", { width: 390, height: 900 }, true],
    ["desktop", { width: 1180, height: 900 }, false],
  ] as const) {
    const page = await browser.newPage({ viewport, isMobile: mobile });
    await page.goto(pathToFileURL(file).href);
    // The card sits below the toggle list — jump to it so the shot shows the card.
    await page.evaluate(() => document.getElementById("tobbnyelvu")?.scrollIntoView());
    await page.waitForTimeout(250);
    const p = `shot-${name}-${suffix}.png`;
    await page.screenshot({ path: p, fullPage: true });
    out.push(p);
    await page.close();
  }
  await browser.close();
  return out;
}

const files: string[] = [];
for (const v of VARIANTS) files.push(...(await shoot(v.name, v.ml)));
console.log(`wrote ${files.join(", ")}`);
