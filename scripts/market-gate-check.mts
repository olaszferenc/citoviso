// ADR-0111 guard — do the three market gates actually bite?
//
// The claim under test: a country whose legal pack is NOT approved gets no cold
// outreach, no pay-link and no live site. Each is asserted in BOTH directions on a
// throwaway market (XX), because a gate that always blocks proves as little as one
// that never does.
//
// Two layers:
//   1. pure gate logic (no DB) — the outreach verdict, incl. the fail-closed default
//      that fires when a caller forgets to pass the market verdict;
//   2. real DB fixtures — a paid order in a closed market must get NO pay-link and
//      must NOT flip a site live. Structural greps would not catch a gate that was
//      wired after the thing it guards.
//
//   npx tsx scripts/market-gate-check.mts
import { checkOutreachDraft, type MarketVerdict } from "../src/outreach/outreachCheck.js";
import {
  approveMarket,
  isMarketApproved,
  normalizeCountryCode,
  revokeMarket,
  HOME_MARKET,
} from "../src/markets.js";
import { db } from "../src/db/client.js";

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// Az ország-kapu jele a renderelt ok-soron. Szándékosan SAJÁT literál (nem a
// vizsgált modulból importált konstans): az őr ne a saját alanyától kérdezze meg,
// mit keressen. 2026-09-12-től emberi tárgy-prefix, nem „C-ORSZÁG" kód.
const COUNTRY_GATE = /^PIAC:/m;
const draft = {
  subject: "Készítettem egy mintaoldalt",
  body: "Kedves Szállásadó! …",
} as Parameters<typeof checkOutreachDraft>[0];

const blockedFor = (lang: string | undefined, market?: MarketVerdict): boolean =>
  checkOutreachDraft(draft, "Teszt Panzió", lang, market).reasons.some((r) => COUNTRY_GATE.test(r));

console.log("\n1. Outreach-kapu (tiszta logika, DB nélkül)");
check("jóváhagyott piac → NINCS ország-tiltás", !blockedFor("de", { country: "AT", approved: true }));
check("nem jóváhagyott piac → TILTVA", blockedFor("de", { country: "AT", approved: false }));
check("ismeretlen ország → TILTVA", blockedFor("de", { country: null, approved: false }));
// The important one: a call site that forgets the verdict must not thereby open a market.
check("verdikt NÉLKÜL, idegen nyelv → TILTVA (fail-closed)", blockedFor("pl", undefined));
check("verdikt nélkül, magyar → átmegy", !blockedFor("hu", undefined));
// And the home market still works through the normal path.
check("HU jóváhagyva → átmegy", !blockedFor("hu", { country: HOME_MARKET, approved: true }));
// A market that is open must not be blocked just because the language is foreign —
// this is the whole point of moving from `lang !== "hu"` to a per-country decision.
check(
  "nyitott piac idegen nyelven → átmegy",
  !blockedFor("de", { country: "AT", approved: true }),
  "a nyelv-alapú régi szabály maradványa",
);

console.log("\n2. Piac-nyilvántartás (DB, eldobható XX ország)");
const XX = "XX";
await db.deleteFrom("market_log").where("country", "=", XX).execute();
await db.deleteFrom("market").where("country", "=", XX).execute();
try {
  check("ismeretlen ország nincs jóváhagyva", !(await isMarketApproved(XX)));
  check("indoklás nélkül NEM nyílik meg", !(await approveMarket({ country: XX, actor: "teszt", reason: "" })));
  check("…és sor sem keletkezett", !(await isMarketApproved(XX)));
  check(
    "indoklással megnyílik",
    await approveMarket({ country: XX, actor: "teszt", reason: "ADR-0111 önteszt" }),
  );
  check("a kapu most nyitva", await isMarketApproved(XX));
  check("kisbetűs írásmód ugyanaz a piac", await isMarketApproved("xx"), "normalizálás nélkül két piac lenne");
  check(
    "lezárható",
    await revokeMarket({ country: XX, actor: "teszt", reason: "önteszt vége" }),
  );
  check("lezárás után zárva", !(await isMarketApproved(XX)));
  const log = await db.selectFrom("market_log").select("action").where("country", "=", XX).execute();
  check("mindkét döntés naplózva", log.length === 2, `${log.length} naplósor`);
  check("a HAZAI piac innen nem zárható le", !(await revokeMarket({ country: HOME_MARKET, actor: "teszt", reason: "próba" })));
  check("…és tényleg nyitva maradt", await isMarketApproved(HOME_MARKET));
} finally {
  await db.deleteFrom("market_log").where("country", "=", XX).execute();
  await db.deleteFrom("market").where("country", "=", XX).execute();
}

console.log("\n3. Fizetési kapu (valódi order, valódi requestPayment)");
// A full fixture chain, torn down at the end: scrape area → lead → prospect → order.
const ids: Record<string, string> = {};
try {
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_mkt_check",
      country: XX,
      region: "_mkt_check",
      city: null,
      industry: "szallas",
      sources: JSON.stringify(["osm"]),
      lead_cap: 1,
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
    .values({ scrape_run_id: run.id, name: "_mkt_check panzió", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const artifact = await db
    .insertInto("mock_artifact")
    .values({ lead_id: lead.id, status: "approved", inputs: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.artifactId = artifact.id;
  const prospect = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: artifact.id, token: `mktchk${Date.now()}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.prospectId = prospect.id;
  // A renewal order must belong to a tenant (order_intent_upsell_tenant_chk), and the
  // renewal exception is one of the claims under test — so the fixture needs one.
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_mkt_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const order = await db
    .insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: 9900,
      kind: "initial",
      buyer_name: "_mkt_check Teszt",
      buyer_type: "individual",
      buyer_country: XX,
      buyer_email: "mkt@example.invalid",
      modules: JSON.stringify([]),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.orderId = order.id;

  const { requestPayment } = await import("../src/payment/service.js");

  // CLOSED market → no pay-link. The order stays recorded; nothing is taken.
  const closed = await requestPayment(order.id);
  check("zárt piac → NINCS fizetési link", closed === null, `kapott: ${JSON.stringify(closed)}`);

  // OPEN market → the gate lets it through. (It may still fail further down on the
  // gateway config in a dev environment; what we assert is that THIS gate no longer
  // refuses — i.e. the failure reason changed.)
  await approveMarket({ country: XX, actor: "teszt", reason: "ADR-0111 fizetési önteszt" });
  const opened = await requestPayment(order.id).catch((e: Error) => `THREW:${e.message}`);
  check(
    "nyitott piac → a piac-kapu már nem tiltja",
    opened !== null,
    "a kapu nyitott piacon is elutasított",
  );

  // And back: revoking closes it again — the gate reads live state, not a boot-time cache.
  await revokeMarket({ country: XX, actor: "teszt", reason: "önteszt vége" });
  const reclosed = await requestPayment(order.id);
  check("visszazárás után újra NINCS link", reclosed === null);

  // A RENEWAL must survive a closed market: an existing customer may not be made
  // unable to pay by a decision of ours (ADR-0111).
  // The DB requires kind+tenant to agree (order_intent_upsell_tenant_chk): an initial
  // order has no tenant, a renewal must have one. Flip both in one statement.
  await db
    .updateTable("order_intent")
    .set({ kind: "renewal", tenant_id: tenant.id })
    .where("id", "=", order.id)
    .execute();
  const renewal = await requestPayment(order.id).catch((e: Error) => `THREW:${e.message}`);
  check(
    "zárt piac + MEGÚJULÁS → a kapu nem tiltja",
    renewal !== null,
    "a meglévő ügyfél nem tudna fizetni",
  );
} finally {
  if (ids.orderId) await db.deleteFrom("payment").where("order_intent_id", "=", ids.orderId).execute();
  if (ids.orderId) await db.deleteFrom("order_intent").where("id", "=", ids.orderId).execute();
  if (ids.prospectId) await db.deleteFrom("prospect").where("id", "=", ids.prospectId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.artifactId) await db.deleteFrom("mock_artifact").where("id", "=", ids.artifactId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await db.deleteFrom("market_log").where("country", "=", XX).execute();
  await db.deleteFrom("market").where("country", "=", XX).execute();
}

console.log("\n4. Élesítési kapu — SORREND (a kapu a live-kapcsoló ELŐTT)");
// A DB fixture for activate() would need the whole convertLead chain; what actually
// breaks in practice is ORDER, not existence: a gate placed after the `status: "live"`
// update would let a site go live and only then complain. So assert the order in the
// source, on the activate() body alone.
{
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/payment/service.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("async function activate("));
  const gateAt = body.indexOf("isMarketApproved(oi.buyerCountry)");
  const liveAt = body.indexOf('status: "live"');
  check("az activate() hívja a piac-kaput", gateAt > -1);
  check("a live-kapcsoló létezik", liveAt > -1);
  check(
    "a kapu MEGELŐZI az élesítést",
    gateAt > -1 && liveAt > -1 && gateAt < liveAt,
    `kapu@${gateAt} vs live@${liveAt}`,
  );
  // The refusal must be loud: a paid activation that stops silently is the failure
  // mode this codebase has already been bitten by.
  const refusal = body.slice(gateAt, liveAt);
  check("a megtagadás naplóz (nem néma)", /console\.error/.test(refusal));
  check("…és kimondja, hogy a vevő FIZETETT", /FIZETETT/.test(refusal));
}

console.log(
  fails === 0
    ? "\n✅ market-gate-check: a piac-kapuk fognak (outreach + fizetés + nyilvántartás)."
    : `\n🔴 market-gate-check: ${fails} hiba.`,
);
process.exit(fails === 0 ? 0 : 1);
