## ADR-0433 — Egy terv elég: a hiányzó második terv nem tartja vissza a kiküldést

**Dátum:** 2026-11-08 · **Döntött:** tulaj („A)” — a jóváhagyó lapon: „akkor minek nézem? minek kell másodszorra is létre hozni?”) · **Felülírja:** ADR-0406 „minimum kettő mockot kiküldünk” kötelezőségét (2026-10-26) · **Kapcsolódik:** ADR-0430 (jóváhagyó lap, messenger-út)

**Kontextus.** A kiküldés (`prepareDispatchProspect`) a linkhez kötelezően csatolt egy második, átnézett tervet, és ha nem volt, a sort „nincs második, Vera által ellenőrzött terv” jegyzettel visszatartotta. 2026-11-08-án a jóváhagyásra váró 1885 leadből 1536-nak nem volt átnézett második terve (1420-nak második mockja sem), vagyis a tulaj „Mehet”-je után ezek sem mentek volna ki — a jóváhagyó lap sárga sávja ezt jelezte.

**Döntés.** Egy terv elég. Ha a leadnek van átnézett, szobamodulos, más sablonú második terve, a link továbbra is mindkettőt viszi (terv-fülek); ha nincs, a megkeresés egy tervvel megy. A levél és az SMS szövege eddig is a link terveinek számából született (`draft.ts`), így egy tervnél nem ígér kettőt. A jóváhagyó lap „Második terv” szűrője („Van / Nincs — egy tervvel megy”) megmutatja, melyik melyik.

**Visszafordíthatóság:** 🔄 egy sor a `prepareDispatchProspect`-ben. **Őr:** `scripts/dispatch-rooms-guard-check.mts` (a második terv hiánya nem ad `held`-et; a fő- és a második terv szobamodul-őre változatlan). **Elvetett:** a második terv nélküli leadek elrejtése a jóváhagyó lapról, amíg a lánc elkészíti őket („B”) — a lánc áll, és a tulaj szerint a második terv nem éri meg a várakozást.
