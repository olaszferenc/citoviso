## ADR-XXXX — Az amenities modul felülete a mockon a natív „Egy pillantásra” szakasz ikonos tételei

Dátum: 2026-11-26 · Döntéshozó: tulaj (a koordinátoron át, „A” változat) · Kapu: `scripts/configurator-placement-check.mts`

### Kontextus
A dfb45955 (2026-11-26) és az a24c3f50 óta a mock „Amit kínálunk” minta-blokkja elmarad, ha nincs új, forrásolt felszereltség-tétel. Ez akkor történik, ha a kiemelések már felszereltséget neveznek, vagy minden forrásolt tétel már látszik. A minőségi kolléga ugyanis elutasította az üres „Minta” keretet (Riva, Kiskúti) és a kiemelésekből töltött, duplázó listát (Sirató).
Ennek mellékhatása: az eladható amenities modulnak nem maradt felülete a lapon. A konfigurátor kapcsolója így semmit nem mozdított, és a csomagban lévő modul nem látszott. Ez sérti az ADR-0061 all-in szabályát és a §I-t („nincs néma modul”). A configurator-placement-check 11-26 óta piros volt.

### Döntés
1. A mockon, ha az amenities mintaként kínált modul, és a lapon nincs saját amenities felülete, akkor a natív kiemelés-szakasz („Egy pillantásra” / „Amit nálunk talál”) lesz a felülete. Nincs új blokk, és nincs duplázás.
2. Felszereltség-tétel az a kiemelés, amelyet a lap felszereltség-ikonnal rajzol. A predikátum ugyanaz, amivel a sablon az ikont rajzolja: `amenityIconSvg`, vagyis katalógus-címke, fordítási térkép vagy kulcsszó-illesztő.
3. A tételt a sablon copy-horgonya (`data-cit-copy="highlights" data-cit-copy-i`) azonosítja, nem a szöveg. Ugyanis ugyanaz a szó állhat képaláírásban is. A tétel a horog körüli legszélesebb elem, amely nem tartalmaz másik kiemelést, a bevezetőt, listát vagy szakaszt. Ha egy kiemelés kétszer látszik, a kisebb elem a lista-tétel.
4. A tétel `data-cit-module="amenities" data-cit-cut="self"` jelet kap. A konfigurátor meglévő beágyazott-horgony szabálya (`cutSurface`) az amenities kikapcsolásakor pontosan ezeket a tételeket veszi ki, a szakasz többi része marad.
5. Csak a mockon: élő lapon a minta-halmaz üres, így az élő oldalt ez nem érinti.

### Megvalósítás
`src/engine/render.ts` › `stampAmenityItems` (mindkét render-úton, a `stampSellingPointsAnchor` után). Kapu: `configurator-placement-check` (néma modul, látható felület), és új `--self-test` (az amenities-jel levétele, illetve a natív-bélyeg levétele: mindkettő piros). Mérve 21/21 sablonon: a felszereltség-ikonos tételek kapják a jelet, az ikon nélküli kiemelés nem.

### Nyitott
Ha egy lap MINDEN kiemelése felszereltség, az amenities kikapcsolásakor a szakasz címe tételek nélkül marad (a usp modul felülete). Ritka eset, nem mértük.
