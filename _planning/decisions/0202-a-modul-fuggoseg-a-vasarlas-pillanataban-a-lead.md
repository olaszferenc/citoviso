## ADR-0202 — A modul-függőség a VÁSÁRLÁS pillanatában: a lead kosara bepipál, a beküldő végpont elutasít (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0192 (a lánc, a húsz
fogyasztó és a négy tulajdonosi döntés — ez annak ④.1 pontja a lead-oldalon), ADR-0072 (az élő
készlet = amit kifizetett; a kapu nem tagadhatja meg a fizető vevőt), ADR-0113 (fizetés után
élesedik), ADR-0155 ③ (fagyasztott admin → kaszkád tilos), ADR-0175 (minden képernyő megmondja,
mit fizet a vevő), ADR-0193 (ár-jogosultsági kapu a foglalási úton).
**Kontraktus:** `assets/design-refs/console/module-dependency/README.md` (C változat).

**Kiváltó.** Tulajdonosi mandátum (`~/rc-briefs/lead-side-dependency-gate-brief.md`): az ADR-0192
szabályának **pontosan két fogyasztója** volt a kódban (`src/tenant/moduleChange.ts`,
`src/tenant/paidEntitlements.ts`), és a lead-oldali kosár meg a rendelés-beküldés **egyiket sem
hívta**. A doktrína ott állt, ahol a tulaj már bent van, és ott hiányzott, ahol a pénz ELŐSZÖR
mozdul: egy új vevő megvehette az **Online foglalást Árak nélkül**, kifizette, és a konverzió
pontosan azt élesítette — foglalási naptár, ami nem tud árat mondani. A meglévő tulaj ugyanezt a
Modulok fülön már nem tudta előállítani.

### ① A kosár BEPIPÁLJA — a kliens, nem a szerver

A konfigurátor-manifest (`src/generator/configurator.ts`) mostantól szállítja a modul **hard**
követelményeit a katalógus `why` mondatával együtt, és a kosár
(`assets/runtime/cit-configurator.js`) bekapcsoláskor tranzitívan bepipálja a láncot.

⭐ **Miért a kliens:** a fizetendő összeg és a fizetés-megerősítő a KIVÁLASZTOTT halmazon iterál,
tehát a helyes ár **magától következik**. Néma szerver-oldali hozzávételnél a vevő 990-et látna és
2 170-et fizetne — az ADR-0192 ④.1 pont ezt zárta ki.

**Mért eredmény** (böngészőben, mindkét méreten): a `booking` bekapcsolása behozza a `pricing`-et
és a `rooms`-ot, a vezérlő sora kimondja `Ehhez jár: Árak, szezonok +490 Ft · Szobák, apartmanok
+690 Ft — együtt 2 170 Ft / hó`, és az összeg **+2 170 Ft/hó**-val ugrik — a jóváhagyott
kontraktus száma, pontosan.

⛔ A kontextus szándékosan ÜRES (`multiUnit = "unknown"`), tehát a feltételes él
(`pricing → rooms`) a lead-oldalon **ÁLL**: a prospectnek szerkezetileg nincs `site_unit` sora, a
mock viszont maga három szobakártyát MUTAT (ADR-0192 ④.4). A manifest és a szerver-kapu ugyanazt
az olvasatot használja — két olvasat esetén a kosár olyan halmazt pipálna be, amit a szerver
utána elutasít.

### ② ⭐ A VALÓDI VÉDELEM: a beküldő végpont ELUTASÍT

`POST /configure/:artifactId/request` (és a követett `/p/:token/request`) a modul-szűrés után
kiértékeli a halmazt, és `400 module_dependency_unmet`-tel elakad. Mérve a **kiszállított
HTTP-végponton**, nem forrás-grepből (`feedback_gate_measured_text_not_its_source`): a vezérlő a
párja nélkül **és** a lánc KÖZEPÉN megszakítva is elakad.

⛔ **Elutasítás, nem kiegészítés és nem néma elhagyás.** Kiegészítve a vevő többet fizetne, mint
amit jóváhagyott; a függő modult elhagyva kifizetné és nem kapná meg. A hozzáíró írás nem kapu
(`feedback_additive_write_is_not_a_gate`). A végpont három meglévő kapuja (fotó-jog, ismétlődő
mandátum, számlázási azonosság) ugyanígy utasít el, ugyanezen az úton.

⚠️ **Ez nem tagadhat meg valódi vevőt** (ADR-0072 nem alku tárgya). A bizonyíték nem feltevés:
a konfigurátor futása **kiszolgáláskor** injektálódik — mérve **0 tárolt mock-artifact** viseli a
`data-cit-configurator` jelölőt —, tehát egy hónapokkal ezelőtti mock-link is a MAI, pipáló
kosarat kapja. Az egyetlen maradék út az elavult fül, és arra a kliensnek külön ága van:
bepipálja a hiányzót, visszavisz a tervhez, és kimondja, hogy **fizetés nem indult, a kártyát nem
terheltük**. ⛔ Ág nélkül a kérés némán a `showThanks()`-re esett volna, ami „Megkaptuk a
rendelését"-et mond egy rendelésre, amit a szerver NEM vett fel.

### ③ ⛔ A KONVERZIÓS ÁG NEM ÉPÜLT MEG — és ezt ki kell mondani

A brief harmadik lépése a RÉGI, érvénytelen rendelés konverzióját kérte, tulajdonosi döntéssel.
**Megmértem, mielőtt megépítettem volna** (`feedback_measure_the_proposed_fix_not_only_the_bug`):
a dev `order_intent` **9 beküldött sorából 0 sértő**, és az ADR-0192 ⑦ ugyanezt mérte élesen is
(**0**, mind a 3 `initial`). A tulaj döntése ezek után egyértelmű volt: erre nem építünk gépezetet.

A beküldő kapu a FORRÁST zárja el, tehát új sértő rendelés nem keletkezhet. **Ha valaha mégis
előállna** (pl. az ADR-0192 ⑧.7 nem-atomi aktiválásából), a nyitott kérdés változatlan:
kiegészítés INGYEN + operátori riasztás (a `heldCancellations` mintája — a költség a miénk, a
döntés emberé), vagy emberi kézbe adás. ⛔ Ezt a mai adaton eldönteni spekuláció volna.

### ④ Amit a SAJÁT MÉRÉSEM fogott meg — kétszer, egymásba fonódva

1. ⛔⛔ **Az őröm `check()`-jének argumentum-sorrendjét elrontottam** (a definíció
   `(feltétel, címke)` volt, minden hívás a CÍMKÉT adta elsőnek), és mivel a nem üres sztring
   igaz, **39 állítás ment zöldre úgy, hogy egyikük sem mért semmit**. A kimenetben ott állt:
   `✓ false ↳ 82px` — a lap KIÍRTA a bukást és zöldre értékelte
   (`feedback_recorded_failure_must_not_grade_green`). Az őr most szigorúan logikai értéket
   követel; bármi más azonnal, hangosan bukik.
2. Az a `82px` **VALÓDI lelet** volt: a pirula a nyers flex-sorban 82 px-es oszlopba préselte a
   modulnevet, 390 px-en ÉS 1280 px-en is (a panel fix szélességű, az asztali nem ment meg) —
   pontosan az a csapda, amit a kontraktus külön kiköt. A név és a pirula közös, tördelhető
   dobozba került. ⭐ Az őr mércéje nem önkényes pixelszám, hanem **alapvonal**: ugyanaz a sor
   pirula nélkül vs. pirulával. A kérdés nem az, hogy hány pixel, hanem hogy a pirula ELVESZ-e.

⭐ A kettő tanulsága együtt: a hamis zöld **elrejtette a valódi leletet**, és a lelet csak akkor
került elő, amikor az őr elkezdett igazat mondani. Egy őr, ami mindig zöld, nem védelem, hanem
altató.

3. **A harmadik leletet egy MEGLÉVŐ őr adta, a commit-kapuban.** A
   `configurator-placement-check` §I állítása („nincs néma modul", tulajdonosi bejelentés
   2026-08-23) pirosra ment a `rooms` és a `pricing` sorára. A kérdés nem az volt, hogyan
   engedjem át, hanem hogy **MIT ÁLLÍT**: a `.cit-cfg-locked`-ot NEM viselő sorokat kapcsolgatja
   végig, és azt várja, hogy a lap változzon. A fogott sor szemantikailag zárolt volt, de a
   DOM-ban nem mondta ki — tehát **nem a fixture sodródott bele, hanem a kódom volt
   következetlen**. A javítás a saját oldalamon történt: a fogott sor mostantól viseli a meglévő
   `cit-cfg-locked` idiómát (gerinc + kiváltott sorok nyelve), additívan, hogy az ő zárolásukat
   ne vegye le.
   ⛔ A `.cit-cfg-locked` **halványítását** viszont vissza kellett venni: az a „ez nincs az
   ajánlatban" nyelve, ez a sor pedig BENNE van és a vevő FIZET érte — egy kifizetett modult
   kiszürkíteni hazugság a saját számlájáról.
   ⚠️ Járulékos, kimondandó következmény: az ALL-IN nyitóképen a `booking` be van kapcsolva, tehát
   a `Szobák` és az `Árak` sora **alapból zárolt**. Aki a Szobákat akarja levenni, előbb az Online
   foglalást veszi le. Ez a ④.2 döntés egyenes következménye, nem mellékhatás — de a tulaj a
   képeken ezt is látja.

### ⑤ Négy, a kontraktustól tudatosan eltérő döntés a lead-keretben

1. **Felugró helyett zárolás.** A Modulok fülön a levételi kísérlet FELUGRÓT nyit (kontraktus §6,
   ADR-0155 ③ miatt kaszkád nélkül). A lead-keretben a sor zárolva marad, a kísérlet pedig
   **ugyanabban a pillanatban** megszólaltatja a magyarázatot és felvillantja azt a sort, ami
   fogja. ⛔ Néma elutasítás tilos: egy kapcsoló, ami nem mozdul és nem mond semmit, hibának
   látszik.
2. **A magyarázat nem kiabál alapállapotban.** Az ALL-IN nyitóképen minden modul be van kapcsolva,
   tehát a lánc végig „fogott" — sávval két cián blokk fogadná a vevőt olyasmiről, amit még nem is
   próbált. A sáv ezért a **függőség hozta** sorokon áll mindig, a sajátkezűn pedig a kísérletkor
   jelenik meg. Mérve: tiszta lappal **0 sáv**.
3. **A „mennyiért" a vezérlő SORÁRA került**, mert a lead-keretben nincs terv-sáv (a Modulok fülön
   az viszi ezt a szerepet). Az INDOKLÁS így is csak egyszer hangzik el — a C változat állítása áll.
4. ⚠️ **A lánc három sora három KÜLÖN csoportban áll** (`Szobák`/`Árak` = „Amit bemutat",
   `Foglalás` = „Extrák"), tehát a vevő egy képernyőn sosem látja mind a hármat. Ezt a vezérlő
   sorának csoportosított ár-mondata hidalja át — **nem szerkezeti javítás, hanem tudatosan
   vállalt korlát**. A tulaj mindkét méret mindkét szerepéről képet kapott; ha zavaró, a
   csoportosítás a következő kör kérdése.

### ⑥ Az őr

Új: **`scripts/module-dependency-cart-check.mts`** (`hooks/pre-commit`-be kötve) — **46 állítás**,
böngészőben MINDKÉT méreten (390 px és 1280 px), plusz a kiszállított HTTP-végponton.

- ⭐ A lánc a **katalógusból** származik, nem beégetve: ha a termék változik, az őr vele változik
  (`feedback_narrow_recognizer_is_a_false_green`). Ha a katalógusban nincs hard lánc, az őr
  **hangosan kilép**, nem némán zöldül.
- **⑤ a „Fizetendő most" == a szerver ára** két FÜGGETLEN implementációból (böngésző-JS vs.
  `computeAnnual`) — az őr nem hívhatja azt, amit vizsgál
  (`feedback_guard_must_not_borrow_its_subject`). Mérve: **95 000 == 95 000**.
- **Négy negatív kontroll:** az érvényes halmaz ÁTMEGY (a fizető vevőt nem tagadja meg) · a lánc
  közepe is elakad · a ⑤ állítás nem üres (függőség nélkül az ár **83 200 ≠ 95 000**) · minden él
  SAJÁT, nem üres indoklással jár (ha a két mondat egybeesne, a „mindkettőt kiírtuk" állítás egy
  HIBÁS megvalósításra is igaz lenne — a terv-kör pont ezt mérte ki).
- **Mellékhatás-fékek.** A szerver **efemer**, az operációs rendszer által kiosztott porton indul,
  és a mérés végén bezárul: fix porton a párhuzamos szálak megölnék egymás szerverét, és a mérés a
  MÁSIK fa kódját kérdezné — fail-closed őrsor tiltja a megosztott konzol-portot. ⚠️ Ez NEM sérti
  a „egyetlen tesztfelület, nincsenek portok" munkarendet: az a szabály arról szól, hogy a TULAJNAK
  nem adunk port-URL-t; itt ember számára soha elérhető cím nem keletkezik (ugyanaz a minta, amit a
  `booking-price-gate-check` már használ). A boot-idejű nyelvi-csomag feltöltés (AI-hívás +
  DB-írás) a meglévő `CIT_SHOT=1` kapcsolóval kimarad — egy mérésnek nincs joga ilyet kiváltani.
- Az ADR-0192 ⑥ őrének **NOT_COVERED** listája kiürült, de nem mutatóra cserélve: a
  `module-dependency-check` mostantól **állítja**, hogy a kosár-őr létezik ÉS hogy a pre-commit
  tényleg lefuttatja — a mutató önmagában ígéret, nem bizonyíték. Negatív kontrollal igazolva: a
  hook-sort kivéve az állítás **pirosra megy**.

### ⑦ Nyitva marad

A terv-sáv csoportosított ár-blokkja a Modulok fülön · a `/pricing` csomag-kártyák jelvénye (ott a
jelvény és a kiírt csomagár ma MÁS halmazt mérne) · a három KB-szócikk · a
`_planning/DOMAIN/05-MODULES.md` függőségi szakasza · az ADR-0192 ⑧ 3–5. tétele.
