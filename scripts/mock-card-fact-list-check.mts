// A TÉNYHŰSÉG-JELVÉNY MEGMONDJA, MIT JELÖLT MEG (ADR-XXXX, H-2 — tulajdonosi döntés 2026-10-02, „1”).
//
// Mérve (Elek, 2026-10-01): a mock-kártyán csak a „Tényhűség: megjelölve” pirula állt, és a
// „Részletek ▾” sem sorolta fel, MIT talált az őr — a lista csak a piszkozat-lapon és a
// küldés-megerősítőben jelent meg. A döntés: a jelvény a SZÁMOT viseli („6 forrás nélküli ▾”),
// és kattintásra a KÁRTYÁN nyílik a lista; csukva a kártya ugyanolyan kompakt marad.
//
// A KIRENDERELT konzol-lapon mér, VALÓDI stíluslappal, Chromiumban:
//   ① a megjelölt kártya jelvénye gomb, a tételek SZÁMÁVAL; a lista induláskor csukva;
//   ② kattintásra a lista a kártyán nyílik, MINDEN tárolt tétellel; újra kattintva csukódik;
//   ③ csak a SAJÁT kártyája nyílik (nem globális);
//   ④ tárolt tétel NÉLKÜL nincs üres lista és nincs kitalált szám: a régi „megjelölve” marad;
//   ⑤ az átment kártyán nincs ilyen gomb; JS-hiba = 0.
// Piros önteszt: a jelvényt visszarontva a régi pirulára ①② bukik.
//
//   npx tsx scripts/mock-card-fact-list-check.mts
//   npx tsx scripts/mock-card-fact-list-check.mts --self-test   (PIROS önteszt)

process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import type { ArtifactView, LeadDetail } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { leadPage } from "../src/console/views.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
const failedIds = new Set<string>();
const ok = (id: string, label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${id} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) {
    bad++;
    failedIds.add(id);
  }
};

// The Muschel mock's stored list, verbatim (prod f504c405, read 2026-10-01).
const ITEMS = [
  "Ingyenes Wi-Fi (szobánál felsorolt)",
  "Saját fürdőszoba (szobánál)",
  "Erkély (2. szoba)",
  "Családi elrendezés (3. szoba)",
  "Kisállat (szolgáltatás)",
  "Érkezés 14:00–20:00, távozás 10:00",
];

const artifact = (id: string, inputs: Record<string, unknown>): ArtifactView =>
  ({
    id,
    status: "generated",
    path: `/tmp/${id}.html`,
    generatedAt: "2026-10-01T08:21:00.000Z",
    inputs: {
      template: "editorial",
      photos: 6,
      heroSubject: "exterior",
      heroScore: 92,
      factVerdict: "pass",
      marketVerdict: "pass",
      designVerdict: "pass",
      heroVerdict: "pass",
      ...inputs,
    },
    decisions: [],
  }) as unknown as ArtifactView;

const A_FLAG = artifact("bbbbbbbb-0000-0000-0000-000000000001", { factVerdict: "flag", factUnsourced: ITEMS });
const A_FLAG2 = artifact("bbbbbbbb-0000-0000-0000-000000000002", {
  factVerdict: "flag",
  factUnsourced: ITEMS.slice(0, 2),
});
const A_FLAG_NOLIST = artifact("bbbbbbbb-0000-0000-0000-000000000003", { factVerdict: "flag" });
const A_PASS = artifact("bbbbbbbb-0000-0000-0000-000000000004", {});

function lead(artifacts: ArtifactView[]): LeadDetail {
  return {
    id: "11111111-2222-3333-4444-555555555556",
    name: "Őr-teszt Panzió",
    qualification: "no_site",
    lifecycle: "new",
    matchConfidence: null,
    address: "Teszt utca 1.",
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    surveyedAt: "2026-09-04T06:00:00.000Z",
    raw: { material: { totalImages: 8, placesPhotos: 0, portalPhotos: 8, websiteImages: 0, streetView: false } },
    provenance: [],
    artifacts,
    heroScores: {},
    heroPin: null,
  } as unknown as LeadDetail;
}

const HTML = runWithConsoleLang(() =>
  leadPage(lead([A_FLAG, A_FLAG2, A_FLAG_NOLIST, A_PASS]), { running: false } as never, null, [], [], [], null,
    new Set(), new Set(), null, null, new Map()),
);

/** PIROS ÖNTESZT: the badge put back to the old pill (no count, no list, no button). */
function breakIt(html: string): string {
  return html
    .replace(/<button type="button" class="con-mk__gate"([^>]*)>[\s\S]*?<\/button>/g, '<span class="con-mk__gate"$1>Tényhűség: megjelölve</span>')
    .replace(/<div class="con-mk__flist"[\s\S]*?<\/div>/g, "");
}

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const served = SELF_TEST ? breakIt(HTML) : HTML;
const assetServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(served);
    return;
  }
  const rel = path.normalize(url.pathname).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, "public", rel);
  if (!abs.startsWith(path.join(ROOT, "public")) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(readFileSync(abs));
});
assetServer.listen(0);
await once(assetServer, "listening");
const port = (assetServer.address() as AddressInfo).port;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  for (const width of [390, 1280]) {
    console.log(`\n=== mock-card-fact-list-check @${width}px ===`);
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(e.message));
    await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
    await page.evaluate(`document.querySelector('[href="#ls-mocks"],[data-tab="ls-mocks"]')?.click()`);
    await page.waitForTimeout(150);

    const card = (id: string) => page.locator(`#a-${id}`);
    const flag = card(A_FLAG.id);
    const btn = flag.locator('button.con-mk__gate[data-verdict="flag"]');
    const list = flag.locator(".con-mk__flist");

    ok("①", "a megjelölt kártya jelvénye GOMB", (await btn.count()) === 1);
    ok(
      "①",
      "a jelvény a tételek SZÁMÁT mondja (6 forrás nélküli)",
      /6 forrás nélküli/.test((await btn.count()) ? ((await btn.textContent()) ?? "") : ""),
      (await btn.count()) ? ((await btn.textContent()) ?? "") : "nincs gomb",
    );
    ok("①", "induláskor a lista csukva", (await list.count()) === 1 && !(await list.isVisible()));

    if (await btn.count()) await btn.click();
    await page.waitForTimeout(100);
    const shown = (await list.count()) ? await list.locator("li").allTextContents() : [];
    ok("②", "kattintásra a lista a KÁRTYÁN nyílik", (await list.count()) === 1 && (await list.isVisible()));
    ok("②", "MINDEN tárolt tétel benne van", ITEMS.every((x) => shown.includes(x)), shown.join(" | "));
    ok("②", "a gomb kinyitott állapotot jelez (aria-expanded)", (await btn.count()) === 1 && (await btn.getAttribute("aria-expanded")) === "true");
    ok(
      "③",
      "csak a SAJÁT kártyája nyílt (a másik megjelölt csukva)",
      (await card(A_FLAG2.id).locator(".con-mk__flist").count()) === 1 &&
        !(await card(A_FLAG2.id).locator(".con-mk__flist").isVisible()),
    );
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(100);
    ok("②", "újra kattintva csukódik", (await list.count()) === 1 && !(await list.isVisible()));

    const nolist = card(A_FLAG_NOLIST.id);
    ok(
      "④",
      "tárolt tétel nélkül nincs üres lista és kitalált szám — a „megjelölve” marad",
      (await nolist.locator(".con-mk__flist").count()) === 0 &&
        /Tényhűség: megjelölve/.test((await nolist.locator(".con-mk__gate").first().textContent()) ?? ""),
    );
    ok("⑤", "az átment kártyán nincs lista-gomb", (await card(A_PASS.id).locator("button.con-mk__gate").count()) === 0);
    ok("⑤", "JS-hiba = 0", jsErrors.length === 0, jsErrors.join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
  assetServer.close();
}

if (SELF_TEST) {
  const must = ["①", "②"];
  const missed = must.filter((id) => !failedIds.has(id));
  if (missed.length) {
    console.error(`\n⛔ ÖNTESZT: a visszarontás NEM buktatta: ${missed.join(", ")} — az őr vak.`);
    process.exit(1);
  }
  console.log("\n✅ ÖNTESZT: a régi pirula ①② bukást ad — az őr lát.");
  process.exit(0);
}
if (bad) {
  console.error(`\n⛔ mock-card-fact-list-check: ${bad} hiba — a jelvény nem mondja meg, MIT jelölt meg az őr.`);
  process.exit(1);
}
console.log("\n✅ mock-card-fact-list-check: a jelvény a számot mondja, a lista a kártyán nyílik.");
