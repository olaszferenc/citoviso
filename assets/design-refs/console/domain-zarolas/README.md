# Webcím — hiteles elérhetőség + zárolásos fizetés — JÓVÁHAGYOTT TERV (ADR-XXXX)

**Tulajdonosi döntés, 2026-09-27: „A” mechanizmus (zárolás) + „A1” megjelenés (idővonal).**
Ez a mappa a megvalósítás **KONTRAKTUSA** (§2b 5.). A korábbi `console/domain/` terv
(ADR-0078, B változat) háromlépéses szerkezete és a jelenlegi-cím sáv él tovább; ez a
kontraktus annak az **elérhetőség-jelölőjét, az Áttekintés pénz-blokkját, a 3. lépés
állapot-listáját és a sikertelen-képernyőt** írja felül.

**Hatókör:** `src/server/adminViews.ts` · `src/email/domainEmail.ts`

| fájl | mit rögzít |
|---|---|
| `JOVAHAGYOTT-webcim-zarolas-A1.html` | a kattintható terv (Mobil 390px / Asztali váltó) |
| `A1-step1-*.png` | 1. lépés: hiteles jelölők + a forrás-mondat |
| `A1-step1-err-phone.png` | a regisztrátor nem válaszolt → nem kérhető, „Újra” |
| `A1-review-*.png` | 2. lépés: zárolás-blokk + háromlépéses idővonal |
| `A1-ok-*.png` | 3. lépés, siker: zárolva → megvéve → terhelve → beállítás |
| `A1-fail-*.png` | 3. lépés, bukás: a zárolást feloldottuk, nem fizetett semmit |

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Az elérhetőség HITELES.** A jelölő a domain-regisztrátor saját válasza, nem sejtés.
   Négy állapot: **„Szabad”** (kérhető) · **„Foglalt”** · **„Nálunk nem igényelhető”** ·
   **„Nem sikerült ellenőrizni”**. Csak a „Szabad” választható; ami nem ellenőrizhető,
   az nem kérhető (a regisztrátor kiesése nem lehet „szabad”).
2. **A forrás ki van mondva**, és csak akkor, ha igaz (van „Szabad” a listán): „Az
   elérhetőséget közvetlenül a domain-regisztrátornál ellenőriztük, most.”
3. **Az Áttekintés friss ellenőrzéssel nyílik** — **„Szabad — most ellenőrizve”** —, és
   fizetni CSAK ilyen névre lehet. Foglalt / nem igényelhető / nem ellenőrizhető névnél a
   lap megmondja, miért, és nincs fizetés-gomb. A rendelés elküldésekor a szerver **még
   egyszer** megkérdezi a regisztrátort; a gomb addig ezt mondja: „Még egyszer ellenőrizzük
   a nevet…”.
4. A pénz-sor: **„Most zárolunk”**, alatta **„csak sikeres regisztráció után terheljük”**.
5. A garancia-doboz: **„Csak akkor fizet, ha a név már az Öné”**, három lépéssel:
   zároljuk → azonnal megvásároljuk → csak sikeres vétel után terheljük (ha nem sikerül,
   feloldjuk, a vállalás sem indul el). Gomb: **„Tovább a fizetéshez (zárolás)”**.
6. **A viselkedés IGAZ:** a fizetés Barion `DelayedCapture` (az összeg a vevő KÁRTYÁJÁN
   blokkolódik — NEM `Reservation`, az azonnal terhel, ADR-0228); siker → `Payment/Capture`
   + számla; bukás → `Payment/CancelAuthorization`, számla nincs, a hűségidő nem indul. Csak
   bankkártya. A feloldás ideje „a bankjától függően néhány munkanap”.
7. **3. lépés — siker:** Összeg zárolva → Megvásároltuk a nevet → Most terheltük a
   kártyáját → Beállítjuk a címet és a biztonsági tanúsítványt (a `.hu`-nál „néhány nap”).
8. **3. lépés — bukás:** **„A zárolást feloldottuk — nem terheltünk semmit”**, alatta a
   piros doboz: **„Nem fizetett érte semmit.”**, és a **„Másik név választása”** gomb az 1.
   lépésre visz. A levél ugyanezt mondja.
9. **Mobil ÉS asztali** — asztalon az Áttekintés két hasábos (feltételek balra, garancia +
   gomb jobbra), mobilon egy oszlop.

## Kötő horgony
- `adm-dguar`
- `adm-dtl`
- `adm-dsrc`
- `adm-dres--bad`
- `adm-dtwo`

## Nem része a tervnek
- A lead-konfigurátor (első megrendelés) elérhetőség-jelölője — az ma is a régi, előzetes
  DNS/RDAP ellenőrzést használja; külön kör.
- Az ADR-0078 előtti, azonnal terhelt domain-rendelés bukása — annak szövege marad
  („egy másik névre fordítjuk”), mert ott valóban terheltünk.
