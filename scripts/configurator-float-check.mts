// The buyer's entry point must FLOAT on EVERY art template.
//
//   npx tsx scripts/configurator-float-check.mts
//
// Why this guard exists: the prospect configurator is injected into a generated mock whose
// own template CSS we do not control. MEASURED 2026-09-08 — aurora.ts's
// `body>*:not(.au-aurora):not(.au-nav){position:relative}` out-specified every single-class
// rule in cit-configurator.css, so on an aurora mock the launch pill sat at y≈14 000 px (the
// very bottom of the page) instead of floating at y≈769. The mock looked perfect; the way to
// BUY it was gone. Nothing caught it — the artifact renders, the DOM contains the button, and
// `isVisible()` says true. The verdict here is therefore geometric: is it inside the viewport,
// and does elementFromPoint actually hit it?
//
// Runs over ALL art templates, phone + desktop, and self-tests RED by stripping the armour
// block out of the served CSS — a guard never seen red proves nothing.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const DATA: SiteData = {
  name: "Teszt Vendégház",
  tagline: "Teszt a tóparton",
  intro: "Teszt bevezető szöveg a vendégházról.",
  highlights: ["Zsúpfedeles borospince", "Csendes diófás kert"],
  photos: [
    { url: "https://img.example/f1.jpg", alt: "kert", provenance: "portal" },
    { url: "https://img.example/f2.jpg", alt: "szoba", provenance: "portal" },
    { url: "https://img.example/f3.jpg", alt: "terasz", provenance: "portal" },
    { url: "https://img.example/f4.jpg", alt: "udvar", provenance: "portal" },
    { url: "https://img.example/f5.jpg", alt: "konyha", provenance: "portal" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
};

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

/** An artifact id the configurator manifest can be built from (module list, prices). */
const art = await db
  .selectFrom("mock_artifact")
  .select("id")
  .orderBy("generated_at", "desc")
  .limit(1)
  .executeTakeFirst();
if (!art) {
  console.error("❌ nincs mock_artifact a dev DB-ben — az őr nem tud manifestet építeni");
  process.exit(1);
}

const OUT = path.resolve(import.meta.dirname, "../assets/Temp/_cfgfloat");
await mkdir(OUT, { recursive: true });

/** Measure the buyer's entry point on one page: fixed layer + inside viewport + hittable.
 *  With `shot`, also leaves a proof image behind (the owner judges pictures, not logs). */
async function measure(browser: Browser, file: string, w: number, h: number, shot?: string) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`file://${file}`);
  // The invite pill enters after a beat OR on first scroll (cit-configurator.js: showPill).
  // Scrolling past 28% is the faster, equally real trigger — waiting 2.6s × 34 measurements
  // would only make the guard slow, not truer.
  await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 0.6)));
  await p.waitForTimeout(700); // the slide-in transition
  const r = await p.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".cit-cfg-launch");
    if (!el) return null;
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const cx = Math.round(b.left + b.width / 2);
    const cy = Math.round(b.top + b.height / 2);
    const inView = b.height > 0 && b.top < innerHeight && b.bottom > 0;
    const top = inView ? document.elementFromPoint(cx, cy) : null;
    return {
      position: cs.position,
      y: Math.round(b.y),
      vh: innerHeight,
      inView,
      hit: !!top?.closest(".cit-cfg-launch"),
      cls: el.className,
      opacity: cs.opacity,
      pe: cs.pointerEvents,
      topEl: top ? top.tagName + "." + String(top.className).slice(0, 30) : null,
    };
  });
  if (shot) await p.screenshot({ path: path.resolve(import.meta.dirname, `../assets/Temp/${shot}.png`) });
  await ctx.close();
  return r ? { ...r, errs } : r;
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const ids = Object.keys(TEMPLATES);

console.log(`\n① A vásárlási belépő LEBEG mind a ${ids.length} sablonon (mobil + asztali):\n`);

const armourStripped: string[] = [];
for (const id of ids) {
  const html = await injectConfigurator(
    renderSite(recipe(id), DATA, { phase: "mock" }),
    art.id,
    DATA.name,
  );
  const file = path.join(OUT, `${id}.html`);
  await writeFile(file, html, "utf8");
  // Fail loudly if the fixture silently fell back to the archetype path: 17 identical
  // pages measured 17 times is fake coverage, not a guard.
  if (!new RegExp(`<body[^>]*class="[^"]*cit-tpl-${id}\\b`).test(html)) {
    console.error(`  ✗ ${id}: a fixture NEM a sablon-úton renderelt — a mérés hamis lenne`);
    failures++;
    continue;
  }
  // The same page with the armour block removed — used later for the RED self-test.
  await writeFile(
    path.join(OUT, `${id}.noarmour.html`),
    html.replace(/\/\* cit-cfg-armour-start[\s\S]*?cit-cfg-armour-end \*\//, ""),
    "utf8",
  );
  armourStripped.push(id);

  for (const [w, h, vp] of [
    [390, 844, "mobil"],
    [1280, 900, "asztali"],
  ] as const) {
    const m = await measure(browser, file, w, h);
    check(
      `${id}/${vp}: a belépő a fixed rétegben van`,
      m?.position === "fixed",
      m ? { position: m.position, y: m.y } : "nincs .cit-cfg-launch",
    );
    check(
      `${id}/${vp}: a képernyőn van és rá lehet kattintani (y=${m?.y}, viewport=${m?.vh})`,
      !!m?.inView && !!m.hit,
      m,
    );
  }
}

// ── RED self-test: without the armour, aurora (the template that caused this) must FAIL.
console.log("\n② Önteszt — a páncél NÉLKÜL az aurora sablonnak buknia kell:\n");
const bare = await measure(browser, path.join(OUT, "aurora.noarmour.html"), 390, 844, "cfg-float-aurora-ELOTTE");
check(
  `az őr pirosra tud menni: páncél nélkül az aurora belépője kiesik (position=${bare?.position}, y=${bare?.y})`,
  bare?.position !== "fixed" || !bare?.inView,
  bare,
);
const armoured = await measure(browser, path.join(OUT, "aurora.html"), 390, 844, "cfg-float-aurora-UTANA");
check(
  `ugyanaz a lap páncéllal viszont lebeg (y=${armoured?.y})`,
  armoured?.position === "fixed" && !!armoured?.inView && !!armoured?.hit,
  armoured,
);

await browser.close();
await db.destroy();
await rm(OUT, { recursive: true, force: true });

if (failures) {
  console.error(`\n❌ configurator-float-check: ${failures} bukás — a vevő nem találná a vásárlás gombot`);
  process.exit(1);
}
console.log("\n   📷 bizonyíték: assets/Temp/cfg-float-aurora-ELOTTE.png (páncél nélkül) és -UTANA.png");
console.log(
  `\n✅ configurator-float-check: a vásárlási belépő mind a ${ids.length} sablonon lebeg és kattintható (${armourStripped.length}×2 mérés + piros önteszt).`,
);
process.exit(0);
