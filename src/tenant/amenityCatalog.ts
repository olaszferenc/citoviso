// The standardised amenity catalogue — the owner's ONE list of selectable
// amenities, shared by the tenant-admin pickers (site-wide + per-unit).
//
// DESIGN CONTRACT: assets/design-refs/tenant-admin/amenity-picker-f*.html
// (owner-approved 2026-08-26: E's search+chips head over D's icon tiles;
// per-unit shows site-wide picks greyed and untogglable; missing module =
// conversion panel, not an error).
//
// STORAGE IS THE LABEL, NOT THE ID — deliberately. The existing channels
// (amenities module config 'items', site_unit.amenities) hold owner-worded
// Hungarian strings, and the multilang pipeline already translates site
// content. Storing the catalogue's Hungarian label keeps every existing row,
// the guest-site render and the translation path untouched; the id exists for
// code (icons, scope rules), never for persistence. The admin surface itself
// translates the label through T() — the label IS the i18n source key.
//
// Scope: where an amenity may be claimed. 'property' = the whole place
// (pool, pier, reception), 'unit' = one room only (own bathroom, balcony),
// 'both' = either level. The per-unit picker offers unit+both; site-wide
// picks appear there as inherited.

export type AmenityScope = "property" | "unit" | "both";

export interface AmenityCategory {
  readonly key: string;
  /** Hungarian source label — i18n key for T(). */
  readonly label: string;
}

export interface AmenityItem {
  readonly id: string;
  /** Hungarian source label — BOTH the stored value and the i18n key. */
  readonly label: string;
  readonly category: string;
  readonly scope: AmenityScope;
  /** Inner SVG markup (24×24 viewBox, stroke=currentColor outside) — Tabler Icons outline glyph
   *  (MIT, see src/engine/TABLER-LICENSE.txt). */
  readonly icon: string;
}

export const AMENITY_CATEGORIES: readonly AmenityCategory[] = [
  { key: "entertainment", label: "Internet, szórakozás" },
  { key: "kitchen", label: "Konyha, étkezés" },
  { key: "comfort", label: "Fürdőszoba, komfort" },
  { key: "wellness", label: "Wellness, sport" },
  { key: "outdoor", label: "Kültér, kert" },
  { key: "nature", label: "Víz, természet" },
  { key: "transport", label: "Parkolás, közlekedés" },
  { key: "family", label: "Család, kisállat" },
  { key: "services", label: "Szolgáltatás" },
  { key: "work", label: "Munka, rendezvény" },
];

export const AMENITY_CATALOG: readonly AmenityItem[] = [
  { id: "wifi", label: "Ingyenes Wi‑Fi", category: "entertainment", scope: "both",
    icon: "<path d=\"M12 18l.01 0\"/><path d=\"M9.172 15.172a4 4 0 0 1 5.656 0\"/><path d=\"M6.343 12.343a8 8 0 0 1 11.314 0\"/><path d=\"M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0\"/>" },
  { id: "flat_tv", label: "Síkképernyős TV", category: "entertainment", scope: "both",
    icon: "<path d=\"M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9\"/><path d=\"M16 3l-4 4l-4 -4\"/>" },
  { id: "streaming", label: "Netflix, streaming", category: "entertainment", scope: "both",
    icon: "<path d=\"M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12\"/><path d=\"M8 4l0 16\"/><path d=\"M16 4l0 16\"/><path d=\"M4 8l4 0\"/><path d=\"M4 16l4 0\"/><path d=\"M4 12l16 0\"/><path d=\"M16 8l4 0\"/><path d=\"M16 16l4 0\"/>" },
  { id: "game_console", label: "Játékkonzol", category: "entertainment", scope: "both",
    icon: "<path d=\"M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4\"/><path d=\"M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232\"/><path d=\"M8 9v2\"/><path d=\"M7 10h2\"/><path d=\"M14 10h2\"/>" },
  { id: "speaker", label: "Hangfal, zenelejátszó", category: "entertainment", scope: "both",
    icon: "<path d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\"/><path d=\"M9 14a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/><path d=\"M12 7l0 .01\"/>" },
  { id: "board_games", label: "Társasjátékok", category: "entertainment", scope: "property",
    icon: "<path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14\"/><path d=\"M8 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\"/><path d=\"M15 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\"/><path d=\"M15 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\"/><path d=\"M8 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\"/><path d=\"M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0\" fill=\"currentColor\"/>" },
  { id: "books", label: "Könyvek, olvasósarok", category: "entertainment", scope: "property",
    icon: "<path d=\"M5 5a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -14\"/><path d=\"M9 5a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -14\"/><path d=\"M5 8h4\"/><path d=\"M9 16h4\"/><path d=\"M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041\"/><path d=\"M14 9l4 -1\"/><path d=\"M16 16l3.923 -.98\"/>" },
  { id: "full_kitchen", label: "Teljesen felszerelt konyha", category: "kitchen", scope: "both",
    icon: "<path d=\"M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3\"/>" },
  { id: "kitchenette", label: "Konyhasarok", category: "kitchen", scope: "unit",
    icon: "<path d=\"M12 7h.01\"/><path d=\"M15 7h.01\"/><path d=\"M9 7h.01\"/><path d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\"/><path d=\"M9 15h6\"/><path d=\"M5 11h14\"/>" },
  { id: "fridge", label: "Hűtőszekrény", category: "kitchen", scope: "both",
    icon: "<path d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\"/><path d=\"M5 10h14\"/><path d=\"M9 13v3\"/><path d=\"M9 6v1\"/>" },
  { id: "microwave", label: "Mikrohullámú sütő", category: "kitchen", scope: "both",
    icon: "<path d=\"M3 7a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -10\"/><path d=\"M15 6v12\"/><path d=\"M18 12h.01\"/><path d=\"M18 15h.01\"/><path d=\"M18 9h.01\"/><path d=\"M6.5 10.5c1 -.667 1.5 -.667 2.5 0c.833 .347 1.667 .926 2.5 0\"/><path d=\"M6.5 13.5c1 -.667 1.5 -.667 2.5 0c.833 .347 1.667 .926 2.5 0\"/>" },
  { id: "dishwasher", label: "Mosogatógép", category: "kitchen", scope: "both",
    icon: "<path d=\"M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14\"/><path d=\"M8 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\"/><path d=\"M8 6h.01\"/><path d=\"M11 6h.01\"/><path d=\"M14 6h2\"/><path d=\"M8 14c1.333 -.667 2.667 -.667 4 0c1.333 .667 2.667 .667 4 0\"/>" },
  { id: "coffee_maker", label: "Kávéfőző", category: "kitchen", scope: "both",
    icon: "<path d=\"M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1\"/><path d=\"M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2\"/><path d=\"M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2\"/><path d=\"M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5\"/><path d=\"M16.746 16.726a3 3 0 1 0 .252 -5.555\"/>" },
  { id: "kettle", label: "Vízforraló", category: "kitchen", scope: "both",
    icon: "<path d=\"M10.29 3h3.42a2 2 0 0 1 1.988 1.78l1.555 14a2 2 0 0 1 -1.988 2.22h-6.53a2 2 0 0 1 -1.988 -2.22l1.555 -14a2 2 0 0 1 1.988 -1.78\"/><path d=\"M7.47 12.5l-4.257 -5.019a.899 .899 0 0 1 .69 -1.481h13.09a3 3 0 0 1 3.007 3v3c0 1.657 -1.346 3 -3.007 3\"/><path d=\"M7 17h10\"/>" },
  { id: "breakfast", label: "Reggeli", category: "kitchen", scope: "property",
    icon: "<path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/><path d=\"M14 3a5 5 0 0 1 4.872 6.13a3 3 0 0 1 .178 5.681a3 3 0 1 1 -4.684 3.626a5 5 0 1 1 -8.662 -5a5 5 0 1 1 4.645 -8.856a4.982 4.982 0 0 1 3.651 -1.585l0 .004\"/>" },
  { id: "restaurant", label: "Étterem a helyszínen", category: "kitchen", scope: "property",
    icon: "<path d=\"M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723l0 7.126h-12v-7.126a4 4 0 1 1 2.092 -7.723a4 4 0 0 1 3.908 -3.151\"/><path d=\"M6.161 17.009l11.839 -.009\"/>" },
  { id: "bar", label: "Bár, drinkpult", category: "kitchen", scope: "property",
    icon: "<path d=\"M8 21h8\"/><path d=\"M12 15v6\"/><path d=\"M5 5a7 2 0 1 0 14 0a7 2 0 1 0 -14 0\"/><path d=\"M5 5v.388c0 .432 .126 .853 .362 1.206l5 7.509c.633 .951 1.88 1.183 2.785 .517c.191 -.141 .358 -.316 .491 -.517l5 -7.509c.236 -.353 .362 -.774 .362 -1.206v-.388\"/>" },
  { id: "grill", label: "Grillezési lehetőség", category: "kitchen", scope: "property",
    icon: "<path d=\"M19 8h-14a6 6 0 0 0 6 6h2a6 6 0 0 0 6 -5.775l0 -.225\"/><path d=\"M17 20a2 2 0 1 1 0 -4a2 2 0 0 1 0 4\"/><path d=\"M15 14l1 2\"/><path d=\"M9 14l-3 6\"/><path d=\"M15 18h-8\"/><path d=\"M15 5v-1\"/><path d=\"M12 5v-1\"/><path d=\"M9 5v-1\"/>" },
  { id: "firepit", label: "Tűzrakóhely, bogrács", category: "kitchen", scope: "property",
    icon: "<path d=\"M4 21l16 -4\"/><path d=\"M20 21l-16 -4\"/><path d=\"M12 15a4 4 0 0 0 4 -4c0 -3 -2 -3 -2 -8c-4 2 -6 5 -6 8a4 4 0 0 0 4 4\"/>" },
  { id: "wine_cellar", label: "Borkóstoló, pince", category: "kitchen", scope: "property",
    icon: "<path d=\"M8 21l8 0\"/><path d=\"M12 15l0 6\"/><path d=\"M17 3l1 7c0 3.012 -2.686 5 -6 5s-6 -1.988 -6 -5l1 -7h10\"/><path d=\"M6 10a5 5 0 0 1 6 0a5 5 0 0 0 6 0\"/>" },
  { id: "private_bathroom", label: "Saját fürdőszoba", category: "comfort", scope: "unit",
    icon: "<path d=\"M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1\"/><path d=\"M6 12v-7a2 2 0 0 1 2 -2h3v2.25\"/><path d=\"M4 21l1 -1.5\"/><path d=\"M20 21l-1 -1.5\"/>" },
  { id: "shower", label: "Zuhanyzó", category: "comfort", scope: "unit",
    icon: "<path d=\"M4.072 20.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798\"/><path d=\"M16.072 20.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798\"/><path d=\"M10.072 10.3a2.999 2.999 0 0 0 3.856 0a3.002 3.002 0 0 0 .67 -3.798l-2.095 -3.227a.6 .6 0 0 0 -1.005 0l-2.098 3.227a3.003 3.003 0 0 0 .671 3.798l.001 0\"/>" },
  { id: "bathtub", label: "Kád", category: "comfort", scope: "unit",
    icon: "<path d=\"M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1\"/><path d=\"M6 12v-7a2 2 0 0 1 2 -2h3v2.25\"/><path d=\"M4 21l1 -1.5\"/><path d=\"M20 21l-1 -1.5\"/>" },
  { id: "hairdryer", label: "Hajszárító", category: "comfort", scope: "unit",
    icon: "<path d=\"M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24\"/><path d=\"M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24\"/><path d=\"M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24\"/>" },
  { id: "linen", label: "Törölköző, ágynemű", category: "comfort", scope: "unit",
    icon: "<path d=\"M3 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M10 13h11v-2a3 3 0 0 0 -3 -3h-8v5\"/><path d=\"M3 16h18\"/>" },
  { id: "air_conditioning", label: "Légkondicionáló", category: "comfort", scope: "both",
    icon: "<path d=\"M8 16a3 3 0 0 1 -3 3\"/><path d=\"M16 16a3 3 0 0 0 3 3\"/><path d=\"M12 16v4\"/><path d=\"M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4\"/><path d=\"M7 13v-3a1 1 0 0 1 1 -1h8a1 1 0 0 1 1 1v3\"/>" },
  { id: "heating", label: "Fűtés", category: "comfort", scope: "both",
    icon: "<path d=\"M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5\"/><path d=\"M10 9l4 0\"/>" },
  { id: "fireplace", label: "Kandalló", category: "comfort", scope: "both",
    icon: "<path d=\"M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235\"/>" },
  { id: "pool", label: "Medence", category: "wellness", scope: "property",
    icon: "<path d=\"M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1\"/><path d=\"M2 16a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1\"/><path d=\"M15 12v-7.5a1.5 1.5 0 0 1 3 0\"/><path d=\"M9 12v-7.5a1.5 1.5 0 0 0 -3 0\"/><path d=\"M15 5l-6 0\"/><path d=\"M9 10l6 0\"/>" },
  { id: "heated_pool", label: "Fűtött medence", category: "wellness", scope: "property",
    icon: "<path d=\"M15 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/><path d=\"M6 11l4 -2l3.5 3l-1.5 2\"/><path d=\"M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25\"/>" },
  { id: "jacuzzi", label: "Jacuzzi, pezsgőfürdő", category: "wellness", scope: "both",
    icon: "<path d=\"M12.4 3a5.34 5.34 0 0 1 4.906 3.239a5.333 5.333 0 0 1 -1.195 10.6a4.26 4.26 0 0 1 -5.28 1.863l-3.831 2.298v-3.134a2.668 2.668 0 0 1 -1.795 -3.773a4.8 4.8 0 0 1 2.908 -8.933a5.33 5.33 0 0 1 4.287 -2.16\"/>" },
  { id: "sauna", label: "Szauna", category: "wellness", scope: "property",
    icon: "<path d=\"M8 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5\"/><path d=\"M8 9l4 0\"/><path d=\"M16 9l6 0\"/><path d=\"M19 6l0 6\"/>" },
  { id: "massage", label: "Masszázs", category: "wellness", scope: "property",
    icon: "<path d=\"M3 17a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/><path d=\"M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/><path d=\"M4 22l4 -2v-3h12\"/><path d=\"M11 20h9\"/><path d=\"M8 14l3 -2l1 -4c3 1 3 4 3 6\"/>" },
  { id: "gym", label: "Fitneszterem", category: "wellness", scope: "property",
    icon: "<path d=\"M2 12h1\"/><path d=\"M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2\"/><path d=\"M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1\"/><path d=\"M9 12h6\"/><path d=\"M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1\"/><path d=\"M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2\"/><path d=\"M22 12h-1\"/>" },
  { id: "garden", label: "Kert", category: "outdoor", scope: "property",
    icon: "<path d=\"M2 9a10 10 0 1 0 20 0\"/><path d=\"M12 19a10 10 0 0 1 10 -10\"/><path d=\"M2 9a10 10 0 0 1 10 10\"/><path d=\"M12 4a9.7 9.7 0 0 1 2.99 7.5\"/><path d=\"M9.01 11.5a9.7 9.7 0 0 1 2.99 -7.5\"/>" },
  { id: "terrace", label: "Terasz", category: "outdoor", scope: "both",
    icon: "<path d=\"M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2\"/><path d=\"M5 11v-5a3 3 0 0 1 3 -3h8a3 3 0 0 1 3 3v5\"/><path d=\"M6 19v2\"/><path d=\"M18 19v2\"/>" },
  { id: "balcony", label: "Erkély", category: "outdoor", scope: "unit",
    icon: "<path d=\"M12 3c-3.866 0 -7 3.272 -7 7v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-10c0 -3.728 -3.134 -7 -7 -7\"/><path d=\"M5 13l14 0\"/><path d=\"M12 3l0 18\"/>" },
  { id: "sun_lounger", label: "Napozóágy, kerti bútor", category: "outdoor", scope: "property",
    icon: "<path d=\"M4 12a8 8 0 0 1 16 0l-16 0\"/><path d=\"M12 12v6a2 2 0 0 0 4 0\"/>" },
  { id: "playground", label: "Játszótér", category: "outdoor", scope: "property",
    icon: "<path d=\"M3 21v-15l5 -3l5 3v15\"/><path d=\"M8 21v-7\"/><path d=\"M3 14h10\"/><path d=\"M6 10a2 2 0 1 1 4 0\"/><path d=\"M13 13c6 0 3 8 8 8\"/>" },
  { id: "panorama", label: "Panorámás kilátás", category: "outdoor", scope: "both",
    icon: "<path d=\"M4.338 5.53c5.106 1.932 10.211 1.932 15.317 0a1 1 0 0 1 1.345 .934v11c0 .692 -.692 1.2 -1.34 .962c-5.107 -1.932 -10.214 -1.932 -15.321 0c-.648 .246 -1.339 -.242 -1.339 -.935v-11.027a1 1 0 0 1 1.338 -.935l0 .001\"/>" },
  { id: "beach", label: "Tengerpart, homokos strand", category: "nature", scope: "property",
    icon: "<path d=\"M17.553 16.75a7.5 7.5 0 0 0 -10.606 0\"/><path d=\"M18 3.804a6 6 0 0 0 -8.196 2.196l10.392 6a6 6 0 0 0 -2.196 -8.196\"/><path d=\"M16.732 10c1.658 -2.87 2.225 -5.644 1.268 -6.196c-.957 -.552 -3.075 1.326 -4.732 4.196\"/><path d=\"M15 9l-3 5.196\"/><path d=\"M3 19.25a2.4 2.4 0 0 1 1 -.25a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 1 .25\"/>" },
  { id: "waterfront", label: "Vízpart, tópart", category: "nature", scope: "property",
    icon: "<path d=\"M3 7c3 -2 6 -2 9 0s6 2 9 0\"/><path d=\"M3 17c3 -2 6 -2 9 0s6 2 9 0\"/><path d=\"M3 12c3 -2 6 -2 9 0s6 2 9 0\"/>" },
  { id: "private_pier", label: "Saját stég", category: "nature", scope: "property",
    icon: "<path d=\"M12 9v12m-8 -8a8 8 0 0 0 16 0m1 0h-2m-14 0h-2\"/><path d=\"M9 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/>" },
  { id: "boat", label: "Csónak, kajak", category: "nature", scope: "property",
    icon: "<path d=\"M6.414 6.414a2 2 0 0 0 0 -2.828l-1.414 -1.414l-2.828 2.828l1.414 1.414a2 2 0 0 0 2.828 0\"/><path d=\"M17.586 17.586a2 2 0 0 0 0 2.828l1.414 1.414l2.828 -2.828l-1.414 -1.414a2 2 0 0 0 -2.828 0\"/><path d=\"M6.5 6.5l11 11\"/><path d=\"M22 2.5c-9.983 2.601 -17.627 7.952 -20 19.5c9.983 -2.601 17.627 -7.952 20 -19.5\"/><path d=\"M6.5 12.5l5 5\"/><path d=\"M12.5 6.5l5 5\"/>" },
  { id: "fishing", label: "Horgászási lehetőség", category: "nature", scope: "property",
    icon: "<path d=\"M16 9v6a5 5 0 0 1 -10 0v-4l3 3\"/><path d=\"M14 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M16 5v-2\"/>" },
  { id: "mountains", label: "Hegyvidéki környezet", category: "nature", scope: "property",
    icon: "<path d=\"M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612\"/><path d=\"M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2\"/>" },
  { id: "hiking", label: "Túraútvonalak a közelben", category: "nature", scope: "property",
    icon: "<path d=\"M11 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\"/><path d=\"M7 21l2 -4\"/><path d=\"M13 21v-4l-3 -3l1 -6l3 4l3 2\"/><path d=\"M10 14l-1.827 -1.218a2 2 0 0 1 -.831 -2.15l.28 -1.117a2 2 0 0 1 1.939 -1.515h1.439l4 1l3 -2\"/><path d=\"M17 12v9\"/><path d=\"M16 20h2\"/>" },
  { id: "free_parking", label: "Ingyenes parkolás", category: "transport", scope: "property",
    icon: "<path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14\"/><path d=\"M10 16v-8h2.667c.736 0 1.333 .895 1.333 2s-.597 2 -1.333 2h-2.667\"/>" },
  { id: "garage", label: "Zárt garázs", category: "transport", scope: "property",
    icon: "<path d=\"M5 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\"/><path d=\"M15 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\"/><path d=\"M5 20h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5\"/><path d=\"M3 6l9 -4l9 4\"/>" },
  { id: "ev_charger", label: "Elektromos töltő", category: "transport", scope: "property",
    icon: "<path d=\"M18 7l-1 1\"/><path d=\"M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3\"/><path d=\"M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14\"/><path d=\"M9 11.5l-1.5 2.5h3l-1.5 2.5\"/><path d=\"M3 20l12 0\"/><path d=\"M4 8l10 0\"/>" },
  { id: "bike_storage", label: "Kerékpártároló", category: "transport", scope: "property",
    icon: "<path d=\"M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"/><path d=\"M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"/><path d=\"M12 19v-4l-3 -3l5 -4l2 3h3\"/><path d=\"M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/>" },
  { id: "bike_rental", label: "Kerékpárkölcsönzés", category: "transport", scope: "property",
    icon: "<path d=\"M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"/><path d=\"M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"/><path d=\"M12 19v-4l-3 -3l5 -4l2 3h3\"/><path d=\"M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/>" },
  { id: "transfer", label: "Transzfer, reptéri átvétel", category: "transport", scope: "property",
    icon: "<path d=\"M15.157 11.81l4.83 1.295a2 2 0 1 1 -1.036 3.863l-14.489 -3.882l-1.345 -6.572l2.898 .776l1.414 2.45l2.898 .776l-.12 -7.279l2.898 .777l2.052 7.797\"/><path d=\"M3 21h18\"/>" },
  { id: "pet_friendly", label: "Kisállatbarát", category: "family", scope: "both",
    icon: "<path d=\"M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538\"/><path d=\"M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0\"/><path d=\"M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267\"/><path d=\"M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267\"/><path d=\"M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082\"/>" },
  { id: "family_friendly", label: "Családbarát", category: "family", scope: "property",
    icon: "<path d=\"M5 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M5 22v-5l-1 -1v-4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4l-1 1v5\"/><path d=\"M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M15 22v-4h-2l2 -6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1l2 6h-2v4\"/>" },
  { id: "crib", label: "Kiságy", category: "family", scope: "unit",
    icon: "<path d=\"M6 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M16 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6\"/><path d=\"M6 9h14\"/><path d=\"M9 17l1 -3\"/><path d=\"M16 14l1 3\"/>" },
  { id: "high_chair", label: "Etetőszék", category: "family", scope: "unit",
    icon: "<path d=\"M5 10h14\"/><path d=\"M12 2v2\"/><path d=\"M12 4a5 5 0 0 1 5 5v11a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-11a5 5 0 0 1 5 -5\"/>" },
  { id: "reception", label: "Recepció", category: "services", scope: "property",
    icon: "<path d=\"M8.5 10a1.5 1.5 0 0 1 -1.5 -1.5a5.5 5.5 0 0 1 11 0v10.5a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-2c0 -1.38 .71 -2.444 1.88 -3.175l4.424 -2.765c1.055 -.66 1.696 -1.316 1.696 -2.56a2.5 2.5 0 1 0 -5 0a1.5 1.5 0 0 1 -1.5 1.5\"/>" },
  { id: "self_checkin", label: "Önálló bejelentkezés, kulcsszéf", category: "services", scope: "property",
    icon: "<path d=\"M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0\"/><path d=\"M15 9h.01\"/>" },
  { id: "cleaning", label: "Takarítás", category: "services", scope: "both",
    icon: "<path d=\"M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6\"/>" },
  { id: "washer", label: "Mosógép", category: "services", scope: "both",
    icon: "<path d=\"M3.486 8.965c.168 .02 .34 .033 .514 .035c.79 .009 1.539 -.178 2 -.5c.461 -.32 1.21 -.507 2 -.5c.79 -.007 1.539 .18 2 .5c.461 .322 1.21 .509 2 .5c.79 .009 1.539 -.178 2 -.5c.461 -.32 1.21 -.507 2 -.5c.79 -.007 1.539 .18 2 .5c.461 .322 1.21 .509 2 .5c.17 0 .339 -.014 .503 -.034\"/><path d=\"M3 6l1.721 10.329a2 2 0 0 0 1.973 1.671h10.612a2 2 0 0 0 1.973 -1.671l1.721 -10.329\"/>" },
  { id: "dryer", label: "Szárítógép", category: "services", scope: "both",
    icon: "<path d=\"M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12\"/><path d=\"M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0\"/>" },
  { id: "iron", label: "Vasaló", category: "services", scope: "both",
    icon: "<path d=\"M9 6h7.459a3 3 0 0 1 2.959 2.507l.577 3.464l.81 4.865a1 1 0 0 1 -.985 1.164h-16.82a7 7 0 0 1 7 -7h9.8\"/>" },
  { id: "luggage_storage", label: "Csomagmegőrzés", category: "services", scope: "property",
    icon: "<path d=\"M6 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -10\"/><path d=\"M9 6v-1a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1\"/><path d=\"M6 10h12\"/><path d=\"M6 16h12\"/><path d=\"M9 20v1\"/><path d=\"M15 20v1\"/>" },
  { id: "elevator", label: "Lift", category: "services", scope: "property",
    icon: "<path d=\"M5 5a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -14\"/><path d=\"M10 10l2 -2l2 2\"/><path d=\"M10 14l2 2l2 -2\"/>" },
  { id: "accessible", label: "Akadálymentes", category: "services", scope: "both",
    icon: "<path d=\"M3 16a5 5 0 1 0 10 0a5 5 0 1 0 -10 0\"/><path d=\"M17 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\"/><path d=\"M19 17a3 3 0 0 0 -3 -3h-3.4\"/><path d=\"M3 3h1a2 2 0 0 1 2 2v6\"/><path d=\"M6 8h11\"/><path d=\"M15 8v6\"/>" },
  { id: "safe", label: "Széf", category: "services", scope: "both",
    icon: "<path d=\"M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12\"/><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0\"/><path d=\"M9.75 9.75l-1.75 -1.75\"/><path d=\"M14.25 9.75l1.75 -1.75\"/><path d=\"M14.25 14.25l1.75 1.75\"/><path d=\"M9.75 14.25l-1.75 1.75\"/>" },
  { id: "non_smoking", label: "Nemdohányzó", category: "services", scope: "both",
    icon: "<path d=\"M8 13l0 4\"/><path d=\"M16 5v.5a2 2 0 0 0 2 2a2 2 0 0 1 2 2v.5\"/><path d=\"M3 3l18 18\"/><path d=\"M17 13h3a1 1 0 0 1 1 1v2c0 .28 -.115 .533 -.3 .714m-3.7 .286h-13a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1h9\"/>" },
  { id: "workspace", label: "Munkasarok, íróasztal", category: "work", scope: "both",
    icon: "<path d=\"M3 6h18\"/><path d=\"M4 6v13\"/><path d=\"M20 19v-13\"/><path d=\"M4 10h16\"/><path d=\"M15 6v8a2 2 0 0 0 2 2h3\"/>" },
  { id: "conference", label: "Rendezvény-, konferenciaterem", category: "work", scope: "property",
    icon: "<path d=\"M3 4l18 0\"/><path d=\"M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10\"/><path d=\"M12 16l0 4\"/><path d=\"M9 20l6 0\"/><path d=\"M8 12l3 -3l2 2l3 -3\"/>" },
];

const byLabel = new Map(AMENITY_CATALOG.map((a) => [a.label, a]));

/** Catalogue entry for a stored string, if it is a catalogue label. */
export function amenityByLabel(label: string): AmenityItem | undefined {
  return byLabel.get(label.trim());
}

/** Wrap the shared 24×24 outline frame around an item's inner markup. */
export function amenitySvg(item: AmenityItem, size = 20): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.icon}</svg>`
  );
}

/** Split a stored amenity list into catalogue picks and free-text extras. */
export function splitAmenities(stored: readonly string[]): {
  selected: string[];
  other: string[];
} {
  const selected: string[] = [];
  const other: string[] = [];
  for (const raw of stored) {
    const s = raw.trim();
    if (!s) continue;
    (byLabel.has(s) ? selected : other).push(s);
  }
  return { selected, other };
}

/** Compose the stored list back from a picker POST: checked catalogue labels
 *  (validated against the catalogue+scope — a forged label is dropped, not
 *  stored) followed by the free-text lines. */
export function composeAmenities(
  checked: readonly string[],
  otherText: string,
  scope: "property" | "unit",
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of checked) {
    const item = byLabel.get(c.trim());
    if (!item || seen.has(item.label)) continue;
    if (scope === "property" && item.scope === "unit") continue;
    if (scope === "unit" && item.scope === "property") continue;
    seen.add(item.label);
    out.push(item.label);
  }
  for (const line of otherText.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || seen.has(s)) continue;
    // A free line that IS a catalogue label obeys the same scope rule — without
    // this, typing "Medence" into a room's Egyéb box would smuggle a
    // property-only amenity past the picker (guard finding, 2026-08-26).
    const item = byLabel.get(s);
    if (item) {
      if (scope === "property" && item.scope === "unit") continue;
      if (scope === "unit" && item.scope === "property") continue;
    }
    seen.add(s);
    out.push(s);
  }
  return out;
}
