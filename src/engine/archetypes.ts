// Archetype = LAYOUT GRAMMAR as a registry entry (ADR-0016). Where a SKIN changes only
// LOOK (--cit-* tokens) and a PRIMITIVE is a fixed content block, an ARCHETYPE decides how
// the already-selected sections are ARRANGED on the page (stacked / split / reordered flow).
//
// EXTENSIBILITY CONTRACT (the whole point of this layer): adding an archetype = adding ONE
// entry to ARCHETYPES. The renderer (render.ts) and the planner (planner.ts) DERIVE
// everything from this registry — the planner's schema enum and prompt are Object.keys/
// values of ARCHETYPES — so a new archetype is instantly selectable by the AI with ZERO
// changes to core code. Each archetype's CSS is scoped under `.cit-arch-<id>` (set on the
// <body>), so archetypes are ISOLATED: a new one cannot break an existing one. arrange() is
// LAYOUT-ONLY — it MUST NOT add or drop sections (inclusion / data-gating is the planner +
// enforce() boundary); it only orders and wraps the sections it is given.

import type { SectionKind } from "./recipe.js";

export interface RenderedSection {
  readonly kind: SectionKind;
  readonly html: string;
}

export interface Archetype {
  readonly id: string;
  readonly label: string;
  /** One-line mood hint fed to the AI planner (single source → no prompt drift). */
  readonly hint: string;
  /** Archetype-scoped CSS. MUST dress only from --cit-* tokens and scope every rule under
   *  `.cit-arch-<id>` so archetypes stay isolated. May be empty (e.g. the stacked baseline). */
  readonly css: string;
  /** Layout-only arrangement of the ALREADY-SELECTED sections (in enforce() order). */
  arrange(sections: readonly RenderedSection[]): string;
}

/** Split sections into the spine anchors (hero first, enquiry last) and the free middle. */
function partition(sections: readonly RenderedSection[]) {
  const hero = sections.filter((s) => s.kind === "hero");
  const enquiry = sections.filter((s) => s.kind === "enquiry");
  const middle = sections.filter((s) => s.kind !== "hero" && s.kind !== "enquiry");
  return { hero, middle, enquiry };
}

const join = (sections: readonly RenderedSection[]): string =>
  sections.map((s) => s.html).join("\n    ");

export const ARCHETYPES: Readonly<Record<string, Archetype>> = {
  // Baseline: full-width bands in recipe order. Identical to the pre-archetype engine, so
  // it is the safe default and the fallback target.
  stacked: {
    id: "stacked",
    label: "Egyszerű — egymás alatti sávok",
    hint: "letisztult, egymás alatti teljes szélességű sávok; semleges, univerzális.",
    css: "",
    arrange: (sections) => join(sections),
  },

  // Editorial split: hero + enquiry stay full-width anchors; the middle content sections sit
  // in a 2-column grid on wide screens (single column on mobile). A denser, magazine feel.
  "split-editorial": {
    id: "split-editorial",
    label: "Szerkesztői — kéthasábos törzs",
    hint: "magazinos, kéthasábos középső törzs; tartalmas, szerkesztői hangulat.",
    css: `.cit-arch-split-editorial .cit-arch-split { display: grid; gap: 0; grid-template-columns: 1fr; }
  @media (min-width: 900px) {
    .cit-arch-split-editorial .cit-arch-split { grid-template-columns: 1fr 1fr; align-items: start; }
    .cit-arch-split-editorial .cit-arch-split > * { border-right: 1px solid var(--cit-line); }
    .cit-arch-split-editorial .cit-arch-split > *:last-child { border-right: 0; }
  }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const mid = middle.length
        ? `<div class="cit-arch-split">\n      ${join(middle)}\n    </div>`
        : "";
      return [join(hero), mid, join(enquiry)].filter(Boolean).join("\n    ");
    },
  },

  // Gallery-forward: pulls the gallery up (right after the hero) as a full-bleed showcase,
  // then the rest. A different visual FLOW from the exact same sections.
  "gallery-forward": {
    id: "gallery-forward",
    label: "Galéria-vezérelt — képekkel elöl",
    hint: "vizuális, fotó-vezérelt; a galéria elöl, teljes szélességű bemutató.",
    css: `.cit-arch-gallery-forward .cit-gallery .cit-section-inner { max-width: none; padding-inline: 0; }
  .cit-arch-gallery-forward .cit-gallery-grid { gap: 2px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const gallery = middle.filter((s) => s.kind === "gallery");
      const rest = middle.filter((s) => s.kind !== "gallery");
      return join([...hero, ...gallery, ...rest, ...enquiry]);
    },
  },

  // Sidebar: the hero becomes a sticky left rail on desktop; the content scrolls beside it.
  // A portfolio/magazine feel. Collapses to stacked on mobile.
  sidebar: {
    id: "sidebar",
    label: "Oldalsáv — ragadós hero-rail",
    hint: "ragadós hero bal oldalt, a tartalom mellette görget; portfólió-szerű, igényes.",
    css: `@media (min-width: 900px) {
    .cit-arch-sidebar .cit-arch-swrap { display: grid; grid-template-columns: 34% 1fr; align-items: start; }
    .cit-arch-sidebar .cit-arch-side { position: sticky; top: 0; align-self: start; height: 100vh; }
    .cit-arch-sidebar .cit-arch-side .cit-hero { height: 100%; display: flex; align-items: center;
      border-bottom: 0; border-right: 1px solid var(--cit-line); }
  }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      return `<div class="cit-arch-swrap">
      <div class="cit-arch-side">${join(hero)}</div>
      <div class="cit-arch-main">${join([...middle, ...enquiry])}</div>
    </div>`;
    },
  },

  // Framed: the whole page floats as a bordered "brochure card" on a tinted backdrop. A
  // printed, considered look — distinct on every width (not just desktop).
  framed: {
    id: "framed",
    label: "Keretezett — brosúra-lap",
    hint: "keretezett, lebegő brosúra-lap tónusos háttéren; nyomtatott, igényes.",
    css: `.cit-arch-framed { background: var(--cit-line); }
  .cit-arch-framed .cit-arch-frame { max-width: 1200px; margin: clamp(0px, 4vw, 48px) auto;
    background: var(--cit-bg); border: 1px solid var(--cit-line);
    border-radius: calc(var(--cit-radius) * 1.4); overflow: hidden; box-shadow: var(--cit-shadow); }`,
    arrange: (sections) => `<div class="cit-arch-frame">${join(sections)}</div>`,
  },

  // Bento: an asymmetric middle grid (features narrow, gallery wide) with denser gallery
  // tiles. A dynamic, magazine-mosaic arrangement. Collapses to a single column on mobile.
  bento: {
    id: "bento",
    label: "Bento — aszimmetrikus rács",
    hint: "aszimmetrikus rács, sűrű galéria-csempék; magazinos, dinamikus.",
    css: `@media (min-width: 900px) {
    .cit-arch-bento .cit-arch-bento-grid { display: grid; grid-template-columns: 5fr 7fr; align-items: start; }
  }
  .cit-arch-bento .cit-gallery-grid { grid-template-columns: repeat(3, 1fr); gap: 4px; }`,
    arrange: (sections) => {
      const { hero, middle, enquiry } = partition(sections);
      const mid = middle.length ? `<div class="cit-arch-bento-grid">${join(middle)}</div>` : "";
      return [join(hero), mid, join(enquiry)].filter(Boolean).join("\n    ");
    },
  },
};
