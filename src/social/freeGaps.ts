// Free-night gaps for the "last minute" social post (RESEARCH-2026-11-facebook-modul §3.1).
//
// The trigger is a fact from OUR calendar, never a guess: a run of at least
// `minNights` consecutive free nights starting within the next `horizonDays` days.
// "Free" is decided by the same rule the guest's booking calendar uses
// (`getBlockedDaysFrom`, ADR-0114 whole-place relation + ADR-0049 season), so a post
// can never advertise a night the booking form would refuse.

import { getBlockedDaysFrom } from "../tenant/availability.js";

export interface FreeGap {
  /** First free night (YYYY-MM-DD). */
  readonly from: string;
  /** Check-out day: the morning after the last free night (exclusive end). */
  readonly to: string;
  readonly nights: number;
  /**
   * The run reached the horizon: `to` is where we stopped LOOKING, not where the free
   * nights end. A post must not say "until <to>" / "check-out by <to>" for such a gap.
   */
  readonly openEnded: boolean;
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure core: every maximal run of free nights in [from, from + horizonDays) that is at
 * least `minNights` long. A run that reaches the horizon is cut there — beyond it we
 * have not looked, so we do not promise it.
 */
export function freeGaps(
  blockedDays: readonly string[],
  from: string,
  horizonDays = 21,
  minNights = 2,
): FreeGap[] {
  const blocked = new Set(blockedDays);
  const gaps: FreeGap[] = [];
  let runStart: string | null = null;
  let runLen = 0;
  const close = (end: string, openEnded = false): void => {
    if (runStart && runLen >= minNights) gaps.push({ from: runStart, to: end, nights: runLen, openEnded });
    runStart = null;
    runLen = 0;
  };
  for (let i = 0; i < horizonDays; i++) {
    const day = addDaysIso(from, i);
    if (blocked.has(day)) {
      close(day);
    } else {
      if (!runStart) runStart = day;
      runLen++;
    }
  }
  close(addDaysIso(from, horizonDays), true);
  return gaps;
}

/** DB-backed: the free gaps of one unit, with the booking calendar's own rule. */
export async function unitFreeGaps(
  unitId: string,
  today: string,
  horizonDays = 21,
  minNights = 2,
): Promise<FreeGap[]> {
  const blocked = await getBlockedDaysFrom(unitId, today);
  return freeGaps(blocked, today, horizonDays, minNights);
}
