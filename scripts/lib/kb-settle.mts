// Pre-capture SETTLE for every KB screenshot generator (kb-shot, partner-kb-shot) —
// ADR-0220: the guide-image freshness gate compares a fresh capture with the committed
// one pixel by pixel, which is only honest if the same commit always yields the same
// image. One implementation, so the two generators cannot drift apart.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "playwright-core";

// ── Web fonts from a committed SNAPSHOT, never the network (ADR-0220) ─────────────
// Measured 2026-09-24: with live Google Fonts, two captures of the same commit differed
// on 26 admin images (glyph edges) — the image was a function of the CDN. The snapshot
// is refreshed only deliberately: `npx tsx scripts/kb-shot-fonts.mts --refresh`.
export const FONT_DIR = path.resolve(import.meta.dirname, "kb-shot-fonts");
/** Every font stylesheet a shot page may request — exactly as the views link it. */
export const FONT_CSS_URLS: readonly string[] = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap",
];
/** Snapshot file of one font URL (stylesheet or woff2). */
export function fontFileFor(url: string): string {
  const u = new URL(url);
  const name = `${u.hostname}${u.pathname}${u.search}`.replace(/[^A-Za-z0-9.]+/g, "_");
  return path.join(FONT_DIR, name.endsWith(".woff2") ? name : `${name}.css`);
}

/**
 * Route every request of `page` that leaves the machine: Google Fonts are answered from
 * the snapshot, ANYTHING else external is aborted. Returns the list of misses — the
 * caller must fail on a non-empty list (a missing font silently falls back to a system
 * font, which is exactly the drift this exists to stop).
 */
export async function pinNetwork(page: Page): Promise<string[]> {
  const misses: string[] = [];
  await page.route(/^https?:\/\//, async (route) => {
    const url = route.request().url();
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") return route.continue();
    if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com") {
      const file = fontFileFor(url);
      if (existsSync(file)) {
        return route.fulfill({
          status: 200,
          contentType: file.endsWith(".woff2") ? "font/woff2" : "text/css; charset=utf-8",
          headers: { "access-control-allow-origin": "*" },
          body: readFileSync(file),
        });
      }
    }
    misses.push(url);
    return route.abort();
  });
  return misses;
}

// Motion off for the shot only — a guide image is a still anyway. The caret blinks too.
export const FREEZE_CSS =
  "*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}";

/**
 * A felvétel előtti BEÁLLÁS — minden kép ezen megy át (a `snap()` hívja), hogy ugyanaz a
 * commit futásról futásra ugyanazt a képet adja (ADR-0220). Sorrendben:
 *  1. animáció/átmenet ki (egy félúton lévő átmenet a capture pillanatától függ);
 *  2. betűtípusok + képek bevárva (a késve érkező betű átrendezi a sorokat — ez tolta el
 *     1–2 px-szel az outreach-draft felső sávját);
 *  3. görgetés EXPLICIT: viewport-képnél a horgonyra (ha van), különben a lap tetejére —
 *     a korábbi, betűtípus ELŐTTI horgony-görgetés az azóta átrendezett lapon rossz helyen áll;
 *     a konzol lead-lapja `hashchange`-re a saját (ragadó sávokat kerülő) görgetését futtatja;
 *  4. a RAGADÓ elemek a természetes helyükre (static) — elem-képnél mind (lent), viewport-
 *     képnél csak a nem elmozdultak (a settle() törzsében); az elem-capture görget, és
 *     a ragadó sáv a görgetés pillanatától függően hol a tartalomra festődött, hol nem (a
 *     source-panel.png-n a fülsor alatti mondat — mérve 7 623 px). A static a folyásban
 *     ugyanakkora helyet foglal, mint a sticky, tehát az elrendezés NEM változik;
 *  5. két képkocka, hogy a fenti változások (és az IntersectionObserver-visszahívások)
 *     lefessenek.
 * ⚠️ Szöveges `evaluate`: a tsx-átírt függvény-törzs `__name` segédet hivatkozhat, ami a
 * böngészőben nem létezik.
 */
export async function settle(page: Page, target: Page | Locator): Promise<void> {
  const isElement = target !== page;
  await page.addStyleTag({ content: FREEZE_CSS });
  // ⛔ A beállás NEM várhat örökké: egy soha fel nem oldó ígéret (lazy kép, beragadt betű)
  // némán megakasztotta a teljes futást. Időkorlát → HANGOS bukás, a lap URL-jével.
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`kb-shot settle(): 15 s alatt sem állt be a lap (${page.url()})`)),
      15_000,
    );
  });
  const work = page.evaluate(`(async () => {
    await document.fonts.ready;
    // ⚠️ A lazy kép a látómezőn kívül SOSEM töltődik be, és a decode()-ja sosem old fel
    // (mérve: a Modulok › Szobák felvétele örökre várt) — eager-re kapcsoljuk, így az
    // elem-felvétel akkor is kész képet lő, ha a görgetés csak a capture-kor jön.
    for (const i of Array.from(document.images)) if (i.loading === "lazy") i.loading = "eager";
    await Promise.all(Array.from(document.images).map((i) =>
      i.complete ? null : i.decode().catch(() => null)));
    const stickies = Array.from(document.querySelectorAll("*"))
      .filter((el) => getComputedStyle(el).position === "sticky");
    if (${isElement}) {
      for (const el of stickies) el.style.setProperty("position", "static", "important");
    } else {
      const id = decodeURIComponent(location.hash.replace(/^#/, ""));
      const anchor = id ? document.getElementById(id) : null;
      if (anchor) {
        anchor.scrollIntoView({ block: "start", behavior: "instant" });
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      // A viewport-képen a természetes helyén álló ragadó elem is static lesz: ott a kettő
      // pixelre ugyanaz, de a sticky réteg kompozitálása futásonként eltért (mérve: a
      // lead-lista táblázat-fejlécének alsó vonala hol teljes, hol csonka — 892 px).
      // Ami ténylegesen TAPAD (a helye elmozdul a static-tól, pl. alsó sáv), az marad:
      // a tulaj pont így látja a lapot.
      for (const el of stickies) {
        const before = el.getBoundingClientRect();
        el.style.setProperty("position", "static", "important");
        const after = el.getBoundingClientRect();
        if (Math.abs(before.top - after.top) > 0.5 || Math.abs(before.left - after.left) > 0.5) {
          el.style.removeProperty("position");
        }
      }
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  })()`);
  try {
    await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
