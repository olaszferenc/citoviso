// THE PAGE THE LEAD ACTUALLY SEES — no empty framed box, no floating pill on a CTA.
//
//   npx tsx scripts/lead-page-surface-check.mts
//
// Two findings from Elek FK-004b (2026-09-13) live here, both of the same family: the
// artifact renders, the DOM is complete, no console or HTTP error — and the lead still
// gets a broken screen.
//
//   ① The "Megközelítés" section was a 1120×340 px framed box with NOT ONE PIXEL in it.
//      Measured cause: the block is an <iframe> to Google Maps and NOTHING ELSE. When the
//      frame does not paint — lazy-loading 6 500 px down the page, a slow network, a
//      blocker, a corporate proxy — the box stays blank and UNMARKED, so the lead cannot
//      tell whether something is missing or it was built that way.
//
//   ② The floating "Ez lehet az Öné" pill sat ON TOP of the hero's primary CTA: the
//      "SZABAD IDŐPONTOT KÉREK" label was half cut off and the two identical green shapes
//      read as one. The pill is `position: fixed; bottom: 24px; left: 50%` — whether it
//      lands on a button is pure geometry, and it differs per template and per viewport.
//
//   ③ FK-005a H-2 reported the "Testre szabom" package EMPTY. Re-measured, it holds 12
//      rows — what the buyer saw was the panel body cut off right under its first group
//      label. The finding was true about the SCREEN and wrong about the mechanism, so
//      what is guarded here is the screen: no openable-but-empty package, a header count
//      that comes from the rows that exist, and a visible cue when the list is cut.
//
// WHY THE GUARD MEASURES THE WAY IT DOES
//
//   ① runs the map embed in BOTH of its failure states, because they do not look alike
//      (measured 2026-09-14, and the difference invalidated the first cut of this guard):
//      a HUNG request leaves the frame transparent — that is the photographed state, and
//      the pin card behind the frame answers it; a REFUSED request makes Chromium paint
//      its own opaque grey error page, which covers the pin AND counts as ink, so a pixel
//      check alone graded a visibly broken page green. The second state is answered by
//      text OUTSIDE the frame, and both states are asserted.
//
//   ② does NOT call the runtime's own placement code (the house rule: a guard must not
//      borrow its subject — the sorting check once measured with the comparator it was
//      checking and stayed green on a regression). Occlusion is established
//      independently: hide the pill, sample a grid of points over the rectangle it
//      occupies, note which buttons answer `elementFromPoint`; show it again and see who
//      is now buried. Geometry, not the pill's own opinion of where it is.
//
// Every half self-tests RED: the map box without its pin card, the map section without
// the row outside the frame, and the pill with its avoidance block cut out of the served
// JS. A guard never seen red proves nothing.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import sharp from "sharp";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { injectRuntime } from "../src/generator/runtime.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** A 2×2 grey PNG — a photo that always paints, with no network. */
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";

/** A lead as it really arrives: coordinates + a postal address, no owner-set location
 *  copy. That is the exact shape that produced the empty box (geo → map, nothing else). */
const DATA: SiteData = {
  name: "ELEK-PRÓBA Vendégház",
  tagline: "Próba a tóparton",
  intro: "Próba bevezető szöveg a vendégházról, két mondat hosszan, hogy legyen mit tördelni.",
  highlights: ["Zsúpfedeles borospince", "Csendes diófás kert"],
  geo: { lat: 46.7761204, lon: 17.6527838 },
  photos: [
    { url: PIX, alt: "kert", provenance: "portal" },
    { url: PIX, alt: "szoba", provenance: "portal" },
    { url: PIX, alt: "terasz", provenance: "portal" },
    { url: PIX, alt: "udvar", provenance: "portal" },
    { url: PIX, alt: "konyha", provenance: "portal" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Erzsébet utca 23, Balatonboglár, 8630" },
};

const recipe = (templateId: string): Recipe =>
  ({
    skin: TEMPLATES[templateId]!.skins[0]!,
    archetype: "stacked",
    template: templateId,
    sections: [],
  }) as unknown as Recipe;

const art = await db
  .selectFrom("mock_artifact")
  .select("id")
  .orderBy("generated_at", "desc")
  .limit(1)
  .executeTakeFirst();
if (!art) {
  console.error("❌ nincs mock_artifact a dev DB-ben — az őr nem tud konfigurátor-manifestet építeni");
  process.exit(1);
}

// ⛔ MUNKAFÁNKÉNT KÜLÖN. `assets/Temp` egy SYMLINK a fő fába, tehát MINDEN párhuzamos
// session ugyanoda ír — ez az őr pedig a futás végén `rm -rf`-eli ezt a könyvtárat
// (lásd a fájl alján). Mérve 2026-09-15: két session futtatta egyszerre, és amelyik
// előbb végzett, KITÖRÖLTE a másik alól a fixture-t → `navigating to …/artdeco.html`
// hibával elszállt a futás. A piros ilyenkor nem a termékről szól, hanem rólunk.
// A munkafa neve egyedi (`~/wt/<slug>`), ezért az a hatókör-kulcs.
const SCOPE = path.basename(path.resolve(import.meta.dirname, ".."));
const OUT = path.resolve(import.meta.dirname, `../assets/Temp/_leadsurface-${SCOPE}`);
await mkdir(OUT, { recursive: true });

const GOOGLE_HOSTS = /(^|\.)google\.com|googleapis\.com|gstatic\.com/;
const MAP_EMBED = /maps\.google\.|google\.com\/maps|maps\.googleapis\.com|maps\.gstatic\.com/;

/**
 * The map embed fails in TWO different ways, and they do NOT look alike — measured
 * 2026-09-14, and the difference invalidated the first cut of this guard:
 *
 *  "hang"   — the request never completes (lazy frame far down the page, slow line).
 *             The frame stays TRANSPARENT. THIS is the state Elek photographed: a
 *             framed void. Anything drawn behind the frame shows through.
 *  "refuse" — the request is rejected (blocker, proxy, offline). Chromium paints its
 *             OWN opaque grey error page with a torn-document glyph into the frame.
 *             It covers whatever sits behind it, and — because that glyph is ink — a
 *             pixel check calls the box "not blank" and passes a visibly broken page.
 *
 * The guard therefore runs BOTH, and asks a different question of each.
 */
async function holdMapHosts(p: Page, mode: "hang" | "refuse"): Promise<void> {
  await p.route(GOOGLE_HOSTS, (r) => {
    // ⚠️ ONLY the map embed may hang. Hanging every google.com request also hangs the
    // template's web-font stylesheet, which is parser-blocking — measured: even
    // DOMContentLoaded never fired and the guard timed out instead of measuring.
    // Fonts are refused outright in both modes, so the fixture needs no network and
    // both modes lay out identically.
    if (mode === "hang" && MAP_EMBED.test(r.request().url())) return;
    void r.abort();
  });
}

/**
 * ① EMPTY FRAMED BOX — a rectangle the lead reads as "something belongs here".
 *
 * Two independent stages, and a box is only reported when BOTH agree:
 *
 *  a) DOM — the box draws a frame (border or its own fill), and NOTHING PAINTS INSIDE
 *     ITS RECTANGLE. Note "rectangle", not "subtree": a hero's background layer is an
 *     empty element too, but the title sits on top of it, so the lead sees a full
 *     screen, not a void. Asking the subtree alone reported four such layers as empty
 *     (measured) — the question is what lands in the rectangle, whoever draws it.
 *     An <iframe> counts as a BOX, never as ink: that it can silently fail to paint is
 *     the whole finding.
 *
 *  b) PIXELS — the same rectangle, photographed, must really be featureless. This is
 *     the lelet's own measurement ("only the background and the border colour occur in
 *     the box"), and it is what keeps a decorative gradient band out of the report.
 */
const EMPTY_BOX_PROBE = `() => {
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const framed = (el) => {
    if (el.tagName === "IFRAME") return true;
    const cs = getComputedStyle(el);
    const bw = ["Top", "Right", "Bottom", "Left"].some(
      (s) => parseFloat(cs["border" + s + "Width"]) >= 1 &&
        !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs["border" + s + "Color"]),
    );
    const bg = !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor) || cs.backgroundImage !== "none";
    return bw || bg;
  };
  const hit = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 8 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 8;

  // Everything on the page that actually puts ink down, measured once.
  const inks = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.closest('[class*="cit-cfg"]')) continue; // our chrome is not the page's ink
    if (!vis(el)) continue;
    let paints = false;
    if (/^(IMG|SVG|CANVAS|VIDEO)$/.test(el.tagName)) paints = true;
    else {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.textContent.trim()) { paints = true; break; }
      }
    }
    if (!paints) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) inks.push(r);
  }

  const out = [];
  for (const el of document.querySelectorAll("section, div, article, aside, li, iframe")) {
    if (el.closest('[class*="cit-cfg"]') || el.closest("[data-cit-demoframe]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 120) continue;
    if (!vis(el) || !framed(el)) continue;
    // Only the INNERMOST framed box is judged: an outer wrapper inherits its child's
    // emptiness and would report the same rectangle two or three times.
    if ([...el.children].some((c) => {
      const cr = c.getBoundingClientRect();
      return cr.width >= 200 && cr.height >= 120 && vis(c) && framed(c);
    })) continue;
    // An IFRAME is judged by the camera, ALWAYS. Ink behind it proves nothing: a frame
    // that paints an opaque blank page hides its own fallback, and the DOM would still
    // cheerfully report "there is text in that rectangle". Only pixels can tell.
    if (el.tagName !== "IFRAME" && inks.some((ir) => hit(ir, r))) continue;
    el.setAttribute("data-cit-emptyprobe", String(out.length));
    out.push({
      i: out.length,
      sel: el.tagName.toLowerCase() + "." + String(el.className || "").trim().slice(0, 44),
      mod: el.closest("[data-cit-module]")?.getAttribute("data-cit-module") || null,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    });
  }
  return out;
}`;

/**
 * ② OCCLUSION — measured without asking the pill anything.
 *
 * Step 1 (pill hidden): over the rectangle the pill occupies, sample a grid and collect
 * every link/button that answers there AND looks like a primary action — a control with
 * its own fill or frame, not a bare text link.
 * Step 2 (pill shown): whoever answered before and does not answer now is buried.
 */
const OCCLUSION_PROBE = `() => {
  const pill = document.querySelector(".cit-cfg-launch");
  if (!pill) return { error: "nincs .cit-cfg-launch" };
  const b = pill.getBoundingClientRect();
  if (!(b.width > 0 && b.height > 0)) return { error: "a pirula nem renderel" };
  const pts = [];
  for (let i = 1; i <= 7; i++) for (let j = 1; j <= 3; j++)
    pts.push([Math.round(b.left + (b.width * i) / 8), Math.round(b.top + (b.height * j) / 4)]);

  const primary = (el) => {
    const a = el.closest("a, button, [role=button]");
    // The whole namespace, not just ".cit-cfg": the pill's own class is
    // "cit-cfg-launch", and a check that counts our chrome as a page control would
    // accuse the pill of burying itself.
    if (!a || a.closest('[class*="cit-cfg"]')) return null;
    const r = a.getBoundingClientRect();
    if (r.width < 100 || r.height < 32) return null;
    const cs = getComputedStyle(a);
    const filled = !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor) || cs.backgroundImage !== "none";
    const bordered = ["Top", "Right", "Bottom", "Left"].some(
      (s) => parseFloat(cs["border" + s + "Width"]) >= 1 &&
        !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs["border" + s + "Color"]),
    );
    if (!filled && !bordered) return null; // a bare text link is not a primary action
    return a;
  };

  const prev = pill.style.visibility;
  pill.style.visibility = "hidden";
  const under = new Map();
  for (const [x, y] of pts) {
    const hit = document.elementFromPoint(x, y);
    const a = hit && primary(hit);
    if (a) under.set(a, (a.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 38));
  }
  pill.style.visibility = prev;

  const buried = [];
  for (const [a, label] of under) {
    let free = false;
    const r = a.getBoundingClientRect();
    // The control is only "still usable" if SOME point of it is reachable.
    for (let i = 1; i <= 9; i++) for (let j = 1; j <= 3; j++) {
      const x = Math.round(r.left + (r.width * i) / 10);
      const y = Math.round(r.top + (r.height * j) / 4);
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && a.contains(hit)) { free = true; break; }
    }
    const pr = a.getBoundingClientRect();
    const ox = Math.min(pr.right, b.right) - Math.max(pr.left, b.left);
    const oy = Math.min(pr.bottom, b.bottom) - Math.max(pr.top, b.top);
    buried.push({
      label,
      coveredFrac: +Math.max(0, (ox * oy) / (pr.width * pr.height)).toFixed(2),
      fullyBlocked: !free,
      rect: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)],
    });
  }
  return {
    pill: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
    vh: innerHeight,
    buried,
  };
}`;

/** Bring the pill on stage: it enters on a beat or on the first scroll past 28 %. */
async function wakePill(p: Page): Promise<void> {
  await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 0.6)));
  await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);
}

/* ⏱ A PIRULA HELYE NEM ÓRÁRA MÉRENDŐ (ADR-0147 ②, ugyanaz a hibaosztály, itt másodszor).
 *
 * MÉRVE 2026-09-14: ez az őr `wakePill()` után AZONNAL mintavételezett, vagyis fix
 * 400+700 ms-mal — miközben a pirula ilyenkor MÉG MOZOG. A termék ugyanis szándékosan
 * KIKERÜLI az elsődleges gombot (`cit-cfg-avoid`, Elek FK-004b H-3 óta), és a `bottom`-ot
 * animálva teszi. Három egymás utáni futás HÁROM KÜLÖNBÖZŐ esetet buktatott meg
 * (aurora/mobil y=769 · fullbleed/mobil y=685 · fullbleed/asztali y=798), és ugyanarra a
 * sablonra a mért y futásonként 100+ px-et ugrált — fantom-regresszió, nem lelet.
 * Nyugvópontra várva HÁROM teljes futás 0 bukás.
 *
 * A KERET LEVEZETVE, nem tippelve — a termék saját állandóiból:
 *   `setTimeout(placeLaunch, 900)` (mount) + `schedulePlace` 120 ms debounce
 *   + a `bottom` 500 ms-os átmenete  ≈ 1 520 ms az utolsó scroll-esemény után,
 *   + a Chromium sima görgetése a lap tetejére (~300–500 ms)  ≈ 2 000 ms termék-viselkedés.
 * Ehhez jön a GÉP-TERHELÉS: ~16 párhuzamos szál mellett a mért legrosszabb megállás
 * 5 050 ms volt (aurora/asztali, 10 400 px-es lap). A plafon ezért 12 000 ms — a mért
 * legrosszabb ~2,4-szerese —, hogy a plafon SOSE legyen az ítélet.
 *
 * ⛔ A STABILITÁS az ítélet, nem a plafon: ha a pirula sosem áll meg, az PIROS, nem
 * elnyelt timeout. És a nyugalom-ablak (700 ms) hosszabb, mint a leghosszabb lehetséges
 * lökés (120 ms debounce + 500 ms átmenet) — különben egy „megállt, aztán újra elindult"
 * pirulát mondanánk nyugvónak.
 *
 * ⚠️ Ez NEM teszi vakká az őrt: a termék kikerülője KIMONDOTTAN feladja, ha a gomb elől
 * csak a képernyőről lelépve tudna kitérni (`if (lifted - h < 8) break`) — egy tartós
 * takarás tehát ugyanúgy nyugvó állapotban ül, és ugyanúgy pirosra visz. Ezt a ④ önteszt
 * bizonyítja: a kerülő-blokk nélkül a pirula MEGÁLL egy gombon, és az őr elkapja.
 */
const PILL_SETTLE_CEILING_MS = 12_000;
const PILL_QUIET_MS = 700;

async function settlePill(
  p: Page,
): Promise<{ y: number; ms: number; settled: boolean }> {
  return (await p.evaluate(
    async ([ceiling, quiet]) => {
      const el = document.querySelector<HTMLElement>(".cit-cfg-launch");
      if (!el) return { y: -1, ms: 0, settled: false };
      const t0 = performance.now();
      let last = Number.NaN;
      let since = performance.now();
      while (performance.now() - t0 < ceiling) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const y = Math.round(el.getBoundingClientRect().top);
        const painted = parseFloat(getComputedStyle(el).opacity || "0") === 1;
        if (y !== last || !painted) {
          last = y;
          since = performance.now();
          continue;
        }
        if (performance.now() - since >= quiet) {
          return { y, ms: Math.round(performance.now() - t0), settled: true };
        }
      }
      return { y: last, ms: Math.round(performance.now() - t0), settled: false };
    },
    [PILL_SETTLE_CEILING_MS, PILL_QUIET_MS] as const,
  )) as { y: number; ms: number; settled: boolean };
}

/**
 * Stage (b): is the rectangle REALLY featureless? Photographed, interior only (the
 * 3 px inset drops the frame itself), sampled on a stride so a 1120×340 box is a few
 * thousand comparisons, not four hundred thousand. A blank box holds its fill and
 * nothing else; a map, a gradient band or a photo holds hundreds of shades.
 */
async function interiorColours(p: Page, i: number): Promise<number> {
  const loc = p.locator(`[data-cit-emptyprobe="${i}"]`);
  const buf = await loc.screenshot({ timeout: 8000 }).catch(() => null);
  if (!buf) return -1; // could not be photographed → do not accuse
  const img = sharp(buf).removeAlpha();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 12 || h < 12) return -1;
  const { data, info } = await img
    .extract({ left: 3, top: 3, width: w - 6, height: h - 6 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Set<number>();
  const stride = info.channels * 3;
  for (let o = 0; o + info.channels <= data.length; o += stride) {
    seen.add((data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!);
    if (seen.size > 64) return seen.size; // plenty of ink, stop counting
  }
  return seen.size;
}

/** A box is only reported when the DOM says "nothing paints here" AND the camera agrees. */
async function emptyBoxes(p: Page): Promise<unknown[]> {
  const suspects = (await p.evaluate(callProbe(EMPTY_BOX_PROBE))) as {
    i: number;
    sel: string;
    mod: string | null;
    rect: number[];
  }[];
  const out: unknown[] = [];
  for (const s of suspects) {
    const colours = await interiorColours(p, s.i);
    if (colours >= 0 && colours <= 4) out.push({ ...s, colours });
  }
  return out;
}

/** Playwright evaluates a STRING as an expression — the probes are function sources,
 *  so they must be called, not merely produced. */
function callProbe(src: string): string {
  return `(${src})()`;
}

async function open(
  browser: Browser,
  file: string,
  w: number,
  h: number,
  mode: "hang" | "refuse" | "free" = "hang",
) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  if (mode !== "free") await holdMapHosts(p, mode);
  // ⚠️ "domcontentloaded", not "load": in hang mode the map request never completes,
  // so the window load event never fires and a default goto() would time out —
  // which is itself the proof that the frame really is left pending.
  await p.goto(`file://${file}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  return { ctx, p };
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const ids = Object.keys(TEMPLATES);
const VIEWPORTS = [
  [390, 844, "mobil"],
  [1280, 900, "asztali"],
] as const;

// ── build one page per template ──────────────────────────────────────────────
const files: Record<string, string> = {};
for (const id of ids) {
  // The REAL delivery pipeline: render → runtime (this is what carries
  // assets/runtime/cit-modules.css) → configurator. Skipping the runtime made the
  // map iframe fall back to the browser default 300×150 box — a fixture measuring a
  // page no lead ever receives.
  const html = await injectConfigurator(
    await injectRuntime(renderSite(recipe(id), DATA, { phase: "mock" })),
    art.id,
    DATA.name,
  );
  // The fixture must prove its own path: 17 renders of the same archetype page would be
  // fake coverage, and a page with no map section cannot show the defect at all.
  if (!new RegExp(`<body[^>]*class="[^"]*cit-tpl-${id}\\b`).test(html)) {
    console.error(`  ✗ ${id}: a fixture NEM a sablon-úton renderelt — a mérés hamis lenne`);
    failures++;
    continue;
  }
  if (!/data-cit-module="map"/.test(html)) {
    console.error(`  ✗ ${id}: a fixture-ben nincs térkép-szekció — az ① mérés vak lenne`);
    failures++;
    continue;
  }
  if (!/data-cit-runtime/.test(html)) {
    console.error(`  ✗ ${id}: a fixture-ből hiányzik a runtime — a modul-CSS nélkül más lapot mérnénk`);
    failures++;
    continue;
  }
  const file = path.join(OUT, `${id}.html`);
  await writeFile(file, html, "utf8");
  files[id] = file;
}

// ── ① no empty framed box, with the map frame hung ───────────────────────────
console.log(
  `\n① Üres, jelöletlen doboz SEHOL (a térkép-keret FÜGGŐBEN — ez a fényképezett állapot; ${ids.length} sablon × 2 méret):\n`,
);
for (const [id, file] of Object.entries(files)) {
  for (const [w, h, vp] of VIEWPORTS) {
    const { ctx, p } = await open(browser, file, w, h);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(500);
    await p.evaluate(() => window.scrollTo(0, 0));
    // Fixture fidelity, geometrically: the map slot must stand at its DESIGNED size.
    // A 300×150 box means the module stylesheet never arrived, and everything measured
    // after that would be a page no lead receives (measured 2026-09-14 — the first cut
    // of this guard reported exactly that box).
    const mapH = await p.evaluate(() => {
      const el = document.querySelector('[data-cit-module="map"] iframe, [data-cit-module="map"] .cit-map-box');
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    });
    check(`${id}/${vp}: a térkép-slot a tervezett méretében áll (h=${mapH})`, mapH >= 300);
    const boxes = await emptyBoxes(p);
    check(`${id}/${vp}: nincs üres keretezett doboz`, boxes.length === 0, boxes);
    await ctx.close();

    // ①b THE OTHER FAILURE MODE — the frame refused. Chromium then paints its own
    // opaque error page over anything behind it, and no code in the parent page can
    // tell (a cross-origin error page fires `load` exactly like a map). So the
    // section must carry readable location text OUTSIDE the frame, where no third
    // party can paint over it. ⚠️ The pixel check alone passes this state, because
    // the browser's torn-document glyph counts as ink — it was green on a visibly
    // broken page until this second measurement was added.
    const ref = await open(browser, file, w, h, "refuse");
    await ref.p.evaluate(() => {
      document.querySelector('[data-cit-module="map"]')?.scrollIntoView();
    });
    await ref.p.waitForTimeout(400);
    const outside = await ref.p.evaluate(() => {
      const sec = document.querySelector<HTMLElement>('[data-cit-module="map"]');
      if (!sec) return { ok: false, text: "nincs térkép-szekció" };
      // Everything the section says with the frame's own contents excluded.
      const clone = sec.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("iframe, .cit-map-pin, h1, h2, h3").forEach((n) => n.remove());
      const text = (clone.textContent || "").replace(/\s+/g, " ").trim();
      return { ok: text.length >= 8, text: text.slice(0, 60) };
    });
    check(
      `${id}/${vp}: elutasított keret mellett is mond valamit a szekció („${outside.text}”)`,
      outside.ok,
      outside,
    );
    await ref.ctx.close();
  }
}

// ── ② the floating pill buries no primary action ─────────────────────────────
console.log(`\n② A lebegő pirula nem takar elsődleges műveletet (${ids.length} sablon × 2 méret):\n`);
for (const [id, file] of Object.entries(files)) {
  for (const [w, h, vp] of VIEWPORTS) {
    const { ctx, p } = await open(browser, file, w, h);
    await wakePill(p);
    // A PIXELRE várunk, nem órára: a kikerülés animált, és a mozgó pirula bármelyik
    // gombra ráeshet egy pillanatra anélkül, hogy a lead valaha is takarva látná.
    const st = await settlePill(p);
    const r = (await p.evaluate(callProbe(OCCLUSION_PROBE))) as {
      error?: string;
      pill?: number[];
      buried?: { label: string; coveredFrac: number; fullyBlocked: boolean }[];
    };
    // A meg nem álló pirula ÖNMAGÁBAN lelet (a kikerülő oszcillál) — nem elnyelt timeout.
    check(
      `${id}/${vp}: a pirula MEGÁLL (${st.ms} ms)`,
      st.settled,
      st.settled ? "" : { ...st, ceiling: PILL_SETTLE_CEILING_MS },
    );
    check(`${id}/${vp}: a pirula senkit nem temet be (y=${r.pill?.[1]})`, !r.error && r.buried?.length === 0, r);
    await ctx.close();
  }
}

// ── ③ the "Testre szabom" package: items, or not openable ────────────────────
// Elek FK-005a H-2 reported it EMPTY. Re-measured: it holds 12 rows — what the buyer
// saw was the panel body cut off right under the first group label, on a viewport
// where the step-2 footer squeezes the body to ~280 px. So the check is not "are
// there rows" alone; it is that the box never presents itself as an openable package
// with nothing to show, that its header count equals the rows that exist (the label
// derives from what it describes), and that a cut list says so.
console.log("\n③ A „Testre szabom” doboz — vagy tétel van benne, vagy nem nyitható:\n");
for (const [w, h, vp] of VIEWPORTS) {
  const { ctx, p } = await open(browser, files["fullbleed"] ?? Object.values(files)[0]!, w, h);
  await wakePill(p);
  await p.evaluate(() => (document.querySelector(".cit-cfg-launch") as HTMLElement)?.click());
  await p.waitForTimeout(700);
  // Step 2 is the state the finding was photographed in: the taller footer is what
  // shrinks the body until the list disappears below the fold.
  for (const step of ["1", "2"] as const) {
    if (step === "2") {
      await p.evaluate(() => (document.querySelector(".cit-cfg-next") as HTMLElement)?.click());
      await p.waitForTimeout(400);
    }
    const r = await p.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".cit-cfg-custombox");
      const detail = document.querySelector<HTMLElement>(".cit-cfg-detail");
      const body = document.querySelector<HTMLElement>(".cit-cfg-body");
      const cue = document.querySelector<HTMLElement>(".cit-cfg-scrollcue");
      const rows = detail ? detail.querySelectorAll(".cit-cfg-rowbox").length : 0;
      const badge = (document.querySelector(".cit-cfg-customize__n")?.textContent || "").trim();
      return {
        boxShown: !!box && !box.hidden && box.getBoundingClientRect().height > 0,
        openable: !!document.querySelector(".cit-cfg-customize"),
        rows,
        badge,
        badgeNum: Number((badge.match(/\d+/) || [])[0] ?? -1),
        hiddenBelow: body ? Math.round(body.scrollHeight - body.clientHeight - body.scrollTop) : 0,
        cueShown: !!cue && !cue.hidden,
      };
    });
    check(
      `${vp}/lépés ${step}: nyitható csomag nem lehet üres (sorok=${r.rows})`,
      !r.boxShown || r.rows > 0,
      r,
    );
    check(`${vp}/lépés ${step}: a fejléc száma a MEGLÉVŐ sorokat mondja (${r.badge || "—"})`, !r.boxShown || r.badgeNum === r.rows, r);
    check(
      `${vp}/lépés ${step}: ha ${r.hiddenBelow} px lóg a látható rész alá, a lap ezt jelzi`,
      r.hiddenBelow <= 8 ? !r.cueShown : r.cueShown,
      r,
    );
  }
  await p.screenshot({
    path: path.resolve(import.meta.dirname, `../assets/Temp/leadsurface-${SCOPE}-panel-${vp}.png`),
  });
  await ctx.close();
}

// ── ④ RED self-test — the halves must be able to fail ────────────────────────
console.log("\n④ Önteszt — az őrnek pirosra kell tudnia menni:\n");

// ④a the map box WITHOUT its pin card — the bug exactly as it was reported
const victim = files["fullbleed"] ?? Object.values(files)[0]!;
const src = await readFile(victim, "utf8");
const bare = path.join(OUT, "_nopin.html");
const noPin = src.replace(/<div class="cit-map-pin">[\s\S]*?<\/div>\s*<\/div>/g, "</div>");
await writeFile(bare, noPin, "utf8");
// ⚠️ Assert on the MARKUP, not on the class name: the inlined stylesheet also contains
// ".cit-map-pin", so "the string is gone" was false even when the card had been cut.
check(
  "az önteszthez a pin-kártya tényleg kivágódott",
  noPin !== src && !noPin.includes('<div class="cit-map-pin">'),
);
{
  const { ctx, p } = await open(browser, bare, 1280, 900);
  await p.evaluate(() => {
    document.querySelector('[data-cit-module="map"]')?.scrollIntoView();
  });
  await p.waitForTimeout(500);
  const boxes = (await emptyBoxes(p)) as { mod?: string }[];
  check(
    "pin-kártya nélkül, függő keretnél a térkép-doboz ÜRESNEK mérődik (az őr él)",
    boxes.some((b) => b.mod === "map"),
    boxes,
  );
  await p.screenshot({
    path: path.resolve(import.meta.dirname, `../assets/Temp/leadsurface-${SCOPE}-map-ELOTTE.png`),
  });
  await ctx.close();
}

// ④a2 the section WITHOUT the address row outside the frame — the refused-frame state
{
  // ⚠️ Cut INSIDE the map section only. The unanchored pattern matched the first
  // `cit-modsec__grid` on the page — a different module's list — so the row under the
  // map survived and the self-test "failed" for the wrong reason.
  const secStart = src.indexOf('<section class="cit-modsec" data-cit-module="map"');
  const secEnd = src.indexOf("</section>", secStart);
  const section = src.slice(secStart, secEnd);
  const noRow =
    secStart < 0
      ? src
      : src.slice(0, secStart) +
        section.replace(/<ul class="cit-modsec__grid"[\s\S]*?<\/ul>/, "") +
        src.slice(secEnd);
  const bareRow = path.join(OUT, "_norow.html");
  await writeFile(bareRow, noRow, "utf8");
  check("az önteszthez a kereten kívüli cím-sor tényleg kivágódott", secStart >= 0 && noRow !== src);
  const { ctx, p } = await open(browser, bareRow, 1280, 900, "refuse");
  await p.evaluate(() => {
    document.querySelector('[data-cit-module="map"]')?.scrollIntoView();
  });
  await p.waitForTimeout(400);
  const outside = await p.evaluate(() => {
    const sec = document.querySelector<HTMLElement>('[data-cit-module="map"]');
    const clone = sec?.cloneNode(true) as HTMLElement | undefined;
    clone?.querySelectorAll("iframe, .cit-map-pin, h1, h2, h3").forEach((n) => n.remove());
    return (clone?.textContent || "").replace(/\s+/g, " ").trim();
  });
  check(
    "a kereten kívüli sor nélkül az elutasított keret NÉMA szekciót hagy (az őr él)",
    outside.length < 8,
    { outside },
  );
  await ctx.close();
}

// ④b with the avoidance block CUT OUT of the served JS, the pill must bury a button
// again — the bug exactly as Elek photographed it. No test switch lives in the shipped
// runtime; the block is removed from the page, the same way the float-check strips the
// CSS armour.
{
  let caught: unknown = null;
  let stripCount = 0;
  for (const [id, file] of Object.entries(files)) {
    const naiveSrc = (await readFile(file, "utf8")).replace(
      /\/\* cit-cfg-avoid-start[\s\S]*?cit-cfg-avoid-end \*\//,
      "",
    );
    if (naiveSrc.includes("cit-cfg-avoid-start")) continue; // nothing was cut — skip
    stripCount++;
    const naive = path.join(OUT, `${id}.noavoid.html`);
    await writeFile(naive, naiveSrc, "utf8");
    for (const [w, h, vp] of VIEWPORTS) {
      const { ctx, p } = await open(browser, naive, w, h);
      await wakePill(p);
      // ⭐ Az öntesztnek UGYANAZZAL a mércével kell mérnie, mint a ②-nek — különben a
      // zöldje egy másik kérdésre felelne. Kerülő nélkül a pirula meg sem mozdul, tehát
      // azonnal nyugvó — és pont ott ül, ahol a gomb van.
      await settlePill(p);
      const r = (await p.evaluate(callProbe(OCCLUSION_PROBE))) as { buried?: unknown[] };
      if (r.buried?.length) {
        caught = { template: id, viewport: vp, ...r };
        await p.screenshot({
          path: path.resolve(import.meta.dirname, `../assets/Temp/leadsurface-${SCOPE}-pill-ELOTTE.png`),
        });
      }
      await ctx.close();
      if (caught) break;
    }
    if (caught) break;
  }
  check("a kerülő-blokk tényleg kivágódott a kiszolgált JS-ből", stripCount > 0, { stripCount });
  check("ütközés-kerülés nélkül a pirula tényleg betemet egy gombot (az őr él)", !!caught, caught);

  // ④d A MEG NEM ÁLLÓ pirula is lelet — és ennek az állításnak is kell piros ikre.
  // Enélkül a „a pirula MEGÁLL" sor csupa zöldje semmit nem bizonyítana: egy olyan
  // várakozás, ami SOHA nem tud settled=false-t adni, nem mérés, hanem díszlet.
  // Szintetikusan oszcilláltatjuk a pirulát (minden képkockán mozdul egyet), és
  // elvárjuk, hogy a nyugvópont-várás a plafonig fusson és PIROSAT mondjon.
  {
    const victimFile = files["fullbleed"] ?? Object.values(files)[0]!;
    const osc = path.join(OUT, "_oscillate.html");
    await writeFile(
      osc,
      (await readFile(victimFile, "utf8")).replace(
        "</body>",
        `<script>(function(){function t(){var e=document.querySelector(".cit-cfg-launch");
if(e){e.style.setProperty("transition","none","important");
e.style.setProperty("bottom",(24+(Math.floor(performance.now()/16)%40))+"px","important");}
requestAnimationFrame(t);}requestAnimationFrame(t);})();</script></body>`,
      ),
      "utf8",
    );
    const { ctx, p } = await open(browser, osc, 390, 844);
    await wakePill(p);
    const st = await settlePill(p);
    await ctx.close();
    check(
      "⭐ oszcilláló pirulát a nyugvópont-várás PIROSNAK lát (settled=false)",
      st.settled === false,
      st,
    );
  }
}

await browser.close();
await db.destroy();
await rm(OUT, { recursive: true, force: true });

if (failures) {
  console.error(`\n❌ lead-page-surface-check: ${failures} bukás — a leadnek kiszállított lap törött`);
  process.exit(1);
}
console.log(
  `\n✅ lead-page-surface-check: ${ids.length} sablon × 2 méret — ① nincs üres keretezett doboz ` +
    `(függő ÉS elutasított térkép-keret mellett is), ② a lebegő pirula egyetlen elsődleges gombot ` +
    `sem takar, ③ a „Testre szabom” doboz nem nyitható üresre és a fejléc-száma a meglévő sorokat ` +
    `mondja — + piros önteszt mind a háromra.`,
);
process.exit(0);
