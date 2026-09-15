// ÜRES TAGLINE-KAPU — „ha nincs alcím, ne maradjon üres doboz a lapon".
//
// A LYUK: a hero-alcím (`SiteData.tagline`) AI-szöveg hiányában a régió taglinejéből jön
// (`siteData.ts`), és besorolatlan gyűjtési területnél az ÜRES (`getRegionContext()` a
// nem bejegyzett id-re `tagline: ""`-t ad — ADR-0163). Egy sablon, ami a taglinet ŐRIZETLEN
// elembe teszi, ilyenkor üres `<p>`/`<h2>`-t renderel: a vevő egy megmagyarázhatatlan
// hézagot lát. A §2b üres-sáv tilalom pontosan ez.
//
// ⛔ MIÉRT ATTRIBÚCIÓS A MÉRÉS, ÉS NEM FORRÁS-GREP: a `data.tagline` előfordulásait
// grepelve 12 „őrizetlen" találatot kaptam, amiből több VALÓJÁBAN őrzött ternáriusban ül —
// a forrás-minta nem mondja meg, mi lesz a RENDERELT lapon (ez a szál visszatérő tanulsága:
// mérd a kimenetet, ne a mintát). Ezért minden sablon KÉTSZER renderelődik:
//   ① egyedi JELSZÓVAL a taglineben → megtudjuk, MELYIK elemek élnek a taglineból;
//   ② ÜRES taglinevel → ugyanazokat az elemeket megkeressük, és megnézzük, maradt-e
//      közülük olyan, aminek VAN doboza, de nincs benne szöveg.
// Így a lelet önmagát attribuálja: nem „valahol üres egy elem", hanem „EZ az elem a
// taglineból élt, és most üresen áll".
//
//   npx tsx scripts/empty-tagline-check.mts             # zöld futás
//   npx tsx scripts/empty-tagline-check.mts --self-test # PIROS kontroll
//   npx tsx scripts/empty-tagline-check.mts --report    # csak mérés, verdikt nélkül

import { chromium } from "playwright-core";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");
const REPORT = process.argv.includes("--report");

const SENTINEL = "ZZQTAGLINEZZQ";

const PHOTO = (alt: string) => ({
  url:
    "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%228%22%20height=%228%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23b9b2a4%22/%3E%3C/svg%3E",
  alt,
  provenance: "portal" as const,
});

/** A lead, aminek VAN mindene, csak alcíme nincs — így a hézag egyértelműen a taglineé. */
function data(tagline: string): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline,
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban", "Kutyabarát szállás"],
    photos: [PHOTO("kert"), PHOTO("szoba"), PHOTO("terasz"), PHOTO("udvar"), PHOTO("konyha")],
    rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    usp: ["Öt perc sétára a strandtól"],
    googleRating: { value: 4.8, count: 61, url: "https://example.com/reviews" },
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}

const recipe = (t: string): Recipe => ({
  template: t,
  skin: "",
  archetype: "",
  sections: [],
});

const fails: string[] = [];
const oks: string[] = [];
const check = (cond: boolean, m: string) => (cond ? oks.push(m) : fails.push(m));

const browser = await chromium.launch();
const ids = Object.keys(TEMPLATES);
type Hole = { tpl: string; tag: string; cls: string; w: number; h: number };
const holes: Hole[] = [];
let consumerTotal = 0;

try {
  for (const t of ids) {
    // ① JELSZÓS futás — kik a tagline fogyasztói ezen a sablonon?
    const withText = renderSite(recipe(t), data(SENTINEL), { phase: "mock" });
    // ② ÜRES futás — ugyanaz a lap, alcím nélkül.
    const withEmpty = SELF_TEST
      ? // ⛔ PIROS KONTROLL: visszarontunk EGY őrizetlen elemet — pontosan azt a hibát,
        // amit a kapu tilt (egy üres bekezdés a tagline helyén). Így bizonyítjuk, hogy a
        // mérés képes pirosra menni ezen a lapon is.
        renderSite(recipe(t), data(""), { phase: "mock" }).replace(
          "</body>",
          `<p class="cit-selftest-empty" style="min-height:24px;display:block"></p></body>`,
        )
      : renderSite(recipe(t), data(""), { phase: "mock" });

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      // A JELSZÓT tartalmazó elemek „ujjlenyomata": tag + class + a szülő tag+class.
      // (Selector-út helyett ez stabil a két futás között, és olvasható a leletben.)
      await page.setContent(withText, { waitUntil: "domcontentloaded" });
      const consumers = await page.evaluate((s) => {
        const out: { tag: string; cls: string; parent: string }[] = [];
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          // Csak az a LEGBELSŐ elem érdekes, ami a jelszót közvetlenül hordozza.
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent ?? "")
            .join("");
          if (own.includes(s)) {
            out.push({
              tag: el.tagName.toLowerCase(),
              cls: el.className || "",
              parent: el.parentElement
                ? `${el.parentElement.tagName.toLowerCase()}.${el.parentElement.className || ""}`
                : "",
            });
          }
        }
        return out;
      }, SENTINEL);
      consumerTotal += consumers.length;

      // Ugyanezek az ujjlenyomatok az ÜRES futáson: van doboz, de nincs szöveg?
      await page.setContent(withEmpty, { waitUntil: "domcontentloaded" });
      const empties = await page.evaluate((fps) => {
        const out: { tag: string; cls: string; w: number; h: number }[] = [];
        const seen = new Set<Element>();
        for (const fp of fps) {
          for (const el of Array.from(document.querySelectorAll(`${fp.tag}`))) {
            if (seen.has(el)) continue;
            if ((el.className || "") !== fp.cls) continue;
            const par = el.parentElement
              ? `${el.parentElement.tagName.toLowerCase()}.${el.parentElement.className || ""}`
              : "";
            if (par !== fp.parent) continue;
            seen.add(el);
            const txt = (el.textContent ?? "").replace(/\s+/g, "");
            if (txt.length > 0) continue; // kapott más tartalmat — nem hézag
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue; // nem renderel
            const r = el.getBoundingClientRect();
            // ⛔ A MARGÓ IS HELY. Egy üres `<p>` DOBOZA 0 magas, a margója viszont
            // szétnyomja a tartalmat — az első predikátumom (`height >= 1`) ezért
            // MINDEN sablont zöldnek mondott, pedig épp ezt a hézagot keressük.
            // A „mennyi helyet foglal, miközben semmit nem mutat" a doboz + a margók.
            const space =
              r.height + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
            if (space >= 4) {
              out.push({
                tag: el.tagName.toLowerCase(),
                cls: el.className || "",
                w: Math.round(r.width),
                h: Math.round(space),
              });
            }
          }
        }
        return out;
      }, consumers);

      // Az önteszt beszúrt eleme is számít — ő a piros kontroll.
      if (SELF_TEST) {
        const st = await page.evaluate(() => {
          const el = document.querySelector(".cit-selftest-empty");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { tag: "p", cls: "cit-selftest-empty", w: Math.round(r.width), h: Math.round(r.height) };
        });
        if (st && st.h >= 1) empties.push(st);
      }

      for (const e of empties) holes.push({ tpl: t, ...e });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

// ── Bizonyítsd, hogy a mérés nem üres ────────────────────────────────────────
check(
  ids.length >= 15,
  `mind a ${ids.length} sablon megmérve (jelszós + üres futás, 1280px)`,
);
check(
  consumerTotal > 0,
  `a tagline TÉNYLEG megjelenik a lapokon (${consumerTotal} fogyasztó elem összesen) — enélkül a kapu üresen lenne zöld`,
);

// ── A verdikt ───────────────────────────────────────────────────────────────
const byTpl = new Map<string, Hole[]>();
for (const h of holes) byTpl.set(h.tpl, [...(byTpl.get(h.tpl) ?? []), h]);

if (REPORT) {
  console.log(`\nTAGLINE-FOGYASZTÓK: ${consumerTotal} elem ${ids.length} sablonon`);
  console.log(`ÜRES HÉZAG: ${holes.length} elem ${byTpl.size} sablonon\n`);
  for (const [tpl, hs] of [...byTpl].sort()) {
    console.log(`  ${tpl}:`);
    for (const h of hs) console.log(`    <${h.tag} class="${h.cls}"> — ${h.w}×${h.h}px, üres`);
  }
  process.exit(0);
}

check(
  holes.length === 0,
  `alcím NÉLKÜL egyetlen sablon sem hagy üres, mégis helyet foglaló elemet a tagline helyén (sértő: ${holes.length}${
    holes.length ? ` — ${[...byTpl].map(([t, hs]) => `${t}:${hs.length}`).join(" · ")}` : ""
  })`,
);

for (const o of oks) console.log(`  ✓ ${o}`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (holes.length) {
  console.log("\n  A hézagok:");
  for (const [tpl, hs] of [...byTpl].sort()) {
    for (const h of hs) console.log(`    ${tpl}: <${h.tag} class="${h.cls}"> ${h.w}×${h.h}px`);
  }
}
console.log(
  `\nempty-tagline-check: ${oks.length} pass / ${fails.length} fail${SELF_TEST ? " (ÖNTESZT: a pirosnak KELL buknia)" : ""}`,
);

if (SELF_TEST) {
  if (fails.length === 0) {
    console.error("\n⛔ ÖNTESZT-BUKÁS: a beszúrt üres bekezdésre az őr ZÖLDET adott — nem méri, amit állít.");
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT RENDBEN: ${fails.length} állításon pirosra ment.`);
  process.exit(0);
}

if (fails.length) process.exit(1);
console.log("✅ alcím nélkül sem marad üres doboz a tagline helyén");
