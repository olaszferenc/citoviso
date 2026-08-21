// ADR-0044 END-TO-END guard: does a module's saved setting actually REACH THE PAGE?
//
// WHY THIS EXISTS, bluntly: module-config-lint only proves a settings SCREEN exists.
// That is not the promise. The promise is that what the owner types shows up on the
// site. Between the two sat a gap where a tenant could fill in the amenities, press
// save, and nothing changed — worse than the original bug, because it LOOKED like it
// worked. The lint was green throughout.
//
// Same failure mode as ADR-0043 (every guard green on a wrong result) and as the
// `rooms` case. So the rule here is: assert on the RENDERED HTML, never on the
// existence of a form.
//
// For each priced module we set a distinctive value and require it to appear in the
// output of renderSite() across EVERY art template — a module that only renders in
// one skin is not delivered.
//
//   npx tsx scripts/module-render-check.mts

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { MODULE_CATALOG } from "../src/modules.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${detail}`}`);
  }
}

const BASE: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro: "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [
    { url: "/uploads/a.jpg", alt: "kert", provenance: "owner" },
    { url: "/uploads/b.jpg", alt: "szoba", provenance: "owner" },
  ],
  contact: { email: "info@example.com", phone: "+36 30 123 4567", address: "Fő utca 1." },
} as unknown as SiteData;

/**
 * Per module: a config-shaped patch on SiteData plus a NEEDLE that can only appear
 * if that setting was rendered. The needles are deliberately odd strings so a
 * coincidental match is impossible.
 */
const CASES: Record<string, { patch: Partial<SiteData>; needle: string }> = {
  amenities: {
    patch: { amenities: ["Ingyenes wifi", "Zsindelyes kerékpártároló"] } as Partial<SiteData>,
    needle: "Zsindelyes kerékpártároló",
  },
  hours: {
    patch: {
      hours: { checkInFrom: "15:30", checkInTo: "20:00", checkOutUntil: "09:45", note: "" },
    } as Partial<SiteData>,
    needle: "15:30",
  },
  usp: {
    patch: { usp: ["Kétperces séta a nádasig"] } as Partial<SiteData>,
    needle: "Kétperces séta a nádasig",
  },
  poi: {
    patch: { poi: ["Öreg-hegyi kilátó — 1,2 km"] } as Partial<SiteData>,
    needle: "Öreg-hegyi kilátó",
  },
  pricing: {
    patch: {
      pricing: {
        currency: "HUF",
        unit: "per_night",
        note: "Az ár tartalmazza az idegenforgalmi adót.",
        seasons: [{ label: "Főszezon", from: "06.15", to: "08.31", price: 28000 }],
      },
    } as Partial<SiteData>,
    needle: "Főszezon",
  },
  location: {
    patch: {
      location: { showMap: true, approachNote: "A templomnál jobbra.", parkingNote: "Udvari parkoló" },
    } as Partial<SiteData>,
    needle: "A templomnál jobbra.",
  },
  newsletter: {
    patch: {
      newsletter: { title: "Maradjunk kapcsolatban", subtitle: "Évente néhány levél." },
    } as Partial<SiteData>,
    needle: "Évente néhány levél.",
  },
};

const priced = MODULE_CATALOG.filter((m) => m.priceMonthly > 0).map((m) => m.id);
const templateIds = Object.keys(TEMPLATES);

console.log(`Modul-konfig → renderelt oldal (${templateIds.length} sablon):\n`);

for (const id of priced) {
  const c = CASES[id];
  if (!c) {
    // Modules whose delivery is proven elsewhere get an explicit exemption with a
    // reason — silence here would be exactly the blind spot this script exists for.
    const EXEMPT: Record<string, string> = {
      gallery: "a fotókat a Fotók fül szállítja (owner-upload), külön mérve",
      rooms: "a szobák a SiteData.rooms-on mennek, a rooms primitív rendereli",
      reviews: "valós vélemény-adat kell hozzá; a megjelenítést a reviews primitív fedi",
      booking: "külön mérve: module-config-check + shot-booking-form",
      email: "postafiók-szolgáltatás, nem oldal-szekció",
    };
    if (EXEMPT[id]) {
      console.log(`  – ${id}: kihagyva (${EXEMPT[id]})`);
      continue;
    }
    failures++;
    console.error(`  ✗ ${id}: NINCS renderelés-ellenőrzés és nincs indokolt kivétel sem.`);
    continue;
  }

  const data = { ...BASE, ...c.patch } as SiteData;
  const missing: string[] = [];
  for (const t of templateIds) {
    const recipe: Recipe = { template: t, skin: "", archetype: "", sections: [] };
    let html = "";
    try {
      html = renderSite(recipe, data, { phase: "live" });
    } catch (err) {
      missing.push(`${t}(hiba: ${(err as Error).message.slice(0, 40)})`);
      continue;
    }
    if (!html.includes(c.needle)) missing.push(t);
  }
  check(
    `${id}: a beállított érték megjelenik az oldalon`,
    missing.length === 0,
    missing.length ? `hiányzik ${missing.length}/${templateIds.length} sablonból: ${missing.slice(0, 4).join(", ")}` : undefined,
  );
}

if (failures) {
  console.error(
    `\n⛔ module-render-check: ${failures} modul beállítása NEM jut el az oldalra. ` +
      `Amit a tulaj beír és elment, annak látszania kell.`,
  );
  process.exit(1);
}
console.log("\n✅ module-render-check: minden felárazott modul beállítása eljut a renderelt oldalra.");
