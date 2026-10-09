-- 0097 INGYENES PRÓBA — kártya nélküli próba-állapot (ADR-0342).
--
-- MIÉRT KÜLÖN TÁBLA, ÉS MIÉRT NEM `subscription.status='trial'`. A `subscription` sor a
-- fizetés szülötte: az `anchor_date` NOT NULL, és ADR-0080 ① szerint az ELSŐ fizetés napja.
-- Próba alatt nincs fizetés, tehát nincs fordulónap sem — egy kitalált anchor hamis
-- fordulót adna, egy `trial` státusz pedig a napi billing-tick minden ágába (mint, dunning,
-- freeze, cancel) új kivételt kényszerítene. Így a próbázó tenantnak NINCS subscription
-- sora, és a tick (amely csak subscription sorokon iterál) szerkezetileg nem mintázhat rá
-- számlát és nem indíthat dunninget. Az első valódi fizetés a meglévő úton
-- (`ensureSubscriptionForOrder`) születteti meg az előfizetést, a fizetés napjával.
CREATE TABLE IF NOT EXISTS free_trial (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One trial per lead, ever: the unique index IS the double-click / repeat guard.
  lead_id                  uuid NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
  prospect_id              uuid REFERENCES prospect(id) ON DELETE SET NULL,
  -- NULL only while the provisioning of a just-claimed trial is in flight (or failed:
  -- a re-submit of the same lead resumes it).
  tenant_id                uuid UNIQUE REFERENCES tenant(id) ON DELETE CASCADE,
  contact_name             text NOT NULL,
  contact_email            text NOT NULL,
  contact_phone            text,
  -- ÁSZF + §A photo-rights: the EXACT accepted wording is stamped (0015/0029 doctrine).
  terms_accepted_at        timestamptz NOT NULL,
  terms_text               text NOT NULL,
  photo_rights_declared_at timestamptz NOT NULL,
  photo_rights_text        text NOT NULL,
  started_at               timestamptz NOT NULL DEFAULT now(),
  trial_until              timestamptz NOT NULL,
  -- The continuation coupon minted at start (offer kind='coupon', scope='purchase').
  coupon_offer_id          uuid REFERENCES offer(id) ON DELETE SET NULL,
  -- active    = running (or past trial_until, not yet frozen by the expiry job)
  -- converted = the first real payment arrived (subscription born)
  -- lapsed    = the expiry job froze it (C SUB)
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'converted', 'lapsed')),
  converted_at             timestamptz,
  lapsed_at                timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (started_at < trial_until)
);
CREATE INDEX IF NOT EXISTS free_trial_until_idx ON free_trial(trial_until) WHERE status = 'active';

-- Trial-origin entitlements: granted by the trial, not bought. The paid reconciliation
-- (syncEntitlementsToPaid) clears the flag on what the buyer paid for and switches the
-- rest off — "a vevő által VÁLASZTOTT csomag marad".
ALTER TABLE module_entitlement
  ADD COLUMN IF NOT EXISTS trial_grant boolean NOT NULL DEFAULT false;

COMMENT ON TABLE free_trial IS
  'ADR-0342: kártya nélküli ingyenes próba — leadenként egy; a próbázó tenantnak nincs subscription sora, így a billing-tick nem lát rá.';
COMMENT ON COLUMN module_entitlement.trial_grant IS
  'ADR-0342: a próba adta, nem fizetett jogosultság; a fizetett egyeztetés a megvett modulokról leveszi, a többit kikapcsolja.';
