# KONTRAKTUS — a 2. szoba felvételekor: mi volt az eddigi egység? (második kérdés a „Nem” után)

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés. A kiinduló szabály a tulajé: *„Tűnjön el ha nem kiadó az
egész egyben.”* A három felismerési útból (a) név-függő · (b) kérdés a 2. szoba felvételekor · (c) kapcsoló
a Szobák kártyán) a **(b)**-t választotta („B”), a terv képein „ok”. A futó foglalások kérdésére szintén
„B”: a rejtés ENGEDETT, és kimondjuk, hogy a foglalások érvényben maradnak.
Kapcsolódó: ADR-XXXX, ADR-0232 (az „egész szállás” választható egység — ezt egészíti ki), migráció `0078`.

- Terv: `plan.html` (önhordó, kattintható, a valódi admin-markupra épül; „Mobil 390 / Asztali” váltó;
  a „Hozzáadás” kiírja, mit mentene a rendszer)
- Képek: `shots/b-{mobile,desktop}-*.png`

**Hatókör:** `src/server/moduleConfigViews.ts` · `src/server/public.ts` · `src/tenant/units.ts` ·
`public/assets/ui/citui-admin.css` · `src/tenant/editor.ts`

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **A „Nem, csak külön egységeket adok ki” választás után nyílik a második kérdés** — CSS-sel, JS nélkül is.
   Az „Igen” ág változatlan.
2. Két válasz:
   - **„Ez az első szobám — nevet adok neki”** — név-mező nyílik; mentéskor az egység sima szoba lesz az új
     néven (naptár, képek, ár megmarad), és a vendég szobaként látja.
   - **„Nincs ilyen szobám — rejtse el”** — az egység megmarad, de a vendég NEM látja: se szoba-kártya,
     se választó-opció, se ár-sor, se aloldal. Nem törlődik; az „Az egész szállás egyben” kártyán
     visszakapcsolva újra látszik.
3. **Futó foglalás esetén a rejtés ENGEDETT**, és az opció alatt a VALÓDI szám áll (ha 0, a mondat sincs ott):
   „Ennek az egységnek N jövőbeli foglalása van — azok érvényben maradnak, csak új foglalás nem érkezhet rá.”
   A foglalás egy vendéggel kötött megállapodás; egy admin-kapcsoló nem bontja fel.
4. **Hiányos válasznál kimondott üzenet**, a mentés előtt (a böngészőben) ÉS a szerveren is (JS nélkül):
   - nincs második válasz → „Válassza ki, mi legyen az eddigi »…« egységgel.” (a név behelyettesítve)
   - **„Adjon nevet az első szobájának.”**
   - **„A két szoba neve nem lehet ugyanaz.”**
   A szerver ilyenkor SEMMIT nem ír (az új szobát sem hozza létre).
5. **A felismerés NÉV-FÜGGETLEN**: `site_unit.represents_whole` (0078) — „ez az egység maga a hely”.
   A vendég elől rejtve: `represents_whole AND NOT is_whole_property` — EGY predikátum (`isGuestVisibleUnit`,
   `units.ts`), minden vendég-oldali olvasó és a tulaj „nincs ára” figyelmeztetése is ezt hívja.
6. Meglévő bérlők: `represents_whole` = a mai `is_whole_property` — ami ma látszik, holnap is látszik.

## Mérve a terven

- „Nem” → a második kérdés látható; „Igen” → rejtett; „Ez az első szobám” → a név-mező megjelenik (228×37 px mobilon);
- a három hibaüzenet mindkét méreten; Enterrel küldve az üzenet NEM tűnik el (a mock első változatában eltűnt);
- 0 JS-hiba mindkét méreten.

## Ami NEM ennek a tervnek a tárgya

- A Szobák kártyán utólagos „ez mégis szoba” javítás — ha kell, később ráépíthető.
- Az egész szállás árának bekérése az „Igen”-nél — az admin-szál feladata.
