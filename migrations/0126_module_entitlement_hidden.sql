-- 0126 MODULE VISIBILITY — the owner can hide a module from the guest page without cancelling it.
--
-- WHY. Owner ruling 2026-11-05 (approved plan design-refs/console/modul-lathatosag, "A"): „minden modulnál
-- lehessen: inaktiválni / aktiválni (azaz látható nem látható) NEM CSAK LEIRATKOZÁS!" Until now the only way a
-- module left the page was the cancellation, which also ends the subscription line at the period end.
--
-- hidden_at NOT NULL = the module is owned (and billed as before) but its section and menu link are cut from the
-- guest page. The billing truth (active, cancel_at_period_end, …) is untouched; a hidden module keeps its settings
-- and its admin screens. Read through src/tenant/modules.ts (isShownModule / siteShowsModule) only.

ALTER TABLE module_entitlement ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE module_entitlement ADD COLUMN IF NOT EXISTS hidden_by text;

-- A module that leaves (cancellation completes) or comes back (re-bought) starts SHOWN: the hide was a choice about
-- that ownership, and a re-bought module that silently stays off the page would read as a broken purchase. One rule
-- in the database, so none of the many activation paths (cart, webhook, renewal sweep, trial) can forget it.
CREATE OR REPLACE FUNCTION module_entitlement_reset_hidden() RETURNS trigger AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.hidden_at := NULL;
    NEW.hidden_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS module_entitlement_reset_hidden ON module_entitlement;
CREATE TRIGGER module_entitlement_reset_hidden BEFORE UPDATE ON module_entitlement
  FOR EACH ROW EXECUTE FUNCTION module_entitlement_reset_hidden();
