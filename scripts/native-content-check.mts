// ADR-0059 gate: one content type appears ONCE, in the template's native section.
//
// ① INVENTORY (gépi scan): renders all 16 art templates and MEASURES which content
//    types each one demonstrates in its own sections (rooms, selling-points, gallery,
//    reviews, faq, contact). Measured on output, never assumed — every guard that
//    trusted an assumption has lied before (ADR-0043, ADR-0044, ADR-0059).
// ② DEDUP gate: with full module data, no selling-point item may appear BOTH in the
//    shared leftover block and in the template's native section; the dead usp block
//    must stay dead; rooms render in at most one section; a base-only price table
//    that merely restates the room cards' price lines must not render.
// ③ Mock experience gates: sample rooms wear the lead's REAL photos ("Minta" alt),
//    and the booking slot is the clickable DEMO widget, never a static band.
// ④ RED self-test: the dup detector is exercised on a deliberately broken page and
//    must fail it (feedback: a guard that was never seen red proves nothing).
//
//   npx tsx scripts/native-content-check.mts

import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BARE: SiteData = {
  name: "Teszt Vendégház",
  tagline: "Teszt a tóparton",
  intro: "Teszt bevezető szöveg a vendégházról.",
  highlights: ["Zsúpfedeles borospince", "Csendes diófás kert"],
  photos: [
    { url: "https://img.example/egyedi-foto-1.jpg", alt: "kert", provenance: "portal" },
    { url: "https://img.example/egyedi-foto-2.jpg", alt: "szoba", provenance: "portal" },
    { url: "https://img.example/egyedi-foto-3.jpg", alt: "terasz", provenance: "portal" },
    { url: "https://img.example/egyedi-foto-4.jpg", alt: "udvar", provenance: "portal" },
    { url: "https://img.example/egyedi-foto-5.jpg", alt: "konyha", provenance: "portal" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
};

/** A tenant who bought and configured everything (the live/preview shape). */
const FULL: SiteData = {
  ...BARE,
  rooms: [
    { name: "Padlásszoba", capacity: "2 fő", price: "19 000 Ft / éj" },
    { name: "Kerti apartman", capacity: "4 fő", price: "27 000 Ft / éj" },
  ],
  amenities: ["Zárt kerékpártároló", "Fedett grillterasz"],
  usp: ["Kétperces séta a mólóig"],
  poi: ["Strand 2 km"],
  hours: { checkInFrom: "14:00", checkInTo: "", checkOutUntil: "10:00", note: "" },
  location: { showMap: true, approachNote: "A templomnál jobbra.", parkingNote: "" },
  newsletter: { title: "Hírlevél", subtitle: "Évente pár levél." },
  reviews: [{ quote: "Nagyon jó volt, visszatérünk.", author: "Anna" }],
  faqs: [{ q: "Mikortól lehet érkezni?", a: "14 órától." }],
  googleRating: { value: 4.9, count: 143, url: "https://example.com/reviews" },
  reviewForm: {},
} as SiteData;

const BASE_ONLY_PRICING = {
  currency: "HUF",
  unit: "per_night",
  note: "",
  units: [
    { name: "Padlásszoba", base: 19000 },
    { name: "Kerti apartman", base: 27000 },
  ],
} as NonNullable<SiteData["pricing"]>;

const SEASONAL_PRICING = {
  ...BASE_ONLY_PRICING,
  units: [
    {
      name: "Padlásszoba",
      base: 19000,
      seasons: [{ label: "Főszezon", from: "06-15", to: "08-31", amount: 24000 }],
    },
  ],
} as NonNullable<SiteData["pricing"]>;

const ids = Object.keys(TEMPLATES);
const recipe = (t: string): Recipe => ({ template: t, skin: "", archetype: "", sections: [] });

/** The shared leftover/checklist blocks (amenities + usp), or null when absent. */
function sharedAmenitiesBlock(html: string): string | null {
  const parts = [...html.matchAll(
    /<section class="cit-modsec" data-cit-module="(?:amenities|usp)">[\s\S]*?<\/section>/g,
  )].map((m) => m[0]);
  return parts.length ? parts.join("") : null;
}

/** ADR-0059 dup detector: an item inside the shared block must not ALSO appear outside it. */
function duplicatedItems(html: string, items: readonly string[]): string[] {
  const block = sharedAmenitiesBlock(html);
  if (!block) return [];
  let outside = html;
  for (const part of block.split("</section>").filter(Boolean)) {
    outside = outside.replace(part + "</section>", "");
  }
  return items.filter((i) => block.includes(escHtml(i)) && outside.includes(escHtml(i)));
}

// ── ④ RED self-test first: a detector never seen red proves nothing ──────────
console.log("Öntesztek (a detektor pirosra is jár):\n");
{
  const item = "Fedett grillterasz";
  const bad =
    `<html><body><p>${escHtml(item)}</p>` +
    `<section class="cit-modsec" data-cit-module="amenities"><li>${escHtml(item)}</li></section>` +
    `</body></html>`;
  const good =
    `<html><body><p>${escHtml(item)}</p>` +
    `<section class="cit-modsec" data-cit-module="amenities"><li>Valami más</li></section>` +
    `</body></html>`;
  check("a dup-detektor a szándékosan rontott oldalt ELKAPJA", duplicatedItems(bad, [item]).length === 1);
  check("a dup-detektor a jó oldalt átengedi", duplicatedItems(good, [item]).length === 0);
}

// ── ① inventory: what each template renders natively (measured) ──────────────
console.log(`\n① Tartalomtípus-leltár — ${ids.length} sablon natív szekciói (mérve, mock-fázis):\n`);
const CONTENT_TYPES = ["rooms", "selling-points", "gallery", "reviews", "faq", "contact"] as const;
const inventory: Record<string, string[]> = {};
for (const t of ids) {
  const html = renderSite(recipe(t), FULL, { phase: "mock" });
  const native: string[] = [];
  // rooms/selling-points/gallery/reviews come from the renderer's own measured stamp
  // (taken on the RAW template output, before the shared blocks were woven in).
  const stamp = /<body[^>]*data-cit-native="([^"]*)"/.exec(html)?.[1] ?? "";
  for (const s of stamp.split(" ").filter(Boolean)) native.push(s);
  if (FULL.faqs!.some((f) => html.includes(escHtml(f.q)))) native.push("faq");
  if (html.includes(escHtml(FULL.contact.email!))) native.push("contact");
  inventory[t] = native;
  const cells = CONTENT_TYPES.map((c) => (native.includes(c) ? "●" : "·")).join(" ");
  console.log(`  ${t.padEnd(14)} ${cells}   (${native.join(", ")})`);
}
console.log(`\n  oszlopok: ${CONTENT_TYPES.join(" | ")}`);
check(
  "minden sablon natívan renderel eladási pontokat (selling-points) — a beszövésnek van hova folynia",
  ids.every((t) => inventory[t]!.includes("selling-points")),
  ids.filter((t) => !inventory[t]!.includes("selling-points")),
);

// ── ② dedup gate on the LIVE shape (module data present) ─────────────────────
console.log("\n② Dedup-kapu — egy tartalomtípus EGYSZER (live-fázis, teljes modul-adat):\n");
{
  const sellingItems = [...FULL.usp!, ...FULL.amenities!];
  const dup: string[] = [];
  const uspBlock: string[] = [];
  const roomsTwice: string[] = [];
  const missing: string[] = [];
  for (const t of ids) {
    const html = renderSite(recipe(t), FULL, { phase: "live" });
    if (duplicatedItems(html, sellingItems).length) dup.push(t);
    // ADR-0061/§I: the usp anchor legitimately sits on the template's NATIVE
    // section now (that is what makes the module's toggle visible). What must not
    // happen is a SECOND, shared usp section repeating what the native one shows —
    // measured by duplicatedItems above, not by the anchor's existence.
    const uspSections = html.match(/<section class="cit-modsec" data-cit-module="usp">/g)?.length ?? 0;
    const nativeUsp = /<section[^>]*data-cit-module="usp"[^>]*>/.test(html);
    if (uspSections > 0 && nativeUsp && !duplicatedItems(html, sellingItems).length) {
      // leftover block alongside the native section is allowed ONLY for items the
      // native section could not fit; duplication is what the gate above catches.
    }
    if (uspSections > 1) uspBlock.push(t);
    const roomSections = html.match(/data-cit-module="rooms"/g)?.length ?? 0;
    if (roomSections > 1) roomsTwice.push(t);
    // The module promise (ADR-0044) must survive the weave: every item still reaches the page.
    if (!sellingItems.every((i) => html.includes(escHtml(i)))) missing.push(t);
  }
  check("⭐⭐ eladási pont sehol nem jelenik meg natívan ÉS közös blokkban is", dup.length === 0, dup);
  check("nincs KETTŐ közös usp-blokk (a natív szekció + legfeljebb egy maradék-blokk)", uspBlock.length === 0, uspBlock);
  check("a szobák legfeljebb EGY szekcióban jelennek meg", roomsTwice.length === 0, roomsTwice);
  check("⭐ a beszövés után is minden beírt tétel eléri az oldalt (ADR-0044 ígéret)", missing.length === 0, missing);
}

// ── ② unit-first pricing: the table must EARN its place ──────────────────────
console.log("\n② Ár-tábla unit-first szabály:\n");
{
  const restating: string[] = [];
  const seasonalGone: string[] = [];
  for (const t of ids) {
    const base = renderSite(recipe(t), { ...FULL, pricing: BASE_ONLY_PRICING } as SiteData, { phase: "live" });
    if (/data-cit-module="pricing"/.test(base)) restating.push(t);
    const seasonal = renderSite(recipe(t), { ...FULL, pricing: SEASONAL_PRICING } as SiteData, { phase: "live" });
    if (!/data-cit-module="pricing"/.test(seasonal)) seasonalGone.push(t);
  }
  check(
    "csak-alapáras tábla NEM renderel a kártya-árak mellé (ugyanaz a szám kétszer)",
    restating.length === 0,
    restating,
  );
  check("szezonos ártábla viszont renderel (többlet-információ)", seasonalGone.length === 0, seasonalGone);
}

// ── ③ mock experience: sample rooms wear REAL photos; booking is a demo widget ─
console.log("\n③④ Mock-élmény — mintaszoba valós fotóval, booking kipróbálható:\n");
{
  const noPhoto: string[] = [];
  const noDemo: string[] = [];
  const liveDemoLeak: string[] = [];
  for (const t of ids) {
    const mock = renderSite(recipe(t), BARE, { phase: "mock" });
    const stamp = /<body[^>]*data-cit-native="([^"]*)"/.exec(mock)?.[1] ?? "";
    // Templates with a native rooms section must dress the sample cards from the
    // lead's real photo set, labelled (alt prefix "Minta — "). A template whose room
    // treatment has no image slot at all (transit's departure board) owes nothing;
    // what is forbidden is an ICON PANEL (cit-fill) on a page that has real photos.
    const hasRoomImagery = mock.includes('alt="Minta — ');
    const hasEmptyFill = mock.includes('class="cit-fill"');
    if (stamp.includes("rooms") && !hasRoomImagery && hasEmptyFill) noPhoto.push(t);
    // ADR-0059 ④: the mock carries the hydratable DEMO widget (closing section).
    if (!/data-cit-variant="request"/.test(mock) || !/data-cit-demo="1"/.test(mock)) noDemo.push(t);
    // …and the demo flag must never leak onto a live render (mock-only experience).
    const live = renderSite(recipe(t), FULL, { phase: "live" });
    if (/data-cit-demo/.test(live)) liveDemoLeak.push(t);
  }
  check("⭐⭐ natív szobás sablonok mintaszobái a lead VALÓS fotóit viselik („Minta” alt)", noPhoto.length === 0, noPhoto);
  check("⭐⭐ a mock booking-slotja kipróbálható demó-widget (request + demo jelölés)", noDemo.length === 0, noDemo);
  check("a demó-jelölés élesre SOHA nem szivárog", liveDemoLeak.length === 0, liveDemoLeak);
}

// ── ADR-0061: a mock ALL-IN — minden modul natívan, jelölt minta-adattal ──────
console.log("\nADR-0061 — mock all-in modulok natívan; élesre semmi minta nem szivárog:\n");
{
  const SURFACES: [string, RegExp][] = [
    ["hours", /data-cit-module="hours"/],
    ["pricing", /data-cit-module="pricing"/],
    ["poi", /data-cit-module="poi"/],
    ["newsletter", /data-cit-module="newsletter"/],
    ["map", /data-cit-module="map"[^>]*data-cit-query="/],
    ["review-form", /data-cit-module="review-form"/],
  ];
  const missing: string[] = [];
  const unmarked: string[] = [];
  const leak: string[] = [];
  for (const t of ids) {
    // BARE has geo/address → the map has real data to feed on.
    const mock = renderSite(recipe(t), { ...BARE, geo: { lat: 46.88, lon: 17.55 } } as SiteData, {
      phase: "mock",
    });
    const absent = SURFACES.filter(([, re]) => !re.test(mock)).map(([n]) => n);
    if (absent.length) missing.push(`${t}(${absent.join(",")})`);
    // The §B.17 label lives ON the sampled sections (hours+pricing+poi at least).
    const pills = mock.match(/<span class="cit-modsec__minta"/g)?.length ?? 0;
    if (pills < 3) unmarked.push(`${t}(${pills})`);
    // The LIVE phase must carry NO sample fill at all: no pill, no demo form, and
    // none of the sample-only sections for a tenant who configured nothing.
    const live = renderSite(recipe(t), BARE, { phase: "live" });
    if (
      /<span class="cit-modsec__minta"/.test(live) ||
      /data-cit-demo/.test(live) ||
      /data-cit-module="(hours|pricing|poi|newsletter)"/.test(live)
    ) {
      leak.push(t);
    }
  }
  check("⭐⭐ a mockban MINDEN eladható modul natív felülete jelen van (all-in)", missing.length === 0, missing.slice(0, 6));
  check("a minta-adatú szekciók jelöltek (Minta-szalag a szekción)", unmarked.length === 0, unmarked.slice(0, 6));
  check("⭐⭐ élesre SEMMILYEN minta-kitöltés nem szivárog", leak.length === 0, leak);
}

// ── ADR-0062 KONVERZIÓS DRAMATURGIA — a fő motiváció kapuja ──────────────────
// Vágy előbb, konverzió a döntési ponton: a TELJES foglalási felület a lap alsó
// zónájában él (a galéria/ajánlat UTÁN a forrás-sorrendben); fent csak karcsú
// CTA-sáv, ami odaugrik. Egy funkció léte nem érv az elhelyezésére.
console.log("\nADR-0062 — konverziós dramaturgia (vágy előbb, konverzió a döntési ponton):\n");
{
  const topHeavy: string[] = [];
  const noBand: string[] = [];
  const staleAnchor: string[] = [];
  for (const t of ids) {
    const mock = renderSite(recipe(t), BARE, { phase: "mock" });
    const widgetAt = mock.indexOf('data-cit-variant="request"');
    const galleryAt = mock.indexOf('data-cit-module="gallery"');
    if (widgetAt < 0 || (galleryAt >= 0 && widgetAt < galleryAt)) topHeavy.push(t);
    // The template slot must be the slim jump-band, and every Foglalás button must
    // point at the decision-point section, not the band.
    if (!/data-cit-variant="cta"/.test(mock) || !mock.includes('href="#cit-booking"')) noBand.push(t);
    if (mock.includes('href="#cit-enquiry"')) staleAnchor.push(t);
  }
  check(
    "⭐⭐ a TELJES foglalási felület a galéria/ajánlat UTÁN áll — sosem az első képernyőn",
    topHeavy.length === 0,
    topHeavy.slice(0, 6),
  );
  check("fent karcsú CTA-sáv él, ami a #cit-booking szekcióra ugrik", noBand.length === 0, noBand.slice(0, 6));
  check("nem maradt gomb, ami a sávra mutat a szekció helyett", staleAnchor.length === 0, staleAnchor.slice(0, 6));
}

if (failures) {
  console.error(`\n⛔ native-content-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ native-content-check: egy tartalomtípus egyszer, natív szekcióban; a mock-modul élmény.");
