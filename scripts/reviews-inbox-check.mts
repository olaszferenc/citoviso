// ⛔⛔ A VENDÉGVÉLEMÉNY-KEZELŐ NEM HAZUDHAT A CSILLAGRÓL — az őr.
//
// A LELET (mérve 2026-09-23). A tenant-admin vélemény-listája (reviewsEditor) a teli és
// az üres csillagot UGYANAZZAL a „★" jellel írta, és csak egy SOSEM MEGÍRT szín tette
// volna különbözővé: egy 1 csillagos vélemény ★★★★★-nak látszott, és a tulaj ezzel a
// képpel döntött a kitételről. A `rev-*` osztályokhoz egyetlen CSS-szabály sem készült,
// így a név, a csillag és az állapot egy sorba folyt, a gombsor a következő kártyához
// tapadt; a Google-kártya pedig „Ez látszik most az oldalán”-t mondott akkor is, amikor
// a tulaj kikapcsolta, és a szám LEKERÜLT a lapról (src/tenant/editor.ts).
//
// A döntés (tulaj, 2026-09-23, jóváhagyott B terv — assets/design-refs/console/reviews-inbox/):
// állapot szerint csoportosított lista, ★/☆ + kiírt „N/5", a Google-mondat a kapcsolót
// tükrözi.
//
// Amit állít — a szerkesztő VALÓDI kimenetén (moduleSettingsSection), böngészőben, a
// valódi stíluslapokkal, 390 és 1280 px-en:
//   ① a csillagszám a lapról KIOLVASHATÓ és egyezik a `rating`-gel: a kiírt „N/5", a teli
//      jelek száma, az üres jelek száma — és az 1★ sor NEM olvasható ugyanúgy, mint az 5★;
//   ② minden sor a saját állapota csoportjában áll, és a „Döntésre vár" az első;
//   ③ a sorok nem folynak egybe: a név, a csillag és a gombok nem fedik egymást, a gombsor
//      a SAJÁT során belül marad, két sor között látható elválasztó van;
//   ④ semmi nem lóg ki a kártyából, nincs vízszintes lapgörgetés;
//   ⑤ a Google-mondat a kapcsolóhoz igazodik (BE: „látszik most", KI: „nem látszik");
//   ⑥ a visszajelző sor MEGNEVEZI, kinek a véleményéről döntött.
//
// Az i18n-részt (minden felirat T()-n át) az i18n-pseudo-check méri — a `reviews` képernyő
// ott is fel van véve (azelőtt nem volt, ezért ment át a „Kiteszem").
//
//   npx tsx scripts/reviews-inbox-check.mts

import { readFileSync } from "node:fs";

import { MODCFG_STYLE, moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// One review in every state, both extremes of the scale, a long body and a row with no
// meta at all — the shapes that broke the old list.
const ITEMS = [
  { id: "r1", authorName: "Kovács Anna", rating: 5, body: "Csendes, tiszta, a reggeli házi lekvár külön élmény.",
    stayMonth: "2026-08", unitName: "Kertre néző apartman", status: "pending", verified: false, token: "t1" },
  { id: "r2", authorName: "Szabó Márta", rating: 2, stayMonth: "2026-08", unitName: null, status: "pending", verified: false, token: "t2",
    body: "A szoba szép volt és a kert is gondozott, de a zuhany vize csak langyos lett, és a második este a szomszéd apartmanból késő éjjelig áthallatszott a zene. Szóltunk a tulajdonosnak, aki kedves volt, de másnap sem változott semmi." },
  { id: "r3", authorName: "Nagy Péter", rating: 4, body: "Kedves fogadtatás, jó elhelyezkedés.",
    stayMonth: "2026-07", unitName: "Padlásszoba", status: "published", verified: false, token: "t3" },
  { id: "r4", authorName: "Teszt Elek", rating: 1, body: "asdasd", stayMonth: null, unitName: null, status: "rejected", verified: false, token: "t4" },
];

function render(showGoogleRating: boolean): string {
  return moduleSettingsSection("reviews", {
    values: { ...effectiveModuleConfig("reviews", null, null), showGoogleRating },
    priceMonthly: 690,
    reviews: {
      items: ITEMS,
      google: { value: 4.8, count: 37, url: "https://www.google.com/maps" },
      done: { id: "r3", verdict: "withdrawn" },
    },
  } as Parameters<typeof moduleSettingsSection>[1]);
}

const css =
  readFileSync("public/assets/ui/citui.css", "utf8") + readFileSync("public/assets/ui/citui-admin.css", "utf8");
const page = (body: string): string =>
  `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>${css}</style>${MODCFG_STYLE}</head><body><main class="adm-main"><div class="adm-main__inner">${body}</div></main></body></html>`;

type Row = {
  id: string; group: string | null; n: string; on: number; off: number; aria: string;
  who: DOMRectLike; stars: DOMRectLike; acts: DOMRectLike; text: DOMRectLike; row: DOMRectLike;
};
type DOMRectLike = { top: number; bottom: number; left: number; right: number };
type Measure = {
  rows: Row[]; groups: string[]; over: number; pageX: number; sepOk: boolean[];
  google: string; flash: string;
};

const { chromium } = await import("playwright-core");
const { config } = await import("../src/config.js");
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  for (const showGoogle of [true, false]) {
    const html = render(showGoogle);
    for (const vw of [390, 1280]) {
      const tag = `Google ${showGoogle ? "BE" : "KI"} @${vw}px`;
      console.log(tag);
      const p = await browser.newPage({ viewport: { width: vw, height: 900 } });
      await p.setContent(page(html));
      // String form: tsx would inject a __name helper into a nested function.
      const m = (await p.evaluate(`(() => {
        const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        const rows = [...document.querySelectorAll("[data-rv]")].map((r) => {
          const st = r.querySelector(".rv-stars");
          return {
            id: r.dataset.rv,
            group: r.closest("[data-rv-group]")?.dataset.rvGroup ?? null,
            n: st?.querySelector(".rv-stars__n")?.textContent ?? "",
            on: [...(st?.querySelector(".on")?.textContent ?? "")].filter((c) => c === "★").length,
            off: [...(st?.querySelector(".off")?.textContent ?? "")].filter((c) => c === "☆").length,
            aria: st?.getAttribute("aria-label") ?? "",
            who: box(r.querySelector(".rv-row__who strong")), stars: box(st),
            acts: box(r.querySelector(".rv-row__acts")), text: box(r.querySelector(".rv-row__text")), row: box(r),
          };
        });
        const card = document.querySelector(".rv-inbox").getBoundingClientRect();
        let over = -1e9;
        document.querySelectorAll(".rv-inbox *").forEach((e) => { const r = e.getBoundingClientRect(); if (r.width) over = Math.max(over, r.right - card.right); });
        // A visible separator between two consecutive rows of one group.
        const sepOk = [...document.querySelectorAll(".rv-row + .rv-row")].map((e) => parseFloat(getComputedStyle(e).borderTopWidth) >= 1);
        return {
          rows, over: Math.round(over), pageX: document.documentElement.scrollWidth - innerWidth, sepOk,
          groups: [...document.querySelectorAll("[data-rv-group]")].map((g) => g.dataset.rvGroup),
          google: document.querySelector("[data-rv-google]")?.textContent ?? "",
          flash: document.querySelector(".rv-flash")?.textContent ?? "",
        };
      })()`)) as Measure;

      // ① the star count is readable and true
      for (const it of ITEMS) {
        const r = m.rows.find((x) => x.id === it.id);
        check(`① ${it.authorName} (${it.rating}★): kiírva „${it.rating}/5”, ${it.rating} teli + ${5 - it.rating} üres jel`,
          !!r && r.n === `${it.rating}/5` && r.on === it.rating && r.off === 5 - it.rating, r && { n: r.n, on: r.on, off: r.off });
        check(`① ${it.authorName}: az akadálymentes név is a számot mondja`, !!r && r.aria.includes(String(it.rating)) && r.aria !== "", r?.aria);
      }
      const one = m.rows.find((x) => x.id === "r4"), five = m.rows.find((x) => x.id === "r1");
      check("① az 1★ sor NEM olvasható ugyanúgy, mint az 5★", !!one && !!five && one.n !== five.n && one.on !== five.on);

      // ② grouped by state, waiting first
      for (const it of ITEMS) {
        const r = m.rows.find((x) => x.id === it.id);
        check(`② ${it.authorName} a(z) „${it.status}” csoportban`, r?.group === it.status, r?.group);
      }
      check("② a „Döntésre vár” az első csoport", m.groups[0] === "pending", m.groups);

      // ③ nothing runs together
      const overlap = (a: DOMRectLike, b: DOMRectLike): boolean =>
        a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      for (const r of m.rows) {
        check(`③ ${r.id}: a név, a csillag és a gombsor nem fedi egymást`,
          !overlap(r.who, r.stars) && !overlap(r.who, r.acts) && !overlap(r.stars, r.acts) && !overlap(r.text, r.acts), r);
        check(`③ ${r.id}: a gombsor a saját során belül marad`, r.acts.bottom <= r.row.bottom + 0.5 && r.acts.top >= r.row.top - 0.5, { acts: r.acts, row: r.row });
      }
      for (let i = 1; i < m.rows.length; i++)
        check(`③ ${m.rows[i - 1]!.id} → ${m.rows[i]!.id}: nem csúsznak egymásba`, m.rows[i]!.row.top >= m.rows[i - 1]!.row.bottom - 0.5);
      check("③ két szomszédos sor között látható elválasztó", m.sepOk.length > 0 && m.sepOk.every(Boolean), m.sepOk);
      if (vw === 1280)
        check("③ asztalon a gombok a szöveg MELLETT (jobbra), nem alatta", m.rows.every((r) => r.acts.left >= r.text.right - 0.5), m.rows.map((r) => [r.text.right, r.acts.left]));

      // ④ no overflow
      check(`④ semmi nem lóg ki a kártyából (túllógás ${m.over}px)`, m.over <= 0, m.over);
      check("④ nincs vízszintes lapgörgetés", m.pageX <= 0, m.pageX);

      // ⑤ the Google sentence follows the toggle
      if (showGoogle)
        check("⑤ BE: „Ez látszik most az oldalán”, és nem állítja, hogy nem látszik",
          m.google.includes("Ez látszik most az oldalán") && !m.google.includes("nem látszik"), m.google.slice(0, 160));
      else
        check("⑤ KI: „nem látszik”, és NEM állítja, hogy most látszik",
          m.google.includes("nem látszik az oldalán") && !m.google.includes("Ez látszik most"), m.google.slice(0, 160));

      // ⑥ the flash names who
      check("⑥ a visszajelzés megnevezi a véleményt (Nagy Péter, levéve)", m.flash.includes("Nagy Péter") && m.flash.includes("levette"), m.flash);
      await p.close();
    }
  }
} finally {
  await browser.close();
}

console.log(failures ? `\n❌ ${failures} bukás` : "\n✅ minden állítás teljesül");
process.exit(failures ? 1 : 0);
