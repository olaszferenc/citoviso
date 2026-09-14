# Fagyasztott tulaj-admin, 2. kör: „Rendezés-képernyő" — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-14, tulajdonosi választás **három bemutatott változat képei
alapján**: a **„B — Rendezés-képernyő"**. A tulaj szava:

> „Fagyás alatt a lap **EGY dologról szóljon**: tartozás + hátralévő idő nagyban,
> a modul-lista **CSAK OLVASHATÓ** (a kapcsolók kikerülnek)." · „a »Következő számla«
> sor fagyás alatt **NEM állhat ott a tartozás mellett ugyanazzal a számmal** —
> pláne nem MÚLTBELI dátummal."

**Kapcsolódó:** ADR-0119 (①–⑧) és annak kontraktusa `../freeze-state/` —
ez a mappa **kiterjeszti, nem váltja fel**. Elek FK-006a (2026-09-13).
**Elvetett változatok:** A („kísérő ragadós fizetés-sáv"), C („tételes számla").

**Hatókör:** `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css`

`freeze-state-B.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** Ami itt
viselkedés, azt a kódnak produkálnia kell; a kész felületet ehhez mérjük (ui-shot,
mobil 390 + asztali), és őr kényszeríti ki.

---

## Miért létezik — mérve, nem tippelve

Az ADR-0119 ⑧ javította, hogy fagyás alatt egyetlen kártya sem ígér elérhetőséget.
**Ugyanazon a képernyőn** viszont egyetlen sort sem mozdult a többi lelet. A renderelt
`/admin?tab=modulok` lapon, fagyasztott előfizetéssel (2026-09-14):

| Mit | Mért érték |
|---|---|
| Két összeg egy kártyán | „Rendezendő tartozás **10 270 Ft**" **és** „Következő számla (**2026. 08. 10.**) **10 270 Ft**" — ugyanaz a szám, kétszer. A dátum a `periodEnd`, a fagyás 10 nappal KÉSŐBB történt, vagyis a „következő" számla dátuma a MÚLTBAN van. |
| Fizetés vs. lemondás | **11× „Kikapcsolom"** / **1× „Befizetem"** |
| Eladási cimke megvett modulon | 13× „+490 Ft/hó", ebből **11 a SZÜNETELŐKÖN** |
| Elakadt terhelés | 1× „Megbízás visszavonása", **0×** újrapróbálás vagy kártyacsere |
| Üzenetek fül | **0×** bármelyik fagyás-szó a teljes lapon |
| Belépő fül (`attekintes`) | 0× tartozás, 0× összeg, 0× fizetés-gomb *(a szöveg-fele már javítva, lásd ADR-0119 ⑧ utáni kör)* |

**A vezérgondolat (tulajdonosi megfogalmazás):** ez a képernyő akkor találkozik a
tulajjal, **amikor pénzt kérünk tőle**. Ma a legnagyobb felületet a lemondás kapja,
a fizetés útja alig látszik, és nem derül ki, mennyit kell fizetni.

---

## Amit a terv KÖT (elvárt viselkedés — erre kerül őr)

### ① EGY képernyő, EGY pénzösszeg
Fagyás alatt a lapon **pontosan egy** pénzösszeg szerepelhet döntési pozícióban:
a **rendezendő tartozás**. ⛔ A „Következő számla" cella fagyás alatt
**nem írhat ki összeget**, és **nem írhat ki dátumot, ami a mai napnál korábbi**.
Helyette a cella felirata **„A rendezés után a következő számla"**, az értéke egy
DÁTUM, alatta pedig **„Addig nincs új számla — előbb a fenti tartozás rendezendő."**

> Ez a tulaj kimondott döntése. A hibaosztály: `feedback_two_divisors_on_one_row`,
> `feedback_one_rule_two_copies` — két igazságforrás egy képernyőn.

### ② A tartozás a lap legnagyobb száma, a HATÁRIDŐVEL együtt
Saját, teljes szélességű blokk a lap tetején (`.fz-hero`), amiben:
- **„Rendezendő tartozás"** címke (nagybetűsre a stíluslap alakítja) + az összeg a képernyő legnagyobb betűmérettel
  szedett száma, alatta az időszak, amiért jár;
- **egyetlen kitöltött gomb**: „Befizetem — {összeg}";
- **mellette/alatta a hátralévő idő**: nap-szám + haladás-sáv + a záró dátum
  („{closesOn}-ig rendezhető. Utána az előfizetés lezárul, és a honlap lekerül.").
  A határidő az ADR-0119 ② T+30-ából jön, **nem újraszámolt hasonmás**.

**Asztali:** kétoszlopos (pénz | határidő). **Mobil:** egymás alatt, a **pénz és a gomb
ELÖL**, a határidő utána. ⛔ A tulaj telefonon nézi.

### ③ A modul-lista fagyás alatt CSAK OLVASHATÓ
- ⛔ **Nincs ár-cimke** („+490 Ft/hó") a szünetelő, MÁR MEGVETT modulokon — eladási
  felirat olyasmin, amit a tulaj már fizet.
- ⛔ **Nincs be/ki kapcsoló** a modul-sorokon (a „Kikapcsolom" felirat nem jelenhet meg).
- A lista **azt mondja meg, mi kapcsol vissza a befizetéssel**: fejléc
  *„Mi kapcsol vissza a befizetéssel"*, a honlap + a modulok felsorolva, és egy mondat,
  ami kimondja, hogy ezek a **tartozás tételei, nem új vásárlás**.
- A modulok együttes díja összegként kiírható — de a fenti ① szerint nem döntési
  pozícióban: a végösszeg-cella helyén **„ez a fenti rendezendő tartozás"** áll,
  szám nélkül, mert az UGYANAZ a pénz, tételekre bontva.

### ④ A kijárat NEM záródhat be
Az ADR-0119 ⑥ érintetlen: a bolt zárva (új modul nem vehető fel, a kapu az íráson),
de a **lemondás és a lemondás visszavonása NYITVA MARAD** — az kijáratot venne el.
A terv annyit tesz, hogy a lemondást a lap **aljára, egy csukott `<details>` mögé**
teszi: elérhető, de nem ez a képernyő fő üzenete.

### ⑤ Az elakadt terhelésnek van ELŐREVIVŐ művelete
A megbízás-blokk eddig egyetlen gombot kínált: a feladást („Megbízás visszavonása").
Mellé kerül egy előrevivő művelet — **„Másik kártyával fizetek"** —, a visszavonás
pedig halk szöveg-linkké válik, és **kimondja**, hogy **„— a rendezetlen díj ettől
nem szűnik meg."**

> ⚠️ **Eltérés a bemutatott mocktól, szándékosan.** A mockban két gomb volt:
> „Újrapróbálom ezzel a kártyával" és „Másik kártyát adok meg". **Az újrapróbálás
> NEM készült el**: nincs szerver-útvonal, ami egy terhelést újra megkísérelne, és
> egy gomb, ami némán nem csinál semmit, rosszabb a hiánynál. Ami valóban előrevisz:
> a fizetési link — a tárolt kártya-megbízást a kártyatársasági szabály szerint
> csak egy 3DS-sel megerősített, ügyfél-kezdeményezett fizetés adhatja meg újra,
> tehát az OTT megadott kártya lesz az új megbízás. Ezt mondja a gomb, egy hamis
> újrapróbálás helyett. Ha az újrapróbálás kell, az külön kör (szerver-oldali munka).

### ⑥ A felfüggesztés MINDEN fülön megjelenik
Az ADR-0119 ① hatálya a **teljes admin**, nem a Modulok fül. A belépő (`attekintes`)
és az Üzenetek fül is a fagyás-blokkal nyit (az Üzeneteken kompakt alakban:
a határidő-oszlop elrejtve, kisebb összeg-méret).

### ⑦ Telefonon LÁTHATÓ, nem csak jelen van
A fagyás-blokk 390×844-en **első festéskor olvasható** — nem takarja a fix alsó
fülsáv (`.adm-side`, mobilon `position:fixed;bottom:0`). Mérés: `elementFromPoint`
a blokk összeg-során, **nem** teljes-lapos képről ítélve
(`reference_fullpage_shot_hides_dead_sticky`).

### ⑧ A visszakapcsolás ugyanilyen hangos
Befizetés után a blokk helyére **zöld megerősítés** kerül (ADR-0119 ④), a modulok
felirata visszaáll, és a bolt kinyílik.

---

## Amit a terv NEM köt (szabadon hangolható)

- A pontos színárnyalatok a `--citui-*` tokenekből (a piros `--citui-bad`).
- A hátralévő idő megjelenítési formája (nap-szám vs. dátum-hangsúly).
- Az „Oldal megtekintése" gomb viselkedése fagyás alatt — **nyitott kérdés**, a tulaj
  ebben a körben nem döntött; a mock szándékosan nem foglal állást.

## Fájlok

| Fájl | Mi |
|---|---|
| `freeze-state-B.html` | a jóváhagyott, kattintható terv (méret-váltó `@container`-rel, fül-váltó, működő gombok) |
| `B-mobil-modulok.png` / `B-asztali-modulok.png` | a Modulok fül, amin a tulaj döntött |
| `B-mobil-attekintes.png` / `B-asztali-attekintes.png` | a belépő fül, ugyanazzal a blokkal |

⚠️ A mockban `9670 Ft` szerepel, nem `10 270` — a szám a **tételekből származik**
(`alapdíj + modulok`), nem beírt érték. Az első vágásom beírt 10 270-et írt ki a
9670-es sorok fölé, vagyis a tervezői tábla maga mutatta volna azt, hogy nem tudunk
összeadni. Az ① szabály ezért a megvalósításra is áll: **levezetett, nem beírt**.
