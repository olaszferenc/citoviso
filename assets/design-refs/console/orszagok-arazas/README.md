# „Országok / Árazás” — JÓVÁHAGYOTT TERV (2026-11-26)

`plan.html` a tulaj által elfogadott terv. Három kör után hagyta jóvá, a koordinátoron (`cit9b4690e3`) keresztül:
1. 2026-11-26, első kör: „tökéletes”.
2. Második kör: a „Kiküldés” fül.
3. Harmadik kör: a képválasztó két lehetőségre szűkítve, és három nyitott kérdés eldöntve.

Ez a fájl **KONTRAKTUS**, nem stílus-javaslat: az alábbi pontok a megvalósítás elvárt viselkedését kötik, és a kész felületet ehhez mérjük. A fekete „MOCK-VEZÉRLŐ” sáv (méretváltó, adat-megjegyzés) nem része a tervnek. A `*` jelű számok mintaértékek.

A terv a korábbi `../orszagok/` (ADR-0460) tervre épül és kiterjeszti azt. Az „Adatok” szerkesztő, a teljesség-függvény és a jóváhagyás szabályai változatlanul érvényesek.

Képek:
- Asztali és mobil: `*-1-orszagok`, `*-2-hr-orszag`, `*-4-hu-arvaltozas`, `*-8-hu-kikuldes`, `*-9-hu-kikuldes-mentes`.
- Csak mobil: `mobil-5-uj-orszag-PLN`.

## Amit a terv KÖT

> A kötő feliratokat (`**„…”**`, a `contract-drift-check` ezeket keresi a kódban) és a hatókört a megvalósítás fázisai teszik be, amikor a felület elkészül. A befagyasztáskor még nincs kód, amiben élhetnének.

### A. Egy CRM-rész
1. „Országok / Árazás” néven egy menüpont lesz a mai „Árazás és értékesítés” és „Országok” helyén. A régi címek ide irányítanak át.
2. **Nyitóoldal: az országok táblázata.** Oszlopok:
   - Ország, Pénznem;
   - Árazás (kész / hiányos);
   - Státusz;
   - Leadgyűjtés, Kiküldés (megy / áll / nem indult);
   - Lead, Előfizető (+ szüneteltetett);
   - Napi keret, Ma kiküldve.

   A táblázat fölött összesítő sáv áll: felvett ország, összes lead, aktív előfizető, ma kiküldve / napi keret. Mobilon a sorok helyett kártyák jelennek meg, rajtuk a „következő teendővel” (az első piros tétel). A váltás konténer-szélességre történik (`@container`).
3. **Státusz:** Felvéve → Indulás → Fut. Mellette Szünetel: kézzel megállítva, ilyenkor a leadgyűjtés és a kiküldés áll, a meglévő előfizetők megújulása megy tovább. A hazai piac nem szüneteltethető.
4. **A „Globális” ársor nem ország:** a táblázat alatt egy sor mondja ki, hogy az a bejelentkezés nélküli főoldal-látogató árkijelzése, és onnan szerkeszthető.

### B. Új ország
5. **Listából választható az összes ország** (ISO 3166), nevük a konzol nyelvén, a **hivatalos pénznemükkel** (ISO 4217). Keresni név vagy ISO-kód szerint lehet. A már felvett ország halványan látszik („már felvéve”), nem választható.
6. **Barion-jelzés a választásnál**, jól láthatóan:
   - zöld: van tárca a pénznemre;
   - sárga: a Barion kezeli a pénznemet, de nincs tárca → a felvétel mehet, a kiküldés áll;
   - piros: a Barion nem kezeli a pénznemet → a vevő nem tud fizetni, az ország felvehető, de kiküldés nem indulhat.

   Forrás: `payment/providers.ts`, a tárca a fiók saját tárcái közül.
7. **Felvételkor a gép tölti ki** a nyilvános adatokat (nyelv, időzóna, hívószám, végződések, ünnepnapok) és kezdő ársort javasol. Az ország „Felvéve” státuszba kerül, az **„Indulás” külön gomb**.

### C. Egy ország — három fül
8. **Ország fül:**
   - **Alapadatok:** státusz és dátuma, pénznem, ár-régió, nyelv, időzóna, hívószám, fizetés + tárca, csatorna, kiküldési ablak, napi keret, lead / előfizető. A meglévő „Adatok” szerkesztő innen nyílik.
   - **Indítás doboz:** Indulás / Szüneteltetés / Folytatás.
   - **Az indulás állapota:** egy lista, sorrendben:
     1. Ország-adatok;
     2. Régió-felbontás (régió, csempe);
     3. Fordítás — Bábel, részletezve: Felület / Jogi csomag / Levelek / Súgó, darab + százalék + sáv;
     4. FR/PT esetén Fogyasztói vitarendező;
     5. Ünnepnapok;
     6. Ársor;
     7. Barion-tárca;
     8. Kiküldési csatorna;
     9. Felderítés (bejárt terület %, lead);
     10. Kontakt;
     11. Mock;
     12. Kiküldés.
   - **Tételállapotok:** kész / folyamatban / hiányzik / figyelem / vár.
   - **Ami nem kész,** annál kimondja: „Mi hiányzik, ki pótolja” vagy „Ki viszi”. Ez gép vagy munkatárs. Ember csak ott szerepel, ahol valóban az kell: a Barion-tárca megnyitása és a kezdő ár jóváhagyása (pénzdöntés).
   - Az **„Indulás” után a gép magától viszi végig** a régió → felderítés → kontakt → mock → kiküldés sort. A kiküldés csak akkor indul, ha minden záró tétel zöld. A záró tételeket a meglévő `countryReadiness` adja, a piac-kapu változatlan.
9. **Árazás fül:** a mai ország-fül tartalma (Csomagok, Alapdíj és éves fizetés, Modulok, Ajánlatok és próba — ez utóbbi „minden piacra érvényes”). Módosítás után alul ragadós sáv jelenik meg: „N ár módosítva — még nincs mentve”, Visszaállítás / Mentés…
10. **ÁRVÁLTOZÁS = ÜTEMEZETT (B), a tulaj döntése 2026-11-26-án:**
    - Áremelésnél **kezdő dátum** van, legkorábban a mentés napja + 30 nap. Az új vevő a dátumtól fizet. A meglévő előfizető a **dátum utáni első megújulástól** fizet, és mentéskor **értesítő levelet** kap: a saját nyelvén, az új összeggel és az első új áras terhelés napjával.
    - **Árcsökkenés** a **következő terheléstől mindenkinek** jár, értesítési idő nélkül. Vegyes változásnál a két rész külön ütemeződik.
    - **A szüneteltetett előfizető is érintett**, jelölve.
    - **Mentés előtt összesítő:**
      - érintett előfizető / összes (ebből szünetel);
      - havi bevétel-változás a teljes átállás után;
      - mikor megy ki az értesítő;
      - mikortól fizet az új vevő, és mikortól a meglévő;
      - előfizetőnkénti tábla: ciklus, következő terhelés, első új áras terhelés, most, új, különbség.
    - A túl korai dátumot elutasítja, és megmondja a legkorábbit.
11. **Kiküldés fül.** Országonként szerkeszthető, az alapértékek a mai valós működés. Minden tétel alatt ott áll, **mi dönt ma** (kód / globális beállítás / sor / éles szkript), és hogy országonkénti beállítás lesz. A tulaj döntéseit „döntve” jel mutatja.
    1. **Milyen lead mehet:**
       - **Egy választó, két lehetőséggel:**
         - (a) „Csak saját képes — legalább [N] saját kép; kevesebb képes lead nem megy ki”;
         - (b) „Saját képes (legalább [N]) + kevés képes is, településképes nyitóképpel”.

         Mellette: „ebből saját képpel: X · településképpel: Y”.
       - MINTA-jelölt szoba- és galériakép mehet-e (6 saját kép alatt).
       - Honlap szerinti kör: nincs honlap / elavult / modern / besorolatlan, ebben a sorrendben.
    2. **Csatornák sorrendben** (fel/le): e-mail, SMS, MMS, Viber, WhatsApp. Csak az választható, ami az országban él (`country.outreach_channels`), a többi „nem él”.
    3. **Napi keret** (megkeresés az ország napján). Ha él a felfutás, a sáv kimondja.
    4. **Jóváhagyás:** Automata / Tulaj-jóváhagyás, és alatta a feltételek pipálható listája. A ma égetett öt szabály:
       - két mock saját képpel vagy településképpel;
       - településképes mock MMS-ben nem megy;
       - akinek van e-mailje, csak e-mailt kap;
       - ellenőrizetlen mobilú lead e-mailben mehet;
       - e-mail cím nélkül nem küldünk.

       Alapérték minden országban **Tulaj-jóváhagyás** (a tulaj döntése 2026-11-26, a 4. fázis indulásakor: „B” — most minden országban ő hagy jóvá, de országonként beállítható maradjon). A fülön egy kattintással **Automatára** állítható. A korábbi „HR is Automata” (2026-11-26 reggel) ezzel felülírva. A felület jelzi az ellentmondást: ha egy mobilcsatorna be van kapcsolva, de az „e-mail nélkül nem küldünk” feltétel él, a mobilcsatorna nem indul.
    5. **Időkeret:**
       - hétnapok (H–V kapcsolók);
       - órák ettől–eddig, az ország időzónájában;
       - az ország ünnepnapjain nem küldünk.
    6. **Utánkövetés:**
       - nem-nyitó levél: ennyi nap után, levelek száma, napi keret;
       - eszkalációs ajánlat e-mailben.

       Ha a nem-nyitó levél be van kapcsolva, de a napi kerete 0, a felület figyelmeztet.
    - **Összesítő a fül tetején és mentés előtt:**
      - hány lead felel meg holnaptól (a mostanihoz képest);
      - naponta hány megkeresés megy;
      - az első küldési nap;
      - hány küldési nap alatt fogy el az állomány;
      - a módosítások listája (Most → Új).

      A szám a valódi lead-állományból jön (még meg nem keresett, nem tiltott). A felület kimondja, hogy a mock-, render- és minőségi kapu ezen felül szűr.

### D. Eldöntve 2026-11-26-án (tulaj „igen”)
12. A pipálható szabálylista **kiváltja** az éles `/opt/citoviso/auto-approve.mts`-t.
13. A kódba égetett **8–17 megszűnik**, az országonkénti időkeret az egyetlen ablak.
14. A nem-nyitó levél napi kerete **országonkénti**.

### E. Közös
15. Felületi szöveg magyarul, minden `T()`/`tr()` kulccsal (§B.18). Színek csak `--citui-*` tokenből, ikonok inline SVG-k, emoji nincs.
