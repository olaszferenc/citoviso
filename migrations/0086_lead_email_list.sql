-- 0086 TÖBB E-MAIL-CÍM EGY LEADNEK — a már tárolt többcímes `raw.email` szétbontása (ADR-0321).
--
-- ADATMODELL (séma-változás NINCS, a cím a lead.raw jsonb-ben él):
--   · raw.email        — az ELSŐDLEGES cím, jelentése változatlan (mock/honlap ezt mutatja,
--                        hideg levél csak ide mehet);
--   · raw.otherEmails  — a további címek (string-tömb), a kurátor sorrendjében; sosem címzett,
--                        és sosem ismétli az elsődlegest.
--
-- MIÉRT KELL ADATJAVÍTÁS (mérve 2026-10-04, csak olvasva): élesen 5, devben 4 lead `raw.email`-je
-- nem EGY cím volt, hanem egy sztring:
--   · OSM-ből két cím „;”-vel („info@csillagvendeghaz.eu;foglalas@csillagvendehaz.eu”,
--     „robitel@gmail.com;info@robitelvendeghaz.hu”) — az OSM így tárol több értéket, az
--     osm.ts nyersen átvette (javítva: osmEmails);
--   · egy JS-töredék („${t}@${e}`,y=()=”) — egyetlen érvényes cím sincs benne;
--   · vezető szóköz (Places), és devben egy HTML-entitás a végén („…hu&quot;”).
-- Ezek ma törött `mailto:`-t adtak a mockon, és a duplikátum/közös-kontakt kulcsuk egyik címmel
-- sem egyezett.
--
-- A SZABÁLY ugyanaz, mint a kódban (src/email/leadEmails.ts — splitEmailList + isValidEmail +
-- recipientKey): entitás vissza, bontás „;”, „,” és szóköz mentén, a széli írásjel/zárójel le,
-- csak a WHATWG-érvényes címek maradnak (a böngésző type=email szabálya), ugyanaz a postafiók
-- (kisbetű, +címke nélkül) egyszer, az ELSŐ az elsődleges. Ha nem marad érvényes cím, a
-- `raw.email` törlődik, és a kontakt-csatorna a telefonra áll vissza (a resolveChannel/isMobile
-- egyszeri SQL-tükre: mobil előhívó 20/30/31/50/70 → sms, más szám → voice, semmi → none).
--
-- NYOM: `raw.emailSplitRepair` = {before, at} — az eredeti sztring megmarad (ADR-0316 minta).
-- Ismételten futtatva nem csinál semmit: a javított sorban már nincs elválasztó.
WITH target AS (
  SELECT id, raw, raw->>'email' AS before
    FROM lead
   WHERE raw->>'email' ~ '[;,[:space:]]'
),
tokens AS (
  SELECT t.id, x.n,
         regexp_replace(trim(x.tok), '^[<("'']+|[>)"''.]+$', '', 'g') AS tok
    FROM target t,
         regexp_split_to_table(
           replace(replace(replace(t.before, '&quot;', '"'), '&amp;', '&'), 'mailto:', ' '),
           '[;,[:space:]]+'
         ) WITH ORDINALITY AS x(tok, n)
),
valid AS (
  SELECT id, n, tok,
         row_number() OVER (
           PARTITION BY id, regexp_replace(lower(tok), '\+[^@]*@', '@')
           ORDER BY n
         ) AS rn
    FROM tokens
   WHERE tok ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
),
lists AS (
  SELECT t.id, t.raw, t.before,
         coalesce((SELECT array_agg(v.tok ORDER BY v.n) FROM valid v WHERE v.id = t.id AND v.rn = 1), '{}') AS emails
    FROM target t
)
UPDATE lead l
   SET raw = (l.raw - 'email' - 'otherEmails')
             || CASE WHEN cardinality(s.emails) >= 1 THEN jsonb_build_object('email', s.emails[1]) ELSE '{}'::jsonb END
             || CASE WHEN cardinality(s.emails) >= 2 THEN jsonb_build_object('otherEmails', to_jsonb(s.emails[2:])) ELSE '{}'::jsonb END
             || CASE WHEN cardinality(s.emails) = 0 THEN jsonb_build_object('contactChannel',
                  CASE
                    WHEN coalesce(l.raw->>'phone', '') = '' THEN 'none'
                    WHEN substr(
                           CASE
                             WHEN regexp_replace(l.raw->>'phone', '\D', '', 'g') LIKE '0036%' THEN substr(regexp_replace(l.raw->>'phone', '\D', '', 'g'), 5)
                             WHEN regexp_replace(l.raw->>'phone', '\D', '', 'g') LIKE '36%' THEN substr(regexp_replace(l.raw->>'phone', '\D', '', 'g'), 3)
                             WHEN regexp_replace(l.raw->>'phone', '\D', '', 'g') LIKE '06%' THEN substr(regexp_replace(l.raw->>'phone', '\D', '', 'g'), 3)
                             WHEN regexp_replace(l.raw->>'phone', '\D', '', 'g') LIKE '6%'
                                  AND length(regexp_replace(l.raw->>'phone', '\D', '', 'g')) >= 9 THEN substr(regexp_replace(l.raw->>'phone', '\D', '', 'g'), 2)
                             ELSE regexp_replace(l.raw->>'phone', '\D', '', 'g')
                           END, 1, 2) IN ('20', '30', '31', '50', '70') THEN 'sms'
                    ELSE 'voice'
                  END) ELSE '{}'::jsonb END
             || jsonb_build_object('emailSplitRepair', jsonb_build_object('before', s.before, 'at', now()))
  FROM lists s
 WHERE l.id = s.id;
