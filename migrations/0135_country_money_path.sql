-- 0135 ORSZÁG-RÉTEG 3/1 — A PÉNZ ÚTJA (ADR-0437 ⑤3, ADR-XXXX).
--
-- Every country prices, charges and invoices in ITS OWN currency (owner, 2026-11-12): the
-- regional prices are absolute amounts set on the console, there is no FX conversion of a
-- price, and the Hungarian flow stays bit-for-bit what it was.
--
-- ⛔ ADDITIVE ONLY (the dev DB is shared by every worktree, and an older process still
-- running against it must keep working): new columns with defaults that describe the rows
-- that already exist (every existing order, subscription and payment is HU/HUF), and new
-- tables. Nothing is dropped, renamed or rewritten.
--
-- AMOUNTS ARE IN THE CURRENCY'S MINOR UNIT, with the minor-unit digits a property of the
-- currency (src/text/money.ts minorDigits: ISO 4217, except HUF = 0 — neither Barion nor
-- Számlázz.hu takes fillér, and no HU amount ever had one). So for HUF the stored integer IS
-- the forint, exactly as before; for EUR/RON/PLN it is the cent/ban/grosz.

-- ── 1. Legacy MAJOR-unit rows ───────────────────────────────────────────────────────────
-- pricing_config / domain_tld rows written before this migration hold MAJOR units (the
-- seeded 'global' row: 10 = 10 €). Rewriting them would break an older process reading the
-- shared DB, so a flag says how a row is written; the loader scales a FALSE row once
-- (×10^digits — a no-op for HUF), and every save from now on writes minor units + TRUE.
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS minor_units boolean NOT NULL DEFAULT false;
ALTER TABLE domain_tld     ADD COLUMN IF NOT EXISTS minor_units boolean NOT NULL DEFAULT false;

-- ── 2. Module prices PER REGION ──────────────────────────────────────────────────────────
-- module_price stays the HU region's map (every existing writer writes it; a copy here would
-- be a second truth for 'hu'). Every OTHER region keeps its add-on prices here, in its own
-- currency's minor unit. A region without a row for a sellable module is INCOMPLETE and
-- fails closed (src/pricing.ts regionPriceGaps) — no 0, no fall back to the HUF map.
CREATE TABLE IF NOT EXISTS module_price_region (
  region        text NOT NULL REFERENCES pricing_config(region) ON DELETE CASCADE,
  module_id     text NOT NULL,
  price_monthly integer NOT NULL CHECK (price_monthly >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, module_id)
);
COMMENT ON TABLE module_price_region IS
  'ADR-XXXX: régiónkénti modulár (a régió pénznemének minor unitjában); a hu régióé a module_price.';

-- ── 3. Region + currency ON THE ORDER and ON THE SUBSCRIPTION ────────────────────────────
-- Resolved ONCE (the lead's country → country.pricing_region) when the order is recorded, and
-- every later price of that customer (renewal, upsell, multilang, module change, domain,
-- trial → paid) reads it from here — never a default. The defaults describe the rows that
-- already exist (all HU/HUF); the code always writes the columns explicitly.
ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS pricing_region text NOT NULL DEFAULT 'hu';
ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS currency       text NOT NULL DEFAULT 'HUF';
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS pricing_region text NOT NULL DEFAULT 'hu';
ALTER TABLE subscription ADD COLUMN IF NOT EXISTS currency       text NOT NULL DEFAULT 'HUF';

-- ── 4. Payment provider per country ──────────────────────────────────────────────────────
-- Which gateway charges this country's buyers. Today only 'barion' exists; a country whose
-- currency its provider does not accept cannot open (src/payment/providers.ts, fail closed).
ALTER TABLE country ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'barion';

-- ── 5. Invoice: the FX rate it was issued with + the buyer facts the tax counters need ───
-- A non-HUF invoice is issued with the MNB rate of its fulfilment date (Számlázz.hu
-- arfolyamBank=MNB). The rate we passed is stored, so the AAM cap (HUF), the OSS counter
-- (EUR) and the A60 summary (HUF) count with the SAME rate as the invoice itself.
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS fx_rate    numeric(14, 6);  -- HUF per 1 unit; NULL for HUF
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS fx_date    date;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS buyer_country       text;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS buyer_type          text;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS buyer_eu_vat_number text;

-- MNB official daily rates (HUF per 1 unit of `currency`), cached per day.
CREATE TABLE IF NOT EXISTS fx_rate (
  rate_date    date NOT NULL,
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  huf_per_unit numeric(14, 6) NOT NULL CHECK (huf_per_unit > 0),
  source       text NOT NULL DEFAULT 'MNB',
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rate_date, currency)
);
COMMENT ON TABLE fx_rate IS
  'ADR-XXXX: MNB hivatalos napi árfolyam (Ft / egység) — CSAK adó-számlálóhoz és devizás számlához, árat soha nem vált át.';
