-- 0035 PARTNER-AZONOSSÁG: az adószám a kulcs, és egy bankszámla-forrás.
--
-- A partner-törzs átvétele a másik száltól (tulaj-döntés, 2026-08-23). A 0032 szerkezete jó —
-- minden szükséges mező megvan —, két konkrét rés maradt benne.

-- ① AZ AZONOSSÁG NEM VOLT KIKÉNYSZERÍTVE.
-- A `partner_tax_idx` sima (nem UNIQUE) index volt, tehát ÉLŐ PRÓBÁVAL igazolva ugyanaz az
-- adószám kétszer felvehető volt: "Teszt Kft" és "Teszt Kft MÁSODSZOR" ugyanazzal az
-- adószámmal, minden akadály nélkül.
--
-- Miért nem elméleti a kockázat: a LEAD-oldalon ugyanez a hiba élesben 20 duplikátum-csoportot
-- termelt (0022 lead_link + a konzol duplikátum-nézete pont ezért készült). Egy partner-törzsben
-- ez rosszabb: a bizonylatok KÉT rekord között oszlanának meg, tehát "mennyivel tartozunk a
-- Hetznernek" kérdésre a rendszer csendben rossz választ adna, és a bejövő számla hol az egyik,
-- hol a másik partnerre könyvelődne.
--
-- Az adószám az AZONOSSÁG természetes kulcsa: egy adószámot egy adóhatóság egy entitásnak ad.
-- NULL megengedett (külföldi magánszemély, még nem ismert adószám) — a részleges index csak a
-- kitöltött értékeket köti.
DROP INDEX IF EXISTS partner_tax_idx;
CREATE UNIQUE INDEX partner_tax_uniq ON partner(tax_number) WHERE tax_number IS NOT NULL;
CREATE UNIQUE INDEX partner_euvat_uniq ON partner(eu_vat_number) WHERE eu_vat_number IS NOT NULL;
-- A keresés/lista miatt a nem-egyedi név-index marad (partner_name_idx a 0032-ből).

-- ② KÉT HELYEN ÁLLT UGYANAZ AZ ADAT.
-- A 0032 egy szöveges `partner.bank_account` mezőt adott, a 0034 pedig egy `partner_bank_account`
-- táblát (egy partnernek több számlája lehet, pontosan egy alapértelmezettel). Két forrás
-- ugyanarra az adatra: előbb-utóbb eltérnek, és a rossz számlaszámra utalt pénzt visszaszerezni
-- drága és lassú — pont az a kockázat, ami miatt a több-számlás tábla készült.
--
-- A tábla a bővebb és a helyes alak, ezért a szöveges mező megy. Adatvesztés nincs: mindhárom
-- partner-tábla ÜRES (0 sor, ellenőrizve), és a `partner.bank_account`-ot a kódból semmi nem
-- olvasta (csak a Kysely-típus deklarálta).
ALTER TABLE partner DROP COLUMN bank_account;
