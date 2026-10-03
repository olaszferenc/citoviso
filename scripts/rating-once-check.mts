// ŐR: a Google-értékelés a forrás-linkjével EGYSZER áll a lapon — mind a 21 sablonon.
//
// A LELET (2026-10-02, Kapunyitás-sablon, ADR-0311 mellék-lelet): a `walk-through` és a
// `gate-opening` SAJÁT értékelés-szakasza kiírja a Google-számot a „Megnézem a Google-on”
// linkkel, és közvetlenül alatta a közös `trust` slot (ADR-0046/0047) UGYANAZT a számot
// UGYANAZZAL a linkkel még egyszer: a `reviews-pending` jelvénye (mock, és élő lap vélemény
// nélkül), illetve élő lapon a `google-rating` modul jelvénye. Az ADR-0057 ② már kimondta:
// a jelvény kimarad, ha felette már áll egy — de csak a modul-modul párra volt bekötve,
// a sablon SAJÁT kártyájára nem.
//
// A szabály: a Google-vélemény oldalára mutató link (= a hitelesíthető értékelés) a lapon
// PONTOSAN EGYSZER. Nulla is hiba: a szám mellől nem tűnhet el a forrás (ADR-0046 ③ — a link
// egyben a Places-feltételek attribúciója), vagyis a túljavítás is piros.
// Mérve a sablon KIMENETÉN (href a vélemény-oldalra), nem sablon-listán: a 22. sablon is így ítéltetik.
//
// Három alany, minden sablonon:
//   ① mock, first-party vélemény nélkül — a valós eset (a dev-DB mind a 165 rating-es mockja ilyen);
//   ② élő lap, a `google-rating` modul bekapcsolva (googleRating), vélemény nélkül;
//   ③ élő lap, modul + first-party vélemény (a sablon saját vélemény-szakasza renderel).
//
// Amit NEM ítél (szándékosan, ADR-0057 ②): a hős-statisztika / mobil CTA-sáv számát a
// vélemény-rész jelvénye mellett — az a jóváhagyott „állítás + hitelesítés” pár, nem link.
//
//   npx tsx scripts/rating-once-check.mts              # zöld futás
//   npx tsx scripts/rating-once-check.mts --self-test  # PIROS kontroll: a közös jelvény
//                                                      #   visszarakva a sablon saját kártyája alá

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");

const URL_ = "https://search.google.com/local/reviews?placeid=ChIJrating-once-check";
const PHOTO = (i: number) => ({ url: `https://rating-once.test/p${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const });

// The shape the generator persists (generateEngine.ts): the rating stat + rating with the reviews URL.
const base: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend a domb alatt",
  intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
  highlights: ["Saját parkoló az udvarban"],
  photos: [0, 1, 2, 3, 4, 5].map(PHOTO),
  stats: [{ value: "4,6", label: "Google-értékelés · 82 vélemény", icon: "star" }],
  rating: { value: 4.6, count: 82, url: URL_ },
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
} as SiteData;
const google = { googleRating: { value: 4.6, count: 82, url: URL_ } };
const reviews = { reviews: [{ quote: "Csendes, tiszta, kedves vendéglátók.", author: "Anna" }] };

const SUBJECTS = [
  { key: "mock", phase: "mock" as const, d: base },
  { key: "élő+modul", phase: "live" as const, d: { ...base, ...google } as SiteData },
  { key: "élő+modul+vélemény", phase: "live" as const, d: { ...base, ...google, ...reviews } as SiteData },
];

const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

/** Links to the Google reviews page in the rendered markup (scripts — JSON-LD, runtime — out). */
const reviewLinks = (html: string): number =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ").split(`href="${URL_.replace(/&/g, "&amp;")}"`).length - 1;

// ⛔ PIROS KONTROLL: what the trust slot did until 2026-10-03 — the shared badge, same link,
// planted right after the template's own linked rating card.
const OLD_BADGE =
  `<section class="cit-modsec" data-cit-module="reviews-pending"><div class="cit-modsec__in">` +
  `<a class="cit-grat" href="${URL_}" target="_blank" rel="noopener nofollow" data-cit-popup="reviews">4,6</a></div></section>`;

const fails: string[] = [];
let nativeLinked = 0;
for (const t of Object.keys(TEMPLATES)) {
  for (const s of SUBJECTS) {
    let html = renderSite(recipe(t), s.d, { phase: s.phase });
    const badge = /data-cit-module="(google-rating|reviews-pending)"[\s\S]*?class="cit-grat"/.test(html);
    if (SELF_TEST && !badge && reviewLinks(html) === 1) {
      nativeLinked++;
      html = html.replace(`<div data-cit-slot="trust"></div>`, "").replace("</main>", `${OLD_BADGE}</main>`);
      if (!html.includes(OLD_BADGE)) html = html.replace("</body>", `${OLD_BADGE}</body>`);
    }
    const n = reviewLinks(html);
    if (n !== 1) fails.push(`${t} (${s.key}): ${n}× a Google-értékelés linkje a lapon — pontosan 1 kell`);
  }
}

if (SELF_TEST) {
  // Every template whose own card carries the link must now fail, on every subject.
  const caught = fails.length;
  const ok = nativeLinked > 0 && caught === nativeLinked;
  console.log(
    ok
      ? `✅ PIROS KONTROLL: a visszarakott közös jelvényt mind a ${nativeLinked} sablon×alanyon elkapta (saját linkes kártya mellett)`
      : `⛔ PIROS KONTROLL: ${nativeLinked} visszarontott eset, ${caught} bukás — ${fails.join(" · ") || "semmi"}`,
  );
  process.exit(ok ? 0 : 1);
}
if (fails.length) {
  console.log(`⛔ ${fails.length} hiba:\n  ` + fails.join("\n  "));
  process.exit(1);
}
console.log(`✅ a Google-értékelés linkje pontosan egyszer: ${Object.keys(TEMPLATES).length} sablon × ${SUBJECTS.length} alany`);
process.exit(0);
