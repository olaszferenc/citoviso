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
  /** Inner SVG markup (24×24 viewBox, stroke=currentColor outside). */
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
    icon: "<path d=\"M5 12.5a10 10 0 0 1 14 0\"/><path d=\"M8 15.5a5 5 0 0 1 8 0\"/><path d=\"M12 19h.01\"/>" },
  { id: "flat_tv", label: "Síkképernyős TV", category: "entertainment", scope: "both",
    icon: "<rect x=\"2.5\" y=\"4.5\" width=\"19\" height=\"12.5\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>" },
  { id: "streaming", label: "Netflix, streaming", category: "entertainment", scope: "both",
    icon: "<rect x=\"2.5\" y=\"4\" width=\"19\" height=\"13\" rx=\"2\"/><path d=\"m10.5 8 5 2.5-5 2.5z\"/><path d=\"M8 21h8\"/>" },
  { id: "game_console", label: "Játékkonzol", category: "entertainment", scope: "both",
    icon: "<path d=\"M7 9h10a5 5 0 0 1 4.6 3l.8 3.4A2.6 2.6 0 0 1 17.6 18L15 15.5H9L6.4 18A2.6 2.6 0 0 1 1.6 15.4L2.4 12A5 5 0 0 1 7 9z\"/><path d=\"M6.5 12v2.5M5.2 13.2h2.6\"/><circle cx=\"16.5\" cy=\"12.5\" r=\".9\" fill=\"currentColor\"/><circle cx=\"18.7\" cy=\"14.3\" r=\".9\" fill=\"currentColor\"/>" },
  { id: "speaker", label: "Hangfal, zenelejátszó", category: "entertainment", scope: "both",
    icon: "<rect x=\"7\" y=\"2.5\" width=\"10\" height=\"19\" rx=\"2.5\"/><circle cx=\"12\" cy=\"15\" r=\"3\"/><circle cx=\"12\" cy=\"6.5\" r=\"1.2\"/>" },
  { id: "board_games", label: "Társasjátékok", category: "entertainment", scope: "property",
    icon: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2.5\"/><circle cx=\"8\" cy=\"8\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"16\" cy=\"8\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"16\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"16\" cy=\"16\" r=\"1.2\" fill=\"currentColor\"/>" },
  { id: "books", label: "Könyvek, olvasósarok", category: "entertainment", scope: "property",
    icon: "<path d=\"M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z\"/><path d=\"M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5z\"/>" },
  { id: "full_kitchen", label: "Teljesen felszerelt konyha", category: "kitchen", scope: "both",
    icon: "<path d=\"M7 3v6a2 2 0 0 1-4 0V3M5 3v18\"/><path d=\"M16 3c-1.6 1-2.5 3-2.5 5.5S14.5 12 16 12v9\"/>" },
  { id: "kitchenette", label: "Konyhasarok", category: "kitchen", scope: "unit",
    icon: "<path d=\"M7 3v6a2 2 0 0 1-4 0V3M5 3v18\"/><path d=\"M16 3c-1.6 1-2.5 3-2.5 5.5S14.5 12 16 12v9\"/>" },
  { id: "fridge", label: "Hűtőszekrény", category: "kitchen", scope: "both",
    icon: "<rect x=\"5.5\" y=\"2.5\" width=\"13\" height=\"19\" rx=\"2\"/><path d=\"M5.5 9.5h13M8.5 5.5v2M8.5 12v3\"/>" },
  { id: "microwave", label: "Mikrohullámú sütő", category: "kitchen", scope: "both",
    icon: "<rect x=\"2.5\" y=\"5.5\" width=\"19\" height=\"13\" rx=\"2\"/><path d=\"M15 5.5v13\"/><rect x=\"5\" y=\"8.5\" width=\"7\" height=\"7\" rx=\"1\"/><circle cx=\"18\" cy=\"10\" r=\".8\" fill=\"currentColor\"/><path d=\"M17 14h2\"/>" },
  { id: "dishwasher", label: "Mosogatógép", category: "kitchen", scope: "both",
    icon: "<rect x=\"4\" y=\"2.5\" width=\"16\" height=\"19\" rx=\"2\"/><path d=\"M4 7h16\"/><circle cx=\"12\" cy=\"14.5\" r=\"4\"/><circle cx=\"7\" cy=\"4.8\" r=\".7\" fill=\"currentColor\"/>" },
  { id: "coffee_maker", label: "Kávéfőző", category: "kitchen", scope: "both",
    icon: "<path d=\"M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z\"/><path d=\"M17 9h2a2 2 0 0 1 0 4h-2\"/><path d=\"M8 2v2M12 2v2\"/>" },
  { id: "kettle", label: "Vízforraló", category: "kitchen", scope: "both",
    icon: "<path d=\"M6 10h11l1.5 10H6.5z\"/><path d=\"M17 11l3-2v4\"/><path d=\"M9 10V8a3 3 0 0 1 6 0v2\"/>" },
  { id: "breakfast", label: "Reggeli", category: "kitchen", scope: "property",
    icon: "<path d=\"M3 13h9a4.5 4.5 0 0 1-4.5 4.5H7.5A4.5 4.5 0 0 1 3 13z\"/><path d=\"M12 13h1.5a1.8 1.8 0 0 1 0 3.6H12\"/><path d=\"M6 10c0-1.2 1-1.6 1-2.8M9.5 10c0-1.2 1-1.6 1-2.8\"/><path d=\"M16 20c1.5-2.4 3.5-3.4 5.5-3.4-1 2.6-3 3.4-5.5 3.4z\"/><path d=\"M3 20h11\"/>" },
  { id: "restaurant", label: "Étterem a helyszínen", category: "kitchen", scope: "property",
    icon: "<path d=\"M6 3v7a2 2 0 0 0 2 2v9M8 3v6M10 3v6\"/><path d=\"M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 12 17 12v9\"/>" },
  { id: "bar", label: "Bár, drinkpult", category: "kitchen", scope: "property",
    icon: "<path d=\"M4 4h16l-8 8z\"/><path d=\"M12 12v7M8 19h8\"/><path d=\"M17 3l1.5 1.5\"/>" },
  { id: "grill", label: "Grillezési lehetőség", category: "kitchen", scope: "property",
    icon: "<path d=\"M4 6h16l-2.5 7h-11z\"/><path d=\"M8 13l-2 8M16 13l2 8M7 18h10\"/><path d=\"M10 3c0 1-1 1.3-1 2.3M14 3c0 1-1 1.3-1 2.3\"/>" },
  { id: "firepit", label: "Tűzrakóhely, bogrács", category: "kitchen", scope: "property",
    icon: "<path d=\"M12 14c-2-1.4-2.7-2.8-1.6-4.7.7-1.2 2.3-1.8 2.3-3.6 1.2 1.1 3 2.8 3 4.7S13.6 14 12 14z\"/><path d=\"M4 18h16\"/><path d=\"m6 21 3-3M18 21l-3-3\"/>" },
  { id: "wine_cellar", label: "Borkóstoló, pince", category: "kitchen", scope: "property",
    icon: "<path d=\"M8 3h8l-1 6a3 3 0 0 1-6 0z\"/><path d=\"M12 12v6M9 21h6\"/>" },
  { id: "private_bathroom", label: "Saját fürdőszoba", category: "comfort", scope: "unit",
    icon: "<path d=\"M4 12h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z\"/><path d=\"M12 12V8a2 2 0 0 1 4 0v1\"/><path d=\"M8 18v3M16 18v3\"/><circle cx=\"12\" cy=\"4\" r=\"0\" /><path d=\"M6 4h4M8 2v4\"/>" },
  { id: "shower", label: "Zuhanyzó", category: "comfort", scope: "unit",
    icon: "<path d=\"M5 21V8a4 4 0 0 1 8 0\"/><path d=\"M9 8h11\"/><path d=\"M17 8v3\"/><path d=\"M13 14h.01M16 14h.01M19 14h.01M13 18h.01M16 18h.01M19 18h.01\"/>" },
  { id: "bathtub", label: "Kád", category: "comfort", scope: "unit",
    icon: "<path d=\"M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z\"/><path d=\"M6 12V6a2 2 0 0 1 4 0\"/><path d=\"M5 19l-1 2M20 19l1 2\"/>" },
  { id: "hairdryer", label: "Hajszárító", category: "comfort", scope: "unit",
    icon: "<path d=\"M4 8a4 4 0 0 1 4-4h6l4 3v4l-4 3H8a4 4 0 0 1-4-4z\"/><path d=\"M10 14v5a2 2 0 0 0 4 0\"/><path d=\"M20 9h2M20 12h2\"/>" },
  { id: "linen", label: "Törölköző, ágynemű", category: "comfort", scope: "unit",
    icon: "<path d=\"M6 3h9a3 3 0 0 1 3 3v15H9a3 3 0 0 1-3-3z\"/><path d=\"M18 6a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3\"/><path d=\"M9 8h5M9 12h5\"/>" },
  { id: "air_conditioning", label: "Légkondicionáló", category: "comfort", scope: "both",
    icon: "<path d=\"M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M2 12h20\"/>" },
  { id: "heating", label: "Fűtés", category: "comfort", scope: "both",
    icon: "<path d=\"M6 4v16M10 4v16M14 4v16M18 4v16\"/><path d=\"M4 8h16M4 16h16\"/>" },
  { id: "fireplace", label: "Kandalló", category: "comfort", scope: "both",
    icon: "<path d=\"M3 21V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15\"/><path d=\"M7 21v-6h10v6\"/><path d=\"M12 13c-1.5-1-2-2-1.2-3.4.5-.9 1.7-1.3 1.7-2.6.9.8 2.2 2 2.2 3.4S13.2 13 12 13z\"/>" },
  { id: "pool", label: "Medence", category: "wellness", scope: "property",
    icon: "<path d=\"M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2\"/><path d=\"M2 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2\"/>" },
  { id: "heated_pool", label: "Fűtött medence", category: "wellness", scope: "property",
    icon: "<path d=\"M2 15c2 0 2 1.8 4 1.8S8 15 10 15s2 1.8 4 1.8S16 15 18 15s2 1.8 4 1.8\"/><path d=\"M2 20c2 0 2 1.8 4 1.8\"/><path d=\"M7 11c0-1.4 1.2-1.8 1.2-3.2M12 11c0-1.4 1.2-1.8 1.2-3.2M17 11c0-1.4 1.2-1.8 1.2-3.2\"/>" },
  { id: "jacuzzi", label: "Jacuzzi, pezsgőfürdő", category: "wellness", scope: "both",
    icon: "<path d=\"M3 12h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z\"/><path d=\"M7 12V8a2 2 0 0 1 4 0\"/><path d=\"M14 9c0-1 1-1.3 1-2.3M17 9c0-1 1-1.3 1-2.3\"/><path d=\"M6 20l-1 2M18 20l1 2\"/>" },
  { id: "sauna", label: "Szauna", category: "wellness", scope: "property",
    icon: "<path d=\"M4 21h16V10H4z\"/><path d=\"M4 14h16M8 21v-7M16 21v-7\"/><path d=\"M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5\"/>" },
  { id: "massage", label: "Masszázs", category: "wellness", scope: "property",
    icon: "<circle cx=\"9\" cy=\"6\" r=\"2.2\"/><path d=\"M4 20c0-4 2.5-7 5-7s5 3 5 7\"/><path d=\"M16 9c2 0 4 1.5 4 4s-2 4-4 4\"/>" },
  { id: "gym", label: "Fitneszterem", category: "wellness", scope: "property",
    icon: "<path d=\"M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8M3 11v2M21 11v2\"/>" },
  { id: "garden", label: "Kert", category: "outdoor", scope: "property",
    icon: "<path d=\"M11 21A8 8 0 0 1 4 13C4 8 8 4 13 4c5 0 7 3 7 3s-2 13-9 14z\"/><path d=\"M11 21c0-4 1-8 6-11\"/>" },
  { id: "terrace", label: "Terasz", category: "outdoor", scope: "both",
    icon: "<path d=\"M3 10h18l-2-5H5z\"/><path d=\"M6 10v11M18 10v11\"/><path d=\"M9 21v-5h6v5\"/>" },
  { id: "balcony", label: "Erkély", category: "outdoor", scope: "unit",
    icon: "<path d=\"M4 10h16v11H4z\"/><path d=\"M8 10v11M12 10v11M16 10v11M4 14h16\"/><path d=\"M7 6h10l-2-3H9z\"/>" },
  { id: "sun_lounger", label: "Napozóágy, kerti bútor", category: "outdoor", scope: "property",
    icon: "<path d=\"m3 15 12-4\"/><path d=\"M4 15h16l-1 4H5z\"/><path d=\"M14 11 12 6l4-1.5 2 5\"/>" },
  { id: "playground", label: "Játszótér", category: "outdoor", scope: "property",
    icon: "<path d=\"M4 21V7l8-4 8 4v14\"/><path d=\"M8 21v-6h3v6M15 12h3M16.5 12v9\"/><path d=\"M4 7h16\"/>" },
  { id: "panorama", label: "Panorámás kilátás", category: "outdoor", scope: "both",
    icon: "<path d=\"M3 20 9 9l4 6 2.5-3.5L21 20z\"/><circle cx=\"17\" cy=\"6\" r=\"2\"/>" },
  { id: "beach", label: "Tengerpart, homokos strand", category: "nature", scope: "property",
    icon: "<path d=\"M12 13V4\"/><path d=\"M12 4c-3.5 0-6.5 1.6-8 4h16c-1.5-2.4-4.5-4-8-4z\"/><path d=\"M2 19c1.6 0 1.6 1.4 3.2 1.4S6.8 19 8.4 19s1.6 1.4 3.2 1.4S13.2 19 14.8 19s1.6 1.4 3.2 1.4S19.6 19 22 19\"/><path d=\"M12 13c0 2-1 3.5-2.5 4.5\"/>" },
  { id: "waterfront", label: "Vízpart, tópart", category: "nature", scope: "property",
    icon: "<path d=\"M3 17c2 0 2.5 1.6 4.5 1.6S10 17 12 17s2.5 1.6 4.5 1.6S19 17 21 17\"/><path d=\"M3 21c2 0 2.5 1.4 4.5 1.4\"/><path d=\"m6 13 4-6 3 4 2-2.5L20 13z\"/>" },
  { id: "private_pier", label: "Saját stég", category: "nature", scope: "property",
    icon: "<path d=\"M3 10h13v4H3z\" opacity=\"0\"/><path d=\"M3 11h14M5 11v7M9 11v7M13 11v7\"/><path d=\"M17 11l4-3v6z\"/><path d=\"M2 20c1.5 0 1.5 1.2 3 1.2s1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2\"/>" },
  { id: "boat", label: "Csónak, kajak", category: "nature", scope: "property",
    icon: "<path d=\"M4 16h16l-2.5 4H6.5z\"/><path d=\"M12 16V4l6 8z\"/><path d=\"M9 16V9l-3 7\"/>" },
  { id: "fishing", label: "Horgászási lehetőség", category: "nature", scope: "property",
    icon: "<path d=\"M4 5l9 9\"/><path d=\"M13 14c2.5 0 4.5-1.6 4.5-3.5S15.5 7 13 7s-4.5 1.6-4.5 3.5S10.5 14 13 14z\"/><path d=\"m17.5 10.5 3-2v4z\"/><circle cx=\"10.5\" cy=\"9.5\" r=\".6\" fill=\"currentColor\"/>" },
  { id: "mountains", label: "Hegyvidéki környezet", category: "nature", scope: "property",
    icon: "<path d=\"m2 20 6.5-12 4 7 2.5-4L21 20z\"/><path d=\"m8.5 8 2.2 4h-4.4z\"/>" },
  { id: "hiking", label: "Túraútvonalak a közelben", category: "nature", scope: "property",
    icon: "<path d=\"M13 4.5a1.7 1.7 0 1 0 0-.1\"/><circle cx=\"13\" cy=\"4.2\" r=\"1.7\"/><path d=\"M11 21v-5l-2-2 1.5-5 3 2 2 1\"/><path d=\"M15 21l-1.5-6\"/><path d=\"M4 21h16\"/><path d=\"m7 15 2-1\"/>" },
  { id: "free_parking", label: "Ingyenes parkolás", category: "transport", scope: "property",
    icon: "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2.5\"/><path d=\"M9.5 16V8H13a2.5 2.5 0 0 1 0 5H9.5\"/>" },
  { id: "garage", label: "Zárt garázs", category: "transport", scope: "property",
    icon: "<path d=\"m3 10 9-6 9 6v11H3z\"/><path d=\"M7 21v-7h10v7\"/><path d=\"M7 17h10\"/>" },
  { id: "ev_charger", label: "Elektromos töltő", category: "transport", scope: "property",
    icon: "<rect x=\"4\" y=\"4\" width=\"12\" height=\"16\" rx=\"2\"/><path d=\"M16 9h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 1-3 0v-2\"/><path d=\"m10 8-2 4h3l-2 4\"/>" },
  { id: "bike_storage", label: "Kerékpártároló", category: "transport", scope: "property",
    icon: "<circle cx=\"6\" cy=\"17\" r=\"3\"/><circle cx=\"18\" cy=\"17\" r=\"3\"/><path d=\"M6 17 10 7h4l3 5M9 7h3\"/>" },
  { id: "bike_rental", label: "Kerékpárkölcsönzés", category: "transport", scope: "property",
    icon: "<circle cx=\"6\" cy=\"17\" r=\"3\"/><circle cx=\"18\" cy=\"17\" r=\"3\"/><path d=\"M6 17 10 7h4l3 5M9 7h3\"/>" },
  { id: "transfer", label: "Transzfer, reptéri átvétel", category: "transport", scope: "property",
    icon: "<path d=\"M4 17V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10\"/><path d=\"M4 12h13\"/><circle cx=\"7.5\" cy=\"18\" r=\"1.6\"/><circle cx=\"14.5\" cy=\"18\" r=\"1.6\"/><path d=\"m17 9 4 3-4 3\"/>" },
  { id: "pet_friendly", label: "Kisállatbarát", category: "family", scope: "both",
    icon: "<circle cx=\"6\" cy=\"11\" r=\"1.6\"/><circle cx=\"10\" cy=\"7.5\" r=\"1.6\"/><circle cx=\"14\" cy=\"7.5\" r=\"1.6\"/><circle cx=\"18\" cy=\"11\" r=\"1.6\"/><path d=\"M8.5 16c1-2 2-3 3.5-3s2.5 1 3.5 3c.8 1.7-.4 3.2-2 3.2H10.5c-1.6 0-2.8-1.5-2-3.2z\"/>" },
  { id: "family_friendly", label: "Családbarát", category: "family", scope: "property",
    icon: "<circle cx=\"12\" cy=\"5\" r=\"2\"/><path d=\"M12 7v7M8 21l4-7 4 7M6 11h12\"/>" },
  { id: "crib", label: "Kiságy", category: "family", scope: "unit",
    icon: "<path d=\"M3 7v13M21 7v13M3 20h18\"/><path d=\"M3 11h18\"/><path d=\"M7 11V7M11 11V7M15 11V7M19 11V7\"/>" },
  { id: "high_chair", label: "Etetőszék", category: "family", scope: "unit",
    icon: "<path d=\"M7 4h8v5H7z\"/><path d=\"M8 9v11M14 9v11M6 20h4M12 20h4\"/><path d=\"M7 13h8\"/>" },
  { id: "reception", label: "Recepció", category: "services", scope: "property",
    icon: "<path d=\"M3 20h18\"/><path d=\"M5 20v-6a7 7 0 0 1 14 0v6\"/><path d=\"M12 7V4M10.5 4h3\"/>" },
  { id: "self_checkin", label: "Önálló bejelentkezés, kulcsszéf", category: "services", scope: "property",
    icon: "<circle cx=\"8\" cy=\"8\" r=\"4\"/><path d=\"M11 11l9 9M17 17l2-2M15 15l1.5-1.5\"/>" },
  { id: "cleaning", label: "Takarítás", category: "services", scope: "both",
    icon: "<path d=\"m14 3 3 3-7 7-3-3z\"/><path d=\"M7 10 4 20l10-3\"/><path d=\"M17 6l2-2\"/>" },
  { id: "washer", label: "Mosógép", category: "services", scope: "both",
    icon: "<rect x=\"4\" y=\"2.5\" width=\"16\" height=\"19\" rx=\"2\"/><circle cx=\"12\" cy=\"14\" r=\"4.5\"/><circle cx=\"12\" cy=\"14\" r=\"1.8\"/><circle cx=\"7.5\" cy=\"5.5\" r=\".8\" fill=\"currentColor\"/><path d=\"M4 8.5h16\"/>" },
  { id: "dryer", label: "Szárítógép", category: "services", scope: "both",
    icon: "<rect x=\"4\" y=\"2.5\" width=\"16\" height=\"19\" rx=\"2\"/><circle cx=\"12\" cy=\"14\" r=\"4.5\"/><path d=\"M10 14c.6-1 1.4-1 2 0s1.4 1 2 0\"/><path d=\"M4 8.5h16\"/><circle cx=\"7.5\" cy=\"5.5\" r=\".8\" fill=\"currentColor\"/>" },
  { id: "iron", label: "Vasaló", category: "services", scope: "both",
    icon: "<path d=\"M3 17h18a7 7 0 0 0-7-7H8a5 5 0 0 0-5 5z\"/><path d=\"M8 10V8a2 2 0 0 1 2-2h6\"/><path d=\"M3 20h18\"/>" },
  { id: "luggage_storage", label: "Csomagmegőrzés", category: "services", scope: "property",
    icon: "<rect x=\"6\" y=\"7\" width=\"12\" height=\"13\" rx=\"2\"/><path d=\"M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M10 11v6M14 11v6\"/>" },
  { id: "elevator", label: "Lift", category: "services", scope: "property",
    icon: "<rect x=\"4\" y=\"2.5\" width=\"16\" height=\"19\" rx=\"2\"/><path d=\"m9 9 1.5-2L12 9M15 15l-1.5 2L12 15\"/><path d=\"M12 4v16\" opacity=\"0\"/>" },
  { id: "accessible", label: "Akadálymentes", category: "services", scope: "both",
    icon: "<circle cx=\"12\" cy=\"4.5\" r=\"1.8\"/><path d=\"M9 8h6l-1 5h-3\"/><circle cx=\"12\" cy=\"16\" r=\"5.2\"/><path d=\"M12 16h4\"/>" },
  { id: "safe", label: "Széf", category: "services", scope: "both",
    icon: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"11\" cy=\"12\" r=\"3.5\"/><path d=\"M11 12h2.5M18 9v6\"/>" },
  { id: "non_smoking", label: "Nemdohányzó", category: "services", scope: "both",
    icon: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M5.6 18.4 18.4 5.6\"/><path d=\"M6 12h9M17 12h1.5\"/>" },
  { id: "workspace", label: "Munkasarok, íróasztal", category: "work", scope: "both",
    icon: "<path d=\"M3 8h18\"/><path d=\"M4 8v12M20 8v12\"/><path d=\"M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2\"/><path d=\"M8 12h5M8 15h3\"/>" },
  { id: "conference", label: "Rendezvény-, konferenciaterem", category: "work", scope: "property",
    icon: "<circle cx=\"8\" cy=\"8\" r=\"2.4\"/><circle cx=\"16\" cy=\"8\" r=\"2.4\"/><path d=\"M3 19c0-3 2.2-5 5-5s5 2 5 5M13 19c0-3 2.2-5 5-5s3 1.4 3 3.5V19\"/>" },
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
