// Guard: a `retired` module (src/modules.ts — taken off the shelf) must NOT be
// sellable to a tenant, in the shop list OR at the write — while a tenant who
// ALREADY holds it keeps it (taking a paid module away is not ours to do).
//
// Why it exists: measured 2026-09-28 on the phone night-run (FK-012), the retired
// newsletter stood in the tenant admin shop as „Hírlevél feliratkozás" with its own
// „Hozzáadom" button at 490 Ft/hó. The flag was honoured by the configurator, the
// ALL-IN set, the subscription math and the module preview — and by nothing on the
// tenant side (getTenantModules / applyModuleChange). A grep for `retired` would
// have looked healthy: the word was all over the codebase, just not on this path.
//
// Measured as BEHAVIOUR, read-only: the write-gate probe asks applyModuleChange for
// exactly one extra module, which on the refusing branch classifies nothing and
// therefore writes nothing — and the run asserts the tenant's entitlement rows are
// byte-for-byte the same afterwards.
// Run: npx tsx scripts/retired-module-shop-check.mts
//   --self-test  → inverts the central expectations, so the suite must go RED.

import { db } from "../src/db/client.js";
import { MODULE_CATALOG, applicableRequirements } from "../src/modules.js";
import { getTenantModules } from "../src/tenant/modules.js";
import { applyModuleChange } from "../src/tenant/moduleChange.js";
import { getDisabledModules } from "../src/moduleSales.js";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  console.log(`${cond ? "✓ " : "✗ FAIL"}  ${label}${detail ? `\n     ↳ ${detail}` : ""}`);
  if (!cond) failed++;
}

async function entitlementRows(tenantId: string): Promise<string> {
  const rows = await db
    .selectFrom("module_entitlement")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("module")
    .execute();
  return JSON.stringify(rows);
}

/** The ids the shop's switches show as ON — exactly what the form posts back. */
async function currentlyOn(tenantId: string): Promise<string[]> {
  const mv = await getTenantModules(tenantId);
  return mv.modules.filter((m) => m.active && !m.spine && !m.cancelAtPeriodEnd).map((m) => m.id);
}

try {
  const retired = MODULE_CATALOG.filter((m) => m.retired && m.billing !== "once");
  // ⛔ Non-empty control first: with no retired module every assertion below is vacuous.
  ok(retired.length > 0, "a katalógusban van kivezetett (retired) modul — az állítás nem üres", retired.map((m) => m.id).join(", "));

  const ent = await db
    .selectFrom("module_entitlement")
    .select(["tenant_id", "module", "active"])
    .execute();
  const holds = (tid: string, mid: string) => ent.some((e) => e.tenant_id === tid && e.module === mid && e.active);
  const tenants = await db.selectFrom("tenant").select("id").where("status", "=", "active").execute();
  const disabled = await getDisabledModules();

  for (const r of retired) {
    // ── ① a NON-holder: the shop must not list it, the write must refuse it ──────
    // Negative control on the SAME tenant: an unheld, sellable, dependency-free module
    // must be listed and must be classified as a paid add — otherwise "not offered"
    // could be green simply because nothing is offered.
    const controls = MODULE_CATALOG.filter(
      (m) =>
        !m.spine && !m.retired && m.billing !== "once" && !m.tenantOnly && m.priceMonthly > 0 &&
        !disabled.has(m.id) && applicableRequirements(m.id).length === 0,
    );
    let buyer: { id: string } | undefined;
    let control: (typeof controls)[number] | undefined;
    for (const t of tenants) {
      if (holds(t.id, r.id)) continue;
      const c = controls.find((m) => !holds(t.id, m.id));
      if (c) {
        buyer = t;
        control = c;
        break;
      }
    }
    if (!buyer || !control) {
      ok(false, `„${r.id}": nincs mérhető nem-birtokos bérlő + kontroll-modul a dev DB-ben — a mérés ÜRES volna`);
      continue;
    }
    const before = await entitlementRows(buyer.id);
    const mv = await getTenantModules(buyer.id);
    const listed = mv.modules.map((m) => m.id);
    ok(listed.includes(control.id), `kontroll: a nem-birtokolt „${control.id}" a kirakatban VAN (a lista nem üres-zöld)`);
    ok(
      SELF_TEST ? listed.includes(r.id) : !listed.includes(r.id),
      `⭐ „${r.id}" NINCS a nem-birtokos bérlő kirakatában`,
      `kínált: ${listed.join(", ")}`,
    );

    const on = await currentlyOn(buyer.id);
    const probe = await applyModuleChange(buyer.id, [...on, r.id]);
    const sold = [...probe.added, ...probe.requiresPayment];
    ok(
      SELF_TEST ? sold.includes(r.id) : !sold.includes(r.id),
      `⭐ az írási kapu elutasítja a „${r.id}" új vételét (kézzel összerakott POST-ra is)`,
      `added: ${probe.added.join(",") || "—"} · requiresPayment: ${probe.requiresPayment.join(",") || "—"}`,
    );
    const ctl = await applyModuleChange(buyer.id, [...on, control.id]);
    ok(
      ctl.requiresPayment.includes(control.id),
      `kontroll: ugyanaz a kapu a „${control.id}"-t FIZETŐS vételnek sorolja (a kapu nem mindent utasít el)`,
      `requiresPayment: ${ctl.requiresPayment.join(",") || "—"} · frozen: ${ctl.refusedWhileFrozen?.join(",") ?? "—"}`,
    );
    ok((await entitlementRows(buyer.id)) === before, "a próbák semmit nem írtak a bérlő jogosultság-soraiba");

    // ── ② a HOLDER keeps it: listed, active, and its switch round-trips untouched ─
    const holder = tenants.find((t) => holds(t.id, r.id));
    if (!holder) {
      console.log(`⚠️  KIHAGYVA (hangosan): „${r.id}" — a dev DB-ben nincs aktív birtokos, a megtartás ágát most nem mérem`);
      continue;
    }
    const hv = await getTenantModules(holder.id);
    const mine = hv.modules.find((m) => m.id === r.id);
    ok(!!mine && mine.active, `⭐ a MEGLÉVŐ birtokos kirakatában „${r.id}" ott van, aktívan (nem vettük el)`);
    const hBefore = await entitlementRows(holder.id);
    const keep = await applyModuleChange(holder.id, await currentlyOn(holder.id));
    ok(
      !keep.cancelled.includes(r.id) && !keep.switchedOff.includes(r.id),
      `a birtokos változatlan beküldése nem mondja le a „${r.id}"-t`,
    );
    ok((await entitlementRows(holder.id)) === hBefore, "a birtokos jogosultság-sorai érintetlenek");
  }
} finally {
  await db.destroy();
}

if (failed) {
  console.error(`\n⛔ retired-module-shop-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ retired-module-shop-check: a kivezetett modul a bérlőnek nem vehető meg, a birtokosé megmarad.");
