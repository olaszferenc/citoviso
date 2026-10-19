// SAJÁT CÍM A VEVŐ OLDALÁN — jelvény + a cím elöl (befagyott terv: assets/design-refs/console/
// package-domain-badge, tulaj 2026-10-12 „B”, ADR-0369). A jelvény és minden „benne”/„0 Ft” szöveg
// KIZÁRÓLAG a /pricing beállításából jön: a domain-pirula helye, az „Ingyen domain csomagban”
// kapcsoló és a „Csomagban ingyen” végződések.
//
//   npx tsx scripts/package-domain-badge-check.mts [--shot <dir>]
//   npx tsx scripts/package-domain-badge-check.mts --self-test   (az ingyenes végződés figyelmen
//                                                                 kívül hagyva → PIROS kell)
//
// ⛔ MIÉRT (tulaj, 2026-10-12): élesen a pirula mind a 3 csomagban van, de ingyenes végződés
// nincs jelölve. Ilyenkor a vevő a csomagban sem kap ingyen címet — egy „+ saját .hu cím” jelvény
// hazudna. Az admin kártyáján pedig a „Saját cím benne (nincs ingyenes végződés)” felirat zöld volt,
// és a tulaj nem értette, mit kell tennie.
//
// MIT MÉR (valódi böngészőben, 390px + asztali, a valódi konfigurátoron és a valódi /pricing lapon):
//   ① FREE (pirula a középső csomagtól, .hu ingyen): jelvény a lefedő csomagokon, a többin nincs;
//      a rendelés-pirulán címke; a lefedő csomagot választva a cím-lépés (ADR-0395) EGY előre
//      kijelölt szabad nevet ad „benne a csomagban · 0 Ft”-tal, választó nélkül, a citoviso-s cím
//      fix sor; a nem lefedő csomagon díjas név „Kérem a saját címet” kapcsolóval
//   ② NOFREE (a tulaj mai esete: pirula mind a 3-ban, nincs ingyenes végződés): SEHOL nincs jelvény,
//      címke, vezető sor, „benne”
//   ③ OFF (kapcsoló KI: pkgModules = null): ugyanígy semmi
//   ④ admin /pricing, NOFREE: a csomag-kártyák cím-sora figyelmeztető (is-warn), és megmondja, hol
//      kell javítani; a „Figyelmet kér” sora is; FREE: zöld „Saját cím benne (.hu)”
//   ⑤ JS-hiba = 0
import { chromium, type Browser, type Page } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");
const SHOT_DIR = process.argv.includes("--shot") ? process.argv[process.argv.indexOf("--shot") + 1] : null;
const ORIGIN = "http://pkg-badge.test";
const ARTIFACT_ID = "00000000-0000-4000-8000-0000000000b2";

const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { injectConfigurator } = await import("../src/generator/configurator.js");
const pricing = await import("../src/pricing.js");
const { pricingPage } = await import("../src/console/views.js");
const { readFile } = await import("node:fs/promises");
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

type State = "FREE" | "NOFREE" | "OFF";
interface Manifest {
  presets: { id: string; modules: string[] }[];
  domain: { pkgModules: string[] | null; tlds: { tld: string; monthly: number; freeInPackage: boolean }[] } | null;
}

/** The page with the market state forced into the manifest, as the server would ship it. */
async function buildPreview(state: State): Promise<{ html: string; covering: string[]; others: string[] }> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] } as unknown as Recipe;
  let html = await injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name);
  const re = /(<script type="application\/json" data-cit-configurator>)([\s\S]*?)(<\/script>)/;
  const man = JSON.parse(re.exec(html)![2]!) as Manifest;
  const sorted = [...man.presets].sort((a, b) => a.modules.length - b.modules.length);
  // FREE: the pill from the middle package; NOFREE: the pill in all three (the smallest's set).
  const carrier = state === "NOFREE" ? sorted[0]! : sorted[Math.min(1, sorted.length - 1)]!;
  man.domain!.pkgModules = state === "OFF" ? null : [...carrier.modules];
  man.domain!.tlds = [
    { tld: ".hu", monthly: 1000, freeInPackage: state === "FREE" },
    { tld: ".eu", monthly: 1200, freeInPackage: false },
  ];
  const covering = state === "FREE" ? man.presets.filter((p) => carrier.modules.every((x) => p.modules.includes(x))).map((p) => p.id) : [];
  const others = man.presets.map((p) => p.id).filter((x) => !covering.includes(x));
  html = html.replace(re, (_a, o: string, _b, c: string) => `${o}${JSON.stringify(man)}${c}`);
  // Self-test: a badge that ignores the free endings (the lie the owner's state would expose).
  if (SELF_TEST) html = html.replace("if (!freePkgTlds().length) return false;", "if (!DOM || !DOM.pkgModules) return false;");
  return { html, covering, others };
}

async function serve(page: Page, html: string): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    // ADR-0395: the address step offers the first registrar-FREE suggestion.
    if (path.endsWith("/domains")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [
        { domain: "hotelpelda.hu", availability: "taken" }, { domain: "hotel-pelda.hu", availability: "free" },
      ] }) });
    }
    if (path.startsWith("/assets/ui/")) {
      const body = await readFile(new URL(`../public${path}`, import.meta.url)).catch(() => null);
      if (body) return route.fulfill({ status: 200, contentType: "text/css", body });
    }
    return route.fulfill({ status: 204, body: "" });
  });
}

async function buyerSide(browser: Browser, vp: { tag: string; size: { width: number; height: number } }, state: State): Promise<void> {
  const { html, covering, others } = await buildPreview(state);
  const page = await browser.newPage({ viewport: vp.size });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await serve(page, html);
  await page.goto(`${ORIGIN}/`);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  const label = `${vp.tag} · ${state}`;
  const tag = ((await page.locator(".cit-cfg-launch__tag").textContent().catch(() => null)) ?? "").trim();
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  const badges = (await page.evaluate(`(function () {
    return Array.prototype.map.call(document.querySelectorAll(".cit-cfg-preset"), function (c) {
      var b = c.querySelector(".cit-cfg-preset__dbadge");
      return { id: c.getAttribute("data-preset"), badge: b ? b.textContent.trim() : null };
    });
  })()`)) as { id: string; badge: string | null }[];
  /** Select a preset, walk to the address step (ADR-0395: step 2) and read it, then come back. */
  const step = async (presetId: string) => {
    await page.locator(`.cit-cfg-preset[data-preset="${presetId}"]`).click();
    await page.waitForTimeout(200);
    await page.locator(".cit-cfg-next").click();
    await page.waitForSelector(".cit-cfg-next:not([disabled])", { timeout: 15000 });
    const r = (await page.evaluate(`(function () {
      var sec = document.querySelector(".cit-cfg-dsec");
      var want = sec.querySelector(".cit-cfg-dwant");
      return {
        lead: (sec.querySelector(".cit-cfg-alead") || {}).textContent || "",
        name: (sec.querySelector(".cit-cfg-dcard__name") || {}).textContent || "",
        st: (sec.querySelector(".cit-cfg-dcard__st") || {}).textContent || "",
        want: !!want && !want.hidden,
        line: (sec.querySelector(".cit-cfg-dsubline") || {}).textContent || "",
        radios: sec.querySelectorAll(".cit-cfg-dopt").length,
      };
    })()`)) as { lead: string; name: string; st: string; want: boolean; line: string; radios: number };
    await page.locator(".cit-cfg-hback").click();
    await page.waitForTimeout(200);
    return r;
  };
  if (state === "FREE") {
    for (const id of covering) {
      const b = badges.find((x) => x.id === id)?.badge;
      check(b === "+ saját .hu cím", `① ${label}: „${id}” jelvénye „+ saját .hu cím” (mért: ${b ?? "NINCS"})`);
    }
    for (const id of others) check(!badges.find((x) => x.id === id)?.badge, `① ${label}: „${id}” (nem fedi) — nincs jelvény`);
    check(tag === "+ saját .hu cím", `① ${label}: a rendelés-pirulán címke (mért: ${tag || "NINCS"})`);
    const s = await step(covering[0]!);
    // ADR-0395: ONE pre-selected free name, „benne a csomagban · 0 Ft”, no radio pair, a fixed platform line.
    check(/saját \.hu cím jár/.test(s.lead), `① ${label}: lefedő csomagnál vezető sor (${s.lead || "NINCS"})`);
    check(s.name === "hotel-pelda.hu" && /benne a csomagban · 0 Ft/.test(s.st), `① ${label}: egy előre kijelölt szabad név, „benne a csomagban · 0 Ft” (${s.name} · ${s.st})`);
    check(!s.want && s.radios === 0, `① ${label}: nincs választó (kapcsoló: ${s.want}, rádió: ${s.radios})`);
    check(/Mindig megmarad a citoviso-s cím is: .+ — a saját címre irányít\./.test(s.line), `① ${label}: a citoviso-s cím fix sor (${s.line})`);
    if (SHOT_DIR) {
      await page.screenshot({ path: `${SHOT_DIR}/badge-cim-lepes-${vp.tag}.png` });
      await page.locator(".cit-cfg-preset").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOT_DIR}/badge-kartyak-${vp.tag}.png` });
    }
    if (others.length) {
      const o = await step(others[0]!);
      check(!/jár/.test(o.lead) && o.want && !/benne/.test(o.st) && /Az oldala ezen a címen érhető el/.test(o.line), `① ${label}: nem lefedő csomagnál díjas név, „Kérem a saját címet”, nincs „benne” (${o.lead} · ${o.st} · ${o.line})`);
    }
  } else {
    check(badges.every((x) => !x.badge), `${state === "NOFREE" ? "②" : "③"} ${label}: SEHOL nincs jelvény (${badges.map((x) => `${x.id}:${x.badge ?? "-"}`).join(" ")})`);
    check(!tag, `${state === "NOFREE" ? "②" : "③"} ${label}: a pirulán nincs címke (${tag || "-"})`);
    for (const p of badges) {
      const s = await step(p.id);
      check(!/jár/.test(s.lead) && !/benne a csomagban/.test(s.st), `${state === "NOFREE" ? "②" : "③"} ${label}: „${p.id}”: nincs „jár”, nincs „benne” (${s.lead} · ${s.st})`);
    }
    if (SHOT_DIR && state === "NOFREE") await page.screenshot({ path: `${SHOT_DIR}/badge-nincs-ingyenes-${vp.tag}.png` });
  }
  check(errors.length === 0, `⑤ ${label}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

/** ④ the operator's /pricing page: what the package card says when the pill gives nothing free. */
async function adminSide(browser: Browser, free: boolean): Promise<void> {
  const snap = pricing.pricingSnapshot("hu");
  const assign = new Map(pricing.getPackageAssignment());
  assign.set("domain", "alap");
  let html = pricingPage(snap, pricing.pricingRegions(), null, new Set(), new Map(), undefined, undefined, undefined, assign);
  const re = /(<script type="application\/json" id="pr2_data">)([\s\S]*?)(<\/script>)/;
  const data = JSON.parse(re.exec(html)![2]!) as { tlds: { tld: string; offered: boolean; freeInPackage: boolean }[] };
  data.tlds = data.tlds.map((t) => ({ ...t, offered: true, freeInPackage: free && t.tld === ".hu" }));
  html = html.replace(re, (_a, o: string, _b, c: string) => `${o}${JSON.stringify(data).replace(/</g, "\\u003c")}${c}`);
  if (!/id="dom_free"[^>]*checked/.test(html)) html = html.replace('id="dom_free" name="domain_free_in_package"', 'id="dom_free" name="domain_free_in_package" checked');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await serve(page, html);
  await page.goto(`${ORIGIN}/`);
  await page.waitForTimeout(400);
  const r = (await page.evaluate(`(function () {
    var lines = Array.prototype.map.call(document.querySelectorAll(".pr2-pkdom"), function (d) { return { cls: d.className, text: d.textContent }; });
    var att = Array.prototype.map.call(document.querySelectorAll(".pr2-att__row"), function (a) { return a.textContent; }).join(" | ");
    return { lines: lines, att: att };
  })()`)) as { lines: { cls: string; text: string }[]; att: string };
  const tag = `admin · ${free ? "FREE" : "NOFREE"}`;
  check(r.lines.length === 3, `④ ${tag}: három csomag-kártya cím-sora (mért: ${r.lines.length})`);
  if (free) {
    check(r.lines.every((l) => /\bis-in\b/.test(l.cls) && l.text === "Saját cím benne (.hu)"), `④ ${tag}: zöld „Saját cím benne (.hu)” (${r.lines.map((l) => l.text).join(" · ")})`);
  } else {
    check(
      r.lines.every((l) => /\bis-warn\b/.test(l.cls) && !/\bis-in\b/.test(l.cls) && /nincs ingyenesnek jelölt végződés/.test(l.text) && /„Csomagban ingyen” oszlopban/.test(l.text)),
      `④ ${tag}: figyelmeztető cím-sor, ami megmondja, hol kell javítani (${r.lines.map((l) => `${l.cls}: ${l.text}`).join(" · ")})`,
    );
    check(/„Csomagban ingyen” oszlopban/.test(r.att), `④ ${tag}: a „Figyelmet kér” sora is megmondja, hol kell javítani (${r.att})`);
  }
  if (SHOT_DIR) await page.locator(".pr2-pkdom").first().scrollIntoViewIfNeeded().then(() => page.screenshot({ path: `${SHOT_DIR}/admin-pricing-${free ? "ingyenes" : "nincs-ingyenes"}.png` }));
  check(errors.length === 0, `⑤ ${tag}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const vp of [
    { tag: "390px", size: { width: 390, height: 844 } },
    { tag: "asztali", size: { width: 1440, height: 900 } },
  ])
    for (const st of ["FREE", "NOFREE", "OFF"] as const) await buyerSide(browser, vp, st);
  if (!SELF_TEST) for (const f of [false, true]) await adminSide(browser, f);
} finally {
  await browser.close();
}
console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ package-domain-badge-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
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
console.log(`\n✅ package-domain-badge-check: ${notes.length} állítás zöld`);
process.exit(0);
