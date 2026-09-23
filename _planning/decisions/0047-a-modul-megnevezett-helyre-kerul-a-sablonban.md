## ADR-0047 — A modul MEGNEVEZETT HELYRE kerül a sablonban (nem egy tömbbe, és nem egy idézet belsejébe)

- **Kiváltó (tulaj, 2026-08-21, a `/configure/` élő linket nézve):** „Most akarjuk megszerezni a
  kurva vevőt. Erre kiküldünk neki olyat, hogy egy csíkba, bal oldalt, van az összes modul? Be van
  véve, hogy a teljes mindenséget mutassuk, ami lófaszt nem történik meg, csak akkor, hogyha
  egyiket testreszabásképpen kikapcsolom és újra bekapcsolom."

**A lelet — három hiba egymáson, és MINDEN őr zöld volt rajtuk**

1. **A gyűjtődoboz egy vélemény-idézetbe került (12/16 sablon).** A konfigurátor a
   `document.querySelector("footer")` elé injektált — csakhogy 12 sablon a vendégvélemény
   szerző-sorát is `<footer>`-rel jelöli (`<blockquote><footer>— Péter</footer>`). A `querySelector`
   AZT találta meg elsőnek. Mért szélesség: **230–530px** egy 1400px-es képernyőn. A teljes,
   ~10 000 Ft/hó értékű modul-kínálat egy idézet-kártya belsejébe préselve. Ez volt „a csík".
2. **Az ALL-IN nem történt meg.** A `revealSamples()` egyetlen hívási helye a panel `open()`-je
   volt, tehát a lead a linket megnyitva **0 modult** látott. A kimondott elv („mindent megmutatunk
   alapból, aztán ő testreszab", 2026-08-20) a kódban nem létezett.
3. **A modulok egy tömbben, rossz helyen — ÉLESBEN IS.** A `withModuleSections` mind a 10 blokkot
   összefűzve az enquiry-slot elé tette. Ez „a lap aljának" hangzik, de a sablon a CTA-ját bárhova
   teheti: az `editorial`-on az enquiry a KUPON a lap tetején, tehát tíz modul a galéria és a
   vélemények ELÉ ömlött — fizető tenant oldalán is, nem csak mockban.

**Döntés**

1. **Négy MEGNEVEZETT hely, nem egy.** Minden sablon kitesz négy jelölőt (`data-cit-slot`):
   `showcase` (mit kap a vendég: szobák, árak, felszereltség, előnyök) · `trust` (Google-jelvény,
   vélemény-űrlap — a sablon saját vélemény-szekciója mellé) · `practical` (nyitvatartás,
   megközelítés, környék) · `closing` (hírlevél). **Négy és nem tíz:** tíz slot = 160 döntés 16
   sablonon, és a 17. némán rossz lenne; négy jelentés-csoport sablononként egy sor.
2. **A blokk-KÓD közös marad** (`moduleSections.ts`) — csak a HELYE sablon-specifikus. A 100×N
   csapda (ADR-0016) így elkerülve: új modul = egy blokk-függvény, nem 16 sablon-szerkesztés.
3. **A konfigurátor UGYANOTT mutatja a mintát, ahol a valódi modul lesz.** A minta-blokk a
   sablon `data-cit-slot` helyére kerül, nem gyűjtődobozba. Ez nem kozmetika: ha a minta máshol
   van, mint a megvásárolt modul, akkor nem azt mutatjuk, amit eladunk (§I, mock=live).
4. **ALL-IN az ELSŐ festéskor.** `revealSamples()` a `mount()`-ban fut.
5. **Fallback megmarad, de mérve.** Slot nélküli (régi, MÁR KIKÜLDÖTT) artifactoknál a gyűjtődoboz
   marad — javított lábléc-kereséssel (`pageFooter()`: hátulról az első olyan `<footer>`, ami nincs
   `blockquote/figure/article`-ben). Az őr viszont bukik, ha ÚJ sablon jelölő nélkül érkezik, tehát
   a fallback nem válhat némán a fő úttá.

**Visszafordíthatóság:** 🔄 additív (jelölő + csoportosítás); a slot nélküli út változatlanul él.

**Bizonyíték:** `scripts/module-slot-check.mts` (16 sablon, valódi böngészőben mért szélesség) és
`scripts/configurator-placement-check.mts` (amit a LEAD lát az első festéskor). Mindkettő pirosra
futtatva a VALÓDI hibák visszaállításával: slot egy kártyába → `fullbleed(339px)`; régi
footer-keresés → `230–433px`; `revealSamples` a mountból kivéve → `0 látszik` mind a 16 sablonon.

**A tanulság, ami túlmutat ezen:** minden meglévő őr zöld volt mindhárom hibán, mert mind azt
kérdezte, hogy „ott van-e a tartalom?" — és egyik sem azt, hogy „HOL, és milyen széles?". A
jelenlét nem elrendezés. Amit a vevő lát, azt böngészőben kell MEGMÉRNI (ADR-0044 tanulságának
folytatása: az őr azt mérje, ami számít).
