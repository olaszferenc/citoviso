/**
 * Kapu — a süti-sáv és a generált oldal SAJÁT ragadó sávja nem takarhatja egymást
 * (ADR-0186 utószál).
 *
 * ⛔ KIVÁLTÓ, MÉRVE. Amikor az ajánlat/konfigurátor lap megkapta a Pixelt (és vele a
 * süti-sávot), a sáv ráült a sablon saját ragadó foglalás-sávjára: a két felirat
 * egymáson állt, olvashatatlanul. A gomb KATTINTHATÓ volt (az `elementFromPoint`
 * „elérhető"-t mondott), tehát egy kattintás-alapú ellenőrzés ZÖLDEN engedte volna át
 * — a hibát csak a KÉP, illetve a geometria mutatja meg.
 *
 * Amit mér, sablononként, telefon- és asztali szélességen:
 *  ① a sablon ragadó sávja NEM lóg bele a süti-sáv területébe (téglalap-metszet = 0);
 *  ② a süti-sáv a lap legalsó eleme marad (a döntés helye nem vándorol el);
 *  ③ az „Elfogadom" tényleg a felhasználó kezébe esik (`elementFromPoint`).
 *
 * ⚠️ A `--citui-consent-h` a sáv MÉRT magassága, amit a futtató publikál. Ezért az őr
 * a VALÓDI sávval mér, nem egy feltételezett értékkel.
 *
 * Futtatás: npx tsx scripts/consent-sticky-overlap-check.mts [--self-test]
 */
import { chromium, type Page } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sessionTmpDir } from "./lib/session-tmp.mts";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { consentSnippet } from "../src/server/consent.js";

const SELF_TEST = process.argv.includes("--self-test");
const PAGE_URL = "https://citoviso-fixture.test/p/teszt-token";
// Session-private fixture: /tmp is shared by every worktree, a FIXED path raced siblings.
const FIXTURE = path.join(sessionTmpDir("consent-overlap"), "fixture.html");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) return void console.log(`✓ ${what}`);
  failed++;
  console.error(`✗ BUKÁS  ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince", "Wellness"],
  photos: [{ url: "https://picsum.photos/seed/x/1600/1000", alt: "A hotel", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
  rooms: [{ name: "Superior", capacity: "2 fő", note: "Városra néző.", price: "42 000 Ft / éj" }],
  reviews: [{ quote: "Kedves, tiszta.", author: "Andrea", meta: "Budapest" }],
  place: { city: "Példaváros", country: "HU" },
};
const sections: Recipe["sections"] = (
  ["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const
).map((kind) => ({ kind }));

/** A sablonok, amelyeknek VAN ragadó alsó sávjuk — a többin nincs mit ütköztetni. */
function stickyTemplates(): string[] {
  return Object.keys(TEMPLATES).filter((id) => {
    const css = renderSite(
      { template: id, skin: TEMPLATES[id]!.skins[0] ?? "editorial-warm", archetype: "stacked", sections },
      demo,
    );
    return /position:fixed[^}]*bottom:var\(--citui-consent-h|bottom:var\(--citui-consent-h[^}]*position:fixed/.test(css);
  });
}

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

async function measure(page: Page, id: string, width: number): Promise<void> {
  const tpl = TEMPLATES[id]!;
  let html = renderSite(
    { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections },
    demo,
  );
  if (SELF_TEST) {
    // 🔴 A VISSZARONTOTT ÁLLAPOT: a sáv magasságát nem tartja fenn senki.
    html = html.replace(/bottom:var\(--citui-consent-h,0px\)/g, "bottom:0");
  }
  const snippet = consentSnippet();
  html = html.replace("</body>", `${snippet.head}${snippet.body}</body>`);
  writeFileSync(FIXTURE, html, "utf8");
  await page.setViewportSize({ width, height: 844 });
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  // ⚠️ A böngészőbe adott függvényben NINCS elnevezett segéd-függvény: a tsx
  // fordítója `__name(...)` hívást szúr be melléjük, ami a lapon nem létezik
  // (mérve: ReferenceError). Minden számítás soron belül.
  const r = await page.evaluate(() => {
    const bar = document.getElementById("cit-consent");
    if (!bar) return { bar: null as Box | null, sticky: null as Box | null, hit: "nincs sáv" };
    const bb = bar.getBoundingClientRect();
    // A gazdalap MINDEN fixed, alulra tapadó eleme — nem osztálynévre illesztünk,
    // mert a 19 sablon 19 nevet használ (egy szabály, nem tizenkilenc másolat).
    let sticky: Box | null = null;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.id === "cit-consent" || el.closest("#cit-consent")) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
      const b = el.getBoundingClientRect();
      // ⛔ SÁVOT keresünk, nem bármilyen fixed elemet: az aurora sablon teljes
      // képernyős háttér-rétege (magasság 1182 px) különben „ragadó sávnak"
      // számított volna, és az őr a saját téves felismerését jelentette hibának.
      if (b.height < 8 || b.height > 220 || b.width < 40) continue;
      // ⛔ NEM követeljük meg, hogy a lap aljához TAPADJON: a javítás értelme épp az,
      // hogy a sablon sávja a süti-sáv MAGASSÁGÁVAL feljebb csúszik. Az első
      // változatom ezt írta elő, ezért 28 mérésből 0 talált bármit is — üres halmazon
      // mért, és zölden hallgatott.
      if (b.top < window.innerHeight * 0.3) continue; // a képernyő alsó harmadában ül
      if (b.bottom < window.innerHeight * 0.5) continue;
      if (!sticky || b.bottom > sticky.bottom) {
        sticky = { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
      }
    }
    const btn = document.querySelector('#cit-consent button[data-c="all"]') as HTMLElement | null;
    let hit = "nincs gomb";
    if (btn) {
      const r2 = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
      hit = top === btn || btn.contains(top) ? "ok" : `takarva: ${(top as HTMLElement)?.className || top?.tagName}`;
    }
    return {
      bar: { top: bb.top, bottom: bb.bottom, left: bb.left, right: bb.right } as Box,
      sticky,
      hit,
    };
  });

  const label = `${id} @${width}px`;
  if (!r.bar) return say(false, `${label}: megjelenik a süti-sáv`, "nincs #cit-consent");
  say(r.hit === "ok", `${label}: az „Elfogadom" a felhasználó kezébe esik`, r.hit);
  if (!r.sticky) return void console.log(`  · ${label}: ezen a szélességen nincs látható ragadó sáv`);
  const overlap = Math.min(r.bar.bottom, r.sticky.bottom) - Math.max(r.bar.top, r.sticky.top);
  // Fél pixel tűrés: az érintkezés (a sáv közvetlenül a másik alatt) NEM átfedés,
  // a törtpixeles elrendezés viszont könnyen ad 0,3 px-et.
  say(
    overlap <= 0.5,
    `${label}: a sablon ragadó sávja NEM lóg a süti-sávba`,
    `átfedés ${Math.round(overlap)}px (sáv ${Math.round(r.bar.top)}–${Math.round(r.bar.bottom)}, sablon ${Math.round(r.sticky.top)}–${Math.round(r.sticky.bottom)})`,
  );
  say(
    r.bar.bottom >= r.sticky.bottom - 1,
    `${label}: a döntés helye marad a legalsó elem`,
    `sáv alja ${Math.round(r.bar.bottom)} < sablon alja ${Math.round(r.sticky.bottom)}`,
  );
}

const ids = stickyTemplates();
if (!ids.length) {
  console.error("⛔ Egyetlen sablon sem tartja fenn a sáv helyét — a mérés tárgya hiányzik.");
  process.exit(1);
}
console.log(`ℹ️  ${ids.length} sablonnak van ragadó alsó sávja — mindegyiket mérjük.`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(PAGE_URL, (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: readFileSync(FIXTURE, "utf8") }),
);
// A sáv futtatója és stíluslapja LEMEZRŐL — ugyanaz a fájl, amit a szerver hivatkoz
// (a snippet URL-je relatív, tehát a fixture eredetén kérődik le).
await page.route("**/assets/runtime/cit-consent.js*", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: readFileSync("public/assets/runtime/cit-consent.js", "utf8"),
  }),
);
await page.route("**/assets/runtime/cit-consent.css*", (route) =>
  route.fulfill({
    status: 200,
    contentType: "text/css",
    body: readFileSync("public/assets/runtime/cit-consent.css", "utf8"),
  }),
);
// A Pixel maga NEM tárgya ennek a mérésnek (azt a barion-pixel-check méri); a sáv
// viszont csak érvényes azonosítóval jelenik meg, ezért a szkriptet elnyeljük.
await page.route((u) => u.hostname === "pixel.barion.com", (route) =>
  route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
);
await page.route("**/picsum.photos/**", (route) =>
  route.fulfill({ status: 200, contentType: "image/gif", body: "" }),
);

for (const id of ids) {
  for (const width of [390, 1280]) await measure(page, id, width);
}
await browser.close();

if (SELF_TEST) {
  console.log(
    `\n🔴 ÖNTESZT: a helyfenntartást visszarontva ${failed} állítás bukott.\n` +
      "   (Ha ez 0, az őr nem mér semmit — az átfedésnek meg KELL jelennie.)",
  );
  process.exit(failed > 0 ? 0 : 1);
}
if (failed) {
  console.error(`\n⛔ ${failed} mérés bukott — a hozzájárulás-kérdés és a foglalás-sáv egymáson áll.`);
  process.exit(1);
}
console.log("\n✅ consent-sticky-overlap-check: a két ragadó sáv elfér egymás mellett.");
