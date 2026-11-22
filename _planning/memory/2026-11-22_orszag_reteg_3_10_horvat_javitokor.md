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

## 2. land (3/10b) — HR ár-réteg + személyes levél minden országba
- **Landolva előtte:** 3/10 → origin/main `f3f7bb12`, ADR-0464.
- **HR ár-réteg** (`0149`, additív, dev DB-ben lefutott): az ÉLŐ magyar ársor egyszeri euró-másolata, 1 € = 373,22 Ft
  (MNB 2026-11-20). Alapdíj 5 €; modulok 1 € (szobák, vélemények, foglalás 2 €); csomagok Alap 7 / Ajánlott 13 /
  Teljes 18 €; többnyelvű 13/16/21 €; 2 hónap ingyen évesen; domain csomag-tartalom, küszöb 5 €, havidíj 3 €,
  kivásárlás 54 €, vállalás 1 hó; **.com** (4 899 Ft/év, HUF költség, plafon 6 200 Ft). Koordinátori döntés: a csomagár
  a közvetlen átváltás kerekítve — a kódban a csomag = alapdíj + modulok, ezért a szobák/vélemények 2 €.
- **Személyes levél**: `priceSentence` a pénznemmel és a régió csomag-domainjével (`packageDomainTld`), a személyes
  változat fordítás-hiánya → §C → kontroll-levél (magyar soha). A bekapcsolás (`assignVariants`) érintetlen.
- **Elek** (`~/rc-briefs/elek-hr-20261122b/vevo/LELETEK.md`): összegek mindenhol egyeznek (13 € lista, 9,75 € első díj,
  13 € következő terhelés); javítva: „0 Ft” a domain-lépésben, „pelda.hu” + magyar domain-hibák, Ugovori nyers értékek.
- **Nyitott (koordinátor/tulaj):** a személyes levél árszövege nem mondja ki, hogy csak az ELSŐ díj kedvezményes
  (HU-n is így, tulaj-szöveg); a domain „minden csomag része” vs „kisebb csomagnál 3 €/hó” mondat; három különböző
  citoviso-alcím; a dev DB magyar ársora/csomag-összetétele elavult az éleshez képest.
