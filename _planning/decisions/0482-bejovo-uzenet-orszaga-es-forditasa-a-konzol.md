## ADR-0482 — Bejövő üzenet országa és fordítása a konzol-nyelvre (Bábel a konzolon); közös ország-sáv minden riport-fülön

**Dátum:** 2026-11-26 · **Státusz:** elfogadva (lokál, nem élesítve) · Kiegészíti: ADR-0412 (fordítás csak Bábel), ADR-0340 (válaszolás az irányítópultról), ADR-0437 / ADR-0455 (ország-réteg) · Terv: `assets/design-refs/console/orszag-szuro-forditas/`

### Kontextus

A tulaj (brief `report-20261126-070656.md`): „A riportok összes menüpontjában külön szűrhetőnek kell lennie az
országnak, mert indulunk a nemzetközi terjeszkedéssel. Az irányító pulton látható bejövő üzeneteknél is látni
kell … az ország izójával, hogy melyik országból jött a megkeresés, és a beérkező üzenetet automatikusan a
felhasználó által beállított nyelvre kell fordítani.” Terv-kör után döntés: **1.B** (közös ország-sáv),
**2.B** (fordítás + halvány eredeti együtt), **3 igen** (a kiküldött megkeresés és Poe javaslata is fordul).

Ma: az ország-szűrő csak a Tölcsér/Viselkedés fülön volt, és csak több ország esetén látszott; a válaszoknál
sem ország, sem fordítás nem volt. Az ADR-0412 a kódból minden fordító modellhívást kizár, és a fordítás
forrása Bábel commitolt magja — de egy bejövő üzenet élő adat, deployig nem várhat.

### Döntés

1. **Riport:** a Megkeresés-riport mind a 8 fülén egy közös „Ország” chip-sáv (`ctry`, ISO-2, „-” = ismeretlen),
   mindig látszik, a fülváltáson át megmarad. Az ország a lead országa (Próba: a próbázó leadjéé; Tenantok /
   Előfizetők: a tenant leadjéé). Előfizetők: ország választásakor annak pénznemében, átváltás nélkül.
2. **Válaszok:** minden válasz mellett a lead országának ISO-kódja (`countryOfLeads`).
3. **Fordítás = Bábel élő munkája a konzolon, nem a mag.** Új tábla `outreach_reply_translation` (0154): rész
   (`body` · `ours` · `outreach` · `suggestion`) × célnyelv, a forrás ujjlenyomatával (`source_hash` =
   sha256[0..16]). Célnyelv = minden operátor `operator_user.lang`-ja. A válasz-gyűjtő percenkénti hívása
   (`/api/replies/ingest`) visszaadja a hiányzó részeket, a gyűjtő jegyet ír `~/babel/beerkezo/*-forditas-*.md`
   néven (a meglévő `babel-watch.py` 10 percenként átadja Bábelnek), Bábel a konzolon a `babel` fiókkal teszi le
   (`POST /replies/<id>/translate`; más fiókról elutasítva). Ha a forrás megváltozik (Poe átírja a javaslatát),
   a régi fordítás nem látszik, és új jegy megy.
4. **Megjelenés (2.B):** felül „Fordítás (<nyelv>) · Bábel” + fordítás, alatta halványan „Eredeti · <nyelv>”;
   Poe javaslatánál „— ez megy ki” (az „Elküldöm” az eredetit küldi). Hiányzó fordításnál „Bábel fordítja…” +
   az eredeti. Saját nyelvű üzenetnél semmi. Ismeretlen nyelvű (lang NULL) válasz nem kap jegyet.

### Elvetett alternatívák

- **Gépi fordítás (API vagy helyi modell) a beérkezéskor:** az ADR-0412 kifejezetten tiltja a kódból a fordítást;
  a helyi modell is „kódos fordítás” lenne, és a tulaj szava: csak Bábel.
- **Bábel commitolt magja a válaszokra is:** egy élő üzenet deployig nem várhat; ügyféladat nem kerül a repóba.
- **Fülenkénti ország-legördülő (1.A):** a tulaj a közös sávot választotta.

### Következmények

- Fordítási API-költség továbbra is 0; a fordítás Bábel előfizetéses sessionjéből megy, ~10 perc + a munkája.
- Élesen kell: a 0154 migráció (a deploy viszi), a `babel` konzol-fiók (létezik), Bábel Chrome-jának belépése
  az éles konzolra a `babel` fiókkal.
- Őr: `scripts/reply-translation-check.mts` (scratch DB, 29 pont), a riport-sáv a `scripts/country-reports-e2e.mts`-ben.
