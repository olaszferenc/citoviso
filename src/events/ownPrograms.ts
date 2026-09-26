// The tenant's OWN programs in the weekly recommender (approved contract:
// assets/design-refs/console/programajanlo-sajat/README.md, ADR-0238). A program the
// gathering did not find — the owner's own event, or one he knows of — typed in by
// hand. It lives INSIDE the `poi` picks list (so the owner's order covers both kinds)
// as `{ id: "own-xxxxxxxx", own: {...} }`.
//
// ONE rule set: the admin picker's client script mirrors these rules for instant
// feedback, but the save route runs THIS function, and whatever it refuses is dropped.

import { addDays, fold, MAX_SPAN_DAYS } from "./gates.js";

/** Contract ②: how far ahead an own program may start. */
export const OWN_AHEAD_DAYS = 90;
/** Contract ②: title length cap (same as the rewrite of a gathered title). */
export const OWN_TITLE_MAX = 120;
/** A settlement name is short; anything longer is not a place name. */
export const OWN_PLACE_MAX = 60;

export const OWN_ID_RE = /^own-[0-9a-z]{8}$/;

export interface OwnProgram {
  readonly title: string;
  readonly start: string;
  /** null = one-day program. */
  readonly end: string | null;
  /** null = "Helyben" (the tenant's own settlement), else the typed settlement name. */
  readonly place: string | null;
  /** Optional link the owner gave (normalised, http/https only). */
  readonly url: string | null;
}

export type OwnError = "title" | "start" | "start_past" | "start_far" | "end" | "end_span" | "place" | "url";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !ISO.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * "facebook.com/events/1" → "https://facebook.com/events/1". Empty → null (no link).
 * Returns undefined when the text is not a web address at all.
 */
export function normalizeProgramUrl(raw: unknown): string | null | undefined {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,}$/i.test(u.hostname)) return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/**
 * Validate + normalise one own program. `fresh` = the owner is creating/editing it
 * now: then a start in the past is an error. A stored program that already began
 * (a running multi-day festival) is NOT refused on a later save — it expires by
 * itself (contract ⑤), the resolver drops it.
 */
export function cleanOwnProgram(
  raw: unknown,
  today: string,
  fresh = true,
): { ok: true; value: OwnProgram } | { ok: false; errors: OwnError[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const errors: OwnError[] = [];
  const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim() : "";
  if (!title || title.length > OWN_TITLE_MAX) errors.push("title");
  const start = r.start;
  if (!isDay(start)) errors.push("start");
  else if (fresh && start < today) errors.push("start_past");
  else if (start > addDays(today, OWN_AHEAD_DAYS)) errors.push("start_far");
  let end: string | null = null;
  if (r.end !== undefined && r.end !== null && r.end !== "") {
    if (!isDay(r.end) || (isDay(start) && r.end < start)) errors.push("end");
    else if (isDay(start) && r.end > addDays(start, MAX_SPAN_DAYS)) errors.push("end_span");
    else end = r.end === start ? null : r.end;
  }
  let place: string | null = null;
  if (r.place !== undefined && r.place !== null) {
    const p = typeof r.place === "string" ? r.place.replace(/\s+/g, " ").trim() : "";
    if (!p || p.length > OWN_PLACE_MAX) errors.push("place");
    else place = p;
  }
  const url = normalizeProgramUrl(r.url);
  if (url === undefined) errors.push("url");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { title, start: start as string, end, place, url: url ?? null } };
}

/** Still on the page? An own program falls off after its last day (contract ⑤). */
export function ownExpired(p: OwnProgram, today: string): boolean {
  return (p.end ?? p.start) < today;
}

/** The settlement a typed place name means, if it is in the tenant's circle. */
export function matchSettlement<T extends { name: string }>(name: string, around: readonly T[]): T | null {
  const f = fold(name).trim();
  return around.find((s) => fold(s.name) === f) ?? null;
}
