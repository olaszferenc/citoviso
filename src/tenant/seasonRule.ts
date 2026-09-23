// The season-matching rule — ONE implementation, two consumers.
//
// The rule itself is assets/runtime/cit-season.cjs (see its header for the two copies
// it merges and the year-qualified-season work it prepares). This module is only the
// loader, mirroring src/payment/couponRule.ts: Node requires it, and the generated page
// inlines the very same bytes into its runtime <script>, so the amount the guest READS
// and the amount the server FREEZES onto the booking request cannot come from different
// arithmetic. Guard: scripts/season-rule-check.mts.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

/** A price row, as either side happens to shape it. */
export interface SeasonRow {
  readonly from?: string | null;
  readonly to?: string | null;
  /** 0072: year-bound window ('YYYY-MM-DD', inclusive); absent/null = timeless. */
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
}

export interface SeasonRule {
  /** Does a recurring 'MM-DD' range cover this month-day? Year-end wrap aware. */
  covers(from: string | null | undefined, to: string | null | undefined, monthDay: string): boolean;
  /** 'YYYY-MM-DD' (or a full ISO stamp) → 'MM-DD'. */
  monthDayOf(isoDate: string): string;
  /** Is a 'YYYY-MM-DD' day inside the row's year-bound window? Timeless rows: always. */
  inWindow(row: SeasonRow, isoDay: string): boolean;
  /** The row in effect on a night: year-bound season → season → dated base → base → null. */
  rowFor<T extends SeasonRow>(
    rows: readonly T[],
    isoDay: string,
    isBaseRow: (row: T) => boolean,
  ): T | null;
  /** 0073: one year's occurrence of a recurring season ("2026/27" when it wraps). */
  occurrence(from: string, to: string, year: number): SeasonOccurrence;
  /** 0073: the first year whose occurrence has not ended by `isoToday`. */
  firstOpenYear(from: string, to: string, isoToday: string): number;
  /** 0073: what the owner typed → 'MM-DD' ("11.01", "1101", "11/1" …), or null. */
  normMonthDay(raw: string): string | null;
}

export interface SeasonOccurrence {
  readonly year: number;
  /** 'YYYY-MM-DD', inclusive. */
  readonly start: string;
  readonly end: string;
  /** "2027", or "2026/27" for a season that runs over the year end. */
  readonly label: string;
}

const RULE_URL = new URL("../../assets/runtime/cit-season.cjs", import.meta.url);

export const seasonRule = createRequire(import.meta.url)(RULE_URL.pathname) as SeasonRule;

/** The browser half: the same file, as text, for inlining into the page runtime. */
export const SEASON_JS = readFileSync(RULE_URL, "utf8");
