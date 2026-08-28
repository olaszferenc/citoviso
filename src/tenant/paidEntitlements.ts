// The billing truth for a tenant whose site goes (or is) LIVE: its active module
// entitlements are EXACTLY the modules it has paid for.
//
// Why this file exists (measured 2026-08-26, not theorised). Three live tenants
// held modules nobody bought: Villa Suzy Zamárdi paid a 4 880 Ft order for
// `gallery/enquiry/location` and held 13 entitlements; Nyugalom Vendégház had no
// order at all and held 12; Aszfalt panzió held `multilang` (14 900 Ft) against
// two order rows with zero payments.
//
// The mechanism was not a hidden loophole — it was an ADDITIVE write. Both
// `convertLead` (provision.ts) and `activateUpsell` (moduleUpsell.ts) insert with
// `onConflict … doUpdateSet({ active: true })`: they only ever turn entitlements
// ON. The operator's pre-payment ALL-IN preview (modulesForConversion falls back
// to the full subscription catalogue when there is no order yet) therefore
// SURVIVED the paid activation that followed it — the paid order switched on its
// three modules and left the other ten standing.
//
// ⚠️ A `provisioned` (private preview) tenant is deliberately NOT reconciled by
// this module. ADR-0014 separates provisioning from go-live and lets the preview
// run before payment — that preview IS the conversion hook, and stripping it
// would empty the very page we ask the owner to pay for. Reconciliation belongs
// to the moment money changes hands, which is why the only callers are the two
// paid paths in src/payment/service.ts.
import { db } from "../db/client.js";

/** Modules the tenant has actually PAID for: the union over every order_intent
 *  of theirs that carries a `paid` payment (initial checkout, upsell, one-time). */
export async function paidModuleIds(tenantId: string): Promise<string[]> {
  const ids = new Set<string>();
  const collect = (rows: readonly { modules: unknown }[]): void => {
    for (const row of rows) {
      const list = (row.modules as string[] | null) ?? [];
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (typeof m === "string" && m.trim()) ids.add(m.trim());
      }
    }
  };

  // (a) Orders bound straight to the tenant: upsell (0033) and one-time (multilang).
  collect(
    await db
      .selectFrom("order_intent")
      .innerJoin("payment", "payment.order_intent_id", "order_intent.id")
      .select(["order_intent.modules as modules"])
      .where("order_intent.tenant_id", "=", tenantId)
      .where("payment.status", "=", "paid")
      .execute(),
  );

  // (b) The INITIAL checkout predates the tenant, so it is reachable only through
  //     prospect → lead. Without this leg every converted customer would read as
  //     "paid for nothing" and lose their whole subscription.
  const tenant = await db
    .selectFrom("tenant")
    .select(["lead_id"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  if (tenant) {
    collect(
      await db
        .selectFrom("order_intent")
        .innerJoin("payment", "payment.order_intent_id", "order_intent.id")
        .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
        .select(["order_intent.modules as modules"])
        .where("prospect.lead_id", "=", tenant.lead_id)
        .where("payment.status", "=", "paid")
        .execute(),
    );
  }

  return [...ids].sort();
}

export interface EntitlementSync {
  readonly paid: string[];
  readonly granted: string[];
  readonly revoked: string[];
}

/** Reconcile the tenant's entitlements to what it paid for. Idempotent: a second
 *  run (re-delivered webhook, operator re-activation) is a no-op. */
export async function syncEntitlementsToPaid(tenantId: string): Promise<EntitlementSync> {
  const paid = await paidModuleIds(tenantId);
  const paidSet = new Set(paid);
  const current = await db
    .selectFrom("module_entitlement")
    .select(["module", "active", "awaiting_first_charge", "cancelled_at"])
    .where("tenant_id", "=", tenantId)
    .execute();
  const activeNow = new Set(current.filter((c) => c.active).map((c) => c.module));
  // ADR-0080 ② (B-opció): a mid-cycle addition is legitimately active though not
  // yet in any paid order — its first fee rides the next renewal invoice, which
  // clears the flag. Revoking it here would undo the very grant the tenant just
  // made. Everything ELSE active-and-unpaid is still the Villa-Suzy leak.
  const awaitingFirstCharge = new Set(
    current.filter((c) => c.active && c.awaiting_first_charge).map((c) => c.module),
  );

  // ADR-0080 ③: an explicit cancellation OUTRANKS the historical paid union —
  // the module WAS paid once, but the tenant said stop; re-granting it off an
  // old payment would resurrect every cancelled module at the next paid event.
  // (A later re-add clears cancelled_at, so a comeback still works.)
  const cancelled = new Set(
    current.filter((c) => !c.active && c.cancelled_at != null).map((c) => c.module),
  );

  const granted: string[] = [];
  for (const module of paid) {
    if (activeNow.has(module)) continue;
    if (cancelled.has(module)) {
      console.log(`[entitlement] ${tenantId}: ${module} lemondva — a régi fizetés nem éleszti újra`);
      continue;
    }
    await db
      .insertInto("module_entitlement")
      .values({ tenant_id: tenantId, module, active: true })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "module"]).doUpdateSet({ active: true }),
      )
      .execute();
    granted.push(module);
  }

  const revoked: string[] = [];
  for (const module of activeNow) {
    if (paidSet.has(module)) continue;
    if (awaitingFirstCharge.has(module)) {
      console.log(
        `[entitlement] ${tenantId}: ${module} első díjra vár (B-opció) — nem vonjuk vissza`,
      );
      continue;
    }
    await db
      .updateTable("module_entitlement")
      .set({ active: false })
      .where("tenant_id", "=", tenantId)
      .where("module", "=", module)
      .execute();
    revoked.push(module);
  }

  // Revocation is the loud half: it means the tenant was holding something it
  // never bought, and the rendered page is about to lose a section.
  if (revoked.length) {
    console.warn(
      `[entitlement] ${tenantId}: NEM FIZETETT modul kikapcsolva → ${revoked.sort().join(", ")}`,
    );
  }
  if (granted.length) {
    console.log(`[entitlement] ${tenantId}: fizetett modul bekapcsolva → ${granted.join(", ")}`);
  }
  return { paid, granted, revoked: revoked.sort() };
}
