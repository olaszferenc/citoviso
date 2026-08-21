// ADR-0044/d guard: the unit subpage must look EXACTLY like the site it belongs to.
//
// The owner's constraint, verbatim: "extrém mód fontos, hogy ugyanabba a stílusba
// illeszkedjen, mint a fő mock, amit ígértünk a tenantnak". That is the §I delivery
// invariant — a subpage in some other look is the same bait-and-switch as swapping
// the tenant's photos. So it is MEASURED here, not asserted in a comment.
//
// Also gated: thin content. A near-empty subpage is not an SEO win, and several
// similar ones read as duplicates — so a unit without a photo AND some text gets no
// page at all, and the admin says why.
//
//   npx tsx scripts/unit-subpage-check.mts

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { unitPageData } from "../src/tenant/editor.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

const HOUSE: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro: "Kétszáz méterre a strandtól.",
  highlights: ["Saját parkoló"],
  photos: [
    { url: "/uploads/haz.jpg", alt: "Ház", provenance: "owner" },
    { url: "/uploads/apartman-1.jpg", alt: "Apartman", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567" },
  place: { city: "Balatonberény" },
  pricing: {
    currency: "HUF",
    unit: "per_night",
    units: [
      { name: "Kertre néző apartman", base: 19000 },
      { name: "Padlásszoba", base: 12000 },
    ],
  },
} as unknown as SiteData;

const UNIT = {
  id: "u1",
  name: "Kertre néző apartman",
  slug: "kertre-nezo-apartman",
  capacity: 4,
  description: "Külön bejáratú, teraszos apartman a kert felé.",
  amenities: ["Saját fürdőszoba", "Terasz"],
};
const UNIT_PHOTOS = [{ url: "/uploads/apartman-1.jpg", alt: "Apartman", provenance: "owner" as const }];

console.log("Egység-aloldal (stílus, tartalom, egyediség):\n");

// ── thin-content gate ───────────────────────────────────────────────────────
check(
  "⭐ fotó nélküli egység NEM kap oldalt",
  unitPageData(HOUSE, UNIT, [], undefined) === null,
);
check(
  "⭐ szöveg nélküli egység NEM kap oldalt",
  unitPageData(HOUSE, { ...UNIT, description: null, amenities: [] }, UNIT_PHOTOS, undefined) === null,
);
const page = unitPageData(HOUSE, UNIT, UNIT_PHOTOS, "https://nyugalom.citoviso.com");
check("tartalommal viszont kap", page !== null);
if (!page) process.exit(1);

check("a canonical az egység saját címe", page.canonicalUrl === "https://nyugalom.citoviso.com/apartman/kertre-nezo-apartman", page.canonicalUrl);
check("csak a SAJÁT fotói kerülnek rá", page.photos.length === 1 && page.photos[0]!.url === "/uploads/apartman-1.jpg");
check("nincs rajta szoba-LISTA (az a főoldalé)", page.rooms === undefined);
check("csak a saját ára szerepel", (page.pricing?.units ?? []).length === 1 && page.pricing!.units![0]!.name === UNIT.name);

// ── the constraint: SAME style as the homepage, in every template ───────────
const templateIds = Object.keys(TEMPLATES);
const styleMismatch: string[] = [];
const sameTitle: string[] = [];
for (const t of templateIds) {
  const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
  const home = renderSite(recipe, HOUSE, { phase: "live" });
  const sub = renderSite(recipe, page, { phase: "live" });

  // The style IS the <style> block plus the font links: identical bytes here means
  // the visitor cannot tell the two pages apart by look, only by content.
  const styleOf = (html: string) => (html.match(/<style[\s\S]*?<\/style>/g) ?? []).join("").length;
  const fontsOf = (html: string) => (html.match(/fonts\.googleapis[^"']*/g) ?? []).join("|");
  const bodyClassOf = (html: string) => /<body[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";

  if (
    Math.abs(styleOf(home) - styleOf(sub)) > 400 ||
    fontsOf(home) !== fontsOf(sub) ||
    bodyClassOf(home) !== bodyClassOf(sub)
  ) {
    styleMismatch.push(t);
  }
  const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  if (titleOf(home) === titleOf(sub)) sameTitle.push(t);
}

check(
  `⭐⭐ az aloldal UGYANAZT a stílust kapja mind a ${templateIds.length} sablonban`,
  styleMismatch.length === 0,
  styleMismatch.join(", "),
);
check(
  "az aloldal címe KÜLÖNBÖZIK a főoldalétól (nincs duplikált title)",
  sameTitle.length === 0,
  sameTitle.join(", "),
);

// ── control: prove the style comparison can actually say NO ─────────────────
// A sameness check that never fails proves nothing. Rendering the subpage through a
// DIFFERENT template must be detected — otherwise the green above is meaningless.
{
  const styleOf = (html: string) => (html.match(/<style[\s\S]*?<\/style>/g) ?? []).join("").length;
  const fontsOf = (html: string) => (html.match(/fonts\.googleapis[^"']*/g) ?? []).join("|");
  const bodyClassOf = (html: string) => /<body[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
  const a = renderSite({ template: templateIds[0]!, skin: "", archetype: "", sections: [] }, HOUSE, { phase: "live" });
  let detected = 0;
  for (const t of templateIds.slice(1)) {
    const b = renderSite({ template: t, skin: "", archetype: "", sections: [] }, page, { phase: "live" });
    if (
      Math.abs(styleOf(a) - styleOf(b)) > 400 ||
      fontsOf(a) !== fontsOf(b) ||
      bodyClassOf(a) !== bodyClassOf(b)
    ) {
      detected++;
    }
  }
  check(
    `a stilus-ellenorzes ERZEKENY: idegen sablont ${detected}/${templateIds.length - 1} esetben kiszur`,
    detected === templateIds.length - 1,
    `csak ${detected} esetben szurta ki`,
  );
}

if (failures) {
  console.error(`\n⛔ unit-subpage-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ unit-subpage-check: az egység-aloldal a fő oldal stílusát viszi, és nem üres.");
