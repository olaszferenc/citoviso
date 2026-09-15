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

**Mindkét gomb VALÓDI utat kínál** (2026-09-15 óta teljes):

| Gomb | Mit csinál | Miért |
|---|---|---|
| **„Újrapróbálom ezzel a kártyával"** (elsődleges, kitöltött) | `POST /admin/subscription/retry-charge` → a tárolt kártya ÚJRA terhelése | A leggyakoribb elutasítás a fedezethiány. Ha a tulaj közben feltöltötte a kártyát, egy kattintás elég — a létra a FAGYÁS UTÁN már nem próbálkozik, tehát magától SOHA nem jönne vissza érte. |
| **„Másik kártyával fizetek"** (másodlagos) | a fizetési link | A tárolt megbízást a kártyatársasági szabály szerint csak 3DS-sel megerősített, ügyfél-kezdeményezett fizetés adhatja meg újra — az OTT megadott kártya lesz az új megbízás. |

**⛔ A FÉKEK A SZERVEREN, EGY FELTÉTELES UPDATE WHERE-JÉBEN ÜLNEK**, nem a hívó
jólneveltségén (ADR-0118 ② mintája). Pénzt mozgató útnál a gomb megléte nem
bizonyíték — a `retryRenewalCharge` MINDEN előfeltételt újra mér:

- **várakozás**: két kézi próba között el kell telnie a türelmi időnek (a gomb nem
  püfölhető), és a claim atomi, tehát **két párhuzamos kattintásból pontosan egy nyer**;
- **sorozat-korlát**: egy megújulás-orderre összesen korlátos számú MIT-terhelés mehet
  (a kártyatársaságok korlátozzák egy elutasított MIT újrapróbálását, és a korlát
  túllépése a kereskedőt bünteti). A darabszám **levezetett** (a `pay_url IS NULL`
  payment sorok), nem külön számláló — az két igazság lenne;
- **előfeltételek**: csak `frozen`/`past_due` fiókon, csak tárolt kártyával, csak
  létező dunningolt orderre.

**A visszajelzés MINDEN ágon MÁS** — sikerült / a bank elutasította / még jár a
türelmi idő / elfogyott a sorozat / nincs kártya —, és **mindegyik megmondja, mit
tehet**. Egy összevont „nem sikerült" itt azt a hibát követné el, amit ez a kör javít.

⛔ **A terhelés MAGA a meglévő `chargeRenewalWithToken()`** — abban már benne van a
dupla-terhelés önjavítása, a függő MIT-fizetés újrahasználata és az elakadt pending
lezárása. Második terhelés-út két igazság lenne, és az elcsúszás a bankszámlán
derülne ki.

### ⑥ A felfüggesztés MINDEN fülön megjelenik
Az ADR-0119 ① hatálya a **teljes admin**, nem a Modulok fül. A belépő (`attekintes`)
és az Üzenetek fül is a fagyás-blokkal nyit (az Üzeneteken kompakt alakban:
a határidő-oszlop elrejtve, kisebb összeg-méret).

### ⑦ Telefonon LÁTHATÓ, nem csak jelen van
A fagyás-blokk 390×844-en **első festéskor olvasható** — nem takarja a fix alsó
fülsáv (`.adm-side`, mobilon `position:fixed;bottom:0`). Mérés: `elementFromPoint`
a blokk összeg-során, **nem** teljes-lapos képről ítélve
(`reference_fullpage_shot_hides_dead_sticky`).

### ⑨ A tulaj látja a SAJÁTJÁT és azt is, amit a VILÁG lát
**Tulajdonosi döntés, 2026-09-15** („B — Felirat + vendég-nézet"):

- A fejléc-gomb felirata fagyás alatt **„Előnézet — csak Ön látja"** (a modul-sorok már
  meglévő mintája: ott is „Előnézet", nem „Megnézem"), és **az előnézetre visz**, nem a
  felfüggesztett nyilvános hosztra. Felirat és cél együtt igaz vagy együtt hamis.
- A fagyás-blokk **kimondja, mit lát közben a látogató**: **„Mit lát közben a látogató:"**
  a szállás nevét, települését és a tulaj elérhetőségeit — és ad egy linket
  (**„Megnézem, mit lát a látogató"**) a VALÓDI 503-as lapra.

> ⛔ **Két saját hibát javít.** ① A bejelentett lelet („a gomb figyelmeztetés nélkül visz
> a fagyasztott lapra") **mérve nem állt**: a `public.ts` a `siteUrl`-t csak `live`
> státuszban adja át, tehát a gomb a belső előnézetre esett vissza — törött link nem volt.
> A baj a felirat volt, az ELLENKEZŐ irányba. ② A „B — Rendezés-képernyő" refaktor
> **némán elvitte** a hármas ténylistát, amiben egyedül állt, hogy a látogató nem üres
> lapot kap — a tulaj legnagyobb félelmére nem volt válasz a képernyőn.

**⚠️ A szöveg nem a régi mondat.** A vendég-lapot 2026-09-14-én egy párhuzamos szál
átírta: kikerült belőle az „átmenetileg" és a visszatérés-ígéret, mert fizetés híján a
30. napon a honlap VÉGLEG lekerül. Mérve, mit mond ma a lap:
*„Ez az oldal jelenleg nem érhető el."* + szállásnév + település + elérhetőségek.
Ugyanazt az ígéretet **egy szinttel feljebb sem írhatjuk vissza** — ezért az admin sora
csak TÉNYEKET állít, ígéretet nem. Az őr tiltja az „átmenetileg", „nézzen vissza",
„hamarosan", „dolgozunk rajta" fordulatokat ebben a sorban.

**⭐ Amit az admin ígér, azt a VALÓDI vendég-lap renderjén kell visszakeresni** — nem
kézzel másolt hasonmáson (`feedback_one_rule_two_copies`). Ha a vendég-lapról eltűnik a
név vagy az elérhetőség, az admin mondata hamissá válik, és ezt a kapunál kell megtudni.

**Mért korlát, kimondva:** 390×844-en a látogatói link első festéskor **y=790**, a fix
alsó fülsáv pedig y=658-tól — tehát **a sáv alatt van**, és csak görgetés után
kattintható (mérve: scrollY=230 → y=560, kattintható). Ez ELFOGADOTT: a ⑦ az ÖSSZEGET és
a FIZETÉS-GOMBOT köti a nyitó nézetbe (y=270 / y=359), a látogatói sor másodlagos. Amit
NEM fogadunk el: hogy egyáltalán ne lehessen elérni — ezt őr méri.

### ⑧ A visszakapcsolás ugyanilyen hangos
Befizetés után a blokk helyére **zöld megerősítés** kerül (ADR-0119 ④), a modulok
felirata visszaáll, és a bolt kinyílik.

---

## Amit a terv NEM köt (szabadon hangolható)

- A pontos színárnyalatok a `--citui-*` tokenekből (a piros `--citui-bad`).
- A hátralévő idő megjelenítési formája (nap-szám vs. dátum-hangsúly).
- ~~Az „Oldal megtekintése" gomb viselkedése fagyás alatt~~ — **eldöntve 2026-09-15**,
  lásd ⑨.

## Fájlok

| Fájl | Mi |
|---|---|
| `freeze-state-B.html` | a jóváhagyott, kattintható terv (méret-váltó `@container`-rel, fül-váltó, működő gombok) |
| `B-mobil-modulok.png` / `B-asztali-modulok.png` | a Modulok fül, amin a tulaj döntött |
| `B-mobil-attekintes.png` / `B-asztali-attekintes.png` | a belépő fül, ugyanazzal a blokkal |
| `regen/` | a terv GENERÁTORA + kattintás-próba — lásd `regen/HASZNALAT.md` |

⚠️ **A hiteles példány a commitolt `freeze-state-B.html`, NEM a generátor kimenete.**
A generátor a mai stíluslapot ágyazza be, ezért a helyére írva minden jövőbeli
CSS-változás némán átírná azt a képet, amin a tulaj döntött. Külön `*.regen.html`-be
ír (gitignore-olt), és összehasonlításra való.

> **Miért van itt a generátor egyáltalán.** A `scripts/land.sh` (ADR-0077) minden
> landoláskor törli az `assets/design-refs/_drafts/` mappát — a jóváhagyásra VÁRÓ vázlat
> eldobható. A generátorom viszont a munkafa gyökerében, KÖVETETLENÜL élt, a munkafát
> pedig a watchdog GC-je el tudja vinni. Így a jóváhagyott terv FORRÁSA egy gépi
> takarítással megszűnhetett volna, miközben a DÖNTÉS érvényes marad.

⚠️ A mockban `9670 Ft` szerepel, nem `10 270` — a szám a **tételekből származik**
(`alapdíj + modulok`), nem beírt érték. Az első vágásom beírt 10 270-et írt ki a
9670-es sorok fölé, vagyis a tervezői tábla maga mutatta volna azt, hogy nem tudunk
összeadni. Az ① szabály ezért a megvalósításra is áll: **levezetett, nem beírt**.
