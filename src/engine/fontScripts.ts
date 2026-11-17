// ORSZÁG-RÉTEG 3/6 (ADR-XXXX): a generated page's web fonts in the page language's SCRIPT.
//
// ⛔ Until 2026-11-17 a Bulgarian mock asked Google Fonts for Fraunces/Outfit/Archivo/… — families
// with NO Cyrillic glyphs — so every Bulgarian letter fell to the visitor's system font (Georgia /
// system-ui) while the Latin name above it stood in the template's face: the page looked broken.
//
// The rule, data-driven:
//   · A Latin-script page is NOT touched (the Hungarian mock stays byte for byte).
//   · On a Cyrillic / Greek page, every family that lacks the script is swapped — in the
//     Google Fonts URL AND in the page's CSS — for its STAND-IN: a family of the same character
//     (soft serif → serif, geometric → geometric, rounded → rounded, slab → slab) that carries
//     both Cyrillic and Greek. The URL also names the script's subsets.
//
// FONT_SCRIPTS is MEASURED, not remembered: `curl https://fonts.googleapis.com/css2?family=<F>` and
// count the `/* cyrillic */` and `/* greek */` blocks (2026-11-17, every family the skins load and
// every stand-in). A family missing from the table counts as Latin-only → it is swapped if it has a
// stand-in; `scripts/country-layer-check.mts` fails when a skin loads a family the table lacks.

import { fontSubsetsOfLang, scriptOfLang } from "../i18n/script.js";

/** Which non-Latin scripts each family carries on Google Fonts (measured 2026-11-17). */
export const FONT_SCRIPTS: Readonly<Record<string, readonly ("Cyrl" | "Grek")[]>> = {
  // ── loaded by the skins (src/engine/skins.ts) ──
  "Fraunces": [],
  "Jost": ["Cyrl"],
  "Manrope": ["Cyrl", "Grek"],
  "Cormorant Garamond": ["Cyrl"],
  "Playfair Display": ["Cyrl"],
  "Outfit": [],
  "Archivo": [],
  "Archivo Expanded": [],
  "Spectral": ["Cyrl"],
  "Hanken Grotesk": [],
  "Poiret One": ["Cyrl"],
  "Josefin Sans": [],
  "Cormorant": ["Cyrl"],
  "Barlow Condensed": [],
  "Barlow": [],
  "Gelasio": [],
  "Albert Sans": [],
  "Grandstander": [],
  "Zilla Slab": [],
  "Caveat": ["Cyrl"],
  "Quicksand": [],
  "Plus Jakarta Sans": [],
  "Fredoka": [],
  "Nunito": ["Cyrl"],
  "Libre Caslon Text": [],
  "Public Sans": [],
  "Bricolage Grotesque": [],
  "Figtree": [],
  "Inter": ["Cyrl", "Grek"],
  // ── the stand-ins ──
  "Literata": ["Cyrl", "Grek"],
  "Commissioner": ["Cyrl", "Grek"],
  "EB Garamond": ["Cyrl", "Grek"],
  "Noto Serif": ["Cyrl", "Grek"],
  "Roboto Slab": ["Cyrl", "Grek"],
  "Roboto Condensed": ["Cyrl", "Grek"],
  "Comfortaa": ["Cyrl", "Grek"],
  "Fira Sans": ["Cyrl", "Grek"],
};

interface StandIn {
  /** The family name as CSS writes it. */
  readonly name: string;
  /** The Google Fonts css2 `family=` value (variable axes where the family has them). */
  readonly spec: string;
}

const LITERATA: StandIn = { name: "Literata", spec: "Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900" };
const MANROPE: StandIn = { name: "Manrope", spec: "Manrope:wght@200..800" };
const COMMISSIONER: StandIn = { name: "Commissioner", spec: "Commissioner:wght@100..900" };
const INTER: StandIn = { name: "Inter", spec: "Inter:wght@100..900" };
const EB_GARAMOND: StandIn = { name: "EB Garamond", spec: "EB+Garamond:ital,wght@0,400..800;1,400..800" };
const NOTO_SERIF: StandIn = { name: "Noto Serif", spec: "Noto+Serif:ital,wght@0,100..900;1,100..900" };
const ROBOTO_SLAB: StandIn = { name: "Roboto Slab", spec: "Roboto+Slab:wght@100..900" };
const ROBOTO_CONDENSED: StandIn = { name: "Roboto Condensed", spec: "Roboto+Condensed:wght@100..900" };
const COMFORTAA: StandIn = { name: "Comfortaa", spec: "Comfortaa:wght@300..700" };
const FIRA_SANS: StandIn = { name: "Fira Sans", spec: "Fira+Sans:wght@300;400;500;600;700;800;900" };

/**
 * Each skin family's stand-in, chosen for the template's CHARACTER (the pair the template was
 * designed with stays recognisable): soft/wonky serif → Literata, Garamond/Caslon → EB Garamond,
 * Georgia-metric serif → Noto Serif, slab → Roboto Slab, geometric sans → Manrope, grotesque →
 * Commissioner / Inter, condensed → Roboto Condensed, rounded / playful → Comfortaa.
 */
export const FONT_STAND_IN: Readonly<Record<string, StandIn>> = {
  "Fraunces": LITERATA,
  "Playfair Display": LITERATA,
  "Spectral": LITERATA,
  "Cormorant Garamond": EB_GARAMOND,
  "Cormorant": EB_GARAMOND,
  "Libre Caslon Text": EB_GARAMOND,
  "Gelasio": NOTO_SERIF,
  "Zilla Slab": ROBOTO_SLAB,
  "Jost": MANROPE,
  "Outfit": MANROPE,
  "Josefin Sans": MANROPE,
  "Plus Jakarta Sans": MANROPE,
  "Figtree": MANROPE,
  "Archivo": COMMISSIONER,
  "Archivo Expanded": COMMISSIONER,
  "Bricolage Grotesque": COMMISSIONER,
  "Hanken Grotesk": INTER,
  "Albert Sans": INTER,
  "Public Sans": INTER,
  "Barlow": FIRA_SANS,
  "Barlow Condensed": ROBOTO_CONDENSED,
  "Poiret One": COMFORTAA,
  "Grandstander": COMFORTAA,
  "Quicksand": COMFORTAA,
  "Fredoka": COMFORTAA,
  "Nunito": COMFORTAA,
  "Caveat": COMFORTAA,
};

/** Does the family carry the script? Latin always; an unmeasured family counts as Latin-only. */
export function familySupports(family: string, script: string): boolean {
  if (script === "Latn") return true;
  return (FONT_SCRIPTS[family] ?? []).includes(script as "Cyrl" | "Grek");
}

const FONT_LINK = /https:\/\/fonts\.googleapis\.com\/css2\?([^"'\s>]+)/g;

/**
 * The page's fonts in its language's script (see the header). Latin-script language → the
 * page unchanged. Idempotent: a page already localized has nothing left to swap.
 */
export function localizeFonts(html: string, lang?: string | null): string {
  const script = scriptOfLang(lang);
  if (script === "Latn") return html;
  const renamed = new Map<string, string>();
  const subsets = fontSubsetsOfLang(lang).join(",");
  let out = html.replace(FONT_LINK, (_url, query: string) => {
    const parts = query.replace(/&amp;/g, "&").split("&");
    const families: string[] = [];
    const rest: string[] = [];
    for (const p of parts) {
      if (p.startsWith("family=")) {
        const spec = p.slice("family=".length);
        const name = decodeURIComponent(spec.split(":")[0]!.replace(/\+/g, " "));
        const stand = !familySupports(name, script) ? FONT_STAND_IN[name] : undefined;
        if (stand) renamed.set(name, stand.name);
        const next = `family=${stand ? stand.spec : spec}`;
        if (!families.includes(next)) families.push(next);
      } else if (!p.startsWith("subset=")) {
        rest.push(p);
      }
    }
    return `https://fonts.googleapis.com/css2?${[...families, ...rest, `subset=${subsets}`].join("&")}`;
  });
  // The CSS names each family in quotes ('Fraunces', Georgia, serif) — swap exactly those.
  for (const [from, to] of renamed) {
    out = out.split(`'${from}'`).join(`'${to}'`).split(`"${from}"`).join(`"${to}"`);
  }
  return out;
}
