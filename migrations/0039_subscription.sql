-- 0039 SUBSCRIPTION — előfizetés-motor: tenant-fordulónap + dunning + lemondás (ADR-0080).
--
-- A modell: tenantonként EGY előfizetés, EGY fordulónappal (anchor = az első fizetés
-- napja). Minden havidíjas modul ebbe a közös ciklusba olvad → havonta EGY terhelés,
-- EGY számla, tételekkel. A megújulás a MEGLÉVŐ gerincen fut: új order_intent
-- kind='renewal' ciklusonként (a 0033/0036/0038 doktrína — a payment+invoice lánc
-- változatlanul újrahasznosul).
--
--   • Modul-felvétel ciklus közben (ADR-0080 ②, B-opció): azonnal aktív, első díja a
--     KÖVETKEZŐ közös számlán. Az `awaiting_first_charge` jelöli a „jogosan aktív, de
--     még nem fizetett" állapotot — e nélkül a paidEntitlements-egyeztetés (amely a
--     Villa-Suzy-osztályú szivárgás ellen őrködik) visszavonná a frissen felvett modult.
--   • Lemondás (ADR-0080 ③): a fordulónapon érvényesül — `cancel_at_period_end`, addig
--     aktív és visszakapcsolható; részleges visszatérítés nincs.
--   • Dunning (ADR-0080 ⑤): append-only eseménynapló ciklusonként — a napi timer ebből
--     tudja idempotensen, melyik lépcső ment már ki (T−3 / T / T+3 / T+7 / T+10 / T+30).

-- 1) Előfizetés — 1:1 a tenanttal.
CREATE TABLE IF NOT EXISTS subscription (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  -- Cadence inherited from the initial order (annual prepay = 2 months free, 0005).
  billing_period       text NOT NULL DEFAULT 'monthly'
                         CHECK (billing_period IN ('monthly', 'annual')),
  -- The tenant's renewal day derives from this: the date of the FIRST paid payment.
  anchor_date          date NOT NULL,
  -- The prepaid period the tenant is currently inside. `current_period_end` IS the
  -- next renewal due date (T in the dunning ladder).
  current_period_start date NOT NULL,
  current_period_end   date NOT NULL,
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'past_due', 'frozen', 'cancelled')),
  -- 'invoice' = díjbekérő + fizetőlink (pilot default); 'token' = Barion auto-charge
  -- (slice ⑤ — flips when a RecurrenceId is stored).
  payment_method       text NOT NULL DEFAULT 'invoice'
                         CHECK (payment_method IN ('invoice', 'token')),
  -- Barion RecurrenceId from the InitiateRecurrence checkout; NULL until slice ⑤.
  recurrence_token     text,
  -- Whole-subscription cancellation: takes effect at current_period_end (ADR-0080 ③).
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at         timestamptz,
  frozen_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_start <= current_period_end)
);

-- 2) Modul-szintű lemondás + a B-opció „első díjra váró" állapota.
ALTER TABLE module_entitlement
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN cancelled_at         timestamptz,
  -- TRUE while a mid-cycle addition awaits its first renewal invoice (ADR-0080 ②).
  -- Cleared by the renewal payment that first bills the module. The entitlement
  -- reconciliation treats this as LEGITIMATE-though-unpaid; anything else active
  -- and unpaid is still a leak.
  ADD COLUMN awaiting_first_charge boolean NOT NULL DEFAULT false;

-- 3) Új order kind: 'renewal' = egy előfizetési ciklus közös számlája.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_kind_check;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_kind_check
  CHECK (kind IN ('initial', 'upsell', 'multilang', 'domain_upgrade', 'renewal'));

-- A renewal order — mint az upsell/multilang/domain_upgrade — élő tenanthoz tartozik.
ALTER TABLE order_intent DROP CONSTRAINT order_intent_upsell_tenant_chk;
ALTER TABLE order_intent ADD CONSTRAINT order_intent_upsell_tenant_chk
  CHECK (
    (kind IN ('upsell', 'multilang', 'domain_upgrade', 'renewal') AND tenant_id IS NOT NULL)
    OR (kind = 'initial' AND tenant_id IS NULL)
  );

-- 3b) A renewal order kimondja, MELYIK időszakot fedi — a számla tétel-szövege és a
--     ciklus↔order azonosítás igazsága (enélkül a napi timer csak dátum-heurisztikával
--     találná meg a folyó ciklus orderét).
ALTER TABLE order_intent
  ADD COLUMN renewal_period_start date,
  ADD COLUMN renewal_period_end   date;

-- 4) Dunning-eseménynapló — append-only, ciklusonként (= renewal orderenként).
--    MIÉRT append-only: „mikor, melyik csatornán szóltunk, mielőtt fagyasztottunk"
--    vitakérdés (fogyasztóvédelem); a subscription jelen-állapota nem válaszolja meg.
CREATE TABLE IF NOT EXISTS dunning_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  -- The renewal order (cycle) this step belongs to.
  order_intent_id uuid NOT NULL REFERENCES order_intent(id) ON DELETE CASCADE,
  step            text NOT NULL CHECK (step IN (
                    'pre_notice',    -- T−3 előértesítő
                    'charge',        -- T terhelés / díjbekérő kiküldve
                    'reminder',      -- T+3 emlékeztető + retry
                    'final_warning', -- T+7 utolsó figyelmeztetés (e-mail + SMS)
                    'freeze',        -- T+10 felfüggesztés
                    'cancel'         -- T+30 felmondottnak tekintve
                  )),
  channel         text NOT NULL CHECK (channel IN ('email', 'sms', 'system')),
  sent_at         timestamptz NOT NULL DEFAULT now()
);
-- Idempotence: one step per channel per cycle — the daily timer re-runs safely.
CREATE UNIQUE INDEX IF NOT EXISTS dunning_event_step_idx
  ON dunning_event(order_intent_id, step, channel);
CREATE INDEX IF NOT EXISTS dunning_event_subscription_idx
  ON dunning_event(subscription_id);

-- 5) Backfill: minden tenant, akinek van fizetett rendelése, előfizetést kap.
--    anchor = az ELSŐ fizetett payment napja (mindkét ág: tenant-hez kötött orderek +
--    az initial checkout a prospect→lead hídon át — a paidEntitlements két lába).
--    A folyó periódus: az anchortól egész hónapokkal előregörgetve úgy, hogy a vége
--    a jövőben legyen (a köztes, ki nem számlázott hónapokat NEM követeljük utólag —
--    a motor bevezetése nem termel visszamenőleges tartozást).
DO $$
DECLARE
  t record;
  first_paid timestamptz;
  period_months int;
  p_start date;
  p_end date;
BEGIN
  FOR t IN SELECT te.id, te.lead_id FROM tenant te LOOP
    SELECT min(p.paid_at) INTO first_paid
    FROM payment p
    JOIN order_intent oi ON oi.id = p.order_intent_id
    LEFT JOIN prospect pr ON pr.id = oi.prospect_id
    WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
      AND (oi.tenant_id = t.id OR pr.lead_id = t.lead_id);

    IF first_paid IS NULL THEN CONTINUE; END IF;

    SELECT CASE WHEN p.period = 'annual' THEN 12 ELSE 1 END INTO period_months
    FROM payment p
    JOIN order_intent oi ON oi.id = p.order_intent_id
    LEFT JOIN prospect pr ON pr.id = oi.prospect_id
    WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
      AND (oi.tenant_id = t.id OR pr.lead_id = t.lead_id)
    ORDER BY p.paid_at ASC LIMIT 1;

    p_start := first_paid::date;
    p_end   := p_start + (period_months || ' months')::interval;
    WHILE p_end <= current_date LOOP
      p_start := p_end;
      p_end   := p_start + (period_months || ' months')::interval;
    END LOOP;

    INSERT INTO subscription
      (tenant_id, billing_period, anchor_date, current_period_start, current_period_end)
    VALUES
      (t.id,
       CASE WHEN period_months = 12 THEN 'annual' ELSE 'monthly' END,
       first_paid::date, p_start, p_end)
    ON CONFLICT (tenant_id) DO NOTHING;
  END LOOP;
END $$;

COMMENT ON TABLE subscription IS
  'ADR-0080: tenantonként EGY előfizetés, EGY fordulónappal — a megújulás kind=renewal order_intent-ként fut a meglévő payment/invoice láncon.';
COMMENT ON COLUMN module_entitlement.awaiting_first_charge IS
  'ADR-0080 ②: ciklus közben felvett modul — jogosan aktív, első díja a következő közös számlán; a paid-egyeztetés ezt nem vonja vissza.';
COMMENT ON TABLE dunning_event IS
  'ADR-0080 ⑤: append-only dunning-napló ciklusonként — az idempotens napi timer igazsága arról, melyik lépcső ment már ki.';
