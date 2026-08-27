// Guest-page amenity icons (plan F follow-up, owner order 2026-08-27: "legyen a
// vendég oldal ikonos megjelenítés is").
//
// Resolution order, per item:
//   1. amenityIconMap — the translation bridge. On a non-Hungarian page the
//      rendered label is the TRANSLATED string, so the exact-label match below
//      would miss; applyTranslationMap records translated-label → catalogue id
//      at the one point where source and translation are both in hand.
//   2. Exact catalogue label ("Medence", "Saját stég") → that item's own SVG —
//      the same 70-icon set the owner approved for the admin picker, so the
//      guest page and the picker speak one visual language.
//   3. The Hungarian keyword matcher (engine icons.ts) — free-text labels the
//      owner typed into "Egyéb" still get a fitting decorative icon.
//   4. Neutral check mark (matchIcon's own fallback) — never an emoji (§B.4).
//
// The icon is DECORATIVE: it dresses the real text, never adds a claim (§B.17).
// Deterministic — mock=live holds.

import { AMENITY_CATALOG, type AmenityItem } from "../tenant/amenityCatalog.js";
import { iconSvg, matchIcon } from "./icons.js";

const byLabel = new Map<string, AmenityItem>(AMENITY_CATALOG.map((a) => [a.label, a]));
const byId = new Map<string, AmenityItem>(AMENITY_CATALOG.map((a) => [a.id, a]));

function catalogueSvg(item: AmenityItem): string {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.icon}</svg>`
  );
}

/** Inline SVG for one amenity label (see resolution order above). */
export function amenityIconSvg(
  label: string,
  iconMap?: Readonly<Record<string, string>>,
): string {
  const mapped = iconMap?.[label.trim()];
  if (mapped) {
    const item = byId.get(mapped);
    if (item) return catalogueSvg(item);
  }
  const exact = byLabel.get(label.trim());
  if (exact) return catalogueSvg(exact);
  return iconSvg(matchIcon(label));
}

/** Catalogue id for a SOURCE (Hungarian) label — the bridge-builder's half:
 *  applyTranslationMap keys this by the translated label. */
export function amenityIconIdFor(sourceLabel: string): string | null {
  return byLabel.get(sourceLabel.trim())?.id ?? null;
}
