// Code-level gates of the weekly program gathering (the `poi` module).
//
// WHY THESE ARE IN CODE, NOT IN THE PROMPT. The extraction schema forces a date to
// EXIST, it cannot force it to be RIGHT: measured 2026-09-22, the model returned
// expired and out-of-window programs with perfectly well-formed dates. Every gate
// here is load-bearing (§B.17) — the prompt only asks nicely, these refuse.
//
// Pure functions only: no DB, no network. `scripts/events-gates-check.mts` pins them.

/** How far ahead the recommender looks. The measured chain (17 programs, 0 wrong
 *  dates) ran on a two-week window; the weekly refresh keeps it rolling. */
export const WINDOW_DAYS = 14;

/** A program longer than this is a season ("egész nyáron"), not an event a guest
 *  can plan a day around — and a mis-parsed year range lands here too. */
export const MAX_SPAN_DAYS = 31;

/** Pages per host per weekly batch. The limit is QUANTITY per source, not a domain
 *  whitelist (owner ruling, 2026-09-22): we publish facts + a back-link. */
export const MAX_PAGES_PER_HOST = 3;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day in `YYYY-MM-DD`, or null. "2026-02-30" is not a day. */
export function isoDay(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().slice(0, 10);
  const m = ISO.exec(s);
  if (!m) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Date() rolls 02-30 over to 03-02; a round-trip mismatch means it was not a day.
  return d.toISOString().slice(0, 10) === s ? s : null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type DropReason =
  | "bad_date"
  | "expired"
  | "out_of_window"
  | "too_long"
  | "date_not_in_text"
  | "no_source"
  | "unknown_place"
  | "no_name"
  | "duplicate";

/**
 * The date-window gate. A program qualifies when it is still running on `today`
 * and starts no later than the window end. Returns the normalised dates or the
 * reason it was refused.
 */
export function windowGate(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string,
  windowDays = WINDOW_DAYS,
): { ok: true; start: string; end: string | null } | { ok: false; reason: DropReason } {
  const s = isoDay(start);
  if (!s) return { ok: false, reason: "bad_date" };
  let e = isoDay(end);
  if (e && e < s) return { ok: false, reason: "bad_date" };
  if (e === s) e = null;
  if (e && daysBetween(s, e) > MAX_SPAN_DAYS) return { ok: false, reason: "too_long" };
  if ((e ?? s) < today) return { ok: false, reason: "expired" };
  if (s > addDays(today, windowDays)) return { ok: false, reason: "out_of_window" };
  return { ok: true, start: s, end: e };
}

const MONTHS_HU = [
  ["január", "jan"], ["február", "febr", "feb"], ["március", "márc"], ["április", "ápr"],
  ["május", "máj"], ["június", "jún"], ["július", "júl"], ["augusztus", "aug"],
  ["szeptember", "szept", "szep"], ["október", "okt"], ["november", "nov"], ["december", "dec"],
] as const;

/**
 * Does the page text actually carry this calendar day? The second fact-fidelity
 * gate: the model may produce a well-formed date that no sentence of the page
 * states (§B.17 — "only if the date is IN the text" is a prompt wish, this is the
 * check). Accepted spellings: 2026-09-26 · 2026.09.26. · 09.26. · 09. 26. ·
 * szeptember 26. · szept. 26 — and a range start ("szeptember 25–27.") matches 25.
 */
export function dateMentioned(text: string, iso: string): boolean {
  const m = ISO.exec(iso);
  if (!m) return false;
  const [, y, mm, dd] = m;
  const mon = Number(mm);
  const day = Number(dd);
  const d = `0?${day}`;
  const t = text.toLowerCase();
  const numeric = new RegExp(
    `(?:^|[^0-9])(?:${y}\\s*[.\\-/]\\s*)?0?${mon}\\s*[.\\-/]\\s*${d}(?:[^0-9]|$)`,
  );
  if (t.includes(iso) || numeric.test(t)) return true;
  const names = MONTHS_HU[mon - 1]!.map((n) => n.replace(".", "\\.")).join("|");
  const named = new RegExp(`(?:${names})\\.?\\s*${d}(?:[^0-9]|$)`);
  return named.test(t);
}

/* ------------------------------------------------------------------ dedup ----- */

/** Accent-folded lower case — "Szüreti Napok" and "szureti napok" are one name. */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Words that name the KIND of text, not the event: "Szüreti napok 2026 program" and
// "Szüreti napok" are the same thing.
const STOP = new Set([
  "a", "az", "es", "is", "en", "de", "program", "programok", "programja", "rendezveny",
  "esemeny", "hu", "ev", "evi", "edik", "the", "and",
]);

/**
 * The comparable core of a program name: folded tokens without years, ordinals
 * ("XI.", "8."), filler words and the settlement's own name ("Tihanyban",
 * "Tihanyi" → gone). Measured 2026-09-22: the old key (date + first 24 chars) let
 * "Szüreti napok Tihanyban" / "Szüreti Napok 2026 Tihany" through as two programs.
 */
export function nameTokens(name: string, settlement: string): string[] {
  // The whole folded name (a final vowel dropped: "Zánka" → "zank" catches
  // "zánkai"). NOT a short prefix — "balat" would also eat "Balatoni" in "Balatoni
  // Borhét" and merge unrelated programs of every Balaton-shore town.
  const stem = fold(settlement).replace(/[^a-z]/g, "").replace(/[aeiou]$/, "");
  return fold(name)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 || /^\d$/.test(w))
    .filter((w) => !/^(19|20)\d\d$/.test(w))
    .filter((w) => !/^\d{1,2}$/.test(w))
    .filter((w) => !/^[ivxlc]+$/.test(w))
    .filter((w) => !STOP.has(w))
    .filter((w) => !(stem.length >= 4 && w.startsWith(stem)));
}

/** Stored unique key: the settlement is its own column, so date + sorted core. */
export function dedupKey(name: string, settlement: string, start: string): string {
  const core = [...new Set(nameTokens(name, settlement))].sort().join(" ");
  return `${start}|${core || fold(name).replace(/[^a-z0-9]/g, "").slice(0, 40)}`;
}

function rangesMeet(aS: string, aE: string | null, bS: string, bE: string | null): boolean {
  return aS <= (bE ?? bS) && bS <= (aE ?? aS);
}

/**
 * Two name words are the same word — or one is a Hungarian compound ending in the
 * other ("gasztrofesztivál" ⊃ "fesztivál"). Measured 2026-09-23: "Balatonlellei Murci
 * Gasztrofesztivál 2026" and "Murci fesztivál 2026 - Balatonlelle" went through as two.
 * The shorter word must be ≥5 letters, so "bor" does not swallow every "…bor…".
 */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.endsWith(short);
}

/**
 * Same program, told twice? Only within ONE settlement and overlapping days — then
 * the core-token sets decide: one contains the other (≥2 words), or Jaccard ≥ 0.5.
 * (0.5, measured: "Jazz-a-vége koncertsorozat / Superposition" and "JAZZ-A-VÉGE:
 * SUPERPOSITION//Balaton Színház" share 3 of 6 words and are one concert.)
 * Deliberately NOT across settlements: "Szüreti napok" in Tihany and in Badacsony
 * are two different weekends of the same season.
 */
export function sameProgram(
  a: { name: string; start: string; end: string | null },
  b: { name: string; start: string; end: string | null },
  settlement: string,
): boolean {
  if (!rangesMeet(a.start, a.end, b.start, b.end)) return false;
  const A = new Set(nameTokens(a.name, settlement));
  const B = new Set(nameTokens(b.name, settlement));
  if (!A.size || !B.size) return fold(a.name) === fold(b.name);
  let inter = 0;
  for (const w of A) if ([...B].some((v) => wordsMatch(w, v))) inter++;
  const small = Math.min(A.size, B.size);
  if (inter >= small && small >= 2) return true;
  return inter / (A.size + B.size - inter) >= 0.5;
}

/* --------------------------------------------------------------- distance ----- */

/** Great-circle distance in km. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The distance label's number: null = "HELYBEN" (the program is in the tenant's
 * own settlement), else whole km, never below 1 — a 0,4 km neighbour village is
 * not "0 km". A computation, not a judgement: it cannot hallucinate.
 */
export function distanceKm(
  own: { osmId: string; lat: number; lon: number },
  at: { osmId: string; lat: number; lon: number },
): number | null {
  if (own.osmId === at.osmId) return null;
  return Math.max(1, Math.round(haversineKm(own.lat, own.lon, at.lat, at.lon)));
}
