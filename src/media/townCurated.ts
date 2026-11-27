// THE CURATED TOWN LIBRARY (owner 2026-11-27, „becsületbeli ügy”, ADR-0508).
//
// The automatic picker (townPick.ts + the subscription judge) finds no „jó” hero for some towns: measured 11-27,
// Zalaegerszeg, Szarvas, Eszteregnye, Derekegyház and Vaszar — every candidate was a locomotive, a station, a plaque or
// a dull detail, and a lead with no own photo then gets only the typographic page (no second plan possible). The owner's
// answer: such towns get hand-picked, freely licensed pictures (Wikimedia Commons, author + licence kept), the town's
// own or — where the town has none — the landscape around it / its region, beautiful and characteristic.
//
// HOW IT JOINS: the committed library (townCurated.json, written by scripts/town-photo-curated-add.mts, which reads the
// author / licence / size from Commons) is merged into the town's set at READ time (readTownPhotoSet), so every reader —
// the generator, the chain's retry, the send gates — sees ONE set, and a deploy carries the library to prod without a
// database write. A curated picture is a „jó” judged pick of the current picker version; the town's own automatic
// „jó” pictures stay behind the curated ones.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TownPick, TownStyle, TownTier } from "./townPick.js";

export interface CuratedTown {
  readonly country: string;
  /** The town's key (townPhotoSet.townKey: folded name). */
  readonly cityKey: string;
  readonly city: string;
  readonly style: TownStyle;
  readonly heroes: readonly TownPick[];
  readonly gallery: readonly TownPick[];
  /** Why it was curated (the owner's decision, the date). */
  readonly note: string;
}

let cache: readonly CuratedTown[] | null = null;

/** The committed library (empty when the file is missing or unreadable — never breaks a reader). */
export function curatedTowns(): readonly CuratedTown[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL("./townCurated.json", import.meta.url)), "utf8")) as { towns?: CuratedTown[] };
    cache = Array.isArray(raw.towns) ? raw.towns : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** Test hook: replace the library (null = reload from the file). */
export function setCuratedTownsForTest(towns: readonly CuratedTown[] | null): void {
  cache = towns;
}

export function curatedTown(country: string, cityKey: string): CuratedTown | null {
  const c = country.toUpperCase();
  return curatedTowns().find((t) => t.country === c && t.cityKey === cityKey) ?? null;
}

/** The best tier among the heroes (town > land > region) — what the set reports. */
export function bestTier(picks: readonly TownPick[]): TownTier | "none" {
  if (picks.some((p) => p.tier === "town")) return "town";
  if (picks.some((p) => p.tier === "land")) return "land";
  return picks.length ? "region" : "none";
}

/**
 * The curated pictures first, then the set's own ones not already among them (same url). Pure — the reader and the
 * check share it.
 */
export function mergeCurated(own: { heroes: readonly TownPick[]; gallery: readonly TownPick[] } | null, cur: CuratedTown): { heroes: TownPick[]; gallery: TownPick[] } {
  const seen = new Set<string>([...cur.heroes, ...cur.gallery].map((p) => p.url));
  // the automatic set's pictures join only with the judge's „jó” (a „gyenge” one was kept there as a filler; next to a
  // curated choice it would be the page's weakest picture — measured 11-27: Vaszar's street panorama failed the gate)
  const fresh = (p: TownPick) => !seen.has(p.url) && (p.judge?.verdict ?? "jó") === "jó";
  return {
    heroes: [...cur.heroes, ...(own?.heroes ?? []).filter(fresh)],
    gallery: [...cur.gallery, ...(own?.gallery ?? []).filter(fresh)],
  };
}
