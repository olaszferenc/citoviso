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

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { ARCHETYPES } from "../src/engine/archetypes.js";
import { SKINS } from "../src/engine/skins.js";
import { SAMPLE_REVIEWS } from "../src/engine/primitives.js";
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
  // Prices hang off the UNIT (ADR-0044/c): the needle is the season label of a
  // specific room, so a flat table that lost the unit could not satisfy it.
  pricing: {
    patch: {
      pricing: {
        currency: "HUF",
        unit: "per_night",
        note: "Az ár tartalmazza az idegenforgalmi adót.",
        units: [
          {
            name: "Kertre néző apartman",
            base: 19000,
            seasons: [{ label: "Nyárközépi főszezon", from: "06-15", to: "08-31", amount: 28000 }],
          },
        ],
      },
    } as Partial<SiteData>,
    needle: "Nyárközépi főszezon",
  },
  // Gallery: what the owner controls is the ORDER (photos[0] is the cover in every
  // template) and how many appear. The needle is the FIRST photo's url, so a
  // template that ignored the order and picked some other image would fail here.
  gallery: {
    patch: {
      photos: [
        { url: "/uploads/valasztott-nyitokep.jpg", alt: "Nyitókép", provenance: "owner" },
        { url: "/uploads/masodik.jpg", alt: "Második", provenance: "owner" },
      ],
    } as Partial<SiteData>,
    needle: "/uploads/valasztott-nyitokep.jpg",
  },
  // The rooms module renders the owner's UNITS (site_unit) — no longer exempt.
  rooms: {
    patch: {
      rooms: [{ name: "Zsindelyes padlásszoba", capacity: "2 fő", price: "19 000 Ft / éj" }],
    } as Partial<SiteData>,
    needle: "Zsindelyes padlásszoba",
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
  // ADR-0046 — no longer exempt. The old exemption ("valós vélemény-adat kell hozzá")
  // described the DATA gap, not a reason the render could not be measured; once the
  // first-party layer existed the exemption was just a blind spot with a note on it.
  reviews: {
    patch: {
      reviews: [
        { quote: "A tornácon reggeliztünk, és senki nem sürgetett.", author: "Kovács Anna" },
      ],
    } as Partial<SiteData>,
    needle: "A tornácon reggeliztünk, és senki nem sürgetett.",
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

// ── ADR-0048: no invented guest quotes, on EITHER render path ───────────────
// What shipped: an empty review section was filled with SAMPLE_REVIEWS — three made-up
// quotes signed "Péter" and "a Kovács család", on a real business's page, directly under
// that business's real Google average (4,9 · 143). It read as three of those 143. The
// sample marker existed but sat ~1200 characters lower, off-screen while reading.
//
// Measured on BOTH paths deliberately: the fix first landed only in the 16 art templates,
// and all 11 composition archetypes were still fabricating. A guard that watches one path
// would have gone green on a half-done fix.
{
  const lead = {
    ...BASE,
    reviews: undefined,
    rating: { value: 4.9, count: 143 },
  } as unknown as SiteData;

  const fabricating: string[] = [];
  for (const t of templateIds) {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, lead, {
      phase: "mock",
    });
    if (SAMPLE_REVIEWS.some((r) => html.includes(r.quote))) fabricating.push(`template:${t}`);
  }
  const skin = Object.keys(SKINS)[0]!;
  for (const a of Object.keys(ARCHETYPES)) {
    const html = renderSite(
      { skin, archetype: a, sections: [{ kind: "hero" }, { kind: "reviews" }] },
      lead,
      { phase: "mock" },
    );
    if (SAMPLE_REVIEWS.some((r) => html.includes(r.quote))) fabricating.push(`archetype:${a}`);
  }
  check(
    "⭐⭐ KITALÁLT vendégvélemény sehol nem kerül ki (16 sablon + 11 archetípus)",
    fabricating.length === 0,
    fabricating.slice(0, 6),
  );

  // The honest replacement must actually be there — otherwise "no fabrication" could
  // be won by simply deleting the section, and the module would vanish from the mock.
  const missingHonest = templateIds.filter((t) => {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, lead, {
      phase: "mock",
    });
    return !html.includes('data-cit-module="reviews-pending"') || !html.includes("143");
  });
  check(
    "helyette a VALÓS Google-szám + őszinte mondat áll ott",
    missingHonest.length === 0,
    missingHonest.slice(0, 5),
  );
}

// The rooms fallback must never DOUBLE-print: 9 templates render the units
// themselves, 7 do not, and the shared block fills only the gap. A duplicated room
// list would look like a bug to the guest and to the owner.
{
  const data = { ...BASE, ...CASES.rooms!.patch } as SiteData;
  const dupes: string[] = [];
  for (const t of templateIds) {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, data, {
      phase: "live",
    });
    const anchors = html.split('data-cit-module="rooms"').length - 1;
    const names = html.split(CASES.rooms!.needle).length - 1;
    if (anchors > 1 || names > 2) dupes.push(`${t}(horgony:${anchors}, név:${names})`);
  }
  check(
    "a szoba-lista nem jelenik meg kétszer egyik sablonban sem",
    dupes.length === 0,
    dupes.slice(0, 4).join(", "),
  );
}

// ── ADR-0058: a missing photo is a DESIGNED fill, never an empty grey box ────
// Owner report 2026-08-23: photoless sample-room cards showed empty boxes, and expired
// Google Places URLs surfaced as the alt text ("N. kép") — bare numbers at the gallery.
{
  // (a) Source rule: any template that renders its OWN room image slot (`r.photo`) must
  // also theme the empty case with photoFill — otherwise it falls back to an empty box.
  const dir = path.join(path.resolve(import.meta.dirname, ".."), "src/engine/templates");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".ts"));
  const emptyBox: string[] = [];
  for (const f of files) {
    const src = await readFile(path.join(dir, f), "utf8");
    if (src.includes("r.photo") && !src.includes("photoFill(")) emptyBox.push(f.replace(/\.ts$/, ""));
  }
  check(
    "⭐⭐ üres szoba-kép SEHOL — a fotó nélküli slot dizájnos kitöltést kap (photoFill)",
    emptyBox.length === 0,
    emptyBox.slice(0, 6),
  );

  // (b) Render rule: every page ships the broken-image runtime, so a dead photo URL is
  // swapped for the designed fill instead of showing the alt text (the "1,2,3,4" bug).
  const noRuntime = templateIds.filter((t) => {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, BASE, {
      phase: "mock",
    });
    return !html.includes("data-cit-filled");
  });
  check(
    "⭐⭐ minden oldal viszi a törött-kép futásidejű kitöltőt (nincs alt-szám a galériában)",
    noRuntime.length === 0,
    noRuntime.slice(0, 6),
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
