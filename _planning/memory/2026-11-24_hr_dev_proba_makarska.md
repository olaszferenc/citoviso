# 2026-11-24 — HR dev-próba: lead-beszerzés Makarskán + Elek négy szerepben

**Session:** `citfe6a479b` (SUB), koordinátor `cit9b4690e3`, brief `~/rc-briefs/hr-dev-lead-proba-20261123.md`.
**ADR:** ADR-0475 „HR dev-próba: település-index + a felderítés hamis saját-honlap ítéletei”. **Élesen:** semmi.

## Tölcsér (közös dev DB, régió `hr-makarska-proba`, 2,5 km-es kör, a leadek `raw.devProba='hr-makarska-20261123'`)
74 OSM-hely → 70 mentve → 47 lead (41 honlap nélküli, 6 elavult) → 34 kontaktos (Maps-panel, $0) → 7 e-mailes
(27 csak telefonos, ez HR-ben TARTVA) → 7 db ≥5 képes → **1 levélre kész (Hotel Palma Makarska)**. A második mock
(Apartmani Tonkita: 46 portálfotó a település-indexből) csak mobilos, ezért TARTVA.
Költség: felderítés + kontakt + kép $0; mock-szöveg 2 × előfizetéses `claude -p` ($0,204 + $0,124 API-egyenérték);
mock-generálás 2 ai_spend sor, $0,0464 (API).

## Javítva (commitok)
- f078e98f/56fe50a5 felderítés: dátum a régió-címkében, partnerlinkes átirányítás, kódolt mailto
- ab31a3d1/a10b20c2 település-index (apartmanija.hr) + HR tradeWords (central/city/…)
- 0439ca9b §C KERETEZÉS: a tulaj-levél idegen nyelvű horga; outreach-from-price-check csak HU prospecten
- 9b96f039 kontakt-csatorna az ország-sorból + újraszámolás konzolos mentéskor
- e9cd2ffa mock/booking: galéria-alt, térkép-cím, alap-egység neve horvátul; a rerender betölti a nyelvi csomagot
- 54bdcc1d /login a böngésző nyelvén; hr-world teszt-feladónév (a country-hr-fix-e2e a mainen 4 piros volt)

## Elek (leletek: `elek/runs/hr-dev-proba/<perszóna>/LELETEK.md`, gitignore-olt)
- **Kezdő:** a 2 blokkoló javítva és ismételve (horvát belépő, „Slika N.”). Zavaró: a levél −25%-át a mock nem
  mutatja (a próbában a levél sampleTo-val ment, ajánlat-sor nélkül), sok ráúszó sáv mobilon, a telefonszám-tagolás
  („+385 912 345 678”), két lejárati dátum.
- **IT:** egységnév javítva és ismételve. Maradt: a vendégoldal jogi linkjei a teszt `/t/` úton a platform magyar
  lapjára visznek (élesen ellenőrizendő); ÁFA-szöveg vs. AAM-számla (jog, tulaj).
- **Levélolvasó:** blokkoló nincs. Zavaró: „Poštovani/a <cégnév>”, „do 10. pro 13:00” (budapesti óra, rövid
  hónap), „UVODNA PONUDA” felirat az eszkalációban.
- **Vevő:** a `.com` domain +3 €/hó (dev-adat: a dev `package_module` üres, élesen a domain az Alapban); magyar jog
  az impresszumban és az adatvédelemben (ismert, jogi csomag); `src/moduleConfig.ts:96,329,333,424` magyar súgó és
  alapérték; magyar súgópéldák; konfigurátor-előnézet CTA (`src/generator/configurator.ts`); „Szállás.hu” és
  „horvát” a Moduli fülön.

## Nyitott kérdések / a koordinátornak
- A kolléga-lánc (repón kívül): a Bing HR-re használhatatlan; a housity-átirányítást saját honlapnak vette és
  aggregátor-e-mailt adott; a megtalált saját honlapot nem írja a `website` mezőbe (Maritimo); az átnéző prod-kötött.
- A dev `.env`-ből hiányzik az `OUTREACH_FOLLOWUP_SENDER_NAME`, ezért dev-en nem épül hideg levél.
- A dev konzol (:4600) `EMAIL_PROVIDER=smtp`: a próba-leadek lapján a kézi küldés valódi levelet küldene.
