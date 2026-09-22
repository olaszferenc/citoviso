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
}

export interface SeasonRule {
  /** Does a recurring 'MM-DD' range cover this month-day? Year-end wrap aware. */
  covers(from: string | null | undefined, to: string | null | undefined, monthDay: string): boolean;
  /** 'YYYY-MM-DD' (or a full ISO stamp) → 'MM-DD'. */
  monthDayOf(isoDate: string): string;
  /** First matching season, else the base row, else null. */
  rowFor<T extends SeasonRow>(
    rows: readonly T[],
    monthDay: string,
    isBaseRow: (row: T) => boolean,
  ): T | null;
}

const RULE_URL = new URL("../../assets/runtime/cit-season.cjs", import.meta.url);

export const seasonRule = createRequire(import.meta.url)(RULE_URL.pathname) as SeasonRule;

/** The browser half: the same file, as text, for inlining into the page runtime. */
export const SEASON_JS = readFileSync(RULE_URL, "utf8");
