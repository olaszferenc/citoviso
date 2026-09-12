-- Egy leaden EGY jóváhagyott mock — a meglévő duplikátumok gyógyítása.
--
-- ⛔ MÉRT (2026-09-11, Elek FK-003b ⑤): a jóváhagyás csak a saját sorát írta át, így
-- egy leaden két „approved" mock állt egyszerre. A lead-lap, a nyitókép-panel és a
-- megkeresés viszont EGYES számban gondolkodik („a jóváhagyott mock"), és `active[0]`-t
-- vesz — vagyis a képernyő egy tetszőlegesen kiválasztott mockot nevezett A jóváhagyottnak.
-- A kódbeli javítás (curateArtifact) csak a MOSTANTÓL születő jóváhagyásokra hat; a már
-- bent ülő párokat ez a migráció bontja fel.
--
-- Szabály: leadenként a LEGFRISSEBB jóváhagyott marad approved, a régebbiek visszakerülnek
-- `generated`-be. ⚠️ Kivéve, amit MÁR KIKÜLDTÜNK: amit megajánlottunk, az áll (§I).
--
-- ⚠️ A „kiküldtük" mércéje a `prospect.sent_at`, NEM a prospect-sor puszta létezése. Mérve
-- ugyanezen a napon: az ELEK-TESZT lead mindkét approved mockja alatt ült egy prospect-sor,
-- de EGYIK sem ment ki (sent_at IS NULL) — a link tokenjét soha senki nem kapta meg. Egy
-- meg nem írt levelet „megajánlott ajánlatnak" venni pont az az álbiztonság, amitől a
-- duplikátum bent maradt volna. Ugyanez a mérce él az `isArtifactDeletable`-ben is.
--
-- Nincs unique index: a §I-kivétel miatt két approved LEGÁLISAN is együtt élhet (egy
-- kiajánlott + egy új). Egy vak adatbázis-megszorítás ilyenkor a jóváhagyást utasítaná el.
-- Az invariánst ezért a kód tartja, és őr méri (scripts/one-approved-check.mts).

WITH ranked AS (
  SELECT
    m.id,
    row_number() OVER (PARTITION BY m.lead_id ORDER BY m.generated_at DESC, m.id DESC) AS rn
  FROM mock_artifact m
  WHERE m.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM prospect p WHERE p.mock_artifact_id = m.id AND p.sent_at IS NOT NULL
    )
)
UPDATE mock_artifact
SET status = 'generated'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
