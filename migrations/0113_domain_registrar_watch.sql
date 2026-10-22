-- 0113 SAJÁT DOMAIN — a regisztrátor-szál végigkövetése (ADR-0400, overseer.hu 2026-10-21/22).
--
-- Ami hiányzott (mérve): a vétel után a kód ELENGEDTE a szálat — a regisztrátor support-levele
-- („hiányzó adat — overseer.hu”, 2026-10-22 08:04) a postafiókban állt, senki nem riasztott,
-- a tenant a 24 órás képernyő-ígéretet nézte; a vételről a tenant semmilyen levelet nem kapott.
--
-- registrar_note / registrar_note_at — a regisztrátor EMBERI levele (support) erről a névről:
--   a postafiók-figyelő írja, a ház riasztást kap, a tenant állapot-képernyője „munkatársunk
--   intézi”-re vált. Üres = a regisztrátor nem kért semmit.
-- bought_notice_at — a tenant „Megvásároltuk a webcímét” levele kiment (egyszer; a setup_retry
--   újrabelépés a registered lépésbe nem küldi újra).

ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS registrar_note text;
ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS registrar_note_at timestamptz;
ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS bought_notice_at timestamptz;

-- A már futó sorok (overseer.hu) nem kapnak visszamenőleg levelet: a vétel-levél a jövőbeli
-- vételek pillanatához kötött; a múltbeli vételről a tulaj már tud.
UPDATE domain_provisioning SET bought_notice_at = waiting_since
 WHERE bought_notice_at IS NULL AND waiting_since IS NOT NULL;
