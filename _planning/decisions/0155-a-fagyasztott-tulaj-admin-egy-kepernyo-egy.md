## ADR-0155 — A fagyasztott tulaj-admin: egy képernyő, egy összeg, és a modul-lista csak olvasható

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA (tulajdonosi választás három bemutatott
változat képei alapján: **„B — Rendezés-képernyő"**) ·
**Terv-kontraktus:** `assets/design-refs/console/freeze-state-v2/` ·
**Kiterjeszti:** ADR-0119 (①–⑧) — nem váltja fel · **Kiváltó:** Elek FK-006a (2026-09-13),
a leletek a 2026-09-14-i fán újramérve · **Elvetve:** „A" (kísérő ragadós fizetés-sáv),
„C" (tételes számla).

**Probléma (mérve a RENDERELT lapon, nem tippelve).** Az ADR-0119 ⑧ javította, hogy fagyás
alatt egyetlen kártya sem ígér elérhetőséget — **ugyanazon a képernyőn** viszont egyetlen
sort sem mozdult a többi lelet:

| Mit | Mért érték |
|---|---|
| Két összeg egy kártyán | „Rendezendő tartozás **10 270 Ft**" ÉS „Következő számla (**2026. 08. 10.**) **10 270 Ft**" — ugyanaz a szám kétszer, és a „következő" dátum a `periodEnd`, vagyis a fagyás ELŐTTI, MÁR ELMÚLT nap |
| Fizetés vs. lemondás | **11× „Kikapcsolom"** / **1× „Befizetem"** |
| Eladási cimke megvetten | 13× „+490 Ft/hó", ebből **11 a SZÜNETELŐ, már kifizetett modulokon** |
| Elakadt terhelés | 1× „Megbízás visszavonása", **0×** előrevivő művelet |
| Üzenetek fül | **0×** bármelyik fagyás-szó a teljes lapon |
| Belépő fül | 0× tartozás, 0× összeg, 0× fizetés-gomb |

**A gyökér-ok szerkezeti, nem szövegezési.** Az ADR-0119 ① kimondta, hogy „a fagyás ÁLLAPOT,
nem doboz" — a blokkot viszont EGYEDÜL a `modulesSection()` rendereltette, vagyis a 13 fülből
egy. A két meglévő őr (⑦ `frozen-state-check`, ⑧ `frozen-claim-check`) szintén azt az egy
függvényt méri, tehát a szabály hatóköre és az őrök hatóköre EGYÜTT szűkült be ugyanarra a
fülre. A hiba nem csúszott át a kapun: **a kapu sosem nézett arra a 12 lapra.**

**① EGY képernyő, EGY pénzösszeg.** Fagyás alatt a rendezendő tartozás az egyetlen összeg
döntési pozícióban. A „Következő számla" cella nem ír ki összeget és nem ír ki múltbeli
dátumot: helyette „A rendezés után a következő számla" + egy DÁTUM, ami az `arrears.periodEnd`
— ugyanaz a kulcs, amivel a dunning-létra dolgozik, nem újraszámolt hasonmás. Ugyanezért esik
ki a „Jelenlegi díj" cella (egy havi fiókon szükségszerűen a tartozással azonos szám) és az
összegző sáv VÉGÖSSZEGE („ez a fenti rendezendő tartozás", szám nélkül). A RÉSZEK (alapdíj,
modulok) maradnak: azok különböző számok, és épp azt mondják meg, miből áll a tartozás.

**② A tartozás mellé a HATÁRIDŐ is figurává lép.** Eddig a T+30 dátum egy próza-lista második
franciabekezdése volt — az az egy tény, amitől az összeg sürgős, a blokk legkevésbé látható
eleme. Most saját panel: nap-szám + haladás-sáv + a záró dátum. ⛔ A „0 nap" nem alapértelmezés:
a záró dátum MÖGÖTTÜNK is lehet (a lezáró job ütemezve fut), és egy nagy „0 nap" egy „…-ig
rendezhető" mondat fölött két állítás, ami nem állhat együtt — külön „ma jár le" / „lejárt" ág.

**③ A modul-lista fagyás alatt CSAK OLVASHATÓ** (tulajdonosi szó szerinti rendelet). Kikerül a
be/ki kapcsoló és az ár-cimke; a szekció fejléce „Mi kapcsol vissza a befizetéssel".
⚠️ **A kapcsoló kivétele önmagában ADATVESZTÉS lett volna:** az `applyModuleChange` a HIÁNYZÓ
`module` mezőt LEMONDÁSNAK olvassa, tehát a fagyasztott lap egyetlen űrlap-beküldése némán
lemondta volna mind a 11 modult. Minden birtokolt modul ezért rejtett megőrző mezőt kap — és
ezt az őr DARABRA méri, mert ez a kör legveszélyesebb pontja.

**④ Eladási CTA sem maradhat.** Az ADR-0119 ⑥ a bolt-gombokat zárta; mérve maradt egy: az
„éves fizetésre váltás" ajánlata, egy 102 700 Ft-os számmal közvetlenül a tartozás mellett.
⛔ **Ezt nem az őröm fogta meg, hanem a SAJÁT SZEMEM a szállított felület képén** — az őr egy
KONKRÉT összeget számolt, ez pedig másik szám volt. Az őr azóta a döntési POZÍCIÓT méri
(kiemelt ár + hozzá tartozó gomb), nem egy értéket.

**⑤ Előrevivő művelet az elakadt terhelésre — de csak VALÓDI.** A jóváhagyott mockban két gomb
volt („Újrapróbálom ezzel a kártyával", „Másik kártyát adok meg"); az újrapróbálás **nem
készült el**, mert nincs szerver-útvonal, ami egy terhelést újra megkísérelne, és egy némán
semmit nem csináló gomb rosszabb a hiánynál. Ami valóban előrevisz: a fizetési link — a tárolt
megbízást csak 3DS-sel megerősített, ügyfél-kezdeményezett fizetés adhatja meg újra, tehát az
ott megadott kártya lesz az új megbízás. A visszavonás halk linkké válik, és kimondja, hogy a
tartozás ettől nem szűnik meg. **Az eltérés a kontraktus README-jében kimondva**, hogy a terv
és a szállítás ne csússzon szét némán.

**⑥ Gépi kapuk (mind PIROS ÖNTESZTTEL).**
- `scripts/frozen-settle-check.mts` — a PÉNZ és a VEZÉRLŐK: megszámolja, hányszor áll a
  tartozás összege a lapon, méri a rendezés-utáni cella dátumát (saját `data-nextafter`
  horgon, mert az osztálynévre kötött első vágás a SZOMSZÉD cellát olvasta és zöldet adott),
  a kapcsolókat, az ár-cimkéket (a SAJÁT modulok blokkjára szűkítve — a boltban az ár valódi
  ajánlat), a megőrző mezőket darabra, a kijáratot, és hogy öt vizsgált fül mind kimondja-e a
  fagyást. Önteszt: **8 sértés**; a négy `!selfTest`-es kötést külön, a TERMÉK
  visszarontásával igazoltuk (mind a négy pirosra ment).
- `scripts/frozen-phone-check.mts` — böngészővel, `elementFromPoint`-tal, GÖRGETÉS NÉLKÜL:
  látszik-e a tartozás és a fizetés-gomb 390×844-en, első festéskor. ⛔ Ez szöveg-alapú őrrel
  nem mérhető: az előző körben a javított mondat JELEN VOLT a lapon (y=730), miközben a fix
  alsó fülsáv (y=658) alatt állt — a szöveg-őr zöld, a telefonos tulaj nem látta. Teljes-lapos
  KÉP sem dönthet, mert az a fix elemeket a végleges helyükre festi. Önteszt: **6 sértés**.
- `scripts/frozen-entry-check.mts` (ugyanezen szál korábbi köre) — a BELÉPŐ fül szövege.
- `scripts/frozen-state-check.mts` ③ horgonya `.adm-card .adm-state`-ről `.adm-frz`-re váltott
  (a blokk azért nem kártya többé, mert minden fülön megjelenik). A cserét a VISELKEDÉS
  igazolása UTÁN végeztük: előbb mértük, hogy a fizetés-gomb a blokkon belül van.

**Visszafordíthatóság:** 🔄 a feliratok és a blokk elrendezése szabadon hangolható; a
fagyás-ágak mind `frozen`-feltételhez kötöttek, tehát a nem-fagyasztott felület érintetlen
(a meglévő őrök zölden igazolják). 🚪 Egyirányú elem nincs: nem született új oszlop, sem
kifelé tett vállalás.

**⑦ A NYITOTT PONT LEZÁRVA (2026-09-15, tulajdonosi döntés: „B — Felirat + vendég-nézet").**
⚠️ És a nyitott pont PREMISSZÁJA is hamis volt: a lelet szerint a gomb „figyelmeztetés nélkül
visz a fagyasztott lapra" — **mérve nem**. A `public.ts` a `siteUrl`-t CSAK `live` státuszban
adja át, fagyás alatt tehát null, és a gomb a BELSŐ előnézetre esik vissza; törött link nincs.
A valódi baj a felirat, és az ELLENKEZŐ irányba hazudik: az „Oldal megtekintése" azt ígéri,
hogy azt látja, ami a látogatónak megy, közben a tulaj a teljes, működő oldalát kapja — a gomb
megnyugtat, pont amikor nem kéne. A modul-sorok ezt már megoldották („Megnézem" → „Előnézet");
a fejléc-gomb kimaradt ugyanabból a javításból. Mostantól „Előnézet — csak Ön látja".
⛔ **Mellékleletként a SAJÁT ⑥ refaktorom hibája:** a teendő-kártyáról rendezés-képernyőre
váltás **némán elvitte** azt a hármas ténylistát, amiben EGYEDÜL állt, hogy a látogató nem üres
lapot és nem nyers hibát kap. A tulaj legnagyobb félelme („elveszítem a vendégeket?") így
válasz nélkül maradt. Pótolva — de NEM a régi mondattal: a vendég-lapból egy párhuzamos szál
2026-09-14-én kivette az „átmenetileg"-et és a visszatérés-ígéretet (fizetés híján a 30. napon
a honlap VÉGLEG lekerül), és ugyanazt egy szinttel feljebb sem írhatjuk vissza. Az admin sora
ezért csak tényeket állít, és linket ad a VALÓDI 503-as lapra.
⭐ **Az őr gerince:** amit az admin ígér a látogatói lapról, azt a `renderSuspendedPage()`
RENDERJÉN keresi vissza (`scripts/frozen-guest-view-check.mts`) — kézzel másolt hasonmás
helyett egy forrás. Ha a vendég-lapról eltűnik a név vagy az elérhetőség, az admin mondata
hamissá válik, és a kapunál derül ki. Piros önteszt 2 sértés; a gerinc, a visszatérés-tilalom
és a Modulok-fül külön útja a TERMÉK visszarontásával igazolva.
