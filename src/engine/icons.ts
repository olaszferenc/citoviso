// Inline SVG icon set (design doctrine §B.4: icons are SVG, NEVER emoji). A small, 1-color,
// stroke-based library + a Hungarian keyword matcher, so an amenity label ("Ingyenes parkolás")
// maps to a fitting decorative icon. The icon is a DECORATIVE marker, not a fabricated fact —
// it dresses the real highlight text. Unknown labels fall back to a neutral check mark.
// Glyphs: Tabler Icons outline set (MIT, https://tabler.io/icons — see TABLER-LICENSE.txt), vendored
// as inner markup and drawn at our 1.7 stroke; the trailing comment names the Tabler icon.

const PATHS: Readonly<Record<string, string>> = {
  check: `<path d="M5 12l5 5l10 -10"/>`, // check
  dot: `<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/>`, // point
  parking: `<path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14"/><path d="M10 16v-8h2.667c.736 0 1.333 .895 1.333 2s-.597 2 -1.333 2h-2.667"/>`, // parking
  wifi: `<path d="M12 18l.01 0"/><path d="M9.172 15.172a4 4 0 0 1 5.656 0"/><path d="M6.343 12.343a8 8 0 0 1 11.314 0"/><path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0"/>`, // wifi
  coffee: `<path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1"/><path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5"/><path d="M16.746 16.726a3 3 0 1 0 .252 -5.555"/>`, // coffee
  pet: `<path d="M11 5h2"/><path d="M19 12c-.667 5.333 -2.333 8 -5 8h-4c-2.667 0 -4.333 -2.667 -5 -8"/><path d="M11 16c0 .667 .333 1 1 1s1 -.333 1 -1h-2"/><path d="M12 18v2"/><path d="M10 11v.01"/><path d="M14 11v.01"/><path d="M5 4l6 .97l-6.238 6.688a1.021 1.021 0 0 1 -1.41 .111a.953 .953 0 0 1 -.327 -.954l1.975 -6.815"/><path d="M19 4l-6 .97l6.238 6.688c.358 .408 .989 .458 1.41 .111a.953 .953 0 0 0 .327 -.954l-1.975 -6.815"/>`, // dog
  garden: `<path d="M16 5l3 3l-2 1l4 4l-3 1l4 4h-9"/><path d="M15 21l0 -3"/><path d="M8 13l-2 -2"/><path d="M8 12l2 -2"/><path d="M8 21v-13"/><path d="M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4l-.176 -.005"/>`, // trees
  pool: `<path d="M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1"/><path d="M2 16a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1"/><path d="M15 12v-7.5a1.5 1.5 0 0 1 3 0"/><path d="M9 12v-7.5a1.5 1.5 0 0 0 -3 0"/><path d="M15 5l-6 0"/><path d="M9 10l6 0"/>`, // pool
  view: `<path d="M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612"/><path d="M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"/>`, // mountain
  location: `<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0"/>`, // map-pin
  key: `<path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0"/><path d="M15 9h.01"/>`, // key
  bath: `<path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1"/><path d="M6 12v-7a2 2 0 0 1 2 -2h3v2.25"/><path d="M4 21l1 -1.5"/><path d="M20 21l-1 -1.5"/>`, // bath
  ac: `<path d="M8 16a3 3 0 0 1 -3 3"/><path d="M16 16a3 3 0 0 0 3 3"/><path d="M12 16v4"/><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -4"/><path d="M7 13v-3a1 1 0 0 1 1 -1h8a1 1 0 0 1 1 1v3"/>`, // air-conditioning
  kitchen: `<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/>`, // tools-kitchen-2
  bed: `<path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M22 17v-3h-20"/><path d="M2 8v9"/><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5"/>`, // bed
  phone: `<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>`, // phone
  mail: `<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10"/><path d="M3 7l9 6l9 -6"/>`, // mail
  wine: `<path d="M8 21l8 0"/><path d="M12 15l0 6"/><path d="M17 3l1 7c0 3.012 -2.686 5 -6 5s-6 -1.988 -6 -5l1 -7h10"/><path d="M6 10a5 5 0 0 1 6 0a5 5 0 0 0 6 0"/>`, // glass-full
  restaurant: `<path d="M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723l0 7.126h-12v-7.126a4 4 0 1 1 2.092 -7.723a4 4 0 0 1 3.908 -3.151"/><path d="M6.161 17.009l11.839 -.009"/>`, // chef-hat
  ev: `<path d="M18 7l-1 1"/><path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3"/><path d="M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14"/><path d="M9 11.5l-1.5 2.5h3l-1.5 2.5"/><path d="M3 20l12 0"/><path d="M4 8l10 0"/>`, // charging-pile
  child: `<path d="M6 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M16 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6"/><path d="M6 9h14"/><path d="M9 17l1 -3"/><path d="M16 14l1 3"/>`, // baby-carriage
  bike: `<path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M12 19v-4l-3 -3l5 -4l2 3h3"/><path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>`, // bike
  clock: `<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>`, // clock
  luggage: `<path d="M6 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -10"/><path d="M9 6v-1a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1"/><path d="M6 10h12"/><path d="M6 16h12"/><path d="M9 20v1"/><path d="M15 20v1"/>`, // luggage
  fitness: `<path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/>`, // barbell
  fire: `<path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235"/>`, // flame
  boat: `<path d="M6.414 6.414a2 2 0 0 0 0 -2.828l-1.414 -1.414l-2.828 2.828l1.414 1.414a2 2 0 0 0 2.828 0" /><path d="M17.586 17.586a2 2 0 0 0 0 2.828l1.414 1.414l2.828 -2.828l-1.414 -1.414a2 2 0 0 0 -2.828 0" /><path d="M6.5 6.5l11 11" /><path d="M22 2.5c-9.983 2.601 -17.627 7.952 -20 19.5c9.983 -2.601 17.627 -7.952 20 -19.5" /><path d="M6.5 12.5l5 5" /><path d="M12.5 6.5l5 5" />`, // tabler: kayak
  grill: `<path d="M19 8h-14a6 6 0 0 0 6 6h2a6 6 0 0 0 6 -5.775l0 -.225"/><path d="M17 20a2 2 0 1 1 0 -4a2 2 0 0 1 0 4"/><path d="M15 14l1 2"/><path d="M9 14l-3 6"/><path d="M15 18h-8"/><path d="M15 5v-1"/><path d="M12 5v-1"/><path d="M9 5v-1"/>`, // grill
  sun: `<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>`, // sun
  spa: `<path d="M3 17a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 22l4 -2v-3h12"/><path d="M11 20h9"/><path d="M8 14l3 -2l1 -4c3 1 3 4 3 6"/>`, // massage
  telescope: `<path d="M6 21l6 -5l6 5"/><path d="M12 13v8"/><path d="M3.294 13.678l.166 .281c.52 .88 1.624 1.265 2.605 .91l14.242 -5.165a1.023 1.023 0 0 0 .565 -1.456l-2.62 -4.705a1.087 1.087 0 0 0 -1.447 -.42l-.056 .032l-12.694 7.618c-1.02 .613 -1.357 1.897 -.76 2.905l-.001 0"/><path d="M14 5l3 5.5"/>`, // telescope
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
  [W("vízibicikli|vizibicikli|csónak|csonak|kajak|kenu|hajó|hajo|vízisport|vizisport|sup-?deszka"), "boat"],
  [W("bicik|bicaj|bringa|kerékpár|kerekpar"), "bike"],
  [W("borbár|borbar|borvidék|borvidek|borkóstoló|borkostolo|szőlő|szolo|sommelier"), "wine"],
  [W("étterem|etterem|vacsora|bisztró|bisztro|gasztro|félpanzió|felpanzio"), "restaurant"],
  [W("reggeli|kávé|kave|büfé|bufe|teabár|teabar"), "coffee"],
  [W("konyh|mosogatógép|mosogatogep|főzőfülke|fozofulke|mikró|mikro|hűtő|huto"), "kitchen"],
  [W("fitnesz|fitness|edzőterem|edzoterem|konditerem|torna|jóga|joga"), "fitness"],
  [W("masszázs|masszazs|gyógy|gyogy|reuma|kúra|kura"), "spa"],
  [W("csillagvizsg|távcső|tavcso|planetár|planetar|obszervat"), "telescope"],
  // „szauna” and „medence” also inside compounds (Infraszauna, Sómedence).
  [new RegExp("szauna|medence|jacuzzi|pezsgőfürdő|pezsgofurdo|dézsa|dezsa|wellness|termál|termal", "iu"), "pool"],
  [W("grill|bogrács|bogracs|szalonnasüt|tárcsa|tarcsa|sütés|sutes"), "grill"],
  [W("kály|kaly|kemence|tűz|tuz|kandalló|kandallo"), "fire"],
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
