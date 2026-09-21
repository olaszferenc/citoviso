// ⛔⛔ ÁR-JOGOSULTSÁGI KAPU A FOGLALÁSI ÚTON — ár nélküli lap, kötelező erejű ajánlat.
//
// A MÉRT LELET (ADR-0192 ②, 2026-09-21). A `/api/foglaltsag` végpont NEM kérdezte meg az
// entitlement-kaput. Ha a tenant lemondta a `pricing`-et, az ár eltűnt a LAPRÓL — de nem a
// folyamatból: a foglaló-widget tovább kalkulált, a `createBookingRequest` a kalkulált
// összeget BEFAGYASZTOTTA a kérésre (`quoted_total`), és az a szám kiment a vendég
// levelébe. A vendég így kötelező erejű ajánlatot kapott egy olyan oldalról, ahol ár nem
// is szerepel. Ez nem „hiányzó ár", hanem ELLENTMONDÁS a lap és a levél között.
//
// A DÖNTÉS, AMIT MÉR (ADR-0193): ár-jogosultság nélkül a foglalás ELINDUL, csak SZÁM NÉLKÜL.
// A foglalás KÉRÉS, nem vásárlás (ADR-0044 §6) — a kifizetett `booking` modult nem veheti el
// egy meg nem vett `pricing`; §B.17 szerint viszont jobb nincs szám, mint rossz szám.
//
// Miért END-TO-END és nem egység-teszt: a hiba KÉT külön úton ült (a HTTP-végpont
// árválasza és a kérés-befagyasztás), és mindkettő ugyanarra a `unit_price` táblára néz.
// Egy `quoteStayFrom`-ra írt egység-teszt mindkét úton zöld lett volna.
//
// Amit állít (eldobható fixture-ön, valódi DB + valódi HTTP-szerver):
//   ① FIZETŐ TENANT (pricing aktív): a végpont ÁRAT ad, a kérés ÁRAT fagyaszt.
//      ⭐ Ez nem díszlet: enélkül a kaput „mindig null"-ra lehetne rontani, és a
//      negatív állítások zöldek maradnának (feedback_gate_must_not_refuse_the_paying_customer).
//   ② LEMONDOTT `pricing` (booking aktív): a végpont `pricing: null`, a kérés ÁTMEGY,
//      a `quoted_total` a DB-ben NULL, az összefoglaló `total`-ja null, és a vendégnek
//      kiment levélben NINCS pénzösszeg (a kiszállított .eml-t olvassuk, nem a szándékot).
//   ③ `cancel_at_period_end` (a periódus végéig MÉG ÉL): az ár MARAD.
//      ⭐ A túl-kapuzás is hiba: a lemondás pillanatában a tenant még fizetett érte.
//
// Futtatás:
//   npx tsx scripts/booking-price-gate-check.mts
//   npx tsx scripts/booking-price-gate-check.mts --selftest   ← PIROSNAK KELL LENNIE
//
// A `--selftest` nem szimulál: a ② állításait a TÖRTÉNETI viselkedésen futtatja le —
// a végpontot ár-jogosultsággal kérdezi le (a kapu előtti válasz), a kérés sorára pedig
// ráírja a befagyasztott összeget, ahogy a régi kód tette. Ha ettől nem pirosodik, az őr vak.

import { once } from "node:events";
import { readFile, readdir, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";

const selftest = process.argv.includes("--selftest");

// Set BEFORE the first dynamic import, and only dynamic imports follow — a static
// `import` would run first and read these as unset (reference_env_assignment_loses_to_esm_imports).
process.env.CIT_SHOT = "1"; // no boot self-heal: no AI top-ups, no background DB writes
process.env.PUBLIC_PORT = "0"; // an ephemeral port: ~10 worktrees share this machine

// ⛔ A levél-adapter NEM mock ezen a gépen (EMAIL_PROVIDER=smtp). Ami megvéd, az a
// ReservedRecipientGuard: RFC 2606/6761 foglalt domainre (example.com) nem megy ki a
// hálózatra, hanem outbox/-ba ír. Ezért MINDEN fixture-címzett foglalt domainen van —
// és a ③ állítás épp ezt a kiszállított fájlt olvassa vissza. FAIL-CLOSED: ha a
// címzett-őr nem áll az útban, meg sem szólalunk.
const { config } = await import("../src/config.js");
const { reservedRecipients } = await import("../src/email/sender.js");
if (reservedRecipients("guest@example.com").length === 0) {
  console.error(
    "⛔ booking-price-gate-check: a foglalt-domain őr nem ismeri fel az example.com-ot — " +
      "a fixture VALÓDI levelet küldene. Nem futok.",
  );
  process.exit(1);
}

const { db, pool } = await import("../src/db/client.js");
const { createBookingRequest } = await import("../src/booking/requests.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { setBasePrice } = await import("../src/tenant/prices.js");

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const BASE_PRICE = 28_000;
const OUTBOX = resolve(process.cwd(), "outbox");

function addDays(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Any money amount in a mail body — the guest reads digits, not our intentions. */
function moneyIn(text: string): string[] {
  const out: string[] = [];
  const re = /\d[\d\s .]*\s*(?:Ft|HUF|€|EUR)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0].trim());
  return out;
}

interface AvailabilityAnswer {
  readonly status: number;
  readonly pricing: unknown;
}

const ids: { defId?: string; runId?: string; leadId?: string; tenantId?: string; siteId?: string } = {};
let server: Server | null = null;
/** Everything that was in outbox/ before us — never ours to delete. */
const kept = new Set(await readdir(OUTBOX).catch(() => [] as string[]));

try {
  // ── fixture: a live site with ONE priced unit ────────────────────────────────
  const stamp = Date.now().toString(36);
  const def = await db
    .insertInto("scraper_definition")
    .values({
      label: "_pgate_check",
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
    .values({ scrape_run_id: run.id, name: "_pgate_check lead", raw: JSON.stringify({}) })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.leadId = lead.id;

  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "_pgate_check tenant" })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;

  const slug = `pgate-${stamp}`;
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `pgate_${stamp}`,
      slug,
      status: "live",
      live_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  ids.siteId = site.id;
  const siteId = site.id;

  const unit = await db
    .insertInto("site_unit")
    .values({ site_id: siteId, name: "Padlásszoba", capacity: 2 })
    .returning("id")
    .executeTakeFirstOrThrow();
  await setBasePrice(unit.id, BASE_PRICE);

  // The owner's booking rules: the notify address stays on a RESERVED domain.
  await setSiteModuleConfig(siteId, "booking", { notifyEmail: "owner@example.com" }, "test");

  // ── the server under measurement (the delivered endpoint, not a function) ────
  const mod = (await import("../src/server/public.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;

  async function availability(unitId: string): Promise<AvailabilityAnswer> {
    const r = await fetch(`http://127.0.0.1:${port}/t/${slug}/api/foglaltsag/${unitId}`);
    const body = (await r.json().catch(() => ({}))) as { pricing?: unknown };
    return { status: r.status, pricing: body.pricing ?? null };
  }

  async function frozen(requestId: string): Promise<{ total: number | null; currency: string | null }> {
    const row = await db
      .selectFrom("booking_request")
      .select(["quoted_total as total", "quoted_currency as currency"])
      .where("id", "=", requestId)
      .executeTakeFirst();
    return { total: row?.total ?? null, currency: row?.currency ?? null };
  }

  // ── ① the PAYING tenant still gets numbers ───────────────────────────────────
  console.log("\n① Fizető tenant (booking + pricing aktív) — az ár MEGY:");
  await setTenantModules(tenant.id, ["booking", "pricing"]);

  const paidAvail = await availability(unit.id);
  check("a végpont válaszol", paidAvail.status === 200, paidAvail.status);
  check(
    "⭐ ár-jogosultsággal a widget MEGKAPJA az árat",
    Boolean(paidAvail.pricing) && Array.isArray((paidAvail.pricing as { rows?: unknown }).rows),
    paidAvail.pricing,
  );

  const paidReq = await createBookingRequest(
    {
      siteId,
      unitId: unit.id,
      guestName: "Fizetős Vendég",
      guestEmail: "guest-paid@example.com",
      guestPhone: "+36 30 111 2233",
      dateFrom: addDays(30),
      dateTo: addDays(32),
      guests: 2,
    },
    null,
  );
  check("a kérés átmegy", paidReq.ok === true, paidReq.errors);
  const paidFrozen = paidReq.id ? await frozen(paidReq.id) : { total: null, currency: null };
  check(
    "⭐ ár-jogosultsággal a kérésre ÁR fagy (2 × 28 000)",
    paidFrozen.total === 2 * BASE_PRICE,
    paidFrozen,
  );
  check("az összefoglaló is mondja az árat", paidReq.summary?.total === 2 * BASE_PRICE, paidReq.summary?.total);

  // ── ② the CANCELLED pricing: no number anywhere ──────────────────────────────
  console.log("\n② Lemondott `pricing` (booking aktív) — SEHOL nincs szám:");
  await setTenantModules(tenant.id, ["booking"]);

  const barePricing = selftest
    ? // RED CONTROL: the endpoint answered WITHOUT the gate — exactly the historical
      // behaviour. Same fetch, same parsing, only the entitlement is put back.
      await (async () => {
        await setTenantModules(tenant.id, ["booking", "pricing"]);
        const a = await availability(unit.id);
        await setTenantModules(tenant.id, ["booking"]);
        return a;
      })()
    : await availability(unit.id);
  check("a végpont válaszol (a foglaltság-naptár él)", barePricing.status === 200, barePricing.status);
  check(
    "⛔⛔ ár-jogosultság NÉLKÜL a widget NEM kap árat",
    barePricing.pricing === null,
    barePricing.pricing,
  );

  // ⛔ SNAPSHOT FIRST, and this is not a detail. The recipient slug is stable
  // ("guest-bare-example-com"), so the FIRST version of this guard happily read the
  // PREVIOUS RUN's letter — it reported the pre-fix amounts against fixed code and
  // never even waited for the new mail. Only a file that did not exist a moment ago
  // can answer a question about this request.
  const outboxBefore = new Set(await readdir(OUTBOX).catch(() => [] as string[]));

  const bareFrom = addDays(40);
  // RED CONTROL: the entitlement goes back ONLY for the duration of the measured
  // call. That is bit for bit what the ungated code did — compute and freeze as
  // though `pricing` were live — and it runs the WHOLE chain (freeze → row → guest
  // letter), not just the bit a post-hoc UPDATE could reach. A red control that
  // cannot touch the letter would leave the loudest assertion untested: the letter
  // is where the 84 000 Ft actually reached the guest.
  if (selftest) await setTenantModules(tenant.id, ["booking", "pricing"]);
  const bareReq = await createBookingRequest(
    {
      siteId,
      unitId: unit.id,
      guestName: "Ár Nélküli Vendég",
      guestEmail: "guest-bare@example.com",
      guestPhone: "+36 30 444 5566",
      dateFrom: bareFrom,
      dateTo: addDays(42),
      guests: 2,
    },
    null,
  );
  if (selftest) await setTenantModules(tenant.id, ["booking"]);
  check(
    "⭐ a foglalás ATTÓL MÉG ELINDUL (a kérés nem vásárlás — ADR-0044 §6)",
    bareReq.ok === true,
    bareReq.errors,
  );

  const bareFrozen = bareReq.id ? await frozen(bareReq.id) : { total: null, currency: null };
  check(
    "⛔⛔ ár-jogosultság NÉLKÜL a kérésre NEM fagy összeg (quoted_total IS NULL)",
    bareFrozen.total === null,
    bareFrozen,
  );
  check(
    "az összefoglaló sem mond árat a vendégnek",
    (bareReq.summary?.total ?? null) === null,
    bareReq.summary?.total,
  );

  // ── the letter itself: the delivered artifact, not the intention ─────────────
  // The guest ack is fire-and-forget (void mailSafe), so the file appears a moment
  // later. We wait for it BY NAME — a timeout here is a measurement failure and is
  // reported as such, never swallowed as "no money found".
  const mailFile = await (async () => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const files = await readdir(OUTBOX).catch(() => [] as string[]);
      const hit = files
        .filter((f) => !outboxBefore.has(f) && f.includes("guest-bare-example-com"))
        .sort()
        .pop();
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  })();
  if (!mailFile) {
    failures++;
    console.error(
      "  ✗ ⛔ a vendég-levél nem jelent meg az outbox/-ban 15 mp alatt — a levél-állítást NEM tudtam megmérni",
    );
  } else {
    const body = await readFile(resolve(OUTBOX, mailFile), "utf8");
    const amounts = moneyIn(body);
    check(
      "⛔⛔ a VENDÉG LEVELÉBEN sincs pénzösszeg (a kiszállított .eml olvasva)",
      amounts.length === 0,
      { mailFile, amounts },
    );
    check("a levél attól még megszületett (dátummal)", body.includes(bareFrom.slice(-2)), mailFile);
  }

  // ── ③ cancelled-but-still-paid: the price STAYS ──────────────────────────────
  console.log("\n③ `cancel_at_period_end` (a periódus végéig kifizetve) — az ár MARAD:");
  await setTenantModules(tenant.id, ["booking", "pricing"]);
  await db
    .updateTable("module_entitlement")
    .set({ cancel_at_period_end: true })
    .where("tenant_id", "=", tenant.id)
    .where("module", "=", "pricing")
    .execute();

  const endingAvail = await availability(unit.id);
  check(
    "⭐ a lemondás PILLANATÁBAN még jár az ár (nem szabad túl-kapuzni)",
    Boolean(endingAvail.pricing),
    endingAvail.pricing,
  );
} finally {
  // The fixture's letters are fixture artifacts: leaving them behind would grow the
  // dev outbox on every commit and put decoys next to the real ones.
  for (const f of await readdir(OUTBOX).catch(() => [] as string[])) {
    if (/-(guest-paid|guest-bare|owner)-example-com\.eml$/.test(f) && !kept.has(f)) {
      await rm(resolve(OUTBOX, f)).catch(() => {});
    }
  }
  if (ids.siteId) await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  if (ids.tenantId) await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
  server?.close();
}

if (selftest) {
  if (failures) {
    console.log(`\n✅ önteszt: a TÖRTÉNETI viselkedésen ${failures} állítás pirosra ment — az őr lát.`);
    process.exit(0);
  }
  console.error("\n⛔ ÖNTESZT-BUKÁS: a régi (kapu nélküli) viselkedés ZÖLD maradt — az őr VAK.");
  process.exit(1);
}

if (failures) {
  console.error(`\n⛔ booking-price-gate-check: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log(
  `\n✅ booking-price-gate-check: ár-jogosultság nélkül sem a widget, sem a kérés, sem a vendég levele nem mond árat (${config.emailProvider} adapter, foglalt domain → outbox).`,
);
