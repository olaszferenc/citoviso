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
const refuse = engine.indexOf("Kapunyitás: nincs a nyitóképtől különböző második kép");
check(
  "bekötés: a generálás a második képet is ujjlenyomatolja, és a kapu-kép hiányát az AI-hívás ELŐTT elutasítja",
  /fingerprintCandidates\(gated\.photos, GATE_SUBJECTS, \[1\]\)/.test(engine) && refuse > 0 && refuse < engine.indexOf('opts.onStage?.("copy")'),
);
check("bekötés: a generált siteData külön mezőben viszi a kapu képét (gatePhoto)", /gatePhoto: gatePick/.test(engine));

if (failed) {
  console.error(`⛔ ${failed} eset megbukott — a Kapunyitás kapuja önmagára nyílhat.`);
  process.exit(1);
}
console.log("✅ gate-photo-check: a szétnyíló kép sosem az, ami az animáció után ott marad; a kapu képe az admin második képe.");
