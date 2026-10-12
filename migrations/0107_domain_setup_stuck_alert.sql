-- 0107 SAJÁT DOMAIN: a megvett, de dns_pending / tls_pending állapotban RAGADT beállítás nem
-- maradhat ott némán (ADR-0372, Elek „it” kör 2026-10-12, ÚJ-K1).
--
-- Mérve: a megvett és kifizetett név, amelynek NS-delegációja vagy tanúsítványa nem élesedik,
-- minden resume-futáson `dns_pending`-ben maradt (+1, +7, +30 nap): 0 riasztás, 0 levél. A
-- setup_retry (ADR-0362) csak KIVÉTELRE indul, a „még nem aktív” válasz nem kivétel.
--
-- ① waiting_since — mióta vár a beállítás a delegációra / tanúsítványra (a dns_pending
--    belépésekor íródik, a tls_pending alatt is fut tovább; egy setup_retry nem nullázza).
-- ② stuck_stage — hányadik lépcső ment már ki: 0 semmi, 1 = 24 órás operátor-riasztás,
--    2 = 72 órás ismételt riasztás + tulaj-levél. Feltételes UPDATE-tel lép, így két
--    párhuzamos futás sem küld kétszer.
-- ③ delay_notice_at — a tulaj megkapta-e már a „beállítás tovább tart” levelet (a setup_retry
--    is ezt küldi) — EGY ilyen levél megy beszerzésenként, nem naponta.

ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS waiting_since timestamptz;
ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS stuck_stage smallint NOT NULL DEFAULT 0;
ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS delay_notice_at timestamptz;

-- A ma már várakozó sorok órája a migrációtól indul: a régi kor nem ismert, és egy
-- deploy utáni azonnali riasztás-zápor senkinek nem segítene.
UPDATE domain_provisioning SET waiting_since = now()
 WHERE waiting_since IS NULL AND status IN ('dns_pending', 'tls_pending');
-- A setup_retry-ban már értesített sorok: a levél kiment (ADR-0362 belépéskor küldi).
UPDATE domain_provisioning SET delay_notice_at = created_at
 WHERE delay_notice_at IS NULL AND status = 'setup_retry';
