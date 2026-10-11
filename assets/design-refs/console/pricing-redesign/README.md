# Árazás és értékesítés — teljes redesign — JÓVÁHAGYOTT TERV (A — egy oldal)

**Jóváhagyva:** 2026-10-11, tulaj, három körben: (1) csomag × modul húzással, A — oszlopok
(„legyen az A”); (2) „teljes redesign a nyitóoldal és report felület szerint”; (3) elrendezés:
„A verzió” (egy oldal, szakasz-ugrókkal — a B „fülek” elvetve).
**Kapcsolódó:** ADR-XXXX (ez a döntés), ADR-0109 (saját cím — a ③ „nincs ingyen-ág” itt
paraméterré válik), ADR-0103 (regisztrátor), ADR-0192 (modul-függőségek), ADR-0233 (konzol-keret),
ADR-0322 (riport-nyelv), ADR-0342/0354 (próba), ADR-0346 (kupon), ADR-0285/0286 (lead-ajánlatok).
**Felülírja:** `pricing-sales/` 2. pont (kétoszlopos modulrács, „csík nélkül”) — a modulok tábla
lettek; a 3–6. pont (kapcsoló · élő · ár, leállítás jelentése, régió, §C-pipa) ÉL.
**Hatókör:** `src/console/views.ts` · `src/console/pricingPage.ts` · `src/console/server.ts`

`plan.html` a mock (méret- és téma-váltóval; a B elrendezés gombja a fájlban maradt, de NEM köt).
A `plan-A-*.png` a jóváhagyott állapot. **Ez a README a kötő szöveg, a mock a kép.**

## Miért létezik

A tulaj a pilot-statisztikák alapján azt gyanítja, hogy több érdeklődő a citoviso-aldomaintől
riadt vissza, ezért a saját domaint csomag-tartalommá akarja tenni. Ehhez az árazásnál hiányzott:
(a) a csomagok összetétele (kódban volt, `PRESETS`), (b) a domain végződésenkénti adata,
(c) hogy a próbázó melyik csomagot kapja. A tulaj kérése: „a 3 csomaghoz hozzáadható /
eltávolítható legyenek a modulok, beleértve a domaint is (de a domain részletei külön paraméter)”.
A régi lap egy 3 200 px hosszú, panel nélküli űrlap volt; a konzol többi része már a
Linear-kereten (ADR-0233) és a riport panel-nyelvén (ADR-0322) beszél.

## Amit a terv KÖT

### Keret és fej
1. **Konzol-keret** (ADR-0233): oldalsáv (CRM › Árazás, mellette az „N/M eladó” jelvény), fejléc
   útvonallal, ⌘K, téma-váltó. Világos ÉS sötét mód, csak `--citui-*` tokenekből.
2. **Fej:** cím, egy mondat („az árazás egyetlen forrása”), jobbra a véglegesítés-jel
   (zöld: véglegesítve · borostyán: nincs véglegesítve).
3. **Piac-fülek** a riport fül-nyelvén: Magyarország · HUF / Globális · EUR. A fül a régió
   (`/pricing?region=`). Az ország-réteg később jön.

### Áttekintés
4. **Három összesítő kártya** (a nyitóoldal widget-nyelvén): **Csomagok** (nagy szám: az Ajánlott
   havidíja; sorok: Alap, Teljes, éves kedvezmény) · **Modulok** (nagy: eladó / összes; sorok:
   csomagon kívül, leállítva, saját domain: csomagban | felár) · **Ajánlatok és próba** (nagy: a
   bemutatkozó %; sorok: döntés-segítő, próba, kupon). Mentetlen módosításra is élőben frissülnek.
5. **„Figyelmet kér” lista** (a nyitóoldal mintája): élőben számolt problémák, sorra kattintva a
   szakaszhoz ugrik. Legalább: leállított modul egy csomagban · domain csomagban, de nincs
   „csomagban ingyen” végződés · nincs kínált végződés · nincs mért beszerzési ár · nincs
   véglegesítve. Üresen: „Minden rendben — nincs teendő ezen a piacon.”
6. **Szakasz-ugrók** (ragadós chip-sor): Csomagok · Modulok · Alapdíj · Kupon · Saját domain ·
   Lead-ajánlatok · Ingyenes próba · Véglegesítés. Mentetlen szakaszon borostyán pötty.

### Szakaszok (panelek, a riport kártya-nyelvén; mindegyik alján egy „Így fut:” mondat)
7. **Csomagok — húzással.** Fent „Csomagon kívül” sáv (külön vehető modulok), alatta három oszlop
   (Alap · Ajánlott · Teljes; mobilon egymás alatt). Oszloponként: név, havidíj, „N modul · éves: X”,
   az öröklött modulok halványan („Minden az Alapból / az Ajánlottból”), a saját modulok
   ×-szel, a saját-cím sor (benne | +díj/hó | nem választható), és a „Húzd ide a modult” zóna.
   - Húzás egérrel és ujjal (a képernyő szélén automatikusan görget), vagy koppintás a pirulára,
     majd a csomagra. A × és a „Csomagon kívül” sávba ejtés kivesz.
   - Az egymásra épülés szerkezeti: egy modul pontosan EGY csomagban „saját” (a legalacsonyabban),
     a felette lévők öröklik. Magasabb csomagba húzva az alacsonyabbakból kikerül.
   - **ADR-0192 (a mockon túl, kötelező):** kemény függőség nem szakadhat el. Egy modul
     behúzásakor a hiányzó kemény függőségei VELE kerülnek ugyanabba a csomagba (mint a kosárban,
     ADR-0192 ④.1); kivételkor a rá épülők is kikerülnek — mindkettő kimondva a visszajelzésben.
   - A gerinc (érdeklődés-CTA) zárolt, mindig az Alapban.
   - A leállított modul áthúzva marad a csomagban, és nem számít az árba (+ „Figyelmet kér” sor).
   - A **Saját domain** is pirula. Ahol benne van: ott a saját címnek nincs havidíja.
8. **Modulok — tábla** csoportonként (Amit bemutat · Elérhetőség · Extrák): modul · csomag
   (melyik csomagtól) · élő előfizetés · felár · eladó-kapcsoló. A gerinc: „gerinc — az
   alapdíjban”, „mindig”. A leállítás jelentése VÁLTOZATLAN (pricing-sales 4.). Mobilon soronként
   két sor (név; csomag · élő · felár · kapcsoló). A Többnyelvű sáv-árak (ADR-0128) itt maradnak.
9. **Alapdíj és éves fizetés** | **Kupon** — asztali nézetben egymás mellett.
10. **Saját domain.** Kapcsoló: „Ingyen domain csomagban” (kikapcsolva a domain-pirula egyik
    csomagba sem tehető, mindig felár). Mezők: belépési küszöb (0 = nincs küszöb), hűség,
    kivásárlás. **Végződés-tábla** (piaconként): végződés · kínáljuk · beszerzés / év (nettó, mért
    dátummal, „Lekérdezés” gomb a regisztrátortól) · max. beszerzés · havidíj csomagon kívül ·
    „Csomagban ingyen” · törlés. Új végződés felvehető (normalizálva: kisbetű, pont elöl, csak
    betű). Mért ár nélkül, vagy ha a beszerzés a plafon felett van, a végződés nem kínálható.
    Alatta a nem kikapcsolható **„Kötelező platform-cím:”** jegyzet (`<név>.citoviso.com`, ÁSZF).
11. **Lead-ajánlatok** | **Ingyenes próba** — egymás mellett. A próbánál új mező: **„A próbázó ezt
    kapja”** (Teljes · Ajánlott · Alap csomag).
12. **Véglegesítés** — a §C-pipa változatlan jelentéssel.

### Mentés
13. **Ragadós mentés-sáv** alul: „● N szakaszban mentetlen változás” · Visszaállítás ·
    „Mentés — {piac}”. Hibás mező mellett nem ment (a meglévő szakasz-validációk élnek), és a
    szerver is újra-ellenőriz: érvénytelen csomag-összetétel (függőség, ismeretlen modul, a gerinc
    nem az Alapban) vagy végződés-sor esetén SEMMIT nem ír.

## Amit NEM köt
- A mock minta-számai (élő darabszámok, a .eu/.com plafon és havidíj).
- A Globális piac modul-felárai: a felár-tábla globális (HUF) marad, a nem-HU fülön a felár-tábla
  helyett a meglévő utalás áll.
