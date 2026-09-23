#!/usr/bin/env npx tsx
/**
 * ADR-0192 ⑧.3 guard — the mock pay page tells the truth about an UPSELL.
 *
 *   npx tsx scripts/pay-mock-upsell-check.mts
 *
 * THE HOLE (measured 2026-09-23): a module upsell is a ONE-TIME, pro-rata charge, but
 * the route's one-time list did not contain `upsell`, so the page read
 * "Citoviso honlap — éves előfizetés · 1 627 Ft / év" and named no module at all
 * (contract pay-gateway-exit ②: the screen names WHAT is paid). Barion's own
 * description already said "időarányos első díj" — the mock page was the liar.
 *
 * ⛔ Measured THROUGH THE ROUTE (GET /pay/mock/<ref> on the in-process console server),
 * not by calling payMockPage() with hand-picked arguments: the defect lived in the
 * route's MAPPING (kind → period), which a direct call would have bypassed.
 *
 * POSITIVE CONTROL: an ordinary annual subscription (`initial`) must STILL read
 * "éves előfizetés … / év" — a fix that turned every payment into "egyszeri díj"
 * would otherwise pass.
 *
 * Fixture: throwaway prospect/order/payment rows on the SHARED dev DB, removed in `finally`.
 */
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { randomUUID } from "node:crypto";

const { server: consoleServer } = await import("../src/console/server.js");
const { server: publicServer } = await import("../src/server/public.js");
const { db } = await import("../src/db/client.js");
const { MODULE_CATALOG } = await import("../src/modules.js");

let failures = 0;
const check = (label: string, pass: boolean, detail = ""): void => {
  if (!pass) failures++;
  console.log(`  ${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};
const visible = (h: string): string =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| | /g, " ")
    .replace(/\s+/g, " ");

const stamp = Date.now().toString(36);
const ids: Record<string, string> = {};
const orderIds: string[] = [];

try {
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const PORT = (consoleServer.address() as { port: number }).port;

  const def = await db.insertInto("scraper_definition").values({ label: `_payup_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: `Próba Vendégház ${stamp}`, raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const prospect = await db.insertInto("prospect").values({ lead_id: lead.id, token: `payup_${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.prospectId = prospect.id;
  // An upsell belongs to an existing tenant (DB check order_intent_upsell_tenant_chk).
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: `_payup_${stamp}` }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const page = async (kind: "upsell" | "initial", modules: string[]): Promise<string> => {
    const oi = await db
      .insertInto("order_intent")
      .values({ prospect_id: prospect.id, kind, ...(kind === "upsell" ? { tenant_id: tenant.id } : {}), modules: JSON.stringify(modules), price: 1627, billing_period: "annual", status: "submitted", submitted_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    orderIds.push(oi.id);
    const ref = `mock_${randomUUID()}`;
    await db.insertInto("payment").values({ order_intent_id: oi.id, amount: 1627, period: "annual", gateway: "mock", gateway_ref: ref }).execute();
    const res = await fetch(`http://127.0.0.1:${PORT}/pay/mock/${ref}`);
    return `${res.status} ${visible(await res.text())}`;
  };

  const upModules = ["rooms", "amenities"];
  const labels = upModules.map((id) => MODULE_CATALOG.find((m) => m.id === id)!.publicLabel);

  console.log("\n① MODUL-BŐVÍTÉS (éves fiók, időarányos első díj):");
  const up = await page("upsell", upModules);
  const upLine = up.slice(up.indexOf("Próba-fizetés"), up.indexOf("Próba-fizetés") + 170);
  check("a lap betölt (200)", up.startsWith("200 "), up.slice(0, 4));
  check("⛔ „egyszeri díj”-at mond", up.includes("egyszeri díj"), upLine);
  check("⛔ NEM mond előfizetést", !/előfizetés/.test(upLine), upLine);
  check("⛔ NEM ír „/ év”-et és „/ hó”-t", !/\/ (év|hó)\b/.test(up));
  check("megnevezi mindkét megvett modult", labels.every((l) => up.includes(l)), labels.join(" · "));

  console.log("\n② POZITÍV KONTROLL — induló ÉVES előfizetés:");
  const init = await page("initial", ["booking"]);
  const initLine = init.slice(init.indexOf("Próba-fizetés"), init.indexOf("Próba-fizetés") + 170);
  check("továbbra is „éves előfizetés”", init.includes("éves előfizetés"), initLine);
  check("és „/ év”", /\/ év\b/.test(init));
  check("és nem „Modul-bővítés”", !init.includes("Modul-bővítés"));
} finally {
  for (const o of orderIds) {
    await db.deleteFrom("payment").where("order_intent_id", "=", o).execute();
    await db.deleteFrom("order_intent").where("id", "=", o).execute();
  }
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.prospectId) await db.deleteFrom("prospect").where("id", "=", ids.prospectId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  consoleServer.close();
  publicServer.close();
  await db.destroy();
}
console.log(failures ? `\n❌ ${failures} állítás bukott\n` : `\n✅ minden állítás teljesült\n`);
process.exit(failures ? 1 : 0);
