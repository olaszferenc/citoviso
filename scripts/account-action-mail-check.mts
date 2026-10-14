// A tulaj fiók-műveletei írásban is visszaigazolva (Elek-szállásadó P-5, 2026-10-14): sem az
// előfizetés lemondásáról, sem a kártyás megbízás visszavonásáról nem ment levél — csak a
// képernyő mondta, és a postafiókban semmi nem maradt arról, mi történik ezután.
//   ① lemondás → „Lemondását rögzítettük”: a zárás napja, nem terhelünk, a visszalépés útja;
//   ② visszalépés → „Előfizetése folytatódik”: a következő fordulónap és a fizetés módja;
//   ③ megbízás visszavonása → „Az automatikus kártyaterhelést kikapcsoltuk”: a kártya
//      (a visszavonás ELŐTT kiolvasva), a következő lépés — lemondott előfizetésnél a zárás;
//   ④ minden levél naplózva (tenant_message), és a public.ts útvonalai tényleg küldik.
// Futtatás: npx tsx scripts/account-action-mail-check.mts
import { readFile } from "node:fs/promises";
import path from "node:path";
const { db, pool } = await import("../src/db/client.js");
const { getEmailSender } = await import("../src/email/sender.js");
const { sendAccountActionMail, storedCardLabel } = await import("../src/payment/accountMail.js");
const { setSubscriptionCancel } = await import("../src/tenant/subscriptionAdmin.js");
const { revokeAutoCharge } = await import("../src/payment/subscription.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 300)}`}`);
  if (!c) fail++;
};
const sent: { to: string; subject: string; text: string }[] = [];
{
  const sender = getEmailSender();
  const orig = sender.send.bind(sender);
  sender.send = async (m) => {
    sent.push({ to: m.to, subject: m.subject, text: m.text });
    return orig(m);
  };
}
const last = (): { to: string; subject: string; text: string } | undefined => sent[sent.length - 1];

const ids: Record<string, string> = {};
try {
  const stamp = Date.now().toString(36);
  const def = await db.insertInto("scraper_definition").values({ label: "_aam", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_aam lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Levél Teszt Vendégház" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const owner = `owner-${stamp}@example.com`;
  await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `aam_${stamp}`, contact_email: owner, password_hash: null } as never).execute();
  const end = new Date(Date.UTC(2026, 10, 29));
  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenant.id, status: "active", current_period_start: new Date(Date.UTC(2026, 9, 29)), current_period_end: end, anchor_date: end,
      billing_period: "monthly", payment_method: "token", recurrence_token: `tok_${stamp}`, card_brand: "Visa", card_last4: "4242", card_saved_at: new Date(),
    } as never)
    .execute();

  console.log("\n① lemondás");
  await setSubscriptionCancel(tenant.id, true);
  check("egy levél ment", (await sendAccountActionMail(tenant.id, "cancel")) === 1);
  let m = last();
  check("⭐ a tulajnak, „Lemondását rögzítettük” tárggyal", m?.to === owner && /Lemondását rögzítettük/.test(m?.subject ?? ""), m?.subject);
  check("⭐ kimondja a zárás napját és hogy nem terhelünk", /2026\. ?11\. ?29\./.test(m?.text ?? "") && /nem terhelünk, és fizetési linket sem küldünk/.test(m?.text ?? ""), m?.text);
  check("a visszalépés útja a felület szavával", /„Meggondoltam magam — folytatom”/.test(m?.text ?? ""));

  console.log("\n② visszalépés");
  await setSubscriptionCancel(tenant.id, false);
  await sendAccountActionMail(tenant.id, "resume");
  m = last();
  check("⭐ „Előfizetése folytatódik”, a fordulónap és a kártyás levonás", /folytatódik/.test(m?.subject ?? "") && /2026\. ?11\. ?29\./.test(m?.text ?? "") && /mentett kártyáról vonjuk le/.test(m?.text ?? ""), m?.text);

  console.log("\n③ megbízás visszavonása");
  const label = await storedCardLabel(tenant.id);
  check("a kártya címkéje a visszavonás előtt kiolvasható", label === "Visa ····4242", label);
  check("a visszavonás megtörtént", await revokeAutoCharge(tenant.id));
  check("a visszavonás után a címke már nem olvasható (ezért kell előtte)", (await storedCardLabel(tenant.id)) === null);
  await sendAccountActionMail(tenant.id, "revoke", { cardLabel: label });
  m = last();
  check("⭐ „kikapcsoltuk”, a kártya neve, és a fizetési link a következő fordulónapon", /kártyaterhelést kikapcsoltuk/.test(m?.subject ?? "") && /Visa ····4242/.test(m?.text ?? "") && /fizetési linket küldünk/.test(m?.text ?? ""), m?.text);
  await setSubscriptionCancel(tenant.id, true);
  await sendAccountActionMail(tenant.id, "revoke", { cardLabel: label });
  m = last();
  check("⭐ lemondott előfizetésnél a visszavonás levele a zárást mondja, nem fizetési linket", /zárul, és fizetési linket sem küldünk/.test(m?.text ?? "") && !/fizetési linket küldünk e-mailben/.test(m?.text ?? ""), m?.text);

  console.log("\n④ napló és bekötés");
  const logged = await db.selectFrom("tenant_message").select("subject").where("tenant_id", "=", tenant.id).execute();
  check("⭐ mind a 4 levél naplózva", logged.length === 4, logged.map((l) => l.subject));
  const src = await readFile(path.resolve(import.meta.dirname, "../src/server/public.ts"), "utf8");
  check("a lemondás / visszalépés útvonal küldi", /setSubscriptionCancel\(session\.tenantId, cancel\);\s*\/\/[^\n]*\n\s*await sendAccountActionMail\(session\.tenantId, cancel \? "cancel" : "resume"\)/.test(src));
  check("a visszavonás útvonal a címkét ELŐTTE olvassa, és csak sikeres visszavonás után küld", /const cardLabel = await storedCardLabel\(session\.tenantId\);\s*if \(await revokeAutoCharge\(session\.tenantId\)\) await sendAccountActionMail\(session\.tenantId, "revoke", \{ cardLabel \}\)/.test(src));
} finally {
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("saved_card_history" as never).where("tenant_id" as never, "=", ids.tenantId as never).execute().catch(() => {});
    await db.deleteFrom("subscription").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant_user").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(fail ? `\n⛔ ACCOUNT-ACTION-MAIL: ${fail} bukás` : "\n🟢 ACCOUNT-ACTION-MAIL: a lemondás, a visszalépés és a megbízás visszavonása írásban is visszaigazolva");
process.exit(fail ? 1 : 0);
