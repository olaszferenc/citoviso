// "Real nearness" of a program for a social post: the driving route from the lodging,
// not the crow-flies line between settlement centres (coordinator, 2026-11-04: from
// Siófok, Tihany is "6 km" by air but across the lake). A route that needs a ferry is
// not near, however short. Routing: the public OSRM demo router (no key, $0); if it
// cannot answer, the program counts as NOT near — a post then sticks to the lodging's
// own settlement rather than guess.

export const NEAR_DRIVE_MIN = 20;

export interface DriveLeg {
  readonly km: number;
  readonly min: number;
  readonly ferry: boolean;
}

const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";

interface OsrmStep {
  mode?: string;
}
interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; legs: { steps?: OsrmStep[] }[] }[];
}

/** Driving route lodging → point, or null when the router does not answer. */
export async function driveLeg(fromLat: number, fromLon: number, toLat: number, toLon: number): Promise<DriveLeg | null> {
  const url = `${OSRM}/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false&steps=true`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "citoviso-social/0.1 (+https://citoviso.com)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as OsrmResponse;
    const r = body.code === "Ok" ? body.routes?.[0] : undefined;
    if (!r) return null;
    const ferry = r.legs.some((l) => (l.steps ?? []).some((s) => s.mode === "ferry"));
    return { km: Math.round(r.distance / 100) / 10, min: Math.round(r.duration / 60), ferry };
  } catch {
    return null;
  }
}

/** Near enough to recommend from this lodging: no ferry and a short drive. */
export function isNear(leg: DriveLeg | null): boolean {
  return !!leg && !leg.ferry && leg.min <= NEAR_DRIVE_MIN;
}
