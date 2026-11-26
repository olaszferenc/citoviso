## ADR-XXXX — Ünnepnapok automatikus, ingyenes forrásból (Nager.Date), felvételkor és évente, forrás-jelöléssel

- **Dátum:** 2026-11-26
- **Státusz:** elfogadva (a koordinátor, `cit9b4690e3`, döntése a 2. fázis nyitott pontjára)
- **Érinti:** `src/holidaySource.ts` (új), `migrations/0158_country_holiday_source.sql`, az ország-választó és -mentés (konzol szerver), a napi billing-futás, a teljesség „Ünnepnapok” sora

### Döntés
1. **Forrás:** Nager.Date public holidays (`https://date.nager.at/api/v3/PublicHolidays/<év>/<ISO>`). Ingyenes, kulcs nélküli, nyilvános adat; csak az országkód és az év megy ki. Fizetős API tilos.
2. **Csak amit a forrás közöl:**
   - csak az országos (`global: true`), „Public” típusú ünnep kerül be, a forrás dátumával;
   - számított vagy kitalált dátum nincs, a mozgó ünnep évenként a forrás dátumával jön;
   - ha a forrás nem ismeri az országot (404, vagy 204 üres törzzsel — mérve: AE), vagy hiba van, a lista üres marad, és a teljesség piros.
3. **Mikor tölt:**
   - választáskor az idei és a jövő évi napokat, de csak ha a beépített piszkozatnak nincs listája (az EU-országok a sajátjukat viszik);
   - mentéskor a sor `holiday_source` jelölést kap, ha van forrás-napja; a mellé kézzel tett nap nem kapcsolja ki (a pótlás csak hozzáad), a csak kézi lista nem kap jelölést;
   - évente: a napi billing-futás a jelölt sorokhoz HOZZÁADJA a hiányzó év napjait. Kézi napot nem töröl, kézzel töltött sorhoz nem nyúl, és a hibája a számlázást nem állítja meg.
4. **Látható forrás:** a teljesség „Ünnepnapok” sora kiírja: „forrás: Nager.Date (date.nager.at), évente magától frissül”.

### Igazolás (2026-11-26)
- `holiday-source-check` (scratch DB, befecskendezett fetch, hálózat nélkül; pre-commit): szűrés, 404/204, jelölés (kézi nap mellett is), pótlás, kézi nap megmarad, egyetlen kulcs nélküli forrás.
- A valódi végpont válasza 2026-11-26-án ugyanezeket a mezőket hozta (HR 200, AE 204).
- `country-page-e2e`, `country-layer-check`, `country-hr-e2e`, `price-change-check` zöld.

### Visszafordíthatóság
🔄 Két új, üres oszlop (0158). A forrás kivezetése = a billing-hívás és a választó-hívás törlése; a már betöltött napok maradnak.
