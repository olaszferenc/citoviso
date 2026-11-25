// The TOWN's pictures on the mock of a lead with no or few own photos (owner 2026-11-25, approved
// plan assets/design-refs/console/kepnelkuli-hero/ ⑨, ADR-0479). The generator's one call.
//
//   · 0 own photos → the town's hero (shared out among the town's e-mail leads) + 4–6 local pictures;
//   · 1–4 own photos → the own photos first, each once; the own first photo stays the hero only when
//     the local classifier sees the lodging from OUTSIDE or its view and it is ≥ 1200 px — else the
//     town's hero opens the page. The local pictures join the gallery either way;
//   · ≥ 5 own photos → nothing (the caller does not ask).
// ⛔ The gathering runs only for a lead with an e-mail address (owner 2026-11-25); a lead without one
// uses a CURRENT set its town already has, or gets none (the typographic hero).

import type { TownPhoto } from "../engine/recipe.js";
import { classifyPhotoUrl, outsideScore } from "../media/photoKind.js";
import { ensureTownPhotoSet, isCurrentPick, leadSlotInTown, readTownPhotoSet, shareTownSet } from "../media/townPhotoSet.js";
import type { TownStyle } from "../media/townPick.js";

/** An own first photo opens the page only with this much „outside / view” mass… */
const OWN_HERO_OUTSIDE_MIN = 0.35;
/** …and at least this long edge. */
const OWN_HERO_MIN_PX = 1200;

export interface TownPhotosForMock {
  /** The page's hero when it is the town's picture; null = the own first photo stays the hero (or none). */
  readonly hero: TownPhoto | null;
  readonly gallery: readonly TownPhoto[];
  readonly style: TownStyle | null;
}

export async function townPhotosForMock(input: {
  readonly leadId: string;
  readonly city: string | null | undefined;
  readonly country: string | null | undefined;
  readonly lat: number | null | undefined;
  readonly lon: number | null | undefined;
  readonly email: string | null | undefined;
  readonly ownPhotos: readonly { readonly url: string }[];
}): Promise<TownPhotosForMock | null> {
  const city = (input.city ?? "").trim();
  const country = (input.country ?? "").trim().toUpperCase();
  if (!city || !country) return null;
  const hasEmail = Boolean((input.email ?? "").trim());
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  let set = null;
  try {
    set =
      hasEmail && Number.isFinite(lat) && Number.isFinite(lon)
        ? await ensureTownPhotoSet({ city, country, lat, lon }, "generate")
        : await readTownPhotoSet(country, city);
  } catch (e) {
    console.warn(`  ↳ településkép nem gyűjthető (${city}): ${(e as Error).message}`); // i18n-exempt: operator log
    return null;
  }
  if (!set || !isCurrentPick(set) || (!set.heroes.length && !set.gallery.length)) return null;
  const slot = await leadSlotInTown(input.leadId, country, city);
  const shared = shareTownSet(set, slot);

  let ownHeroStays = false;
  const first = input.ownPhotos[0];
  if (first) {
    const v = await classifyPhotoUrl(first.url).catch(() => null);
    ownHeroStays = Boolean(v && v.kind === "ok" && outsideScore(v) >= OWN_HERO_OUTSIDE_MIN && (v.quality?.long ?? 0) >= OWN_HERO_MIN_PX);
  }
  if (ownHeroStays || !shared.hero) {
    // The own photo opens the page: the town's hero joins the local gallery instead (still once).
    const gallery = [...(shared.hero ? [shared.hero] : []), ...shared.gallery].slice(0, 6);
    return { hero: null, gallery, style: set.style };
  }
  return { hero: shared.hero, gallery: shared.gallery, style: set.style };
}
