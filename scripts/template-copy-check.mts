// ŐR: a sablon-szöveg egy VALÓDI szállás honlapjához illik (sablon-szöveg tiltólista, ADR-0300).
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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Recipe, Review, SiteData } from "../src/engine/recipe.js";
import { iconSvg, starIcon } from "../src/engine/icons.js";
import { SAMPLE_FAQS } from "../src/engine/primitives.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { familiarForms } from "../src/generator/addressRegister.js";

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

// The M3 section reports; the process exits once, after the M4 section (one guard).
const m3Failures = failures;
if (!m3Failures) console.log("\n✅ M3 · editorial: újság-kinézet, szállás-szöveg.");
else console.error(`\n⛔ M3 · editorial: ${m3Failures} hiba — a sablon újság-JÁTÉKOT ír egy szállás oldalára.`);

// ── M4 · a többi 18 sablon + közös minta (kontraktus: assets/design-refs/tenant-site/sablon-szovegek/) ──
// A LELET (2026-10-01, Elek élesi jelentése → M3 sablon-átnézés → M4 szál):
//   ① öt sablon (brutalism, organic, watercolor, dopamine, claymorphism) az ÁTLAG csillagsorát
//     MINDEN vélemény-kártyára is kirajzolta → úgy látszott, mintha minden vendég az átlagot adta
//     volna (egy kétcsillagos vendég-vélemény is 5 csillagot kapott). A vélemény (`Review`) nem
//     hordoz saját csillagot, tehát a kártyán NINCS mit kirajzolni; az átlag-sor a szakasz
//     fejlécében él, egyszer.
//   ② az arch-frames vélemény-szakaszának címe a GALÉRIA címét vitte (`galCopy.title`) →
//     „Bőséges asztal, gondozott kert” a vendég-vélemények fölött.
//
// Mérés a RENDERELT lapon (élő fázis, valódi vélemények):
//   ① csillagsor = ≥2 egymás utáni csillag-SVG (ugyanaz a definíció, mint a rating-scale-check-ben).
//     A sorok száma 1 és 3 véleménnyel UGYANANNYI kell legyen — ha egy sablon kártyánként rajzol
//     sort, a 3 véleményes lapon kettővel több van. Sablon-független, a kártya szelektorát nem kell
//     ismerni (egy átszervezés nem vakítja meg).
//   ② a galéria szakasz-címe (egyedi jelölő-szöveg) nem állhat a vélemény-szakasz fejlécében
//     (az első valódi idézetet tartalmazó <section> nyitójától az idézetig).
//
//   ③ TILTÓLISTA (tulaj-döntés 2026-10-02, „mind igen”; kontraktus:
//     assets/design-refs/tenant-site/sablon-szovegek/): a sablonok „játék-szövegei” („A kamra”,
//     „Vendégkönyv”, „Egy nap nálunk”, „{n}. fejezet”, „Wellness”, „Foglalási konzol”, „A porta” …)
//     sem a renderelt lapon (élő + mock, szakasz-szöveggel ÉS nélküle — a tartalékok is látsszanak),
//     sem a sablon-forrásban nem állhatnak; a közös minta-GYIK és a kompozíciós tartalék magáz.
//     Az editorial tételeit az M3 szál teszi ide (egy őr, nem kettő).
//   ④ a galéria címe legfeljebb EGYSZER látszik (parallax: a fotó-sáv tartaléka; wordmark-grow:
//     a kiemelt mondat-sáv és a galéria-fejléc ugyanazt írta).
//   ⑤ ál-jelölések: sorszám/római szám a tételeken („01 /”, „I.”, „1. fejezet”), mindig teli sáv
//     (aurora), pont a név/főcím végén, tű-ikon egy szolgáltatáson (dopamine matrica).
//
//   npx tsx scripts/template-copy-check.mts              # zöld futás (M3 + M4 szakasz)
//   npx tsx scripts/template-copy-check.mts --self-test  # PIROS kontroll: a régi viselkedés
//                                                        #   kimenete visszarakva → pontosan az
//                                                        #   érintett sablonok buknak


const SELF_TEST = process.argv.includes("--self-test");

const PHOTO = (i: number) => ({ url: `https://copy-check.test/p${i}.png`, alt: `fotó ${i}`, provenance: "owner" as const });

const GAL_TITLE = "Galériacím Jelölő";
const REV_TITLE = "Véleménycím Jelölő";


function data(nReviews: number): SiteData {
  return {
    name: "Nyugalom Vendégház",
    tagline: "Csend a domb alatt",
    intro: "Csendes utca végén álló vendégház, saját udvarral és árnyas kerttel.",
    highlights: ["Saját parkoló az udvarban", "Kert grillezővel", "Légkondicionált szobák", "Reggeli a teraszon"],
    photos: [0, 1, 2, 3, 4, 5].map(PHOTO),
    rooms: [{ name: "Kertre néző szoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    reviews: REVIEWS.slice(0, nReviews),
    rating: { value: 4.4, count: 82 },
    stats: [{ icon: "star", label: "Google-értékelés · 82 vélemény", value: "4,4" }],
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as SiteData;
}

/** No hero copy and the tagline repeated as the headline: the parallax photo band then falls
 *  back to the gallery title — the case that showed it twice. */
function dataNoHero(n: number): SiteData {
  return { ...data(n), tagline: "" } as SiteData;
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const recipe = (t: string): Recipe =>
  ({
    template: t,
    skin: TEMPLATES[t]!.skins[0] ?? "",
    archetype: "",
    sections: [
      { kind: "gallery", copy: { title: GAL_TITLE, eyebrow: "Képek" } },
      { kind: "reviews", copy: { title: REV_TITLE, eyebrow: "Vélemények" } },
    ],
  }) as unknown as Recipe;

const visibleText = (html: string): string =>
  html
    .replace(/\u00a0/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");

/** The OLD outputs, put back on the rendered page (self-test): a star row on every review card;
 *  the gallery title over the reviews. Only the templates that really did it get the mutation. */
const OLD_CARD_STARS = new Set(["editorial", "brutalism", "organic", "watercolor", "dopamine", "claymorphism"]);
const OLD_REV_TITLE = new Set(["arch-frames"]);
function mutate(id: string, html: string, n: number): string {
  let out = html;
  if (OLD_CARD_STARS.has(id)) {
    for (const r of REVIEWS.slice(0, n)) out = out.replace(r.quote, `${STAR.repeat(4)}${r.quote}`);
  }
  if (OLD_REV_TITLE.has(id)) {
    const q = out.indexOf(REVIEWS[0]!.quote);
    const s = out.lastIndexOf("<section", q);
    out = out.slice(0, s) + out.slice(s, q).replace(/(<h2[^>]*>)[\s\S]*?(<\/h2>)/, `$1${GAL_TITLE}$2`) + out.slice(q);
  }
  return out;
}

/** The OLD texts/markers, put back on the rendered page (self-test) — one per template it hit. */
const OLD_TEXT: Record<string, string> = {
  scrapbook: "<a>A kamra</a>", organic: "<h2>Egy nap nálunk</h2>", watercolor: "<h2>Így telik majd</h2>",
  horizontal: '<span class="h-no">1.\u00a0fejezet</span>', cinematic: "<h2>Minden ablak egy mozivászon</h2>",
  claymorphism: "<a>Wellness</a>", brutalism: "<p>&gt;&gt; Foglalási konzol // közvetlen kapcsolat</p>",
  dopamine: "<a>Foglalnék!</a>", artdeco: "<p>A porta</p>", "dark-luxury": '<p class="t-no"><span>I.</span></p>',
  aurora: '<div class="au-bar"><i></i></div>', "arch-frames": "<h2>Képek a portáról</h2>", "tilted-gallery": "<div>Ami csak itt van</div>",
};
const OLD_TWICE = new Set(["parallax", "wordmark-grow"]);
function mutateBanned(id: string, html: string): string {
  let out = html;
  if (OLD_TEXT[id]) out = out.replace("</body>", `${OLD_TEXT[id]}</body>`);
  if (OLD_TWICE.has(id)) out = out.replace("</body>", `<h2>${GAL_TITLE}</h2><h2>${GAL_TITLE}</h2></body>`);
  return out;
}

const fails: string[] = [];
let judgedStars = 0;
let judgedTitle = 0;

for (const id of Object.keys(TEMPLATES)) {
  const render = (n: number): string => {
    const html = renderSite(recipe(id), data(n), { phase: "live" });
    return SELF_TEST ? mutate(id, html, n) : html;
  };
  const one = render(1);
  const three = render(3);

  // ① the average's star row never multiplies with the review cards
  const r1 = starRows(one);
  const r3 = starRows(three);
  judgedStars++;
  if (r3 !== r1) {
    fails.push(`${id}: ${r1} csillagsor 1 véleménnyel, ${r3} háromdal — a vélemény-kártyán az ÁTLAG csillagsora ül`);
  }

  // ② the reviews section wears its OWN heading, never the gallery's: the stretch from the
  //   <section> that holds the first review quote up to that quote must not carry the gallery
  //   title. (A gallery title repeated elsewhere — e.g. a quote band — is not this defect.)
  const q = three.indexOf(REVIEWS[0]!.quote);
  judgedTitle++;
  if (q === -1) {
    fails.push(`${id}: a valódi vélemény nem jelenik meg a lapon — a mérés vak`);
  } else {
    const head = visibleText(three.slice(three.lastIndexOf("<section", q), q));
    if (head.includes(GAL_TITLE)) fails.push(`${id}: a vélemény-szakasz címe a galériáé („${GAL_TITLE}”)`);
  }
}

// ③ the banned template texts — rendered (live + mock, with section copy and without) and in source
const BANNED: readonly RegExp[] = [
  /(^|\s)A kamra(\s|$)/i, /kamra polcáról/i, /Vendégkönyv/i, /vendégkönyvből/i, /Ide írtak nekünk/i,
  /(^|\s)Lapozó(\s|$)/i, /felragasztott cetlik/i, /lapozzon bele/i, /Ezt kérjük/i,
  /A birtok élete/i, /Egy nap nálunk/i, /Semmi sem kötelező/i, /(^|\s)Ami jár(\s|$)/i, /Ami nálunk jár/i,
  /A kényelem itt sem hiányzik/i, /Évszakról évszakra/i, /Így telik majd/i, /Képek a nyárból/i,
  /\d+\. fejezet/i, /Képek a magasból/i, /mozivászon/i, /Több, mint egy szoba/i, /(^|\s)Wellness(\s|$)/i,
  /Puha landolás/i, /Foglalási konzol/i, /(^|\s)A fal(\s|$)/i, /Mi van bent\?/i, /Foglalnék!/i,
  /(^|\s)A porta(\s|$)/i, /A ház szolgálata/i, /A ház arcai/i, /Kérdések a portához/i, /Üzenet a portának/i,
  /Képek a portáról/i, /Ami csak itt van/i, /házirended/i, /politikád/i, /fogadtok/i, /Ide gyere/i,
];
/** Editorial is the M3 thread's: its own list lands there (coordinator, 2026-10-02). */
const BANNED_SCOPE = Object.keys(TEMPLATES).filter((id) => id !== "editorial");
const bare = (t: string): Recipe => ({ template: t, skin: TEMPLATES[t]!.skins[0] ?? "", archetype: "", sections: [] }) as unknown as Recipe;
let judgedBanned = 0;
for (const id of BANNED_SCOPE) {
  for (const [label, html] of [
    ["élő", renderSite(recipe(id), data(3), { phase: "live" })],
    ["mock", renderSite(recipe(id), data(0), { phase: "mock" })],
    ["élő, szakasz-szöveg nélkül", renderSite(bare(id), data(3), { phase: "live" })],
    ["mock, szakasz-szöveg nélkül", renderSite(bare(id), data(0), { phase: "mock" })],
  ] as const) {
    const out = SELF_TEST ? mutateBanned(id, html) : html;
    const text = visibleText(out);
    judgedBanned++;
    for (const re of BANNED) {
      const m = re.exec(text);
      if (m) fails.push(`${id}: tiltott sablon-szöveg (${label}): „${m[0].trim()}”`);
    }
    // ⑤ fake markers
    const MARKERS: [RegExp, string][] = [
      [/class="(?:wc-no|b-fc-n|h-no|au-bar)"/, "ál-sorszám / mindig teli sáv"],
      [/<span class="b-sectag">\d+ \//, "„01 /” szakasz-szám"],
      [/class="t-no"><span>[IVX]+\.<\/span>/, "római szám a tételen"],
      [/<span class="t-no">0\d<\/span>/, "„01” a képen"],
      [/<span>\.<\/span><\/(?:a|span)>|<em>\.<\/em><\/h1>/, "pont a név / főcím végén"],
      [new RegExp(`t-s2">${escRe(iconSvg("location"))}`), "tű-ikon egy szolgáltatáson"],
    ];
    for (const [re, why] of MARKERS) if (re.test(out)) fails.push(`${id}: ${why} (${label})`);
  }
  // ④ the gallery title shows at most once
  const once = visibleText(SELF_TEST ? mutateBanned(id, renderSite(recipe(id), dataNoHero(3), { phase: "live" })) : renderSite(recipe(id), dataNoHero(3), { phase: "live" }));
  const n = once.split(GAL_TITLE).length - 1;
  if (n > 1) fails.push(`${id}: a galéria címe ${n}× látszik`);
}
// ③ static: the source of every template (not editorial) and the shared samples
for (const f of readdirSync("src/engine/templates").filter((f) => f.endsWith(".ts") && f !== "editorial.ts")) {
  const src = readFileSync(path.join("src/engine/templates", f), "utf8");
  for (const lit of src.matchAll(/T\(\s*\w+\s*,\s*"([^"]+)"/g)) {
    for (const re of BANNED) if (re.test(lit[1]!.replace(/\u00a0/g, " "))) fails.push(`${f}: tiltott sablon-szöveg a forrásban: „${lit[1]}”`);
  }
}
for (const q of SAMPLE_FAQS) {
  for (const re of BANNED) if (re.test(q.a) || re.test(q.q)) fails.push(`SAMPLE_FAQS: tegező minta-szöveg: „${q.a}”`);
  const fam = familiarForms(`${q.q} ${q.a}`).filter((h) => h.rule !== "pronoun" || h.quote.toLowerCase() !== "te");
  if (fam.length) fails.push(`SAMPLE_FAQS: tegező alak („${fam.map((h) => h.quote).join(", ")}”) — a minta is magáz (ADR-0292)`);
}
if (/sectionHead\("Ide gyere"/.test(readFileSync("src/engine/primitives.ts", "utf8"))) fails.push(`primitives.ts: „Ide gyere” tartalék-felcím`);
if (judgedBanned < BANNED_SCOPE.length * 4) fails.push(`③ a mérés vak: ${judgedBanned} lap`);

if (judgedStars !== Object.keys(TEMPLATES).length) fails.push(`a mérés vak: ${judgedStars} sablon mérve`);

if (SELF_TEST) {
  const expected = [...OLD_CARD_STARS, ...OLD_REV_TITLE, ...Object.keys(OLD_TEXT), ...OLD_TWICE];
  const missing = expected.filter((id) => !fails.some((f) => f.startsWith(`${id}:`)));
  const extra = fails.filter((f) => !expected.some((id) => f.startsWith(`${id}:`)));
  if (missing.length || extra.length || m3Failures) {
    console.error("✗ template-copy-check --self-test: a kontroll nem a várt sablonokat buktatta");
    for (const m of missing) console.error(`  · nem bukott: ${m}`);
    for (const e of extra) console.error(`  · váratlan: ${e}`);
    process.exit(1);
  }
  console.log(`✓ template-copy-check --self-test: a régi kimenet pontosan a ${expected.length} érintett sablont buktatja (${fails.length} lelet)`);
  process.exit(0);
}

if (fails.length || m3Failures) {
  console.error(`✗ template-copy-check: ${fails.length} M4-lelet, ${m3Failures} M3-hiba`);
  for (const f of fails) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`✓ template-copy-check: ${judgedBanned} lapon nincs tiltott sablon-szöveg / ál-jelölés, a galéria-cím sehol sem kétszer; ${judgedStars} sablon csillagsora a vélemény-számtól független, ${judgedTitle} sablon galéria-címe nem vándorol`);
