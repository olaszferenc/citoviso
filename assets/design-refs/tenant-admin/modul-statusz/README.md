# Modul-státusz + első belépéses beállító varázsló — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-11-06, tulajdonosi döntés a koordinátoron át („ok” a 4. körre). A tervkörök: 1. kör A/B/C → B (csempék) + C (varázsló), 2. kör nyilvántartás + land-kapu, 3. kör szobák/függőségek/hiányzó modul, 4. kör visszalépés mindenhol, kosár, whole_only, minden megvett modul a varázslóban.
**Hatókör:** `src/tenant/moduleSetup.ts` · `src/server/setupSteps.ts` · `src/server/setupWizard.ts` · `src/server/setupWizardViews.ts` · `src/server/adminViews.ts` · `src/tenant/setupReminder.ts` · `src/email/loginEmail.ts` · `scripts/module-setup-registry-check.mts`
**Kapcsolódó:** ADR-0429 (ez a döntés), ADR-0192 (modul-függőség), ADR-0074 §5 (szobánkénti felszereltség), ADR-0114/0256/0257/0392/0393 (egész ház, szobák, csak egyben), ADR-0208/0222 (ár nélkül árajánlatkérés), ADR-0380 (Foglalás beállítása — megmarad haladó nézetnek), ADR-0417 (belépés-emlékeztető), ADR-0045 (súgó), ADR-0224 (Linear admin-nyelv), ADR-0036 / Bábel (i18n).

`approved.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat** (önhordó, működő vázlat: méret-váltó, minták — Duna Vibe House egészben, Marilyn Vendégház egészben/üres, Berény Panzió 3 szoba „Alap” csomaggal —, „Első belépés újra”, és a „Terv: nyilvántartás + kapu” panel, ahol a kapu kimenete élőben számol). Képek: mobil + asztali párok (`01-…`–`12-…`), valamint `csempek-zarolt-mobile.png`, `csempek-egysegenkent-desktop.png`.

## Amit a terv KÖT

### 1. Két bejárat, egy állapot
1. **Első belépéskor teljes képernyős varázsló** nyílik (**„Állítsuk be együtt”**), ha van le nem zárt téma. Asztalin bal oldalt a témasor, középen a kérdés, jobbra élő „Így látja a vendég” előnézet; mobilon felül „N. téma / M · … · Témák ▾” sáv (lenyíló témalista), alul a gombok, az előnézet egy gombbal nyílik.
2. **„Később folytatom”** vagy kész után a mai admin: az Áttekintés tetején „Beállítás: N / M téma kész” sáv a **„Folytatom”** gombbal (ha minden kész: **„Beállítás átnézése”**), alatta „N modul vár beállításra” csipekkel; a Modulok lapon **csempék** két csoportban (**„Ami a foglaláshoz kell”** / **„Az oldal többi része”**), állapot-színnel és a következő lépéssel; a modul saját lapján a lépések **a lapba ágyazva** (elrejthető, folytatható; a megkezdett lépéssor az utolsó kérdésig a lapon marad).
3. **A státusz MINDIG a valós adatból számol**, nem abból, hol tart a tulaj a kérdésekben — ami a modul lapján elkészült, azt a varázsló késznek mutatja és nem kérdezi újra.
4. A **Teendők** lista az Áttekintésen marad, a NEM-modul tételekkel (foglalási kérés, díj, élő-e az oldal, próba).

### 2. Státusz-állapotok
**„Kész”** · **„Félkész”** (+ mi hiányzik) · **„Hiányzik”** · **„Ön döntött így”** (pl. „ár kérésre”, „most nem gyűjt véleményt” — nem hiány, nem nyaggatjuk) · **„Nem kötelező”** (pl. bemutató fotók — felkínáljuk, kihagyható). Egységenkénti témáknál a sor egységenként számol: „2/3 szobának van ára”.

### 3. A nyilvántartás (`src/tenant/moduleSetup.ts`) — az EGYETLEN modul-lista
A varázsló, a csempék, az Áttekintés sávja, az emlékeztető és a kapu csak ezt olvassa. Bejegyzésenként:
- `id` — téma; egy modulhoz több téma tartozhat (a foglalás → naptár + foglalási szabályok);
- `modules[]` — melyik katalógus-modul birtoklása hozza elő (üres = mindig);
- `group` — foglaláshoz kell / az oldal többi része;
- `requires[]` — `{ topic, why }` (másik téma legyen Kész vagy Ön döntött így) vagy `{ data }` (regisztrált adat-előfeltétel, pl. „legalább 1 foglalható egység”); amíg hiányzik, a téma **zárolt**, és a `why` mondatot mutatja („Előbb …”); a **sorrendet a requires-gráf adja** (topologikus), nem kézi szám;
- `repeat: "unit"` — a lépések a foglalható egységeken ismétlődnek;
- `status(ctx)` — a MEGLÉVŐ predikátumokat hívja (unitPriceStatus, paidButEmptyModules, loadBookingSetup, calendar_link …), DB-írás nélkül;
- `setup` — beágyazott lépések (kérdés, magyarázat, mező a meglévő írás-függvényre, ellenőrzés) VAGY a meglévő admin-lap, amely a varázslóból nyílik és oda tér vissza (`returns`);
- `kb` — súgó-entry; minden lépés alján „Részletesen a súgóban”;
- `preview`, `remind`.
A **modul-zár nem mező**: a katalógus `requires`-éből (ADR-0192) futásidőben jön — ha a téma modulja a mostani helyzetben (pl. 2+ egység) meg nem vett modult kíván, a téma zárolt, és a katalógus „why” mondatát + az árat + a kosár útját mutatja.

### 4. A varázsló viselkedése
1. **Minden megvett modul témája benne van** (tulaj: „az összes megvett modulon végigvisz”). Beágyazott lépés, ahol a felület kicsi (Fotók feltöltése, cím, előnyök, vélemény-gyűjtés, bemutatkozó szöveg, férőhely, ár, felszereltség, naptár, foglalási szabályok, érkezés, e-mail); a meglévő lap, ahol csak az kezeli (Programajánló, Többnyelvű) — a varázsló megnyitja, és a lap sávja (**„Kész — vissza a beállításhoz”**) visz vissza a következő témára.
2. **Visszalépés mindenhol:** témán belül az előző kérdésre; a téma első kérdésén „Vissza: <előző téma>” az előző téma utolsó kérdésére; a témasorból bármelyik kész téma kattintható (**„Kész — szerkeszthető”**) és a **mentett értékkel** nyílik. Módosítás után a függő témák állapota újraszámol (pl. egészben → szobánként után a férőhely és az ár szobánként újra nyílik). Az első téma első kérdésén nincs Vissza.
3. **„Kihagyom”** a témát a sor végére teszi (és kimondja, mi vár rá); nem kötelező témán **„Most kihagyom”** — a téma „Kihagyva — nem kötelező”, bármikor elővehető.
4. **Az első téma „Hogyan adja ki?”** három válasszal: **„Egészben”** · **„Szobánként”** (hány szoba → nevek; a portálról ismert szobanevekkel előtöltve; az egész ház mellettük megmarad, ADR-0392) · **„Egyben adom ki, de a szobákat bemutatnám”** (whole_only, ADR-0257: egy foglalható egység, a szobák bemutatók, árat nem kérnek).
5. **Hiányzó modul → kosár, nem zsákutca:** ha a válasz modult kíván (pl. Szobák), a varázsló megmondja, mi kell és mennyibe kerül (élő `module_price`), felkínálja a kapcsolódót (Árak, a katalógus mondatával), és két utat ad: **„Megrendelem, és folytatjuk”** (a MEGLÉVŐ modul-kosár; fizetés után a varázsló **ugyanazon a lépésen** folytatja, „Megrendelve és kifizetve: …”) vagy **„Most egészben adom ki”**.
6. **Egységenként ismétlődő lépések:** férőhely, ár, (Szobák + Felszereltség esetén) a szoba saját felszereltsége; egységenkénti témánál minden válasz azonnal ment.
7. A szöveg kész, tényekből összerakott mondat — **LLM-hívás nincs**; minden felirat `T()` / `tr()` (Bábel fordít).

### 5. A land-kapu: `module-setup-registry-check`
① minden nem kivezetett katalógus-modulnak van bejegyzése, vagy KIVÉTEL indokkal · ② a `modules[]` létező, nem kivezetett modulra mutat · ③ van `status()`, az üres fixtúrán NEM Kész, a kitöltöttön Kész, és nem ír · ④ van beállítási út (lépések létező írásra, vagy létező lap) · ⑤ a `kb` létező entry · ⑥ a kivétel-lista élő · ⑧ minden `requires` létező témára vagy regisztrált adat-előfeltételre mutat, és van zároló mondata · ⑨ a gráf körmentes · ⑩ összhang az ADR-0192-vel („always” függésnél minden A-téma vár egy B-témára; fordított él nincs; a „multiUnit” függés futásidejű modul-zár) · ⑪ minden téma a varázsló része (lépések, vagy lap + visszatérés) · ⑦ piros önteszt mind a tíz sértésre. A pre-commit és a land futtatja; a guard-wiring-check kikényszeríti a bekötést.

### 6. Emlékeztető és folytatás
- A belépés-emlékeztető (ADR-0417) egy mondattal megnevezi a hiányt (SMS GSM-7, e-mailben lista); belépés után a heti levél a teljes hiánylistát nevezi meg „Folytatom a beállítást” gombbal; nincs hiány → nem megy ki. Forrás: ugyanaz a nyilvántartás (`remind`).
- Folytatási állapot szerver-oldalon: `site_setup_progress` (oldalhoz kötve, nem böngészőhöz; csak azt tárolja, hol tart a tulaj a kérdésekben — a státusz nem itt él).

## A mock és a megvalósítás határa
- A mock localStorage-ben tárol, a kosár és a fotó-feltöltés szimulált, a naptár-ellenőrzés nem hív portált — a megvalósítás a meglévő útvonalakat hívja (kosár, `/admin/photos`, `syncCalendarLink`).
- Szobánként → egészben váltásnál a szoba törlésének saját tiltása van (ADR-0299: nyitott kérésnél nem törölhető) — a megvalósítás a meglévő törlést hívja, és a tiltó mondatát mutatja.
- A meglévő „Foglalás beállítása” oldal (ADR-0380) megmarad haladó nézetnek; mindhárom bejárat ugyanazokon az írás-függvényeken át ment.

## Ahol a megvalósítás SZÁNDÉKOSAN eltér a vázlattól (indokkal)
- A témasor kész-jele és a „Témák” lenyitó jele a közös vékony ikonkészletből jön (pipa, nyíl), nem betű-dingbat (✓, ▾) — ADR-0021 ① / ADR-0224 ikonszabály (dizájn-őr, 2026-11-06).
- A zöld kitöltésen álló pipa színe az új `--citui-on-ok` token (világosban fehér, sötétben navy): a mock fehér pipája sötét módban ~1,7:1 kontrasztú volt (a `--citui-on-bad` mintájára).
- A mezők és választók saját fókusz-gyűrűt kapnak (cián, a tokenekből) — a mockban a böngésző alapja látszott.
- Kész témára ugrásnál a varázsló a téma ELSŐ kérdésén nyílik (a mentett értékkel), félbehagyott témánál ott, ahol abbahagyta.
- A belépés utáni heti emlékeztető nem külön levél, ha ugyanarra a hétre ár-hiány levél is megy: az viszi a hiánylistát és a „Folytatom a beállítást” linket (egy levél, nem kettő).
