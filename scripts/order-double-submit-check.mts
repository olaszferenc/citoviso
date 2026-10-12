// KETTŐS BEKÜLDÉS ŐR — két egyidejű beküldés ugyanarra a rendelésre EGY rendelést és EGY
// fizethető pay-linket ad (ADR-0366 ⑥, Elek 5. kör K2).
//
//   npx tsx scripts/order-double-submit-check.mts
//
// ⛔ MIÉRT (mérve 2026-10-11, Elek 5. kör): két egyidejű POST /p/<t>/request → 2 order_intent,
// 2 fizethető pay-link; két fülön a második is lehívódott — a pénz kétszer mozdult.
//
// MIT MÉR (a VALÓDI konzol-kezelőn, in-process efemer porton, saját fixtúrán, mock átjáróval):
//   ① két EGYIDEJŰ, azonos beküldés → 1 order_intent, mindkét válasz UGYANAZT a pay-linket adja,
//      a rendeléshez 1 payment-sor;
//   ② egy harmadik, később érkező azonos beküldés is ugyanazt adja vissza (nem nyit újat);
//   ③ kontroll: MÁS tartalmú rendelés (más ciklus) saját rendelést nyit — a régi link a
//      képernyőn már nem látható összeget terhelne (ADR-0032).
// A régi kódon ① PIROS (2 rendelés, 2 link).
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.INVOICE_PROVIDER = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";

import http from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";

let failed = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const { server: con } = (await import("../src/console/server.js")) as { server: http.Server };
const { db } = await import("../src/db/client.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
if (!con.listening) await once(con, "listening");
const port = (con.address() as { port: number }).port;
if (port === 4600) throw new Error("⛔ a mért szerver a megosztott 4600-on fut");

const parent = await createFixtureParent(db as never, "dblsubmit");
try {
  const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: `_dblsubmit_${stamp} Porta`, raw: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const art = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, path: `sites/_dblsubmit_${stamp}.html`, status: "approved", inputs: JSON.stringify({}) } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `dblsubmit${stamp}xxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  await db.insertInto("prospect").values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "created" } as never).execute();

  const BUYER = {
    buyer_type: "individual",
    buyer_name: "Teszt Elek",
    buyer_country: "HU",
    buyer_zip: "8360",
    buyer_city: "Keszthely",
    buyer_address: "Fő utca 1.",
    buyer_email: `dbl-${stamp}@example.invalid`,
    withdrawal_waiver: true,
    terms_accepted: true,
    photo_rights_declared: true,
    recurring_consent: true,
    modules: [],
    domain_type: "citoviso_sub",
  };
  const post = async (extra: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> }> => {
    const r = await fetch(`http://127.0.0.1:${port}/p/${token}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...BUYER, ...extra }),
    });
    return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };
  // The charged figure is the server's: ask once with a wrong one and take the answer
  // (price_changed carries it) — the guard does not re-derive pricing.
  const probe = await post({ billing_period: "monthly", price: -1 });
  const price = Number(probe.j.price);
  check("előfeltétel: a szerver megadja a terhelendő összeget", probe.j.error === "price_changed" && price > 0, JSON.stringify(probe.j));

  const [a, b] = await Promise.all([post({ billing_period: "monthly", price }), post({ billing_period: "monthly", price })]);
  const intents = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select(["order_intent.id as id", "order_intent.billing_period as period"])
    .where("prospect.lead_id", "=", lead.id)
    .execute();
  check("① két egyidejű beküldés → EGY order_intent", intents.length === 1, `${intents.length} db`);
  check(
    "① mindkét válasz UGYANAZT a pay-linket adja",
    typeof a.j.payUrl === "string" && a.j.payUrl === b.j.payUrl,
    `${String(a.j.payUrl)} · ${String(b.j.payUrl)}`,
  );
  const pays = intents[0]
    ? await db.selectFrom("payment").select("id").where("order_intent_id", "=", intents[0].id).execute()
    : [];
  check("① a rendeléshez EGY payment-sor", pays.length === 1, `${pays.length} db`);

  const c = await post({ billing_period: "monthly", price });
  check("② egy később érkező azonos beküldés is ugyanazt adja vissza", c.j.payUrl === a.j.payUrl, String(c.j.payUrl));

  const annualProbe = await post({ billing_period: "annual", price: -1 });
  const d = await post({ billing_period: "annual", price: Number(annualProbe.j.price) });
  const after = await db
    .selectFrom("order_intent")
    .innerJoin("prospect", "prospect.id", "order_intent.prospect_id")
    .select("order_intent.id as id")
    .where("prospect.lead_id", "=", lead.id)
    .execute();
  check(
    "③ kontroll: más tartalmú rendelés SAJÁT rendelést és linket kap",
    after.length === 2 && typeof d.j.payUrl === "string" && d.j.payUrl !== a.j.payUrl,
    `${after.length} rendelés · ${String(d.j.payUrl)}`,
  );
} finally {
  await parent.drop();
  con.close();
  await db.destroy();
}
console.log(failed ? `\n⛔ order-double-submit-check: ${failed} bukás` : "\n✅ order-double-submit-check: egy rendelés, egy pay-link");
process.exit(failed ? 1 : 0);
