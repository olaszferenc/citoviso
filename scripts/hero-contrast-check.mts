// Hero readability gate (contract: assets/design-refs/engine/hero-contrast).
//
// The hero headline's accent (`h1 em`) is often a LIGHT color-mix of the accent;
// on a BRIGHT hero photo it can vanish (Rozé Fogadó: measured 1.08:1). This gate
// MEASURES, it does not guess: every art template is rendered with a worst-case
// BRIGHT hero photo, then the REAL rendered contrast of the hero headline text is
// measured against the pixels actually behind it (photo + scrim composited). A
// template whose hero text drops below WCAG AA-large (3.0:1) fails — the fix is a
// stronger hero scrim (owner-approved variant B), never a guessed color.
//
// Run: npx tsx scripts/hero-contrast-check.mts
import { chromium } from "playwright-core";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { relativeLuminance, contrastRatio, parseHex } from "../src/engine/palette.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

// Worst-case BRIGHT hero photo: a near-white fill (any real photo is darker, so a
// template that passes here passes on any photo). SVG data URI → background-size:cover.
// NB: no literal quotes inside (the template wraps this in url('...') with single
// quotes) — the SVG attribute quotes are %22-encoded so they can't close the url().
const BRIGHT =
  "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23efeae0%22/%3E%3C/svg%3E";

const PHOTO = (alt: string) => ({ url: BRIGHT, alt, provenance: "portal" as const });
const DATA: SiteData = {
  name: "Rozé Fogadó",
  tagline: "Üvegezett teraszos kávézó, kerékpárok és a víz csábítása egy helyen",
  intro: "Fogadó a Balaton-felvidék szívében, ahol a nap a szőlő fölött nyugszik le.",
  highlights: ["Üvegezett teraszos kávézó", "Kerékpáros pihenő"],
  photos: [PHOTO("terasz"), PHOTO("kert"), PHOTO("szoba"), PHOTO("udvar"), PHOTO("konyha")],
  rooms: [{ name: "Napszoba", capacity: "2 fő", price: "22 000 Ft / éj" }],
  usp: ["Kétperces séta a mólóig"],
  googleRating: { value: 4.9, count: 143, url: "https://example.com/reviews" },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
} as SiteData;

const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

const THRESHOLD = 3.0; // WCAG AA for large text (the hero headline is large)

function parseCssColor(s: string): [number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return parseHex(s);
}

const browser = await chromium.launch();
const ids = Object.keys(TEMPLATES);
const rows: { id: string; ratio: number | null; fg: string; note: string }[] = [];

for (const t of ids) {
  const html = renderSite(recipe(t), DATA, { phase: "mock" });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForTimeout(120);
    // The hero is the first screen; its accent text is the first h1's <em> (or the h1
    // itself if it has no em). Restrict to the top of the page so section headings later
    // on the page are never picked up.
    const target = await page.evaluateHandle(() => {
      const h1s = Array.from(document.querySelectorAll("h1"));
      const hero = h1s.find((h) => h.getBoundingClientRect().top < 700) || h1s[0];
      if (!hero) return null;
      const em = hero.querySelector("em");
      return em || hero;
    });
    const el = target.asElement();
    if (!el) {
      rows.push({ id: t, ratio: null, fg: "—", note: "nincs hero h1" });
      await page.close();
      continue;
    }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(60);
    const box = await el.boundingBox();
    // Only text-on-PHOTO heroes are in scope for the scrim fix (the owner-approved
    // contract). A headline over a solid token background (e.g. brutalism's split
    // hero — photo on the far side, text on --cit-bg) has no scrim and is a separate
    // skin-accent concern; skip it here so this gate measures only what it fixes.
    const overPhoto = await el.evaluate((n) => {
      const r = (n as Element).getBoundingClientRect();
      return Array.from(document.querySelectorAll("*")).some((e) => {
        const bi = getComputedStyle(e).backgroundImage;
        const isPhoto = e.tagName === "IMG" || (!!bi && bi.includes("url("));
        if (!isPhoto) return false;
        const rr = e.getBoundingClientRect();
        return !(rr.right < r.left || rr.left > r.right || rr.bottom < r.top || rr.top > r.bottom);
      });
    });
    if (!overPhoto) {
      rows.push({ id: t, ratio: null, fg: "—", note: "nem fotó-overlay hero (külön elbírálás)" });
      await page.close();
      continue;
    }
    const fgStr = await el.evaluate((n) => getComputedStyle(n as Element).color);
    const fg = parseCssColor(fgStr);
    if (!box || box.width < 2 || box.height < 2) {
      rows.push({ id: t, ratio: null, fg: fgStr, note: "nem mérhető doboz" });
      await page.close();
      continue;
    }
    // gradient-clipped text (color:transparent) — measured elsewhere; note and skip
    if (!fg || /transparent|rgba\([^)]*,\s*0\s*\)/i.test(fgStr)) {
      rows.push({ id: t, ratio: null, fg: fgStr, note: "gradiens szövegkitöltés (külön elbírálás)" });
      await page.close();
      continue;
    }
    // measure the background actually behind the text: hide the headline, screenshot
    // its box (photo + scrim composited), average the pixels.
    const h1 = await el.evaluateHandle((n) => {
      let p: Element | null = n as Element;
      while (p && p.tagName !== "H1") p = p.parentElement;
      return p || (n as Element);
    });
    await h1.asElement()!.evaluate((n) => ((n as HTMLElement).style.visibility = "hidden"));
    const vp = page.viewportSize() || { width: 1200, height: 900 };
    const x = Math.min(Math.max(0, box.x), vp.width - 2);
    const y = Math.min(Math.max(0, box.y), vp.height - 2);
    const clip = {
      x,
      y,
      width: Math.max(2, Math.min(box.width, vp.width - x)),
      height: Math.max(2, Math.min(box.height, vp.height - y)),
    };
    const shot = await page.screenshot({ clip });
    await h1.asElement()!.evaluate((n) => ((n as HTMLElement).style.visibility = ""));
    const bg = (await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]!;
        g += d[i + 1]!;
        b += d[i + 2]!;
        n++;
      }
      return [r / n, g / n, b / n];
    }, `data:image/png;base64,${shot.toString("base64")}`)) as [number, number, number];
    const ratio = contrastRatio(fg, bg);
    rows.push({
      id: t,
      ratio,
      fg: fgStr,
      note: `bg≈rgb(${bg.map((v) => Math.round(v)).join(",")}) lum=${relativeLuminance(bg).toFixed(2)}`,
    });
  } finally {
    await page.close();
  }
}
await browser.close();

let fail = 0;
console.log(`\nHero-cím kontraszt (worst-case világos fotó, küszöb ${THRESHOLD}:1 AA-nagybetű):\n`);
for (const r of rows.sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99))) {
  const val = r.ratio === null ? "  —  " : `${r.ratio.toFixed(2)}:1`;
  const mark = r.ratio === null ? "…" : r.ratio >= THRESHOLD ? "✓" : "✗";
  if (r.ratio !== null && r.ratio < THRESHOLD) fail++;
  console.log(`  ${mark} ${val.padStart(7)}  ${r.id.padEnd(14)} ${r.ratio === null ? r.note : ""}`);
}
console.log("");
if (fail) {
  console.error(`⛔ hero-contrast-check: ${fail} sablon hero-címe olvashatatlan világos fotón (< ${THRESHOLD}:1).`);
  process.exit(1);
} else {
  console.log("✅ hero-contrast-check: minden sablon hero-címe olvasható a worst-case világos fotón is.");
}
