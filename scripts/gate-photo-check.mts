// Kapunyitás (gate-opening): the photo that SPLITS is never the photo that STAYS (ADR-0423).
// Owner, 2026-11-04: „DE KURVÁRA NEM LEHET A SZÉTNYÍLÓ KÉP UGYANAZ AMI AZ ANIMÁCIÓ UTÁN OTTMARAD!!!!
// Az admin második képe legyen, hogy tudja majd tenant ezt is konfigurálni”.
// The leaves show SiteData.gatePhoto (own field; generation = the gallery's SECOND photo), never
// the hero by URL or by fingerprint; with no distinct photo there is no gate (the old „A” fallback,
// the hero split onto itself, is gone) and generation refuses the plan. Hermetic: no DB, no network.
import { readFileSync } from "node:fs";
import type { Photo, Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { gatePhotoOf } from "../src/engine/templates/gateOpening.js";

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"}  ${label}${detail ? `\n     ${detail}` : ""}`);
  if (!ok) failed++;
}

const P = (n: number, extra: Partial<Photo> = {}): Photo => ({ url: `https://example.test/p${n}.jpg`, alt: `kép ${n}`, provenance: "portal", ...extra });
const HASH_A = "f0f0f0f0f0f0f0f0";
const HASH_B = "0f0f0f0f0f0f0f0f";

// ── the rule ──
check("a kapu képe a MÁSODIK kép", gatePhotoOf([P(1), P(2), P(3)])?.url === P(2).url);
check("csak egy kép → nincs kapu (nem a nyitókép kettévágva)", gatePhotoOf([P(1)]) === null);
check("a második kép URL-je a nyitóképé → nincs kapu", gatePhotoOf([P(1), { ...P(1) }]) === null);
check("a második kép a nyitókép újraközölt másolata (azonos ujjlenyomat) → nincs kapu",
  gatePhotoOf([P(1, { dhash: HASH_A }), P(2, { dhash: HASH_A })]) === null);
check("más ujjlenyomatú második kép → az a kapu", gatePhotoOf([P(1, { dhash: HASH_A }), P(2, { dhash: HASH_B })])?.url === P(2).url);
check("a külön mező (gatePhoto) nyer — a tenant választása", gatePhotoOf([P(1), P(2), P(3)], P(3))?.url === P(3).url);
check("ha a külön mező közben a nyitókép lett (operátori hős-csere) → a második kép áll be, nem a nyitókép",
  gatePhotoOf([P(1), P(2)], P(1))?.url === P(2).url);
// Vörösmarty tér, 2026-11-24: the same file under two SIZE folders (500x500w · OriginalPhoto) —
// the square crop's fingerprint differs, so only the size-free key tells them apart.
const V = (folder: string): Photo => ({ url: `https://x.booked.hu/data/Photos/${folder}/1/2/3/Macro.JPEG`, alt: "m", provenance: "portal" });
check("a külön mező ugyanaz a fájl más méret-mappában (500x500w ↔ OriginalPhoto) → nem az, hanem a következő kép",
  gatePhotoOf([V("500x500w"), P(2)], V("OriginalPhoto"))?.url === P(2).url);
check("a második kép a nyitókép más méretű változata → nincs kapu", gatePhotoOf([V("500x500w"), V("OriginalPhoto")]) === null);
check("konyha/fürdő (backstage) nem kerül a szárnyra", gatePhotoOf([P(1), P(2, { backstage: true }), P(3)])?.url === P(3).url);

// ── a téma (tulaj 2026-11-23, terv design-refs/tenant-site/generator-javitas): a szárnyon MÁS TÉMÁJÚ fotó ──
const S = (n: number, subject: string): Photo => P(n, { subject });
check("homlokzat-hős, 2. kép is homlokzat, 3. étkező → az étkező (Krisztina: ugyanaz a ház másik szögből)",
  gatePhotoOf([S(1, "exterior"), S(2, "exterior"), S(3, "dining")])?.url === P(3).url);
check("homlokzat-hős → a kert/medence is más csoport",
  gatePhotoOf([S(1, "exterior"), S(2, "exterior"), S(3, "pool_garden")])?.url === P(3).url);
check("belső-hős → a homlokzat a kapu", gatePhotoOf([S(1, "interior"), S(2, "bathroom"), S(3, "exterior")])?.url === P(3).url);
check("csak azonos témájú képek → nincs kapu", gatePhotoOf([S(1, "exterior"), S(2, "exterior"), S(3, "exterior")]) === null);
check("azonos csoport, de más téma (kert ↔ kilátás) → az áll be, ha nincs más csoport",
  gatePhotoOf([S(1, "pool_garden"), S(2, "view")])?.url === P(2).url);
check("téma nélküli kép nem nyer a téma-szabályban", gatePhotoOf([S(1, "exterior"), P(2), S(3, "dining")])?.url === P(3).url);
check("a tenant választása a téma-szabály előtt áll", gatePhotoOf([S(1, "exterior"), S(2, "exterior"), S(3, "dining")], S(2, "exterior"))?.url === P(2).url);

// ── the render ──
const tpl = TEMPLATES["gate-opening"]!;
const recipe = { template: tpl.id, skin: tpl.skins[0], archetype: "stacked", sections: [] } as unknown as Recipe;
const base = {
  name: "Teszt Vendégház",
  intro: "Csendes ház a falu szélén, kerttel.",
  tagline: "Csendes ház a falu szélén",
  highlights: ["Kert", "Saját parkoló"],
  contact: { phone: "+36 30 123 4567", email: "a@b.hu" },
} as unknown as SiteData;
const srcOf = (html: string, re: RegExp) => re.exec(html)?.[1] ?? null;
const HERO_RE = /class="ko-hero-bg"><img src="([^"]+)"/;
const LEAF_RE = /class="ko-leaf l"><img src="([^"]+)"/;
{
  const html = renderSite(recipe, { ...base, photos: [P(1), P(2), P(3)], gatePhoto: P(2) }, { phase: "mock" });
  const hero = srcOf(html, HERO_RE), leaf = srcOf(html, LEAF_RE);
  check("render: a kapu-szárnyak képe ≠ az animáció után ott maradó kép", Boolean(hero && leaf && hero !== leaf), `hős=${hero} kapu=${leaf}`);
  check("render: a szárnyak a külön mező (gatePhoto) képét mutatják", leaf === P(2).url);
  check("render: a tompított „self” kapu megszűnt", !/ko-gate self|ko-gate\.self/.test(html));
}
{
  const html = renderSite(recipe, { ...base, photos: [P(1)] }, { phase: "mock" });
  check("render: egyetlen képnél nincs kapu (nem nyílik önmagára)", !/class="ko-gate/.test(html) && srcOf(html, HERO_RE) === P(1).url);
}
{
  const html = renderSite(recipe, { ...base, photos: [P(1, { dhash: HASH_A }), P(2, { dhash: HASH_A })] }, { phase: "mock" });
  check("render: régi mock, a második kép a nyitókép másolata → nincs kapu", !/class="ko-gate/.test(html));
}

// ── wiring: generation fingerprints the second photo and refuses BEFORE any AI spend ──
const engine = readFileSync(new URL("../src/generator/generateEngine.ts", import.meta.url), "utf8");
const refuse = engine.indexOf("Kapunyitás: nincs a nyitóképtől eltérő témájú kép (");
check(
  "bekötés: a generálás minden képet ujjlenyomatol (a másodikat is), és a kapu-kép hiányát az AI-hívás ELŐTT elutasítja",
  // 2026-11-24: one shared step (generator/photoCurate.ts) — it fingerprints every photo.
  /curateMockPhotos\(gated\.photos\)/.test(engine) &&
    /fingerprintAndDedupe\(input\)/.test(readFileSync(new URL("../src/generator/photoCurate.ts", import.meta.url), "utf8")) &&
    refuse > 0 && refuse < engine.indexOf('opts.onStage?.("copy")'),
);
check("bekötés: a generált siteData külön mezőben viszi a kapu képét (gatePhoto)", /gatePhoto: gatePick/.test(engine));

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a Kapunyitás kapuja önmagára nyílhat.`);
  process.exit(1);
}
console.log("✅ gate-photo-check: a szétnyíló kép sosem az, ami az animáció után ott marad; a kapu képe az admin második képe.");
