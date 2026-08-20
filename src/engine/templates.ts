// Art-template registry (ADR-0027 template-first). Each entry is a COMPLETE, reference-
// fidelity page template (one module per reference direction under templates/). Adding a
// template = one module + one import line here; the generator's default and the curated
// skin rails live on the template objects themselves. Shared helpers: templateKit.ts.

import type { ArtTemplate } from "./templateKit.js";
import { ARTDECO } from "./templates/artdeco.js";
import { AURORA } from "./templates/aurora.js";
import { BRUTALISM } from "./templates/brutalism.js";
import { CARD_SIDEBAR } from "./templates/cardSidebar.js";
import { CINEMATIC } from "./templates/cinematic.js";
import { CLAYMORPHISM } from "./templates/claymorphism.js";
import { DARK_LUXURY } from "./templates/darkLuxury.js";
import { DOPAMINE } from "./templates/dopamine.js";
import { EDITORIAL } from "./templates/editorial.js";
import { FULLBLEED } from "./templates/fullbleed.js";
import { HORIZONTAL } from "./templates/horizontal.js";
import { ORGANIC } from "./templates/organic.js";
import { PARALLAX } from "./templates/parallax.js";
import { SCRAPBOOK } from "./templates/scrapbook.js";
import { TRANSIT } from "./templates/transit.js";
import { WATERCOLOR } from "./templates/watercolor.js";

export type { ArtTemplate } from "./templateKit.js";
export { pickTemplateSkin } from "./templateKit.js";

export const TEMPLATES: Readonly<Record<string, ArtTemplate>> = {
  [FULLBLEED.id]: FULLBLEED,
  [DARK_LUXURY.id]: DARK_LUXURY,
  [CARD_SIDEBAR.id]: CARD_SIDEBAR,
  [EDITORIAL.id]: EDITORIAL,
  [PARALLAX.id]: PARALLAX,
  [BRUTALISM.id]: BRUTALISM,
  [DOPAMINE.id]: DOPAMINE,
  [HORIZONTAL.id]: HORIZONTAL,
  [CINEMATIC.id]: CINEMATIC,
  [TRANSIT.id]: TRANSIT,
  [ORGANIC.id]: ORGANIC,
  [ARTDECO.id]: ARTDECO,
  [SCRAPBOOK.id]: SCRAPBOOK,
  [WATERCOLOR.id]: WATERCOLOR,
  [AURORA.id]: AURORA,
  [CLAYMORPHISM.id]: CLAYMORPHISM,
};
