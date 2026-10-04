# Koordinátor — Éles hibák javítása: 16 tulaj-kérés, 18 SUB, minden landolva (2026-10-04)

**Session:** `cad90429` („CIT ➕ Éles Hibák Javítása”), munkafa `~/wt/citcad90429`. A tulaj telefonról küldte a
képernyőképeket; a saját fában három javítás készült, a többi SUB-ba ment (tulaj, 2026-10-04: „ez már menjen subba”).

## Saját munka (ebben a fában)
- `ece2b5e4` — a mock-összehasonlító tábla (`data-cit-mockcompare`) összecsukható `<details class="panel">`, alapból csukva.
- `7eaa2d1a` — Kapunyitás: a kapuszárnyak 1,05 s → 1,5 s (tulaj: „30%-kal csökkentsd”).
- `90c7dfc2` — Kapunyitás: a kapu nem nyílhat a hős saját másolatára. Ok: a portálok egymás fotóit közlik újra
  (Lovász apartman: szallaskeres + hovamenjek = ugyanaz a kép, más URL). 64 bites dHash (`src/generator/photoHash.ts`,
  `src/engine/samePicture.ts`, küszöb 12 bit; mérve: másolat 4, kivágás 18, más fotó 27–40), `Photo.dhash`, csak
  gate-opening generálásnál.

## SUB-ok (mind landolva, retire-ölve)
Citoviso-kredit ki a mockból (ADR-0318) · teszt-szám mentesítés [TESZT] leadeken (ADR-0319) · Névből növő B ·
Boltíves MINTA felül + transit nagyító · Parallax menüsáv + egy vágási szabály a fejléc-linkekre (ADR-0320) ·
Parallax pötty-nav · több e-mail-cím egy leadhez + előtöltés (ADR-0321) · pakli-galéria törlés · foglalás-sáv közös
kártya (booking-card) · dupla „Foglalás” cím + artdeco alcím/walk-through telefonsor · kézi szöveg-újraírás A+B
(ADR-0323) · lead-lista/lead-lap legerősebb mock-állapot + „✓ kiküldve” szűrő · lírai nyitórész + forrás nélküli
földrajz ki (ADR-0324) · SMS/MMS vizsgálat (kódhiba nem volt).

## Döntések (tulaj, 2026-10-04)
- Hosszkorlát a tulaj saját szerkesztőjében: NEM egységesítjük (ma 240 / 2000 / 12).
- A SUB-ok felület-kapu kivételei (pakli, lead-lista, dupla cím, földrajz): utólagos terv-kör NEM kell.
- Vékony forrásnál a líra általános marad (település + célközönség), kitalált táj nélkül.

## Infra
- A lemez 100%-on állt (21 MB szabad): a tulaj engedélyével törölve a három régi `elek/runs`
  (`citd29e2c1c` 14 GB, `citfd769e2b` 6,8 GB, `cita94801d0` 3,7 GB) + `npm cache clean` → 25 GB szabad.
- A deploy-koordinátor fő sessionként indult („CIT ➕ Deploy-koordinátor: minden élesbe”, `afd12c3b`); a SUB-jel
  levétele négy helyen kell (marker, subnums, watchdog-state cím, PUT) — memória `feedback_owner_main_session_not_sub`.

## Élesítés (a deploy-koordinátoré, külön engedéllyel)
- Élesen `prod/20261004-1516` (`33e1b3fc`) már a mai munka nagyját viszi; hátravan `e4242964`, `afdaa1b4`, `bc222e7f`.
- Éles `.env`: `OUTREACH_TEST_PHONES=06305161631` + console/public restart (ADR-0319).
- Deploy után: a Kerekerdő vendégház (f44d1550-…) mockjának újragenerálása.

## Nyitva
- Dev: a teszt-szám a 20 dev leaden csak az Éden üdülőház leiratkozásának visszavonása vagy [TESZT] előtag után oldódik.
- A lírai földrajz-szabály szólistás: új tájnév csak felvétel után jelez — deploy után figyelni.
