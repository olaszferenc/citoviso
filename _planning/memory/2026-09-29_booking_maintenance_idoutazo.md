# Időutazó őr az óránkénti karbantartásra: ajánlat-lejárat + dátumos ár az időben (2026-09-29)

SUB-szál (koordinátor: „Deploy-készenlét felderítés”, `cit92d2a67e`) · brief: `~/rc-briefs/dk-idoutazo.md`.

## A brief premisszája — részben téves

„Az `expireStaleOffers`-nek és a `maintainDatedPrices`-nek NINCS időutazó tesztje” — a
`scripts/booking-offer-check.mts` (Chromiumos E2E) mindkettőt EGY-EGY ponton méri (49 óra → lejárt;
egy söprés → egy levél, másodszorra nulla; tegnapi valid_to → lekerül). Ami hiányzott, és amit az új
őr lefed: a HATÁR (47 h / 48 h + 1 perc; 15. / 14. nap; valid_to = ma még él), a site SAJÁT
határideje (24 / 0 = soha), a napokon át óránként ismételt söprés idempotenciája, a negatív kontrollok
(bélyeggel született „kért napokra” sor, szezon éves ára, időtlen alapár, ismétlődő szezon), a
levél TARTALMA (összeg, dátum, link, címzett) és a honlap újrarenderelése (pozitív kontrollal).

## Az új őr — `scripts/booking-maintenance-timetravel-check.mts`

- Saját eldobható fixtúra (tenant/site/4 egység/tenant_user), nem a közös park; mock postafiók;
  takarítás a `finally`-ben (booking_request, tenant_message, site, sites/<slug>/). ~17 s, Chromium nélkül.
- ⭐ Az óra eltolása = a fixtúra dátumainak visszatolása (`offered_at`, `valid_from/valid_to`), NEM
  előretolt `today`: mindkét söprés GLOBÁLIS (gate-lane-check SWEEPS), egy előretolt `today` a közös
  dev DB idegen, ma még érvényes árait törölné. Elő-ellenőrzés: ha a söprés MA idegen sort érintene
  (lejárt idegen ajánlat, esedékes/lejárt idegen dátumos ár), az őr hangosan bukik, nem fut.
- Az óránkénti időzítő (fő fa) a futás közben a mi sorunkat is söpörheti → a levél a FŐ FA outbox/-ába
  kerül; ezért mindkét outbox/-ot olvassuk (címzett-bélyeg + mtime), és az ítélet DB + levél, nem a
  függvények visszatérési száma.
- Nem `own-fixture-only` (globális söprés) → a sorosított sávban fut.
- Bekötve: `hooks/pre-commit`, trigger: `src/booking/requests.ts` · `src/tenant/priceExpiry.ts` ·
  `scripts/booking-maintenance.mts` · az őr maga.
- Mutációs próba (ideiglenes, visszaállítva): ① a bélyeg-szűrő ki → 30 levél, piros; ② levétel
  `<=` today → a lejárat napján eltűnik, piros; ③ fix 48 óra a site-é helyett → 24/0 ágak pirosak;
  ④ 15 napos ablak → „a 14. napon”, piros. A zöld tehát nem vak.

## Lelet — DÖNTÉS KELL (nem javítottam: felületi szöveg, i18n, tulaj-döntés)

Élesi olvasás (2026-09-29): az éles `unit_price`-nak MÉG NINCS `valid_from/valid_to/expiry_notified_at`
oszlopa (migráció 0072 a nagy deployjal megy). A kódban az EGYETLEN dátumos-alapár-író az
ajánlat-út (`sendOffer` → `addDatedBasePrice(..., { remind: false })`), ami ADR-0267 ③ óta bélyeggel
születik. Következmény élesítés után:
- a 14 napos emlékeztető-ág élesben SOHA nem sül el (csak a 0267 előtti, bélyeg nélküli sornak járna,
  és ilyen élesen nem létezik) — halott kód;
- az Árazás lap mondata (`src/server/moduleConfigViews.ts:3212`: „…Lejárat előtt e-mailben
  emlékeztetjük.”) MINDEN megjelenő dátumos sorra HAMIS ígéret (§B.17);
- mellék: az emlékeztető levele („…a vendég nem lát árat, és árajánlatot kér”) hamis, ha a szobának
  időtlen alapára is van — a halott ág miatt élesben nem jelentkezik.
Javaslat: a mondat második felét venni ki (vagy feltételessé tenni a bélyegre).

Egyéb megfigyelés (nem hiba): mindkét söprés UTC-dátummal számol; Budapesthez képest 0–2 órát KÉSIK
(éjfél és 02:00 között), előbb sosem vesz le árat.

## Fájlok
- `scripts/booking-maintenance-timetravel-check.mts` (új)
- `hooks/pre-commit` (új blokk a booking-offer után)
- `_planning/memory/2026-09-29_booking_maintenance_idoutazo.md`
