// ADR-0290 — the tenant-admin request's ACCOMMODATION ZONE, for the view layer.
//
// Same reasoning as the console's language context (src/console/i18nCtx.ts): the tenant
// admin has dozens of date formatters (fmtDate, fmtDateTime, relDay, the booking deadline
// labels, "Utoljára frissült" …) called from each other freely. Threading a `tz` argument
// through every signature is exactly where one missed hand-off prints one screen in the
// wrong zone — silently, and only for the owner who is NOT in Budapest. AsyncLocalStorage
// belongs to the request, survives awaits, and cannot leak between concurrent requests.
//
// ⚠️ For VIEWS only. Logic (booking "today", price expiry, mails, ticks) resolves the zone
// explicitly from its tenant/site/unit id (src/tenant/timeZone.ts) — a background job has
// no request, and a context-dependent "today" there would silently fall back.

import { AsyncLocalStorage } from "node:async_hooks";

import { APP_TZ, todayIn } from "../text/zoneTime.js";

/** Mutable holder: the request enters the context BEFORE the tenant (and thus its zone)
 *  is known; `currentTenant` fills it in when the session loads. */
const store = new AsyncLocalStorage<{ tz: string }>();

/** Run one request inside a fresh zone context (platform zone until a tenant is known). */
export function runWithViewZone<T>(fn: () => T): T {
  return store.run({ tz: APP_TZ }, fn);
}

/** Run `fn` in a GIVEN zone (renderers/guards that already know the accommodation). */
export function runWithTenantZone<T>(tz: string, fn: () => T): T {
  return store.run({ tz }, fn);
}

/** Set the zone for the CURRENT request (no-op outside one). */
export function setViewZone(tz: string): void {
  const s = store.getStore();
  if (s) s.tz = tz;
}

/** The current tenant request's zone; outside one, the platform zone. */
export function viewZone(): string {
  return store.getStore()?.tz ?? APP_TZ;
}

/** The current tenant request's "today" — views only (see the header). */
export function viewToday(now: Date = new Date()): string {
  return todayIn(viewZone(), now);
}
