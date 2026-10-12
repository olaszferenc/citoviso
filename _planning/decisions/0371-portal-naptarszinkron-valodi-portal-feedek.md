## ADR-0371 — Portál-naptárszinkron valódi portál-feedek ellen: szállás-időzóna, csonka feed = hiba, webcal elfogadva, az üres kiadás is érvényes naptár

**Dátum:** 2026-10-12 · **Státusz:** elfogadva (SUB a koordinátor briefjére, „Elek-teszt koordinátor”) ·
**Kiegészíti:** ADR-0361 (a szinkron első köre), ADR-0367 (élesítés előtti javítások), ADR-0290 (a szállás időzónája)

### Helyzet
A szinkront soha nem teszteltük valódi portál ellen, és élesen nincs tulaj, akinek a fiókján lehetne. Portál-fiók nélkül
21 valódi exportot gyűjtöttünk nyilvános forrásból (13 Airbnb, 5 Booking.com, 3 VRBO/HomeAway; Szállás.hu-ra nincs
nyilvános minta), forrás-URL-lel, anonimizálva: `scripts/fixtures/ical-samples/` (+ `SOURCES.md`). A parserünk mind a
20 nem üres mintán ugyanazt a foglalt-éjszaka-halmazt adja, mint a független python `icalendar` 7.3; a Booking üres
feedje 0 éjszaka, figyelmeztetés nélkül. A minták ellen tehát NEM bukott semmi — a hibákat a közösségi beszámolók
(Airbnb/Booking/Vrbo súgó, channel-manager fórumok) és az RFC 5545 elleni ellenőrzés hozta ki.

### Döntések
1. **UTC-időpont = a szállás naptári napja.** Egy `Z` DATE-TIME (`…T220000Z`) éjszakáját a szállás időzónájában
   (ADR-0290, `unitTimeZone`) olvassuk — Intl-lel, csomag nélkül. A régi kód UTC-napot vett: a helyi éjfélt UTC-ben író
   PMS-feed minden foglalást egy nappal KORÁBBRA tett (a távozás napja foglalt, az érkezés napja szabad lett volna).
   `VALUE=DATE` és TZID-s/lebegő értékek változatlanok (a leírt nap). A portálok saját feedje mind `VALUE=DATE` — ez a
   közvetítőkön (PMS, Google-naptár) át érkező feedeket védi.
2. **Csonka feed = sikertelen szinkron.** `END:VCALENDAR` nélküli letöltés hibát ad („A portál csonka naptárat
   küldött…”), és egyetlen éjszaka sem változik. A régi kód a hiányzó foglalások éjszakáit FELSZABADÍTOTTA volna — a
   portál hibás exportja (Hosthub 2019: a hostok ~20–25%-a) így kettős foglalást okozott volna.
3. **`webcal://` = ugyanaz a feed https-en.** Mentéskor és letöltéskor `https://`-re cseréljük (Vrbo súgó). A régi kód
   „nem érvényes webcím”-mel elutasította az Apple/Google/Vrbo linkjét.
4. **Az üres kiadás is érvényes iCalendar.** RFC 5545 §3.6: a VCALENDAR legalább egy komponenst tartalmaz. Az új
   szállás exportja (épp amikor a tulaj beilleszti a portálba) üres volt, és az Airbnb a foglalás nélküli linket
   elutasítja (MotoPress-támogatás). Az üres feed egy helyőrzőt kap: TEGNAPI, egy éjszakás, `TRANSP:TRANSPARENT`
   esemény („Nincs foglalás”, `empty-<hash>@citoviso.com` UID) — eladható éjszakát nem zár; a saját olvasónk kihagyja.

### Amit NEM változtattunk (és miért)
- A Booking „CLOSED - Not available” és az Airbnb „(Not available)” is foglalt éjszaka marad: a tulaj a portálon zárt.
- A kiadott `STATUS:CONFIRMED` marad: egyetlen gyártói changelog szerint okozott piros jelet a Booking felületén, ez
  nem bizonyíték.
- A platform-hoszton a HEAD 405 (a tenant-hoszton kiszolgált) — a tulaj a tenant-hosztos linket kapja, és egyetlen
  portálról sincs forrás, hogy HEAD-del kezdene.

### Őr
`scripts/portal-ical-samples-check.mts` (offline, DB és böngésző nélkül; pre-commit: `src/booking/(ical|sync).ts`, a
fixtúrák, maga az őr). A javítás előtti `ical.ts`/`sync.ts`-en 8 ponton piros (mérve 2026-10-12).
