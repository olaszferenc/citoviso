// FROZEN CLOCK for the KB screenshot generators (ADR-0220). The partner console
// views measure against "now" (overdue days, aging buckets, the current year's chart),
// and the demo seed dates its documents relative to "now" — so a capture taken
// tomorrow differs from today's, and the pixel gate would fail every morning on an
// unchanged commit. With KB_FROZEN_NOW set, every Date in this process reads that
// instant instead: `Date.now()` and a no-argument `new Date()`.
//
// Plain .mjs on purpose: it is preloaded into the seed child process with
// `node --import`, before any TypeScript loader is involved.
//
// ⚠️ `instanceof Date` must keep working for dates built by code that captured the
// REAL constructor (the pg driver serialises parameters with an instanceof check) —
// hence the Symbol.hasInstance bridge.

const raw = process.env.KB_FROZEN_NOW;
if (raw) {
  const FIXED = Date.parse(raw);
  if (Number.isNaN(FIXED)) {
    console.error(`⛔ KB_FROZEN_NOW nem értelmezhető időpont: ${raw}`);
    process.exit(2);
  }
  const Real = Date;
  class FrozenDate extends Real {
    constructor(...args) {
      if (args.length === 0) super(FIXED);
      else super(...args);
    }
    static now() {
      return FIXED;
    }
    static [Symbol.hasInstance](x) {
      return x instanceof Real;
    }
  }
  globalThis.Date = FrozenDate;
}
