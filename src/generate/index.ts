// Generate step: Property -> standalone HTML site.
// The prototype lives in /home/mineral/mockups/gen.py (Python). This is where it
// gets ported to TS so the whole pipeline is one language. The design rules are
// fixed: custom SVG line-icon sprite (NO emojis), palette driven by the photos,
// and one genuinely unique spotlight section per property.

import type { Property } from "./types.js";

export interface RenderResult {
  html: string;
  /** Image URLs the renderer expects to be available alongside the HTML. */
  assets: string[];
}

/** Render a full site from one Property record. */
export function render(_property: Property): RenderResult {
  throw new Error("render(): not implemented yet — port from mockups/gen.py");
}
