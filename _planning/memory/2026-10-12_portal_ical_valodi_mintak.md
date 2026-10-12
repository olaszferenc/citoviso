# 2026-10-12 · Portál-iCal: valódi minták, közösségi hibaminták, élesítés utáni proxy-teszt terve (ADR-0371)

SUB a „Elek-teszt koordinátor” briefjére (`~/rc-briefs/portal-ical-valodi-minta-20261012.md`) + a koordinátor
kiegészítése (közösségi tapasztalat). Portálba belépés, regisztráció, élesi írás: SEMMI.

## 1. Behúzás — valódi minták
- 21 minta nyilvános forrásból (GitHub-hibajegyek, StackOverflow, repó-fixtúrák): **13 Airbnb, 5 Booking.com,
  3 VRBO/HomeAway, 0 Szállás.hu** (nincs nyilvános minta). Forrás-URL-ek: `scripts/fixtures/ical-samples/SOURCES.md`.
  Anonimizálva (vendégnév, foglalási kód, a telefonszám MINDEN jegye, alias e-mail), a szerkezet érintetlen.
- Eredmény: a 20 nem üres mintán a foglalt éjszakák halmaza **betűre egyezik** a független python `icalendar` 7.3-mal;
  Booking üres feed → 0 éjszaka, tulaj-figyelmeztetés nélkül. Egyetlen minta sem buktatta a parsert.
- Formai tanulságok: Airbnb 3 korszak (0.8.8 régi: név+telefon a DESCRIPTION-ben, minden letöltésnél új UID; 0.8.8
  közép: „Reserved” / „Airbnb (Not available)”; 1.0 új, 2025-től) — mind `VALUE=DATE`, nincs TZID. Booking: PRODID-ben
  hibás `\\\,` escape, minden esemény „CLOSED - Not available”, üres feed = csak fejléc, 0 VEVENT. VRBO 2016: `DTSTART:20160728`
  `VALUE=DATE` nélkül. A foglalás és a kézi zárás egyik portálon sem különböztethető meg biztosan (a SUMMARY-n kívül).

## 2. Közösségi hibaminták → tesztesetek (forrással)
| hibaminta | a mi kódunk | forrás |
|---|---|---|
| Airbnb csak `.ics`-re végződő URL-t fogad | ✅ `/naptar/<token>.ics`, `/naptar/<token>/<portál>.ics` | airbnb.com/help/article/99 |
| Airbnb 3 (néhol 2) óránként frissít, max. 2 év import | — tájékoztató | airbnb.com/help/article/99 |
| Booking 2 óránként, „Import now”; feltétel: ≤ 20 szobatípus, típusonként 1 egység, nincs channel manager | — | eazyal.com összefoglaló a partner-súgóról (a partner.booking.com 403-at ad, közvetlenül nem olvastuk) |
| Airbnb elutasítja az időpontos (`…T000000`) eseményt | ✅ csak `VALUE=DATE`-et adunk ki (őr) | wpbookingcalendar.com/faq/fix-ical-url-is-invalid/ |
| Airbnb elutasítja a foglalás nélküli (üres) linket | ❌→✅ JAVÍTVA: helyőrző esemény | motopress.com/forums/topic/sudden-airbnb-calendar-sync-issues/ ; RFC 5545 §3.6 |
| UTC-időpont egynapos eltolódás | ❌→✅ JAVÍTVA: a szállás időzónája | Airbnb Community (keresőkivonat), több CM-súgó |
| Csonka / hibás portál-export (Hosthub 2019, ~20–25%) | ❌→✅ JAVÍTVA: hiba, nem felszabadítás | Hosthub-beszámoló (a kutató-subagent kivonata) |
| `webcal://` link (Vrbo: cserélje https-re) | ❌→✅ JAVÍTVA: normalizálás | help.vrbo.com |
| 403/429/Cloudflare-ellenőrzőoldal az import-célon | ✅ hiba, az éjszakák maradnak (őr) | Guesty súgó, Hostfully, Beds24 |
| Booking zárt nap `DTSTART == DTEND` | ✅ 1 éjszaka (őr) | motopress.com/forums/topic/channel-manager/page/5/ (kivonat) |
| Lemondás = az esemény eltűnik | ✅ a link éjszaka-halmaza cserélődik; sikertelen letöltés nem változtat | MotoPress FAQ, Beds24 |
| UID-instabilitás (régi Airbnb új UID-t ad) | ✅ napokra kulcsolunk, nem UID-re (airbnb-07/08 fixtúra) | stackoverflow.com/questions/38193837 |
| Körbe-szinkron (echo) | ✅ A6: a portálonkénti export kihagyja az attól jött éjszakákat | Vrbo súgó, Lodgify |
| Booking iCal XML-kapcsolat / channel manager mellett nincs | — tulaj-tájékoztatás kérdése | motopress.com/forums/topic/channel-manager/page/3 (koordinátor nyoma) |
| Szállás.hu: a szobaválasztó visszaugrik, könnyű kétszer ugyanazt a linket exportálni | ⚠️ nincs őrünk (javaslat: figyelmeztetés, ha két szobának azonos az import-URL-je) | appartman.hu, szallaskeres.hu |
| Exportált `STATUS:CONFIRMED` piros jel a Booking felületén | ⚠️ egyetlen gyártói changelog — nem változtattunk | Booking Manager changelog |
- Élesi olvasás (2026-10-12): a `citoviso.com/naptar/<ismeretlen>.ics` minden User-Agenttel (üres, „Airbnb”,
  python-requests, Go, Mozilla) az alkalmazás 404-ét adja — a Cloudflare NEM állít bot-falat az export elé. A HEAD a
  platform-hoszton 405 (a tenant-hoszton kiszolgált).

## 3. Kiadás — RFC 5545 + portál-elvárások
- Helyi validálás (külső szolgáltatásnak semmi nem ment): python `icalendar` 7.3 és `ical.js` 2 — a foglalt export
  hibátlan (CRLF, ≤ 75 oktett, UID+DTSTAMP minden eseményen, egész napos, stabil UID). Hiba: a header-only üres naptár
  (§3.6) → javítva.
- `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: public, max-age=300` — a portálok 2–3 órás ciklusához bőven elég.

## 4. Élesítés utáni proxy-teszt terve (NEM most — a nagy deploy után, a tulaj engedélyével)
1. Egy tesztelői tenant (pl. az Elek-park élesen, ha addigra van) egy szobájához 2–3 foglalt éjszaka + egy üres szoba.
2. A kiadott linket (a TENANT-hosztos `https://<slug>.citoviso.com/naptar/<token>.ics`) egy Google-fiókban
   „Naptár hozzáadása → URL alapján” felvenni. Siker: a naptár megjelenik, a foglalt napok egész napos eseményként,
   a távozás napja SZABAD; az üres szobánál egyetlen tegnapi „Nincs foglalás” esemény, hiba nélkül.
3. Ugyanez `webcal://` előtaggal (Apple Naptár / iOS feliratkozás), és a portálonkénti `/…/booking.ics` alakkal.
4. Változás-teszt: egy új foglalás felvétele → a Google 6–24 órán belül frissít (nem azonnal — ez a Google ütemezése).
5. Fordított irány proxyval: egy nyilvános Google-naptár iCal-címét portál-linkként felvenni; az időpontos
   (nem egész napos) Google-esemény a szállás napjára essen.
- **Igazolatlan marad akkor is:** a portál SAJÁT importja (Airbnb „link nem érvényes” ellenőrzése, Booking jogosultsági
  feltételei, a portál ütemezése), a Szállás.hu export pontos formája (TZID, SUMMARY, időablak), és hogy a portál a
  helyőrző eseményt hogyan kezeli → **az első valódi ügyfélnél, felügyelve**: a beillesztés után a portál
  „kapcsolódva / N nap importálva” visszajelzését és egy tesztfoglalás átérését a következő ciklusban mi nézzük meg.

## Módosított / létrehozott fájlok
- `src/booking/ical.ts` (időzóna-opció, üres-feed helyőrző + kihagyása) · `src/booking/sync.ts` (csonka feed, webcal,
  a szállás időzónája) · `src/server/public.ts` (webcal a link-mentésnél) · `scripts/ical-check.mts` (az üres naptár
  elvárása az RFC-hez igazítva) · `scripts/portal-ical-samples-check.mts` (új őr) · `hooks/pre-commit` (bekötés) ·
  `scripts/fixtures/ical-samples/` (21 minta + `SOURCES.md` + `manifest.json`) · `_planning/decisions/XXXX-portal-ical-valodi-mintak-ellen.md`

## Nyitott
- Szállás.hu-minta csak egy valódi partnerfiók exportjából szerezhető (első ügyfél).
- Javaslat (nem kért, nem csináltam): figyelmeztetés, ha egy szállás két szobájához ugyanaz az import-link kerül (Szállás.hu-csapda).
