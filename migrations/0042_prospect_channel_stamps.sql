-- 0042 CSATORNÁNKÉNTI KÜLDÉS-BÉLYEG a prospecten (ADR-0082, tulajdonosi döntés 2026-08-29).
--
-- A hiba, ami kikényszerítette: az SMS-gomb a közös `sent_at`-ot bélyegezte, az
-- e-mail-küldés kapuja pedig ugyanarra a `sent_at`-ra néz — így egy SMS (ami
-- akkor még KI SEM MENT, csak jelölt) VÉGLEG elzárta az e-mail-csatornát:
-- „ennek a prospectnek már kiküldtük a levelet (nincs újraküldés)".
--
-- Modell: a két csatorna külön egyszeri-küldés. A `sent_at` marad az ELSŐ
-- ÉRINTÉS bélyege (a H1-funnel bázisa, a riportok érintetlenek), a csatorna-kapu
-- viszont a saját oszlopából dolgozik.
ALTER TABLE prospect
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_sent_at   timestamptz;

-- Backfill KONZERVATÍVAN: minden eddigi `sent_at` e-mail-küldésből (pipeline vagy
-- A2 kézi „Kiküldve") származik — az SMS-gomb ezt megelőzően placeholder volt és
-- élesben nem használtuk. Így egyetlen valós leadnek sem mehet ki „újra" a levél.
UPDATE prospect
   SET email_sent_at = sent_at
 WHERE sent_at IS NOT NULL
   AND email_sent_at IS NULL;

COMMENT ON COLUMN prospect.sent_at IS
  'ELSŐ ÉRINTÉS (bármely csatorna) — a H1-funnel bázisa. A csatorna-kapuk NEM ezt nézik.';
COMMENT ON COLUMN prospect.email_sent_at IS
  'ADR-0082: az e-mail csatorna egyszeri-küldés bélyege — ez zárja az újraküldést.';
COMMENT ON COLUMN prospect.sms_sent_at IS
  'ADR-0082: az SMS csatorna egyszeri-küldés bélyege — ez zárja az újraküldést.';
