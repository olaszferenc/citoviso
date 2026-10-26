-- 0117 TENANT-AKTIVITÁS — mit csinál a tulaj a saját adminjában (ADR-XXXX, Próba riport).
--
-- A tulaj kérdése (2026-10-26): „hol bukik el vagy nem egy rendelés a próba alatt, hányszor
-- lépnek be". Ma a próbáról csak az eleje (free_trial.started_at) és a vége (converted_at /
-- lapsed_at) látszik; a belépésből csak a felülíródó tenant_user.last_login_at marad, mentés,
-- saját oldal megnyitása, Megrendelem-kattintás és a félbehagyott rendelés sehol nem rögzül.
-- Jóváhagyott terv: assets/design-refs/console/proba-riport/ (A+B hibrid).
--
-- MIÉRT EGY NAPLÓ minden tenantra (és nem free_trial-hez kötve): a jel a tenanté, a próba
-- csak egy időablak rajta. A riport a free_trial.tenant_id + a próba ablaka szerint olvassa;
-- a fizető tenant ugyanígy mérhető marad (a Riport „Tenantok" köre később ebből épül).
--
-- Ami NEM kerül ide, mert már máshol igaz: a rendelés elküldése (order_intent.submitted_at),
-- a fizetés (free_trial.converted_at / payment), a lejárat (free_trial.lapsed_at) és a
-- lejárat előtti levelek (free_trial_notice). Egy tény = egy hely.
--
-- ⚠️ A napló a BEKAPCSOLÁS NAPJÁTÓL él; visszamenőleges sort nem gyártunk (§B.17) — a riport
-- a korábbi próbáknál kimondja, hogy a próba belseje nem mért.
CREATE TABLE IF NOT EXISTS tenant_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  -- login       = sikeres belépés (jelszó vagy egyszeri link), detail.via
  -- admin_open  = az admin megnyitása (30 percenként legfeljebb egy; a megmaradt süti is számít)
  -- save        = sikeres mentés az adminban, detail.area = az admin füle (szovegek, fotok, …)
  -- site_view   = a tulaj az adminból megnyitotta a saját élő oldalát
  -- order_open  = a „Megrendelem" út megnyitása (/p/<token>/folytatas), detail.from = admin|level
  -- checkout    = a rendelő lépése a folytatásban, detail.step = billing|invalid|submitted|failed
  kind         text NOT NULL CHECK (kind IN ('login', 'admin_open', 'save', 'site_view', 'order_open', 'checkout')),
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_activity_tenant_at_idx
  ON tenant_activity(tenant_id, occurred_at);
