// Inline SVG icon set (design doctrine §B.4: icons are SVG, NEVER emoji). A small, 1-color,
// stroke-based library + a Hungarian keyword matcher, so an amenity label ("Ingyenes parkolás")
// maps to a fitting decorative icon. The icon is a DECORATIVE marker, not a fabricated fact —
// it dresses the real highlight text. Unknown labels fall back to a neutral check mark.

const PATHS: Readonly<Record<string, string>> = {
  check: `<path d="M20 6 9 17l-5-5"/>`,
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
};

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/parkol|garázs/i, "parking"],
  [/wifi|wi-fi|internet|net\b/i, "wifi"],
  [/reggeli|kávé|kave|büfé|bor(kóstoló|kostolo)|étkez|etkez|konyha/i, "coffee"],
  [/kutya|állat|allat|kedvenc|macska/i, "pet"],
  [/kert|udvar|terasz|természet|termeszet|erdő|erdo|zöld|zold/i, "garden"],
  [/medence|úsz|usz|jacuzzi|dézsa|deza|szauna|wellness|fürdődéz/i, "pool"],
  [/panoráma|panorama|kilátás|kilatas|tó\b|tona|balaton|hegy/i, "view"],
  [/klíma|klima|légkond|legkond/i, "ac"],
  [/fürdő|furdo|zuhany|kád|kad/i, "bath"],
  [/konyh/i, "kitchen"],
  [/ágy|agy|szoba|háló|halo/i, "bed"],
  [/központ|kozpont|belváros|belvaros|elhelyezked|közel|kozel|perc/i, "location"],
  [/bejárat|bejarat|kulcs|önálló|onallo|privát|privat/i, "key"],
];

/** Best-fit icon name for a Hungarian amenity label; neutral check mark if none matches. */
export function matchIcon(label: string): string {
  for (const [re, name] of RULES) if (re.test(label)) return name;
  return "check";
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
