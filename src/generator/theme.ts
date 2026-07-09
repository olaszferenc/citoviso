// Parametric design system (ADR-0005). A property-derived SEED selects a full
// visual theme — palette, fonts, layout archetype — so every mock is unique yet
// reproducible (same seed → same theme). The AI "arculat-brief" (brief.ts) can
// override palette + archetype from the actual photos; without it we fall back
// to seeded families. No two neighbours look alike (see pickThemeForRegion).

export interface Palette {
  name: string;
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  onAccent: string;
}

export interface FontPair {
  name: string;
  heading: string;
  body: string;
  /** Google Fonts href for <link>. */
  href: string;
}

export type HeroStyle = "overlay" | "split" | "banner";
export type GalleryStyle = "mosaic" | "masonry" | "row";

export interface Theme {
  palette: Palette;
  fonts: FontPair;
  radius: number;
  heroStyle: HeroStyle;
  galleryStyle: GalleryStyle;
  /** Middle-section order (hero first + contact last are fixed). */
  order: ("intro" | "gallery" | "features")[];
  navTransparent: boolean;
  mood?: string;
}

// --- seeded PRNG (mulberry32) from a string, so themes are stable per property ---

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// --- palette families (fallback when no AI brief) — each harmonious, chosen to ---
// look good behind real photography (chrome/accents, not the photos themselves).

const PALETTES: readonly Palette[] = [
  {
    name: "borvidék", bg: "#faf6f0", surface: "#ffffff", surface2: "#f2ebe1",
    ink: "#211d1a", muted: "#6b625b", line: "#e7e0d8",
    accent: "#7c2d3a", accentDark: "#5e1f2a", accentSoft: "#b98a3e", onAccent: "#ffffff",
  },
  {
    name: "tópart", bg: "#f4f8fa", surface: "#ffffff", surface2: "#e6eff3",
    ink: "#152a33", muted: "#557079", line: "#d5e2e8",
    accent: "#1f7a8c", accentDark: "#155e6d", accentSoft: "#c9a24b", onAccent: "#ffffff",
  },
  {
    name: "erdőmély", bg: "#f5f7f2", surface: "#ffffff", surface2: "#e8efe2",
    ink: "#1c2a1e", muted: "#5a6b56", line: "#dbe4d3",
    accent: "#3f6f45", accentDark: "#2e5433", accentSoft: "#b98a3e", onAccent: "#ffffff",
  },
  {
    name: "kőház", bg: "#f7f6f4", surface: "#ffffff", surface2: "#eceae5",
    ink: "#23211d", muted: "#6a655d", line: "#e2ded7",
    accent: "#334155", accentDark: "#23303f", accentSoft: "#c08a4a", onAccent: "#ffffff",
  },
  {
    name: "terrakotta", bg: "#fbf5f0", surface: "#ffffff", surface2: "#f4e7dc",
    ink: "#2a1f18", muted: "#7a685b", line: "#ecdccf",
    accent: "#c05a34", accentDark: "#9c4526", accentSoft: "#8a6d3f", onAccent: "#ffffff",
  },
  {
    name: "levendula", bg: "#f7f5fb", surface: "#ffffff", surface2: "#ece7f4",
    ink: "#241f2c", muted: "#655d72", line: "#e0dae9",
    accent: "#5b4a86", accentDark: "#453769", accentSoft: "#b98a3e", onAccent: "#ffffff",
  },
];

const FONTS: readonly FontPair[] = [
  {
    name: "Fraunces/Inter", heading: "Fraunces", body: "Inter",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap",
  },
  {
    name: "Playfair/Source", heading: "'Playfair Display'", body: "'Source Sans 3'",
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600&display=swap",
  },
  {
    name: "Cormorant/Jost", heading: "'Cormorant Garamond'", body: "Jost",
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Jost:wght@400;500;600&display=swap",
  },
  {
    name: "DMSerif/DMSans", heading: "'DM Serif Display'", body: "'DM Sans'",
    href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap",
  },
  {
    name: "SpaceGrotesk/Inter", heading: "'Space Grotesk'", body: "Inter",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
  },
];

const HERO_STYLES: readonly HeroStyle[] = ["overlay", "split", "banner"];
const GALLERY_STYLES: readonly GalleryStyle[] = ["mosaic", "masonry", "row"];
const RADII = [10, 14, 18, 22] as const;

/** Map an AI brief archetype hint to a hero style (brief.ts returns this). */
function heroFromArchetype(a: string | undefined): HeroStyle | null {
  if (a === "classic") return "overlay";
  if (a === "split") return "split";
  if (a === "gallery") return "banner";
  return null;
}

export interface ThemeBrief {
  palette?: Partial<Palette>;
  archetype?: string;
  mood?: string;
}

/** Build a full, deterministic theme for a property seed, optionally steered by an AI brief. */
export function buildTheme(seed: string, brief?: ThemeBrief): Theme {
  const rng = mulberry32(hashString(seed));
  const basePalette = pick(PALETTES, rng);
  const palette: Palette = brief?.palette
    ? { ...basePalette, ...brief.palette }
    : basePalette;
  const fonts = pick(FONTS, rng);
  const heroStyle = heroFromArchetype(brief?.archetype) ?? pick(HERO_STYLES, rng);
  const galleryStyle = pick(GALLERY_STYLES, rng);
  const radius = pick(RADII, rng);
  // Seeded order of the three middle sections.
  const order: Theme["order"] = rng() > 0.5
    ? ["intro", "gallery", "features"]
    : ["intro", "features", "gallery"];
  return {
    palette,
    fonts,
    radius,
    heroStyle,
    galleryStyle,
    order,
    navTransparent: heroStyle === "overlay" && rng() > 0.4,
    mood: brief?.mood,
  };
}
