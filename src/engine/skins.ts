// Skin = "skin as data": a set of --cit-* design tokens (06-UI-CONTRACT). The primitives'
// CSS dresses ONLY from these tokens, so one primitive renders natively in any skin. A skin
// never changes STRUCTURE — only look. This is the cheapest variety axis (ADR-0017 SKIN-passz):
// the same recipe + data in a different skin is a different-looking, same-structured page.
//
// The 9 skins below are DISTILLED from the design corpus (assets/design-refs/corpus): each is
// grounded in a real corpus design's palette + mood, mapped onto the 11 canonical tokens.
// `hint` feeds the AI planner menu (single source → no prompt drift). `fonts` optionally names
// Google Font families (the corpus leans on Fraunces/Jost/Playfair/…); render.ts injects them.
//
// NB (live-readiness): webfonts load from Google Fonts here (fine for a demo mock). For a live
// tenant page, self-host the fonts (GDPR) — a later slice; the token contract is unchanged.

import { harmonizeAccent } from "./palette.js";

export interface Skin {
  readonly id: string;
  readonly label: string;
  /** One-line mood hint fed to the AI planner (single source — no prompt drift). */
  readonly hint: string;
  readonly tokens: Readonly<Record<string, string>>;
  /** Optional Google Font family query segments, e.g. "Fraunces:wght@400;500;600". */
  readonly fonts?: readonly string[];
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SYSSANS = "system-ui, -apple-system, sans-serif";

export const SKINS: Readonly<Record<string, Skin>> = {
  // egyszeru/1 honest-warm — terrakotta-bordó, barátságos budget. System-font baseline.
  "editorial-warm": {
    id: "editorial-warm",
    label: "Editorial — meleg, világos",
    hint: "meleg, világos, családias, természetközeli; barátságos budget.",
    tokens: {
      "--cit-accent": "#7c2d3a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#211d1a",
      "--cit-muted": "#6b625b",
      "--cit-bg": "#faf6f0",
      "--cit-surface": "#ffffff",
      "--cit-line": "#e7ded3",
      "--cit-radius": "14px",
      "--cit-font-display": SERIF,
      "--cit-font-body": SYSSANS,
      "--cit-shadow": "0 6px 24px rgba(33,29,26,.08)",
    },
  },

  // luxus/1 immersive-dark — warm-dark + gold, prémium. System-font baseline.
  "immersive-dark": {
    id: "immersive-dark",
    label: "Immersive — sötét, elegáns",
    hint: "sötét, elegáns, prémium, dizájnos; drámai kontraszt.",
    tokens: {
      "--cit-accent": "#c9a86a",
      "--cit-on-accent": "#1a1712",
      "--cit-ink": "#f2ece1",
      "--cit-muted": "#a99f8d",
      "--cit-bg": "#14110d",
      "--cit-surface": "#1e1a15",
      "--cit-line": "#332c22",
      "--cit-radius": "10px",
      "--cit-font-display": SERIF,
      "--cit-font-body": SYSSANS,
      "--cit-shadow": "0 10px 40px rgba(0,0,0,.5)",
    },
  },

  // kozep/1 + premium/1 editorial-magazine — bordó-terrakotta-arany, Fraunces szerif.
  "editorial-magazine": {
    id: "editorial-magazine",
    label: "Magazin — bordó-arany, szerkesztői",
    hint: "meleg borvidéki magazin, klasszikus szerif; kontrasztos, igényes.",
    tokens: {
      "--cit-accent": "#6e1423",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#241a17",
      "--cit-muted": "#6f5f52",
      "--cit-bg": "#f7f2ea",
      "--cit-surface": "#fffdf9",
      "--cit-line": "#e2d9cb",
      "--cit-radius": "6px",
      "--cit-font-display": "'Fraunces', Georgia, serif",
      "--cit-font-body": "'Jost', system-ui, sans-serif",
      "--cit-shadow": "0 8px 30px rgba(36,26,23,.10)",
    },
    fonts: ["Fraunces:wght@400;500;600", "Jost:wght@400;500;600"],
  },

  // víz-kék homok nád (kozep/7, egyszeru/5-9) — világos, tópart, friss.
  "coastal-fresh": {
    id: "coastal-fresh",
    label: "Parti — vízkék-homok, friss",
    hint: "világos, nyugodt tópart; vízkék + homok, derűs és levegős.",
    tokens: {
      "--cit-accent": "#2f6b78",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#1f2b2e",
      "--cit-muted": "#5f7175",
      "--cit-bg": "#f4f1e9",
      "--cit-surface": "#ffffff",
      "--cit-line": "#e3ddcf",
      "--cit-radius": "16px",
      "--cit-font-display": "'Fraunces', Georgia, serif",
      "--cit-font-body": "'Manrope', system-ui, sans-serif",
      "--cit-shadow": "0 8px 28px rgba(47,107,120,.12)",
    },
    fonts: ["Fraunces:wght@400;500;600", "Manrope:wght@400;500;600"],
  },

  // kozep/5 gallery-led-masonry — kő-bordó-arany, présházi meleg, antikva.
  "stone-masonry": {
    id: "stone-masonry",
    label: "Kő — présházi, meleg prémium",
    hint: "meszelt kő + bordó-arany, présházi meleg; elegáns antikva.",
    tokens: {
      "--cit-accent": "#9a3b2e",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#2a201a",
      "--cit-muted": "#6d5f52",
      "--cit-bg": "#efe9dd",
      "--cit-surface": "#fbf7ee",
      "--cit-line": "#e0d6c3",
      "--cit-radius": "4px",
      "--cit-font-display": "'Cormorant Garamond', Georgia, serif",
      "--cit-font-body": "'Jost', system-ui, sans-serif",
      "--cit-shadow": "0 6px 22px rgba(42,32,26,.10)",
    },
    fonts: ["Cormorant+Garamond:wght@500;600;700", "Jost:wght@400;500;600"],
  },

  // premium/6 editorial — homok-krém, meleg napfény, bőséges levegő, szerif.
  "sand-cream-airy": {
    id: "sand-cream-airy",
    label: "Homok — krém, levegős napfény",
    hint: "homok-krém, meleg napfény, bőséges levegő; könnyed szerif editorial.",
    tokens: {
      "--cit-accent": "#b0673a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#2c2419",
      "--cit-muted": "#7a6f5e",
      "--cit-bg": "#fbf7ee",
      "--cit-surface": "#ffffff",
      "--cit-line": "#ece3d2",
      "--cit-radius": "10px",
      "--cit-font-display": "'Playfair Display', Georgia, serif",
      "--cit-font-body": "'Manrope', system-ui, sans-serif",
      "--cit-shadow": "0 10px 34px rgba(44,36,25,.07)",
    },
    fonts: ["Playfair+Display:wght@500;600;700", "Manrope:wght@400;500;600"],
  },

  // premium/3 immersive-dark — éjfekete bordó-arany, cinematic pince.
  "cellar-dark-wine": {
    id: "cellar-dark-wine",
    label: "Pince — éjfekete bordó-arany",
    hint: "éjfekete + bordó-arany, cinematic pincehangulat; drámai, prémium.",
    tokens: {
      "--cit-accent": "#c9a24b",
      "--cit-on-accent": "#14100c",
      "--cit-ink": "#efe6d6",
      "--cit-muted": "#a99e8b",
      "--cit-bg": "#0e0b09",
      "--cit-surface": "#171210",
      "--cit-line": "#2c231c",
      "--cit-radius": "8px",
      "--cit-font-display": "'Fraunces', Georgia, serif",
      "--cit-font-body": "'Outfit', system-ui, sans-serif",
      "--cit-shadow": "0 12px 44px rgba(0,0,0,.6)",
    },
    fonts: ["Fraunces:wght@400;500;600", "Outfit:wght@400;500;600"],
  },

  // luxus/1 immersive-dark — éjkék-arany, cinematic luxus, drámai szerif.
  "night-azure-gold": {
    id: "night-azure-gold",
    label: "Éjkék — arany, cinematic luxus",
    hint: "éjkék + arany, cinematic luxus; drámai szerif, vízparti elegancia.",
    tokens: {
      "--cit-accent": "#c9a24b",
      "--cit-on-accent": "#0c1418",
      "--cit-ink": "#f2ede2",
      "--cit-muted": "#8ba0a4",
      "--cit-bg": "#0c1418",
      "--cit-surface": "#142229",
      "--cit-line": "#20323a",
      "--cit-radius": "10px",
      "--cit-font-display": "'Playfair Display', Georgia, serif",
      "--cit-font-body": "'Jost', system-ui, sans-serif",
      "--cit-shadow": "0 14px 46px rgba(4,10,14,.6)",
    },
    fonts: ["Playfair+Display:wght@500;600;700", "Jost:wght@400;500;600"],
  },

  // 06-immersive-parallax reference (Nordwand) — snow/ink/amber, bold expanded sans. The
  // athletic-alpine identity: heavy uppercase display, crisp cool surfaces, amber action.
  "alpine-bold": {
    id: "alpine-bold",
    label: "Alpesi — hó-tinta-borostyán, bold",
    hint: "friss, sportos-alpesi: világos hó-háttér, mély tinta, borostyán akcent; erős, kiabáló display.",
    tokens: {
      "--cit-accent": "#d97706",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#0d1b24",
      "--cit-muted": "#5b6b76",
      "--cit-bg": "#f4f6f8",
      "--cit-surface": "#ffffff",
      "--cit-line": "#dbe3e9",
      "--cit-radius": "6px",
      "--cit-font-display": "'Archivo Expanded', 'Archivo', system-ui, sans-serif",
      "--cit-font-body": "'Archivo', system-ui, sans-serif",
      "--cit-shadow": "0 8px 24px rgba(13,27,36,.10)",
    },
    fonts: ["Archivo:wght@400;500;700;900", "Archivo+Expanded:wght@700;900"],
  },

  // premium/5 story-scroll — terrakotta-arany-szőlőzöld, toszkánás meleg.
  "tuscan-terracotta": {
    id: "tuscan-terracotta",
    label: "Toszkán — terrakotta-arany",
    hint: "terrakotta-arany-szőlőzöld, toszkánás meleg; napsütötte, hívogató.",
    tokens: {
      "--cit-accent": "#b4552e",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#2a1c14",
      "--cit-muted": "#6f5c4a",
      "--cit-bg": "#f6efe2",
      "--cit-surface": "#fffdf7",
      "--cit-line": "#e6dac6",
      "--cit-radius": "12px",
      "--cit-font-display": "'Playfair Display', Georgia, serif",
      "--cit-font-body": "'Manrope', system-ui, sans-serif",
      "--cit-shadow": "0 8px 28px rgba(42,28,20,.10)",
    },
    fonts: ["Playfair+Display:wght@500;600;700", "Manrope:wght@400;500;600"],
  },

  // mock_17 horizontal — Mecsek bükkös: éj-zöld, páfrány, arany akcent; irodalmi antikva.
  "forest-night": {
    id: "forest-night",
    label: "Erdő — éjzöld-arany, irodalmi",
    hint: "mély erdő-éjzöld, páfrány-szürke, arany akcent; irodalmi, csendes prémium.",
    tokens: {
      "--cit-accent": "#cfa76a",
      "--cit-on-accent": "#131f18",
      "--cit-ink": "#eef0ea",
      "--cit-muted": "#8aa192",
      "--cit-bg": "#131f18",
      "--cit-surface": "#1d2f24",
      "--cit-line": "#2b3d31",
      "--cit-radius": "18px",
      "--cit-font-display": "'Spectral', Georgia, serif",
      "--cit-font-body": "'Hanken Grotesk', system-ui, sans-serif",
      "--cit-shadow": "0 14px 40px rgba(6,12,9,.55)",
    },
    fonts: ["Spectral:wght@400;500;600", "Hanken+Grotesk:wght@400;500;600;700"],
  },

  // mock_19 artdeco — 1928 nagyszálló: éjkék-réz, sepia poszter; deco geometrikus display.
  "deco-brass": {
    id: "deco-brass",
    label: "Art-deco — éjkék-réz, poszter",
    hint: "1928-as nagyszálló: éjkék + réz, sepia elegancia; geometrikus deco display, klasszikus.",
    tokens: {
      "--cit-accent": "#c9a227",
      "--cit-on-accent": "#0f1720",
      "--cit-ink": "#f2ece0",
      "--cit-muted": "#9aa5ad",
      "--cit-bg": "#0f1720",
      "--cit-surface": "#16212c",
      "--cit-line": "#2a333d",
      "--cit-radius": "0px",
      "--cit-font-display": "'Poiret One', Georgia, serif",
      "--cit-font-body": "'Josefin Sans', system-ui, sans-serif",
      "--cit-shadow": "0 12px 40px rgba(0,0,0,.5)",
    },
    fonts: ["Poiret+One", "Josefin+Sans:wght@300;400;600;700", "Cormorant:ital,wght@0,400;1,300;1,400"],
  },

  // mock_20 transit — reptéri kapszula: pala-szürke, borostyán jelzés, kondenzált tábla-sans.
  "signage-amber": {
    id: "signage-amber",
    label: "Tábla — pala-borostyán, jelzés",
    hint: "reptéri jelzőtábla: pala-szürke, borostyán akcent, funkcionális; kondenzált nagybetűs display.",
    tokens: {
      "--cit-accent": "#ffb020",
      "--cit-on-accent": "#12161a",
      "--cit-ink": "#e8edf1",
      "--cit-muted": "#8b98a5",
      "--cit-bg": "#12161a",
      "--cit-surface": "#1a2026",
      "--cit-line": "#2b343c",
      "--cit-radius": "2px",
      "--cit-font-display": "'Barlow Condensed', system-ui, sans-serif",
      "--cit-font-body": "'Barlow', system-ui, sans-serif",
      "--cit-shadow": "0 10px 30px rgba(0,0,0,.4)",
    },
    fonts: ["Barlow+Condensed:wght@400;500;600;700", "Barlow:wght@300;400;500;600;700"],
  },

  // mock_07 organic — zselici ökobirtok: agyag-moha-len, meleg föld; lágy antikva, organikus.
  "loam-organic": {
    id: "loam-organic",
    label: "Föld — agyag-moha, organikus",
    hint: "ökobirtok: agyag-barna, moha-zöld, len-krém; meleg, természetközeli, organikus formák.",
    tokens: {
      "--cit-accent": "#7d8b6a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#3d3428",
      "--cit-muted": "#6b5842",
      "--cit-bg": "#fbf8f1",
      "--cit-surface": "#f5f0e6",
      "--cit-line": "#e8e2d3",
      "--cit-radius": "26px",
      "--cit-font-display": "'Gelasio', Georgia, serif",
      "--cit-font-body": "'Albert Sans', system-ui, sans-serif",
      "--cit-shadow": "0 18px 44px rgba(61,52,40,.14)",
    },
    fonts: ["Gelasio:ital,wght@0,400;0,600;1,400", "Albert+Sans:wght@300;400;500;600"],
  },

  // mock_15 scrapbook — palóc vendégház: papír-meggy-levél, kézzel írt; játékos, meleg.
  "scrapbook-paper": {
    id: "scrapbook-paper",
    label: "Scrapbook — papír-meggy, kézműves",
    hint: "papíralapú emlékkönyv: krém papír, meggy-piros, levélzöld; kézzel írt cetlik, meleg-játékos.",
    tokens: {
      "--cit-accent": "#c04b3a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#43382c",
      "--cit-muted": "#8a7a66",
      "--cit-bg": "#f8f2e4",
      "--cit-surface": "#fffdf6",
      "--cit-line": "#e5ddce",
      "--cit-radius": "8px",
      "--cit-font-display": "'Grandstander', system-ui, cursive",
      "--cit-font-body": "'Zilla Slab', Georgia, serif",
      "--cit-shadow": "0 12px 30px rgba(67,56,44,.16)",
    },
    fonts: ["Grandstander:wght@400;600;800", "Zilla+Slab:ital,wght@0,400;0,500;1,400", "Caveat:wght@500;700"],
  },

  // mock_21 watercolor — balatoni panzió: víz-kék-korall-nap, akvarell; derűs, lágy.
  "watercolor-lake": {
    id: "watercolor-lake",
    label: "Akvarell — vízkék-korall, derűs",
    hint: "balatoni akvarell: lágy vízkék, korall akcent, napsárga; derűs, nyári, hullámzó.",
    tokens: {
      "--cit-accent": "#e8836a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#33474f",
      "--cit-muted": "#7d949c",
      "--cit-bg": "#f5fbfc",
      "--cit-surface": "#ffffff",
      "--cit-line": "#d7e8ee",
      "--cit-radius": "22px",
      "--cit-font-display": "'Playfair Display', Georgia, serif",
      "--cit-font-body": "'Quicksand', system-ui, sans-serif",
      "--cit-shadow": "0 14px 34px rgba(51,71,79,.12)",
    },
    fonts: ["Playfair+Display:ital,wght@0,500;0,600;1,500", "Quicksand:wght@400;500;600;700"],
  },

  // mock_14 aurora — Duna-parti aparthotel: mély indigó üveg, aurora, cián-rózsa; app-szintű.
  "aurora-indigo": {
    id: "aurora-indigo",
    label: "Aurora — indigó üveg, app",
    hint: "mély indigó éjszaka, aurora fény, cián-rózsa akcent; üveg-hatás, app-szintű modern.",
    tokens: {
      "--cit-accent": "#6366f1",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#eef0fa",
      "--cit-muted": "#9aa3c7",
      "--cit-bg": "#0b1026",
      "--cit-surface": "#141a33",
      "--cit-line": "#262c4a",
      "--cit-radius": "18px",
      "--cit-font-display": "'Plus Jakarta Sans', system-ui, sans-serif",
      "--cit-font-body": "'Plus Jakarta Sans', system-ui, sans-serif",
      "--cit-shadow": "0 20px 50px rgba(3,6,20,.55)",
    },
    fonts: ["Plus+Jakarta+Sans:wght@300;400;500;600;700;800"],
  },

  // mock_18 claymorphism — hévízi termál: lágy neumorf agyag, aqua-ég; puha, barátságos.
  "clay-soft": {
    id: "clay-soft",
    label: "Agyag — neumorf, puha wellness",
    hint: "termál-wellness: lágy neumorf agyag felület, aqua-ég akcent; puha árnyékok, barátságos.",
    tokens: {
      "--cit-accent": "#3fb2b2",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#2b3a44",
      "--cit-muted": "#7b8d99",
      "--cit-bg": "#eef3f6",
      "--cit-surface": "#ffffff",
      "--cit-line": "#dbe4e9",
      "--cit-radius": "26px",
      "--cit-font-display": "'Fredoka', system-ui, sans-serif",
      "--cit-font-body": "'Nunito', system-ui, sans-serif",
      "--cit-shadow": "8px 8px 20px rgba(43,58,68,.14)",
    },
    fonts: ["Fredoka:wght@400;500;600;700", "Nunito:wght@300;400;600;700"],
  },

  // mock_12 cinematic — egri panoráma hotel: krém-navy-arany, mozivászon hero; klasszikus szerif.
  "cinematic-navy": {
    id: "cinematic-navy",
    label: "Cinematic — krém-navy-arany, mozi",
    hint: "panoráma hotel: világos krém alap, navy-arany, mozivászon hero; klasszikus szerif, elegáns.",
    tokens: {
      "--cit-accent": "#a9803f",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#101c26",
      "--cit-muted": "#68737d",
      "--cit-bg": "#f7f6f3",
      "--cit-surface": "#ffffff",
      "--cit-line": "#e5e2dc",
      "--cit-radius": "6px",
      "--cit-font-display": "'Libre Caslon Text', Georgia, serif",
      "--cit-font-body": "'Public Sans', system-ui, sans-serif",
      "--cit-shadow": "0 12px 34px rgba(16,28,38,.12)",
    },
    fonts: ["Libre+Caslon+Text:wght@400;700", "Public+Sans:wght@300;400;500;600;700"],
  },
};

/** Render a skin's tokens as a `:root { ... }` block. An optional photo-derived accent (§B.6)
 *  overrides ONLY --cit-accent, harmonized into the skin's contrast rails (engine/palette.ts);
 *  the light/dark character and all other tokens stay the skin's. */
export function renderSkinVars(skin: Skin, accentOverride?: string): string {
  const tokens =
    accentOverride && skin.tokens["--cit-accent"]
      ? {
          ...skin.tokens,
          "--cit-accent": harmonizeAccent(
            accentOverride,
            skin.tokens["--cit-accent"]!,
            skin.tokens["--cit-on-accent"] ?? "#ffffff",
          ),
        }
      : skin.tokens;
  const body = Object.entries(tokens)
    .map(([k, v]) => `    ${k}: ${v};`)
    .join("\n");
  return `:root {\n${body}\n  }`;
}

/** Google Fonts <link> tags for a skin's webfonts, or "" for a system-font skin. */
export function renderSkinFontLinks(skin: Skin): string {
  if (!skin.fonts?.length) return "";
  const families = skin.fonts.map((f) => `family=${f}`).join("&");
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
    `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
    `  <link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`
  );
}
