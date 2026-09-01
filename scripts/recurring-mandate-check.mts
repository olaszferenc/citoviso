// ADR-0088 ⑨ / ADR-0080 ④ — recurring-card mandate END-TO-END harness.
//
// The one link the mock cannot prove is the REAL card mandate: Barion binds the
// stored credential to a 3DS-challenged, customer-initiated payment, so a human
// must type the sandbox card once. This script does everything around that:
//
//   npx tsx scripts/recurring-mandate-check.mts config
//       — is the environment even able to do this? (gateway, keys, callback URL)
//   npx tsx scripts/recurring-mandate-check.mts status <tenant-slug|tenant-id>
//       — did the checkout actually store a token + 3DS trace? (the step that
//         silently no-ops when the gateway lacks recurrence support)
//   npx tsx scripts/recurring-mandate-check.mts charge <tenant> [--now=YYYY-MM-DD]
//       — force the renewal + MIT charge for THIS tenant only (never the whole
//         cycle: other sessions' dev tenants must not be touched), then report
//         what the gateway answered and what the subscription looks like after.
//
// Read-only except `charge`, which is exactly what production would do on the
// fordulónap — run it against the sandbox, never against a live tenant.

import { db } from "../src/db/client.js";
import { config } from "../src/config.js";
import { getGateway } from "../src/payment/index.js";
import { chargeRenewalWithToken } from "../src/payment/service.js";
import { addMonths } from "../src/payment/subscription.js";

const cmd = process.argv[2] ?? "config";
const arg = process.argv[3];
const nowArg = process.argv.find((a) => a.startsWith("--now="));
const now = nowArg ? new Date(nowArg.slice("--now=".length)) : new Date();

function line(label: string, value: string, ok?: boolean): void {
  const mark = ok === undefined ? "·" : ok ? "✓" : "✗";
  console.log(`${mark} ${label}: ${value}`);
}

async function resolveTenant(key: string): Promise<{ id: string; name: string } | null> {
  const byId = /^[0-9a-f-]{36}$/i.test(key)
    ? await db.selectFrom("tenant").select(["id", "display_name as name"]).where("id", "=", key).executeTakeFirst()
    : null;
  if (byId) return byId;
  const bySlug = await db
    .selectFrom("tenant")
    .innerJoin("site", "site.tenant_id", "tenant.id")
    .select(["tenant.id as id", "tenant.display_name as name"])
    .where("site.slug", "=", key)
    .executeTakeFirst();
  return bySlug ?? null;
}

if (cmd === "config") {
  const gw = getGateway();
  const which = (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase();
  line("átjáró (PAYMENT_GATEWAY)", which, which === "barion");
  line("MIT-terhelés támogatott", gw.chargeRecurring ? "igen" : "NEM — nincs token-út", !!gw.chargeRecurring);
  line("BARION_POSKEY", process.env.BARION_POSKEY ? "beállítva" : "hiányzik", !!process.env.BARION_POSKEY);
  line("BARION_PAYEE", process.env.BARION_PAYEE ?? "hiányzik", !!process.env.BARION_PAYEE);
  // The callback must be reachable from Barion's servers, otherwise the payment
  // completes at the gateway and our side never learns about it (the token then
  // never gets stored — the silent failure this harness exists to catch).
  const base = config.publicBaseUrl || "";
  const reachable = /^https:\/\//.test(base) && !/localhost|127\.0\.0\.1|(^|\.)local/.test(base);
  line("publikus visszahívási cím", base || "hiányzik", reachable);
  console.log(
    "\nA sandbox-kör: (1) checkout a teszt-kártyával a 3DS-kihíváson át → " +
      "(2) `status <tenant>` (token + trace tárolva?) → (3) `charge <tenant> --now=<fordulónap>`.",
  );
  await db.destroy();
} else if (cmd === "status") {
  if (!arg) throw new Error("használat: status <tenant-slug|tenant-id>");
  const t = await resolveTenant(arg);
  if (!t) throw new Error(`nincs ilyen tenant: ${arg}`);
  const sub = await db
    .selectFrom("subscription")
    .select([
      "id", "billing_period", "pending_period", "status", "payment_method",
      "recurrence_token", "recurrence_trace_id", "current_period_end",
    ])
    .where("tenant_id", "=", t.id)
    .executeTakeFirst();
  if (!sub) throw new Error("ennek a tenantnak nincs előfizetése (nem fizetett még)");
  line("tenant", `${t.name} (${t.id})`);
  line("előfizetés", `${sub.billing_period}${sub.pending_period ? ` → ${sub.pending_period} (élesítve)` : ""} · ${sub.status}`);
  line("fizetési mód", sub.payment_method, sub.payment_method === "token");
  line("tárolt token", sub.recurrence_token ?? "NINCS", !!sub.recurrence_token);
  // Without the 3DS trace the issuer may decline the merchant-initiated charge —
  // it is the card-scheme link back to the challenged, customer-initiated payment.
  line("3DS trace", sub.recurrence_trace_id ?? "NINCS", !!sub.recurrence_trace_id);
  line("fordulónap", new Date(sub.current_period_end as unknown as string).toISOString().slice(0, 10));
  const pays = await db
    .selectFrom("payment")
    .innerJoin("order_intent", "order_intent.id", "payment.order_intent_id")
    .select(["payment.status as st", "payment.amount as amount", "payment.pay_url as payUrl",
             "order_intent.kind as kind", "payment.created_at as at"])
    .where("order_intent.tenant_id", "=", t.id)
    .orderBy("payment.created_at", "desc")
    .limit(5)
    .execute();
  console.log("\nutolsó fizetések:");
  for (const p of pays) {
    console.log(`  ${new Date(p.at as unknown as string).toISOString().slice(0, 16)} · ${p.kind} · ${p.amount} · ${p.st}` +
      (p.payUrl ? " · díjbekérő-link" : " · MIT (link nélkül)"));
  }
  await db.destroy();
} else if (cmd === "charge") {
  if (!arg) throw new Error("használat: charge <tenant-slug|tenant-id> [--now=YYYY-MM-DD]");
  const t = await resolveTenant(arg);
  if (!t) throw new Error(`nincs ilyen tenant: ${arg}`);
  const sub = await db
    .selectFrom("subscription")
    .select(["id", "billing_period", "recurrence_token", "recurrence_trace_id", "current_period_end", "payment_method"])
    .where("tenant_id", "=", t.id)
    .executeTakeFirstOrThrow();
  if (!sub.recurrence_token) throw new Error("nincs tárolt token — előbb fusson le a kártyás checkout (status)");
  // Mint (or reuse) the renewal order for the CURRENT period end, exactly as the
  // billing tick would — but for this one tenant only.
  const periodStart = new Date(sub.current_period_end as unknown as string);
  const months = sub.billing_period === "annual" ? 12 : 1;
  const existing = await db
    .selectFrom("order_intent")
    .select(["id", "price"])
    .where("kind", "=", "renewal")
    .where("tenant_id", "=", t.id)
    .where("renewal_period_start", "=", periodStart as unknown as never)
    .executeTakeFirst();
  let orderId = existing?.id ?? null;
  if (!orderId) {
    const { mintRenewalForTenant } = await import("../src/payment/billing.js");
    const r = await mintRenewalForTenant(t.id, now);
    orderId = r.orderIntentId;
    console.log(`[harness] megújulási számla: ${r.orderIntentId ?? "nem készült"} · ${r.price ?? "-"}`);
  }
  if (!orderId) throw new Error("nem jött létre megújulási számla (0 Ft-os ciklus?)");
  line("terhelendő számla", orderId);
  line("időszak", `${periodStart.toISOString().slice(0, 10)} → ${addMonths(periodStart, months).toISOString().slice(0, 10)}`);
  const outcome = await chargeRenewalWithToken(orderId, sub.recurrence_token, sub.recurrence_trace_id);
  line("MIT terhelés eredménye", outcome, outcome === "paid");
  if (outcome === "pending") {
    console.log("  (a válasz nem végleges — a gateway callbackje zárja le; futtasd újra a `status`-t)");
  }
  const after = await db
    .selectFrom("subscription")
    .select(["current_period_end", "status"])
    .where("id", "=", sub.id)
    .executeTakeFirstOrThrow();
  line("előfizetés a terhelés után", `${after.status} · fordulónap ${new Date(after.current_period_end as unknown as string).toISOString().slice(0, 10)}`);
  await db.destroy();
} else {
  console.error("ismeretlen parancs — config | status <tenant> | charge <tenant> [--now=…]");
  process.exit(1);
}
