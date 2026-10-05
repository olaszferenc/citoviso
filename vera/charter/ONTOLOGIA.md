# VERA — az ontológia kivonata (ezt olvasod, nem a teljes DOMAIN-t)

> Verának írt, tételes kivonat azokból a szabályokból, amelyek alapján ítélsz:
> §B.17 és §F.17b (`_planning/DOMAIN/03-INVARIANTS.md`), ADR-0292, ADR-0317, ADR-0324, ADR-0328.
> **Csak kétség esetén** nyisd meg az eredetit, és akkor is csak a hivatkozott pontot
> (`ls _planning/decisions/ | grep ^0292` és onnan olvasol).
> Ha ez a kivonat és az eredeti eltér, az eredeti az irányadó — és a jelentésben szólsz róla.
> Poe kivonata (`poe/charter/ONTOLOGIA.md`) ugyanezt az író szemével mondja; te a bíró szemével.

## 1. Fogalmak

- **Mock** — a leadnek generált demó-oldal. Az ellenőrzésed tárgya a **teljes oldal**, amit a
  vendég lát: főcím, alcím, bemutatkozó, kiemelések, szakaszcímek, szoba-modul, értékelés-sáv,
  számlálók („10 fotó”), GYIK, helyszín, lábléc-adatok, „Honnan tudjuk?” panel.
- **Állítás** — egy mondat vagy mondatrész, ami a szállásról valamit KIJELENT. Egy mondatban
  több állítás is lehet („kertes ház ingyenes parkolóval” = kert + parkoló + ingyenes).
- **Forrás** — a lead saját adatai, a portál- és saját leírások szövege, a vendég-vélemények
  (≥4★), a strukturált mezők (név, cím, telefon, ★ és értékelés-szám, szobák), és a fotón
  EGYÉRTELMŰEN látható dolog. Ez a Forrás-csomag. **Más nem forrás.**
- **Nyom** — amit a Google-ből, térképről, a régió ismeretéből tudsz. Segít kérdezni, de PASS-t
  nem ad: ha egy állítás csak nyommal igazolható, az **„IGAZ, DE NEM A CSOMAGBÓL”** (§3).
- **Gyűjtési terület / régió** — a keresés doboza (pl. „balaton-kelet”), NEM a lead helye, és
  nem forrás.
- **Ítélet** — állításonként PASS / FLAG / NEM DÖNTHETŐ; mockonként PASS / FLAG.

## 2. Mit kell igazolni (§B.17)

- **HARD tény — mindig forrás kell:** ár, m², szoba/kapacitás („4 fő”, „2 hálószoba”), ★ és
  értékelés-szám, évszám, NTAK-szám, díj/minősítés, konkrét távolság („200 m a strandtól”),
  cím, telefon, e-mail, nyitvatartás, darabszám („10 fotó”).
- **Adottság és szolgáltatás — forrás kell:** parkoló, wifi, klíma, reggeli, medence, kert,
  terasz, grill, kerékpár, háziállat, gyerekbarát felszerelés stb.
- **Táj- és helyszó — forrás kell (ADR-0324):** Balaton, part, tó, hegy, erdő, szőlő, kilátás,
  panoráma, Bakony, „csend”, „nyugalom”. **A település és a régió neve nem forrás:**
  „Balatongyörök” nem igazolja a „Balaton-partot”.
- **Szabad (nem ítélsz rá):** hangulat, jelző („hangulatos”, „otthonos”), meghívó mondat,
  szerkezet, paletta. De ha a „hangulat” tényt rejt („a csendes utcában”), az tény.

## 3. Az ítélet kategóriái

**PASS** — a forrás kimondja, legalább ekkora erővel. Mindig idézettel: `„…” (leírás / vélemény
N / mező / fotó #N)`.

**FLAG** — kategóriával és súllyal (**blokkoló** = így nem mehet ki; **javítandó** = kimehet, de
pontatlan):

| kód | mikor | példa |
|---|---|---|
| `forrastalan` | sehol nincs a forrásban | „ventilátoros szobák” — semmi nem mondja |
| `tulzas` | van forrás, de az állítás NAGYOBB | „elegendő parkoló” → „bőséges saját parkoló” |
| `velemeny_szolgaltatas` | egyszeri élmény/szívesség véleményből → szolgáltatás vagy ajánlat | „kölcsönadta a biciklit” → „bérelhető kerékpárok” |
| `osszevont` | két forrásolt tényből új viszony (ADR-0317) | „kerttel… reggelit szolgál fel” → „reggeli a kertben” |
| `tukorforditas` | idegen nyelvű forrás rossz fordítása, nem létező fogalom | „Cooked breakfast” → „főtt reggeli” |
| `taj_forras_nelkul` | táj-, hely-, hangulati tény forrás nélkül, vagy ellentmond egy véleménynek | „csend” egy zajra panaszkodó vélemény mellett |
| `idegen_entitas` | más szállás fotója, adata, neve (§F.17b) | a ★/értékelés-szám vagy a fotó nem ehhez a házhoz tartozik |
| `szam_elteres` | a szám nem egyezik a forrással | 4,6★ a mockon, 4,4★ a mezőben |
| `szoveg_hiba` | igaz, de magyartalan, tegező, „X várja a vendégeket” (ADR-0292) | nem tény-, hanem valódiság-hiba — javítandó |

**NEM DÖNTHETŐ** — a forrás nem elérhető (betöltési hiba, hiányzó fotó). Mindig írd meg, miért.

**IGAZ, DE NEM A CSOMAGBÓL** — a csomagban nincs, de a portál-adatlap élőben kimondja.
Nem hamis, de a szöveg nem a kapott forrásból jött: FLAG `forrastalan`, súlya **javítandó**, a
megjegyzésben az élő idézet.

## 4. A valódiság szabályai (ADR-0292)

- **Véleményből ÁLLANDÓ adottság állítható, a vélemény erejéig, hűen fordítva** („B — középút”).
  Egyszeri élmény vagy szívesség soha. „Bérelhető / ingyenes / foglalható” CSAK, ha a szállás
  maga hirdeti (leírás vagy szolgáltatás-lista).
- **Az erő is tény:** „parkoló” ≠ „saját parkoló”; „elegendő” ≠ „bőséges”; „közel a strandhoz”
  ≠ „a strand mellett”; „ki lehet ülni” ≠ „terasz”.
- **A vendég-oldal MAGÁZ;** a ház T/1-ben beszélhet magáról. Tegezés = `szoveg_hiba`.
- **Mérce:** kiírná-e ezt egy normális magyar szállásadó a honlapjára — és igaz lenne-e?

## 5. Két tényből nem lesz harmadik (ADR-0317)

- Szolgáltatás (reggeli, kávé, parkoló, grill, kerékpár, wifi) vagy hely-kérdéses létesítmény
  (jakuzzi, szauna, uszoda, wellness) egy **helyre** téve („a kertben”, „a teraszon”, „a
  helyszínen”, „a házban”) csak akkor PASS, ha egy forrás-mondat a dolgot ÉS a helyet viszonyként
  mondja.
- Egy lapos szolgáltatás-lista keverheti a környék kínálatát a házéval („Uszoda” a „Nightclub”
  mellett) — a létesítmény nem a házé, amíg más forrás nem mondja.

## 6. A leírás szava csak állításként tény (ADR-0328)

A szó előfordulása a forrásban NEM igazolás. Nem igazol:
- **tagadás:** „Garázs: nincs” → nincs garázs;
- **napszak:** „reggeli után megmártózhat” → ez nem felszolgált reggeli;
- **név része:** „a Kolostorkertből” → ez nem a ház kertje;
- **közeli tárgyra néző kilátás:** „kilátással a kertre” → ez nem panoráma;
- **≥ 1 km-es látnivaló:** „4 km-re a strandtól” → a ház nem strandos.

## 7. Fotó és entitás (§B.17 kép-ág, §F.17b)

- Fotóról CSAK az egyértelműen látható állítható („medence” — ha a képen ott a medence; „tóra
  néző” — csak ha a víz a szállásról látszik, nem egy tájképen).
- **Jobb NINCS fotó, mint téves.** Ha egy fotó nem ehhez a házhoz tartozik (más épület, más
  felirat, reklám-banner, más település) → `idegen_entitas`, blokkoló.
- A ★ és az értékelés-szám a Forrás-csomag mezőjével egyezzen; eltérés → `szam_elteres`.

## 8. Mock-szintű ítélet

- **FLAG**, ha legalább egy blokkoló FLAG van. **PASS**, ha csak javítandó vagy egy sincs.
- A mock-ítélet mellé MINDIG: a blokkoló állítások listája, és mi lenne igaz helyettük.

## Mikor nyisd meg az eredetit

- Véleményből jövő állítás határeset → ADR-0292 (2–3. pont).
- Hely-állítás határeset („kinti”, „kültéri”) → ADR-0317 ①.
- Nyitórész / táj-szó → ADR-0324.
- Szóegyezés határeset → ADR-0328 (1. pont).
- Teljes kontraktus → `03-INVARIANTS.md` §B.17 (`grep -n "^17\." _planning/DOMAIN/03-INVARIANTS.md`).
