// Guard: EVERY room reaches the guest page, on EVERY template — card, name and price.
//
// Why it exists: measured 2026-09-28 (price-where-check on kemences-vendeghaz): the
// `wordmark-grow` and `arch-frames` templates rendered `rooms.slice(0, 3)` — a 3-column mock
// layout that nobody revisited for a real tenant — so a 4th room vanished from the page with
// its photo and price, while the booking widget still offered it and the admin said "its card
// shows 19 000 Ft". No gate saw it: every fixture had three rooms or fewer.
//
// Renders each template with FIVE priced rooms (more than any grid's column count) and asserts
// that the rooms section (data-cit-module="rooms") carries every room's name AND price line.
// Pure render, no DB, no browser.
// Run: npx tsx scripts/rooms-all-shown-check.mts [--self-test]
//   --self-test feeds only the names of the first three rooms to the assertion's "expected"
//   side inverted (it demands the 4th/5th be ABSENT) → must go RED on a correct engine.

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) return;
  failed++;
  console.error(`✗ ${what}${detail ? `\n     ↳ ${detail}` : ""}`);
};

const ROOMS = [
  { name: "Nádas apartman", capacity: "4 fő", price: "24 000 Ft / éj" },
  { name: "Kisházi szoba", capacity: "2 fő", price: "16 000 Ft / éj" },
  { name: "Kerti stúdió", capacity: "3 fő", price: "19 000 Ft / éj" },
  { name: "Padlás lakosztály", capacity: "5 fő", price: "31 000 Ft / éj" },
  { name: "Tóparti faház", capacity: "2 fő", price: "21 500 Ft-tól / éj" },
];

const data: SiteData = {
  name: "Szobateszt Vendégház",
  tagline: "Öt szoba, egy udvar",
  intro: "Öt különböző szoba a falu szélén, közös kerttel és terasszal.",
  highlights: ["Kert", "Terasz", "Parkoló"],
  photos: [
    { url: "https://picsum.photos/seed/r1/1600/1000", alt: "A ház", provenance: "owner" },
    { url: "https://picsum.photos/seed/r2/1600/1000", alt: "A kert", provenance: "owner" },
    { url: "https://picsum.photos/seed/r3/1600/1000", alt: "A terasz", provenance: "owner" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "8000 Példafalu, Kert utca 1." },
  rooms: ROOMS,
  place: { city: "Példafalu", country: "HU" },
} as SiteData;

const sections: Recipe["sections"] = (
  ["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const
).map((kind) => ({ kind }));

const ids = Object.keys(TEMPLATES);
let measured = 0;
for (const id of ids) {
  const tpl = TEMPLATES[id]!;
  let html: string;
  try {
    html = renderSite(
      { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections } as Recipe,
      data,
      { phase: "live" },
    );
  } catch (e) {
    say(false, `${id}: a sablon renderel`, String(e));
    continue;
  }
  // ⛔ The anchor sits on a <section> in some templates and on a <div> in others (artdeco,
  // horizontal, organic…): a `<section`-only recognizer silently skipped 9 of 19 templates on its
  // first run (feedback_narrow_recognizer_is_a_false_green). Any element; the slice runs to the
  // NEXT module anchor, so another module's text cannot satisfy the assertion.
  const at = html.search(/<[a-z]+[^>]*data-cit-module="rooms"/);
  const next = at < 0 ? -1 : html.slice(at + 1).search(/data-cit-module="(?!rooms")/);
  const sec = at < 0 ? undefined : html.slice(at, next < 0 ? undefined : at + 1 + next);
  if (!sec) {
    console.log(`  · ${id}: nincs szoba-szekció (a sablon nem hordoz ilyet) — kihagyva, hangosan`);
    continue;
  }
  measured++;
  const text = sec.replace(/&nbsp;| /g, " ");
  const missing = ROOMS.filter((r, i) => {
    const present = text.includes(r.name) && text.includes(r.price);
    return SELF_TEST && i >= 3 ? present : !present;
  }).map((r) => r.name);
  say(missing.length === 0, `${id}: mind az öt szoba (név + ár) a szoba-szekcióban`, `hiányzik: ${missing.join(", ")}`);
}

if (measured === 0) {
  console.error("⛔ Egyetlen sablonnak sem volt szoba-szekciója — a mérés ÜRES.");
  process.exit(1);
}
if (failed) {
  console.error(`\n⛔ rooms-all-shown-check: ${failed} bukás (${measured} sablon mérve)`);
  process.exit(1);
}
console.log(`✅ rooms-all-shown-check: ${measured} sablon mindegyike mind az öt szobát kiírja, árral.`);
