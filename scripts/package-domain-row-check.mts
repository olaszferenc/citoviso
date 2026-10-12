// CSOMAG-TARTALOM: SAJÁT CÍM — B állapotban („a domain a csomag része”, ADR-0360) a csomag-kártya
// „Mit tartalmaz?” listája kimondja, melyik csomagban van benne a saját cím (ADR-0366, Elek 10-11 K1).
//
//   npx tsx scripts/package-domain-row-check.mts [--shot <dir>]
//   npx tsx scripts/package-domain-row-check.mts --self-test   (a sor nélkül PIROS kell)
//
// ⛔ MIÉRT (mérve 2026-10-11, Elek): B állapotban a csomag-kártyán és a „Mit tartalmaz?” listán a
// domain nem szerepelt; csak a cím-lépés írta, hogy „a csomag része” — azt pedig csak az látja,
// aki már választott és lement. A kampány üzenete („saját domainnevet regisztrálunk”) láthatatlan.
//
// MIT MÉR (valódi böngészőben, 390px és asztali, a valódi konfigurátoron; a piac-állapotot a
// manifest `domain.pkgModules`/`tlds` mezője adja, pont ahogy a szerver szállítja):
//   ① B: a domaint lefedő csomag(ok) listájában PIPÁS „Saját domainnév (.hu)” sor; a többiben X-es
//   ② A (pkgModules = null): SEHOL nincs ilyen sor (felár marad, nem csomag-tartalom)
//   ③ JS-hiba = 0
import { chromium, type Browser } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");
const SHOT_DIR = process.argv.includes("--shot") ? process.argv[process.argv.indexOf("--shot") + 1] : null;
const ORIGIN = "http://pkg-domain.test";
const ARTIFACT_ID = "00000000-0000-4000-8000-0000000000k1";

const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { injectConfigurator } = await import("../src/generator/configurator.js");
type Recipe = import("../src/engine/recipe.js").Recipe;
type SiteData = import("../src/engine/recipe.js").SiteData;

const failures: string[] = [];
const notes: string[] = [];
const check = (ok: boolean, label: string): void => {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
};

const demo = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [{ url: `${ORIGIN}/hero.jpg`, alt: "A hotel", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

interface Manifest {
  presets: { id: string; modules: string[] }[];
  domain: { pkgModules: string[] | null; tlds: { tld: string; monthly: number; freeInPackage: boolean }[] };
}

/** The page with the market state forced into the manifest, as the server would ship it. */
async function buildPreview(state: "A" | "B"): Promise<{ html: string; covering: string[]; others: string[] }> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] } as unknown as Recipe;
  let html = await injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name);
  const re = /(<script type="application\/json" data-cit-configurator>)([\s\S]*?)(<\/script>)/;
  const m = re.exec(html)!;
  const man = JSON.parse(m[2]!) as Manifest;
  // B: the middle package's own modules are the domain-carrying set (ADR-0360 ②).
  const sorted = [...man.presets].sort((a, b) => a.modules.length - b.modules.length);
  const mid = sorted[Math.min(1, sorted.length - 1)]!;
  man.domain.pkgModules = state === "B" ? [...mid.modules] : null;
  man.domain.tlds = [{ tld: ".hu", monthly: 1000, freeInPackage: true }];
  const covering = man.presets.filter((p) => mid.modules.every((x) => p.modules.includes(x))).map((p) => p.id);
  const others = man.presets.map((p) => p.id).filter((x) => !covering.includes(x));
  html = html.replace(re, (_a, o: string, _b, c: string) => `${o}${JSON.stringify(man)}${c}`);
  if (SELF_TEST) html = html.replace("if (pkgTlds.length) {", "if (false) {");
  return { html, covering, others };
}

async function run(browser: Browser, vp: { tag: string; size: { width: number; height: number } }, state: "A" | "B"): Promise<void> {
  const { html, covering, others } = await buildPreview(state);
  const page = await browser.newPage({ viewport: vp.size });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(`${ORIGIN}/**`, (route) =>
    new URL(route.request().url()).pathname === "/"
      ? route.fulfill({ status: 200, contentType: "text/html", body: html })
      : route.fulfill({ status: 204, body: "" }),
  );
  await page.goto(`${ORIGIN}/`);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  // Open every card's list.
  await page.evaluate(`(function () {
    document.querySelectorAll(".cit-cfg-preset__more").forEach(function (b) { b.click(); });
  })()`);
  await page.waitForTimeout(200);
  const rows = (await page.evaluate(`(function () {
    return Array.prototype.map.call(document.querySelectorAll(".cit-cfg-preset"), function (c) {
      var r = c.querySelector('[data-pli="domain"]');
      return { id: c.getAttribute("data-preset"), row: r ? { on: !r.classList.contains("cit-cfg-pli--off"), text: r.textContent.trim(), visible: r.offsetWidth > 0 } : null };
    });
  })()`)) as { id: string; row: { on: boolean; text: string; visible: boolean } | null }[];
  const label = `${vp.tag} · ${state}`;
  if (state === "B") {
    for (const id of covering) {
      const r = rows.find((x) => x.id === id)?.row;
      check(!!r && r.on && r.visible && /Saját domainnév \(\.hu\)/.test(r.text), `① ${label}: a(z) „${id}” listájában pipás saját-cím sor (${r?.text ?? "NINCS"})`);
    }
    for (const id of others) {
      const r = rows.find((x) => x.id === id)?.row;
      check(!!r && !r.on, `① ${label}: a(z) „${id}” (nem fedi) listájában X-es saját-cím sor`);
    }
    if (SHOT_DIR) {
      const first = page.locator(`.cit-cfg-preset[data-preset="${covering[0]}"]`);
      await first.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOT_DIR}/k1-csomag-sajat-cim-${vp.tag}.png` });
    }
  } else {
    check(rows.every((x) => x.row === null), `② ${label}: nincs saját-cím sor, ha a domain nem csomag-tartalom`);
  }
  check(errors.length === 0, `③ ${label}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const vp of [
    { tag: "390px", size: { width: 390, height: 844 } },
    { tag: "asztali", size: { width: 1440, height: 900 } },
  ])
    for (const st of ["B", "A"] as const) await run(browser, vp, st);
} finally {
  await browser.close();
}
console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ package-domain-row-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
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
console.log(`\n✅ package-domain-row-check: ${notes.length} állítás zöld`);
process.exit(0);
