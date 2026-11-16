// THE CURRENCY OF A ROW WRITTEN BEFORE IT HAD ONE (ADR-0450, ország-réteg 3/2).
//
// Booking quotes, site pricing configs and orders written before the money path stored a
// currency are all Hungarian — the market was closed to every other country until then
// (ADR-0111). A missing currency on such a row therefore reads as the forint, and that rule
// lives HERE, once, instead of as a `?? "HUF"` literal on forty lines (the country-layer guard
// ⑥ forbids the literal in the surface files, so a NEW default cannot slip in unnoticed).
// A new row always carries its own currency (the lodging's country, provision.ts / the
// tenant's region, orderRegion.ts) — this is a reading rule for old data, not a default.
export const LEGACY_CURRENCY = "HUF";
