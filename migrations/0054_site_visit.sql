-- ADR-0108: first-party forgalom-mérés az ÉLŐ tenant-oldalon.
--
-- MIÉRT SAJÁT, ÉS NEM GOOGLE ANALYTICS: mi vagyunk a házigazda — minden kérés a
-- `serveTenantHost`-on megy át, tehát a mérés külső szolgáltató, jóváhagyás és
-- kliens-oldali script NÉLKÜL is teljes. Ráadásul a reklámblokkolók a szerver-oldali
-- mérésből semmit nem tudnak kivenni, és a slug-hoszt meg a saját domain ugyanazon a
-- kódúton jön be, tehát külön kezelés nélkül mindkettő látszik.
--
-- ADATVÉDELEM (a tábla alakja HORDOZZA a döntést, nem csak a szándék):
--   * NINCS süti és nincs kliens-oldali azonosító.
--   * NYERS IP-t NEM tárolunk. A `visitor_hash` egy NAPONTA FORGÓ sóval képzett
--     rövid lenyomat: elég ahhoz, hogy egy napon belül ne számoljunk ugyanannak a
--     böngészőnek 12 megtekintést, de a só fordulása után visszafejthetetlen és
--     napokon átívelő profil nem építhető belőle.
--   * A `referrer` CSAK a küldő hosztneve (pl. "google.com"), nem a teljes URL —
--     a teljes URL keresőkifejezést és személyes tartalmat is hordozhat.
--
-- ⛔ BOT-SZŰRÉS A MÉRÉS RÉSZE, NEM UTÓLAGOS SZÉPÍTÉS: a vevőnek megmutatott szám
-- csak akkor lehet igaz állítás (§B.17), ha nincs benne a Googlebot és a többi
-- crawler. Ezért a `is_bot` oszlop a soron ül, és a kimutatás rá szűr — a nyers
-- sort viszont megtartjuk, hogy a szűrő MÉRHETŐ és javítható legyen.

CREATE TABLE site_visit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  site_id      uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  -- Melyik címen érkezett: a slug-hoszt vagy a saját domain (ADR-0020/0071).
  -- A tenant számára ez ÖNMAGÁBAN érték: látja, megérte-e a saját domain.
  host         text NOT NULL,
  -- 'slug' | 'custom' — a hosztból származtatva, hogy a kimutatás ne string-ezzen.
  host_kind    text NOT NULL,
  -- A küldő hosztneve ("google.com", "facebook.com"), vagy NULL = közvetlen.
  referrer     text,
  -- 'mobile' | 'desktop' — a User-Agentből, durva bontásban.
  device       text NOT NULL,
  -- Napi sóval képzett látogató-lenyomat (lásd fent). Sosem IP.
  visitor_hash text NOT NULL,
  is_bot       boolean NOT NULL DEFAULT false
);

-- A kimutatás mindig egy tenant + időszak: ez az index viszi.
CREATE INDEX site_visit_tenant_time_idx ON site_visit (tenant_id, occurred_at DESC);
-- Az "egyedi látogató / nap" számoláshoz.
CREATE INDEX site_visit_visitor_idx ON site_visit (tenant_id, visitor_hash, occurred_at);
