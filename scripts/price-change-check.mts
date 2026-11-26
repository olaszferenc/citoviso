// „Országok / Árazás” 5. fázis (0156) — ŐR: az ÜTEMEZETT ÁRVÁLTOZÁS (B, tulaj 2026-11-26), egy SCRATCH DB-ben
// (az ársor tábláit írja — a közös dev ársorhoz nem nyúlhat). Pénz nem mozdul, levél a mock szállítóval.
//
//   ① a szétválasztás: alapdíj fel = emelés, modulár le = csökkenés, kevesebb ingyenes hónap = emelés;
//   ② a függő emelés: a dátum előtti napra a régi ár, a dátumra és utána az új; a táblák a régi árat tartják;
//   ③ a hatás: havi előfizető a dátum utáni első megújulástól, éves a saját megújulásától, a szüneteltetett
//      is érintett (jelölve), a havi bevétel-változás;
//   ④ a megújítás (billing.ts): a dátum ELŐTT kezdődő időszak régi áron, a dátumon/után kezdődő új áron;
//   ⑤ az értesítő: minden érintett előfizető egyszer (a második futás senkinek), a levél a tervé
//      (tárgy, tábla, a szüneteltetett mondata, nincs lemondó mondat);
//   ⑥ a napi alkalmazás: a dátumon a táblákba kerül, applied_at; utána a táblaár az új;
//   ⑦ a mentés útja (szerkezeti): a POST /pricing a 30 napnál korábbi dátumot elutasítja, emelésnél dátumot kér.
//
//   npx tsx scripts/price-change-check.mts
import pg from "pg";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SCRATCH_BASE = "citoviso_price_change_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
const PG = { host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5433), user: process.env.PGUSER ?? "postgres" };
process.env.CIT_SHOT = "1";
process.env.EMAIL_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.I18N_BOOT_TOPUP = "0";

async function admin(q: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(q);
  await c.end();
}
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], { env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" }, stdio: "pipe" });
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";

const { db } = await import("../src/db/client.js");
const pricing = await import("../src/pricing.js");
const { priceChangeImpact, sendPriceChangeNotices, firstRenewalOnOrAfter } = await import("../src/payment/priceChange.js");
const { mintRenewalForTenant } = await import("../src/payment/billing.js");
const { buildPriceChangeNoticeEmail } = await import("../src/email/priceChangeNotice.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

const TODAY = "2026-11-26";
const D = "2026-12-26";
try {
  await pricing.loadPricing(true);
  const base0 = pricing.getBaseMonthly("hu");

  console.log("① szétválasztás");
  const snap = pricing.pricingSnapshot("hu");
  const someModule = [...snap.modulePrices.entries()].find(([, v]) => v > 100)!;
  const split = pricing.splitPriceChange("hu", {
    baseMonthly: base0 + 1000,
    annualFreeMonths: snap.annualFreeMonths - 1,
    modulePrices: { [someModule[0]]: someModule[1] - 100 },
  });
  check("alapdíj fel → emelés", split.raise?.next.base === base0 + 1000 && split.raise?.old.base === base0, JSON.stringify(split.raise));
  check("kevesebb ingyenes hónap → emelés", split.raise?.next.freeMonths === snap.annualFreeMonths - 1);
  check("modulár le → csökkenés", split.cut?.next.modules?.[someModule[0]] === someModule[1] - 100, JSON.stringify(split.cut));

  // fixtures: four subscriptions (monthly before D, monthly at D, annual, frozen), no modules (base only)
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "pricechange");
  const mk = async (name: string, end: string, period: "monthly" | "annual", status: "active" | "frozen"): Promise<{ tenantId: string; subId: string }> => {
    const lead = await db.insertInto("lead").values({ scrape_run_id: parent.runId, name } as never).returning("id").executeTakeFirstOrThrow();
    const t = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: name } as never).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("prospect").values({ lead_id: lead.id, token: `pc-${name.replace(/\W/g, "")}-${Date.now()}` } as never).execute();
    await db.insertInto("tenant_user").values({ tenant_id: t.id, username: `u-${name.replace(/\W/g, "")}-${Date.now()}`, contact_email: `${name.replace(/\W/g, "").toLowerCase()}@example.invalid` } as never).execute();
    const start = new Date(Date.parse(`${end}T12:00:00Z`) - (period === "annual" ? 365 : 30) * 86_400_000);
    const s = await db.insertInto("subscription").values({
      tenant_id: t.id, status, billing_period: period, payment_method: "invoice",
      current_period_start: start, current_period_end: new Date(`${end}T12:00:00Z`), anchor_date: start,
      pricing_region: "hu", currency: "HUF", ...(status === "frozen" ? { frozen_at: new Date() } : {}),
    } as never).returning("id").executeTakeFirstOrThrow();
    return { tenantId: t.id, subId: s.id };
  };
  const A = await mk("Havi Korai", "2026-12-10", "monthly", "active");
  const B = await mk("Havi Napon", "2026-12-27", "monthly", "active");
  const C = await mk("Eves Elofizeto", "2027-03-01", "annual", "active");
  const F = await mk("Szunetelo", "2026-12-15", "monthly", "frozen");

  console.log("③ hatás (a mentés előtt)");
  const raise = { old: { base: base0 }, next: { base: base0 + 1000 } };
  const impact = await priceChangeImpact("hu", { raise: raise.next, raiseFrom: D, cut: null }, TODAY);
  const by = (id: string) => impact.subs.find((s) => s.subscriptionId === id)!;
  check("havi, a dátum előtti megújulással: az első új áras terhelés a következő hónap", by(A.subId).firstNewCharge === "2027-01-10", by(A.subId).firstNewCharge ?? "—");
  check("havi, a dátum utáni megújulással: az a nap", by(B.subId).firstNewCharge === "2026-12-27");
  check("éves: a saját megújulása, éves áron", by(C.subId).firstNewCharge === "2027-03-01" && by(C.subId).diff === 1000 * (12 - snap.annualFreeMonths), JSON.stringify(by(C.subId)));
  check("a szüneteltetett is érintett, jelölve", by(F.subId).diff === 1000 && impact.frozenAffected === 1);
  check("4/4 érintett; havi bevétel-változás = 3×1000 + éves/12", impact.affected === 4 && impact.total === 4 && impact.monthlyDelta === Math.round(3000 + (1000 * (12 - snap.annualFreeMonths)) / 12), JSON.stringify({ a: impact.affected, t: impact.total, m: impact.monthlyDelta }));
  check("firstRenewalOnOrAfter: havi lépés", firstRenewalOnOrAfter("2026-12-10", "monthly", D) === "2027-01-10");

  console.log("② a függő emelés");
  const id = await pricing.schedulePriceRaise("hu", raise, D, "őr");
  check("a tábla a régi árat tartja", pricing.getBaseMonthly("hu") === base0);
  check("a dátum előtti nap: régi ár", pricing.computeMonthlyAt([], "hu", "2026-12-25") === base0);
  check("a dátum napja: új ár", pricing.computeMonthlyAt([], "hu", D) === base0 + 1000);

  const again = pricing.splitPriceChange("hu", { baseMonthly: base0 + 1000, annualFreeMonths: snap.annualFreeMonths, modulePrices: {} });
  check("a már ütemezett árat újra beírva nincs új emelés (nincs második levél)", again.raise === null, JSON.stringify(again));
  const other = pricing.splitPriceChange("hu", { baseMonthly: base0 + 1500, annualFreeMonths: snap.annualFreeMonths, modulePrices: {} });
  check("más (magasabb) ár: új emelés", other.raise?.next.base === base0 + 1500);

  console.log("④ a megújítás");
  const rA = await mintRenewalForTenant(A.tenantId, new Date());
  const rB = await mintRenewalForTenant(B.tenantId, new Date());
  check("a dátum előtt kezdődő időszak (12-10): régi ár", rA.price === base0, String(rA.price));
  check("a dátumon/után kezdődő időszak (12-27): új ár", rB.price === base0 + 1000, String(rB.price));

  console.log("⑤ az értesítő");
  const n1 = await sendPriceChangeNotices(id, impact);
  const n2 = await sendPriceChangeNotices(id, impact);
  const logged = await db.selectFrom("price_change_notice").select("subscription_id").where("price_change_id", "=", id).execute();
  check("minden érintett előfizető egyszer (a szüneteltetett is)", n1.sent === 4 && logged.length === 4, JSON.stringify(n1));
  check("a második futás senkinek", n2.sent === 0);
  const m = buildPriceChangeNoticeEmail({ to: "x@example.invalid", lang: "hu", siteName: "Lidó", currency: "HUF", cycle: "monthly", now: 9210, next: 10210, effectiveFrom: D, firstNewCharge: "2026-12-27", frozen: true });
  const txt = `${m.subject}\n${m.text}`;
  check("a levél a tervé: tárgy, tábla, szüneteltetett mondat", /Változik a honlap-előfizetése díja — Lidó/.test(m.subject) && /Mostani díj/.test(txt) && /Új díj/.test(txt) && /Első terhelés az új díjjal/.test(txt) && /Ha folytatja/.test(txt), txt);
  check("nincs lemondó mondat (tulaj 2026-11-26)", !/lemond/i.test(`${m.text}${m.html}`));

  console.log("⑥ a napi alkalmazás");
  check("a dátum előtt nem lép életbe", (await pricing.applyDuePriceChanges("2026-12-25")) === 0 && pricing.getBaseMonthly("hu") === base0);
  check("a dátumon a táblába kerül", (await pricing.applyDuePriceChanges(D)) === 1 && pricing.getBaseMonthly("hu") === base0 + 1000);
  const row = await db.selectFrom("price_change").select("applied_at").where("id", "=", id).executeTakeFirstOrThrow();
  check("applied_at kitöltve, nincs több függő", !!row.applied_at && pricing.pendingPriceChanges("hu").length === 0);

  console.log("⑦ a mentés útja (szerkezeti)");
  const srv = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
  check("emelés dátum nélkül / 30 napnál korábbi dátummal: elutasítva", /Áremelésnél kezdő dátum kell/.test(srv) && /A kezdő dátum túl korai/.test(srv) && /30 \* 86_400_000/.test(srv));
  check("a tenant „Következő számla” a következő időszak kezdőnapjának árán (a levéllel egyezően)",
    /pricingSnapshotAt\(region, nextStart\)/.test(readFileSync(new URL("../src/tenant/subscriptionAdmin.ts", import.meta.url), "utf8")));
  check("a tenant „Jelenlegi díj” a futó időszak kezdőnapjának árán (a már kifizetett időszakot nem írja át)",
    /pricingSnapshotAt\(region, isoDate\(new Date\(sub\.current_period_start/.test(readFileSync(new URL("../src/tenant/subscriptionAdmin.ts", import.meta.url), "utf8")) &&
      /sub\.currentMonthly \?\? mv\.totalMonthly/.test(readFileSync(new URL("../src/server/adminViews.ts", import.meta.url), "utf8")));
  check("a megújítás az időszak kezdőnapjának árán", /computeMonthlyAt\(moduleIds, region, isoDate\(periodStart\)\)/.test(readFileSync(new URL("../src/payment/billing.ts", import.meta.url), "utf8")));
} finally {
  await db.destroy().catch(() => {});
}
console.log(fails ? `\n⛔ price-change-check: ${fails} hiba` : "\n✅ price-change-check: az ütemezett árváltozás a tulaj B döntése szerint működik");
process.exit(fails ? 1 : 0);
