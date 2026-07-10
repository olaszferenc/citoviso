import type { Region } from "./types.js";

// MVP test regions on Lake Balaton. bbox = [south, west, north, east].
// Kept small for fast Overpass queries; widen once the pipeline is proven.
export const REGIONS: Record<string, Region> = {
  badacsony: {
    id: "badacsony",
    label: "Badacsony (Badacsonytomaj környéke)",
    bbox: [46.77, 17.48, 46.82, 17.56],
  },
  "balaton-north": {
    id: "balaton-north",
    label: "Balaton északi part",
    bbox: [46.75, 17.25, 46.95, 18.05],
  },
  godollo: {
    id: "godollo",
    label: "Gödöllő",
    // Town + immediate surroundings (Máriabesnyő, egyetemi negyed). center ~47.596, 19.356.
    bbox: [47.56, 19.31, 47.63, 19.42],
  },
};

export function getRegion(id: string): Region {
  const r = REGIONS[id];
  if (!r) {
    throw new Error(
      `Unknown region "${id}". Known: ${Object.keys(REGIONS).join(", ")}`,
    );
  }
  return r;
}
