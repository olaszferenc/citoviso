// Regression guard for the AMENITY PICKER (plan F, owner-approved 2026-08-26;
// frozen contract: assets/design-refs/tenant-admin/amenity-picker-f*.html).
//
// What it measures — the things that MATTER, not the convenient proxies:
//   * COMPOSE     — a forged/off-scope label is dropped, not stored; free text
//                   survives; the round-trip (split → compose) is lossless.
//   * RENDERED UI — the room card with the module active carries real,
//                   checkable tiles with the stored state CHECKED; the
//                   site-wide picks are present but NOT togglable (inherited);
//                   without the module the card shows the conversion panel and
//                   ZERO amenity inputs (an input there would post silently).
//   * ROUTE SHAPE — POST /admin/units/content is gated on the rooms module
//                   (the one unit-scoped save that had NO gate — found
//                   2026-08-26) and the amenity write on the amenities module;
//                   the untouched-when-absent rule protects stored data.
//   * SCOPE TABLE — property-only items never selectable on a unit, unit-only
//                   never on the property screen.
//
// Offline: renders view functions to strings, no DB, no browser. Fast.
//
// Run:  npx tsx scripts/amenity-picker-check.mts
//       npx tsx scripts/amenity-picker-check.mts --self-test   (must go RED)

import { readFileSync } from "node:fs";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

const { AMENITY_CATALOG, composeAmenities, splitAmenities } = await import(
  "../src/tenant/amenityCatalog.js"
);
const { moduleSettingsSection } = await import("../src/server/moduleConfigViews.js");

// ── 1. COMPOSE — the storage stays honest ───────────────────────────────────
{
  const out = composeAmenities(
    ["Medence", "Saját fürdőszoba", "Ilyen tétel nincs", "Medence"],
    "saját mólóhasználat\n\n  \nMedence",
    "unit",
  );
  ok(!out.includes("Medence"), "unit-mentés: a CSAK-szállás tétel (Medence) kiesik", out.join("|"));
  ok(out.includes("Saját fürdőszoba"), "unit-mentés: a szoba-tétel megmarad", out.join("|"));
  ok(!out.includes("Ilyen tétel nincs"), "hamisított címke nem tárolódik", out.join("|"));
  ok(out.includes("saját mólóhasználat"), "a szabad szöveg megmarad", out.join("|"));

  const prop = composeAmenities(["Saját fürdőszoba", "Medence"], "", "property");
  ok(
    !prop.includes("Saját fürdőszoba") && prop.includes("Medence"),
    "szállás-mentés: a CSAK-szoba tétel esik ki, a szállás-tétel marad",
    prop.join("|"),
  );

  // Round-trip: what split() reads, compose() writes back byte-identically.
  const stored = ["Ingyenes Wi‑Fi", "Reggeli", "kézműves lekvár a kamrából"];
  const s = splitAmenities(stored);
  const rt = composeAmenities(s.selected, s.other.join("\n"), "property");
  ok(
    JSON.stringify(rt) === JSON.stringify(stored),
    "split → compose kör veszteségmentes",
    `${JSON.stringify(stored)} → ${JSON.stringify(rt)}`,
  );
}

// ── 2. RENDERED UI — the room card, all three shapes ────────────────────────
const baseOpts = {
  lang: "hu",
  values: {},
  units: [
    {
      id: "u1",
      name: "Nádas apartman",
      capacity: 4,
      description: "Tóra néző.",
      slug: "nadas",
      amenities: ["Saját fürdőszoba", "Erkély", "kézműves lekvár"],
      photoCount: 1,
      photoUrls: [],
    },
    { id: "u2", name: "Kert apartman", capacity: 2, description: null, amenities: [], photoCount: 0, photoUrls: [] },
  ],
  photoLibrary: [],
};

const active = moduleSettingsSection("rooms", {
  ...baseOpts,
  unitAmenities: { active: !SELF_TEST, siteSelected: ["Medence", "Ingyenes Wi‑Fi"] },
} as never);

ok(/ampick__tile/.test(active), "aktív modul: a szoba-kártyán ikonos csempék vannak");
ok(
  /name="am" value="Saját fürdőszoba" checked/.test(active),
  "a tárolt állapot BEJELÖLVE érkezik",
  "a mentett tétel pipa nélkül = néma adatvesztés a következő mentésnél",
);
ok(/kézműves lekvár/.test(active), "a szabad szöveg az Egyéb mezőben van");
{
  // Inherited: present, labelled, and carries NO input — count both sides.
  const inheritedTiles = (active.match(/ampick__tile--inh/g) ?? []).length;
  ok(inheritedTiles >= 2, "az örökölt (szállás-szintű) tételek látszanak a szobánál", `talált: ${inheritedTiles}`);
  const inhBlock = active.slice(active.indexOf("ampick__tile--inh"), active.indexOf("ampick__tile--inh") + 400);
  ok(!/<input/.test(inhBlock), "az örökölt csempe NEM kapcsolható (nincs input)", inhBlock.slice(0, 120));
  ok(/az egész szállásra/.test(active), "az örökölt csempe meg is mondja, miért nem kapcsolható");
}
{
  // Scope on the RENDERED surface, not just in compose: property-only items must
  // not be offered on the room card (unless inherited), unit-only not on the site.
  const pool = 'value="Medence"';
  ok(!active.includes(pool), "CSAK-szállás tétel (Medence) nem választható a szobánál");
}

const locked = moduleSettingsSection("rooms", {
  ...baseOpts,
  unitAmenities: { active: false, siteSelected: [] },
} as never);
ok(/amlock/.test(locked), "modul nélkül: konverziós panel jelenik meg");
ok(
  !/name="am"|name="amenities_other"/.test(locked),
  "modul nélkül: NULLA felszereltség-input a kártyán",
  "egy ottfelejtett input némán postolna — a kapu a felületen kezdődik",
);
ok(/Felszereltség modul bekapcsolása/.test(locked), "a panel a modul-oldalra hív");

const site = moduleSettingsSection("amenities", {
  lang: "hu",
  values: { items: ["Medence", "Reggeli", "házi pálinka"] },
} as never);
ok(/ampick__tile/.test(site), "szállás-képernyő: a picker renderel");
ok(/name="am" value="Medence" checked/.test(site), "szállás-képernyő: tárolt tétel bejelölve");
ok(!/value="Saját fürdőszoba"/.test(site), "CSAK-szoba tétel (Saját fürdőszoba) nem választható a szálláson");
ok(/házi pálinka/.test(site), "szállás-képernyő: szabad szöveg az Egyéb mezőben");
ok(
  (site.match(/<form method="POST" action="\/admin\/module-config"/g) ?? []).length === 1,
  "szállás-képernyő: EGY űrlap (a generikus textarea nem duplázódik)",
);

// ── 3. ROUTE SHAPE — the gates exist where the writes happen ────────────────
const route = readFileSync("src/server/public.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const from = route.indexOf('pathname === "/admin/units/content"');
// Slice up to the NEXT route — the first `return redirect` is the login guard
// and would cut the body before the gates it is supposed to measure.
const body = route.slice(from, route.indexOf('pathname === "/admin/prices/base"', from));
ok(
  /tenantHasModule\(session\.tenantId,\s*"rooms"\)/.test(body),
  "POST /admin/units/content: rooms-modul kapu a MŰVELETEN (nem csak a linken)",
  "a mért rés: a link rejtve volt, a közvetlen POST mégis írt",
);
ok(
  /tenantHasModule\(session\.tenantId,\s*"amenities"\)/.test(body),
  "POST /admin/units/content: a felszereltség-írás az amenities modulhoz kötve",
);
ok(
  /form\.has\("am"\)\s*\|\|\s*form\.has\("amenities_other"\)/.test(body),
  "hiányzó picker-mezők esetén a tárolt lista ÉRINTETLEN marad",
  "különben a locked-kártya mentése törölné a szoba felszereltségét",
);

// ── 4. CATALOGUE sanity ─────────────────────────────────────────────────────
ok(AMENITY_CATALOG.length === 70, "a katalógus 70 tételes", String(AMENITY_CATALOG.length));
ok(
  AMENITY_CATALOG.every((a) => a.icon.length > 10 && !a.icon.includes("<svg")),
  "minden tételnek saját BELSŐ SVG-je van (a keretet a kód adja)",
);
ok(
  new Set(AMENITY_CATALOG.map((a) => a.label)).size === 70,
  "nincs duplikált címke (a címke a tárolt érték ÉS az i18n-kulcs)",
);

if (SELF_TEST) {
  console.log(
    failed > 0
      ? `\n✓ ÖNTESZT: a rontás (aktív modul letiltva) ${failed} állítást megbuktatott — az őr MÉR.`
      : "\n✗ ÖNTESZT BUKOTT: a szándékos rontást az őr ÁTENGEDTE.",
  );
  process.exit(failed > 0 ? 0 : 1);
}
console.log(failed === 0 ? "\n✓ amenity-picker-check: PASS" : `\n✗ ${failed} bukott állítás`);
process.exit(failed === 0 ? 0 : 1);
