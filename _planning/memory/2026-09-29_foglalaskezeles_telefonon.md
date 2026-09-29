# 2026-09-29 — A tulaj telefonon dönt a foglalásról (FK-015, „A” változat) — ADR-0274

SUB-szál (koordinátor: `citded06a5f`), brief: `~/rc-briefs/tulaj-foglalaskezeles-telefonon.md`.
§2b kör → a tulaj: *„A) verzió. Igen a döntésre váró kell ami Kártyanyitás előtt is látszódjon a fő részen.”*

## Mit old meg (az FK-015 éjszakai kör 7 lelete)

1. Levél → Foglalások: az Üzenetek-fül levelének TETEJÉN a döntés (ki · mikor · mennyi, 48 px-es fő gomb, ami
   AZT a kérést nyitja: `?k=<token>#kerelem`), a gyors döntés 44 px-es gombokkal.
2. Gyors döntés: a kérdés a vendég nevével, „Mégsem”, a megerősítő a képernyőre görget; a nyitott megerősítő
   mellől eltűnik az ellentétes döntés.
3. Visszaigazolás: a megerősítő a kártyán belül, teljes szélességben, névvel; „Mégsem” / „Igen, visszaigazolom”;
   az üzenet egy koppintásra nyílik. JS nélkül is működik.
4. „Felhívom” (`tel:`) + „Írok neki” (`mailto:`) a kártyán; a levélben koppintható szám.
5. Jelvény = DÖNTÉSRE VÁRÓ kérések (`pendingRequestCount`), a fül megnyitásától nem tűnik el; Áttekintés-sáv +
   Teendők-sor kérésenként („Döntök” / „Ajánlatot küldök”).
6. Naptár a következő döntésen (`calendarFocus`): ?k= → legsürgősebb → következő érkezés; visszaigazolás után
   nyitva, a döntött hónapon. Új napfajta: „kért éjszaka” (szaggatott), koppintásra a kéréshez ugrik.
7. Az árajánlat-magyarázat a kártya margóján belül (a mai `main`-en is élt a hiba).

Telefonon (álló ÉS fekvő) a döntés áll elöl, a naptár utána; asztalon marad „naptár bal, lista jobb”.
A bevezető mondat a fül aljára, az útmutató a cím melletti súgó-ikonná került.

## Mérés

`scripts/booking-phone-check.mts` — a TELJES `adminDashboard()` (valódi keret) 390×844 + 844×390, mobil
kontextusban, geometria (a látható sáv = felső sáv alja … alsó menü teteje), `--selftest`: a régi elrendezés
CSS-sel visszaállítva 21 ág piros. `--shots <dir>` a jelentés képeihez. A mérés közben két valódi hibát fogott:
egy későbbi `.bk-hint` szabály lenullázta a magyarázat margóját, és a gyors döntés megerősítője a hajtás alá nyílt.
A kép-ellenőrzés további kettőt: a régi `.bk-verdict summary` szabály a belső üzenet-kapcsolóra is ráment, és az
„Ajánlatot küldök” felirata sötét volt a zöld gombon (`.adm-shell .citui-btn` erősebb szelektor).

## Tanulság

- Egy `container-type` elem SAJÁT MAGÁT nem stílusozhatja `@container`-rel — a szülőt kell konténerré tenni.
- Két szabály azonos specificitással: a későbbi nyer — az új osztályt a meglévő mellé (`.bk-hint.bk-req__qhint`),
  a keret gomb-stílusát (`.adm-shell .citui-btn`, 36 px) csak erősebb szelektor írja felül.

## Módosított fájlok

`src/server/bookingViews.ts` · `src/server/adminViews.ts` · `src/server/public.ts` · `src/booking/requests.ts` ·
`public/assets/ui/citui-admin.css` · `src/i18n/catalog.json` · `scripts/booking-phone-check.mts` (új) ·
`scripts/booking-queue-urgency-check.mts` · `hooks/pre-commit` · `kb/entries/admin-bookings/entry.hu.md` + `screen.png` ·
`elek/scenarios/FK-015-owner-aftermath-mobile.md` · `assets/design-refs/tenant-admin/booking-phone/` (új) ·
`assets/design-refs/tenant-admin/foglalasok-README.md` · `…/booking-queue-urgency/README.md` ·
`_planning/decisions/XXXX-foglalaskezeles-telefonon.md`

## Nyitott

- A tulaj árajánlat-kérő levele (`requests.ts` quoteNote) „az ár bekerül az árlistájába”-t ír — ellentmond az
  ADR-0267-nek; a koordinátornak jelezve, a takarító szál (`cit95d78eb3`) dolgozik rajta.
- A kb-shot `--out` futás 10 MÁS KB-képet is eltérőnek talált (pricing, rooms, multilang, modules-booking) — nem
  ettől a változástól; nem vettem át.
- Az FK-015 forgatókönyv frissítve, de újrafuttatni tiszta alany kell.
