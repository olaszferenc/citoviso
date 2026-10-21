-- 0112 SAJÁT DOMAIN: a tenant-admin Webcím fülének állapot-képernyője (tulaj „B” 2026-10-21)
-- minden kész lépés mellé időpontot ír. A fizetés (payment.paid_at), a vétel (waiting_since)
-- és az élesedés (finished_at) ideje már megvolt; ami hiányzott: mikor élesedett a
-- névszerver-delegáció — .hu névnél ez a Nyilvántartó jóváhagyása, ami akár napokig tart.
--
-- ns_active_at — a dns_pending → tls_pending átmenet pillanata (a zóna aktív lett).

ALTER TABLE domain_provisioning ADD COLUMN IF NOT EXISTS ns_active_at timestamptz;

-- A már túljutott sorok pontos ideje nem ismert: nem töltjük ki, a képernyő ott időpont
-- nélkül mutatja a lépést (nem találunk ki időt).
