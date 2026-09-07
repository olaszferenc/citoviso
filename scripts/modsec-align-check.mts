// Guard: a CENTRED section heading must have CENTRED content under it (owner call
// 2026-09-07, variant "C" — see templateKit.centredModsecCss).
//
// WHY A GUARD AND NOT A CODE COMMENT: `--cit-modsec-head-align:center` centres only
// the H2. Everything below it came from the shared module block, which packs its grid
// from the left — so on a wide screen the row sat off-centre under a centred title and
// the page read as "kesze-kusza" (owner, measured on his 1900px window: a 284px phantom
// column under "A környéken", a 568px one under the amenity tail, 849px next to the
// price tabs). Nothing in the type system or in the existing checks could see that: it
// is a LAYOUT fact, visible only in a real browser at a real width.
//
// The measurement is deliberately the visitor's: for every module section whose heading
// is centred, is the CONTENT centred in the same content box? Blocks that are inline by
// nature (the rating badge) or that lay themselves out (the price table) are measured as
// ELEMENTS, not through their children — measuring a table's tbody reports nonsense.
//
//   npx tsx scripts/modsec-align-check.mts
//
// Runs with no DB and no network (inline demo data, data: URI photos).

process.env.CIT_SHOT = "1";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { centredModsecCss } from "../src/engine/templateKit.js";

/** A 1×1 grey pixel: the layout needs photo BOXES, not photo bytes — and a guard must
 *  not depend on a photo host being up. */
const PX =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="900" height="560" fill="#cfc7bd"/></svg>');

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro:
    "Kilenc szobás butikhotel a régi városfal tövében, saját teraszos étteremmel és borpincével.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness", "Teraszos étterem"],
  photos: [1, 2, 3, 4, 5, 6].map((i) => ({ url: PX, alt: `Kép ${i}`, provenance: "owner" as const })),
  contact: { email: "foglalas@hotelpelda.hu", address: "3300 Példaváros, Vár utca 2." },
  // Six tiles → the last row holds two: exactly the ragged tail the fix has to centre.
  amenities: ["Ingyenes wifi", "Parkolás", "Reggeli", "Klíma", "Terasz, kert", "Kisállat"],
  // Three cards where four columns fit → the phantom-column case.
  poi: ["Strand, vízpart", "Éttermek, borászatok", "Látnivalók, túraútvonalak"],
  rooms: [
    { name: "Superior szoba", capacity: "2 fő", note: "Városra néző.", photo: { url: PX, alt: "Superior" } },
    { name: "Deluxe panoráma", capacity: "2 fő", note: "Franciaerkély.", photo: { url: PX, alt: "Deluxe" } },
    { name: "Lakosztály", capacity: "2–3 fő", note: "Külön nappali.", photo: { url: PX, alt: "Lakosztály" } },
  ],
  rating: { value: 4.6, count: 394 },
  place: { city: "Példaváros", country: "HU" },
};

/** Blocks measured through their CHILDREN (they stretch to the content box, so only the
 *  children say where the content actually sits) and blocks measured as elements. */
const BY_CHILDREN = ".cit-modsec__grid,.cit-modsec__facts,.cit-price__tabs,form.cit-news";
const BY_SELF = ".cit-grat,.cit-modsec__in table";

const WIDTHS = [1900, 1280, 390];
/** Sub-pixel rounding and a single-pixel border are not a design flaw. */
const TOLERANCE = 24;

interface Finding {
  readonly template: string;
  readonly width: number;
  readonly module: string;
  readonly block: string;
  readonly left: number;
  readonly right: number;
  readonly which: string;
}

async function measure(page: import("playwright-core").Page): Promise<Finding[]> {
  return (await page.evaluate(
    ([byChildren, bySelf, tol]) => {
      const out: Omit<Finding, "template" | "width">[] = [];
      for (const sec of Array.from(document.querySelectorAll(".cit-modsec"))) {
        const inner = sec.querySelector(".cit-modsec__in") as HTMLElement | null;
        const h2 = sec.querySelector("h2");
        if (!inner || !h2 || getComputedStyle(h2).textAlign !== "center") continue;
        const ib = inner.getBoundingClientRect();
        const cs = getComputedStyle(inner);
        const boxL = ib.left + parseFloat(cs.paddingLeft);
        const boxR = ib.right - parseFloat(cs.paddingRight);
        const module = sec.getAttribute("data-cit-module") ?? "?";
        // (block, left-x, right-x, which) tuples — collected first, judged below, so this
        // evaluate() body stays free of named helpers (esbuild's keep-names shim does not
        // exist inside the page).
        const spans: [string, number, number, string][] = [];
        for (const b of Array.from(inner.querySelectorAll(byChildren as string))) {
          const kids = Array.from(b.children) as HTMLElement[];
          if (!kids.length) continue;
          const rects = kids.map((k) => k.getBoundingClientRect());
          const name = b.className || b.tagName;
          spans.push([name, Math.min(...rects.map((r) => r.left)), Math.max(...rects.map((r) => r.right)), "blokk"]);
          // The wrapped tail is its own judgment: a full first row hides a stranded last one.
          const tops = rects.map((r) => Math.round(r.top));
          const lastTop = Math.max(...tops);
          const tail = rects.filter((_, i) => tops[i] === lastTop);
          if (tail.length !== rects.length) {
            spans.push([name, Math.min(...tail.map((r) => r.left)), Math.max(...tail.map((r) => r.right)), "utolsó sor"]);
          }
        }
        for (const b of Array.from(inner.querySelectorAll(bySelf as string))) {
          const r = b.getBoundingClientRect();
          if (r.width) spans.push([b.className || b.tagName.toLowerCase(), r.left, r.right, "elem"]);
        }
        for (const [block, l, r, which] of spans) {
          const left = Math.round(l - boxL);
          const right = Math.round(boxR - r);
          if (Math.abs(left - right) > (tol as number)) out.push({ module, block, left, right, which });
        }
      }
      return out;
    },
    [BY_CHILDREN, BY_SELF, TOLERANCE] as const,
  )) as Finding[];
}

async function main(): Promise<void> {
  const red = process.argv.includes("--red");
  const centred = Object.entries(TEMPLATES).filter(([, t]) =>
    /--cit-modsec-head-align:\s*center/.test(t.render({ template: "x", skin: t.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] }, demo, "mock")),
  );
  if (!centred.length) throw new Error("nincs középre rendezett fejlécű sablon — a mérés tárgytalan");

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const findings: Finding[] = [];
  try {
    for (const [id, tpl] of centred) {
      const recipe: Recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] };
      let html = renderSite(recipe, demo, { phase: "mock" });
      // RED control: strip exactly the rules under test and the guard MUST fail.
      if (red) html = html.replace(centredModsecCss(id), "");
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        findings.push(...(await measure(page)).map((f) => ({ ...f, template: id, width })));
        await ctx.close();
      }
      console.log(`  ${id.padEnd(12)} ${WIDTHS.join("/")}px megmérve`);
    }
  } finally {
    await browser.close();
  }

  for (const f of findings) {
    console.log(`  ❌ ${f.template} @${f.width}px · ${f.module} · ${f.block} · ${f.which} bal:${f.left} jobb:${f.right}`);
  }
  if (red) {
    if (!findings.length) {
      console.error("\n❌ RED-kontroll: a szabályok NÉLKÜL is átment — az őr nem mér semmit.");
      process.exit(1);
    }
    console.log(`\n✅ RED-kontroll: a szabályok nélkül ${findings.length} eltolódást fog az őr.`);
    return;
  }
  if (findings.length) {
    console.error(`\n❌ modsec-align-check: ${findings.length} elcsúszott blokk középre rendezett fejléc alatt.`);
    process.exit(1);
  }
  console.log(`\n✅ modsec-align-check: ${centred.length} középre rendezett sablon — a tartalom is középen.`);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
