# Az árajánlat ára alapból csak arra a kérésre szól + „Kiküldött ajánlatok” lista (2026-09-29)

SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/arajanlat-csak-erre-a-keresre.md` · ADR-XXXX ·
kontraktus: `assets/design-refs/tenant-admin/booking-offer-scope/` („A”).
Tulaj (a koordinátoron át, szó szerint): „OK A)” · „Kért Napok” · a mezőnévre „igen” · a Myrna-sorra
„Leszarom mert teszt adat”, majd „minek javítunk dev rekordot?” (→ nem nyúltunk hozzá, nincs backfill).

## Mérés (dev DB, olvasás)

`unit_price` 29 sor, 19 alapár, dátumos 0. Ajánlatból született: **1** (myrna-haus, „A szállás egésze”,
90 000 Ft időtlen alapár, 10 ms-mal az `offered_at` előtt). Ez tette a házat foglalhatóvá, és a widget az
ADR-0256 ① miatt azon nyílt. whole_only egység nincs a dev DB-ben. Alsó korlát (nincs forrás-oszlop).

## §2b kör

3 változat (A pipa · B három gomb · C később, a listából), méret-váltóval, `elek/runs/arajanlat-ar/`
(gitignore-olt; mock + 24 kép + `walk.mts` végigkattintás). A végigkattintás a SAJÁT mockom hibáját fogta
(változatváltáskor bent maradt az ár → „send disabled while empty” piros); a képek két mobil-tördelést
(dátum a szám közepén, idegen mockvezérlő-sáv a teljes-lapos képen — a sticky a kép közepére festődik).

## Megvalósítás

- `sendOffer` (`requests.ts`): `save` = `request` (alap, semmi nem íródik; az összeg `offerOverlayRows`-szal,
  ugyanazon a szabályon) · `dates` (dátumos alapár a `missingRuns` szakaszaira, `remind: false` → bélyeggel
  születik) · `base` (időtlen). Pipa út nélkül → 400 + hibaüzenet, 0 írás. `offer_saved_as` a kérésen.
- `loadOfferView`: `unitKind` (whole/room) + `opensWidget` (a widget első-áras szabálya, `editor.ts` sorrend).
- Ajánlat-lap (`offerViews.ts`): „Érvényes eddig”/„Nincs vége”/„Nincs lejárati dátum” ki; pipa + két rádió +
  élő `[data-cons]`; „Szoba” → „Amit kér”; a zöld doboz megmondja, hova került az ár.
- Foglalások fül (`bookingViews.ts`): „Kiküldött ajánlatok” (`getSentOffers`), táblázat ↔ kártyák
  `@container` 700 px, szűrők JS-sel (nélküle minden sor látszik).
- Migráció `0080_booking_offer_saved_as.sql` (a dev DB-n lefuttatva).
- Őr: `booking-offer-check.mts` S①–S⑥, **142 állítás zöld**; piros kontroll: a régi „mindig alapár”
  alapértelmezéssel **14 bukás**. KB: `admin-bookings` szakasz + `offer.png` újragyártva. FK-015 ④: a
  „Csak erre a kérésre.” és a pipa-felirat mérve.

## Nyitva

- A tudásbázis-őr FLAG-je (javítva): a „Foglalások megnyitása” a modul-beállításra vitt; a súgó „foglalhatnak”-ot
  ígért „foglalási kérés” helyett; telefonon nincs „oszlop”. Őr-állítás a gomb céljára.
- A widget `unpriced` jele „nincs ársor” — egy élő „kért napokra” ablak alatt az egység nem „egyedi ár”
  (ADR-XXXX „Ami tudottan nyitva marad”).
- A mockban a lista ár/éj alsora a megvalósításban elmaradt (nincs tárolt mező rá) — a README kimondja.

## Fájlok

`migrations/0080_booking_offer_saved_as.sql` · `src/db/schema.ts` · `src/booking/requests.ts` ·
`src/tenant/prices.ts` · `src/server/offerViews.ts` · `src/server/bookingViews.ts` · `src/server/public.ts` ·
`src/i18n/catalog.json` · `scripts/booking-offer-check.mts` · `scripts/kb-shot.mts` ·
`kb/entries/admin-bookings/entry.hu.md` + `assets/hu/offer.png` · `elek/scenarios/FK-015-owner-aftermath-mobile.md` ·
`assets/design-refs/tenant-admin/booking-offer-scope/` (új) · `assets/design-refs/tenant-admin/booking-offer/README.md` ·
`_planning/decisions/XXXX-arajanlat-ara-alapbol-csak-arra-a-keresre.md` (új) · `_planning/decisions/0215-…md`.
