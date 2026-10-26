// Tenant-aktivitás — what the owner does in their own admin (ADR-0407, Próba riport).
//
// WHY THIS EXISTS: the trial's inside was invisible. The report knew when a trial started
// and how it ended; how often the owner came back, what they saved, whether they looked at
// their own site and where an order stopped were nowhere (tenant_user.last_login_at is
// overwritten on every login). Approved plan: assets/design-refs/console/proba-riport/.
//
// TWO RULES:
//   1. RECORDING MAY NEVER BREAK OR SLOW A REQUEST. Every entry point is fire-and-forget and
//      swallows its own error with a log line — a measurement problem must never become an
//      admin (or checkout) problem. Same rule as siteVisit.ts (ADR-0108).
//   2. ONE FACT, ONE PLACE. The order's submission, the payment, the lapse and the expiry
//      notices already live in their own tables; they are read there, never copied here.
//
// No cookie, no client identifier: the identity is the logged-in tenant session (or, on the
// /folytatas checkout, the trial behind the outreach token).

import type http from "node:http";
import { db } from "../db/client.js";
import type { TenantActivityKind } from "../db/schema.js";
import { readSession } from "../auth/tenantAuth.js";
export { orderOpenFrom, withOrderFrom } from "./orderFrom.js";

/** One admin_open per tenant per this window — a page reload is not a new visit. */
export const ADMIN_OPEN_WINDOW_MS = 30 * 60_000;
/** One site_view per tenant per this window (the „Oldal" button twice in a row = one look). */
const SITE_VIEW_WINDOW_MS = 30 * 60_000;

const lastOpen = new Map<string, number>();
const lastSiteView = new Map<string, number>();

/** Insert one row; never throws (rule 1). */
export function recordTenantActivity(
  tenantId: string,
  kind: TenantActivityKind,
  detail: Record<string, unknown> = {},
): void {
  void db
    .insertInto("tenant_activity")
    .values({ tenant_id: tenantId, kind, detail: JSON.stringify(detail) })
    .execute()
    .catch((e: unknown) => console.warn(`[activity] ${kind} rögzítése sikertelen: ${(e as Error).message}`));
}

/** The same, from a tenant_user id (the login paths know the user, not the tenant). */
export function recordTenantUserActivity(
  tenantUserId: string,
  kind: TenantActivityKind,
  detail: Record<string, unknown> = {},
): void {
  void db
    .selectFrom("tenant_user")
    .select("tenant_id")
    .where("id", "=", tenantUserId)
    .executeTakeFirst()
    .then((u) => {
      if (u) recordTenantActivity(u.tenant_id, kind, detail);
    })
    .catch((e: unknown) => console.warn(`[activity] ${kind} rögzítése sikertelen: ${(e as Error).message}`));
}

/** True when `key` was not seen within `windowMs` (and marks it seen now). */
function firstInWindow(seen: Map<string, number>, key: string, windowMs: number, now: number): boolean {
  const prev = seen.get(key);
  if (prev !== undefined && now - prev < windowMs) return false;
  seen.set(key, now);
  if (seen.size > 5000) for (const [k, t] of seen) if (now - t >= windowMs) seen.delete(k);
  return true;
}

/** The admin was opened (GET /admin answered 200). At most one row per ADMIN_OPEN_WINDOW_MS. */
export function recordAdminOpen(tenantId: string, now = Date.now()): void {
  if (firstInWindow(lastOpen, tenantId, ADMIN_OPEN_WINDOW_MS, now)) recordTenantActivity(tenantId, "admin_open");
}

/** The owner opened their own live site from the admin. At most one row per window. */
export function recordSiteView(tenantId: string, now = Date.now()): void {
  if (firstInWindow(lastSiteView, tenantId, SITE_VIEW_WINDOW_MS, now)) recordTenantActivity(tenantId, "site_view");
}

/**
 * POST /admin/<path> → the admin TAB the save belongs to (TABS in adminViews.ts), or null
 * when the request is not a content save (marking a message read, the activity beacon).
 * Exported for the check: every /admin POST route must map or be named here on purpose.
 */
export function saveAreaOf(pathname: string): string | null {
  const p = pathname.replace(/^\/admin\//, "");
  if (p === "activity" || p === "uzenetek/olvasott") return null;
  if (p === "text" || p === "legal") return "szovegek";
  if (p === "photos" || p.startsWith("photos/")) return "fotok";
  if (p === "elerhetoseg" || p === "contact" || p === "timezone") return "elerhetoseg";
  if (p.startsWith("booking/") || p === "review/decide") return "foglalasok";
  if (p === "domain/order") return "webcim";
  if (p.startsWith("subscription/") || p.startsWith("wallet/")) return "penztarca";
  if (p === "password") return "fiok";
  // modules, module-config, programs, multilang, units, prices, availability, calendar-link,
  // booking-setup — everything the Modulok tab edits.
  return "modulok";
}

/**
 * Hook for every /admin request on the public server: records admin_open (GET /admin, 200)
 * and save (POST /admin/*, < 400) once the response has gone out. The session is read from
 * the signed cookie only — no DB work on the request path.
 */
export function watchAdminRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
  const isOpen = req.method === "GET" && pathname === "/admin";
  const isSave = req.method === "POST" && pathname.startsWith("/admin/");
  if (!isOpen && !isSave) return;
  const area = isSave ? saveAreaOf(pathname) : null;
  if (isSave && !area) return;
  const session = readSession(req);
  if (!session) return;
  res.once("finish", () => {
    if (res.statusCode >= 400) return;
    if (isOpen && res.statusCode !== 200) return;
    void db
      .selectFrom("tenant_user")
      .select("tenant_id")
      .where("id", "=", session.id)
      .executeTakeFirst()
      .then((u) => {
        if (!u) return;
        if (isOpen) recordAdminOpen(u.tenant_id);
        else recordTenantActivity(u.tenant_id, "save", { area });
      })
      .catch((e: unknown) => console.warn(`[activity] admin-kérés rögzítése sikertelen: ${(e as Error).message}`));
  });
}

/** The continuation checkout's client steps that the report shows (cit-configurator.js). */
export const CHECKOUT_STEPS: Readonly<Record<string, string>> = {
  billing_step_open: "billing",
  billing_invalid: "invalid",
  order_intent_submitted: "submitted",
  order_send_failed: "failed",
};
