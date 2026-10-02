// ŐR: a sablon-szöveg egy VALÓDI szállás honlapjához illik (sablon-szöveg tiltólista, ADR-XXXX).
//
// ⚠️ EGY ŐR a sablon-szövegre (koordinátori döntés, 2026-10-02): az M3 (editorial) és az M4
// (a többi sablon: csillagsor, archFrames vélemény-cím) tételei IDE kerülnek, nem külön őrbe —
// aki később landol, rebase-eli és beleolvasztja a saját szakaszát.
//
// ── M3 · editorial: az újság KINÉZET marad, a SZAVAK egy szállásé (SZ-3 „A”) ──────────────
// Mérve a live Muschel mockon (Elek, 2026-10-01): „Szerkesztőség” mint kapcsolat-rovat,
// „Nyomtatva a világhálón”, „Képes krónika”, „No. 1/2/3”, „Foglalási szelvény”, idézőjeles főcím,
// amit senki nem mondott, „A HÁZ SZÁMOKBAN” egyetlen szám fölött, és egy ::first-letter díszbetű,
// ami az „A Muschel”-t „AMuschel”-lé olvasztotta. ÉS az ÁTLAG csillagsora minden vélemény-kártyán
// (M4 lelete): a `Review` nem hordoz saját csillagot, egy kétcsillagos vélemény is ötöt kapott.
//
// Renderelt lapon, mindhárom editorial arculat × mock/éles; minden állításnak piros ikre van
// (a detektor a RÉGI jelölésen fut — ha ott nem tüzel, az őr semmit nem bizonyít).
//
//   npx tsx scripts/template-copy-check.mts

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Review, SiteData } from "../src/engine/recipe.js";
import { starIcon } from "../src/engine/icons.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

/** The newspaper role-play words a real guesthouse page never prints (case-insensitive:
 *  the template uppercases some of them in CSS, the source text is what ships). */
const GAME = /Szerkesztőség|Nyomtatva a világhálón|Képes krónika|Foglalási szelvény|szelvényhez|szelvényen|\bRovatok\b|Vezércikk|Levelek a vendégkönyvből|>\s*No\.\s*\d/i;

const BASE = {
  name: "Muschel Panzió",
  tagline: "Kert, medence, csend",
  intro: "A panzió gondozott kertjében kék vizű medence és árnyékos terasz van.",
  highlights: ["Kültéri medence", "Saját parkoló"],
  photos: [
    { url: "/uploads/a.jpg", alt: "Muschel Panzió — 1. kép", provenance: "owner" },
    { url: "/uploads/b.jpg", alt: "Muschel Panzió — 2. kép", provenance: "owner" },
    { url: "/uploads/c.jpg", alt: "Muschel Panzió — 3. kép", provenance: "owner" },
  ],
  stats: [{ value: "4,8", label: "Google-értékelés · 145 vélemény", icon: "star" }],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "Nádas köz 5, Keszthely" },
} as unknown as SiteData;

/** Visible text: tags out, attribute values never counted. */
function visible(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}
const headline = (html: string) => /<h2 class="e-quote">([\s\S]*?)<\/h2>/.exec(html)?.[1] ?? "";

// The detectors, as functions — so the red twins run the SAME code as the real assertions.
const hasGame = (html: string) => GAME.test(visible(html)) || GAME.test(html.replace(/<style[\s\S]*?<\/style>/g, ""));
const quotedHeadline = (html: string) => /[„”"]/.test(headline(html).replace(/<[^>]*>/g, ""));
const hasDropCap = (html: string) => /::first-letter/.test(html.match(/<style[\s\S]*?<\/style>/g)?.join("") ?? "");
const promisesNumbers = (html: string) => /A ház számokban/i.test(visible(html));


const STAR = starIcon();
/** Star rows = runs of ≥2 adjacent star SVGs (the same definition as the rating-scale-check). */
function starRows(html: string): number {
  let rows = 0;
  let i = 0;
  while ((i = html.indexOf(STAR, i)) !== -1) {
    let run = 1;
    let j = i + STAR.length;
    for (;;) {
      const k = html.slice(j).search(/\S/);
      if (k !== -1 && html.startsWith(STAR, j + k)) {
        run++;
        j = j + k + STAR.length;
      } else break;
    }
    if (run >= 2) rows++;
    i = j;
  }
  return rows;
}
const REVIEWS: readonly Review[] = [
  { quote: "Csendes, tiszta, kedves vendéglátók.", author: "Anna" },
  { quote: "A reggeli a kertben felejthetetlen volt.", author: "Bence" },
  { quote: "Gyerekkel is kényelmes, a játszótér remek.", author: "Csilla" },
];

// ── red twins: the old markup (frozen, 2026-10-01) must trip every detector ─────────────
const OLD =
  `<style>.e-dropcap::first-letter{float:left}</style><nav><a>Képes krónika</a></nav>` +
  `<h2 class="e-quote">„Kerti <em>medence</em>”</h2><div class="e-facts"><h3>A ház számokban</h3></div>` +
  `<div class="e-sech"><span class="e-no">No. 1</span><h2>X</h2></div><h4>Szerkesztőség</h4>`;
console.log("Önteszt (a régi jelölésen minden detektornak tüzelnie kell):");
check("piros iker: játék-szavak", hasGame(OLD));
check("piros iker: idézőjeles főcím", quotedHeadline(OLD));
check("piros iker: díszbetű", hasDropCap(OLD));
check("piros iker: „számokban” egy szám fölött", promisesNumbers(OLD));
check("piros iker: csillagsor vélemény-kártyánként", starRows(`<div class="e-letter">${STAR.repeat(5)}</div><div class="e-letter">${STAR.repeat(5)}</div>`) === 2);

const editorial = TEMPLATES["editorial"];
if (!editorial) {
  console.error("⛔ template-copy-check: nincs „editorial” sablon a regiszterben");
  process.exit(1);
}

console.log(`\nEditorial sablon (${editorial.skins.length} arculat × mock/éles):`);
for (const skin of editorial.skins) {
  for (const phase of ["mock", "live"] as const) {
    const recipe = {
      template: "editorial",
      skin,
      archetype: "",
      sections: [],
      copy: [{ kind: "hero", lead: "Kerti medence, árnyékos terasz", accent: "medence" }],
    } as never;
    const html = renderSite(recipe, BASE, { phase });
    const tag = `${skin}/${phase}`;
    check(`${tag}: nincs újság-szerepjáték a szövegben`, !hasGame(html), (visible(html).match(GAME) ?? [])[0]);
    check(`${tag}: a főcím NEM idézet (senki nem mondta)`, headline(html) !== "" && !quotedHeadline(html), headline(html));
    check(`${tag}: nincs díszbetű (::first-letter)`, !hasDropCap(html));
    check(`${tag}: egy szám fölött nincs „A ház számokban”`, !promisesNumbers(html));
    check(
      `${tag}: a bevezető ép szövegként áll („A panzió…”, nem összeolvadva)`,
      visible(html).includes("A panzió gondozott kertjében"),
    );
  }
}

// The AVERAGE's star row never multiplies with the review cards: the same number of star rows
// with 1 and with 3 real reviews (a per-card row adds one per review). Card-selector-free.
for (const skin of editorial.skins) {
  const live = (n: number) =>
    renderSite({ template: "editorial", skin, archetype: "", sections: [] }, {
      ...BASE,
      reviews: REVIEWS.slice(0, n),
      rating: { value: 4.4, count: 82 },
    } as SiteData, { phase: "live" });
  const one = live(1);
  const three = live(3);
  check(
    `${skin}: a vélemény-kártyán NINCS az átlag csillagsora (1 és 3 véleménnyel ugyanannyi sor)`,
    three.includes(REVIEWS[2]!.quote) && starRows(one) === starRows(three),
    `${starRows(one)} ↔ ${starRows(three)}`,
  );
}

// Two numbers DO make a table: the heading must come back (negative control — the rule is
// "one number", not "never").
{
  const two = { ...BASE, stats: [...(BASE.stats ?? []), { value: "6", label: "szoba", icon: "bed" }] } as SiteData;
  const html = renderSite({ template: "editorial", skin: editorial.skins[0]!, archetype: "", sections: [] }, two, {
    phase: "mock",
  });
  check("két szám fölött a „A ház számokban” cím visszajön (negatív kontroll)", promisesNumbers(html));
}

if (failures) {
  console.error(`\n⛔ template-copy-check: ${failures} hiba — a sablon újság-JÁTÉKOT ír egy szállás oldalára.`);
  process.exit(1);
}
console.log("\n✅ template-copy-check: újság-kinézet, szállás-szöveg.");
