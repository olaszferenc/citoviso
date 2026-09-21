// The coupon/first-charge rounding rule — ONE implementation, two consumers.
//
// The rule itself is assets/runtime/cit-coupon.cjs (see its header for the measured
// 1 626 vs 1 627 split it closes). This module is only the loader: Node requires it,
// and the tenant-admin splices the very same bytes into its inline script, so the
// browser cannot be running a different version of the arithmetic than the order is
// priced with. Guard: scripts/coupon-rounding-check.mts.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export interface FirstChargeSplit {
  /** Per-module amounts, allocated so they sum to `total` exactly. */
  readonly lines: readonly number[];
  /** What the buyer is charged now — the number on the order and on the screen. */
  readonly total: number;
}

export interface CouponRule {
  discount(listPrice: number, percent: number): number;
  splitFirstCharge(
    monthlyPrices: readonly number[],
    months: number,
    percent: number,
  ): FirstChargeSplit;
}

const RULE_URL = new URL("../../assets/runtime/cit-coupon.cjs", import.meta.url);

export const couponRule = createRequire(import.meta.url)(RULE_URL.pathname) as CouponRule;

/** The browser half: the same file, as text, for inlining into an admin script. */
export const COUPON_JS = readFileSync(RULE_URL, "utf8");
