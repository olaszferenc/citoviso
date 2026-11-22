# 2026-11-22 — Ország-réteg 3/10: horvát javítókör (Elek HR leletei) + Elek ismétlés

Brief: `~/rc-briefs/orszag-reteg-3j-horvat-javitokor-20261121.md` · session `citda4f0c91` · koordinátor `cit9b4690e3` · ADR-0464 (3/10).

## Elvégezve
- **Pénz:** −25 % egy forrásból (a valódi küldés rögzíti az ajánlatot; a tesztvilág a valódi úton küld); a következő terhelés
  előrejelzése a futó domain-beszerzés díjával (a terhelés nem); varázsló 85,50 € tizedessel + nem-forint ár-példa;
  aktiváló levél ≤8 mp-et vár az azonnali domain-kimenetre, hiba-levél „elkelt” csak `DomainTakenError`-nál; ház-riasztás
  minor unitból; levél ár-doboza nem-forintnál „Ft” nélkül; HR PDV = HR+OIB offline ellenőrzés.
- **Ország:** `calendarSyncPortals()` (mock minta + konfigurátor modul-leírás; HR: Booking.com + Airbnb); OIB (ISO 7064 MOD
  11,10) admin + rendelés céges ága, `0148 order_intent.buyer_national_tax_id`, az impresszum előtöltése; időzóna a lead
  országából; AAM csak magyarul.
- **Nyelv:** csomagnevek/tartalomlista/modul-sorok/csoportcímek `tr()`, országlista `Intl.DisplayNames`, vevő-ellenőrző
  üzenetek a vevő nyelvén, szobakártya, admin-naptár, lemondó oldal, `/login?l=`, vásárlás utáni sáv, felszereltség,
  fizetés-lépés dátumai; a fizetési lap a süti-sáv fölött ér véget; mock „ma” a szállás zónájában.
- **Többes szám:** `plural:one=…;few=…;other=…` érték, `selectPlural` (szerver), `trn()` (kliens) — az alakokat Bábel adja.
- **Teszt:** `scripts/country-hr-fix-e2e.mts` (33), `scripts/lib/hr-world.mts` (közös tesztvilág), HR-e2e a Bábel-függő
  listával (`scripts/lib/babel-pending-3j.mts`). KB: `admin-legal` OIB-figyelmeztetés.
- **Elek ismétlés** (2 tesztvilág, 3 szerep): `~/rc-briefs/elek-hr-20261122/{bena,it,vevo}/LELETEK.md`.

## Kimaradt / nyitott
- Levél naptár-mondata (HR: Szállás.hu nélkül) — kimaradt; elavult, mert az új személyes levélben (ADR-0462) nincs
  portál-felsorolás.
- Főoldal `?l=hr` honosítása (tartalmi döntés); Jogi adatok cím-előtöltése a kezdő rendelésből (jogi döntés).
- Elek-leletek, amik maradtak: konzol-keretes 404 anonim látogatónak, hamis szlug 200, két alcím (`apartmani-lavanda` vs
  `apartmanilavanda`), vásárlás utáni mock foglaltság-404, Szállás.hu az admin iCal-kártyán / varázsló-lépésben, „Jedinica:
  Mogućnosti smještaja”, 25 % nem látszik az alsó sávban/csomag-ablakban (HU-n is így), Barion-sáv szövege.
- Bábel-jegy: `~/rc-briefs/babel-orszag-reteg-3j-horvat-20261122.md` (hr 45 felirat + plurál-alakok + javítások).
