-- 0114 SAJÁT DOMAIN MEGÚJÍTÁSA (ADR-XXXX, tulaj 2026-10-25).
--
-- Mérve 2026-10-25 (Websupport GET /v1/user/3213041/service): az overseer.hu `autoExtend: false`,
-- lejár 2027-10-21 — semmi nem újította volna meg. A Websupportnál a megújítás egyetlen gépi útja
-- a szolgáltatás `autoExtend` kapcsolója (a lejárat előtt a kreditből fizet); ezt a napi szinkron
-- (scripts/domain-renewal-sync.mts) állítja a szabály szerint, és a valódi lejáratot onnan olvassa.
--
-- domain_registered_at → domain_expires_at: a mező MINDIG a regisztráció végét tartotta (helyben
--   számolva: vétel + 1 év); a név félrevezetett. Mostantól a regisztrátortól olvasott lejárat.
-- registrar_service_ref — a regisztrátor SZOLGÁLTATÁS-azonosítója (Websupport service id; a
--   registrar_ref a rendelés-id, azzal a kapcsoló nem állítható).
-- domain_auto_renew — a regisztrátornál MÉRT kapcsoló-állás (nem a kívánt).
-- domain_renew_end — leiratkozáskor rögzítve: ezen a lejáraton TÚL már nem újítunk. ≥90 nap a
--   lejáratig → = a lejárat (nincs több megújítás); <90 nap → a lejárat + 1 nap (még egyszer
--   megújul, utána a kapcsoló kikapcsol). NULL = fizető tenant, újítunk.
-- domain_renew_checked_at / domain_renew_problem — a szinkron utolsó futása és amit talált (a
--   stall watch ebből riaszt; NULL probléma = rendben).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'site' AND column_name = 'domain_registered_at') THEN
    ALTER TABLE site RENAME COLUMN domain_registered_at TO domain_expires_at;
  END IF;
END $$;
ALTER TABLE site ADD COLUMN IF NOT EXISTS domain_expires_at timestamptz;
ALTER TABLE site ADD COLUMN IF NOT EXISTS registrar_service_ref text;
ALTER TABLE site ADD COLUMN IF NOT EXISTS domain_auto_renew boolean;
ALTER TABLE site ADD COLUMN IF NOT EXISTS domain_renew_end timestamptz;
ALTER TABLE site ADD COLUMN IF NOT EXISTS domain_renew_checked_at timestamptz;
ALTER TABLE site ADD COLUMN IF NOT EXISTS domain_renew_problem text;
