#!/usr/bin/env npx tsx
/**
 * SHOP OFFER BANNER guard — the Modulok shop's discount card names the offer it will
 * apply by its ONE name (offerLabel, ADR-0303 ②), and says that every other live
 * purchase offer survives the purchase.
 *
 *   npx tsx scripts/shop-offer-banner-check.mts [--self-test]
 *
 * THE MEASURED HOLE (Elek ADM-2, live 2026-10-02, tenant `teszt-muschel-panzio`): a
 * purchase-scope CAMPAIGN (98%, entered by the coordinator) was shown as
 * "−98% kupon — Az induló előfizetéséért kapta" — the welcome coupon's name AND reason —
 * while ADR-0303 names a campaign "Egyedi ajánlat". The real 25% welcome coupon vanished
 * from the card, so the owner could not tell whether it was still there. It is: only the
 * applied offer is burnt (redeemOfferForOrder). offer-name-one-source-check covered the
 * pay page, the invoice and the receipt, not this card.
 *
 * Measures, on the REAL modulesSection() render:
 *   ① campaign best + coupon kept → "−98% · Egyedi ajánlat", no "induló", the coupon named
 *     by offerLabel with its percent and "megmarad"
 *   ② coupon only → the contract-bound welcome literal (mandate-coupon) is unchanged
 * and on the DB (throwaway tenant, removed in `finally`):
 *   ③ livePurchaseOffersForTenant ranks campaign first, keeps the coupon;
 *     bestActiveCouponForTenant (what checkout charges) is that same head
 *
 * --self-test: renders ① with origin/main's PRE-FIX adminViews.ts (copied next to the
 * original so its imports resolve, deleted afterwards) — must go RED.
 */
import { execFileSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { MODULE_CATALOG } from "../src/modules.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");
const PRE_FIX_REF = "3e4eb7ac"; // origin/main when ADM-2 was measured
let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${!pass && detail ? ` — ${detail}` : ""}`);
};

const OWNED = new Set(["gallery", "enquiry", "location"]);
const mv: TenantModuleView = {
  modules: MODULE_CATALOG.filter((m) => !m.retired).map((m) => ({
    id: m.id,
    label: m.publicLabel,
    publicDesc: m.publicDesc,
    group: m.group,
    spine: Boolean(m.spine),
    active: OWNED.has(m.id),
    priceMonthly: m.priceMonthly,
    supersededBy: null,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  })),
  baseMonthly: 3900,
  totalMonthly: 4880,
};
const mkSub = (
  coupon: SubscriptionAdminData["coupon"],
  keptOffers: SubscriptionAdminData["keptOffers"],
): SubscriptionAdminData =>
  ({
    status: "active",
    periodEnd: "2026-11-02",
    renewDay: 2,
    nextInvoiceTotal: 4880,
    nextInvoiceItems: [],
    payUrl: null,
    arrears: null,
    closesOn: null,
    frozenOn: null,
    restoredOn: null,
    cancelAtPeriodEnd: false,
    billingPeriod: "monthly",
    pendingAnnual: false,
    pendingEffectiveDate: null,
    annualTotal: 0,
    annualSavings: 0,
    annualFreeMonths: 2,
    autoCharge: false,
    cardLabel: null,
    coupon,
    keptOffers,
  }) as unknown as SubscriptionAdminData;

/** Visible text of the coupon card only. */
const bannerOf = (html: string): string => {
  const at = html.indexOf('class="adm-coupon"');
  if (at < 0) return "";
  const end = html.indexOf("</div>", at);
  return html
    .slice(html.indexOf(">", at) + 1, end)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

type ModulesSection = (typeof import("../src/server/adminViews.js"))["modulesSection"];
let modulesSection: ModulesSection;
let tmp = "";
if (SELF_TEST) {
  tmp = path.resolve("src/server/.__selftest_adminViews.ts");
  await writeFile(
    tmp,
    execFileSync("git", ["show", `${PRE_FIX_REF}:src/server/adminViews.ts`], { encoding: "utf8", maxBuffer: 64 << 20 }),
  );
  modulesSection = (await import(tmp)).modulesSection as ModulesSection;
} else {
  modulesSection = (await import("../src/server/adminViews.js")).modulesSection;
}

try {
  console.log(`\n① KAMPÁNY (98%) + MEGMARADÓ ÜDVÖZLŐ KUPON (25%):`);
  const camp = bannerOf(
    modulesSection(
      mv,
      mkSub({ percent: 98, expiresAt: "2026-10-03", kind: "campaign" }, [
        { percent: 25, expiresAt: "2026-12-31", kind: "coupon" },
      ]),
      null,
      "hello@citoviso.com",
    ),
  );
  check("a kártya a kampányt a saját nevén mondja: „−98% · Egyedi ajánlat”", camp.includes("−98% · Egyedi ajánlat"), camp);
  check("nem az üdvözlő kupon indoklását adja a kampánynak", !camp.includes("induló előfizetéséért"), camp);
  check(
    "a megmaradó üdvözlő kupon kimondva (név, −25%, megmarad)",
    camp.includes("Üdvözlő kedvezmény (−25%") && camp.includes("megmarad"),
    camp,
  );

  if (!SELF_TEST) {
    console.log(`\n② CSAK ÜDVÖZLŐ KUPON — a kontraktus-felirat változatlan:`);
    const coup = bannerOf(
      modulesSection(mv, mkSub({ percent: 25, expiresAt: "2026-12-31", kind: "coupon" }, []), null, "hello@citoviso.com"),
    );
    check("„−25% kupon” + „Az induló előfizetéséért kapta.”", coup.startsWith("−25% kupon Az induló előfizetéséért kapta."), coup);
    check("nincs „megmarad” sor, ha nincs másik ajánlat", !coup.includes("megmarad"), coup);

    console.log(`\n③ DB — a rangsor és a pénztár feje:`);
    const { db } = await import("../src/db/client.js");
    const { livePurchaseOffersForTenant, bestActiveCouponForTenant } = await import("../src/payment/offers.js");
    const stamp = Date.now().toString(36);
    const ids: Record<string, string> = {};
    let tenantId = "";
    try {
      ids.def = (
        await db
          .insertInto("scraper_definition")
          .values({ label: `_shopbanner_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
      ids.run = (
        await db
          .insertInto("scrape_run")
          .values({ scraper_definition_id: ids.def, stats: JSON.stringify({}) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
      ids.lead = (
        await db
          .insertInto("lead")
          .values({ scrape_run_id: ids.run, name: `_shopbanner_${stamp} lead`, raw: JSON.stringify({}) })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
      const t = await db
        .insertInto("tenant")
        .values({ lead_id: ids.lead, display_name: `_shopbanner_${stamp}` })
        .returning("id")
        .executeTakeFirstOrThrow();
      tenantId = t.id;
      const until = (d: number) => new Date(Date.now() + d * 86_400_000);
      await db
        .insertInto("offer")
        .values([
          { tenant_id: tenantId, kind: "coupon", scope: "purchase", percent: 25, max_uses: 1, expires_at: until(90) },
          { tenant_id: tenantId, kind: "campaign", scope: "purchase", percent: 98, max_uses: 1, expires_at: until(1) },
        ])
        .execute();
      const live = await livePurchaseOffersForTenant(tenantId);
      const best = await bestActiveCouponForTenant(tenantId);
      check(
        "két élő ajánlat, a kampány elöl, a kupon megmaradt",
        live.length === 2 && live[0]!.kind === "campaign" && live[1]!.kind === "coupon",
        live.map((o) => `${o.kind}:${o.percent}`).join(","),
      );
      check("a pénztár (bestActiveCouponForTenant) ugyanazt a fejet terheli", best?.id === live[0]?.id);
    } finally {
      if (tenantId) {
        await db.deleteFrom("offer").where("tenant_id", "=", tenantId).execute();
        await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
      }
      if (ids.lead) await db.deleteFrom("lead").where("id", "=", ids.lead).execute();
      if (ids.run) await db.deleteFrom("scrape_run").where("id", "=", ids.run).execute();
      if (ids.def) await db.deleteFrom("scraper_definition").where("id", "=", ids.def).execute();
      await db.destroy();
    }
  }
} finally {
  if (tmp) await rm(tmp, { force: true });
}

if (SELF_TEST) {
  const ok = failures === 3;
  console.log(
    ok
      ? `\n✅ ÖNTESZT: a javítás előtti adminViews.ts-en mind a 3 sáv-állítás bukott — az őr lát\n`
      : `\n❌ ÖNTESZT: ${failures} bukás a várt 3 helyett — az őr NEM a sávot méri\n`,
  );
  process.exit(ok ? 0 : 1);
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
