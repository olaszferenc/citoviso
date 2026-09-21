# A modul-függőségi rend MEGVALÓSÍTÁSA — ADR-0192 ④/⑤/⑥

**Dátum:** 2026-09-21 · **Ág:** `wt/modulreq` · **Landolt:** `fbd95a9` + `ae6adae`
**Mandátum:** `~/rc-briefs/module-deps-impl-brief.md` — az ADR-0192 megvalósítása a brief
sorrendjében. A felderítés külön szálé volt (`2026-09-21_module_dependency_discovery.md`).

## Mit szállítottam

**⑤ séma + ① lint (`fbd95a9`).** A `ModuleRequirement` a `ModuleDef`-en ül (`id` / `when` /
`strength` / `why`) — nincs DB-tábla: a függőség TERMÉK-SZERKEZET, nem operátor által hangolt
érték (a `supersedes` precedense). A lánc: `booking → pricing → rooms(multiUnit)`.
Öt közös helper (`withRequiredModules` · `missingRequiredModules` · `blockersOfRemoving` ·
`removalClosure` · `sellableModuleIds`) — a kosár, a kapu, a sweep, a lint és az őr MIND ezen
dönt, hogy a halmazt ne lehessen kétféleképp ítélni.

**Mért lyuk befoltozva:** a `module_sales_disabled` kapcsoló némán ÉRVÉNYTELEN csomagot gyártott
(`rooms` levétele után a `teljes`/`ajanlott` tovább kínálta a `pricing`-et és a `booking`-ot), és
a `presetNestingViolations()` zölden állt, mert a kapcsolót nem látja. A kínálat most kaszkádol.

**④.1/④.2 szerver (`ae6adae`).** Új réteg: `src/tenant/moduleRequirements.ts` — a katalógus
szabályát EGY helyen köti tenant-adathoz (egységszám, birtokolt modulok).
- `applyModuleChange`: atomi elutasítás + a teljes eltávolítási zárvány közös lemondás-ajánlatnak.
  **KÉT halmazt ítél**, és a különbség teherhordó: a `want` (amivel a tulaj VÉGÜL rendelkezik,
  mert a fizetésre váró add is leszáll) és az `immediate` (amit MOST hagy maga után).
- **⭐ `applyRenewalPaid` — az ember nélküli út.** Ez volt az egyetlen statement, ami MINDEN függő
  lemondást elsöpört: a kattintáskor a halmaz még érvényes, tehát a toggle-ra kötött őr átengedi,
  és a szabály a FORDULÓNAPON sérül, nézők nélkül. Most visszatart + riaszt (SMS+e-mail; címzett
  nélkül HANGOSAN jelzi, hogy nem ment ki). A visszatartott modul egy ciklusig ingyen fut — a
  három rossz közül a legkisebb.

**Felület (jóváhagyott C kontraktus).** §2b kör 3 változattal, mobil ÉS asztali képpel, valós
katalógus-adaton → a tulaj a **C**-t választotta. Szállítva a SOR szintje: „EGYÜTT JÁR" pirula +
a katalógus `why` mondata saját rács-területen; auto-bepipálás tranzitívan; a vezérlő
kikapcsolása visszaveszi, amit behozott; blokkoló felugró a teljes csoporttal.

## ⛔ Amit ez a kör megtanított

1. **A gépi mérésem ZÖLDET adott egy szétesett elrendezésre.** A magyarázó sáv befoglaló-doboza
   `1042×57` volt — „rendben" —, miközben a `flex-wrap:nowrap` a modul nevét 60 px-es oszlopba
   préselte és a szöveg kilógott a kártyából. **Csak a KÉP mutatta meg.** A mérés most a
   SZOMSZÉDOKAT is nézi (a név oszlop-szélessége, a kártya jobb széle).
2. **Szűk felismerő = hamis zöld.** Az „a lap kimondja, miért" állításom az *„ehhez jár"*
   szókapcsolatra mért; a B változat kiírta azt — az indoklás viszont ÜRES sztring volt (a
   `booking` a `pricing`-et követeli meg, nem a `rooms`-ot). Az állítás most a katalógus
   mondatait tűzi ki szó szerint.
3. **Üres kontroll.** Az őr „visszaszivárgás" szakaszának nem volt fizetett rendelése a
   fixture-ben, így a `paid` unió üresen jött: az állítás igazat mondott, és SOHA nem ért el az
   új kódig. Most valódi `order_intent`+`payment` áll mögötte.
4. **⛔⛔ A kapum megtagadta a FIZETŐ VEVŐT** — és egy MEGLÉVŐ őr (`entitlement-paid-check`)
   fogta meg, nem az enyém. Visszafordítottam: a kifizetett modul BEKAPCSOL + hangos riasztás
   (a valódi kár egy réteggel lejjebb, az ADR-0193 render/ár-kapuban már kezelve van).
5. **…és a párja FORDÍTVA állt:** a `module-upsell-check` 5 állítása azért bukott, mert a
   fixture `booking`-ot használt „egy felárazott modul" HELYETTESEKÉNT, függőségek nélkül. Ott a
   FIXTURE volt rossz (az őr tárgya az ADR-0113 fizetési mechanika) → függőség-mentes modulra
   váltott, kimondott indoklással. **A kettőt nem szabad összemosni** — abból lesz a „javítsd a
   tesztet, hogy átmenjen". Részletek: `feedback_my_new_gate_refused_legitimate_work`.
6. **Kétszer olvastam exit 0-t BUKOTT commitra** (a `| tail` nyeli a státuszt → külön
   `echo "rc=$?"`), és egyszer a **saját szerkesztésem törte el a futó pre-commit hookot** (a
   hook rendereli a fájlt, amit közben írtam). Hook futása alatt nem nyúlunk a fához.

## ADR-0192 helyesbítve (tulajdonosi jóváhagyással)

- **④.2:** a példamondat KETTŐT feltételezett (`Szobák`↔`Foglalás`); a mért lánc HÁROM tagú — a
  közbülső `pricing` kimaradt. Az eredeti mondat **áthúzva marad**: különben nem derülne ki, hogy
  a megvalósítás nem hibázott, hanem egy azóta helyesbített feltevést követett.
- **⑧:** az 1–2. tétel lezárva (a `wt/arkapu` landolta, **ADR-0193**); a 3–8. nyitva marad.

## Kapuk

`tsc` · `module-config-lint` + `--selftest` **10/10** (8 szándékosan törött fixture + 2 pozitív,
köztük a MÉRT lyuk reprodukciója) · `module-dependency-check` (`--selftest` ÉS teljes DB-s futás,
valós fixture-tenanten KÉT egységgel, a négy negatív kontrollal) · `module-upsell-check` ·
`entitlement-paid-check` · `guard-wiring-check` · `contract-drift-check` · `i18n-lint` ·
`i18n-scope` · `design-token-lint` — mind zöld.

## 🔴 Nyitott — a következő szálnak

1. A terv-sáv **CSOPORTOSÍTOTT ár-blokkja** (a kontraktus §2 második fele). A sor már beszél,
   a sáv még tételesen listáz. ⚠️ A blokk az `arkapu` `fcAllocate()`/`c.dataset.fcLine`
   szerkezetére épül — az az ő bázisa.
2. A lead-oldali **konfigurátor kosara** (a manifest még nem szállítja a `requires`-t) és a
   **`/pricing`** csomag-kártyák (ott a „nem eladó" jelvény ma MÁS halmazt mérne, mint a kiírt
   csomagár — `feedback_label_must_derive_from_predicate`).
3. A **három KB-szócikk** (ADR-0192 ⑥ vége): `kb/entries/admin-modules/entry.hu.md:51-68` és
   `:186-195`, `kb/entries/admin-subscription/entry.hu.md:213-226`, `kb/entries/admin-modules-booking/`.
   ⚠️ A felirat-változás UGYANABBAN a commitban kéri a forrást, a félkövér idézetet és a `kb-shot`-ot.
4. Az őr **① és ⑤** állítása (kliens-halmaz · „Fizetendő most" == `order.price`) — az őrben
   HANGOSAN jelölve, hogy nincs lefedve.
5. A felület **INTERAKCIÓJA** eddig csak a §2b vázlaton van végigkattintva (3 változat × 2 méret,
   Playwright); az ÉLES lapon csak a renderelést mértem (`ui-shot`, nem törik).
6. A függőségi tudás beírása a `_planning/DOMAIN/05-MODULES.md`-be — a felderítő szál ma
   landolta (`e338d79`), a brief tiltása feloldódott.
