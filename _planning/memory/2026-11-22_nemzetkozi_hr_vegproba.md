# 2026-11-22 — Nemzetközi: HR végpróba (felderítéstől a számláig) + Elek négy szerepben

**Session:** SUB cit41e31dd4 (koordinátor cit9b4690e3). **ADR:** ADR-XXXX (`_planning/decisions/XXXX-nemzetkozi-hr-vegproba.md`).
Élesen semmi nem változott; prod DB-be írás nem volt; a HR piac csak scratch DB-ben nyílt.

## A lánc (1–7)
1. Felderítés — ZÖLD: Makarska riviéra friss Overpass (`uj-lanc-next/felderito/felderito.py --country HR`), 185 hely, 200 mp, $0.
2. Honlap/kontakt/telefon/kép — RÉSZBEN: 12 valódi lead scratch DB-be (`run.ts --scout`), +385 E.164, e-mail 7-nél;
   PIROS: honlap nélküli HR lead $0 mellett képet nem kap (Places ki, a portál-adapterek magyarok, booking.com-ot nem olvasunk).
3. Mock horvátul — ZÖLD egy lelettel: Hotel Palma, generátor, $0,3867 (12 hívás, 78k be / 6,7k ki), `lang="hr"`, nincs Ft/‹hr›;
   vendég-kritikus horvát szövegen fut (1 kifogás kurátor-sorba). Lelet: a minta-szobakártya leírása magyar → patch a felület-kapunál.
4. Hideg levél — ZÖLD: horvát, EUR, zágrábi ablak + ünnep (karácsony/vasárnap/06:30 tartva), jogi sor, leiratkozás horvátul.
   Bábel: 1 mondat (`portalSentence.ts:14` „A vendégei ezután közvetlenül Önnél foglalnak…”) — élesen a levél TARTVA.
5. Válaszok — ZÖLD: „Zanima me” és „Ne, hvala” hr nyelvjellel, Poe-jegy hr/Europe/Zagreb; elutasító után 5 küldő kizárva.
6. Próba → vásárlás → számla — ZÖLD mock-átjáróval, PIROS Barion-sandboxon: a teszt-bolt sem fogad EUR-t (NotExistingCurrency).
   Éles beállítással a piac zárva, ok a hiányzó EUR-tárca. Három vevőtípus rendben (VIES a kerítés mögött „unavailable”, nem blokkol).
   Számla: a levél horvát, maga a számla a mock-számlázónál nem nyitható → nyelve „vár”.
7. Domain + tenant — ZÖLD: „Apartmani Đurđa” → durda.com; tenant-admin horvát (OIB, kategória, szobák, foglalás, vendég-levél).

## Javítva (commitok a wt/cit41e31dd4 ágon)
- videó-bélyegkép szűrő (`photoQuality.ts` URL_DENY), HR „vila” keresőszó (`0151`), nyelv nélküli mock → a lead országa (`i18n/mail.ts`),
  trunk nélküli országok telefonterve (`phoneCountry.ts`), `country-crm-e2e` (BG-ütközés + nyelv), `foreign-market-e2e-ingest` telefon.
- §C ország-kapu valódi ok (`outreachCheck.ts`, `draft.ts`), nem-nyitó levél keretezés-jel (`outreachCheck.ts`).
- Elek IT: Jogi adatok előtöltése a lead-rendelésből (`tenant/legalIdentity.ts`); vevő-oldali 404 / ismeretlen fizetés / mock adatvédelmi
  link a látogató nyelvén (`console/server.ts` visitorLang, buyerNotFound).
- Új: `scripts/hr-vegproba-e2e.mts` (33/33; `--barion-test` ág), `scripts/lib/hr-world.mts` barion-test mód.

## Leletek (teljes: `~/rc-briefs/elek-hr-vegproba-20261122/<perszóna>/LELETEK.md`)
- Kezdő: blokkoló = minta-szobakártya magyar szöveg (patch vár); zavaró: takart „×”, vissza-gomb kilép, félbehagyott rendelés nem marad meg,
  Barion süti-sáv + ragadós sáv takar, ellentmondó lemondási feltételek, két aldomain-alak.
- IT: dupla terhelés NINCS, piac-kapu nem kerülhető meg; blokkolók javítva (kivéve jogi szöveg → döntési pont); zavaró: „apartmani-ur-a” belépési név,
  `/login` nyelv nélkül magyar, magyar jogi útvonalnevek.
- Levélolvasó: magyar szó/Ft/.hu nincs; zavaró: magyar Grt./eladói adat a láblécben, NAIH; eszkalációs doboz „UVODNA PONUDA”, „do 10. pro 13:00”.
- Vevő: árak mindenhol egyeznek (13 € / 9,75 € / következő 13 €); boravišna pristojba sehol; Pomoć fülnevek magyarul; nincs .ics melléklet.

## Nyitott
- Felület-kapu kivétel: `~/rc-briefs/nemzetkozi-hr-vegproba-felulet/01-minta-szobakartya-T.patch` (tulaj, koordinátoron át).
- Jog: HR jogalap/eladói adat/NAIH/magyar törvények a horvát tenant-lapokon (tulaj).
- Pénz: EUR-tárca élesen és a Barion teszt-boltban.
- Irány: ingyenes képforrás honlap nélküli HR leadhez.
- Bábel: `portalSentence.ts:14` mondata; a minta-szobakártya két szövege (a patch után); plurál „1 mjeseci”, „2 mjeseci”.
- A-SUB terület (nem javítva): `resolveChannel` HR mobilra „sms”-t ad (`enrichContact.ts:22`), saját oldal látnivaló-képei (`attachPhotoLinks`),
  `kontakt.mjs:397` `hu-HU` locale, BG portál-lista (nesebur.eu) a foreign-market e2e-ben.
