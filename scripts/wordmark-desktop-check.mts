// Névből növő (wordmark-grow) desktop layout — Poe3, 2026-11-04 (Renáta b07890e4, Panna c552c2d0):
// the gallery's title stood alone in a band under the booking strip (the carousel headed by a bare
// „Képek”), and a single room card sat beside two empty columns. Owner's „Igen” to the fix:
// the title heads the gallery; one card is centred at ≤640 px, two share the row.
// Hermetic: no DB, no network.
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail ? `\n     ${detail}` : ""}`);
  if (!ok) failed++;
}

const tpl = TEMPLATES["wordmark-grow"]!;
const TITLE = "Fotók a vendégházról";
const TAG = "Csendes vendégház a város szélén";
const recipe = (galleryTitle?: string) =>
  ({
    template: tpl.id,
    skin: tpl.skins[0],
    archetype: "stacked",
    sections: [{ kind: "gallery", copy: galleryTitle ? { title: galleryTitle } : {} }],
  }) as unknown as Recipe;
const photo = (n: number) => ({ url: `https://example.test/p${n}.jpg`, alt: `kép ${n}`, provenance: "portal" as const });
const room = (n: number) => ({ name: `Szoba ${n}`, capacity: "2 fő" });
const data = (rooms: number): SiteData =>
  ({
    name: "Panna vendégház",
    intro: "Kétágyas szobák a belvárosban.",
    tagline: TAG,
    highlights: ["Wi-Fi", "Parkoló"],
    photos: [photo(1), photo(2), photo(3), photo(4), photo(5), photo(6)],
    contact: { phone: "+36 30 123 4567", email: "a@b.hu" },
    ...(rooms ? { rooms: Array.from({ length: rooms }, (_, i) => room(i + 1)) } : {}),
  }) as unknown as SiteData;

const galleryHead = (html: string) => {
  const at = html.indexOf('data-cit-module="gallery"');
  return at < 0 ? "" : html.slice(at, html.indexOf('data-cit-gstrip', at));
};
const sayBand = (html: string) => /<section class="w-say">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";

{
  const html = renderSite(recipe(TITLE), data(1), { phase: "mock" });
  const head = galleryHead(html);
  check("a galéria címe a galéria fejlécében áll (nem a generikus „Képek”)", head.includes(TITLE) && !/>Képek</.test(head), head.replace(/\s+/g, " ").slice(0, 200));
  check("a galéria címe nem áll külön sávban a Foglalás alatt", !sayBand(html).includes(TITLE.split(" ")[0]!));
  check("a fejléc alatti sorban a tagline, és a nagy mondat-sáv nem ismétli meg", head.includes(TAG) && !sayBand(html).length);
  check("1 szobakártya → középre zárt, ≤640 px-es oszlop (nincs üres oszlop mellette)", /class="w-rooms w-rooms--one"/.test(html) && /\.w-rooms\.w-rooms--one\{grid-template-columns:minmax\(0,640px\);justify-content:center\}/.test(html));
}
{
  const html = renderSite(recipe(TITLE), data(2), { phase: "mock" });
  check("2 szobakártya → két oszlop", /class="w-rooms w-rooms--two"/.test(html) && /\.w-rooms\.w-rooms--two\{grid-template-columns:repeat\(2,1fr\)\}/.test(html));
}
{
  const html = renderSite(recipe(TITLE), data(3), { phase: "mock" });
  check("3+ szoba → a megszokott 3 oszlopos rács", /class="w-rooms"/.test(html));
  check("mobilon (≤860 px) minden változat egy oszlop", /@media\(max-width:860px\)\{\.w-rooms,\.w-rooms\.w-rooms--one,\.w-rooms\.w-rooms--two\{grid-template-columns:1fr\}\}/.test(html));
}
{
  const html = renderSite(recipe(undefined), data(0), { phase: "mock" });
  check("galériacím nélkül a „Képek” a tartalék fejléc", />Képek</.test(galleryHead(html)));
}

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a Névből növő asztali elrendezése visszaesett.`);
  process.exit(1);
}
console.log("✅ wordmark-desktop-check: a galéria címe a galéria fölött, 1 szoba középen (≤640 px), 2 szoba két oszlopban.");
