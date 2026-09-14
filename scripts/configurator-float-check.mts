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
// `isVisible()` says true.
//
// The verdict is therefore TWO questions, and neither answers the other (MEASURED 2026-09-14,
// see `measure()`): is it PAINTED — opacity 1, i.e. can a human see it — and is it NOT COVERED
// — inside the viewport and elementFromPoint hits it. Asked alone, the geometric half certified
// a fully transparent buy button as clickable, six runs out of ten.
//
// Runs over ALL art templates, phone + desktop, and self-tests RED three ways: the armour
// stripped out of the served CSS, the reveal left transparent, and the visitor who never
// scrolls — a guard never seen red proves nothing.

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

// How long the buyer may be left without a way to buy. The budgets are derived from the
// PRODUCT's own two constants, not guessed from a wall clock:
const FALLBACK_MS = 2600; // cit-configurator.js — setTimeout(showPill, 2600)
const FADE_MS = 500; //     cit-configurator.css — transition: opacity .5s
// MEASURED 2026-09-14, aurora (the slowest template by far — its own scroll work decides,
// not our code; the rest land ~10× faster):
//   • scroll path:    fully painted in 1,0–1,8 s
//   • no-scroll path: fully painted in 3,3–3,6 s idle, and 4,6 s while this box ran seven
//     parallel sessions — so ~1 s of the budget is machine load, not product behaviour.
// The slack is therefore explicit and the same on both paths; a barely-passing budget would
// just move the coin flip somewhere else.
const LOAD_SLACK_MS = 4000;
const SCROLL_BUDGET_MS = FADE_MS + LOAD_SLACK_MS; //           4 500 ms
const STILL_BUDGET_MS = FALLBACK_MS + FADE_MS + LOAD_SLACK_MS; // 7 100 ms

/** Measure the buyer's entry point on one page: fixed layer + PAINTED + inside viewport + hittable.
 *  With `shot`, also leaves a proof image behind (the owner judges pictures, not logs).
 *
 *  ⏱ WAIT FOR THE PIXEL, NOT FOR THE CLOCK. Until 2026-09-14 this sampled at a fixed 700 ms
 *  after the scroll, and it was wrong in BOTH directions — measured on aurora/1280×900, same
 *  unchanged build, 10 runs: 4 RED, 6 GREEN. The reveal itself lands anywhere in 438–1047 ms
 *  (aurora's own scroll work decides, not our code; other templates: ~150 ms), so the fixed
 *  sample was a coin flip that reported a phantom regression.
 *  ⛔ The GREEN half was the dangerous one: at 700 ms the pill already had `pointer-events:auto`
 *  and `elementFromPoint` HIT it — while its opacity was still exactly 0 and the screenshot
 *  showed NOTHING there. elementFromPoint hits transparent elements; on its own it answers
 *  "is anything covering this box?", never "can a human see it". So the verdict below is
 *  BOTH: painted (opacity 1) AND not covered (elementFromPoint). */
async function measure(
  browser: Browser,
  file: string,
  w: number,
  h: number,
  opts: { shot?: string; noScroll?: boolean } = {},
) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`file://${file}`);
  // The invite pill enters after a beat OR on first scroll (cit-configurator.js: showPill).
  // Scrolling past 28% is the faster, equally real trigger; `noScroll` measures the other
  // half — the visitor who just looks and never scrolls at all.
  if (!opts.noScroll) await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 0.6)));
  // Poll per animation frame until the entry is FULLY painted, or the budget runs out.
  // `paintedMs === null` means it never arrived — the assertions below then go red with the
  // last opacity in the detail, instead of the guard silently swallowing the timeout.
  const paintedMs = await p.evaluate(async (budget: number) => {
    const el = document.querySelector<HTMLElement>(".cit-cfg-launch");
    if (!el) return null;
    const t0 = performance.now();
    for (;;) {
      if (getComputedStyle(el).opacity === "1") return Math.round(performance.now() - t0);
      if (performance.now() - t0 > budget) return null;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  }, opts.noScroll ? STILL_BUDGET_MS : SCROLL_BUDGET_MS);
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
  if (opts.shot)
    await p.screenshot({ path: path.resolve(import.meta.dirname, `../assets/Temp/${opts.shot}.png`) });
  await ctx.close();
  return r ? { ...r, paintedMs, errs } : r;
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
  // …and the same page whose reveal never finishes painting: the `.cit-cfg-in` rule keeps
  // `pointer-events:auto` and the slide-in, but stays transparent. That is the exact state
  // the old 700 ms sample certified as GREEN, so the new "painted" assertion must catch it.
  await writeFile(
    path.join(OUT, `${id}.unpainted.html`),
    html.replace(/(\.cit-cfg-launch\.cit-cfg-in\s*\{\s*)opacity:\s*1;/, "$1opacity: 0;"),
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
    // A human must SEE it — opacity 1, within the stated budget. `elementFromPoint` alone
    // says yes to a fully transparent pill (measured), so this assertion carries the "is it
    // visible" half and the one below carries the "is it covered" half.
    check(
      `${id}/${vp}: a vevő LÁTJA — teljesen kifestve (${m?.paintedMs ?? "SOHA"} ms a görgetéstől)`,
      m?.paintedMs !== null && m?.opacity === "1",
      m,
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
const bare = await measure(browser, path.join(OUT, "aurora.noarmour.html"), 390, 844, {
  shot: "cfg-float-aurora-ELOTTE",
});
check(
  `az őr pirosra tud menni: páncél nélkül az aurora belépője kiesik (position=${bare?.position}, y=${bare?.y})`,
  bare?.position !== "fixed" || !bare?.inView,
  bare,
);
const armoured = await measure(browser, path.join(OUT, "aurora.html"), 390, 844, {
  shot: "cfg-float-aurora-UTANA",
});
check(
  `ugyanaz a lap páncéllal viszont lebeg (y=${armoured?.y})`,
  armoured?.position === "fixed" && !!armoured?.inView && !!armoured?.hit,
  armoured,
);

// ── RED self-test #2: the false GREEN the old guard produced. The pill is in the fixed
// layer, in the viewport, `pointer-events:auto`, and elementFromPoint HITS it — and the
// buyer sees nothing. The geometric verdict must stay green here (that is the point: it is
// blind to this), while the "painted" verdict goes red. If both went red, this would prove
// nothing about the new assertion.
console.log("\n③ Önteszt — a láthatatlan (de kattintható) pirula: a régi őr ZÖLDJE:\n");
const ghost = await measure(browser, path.join(OUT, "aurora.unpainted.html"), 1280, 900, {
  shot: "cfg-float-aurora-LATHATATLAN",
});
check(
  `a geometriai verdikt itt ZÖLD marad — elementFromPoint az átlátszó pirulát is eltalálja (hit=${ghost?.hit}, pointer-events=${ghost?.pe})`,
  !!ghost?.inView && !!ghost?.hit && ghost?.position === "fixed",
  ghost,
);
check(
  `a LÁTHATÓSÁG verdikt viszont pirosra megy (opacity=${ghost?.opacity}) — ezt engedte át a régi 700 ms-os mérés`,
  ghost?.paintedMs === null && ghost?.opacity !== "1",
  ghost,
);

// ── ④ The other half of the audience: the visitor who never scrolls. The entry is then
// revealed only by the unconditional `setTimeout(showPill, 2600)`. Measured at ~2,54 s +
// the fade; if that fallback ever breaks, a still visitor could never buy at all.
console.log("\n④ Aki EGYÁLTALÁN NEM görget — a belépőnek magától meg kell jelennie:\n");
const still = await measure(browser, path.join(OUT, "aurora.html"), 1280, 900, { noScroll: true });
check(
  `aurora/asztali, nulla görgetés: a belépő magától kifestődik (${still?.paintedMs ?? "SOHA"} ms) és kattintható`,
  still?.paintedMs !== null && still?.opacity === "1" && !!still?.inView && !!still?.hit,
  still,
);

await browser.close();
await db.destroy();
await rm(OUT, { recursive: true, force: true });

if (failures) {
  console.error(`\n❌ configurator-float-check: ${failures} bukás — a vevő nem találná a vásárlás gombot`);
  process.exit(1);
}
console.log(
  "\n   📷 bizonyíték: assets/Temp/cfg-float-aurora-ELOTTE.png (páncél nélkül), -UTANA.png és -LATHATATLAN.png",
);
console.log(
  `\n✅ configurator-float-check: a vásárlási belépő mind a ${ids.length} sablonon LÁTSZIK és kattintható (${armourStripped.length}×3 mérés + 3 önteszt + a nem-görgető látogató).`,
);
process.exit(0);
