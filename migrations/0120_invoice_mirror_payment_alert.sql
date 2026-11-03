-- 0120 RENDSZER-SZÁMLÁK A BIZONYLATOKBAN + RIASZTÁS MINDEN SIKERES FIZETÉSRŐL (ADR-0414).
--
-- MIÉRT KELL. Mérve élesen 2026-11-03: megjött az első valódi fizető vevő (Duna Vibe House,
-- CITO-2026-7), a számla rendben kiment a Számlázz.hu-ból — a konzolon mégsem látszott SEMMI.
-- A Bizonylatok lista, a nav-számláló és a partner-adatlap kizárólag az `accounting_document`
-- táblát olvassa (élesen 0 sor), a rendszer-számlák pedig a régi `invoice` táblában ülnek.
-- A tulaj új fizetésről ráadásul semmilyen értesítést nem kapott (riasztás csak hibára volt).
--
-- ① TÜKÖR. Minden `invoice` sor (a sikeres, a sztornózott és — fizetésenként a legutolsó — sikertelen)
--    egy `source='system'` sort kap az `accounting_document`-ben. Az `invoice_id` a tükör
--    kulcsa: egy számlához legfeljebb EGY tükörsor tartozik (a backfill és az élő út így
--    idempotens). CASCADE: a tükör a számlából SZÁRMAZIK — ha a forrás-sort törlik (teszt-
--    vásárlás takarítása, őr-fixture), a tükre is megy; egy forrás nélküli „rendszer-számla”
--    olyan bizonylat lenne, ami sehol nem létezik.
ALTER TABLE accounting_document
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoice(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS accdoc_invoice_uniq
  ON accounting_document(invoice_id) WHERE invoice_id IS NOT NULL;

-- ② RIASZTÁS-ZÁR. Fizetésenként EGY sor: aki beszúrja, az küldi a riasztást. A Barion
--    callback ismétlődik, a /pay/done újrahajtja ugyanazt az utat — a második futás itt
--    akad meg (ON CONFLICT DO NOTHING), nem a tulaj telefonján.
--    kind: az order_intent.kind a fizetés pillanatában (initial / upsell / renewal / …).
--    sent_at: az azonnali riasztás kiment (NULL = megújítás, a napi összesítőre vár,
--             vagy a küldés elbukott — a napló hangosan jelzi).
--    digest_at: a megújítás bekerült a napi összesítőbe.
CREATE TABLE IF NOT EXISTS payment_alert (
  payment_id  uuid PRIMARY KEY REFERENCES payment(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  digest_at   timestamptz
);
CREATE INDEX IF NOT EXISTS payment_alert_digest_idx
  ON payment_alert(created_at) WHERE kind = 'renewal' AND digest_at IS NULL;
