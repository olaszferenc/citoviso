// DEV-ONLY demo seed for the partner console (PARTNER-UI-SPEC.md). The local DB
// has zero partners (the customer partner is born at the first real payment), so
// without this the partner UI cannot be exercised at all. Everything inserted here
// is marked with SEED_NOTE and re-runs are idempotent: prior seed rows are removed
// first, then re-inserted. NEVER run against prod (refuses when DATABASE_URL set).
//
// Usage: npx tsx scripts/seed-partner-demo.mts          # (re)seed
//        npx tsx scripts/seed-partner-demo.mts --clean  # remove seed rows only

import { config } from "../src/config.js";
import { db, pool } from "../src/db/client.js";

const SEED_NOTE = "seed-partner-demo";

if (config.databaseUrl) {
  console.error("🔴 DATABASE_URL is set — this seed is DEV-ONLY. Refusing.");
  process.exit(1);
}

async function clean(): Promise<void> {
  // Order matters: documents reference partners with ON DELETE RESTRICT.
  const seededPartners = db.selectFrom("partner").select("id").where("note", "=", SEED_NOTE);
  await db.deleteFrom("accounting_document").where("note", "=", SEED_NOTE).execute();
  await db.deleteFrom("partner_contact").where("partner_id", "in", seededPartners).execute();
  await db.deleteFrom("partner_bank_account").where("partner_id", "in", seededPartners).execute();
  await db.deleteFrom("partner").where("note", "=", SEED_NOTE).execute();
  await db.deleteFrom("legal_entity").where("code", "=", "DEMO").execute();
}

async function seed(): Promise<void> {
  const now = Date.now();
  const day = 86_400_000;
  const daysAgo = (n: number) => new Date(now - n * day);
  const daysAhead = (n: number) => new Date(now + n * day);

  // The books' owner. Real entity data lives in prod env (LEGAL_ENTITY_*); this
  // is a marked demo entity so the documents have a legal home locally.
  const entity = await db
    .insertInto("legal_entity")
    .values({
      code: "DEMO",
      name: "Demo Kft. (TESZT)",
      country: "HU",
      default_vat_key: "AAM",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Reuse the dev tenant with the RICHEST marketing chain (prospect → views →
  // orders → payments), so the demo timeline exercises all eight sources;
  // otherwise the link stays empty.
  const rich = await pool.query(`
    SELECT t.id FROM tenant t JOIN lead l ON l.id = t.lead_id
    ORDER BY (SELECT count(*) FROM payment p JOIN order_intent oi ON oi.id = p.order_intent_id
              JOIN prospect pr ON pr.id = oi.prospect_id WHERE pr.lead_id = l.id) DESC,
             (SELECT count(*) FROM mock_view v JOIN prospect pr ON pr.id = v.prospect_id
              WHERE pr.lead_id = l.id) DESC
    LIMIT 1`);
  const tenant = rich.rows[0] as { id: string } | undefined;

  const partner = async (v: {
    name: string;
    is_customer?: boolean;
    is_supplier?: boolean;
    tax_number?: string;
    eu_vat_number?: string;
    registration_no?: string;
    country?: string;
    zip?: string;
    city?: string;
    address?: string;
    email?: string;
    tenant_id?: string;
  }): Promise<string> => {
    const row = await db
      .insertInto("partner")
      .values({ country: "HU", ...v, note: SEED_NOTE })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  };

  const customer = await partner({
    name: "Vendégház Panoráma Kft. (TESZT)",
    is_customer: true,
    tax_number: "12345678-2-19",
    registration_no: "19-09-123456",
    zip: "8237",
    city: "Tihany",
    address: "Fő utca 12.",
    email: "panorama@example.test",
    tenant_id: tenant?.id,
  });
  const hetzner = await partner({
    name: "Hetzner Online GmbH (TESZT)",
    is_supplier: true,
    eu_vat_number: "DE812871812",
    country: "DE",
    city: "Gunzenhausen",
    address: "Industriestr. 25",
  });
  const anthropic = await partner({
    name: "Anthropic PBC (TESZT)",
    is_supplier: true,
    country: "US",
    city: "San Francisco",
  });
  const dual = await partner({
    name: "Kétarcú Szolgáltató Zrt. (TESZT)",
    is_customer: true,
    is_supplier: true,
    tax_number: "87654321-2-41",
    zip: "1051",
    city: "Budapest",
    address: "Alkotmány u. 1.",
  });

  await db
    .insertInto("partner_contact")
    .values([
      { partner_id: customer, kind: "billing", name: "Kiss Éva (könyvelő)", email: "konyveles@example.test", is_primary: true },
      { partner_id: customer, kind: "billing", email: "panorama@example.test" },
      { partner_id: customer, kind: "technical", name: "Kiss Péter", email: "peter@example.test", phone: "+36301234567" },
      { partner_id: hetzner, kind: "billing", email: "billing@hetzner.test", is_primary: true },
    ])
    .execute();

  await db
    .insertInto("partner_bank_account")
    .values([
      { partner_id: customer, account_no: "11712345-20012345-00000000", bank_name: "OTP Bank", is_default: true },
      { partner_id: hetzner, account_no: "DE12500105170648489890", bank_name: "Deutsche Bank", currency: "EUR", is_default: true },
    ])
    .execute();

  // Documents covering every list/aging bucket: paid + unpaid, outgoing +
  // incoming, HUF + EUR, and one storno; due dates hit not-due / 1-30 / 31-60 /
  // 61-90 / 90+ so the aging table shows real spread.
  let no = 0;
  const doc = (v: {
    direction: "outgoing" | "incoming";
    partner_id: string;
    document_number: string;
    doc_type?: "invoice" | "storno";
    issue: Date;
    due: Date;
    gross: number;
    currency?: string;
    paid?: Date;
  }) =>
    db
      .insertInto("accounting_document")
      .values({
        legal_entity_id: entity.id,
        internal_no: ++no,
        direction: v.direction,
        doc_type: v.doc_type ?? "invoice",
        partner_id: v.partner_id,
        document_number: v.document_number,
        issue_date: v.issue,
        fulfillment_date: v.issue,
        due_date: v.due,
        net: String(v.gross),
        vat: "0",
        gross: String(v.gross),
        currency: v.currency ?? "HUF",
        vat_treatment: "AAM",
        paid: Boolean(v.paid),
        paid_at: v.paid ?? null,
        source: "manual",
        note: SEED_NOTE,
      })
      .execute();

  // Customer: subscription invoices — two paid (one late, one early: payment
  // habit needs both signs), one not yet due, one 12 days overdue.
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-101", issue: daysAgo(95), due: daysAgo(87), gross: 24_900, paid: daysAgo(82) });
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-102", issue: daysAgo(65), due: daysAgo(57), gross: 24_900, paid: daysAgo(60) });
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-103", issue: daysAgo(20), due: daysAgo(12), gross: 24_900 });
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-104", issue: daysAgo(3), due: daysAhead(5), gross: 24_900 });
  // A storno pair: negative amount in the same list (spec: sztornó negatív
  // összeggel). BOTH legs are settled — a stornóed invoice is not a receivable.
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-105", issue: daysAgo(50), due: daysAgo(42), gross: 9_900, paid: daysAgo(48) });
  await doc({ direction: "outgoing", partner_id: customer, document_number: "OV-2026-105-S", doc_type: "storno", issue: daysAgo(48), due: daysAgo(48), gross: -9_900, paid: daysAgo(48) });

  // Suppliers: EUR hosting bills across the aging buckets + an AI bill.
  await doc({ direction: "incoming", partner_id: hetzner, document_number: "R0011223344", issue: daysAgo(130), due: daysAgo(116), gross: 12.6, currency: "EUR", paid: daysAgo(115) });
  await doc({ direction: "incoming", partner_id: hetzner, document_number: "R0011223399", issue: daysAgo(110), due: daysAgo(96), gross: 12.6, currency: "EUR" });
  await doc({ direction: "incoming", partner_id: hetzner, document_number: "R0011224001", issue: daysAgo(80), due: daysAgo(66), gross: 12.6, currency: "EUR" });
  await doc({ direction: "incoming", partner_id: hetzner, document_number: "R0011224100", issue: daysAgo(55), due: daysAgo(41), gross: 12.6, currency: "EUR" });
  await doc({ direction: "incoming", partner_id: hetzner, document_number: "R0011224200", issue: daysAgo(30), due: daysAgo(16), gross: 12.6, currency: "EUR" });
  await doc({ direction: "incoming", partner_id: anthropic, document_number: "INV-88421", issue: daysAgo(10), due: daysAhead(4), gross: 100, currency: "USD" });

  // Dual-role partner: one outgoing + one incoming, both open.
  await doc({ direction: "outgoing", partner_id: dual, document_number: "OV-2026-120", issue: daysAgo(15), due: daysAgo(7), gross: 49_900 });
  await doc({ direction: "incoming", partner_id: dual, document_number: "KSZ-2026-77", issue: daysAgo(25), due: daysAgo(10), gross: 15_000 });

  console.log(`🟢 seed kész: 4 partner, ${no} bizonylat, kontaktok + bankszámlák (jelölés: note='${SEED_NOTE}')`);
}

await clean();
if (!process.argv.includes("--clean")) await seed();
else console.log("🟢 seed-sorok eltávolítva");
await pool.end();
