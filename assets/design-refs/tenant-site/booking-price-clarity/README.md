# A vendég a döntés PILLANATÁBAN látja, mi van az árban — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-14, tulajdonosi választás: **„A" változat — nyitott bontás.**
A tételsor MINDIG látszik (szállásdíj × éjszaka · mi van benne · összesen), és **külön dobozban**,
ami a **helyszínen** fizetendő. *„A vendég ne a végén szembesüljön az IFA-val."* ·
**Hatókör:** `assets/runtime/cit-runtime.js`, `src/engine/moduleSections.ts` ·
**Kapcsolódó:** Elek FK-007 (B8 köteg), 03-INVARIANTS §B.17 (a felület ne állítson valótlant),
ADR-0110 ⑤/⑦ (jogalap), ADR-0114 (az „egész szállás" mint fölérendelt egység).
**Őr:** `scripts/booking-price-clarity-check.mts`.

`foglalas-ar-A.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.**

## Miért létezik

Mérve 2026-09-14-én a valódi motor kimenetén:

- Az ár a beadás előtt egyetlen szám volt magyarázat nélkül:
  `Alapár: 3 éj × 32 000 Ft = 96 000 Ft / Összesen: 96 000 Ft`. **Sehol nem derült ki**, hogy az
  IFA, a takarítás vagy bármilyen helyszíni különbözet benne van-e.
- Az ár **ALAPJA** („Egység") **csak a beadás UTÁNI nyugtán** jelent meg — vagyis a vendég azután
  tudta meg, hogy a létszám nem számít, hogy már elküldte a kérést.
- A nyugta **kódot adott, teendőt nem**: hivatkozás és határidő igen, de semmi arról, mi jön most.
- A naptár jelmagyarázata **11,84 px, kontraszt 3,99** (AA-küszöb 4,5), a „szabad" minta **fehér a
  fehéren** egy halvány kerettel.
- A foglalás-szekció az **egyetlen** modul-szekció, ami **cím nélkül** indul: az éles generált
  lapon **100 px üres sáv** áll a kártya fölött, mindkét méreten — ott, ahol minden más szekció a
  `<h2>`-jét hordja.
- Egy-egységes szállásnál (ADR-0114 „A szállás egésze") a „Szobák, apartmanok" szekció **egyetlen
  apró kártyát** mutat egy rácsban — 229 px magas szekció egy „6 fő" felirattal.

## Amit a terv KÖT

1. **A bontás MINDIG nyitva van** — nincs mögötte kattintás. Sorok: szállásdíj (éj × egységár),
   „mi van benne" (takarítás/ágynemű), majd **„Összesen a szállásért"**.
2. **Az ALAP a beadás ELŐTT ki van mondva:** hogy az ár a teljes szállásra vagy főre szól, és hogy
   **a létszám befolyásolja-e**. Nem a nyugtán derül ki.
3. **A helyszínen fizetendő KÜLÖN dobozban áll**, vizuálisan elválasztva az „Összesen"-től — mert
   nem része a szállásdíjnak. A doboz kimondja, hogy a szállásadó szedi be.
4. ⛔ **KITALÁLT SZÁM SEHOL (§B.17).** Az IFA összege és a „mi van benne" szöveg a **tulaj
   modul-beállításából** jön (tulajdonosi döntés, 2026-09-14). **Üres mezőnél a lap NEM SZÁMOL
   IFA-t** — csak kimondja, hogy a helyszínen idegenforgalmi adó fizetendő. Egy szám, amit nem a
   tulaj adott meg, nem jelenhet meg.
5. **A nyugta TEENDŐT ad, nem csak kódot.** Számozott lépések: mikor jön a válasz, **melyik
   címre**, mi történik, ha nincs válasz, és hogyan lehet mégis szólni.
   ⛔ **A nyugta csak azt ígérheti, ami LÉTEZIK.** Mérve: állapot-lap **nincs**, és a
   `/foglalas/<token>/lemondom` link **csak visszaigazolt** foglalást mond le (`cancelRequest`:
   `status !== "accepted"` → elutasít). Ezért a nyugta a lemondó linket **a visszaigazoláshoz
   kötve** említi, a függő kérés visszavonására pedig a **szállásadó elérhetőségét** adja.
6. **A nyugta a beadás után a KÉPERNYŐN van.** (Ez már él — lásd `booking-outcome-truth-check.mts`
   C szakasz; a terv csak megerősíti, hogy kötelező.)
7. **A jelmagyarázat olvasható:** nagyobb betű, AA feletti kontraszt, és **minden mintának kerete
   van** — színvakon is elkülönül. A „szabad" nem lehet fehér a fehéren.
8. **A foglalás-szekciónak CÍME van**, mint minden más modul-szekciónak — az a 100 px nem marad üres.
9. **Egy-egységes szállásnál nincs egy-kártyás rács.** Az „egész szállás" teljes szélességű
   panelt kap: leírás + a valódi adatok (férőhely, hálószoba, fürdőszoba, konyha). ⛔ Csak azok a
   cellák jelennek meg, amelyekhez van adat — üres cella nem kerül ki.
10. ⛔ **A hírlevél-szekció NEM jelenik meg** (tulajdonosi döntés, 2026-09-14). Mérve: az űrlap a
    `/api/hirlevel` címre küldött, ami a nyilvános kiszolgálón **nem létezik**, és feliratkozó-tábla
    sincs — a vendég beírta a címét, és elhagyta az oldalt. A modul (490 Ft/hó) **lekerül a
    kínálatból**, amíg a végpont, a tábla, a megerősítő levél és a leiratkozás el nem készül.
    Addig **hozzájárulás-pipa sem kerül rá**: nem kérünk hozzájárulást olyasmihez, amit nem
    tudunk teljesíteni.

## Mit mérünk rajta

`scripts/booking-price-clarity-check.mts` — a valódi motor kimenetén, böngészőben:
① kitöltött IFA-mezőnél a bontás mutatja a helyszíni tételt, ② **üres mezőnél NINCS szám**, csak a
mondat, ③ az alap („a létszám nem befolyásolja") a beadás ELŐTT látszik, ④ a nyugta lépéseket ad,
és **nem** ígér állapot-lapot vagy függő-kérés-visszavonást, ⑤ a jelmagyarázat kontrasztja ≥4,5 és
minden mintának van kerete, ⑥ a foglalás-szekció címmel indul, ⑦ egy egységnél nincs egy-kártyás
rács, ⑧ a generált lapon **nincs** hírlevél-blokk. **Piros önteszt** mindegyik ághoz.
