-- 0148 ORSZÁG-RÉTEG 3/10 — a vevő NEMZETI adóazonosítója, ami NEM közösségi adószám (HR: OIB).
--
-- Elek HR (2026-11-20): a horvát obrt / cég az OIB-jével azonosítható; sokan ÁFA-körön kívül
-- vannak, közösségi adószámuk nincs, így cégként nem tudtak rendelni. A rendelés céges ága HR-ben
-- az OIB-t kéri (ISO 7064 MOD 11,10 ellenőrzés, src/billing/taxId.ts), és itt tárolja — NEM a
-- buyer_tax_number oszlopban, mert az a számla magyar „adoszam” mezőjébe megy (szamlazz.ts).
-- Az OIB a tenant impresszumát tölti elő (src/tenant/legalIdentity.ts). Más országban NULL.
--
-- ⛔ ADDITIVE ONLY (shared dev DB): one nullable column, nothing dropped or rewritten.
ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS buyer_national_tax_id text;
COMMENT ON COLUMN order_intent.buyer_national_tax_id IS
  '3/10: a vevő nemzeti adóazonosítója, ami nem közösségi adószám (HR: OIB, 11 jegy). Nem kerül a számla adoszam mezőjébe; az impresszumot tölti elő.';
