-- 0067 A gyűjtési terület NEVE ne állítson olyat, amit a saját doboza cáfol.
--
-- MÉRVE (2026-09-14, Elek FK-003 H2 nyomán): a `balaton-north` terület címkéje
-- „Balaton északi part" volt, a keresési doboza viszont [46.75, 17.25 – 46.95, 18.05]
-- (kör: 46.85/17.65, r = 30,45 km) — az EGÉSZ tó, plusz a háttérvidék. A címke ezért
-- 595 leadből 529-re állt rá, köztük 47 siófoki, 71 balatonlellei, 35 zamárdi (DÉLI
-- part) és 9 tapolcai (nem parti) szereplőre. Két helyen ártott:
--   ① az operátor lead-listájában a saját Város oszlopával mondott ellent;
--   ② a címke a generátor régió-kontextusa is (generate.ts → resolveRegion), tehát
--      KIMENT a vevőnek: a balatonföldvári lead mockjának meta-leírásában, og-jában,
--      JSON-LD-jében és a hero alcímében „a Balaton északi partjának ölelésében" áll.
-- A javítás a NÉVNÉL van, nem a felületnél: a doboz a Balatont fedi, tehát „Balaton".
-- A dobozt NEM mozgatjuk — az a gyűjtés hatóköre, az külön (operátori) döntés.
--
-- Csak a beégetett seed-értéket írjuk át (0018_region.sql): ha az operátor azóta saját
-- nevet adott a területnek, azt tiszteletben hagyjuk.
UPDATE region
   SET label = 'Balaton', updated_at = now()
 WHERE id = 'balaton-north'
   AND label = 'Balaton északi part';

-- Ugyanaz az állítás a gyűjtő-definíció nevében is ott ült (a konzol gyűjtés-listája
-- ezt a mezőt mutatja) — egy szabály két példányban két igazság egy képernyőn.
UPDATE scraper_definition
   SET label = 'Balaton', updated_at = now()
 WHERE region = 'balaton-north'
   AND label = 'Balaton északi part';
