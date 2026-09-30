## ADR-0290 — Szállás-időzóna: minden szállás a saját időzónájában él; egyetlen „ma” (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; brief: `~/rc-briefs/szallas-idozona.md`,
MÓDOSÍTÁS: „kód készüljön, ne várjon a mock-jóváhagyásra” — a felület „A” változata elkészült, a tulaj utólag ítél) ·
**Kapcsolódó:** ADR-0289 (a „ma”-söprést nyitott kérdésként hagyta), ADR-0288, ADR-0287; kontraktus:
`assets/design-refs/tenant-admin/szallas-idozona/`.

**Kontextus.** A foglalási/árazási „ma” ~20 helyen UTC-napként számolt (00:00–02:00 Budapest között a tegnapot adta), a
tulaj/vevő felé mutatott idők a platform zónáját (Budapest) követték. Egy nem-magyar szállásnál (Bécs, Lisszabon,
Kanári-szigetek) mindkettő rossz: a „ma”, a lejáratok és a vendégnek mutatott időpontok a SZÁLLÁS órája szerint
értelmesek. A tulaj: „minden szállás a saját időzónájában él”.

**Döntés.**
1. **Adat:** `tenant.time_zone text NOT NULL DEFAULT 'Europe/Budapest'` (migráció `0082_tenant_time_zone.sql`), IANA-név,
   az alkalmazás validálja (`isValidTimeZone`, `Intl`). Minden meglévő tenant Europe/Budapest (mind magyar). Az új tenant a
   szállás országának alapzónáját kapja (`provision.ts`, a gyűjtés országából).
2. **Országonkénti alapérték KÓDBAN** (`src/text/zoneTime.ts` `COUNTRY_DEFAULT_TIME_ZONE`), nem a `market` táblában: a
   `market` JOGI jóváhagyást tart, és csak megnyitott piacokra van sora, a zóna viszont földrajzi tény, amit minden
   gyűjtött ország kér. Több zónájú országban a szárazföldi zóna az alap; a szigetet a tulaj választja.
3. **Egyetlen „ma”:** `todayIn(zone)` (`zoneTime.ts`). A szállás-feloldók (`src/tenant/timeZone.ts`: `tenantTimeZone` /
   `siteTimeZone` / `unitTimeZone`, `todayForTenant/Site/Unit`, 60 mp-es folyamat-gyorsítótár) adják a zónát. Átállítva:
   foglalási kérés szabályai (legkorábbi érkezés, horizont), ajánlat-nézet és -küldés, naptár (alap-hónap, múlt-napok,
   import-szűrés), szobák (jövőbeli foglalások, törlés), iCal-export, árak (`unitPriceStatus`/`priceSpan` `today`
   paramétere KÖTELEZŐ lett), ár-hézag, lejáró árak (szállásonként, a guardok rögzített `today`-je megmarad), szezon-kérdés
   (a szállás reggele: `MORNING_LOCAL_HOUR` 7, eddig 06:00 UTC), szerkesztő, programok, vendég-oldal, vendégnek küldött
   ajánlat-lejárat.
4. **Nézetek:** a tenant-admin kérés-szintű zóna-kontextust kap (`src/tenant/zoneCtx.ts`, AsyncLocalStorage — a konzol
   `i18nCtx` mintája; a `currentTenant` tölti ki). A tulaj-idők (üzenetek „ma/tegnap” és időpontja, foglalási határidők,
   „Utoljára frissült”, éves díj hónap-mérője, „idén” csempe) ezt olvassák. Logika SOSEM a kontextusból dolgozik.
5. **Platform marad Budapesten:** kiküldési ablakok (ADR-0288), emlékeztető (ADR-0287), operátori konzol, forgalmi riport
   és havi levél, a mi számláink kelte (`payment/service.ts`, eddig UTC-nap!) és a Dokumentumok/Pénztárca dátumai, AAM-adóév,
   lead-ajánlat oldal, scraper, motor minta-programjai. A `budapestTime.ts` ennek vékony rétege a `zoneTime.ts` fölött;
   a beégetett `"Europe/Budapest"` literálok `APP_TZ`-re kötve.
6. **Felület („A” változat):** a tulaj a „Fiók” fülön („Szállás időzónája”), az operátor a lead-oldal átalakított-ügyfél
   blokkjában („Időzóna” · „Módosítás”) állítja, EGY közös választóval (`zonePicker.ts`: natív lista, JS-sel kereső, élő
   óra, ország-figyelmeztetés, visszaállítás). Mindkét mentő útvonal validál, mielőtt ír.

**Őr:** új `scripts/tenant-zone-check.mts` (pre-commit): ① a „ma” éjfél körül öt szállás-zónában, három szerver-zónában;
② DST (Budapest, Lisszabon); ③ ország-alapérték és validátor; ④ tenant→site→unit feloldás; ⑤ a tulaj naptára
Kiritimati (UTC+14) és Pago Pago (UTC−11) zónával — a múlt-napok a zónával mozognak; ⑥ nézet-kontextus és vevő-bélyeg;
⑦ szerkezet: nincs UTC-s „ma” a foglalási/árazási fájlokban, nincs beégetett Budapest, a mentés előbb validál, a
provisioning az országból vet. Folyamat-lokális zóna-felülírással, a közös dev-DB-t nem írja. Szándékos rontással mérve:
UTC-s „ma” 7, unit-feloldó 1, nézet-kontextus 2, validálatlan mentés 1, naptár 1, vevő-bélyeg 1 piros.

**Szándékosan nem:** Postgres `date` értékek naptár-matekja (nem pillanatok); `analytics/siteVisit.ts` napi hash-forgatás
(adatvédelmi, platform); `scraper/contactLedger.ts`.

**Élesítés:** az ADR-0287/0288/0289-cel együtt; a `0082` migráció fut (pg_dump előtte, GATE 3); élesen minden tenant
Europe/Budapest. **Visszafordíthatóság:** 🔄 a kód visszaállítható; az oszlop maradhat (alapértéke a mai viselkedés
Budapest-része).
