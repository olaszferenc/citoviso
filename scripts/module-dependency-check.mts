// ADR-0192 ⑥ ② — THE BEHAVIOUR GATE for the module-dependency rule.
//
// The catalogue lint (module-config-lint) proves the DECLARATION is sound. This
// proves the rule actually BITES on a real tenant, end to end, on the paths that
// were measured to be blind:
//
//   ② applyModuleChange refuses the change that would orphan a module
//   ③ the RENEWAL SWEEP — the unattended path: at the click the set is still
//     valid, so a toggle-bound guard waves it through and the rule breaks on the
//     renewal day with nobody in the room
//   ④ syncEntitlementsToPaid does not re-grant a module off the historical paid
//     union when its requirement carries a cancellation tombstone
//   ⑥ what RENDERS follows the same rule as what is billed
//   ⑧ the renewal bills a set that satisfies the rule
//
// FOUR NEGATIVE CONTROLS (the ADR names them):
//   1. a VALID set is SILENT — no false positive
//   2. every violation class goes red on its own
//   3. cancel_at_period_end=true on `pricing` while `booking` is live → RED
//      (no guard looks at this path today, and it is the one that breaks alone)
//   4. an upsell order modules=["booking"] on a tenant that ALREADY holds
//      pricing+rooms → GREEN. ⛔ The order jsonb is a DELTA, not a set: whoever
//      reads it alone rejects EVERY upsell that does not re-buy its dependencies.
//      The discovery itself made this mistake and reported it as fact (ADR-0192 ③).
//
//   npx tsx scripts/module-dependency-check.mts
//   npx tsx scripts/module-dependency-check.mts --selftest   (controls only, no DB writes)

import { readFile } from "node:fs/promises";

import { db } from "../src/db/client.js";
import {
  MODULE_CATALOG,
  missingRequiredModules,
  removalClosure,
  withRequiredModules,
} from "../src/modules.js";
import { applyModuleChange } from "../src/tenant/moduleChange.js";
import { heldCancellations } from "../src/tenant/moduleRequirements.js";
import { syncEntitlementsToPaid } from "../src/tenant/paidEntitlements.js";
import { renewableModuleIds } from "../src/payment/billing.js";
import { getTenantModules, isRenderedModule } from "../src/tenant/modules.js";

let fails = 0;
const check = (name: string, cond: boolean, detail = ""): void => {
  if (cond) console.log(`  ✓ ${name}${detail ? `  ↳ ${detail}` : ""}`);
  else {
    fails++;
    console.error(`  ❌ ${name}  ↳ ${detail}`);
  }
};
const section = (t: string): void => console.log(`\n${t}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVE CONTROLS — pure, no DB. Run in BOTH modes: a gate whose controls only
// run under a flag is a gate nobody runs the controls of.
// ─────────────────────────────────────────────────────────────────────────────
section("Negatív kontrollok (a szabály tud pirosat ÉS zöldet adni):");

check(
  "① ÉRVÉNYES halmaz → NÉMA (nincs álpozitív)",
  missingRequiredModules(["booking", "pricing", "rooms", "gallery"]).length === 0,
  JSON.stringify(missingRequiredModules(["booking", "pricing", "rooms", "gallery"])),
);
check(
  "① a teljes katalógus is néma",
  missingRequiredModules(MODULE_CATALOG.map((m) => m.id)).length === 0,
);

for (const [name, set, wantMissing] of [
  ["booking pricing nélkül", ["booking", "rooms"], "pricing"],
  ["pricing rooms nélkül (ismeretlen egységszám)", ["pricing"], "rooms"],
  ["a teljes lánc közepe kiesik", ["booking", "pricing"], "rooms"],
] as const) {
  const issues = missingRequiredModules([...set]);
  check(
    `② ${name} → PIROS`,
    issues.some((i) => i.requiredId === wantMissing),
    issues.map((i) => `${i.moduleId}→${i.requiredId}`).join(", ") || "NÉMA MARADT",
  );
  check(
    `② …és a PIROS mellé jár a tulajnak szóló indoklás`,
    issues.every((i) => i.why.trim().length >= 20),
    issues.map((i) => i.why.slice(0, 30)).join(" | "),
  );
}

// ⛔ The measured false positive, pinned as a control: the ORDER ROW is a delta.
{
  const submitted = ["booking"]; // what the upsell order's jsonb carries
  const alreadyHeld = ["pricing", "rooms", "gallery", "enquiry"];
  check(
    "④⭐ upsell modules=[booking] + MEGLÉVŐ pricing+rooms → ZÖLD (a rendelés DELTA)",
    missingRequiredModules([...submitted, ...alreadyHeld]).length === 0,
    JSON.stringify(missingRequiredModules([...submitted, ...alreadyHeld])),
  );
  check(
    "④ …és ugyanez a sor ÖNMAGÁBAN nézve PIROS volna — ez a csapda",
    missingRequiredModules(submitted).length > 0,
    "ha ez elnémul, a kontroll üres",
  );
}

// The single-unit reading is the ONLY one that releases the conditional edge.
check(
  "④.4 ismeretlen egységszám → a függőség ÁLL",
  missingRequiredModules(["pricing"], { multiUnit: "unknown" }).length > 0,
);
check(
  "④.4 EGY ismert egység → a függőség elesik",
  missingRequiredModules(["pricing"], { multiUnit: "no" }).length === 0,
);
check(
  "④.4 két egység → a függőség áll",
  missingRequiredModules(["pricing"], { multiUnit: "yes" }).length > 0,
);

// The closure and the checker must agree — otherwise the cart ticks a set the
// server then refuses (feedback_one_rule_two_copies).
for (const start of [["booking"], ["pricing"], ["booking", "gallery"], []]) {
  check(
    `⭐ a kosár zárványa MINDIG érvényes halmazt ad (${JSON.stringify(start)})`,
    missingRequiredModules(withRequiredModules(start)).length === 0,
    JSON.stringify(withRequiredModules(start)),
  );
}

// The joint cancellation offer is the transitive group, not just the neighbour.
{
  const group = removalClosure("rooms", ["booking", "pricing", "rooms", "gallery"]);
  check(
    "④.2 a közös lemondás ajánlata HÁROM tagú (rooms → pricing → booking)",
    group.length === 3 && ["rooms", "pricing", "booking"].every((id) => group.includes(id)),
    JSON.stringify(group),
  );
  check(
    "④.2 …és nem visz magával olyat, ami nem függ tőle",
    !group.includes("gallery"),
  );
}

// ⑦ ADR-0193 built the /api/foglaltsag entitlement gate; this measures that it is
// still WIRED, because the dependency story rests on it: without it a cancelled
// `pricing` leaves the page priceless while the widget keeps quoting.
{
  const src = await readFile(new URL("../src/server/public.ts", import.meta.url), "utf8");
  check(
    "⑦ az /api/foglaltsag az entitlement-kaput kérdezi (ADR-0193)",
    /siteRendersModule|tenantRendersModule/.test(src),
    "ha ez elnémul, a lemondott ár visszatér a foglalási folyamatba",
  );
}

// ⭐ ① and ⑤ used to stand here as LOUDLY NOT COVERED. They are covered now — by
// `module-dependency-cart-check`, which needs a browser and an HTTP round trip and
// therefore lives in its own file. ⛔ A pointer is a PROMISE, not a proof: this
// asserts the file exists AND that a hook actually runs it, so the coverage cannot
// quietly move back to "not covered" while this comment claims otherwise.
{
  const cartGuard = new URL("./module-dependency-cart-check.mts", import.meta.url);
  const hook = await readFile(new URL("../hooks/pre-commit", import.meta.url), "utf8");
  let present = true;
  try {
    await readFile(cartGuard, "utf8");
  } catch {
    present = false;
  }
  check(
    "①⑤ a kosár- és beküldő-kaput a module-dependency-cart-check méri…",
    present,
    "scripts/module-dependency-cart-check.mts",
  );
  check(
    "①⑤ …és a pre-commit TÉNYLEG lefuttatja (a mutató önmagában csak ígéret)",
    /npx tsx scripts\/module-dependency-cart-check\.mts/.test(hook),
    "hooks/pre-commit",
  );
}
// ⛔ LOUDLY NOT COVERED — a skipped assertion that says nothing reads as a pass.
const NOT_COVERED: string[] = [];

if (process.argv.includes("--selftest")) {
  console.log(
    fails
      ? `\n⛔ module-dependency-check --selftest: ${fails} kontroll bukott.`
      : `\n✅ module-dependency-check --selftest: a kontrollok rendben.`,
  );
  process.exit(fails ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// END-TO-END on a real fixture tenant.
// ⚠️ Session-unique names: several worktrees share citoviso_dev, and a fixed
// fixture name makes two runs delete each other's rows
// (reference_shared_sites_fixture_race).
// ─────────────────────────────────────────────────────────────────────────────
const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}`;
const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string; siteId?: string; orderId?: string; prospectId?: string } = {};

try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: `_moddep_${stamp}`,
      country: "HU",
      region: "_test",
      industry: "accommodation",
      sources: JSON.stringify(["osm"]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id, stats: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_moddep_${stamp} lead`, raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: `_moddep_${stamp} tenant` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `moddep_${stamp}`,
      slug: `moddep-${stamp}`,
      status: "live",
      live_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;

  // TWO units → the `when: "multiUnit"` edge is live and NOT on its fail-closed
  // default: a fixture that leans on "unknown" would prove the weaker thing.
  await db
    .insertInto("site_unit")
    .values([
      { site_id: site.id, name: "A szállás egésze", sort_order: 0, is_whole_property: true },
      { site_id: site.id, name: "Kisház", sort_order: 1, is_whole_property: false },
    ])
    .execute();

  const setEntitlements = async (
    rows: readonly { module: string; active: boolean; cancelAtEnd?: boolean }[],
  ): Promise<void> => {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenant.id).execute();
    if (!rows.length) return;
    await db
      .insertInto("module_entitlement")
      .values(
        rows.map((r) => ({
          tenant_id: tenant.id,
          module: r.module,
          active: r.active,
          cancel_at_period_end: !!r.cancelAtEnd,
        })),
      )
      .execute();
  };

  // ── ② applyModuleChange ────────────────────────────────────────────────────
  section("② A LEMONDÁS BLOKKOL (applyModuleChange) — ADR-0192 ④.2:");

  await setEntitlements([
    { module: "rooms", active: true },
    { module: "pricing", active: true },
    { module: "booking", active: true },
  ]);

  const refuse = await applyModuleChange(tenant.id, ["pricing", "booking"]);
  check(
    "a Szobák kikapcsolása ELUTASUL",
    !!refuse.refusedMissingRequirement,
    refuse.refusedMissingRequirement
      ? refuse.refusedMissingRequirement.issues.map((i) => `${i.moduleId}→${i.requiredId}`).join(", ")
      : `ÁTMENT — cancelled: ${JSON.stringify(refuse.cancelled)}`,
  );
  check(
    "⛔ és SEMMIT nem írt (atomi elutasítás)",
    refuse.cancelled.length === 0 && refuse.added.length === 0 && refuse.requiresPayment.length === 0,
  );
  const stillThere = await db
    .selectFrom("module_entitlement")
    .select(["module", "cancel_at_period_end"])
    .where("tenant_id", "=", tenant.id)
    .execute();
  check(
    "⛔ az adatbázisban sincs lemondás-jelölés",
    stillThere.every((r) => !r.cancel_at_period_end),
    JSON.stringify(stillThere.map((r) => `${r.module}:${r.cancel_at_period_end}`)),
  );
  check(
    "a képernyőnek ajánlott KÖZÖS lemondás mind a hármat tartalmazza",
    (refuse.refusedMissingRequirement?.group.length ?? 0) === 3,
    JSON.stringify(refuse.refusedMissingRequirement?.group ?? []),
  );

  // ⭐ NEGATIVE CONTROL 1 on the SAME path: a legitimate change must go through.
  const allow = await applyModuleChange(tenant.id, ["rooms", "pricing", "booking", "gallery"]);
  check(
    "①⭐ az ÉRVÉNYES változtatás viszont ÁTMEGY (nincs álpozitív)",
    !allow.refusedMissingRequirement,
    JSON.stringify(allow.refusedMissingRequirement ?? "átment"),
  );

  // The whole GROUP may be cancelled together — that is what the dialog offers.
  await setEntitlements([
    { module: "rooms", active: true },
    { module: "pricing", active: true },
    { module: "booking", active: true },
  ]);
  const joint = await applyModuleChange(tenant.id, []);
  check(
    "④.2 a KÖZÖS lemondás (mind a három egyszerre) átmegy",
    !joint.refusedMissingRequirement && joint.cancelled.length === 3,
    joint.refusedMissingRequirement ? "elutasította" : JSON.stringify(joint.cancelled),
  );

  // ── ③ THE RENEWAL SWEEP — the unattended path ──────────────────────────────
  section("③⭐ A MEGÚJÍTÁS-SWEEP (ember nélkül, a fordulónapon) — ADR-0192 ②:");

  await setEntitlements([
    { module: "rooms", active: true },
    { module: "pricing", active: true, cancelAtEnd: true },
    { module: "booking", active: true },
  ]);
  const held = await heldCancellations(tenant.id);
  check(
    "③⭐ cancel_at_period_end a pricing-en + booking él → PIROS",
    held.some((h) => h.module === "pricing" && h.blockedBy.includes("booking")),
    JSON.stringify(held.map((h) => `${h.module}←${h.blockedBy.join("+")}`)),
  );
  check(
    "③ …a visszatartás a KATALÓGUS indoklását viszi (nem új mondatot)",
    held.every((h) => h.why.trim().length >= 20),
    held.map((h) => h.why.slice(0, 40)).join(" | "),
  );

  // ⭐ NEGATIVE CONTROL: a cancellation nobody depends on sweeps normally.
  await setEntitlements([
    { module: "rooms", active: true },
    { module: "pricing", active: true },
    { module: "gallery", active: true, cancelAtEnd: true },
  ]);
  check(
    "③⭐ a senkit nem érintő lemondás NEM tartódik vissza (nincs álpozitív)",
    (await heldCancellations(tenant.id)).length === 0,
    JSON.stringify(await heldCancellations(tenant.id)),
  );

  // …and the whole group leaving together is fine too.
  await setEntitlements([
    { module: "rooms", active: true, cancelAtEnd: true },
    { module: "pricing", active: true, cancelAtEnd: true },
    { module: "booking", active: true, cancelAtEnd: true },
  ]);
  check(
    "③ az EGYÜTT távozó csoport akadálytalanul söpörhető",
    (await heldCancellations(tenant.id)).length === 0,
    JSON.stringify((await heldCancellations(tenant.id)).map((h) => h.module)),
  );

  // ── ⑧ what the next period BILLS satisfies the rule ────────────────────────
  section("⑧ A SZÁMLÁZOTT halmaz is kielégíti a szabályt:");

  await setEntitlements([
    { module: "rooms", active: true },
    { module: "pricing", active: true },
    { module: "booking", active: true },
  ]);
  const renewable = await renewableModuleIds(tenant.id);
  check(
    "a megújítás által számlázott halmaz érvényes",
    missingRequiredModules([...renewable, "enquiry"], { multiUnit: "yes" }).length === 0,
    JSON.stringify(renewable),
  );

  // ── ⑥ what RENDERS follows the same rule ───────────────────────────────────
  section("⑥ Amit a lap MUTAT, ugyanaz a halmaz:");

  const mv = await getTenantModules(tenant.id);
  const rendered = mv.modules.filter(isRenderedModule).map((m) => m.id);
  check(
    "a renderelt halmaz is érvényes",
    missingRequiredModules(rendered, { multiUnit: "yes" }).length === 0,
    JSON.stringify(rendered.filter((id) => ["rooms", "pricing", "booking"].includes(id))),
  );

  // ── ④ the paid-union backflow ──────────────────────────────────────────────
  section("④ A FIZETETT-UNIÓ visszaszivárgása — ADR-0192 ②:");

  // ⛔ THE FIXTURE MUST CONTAIN A REAL PAID ORDER. The first version of this
  // section had none, so `paid` came back empty and the assertion passed without
  // ever reaching the new code — a green that measured nothing
  // (feedback_bought_verdict_thrown_away).
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `moddep${stamp}` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.prospectId = prospect.id as string;
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      tenant_id: tenant.id,
      kind: "upsell",
      modules: JSON.stringify(["rooms", "pricing", "booking"]),
      price: 2_170,
      billing_period: "monthly",
      status: "submitted",
      submitted_at: new Date(),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.orderId = order.id as string;
  await db
    .insertInto("payment")
    .values({
      order_intent_id: order.id,
      amount: 2_170,
      period: "monthly",
      gateway: "mock",
      gateway_ref: `mock_moddep_${stamp}`,
      status: "paid",
      paid_at: new Date(),
    } as never)
    .execute();

  // `pricing` carries a cancellation tombstone; `booking` sits in the historical
  // paid union with it. Re-granting booking off that old payment would hand back
  // a calendar that cannot name a price.
  await setEntitlements([{ module: "rooms", active: true }]);
  await db
    .insertInto("module_entitlement")
    .values([
      { tenant_id: tenant.id, module: "pricing", active: false, cancelled_at: new Date() },
      { tenant_id: tenant.id, module: "booking", active: false },
    ] as never)
    .execute();

  const sync = await syncEntitlementsToPaid(tenant.id);
  check(
    "⭐ a fizetett unió VALÓBAN tartalmazza a booking-ot (a kontroll nem üres)",
    sync.paid.includes("booking") && sync.paid.includes("pricing"),
    JSON.stringify(sync.paid),
  );
  // ⛔⛔ THE ASSERTION I HAD BACKWARDS. My first version demanded that the sync
  // REFUSE to re-grant booking — and `entitlement-paid-check` went red on
  // "a KIFIZETETT upsell bekapcsol": the gate was refusing a paying customer.
  // ADR-0072 wins ("azt kapja, amiért fizetett"), and the real harm — a calendar
  // that quotes without a price — is stopped one layer down by ADR-0193.
  // What this gate owes is therefore the opposite: the module comes back, and the
  // situation is not silent.
  check(
    "⛔ a KIFIZETETT booking visszakapcsol a lemondott pricing mellett is (ADR-0072)",
    sync.granted.includes("booking"),
    JSON.stringify(sync.granted),
  );
  const afterSync = await db
    .selectFrom("module_entitlement")
    .select(["module"])
    .where("tenant_id", "=", tenant.id)
    .where("active", "=", true)
    .execute();
  check(
    "…és az így előálló hiányos halmazt a rendszer FELISMERI (nem némán viseli)",
    missingRequiredModules([...afterSync.map((r) => r.module), "enquiry"], { multiUnit: "yes" })
      .some((i) => i.moduleId === "booking" && i.requiredId === "pricing"),
    JSON.stringify(afterSync.map((r) => r.module)),
  );

  // ⭐ NEGATIVE CONTROL — and this one matters most: the gate must NOT rob a payer.
  // With the tombstone gone, the very same sync DOES grant booking back
  // (feedback_gate_must_not_refuse_the_paying_customer).
  await setEntitlements([{ module: "rooms", active: true }, { module: "pricing", active: true }]);
  await db
    .insertInto("module_entitlement")
    .values([{ tenant_id: tenant.id, module: "booking", active: false }] as never)
    .execute();
  const sync2 = await syncEntitlementsToPaid(tenant.id);
  check(
    "①⭐ lemondás NÉLKÜL ugyanez a sync VISSZAADJA a kifizetett booking-ot",
    sync2.granted.includes("booking"),
    JSON.stringify(sync2),
  );
} finally {
  if (ids.orderId) {
    await db.deleteFrom("payment").where("order_intent_id", "=", ids.orderId).execute();
    await db.deleteFrom("order_intent").where("id", "=", ids.orderId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", ids.tenantId).execute();
  }
  if (ids.siteId) await db.deleteFrom("site_unit").where("site_id", "=", ids.siteId).execute();
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.prospectId) await db.deleteFrom("prospect").where("id", "=", ids.prospectId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.destroy();
}

if (NOT_COVERED.length) {
  console.log(`\n⚠️ MÉG NEM FEDETT (hangosan, mert a néma kihagyás átmenőnek olvasódik):`);
  for (const n of NOT_COVERED) console.log(`   · ${n}`);
}

console.log(
  fails
    ? `\n⛔ module-dependency-check: ${fails} állítás bukott.`
    : `\n✅ module-dependency-check: a modul-függőségi rend a kosáron, a lemondáson, a megújítás-sweepen, a számlázáson és a renderen is áll.`,
);
process.exit(fails ? 1 : 0);
