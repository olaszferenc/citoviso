## ADR-0051 — A konfigurátor tételes listája ALAPBÓL NYITVA, az ár pedig folyamatosan követhető

- **Kiváltó (tulaj, 2026-08-21):** „Amikor a lead leendő tenant megnézi a linket, amit kap, és
  elkezdi konfigurálni magának a holnapot, akkor legyen automatikusan kinyitva a **testre szabom**
  rész, és folyamatosan lássa a havi díjak alakulását, ahogy ki-be kapcsolja azt."
- **Ami rossz volt:** a 12 tételes kapcsoló egy „Testre szabom" lenyíló mögött ült (preset-first
  ergonómia, 2026-07-20). A csomag-kártyák ára látszott, de az EGYEDI összeállítás ára csak egy
  extra koppintás után — a vásárló nem látta, mibe kerül az, amit épp bekapcsol.

**Döntés**

1. **A tételes lista alapból NYITVA.** A preset-kártyák maradnak a lap tetején (az egy-koppintásos
   út érintetlen), a gomb csak ÖSSZECSUKÁSRA marad meg. Az ADR-0015 „a modult csak láthatóan adjuk
   el" elvének egyenes következménye: ha a választás rejtve van, az ára is rejtve van.
2. **Az összeg soha nem tűnhet el.** A futó havi díj a panel lábában él, `flex: 0 0 auto` — a nyitott
   listával megnőtt tartalom sem tolhatja ki a képernyőről (a láb marad, a törzs görget).
3. **A változást KI KELL MONDANI.** Néma szám-csere mellett a szem a kapcsolón van: minden módosulás
   megdobja az összeget és 2,2 másodpercre kiírja a különbséget (`+490 Ft/hó` / `−690 Ft/hó`).
   Ugyanez szól csomag-váltásnál is (Teljes → Alap: `−5 500 Ft/hó`).
4. **A testre szabó rész SAJÁT FELÜLET.** Más jellegű döntés, mint a fölötte lévő
   csomag-kártyák (kapcsolónként vs. egy koppintás), ezért saját, világosabb dobozt kap
   akcent-éllel — enélkül a kártyák alatti listaként olvasódott, nem külön munkaasztalként.

5. **Saját domain név + „Ellenőrzés" gomb.** A 3–5 javaslatunk a cégnévből tippel; ha egyik
   sem tetszik, a vevő beírhatja a magáét. Szándékosan GOMB (nem az aldomain-mező debounce-olt
   automatikája): minden ítélet egy DNS+RDAP körút, és a félig beírt „pel", „pelda", „pelda.h"
   hármat égetne el, ráadásul „foglalt"-ot villantana egy be sem fejezett névre. A beírt nevet
   normalizáljuk (`https://`, `www.`, per, nagybetű, záró pont lekerül); FOGLALT név sosem lehet
   a választás; szerkesztés után az elavult ítélet és a hozzá tartozó választás is elszáll.

6. **Kapu, ami a VISELKEDÉST méri:** `scripts/configurator-price-check.mts` valódi böngészőben,
   1180px-en ÉS 390px-en: (a) a kapcsolók láthatók-e extra koppintás nélkül, (b) a képernyőn van-e
   az összeg abban a pillanatban, (c) pontosan a modul árával mozdul-e, (d) megjelenik-e a
   különbség-jelzés, (e) a saját-domain út: normalizálás, kiválasztás, FOGLALT név elutasítása,
   szerkesztés utáni elavulás. Mind a négy tengelyen szándékos rontással PIROSRA futtatva (rejtett
   lista → bukik; delta-jelzés kivéve → bukik; foglalt név elfogadva → bukik; elavult választás
   bennmarad → bukik). `hooks/pre-commit`-be kötve, csak konfigurátor-fájl staged-elésekor.
