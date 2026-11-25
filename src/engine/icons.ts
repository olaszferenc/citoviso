// Inline SVG icon set (design doctrine §B.4: icons are SVG, NEVER emoji). A small, 1-color,
// stroke-based library + a Hungarian keyword matcher, so an amenity label ("Ingyenes parkolás")
// maps to a fitting decorative icon. The icon is a DECORATIVE marker, not a fabricated fact —
// it dresses the real highlight text. Unknown labels fall back to a neutral check mark.

const PATHS: Readonly<Record<string, string>> = {
  check: `<path d="M20 6 9 17l-5-5"/>`,
  dot: `<circle cx="12" cy="12" r="2.6"/>`,
  parking: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.5 16V8H13a2.5 2.5 0 0 1 0 5H9.5"/>`,
  wifi: `<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8 15.5a5 5 0 0 1 8 0"/><path d="M12 19h.01"/>`,
  coffee: `<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2"/><path d="M8 2v2M12 2v2"/>`,
  pet: `<circle cx="6" cy="11" r="1.6"/><circle cx="10" cy="7.5" r="1.6"/><circle cx="14" cy="7.5" r="1.6"/><circle cx="18" cy="11" r="1.6"/><path d="M8.5 16c1-2 2-3 3.5-3s2.5 1 3.5 3c.8 1.7-.4 3.2-2 3.2H10.5c-1.6 0-2.8-1.5-2-3.2z"/>`,
  garden: `<path d="M11 21A8 8 0 0 1 4 13C4 8 8 4 13 4c5 0 7 3 7 3s-2 13-9 14z"/><path d="M11 21c0-4 1-8 6-11"/>`,
  pool: `<path d="M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/><path d="M2 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/>`,
  view: `<path d="M3 20 9 9l4 6 2.5-3.5L21 20z"/><circle cx="17" cy="6" r="2"/>`,
  location: `<path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>`,
  key: `<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M17 17l2-2M15 15l1.5-1.5"/>`,
  bath: `<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M6 12V6a2 2 0 0 1 4 0"/><path d="M5 19l-1 2M20 19l1 2"/>`,
  ac: `<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M2 12h20"/>`,
  kitchen: `<path d="M7 3v6a2 2 0 0 1-4 0V3M5 3v18"/><path d="M16 3c-1.6 1-2.5 3-2.5 5.5S14.5 12 16 12v9"/>`,
  bed: `<path d="M3 12V7h18v5M3 12h18v6M3 12v6M21 18v2M3 18v2M6 12V9.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 12 9.5V12"/>`,
  phone: `<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`,
  wine: `<path d="M8 3h8l-1 6a3 3 0 0 1-6 0z"/><path d="M12 12v6M9 21h6"/>`,
  restaurant: `<path d="M6 3v7a2 2 0 0 0 2 2v9M8 3v6M10 3v6"/><path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 12 17 12v9"/>`,
  ev: `<rect x="4" y="4" width="12" height="16" rx="2"/><path d="M16 9h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 1-3 0v-2"/><path d="m10 8-2 4h3l-2 4"/>`,
  child: `<circle cx="12" cy="5" r="2"/><path d="M12 7v7M8 21l4-7 4 7M6 11h12"/>`,
  bike: `<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17 10 7h4l3 5M9 7h3"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
  luggage: `<rect x="6" y="7" width="12" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>`,
  fitness: `<path d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8M3 11v2M21 11v2"/>`,
  fire: `<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1.5 2.5 1.5 2.5S10 8 12 3z"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>`,
  spa: `<path d="M12 21c-4-3-7-6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4-3 7-7 10z"/>`,
  telescope: `<path d="m3 14 4-8 5 2-4 8z"/><path d="m12 8 6-3 2 3-6 3M9 16l3 5M13 15l4 6"/>`,
};

// Whole words only (owner 2026-11-25: „Kutyusokat” got a check mark, „Légkondicionálás” the dumbbell via
// „kondi”, „mosogatógéppel” a mountain via „tó”): `W(...)` anchors each stem at a letter boundary
// (Unicode-aware — JS \b treats ó/ő as non-word and split „mosogató|géppel”), the more specific rules
// come first, and a label nothing fits gets the neutral dot.
const W = (stems: string): RegExp => new RegExp(`(?<![\\p{L}])(?:${stems})`, "iu");
const WEND = (stems: string): RegExp => new RegExp(`(?<![\\p{L}])(?:${stems})(?![\\p{L}])`, "iu");
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [W("klíma|klima|légkond|legkond|padlófűt|padlofut|hőszivatty|hoszivatty"), "ac"],
  [W("kuty|kutyus|állat|allat|háziállat|haziallat|kedvenc|macsk"), "pet"],
  [W("kiságy|kisagy|etetőszék|etetoszek|gyerek|család|csalad|játsz|jatsz|bébi|bebi|baba|pancsol|homokozó|homokozo"), "child"],
  [W("parkol|garázs|garazs"), "parking"],
  [W("wifi|wi-fi|internet"), "wifi"],
  [W("e-?bike|e-?töltő|e-?tolto|elektromos autó|elektromosautó|töltőállomás|toltoallomas"), "ev"],
  [W("bicik|bicaj|bringa|kerékpár|kerekpar"), "bike"],
  [W("borbár|borbar|borvidék|borvidek|borkóstoló|borkostolo|szőlő|szolo|sommelier"), "wine"],
  [W("étterem|etterem|vacsora|bisztró|bisztro|gasztro|félpanzió|felpanzio"), "restaurant"],
  [W("reggeli|kávé|kave|büfé|bufe|teabár|teabar"), "coffee"],
  [W("konyh|mosogatógép|mosogatogep|főzőfülke|fozofulke|mikró|mikro|hűtő|huto"), "kitchen"],
  [W("fitnesz|fitness|edzőterem|edzoterem|konditerem|torna|jóga|joga"), "fitness"],
  [W("masszázs|masszazs|gyógy|gyogy|reuma|kúra|kura"), "spa"],
  [W("csillagvizsg|távcső|tavcso|planetár|planetar|obszervat"), "telescope"],
  [W("medence|úszómedence|uszomedence|jacuzzi|pezsgőfürdő|pezsgofurdo|dézsa|dezsa|szauna|wellness|termál|termal"), "pool"],
  [W("kály|kaly|kemence|tűz|tuz|kandalló|kandallo|bogrács|bogracs|grill|szalonnasüt"), "fire"],
  [W("napoz|napágy|napagy|erkély|erkely"), "sun"],
  [W("csomagmegőrz|csomagmegorz|poggyász|poggyasz|locker"), "luggage"],
  [W("éjjel-nappal|0-24|recepció|recepcio|check-?in|concierge"), "clock"],
  [W("stég|steg|vízpart|vizpart|panoráma|panorama|kilátás|kilatas|balaton|strand|vitorl"), "view"],
  [WEND("tó|tópart|hegy|hegyek"), "view"],
  [W("kert|udvar|terasz|pergol|természet|termeszet|erdő|erdo|hinta"), "garden"],
  [W("fürdő|furdo|zuhany|kád|kad|fürdőköpeny|furdokopeny"), "bath"],
  [W("ágy|szoba|háló|matrac|ágynemű|agynemu|paplan"), "bed"],
  [WEND("agy|agyak|halo|haloszoba"), "bed"],
  [W("központ|kozpont|belváros|belvaros|közel|kozel|séta|seta|állomás|allomas"), "location"],
  [W("bejárat|bejarat|kulcs|önálló|onallo|privát|privat|széf|szef"), "key"],
];

/** Best-fit icon name for a Hungarian amenity label; a neutral dot if none matches (never a wrong icon). */
export function matchIcon(label: string): string {
  for (const [re, name] of RULES) if (re.test(label)) return name;
  return "dot";
}

/** Render a named icon as an inline SVG (currentColor stroke). */
export function iconSvg(name: string): string {
  const body = PATHS[name] ?? PATHS.check;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const STAR_PATH = `M12 2.2l2.95 6.4 6.85.75-5.15 4.6 1.5 6.75L12 17.8 5.9 21.3l1.5-6.75L2.25 9.95l6.85-.75z`;

/** A row of n FILLED star SVGs (doctrine §B.4: a star is an SVG, never the ★ emoji glyph). */
export function starRow(n = 5): string {
  const star = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
  return `<span class="cit-stars">${star.repeat(n)}</span>`;
}

/** A single FILLED star SVG — for the rating stat (doctrine-clean; never the ★ glyph). */
export function starIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
}
