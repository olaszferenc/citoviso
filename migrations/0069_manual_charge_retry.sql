-- Kézi terhelés-újrapróbálás (freeze-state-v2 ⑤ beváltása).
--
-- A jóváhagyott terv mockjában két gomb volt az elakadt kártyaterhelésnél:
-- „Újrapróbálom ezzel a kártyával" és „Másik kártyát adok meg". A második
-- megvalósult (a fizetési link), az ELSŐ nem — mert nem volt szerver-útvonal,
-- ami egy MIT-terhelést újra megkísérelne, és egy némán semmit nem csináló
-- gomb rosszabb a hiánynál. Ez az oszlop az, ami a hiányzó utat kapuzza.
--
-- ⛔ MIÉRT NEM SZÁMLÁLÓ. A próbálkozások SZÁMA nem tárolt, hanem LEVEZETETT: a
-- `payment` sorok, amiknek `pay_url IS NULL` (= MIT, fizető nélküli terhelés)
-- ezen az orderen. Egy külön `attempts` oszlop második igazságot engedne, amit
-- karban kellene tartani minden terhelés-úton (automata létra ÉS kézi gomb) —
-- és az elcsúszás csak a bankszámlán derülne ki. Amit tárolunk, az TÉNY: mikor
-- indított a tulaj utoljára kézi próbát.
--
-- Ez az oszlop EGYSZERRE két dolgot kapuz, és MINDKETTŐ a WHERE-ben ül, nem a
-- hívó jólneveltségén (ADR-0118 ② mintája):
--   · VÁRAKOZÁS — két kattintás között el kell telnie a türelmi időnek, tehát a
--     gomb nem püfölhető, és két párhuzamos kattintásból pontosan az egyik nyer
--     (a feltételes UPDATE atomi);
--   · SOROZAT-KORLÁT — a kártyatársasági szabályok korlátozzák egy elutasított
--     MIT-tranzakció újrapróbálását; a korlátot a claim-lekérdezés a levezetett
--     darabszámra nézve érvényesíti.
ALTER TABLE order_intent ADD COLUMN IF NOT EXISTS manual_charge_at timestamptz;

COMMENT ON COLUMN order_intent.manual_charge_at IS
  'Mikor inditott a tulaj utoljara KEZI terheles-ujraprobat erre az orderre. NULL = meg soha. Egyszerre varakozasi ido (ket kattintas kozott) es atomi birtokbavetel (ket parhuzamos kattintasbol egy nyer). A probalkozasok SZAMA nem itt all: az levezetett, a pay_url IS NULL payment sorokbol.';

-- A claim feltételes UPDATE-je a levezetett darabszámot is nézi, tehát minden
-- kattintás megszámolja az order MIT-fizetéseit.
CREATE INDEX IF NOT EXISTS payment_mit_by_order_idx ON payment (order_intent_id)
  WHERE pay_url IS NULL;
