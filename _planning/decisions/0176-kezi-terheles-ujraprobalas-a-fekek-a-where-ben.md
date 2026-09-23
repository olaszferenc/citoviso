## ADR-0176 — Kézi terhelés-újrapróbálás: a fékek a WHERE-ben ülnek, nem a hívóban

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi utasítás: „Csináld meg a
terhelés-újrapróbálás szerver-útvonalát is.") · **Kontraktus:**
`assets/design-refs/console/freeze-state-v2/` ⑤ · **Kapcsolódó:** ADR-0080 ④ (token-first
terhelés), ADR-0118 ② (feltételes UPDATE-es birtokbavétel), ADR-0155 (fagyasztott lap).

**Probléma.** A 2026-09-14-én jóváhagyott terv mockjában két gomb állt az elakadt
kártyaterhelésnél. A „Másik kártyával fizetek" megvalósult; az **„Újrapróbálom ezzel a
kártyával" nem** — nem volt szerver-útvonal, ami egy MIT-terhelést újra megkísérelne, és
egy némán semmit nem csináló gomb rosszabb a hiánynál. Az eltérést a kontraktus kimondta.
Ez a kör a hiányzó utat építi meg.

**Miért kell egyáltalán.** A leggyakoribb elutasítás a fedezethiány. A létra a **fagyás
után már nem próbálkozik** (`offset < FREEZE_OFFSET`), tehát ha a tulaj közben feltöltötte
a kártyát, az automata **soha** nem jön vissza érte — ma újra meg kell adnia a kártyát a
Barionnál. Egy kattintás ugyanaz a pénz, sokkal kisebb súrlódással.

**① A terhelés MAGA a meglévő `chargeRenewalWithToken()`.** Abban már benne van a
dupla-terhelés önjavítása (ha a ciklus MÁR fizetve, rendez terhelés helyett), a függő
MIT-fizetés újrahasználata és az elakadt pending lezárása. Második terhelés-utat írni
belőle két igazság lenne, és az elcsúszás a bankszámlán derülne ki.

**② A KORLÁTOK A WHERE-BEN ÜLNEK** (ADR-0118 ② mintája). A birtokbavétel EGYETLEN
feltételes UPDATE az `order_intent`-en, ami egyszerre nézi a **várakozási időt** és a
**sorozat-korlátot**. Ezért két párhuzamos kattintásból pontosan az egyik nyer — mérve: a
fékek nélküli változat ugyanerre a forgatókönyvre **két valódi terhelést** indított.

**③ A PRÓBÁLKOZÁSOK SZÁMA LEVEZETETT, nem tárolt.** A számláló a `pay_url IS NULL`
payment sorok az orderen — ugyanaz, amit minden terhelés-út (automata létra ÉS kézi gomb)
amúgy is ír. Egy külön `attempts` oszlop második igazság lenne, amit minden útnak karban
kellene tartania. Tárolva csak TÉNY van: `order_intent.manual_charge_at` (0069) — mikor
indított a tulaj utoljára kézi próbát. Ez egyszerre a várakozás órája és a claim zárja.

**④ A sorozat-korlát nem önkényes.** A kártyatársaságok korlátozzák egy ELUTASÍTOTT
MIT-tranzakció újrapróbálását, és a korlát túllépése a kereskedőt bünteti. Szűken tartjuk
(összesen 4 MIT egy orderre: 1 az automatáé, 3 a tulajé); ha a bank harmadszorra is
elutasít, nem az ismétlés hiányzik, hanem egy MÁSIK kártya — oda a fizetési link vezet.

**⑤ A visszajelzés MINDEN ágon MÁS, és mindegyik megmondja, mit tehet.** Sikerült (és a
honlap visszakapcsolt) · a bank elutasította, NEM vontunk le semmit · még jár a türelmi
idő (perccel) · elfogyott a sorozat · nincs mentett kártya. Egy összevont „nem sikerült"
pont azt a hibát követné el, amit az ADR-0155 köre javít.

**⑥ Gépi kapu:** `scripts/charge-retry-check.mts`. Pénzt mozgató útnál nem a boldog ágat
mérjük (az egy sor), hanem a FÉKEKET. **Valódi DB-t használ**, mert a mért szabály MAGA
egy SQL WHERE — egy TypeScriptben újraírt „ugyanaz a logika" a másolatot mérné
(`feedback_guard_must_not_borrow_its_subject`). Saját, egyedi nevű eldobható fixtúrát vet,
és `finally`-ben mindent visszatakarít. **Valódi pénz NEM mozdul:** a terhelés-függvény
injektált. Hét állítás: első próba pontosan egy terhelést indít · azonnali második
kattintás elutasítva, terhelés nélkül · **két párhuzamos kattintásból egy nyer** · a
sorozat megáll a korlátnál · a kimerült sorozat SAJÁT okot ad · aktív előfizetésen nem
indul terhelés · tárolt kártya nélkül sem.
**Piros önteszt a fékek NÉLKÜLI változaton: 4 sértés** — köztük 2 párhuzamos terhelés és
11 próbálkozás a 4-es korlát ellenében.

> ⛔ **Mellékleletet termelt, és a KÉP fogta meg.** Az „Újrapróbálom" gomb `--primary`
> osztályt kapott, mégis ugyanolyan fehér lett, mint a másodlagos: a `.adm-mand__btn`
> alapszabály a stíluslapban KÉSŐBB áll, tehát azonos fajsúlynál mindig ő nyert. Mérve a
> két gomb háttere **bitre azonos** volt — vagyis „a fizetés útja a leghalkabb elem"
> hibaosztály, épp abban a blokkban, ami ellene készült. Javítva kétosztályos
> szelektorral (0,2,0); a kontraszt mérve 6,91 (AA fölött).
> Ugyanitt: a magyarázó mondat két gomb alatt állt, és így az újrapróbálásra is
> vonatkozhatott — most MEGNEVEZI, melyikre.

**Visszafordíthatóság:** 🔄 a korlátok egy-egy konstans; a gomb egy `frozen`-ághoz kötött
űrlap. 🚪 Részben egyirányú: a `manual_charge_at` oszlop (0069) marad.
