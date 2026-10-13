-- 0109 CSENDES ÓRA A RIASZTÓ SMS-EN (ADR-0376, tulaj 2026-10-13: „Éjjel nagyon jönnek az SMS-ek.”)
--
-- 22:00–07:00 (Europe/Budapest) között a súlyos ház-riasztás (ADR-0374) csak levélben megy;
-- az SMS-döntés 'night' sorként rögződik. 07:00 után az óránkénti tick EGY összesítő SMS-t
-- küld az éjjel visszatartottakról, és a sorokat 'night_digested'-re állítja (így egy éjszaka
-- egyszer összegződik, a bukott összesítő pedig a következő órában újrapróbál).

ALTER TABLE house_alert_sms DROP CONSTRAINT IF EXISTS house_alert_sms_status_check;
ALTER TABLE house_alert_sms ADD CONSTRAINT house_alert_sms_status_check
  CHECK (status IN ('sent', 'suppressed', 'failed', 'night', 'night_digested'));
